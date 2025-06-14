// js/components/Grid/Grid.js
import store from '../../state/store.js';
import ConfigService from '../../services/configService.js';

console.log("GridComponent: Module loaded.");

function getVisibleRowData() {
    return store.state.fullRowData.slice(
        store.state.gridPosition, 
        store.state.gridPosition + store.state.logicRows
    );
}

function getRowY(localRowIndex) {
    return localRowIndex * 0.5 * store.state.cellHeight;
}

function drawLegends() {
    const ctx = window.pitchGridCtx;
    const visibleRowData = getVisibleRowData();

    function drawLegendColumn(startCol, columnsOrder) {
        const xStart = ConfigService.getColumnX(startCol);
        const colWidthsPx = store.state.columnWidths.slice(startCol, startCol + 2).map(w => w * store.state.cellWidth);
        let cumulativeX = xStart;

        columnsOrder.forEach((colLabel, colIndex) => {
            const colWidth = colWidthsPx[colIndex];
            visibleRowData.forEach((row, rowIndex) => {
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
    // This logic is directly from your original drawGrid.js
    switch (pc) {
        case 'C': return { lineWidth: 3, dash: [], color: '#000' };
        case 'E': return { lineWidth: 1, dash: [5, 5], color: '#000' };
        case 'G': return { lineWidth: 1, dash: [], color: 'rgba(128,128,128,0.5)' };
        case 'D♭/C♯':
        case 'E♭/D♯':
        case 'F':
        case 'A':
        case 'B': return null; // These rows have no lines in the main grid area
        default: return { lineWidth: 1, dash: [], color: '#000' };
    }
}

function drawHorizontalLines() {
    const ctx = window.pitchGridCtx;
    const visibleRowData = getVisibleRowData();
    const totalColumns = store.state.columnWidths.length;

    visibleRowData.forEach((row, rowIndex) => {
        const y = getRowY(rowIndex);
        const pitchClass = getPitchClass(row.pitch);
        const style = getLineStyleFromPitchClass(pitchClass);

        if (style) {
            ctx.beginPath();
            ctx.moveTo(ConfigService.getColumnX(2), y);
            ctx.lineTo(ConfigService.getColumnX(totalColumns - 2), y);
            ctx.lineWidth = style.lineWidth;
            ctx.strokeStyle = style.color;
            ctx.setLineDash(style.dash);
            ctx.stroke();
            ctx.setLineDash([]); // Reset for other lines
        }
    });
}

function drawVerticalLines() {
    const pitchCtx = window.pitchGridCtx;
    const drumCtx = window.drumGridCtx;
    if (!pitchCtx || !drumCtx) return;

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
            style = { 
                lineWidth: 1, 
                strokeStyle: '#000', 
                dash: store.state.macrobeatBoundaryStyles[mbIndex] ? [] : [4, 2] 
            };
        } else {
            continue; // Skip non-boundary vertical lines for clarity
        }
        
        // Draw on pitch grid
        pitchCtx.beginPath();
        pitchCtx.moveTo(x, 0);
        pitchCtx.lineTo(x, pitchCtx.canvas.height);
        pitchCtx.lineWidth = style.lineWidth;
        pitchCtx.strokeStyle = style.strokeStyle;
        pitchCtx.setLineDash(style.dash);
        pitchCtx.stroke();

        // Draw on drum grid
        drumCtx.beginPath();
        drumCtx.moveTo(x, 0);
        drumCtx.lineTo(x, drumCtx.canvas.height);
        drumCtx.lineWidth = style.lineWidth;
        drumCtx.strokeStyle = style.strokeStyle;
        drumCtx.setLineDash(style.dash);
        drumCtx.stroke();
    }
    
    pitchCtx.setLineDash([]); // Reset line dash for pitch
    drumCtx.setLineDash([]); // Reset line dash for drum
}


function drawNoteOnCanvas(note, localRowIndex) {
    const ctx = window.pitchGridCtx;
    const y = getRowY(localRowIndex);
    const xStart = ConfigService.getColumnX(note.startColumnIndex);
    const width = ConfigService.getColumnX(note.endColumnIndex + 1) - xStart;
    
    const centerX = xStart + (ConfigService.getColumnX(note.startColumnIndex + 1) - xStart) / 2;
    const radius = store.state.cellHeight * 0.45;

    // Draw tail if it exists
    if (note.endColumnIndex > note.startColumnIndex) {
        const endX = ConfigService.getColumnX(note.endColumnIndex) + (store.state.columnWidths[note.endColumnIndex] * store.state.cellWidth) / 2;
        ctx.beginPath();
        ctx.moveTo(centerX, y);
        ctx.lineTo(endX, y);
        ctx.strokeStyle = note.color;
        ctx.lineWidth = store.state.cellWidth * 0.2;
        ctx.stroke();
    }

    // Draw note head
    ctx.beginPath();
    ctx.arc(centerX, y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = note.color;
    ctx.lineWidth = 6;
    ctx.fillStyle = 'white'; // Fill to obscure grid lines underneath
    ctx.fill();
    ctx.stroke();
}

function drawOvalNote(note, localRowIndex) {
    const ctx = window.pitchGridCtx;
    const y = getRowY(localRowIndex);
    const x = ConfigService.getColumnX(note.startColumnIndex);
    const cellWidth = store.state.columnWidths[note.startColumnIndex] * store.state.cellWidth;
    
    const cx = x + cellWidth / 2;
    const rx = cellWidth * 0.45;
    const ry = store.state.cellHeight * 0.45;

    ctx.beginPath();
    ctx.ellipse(cx, y, rx, ry, 0, 0, 2 * Math.PI);
    ctx.strokeStyle = note.color;
    ctx.lineWidth = 6;
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.stroke();
}

function renderPitchGrid() {
    const ctx = window.pitchGridCtx;
    if (!ctx || !ctx.canvas) return;
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    drawHorizontalLines();
    drawVerticalLines();
    drawLegends();
    
    store.state.placedNotes.forEach(note => {
        if (note.isDrum) return;
        const localRowIndex = note.row - store.state.gridPosition;
        if (localRowIndex >= 0 && localRowIndex < store.state.logicRows) {
            if (note.shape === 'oval') {
                drawOvalNote(note, localRowIndex);
            } else { // 'circle' and others
                drawNoteOnCanvas(note, localRowIndex);
            }
        }
    });
}

const Grid = {
    render() {
        console.log("GridComponent: Render triggered.");
        renderPitchGrid();
    }
};

export default Grid;