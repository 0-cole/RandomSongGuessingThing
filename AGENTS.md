# Spotiless Agent Guidelines

## 1. Preflight Order (Rules -> Context -> Task)
- **Rules First**: Review all active user and project rules prior to tool use or planning.
- **Context Second (`spotiless_context.md`)**: Tool Call #1 MUST be reading `spotiless_context.md`. Opening application code files (`.js`, `.py`, `.html`, `.css`) on Turn 1 before reading context is strictly forbidden. The repository architecture, ports (`http://127.0.0.1:4321`), launcher behavior, audio resolver, and verified dependencies are already documented there. Do not rebuild context from scratch or run broad scans.
- **Task Execution Third**: Only after verifying rules and context, proceed directly to targeted file edits with minimal tool calls.
- **Visible Preflight**: Include `> **Preflight Check**: Rules verified | Context confirmed (spotiless_context.md) | Target: <file> (Budget: ≤2 calls)` at the beginning of task execution responses (or `Targets: [<files>] (Budget: ~2 calls/file)` for multi-file tasks).
- **New File Header Invariant**: Any new file or script created in this codebase must include an AI notice banner at Line 1 directing future agents to `spotiless_context.md` and active rules.

## 2. Targeted Minimal Analysis (Fast-Path Execution)
- **Universal 2-Read Cap Across ALL Domains**: Capped at at most **2 read calls before editing code** across all task types. If 2 reads have occurred, STOP reading and proceed directly to editing.
- **Line 1 Anchor (No Mid-File Battleship Reading)**: When opening any source file for the first time, `StartLine` MUST be 1. Never guess arbitrary mid-file slices (e.g. `#L150-250`, `#L320-450`) or read in 50–100-line increments.
- **Calibrate to Request Complexity**:
  - For simple requests (UI tweaks, styling, text edits, timing adjustments, single-function bugfixes): **Do NOT over-analyze.**
  - Target **1–2 tool calls total** (Direct Read -> Direct Edit).
  - Open and inspect **only** the single file directly responsible for the requested change.
- **Stop Overthinking**: If you find yourself making 3+ diagnostic or investigative tool calls without modifying code on a simple request, stop searching and proceed directly to editing the target file.
- **Absolute Necessity Gate**: If an agent genuinely believes an additional tool call is needed beyond the 1–2 baseline budget per file, it must verify that the call is strictly and indisputably necessary (e.g., resolving a breaking error or unexpected crash). Speculative browsing or exploratory reads are strictly forbidden.
- **Stop and Clarify (No Blind Sweeping)**: If the user asks for an unfamiliar concept, term, or feature (e.g., *"the highlight"*, an unknown endpoint) not found in context or the primary file, NEVER sweep the repository. Stop immediately, formulate a hypothesis of what the user likely means, state what the codebase currently supports, and ask the user if that is what they intended.

## 3. Scope Boundaries & Exclusions
- **Do not touch or scan submodules unnecessarily**:
  - `spotifast/` is a separate native Spotify client with its own guide (`spotifast/AGENTS.md`). Do not scan or edit `spotifast/` unless the prompt specifically asks for Spotifast changes.
  - `audio_cache/` contains cached media files. Never inspect raw audio bytes or run directory listings on cache directories.
  - Runtime JSON state files (`session_cache.json`, `game_stats.json`) should not be parsed or analyzed unless state management is explicitly part of the prompt.
- **Direct File Mapping**:
  - Frontend UI, styles, audio playback timings, and game logic -> `static/` (`index.html`, `app.js`, `style.css`).
  - Backend routing, API endpoints, playback proxy -> `backend/app.py` or `backend/audio_resolver.py`.
  - App window launcher -> `launcher.py`.
