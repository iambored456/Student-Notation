// js/services/pixelMapService.ts
/**
 * Pixel mapping service that converts canvas-space columns to pixel positions
 * with modulation support. Provides cached pixel positions for fast rendering.
 */

import columnMapService from './columnMapService.ts';
import { createCoordinateMapping, type CoordinateMapping } from '../rhythm/modulationMapping.js';
import type { AppState, ModulationMarker } from '../../types/state.js';

/**
 * Pixel position information for a column
 */
export interface ColumnPixelPosition {
  canvasIndex: number;
  xStart: number;              // Left edge pixel position
  xEnd: number;                // Right edge pixel position
  width: number;               // Pixel width
  modulationScale: number;     // Applied modulation scale factor
}

/**
 * Complete pixel map with all column positions
 */
export interface PixelMap {
  columnPositions: Map<number, ColumnPixelPosition>;
  totalPixelWidth: number;
}

/**
 * Render options required for pixel calculations
 */
export interface RenderOptions {
  cellWidth: number;
  modulationMarkers?: ModulationMarker[];
  baseMicrobeatPx?: number;
  columnWidths?: number[];
  state?: AppState;
}

/**
 * Singleton service managing pixel-space coordinate mapping
 */
class PixelMapService {
  private cachedPixelMap: PixelMap | null = null;
  private lastPixelMapHash: string | null = null;

  /**
   * Gets pixel position for a canvas-space column
   */
  getColumnPixelPosition(canvasIndex: number, options: RenderOptions, state: AppState): ColumnPixelPosition {
    const pixelMap = this.getOrBuildPixelMap(options, state);

    const cached = pixelMap.columnPositions.get(Math.floor(canvasIndex));
    if (cached) {return cached;}

    // Special case: if asking for position right after last column (e.g., index 32 when we have 0-31),
    // return the end-of-grid position based on totalPixelWidth
    const totalColumns = pixelMap.columnPositions.size;
    if (canvasIndex === totalColumns) {
      const lastColumn = pixelMap.columnPositions.get(totalColumns - 1);
      if (lastColumn) {
        // Return a synthetic position at the end of the grid
        return {
          canvasIndex,
          xStart: pixelMap.totalPixelWidth,
          xEnd: pixelMap.totalPixelWidth,
          width: 0,
          modulationScale: 1.0
        };
      }
    }

    // Fallback for out-of-bounds indices
    return this.calculateFallbackPosition(canvasIndex, options);
  }

  /**
   * Converts canvas-space column to pixel X position
   * Handles fractional indices for smooth positioning
   */
  columnToPixelX(canvasIndex: number, options: RenderOptions, state: AppState): number {
    const integerPart = Math.floor(canvasIndex);
    const fractionalPart = canvasIndex - integerPart;

    const position = this.getColumnPixelPosition(integerPart, options, state);

    return position.xStart + (fractionalPart * position.width);
  }

  /**
   * Converts pixel X to canvas-space column (with fractional part)
   */
  pixelXToColumn(pixelX: number, options: RenderOptions, state: AppState): number {
    const pixelMap = this.getOrBuildPixelMap(options, state);

    // Find the column containing this pixel X
    const positions = Array.from(pixelMap.columnPositions.values())
      .sort((a, b) => a.canvasIndex - b.canvasIndex);

    for (const pos of positions) {
      if (pixelX >= pos.xStart && pixelX < pos.xEnd) {
        const fractionIntoColumn = (pixelX - pos.xStart) / pos.width;
        return pos.canvasIndex + fractionIntoColumn;
      }
    }

    // Out of bounds - return nearest
    if (positions.length === 0) {return 0;}
    if (pixelX < positions[0].xStart) {return 0;}
    return positions[positions.length - 1].canvasIndex;
  }

  /**
   * Invalidates pixel map cache
   */
  invalidate(): void {
    this.cachedPixelMap = null;
    this.lastPixelMapHash = null;
  }

  /**
   * Gets or builds the pixel map, using cache if valid
   */
  private getOrBuildPixelMap(options: RenderOptions, state: AppState): PixelMap {
    const currentHash = this.buildPixelMapHash(options, state);

    if (this.cachedPixelMap && this.lastPixelMapHash === currentHash) {
      return this.cachedPixelMap;
    }

    this.cachedPixelMap = this.buildPixelMap(options, state);
    this.lastPixelMapHash = currentHash;
    return this.cachedPixelMap;
  }

