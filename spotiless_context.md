# Spotiless Context Summary (`spotiless_context.md`)

## 1. Executive Summary & High-Level Objective
- **Project**: Spotiless (Songless — Spotify Edition), a local web-based Spotify song-guessing game (`http://127.0.0.1:4321`) launched in an isolated app window via `launcher.py`.
- **Current Version**: `v1.2.0`
- **Core Capabilities**:
  - **Centered Symmetrical Layout**: Full viewport centering (`body { width: 100%; display: flex; flex-direction: column; align-items: center; }` and `.app-layout { margin: 0 auto; width: 100%; max-width: 690px; }`), with a 3-column grid navbar (`1fr auto 1fr`) keeping the title and all elements mathematically centered.
  - **Light & Dark Mode**: Seamless toggle button (`#btn-theme-toggle`) in the top navbar with instant inline local storage initialization, CSS theme variables, adaptive cards, waveform, and buttons.
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

## 3. Recent Modifications & Verified State (`v1.2.0`)
- [`backend/app.py`](file:///c:/Users/cdbla/Documents/GitHub/Spotiless/backend/app.py):
  - Bumped version to `v1.2.0` to trigger automatic live reload in active client sessions.
- [`static/index.html`](file:///c:/Users/cdbla/Documents/GitHub/Spotiless/static/index.html):
  - Added flash-free `<script>` in `<head>` and `<body>` checking `localStorage.getItem("spotiless_theme")`.
  - Added `#btn-theme-toggle` in the top navbar containing animated SVG sun and moon icons.
  - Replaced isolated corner disclaimer with `.page-footnote` centered beneath the dock inside `.app-layout`.
  - Bumped stylesheet and script assets to `v=1.2.0`.
- [`static/style.css`](file:///c:/Users/cdbla/Documents/GitHub/Spotiless/static/style.css):
  - Added responsive centering architecture on `html`, `body` (`flex-direction: column; align-items: center`), and `.app-layout` (`margin: 0 auto; max-width: 690px`).
  - Added 3-column grid navbar (`grid-template-columns: 1fr auto 1fr`) ensuring `SPOTI-LESS` logo is always placed at the 50% midpoint.
  - Implemented complete `body.light-theme` palette variables and component overrides (clean card surfaces, high-contrast readable typography, subtle borders, adapted play controls, and toasts).
  - Replaced hardcoded `rgba(255, 255, 255, ...)` with CSS custom properties (`--modal-backdrop`, `--visualizer-bg`, `--border-color`, `--bg-tile`).
- [`static/app.js`](file:///c:/Users/cdbla/Documents/GitHub/Spotiless/static/app.js):
  - Added `initTheme()`, `applyTheme()`, and `toggleTheme()` functions with persistent state in `localStorage` under `spotiless_theme`.
  - Attached event listener to `#btn-theme-toggle`.

## 4. Immediate Next Steps
- Ready for full centered gameplay in both Dark and Light modes across all playlists and window dimensions.
