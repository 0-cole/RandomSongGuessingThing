/**
 * ⚠️ HEY AI AGENT! Editing this script?
 * 1. Stop! Read spotiless_context.md & rules first!
 * 2. Strict Fast-Path Budget: Capped at 1–2 tool calls total (Read -> Edit -> Done).
 * 3. DO NOT wander or do incremental reads. Make direct edits cleanly.
 */
/**
 * High-precision Web Audio API Engine for micro-snippet playback.
 * Sample-accurate cutting for 0.1s, 0.25s, 0.5s, 1s, 2s, 5s.
 */
class MicroAudioEngine {
    constructor() {
        this.ctx = null;
        this.audioBuffer = null;
        this.currentSource = null;
        this.analyser = null;
        this.gainNode = null;
        this.isPlaying = false;
        this.isFadingOut = false;
        this.isLooping = false;
        this.playStartTime = 0;
        this.startOffset = 0;
        this.highlightOffset = 0;
        this.currentDuration = 0.1;
        this.currentTrackId = null;
        this.animFrameId = null;
        this.fadeTimeoutId = null;
        this.pendingHighlight = null;
        this.pendingPlayFull = null;
        this.pendingSnippet = null;
        this.isLoading = false;

        // Hidden YouTube IFrame Player fallback (Lobby98 style)
        this.youtubeVideoId = null;
        this.ytPlayer = null;
        this.ytReady = false;
        this.ytSnippetTimer = null;
        this.ytAnimFrame = null;
        this.ytPlayStartedAt = 0;

        // Callback hooks
        this.onPlayStart = null;
        this.onPlayProgress = null; // (percent, currentSec)
        this.onPlayEnd = null;
    }

