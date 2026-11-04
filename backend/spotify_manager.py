import os
import json
import time
import base64
import logging
import threading
import requests
from typing import Optional, Dict, Any, List

logger = logging.getLogger("spotify_manager")
logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")

CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "session_cache.json")

class SpotifyManager:
    def __init__(self):
        self.session = None
        self.zeroconf_server = None
        self.cached_token = None
        self.token_expiry = 0
        self.user_profile = None
        self.is_connected = False
        self.connection_status = "Disconnected"
        self.auth_lock = threading.Lock()
        
        # Try loading previously stored session
        self.load_stored_session()

    def load_stored_session(self) -> bool:
        """Attempt to restore a saved session from session_cache.json"""
        if not os.path.exists(CACHE_FILE):
            return False
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            stored_str = data.get("stored_session")
            if not stored_str:
                return False
            
            logger.info("Attempting to restore session from stored cache...")
            from librespot.core import Session
            self.session = Session.Builder().stored(stored_str).create()
            self.is_connected = True
            self.connection_status = f"Connected as {self.session.username()}"
            logger.info("Successfully restored session for %s", self.session.username())
            self._fetch_user_profile()
            return True
        except Exception as e:
            logger.warning("Failed to restore stored session: %s", e)
            self.session = None
            self.is_connected = False
            self.connection_status = "Disconnected"
            return False

    def save_session_cache(self):
        """Save the current session's reusable blob string to cache"""
        if not self.session:
            return
        try:
            stored_str = self.session.stored()
            data = {
                "username": self.session.username(),
                "stored_session": stored_str,
                "saved_at": time.time()
            }
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            logger.info("Session saved to %s", CACHE_FILE)
        except Exception as e:
            logger.error("Failed to save session cache: %s", e)

    def login_user_pass(self, username: str, password: str) -> Dict[str, Any]:
        """Direct username & password login via Librespot"""
        try:
            from librespot.core import Session
            self.connection_status = "Authenticating..."
            self.session = Session.Builder().user_pass(username, password).create()
            self.is_connected = True
            self.connection_status = f"Connected as {self.session.username()}"
            self.save_session_cache()
            self._fetch_user_profile()
            return {"success": True, "username": self.session.username()}
        except Exception as e:
            logger.error("Username/password login failed: %s", e)
            self.is_connected = False
            self.connection_status = f"Login failed: {str(e)}"
            return {"success": False, "error": str(e)}

    def start_zeroconf(self, device_name: str = "Songless Guessing Game") -> Dict[str, Any]:
        """Start mDNS / Spotify Connect receiver for one-click pairing from Spotify/Spotifast"""
        if self.zeroconf_server:
            return {"success": True, "device_name": device_name, "message": "Zeroconf server already running"}

        try:
            from librespot.zeroconf import ZeroconfServer, SessionListener
            
            class CustomListener(SessionListener):
                def __init__(self, manager):
                    self.manager = manager
                
                def session_changed(self, new_session):
                    logger.info("Zeroconf received new session for: %s", new_session.username())
                    self.manager.session = new_session
                    self.manager.is_connected = True
                    self.manager.connection_status = f"Connected as {new_session.username()}"
                    self.manager.save_session_cache()
                    self.manager._fetch_user_profile()

            builder = ZeroconfServer.Builder().set_device_name(device_name)
            self.zeroconf_server = builder.create()
            self.zeroconf_server.add_session_listener(CustomListener(self))
            self.connection_status = f"Waiting for Spotify Connect ('{device_name}')..."
            logger.info("Zeroconf server started as '%s'", device_name)
            return {"success": True, "device_name": device_name}
        except Exception as e:
            logger.error("Failed to start Zeroconf server: %s", e)
            return {"success": False, "error": str(e)}

    def get_access_token(self) -> Optional[str]:
        """Obtain a valid Spotify Web API bearer token from the active Librespot session"""
        if not self.session:
            return None
        
        now = time.time()
        if self.cached_token and now < self.token_expiry:
            return self.cached_token
        
        try:
            scope = (
                "user-read-private "
                "user-read-email "
                "user-top-read "
                "user-library-read "
                "playlist-read-private "
                "playlist-read-collaborative "
                "user-read-recently-played"
            )
            token = self.session.tokens().get(scope)
            self.cached_token = token
            self.token_expiry = now + 3000  # 50 minutes buffer
            return token
        except Exception as e:
            logger.error("Failed to get Spotify Web API token: %s", e)
            return None

    def _fetch_user_profile(self):
        """Fetch basic user info from Spotify Web API"""
        token = self.get_access_token()
        if not token:
            return
        try:
            res = requests.get(
                "https://api.spotify.com/v1/me",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10
            )
            if res.status_code == 200:
                self.user_profile = res.json()
                logger.info("Loaded profile for: %s", self.user_profile.get("display_name"))
        except Exception as e:
            logger.warning("Could not fetch user profile: %s", e)

    def get_status(self) -> Dict[str, Any]:
        """Return current authentication and user profile state"""
        return {
            "connected": self.is_connected and self.session is not None,
            "status": self.connection_status,
            "username": self.session.username() if self.session else None,
            "display_name": self.user_profile.get("display_name") if self.user_profile else None,
            "product": self.user_profile.get("product") if self.user_profile else None,
            "image": self.user_profile.get("images", [{}])[0].get("url") if self.user_profile and self.user_profile.get("images") else None
        }

    def fetch_top_tracks(self, time_range: str = "short_term", limit: int = 50) -> List[Dict[str, Any]]:
        """
        Fetch top tracks:
        - short_term: ~4 weeks (Easy / Heavy Rotation)
        - medium_term: ~6 months (Medium / Favorites)
        - long_term: ~several years (Hard / Deep Cuts)
        """
        token = self.get_access_token()
        if not token:
            return []
        
        url = f"https://api.spotify.com/v1/me/top/tracks?time_range={time_range}&limit={min(limit, 50)}"
        res = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
        if res.status_code != 200:
            logger.error("Failed to fetch top tracks: %s %s", res.status_code, res.text)
            return []
        
        items = res.json().get("items", [])
        return [self._format_track(item, play_count_rank=idx + 1) for idx, item in enumerate(items)]

    def fetch_liked_songs(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetch user's Liked Songs library"""
        token = self.get_access_token()
        if not token:
            return []
        
        url = f"https://api.spotify.com/v1/me/tracks?limit={min(limit, 50)}"
        res = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
        if res.status_code != 200:
            logger.error("Failed to fetch liked songs: %s %s", res.status_code, res.text)
            return []
        
        items = res.json().get("items", [])
        return [self._format_track(item.get("track"), play_count_rank=idx + 1) for idx, item in enumerate(items) if item.get("track")]

    def fetch_playlists(self) -> List[Dict[str, Any]]:
        """Fetch list of user's playlists"""
        token = self.get_access_token()
        if not token:
            return []
        
        url = "https://api.spotify.com/v1/me/playlists?limit=50"
        res = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
        if res.status_code != 200:
            return []
        
        items = res.json().get("items", [])
        playlists = []
        for p in items:
            playlists.append({
                "id": p.get("id"),
                "name": p.get("name"),
                "tracks_count": p.get("tracks", {}).get("total", 0),
                "image": p.get("images", [{}])[0].get("url") if p.get("images") else None
            })
        return playlists

    def fetch_playlist_tracks(self, playlist_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch tracks inside a specific playlist"""
        token = self.get_access_token()
        if not token:
            return []
        
        url = f"https://api.spotify.com/v1/playlists/{playlist_id}/tracks?limit={min(limit, 100)}"
        res = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
        if res.status_code != 200:
            return []
        
        items = res.json().get("items", [])
        tracks = []
        for idx, item in enumerate(items):
            track = item.get("track")
            if track and track.get("id"):
                tracks.append(self._format_track(track, play_count_rank=idx + 1))
        return tracks

    def get_track_audio_bytes(self, track_uri_or_id: str, max_seconds: int = 10) -> Optional[bytes]:
        """
        Stream decrypted audio bytes directly from Spotify using Librespot.
        Reads enough Vorbis data for the snippet stages (~10 seconds).
        """
        if not self.session:
            return None
        
        try:
            from librespot.metadata import TrackId
            from librespot.audio.decoders import AudioQuality, VorbisOnlyAudioQuality
            
            # Format URI if only ID passed
            if not track_uri_or_id.startswith("spotify:track:"):
                track_uri = f"spotify:track:{track_uri_or_id}"
            else:
                track_uri = track_uri_or_id
                
            track_id = TrackId.from_uri(track_uri)
            
            # Normal audio quality (~160kbps Vorbis, very fast to buffer)
            quality = VorbisOnlyAudioQuality(AudioQuality.NORMAL)
            stream = self.session.content_feeder().load(track_id, quality, False, None)
            
            audio_stream = stream.input_stream.stream()
            
            # Read first ~300KB (typically ~15-20 seconds of 160kbps Vorbis)
            target_bytes = max_seconds * 22000  # ~22KB per second of 160k Vorbis
            buffer = bytearray()
            
            chunk_size = 4096
            while len(buffer) < target_bytes:
                chunk = audio_stream.read(chunk_size)
                if not chunk or chunk == -1:
                    break
                buffer.extend(chunk)
                
            return bytes(buffer)
        except Exception as e:
            logger.error("Failed to load audio stream from Librespot for %s: %s", track_uri_or_id, e)
            return None

    def _format_track(self, item: Dict[str, Any], play_count_rank: int = 0) -> Dict[str, Any]:
        """Standardize track metadata for the frontend"""
        artists = [a.get("name") for a in item.get("artists", [])]
        artist_str = ", ".join(artists) if artists else "Unknown Artist"
        album = item.get("album", {})
        images = album.get("images", [])
        image_url = images[0].get("url") if images else ""
        thumbnail_url = images[-1].get("url") if images else image_url
        
        return {
            "id": item.get("id"),
            "uri": item.get("uri"),
            "name": item.get("name"),
            "artist": artist_str,
            "artists_list": artists,
            "album_name": album.get("name"),
            "image_url": image_url,
            "thumbnail_url": thumbnail_url,
            "duration_ms": item.get("duration_ms", 0),
            "popularity": item.get("popularity", 50),
            "rank": play_count_rank,
            "preview_url": item.get("preview_url")  # In case Spotify provides it
        }

    def logout(self):
        """Disconnect and clear cache"""
        self.session = None
        self.is_connected = False
        self.user_profile = None
        self.cached_token = None
        self.connection_status = "Disconnected"
        if os.path.exists(CACHE_FILE):
            try:
                os.remove(CACHE_FILE)
            except Exception:
                pass
