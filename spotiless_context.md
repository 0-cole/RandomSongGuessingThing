# Spotiless Context Summary (`spotiless_context.md`)

## 1. Executive Summary & High-Level Objective
- **Project**: Spotiless (Songless — Spotify Edition), an endless music guessing game inspired by *Songless* (Lessgames) with microsecond-accurate snippet intervals (0.1s → 0.25s → 0.5s → 1.0s → 2.0s → 5.0s).
- **Current Version**: `v1.2.4`
- **Official Branding**: **Spoti-Less** in-app / **Spotiless** for domain and repository links.
- **Dual Architecture**:
  1. **Desktop Native Mode (`launcher.py` / `127.0.0.1:4321`)**: 100% Native Spotify Shannon cipher streaming over TCP port 4070 (`ap-gae2.spotify.com:4070`) using cached Librespot playback tokens and personal Spotify user libraries.
  2. **Cloud Standalone Mode (`vercel.json` / `spotiless.vercel.app`)**: 100% decoupled client-side web mode. Users can play independently on mobile or desktop without a local Python daemon or sharing personal Spotify accounts. Audio snippets stream via public Apple/iTunes preview CDNs decoded with sample accuracy by the Web Audio API.

## 2. Critical Architecture & Invariants
- **Multi-User Privacy Isolation**: In cloud mode, no user touches another player's Spotify account. All streaks, win rates, theme preferences, and OAuth tokens are stored strictly inside the player's private browser `localStorage`.
- **First-Visit Onboarding & Account System**:
  - Automatically prompts new visitors with options to Create a Permanent Account or Link via Spotify Cookie (`sp_dc`) or Play Free as Guest.
  - Safe inline trigger on `#btn-open-auth` so tapping "Connect Spotify" opens the modal reliably across all mobile browsers.
  - 1-tap browser reset hook via `?reset=1` wiping all cached tokens and stale local storage in mobile Safari/Chrome.
- **20-Point Legal Protection Checklist**:
  - Privacy policy, Fair Use terms, zero-cookie policy, COPPA under-13 notice, 1-click Right to Erasure (`#btn-wipe-data`).
  - High-contrast responsive mobile layout with safe-area insets.

## 3. Recent Modifications & Verified State (`v1.2.4`)
- [`backend/app.py`](file:///d:/DOWNLOAD/RandomSongGuessingThing/backend/app.py): Bumped version to `v1.2.4`.
- [`static/index.html`](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/index.html):
  - Added cache-busting meta tags (`no-cache`, `no-store`).
  - Added 1-tap auto-reset URL listener in `<head>` (`?reset=1`).
  - Added direct inline `onclick` handler to `#btn-open-auth`.
  - Bumped asset version query strings to `?v=1.2.4`.
- [`static/app.js`](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/app.js):
  - Fixed audio recursion loop in `applyGameState`.
  - Added account creation / sign-in state management.
  - Added Spotify `sp_dc` cookie linking and guest session management.
