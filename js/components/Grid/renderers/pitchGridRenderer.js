// js/components/Grid/renderers/pitchGridRenderer.js
import store from '../../../state/index.js';
import { drawHorizontalLines, drawVerticalLines } from './gridLines.js';
import { drawLegends } from './legend.js';
import { drawSingleColumnOvalNote, drawTwoColumnOvalNote, drawTonicShape } from './notes.js';
import { getVisibleRowRange } from './rendererUtils.js';

export function drawPitchGrid(ctx, options) {
    const fullOptions = { ...options, ...store.state };
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // 1. Get the range of rows that are actually visible
    const { startRow, endRow } = getVisibleRowRange();
    
    console.log(`[drawPitchGrid] Rendering rows ${startRow} to ${endRow}`);
    console.log(`[drawPitchGrid] Total notes to check: ${options.placedNotes.length}`);
    
    // 2. Pass the visible range to the renderers that draw row-based elements
    drawLegends(ctx, fullOptions, startRow, endRow);
    drawHorizontalLines(ctx, fullOptions, startRow, endRow);
    drawVerticalLines(ctx, fullOptions); // Vertical lines are not virtualized
    
    // 3. Filter notes and signs to only those that are visible before drawing
    const visibleNotes = options.placedNotes.filter(note => 
        !note.isDrum && note.row >= startRow && note.row <= endRow
    );

    const visibleTonicSigns = options.placedTonicSigns.filter(sign =>
        sign.row >= startRow && sign.row <= endRow
    );

    console.log(`[drawPitchGrid] Visible notes to draw: ${visibleNotes.length}`);
    
    // Draw each visible note
    visibleNotes.forEach(note => {
        console.log(`[drawPitchGrid] Drawing note: shape=${note.shape}, row=${note.row}, col=${note.startColumnIndex}, color=${note.color}`);
        
        // The note drawing functions use getRowY, so they will automatically
        // draw in the correct virtualized position.
        if (note.shape === 'oval') {
            drawSingleColumnOvalNote(ctx, fullOptions, note, note.row);
        } else if (note.shape === 'circle') {
            drawTwoColumnOvalNote(ctx, fullOptions, note, note.row);
        } else {
            console.warn(`[drawPitchGrid] Unknown note shape: ${note.shape}`);
        }
    });

    // Draw tonic signs
    visibleTonicSigns.forEach(sign => {
        drawTonicShape(ctx, fullOptions, sign);
    });
    
    console.log(`[drawPitchGrid] Finished rendering`);
}