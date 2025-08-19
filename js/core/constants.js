// js/constants.js
// Number of harmonic bins used by the harmonic bins component.  Previously this
// value was 32, but the oscillator integration relies on 12 bins (harmonics
// H1–H12). When adjusting this value, ensure that the initial
// timbre state and associated UI elements are kept in sync.
export const HARMONIC_BINS = 12;
export const RESIZE_DEBOUNCE_DELAY = 50;
export const MIN_VISUAL_ROWS = 5;

// Layout and Grid Constants
export const DEFAULT_ZOOM_LEVEL = 1.0;
export const DEFAULT_SCROLL_POSITION = 0.52;
export const GRID_HEIGHT_MULTIPLIER = 2;
export const GRID_WIDTH_RATIO = 0.5;
export const SIDE_COLUMN_WIDTH = 3;
export const TONIC_COLUMN_WIDTH = 2;
export const BEAT_COLUMN_WIDTH = 1;
export const BASE_DRUM_ROW_HEIGHT = 30;
export const DRUM_HEIGHT_SCALE_FACTOR = 0.5;
export const DRUM_ROW_COUNT = 3;
export const BASE_HARMONY_HEIGHT = 30;
export const HARMONY_ROW_COUNT = 1;
export const MAX_ZOOM_LEVEL = 8.0;
export const MIN_ZOOM_LEVEL = 0.25;
export const ZOOM_IN_FACTOR = 1.25;
export const ZOOM_OUT_FACTOR = 0.8;

// Visual Rendering Constants
export const ROW_HEIGHT_RATIO = 0.5;
export const OVAL_NOTE_FONT_RATIO = 0.7;
export const FILLED_NOTE_FONT_RATIO = 0.9;
export const MIN_FONT_SIZE = 4;
export const MIN_TONIC_FONT_SIZE = 6;
export const MIN_STROKE_WIDTH_THICK = 1.5;
export const MIN_STROKE_WIDTH_THIN = 0.5;
export const STROKE_WIDTH_RATIO = 0.15;
export const TAIL_LINE_WIDTH_RATIO = 0.2;
export const MIN_TAIL_LINE_WIDTH = 1;
export const SHADOW_BLUR_RADIUS = 1.5;
export const TONIC_RADIUS_RATIO = 0.9;
export const MIN_TONIC_RADIUS = 2;
export const TONIC_BORDER_WIDTH = 2;
export const TONIC_FONT_SIZE_RATIO = 1.5;

// Color Constants
export const DEFAULT_GRAY_COLOR = '#CCCCCC';
export const NEUTRAL_PITCH_COLOR = '#888888';
export const HEX_COLOR_START_INDEX = 1;
export const HEX_RED_END_INDEX = 3;
export const HEX_GREEN_END_INDEX = 5;
export const HEX_BLUE_END_INDEX = 7;
export const HEX_RADIX = 16;
export const PITCH_CLASSES_COUNT = 12;
export const SHADE_BLACK_VALUE = 0;
export const SHADE_WHITE_VALUE = 255;

// Audio/Synth Constants
export const LIMITER_THRESHOLD_DB = -1;
export const DEFAULT_VOLUME_DB = -15;
export const SYNTH_POLYPHONY = 8;
export const FILTER_CUTOFF_OFFSET = 35;
export const RESONANCE_MULTIPLIER = 12;
export const MIN_Q_VALUE = 0.1;
export const RESONANCE_PERCENT_DIVISOR = 100;
export const WAVEFORM_BUFFER_SIZE = 1024;

// Filter Constants
export const FILTER_STEEPNESS = 4;
export const RESONANCE_DIVISOR = 105;
export const MIN_PEAK_WIDTH = 0.01;
export const PEAK_WIDTH_FACTOR = 0.2;
export const RESONANCE_GAIN_FACTOR = 0.6;
export const FILTER_HEIGHT_RATIO = 0.95;
export const FILTER_DRAW_STEP = 2;
export const FILTER_LINE_WIDTH = 2.5;

// Animation and Timing Constants
export const ZOOM_INDICATOR_TRANSITION_DURATION = 0.3; // seconds
export const ZOOM_INDICATOR_Z_INDEX = 1000;
export const ZOOM_PERCENT_MULTIPLIER = 100;
export const ZOOM_INDICATOR_HIDE_DELAY = 2000; // milliseconds

// Print Layout Constants
export const DEFAULT_MIN_PRINT_ROW = 34;
export const DEFAULT_MAX_PRINT_ROW = 54;