// js/components/canvas/drumGrid/drumGridRenderer.ts
import { BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR } from '../../../core/constants.js';
import { shouldDrawVerticalLineAtColumn, isTonicColumn } from '../../../utils/tonicColumnUtils.ts';
import { getColumnX as getModulatedColumnX } from '@components/canvas/PitchGrid/renderers/rendererUtils.ts';
import { renderModulationMarkers } from '@components/canvas/PitchGrid/renderers/modulationRenderer.ts';
import DrumPlayheadRenderer from './drumPlayheadRenderer.js';
import { getLogicalCanvasWidth, getLogicalCanvasHeight } from '@utils/canvasDimensions.ts';
import store from '@state/index.ts';
import { getMacrobeatInfo } from '@state/selectors.ts';
import type { AppState } from '../../../../types/state.js';
import type {
  _AppState,
  MacrobeatBoundaryStyle,
  ModulationMarker,
  PlacedNote,
  TonicSign
} from '../../../../types/state.js';

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

function buildLightRanges(options: DrumGridRenderOptions): Range[] {
  const ranges: Range[] = [];

  const anacrusisEnd = getAnacrusisEndColumnFromState(store.state as AppState);
  if (anacrusisEnd !== null && anacrusisEnd > 0) {
    ranges.push({
      start: getColumnX(0, options),
      end: getColumnX(anacrusisEnd, options)
    });
  }

  options.placedTonicSigns.forEach(ts => {
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

function getAnacrusisEndColumnFromState(state: AppState): number | null {
  if (!state.hasAnacrusis || !Array.isArray(state.macrobeatBoundaryStyles)) {return null;}
  const solidBoundaryIndex = state.macrobeatBoundaryStyles.findIndex(style => style === 'solid');
  if (solidBoundaryIndex < 0) {return null;}
  const mbInfo = getMacrobeatInfo(state, solidBoundaryIndex);
  if (!mbInfo) {return null;}
  return mbInfo.endColumn + 1;
}

type PitchRendererOptions = Parameters<typeof getModulatedColumnX>[1];
type ModulationRendererOptions = Parameters<typeof renderModulationMarkers>[1];

export type VolumeIconState = 'normal' | 'hover' | 'active';

type DrumNote = PlacedNote & {
  isDrum?: boolean;
  drumTrack?: string | number | null;
};

export type DrumGridRenderOptions = PitchRendererOptions & {
  placedNotes: DrumNote[];
  placedTonicSigns: TonicSign[];
  columnWidths: number[];
  musicalColumnWidths?: number[];
  cellWidth: number;
  cellHeight: number;
  macrobeatGroupings: number[];
  macrobeatBoundaryStyles: MacrobeatBoundaryStyle[];
  modulationMarkers?: ModulationMarker[];
  baseMicrobeatPx: number;
  volumeIconState?: VolumeIconState;
};

function getColumnX(index: number, options: DrumGridRenderOptions): number {
  // Always use the rendererUtils getColumnX (imported as getModulatedColumnX)
  // This handles both modulated and unmodulated cases correctly with canvas-space coordinates
  const result = getModulatedColumnX(index, options);

  return result;
}

export function drawDrumShape(
  ctx: CanvasRenderingContext2D,
  drumRow: number,
  x: number,
  y: number,
  width: number,
  height: number,
  scale = 1.0
): void {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const size = Math.min(width, height) * 0.4 * scale;
  ctx.beginPath();

  if (drumRow === 0) {
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx - size, cy + size);
    ctx.lineTo(cx + size, cy + size);
    ctx.closePath();
  } else if (drumRow === 1) {
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size, cy);
    ctx.lineTo(cx, cy + size);
    ctx.lineTo(cx - size, cy);
    ctx.closePath();
  } else {
    const sides = 5;
    for (let i = 0; i < sides; i++) {
      const angle = (2 * Math.PI / sides) * i - Math.PI / 2;
      const sx = cx + size * Math.cos(angle);
      const sy = cy + size * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(sx, sy);
      } else {
        ctx.lineTo(sx, sy);
      }
    }
    ctx.closePath();
  }
  ctx.fill();
}

