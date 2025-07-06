// js/services/presetData.js
import { HARMONIC_BINS } from '../constants.js';

console.log("PresetData: Module loaded.");

const BINS = HARMONIC_BINS;

// Helper to create a default filter state for presets
const defaultFilter = {
    blend: 2.0,
    cutoff: 31,
    resonance: 0,
    type: 'lowpass'
};

// --- Private Helper Functions for Generating Coefficients ---
function generateSineCoeffs() {
    const coeffs = new Float32Array(BINS).fill(0);
    coeffs[1] = 1;
    return coeffs;
}

function generateSquareCoeffs() {
    const coeffs = new Float32Array(BINS).fill(0);
    for (let n = 1; n < BINS; n += 2) {
        coeffs[n] = 1 / n;
    }
    return coeffs;
}

function generateTriangleCoeffs() {
    const coeffs = new Float32Array(BINS).fill(0);
    for (let n = 1; n < BINS; n += 2) {
        coeffs[n] = 1 / (n * n);
    }
    return coeffs;
}

function generateSawtoothCoeffs() {
    const coeffs = new Float32Array(BINS).fill(0);
    for (let n = 1; n < BINS; n++) {
        coeffs[n] = 1 / n;
    }
    return coeffs;
}

// --- Public Preset Definitions ---
const basicWaveADSR = { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.3 };

export const PRESETS = {
    // Basic Waveforms
    sine: {
        name: 'sine',
        gain: 1.0, // Sine is our quietest baseline, so no reduction.
        adsr: basicWaveADSR,
        coeffs: generateSineCoeffs(),
        filter: { ...defaultFilter }
    },
    triangle: {
        name: 'triangle',
        gain: 0.8, // Triangle is a bit louder than sine.
        adsr: basicWaveADSR,
        coeffs: generateTriangleCoeffs(),
        filter: { ...defaultFilter }
    },
    square: {
        name: 'square',
        gain: 0.4, // Square waves are significantly louder.
        adsr: basicWaveADSR,
        coeffs: generateSquareCoeffs(),
        filter: { ...defaultFilter }
    },
    sawtooth: {
        name: 'sawtooth',
        gain: 0.5, // Sawtooth is also very loud.
        adsr: basicWaveADSR,
        coeffs: generateSawtoothCoeffs(),
        filter: { ...defaultFilter }
    },

    // Instrument Presets
    piano: {
        name: 'piano',
        gain: 0.8, // Piano has a sharp attack but decays, so can be reasonably loud.
        adsr: { attack: 0.01, decay: 0.8, sustain: 0.1, release: 1.0 },
        coeffs: (() => {
            const c = new Float32Array(BINS).fill(0);
            for (let n = 1; n < 20; n++) {
                c[n] = (1 / (n * n)) * Math.pow(0.85, n);
            }
            return c;
        })(),
        filter: { ...defaultFilter, cutoff: 28 } // Slightly closed filter for piano
    },
    strings: {
        name: 'strings',
        gain: 0.5, // Based on a sawtooth, so needs reduction.
        adsr: { attack: 0.4, decay: 0.1, sustain: 0.9, release: 0.5 },
        coeffs: generateSawtoothCoeffs(),
        filter: { ...defaultFilter }
    },
    woodwind: {
        name: 'woodwind',
        gain: 0.6, // Based on a square wave, needs reduction.
        adsr: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.3 },
        coeffs: generateSquareCoeffs(),
        filter: { ...defaultFilter }
    },
    marimba: {
        name: 'marimba',
        gain: 0.9, // Percussive and sine-like, can be loud at the start.
        adsr: { attack: 0.01, decay: 0.8, sustain: 0, release: 0.8 },
        coeffs: (() => {
            const c = new Float32Array(BINS).fill(0);
            c[1] = 1;
            c[4] = 0.5;
            c[9] = 0.2;
            return c;
        })(),
        filter: { ...defaultFilter, cutoff: 25 }
    }
};