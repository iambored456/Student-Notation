// js/services/tonalService.js
import { Note, Interval, Scale } from 'tonal';
import store from '../state/store.js';

console.log("TonalService: Module loaded.");

// This array maps the mode number to the interval its root is ABOVE the parent Ionian tonic.
const DIATONIC_ROOT_INTERVALS = ["1P", "2M", "3M", "4P", "5P", "6M", "7M"];

/**
 * Takes a music interval string (e.g., "-3m") and formats it into a scale degree string (e.g., "♭3").
 * This is a core helper function.
 * @param {string} interval - The interval string from tonal.js.
 * @returns {string|null} The formatted degree string.
 */
function formatInterval(interval) {
    if (!interval) return null;
    const details = Interval.get(interval);
    if (!details || details.num === undefined) return null;

    let prefix = '';
    const alt = details.alt;
    const num = Math.abs(details.num);

    // --- REFINED LOGIC ---
    // The 'alt' property directly gives us the number of accidentals needed.
    // Negative for flats, positive for sharps.
    if (alt < 0) {
        prefix = '♭'.repeat(Math.abs(alt));
    } else if (alt > 0) {
        prefix = '♯'.repeat(alt);
    }
    
    return `${prefix}${num}`;
}

/**
 * THE UNIFIED ENGINE for all degree calculations.
 * It calculates the interval distance from a given root pitch to a note's pitch and formats it.
 * @param {object} note - The note object being analyzed.
 * @param {string} rootPitch - The scientific notation of the root to measure from (e.g., "C4", "G4").
 * @returns {string|null} The final, display-ready degree string.
 */
function calculateAndFormatDegree(note, rootPitch) {
    const notePitch = store.state.fullRowData[note.row]?.toneNote;
    if (!notePitch || !rootPitch) return null;

    const interval = Interval.distance(rootPitch, notePitch);
    const formattedDegree = formatInterval(interval);
    
    console.log(`[TonalService Engine] Calculating from root ${rootPitch} to note ${notePitch}. Interval: ${interval}. Formatted: ${formattedDegree}`);
    
    return formattedDegree;
}

/**
 * Given a note and a group of available root pitches (e.g., all C's), find the
 * specific root pitch that is at or immediately below the given note.
 * @param {object} note - The note being analyzed.
 * @param {Array} rootCandidates - An array of objects with { pitchName, midi }.
 * @returns {string|null} The scientific notation of the correct root pitch.
 */
function findCorrectRootPitch(note, rootCandidates) {
    const noteMidi = Note.midi(store.state.fullRowData[note.row]?.toneNote);
    if (noteMidi === null || !rootCandidates || rootCandidates.length === 0) return null;

    const belowOrAt = rootCandidates.filter(candidate => candidate.midi <= noteMidi);

    if (belowOrAt.length === 0) {
        return rootCandidates[0].pitchName;
    }

    const closest = belowOrAt.reduce((latest, current) => current.midi > latest.midi ? current : latest);
    return closest.pitchName;
}


// --- Calculation Functions (Now simplified wrappers) ---

function getDiatonicDegree(note, activeTonicGroup) {
    const primaryTonicPitch = activeTonicGroup[0].pitchName;
    const intervalFromParent = DIATONIC_ROOT_INTERVALS[activeTonicGroup[0].tonicNumber - 1];
    
    const parentTonicPitchClass = Note.pitchClass(Note.transpose(primaryTonicPitch, `-${intervalFromParent}`));
    
    const parentTonicCandidates = store.state.fullRowData
        .filter(row => Note.pitchClass(row.toneNote) === parentTonicPitchClass)
        .map(row => ({ pitchName: row.toneNote, midi: Note.midi(row.toneNote) }));

    const rootPitch = findCorrectRootPitch(note, parentTonicCandidates);
    
    return calculateAndFormatDegree(note, rootPitch);
}

function getModeDegree(note, activeTonicGroup) {
    const rootPitch = findCorrectRootPitch(note, activeTonicGroup);
    return calculateAndFormatDegree(note, rootPitch);
}


// --- Main Service ---

const TonalService = {
    getDegreeForNote(note, renderOptions) {
        const { degreeDisplayMode } = renderOptions;
        if (degreeDisplayMode === 'off') return null;

        const allTonicSigns = store.placedTonicSigns;
        const relevantTonicSigns = allTonicSigns.filter(ts => ts.columnIndex <= note.startColumnIndex);
        if (relevantTonicSigns.length === 0) return null;
        
        const latestTonic = relevantTonicSigns.reduce((latest, current) => 
            current.columnIndex > latest.columnIndex ? current : latest
        );

        const activeTonicGroup = Object.values(store.state.tonicSignGroups)
            .find(group => group[0].uuid === latestTonic.uuid);
            
        if (!activeTonicGroup) return null;
        
        const groupWithPitchNames = activeTonicGroup.map(ts => ({
            ...ts,
            pitchName: store.state.fullRowData[ts.row]?.toneNote,
            midi: Note.midi(store.state.fullRowData[ts.row]?.toneNote)
        }));

        if (degreeDisplayMode === 'diatonic') {
            return getDiatonicDegree(note, groupWithPitchNames);
        } else if (degreeDisplayMode === 'modal') {
            return getModeDegree(note, groupWithPitchNames);
        }

        return null;
    }
};

export default TonalService;