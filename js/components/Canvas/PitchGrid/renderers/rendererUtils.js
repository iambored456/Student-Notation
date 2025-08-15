// js/components/Canvas/PitchGrid/renderers/rendererUtils.js
import LayoutService from '../../../../services/layoutService.js';

export function getColumnX(index, options) {
    let x = 0;
    for (let i = 0; i < index; i++) {
        const widthMultiplier = options.columnWidths[i] || 0;
        x += widthMultiplier * options.cellWidth;
    }
    return x;
}

export function getRowY(rowIndex, options) {
    const viewportInfo = LayoutService.getViewportInfo();
    const absoluteY = rowIndex * viewportInfo.rowHeight;
    // THE FIX: Don't apply zoom again since rowHeight already includes zoom
    return absoluteY - viewportInfo.scrollOffset;
}

export function getPitchClass(pitchWithOctave) {
  let pc = (pitchWithOctave || '').replace(/\d/g, '').trim();
  pc = pc.replace(/b/g, '♭').replace(/#/g, '♯');
  return pc;
}

export function getLineStyleFromPitchClass(pc) {
    switch (pc) {
        case 'C': return { lineWidth: 3.33, dash: [], color: '#adb5bd' };
        case 'E': return { lineWidth: 1, dash: [10, 20], color: '#adb5bd' };
        case 'G': return { lineWidth: 1, dash: [], color: '#dee2e6' };
        case 'D♭/C♯':
        case 'E♭/D♯':
        case 'F':
        case 'A':
        case 'B':
            return null;
        default: return { lineWidth: 1, dash: [], color: '#ced4da' };
    }
}

export function getVisibleRowRange() {
    const { startRow, endRow } = LayoutService.getViewportInfo();
    return { startRow, endRow };
}