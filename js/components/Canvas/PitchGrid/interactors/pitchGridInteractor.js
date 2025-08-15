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
import { setGhostNotePosition, clearGhostNotePosition } from '../../../../services/spacebarHandler.js';
import { placeStamp, removeStampsInEraserArea } from '../../../../rhythm/stampPlacements.js';
import StampsToolbar from '../../../StampsToolbar/StampsToolbar.js';
import { renderStampPreview } from '../renderers/stampRenderer.js';

// --- Interaction State ---
let pitchHoverCtx;
let isDragging = false;
let activeNote = null;
let activeChordNotes = []; // NEW: To hold active chord notes during dragging
let activePreviewPitches = []; // NEW: To hold all pitches for audio preview
let isRightClickActive = false;
let isEraserDragActive = false;
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
    } else if (toolType === 'stamp') {
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
        // Create ghost note that snaps to grid positions like normal notes
        const ghostNote = { 
            row: rowIndex, 
            startColumnIndex: colIndex, 
            endColumnIndex: colIndex, 
            color, 
            shape, 
            isDrum: false
        };
        const fullOptions = { ...store.state, zoomLevel: LayoutService.getViewportInfo().zoomLevel };
        if (shape === 'oval') {
            drawSingleColumnOvalNote(pitchHoverCtx, fullOptions, ghostNote, rowIndex);
        } else {
            drawTwoColumnOvalNote(pitchHoverCtx, fullOptions, ghostNote, rowIndex);
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
    
    // Check boundaries - circle notes need more space than other tools
    const isCircleNote = (store.state.selectedTool === 'note' || store.state.selectedTool === 'chord') && store.state.selectedNote.shape === 'circle';
    const maxColumn = isCircleNote ? store.state.columnWidths.length - 3 : store.state.columnWidths.length - 2;
    if (colIndex < 2 || colIndex >= maxColumn || !getPitchForRow(rowIndex)) return;

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
        
        // Also erase stamps with right-click (2×3 area like circle notes)
        const eraseEndCol = colIndex + 2 - 1;
        const eraseStartRow = rowIndex - 1;
        const eraseEndRow = rowIndex + 1;
        console.log('[RIGHT CLICK STAMP ERASE] Attempting to erase stamps in area:', {
            colIndex,
            rowIndex,
            eraseStartCol: colIndex,
            eraseEndCol,
            eraseStartRow,
            eraseEndRow
        });
        if (store.eraseStampsInArea(colIndex, eraseEndCol, eraseStartRow, eraseEndRow)) rightClickActionTaken = true;
        
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

            // Place chord notes and track them for dragging
            activeChordNotes = [];
            console.log('[CHORD DEBUG] Placing chord notes:', chordNotes);
            chordNotes.forEach(noteName => {
                const noteRow = store.state.fullRowData.findIndex(r => r.toneNote === noteName);
                if (noteRow !== -1) {
                    const newNote = { row: noteRow, startColumnIndex: colIndex, endColumnIndex: colIndex, color, shape, isDrum: false };
                    const addedNote = store.addNote(newNote);
                    if (addedNote) {
                        activeChordNotes.push(addedNote);
                        console.log('[CHORD DEBUG] Added chord note:', { noteName, noteRow, addedNote });
                    } else {
                        console.log('[CHORD DEBUG] Skipped duplicate chord note:', { noteName, noteRow, color });
                    }
                }
            });
            
            // Enable dragging for chord shapes
            isDragging = true;
            console.log('[CHORD DEBUG] Enabled dragging, activeChordNotes:', activeChordNotes.length);
            
            // Don't record state immediately - wait for drag to complete
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
            console.log('[ERASER] Using eraser tool at:', {
                mouseX: x,
                mouseY: y,
                colIndex, 
                rowIndex,
                scrollOffset: scrollLeft
            });
            
            isEraserDragActive = true; // Enable drag mode for eraser
            
            store.eraseInPitchArea(colIndex, rowIndex, 2, false); // Don't record state yet (will record on mouse up)
            
            // Also remove stamps that intersect with the eraser area (2×3 area like circle notes)
            const eraseEndCol = colIndex + 2 - 1; // Eraser spans 2 columns
            const eraseStartRow = rowIndex - 1; // Eraser starts 1 row above
            const eraseEndRow = rowIndex + 1; // Eraser covers 3 rows: row-1, row, row+1
            
            console.log('[STAMP ERASE] Eraser area:', { 
                colIndex, 
                rowIndex, 
                eraseStartCol: colIndex, 
                eraseEndCol, 
                eraseStartRow, 
                eraseEndRow 
            });
            
            const removedStamps = removeStampsInEraserArea(colIndex, eraseEndCol, eraseStartRow, eraseEndRow);
            console.log('[STAMP ERASE] Removed stamps:', removedStamps);
            return;
        }
        
        if (toolType === 'stamp') {
            const selectedStamp = StampsToolbar.getSelectedStamp();
            if (selectedStamp) {
                console.log('[STAMP PLACE] Placing stamp:', {
                    stampId: selectedStamp.id,
                    mouseX: x,
                    mouseY: y,
                    colIndex,
                    rowIndex,
                    pitch: getPitchForRow(rowIndex),
                    scrollOffset: scrollLeft
                });
                
                const { color } = store.state.selectedNote;
                placeStamp(selectedStamp.id, colIndex, rowIndex, color);
                
                // Optional: Play preview sound for the stamp
                const pitch = getPitchForRow(rowIndex);
                if (pitch) {
                    // Play a short preview of the stamp pattern
                    SynthEngine.playNote(pitch, '16n'); // Just a quick 16th note preview
                }
                
                store.recordState(); // Save state for undo/redo
            }
            return;
        }
        
        if (toolType === 'note') {
            if (!isNotePlayableAtColumn(colIndex, store.state)) {
                return;
            }
            
            const { shape, color } = store.state.selectedNote;
            const newNote = { row: rowIndex, startColumnIndex: colIndex, endColumnIndex: colIndex, color, shape, isDrum: false };
            const addedNote = store.addNote(newNote); 
            
            if (!addedNote) {
                // Note was not added due to duplicate prevention
                return;
            }
            
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
    
    // Debug log when dragging
    if (isDragging) {
    }

    // Check boundaries for mouse move - circle notes need more space
    const isCircleNote = (store.state.selectedTool === 'note' || store.state.selectedTool === 'chord') && store.state.selectedNote.shape === 'circle';
    const maxColumn = isCircleNote ? store.state.columnWidths.length - 3 : store.state.columnWidths.length - 2;
    if (colIndex < 2 || colIndex >= maxColumn || getPitchForRow(rowIndex) === null) {
        if (isDragging) {
        }
        lastHoveredTonicPoint = null;
        lastHoveredOctaveRows = [];
        clearGhostNotePosition();
        return;
    }
    
    // Update ghost note position for spacebar handler
    setGhostNotePosition(colIndex, rowIndex);
    
    // Handle dragging FIRST, before any tool-specific logic
    if (isDragging && (activeNote || activeChordNotes.length > 0)) {
        const newEndIndex = colIndex;
        
        if (activeNote) {
            // Handle single note dragging
            if (newEndIndex !== activeNote.endColumnIndex) {
                store.updateNoteTail(activeNote, newEndIndex);
            }
        } else if (activeChordNotes.length > 0) {
            // Handle chord notes dragging - check if any notes need updating
            const notesToUpdate = activeChordNotes.filter(note => newEndIndex !== note.endColumnIndex);
            if (notesToUpdate.length > 0) {
                store.updateMultipleNoteTails(notesToUpdate, newEndIndex);
            }
        }
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
                    const fullOptions = { ...store.state, zoomLevel: LayoutService.getViewportInfo().zoomLevel };
                    if (shape === 'oval') {
                        drawSingleColumnOvalNote(pitchHoverCtx, fullOptions, ghostNote, noteRowIndex);
                    } else {
                        drawTwoColumnOvalNote(pitchHoverCtx, fullOptions, ghostNote, noteRowIndex);
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
        
        // Also erase stamps during right-click drag (2×3 area like circle notes)
        const eraseEndCol = colIndex + 2 - 1;
        const eraseStartRow = rowIndex - 1;
        const eraseEndRow = rowIndex + 1;
        if (store.eraseStampsInArea(colIndex, eraseEndCol, eraseStartRow, eraseEndRow)) rightClickActionTaken = true;
        
        drawHoverHighlight(colIndex, rowIndex, 'rgba(220, 53, 69, 0.3)');
        return;
    }

    if (isEraserDragActive) {
        // Eraser drag behavior - erase as we move the mouse
        store.eraseInPitchArea(colIndex, rowIndex, 2, false); // Don't record state yet
        
        // Also erase stamps during eraser drag (2×3 area like circle notes)
        const eraseEndCol = colIndex + 2 - 1;
        const eraseStartRow = rowIndex - 1;
        const eraseEndRow = rowIndex + 1;
        store.eraseStampsInArea(colIndex, eraseEndCol, eraseStartRow, eraseEndRow);
        
        drawHoverHighlight(colIndex, rowIndex, 'rgba(220, 53, 69, 0.3)');
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
        
        if (store.state.selectedTool === 'stamp') {
            // Show stamp preview
            const selectedStamp = StampsToolbar.getSelectedStamp();
            if (selectedStamp) {
                console.log('[STAMP HOVER] Preview at:', {
                    mouseX: x,
                    mouseY: y,
                    colIndex,
                    rowIndex,
                    pitch: getPitchForRow(rowIndex),
                    scrollOffset: scrollLeft
                });
                
                const options = {
                    cellWidth: store.state.cellWidth,
                    cellHeight: store.state.cellHeight,
                    columnWidths: store.state.columnWidths,
                    previewColor: '#4a90e2'
                };
                renderStampPreview(pitchHoverCtx, colIndex, rowIndex, selectedStamp, options);
            }
        } else if (canPlaceNote) {
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
    clearGhostNotePosition();
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
    activeChordNotes = [];

    if (isEraserDragActive) {
        store.recordState(); // Record state after eraser drag operation
        isEraserDragActive = false;
    }

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

}