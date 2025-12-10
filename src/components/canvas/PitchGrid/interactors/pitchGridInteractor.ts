// js/components/Canvas/PitchGrid/interactors/pitchGridInteractor.js
import store from '@state/index.ts';
import { getMacrobeatInfo, getPlacedTonicSigns } from '@state/selectors.ts';
import { fullRowData as masterRowData } from '@state/pitchData.ts';
import { visualToTimeIndex, timeIndexToVisualColumn } from '@services/columnMap.ts';
import SynthEngine from '@services/synthEngine.ts';
import rhythmPlaybackService from '../../../../services/rhythmPlaybackService.ts';
import GridCoordsService from '@services/gridCoordsService.ts';
import LayoutService from '../../../../services/layoutService.ts';
import annotationService from '../../../../services/annotationService.ts';
import { drawSingleColumnOvalNote, drawTwoColumnOvalNote, drawTonicShape } from '../renderers/notes.js';
import { getRowY, getColumnX } from '../renderers/rendererUtils.js';
import GlobalService from '@services/globalService.ts';
import domCache from '@services/domCache.ts';
import { Note } from 'tonal';
import { isNotePlayableAtColumn, isWithinTonicSpan } from '../../../../utils/tonicColumnUtils.ts';
import { setGhostNotePosition, clearGhostNotePosition } from '@services/spacebarHandler.ts';
import { placeStamp, removeStampsInEraserArea } from '../../../../rhythm/stampPlacements.js';
import { placeTripletGroup, eraseTripletGroups } from '../../../../rhythm/tripletPlacements.js';
import { GROUP_WIDTH_CELLS } from '../../../../rhythm/triplets.js';
import { canvasToTime, timeToCanvas } from '../../../../services/columnMapService.ts';
import StampsToolbar from '@components/rhythm/stampsToolbar/stampsToolbar.js';
import TripletsToolbar from '@components/rhythm/stampsToolbar/tripletsToolbar.js';
import { renderStampPreview } from '../renderers/stampRenderer.js';
import { renderTripletPreview } from '../renderers/tripletRenderer.js';
import { hitTestAnyStampShape } from '../../../../utils/stampHitTest.js';
import { hitTestAnyTripletShape } from '../../../../utils/tripletHitTest.js';
// import { hitTestModulationMarker, getModulationMarkerCursor } from '../renderers/modulationRenderer.js'; // Temporarily commented out
import { getModulationDisplayText, getModulationColor, MODULATION_RATIOS } from '../../../../rhythm/modulationMapping.js';
import logger from '@utils/logger.ts';
import { getLogicalCanvasWidth, getLogicalCanvasHeight } from '@utils/canvasDimensions.ts';
import type { CanvasSpaceColumn } from '../../../../../types/state.js';

// --- Interaction State ---
let pitchHoverCtx;
let isDragging = false;
let activeNote = null;
let activeChordNotes = []; // NEW: To hold active chord notes during dragging
let activePreviewPitches = []; // NEW: To hold all pitches for audio preview
const placementFillNoteIds = new Set<string>(); // Track fills started during manual placement
let isRightClickActive = false;
let isEraserDragActive = false;
let previousTool = null;
let lastHoveredTonicPoint = null;
let lastHoveredOctaveRows = [];
let rightClickActionTaken = false;
let lastDragRow = null; // Track last row during drag for pitch change detection

// --- Modulation Marker State ---
let isDraggingModulationMarker = false;
let draggedModulationMarker = null;
let lastModulationHoverResult = null;

// --- Stamp Shape Dragging State ---
let draggedStampShape = null; // { type, slot, shapeKey, placement, startRow }
let isDraggingStampShape = false;

// --- Triplet Shape Dragging State ---
let draggedTripletShape = null; // { type, slot, shapeKey, placement, startRow }
let isDraggingTripletShape = false;

// --- Canvas + Mobile Interaction State ---
let pitchCanvasElement = null;
const MOBILE_LONG_PRESS_DELAY_MS = 275;
const MOBILE_GHOST_ALPHA = 0.25;
let mobileLongPressTimer = null;
let mobileTouchState = null; // { identifier, colIndex, rowIndex }
let mobileGhostActive = false;

// Throttle preview audio during rapid drags to avoid overloading the audio graph
const PREVIEW_THROTTLE_MS = 40;
const CHORD_PREVIEW_THROTTLE_MS = 20; // Looser throttle for chord previews
let lastPreviewTimeSingle = 0;
let lastPreviewTimeChord = 0;

const DEFAULT_NOTE_COLOR = '#4a90e2';

