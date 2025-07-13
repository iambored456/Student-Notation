// js/components/Grid/interactors/pitchGridInteractor.js
import store from '../../../state/index.js';
import { getPlacedTonicSigns, getMacrobeatInfo } from '../../../state/selectors.js';
import SynthEngine from '../../../services/synthEngine.js';
import GridCoordsService from '../../../services/gridCoordsService.js';
import LayoutService from '../../../services/layoutService.js';
import { drawSingleColumnOvalNote, drawTwoColumnOvalNote, drawTonicShape } from '../renderers/notes.js';
import GlobalService from '../../../services/globalService.js';
import { Note } from 'tonal';
import { buildNotes } from '../../../harmony/utils/build-notes.js';


// --- Interaction State ---
let pitchHoverCtx;
let isDragging = false;
let activeNote = null;
let isRightClickActive = false;
let previousTool = null;
let lastHoveredTonicPoint = null;
let lastHoveredOctaveRows = [];
let rightClickActionTaken = false; 
let isDraggingChord = false;
let tempChordShape = null;

// --- Interaction Helpers ---
function getPitchForRow(rowIndex) {
    const rowData = store.state.fullRowData[rowIndex];
    return rowData ? rowData.toneNote : null;
}

function findChordAt(colIndex, rowIndex) {
    const clickedNoteName = getPitchForRow(rowIndex);
    if (!clickedNoteName) return null;

    for (const chord of store.state.placedChords) {
        if (chord.position.xBeat === colIndex && chord.notes.includes(clickedNoteName)) {
            return chord;
        }
    }
    return null;
}

