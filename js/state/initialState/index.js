// js/state/initialState/index.js
import { getInitialRhythmState } from './rhythm.js';
import { getInitialTimbresState } from './timbres.js';
import { getInitialPaintState } from './paintState.js';

export const initialState = {
    // --- Data & History ---
    placedNotes: [],
    placedChords: [],
    tonicSignGroups: {},
    stampPlacements: [],
    tripletPlacements: [],
    history: [ { notes: [], tonicSignGroups: {}, timbres: getInitialTimbresState().timbres, placedChords: [], stampPlacements: [], tripletPlacements: [] } ],
    historyIndex: 0,
    fullRowData: [],

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
    
    // --- Playback ---
    isPlaying: false,
    isPaused: false,
    isLooping: false,
    tempo: 90,

    // --- Print ---
    isPrintPreviewActive: false,
    printOptions: { topRow: 0, bottomRow: 87, includeDrums: true, orientation: 'landscape', colorMode: 'color' }
};