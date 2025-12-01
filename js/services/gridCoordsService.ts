// js/services/gridCoordsService.ts
import store from '@state/index.ts';
import LayoutService from './layoutService.js';
import { BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR } from '@/core/constants.ts';
import { getColumnFromX } from '@components/canvas/PitchGrid/renderers/rendererUtils.js';
import type { CanvasSpaceColumn } from '../../types/state.js';
import { createCanvasSpaceColumn } from '@utils/coordinateTypes.ts';

/**
 * COORDINATE SYSTEM NOTE:
 * GridCoordsService converts pixel coordinates to grid indices.
 * - getColumnIndex() returns CANVAS-SPACE column indices (0 = first musical beat)
 * - getPitchRowIndex() and getDrumRowIndex() return row indices (unchanged)
 */

const GridCoordsService = {
  /**
   * Converts an x-pixel coordinate to a canvas-space column index
   * @param x - Pixel coordinate relative to canvas origin
   * @returns Canvas-space column index (0 = first musical beat)
   */
  getColumnIndex(x: number): CanvasSpaceColumn {
    const { cellWidth, modulationMarkers, cellHeight, musicalColumnWidths } = store.state;
    const columnWidths = store.state.columnWidths || [];

    // Handle case where cellWidth might be zero during initial load
    if (cellWidth === 0) {
      return createCanvasSpaceColumn(0);
    }

    // Use the proper inverse conversion that handles modulation
    const renderOptions = {
      ...store.state,
      modulationMarkers,
      cellWidth,
      cellHeight,
      columnWidths,
      musicalColumnWidths,  // Canvas-space column widths
      baseMicrobeatPx: store.state.baseMicrobeatPx || cellWidth
    };

    // getColumnFromX returns canvas-space index (0 = first musical beat)
    const fractionalColumn = getColumnFromX(x, renderOptions);
    const canvasSpaceColumn = Math.floor(fractionalColumn);

    return createCanvasSpaceColumn(canvasSpaceColumn);
  },

  getPitchRowIndex(y: number): number {
    const viewportInfo = LayoutService.getViewportInfo();

    if (!viewportInfo?.halfUnit || viewportInfo.halfUnit === 0) {
      return -1;
    }

    // For dual-parity grid: use halfUnit spacing (cellHeight/2) for row calculations
    // Shift click detection up by 0.5 halfUnit (0.25 cellHeight) to center clickable area on visual row lines
    // This makes the clickable area span Ã‚Â±0.25 cellHeight around each row's visual position
    const relativeRankFromMouse = Math.floor((y + viewportInfo.halfUnit * 0.5) / viewportInfo.halfUnit);
    const finalRowIndex = viewportInfo.startRank + relativeRankFromMouse;


    return finalRowIndex;
  },

  getDrumRowIndex(y: number): number {
    // Use the same drum row height calculation as LayoutService
    const drumRowHeight = Math.max(BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR * store.state.cellHeight);
    if (drumRowHeight === 0) {return -1;}
    const rowIndex = Math.floor(y / drumRowHeight);
    return rowIndex;
  }
};

export default GridCoordsService;
