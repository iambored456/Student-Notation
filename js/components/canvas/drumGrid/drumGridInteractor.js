// js/components/canvas/drumGrid/drumGridInteractor.js
import store from '@state/index.js';
import GridCoordsService from '@services/gridCoordsService.js';
import LayoutService from '@services/layoutService.js';
import { drawDrumShape } from './drumGridRenderer.js';
import { BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR } from '../../../core/constants.js';
import { getColumnX as getModulatedColumnX } from '@components/canvas/pitchGrid/renderers/rendererUtils.js';
import DrumPlayheadRenderer from './drumPlayheadRenderer.js';
import { getLogicalCanvasWidth, getLogicalCanvasHeight } from '@utils/canvasDimensions.js';

// --- Interaction State ---
let drumHoverCtx;
let isRightClickActive = false;
let rightClickActionTaken = false;

// --- Drum Volume Control ---
let drumVolume = 1.0; // Default 100%
let volumeSlider = null;
let volumeIconState = 'normal'; // Track volume icon state: normal, hover, active
let lastDrumPlaybackTime = 0; // Track last playback time for throttling
const DRUM_PLAYBACK_THROTTLE = 500; // 0.5 seconds throttle

// --- Helper Functions ---
function getColumnX(index) {
  // Use modulation-aware column positions if modulation exists
  const hasModulation = store.state.modulationMarkers && store.state.modulationMarkers.length > 0;

  if (hasModulation) {
    const options = {
      modulationMarkers: store.state.modulationMarkers,
      columnWidths: store.state.columnWidths,
      cellWidth: store.state.cellWidth,
      baseMicrobeatPx: store.state.baseMicrobeatPx || store.state.cellWidth || 40
    };
    return getModulatedColumnX(index, options);
  } else {
    return LayoutService.getColumnX(index);
  }
}

function getModulatedCellWidth(colIndex) {
  // Calculate modulated cell width if modulation is present
  const hasModulation = store.state.modulationMarkers && store.state.modulationMarkers.length > 0;

  if (hasModulation) {
    const currentX = getColumnX(colIndex);
    const nextX = getColumnX(colIndex + 1);
    const modulatedWidth = nextX - currentX;
    return modulatedWidth;
  } else {
    const regularWidth = store.state.columnWidths[colIndex] * store.state.cellWidth;
    return regularWidth;
  }
}

// --- Hover Drawing Logic ---
function drawHoverHighlight(colIndex, rowIndex, color) {
  if (!drumHoverCtx) {return;}
  const x = getColumnX(colIndex); // Use modulation-aware position
  // FIXED: Use same drum row height calculation as renderer and grid coords
  const drumRowHeight = Math.max(BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR * store.state.cellHeight);
  const y = rowIndex * drumRowHeight;
  const cellWidth = getModulatedCellWidth(colIndex); // Use modulated cell width
  drumHoverCtx.fillStyle = color;
  drumHoverCtx.fillRect(x, y, cellWidth, drumRowHeight);
}

function drawGhostNote(colIndex, rowIndex) {
  if (!drumHoverCtx) {return;}
  const x = getColumnX(colIndex); // Use modulation-aware position
  // FIXED: Use same drum row height calculation as renderer and grid coords
  const drumRowHeight = Math.max(BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR * store.state.cellHeight);
  const y = rowIndex * drumRowHeight;
  const cellWidth = getModulatedCellWidth(colIndex); // Use modulated cell width
  const drumTrack = ['H', 'M', 'L'][rowIndex];
  const animationScale = DrumPlayheadRenderer.getAnimationScale(colIndex, drumTrack);

  drumHoverCtx.globalAlpha = 0.4;
  drumHoverCtx.fillStyle = store.state.selectedTool.color || '#212529';
  drawDrumShape(drumHoverCtx, rowIndex, x, y, cellWidth, drumRowHeight, animationScale);
  drumHoverCtx.globalAlpha = 1.0;
}

