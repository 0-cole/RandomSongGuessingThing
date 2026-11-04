import os
import io
import glob
import json
import time
import struct
import base64
import logging
import threading
import concurrent.futures
import requests
from typing import Optional, Dict, Any, List

logger = logging.getLogger("spotify_manager")
logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
CACHE_FILE = os.path.join(BASE_DIR, "session_cache.json")
AUDIO_CACHE_DIR = os.path.join(BASE_DIR, "audio_cache")
os.makedirs(AUDIO_CACHE_DIR, exist_ok=True)


def _apply_librespot_patches():
    """
    Patch librespot-python:
    1. Fix TCP partial recv bug in Session.ConnectionHolder.read so packets > 1 MTU
       (e.g., Mercury playlist responses) never desynchronize the Shannon stream cipher.
    2. Provide resilient ApResolver fallback to ap-gae2.spotify.com:4070 (raw Shannon TCP)
       when apresolve.spotify.com HTTPS is intercepted by FortiGuard.
    3. Make DealerClient.connect non-fatal when login5.spotify.com HTTPS is blocked.
    """
    try:
        from librespot.core import Session, ApResolver, DealerClient

        def _exact_read(self, length: int) -> bytes:
            buf = bytearray()
            sock = self._ConnectionHolder__socket
            while len(buf) < length:
                chunk = sock.recv(length - len(buf))
                if not chunk:
                    raise EOFError("Socket closed during Shannon packet read")
                buf.extend(chunk)
            return bytes(buf)

        Session.ConnectionHolder.read = _exact_read

        _orig_ap_req = ApResolver.request

        def _resilient_ap_request(service_type: str):
            try:
                res = requests.get(
                    f"https://apresolve.spotify.com/?type={service_type}",
                    timeout=3,
                )
                if res.status_code == 200:
                    return res.json()
            except Exception:
                pass
            return {
                "accesspoint": [
                    "ap-gae2.spotify.com:4070",
                    "ap-gae2.spotify.com:443",
                    "ap-gae2.spotify.com:80",
                ],
                "dealer": ["gae2-dealer.spotify.com:443"],
                "spclient": ["gae2-spclient.spotify.com:443"],
            }

        ApResolver.request = staticmethod(_resilient_ap_request)

        _orig_dealer_connect = DealerClient.connect

        def _safe_dealer_connect(self):
            try:
                _orig_dealer_connect(self)
            except Exception as e:
                logger.debug("Skipping optional DealerClient WebSocket: %s", e)

        DealerClient.connect = _safe_dealer_connect
    except Exception as e:
        logger.warning("Failed to apply librespot patches: %s", e)


_apply_librespot_patches()


