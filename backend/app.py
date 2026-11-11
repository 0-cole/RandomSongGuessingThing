# ---------------------------------------------------------------------------
# ⚠️ HEY AI AGENT! Editing this backend script?
# 1. Stop! Read spotiless_context.md & rules first!
# 2. If the user asked for styling, UI, or CSS: STOP! Frontend belongs in static/.
# 3. Strict Fast-Path Budget: Capped at 1–2 tool calls per declared target file.
# 4. Invariant: Maintain Librespot native streaming, zero iTunes fallbacks.
# ---------------------------------------------------------------------------
import os
import io
from flask import Flask, jsonify, request, send_from_directory, Response
from backend.spotify_manager import SpotifyManager
from backend.audio_resolver import AudioResolver
from backend.game_engine import GameEngine

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")

__version__ = '1.4.1'

app = Flask(__name__, static_folder=STATIC_DIR)

# Instantiate singletons
spotify_mgr = SpotifyManager()
audio_resolver = AudioResolver(spotify_mgr)
game_engine = GameEngine(spotify_mgr)

# Initialize default track pool (demo or user library)
game_engine.load_pool(mode="easy")

@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")

@app.route("/<path:filename>")
def serve_static(filename):
    return send_from_directory(STATIC_DIR, filename)

@app.after_request
def add_cache_control(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# ----------------- Auth & Status Endpoints -----------------

@app.route("/api/status", methods=["GET"])
def get_status():
    status_data = spotify_mgr.get_status()
    if spotify_mgr.is_connected and game_engine.playlist_name == "Demo / Sample Pack":
        try:
            game_engine.load_pool("easy")
        except Exception:
            pass
    status_data["game_stats"] = game_engine.stats
    status_data["version"] = __version__
    status_data["active_pool"] = {
        "mode": game_engine.difficulty,
        "name": game_engine.playlist_name,
        "playlist_ids": game_engine.playlist_ids,
        "total_tracks": len(game_engine.track_pool),
        "song_index": len(game_engine.played_track_ids),
        "session_won": game_engine.session_won,
        "session_played": game_engine.session_played,
        "cycle_count": game_engine.cycle_count
    }
    return jsonify(status_data)

@app.route("/api/auth/login_user_pass", methods=["POST"])
def login_user_pass():
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    if not username or not password:
        return jsonify({"success": False, "error": "Username and password required"}), 400
    
    result = spotify_mgr.login_user_pass(username, password)
    if result.get("success"):
        # Reload game pool with user's actual top tracks
        game_engine.load_pool(game_engine.difficulty)
    return jsonify(result)

@app.route("/api/auth/oauth_start", methods=["POST"])
def oauth_start():
    result = spotify_mgr.start_oauth_flow()
    return jsonify(result)

@app.route("/api/auth/start_zeroconf", methods=["POST"])
def start_zeroconf():
    data = request.json or {}
    device_name = data.get("device_name", "Songless Guessing Game")
    result = spotify_mgr.start_zeroconf(device_name)
    return jsonify(result)

@app.route("/api/auth/logout", methods=["POST"])
def logout():
    spotify_mgr.logout()
    game_engine.load_pool(mode="easy")
    return jsonify({"success": True})

# ----------------- Playlists & Modes -----------------

@app.route("/api/playlists", methods=["GET"])
def get_playlists():
    import re
    all_playlists = spotify_mgr.fetch_playlists() if spotify_mgr.is_connected else []
    
    my_playlists = [p for p in all_playlists if p.get("is_mine")]
    saved_playlists = [p for p in all_playlists if not p.get("is_mine")]

    categories = [
        {"id": "easy", "name": "🔥 Easy: Heavy Rotation (Past 4 Weeks)", "desc": "Songs you've been listening to on repeat"},
        {"id": "medium", "name": "⚡ Medium: Familiar Favorites (Past 6 Months)", "desc": "Your regular rotation & favorite tracks"},
        {"id": "hard", "name": "💀 Hard: Deep Cuts (All-Time)", "desc": "Your library archive, forgotten favorites & deep tracks"},
        {"id": "liked", "name": "❤️ Liked Songs", "desc": "All songs from your Spotify Liked library"}
    ]

    curated = [
        {"id": "37i9dQZF1DXcBWIGoYBM5M", "name": "🌟 Today's Top Hits", "desc": "The biggest pop & viral hits right now on Spotify", "image": "https://i.scdn.co/image/ab67706f00000002b0fe40a6e1692822f5a9d8f1"},
        {"id": "37i9dQZF1DX4o1oenSJRJd", "name": "🪩 2000s Pop Throwbacks", "desc": "Nostalgic 2000s pop anthems", "image": "https://i.scdn.co/image/ab67706f000000021665e8a719bd183f044bb775"},
        {"id": "37i9dQZF1DX0XUsuxWHRQd", "name": "🎧 RapCaviar", "desc": "Top hip-hop & rap tracks", "image": "https://i.scdn.co/image/ab67706f00000002ca5a7517156021292e5663a6"},
        {"id": "37i9dQZF1DWXRqgorJj26U", "name": "🎸 Rock Classics", "desc": "Timeless rock & alternative classics", "image": "https://i.scdn.co/image/ab67706f00000002fe24d7084be4aa228871629b"},
        {"id": "37i9dQZF1DXbTxeAdrVG2l", "name": "📻 90s Hits", "desc": "Iconic 90s music across all genres", "image": "https://i.scdn.co/image/ab67706f0000000234d8ee34bc819e62fe8971f4"},
        {"id": "37i9dQZF1DXdfOcg1fm0VG", "name": "🎮 Video Game Soundtracks", "desc": "Iconic gaming themes & osts", "image": "https://i.scdn.co/image/ab67706f00000002c0b43538e1a7baee6f23ce08"},
        {"id": "37i9dQZF1DXdLEN7aqioXM", "name": "🌙 Chill / Lofi Beats", "desc": "Smooth beats to relax & guess", "image": "https://i.scdn.co/image/ab67706f00000002b8529aa87e596700ef5417ab"}
    ]

    return jsonify({
        "categories": categories,
        "my_playlists": my_playlists,
        "saved_playlists": saved_playlists,
        "curated_playlists": curated,
        "playlists": my_playlists,
        "is_connected": spotify_mgr.is_connected
    })

@app.route("/api/playlists/load_custom", methods=["POST"])
def load_custom_playlist():
    import re
    data = request.json or {}
    raw_input = data.get("url_or_id", "").strip()
    if not raw_input:
        return jsonify({"success": False, "error": "Please provide a Spotify playlist link or ID"}), 400

    m = re.search(r"playlist[/:]+([a-zA-Z0-9]+)", raw_input)
    playlist_id = m.group(1) if m else raw_input

    tracks = spotify_mgr.fetch_playlist_tracks(playlist_id, limit=100)
    if not tracks:
        return jsonify({"success": False, "error": f"Could not find or load tracks for playlist '{playlist_id}'"}), 400

    playlist_name = data.get("name") or f"Custom Playlist ({len(tracks)} tracks)"
    res = game_engine.load_pool(mode="playlist", playlist_id=playlist_id, playlist_name=playlist_name)
    round_state = game_engine.start_new_round()
    return jsonify({"success": True, "pool": res, "round": round_state})

@app.route("/api/game/pool", methods=["POST"])
def set_game_pool():
    data = request.json or {}
    mode = data.get("mode", "easy")
    playlist_id = data.get("playlist_id")
    playlist_name = data.get("playlist_name", "")
    playlist_ids = data.get("playlist_ids")
    playlist_names = data.get("playlist_names")
    
    result = game_engine.load_pool(
        mode=mode,
        playlist_id=playlist_id,
        playlist_name=playlist_name,
        playlist_ids=playlist_ids,
        playlist_names=playlist_names,
    )
    if not result.get("success"):
        return jsonify({"success": False, "error": result.get("error")}), 400
    # Automatically kick off a fresh round in the new mode
    round_state = game_engine.start_new_round()
    return jsonify({"success": True, "pool": result, "round": round_state})

# ----------------- Game Loop Endpoints -----------------

@app.route("/api/game/state", methods=["GET"])
def get_game_state():
    if not game_engine.current_track:
        game_engine.start_new_round()
    return jsonify(game_engine.get_client_round_state())

@app.route("/api/game/new_round", methods=["POST"])
def new_round():
    state = game_engine.start_new_round()
    return jsonify(state)

@app.route("/api/game/guess", methods=["POST"])
def make_guess():
    data = request.json or {}
    track_id = data.get("track_id", "")
    guess_text = data.get("guess_text", "")
    state = game_engine.submit_guess(guess_track_id=track_id, guess_text=guess_text)
    return jsonify(state)

@app.route("/api/game/skip", methods=["POST"])
def skip_round():
    state = game_engine.skip_attempt()
    return jsonify(state)

@app.route("/api/game/give_up", methods=["POST"])
def give_up():
    state = game_engine.give_up()
    return jsonify(state)

@app.route("/api/game/search", methods=["GET"])
def search_tracks():
    q = request.args.get("q", "").strip()
    results = game_engine.search_candidates(q, limit=10)
    return jsonify({"results": results})

# ----------------- Audio Streaming Endpoint -----------------

@app.route("/api/audio/<track_id>", methods=["GET"])
def stream_audio(track_id):
    # Locate track metadata
    track = None
    if game_engine.current_track and game_engine.current_track.get("id") == track_id:
        track = game_engine.current_track
    else:
        for t in game_engine.track_pool:
            if t.get("id") == track_id:
                track = t
                break
    
    if not track:
        track = {"id": track_id, "name": "Unknown", "artist": ""}

    audio_result = audio_resolver.get_audio(track)
    if not audio_result:
        return jsonify({"error": "Audio stream not found for this track"}), 404

    audio_bytes, mime_type = audio_result
    return Response(
        io.BytesIO(audio_bytes),
        mimetype=mime_type,
        headers={
            "Content-Length": str(len(audio_bytes)),
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=86400"
        }
    )

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=4321, debug=False)
