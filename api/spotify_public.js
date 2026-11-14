// ⚠️ HEY AI AGENT! Editing this serverless function?
// 1. Stop! Read spotiless_context.md & rules first!
// 2. Strict Fast-Path Budget: Capped at 1–2 tool calls total (Read -> Edit -> Done).
// 3. Do not wander or perform exploratory sweeps. Make direct edits cleanly.

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const PATHFINDER_ENDPOINT = "https://api-partner.spotify.com/pathfinder/v1/query";
const PATHFINDER_HASHES = {
    fetchPlaylist: "21ea11a6ac75a5f3e01fd365d29c18e0a4a8b7dc09f89bbb5d73910190c6acaf",
    searchUsers: "8f358dd82e62f61dd4ceaa9f8cd0889e644c9b707f1b724fbfb356a757cb7e5a",
    searchPlaylists: "d520014e748f9ea44f7707d8df1819867ac1205e8b7f3e28f22fe5fc858921b1"
};

const ALLOWED_PROXY_HOSTS = [
    "p.scdn.co",
    "dzcdn.net",
    "mzstatic.com",
    "itunes.apple.com"
];

function extractUserId(raw) {
    let val = String(raw || "").trim();
    if (!val) return "";
    const urlMatch = val.match(/open\.spotify\.com\/user\/([a-zA-Z0-9_.-]+)/i);
    if (urlMatch) val = urlMatch[1];
    const uriMatch = val.match(/^spotify:user:([a-zA-Z0-9_.-]+)$/i);
    if (uriMatch) val = uriMatch[1];
    return val.split("?")[0].split("#")[0].trim();
}

function extractPlaylistId(raw) {
    let val = String(raw || "").trim();
    if (!val) return "";
    const match = val.match(/(?:open\.spotify\.com\/playlist\/|spotify:playlist:)([a-zA-Z0-9]+)/i);
    if (match) return match[1];
    val = val.split("?")[0].split("#")[0].trim();
    if (/^[a-zA-Z0-9]{22}$/.test(val)) return val;
    return "";
}

function parseNextData(html) {
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) return null;
    try {
        return JSON.parse(m[1]);
    } catch (e) {
        return null;
    }
}

