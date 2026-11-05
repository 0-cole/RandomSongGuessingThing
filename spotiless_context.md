# Spotiless Context Summary (`spotiless_context.md`)

## 1. Executive Summary & High-Level Objective
- **Project**: Spotiless (Songless — Spotify Edition), a local web-based Spotify song-guessing game (`http://127.0.0.1:4321`) launched in an isolated app window via `launcher.py`.
- **Current Version**: `v1.0.9`
- **Core Capabilities**:
  - **100% Native Spotify Audio & Catalogue (Zero iTunes)**: Uses Spotify's native Librespot protocol over TCP port 4070 (`ap-gae2.spotify.com:4070`) + AES-128-CTR decryption from Spotify's official audio CDNs (`audio-fa.scdn.co`, `audio-cf.spotifycdn.com`) trimmed to exact `OggS` page boundaries.
  - **FortiGuard / School Wi-Fi Resilience**: Because port 4070 uses raw Shannon stream cipher TCP (no TLS SNI) and audio/images come from `scdn.co` / `spotifycdn.com`, playlist fetching (`hm://playlist/v2/playlist/{id}`), track metadata (`hm://metadata/4/track/{hex_id}`), and encrypted audio streaming work even when `*.spotify.com` HTTPS is blocked by FortiGuard.
  - **Credential Integration**: Automatically imports the user's reusable Librespot playback grant (`playback.rocks.spotifast.Spotifast`) and Web API grant from Windows Credential Manager into `session_cache.json`, and supports 1-click browser OAuth PKCE on `http://127.0.0.1:8989/login`.

## 2. Critical Architecture & Invariants
- **No iTunes Fallback**: Audio resolution in `backend/audio_resolver.py` and `backend/spotify_manager.py` must strictly use Spotify's native Librespot stream (`get_track_audio_bytes`) and local `.ogg` cache (`audio_cache/`).
- **Librespot Core Patches (`_apply_librespot_patches` in `backend/spotify_manager.py`)**:
  - `Session.ConnectionHolder.read` must loop until all `length` bytes are read from the TCP socket so multi-MTU packets never desynchronize the Shannon stream cipher.
  - `ApResolver.request` falls back to `ap-gae2.spotify.com:4070` when `apresolve.spotify.com` HTTPS is intercepted.
  - `DealerClient.connect` is non-fatal when `login5.spotify.com` HTTPS is blocked.
- **Strict Playlist Pool Isolation & Multi-Playlist Combination**: Selecting one or multiple playlists (`playlist_ids`) loads and deduplicates only tracks belonging to the chosen playlist(s) (`fetch_playlist_tracks`), filtering out delisted/unplayable 0-duration tracks.

## 3. Recent Modifications & Verified State (`v1.0.9`)
- [`backend/audio_resolver.py`](file:///C:/Users/cdbla/Documents/GitHub/Spotiless/backend/audio_resolver.py): Removed all iTunes Search API fallback logic and `.m4a` files; streams 100% native Spotify Ogg Vorbis (`audio/ogg`).
- [`backend/spotify_manager.py`](file:///C:/Users/cdbla/Documents/GitHub/Spotiless/backend/spotify_manager.py):
  - Added `_apply_librespot_patches()` fixing `librespot-python`'s partial TCP `recv` Shannon bug.
  - Added `_read_spotifast_win_credentials()` to automatically load Spotifast's reusable Librespot playback credential.
  - Added receiver thread liveness check in `_ensure_session()` (`_Session__receiver._Receiver__thread.is_alive()`) so sessions dropped after laptop sleep automatically reconnect.
  - Updated `start_oauth_flow()` to auto-restore from Spotifast's Windows Credential Manager (`already_connected: True`) or launch the system browser directly via `webbrowser.open`.
  - Implemented port-4070 Mercury playlist & track metadata resolution (`hm://playlist/v2/playlist/{id}` and `hm://metadata/4/track/{hex_id}`).
  - Implemented direct port-4070 `Packet.Type.stream_chunk` CDN resolution + AES-128-CTR decryption + 167-byte Spotify header stripping + exact `OggS` page boundary trimming in `get_track_audio_bytes()`.
- [`backend/game_engine.py`](file:///C:/Users/cdbla/Documents/GitHub/Spotiless/backend/game_engine.py): Updated `DEMO_TRACKS` to use native Spotify track IDs and `i.scdn.co` artwork.
- [`static/app.js`](file:///C:/Users/cdbla/Documents/GitHub/Spotiless/static/app.js): Added auto-skip (`startNewRound()`) if a track fails to decode, and updated `btnOAuthLogin` / `openAuthModal` to handle instant credential reconnection (`already_connected`).

## 4. Immediate Next Steps
- Ready for gameplay across all user playlists, difficulty modes, and curated Spotify categories.
