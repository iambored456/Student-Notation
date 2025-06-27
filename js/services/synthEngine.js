// js/services/synthEngine.js
import * as Tone from 'tone';
import store from '../state/store.js';

console.log("SynthEngine: Module loaded");

let synths = {};
let volumeControl;

// A custom synth voice with a more sophisticated series/parallel filter blend
class FilteredVoice extends Tone.Synth {
    constructor(options) {
        super(options);

        // --- Create all necessary audio nodes ---
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

        // --- Audio Routing ---
        // 1. Oscillator -> Dry Path & Wet Path (start)
        this.oscillator.connect(this.wetDryFade.a); // Dry Path
        
        // 2. Setup Wet Path
        // A) High-Pass path
        this.oscillator.connect(this.hpFilter);
        this.hpFilter.connect(this.hpOutput); // Tap the pure HP signal here

        // B) Band-Pass path (HPF -> LPF in series)
        this.hpFilter.connect(this.lpFilterForBP);
        this.lpFilterForBP.connect(this.bpOutput); // Tap the BP signal here
        
        // C) Low-Pass path (a separate, parallel LPF)
        this.oscillator.connect(this.lpFilterSolo);
        this.lpFilterSolo.connect(this.lpOutput); // Tap the pure LP signal here

        // 3. Route the three paths into the blender
        this.hpOutput.connect(this.hp_bp_fade.a);
        this.bpOutput.connect(this.hp_bp_fade.b);
        this.lpOutput.connect(this.main_fade.b);
        this.hp_bp_fade.connect(this.main_fade.a);

        // 4. Connect the blended (wet) signal to the wet/dry fader
        this.main_fade.connect(this.wetDryFade.b); 

        // 5. Final output goes to the main amplitude envelope
        this.wetDryFade.connect(this.envelope);

        if (options.filter) {
            this._setFilter(options.filter);
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
        volumeControl = new Tone.Volume(-15).toDestination();
        
        for (const color in store.state.timbres) {
            const timbre = store.state.timbres[color];
            const synth = new Tone.PolySynth({
                polyphony: 8,
                voice: FilteredVoice,
                options: {
                    oscillator: { type: 'custom', partials: Array.from(timbre.coeffs).slice(1) },
                    envelope: timbre.adsr,
                    filter: timbre.filter 
                }
            }).connect(volumeControl);
            
            synths[color] = synth;
            console.log(`[SynthEngine] Created filtered synth for color: ${color}`);
        }

        store.on('timbreChanged', (color) => {
            this.updateSynthForColor(color);
        });
        
        store.on('volumeChanged', (dB) => this.setVolume(dB));
        
        console.log("SynthEngine: Initialized with multi-timbral support.");
        window.synthEngine = this;
    },

    updateSynthForColor(color) {
        const timbre = store.state.timbres[color];
        const synth = synths[color];
        if (!synth || !timbre) return;
        
        console.log(`[SYNTH] Updating timbre for color ${color}`);
        
        synth.set({
            oscillator: { partials: Array.from(timbre.coeffs).slice(1) },
            envelope: timbre.adsr
        });

        if (synth.voices && Array.isArray(synth.voices)) {
            synth.voices.forEach(voice => {
                if (voice._setFilter) {
                    voice._setFilter(timbre.filter);
                }
            });
        }
    },
    
    setVolume(dB) {
        if (volumeControl) {
            volumeControl.volume.value = dB;
        }
    },

    async playNote(pitch, duration, time = Tone.now()) {
        await Tone.start();
        const color = store.state.selectedTool.color;
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
    }
};

export default SynthEngine;