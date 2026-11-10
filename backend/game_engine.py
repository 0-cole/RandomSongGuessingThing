# ---------------------------------------------------------------------------
# ⚠️ HEY AI AGENT! Editing this game engine?
# 1. Stop! Read spotiless_context.md & rules first!
# 2. Invariant: Maintain game state isolation, snippet timing unlock stages.
# 3. Strict Fast-Path Budget: Capped at 1–2 tool calls per declared target file.
# ---------------------------------------------------------------------------
import os
import json
import random
import re
from typing import Dict, Any, List, Optional

STATS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "game_stats.json")

# Standard snippet unlock stages (in seconds)
SNIPPET_STAGES = [0.1, 0.25, 0.5, 1.0, 2.0, 5.0]

# Sample tracks for Guest / Offline demo mode
DEMO_TRACKS = [
    {
        "id": "0VjIjW4GlUZAMYd2vXMi3b",
        "uri": "spotify:track:0VjIjW4GlUZAMYd2vXMi3b",
        "name": "Blinding Lights",
        "artist": "The Weeknd",
        "album_name": "After Hours",
        "image_url": "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36",
        "thumbnail_url": "https://i.scdn.co/image/ab67616d000048518863bc11d2aa12b54f5aeb36"
    },
    {
        "id": "7MXVkk9YMctZqd1Srtv4MB",
        "uri": "spotify:track:7MXVkk9YMctZqd1Srtv4MB",
        "name": "Starboy",
        "artist": "The Weeknd, Daft Punk",
        "album_name": "Starboy",
        "image_url": "https://i.scdn.co/image/ab67616d0000b2734718e2b124f79258be7bc452",
        "thumbnail_url": "https://i.scdn.co/image/ab67616d000048514718e2b124f79258be7bc452"
    }
]

