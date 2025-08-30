// js/components/Canvas/PitchGrid/renderers/gridLines.js
import { getColumnX, getRowY, getPitchClass, getLineStyleFromPitchClass, getCurrentCoordinateMapping } from './rendererUtils.js';
import { shouldDrawVerticalLineAtColumn, isTonicColumn } from '../../../../utils/tonicColumnUtils.js';
import { fullRowData } from '../../../../state/pitchData.js';

function drawHorizontalMusicLines(ctx, options, startRow, endRow) {
    // Access accidental button states
    const { sharp, flat } = options.accidentalMode;
    const anyAccidentalActive = sharp || flat;
    const allAccidentalsInactive = !sharp && !flat;

    // Helper function to get legend columns where a specific pitch class appears
    function getLegendColumnsForPitch(pitchClass) {
        const legendColumns = [];
        
        // Check all rows in pitchData to find where this pitch class appears in legend columns
        fullRowData.forEach(row => {
            const rowPitchClass = getPitchClass(row.pitch);
            if (rowPitchClass === pitchClass && (row.column === 'A' || row.column === 'B')) {
                // Map 'A' and 'B' to actual column indices based on legend organization:
                // Left legend: drawLegendColumn(0, ['B', 'A']) - col 0 = 'B', col 1 = 'A' 
                // Right legend: drawLegendColumn(length-2, ['A', 'B']) - col length-2 = 'A', col length-1 = 'B'
                if (row.column === 'A') {
                    legendColumns.push(1, options.columnWidths.length - 2); // Left A is col 1, right A is col length-2
                } else if (row.column === 'B') {
                    legendColumns.push(0, options.columnWidths.length - 1); // Left B is col 0, right B is col length-1
                }
            }
        });
        
        return [...new Set(legendColumns)]; // Remove duplicates
    }

    // Helper function to get OPPOSITE legend columns where a pitch class should draw
    function getOppositeLegendColumnsForPitch(pitchClass) {
        const oppositeColumns = [];
        
        // Check all rows in pitchData to find where this pitch class appears in legend columns
        fullRowData.forEach(row => {
            const rowPitchClass = getPitchClass(row.pitch);
            if (rowPitchClass === pitchClass && (row.column === 'A' || row.column === 'B')) {
                // If pitch appears in 'A' columns, draw in 'B' columns and vice versa
                if (row.column === 'A') {
                    oppositeColumns.push(0, options.columnWidths.length - 1); // Draw in B columns (col 0 and length-1)
                } else if (row.column === 'B') {
                    oppositeColumns.push(1, options.columnWidths.length - 2); // Draw in A columns (col 1 and length-2)
                }
            }
        });
        
        return [...new Set(oppositeColumns)]; // Remove duplicates
    }

    // Helper function to get A columns only (for G line when accidentals are active/inactive)
    function getAColumnsOnly() {
        return [1, options.columnWidths.length - 2]; // Left A is col 1, right A is col length-2
    }

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
        
        linesDrawn++;

        // Determine drawing behavior based on pitch class
        if (pitchClass === 'C' || pitchClass === 'E') {
            // C and E lines: Draw with gaps, skipping their own legend columns
            const columnsToSkip = getLegendColumnsForPitch(pitchClass);
            const fullStartX = getColumnX(0, options);
            const fullEndX = getColumnX(options.columnWidths.length, options);
            
            drawLineWithGaps(ctx, fullStartX, fullEndX, y, options, columnsToSkip, 'stroke', style);
            
        } else if (pitchClass === 'G') {
            // G-line: Always draw filled G line in pitch grid area (columns 2 to length-2)
            const pitchGridStartX = getColumnX(2, options);
            const pitchGridEndX = getColumnX(options.columnWidths.length - 2, options);
            
            ctx.fillStyle = style.color;
            ctx.fillRect(pitchGridStartX, y - options.cellHeight / 2, pitchGridEndX - pitchGridStartX, options.cellHeight);
            
            // G-line in legend columns: Conditional drawing in Column A based on accidental button states
            const aColumns = getAColumnsOnly(); // [1, length-2]
            
            if (allAccidentalsInactive) {
                // Draw filled G line in A columns when all accidental buttons are inactive
                ctx.fillStyle = style.color;
                drawLineInSpecificColumns(ctx, y, options, aColumns, 'fill', style);
            } else if (anyAccidentalActive) {
                // Draw simple line in A columns when any accidental button is active
                drawLineInSpecificColumns(ctx, y, options, aColumns, 'stroke', style);
            }
            
        } else if (['B', 'A', 'F'].includes(pitchClass)) {
            // B, A, F lines: Special handling based on accidental states
            if (allAccidentalsInactive) {
                // When all accidentals inactive: Don't draw B, A, F lines in B columns
                const oppositeColumns = getOppositeLegendColumnsForPitch(pitchClass);
                // Filter out B columns from opposite columns
                let filteredColumns = oppositeColumns.filter(col => 
                    col !== 0 && col !== (options.columnWidths.length - 1)
                );
                
                // Additionally, for 'A' pitch: also filter out A columns when accidentals inactive
                if (pitchClass === 'A') {
                    filteredColumns = filteredColumns.filter(col =>
                        col !== 1 && col !== (options.columnWidths.length - 2)
                    );
                }
                
                if (filteredColumns.length > 0) {
                    drawLineInSpecificColumns(ctx, y, options, filteredColumns, 'stroke', style);
                }
            } else {
                // Normal behavior: Draw in opposite legend columns
                const oppositeColumns = getOppositeLegendColumnsForPitch(pitchClass);
                drawLineInSpecificColumns(ctx, y, options, oppositeColumns, 'stroke', style);
            }
            
        } else if (['E♭/D♯', 'D♭/C♯'].includes(pitchClass)) {
            // Eb/D#, Db/C# lines: Always draw ONLY in opposite legend columns
            const oppositeColumns = getOppositeLegendColumnsForPitch(pitchClass);
            drawLineInSpecificColumns(ctx, y, options, oppositeColumns, 'stroke', style);
        } else if (pitchClass === 'B♭/A♯') {
            // Bb/A# lines: Special handling based on accidental states
            if (allAccidentalsInactive) {
                // When all accidentals inactive: Draw Bb line in ALL columns
                const fullStartX = getColumnX(0, options);
                const fullEndX = getColumnX(options.columnWidths.length, options);
                
                ctx.beginPath();
                ctx.moveTo(fullStartX, y);
                ctx.lineTo(fullEndX, y);
                ctx.lineWidth = style.lineWidth;
                ctx.strokeStyle = style.color;
                ctx.setLineDash(style.dash);
                ctx.stroke();
                ctx.setLineDash([]);
            } else {
                // Normal behavior when accidentals active: Draw with gaps, skipping own legend columns
                const columnsToSkip = getLegendColumnsForPitch(pitchClass);
                const fullStartX = getColumnX(0, options);
                const fullEndX = getColumnX(options.columnWidths.length, options);
                
                drawLineWithGaps(ctx, fullStartX, fullEndX, y, options, columnsToSkip, 'stroke', style);
            }
            
        } else {
            // All other pitches (D, etc.): Draw with gaps, skipping their own legend columns (original behavior)
            const columnsToSkip = getLegendColumnsForPitch(pitchClass);
            const fullStartX = getColumnX(0, options);
            const fullEndX = getColumnX(options.columnWidths.length, options);
            
            drawLineWithGaps(ctx, fullStartX, fullEndX, y, options, columnsToSkip, 'stroke', style);
        }
    }
}