    initContext() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 128;
            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);
            this.analyser.connect(this.gainNode);
            this.gainNode.connect(this.ctx.destination);
        }
        if (this.ctx.state === "suspended") {
            this.ctx.resume();
        }
    }

    async ensureContextRunning() {
        this.initContext();
        if (this.ctx && this.ctx.state === "suspended") {
            try {
                await this.ctx.resume();
            } catch (e) {
                console.warn("Could not resume AudioContext:", e);
            }
        }
    }

    async fetchPreviewArrayBuffer(url) {
        if (!url) return null;
        try {
            const directRes = await fetch(url);
            if (directRes.ok) {
                return await directRes.arrayBuffer();
            }
        } catch (e) {}
        try {
            const proxyRes = await fetch(`/api/spotify_public?proxy_audio=${encodeURIComponent(url)}`);
            if (proxyRes.ok) {
                return await proxyRes.arrayBuffer();
            }
        } catch (e) {}
        return null;
    }

    ensureYouTubePlayer(videoId) {
        if (!videoId) return Promise.resolve(false);
        return new Promise((resolve) => {
            if (!document.getElementById("yt-hidden-player")) {
                let wrapper = document.getElementById("yt-hidden-wrapper");
                if (!wrapper) {
                    wrapper = document.createElement("div");
                    wrapper.id = "yt-hidden-wrapper";
                    wrapper.setAttribute("aria-hidden", "true");
                    wrapper.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-9999;overflow:hidden;";
                    document.body.appendChild(wrapper);
                }
                const holder = document.createElement("div");
                holder.id = "yt-hidden-player";
                holder.style.cssText = "width:1px;height:1px;pointer-events:none;";
                wrapper.appendChild(holder);
            }

            const initOrCue = () => {
                if (this.ytPlayer && this.ytReady && typeof this.ytPlayer.cueVideoById === "function") {
                    try {
                        this.ytPlayer.cueVideoById({ videoId, startSeconds: 25 });
                    } catch (e) {}
                    resolve(true);
                    return;
                }
                if (!window.YT || !window.YT.Player) {
                    resolve(false);
                    return;
                }
                try {
                    this.ytPlayer = new window.YT.Player("yt-hidden-player", {
                        height: "1",
                        width: "1",
                        videoId,
                        playerVars: {
                            autoplay: 0,
                            controls: 0,
                            disablekb: 1,
                            fs: 0,
                            modestbranding: 1,
                            playsinline: 1,
                            start: 25,
                            origin: window.location.origin
                        },
                        events: {
                            onReady: () => {
                                this.ytReady = true;
                                try {
                                    const iframe = this.ytPlayer.getIframe && this.ytPlayer.getIframe();
                                    if (iframe) {
                                        iframe.setAttribute("tabindex", "-1");
                                        iframe.setAttribute("aria-hidden", "true");
                                        iframe.style.pointerEvents = "none";
                                    }
                                    this.ytPlayer.unMute();
                                    this.ytPlayer.setVolume(100);
                                } catch (e) {}
                                resolve(true);
                            },
                            onError: () => {
                                resolve(false);
                            }
                        }
                    });
                } catch (e) {
                    resolve(false);
                }
            };

            if (window.YT && window.YT.Player) {
                initOrCue();
                return;
            }

            const prevReady = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                if (typeof prevReady === "function") {
                    try { prevReady(); } catch (e) {}
                }
                initOrCue();
            };

            if (!document.getElementById("yt-iframe-api-script")) {
                const tag = document.createElement("script");
                tag.id = "yt-iframe-api-script";
                tag.src = "https://www.youtube.com/iframe_api";
                document.head.appendChild(tag);
            }

            setTimeout(() => resolve(this.ytReady), 4000);
        });
    }

    async loadTrack(trackId, fallbackQuery = "", previewUrlHint = "") {
        this.initContext();
        if (this.currentTrackId === trackId && (this.audioBuffer || this.youtubeVideoId)) {
            if (this.pendingSnippet) {
                const s = this.pendingSnippet;
                this.pendingSnippet = null;
                this.playSnippet(s.seconds, s.fromOffset, s.loop);
            }
            if (this.pendingHighlight) {
                const sec = this.pendingHighlight;
                this.pendingHighlight = null;
                this.playHighlight(sec);
            }
            if (this.pendingPlayFull) {
                const p = this.pendingPlayFull;
                this.pendingPlayFull = null;
                this.playFull(p.fromHighlight, p.loop);
            }
            return true;
        }

        this.stop();
        this.isLoading = true;
        this.currentTrackId = trackId;
        this.audioBuffer = null;
        this.youtubeVideoId = null;
        this.startOffset = 0;
        this.highlightOffset = 0;

        let arrayBuffer = null;
        let serverFallbackData = null;

        // Stage 1: Try local server endpoint if running desktop launcher
        try {
            const res = await fetch(`/api/audio/${encodeURIComponent(trackId)}`);
            if (res.ok) {
                const ct = (res.headers.get("content-type") || "").toLowerCase();
                if (!ct.includes("text/html") && !ct.includes("application/json")) {
                    arrayBuffer = await res.arrayBuffer();
                }
            }
        } catch (e) {}

        // Stage 2: Spotify Embed MP3 hint (from public playlist metadata)
        if (!arrayBuffer && previewUrlHint) {
            arrayBuffer = await this.fetchPreviewArrayBuffer(previewUrlHint);
        }

        // Stage 3: Direct Apple/iTunes Search API
        if (!arrayBuffer && fallbackQuery) {
            try {
                let previewUrl = null;
                if (fallbackQuery.startsWith("http://") || fallbackQuery.startsWith("https://")) {
                    previewUrl = fallbackQuery;
                } else {
                    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(fallbackQuery)}&entity=song&limit=3`;
                    const sRes = await fetch(searchUrl);
                    if (sRes.ok) {
                        const sData = await sRes.json();
                        const hit = (sData.results || []).find((r) => r && r.previewUrl);
                        if (hit) previewUrl = hit.previewUrl;
                    }
                }
                if (previewUrl) {
                    arrayBuffer = await this.fetchPreviewArrayBuffer(previewUrl);
                }
            } catch (err) {
                console.warn("iTunes audio resolution error:", err);
            }
        }

        // Stage 4: Serverless Multi-Source Waterfall (Spotify Embed MP3 -> iTunes -> Deezer -> YouTube ID)
        if (!arrayBuffer && (trackId || fallbackQuery)) {
            try {
                const apiRes = await fetch(
                    `/api/spotify_public?track_preview=${encodeURIComponent(trackId || "")}&q=${encodeURIComponent(fallbackQuery || "")}`
                );
                if (apiRes.ok) {
                    const ct = (apiRes.headers.get("content-type") || "").toLowerCase();
                    if (ct.includes("application/json")) {
                        serverFallbackData = await apiRes.json();
                        if (serverFallbackData && serverFallbackData.preview_url) {
                            arrayBuffer = await this.fetchPreviewArrayBuffer(serverFallbackData.preview_url);
                        }
                    }
                }
            } catch (err) {
                console.warn("Server waterfall audio lookup failed:", err);
            }
        }

        // Decode audio buffer if we got an MP3/M4A/OGG stream
        if (arrayBuffer) {
            try {
                this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                const detectedOffset = this.detectAudioStartOffset(this.audioBuffer);
                if (detectedOffset !== null) {
                    this.startOffset = detectedOffset;
                    this.highlightOffset = this.detectAudioHighlightOffset(this.audioBuffer);
                    this.isLoading = false;
                    console.log(
                        `Audio decoded successfully: ${this.audioBuffer.duration.toFixed(2)}s (startOffset: ${this.startOffset.toFixed(2)}s, highlightOffset: ${this.highlightOffset.toFixed(2)}s)`
                    );
                    if (this.pendingSnippet) {
                        const s = this.pendingSnippet;
                        this.pendingSnippet = null;
                        this.playSnippet(s.seconds, s.fromOffset, s.loop);
                    }
                    if (this.pendingHighlight) {
                        const sec = this.pendingHighlight;
                        this.pendingHighlight = null;
                        this.playHighlight(sec);
                    }
                    if (this.pendingPlayFull) {
                        const p = this.pendingPlayFull;
                        this.pendingPlayFull = null;
                        this.playFull(p.fromHighlight, p.loop);
                    }
                    return true;
                }
                this.audioBuffer = null;
            } catch (err) {
                console.error("Error decoding audio stream:", err);
                this.audioBuffer = null;
            }
        }

        // Stage 5: Lobby98-Style Hidden YouTube IFrame Player Fallback
        if (serverFallbackData && serverFallbackData.youtube_video_id) {
            const ytOk = await this.ensureYouTubePlayer(serverFallbackData.youtube_video_id);
            if (ytOk) {
                this.youtubeVideoId = serverFallbackData.youtube_video_id;
                this.startOffset = 25;
                this.highlightOffset = 25;
                this.isLoading = false;
                if (this.pendingSnippet) {
                    const s = this.pendingSnippet;
                    this.pendingSnippet = null;
                    this.playSnippet(s.seconds, s.fromOffset, s.loop);
                }
                if (this.pendingHighlight) {
                    const sec = this.pendingHighlight;
                    this.pendingHighlight = null;
                    this.playHighlight(sec);
                }
                if (this.pendingPlayFull) {
                    const p = this.pendingPlayFull;
                    this.pendingPlayFull = null;
                    this.playFull(p.fromHighlight, p.loop);
                }
                return true;
            }
            this.youtubeVideoId = null;
        }

        this.isLoading = false;
        console.error("Could not obtain audio from any source for track:", trackId);
        return false;
    }

    /**
     * Detects and skips silent or near-silent intros so the 0.1s snippet always
     * plays the actual beginning of the song (or falls back to a random audible
     * section if the intro is a long ambient swell).
     * Returns null if the entire buffer is silent.
     */
    detectAudioStartOffset(buffer) {
        if (!buffer || buffer.duration <= 0) return 0;

        const sampleRate = buffer.sampleRate;
        const numChannels = buffer.numberOfChannels;
        const totalSamples = buffer.length;
        const channels = [];
        for (let c = 0; c < numChannels; c++) {
            channels.push(buffer.getChannelData(c));
        }

        // Compute RMS energy over [startSample, startSample + count)
        const computeRms = (startSample, count) => {
            const end = Math.min(totalSamples, startSample + count);
            const len = end - startSample;
            if (len <= 0) return 0;
            let sumSq = 0;
            let n = 0;
            for (let i = startSample; i < end; i += 4) {
                let sample = 0;
                for (let c = 0; c < numChannels; c++) {
                    const s = Math.abs(channels[c][i]);
                    if (s > sample) sample = s;
                }
                sumSq += sample * sample;
                n++;
            }
            return n > 0 ? Math.sqrt(sumSq / n) : 0;
        };

        // Leave at least 5.2s for the full 5.0s final stage whenever possible
        const minPlayableSpan = Math.min(5.2, buffer.duration * 0.5);
        const maxOffsetSec = Math.max(0, buffer.duration - minPlayableSpan);

        const win100ms = Math.max(1, Math.floor(sampleRate * 0.1));
        const win40ms = Math.max(1, Math.floor(sampleRate * 0.04));
        const step10ms = Math.max(1, Math.floor(sampleRate * 0.01));

        // 1. Sample 100ms windows across the track to determine its reference loudness
        const rmsSamples = [];
        for (let s = 0; s + win100ms <= totalSamples; s += win100ms) {
            const r = computeRms(s, win100ms);
            if (r > 0.002) rmsSamples.push(r);
        }

        if (rmsSamples.length === 0) {
            return null; // Entire decoded buffer is dead silence
        }

        rmsSamples.sort((a, b) => a - b);
        const refRms = rmsSamples[Math.floor(rmsSamples.length * 0.8)] || rmsSamples[rmsSamples.length - 1];

        // Threshold for an unmistakable, audible musical onset in a 0.1s snippet
        const onsetThreshold = Math.max(0.016, Math.min(refRms * 0.18, 0.05));
        const maxOffsetSample = Math.floor(maxOffsetSec * sampleRate);

        // 2. Scan from 0.0s in 10ms steps for the actual beginning of the song:
        //    Requires both the immediate 40ms attack AND the full first 100ms (0.1s stage)
        //    to be clearly audible, so a 0.1s snippet never plays dead air.
        for (let s = 0; s <= maxOffsetSample; s += step10ms) {
            const rms40 = computeRms(s, win40ms);
            if (rms40 >= onsetThreshold * 0.85) {
                const rms100 = computeRms(s, win100ms);
                if (rms100 >= onsetThreshold) {
                    const backoffSamples = Math.floor(sampleRate * 0.01);
                    const startSample = s > backoffSamples ? s - backoffSamples : 0;
                    return startSample / sampleRate;
                }
            }
        }

        // 3. Fallback: If the intro is a very slow ambient fade-in that didn't hit a sharp
        //    onset early, pick a random clearly-audible section from the track buffer.
        const audibleCandidates = [];
        const fallbackThreshold = Math.max(0.01, refRms * 0.1);
        for (let s = 0; s <= maxOffsetSample; s += win100ms) {
            if (computeRms(s, win100ms) >= fallbackThreshold) {
                audibleCandidates.push(s / sampleRate);
            }
        }
        if (audibleCandidates.length > 0) {
            const randomIdx = Math.floor(Math.random() * audibleCandidates.length);
            return audibleCandidates[randomIdx];
        }

        return 0;
    }

    /**
     * Detects the energetic "highlight" of the song (e.g. chorus / hook / drop)
     * by scanning for the window with peak sustained RMS energy, biasing towards
     * the actual chorus/hook section rather than early intro transients.
     */
    detectAudioHighlightOffset(buffer) {
        if (!buffer || buffer.duration <= 0) return 0;
        const sampleRate = buffer.sampleRate;
        const totalSamples = buffer.length;
        const numChannels = buffer.numberOfChannels;
        const channels = [];
        for (let c = 0; c < numChannels; c++) {
            channels.push(buffer.getChannelData(c));
        }

        const computeRms = (startSample, count) => {
            const end = Math.min(totalSamples, startSample + count);
            const len = end - startSample;
            if (len <= 0) return 0;
            let sumSq = 0;
            let n = 0;
            for (let i = startSample; i < end; i += 8) {
                let s = Math.abs(channels[0][i]);
                if (numChannels > 1) {
                    const s2 = Math.abs(channels[1][i]);
                    if (s2 > s) s = s2;
                }
                sumSq += s * s;
                n++;
            }
            return n > 0 ? Math.sqrt(sumSq / n) : 0;
        };

        const duration = buffer.duration;
        if (duration <= 6.0) {
            return this.startOffset || 0;
        }

        // Measurement window for sustained hook/chorus energy (3.0 seconds)
        const minPlayableSpan = Math.min(5.0, duration * 0.4);
        const maxStartSec = Math.max(0, duration - minPlayableSpan);
        const windowSec = Math.min(3.0, Math.max(1.5, duration * 0.15));
        const windowSamples = Math.floor(sampleRate * windowSec);
        const stepSec = 0.25;
        const stepSamples = Math.floor(sampleRate * stepSec);
        const maxStartSample = Math.floor(maxStartSec * sampleRate);

        // Compute baseline RMS across the whole buffer to establish peak reference
        let globalPeakRms = 0;
        for (let s = 0; s + windowSamples <= totalSamples && s <= maxStartSample; s += stepSamples) {
            const rms = computeRms(s, windowSamples);
            if (rms > globalPeakRms) {
                globalPeakRms = rms;
            }
        }

        if (globalPeakRms <= 0.001) {
            return this.startOffset || 0;
        }

        // The chorus / hook is rarely in the initial intro or first 10-14 seconds.
        // If the buffer has sufficient length (> 16s), prefer windows starting after
        // the intro/first verse (e.g. from 12s onwards, or startOffset + 7s).
        const preferChorusAfterSec = duration > 16.0 
            ? Math.min(Math.max(12.0, (this.startOffset || 0) + 7.0), maxStartSec)
            : (this.startOffset || 0);
        const preferChorusSample = Math.floor(preferChorusAfterSec * sampleRate);

        let bestChorusSample = null;
        let bestChorusRms = -1;

        let bestOverallSample = 0;
        let bestOverallRms = -1;

        for (let s = 0; s + windowSamples <= totalSamples && s <= maxStartSample; s += stepSamples) {
            const rms = computeRms(s, windowSamples);
            if (rms > bestOverallRms) {
                bestOverallRms = rms;
                bestOverallSample = s;
            }
            if (s >= preferChorusSample && rms > bestChorusRms) {
                bestChorusRms = rms;
                bestChorusSample = s;
            }
        }

        // If the section after intro has strong energy (at least 82% of global peak),
        // that's unambiguously the chorus/drop! Use it over an intro transient.
        let rawOffsetSample = (bestChorusSample !== null && bestChorusRms >= globalPeakRms * 0.82)
            ? bestChorusSample
            : bestOverallSample;

        // Fine-tune to the nearest musical onset / beat near the chorus start
        // so micro-snippets (0.1s, 0.25s) hit crisp vocal/instrumental attacks.
        const win40ms = Math.max(1, Math.floor(sampleRate * 0.04));
        const win100ms = Math.max(1, Math.floor(sampleRate * 0.1));
        const step10ms = Math.max(1, Math.floor(sampleRate * 0.01));
        const onsetThreshold = Math.max(0.016, globalPeakRms * 0.22);

        const searchStartSample = Math.max(0, rawOffsetSample - Math.floor(sampleRate * 0.15));
        const searchEndSample = Math.min(totalSamples - win100ms, rawOffsetSample + Math.floor(sampleRate * 0.5));

        for (let s = searchStartSample; s <= searchEndSample; s += step10ms) {
            if (computeRms(s, win40ms) >= onsetThreshold * 0.85 && computeRms(s, win100ms) >= onsetThreshold) {
                return s / sampleRate;
            }
        }

        return rawOffsetSample / sampleRate;
    }

    async playSnippet(seconds, fromOffset = null, loop = false) {
        await this.ensureContextRunning();

        if (!this.audioBuffer && this.youtubeVideoId) {
            this.pendingSnippet = null;
            this.stop();
            const ytOffset = fromOffset !== null ? fromOffset : (this.highlightOffset || 25);
            this.currentDuration = seconds;
            this.isPlaying = true;
            this.isLooping = !!loop;
            if (!this.ytPlayer || !this.ytReady) {
                await this.ensureYouTubePlayer(this.youtubeVideoId);
            }
            if (this.ytPlayer && typeof this.ytPlayer.seekTo === "function") {
                try {
                    this.ytPlayer.unMute();
                    this.ytPlayer.setVolume(100);
                    this.ytPlayer.seekTo(ytOffset, true);
                    this.ytPlayer.playVideo();
                } catch (e) {}
            }
            this.ytPlayStartedAt = performance.now();
            if (this.onPlayStart) {
                this.onPlayStart(this.currentDuration);
            }
            const tickYt = () => {
                if (!this.isPlaying) return;
                const elapsed = Math.max(0, (performance.now() - this.ytPlayStartedAt) / 1000);
                if (this.isLooping) {
                    const loopElapsed = this.currentDuration > 0 ? (elapsed % this.currentDuration) : 0;
                    const progress = this.currentDuration > 0 ? (loopElapsed / this.currentDuration) : 0;
                    if (this.onPlayProgress) this.onPlayProgress(progress, loopElapsed);
                    this.ytAnimFrame = requestAnimationFrame(tickYt);
                } else {
                    const progress = Math.min(elapsed / this.currentDuration, 1.0);
                    if (this.onPlayProgress) this.onPlayProgress(progress, elapsed);
                    if (elapsed < this.currentDuration + 0.08) {
                        this.ytAnimFrame = requestAnimationFrame(tickYt);
                    }
                }
            };
            this.ytAnimFrame = requestAnimationFrame(tickYt);
            if (!this.isLooping) {
                this.ytSnippetTimer = setTimeout(() => {
                    this.ytSnippetTimer = null;
                    this.stop();
                }, Math.max(80, Math.round(seconds * 1000)));
            }
            return;
        }

        if (!this.audioBuffer || !this.ctx) {
            console.warn("Audio buffer not ready yet, queueing snippet playback...");
            this.pendingSnippet = { seconds, fromOffset, loop };
            return;
        }

        this.pendingSnippet = null;

        if (this.fadeTimeoutId) {
            clearTimeout(this.fadeTimeoutId);
            this.fadeTimeoutId = null;
        }
        this.isFadingOut = false;

        this.stop();
        await this.ensureContextRunning();

        // Default to the song's energetic chorus / hook highlight (Spotify preview style)
        // rather than repetitive intro bars, falling back to audible startOffset if needed.
        const defaultOffset = (this.highlightOffset !== null && this.highlightOffset !== undefined)
            ? this.highlightOffset
            : (this.startOffset || 0);
        const offset = fromOffset !== null ? fromOffset : defaultOffset;
        const availableDuration = Math.max(0.1, this.audioBuffer.duration - offset);
        this.currentDuration = Math.min(seconds, availableDuration);
        this.isPlaying = true;
        this.isLooping = !!loop;

        if (this.gainNode && this.ctx) {
            try {
                this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
                this.gainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);
            } catch (e) {}
        }

        this.currentSource = this.ctx.createBufferSource();
        this.currentSource.buffer = this.audioBuffer;

        if (this.isLooping) {
            this.currentSource.loop = true;
            this.currentSource.loopStart = offset;
            this.currentSource.loopEnd = offset + this.currentDuration;
        }

        // Connect source -> analyser (which connects to gainNode -> destination)
        this.currentSource.connect(this.analyser);

        // Schedule playback with a tiny 12ms lookahead so hardware buffer has zero starvation
        const now = this.ctx.currentTime;
        const startTime = now + 0.012;
        this.playStartTime = startTime;

        // Start playback from the specified offset
        if (this.isLooping) {
            this.currentSource.start(startTime, offset);
        } else {
            this.currentSource.start(startTime, offset, this.currentDuration);
        }

        if (this.onPlayStart) {
            this.onPlayStart(this.currentDuration);
        }

        // Animate playhead progress
        const updateProgress = () => {
            if (!this.isPlaying) return;
            const elapsed = Math.max(0, this.ctx.currentTime - this.playStartTime);
            
            if (this.isLooping) {
                const loopElapsed = this.currentDuration > 0 ? (elapsed % this.currentDuration) : 0;
                const progress = this.currentDuration > 0 ? (loopElapsed / this.currentDuration) : 0;
                if (this.onPlayProgress) {
                    this.onPlayProgress(progress, loopElapsed);
                }
                this.animFrameId = requestAnimationFrame(updateProgress);
            } else {
                const progress = Math.min(elapsed / this.currentDuration, 1.0);
                if (this.onPlayProgress) {
                    this.onPlayProgress(progress, elapsed);
                }

                // Web Audio's onended will handle stopping naturally. We only use a safe backstop
                // of +0.06s so we never abruptly cut off 0.1s snippets before the audio hardware renders them.
                if (elapsed >= this.currentDuration + 0.06) {
                    this.stop();
                } else {
                    this.animFrameId = requestAnimationFrame(updateProgress);
                }
            }
        };

        this.animFrameId = requestAnimationFrame(updateProgress);

        this.currentSource.onended = () => {
            if (this.isPlaying && !this.isFadingOut && !this.isLooping) {
                this.stop();
            }
        };
    }

    async playHighlight(seconds = null, loop = false) {
        await this.ensureContextRunning();
        if (!this.audioBuffer && this.youtubeVideoId) {
            this.pendingHighlight = null;
            this.playSnippet(seconds || 30, this.highlightOffset || 25, loop);
            return;
        }
        if (!this.audioBuffer) {
            this.pendingHighlight = seconds || true;
            return;
        }
        this.pendingHighlight = null;
        const offset = (this.highlightOffset !== null && this.highlightOffset !== undefined) ? this.highlightOffset : (this.startOffset || 0);
        const available = Math.max(0.1, this.audioBuffer.duration - offset);
        const playDuration = (seconds !== null && seconds !== undefined) ? Math.min(seconds, available) : available;
        this.playSnippet(playDuration, offset, loop);
    }

    async playFull(fromHighlight = false, loop = true) {
        await this.ensureContextRunning();
        if (!this.audioBuffer && this.youtubeVideoId) {
            this.pendingPlayFull = null;
            this.playSnippet(30, fromHighlight ? (this.highlightOffset || 25) : 25, loop);
            return;
        }
        if (!this.audioBuffer) {
            this.pendingPlayFull = { fromHighlight, loop };
            return;
        }
        this.pendingPlayFull = null;
        const offset = (fromHighlight && this.highlightOffset !== null && this.highlightOffset !== undefined)
            ? this.highlightOffset
            : (this.startOffset || 0);
        const available = Math.max(0.1, this.audioBuffer.duration - offset);
        this.playSnippet(available, offset, loop);
    }

    fadeOut(durationSec = 0.8) {
        return new Promise((resolve) => {
            if (!this.isPlaying || !this.gainNode || !this.ctx) {
                this.stop();
                resolve();
                return;
            }

            if (this.isFadingOut) {
                resolve();
                return;
            }
            this.isFadingOut = true;

            try {
                const now = this.ctx.currentTime;
                this.gainNode.gain.cancelScheduledValues(now);
                this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
                this.gainNode.gain.linearRampToValueAtTime(0.0001, now + durationSec);
            } catch (e) {
                this.stop();
                resolve();
                return;
            }

            this.fadeTimeoutId = setTimeout(() => {
                this.fadeTimeoutId = null;
                this.isFadingOut = false;
                this.stop();
                resolve();
            }, durationSec * 1000);
        });
    }

    stop() {
        this.isLooping = false;
        this.pendingPlayFull = null;
        this.pendingHighlight = null;
        this.pendingSnippet = null;

        if (this.ytSnippetTimer) {
            clearTimeout(this.ytSnippetTimer);
            this.ytSnippetTimer = null;
        }
        if (this.ytAnimFrame) {
            cancelAnimationFrame(this.ytAnimFrame);
            this.ytAnimFrame = null;
        }
        if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === "function") {
            try { this.ytPlayer.pauseVideo(); } catch (e) {}
        }

        if (this.fadeTimeoutId) {
            clearTimeout(this.fadeTimeoutId);
            this.fadeTimeoutId = null;
        }
        this.isFadingOut = false;

        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }

        if (this.gainNode && this.ctx) {
            try {
                this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
                this.gainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);
            } catch (e) {}
        }

        if (this.currentSource) {
            try {
                this.currentSource.stop();
                this.currentSource.disconnect();
            } catch (e) {}
            this.currentSource = null;
        }

        if (this.isPlaying) {
            this.isPlaying = false;
            if (this.onPlayEnd) {
                this.onPlayEnd();
            }
        }
    }

    async toggle(seconds) {
        if (this.isPlaying) {
            this.stop();
        } else if (this.pendingSnippet) {
            this.pendingSnippet = null;
            this.stop();
        } else {
            await this.playSnippet(seconds);
        }
    }

    getWaveformData(dataArray) {
        if (this.isPlaying && this.youtubeVideoId && !this.audioBuffer) {
            const t = performance.now() / 160;
            for (let i = 0; i < dataArray.length; i++) {
                dataArray[i] = Math.round(90 + 110 * Math.abs(Math.sin(t + i * 0.42)));
            }
            return;
        }
        if (this.analyser) {
            this.analyser.getByteFrequencyData(dataArray);
        }
    }
}

window.MicroAudioEngine = MicroAudioEngine;
