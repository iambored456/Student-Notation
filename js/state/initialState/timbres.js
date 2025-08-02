// js/state/initialState/timbres.js

export const createDefaultFilterState = () => ({
    enabled: false, blend: 2.0, cutoff: 16, resonance: 0, type: 'lowpass'
});

export const defaultColorPalette = {
    '#4a90e2': { primary: '#4a90e2', light: '#63a9fd' },
    '#68a03f': { primary: '#68a03f', light: '#80b958' },
    '#d66573': { primary: '#d66573', light: '#f27e8b' },
    '#2d2d2d': { primary: '#2d2d2d', light: '#424242' }
};

import { HARMONIC_BINS } from '../../constants.js';

export function getInitialTimbresState() {
    /**
     * Helper function to generate a default sine timbre.  Each timbre
     * contains an ADSR envelope, an array of harmonic amplitudes
     * (`coeffs`) and an array of harmonic phase offsets (`phases`).
     * The length of these arrays is dictated by `HARMONIC_BINS`.
     *
     * The first index (0) represents the fundamental (F0) amplitude and
     * phase.  Subsequent indices (1…HARMONIC_BINS-1) correspond to
     * harmonics H1, H2, etc.  For a pure sine, the fundamental has
     * amplitude 1 and zero phase; all other harmonics are silent.
     */
    const createSineTimbre = (name) => {
        // Initialize amplitude and phase arrays
        const coeffs = new Float32Array(HARMONIC_BINS).fill(0);
        const phases = new Float32Array(HARMONIC_BINS).fill(0);
        // Set fundamental amplitude to 1
        coeffs[0] = 1;
        return {
            name: name,
            adsr: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.3 },
            coeffs,
            phases,
            activePresetName: 'sine',
            filter: createDefaultFilterState(),
        };
    };

    return {
        timbres: {
            // All four colors now default to a sine wave
            '#4a90e2': createSineTimbre('Blue'),
            '#2d2d2d': createSineTimbre('Black'),
            '#d66573': createSineTimbre('Red'),
            '#68a03f': createSineTimbre('Green')
        },
        colorPalette: defaultColorPalette
    };
}