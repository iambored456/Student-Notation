// js/components/Canvas/PitchGrid/renderers/gridLines.ts
import { getColumnX, getRowY, getPitchClass, getLineStyleFromPitchClass } from './rendererUtils.js';
import { shouldDrawVerticalLineAtColumn, isTonicColumn } from '../../../../utils/tonicColumnUtils.ts';
import { getLogicalCanvasHeight } from '@utils/canvasDimensions.ts';
import type { AppState } from '../../../../../types/state.js';

type GridRenderOptions = Pick<AppState,
  | 'columnWidths'
  | 'musicalColumnWidths'
  | 'cellHeight'
  | 'cellWidth'
  | 'accidentalMode'
  | 'showFrequencyLabels'
  | 'fullRowData'
> & {
  viewportHeight: number;
  baseMicrobeatPx?: number;
};

function drawHorizontalMusicLines(ctx: CanvasRenderingContext2D, options: GridRenderOptions, startRow: number, endRow: number): void {
  // Draw simple horizontal lines across the entire musical canvas (canvas-space)
  // Legend lines are handled by the legend renderer on separate canvases

  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
    const row = options.fullRowData[rowIndex];
    if (!row) {
      continue;
    }

    const y = getRowY(rowIndex, options);
    // Add a small buffer to prevent lines from disappearing at the very edge
    if (y < -10 || y > options.viewportHeight + 10) {
      continue;
    }

    const pitchClass = getPitchClass(row.pitch);

    // Skip drawing lines for certain pitch classes to achieve the correct visual effect
    // Note: Unicode music symbols ♭ (U+266D) and ♯ (U+266F) are used in pitch names
    const pitchClassesToSkip = ['B', 'A', 'F', 'E♭/D♯', 'D♭/C♯'];
    if (pitchClassesToSkip.includes(pitchClass)) {
      continue;
    }

    const style = getLineStyleFromPitchClass(pitchClass);

    // Canvas-space: column 0 = first musical beat, musicalColumnWidths.length = after last beat
    const musicalColumnWidths = options.musicalColumnWidths || options.columnWidths?.slice(2, -2) || [];
    const startX = getColumnX(0, options);
    const endX = getColumnX(musicalColumnWidths.length, options);

    if (pitchClass === 'G') {
      // G-line: Draw filled rectangle in musical area
      ctx.fillStyle = style.color;
      ctx.fillRect(startX, y - options.cellHeight / 2, endX - startX, options.cellHeight);
    } else {
      // All other lines: Draw simple stroke
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.lineWidth = style.lineWidth;
      ctx.strokeStyle = style.color;
      ctx.setLineDash(style.dash);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

export function drawHorizontalLines(ctx: CanvasRenderingContext2D, options: GridRenderOptions, startRow: number, endRow: number): void {
  drawHorizontalMusicLines(ctx, options, startRow, endRow);
}

export function drawVerticalLines(
  ctx: CanvasRenderingContext2D,
  options: GridRenderOptions & { placedTonicSigns: { columnIndex: number }[]; macrobeatGroupings: number[]; macrobeatBoundaryStyles: string[] }
): void {
  // First draw the regular grid lines (with modulation-aware spacing)
  drawRegularVerticalLines(ctx, options);

  // TEMPORARILY DISABLED: Draw ghost lines for modulated segments (now with proper grid-based calculation)
  // drawGhostLines(ctx, options);
}

type VerticalOptions = GridRenderOptions & {
  placedTonicSigns: { columnIndex: number }[];
  macrobeatGroupings: number[];
  macrobeatBoundaryStyles: string[];
};

function drawRegularVerticalLines(ctx: CanvasRenderingContext2D, options: VerticalOptions): void {
  const { columnWidths, macrobeatGroupings, macrobeatBoundaryStyles, placedTonicSigns } = options;
  const musicalColumnWidths = options.musicalColumnWidths || columnWidths.slice(2, -2);
  const totalColumns = columnWidths.length;
  const macrobeatBoundaries = [];

  // Calculate macrobeat boundaries in full-space (includes legends)
  let current_col = 2;
  for (let i = 0; i < macrobeatGroupings.length; i++) {
    while (placedTonicSigns.some(ts => ts.columnIndex === current_col)) {
      current_col += 2;  // Each tonic spans 2 columns
    }
    const grouping = macrobeatGroupings[i] ?? 0;
    current_col += grouping;
    macrobeatBoundaries.push(current_col);
  }

  // Track min/max X for debugging
  let minDrawnX = Infinity;
  let maxDrawnX = -Infinity;
  let drawnCount = 0;

  // Iterate through full-space columns but convert to canvas-space for getColumnX
  for (let fullSpaceCol = 0; fullSpaceCol <= totalColumns; fullSpaceCol++) {
    let style: { lineWidth: number; strokeStyle: string; dash: number[] } | undefined;
    const isBoundary = fullSpaceCol === 2 || fullSpaceCol === totalColumns - 2;
    const isTonicColumnStart = isTonicColumn(fullSpaceCol, placedTonicSigns);
    const isTonicColumnEnd = placedTonicSigns.some(ts => fullSpaceCol === ts.columnIndex + 2);
    const isMacrobeatEnd = macrobeatBoundaries.includes(fullSpaceCol);
    const shouldDraw = shouldDrawVerticalLineAtColumn(fullSpaceCol, placedTonicSigns);

    // Skip drawing vertical lines in the middle of tonic shapes
    if (!shouldDraw) {
      continue;
    }

    if (isBoundary || isTonicColumnStart || isTonicColumnEnd) {
      style = { lineWidth: 2, strokeStyle: '#adb5bd', dash: [] };
    } else if (isMacrobeatEnd) {
      const mbIndex = macrobeatBoundaries.indexOf(fullSpaceCol);
      if (mbIndex !== -1) {
        const boundaryStyle = macrobeatBoundaryStyles[mbIndex] ?? 'dashed';
        if (boundaryStyle === 'anacrusis') {
          continue;
        }
        style = { lineWidth: 1, strokeStyle: '#adb5bd', dash: boundaryStyle === 'solid' ? [] : [5, 5] };

        // Convert full-space column to canvas-space for getColumnX
        const canvasSpaceCol = fullSpaceCol - 2;
        const x = getColumnX(canvasSpaceCol, options);
      } else {
        continue;
      }
    } else {
      continue;
    }

    if (!style) {
      continue;
    }

    // Convert full-space column to canvas-space for getColumnX
    // Full-space: 0-1 are left legends, 2+ are musical, last 2 are right legends
    // Canvas-space: 0 = first musical beat (which is full-space column 2)
    const canvasSpaceCol = fullSpaceCol - 2;

    // Only draw lines for musical columns (canvas-space >= 0 and <= musicalColumnWidths.length)
    if (canvasSpaceCol < 0 || canvasSpaceCol > musicalColumnWidths.length) {
      continue;
    }

    const x = getColumnX(canvasSpaceCol, options);
    const finalStyle = style;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, getLogicalCanvasHeight(ctx.canvas));
    ctx.lineWidth = finalStyle.lineWidth;
    ctx.strokeStyle = finalStyle.strokeStyle;
    ctx.setLineDash(finalStyle.dash);
    ctx.stroke();

    // Track for debugging
    minDrawnX = Math.min(minDrawnX, x);
    maxDrawnX = Math.max(maxDrawnX, x);
    drawnCount++;
  }
  ctx.setLineDash([]);
}
