// js/components/Canvas/PitchGrid/renderers/gridLines.ts
import { getColumnX, getRowY, getPitchClass, getLineStyleFromPitchClass } from './rendererUtils.js';
import { shouldDrawVerticalLineAtColumn, isTonicColumn } from '../../../../utils/tonicColumnUtils.ts';
import { getLogicalCanvasHeight } from '@utils/canvasDimensions.ts';
import store from '@state/index.ts';
import { getMacrobeatInfo, getPlacedTonicSigns } from '@state/selectors.ts';
import type { AppState } from '../../../../../types/state.js';

const DEFAULT_ANACRUSIS_COLORS = {
  stroke: '#c7cfd8',
  background: 'rgba(207, 214, 222, 0.32)'
};

let cachedAnacrusisColors: typeof DEFAULT_ANACRUSIS_COLORS | null = null;

function getAnacrusisColors(): typeof DEFAULT_ANACRUSIS_COLORS {
  if (cachedAnacrusisColors) {return cachedAnacrusisColors;}
  if (typeof window === 'undefined') {return DEFAULT_ANACRUSIS_COLORS;}
  const styles = window.getComputedStyle(document.documentElement);
  cachedAnacrusisColors = {
    stroke: styles.getPropertyValue('--c-anacrusis-border').trim() || DEFAULT_ANACRUSIS_COLORS.stroke,
    background: styles.getPropertyValue('--c-anacrusis-bg').trim() || DEFAULT_ANACRUSIS_COLORS.background
  };
  return cachedAnacrusisColors;
}

interface Range { start: number; end: number }

