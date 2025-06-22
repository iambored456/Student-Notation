// js/services/synthEngine.js
import * as Tone from 'tone';
import store from '../state/store.js';

console.log("SynthEngine: Module loaded");

let synth, volumeControl, customEnv;

const SynthEngine = {
    init() {
        volumeControl = new Tone.Volume(-15).toDestination();
        synth = new Tone.PolySynth({
            polyphony: 8,
            options: {
                oscillator: {
                    type: 'custom' 
                },
            }
        }).connect(volumeControl);

        this.updateWaveformAndEnvelope(store.state.harmonicCoefficients, store.state.adsr);

        // Listen for audio parameter changes from the UI components
        store.on('adsrChanged', (newADSR) => this.updateWaveformAndEnvelope(store.state.harmonicCoefficients, newADSR));
        store.on('harmonicCoefficientsChanged', (coeffs) => this.updateWaveformAndEnvelope(coeffs, store.state.adsr));
        
        // FIX: Subscribe to the volumeChanged event to update the synth's volume
        store.on('volumeChanged', (dB) => this.setVolume(dB));
        
        console.log("SynthEngine: Initialized with a unified custom PolySynth.");
        window.synthEngine = this;
    },
    
    updateWaveformAndEnvelope(coeffs, adsr) {
        if (!synth || !coeffs || !adsr) return;
    
        console.log(`[SYNTH] Updating waveform and envelope.`);
        
        const partials = Array.from(coeffs).slice(1);
    
        synth.set({
            oscillator: {
                type: "custom",
                partials: partials
            },
            envelope: adsr
        });
    },
    
    setVolume(dB) {
        if (volumeControl) {
            volumeControl.volume.value = dB;
            console.log(`SynthEngine: Volume set to ${dB} dB`);
        }
    },

    async playNote(frequencyOrNote, duration, time = Tone.now()) {
        await Tone.start();
        synth.triggerAttackRelease(frequencyOrNote, duration, time);
        console.log(`SynthEngine: Playing note ${frequencyOrNote}`);
    },

    triggerAttack(pitch, time = Tone.now()) {
        if (customEnv) customEnv.triggerPlayhead(pitch, "attack");
        synth.triggerAttack(pitch, time);
    },
    
    triggerRelease(pitch, time = Tone.now()) {
        if (customEnv) customEnv.triggerPlayhead(pitch, "release");
        synth.triggerRelease(pitch, time);
    },

    releaseAll() {
        if (synth) synth.releaseAll();
    },

    setCustomEnvelope(env) {
        customEnv = env;
    }
};

export default SynthEngine; 