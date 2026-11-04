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
        self.client_id = "584f1fe365ea49978b2355b8b60404bd"
        self.refresh_token = None
        self.oauth_verifier = None
        self._oauth_httpd = None
        
        # Try loading previously stored session
        self.load_stored_session()

    def load_stored_session(self) -> bool:
        """Attempt to restore a saved session from session_cache.json"""
        if not os.path.exists(CACHE_FILE):
            return False
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Check for OAuth tokens first
            if "refresh_token" in data:
                self.refresh_token = data.get("refresh_token")
                self.cached_token = data.get("access_token")
                self.token_expiry = data.get("token_expiry", 0)
                if time.time() >= self.token_expiry:
                    self._refresh_access_token()
                if self.cached_token:
                    self.is_connected = True
                    self._fetch_user_profile()
                    name = self.user_profile.get("display_name") if self.user_profile else "Spotify User"
                    self.connection_status = f"Connected as {name}"
                    logger.info("Successfully restored OAuth session for %s", name)
                    return True

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
        """Save the current session's reusable blob string or OAuth tokens to cache"""
        data = {}
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = {}

        if self.session:
            try:
                data["username"] = self.session.username()
                data["stored_session"] = self.session.stored()
            except Exception:
                pass

        if self.refresh_token:
            data["refresh_token"] = self.refresh_token
            data["access_token"] = self.cached_token
            data["token_expiry"] = self.token_expiry

        data["saved_at"] = time.time()
        try:
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
        
        if self.refresh_token:
            refreshed = self._refresh_access_token()
            if refreshed:
                return refreshed

        if not self.session:
            return None

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
        is_conn = self.is_connected and (self.session is not None or self.cached_token is not None)
        username = self.session.username() if self.session else (self.user_profile.get("id") if self.user_profile else None)
        return {
            "connected": is_conn,
            "status": self.connection_status,
            "username": username,
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
        """Fetch list of user's playlists (with offline Spotifast cache fallback)"""
        import glob
        my_id = (self.user_profile.get("id") if self.user_profile else None) or "31leppthj2runlbv3x6juui65bpa"
        token = self.get_access_token()
        playlists = []

        if token:
            try:
                url = "https://api.spotify.com/v1/me/playlists?limit=50"
                res = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=6, verify=False)
                if res.status_code == 200 and "application/json" in res.headers.get("Content-Type", ""):
                    items = res.json().get("items", [])
                    for p in items:
                        owner_id = p.get("owner", {}).get("id")
                        playlists.append({
                            "id": p.get("id"),
                            "name": p.get("name"),
                            "tracks_count": p.get("tracks", {}).get("total", 0),
                            "image": p.get("images", [{}])[0].get("url") if p.get("images") else None,
                            "is_mine": (owner_id == my_id or owner_id == "31leppthj2runlbv3x6juui65bpa"),
                            "owner_name": p.get("owner", {}).get("display_name", "")
                        })
                    if playlists:
                        return playlists
            except Exception as e:
                logger.warning("Online playlist fetch failed: %s, checking local cache", e)

        # Fallback to local Spotifast cached library
        base_dir = os.path.dirname(os.path.dirname(__file__))
        cache_files = glob.glob(os.path.join(base_dir, "spotifast", "spotifast-data", "cache", "library", "*.json"))
        for cf in cache_files:
            try:
                with open(cf, "r", encoding="utf-8") as f:
                    cdata = json.load(f)
                items = cdata.get("data", [])
                for p in items:
                    owner_id = p.get("owner", {}).get("id")
                    playlists.append({
                        "id": p.get("id"),
                        "name": p.get("name"),
                        "tracks_count": p.get("items", {}).get("total") or (p.get("tracks") or {}).get("total", 0),
                        "image": p.get("images", [{}])[0].get("url") if p.get("images") else None,
                        "is_mine": (owner_id == my_id or owner_id == "31leppthj2runlbv3x6juui65bpa"),
                        "owner_name": p.get("owner", {}).get("display_name", "")
                    })
                if playlists:
                    logger.info("Loaded %d playlists from local Spotifast cache", len(playlists))
                    return playlists
            except Exception as e:
                logger.warning("Error reading local library cache %s: %s", cf, e)

        return playlists

    def fetch_playlist_tracks(self, playlist_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch tracks inside a specific playlist (with offline Spotifast cache fallback)"""
        import glob
        token = self.get_access_token()
        tracks = []

        if token:
            try:
                url = f"https://api.spotify.com/v1/playlists/{playlist_id}/tracks?limit={min(limit, 100)}"
                res = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=6, verify=False)
                if res.status_code == 200 and "application/json" in res.headers.get("Content-Type", ""):
                    items = res.json().get("items", [])
                    for idx, item in enumerate(items):
                        track = item.get("track")
                        if track and track.get("id"):
                            tracks.append(self._format_track(track, play_count_rank=idx + 1))
                    if tracks:
                        return tracks
            except Exception as e:
                logger.warning("Online playlist tracks fetch failed: %s, checking local cache", e)

        # Fallback: check spotifast cached playlist files
        base_dir = os.path.dirname(os.path.dirname(__file__))
        pattern = os.path.join(base_dir, "spotifast", "spotifast-data", "cache", "playlists", "*", f"{playlist_id}.rows.*")
        cached_row_files = glob.glob(pattern)
        for rf in cached_row_files:
            try:
                with open(rf, "r", encoding="utf-8") as f:
                    cdata = json.load(f)
                for idx, row in enumerate(cdata):
                    t = row.get("item") or row.get("track")
                    if t and t.get("id"):
                        tracks.append(self._format_track(t, play_count_rank=idx + 1))
                if tracks:
                    logger.info("Loaded %d tracks for playlist %s from local cache", len(tracks), playlist_id)
                    return tracks
            except Exception as e:
                logger.warning("Error reading cached rows %s: %s", rf, e)



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

    def _refresh_access_token(self) -> Optional[str]:
        if not self.refresh_token:
            return None
        try:
            res = requests.post(
                "https://accounts.spotify.com/api/token",
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": self.refresh_token,
                    "client_id": self.client_id,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=10
            )
            if res.status_code == 200:
                data = res.json()
                self.cached_token = data.get("access_token")
                if data.get("refresh_token"):
                    self.refresh_token = data.get("refresh_token")
                self.token_expiry = time.time() + data.get("expires_in", 3600) - 60
                self.save_session_cache()
                return self.cached_token
            else:
                logger.error("Failed to refresh token: %s %s", res.status_code, res.text)
                return None
        except Exception as e:
            logger.error("Exception refreshing token: %s", e)
            return None

    def start_oauth_flow(self) -> Dict[str, Any]:
        import base64
        import hashlib
        import urllib.parse
        from http.server import HTTPServer, BaseHTTPRequestHandler

        verifier = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b'=').decode()
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
        self.oauth_verifier = verifier

        redirect_uri = "http://127.0.0.1:8989/login"
        scopes = "user-read-private user-read-email user-top-read user-library-read playlist-read-private playlist-read-collaborative user-read-recently-played"
        
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "code_challenge_method": "S256",
            "code_challenge": challenge,
            "scope": scopes
        }
        auth_url = "https://accounts.spotify.com/authorize?" + urllib.parse.urlencode(params)

        manager = self
        class OAuthCallbackHandler(BaseHTTPRequestHandler):
            def log_message(self, format, *args):
                pass

            def do_GET(self):
                parsed = urllib.parse.urlparse(self.path)
                if parsed.path == "/login":
                    qs = urllib.parse.parse_qs(parsed.query)
                    code = qs.get("code", [None])[0]
                    if code:
                        token_res = requests.post(
                            "https://accounts.spotify.com/api/token",
                            data={
                                "grant_type": "authorization_code",
                                "code": code,
                                "redirect_uri": redirect_uri,
                                "client_id": manager.client_id,
                                "code_verifier": manager.oauth_verifier
                            },
                            headers={"Content-Type": "application/x-www-form-urlencoded"},
                            timeout=10
                        )
                        if token_res.status_code == 200:
                            t_data = token_res.json()
                            manager.cached_token = t_data.get("access_token")
                            manager.refresh_token = t_data.get("refresh_token")
                            manager.token_expiry = time.time() + t_data.get("expires_in", 3600) - 60
                            manager.is_connected = True
                            manager.save_session_cache()
                            manager._fetch_user_profile()
                            name = manager.user_profile.get("display_name") if manager.user_profile else "Spotify User"
                            manager.connection_status = f"Connected as {name}"
                            
                            html = """<!DOCTYPE html>
<html>
<head><title>Spotiless Connected</title></head>
<body style="background:#121314;color:#f0f2f5;font-family:sans-serif;text-align:center;padding:60px 20px;">
  <h1 style="color:#1db954;font-size:2rem;margin-bottom:12px;">Successfully Connected to Spotify!</h1>
  <p style="color:#8e969d;font-size:1.1rem;">You can close this tab and return to Spotiless.</p>
  <script>setTimeout(function() { window.close(); }, 1500);</script>
</body>
</html>"""
                            self.send_response(200)
                            self.send_header("Content-Type", "text/html; charset=utf-8")
                            self.end_headers()
                            self.wfile.write(html.encode("utf-8"))
                            threading.Thread(target=self.server.shutdown, daemon=True).start()
                            return

                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Spotify login failed or code missing.")

        if hasattr(self, "_oauth_httpd") and self._oauth_httpd:
            try:
                self._oauth_httpd.shutdown()
                self._oauth_httpd.server_close()
            except Exception:
                pass

        try:
            httpd = HTTPServer(("127.0.0.1", 8989), OAuthCallbackHandler)
            self._oauth_httpd = httpd
            threading.Thread(target=httpd.serve_forever, daemon=True).start()
            logger.info("OAuth redirect listener started on http://127.0.0.1:8989/login")
        except Exception as e:
            logger.warning("Could not bind 8989 for OAuth redirect: %s", e)

        return {"success": True, "auth_url": auth_url}