function drawVerticalGridLines(ctx: CanvasRenderingContext2D, options: DrumGridRenderOptions): void {
  const { columnWidths, musicalColumnWidths, macrobeatGroupings, macrobeatBoundaryStyles, placedTonicSigns } = options;
  // canvas-space columns only (no legends)
  const musicalColumns = (musicalColumnWidths && musicalColumnWidths.length > 0)
    ? musicalColumnWidths
    : columnWidths;
  const totalColumns = musicalColumns.length;

  // Build macrobeat boundary positions in canvas-space using selector to stay aligned with UI buttons.
  const macrobeatBoundaries: number[] = macrobeatGroupings.map((_, i) => {
    const { endColumn } = getMacrobeatInfo(store.state, i);
    return endColumn + 1;
  });

  for (let canvasCol = 0; canvasCol <= totalColumns; canvasCol++) {
    const isGridStartOrEnd = canvasCol === 0 || canvasCol === totalColumns;
    const isTonicColumnStart = isTonicColumn(canvasCol, placedTonicSigns);
    const isTonicColumnEnd = placedTonicSigns.some(ts => canvasCol === ts.columnIndex + 2);
    const isMacrobeatEnd = macrobeatBoundaries.includes(canvasCol);
    const shouldDraw = shouldDrawVerticalLineAtColumn(canvasCol, placedTonicSigns);

    if (!shouldDraw) {continue;}

    let style: { lineWidth: number; strokeStyle: string; dash: number[] } | null = null;
    if (isGridStartOrEnd || isTonicColumnStart || isTonicColumnEnd) {
      style = { lineWidth: 2, strokeStyle: '#adb5bd', dash: [] };
    } else if (isMacrobeatEnd) {
      const mbIndex = macrobeatBoundaries.indexOf(canvasCol);
      const boundaryStyle = macrobeatBoundaryStyles[mbIndex];
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

export function drawDrumGrid(ctx: CanvasRenderingContext2D, options: DrumGridRenderOptions): void {
  const { placedNotes, columnWidths, cellWidth, cellHeight, placedTonicSigns } = options;

  ctx.clearRect(0, 0, getLogicalCanvasWidth(ctx.canvas), getLogicalCanvasHeight(ctx.canvas));

  const drumRowHeight = Math.max(BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR * cellHeight);
  // columnWidths is now canvas-space, but this function uses full-space logic
  // Add 4 for legend columns (2 left + 2 right)
  const totalColumns = columnWidths.length + 4;
  const drumLabels = ['H', 'M', 'L'];

  const lightRanges = buildLightRanges(options);
  const segments = buildSegments(0, getLogicalCanvasWidth(ctx.canvas), lightRanges);
  const { stroke: anacrusisStroke } = getAnacrusisColors();

  // Draw horizontal lines across the entire drum grid canvas
  // The canvas starts at x=0 (already positioned after left legend by layout)
  for (let i = 0; i < 4; i++) {
    const y = i * drumRowHeight;
    segments.forEach(seg => {
      if (seg.to <= seg.from) {return;}
      ctx.beginPath();
      ctx.moveTo(seg.from, y);
      ctx.lineTo(seg.to, y);
      ctx.strokeStyle = seg.light ? anacrusisStroke : '#ced4da';
      ctx.lineWidth = 1;
      ctx.globalAlpha = seg.light ? 0.6 : 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }

  drawVerticalGridLines(ctx, options);

  // Iterate through canvas-space columns (drumGrid is vertically aligned with pitchGrid)
  for (let canvasCol = 0; canvasCol < totalColumns; canvasCol++) {
    // Skip rendering if this column is within any tonic span (columnIndex or columnIndex + 1)
    if (placedTonicSigns.some(ts =>
      canvasCol === ts.columnIndex || canvasCol === ts.columnIndex + 1
    )) {
      continue;
    }

    const x = getColumnX(canvasCol, options);
    let currentCellWidth: number;
    if (options.modulationMarkers && options.modulationMarkers.length > 0) {
      const nextX = getColumnX(canvasCol + 1, options);
      currentCellWidth = nextX - x;
    } else {
      const widthMultiplier = columnWidths[canvasCol] ?? 0;
      currentCellWidth = widthMultiplier * cellWidth;
    }

    for (let row = 0; row < 3; row++) {
      const y = row * drumRowHeight;
      const drumTrack = drumLabels[row]!;

      // Notes are stored in CANVAS-SPACE (0 = first musical beat)
      const drumHit = placedNotes.find(note =>
        note.isDrum &&
        (typeof note.drumTrack === 'number' ? String(note.drumTrack) : note.drumTrack) === drumTrack &&
        note.startColumnIndex === canvasCol
      );

      if (drumHit) {
        ctx.fillStyle = drumHit.color;
        // Pass canvas-space column to animation
        const animationScale = DrumPlayheadRenderer.getAnimationScale(canvasCol, drumTrack);
        drawDrumShape(ctx, row, x, y, currentCellWidth, drumRowHeight, animationScale);
      } else {
        ctx.fillStyle = '#ced4da';
        ctx.beginPath();
        ctx.arc(x + currentCellWidth / 2, y + drumRowHeight / 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (options.modulationMarkers && options.modulationMarkers.length > 0) {
    renderModulationMarkers(ctx, options as unknown as ModulationRendererOptions);
  }
}
