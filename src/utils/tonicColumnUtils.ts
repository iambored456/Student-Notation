/**
 * Centralized utilities for handling tonic shape columns.
 * Provides consistent logic for tonic column identification and validation.
 *
 * COORDINATE SYSTEM NOTE:
 * All column indices in this file use CANVAS-SPACE coordinates (0 = first musical beat).
 * Tonic signs are now stored in canvas-space in the state.
 */

import { getPlacedTonicSigns } from '@state/selectors.ts';
import type { AppState, CanvasSpaceColumn } from '../../types/state.js';

export interface TonicSign {
  columnIndex: CanvasSpaceColumn;
  [key: string]: unknown;
}

/**
 * Check if a column index is a tonic column (where tonic shapes are placed).
 */
export function isTonicColumn(columnIndex: number, placedTonicSigns: TonicSign[]): boolean {
  return placedTonicSigns.some(ts => ts.columnIndex === columnIndex);
}

/**
 * Check if a column index is within any tonic shape's 2-microbeat span.
 * Tonic shapes occupy 2 microbeat columns: the placement column and the next column.
 */
export function isWithinTonicSpan(columnIndex: number, placedTonicSigns: TonicSign[]): boolean {
  return placedTonicSigns.some(ts =>
    columnIndex === ts.columnIndex || columnIndex === ts.columnIndex + 1
  );
}

/**
 * Get all tonic signs that affect a specific column index.
 */
export function getTonicSignsAtColumn(columnIndex: number, placedTonicSigns: TonicSign[]): TonicSign[] {
  return placedTonicSigns.filter(ts => ts.columnIndex === columnIndex);
}

/**
 * Check if note placement should be allowed at a specific column.
 * Notes should not be placeable in tonic columns or the column immediately after.
 * @param columnIndex Canvas-space column index (0 = first musical beat)
 * @param state Application state
 */
export function isNotePlayableAtColumn(columnIndex: number, state: AppState): boolean {
  const placedTonicSigns = getPlacedTonicSigns(state) as TonicSign[];

  // Both columnIndex and tonic signs are in canvas-space - direct comparison
  return !isWithinTonicSpan(columnIndex, placedTonicSigns);
}

/**
 * Check if vertical grid lines should be drawn at a specific column.
 * Vertical lines in the middle of tonic shapes should be suppressed.
 */
export function shouldDrawVerticalLineAtColumn(columnIndex: number, placedTonicSigns: TonicSign[]): boolean {
  // Don't draw vertical lines in the middle of tonic shapes
  // Only suppress the line between the tonic column and the next column (columnIndex + 1)
  // But DO draw the line at the right border (columnIndex + 2)
  for (const ts of placedTonicSigns) {
    // Suppress the line that would appear between the tonic column and its extension
    if (columnIndex === ts.columnIndex + 1) {
      // Suppressing vertical line (middle of tonic)
      return false;
    }
  }

  // Check if this is a right border of a tonic shape
  const isRightBorder = placedTonicSigns.some(ts => columnIndex === ts.columnIndex + 2);
  if (isRightBorder) {
    // Allowing vertical line (right border of tonic)
  }

  return true;
}

/**
 * Get all column indices that are tonic columns.
 */
export function getTonicColumnIndices(placedTonicSigns: TonicSign[]): Set<number> {
  return new Set(placedTonicSigns.map(ts => ts.columnIndex));
}

/**
 * Get all column indices that are within tonic spans (including the +1 column).
 */
export function getTonicSpanColumnIndices(placedTonicSigns: TonicSign[]): Set<number> {
  const spanColumns = new Set<number>();
  placedTonicSigns.forEach(ts => {
    spanColumns.add(ts.columnIndex);
    spanColumns.add(ts.columnIndex + 1);
  });
  return spanColumns;
}
