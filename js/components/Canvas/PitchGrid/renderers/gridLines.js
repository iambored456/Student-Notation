// js/components/Canvas/PitchGrid/renderers/gridLines.js
import { getColumnX, getRowY, getPitchClass, getLineStyleFromPitchClass } from './rendererUtils.js';
import { shouldDrawVerticalLineAtColumn, isTonicColumn } from '../../../../utils/tonicColumnUtils.js';

function drawHorizontalMusicLines(ctx, options, startRow, endRow) {
    const musicAreaStartX = getColumnX(2, options);
    const musicAreaEndX = getColumnX(options.columnWidths.length - 2, options);

    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
        const row = options.fullRowData[rowIndex];
        if (!row) continue;

        const y = getRowY(rowIndex, options);
        // Add a small buffer to prevent lines from disappearing at the very edge
        if (y < -10 || y > options.viewportHeight + 10) continue;

        const pitchClass = getPitchClass(row.pitch);
        const style = getLineStyleFromPitchClass(pitchClass);
        
        // If style is null, it's a pitch that shouldn't have a line (F, A, etc.)
        if (!style) continue;

        // THE FIX: Check if the color is the special fill color for the G-line
        if (style.color === '#f8f9fa') { 
            ctx.fillStyle = style.color;
            // Use cellHeight directly since it already includes zoom scaling
            ctx.fillRect(musicAreaStartX, y - options.cellHeight / 2, musicAreaEndX - musicAreaStartX, options.cellHeight);
        } else {
            // Otherwise, draw a normal line
            ctx.beginPath();
            ctx.moveTo(musicAreaStartX, y);
            ctx.lineTo(musicAreaEndX, y);
            ctx.lineWidth = style.lineWidth;
            ctx.strokeStyle = style.color;
            ctx.setLineDash(style.dash);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

export function drawHorizontalLines(ctx, options, startRow, endRow) {
    drawHorizontalMusicLines(ctx, options, startRow, endRow);
}

export function drawVerticalLines(ctx, options) {
    // This function remains correct and does not need changes.
    const { columnWidths, macrobeatGroupings, macrobeatBoundaryStyles, placedTonicSigns } = options;
    const totalColumns = columnWidths.length;
    let macrobeatBoundaries = [];

    let current_col = 2;
    for(let i=0; i<macrobeatGroupings.length; i++) {
        while(placedTonicSigns.some(ts => ts.columnIndex === current_col)) {
            current_col += 2;  // Fixed: Each tonic spans 2 columns
        }
        current_col += macrobeatGroupings[i];
        macrobeatBoundaries.push(current_col);
    }

    
    for (let i = 0; i <= totalColumns; i++) {
        const x = getColumnX(i, options);
        let style;
        const isBoundary = i === 2 || i === totalColumns - 2;
        const isTonicColumnStart = isTonicColumn(i, placedTonicSigns);
        const isTonicColumnEnd = placedTonicSigns.some(ts => i === ts.columnIndex + 2);
        const isMacrobeatEnd = macrobeatBoundaries.includes(i);
        const shouldDraw = shouldDrawVerticalLineAtColumn(i, placedTonicSigns);


        // Skip drawing vertical lines in the middle of tonic shapes
        if (!shouldDraw) {
            continue;
        }

        if (isBoundary || isTonicColumnStart || isTonicColumnEnd) {
            style = { lineWidth: 2, strokeStyle: '#dee2e6', dash: [] };
        } else if (isMacrobeatEnd) {
            const mbIndex = macrobeatBoundaries.indexOf(i);
            if (mbIndex !== -1) {
                const boundaryStyle = macrobeatBoundaryStyles[mbIndex];
                if (boundaryStyle === 'anacrusis') continue;
                style = { lineWidth: 1, strokeStyle: '#dee2e6', dash: boundaryStyle === 'solid' ? [] : [5, 5] };
            } else { continue; }
        } else { 
            continue; 
        }
        
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ctx.canvas.height);
        ctx.lineWidth = style.lineWidth;
        ctx.strokeStyle = style.strokeStyle;
        ctx.setLineDash(style.dash);
        ctx.stroke();
    }
    ctx.setLineDash([]);
}