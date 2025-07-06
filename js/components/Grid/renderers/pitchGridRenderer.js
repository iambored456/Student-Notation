// js/components/Grid/renderers/pitchGridRenderer.js
import store from '../../../state/store.js';
import { drawHorizontalLines, drawVerticalLines } from './gridLines.js';
import { drawLegends } from './legend.js';
import { drawSingleColumnOvalNote, drawTwoColumnOvalNote, drawTonicShape } from './notes.js';

export function drawPitchGrid(ctx, options) {
    const fullOptions = { ...options, ...store.state };
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw legends first, as they form the background
    drawLegends(ctx, fullOptions);
    
    // Draw grid lines on top of the legends
    drawHorizontalLines(ctx, fullOptions);
    drawVerticalLines(ctx, fullOptions);
    
    // Draw notes and signs on the very top
    options.placedNotes.forEach(note => {
        if (note.isDrum) return;
        if (note.shape === 'oval') {
            drawSingleColumnOvalNote(ctx, fullOptions, note, note.row);
        } else {
            drawTwoColumnOvalNote(ctx, fullOptions, note, note.row);
        }
    });

    options.placedTonicSigns.forEach(sign => {
        drawTonicShape(ctx, fullOptions, sign);
    });
}