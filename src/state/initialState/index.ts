// js/state/initialState/index.ts
import { getInitialRhythmState } from './rhythm.js';
import { getInitialTimbresState } from './timbres.js';
import { fullRowData as masterRowData } from '../pitchData.js';
import type { AppState } from '../../../types/state.js';

/**
 * PITCH DATA ARCHITECTURE
 * =======================
 *
 * fullRowData: Contains the COMPLETE pitch gamut (A0-C8, 105 rows).
 *              This is NEVER sliced - all pitches are always available.
 *              Used for: pitch lookups, playback, data persistence.
 *
 * pitchRange:  Defines the currently VISIBLE/RENDERED portion of fullRowData.
 *              { topIndex, bottomIndex } are indices into fullRowData/masterRowData.
 *              Used for: viewport calculations, canvas rendering bounds.
 *
 * This separation ensures:
 * - Notes outside the viewport still play back correctly
 * - Pitch data is always available regardless of scroll/zoom position
 * - Rendering is virtualized (only visible rows drawn) for performance
 *
 * See src/utils/rowCoordinates.ts for coordinate system documentation.
 */

export const initialState: AppState = {
  // --- Data & History ---
  placedNotes: [],
  parkedNotes: [],
  placedChords: [],
  tonicSignGroups: {},
  stampPlacements: [],
  tripletPlacements: [],
  annotations: [],
  lassoSelection: {
    selectedItems: [], // Array of {type: 'note'|'stamp'|'triplet', id: uniqueId, data: originalObject}
    convexHull: null,  // Convex hull points for bounding border
    isActive: false    // Whether a lasso selection is currently active
  },
  history: [ { notes: [], parkedNotes: [], tonicSignGroups: {}, timbres: getInitialTimbresState().timbres, placedChords: [], stampPlacements: [], tripletPlacements: [], annotations: [], lassoSelection: { selectedItems: [], convexHull: null, isActive: false } } ],
  historyIndex: 0,
  // Full pitch gamut - NEVER sliced, all 107 pitches always available (C#8 to Ab0, including boundary rows)
  fullRowData: [...masterRowData],
  pitchRange: {
    topIndex: 0,
    bottomIndex: Math.max(0, (masterRowData?.length || 1) - 1)
  },

  // --- Rhythm ---
  ...getInitialRhythmState(),
  selectedModulationRatio: null,

  // --- Timbres & Colors ---
  ...getInitialTimbresState(),

  // --- UI & View State ---
  selectedTool: 'note',
  previousTool: 'note',
  selectedToolTonicNumber: 1,
  selectedNote: { shape: 'circle', color: '#4a90e2' },
  deviceProfile: {
    isMobile: false,
    isTouch: false,
    isCoarsePointer: false,
    orientation: 'landscape',
    width: 0,
    height: 0
  },
  activeChordId: null,
  activeChordIntervals: ['1P'], // Start with just root (U) selected
  isIntervalsInverted: false,
  chordPositionState: 0, // 0 = Root, 1 = 1st Inversion, 2 = 2nd Inversion

  gridPosition: 0,
  viewportRows: 0,
  logicRows: 0,
  cellWidth: 0,
  cellHeight: 0,
  columnWidths: [],
  musicalColumnWidths: [],
  degreeDisplayMode: 'off',
  accidentalMode: { sharp: true, flat: true },
  showFrequencyLabels: false,
  showOctaveLabels: true,
  focusColours: false,
  snapZoomToRange: false,
  isPitchRangeLocked: false,

  // --- Playback ---
  isPlaying: false,
  isPaused: false,
  isLooping: false,
  tempo: 90,

  // --- Waveform ---
  waveformExtendedView: false, // Show 480° instead of 360°

  // --- ADSR ---
  adsrTimeAxisScale: 1.0, // Multiplier for time axis (1.0 = 2.5s, 0.5 = 1.25s, 2.0 = 5s)

  // --- Print ---
  isPrintPreviewActive: false,
  printOptions: {
    includeButtonGrid: true,
    includeDrums: true,
    includeLeftLegend: true,
    includeRightLegend: true,
    orientation: 'landscape',
    colorMode: 'color',
    cropTop: 0,      // 0.0 to 1.0 (normalized position from top)
    cropBottom: 1.0, // 0.0 to 1.0 (normalized position from top)
    cropLeft: 0,     // 0.0 to 1.0 (normalized position from left)
    cropRight: 1.0   // 0.0 to 1.0 (normalized position from left)
  }
};
