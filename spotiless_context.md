# Spotiless Context Summary (`spotiless_context.md`)

## 1. Executive Summary & High-Level Objective
- **Project**: Spotiless (Songless — Spotify Edition), an endless music guessing game inspired by *Songless* (Lessgames) with microsecond-accurate snippet intervals (0.1s → 0.25s → 0.5s → 1.0s → 2.0s → 5.0s).
- **Current Version**: `v1.2.2`
- **Official Branding**: **Spotiless** (standardized without hyphens).
- **Dual Architecture**:
  1. **Desktop Native Mode (`launcher.py` / `127.0.0.1:4321`)**: 100% Native Spotify Shannon cipher streaming over TCP port 4070 (`ap-gae2.spotify.com:4070`) using cached Librespot playback tokens and personal Spotify user libraries.
  2. **Cloud Standalone Mode (`vercel.json` / `spotiless.vercel.app`)**: 100% decoupled client-side web mode. Users can play independently on mobile or desktop without a local Python daemon or sharing personal Spotify accounts. Audio snippets stream via public Apple/iTunes preview CDNs decoded with sample accuracy by the Web Audio API.

## 2. Critical Architecture & Invariants
- **Multi-User Privacy Isolation**: In cloud mode, no user touches another player's Spotify account. All streaks, win rates, theme preferences, and OAuth tokens are stored strictly inside the player's private browser `localStorage`.
- **20-Point Legal Protection Checklist (In Compliance with App Store / Fair Use Guidelines)**:
  - 100% Client-Side Privacy Policy & zero-server-tracking architecture.
  - Non-commercial Fair Use disclaimer for educational/trivia commentary.
  - Zero Cookie Policy & Zero Tracking SDKs (no Meta Pixel or Google Analytics).
  - No Hidden Fees, Free Forever disclaimer (no refunds applicable).
  - COPPA Notice: Does not knowingly collect data from children under 13.
  - Right to Erasure / GDPR Compliance: One-click "Delete All Local Data & Reset App" button (`#btn-wipe-data`).
  - High-contrast accessible UI across Light and Dark themes.
  - Keyboard navigation (Spacebar plays snippet, Enter submits guess / advances round, Esc closes modals).
- **Mobile Responsive Layout**: Responsive `@media (max-width: 600px)` query adapting to iPhone/Android screen dimensions with compact 2-row navbar, 54px play button, 38px guess rows, and iOS safe-area insets.

## 3. Recent Modifications & Verified State (`v1.2.2`)
- [`backend/app.py`](file:///d:/DOWNLOAD/RandomSongGuessingThing/backend/app.py):
  - Bumped version to `v1.2.2`.
- [`vercel.json`](file:///d:/DOWNLOAD/RandomSongGuessingThing/vercel.json):
  - Configured static output directory (`"outputDirectory": "static"`) and SPA rewrite rules for seamless deployment on Vercel.
- [`static/cloud_tracks.json`](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/cloud_tracks.json):
  - Curated catalogue of top hits across genres for instant, zero-login standalone cloud gameplay.
- [`static/audio_player.js`](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/audio_player.js):
  - Enhanced `MicroAudioEngine.loadTrack` to support public Apple/iTunes audio fallback when running decoupled from the desktop Librespot daemon.
- [`static/app.js`](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/app.js):
  - Integrated `CloudGameManager` for automatic client-side gameplay when `/api/status` is not reached.
  - Wired up Privacy & Terms modal (`#btn-open-privacy`) and data deletion wipe (`#btn-wipe-data`).
- [`static/index.html`](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/index.html):
  - Added Privacy, Terms, Cookie, Fee, COPPA, and Data Erasure modal (`#modal-privacy`).
  - Added centered footer footnote with legal link.
  - Bumped stylesheet and script asset query strings to `?v=1.2.2`.
- [`static/style.css`](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/style.css):
  - Added styles for `.page-footnote`, `.footer-legal-link`, `.modal-wide`, `.modal-body-scroll`, `.legal-section`, and `.btn-danger`.
  - Added complete mobile responsive rules.

## 4. Next Deployment Steps
- Push changes to GitHub repository (`origin main`).
- Deploy on Vercel via GitHub import (select `static` or standard preset).
