// js/components/Canvas/PitchGrid/renderers/tripletRenderer.js
import { getTripletStampById, tripletCenterPercents } from '../../../../rhythm/triplets.js';
import { createTripletNotehead } from '../../../Rhythm/glyphs/tripletGlyphs.js';
import { getRowY, getColumnX } from './rendererUtils.js';
import store from '../../../../state/index.js';
import logger from '../../../../utils/logger.js';

logger.moduleLoaded('TripletRenderer', 'triplets');

/**
 * Renders all placed triplet groups on the pitch grid
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {Object} options - Rendering options
 */
export function renderTriplets(ctx, options) {
  const triplets = store.getAllTripletPlacements();
  
  if (triplets.length === 0) return;

  logger.debug('TripletRenderer', `Rendering ${triplets.length} triplet groups`, { count: triplets.length }, 'triplets');

  triplets.forEach(placement => {
    renderTripletGroup(ctx, placement, options);
  });
}

/**
 * Renders a single triplet group at its placement position
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {Object} placement - The triplet placement data
 * @param {Object} options - Rendering options
 */
function renderTripletGroup(ctx, placement, options) {
  const stamp = getTripletStampById(placement.stampId);
  if (!stamp) return;

  const { startCellIndex, span, row, color } = placement;
  
  // Convert cell index to microbeat columns for rendering
  const startColumn = startCellIndex * 2; // Each cell = 2 microbeats
  const endColumn = startColumn + (span * 2) - 1;
  
  // Get the triplet group bounds
  const groupX = getColumnX(startColumn, options);
  const rowCenterY = getRowY(row, options);
  const groupY = rowCenterY - (options.cellHeight / 2);
  const groupWidth = options.cellWidth * 2 * span; // span cells * 2 microbeats per cell
  const groupHeight = options.cellHeight;
  
  // Skip if outside viewport
  if (groupX + groupWidth < 0 || groupX > ctx.canvas.width) return;
  
  // Draw triplet noteheads with per-shape offsets
  const getRowYWithOptions = (rowIndex) => getRowY(rowIndex, options);
  renderTripletNoteheads(ctx, stamp, groupX, rowCenterY, groupWidth, groupHeight, color, placement, getRowYWithOptions);
  
  // Draw a subtle background to make triplets stand out (like sixteenth stamps)
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = color;
  ctx.fillRect(groupX + 1, groupY + 1, groupWidth - 2, groupHeight - 2);
  ctx.restore();
  
  // Optional: Draw triplet bracket/number (can be toggled later)
  // renderTripletBracket(ctx, groupX, rowCenterY, groupWidth, groupHeight);
}

/**
 * Renders triplet noteheads within a group
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {Object} stamp - The triplet stamp data
 * @param {number} groupX - Group left edge
 * @param {number} centerY - Row center Y (base row position)
 * @param {number} groupWidth - Group width
 * @param {number} groupHeight - Group height
 * @param {string} color - Triplet color
 * @param {Object} placement - Optional placement object with shapeOffsets
 * @param {Function} getRowY - Optional function to get Y position for a row index
 */
function renderTripletNoteheads(ctx, stamp, groupX, centerY, groupWidth, groupHeight, color, placement = null, getRowY = null) {
  const kind = stamp.span === "eighth" ? "ovalWide" : "circleWide";

  // Scale dynamically based on cell dimensions (like stamp renderer)
  const scale = Math.min(groupWidth / 100, groupHeight / 100) * 0.8;
  const strokeWidth = Math.max(1, 3 * scale);

  // Draw noteheads for each active slot
  stamp.hits.forEach(slot => {
    const centerPercent = tripletCenterPercents[slot];
    const noteheadX = groupX + (groupWidth * centerPercent / 100);

    // Calculate Y position with per-shape offset
    let noteheadY = centerY;
    if (placement && getRowY) {
      const shapeKey = `triplet_${slot}`;
      const rowOffset = (placement.shapeOffsets?.[shapeKey]) || 0;
      const shapeRow = placement.row + rowOffset;
      noteheadY = getRowY(shapeRow);

      if (rowOffset !== 0) {
        console.log('[TRIPLET RENDER] Drawing notehead with offset:', {
          slot, shapeKey, rowOffset, baseRow: placement.row, shapeRow, y: noteheadY
        });
      }
    }

    drawTripletNotehead(ctx, kind, noteheadX, noteheadY, color, strokeWidth, scale);
  });
}

/**
 * Draws a single triplet notehead on canvas
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {string} kind - "ovalWide" or "circleWide"
 * @param {number} cx - Center X position
 * @param {number} cy - Center Y position
 * @param {string} stroke - Stroke color
 * @param {number} strokeWidth - Stroke width
 * @param {number} scale - Scale factor
 */
function drawTripletNotehead(ctx, kind, cx, cy, stroke = "currentColor", strokeWidth = 4, scale = 1) {
  const baseRx = 20 * scale;
  const baseRy = 60 * scale;

  ctx.strokeStyle = stroke;
  ctx.lineWidth = strokeWidth;
  ctx.fillStyle = 'none';

  ctx.beginPath();
  
  if (kind === "circleWide") {
    // Draw ellipse for "circleWide" - allows independent x/y scaling
    const rx = baseRx*2
    const ry = baseRy;
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
  } else {
    // Draw ellipse for "ovalWide"
    const rx = baseRx;
    const ry = baseRy;
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
  }
  
  ctx.stroke();
}

/**
 * Renders a triplet preview on hover
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} cellIndex - Cell index for preview
 * @param {number} row - Row index
 * @param {Object} stamp - The triplet stamp data
 * @param {Object} options - Rendering options
 */
export function renderTripletPreview(ctx, cellIndex, row, stamp, options) {
  if (!stamp) return;
  
  // Convert cell index to microbeat columns
  const startColumn = cellIndex * 2;
  const span = stamp.span === 'eighth' ? 1 : 2;
  
  // Get the preview bounds
  const groupX = getColumnX(startColumn, options);
  const rowCenterY = getRowY(row, options);
  const groupWidth = options.cellWidth * 2 * span;
  const groupHeight = options.cellHeight;
  
  // Draw semi-transparent preview
  ctx.save();
  ctx.globalAlpha = 0.6;
  
  const previewColor = options.previewColor || '#4a90e2';
  renderTripletNoteheads(ctx, stamp, groupX, rowCenterY, groupWidth, groupHeight, previewColor);
  
  ctx.restore();
}