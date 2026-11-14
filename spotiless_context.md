# Spotiless Context Summary (`spotiless_context.md`)

> [!CAUTION]
> ## MANDATORY AGENT EXECUTION RULES (PREFLIGHT GATE)
> If you are an AI agent reading this context summary, you MUST immediately bind execution to the following constraints:
> 1. **Tool Call #1 Mandatory**: Your first tool call in ANY session MUST be reading this file (`spotiless_context.md`). You are STRICTLY FORBIDDEN from reading application code files on Turn 1 before context.
> 2. **Universal 2-Read Cap Across ALL Domains**: You are capped at at most **2 read calls before editing code** (Read context -> Read target file -> Edit -> Done). Making 3+ reads without an edit is an immediate failure.
> 3. **Mandatory Line 1 Anchor**: When opening any source file for the first time, `StartLine` MUST be 1 (`StartLine: 1`). Mid-file guessing slices (`#L150-250`, `#L320-450`) and chunked Battleship reads are strictly banned.
> 4. **Direct File Mapping**:
>    - Styles, Centering, Mobile & Floating Background: `static/style.css`
>    - Markup & Modals: `static/index.html`
>    - Frontend Logic & Audio Loop: `static/app.js`
>    - Audio Engine & Highlight Snapping: `static/audio_player.js`
>    - Backend API & Routes: `backend/app.py`
> 5. **New File Invariant**: Whenever you create ANY new script, module, or component in this repository, you MUST prepend an AI notice comment at Line 1 directing future agents to `spotiless_context.md` and active rules.
> 6. **Zero Wandering / Zero Chunked Reads**: Never read files in incremental 50–100-line chunks. Never read backend files (`launcher.py`, `backend/app.py`) for styling or UI changes. Never run unprompted `git status` or `git diff`.
> 7. **Stop and Clarify (No Blind Sweeping)**: If the user asks for a feature or term (e.g., *"the highlight"*, an unfamiliar endpoint) not found in this context or primary target file, DO NOT crawl the codebase searching file after file. Stop immediately, deduce what they likely mean, state what the codebase currently supports, and ask if that is what they meant.

## 1. Executive Summary & High-Level Objective
- **Project**: Spotiless (Songless — Spotify Edition), an endless music guessing game inspired by *Songless* (Lessgames) with microsecond-accurate snippet intervals (0.1s → 0.25s → 0.5s → 1.0s → 2.0s → 5.0s).
- **Current Version**: `v1.4.3` (Unified GitHub Cloud & Local Native Release)
- **Official Branding**: **Spoti-Less** in-app / **Spotiless** for domain and repository links.
- **Dual Architecture**:
  1. **Desktop Native Mode (`launcher.py` / `127.0.0.1:4321`)**: 100% Native Spotify Shannon cipher streaming over TCP port 4070 (`ap-gae2.spotify.com:4070`) using cached Librespot playback tokens and personal Spotify user libraries. Works even through school firewalls and FortiGuard blocks.
  2. **Cloud Standalone Mode (`vercel.json` / `spotiless.vercel.app`)**: 100% decoupled client-side web mode. Users can play independently on mobile or desktop without a local Python daemon. Audio snippets stream via public Apple/iTunes preview CDNs decoded with sample accuracy by the Web Audio API.

## 2. Critical Architecture & Invariants
- **Mandatory GitHub Push Invariant**: Always push commits to GitHub remote immediately upon task completion. Client auto-updaters, deployments (Vercel), and GitHub repo state must always stay synced after every verified feature, fix, or version bump.
- **Centered Symmetrical Layout & Mobile Responsiveness**:
  - Full viewport centering (`body { width: 100%; display: flex; flex-direction: column; align-items: center; }` and `.app-layout { margin: 0 auto; width: 100%; max-width: 690px; }`).
  - Clean 3-column grid navbar (`1fr auto 1fr`) on desktop; responsive 2-row layout with compact touch-friendly dock and bottom-sheet modals on mobile screens (`@media (max-width: 600px)`).
- **Floating Animated Spotify Logo Pattern & Mouse Spotlight**:
  - Dual-layer continuous floating Spotify logo pattern (`body::before` floating pattern and `body::after` traveling crowd wave) animated down and to the right.
  - Interactive mouse parallax tracking and radial spotlight effect (`initMouseBackgroundReactivity()` in `static/app.js` runs immediately on `DOMContentLoaded` and tracks `mousemove` + `touchmove`).
  - Dynamic full-screen canvas behind UI with smooth lerped ambient aura, orbiting mesh, and audio playback pulse boosts (zero green cursor dots).
- **Precision Audio Engine & Highlight Snapping (`static/audio_player.js`)**:
  - Sample-accurate snippet cuts with 12ms hardware buffer lookahead (`startTime = now + 0.012`) and auto AudioContext un-suspension (`ensureContextRunning()`).
  - Intelligent chorus/hook detection (`detectAudioHighlightOffset`) with peak RMS analysis and 10ms micro-step onset snapping.
  - Continuous looping and full playback on victory reveal (`playFull(fromHighlight, loop)`) with smooth fade-out (`audio.fadeOut(0.8)`) on round transition.
  - Queued playback safety (`pendingSnippet`, `pendingHighlight`, `pendingPlayFull`) ensuring clicks during audio decode in-flight always fire reliably.
- **Multi-User Privacy Isolation & Legal Compliance**:
  - Zero server-side tracking: streaks, win rates, theme preferences, and tokens stay in the client's `localStorage`.
  - Onboarding account dialog (`#modal-auth`), Sign In vs Sign Up toggle, Change Username support, and guest sessions.
  - Ubiquitous Terms of Service & Privacy Policy modal (`#modal-privacy`) accessible via top navigation shield button (`#btn-nav-privacy`) and footer.
  - Data deletion copy preserved; wipe button earmarked for upcoming Settings menu.

## 3. Recent Modifications & Verified State (`v1.4.3`)
- [`static/login.html`](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/login.html): Dedicated standalone Sign In, Create Account, and Spotify Connect page (`/login` & `/login.html`) with zero modal overlays, working on both mobile and desktop Vercel deployments.
- [`vercel.json`](file:///d:/DOWNLOAD/RandomSongGuessingThing/vercel.json) & [`backend/app.py`](file:///d:/DOWNLOAD/RandomSongGuessingThing/backend/app.py): Added `/login` route/rewrite and bumped version to `v1.4.3`.
- [`static/index.html`](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/index.html) & [`static/app.js`](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/app.js):
  - Updated `#btn-open-auth` and `window.openAuthModal()` to navigate directly to `login.html`.
  - Removed auto-popping `#modal-auth` on initial page load so new visitors can play immediately.
  - Raised `.toast` `z-index` to `10000` and enabled `.modal-card` vertical scrolling in [`static/style.css`](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/style.css).
  - Bumped asset cache busters to `?v=1.4.3`.

## 4. Immediate Next Steps
- Full unified gameplay verified across both Local Desktop launcher and Cloud Vercel deployment.
