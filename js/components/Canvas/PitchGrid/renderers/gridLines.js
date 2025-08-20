// js/components/Canvas/PitchGrid/renderers/gridLines.js
import { getColumnX, getRowY, getPitchClass, getLineStyleFromPitchClass, getCurrentCoordinateMapping } from './rendererUtils.js';
import { shouldDrawVerticalLineAtColumn, isTonicColumn } from '../../../../utils/tonicColumnUtils.js';

function drawHorizontalMusicLines(ctx, options, startRow, endRow) {
    const musicAreaStartX = getColumnX(2, options);
    const musicAreaEndX = getColumnX(options.columnWidths.length - 2, options);
    

    let linesDrawn = 0;
    let linesSkipped = 0;
    
    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
        const row = options.fullRowData[rowIndex];
        if (!row) {
            linesSkipped++;
            continue;
        }

        const y = getRowY(rowIndex, options);
        // Add a small buffer to prevent lines from disappearing at the very edge
        if (y < -10 || y > options.viewportHeight + 10) {
            linesSkipped++;
            continue;
        }

        const pitchClass = getPitchClass(row.pitch);
        const style = getLineStyleFromPitchClass(pitchClass);
        
        // If style is null, it's a pitch that shouldn't have a line (F, A, etc.)
        if (!style) {
            linesSkipped++;
            continue;
        }
        
        linesDrawn++;

        // THE FIX: Check if the color is the special fill color for the G-line
        if (style.color === '#dee2e6') { 
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
    // First draw the regular grid lines (with modulation-aware spacing)
    drawRegularVerticalLines(ctx, options);
    
    // TEMPORARILY DISABLED: Draw ghost lines for modulated segments (now with proper grid-based calculation)
    // drawGhostLines(ctx, options);
}

function drawRegularVerticalLines(ctx, options) {
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
            style = { lineWidth: 2, strokeStyle: '#adb5bd', dash: [] };
        } else if (isMacrobeatEnd) {
            const mbIndex = macrobeatBoundaries.indexOf(i);
            if (mbIndex !== -1) {
                const boundaryStyle = macrobeatBoundaryStyles[mbIndex];
                if (boundaryStyle === 'anacrusis') {
                    continue;
                }
                style = { lineWidth: 1, strokeStyle: '#adb5bd', dash: boundaryStyle === 'solid' ? [] : [5, 5] };
            } else { 
                continue; 
            }
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

function drawGhostLines(ctx, options) {
    const { modulationMarkers } = options;
    
    if (!modulationMarkers || modulationMarkers.length === 0) {
        return;
    }
    
    // Get coordinate mapping to access ghost line positions
    const mapping = getCurrentCoordinateMapping(options);
    const baseMicrobeatPx = options.baseMicrobeatPx || options.cellWidth || 40;
    
    // Draw ghost lines for each modulated segment
    mapping.segments.forEach((segment, index) => {
        if (!segment.marker) {
            return; // Skip base segment
        }
        
        const ghostPositions = mapping.getGhostGridPositions(segment, options);
        
        // Get right legend boundary to stop ghost lines at the music area end
        const rightLegendColumnIndex = options.columnWidths.length - 2;
        const rightBoundary = getColumnX(rightLegendColumnIndex, options);
        
        console.log('[GRIDLINES] Ghost line boundary calculation:', {
            rightLegendColumnIndex,
            rightBoundary,
            canvasWidth: ctx.canvas.width
        });
        
        ghostPositions.forEach((x, posIndex) => {
            // Skip ghost lines that extend past the right boundary
            if (x >= rightBoundary) {
                return;
            }
            
            // Only draw ghost lines that don't overlap with regular grid lines
            const isRegular = isRegularGridLineAt(x, options);
            
            if (!isRegular) {
                drawGhostLine(ctx, x);
            }
        });
    });
}

function drawGhostLine(ctx, x) {
    ctx.save();
    
    // Ghost line style: dashed, lighter color, reduced opacity
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ctx.canvas.height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(173, 181, 189, 0.4)'; // 40% opacity of regular grid color
    ctx.setLineDash([4, 3]); // 4px dash, 3px gap
    ctx.stroke();
    
    ctx.restore();
}

function isRegularGridLineAt(x, options) {
    // Check if there's already a regular grid line at this position
    // This is a simple tolerance check to avoid overlapping lines
    const tolerance = 2; // pixels
    const { columnWidths } = options;
    
    let currentX = 0;
    for (let i = 0; i < columnWidths.length; i++) {
        const lineX = getColumnX(i, options);
        if (Math.abs(x - lineX) <= tolerance) {
            return true;
        }
    }
    
    return false;
}