// js/components/Grid/Grid.js
import store from '../../state/store.js';
import ConfigService from '../../services/configService.js';
import CanvasContextService from '../../services/canvasContextService.js';
import SynthEngine from '../../services/synthEngine.js';

console.log("GridComponent (PitchGrid): Module loaded.");

// --- Private State ---
let pitchHoverCtx;
let isDragging = false;
let currentDraggedNote = null;
let isRightClickActive = false;
let previousTool = null;

// --- Helper Functions ---
function getColumnIndex(x) {
    let cumulative = 0;
    for (let i = 0; i < store.state.columnWidths.length; i++) {
        cumulative += store.state.columnWidths[i] * store.state.cellWidth;
        if (x < cumulative) return i;
    }
    return store.state.columnWidths.length - 1;
}

function getPitchForRow(rowIndex) {
    const rowData = store.state.fullRowData[rowIndex];
    return rowData ? rowData.toneNote : null;
}

function getRowIndex(y) {
    const visualRowHeight = store.state.cellHeight * 0.5;
    return Math.floor((y + visualRowHeight / 2) / visualRowHeight);
}

function getRowY(rowIndex) {
    return rowIndex * 0.5 * store.state.cellHeight;
}

// --- Drawing Functions ---
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
                    
                    const hex = (row.hex || '#ffffff').substring(1);
                    const r = parseInt(hex.substring(0, 2), 16);
                    const g = parseInt(hex.substring(2, 4), 16);
                    const b = parseInt(hex.substring(4, 6), 16);
                    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                    ctx.fillStyle = luminance > 0.5 ? '#212529' : '#ffffff';

                    const fontSize = Math.max(10, Math.min(store.state.cellWidth * 0.7, store.state.cellHeight * 0.7));
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
    drawLegendColumn(store.state.columnWidths.length - 2, ['A', 'B']);
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
            const topY = y - (store.state.cellHeight / 2);
            ctx.fillStyle = style.color;
            ctx.fillRect(startX, topY, gridWidth, store.state.cellHeight);
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
            style = { lineWidth: 2, strokeStyle: '#dee2e6', dash: [] };
        } else if (isMacrobeatEnd) {
            const mbIndex = macrobeatBoundaries.indexOf(i);
            const boundaryStyle = store.state.macrobeatBoundaryStyles[mbIndex];
            if (boundaryStyle === 'anacrusis') continue;
            style = { lineWidth: 1, strokeStyle: '#dee2e6', dash: boundaryStyle === 'solid' ? [] : [4, 2] };
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
    const centerX = xStart + cellWidth;
    
    const dynamicStrokeWidth = Math.max(1.5, cellWidth * 0.15);

    if (note.endColumnIndex > note.startColumnIndex) {
        const endX = ConfigService.getColumnX(note.endColumnIndex + 1);
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
}

function drawSingleColumnOvalNote(note, rowIndex, providedCtx = null) {
    const ctx = providedCtx || CanvasContextService.getPitchContext();
    if (!ctx) return;
    const y = getRowY(rowIndex);
    const x = ConfigService.getColumnX(note.startColumnIndex);
    const cellWidth = store.state.columnWidths[note.startColumnIndex] * store.state.cellWidth;
    const cellHeight = store.state.cellHeight;

    const dynamicStrokeWidth = Math.max(0.5, cellWidth * 0.15);

    const cx = x + cellWidth / 2;
    const rx = (cellWidth / 2) - (dynamicStrokeWidth / 2);
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

// --- Hover & Interaction Logic ---
function drawHoverHighlight(colIndex, rowIndex, color) {
    if (!pitchHoverCtx) return;
    const x = ConfigService.getColumnX(colIndex);
    const y = rowIndex * 0.5 * store.state.cellHeight - store.state.cellHeight / 2;
    const selectedToolType = store.state.selectedTool.type;
    let highlightWidth = (selectedToolType === 'circle' || isRightClickActive)
        ? store.state.cellWidth * 2
        : store.state.columnWidths[colIndex] * store.state.cellWidth;
    
    pitchHoverCtx.fillStyle = color;
    pitchHoverCtx.fillRect(x, y, highlightWidth, store.state.cellHeight);
}

function drawGhostNote(colIndex, rowIndex) {
    if (!pitchHoverCtx) return;
    const { type, color } = store.state.selectedTool;
    const ghostNote = { 
        row: rowIndex, 
        startColumnIndex: colIndex, 
        endColumnIndex: colIndex, 
        color: color, 
        shape: type, 
        isDrum: false 
    };
    pitchHoverCtx.globalAlpha = 0.4;
    if (ghostNote.shape === 'oval') {
        drawSingleColumnOvalNote(ghostNote, rowIndex, pitchHoverCtx);
    } else {
        drawTwoColumnOvalNote(ghostNote, rowIndex, pitchHoverCtx);
    }
    pitchHoverCtx.globalAlpha = 1.0;
}

// --- Event Handlers ---
function handleMouseDown(e) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const colIndex = getColumnIndex(x);
    if (colIndex < 2 || colIndex >= store.state.columnWidths.length - 2) return;
    const rowIndex = getRowIndex(y);

    if (e.button === 2) { // Right-click for erasing
        e.preventDefault();
        isRightClickActive = true;
        if (store.state.selectedTool.type !== 'eraser') {
            previousTool = { ...store.state.selectedTool };
        }
        store.setSelectedTool('eraser');
        store.eraseNoteAt(colIndex, rowIndex);
        pitchHoverCtx.clearRect(0, 0, pitchHoverCtx.canvas.width, pitchHoverCtx.canvas.height);
        drawHoverHighlight(colIndex, rowIndex, 'rgba(220, 53, 69, 0.3)');
        return;
    }

    if (e.button === 0) { // Left-click
        if (store.state.selectedTool.type === 'eraser') {
            store.eraseNoteAt(colIndex, rowIndex);
            return;
        }

        const { type, color } = store.state.selectedTool;
        const newNote = { row: rowIndex, startColumnIndex: colIndex, endColumnIndex: colIndex, color: color, shape: type, isDrum: false };
        store.addNote(newNote);
        
        isDragging = (type === 'circle');
        if(isDragging) {
            currentDraggedNote = newNote;
        }

        const pitch = getPitchForRow(rowIndex);
        if (pitch) {
            SynthEngine.playNote(pitch, '8n');
        }
    }
}

function handleMouseMove(e) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const colIndex = getColumnIndex(x);
    const rowIndex = getRowIndex(y);

    if (!pitchHoverCtx) return;
    pitchHoverCtx.clearRect(0, 0, pitchHoverCtx.canvas.width, pitchHoverCtx.canvas.height);

    if (colIndex < 2 || colIndex >= store.state.columnWidths.length - 2 || getPitchForRow(rowIndex) === null) {
        return; // Exit if hovering over legends or invalid area
    }

    if (isRightClickActive) {
        store.eraseNoteAt(colIndex, rowIndex);
        drawHoverHighlight(colIndex, rowIndex, 'rgba(220, 53, 69, 0.3)');
    } else if (store.state.selectedTool.type !== 'eraser' && !isDragging) {
        drawHoverHighlight(colIndex, rowIndex, 'rgba(74, 144, 226, 0.2)');
        drawGhostNote(colIndex, rowIndex);
    }
    
    if (isDragging && currentDraggedNote) {
        const startIndex = currentDraggedNote.startColumnIndex;
        const newEndIndex = (colIndex >= startIndex + 2) ? colIndex : startIndex;
        
        if (newEndIndex !== currentDraggedNote.endColumnIndex) {
            store.updateNoteTail(currentDraggedNote, newEndIndex);
        }
    }
}

