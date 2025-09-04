// js/components/ADSR/adsrComponent.js
import store from '../../../state/index.js';
import ui from './adsrUI.js';
import { initInteractions } from './adsrInteractions.js';
import { drawTempoGridlines, drawEnvelope, applyTheme } from './adsrRender.js';
import { initPlayheadManager } from './adsrPlayhead.js';
import GlobalService from '../../../services/globalService.js';
import logger from '../../../utils/logger.js';

export const MAX_ADSR_TIME_SECONDS = 2.5;

class AdsrComponent {
    constructor() {
        this.ui = ui.init();
        
        // THE FIX: Get color from the correct state property
        this.currentColor = store.state.selectedNote.color;
        this.attack = 0;
        this.decay = 0;
        this.sustain = 0;
        this.release = 0;
        this.width = 0;
        this.height = 0;
        
        this.createSVGLayers();
        this.resize();
        
        this.playheadManager = initPlayheadManager(this);
        GlobalService.adsrComponent = this;

        initInteractions(this);
        this.listenForStoreChanges();
        
        // Safety check for the container
        if (this.ui.container) {
            new ResizeObserver(() => this.resize()).observe(this.ui.container);
        }
        
        this.updateFromStore();
        logger.info('ADSR Component', 'Initialized', null, 'adsr');
    }
    
