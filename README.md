# 🎵 Songless — Spotify Edition (Endless Guessing Game)

A microsecond-accurate music guessing game inspired by **Songless** (from Lessgames), running as a standalone desktop app powered by **Spotify** and **Librespot** (the same audio engine powering Spotifast).

---

## ✨ Features

- **Micro-Snippet Stepper:**
  - 1st Guess: **0.1s**
  - 2nd Guess: **0.25s** (+0.15s)
  - 3rd Guess: **0.5s** (+0.25s)
  - 4th Guess: **1.0s** (+0.5s)
  - 5th Guess: **2.0s** (+1.0s)
  - 6th Guess: **5.0s** (+3.0s / full preview)
- **Difficulties Based on Listening Frequency:**
  - 🔥 **Easy (Heavy Rotation):** Your Spotify Top Tracks from the past 4 weeks (the songs stuck in your head right now).
  - ⚡ **Medium (Familiar Favorites):** Your Top Tracks from the past 6 months + recent Liked Songs.
  - 💀 **Hard (All-Time Deep Cuts):** All-time top tracks and older library saves you haven't heard in ages.
  - ❤️ **Liked Songs & Custom Playlists:** Play endless guessing on *any* of your personal Spotify playlists!
- **Endless Mode:**
  - No once-per-day restriction. Hit **"Next Song"** to keep playing round after round.
  - Streak tracking, win rate, and guess-time distribution stats.
- **Spotifast / Librespot Engine:**
  - Connects to Spotify via **Spotify Connect (Zeroconf)** or direct sign-in.
  - Streams decrypted Vorbis audio directly from Spotify's servers.
  - Uses the **Web Audio API** in the browser window for 0ms latency, sample-accurate 0.1s cuts.
  - Includes iTunes preview fallback so Demo mode is playable even before signing in!

---

## 🚀 How to Launch

Simply double-click:
```bat
run.bat
```
*(Or run `python launcher.py` in PowerShell/Command Prompt).*

This starts the local server and automatically launches **Brave** (or Edge) in frameless desktop application mode.

---

## 🎧 Connecting to Your Spotify

Click the **Spotify** pill in the top right:
1. **Option A: 1-Click Spotify Connect (Spotifast style):**
   - Click *"Start Discovery Device"*.
   - In Spotifast (or the official Spotify app on your phone/PC), open the **Devices** menu.
   - Select **"Songless Guessing Game"**.
   - You're connected and your session is saved locally so you don't have to connect again!
2. **Option B: Username & Password:**
   - Enter your Spotify credentials in the tab to sign in directly.

---

## ⌨️ Hotkeys

- **Spacebar**: Play / Pause audio snippet
- **Enter**: Submit guess (when typing in the search bar) or Next Song (when on the reveal screen)
- **Escape**: Close modal / Dismiss autocomplete dropdown
