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

__version__ = '1.4.6'

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

@app.route("/login")
def login_page():
    return send_from_directory(STATIC_DIR, "login.html")

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

# ----------------- Public Spotify / Multi-Source Endpoint -----------------

@app.route("/api/spotify_public", methods=["GET"])
def spotify_public_endpoint():
    import re
    import json
    import base64
    import urllib.parse
    import concurrent.futures
    import requests as req_lib

    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    pathfinder_url = "https://api-partner.spotify.com/pathfinder/v1/query"
    pf_hashes = {
        "fetchPlaylist": "21ea11a6ac75a5f3e01fd365d29c18e0a4a8b7dc09f89bbb5d73910190c6acaf",
        "searchUsers": "8f358dd82e62f61dd4ceaa9f8cd0889e644c9b707f1b724fbfb356a757cb7e5a",
        "searchPlaylists": "d520014e748f9ea44f7707d8df1819867ac1205e8b7f3e28f22fe5fc858921b1",
    }

    def parse_next_data(html_text):
        m = re.search(r'<script id="__NEXT_DATA__" type="application/json">([\s\S]*?)</script>', html_text)
        if not m:
            return None
        try:
            return json.loads(m.group(1))
        except Exception:
            return None

    def get_anon_token():
        try:
            r = req_lib.get("https://open.spotify.com/embed/track/5CZ40GBx1sQ9agT82CLQCT", headers={"User-Agent": ua}, timeout=6)
            nd = parse_next_data(r.text) or {}
            return nd.get("props", {}).get("pageProps", {}).get("state", {}).get("settings", {}).get("session", {}).get("accessToken")
        except Exception:
            return None

    def query_pathfinder(op_name, sha256_hash, variables, token):
        if not token:
            return None
        try:
            ext = {"persistedQuery": {"version": 1, "sha256Hash": sha256_hash}}
            url = (
                f"{pathfinder_url}?operationName={urllib.parse.quote(op_name)}"
                f"&variables={urllib.parse.quote(json.dumps(variables))}"
                f"&extensions={urllib.parse.quote(json.dumps(ext))}"
            )
            r = req_lib.get(url, headers={"Authorization": f"Bearer {token}", "App-Platform": "WebPlayer", "User-Agent": ua}, timeout=8)
            return r.json() if r.status_code == 200 else None
        except Exception:
            return None

    def fetch_playlist_embed(pid):
        r = req_lib.get(f"https://open.spotify.com/embed/playlist/{urllib.parse.quote(pid)}", headers={"User-Agent": ua}, timeout=8)
        if r.status_code != 200:
            return {"playlist": None, "tracks": [], "access_token": None}
        nd = parse_next_data(r.text) or {}
        state = nd.get("props", {}).get("pageProps", {}).get("state", {})
        entity = state.get("data", {}).get("entity") or {}
        tok = (state.get("settings") or {}).get("session", {}).get("accessToken")
        if not entity:
            return {"playlist": None, "tracks": [], "access_token": tok}
        cover_sources = (entity.get("coverArt") or {}).get("sources") or (entity.get("visualIdentity") or {}).get("image") or []
        cover_url = cover_sources[0].get("url", "") if cover_sources else ""
        owner_name = str(entity.get("subtitle") or "").strip()
        tracks = []
        for t in entity.get("trackList") or []:
            if not t or not t.get("title"):
                continue
            uri = t.get("uri", "")
            tid = uri.split(":")[-1] if ":" in uri else (t.get("uid") or t.get("title"))
            artist = (t.get("subtitle") or "").replace("\u00a0", " ").strip() or "Unknown Artist"
            preview_url = (t.get("audioPreview") or {}).get("url") or ""
            tracks.append({
                "id": tid,
                "uri": uri,
                "name": str(t.get("title")).strip(),
                "artist": artist,
                "album_name": entity.get("title", ""),
                "image_url": cover_url,
                "thumbnail_url": cover_url,
                "preview_url": preview_url,
                "playlist_id": pid,
                "playlist_name": entity.get("title", "Spotify Playlist"),
            })
        return {
            "playlist": {
                "id": pid,
                "name": entity.get("title", "Spotify Playlist"),
                "image": cover_url,
                "tracks_count": len(tracks),
                "owner_name": owner_name,
            },
            "tracks": tracks,
            "access_token": tok,
        }

    def fetch_user_public_page(uid):
        try:
            ur = req_lib.get(
                f"https://open.spotify.com/user/{urllib.parse.quote(uid)}",
                headers={"User-Agent": "curl/8.4.0", "Accept": "text/html"},
                timeout=8,
            )
            if ur.status_code != 200:
                return None
            im = re.search(r'<script[^>]*id="initialState"[^>]*>([\s\S]*?)</script>', ur.text)
            if not im:
                return None
            st = json.loads(base64.b64decode(im.group(1).strip()).decode("utf-8"))
            items = (st.get("entities") or {}).get("items") or {}
            ukey = f"spotify:user:{uid}" if f"spotify:user:{uid}" in items else next((k for k in items if k.startswith("spotify:user:")), None)
            if not ukey:
                return None
            uobj = items[ukey]
            avs = (uobj.get("avatar") or {}).get("sources") or []
            pls = []
            for entry in (uobj.get("publicPlaylistsV2") or {}).get("items") or []:
                e_uri = entry.get("_uri") or (entry.get("data") or {}).get("uri") or ""
                pid = e_uri.split(":")[-1]
                if pid:
                    pdata = entry.get("data") or {}
                    pls.append({"id": pid, "name": pdata.get("name", "Public Playlist"), "image": "", "tracks_count": None})
            return {
                "user_id": uobj.get("id") or uid,
                "display_name": uobj.get("name") or uid,
                "avatar": avs[-1].get("url", "") if avs else "",
                "playlists": pls,
            }
        except Exception:
            return None

    def fetch_playlist_pathfinder(pid, tok):
        d = query_pathfinder("fetchPlaylist", pf_hashes["fetchPlaylist"], {"uri": f"spotify:playlist:{pid}", "offset": 0, "limit": 200, "enableWatchFeedEntrypoint": False}, tok)
        odata = ((d or {}).get("data") or {}).get("playlistV2", {}).get("ownerV2", {}).get("data") or {}
        ouri = odata.get("uri") or ""
        oid = odata.get("username") or (ouri.split(":")[-1] if ":" in ouri else "")
        oname = odata.get("name") or oid or ""
        return {"owner_id": oid, "owner_name": oname}

    def load_playlist_and_creator(pid):
        emb = fetch_playlist_embed(pid)
        if not emb["tracks"]:
            return None
        tok = emb.get("access_token") or get_anon_token()
        meta = fetch_playlist_pathfinder(pid, tok)
        oid = meta.get("owner_id") or ""
        oname = meta.get("owner_name") or (emb["playlist"] or {}).get("owner_name", "")
        pl_map = {emb["playlist"]["id"]: emb["playlist"]} if emb.get("playlist") else {}
        disp = oname
        if oid and oid.lower() != "spotify":
            prof = fetch_user_public_page(oid)
            if prof:
                if prof.get("display_name"):
                    disp = prof["display_name"]
                others = [p for p in prof.get("playlists", []) if p.get("id") and p["id"] != pid][:24]
                if others:
                    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                        h_res = list(pool.map(lambda p: fetch_playlist_embed(p["id"]), others))
                    for res_p in h_res:
                        pl_obj = res_p.get("playlist")
                        if res_p.get("tracks") and pl_obj and str(pl_obj.get("owner_name", "")).lower() != "spotify":
                            pl_map[pl_obj["id"]] = pl_obj
        return {"playlist": emb["playlist"], "playlists": list(pl_map.values()), "tracks": emb["tracks"], "user_id": oid, "username": disp}

    def discover_user_by_pathfinder(q_str, tok):
        if not tok or not q_str:
            return {"profile": None, "playlists": []}
        q_low = q_str.strip().lower()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            fu = pool.submit(query_pathfinder, "searchUsers", pf_hashes["searchUsers"], {"searchTerm": q_str, "offset": 0, "limit": 20, "numberOfTopResults": 5, "includeAudiobooks": False}, tok)
            fp = pool.submit(query_pathfinder, "searchPlaylists", pf_hashes["searchPlaylists"], {"searchTerm": q_str, "offset": 0, "limit": 50, "numberOfTopResults": 20, "includeAudiobooks": False}, tok)
            u_data = fu.result()
            p_data = fp.result()
        raw_users = [it.get("data") for it in (((u_data or {}).get("data") or {}).get("searchV2") or {}).get("users", {}).get("items", []) if it and it.get("data")]
        raw_pls = [it.get("data") for it in (((p_data or {}).get("data") or {}).get("searchV2") or {}).get("playlists", {}).get("items", []) if it and it.get("data")]
        exact_u = next((u for u in raw_users if str(u.get("displayName", "")).lower() == q_low or str(u.get("username") or u.get("id") or "").lower() == q_low), None)
        owner_match = None
        for p in raw_pls:
            o = (p.get("ownerV2") or {}).get("data") or {}
            if str(o.get("name", "")).lower() == q_low or str(o.get("username", "")).lower() == q_low:
                owner_match = o
                break
        cand_id = (exact_u and (exact_u.get("username") or exact_u.get("id"))) or (owner_match and owner_match.get("username")) or (raw_users[0].get("username") or raw_users[0].get("id") if raw_users else "")
        merged = {}
        prof = None
        if cand_id:
            prof = fetch_user_public_page(cand_id)
            for pl in (prof or {}).get("playlists", []):
                merged[pl["id"]] = pl
            for p in raw_pls:
                o = (p.get("ownerV2") or {}).get("data") or {}
                oid = o.get("username") or ((o.get("uri") or "").split(":")[-1])
                pid = (p.get("uri") or "").split(":")[-1]
                if pid and oid == cand_id and pid not in merged:
                    merged[pid] = {"id": pid, "name": p.get("name", "Public Playlist"), "image": "", "tracks_count": None, "owner_name": o.get("name", oid)}
        if not merged:
            for p in raw_pls[:15]:
                pid = (p.get("uri") or "").split(":")[-1]
                if pid and pid not in merged:
                    merged[pid] = {"id": pid, "name": p.get("name", "Public Playlist"), "image": "", "tracks_count": None}
        return {"profile": prof, "playlists": list(merged.values())}

    proxy_audio = request.args.get("proxy_audio", "").strip()
    if proxy_audio:
        try:
            parsed = urllib.parse.urlparse(proxy_audio)
            allowed = ("p.scdn.co", "dzcdn.net", "mzstatic.com", "itunes.apple.com")
            host = (parsed.hostname or "").lower()
            if parsed.scheme != "https" or not any(host == h or host.endswith("." + h) for h in allowed):
                return jsonify({"success": False, "error": "Disallowed proxy host"}), 400
            ar = req_lib.get(proxy_audio, headers={"User-Agent": ua}, timeout=10)
            if ar.status_code != 200:
                return jsonify({"success": False, "error": "Upstream audio fetch failed"}), ar.status_code
            return Response(ar.content, mimetype=ar.headers.get("Content-Type", "audio/mpeg"), headers={"Cache-Control": "public, max-age=86400"})
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 502

    track_preview = request.args.get("track_preview")
    q_param = request.args.get("q", "").strip()
    if track_preview is not None or q_param:
        tid = (track_preview or "").strip()
        preview_url = ""
        source = ""
        yt_id = ""
        if tid and re.match(r"^[a-zA-Z0-9]{22}$", tid):
            try:
                er = req_lib.get(f"https://open.spotify.com/embed/track/{urllib.parse.quote(tid)}", headers={"User-Agent": ua}, timeout=6)
                if er.status_code == 200:
                    nd = parse_next_data(er.text) or {}
                    ent = nd.get("props", {}).get("pageProps", {}).get("state", {}).get("data", {}).get("entity") or {}
                    ap = (ent.get("audioPreview") or {}).get("url")
                    if ap:
                        preview_url = ap
                        source = "spotify_embed"
            except Exception:
                pass
        if not preview_url and q_param:
            try:
                ir = req_lib.get(f"https://itunes.apple.com/search?term={urllib.parse.quote(q_param)}&entity=song&limit=3", timeout=6)
                if ir.status_code == 200:
                    for hit in ir.json().get("results", []):
                        if hit.get("previewUrl"):
                            preview_url = hit["previewUrl"]
                            source = "itunes"
                            break
            except Exception:
                pass
        if not preview_url and q_param:
            try:
                dr = req_lib.get(f"https://api.deezer.com/search?q={urllib.parse.quote(q_param)}&limit=3", timeout=6)
                if dr.status_code == 200:
                    for hit in dr.json().get("data", []):
                        if hit.get("preview"):
                            preview_url = hit["preview"]
                            source = "deezer"
                            break
            except Exception:
                pass
        if q_param:
            try:
                yr = req_lib.get(f"https://www.youtube.com/results?search_query={urllib.parse.quote(q_param + ' official audio')}", headers={"User-Agent": ua}, timeout=6)
                if yr.status_code == 200:
                    ym = re.search(r'"videoId":"([a-zA-Z0-9_-]{11})"', yr.text)
                    if ym:
                        yt_id = ym.group(1)
                        if not source:
                            source = "youtube"
            except Exception:
                pass
        return jsonify({"success": bool(preview_url or yt_id), "preview_url": preview_url, "source": source, "youtube_video_id": yt_id})

    playlist_arg = request.args.get("playlist", "").strip()
    if playlist_arg:
        pm = re.search(r"(?:open\.spotify\.com/playlist/|spotify:playlist:)([a-zA-Z0-9]+)", playlist_arg, re.I)
        pid = pm.group(1) if pm else playlist_arg.split("?")[0].split("#")[0].strip()
        if not re.match(r"^[a-zA-Z0-9]{22}$", pid):
            return jsonify({"success": False, "error": "Invalid Spotify playlist link or ID"}), 400
        loaded = load_playlist_and_creator(pid)
        if not loaded or not loaded["tracks"]:
            return jsonify({"success": False, "error": "No tracks found. Make sure the playlist is Public."}), 404
        return jsonify({
            "success": True,
            "playlist": loaded["playlist"],
            "playlists": loaded["playlists"],
            "tracks": loaded["tracks"],
            "user_id": loaded.get("user_id", ""),
            "username": loaded.get("username", ""),
        })

    user_arg = request.args.get("user", "").strip()
    if user_arg:
        pm = re.search(r"(?:open\.spotify\.com/playlist/|spotify:playlist:)([a-zA-Z0-9]+)", user_arg, re.I)
        if pm:
            loaded = load_playlist_and_creator(pm.group(1))
            if not loaded or not loaded["tracks"]:
                return jsonify({"success": False, "error": "Playlist has no tracks or is Private."}), 404
            return jsonify({
                "success": True,
                "playlist": loaded["playlist"],
                "username": loaded.get("username") or (loaded["playlist"] or {}).get("name", pm.group(1)),
                "user_id": loaded.get("user_id", ""),
                "playlists": loaded["playlists"],
                "tracks": loaded["tracks"],
            })

        um = re.search(r"(?:open\.spotify\.com/user/|spotify:user:)([a-zA-Z0-9_.-]+)", user_arg, re.I)
        uid = (um.group(1) if um else user_arg).split("?")[0].split("#")[0].strip()
        resolved_uid = uid

        profile = fetch_user_public_page(uid)
        playlists = list((profile or {}).get("playlists") or [])
        display_name = (profile or {}).get("display_name") or uid
        avatar = (profile or {}).get("avatar") or ""

        if not profile or not playlists:
            tok = get_anon_token()
            discovered = discover_user_by_pathfinder(user_arg, tok)
            if discovered.get("profile"):
                profile = discovered["profile"]
                resolved_uid = profile.get("user_id") or resolved_uid
                display_name = profile.get("display_name") or display_name
                avatar = profile.get("avatar") or avatar
            existing_ids = {p["id"] for p in playlists if p.get("id")}
            for p in discovered.get("playlists") or []:
                if p.get("id") and p["id"] not in existing_ids:
                    existing_ids.add(p["id"])
                    playlists.append(p)

        if not playlists:
            return jsonify({"success": False, "error": "Could not find any public playlists for that Spotify profile or handle. Make sure your playlists are set to Public on Spotify, or paste a Public Playlist link."}), 404

        top_pls = [p for p in playlists if p.get("id")][:25]
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            fetched = list(pool.map(lambda p: fetch_playlist_embed(p["id"]), top_pls))

        hydrated_pls = []
        all_tracks = []
        seen = set()
        for idx, res_pl in enumerate(fetched):
            if res_pl["tracks"]:
                pl_info = res_pl["playlist"] or top_pls[idx]
                pl_owner = str(pl_info.get("owner_name") or top_pls[idx].get("owner_name") or "").strip().lower()
                if pl_owner == "spotify" and resolved_uid.lower() != "spotify":
                    continue
                hydrated_pls.append(pl_info)
                for tr in res_pl["tracks"]:
                    key = tr.get("id") or f"{tr.get('name', '').lower()}::{tr.get('artist', '').lower()}"
                    if key not in seen:
                        seen.add(key)
                        all_tracks.append(tr)

        if not all_tracks:
            return jsonify({"success": False, "error": "Found playlists, but none had public tracks available."}), 404

        return jsonify({"success": True, "username": display_name, "user_id": resolved_uid, "avatar": avatar, "playlists": hydrated_pls, "tracks": all_tracks})

    return jsonify({"success": False, "error": "Provide ?user=, ?playlist=, ?track_preview=, or ?proxy_audio="}), 400


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
