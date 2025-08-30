// js/services/tonalService.js
import { Note, Interval, Scale, Chord, RomanNumeral, Progression } from 'tonal';
import { getKeyContextForColumn } from '../state/selectors.js';


function formatInterval(interval) {
    if (!interval) return null;
    const details = Interval.get(interval);
    if (!details || details.num === undefined) return null;
    let prefix = '';
    const alt = details.alt;
    const num = Math.abs(details.num);
    if (alt < 0) prefix = '♭'.repeat(Math.abs(alt));
    else if (alt > 0) prefix = '♯'.repeat(alt);
    return `${prefix}${num}`;
}

// Helper function to get enharmonic equivalent of a scale degree
function getEnharmonicDegree(degreeStr) {
    if (!degreeStr) return null;
    
    // Mapping of enharmonic equivalents for scale degrees
    const enharmonicMap = {
        '♯1': '♭2',
        '♭2': '♯1',
        '♯2': '♭3',
        '♭3': '♯2',
        '♯4': '♭5',
        '♭5': '♯4',
        '♯5': '♭6',
        '♭6': '♯5',
        '♯6': '♭7',
        '♭7': '♯6'
    };
    
    return enharmonicMap[degreeStr] || null;
}

// Helper function to check if a degree has an accidental
function hasAccidental(degreeStr) {
    return degreeStr && (degreeStr.includes('♯') || degreeStr.includes('♭'));
}

const TonalService = {
    // Export helper functions for external use
    getEnharmonicDegree,
    hasAccidental,
    getDegreeForNote(note, state) {
        console.log(`🎵 [TONAL] getDegreeForNote called:`, {
            degreeDisplayMode: state.degreeDisplayMode,
            noteRow: note.row,
            noteStartCol: note.startColumnIndex
        });
        
        const { keyTonic, keyMode } = getKeyContextForColumn(state, note.startColumnIndex);
        console.log(`🎵 [TONAL] Key context:`, { keyTonic, keyMode });
        
        if (!keyTonic) return null;
        
        const notePitch = state.fullRowData[note.row]?.toneNote;
        console.log(`🎵 [TONAL] Note pitch:`, { notePitch });
        
        if (!notePitch) return null;
        
        const notePitchClass = Note.pitchClass(notePitch);
        let referenceTonic, interval, formattedInterval;
        
        if (state.degreeDisplayMode === 'modal') {
            // Modal mode: degrees relative to the modal tonic (e.g., G Dorian with G as 1)
            referenceTonic = keyTonic;
            interval = Interval.distance(referenceTonic, notePitchClass);
            formattedInterval = formatInterval(interval);
        } else {
            // Diatonic mode: degrees relative to parent major scale
            // E.g., G Dorian viewed through F major (F is 1, G is 2)
            
            if (keyMode === 'major') {
                // If already in major mode, just use the tonic
                referenceTonic = keyTonic;
            } else {
                // Find the parent major scale tonic
                // For modes: Dorian is 2nd, Phrygian is 3rd, etc.
                const modeIndex = ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian'].indexOf(keyMode);
                if (modeIndex > 0) {
                    // Calculate parent major key by going back the modal steps
                    const intervalsFromMajor = ['1P', '2M', '3M', '4P', '5P', '6M', '7M'];
                    const modalInterval = intervalsFromMajor[modeIndex];
                    referenceTonic = Note.transpose(keyTonic, Interval.invert(modalInterval));
                } else {
                    referenceTonic = keyTonic;
                }
            }
            
            interval = Interval.distance(referenceTonic, notePitchClass);
            formattedInterval = formatInterval(interval);
        }
        
        console.log(`🎵 [TONAL] Calculation:`, {
            keyTonic,
            keyMode,
            referenceTonic,
            notePitchClass,
            rawInterval: interval,
            formattedInterval,
            degreeDisplayMode: state.degreeDisplayMode,
            enharmonicPreference: note.enharmonicPreference
        });
        
        // Check if note has an enharmonic preference and we should display the enharmonic equivalent
        if (note.enharmonicPreference && hasAccidental(formattedInterval)) {
            const enharmonicEquivalent = getEnharmonicDegree(formattedInterval);
            if (enharmonicEquivalent) {
                console.log(`🎵 [TONAL] Using enharmonic preference: ${formattedInterval} → ${enharmonicEquivalent}`);
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