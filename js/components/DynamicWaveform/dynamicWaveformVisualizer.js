// js/components/DynamicWaveform/dynamicWaveformVisualizer.js
import store from '../../state/index.js';
import { hexToRgba } from '../../utils/colorUtils.js';
import logger from '../../utils/logger.js';

logger.moduleLoaded('DynamicWaveformVisualizer');

/**
 * Dynamic Waveform Visualizer
 * Handles live/real-time waveform visualization during playback
 * Extracted from staticWaveformVisualizer.js for better separation of concerns
 */
class DynamicWaveformVisualizer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.currentColor = null;
        
        // Live playback visualization
        this.isPlaybackActive = false;
        this.liveAnalysers = new Map(); // Map of color -> analyser
        this.liveWaveforms = new Map(); // Map of color -> waveform data
        this.playbackAnimationId = null;
        
        // Speed control for waveform oscillation
        this.animationSpeed = 100; // Default 100%
        this.frameSkipCounter = 0;
        
        logger.info('DynamicWaveformVisualizer', 'Initialized for live waveform visualization', null, 'waveform');
    }

    initialize(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.currentColor = store.state.selectedNote?.color || '#4a90e2';
        
        this.setupEventListeners();
        
        logger.info('DynamicWaveformVisualizer', 'Initialized with canvas context', null, 'waveform');
        return true;
    }

    setupEventListeners() {
        // Listen for note color changes
        store.on('noteChanged', ({ newNote }) => {
            if (newNote.color && newNote.color !== this.currentColor) {
                this.currentColor = newNote.color;
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

        // Listen for tremolo amplitude updates for dynamic waveforms
        store.on('tremoloAmplitudeUpdate', ({ activeColors }) => {
            // Dynamic waveforms will apply tremolo during rendering - no regeneration needed
            if (this.isPlaybackActive && activeColors && activeColors.some(color => 
                this.liveWaveforms.has(color))) {
                // Tremolo will be applied in real-time during draw cycle
                logger.debug('DynamicWaveformVisualizer', 'Tremolo update received for active colors', activeColors, 'waveform');
            }
        });
        
        logger.info('DynamicWaveformVisualizer', 'Event subscriptions established', null, 'waveform');
    }

    setAnimationSpeed(percentage) {
        this.animationSpeed = percentage;
        this.frameSkipCounter = 0; // Reset counter when speed changes
    }

    startLiveVisualization() {
        if (this.isPlaybackActive) return;
        
        this.isPlaybackActive = true;
        this.setupLiveAnalysers();
        this.updateContainerState(true);
        this.animateLiveWaveforms();
        
        logger.debug('DynamicWaveformVisualizer', 'Started live visualization', null, 'waveform');
    }

    startSingleNoteVisualization(color) {
        if (this.isPlaybackActive) return;

        this.isPlaybackActive = true;
        this.setupSingleAnalyser(color);
        this.updateContainerState(true);
        this.animateLiveWaveforms();

        logger.debug('DynamicWaveformVisualizer', `Started single note visualization for ${color}`, null, 'waveform');
    }

    stopLiveVisualization() {
        this.isPlaybackActive = false;

        // Clean up analyzers
        this.liveAnalysers.forEach((analyser, color) => {
            if (window.synthEngine) {
                window.synthEngine.removeWaveformAnalyzer(color);
            }
        });

        this.liveAnalysers.clear();
        this.liveWaveforms.clear();
        
        if (this.playbackAnimationId) {
            cancelAnimationFrame(this.playbackAnimationId);
            this.playbackAnimationId = null;
        }
        
        this.updateContainerState(false);
        
        logger.debug('DynamicWaveformVisualizer', 'Stopped live visualization', null, 'waveform');
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
            logger.warn('DynamicWaveformVisualizer', 'SynthEngine not available for live analysis', null, 'waveform');
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
                logger.debug('DynamicWaveformVisualizer', `Created analyser for ${color}`, null, 'waveform');
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
            logger.debug('DynamicWaveformVisualizer', `Created single analyser for ${color}`, null, 'waveform');
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

        const result = Array.from(playingColors);
        logger.debug('DynamicWaveformVisualizer', 'Active playing colors detected', result, 'waveform');
        return result;
    }

    animateLiveWaveforms() {
        if (!this.isPlaybackActive) return;

        // Speed control: Skip frames based on animation speed
        this.frameSkipCounter++;
        const skipFrames = Math.floor(100 / this.animationSpeed);
        
        if (this.frameSkipCounter % skipFrames !== 0) {
            // Skip this frame, but continue the animation loop
            this.playbackAnimationId = requestAnimationFrame(() => this.animateLiveWaveforms());
            return;
        }

        // Update waveform data from each analyser (no smoothing for accurate peaks)
        this.liveAnalysers.forEach((analyser, color) => {
            const newWaveformArray = analyser.getValue();
            
            // Use raw waveform data directly - no smoothing
            this.liveWaveforms.set(color, newWaveformArray);
        });

        // Trigger redraw through external callback (to be set by parent)
        if (this.onWaveformUpdate) {
            this.onWaveformUpdate();
        }

        // Continue animation
        this.playbackAnimationId = requestAnimationFrame(() => this.animateLiveWaveforms());
    }

    drawLiveWaveforms(width, centerY, baseAmplitude) {
        const colors = Array.from(this.liveWaveforms.keys());

        if (colors.length === 1) {
            // Single color - draw normal waveform
            const color = colors[0];
            const waveform = this.liveWaveforms.get(color);
            this.drawSingleLiveWaveform(waveform, color, width, centerY, baseAmplitude);
        } else if (colors.length > 1) {
            // Multiple colors - draw layered waveforms with transparency
            colors.forEach((color, index) => {
                const waveform = this.liveWaveforms.get(color);
                this.drawLayeredLiveWaveform(waveform, color, width, centerY, baseAmplitude, colors.length);
            });
        }
    }

    drawSingleLiveWaveform(waveform, color, width, centerY, baseAmplitude) {
        // Use live audio data for dynamic waveform visualization
        if (!waveform || waveform.length === 0) {
            return;
        }

        // Apply tremolo modulation to amplitude for dynamic waveforms
        let amplitude = baseAmplitude;
        let tremoloMultiplier = 1.0;

        if (window.animationEffectsManager && color) {
            tremoloMultiplier = window.animationEffectsManager.getTremoloAmplitudeMultiplier(color);
            amplitude = amplitude * tremoloMultiplier;
        }

        // Get vibrato horizontal stretch factor
        let vibratoStretch = 0; // 0 = no stretch, positive = compress (higher freq), negative = expand (lower freq)
        if (window.animationEffectsManager && window.animationEffectsManager.vibratoCanvasEffect) {
            const vibratoEffect = window.animationEffectsManager.vibratoCanvasEffect;
            const animation = vibratoEffect.animations.get(color);

            if (animation && vibratoEffect.shouldBeRunning()) {
                // Get the current phase sine value
                const sineValue = Math.sin(animation.phase);

                // Positive sine = pitch going up = higher frequency = compress waveform (positive stretch)
                // Map amplitude (in semitones) to horizontal stretch factor
                // amplitude of 0.5 semitones (max) should give ~20% stretch
                vibratoStretch = sineValue * animation.amplitude * 0.4; // 0.5 * 0.4 = 0.2 (20% max stretch)
            }
        }

        // Apply normalization to keep peak at 1.0
        let maxAmp = 0;
        for (let i = 0; i < waveform.length; i++) {
            maxAmp = Math.max(maxAmp, Math.abs(waveform[i]));
        }

        const normalizationFactor = maxAmp > 1.0 ? 1.0 / maxAmp : 1.0;

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();

        // Base samples per pixel, modified by vibrato stretch
        // Positive stretch = more samples per pixel = compressed waveform
        const baseSpread = waveform.length / width;
        const stretchedSpread = baseSpread * (1 + vibratoStretch);

        for (let x = 0; x < width; x++) {
            // Apply horizontal shift to the right
            const shiftAmount = vibratoStretch * width * 0.3; // 30% of width max shift
            const shiftedX = x + shiftAmount;

            // Sample from stretched position
            const sampleIndex = Math.floor(shiftedX * stretchedSpread);
            const clampedIndex = Math.max(0, Math.min(waveform.length - 1, sampleIndex));
            const sample = (waveform[clampedIndex] || 0) * normalizationFactor;

            // Apply tremolo-modulated amplitude
            const y = centerY - (sample * amplitude);

            if (x === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.stroke();

        logger.debug('DynamicWaveformVisualizer', `Drew single live waveform for ${color} with tremolo and vibrato stretch`,
            { tremoloMultiplier: amplitude / baseAmplitude, vibratoStretch }, 'waveform');
    }

    drawLayeredLiveWaveform(waveform, color, width, centerY, baseAmplitude, totalLayers) {
        if (!waveform || waveform.length === 0) return;

        // Apply tremolo modulation to amplitude for layered waveforms
        let amplitude = baseAmplitude;
        if (window.animationEffectsManager && color) {
            const tremoloMultiplier = window.animationEffectsManager.getTremoloAmplitudeMultiplier(color);
            amplitude = amplitude * tremoloMultiplier;
        }

        // Get vibrato horizontal stretch factor
        let vibratoStretch = 0;
        if (window.animationEffectsManager && window.animationEffectsManager.vibratoCanvasEffect) {
            const vibratoEffect = window.animationEffectsManager.vibratoCanvasEffect;
            const animation = vibratoEffect.animations.get(color);

            if (animation && vibratoEffect.shouldBeRunning()) {
                const sineValue = Math.sin(animation.phase);
                vibratoStretch = sineValue * animation.amplitude * 0.4;
            }
        }

        // Apply normalization
        let maxAmp = 0;
        for (let i = 0; i < waveform.length; i++) {
            maxAmp = Math.max(maxAmp, Math.abs(waveform[i]));
        }
        const normalizationFactor = maxAmp > 1.0 ? 1.0 / maxAmp : 1.0;

        const alpha = Math.max(0.4, 1.0 / totalLayers);
        const strokeColor = hexToRgba(color, alpha * 2);
        const fillColor = hexToRgba(color, alpha * 0.5);

        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();

        const baseSpread = waveform.length / width;
        const stretchedSpread = baseSpread * (1 + vibratoStretch);

        for (let x = 0; x < width; x++) {
            const shiftAmount = vibratoStretch * width * 0.3;
            const shiftedX = x + shiftAmount;

            const sampleIndex = Math.floor(shiftedX * stretchedSpread);
            const clampedIndex = Math.max(0, Math.min(waveform.length - 1, sampleIndex));
            const sample = (waveform[clampedIndex] || 0) * normalizationFactor;

            // Apply tremolo-modulated amplitude with layering reduction
            const y = centerY - (sample * amplitude * 0.7);

            if (x === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.stroke();
    }

    // Check if currently in live mode
    isLiveMode() {
        return this.isPlaybackActive;
    }

    // Get current live waveform colors
    getLiveColors() {
        return Array.from(this.liveWaveforms.keys());
    }

    dispose() {
        this.stopLiveVisualization();
        
        logger.info('DynamicWaveformVisualizer', 'Disposed', null, 'waveform');
    }
}

export default DynamicWaveformVisualizer;