// --- Event Handlers ---
function handleMouseMove(e) {
  const rect = e.target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Check if mouse is over volume icon area (left legend column)
  const volumeIconArea = getColumnX(2);
  const isHoveringVolumeIcon = x < volumeIconArea;

  // Update volume icon state and trigger redraw if needed
  const previousState = volumeIconState;
  volumeIconState = isHoveringVolumeIcon ? 'hover' : 'normal';

  if (previousState !== volumeIconState) {
    // Trigger drum grid redraw to update icon appearance
    if (window.drumGridRenderer) {
      window.drumGridRenderer.render();
    }
  }

  // Don't process drum grid interactions if hovering over volume icon
  if (isHoveringVolumeIcon) {
    if (drumHoverCtx) {
      drumHoverCtx.clearRect(0, 0, getLogicalCanvasWidth(drumHoverCtx.canvas), getLogicalCanvasHeight(drumHoverCtx.canvas));
    }
    return;
  }

  // Account for horizontal scroll position like harmony analysis grid does
  const scrollLeft = document.getElementById('canvas-container').scrollLeft;
  const colIndex = GridCoordsService.getColumnIndex(x + scrollLeft);
  const rowIndex = GridCoordsService.getDrumRowIndex(y);


  if (!drumHoverCtx || colIndex < 2 || colIndex >= store.state.columnWidths.length - 2 || rowIndex < 0 || rowIndex > 2) {
    handleMouseLeave();
    return;
  }

  drumHoverCtx.clearRect(0, 0, getLogicalCanvasWidth(drumHoverCtx.canvas), getLogicalCanvasHeight(drumHoverCtx.canvas));
  const drumTrack = ['H', 'M', 'L'][rowIndex];

  if (isRightClickActive) {
    if (store.eraseDrumNoteAt(colIndex, drumTrack, false)) {
      rightClickActionTaken = true;
    }
    drawHoverHighlight(colIndex, rowIndex, 'rgba(220, 53, 69, 0.3)');
  } else {
    drawHoverHighlight(colIndex, rowIndex, 'rgba(74, 144, 226, 0.2)');
    drawGhostNote(colIndex, rowIndex);
  }
}

function handleMouseLeave() {
  if (drumHoverCtx) {
    drumHoverCtx.clearRect(0, 0, getLogicalCanvasWidth(drumHoverCtx.canvas), getLogicalCanvasHeight(drumHoverCtx.canvas));
  }

  // Reset volume icon state when mouse leaves drum grid
  if (volumeIconState !== 'normal') {
    volumeIconState = 'normal';
    if (window.drumGridRenderer) {
      window.drumGridRenderer.render();
    }
  }
}

function handleMouseDown(e) {
  e.preventDefault();
  const rect = e.target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Check if click is in volume icon area (left legend column)
  const volumeIconArea = getColumnX(2); // Volume icon is before column 2
  if (x < volumeIconArea) {
    // Set active state and trigger redraw
    volumeIconState = 'active';
    if (window.drumGridRenderer) {
      window.drumGridRenderer.render();
    }

    // Toggle volume slider visibility
    const volumeControl = document.querySelector('.drum-volume-control');
    if (volumeControl) {
      const isVisible = volumeControl.style.display === 'flex';
      volumeControl.style.display = isVisible ? 'none' : 'flex';
    }
    return; // Don't process as drum grid interaction
  }

  // Account for horizontal scroll position like harmony analysis grid does
  const scrollLeft = document.getElementById('canvas-container').scrollLeft;
  const colIndex = GridCoordsService.getColumnIndex(x + scrollLeft);
  if (colIndex < 2 || colIndex >= store.state.columnWidths.length - 2) {return;}

  const drumRow = GridCoordsService.getDrumRowIndex(y);
  if (drumRow < 0 || drumRow > 2) {return;}

  const drumTrack = ['H', 'M', 'L'][drumRow];

  if (e.button === 2) { // Right-click for erasing
    isRightClickActive = true;
    rightClickActionTaken = false;
    document.getElementById('eraser-tool-button')?.classList.add('erasing-active');

    if (store.eraseDrumNoteAt(colIndex, drumTrack, false)) {
      rightClickActionTaken = true;
    }
    drumHoverCtx.clearRect(0, 0, getLogicalCanvasWidth(drumHoverCtx.canvas), getLogicalCanvasHeight(drumHoverCtx.canvas));
    drawHoverHighlight(colIndex, drumRow, 'rgba(220, 53, 69, 0.3)');
    return;
  }

  if (e.button === 0) { // Left-click for placing/toggling
    const { color } = store.state.selectedTool;
    const drumHit = {
      isDrum: true,
      drumTrack: drumTrack,
      startColumnIndex: colIndex,
      endColumnIndex: colIndex,
      color: color || '#000000',
      shape: drumTrack === 'H' ? 'triangle' : drumTrack === 'M' ? 'square' : 'pentagon'
    };
    store.toggleDrumNote(drumHit);

    if (window.transportService && window.transportService.drumPlayers) {
      window.transportService.drumPlayers.player(drumTrack).start();

      // Trigger drum note pop animation for immediate feedback
      DrumPlayheadRenderer.triggerNotePop(colIndex, drumTrack);
    }
  }
}

