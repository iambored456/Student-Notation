// js/services/synthEngine.js
import * as Tone from 'tone';
import store from '../state/index.js';
import { PRESETS } from './presetData.js';
import logger from '../utils/logger.js';
import { getFilteredCoefficients } from '../components/audio/HarmonicsFilter/harmonicBins.js';

logger.moduleLoaded('SynthEngine');

let synths = {};
let volumeControl;
let limiter; // Add a limiter to the master output
let waveformAnalyzers = {}; // Store analyzers for waveform visualization

// A custom synth voice with a more sophisticated series/parallel filter blend
class FilteredVoice extends Tone.Synth {
    constructor(options) {
        super(options);

        // --- Create all necessary audio nodes ---
        this.presetGain = new Tone.Gain(options.gain || 1.0); // Gain node for preset volume compensation
        
        // Filters for the three distinct paths
        this.hpFilter = new Tone.Filter({ type: "highpass" });
        this.lpFilterForBP = new Tone.Filter({ type: "lowpass" }); // This LPF is part of the bandpass chain
        this.lpFilterSolo = new Tone.Filter({ type: "lowpass" }); // This LPF is for the pure lowpass sound

        // Gain nodes to tap the audio from different points in the chain
        this.hpOutput = new Tone.Gain();
        this.bpOutput = new Tone.Gain();
        this.lpOutput = new Tone.Gain();
        
        // Cross-faders to blend between the three outputs
        this.hp_bp_fade = new Tone.CrossFade(0); 
        this.main_fade = new Tone.CrossFade(0);
        
        // Wet/Dry control for filter bypass
        this.wetDryFade = new Tone.CrossFade(0);

        // --- UPDATED Audio Routing ---
        // 1. Oscillator -> Preset Gain Node
        this.oscillator.connect(this.presetGain);

        // 2. Preset Gain -> Dry Path & Wet Path (start)
        this.presetGain.connect(this.wetDryFade.a); // Dry Path
        
        // 3. Setup Wet Path (now fed from presetGain)
        // A) High-Pass path
        this.presetGain.connect(this.hpFilter);
        this.hpFilter.connect(this.hpOutput); // Tap the pure HP signal here

        // B) Band-Pass path (HPF -> LPF in series)
        this.hpFilter.connect(this.lpFilterForBP);
        this.lpFilterForBP.connect(this.bpOutput); // Tap the BP signal here
        
        // C) Low-Pass path (a separate, parallel LPF)
        this.presetGain.connect(this.lpFilterSolo);
        this.lpFilterSolo.connect(this.lpOutput); // Tap the pure LP signal here

        // 4. Route the three paths into the blender
        this.hpOutput.connect(this.hp_bp_fade.a);
        this.bpOutput.connect(this.hp_bp_fade.b);
        this.lpOutput.connect(this.main_fade.b);
        this.hp_bp_fade.connect(this.main_fade.a);

        // 5. Connect the blended (wet) signal to the wet/dry fader
        this.main_fade.connect(this.wetDryFade.b); 

        // 6. Final output goes to the main amplitude envelope
        this.wetDryFade.connect(this.envelope);

        if (options.filter) {
            this._setFilter(options.filter);
        }
    }

    _setPresetGain(value) {
        if (this.presetGain) {
            this.presetGain.gain.value = value;
        }
    }
    
    _setFilter(params) {
        this.wetDryFade.fade.value = params.enabled ? 1 : 0;

        const freq = Tone.Midi(params.cutoff + 35).toFrequency();
        const q = (params.resonance / 100) * 12 + 0.1;

        // Set parameters on all three filters
        this.hpFilter.set({ frequency: freq, Q: q });
        this.lpFilterForBP.set({ frequency: freq, Q: q });
        this.lpFilterSolo.set({ frequency: freq, Q: q });

        const blend = params.blend; 

        // Blend from HP (0) -> BP (1)
        if (blend <= 1.0) {
            this.main_fade.fade.value = 0; // Select the HP/BP fader
            this.hp_bp_fade.fade.value = blend;
        } 
        // Blend from BP (1) -> LP (2)
        else {
            this.main_fade.fade.value = blend - 1.0;
            this.hp_bp_fade.fade.value = 1.0; // Keep the input to the main fader as pure BP
        }
    }
}

