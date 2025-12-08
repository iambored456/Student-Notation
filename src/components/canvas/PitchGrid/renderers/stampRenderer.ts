// js/components/Canvas/PitchGrid/renderers/stampRenderer.ts
import { getStampById } from '../../../../rhythm/stamps.js';
import { defaultStampRenderer } from '../../../../utils/stampRenderer.ts';
import { getRowY, getColumnX } from './rendererUtils.js';
import store from '@state/index.ts';
import logger from '../../../../utils/logger.js';
import { getLogicalCanvasWidth } from '@utils/canvasDimensions.ts';
import { canvasToTime, timeToCanvas } from '../../../../services/columnMapService.ts';
import type { ModulationMarker, StampPlacement } from '../../../../../types/state.js';
import type { StampShape } from '../../../../utils/stampRenderer.ts';

interface StampRenderOptions {
  columnWidths: number[];
  musicalColumnWidths?: number[];
  cellWidth: number;
  cellHeight: number;
  baseMicrobeatPx?: number;
  modulationMarkers?: ModulationMarker[];
}

logger.moduleLoaded('StampRenderer', 'stamps');

export function renderStamps(ctx: CanvasRenderingContext2D, options: StampRenderOptions): void {
  const stamps: StampPlacement[] =
    store.getAllStampPlacements?.() ??
    store.state?.stampPlacements ??
    [];

  if (stamps.length === 0) {return;}

  // Debug logging for stamp positioning on zoom
  if (stamps.length > 0) {
    const firstStamp = stamps[0];
    console.log(`[renderStamps] Rendering ${stamps.length} stamps`);
    console.log(`[renderStamps] First stamp: column=${firstStamp?.startColumn}, row=${firstStamp?.row}, globalRow=${firstStamp?.globalRow}`);
    console.log(`[renderStamps] musicalColumnWidths length: ${options.musicalColumnWidths?.length || 0}`);
    console.log(`[renderStamps] columnWidths length: ${options.columnWidths?.length || 0}`);
  }

  logger.debug('StampRenderer', `Rendering ${stamps.length} stamps`, { count: stamps.length }, 'stamps');

  stamps.forEach(placement => {
    renderStamp(ctx, placement, options);
  });
}

function renderStamp(ctx: CanvasRenderingContext2D, placement: StampPlacement, options: StampRenderOptions): void {
  const stamp: StampShape | undefined = getStampById(placement.stampId);
  if (!stamp) {return;}

  const { startColumn, row, color } = placement;
  const state = store.state;

  const stampX = getColumnX(startColumn, options);
  const rowCenterY = getRowY(row, options);
  const stampY = rowCenterY - (options.cellHeight / 2);

  // Calculate end column using time-space to handle tonic columns correctly
  // Stamps have a fixed duration of 2 time columns (microbeats)
  const startTimeCol = canvasToTime(startColumn, state);
  let effectiveEndColumn: number;

  if (startTimeCol !== null) {
    // Convert time span to canvas span (skipping any tonic columns)
    const endTimeCol = startTimeCol + 2;
    effectiveEndColumn = timeToCanvas(endTimeCol, state);
  } else {
    // Fallback for edge cases (stamp on tonic column - shouldn't happen with validation)
    effectiveEndColumn = startColumn + 2;
  }

  const stampEndX = getColumnX(effectiveEndColumn, options);
  const stampWidth = stampEndX - stampX;

  const stampHeight = options.cellHeight;

  const canvasWidth = getLogicalCanvasWidth(ctx.canvas);
  if (stampX + stampWidth < 0 || stampX > canvasWidth) {return;}

  const getRowYWithOptions = (rowIndex: number) => getRowY(rowIndex, options);

  defaultStampRenderer.renderToCanvas(
    ctx,
    stamp,
    stampX,
    stampY,
    stampWidth,
    stampHeight,
    color,
    placement,
    getRowYWithOptions
  );

  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = color;
  ctx.fillRect(stampX + 1, stampY + 1, stampWidth - 2, stampHeight - 2);
  ctx.restore();

  logger.debug('StampRenderer', `Rendered stamp ${placement.stampId} at ${startColumn}-${effectiveEndColumn},${row}`, {
    stampId: placement.stampId,
    startColumn,
    effectiveEndColumn,
    row,
    stampX,
    stampY,
    hasOffsets: !!placement.shapeOffsets
  }, 'stamps');
}

export function renderStampPreview(
  ctx: CanvasRenderingContext2D,
  column: number,
  row: number,
  stamp: StampShape | null,
  options: StampRenderOptions & { previewColor?: string }
): void {
  if (!stamp) {return;}

  const state = store.state;
  const stampX = getColumnX(column, options);
  const rowCenterY = getRowY(row, options);
  const stampY = rowCenterY - (options.cellHeight / 2);

  // Calculate end column using time-space to handle tonic columns correctly
  // Preview stamps also have a fixed duration of 2 time columns (microbeats)
  const startTimeCol = canvasToTime(column, state);
  let effectiveEndColumn: number;

  if (startTimeCol !== null) {
    const endTimeCol = startTimeCol + 2;
    effectiveEndColumn = timeToCanvas(endTimeCol, state);
  } else {
    effectiveEndColumn = column + 2;
  }

  const stampEndX = getColumnX(effectiveEndColumn, options);
  const stampWidth = stampEndX - stampX;

  const stampHeight = options.cellHeight;

  ctx.save();
  ctx.globalAlpha = 0.6;
  defaultStampRenderer.renderToCanvas(ctx, stamp, stampX, stampY, stampWidth, stampHeight, options.previewColor || '#4a90e2');
  ctx.restore();
}
