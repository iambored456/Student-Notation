// js/state/selectors.ts
import { Note } from 'tonal';
import columnMapService from '../services/columnMapService.ts';
import type { AppState, TonicSign, PlacedNote } from '../../types/state.js';

const MODE_NAMES = ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian'];

export const getPlacedTonicSigns = (state: AppState): TonicSign[] => {
  if (!state.tonicSignGroups) {return [];}
  return Object.values(state.tonicSignGroups).flat();
};

/**
 * Gets macrobeat info with CANVAS-SPACE column indices (0 = first musical beat)
 * This is the primary function - all code should use canvas-space coordinates
 *
 * Now delegates to ColumnMapService for consistent column positioning
 */
export const getMacrobeatInfo = (state: AppState, macrobeatIndex: number): { startColumn: number; endColumn: number; grouping: number } => {
  const columnMap = columnMapService.getColumnMap(state);
  const { macrobeatGroupings } = state;
  const grouping = macrobeatGroupings[macrobeatIndex] ?? 0;

  // Find the first and last beat columns for this macrobeat
  let startColumn: number | null = null;
  let endColumn: number | null = null;

  for (const entry of columnMap.entries) {
    if (entry.macrobeatIndex === macrobeatIndex && entry.type === 'beat') {
      if (startColumn === null || (entry.canvasIndex !== null && entry.canvasIndex < startColumn)) {
        startColumn = entry.canvasIndex;
      }
      if (endColumn === null || (entry.canvasIndex !== null && entry.canvasIndex > endColumn)) {
        endColumn = entry.canvasIndex;
      }
    }
  }

  // Fallback to old logic if macrobeat not found (shouldn't happen)
  if (startColumn === null || endColumn === null) {
    let columnCursor = 0;
    const placedTonicSigns = getPlacedTonicSigns(state);
    if (placedTonicSigns.some(ts => ts.preMacrobeatIndex === -1)) {
      columnCursor += 2;
    }
    for (let i = 0; i < macrobeatIndex; i++) {
      columnCursor += macrobeatGroupings[i] ?? 0;
      if (placedTonicSigns.some(ts => ts.preMacrobeatIndex === i)) {
        columnCursor += 2;
      }
    }
    startColumn = columnCursor;
    endColumn = startColumn + grouping - 1;
  }

  return { startColumn, endColumn, grouping };
};

export const getPitchNotes = (state: AppState): PlacedNote[] => state.placedNotes.filter(n => !n.isDrum);
export const getDrumNotes = (state: AppState): PlacedNote[] => state.placedNotes.filter(n => n.isDrum);

export const getKeyContextForColumn = (state: AppState, columnIndex: number): { keyTonic: string; keyMode: string } => {
  const allTonicSigns = getPlacedTonicSigns(state);
  const relevantTonicSigns = allTonicSigns.filter(ts => ts.columnIndex <= columnIndex);

  if (relevantTonicSigns.length === 0) {
    return { keyTonic: 'C', keyMode: 'major' };
  }
  const latestTonic = relevantTonicSigns.reduce((latest, current) =>
    current.columnIndex > latest.columnIndex ? current : latest
  );
  const rowData = state.fullRowData[latestTonic.row];
  if (!rowData) {
    return { keyTonic: 'C', keyMode: 'major' };
  }
  const keyTonic = Note.pitchClass(rowData.toneNote);
  const keyMode = MODE_NAMES[latestTonic.tonicNumber - 1] || 'major';
  return { keyTonic, keyMode };
};

export const getNotesAtColumn = (state: AppState, columnIndex: number): string[] => {
  const notes: string[] = [];
  const { fullRowData, placedNotes, placedChords } = state;

  placedNotes.forEach(note => {
    if (!note.isDrum && columnIndex >= note.startColumnIndex && columnIndex <= note.endColumnIndex) {
      const pitch = fullRowData[note.row]?.toneNote;
      if (pitch) {notes.push(pitch);}
    }
  });
  placedChords.forEach(chord => {
    if (chord.position.xBeat === columnIndex) {
      notes.push(...chord.notes);
    }
  });
  return notes;
};

export const getNotesInMacrobeat = (state: AppState, macrobeatIndex: number): string[] => {
  const allPitches = new Set<string>();
  const { startColumn, endColumn } = getMacrobeatInfo(state, macrobeatIndex);

  for (let i = startColumn; i <= endColumn; i++) {
    const notesAtThisColumn = getNotesAtColumn(state, i);
    notesAtThisColumn.forEach(noteName => {
      allPitches.add(Note.pitchClass(noteName));
    });
  }

  return Array.from(allPitches);
};

export const getUniqueNotesInRegion = (state: AppState, regionContext: { startBeat: number; length: number }): string[] => {
  const allPitches = new Set<string>();
  const { startBeat, length } = regionContext;

  for (let i = 0; i < length; i++) {
    const columnIndex = startBeat + i;
    const notesAtThisColumn = getNotesAtColumn(state, columnIndex);
    notesAtThisColumn.forEach(noteName => {
      allPitches.add(Note.pitchClass(noteName));
    });
  }

  return Array.from(allPitches);
};
