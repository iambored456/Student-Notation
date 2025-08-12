// js/components/Canvas/PitchGrid/interactors/pitchGridInteractor.js
import store from '../../../../state/index.js';
import { getPlacedTonicSigns, getMacrobeatInfo } from '../../../../state/selectors.js';
import SynthEngine from '../../../../services/synthEngine.js';
import GridCoordsService from '../../../../services/gridCoordsService.js';
import LayoutService from '../../../../services/layoutService.js';
import { drawSingleColumnOvalNote, drawTwoColumnOvalNote, drawTonicShape } from '../renderers/notes.js';
import { getRowY } from '../renderers/rendererUtils.js';
import GlobalService from '../../../../services/globalService.js';
import domCache from '../../../../services/domCache.js';
import { Note } from 'tonal';
import { isNotePlayableAtColumn, isWithinTonicSpan } from '../../../../utils/tonicColumnUtils.js';

// --- Interaction State ---
let pitchHoverCtx;
let isDragging = false;
let activeNote = null;
let activePreviewPitches = []; // NEW: To hold all pitches for audio preview
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

// --- Chord Calculation Logic (with Enharmonic Correction) ---
function getChordNotesFromIntervals(rootNote) {
    const { activeChordIntervals } = store.state;
    if (!rootNote || !activeChordIntervals || activeChordIntervals.length === 0) return [];
    
    return activeChordIntervals.map(interval => {
        const transposedNote = Note.transpose(rootNote, interval);
        const simplifiedNote = Note.simplify(transposedNote);

        if (simplifiedNote.includes('#')) {
            const flatEquivalent = Note.enharmonic(simplifiedNote);
            if (flatEquivalent.includes('b')) {
                return flatEquivalent;
            }
        }
        return simplifiedNote;
    });
}

// --- Hover Drawing Logic ---
function drawHoverHighlight(colIndex, rowIndex, color) {
    if (!pitchHoverCtx) return;

    const x = LayoutService.getColumnX(colIndex);
    const centerY = getRowY(rowIndex, store.state);
    const y = centerY - (store.state.cellHeight / 2);

    const toolType = store.state.selectedTool;
    let highlightWidth = store.state.columnWidths[colIndex] * store.state.cellWidth;
    
    if (toolType === 'eraser' || isRightClickActive) {
        highlightWidth = store.state.cellWidth * 2;
    } else if (toolType === 'note' && store.state.selectedNote.shape === 'circle') {
        highlightWidth = store.state.cellWidth * 2;
    } else if (toolType === 'tonicization') {
        highlightWidth = store.state.cellWidth * 2;
    }
    pitchHoverCtx.fillStyle = color;
    pitchHoverCtx.fillRect(x, y, highlightWidth, store.state.cellHeight);
}

function drawGhostNote(colIndex, rowIndex, isFaint = false) {
    if (!pitchHoverCtx || !store.state.selectedNote) return;
    const toolType = store.state.selectedTool;
    const { shape, color } = store.state.selectedNote;
    
    pitchHoverCtx.globalAlpha = isFaint ? 0.2 : 0.4;
    
    if (toolType === 'tonicization') {
        const ghostTonic = { row: rowIndex, columnIndex: colIndex, tonicNumber: store.state.selectedToolTonicNumber };
        drawTonicShape(pitchHoverCtx, store.state, ghostTonic);
    } else if (toolType === 'note') { 
        const ghostNote = { row: rowIndex, startColumnIndex: colIndex, endColumnIndex: colIndex, color, shape, isDrum: false };
        if (shape === 'oval') {
            drawSingleColumnOvalNote(pitchHoverCtx, store.state, ghostNote, rowIndex);
        } else {
            drawTwoColumnOvalNote(pitchHoverCtx, store.state, ghostNote, rowIndex);
        }
    }
    pitchHoverCtx.globalAlpha = 1.0;
}