function parseInitialState(html) {
    const m = html.match(/<script[^>]*id="initialState"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return null;
    try {
        const jsonStr = Buffer.from(m[1].trim(), "base64").toString("utf8");
        return JSON.parse(jsonStr);
    } catch (e) {
        return null;
    }
}

async function fetchText(url, extraHeaders = {}) {
    const res = await fetch(url, {
        headers: {
            "User-Agent": USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
            ...extraHeaders
        }
    });
    if (!res.ok) {
        const err = new Error(`HTTP ${res.status} for ${url}`);
        err.status = res.status;
        throw err;
    }
    return res.text();
}

async function fetchPlaylistEmbed(playlistId) {
    const html = await fetchText(`https://open.spotify.com/embed/playlist/${encodeURIComponent(playlistId)}`);
    const nextData = parseNextData(html);
    const entity = nextData && nextData.props && nextData.props.pageProps && nextData.props.pageProps.state && nextData.props.pageProps.state.data && nextData.props.pageProps.state.data.entity;
    const accessToken = nextData && nextData.props && nextData.props.pageProps && nextData.props.pageProps.state && nextData.props.pageProps.state.settings && nextData.props.pageProps.state.settings.session && nextData.props.pageProps.state.settings.session.accessToken;

    if (!entity) {
        return { playlist: null, tracks: [], accessToken };
    }

    const coverSources = (entity.coverArt && entity.coverArt.sources) || (entity.visualIdentity && entity.visualIdentity.image) || [];
    const coverUrl = coverSources[0] ? coverSources[0].url : "";

    const rawList = Array.isArray(entity.trackList) ? entity.trackList : [];
    const tracks = rawList
        .filter((t) => t && t.title)
        .map((t) => {
            const uri = t.uri || "";
            const id = uri.includes(":") ? uri.split(":").pop() : (t.uid || `${t.title}-${t.subtitle || ""}`);
            const artist = String(t.subtitle || "").replace(/\u00a0/g, " ").trim() || "Unknown Artist";
            const previewUrl = (t.audioPreview && t.audioPreview.url) || "";
            return {
                id,
                uri,
                name: String(t.title).trim(),
                artist,
                album_name: entity.title || "",
                image_url: coverUrl,
                thumbnail_url: coverUrl,
                preview_url: previewUrl,
                playlist_id: playlistId,
                playlist_name: entity.title || "Spotify Playlist"
            };
        });

    const ownerName = String(entity.subtitle || "").trim();

    return {
        playlist: {
            id: playlistId,
            name: entity.title || "Spotify Playlist",
            image: coverUrl,
            tracks_count: tracks.length,
            owner_name: ownerName
        },
        tracks,
        accessToken
    };
}

async function fetchUserPublicPage(userId) {
    try {
        // Non-browser UA ("curl/8.4.0") triggers Spotify SSR with embedded initialState JSON
        const html = await fetchText(`https://open.spotify.com/user/${encodeURIComponent(userId)}`, {
            "User-Agent": "curl/8.4.0",
            "Accept": "text/html"
        });
        const state = parseInitialState(html);
        const items = state && state.entities && state.entities.items;
        if (!items) return null;

        const userKey = items[`spotify:user:${userId}`]
            ? `spotify:user:${userId}`
            : Object.keys(items).find((k) => k.startsWith("spotify:user:"));
        if (!userKey) return null;

        const userObj = items[userKey];
        const avatarSources = (userObj.avatar && userObj.avatar.sources) || [];
        const avatar = avatarSources[avatarSources.length - 1] ? avatarSources[avatarSources.length - 1].url : "";
        const rawPlaylists = (userObj.publicPlaylistsV2 && userObj.publicPlaylistsV2.items) || [];

        const playlists = rawPlaylists
            .map((entry) => {
                const uri = entry._uri || (entry.data && entry.data.uri) || "";
                const id = uri.split(":").pop();
                const pData = entry.data || {};
                const imgItems = (pData.images && pData.images.items) || [];
                const imgSources = imgItems[0] && imgItems[0].sources ? imgItems[0].sources : [];
                const img = imgSources[0] ? imgSources[0].url : "";
                return id ? {
                    id,
                    name: pData.name || "Public Playlist",
                    image: img,
                    tracks_count: null
                } : null;
            })
            .filter(Boolean);

        return {
            user_id: userObj.id || userId,
            display_name: userObj.name || userId,
            avatar,
            playlists
        };
    } catch (e) {
        return null;
    }
}

async function getAnonymousAccessToken() {
    try {
        const html = await fetchText("https://open.spotify.com/embed/track/5CZ40GBx1sQ9agT82CLQCT");
        const nextData = parseNextData(html);
        return nextData && nextData.props && nextData.props.pageProps && nextData.props.pageProps.state && nextData.props.pageProps.state.settings && nextData.props.pageProps.state.settings.session && nextData.props.pageProps.state.settings.session.accessToken;
    } catch (e) {
        return null;
    }
}

async function queryPathfinder(operationName, sha256Hash, variables, token) {
    if (!token) return null;
    try {
        const extensions = { persistedQuery: { version: 1, sha256Hash } };
        const url = `${PATHFINDER_ENDPOINT}?operationName=${encodeURIComponent(operationName)}&variables=${encodeURIComponent(JSON.stringify(variables))}&extensions=${encodeURIComponent(JSON.stringify(extensions))}`;
        const res = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "App-Platform": "WebPlayer",
                "User-Agent": USER_AGENT
            }
        });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

async function fetchPlaylistPathfinder(playlistId, token) {
    if (!playlistId || !token) return { owner_id: "", owner_name: "" };
    const data = await queryPathfinder(
        "fetchPlaylist",
        PATHFINDER_HASHES.fetchPlaylist,
        { uri: `spotify:playlist:${playlistId}`, offset: 0, limit: 200, enableWatchFeedEntrypoint: false },
        token
    );
    const pl = data && data.data && data.data.playlistV2;
    const ownerData = pl && pl.ownerV2 && pl.ownerV2.data;
    const ownerUri = (ownerData && ownerData.uri) || "";
    const ownerId = (ownerData && ownerData.username) || (ownerUri.includes(":") ? ownerUri.split(":").pop() : "");
    const ownerName = (ownerData && ownerData.name) || ownerId || "";
    return { owner_id: ownerId, owner_name: ownerName };
}

