# Spotiless Agent Guidelines

## 1. Preflight Order (Rules -> Context -> Task)
- **Rules First**: Review all active user and project rules prior to tool use or planning.
- **Context Second (`spotiless_context.md`)**: The repository architecture, ports (`http://127.0.0.1:4321`), launcher behavior, audio resolver, and verified dependencies are already documented in `spotiless_context.md` at the project root. Do not rebuild context from scratch or run broad scans.
- **Task Execution Third**: Only after verifying rules and context, proceed directly to targeted file edits with minimal tool calls.
- **Visible Preflight**: Include `> **Preflight Check**: Rules verified | Context confirmed (spotiless_context.md) | Target: <file> (Budget: ≤2 calls)` at the beginning of task execution responses.

## 2. Targeted Minimal Analysis (Fast-Path Execution)
- **Calibrate to Request Complexity**:
  - For simple requests (UI tweaks, styling, text edits, timing adjustments, single-function bugfixes): **Do NOT over-analyze.**
  - Target **1–2 tool calls total** (Direct Read -> Direct Edit).
  - Open and inspect **only** the single file directly responsible for the requested change.
- **Stop Overthinking**: If you find yourself making 3+ diagnostic or investigative tool calls without modifying code on a simple request, stop searching and proceed directly to editing the target file.

## 3. Scope Boundaries & Exclusions
- **Do not touch or scan submodules unnecessarily**:
  - `spotifast/` is a separate native Spotify client with its own guide (`spotifast/AGENTS.md`). Do not scan or edit `spotifast/` unless the prompt specifically asks for Spotifast changes.
  - `audio_cache/` contains cached media files. Never inspect raw audio bytes or run directory listings on cache directories.
  - Runtime JSON state files (`session_cache.json`, `game_stats.json`) should not be parsed or analyzed unless state management is explicitly part of the prompt.
- **Direct File Mapping**:
  - Frontend UI, styles, audio playback timings, and game logic -> `static/` (`index.html`, `app.js`, `style.css`).
  - Backend routing, API endpoints, playback proxy -> `backend/app.py` or `backend/audio_resolver.py`.
  - App window launcher -> `launcher.py`.
