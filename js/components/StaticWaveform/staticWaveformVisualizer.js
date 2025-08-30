// js/components/StaticWaveform/staticWaveformVisualizer.js
import store from '../../state/index.js';
import { HARMONIC_BINS } from '../../core/constants.js';
import * as Tone from 'tone';
import { hexToRgba } from '../../utils/colorUtils.js';
import { getFilteredCoefficients } from '../audio/HarmonicsFilter/harmonicBins.js';


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
        
        // Phase transition animation
        this.isTransitioning = false;
        this.transitionStartTime = 0;
        this.transitionDuration = 300; // milliseconds
        this.fromWaveform = null;
        this.toWaveform = null;
        this.transitionAnimationId = null;
        
        // Speed control for waveform oscillation
        this.animationSpeed = 100; // Default 100%
        this.frameSkipCounter = 0;
    }

    initialize() {
        // Find or create the canvas element
        this.canvas = document.getElementById('static-waveform-canvas');
        if (!this.canvas) {
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
        // Listen for playback state changes to toggle live visualization
        store.on('playbackStateChanged', ({ isPlaying, isPaused }) => {
            console.log(`[StaticWaveform] Playback state changed: isPlaying=${isPlaying}, isPaused=${isPaused}`);
            if (isPlaying && !isPaused) {
                console.log(`[StaticWaveform] Starting live visualization`);
                this.startLiveVisualization();
            } else {
                console.log(`[StaticWaveform] Stopping live visualization`);
                this.stopLiveVisualization();
            }
        });

        // Listen for spacebar-triggered audition of a single note
        store.on('spacebarPlayback', ({ color, isPlaying }) => {
            console.log(`[StaticWaveform] Spacebar playback: color=${color}, isPlaying=${isPlaying}`);
            if (isPlaying) {
                console.log(`[StaticWaveform] Starting single note visualization for ${color}`);
                this.startSingleNoteVisualization(color);
            } else {
                console.log(`[StaticWaveform] Stopping single note visualization`);
                this.stopLiveVisualization();
            }
        });

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
                    console.log(`[StaticWaveform] Animation speed reset to 100% (default)`);
                } else {
                    // Deactivate all other buttons and activate this one
                    speedButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    this.setAnimationSpeed(speed);
                    console.log(`[StaticWaveform] Animation speed set to ${speed}%`);
                }
            });
        });
    }
    
    setAnimationSpeed(percentage) {
        this.animationSpeed = percentage;
        this.frameSkipCounter = 0; // Reset counter when speed changes
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
            // Extend phase to cover 480 degrees (4/3 * 2π)
            const phase = (sample / numSamples) * (4/3) * 2 * Math.PI;
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
            // Extend phase to cover 480 degrees (4/3 * 2π)
            const phase = (sample / numSamples) * (4/3) * 2 * Math.PI;
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
        const amplitude = height / 2; // Use full height range from -1.0 to +1.0

        // Clear canvas
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, width, height);

        // Draw grid lines
        this.drawGrid(width, height, centerY, amplitude);

        if (this.isPlaybackActive && this.liveWaveforms.size > 0) {
            // Log drawing mode occasionally 
            if (!this.drawCounter) this.drawCounter = 0;
            this.drawCounter++;
            if (this.drawCounter % 120 === 0) { // Every 2 seconds
                console.log(`[StaticWaveform] Drawing LIVE waveforms, count: ${this.liveWaveforms.size}`);
            }
            // Draw live waveforms with colors
            this.drawLiveWaveforms(width, centerY, amplitude);
        } else {
            if (!this.staticDrawLogged) {
                console.log(`[StaticWaveform] Drawing STATIC waveform`);
                this.staticDrawLogged = true;
            }
            // Draw static waveform
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

        // Vertical grid lines at quartile positions (excluding 0° at left edge)
        const gridDegrees = [90, 180, 270, 360, 450];
        gridDegrees.forEach(degree => {
            const x = (width / 480) * degree;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        });

        // Add the 360-480° shaded region
        const deg360Position = (width / 480) * 360; // Position where 360° occurs
        this.ctx.fillStyle = 'rgba(128, 128, 128, 0.15)'; // Light gray overlay
        this.ctx.fillRect(deg360Position, 0, width - deg360Position, height);

        // Amplitude reference lines (dashed)
        const ampLines = [0.25, 0.5, 0.75];
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

    drawLiveWaveforms(width, centerY, amplitude) {
        const colors = Array.from(this.liveWaveforms.keys());
        
        // Log once every 2 seconds what we're drawing
        if (!this.liveDrawCounter) this.liveDrawCounter = 0;
        this.liveDrawCounter++;
        if (this.liveDrawCounter % 120 === 0) {
            console.log(`[StaticWaveform] Drawing live waveforms for colors:`, colors);
        }
        
        if (colors.length === 1) {
            // Single color - draw normal waveform
            const color = colors[0];
            const waveform = this.liveWaveforms.get(color);
            if (this.liveDrawCounter % 120 === 0) {
                console.log(`[StaticWaveform] Single live waveform data length:`, waveform?.length, 'first sample:', waveform?.[0]);
            }
            // Use the same amplitude as static waveform for consistent scaling
            this.drawSingleLiveWaveform(waveform, color, width, centerY, amplitude);
        } else if (colors.length > 1) {
            // Multiple colors - draw layered waveforms with transparency
            colors.forEach((color, index) => {
                const waveform = this.liveWaveforms.get(color);
                this.drawLayeredLiveWaveform(waveform, color, width, centerY, amplitude, colors.length);
            });
        }
    }

    drawSingleLiveWaveform(waveform, color, width, centerY, amplitude) {
        // Use live audio data for dynamic waveform visualization
        if (!waveform || waveform.length === 0) {
            console.log(`[StaticWaveform] No waveform data for ${color}, falling back to static`);
            // Fallback to static waveform data
            if (this.waveformData && this.waveformData.length > 0) {
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
            }
            return;
        }

        // Draw the live waveform data
        console.log(`[StaticWaveform] Drawing LIVE data for ${color}, waveform length: ${waveform.length}`);
        
        // Apply the same normalization as static waveform to keep peak at 1.0
        let maxAmp = 0;
        for (let i = 0; i < waveform.length; i++) {
            maxAmp = Math.max(maxAmp, Math.abs(waveform[i]));
        }
        
        const normalizationFactor = maxAmp > 1.0 ? 1.0 / maxAmp : 1.0;
        console.log(`[StaticWaveform] Live waveform max amplitude: ${maxAmp.toFixed(3)}, normalization factor: ${normalizationFactor.toFixed(3)}`);
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();

        const samplesPerPixel = waveform.length / width;

        for (let x = 0; x < width; x++) {
            const sampleIndex = Math.floor(x * samplesPerPixel);
            const sample = (waveform[sampleIndex] || 0) * normalizationFactor;
            
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

        // Apply the same normalization as static waveform
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

        const samplesPerPixel = waveform.length / width;

        for (let x = 0; x < width; x++) {
            const sampleIndex = Math.floor(x * samplesPerPixel);
            const sample = (waveform[sampleIndex] || 0) * normalizationFactor;

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
        console.log(`[StaticWaveform] startLiveVisualization called, isPlaybackActive=${this.isPlaybackActive}`);
        if (this.isPlaybackActive) return;
        
        this.isPlaybackActive = true;
        console.log(`[StaticWaveform] Setting up live analysers...`);
        this.setupLiveAnalysers();
        this.updateContainerState(true);
        console.log(`[StaticWaveform] Starting animation loop...`);
        this.animateLiveWaveforms();
    }

    startSingleNoteVisualization(color) {
        if (this.isPlaybackActive) return;
        
        this.isPlaybackActive = true;
        this.setupSingleAnalyser(color);
        this.updateContainerState(true);
        this.animateLiveWaveforms();
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
            console.error(`[StaticWaveform] No synthEngine found on window object`);
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
        console.log(`[StaticWaveform] Live analyzers setup complete: ${this.liveAnalysers.size} analyzers`);
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

        const result = Array.from(playingColors);
        console.log(`[StaticWaveform] Active colors for live visualization:`, result);
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
            
            // Log waveform data every 60 processed frames
            if (!this.frameCounter) this.frameCounter = 0;
            this.frameCounter++;
            
            if (this.frameCounter % 60 === 0) {
                const firstFew = newWaveformArray.slice(0, 5);
                const max = Math.max(...newWaveformArray);
                const min = Math.min(...newWaveformArray);
                const rms = Math.sqrt(newWaveformArray.reduce((sum, val) => sum + val*val, 0) / newWaveformArray.length);
                console.log(`[StaticWaveform] ${color} raw waveform at ${this.animationSpeed}% speed - Range: ${min.toFixed(3)} to ${max.toFixed(3)}, RMS: ${rms.toFixed(3)}`);
            }
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

        // Quartile labels for sine wave - positioned in middle of waveform
        const labels = ['0°', '90°', '180°', '270°', '360°', '450°'];
        const degrees = [0, 90, 180, 270, 360, 450];
        labels.forEach((label, i) => {
            const x = (width / 480) * degrees[i] + 10; // Position based on actual degree value
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

    dispose() {
        this.stopLiveVisualization();
        
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