// --- Event Handlers ---
function handleMouseDown(e) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const scrollLeft = document.getElementById('canvas-container').scrollLeft;
    const colIndex = GridCoordsService.getColumnIndex(x + scrollLeft);
    const rowIndex = GridCoordsService.getPitchRowIndex(y);
    
    if (colIndex < 2 || colIndex >= store.state.columnWidths.length - 2 || !getPitchForRow(rowIndex)) return;

    if (e.button === 2) {
        e.preventDefault();
        isRightClickActive = true; 
        rightClickActionTaken = false; 
        if (store.state.selectedTool !== 'eraser') {
            previousTool = store.state.selectedTool;
            store.setSelectedTool('eraser');
        }
        domCache.get('eraserButton')?.classList.add('erasing-active');
        
        if (store.eraseInPitchArea(colIndex, rowIndex, 2, false)) rightClickActionTaken = true;
        if (store.eraseTonicSignAt(colIndex, false)) rightClickActionTaken = true;
        
        pitchHoverCtx.clearRect(0, 0, pitchHoverCtx.canvas.width, pitchHoverCtx.canvas.height);
        drawHoverHighlight(colIndex, rowIndex, 'rgba(220, 53, 69, 0.3)');
        return;
    }

    if (e.button === 0) {
        const toolType = store.state.selectedTool;

        if (toolType === 'chord') {
            if (!isNotePlayableAtColumn(colIndex, store.state)) {
                return;
            }
            
            const rootNote = getPitchForRow(rowIndex);
            if (!rootNote) return;
            const chordNotes = getChordNotesFromIntervals(rootNote);
            const { shape, color } = store.state.selectedNote;

            // NEW: Trigger audio preview for all notes in the chord
            activePreviewPitches = [...chordNotes];
            activePreviewPitches.forEach(pitch => {
                SynthEngine.triggerAttack(pitch, color);
            });
            
            // Trigger ADSR visual for the root note
            const pitchColor = store.state.fullRowData[rowIndex]?.hex || '#888888';
            GlobalService.adsrComponent?.playheadManager.trigger('chord_preview', 'attack', pitchColor, store.state.timbres[color].adsr);

            // Placement logic remains the same (places on click)
            chordNotes.forEach(noteName => {
                const noteRow = store.state.fullRowData.findIndex(r => r.toneNote === noteName);
                if (noteRow !== -1) {
                    const newNote = { row: noteRow, startColumnIndex: colIndex, endColumnIndex: colIndex, color, shape, isDrum: false };
                    store.addNote(newNote);
                }
            });
            store.recordState();
            return;
        }
        
        if (toolType === 'tonicization') {
            if (lastHoveredTonicPoint && lastHoveredOctaveRows.length > 0) {
                const newTonicGroup = lastHoveredOctaveRows.map(rowIdx => ({ 
                    row: rowIdx, 
                    tonicNumber: store.state.selectedToolTonicNumber, 
                    preMacrobeatIndex: lastHoveredTonicPoint.preMacrobeatIndex,
                    columnIndex: lastHoveredTonicPoint.drawColumn
                }));
                store.addTonicSignGroup(newTonicGroup);
                lastHoveredTonicPoint = null; 
                lastHoveredOctaveRows = [];
            }
            return;
        }

        if (toolType === 'eraser') {
            store.eraseInPitchArea(colIndex, rowIndex, 2, true);
            return;
        }
        
        if (toolType === 'note') {
            if (!isNotePlayableAtColumn(colIndex, store.state)) {
                return;
            }
            
            const { shape, color } = store.state.selectedNote;
            const newNote = { row: rowIndex, startColumnIndex: colIndex, endColumnIndex: colIndex, color, shape, isDrum: false };
            const addedNote = store.addNote(newNote); 
            activeNote = addedNote;
            
            isDragging = (shape === 'circle');

            if (!isDragging) {
                store.recordState();
            }

            const pitch = getPitchForRow(rowIndex);
            if (pitch) {
                // MODIFIED: Store the pitch for unified release on mouseup
                activePreviewPitches = [pitch]; 
                SynthEngine.triggerAttack(pitch, activeNote.color);
                const pitchColor = store.state.fullRowData[rowIndex]?.hex || '#888888';
                GlobalService.adsrComponent?.playheadManager.trigger(activeNote.uuid, 'attack', pitchColor, store.state.timbres[activeNote.color].adsr);
            }
        }
    }
}

