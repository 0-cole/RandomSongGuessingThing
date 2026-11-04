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

    async loadTrack(trackId) {
        this.initContext();
        if (this.currentTrackId === trackId && this.audioBuffer) {
            return true; // Already loaded
        }

        this.stop();
        this.currentTrackId = trackId;
        this.audioBuffer = null;

        try {
            const res = await fetch(`/api/audio/${encodeURIComponent(trackId)}`);
            if (!res.ok) {
                console.error("Failed to fetch audio stream:", res.status);
                return false;
            }
            const arrayBuffer = await res.arrayBuffer();
            this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            console.log(`Audio decoded successfully: ${this.audioBuffer.duration.toFixed(2)}s`);
            return true;
        } catch (err) {
            console.error("Error decoding audio stream:", err);
            return false;
        }
    }

    playSnippet(seconds) {
        if (!this.audioBuffer || !this.ctx) {
            console.warn("Audio buffer not ready for playback");
            return;
        }

        this.stop();
        this.initContext();

        this.currentDuration = Math.min(seconds, this.audioBuffer.duration);
        this.isPlaying = true;

        this.currentSource = this.ctx.createBufferSource();
        this.currentSource.buffer = this.audioBuffer;

        // Connect source -> analyser -> master output
        this.currentSource.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);

        const startTime = this.ctx.currentTime;
        this.playStartTime = startTime;

        // Start playback from 0.0s for currentDuration seconds
        this.currentSource.start(startTime, 0, this.currentDuration);

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
        this.playSnippet(this.audioBuffer.duration);
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
