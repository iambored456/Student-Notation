// js/services/tonalService.js
import { Note, Interval, Scale, Chord, RomanNumeral, Progression } from 'tonal';
import { getKeyContextForColumn } from '@state/selectors.js';


function formatInterval(interval) {
    if (!interval) return null;
    const details = Interval.get(interval);
    if (!details || details.num === undefined) return null;
    let prefix = '';
    const alt = details.alt;
    const num = Math.abs(details.num);
    if (alt < 0) prefix = 'â™­'.repeat(Math.abs(alt));
    else if (alt > 0) prefix = 'â™¯'.repeat(alt);
    return `${prefix}${num}`;
}

// Helper function to get enharmonic equivalent of a scale degree
function getEnharmonicDegree(degreeStr) {
    if (!degreeStr) return null;
    
    // Mapping of enharmonic equivalents for scale degrees
    const enharmonicMap = {
        'â™¯1': 'â™­2',
        'â™­2': 'â™¯1',
        'â™¯2': 'â™­3',
        'â™­3': 'â™¯2',
        'â™¯4': 'â™­5',
        'â™­5': 'â™¯4',
        'â™¯5': 'â™­6',
        'â™­6': 'â™¯5',
        'â™¯6': 'â™­7',
        'â™­7': 'â™¯6'
    };
    
    return enharmonicMap[degreeStr] || null;
}

// Helper function to check if a degree has an accidental
function hasAccidental(degreeStr) {
    return degreeStr && (degreeStr.includes('â™¯') || degreeStr.includes('â™­'));
}

const TonalService = {
    // Export helper functions for external use
    getEnharmonicDegree,
    hasAccidental,
    getDegreeForNote(note, state) {
        if (!note || !state) return null;

        const { keyTonic, keyMode } = getKeyContextForColumn(state, note.startColumnIndex);
        if (!keyTonic) return null;

        const notePitch = state.fullRowData[note.row]?.toneNote;
        if (!notePitch) return null;

        const notePitchClass = Note.pitchClass(notePitch);
        let referenceTonic = keyTonic;

        if (state.degreeDisplayMode !== 'modal') {
            // Diatonic mode: determine the parent major tonic when viewing modal keys
            if (keyMode !== 'major') {
                const modes = ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian'];
                const modeIndex = modes.indexOf(keyMode);

                if (modeIndex > 0) {
                    const intervalsFromMajor = ['1P', '2M', '3M', '4P', '5P', '6M', '7M'];
                    const modalInterval = intervalsFromMajor[modeIndex];
                    referenceTonic = Note.transpose(keyTonic, Interval.invert(modalInterval));
                }
            }
        }

        const interval = Interval.distance(referenceTonic, notePitchClass);
        const formattedInterval = formatInterval(interval);

        if (note.enharmonicPreference && hasAccidental(formattedInterval)) {
            const enharmonicEquivalent = getEnharmonicDegree(formattedInterval);
            if (enharmonicEquivalent) {
                return enharmonicEquivalent;
            }
        }

        return formattedInterval;
    },

    getDegreesForNotes(notes, keyTonic) {
        if (!notes || notes.length === 0) return [];
        return notes.map(noteName => {
            const interval = Interval.distance(keyTonic, Note.pitchClass(noteName));
            return formatInterval(interval);
        });
    },

    /**
     * FINAL CORRECTED VERSION: Analyzes notes using the documented functions.
     */
    getRomanNumeralForNotes(notes, keyTonic, keyMode) {
        if (!notes || notes.length < 2) return null;

        // Step 1: Detect the chord from the given notes.
        const [detectedChordName] = Chord.detect(notes);
        if (!detectedChordName) return null;

        // Step 2: Get the canonical symbol for that chord (e.g., "FM", "Gm7").
        const chordSymbol = Chord.get(detectedChordName).symbol;
        if (!chordSymbol) return null;
        
        // Step 3: Use the Progression module to convert the symbol to a Roman numeral string in the given key.
        const [rnString] = Progression.toRomanNumerals(keyTonic, [chordSymbol]);
        if (!rnString) return null;

        // Step 4: Use RomanNumeral.get() on the resulting string to parse it into parts.
        const rn = RomanNumeral.get(rnString);
        
        // The .roman property will correctly be "I", "ii", "V", etc.
        const roman = rn.roman;
        // The extension is whatever is left after removing the numeral part.
        let ext = rn.name.replace(roman, '');
        // The root of the chord is available from the initial detection.
        const chordRoot = Chord.get(detectedChordName).tonic;

        // FIX: Per user request, explicitly display "add6" for clarity instead of just "6".
        if (ext === '6') {
            ext = 'add6';
        }

        return { roman, ext, root: chordRoot };
    }
};

export default TonalService;
