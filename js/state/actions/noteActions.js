// js/state/actions/noteActions.js
import { getMacrobeatInfo } from '../selectors.js';

function generateUUID() {
    return `uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const noteActions = {
    /**
     * Adds a note to the state.
     * IMPORTANT: This function no longer records history. The calling function is responsible for that.
     * @param {object} note - The note object to add.
     */
    addNote(note) {
        const noteWithId = { ...note, uuid: generateUUID() };
        this.state.placedNotes.push(noteWithId);
        this.emit('notesChanged');
        return noteWithId;
    },

    updateNoteTail(note, newEndColumn) {
        note.endColumnIndex = newEndColumn;
        this.emit('notesChanged');
    },

    eraseInPitchArea(col, row, width = 1, record = true) {
        const eraseEndCol = col + width - 1;
        let wasErased = false;
    
        const initialNoteCount = this.state.placedNotes.length;
        this.state.placedNotes = this.state.placedNotes.filter(note => {
            if (note.isDrum || note.row !== row) return true;
            const noteOverlaps = note.startColumnIndex <= eraseEndCol && note.endColumnIndex >= col;
            return !noteOverlaps;
        });

        if (this.state.placedNotes.length < initialNoteCount) {
            wasErased = true;
        }
    
        if (wasErased) {
            this.emit('notesChanged');
            if (record) this.recordState();
        }
        return wasErased;
    },

    eraseDrumNoteAt(colIndex, drumTrack, record = true) {
        const initialCount = this.state.placedNotes.length;
        this.state.placedNotes = this.state.placedNotes.filter(note => 
            !(note.isDrum && note.drumTrack === drumTrack && note.startColumnIndex === colIndex)
        );
        const wasErased = this.state.placedNotes.length < initialCount;
        if (wasErased) {
            this.emit('notesChanged');
            if (record) this.recordState();
        }
        return wasErased;
    },

    addTonicSignGroup(tonicSignGroup) {
        const firstSign = tonicSignGroup[0];
        const { preMacrobeatIndex } = firstSign;
        if (Object.values(this.state.tonicSignGroups).flat().some(ts => ts.preMacrobeatIndex === preMacrobeatIndex)) return;
        const boundaryColumn = getMacrobeatInfo(this.state, preMacrobeatIndex + 1).startColumn;
        
        this.state.placedNotes.forEach(note => {
            if (note.startColumnIndex >= boundaryColumn) {
                note.startColumnIndex += 1;
                note.endColumnIndex += 1;
            }
        });

        const uuid = generateUUID();
        const groupWithId = tonicSignGroup.map(sign => ({ ...sign, uuid }));
        this.state.tonicSignGroups[uuid] = groupWithId;
        
        this.emit('notesChanged'); 
        this.emit('rhythmStructureChanged');
        this.recordState();
    },
    
    toggleDrumNote(drumHit) {
        const existingIndex = this.state.placedNotes.findIndex(note =>
            note.isDrum && note.drumTrack === drumHit.drumTrack && note.startColumnIndex === drumHit.startColumnIndex
        );
        if (existingIndex >= 0) {
            this.state.placedNotes.splice(existingIndex, 1);
        } else {
            this.state.placedNotes.push({ ...drumHit, uuid: generateUUID() });
        }
        this.emit('notesChanged');
        this.recordState();
    },

    clearAllNotes() {
        this.state.placedNotes = [];
        this.state.tonicSignGroups = {};
        this.emit('notesChanged');
        this.emit('rhythmStructureChanged');
        this.recordState();
    },

    loadNotes(importedNotes) {
        this.state.placedNotes = importedNotes;
        this.emit('notesChanged');
        this.recordState();
    }
};