const SynthEngine = {
    init() {
        // Add a limiter to the master output chain
        limiter = new Tone.Limiter(-1).toDestination(); // Don't let signal pass -1dB
        volumeControl = new Tone.Volume(-15).connect(limiter);
        
        for (const color in store.state.timbres) {
            const timbre = store.state.timbres[color];
            // Use filtered coefficients instead of raw store coefficients
            const filteredCoeffs = getFilteredCoefficients(color);
            
            // Dynamic amplitude scaling: use direct sum if ≤ 1.0, normalize if > 1.0
            const totalAmplitude = filteredCoeffs.reduce((sum, coeff) => sum + Math.abs(coeff), 0);
            const initialGain = totalAmplitude <= 1.0 ? totalAmplitude : 1.0;
            
            // Apply normalization to coefficients if total > 1.0
            const normalizedCoeffs = totalAmplitude > 1.0 
                ? filteredCoeffs.map(coeff => coeff / totalAmplitude)
                : filteredCoeffs;
            
            const synth = new Tone.PolySynth({
                polyphony: 8,
                voice: FilteredVoice,
                options: {
                    oscillator: { type: 'custom', partials: Array.from(normalizedCoeffs) },
                    envelope: timbre.adsr,
                    filter: timbre.filter,
                    gain: initialGain
                }
            }).connect(volumeControl);
            
            synths[color] = synth;
            logger.debug('SynthEngine', `Created filtered synth for color: ${color}`, null, 'audio');
        }

        store.on('timbreChanged', (color) => {
            this.updateSynthForColor(color);
        });
        
        store.on('filterChanged', (color) => {
            this.updateSynthForColor(color);
        });
        
        store.on('volumeChanged', (dB) => this.setVolume(dB));
        
        logger.info('SynthEngine', 'Initialized with multi-timbral support', null, 'audio');
        window.synthEngine = this;
    },

    updateSynthForColor(color) {
        const timbre = store.state.timbres[color];
        const synth = synths[color];
        if (!synth || !timbre) return;
        
        logger.debug('SynthEngine', `Updating timbre for color ${color}`, null, 'audio');
        
        // Use filtered coefficients instead of raw store coefficients
        const filteredCoeffs = getFilteredCoefficients(color);
        
        // Dynamic amplitude scaling: use direct sum if ≤ 1.0, normalize if > 1.0
        const totalAmplitude = filteredCoeffs.reduce((sum, coeff) => sum + Math.abs(coeff), 0);
        const dynamicGain = totalAmplitude <= 1.0 ? totalAmplitude : 1.0;
        
        // DEBUG: Log the coefficients being sent to the synth
        console.log(`[SynthEngine] Updating ${color} with coefficients:`, Array.from(filteredCoeffs));
        console.log(`[SynthEngine] Sum of coefficients:`, totalAmplitude);
        console.log(`[SynthEngine] Dynamic gain applied:`, dynamicGain);
        
        // Apply normalization to coefficients if total > 1.0
        const normalizedCoeffs = totalAmplitude > 1.0 
            ? filteredCoeffs.map(coeff => coeff / totalAmplitude)
            : filteredCoeffs;
            
        synth.set({
            oscillator: { partials: Array.from(normalizedCoeffs) },
            envelope: timbre.adsr
        });

        // Try setting gain on existing voices
        if (synth.voices && Array.isArray(synth.voices)) {
            console.log(`[SynthEngine] Setting gain on ${synth.voices.length} voices`);
            synth.voices.forEach((voice, index) => {
                if (voice._setFilter) {
                    voice._setFilter(timbre.filter);
                }
                if (voice._setPresetGain) {
                    console.log(`[SynthEngine] Voice ${index}: Setting presetGain to ${dynamicGain}`);
                    voice._setPresetGain(dynamicGain);
                    
                    // Check if the gain was actually set
                    if (voice.presetGain && voice.presetGain.gain) {
                        console.log(`[SynthEngine] Voice ${index}: Actual gain value is ${voice.presetGain.gain.value}`);
                    }
                } else {
                    console.log(`[SynthEngine] Voice ${index}: No _setPresetGain method found`);
                }
            });
        } else {
            console.log(`[SynthEngine] No voices array found or not array`);
        }
        
        // Also try setting the synth volume directly as a backup
        console.log(`[SynthEngine] Setting synth volume to ${dynamicGain}`);
        synth.volume.value = 20 * Math.log10(dynamicGain); // Convert linear to dB
        console.log(`[SynthEngine] Synth volume set to ${synth.volume.value} dB`);
    },
    
    setVolume(dB) {
        if (volumeControl) {
            volumeControl.volume.value = dB;
        }
    },

    async playNote(pitch, duration, time = Tone.now()) {
        // Use global audio initialization to ensure user gesture compliance
        const audioInit = window.initAudio || (() => Tone.start());
        await audioInit();
        const color = store.state.selectedNote.color;
        const synth = synths[color];
        if (synth) {
            synth.triggerAttackRelease(pitch, duration, time);
        }
    },

    triggerAttack(pitch, color, time = Tone.now()) {
        const synth = synths[color];
        if (synth) {
            synth.triggerAttack(pitch, time);
        }
    },
    
    triggerRelease(pitch, color, time = Tone.now()) {
        const synth = synths[color];
        if (synth) {
            synth.triggerRelease(pitch, time);
        }
    },

    releaseAll() {
        for (const color in synths) {
            synths[color].releaseAll();
        }
    },

    // ===============================================
    // WAVEFORM VISUALIZATION METHODS
    // ===============================================

    /**
     * Creates a waveform analyzer for a specific color/synth
     * @param {string} color - The color key for the synth
     * @returns {Tone.Analyser} The analyser node
     */
    createWaveformAnalyzer(color) {
        const synth = synths[color];
        if (!synth) {
            logger.warn('SynthEngine', `No synth found for color: ${color}`, null, 'audio');
            return null;
        }

        // Create analyzer if it doesn't exist
        if (!waveformAnalyzers[color]) {
            waveformAnalyzers[color] = new Tone.Analyser('waveform', 1024);
            
            // Connect the synth output to the analyzer (before it goes to volume control)
            // We need to tap into the synth's output without affecting the audio routing
            synth.connect(waveformAnalyzers[color]);
            
            logger.debug('SynthEngine', `Created waveform analyzer for color: ${color}`, null, 'waveform');
        }

        return waveformAnalyzers[color];
    },

    /**
     * Gets the waveform analyzer for a specific color
     * @param {string} color - The color key
     * @returns {Tone.Analyser|null} The analyser node or null if not found
     */
    getWaveformAnalyzer(color) {
        return waveformAnalyzers[color] || null;
    },

    /**
     * Gets all active waveform analyzers
     * @returns {Map<string, Tone.Analyser>} Map of color to analyzer
     */
    getAllWaveformAnalyzers() {
        const activeAnalyzers = new Map();
        for (const color in waveformAnalyzers) {
            if (waveformAnalyzers[color]) {
                activeAnalyzers.set(color, waveformAnalyzers[color]);
            }
        }
        return activeAnalyzers;
    },

    /**
     * Removes a waveform analyzer for a specific color
     * @param {string} color - The color key
     */
    removeWaveformAnalyzer(color) {
        if (waveformAnalyzers[color]) {
            waveformAnalyzers[color].dispose();
            delete waveformAnalyzers[color];
            logger.debug('SynthEngine', `Removed waveform analyzer for color: ${color}`, null, 'waveform');
        }
    },

    /**
     * Cleans up all waveform analyzers
     */
    disposeAllWaveformAnalyzers() {
        for (const color in waveformAnalyzers) {
            if (waveformAnalyzers[color]) {
                waveformAnalyzers[color].dispose();
            }
        }
        waveformAnalyzers = {};
        logger.debug('SynthEngine', 'Disposed all waveform analyzers', null, 'waveform');
    },

    /**
     * Gets the synth instance for a specific color (for advanced integrations)
     * @param {string} color - The color key
     * @returns {Tone.PolySynth|null} The synth instance or null if not found
     */
    getSynth(color) {
        return synths[color] || null;
    },

    /**
     * Gets all synth instances
     * @returns {object} Object mapping colors to synth instances
     */
    getAllSynths() {
        return { ...synths };
    }
};

export default SynthEngine;