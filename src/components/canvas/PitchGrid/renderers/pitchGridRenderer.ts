// js/components/Canvas/PitchGrid/renderers/pitchGridRenderer.ts
import store from '@state/index.ts';
import { drawHorizontalLines, drawVerticalLines } from './gridLines.js';
import { drawLegendsToSeparateCanvases } from './legend.js';
import { drawSingleColumnOvalNote, drawTwoColumnOvalNote, drawTonicShape } from './notes.js';
import { getVisibleRowRange } from './rendererUtils.js';
import { renderStamps } from './stampRenderer.js';
import { renderTriplets } from './tripletRenderer.js';
import { renderModulationMarkers } from './modulationRenderer.js';
import { renderAnnotations } from './annotationRenderer.js';
import { getLogicalCanvasWidth, getLogicalCanvasHeight } from '@utils/canvasDimensions.ts';
import CanvasContextService from '@services/canvasContextService.ts';
import type { AppState, PlacedNote, TonicSign } from '../../../../../types/state.js';

type PitchGridRenderOptions = {
  placedNotes: PlacedNote[];
  placedTonicSigns: TonicSign[];
  rowHeight?: number;
  colorMode?: 'color' | 'bw';
  zoomLevel?: number;
  viewportHeight: number;
} & Pick<AppState,
  | 'fullRowData'
  | 'columnWidths'
  | 'cellWidth'
  | 'cellHeight'
  | 'macrobeatGroupings'
  | 'macrobeatBoundaryStyles'
  | 'degreeDisplayMode'
  | 'modulationMarkers'
  | 'accidentalMode'
  | 'showFrequencyLabels'
>;

export function drawPitchGrid(ctx: CanvasRenderingContext2D, options: PitchGridRenderOptions): void {
  const fullOptions: AppState & PitchGridRenderOptions = { ...(store.state), ...options };

  // Quick visibility debug
  if (!fullOptions.columnWidths?.length || !fullOptions.fullRowData?.length) {
    return;
  }

  ctx.clearRect(0, 0, getLogicalCanvasWidth(ctx.canvas), getLogicalCanvasHeight(ctx.canvas));

  // 1. Get the range of rows that are actually visible
  const { startRow, endRow } = getVisibleRowRange();

  // Replicate tonic signs across visible octaves so they persist through vertical scroll
  const tonicModulo = (row: number) => ((row % 12) + 12) % 12;
  const visibleTonicSigns = fullOptions.placedTonicSigns.flatMap(sign => {
    const baseModulo = tonicModulo(sign.row);
    const replicas: TonicSign[] = [];
    for (let row = startRow; row <= endRow; row++) {
      if (tonicModulo(row) === baseModulo) {
        replicas.push({ ...sign, row });
      }
    }
    return replicas;
  });

  // 2. Draw legends to separate canvases
  const legendLeftCtx = CanvasContextService.getLegendLeftContext();
  const legendRightCtx = CanvasContextService.getLegendRightContext();
  drawLegendsToSeparateCanvases(legendLeftCtx, legendRightCtx, fullOptions, startRow, endRow);

  // 3. Pass the visible range to the renderers that draw row-based elements
  drawHorizontalLines(ctx, fullOptions, startRow, endRow);
  drawVerticalLines(ctx, fullOptions); // Vertical lines are not virtualized

  // 4. Filter notes and signs to only those that are visible before drawing
  const visibleNotes = options.placedNotes.filter(note =>
    !note.isDrum && note.row >= startRow && note.row <= endRow
  );

  const uniqueVisibleTonicSigns = visibleTonicSigns;


  // Draw each visible note
  visibleNotes.forEach(note => {

    // The note drawing functions use getRowY, so they will automatically
    // draw in the correct virtualized position.
    if (note.shape === 'oval') {
      drawSingleColumnOvalNote(ctx, fullOptions, note, note.row);
    } else if (note.shape === 'circle') {
      drawTwoColumnOvalNote(ctx, fullOptions, note, note.row);
    }
    // Other note shapes not yet implemented
  });

  // Draw tonic signs
  uniqueVisibleTonicSigns.forEach(sign => {
    drawTonicShape(ctx, fullOptions, sign);
  });

  // Draw stamps (render on top of everything else)
  renderStamps(ctx, fullOptions);

  // Draw triplet groups (render on top of stamps)
  renderTriplets(ctx, fullOptions);

  // Draw modulation markers (render on top of everything else for UI overlay)
  renderModulationMarkers(ctx, fullOptions);

  // Draw annotations (render on top of modulation markers)
  renderAnnotations(ctx, fullOptions);

}
