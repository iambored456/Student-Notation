// js/components/Canvas/PitchGrid/renderers/tripletRenderer.ts
import { getTripletStampById, tripletCenterPercents } from '../../../../rhythm/triplets.js';
import { getRowY, getColumnX } from './rendererUtils.js';
import store from '@state/index.ts';
import logger from '../../../../utils/logger.ts';
import { getLogicalCanvasWidth } from '@utils/canvasDimensions.ts';
import { timeIndexToVisualColumn } from '../../../../services/columnMap.ts';
import { canvasToTime, timeToCanvas } from '../../../../services/columnMapService.ts';
import type { TripletPlacement } from '../../../../../types/state.js';
import type { TripletStamp } from '../../../../rhythm/triplets.js';
import type { ModulationMarker } from '../../../../../types/state.js';

interface TripletRenderOptions {
  columnWidths: number[];
  cellWidth: number;
  cellHeight: number;
  baseMicrobeatPx?: number;
  modulationMarkers?: ModulationMarker[];
}

logger.moduleLoaded('TripletRenderer', 'triplets');

/**
 * Renders all placed triplet groups on the pitch grid
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {Object} options - Rendering options
 */
export function renderTriplets(ctx: CanvasRenderingContext2D, options: TripletRenderOptions): void {
  const triplets: TripletPlacement[] =
    store.getAllTripletPlacements?.() ??
    store.state?.tripletPlacements ??
    [];

  if (triplets.length === 0) {return;}

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
function renderTripletGroup(ctx: CanvasRenderingContext2D, placement: TripletPlacement, options: TripletRenderOptions): void {
  const stamp = getTripletStampById(placement.stampId);
  if (!stamp) {return;}

  const { startCellIndex, span, row, color } = placement;

  // COORDINATE SYSTEM NOTE:
  // - Cell indices count only musical time (ignoring tonic columns)
  // - Each cell = 2 microbeats
  // - Triplets should NOT stretch over tonic columns - they have a fixed TIME width

  const startTimeMicrobeat = startCellIndex * 2; // Each cell = 2 microbeats
  const timeSpan = span * 2; // How many time columns (microbeats) this triplet occupies

  // Convert start TIME to CANVAS-space
  const startColumn = timeToCanvas(startTimeMicrobeat, store.state);

  // Calculate end column by adding the TIME span to the START canvas column
  // This prevents stretching over tonic columns - the triplet renders with fixed width
  const endColumn = startColumn + timeSpan;

  console.log(`[TRIPLET RENDER] cells ${startCellIndex}-${startCellIndex + span}, timeSpan=${timeSpan}, canvas ${startColumn}-${endColumn}`);

  // Get the triplet group bounds
  const groupX = getColumnX(startColumn, options);
  const rowCenterY = getRowY(row, options);
  const groupY = rowCenterY - (options.cellHeight / 2);

  // Calculate width based on fixed time span (not inflated canvas range)
  const groupEndX = getColumnX(endColumn, options);
  const groupWidth = groupEndX - groupX;

  console.log(`[TRIPLET RENDER] X positions: startX=${groupX.toFixed(1)}, endX=${groupEndX.toFixed(1)}, width=${groupWidth.toFixed(1)}`);

  const groupHeight = options.cellHeight;

  // Skip if outside viewport
  const canvasWidth = getLogicalCanvasWidth(ctx.canvas);
  if (groupX + groupWidth < 0 || groupX > canvasWidth) {return;}

  // Draw triplet noteheads with per-shape offsets
  const getRowYWithOptions = (rowIndex: number) => getRowY(rowIndex, options);
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
function renderTripletNoteheads(
  ctx: CanvasRenderingContext2D,
  stamp: TripletStamp,
  groupX: number,
  centerY: number,
  groupWidth: number,
  groupHeight: number,
  color: string,
  placement: TripletPlacement | null = null,
  getRowY: ((row: number) => number) | null = null
): void {
  // Separate horizontal and vertical scaling to support modulation stretch
  // Quarter triplets naturally appear wider due to larger groupWidth (4 microbeats vs 2)
  const scaleX = (groupWidth / 100) * 0.8;
  const scaleY = (groupHeight / 100) * 0.8;
  const strokeWidth = Math.max(1, 3 * scaleY);

  // Draw noteheads for each active slot
  stamp.hits.forEach(slot => {
    const centerPercent = tripletCenterPercents[slot] ?? 50;
    const noteheadX = groupX + (groupWidth * centerPercent / 100);

    // Calculate Y position with per-shape offset
    let noteheadY = centerY;
    if (placement && getRowY) {
      const shapeKey = `triplet_${slot}`;
      const rowOffset = (placement.shapeOffsets?.[shapeKey]) || 0;
      const shapeRow = placement.row + rowOffset;
      noteheadY = getRowY(shapeRow);

      if (rowOffset !== 0) {
        logger.debug('TripletRenderer', 'Drawing notehead with offset', {
          slot,
          shapeKey,
          rowOffset,
          baseRow: placement.row,
          shapeRow,
          y: noteheadY
        }, 'triplets');
      }
    }

    drawTripletNotehead(ctx, noteheadX, noteheadY, color, strokeWidth, scaleX, scaleY);
  });
}

/**
 * Draws a single triplet notehead on canvas
 * All triplet noteheads use the same base ellipse shape; width differences between
 * eighth and quarter triplets come from the group width scaling (scaleX parameter)
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} cx - Center X position
 * @param {number} cy - Center Y position
 * @param {string} stroke - Stroke color
 * @param {number} strokeWidth - Stroke width
 * @param {number} scaleX - Horizontal scale factor
 * @param {number} scaleY - Vertical scale factor
 */
function drawTripletNotehead(ctx: CanvasRenderingContext2D, cx: number, cy: number, stroke = 'currentColor', strokeWidth = 4, scaleX = 1, scaleY = 1): void {
  const rx = 20 * scaleX;
  const ry = 60 * scaleY;

  ctx.strokeStyle = stroke;
  ctx.lineWidth = strokeWidth;
  ctx.fillStyle = 'none';

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
  ctx.stroke();
}

/**
 * Renders a triplet preview on hover
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} canvasColumn - Canvas-space column index for preview
 * @param {number} row - Row index
 * @param {Object} stamp - The triplet stamp data
 * @param {Object} options - Rendering options
 */
export function renderTripletPreview(
  ctx: CanvasRenderingContext2D,
  canvasColumn: number,
  row: number,
  stamp: TripletStamp | null,
  options: TripletRenderOptions & { previewColor?: string }
): void {
  if (!stamp) {return;}

  // COORDINATE SYSTEM NOTE:
  // canvasColumn is in canvas-space (0-based from first playable column after legends)
  // Preview should NOT stretch over tonic columns - use fixed TIME width

  const span = stamp.span === 'eighth' ? 1 : 2;
  // Each cell is 2 microbeat columns, so span in time columns is span * 2
  const timeSpan = span * 2;

  // Align to cell boundary (each cell is 2 columns)
  const alignedStartColumn = Math.floor(canvasColumn / 2) * 2;

  // Get the preview bounds
  const groupX = getColumnX(alignedStartColumn, options);
  const rowCenterY = getRowY(row, options);

  // Calculate end column by adding TIME span to start canvas column
  // This prevents stretching over tonic columns - the preview renders with fixed width
  const endColumn = alignedStartColumn + timeSpan;

  const groupEndX = getColumnX(endColumn, options);
  const groupWidth = groupEndX - groupX;

  const groupHeight = options.cellHeight;

  // Draw semi-transparent preview
  ctx.save();
  ctx.globalAlpha = 0.6;

  const previewColor = options.previewColor || '#4a90e2';
  renderTripletNoteheads(ctx, stamp, groupX, rowCenterY, groupWidth, groupHeight, previewColor);

  ctx.restore();
}
