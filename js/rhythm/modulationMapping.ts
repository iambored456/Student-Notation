// js/rhythm/modulationMapping.ts
import { getMacrobeatInfo } from '@state/selectors.ts';
import type { AppState, ModulationMarker, ModulationRatio } from '../../types/state.js';

type MarkerWithColumn = ModulationMarker & { columnIndex: number };

interface ModulationSegment {
  startColumn: number;
  endColumn: number;
  scale: number;
  marker?: MarkerWithColumn;
}

interface CoordinateMapping {
  segments: ModulationSegment[];
  microbeatToCanvasX(microbeatIndex: number): number;
  canvasXToMicrobeat(canvasX: number): number;
  getSegmentAtX(canvasX: number): ModulationSegment | null;
  getGhostGridPositions(segment: ModulationSegment, options: GhostGridOptions): number[];
  getScaleForColumn(columnIndex: number): number;
}

interface GhostGridOptions {
  columnWidths?: number[];
  cellWidth?: number;
}

const modulationDebugMessages: { level: string; args: unknown[] }[] = [];

function recordModulationDebug(level: string, ...args: unknown[]): void {
  modulationDebugMessages.push({ level, args });
}

// Modulation ratio constants
export const MODULATION_RATIOS = {
  COMPRESSION_2_3: 2 / 3,  // 0.6666666667
  EXPANSION_3_2: 3 / 2     // 1.5
} as const satisfies Record<'COMPRESSION_2_3' | 'EXPANSION_3_2', ModulationRatio>;

/**
 * Converts a measure index to a canvas-space column index
 *
 * IMPORTANT: Returns column index in CANVAS-SPACE (0 = first musical beat).
 * This aligns with the canvas architecture where legends are in separate canvases.
 *
 * @param {number} measureIndex - Measure index (0 = start, 1+ = after measure boundaries)
 * @param {Object} state - Application state with macrobeatGroupings
 * @returns {number} Column index in canvas-space (0-based, first beat = 0)
 */
function measureIndexToColumnIndex(measureIndex: number, state: Pick<AppState, 'macrobeatGroupings'> | null | undefined): number {
  recordModulationDebug('log', '[MODULATION] measureIndexToColumnIndex called:', {
    measureIndex,
    hasState: !!state
  });

  if (!state || !state.macrobeatGroupings) {
    recordModulationDebug('warn', '[MODULATION] No state or macrobeatGroupings provided for measure conversion');
    const fallbackColumn = measureIndex * 4; // Assume ~4 columns per measure
    recordModulationDebug('log', '[MODULATION] Using fallback calculation:', fallbackColumn);
    return fallbackColumn;
  }

  if (measureIndex === 0) {
    // Start of first measure (column 0 in canvas-space)
    recordModulationDebug('log', '[MODULATION] Measure 0 at canvas-space column 0');
    return 0;
  }

  // Measure index is 1-based (measureIndex 1 = "after macrobeat 0")
  // Convert to 0-based macrobeatIndex
  const macrobeatIndex = measureIndex - 1;
  recordModulationDebug('log', '[MODULATION] Converting measureIndex', measureIndex, 'to macrobeatIndex:', macrobeatIndex);

  const measureInfo = getMacrobeatInfo(state as AppState, macrobeatIndex);
  recordModulationDebug('log', '[MODULATION] getMacrobeatInfo result:', measureInfo);

  if (measureInfo) {
    // getMacrobeatInfo now returns CANVAS-SPACE columns (0 = first musical beat)
    // endColumn is the LAST column of the measure, so we add 1 to get the first column AFTER the measure
    const canvasColumnAfterMeasure = measureInfo.endColumn + 1;
    // This is the first column after the measure boundary, where modulation starts
    recordModulationDebug('log', '[MODULATION] Found measure info, canvas-space endColumn:', measureInfo.endColumn, 'first column after:', canvasColumnAfterMeasure);
    return canvasColumnAfterMeasure;
  }

  recordModulationDebug('warn', '[MODULATION] Could not find measure info for index:', measureIndex);
  // Use a more reasonable fallback based on average column width
  const fallbackColumn = measureIndex * 4; // Assume ~4 columns per measure
  recordModulationDebug('log', '[MODULATION] Using improved fallback calculation:', fallbackColumn);
  return fallbackColumn;
}

/**
 * Creates a new modulation marker at a measure boundary
 * @param {number} measureIndex - Index of the measure after which modulation starts
 * @param {number} ratio - Modulation ratio (2/3 or 3/2)
 * @param {number} xPosition - Optional X position override (for accurate placement)
 * @param {number} columnIndex - Optional column index for stable positioning
 * @param {number} macrobeatIndex - Optional macrobeat index for stable positioning
 * @returns {Object} ModulationMarker object
 */
