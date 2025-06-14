// js/services/synthEngine.js
import * as Tone from 'tone';
import store from '../state/store.js';

console.log("SynthEngine: Module loaded");

let synth, volumeControl, customEnv;

const SynthEngine = {
    init() {
        volumeControl = new Tone.Volume(-15).toDestination();
        synth = new Tone.PolySynth(Tone.Synth, {
            maxPolyphony: 8,
            oscillator: { type: 'sine' },
            envelope: store.state.adsr
        }).connect(volumeControl);

        // Listen for state changes
        store.on('adsrChanged', (newADSR) => this.updateEnvelope(newADSR));
        store.on('harmonicLevelsChanged', () => this.updateOscillatorPartialsDefault());
        
        console.log("SynthEngine: Initialized with Tone.js");
        window.synthEngine = this; // For spacebar handler and easy debugging
    },
    
    setOscillatorType(type) {
        if (synth) {
            // A special case: if setting a basic type, don't use partials
            if (['sine', 'triangle', 'square', 'sawtooth'].includes(type)) {
                synth.set({ oscillator: { type: type } });
            } else {
                // For custom types that rely on the multislider
                synth.set({ oscillator: { type: 'custom' } });
                this.updateOscillatorPartialsDefault();
            }
            console.log(`SynthEngine: Oscillator type set to ${type}`);
        }
    },
    
    updateOscillatorPartialsDefault() {
        // Logic remains the same, but reads from store.state.harmonicLevels
        const partials = store.state.harmonicLevels; // Simplified for brevity
        if (synth && synth.get().oscillator.type === 'custom') {
            synth.set({ oscillator: { partials }});
            console.log("SynthEngine: Partials updated for custom waveform.");
        }
    },
    
    updateEnvelope(newEnvelope) {
        if (synth) {
            synth.set({ envelope: newEnvelope });
            console.log("SynthEngine: Envelope updated", newEnvelope);
        }
    },
    
    setVolume(dB) {
        if (volumeControl) {
            volumeControl.volume.value = dB;
            console.log(`SynthEngine: Volume set to ${dB} dB`);
        }
    },

    async playNote(frequencyOrNote, duration, time = Tone.now()) {
        await Tone.start();
        // The core playback logic from your old file
        synth.triggerAttackRelease(frequencyOrNote, duration, time);
        console.log(`SynthEngine: Playing note ${frequencyOrNote}`);
    },

    triggerAttack(pitch) {
        if (customEnv) customEnv.triggerPlayhead(pitch, "attack");
        synth.triggerAttack(pitch);
    },
    
    triggerRelease(pitch) {
        if (customEnv) customEnv.triggerPlayhead(pitch, "release");
        synth.triggerRelease(pitch);
    },

    releaseAll() {
        if (synth) synth.releaseAll();
    },

    setCustomEnvelope(env) {
        customEnv = env;
    }
};

export default SynthEngine;