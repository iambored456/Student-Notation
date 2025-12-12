// js/services/spacebarHandler.ts
import store from '@state/index.ts';
import SynthEngine from './synthEngine.js';
import GlobalService from './globalService.js';
import { Note } from 'tonal';
import type { PlacedNote } from '../../types/state.js';

interface TriggeredNotes {
  pitches: string[];
  rootNote: string;
  color: string;
  noteId?: string;
}

let spacebarPressed = false;
let currentSpacebarNote = 'C4';
let ghostNotePosition: { col: number; row: number } | null = null; // { col, row } when cursor is on pitchGrid
function createEmptyTriggeredNotes(): TriggeredNotes {
  return {
    pitches: [],
    rootNote: currentSpacebarNote,
    color: store.state.selectedNote?.color || '#000000'
  };
}

let triggeredNotes: TriggeredNotes = createEmptyTriggeredNotes();

/**
 * Gets the pitch (toneNote) for a placed note.
 * Uses globalRow for pitch lookup since fullRowData contains the complete gamut.
 * Falls back to note.row for legacy notes that don't have globalRow set.
 *
 * See src/utils/rowCoordinates.ts for coordinate system documentation.
 */
function getPitchForNote(note: PlacedNote): string {
  // Use globalRow for pitch lookup (fullRowData is never sliced)
  const rowIndex = note.globalRow ?? note.row;
  const rowData = store.state.fullRowData[rowIndex];
  return rowData ? rowData.toneNote : 'C4';
}

function updateSpacebarNote(): void {
  const lastPitchNote = store.state.placedNotes
    .slice()
    .reverse()
    .find(note => !note.isDrum);

  currentSpacebarNote = lastPitchNote ? getPitchForNote(lastPitchNote) : 'C4';
}

// NEW: Helper function to get chord notes based on the current active chord shape
function getChordNotesFromIntervals(rootNote: string): string[] {
  const { activeChordIntervals } = store.state;
  if (!rootNote || !activeChordIntervals?.length) {return [];}

  return activeChordIntervals.map(interval => {
    const transposedNote = Note.transpose(rootNote, interval);
    return Note.simplify(transposedNote);
  });
}

export function initSpacebarHandler(): void {
  updateSpacebarNote();
  store.on('notesChanged', updateSpacebarNote);

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.code !== 'Space' || spacebarPressed) {return;}

    const activeElement = document.activeElement;
    if (!activeElement) {return;}

    const tagName = activeElement.tagName.toLowerCase();
    const isEditable = (activeElement as HTMLElement).contentEditable === 'true';
    if (['input', 'textarea'].includes(tagName) || isEditable) {return;}

    e.preventDefault();
    spacebarPressed = true;

    const toolColor = store.state.selectedNote?.color;

    // Determine which note(s) to play based on cursor position
    let noteToPlay: string | undefined;
    let pitchesToPlay: string[] = [];

    if (ghostNotePosition && toolColor) {
      // Case 1: Cursor is on pitchGrid - use ghost note position
      const rowData = store.state.fullRowData[ghostNotePosition.row];
      noteToPlay = rowData ? rowData.toneNote : currentSpacebarNote;

      const toolType = store.state.selectedTool;
      if (toolType === 'chord') {
        pitchesToPlay = getChordNotesFromIntervals(noteToPlay);
      } else {
        pitchesToPlay = [noteToPlay];
      }
    } else if (toolColor && currentSpacebarNote) {
      // Case 2: Cursor is off pitchGrid - use current spacebar note (original behavior)
      noteToPlay = currentSpacebarNote;
      const toolType = store.state.selectedTool;

      if (toolType === 'chord') {
        pitchesToPlay = getChordNotesFromIntervals(currentSpacebarNote);
      } else {
        pitchesToPlay = [currentSpacebarNote];
      }
    }

    if (pitchesToPlay.length > 0 && toolColor && noteToPlay) {
      // Store the triggered notes and metadata for proper release
      triggeredNotes = {
        pitches: [...pitchesToPlay],
        rootNote: noteToPlay,
        color: toolColor
      };

      pitchesToPlay.forEach(pitch => {
        (SynthEngine as { triggerAttack: (pitch: string, color: string) => void }).triggerAttack(pitch, toolColor);
      });

      // ADSR and waveform visualizer will still use the root note for simplicity
      const rowData = store.state.fullRowData.find(row => row.toneNote === noteToPlay);
      const pitchColor = rowData ? rowData.hex : '#888888';
      const timbre = store.state.timbres[toolColor];
      if (!timbre) {return;}
      const adsr = timbre.adsr;

      (GlobalService as { adsrComponent?: { playheadManager: { trigger: (id: string, phase: string, color: string, adsr: unknown) => void } } }).adsrComponent?.playheadManager.trigger('spacebar', 'attack', pitchColor, adsr);
      store.emit('spacebarPlayback', {
        note: noteToPlay,
        color: toolColor,
        isPlaying: true
      });

      // Emit noteAttack for animation service to track
      const noteId = `spacebar-${Date.now()}`;
      store.emit('noteAttack', { noteId, color: toolColor });

      // Store noteId for release
      triggeredNotes.noteId = noteId;
    }
  });

  document.addEventListener('keyup', (e: KeyboardEvent) => {
    if (e.code !== 'Space' || !spacebarPressed) {return;}

    e.preventDefault();
    spacebarPressed = false;

    // Release the exact notes that were triggered on keydown
    const pitchesToRelease = triggeredNotes.pitches;
    if (!Array.isArray(pitchesToRelease) || pitchesToRelease.length === 0) {
      triggeredNotes = createEmptyTriggeredNotes();
      return;
    }

    const triggerColor = triggeredNotes.color;
    if (triggerColor) {
      pitchesToRelease.forEach(pitch => {
        (SynthEngine as { triggerRelease: (pitch: string, color: string) => void }).triggerRelease(pitch, triggerColor);
      });

      const rootNote = triggeredNotes.rootNote ?? currentSpacebarNote;
      const rowData = store.state.fullRowData.find(row => row.toneNote === rootNote);
      const pitchColor = rowData ? rowData.hex : '#888888';
      const triggerTimbre = store.state.timbres[triggerColor];
      if (!triggerTimbre) {
        triggeredNotes = createEmptyTriggeredNotes();
        return;
      }
      const adsr = triggerTimbre.adsr;

      (GlobalService as { adsrComponent?: { playheadManager: { trigger: (id: string, phase: string, color: string, adsr: unknown) => void } } }).adsrComponent?.playheadManager.trigger('spacebar', 'release', pitchColor, adsr);
      store.emit('spacebarPlayback', {
        note: rootNote,
        color: triggerColor,
        isPlaying: false
      });

      // Emit noteRelease for animation service
      if (triggeredNotes.noteId) {
        store.emit('noteRelease', { noteId: triggeredNotes.noteId, color: triggerColor });
      }
    }

    // Clear triggered notes
    triggeredNotes = createEmptyTriggeredNotes();
  });

}

export function setDefaultSpacebarNote(note: string): void {
  currentSpacebarNote = note;
}

export function setGhostNotePosition(col: number, row: number): void {
  ghostNotePosition = { col, row };

  // Emit event for animation service if we have a ghost note and tool color
  const toolColor = store.state.selectedNote?.color;
  if (toolColor) {
    store.emit('ghostNoteUpdated', { color: toolColor });
  }
}

export function clearGhostNotePosition(): void {
  ghostNotePosition = null;

  // Emit event for animation service
  store.emit('ghostNoteCleared');
}
