// js/components/Grid/interactors/pitchGridInteractor.js
import store from '../../../state/index.js';
import { getPlacedTonicSigns } from '../../../state/selectors.js';
import SynthEngine from '../../../services/synthEngine.js';
import GridCoordsService from '../../../services/gridCoordsService.js';
import LayoutService from '../../../services/layoutService.js';
import { drawSingleColumnOvalNote, drawTwoColumnOvalNote, drawTonicShape } from '../renderers/notes.js';
import GlobalService from '../../../services/globalService.js';

// --- Interaction State ---
let pitchHoverCtx;
let isDragging = false;
let activeNote = null;
let isRightClickActive = false;
let previousTool = null;
let lastHoveredTonicPoint = null;
let lastHoveredOctaveRows = [];
let rightClickActionTaken = false; 

// --- Interaction Helpers ---
function getPitchForRow(rowIndex) {
    const rowData = store.state.fullRowData[rowIndex];
    return rowData ? rowData.toneNote : null;
}

/**
 * **NEW HELPER FUNCTION**
 * Calculates the column index for a given tonic sign boundary. This is crucial for drawing
 * the hover highlight in the correct snapped position.
 * @param {number} preMacrobeatIndex - The boundary index to find the column for.
 * @returns {number} The starting column index for drawing.
 */
function getDrawColumnForBoundary(preMacrobeatIndex) {
    let columnCursor = 2; // Start after left legend
    const { macrobeatGroupings } = store.state;
    const placedTonicSigns = getPlacedTonicSigns(store.state);

    // Sort existing tonics by their musical position to ensure correct calculation
    const sortedTonicIndices = [...new Set(placedTonicSigns.map(ts => ts.preMacrobeatIndex))].sort((a,b) => a - b);
    
    // Add columns for all macrobeats that come before the target boundary
    for (let i = 0; i < preMacrobeatIndex + 1 && i < macrobeatGroupings.length; i++) {
        columnCursor += macrobeatGroupings[i];
    }
    
    // Add columns for all tonic signs that are placed before the target boundary
    sortedTonicIndices.forEach(tonicIndex => {
        if (tonicIndex < preMacrobeatIndex) {
            columnCursor += 2;
        }
    });

    return columnCursor;
}


/**
 * **THE CORE NEW LOGIC**
 * Finds the macrobeat the user is hovering over, then finds the beginning of the measure
 * containing that macrobeat, and returns the boundary information for that start point.
 * @param {number} columnIndex - The current mouse hover column.
 * @returns {object|null} An object with { drawColumn, preMacrobeatIndex } for the snapped position, or null.
 */
