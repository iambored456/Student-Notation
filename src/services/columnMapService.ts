// js/services/columnMapService.ts
/**
 * Centralized column mapping service that manages the canonical column map
 * for all grid rendering and interaction logic. Provides O(1) coordinate
 * conversions between visual, canvas, and time column spaces with caching.
 *
 * Coordinate Systems:
 * - Visual: Full grid including left legends (2 cols) + musical + right legends (2 cols)
 * - Canvas: Musical columns only (0 = first beat), excludes legends, includes tonics
 * - Time: Time-bearing columns only (0 = first microbeat), excludes legends and tonics
 */

import { getPlacedTonicSigns } from '@state/selectors.ts';
import { SIDE_COLUMN_WIDTH, BEAT_COLUMN_WIDTH } from '@/core/constants.ts';
import type { AppState } from '../../types/state.js';

/**
 * Complete metadata for a single column
 */
export interface ColumnEntry {
  visualIndex: number;           // Full-space index (includes legends)
  canvasIndex: number | null;    // Canvas-space index (null for legends)
  timeIndex: number | null;      // Time-bearing index (null for non-playable)
  type: 'legend-left' | 'legend-right' | 'tonic' | 'beat';
  widthMultiplier: number;       // Column width in abstract units
  xOffsetUnmodulated: number;    // Cumulative X offset in abstract units
  macrobeatIndex: number | null; // Which macrobeat this column belongs to
  beatInMacrobeat: number | null; // Position within macrobeat (0-based)
  isMacrobeatStart: boolean;     // First beat of macrobeat
  isMacrobeatEnd: boolean;       // Last beat of macrobeat
  isPlayable: boolean;           // Can notes be placed here?
  tonicSignUuid: string | null;  // UUID if this is a tonic column
}

/**
 * Macrobeat boundary information in all coordinate spaces
 */
export interface MacrobeatBoundary {
  macrobeatIndex: number;
  visualColumn: number;          // Visual-space column at boundary
  canvasColumn: number;          // Canvas-space column at boundary
  timeColumn: number;            // Time-space column at boundary
  boundaryType: 'solid' | 'dashed' | 'anacrusis';
  isMeasureStart: boolean;       // True for solid boundaries
}

/**
 * Complete column map with all metadata and lookup tables
 */
export interface ColumnMap {
  entries: ColumnEntry[];

  // Fast bidirectional lookups (O(1))
  visualToCanvas: Map<number, number | null>;
  visualToTime: Map<number, number | null>;
  canvasToVisual: Map<number, number>;
  canvasToTime: Map<number, number | null>;
  timeToCanvas: Map<number, number>;
  timeToVisual: Map<number, number>;

  // Boundaries
  macrobeatBoundaries: MacrobeatBoundary[];

  // Totals
  totalVisualColumns: number;
  totalCanvasColumns: number;
  totalTimeColumns: number;
  totalWidthUnmodulated: number;
}

/**
 * Cache key for invalidation
 */
interface CacheKey {
  macrobeatGroupings: number[];
  tonicSignsHash: string;
  macrobeatBoundaryStyles: string[];
}

/**
 * Singleton service managing the canonical column map
 */
class ColumnMapService {
  private cachedMap: ColumnMap | null = null;
  private cacheKey: CacheKey | null = null;

  /**
   * Gets the column map, returning cached version if valid
   */
  getColumnMap(state: AppState): ColumnMap {
    const currentKey = this.buildCacheKey(state);

    if (this.cachedMap && this.isCacheValid(currentKey)) {
      return this.cachedMap;
    }

    this.cachedMap = this.buildColumnMap(state);
    this.cacheKey = currentKey;
    return this.cachedMap;
  }

  /**
   * Invalidates the cache (call when state changes)
   */
  invalidate(): void {
    console.log('[ColumnMapService] Cache invalidated');
    this.cachedMap = null;
    this.cacheKey = null;
  }

