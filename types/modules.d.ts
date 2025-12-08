import type { AppState, MacrobeatGrouping, ModulationMarker, ModulationRatio } from './state.js';

declare module '@services/columnMap.ts' {
  export function visualToTimeIndex(
    state: AppState,
    visualIndex: number,
    macrobeatGroupingsOverride?: MacrobeatGrouping[] | null
  ): number | null;
  export function timeIndexToVisualColumn(
    state: AppState,
    timeIndex: number,
    macrobeatGroupingsOverride?: MacrobeatGrouping[] | null
  ): number | null;
  export function getTimeBoundaryAfterMacrobeat(
    state: AppState,
    macrobeatIndex: number,
    macrobeatGroupingsOverride?: MacrobeatGrouping[] | null
  ): number;
}

declare module '@services/columnMapService.ts' {
  export interface ColumnEntry {
    visualIndex: number;
    canvasIndex: number | null;
    timeIndex: number | null;
    type: 'legend-left' | 'legend-right' | 'tonic' | 'beat';
    widthMultiplier: number;
    xOffsetUnmodulated: number;
    macrobeatIndex: number | null;
    beatInMacrobeat: number | null;
    isMacrobeatStart: boolean;
    isMacrobeatEnd: boolean;
    isPlayable: boolean;
    tonicSignUuid: string | null;
  }

  export interface MacrobeatBoundary {
    macrobeatIndex: number;
    visualColumn: number;
    canvasColumn: number;
    timeColumn: number;
    boundaryType: 'solid' | 'dashed' | 'anacrusis';
    isMeasureStart: boolean;
  }

  export interface ColumnMap {
    entries: ColumnEntry[];
    visualToCanvas: Map<number, number | null>;
    visualToTime: Map<number, number | null>;
    canvasToVisual: Map<number, number>;
    canvasToTime: Map<number, number | null>;
    timeToCanvas: Map<number, number>;
    timeToVisual: Map<number, number>;
    macrobeatBoundaries: MacrobeatBoundary[];
    totalVisualColumns: number;
    totalCanvasColumns: number;
    totalTimeColumns: number;
    totalWidthUnmodulated: number;
  }

  export function visualToCanvas(visualIndex: number, state: AppState): number | null;
  export function visualToTime(visualIndex: number, state: AppState): number | null;
  export function canvasToVisual(canvasIndex: number, state: AppState): number;
  export function canvasToTime(canvasIndex: number, state: AppState): number | null;
  export function timeToCanvas(timeIndex: number, state: AppState): number;
  export function timeToVisual(timeIndex: number, state: AppState): number;
  export function batchCanvasToVisual(canvasIndices: number[], state: AppState): number[];
  export function batchVisualToCanvas(visualIndices: number[], state: AppState): (number | null)[];
  export function getColumnEntry(visualIndex: number, state: AppState): ColumnEntry | null;
  export function getColumnEntryByCanvas(canvasIndex: number, state: AppState): ColumnEntry | null;
  export function isPlayableColumn(canvasIndex: number, state: AppState): boolean;
  export function getColumnType(canvasIndex: number, state: AppState): ColumnEntry['type'] | null;
  export function getMacrobeatBoundaries(state: AppState): MacrobeatBoundary[];
  export function getMacrobeatBoundary(macrobeatIndex: number, state: AppState): MacrobeatBoundary | null;
  export function getCanvasColumnWidths(state: AppState): number[];
  export function getTotalCanvasWidth(state: AppState): number;

  const columnMapService: {
    getColumnMap(state: AppState): ColumnMap;
    invalidate(): void;
  };
  export default columnMapService;
}

declare module '@services/pixelMapService.ts' {
  export interface ColumnPixelPosition {
    canvasIndex: number;
    xStart: number;
    xEnd: number;
    width: number;
    modulationScale: number;
  }

  export interface PixelMap {
    columnPositions: Map<number, ColumnPixelPosition>;
    totalPixelWidth: number;
  }

  export interface RenderOptions {
    cellWidth: number;
    modulationMarkers?: ModulationMarker[];
    baseMicrobeatPx?: number;
    columnWidths?: number[];
    state?: AppState;
  }

  export function getColumnX(canvasIndex: number, options: RenderOptions): number;
  export function getColumnFromX(pixelX: number, options: RenderOptions): number;
  export function getColumnPixelPosition(canvasIndex: number, options: RenderOptions): ColumnPixelPosition;
  export function getTotalPixelWidth(options: RenderOptions): number;

  const pixelMapService: {
    getColumnPixelPosition(canvasIndex: number, options: RenderOptions, state: AppState): ColumnPixelPosition;
    columnToPixelX(canvasIndex: number, options: RenderOptions, state: AppState): number;
    pixelXToColumn(pixelX: number, options: RenderOptions, state: AppState): number;
    invalidate(): void;
  };
  export default pixelMapService;
}

declare module '@components/canvas/pitchGrid/renderers/rendererUtils.js' {
  export interface RendererOptions {
    cellWidth: number;
    cellHeight: number;
    columnWidths?: number[];
    [key: string]: unknown;
  }

  export function getColumnX(index: number, options: RendererOptions): number;
  export function getRowY(rowIndex: number, options: RendererOptions): number;
}

declare module '@components/rhythm/glyphs/diamond.js' {
  export function diamondPath(cx: number, cy: number, width: number, height: number): string;
}

// Note: @state/selectors.ts and @state/index.ts are now proper TypeScript files
// with their own type definitions, so no ambient declarations needed here

// Note: drawToolsController is now a TypeScript file with its own type definitions

declare module '@components/toolbar/initializers/toolSelectorInitializer.js' {
  export function initToolbar(): void;
}

declare module '@components/toolbar/initializers/playbackInitializer.js' {
  interface PlaybackInitializer {
    init?(): void;
  }
  const playbackInitializer: PlaybackInitializer;
  export default playbackInitializer;
}

declare module '@components/toolbar/initializers/fileActionsInitializer.js' {
  interface FileActionsInitializer {
    init?(): void;
  }
  const fileActionsInitializer: FileActionsInitializer;
  export default fileActionsInitializer;
}

declare module '@components/toolbar/initializers/audioControlsInitializer.js' {
  export function initAudioControls(): void;
}

declare module '@components/toolbar/initializers/modulationInitializer.js' {
  interface ModulationInitializer {
    init?(): void;
  }
  const modulationInitializer: ModulationInitializer;
  export default modulationInitializer;
}