function findMeasureSnapPoint(columnIndex) {
    const { macrobeatGroupings, columnWidths, macrobeatBoundaryStyles } = store.state;
    const placedTonicSigns = getPlacedTonicSigns(store.state);

    if (columnIndex < 2 || columnIndex >= columnWidths.length - 2) return null;

    // --- Step 1: Find which macrobeat the user is currently hovering over ---
    let currentCol = 2;
    let hoveredMbIndex = -1;

    for (let i = 0; i < macrobeatGroupings.length; i++) {
        // Account for any tonic signs that shift the grid
        while(placedTonicSigns.some(ts => ts.columnIndex === currentCol)) {
            currentCol++;
        }
        const macrobeatStart = currentCol;
        const groupSize = macrobeatGroupings[i];
        const macrobeatEnd = macrobeatStart + groupSize - 1;

        if (columnIndex >= macrobeatStart && columnIndex <= macrobeatEnd) {
            hoveredMbIndex = i;
            break;
        }
        currentCol = macrobeatEnd + 1;
    }

    if (hoveredMbIndex === -1) {
        console.log("[Tonic Snap] Hover is not over a valid macrobeat.");
        return null;
    }
    console.log(`[Tonic Snap] Hover detected over macrobeat index: ${hoveredMbIndex}`);

    // --- Step 2: Find the start of the measure containing that macrobeat ---
    let measureStartIndex = 0;
    // Look backwards from the beat *before* the one we're hovering over.
    for (let i = hoveredMbIndex - 1; i >= 0; i--) {
        if (macrobeatBoundaryStyles[i] === 'solid') {
            // We found the bar line. The measure starts at the beat *after* it.
            measureStartIndex = i + 1;
            break;
        }
    }
    console.log(`[Tonic Snap] The containing measure starts at macrobeat index: ${measureStartIndex}`);

    // --- Step 3: The target placement is the boundary BEFORE the start of the measure ---
    const targetPreMacrobeatIndex = measureStartIndex - 1;
    const drawColumn = getDrawColumnForBoundary(targetPreMacrobeatIndex);

    console.log(`[Tonic Snap] Snapping to preMacrobeatIndex: ${targetPreMacrobeatIndex} at draw column: ${drawColumn}`);
    return { drawColumn, preMacrobeatIndex: targetPreMacrobeatIndex };
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

    const ghostOptions = { ...store.state };
    pitchHoverCtx.globalAlpha = isFaint ? 0.2 : 0.4;
    
    if (type === 'tonicization') {
        const ghostTonic = { row: rowIndex, columnIndex: colIndex, tonicNumber: tonicNumber };
        drawTonicShape(pitchHoverCtx, ghostOptions, ghostTonic);
    } else if (type !== 'eraser') { 
        const ghostNote = { row: rowIndex, startColumnIndex: colIndex, endColumnIndex: colIndex, color: color, shape: type, isDrum: false };
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
    if (colIndex < 2 || colIndex >= store.state.columnWidths.length - 2 || !getPitchForRow(rowIndex)) return;

    if (e.button === 2) { // Right-click
        e.preventDefault();
        isRightClickActive = true;
        rightClickActionTaken = false; 

        if (store.state.selectedTool.type !== 'eraser') {
            previousTool = { ...store.state.selectedTool };
            store.setSelectedTool('eraser');
        }
        document.getElementById('eraser-tool-button')?.classList.add('erasing-active');
        
        const clickedTonic = getPlacedTonicSigns(store.state).find(ts => ts.columnIndex === colIndex && ts.row === rowIndex);
        let wasErased = false;
        if (clickedTonic) {
            wasErased = store.eraseTonicSignGroup(clickedTonic.uuid, false);
        } else {
            wasErased = store.eraseNoteAt(colIndex, rowIndex, false);
        }
        if (wasErased) rightClickActionTaken = true;

        pitchHoverCtx.clearRect(0, 0, pitchHoverCtx.canvas.width, pitchHoverCtx.canvas.height);
        drawHoverHighlight(colIndex, rowIndex, 'rgba(220, 53, 69, 0.3)');
        return;
    }

    if (e.button === 0) { // Left-click
        const { type, color, tonicNumber } = store.state.selectedTool;
        
        if (type === 'tonicization') {
            // Use the snapped position stored during the mouse move event
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
             const clickedTonic = getPlacedTonicSigns(store.state).find(ts => ts.columnIndex === colIndex && ts.row === rowIndex);
            if (clickedTonic) {
                store.eraseTonicSignGroup(clickedTonic.uuid);
            } else {
                store.eraseNoteAt(colIndex, rowIndex);
            }
            return;
        }
        
        const newNote = { row: rowIndex, startColumnIndex: colIndex, endColumnIndex: colIndex, color: color, shape: type, isDrum: false };
        const addedNote = store.addNote(newNote); 
        
        activeNote = addedNote;
        isDragging = (type === 'circle');

        const pitch = getPitchForRow(rowIndex);
        if (pitch) {
            SynthEngine.triggerAttack(pitch, activeNote.color);
            const pitchColor = store.state.fullRowData[rowIndex]?.hex || '#888888';
            GlobalService.adsrComponent?.playheadManager.trigger(activeNote.uuid, 'attack', pitchColor, store.state.timbres[activeNote.color].adsr);
        }
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
        const clickedTonic = getPlacedTonicSigns(store.state).find(ts => ts.columnIndex === colIndex && ts.row === rowIndex);
        let wasErased = false;
        if (clickedTonic) {
            wasErased = store.eraseTonicSignGroup(clickedTonic.uuid, false);
        } else {
            wasErased = store.eraseNoteAt(colIndex, rowIndex, false);
        }
        if (wasErased) rightClickActionTaken = true;

        drawHoverHighlight(colIndex, rowIndex, 'rgba(220, 53, 69, 0.3)');
        return;
    } 
    
    if (isDragging && activeNote) {
        const startIndex = activeNote.startColumnIndex;
        const newEndIndex = (colIndex >= startIndex + 2) ? colIndex : startIndex;
        if (newEndIndex !== activeNote.endColumnIndex) {
            store.updateNoteTail(activeNote, newEndIndex);
        }
        return;
    }

    if (store.state.selectedTool.type === 'tonicization') {
        // **MODIFIED: Use the new snapping logic**
        const snappedPoint = findMeasureSnapPoint(colIndex);
        
        if (snappedPoint) {
            const { drawColumn, preMacrobeatIndex } = snappedPoint;
            drawHoverHighlight(drawColumn, rowIndex, 'rgba(74, 144, 226, 0.2)', 2);
            drawGhostNote(drawColumn, rowIndex);

            // Store the snapped position for use on click
            lastHoveredTonicPoint = { preMacrobeatIndex: preMacrobeatIndex };
            
            // Highlight octave duplicates based on the main hovered row
            const hoveredPitchName = store.state.fullRowData[rowIndex]?.pitch.replace(/\d/g, '').trim();
            lastHoveredOctaveRows = [rowIndex];
            store.state.fullRowData.forEach((row, idx) => {
                if (idx !== rowIndex && row.pitch.replace(/\d/g, '').trim() === hoveredPitchName) {
                    drawGhostNote(drawColumn, idx, true);
                    lastHoveredOctaveRows.push(idx);
                }
            });
        } else {
            lastHoveredTonicPoint = null;
            lastHoveredOctaveRows = [];
        }

    } else { 
        lastHoveredTonicPoint = null;
        lastHoveredOctaveRows = [];
        const highlightColor = store.state.selectedTool.type === 'eraser' ? 'rgba(220, 53, 69, 0.3)' : 'rgba(74, 144, 226, 0.2)';
        drawHoverHighlight(colIndex, rowIndex, highlightColor);
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
    if (activeNote) {
        const pitch = getPitchForRow(activeNote.row);
        if (pitch) {
            SynthEngine.triggerRelease(pitch, activeNote.color);
            const pitchColor = store.state.fullRowData[activeNote.row]?.hex || '#888888';
            GlobalService.adsrComponent?.playheadManager.trigger(activeNote.uuid, 'release', pitchColor, store.state.timbres[activeNote.color].adsr);
        }
    }

    if (isDragging) {
        store.recordState();
    }
    
    isDragging = false;
    activeNote = null;
    lastHoveredTonicPoint = null;
    lastHoveredOctaveRows = [];

    if (isRightClickActive) {
        if (rightClickActionTaken) {
            store.recordState();
        }
        isRightClickActive = false;
        rightClickActionTaken = false;
        if (previousTool) {
            store.setSelectedTool(previousTool.type, previousTool.color, previousTool.tonicNumber);
            previousTool = null;
        }
        document.getElementById('eraser-tool-button')?.classList.remove('erasing-active');
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