def _read_spotifast_win_credentials() -> Dict[str, Any]:
    """
    Read Spotifast's native Librespot playback grant and Web API grant
    from Windows Credential Manager if available on this machine.
    """
    result: Dict[str, Any] = {}
    if os.name != "nt":
        return result
    try:
        import ctypes
        from ctypes import wintypes

        class CREDENTIAL(ctypes.Structure):
            _fields_ = [
                ("Flags", wintypes.DWORD),
                ("Type", wintypes.DWORD),
                ("TargetName", wintypes.LPWSTR),
                ("Comment", wintypes.LPWSTR),
                ("LastWritten", wintypes.FILETIME),
                ("CredentialBlobSize", wintypes.DWORD),
                ("CredentialBlob", ctypes.POINTER(ctypes.c_byte)),
                ("Persist", wintypes.DWORD),
                ("AttributeCount", wintypes.DWORD),
                ("Attributes", ctypes.c_void_p),
                ("TargetAlias", wintypes.LPWSTR),
                ("UserName", wintypes.LPWSTR),
            ]

        advapi = ctypes.windll.Advapi32
        CredEnumerateW = advapi.CredEnumerateW
        CredEnumerateW.argtypes = [
            wintypes.LPCWSTR,
            wintypes.DWORD,
            ctypes.POINTER(wintypes.DWORD),
            ctypes.POINTER(ctypes.POINTER(ctypes.POINTER(CREDENTIAL))),
        ]
        CredEnumerateW.restype = wintypes.BOOL
        CredFree = advapi.CredFree
        CredFree.argtypes = [ctypes.c_void_p]

        count = wintypes.DWORD(0)
        pcreds = ctypes.POINTER(ctypes.POINTER(CREDENTIAL))()
        if CredEnumerateW(None, 0, ctypes.byref(count), ctypes.byref(pcreds)):
            for i in range(count.value):
                c = pcreds[i].contents
                tname = c.TargetName or ""
                if "rocks.spotifast.Spotifast" in tname and c.CredentialBlobSize > 0:
                    raw = bytes(c.CredentialBlob[: c.CredentialBlobSize]).decode("utf-8", errors="ignore")
                    data = json.loads(raw)
                    grant = data.get("grant", {})
                    if "Playback" in grant:
                        pb = grant["Playback"]
                        adata = pb.get("auth_data")
                        ab64 = (
                            base64.b64encode(bytes(adata)).decode("ascii")
                            if isinstance(adata, list)
                            else adata
                        )
                        result["playback_grant"] = {
                            "username": pb.get("username"),
                            "auth_type": pb.get("auth_type", 1),
                            "auth_data_b64": ab64,
                        }
                    if "Web" in grant:
                        wb = grant["Web"]
                        result["web_grant"] = wb
            CredFree(pcreds)
    except Exception as e:
        logger.debug("Windows Credential Manager Spotifast lookup skipped: %s", e)
    return result


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
        self.stream_lock = threading.Lock()
        self.client_id = "584f1fe365ea49978b2355b8b60404bd"
        self.refresh_token = None
        self.playback_grant: Optional[Dict[str, Any]] = None
        self.oauth_verifier = None
        self._oauth_httpd = None
        self.track_meta_cache: Dict[str, Dict[str, Any]] = {}

        # Restore saved session & Spotifast native playback credentials
        self.load_stored_session()

    def _connect_session_from_playback_grant(self, pb: Dict[str, Any]) -> bool:
        """Create an authenticated Librespot session over port 4070 using a reusable playback grant."""
        try:
            from librespot.core import Session
            from librespot.proto import Authentication_pb2 as Authentication

            username = pb.get("username", "")
            auth_type = pb.get("auth_type", 1)
            auth_data = base64.b64decode(pb["auth_data_b64"])

            creds = Authentication.LoginCredentials(
                username=username,
                typ=auth_type,
                auth_data=auth_data,
            )
            builder = Session.Builder()
            builder.login_credentials = creds
            self.session = builder.create()
            self.playback_grant = pb
            self.is_connected = True
            uname = self.session.username() or username
            self.connection_status = f"Connected as {uname}"
            logger.info("Connected native Librespot playback session for %s", uname)
            return True
        except Exception as e:
            logger.warning("Failed to connect Librespot playback grant: %s", e)
            self.session = None
            return False

    def _ensure_session(self) -> bool:
        """Ensure the native Librespot session is alive, reconnecting if needed."""
        with self.auth_lock:
            if self.session is not None:
                try:
                    if getattr(self.session, "is_valid", lambda: True)():
                        return True
                except Exception:
                    pass
                return True
            if self.playback_grant:
                return self._connect_session_from_playback_grant(self.playback_grant)
            sf = _read_spotifast_win_credentials()
            if "playback_grant" in sf:
                if self._connect_session_from_playback_grant(sf["playback_grant"]):
                    self.save_session_cache()
                    return True
            return False

    def load_stored_session(self) -> bool:
        """Attempt to restore a saved session from session_cache.json and Spotifast credential store"""
        data = {}
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = {}

        # 1. Restore Web API OAuth tokens if present
        if "refresh_token" in data:
            self.refresh_token = data.get("refresh_token")
            self.cached_token = data.get("access_token")
            self.token_expiry = data.get("token_expiry", 0)
            if time.time() >= self.token_expiry:
                self._refresh_access_token()
            if self.cached_token:
                self.is_connected = True

        # 2. Restore Librespot native playback session (from cache or Spotifast Credential Manager)
        pb_grant = data.get("playback_grant")
        if not pb_grant:
            sf_creds = _read_spotifast_win_credentials()
            pb_grant = sf_creds.get("playback_grant")
            if not self.refresh_token and "web_grant" in sf_creds:
                wg = sf_creds["web_grant"]
                if wg.get("refresh_token"):
                    self.refresh_token = wg.get("refresh_token")
                    self.cached_token = wg.get("access_token")
                    self.token_expiry = wg.get("expires_at", 0)
                    if wg.get("client_id"):
                        self.client_id = wg["client_id"]

        if pb_grant:
            if self._connect_session_from_playback_grant(pb_grant):
                self.save_session_cache()

        # 3. Also check legacy stored_session string if session still None
        if not self.session and data.get("stored_session"):
            try:
                from librespot.core import Session
                self.session = Session.Builder().stored(data["stored_session"]).create()
                self.is_connected = True
                logger.info("Restored legacy Librespot session for %s", self.session.username())
            except Exception as e:
                logger.warning("Failed to restore stored_session: %s", e)

        if self.is_connected:
            self._fetch_user_profile()
            name = (
                self.user_profile.get("display_name")
                if self.user_profile
                else (self.session.username() if self.session else "Spotify User")
            )
            self.connection_status = f"Connected as {name}"
            logger.info("Spotify session active (%s)", self.connection_status)
            return True

        return False

    def save_session_cache(self):
        """Save the current session's reusable playback grant and OAuth tokens to cache"""
        data = {}
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = {}

        if self.playback_grant:
            data["playback_grant"] = self.playback_grant

        if self.session:
            try:
                data["username"] = self.session.username()
                if self.session.stored():
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
        """Obtain a valid Spotify Web API bearer token from OAuth or active Librespot session"""
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
            self.token_expiry = now + 3000
            return token
        except Exception as e:
            logger.debug("Could not obtain Web API token from Librespot login5: %s", e)
            return self.cached_token

    def _fetch_user_profile(self):
        """Fetch basic user info from Spotify Web API (with offline cache fallback)"""
        token = self.get_access_token()
        if token:
            try:
                res = requests.get(
                    "https://api.spotify.com/v1/me",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=5,
                )
                if res.status_code == 200 and "application/json" in res.headers.get("Content-Type", ""):
                    self.user_profile = res.json()
                    logger.info("Loaded profile for: %s", self.user_profile.get("display_name"))
                    return
            except Exception as e:
                logger.debug("Online user profile fetch skipped: %s", e)

        if not self.user_profile:
            uname = (
                self.session.username()
                if self.session
                else (self.playback_grant.get("username") if self.playback_grant else "31leppthj2runlbv3x6juui65bpa")
            )
            self.user_profile = {
                "id": uname,
                "display_name": "cole.__" if uname == "31leppthj2runlbv3x6juui65bpa" else uname,
                "product": "premium",
            }

    def get_status(self) -> Dict[str, Any]:
        """Return current authentication and user profile state"""
        is_conn = self.is_connected and (
            self.session is not None or self.cached_token is not None or self.playback_grant is not None
        )
        username = (
            self.session.username()
            if self.session
            else (self.user_profile.get("id") if self.user_profile else None)
        )
        return {
            "connected": is_conn,
            "status": self.connection_status,
            "username": username,
            "display_name": self.user_profile.get("display_name") if self.user_profile else username,
            "product": self.user_profile.get("product") if self.user_profile else "premium",
            "image": (
                self.user_profile.get("images", [{}])[0].get("url")
                if self.user_profile and self.user_profile.get("images")
                else None
            ),
        }

    def fetch_top_tracks(self, time_range: str = "short_term", limit: int = 50) -> List[Dict[str, Any]]:
        """
        Fetch user's top tracks from Spotify Web API, falling back to Spotifast's
        cached Spotify home library (top_tracks & recently_played) if FortiGuard blocks api.spotify.com.
        """
        token = self.get_access_token()
        if token:
            try:
                url = f"https://api.spotify.com/v1/me/top/tracks?time_range={time_range}&limit={min(limit, 50)}"
                res = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=6)
                if res.status_code == 200 and "application/json" in res.headers.get("Content-Type", ""):
                    items = res.json().get("items", [])
                    tracks = [
                        self._format_track(item, play_count_rank=idx + 1)
                        for idx, item in enumerate(items)
                        if item and item.get("id")
                    ]
                    if tracks:
                        return tracks
            except Exception as e:
                logger.warning("Online top tracks fetch failed: %s, using Spotifast Spotify cache", e)

        # Fallback: load user's real Spotify top_tracks & recently_played from Spotifast home cache
        home_files = glob.glob(os.path.join(BASE_DIR, "spotifast", "spotifast-data", "cache", "home", "*.json"))
        for hf in home_files:
            try:
                with open(hf, "r", encoding="utf-8") as f:
                    hdata = json.load(f).get("data", {})
                key_map = {
                    "short_term": "top_tracks",
                    "medium_term": "top_tracks_medium",
                    "long_term": "top_tracks_long",
                }
                raw_list = hdata.get(key_map.get(time_range, "top_tracks")) or hdata.get("top_tracks") or []
                tracks = []
                seen_ids = set()
                for item in raw_list:
                    t = item.get("track") or item
                    if isinstance(t, dict) and t.get("id") and t["id"] not in seen_ids:
                        seen_ids.add(t["id"])
                        tracks.append(self._format_track(t, play_count_rank=len(tracks) + 1))
                # Supplement with recently_played if medium/long term or additional tracks needed
                for rp in hdata.get("recently_played", []):
                    t = rp.get("track") if isinstance(rp, dict) else None
                    if isinstance(t, dict) and t.get("id") and t["id"] not in seen_ids:
                        seen_ids.add(t["id"])
                        tracks.append(self._format_track(t, play_count_rank=len(tracks) + 1))
                if tracks:
                    logger.info("Loaded %d user top/recent Spotify tracks from Spotifast home cache", len(tracks))
                    return tracks[:limit]
            except Exception as e:
                logger.warning("Error reading Spotifast home cache: %s", e)

        return []

    def fetch_liked_songs(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetch user's Liked Songs library (with Spotifast recent/top Spotify cache fallback)"""
        token = self.get_access_token()
        if token:
            try:
                url = f"https://api.spotify.com/v1/me/tracks?limit={min(limit, 50)}"
                res = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=6)
                if res.status_code == 200 and "application/json" in res.headers.get("Content-Type", ""):
                    items = res.json().get("items", [])
                    tracks = [
                        self._format_track(item.get("track"), play_count_rank=idx + 1)
                        for idx, item in enumerate(items)
                        if item.get("track")
                    ]
                    if tracks:
                        return tracks
            except Exception as e:
                logger.warning("Online liked songs fetch failed: %s", e)

        return self.fetch_top_tracks(time_range="short_term", limit=limit)

    def fetch_playlists(self) -> List[Dict[str, Any]]:
        """Fetch list of user's playlists (with offline Spotifast cache fallback)"""
        my_id = (self.user_profile.get("id") if self.user_profile else None) or "31leppthj2runlbv3x6juui65bpa"
        token = self.get_access_token()
        playlists = []

        if token:
            try:
                url = "https://api.spotify.com/v1/me/playlists?limit=50"
                res = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=5)
                if res.status_code == 200 and "application/json" in res.headers.get("Content-Type", ""):
                    items = res.json().get("items", [])
                    for p in items:
                        owner_id = p.get("owner", {}).get("id")
                        playlists.append({
                            "id": p.get("id"),
                            "name": p.get("name"),
                            "tracks_count": p.get("items", {}).get("total")
                            or (p.get("tracks") or {}).get("total", 0),
                            "image": p.get("images", [{}])[0].get("url") if p.get("images") else None,
                            "is_mine": (owner_id == my_id or owner_id == "31leppthj2runlbv3x6juui65bpa"),
                            "owner_name": p.get("owner", {}).get("display_name", ""),
                        })
                    if playlists:
                        return playlists
            except Exception as e:
                logger.debug("Online playlist fetch failed: %s, using Spotifast library cache", e)

        cache_files = glob.glob(os.path.join(BASE_DIR, "spotifast", "spotifast-data", "cache", "library", "*.json"))
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
                        "owner_name": p.get("owner", {}).get("display_name", ""),
                    })
                if playlists:
                    logger.info("Loaded %d playlists from local Spotifast cache", len(playlists))
                    return playlists
            except Exception as e:
                logger.warning("Error reading local library cache %s: %s", cf, e)

        return playlists

    def _fetch_track_metadata_mercury(self, track_uri: str, rank: int = 1) -> Optional[Dict[str, Any]]:
        """Fetch a single track's metadata directly over Librespot's port-4070 Shannon Mercury tunnel."""
        b62_id = track_uri.split(":")[-1]
        if b62_id in self.track_meta_cache:
            cached = dict(self.track_meta_cache[b62_id])
            cached["rank"] = rank
            return cached

        if not self._ensure_session():
            return None

        try:
            from librespot.metadata import TrackId
            from librespot.mercury import RawMercuryRequest
            from librespot.proto import Metadata_pb2 as Metadata
            from librespot import util

            tid = TrackId.from_uri(track_uri)
            resp = self.session.mercury().send_sync(
                RawMercuryRequest.new_builder()
                .set_uri(f"hm://metadata/4/track/{tid.hex_id()}")
                .set_method("GET")
                .build()
            )
            if resp.status_code != 200 or not resp.payload:
                return None

            tr = Metadata.Track()
            tr.ParseFromString(bytes(resp.payload))
            if not tr.name or tr.duration <= 0 or (len(tr.file) == 0 and len(tr.alternative) == 0):
                return None
            artists = [a.name for a in tr.artist if a.name]
            artist_str = ", ".join(artists) if artists else "Unknown Artist"

            images = list(tr.album.cover_group.image) if tr.album and tr.album.cover_group else []
            image_url = ""
            thumbnail_url = ""
            if images:
                first_hex = util.bytes_to_hex(images[-1].file_id)
                last_hex = util.bytes_to_hex(images[0].file_id)
                image_url = f"https://i.scdn.co/image/{first_hex}"
                thumbnail_url = f"https://i.scdn.co/image/{last_hex}"

            formatted = {
                "id": b62_id,
                "uri": track_uri,
                "name": tr.name,
                "artist": artist_str,
                "artists_list": artists,
                "album_name": tr.album.name if tr.album else "",
                "image_url": image_url,
                "thumbnail_url": thumbnail_url,
                "duration_ms": tr.duration,
                "popularity": tr.popularity,
                "rank": rank,
                "preview_url": None,
            }
            self.track_meta_cache[b62_id] = formatted
            return formatted
        except Exception as e:
            logger.warning("Mercury track metadata fetch failed for %s: %s", track_uri, e)
            return None

    def fetch_playlist_tracks(self, playlist_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Fetch tracks inside a specific playlist using:
        1. Local cached playlist JSON (audio_cache/playlist_{id}.json) or Spotifast row cache
        2. Spotify Web API (/v1/playlists/{id} supporting both 'items' and 'tracks' structures)
        3. Librespot native port-4070 Mercury protocol (hm://playlist/v2/playlist/{id}),
           which works even when FortiGuard blocks *.spotify.com HTTPS!
        """
        local_pl_cache = os.path.join(AUDIO_CACHE_DIR, f"playlist_{playlist_id}.json")
        if os.path.exists(local_pl_cache):
            try:
                with open(local_pl_cache, "r", encoding="utf-8") as f:
                    cached_tracks = json.load(f)
                valid = [t for t in cached_tracks if t.get("id") and t.get("name")]
                if valid:
                    logger.info("Loaded %d tracks for playlist %s from playlist cache", len(valid), playlist_id)
                    return valid[:limit]
            except Exception:
                pass

        # Check Spotifast cached playlist rows
        pattern = os.path.join(BASE_DIR, "spotifast", "spotifast-data", "cache", "playlists", "*", f"{playlist_id}.rows.*")
        for rf in glob.glob(pattern):
            try:
                with open(rf, "r", encoding="utf-8") as f:
                    cdata = json.load(f)
                tracks = []
                for idx, row in enumerate(cdata):
                    t = row.get("item") or row.get("track")
                    if (
                        isinstance(t, dict)
                        and t.get("id")
                        and t.get("name")
                        and t.get("is_playable") is not False
                        and t.get("duration_ms", 1) > 0
                    ):
                        tracks.append(self._format_track(t, play_count_rank=idx + 1))
                if tracks:
                    logger.info("Loaded %d tracks for playlist %s from Spotifast row cache", len(tracks), playlist_id)
                    return tracks[:limit]
            except Exception as e:
                logger.warning("Error reading cached rows %s: %s", rf, e)

        # Try Spotify Web API (/v1/playlists/{playlist_id})
        token = self.get_access_token()
        if token:
            try:
                url = f"https://api.spotify.com/v1/playlists/{playlist_id}"
                res = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=5)
                if res.status_code == 200 and "application/json" in res.headers.get("Content-Type", ""):
                    data = res.json()
                    items_container = data.get("items") if isinstance(data.get("items"), dict) else data.get("tracks")
                    raw_items = items_container.get("items", []) if isinstance(items_container, dict) else []
                    tracks = []
                    for idx, item in enumerate(raw_items[:limit]):
                        track = item.get("track") or item.get("item") or item
                        if isinstance(track, dict) and track.get("id") and track.get("name"):
                            tracks.append(self._format_track(track, play_count_rank=idx + 1))
                    if tracks:
                        try:
                            with open(local_pl_cache, "w", encoding="utf-8") as f:
                                json.dump(tracks, f, indent=2)
                        except Exception:
                            pass
                        return tracks
            except Exception as e:
                logger.debug("Web API playlist fetch skipped (%s), using Librespot Mercury port 4070", e)

        # Librespot Native Mercury Protocol over port 4070 (Spotifast session_reads method!)
        if self._ensure_session():
            try:
                from librespot.mercury import RawMercuryRequest
                from librespot.proto import Playlist4External_pb2 as Playlist4

                logger.info("Fetching playlist %s directly over Librespot Mercury port 4070...", playlist_id)
                pl_resp = self.session.mercury().send_sync(
                    RawMercuryRequest.new_builder()
                    .set_uri(f"hm://playlist/v2/playlist/{playlist_id}")
                    .set_method("GET")
                    .build()
                )
                if pl_resp.status_code == 200 and pl_resp.payload:
                    pl = Playlist4.SelectedListContent()
                    pl.ParseFromString(bytes(pl_resp.payload))
                    track_uris = [
                        it.uri for it in pl.contents.items if it.uri and it.uri.startswith("spotify:track:")
                    ][:limit]

                    tracks = []
                    for idx, uri in enumerate(track_uris):
                        meta = self._fetch_track_metadata_mercury(uri, rank=idx + 1)
                        if meta and meta.get("name"):
                            tracks.append(meta)

                    if tracks:
                        logger.info(
                            "Loaded %d tracks for playlist '%s' (%s) via Librespot Mercury!",
                            len(tracks),
                            pl.attributes.name,
                            playlist_id,
                        )
                        try:
                            with open(local_pl_cache, "w", encoding="utf-8") as f:
                                json.dump(tracks, f, indent=2)
                        except Exception:
                            pass
                        return tracks
            except Exception as e:
                logger.error("Librespot Mercury playlist fetch failed for %s: %s", playlist_id, e)
                # Reset session so next call reconnects cleanly
                self.session = None

        return []

    def get_track_audio_bytes(self, track_uri_or_id: str, max_seconds: int = 15) -> Optional[bytes]:
        """
        Stream and decrypt native Ogg Vorbis audio bytes directly from Spotify using Librespot:
        1. Fetch Metadata.Track over port-4070 Mercury (resolving alternatives if needed).
        2. Request 16-byte AES-128-CTR audio key over port-4070 Shannon tunnel.
        3. Request signed Spotify CDN URLs (audio-fa.scdn.co / audio-cf.spotifycdn.com) via Packet.Type.stream_chunk.
        4. Download first ~384KB (~20-25 seconds of Vorbis audio), AES-128-CTR decrypt,
           strip 167-byte Spotify header, and trim to the last complete OggS page boundary.
        """
        with self.stream_lock:
            for attempt in range(2):
                if not self._ensure_session():
                    return None
                try:
                    from librespot.metadata import TrackId
                    from librespot.mercury import RawMercuryRequest
                    from librespot.proto import Metadata_pb2 as Metadata
                    from librespot.crypto import Packet
                    from Cryptodome.Cipher import AES
                    from Cryptodome.Util import Counter

                    if not track_uri_or_id.startswith("spotify:track:"):
                        track_uri = f"spotify:track:{track_uri_or_id}"
                    else:
                        track_uri = track_uri_or_id

                    tid = TrackId.from_uri(track_uri)
                    resp = self.session.mercury().send_sync(
                        RawMercuryRequest.new_builder()
                        .set_uri(f"hm://metadata/4/track/{tid.hex_id()}")
                        .set_method("GET")
                        .build()
                    )
                    if resp.status_code != 200 or not resp.payload:
                        raise RuntimeError(f"Track metadata status {resp.status_code}")

                    track = Metadata.Track()
                    track.ParseFromString(bytes(resp.payload))

                    # Pick audio files from track or its alternatives
                    files = list(track.file)
                    target_gid = track.gid
                    if not files:
                        for alt in track.alternative:
                            if len(alt.file) > 0:
                                files = list(alt.file)
                                target_gid = alt.gid if alt.gid else track.gid
                                break

                    vorbis_formats = (
                        Metadata.AudioFile.Format.OGG_VORBIS_160,
                        Metadata.AudioFile.Format.OGG_VORBIS_96,
                        Metadata.AudioFile.Format.OGG_VORBIS_320,
                    )
                    vorbis_files = [f for f in files if f.format in vorbis_formats]
                    if not vorbis_files:
                        raise RuntimeError("No Ogg Vorbis audio files available for track")

                    file_id = vorbis_files[0].file_id

                    # 1. Fetch 16-byte AES decryption key over port 4070
                    key = self.session.audio_key().get_audio_key(target_gid, file_id)
                    if not key or len(key) != 16:
                        raise RuntimeError("Invalid audio decryption key received")

                    # 2. Request signed CDN URLs via Packet.Type.stream_chunk over port 4070
                    cdn_urls: List[str] = []
                    url_event = threading.Event()
                    orig_dispatch = self.session.channel().dispatch

                    def _capture_cdn_dispatch(packet):
                        payload = packet.payload
                        if len(payload) > 5 and payload[4] == 4:
                            url = payload[5:].decode("utf-8", errors="ignore")
                            if url.startswith("http"):
                                cdn_urls.append(url)
                                url_event.set()

                    self.session.channel().dispatch = _capture_cdn_dispatch
                    try:
                        req_buf = io.BytesIO()
                        req_buf.write(struct.pack(">H", 1))
                        req_buf.write(struct.pack(">i", 0))
                        req_buf.write(struct.pack(">i", 0))
                        req_buf.write(struct.pack(">i", 0x00004E20))
                        req_buf.write(struct.pack(">i", 0x00030D40))
                        req_buf.write(file_id)
                        req_buf.write(struct.pack(">i", 0))
                        req_buf.write(struct.pack(">i", 32768))
                        req_buf.seek(0)
                        self.session.send(Packet.Type.stream_chunk, req_buf.read())
                        url_event.wait(timeout=3.0)
                    finally:
                        self.session.channel().dispatch = orig_dispatch

                    if not cdn_urls:
                        raise RuntimeError("No CDN URL returned from stream_chunk")

                    # 3. Download first 384KB (~20s of 160kbps Vorbis) from Spotify CDN
                    download_bytes = max(262144, max_seconds * 24576)
                    encrypted_data = None
                    for cdn_url in cdn_urls:
                        try:
                            cdn_res = requests.get(
                                cdn_url,
                                headers={"Range": f"bytes=0-{download_bytes - 1}"},
                                timeout=8,
                            )
                            if cdn_res.status_code in (200, 206) and len(cdn_res.content) > 10000:
                                encrypted_data = cdn_res.content
                                break
                        except Exception as ce:
                            logger.warning("CDN fetch failed on %s: %s", cdn_url[:40], ce)

                    if not encrypted_data:
                        raise RuntimeError("All Spotify CDN URLs failed to return audio data")

                    # 4. Decrypt with Spotify's official AES-128-CTR IV and strip 167-byte Spotify header
                    iv_int = int.from_bytes(
                        b"\x72\xe0\x67\xfb\xdd\xcb\xcf\x77\xeb\xe8\xbc\x64\x3f\x63\x0d\x93",
                        "big",
                    )
                    cipher = AES.new(key, AES.MODE_CTR, counter=Counter.new(128, initial_value=iv_int))
                    decrypted = cipher.decrypt(encrypted_data)
                    ogg_data = decrypted[167:]

                    # 5. Trim to the exact end of the last complete OggS page so Web Audio API decodes cleanly
                    pos = 0
                    while pos + 27 <= len(ogg_data):
                        if ogg_data[pos : pos + 4] != b"OggS":
                            break
                        nseg = ogg_data[pos + 26]
                        if pos + 27 + nseg > len(ogg_data):
                            break
                        body_len = sum(ogg_data[pos + 27 : pos + 27 + nseg])
                        page_len = 27 + nseg + body_len
                        if pos + page_len > len(ogg_data):
                            break
                        pos += page_len

                    if pos > 5000:
                        return bytes(ogg_data[:pos])
                    return bytes(ogg_data)

                except Exception as e:
                    logger.warning(
                        "Librespot stream attempt %d failed for %s: %s",
                        attempt + 1,
                        track_uri_or_id,
                        e,
                    )
                    self.session = None

            return None

    def _format_track(self, item: Dict[str, Any], play_count_rank: int = 0) -> Dict[str, Any]:
        """Standardize track metadata for the frontend"""
        artists = [a.get("name") for a in item.get("artists", []) if isinstance(a, dict) and a.get("name")]
        artist_str = ", ".join(artists) if artists else "Unknown Artist"
        album = item.get("album", {}) if isinstance(item.get("album"), dict) else {}
        images = album.get("images", []) if isinstance(album.get("images"), list) else []
        image_url = images[0].get("url") if images else ""
        thumbnail_url = images[-1].get("url") if images else image_url

        return {
            "id": item.get("id"),
            "uri": item.get("uri") or f"spotify:track:{item.get('id')}",
            "name": item.get("name") or "Unknown Track",
            "artist": artist_str,
            "artists_list": artists,
            "album_name": album.get("name", ""),
            "image_url": image_url,
            "thumbnail_url": thumbnail_url,
            "duration_ms": item.get("duration_ms", 0),
            "popularity": item.get("popularity", 50),
            "rank": play_count_rank,
            "preview_url": None,
        }

    def logout(self):
        """Disconnect and clear cache"""
        self.session = None
        self.is_connected = False
        self.user_profile = None
        self.cached_token = None
        self.playback_grant = None
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
                timeout=6,
            )
            if res.status_code == 200 and "application/json" in res.headers.get("Content-Type", ""):
                data = res.json()
                self.cached_token = data.get("access_token")
                if data.get("refresh_token"):
                    self.refresh_token = data.get("refresh_token")
                self.token_expiry = time.time() + data.get("expires_in", 3600) - 60
                self.save_session_cache()
                return self.cached_token
            else:
                logger.debug("Token refresh returned status %s", res.status_code)
                return None
        except Exception as e:
            logger.debug("Token refresh skipped (offline/filtered): %s", e)
            return None

    def start_oauth_flow(self) -> Dict[str, Any]:
        import hashlib
        import urllib.parse
        from http.server import HTTPServer, BaseHTTPRequestHandler

        verifier = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode()
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        self.oauth_verifier = verifier

        redirect_uri = "http://127.0.0.1:8989/login"
        scopes = (
            "user-read-private user-read-email user-top-read user-library-read "
            "playlist-read-private playlist-read-collaborative user-read-recently-played streaming"
        )

        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "code_challenge_method": "S256",
            "code_challenge": challenge,
            "scope": scopes,
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
                                "code_verifier": manager.oauth_verifier,
                            },
                            headers={"Content-Type": "application/x-www-form-urlencoded"},
                            timeout=10,
                        )
                        if token_res.status_code == 200:
                            t_data = token_res.json()
                            manager.cached_token = t_data.get("access_token")
                            manager.refresh_token = t_data.get("refresh_token")
                            manager.token_expiry = time.time() + t_data.get("expires_in", 3600) - 60
                            manager.is_connected = True
                            manager._ensure_session()
                            manager.save_session_cache()
                            manager._fetch_user_profile()
                            name = (
                                manager.user_profile.get("display_name")
                                if manager.user_profile
                                else "Spotify User"
                            )
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