    resize() {
        if (!this.ui.container) return;
        this.width = this.ui.container.clientWidth;
        this.height = this.ui.container.clientHeight;
        if (this.svgContainer) {
            this.svgContainer.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);
        }
        this.render();
    }

    updateFromStore() {
        const timbre = store.state.timbres[this.currentColor];
        if (!timbre) return;
        
        ({ attack: this.attack, decay: this.decay, sustain: this.sustain, release: this.release } = timbre.adsr);

        this.render();
        this.updateControls();
    }

    listenForStoreChanges() {
        // THE FIX: Listen for 'noteChanged' to update the color, not 'toolChanged'
        store.on('noteChanged', ({ newNote }) => {
            if (newNote.color && newNote.color !== this.currentColor) {
                this.currentColor = newNote.color;
                this.updateFromStore();
            }
        });
        
        store.on('timbreChanged', (color) => {
            if (color === this.currentColor) this.updateFromStore();
        });

        store.on('tempoChanged', () => this.render());
        
        // Listen for tremolo amplitude updates to animate Attack and Sustain nodes
        store.on('tremoloAmplitudeUpdate', ({ activeColors }) => {
            // Only re-render ADSR during dynamic display (playback), not static
            const isDynamicDisplay = window.staticWaveformVisualizer?.dynamicVisualizer?.isLiveMode() || false;
            
            if (isDynamicDisplay && activeColors && activeColors.includes(this.currentColor)) {
                this.render();
            }
        });
        
        store.on('playbackStateChanged', ({ isPlaying, isPaused }) => {
            if (!isPlaying) {
                this.playheadManager.clearAll();
            } else if (isPaused) {
                this.playheadManager.pause();
            } else {
                this.playheadManager.resume();
            }
        });
        
        // Listen for tremolo amplitude updates (only tremolo affects ADSR)
        store.on('tremoloAmplitudeUpdate', ({ activeColors }) => {
            // Redraw if current color is affected by tremolo
            if (activeColors && activeColors.includes(this.currentColor)) {
                this.render();
            }
        });
    }

    createSVGLayers() {
        if (!this.ui.container) return;
        this.svgContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svgContainer.setAttribute("width", "100%");
        this.svgContainer.setAttribute("height", "100%");
        this.ui.container.appendChild(this.svgContainer);

        this.gridLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.svgContainer.appendChild(this.gridLayer);

        this.envelopeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.svgContainer.appendChild(this.envelopeLayer);
        
        this.nodeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.svgContainer.appendChild(this.nodeLayer);
        
        this.playheadLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.svgContainer.appendChild(this.playheadLayer);
    }
    
    calculateEnvelopePoints(sourceAdsr = this) {
        const { attack, decay, sustain, release } = sourceAdsr;
        if (!this.width || !this.height) return [];
        const timeToX = (time) => (time / MAX_ADSR_TIME_SECONDS) * this.width;
        
        // Get tremolo-modulated amplitude for ADSR Attack and Sustain nodes
        // Only apply tremolo during dynamic display (playback), not static display
        let tremoloMultiplier = 1.0;
        const isDynamicDisplay = window.staticWaveformVisualizer?.dynamicVisualizer?.isLiveMode() || false;
        
        if (isDynamicDisplay && window.animationEffectsManager) {
            tremoloMultiplier = window.animationEffectsManager.getADSRTremoloAmplitudeMultiplier(this.currentColor);
        }
        
        // Get original waveform amplitude as reference
        const originalAmplitude = window.staticWaveformVisualizer?.calculatedAmplitude || 1.0;
        
        // Apply tremolo to the original amplitude
        const normalizedAmplitude = originalAmplitude * tremoloMultiplier;
        
        const p1 = { x: 0, y: this.height };
        const p2 = { x: timeToX(attack), y: this.height * (1 - normalizedAmplitude) }; // Use normalized amplitude for attack peak
        const p3 = { x: timeToX(attack + decay), y: this.height * (1 - Math.min(sustain * normalizedAmplitude, normalizedAmplitude)) }; // Apply tremolo to both sustain level and amplitude constraint
        const p4 = { x: timeToX(attack + decay + release), y: this.height };
        return [p1, p2, p3, p4];
    }
    
    render() {
        if (!this.ui || !this.width || !this.height) return;
        const dimensions = { width: this.width, height: this.height };
        const points = this.calculateEnvelopePoints();
        drawTempoGridlines(this.gridLayer, dimensions, MAX_ADSR_TIME_SECONDS);
        drawEnvelope(this.envelopeLayer, this.nodeLayer, points, dimensions, this.currentColor);
        applyTheme(this.ui.parentContainer, this.currentColor);
    }

    updateControls() {
        if (!this.ui.sustainThumb) return; // Safety check
        
        // Get tremolo-modulated amplitude for ADSR controls
        // Only apply tremolo during dynamic display (playback), not static display
        let tremoloMultiplier = 1.0;
        const isDynamicDisplay = window.staticWaveformVisualizer?.dynamicVisualizer?.isLiveMode() || false;
        
        if (isDynamicDisplay && window.animationEffectsManager) {
            tremoloMultiplier = window.animationEffectsManager.getADSRTremoloAmplitudeMultiplier(this.currentColor);
        }
        
        // Get original waveform amplitude as reference
        const originalAmplitude = window.staticWaveformVisualizer?.calculatedAmplitude || 1.0;
        
        // Apply tremolo to the original amplitude
        const normalizedAmplitude = originalAmplitude * tremoloMultiplier;
        const maxSustainPercent = normalizedAmplitude * 100;
        
        // If current sustain exceeds normalized amplitude, update it in store and component
        if (this.sustain > normalizedAmplitude) {
            const currentTimbre = store.state.timbres[this.currentColor];
            store.setADSR(this.currentColor, { ...currentTimbre.adsr, sustain: normalizedAmplitude });
            this.sustain = normalizedAmplitude; // Update local value immediately
        }
        
        const sustainPercent = this.sustain * 100;
        this.ui.sustainThumb.style.bottom = `${sustainPercent}%`;
        this.ui.sustainTrack.style.setProperty('--sustain-progress', `${sustainPercent}%`);
        
        // Update ineligible section styling
        const ineligiblePercent = 100 - maxSustainPercent;
        this.ui.sustainTrack.style.setProperty('--ineligible-height', `${ineligiblePercent}%`);
        
        const aPercent = (this.attack / MAX_ADSR_TIME_SECONDS) * 100;
        const dPercent = ((this.attack + this.decay) / MAX_ADSR_TIME_SECONDS) * 100;
        const rPercent = ((this.attack + this.decay + this.release) / MAX_ADSR_TIME_SECONDS) * 100;
        
        this.ui.thumbA.style.left = `${aPercent}%`;
        this.ui.thumbD.style.left = `${dPercent}%`;
        this.ui.thumbR.style.left = `${rPercent}%`;
        this.ui.multiSliderContainer.style.setProperty('--adr-progress', `${rPercent}%`);
        
        const formatTime = (t) => `${t.toFixed(3)}s`;
        const formatSustain = (s) => `${(s * 100).toFixed(0)}%`;

        this.ui.thumbA.title = `Attack: ${formatTime(this.attack)}`;
        this.ui.thumbD.title = `Decay: ${formatTime(this.decay)}`;
        this.ui.thumbR.title = `Release: ${formatTime(this.release)}`;
        this.ui.sustainThumb.title = `Sustain: ${formatSustain(this.sustain)}`;

        const attackNodeTitle = this.nodeLayer.querySelector('#attack-node > title');
        if (attackNodeTitle) attackNodeTitle.textContent = `Attack: ${formatTime(this.attack)}`;
        const decaySustainNodeTitle = this.nodeLayer.querySelector('#decay-sustain-node > title');
        if (decaySustainNodeTitle) decaySustainNodeTitle.textContent = `Decay: ${formatTime(this.decay)}\nSustain: ${formatSustain(this.sustain)}`;
        const releaseNodeTitle = this.nodeLayer.querySelector('#release-node > title');
        if (releaseNodeTitle) releaseNodeTitle.textContent = `Release: ${formatTime(this.release)}`;
    }
}

export function initAdsrComponent() {
    if (!document.getElementById('adsr-envelope')) return null;
    return new AdsrComponent();
}