function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0) {return [];}
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  for (const r of sorted) {
    if (merged.length === 0) {
      merged.push({ ...r });
      continue;
    }
    const last = merged[merged.length - 1]!;
    if (r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

function buildLightRanges(options: GridRenderOptions): Range[] {
  const ranges: Range[] = [];

  const anacrusisEnd = getAnacrusisEndColumn();
  if (anacrusisEnd !== null && anacrusisEnd > 0) {
    ranges.push({
      start: getColumnX(0, options),
      end: getColumnX(anacrusisEnd, options)
    });
  }

  const tonicSigns = getPlacedTonicSigns(store.state);
  tonicSigns.forEach(ts => {
    const start = getColumnX(ts.columnIndex, options);
    const end = getColumnX(ts.columnIndex + 2, options);
    ranges.push({ start, end });
  });

  return mergeRanges(ranges);
}

function buildSegments(startX: number, endX: number, lightRanges: Range[]): { from: number; to: number; light: boolean }[] {
  const points = new Set<number>([startX, endX]);
  lightRanges.forEach(r => {
    const clampedStart = Math.max(startX, Math.min(endX, r.start));
    const clampedEnd = Math.max(startX, Math.min(endX, r.end));
    if (clampedEnd > clampedStart) {
      points.add(clampedStart);
      points.add(clampedEnd);
    }
  });

  const sortedPoints = Array.from(points).sort((a, b) => a - b);
  const segments: { from: number; to: number; light: boolean }[] = [];

  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const from = sortedPoints[i]!;
    const to = sortedPoints[i + 1]!;
    const mid = (from + to) / 2;
    const light = lightRanges.some(r => mid >= r.start && mid < r.end);
    if (to > from) {
      segments.push({ from, to, light });
    }
  }

  return segments;
}

function getAnacrusisEndColumn(): number | null {
  const state = store.state as any;
  if (!state?.hasAnacrusis || !Array.isArray(state.macrobeatBoundaryStyles)) {
    return null;
  }
  const solidBoundaryIndex = state.macrobeatBoundaryStyles.findIndex((style: string) => style === 'solid');
  if (solidBoundaryIndex < 0) {return null;}
  const mbInfo = getMacrobeatInfo(state, solidBoundaryIndex);
  if (!mbInfo) {return null;}
  return mbInfo.endColumn + 1;
}

interface GridRenderOptions extends Pick<AppState,
  | 'columnWidths'
  | 'musicalColumnWidths'
  | 'cellHeight'
  | 'cellWidth'
  | 'accidentalMode'
  | 'showFrequencyLabels'
  | 'fullRowData'
> {
  viewportHeight: number;
  baseMicrobeatPx?: number;
}

function drawHorizontalMusicLines(ctx: CanvasRenderingContext2D, options: GridRenderOptions, startRow: number, endRow: number): void {
  // Draw simple horizontal lines across the entire musical canvas (canvas-space)
  // Legend lines are handled by the legend renderer on separate canvases

  const lightRanges = buildLightRanges(options);
  const { stroke: anacrusisStroke } = getAnacrusisColors();

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
    // Check for non-empty array (empty array is truthy but useless)
    const musicalColumnWidths = (options.musicalColumnWidths && options.musicalColumnWidths.length > 0)
      ? options.musicalColumnWidths
      : options.columnWidths || [];
    const startX = getColumnX(0, options);
    const endX = getColumnX(musicalColumnWidths.length, options);
    const segments = buildSegments(startX, endX, lightRanges);

    if (pitchClass === 'G') {
      // G-line: Draw filled rectangle in musical area
      segments.forEach(seg => {
        const width = seg.to - seg.from;
        if (width <= 0) {return;}
        ctx.save();
        ctx.fillStyle = seg.light ? anacrusisStroke : style.color;
        ctx.globalAlpha = seg.light ? 0.5 : 1;
        ctx.fillRect(seg.from, y - options.cellHeight / 2, width, options.cellHeight);
        ctx.restore();
      });
    } else {
      // All other lines: Draw simple stroke
      segments.forEach(seg => {
        const width = seg.to - seg.from;
        if (width <= 0) {return;}
        ctx.beginPath();
        ctx.moveTo(seg.from, y);
        ctx.lineTo(seg.to, y);
        ctx.lineWidth = style.lineWidth;
        ctx.strokeStyle = seg.light ? anacrusisStroke : style.color;
        ctx.setLineDash(style.dash);
        ctx.globalAlpha = seg.light ? 0.6 : 1;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      });
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

interface VerticalOptions extends GridRenderOptions {
  placedTonicSigns: { columnIndex: number }[];
  macrobeatGroupings: number[];
  macrobeatBoundaryStyles: string[];
}

function drawRegularVerticalLines(ctx: CanvasRenderingContext2D, options: VerticalOptions): void {
  const { columnWidths, macrobeatGroupings, macrobeatBoundaryStyles, placedTonicSigns } = options;
  // canvas-space columns only (no legends)
  const musicalColumnWidths = (options.musicalColumnWidths && options.musicalColumnWidths.length > 0)
    ? options.musicalColumnWidths
    : columnWidths;
  const totalColumns = musicalColumnWidths.length;

  // Build macrobeat boundary positions in canvas-space using the selector (keeps in sync with UI buttons).
  const macrobeatBoundaries: number[] = macrobeatGroupings.map((_, i) => {
    const { endColumn } = getMacrobeatInfo(store.state, i);
    return endColumn + 1; // boundary is after the macrobeat
  });

  for (let canvasCol = 0; canvasCol <= totalColumns; canvasCol++) {
    const isGridStartOrEnd = canvasCol === 0 || canvasCol === totalColumns;
    const isTonicColumnStart = isTonicColumn(canvasCol, placedTonicSigns);
    const isTonicColumnEnd = placedTonicSigns.some(ts => canvasCol === ts.columnIndex + 2);
    const isMacrobeatEnd = macrobeatBoundaries.includes(canvasCol);
    const shouldDraw = shouldDrawVerticalLineAtColumn(canvasCol, placedTonicSigns);

    if (!shouldDraw) {
      continue; // skip mid-tonic line
    }

    let style: { lineWidth: number; strokeStyle: string; dash: number[] } | null = null;
    if (isGridStartOrEnd || isTonicColumnStart || isTonicColumnEnd) {
      style = { lineWidth: 2, strokeStyle: '#adb5bd', dash: [] };
    } else if (isMacrobeatEnd) {
      const mbIndex = macrobeatBoundaries.indexOf(canvasCol);
      const boundaryStyle = macrobeatBoundaryStyles[mbIndex] ?? 'dashed';
      if (boundaryStyle === 'anacrusis') {
        const { stroke } = getAnacrusisColors();
        style = { lineWidth: 1, strokeStyle: stroke, dash: [4, 4] };
      } else {
        style = { lineWidth: 1, strokeStyle: '#adb5bd', dash: boundaryStyle === 'solid' ? [] : [5, 5] };
      }
    }

    if (!style) {continue;}

    const x = getColumnX(canvasCol, options);
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
