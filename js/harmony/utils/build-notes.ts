// js/harmony/utils/build-notes.ts
import { Chord, Note } from 'tonal';
import logger from '@utils/logger.ts';

interface ChordShape {
  root: string;
  quality: 'maj' | 'min' | 'aug' | 'dim' | 'dom';
  extension: string;
  inversion: number;
}

const SHARP_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];

function keyPrefersSharps(keyTonic: string): boolean {
  const tonic = Note.pitchClass(keyTonic);
  return SHARP_KEYS.includes(tonic);
}

/**
 * Builds an array of note names (e.g., ["C4", "E4", "G4"]) from a ChordShape object.
 * This function translates the abstract ChordShape into concrete pitches.
 */
export function buildNotes(shape: ChordShape, keyTonic: string): string[] {
  if (shape.root === 'X' || !shape.root) {return [];}

  const suffix = {
    maj: '',
    min: 'm',
    aug: 'aug',
    dim: 'dim',
    dom: '7'
  }[shape.quality];

  // The symbol now includes the octave from the root, e.g. "G4m7"
  const symbol = shape.root + suffix + shape.extension;

  // Tonal.js's Chord.get() correctly uses the octave from the tonic.
  const { notes } = Chord.get(symbol);

  if (!notes || notes.length === 0) {
    logger.warn('BuildNotes', `Tonal.js could not parse symbol: "${symbol}". Returning empty array.`, { symbol }, 'harmony');
    return [];
  }

  // Invert the notes. This logic now correctly handles octave shifts.
  let inversionCount = shape.inversion;
  while (inversionCount > 0 && notes.length > 0) {
    const root = notes.shift()!;
    // Transpose the root note up an octave when it moves to the end of the array.
    const newNote = Note.transpose(root, '8P');
    notes.push(newNote);
    inversionCount--;
  }

  // Pretty-spell the notes using the key signature context.
  const preferSharps = keyPrefersSharps(keyTonic);
  return notes.map(n => preferSharps ? Note.simplify(n) : Note.enharmonic(n));
}
