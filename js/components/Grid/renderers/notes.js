// js/components/Grid/renderers/notes.js
import { getColumnX, getRowY } from './rendererUtils.js';
import TonalService from '../../../services/tonalService.js';

function drawScaleDegreeText(ctx, note, options, centerX, centerY, noteHeight) {
    const degreeStr = TonalService.getDegreeForNote(note, options);
    if (!degreeStr) return;
    
    ctx.fillStyle = '#212529';
    const fontSize = note.shape === 'oval' ? noteHeight * 0.35 : noteHeight * 0.525;
    ctx.font = `bold ${fontSize}px 'Atkinson Hyperlegible', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(degreeStr, centerX, centerY);
}

export function drawTwoColumnOvalNote(ctx, options, note, rowIndex) {
    const { cellWidth, cellHeight } = options;
    const y = getRowY(rowIndex, options);
    const xStart = getColumnX(note.startColumnIndex, options);
    const centerX = xStart + cellWidth;
    
    const dynamicStrokeWidth = Math.max(1.5, cellWidth * 0.15);

    if (note.endColumnIndex > note.startColumnIndex) {
        const endX = getColumnX(note.endColumnIndex + 1, options);
        ctx.beginPath();
        ctx.moveTo(centerX, y);
        ctx.lineTo(endX, y);
        ctx.strokeStyle = note.color;
        ctx.lineWidth = Math.max(1, cellWidth * 0.2);
        ctx.stroke();
    }

    const rx = cellWidth - (dynamicStrokeWidth / 2);
    const ry = (cellHeight / 2) - (dynamicStrokeWidth / 2);

    ctx.beginPath();
    ctx.ellipse(centerX, y, rx, ry, 0, 0, 2 * Math.PI);
    ctx.strokeStyle = note.color;
    ctx.lineWidth = dynamicStrokeWidth;
    ctx.shadowColor = note.color;
    ctx.shadowBlur = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    if (options.degreeDisplayMode !== 'off') {
        drawScaleDegreeText(ctx, note, options, centerX, y, (ry * 2));
    }
}

export function drawSingleColumnOvalNote(ctx, options, note, rowIndex) {
    const { columnWidths, cellWidth, cellHeight } = options;
    const y = getRowY(rowIndex, options);
    const x = getColumnX(note.startColumnIndex, options);
    const currentCellWidth = columnWidths[note.startColumnIndex] * cellWidth;
    const dynamicStrokeWidth = Math.max(0.5, currentCellWidth * 0.15);
    const cx = x + currentCellWidth / 2;
    const rx = (currentCellWidth / 2) - (dynamicStrokeWidth / 2);
    const ry = (cellHeight / 2) - (dynamicStrokeWidth / 2);

    ctx.beginPath();
    ctx.ellipse(cx, y, rx, ry, 0, 0, 2 * Math.PI);
    ctx.strokeStyle = note.color;
    ctx.lineWidth = dynamicStrokeWidth;
    ctx.shadowColor = note.color;
    ctx.shadowBlur = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    if (options.degreeDisplayMode !== 'off') {
        drawScaleDegreeText(ctx, note, options, cx, y, (ry * 2));
    }
}

export function drawTonicShape(ctx, options, tonicSign) {
    const { cellWidth, cellHeight } = options;
    const x = getColumnX(tonicSign.columnIndex, options);
    const y = getRowY(tonicSign.row, options);
    const width = cellWidth * 2;
    const centerX = x + width / 2;
    const radius = Math.min(width, cellHeight) / 2 * 0.9;
    
    ctx.beginPath();
    ctx.arc(centerX, y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#212529';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    const numberText = tonicSign.tonicNumber.toString();
    ctx.fillStyle = '#212529';
    ctx.font = `bold ${radius * 1.5}px 'Atkinson Hyperlegible', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(numberText, centerX, y);
}