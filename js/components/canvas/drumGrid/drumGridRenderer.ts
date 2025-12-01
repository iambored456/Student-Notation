// js/components/canvas/drumGrid/drumGridRenderer.ts
import { BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR } from '../../../core/constants.js';
import { shouldDrawVerticalLineAtColumn, isTonicColumn } from '../../../utils/tonicColumnUtils.ts';
import { getColumnX as getModulatedColumnX } from '@components/canvas/PitchGrid/renderers/rendererUtils.ts';
import { renderModulationMarkers } from '@components/canvas/PitchGrid/renderers/modulationRenderer.ts';
import DrumPlayheadRenderer from './drumPlayheadRenderer.js';
import { getIconPath } from '@utils/assetPaths.ts';
import { getLogicalCanvasWidth, getLogicalCanvasHeight } from '@utils/canvasDimensions.ts';
import type {
  _AppState,
  MacrobeatBoundaryStyle,
  ModulationMarker,
  PlacedNote,
  TonicSign
} from '../../../../types/state.js';

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

let volumeIconImage: HTMLImageElement | null = null;
const loadVolumeIcon = (): HTMLImageElement => {
  if (!volumeIconImage) {
    volumeIconImage = new Image();
    volumeIconImage.src = getIconPath('volume.svg');
  }
  return volumeIconImage;
};

function getColumnX(index: number, options: DrumGridRenderOptions): number {
  // Always use the rendererUtils getColumnX (imported as getModulatedColumnX)
  // This handles both modulated and unmodulated cases correctly with canvas-space coordinates
  return getModulatedColumnX(index, options);
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
  const totalColumns = columnWidths.length;
  const macrobeatBoundaries: number[] = [];

  let currentCol = 2;
  for (let i = 0; i < macrobeatGroupings.length; i++) {
    while (placedTonicSigns.some(ts => ts.columnIndex === currentCol)) {
      currentCol += 2;  // Tonic signs span 2 columns
    }
    const grouping = macrobeatGroupings[i] ?? 0;
    currentCol += grouping;
    macrobeatBoundaries.push(currentCol);
  }

  const drumAreaEnd = totalColumns - 2;
  const musicalColumns = musicalColumnWidths || columnWidths.slice(2, -2);

  // Iterate through full-space columns but convert to canvas-space for getColumnX
  for (let fullSpaceCol = 0; fullSpaceCol <= totalColumns; fullSpaceCol++) {
    let style: { lineWidth: number; strokeStyle: string; dash: number[] } | undefined;
    const isMusicAreaBoundary = fullSpaceCol === 2 || fullSpaceCol === drumAreaEnd;
    const isTonicColumnStart = isTonicColumn(fullSpaceCol, placedTonicSigns);
    const isTonicColumnEnd = placedTonicSigns.some(ts => fullSpaceCol === ts.columnIndex + 2);
    const isMacrobeatEnd = macrobeatBoundaries.includes(fullSpaceCol);
    const shouldDraw = shouldDrawVerticalLineAtColumn(fullSpaceCol, placedTonicSigns);

    if (!shouldDraw) {
      continue;
    }

    if (isMusicAreaBoundary || isTonicColumnStart || isTonicColumnEnd) {
      style = { lineWidth: 2, strokeStyle: '#adb5bd', dash: [] };
    } else if (isMacrobeatEnd) {
      const mbIndex = macrobeatBoundaries.indexOf(fullSpaceCol);
      if (mbIndex !== -1) {
        const boundaryStyle = macrobeatBoundaryStyles[mbIndex];
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

    // Convert full-space column to canvas-space for getColumnX
    const canvasSpaceCol = fullSpaceCol - 2;

    // Only draw lines for musical columns (canvas-space >= 0 and <= musicalColumns.length)
    if (canvasSpaceCol < 0 || canvasSpaceCol > musicalColumns.length) {
      continue;
    }

    const x = getColumnX(canvasSpaceCol, options);

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
  const totalColumns = columnWidths.length;
  const drumLabels = ['H', 'M', 'L'];

  // Draw horizontal lines across the entire drum grid canvas
  // The canvas starts at x=0 (already positioned after left legend by layout)
  for (let i = 0; i < 4; i++) {
    const y = i * drumRowHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(getLogicalCanvasWidth(ctx.canvas), y);
    ctx.strokeStyle = '#ced4da';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawVerticalGridLines(ctx, options);

  // Iterate through full-space columns (2 to totalColumns-2 are the musical columns)
  for (let fullSpaceCol = 2; fullSpaceCol < totalColumns - 2; fullSpaceCol++) {
    if (placedTonicSigns.some(ts => ts.columnIndex === fullSpaceCol)) {
      continue;
    }

    // Convert to canvas-space for getColumnX
    const canvasSpaceCol = fullSpaceCol - 2;
    const x = getColumnX(canvasSpaceCol, options);
    let currentCellWidth: number;
    if (options.modulationMarkers && options.modulationMarkers.length > 0) {
      const nextX = getColumnX(canvasSpaceCol + 1, options);
      currentCellWidth = nextX - x;
    } else {
      const widthMultiplier = columnWidths[fullSpaceCol] ?? 0;
      currentCellWidth = widthMultiplier * cellWidth;
    }

    for (let row = 0; row < 3; row++) {
      const y = row * drumRowHeight;
      const drumTrack = drumLabels[row]!;

      // Notes are stored in CANVAS-SPACE (0 = first musical beat)
      // We're iterating in full-space, so convert to canvas-space for comparison
      const drumHit = placedNotes.find(note =>
        note.isDrum &&
        (typeof note.drumTrack === 'number' ? String(note.drumTrack) : note.drumTrack) === drumTrack &&
        note.startColumnIndex === canvasSpaceCol
      );

      if (drumHit) {
        ctx.fillStyle = drumHit.color;
        // Pass canvas-space column to animation
        const animationScale = DrumPlayheadRenderer.getAnimationScale(canvasSpaceCol, drumTrack);
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