  /**
   * Builds hash for cache invalidation
   */
  private buildPixelMapHash(options: RenderOptions, state: AppState): string {
    const modulationHash = options.modulationMarkers
      ? JSON.stringify(options.modulationMarkers.map(m => ({ id: m.id, col: m.columnIndex, ratio: m.ratio })))
      : 'none';

    return JSON.stringify({
      cellWidth: options.cellWidth,
      modulation: modulationHash,
      columnCount: state ? columnMapService.getColumnMap(state).totalCanvasColumns : 0
    });
  }

  /**
   * Builds the pixel map from column map and modulation data
   */
  private buildPixelMap(options: RenderOptions, state: AppState): PixelMap {
    const { cellWidth, modulationMarkers } = options;
    const columnMap = columnMapService.getColumnMap(state);
    const positions = new Map<number, ColumnPixelPosition>();

    // Create coordinate mapping for modulation
    const baseMicrobeatPx = options.baseMicrobeatPx ?? cellWidth;
    const modulationMapping: CoordinateMapping | null =
      (modulationMarkers && modulationMarkers.length > 0)
        ? createCoordinateMapping(modulationMarkers, baseMicrobeatPx, state)
        : null;

    let xAccumulator = 0;

    // Build position for each canvas-space column
    for (const entry of columnMap.entries) {
      if (entry.canvasIndex === null) {continue;} // Skip legends

      const unmodulatedWidth = entry.widthMultiplier * cellWidth;
      const modulationScale = modulationMapping
        ? modulationMapping.getScaleForColumn(entry.canvasIndex)
        : 1.0;
      const modulatedWidth = unmodulatedWidth * modulationScale;

      positions.set(entry.canvasIndex, {
        canvasIndex: entry.canvasIndex,
        xStart: xAccumulator,
        xEnd: xAccumulator + modulatedWidth,
        width: modulatedWidth,
        modulationScale
      });

      xAccumulator += modulatedWidth;
    }

    return {
      columnPositions: positions,
      totalPixelWidth: xAccumulator
    };
  }

  /**
   * Fallback position calculation for edge cases
   */
  private calculateFallbackPosition(canvasIndex: number, options: RenderOptions): ColumnPixelPosition {
    const { cellWidth } = options;
    const defaultWidth = cellWidth;

    return {
      canvasIndex,
      xStart: canvasIndex * defaultWidth,
      xEnd: (canvasIndex + 1) * defaultWidth,
      width: defaultWidth,
      modulationScale: 1.0
    };
  }
}

// Singleton instance
const pixelMapService = new PixelMapService();

// Set up cache invalidation on state changes
// Note: Store event hooks will be registered after store is initialized
export function registerStoreHooks(store: any): void {
  // Invalidate when modulation markers or rhythm structure changes
  store.on('rhythmStructureChanged', () => {
    pixelMapService.invalidate();
  });

  // Note: For now we rely on rhythmStructureChanged which covers
  // modulation marker changes. Future work: add specific event if needed.
}

export default pixelMapService;

// ============================================================================
// Public API Functions - rendererUtils-compatible
// ============================================================================

/**
 * Converts canvas-space column index to pixel X position
 * Compatible with rendererUtils.getColumnX signature
 */
export function getColumnX(canvasIndex: number, options: RenderOptions): number {
  const state = options.state || (options as any);
  return pixelMapService.columnToPixelX(canvasIndex, options, state);
}

/**
 * Converts pixel X position to canvas-space column index
 * Compatible with rendererUtils.getColumnFromX signature
 */
export function getColumnFromX(pixelX: number, options: RenderOptions): number {
  const state = options.state || (options as any);
  return pixelMapService.pixelXToColumn(pixelX, options, state);
}

/**
 * Gets pixel position details for a canvas-space column
 */
export function getColumnPixelPosition(canvasIndex: number, options: RenderOptions): ColumnPixelPosition {
  const state = options.state || (options as any);
  return pixelMapService.getColumnPixelPosition(canvasIndex, options, state);
}

/**
 * Gets the total pixel width of the canvas with modulation applied
 */
export function getTotalPixelWidth(options: RenderOptions): number {
  const state = options.state || (options as any);
  const pixelMap = pixelMapService['getOrBuildPixelMap'](options, state);
  return pixelMap.totalPixelWidth;
}
