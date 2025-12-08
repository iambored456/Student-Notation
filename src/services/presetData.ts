// js/services/presetData.ts
// ------------------------------------------------------------
// Preset spectra and ADSR data for Student Notation
// ------------------------------------------------------------
import { HARMONIC_BINS } from '@/core/constants.ts';

const BINS = HARMONIC_BINS;

interface Spectrum {
  coeffs: Float32Array;
  phases: Float32Array;
}

interface FilterConfig {
  blend: number;
  cutoff: number;
  resonance: number;
  type: string;
}

interface ADSRConfig {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

interface Preset {
  name: string;
  gain: number;
  adsr: ADSRConfig;
  coeffs: Float32Array;
  phases: Float32Array;
  filter: FilterConfig;
}

/*Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  Default filter shape (can be overridden per preset)
Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬*/
const defaultFilter: FilterConfig = {
  blend: 2.0,
  cutoff: 31,
  resonance: 0,
  type: 'lowpass'
};

/*Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  Utility helpers
Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬*/
function createEmptySpectrum(): Spectrum {
  return {
    coeffs:  new Float32Array(BINS).fill(0),
    phases:  new Float32Array(BINS).fill(0)
  };
}

/* Analytic waves ------------------------------------------------*/
function generateSine(): Spectrum {
  const spec = createEmptySpectrum();
  spec.coeffs[0] = 1;           // only fundamental (sin +)
  return spec;
}

function generateSquare(): Spectrum {
  const spec = createEmptySpectrum();
  for (let n = 1; n <= BINS; n += 2) {
    const i = n - 1;     // zero-based bin
    spec.coeffs[i] = 1 / n;  // 1, 1/3, 1/5, 1/7, 1/9, 1/11
    spec.phases[i] = 0; // All phases at 0
  }
  return spec;
}

function generateTriangle(): Spectrum {
  const spec = createEmptySpectrum();
  for (let n = 1; n <= BINS; n += 2) {
    const i        = n - 1;
    spec.coeffs[i] = 1 / (n * n);  // 1, 1/9, 1/25, Ã¢â‚¬Â¦
    // All phases at Ãâ‚¬/2 (matching original HTML specification)
    spec.phases[i] = Math.PI / 2;
  }
  return spec;
}

function generateSawtooth(): Spectrum {
  const spec = createEmptySpectrum();
  for (let n = 1; n <= BINS; n++) {
    const i        = n - 1;
    spec.coeffs[i] = 1 / n;
    // sin +/Ã¢â‚¬â€œ :     0 for odd n,  Ãâ‚¬ for even n
    spec.phases[i] = (n & 1) ? 0 : Math.PI;
  }
  return spec;
}

/*Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  Fixed spectra copied (or inferred) from the meettechniek demo.
  Each array lists up to 12 partials (fundamental = index 0).
Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬*/
const RAW_SPECTRA: Record<string, { amps: number[]; phases: number[] }> = {
  strings: { // Renamed from violin to match the UI button
    amps:   [0.995, 0.940, 0.425, 0.480, 0.000, 0.365,
      0.040, 0.085, 0.000, 0.090, 0.000, 0.000],
    phases: [0, Math.PI/2, 0, Math.PI/2, 0, Math.PI/2,
      0, Math.PI/2, 0, Math.PI/2, 0, 0]
  },
  piano: {
    amps:   [1.000, 0.700, 0.600, 0.500, 0.400, 0.320,
      0.250, 0.200, 0.170, 0.140, 0.120, 0.100],
    phases: Array(12).fill(0)
  },
  marimba: {
    // Strong 4th partial, otherwise sparse
    amps:   [1.000, 0.200, 0.150, 0.700, 0.050, 0.180,
      0.030, 0.050, 0.020, 0.010, 0.000, 0.000],
    phases: Array(12).fill(0)
  },
  woodwind: {
    // Clarinet-like (odd > even)
    amps:   [1.000, 0.050, 0.500, 0.050, 0.300, 0.050,
      0.200, 0.050, 0.120, 0.050, 0.080, 0.050],
    phases: Array(12).fill(0)
  }
};

/* Copy helper Ã‚Â­Ã‚Â­Ã‚Â­------------------------------------------------*/
function makeSpectrum(key: string): Spectrum {
  const spec   = createEmptySpectrum();
  const src    = RAW_SPECTRA[key];
  if (!src) {return spec;}
  const limit  = Math.min(BINS, src.amps.length);
  for (let i = 0; i < limit; i++) {
    spec.coeffs[i] = src.amps[i]   || 0;
    spec.phases[i] = src.phases[i] || 0;
  }
  return spec;
}

/*Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  Preset catalogue
Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬*/
const basicWaveADSR: ADSRConfig = { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.3 };

export const PRESETS: Record<string, Preset> = {
  /* Classic analytic waves (procedurally generated) */
  sine: {
    name: 'sine',
    gain: 1.0,  // Original amplitude: 1.0
    adsr: basicWaveADSR,
    ...generateSine(),
    filter: { ...defaultFilter }
  },
  triangle: {
    name: 'triangle',
    gain: 0.81,  // Original amplitude: 0.81 (from HTML)
    adsr: basicWaveADSR,
    ...generateTriangle(),
    filter: { ...defaultFilter }
  },
  square: {
    name: 'square',
    gain: 4 / Math.PI,  // Original amplitude: 4/Ãâ‚¬ Ã¢â€°Ë† 1.273
    adsr: basicWaveADSR,
    ...generateSquare(),
    filter: { ...defaultFilter }
  },
  sawtooth: {
    name: 'sawtooth',
    gain: 2 / Math.PI,  // Original amplitude: 2/Ãâ‚¬ Ã¢â€°Ë† 0.637
    adsr: basicWaveADSR,
    ...generateSawtooth(),
    filter: { ...defaultFilter }
  },

  /* NEW Presets from resourceOscillator.js */
  trapezium: {
    name: 'trapezium',
    gain: 4 / Math.PI,  // Original amplitude: 4/Ãâ‚¬ Ã¢â€°Ë† 1.273 (same as square)
    adsr: basicWaveADSR,
    coeffs: new Float32Array([0.993, 0, 0.314, 0, 0.168, 0, 0.101, 0, 0.06, 0, 0.033, 0]),
    phases: new Float32Array(BINS).fill(0),
    filter: { ...defaultFilter }
  },
  impulse: {
    name: 'impulse',
    gain: 0.18,  // Original amplitude: 0.18 (from HTML)
    adsr: { attack: 0.01, decay: 0.3, sustain: 0.0, release: 0.2 },
    coeffs: new Float32Array([1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0, 0]),
    phases: new Float32Array([0, Math.PI * 1.5, Math.PI, Math.PI / 2, 0, Math.PI * 1.5, Math.PI, Math.PI / 2, 0, Math.PI * 1.5, Math.PI, 0]),
    filter: { ...defaultFilter }
  },

  /* Instrument-style presets (fixed spectra) */
  strings: { // Renamed from 'violin'
    name: 'strings',
    gain: 0.49,  // Original amplitude: 0.49 (from HTML violin preset)
    adsr: { attack: 0.08, decay: 0.40, sustain: 0.70, release: 0.50 },
    ...makeSpectrum('strings'), // Use the renamed key
    filter: { ...defaultFilter, cutoff: 28 }
  },
  piano: {
    name: 'piano',
    gain: 0.8,
    adsr: { attack: 0.01, decay: 1.50, sustain: 0.00, release: 0.40 },
    ...makeSpectrum('piano'),
    filter: { ...defaultFilter, cutoff: 28 }
  },
  marimba: {
    name: 'marimba',
    gain: 0.9,
    adsr: { attack: 0.01, decay: 0.80, sustain: 0.00, release: 0.40 },
    ...makeSpectrum('marimba'),
    filter: { ...defaultFilter, cutoff: 25 }
  },
  woodwind: {
    name: 'woodwind',
    gain: 0.6,
    adsr: { attack: 0.10, decay: 0.20, sustain: 0.80, release: 0.30 },
    ...makeSpectrum('woodwind'),
    filter: { ...defaultFilter }
  }
};