export function createModulationMarker(
  measureIndex: number,
  ratio: ModulationRatio,
  xPosition: number | null = null,
  columnIndex: number | null = null,
  macrobeatIndex: number | null = null
): ModulationMarker {
  return {
    id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    measureIndex,
    ratio,
    active: true,
    xPosition, // Store the actual boundary position if provided
    columnIndex, // Store column index for stable positioning
    macrobeatIndex // Store macrobeat index for stable positioning
  };
}

/**
 * Gets display text for a modulation ratio
 * @param {number} ratio - The modulation ratio
 * @returns {string} Display text like "2:3" or "3:2"
 */
export function getModulationDisplayText(ratio: number): string {
  if (Math.abs(ratio - MODULATION_RATIOS.COMPRESSION_2_3) < 0.001) {
    return '2:3';
  } else if (Math.abs(ratio - MODULATION_RATIOS.EXPANSION_3_2) < 0.001) {
    return '3:2';
  }
  return `${ratio}`;
}

/**
 * Gets the color for a modulation marker based on ratio
 * @param {number} ratio - The modulation ratio
 * @returns {string} CSS color string
 */
export function getModulationColor(ratio: number): string {
  if (Math.abs(ratio - MODULATION_RATIOS.COMPRESSION_2_3) < 0.001) {
    return '#dc3545'; // Red for compression
  } else if (Math.abs(ratio - MODULATION_RATIOS.EXPANSION_3_2) < 0.001) {
    return '#007bff'; // Blue for expansion
  }
  return '#6c757d'; // Gray fallback
}

/**
 * Creates an empty coordinate mapping (no modulation)
 * @returns {Object} Empty mapping functions
 */
function createEmptyMapping(): CoordinateMapping {
  const segments: ModulationSegment[] = [{
    startColumn: 0,
    endColumn: Infinity,
    scale: 1.0
  }];

  return {
    segments,

    getScaleForColumn(_columnIndex: number): number {
      return 1.0; // No modulation
    },

    microbeatToCanvasX(): number {
      // This method is no longer used - getColumnX handles everything
      return 0;
    },

    canvasXToMicrobeat(): number {
      // This method is no longer used
      return 0;
    },

    getSegmentAtX(): ModulationSegment | null {
      return segments[0] || null;
    },

    getGhostGridPositions(): number[] {
      return []; // No ghost grid when no modulation
    }
  };
}

export function createCoordinateMapping(markers: ModulationMarker[], baseMicrobeatPx: number, state: AppState | null = null): CoordinateMapping {
  // Early return if no markers
  if (!markers || markers.length === 0) {
    return createEmptyMapping();
  }

  // Sort markers by measure index
  const sortedMarkers = [...markers.filter(m => m.active)].sort((a, b) => a.measureIndex - b.measureIndex);

  // If no active markers, return empty mapping
  if (sortedMarkers.length === 0) {
    return createEmptyMapping();
  }

  recordModulationDebug('log', '[MODULATION] Creating coordinate mapping for markers:', sortedMarkers);

  // Convert measure-based markers to column indices using state info
  const markersWithColumn: MarkerWithColumn[] = sortedMarkers.map(marker => {
    // Always calculate from measure index for accurate positioning
    // Don't trust stored xPosition as it may be from mouse clicks or outdated
    const columnIndex = measureIndexToColumnIndex(marker.measureIndex, state);
    recordModulationDebug('log', `[MODULATION] Marker at measure ${marker.measureIndex} calculated column=${columnIndex}`);
    recordModulationDebug('log', `[MODULATION] Full marker data:`, marker);
    recordModulationDebug('log', `[MODULATION] Final marker position:`, {
      id: marker.id,
      measureIndex: marker.measureIndex,
      columnIndex
    });

    return {
      ...marker,
      columnIndex
    };
  });

  // Create segments with cumulative scaling based on column indices
  const segments: ModulationSegment[] = [];
  let cumulativeScale = 1.0;

  // Add initial segment (before first marker)
  const firstMarker = markersWithColumn[0];
  if (markersWithColumn.length === 0 || (firstMarker && firstMarker.columnIndex > 0)) {
    // Initial segment ends where the modulated segment starts
    // marker.columnIndex is the first column after the measure boundary
    const endColumn = firstMarker ? firstMarker.columnIndex : Infinity;
    segments.push({
      startColumn: 0,
      endColumn: endColumn,
      scale: 1.0
    });
  }

  // Process each marker to create segments
  for (let i = 0; i < markersWithColumn.length; i++) {
    const marker = markersWithColumn[i]!;
    const nextMarker = markersWithColumn[i + 1];
    const nextMarkerColumn = nextMarker ? nextMarker.columnIndex : Infinity;

    // Update cumulative scale
    cumulativeScale *= marker.ratio;

    // The marker column represents the first column AFTER the measure boundary (canvas-space)
    // This is the first column that should be affected by modulation
    // Segments use canvas-space column indices (0 = first musical beat)
    segments.push({
      startColumn: marker.columnIndex,  // Canvas-space
      endColumn: nextMarkerColumn,  // Canvas-space
      scale: cumulativeScale,
      marker
    });
  }

  const mapping: CoordinateMapping = {
    segments,

    /**
     * Gets the modulation scale for a given column index
     * @param {number} columnIndex - Column index in musical space
     * @returns {number} Scale factor (1.0 = no modulation, 0.667 = compressed, 1.5 = expanded)
     */
    getScaleForColumn(columnIndex: number): number {
      // Find which segment this column belongs to
      for (const segment of segments) {
        if (columnIndex >= segment.startColumn && columnIndex < segment.endColumn) {
          return segment.scale;
        }
      }
      // If not in any segment, return 1.0 (no modulation)
      return 1.0;
    },

    /**
     * Converts microbeat index to canvas x position
     * NOTE: This method is deprecated - getColumnX in rendererUtils now handles modulation directly
     * @param {number} microbeatIndex - The microbeat index
     * @returns {number} Canvas x position
     */
    microbeatToCanvasX(_microbeatIndex: number): number {
      // This method is no longer used - getColumnX handles everything
      return 0;
    },

    /**
     * Converts canvas x position to microbeat index
     * NOTE: This method is deprecated - coordinate conversion now handled by getColumnFromX
     * @param {number} canvasX - Canvas x position
     * @returns {number} Microbeat index
     */
    canvasXToMicrobeat(_canvasX: number): number {
      // This method is no longer used
      return 0;
    },

    /**
     * Gets the segment containing a given canvas x position
     * NOTE: This method is deprecated - not used in new column-based approach
     * @param {number} canvasX - Canvas x position
     * @returns {Object|null} Segment object or null if not found
     */
    getSegmentAtX(_canvasX: number): ModulationSegment | null {
      return segments[0] || null;
    },

    /**
     * Gets all ghost grid positions for a segment based on actual grid structure
     * NOTE: This method is deprecated - ghost grid now handled differently
     * @param {Object} segment - Segment object
     * @param {Object} options - Render options with grid structure
     * @returns {Array} Array of x positions for ghost grid lines
     */
    getGhostGridPositions(_segment: ModulationSegment, _options: GhostGridOptions): number[] {
      // Ghost grid is no longer used in the new column-based approach
      return [];
    }
  };

  return mapping;
}

