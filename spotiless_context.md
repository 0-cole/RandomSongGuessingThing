# Spotiless Context Summary (`spotiless_context.md`)

## 1. Executive Summary & High-Level Objective
- **Project**: Spotiless (Songless — Spotify Edition), an endless music guessing game inspired by *Songless* (Lessgames) with microsecond-accurate snippet intervals (0.1s → 0.25s → 0.5s → 1.0s → 2.0s → 5.0s).
- **Current Version**: `v1.2.7`
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
  - Clean unified link in page footer (`#btn-open-privacy`) and top navigation shield button (`#btn-nav-privacy`).

## 3. Recent Modifications & Verified State (`v1.2.7`)
- [`backend/app.py`](file:///d:/DOWNLOAD/RandomSongGuessingThing/backend/app.py): Bumped version to `v1.2.7`.
- [`static/style.css`](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/style.css):
  - Fixed root cause of unclickable Privacy & Terms link: removed legacy `pointer-events: none;` and `user-select: none;` on `.page-footnote`.
  - Restored normal semi-transparent backdrop (`var(--modal-backdrop)`) with blur on `#modal-privacy` so it doesn't appear pitch black.
- [`static/index.html`](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/index.html):
  - Removed duplicate button in action dock footer; retained single unified link in page footer and top navbar.
  - Fixed global `openPrivacyModal(e)` and `closePrivacyModal(e)` with event handling (`stopPropagation`).
  - Bumped asset query strings to `?v=1.2.7`.
- [`static/app.js`](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/app.js):
  - Moved `setupEventListeners()`, `initTheme()`, and `checkAccountState()` to execute synchronously on turn 0 without blocking behind `async init()`.
  - Added Escape key handler for `#modal-privacy`.
