import os
import glob
import logging
from typing import Optional, Dict

logger = logging.getLogger("audio_resolver")

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "audio_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

# Clean up any legacy iTunes .m4a files so audio comes 100% from Spotify
for _m4a in glob.glob(os.path.join(CACHE_DIR, "*.m4a")):
    try:
        os.remove(_m4a)
    except Exception:
        pass


class AudioResolver:
    def __init__(self, spotify_manager):
        self.spotify_mgr = spotify_manager
        self.memory_cache: Dict[str, bytes] = {}

    def get_audio(self, track: dict) -> Optional[tuple[bytes, str]]:
        """
        Returns (audio_bytes, mime_type) for the given track dict.
        100% Spotify Native (Spotifast / Librespot method):
        1. Local memory / disk cache (.ogg decrypted from Spotify CDN)
        2. Direct Librespot Spotify stream (Shannon port 4070 + AES-128-CTR Spotify CDN)
        """
        track_id = track.get("id", "")
        if not track_id:
            return None
        track_uri = track.get("uri") or f"spotify:track:{track_id}"
        cache_file = os.path.join(CACHE_DIR, f"{track_id}.ogg")

        # 1. Check in-memory cache
        if track_id in self.memory_cache:
            return self.memory_cache[track_id], "audio/ogg"

        # Check disk cache (.ogg)
        if os.path.exists(cache_file):
            try:
                with open(cache_file, "rb") as f:
                    data = f.read()
                if len(data) > 5000 and data[:4] == b"OggS":
                    self.memory_cache[track_id] = data
                    return data, "audio/ogg"
            except Exception as e:
                logger.warning("Failed reading cached audio file: %s", e)

        # 2. Stream decrypted native Vorbis audio directly from Spotify via Librespot
        if self.spotify_mgr:
            try:
                logger.info(
                    "Streaming native Spotify audio via Librespot for %s - %s (%s)...",
                    track.get("name"),
                    track.get("artist"),
                    track_id,
                )
                raw_bytes = self.spotify_mgr.get_track_audio_bytes(track_uri, max_seconds=15)
                if raw_bytes and len(raw_bytes) > 5000:
                    self.memory_cache[track_id] = raw_bytes
                    try:
                        with open(cache_file, "wb") as f:
                            f.write(raw_bytes)
                    except Exception:
                        pass
                    return raw_bytes, "audio/ogg"
            except Exception as e:
                logger.error("Librespot native audio fetch failed for %s: %s", track_id, e)

        return None
