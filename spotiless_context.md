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
- **Current Version**: `v1.4.6` (Gentle Website Update Notification, Active Round & Streak Persistence on Reload)
- **Official Branding**: **Spoti-Less** in-app / **Spotiless** for domain and repository links.
- **Dual Architecture**:
  1. **Desktop Native Mode (`launcher.py` / `127.0.0.1:4321`)**: 100% Native Spotify Shannon cipher streaming over TCP port 4070 (`ap-gae2.spotify.com:4070`) using cached Librespot playback tokens and personal Spotify user libraries. Works even through school firewalls and FortiGuard blocks.
  2. **Cloud Standalone Mode (`vercel.json` / `spotiless.vercel.app`)**: 100% decoupled client-side web mode. Users can paste any Spotify username, profile link, or **Public** playlist link via `/api/spotify_public`, with audio streaming resolved across Spotify Embed MP3 previews, Apple/iTunes, Deezer, CORS audio proxy, and hidden YouTube IFrame fallback. Extremely niche / Spotify-exclusive tracks auto-skip without hurting streaks.

## 2. Critical Architecture & Invariants
- **Mandatory GitHub Push Invariant**: Always push commits to GitHub remote immediately upon task completion. Client auto-updaters, deployments (Vercel), and GitHub repo state must always stay synced after every verified feature, fix, or version bump.
- **Centered Symmetrical Layout & Mobile Responsiveness**:
  - Full viewport centering (`body { width: 100%; display: flex; flex-direction: column; align-items: center; }` and `.app-layout { margin: 0 auto; width: 100%; max-width: 690px; }`).
  - Clean 3-column grid navbar (`1fr auto 1fr`) on desktop; responsive 2-row layout with compact touch-friendly dock and bottom-sheet modals on mobile screens (`@media (max-width: 600px)`).
- **Gentle Website Update Notifier & Round Persistence (`v1.4.6`)**:
  - Automatically polls `version.json` / `/api/status` periodically (45s) and on tab visibility change (`visibilitychange` / `window.onfocus`).
  - Sleek, unobtrusive bottom-right floating card (`.update-banner`) with glowing emerald pulse dot, responsive bottom docking on mobile viewports, reload CTA, and dismiss option.
  - Active round & streak persistence: stores in-progress attempt index and guesses in `spotiless_cloud_active_round` / `localStorage`, ensuring players can reload at any time without losing active guesses or streaks.
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

## 3. Recent Modifications & Verified State (`v1.4.6`)
- **Gentle Website Update Notification ([static/index.html](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/index.html), [static/style.css](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/style.css), [static/app.js](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/app.js), [static/version.json](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/version.json))**:
  - Added non-intrusive bottom-right floating update banner with glowing pulse dot and smooth entrance animation.
  - Optimized for mobile viewports (`bottom: 16px; margin: 0 auto; max-width: none;`).
  - Added periodic (45s) and tab-focus / `visibilitychange` version polling against `version.json`.
  - Replaced abrupt automatic reload with user-controlled reload CTA and dismiss toggle with session memory.
- **In-Flight Round & Streak Preservation on Reload ([static/app.js](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/app.js))**:
  - Implemented `saveActiveRound()` and `spotiless_cloud_active_round` in `localStorage`.
  - Reloading the page in the middle of a song now safely restores the active track, current attempt, and all previous guesses (correct, wrong, skipped) alongside streaks.
