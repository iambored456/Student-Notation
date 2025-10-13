// js/components/StaticWaveform/staticWaveformVisualizer.js
import store from '../../state/index.js';
import { HARMONIC_BINS } from '../../core/constants.js';
import * as Tone from 'tone';
import { hexToRgba } from '../../utils/colorUtils.js';
import { getFilteredCoefficients } from '../audio/HarmonicsFilter/harmonicBins.js';
import DynamicWaveformVisualizer from '../DynamicWaveform/dynamicWaveformVisualizer.js';
import logger from '../../utils/logger.js';

logger.moduleLoaded('StaticWaveformVisualizer');


class StaticWaveformVisualizer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.currentColor = null;
        this.animationFrameId = null;
        this.waveformData = new Float32Array(512); // Sample points for smooth curve
        this.isInitialized = false;
        
        // Phase transition animation
        this.isTransitioning = false;
        this.transitionStartTime = 0;
        this.transitionDuration = 300; // milliseconds
        this.fromWaveform = null;
        this.toWaveform = null;
        this.transitionAnimationId = null;
        
        // Dynamic waveform visualizer for live playback
        this.dynamicVisualizer = new DynamicWaveformVisualizer();
        
        // Speed control for waveform oscillation
        this.animationSpeed = 100; // Default 100%
        this.frameSkipCounter = 0;
        
        logger.info('StaticWaveformVisualizer', 'Initialized with dynamic visualizer integration', null, 'waveform');
    }

    initialize() {
        // Find or create the canvas element
        this.canvas = document.getElementById('static-waveform-canvas');
        if (!this.canvas) {
            return false;
        }

        this.ctx = this.canvas.getContext('2d');
        this.currentColor = store.state.selectedNote?.color || '#4a90e2';
        
        // Set up resize observer
        const container = this.canvas.parentElement;
        if (container) {
            new ResizeObserver(() => this.resize()).observe(container);
        }
        
        this.resize();
        this.setupEventListeners();
        
        // Initialize dynamic visualizer with canvas context
        this.dynamicVisualizer.initialize(this.canvas, this.ctx);
        this.dynamicVisualizer.onWaveformUpdate = () => this.draw();
        
        this.generateWaveform();
        this.isInitialized = true;
        
        return true;
    }

    resize() {
        if (!this.canvas || !this.ctx) return;

        const container = this.canvas.parentElement;
        if (!container) return;

        const { clientWidth, clientHeight } = container;
        const currentCanvasWidth = this.canvas.width;
        const currentCanvasHeight = this.canvas.height;

        // If container is collapsed (hidden tab), don't resize to 0
        // This prevents the canvas from collapsing when tabs are switched
        // However, allow initial sizing by checking if we already have dimensions
        const shouldSkipResize = (clientWidth === 0 || clientHeight === 0) &&
            (this.canvas.width > 0 && this.canvas.height > 0);

        if (shouldSkipResize) {
            return;
        }

        // Only resize if there's a significant change (prevent 1px cascade loops)
        const widthDiff = Math.abs(clientWidth - currentCanvasWidth);
        const heightDiff = Math.abs(clientHeight - currentCanvasHeight);
        const significantChange = widthDiff > 2 || heightDiff > 2;

        if (significantChange) {
            // Set canvas size
            this.canvas.width = clientWidth;
            this.canvas.height = clientHeight;

            // Redraw after resize
            this.draw();
        }
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

        // Listen for waveform extended view changes
        store.on('waveformExtendedViewChanged', (isExtended) => {
            this.generateWaveform();
            this.updateToggleButton();
        });

        // Dynamic visualizer handles its own playback event listeners

        // Tremolo no longer affects static waveform - only dynamic waveforms get tremolo animation

        // Listen for tab changes to handle resize when Timbre tab becomes visible
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.dataset.tab;
                if (tabId === 'timbre') {
                    // Delay resize to allow tab to become fully visible
                    setTimeout(() => {
                        this.resize();
                    }, 100);
                }
            });
        });
        
        // Setup speed control buttons
        this.setupSpeedControls();

        // Setup waveform extend toggle button
        this.setupExtendToggle();
    }
    
    setupSpeedControls() {
        const speedButtons = document.querySelectorAll('.waveform-speed-btn');
        speedButtons.forEach(button => {
            button.addEventListener('click', () => {
                const speed = parseInt(button.dataset.speed);
                
                // Toggle functionality - if already active, deactivate
                if (button.classList.contains('active')) {
                    button.classList.remove('active');
                    this.setAnimationSpeed(100); // Default to 100% when no buttons active
                } else {
                    // Deactivate all other buttons and activate this one
                    speedButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    this.setAnimationSpeed(speed);
                }
            });
        });
    }
    
    setAnimationSpeed(percentage) {
        this.animationSpeed = percentage;
        this.frameSkipCounter = 0; // Reset counter when speed changes

        // Also update dynamic visualizer speed
        this.dynamicVisualizer.setAnimationSpeed(percentage);
    }

    setupExtendToggle() {
        const toggleButton = document.getElementById('waveform-extend-toggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', () => {
                store.toggleWaveformExtendedView();
            });

            // Set initial state
            this.updateToggleButton();
        }
    }

    updateToggleButton() {
        const toggleButton = document.getElementById('waveform-extend-toggle');
        if (toggleButton) {
            const isExtended = store.state.waveformExtendedView;
            toggleButton.classList.toggle('extended', isExtended);
            toggleButton.textContent = isExtended ? '480° View' : '360° View';
            toggleButton.title = isExtended ? 'Switch to 360° waveform view' : 'Switch to 480° waveform view (shows extra 120°)';
        }
    }

    generateWaveform() {
        // Don't generate new waveform during transitions
        if (this.isTransitioning) return;
        
        if (!this.currentColor) return;

        const timbre = store.state.timbres[this.currentColor];
        if (!timbre || !timbre.coeffs) return;

        // Use filtered coefficients to show the effect of filtering on the waveform
        const coeffs = getFilteredCoefficients(this.currentColor);
        const phases = timbre.phases || [];
        const numSamples = this.waveformData.length;
        
        // Use default amplitude (amplitude normalization feature removed)
        const masterAmplitude = 1.0;
        
        // DEBUG: Log coefficient changes
        const nonZeroCoeffs = [];
        for (let i = 0; i < coeffs.length; i++) {
            if (coeffs[i] > 0.001) {
                nonZeroCoeffs.push(`${i === 0 ? 'F0' : 'H' + (i + 1)}: ${coeffs[i].toFixed(3)}`);
            }
        }
        
        // Clear the waveform data
        this.waveformData.fill(0);

        // Generate waveform using additive synthesis
        let maxGeneratedAmp = 0;
        for (let sample = 0; sample < numSamples; sample++) {
            // Phase range depends on extended view setting: 360° (2π) or 480° (4/3 * 2π)
            const maxDegrees = store.state.waveformExtendedView ? 480 : 360;
            const phaseMultiplier = maxDegrees / 360; // 1.0 for 360°, 4/3 for 480°
            const phase = (sample / numSamples) * phaseMultiplier * 2 * Math.PI;
            let amplitude = 0;

            // Add each harmonic (H1, H2, H3, etc. - no fundamental F0 in harmonic bins)
            for (let i = 0; i < HARMONIC_BINS; i++) {
                const coeff = coeffs[i] || 0;
                if (coeff > 0.001) { // Skip very small coefficients for performance
                    const phaseOffset = phases[i] || 0;
                    // Harmonics are 1-based: H1=1, H2=2, H3=3, etc.
                    const harmonicMultiplier = i + 1;
                    amplitude += coeff * Math.sin(harmonicMultiplier * phase + phaseOffset);
                }
            }

            // Apply master amplitude scaling
            this.waveformData[sample] = amplitude * masterAmplitude;
            maxGeneratedAmp = Math.max(maxGeneratedAmp, Math.abs(amplitude * masterAmplitude));
        }
 

        // Store the calculated amplitude for ADSR use
        this.calculatedAmplitude = Math.min(1.0, maxGeneratedAmp);
        
        // Normalize amplitude to keep peak at 1.0
        if (maxGeneratedAmp > 1.0) {
            const normalizationFactor = 1.0 / maxGeneratedAmp;
            for (let i = 0; i < this.waveformData.length; i++) {
                this.waveformData[i] *= normalizationFactor;
            }
        }
        
        this.draw();
    }

    // Start a phase transition animation
    startPhaseTransition(fromPhases, toPhases, harmonicIndex) {
        if (this.isTransitioning) {
            // Cancel any existing transition
            if (this.transitionAnimationId) {
                cancelAnimationFrame(this.transitionAnimationId);
            }
        }

        
        // Store current waveform as the starting point
        this.fromWaveform = new Float32Array(this.waveformData);
        
        // Generate target waveform with new phase
        this.generateTargetWaveform(toPhases);
        this.toWaveform = new Float32Array(this.waveformData);
        
        // Restore original waveform for transition
        this.waveformData = this.fromWaveform;
        
        // Start transition
        this.isTransitioning = true;
        this.transitionStartTime = performance.now();
        this.animateTransition();
    }

    generateTargetWaveform(targetPhases) {
        if (!this.currentColor) return;

        const timbre = store.state.timbres[this.currentColor];
        if (!timbre || !timbre.coeffs) return;

        // Use filtered coefficients to show the effect of filtering on the waveform
        const coeffs = getFilteredCoefficients(this.currentColor);
        const numSamples = this.waveformData.length;
        const masterAmplitude = 1.0;
        
        // Clear the waveform data
        this.waveformData.fill(0);
        let maxGeneratedAmp = 0;

        for (let sample = 0; sample < numSamples; sample++) {
            // Phase range depends on extended view setting: 360° (2π) or 480° (4/3 * 2π)
            const maxDegrees = store.state.waveformExtendedView ? 480 : 360;
            const phaseMultiplier = maxDegrees / 360; // 1.0 for 360°, 4/3 for 480°
            const phase = (sample / numSamples) * phaseMultiplier * 2 * Math.PI;
            let amplitude = 0;

            for (let i = 0; i < HARMONIC_BINS; i++) {
                const coeff = coeffs[i] || 0;
                if (coeff > 0.001) {
                    const phaseOffset = targetPhases[i] || 0;
                    const harmonicMultiplier = i + 1;
                    amplitude += coeff * Math.sin(harmonicMultiplier * phase + phaseOffset);
                }
            }

            this.waveformData[sample] = amplitude * masterAmplitude;
            maxGeneratedAmp = Math.max(maxGeneratedAmp, Math.abs(amplitude * masterAmplitude));
        }

        // Store the calculated amplitude for ADSR use
        this.calculatedAmplitude = Math.min(1.0, maxGeneratedAmp);
        
        // Normalize amplitude to keep peak at 1.0
        if (maxGeneratedAmp > 1.0) {
            const normalizationFactor = 1.0 / maxGeneratedAmp;
            for (let i = 0; i < this.waveformData.length; i++) {
                this.waveformData[i] *= normalizationFactor;
            }
        }
    }

    animateTransition() {
        if (!this.isTransitioning) return;

        const elapsed = performance.now() - this.transitionStartTime;
        const progress = Math.min(elapsed / this.transitionDuration, 1.0);
        
        // Smooth easing function (ease-out)
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        
        // Interpolate between from and to waveforms
        for (let i = 0; i < this.waveformData.length; i++) {
            this.waveformData[i] = this.fromWaveform[i] + 
                (this.toWaveform[i] - this.fromWaveform[i]) * easedProgress;
        }
        
        // Redraw with interpolated waveform
        this.draw();
        
        if (progress >= 1.0) {
            // Transition complete
            this.isTransitioning = false;
            this.fromWaveform = null;
            this.toWaveform = null;
            this.transitionAnimationId = null;
        } else {
            // Continue animation
            this.transitionAnimationId = requestAnimationFrame(() => this.animateTransition());
        }
    }

    normalizeWaveform() {
        let maxAmp = 0;
        for (let i = 0; i < this.waveformData.length; i++) {
            maxAmp = Math.max(maxAmp, Math.abs(this.waveformData[i]));
        }
        
        
        if (maxAmp > 0) {
            const normalizer = 0.9 / maxAmp; // Leave some headroom but use most of the display area
            for (let i = 0; i < this.waveformData.length; i++) {
                this.waveformData[i] *= normalizer;
            }
        }
    }

    draw() {
        if (!this.ctx || !this.canvas) return;

        const { width, height } = this.canvas;
        const centerY = height / 2;
        const amplitude = height / 2; // Base amplitude for full height range from -1.0 to +1.0 (no tremolo for static)

        // Clear canvas
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, width, height);

        // Draw grid lines (use base amplitude so grid stays stable)
        this.drawGrid(width, height, centerY, amplitude);

        if (this.dynamicVisualizer.isLiveMode()) {
            // Draw live waveforms with tremolo animation via dynamic visualizer
            this.dynamicVisualizer.drawLiveWaveforms(width, centerY, amplitude);
        } else {
            // Draw static waveform (no tremolo animation)
            this.drawWaveform(width, centerY, amplitude);
        }

        // Draw labels if there's space
        if (width > 200 && height > 100) {
            this.drawLabels(width, height);
        }
    }

    drawGrid(width, height, centerY, amplitude) {
        this.ctx.strokeStyle = '#ced4da';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 2]);

        // Horizontal center line
        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(width, centerY);
        this.ctx.stroke();

        // Dynamic grid lines based on extended view setting
        const maxDegrees = store.state.waveformExtendedView ? 480 : 360;
        const gridDegrees = store.state.waveformExtendedView ?
            [90, 180, 270, 360, 450] :
            [90, 180, 270];

        gridDegrees.forEach(degree => {
            const x = (width / maxDegrees) * degree;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        });

        // Add the 360-480° shaded region only in extended view
        if (store.state.waveformExtendedView) {
            const deg360Position = (width / 480) * 360; // Position where 360° occurs
            this.ctx.fillStyle = 'rgba(128, 128, 128, 0.15)'; // Light gray overlay
            this.ctx.fillRect(deg360Position, 0, width - deg360Position, height);
        }

        // Amplitude reference lines (dashed) - only at ±0.5
        const ampLines = [0.5];
        ampLines.forEach(amp => {
            const y1 = centerY - (amplitude * amp);
            const y2 = centerY + (amplitude * amp);

            this.ctx.beginPath();
            this.ctx.moveTo(0, y1);
            this.ctx.lineTo(width, y1);
            this.ctx.moveTo(0, y2);
            this.ctx.lineTo(width, y2);
            this.ctx.stroke();
        });

        this.ctx.setLineDash([]);
        
        // Solid lines at +1.0 and -1.0 amplitude
        this.ctx.strokeStyle = '#999999';
        this.ctx.lineWidth = 1;
        
        const maxY = centerY - amplitude; // +1.0 position
        const minY = centerY + amplitude; // -1.0 position
        
        // Draw +1.0 line
        this.ctx.beginPath();
        this.ctx.moveTo(0, maxY);
        this.ctx.lineTo(width, maxY);
        this.ctx.stroke();
        
        // Draw -1.0 line
        this.ctx.beginPath();
        this.ctx.moveTo(0, minY);
        this.ctx.lineTo(width, minY);
        this.ctx.stroke();
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



    drawLabels(width, height) {
        this.ctx.fillStyle = '#666666';
        this.ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        this.ctx.textAlign = 'center';

        // Dynamic labels based on extended view setting
        const maxDegrees = store.state.waveformExtendedView ? 480 : 360;
        const labels = store.state.waveformExtendedView ?
            ['0°', '90°', '180°', '270°', '360°', '450°'] :
            ['0°', '90°', '180°', '270°', '360°'];
        const degrees = store.state.waveformExtendedView ?
            [0, 90, 180, 270, 360, 450] :
            [0, 90, 180, 270, 360];

        labels.forEach((label, i) => {
            const x = (width / maxDegrees) * degrees[i] + 10; // Position based on actual degree value
            this.ctx.fillText(label, x, height / 2 + 4);
        });

        // Amplitude labels (removed 0.0)
        this.ctx.textAlign = 'left';
        this.ctx.fillText('+1.0', 5, 15);
        this.ctx.fillText('-1.0', 5, height - 8);
    }

    getNormalizedAmplitude() {
        return this.calculatedAmplitude || 0;
    }
    
    
    getADSRTremoloAmplitude() {
        const baseAmplitude = this.calculatedAmplitude || 0;
        
        // Apply tremolo modulation that resets per note (for ADSR envelope)
        if (window.animationEffectsManager && this.currentColor) {
            const tremoloMultiplier = window.animationEffectsManager.getADSRTremoloAmplitudeMultiplier(this.currentColor);
            return baseAmplitude * tremoloMultiplier;
        }
        
        return baseAmplitude;
    }

    // Delegation methods for backward compatibility with pitchGridInteractor
    startSingleNoteVisualization(color) {
        return this.dynamicVisualizer.startSingleNoteVisualization(color);
    }

    stopLiveVisualization() {
        return this.dynamicVisualizer.stopLiveVisualization();
    }

    startLiveVisualization() {
        return this.dynamicVisualizer.startLiveVisualization();
    }

    dispose() {
        // Dispose dynamic visualizer
        this.dynamicVisualizer.dispose();
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Clean up transition animations
        if (this.transitionAnimationId) {
            cancelAnimationFrame(this.transitionAnimationId);
            this.transitionAnimationId = null;
        }
        this.isTransitioning = false;
        this.fromWaveform = null;
        this.toWaveform = null;
        
        this.isInitialized = false;
    }
}

// Create singleton instance
const staticWaveformVisualizer = new StaticWaveformVisualizer();

// Make it globally accessible for phase transition animations
window.staticWaveformVisualizer = staticWaveformVisualizer;

export function initStaticWaveformVisualizer() {
    return staticWaveformVisualizer.initialize();
}

export default staticWaveformVisualizer;