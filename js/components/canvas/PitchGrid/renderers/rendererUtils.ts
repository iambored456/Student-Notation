// js/components/Canvas/PitchGrid/renderers/rendererUtils.ts
import LayoutService from '../../../../services/layoutService.ts';
import { createCoordinateMapping } from '../../../../rhythm/modulationMapping.js';
import store from '@state/index.ts';
import type { AppState, ModulationMarker, CanvasSpaceColumn } from '../../../../../types/state.js';

/**
 * COORDINATE SYSTEM NOTE:
 * All functions in this file work with CANVAS-SPACE coordinates (0 = first musical beat).
 * - getColumnX(): Converts canvas-space index → pixel position
 * - getColumnFromX(): Converts pixel position → canvas-space index
 * - columnWidths and musicalColumnWidths both represent canvas-space columns
 */

type RendererOptions = Partial<AppState> & {
  columnWidths: number[];  // Canvas-space column widths (musical columns only)
  musicalColumnWidths?: number[];  // DEPRECATED: Same as columnWidths, will be removed
  cellWidth: number;
  cellHeight: number;
  modulationMarkers?: ModulationMarker[];
  baseMicrobeatPx?: number;
};

type CoordinateMapping = ReturnType<typeof createCoordinateMapping>;

// Cache for coordinate mapping to avoid recalculating on every frame
let cachedCoordinateMapping: CoordinateMapping | null = null;
let lastMappingHash: string | null = null;

// Cache for viewport info to avoid recalculating on every row
let cachedViewportInfo: ReturnType<typeof LayoutService.getViewportInfo> | null = null;
let lastViewportFrame: number | null = null;

// Set up cache invalidation when modulation markers change
store.on('modulationMarkersChanged', () => {
  invalidateCoordinateMapping();
});

// Set up cache invalidation when viewport changes
store.on('scrollChanged', () => {
  cachedViewportInfo = null;
  lastViewportFrame = null;
});

store.on('zoomChanged', () => {
  cachedViewportInfo = null;
  lastViewportFrame = null;
});

/**
 * Gets or creates a coordinate mapping for modulation markers
 * @param options Render options containing modulation markers
 * @returns Coordinate mapping object
 */
function getCoordinateMapping(options: RendererOptions): CoordinateMapping {
  const currentHash = JSON.stringify({
    markers: options.modulationMarkers || [],
    baseMicrobeatPx: options.baseMicrobeatPx ?? options.cellWidth ?? 40
  });

  if (cachedCoordinateMapping && currentHash === lastMappingHash) {
    return cachedCoordinateMapping;
  }

  const baseMicrobeatPx = options.baseMicrobeatPx ?? options.cellWidth ?? 40;
  cachedCoordinateMapping = createCoordinateMapping(options.modulationMarkers || [], baseMicrobeatPx, options as AppState);
  lastMappingHash = currentHash;

  return cachedCoordinateMapping;
}

/**
 * Gets cached viewport info to avoid recalculating on every row
 * @returns Viewport info object
 */
function getCachedViewportInfo(): ReturnType<typeof LayoutService.getViewportInfo> {
  const currentFrame = performance.now();

  // Invalidate cache if it's from a different frame (1ms threshold)
  if (!cachedViewportInfo || !lastViewportFrame || (currentFrame - lastViewportFrame) > 1) {
    cachedViewportInfo = LayoutService.getViewportInfo();
    lastViewportFrame = currentFrame;
  }

  return cachedViewportInfo;
}

/**
 * Gets X position for a canvas-space column index
 * @param index Canvas-space column (0 = first musical beat)
 * @param options Render options with columnWidths (canvas-space)
 * @returns X position on musical canvas in pixels
 */
export function getColumnX(index: number, options: RendererOptions): number {
  // Use musicalColumnWidths if available and non-empty, otherwise columnWidths
  // Note: musicalColumnWidths is canvas-space (musical columns only)
  // columnWidths may be full-space or canvas-space depending on migration state
  const hasMusicalWidths = options.musicalColumnWidths && options.musicalColumnWidths.length > 0;
  const canvasSpaceWidths = hasMusicalWidths
    ? options.musicalColumnWidths
    : options.columnWidths || [];
  const cellWidth = options.cellWidth;

  // Debug logging for first few calls to track coordinate space issues
  if (index < 3 && typeof window !== 'undefined' && !(window as any).__columnXDebugLogged) {
    if (index === 2) {
      (window as any).__columnXDebugLogged = true;
    }
  }

  const integerPart = Math.floor(index);
  const fractionalPart = index - integerPart;

  const mapping = (options.modulationMarkers && options.modulationMarkers.length > 0)
    ? getCoordinateMapping(options)
    : null;

  let canvasX = 0;

  // Accumulate from column 0 (first musical beat) to index
  for (let col = 0; col < integerPart; col++) {
    // Handle sparse arrays by defaulting to 1 (standard column width)
    const widthMultiplier = canvasSpaceWidths[col] !== undefined ? canvasSpaceWidths[col]! : 1;
    const unmodulatedWidth = widthMultiplier * cellWidth;

    // Apply modulation scale (col is canvas-space)
    const scale = mapping ? mapping.getScaleForColumn(col) : 1.0;
    const modulatedWidth = unmodulatedWidth * scale;

    canvasX += modulatedWidth;
  }

  // Add fractional part
  if (fractionalPart > 0 && integerPart < canvasSpaceWidths.length) {
    const widthMultiplier = canvasSpaceWidths[integerPart] !== undefined ? canvasSpaceWidths[integerPart]! : 1;
    const unmodulatedWidth = widthMultiplier * cellWidth;
    const scale = mapping ? mapping.getScaleForColumn(integerPart) : 1.0;
    const modulatedWidth = unmodulatedWidth * scale;
    canvasX += fractionalPart * modulatedWidth;
  }

  return canvasX;
}

