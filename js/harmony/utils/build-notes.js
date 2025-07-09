// js/harmony/utils/build-notes.js
import { Chord, Note } from "tonal";

const SHARP_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
function keyPrefersSharps(keyTonic) {
    const tonic = Note.pitchClass(keyTonic);
    return SHARP_KEYS.includes(tonic);
}

/**
 * Builds an array of note names (e.g., ["C4", "E4", "G4"]) from a ChordShape object.
 * This function translates the abstract ChordShape into concrete pitches.
 * @param {import('../models/chord-shape.js').ChordShape} shape - The chord shape definition.
 * @param {string} keyTonic - The tonic of the current key signature (e.g., "C", "Gb") for correct note spelling.
 * @returns {string[]} An array of note names in scientific pitch notation.
 */
export function buildNotes(shape, keyTonic) {
  if (shape.root === "X" || !shape.root) return [];

  const suffix = {
    maj: "",
    min: "m",
    aug: "aug",
    dim: "dim",
    dom: "7"
  }[shape.quality];

  // The symbol now includes the octave from the root, e.g. "G4m7"
  const symbol = shape.root + suffix + shape.extension;

  // Tonal.js's Chord.get() correctly uses the octave from the tonic.
  let { notes } = Chord.get(symbol);

  if (!notes || notes.length === 0) {
      console.warn(`[buildNotes] Tonal.js could not parse symbol: "${symbol}". Returning empty array.`);
      return [];
  }

  // Invert the notes. This logic now correctly handles octave shifts.
  let inversionCount = shape.inversion;
  while (inversionCount > 0 && notes.length > 0) {
    let root = notes.shift();
    // Transpose the root note up an octave when it moves to the end of the array.
    let newNote = Note.transpose(root, "8P");
    notes.push(newNote);
    inversionCount--;
  }

  // Pretty-spell the notes using the key signature context.
  return notes.map(n => Note.simplify(n, { preferSharps: keyPrefersSharps(keyTonic) }));
}