import os
import requests
import logging
from typing import Optional, Dict

logger = logging.getLogger("audio_resolver")

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "audio_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

class AudioResolver:
    def __init__(self, spotify_manager):
        self.spotify_mgr = spotify_manager
        self.memory_cache: Dict[str, bytes] = {}

    def get_audio(self, track: dict) -> Optional[tuple[bytes, str]]:
        """
        Returns (audio_bytes, mime_type) for the given track dict.
        Tries:
        1. Local memory / disk cache
        2. Librespot Spotify stream (decrypted direct from Spotify)
        3. Spotify official preview_url (if present)
        4. iTunes Search API (free public 30s preview fallback)
        """
        track_id = track.get("id", "")
        track_uri = track.get("uri", f"spotify:track:{track_id}")
        cache_file = os.path.join(CACHE_DIR, f"{track_id}.ogg")
        cache_fallback = os.path.join(CACHE_DIR, f"{track_id}.m4a")

        # 1. Check in-memory cache
        if track_id in self.memory_cache:
            return self.memory_cache[track_id], "audio/ogg"

        # Check disk cache
        if os.path.exists(cache_file):
            try:
                with open(cache_file, "rb") as f:
                    data = f.read()
                    self.memory_cache[track_id] = data
                    return data, "audio/ogg"
            except Exception as e:
                logger.warning("Failed reading cached audio file: %s", e)

        if os.path.exists(cache_fallback):
            try:
                with open(cache_fallback, "rb") as f:
                    data = f.read()
                    return data, "audio/mp4"
            except Exception:
                pass

        # 2. Try Librespot native stream (Spotifast method)
        if self.spotify_mgr and self.spotify_mgr.is_connected:
            try:
                logger.info("Fetching native audio from Spotify for %s - %s...", track.get("name"), track.get("artist"))
                raw_bytes = self.spotify_mgr.get_track_audio_bytes(track_uri, max_seconds=12)
                if raw_bytes and len(raw_bytes) > 5000:
                    self.memory_cache[track_id] = raw_bytes
                    try:
                        with open(cache_file, "wb") as f:
                            f.write(raw_bytes)
                    except Exception:
                        pass
                    return raw_bytes, "audio/ogg"
            except Exception as e:
                logger.warning("Librespot audio fetch failed, falling back: %s", e)

        # 3. Try Spotify preview_url if present
        if track.get("preview_url"):
            try:
                res = requests.get(track["preview_url"], timeout=8)
                if res.status_code == 200:
                    return res.content, "audio/mpeg"
            except Exception:
                pass

        # 4. Fallback: iTunes Search API (for guest mode or edge cases)
        try:
            name = track.get("name", "")
            artist = track.get("artist", "")
            queries = [
                f"{artist} {name}".strip(),
                f"{name} {artist}".strip(),
                name.strip()
            ]

            for q in queries:
                if not q:
                    continue
                logger.info("Resolving preview fallback via iTunes for '%s'...", q)
                res = requests.get(
                    "https://itunes.apple.com/search",
                    params={"term": q, "entity": "song", "limit": 3},
                    timeout=6
                )
                if res.status_code == 200:
                    results = res.json().get("results", [])
                    for r in results:
                        if r.get("previewUrl"):
                            audio_url = r["previewUrl"]
                            audio_res = requests.get(audio_url, timeout=8)
                            if audio_res.status_code == 200 and len(audio_res.content) > 1000:
                                try:
                                    with open(cache_fallback, "wb") as f:
                                        f.write(audio_res.content)
                                except Exception:
                                    pass
                                self.memory_cache[track_id] = audio_res.content
                                return audio_res.content, "audio/mp4"
        except Exception as e:
            logger.warning("iTunes fallback failed for %s: %s", track.get("name"), e)

        return None
