// js/state/initialState/index.js
import { getInitialRhythmState } from './rhythm.js';
import { getInitialTimbresState } from './timbres.js';

export const initialState = {
    // --- Data & History ---
    placedNotes: [],
    placedChords: [],
    tonicSignGroups: {},
    history: [ { notes: [], tonicSignGroups: {}, timbres: getInitialTimbresState().timbres, placedChords: [] } ],
    historyIndex: 0,
    fullRowData: [],

    // --- Rhythm ---
    ...getInitialRhythmState(),

    // --- Timbres & Colors ---
    ...getInitialTimbresState(),

    // --- UI & View State ---
    selectedTool: { type: 'circle', color: '#4a90e2', tonicNumber: null },
    activeChordId: null,
    regionContext: { startBeat: 2, length: 8 }, // Default to first measure
    gridPosition: 0,
    visualRows: 0,
    logicRows: 0,
    cellWidth: 0,
    cellHeight: 0,
    columnWidths: [],
    degreeDisplayMode: 'off',
    accidentalMode: { sharp: true, flat: true },
    
    // --- Playback ---
    isPlaying: false,
    isPaused: false,
    isLooping: false,
    tempo: 90,

    // --- Print ---
    isPrintPreviewActive: false,
    printOptions: { topRow: 0, bottomRow: 87, includeDrums: true, orientation: 'landscape', colorMode: 'color' }
};