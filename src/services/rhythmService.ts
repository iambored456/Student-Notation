// js/services/rhythmService.ts
import store from '@state/index.ts';
import { getMacrobeatInfo, getPlacedTonicSigns } from '@state/selectors.ts';
import { getColumnX } from '@components/canvas/PitchGrid/renderers/rendererUtils.js';

type BoundaryStyle = 'solid' | 'dashed' | 'dotted' | null | undefined;

interface MacrobeatInfo {
  startColumn: number;
  endColumn: number;
}

interface RenderOptions {
  columnWidths: number[];
  cellWidth: number;
  baseMicrobeatPx: number;
  modulationMarkers?: unknown[];
}

interface TimeSignatureSegment {
  label: string;
  centerX: number;
  startX: number;
  endX: number;
  isAnacrusis: boolean;
}

interface GroupingButton {
  type: 'grouping';
  content: number;
  x: number;
  startX: number;
  endX: number;
  index: number;
  nextBoundaryStyle: BoundaryStyle;
  prevBoundaryStyle: BoundaryStyle;
  hasLeftDivider: boolean;
}

interface BoundaryButton {
  type: 'boundary';
  boundaryStyle: BoundaryStyle;
  x: number;
  index: number;
}

type RhythmUIButton = GroupingButton | BoundaryButton;

const RhythmService = {
  /**
   * Computes the layout data for the time signature display.
   */
  getTimeSignatureSegments(): TimeSignatureSegment[] {
    const state = store.state as any;
    const macrobeatGroupings: number[] = state.macrobeatGroupings ?? [];
    const macrobeatBoundaryStyles: BoundaryStyle[] = state.macrobeatBoundaryStyles ?? [];
    const segments: TimeSignatureSegment[] = [];
    let isAnacrusisSegment = Boolean(state.hasAnacrusis);

    // getMacrobeatInfo now returns CANVAS-SPACE columns (0 = first musical beat)
    let measureStartColumn = (getMacrobeatInfo(state, 0) as MacrobeatInfo).startColumn;
    let measureMicrobeatTotal = 0;
    let measureContainsThreeGrouping = false;

    macrobeatGroupings.forEach((groupValue, index) => {
      measureMicrobeatTotal += groupValue;
      if (groupValue === 3) {measureContainsThreeGrouping = true;}

      const isLastBeat = (index === macrobeatGroupings.length - 1);
      const boundaryStyle = macrobeatBoundaryStyles[index];
      const isSolidBoundary = (boundaryStyle === 'solid');

      if (isSolidBoundary || isLastBeat) {
        // getMacrobeatInfo returns CANVAS-SPACE, endColumn + 1 gives position after measure
        const mbInfo = getMacrobeatInfo(state, index) as MacrobeatInfo;
        const measureEndColumn = mbInfo.endColumn + 1;

        // Use modulated positions if modulation exists
        const hasModulation = Array.isArray(state.modulationMarkers) && state.modulationMarkers.length > 0;
        // Use rendererUtils.getColumnX for both modulated and unmodulated paths
        // This ensures consistent coordinate system with grid rendering
        const renderOptions: RenderOptions = {
          ...state,
          modulationMarkers: hasModulation ? state.modulationMarkers : [],
          cellWidth: state.cellWidth,
          columnWidths: state.columnWidths,
          musicalColumnWidths: state.musicalColumnWidths,
          baseMicrobeatPx: state.cellWidth
        };

        // getColumnX expects CANVAS-SPACE indices
        const measureStartX = getColumnX(measureStartColumn, renderOptions as any);
        const measureEndX = getColumnX(measureEndColumn, renderOptions as any);

        const label = measureContainsThreeGrouping ? `${measureMicrobeatTotal}/8` : `${measureMicrobeatTotal / 2}/4`;

        segments.push({
          label,
          centerX: (measureStartX + measureEndX) / 2,
          startX: measureStartX,
          endX: measureEndX,
          isAnacrusis: isAnacrusisSegment
        });

        // Reset for next measure
        if (!isLastBeat) {
          measureStartColumn = measureEndColumn;
          measureMicrobeatTotal = 0;
          measureContainsThreeGrouping = false;
          if (isSolidBoundary) {isAnacrusisSegment = false;}
        }
      }
    });
    return segments;
  },

  /**
   * Computes the layout data for the rhythm UI control buttons.
   */
  getRhythmUIButtons(): RhythmUIButton[] {
    const state = store.state as any;
    const macrobeatGroupings: number[] = state.macrobeatGroupings ?? [];
    const macrobeatBoundaryStyles: BoundaryStyle[] = state.macrobeatBoundaryStyles ?? [];
    const buttons: RhythmUIButton[] = [];
    const tonicSigns = getPlacedTonicSigns(state);
    const tonicRightEdgeColumns = new Set<number>(
      tonicSigns.map((ts: { columnIndex: number }) => ts.columnIndex + 2)
    );

    macrobeatGroupings.forEach((group, index) => {
      const macrobeatInfo = getMacrobeatInfo(state, index) as MacrobeatInfo;
      const { startColumn, endColumn } = macrobeatInfo;

      // CANVAS-SPACE FIX: Always use rendererUtils.getColumnX() with proper renderOptions
      // Ensure musicalColumnWidths is always available
      const canvasSpaceRenderOptions = {
        ...state,
        modulationMarkers: state.modulationMarkers || [],
        cellWidth: state.cellWidth,
        columnWidths: state.columnWidths,
        musicalColumnWidths: state.columnWidths,
        baseMicrobeatPx: state.cellWidth
      };

      const startX = getColumnX(startColumn, canvasSpaceRenderOptions as any);
      const endX = getColumnX(endColumn + 1, canvasSpaceRenderOptions as any);
      const centerX = (startX + endX) / 2;

      const boundaryStyle = macrobeatBoundaryStyles[index] ?? null;
      const prevBoundaryStyle = index > 0 ? macrobeatBoundaryStyles[index - 1] ?? null : null;
      const hasLeftDivider = prevBoundaryStyle !== null && tonicRightEdgeColumns.has(startColumn);

      buttons.push({
        type: 'grouping',
        content: group,
        x: centerX,
        startX,
        endX,
        index,
        nextBoundaryStyle: boundaryStyle,
        prevBoundaryStyle,
        hasLeftDivider
      });

      if (index < macrobeatGroupings.length - 1) {
        buttons.push({
          type: 'boundary',
          boundaryStyle,
          x: endX,
          index
        });
      }
    });

    return buttons;
  }
};

export default RhythmService;
