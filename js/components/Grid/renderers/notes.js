// js/components/Grid/renderers/notes.js
import { getColumnX, getRowY } from './rendererUtils.js';
import TonalService from '../../../services/tonalService.js';

function drawScaleDegreeText(ctx, note, options, centerX, centerY, noteHeight) {
    const degreeStr = TonalService.getDegreeForNote(note, options);
    if (!degreeStr) return;
    
    // Scale font size with zoom level for clarity
    const fontSize = (note.shape === 'oval' ? noteHeight * 0.35 : noteHeight * 0.525) * options.zoomLevel;
    if (fontSize < 4) return; // Don't draw text if it's too small to read

    ctx.fillStyle = '#212529';
    ctx.font = `bold ${fontSize}px 'Atkinson Hyperlegible', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(degreeStr, centerX, centerY);
}

export function drawTwoColumnOvalNote(ctx, options, note, rowIndex) {
    const { cellWidth, cellHeight, zoomLevel } = options;
    const y = getRowY(rowIndex, options);
    const xStart = getColumnX(note.startColumnIndex, options);
    const centerX = xStart + cellWidth;
    
    // Debug logging
    console.log(`[drawTwoColumnOvalNote] Drawing circle note at row: ${rowIndex}, col: ${note.startColumnIndex}, y: ${y}, centerX: ${centerX}`);
    
    // Scale all dimensions by the zoom level
    const dynamicStrokeWidth = Math.max(1.5, cellWidth * 0.15 * zoomLevel);

    // Draw the tail/extension line if the note extends beyond its starting column
    if (note.endColumnIndex > note.startColumnIndex) {
        const endX = getColumnX(note.endColumnIndex + 1, options);
        ctx.beginPath();
        ctx.moveTo(centerX, y);
        ctx.lineTo(endX, y);
        ctx.strokeStyle = note.color;
        ctx.lineWidth = Math.max(1, cellWidth * 0.2 * zoomLevel);
        ctx.stroke();
    }

    // Calculate ellipse dimensions
    const rx = (cellWidth - (dynamicStrokeWidth / 2)) * zoomLevel;
    const ry = ((cellHeight / 2) - (dynamicStrokeWidth / 2)) * zoomLevel;

    // Save context state for cleaner rendering
    ctx.save();
    
    // Draw the circle/ellipse
    ctx.beginPath();
    ctx.ellipse(centerX, y, rx, ry, 0, 0, 2 * Math.PI);
    
    // Fill with white first (to ensure visibility)
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    
    // Then stroke with the note color
    ctx.strokeStyle = note.color;
    ctx.lineWidth = dynamicStrokeWidth;
    ctx.shadowColor = note.color;
    ctx.shadowBlur = 1.5;
    ctx.stroke();
    
    // Reset shadow
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    
    ctx.restore();

    // Draw degree text if enabled
    if (options.degreeDisplayMode !== 'off') {
        drawScaleDegreeText(ctx, note, options, centerX, y, (cellHeight / 2));
    }
    
    // Debug logging
    console.log(`[drawTwoColumnOvalNote] Finished drawing circle note with color: ${note.color}`);
}

export function drawSingleColumnOvalNote(ctx, options, note, rowIndex) {
    const { columnWidths, cellWidth, cellHeight, zoomLevel } = options;
    const y = getRowY(rowIndex, options);
    const x = getColumnX(note.startColumnIndex, options);
    const currentCellWidth = columnWidths[note.startColumnIndex] * cellWidth;
    
    // Debug logging
    console.log(`[drawSingleColumnOvalNote] Drawing oval note at row: ${rowIndex}, col: ${note.startColumnIndex}`);
    
    // Scale all dimensions by the zoom level
    const dynamicStrokeWidth = Math.max(0.5, currentCellWidth * 0.15 * zoomLevel);
    const cx = x + currentCellWidth / 2;
    const rx = ((currentCellWidth / 2) - (dynamicStrokeWidth / 2)) * zoomLevel;
    const ry = ((cellHeight / 2) - (dynamicStrokeWidth / 2)) * zoomLevel;

    // Save context state
    ctx.save();
    
    // Draw the oval
    ctx.beginPath();
    ctx.ellipse(cx, y, rx, ry, 0, 0, 2 * Math.PI);
    
    // Fill with white first
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    
    // Then stroke with the note color
    ctx.strokeStyle = note.color;
    ctx.lineWidth = dynamicStrokeWidth;
    ctx.shadowColor = note.color;
    ctx.shadowBlur = 1.5;
    ctx.stroke();
    
    // Reset shadow
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    
    ctx.restore();

    // Draw degree text if enabled
    if (options.degreeDisplayMode !== 'off') {
        drawScaleDegreeText(ctx, note, options, cx, y, (cellHeight / 2));
    }
}

export function drawTonicShape(ctx, options, tonicSign) {
    const { cellWidth, cellHeight, zoomLevel } = options;
    const y = getRowY(tonicSign.row, options);
    const x = getColumnX(tonicSign.columnIndex, options);

    // Scale all dimensions by the zoom level
    const width = cellWidth * 2;
    const centerX = x + width / 2;
    const radius = (Math.min(width, cellHeight) / 2 * 0.9) * zoomLevel;
    if (radius < 2) return; // Don't draw if too small

    ctx.beginPath();
    ctx.arc(centerX, y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#212529';
    ctx.lineWidth = 2 * zoomLevel;
    ctx.stroke();
    
    const numberText = tonicSign.tonicNumber.toString();
    const fontSize = radius * 1.5;
    if (fontSize < 6) return; // Don't draw text if too small

    ctx.fillStyle = '#212529';
    ctx.font = `bold ${fontSize}px 'Atkinson Hyperlegible', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(numberText, centerX, y);
}