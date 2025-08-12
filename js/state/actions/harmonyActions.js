// js/state/actions/harmonyActions.js
import { buildNotes } from '../../harmony/utils/build-notes.js';
import { getMacrobeatInfo, getNotesInMacrobeat } from '../selectors.js';
import { Chord, Note } from 'tonal';

function generateUUID() {
    return `uuid-chord-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const harmonyActions = {
    // ... (keep all your existing functions like addChord, updateChord, etc.)
    addChord(chordData) { /* ... existing code ... */ },
    updateChord(chordId, updates) { /* ... existing code ... */ },
    deleteChord(chordId) { /* ... existing code ... */ },
    setActiveChord(chordId) { /* ... existing code ... */ },
    setRegionContext(newRegion) { /* ... existing code ... */ },
    rebuildAllChords(newKey) { /* ... existing code ... */ },
    setActiveChordIntervals(intervals) {
        this.state.activeChordIntervals = intervals;
        this.emit('activeChordIntervalsChanged', intervals);
    },


    // --- NEW ACTIONS FOR CHORD CANDIDATE MENU ---

    openChordCandidateMenu(macrobeatIndex, candidates, position) {
        this.state.isChordCandidateMenuOpen = true;
        this.state.activeMacrobeatIndex = macrobeatIndex;
        this.state.chordCandidates = candidates;
        this.state.chordCandidateMenuPosition = position;
        this.emit('chordCandidateMenuStateChanged');
    },

    closeChordCandidateMenu() {
        this.state.isChordCandidateMenuOpen = false;
        this.state.activeMacrobeatIndex = null;
        this.emit('chordCandidateMenuStateChanged');
    },

    applyChordCandidate(chordSymbol) {
        if (this.state.activeMacrobeatIndex === null) return;

        const { startColumn, endColumn } = getMacrobeatInfo(this.state, this.state.activeMacrobeatIndex);
        
        // 1. Find the lowest note in the current macrobeat to determine the octave
        const notesInBeat = getNotesInMacrobeat(this.state, this.state.activeMacrobeatIndex);
        let lowestNote = 'C8'; // Start high
        this.state.placedNotes.forEach(note => {
            if (note.startColumnIndex >= startColumn && note.startColumnIndex <= endColumn) {
                const pitch = this.state.fullRowData[note.row].toneNote;
                if (Note.midi(pitch) < Note.midi(lowestNote)) {
                    lowestNote = pitch;
                }
            }
        });
        const octave = Note.octave(lowestNote);
        const root = Chord.get(chordSymbol).tonic;
        const rootWithOctave = `${root}${octave}`;

        // 2. Get the notes of the new chord
        const newNotes = Chord.getChord(chordSymbol, rootWithOctave).notes.map(n => Note.simplify(n));

        // 3. Remove all old notes from that macrobeat
        this.state.placedNotes = this.state.placedNotes.filter(note => 
            note.startColumnIndex < startColumn || note.startColumnIndex > endColumn
        );

        // 4. Add the new notes
        const { shape, color } = this.state.selectedNote;
        newNotes.forEach(noteName => {
            const noteRow = this.state.fullRowData.findIndex(r => r.toneNote === noteName);
            if (noteRow !== -1) {
                const newNote = { row: noteRow, startColumnIndex: startColumn, endColumnIndex: startColumn, color, shape, isDrum: false };
                this.addNote(newNote); // Use existing action to add notes
            }
        });

        // 5. Close the menu, record history, and update the view
        this.closeChordCandidateMenu();
        this.recordState();
        this.emit('notesChanged'); // This will trigger a redraw
    }
};