class GameEngine:
    def __init__(self, spotify_manager):
        self.spotify_mgr = spotify_manager
        self.stats = self._load_stats()
        
        # Active session state
        self.difficulty = "easy"
        self.playlist_id = None
        self.playlist_ids: List[str] = []
        self.playlist_names: List[str] = []
        self.playlist_name = ""
        self.track_pool: List[Dict[str, Any]] = []
        self.played_track_ids: set[str] = set()
        self.session_won = 0
        self.session_played = 0
        self.cycle_count = 0
        
        # Current active round
        self.current_track: Optional[Dict[str, Any]] = None
        self.attempt_index = 0
        self.max_attempts = len(SNIPPET_STAGES)
        self.guesses: List[Dict[str, Any]] = []
        self.is_won = False
        self.is_over = False

    def _load_stats(self) -> Dict[str, Any]:
        default_stats = {
            "played": 0,
            "won": 0,
            "current_streak": 0,
            "best_streak": 0,
            "distribution": {str(i): 0 for i in range(1, len(SNIPPET_STAGES) + 1)}
        }
        if os.path.exists(STATS_FILE):
            try:
                with open(STATS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    default_stats.update(data)
            except Exception:
                pass
        return default_stats

    def _save_stats(self):
        try:
            with open(STATS_FILE, "w", encoding="utf-8") as f:
                json.dump(self.stats, f, indent=2)
        except Exception:
            pass

    def load_pool(
        self,
        mode: str = "easy",
        playlist_id: Optional[str] = None,
        playlist_name: str = "",
        playlist_ids: Optional[List[str]] = None,
        playlist_names: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Load tracks based on mode:
        - 'easy': Top tracks (past 4 weeks) - Heavy rotation
        - 'medium': Top tracks (past 6 months) + Liked songs
        - 'hard': Top tracks (all time) - Deep cuts
        - 'playlist': One or more user/curated playlists combined
        """
        self.difficulty = mode
        if mode == "playlist":
            ids = [pid for pid in (playlist_ids or ([playlist_id] if playlist_id else [])) if pid]
            names = [n for n in (playlist_names or ([playlist_name] if playlist_name else [])) if n]
            self.playlist_ids = ids
            self.playlist_names = names
            self.playlist_id = ids[0] if ids else None
            if len(names) == 1:
                self.playlist_name = names[0]
            elif len(names) == 2:
                self.playlist_name = f"{names[0]} + {names[1]}"
            elif len(names) > 2:
                self.playlist_name = f"{names[0]} + {len(names) - 1} more"
            else:
                self.playlist_name = playlist_name or (f"{len(ids)} Playlists" if len(ids) > 1 else f"Playlist {self.playlist_id}")
        else:
            self.playlist_id = None
            self.playlist_ids = []
            self.playlist_names = []
            self.playlist_name = playlist_name
        
        tracks = []
        if not self.spotify_mgr or not self.spotify_mgr.is_connected:
            # Fallback to demo tracks
            tracks = DEMO_TRACKS
            self.playlist_name = "Demo / Sample Pack"
        else:
            if mode == "easy":
                tracks = self.spotify_mgr.fetch_top_tracks(time_range="short_term", limit=40)
                if not tracks:
                    tracks = self.spotify_mgr.fetch_liked_songs(limit=30)
                self.playlist_name = "Heavy Rotation (Last Month)"
            elif mode == "medium":
                tracks = self.spotify_mgr.fetch_top_tracks(time_range="medium_term", limit=50)
                if not tracks:
                    tracks = self.spotify_mgr.fetch_liked_songs(limit=40)
                self.playlist_name = "Favorites (Last 6 Months)"
            elif mode == "hard":
                tracks = self.spotify_mgr.fetch_top_tracks(time_range="long_term", limit=50)
                if not tracks:
                    tracks = self.spotify_mgr.fetch_liked_songs(limit=50)
                self.playlist_name = "All-Time Deep Cuts"
            elif mode == "playlist" and self.playlist_ids:
                seen_ids = set()
                for pid in self.playlist_ids:
                    p_tracks = self.spotify_mgr.fetch_playlist_tracks(pid, limit=150)
                    for t in (p_tracks or []):
                        tid = t.get("id")
                        if tid and tid not in seen_ids:
                            seen_ids.add(tid)
                            tracks.append(t)
            elif mode == "liked":
                tracks = self.spotify_mgr.fetch_liked_songs(limit=50)
                self.playlist_name = "Liked Songs"
            
            if not tracks:
                if mode == "playlist":
                    return {
                        "success": False,
                        "mode": mode,
                        "playlist_name": self.playlist_name,
                        "total_tracks": 0,
                        "error": f"Could not load songs for '{self.playlist_name}'. Spotify is blocked on this network and this playlist has not been cached yet."
                    }
                cached_backup = self.spotify_mgr.fetch_playlist_tracks("3UFunkZK4io2zd8dnSViOz", limit=50)
                if cached_backup:
                    tracks = cached_backup
                    self.playlist_name = "Your Library (Offline Rotation)"
                else:
                    tracks = DEMO_TRACKS
                    self.playlist_name = "Demo / Sample Pack"

        # Deduplicate tracks by id to ensure track_pool count matches unique played_track_ids
        unique_tracks = []
        seen = set()
        for t in tracks:
            tid = t.get("id")
            if tid and tid not in seen:
                seen.add(tid)
                unique_tracks.append(t)

        self.track_pool = unique_tracks if unique_tracks else tracks
        self.played_track_ids.clear()
        self.session_won = 0
        self.session_played = 0
        self.cycle_count = 0
        
        return {
            "success": True,
            "mode": mode,
            "playlist_name": self.playlist_name,
            "playlist_ids": self.playlist_ids,
            "total_tracks": len(self.track_pool),
            "song_index": 0
        }

    def start_new_round(self) -> Dict[str, Any]:
        """Start a new guessing round with an unplayed song from the current pool"""
        if not self.track_pool:
            self.load_pool(self.difficulty, self.playlist_id, self.playlist_name, self.playlist_ids, self.playlist_names)
            
        available = [t for t in self.track_pool if t["id"] not in self.played_track_ids]
        if not available:
            # Cycled through all songs, reset session history
            self.played_track_ids.clear()
            self.cycle_count += 1
            available = self.track_pool

        self.current_track = random.choice(available)
        self.played_track_ids.add(self.current_track["id"])
        
        self.attempt_index = 0
        self.guesses = []
        self.is_won = False
        self.is_over = False

        return self.get_client_round_state()

    def get_client_round_state(self) -> Dict[str, Any]:
        """Return the public state of the current round without spoiling the answer"""
        if not self.current_track:
            return {"active": False}

        unlocked_sec = SNIPPET_STAGES[self.attempt_index] if self.attempt_index < len(SNIPPET_STAGES) else SNIPPET_STAGES[-1]

        total_songs = len(self.track_pool)
        song_index = len(self.played_track_ids)
        is_final_song = (song_index >= total_songs and total_songs > 0)
        playlist_completed = is_final_song and self.is_over

        state = {
            "active": True,
            "round_id": self.current_track["id"],
            "attempt": self.attempt_index + 1,
            "max_attempts": self.max_attempts,
            "unlocked_seconds": unlocked_sec,
            "all_stages": SNIPPET_STAGES,
            "guesses": self.guesses,
            "is_won": self.is_won,
            "is_over": self.is_over,
            "pool_name": self.playlist_name,
            "playlist_ids": self.playlist_ids,
            "pool_size": total_songs,
            "song_index": song_index,
            "total_songs": total_songs,
            "session_won": self.session_won,
            "session_played": self.session_played,
            "is_final_song": is_final_song,
            "playlist_completed": playlist_completed,
            "cycle_count": self.cycle_count,
            "stats": self.stats
        }

        # If round ended, reveal the answer
        if self.is_over:
            state["solution"] = self.current_track
            state["share_text"] = self.generate_share_card()

        return state

    def submit_guess(self, guess_track_id: str, guess_text: str = "") -> Dict[str, Any]:
        """Process a player's guess"""
        if self.is_over or not self.current_track:
            return self.get_client_round_state()

        is_match = False
        matched_track = None

        # Check by ID first
        if guess_track_id and guess_track_id == self.current_track["id"]:
            is_match = True
            matched_track = self.current_track
        else:
            # Check candidate in pool by ID
            for t in self.track_pool:
                if t["id"] == guess_track_id:
                    matched_track = t
                    break
            
            # Fuzzy title normalization check
            if not matched_track and guess_text:
                norm_guess = self._normalize(guess_text)
                norm_actual = self._normalize(f"{self.current_track['name']} {self.current_track['artist']}")
                if norm_guess in norm_actual or norm_actual in norm_guess:
                    is_match = True
                    matched_track = self.current_track

        # Record guess
        guess_info = {
            "attempt": self.attempt_index + 1,
            "unlocked_seconds": SNIPPET_STAGES[self.attempt_index],
            "correct": is_match,
            "track_name": matched_track.get("name") if matched_track else guess_text,
            "artist": matched_track.get("artist", "") if matched_track else "",
            "skipped": False
        }
        self.guesses.append(guess_info)

        if is_match:
            self.is_won = True
            self.is_over = True
            self._update_stats_win(self.attempt_index + 1)
        else:
            self.attempt_index += 1
            if self.attempt_index >= self.max_attempts:
                self.is_over = True
                self._update_stats_loss()

        return self.get_client_round_state()

    def skip_attempt(self) -> Dict[str, Any]:
        """Player skips current snippet stage"""
        if self.is_over or not self.current_track:
            return self.get_client_round_state()

        guess_info = {
            "attempt": self.attempt_index + 1,
            "unlocked_seconds": SNIPPET_STAGES[self.attempt_index],
            "correct": False,
            "track_name": "Skipped",
            "artist": "",
            "skipped": True
        }
        self.guesses.append(guess_info)

        self.attempt_index += 1
        if self.attempt_index >= self.max_attempts:
            self.is_over = True
            self._update_stats_loss()

        return self.get_client_round_state()

    def give_up(self) -> Dict[str, Any]:
        """End the round immediately and reveal the answer"""
        if not self.is_over:
            self.is_over = True
            self.is_won = False
            self._update_stats_loss()
        return self.get_client_round_state()

    def _update_stats_win(self, attempt_number: int):
        self.session_won += 1
        self.session_played += 1
        self.stats["played"] += 1
        self.stats["won"] += 1
        self.stats["current_streak"] += 1
        if self.stats["current_streak"] > self.stats["best_streak"]:
            self.stats["best_streak"] = self.stats["current_streak"]
        key = str(attempt_number)
        self.stats["distribution"][key] = self.stats["distribution"].get(key, 0) + 1
        self._save_stats()

    def _update_stats_loss(self):
        self.session_played += 1
        self.stats["played"] += 1
        self.stats["current_streak"] = 0
        self._save_stats()

    def generate_share_card(self) -> str:
        """Wordle/Songless style copyable result grid"""
        grid = []
        for g in self.guesses:
            if g.get("correct"):
                grid.append("🟩")
            elif g.get("skipped"):
                grid.append("⬛")
            else:
                grid.append("🟥")
        
        # Fill remaining if won early
        while len(grid) < self.max_attempts:
            grid.append("⬜")

        grid_str = "".join(grid)
        status = f"Solved in {SNIPPET_STAGES[len(self.guesses)-1]}s! 🎯" if self.is_won else "Couldn't guess this one! 💀"
        total = len(self.track_pool)
        idx = len(self.played_track_ids)
        progress_str = f"Song {idx}/{total}"
        return f"Spoti-Less ({self.playlist_name})\n{progress_str} • {status}\n{grid_str}\nStreak: {self.stats['current_streak']} 🔥"

    def search_candidates(self, query: str, limit: int = 8) -> List[Dict[str, Any]]:
        """Autocomplete search across the active track pool"""
        if not query or not self.track_pool:
            return []
        
        q = self._normalize(query)
        results = []
        for t in self.track_pool:
            title_norm = self._normalize(t.get("name", ""))
            artist_norm = self._normalize(t.get("artist", ""))
            
            # Priority matches
            if q in title_norm or q in artist_norm:
                results.append(t)
            if len(results) >= limit:
                break
        return results

    def _normalize(self, text: str) -> str:
        return re.sub(r"[^a-zA-Z0-9 ]", "", text).lower().strip()