  /**
   * Builds cache key from relevant state
   */
  private buildCacheKey(state: AppState): CacheKey {
    const tonicSigns = getPlacedTonicSigns(state);
    const tonicSignsHash = tonicSigns
      .map(ts => `${ts.columnIndex}:${ts.preMacrobeatIndex}:${ts.uuid || ''}`)
      .sort()
      .join('|');

    return {
      macrobeatGroupings: [...state.macrobeatGroupings],
      tonicSignsHash,
      macrobeatBoundaryStyles: [...state.macrobeatBoundaryStyles]
    };
  }

  /**
   * Checks if cached map is still valid
   */
  private isCacheValid(newKey: CacheKey): boolean {
    if (!this.cacheKey) {return false;}

    return (
      this.cacheKey.tonicSignsHash === newKey.tonicSignsHash &&
      JSON.stringify(this.cacheKey.macrobeatGroupings) === JSON.stringify(newKey.macrobeatGroupings) &&
      JSON.stringify(this.cacheKey.macrobeatBoundaryStyles) === JSON.stringify(newKey.macrobeatBoundaryStyles)
    );
  }

  /**
   * Builds the complete column map from state
   */
  private buildColumnMap(state: AppState): ColumnMap {
    const { macrobeatGroupings, macrobeatBoundaryStyles } = state;
    const tonicSigns = getPlacedTonicSigns(state);
    const sortedTonics = [...tonicSigns].sort((a, b) => a.preMacrobeatIndex - b.preMacrobeatIndex);

    const entries: ColumnEntry[] = [];
    const macrobeatBoundaries: MacrobeatBoundary[] = [];

    let visualIndex = 0;
    let canvasIndex = 0;
    let timeIndex = 0;
    let xOffset = 0;
    let tonicCursor = 0;

    /**
     * Helper to add tonic columns for a specific macrobeat position
     */
    const addTonicColumns = (preMacrobeatIndex: number): void => {
      while (tonicCursor < sortedTonics.length) {
        const tonic = sortedTonics[tonicCursor];
        if (tonic.preMacrobeatIndex !== preMacrobeatIndex) {break;}

        const uuid = tonic.uuid || '';

        // Each tonic sign occupies 2 canvas columns (zero time)
        for (let i = 0; i < 2; i++) {
          entries.push({
            visualIndex,
            canvasIndex,
            timeIndex: null,
            type: 'tonic',
            widthMultiplier: BEAT_COLUMN_WIDTH,
            xOffsetUnmodulated: xOffset,
            macrobeatIndex: null,
            beatInMacrobeat: null,
            isMacrobeatStart: false,
            isMacrobeatEnd: false,
            isPlayable: false,
            tonicSignUuid: i === 0 ? uuid : null  // Only first column stores UUID
          });

          visualIndex++;
          canvasIndex++;
          xOffset += BEAT_COLUMN_WIDTH;
        }

        // Advance past all instances with same UUID
        const currentUuid = uuid;
        do {
          tonicCursor++;
        } while (
          tonicCursor < sortedTonics.length &&
          (sortedTonics[tonicCursor].uuid || '') === currentUuid
        );
      }
    };

    // Left legends (2 columns)
    for (let i = 0; i < 2; i++) {
      entries.push({
        visualIndex,
        canvasIndex: null,
        timeIndex: null,
        type: 'legend-left',
        widthMultiplier: SIDE_COLUMN_WIDTH,
        xOffsetUnmodulated: xOffset,
        macrobeatIndex: null,
        beatInMacrobeat: null,
        isMacrobeatStart: false,
        isMacrobeatEnd: false,
        isPlayable: false,
        tonicSignUuid: null
      });
      visualIndex++;
      xOffset += SIDE_COLUMN_WIDTH;
    }

    // Tonics before first macrobeat (preMacrobeatIndex = -1)
    addTonicColumns(-1);

    // Process each macrobeat
    macrobeatGroupings.forEach((grouping, mbIndex) => {
      // Add beat columns
      for (let beatIdx = 0; beatIdx < grouping; beatIdx++) {
        entries.push({
          visualIndex,
          canvasIndex,
          timeIndex,
          type: 'beat',
          widthMultiplier: BEAT_COLUMN_WIDTH,
          xOffsetUnmodulated: xOffset,
          macrobeatIndex: mbIndex,
          beatInMacrobeat: beatIdx,
          isMacrobeatStart: beatIdx === 0,
          isMacrobeatEnd: beatIdx === grouping - 1,
          isPlayable: true,
          tonicSignUuid: null
        });

        visualIndex++;
        canvasIndex++;
        timeIndex++;
        xOffset += BEAT_COLUMN_WIDTH;
      }

      // Record macrobeat boundary (at end of macrobeat)
      const boundaryStyle = macrobeatBoundaryStyles[mbIndex] || 'dashed';
      macrobeatBoundaries.push({
        macrobeatIndex: mbIndex,
        visualColumn: visualIndex - 1,
        canvasColumn: canvasIndex - 1,
        timeColumn: timeIndex - 1,
        boundaryType: boundaryStyle as 'solid' | 'dashed' | 'anacrusis',
        isMeasureStart: boundaryStyle === 'solid'
      });

      // Add tonics after this macrobeat
      addTonicColumns(mbIndex);
    });

    // Right legends (2 columns)
    for (let i = 0; i < 2; i++) {
      entries.push({
        visualIndex,
        canvasIndex: null,
        timeIndex: null,
        type: 'legend-right',
        widthMultiplier: SIDE_COLUMN_WIDTH,
        xOffsetUnmodulated: xOffset,
        macrobeatIndex: null,
        beatInMacrobeat: null,
        isMacrobeatStart: false,
        isMacrobeatEnd: false,
        isPlayable: false,
        tonicSignUuid: null
      });
      visualIndex++;
      xOffset += SIDE_COLUMN_WIDTH;
    }

    // Build lookup maps for O(1) conversions
    const visualToCanvas = new Map<number, number | null>();
    const visualToTime = new Map<number, number | null>();
    const canvasToVisual = new Map<number, number>();
    const canvasToTime = new Map<number, number | null>();
    const timeToCanvas = new Map<number, number>();
    const timeToVisual = new Map<number, number>();

    entries.forEach(entry => {
      visualToCanvas.set(entry.visualIndex, entry.canvasIndex);
      visualToTime.set(entry.visualIndex, entry.timeIndex);

      if (entry.canvasIndex !== null) {
        canvasToVisual.set(entry.canvasIndex, entry.visualIndex);
        canvasToTime.set(entry.canvasIndex, entry.timeIndex);
      }

      if (entry.timeIndex !== null) {
        if (entry.canvasIndex !== null) {
          timeToCanvas.set(entry.timeIndex, entry.canvasIndex);
        }
        timeToVisual.set(entry.timeIndex, entry.visualIndex);
      }
    });

    const columnMap = {
      entries,
      visualToCanvas,
      visualToTime,
      canvasToVisual,
      canvasToTime,
      timeToCanvas,
      timeToVisual,
      macrobeatBoundaries,
      totalVisualColumns: visualIndex,
      totalCanvasColumns: canvasIndex,
      totalTimeColumns: timeIndex,
      totalWidthUnmodulated: xOffset
    };

    return columnMap;
  }
}