function handleGlobalMouseUp() {
  if (isRightClickActive) {
    if (rightClickActionTaken) {
      store.recordState();
    }
    isRightClickActive = false;
    rightClickActionTaken = false;
    document.getElementById('eraser-tool-button')?.classList.remove('erasing-active');
  }

  // Reset volume icon active state on mouse up
  if (volumeIconState === 'active') {
    volumeIconState = 'normal';
    if (window.drumGridRenderer) {
      window.drumGridRenderer.render();
    }
  }

  handleMouseLeave();
}

// --- Volume Control Functions ---
function createVolumeSlider() {
  const drumWrapper = document.getElementById('drum-grid-wrapper');
  if (!drumWrapper) {return;}

  // Create volume control container
  const volumeControl = document.createElement('div');
  volumeControl.className = 'drum-volume-control';
  volumeControl.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 8px;
        display: none;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        z-index: 10;
    `;

  // Create slider
  volumeSlider = document.createElement('input');
  volumeSlider.type = 'range';
  volumeSlider.min = '0';
  volumeSlider.max = '100';
  volumeSlider.value = '100';
  volumeSlider.className = 'drum-volume-slider';
  volumeSlider.style.cssText = 'width: 80px; margin: 0;';

  // Add event listener
  volumeSlider.addEventListener('input', (e) => {
    drumVolume = e.target.value / 100;

    // Update actual drum volume in transport service
    if (window.drumVolumeNode) {
      // Convert linear scale to decibels: 0% = -60dB, 100% = 0dB
      const volumeDb = drumVolume === 0 ? -60 : 20 * Math.log10(drumVolume);
      window.drumVolumeNode.volume.value = volumeDb;

      // Test drum sound with throttling (max once every 0.5 seconds)
      const currentTime = Date.now();
      if (window.transportService && window.transportService.drumPlayers &&
                currentTime - lastDrumPlaybackTime >= DRUM_PLAYBACK_THROTTLE) {
        window.transportService.drumPlayers.player('M').start('+0.1');
        lastDrumPlaybackTime = currentTime;
      }
    }
  });

  // Only add the slider, no label
  volumeControl.appendChild(volumeSlider);
  drumWrapper.appendChild(volumeControl);

  // Add hover functionality to show/hide slider when hovering over volume icon area
  const showSlider = () => {
    volumeControl.style.display = 'flex';
  };

  const hideSlider = () => {
    volumeControl.style.display = 'none';
  };

  // Show slider when hovering over the left side of drum grid (volume icon area)
  drumWrapper.addEventListener('mouseenter', (e) => {
    const rect = drumWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < 60) { // Left 60px area contains volume icon
      showSlider();
    }
  });

  volumeControl.addEventListener('mouseenter', showSlider);
  volumeControl.addEventListener('mouseleave', hideSlider);
  drumWrapper.addEventListener('mouseleave', hideSlider);
}

export function getDrumVolume() {
  return drumVolume;
}

export function getVolumeIconState() {
  return volumeIconState;
}

// Make it globally accessible
window.getDrumVolume = getDrumVolume;

// --- Public Interface ---
export function initDrumGridInteraction() {
  const drumCanvas = document.getElementById('drum-grid');
  const hoverCanvas = document.getElementById('drum-hover-canvas');

  if (!drumCanvas || !hoverCanvas) {
    return;
  }
  drumHoverCtx = hoverCanvas.getContext('2d');

  drumCanvas.addEventListener('mousedown', handleMouseDown);
  drumCanvas.addEventListener('mousemove', handleMouseMove);
  drumCanvas.addEventListener('mouseleave', handleMouseLeave);
  drumCanvas.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('mouseup', handleGlobalMouseUp);

  // Create volume slider
  createVolumeSlider();
}
