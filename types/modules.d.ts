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

declare module '@components/pitchPaint/paintModal.js' {
  interface PaintModal {
    open(): void;
    close(): void;
  }
  const paintModal: PaintModal;
  export default paintModal;
}

// Note: paintCanvas, paintPlayheadRenderer, and paintControls are now TypeScript files
// with their own type definitions

// Note: rhythmUI, stampsToolbar, and tripletsToolbar are now TypeScript files
// with their own type definitions, so no ambient declarations needed

// Note: meterController is now a TypeScript file with its own type definitions

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
