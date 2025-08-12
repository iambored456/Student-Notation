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
        const eraseStartRow = row - 1; // Eraser starts 1 row above
        const eraseEndRow = row + 1; // Eraser covers 3 rows: row-1, row, row+1
        let wasErased = false;
    
        const initialNoteCount = this.state.placedNotes.length;
        this.state.placedNotes = this.state.placedNotes.filter(note => {
            if (note.isDrum) return true;
            
            // For circle notes, check if their 2×1 footprint intersects with eraser's 2×3 area
            if (note.shape === 'circle') {
                const noteEndCol = note.startColumnIndex + 1; // Circle notes span 2 columns
                // Circle notes only span 1 row (note.row)
                
                // Check for any overlap between note's 2×1 area and eraser's 2×3 area
                const horizontalOverlap = note.startColumnIndex <= eraseEndCol && noteEndCol >= col;
                const verticalOverlap = note.row >= eraseStartRow && note.row <= eraseEndRow;
                
                if (horizontalOverlap && verticalOverlap) {
                    return false; // Remove this note
                }
            } else {
                // For non-circle notes, check if note overlaps with eraser's 2×3 coverage area
                const noteInEraseArea = note.row >= eraseStartRow && note.row <= eraseEndRow &&
                                       note.startColumnIndex <= eraseEndCol && note.endColumnIndex >= col;
                
                if (noteInEraseArea) {
                    return false; // Remove this note
                }
            }
            
            return true; // Keep this note
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
        console.log('[TonicPlacement] Starting addTonicSignGroup with:', tonicSignGroup);
        
        const firstSign = tonicSignGroup[0];
        const { preMacrobeatIndex } = firstSign;
        console.log('[TonicPlacement] preMacrobeatIndex:', preMacrobeatIndex);
        
        if (Object.values(this.state.tonicSignGroups).flat().some(ts => ts.preMacrobeatIndex === preMacrobeatIndex)) {
            console.log('[TonicPlacement] Tonic already exists at this preMacrobeatIndex, returning');
            return;
        }
        
        const boundaryColumn = getMacrobeatInfo(this.state, preMacrobeatIndex + 1).startColumn;
        console.log('[TonicPlacement] Boundary column for shifting notes:', boundaryColumn);
        
        const notesToShift = this.state.placedNotes.filter(note => note.startColumnIndex >= boundaryColumn);
        console.log('[TonicPlacement] Notes that will be shifted:', notesToShift.map(n => `${n.startColumnIndex}-${n.endColumnIndex}`));
        
        this.state.placedNotes.forEach(note => {
            if (note.startColumnIndex >= boundaryColumn) {
                const oldStart = note.startColumnIndex;
                const oldEnd = note.endColumnIndex;
                note.startColumnIndex += 2;
                note.endColumnIndex += 2;
                console.log(`[TonicPlacement] Shifted note from ${oldStart}-${oldEnd} to ${note.startColumnIndex}-${note.endColumnIndex}`);
            }
        });

        const uuid = generateUUID();
        const groupWithId = tonicSignGroup.map(sign => ({ ...sign, uuid }));
        this.state.tonicSignGroups[uuid] = groupWithId;
        console.log('[TonicPlacement] Added tonic group with UUID:', uuid, 'at columns:', groupWithId.map(s => s.columnIndex));
        
        console.log('[TonicPlacement] Emitting events: notesChanged, rhythmStructureChanged');
        this.emit('notesChanged'); 
        this.emit('rhythmStructureChanged');
        this.recordState();
    },

    /**
     * Erases tonic sign at the specified column index
     * @param {number} columnIndex - The column index to check for tonic signs
     * @param {boolean} record - Whether to record the state change (default true)
     * @returns {boolean} True if a tonic sign was erased
     */
    eraseTonicSignAt(columnIndex, record = true) {
        // Find any tonic group that has a sign at this column
        const tonicGroupToDelete = Object.entries(this.state.tonicSignGroups).find(([uuid, group]) =>
            group.some(sign => sign.columnIndex === columnIndex)
        );

        if (!tonicGroupToDelete) {
            return false; // No tonic sign found at this column
        }

        const [uuidToDelete, groupToDelete] = tonicGroupToDelete;
        const preMacrobeatIndex = groupToDelete[0].preMacrobeatIndex;
        const boundaryColumn = getMacrobeatInfo(this.state, preMacrobeatIndex + 1).startColumn;

        // Remove the tonic group
        delete this.state.tonicSignGroups[uuidToDelete];

        // Shift all notes that come after the tonic column back by 2
        this.state.placedNotes.forEach(note => {
            if (note.startColumnIndex >= boundaryColumn) {
                note.startColumnIndex -= 2;
                note.endColumnIndex -= 2;
            }
        });

        this.emit('notesChanged');
        this.emit('rhythmStructureChanged');
        
        if (record) {
            this.recordState();
        }
        
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