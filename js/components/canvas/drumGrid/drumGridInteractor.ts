// js/components/canvas/drumGrid/drumGridInteractor.ts
import store from '@state/index.ts';
import GridCoordsService from '@services/gridCoordsService.ts';
import { drawDrumShape, type VolumeIconState } from './drumGridRenderer.ts';
import { BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR } from '../../../core/constants.js';
import { getColumnX as getModulatedColumnX } from '@components/canvas/PitchGrid/renderers/rendererUtils.ts';
import DrumPlayheadRenderer from './drumPlayheadRenderer.js';
import { getLogicalCanvasWidth, getLogicalCanvasHeight } from '@utils/canvasDimensions.ts';
import type { CanvasSpaceColumn } from '../../../../types/state.js';

/**
 * COORDINATE SYSTEM NOTE:
 * All column indices in this file use CANVAS-SPACE coordinates (0 = first musical beat).
 * GridCoordsService.getColumnIndex() returns canvas-space values.
 */

type DrumTrack = 'H' | 'M' | 'L';
const DRUM_TRACKS: DrumTrack[] = ['H', 'M', 'L'];
const CANVAS_CONTAINER_ID = 'canvas-container';
const DRUM_GRID_WRAPPER_ID = 'drum-grid-wrapper';
const ERASER_BUTTON_ID = 'eraser-tool-button';
const DRUM_CANVAS_ID = 'drum-grid';
const DRUM_HOVER_CANVAS_ID = 'drum-hover-canvas';

let drumHoverCtx: CanvasRenderingContext2D | null = null;
let isRightClickActive = false;
let rightClickActionTaken = false;
let drumVolume = 1.0;
let volumeSlider: HTMLInputElement | null = null;
let volumeIconState: VolumeIconState = 'normal';
let lastDrumPlaybackTime = 0;
const DRUM_PLAYBACK_THROTTLE_MS = 500;

const getColumnX = (index: number): number => {
  // CANVAS-SPACE FIX: Always use rendererUtils.getColumnX() with proper options
  // Ensure musicalColumnWidths is available for both modulated and unmodulated paths
  const options = {
    modulationMarkers: store.state.modulationMarkers || [],
    columnWidths: store.state.columnWidths,
    musicalColumnWidths: store.state.musicalColumnWidths || store.state.columnWidths.slice(2, -2),
    cellWidth: store.state.cellWidth,
    cellHeight: store.state.cellHeight,
    baseMicrobeatPx: (store.state as Partial<{ baseMicrobeatPx: number }>).baseMicrobeatPx ||
      store.state.cellWidth ||
      40
  };
  return getModulatedColumnX(index, options);
};

const getModulatedCellWidth = (colIndex: number): number => {
  const hasModulation = store.state.modulationMarkers && store.state.modulationMarkers.length > 0;
  if (hasModulation) {
    const currentX = getColumnX(colIndex);
    const nextX = getColumnX(colIndex + 1);
    return nextX - currentX;
  }
  // CANVAS-SPACE FIX: colIndex is canvas-space, so use musicalColumnWidths (not columnWidths)
  const musicalColumnWidths = store.state.musicalColumnWidths || store.state.columnWidths.slice(2, -2);
  const widthMultiplier = musicalColumnWidths[colIndex] ?? 1;
  return widthMultiplier * store.state.cellWidth;
};

const getDrumRowHeight = (): number =>
  Math.max(BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR * store.state.cellHeight);

const clearHover = (): void => {
  if (drumHoverCtx) {
    drumHoverCtx.clearRect(
      0,
      0,
      getLogicalCanvasWidth(drumHoverCtx.canvas),
      getLogicalCanvasHeight(drumHoverCtx.canvas)
    );
  }
};

function drawHoverHighlight(colIndex: number, rowIndex: number, color: string): void {
  if (!drumHoverCtx) {return;}
  const x = getColumnX(colIndex);
  const y = rowIndex * getDrumRowHeight();
  const cellWidth = getModulatedCellWidth(colIndex);
  drumHoverCtx.fillStyle = color;
  drumHoverCtx.fillRect(x, y, cellWidth, getDrumRowHeight());
}

function drawGhostNote(colIndex: number, rowIndex: number): void {
  if (!drumHoverCtx) {return;}
  const x = getColumnX(colIndex);
  const y = rowIndex * getDrumRowHeight();
  const cellWidth = getModulatedCellWidth(colIndex);
  const drumTrack = DRUM_TRACKS[rowIndex as 0 | 1 | 2];
  if (!drumTrack) {return;}
  const animationScale = DrumPlayheadRenderer.getAnimationScale(colIndex, drumTrack);

  const selectedColor = (store.state.selectedTool as { color?: string } | undefined)?.color ?? '#212529';
  drumHoverCtx.globalAlpha = 0.4;
  drumHoverCtx.fillStyle = selectedColor;
  drawDrumShape(drumHoverCtx, rowIndex, x, y, cellWidth, getDrumRowHeight(), animationScale);
  drumHoverCtx.globalAlpha = 1.0;
}