function findMeasureSnapPoint(columnIndex) {
    const { macrobeatGroupings, columnWidths, macrobeatBoundaryStyles } = store.state;

    if (columnIndex < 2 || columnIndex >= columnWidths.length - 2) return null;

    let hoveredMbIndex = -1;
    for (let i = 0; i < macrobeatGroupings.length; i++) {
        const { startColumn, endColumn } = getMacrobeatInfo(store.state, i);
        if (columnIndex >= startColumn && columnIndex <= endColumn) {
            hoveredMbIndex = i;
            break;
        }
    }

    if (hoveredMbIndex === -1) return null;

    let measureStartIndex = 0;
    for (let i = hoveredMbIndex - 1; i >= 0; i--) {
        if (macrobeatBoundaryStyles[i] === 'solid') {
            measureStartIndex = i + 1;
            break;
        }
    }

    const targetPreMacrobeatIndex = measureStartIndex - 1;
    const drawColumn = getMacrobeatInfo(store.state, measureStartIndex).startColumn;

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
        // UPDATED: Standardize eraser highlight width to 2 columns
        if (selectedToolType === 'eraser' || isRightClickActive) {
            highlightWidth = store.state.cellWidth * 2; 
        } else if (selectedToolType === 'circle' || selectedToolType === 'tonicization') {
            highlightWidth = store.state.cellWidth * 2;
        } else {
            highlightWidth = store.state.columnWidths[colIndex] * store.state.cellWidth;
        }
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
    } else if (type !== 'eraser' && type !== 'chord') { 
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

    const clickedChord = findChordAt(colIndex, rowIndex);
    if (clickedChord) {
        store.setActiveChord(clickedChord.id);
        return;
    }

    if (store.state.activeChordId) {
        store.setActiveChord(null);
    }

    if (e.button === 2) { // Right-click
        e.preventDefault();
        isRightClickActive = true;
        rightClickActionTaken = false; 

        if (store.state.selectedTool.type !== 'eraser') {
            previousTool = { ...store.state.selectedTool };
            store.setSelectedTool('eraser');
        }
        document.getElementById('eraser-tool-button')?.classList.add('erasing-active');
        
        // ** THE FIX **: Erase starting from one column to the left of the cursor
        if (store.eraseInPitchArea(colIndex - 1, rowIndex, 2, false)) {
            rightClickActionTaken = true;
        }

        pitchHoverCtx.clearRect(0, 0, pitchHoverCtx.canvas.width, pitchHoverCtx.canvas.height);
        // ** THE FIX **: Draw the hover highlight one column to the left
        drawHoverHighlight(colIndex - 1, rowIndex, 'rgba(220, 53, 69, 0.3)');
        return;
    }

    if (e.button === 0) { // Left-click
        const { type, color, tonicNumber } = store.state.selectedTool;

        if (type === 'chord') {
            isDraggingChord = true;
            tempChordShape = {
                id: 'temp-chord-drag',
                root: 'X', quality: 'maj', inversion: 0, extension: '', notes: [],
                position: { xBeat: colIndex, yStaff: rowIndex }
            };
            handleMouseMove(e);
            return;
        }
        
        if (type === 'tonicization') {
            if (lastHoveredTonicPoint && lastHoveredOctaveRows.length > 0) {
                const newTonicGroup = lastHoveredOctaveRows.map(rowIdx => ({
                    row: rowIdx, tonicNumber, preMacrobeatIndex: lastHoveredTonicPoint.preMacrobeatIndex
                }));
                store.addTonicSignGroup(newTonicGroup);
                lastHoveredTonicPoint = null;
                lastHoveredOctaveRows = [];
            }
            return;
        }

        if (type === 'eraser') {
            // ** THE FIX **: Erase starting from one column to the left of the cursor
            store.eraseInPitchArea(colIndex - 1, rowIndex, 2, true);
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
    
    if (isDraggingChord && tempChordShape) {
        const rootWithOctave = getPitchForRow(rowIndex);
        if (!rootWithOctave) {
            pitchHoverCtx.clearRect(0, 0, pitchHoverCtx.canvas.width, pitchHoverCtx.canvas.height);
            return;
        }
        
        tempChordShape.root = rootWithOctave;
        tempChordShape.position = { xBeat: colIndex, yStaff: rowIndex };
    
        const notes = buildNotes(tempChordShape, store.state.keySignature);
    
        pitchHoverCtx.globalAlpha = 0.4;
        const ghostNoteOptions = { ...store.state, degreeDisplayMode: 'off' };
        
        notes.forEach(noteName => {
            const noteRowIndex = store.state.fullRowData.findIndex(r => r.toneNote === noteName);
            if (noteRowIndex > -1) {
                const ghostNote = {
                    row: noteRowIndex, startColumnIndex: colIndex, endColumnIndex: colIndex,
                    color: '#2d2d2d', shape: 'oval', isDrum: false
                };
                drawSingleColumnOvalNote(pitchHoverCtx, ghostNoteOptions, ghostNote, noteRowIndex);
            }
        });
    
        pitchHoverCtx.globalAlpha = 1.0;
        return;
    }

    if (isRightClickActive) {
        // ** THE FIX **: Erase starting from one column to the left of the cursor
        if (store.eraseInPitchArea(colIndex - 1, rowIndex, 2, false)) {
            rightClickActionTaken = true;
        }
        // ** THE FIX **: Draw the hover highlight one column to the left
        drawHoverHighlight(colIndex - 1, rowIndex, 'rgba(220, 53, 69, 0.3)');
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
        const snappedPoint = findMeasureSnapPoint(colIndex);
        
        if (snappedPoint) {
            const { drawColumn, preMacrobeatIndex } = snappedPoint;
            drawHoverHighlight(drawColumn, rowIndex, 'rgba(74, 144, 226, 0.2)');
            drawGhostNote(drawColumn, rowIndex);

            lastHoveredTonicPoint = { preMacrobeatIndex };
            
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
        
        // ** THE FIX **: Draw hover highlight starting one column to the left for the eraser tool
        const highlightStartCol = store.state.selectedTool.type === 'eraser' ? colIndex - 1 : colIndex;
        drawHoverHighlight(highlightStartCol, rowIndex, highlightColor);
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
    if (isDraggingChord && tempChordShape) {
        isDraggingChord = false;
        
        const { root, position } = tempChordShape;
        if (root !== 'X' && position.xBeat >= 2) {
            const finalShape = { ...tempChordShape };
            finalShape.notes = buildNotes(finalShape, store.state.keySignature);
            store.addChord(finalShape);
        }
        tempChordShape = null;
        handleMouseLeave();
    }

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