// js/harmony/models/chord-shape.js

/**
 * @typedef {"maj" | "min" | "aug" | "dim" | "dom"} Quality
 * @typedef {string} NoteName - e.g. "C4", "F#5", "Bb3"
 * @typedef {
    "" | "7" | "9" | "11" | "13" |
    "b9" | "#9" | "b11" | "#11" | "b13" |
    "add6" | "sus2" | "sus4"
 * } Extension
 */

/**
 * @typedef {object} ChordShape
 * @property {string} id - Unique identifier, e.g., "chord-168234..."
 * @property {NoteName} root - A real note name with octave like "G4" after drop.
 * @property {Quality} quality - The chord's quality (e.g., "maj", "min").
 * @property {0 | 1 | 2 | 3} inversion - 0 for root position, 1 for first inversion, etc. 3 is only used by four-note chords (tetrads).
 * @property {Extension} extension - The chord's extension (e.g., "7", "b9", "add6").
 * @property {string[]} notes - An array of note names in scientific pitch notation (e.g., ["G4", "B4", "D5"]), populated after the chord is dropped or modified.
 * @property {{ xBeat: number; yStaff: number }} position - The target grid coordinates, where xBeat is the column index and yStaff is the row index of the root note.
 */

// This is a dummy export to ensure the file is treated as a module.
// We are using JSDoc for type definitions in this vanilla JS project.
export const _ = {};