const getScrollLeft = (): number => {
  const container = document.getElementById(CANVAS_CONTAINER_ID);
  return container?.scrollLeft ?? 0;
};

function handleMouseMove(event: MouseEvent): void {
  const target = event.currentTarget as HTMLElement | null;
  if (!target) {return;}

  const rect = target.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  // CANVAS-SPACE FIX: Volume icon is in the legend area (.drum-grid-left-cell),
  // not on the musical canvas. Canvas x=0 is the first musical beat.
  // Remove volume icon checks from canvas mouse handlers.

  const colIndex = GridCoordsService.getColumnIndex(x + getScrollLeft());
  const rowIndex = GridCoordsService.getDrumRowIndex(y);

  // CANVAS-SPACE FIX: Use canvas-space boundary checks (0 = first musical beat)
  const maxColumn = store.state.musicalColumnWidths?.length || store.state.columnWidths.length - 4;
  if (
    !drumHoverCtx ||
    colIndex < 0 ||
    colIndex >= maxColumn ||
    rowIndex < 0 ||
    rowIndex > 2
  ) {
    handleMouseLeave();
    return;
  }

  clearHover();
  const drumTrack = DRUM_TRACKS[rowIndex as 0 | 1 | 2];
  if (!drumTrack) {return;}

  if (isRightClickActive) {
    if ((store as any).eraseDrumNoteAt?.(colIndex, drumTrack, false)) {
      rightClickActionTaken = true;
    }
    drawHoverHighlight(colIndex, rowIndex, 'rgba(220, 53, 69, 0.3)');
  } else {
    drawHoverHighlight(colIndex, rowIndex, 'rgba(74, 144, 226, 0.2)');
    drawGhostNote(colIndex, rowIndex);
  }
}

function handleMouseLeave(): void {
  clearHover();
  // Volume icon state is handled by the legend button element, not the canvas
}

function handleMouseDown(event: MouseEvent): void {
  event.preventDefault();
  const target = event.currentTarget as HTMLElement | null;
  if (!target) {return;}

  const rect = target.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  // CANVAS-SPACE FIX: Volume icon is in the legend area (.drum-grid-left-cell),
  // not on the musical canvas. Canvas x=0 is the first musical beat.
  // Volume icon clicks are handled by the legend button element, not here.

  const colIndex = GridCoordsService.getColumnIndex(x + getScrollLeft());
  // CANVAS-SPACE FIX: Use canvas-space boundary checks (0 = first musical beat)
  const maxColumn = store.state.musicalColumnWidths?.length || store.state.columnWidths.length - 4;
  if (colIndex < 0 || colIndex >= maxColumn) {return;}

  const drumRow = GridCoordsService.getDrumRowIndex(y);
  if (drumRow < 0 || drumRow > 2) {return;}

  const drumTrack = DRUM_TRACKS[drumRow as 0 | 1 | 2];
  if (!drumTrack) {return;}

  if (event.button === 2) {
    isRightClickActive = true;
    rightClickActionTaken = false;
    document.getElementById(ERASER_BUTTON_ID)?.classList.add('erasing-active');

    if ((store as any).eraseDrumNoteAt?.(colIndex, drumTrack, false)) {
      rightClickActionTaken = true;
    }
    clearHover();
    drawHoverHighlight(colIndex, drumRow, 'rgba(220, 53, 69, 0.3)');
    return;
  }

  if (event.button === 0) {
    const color = (store.state.selectedTool as { color?: string } | undefined)?.color ?? '#000000';
    const drumHit = {
      isDrum: true,
      drumTrack,
      startColumnIndex: colIndex,
      endColumnIndex: colIndex,
      color,
      shape: drumTrack === 'H' ? 'triangle' : drumTrack === 'M' ? 'square' : 'pentagon'
    };
    (store as any).toggleDrumNote?.(drumHit);

    const transportService = (window as any).transportService;
    const drumPlayers = transportService?.drumPlayers;
    if (drumPlayers?.player) {
      drumPlayers.player(drumTrack).start();
      DrumPlayheadRenderer.triggerNotePop(colIndex, drumTrack);
    }
  }
}

function handleGlobalMouseUp(): void {
  if (isRightClickActive) {
    if (rightClickActionTaken) {
      store.recordState?.();
    }
    isRightClickActive = false;
    rightClickActionTaken = false;
    document.getElementById(ERASER_BUTTON_ID)?.classList.remove('erasing-active');
  }

  // Volume icon state is handled by the legend button element, not the canvas

  handleMouseLeave();
}

