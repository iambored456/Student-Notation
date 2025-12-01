// js/components/Canvas/PitchGrid/renderers/stampRenderer.ts
import { getStampById } from '../../../../rhythm/stamps.js';
import { defaultStampRenderer } from '../../../../utils/stampRenderer.ts';
import { getRowY, getColumnX } from './rendererUtils.js';
import store from '@state/index.ts';
import logger from '../../../../utils/logger.js';
import { getLogicalCanvasWidth } from '@utils/canvasDimensions.ts';
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

  const { startColumn, endColumn, row, color } = placement;

  const stampX = getColumnX(startColumn, options);
  const rowCenterY = getRowY(row, options);
  const stampY = rowCenterY - (options.cellHeight / 2);

  // Calculate width dynamically based on column positions to account for modulation
  // Stamps typically span 2 columns, but use actual column positions if endColumn is defined
  const effectiveEndColumn = endColumn ?? startColumn + 2;
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

  logger.debug('StampRenderer', `Rendered stamp ${placement.stampId} at ${startColumn}-${endColumn},${row}`, {
    stampId: placement.stampId,
    startColumn,
    endColumn,
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

  const stampX = getColumnX(column, options);
  const rowCenterY = getRowY(row, options);
  const stampY = rowCenterY - (options.cellHeight / 2);

  // Calculate width dynamically based on column positions to account for modulation
  // Preview stamps also span 2 columns
  const stampEndX = getColumnX(column + 2, options);
  const stampWidth = stampEndX - stampX;

  const stampHeight = options.cellHeight;

  ctx.save();
  ctx.globalAlpha = 0.6;
  defaultStampRenderer.renderToCanvas(ctx, stamp, stampX, stampY, stampWidth, stampHeight, options.previewColor || '#4a90e2');
  ctx.restore();
}
