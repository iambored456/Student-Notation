// js/services/printService.ts
import store from '@state/index.ts';
import logger from '@utils/logger.ts';
import html2canvas from 'html2canvas';
import type { PrintOptions } from '../../types/state.js';

type SnapshotKey = `${boolean}-${boolean}`;
const buttonGridSnapshots: Partial<Record<SnapshotKey, HTMLCanvasElement | null>> = {};
const buttonGridCapturePromises: Partial<Record<SnapshotKey, Promise<HTMLCanvasElement | null> | null>> = {};

const IDLE_TIMEOUT_MS = 600;

interface CapturedCanvas {
  canvas: HTMLCanvasElement;
  name: string;
}

interface TargetDimensions {
  width: number;
  height: number;
}

/**
 * Captures the button grid visual state by converting DOM to canvas
 */
async function captureButtonGrid(includeLeftLegend: boolean, includeRightLegend: boolean): Promise<HTMLCanvasElement | null> {
  const buttonGrid = document.getElementById('button-grid');
  if (!buttonGrid) {
    logger.warn('PrintService', 'Button grid element not found', null, 'print');
    return null;
  }

  const leftCell = buttonGrid.querySelector('.button-grid-left-cell') as HTMLElement | null;
  const rightCell = buttonGrid.querySelector('.button-grid-right-cell') as HTMLElement | null;
  const originalDisplays: { el: HTMLElement; display: string }[] = [];

  const hideCell = (cell: HTMLElement | null, shouldHide: boolean) => {
    if (!cell || !shouldHide) {return;}
    originalDisplays.push({ el: cell, display: cell.style.display });
    cell.style.display = 'none';
  };

  hideCell(leftCell, !includeLeftLegend);
  hideCell(rightCell, !includeRightLegend);

  try {
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const rawCanvas = await html2canvas(buttonGrid, {
      scale: scale,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true
    });
    const normalizedCanvas = normalizeButtonGridCanvas(rawCanvas);
    logger.debug('PrintService', `Captured button grid: ${normalizedCanvas.width}x${normalizedCanvas.height}`, null, 'print');
    return normalizedCanvas;
  } catch (error) {
    logger.error('PrintService', 'Failed to capture button grid', error, 'print');
    return null;
  } finally {
    originalDisplays.forEach(({ el, display }) => {
      el.style.display = display;
    });
  }
}

/**
 * Captures the pitch grid including overlay canvases (annotations, etc.)
 */
function capturePitchGrid(includeLeftLegend: boolean, includeRightLegend: boolean): HTMLCanvasElement | null {
  const notationGrid = document.getElementById('notation-grid') as HTMLCanvasElement | null;
  const leftLegend = document.getElementById('legend-left-canvas') as HTMLCanvasElement | null;
  const rightLegend = document.getElementById('legend-right-canvas') as HTMLCanvasElement | null;

  if (!notationGrid) {
    logger.warn('PrintService', 'Notation grid canvas not found', null, 'print');
    return null;
  }

  const leftWidth = includeLeftLegend && leftLegend ? leftLegend.width : 0;
  const rightWidth = includeRightLegend && rightLegend ? rightLegend.width : 0;
  const totalWidth = leftWidth + notationGrid.width + rightWidth;
  const offsetX = leftWidth;

  // Create composite canvas
  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = notationGrid.height;
  const ctx = canvas.getContext('2d')!;

  if (includeLeftLegend && leftLegend && leftWidth > 0) {
    ctx.drawImage(leftLegend, 0, 0);
  }

  // Draw notation grid (base layer)
  ctx.drawImage(notationGrid, offsetX, 0);

  if (includeRightLegend && rightLegend && rightWidth > 0) {
    ctx.drawImage(rightLegend, offsetX + notationGrid.width, 0);
  }

  // Note: hover canvas is typically for interaction, not printing
  // Annotations would be drawn here if they're on a separate canvas

  logger.debug('PrintService', `Captured pitch grid: ${canvas.width}x${canvas.height}`, null, 'print');
  return canvas;
}

/**
 * Captures the drum grid
 */
