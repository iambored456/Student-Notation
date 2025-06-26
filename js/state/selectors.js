// js/state/selectors.js

/**
 * Selects only the pitch notes from the state.
 * @param {object} state - The global application state.
 * @returns {Array} An array of pitch note objects.
 */
export const getPitchNotes = (state) => state.placedNotes.filter(n => !n.isDrum);

/**
 * Selects only the drum notes from the state.
 * @param {object} state - The global application state.
 * @returns {Array} An array of drum note objects.
 */
export const getDrumNotes = (state) => state.placedNotes.filter(n => n.isDrum);

/**
 * Finds a specific pitch note at a given grid coordinate.
 * @param {object} state - The global application state.
 * @param {number} colIndex - The column index to check.
 * @param {number} rowIndex - The row index to check.
 * @returns {object|undefined} The found note object or undefined.
 */
export const getNoteAt = (state, colIndex, rowIndex) => 
    getPitchNotes(state).find(note => 
        note.row === rowIndex && 
        colIndex >= note.startColumnIndex && 
        colIndex <= note.endColumnIndex
    );