/**
 * Converts canvas x to time in seconds for audio scheduling
 * NOTE: This function is deprecated and may need to be rewritten for column-based approach
 * @param {number} canvasX - Canvas x position
 * @param {Object} coordinateMapping - Result from createCoordinateMapping
 * @param {number} baseMicrobeatDuration - Base duration per microbeat in seconds
 * @returns {number} Time in seconds
 */
export function canvasXToSeconds(_canvasX: number, _coordinateMapping: CoordinateMapping, _baseMicrobeatDuration: number): number {
  // TODO: Reimplement for column-based modulation
  return 0;
}

/**
 * Converts time in seconds to canvas x position
 * NOTE: This function is deprecated and may need to be rewritten for column-based approach
 * @param {number} seconds - Time in seconds
 * @param {Object} coordinateMapping - Result from createCoordinateMapping
 * @param {number} baseMicrobeatDuration - Base duration per microbeat in seconds
 * @returns {number} Canvas x position
 */
export function secondsToCanvasX(_seconds: number, _coordinateMapping: CoordinateMapping, _baseMicrobeatDuration: number): number {
  // TODO: Reimplement for column-based modulation
  return 0;
}

/**
 * Converts a column's modulated trigger time to regular transport time for scheduling
 * This is needed because Tone.Transport runs at regular speed but notes need to
 * trigger when the playhead reaches their visual position on the modulated grid.
 *
 * @param {number} columnIndex - The column index of the note
 * @param {Array} regularTimeMap - Regular time map (timeMap from transportService)
 * @returns {number} Regular transport time in seconds
 */
export function columnToRegularTime(columnIndex: number, regularTimeMap: number[]): number {
  if (columnIndex >= 0 && columnIndex < regularTimeMap.length) {
    const regularTime = regularTimeMap[columnIndex];
    if (regularTime !== undefined) {
      recordModulationDebug('log', `[TIME-CONVERSION] Column ${columnIndex} regular=${regularTime.toFixed(4)}s`);
      return regularTime;
    }
  }

  // Fallback: return a reasonable approximation
  recordModulationDebug('warn', `[TIME-CONVERSION] Column ${columnIndex} out of range, using fallback`);
  return columnIndex * 0.333; // Rough approximation
}

export function getModulationDebugMessages(): { level: string; args: unknown[] }[] {
  return modulationDebugMessages.slice();
}