function captureDrumGrid(includeLeftLegend: boolean, includeRightLegend: boolean): HTMLCanvasElement | null {
  const drumGrid = document.getElementById('drum-grid') as HTMLCanvasElement | null;
  const leftCell = document.querySelector('.drum-grid-left-cell') as HTMLElement | null;
  const rightCell = document.querySelector('.drum-grid-right-cell') as HTMLElement | null;

  if (!drumGrid || drumGrid.width === 0) {
    logger.debug('PrintService', 'Drum grid not found or empty', null, 'print');
    return null;
  }

  const scale = drumGrid.offsetWidth ? (drumGrid.width / drumGrid.offsetWidth) : 1;
  const leftWidth = includeLeftLegend ? Math.max(0, Math.round((leftCell?.offsetWidth || 0) * scale)) : 0;
  const rightWidth = includeRightLegend ? Math.max(0, Math.round((rightCell?.offsetWidth || 0) * scale)) : 0;
  const totalWidth = leftWidth + drumGrid.width + rightWidth;

  const surfaceColor = getComputedStyle(document.documentElement).getPropertyValue('--c-surface') || '#ffffff';

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = drumGrid.height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = surfaceColor.trim() || '#ffffff';
  ctx.fillRect(0, 0, totalWidth, drumGrid.height);

  ctx.drawImage(drumGrid, leftWidth, 0);

  logger.debug('PrintService', `Captured drum grid: ${canvas.width}x${canvas.height}`, null, 'print');
  return canvas;
}

/**
 * Applies black & white filter to a canvas
 */
