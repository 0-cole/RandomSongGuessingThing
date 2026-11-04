# Spotiless (Songless — Spotify Edition) Context Summary

## Executive Summary & High-Level Objective
- **Project Name:** Spotiless / Songless (Spotify Edition)
- **Repo URL:** `git@github.com:0-cole/RandomSongGuessingThing.git`
- **Location:** `C:\Users\cdbla\Documents\GitHub\Spotiless`
- **Purpose:** A microsecond-accurate music guessing game running as a standalone desktop app powered by Flask, Web Audio API, and Spotify/Librespot. Includes free demo mode fallback via iTunes API.

## Critical Architecture & Invariants
- **Backend:** Flask app (`backend/app.py`) running on `http://127.0.0.1:4321`.
- **Audio Engine:** `backend/audio_resolver.py` streams audio via Librespot or iTunes preview fallback.
- **Frontend:** Pure HTML/CSS/JS in `static/` with 0ms Web Audio API precision snippets (0.1s, 0.25s, 0.5s, 1.0s, 2.0s, 5.0s).
- **Launcher:** `launcher.py` starts Flask and automatically launches the browser in standalone frameless `--app` mode (Edge, Brave, Chrome).
- **One-Click Batch File:** `run.bat` for easy launching from Windows Explorer.
- **Spotifast:** Included as a portable client in `spotifast/` with its own `run.bat`.

## Recent Modifications & Verified State
- Cloned and migrated to dedicated GitHub folder: `C:\Users\cdbla\Documents\GitHub\Spotiless`.
- All Python dependencies installed (`flask`, `requests`, `librespot`, `sounddevice`, `spotipy`, `pip-system-certs`).
- Network diagnostics completed: School Wi-Fi (FortiGuard) blocks `*.spotify.com`; cellular hotspot / VPN resolves all Spotify endpoints (200 OK verified).
- Git repository configured with SSH remote.

## How to Launch
Double-click `run.bat` in `C:\Users\cdbla\Documents\GitHub\Spotiless\run.bat` or run:
```powershell
python launcher.py
```
Open in browser: `http://localhost:4321`
