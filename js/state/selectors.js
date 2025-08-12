// js/state/selectors.js
import { Note } from 'tonal';
import LayoutService from '../services/layoutService.js';

const MODE_NAMES = ["major", "dorian", "phrygian", "lydian", "mixolydian", "minor", "locrian"];

export const getPlacedTonicSigns = (state) => Object.values(state.tonicSignGroups).flat();

export const getMacrobeatInfo = (state, macrobeatIndex) => {
    let columnCursor = 2;
    const { macrobeatGroupings } = state;
    const placedTonicSigns = getPlacedTonicSigns(state);
    
    if (placedTonicSigns.some(ts => ts.preMacrobeatIndex === -1)) {
        columnCursor += 2;  // Fixed: Each tonic adds 2 columns
    }
    for (let i = 0; i < macrobeatIndex; i++) {
        columnCursor += macrobeatGroupings[i];
        if (placedTonicSigns.some(ts => ts.preMacrobeatIndex === i)) {
            columnCursor += 2;  // Fixed: Each tonic adds 2 columns
        }
    }
    const startColumn = columnCursor;
    const grouping = macrobeatGroupings[macrobeatIndex];
    const endColumn = startColumn + (grouping || 0) - 1;
    return { startColumn, endColumn, grouping };
};

export const getPitchNotes = (state) => state.placedNotes.filter(n => !n.isDrum);
export const getDrumNotes = (state) => state.placedNotes.filter(n => n.isDrum);

export const getKeyContextForBeat = (state, beatIndex) => {
    const allTonicSigns = getPlacedTonicSigns(state);
    const relevantTonicSigns = allTonicSigns.filter(ts => ts.columnIndex <= beatIndex);

    if (relevantTonicSigns.length === 0) {
        return { keyTonic: 'C', keyMode: 'major' };
    }
    const latestTonic = relevantTonicSigns.reduce((latest, current) => 
        current.columnIndex > latest.columnIndex ? current : latest
    );
    const keyTonic = Note.pitchClass(state.fullRowData[latestTonic.row].toneNote);
    const keyMode = MODE_NAMES[latestTonic.tonicNumber - 1] || 'major';
    return { keyTonic, keyMode };
};

export const getNotesAtBeat = (state, beatIndex) => {
    const notes = [];
    const { fullRowData, placedNotes, placedChords } = state;

    placedNotes.forEach(note => {
        if (!note.isDrum && beatIndex >= note.startColumnIndex && beatIndex <= note.endColumnIndex) {
            const pitch = fullRowData[note.row]?.toneNote;
            if (pitch) notes.push(pitch);
        }
    });
    placedChords.forEach(chord => {
        if (chord.position.xBeat === beatIndex) {
            notes.push(...chord.notes);
        }
    });
    return notes;
};

export const getNotesInMacrobeat = (state, macrobeatIndex) => {
    const allPitches = new Set();
    const { startColumn, endColumn } = getMacrobeatInfo(state, macrobeatIndex);
    
    for (let i = startColumn; i <= endColumn; i++) {
        const notesAtThisBeat = getNotesAtBeat(state, i);
        notesAtThisBeat.forEach(noteName => {
            allPitches.add(Note.pitchClass(noteName));
        });
    }

    const finalNotes = Array.from(allPitches);
    // Only log if notes were actually found
    if (finalNotes.length > 0) {
        console.log(`[getNotesInMacrobeat] Found notes for macrobeat ${macrobeatIndex}:`, finalNotes);
    }
    return finalNotes;
};