function applyBlackWhiteFilter(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(sourceCanvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Convert to grayscale
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
    data[i] = gray;     // red
    data[i + 1] = gray; // green
    data[i + 2] = gray; // blue
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Generates a composite canvas of the entire score based on print options
 */
async function generateScoreCanvas(printOptions: PrintOptions, targetDimensions: TargetDimensions): Promise<HTMLCanvasElement | null> {
  logger.debug('PrintService', 'Generating score canvas...', { printOptions, targetDimensions }, 'print');

  const capturedCanvases: CapturedCanvas[] = [];

  // Always capture the button grid
  const buttonCanvas = await ensureButtonGridSnapshot(printOptions.includeLeftLegend, printOptions.includeRightLegend);
  if (buttonCanvas) {
    capturedCanvases.push({ canvas: buttonCanvas, name: 'buttons' });
  }

  // Always capture pitch grid (main content)
  const pitchCanvas = capturePitchGrid(printOptions.includeLeftLegend, printOptions.includeRightLegend);
  if (pitchCanvas) {
    capturedCanvases.push({ canvas: pitchCanvas, name: 'pitch' });
  }

  // Always capture drum grid
  const drumCanvas = captureDrumGrid(printOptions.includeLeftLegend, printOptions.includeRightLegend);
  if (drumCanvas) {
    capturedCanvases.push({ canvas: drumCanvas, name: 'drums' });
  }

  if (capturedCanvases.length === 0) {
    logger.warn('PrintService', 'No content captured for printing', null, 'print');
    return null;
  }

  // Apply B&W filter if needed
  if (printOptions.colorMode === 'bw') {
    capturedCanvases.forEach(item => {
      item.canvas = applyBlackWhiteFilter(item.canvas);
    });
    logger.debug('PrintService', 'Applied black & white filter', null, 'print');
  }

  // Calculate dimensions
  const contentWidth = Math.max(...capturedCanvases.map(item => item.canvas.width));
  const totalContentHeight = capturedCanvases.reduce((sum, item) => sum + item.canvas.height, 0);

  // Apply crop boundaries
  const cropTop = printOptions.cropTop || 0;
  const cropBottom = printOptions.cropBottom || 1.0;
  const cropLeft = printOptions.cropLeft || 0;
  const cropRight = printOptions.cropRight || 1.0;

  const croppedHeight = totalContentHeight * (cropBottom - cropTop);
  const croppedWidth = contentWidth * (cropRight - cropLeft);
  const cropStartY = totalContentHeight * cropTop;
  const cropStartX = contentWidth * cropLeft;

  logger.debug('PrintService', `Applying crop: top=${cropTop.toFixed(2)}, bottom=${cropBottom.toFixed(2)}, left=${cropLeft.toFixed(2)}, right=${cropRight.toFixed(2)}`, null, 'print');

  // Calculate scale to fit in target dimensions
  const scale = Math.min(
    targetDimensions.width / croppedWidth,
    targetDimensions.height / croppedHeight
  );

  // Create final composite canvas
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = croppedWidth * scale;
  finalCanvas.height = croppedHeight * scale;
  const ctx = finalCanvas.getContext('2d')!;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

  // Create temporary full canvas
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = contentWidth;
  tempCanvas.height = totalContentHeight;
  const tempCtx = tempCanvas.getContext('2d')!;

  // Stack all canvases vertically on temp canvas
  let currentY = 0;
  capturedCanvases.forEach(({ canvas, name }) => {
    tempCtx.drawImage(canvas, 0, currentY);
    logger.debug('PrintService', `Drew ${name} at y=${currentY}, height=${canvas.height}`, null, 'print');
    currentY += canvas.height;
  });

  // Draw cropped region onto final canvas
  ctx.drawImage(
    tempCanvas,
    cropStartX, cropStartY, croppedWidth, croppedHeight,  // Source crop
    0, 0, finalCanvas.width, finalCanvas.height  // Destination scaled
  );

  logger.debug('PrintService', `Generated composite canvas: ${finalCanvas.width}x${finalCanvas.height}`, null, 'print');
  return finalCanvas;
}

const PrintService = {
  generateScoreCanvas,

  async generateAndPrint(): Promise<void> {
    const options = store.state.printOptions;
    const DPI = 300;
    const PRINT_WIDTH = (options.orientation === 'landscape' ? 10.5 : 8) * DPI;
    const PRINT_HEIGHT = (options.orientation === 'landscape' ? 8 : 10.5) * DPI;

    logger.info('PrintService', 'Generating print canvas at high resolution', {
      width: PRINT_WIDTH,
      height: PRINT_HEIGHT,
      options
    }, 'print');

    const finalCanvas = await this.generateScoreCanvas(options, { width: PRINT_WIDTH, height: PRINT_HEIGHT });

    if (!finalCanvas) {
      logger.error('PrintService', 'Failed to generate print canvas', null, 'print');
      return;
    }

    const stagingArea = document.getElementById('print-staging-area')!;
    stagingArea.innerHTML = '';

    const styleTag = document.getElementById('print-style-rules')!;
    styleTag.textContent = `@page { size: ${options.orientation}; margin: 0.25in; }`;

    const img = document.createElement('img');
    img.src = finalCanvas.toDataURL('image/png');
    img.style.width = '100%';
    img.style.height = 'auto';
    stagingArea.appendChild(img);

    logger.info('PrintService', 'Opening print dialog', null, 'print');
    setTimeout(() => window.print(), 100);
  },

  async prefetchButtonGridSnapshot(includeLeftLegend = true, includeRightLegend = true): Promise<void> {
    try {
      await ensureButtonGridSnapshot(includeLeftLegend, includeRightLegend);
    } catch (error) {
      logger.warn('PrintService', 'Button grid prefetch failed', error, 'print');
    }
  },

  invalidateButtonGridSnapshot(): void {
    invalidateButtonGridSnapshotInternal();
  }
};

export default PrintService;

function normalizeButtonGridCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  if (!canvas) {
    return canvas;
  }
  const pitchCanvas = document.getElementById('notation-grid') as HTMLCanvasElement | null;
  const targetWidth = pitchCanvas?.width || canvas.width;
  if (!targetWidth || targetWidth === canvas.width) {
    return canvas;
  }
  const widthScale = targetWidth / canvas.width;
  const targetHeight = Math.max(1, Math.round(canvas.height * widthScale));
  const normalized = document.createElement('canvas');
  normalized.width = targetWidth;
  normalized.height = targetHeight;
  const ctx = normalized.getContext('2d', { willReadFrequently: true }) || normalized.getContext('2d');
  ctx!.drawImage(canvas, 0, 0, normalized.width, normalized.height);
  return normalized;
}

async function ensureButtonGridSnapshot(includeLeftLegend: boolean, includeRightLegend: boolean): Promise<HTMLCanvasElement | null> {
  const key: SnapshotKey = `${includeLeftLegend}-${includeRightLegend}`;
  if (buttonGridSnapshots[key] !== undefined) {
    return buttonGridSnapshots[key] ?? null;
  }
  if (buttonGridCapturePromises[key]) {
    return buttonGridCapturePromises[key]!;
  }

  buttonGridCapturePromises[key] = (async () => {
    await waitForIdleFrame();
    const canvas = await captureButtonGrid(includeLeftLegend, includeRightLegend);
    buttonGridSnapshots[key] = canvas;
    buttonGridCapturePromises[key] = null;
    return canvas;
  })().catch(error => {
    buttonGridCapturePromises[key] = null;
    throw error;
  });

  return buttonGridCapturePromises[key]!;
}

function waitForIdleFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: IDLE_TIMEOUT_MS });
    } else {
      requestAnimationFrame(() => resolve());
    }
  });
}

function invalidateButtonGridSnapshotInternal(): void {
  Object.keys(buttonGridSnapshots).forEach(k => {
    delete buttonGridSnapshots[k as SnapshotKey];
  });
  Object.keys(buttonGridCapturePromises).forEach(k => {
    delete buttonGridCapturePromises[k as SnapshotKey];
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => invalidateButtonGridSnapshotInternal());
}
