// js/components/Grid/interactors/pitchGridInteractor.js
import store from '../../../state/store.js';
import SynthEngine from '../../../services/synthEngine.js';
import GridCoordsService from '../../../services/gridCoordsService.js';
import LayoutService from '../../../services/layoutService.js';
import { drawSingleColumnOvalNote, drawTwoColumnOvalNote, drawTonicShape } from '../renderers/pitchGridRenderer.js';

// --- Interaction State ---
let pitchHoverCtx;
let isDragging = false;
let currentDraggedNote = null;
let isRightClickActive = false;
let previousTool = null;
let lastHoveredTonicPoint = null;
let lastHoveredOctaveRows = [];

// --- Interaction Helpers ---
function getPitchForRow(rowIndex) {
    const rowData = store.state.fullRowData[rowIndex];
    return rowData ? rowData.toneNote : null;
}

function findHoveredMacrobeat(columnIndex) {
    const { macrobeatGroupings, columnWidths } = store.state;
    const placedTonicSigns = store.placedTonicSigns; // Use getter

    if (columnIndex < 2 || columnIndex >= columnWidths.length - 2) return null;

    let currentCol = 2;
    for (let i = 0; i < macrobeatGroupings.length; i++) {
        while (placedTonicSigns.some(ts => ts.columnIndex === currentCol)) {
            currentCol++;
        }
        const macrobeatStart = currentCol;
        const groupSize = macrobeatGroupings[i];
        const macrobeatEnd = macrobeatStart + groupSize - 1;

        if (columnIndex >= macrobeatStart && columnIndex <= macrobeatEnd) {
            return { drawColumn: macrobeatStart, preMacrobeatIndex: i - 1 };
        }
        currentCol = macrobeatEnd + 1;
    }
    return null;
}


// --- Hover Drawing Logic ---
function drawHoverHighlight(colIndex, rowIndex, color, widthMultiplier = null) {
    if (!pitchHoverCtx) return;
    const x = LayoutService.getColumnX(colIndex);
    const y = rowIndex * 0.5 * store.state.cellHeight - store.state.cellHeight / 2;
    
    let highlightWidth;
    if (widthMultiplier) {
        highlightWidth = store.state.cellWidth * widthMultiplier;
    } else {
        const selectedToolType = store.state.selectedTool.type;
        highlightWidth = (selectedToolType === 'circle' || isRightClickActive)
            ? store.state.cellWidth * 2
            : store.state.columnWidths[colIndex] * store.state.cellWidth;
    }
    
    pitchHoverCtx.fillStyle = color;
    pitchHoverCtx.fillRect(x, y, highlightWidth, store.state.cellHeight);
}

function drawGhostNote(colIndex, rowIndex, isFaint = false) {
    if (!pitchHoverCtx) return;
    const { type, color, tonicNumber } = store.state.selectedTool;

    const ghostOptions = {
        columnWidths: store.state.columnWidths,
        cellWidth: store.state.cellWidth,
        cellHeight: store.state.cellHeight,
    };
    
    pitchHoverCtx.globalAlpha = isFaint ? 0.2 : 0.4;
    
    if (type === 'tonicization') {
        const ghostTonic = { row: rowIndex, columnIndex: colIndex, tonicNumber: tonicNumber };
        drawTonicShape(pitchHoverCtx, ghostOptions, ghostTonic);
    } else {
        const ghostNote = { 
            row: rowIndex, startColumnIndex: colIndex, endColumnIndex: colIndex, 
            color: color, shape: type, isDrum: false 
        };
        if (ghostNote.shape === 'oval') {
            drawSingleColumnOvalNote(pitchHoverCtx, ghostOptions, ghostNote, rowIndex);
        } else {
            drawTwoColumnOvalNote(pitchHoverCtx, ghostOptions, ghostNote, rowIndex);
        }
    }
    pitchHoverCtx.globalAlpha = 1.0;
}


// --- Event Handlers ---
function handleMouseDown(e) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const colIndex = GridCoordsService.getColumnIndex(x);
    const rowIndex = GridCoordsService.getPitchRowIndex(y);
    if (colIndex < 2 || colIndex >= store.state.columnWidths.length - 2) return;

    if (e.button === 2) { // Right-click
        e.preventDefault();
        isRightClickActive = true;

        // Check if deleting a tonic sign
        const clickedTonic = store.placedTonicSigns.find(ts => ts.columnIndex === colIndex && ts.row === rowIndex);
        if (clickedTonic) {
            store.eraseTonicSignGroup(clickedTonic.uuid);
        } else {
            store.eraseNoteAt(colIndex, rowIndex);
        }
        
        if (store.state.selectedTool.type !== 'eraser') {
            previousTool = { ...store.state.selectedTool };
            store.setSelectedTool('eraser');
        }
        pitchHoverCtx.clearRect(0, 0, pitchHoverCtx.canvas.width, pitchHoverCtx.canvas.height);
        drawHoverHighlight(colIndex, rowIndex, 'rgba(220, 53, 69, 0.3)');
        return;
    }

    if (e.button === 0) { // Left-click
        const { type, color, tonicNumber } = store.state.selectedTool;
        
        if (type === 'tonicization') {
            if (lastHoveredTonicPoint && lastHoveredOctaveRows.length > 0) {
                const newTonicGroup = lastHoveredOctaveRows.map(rowIdx => ({
                    row: rowIdx,
                    tonicNumber,
                    preMacrobeatIndex: lastHoveredTonicPoint.preMacrobeatIndex
                }));
                store.addTonicSignGroup(newTonicGroup);
                lastHoveredTonicPoint = null;
                lastHoveredOctaveRows = [];
            }
            return;
        }

        if (type === 'eraser') {
             const clickedTonic = store.placedTonicSigns.find(ts => ts.columnIndex === colIndex && ts.row === rowIndex);
            if (clickedTonic) {
                store.eraseTonicSignGroup(clickedTonic.uuid);
            } else {
                store.eraseNoteAt(colIndex, rowIndex);
            }
            return;
        }
        
        const newNote = { row: rowIndex, startColumnIndex: colIndex, endColumnIndex: colIndex, color: color, shape: type, isDrum: false };
        store.addNote(newNote);
        isDragging = (type === 'circle');
        if(isDragging) { currentDraggedNote = newNote; }
        const pitch = getPitchForRow(rowIndex);
        if (pitch) { SynthEngine.playNote(pitch, '8n'); }
    }
}

