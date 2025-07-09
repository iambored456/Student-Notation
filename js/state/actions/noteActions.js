// js/state/actions/noteActions.js
import { getMacrobeatInfo } from '../selectors.js'; // Import the centralized function

function generateUUID() {
    return `uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const noteActions = {
    addNote(note) {
        const noteWithId = { ...note, uuid: generateUUID() };
        this.state.placedNotes.push(noteWithId);
        this.emit('notesChanged');
        if (note.shape !== 'circle') {
             this.recordState();
        }
        return noteWithId;
    },

    updateNoteTail(note, newEndColumn) {
        note.endColumnIndex = newEndColumn;
        this.emit('notesChanged');
    },

    eraseNoteAt(colIndex, row, record = true) {
        const initialCount = this.state.placedNotes.length;
        this.state.placedNotes = this.state.placedNotes.filter(note => 
            !( !note.isDrum && note.row === row && colIndex >= note.startColumnIndex && colIndex <= note.endColumnIndex )
        );
        const wasErased = this.state.placedNotes.length < initialCount;
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

        if (Object.values(this.state.tonicSignGroups).flat().some(ts => ts.preMacrobeatIndex === preMacrobeatIndex)) {
            return;
        }

        // Use the centralized selector to find the insertion point.
        // It's the start column of the *next* macrobeat.
        const boundaryColumn = getMacrobeatInfo(this.state, preMacrobeatIndex + 1).startColumn;
        
        const SHIFT_AMOUNT = 1; // We are inserting ONE column.
        
        this.state.placedNotes.forEach(note => {
            if (note.startColumnIndex >= boundaryColumn) {
                note.startColumnIndex += SHIFT_AMOUNT;
                note.endColumnIndex += SHIFT_AMOUNT;
            }
        });

        const uuid = generateUUID();
        const groupWithId = tonicSignGroup.map(sign => ({ ...sign, uuid }));
        this.state.tonicSignGroups[uuid] = groupWithId;
        
        this.emit('notesChanged'); 
        this.emit('rhythmStructureChanged');
        this.recordState();
    },

    eraseTonicSignGroup(uuid, record = true) {
        const groupToErase = this.state.tonicSignGroups[uuid];
        if (!groupToErase) return false;

        const { preMacrobeatIndex } = groupToErase[0];
        
        // Temporarily add the group back to calculate the correct boundary before its removal
        const tempState = { ...this.state, tonicSignGroups: { ...this.state.tonicSignGroups, [uuid]: groupToErase } };
        const boundaryColumn = getMacrobeatInfo(tempState, preMacrobeatIndex + 1).startColumn;

        delete this.state.tonicSignGroups[uuid];
        
        const SHIFT_AMOUNT = -1; // Shift indices left.
        
        this.state.placedNotes.forEach(note => {
            if (note.startColumnIndex >= boundaryColumn) {
                note.startColumnIndex += SHIFT_AMOUNT;
                note.endColumnIndex += SHIFT_AMOUNT;
            }
        });
        
        this.emit('notesChanged');
        this.emit('rhythmStructureChanged');
        if (record) this.recordState();
        
        return true;
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