async function discoverUserAndPlaylistsByPathfinder(query, token) {
    if (!token || !query) return { profile: null, playlists: [] };
    const qLower = query.trim().toLowerCase();

    const [usersData, playlistsData] = await Promise.all([
        queryPathfinder(
            "searchUsers",
            PATHFINDER_HASHES.searchUsers,
            { searchTerm: query, offset: 0, limit: 20, numberOfTopResults: 5, includeAudiobooks: false },
            token
        ),
        queryPathfinder(
            "searchPlaylists",
            PATHFINDER_HASHES.searchPlaylists,
            { searchTerm: query, offset: 0, limit: 50, numberOfTopResults: 20, includeAudiobooks: false },
            token
        )
    ]);

    const rawUsers = ((usersData && usersData.data && usersData.data.searchV2 && usersData.data.searchV2.users && usersData.data.searchV2.users.items) || [])
        .map((it) => it && it.data)
        .filter(Boolean);
    const rawPlaylists = ((playlistsData && playlistsData.data && playlistsData.data.searchV2 && playlistsData.data.searchV2.playlists && playlistsData.data.searchV2.playlists.items) || [])
        .map((it) => it && it.data)
        .filter(Boolean);

    const exactUser = rawUsers.find((u) => {
        const dn = String(u.displayName || "").toLowerCase();
        const un = String(u.username || u.id || "").toLowerCase();
        return dn === qLower || un === qLower;
    });

    let matchedOwnerFromPlaylists = null;
    for (const p of rawPlaylists) {
        const o = (p.ownerV2 && p.ownerV2.data) || {};
        const on = String(o.name || "").toLowerCase();
        const ou = String(o.username || "").toLowerCase();
        if (on === qLower || ou === qLower) {
            matchedOwnerFromPlaylists = o;
            break;
        }
    }

    const candidateUserId =
        (exactUser && (exactUser.username || exactUser.id)) ||
        (matchedOwnerFromPlaylists && matchedOwnerFromPlaylists.username) ||
        (rawUsers[0] && (rawUsers[0].username || rawUsers[0].id)) ||
        "";

    const mergedMap = new Map();
    let profile = null;

    if (candidateUserId) {
        profile = await fetchUserPublicPage(candidateUserId);
        if (profile && Array.isArray(profile.playlists)) {
            profile.playlists.forEach((pl) => {
                if (pl && pl.id) mergedMap.set(pl.id, pl);
            });
        }
        rawPlaylists.forEach((p) => {
            const owner = (p.ownerV2 && p.ownerV2.data) || {};
            const ownerId = owner.username || ((owner.uri || "").split(":").pop()) || "";
            const uri = p.uri || "";
            const pid = uri.includes(":") ? uri.split(":").pop() : "";
            if (pid && ownerId === candidateUserId && !mergedMap.has(pid)) {
                const imgItems = (p.images && p.images.items) || [];
                const imgSrcs = imgItems[0] && imgItems[0].sources ? imgItems[0].sources : [];
                mergedMap.set(pid, {
                    id: pid,
                    name: p.name || "Public Playlist",
                    image: (imgSrcs[0] && imgSrcs[0].url) || "",
                    tracks_count: null,
                    owner_name: owner.name || ownerId
                });
            }
        });
    }

    if (mergedMap.size === 0) {
        rawPlaylists.slice(0, 15).forEach((p) => {
            const uri = p.uri || "";
            const pid = uri.includes(":") ? uri.split(":").pop() : "";
            const owner = (p.ownerV2 && p.ownerV2.data) || {};
            if (pid && !mergedMap.has(pid)) {
                const imgItems = (p.images && p.images.items) || [];
                const imgSrcs = imgItems[0] && imgItems[0].sources ? imgItems[0].sources : [];
                mergedMap.set(pid, {
                    id: pid,
                    name: p.name || "Public Playlist",
                    image: (imgSrcs[0] && imgSrcs[0].url) || "",
                    tracks_count: null,
                    owner_name: owner.name || ""
                });
            }
        });
    }

    return {
        profile,
        playlists: Array.from(mergedMap.values())
    };
}

async function loadPlaylistAndCreator(playlistId) {
    const embed = await fetchPlaylistEmbed(playlistId);
    if (!embed || !embed.tracks.length) return null;

    const token = embed.accessToken || await getAnonymousAccessToken();
    const meta = await fetchPlaylistPathfinder(playlistId, token);
    const ownerId = meta.owner_id || "";
    const ownerName = meta.owner_name || (embed.playlist && embed.playlist.owner_name) || "";

    const playlistsMap = new Map();
    if (embed.playlist && embed.playlist.id) {
        playlistsMap.set(embed.playlist.id, embed.playlist);
    }

    let resolvedDisplayName = ownerName;
    if (ownerId && ownerId.toLowerCase() !== "spotify") {
        const profile = await fetchUserPublicPage(ownerId);
        if (profile) {
            if (profile.display_name) resolvedDisplayName = profile.display_name;
            const others = (profile.playlists || []).filter((p) => p && p.id && p.id !== playlistId).slice(0, 24);
            if (others.length) {
                const hydrated = await Promise.allSettled(others.map((p) => fetchPlaylistEmbed(p.id)));
                hydrated.forEach((r, idx) => {
                    const basePl = others[idx];
                    if (r.status === "fulfilled" && r.value && r.value.tracks.length) {
                        const pl = r.value.playlist || basePl;
                        const plOwner = String(pl.owner_name || "").toLowerCase();
                        if (plOwner === "spotify") return;
                        playlistsMap.set(pl.id, {
                            id: pl.id,
                            name: pl.name || basePl.name,
                            image: pl.image || basePl.image || "",
                            tracks_count: r.value.tracks.length,
                            owner_name: pl.owner_name || ""
                        });
                    }
                });
            }
        }
    }

    return {
        playlist: embed.playlist,
        playlists: Array.from(playlistsMap.values()),
        tracks: embed.tracks,
        user_id: ownerId,
        username: resolvedDisplayName
    };
}

