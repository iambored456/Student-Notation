import {
  SIDE_COLUMN_WIDTH, BEAT_COLUMN_WIDTH
} from '@/core/constants.ts';
import { getPlacedTonicSigns } from '@state/selectors.ts';
import logger from '@utils/logger.ts';
import type { AppState } from '../../types/state.js';

export interface TonicSign {
  columnIndex: number;
  preMacrobeatIndex: number;
  uuid?: string;
}

/**
 * Calculates column widths dynamically based on tonic signs placement and macrobeat groupings.
 */
export function calculateColumnWidths(state: AppState): number[] {
  const { macrobeatGroupings } = state;
  const placedTonicSigns = getPlacedTonicSigns(state) as TonicSign[];
  const oldColumnWidths = [...(state.columnWidths || [])];
  const newColumnWidths = [SIDE_COLUMN_WIDTH, SIDE_COLUMN_WIDTH];

  logger.debug('Columns Layout', 'Starting column width calculation', null, 'layout');
  logger.debug('Columns Layout', 'Placed tonic signs', placedTonicSigns.map(ts => `col:${ts.columnIndex},mb:${ts.preMacrobeatIndex}`), 'layout');
  logger.debug('Columns Layout', 'Old columnWidths', oldColumnWidths, 'layout');
  logger.debug('Columns Layout', 'Macrobeat groupings', macrobeatGroupings, 'layout');

  const sortedTonicSigns = [...placedTonicSigns].sort((a, b) => a.preMacrobeatIndex - b.preMacrobeatIndex);
  let tonicSignCursor = 0;

  const addTonicSignsForIndex = (mbIndex: number) => {
    while (tonicSignCursor < sortedTonicSigns.length) {
      const current = sortedTonicSigns[tonicSignCursor];
      if (current?.preMacrobeatIndex !== mbIndex) {
        break;
      }
      logger.debug('Columns Layout', `Adding tonic columns for mbIndex ${mbIndex}, tonic at column ${current.columnIndex}`, null, 'layout');
      const columnCountBefore = newColumnWidths.length;
      newColumnWidths.push(BEAT_COLUMN_WIDTH);
      newColumnWidths.push(BEAT_COLUMN_WIDTH);
      logger.debug('Columns Layout', `Added 2 columns (width=${BEAT_COLUMN_WIDTH} each), total columns: ${columnCountBefore} -> ${newColumnWidths.length}`, null, 'layout');
      const currentUuid = current.uuid;
      while (tonicSignCursor < sortedTonicSigns.length && sortedTonicSigns[tonicSignCursor]?.uuid === currentUuid) {
        tonicSignCursor++;
      }
    }
  };

  // Add tonic signs that appear before any macrobeats (index -1)
  addTonicSignsForIndex(-1);

  // Process each macrobeat grouping
  macrobeatGroupings.forEach((group, mbIndex) => {
    // Add columns for each beat in the group
    for (let i = 0; i < group; i++) {
      newColumnWidths.push(BEAT_COLUMN_WIDTH);
    }
    // Add tonic signs that appear after this macrobeat
    addTonicSignsForIndex(mbIndex);
  });

  // Add final side columns
  newColumnWidths.push(SIDE_COLUMN_WIDTH, SIDE_COLUMN_WIDTH);

  logger.debug('Columns Layout', 'Final newColumnWidths', newColumnWidths, 'layout');
  logger.debug('Columns Layout', 'Width change', `${oldColumnWidths.length} -> ${newColumnWidths.length} columns`, 'layout');
  logger.debug('Columns Layout', 'Old total width units', oldColumnWidths.reduce((sum, w) => sum + w, 0), 'layout');
  logger.debug('Columns Layout', 'New total width units', newColumnWidths.reduce((sum, w) => sum + w, 0), 'layout');

  return newColumnWidths;
}

/**
 * Gets the X position of a specific column on the musical canvas (excluding left legend).
 * Returns position relative to the musical area (column 2 onwards).
 */
export function getColumnX(index: number, columnWidths: number[], cellWidth: number): number {
  let x = 0;
  for (let i = 0; i < index; i++) {
    x += (columnWidths[i] || 0) * cellWidth;
  }

  // Subtract left legend width (columns 0 and 1) to get position on musical canvas
  const leftLegendWidth = ((columnWidths[0] || 0) + (columnWidths[1] || 0)) * cellWidth;

  return x - leftLegendWidth;
}

/**
 * Calculates column widths for MUSICAL area only (excludes legends)
 * Returns array where index 0 = first musical beat (canvas-space)
 */
export function calculateMusicalColumnWidths(state: AppState): number[] {
  const fullColumnWidths = calculateColumnWidths(state);
  // Remove legend columns (first 2 and last 2)
  return fullColumnWidths.slice(2, -2);
}

/**
 * Calculates total canvas width from column widths.
 */
export function getCanvasWidth(columnWidths: number[], cellWidth: number): number {
  return (columnWidths.reduce((sum, w) => sum + w, 0)) * cellWidth;
}
