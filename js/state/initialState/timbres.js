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
    return {
        timbres: {
            '#4a90e2': { name: 'Blue', adsr: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.3 }, coeffs: (() => { const c = new Float32Array(32).fill(0); c[1] = 1; return c; })(), activePresetName: 'sine', filter: createDefaultFilterState() },
            '#2d2d2d': { name: 'Black', adsr: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.3 }, coeffs: (() => { const c = new Float32Array(32).fill(0); for (let n = 1; n < 32; n += 2) { c[n] = 1 / n; } return c; })(), activePresetName: 'square', filter: createDefaultFilterState() },
            '#d66573': { name: 'Red', adsr: { attack: 0.01, decay: 0.8, sustain: 0.1, release: 0.5 }, coeffs: (() => { const c = new Float32Array(32).fill(0); for (let n = 1; n < 32; n++) { c[n] = 1 / n; } return c; })(), activePresetName: 'sawtooth', filter: createDefaultFilterState() },
            '#68a03f': { name: 'Green', adsr: { attack: 0.01, decay: 0.8, sustain: 0.1, release: 0.5 }, coeffs: (() => { const c = new Float32Array(32).fill(0); c[1] = 1; return c; })(), activePresetName: 'sine', filter: createDefaultFilterState() }
        },
        colorPalette: defaultColorPalette
    };
}