// Singleton instance
const columnMapService = new ColumnMapService();

// Set up cache invalidation on state changes
// Note: Store event hooks will be registered after store is initialized
// This prevents circular dependency issues
export function registerStoreHooks(store: any): void {
  // Invalidate on any rhythm structure change
  store.on('rhythmStructureChanged', () => {
    columnMapService.invalidate();
  });

  // Note: For now we rely on rhythmStructureChanged which is already emitted
  // by rhythm actions. Future work: add specific granular events if needed.
}

export default columnMapService;

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Coordinate conversion helpers
 */

export function visualToCanvas(visualIndex: number, state: AppState): number | null {
  const map = columnMapService.getColumnMap(state);
  return map.visualToCanvas.get(visualIndex) ?? null;
}

export function visualToTime(visualIndex: number, state: AppState): number | null {
  const map = columnMapService.getColumnMap(state);
  return map.visualToTime.get(visualIndex) ?? null;
}

export function canvasToVisual(canvasIndex: number, state: AppState): number {
  const map = columnMapService.getColumnMap(state);
  const result = map.canvasToVisual.get(canvasIndex);
  return result !== undefined ? result : canvasIndex + 2; // +2 fallback for left legends
}

export function canvasToTime(canvasIndex: number, state: AppState): number | null {
  const map = columnMapService.getColumnMap(state);
  return map.canvasToTime.get(canvasIndex) ?? null;
}