function handleMouseMove(e) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const scrollLeft = document.getElementById('canvas-container').scrollLeft;
    const colIndex = GridCoordsService.getColumnIndex(x + scrollLeft);
    const rowIndex = GridCoordsService.getPitchRowIndex(y);

    if (!pitchHoverCtx) return;
    pitchHoverCtx.clearRect(0, 0, pitchHoverCtx.canvas.width, pitchHoverCtx.canvas.height);

    if (colIndex < 2 || colIndex >= store.state.columnWidths.length - 2 || getPitchForRow(rowIndex) === null) {
        lastHoveredTonicPoint = null;
        lastHoveredOctaveRows = [];
        return;
    }
    
    if (store.state.selectedTool === 'chord') {
        const ghostRootNote = getPitchForRow(rowIndex);
        if (ghostRootNote) {
            const finalNotes = getChordNotesFromIntervals(ghostRootNote);
            const { shape, color } = store.state.selectedNote;
            
            pitchHoverCtx.globalAlpha = 0.4;
            finalNotes.forEach(noteName => {
                const noteRowIndex = store.state.fullRowData.findIndex(r => r.toneNote === noteName);
                if (noteRowIndex > -1) {
                    const ghostNote = { row: noteRowIndex, startColumnIndex: colIndex, endColumnIndex: colIndex, color, shape, isDrum: false };
                    if (shape === 'oval') {
                        drawSingleColumnOvalNote(pitchHoverCtx, store.state, ghostNote, noteRowIndex);
                    } else {
                        drawTwoColumnOvalNote(pitchHoverCtx, store.state, ghostNote, noteRowIndex);
                    }
                }
            });
            pitchHoverCtx.globalAlpha = 1.0;
        }
        return;
    }
    
    if (isRightClickActive) {
        if (store.eraseInPitchArea(colIndex, rowIndex, 2, false)) rightClickActionTaken = true;
        if (store.eraseTonicSignAt(colIndex, false)) rightClickActionTaken = true;
        drawHoverHighlight(colIndex, rowIndex, 'rgba(220, 53, 69, 0.3)');
        return;
    } 
    
    if (isDragging && activeNote) {
        const startIndex = activeNote.startColumnIndex;
        const newEndIndex = colIndex;
        if (newEndIndex !== activeNote.endColumnIndex) {
            store.updateNoteTail(activeNote, newEndIndex);
        }
        return;
    }

    if (store.state.selectedTool === 'tonicization') {
        const snapPoint = findMeasureSnapPoint(colIndex);
        if (snapPoint) {
            const basePitch = getPitchForRow(rowIndex);
            if (basePitch) {
                const octaveRows = store.state.fullRowData
                    .map((rowData, index) => ({ ...rowData, index }))
                    .filter(rowData => rowData.toneNote && rowData.toneNote.replace(/\d+$/, '') === basePitch.replace(/\d+$/, ''))
                    .map(rowData => rowData.index);

                lastHoveredTonicPoint = snapPoint;
                lastHoveredOctaveRows = octaveRows;

                pitchHoverCtx.globalAlpha = 0.5;
                octaveRows.forEach(rowIdx => {
                    const ghostTonic = { row: rowIdx, columnIndex: snapPoint.drawColumn, tonicNumber: store.state.selectedToolTonicNumber };
                    drawTonicShape(pitchHoverCtx, store.state, ghostTonic);
                });
                pitchHoverCtx.globalAlpha = 1.0;
            }
        } else {
            lastHoveredTonicPoint = null;
            lastHoveredOctaveRows = [];
        }
    } else { 
        const canPlaceNote = (store.state.selectedTool === 'note' || store.state.selectedTool === 'chord') 
            ? isNotePlayableAtColumn(colIndex, store.state) 
            : true;
        
        const highlightColor = store.state.selectedTool === 'eraser' 
            ? 'rgba(220, 53, 69, 0.3)' 
            : canPlaceNote 
                ? 'rgba(74, 144, 226, 0.2)'
                : 'rgba(220, 53, 69, 0.15)';
                
        const highlightStartCol = colIndex;
        drawHoverHighlight(highlightStartCol, rowIndex, highlightColor);
        
        if (canPlaceNote) {
            drawGhostNote(colIndex, rowIndex);
        }
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
    // MODIFIED: Release any pitches that were triggered for preview
    if (activePreviewPitches.length > 0) {
        const color = store.state.selectedNote.color;
        activePreviewPitches.forEach(pitch => {
            SynthEngine.triggerRelease(pitch, color);
        });

        // Determine which ADSR visual to release
        const wasSingleNote = !!activeNote;
        if (wasSingleNote) {
            const pitchColor = store.state.fullRowData[activeNote.row]?.hex || '#888888';
            GlobalService.adsrComponent?.playheadManager.trigger(activeNote.uuid, 'release', pitchColor, store.state.timbres[color].adsr);
        } else { // It was a chord preview
            const rootPitch = activePreviewPitches[0];
            const rootRow = store.state.fullRowData.find(row => row.toneNote === rootPitch);
            if (rootRow) {
                const pitchColor = rootRow.hex;
                GlobalService.adsrComponent?.playheadManager.trigger('chord_preview', 'release', pitchColor, store.state.timbres[color].adsr);
            }
        }
        activePreviewPitches = [];
    }

    if (isDragging) {
        store.recordState();
    }
    isDragging = false;
    activeNote = null;

    if (isRightClickActive) {
        if (rightClickActionTaken) store.recordState();
        isRightClickActive = false;
        rightClickActionTaken = false;
        if (previousTool) {
            store.setSelectedTool(previousTool);
            previousTool = null;
        }
        domCache.get('eraserButton')?.classList.remove('erasing-active');
    }
    handleMouseLeave();
}

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