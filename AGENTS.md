# Spotiless Agent Guidelines

## 1. Context-First Principle
- **Consult `spotiless_context.md` first**: The repository architecture, ports (`http://127.0.0.1:4321`), launcher behavior, audio resolver, and verified dependencies are already documented in `spotiless_context.md` at the project root.
- **Do not rebuild context from scratch**: Do not run broad terminal scans, directory walks, or full-repo greps to rediscover how Spotiless works. Trust the context file.

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
