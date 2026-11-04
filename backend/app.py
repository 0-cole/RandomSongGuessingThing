import os
import io
from flask import Flask, jsonify, request, send_from_directory, Response
from backend.spotify_manager import SpotifyManager
from backend.audio_resolver import AudioResolver
from backend.game_engine import GameEngine

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")

__version__ = '1.0.1'

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

# ----------------- Auth & Status Endpoints -----------------

@app.route("/api/status", methods=["GET"])
def get_status():
    status_data = spotify_mgr.get_status()
    status_data["game_stats"] = game_engine.stats
    status_data["version"] = __version__
    status_data["active_pool"] = {
        "mode": game_engine.difficulty,
        "name": game_engine.playlist_name,
        "total_tracks": len(game_engine.track_pool)
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
    user_playlists = spotify_mgr.fetch_playlists() if spotify_mgr.is_connected else []
    categories = [
        {"id": "easy", "name": "🔥 Easy: Heavy Rotation (Past 4 Weeks)", "desc": "Songs you've been listening to on repeat"},
        {"id": "medium", "name": "⚡ Medium: Familiar Favorites (Past 6 Months)", "desc": "Your regular rotation & favorite tracks"},
        {"id": "hard", "name": "💀 Hard: Deep Cuts (All-Time)", "desc": "Your library archive, forgotten favorites & deep tracks"},
        {"id": "liked", "name": "❤️ Liked Songs", "desc": "All songs from your Spotify Liked library"}
    ]
    return jsonify({
        "categories": categories,
        "playlists": user_playlists,
        "is_connected": spotify_mgr.is_connected
    })

@app.route("/api/game/pool", methods=["POST"])
def set_game_pool():
    data = request.json or {}
    mode = data.get("mode", "easy")
    playlist_id = data.get("playlist_id")
    playlist_name = data.get("playlist_name", "")
    
    result = game_engine.load_pool(mode=mode, playlist_id=playlist_id, playlist_name=playlist_name)
    # Automatically kick off a fresh round in the new mode
    round_state = game_engine.start_new_round()
    return jsonify({"pool": result, "round": round_state})

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
