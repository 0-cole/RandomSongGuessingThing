/**
 * Songless (Spotify Edition) Client Application Controller
 */

/**
 * ⚠️ HEY AI AGENT! Editing this script?
 * 1. Stop! Read spotiless_context.md & rules first!
 * 2. Strict Fast-Path Budget: Capped at 1–2 tool calls total (Read -> Edit -> Done).
 * 3. DO NOT wander or do incremental reads. Make direct edits cleanly.
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
    const navCounterPill = document.getElementById("nav-counter-pill");
    const songCounterCurrent = document.getElementById("song-counter-current");
    const songCounterTotal = document.getElementById("song-counter-total");
    const songCounterPoolLabel = document.getElementById("song-counter-pool-label");
    const songProgressPct = document.getElementById("song-progress-pct");
    const songProgressFill = document.getElementById("song-progress-fill");
    const progressScorePill = document.getElementById("progress-score-pill");
    const authStatusDot = document.getElementById("auth-status-dot");
    const authUsernameLabel = document.getElementById("auth-username-label");
    const toast = document.getElementById("toast");
    const btnThemeToggle = document.getElementById("btn-theme-toggle");
    const iconThemeSun = document.getElementById("icon-theme-sun");
    const iconThemeMoon = document.getElementById("icon-theme-moon");

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
    const revealProgressLabel = document.getElementById("reveal-progress-label");
    const revealProgressScore = document.getElementById("reveal-progress-score");
    const revealProgressFill = document.getElementById("reveal-progress-fill");
    const revealCompletionBanner = document.getElementById("reveal-completion-banner");
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
    let isCloudMode = false;

    // ----------------- Cloud Standalone Mode Engine -----------------
    const CloudGameManager = {
        tracks: [],
        currentIndex: 0,
        stages: [0.1, 0.25, 0.5, 1.0, 2.0, 5.0],
        attemptIndex: 0,
        guesses: [],
        isWon: false,
        isOver: false,
        stats: {
            played: 0,
            won: 0,
            current_streak: 0,
            best_streak: 0,
            distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 }
        },

        init: async function() {
            try {
                const res = await fetch("cloud_tracks.json");
                if (res.ok) {
                    this.tracks = await res.json();
                }
            } catch (e) {
                console.warn("Failed to load cloud_tracks.json:", e);
            }

            try {
                const savedStats = localStorage.getItem("spotiless_cloud_stats");
                if (savedStats) this.stats = JSON.parse(savedStats);
            } catch (e) {}

            try {
                const savedIdx = localStorage.getItem("spotiless_cloud_index");
                if (savedIdx !== null) this.currentIndex = parseInt(savedIdx, 10) || 0;
            } catch (e) {}

            this.resetRound();
        },

        saveStats: function() {
            try {
                localStorage.setItem("spotiless_cloud_stats", JSON.stringify(this.stats));
                localStorage.setItem("spotiless_cloud_index", String(this.currentIndex));
            } catch (e) {}
        },

        resetRound: function() {
            this.attemptIndex = 0;
            this.guesses = [];
            this.isWon = false;
            this.isOver = false;
        },

        getCurrentTrack: function() {
            if (!this.tracks.length) return null;
            return this.tracks[this.currentIndex % this.tracks.length];
        },

        getState: function() {
            const track = this.getCurrentTrack();
            const total = this.tracks.length || 1;
            const songIdx = (this.currentIndex % total) + 1;
            const unlockedSec = this.stages[Math.min(this.attemptIndex, this.stages.length - 1)];

            const state = {
                active: true,
                round_id: track ? track.id : "cloud_demo",
                attempt: this.attemptIndex + 1,
                max_attempts: this.stages.length,
                unlocked_seconds: unlockedSec,
                all_stages: this.stages,
                guesses: this.guesses,
                is_won: this.isWon,
                is_over: this.isOver,
                pool_name: "🔥 Spoti-Less Top Hits (Cloud)",
                total_songs: total,
                song_index: songIdx,
                session_won: this.stats.won,
                session_played: this.stats.played,
                preview_query: track ? `${track.artist} ${track.name}` : ""
            };

            if (this.isOver && track) {
                state.solution = track;
                let emojiRow = "";
                this.guesses.forEach(g => {
                    emojiRow += g.correct ? "🟩" : g.skipped ? "⬛" : "🟥";
                });
                for (let i = this.guesses.length; i < this.stages.length; i++) {
                    emojiRow += "⬜";
                }
                const scoreText = this.isWon ? `${this.attemptIndex + 1}/${this.stages.length}` : "X/6";
                state.share_text = `Spoti-Less #${songIdx} ${scoreText}\n🔊 ${unlockedSec}s\n${emojiRow}\nhttps://github.com/0-cole/RandomSongGuessingThing`;
            }

            return state;
        },

        submitGuess: function(trackId, text) {
            if (this.isOver) return this.getState();
            const track = this.getCurrentTrack();
            if (!track) return this.getState();

            const normGuess = (text || "").toLowerCase().trim();
            const normTitle = track.name.toLowerCase().trim();
            const normArtist = track.artist.toLowerCase().trim();

            let isMatch = false;
            if (trackId && trackId === track.id) {
                isMatch = true;
            } else if (normGuess) {
                if (normGuess.includes(normTitle) || normTitle.includes(normGuess)) {
                    isMatch = true;
                }
            }

            this.guesses.push({
                attempt: this.attemptIndex + 1,
                unlocked_seconds: this.stages[this.attemptIndex],
                correct: isMatch,
                skipped: false,
                track_name: isMatch ? track.name : text,
                artist: isMatch ? track.artist : ""
            });

            if (isMatch) {
                this.isWon = true;
                this.isOver = true;
                this.stats.played++;
                this.stats.won++;
                this.stats.current_streak++;
                if (this.stats.current_streak > this.stats.best_streak) {
                    this.stats.best_streak = this.stats.current_streak;
                }
                const stageKey = String(this.attemptIndex + 1);
                this.stats.distribution[stageKey] = (this.stats.distribution[stageKey] || 0) + 1;
                this.saveStats();
            } else {
                this.attemptIndex++;
                if (this.attemptIndex >= this.stages.length) {
                    this.isOver = true;
                    this.stats.played++;
                    this.stats.current_streak = 0;
                    this.saveStats();
                }
            }

            return this.getState();
        },

        skip: function() {
            if (this.isOver) return this.getState();
            this.guesses.push({
                attempt: this.attemptIndex + 1,
                unlocked_seconds: this.stages[this.attemptIndex],
                correct: false,
                skipped: true,
                track_name: "Skipped",
                artist: ""
            });

            this.attemptIndex++;
            if (this.attemptIndex >= this.stages.length) {
                this.isOver = true;
                this.stats.played++;
                this.stats.current_streak = 0;
                this.saveStats();
            }

            return this.getState();
        },

        giveUp: function() {
            if (this.isOver) return this.getState();
            this.isOver = true;
            this.stats.played++;
            this.stats.current_streak = 0;
            this.saveStats();
            return this.getState();
        },

        nextRound: function() {
            this.currentIndex++;
            this.resetRound();
            this.saveStats();
            return this.getState();
        },

        search: function(query) {
            const q = query.toLowerCase().trim();
            if (!q) return [];
            return this.tracks.filter(t => 
                t.name.toLowerCase().includes(q) || 
                t.artist.toLowerCase().includes(q)
            ).slice(0, 8);
        }
    };

    // ----------------- Audio & Visualizer Setup -----------------
    const playOverlaySvg = `<svg viewBox="0 0 24 24" width="36" height="36"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>`;
    const pauseOverlaySvg = `<svg viewBox="0 0 24 24" width="36" height="36"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

    audio.onPlayStart = (duration) => {
        btnPlay.classList.add("playing");
        iconPlay.classList.add("hidden");
        iconPause.classList.remove("hidden");
        if (btnPlayRevealSong) {
            btnPlayRevealSong.innerHTML = pauseOverlaySvg;
            btnPlayRevealSong.title = "Pause Preview";
        }
    };

    audio.onPlayProgress = (progress, elapsed) => {
        labelPlaybackTime.textContent = `${elapsed.toFixed(1)}s`;
        updateTimelinePlayhead(elapsed);
    };

    audio.onPlayEnd = () => {
        btnPlay.classList.remove("playing");
        iconPlay.classList.remove("hidden");
        iconPause.classList.add("hidden");
        if (btnPlayRevealSong) {
            btnPlayRevealSong.innerHTML = playOverlaySvg;
            btnPlayRevealSong.title = "Play Song Preview";
        }
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
    // ----------------- Theme Management -----------------
    function initTheme() {
        const savedTheme = localStorage.getItem("spotiless_theme") || "dark";
        applyTheme(savedTheme);
    }

    function applyTheme(theme) {
        if (theme === "light") {
            document.body.classList.remove("dark-theme");
            document.body.classList.add("light-theme");
            document.documentElement.classList.remove("dark-theme");
            document.documentElement.classList.add("light-theme");
            if (iconThemeSun) iconThemeSun.classList.add("hidden");
            if (iconThemeMoon) iconThemeMoon.classList.remove("hidden");
            if (btnThemeToggle) btnThemeToggle.title = "Switch to Dark Mode";
        } else {
            document.body.classList.remove("light-theme");
            document.body.classList.add("dark-theme");
            document.documentElement.classList.remove("light-theme");
            document.documentElement.classList.add("dark-theme");
            if (iconThemeSun) iconThemeSun.classList.remove("hidden");
            if (iconThemeMoon) iconThemeMoon.classList.add("hidden");
            if (btnThemeToggle) btnThemeToggle.title = "Switch to Light Mode";
        }
        try {
            localStorage.setItem("spotiless_theme", theme);
        } catch (e) {}
    }

    function showLightModePaywallJoke() {
        const existing = document.getElementById("lightmode-paywall-overlay");
        if (existing) existing.remove();

        const overlay = document.createElement("div");
        overlay.id = "lightmode-paywall-overlay";
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.82);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            padding: 20px;
            box-sizing: border-box;
            transition: background 3s ease;
        `;

        const modalBox = document.createElement("div");
        modalBox.id = "lightmode-paywall-box";
        modalBox.style.cssText = `
            background: linear-gradient(150deg, #1c1c1f, #28282e);
            border: 2px solid #ffd700;
            border-radius: 18px;
            max-width: 400px;
            width: 100%;
            padding: 28px 24px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.85), 0 0 30px rgba(255, 215, 0, 0.25);
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            position: relative;
            text-align: center;
            box-sizing: border-box;
            animation: paywallPop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        `;

        modalBox.innerHTML = `
            <button id="paywall-btn-close" aria-label="Close" style="
                position: absolute;
                top: 14px;
                right: 14px;
                background: rgba(255,255,255,0.08);
                border: 1px solid rgba(255,255,255,0.15);
                color: #ddd;
                font-size: 16px;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                line-height: 1;
                transition: background 0.15s, transform 0.15s;
            ">✕</button>
            <div style="font-size: 44px; margin-bottom: 8px;">☀️🔒</div>
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #ffd700; font-weight: 800; margin-bottom: 6px;">Spotiless Platinum VIP™</div>
            <h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 800; color: #ffffff;">Unlock Light Mode</h2>
            <p style="margin: 0 0 16px 0; font-size: 13.5px; color: #a5a5ad; line-height: 1.45;">
                Light mode requires ultra-luminescent photon servers and optical cornea certification.
            </p>
            <div style="background: rgba(255, 215, 0, 0.08); border: 1px dashed rgba(255, 215, 0, 0.45); border-radius: 12px; padding: 14px; margin-bottom: 20px;">
                <div style="font-size: 28px; font-weight: 900; color: #ffd700; font-family: monospace;">$4.99 <span style="font-size: 13px; font-weight: normal; color: #bbb;">/ month</span></div>
                <div style="font-size: 11.5px; color: #aaa; margin-top: 4px;">Includes 100% genuine flashbang simulation</div>
            </div>
            <button id="paywall-btn-pay" style="
                width: 100%;
                padding: 14px 20px;
                border-radius: 30px;
                background: linear-gradient(90deg, #ffd700, #ff9900);
                border: none;
                color: #121212;
                font-weight: 800;
                font-size: 15px;
                letter-spacing: 0.5px;
                cursor: pointer;
                box-shadow: 0 6px 20px rgba(255, 170, 0, 0.4);
                transition: transform 0.1s, filter 0.15s;
            ">Tap to pay now</button>
        `;

        overlay.appendChild(modalBox);
        document.body.appendChild(overlay);

        let triggered = false;
        function executePrank() {
            if (triggered) return;
            triggered = true;

            // 1. Instantly switch to light mode the moment the text appears
            applyTheme("light");

            // 2. Clear modal content and display shitty Comic Sans text
            overlay.innerHTML = "";
            const jokeText = document.createElement("div");
            jokeText.textContent = "just kidding lmao";
            jokeText.style.cssText = `
                font-family: "Comic Sans MS", "Comic Sans", cursive, sans-serif !important;
                font-size: clamp(2.4rem, 6vw, 4.2rem);
                font-weight: 900;
                color: #ff007f;
                text-shadow: 3px 3px 0 #ffff00, -2px -2px 0 #00ffff;
                text-align: center;
                pointer-events: none;
                user-select: none;
                opacity: 1;
                transform: rotate(-3deg);
                transition: opacity 3s cubic-bezier(0.4, 0, 0.2, 1);
            `;
            overlay.appendChild(jokeText);

            // Trigger reflow for clean transition
            void jokeText.offsetWidth;

            // 3. Fade away over the course of 3 seconds
            jokeText.style.opacity = "0";
            overlay.style.background = "rgba(0, 0, 0, 0)";
            overlay.style.pointerEvents = "none";

            // 4. Remove overlay element after 3 seconds
            setTimeout(() => {
                overlay.remove();
            }, 3000);
        }

        const btnClose = modalBox.querySelector("#paywall-btn-close");
        const btnPay = modalBox.querySelector("#paywall-btn-pay");

        if (btnClose) {
            btnClose.addEventListener("click", (e) => {
                e.stopPropagation();
                executePrank();
            });
        }

        if (btnPay) {
            btnPay.addEventListener("click", (e) => {
                e.stopPropagation();
                executePrank();
            });
        }
    }

    function toggleTheme() {
        const isLight = document.body.classList.contains("light-theme");
        if (isLight) {
            applyTheme("dark");
        } else {
            showLightModePaywallJoke();
        }
    }

    async function init() {
        initTheme();
        try {
            const testRes = await fetch("/api/status");
            if (!testRes.ok) throw new Error("No backend");
            await refreshStatus();
            await loadGameState();
            setInterval(refreshStatus, 3000);
        } catch (err) {
            console.log("Starting Spoti-Less in Cloud Standalone Mode ☁️");
            isCloudMode = true;
            await CloudGameManager.init();
            refreshStatus();
            loadGameState();
        }
    }

    function checkAccountState() {
        const acc = getStoredAccount();
        const cookie = localStorage.getItem("spotiless_sp_dc");
        const guest = sessionStorage.getItem("spotiless_guest_session");

        const userTierBadge = document.getElementById("user-tier-badge");
        const spotifyLinkPill = document.getElementById("spotify-link-pill");
        const boxSpotifyUnlinked = document.getElementById("box-spotify-unlinked");
        const boxSpotifyLinked = document.getElementById("box-spotify-linked");
        const userPlaylistsStatusMsg = document.getElementById("user-playlists-status-msg");

        if (cookie) {
            if (userTierBadge) {
                userTierBadge.textContent = "Spotify Linked 🍪";
                userTierBadge.style.background = "var(--color-spotify)";
                userTierBadge.style.color = "#000";
            }
            if (spotifyLinkPill) {
                spotifyLinkPill.textContent = "✓ Connected";
                spotifyLinkPill.style.background = "rgba(29, 185, 84, 0.2)";
                spotifyLinkPill.style.color = "var(--color-spotify)";
            }
            if (boxSpotifyUnlinked) boxSpotifyUnlinked.classList.add("hidden");
            if (boxSpotifyLinked) boxSpotifyLinked.classList.remove("hidden");
            if (userPlaylistsStatusMsg) {
                userPlaylistsStatusMsg.innerHTML = '<p style="margin: 0 0 6px 0; font-weight: 700; color: #fff; font-size: 0.9rem;">Spotify Linked 🍪</p><p style="margin: 0 0 12px 0; font-size: 0.8rem; color: var(--color-text-muted);">Paste any playlist URL above to load songs instantly, or run desktop native mode to sync your created playlists.</p>';
            }
        } else {
            if (userTierBadge) {
                userTierBadge.textContent = (acc && acc.username) ? "Spotify Not Linked" : "Guest";
                userTierBadge.style.background = "rgba(255, 255, 255, 0.15)";
                userTierBadge.style.color = "#ddd";
            }
            if (spotifyLinkPill) {
                spotifyLinkPill.textContent = "Not Linked";
                spotifyLinkPill.style.background = "rgba(255, 107, 107, 0.2)";
                spotifyLinkPill.style.color = "#ff6b6b";
            }
            if (boxSpotifyUnlinked) boxSpotifyUnlinked.classList.remove("hidden");
            if (boxSpotifyLinked) boxSpotifyLinked.classList.add("hidden");
            if (userPlaylistsStatusMsg) {
                userPlaylistsStatusMsg.innerHTML = '<p style="margin: 0 0 6px 0; font-weight: 700; color: #fff; font-size: 0.9rem;">No Spotify Account Linked</p><p style="margin: 0 0 12px 0; font-size: 0.8rem; color: var(--color-text-muted);">Connect your Spotify account to load and play your personal playlists here.</p><button type="button" class="btn btn-primary btn-sm" onclick="document.getElementById(\'modal-mode\').classList.add(\'hidden\'); document.getElementById(\'modal-auth\').classList.remove(\'hidden\');" style="font-weight: 800; font-size: 0.8rem;">🔗 Connect Spotify Account</button>';
            }
        }

        if (acc && acc.username) {
            authStatusDot.className = "dot-connected";
            authUsernameLabel.textContent = acc.username;
            if (userNameDisplay) userNameDisplay.textContent = acc.username;
            if (authConnectedView) authConnectedView.classList.remove("hidden");
            const unconnected = document.getElementById("auth-unconnected-view");
            if (unconnected) unconnected.classList.add("hidden");
        } else if (cookie) {
            authStatusDot.className = "dot-connected";
            authUsernameLabel.textContent = "Spotify Linked 🍪";
            if (userNameDisplay) userNameDisplay.textContent = "Spotify Cookie Linked";
            if (authConnectedView) authConnectedView.classList.remove("hidden");
            const unconnected = document.getElementById("auth-unconnected-view");
            if (unconnected) unconnected.classList.add("hidden");
        } else {
            authStatusDot.className = "dot-disconnected";
            authUsernameLabel.textContent = "Connect Spotify";
            if (authConnectedView) authConnectedView.classList.add("hidden");
            const unconnected = document.getElementById("auth-unconnected-view");
            if (unconnected) unconnected.classList.remove("hidden");

            // First visit prompt if not guest
            if (!guest && !acc && !cookie) {
                modalAuth.classList.remove("hidden");
            }
        }
    }

    function getStoredAccount() {
        try {
            const raw = localStorage.getItem("spotiless_account");
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    async function refreshStatus() {
        if (isCloudMode) {
            authStatusDot.className = "dot-connected";
            authUsernameLabel.textContent = "Cloud Mode";
            streakCounter.textContent = CloudGameManager.stats.current_streak || 0;
            activePoolLabel.textContent = "🔥 Spoti-Less Hits";
            if (navCounterPill) {
                const total = CloudGameManager.tracks.length || 1;
                const idx = (CloudGameManager.currentIndex % total) + 1;
                navCounterPill.textContent = `${idx}/${total}`;
            }
            return;
        }
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
                if (data.image && userAvatar) userAvatar.src = data.image;
                if (userNameDisplay) userNameDisplay.textContent = data.display_name || data.username;
                if (authConnectedView) authConnectedView.classList.remove("hidden");
                const unconnected = document.getElementById("auth-unconnected-view");
                if (unconnected) unconnected.classList.add("hidden");
            } else {
                // Not connected via backend Librespot session: sync with local account/cookie state
                checkAccountState();
            }

            // Update stats & pool
            if (data.game_stats) {
                streakCounter.textContent = data.game_stats.current_streak || 0;
            }
            if (data.active_pool) {
                activePoolLabel.textContent = data.active_pool.name || "🔥 Heavy Rotation";
                if (navCounterPill && data.active_pool.total_tracks) {
                    const idx = data.active_pool.song_index || 1;
                    navCounterPill.textContent = `${idx}/${data.active_pool.total_tracks}`;
                }
            }
        } catch (err) {
            console.error("Status check failed:", err);
        }
    }

    async function loadGameState() {
        if (isCloudMode) {
            applyGameState(CloudGameManager.getState());
            return;
        }
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
        const audioFallback = state.solution ? `${state.solution.artist} ${state.solution.name}` : (state.preview_query || "");
        audio.loadTrack(state.round_id, audioFallback).then((ok) => {
            showSpinner(false);
            if (!ok) {
                console.warn("Audio snippet preview unavailable or waiting for interaction:", state.round_id);
            }
        });

        // Update labels
        labelPlaybackTime.textContent = `${state.unlocked_seconds}s`;
        if (state.pool_name) {
            activePoolLabel.textContent = state.pool_name;
        }

        // Update playlist progress & song counter
        const songIdx = state.song_index || 1;
        const totalSongs = state.total_songs || state.pool_size || 1;
        const pct = Math.min(100, Math.max(1, Math.round((songIdx / totalSongs) * 100)));

        if (songCounterCurrent) songCounterCurrent.textContent = songIdx;
        if (songCounterTotal) songCounterTotal.textContent = totalSongs;
        if (songCounterPoolLabel) songCounterPoolLabel.textContent = state.pool_name || "🔥 Heavy Rotation";
        if (songProgressPct) songProgressPct.textContent = `${pct}% Done`;
        if (songProgressFill) songProgressFill.style.width = `${pct}%`;
        if (navCounterPill) navCounterPill.textContent = `${songIdx}/${totalSongs}`;

        if (progressScorePill) {
            if (typeof state.session_played === "number" && state.session_played > 0) {
                progressScorePill.textContent = `${state.session_won || 0}/${state.session_played} won`;
            } else {
                progressScorePill.textContent = `0 won`;
            }
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

        if (isCloudMode) {
            const newState = CloudGameManager.submitGuess(guessId, guessText);
            applyGameState(newState);
            refreshStatus();
            return;
        }

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
        if (isCloudMode) {
            const newState = CloudGameManager.skip();
            applyGameState(newState);
            return;
        }
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
        if (isCloudMode) {
            const newState = CloudGameManager.giveUp();
            applyGameState(newState);
            refreshStatus();
            return;
        }
        try {
            const res = await fetch("/api/game/give_up", { method: "POST" });
            const newState = await res.json();
            applyGameState(newState);
            refreshStatus();
        } catch (err) {
            console.error("Failed to give up:", err);
        }
    }

    let isTransitioningRound = false;

    async function startNextRound() {
        if (isTransitioningRound) return;
        isTransitioningRound = true;
        if (btnNextSong) btnNextSong.disabled = true;

        if (revealAlbumArt) {
            revealAlbumArt.classList.remove("pulse");
            const cw = revealAlbumArt.closest(".cover-wrapper");
            if (cw) cw.classList.remove("pulse");
        }

        // Smoothly fade out the currently playing song before transitioning to the next song
        const fadePromise = audio.isPlaying ? audio.fadeOut(0.8) : Promise.resolve();

        if (isCloudMode) {
            await fadePromise;
            closeModals();
            const newState = CloudGameManager.nextRound();
            applyGameState(newState);
            inputGuess.value = "";
            inputGuess.focus();
            if (btnNextSong) btnNextSong.disabled = false;
            isTransitioningRound = false;
            return;
        }
        showSpinner(true);

        try {
            const resPromise = fetch("/api/game/new_round", { method: "POST" });
            const [_, res] = await Promise.all([fadePromise, resPromise]);
            closeModals();
            const newState = await res.json();
            applyGameState(newState);
            inputGuess.value = "";
            inputGuess.focus();
        } catch (err) {
            console.error("Failed to start new round:", err);
            closeModals();
        } finally {
            showSpinner(false);
            if (btnNextSong) btnNextSong.disabled = false;
            isTransitioningRound = false;
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
            if (isCloudMode) {
                renderAutocompleteResults(CloudGameManager.search(val));
                return;
            }
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

        const coverWrapper = revealAlbumArt ? revealAlbumArt.closest(".cover-wrapper") : null;

        if (state.is_won) {
            revealStatusIcon.textContent = state.attempt === 1 ? "🤯" : "🎉";
            revealTitle.textContent = state.attempt === 1 ? "0.1s SNIPE! INCREDIBLE!" : "You Got It!";
            revealSubtitle.textContent = `Identified in ${state.unlocked_seconds}s (${state.attempt}/${state.max_attempts} guesses)`;

            // Subtle pulsing animation on album artwork upon correct guess
            if (revealAlbumArt) revealAlbumArt.classList.add("pulse");
            if (coverWrapper) coverWrapper.classList.add("pulse");

            // Auto-play the whole song when guessed right until pressing Next
            setTimeout(() => {
                if (modalReveal && !modalReveal.classList.contains("hidden")) {
                    audio.playFull(false, true);
                }
            }, 60);
        } else {
            if (revealAlbumArt) revealAlbumArt.classList.remove("pulse");
            if (coverWrapper) coverWrapper.classList.remove("pulse");
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

        // Update reveal progress & counter
        const songIdx = state.song_index || 1;
        const totalSongs = state.total_songs || state.pool_size || 1;
        const pct = Math.min(100, Math.max(1, Math.round((songIdx / totalSongs) * 100)));

        if (revealProgressLabel) {
            revealProgressLabel.textContent = `Song ${songIdx} of ${totalSongs} • ${state.pool_name || "Playlist"}`;
        }
        if (revealProgressScore) {
            revealProgressScore.textContent = `${state.session_won || 0}/${state.session_played || 1} won`;
        }
        if (revealProgressFill) {
            revealProgressFill.style.width = `${pct}%`;
        }

        if (revealCompletionBanner) {
            if (state.playlist_completed) {
                revealCompletionBanner.classList.remove("hidden");
                revealCompletionBanner.innerHTML = `🏆 <strong>Playlist Completed!</strong> You solved <strong>${state.session_won || 0} / ${totalSongs}</strong> songs!`;
                if (btnNextSong) btnNextSong.querySelector("span").textContent = `Restart / Play Again (1 / ${totalSongs}) ↺`;
            } else {
                revealCompletionBanner.classList.add("hidden");
                const nextIdx = Math.min(totalSongs, songIdx + 1);
                if (btnNextSong) btnNextSong.querySelector("span").textContent = `Next Song (${nextIdx} / ${totalSongs}) →`;
            }
        }

        modalReveal.classList.remove("hidden");
    }

    btnPlayRevealSong.addEventListener("click", () => {
        if (audio.isPlaying) {
            audio.stop();
        } else {
            audio.playFull(false, true);
        }
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
    let isSignUpMode = true;

    function openAuthModal() {
        modalAuth.classList.remove("hidden");
    }

    // Tabs inside Auth modal
    const tabBtns = document.querySelectorAll(".auth-tabs .tab-btn");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            btn.classList.add("active");
            const target = document.getElementById(btn.dataset.tab);
            if (target) target.classList.add("active");
        });
    });

    // Account Creation / Sign In form
    const formLocalAccount = document.getElementById("form-local-account");
    const accUserInput = document.getElementById("acc-username-input");
    const accPassInput = document.getElementById("acc-password-input");
    const btnToggleAccountMode = document.getElementById("btn-toggle-account-mode");
    const formAccTitle = document.getElementById("form-acc-title");
    const btnSubmitAccount = document.getElementById("btn-submit-account");

    if (btnToggleAccountMode) {
        btnToggleAccountMode.addEventListener("click", (e) => {
            if (e) e.preventDefault();
            isSignUpMode = !isSignUpMode;
            if (isSignUpMode) {
                if (formAccTitle) formAccTitle.textContent = "Create Your Permanent Account";
                if (btnSubmitAccount) btnSubmitAccount.textContent = "Create Permanent Account & Play";
                btnToggleAccountMode.textContent = "Already have an account? Sign In";
            } else {
                if (formAccTitle) formAccTitle.textContent = "Sign In to Your Account";
                if (btnSubmitAccount) btnSubmitAccount.textContent = "Sign In & Play";
                btnToggleAccountMode.textContent = "Need an account? Sign Up";
            }
        });
    }

    if (formLocalAccount) {
        formLocalAccount.addEventListener("submit", (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById("acc-username-input");
            const passwordInput = document.getElementById("acc-password-input");
            const u = (usernameInput?.value || "").trim();
            const p = (passwordInput?.value || "").trim();
            if (!u || !p) {
                showToast("Please enter a username and password");
                return;
            }
            try {
                if (!isSignUpMode) {
                    // Sign In: save account, sync UI, and close modal
                    localStorage.setItem("spotiless_account", JSON.stringify({ username: u, logged_in_at: Date.now() }));
                    checkAccountState();
                    showToast(`Signed in as ${u}! 🎉`);
                    closeModals();
                    return;
                }

                // Sign Up: save account, sync UI, guide to Spotify linking
                localStorage.setItem("spotiless_account", JSON.stringify({ username: u, created_at: Date.now() }));
                checkAccountState();
                showToast(`Welcome, ${u}! Link Spotify below to sync your playlists.`);
                const welcomeBanner = document.getElementById("account-welcome-banner");
                if (welcomeBanner) welcomeBanner.classList.remove("hidden");
                const inputSpdc = document.getElementById("input-connected-cookie-spdc");
                if (inputSpdc) {
                    setTimeout(() => inputSpdc.focus(), 300);
                }
            } catch (err) {
                showToast("Failed to save account");
            }
        });
    }

    // Cookie Linking
    const inputCookieSpdc = document.getElementById("input-cookie-spdc");
    const btnSaveCookie = document.getElementById("btn-save-cookie");
    const btnSaveConnectedCookie = document.getElementById("btn-save-connected-cookie");
    const inputConnectedCookieSpdc = document.getElementById("input-connected-cookie-spdc");
    const btnUnlinkSpotify = document.getElementById("btn-unlink-spotify");

    if (btnSaveConnectedCookie) {
        btnSaveConnectedCookie.addEventListener("click", () => {
            const val = (inputConnectedCookieSpdc?.value || "").trim();
            if (!val) {
                showToast("Please paste your sp_dc cookie");
                return;
            }
            try {
                localStorage.setItem("spotiless_sp_dc", val);
                showToast("Spotify linked successfully! 🍪");
                checkAccountState();
                if (inputConnectedCookieSpdc) inputConnectedCookieSpdc.value = "";
            } catch (e) {
                showToast("Failed to save cookie");
            }
        });
    }

    if (btnUnlinkSpotify) {
        btnUnlinkSpotify.addEventListener("click", () => {
            try {
                localStorage.removeItem("spotiless_sp_dc");
                showToast("Spotify unlinked");
                checkAccountState();
            } catch (e) {
                showToast("Failed to unlink Spotify");
            }
        });
    }
    if (btnSaveCookie && inputCookieSpdc) {
        btnSaveCookie.addEventListener("click", () => {
            const val = inputCookieSpdc.value.trim();
            if (!val) {
                alert("Please paste your Spotify sp_dc cookie first.");
                return;
            }
            localStorage.setItem("spotiless_sp_dc", val);
            showToast("Spotify cookie linked for this session! 🍪");
            checkAccountState();
            closeModals();
        });
    }

    // Free Guest Play
    const btnGuestPlayDirect = document.getElementById("btn-guest-play-direct");
    if (btnGuestPlayDirect) {
        btnGuestPlayDirect.addEventListener("click", () => {
            sessionStorage.setItem("spotiless_guest_session", "true");
            showToast("Playing as Guest! Enjoy the music 🎵");
            closeModals();
        });
    }

    // Edit Username Handlers
    const btnShowEditUsername = document.getElementById("btn-show-edit-username");
    const btnShowEditUsernameBottom = document.getElementById("btn-show-edit-username-bottom");
    const boxEditUsername = document.getElementById("box-edit-username");
    const inputNewUsername = document.getElementById("input-new-username");
    const btnSaveNewUsername = document.getElementById("btn-save-new-username");
    const btnCancelEditUsername = document.getElementById("btn-cancel-edit-username");

    function toggleEditUsernameBox() {
        if (!boxEditUsername) return;
        boxEditUsername.classList.toggle("hidden");
        if (!boxEditUsername.classList.contains("hidden") && inputNewUsername) {
            const acc = getStoredAccount();
            inputNewUsername.value = acc && acc.username ? acc.username : "";
            inputNewUsername.focus();
            inputNewUsername.select();
        }
    }

    if (btnShowEditUsername) {
        btnShowEditUsername.addEventListener("click", toggleEditUsernameBox);
    }
    if (btnShowEditUsernameBottom) {
        btnShowEditUsernameBottom.addEventListener("click", toggleEditUsernameBox);
    }

    if (btnCancelEditUsername && boxEditUsername) {
        btnCancelEditUsername.addEventListener("click", () => {
            boxEditUsername.classList.add("hidden");
        });
    }

    if (btnSaveNewUsername && inputNewUsername) {
        btnSaveNewUsername.addEventListener("click", () => {
            const newName = inputNewUsername.value.trim();
            if (!newName) {
                alert("Please enter a username.");
                return;
            }
            const acc = getStoredAccount() || {};
            acc.username = newName;
            localStorage.setItem("spotiless_account", JSON.stringify(acc));
            if (userNameDisplay) userNameDisplay.textContent = newName;
            if (authUsernameLabel) authUsernameLabel.textContent = newName;
            if (boxEditUsername) boxEditUsername.classList.add("hidden");
            showToast(`Username updated to ${newName}! ✨`);
        });

        inputNewUsername.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                btnSaveNewUsername.click();
            }
        });
    }

    // Logout / Disconnect
    if (btnLogout) {
        btnLogout.addEventListener("click", async () => {
            localStorage.removeItem("spotiless_account");
            localStorage.removeItem("spotiless_sp_dc");
            sessionStorage.removeItem("spotiless_guest_session");
            try {
                await fetch("/api/auth/logout", { method: "POST" });
            } catch (e) {}
            showToast("Signed out.");
            checkAccountState();
            closeModals();
        });
    }

        // ----------------- Stats Modal -----------------
    async function openStatsModal() {
        modalStats.classList.remove("hidden");
        if (isCloudMode) {
            const stats = CloudGameManager.stats;
            document.getElementById("stat-played").textContent = stats.played || 0;
            const winRate = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
            document.getElementById("stat-winrate").textContent = `${winRate}%`;
            document.getElementById("stat-streak").textContent = stats.current_streak || 0;
            document.getElementById("stat-best-streak").textContent = stats.best_streak || 0;
            renderStatsChart(stats.distribution || {});
            return;
        }
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
        if (modalReveal && !modalReveal.classList.contains("hidden") && audio.isPlaying) {
            audio.fadeOut(0.4);
        }
        if (revealAlbumArt) {
            revealAlbumArt.classList.remove("pulse");
            const cw = revealAlbumArt.closest(".cover-wrapper");
            if (cw) cw.classList.remove("pulse");
        }
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
        if (btnThemeToggle) btnThemeToggle.addEventListener("click", toggleTheme);

        // Privacy & Data Deletion
        const modalPrivacy = document.getElementById("modal-privacy");
        const triggerPrivacy = () => {
            if (window.openPrivacyModal) {
                window.openPrivacyModal();
            } else if (modalPrivacy) {
                modalPrivacy.classList.remove("hidden");
                modalPrivacy.classList.add("active");
                modalPrivacy.style.setProperty("display", "flex", "important");
            }
        };

        const btnOpenPrivacy = document.getElementById("btn-open-privacy");
        if (btnOpenPrivacy) btnOpenPrivacy.addEventListener("click", (e) => triggerPrivacy(e));

        const btnNavPrivacy = document.getElementById("btn-nav-privacy");
        if (btnNavPrivacy) btnNavPrivacy.addEventListener("click", (e) => triggerPrivacy(e));

        // Note: btn-wipe-data moved to upcoming Settings modal
        const btnWipeData = document.getElementById("btn-wipe-data");
        if (btnWipeData) {
            btnWipeData.addEventListener("click", () => {
                if (confirm("Are you sure you want to permanently delete all local game data, streaks, and preferences from this device?")) {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.reload();
                }
            });
        }

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
                if (window.closePrivacyModal) window.closePrivacyModal();
                autocompleteList.classList.add("hidden");
            }
        });
    }

    function isAnyModalOpen() {
        return !!document.querySelector(".modal-overlay:not(.hidden)");
    }

    // Launch App: register event listeners synchronously on millisecond 0
    setupEventListeners();
    initTheme();
    checkAccountState();
    init();
});
