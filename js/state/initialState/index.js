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
    selectedTool: 'note', 
    selectedNote: { shape: 'circle', color: '#4a90e2' },
    activeChordId: null,
    activeChordIntervals: ["1P", "3M", "5P"],
    
    // --- NEW: State for the Chord Candidate Menu ---
    isChordCandidateMenuOpen: false,
    chordCandidateMenuPosition: { x: 0, y: 0 },
    activeMacrobeatIndex: null,
    chordCandidates: [],
    
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