function drawLineWithGaps(ctx, startX, endX, y, options, columnsToSkip, drawType, style) {
    // Create segments by identifying gap positions
    const gapRanges = columnsToSkip.map(colIndex => ({
        start: getColumnX(colIndex, options),
        end: getColumnX(colIndex + 1, options)
    })).sort((a, b) => a.start - b.start);
    
    let currentX = startX;
    
    // Draw segments between gaps
    gapRanges.forEach(gap => {
        if (currentX < gap.start) {
            drawSegment(ctx, currentX, gap.start, y, options, drawType, style);
        }
        currentX = Math.max(currentX, gap.end);
    });
    
    // Draw final segment if there's remaining space
    if (currentX < endX) {
        drawSegment(ctx, currentX, endX, y, options, drawType, style);
    }
}

function drawSegment(ctx, startX, endX, y, options, drawType, style) {
    if (drawType === 'fill') {
        ctx.fillRect(startX, y - options.cellHeight / 2, endX - startX, options.cellHeight);
    } else {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.lineWidth = style.lineWidth;
        ctx.strokeStyle = style.color;
        ctx.setLineDash(style.dash);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function drawLineInSpecificColumns(ctx, y, options, columnsToDrawIn, drawType, style) {
    // Draw line segments only in the specified columns
    columnsToDrawIn.forEach(colIndex => {
        const startX = getColumnX(colIndex, options);
        const endX = getColumnX(colIndex + 1, options);
        
        drawSegment(ctx, startX, endX, y, options, drawType || 'stroke', style);
    });
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