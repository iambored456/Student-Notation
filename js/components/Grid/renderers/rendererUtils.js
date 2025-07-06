// js/components/Grid/renderers/rendererUtils.js

export function getColumnX(index, { columnWidths, cellWidth }) {
    let x = 0;
    for (let i = 0; i < index; i++) {
        const widthMultiplier = columnWidths[i] || 0;
        x += widthMultiplier * cellWidth;
    }
    return x;
}

// --- THIS IS THE REVERTED AND CORRECTED FUNCTION ---
// It calculates the Y-coordinate for the CENTER of a row.
// This simple calculation relies on the padding rows added in main.js
// to ensure the top-most notes are not visually cut off.
export function getRowY(rowIndex, { cellHeight }) {
    return rowIndex * 0.5 * cellHeight;
}

export function getPitchClass(pitchWithOctave) {
  let pc = (pitchWithOctave || '').replace(/\d/g, '').trim();
  pc = pc.replace(/b/g, '♭').replace(/#/g, '♯');
  return pc;
}

export function getLineStyleFromPitchClass(pc) {
    switch (pc) {
        case 'C': return { lineWidth: 2, dash: [], color: '#dee2e6' };
        case 'E': return { lineWidth: 1, dash: [10, 10], color: '#dee2e6' };
        case 'G': return { lineWidth: 1, dash: [], color: '#f8f9fa' };
        // We explicitly return null for these because they have no line or fill.
        // Their "line" is simply the border of their colored legend cell.
        case 'D♭/C♯': case 'E♭/D♯': case 'F': case 'A': case 'B': return null;
        // The default case handles all other notes (D, F#, G#, A#, etc.)
        default: return { lineWidth: 1, dash: [], color: '#e9ecef' };
    }
}