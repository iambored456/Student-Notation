// js/state/initialState/index.js
import { getInitialRhythmState } from './rhythm.js';
import { getInitialTimbresState } from './timbres.js';
import { getInitialPaintState } from './paintState.js';
import { fullRowData as masterRowData } from '../pitchData.js';

export const initialState = {
    // --- Data & History ---
    placedNotes: [],
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
    history: [ { notes: [], tonicSignGroups: {}, timbres: getInitialTimbresState().timbres, placedChords: [], stampPlacements: [], tripletPlacements: [], annotations: [], lassoSelection: { selectedItems: [], convexHull: null, isActive: false } } ],
    historyIndex: 0,
    fullRowData: [],
    pitchRange: {
        topIndex: 0,
        bottomIndex: Math.max(0, (masterRowData?.length || 1) - 1)
    },

    // --- Rhythm ---
    ...getInitialRhythmState(),

    // --- Timbres & Colors ---
    ...getInitialTimbresState(),

    // --- NEW: Paint State ---
    paint: getInitialPaintState(),

    // --- UI & View State ---
    selectedTool: 'note',
    previousTool: 'note',
    selectedToolTonicNumber: 1,
    selectedNote: { shape: 'circle', color: '#4a90e2' },
    activeChordId: null,
    activeChordIntervals: ["1P", "3M", "5P"],
    isIntervalsInverted: false,
    chordPositionState: 0, // 0 = Root, 1 = 1st Inversion, 2 = 2nd Inversion
    
    isChordCandidateMenuOpen: false,
    chordCandidateMenuPosition: { x: 0, y: 0 },
    activeMacrobeatIndex: null,
    chordCandidates: [],
    
    gridPosition: 0,
    viewportRows: 0,
    logicRows: 0,
    cellWidth: 0,
    cellHeight: 0,
    columnWidths: [],
    degreeDisplayMode: 'off',
    accidentalMode: { sharp: true, flat: true },
    showFrequencyLabels: false,
    focusColours: false,
    snapZoomToRange: false,
    
    // --- Playback ---
    isPlaying: false,
    isPaused: false,
    isLooping: false,
    tempo: 90,

    // --- Waveform ---
    waveformExtendedView: false, // Show 480° instead of 360°

    // --- ADSR ---
    adsrTimeAxisScale: 1.0, // Multiplier for time axis (1.0 = 2.5s, 0.5 = 1.25s, 2.0 = 5s)
    adsrComponentWidth: 100, // Percentage of default width (100% = default)

    // --- Print ---
    isPrintPreviewActive: false,
    printOptions: { topRow: 0, bottomRow: 87, includeDrums: true, orientation: 'landscape', colorMode: 'color' }
};
