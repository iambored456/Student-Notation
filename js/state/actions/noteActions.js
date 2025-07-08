// js/state/actions/noteActions.js

function generateUUID() {
    return `uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculates the column index where a tonic sign will be inserted.
 * This function is the single source of truth for this calculation.
 * @param {number} preMacrobeatIndex - The index of the macrobeat the tonic sign follows.
 * @param {object} state - The current application state.
 * @returns {number} The calculated column index for the start of the tonic sign.
 */
function calculateTonicInsertionColumn(preMacrobeatIndex, state) {
    let columnIndex = 2; // Start after the two left legend columns
    const { macrobeatGroupings, tonicSignGroups } = state;

    // Get an array of the preMacrobeatIndex for each unique, existing tonic sign group
    const existingTonicIndices = [...new Set(Object.values(tonicSignGroups).flat().map(ts => ts.preMacrobeatIndex))];

    // Loop through each macrobeat position up to the insertion point
    for (let i = -1; i < preMacrobeatIndex; i++) {
        // Add the width of the macrobeat itself (if it exists)
        if (i > -1 && macrobeatGroupings[i] !== undefined) {
            columnIndex += macrobeatGroupings[i];
        }
        // Add the width for any tonic sign that exists at this position
        if (existingTonicIndices.includes(i)) {
            columnIndex += 2;
        }
    }
    
    console.log(`[calculateInsertionPoint] Final calculated insertion column for preMacrobeatIndex ${preMacrobeatIndex} is: ${columnIndex}`);
    return columnIndex;
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

        const boundaryColumn = calculateTonicInsertionColumn(preMacrobeatIndex, this.state);
        
        // --- THE CORRECTED SHIFT AMOUNT ---
        // We are inserting ONE item into the columnWidths array, so we shift indices by +1.
        const SHIFT_AMOUNT = 1; 
        console.log(`[addTonicSignGroup] Making room: Shifting note indices at or after column ${boundaryColumn} by +${SHIFT_AMOUNT}`);
        
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
        
        const boundaryColumn = calculateTonicInsertionColumn(preMacrobeatIndex, this.state);
        
        delete this.state.tonicSignGroups[uuid];

        // --- THE CORRECTED SHIFT AMOUNT ---
        const SHIFT_AMOUNT = -1; // Shift indices left
        console.log(`[eraseTonicSignGroup] Closing gap: Shifting note indices at or after column ${boundaryColumn} by ${SHIFT_AMOUNT}`);
        
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