// js/services/printService.js
import store from '@state/index.js';
import logger from '@utils/logger.js';
import html2canvas from 'html2canvas';

let buttonGridSnapshot = null;
let buttonGridCapturePromise = null;

const IDLE_TIMEOUT_MS = 600;

/**
 * Captures the button grid visual state by converting DOM to canvas
 */
async function captureButtonGrid() {
  const buttonGrid = document.getElementById('button-grid');
  if (!buttonGrid) {
    logger.warn('PrintService', 'Button grid element not found', null, 'print');
    return null;
  }

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
  }
}

/**
 * Captures the pitch grid including all overlay canvases (paint, annotations, etc.)
 */
function capturePitchGrid() {
  const notationGrid = document.getElementById('notation-grid');
  const paintCanvas = document.getElementById('pitch-paint-canvas');
  const hoverCanvas = document.getElementById('hover-canvas');

  if (!notationGrid) {
    logger.warn('PrintService', 'Notation grid canvas not found', null, 'print');
    return null;
  }

  // Create composite canvas
  const canvas = document.createElement('canvas');
  canvas.width = notationGrid.width;
  canvas.height = notationGrid.height;
  const ctx = canvas.getContext('2d');

  // Draw notation grid (base layer)
  ctx.drawImage(notationGrid, 0, 0);

  // Draw paint layer if it exists and has content
  if (paintCanvas && paintCanvas.width > 0 && paintCanvas.height > 0) {
    ctx.drawImage(paintCanvas, 0, 0);
    logger.debug('PrintService', 'Included paint layer in capture', null, 'print');
  }

  // Note: hover canvas is typically for interaction, not printing
  // Annotations would be drawn here if they're on a separate canvas

  logger.debug('PrintService', `Captured pitch grid: ${canvas.width}x${canvas.height}`, null, 'print');
  return canvas;
}

/**
 * Captures the drum grid
 */
function captureDrumGrid() {
  const drumGrid = document.getElementById('drum-grid');
  if (!drumGrid || drumGrid.width === 0) {
    logger.debug('PrintService', 'Drum grid not found or empty', null, 'print');
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = drumGrid.width;
  canvas.height = drumGrid.height;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(drumGrid, 0, 0);

  logger.debug('PrintService', `Captured drum grid: ${canvas.width}x${canvas.height}`, null, 'print');
  return canvas;
}

/**
 * Applies black & white filter to a canvas
 */
function applyBlackWhiteFilter(sourceCanvas) {
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(sourceCanvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Convert to grayscale
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
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
async function generateScoreCanvas(printOptions, targetDimensions) {
  logger.debug('PrintService', 'Generating score canvas...', { printOptions, targetDimensions }, 'print');

  const capturedCanvases = [];

  // Capture button grid if included
  if (printOptions.includeButtonGrid) {
    const buttonCanvas = await ensureButtonGridSnapshot();
    if (buttonCanvas) {
      capturedCanvases.push({ canvas: buttonCanvas, name: 'buttons' });
    }
  }

  // Always capture pitch grid (main content)
  const pitchCanvas = capturePitchGrid();
  if (pitchCanvas) {
    capturedCanvases.push({ canvas: pitchCanvas, name: 'pitch' });
  }

  // Capture drum grid if included
  if (printOptions.includeDrums) {
    const drumCanvas = captureDrumGrid();
    if (drumCanvas) {
      capturedCanvases.push({ canvas: drumCanvas, name: 'drums' });
    }
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
  const ctx = finalCanvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

  // Create temporary full canvas
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = contentWidth;
  tempCanvas.height = totalContentHeight;
  const tempCtx = tempCanvas.getContext('2d');

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

  async generateAndPrint() {
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

    const stagingArea = document.getElementById('print-staging-area');
    stagingArea.innerHTML = '';

    const styleTag = document.getElementById('print-style-rules');
    styleTag.textContent = `@page { size: ${options.orientation}; margin: 0.25in; }`;

    const img = document.createElement('img');
    img.src = finalCanvas.toDataURL('image/png');
    img.style.width = '100%';
    img.style.height = 'auto';
    stagingArea.appendChild(img);

    logger.info('PrintService', 'Opening print dialog', null, 'print');
    setTimeout(() => window.print(), 100);
  },

  async prefetchButtonGridSnapshot() {
    try {
      await ensureButtonGridSnapshot();
    } catch (error) {
      logger.warn('PrintService', 'Button grid prefetch failed', error, 'print');
    }
  },

  invalidateButtonGridSnapshot() {
    invalidateButtonGridSnapshotInternal();
  }
};

export default PrintService;
function normalizeButtonGridCanvas(canvas) {
  if (!canvas) {
    return canvas;
  }
  const pitchCanvas = document.getElementById('notation-grid');
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
  ctx.drawImage(canvas, 0, 0, normalized.width, normalized.height);
  return normalized;
}

async function ensureButtonGridSnapshot() {
  if (buttonGridSnapshot) {
    return buttonGridSnapshot;
  }
  if (buttonGridCapturePromise) {
    return buttonGridCapturePromise;
  }

  buttonGridCapturePromise = (async () => {
    await waitForIdleFrame();
    const canvas = await captureButtonGrid();
    buttonGridSnapshot = canvas;
    buttonGridCapturePromise = null;
    return canvas;
  })().catch(error => {
    buttonGridCapturePromise = null;
    throw error;
  });

  return buttonGridCapturePromise;
}

function waitForIdleFrame() {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === 'function') {
      requestIdleCallback(resolve, { timeout: IDLE_TIMEOUT_MS });
    } else {
      requestAnimationFrame(() => resolve());
    }
  });
}

function invalidateButtonGridSnapshotInternal() {
  buttonGridSnapshot = null;
  buttonGridCapturePromise = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => invalidateButtonGridSnapshotInternal());
}