function hexToRgba(hex: string, alpha = 1): string {
  const normalizedHex = hex.startsWith('#') ? hex.slice(1) : hex;
  if (normalizedHex.length !== 6) {return hex;}
  const r = parseInt(normalizedHex.slice(0, 2), 16);
  const g = parseInt(normalizedHex.slice(2, 4), 16);
  const b = parseInt(normalizedHex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getNoteHoverColor(alpha = 0.2): string {
  const color = store.state.selectedNote?.color || DEFAULT_NOTE_COLOR;
  return hexToRgba(color, alpha);
}

function getNoteColor(): string {
  return store.state.selectedNote?.color || DEFAULT_NOTE_COLOR;
}

const NOTE_DEBUG_LIMIT = 20;
let noteDebugCount = 0;
function debugNotePlacement(_stage: string, _details: Record<string, unknown> = {}): void {
  if (noteDebugCount >= NOTE_DEBUG_LIMIT) {
    return;
  }
  noteDebugCount += 1;
}

// --- Interaction Helpers ---
function isAnnotationToolActive(): boolean {
  return Boolean(annotationService.currentTool);
}

function getPitchForRow(rowIndex) {
  const rowData = store.state.fullRowData[rowIndex];
  return rowData ? rowData.toneNote : null;
}

// Convert a canvas-space column (no legends) to the nearest time-bearing canvas column
// by stripping tonic/non-time columns using the column map helper.
function getTimeAlignedCanvasColumn(canvasCol: number): number | null {
  const visualIndex = canvasCol + 2; // account for left legends
  const timeIndex = visualToTimeIndex(store.state, visualIndex);
  if (timeIndex === null) {return null;}
  const visualAligned = timeIndexToVisualColumn(store.state, timeIndex);
  if (visualAligned === null) {return null;}
  return Math.max(0, visualAligned - 2); // back to canvas-space
}

function isPositionWithinPitchGrid(colIndex, rowIndex) {
  const isCircleNote =
        (store.state.selectedTool === 'note' || store.state.selectedTool === 'chord') &&
        store.state.selectedNote?.shape === 'circle';

  // colIndex is now CANVAS-SPACE (0 = first musical beat)
  // Use musicalColumnWidths to get the count of musical columns
  // Check for non-empty array (empty array is truthy but useless)
  const musicalColumnWidths = (store.state.musicalColumnWidths && store.state.musicalColumnWidths.length > 0)
    ? store.state.musicalColumnWidths
    : store.state.columnWidths || [];
  const musicalColumns = musicalColumnWidths.length;

  // Circle notes span 2 columns, so they can't be placed in the last column
  const maxColumn = isCircleNote ? musicalColumns - 1 : musicalColumns;

  if (colIndex < 0 || colIndex >= maxColumn) {
    return false;
  }

  return getPitchForRow(rowIndex) !== null;
}

function shouldPlayPreview(isChord = false): boolean {
  const now = performance.now();
  const throttleMs = isChord ? CHORD_PREVIEW_THROTTLE_MS : PREVIEW_THROTTLE_MS;
  const lastTime = isChord ? lastPreviewTimeChord : lastPreviewTimeSingle;
  if (now - lastTime < throttleMs) {return false;}
  if (isChord) {
    lastPreviewTimeChord = now;
  } else {
    lastPreviewTimeSingle = now;
  }
  return true;
}

function findMeasureSnapPoint(columnIndex) {
  const { macrobeatGroupings, macrobeatBoundaryStyles, columnWidths } = store.state;
  const musicalColumns = columnWidths.length;

  if (columnIndex < 0 || columnIndex >= musicalColumns) {return null;}
  let hoveredMbIndex = -1;
  for (let i = 0; i < macrobeatGroupings.length; i++) {
    const { startColumn, endColumn } = getMacrobeatInfo(store.state, i);
    if (columnIndex >= startColumn && columnIndex <= endColumn) {
      hoveredMbIndex = i;
      break;
    }
  }
  if (hoveredMbIndex === -1) {return null;}
  let measureStartIndex = 0;
  for (let i = hoveredMbIndex - 1; i >= 0; i--) {
    if (macrobeatBoundaryStyles[i] === 'solid') {
      measureStartIndex = i + 1;
      break;
    }
  }
  const targetPreMacrobeatIndex = measureStartIndex - 1;

  // TONIC RULE: Only allow tonic at solid boundaries (measure starts) or before the first column.
  const isSolidBoundary = (mbIndex: number): boolean => {
    if (mbIndex <= 0) {return true;} // allow very first column
    const style = macrobeatBoundaryStyles[mbIndex - 1];
    return style === 'solid';
  };

  if (!isSolidBoundary(measureStartIndex)) {return null;}

  // Preview should align with the actual tonic placement column: start of the target measure.
  // getMacrobeatInfo already includes any existing tonic columns, so reuse it.
  const measureStartColumn = getMacrobeatInfo(store.state, measureStartIndex).startColumn;
  const drawColumn = measureStartColumn;

  return { drawColumn, preMacrobeatIndex: targetPreMacrobeatIndex };
}

// --- Chord Calculation Logic (with Enharmonic Correction) ---
function getChordNotesFromIntervals(rootNote) {
  const { activeChordIntervals, isIntervalsInverted, chordPositionState } = store.state;
  if (!rootNote || !activeChordIntervals || activeChordIntervals.length === 0) {return [];}

  // For 2-note intervals: inversion means placing second note below cursor
  if (isIntervalsInverted && activeChordIntervals.length === 2 && activeChordIntervals[0] === '1P') {
    const interval = activeChordIntervals[1];
    const invertedInterval = '-' + interval;
    const transposedNote = Note.transpose(rootNote, invertedInterval);
    const simplifiedNote = Note.simplify(transposedNote);
    const correctedNote = simplifiedNote.includes('#') ?
      Note.enharmonic(simplifiedNote).includes('b') ? Note.enharmonic(simplifiedNote) : simplifiedNote :
      simplifiedNote;
    return [rootNote, correctedNote];
  }

  // Generate all chord tones first
  const chordTones = activeChordIntervals.map(interval => {
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

  // For chords (3+ notes): position toggle means reordering chord tones
  if (activeChordIntervals.length >= 3 && chordPositionState > 0) {
    // Apply chord inversion by rotating the array
    const inverted = [...chordTones];
    for (let i = 0; i < chordPositionState; i++) {
      const first = inverted.shift();
      // Move the inverted note up an octave by transposing it
      const octaveUp = Note.transpose(first, '8P');
      inverted.push(Note.simplify(octaveUp));
    }

    // Position the BASS note (first note in the inverted chord) at the cursor
    // This is the expected behavior for chord positions/inversions
    const bassNote = inverted[0];
    const targetNote = rootNote; // This is where the user clicked
    const bassNoteMidi = Note.midi(bassNote);
    const targetNoteMidi = Note.midi(targetNote);

    // Find the octave adjustment needed to get the bass note close to the target
    let octaveAdjustment = 0;
    let adjustedBassMidi = bassNoteMidi;

    // Move bass note to the same octave as target or just below
    while (adjustedBassMidi > targetNoteMidi) {
      adjustedBassMidi -= 12;
      octaveAdjustment -= 12;
    }
    while (adjustedBassMidi + 12 <= targetNoteMidi) {
      adjustedBassMidi += 12;
      octaveAdjustment += 12;
    }

    // Apply the octave adjustment to all chord tones
    return inverted.map(note => {
      const adjustedMidi = Note.midi(note) + octaveAdjustment;
      return Note.fromMidi(adjustedMidi);
    });
  }

  return chordTones;
}

// --- Hover Drawing Logic ---
function drawHoverHighlight(colIndex, rowIndex, color) {
  if (!pitchHoverCtx) {return;}

  // MODULATION FIX: Use modulated column positioning to match placed notes
  const fullOptions = { ...store.state, zoomLevel: LayoutService.getViewportInfo().zoomLevel };
  const x = getColumnX(colIndex, fullOptions);
  const centerY = getRowY(rowIndex, store.state);
  const y = centerY - (store.state.cellHeight / 2); // Center the full-height highlight on the rank


  const toolType = store.state.selectedTool;

  // MODULATION FIX: Calculate highlight width based on modulated grid scaling
  let highlightWidth;
  if (store.state.modulationMarkers && store.state.modulationMarkers.length > 0) {
    // For modulated grids, calculate the actual width by finding the difference
    // between this column position and the next column position
    const nextX = getColumnX(colIndex + 1, fullOptions);
    highlightWidth = nextX - x;
  } else {
    // No modulation - use standard calculation
    highlightWidth = store.state.columnWidths[colIndex] * store.state.cellWidth;
  }

  // Apply tool-specific width overrides, but account for modulation scaling
  if (toolType === 'eraser' || isRightClickActive) {
    if (store.state.modulationMarkers && store.state.modulationMarkers.length > 0) {
      // For modulated grids, calculate 2-column span using actual positions
      const twoColumnsEndX = getColumnX(colIndex + 2, fullOptions);
      highlightWidth = twoColumnsEndX - x;
    } else {
      highlightWidth = store.state.cellWidth * 2;
    }
  } else if (toolType === 'note' && store.state.selectedNote?.shape === 'circle') {
    if (store.state.modulationMarkers && store.state.modulationMarkers.length > 0) {
      // For modulated grids, calculate 2-column span using actual positions
      const twoColumnsEndX = getColumnX(colIndex + 2, fullOptions);
      highlightWidth = twoColumnsEndX - x;
    } else {
      highlightWidth = store.state.cellWidth * 2;
    }
  } else if (toolType === 'stamp') {
    if (store.state.modulationMarkers && store.state.modulationMarkers.length > 0) {
      // For modulated grids, calculate 2-column span using actual positions
      const twoColumnsEndX = getColumnX(colIndex + 2, fullOptions);
      highlightWidth = twoColumnsEndX - x;
    } else {
      highlightWidth = store.state.cellWidth * 2;
    }
  } else if (toolType === 'triplet') {
    // Triplet width depends on the selected triplet stamp (1 or 2 cells)
    const selectedTriplet = TripletsToolbar.getSelectedTripletStamp();
    if (selectedTriplet) {
      const span = selectedTriplet.span === 'eighth' ? 1 : 2; // eighth=1 cell, quarter=2 cells
      const cellSpan = 2 * span; // Each cell is 2 microbeats
      if (store.state.modulationMarkers && store.state.modulationMarkers.length > 0) {
        const spanEndX = getColumnX(colIndex + cellSpan, fullOptions);
        highlightWidth = spanEndX - x;
      } else {
        highlightWidth = store.state.cellWidth * cellSpan;
      }
    } else {
      highlightWidth = store.state.cellWidth * 2;
    }
  } else if (toolType === 'tonicization') {
    if (store.state.modulationMarkers && store.state.modulationMarkers.length > 0) {
      // For modulated grids, calculate 2-column span using actual positions
      const twoColumnsEndX = getColumnX(colIndex + 2, fullOptions);
      highlightWidth = twoColumnsEndX - x;
    } else {
      highlightWidth = store.state.cellWidth * 2;
    }
  }


  pitchHoverCtx.fillStyle = color;
  pitchHoverCtx.fillRect(x, y, highlightWidth, store.state.cellHeight); // Full height to cover rank space
}

function drawGhostNote(colIndex, rowIndex, isFaint = false) {
  if (!pitchHoverCtx || !store.state.selectedNote) {return;}
  const toolType = store.state.selectedTool;
  const { shape, color } = store.state.selectedNote;

  pitchHoverCtx.globalAlpha = isFaint ? 0.2 : 0.4;

  if (toolType === 'tonicization') {
    const ghostTonic = { row: rowIndex, columnIndex: colIndex, tonicNumber: store.state.selectedToolTonicNumber };
    const fullOptions = { ...store.state, zoomLevel: LayoutService.getViewportInfo().zoomLevel };
    drawTonicShape(pitchHoverCtx, fullOptions, ghostTonic);
  } else if (toolType === 'note') {
    // Create ghost note that snaps to grid positions like normal notes
    const baseEndColumn = shape === 'circle' ? colIndex + 1 : colIndex;
    const ghostNote = {
      row: rowIndex,
      startColumnIndex: colIndex,
      endColumnIndex: baseEndColumn,
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

function attemptPlaceNoteAt(colIndex, rowIndex) {
  if (store.state.selectedTool !== 'note') {
    debugNotePlacement('skipped - not in note tool', { colIndex, rowIndex });
    return false;
  }

  if (!isNotePlayableAtColumn(colIndex, store.state)) {
    debugNotePlacement('blocked - column not playable', { colIndex, rowIndex });
    return false;
  }

  if (!store.state.selectedNote) {
    debugNotePlacement('blocked - no selected note', { colIndex, rowIndex });
    return false;
  }

  const { shape, color } = store.state.selectedNote;

  // For circle notes (2-column span), also check the second column
  if (shape === 'circle' && !isNotePlayableAtColumn(colIndex + 1, store.state)) {
    debugNotePlacement('blocked - circle end column not playable (tonic overlap)', { colIndex, rowIndex });
    return false;
  }
  const defaultEndColumn = shape === 'circle' ? colIndex + 1 : colIndex;
  const newNote = {
    row: rowIndex,
    startColumnIndex: colIndex,
    endColumnIndex: defaultEndColumn,
    color,
    shape,
    isDrum: false
  };

  const addedNote = store.addNote(newNote);

  if (!addedNote) {
    debugNotePlacement('store.addNote returned null', { colIndex, rowIndex, shape });
    return false;
  }

  debugNotePlacement('note placed', {
    colIndex,
    rowIndex,
    shape: addedNote.shape,
    uuid: addedNote.uuid
  });

  activeNote = addedNote;

  if (addedNote.uuid) {
    store.emit('noteInteractionStart', { noteId: addedNote.uuid, color: addedNote.color });
  }

  // Enable dragging for both circle and oval notes
  isDragging = true;
  lastDragRow = rowIndex;

  // Don't record state immediately - wait for drag to complete
  // (state will be recorded on mouse up)

  const pitch = getPitchForRow(rowIndex);
  if (pitch) {
    if (addedNote.uuid) {
      placementFillNoteIds.add(addedNote.uuid);
      store.emit('noteAttack', { noteId: addedNote.uuid, color: addedNote.color });
    }
    activePreviewPitches = [pitch];
    SynthEngine.triggerAttack(pitch, activeNote.color);
    const pitchColor = store.state.fullRowData[rowIndex]?.hex || '#888888';
    GlobalService.adsrComponent?.playheadManager.trigger(
      activeNote.uuid,
      'attack',
      pitchColor,
      store.state.timbres[activeNote.color].adsr
    );

    const staticWaveform = window.staticWaveformVisualizer;
    if (staticWaveform) {
      staticWaveform.currentColor = activeNote.color;
      staticWaveform.generateWaveform();
      staticWaveform.startSingleNoteVisualization(activeNote.color);
    }
  }

  return true;
}

function shouldUseMobileLongPress() {
  if (store.state.selectedTool !== 'note') {
    return false;
  }

  const profile = store.state.deviceProfile;
  if (profile && typeof profile.isMobile === 'boolean') {
    return profile.isMobile;
  }

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      return window.matchMedia('(pointer: coarse)').matches;
    } catch {
      return false;
    }
  }

  return false;
}

function getTouchGridPosition(touch) {
  if (!pitchCanvasElement) {return null;}

  const rect = pitchCanvasElement.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  const scrollLeft = document.getElementById('canvas-container')?.scrollLeft || 0;
  const colIndex = GridCoordsService.getColumnIndex(x + scrollLeft);
  const rowIndex = GridCoordsService.getPitchRowIndex(y);

  return { x, y, colIndex, rowIndex };
}

function findTouchById(touchList, identifier) {
  if (!touchList) {return null;}
  for (let i = 0; i < touchList.length; i++) {
    const touch = touchList.item(i);
    if (touch && touch.identifier === identifier) {
      return touch;
    }
  }
  return null;
}

function renderMobileGhostPreview() {
  if (!pitchHoverCtx || !mobileTouchState) {
    return;
  }

  pitchHoverCtx.clearRect(0, 0, getLogicalCanvasWidth(pitchHoverCtx.canvas), getLogicalCanvasHeight(pitchHoverCtx.canvas));
  drawHoverHighlight(mobileTouchState.colIndex, mobileTouchState.rowIndex, getNoteHoverColor(MOBILE_GHOST_ALPHA));
  drawGhostNote(mobileTouchState.colIndex, mobileTouchState.rowIndex);
  setGhostNotePosition(mobileTouchState.colIndex, mobileTouchState.rowIndex);
}

function activateMobileGhostPreview() {
  if (!mobileTouchState) {
    return;
  }

  if (!isPositionWithinPitchGrid(mobileTouchState.colIndex, mobileTouchState.rowIndex)) {
    resetMobileTouchState({ clearOverlay: false });
    return;
  }

  mobileGhostActive = true;
  renderMobileGhostPreview();
}

function resetMobileTouchState({ clearOverlay = false } = {}) {
  if (mobileLongPressTimer) {
    clearTimeout(mobileLongPressTimer);
    mobileLongPressTimer = null;
  }

  if (clearOverlay && mobileGhostActive) {
    handleMouseLeave();
  }

  mobileTouchState = null;
  mobileGhostActive = false;
}

function handleTouchStart(e) {
  if (!shouldUseMobileLongPress()) {
    return;
  }

  if (mobileTouchState) {
    return;
  }

  const touch = e.changedTouches?.[0];
  if (!touch) {
    return;
  }

  const position = getTouchGridPosition(touch);
  if (!position || !isPositionWithinPitchGrid(position.colIndex, position.rowIndex)) {
    return;
  }

  e.preventDefault();

  mobileTouchState = {
    identifier: touch.identifier,
    colIndex: position.colIndex,
    rowIndex: position.rowIndex
  };

  mobileLongPressTimer = window.setTimeout(() => {
    activateMobileGhostPreview();
  }, MOBILE_LONG_PRESS_DELAY_MS);
}

function handleTouchMove(e) {
  if (!mobileTouchState) {
    return;
  }

  const touch =
        findTouchById(e.changedTouches, mobileTouchState.identifier) ||
        findTouchById(e.touches, mobileTouchState.identifier);

  if (!touch) {
    return;
  }

  const position = getTouchGridPosition(touch);
  if (!position) {
    resetMobileTouchState({ clearOverlay: mobileGhostActive });
    return;
  }

  if (!isPositionWithinPitchGrid(position.colIndex, position.rowIndex)) {
    resetMobileTouchState({ clearOverlay: mobileGhostActive });
    return;
  }

  e.preventDefault();

  mobileTouchState.colIndex = position.colIndex;
  mobileTouchState.rowIndex = position.rowIndex;

  if (mobileGhostActive) {
    renderMobileGhostPreview();
  }
}

function handleTouchEnd(e) {
  if (!mobileTouchState) {
    return;
  }

  const touch = findTouchById(e.changedTouches, mobileTouchState.identifier);
  if (!touch) {
    return;
  }

  e.preventDefault();

  const ghostWasActive = mobileGhostActive;
  const targetCol = mobileTouchState.colIndex;
  const targetRow = mobileTouchState.rowIndex;

  resetMobileTouchState();

  if (!ghostWasActive || store.state.selectedTool !== 'note') {
    return;
  }

  const placed = attemptPlaceNoteAt(targetCol, targetRow);
  if (placed) {
    handleGlobalMouseUp();
  } else {
    handleMouseLeave();
  }
}

function handleTouchCancel() {
  resetMobileTouchState({ clearOverlay: mobileGhostActive });
}

// --- Event Handlers ---
function handleMouseDown(e) {
  if (isAnnotationToolActive()) {
    handleMouseLeave();
    return;
  }

  const rect = e.target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const scrollLeft = document.getElementById('canvas-container').scrollLeft;
  const colIndex = GridCoordsService.getColumnIndex(x + scrollLeft);
  const rowIndex = GridCoordsService.getPitchRowIndex(y);

  // Check boundaries - circle notes need more space than other tools
  if (!isPositionWithinPitchGrid(colIndex, rowIndex)) {
    if (store.state.selectedTool === 'note') {
      debugNotePlacement('blocked - outside pitch grid', { colIndex, rowIndex });
    }
    return;
  }

  if (e.button === 2) {
    e.preventDefault();
    isRightClickActive = true;
    rightClickActionTaken = false;
    if (store.state.selectedTool !== 'eraser') {
      previousTool = store.state.selectedTool;
      store.setSelectedTool('eraser');
    }
    domCache.get('eraserButton')?.classList.add('erasing-active');

    if (store.eraseInPitchArea(colIndex, rowIndex, 2, false)) {rightClickActionTaken = true;}
    if (store.eraseTonicSignAt(colIndex, false)) {rightClickActionTaken = true;}

    // Also erase stamps with right-click (2×3 area like circle notes)
    const eraseEndCol = (colIndex + 2 - 1) as CanvasSpaceColumn;
    const eraseStartRow = rowIndex - 1;
    const eraseEndRow = rowIndex + 1;
    if (store.eraseStampsInArea(colIndex, eraseEndCol, eraseStartRow, eraseEndRow)) {rightClickActionTaken = true;}

    // Also erase triplets with right-click
    if (store.eraseTripletsInArea(colIndex, eraseEndCol, eraseStartRow, eraseEndRow)) {rightClickActionTaken = true;}

    // Also erase annotations at the click point
    const rect = e.target.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    if (annotationService.eraseAtPoint(canvasX, canvasY)) {rightClickActionTaken = true;}

    pitchHoverCtx.clearRect(0, 0, getLogicalCanvasWidth(pitchHoverCtx.canvas), getLogicalCanvasHeight(pitchHoverCtx.canvas));
    drawHoverHighlight(colIndex, rowIndex, 'rgba(220, 53, 69, 0.3)');
    return;
  }

  if (e.button === 0) {
    // First check for modulation marker interactions (before tool-specific logic)
    const actualX = x + scrollLeft;

    // Test if we clicked on an existing modulation marker
    for (const marker of store.state.modulationMarkers || []) {
      // const hitResult = hitTestModulationMarker(actualX, y, marker); // Temporarily commented out
      const hitResult = null;
      if (hitResult) {
        if (hitResult.type === 'label') {
          // Clicked on label - toggle ratio
          const newRatio = marker.ratio === MODULATION_RATIOS.COMPRESSION_2_3 ?
            MODULATION_RATIOS.EXPANSION_3_2 :
            MODULATION_RATIOS.COMPRESSION_2_3;
          store.setModulationRatio(marker.id, newRatio);
          return;
        } else if (hitResult.type === 'barline' && hitResult.canDrag) {
          // Start dragging the marker
          isDraggingModulationMarker = true;
          draggedModulationMarker = marker;
          return;
        }
      }
    }

    // Check if clicking on an existing note to trigger dynamic waveform
    const existingNote = store.state.placedNotes.find(note =>
      !note.isDrum &&
            note.row === rowIndex &&
            colIndex >= note.startColumnIndex &&
            colIndex <= note.endColumnIndex
    );

    if (existingNote && store.state.selectedTool === 'note') {
      // Found an existing note - check for rhythm stamp first
      const stamp = rhythmPlaybackService.getStampAtPosition(colIndex, rowIndex);
      const pitch = getPitchForRow(rowIndex);

      if (stamp && pitch) {
        // Rhythm stamp exists - play the rhythm pattern

        // Start single note visualization in the waveform
        const staticWaveform = window.staticWaveformVisualizer;
        if (staticWaveform) {
          staticWaveform.currentColor = existingNote.color;
          staticWaveform.generateWaveform();
          staticWaveform.startSingleNoteVisualization(existingNote.color);
        }

        // Play the rhythm pattern with duration based on note shape
        // Circle notes (quarter) = 2x duration, Oval notes (eighth) = 1x duration
        // Pass the stamp placement for per-shape pitch playback
        rhythmPlaybackService.playRhythmPattern(stamp.stampId, pitch, existingNote.color, existingNote.shape, stamp);

        activePreviewPitches = [pitch];
        activeNote = existingNote;

      } else if (pitch) {
        // No stamp - play single note as before

        // Start single note visualization in the waveform
        const staticWaveform = window.staticWaveformVisualizer;
        if (staticWaveform) {
          staticWaveform.currentColor = existingNote.color;
          staticWaveform.generateWaveform();
          staticWaveform.startSingleNoteVisualization(existingNote.color);
        }

        // Trigger audio for the existing note
        SynthEngine.triggerAttack(pitch, existingNote.color);
        const pitchColor = store.state.fullRowData[rowIndex]?.hex || '#888888';
        GlobalService.adsrComponent?.playheadManager.trigger(existingNote.uuid, 'attack', pitchColor, store.state.timbres[existingNote.color].adsr);

        activePreviewPitches = [pitch];
        activeNote = existingNote;
      }
      return; // Don't process as a new note placement
    }

    const toolType = store.state.selectedTool;

    if (toolType === 'chord') {
      if (!isNotePlayableAtColumn(colIndex, store.state)) {
        return;
      }

      const rootNote = getPitchForRow(rowIndex);
      if (!rootNote) {return;}
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
      chordNotes.forEach(noteName => {
        const noteRow = store.state.fullRowData.findIndex(r => r.toneNote === noteName);
        if (noteRow !== -1) {
          const defaultEndColumn = (shape === 'circle' ? colIndex + 1 : colIndex) as CanvasSpaceColumn;
          const newNote = { row: noteRow, startColumnIndex: colIndex, endColumnIndex: defaultEndColumn, color, shape, isDrum: false };
          const addedNote = store.addNote(newNote);
          if (addedNote) {
            activeChordNotes.push(addedNote);

            // Emit interaction start event for animation service
            if (addedNote.uuid) {
              placementFillNoteIds.add(addedNote.uuid);
              store.emit('noteAttack', { noteId: addedNote.uuid, color: addedNote.color });
              store.emit('noteInteractionStart', { noteId: addedNote.uuid, color: addedNote.color });
            }
          }
        }
      });

      // Enable dragging for chord shapes
      isDragging = true;
      lastDragRow = rowIndex; // Initialize drag row tracking for chords

      // Don't record state immediately - wait for drag to complete
      return;
    }

    if (toolType === 'tonicization') {
      if (lastHoveredTonicPoint && lastHoveredOctaveRows.length > 0) {
        const placedTonics = getPlacedTonicSigns(store.state);
        const measureHasTonic = placedTonics.some(ts => ts.preMacrobeatIndex === lastHoveredTonicPoint.preMacrobeatIndex);

        if (measureHasTonic) {
          lastHoveredTonicPoint = null;
          lastHoveredOctaveRows = [];
          return;
        }

        const newTonicGroup = lastHoveredOctaveRows.map(rowIdx => ({
          row: rowIdx,
          tonicNumber: store.state.selectedToolTonicNumber,
          preMacrobeatIndex: lastHoveredTonicPoint.preMacrobeatIndex,
          columnIndex: lastHoveredTonicPoint.drawColumn
        }));
        store.addTonicSignGroup(newTonicGroup);
        lastHoveredTonicPoint = null;
        lastHoveredOctaveRows = [];
      } else {
      }
      return;
    }

    if (toolType === 'eraser') {

      isEraserDragActive = true; // Enable drag mode for eraser

      store.eraseInPitchArea(colIndex, rowIndex, 2, false); // Don't record state yet (will record on mouse up)

      // Also remove stamps that intersect with the eraser area (2×3 area like circle notes)
      const eraseEndCol = colIndex + 2 - 1; // Eraser spans 2 columns
      const eraseStartRow = rowIndex - 1; // Eraser starts 1 row above
      const eraseEndRow = rowIndex + 1; // Eraser covers 3 rows: row-1, row, row+1


      removeStampsInEraserArea(colIndex, eraseEndCol, eraseStartRow, eraseEndRow);

      // Also remove triplets that intersect with the eraser area
      eraseTripletGroups(colIndex, eraseEndCol, eraseStartRow, eraseEndRow);
      return;
    }

    if (toolType === 'stamp') {
      // First, check if clicking on an individual shape within an existing stamp
      const allStamps = store.getAllStampPlacements();
      const actualX = x + scrollLeft;
      const fullOptions = { ...store.state };

      const hitResult = hitTestAnyStampShape(actualX, y, allStamps, fullOptions);

      if (hitResult) {
        // Clicked on an individual shape - start dragging
        draggedStampShape = {
          ...hitResult,
          startRow: store.getShapeRow(hitResult.placement, hitResult.shapeKey),
          startMouseY: y
        };
        isDraggingStampShape = true;

        return; // Skip normal stamp placement
      }

      // No shape hit - check if clicking on an existing stamp (to replay the rhythm pattern)
      const existingStamp = rhythmPlaybackService.getStampAtPosition(colIndex, rowIndex);
      if (existingStamp) {

        const pitch = getPitchForRow(rowIndex);
        if (pitch) {
          // Find the note at this position to get its shape
          const noteAtStamp = store.state.placedNotes.find(note =>
            !note.isDrum &&
                        note.row === rowIndex &&
                        colIndex >= note.startColumnIndex &&
                        colIndex <= note.endColumnIndex
          );

          // Use the note's shape if found, otherwise default to 'oval'
          const shape = noteAtStamp ? noteAtStamp.shape : 'oval';

          // Pass the placement object for per-shape pitch playback
          rhythmPlaybackService.playRhythmPattern(existingStamp.stampId, pitch, existingStamp.color, shape, existingStamp);

          // Track the active pitch for release on mouseup
          activePreviewPitches = [pitch];
        }
        return; // Don't place a new stamp on top
      }

      // No existing stamp - place new stamp
      const selectedStamp = StampsToolbar.getSelectedStamp();
      if (selectedStamp) {
        const alignedCol = getTimeAlignedCanvasColumn(colIndex);
        if (alignedCol === null) {return;}

        const { color, shape } = store.state.selectedNote;
        placeStamp(selectedStamp.id, alignedCol, rowIndex, color);

        // Play the rhythm pattern for the stamp
        const pitch = getPitchForRow(rowIndex);
        if (pitch) {
          rhythmPlaybackService.playRhythmPattern(selectedStamp.id, pitch, color, shape);

          // Track the active pitch for release on mouseup
          activePreviewPitches = [pitch];
        }

        store.recordState(); // Save state for undo/redo
      }
      return;
    }

    if (toolType === 'triplet') {
      // Check if clicking on individual shape within existing triplet
      const allTriplets = store.getAllTripletPlacements();
      const actualX = x + scrollLeft;
      const fullOptions = { ...store.state };

      const hitResult = hitTestAnyTripletShape(actualX, y, allTriplets, fullOptions);
      if (hitResult) {
        draggedTripletShape = {
          ...hitResult,
          startRow: store.getTripletShapeRow(hitResult.placement, hitResult.shapeKey),
          startMouseY: y
        };
        isDraggingTripletShape = true;
        return;
      }

      // No shape hit - check if clicking on existing triplet (to replay the rhythm pattern)
      // Convert canvas-space column to time-space, then to cell index
      // Cells are in time-space (exclude tonic columns): each cell = 2 time microbeats
      const timeCol = canvasToTime(colIndex, store.state);
      if (timeCol === null) {
        return; // Clicked on a tonic column - no triplet placement allowed
      }
      const cellIndex = Math.floor(timeCol / 2);
      const existingTriplet = rhythmPlaybackService.getTripletAtPosition(cellIndex, rowIndex);
      if (existingTriplet) {

        const pitch = getPitchForRow(rowIndex);
        if (pitch) {
          rhythmPlaybackService.playTripletPattern(existingTriplet.stampId, pitch, existingTriplet.color, existingTriplet);

          // Track the active pitch for release on mouseup
          activePreviewPitches = [pitch];
        }
        return; // Don't place a new triplet on top
      }

      // No existing triplet - place new triplet
      const selectedTriplet = TripletsToolbar.getSelectedTripletStamp();
      if (selectedTriplet && store.state.selectedNote) {

        // Convert column index to cell index for triplets (cell = 2 microbeats)
        const placement = placeTripletGroup(selectedTriplet.id, cellIndex, rowIndex, store.state.selectedNote.color);

        // Play the triplet rhythm pattern
        const pitch = getPitchForRow(rowIndex);
        if (pitch && placement) {
          rhythmPlaybackService.playTripletPattern(selectedTriplet.id, pitch, store.state.selectedNote.color, placement);

          // Track the active pitch for release on mouseup
          activePreviewPitches = [pitch];
        }

        store.recordState(); // Save state for undo/redo
      }
      return;
    }

    if (toolType === 'modulation') {
      // Get the selected modulation ratio from the UI
      const selectedRatio = store.state.selectedModulationRatio;
      if (!selectedRatio) {
        logger.warn('PitchGridInteractor', 'No modulation ratio selected before placement', null, 'grid');
        return;
      }

      // Find which measure boundary we're closest to
      const measureBoundary = findNearestMeasureBoundary(actualX);
      if (!measureBoundary) {
        logger.warn('PitchGridInteractor', 'Modulation placement must be near a measure boundary', { clickX: actualX }, 'grid');
        return;
      }

      logger.debug('PitchGridInteractor', 'Placing modulation marker at boundary', {
        measureIndex: measureBoundary.measureIndex,
        ratio: selectedRatio,
        clickX: actualX,
        boundaryX: measureBoundary.xPosition
      }, 'grid');

      // Create and add the marker at the measure boundary
      const markerId = store.addModulationMarker(measureBoundary.measureIndex, selectedRatio, measureBoundary.xPosition, null, measureBoundary.macrobeatIndex);

      logger.debug('PitchGridInteractor', 'Modulation marker placed', {
        markerId,
        measureIndex: measureBoundary.measureIndex,
        ratio: selectedRatio
      }, 'grid');

      return;
    }

    if (toolType === 'note') {
      attemptPlaceNoteAt(colIndex, rowIndex);
    }
  }
}

function handleMouseMove(e) {
  if (isAnnotationToolActive()) {
    handleMouseLeave();
    return;
  }

  const rect = e.target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const scrollLeft = document.getElementById('canvas-container').scrollLeft;
  const colIndex = GridCoordsService.getColumnIndex(x + scrollLeft);
  const rowIndex = GridCoordsService.getPitchRowIndex(y);

  if (!pitchHoverCtx) {return;}
  pitchHoverCtx.clearRect(0, 0, getLogicalCanvasWidth(pitchHoverCtx.canvas), getLogicalCanvasHeight(pitchHoverCtx.canvas));

  // Handle modulation marker dragging
  if (isDraggingModulationMarker && draggedModulationMarker) {
    const actualX = x + scrollLeft;
    const baseMicrobeatPx = store.state.baseMicrobeatPx || store.state.cellWidth || 40;
    const snappedX = Math.round(actualX / baseMicrobeatPx) * baseMicrobeatPx;

    // Update marker position
    store.moveModulationMarker(draggedModulationMarker.id, snappedX);
    return;
  }

  // Handle stamp shape dragging
  if (isDraggingStampShape && draggedStampShape) {
    const newRow = GridCoordsService.getPitchRowIndex(y);
    const rowOffset = newRow - draggedStampShape.placement.row;

    // Update the shape's offset in state
    store.updateStampShapeOffset(
      draggedStampShape.placement.id,
      draggedStampShape.shapeKey,
      rowOffset
    );

    // Play audio feedback when row changes
    if (newRow !== draggedStampShape.startRow) {
      const pitch = getPitchForRow(newRow);
      if (pitch) {
        const color = draggedStampShape.placement.color || store.state.selectedNote?.color;
        // Quick note for feedback
        SynthEngine.triggerAttack(pitch, color);
        setTimeout(() => SynthEngine.triggerRelease(pitch, color), 100);
      }
      draggedStampShape.startRow = newRow; // Update to prevent retriggering
    }

    // Show cursor feedback
    e.target.style.cursor = 'ns-resize';
    return;
  }

  // Handle triplet shape dragging
  if (isDraggingTripletShape && draggedTripletShape) {
    const newRow = GridCoordsService.getPitchRowIndex(y);
    const rowOffset = newRow - draggedTripletShape.placement.row;

    // Update the shape's offset in state
    store.updateTripletShapeOffset(
      draggedTripletShape.placement.id,
      draggedTripletShape.shapeKey,
      rowOffset
    );

    // Play audio feedback when row changes
    if (newRow !== draggedTripletShape.startRow) {
      const pitch = getPitchForRow(newRow);
      if (pitch) {
        const color = draggedTripletShape.placement.color || store.state.selectedNote?.color;
        // Quick note for feedback
        SynthEngine.triggerAttack(pitch, color);
        setTimeout(() => SynthEngine.triggerRelease(pitch, color), 100);
      }
      draggedTripletShape.startRow = newRow; // Update to prevent retriggering
    }

    // Show cursor feedback
    e.target.style.cursor = 'ns-resize';
    return;
  }

  // Check for stamp shape hover when stamp tool is active (for cursor feedback)
  const toolType = store.state.selectedTool;
  if (toolType === 'stamp' && !isDraggingStampShape) {
    const actualX = x + scrollLeft;
    const allStamps = store.getAllStampPlacements();
    const fullOptions = { ...store.state };

    const hitResult = hitTestAnyStampShape(actualX, y, allStamps, fullOptions);
    if (hitResult) {
      // Show ns-resize cursor when hovering over a draggable shape
      e.target.style.cursor = 'ns-resize';
    } else {
      // Reset cursor when not hovering
      e.target.style.cursor = 'default';
    }
  }

  // Check for triplet shape hover when triplet tool is active (for cursor feedback)
  if (toolType === 'triplet' && !isDraggingTripletShape) {
    const actualX = x + scrollLeft;
    const allTriplets = store.getAllTripletPlacements();
    const fullOptions = { ...store.state };

    const hitResult = hitTestAnyTripletShape(actualX, y, allTriplets, fullOptions);
    if (hitResult) {
      // Show ns-resize cursor when hovering over a draggable shape
      e.target.style.cursor = 'ns-resize';
    } else {
      // Reset cursor when not hovering
      e.target.style.cursor = 'default';
    }
  }

  // Handle modulation tool preview and hover
  const actualX = x + scrollLeft;
  let hoveredMarker = null;

  // Check for existing modulation marker hover
  for (const _marker of store.state.modulationMarkers || []) {
    // const hitResult = hitTestModulationMarker(actualX, y, marker); // Temporarily commented out
    const hitResult = null;
    if (hitResult) {
      hoveredMarker = hitResult;
      break;
    }
  }

  // Show modulation placement preview if modulation tool is active
  if (store.state.selectedTool === 'modulation' && !hoveredMarker) {
    const nearestBoundary = findNearestMeasureBoundary(actualX);
    if (nearestBoundary) {
      drawModulationPreview(pitchHoverCtx, nearestBoundary.xPosition, store.state.selectedModulationRatio);
    }
  }

  // Update cursor based on hover state
  const canvas = e.target;
  if (hoveredMarker) {
    // canvas.style.cursor = getModulationMarkerCursor(hoveredMarker); // Temporarily commented out
    canvas.style.cursor = 'pointer';
    lastModulationHoverResult = hoveredMarker;
  } else if (lastModulationHoverResult) {
    canvas.style.cursor = 'default';
    lastModulationHoverResult = null;
  }

  // Debug log when dragging (currently disabled)
  // if (isDragging) {
  //   // TODO: Add drag debugging
  // }

  // CANVAS-SPACE FIX: Check boundaries using canvas-space coordinates (0 = first musical beat)
  const isCircleNote = (store.state.selectedTool === 'note' || store.state.selectedTool === 'chord') && store.state.selectedNote?.shape === 'circle';
  const musicalColumnsLength = store.state.columnWidths.length;
  const maxColumn = isCircleNote ? musicalColumnsLength - 1 : musicalColumnsLength;
  if (colIndex < 0 || colIndex >= maxColumn || getPitchForRow(rowIndex) === null) {
    // Out of bounds - handled below
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
    const newRow = rowIndex;

    if (activeNote) {
      // Handle single note dragging

      if (activeNote.shape === 'circle') {
        // Circle notes: extend tail horizontally
        if (newEndIndex !== activeNote.endColumnIndex) {
          store.updateNoteTail(activeNote, newEndIndex);
        }

        // Circle notes: change pitch vertically (only when row changes)
        if (newRow !== lastDragRow && newRow !== activeNote.row) {
          const newPitch = getPitchForRow(newRow);
          if (newPitch) {
            // Release old pitch
            const oldPitch = getPitchForRow(activeNote.row);
            if (oldPitch) {
              SynthEngine.quickReleasePitches([oldPitch], activeNote.color);
            }

            // Update note row
            store.updateNoteRow(activeNote, newRow);

            // Trigger new pitch
            if (shouldPlayPreview()) {
              SynthEngine.triggerAttack(newPitch, activeNote.color);
              activePreviewPitches = [newPitch];
            }

            // Update ADSR visualization
            const pitchColor = store.state.fullRowData[newRow]?.hex || '#888888';
            GlobalService.adsrComponent?.playheadManager.trigger(activeNote.uuid, 'attack', pitchColor, store.state.timbres[activeNote.color].adsr);

            lastDragRow = newRow;
          }
        }
      } else if (activeNote.shape === 'oval') {
        // Oval notes: reposition horizontally
        const newStartIndex = colIndex;
        if (newStartIndex !== activeNote.startColumnIndex) {
          store.updateNotePosition(activeNote, newStartIndex);
        }

        // Oval notes: change pitch vertically (update on every row change)
        if (newRow !== activeNote.row) {
          const newPitch = getPitchForRow(newRow);
          if (newPitch) {
            // Release old pitch
            const oldPitch = getPitchForRow(activeNote.row);
            if (oldPitch) {
              SynthEngine.quickReleasePitches([oldPitch], activeNote.color);
            }

            // Update note row
            store.updateNoteRow(activeNote, newRow);

            // Trigger new pitch
            if (shouldPlayPreview()) {
              SynthEngine.triggerAttack(newPitch, activeNote.color);
              activePreviewPitches = [newPitch];
            }

            // Update ADSR visualization
            const pitchColor = store.state.fullRowData[newRow]?.hex || '#888888';
            GlobalService.adsrComponent?.playheadManager.trigger(activeNote.uuid, 'attack', pitchColor, store.state.timbres[activeNote.color].adsr);
          }
        }
      }
    } else if (activeChordNotes.length > 0) {
      // Handle chord notes dragging
      const firstChordNote = activeChordNotes[0];

      if (firstChordNote.shape === 'circle') {
        // Circle chord notes: extend tails
        const notesToUpdate = activeChordNotes.filter(note => newEndIndex !== note.endColumnIndex);
        if (notesToUpdate.length > 0) {
          store.updateMultipleNoteTails(notesToUpdate, newEndIndex);
        }

        // Circle chord notes: change pitch vertically (only when row changes)
        if (newRow !== lastDragRow) {
          const rowOffset = newRow - lastDragRow;

          // Release all old pitches
          SynthEngine.quickReleasePitches(activePreviewPitches, activeChordNotes[0].color);

          // Calculate new rows for all chord notes
          const newRows = activeChordNotes.map(note => note.row + rowOffset);

          // Check if all new rows are valid
          const allValid = newRows.every(row => getPitchForRow(row) !== null);

          if (allValid) {
            // Update all note rows
            store.updateMultipleNoteRows(activeChordNotes, newRows);

            // Trigger new pitches
            const newPitches = newRows.map(row => getPitchForRow(row)).filter(p => p);
            if (shouldPlayPreview(true)) {
              newPitches.forEach(pitch => {
                SynthEngine.triggerAttack(pitch, activeChordNotes[0].color);
              });
              activePreviewPitches = newPitches;
            }

            lastDragRow = newRow;
          }
        }
      } else if (firstChordNote.shape === 'oval') {
        // Oval chord notes: reposition all notes together horizontally
        const newStartIndex = colIndex;
        const notesToUpdate = activeChordNotes.filter(note => newStartIndex !== note.startColumnIndex);
        if (notesToUpdate.length > 0) {
          store.updateMultipleNotePositions(notesToUpdate, newStartIndex);
        }

        // Oval chord notes: change pitch vertically (update on every row change)
        const rowOffset = newRow - (lastDragRow !== null ? lastDragRow : activeChordNotes[0].row);
        if (rowOffset !== 0) {
          // Release all old pitches
          SynthEngine.quickReleasePitches(activePreviewPitches, activeChordNotes[0].color);

          // Calculate new rows for all chord notes
          const newRows = activeChordNotes.map(note => note.row + rowOffset);

          // Check if all new rows are valid
          const allValid = newRows.every(row => getPitchForRow(row) !== null);

          if (allValid) {
            // Update all note rows
            store.updateMultipleNoteRows(activeChordNotes, newRows);

            // Trigger new pitches
            const newPitches = newRows.map(row => getPitchForRow(row)).filter(p => p);
            if (shouldPlayPreview(true)) {
              newPitches.forEach(pitch => {
                SynthEngine.triggerAttack(pitch, activeChordNotes[0].color);
              });
              activePreviewPitches = newPitches;
            }

            lastDragRow = newRow;
          }
        }
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
          const defaultEndColumn = (shape === 'circle' ? colIndex + 1 : colIndex) as CanvasSpaceColumn;
          const ghostNote = { row: noteRowIndex, startColumnIndex: colIndex, endColumnIndex: defaultEndColumn, color, shape, isDrum: false } as const;
          const fullOptions = { ...store.state, zoomLevel: LayoutService.getViewportInfo().zoomLevel };
          if (shape === 'oval') {
            drawSingleColumnOvalNote(pitchHoverCtx, fullOptions, ghostNote as any, noteRowIndex);
          } else {
            drawTwoColumnOvalNote(pitchHoverCtx, fullOptions, ghostNote as any, noteRowIndex);
          }
        }
      });
      pitchHoverCtx.globalAlpha = 1.0;
    }
    return;
  }

  if (isRightClickActive) {
    if (store.eraseInPitchArea(colIndex, rowIndex, 2, false)) {rightClickActionTaken = true;}
    if (store.eraseTonicSignAt(colIndex, false)) {rightClickActionTaken = true;}

    // Also erase stamps during right-click drag (2×3 area like circle notes)
    const eraseEndCol = colIndex + 2 - 1;
    const eraseStartRow = rowIndex - 1;
    const eraseEndRow = rowIndex + 1;
    if (store.eraseStampsInArea(colIndex, eraseEndCol, eraseStartRow, eraseEndRow)) {rightClickActionTaken = true;}

    // Also erase triplets during right-click drag
    if (store.eraseTripletsInArea(colIndex, eraseEndCol, eraseStartRow, eraseEndRow)) {rightClickActionTaken = true;}

    // Also erase annotations during right-click drag
    const rect = e.target.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    if (annotationService.eraseAtPoint(canvasX, canvasY)) {rightClickActionTaken = true;}

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

    // Also erase triplets during eraser drag
    store.eraseTripletsInArea(colIndex, eraseEndCol, eraseStartRow, eraseEndRow);

    drawHoverHighlight(colIndex, rowIndex, 'rgba(220, 53, 69, 0.3)');
    return;
  }

  if (store.state.selectedTool === 'tonicization') {
    const snapPoint = findMeasureSnapPoint(colIndex);
    if (snapPoint) {
      const placedTonics = getPlacedTonicSigns(store.state);
      const measureHasTonic = placedTonics.some(ts => ts.preMacrobeatIndex === snapPoint.preMacrobeatIndex);
      if (measureHasTonic) {
        lastHoveredTonicPoint = null;
        lastHoveredOctaveRows = [];
        return;
      }

      const basePitch = getPitchForRow(rowIndex);
      if (basePitch) {
        // Search ALL octaves in master pitch data (place tonics on all octaves, even outside current range)
        const pitchClass = basePitch.replace(/\d+$/, ''); // e.g., "Ab" from "Ab5"
        const topIndex = store.state.pitchRange?.topIndex ?? 0;

        // Find all matching pitch classes in master data and convert to fullRowData indices
        const octaveRows = masterRowData
          .map((rowData, masterIndex) => ({ rowData, masterIndex }))
          .filter(({ rowData }) => rowData.toneNote && rowData.toneNote.replace(/\d+$/, '') === pitchClass)
          .map(({ masterIndex }) => masterIndex - topIndex); // Convert to fullRowData-relative index (may be negative or > length)

        lastHoveredTonicPoint = snapPoint;
        lastHoveredOctaveRows = octaveRows;

        // Draw ghost preview only for tonics in the visible range
        const visibleOctaveRows = octaveRows.filter(rowIdx =>
          rowIdx >= 0 && rowIdx < store.state.fullRowData.length
        );

        pitchHoverCtx.globalAlpha = 0.5;
        const fullOptions = { ...store.state, zoomLevel: LayoutService.getViewportInfo().zoomLevel };
        visibleOctaveRows.forEach(rowIdx => {
          const ghostTonic = { row: rowIdx, columnIndex: snapPoint.drawColumn, tonicNumber: store.state.selectedToolTonicNumber };
          drawTonicShape(pitchHoverCtx, fullOptions, ghostTonic);
        });
        pitchHoverCtx.globalAlpha = 1.0;
      }
    } else {
      lastHoveredTonicPoint = null;
      lastHoveredOctaveRows = [];
    }
  } else {
    const placedTonicSigns = getPlacedTonicSigns(store.state);
    const isCircle = store.state.selectedNote?.shape === 'circle';

    // Determine if placement is allowed based on tool type
    let canPlace = true;
    if (store.state.selectedTool === 'note' || store.state.selectedTool === 'chord') {
      // Notes: check start column, and for circles also check end column
      canPlace = isNotePlayableAtColumn(colIndex, store.state) &&
        (!isCircle || isNotePlayableAtColumn(colIndex + 1, store.state));
    } else if (store.state.selectedTool === 'stamp') {
      // Stamps span 2 microbeats - check both columns
      const alignedCol = getTimeAlignedCanvasColumn(colIndex);
      canPlace = alignedCol !== null &&
        !isWithinTonicSpan(alignedCol, placedTonicSigns) &&
        !isWithinTonicSpan(alignedCol + 1, placedTonicSigns);
    } else if (store.state.selectedTool === 'triplet') {
      // Triplets span multiple cells - check all microbeat columns
      const selectedTriplet = TripletsToolbar.getSelectedTripletStamp();
      if (selectedTriplet) {
        // Convert canvas-space column to time-space, then to cell index
        const timeCol = canvasToTime(colIndex, store.state);
        if (timeCol === null) {
          canPlace = false; // On a tonic column
        } else {
          const cellIndex = Math.floor(timeCol / 2);
          // Use GROUP_WIDTH_CELLS to get the correct span (eighth=1, quarter=2)
          const span = GROUP_WIDTH_CELLS[selectedTriplet.span] ?? 1;

          // Check if triplet would overlap tonic columns
          // This mirrors the fixed logic in canPlaceTripletAt()
          const startTimeMicrobeat = cellIndex * 2;
          const timeSpan = span * 2; // How many time columns (microbeats) this triplet occupies

          // Get the canvas-space start column
          const startCanvasCol = timeToCanvas(startTimeMicrobeat, store.state);

          // Check if any tonic falls within the required canvas range
          canPlace = true; // Assume allowed unless tonic found
          for (const tonicSign of placedTonicSigns) {
            const tonicStart = tonicSign.columnIndex;
            const tonicEnd = tonicSign.columnIndex + 1;

            // Block if tonic starts within our required time span
            if (tonicStart >= startCanvasCol && tonicStart < startCanvasCol + timeSpan) {
              canPlace = false;
              break;
            }

            // Block if we're trying to start ON a tonic
            if (startCanvasCol >= tonicStart && startCanvasCol <= tonicEnd) {
              canPlace = false;
              break;
            }
          }
        }
      }
    }

    const highlightColor = store.state.selectedTool === 'eraser'
      ? 'rgba(220, 53, 69, 0.3)'
      : canPlace
        ? getNoteHoverColor(0.2)
        : 'rgba(220, 53, 69, 0.15)';

    const highlightStartCol = colIndex;
    drawHoverHighlight(highlightStartCol, rowIndex, highlightColor);

    if (store.state.selectedTool === 'stamp') {
      // Show stamp preview (only if placement is allowed)
      const selectedStamp = StampsToolbar.getSelectedStamp();
      if (selectedStamp && canPlace) {

        const alignedCol = getTimeAlignedCanvasColumn(colIndex);
        if (alignedCol === null) {return;}

        const options = {
          cellWidth: store.state.cellWidth,
          cellHeight: store.state.cellHeight,
          columnWidths: store.state.columnWidths,
          musicalColumnWidths: store.state.columnWidths,
          modulationMarkers: store.state.modulationMarkers,
          baseMicrobeatPx: store.state.cellWidth,
          macrobeatGroupings: store.state.macrobeatGroupings,
          previewColor: getNoteColor()
        };

        renderStampPreview(pitchHoverCtx, alignedCol, rowIndex, selectedStamp, options);
      }
    } else if (store.state.selectedTool === 'triplet') {
      // Show triplet preview (only if placement is allowed)
      const selectedTriplet = TripletsToolbar.getSelectedTripletStamp();
      if (selectedTriplet && canPlace) {
        // Pass canvas-space column directly - the renderer will handle coordinate conversion
        const options = {
          cellWidth: store.state.cellWidth,
          cellHeight: store.state.cellHeight,
          columnWidths: store.state.columnWidths,
          musicalColumnWidths: store.state.columnWidths,
          modulationMarkers: store.state.modulationMarkers,
          baseMicrobeatPx: store.state.cellWidth,
          macrobeatGroupings: store.state.macrobeatGroupings,
          previewColor: getNoteColor()
        };
        renderTripletPreview(pitchHoverCtx, colIndex, rowIndex, selectedTriplet, options);
      }
    } else if (canPlace) {
      drawGhostNote(colIndex, rowIndex);
    }
  }
}

function handleMouseLeave() {
  if (pitchHoverCtx) {
    pitchHoverCtx.clearRect(0, 0, getLogicalCanvasWidth(pitchHoverCtx.canvas), getLogicalCanvasHeight(pitchHoverCtx.canvas));
  }
  lastHoveredTonicPoint = null;
  lastHoveredOctaveRows = [];
  clearGhostNotePosition();
}

function handleGlobalMouseUp() {
  // Handle stamp shape drag end
  if (isDraggingStampShape && draggedStampShape) {
    isDraggingStampShape = false;
    draggedStampShape = null;

    // Save state for undo/redo
    store.recordState();

    // Reset cursor
    const canvas = document.getElementById('notation-grid');
    if (canvas) {canvas.style.cursor = 'default';}

    return;
  }

  // Handle triplet shape drag end
  if (isDraggingTripletShape && draggedTripletShape) {
    isDraggingTripletShape = false;
    draggedTripletShape = null;

    // Save state for undo/redo
    store.recordState();

    // Reset cursor
    const canvas = document.getElementById('notation-grid');
    if (canvas) {canvas.style.cursor = 'default';}

    return;
  }

  // Handle modulation marker drag end
  if (isDraggingModulationMarker) {
    isDraggingModulationMarker = false;
    draggedModulationMarker = null;
    return;
  }

  // MODIFIED: Release any pitches that were triggered for preview
  if (activePreviewPitches.length > 0) {
    // Stop any active rhythm pattern playback
    rhythmPlaybackService.stopCurrentPattern();

    const previewColor = activeNote?.color
      || (activeChordNotes.length > 0 ? activeChordNotes[0]?.color : null)
      || store.state.selectedNote?.color
      || null;

    if (previewColor) {
      activePreviewPitches.forEach(pitch => {
        SynthEngine.triggerRelease(pitch, previewColor);
      });
    }

    // Determine which ADSR visual to release
    const wasSingleNote = !!activeNote;
    if (wasSingleNote && previewColor) {
      const pitchColor = store.state.fullRowData[activeNote.row]?.hex || '#888888';
      GlobalService.adsrComponent?.playheadManager.trigger(activeNote.uuid, 'release', pitchColor, store.state.timbres[previewColor].adsr);
    } else if (!wasSingleNote && previewColor) { // It was a chord preview
      const rootPitch = activePreviewPitches[0];
      const rootRow = store.state.fullRowData.find(row => row.toneNote === rootPitch);
      if (rootRow) {
        const pitchColor = rootRow.hex;
        GlobalService.adsrComponent?.playheadManager.trigger('chord_preview', 'release', pitchColor, store.state.timbres[previewColor].adsr);
      }
    }
    activePreviewPitches = [];

    // Stop dynamic waveform visualization when releasing note
    const staticWaveform = window.staticWaveformVisualizer;
    if (staticWaveform) {
      staticWaveform.stopLiveVisualization();
    }
  }

  if (activeNote?.uuid && placementFillNoteIds.has(activeNote.uuid)) {
    store.emit('noteRelease', { noteId: activeNote.uuid, color: activeNote.color });
    placementFillNoteIds.delete(activeNote.uuid);
  }

  activeChordNotes.forEach(note => {
    if (note?.uuid && placementFillNoteIds.has(note.uuid)) {
      store.emit('noteRelease', { noteId: note.uuid, color: note.color });
      placementFillNoteIds.delete(note.uuid);
    }
  });

  if (isDragging) {
    store.recordState();
  }
  isDragging = false;
  lastDragRow = null; // Reset drag row tracking

  // Emit interaction end events for animation service before clearing
  if (activeNote?.uuid) {
    store.emit('noteInteractionEnd', { noteId: activeNote.uuid });
  }
  activeChordNotes.forEach(note => {
    if (note.uuid) {
      store.emit('noteInteractionEnd', { noteId: note.uuid });
    }
  });

  activeNote = null;
  activeChordNotes = [];

  if (isEraserDragActive) {
    store.recordState(); // Record state after eraser drag operation
    isEraserDragActive = false;
  }

  if (isRightClickActive) {
    if (rightClickActionTaken) {store.recordState();}
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

/**
 * Finds the nearest measure boundary to a given click position
 * @param {number} clickX - Canvas x position of click
 * @returns {Object|null} Measure boundary info or null if none found
 */
function findNearestMeasureBoundary(clickX) {
  const { macrobeatBoundaryStyles } = store.state;
  const tolerance = 100; // pixels - increased for easier placement

  // Find all measure boundaries (solid boundaries)
  const boundaries = [];
  const hasModulation = store.state.modulationMarkers && store.state.modulationMarkers.length > 0;

  logger.debug('PitchGridInteractor', 'Boundary calculation modulation state', { hasModulation }, 'grid');

  for (let i = 0; i < macrobeatBoundaryStyles.length; i++) {
    if (macrobeatBoundaryStyles[i] === 'solid') {
      const measureInfo = getMacrobeatInfo(store.state, i);
      if (measureInfo) {
        // CANVAS-SPACE FIX: Always use rendererUtils.getColumnX()
        // measureInfo.endColumn is already in canvas-space (0 = first musical beat)
        const canvasSpaceColumn = measureInfo.endColumn + 1;
        const boundaryX = getColumnX(canvasSpaceColumn, {
          ...store.state,
          modulationMarkers: store.state.modulationMarkers || [],
          cellWidth: store.state.cellWidth,
          columnWidths: store.state.columnWidths,
          musicalColumnWidths: store.state.columnWidths,
          baseMicrobeatPx: store.state.cellWidth
        });

        logger.debug('PitchGridInteractor', 'Computed measure boundary', {
          boundaryIndex: i,
          endColumn: measureInfo.endColumn,
          calculatedX: boundaryX,
          method: 'canvas-space'
        }, 'grid');

        boundaries.push({
          measureIndex: i + 1, // Modulation starts after this measure
          xPosition: boundaryX,
          macrobeatIndex: i
        });
      }
    }
  }

  // Also include the start boundary (measure 0)
  // CANVAS-SPACE FIX: Always use rendererUtils.getColumnX() with canvas-space column 0
  const startBoundaryX = getColumnX(0, {
    ...store.state,
    modulationMarkers: store.state.modulationMarkers || [],
    cellWidth: store.state.cellWidth,
    columnWidths: store.state.columnWidths,
    musicalColumnWidths: store.state.columnWidths,
    baseMicrobeatPx: store.state.cellWidth
  });

  logger.debug('PitchGridInteractor', 'Start boundary position', {
    startBoundaryX,
    method: 'canvas-space'
  }, 'grid');
  boundaries.unshift({
    measureIndex: 0,
    xPosition: startBoundaryX,
    macrobeatIndex: -1
  });

  logger.debug('PitchGridInteractor', 'Available measure boundaries', { boundaries }, 'grid');
  logger.debug('PitchGridInteractor', 'Modulation click context', { clickX, tolerance }, 'grid');

  // Find the closest boundary within tolerance
  let closestBoundary = null;
  let closestDistance = Infinity;

  boundaries.forEach(boundary => {
    const distance = Math.abs(clickX - boundary.xPosition);
    logger.debug('PitchGridInteractor', 'Boundary distance check', {
      boundaryX: boundary.xPosition,
      distance
    }, 'grid');

    if (distance <= tolerance && distance < closestDistance) {
      closestDistance = distance;
      closestBoundary = boundary;
    }
  });

  if (closestBoundary) {
    logger.debug('PitchGridInteractor', 'Found closest boundary', {
      boundary: closestBoundary,
      distance: closestDistance
    }, 'grid');
  } else {
    logger.debug('PitchGridInteractor', 'No boundary found within tolerance', { tolerance }, 'grid');
  }

  return closestBoundary;
}

/**
 * Draws modulation placement preview (three solid lines)
 * @param {CanvasRenderingContext2D} ctx - Hover canvas context
 * @param {number} xPosition - X position of the measure boundary
 * @param {number} ratio - Modulation ratio
 */
function drawModulationPreview(ctx, xPosition, ratio) {
  if (!ratio) {return;}

  const color = getModulationColor(ratio);
  const displayText = getModulationDisplayText(ratio);

  ctx.save();

  // Draw three solid preview lines
  const lineSpacing = 3; // pixels between lines
  const lineWidth = 2;
  const canvasHeight = getLogicalCanvasHeight(ctx.canvas);

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = 0.7; // Semi-transparent preview
  ctx.setLineDash([]); // Solid lines

  for (let i = -1; i <= 1; i++) {
    const x = xPosition + (i * lineSpacing);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();
  }

  // Draw preview label
  ctx.globalAlpha = 0.8;
  ctx.font = '12px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.fillText(`Preview: ${displayText}`, xPosition, 10);

  ctx.restore();
}

export function initPitchGridInteraction() {
  const pitchCanvas = document.getElementById('notation-grid');
  const hoverCanvas = document.getElementById('hover-canvas');

  if (!pitchCanvas || !hoverCanvas) {
    logger.error('PitchGridInteractor', 'Could not find required canvas elements.', { hasPitchCanvas: Boolean(pitchCanvas), hasHoverCanvas: Boolean(hoverCanvas) }, 'grid');
    return;
  }
  pitchHoverCtx = hoverCanvas.getContext('2d');
  pitchCanvasElement = pitchCanvas;

  pitchCanvas.addEventListener('mousedown', handleMouseDown);
  pitchCanvas.addEventListener('mousemove', handleMouseMove);
  pitchCanvas.addEventListener('mouseleave', handleMouseLeave);
  pitchCanvas.addEventListener('contextmenu', e => e.preventDefault());

  pitchCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  pitchCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  pitchCanvas.addEventListener('touchend', handleTouchEnd, { passive: false });
  pitchCanvas.addEventListener('touchcancel', handleTouchCancel, { passive: false });
  window.addEventListener('mouseup', handleGlobalMouseUp);

}
