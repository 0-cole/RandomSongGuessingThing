# Spotiless Context Summary (`spotiless_context.md`)

## 1. Executive Summary & High-Level Objective
- **Project**: Spotiless (Songless — Spotify Edition), a local web-based Spotify song-guessing game (`http://127.0.0.1:4321`) launched in an isolated app window via `launcher.py`.
- **Current Version**: `v1.1.0`
- **Core Capabilities**:
  - **Playlist & Combined Playlists Game Counter**: Real-time game progression tracking showing current song index, total songs in pool, percentage completion, and session win record across single playlists, multi-selected combined playlists, and difficulty modes.
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

## 3. Recent Modifications & Verified State (`v1.1.0`)
- [`backend/game_engine.py`](file:///C:/Users/cdbla/Documents/GitHub/Spotiless/backend/game_engine.py):
  - Added session tracking (`song_index`, `total_songs`, `session_won`, `session_played`, `cycle_count`, `is_final_song`, `playlist_completed`).
  - Added track pool deduplication by track ID in `load_pool()`.
  - Added playlist completion detection and automatic cycling counter.
  - Updated `generate_share_card()` to include song progress (`Song X/Y`).
- [`backend/app.py`](file:///C:/Users/cdbla/Documents/GitHub/Spotiless/backend/app.py):
  - Updated `/api/status` to expose active pool session progression (`song_index`, `session_won`, `session_played`, `cycle_count`).
  - Bumped version to `v1.1.0`.
- [`static/index.html`](file:///C:/Users/cdbla/Documents/GitHub/Spotiless/static/index.html) & [`static/style.css`](file:///C:/Users/cdbla/Documents/GitHub/Spotiless/static/style.css):
  - Added `#game-progress-card` above the player card featuring a game counter badge (`Song X of Y`), playlist source tag, session score pill (`X/Y won`), completion percentage, and animated gradient progress bar.
  - Added `#nav-counter-pill` inside `#btn-open-mode` in the top navbar.
  - Added `#reveal-progress-box` in `#modal-reveal` showing round-by-round progress, session score, and a celebratory completion banner on final playlist song.
- [`static/app.js`](file:///C:/Users/cdbla/Documents/GitHub/Spotiless/static/app.js):
  - Connected `applyGameState` and `refreshStatus` to dynamically update song counter, progress bar width, percentage, and session stats.
  - Configured reveal modal to display dynamic next song buttons (`Next Song (X / Y) →` or `Restart / Play Again ↺` when playlist finishes).

## 4. Immediate Next Steps
- Ready for gameplay across all user playlists, difficulty modes, and curated Spotify categories.
