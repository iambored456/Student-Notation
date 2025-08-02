// js/constants.js
// Number of harmonic bins used by the harmonic multislider.  Previously this
// value was 32, but the oscillator integration relies on 12 bins (F0 and
// harmonics H1–H11). When adjusting this value, ensure that the initial
// timbre state and associated UI elements are kept in sync.
export const HARMONIC_BINS = 12;
export const RESIZE_DEBOUNCE_DELAY = 50;
export const MIN_VISUAL_ROWS = 5;