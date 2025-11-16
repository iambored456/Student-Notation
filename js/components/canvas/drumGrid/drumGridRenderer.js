// js/components/canvas/drumGrid/drumGridRenderer.js
import { BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR } from '../../../core/constants.js';
import { shouldDrawVerticalLineAtColumn, isTonicColumn } from '../../../utils/tonicColumnUtils.js';

import LayoutService from '../../../services/layoutService.js';
import { getColumnX as getModulatedColumnX } from '@components/canvas/pitchGrid/renderers/rendererUtils.js';
import { renderModulationMarkers } from '@components/canvas/pitchGrid/renderers/modulationRenderer.js';
import DrumPlayheadRenderer from './drumPlayheadRenderer.js';
import { getIconPath } from '@utils/assetPaths.js';
import { getLogicalCanvasWidth, getLogicalCanvasHeight } from '@utils/canvasDimensions.js';

// Pre-load the volume icon
let volumeIconImage = null;
const loadVolumeIcon = () => {
  if (!volumeIconImage) {
    volumeIconImage = new Image();
    volumeIconImage.src = getIconPath('volume.svg');
  }
  return volumeIconImage;
};

// --- Pure Helper Functions ---
function getColumnX(index, options) {
  // Use modulation-aware column positions if modulation exists
  const hasModulation = options.modulationMarkers && options.modulationMarkers.length > 0;

  if (hasModulation) {
    return getModulatedColumnX(index, options);
  } else {
    return LayoutService.getColumnX(index);
  }
}

export function drawDrumShape(ctx, drumRow, x, y, width, height, scale = 1.0) {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const size = Math.min(width, height) * 0.4 * scale;
  ctx.beginPath();

  if (drumRow === 0) { // High: Triangle
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx - size, cy + size);
    ctx.lineTo(cx + size, cy + size);
    ctx.closePath();
  } else if (drumRow === 1) { // Mid: Diamond
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size, cy);
    ctx.lineTo(cx, cy + size);
    ctx.lineTo(cx - size, cy);
    ctx.closePath();
  } else { // Low: Pentagon
    const sides = 5;
    for (let i = 0; i < sides; i++) {
      const angle = (2 * Math.PI / sides) * i - Math.PI / 2;
      const sx = cx + size * Math.cos(angle);
      const sy = cy + size * Math.sin(angle);
      if (i === 0) {ctx.moveTo(sx, sy);}
      else {ctx.lineTo(sx, sy);}
    }
    ctx.closePath();
  }
  ctx.fill();
}

function drawVolumeIcon(ctx, x, y, size, state = 'normal') {
  const volumeImg = loadVolumeIcon();

  // Add background highlight for hover/active states
  if (state !== 'normal') {
    const highlightSize = size * 1.3;
    ctx.beginPath();
    ctx.arc(x, y, highlightSize / 2, 0, Math.PI * 2);

    if (state === 'hover') {
      ctx.fillStyle = 'rgba(74, 144, 226, 0.2)';
    } else if (state === 'active') {
      ctx.fillStyle = 'rgba(74, 144, 226, 0.4)';
    }
    ctx.fill();
  }

  // Try to draw the SVG icon if loaded
  if (volumeImg.complete && volumeImg.naturalWidth > 0) {
    // Apply tint for different states
    if (state === 'hover') {
      ctx.filter = 'brightness(1.2)';
    } else if (state === 'active') {
      ctx.filter = 'brightness(0.8)';
    }

    ctx.drawImage(volumeImg, x - size/2, y - size/2, size, size);
    ctx.filter = 'none'; // Reset filter
  } else {
    // Fallback: draw a simple speaker icon with state-based colors
    let fillColor = '#6c757d';
    let strokeColor = '#6c757d';

    if (state === 'hover') {
      fillColor = '#4a90e2';
      strokeColor = '#4a90e2';
    } else if (state === 'active') {
      fillColor = '#357abd';
      strokeColor = '#357abd';
    }

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;

    const speakerWidth = size * 0.4;
    const speakerHeight = size * 0.6;
    const coneWidth = size * 0.3;

    // Speaker box
    ctx.fillRect(x - speakerWidth/2, y - speakerHeight/2, speakerWidth, speakerHeight);

    // Speaker cone
    ctx.beginPath();
    ctx.moveTo(x + speakerWidth/2, y - speakerHeight/3);
    ctx.lineTo(x + speakerWidth/2 + coneWidth, y - speakerHeight/2);
    ctx.lineTo(x + speakerWidth/2 + coneWidth, y + speakerHeight/2);
    ctx.lineTo(x + speakerWidth/2, y + speakerHeight/3);
    ctx.closePath();
    ctx.fill();

    // Sound waves
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(x + speakerWidth/2 + coneWidth + size*0.1, y, size * 0.2 * i, -Math.PI/4, Math.PI/4, false);
      ctx.stroke();
    }
  }
}