function handleMouseLeave() {
    if (pitchHoverCtx) {
        pitchHoverCtx.clearRect(0, 0, pitchHoverCtx.canvas.width, pitchHoverCtx.canvas.height);
    }
}

function handleGlobalMouseUp() {
    if (isDragging) {
        store.recordState(); // Only record history at the end of a drag
    }
    isDragging = false;
    currentDraggedNote = null;

    if (isRightClickActive) {
        isRightClickActive = false;
        if (previousTool) {
            store.setSelectedTool(previousTool.type, previousTool.color, previousTool.tonicNumber);
            previousTool = null;
        }
    }
    handleMouseLeave(); // Clear any lingering hover visuals
}

// --- Public Interface ---
const Grid = {
    init() {
        const pitchCanvas = document.getElementById('notation-grid');
        const hoverCanvas = document.getElementById('hover-canvas');

        if (!pitchCanvas || !hoverCanvas) {
            console.error("GridComponent: Could not find required canvas elements for initialization.");
            return;
        }
        pitchHoverCtx = hoverCanvas.getContext('2d');

        pitchCanvas.addEventListener('mousedown', handleMouseDown);
        pitchCanvas.addEventListener('mousemove', handleMouseMove);
        pitchCanvas.addEventListener('mouseleave', handleMouseLeave);
        pitchCanvas.addEventListener('contextmenu', e => e.preventDefault());
        
        // Listen for global mouseup to cancel dragging/erasing states
        window.addEventListener('mouseup', handleGlobalMouseUp);

        console.log("GridComponent (PitchGrid): Initialized and event listeners attached.");
    },
    
    render() {
        console.log("GridComponent (PitchGrid): Render triggered.");
        renderPitchGrid();
    }
};

export default Grid;