async function resolveTrackPreviewWaterfall(trackId, q) {
    let previewUrl = "";
    let source = "";
    let youtubeVideoId = "";

    // Source A: Spotify Embed MP3 preview
    if (trackId && /^[a-zA-Z0-9]{22}$/.test(trackId)) {
        try {
            const html = await fetchText(`https://open.spotify.com/embed/track/${encodeURIComponent(trackId)}`);
            const nextData = parseNextData(html);
            const entity = nextData && nextData.props && nextData.props.pageProps && nextData.props.pageProps.state && nextData.props.pageProps.state.data && nextData.props.pageProps.state.data.entity;
            if (entity && entity.audioPreview && entity.audioPreview.url) {
                previewUrl = entity.audioPreview.url;
                source = "spotify_embed";
            }
        } catch (e) {}
    }

    // Source B: iTunes Search API
    if (!previewUrl && q) {
        try {
            const itRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=3`);
            if (itRes.ok) {
                const itData = await itRes.json();
                const hit = (itData.results || []).find((r) => r && r.previewUrl);
                if (hit) {
                    previewUrl = hit.previewUrl;
                    source = "itunes";
                }
            }
        } catch (e) {}
    }

    // Source C: Deezer Public Search API
    if (!previewUrl && q) {
        try {
            const dzRes = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=3`);
            if (dzRes.ok) {
                const dzData = await dzRes.json();
                const hit = (dzData.data || []).find((r) => r && r.preview);
                if (hit) {
                    previewUrl = hit.preview;
                    source = "deezer";
                }
            }
        } catch (e) {}
    }

    // Source D: YouTube Video ID Search (Lobby98-style hidden player fallback)
    if (q) {
        try {
            const ytHtml = await fetchText(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${q} official audio`)}`);
            const ytMatch = ytHtml.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
            if (ytMatch) {
                youtubeVideoId = ytMatch[1];
                if (!source) source = "youtube";
            }
        } catch (e) {}
    }

    return {
        success: Boolean(previewUrl || youtubeVideoId),
        preview_url: previewUrl,
        source,
        youtube_video_id: youtubeVideoId
    };
}

function isAllowedProxyUrl(rawUrl) {
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== "https:") return false;
        const host = parsed.hostname.toLowerCase();
        return ALLOWED_PROXY_HOSTS.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
    } catch (e) {
        return false;
    }
}