export function timeToCanvas(timeIndex: number, state: AppState): number {
  const map = columnMapService.getColumnMap(state);
  const result = map.timeToCanvas.get(timeIndex);
  return result !== undefined ? result : timeIndex;
}

export function timeToVisual(timeIndex: number, state: AppState): number {
  const map = columnMapService.getColumnMap(state);
  const result = map.timeToVisual.get(timeIndex);
  return result !== undefined ? result : timeIndex + 2; // +2 fallback for left legends
}

/**
 * Batch conversions for performance
 */

export function batchCanvasToVisual(canvasIndices: number[], state: AppState): number[] {
  const map = columnMapService.getColumnMap(state);
  return canvasIndices.map(idx => map.canvasToVisual.get(idx) ?? idx + 2);
}

export function batchVisualToCanvas(visualIndices: number[], state: AppState): (number | null)[] {
  const map = columnMapService.getColumnMap(state);
  return visualIndices.map(idx => map.visualToCanvas.get(idx) ?? null);
}

/**
 * Column metadata queries
 */

export function getColumnEntry(visualIndex: number, state: AppState): ColumnEntry | null {
  const map = columnMapService.getColumnMap(state);
  return map.entries[visualIndex] || null;
}

export function getColumnEntryByCanvas(canvasIndex: number, state: AppState): ColumnEntry | null {
  const map = columnMapService.getColumnMap(state);
  const visualIndex = map.canvasToVisual.get(canvasIndex);
  return visualIndex !== undefined ? (map.entries[visualIndex] || null) : null;
}

export function isPlayableColumn(canvasIndex: number, state: AppState): boolean {
  const entry = getColumnEntryByCanvas(canvasIndex, state);
  return entry?.isPlayable ?? false;
}

export function getColumnType(canvasIndex: number, state: AppState): ColumnEntry['type'] | null {
  const entry = getColumnEntryByCanvas(canvasIndex, state);
  return entry?.type ?? null;
}

/**
 * Macrobeat boundary queries
 */

export function getMacrobeatBoundaries(state: AppState): MacrobeatBoundary[] {
  const map = columnMapService.getColumnMap(state);
  return map.macrobeatBoundaries;
}

export function getMacrobeatBoundary(macrobeatIndex: number, state: AppState): MacrobeatBoundary | null {
  const boundaries = getMacrobeatBoundaries(state);
  return boundaries.find(b => b.macrobeatIndex === macrobeatIndex) || null;
}

/**
 * Column width helpers
 */

export function getCanvasColumnWidths(state: AppState): number[] {
  const map = columnMapService.getColumnMap(state);
  const widths: number[] = [];

  for (const entry of map.entries) {
    if (entry.canvasIndex !== null) {
      widths[entry.canvasIndex] = entry.widthMultiplier;
    }
  }

  return widths;
}

export function getTotalCanvasWidth(state: AppState): number {
  const map = columnMapService.getColumnMap(state);
  let total = 0;

  for (const entry of map.entries) {
    if (entry.canvasIndex !== null) {
      total += entry.widthMultiplier;
    }
  }

  return total;
}