export function getRowY(rowIndex: number, options: RendererOptions): number {
  const viewportInfo = getCachedViewportInfo();
  const relativeRowIndex = rowIndex - viewportInfo.startRank;
  const halfUnit = options.cellHeight / 2;
  const yPosition = relativeRowIndex * halfUnit;
  return yPosition;
}

export function getPitchClass(pitchWithOctave: string): string {
  let pc = (pitchWithOctave || '').replace(/\d/g, '').trim();
  pc = pc.replace(/b/g, 'b-').replace(/#/g, 'b_');
  return pc;
}

export function getLineStyleFromPitchClass(pc: string): { lineWidth: number; dash: number[]; color: string } {
  switch (pc) {
    case 'C': return { lineWidth: 3.33, dash: [], color: '#adb5bd' };
    case 'E': return { lineWidth: 1, dash: [5, 5], color: '#adb5bd' }; // Use same pattern as vertical dashed lines
    case 'G': return { lineWidth: 1, dash: [], color: '#dee2e6' };
    case 'B':
    case 'A':
    case 'F':
    case 'Eb/Db':
    case 'Db/C#':
      return { lineWidth: 1, dash: [], color: '#ced4da' }; // Simple solid gray lines for conditional pitches
    default: return { lineWidth: 1, dash: [], color: '#ced4da' };
  }
}

export function getVisibleRowRange(): { startRow: number; endRow: number } {
  const viewportInfo = LayoutService.getViewportInfo();
  const { startRank, endRank } = viewportInfo; // FIXED: use startRank/endRank instead of startRow/endRow
  return { startRow: startRank, endRow: endRank };
}

/**
 * Gets the current coordinate mapping for modulation (exposed for other renderers)
 * @param options Render options
 * @returns Coordinate mapping object
 */
export function getCurrentCoordinateMapping(options: RendererOptions): CoordinateMapping {
  return getCoordinateMapping(options);
}

/**
 * Invalidates the coordinate mapping cache (call when modulation markers change)
 */
export function invalidateCoordinateMapping(): void {
  cachedCoordinateMapping = null;
  lastMappingHash = null;
}

/**
 * Converts canvas X to canvas-space column index
 * @param canvasX X position on musical canvas
 * @param options Render options
 * @returns Canvas-space column index (0 = first musical beat)
  */
export function getColumnFromX(canvasX: number, options: RendererOptions): number {
  // Use musicalColumnWidths if available (deprecated), otherwise columnWidths
  const canvasSpaceWidths = options.musicalColumnWidths || options.columnWidths || [];
  const cellWidth = options.cellWidth;
  if (cellWidth === 0) return 0;

  // Iterate through canvas-space columns
  for (let i = 0; i < canvasSpaceWidths.length; i++) {
    const columnStartX = getColumnX(i, options);
    const columnEndX = getColumnX(i + 1, options);

    if (canvasX >= columnStartX && canvasX < columnEndX) {
      const columnWidth = columnEndX - columnStartX;
      if (columnWidth > 0) {
        const fractionIntoColumn = (canvasX - columnStartX) / columnWidth;
        return i + fractionIntoColumn;
      }
      return i;
    }
  }

  return canvasSpaceWidths.length > 0 ? canvasSpaceWidths.length - 1 : 0;
}

/**
 * Converts a canvas Y position back to a row index
 * @param canvasY Canvas y position
 * @param options Render options
 * @returns Row index (fractional for precision)
 */
export function getRowFromY(canvasY: number, options: RendererOptions): number {
  const viewportInfo = getCachedViewportInfo();
  const halfUnit = options.cellHeight / 2;
  const relativeRowIndex = canvasY / halfUnit;
  const rowIndex = relativeRowIndex + viewportInfo.startRank;
  return rowIndex;
}
