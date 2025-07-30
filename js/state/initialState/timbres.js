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

export function getInitialTimbresState() {
    // Helper function to generate a clean sine wave timbre object
    const createSineTimbre = (name) => ({
        name: name,
        adsr: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.3 },
        coeffs: (() => {
            const c = new Float32Array(32).fill(0);
            c[1] = 1; // Only the fundamental harmonic
            return c;
        })(),
        activePresetName: 'sine',
        filter: createDefaultFilterState()
    });

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