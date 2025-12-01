// js/state/actions/noteActions.ts
import { getMacrobeatInfo } from '../selectors.js';
import logger from '@utils/logger.ts';
import TonalService from '@services/tonalService.ts';
import type { PlacedNote, Store, CanvasSpaceColumn } from '../../../types/state.js';
import { createCanvasSpaceColumn } from '@utils/coordinateTypes.ts';

export function ensureCircleNoteSpan(note: PlacedNote): void {
  if (!note || note.isDrum) {return;}
  if (note.shape === 'circle' && typeof note.startColumnIndex === 'number') {
    const minimumEnd = note.startColumnIndex + 1;
    if (typeof note.endColumnIndex !== 'number' || note.endColumnIndex < minimumEnd) {
      note.endColumnIndex = createCanvasSpaceColumn(minimumEnd);
    }
  }
}

function updateGlobalRow(note: PlacedNote, state: Store['state']): void {
  if (typeof note.row !== 'number') {return;}
  const topIndex = state.pitchRange?.topIndex ?? 0;
  note.globalRow = note.row + topIndex;
}

function generateUUID(): string {
  return `uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const noteActions = {
  /**
     * Adds a note to the state.
     * IMPORTANT: This function no longer records history. The calling function is responsible for that.
     */
  addNote(this: Store, note: Partial<PlacedNote>): PlacedNote | null {
    // Check if there's already a note of the same color at the same position (row + startColumnIndex)
    const existingNote = this.state.placedNotes.find(existingNote =>
      !existingNote.isDrum &&
            existingNote.row === note.row &&
            existingNote.startColumnIndex === note.startColumnIndex &&
            existingNote.color === note.color
    );

    if (existingNote) {
      // Check if Show Degrees is ON and we can toggle enharmonic equivalents
      if (this.state.degreeDisplayMode !== 'off') {
        // Get the current degree for this existing note
        const currentDegree = TonalService.getDegreeForNote(existingNote, this.state);

        // Check if the degree has an accidental that can be toggled
        if (currentDegree && TonalService.hasAccidental(currentDegree)) {
          // Toggle the enharmonic preference
          existingNote.enharmonicPreference = !existingNote.enharmonicPreference;

          logger.debug('NoteActions', '[ENHARMONIC] Toggled enharmonic preference for note', {
            noteUuid: existingNote.uuid,
            currentDegree,
            enharmonicPreference: existingNote.enharmonicPreference
          }, 'notes');

          // Emit change to trigger re-render
          this.emit('notesChanged');
          return existingNote;
        }
      }

      // Don't add the note if there's already one of the same color at this position
      // and no enharmonic toggle was possible
      return null;
    }

    const noteWithId: PlacedNote = { ...note, uuid: generateUUID() } as PlacedNote;
    ensureCircleNoteSpan(noteWithId);
    updateGlobalRow(noteWithId, this.state);
    this.state.placedNotes.push(noteWithId);
    this.emit('notesChanged');
    return noteWithId;
  },

  updateNoteTail(this: Store, note: PlacedNote, newEndColumn: CanvasSpaceColumn): void {
    let nextEnd = newEndColumn;
    if (note.shape === 'circle') {
      nextEnd = Math.max(note.startColumnIndex + 1, newEndColumn) as CanvasSpaceColumn;
    }
    note.endColumnIndex = nextEnd as CanvasSpaceColumn;
    this.emit('notesChanged');
  },

  updateMultipleNoteTails(this: Store, notes: PlacedNote[], newEndColumn: CanvasSpaceColumn): void {
    notes.forEach((note) => {
      let nextEnd = newEndColumn;
      if (note.shape === 'circle') {
        nextEnd = Math.max(note.startColumnIndex + 1, newEndColumn) as CanvasSpaceColumn;
      }
      note.endColumnIndex = nextEnd as CanvasSpaceColumn;
    });
    this.emit('notesChanged');
  },

  updateNoteRow(this: Store, note: PlacedNote, newRow: number): void {
    note.row = newRow;
    updateGlobalRow(note, this.state);
    this.emit('notesChanged');
  },

  updateMultipleNoteRows(this: Store, notes: PlacedNote[], rowOffsets: number[]): void {
    notes.forEach((note, index) => {
      const offset = rowOffsets[index];
      if (offset !== undefined) {
        note.row = offset;
        updateGlobalRow(note, this.state);
      }
    });
    this.emit('notesChanged');
  },

  updateNotePosition(this: Store, note: PlacedNote, newStartColumn: CanvasSpaceColumn): void {
    note.startColumnIndex = newStartColumn;
    note.endColumnIndex = (note.shape === 'circle'
      ? newStartColumn + 1
      : newStartColumn) as CanvasSpaceColumn; // Oval notes have startColumn === endColumn
    this.emit('notesChanged');
  },

  updateMultipleNotePositions(this: Store, notes: PlacedNote[], newStartColumn: CanvasSpaceColumn): void {
    notes.forEach((note) => {
      note.startColumnIndex = newStartColumn;
      note.endColumnIndex = (note.shape === 'circle'
        ? newStartColumn + 1
        : newStartColumn) as CanvasSpaceColumn; // Oval notes have startColumn === endColumn
    });
    this.emit('notesChanged');
  },

  eraseInPitchArea(this: Store, col: CanvasSpaceColumn, row: number, width = 1, record = true): boolean {
    const eraseEndCol = col + width - 1;
    const eraseStartRow = row - 1; // Eraser starts 1 row above
    const eraseEndRow = row + 1; // Eraser covers 3 rows: row-1, row, row+1
    let wasErased = false;

    const initialNoteCount = this.state.placedNotes.length;
    this.state.placedNotes = this.state.placedNotes.filter(note => {
      if (note.isDrum) {return true;}

      // For circle notes, check if their 2×1 footprint intersects with eraser's 2×3 area
      if (note.shape === 'circle') {
        const minSpanEnd = note.startColumnIndex + 1;
        const noteEndCol = typeof note.endColumnIndex === 'number'
          ? Math.max(minSpanEnd, note.endColumnIndex)
          : minSpanEnd;
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
      if (record) {this.recordState();}
    }
    return wasErased;
  },

  eraseDrumNoteAt(this: Store, colIndex: CanvasSpaceColumn, drumTrack: number, record = true): boolean {
    const initialCount = this.state.placedNotes.length;
    this.state.placedNotes = this.state.placedNotes.filter(note =>
      !(note.isDrum && note.drumTrack === drumTrack && note.startColumnIndex === colIndex)
    );
    const wasErased = this.state.placedNotes.length < initialCount;
    if (wasErased) {
      this.emit('notesChanged');
      if (record) {this.recordState();}
    }
    return wasErased;
  },

  addTonicSignGroup(this: Store, tonicSignGroup: { preMacrobeatIndex: number; columnIndex: CanvasSpaceColumn; row: number; tonicNumber: number }[]): void {
    logger.debug('TonicPlacement', 'Starting addTonicSignGroup', { tonicSignGroup }, 'state');

    const firstSign = tonicSignGroup[0];
    if (!firstSign) {return;}
    const { preMacrobeatIndex } = firstSign;
    logger.debug('TonicPlacement', 'preMacrobeatIndex', { preMacrobeatIndex }, 'state');

    if (Object.values(this.state.tonicSignGroups).flat().some(ts => ts.preMacrobeatIndex === preMacrobeatIndex)) {
      logger.debug('TonicPlacement', 'Tonic already exists at this preMacrobeatIndex, returning', null, 'state');
      return;
    }

    // boundaryColumn is canvas-space (0 = first musical beat) from getMacrobeatInfo
    const boundaryColumn = getMacrobeatInfo(this.state, preMacrobeatIndex + 1).startColumn as CanvasSpaceColumn;
    logger.debug('TonicPlacement', 'Boundary column (canvas-space) for shifting notes', { boundaryColumn }, 'state');

    const notesToShift = this.state.placedNotes.filter(note => note.startColumnIndex >= boundaryColumn);
    logger.debug('TonicPlacement', 'Notes that will be shifted', { noteRanges: notesToShift.map(n => `${n.startColumnIndex}-${n.endColumnIndex}`) }, 'state');

    // Shift notes right by 2 columns (in canvas-space) to make room for tonic sign
    this.state.placedNotes.forEach(note => {
      if (note.startColumnIndex >= boundaryColumn) {
        const oldStart = note.startColumnIndex;
        const oldEnd = note.endColumnIndex;
        note.startColumnIndex = (note.startColumnIndex + 2) as CanvasSpaceColumn;
        note.endColumnIndex = (note.endColumnIndex + 2) as CanvasSpaceColumn;
        logger.debug('TonicPlacement', `Shifted note from ${oldStart}-${oldEnd} to ${note.startColumnIndex}-${note.endColumnIndex}`, null, 'state');
      }
    });

    const uuid = generateUUID();
    const groupWithId = tonicSignGroup.map(sign => ({ ...sign, uuid }));
    this.state.tonicSignGroups[uuid] = groupWithId;
    logger.debug('TonicPlacement', 'Added tonic group', { uuid, columns: groupWithId.map(s => s.columnIndex) }, 'state');

    logger.debug('TonicPlacement', 'Emitting events: notesChanged, rhythmStructureChanged', null, 'state');
    this.emit('notesChanged');
    this.emit('rhythmStructureChanged');
    this.recordState();
  },

  /**
     * Erases tonic sign at the specified column index (canvas-space)
     */
  eraseTonicSignAt(this: Store, columnIndex: CanvasSpaceColumn, record = true): boolean {
    // Find any tonic group that has a sign at this column
    const tonicGroupToDelete = Object.entries(this.state.tonicSignGroups).find(([, group]) =>
      group.some(sign => sign.columnIndex === columnIndex)
    );

    if (!tonicGroupToDelete) {
      return false; // No tonic sign found at this column
    }

    const [uuidToDelete, groupToDelete] = tonicGroupToDelete;
    const firstSign = groupToDelete[0];
    if (!firstSign) {return false;}
    const preMacrobeatIndex = firstSign.preMacrobeatIndex;
    // boundaryColumn is canvas-space (0 = first musical beat) from getMacrobeatInfo
    const boundaryColumn = getMacrobeatInfo(this.state, preMacrobeatIndex + 1).startColumn as CanvasSpaceColumn;

    // Remove the tonic group
    delete this.state.tonicSignGroups[uuidToDelete];

    // Shift all notes that come after the tonic column back by 2 (in canvas-space)
    this.state.placedNotes.forEach(note => {
      if (note.startColumnIndex >= boundaryColumn) {
        note.startColumnIndex = (note.startColumnIndex - 2) as CanvasSpaceColumn;
        note.endColumnIndex = (note.endColumnIndex - 2) as CanvasSpaceColumn;
      }
    });

    this.emit('notesChanged');
    this.emit('rhythmStructureChanged');

    if (record) {
      this.recordState();
    }

    return true;
  },

  toggleDrumNote(this: Store, drumHit: Partial<PlacedNote> & { drumTrack: number; startColumnIndex: number }): void {
    const existingIndex = this.state.placedNotes.findIndex(note =>
      note.isDrum && note.drumTrack === drumHit.drumTrack && note.startColumnIndex === drumHit.startColumnIndex
    );
    if (existingIndex >= 0) {
      this.state.placedNotes.splice(existingIndex, 1);
    } else {
      const newDrumNote: PlacedNote = { ...drumHit, uuid: generateUUID() } as PlacedNote;
      this.state.placedNotes.push(newDrumNote);
    }
    this.emit('notesChanged');
    this.recordState();
  },

  clearAllNotes(this: Store): void {
    this.state.placedNotes = [];
    this.state.parkedNotes = [];
    this.state.tonicSignGroups = {};
    this.emit('notesChanged');
    this.emit('rhythmStructureChanged');
    this.recordState();
  },

  loadNotes(this: Store, importedNotes: Partial<PlacedNote>[]): void {
    const normalizedNotes = (importedNotes || []).map(note => {
      const normalizedNote: PlacedNote = {
        ...note,
        uuid: note?.uuid ?? generateUUID()
      } as PlacedNote;
      ensureCircleNoteSpan(normalizedNote);
      updateGlobalRow(normalizedNote, this.state);
      return normalizedNote;
    });
    this.state.placedNotes = normalizedNotes;
    this.emit('notesChanged');
    this.recordState();
  }
};
