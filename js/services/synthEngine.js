// js/services/synthEngine.js
import * as Tone from 'tone';
import store from '../state/store.js';

console.log("SynthEngine: Module loaded");

let synths = {}; // Now an object to hold multiple synths
let volumeControl;

const SynthEngine = {
    init() {
        volumeControl = new Tone.Volume(-15).toDestination();
        
        // Create a synth for each timbre defined in the store
        for (const color in store.state.timbres) {
            const timbre = store.state.timbres[color];
            const synth = new Tone.PolySynth({
                polyphony: 8,
                options: {
                    oscillator: { type: 'custom', partials: Array.from(timbre.coeffs).slice(1) },
                    envelope: timbre.adsr
                }
            }).connect(volumeControl);
            synths[color] = synth;
            console.log(`[SynthEngine] Created synth for color: ${color}`);
        }

        // Listen for changes to any timbre
        store.on('timbreChanged', (color) => {
            this.updateSynthForColor(color);
        });
        
        store.on('volumeChanged', (dB) => this.setVolume(dB));
        
        console.log("SynthEngine: Initialized with multi-timbral support.");
        window.synthEngine = this; // For debugging
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
    },
    
    setVolume(dB) {
        if (volumeControl) {
            volumeControl.volume.value = dB;
        }
    },

    // This is now used for single-note previews (e.g., clicking on grid)
    async playNote(pitch, duration, time = Tone.now()) {
        await Tone.start();
        const color = store.state.selectedTool.color;
        const synth = synths[color];
        if (synth) {
            synth.triggerAttackRelease(pitch, duration, time);
        }
    },

    // Used by TransportService for scheduled playback
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