function handleMouseMove(e) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const colIndex = GridCoordsService.getColumnIndex(x);
    const rowIndex = GridCoordsService.getPitchRowIndex(y);

    if (!pitchHoverCtx) return;
    pitchHoverCtx.clearRect(0, 0, pitchHoverCtx.canvas.width, pitchHoverCtx.canvas.height);

    if (colIndex < 2 || colIndex >= store.state.columnWidths.length - 2 || getPitchForRow(rowIndex) === null) {
        lastHoveredTonicPoint = null;
        lastHoveredOctaveRows = [];
        return;
    }

    if (isRightClickActive) {
        // Deletion logic is handled in mousedown now, just draw highlight
        drawHoverHighlight(colIndex, rowIndex, 'rgba(220, 53, 69, 0.3)');
        return;
    } 
    
    if (isDragging && currentDraggedNote) {
        const startIndex = currentDraggedNote.startColumnIndex;
        const newEndIndex = (colIndex >= startIndex + 2) ? colIndex : startIndex;
        if (newEndIndex !== currentDraggedNote.endColumnIndex) {
            store.updateNoteTail(currentDraggedNote, newEndIndex);
        }
        return;
    }

    if (store.state.selectedTool.type === 'tonicization') {
        const hoveredMacrobeat = findHoveredMacrobeat(colIndex);
        
        if (hoveredMacrobeat) {
            const drawColumn = hoveredMacrobeat.drawColumn;
            drawHoverHighlight(drawColumn, rowIndex, 'rgba(74, 144, 226, 0.2)', 2);
            drawGhostNote(drawColumn, rowIndex);
            lastHoveredTonicPoint = hoveredMacrobeat;
            
            // Find and draw octave duplicates
            const hoveredPitchName = store.state.fullRowData[rowIndex]?.pitch.replace(/\d/g, '').trim();
            lastHoveredOctaveRows = [rowIndex];
            store.state.fullRowData.forEach((row, idx) => {
                if (idx !== rowIndex && row.pitch.replace(/\d/g, '').trim() === hoveredPitchName) {
                    drawGhostNote(drawColumn, idx, true); // true for fainter
                    lastHoveredOctaveRows.push(idx);
                }
            });
        } else {
            lastHoveredTonicPoint = null;
            lastHoveredOctaveRows = [];
        }

    } else { // Handle note tools
        lastHoveredTonicPoint = null;
        lastHoveredOctaveRows = [];
        drawHoverHighlight(colIndex, rowIndex, 'rgba(74, 144, 226, 0.2)');
        drawGhostNote(colIndex, rowIndex);
    }
}


function handleMouseLeave() {
    if (pitchHoverCtx) {
        pitchHoverCtx.clearRect(0, 0, pitchHoverCtx.canvas.width, pitchHoverCtx.canvas.height);
    }
    lastHoveredTonicPoint = null;
    lastHoveredOctaveRows = [];
}

function handleGlobalMouseUp() {
    if (isDragging) {
        store.recordState();
    }
    isDragging = false;
    currentDraggedNote = null;
    lastHoveredTonicPoint = null;
    lastHoveredOctaveRows = [];

    if (isRightClickActive) {
        isRightClickActive = false;
        if (previousTool) {
            store.setSelectedTool(previousTool.type, previousTool.color, previousTool.tonicNumber);
            previousTool = null;
        }
    }
    handleMouseLeave();
}

// --- Public Interface ---
export function initPitchGridInteraction() {
    const pitchCanvas = document.getElementById('notation-grid');
    const hoverCanvas = document.getElementById('hover-canvas');

    if (!pitchCanvas || !hoverCanvas) {
        console.error("PitchGridInteractor: Could not find required canvas elements.");
        return;
    }
    pitchHoverCtx = hoverCanvas.getContext('2d');

    pitchCanvas.addEventListener('mousedown', handleMouseDown);
    pitchCanvas.addEventListener('mousemove', handleMouseMove);
    pitchCanvas.addEventListener('mouseleave', handleMouseLeave);
    pitchCanvas.addEventListener('contextmenu', e => e.preventDefault());
    
    window.addEventListener('mouseup', handleGlobalMouseUp);

    console.log("PitchGridInteractor: Initialized and event listeners attached.");
}