- **Universal Multi-User Spotify Discovery (`v1.4.6`, [api/spotify_public.js](file:///d:/DOWNLOAD/RandomSongGuessingThing/api/spotify_public.js), [backend/app.py](file:///d:/DOWNLOAD/RandomSongGuessingThing/backend/app.py), [backend/spotify_manager.py](file:///d:/DOWNLOAD/RandomSongGuessingThing/backend/spotify_manager.py))**:
  - Removed all hardcoded user IDs, SHA-256 user aliases, plaintext personal handles, and personal playlist IDs across frontend and backend.
  - Added Spotify **Pathfinder GraphQL** (`fetchPlaylist`, `searchUsers`, `searchPlaylists`) using anonymous embed tokens for universal handle/display-name lookup and playlist-link-to-creator auto-discovery (`loadPlaylistAndCreator`), plus dynamic filtering of third-party Spotify radio mixes (`owner_name === "Spotify"` unless requesting `spotify`).
  - Upgraded `backend/spotify_manager.py` to resolve arbitrary desktop logged-in profiles dynamically and query `spclient.wg.spotify.com/user-profile-view/v3/profile/` with `playlist_limit=50`.
- **Additive Playlist Merging ([static/app.js](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/app.js), [static/login.html](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/login.html), [static/index.html](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/index.html))**:
  - Pasting an extra public playlist link or refreshing a linked profile merges playlists additively into `localStorage` (`spotiless_public_playlists`, schema `v1.4.6`) and saves discovered creator `user_id` into `spotiless_linked_user`.
- Bumped version and asset cache busters (`?v=1.4.6`) across frontend and backend.

## 3b. Prior Verified State (`v1.4.5`)
- **Username/Email Privacy Cleanup ([static/login.html](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/login.html), [api/spotify_public.js](file:///d:/DOWNLOAD/RandomSongGuessingThing/api/spotify_public.js), [backend/app.py](file:///d:/DOWNLOAD/RandomSongGuessingThing/backend/app.py))**: Removed all hardcoded plaintext usernames and emails from HTML placeholders and server code; replaced internal alias lookup with SHA-256 hash matching.
- **Full Public Playlist Loading ([api/spotify_public.js](file:///d:/DOWNLOAD/RandomSongGuessingThing/api/spotify_public.js), [backend/app.py](file:///d:/DOWNLOAD/RandomSongGuessingThing/backend/app.py), [static/app.js](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/app.js))**: Raised Cloud Mode user playlist hydration limit from 5 to 25, included supplemental public user playlist IDs beyond Spotify's 10-card SSR preview, excluded third-party radio mixes, and added automatic `localStorage` schema refresh (`spotiless_playlists_schema = "v1.4.5"`).
- **Mobile Screenshot Touch-Freeze Prevention ([static/style.css](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/style.css), [static/app.js](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/app.js), [static/audio_player.js](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/audio_player.js))**: Disabled heavy animated backdrop/mask filters on mobile/touch viewports, ensured `#loading-spinner` and `#yt-hidden-wrapper` are strictly `pointer-events: none` / offscreen, added `touch-action: manipulation`, and stopped redundant idle canvas repaints in `drawVisualizer()`.
- Bumped version and asset cache busters to `v1.4.5`.

## 3b. Prior Verified State (`v1.4.4`)
- [`api/spotify_public.js`](file:///d:/DOWNLOAD/RandomSongGuessingThing/api/spotify_public.js) & [`backend/app.py`](file:///d:/DOWNLOAD/RandomSongGuessingThing/backend/app.py): Added `/api/spotify_public` endpoint supporting `?user=` (public profile playlists), `?playlist=` (Spotify Embed tracks + previews), `?track_preview=&q=` (Spotify Embed -> iTunes -> Deezer -> YouTube ID waterfall), and CORS-safe `?proxy_audio=`. Bumped version to `v1.4.4`.
- [`vercel.json`](file:///d:/DOWNLOAD/RandomSongGuessingThing/vercel.json): Configured `/api/:match*` pass-through before `/login` and SPA fallback rewrites.
- [`static/audio_player.js`](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/audio_player.js): Upgraded `MicroAudioEngine` with 4-stage preview resolution, `/api/spotify_public?proxy_audio=` fallback, Lobby98-style hidden YouTube IFrame Player (`#yt-hidden-player`), and fixed stray bracket syntax bug.
- [`static/login.html`](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/login.html), [`static/index.html`](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/index.html), & [`static/app.js`](file:///d:/DOWNLOAD/RandomSongGuessingThing/static/app.js):
  - Added public Spotify username / profile URL / public playlist link loading in both `/login` and `#modal-mode`.
  - Added clear user warnings reminding users that playlists must be **Public** and explaining that extremely niche / Spotify-exclusive tracks may not exist on web audio platforms.
  - Added streak-safe auto-skipping (`CloudGameManager.skipUnplayableRound()`) when a niche song fails across all web audio sources, plus Cloud Mode support for public & curated playlists in `#modal-mode`.
  - Bumped asset cache busters to `?v=1.4.4`.

## 4. Immediate Next Steps
- Full unified gameplay verified across both Local Desktop launcher and Cloud Vercel deployment.
