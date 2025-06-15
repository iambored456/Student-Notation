// js/components/Grid/gridEvents.js
import store from '../../state/store.js';
import ConfigService from '../../services/configService.js';
import SynthEngine from '../../services/synthEngine.js';
import Grid from './Grid.js';
import DrumGrid from './drumGrid.js';

console.log("GridEvents: Module loaded.");

let isDragging = false;
let currentDraggedNote = null;
let isRightClickActive = false;
let pitchHoverCanvas, pitchHoverCtx;
let drumHoverCanvas, drumHoverCtx;
let previousTool = null;

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

function drawPitchHoverHighlight(colIndex, rowIndex, color) {
    if (!pitchHoverCtx) return;
    console.log(`[PITCH HOVER] Drawing highlight for col ${colIndex}, row ${rowIndex}`);
    const x = ConfigService.getColumnX(colIndex);
    const y = rowIndex * 0.5 * store.state.cellHeight - store.state.cellHeight / 2;
    const selectedToolType = store.state.selectedTool.type;
    let highlightWidth;
    if (selectedToolType === 'circle' || isRightClickActive) {
        console.log(`[PITCH HOVER] Drawing wide highlight for ${selectedToolType} tool or eraser.`);
        highlightWidth = store.state.cellWidth * 2;
    } else {
        highlightWidth = store.state.columnWidths[colIndex] * store.state.cellWidth;
    }
    const cellHeight = store.state.cellHeight;
    pitchHoverCtx.fillStyle = color;
    pitchHoverCtx.fillRect(x, y, highlightWidth, cellHeight);
}

function drawGhostPitchNote(colIndex, rowIndex) {
    if (!pitchHoverCtx) return;
    const { type, color } = store.state.selectedTool;
    console.log(`[PITCH HOVER] Drawing ghost note of type '${type}'`);
    const ghostNote = { row: rowIndex, startColumnIndex: colIndex, endColumnIndex: colIndex, color: color, shape: type, isDrum: false };
    pitchHoverCtx.globalAlpha = 0.4;
    if (ghostNote.shape === 'oval') {
        Grid.drawSingleColumnOvalNote(ghostNote, rowIndex, pitchHoverCtx);
    } else {
        Grid.drawTwoColumnOvalNote(ghostNote, rowIndex, pitchHoverCtx);
    }
    pitchHoverCtx.globalAlpha = 1.0;
}

function getDrumRowIndex(y) {
    const pitchRowHeight = 0.5 * store.state.cellHeight;
    return Math.floor(y / pitchRowHeight);
}

function drawDrumHoverHighlight(colIndex, rowIndex, color) {
    if (!drumHoverCtx) return;
    console.log(`[DRUM HOVER] Drawing highlight for col ${colIndex}, row ${rowIndex}`);
    const x = ConfigService.getColumnX(colIndex);
    const pitchRowHeight = 0.5 * store.state.cellHeight;
    const y = rowIndex * pitchRowHeight;
    const cellWidth = store.state.columnWidths[colIndex] * store.state.cellWidth;
    drumHoverCtx.fillStyle = color;
    drumHoverCtx.fillRect(x, y, cellWidth, pitchRowHeight);
}

function drawGhostDrumNote(colIndex, rowIndex) {
    if (!drumHoverCtx) return;
    const x = ConfigService.getColumnX(colIndex);
    const pitchRowHeight = 0.5 * store.state.cellHeight;
    const y = rowIndex * pitchRowHeight;
    const cellWidth = store.state.columnWidths[colIndex] * store.state.cellWidth;
    console.log(`[DRUM HOVER] Drawing ghost drum shape for row ${rowIndex}`);
    drumHoverCtx.globalAlpha = 0.4;
    drumHoverCtx.fillStyle = '#000';
    DrumGrid.drawDrumShape(drumHoverCtx, rowIndex, x, y, cellWidth, pitchRowHeight);
    drumHoverCtx.globalAlpha = 1.0;
}

function handlePitchGridMouseDown(e) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const colIndex = getColumnIndex(x);
    if (colIndex < 2 || colIndex >= store.state.columnWidths.length - 2) return;
    const rowIndex = getRowIndex(y);
    if (e.button === 2) {
        e.preventDefault();
        isRightClickActive = true;
        if (store.state.selectedTool.type !== 'eraser') {
            previousTool = { ...store.state.selectedTool };
        }
        store.setSelectedTool('eraser');
        store.eraseNoteAt(colIndex, rowIndex);
        pitchHoverCtx.clearRect(0, 0, pitchHoverCanvas.width, pitchHoverCanvas.height);
        drawPitchHoverHighlight(colIndex, rowIndex, 'rgba(255, 0, 0, 0.3)');
        return;
    }
    if (e.button === 0) {
        if (store.state.selectedTool.type === 'eraser') {
            store.eraseNoteAt(colIndex, rowIndex);
            return;
        }
        const { type, color } = store.state.selectedTool;
        const newNote = { row: rowIndex, startColumnIndex: colIndex, endColumnIndex: colIndex, color: color, shape: type, isDrum: false };
        store.addNote(newNote);
        isDragging = (type === 'circle');
        currentDraggedNote = newNote;
        const pitch = getPitchForRow(rowIndex);
        if (pitch) {
            SynthEngine.playNote(pitch, '8n');
        }
    }
}