function createVolumeSlider(): void {
  const drumWrapper = document.getElementById(DRUM_GRID_WRAPPER_ID);
  const leftCell = drumWrapper?.querySelector('.drum-grid-left-cell') as HTMLElement | null;

  if (!drumWrapper || !leftCell) {return;}

  // Build left-cell content (volume button + row labels) if missing
  let leftContent = leftCell.querySelector('.drum-left-content') as HTMLElement | null;
  if (!leftContent) {
    leftContent = document.createElement('div');
    leftContent.className = 'drum-left-content';

    const volumeButton = document.createElement('button');
    volumeButton.className = 'drum-volume-button';
    volumeButton.type = 'button';
    volumeButton.setAttribute('aria-label', 'Drum volume');
    volumeButton.innerHTML = `
      <span class="drum-volume-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false" role="img">
          <path d="M3 10v4h4l5 5V5L7 10H3z" fill="currentColor"></path>
          <path d="M16 8.82v6.36c1.18-.85 2-2.22 2-3.64s-.82-2.79-2-3.64z" fill="currentColor"></path>
          <path d="M16 4v2c2.9 1.06 5 3.86 5 7s-2.1 5.94-5 7v2c4.01-1.15 7-4.97 7-9s-2.99-7.85-7-9z" fill="currentColor"></path>
        </svg>
      </span>
    `;
    volumeButton.style.gridRow = '1 / span 3';
    volumeButton.style.gridColumn = '1';

    ['H', 'M', 'L'].forEach((label, index) => {
      const item = document.createElement('span');
      item.className = 'drum-track-label';
      item.textContent = label;
      item.style.gridColumn = '2';
      item.style.gridRow = `${index + 1}`;
      leftContent.appendChild(item);
    });

    leftContent.appendChild(volumeButton);
    leftCell.appendChild(leftContent);
  }

  const volumeControl = document.createElement('div');
  volumeControl.className = 'drum-volume-control';

  volumeSlider = document.createElement('input');
  volumeSlider.type = 'range';
  volumeSlider.min = '0';
  volumeSlider.max = '100';
  volumeSlider.value = '100';
  volumeSlider.className = 'drum-volume-slider';
  volumeSlider.style.cssText = 'width: 80px; margin: 0;';

  volumeSlider.addEventListener('input', (event) => {
    const target = event.currentTarget as HTMLInputElement;
    drumVolume = Number(target.value) / 100;

    const drumVolumeNode = (window as any).drumVolumeNode;
    if (drumVolumeNode?.volume) {
      const volumeDb = drumVolume === 0 ? -60 : 20 * Math.log10(drumVolume);
      drumVolumeNode.volume.value = volumeDb;

      const transportService = (window as any).transportService;
      const drumPlayers = transportService?.drumPlayers;
      const now = Date.now();
      if (drumPlayers?.player && now - lastDrumPlaybackTime >= DRUM_PLAYBACK_THROTTLE_MS) {
        drumPlayers.player('M').start('+0.1');
        lastDrumPlaybackTime = now;
      }
    }
  });

  volumeControl.appendChild(volumeSlider);
  leftCell.appendChild(volumeControl);

  const toggleVolume = () => {
    if (!volumeControl) {return;}
    const isVisible = volumeControl.classList.contains('visible');
    if (isVisible) {
      volumeControl.classList.remove('visible');
    } else {
      volumeControl.classList.add('visible');
    }
  };

  const volumeButton = leftCell.querySelector('.drum-volume-button');
  if (volumeButton) {
    volumeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleVolume();
    });
  }

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const clickedInsideControl = target?.closest('.drum-volume-control');
    const clickedButton = target?.closest('.drum-volume-button');
    if (!clickedInsideControl && !clickedButton) {
      volumeControl.classList.remove('visible');
    }
  });
}

export function getDrumVolume(): number {
  return drumVolume;
}

export function getVolumeIconState(): VolumeIconState {
  return volumeIconState;
}

(window as any).getDrumVolume = getDrumVolume;

export function initDrumGridInteraction(): void {
  const drumCanvas = document.getElementById(DRUM_CANVAS_ID) as HTMLCanvasElement | null;
  const hoverCanvas = document.getElementById(DRUM_HOVER_CANVAS_ID) as HTMLCanvasElement | null;

  if (!drumCanvas || !hoverCanvas) {
    return;
  }

  drumHoverCtx = hoverCanvas.getContext('2d');

  drumCanvas.addEventListener('mousedown', handleMouseDown);
  drumCanvas.addEventListener('mousemove', handleMouseMove);
  drumCanvas.addEventListener('mouseleave', handleMouseLeave);
  drumCanvas.addEventListener('contextmenu', event => event.preventDefault());

  window.addEventListener('mouseup', handleGlobalMouseUp);

  createVolumeSlider();
}