module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    const query = req.query || {};

    // 1. Audio CORS proxy
    if (query.proxy_audio) {
        const targetUrl = String(query.proxy_audio);
        if (!isAllowedProxyUrl(targetUrl)) {
            return res.status(400).json({ success: false, error: "Disallowed proxy host" });
        }
        try {
            const audioRes = await fetch(targetUrl, { headers: { "User-Agent": USER_AGENT } });
            if (!audioRes.ok) {
                return res.status(audioRes.status).json({ success: false, error: "Upstream audio fetch failed" });
            }
            const buf = Buffer.from(await audioRes.arrayBuffer());
            const contentType = audioRes.headers.get("content-type") || "audio/mpeg";
            res.setHeader("Content-Type", contentType);
            res.setHeader("Cache-Control", "public, max-age=86400");
            return res.status(200).send(buf);
        } catch (err) {
            return res.status(502).json({ success: false, error: err.message });
        }
    }

    // 2. Track preview resolution waterfall
    if (query.track_preview !== undefined || query.q) {
        const trackId = String(query.track_preview || "").trim();
        const q = String(query.q || "").trim();
        const resolved = await resolveTrackPreviewWaterfall(trackId, q);
        res.setHeader("Cache-Control", "public, max-age=3600");
        return res.status(200).json(resolved);
    }

    // 3. Single public playlist loader (+ auto-discover creator's public playlists)
    if (query.playlist) {
        const playlistId = extractPlaylistId(query.playlist);
        if (!playlistId) {
            return res.status(400).json({ success: false, error: "Invalid Spotify playlist link or ID" });
        }
        try {
            const loaded = await loadPlaylistAndCreator(playlistId);
            if (!loaded || !loaded.tracks.length) {
                return res.status(404).json({
                    success: false,
                    error: "No playable tracks found. Make sure the playlist is set to Public on Spotify."
                });
            }
            return res.status(200).json({
                success: true,
                playlist: loaded.playlist,
                playlists: loaded.playlists,
                tracks: loaded.tracks,
                user_id: loaded.user_id,
                username: loaded.username
            });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    // 4. Spotify username / profile / playlist loader -> universally resolves public playlists + tracks
    if (query.user) {
        const rawUser = String(query.user || "").trim();
        const playlistIdFromUserInput = extractPlaylistId(rawUser);
        if (playlistIdFromUserInput) {
            try {
                const loaded = await loadPlaylistAndCreator(playlistIdFromUserInput);
                if (!loaded || !loaded.tracks.length) {
                    return res.status(404).json({ success: false, error: "Playlist has no tracks or is Private." });
                }
                return res.status(200).json({
                    success: true,
                    playlist: loaded.playlist,
                    username: loaded.username || (loaded.playlist && loaded.playlist.name) || playlistIdFromUserInput,
                    user_id: loaded.user_id || "",
                    playlists: loaded.playlists,
                    tracks: loaded.tracks
                });
            } catch (err) {
                return res.status(500).json({ success: false, error: err.message });
            }
        }

        const userId = extractUserId(rawUser);
        let resolvedUserId = userId;
        let profile = await fetchUserPublicPage(userId);
        let playlists = (profile && Array.isArray(profile.playlists)) ? profile.playlists.slice() : [];
        let displayName = (profile && profile.display_name) || userId;
        let avatar = (profile && profile.avatar) || "";

        if (!profile || !playlists.length) {
            const token = await getAnonymousAccessToken();
            const discovered = await discoverUserAndPlaylistsByPathfinder(rawUser, token);
            if (discovered.profile) {
                profile = discovered.profile;
                resolvedUserId = profile.user_id || resolvedUserId;
                displayName = profile.display_name || displayName;
                avatar = profile.avatar || avatar;
            }
            if (Array.isArray(discovered.playlists) && discovered.playlists.length) {
                const existingPlIds = new Set(playlists.map((p) => p.id));
                discovered.playlists.forEach((p) => {
                    if (p && p.id && !existingPlIds.has(p.id)) {
                        existingPlIds.add(p.id);
                        playlists.push(p);
                    }
                });
            }
        }

        if (!playlists.length) {
            return res.status(404).json({
                success: false,
                error: "Could not find any public playlists for that Spotify profile or handle. Make sure your playlists are set to Public on Spotify, or paste a Public Playlist link directly."
            });
        }

        const topPlaylists = playlists.filter((p) => p && p.id).slice(0, 25);
        const results = await Promise.allSettled(topPlaylists.map((p) => fetchPlaylistEmbed(p.id)));

        const hydratedPlaylists = [];
        const allTracks = [];
        const seenTrackKeys = new Set();

        results.forEach((r, idx) => {
            const basePl = topPlaylists[idx];
            if (r.status === "fulfilled" && r.value && r.value.tracks.length) {
                const pl = r.value.playlist || basePl;
                const plOwner = String(pl.owner_name || basePl.owner_name || "").trim().toLowerCase();
                if (plOwner === "spotify" && resolvedUserId.toLowerCase() !== "spotify") {
                    return;
                }
                hydratedPlaylists.push({
                    id: pl.id,
                    name: pl.name || basePl.name,
                    image: pl.image || basePl.image || "",
                    tracks_count: r.value.tracks.length,
                    owner_name: pl.owner_name || basePl.owner_name || ""
                });
                r.value.tracks.forEach((t) => {
                    const key = t.id || `${t.name.toLowerCase()}::${t.artist.toLowerCase()}`;
                    if (!seenTrackKeys.has(key)) {
                        seenTrackKeys.add(key);
                        allTracks.push(t);
                    }
                });
            }
        });

        if (!allTracks.length) {
            return res.status(404).json({
                success: false,
                error: "Found playlists, but none had public tracks available. Ensure at least one playlist is set to Public."
            });
        }

        return res.status(200).json({
            success: true,
            username: displayName,
            user_id: resolvedUserId,
            avatar,
            playlists: hydratedPlaylists,
            tracks: allTracks
        });
    }

    return res.status(400).json({ success: false, error: "Provide ?user=, ?playlist=, ?track_preview=, or ?proxy_audio=" });
};
