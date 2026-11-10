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
        this.isPlaying = false;
        this.playStartTime = 0;
        this.startOffset = 0;
        this.currentDuration = 0.1;
        this.currentTrackId = null;
        this.animFrameId = null;

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
        }
        if (this.ctx.state === "suspended") {
            this.ctx.resume();
        }
    }

    async loadTrack(trackId, fallbackQuery = "") {
        this.initContext();
        if (this.currentTrackId === trackId && this.audioBuffer) {
            return true; // Already loaded
        }

        this.stop();
        this.currentTrackId = trackId;
        this.audioBuffer = null;
        this.startOffset = 0;

        let arrayBuffer = null;

        // 1. Try local server endpoint if on localhost / local desktop launcher
        try {
            const res = await fetch(`/api/audio/${encodeURIComponent(trackId)}`);
            if (res.ok) {
                arrayBuffer = await res.arrayBuffer();
            }
        } catch (e) {
            // Local backend not reachable (e.g. cloud / Vercel deployment)
        }

        // 2. Cloud Standalone Fallback: Fetch preview stream via public Apple/iTunes CDN
        if (!arrayBuffer && fallbackQuery) {
            try {
                let previewUrl = null;
                if (fallbackQuery.startsWith("http://") || fallbackQuery.startsWith("https://")) {
                    previewUrl = fallbackQuery;
                } else {
                    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(fallbackQuery)}&entity=song&limit=1`;
                    const sRes = await fetch(searchUrl);
                    if (sRes.ok) {
                        const sData = await sRes.json();
                        if (sData.results && sData.results.length > 0) {
                            previewUrl = sData.results[0].previewUrl;
                        }
                    }
                }

                if (previewUrl) {
                    const audioRes = await fetch(previewUrl);
                    if (audioRes.ok) {
                        arrayBuffer = await audioRes.arrayBuffer();
                    }
                }
            } catch (err) {
                console.warn("Cloud fallback audio resolution error:", err);
            }
        }

        if (!arrayBuffer) {
            console.error("Could not obtain audio for track:", trackId);
            return false;
        }

        try {
            this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            const detectedOffset = this.detectAudioStartOffset(this.audioBuffer);
            if (detectedOffset === null) {
                console.warn("Track buffer appears completely silent, skipping track.");
                return false;
            }
            this.startOffset = detectedOffset;
            console.log(
                `Audio decoded successfully: ${this.audioBuffer.duration.toFixed(2)}s (startOffset: ${this.startOffset.toFixed(2)}s)`
            );
            return true;
        } catch (err) {
            console.error("Error decoding audio stream:", err);
            return false;
        }
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

    playSnippet(seconds) {
        if (!this.audioBuffer || !this.ctx) {
            console.warn("Audio buffer not ready for playback");
            return;
        }

        this.stop();
        this.initContext();

        const offset = this.startOffset || 0;
        const availableDuration = Math.max(0.1, this.audioBuffer.duration - offset);
        this.currentDuration = Math.min(seconds, availableDuration);
        this.isPlaying = true;

        this.currentSource = this.ctx.createBufferSource();
        this.currentSource.buffer = this.audioBuffer;

        // Connect source -> analyser -> master output
        this.currentSource.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);

        const startTime = this.ctx.currentTime;
        this.playStartTime = startTime;

        // Start playback from the detected audible startOffset for currentDuration seconds
        this.currentSource.start(startTime, offset, this.currentDuration);

        if (this.onPlayStart) {
            this.onPlayStart(this.currentDuration);
        }

        // Animate playhead progress
        const updateProgress = () => {
            if (!this.isPlaying) return;
            const elapsed = this.ctx.currentTime - this.playStartTime;
            const progress = Math.min(elapsed / this.currentDuration, 1.0);
            
            if (this.onPlayProgress) {
                this.onPlayProgress(progress, elapsed);
            }

            if (elapsed >= this.currentDuration) {
                this.stop();
            } else {
                this.animFrameId = requestAnimationFrame(updateProgress);
            }
        };

        this.animFrameId = requestAnimationFrame(updateProgress);

        this.currentSource.onended = () => {
            if (this.isPlaying) {
                this.stop();
            }
        };
    }

    playFull() {
        if (!this.audioBuffer) return;
        const offset = this.startOffset || 0;
        this.playSnippet(Math.max(0.1, this.audioBuffer.duration - offset));
    }

    stop() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
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

    toggle(seconds) {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.playSnippet(seconds);
        }
    }

    getWaveformData(dataArray) {
        if (this.analyser) {
            this.analyser.getByteFrequencyData(dataArray);
        }
    }
}

window.MicroAudioEngine = MicroAudioEngine;
