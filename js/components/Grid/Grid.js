// js/components/Grid/Grid.js
import store from '../../state/store.js';
import ConfigService from '../../services/configService.js';
import CanvasContextService from '../../services/canvasContextService.js';

console.log("GridComponent: Module loaded.");

function getRowY(rowIndex) {
    // Returns the center of a full logical row (2 visual rows high)
    return rowIndex * 0.5 * store.state.cellHeight;
}

function drawLegends() {
    const ctx = CanvasContextService.getPitchContext();
    if (!ctx) return;
    
    function drawLegendColumn(startCol, columnsOrder) {
        const xStart = ConfigService.getColumnX(startCol);
        const colWidthsPx = store.state.columnWidths.slice(startCol, startCol + 2).map(w => w * store.state.cellWidth);
        let cumulativeX = xStart;

        columnsOrder.forEach((colLabel, colIndex) => {
            const colWidth = colWidthsPx[colIndex];
            store.state.fullRowData.forEach((row, rowIndex) => {
                if (row.column === colLabel) {
                    const y = getRowY(rowIndex);
                    
                    ctx.fillStyle = row.hex || '#fff'; 
                    ctx.fillRect(cumulativeX, y - store.state.cellHeight / 2, colWidth, store.state.cellHeight);
                    
                    ctx.fillStyle = '#000';
                    const fontSize = Math.max(12, Math.min(store.state.cellWidth * 0.8, store.state.cellHeight * 0.8));
                    ctx.font = `${fontSize}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(row.pitch, cumulativeX + colWidth / 2, y);
                }
            });
            cumulativeX += colWidth;
        });
    }

    drawLegendColumn(0, ['B', 'A']);
    drawLegendColumn(store.state.columnWidths.length - 2, ['A', 'B']);
}

function getPitchClass(pitchWithOctave) {
  let pc = (pitchWithOctave || '').replace(/\d/g, '').trim();
  pc = pc.replace(/b/g, '♭').replace(/#/g, '♯');
  return pc;
}

function getLineStyleFromPitchClass(pc) {
    switch (pc) {
        case 'C': return { lineWidth: 3, dash: [], color: '#000' };
        case 'E': return { lineWidth: 1, dash: [5, 5], color: '#000' };
        case 'G': return { lineWidth: 1, dash: [], color: 'rgba(128,128,128,0.5)' }; // This color will be used for the fill
        case 'D♭/C♯':
        case 'E♭/D♯':
        case 'F':
        case 'A':
        case 'B': return null;
        default: return { lineWidth: 1, dash: [], color: '#000' };
    }
}

function drawHorizontalLines() {
    const ctx = CanvasContextService.getPitchContext();
    if (!ctx) return;
    const totalColumns = store.state.columnWidths.length;

    const startX = ConfigService.getColumnX(2);
    const endX = ConfigService.getColumnX(totalColumns - 2);
    const gridWidth = endX - startX;

    store.state.fullRowData.forEach((row, rowIndex) => {
        const y = getRowY(rowIndex);
        const pitchClass = getPitchClass(row.pitch);
        const style = getLineStyleFromPitchClass(pitchClass);

        if (!style) return;

        if (pitchClass === 'G') {
            const visualRowHeight = store.state.cellHeight * 1;
            const topY = y - (visualRowHeight / 2);
            ctx.fillStyle = style.color;
            ctx.fillRect(startX, topY, gridWidth, visualRowHeight);
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
    });
}

function drawVerticalLines() {
    const pitchCtx = CanvasContextService.getPitchContext();
    if (!pitchCtx) return;

    const totalColumns = store.state.columnWidths.length;
    let macrobeatBoundaries = [];
    let cum = 2;
    store.state.macrobeatGroupings.forEach(group => {
        cum += group;
        macrobeatBoundaries.push(cum);
    });

    for (let i = 0; i <= totalColumns; i++) {
        const x = ConfigService.getColumnX(i);
        let isBoundary = i === 2 || i === totalColumns - 2;
        let isMacrobeatEnd = macrobeatBoundaries.includes(i);

        let style;
        if (isBoundary) {
            style = { lineWidth: 2, strokeStyle: '#000', dash: [] };
        } else if (isMacrobeatEnd) {
            const mbIndex = macrobeatBoundaries.indexOf(i);
            const boundaryStyle = store.state.macrobeatBoundaryStyles[mbIndex];
            if (boundaryStyle === 'anacrusis') continue;
            style = { lineWidth: 1, strokeStyle: '#000', dash: boundaryStyle === 'solid' ? [] : [4, 2] };
        } else {
            continue;
        }
        
        pitchCtx.beginPath();
        pitchCtx.moveTo(x, 0);
        pitchCtx.lineTo(x, pitchCtx.canvas.height);
        pitchCtx.lineWidth = style.lineWidth;
        pitchCtx.strokeStyle = style.strokeStyle;
        pitchCtx.setLineDash(style.dash);
        pitchCtx.stroke();
    }
    
    pitchCtx.setLineDash([]);
}

function drawTwoColumnOvalNote(note, rowIndex, providedCtx = null) {
    const ctx = providedCtx || CanvasContextService.getPitchContext();
    if (!ctx) return;
    const y = getRowY(rowIndex);
    const xStart = ConfigService.getColumnX(note.startColumnIndex);
    const cellWidth = store.state.cellWidth;
    const cellHeight = store.state.cellHeight;
    const STROKE_WIDTH = 4;
    const centerX = xStart + cellWidth;

    if (note.endColumnIndex > note.startColumnIndex) {
        // FIX: Calculate the tail's end point to be the right edge of the final cell.
        const endX = ConfigService.getColumnX(note.endColumnIndex + 1);
        ctx.beginPath();
        ctx.moveTo(centerX, y);
        ctx.lineTo(endX, y);
        ctx.strokeStyle = note.color;
        ctx.lineWidth = store.state.cellWidth * 0.2;
        ctx.stroke();
    }

    const rx = cellWidth - (STROKE_WIDTH / 2);
    const ry = (cellHeight / 2) - (STROKE_WIDTH / 2);

    ctx.beginPath();
    ctx.ellipse(centerX, y, rx, ry, 0, 0, 2 * Math.PI);
    ctx.strokeStyle = note.color;
    ctx.lineWidth = STROKE_WIDTH;
    ctx.stroke();
}

function drawSingleColumnOvalNote(note, rowIndex, providedCtx = null) {
    const ctx = providedCtx || CanvasContextService.getPitchContext();
    if (!ctx) return;
    const y = getRowY(rowIndex);
    const x = ConfigService.getColumnX(note.startColumnIndex);
    const cellWidth = store.state.columnWidths[note.startColumnIndex] * store.state.cellWidth;
    const cellHeight = store.state.cellHeight;
    const STROKE_WIDTH = 4;
    const cx = x + cellWidth / 2;
    const rx = (cellWidth / 2) - (STROKE_WIDTH / 2);
    const ry = (cellHeight / 2) - (STROKE_WIDTH / 2);

    ctx.beginPath();
    ctx.ellipse(cx, y, rx, ry, 0, 0, 2 * Math.PI);
    ctx.strokeStyle = note.color;
    ctx.lineWidth = STROKE_WIDTH;
    ctx.stroke();
}

function renderPitchGrid() {
    const ctx = CanvasContextService.getPitchContext();
    if (!ctx || !ctx.canvas) return;
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    drawHorizontalLines();
    drawVerticalLines();
    drawLegends();
    
    store.state.placedNotes.forEach(note => {
        if (note.isDrum) return;
        if (note.shape === 'oval') {
            drawSingleColumnOvalNote(note, note.row);
        } else {
            drawTwoColumnOvalNote(note, note.row);
        }
    });
}

const Grid = {
    render() {
        console.log("GridComponent: Render triggered.");
        renderPitchGrid();
    },
    drawTwoColumnOvalNote,
    drawSingleColumnOvalNote
};

export default Grid;