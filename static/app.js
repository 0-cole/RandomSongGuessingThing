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
    // Current App Version & Audio Engine
    const CURRENT_APP_VERSION = "v1.4.7";
    window.__CURRENT_APP_VERSION__ = CURRENT_APP_VERSION;
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
    const authConnectedView = document.getElementById("auth-connected-view");
    const authUnconnectedView = document.getElementById("auth-unconnected-view");
    const userNameDisplay = document.getElementById("user-name-display");
    const userAvatar = document.getElementById("user-avatar");
    const btnLogout = document.getElementById("btn-logout");

    function escapeHtml(str) {
        return String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
    window.escapeHtml = escapeHtml;

    // Unified Account & Spotify Link Controller (v1.4.2)
    let currentAuthMode = "signup"; // "signup" | "signin"
    let isHandlingAccountSubmit = false;

    function getStoredAccount() {
        try {
            const raw = localStorage.getItem("spotiless_account");
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && (parsed.username || parsed.email || parsed.raw_input)) {
                    return parsed;
                }
            }
        } catch (e) {}
        const fallbackName = localStorage.getItem("spotiless_account_name") || localStorage.getItem("spotiless_username");
        const fallbackEmail = localStorage.getItem("spotiless_account_email") || "";
        if (fallbackName) {
            return {
                username: fallbackName.includes("@") ? fallbackName.split("@")[0].trim() : fallbackName,
                email: fallbackEmail || (fallbackName.includes("@") ? fallbackName : ""),
                raw_input: fallbackName
            };
        }
        return null;
    }

    function getSpotifyCookie() {
        return localStorage.getItem("spotiless_sp_dc") || localStorage.getItem("sp_dc") || "";
    }

    window.setAccountMode = function(mode) {
        currentAuthMode = (mode === "signin") ? "signin" : "signup";
        window.isSignUpMode = (currentAuthMode === "signup");

        const userInput = document.getElementById("acc-username-input") || document.getElementById("auth-username");
        if (currentAuthMode === "signin" && userInput && userInput.value.trim() && modalAuth && !modalAuth.classList.contains("hidden") && typeof window.handleAccountSubmit === "function") {
            window.handleAccountSubmit();
            return;
        }

        const tabSignup = document.getElementById("tab-mode-signup");
        const tabSignin = document.getElementById("tab-mode-signin");
        const formTitle = document.getElementById("form-acc-title") || document.getElementById("auth-form-title");
        const formDesc = document.getElementById("form-acc-desc") || document.getElementById("auth-form-subtitle");
        const btnSubmitAcc = document.getElementById("btn-submit-account") || document.getElementById("btn-auth-submit");
        const toggleLink = document.getElementById("btn-toggle-account-mode");
        const passInput = document.getElementById("acc-password-input") || document.getElementById("auth-password");

        if (tabSignup && tabSignin) {
            if (currentAuthMode === "signin") {
                tabSignin.style.background = "#1db954";
                tabSignin.style.color = "#000000";
                tabSignin.style.fontWeight = "800";
                tabSignup.style.background = "transparent";
                tabSignup.style.color = "#b3b3b3";
                tabSignup.style.fontWeight = "600";
            } else {
                tabSignup.style.background = "#1db954";
                tabSignup.style.color = "#000000";
                tabSignup.style.fontWeight = "800";
                tabSignin.style.background = "transparent";
                tabSignin.style.color = "#b3b3b3";
                tabSignin.style.fontWeight = "600";
            }
        }

        if (currentAuthMode === "signin") {
            if (formTitle) formTitle.textContent = "Sign In to Your Account";
            if (formDesc) formDesc.textContent = "Sign in with your username or email to restore your session and playlists on this device.";
            if (btnSubmitAcc) btnSubmitAcc.textContent = "Sign In & Play";
            if (toggleLink) toggleLink.textContent = "Need an account? Create Account";
            if (userInput) {
                userInput.placeholder = "Enter your username or email";
                const acc = getStoredAccount();
                const stored = (acc && (acc.raw_input || acc.email || acc.username)) || "";
                if (stored && !userInput.value) userInput.value = stored;
            }
            if (passInput) passInput.placeholder = "Enter your password (optional)";
        } else {
            if (formTitle) formTitle.textContent = "Create Your Permanent Account";
            if (formDesc) formDesc.textContent = "Permanently links your Spotify session, streaks, and custom playlists on this device.";
            if (btnSubmitAcc) btnSubmitAcc.textContent = "Create Permanent Account & Play";
            if (toggleLink) toggleLink.textContent = "Already have an account? Sign In";
            if (userInput) userInput.placeholder = "Choose a username or email";
            if (passInput) passInput.placeholder = "Choose a password (optional)";
        }
    };

    window.toggleAccountAuthMode = function(e) {
        if (e && e.preventDefault) e.preventDefault();
        const userInput = document.getElementById("acc-username-input") || document.getElementById("auth-username");
        if (userInput && userInput.value.trim() && modalAuth && !modalAuth.classList.contains("hidden") && typeof window.handleAccountSubmit === "function") {
            window.handleAccountSubmit(e);
            return;
        }
        window.setAccountMode(currentAuthMode === "signup" ? "signin" : "signup");
    };

    function scrollAuthModalToTop() {
        if (!modalAuth) return;
        modalAuth.scrollTop = 0;
        const card = modalAuth.querySelector(".modal-card");
        if (card) card.scrollTop = 0;
    }

    window.openAuthModal = function() {
        window.location.href = "login.html";
    };

    window.closeAuthModalAndPlay = function() {
        closeModals();
        if (audio && typeof audio.ensureContextRunning === "function") {
            audio.ensureContextRunning().catch(() => {});
        }
    };

    function renderAccountConnectedView(accountName, isSpotifyLinked) {
        const unconnectedView = document.getElementById("auth-unconnected-view");
        const connectedView = document.getElementById("auth-connected-view");

        if (unconnectedView) {
            unconnectedView.classList.add("hidden");
            unconnectedView.style.setProperty("display", "none", "important");
        }
        if (connectedView) {
            connectedView.classList.remove("hidden");
            connectedView.style.setProperty("display", "block", "important");
        }

        const displayName = accountName || "Player";
        const nameEl = document.getElementById("user-name-display");
        if (nameEl) nameEl.textContent = displayName;

        const userTierBadge = document.getElementById("user-tier-badge");
        const spotifyPill = document.getElementById("spotify-link-pill");
        const unlinkedBox = document.getElementById("box-spotify-unlinked");
        const linkedBox = document.getElementById("box-spotify-linked");
        const welcomeBanner = document.getElementById("account-welcome-banner");
        const linkedPlaylist = localStorage.getItem("spotiless_linked_playlist");

        if (isSpotifyLinked) {
            if (userTierBadge) {
                userTierBadge.textContent = "Spotify Linked 🍪";
                userTierBadge.style.background = "var(--color-spotify)";
                userTierBadge.style.color = "#000";
            }
            if (spotifyPill) {
                spotifyPill.textContent = "✓ Connected";
                spotifyPill.style.background = "rgba(29, 185, 84, 0.2)";
                spotifyPill.style.color = "#1ed760";
            }
            if (unlinkedBox) {
                unlinkedBox.classList.add("hidden");
                unlinkedBox.style.setProperty("display", "none", "important");
            }
            if (linkedBox) {
                linkedBox.classList.remove("hidden");
                linkedBox.style.setProperty("display", "flex", "important");
            }
            if (welcomeBanner) {
                welcomeBanner.classList.remove("hidden");
                welcomeBanner.style.background = "rgba(29, 185, 84, 0.15)";
                welcomeBanner.style.border = "1px solid #1db954";
                welcomeBanner.style.color = "#1ed760";
                welcomeBanner.innerHTML = `<strong>Signed in as ${escapeHtml(displayName)}</strong><br><span style="color:#d0d0d0; font-size:12px;">✅ Spotify account is linked and ready.</span>`;
            }
        } else {
            if (userTierBadge) {
                userTierBadge.textContent = linkedPlaylist ? "Playlist Saved 🎵" : "Signed In";
                userTierBadge.style.background = linkedPlaylist ? "rgba(29, 185, 84, 0.2)" : "rgba(255, 255, 255, 0.15)";
                userTierBadge.style.color = linkedPlaylist ? "#1ed760" : "#ddd";
            }
            if (spotifyPill) {
                spotifyPill.textContent = linkedPlaylist ? "Playlist Linked" : "Not Linked";
                spotifyPill.style.background = linkedPlaylist ? "rgba(29, 185, 84, 0.2)" : "rgba(255, 107, 107, 0.2)";
                spotifyPill.style.color = linkedPlaylist ? "#1ed760" : "#ff6b6b";
            }
            if (unlinkedBox) {
                unlinkedBox.classList.remove("hidden");
                unlinkedBox.style.setProperty("display", "block", "important");
            }
            if (linkedBox) {
                linkedBox.classList.add("hidden");
                linkedBox.style.setProperty("display", "none", "important");
            }
            if (welcomeBanner) {
                welcomeBanner.classList.remove("hidden");
                welcomeBanner.style.background = "rgba(29, 185, 84, 0.12)";
                welcomeBanner.style.border = "1px solid rgba(29, 185, 84, 0.45)";
                welcomeBanner.style.color = "#1ed760";
                welcomeBanner.innerHTML = `<strong>Signed in as ${escapeHtml(displayName)}</strong><br><span style="color:#d0d0d0; font-size:12px;">Tap <strong>Start Playing Now</strong> below, or link a Spotify playlist link / cookie.</span>`;
            }
        }

        if (authStatusDot) {
            authStatusDot.className = "dot-connected";
        }
        if (authUsernameLabel) {
            authUsernameLabel.textContent = displayName.includes("@") ? displayName.split("@")[0] : displayName;
        }
    }
    window.renderAccountConnectedView = renderAccountConnectedView;

    window.handleAccountSubmit = function(e) {
        if (e) {
            if (typeof e.preventDefault === "function") e.preventDefault();
            if (typeof e.stopPropagation === "function") e.stopPropagation();
        }
        if (isHandlingAccountSubmit) return false;
        isHandlingAccountSubmit = true;
        setTimeout(() => { isHandlingAccountSubmit = false; }, 150);

        const userInput = document.getElementById("acc-username-input") || document.getElementById("auth-username");
        const passInput = document.getElementById("acc-password-input") || document.getElementById("auth-password");
        const rawVal = (userInput ? userInput.value : "").trim();
        const passVal = (passInput ? passInput.value : "").trim();

        if (!rawVal) {
            showToast("Please enter a username or email to sign in.");
            if (userInput) userInput.focus();
            return false;
        }

        try {
            let displayName = rawVal;
            let emailStr = "";
            if (rawVal.includes("@")) {
                emailStr = rawVal;
                displayName = rawVal.split("@")[0].trim() || rawVal;
            }

            const existingAcc = getStoredAccount() || {};
            const acc = {
                ...existingAcc,
                username: displayName,
                email: emailStr || existingAcc.email || "",
                raw_input: rawVal,
                logged_in_at: Date.now()
            };
            localStorage.setItem("spotiless_account", JSON.stringify(acc));
            localStorage.setItem("spotiless_account_name", rawVal);
            localStorage.setItem("spotiless_username", displayName);
            if (emailStr) localStorage.setItem("spotiless_account_email", emailStr);
            if (passVal) localStorage.setItem("spotiless_account_has_pass", "1");

            const hasSpDc = !!getSpotifyCookie();
            renderAccountConnectedView(displayName, hasSpDc);
            checkAccountState();
            closeModals();

            const actionVerb = currentAuthMode === "signin" ? "Signed in" : "Account created";
            showToast(`${actionVerb} as ${displayName}! 🎉`);
        } catch (err) {
            console.error("Account submit error:", err);
            showToast("Could not save account on this browser.");
        }

        return false;
    };

    async function handleSpotifyLinkInput(rawInput, inputEl) {
        const raw = (rawInput || "").trim();
        if (!raw) {
            showToast("Paste a Spotify username, profile link, or public playlist link.");
            if (inputEl) inputEl.focus();
            return;
        }

        // Support Spotify Playlist URL/URI or Public Username / Profile URL
        const playlistMatch = raw.match(/(?:open\.spotify\.com\/playlist\/|spotify:playlist:)([a-zA-Z0-9]+)/i);
        const looksLikeCookie = /^sp_dc=/i.test(raw) || (raw.length > 60 && !raw.includes("/") && !raw.includes("spotify:") && !raw.includes(" "));

        if (!looksLikeCookie) {
            if (isCloudMode) {
                showToast(playlistMatch ? "Loading public playlist tracks..." : "Scanning public Spotify playlists...", 3500);
                try {
                    const param = playlistMatch
                        ? `playlist=${encodeURIComponent(raw)}`
                        : `user=${encodeURIComponent(raw)}`;
                    const res = await fetch(`/api/spotify_public?${param}`);
                    const data = await res.json();
                    if (!res.ok || !data.success || !Array.isArray(data.tracks) || !data.tracks.length) {
                        showToast((data && data.error) || "Could not load tracks. Make sure playlists are set to Public on Spotify!", 4500);
                        return;
                    }

                    if (Array.isArray(data.playlists) && data.playlists.length) {
                        let prevUser = "";
                        try { prevUser = localStorage.getItem("spotiless_linked_user") || ""; } catch (e) {}
                        const nextUser = data.user_id || (!playlistMatch ? (data.username || raw) : prevUser);
                        const sameCreator = Boolean(prevUser && nextUser && prevUser.toLowerCase() === nextUser.toLowerCase());
                        let existing = [];
                        if (playlistMatch || sameCreator) {
                            try {
                                const parsed = JSON.parse(localStorage.getItem("spotiless_public_playlists") || "[]");
                                if (Array.isArray(parsed)) existing = parsed;
                            } catch (e) {}
                        }
                        const mergedMap = new Map();
                        existing.forEach((p) => { if (p && p.id) mergedMap.set(p.id, p); });
                        data.playlists.forEach((p) => { if (p && p.id) mergedMap.set(p.id, p); });
                        const mergedPlaylists = Array.from(mergedMap.values());
                        try {
                            localStorage.setItem("spotiless_public_playlists", JSON.stringify(mergedPlaylists));
                            localStorage.setItem("spotiless_playlists_schema", "v1.4.7");
                        } catch (e) {}
                        cachedUserPlaylists = mergedPlaylists;
                    }
                    if (!playlistMatch) {
                        try {
                            localStorage.setItem("spotiless_linked_user", data.user_id || data.username || raw);
                        } catch (e) {}
                    } else {
                        try {
                            localStorage.setItem("spotiless_linked_playlist", playlistMatch[1]);
                            if (data.user_id) {
                                localStorage.setItem("spotiless_linked_user", data.user_id);
                            }
                        } catch (e) {}
                    }

                    const poolLabel = playlistMatch
                        ? `🎵 ${(data.playlist && data.playlist.name) || "Spotify Playlist"}`
                        : `🎵 ${data.username || raw}'s Public Playlists`;
                    const newState = CloudGameManager.loadCustomPool(data.tracks, poolLabel);
                    consecutiveAutoSkips = 0;
                    if (inputEl) inputEl.value = "";
                    closeModals();
                    applyGameState(newState);
                    refreshStatus();
                    showToast(`Loaded ${data.tracks.length} songs! ⚠️ Niche/Spotify-exclusive tracks auto-skip without hurting your streak.`, 4500);
                    return;
                } catch (err) {
                    console.warn("Public Spotify load failed:", err);
                    showToast("Network error loading Spotify public data. Please try again.", 3500);
                    return;
                }
            } else if (playlistMatch) {
                const playlistId = playlistMatch[1];
                localStorage.setItem("spotiless_linked_playlist", playlistId);
                if (inputEl) inputEl.value = "";
                try {
                    const res = await fetch("/api/playlists/load_custom", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ url_or_id: raw })
                    });
                    const data = await res.json();
                    if (data && data.success) {
                        closeModals();
                        applyGameState(data.round);
                        refreshStatus();
                        showToast("Loaded Spotify playlist! 🎵");
                        return;
                    }
                } catch (err) {
                    console.warn("Local playlist load failed:", err);
                }
                checkAccountState();
                showToast("Spotify playlist saved! Load it from the Playlists menu.");
                return;
            }
        }

        // Otherwise treat as sp_dc cookie
        const match = raw.match(/sp_dc=([a-zA-Z0-9_\-]+)/);
        const cookieVal = match ? match[1] : raw;
        localStorage.setItem("spotiless_sp_dc", cookieVal);
        localStorage.setItem("sp_dc", cookieVal);
        if (inputEl) inputEl.value = "";

        const acc = getStoredAccount();
        const currentName = (acc && acc.username) || "Spotify User";
        renderAccountConnectedView(currentName, true);
        checkAccountState();
        showToast("Spotify linked successfully! 🍪");
    }

    // Initialize Auth Form Submissions & Event Listeners
    function initUnifiedAuthHandlers() {
        const formLocalAccount = document.getElementById("form-local-account");
        if (formLocalAccount) {
            formLocalAccount.onsubmit = window.handleAccountSubmit;
        }

        const btnSubmitAccount = document.getElementById("btn-submit-account");
        if (btnSubmitAccount) {
            btnSubmitAccount.addEventListener("click", window.handleAccountSubmit);
        }

        // Tab switcher inside modal (Permanent Account vs Cookie / Guest)
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

        // Edit / Reset Username handlers
        const boxEditUsername = document.getElementById("box-edit-username");
        const inputNewUsername = document.getElementById("input-new-username");
        const btnShowEdit = document.getElementById("btn-show-edit-username");
        const btnShowEditBottom = document.getElementById("btn-show-edit-username-bottom");
        const btnSaveNewUsername = document.getElementById("btn-save-new-username");
        const btnCancelEditUsername = document.getElementById("btn-cancel-edit-username");

        const openEditBox = (e) => {
            if (e) e.preventDefault();
            if (boxEditUsername) {
                boxEditUsername.classList.remove("hidden");
                boxEditUsername.style.display = "block";
                const acc = getStoredAccount();
                const current = (acc && acc.username) || "";
                if (inputNewUsername) {
                    inputNewUsername.value = current;
                    inputNewUsername.focus();
                    inputNewUsername.select();
                }
            }
        };

        if (btnShowEdit) btnShowEdit.addEventListener("click", openEditBox);
        if (btnShowEditBottom) btnShowEditBottom.addEventListener("click", openEditBox);

        if (btnCancelEditUsername) {
            btnCancelEditUsername.addEventListener("click", (e) => {
                if (e) e.preventDefault();
                if (boxEditUsername) {
                    boxEditUsername.classList.add("hidden");
                    boxEditUsername.style.display = "none";
                }
            });
        }

        const saveNewUsername = (e) => {
            if (e) e.preventDefault();
            const newName = (inputNewUsername ? inputNewUsername.value : "").trim();
            if (!newName) {
                showToast("Please enter a username.");
                return;
            }
            const acc = getStoredAccount() || {};
            acc.username = newName;
            localStorage.setItem("spotiless_account", JSON.stringify(acc));
            localStorage.setItem("spotiless_username", newName);
            localStorage.setItem("spotiless_account_name", newName);
            renderAccountConnectedView(newName, !!getSpotifyCookie());
            if (boxEditUsername) {
                boxEditUsername.classList.add("hidden");
                boxEditUsername.style.display = "none";
            }
            showToast(`Username updated to ${newName}! ✨`);
        };

        if (btnSaveNewUsername) btnSaveNewUsername.addEventListener("click", saveNewUsername);
        if (inputNewUsername) {
            inputNewUsername.addEventListener("keydown", (e) => {
                if (e.key === "Enter") saveNewUsername(e);
            });
        }

        // Spotify Link inside Connected View
        const btnSaveConnectedCookie = document.getElementById("btn-save-connected-cookie");
        const inputConnectedCookie = document.getElementById("input-connected-cookie-spdc");
        if (btnSaveConnectedCookie) {
            btnSaveConnectedCookie.addEventListener("click", (e) => {
                if (e) e.preventDefault();
                handleSpotifyLinkInput(inputConnectedCookie ? inputConnectedCookie.value : "", inputConnectedCookie);
            });
        }

        // Cookie tab link button
        const btnSaveCookie = document.getElementById("btn-save-cookie");
        const inputCookieSpdc = document.getElementById("input-cookie-spdc");
        if (btnSaveCookie) {
            btnSaveCookie.addEventListener("click", (e) => {
                if (e) e.preventDefault();
                handleSpotifyLinkInput(inputCookieSpdc ? inputCookieSpdc.value : "", inputCookieSpdc);
            });
        }

        // Unlink Spotify Button
        const btnUnlinkSpotify = document.getElementById("btn-unlink-spotify");
        if (btnUnlinkSpotify) {
            btnUnlinkSpotify.addEventListener("click", (e) => {
                if (e) e.preventDefault();
                localStorage.removeItem("spotiless_sp_dc");
                localStorage.removeItem("sp_dc");
                localStorage.removeItem("spotiless_linked_playlist");
                localStorage.removeItem("spotiless_linked_user");
                localStorage.removeItem("spotiless_public_playlists");
                if (isCloudMode && typeof CloudGameManager !== "undefined") {
                    const st = CloudGameManager.resetToDefaultPool();
                    applyGameState(st);
                    refreshStatus();
                }
                const acc = getStoredAccount();
                renderAccountConnectedView((acc && acc.username) || "Player", false);
                checkAccountState();
                showToast("Spotify unlinked");
            });
        }

        // Sign Out / Disconnect Button
        if (btnLogout) {
            btnLogout.addEventListener("click", async (e) => {
                if (e) e.preventDefault();
                localStorage.removeItem("spotiless_account");
                localStorage.removeItem("spotiless_account_name");
                localStorage.removeItem("spotiless_account_email");
                localStorage.removeItem("spotiless_username");
                localStorage.removeItem("spotiless_account_has_pass");
                localStorage.removeItem("spotiless_sp_dc");
                localStorage.removeItem("sp_dc");
                localStorage.removeItem("spotiless_linked_playlist");
                localStorage.removeItem("spotiless_linked_user");
                localStorage.removeItem("spotiless_public_playlists");
                localStorage.removeItem("spotiless_custom_cloud_tracks");
                localStorage.removeItem("spotiless_custom_pool_name");
                sessionStorage.removeItem("spotiless_guest_session");

                if (!isCloudMode) {
                    try {
                        await fetch("/api/auth/logout", { method: "POST" });
                    } catch (err) {}
                }

                const uInput = document.getElementById("acc-username-input");
                const pInput = document.getElementById("acc-password-input");
                if (uInput) uInput.value = "";
                if (pInput) pInput.value = "";
                window.setAccountMode("signin");
                checkAccountState();
                scrollAuthModalToTop();
                showToast("Signed out.");
            });
        }

        // Guest Play direct button
        const btnGuestPlay = document.getElementById("btn-guest-play-direct");
        if (btnGuestPlay) {
            btnGuestPlay.addEventListener("click", (e) => {
                if (e) e.preventDefault();
                sessionStorage.setItem("spotiless_guest_session", "true");
                showToast("Playing as Guest! Enjoy the music 🎵");
                window.closeAuthModalAndPlay();
            });
        }
    }

    initUnifiedAuthHandlers();

    // Mode Modal elements
    const userPlaylistsGrid = document.getElementById("user-playlists-grid");
    const difficultyCards = document.querySelectorAll(".mode-card");

    // Waveform Canvas
    const canvas = document.getElementById("waveform-canvas");
    const canvasCtx = canvas ? canvas.getContext("2d") : null;

    // App State
    let currentRound = null;
    let selectedTrack = null;
    let searchTimeout = null;
    let focusedItemIndex = -1;
    let shareTextCache = "";
    let isCloudMode = false;

    // ----------------- Cloud Standalone Mode Engine -----------------
    let consecutiveAutoSkips = 0;
    let refreshPlaylistsInFlight = null;

    async function refreshLinkedUserPlaylistsIfNeeded(force = false) {
        if (!isCloudMode) return false;
        let linkedUser = "";
        let schema = "";
        try {
            linkedUser = localStorage.getItem("spotiless_linked_user") || "";
            schema = localStorage.getItem("spotiless_playlists_schema") || "";
        } catch (e) {}

        if (!linkedUser) return false;
        if (!force && schema === "v1.4.7") return false;
        if (refreshPlaylistsInFlight) return refreshPlaylistsInFlight;

        refreshPlaylistsInFlight = (async () => {
            try {
                const res = await fetch(`/api/spotify_public?user=${encodeURIComponent(linkedUser)}`);
                if (!res.ok) return false;
                const data = await res.json();
                if (!data || !data.success || !Array.isArray(data.playlists) || !data.playlists.length) {
                    return false;
                }
                let existing = [];
                try {
                    const parsed = JSON.parse(localStorage.getItem("spotiless_public_playlists") || "[]");
                    if (Array.isArray(parsed)) existing = parsed;
                } catch (e) {}
                const mergedMap = new Map();
                existing.forEach((p) => { if (p && p.id) mergedMap.set(p.id, p); });
                data.playlists.forEach((p) => { if (p && p.id) mergedMap.set(p.id, p); });
                const mergedPlaylists = Array.from(mergedMap.values());
                data.playlists = mergedPlaylists;
                try {
                    localStorage.setItem("spotiless_public_playlists", JSON.stringify(mergedPlaylists));
                    localStorage.setItem("spotiless_playlists_schema", "v1.4.7");
                    if (Array.isArray(data.tracks) && data.tracks.length && localStorage.getItem("spotiless_custom_cloud_tracks")) {
                        const curPoolName = localStorage.getItem("spotiless_custom_pool_name") || "";
                        if (!curPoolName || curPoolName.includes("Public Playlists")) {
                            CloudGameManager.loadCustomPool(data.tracks, curPoolName || `🎵 ${data.username || "Public"}'s Playlists`);
                        }
                    }
                } catch (e) {}
                cachedUserPlaylists = data.playlists;
                if (userPlaylistsGrid) {
                    renderUserPlaylists(cachedUserPlaylists);
                    updateMultiPlaylistBar();
                }
                return true;
            } catch (e) {
                console.warn("Background public playlist refresh failed:", e);
                return false;
            } finally {
                refreshPlaylistsInFlight = null;
            }
        })();

        return refreshPlaylistsInFlight;
    }

    const CloudGameManager = {
        defaultTracks: [],
        tracks: [],
        poolName: "🔥 Spoti-Less Top Hits (Cloud)",
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
                    this.defaultTracks = await res.json();
                }
            } catch (e) {
                console.warn("Failed to load cloud_tracks.json:", e);
            }

            this.tracks = Array.isArray(this.defaultTracks) ? [...this.defaultTracks] : [];
            this.poolName = "🔥 Spoti-Less Top Hits (Cloud)";

            try {
                const customRaw = localStorage.getItem("spotiless_custom_cloud_tracks");
                const customName = localStorage.getItem("spotiless_custom_pool_name");
                if (customRaw) {
                    const parsed = JSON.parse(customRaw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        this.tracks = parsed;
                        this.poolName = customName || `🎵 Custom Playlist (${parsed.length} tracks)`;
                    }
                }
            } catch (e) {
                console.warn("Failed to load custom cloud tracks:", e);
            }

            try {
                const savedStats = localStorage.getItem("spotiless_cloud_stats");
                if (savedStats) this.stats = JSON.parse(savedStats);
            } catch (e) {}

            try {
                const savedIdx = localStorage.getItem("spotiless_cloud_index");
                if (savedIdx !== null) this.currentIndex = parseInt(savedIdx, 10) || 0;
            } catch (e) {}

            try {
                const savedRound = localStorage.getItem("spotiless_cloud_active_round");
                if (savedRound) {
                    const parsed = JSON.parse(savedRound);
                    const curTrack = this.getCurrentTrack();
                    if (parsed && parsed.currentIndex === this.currentIndex && (!parsed.trackId || (curTrack && parsed.trackId === curTrack.id))) {
                        this.attemptIndex = typeof parsed.attemptIndex === "number" ? parsed.attemptIndex : 0;
                        this.guesses = Array.isArray(parsed.guesses) ? parsed.guesses : [];
                        this.isWon = !!parsed.isWon;
                        this.isOver = !!parsed.isOver;
                    } else {
                        this.resetRound();
                    }
                } else {
                    this.resetRound();
                }
            } catch (e) {
                this.resetRound();
            }

            await refreshLinkedUserPlaylistsIfNeeded(false);
        },

        loadCustomPool: function(tracks, poolName, persist = true) {
            if (!Array.isArray(tracks) || !tracks.length) return this.getState();
            const shuffled = [...tracks];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            this.tracks = shuffled;
            this.poolName = poolName || `🎵 Custom Playlist (${shuffled.length} tracks)`;
            this.currentIndex = 0;
            this.resetRound();
            this.saveStats();
            if (persist) {
                try {
                    localStorage.setItem("spotiless_custom_cloud_tracks", JSON.stringify(shuffled));
                    localStorage.setItem("spotiless_custom_pool_name", this.poolName);
                } catch (e) {}
            }
            return this.getState();
        },

        resetToDefaultPool: function() {
            this.tracks = Array.isArray(this.defaultTracks) ? [...this.defaultTracks] : [];
            this.poolName = "🔥 Spoti-Less Top Hits (Cloud)";
            this.currentIndex = 0;
            this.resetRound();
            this.saveStats();
            try {
                localStorage.removeItem("spotiless_custom_cloud_tracks");
                localStorage.removeItem("spotiless_custom_pool_name");
            } catch (e) {}
            return this.getState();
        },

        skipUnplayableRound: function() {
            // Skip unplayable niche/Spotify-exclusive track without hurting win streak
            if (!this.tracks.length) return this.getState();
            this.currentIndex = (this.currentIndex + 1) % this.tracks.length;
            this.resetRound();
            this.saveStats();
            return this.getState();
        },

        saveStats: function() {
            try {
                localStorage.setItem("spotiless_cloud_stats", JSON.stringify(this.stats));
                localStorage.setItem("spotiless_cloud_index", String(this.currentIndex));
            } catch (e) {}
        },

        saveActiveRound: function() {
            try {
                if (!this.isOver && Array.isArray(this.guesses) && this.guesses.length > 0) {
                    const curTrack = this.getCurrentTrack();
                    localStorage.setItem("spotiless_cloud_active_round", JSON.stringify({
                        currentIndex: this.currentIndex,
                        attemptIndex: this.attemptIndex,
                        guesses: this.guesses,
                        isWon: this.isWon,
                        isOver: this.isOver,
                        trackId: curTrack ? curTrack.id : ""
                    }));
                } else {
                    localStorage.removeItem("spotiless_cloud_active_round");
                }
            } catch (e) {}
        },

        resetRound: function() {
            this.attemptIndex = 0;
            this.guesses = [];
            this.isWon = false;
            this.isOver = false;
            try {
                localStorage.removeItem("spotiless_cloud_active_round");
            } catch (e) {}
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
                pool_name: this.poolName || "🔥 Spoti-Less Top Hits (Cloud)",
                total_songs: total,
                song_index: songIdx,
                session_won: this.stats.won,
                session_played: this.stats.played,
                preview_query: track ? `${track.artist} ${track.name}` : "",
                preview_url: track ? (track.preview_url || "") : ""
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

            this.saveActiveRound();
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

            this.saveActiveRound();
            return this.getState();
        },

        giveUp: function() {
            if (this.isOver) return this.getState();
            this.isOver = true;
            this.stats.played++;
            this.stats.current_streak = 0;
            this.saveStats();
            this.saveActiveRound();
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

    let idleVisualizerDrawn = false;
    function drawVisualizer() {
        requestAnimationFrame(drawVisualizer);
        if (!canvas || !canvasCtx) return;
        if (!audio.isPlaying && idleVisualizerDrawn) return;
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
        idleVisualizerDrawn = !audio.isPlaying;
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
        const cookie = getSpotifyCookie();
        const linkedUser = localStorage.getItem("spotiless_linked_user");
        let publicPlaylists = [];
        try {
            const rawPl = localStorage.getItem("spotiless_public_playlists");
            if (rawPl) {
                const parsedPl = JSON.parse(rawPl);
                if (Array.isArray(parsedPl)) publicPlaylists = parsedPl;
            }
        } catch (e) {}

        const userPlaylistsStatusMsg = document.getElementById("user-playlists-status-msg");
        if (isCloudMode && userPlaylistsGrid) {
            if (publicPlaylists.length > 0) {
                cachedUserPlaylists = publicPlaylists;
                renderUserPlaylists(cachedUserPlaylists);
                updateMultiPlaylistBar();
            } else if (cookie || linkedUser) {
                userPlaylistsGrid.innerHTML = '<div class="empty-playlists-note" id="user-playlists-status-msg" style="padding: 16px 12px; text-align: center;"><p style="margin: 0 0 6px 0; font-weight: 700; color: #fff; font-size: 0.9rem;">Spotify Linked 🎵</p><p style="margin: 0 0 12px 0; font-size: 0.8rem; color: var(--color-text-muted);">Paste your Spotify username or any <strong>Public</strong> playlist link above to load songs instantly.</p></div>';
            } else {
                userPlaylistsGrid.innerHTML = '<div class="empty-playlists-note" id="user-playlists-status-msg" style="padding: 16px 12px; text-align: center;"><p style="margin: 0 0 6px 0; font-weight: 700; color: #fff; font-size: 0.9rem;">No Public Spotify Profile Linked</p><p style="margin: 0 0 12px 0; font-size: 0.8rem; color: var(--color-text-muted);">Paste your Spotify username above (playlists must be set to <strong>Public</strong>) or connect on the Spotify Connect page.</p><button type="button" class="btn btn-primary btn-sm" onclick="window.location.href=\'login.html\'" style="font-weight: 800; font-size: 0.8rem;">🔗 Connect Spotify Account</button></div>';
            }
        } else if (cookie || linkedUser) {
            if (userPlaylistsStatusMsg) {
                userPlaylistsStatusMsg.innerHTML = '<p style="margin: 0 0 6px 0; font-weight: 700; color: #fff; font-size: 0.9rem;">Spotify Linked 🎵</p><p style="margin: 0 0 12px 0; font-size: 0.8rem; color: var(--color-text-muted);">Paste any public playlist URL above to load songs instantly.</p>';
            }
        } else if (userPlaylistsStatusMsg) {
            userPlaylistsStatusMsg.innerHTML = '<p style="margin: 0 0 6px 0; font-weight: 700; color: #fff; font-size: 0.9rem;">No Spotify Account Linked</p><p style="margin: 0 0 12px 0; font-size: 0.8rem; color: var(--color-text-muted);">Connect your Spotify account to load and play your public playlists here.</p><button type="button" class="btn btn-primary btn-sm" onclick="window.location.href=\'login.html\'" style="font-weight: 800; font-size: 0.8rem;">🔗 Connect Spotify Account</button>';
        }

        if (acc && acc.username) {
            renderAccountConnectedView(acc.username, Boolean(cookie || linkedUser));
        } else if (linkedUser) {
            renderAccountConnectedView(linkedUser, true);
        } else if (cookie) {
            renderAccountConnectedView("Spotify Cookie User", true);
        } else {
            if (authStatusDot) authStatusDot.className = "dot-disconnected";
            if (authUsernameLabel) authUsernameLabel.textContent = "Connect Spotify";
            const unconnected = document.getElementById("auth-unconnected-view");
            const connected = document.getElementById("auth-connected-view");
            if (connected) {
                connected.classList.add("hidden");
                connected.style.setProperty("display", "none", "important");
            }
            if (unconnected) {
                unconnected.classList.remove("hidden");
                unconnected.style.setProperty("display", "block", "important");
            }
        }
    }

    async function refreshStatus() {
        if (isCloudMode) {
            checkAccountState();
            streakCounter.textContent = CloudGameManager.stats.current_streak || 0;
            activePoolLabel.textContent = CloudGameManager.poolName || "🔥 Spoti-Less Hits";
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
                if (data.version !== CURRENT_APP_VERSION) {
                    showUpdateNotification(data.version);
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

        // Preload audio into memory buffer (or YouTube IFrame fallback)
        showSpinner(true);
        const audioFallback = state.solution ? `${state.solution.artist} ${state.solution.name}` : (state.preview_query || "");
        const previewUrlHint = state.preview_url || (state.solution && state.solution.preview_url) || "";
        const expectedRoundId = state.round_id;
        audio.loadTrack(state.round_id, audioFallback, previewUrlHint).then((ok) => {
            showSpinner(false);
            if (currentRound && currentRound.round_id !== expectedRoundId) return;
            if (ok) {
                consecutiveAutoSkips = 0;
                return;
            }
            console.warn("Audio snippet preview unavailable on all web sources:", state.round_id, audioFallback);
            if (isCloudMode && !state.is_over && CloudGameManager.tracks.length > 1) {
                const trackLabel = audioFallback || "This niche track";
                if (consecutiveAutoSkips < 5) {
                    consecutiveAutoSkips++;
                    showToast(`⚠️ "${trackLabel}" isn't available on web sources (too niche / Spotify-exclusive) — skipping (streak safe!)`, 4000);
                    setTimeout(() => {
                        if (!currentRound || currentRound.round_id !== expectedRoundId || currentRound.is_over) return;
                        const nextState = CloudGameManager.skipUnplayableRound();
                        applyGameState(nextState);
                        refreshStatus();
                    }, 700);
                } else {
                    showToast("⚠️ Multiple niche songs couldn't play on web sources — try switching to another public playlist or Top Hits!", 4500);
                }
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

    const CLOUD_CURATED_PLAYLISTS = [
        { id: "__cloud_top_hits__", name: "🔥 Spoti-Less Top Hits (Built-in)", desc: "Instant playable web hits (zero rate limits)", image: "" },
        { id: "37i9dQZF1DXcBWIGoYBM5M", name: "🌟 Today's Top Hits", desc: "The biggest pop & viral hits on Spotify", image: "https://i.scdn.co/image/ab67706f00000002b0fe40a6e1692822f5a9d8f1" },
        { id: "37i9dQZF1DX4o1oenSJRJd", name: "🪩 2000s Pop Throwbacks", desc: "Nostalgic 2000s pop anthems", image: "https://i.scdn.co/image/ab67706f000000021665e8a719bd183f044bb775" },
        { id: "37i9dQZF1DX0XUsuxWHRQd", name: "🎧 RapCaviar", desc: "Top hip-hop & rap tracks", image: "https://i.scdn.co/image/ab67706f00000002ca5a7517156021292e5663a6" },
        { id: "37i9dQZF1DWXRqgorJj26U", name: "🎸 Rock Classics", desc: "Timeless rock & alternative classics", image: "https://i.scdn.co/image/ab67706f00000002fe24d7084be4aa228871629b" },
        { id: "37i9dQZF1DXbTxeAdrVG2l", name: "📻 90s Hits", desc: "Iconic 90s music across all genres", image: "https://i.scdn.co/image/ab67706f0000000234d8ee34bc819e62fe8971f4" }
    ];

    async function openModeModal() {
        if (!modalMode) return;
        modalMode.classList.remove("hidden");
        if (isCloudMode) {
            checkAccountState();
            renderCuratedPlaylists(CLOUD_CURATED_PLAYLISTS);
            updateMultiPlaylistBar();
            refreshLinkedUserPlaylistsIfNeeded(false);
            return;
        }
        try {
            const res = await fetch("/api/playlists");
            if (!res.ok) return;
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
            if (isCloudMode) {
                showToast("Personal rotation & Liked Songs require Desktop Native mode — in Cloud Mode, play Top Hits or any Public Playlist below!", 3500);
                return;
            }
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

    function buildPlaylistCoverMarkup(imageUrl, fallbackIcon = "🎵") {
        if (imageUrl) {
            return `<img src="${imageUrl}" alt="Cover" onerror="this.style.display='none'">`;
        }
        return `<div style="width: 48px; height: 48px; border-radius: 6px; background: rgba(29, 185, 84, 0.16); display: flex; align-items: center; justify-content: center; font-size: 1.35rem; flex-shrink: 0;">${fallbackIcon}</div>`;
    }

    function renderUserPlaylists(playlists) {
        if (!userPlaylistsGrid) return;
        userPlaylistsGrid.innerHTML = "";
        if (!playlists.length) {
            userPlaylistsGrid.innerHTML = `<div class="empty-playlists-note">No playlists created by you found in your account yet. Make sure your playlists are set to <strong>Public</strong>.</div>`;
            return;
        }

        playlists.forEach(p => {
            const card = document.createElement("div");
            card.className = "playlist-card" + (selectedPlaylists.has(p.id) ? " selected" : "");
            card.setAttribute("data-playlist-id", p.id);
            card.innerHTML = `
                ${buildPlaylistCoverMarkup(p.image, "🎵")}
                <div class="p-info">
                    <div class="p-title">${p.name}</div>
                    <div class="p-count">${p.tracks_count} tracks • Public</div>
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
                ${buildPlaylistCoverMarkup(p.image, "🔥")}
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
            if (isCloudMode) {
                const includesBuiltInTopHits = ids.includes("__cloud_top_hits__");
                const externalIds = ids.filter(id => id !== "__cloud_top_hits__");

                if (includesBuiltInTopHits && externalIds.length === 0) {
                    const st = CloudGameManager.resetToDefaultPool();
                    consecutiveAutoSkips = 0;
                    closeModals();
                    applyGameState(st);
                    refreshStatus();
                    showToast("Switched to Spoti-Less Top Hits! 🔥");
                    return;
                }

                const fetchedResults = await Promise.allSettled(
                    externalIds.map(id => fetch(`/api/spotify_public?playlist=${encodeURIComponent(id)}`).then(r => r.json()))
                );

                const mergedTracks = includesBuiltInTopHits && Array.isArray(CloudGameManager.defaultTracks)
                    ? [...CloudGameManager.defaultTracks]
                    : [];
                const seenKeys = new Set(mergedTracks.map(t => t.id || `${t.name}::${t.artist}`.toLowerCase()));
                let loadedPlaylistCount = includesBuiltInTopHits ? 1 : 0;

                fetchedResults.forEach(res => {
                    if (res.status === "fulfilled" && res.value && res.value.success && Array.isArray(res.value.tracks)) {
                        loadedPlaylistCount++;
                        res.value.tracks.forEach(t => {
                            const key = t.id || `${t.name}::${t.artist}`.toLowerCase();
                            if (!seenKeys.has(key)) {
                                seenKeys.add(key);
                                mergedTracks.push(t);
                            }
                        });
                    }
                });

                if (!mergedTracks.length) {
                    showToast("Could not load tracks from selected playlists. Make sure they are Public on Spotify!", 4000);
                    return;
                }

                const poolLabel = names.length === 1 ? `🎵 ${names[0]}` : `🎵 ${loadedPlaylistCount} Mixed Playlists`;
                const newState = CloudGameManager.loadCustomPool(mergedTracks, poolLabel);
                consecutiveAutoSkips = 0;
                closeModals();
                applyGameState(newState);
                refreshStatus();
                showToast(`Playing ${mergedTracks.length} songs from ${names.join(" + ")}! ⚠️ Niche tracks auto-skip safely.`, 4000);
                return;
            }

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
            showToast("Error loading playlists: " + err.message, 3500);
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
            if (isCloudMode) {
                btnLoadCustom.disabled = true;
                btnLoadCustom.textContent = "Loading...";
                try {
                    await handleSpotifyLinkInput(val, inputCustom);
                } finally {
                    btnLoadCustom.disabled = false;
                    btnLoadCustom.textContent = "Load & Play";
                }
                return;
            }
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

    // (Auth handlers managed by Unified Account & Spotify Link Controller above)

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
                if (data.version !== CURRENT_APP_VERSION) {
                    showUpdateNotification(data.version);
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

    function showToast(msg, durationMs = 2500) {
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.remove("hidden");
        if (showToast._timer) {
            clearTimeout(showToast._timer);
        }
        showToast._timer = setTimeout(() => toast.classList.add("hidden"), durationMs);
    }

    // ----------------- Gentle Website Update Notification System -----------------
    let isCheckingUpdate = false;

    function showUpdateNotification(newVersion) {
        const banner = document.getElementById("update-banner");
        if (!banner) return;

        const dismissedKey = `spotiless_update_dismissed_${newVersion || "latest"}`;
        if (sessionStorage.getItem(dismissedKey)) {
            return;
        }

        banner.classList.remove("hidden", "hiding");

        const btnReload = document.getElementById("btn-update-reload");
        const btnDismiss = document.getElementById("btn-update-dismiss");

        if (btnReload) {
            btnReload.onclick = () => {
                btnReload.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" style="display:inline-block; vertical-align:middle; animation:spin 0.8s linear infinite;"><path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg> <span>Reloading...</span>';
                btnReload.disabled = true;
                window.location.reload();
            };
        }

        if (btnDismiss) {
            btnDismiss.onclick = (e) => {
                if (e) e.stopPropagation();
                banner.classList.add("hiding");
                setTimeout(() => {
                    banner.classList.add("hidden");
                    banner.classList.remove("hiding");
                }, 320);
                sessionStorage.setItem(dismissedKey, "1");
            };
        }
    }

    async function checkWebsiteUpdate() {
        if (isCheckingUpdate) return;
        isCheckingUpdate = true;
        try {
            // Check version.json with anti-cache query
            const res = await fetch(`version.json?_t=${Date.now()}`, { cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                if (data && data.version && data.version !== CURRENT_APP_VERSION) {
                    showUpdateNotification(data.version);
                    return;
                }
            }
        } catch (e) {
            // If static fetch fails, fallback to checking /api/status if backend is alive
            if (!isCloudMode) {
                try {
                    const stRes = await fetch(`/api/status?_t=${Date.now()}`);
                    if (stRes.ok) {
                        const stData = await stRes.json();
                        if (stData && stData.version && stData.version !== CURRENT_APP_VERSION) {
                            showUpdateNotification(stData.version);
                        }
                    }
                } catch (err) {}
            }
        } finally {
            isCheckingUpdate = false;
        }
    }

    // ----------------- Global Event Listeners -----------------
    function setupEventListeners() {
        // Play snippet button
        if (btnPlay) {
            btnPlay.addEventListener("click", () => {
                if (currentRound) {
                    audio.toggle(currentRound.unlocked_seconds);
                }
            });
        }

        // Submit & Skip & Give Up
        if (btnSubmit) btnSubmit.addEventListener("click", submitCurrentGuess);
        if (btnSkip) btnSkip.addEventListener("click", skipCurrentAttempt);
        if (btnGiveUp) btnGiveUp.addEventListener("click", giveUpRound);

        // Header Modals
        const btnOpenMode = document.getElementById("btn-open-mode");
        const btnOpenStats = document.getElementById("btn-open-stats");
        const btnOpenAuth = document.getElementById("btn-open-auth");
        if (btnOpenMode) btnOpenMode.addEventListener("click", openModeModal);
        if (btnOpenStats) btnOpenStats.addEventListener("click", openStatsModal);
        if (btnOpenAuth) btnOpenAuth.addEventListener("click", window.openAuthModal);
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

        // Setup automatic update checking
        setTimeout(checkWebsiteUpdate, 3500);
        setInterval(checkWebsiteUpdate, 45000);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                checkWebsiteUpdate();
            }
        });
        window.addEventListener("focus", () => {
            checkWebsiteUpdate();
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