function drawVerticalGridLines(ctx, options) {
  const { columnWidths, macrobeatGroupings, macrobeatBoundaryStyles, placedTonicSigns } = options;
  const drumAreaEnd = columnWidths.length - 2; // Exclude right legend columns
  const macrobeatBoundaries = [];

  // This logic must exactly match the rhythmService logic for calculating positions
  let current_col = 2;
  for(let i=0; i<macrobeatGroupings.length; i++) {
    while(placedTonicSigns.some(ts => ts.columnIndex === current_col)) {
      current_col += 2;  // Fixed: Each tonic spans 2 columns
    }
    current_col += macrobeatGroupings[i];
    macrobeatBoundaries.push(current_col);
  }

  // Only draw vertical lines up to the drum area end (excluding right legend)
  for (let i = 0; i <= drumAreaEnd; i++) {
    const x = getColumnX(i, options);

    // Skip lines outside the canvas bounds
    const canvasWidth = getLogicalCanvasWidth(ctx.canvas);
    if (x < 0 || x > canvasWidth) {
      continue;
    }

    let style;
    const isMusicAreaBoundary = i === 2 || i === drumAreaEnd;
    const isTonicColumnStart = isTonicColumn(i, placedTonicSigns);
    const isTonicColumnEnd = placedTonicSigns.some(ts => i === ts.columnIndex + 2);
    const isMacrobeatEnd = macrobeatBoundaries.includes(i);
    const shouldDraw = shouldDrawVerticalLineAtColumn(i, placedTonicSigns);

    // Skip drawing vertical lines in the middle of tonic shapes
    if (!shouldDraw) {
      continue;
    }

    if (isMusicAreaBoundary || isTonicColumnStart || isTonicColumnEnd) {
      style = { lineWidth: 2, strokeStyle: '#adb5bd', dash: [] };
    } else if (isMacrobeatEnd) {
      const mbIndex = macrobeatBoundaries.indexOf(i);
      if (mbIndex !== -1) {
        const boundaryStyle = macrobeatBoundaryStyles[mbIndex];
        if (boundaryStyle === 'anacrusis') {continue;}
        style = { lineWidth: 1, strokeStyle: '#adb5bd', dash: boundaryStyle === 'solid' ? [] : [5, 5] };
      } else { continue; }
    } else {
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, getLogicalCanvasHeight(ctx.canvas));
    ctx.lineWidth = style.lineWidth;
    ctx.strokeStyle = style.strokeStyle;
    ctx.setLineDash(style.dash);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

/**
 * The "pure" drawing function for the entire drum grid.
 * @param {CanvasRenderingContext2D} ctx - The canvas context to draw on.
 * @param {object} options - An object with all necessary data for rendering.
 */
export function drawDrumGrid(ctx, options) {
  const { placedNotes, columnWidths, cellWidth, cellHeight, placedTonicSigns } = options;

  ctx.clearRect(0, 0, getLogicalCanvasWidth(ctx.canvas), getLogicalCanvasHeight(ctx.canvas));

  // DEBUG: Log canvas positioning info for comparison
  const canvas = ctx.canvas;
  const rect = canvas.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(canvas);

  // Use zoom-dependent row height with minimum size - MUST match LayoutService and GridCoordsService
  const drumRowHeight = Math.max(BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR * cellHeight);
  const totalColumns = columnWidths.length;
  const drumLabels = ['H', 'M', 'L'];

  // Draw drum labels in right column of legend area
  ctx.font = `${Math.floor(drumRowHeight * 0.7)}px 'Atkinson Hyperlegible', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#6c757d';

  // Right column: H, M, L labels
  const rightLabelX = getColumnX(1, options) + getColumnX(1, options) * 0.3; // Offset to right side
  drumLabels.forEach((label, i) => {
    ctx.fillText(label, rightLabelX, i * drumRowHeight + drumRowHeight / 2);
  });

  // Left column: Volume icon (simple speaker symbol) - 50% bigger
  const leftLabelX = getColumnX(1, options) - getColumnX(1, options) * 0.3; // Offset to left side
  const centerY = (3 * drumRowHeight) / 2; // Center vertically in the 3-row area
  const iconState = options.volumeIconState || 'normal'; // Allow state to be passed in
  drawVolumeIcon(ctx, leftLabelX, centerY, drumRowHeight * 0.6, iconState);

  // Draw horizontal lines (exclude left legend column area)
  const legendLeftBoundary = getColumnX(2, options); // Start lines after legend area
  for (let i = 0; i < 4; i++) {
    const y = i * drumRowHeight;
    ctx.beginPath();
    ctx.moveTo(legendLeftBoundary, y);
    ctx.lineTo(getLogicalCanvasWidth(ctx.canvas), y);
    ctx.strokeStyle = '#ced4da';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawVerticalGridLines(ctx, options);

  // Draw notes and placeholders
  for (let col = 2; col < totalColumns - 2; col++) {
    // --- THIS IS THE CRITICAL ADDITION ---
    // If a tonic sign is in this column, skip drawing anything (notes or placeholders).
    if (placedTonicSigns.some(ts => ts.columnIndex === col)) {
      continue;
    }

    const x = getColumnX(col, options);

    // Calculate modulated cell width if modulation is present
    let currentCellWidth;
    if (options.modulationMarkers && options.modulationMarkers.length > 0) {
      const nextX = getColumnX(col + 1, options);
      currentCellWidth = nextX - x;
    } else {
      currentCellWidth = columnWidths[col] * cellWidth;
    }

    for (let row = 0; row < 3; row++) {
      const y = row * drumRowHeight;
      const drumTrack = drumLabels[row];

      const drumHit = placedNotes.find(note =>
        note.isDrum && note.drumTrack === drumTrack && note.startColumnIndex === col
      );

      if (drumHit) {
        ctx.fillStyle = drumHit.color;
        const animationScale = DrumPlayheadRenderer.getAnimationScale(col, drumTrack);
        drawDrumShape(ctx, row, x, y, currentCellWidth, drumRowHeight, animationScale);
      } else {
        ctx.fillStyle = '#ced4da';
        ctx.beginPath();
        ctx.arc(x + currentCellWidth / 2, y + drumRowHeight / 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Draw modulation markers (render on top of everything else)
  renderModulationMarkers(ctx, options);
}
