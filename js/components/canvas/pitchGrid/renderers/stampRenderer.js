// js/components/Canvas/PitchGrid/renderers/stampRenderer.js
import { getStampById } from '../../../../rhythm/stamps.js';
import { defaultStampRenderer } from '../../../../utils/stampRenderer.js';
import { getRowY, getColumnX } from './rendererUtils.js';
import store from '../../../../state/index.js';
import logger from '../../../../utils/logger.js';

logger.moduleLoaded('StampRenderer', 'stamps');

/**
 * Renders all placed stamps on the pitch grid
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {Object} options - Rendering options
 */
export function renderStamps(ctx, options) {
  const stamps = store.getAllStampPlacements();
  
  
  if (stamps.length === 0) return;

  logger.debug('StampRenderer', `Rendering ${stamps.length} stamps`, { count: stamps.length }, 'stamps');

  stamps.forEach(placement => {
    renderStamp(ctx, placement, options);
  });
}

/**
 * Renders a single stamp at its placement position
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {Object} placement - The stamp placement data
 * @param {Object} options - Rendering options
 */
function renderStamp(ctx, placement, options) {
  const stamp = getStampById(placement.stampId);
  if (!stamp) return;

  const { startColumn, endColumn, row, color } = placement;

  // Get the stamp bounds (spans 2 microbeats)
  const stampX = getColumnX(startColumn, options);
  const rowCenterY = getRowY(row, options);
  const stampY = rowCenterY - (options.cellHeight / 2); // Center the stamp on the row like the highlight
  const stampWidth = options.cellWidth * 2; // Full 2-microbeat width like circle notes
  const stampHeight = options.cellHeight;

  // Skip if outside viewport
  if (stampX + stampWidth < 0 || stampX > ctx.canvas.width) return;

  // Create a getRowY wrapper that uses the current options
  const getRowYWithOptions = (rowIndex) => getRowY(rowIndex, options);

  // Use shared stamp renderer with placement data for per-shape offsets
  defaultStampRenderer.renderToCanvas(
    ctx,
    stamp,
    stampX,
    stampY,
    stampWidth,
    stampHeight,
    color,
    placement,  // Pass placement for shapeOffsets
    getRowYWithOptions  // Pass getRowY function for offset calculations
  );

  // Optional: Draw a subtle background to make stamps stand out (spans 2 microbeats)
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = color;
  ctx.fillRect(stampX + 1, stampY + 1, stampWidth - 2, stampHeight - 2);
  ctx.restore();

  logger.debug('StampRenderer', `Rendered stamp ${stamp.id} at ${startColumn}-${endColumn},${row}`, {
    stampId: stamp.id,
    startColumn,
    endColumn,
    row,
    stampX,
    stampY,
    hasOffsets: !!placement.shapeOffsets
  }, 'stamps');
}

/**
 * Renders stamp hover preview at mouse position
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} column - Grid column
 * @param {number} row - Grid row  
 * @param {Object} stamp - The stamp to preview
 * @param {Object} options - Rendering options
 */
export function renderStampPreview(ctx, column, row, stamp, options) {
  if (!stamp) return;
  
  // Preview spans 2 microbeats like actual stamps, snapping to grid positions
  const stampX = getColumnX(column, options);
  const rowCenterY = getRowY(row, options);
  const stampY = rowCenterY - (options.cellHeight / 2); // Center the stamp on the row like the highlight
  const stampWidth = options.cellWidth * 2; // 2-microbeat width like circle notes
  const stampHeight = options.cellHeight;
  
  
  ctx.save();
  ctx.globalAlpha = 0.6;
  
  // Use shared stamp renderer for preview
  defaultStampRenderer.renderToCanvas(ctx, stamp, stampX, stampY, stampWidth, stampHeight, options.previewColor || '#4a90e2');
  
  ctx.restore();
}