function handlePitchGridMouseMove(e) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const colIndex = getColumnIndex(x);
    const rowIndex = getRowIndex(y);
    if (!pitchHoverCtx || !pitchHoverCanvas) return;
    pitchHoverCtx.clearRect(0, 0, pitchHoverCanvas.width, pitchHoverCanvas.height);
    if (isRightClickActive) {
        store.eraseNoteAt(colIndex, rowIndex);
        drawPitchHoverHighlight(colIndex, rowIndex, 'rgba(255, 0, 0, 0.3)');
    } else if (store.state.selectedTool.type !== 'eraser' && !isDragging) {
        drawPitchHoverHighlight(colIndex, rowIndex, 'rgba(255, 255, 0, 0.3)');
        drawGhostPitchNote(colIndex, rowIndex);
    }
    if (isDragging && currentDraggedNote) {
        const startIndex = currentDraggedNote.startColumnIndex;
        let newEndIndex;
        if (colIndex >= startIndex + 2) {
            newEndIndex = colIndex;
        } else {
            newEndIndex = startIndex;
        }
        if (newEndIndex !== currentDraggedNote.endColumnIndex) {
            console.log(`[DRAG] Updating note tail to end at column ${newEndIndex}`);
            store.updateNoteTail(currentDraggedNote, newEndIndex);
        }
    }
}

function handlePitchGridMouseLeave() {
    if (pitchHoverCtx) {
        pitchHoverCtx.clearRect(0, 0, pitchHoverCanvas.width, pitchHoverCanvas.height);
    }
}

function handleDrumGridMouseMove(e) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const colIndex = getColumnIndex(x);
    const rowIndex = getDrumRowIndex(y);
    if (!drumHoverCtx || colIndex < 2 || colIndex >= store.state.columnWidths.length - 2 || rowIndex < 0 || rowIndex > 2) {
        handleDrumGridMouseLeave();
        return;
    }
    drumHoverCtx.clearRect(0, 0, drumHoverCanvas.width, drumHoverCanvas.height);
    if (isRightClickActive) {
        const drumTrack = ['H', 'M', 'L'][rowIndex];
        store.eraseDrumNoteAt(colIndex, drumTrack);
        drawDrumHoverHighlight(colIndex, rowIndex, 'rgba(255, 0, 0, 0.3)');
    } else {
        drawDrumHoverHighlight(colIndex, rowIndex, 'rgba(255, 255, 0, 0.3)');
        drawGhostDrumNote(colIndex, rowIndex);
    }
}

function handleDrumGridMouseLeave() {
    if (drumHoverCtx) {
        drumHoverCtx.clearRect(0, 0, drumHoverCanvas.width, drumHoverCanvas.height);
    }
}

function handleDrumGridMouseDown(e) {
    e.preventDefault();
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const colIndex = getColumnIndex(x);
    if (colIndex < 2 || colIndex >= store.state.columnWidths.length - 2) return;
    const drumRow = getDrumRowIndex(y);
    if (drumRow < 0 || drumRow > 2) return;
    const drumTrack = ['H', 'M', 'L'][drumRow];
    if (e.button === 2) {
        isRightClickActive = true;
        store.eraseDrumNoteAt(colIndex, drumTrack);
        drumHoverCtx.clearRect(0, 0, drumHoverCanvas.width, drumHoverCanvas.height);
        drawDrumHoverHighlight(colIndex, drumRow, 'rgba(255, 0, 0, 0.3)');
        return;
    }
    const drumHit = { isDrum: true, drumTrack: drumTrack, startColumnIndex: colIndex, endColumnIndex: colIndex, color: '#000', shape: drumTrack === 'H' ? 'triangle' : drumTrack === 'M' ? 'square' : 'pentagon' };
    store.toggleDrumNote(drumHit);
    if (window.transportService && window.transportService.drumPlayers) {
        window.transportService.drumPlayers.player(drumTrack).start();
    }
}

export function initGridEvents() {
    const pitchCanvas = document.getElementById('notation-grid');
    const drumCanvas = document.getElementById('drum-grid');
    pitchHoverCanvas = document.getElementById('hover-canvas');
    drumHoverCanvas = document.getElementById('drum-hover-canvas');
    if (!pitchHoverCanvas || !drumHoverCanvas) {
        console.error("A required hover canvas was not found!");
        return;
    }
    pitchHoverCtx = pitchHoverCanvas.getContext('2d');
    drumHoverCtx = drumHoverCanvas.getContext('2d');
    console.log("GridEvents: All hover canvas contexts initialized.");
    pitchCanvas.addEventListener('mousedown', handlePitchGridMouseDown);
    pitchCanvas.addEventListener('mousemove', handlePitchGridMouseMove);
    pitchCanvas.addEventListener('mouseleave', handlePitchGridMouseLeave);
    pitchCanvas.addEventListener('contextmenu', e => e.preventDefault());
    drumCanvas.addEventListener('mousedown', handleDrumGridMouseDown);
    drumCanvas.addEventListener('mousemove', handleDrumGridMouseMove);
    drumCanvas.addEventListener('mouseleave', handleDrumGridMouseLeave);
    drumCanvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('mouseup', () => {
        if (isDragging) {
            console.log("[DRAG] Mouse up after drag. Recording history state.");
            store.recordState();
        }
        isDragging = false;
        currentDraggedNote = null;
        if (isRightClickActive && previousTool) {
            console.log('[ERASER] Restoring previous tool:', previousTool);
            store.setSelectedTool(previousTool.type, previousTool.color, previousTool.tonicNumber);
            previousTool = null;
        }
        isRightClickActive = false;
        handlePitchGridMouseLeave();
        handleDrumGridMouseLeave();
    });
    console.log("GridEvents: All canvas event listeners attached.");
}