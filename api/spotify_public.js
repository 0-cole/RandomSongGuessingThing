// ⚠️ HEY AI AGENT! Editing this serverless function?
// 1. Stop! Read spotiless_context.md & rules first!
// 2. Strict Fast-Path Budget: Capped at 1–2 tool calls total (Read -> Edit -> Done).
// 3. Do not wander or perform exploratory sweeps. Make direct edits cleanly.

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const USER_ALIASES = {
    "cole.__": "31leppthj2runlbv3x6juui65bpa",
    "cole": "31leppthj2runlbv3x6juui65bpa",
    "cdblair418@gmail.com": "31leppthj2runlbv3x6juui65bpa"
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
    val = val.split("?")[0].split("#")[0].trim();
    const lower = val.toLowerCase();
    return USER_ALIASES[lower] || val;
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

    return {
        playlist: {
            id: playlistId,
            name: entity.title || "Spotify Playlist",
            image: coverUrl,
            tracks_count: tracks.length
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

async function searchPublicPlaylistsByApi(query, token) {
    if (!token || !query) return [];
    try {
        const uRes = await fetch(`https://api.spotify.com/v1/users/${encodeURIComponent(query)}/playlists?limit=20`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (uRes.ok) {
            const uData = await uRes.json();
            if (Array.isArray(uData.items) && uData.items.length > 0) {
                return uData.items.map((p) => ({
                    id: p.id,
                    name: p.name,
                    image: (p.images && p.images[0] && p.images[0].url) || "",
                    tracks_count: (p.tracks && p.tracks.total) || 0
                }));
            }
        }
    } catch (e) {}

    try {
        const sRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=playlist&limit=10`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (sRes.ok) {
            const sData = await sRes.json();
            const items = (sData.playlists && sData.playlists.items) || [];
            return items
                .filter((p) => p && p.id)
                .map((p) => ({
                    id: p.id,
                    name: p.name,
                    image: (p.images && p.images[0] && p.images[0].url) || "",
                    tracks_count: (p.tracks && p.tracks.total) || 0
                }));
        }
    } catch (e) {}
    return [];
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

    // 3. Single public playlist loader
    if (query.playlist) {
        const playlistId = extractPlaylistId(query.playlist);
        if (!playlistId) {
            return res.status(400).json({ success: false, error: "Invalid Spotify playlist link or ID" });
        }
        try {
            const { playlist, tracks } = await fetchPlaylistEmbed(playlistId);
            if (!tracks.length) {
                return res.status(404).json({
                    success: false,
                    error: "No playable tracks found. Make sure the playlist is set to Public on Spotify."
                });
            }
            return res.status(200).json({
                success: true,
                playlist,
                playlists: playlist ? [playlist] : [],
                tracks
            });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    // 4. Spotify username / profile loader -> fetches all public playlists + tracks
    if (query.user) {
        const rawUser = String(query.user || "").trim();
        const playlistIdFromUserInput = extractPlaylistId(rawUser);
        if (playlistIdFromUserInput) {
            try {
                const { playlist, tracks } = await fetchPlaylistEmbed(playlistIdFromUserInput);
                if (!tracks.length) {
                    return res.status(404).json({ success: false, error: "Playlist has no tracks or is Private." });
                }
                return res.status(200).json({
                    success: true,
                    username: playlist ? playlist.name : playlistIdFromUserInput,
                    playlists: playlist ? [playlist] : [],
                    tracks
                });
            } catch (err) {
                return res.status(500).json({ success: false, error: err.message });
            }
        }

        const userId = extractUserId(rawUser);
        let profile = await fetchUserPublicPage(userId);
        let playlists = profile ? profile.playlists : [];
        let displayName = (profile && profile.display_name) || userId;
        let avatar = (profile && profile.avatar) || "";

        if (!playlists.length) {
            const token = await getAnonymousAccessToken();
            playlists = await searchPublicPlaylistsByApi(userId, token);
        }

        if (!playlists.length) {
            return res.status(404).json({
                success: false,
                error: "Could not find any public playlists for that Spotify username. Make sure your playlists are set to Public on Spotify, or paste a Public Playlist link directly."
            });
        }

        const topPlaylists = playlists.slice(0, 5);
        const results = await Promise.allSettled(topPlaylists.map((p) => fetchPlaylistEmbed(p.id)));

        const hydratedPlaylists = [];
        const allTracks = [];
        const seenTrackKeys = new Set();

        results.forEach((r, idx) => {
            const basePl = topPlaylists[idx];
            if (r.status === "fulfilled" && r.value && r.value.tracks.length) {
                const pl = r.value.playlist || basePl;
                hydratedPlaylists.push({
                    id: pl.id,
                    name: pl.name || basePl.name,
                    image: pl.image || basePl.image || "",
                    tracks_count: r.value.tracks.length
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
            user_id: userId,
            avatar,
            playlists: hydratedPlaylists,
            tracks: allTracks
        });
    }

    return res.status(400).json({ success: false, error: "Provide ?user=, ?playlist=, ?track_preview=, or ?proxy_audio=" });
};
