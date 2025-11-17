// js/services/tonalService.js
import { Note, Interval, Chord, RomanNumeral, Progression } from 'tonal';
import { getKeyContextForColumn } from '@state/selectors.js';

const SEMITONE_TO_DIATONIC = {
  0: { degree: 1, alt: 0 },
  1: { degree: 2, alt: -1 },
  2: { degree: 2, alt: 0 },
  3: { degree: 3, alt: -1 },
  4: { degree: 3, alt: 0 },
  5: { degree: 4, alt: 0 },
  6: { degree: 5, alt: -1 }, // prefer ♭5 partner; enharmonic toggle can reach ♯4
  7: { degree: 5, alt: 0 },
  8: { degree: 6, alt: -1 },
  9: { degree: 6, alt: 0 },
  10: { degree: 7, alt: -1 },
  11: { degree: 7, alt: 0 }
};

function getOctavePartner(details) {
  const absNum = Math.abs(details.num);
  if (absNum !== 8 || details.alt >= 0) {
    return null;
  }
  const semitones = ((details.semitones % 12) + 12) % 12;
  return SEMITONE_TO_DIATONIC[semitones] || null;
}

function formatInterval(interval) {
  if (!interval) {return null;}
  const details = Interval.get(interval);
  if (!details || details.num === undefined) {return null;}

  const octavePartner = getOctavePartner(details);
  const degreeNumber = octavePartner ? octavePartner.degree : Math.abs(details.num);
  const alt = octavePartner ? octavePartner.alt : details.alt;

  let prefix = '';
  if (alt < 0) {prefix = '♭'.repeat(Math.abs(alt));}
  else if (alt > 0) {prefix = '♯'.repeat(alt);}
  return `${prefix}${degreeNumber}`;
}

// Helper function to get enharmonic equivalent of a scale degree
function getEnharmonicDegree(degreeStr) {
  if (!degreeStr) {return null;}

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
    if (!note || !state) {return null;}

    const { keyTonic, keyMode } = getKeyContextForColumn(state, note.startColumnIndex);
    if (!keyTonic) {return null;}

    const notePitch = state.fullRowData[note.row]?.toneNote;
    if (!notePitch) {return null;}

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
    if (!notes || notes.length === 0) {return [];}
    return notes.map(noteName => {
      const interval = Interval.distance(keyTonic, Note.pitchClass(noteName));
      return formatInterval(interval);
    });
  },

  /**
     * FINAL CORRECTED VERSION: Analyzes notes using the documented functions.
     */
  getRomanNumeralForNotes(notes, keyTonic) {
    if (!notes || notes.length < 2) {return null;}

    // Step 1: Detect the chord from the given notes.
    const [detectedChordName] = Chord.detect(notes);
    if (!detectedChordName) {return null;}

    // Step 2: Get the canonical symbol for that chord (e.g., "FM", "Gm7").
    const chordSymbol = Chord.get(detectedChordName).symbol;
    if (!chordSymbol) {return null;}

    // Step 3: Use the Progression module to convert the symbol to a Roman numeral string in the given key.
    const [rnString] = Progression.toRomanNumerals(keyTonic, [chordSymbol]);
    if (!rnString) {return null;}

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
