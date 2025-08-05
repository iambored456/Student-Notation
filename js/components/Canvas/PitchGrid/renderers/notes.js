// js/components/Canvas/PitchGrid/renderers/notes.js
import { getColumnX, getRowY } from './rendererUtils.js';
import TonalService from '../../../../services/tonalService.js';
import {
    OVAL_NOTE_FONT_RATIO, FILLED_NOTE_FONT_RATIO, MIN_FONT_SIZE, MIN_TONIC_FONT_SIZE,
    MIN_STROKE_WIDTH_THICK, MIN_STROKE_WIDTH_THIN, STROKE_WIDTH_RATIO,
    TAIL_LINE_WIDTH_RATIO, MIN_TAIL_LINE_WIDTH, SHADOW_BLUR_RADIUS,
    TONIC_RADIUS_RATIO, MIN_TONIC_RADIUS, TONIC_BORDER_WIDTH, TONIC_FONT_SIZE_RATIO
} from '../../../../constants.js';

function drawScaleDegreeText(ctx, note, options, centerX, centerY, noteHeight) {
    const degreeStr = TonalService.getDegreeForNote(note, options);
    if (!degreeStr) return;
    
    // Scale font size with zoom level for clarity
    const fontSize = (note.shape === 'oval' ? noteHeight * OVAL_NOTE_FONT_RATIO : noteHeight * FILLED_NOTE_FONT_RATIO) * options.zoomLevel;
    if (fontSize < MIN_FONT_SIZE) return; // Don't draw text if it's too small to read

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
    
    // Don't double-scale - cellWidth/cellHeight already include zoom
    const dynamicStrokeWidth = Math.max(MIN_STROKE_WIDTH_THICK, cellWidth * STROKE_WIDTH_RATIO);

    // Draw the tail/extension line if the note extends beyond its starting column
    if (note.endColumnIndex > note.startColumnIndex) {
        const endX = getColumnX(note.endColumnIndex + 1, options);
        ctx.beginPath();
        ctx.moveTo(centerX, y);
        ctx.lineTo(endX, y);
        ctx.strokeStyle = note.color;
        ctx.lineWidth = Math.max(MIN_TAIL_LINE_WIDTH, cellWidth * TAIL_LINE_WIDTH_RATIO);
        ctx.stroke();
    }

    // Calculate ellipse dimensions without extra zoom scaling
    const rx = cellWidth - (dynamicStrokeWidth / 2);
    const ry = (cellHeight / 2) - (dynamicStrokeWidth / 2);

    // Save context state for cleaner rendering
    ctx.save();
    
    // Draw the circle/ellipse as a ring (hollow center)
    ctx.beginPath();
    ctx.ellipse(centerX, y, rx, ry, 0, 0, 2 * Math.PI);
    
    // Only stroke, no fill (to create transparent center)
    ctx.strokeStyle = note.color;
    ctx.lineWidth = dynamicStrokeWidth;
    ctx.shadowColor = note.color;
    ctx.shadowBlur = SHADOW_BLUR_RADIUS;
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
    
    // Don't double-scale - cellWidth/cellHeight already include zoom
    const dynamicStrokeWidth = Math.max(0.5, currentCellWidth * 0.15);
    const cx = x + currentCellWidth / 2;
    const rx = (currentCellWidth / 2) - (dynamicStrokeWidth / 2);
    const ry = (cellHeight / 2) - (dynamicStrokeWidth / 2);

    // Save context state
    ctx.save();
    
    // Draw the oval as transparent ring (not filled)
    ctx.beginPath();
    ctx.ellipse(cx, y, rx, ry, 0, 0, 2 * Math.PI);
    
    // Only stroke, no fill (to create transparent center)
    ctx.strokeStyle = note.color;
    ctx.lineWidth = dynamicStrokeWidth;
    ctx.shadowColor = note.color;
    ctx.shadowBlur = SHADOW_BLUR_RADIUS;
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