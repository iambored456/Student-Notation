// js/components/Grid/renderers/pitchGridRenderer.js
import TonalService from '../../../services/tonalService.js';
import store from '../../../state/store.js';

// --- Pure Drawing Helper Functions ---
function getColumnX(index, { columnWidths, cellWidth }) {
    let x = 0;
    for (let i = 0; i < index; i++) {
        const widthMultiplier = columnWidths[i] || 0;
        x += widthMultiplier * cellWidth;
    }
    return x;
}

function getRowY(rowIndex, { cellHeight }) {
    return rowIndex * 0.5 * cellHeight;
}

function getPitchClass(pitchWithOctave) {
  let pc = (pitchWithOctave || '').replace(/\d/g, '').trim();
  pc = pc.replace(/b/g, '♭').replace(/#/g, '♯');
  return pc;
}

function getLineStyleFromPitchClass(pc) {
    switch (pc) {
        case 'C': return { lineWidth: 2, dash: [], color: '#dee2e6' };
        case 'E': return { lineWidth: 1, dash: [5, 5], color: '#dee2e6' };
        case 'G': return { lineWidth: 1, dash: [], color: '#f8f9fa' };
        case 'D♭/C♯': case 'E♭/D♯': case 'F': case 'A': case 'B': return null;
        default: return { lineWidth: 1, dash: [], color: '#e9ecef' };
    }
}

function drawScaleDegreeText(ctx, note, options, centerX, centerY, noteHeight) {
    const degreeStr = TonalService.getDegreeForNote(note, options);
    if (!degreeStr) {
        return;
    }
    
    ctx.fillStyle = '#212529'; 

    // --- FINAL FIX: Set font size based on the note's shape ---
    const fontSize = note.shape === 'oval' 
        ? noteHeight * 0.35   // Smaller size for ovals
        : noteHeight * 0.525; // Original larger size for circles

    ctx.font = `bold ${fontSize}px 'Atkinson Hyperlegible', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.fillText(degreeStr, centerX, centerY);
}


function drawLegends(ctx, options) {
    const { fullRowData, columnWidths, cellWidth, cellHeight, colorMode } = options;
    
    function drawLegendColumn(startCol, columnsOrder) {
        const xStart = getColumnX(startCol, options);
        const colWidthsPx = columnWidths.slice(startCol, startCol + 2).map(w => w * cellWidth);
        let cumulativeX = xStart;

        columnsOrder.forEach((colLabel, colIndex) => {
            const colWidth = colWidthsPx[colIndex];
            fullRowData.forEach((row, rowIndex) => {
                if (row.column === colLabel) {
                    const y = getRowY(rowIndex, options);
                    
                    ctx.fillStyle = colorMode === 'bw' ? '#ffffff' : (row.hex || '#ffffff');
                    ctx.fillRect(cumulativeX, y - cellHeight / 2, colWidth, cellHeight);
                    
                    if (colorMode === 'bw') {
                        ctx.fillStyle = '#212529'; 
                    } else {
                        const hex = (row.hex || '#ffffff').substring(1);
                        const r = parseInt(hex.substring(0, 2), 16);
                        const g = parseInt(hex.substring(2, 4), 16);
                        const b = parseInt(hex.substring(4, 6), 16);
                        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
                        ctx.fillStyle = luminance > 0.5 ? '#212529' : '#ffffff';
                    }

                    const fontSize = Math.max(10, Math.min(cellWidth * 0.7, cellHeight * 0.7));
                    ctx.font = `${fontSize}px 'Atkinson Hyperlegible', sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(row.pitch, cumulativeX + colWidth / 2, y);
                }
            });
            cumulativeX += colWidth;
        });
    }

    drawLegendColumn(0, ['B', 'A']);
    drawLegendColumn(columnWidths.length - 2, ['A', 'B']);
}

function drawHorizontalLines(ctx, options) {
    const { fullRowData, columnWidths, cellHeight, placedTonicSigns } = options;

    const tonicColumnXCoords = placedTonicSigns.map(ts => {
        const startX = getColumnX(ts.columnIndex, options);
        const endX = startX + options.cellWidth * 2;
        return { start: startX, end: endX };
    }).sort((a,b) => a.start - b.start);

    const musicAreaStartX = getColumnX(2, options);
    const musicAreaEndX = getColumnX(columnWidths.length - 2, options);

    fullRowData.forEach((row, rowIndex) => {
        const y = getRowY(rowIndex, options);
        const pitchClass = getPitchClass(row.pitch);
        const style = getLineStyleFromPitchClass(pitchClass);
        if (!style) return;

        let lastX = musicAreaStartX;

        tonicColumnXCoords.forEach(coords => {
            drawSegment(lastX, coords.start, y, style);
            lastX = coords.end;
        });
        drawSegment(lastX, musicAreaEndX, y, style);
    });

    function drawSegment(startX, endX, y, style) {
        if (startX >= endX) return;
        const width = endX - startX;

        if (style.color === '#f8f9fa') {
             ctx.fillStyle = style.color; 
             ctx.fillRect(startX, y - (cellHeight / 2), width, cellHeight);
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
}

function drawVerticalLines(ctx, options) {
    const { columnWidths, macrobeatGroupings, macrobeatBoundaryStyles, placedTonicSigns } = options;
    const totalColumns = columnWidths.length;
    let macrobeatBoundaries = [];

    let current_col = 2;
    for(let i=0; i<macrobeatGroupings.length; i++) {
        while(placedTonicSigns.some(ts => ts.columnIndex === current_col)) {
            current_col++;
        }
        current_col += macrobeatGroupings[i];
        macrobeatBoundaries.push(current_col);
    }

    for (let i = 0; i <= totalColumns; i++) {
        const x = getColumnX(i, options);
        let style;
        const isBoundary = i === 2 || i === totalColumns - 2;
        const isTonicCol = placedTonicSigns.some(ts => ts.columnIndex === i || ts.columnIndex + 1 === i);
        const isMacrobeatEnd = macrobeatBoundaries.includes(i);

        if (isBoundary || isTonicCol) {
            style = { lineWidth: 2, strokeStyle: '#dee2e6', dash: [] };
        } else if (isMacrobeatEnd) {
            const mbIndex = macrobeatBoundaries.indexOf(i);
            if (mbIndex !== -1) {
                const boundaryStyle = macrobeatBoundaryStyles[mbIndex];
                if (boundaryStyle === 'anacrusis') continue;
                style = { lineWidth: 1, strokeStyle: '#dee2e6', dash: boundaryStyle === 'solid' ? [] : [4, 2] };
            } else { continue; }
        } else { continue; }
        
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
        const noteHeadHeight = (ry * 2);
        drawScaleDegreeText(ctx, note, options, centerX, y, noteHeadHeight);
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
        const noteHeadHeight = (ry * 2);
        drawScaleDegreeText(ctx, note, options, cx, y, noteHeadHeight);
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

// --- Main Exported Renderer ---
export function drawPitchGrid(ctx, options) {
    const fullOptions = { ...options, ...store.state };
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    drawHorizontalLines(ctx, fullOptions);
    drawVerticalLines(ctx, fullOptions);
    drawLegends(ctx, fullOptions);
    
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