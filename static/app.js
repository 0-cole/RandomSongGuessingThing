/**
 * Songless (Spotify Edition) Client Application Controller
 */

document.addEventListener("DOMContentLoaded", () => {
    // Audio Engine
    const audio = new window.MicroAudioEngine();

    // DOM Elements
    const btnPlay = document.getElementById("btn-play");
    const iconPlay = document.getElementById("icon-play");
    const iconPause = document.getElementById("icon-pause");
    const labelPlaybackTime = document.getElementById("label-playback-time");
    const spinner = document.getElementById("loading-spinner");
    const timelineSegments = document.querySelectorAll(".timeline-bar .segment");
    const guessRows = document.querySelectorAll(".guesses-list .guess-row");
    const inputGuess = document.getElementById("input-guess");
    const btnClearSearch = document.getElementById("btn-clear-search");
    const autocompleteList = document.getElementById("autocomplete-list");
    const btnSkip = document.getElementById("btn-skip");
    const skipText = document.getElementById("skip-text");
    const btnSubmit = document.getElementById("btn-submit");
    const btnGiveUp = document.getElementById("btn-give-up");
    const streakCounter = document.getElementById("streak-counter");
    const activePoolLabel = document.getElementById("active-pool-label");
    const authStatusDot = document.getElementById("auth-status-dot");
    const authUsernameLabel = document.getElementById("auth-username-label");
    const toast = document.getElementById("toast");

    // Modals
    const modalReveal = document.getElementById("modal-reveal");
    const modalAuth = document.getElementById("modal-auth");
    const modalMode = document.getElementById("modal-mode");
    const modalStats = document.getElementById("modal-stats");

    // Reveal elements
    const revealStatusIcon = document.getElementById("reveal-status-icon");
    const revealTitle = document.getElementById("reveal-title");
    const revealSubtitle = document.getElementById("reveal-subtitle");
    const revealAlbumArt = document.getElementById("reveal-album-art");
    const revealSongName = document.getElementById("reveal-song-name");
    const revealArtistName = document.getElementById("reveal-artist-name");
    const revealAlbumName = document.getElementById("reveal-album-name");
    const revealEmojiGrid = document.getElementById("reveal-emoji-grid");
    const btnPlayRevealSong = document.getElementById("btn-play-reveal-song");
    const btnShare = document.getElementById("btn-share");
    const btnNextSong = document.getElementById("btn-next-song");

    // Auth Modal elements
    const btnStartZeroconf = document.getElementById("btn-start-zeroconf");
    const zcBtnText = document.getElementById("zc-btn-text");
    const zcStatusText = document.getElementById("zc-status-text");
    const formUserPass = document.getElementById("form-user-pass");
    const authUsername = document.getElementById("auth-username");
    const authPassword = document.getElementById("auth-password");
    const upStatusText = document.getElementById("up-status-text");
    const authConnectedView = document.getElementById("auth-connected-view");
    const userNameDisplay = document.getElementById("user-name-display");
    const userAvatar = document.getElementById("user-avatar");
    const btnLogout = document.getElementById("btn-logout");

    // Mode Modal elements
    const userPlaylistsGrid = document.getElementById("user-playlists-grid");
    const difficultyCards = document.querySelectorAll(".mode-card");

    // Waveform Canvas
    const canvas = document.getElementById("waveform-canvas");
    const canvasCtx = canvas.getContext("2d");

    // App State
    let currentRound = null;
    let selectedTrack = null;
    let searchTimeout = null;
    let focusedItemIndex = -1;
    let authPollingInterval = null;
    let shareTextCache = "";

    // ----------------- Audio & Visualizer Setup -----------------
    audio.onPlayStart = (duration) => {
        btnPlay.classList.add("playing");
        iconPlay.classList.add("hidden");
        iconPause.classList.remove("hidden");
    };

    audio.onPlayProgress = (progress, elapsed) => {
        labelPlaybackTime.textContent = `${elapsed.toFixed(1)}s`;
        updateTimelinePlayhead(elapsed);
    };

    audio.onPlayEnd = () => {
        btnPlay.classList.remove("playing");
        iconPlay.classList.remove("hidden");
        iconPause.classList.add("hidden");
        if (currentRound) {
            labelPlaybackTime.textContent = `${currentRound.unlocked_seconds}s`;
        }
        resetTimelineFills();
    };

    function drawVisualizer() {
        requestAnimationFrame(drawVisualizer);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        const bufferLength = 64;
        const dataArray = new Uint8Array(bufferLength);
        audio.getWaveformData(dataArray);

        const barWidth = (canvas.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * (canvas.height * 0.85);
            const alpha = audio.isPlaying ? 0.8 : 0.2;
            canvasCtx.fillStyle = `rgba(29, 185, 84, ${alpha})`;
            canvasCtx.fillRect(x, (canvas.height - barHeight) / 2, barWidth - 1, Math.max(barHeight, 2));
            x += barWidth;
        }
    }
    drawVisualizer();

    // ----------------- Initialization -----------------
    async function init() {
        await refreshStatus();
        await loadGameState();
        setupEventListeners();
        setInterval(refreshStatus, 3000);
    }

    async function refreshStatus() {
        try {
            const res = await fetch("/api/status");
            const data = await res.json();

            if (data.version) {
                if (window.__CURRENT_APP_VERSION__ && window.__CURRENT_APP_VERSION__ !== data.version) {
                    console.log("New app version detected, reloading...");
                    window.location.reload();
                    return;
                }
                window.__CURRENT_APP_VERSION__ = data.version;
            }
            
            // Update auth status
            if (data.connected) {
                authStatusDot.className = "dot-connected";
                authUsernameLabel.textContent = data.display_name || data.username || "Connected";
                if (data.image) userAvatar.src = data.image;
                userNameDisplay.textContent = data.display_name || data.username;
                authConnectedView.classList.remove("hidden");
            } else {
                authStatusDot.className = "dot-disconnected";
                authUsernameLabel.textContent = "Connect Spotify";
                authConnectedView.classList.add("hidden");
            }

            // Update stats & pool
            if (data.game_stats) {
                streakCounter.textContent = data.game_stats.current_streak || 0;
            }
            if (data.active_pool) {
                activePoolLabel.textContent = data.active_pool.name || "🔥 Heavy Rotation";
            }
        } catch (err) {
            console.error("Status check failed:", err);
        }
    }

    async function loadGameState() {
        showSpinner(true);
        try {
            const res = await fetch("/api/game/state");
            const state = await res.json();
            applyGameState(state);
        } catch (err) {
            console.error("Failed to load game state:", err);
        } finally {
            showSpinner(false);
        }
    }

    function applyGameState(state) {
        currentRound = state;
        if (!state || !state.active) return;

        // Preload audio into memory buffer
        showSpinner(true);
        audio.loadTrack(state.round_id).then((ok) => {
            showSpinner(false);
            if (!ok) { startNewRound(); }
        });

        // Update labels
        labelPlaybackTime.textContent = `${state.unlocked_seconds}s`;
        if (state.pool_name) {
            activePoolLabel.textContent = state.pool_name;
        }

        // Update timeline segments
        timelineSegments.forEach((seg, idx) => {
            seg.classList.remove("unlocked", "current-target");
            if (idx < state.attempt) {
                seg.classList.add("unlocked");
            }
            if (idx === state.attempt - 1) {
                seg.classList.add("current-target");
            }
        });

        // Update skip button text
        const nextIdx = state.attempt;
        if (nextIdx < state.all_stages.length) {
            const addedTime = (state.all_stages[nextIdx] - state.all_stages[nextIdx - 1]).toFixed(2);
            skipText.textContent = `Skip (+${addedTime.replace(/\.?0+$/, '')}s)`;
            btnSkip.disabled = false;
        } else {
            skipText.textContent = "Skip";
            btnSkip.disabled = true;
        }

        // Update Guess Rows
        guessRows.forEach((row, idx) => {
            row.className = "guess-row empty";
            row.querySelector(".guess-text").textContent = "";

            if (state.guesses && state.guesses[idx]) {
                const g = state.guesses[idx];
                if (g.correct) {
                    row.className = "guess-row correct";
                    row.querySelector(".guess-text").textContent = `✓ ${g.track_name} — ${g.artist}`;
                } else if (g.skipped) {
                    row.className = "guess-row skipped";
                    row.querySelector(".guess-text").textContent = "↷ Skipped";
                } else {
                    row.className = "guess-row wrong";
                    row.querySelector(".guess-text").textContent = `✕ ${g.track_name} — ${g.artist}`;
                }
            }
        });

        // If game is over, show reveal modal
        if (state.is_over && state.solution) {
            showRevealModal(state);
        }
    }

    function updateTimelinePlayhead(elapsed) {
        if (!currentRound) return;
        const totalDuration = currentRound.unlocked_seconds;
        
        let cumulative = 0;
        timelineSegments.forEach((seg, idx) => {
            const segTime = currentRound.all_stages[idx];
            const prevTime = idx > 0 ? currentRound.all_stages[idx - 1] : 0;
            const segSpan = segTime - prevTime;
            const fill = seg.querySelector(".fill");

            if (idx < currentRound.attempt) {
                if (elapsed >= segTime) {
                    fill.style.width = "100%";
                } else if (elapsed > prevTime) {
                    const portion = (elapsed - prevTime) / segSpan;
                    fill.style.width = `${portion * 100}%`;
                } else {
                    fill.style.width = "0%";
                }
            } else {
                fill.style.width = "0%";
            }
        });
    }

    function resetTimelineFills() {
        timelineSegments.forEach(seg => {
            const fill = seg.querySelector(".fill");
            fill.style.width = "0%";
        });
    }

    function showSpinner(show) {
        if (show) spinner.classList.remove("hidden");
        else spinner.classList.add("hidden");
    }

    // ----------------- Guessing Actions -----------------
    async function submitCurrentGuess() {
        if (!selectedTrack && !inputGuess.value.trim()) return;

        const guessId = selectedTrack ? selectedTrack.id : "";
        const guessText = inputGuess.value.trim();

        // Clear input & selection
        inputGuess.value = "";
        selectedTrack = null;
        btnClearSearch.classList.add("hidden");
        btnSubmit.disabled = true;
        autocompleteList.classList.add("hidden");

        audio.stop();

        try {
            const res = await fetch("/api/game/guess", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ track_id: guessId, guess_text: guessText })
            });
            const newState = await res.json();
            applyGameState(newState);
            refreshStatus();
        } catch (err) {
            console.error("Failed to submit guess:", err);
        }
    }

    async function skipCurrentAttempt() {
        audio.stop();
        try {
            const res = await fetch("/api/game/skip", { method: "POST" });
            const newState = await res.json();
            applyGameState(newState);
        } catch (err) {
            console.error("Failed to skip:", err);
        }
    }

    async function giveUpRound() {
        audio.stop();
        try {
            const res = await fetch("/api/game/give_up", { method: "POST" });
            const newState = await res.json();
            applyGameState(newState);
            refreshStatus();
        } catch (err) {
            console.error("Failed to give up:", err);
        }
    }

    async function startNextRound() {
        closeModals();
        audio.stop();
        showSpinner(true);
        try {
            const res = await fetch("/api/game/new_round", { method: "POST" });
            const newState = await res.json();
            applyGameState(newState);
            inputGuess.value = "";
            inputGuess.focus();
        } catch (err) {
            console.error("Failed to start new round:", err);
        } finally {
            showSpinner(false);
        }
    }

    // ----------------- Autocomplete Search -----------------
    inputGuess.addEventListener("input", () => {
        const val = inputGuess.value.trim();
        if (val) {
            btnClearSearch.classList.remove("hidden");
        } else {
            btnClearSearch.classList.add("hidden");
            btnSubmit.disabled = true;
            autocompleteList.classList.add("hidden");
            selectedTrack = null;
            return;
        }

        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/game/search?q=${encodeURIComponent(val)}`);
                const data = await res.json();
                renderAutocompleteResults(data.results || []);
            } catch (err) {
                console.error("Search failed:", err);
            }
        }, 150);
    });

    function renderAutocompleteResults(tracks) {
        autocompleteList.innerHTML = "";
        focusedItemIndex = -1;

        if (!tracks.length) {
            autocompleteList.classList.add("hidden");
            return;
        }

        tracks.forEach((t) => {
            const item = document.createElement("div");
            item.className = "autocomplete-item";
            item.innerHTML = `
                <img src="${t.thumbnail_url || t.image_url || ''}" alt="Cover">
                <div class="track-text">
                    <div class="track-title">${t.name}</div>
                    <div class="track-artist">${t.artist}</div>
                </div>
            `;
            item.addEventListener("click", () => {
                selectTrack(t);
            });
            autocompleteList.appendChild(item);
        });

        autocompleteList.classList.remove("hidden");
    }

    function selectTrack(track) {
        selectedTrack = track;
        inputGuess.value = `${track.name} — ${track.artist}`;
        autocompleteList.classList.add("hidden");
        btnSubmit.disabled = false;
        inputGuess.focus();
    }

    btnClearSearch.addEventListener("click", () => {
        inputGuess.value = "";
        selectedTrack = null;
        btnClearSearch.classList.add("hidden");
        btnSubmit.disabled = true;
        autocompleteList.classList.add("hidden");
        inputGuess.focus();
    });

    // ----------------- Reveal Modal & Victory -----------------
    function showRevealModal(state) {
        const track = state.solution;
        shareTextCache = state.share_text || "";

        if (state.is_won) {
            revealStatusIcon.textContent = state.attempt === 1 ? "🤯" : "🎉";
            revealTitle.textContent = state.attempt === 1 ? "0.1s SNIPE! INCREDIBLE!" : "You Got It!";
            revealSubtitle.textContent = `Identified in ${state.unlocked_seconds}s (${state.attempt}/${state.max_attempts} guesses)`;
        } else {
            revealStatusIcon.textContent = "💀";
            revealTitle.textContent = "Nice Try!";
            revealSubtitle.textContent = "Better luck on the next one!";
        }

        revealSongName.textContent = track.name;
        revealArtistName.textContent = track.artist;
        revealAlbumName.textContent = track.album_name || "";
        revealAlbumArt.src = track.image_url || track.thumbnail_url || "";

        // Render emoji grid
        revealEmojiGrid.innerHTML = "";
        if (state.guesses) {
            state.guesses.forEach((g) => {
                const span = document.createElement("span");
                span.textContent = g.correct ? "🟩" : g.skipped ? "⬛" : "🟥";
                revealEmojiGrid.appendChild(span);
            });
            for (let i = state.guesses.length; i < state.max_attempts; i++) {
                const span = document.createElement("span");
                span.textContent = "⬜";
                revealEmojiGrid.appendChild(span);
            }
        }

        modalReveal.classList.remove("hidden");
    }

    btnPlayRevealSong.addEventListener("click", () => {
        audio.playFull();
    });

    btnShare.addEventListener("click", () => {
        if (!shareTextCache) return;
        navigator.clipboard.writeText(shareTextCache).then(() => {
            showToast("Result copied to clipboard! 📋");
        }).catch(() => {
            showToast("Failed to copy to clipboard.");
        });
    });

    btnNextSong.addEventListener("click", startNextRound);

    // ----------------- Playlist / Difficulty Modal -----------------
    const selectedPlaylists = new Map(); // id -> name
    let cachedUserPlaylists = [];
    const multiPlaylistBar = document.getElementById("multi-playlist-bar");
    const mpCountBadge = document.getElementById("mp-count-badge");
    const mpSelectedNames = document.getElementById("mp-selected-names");
    const btnClearPlaylists = document.getElementById("btn-clear-playlists");
    const btnPlayPlaylists = document.getElementById("btn-play-playlists");
    const btnSelectAllPlaylists = document.getElementById("btn-select-all-playlists");

    function updateMultiPlaylistBar() {
        const count = selectedPlaylists.size;
        document.querySelectorAll(".playlist-card[data-playlist-id]").forEach(card => {
            const pid = card.getAttribute("data-playlist-id");
            card.classList.toggle("selected", selectedPlaylists.has(pid));
        });
        if (btnSelectAllPlaylists && cachedUserPlaylists.length > 0) {
            const allSelected = cachedUserPlaylists.every(p => selectedPlaylists.has(p.id));
            btnSelectAllPlaylists.textContent = allSelected ? "Deselect All" : "Select All";
        }
        if (!multiPlaylistBar) return;
        if (count === 0) {
            multiPlaylistBar.classList.add("hidden");
        } else {
            multiPlaylistBar.classList.remove("hidden");
            if (mpCountBadge) mpCountBadge.textContent = String(count);
            const names = Array.from(selectedPlaylists.values());
            if (mpSelectedNames) mpSelectedNames.textContent = names.join(" + ");
            if (btnPlayPlaylists) {
                btnPlayPlaylists.innerHTML = count === 1
                    ? `Play "${names[0]}" &rarr;`
                    : `Play ${count} Playlists &rarr;`;
            }
        }
    }

    function togglePlaylistSelection(id, name) {
        if (selectedPlaylists.has(id)) {
            selectedPlaylists.delete(id);
        } else {
            selectedPlaylists.set(id, name);
            difficultyCards.forEach(c => c.classList.remove("selected"));
        }
        updateMultiPlaylistBar();
    }

    if (btnClearPlaylists) {
        btnClearPlaylists.addEventListener("click", () => {
            selectedPlaylists.clear();
            updateMultiPlaylistBar();
        });
    }

    if (btnSelectAllPlaylists) {
        btnSelectAllPlaylists.addEventListener("click", () => {
            if (!cachedUserPlaylists.length) return;
            const allSelected = cachedUserPlaylists.every(p => selectedPlaylists.has(p.id));
            if (allSelected) {
                cachedUserPlaylists.forEach(p => selectedPlaylists.delete(p.id));
            } else {
                cachedUserPlaylists.forEach(p => selectedPlaylists.set(p.id, p.name));
                difficultyCards.forEach(c => c.classList.remove("selected"));
            }
            updateMultiPlaylistBar();
        });
    }

    if (btnPlayPlaylists) {
        btnPlayPlaylists.addEventListener("click", () => {
            if (selectedPlaylists.size === 0) return;
            playSelectedPlaylists();
        });
    }

    async function openModeModal() {
        modalMode.classList.remove("hidden");
        try {
            const res = await fetch("/api/playlists");
            const data = await res.json();
            cachedUserPlaylists = data.my_playlists || data.playlists || [];
            renderUserPlaylists(cachedUserPlaylists);
            renderCuratedPlaylists(data.curated_playlists || []);
            updateMultiPlaylistBar();
        } catch (err) {
            console.error("Error fetching playlists:", err);
        }
    }

    difficultyCards.forEach(card => {
        card.addEventListener("click", async () => {
            const mode = card.dataset.mode;
            selectedPlaylists.clear();
            updateMultiPlaylistBar();
            difficultyCards.forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");

            closeModals();
            showSpinner(true);
            try {
                const res = await fetch("/api/game/pool", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode: mode })
                });
                const data = await res.json();
                applyGameState(data.round);
                refreshStatus();
            } catch (err) {
                console.error("Failed to set mode:", err);
            } finally {
                showSpinner(false);
            }
        });
    });

    function renderUserPlaylists(playlists) {
        userPlaylistsGrid.innerHTML = "";
        if (!playlists.length) {
            userPlaylistsGrid.innerHTML = `<div class="empty-playlists-note">No playlists created by you found in your account yet.</div>`;
            return;
        }

        playlists.forEach(p => {
            const card = document.createElement("div");
            card.className = "playlist-card" + (selectedPlaylists.has(p.id) ? " selected" : "");
            card.setAttribute("data-playlist-id", p.id);
            card.innerHTML = `
                <img src="${p.image || ''}" alt="Cover">
                <div class="p-info">
                    <div class="p-title">${p.name}</div>
                    <div class="p-count">${p.tracks_count} tracks • By you</div>
                </div>
                <div class="p-check">✓</div>
            `;
            card.addEventListener("click", () => togglePlaylistSelection(p.id, p.name));
            card.addEventListener("dblclick", () => {
                selectedPlaylists.clear();
                selectedPlaylists.set(p.id, p.name);
                updateMultiPlaylistBar();
                playSelectedPlaylists();
            });
            userPlaylistsGrid.appendChild(card);
        });
    }

    function renderCuratedPlaylists(curated) {
        const grid = document.getElementById("curated-playlists-grid");
        if (!grid) return;
        grid.innerHTML = "";
        curated.forEach(p => {
            const card = document.createElement("div");
            card.className = "playlist-card" + (selectedPlaylists.has(p.id) ? " selected" : "");
            card.setAttribute("data-playlist-id", p.id);
            card.innerHTML = `
                <img src="${p.image || ''}" alt="Cover">
                <div class="p-info">
                    <div class="p-title">${p.name}</div>
                    <div class="p-count">${p.desc}</div>
                </div>
                <div class="p-check">✓</div>
            `;
            card.addEventListener("click", () => togglePlaylistSelection(p.id, p.name));
            card.addEventListener("dblclick", () => {
                selectedPlaylists.clear();
                selectedPlaylists.set(p.id, p.name);
                updateMultiPlaylistBar();
                playSelectedPlaylists();
            });
            grid.appendChild(card);
        });
    }

    async function playSelectedPlaylists() {
        const ids = Array.from(selectedPlaylists.keys());
        const names = Array.from(selectedPlaylists.values());
        if (!ids.length) return;
        showSpinner(true);
        try {
            const res = await fetch("/api/game/pool", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: "playlist",
                    playlist_id: ids[0],
                    playlist_name: names[0],
                    playlist_ids: ids,
                    playlist_names: names
                })
            });
            const data = await res.json();
            if (!res.ok || data.success === false) {
                alert(data.error || "Could not load songs for the selected playlists.");
                return;
            }
            closeModals();
            applyGameState(data.round);
            refreshStatus();
            const label = data.pool && data.pool.playlist_name ? data.pool.playlist_name : names.join(" + ");
            const total = data.pool && data.pool.total_tracks ? ` (${data.pool.total_tracks} songs)` : "";
            showToast(`Playing from ${label}${total}!`);
        } catch (err) {
            console.error("Failed to load selected playlists:", err);
            alert("Error loading playlists: " + err);
        } finally {
            showSpinner(false);
        }
    }

    async function selectPlaylist(id, name) {
        selectedPlaylists.clear();
        selectedPlaylists.set(id, name);
        updateMultiPlaylistBar();
        await playSelectedPlaylists();
    }

    const btnLoadCustom = document.getElementById("btn-load-custom-playlist");
    const inputCustom = document.getElementById("input-custom-playlist");
    if (btnLoadCustom && inputCustom) {
        btnLoadCustom.addEventListener("click", async () => {
            const val = inputCustom.value.trim();
            if (!val) return;
            btnLoadCustom.disabled = true;
            btnLoadCustom.textContent = "Loading...";
            try {
                const res = await fetch("/api/playlists/load_custom", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url_or_id: val })
                });
                const data = await res.json();
                if (data.success) {
                    closeModals();
                    applyGameState(data.round);
                    refreshStatus();
                    showToast("Loaded playlist!");
                } else {
                    alert(data.error || "Could not load playlist.");
                }
            } catch (err) {
                alert("Failed to load playlist: " + err);
            } finally {
                btnLoadCustom.disabled = false;
                btnLoadCustom.textContent = "Load & Play";
            }
        });
    }

    // ----------------- Spotify Auth Modal -----------------
    function openAuthModal() {
        if (btnOAuthLogin) btnOAuthLogin.disabled = false;
        if (oauthStatusText) oauthStatusText.textContent = "Sign in securely through your browser in 1 click.";
        modalAuth.classList.remove("hidden");
    }

    // Tabs inside Auth modal
    const tabBtns = document.querySelectorAll(".auth-tabs .tab-btn");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(btn.dataset.tab).classList.add("active");
        });
    });

    const btnOAuthLogin = document.getElementById("btn-oauth-login");
    const oauthStatusText = document.getElementById("oauth-status-text");

    if (btnOAuthLogin) {
        btnOAuthLogin.addEventListener("click", async () => {
            btnOAuthLogin.disabled = true;
            oauthStatusText.textContent = "Opening Spotify in your browser...";
            try {
                const res = await fetch("/api/auth/oauth_start", { method: "POST" });
                const data = await res.json();
                if (data.success && data.already_connected) {
                    oauthStatusText.textContent = "Connected successfully!";
                    await refreshStatus();
                    await loadGameState();
                    closeModals();
                    showToast("Connected to Spotify!");
                    btnOAuthLogin.disabled = false;
                    return;
                }
                if (data.success && data.auth_url) {
                    oauthStatusText.textContent = "Waiting for you to click 'Agree' in Spotify...";

                    if (authPollingInterval) clearInterval(authPollingInterval);
                    authPollingInterval = setInterval(async () => {
                        const sRes = await fetch("/api/status");
                        const sData = await sRes.json();
                        if (sData.connected) {
                            clearInterval(authPollingInterval);
                            oauthStatusText.textContent = "Connected successfully!";
                            await refreshStatus();
                            await loadGameState();
                            closeModals();
                            showToast("Connected to Spotify!");
                            btnOAuthLogin.disabled = false;
                        }
                    }, 1200);
                } else {
                    oauthStatusText.textContent = "Could not start authorization flow.";
                    btnOAuthLogin.disabled = false;
                }
            } catch (err) {
                oauthStatusText.textContent = "Connection error: " + err;
                btnOAuthLogin.disabled = false;
            }
        });
    }

    btnStartZeroconf.addEventListener("click", async () => {
        zcBtnText.textContent = "Advertising 'Songless Guessing Game'...";
        btnStartZeroconf.disabled = true;
        zcStatusText.textContent = "Listening on network... Check Spotifast -> Devices!";

        try {
            const res = await fetch("/api/auth/start_zeroconf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ device_name: "Songless Guessing Game" })
            });
            const data = await res.json();
            if (data.success) {
                // Poll for connection
                if (authPollingInterval) clearInterval(authPollingInterval);
                authPollingInterval = setInterval(async () => {
                    const sRes = await fetch("/api/status");
                    const sData = await sRes.json();
                    if (sData.connected) {
                        clearInterval(authPollingInterval);
                        zcStatusText.textContent = `Connected as ${sData.display_name || sData.username}! 🎉`;
                        showToast("Successfully authenticated with Spotify! 🚀");
                        refreshStatus();
                        loadGameState();
                        setTimeout(closeModals, 1200);
                    }
                }, 1500);
            }
        } catch (err) {
            zcStatusText.textContent = "Error starting Zeroconf receiver.";
            btnStartZeroconf.disabled = false;
        }
    });

    formUserPass.addEventListener("submit", async (e) => {
        e.preventDefault();
        const user = authUsername.value.trim();
        const pass = authPassword.value;
        if (!user || !pass) return;

        upStatusText.textContent = "Logging into Spotify...";
        try {
            const res = await fetch("/api/auth/login_user_pass", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: user, password: pass })
            });
            const data = await res.json();
            if (data.success) {
                upStatusText.textContent = "Logged in successfully! 🎉";
                showToast("Connected to Spotify!");
                refreshStatus();
                loadGameState();
                setTimeout(closeModals, 1000);
            } else {
                upStatusText.textContent = `Error: ${data.error || "Login failed"}`;
            }
        } catch (err) {
            upStatusText.textContent = "Network error during login.";
        }
    });

    btnLogout.addEventListener("click", async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        showToast("Logged out from Spotify.");
        refreshStatus();
        loadGameState();
        closeModals();
    });

    // ----------------- Stats Modal -----------------
    async function openStatsModal() {
        modalStats.classList.remove("hidden");
        try {
            const res = await fetch("/api/status");
            const data = await res.json();

            if (data.version) {
                if (window.__CURRENT_APP_VERSION__ && window.__CURRENT_APP_VERSION__ !== data.version) {
                    console.log("New app version detected, reloading...");
                    window.location.reload();
                    return;
                }
                window.__CURRENT_APP_VERSION__ = data.version;
            }
            const stats = data.game_stats || {};

            document.getElementById("stat-played").textContent = stats.played || 0;
            const winRate = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
            document.getElementById("stat-winrate").textContent = `${winRate}%`;
            document.getElementById("stat-streak").textContent = stats.current_streak || 0;
            document.getElementById("stat-best-streak").textContent = stats.best_streak || 0;

            renderStatsChart(stats.distribution || {});
        } catch (err) {
            console.error("Failed to load stats:", err);
        }
    }

    function renderStatsChart(dist) {
        const container = document.getElementById("stats-distribution-chart");
        container.innerHTML = "";
        const maxVal = Math.max(...Object.values(dist), 1);
        const stages = ["0.1s", "0.25s", "0.5s", "1s", "2s", "5s"];

        stages.forEach((label, idx) => {
            const count = dist[String(idx + 1)] || 0;
            const pct = Math.max((count / maxVal) * 100, 6);

            const row = document.createElement("div");
            row.className = "chart-row";
            row.innerHTML = `
                <span class="label">${label}</span>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill" style="width: ${pct}%">${count}</div>
                </div>
            `;
            container.appendChild(row);
        });
    }

    // ----------------- Modal Utility -----------------
    function closeModals() {
        document.querySelectorAll(".modal-overlay").forEach(m => m.classList.add("hidden"));
    }

    document.querySelectorAll(".modal-close-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const modalId = btn.dataset.modal;
            if (modalId) document.getElementById(modalId).classList.add("hidden");
        });
    });

    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                overlay.classList.add("hidden");
            }
        });
    });

    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.remove("hidden");
        setTimeout(() => toast.classList.add("hidden"), 2500);
    }

    // ----------------- Global Event Listeners -----------------
    function setupEventListeners() {
        // Play snippet button
        btnPlay.addEventListener("click", () => {
            if (currentRound) {
                audio.toggle(currentRound.unlocked_seconds);
            }
        });

        // Submit & Skip & Give Up
        btnSubmit.addEventListener("click", submitCurrentGuess);
        btnSkip.addEventListener("click", skipCurrentAttempt);
        btnGiveUp.addEventListener("click", giveUpRound);

        // Header Modals
        document.getElementById("btn-open-mode").addEventListener("click", openModeModal);
        document.getElementById("btn-open-stats").addEventListener("click", openStatsModal);
        document.getElementById("btn-open-auth").addEventListener("click", openAuthModal);

        // Keyboard Shortcuts
        window.addEventListener("keydown", (e) => {
            // Spacebar: Play snippet (if not typing in text input)
            if (e.code === "Space" && document.activeElement !== inputGuess && !isAnyModalOpen()) {
                e.preventDefault();
                if (currentRound) {
                    audio.toggle(currentRound.unlocked_seconds);
                }
            }

            // Enter key
            if (e.code === "Enter") {
                if (modalReveal && !modalReveal.classList.contains("hidden")) {
                    startNextRound();
                    return;
                }
                if (document.activeElement === inputGuess) {
                    if (selectedTrack || inputGuess.value.trim()) {
                        submitCurrentGuess();
                    }
                }
            }

            // Escape key closes modals / dropdown
            if (e.code === "Escape") {
                closeModals();
                autocompleteList.classList.add("hidden");
            }
        });
    }

    function isAnyModalOpen() {
        return !!document.querySelector(".modal-overlay:not(.hidden)");
    }

    // Launch App
    init();
});
