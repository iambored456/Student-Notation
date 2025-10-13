// js/components/Canvas/PitchGrid/renderers/pitchGridRenderer.js
import store from '../../../../state/index.js';
import { drawHorizontalLines, drawVerticalLines } from './gridLines.js';
import { drawLegends } from './legend.js';
import { drawSingleColumnOvalNote, drawTwoColumnOvalNote, drawTonicShape } from './notes.js';
import { getVisibleRowRange } from './rendererUtils.js';
import { renderStamps } from './stampRenderer.js';
import { renderTriplets } from './tripletRenderer.js';
import { renderModulationMarkers } from './modulationRenderer.js';
import { renderAnnotations } from './annotationRenderer.js';

export function drawPitchGrid(ctx, options) {
    const fullOptions = { ...options, ...store.state };
    
    
    // Debug modulation markers
    
    if (fullOptions.modulationMarkers && fullOptions.modulationMarkers.length > 0) {
    }
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // 1. Get the range of rows that are actually visible
    const { startRow, endRow } = getVisibleRowRange();
    
    
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

    
    // Draw each visible note
    visibleNotes.forEach(note => {
        
        // The note drawing functions use getRowY, so they will automatically
        // draw in the correct virtualized position.
        if (note.shape === 'oval') {
            drawSingleColumnOvalNote(ctx, fullOptions, note, note.row);
        } else if (note.shape === 'circle') {
            drawTwoColumnOvalNote(ctx, fullOptions, note, note.row);
        } else {
        }
    });

    // Draw tonic signs
    visibleTonicSigns.forEach(sign => {
        drawTonicShape(ctx, fullOptions, sign);
    });
    
    // Draw stamps (render on top of everything else)
    renderStamps(ctx, fullOptions);
    
    // Draw triplet groups (render on top of stamps)
    renderTriplets(ctx, fullOptions);
    
    // Draw modulation markers (render on top of everything else for UI overlay)
    renderModulationMarkers(ctx, fullOptions);

    // Draw annotations (render on top of modulation markers)
    renderAnnotations(ctx, fullOptions);

}
