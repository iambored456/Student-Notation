// js/components/StaticWaveform/staticWaveformVisualizer.js
import store from '../../state/index.js';
import { HARMONIC_BINS } from '../../constants.js';
import * as Tone from 'tone';
import { hexToRgba } from '../../utils/colorUtils.js';

console.log("StaticWaveformVisualizer: Module loaded.");

class StaticWaveformVisualizer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.currentColor = null;
        this.animationFrameId = null;
        this.waveformData = new Float32Array(512); // Sample points for smooth curve
        this.isInitialized = false;
        
        // Live playback visualization
        this.isPlaybackActive = false;
        this.liveAnalysers = new Map(); // Map of color -> analyser
        this.liveWaveforms = new Map(); // Map of color -> waveform data
        this.playbackAnimationId = null;
    }

    initialize() {
        // Find or create the canvas element
        this.canvas = document.getElementById('static-waveform-canvas');
        if (!this.canvas) {
            console.warn("StaticWaveformVisualizer: No canvas found with id 'static-waveform-canvas'");
            return false;
        }

        this.ctx = this.canvas.getContext('2d');
        this.currentColor = store.state.selectedNote.color;
        
        // Set up resize observer
        const container = this.canvas.parentElement;
        if (container) {
            new ResizeObserver(() => this.resize()).observe(container);
        }
        
        this.resize();
        this.setupEventListeners();
        this.generateWaveform();
        this.isInitialized = true;
        
        console.log("StaticWaveformVisualizer: Initialized successfully.");
        return true;
    }

    resize() {
        if (!this.canvas || !this.ctx) return;
        
        const container = this.canvas.parentElement;
        if (!container) return;
        
        const { clientWidth, clientHeight } = container;
        
        // Set canvas size
        this.canvas.width = clientWidth;
        this.canvas.height = clientHeight;
        
        // Redraw after resize
        this.draw();
    }

    setupEventListeners() {
        // Listen for note color changes
        store.on('noteChanged', ({ newNote }) => {
            if (newNote.color && newNote.color !== this.currentColor) {
                this.currentColor = newNote.color;
                this.generateWaveform();
            }
        });

        // Listen for harmonic coefficient changes
        store.on('timbreChanged', (color) => {
            if (color === this.currentColor) {
                this.generateWaveform();
            }
        });
        // Listen for playback state changes to toggle live visualization
        store.on('playbackStateChanged', ({ isPlaying, isPaused }) => {
            if (isPlaying && !isPaused) {
                this.startLiveVisualization();
            } else {
                this.stopLiveVisualization();
            }
        });

        // Listen for spacebar-triggered audition of a single note
        store.on('spacebarPlayback', ({ color, isPlaying }) => {
            if (isPlaying) {
                this.startSingleNoteVisualization(color);
            } else {
                this.stopLiveVisualization();
            }
        });
    }

    generateWaveform() {
        if (!this.currentColor) return;

        const timbre = store.state.timbres[this.currentColor];
        if (!timbre || !timbre.coeffs) return;

        const coeffs = timbre.coeffs;
        const phases = timbre.phases || [];
        const numSamples = this.waveformData.length;
        
        // Clear the waveform data
        this.waveformData.fill(0);

        // Generate waveform using additive synthesis
        for (let sample = 0; sample < numSamples; sample++) {
            const phase = (sample / numSamples) * 2 * Math.PI;
            let amplitude = 0;

            // Add each harmonic including fundamental
            for (let i = 0; i < HARMONIC_BINS; i++) {
                const coeff = coeffs[i] || 0;
                if (coeff > 0.001) { // Skip very small coefficients for performance
                    const phaseOffset = phases[i] || 0;
                    amplitude += coeff * Math.sin((i + 1) * phase + phaseOffset);
                }
            }

            this.waveformData[sample] = amplitude;
        }

        // Normalize the waveform to prevent clipping
        this.normalizeWaveform();
        this.draw();
    }

    normalizeWaveform() {
        let maxAmp = 0;
        for (let i = 0; i < this.waveformData.length; i++) {
            maxAmp = Math.max(maxAmp, Math.abs(this.waveformData[i]));
        }
        
        if (maxAmp > 0) {
            const normalizer = 0.8 / maxAmp; // Leave some headroom
            for (let i = 0; i < this.waveformData.length; i++) {
                this.waveformData[i] *= normalizer;
            }
        }
    }

    draw() {
        if (!this.ctx || !this.canvas) return;

        const { width, height } = this.canvas;
        const centerY = height / 2;
        const amplitude = height * 0.4; // Use 40% of height for amplitude

        // Clear canvas
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, width, height);

        // Draw grid lines
        this.drawGrid(width, height, centerY);

        if (this.isPlaybackActive && this.liveWaveforms.size > 0) {
            // Draw live waveforms with colors
            this.drawLiveWaveforms(width, centerY, amplitude);
        } else {
            // Draw static waveform
            this.drawWaveform(width, centerY, amplitude);
        }

        // Draw labels if there's space
        if (width > 200 && height > 100) {
            this.drawLabels(width, height);
        }
    }

    drawGrid(width, height, centerY) {
        this.ctx.strokeStyle = '#E5E5E5';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 2]);

        // Horizontal center line
        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(width, centerY);
        this.ctx.stroke();

        // Vertical grid lines (quarters)
        for (let i = 1; i < 4; i++) {
            const x = (width / 4) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        // Amplitude reference lines
        const ampLines = [0.25, 0.5, 0.75];
        ampLines.forEach(amp => {
            const y1 = centerY - (height * 0.4 * amp);
            const y2 = centerY + (height * 0.4 * amp);
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, y1);
            this.ctx.lineTo(width, y1);
            this.ctx.moveTo(0, y2);
            this.ctx.lineTo(width, y2);
            this.ctx.stroke();
        });

        this.ctx.setLineDash([]);
    }

    drawWaveform(width, centerY, amplitude) {
        if (this.waveformData.length === 0) return;

        // Get current color for waveform
        const color = this.currentColor || '#4A90E2';
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();

        const samplesPerPixel = this.waveformData.length / width;

        for (let x = 0; x < width; x++) {
            const sampleIndex = Math.floor(x * samplesPerPixel);
            const sample = this.waveformData[sampleIndex] || 0;
            const y = centerY - (sample * amplitude);

            if (x === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.stroke();

        // Add a subtle fill under the waveform
        this.ctx.lineTo(width, centerY);
        this.ctx.lineTo(0, centerY);
        this.ctx.closePath();
        
        // Create gradient fill
        const gradient = this.ctx.createLinearGradient(0, centerY - amplitude, 0, centerY + amplitude);
        gradient.addColorStop(0, hexToRgba(color, 0.3));
        gradient.addColorStop(0.5, hexToRgba(color, 0.1));
        gradient.addColorStop(1, hexToRgba(color, 0.3));
        
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
    }

    drawLiveWaveforms(width, centerY, amplitude) {
        const colors = Array.from(this.liveWaveforms.keys());
        
        if (colors.length === 1) {
            // Single color - draw normal waveform
            const color = colors[0];
            const waveform = this.liveWaveforms.get(color);
            // We can use a slightly larger amplitude when only one sound is playing
            this.drawSingleLiveWaveform(waveform, color, width, centerY, amplitude * 1.1);
        } else if (colors.length > 1) {
            // Multiple colors - draw layered waveforms with transparency
            colors.forEach((color, index) => {
                const waveform = this.liveWaveforms.get(color);
                this.drawLayeredLiveWaveform(waveform, color, width, centerY, amplitude, colors.length);
            });
        }
    }

    drawSingleLiveWaveform(waveform, color, width, centerY, amplitude) {
        if (!waveform || waveform.length === 0) return;

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();

        const samplesPerPixel = waveform.length / width;

        for (let x = 0; x < width; x++) {
            const sampleIndex = Math.floor(x * samplesPerPixel);
            const sample = waveform[sampleIndex] || 0;
            
            // FIX: Removed the incorrect normalization. The sample is already a float from -1 to 1.
            const y = centerY - (sample * amplitude);

            if (x === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.stroke();
    }

    drawLayeredLiveWaveform(waveform, color, width, centerY, amplitude, totalLayers) {
        if (!waveform || waveform.length === 0) return;

        const alpha = Math.max(0.4, 1.0 / totalLayers);
        const strokeColor = hexToRgba(color, alpha * 2); 
        const fillColor = hexToRgba(color, alpha * 0.5);

        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();

        const samplesPerPixel = waveform.length / width;

        for (let x = 0; x < width; x++) {
            const sampleIndex = Math.floor(x * samplesPerPixel);
            const sample = waveform[sampleIndex] || 0;

            // FIX: Removed the incorrect normalization here as well.
            const y = centerY - (sample * amplitude * 0.7); // Still reduce amplitude for layering

            if (x === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.stroke();
    }

    startLiveVisualization() {
        if (this.isPlaybackActive) return;
        
        this.isPlaybackActive = true;
        this.setupLiveAnalysers();
        this.updateContainerState(true);
        this.animateLiveWaveforms();
        console.log("StaticWaveformVisualizer: Started live visualization");
    }

    startSingleNoteVisualization(color) {
        if (this.isPlaybackActive) return;
        
        this.isPlaybackActive = true;
        this.setupSingleAnalyser(color);
        this.updateContainerState(true);
        this.animateLiveWaveforms();
        console.log("StaticWaveformVisualizer: Started single note visualization for", color);
    }

    stopLiveVisualization() {
        this.isPlaybackActive = false;
        this.liveAnalysers.clear();
        this.liveWaveforms.clear();
        
        if (this.playbackAnimationId) {
            cancelAnimationFrame(this.playbackAnimationId);
            this.playbackAnimationId = null;
        }
        
        this.updateContainerState(false);
        
        // Return to static waveform display
        this.draw();
        console.log("StaticWaveformVisualizer: Stopped live visualization");
    }

    updateContainerState(isLive) {
        const wrapper = this.canvas?.parentElement;
        if (!wrapper) return;

        if (isLive) {
            wrapper.classList.add('live-mode');
            // Add pulsing effect for full playback (not single notes)
            if (store.state.isPlaying && !store.state.isPaused) {
                wrapper.classList.add('pulsing');
            }
        } else {
            wrapper.classList.remove('live-mode', 'pulsing');
        }
    }

    setupLiveAnalysers() {
        // Access the synth engine's audio nodes for each color
        const synthEngine = window.synthEngine;
        if (!synthEngine) {
            console.warn("StaticWaveformVisualizer: SynthEngine not available");
            return;
        }

        // Get all active timbre colors that have notes playing
        const activeColors = this.getActivePlayingColors();
        
        activeColors.forEach(color => {
            // Get or create analyser for each color's synth output
            const analyser = synthEngine.createWaveformAnalyzer(color);
            if (analyser) {
                this.liveAnalysers.set(color, analyser);
                this.liveWaveforms.set(color, new Float32Array(1024));
            }
        });
    }

    setupSingleAnalyser(color) {
        const synthEngine = window.synthEngine;
        if (!synthEngine) return;

        const analyser = synthEngine.createWaveformAnalyzer(color);
        if (analyser) {
            this.liveAnalysers.set(color, analyser);
            this.liveWaveforms.set(color, new Float32Array(1024));
        }
    }

    getActivePlayingColors() {
        // Get colors from currently playing notes
        const playingColors = new Set();
        
        // Add colors from placed notes (during full playback)
        if (store.state.isPlaying) {
            store.state.placedNotes.forEach(note => {
                if (!note.isDrum && note.color) {
                    playingColors.add(note.color);
                }
            });
        }

        // If no notes are actively playing, fall back to current selected color
        if (playingColors.size === 0 && this.currentColor) {
            playingColors.add(this.currentColor);
        }

        return Array.from(playingColors);
    }

    animateLiveWaveforms() {
        if (!this.isPlaybackActive) return;

        // Update waveform data from each analyser
        this.liveAnalysers.forEach((analyser, color) => {
            const waveformArray = analyser.getValue();
            this.liveWaveforms.set(color, waveformArray);
        });

        // Redraw with live data
        this.draw();

        // Continue animation
        this.playbackAnimationId = requestAnimationFrame(() => this.animateLiveWaveforms());
    }

    drawLabels(width, height) {
        this.ctx.fillStyle = '#666666';
        this.ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        this.ctx.textAlign = 'center';

        // Cycle labels
        const labels = ['0°', '90°', '180°', '270°', '360°'];
        labels.forEach((label, i) => {
            const x = (width / 4) * i;
            this.ctx.fillText(label, x, height - 8);
        });

        // Amplitude labels
        this.ctx.textAlign = 'left';
        this.ctx.fillText('+1.0', 5, 15);
        this.ctx.fillText('0.0', 5, height / 2 + 4);
        this.ctx.fillText('-1.0', 5, height - 8);
    }

    dispose() {
        this.stopLiveVisualization();
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        this.isInitialized = false;
        console.log("StaticWaveformVisualizer: Disposed.");
    }
}

// Create singleton instance
const staticWaveformVisualizer = new StaticWaveformVisualizer();

export function initStaticWaveformVisualizer() {
    return staticWaveformVisualizer.initialize();
}

export default staticWaveformVisualizer;