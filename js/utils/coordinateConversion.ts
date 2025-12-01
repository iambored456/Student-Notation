/**
 * Coordinate Conversion Utilities
 *
 * IMPORTANT: These conversion functions are temporary and will be removed
 * once the migration to canvas-space is complete. They exist only to support
 * the transition period.
 *
 * TARGET STATE: All code uses canvas-space, no conversions needed.
 */

import { CanvasSpaceColumn, FullSpaceColumn, createCanvasSpaceColumn, createFullSpaceColumn } from './coordinateTypes.ts';
import logger from './logger.ts';

/**
 * Number of legend columns on the left side of the grid
 */
const LEFT_LEGEND_COLUMNS = 2;

/**
 * Number of legend columns on the right side of the grid
 */
const RIGHT_LEGEND_COLUMNS = 2;

/**
 * Converts full-space column to canvas-space column
 *
 * DEPRECATED: This function will be removed once migration is complete.
 * Do not use in new code.
 *
 * @param fullSpace - Full-space column index (includes legends)
 * @returns Canvas-space column index (musical columns only)
 */
export function toCanvasSpace(fullSpace: FullSpaceColumn): CanvasSpaceColumn {
  const canvasSpace = (fullSpace as number) - LEFT_LEGEND_COLUMNS;

  if (process.env['NODE_ENV'] === 'development') {
    logger.debug('coordinateConversion', `Converting full-space ${fullSpace} → canvas-space ${canvasSpace}`, {
      fullSpace,
      canvasSpace,
      offset: LEFT_LEGEND_COLUMNS
    }, 'coords');

    if (canvasSpace < 0) {
      logger.warn('coordinateConversion', `Converted to negative canvas-space column: ${canvasSpace}`, {
        fullSpace,
        canvasSpace
      }, 'coords');
    }
  }

  return createCanvasSpaceColumn(canvasSpace);
}

/**
 * Converts canvas-space column to full-space column
 *
 * DEPRECATED: This function will be removed once migration is complete.
 * Do not use in new code.
 *
 * @param canvasSpace - Canvas-space column index (musical columns only)
 * @returns Full-space column index (includes legends)
 */
export function toFullSpace(canvasSpace: CanvasSpaceColumn): FullSpaceColumn {
  const fullSpace = (canvasSpace as number) + LEFT_LEGEND_COLUMNS;

  if (process.env['NODE_ENV'] === 'development') {
    logger.debug('coordinateConversion', `Converting canvas-space ${canvasSpace} → full-space ${fullSpace}`, {
      canvasSpace,
      fullSpace,
      offset: LEFT_LEGEND_COLUMNS
    }, 'coords');
  }

  return createFullSpaceColumn(fullSpace);
}

/**
 * Checks if a full-space column is within the musical grid
 * (i.e., not in left or right legend)
 *
 * @param fullSpace - Full-space column index
 * @param totalColumns - Total number of columns in full-space
 * @returns true if column is in musical grid
 */
export function isMusicalColumn(fullSpace: number, totalColumns: number): boolean {
  return fullSpace >= LEFT_LEGEND_COLUMNS &&
         fullSpace < totalColumns - RIGHT_LEGEND_COLUMNS;
}

/**
 * Checks if a canvas-space column is valid
 *
 * @param canvasSpace - Canvas-space column index
 * @param musicalColumnCount - Number of musical columns
 * @returns true if column is valid
 */
export function isValidCanvasColumn(canvasSpace: number, musicalColumnCount: number): boolean {
  return canvasSpace >= 0 && canvasSpace < musicalColumnCount;
}

/**
 * Gets the number of musical columns from a full-space column count
 *
 * @param totalColumns - Total columns in full-space
 * @returns Number of musical columns
 */
export function getMusicalColumnCount(totalColumns: number): number {
  return Math.max(0, totalColumns - LEFT_LEGEND_COLUMNS - RIGHT_LEGEND_COLUMNS);
}

/**
 * Asserts that a value is a valid canvas-space column
 * Throws in development mode if invalid
 *
 * @param value - Value to check
 * @param context - Context string for error message
 */
export function assertCanvasSpace(value: number, context: string): asserts value is CanvasSpaceColumn {
  if (process.env['NODE_ENV'] === 'development') {
    if (!Number.isInteger(value)) {
      throw new Error(`${context}: Expected integer canvas-space column, got: ${value}`);
    }
    if (value < 0) {
      throw new Error(`${context}: Canvas-space column must be >= 0, got: ${value}`);
    }
  }
}

/**
 * Asserts that a value is a valid full-space column
 * Throws in development mode if invalid
 *
 * DEPRECATED: For migration purposes only
 *
 * @param value - Value to check
 * @param context - Context string for error message
 */
export function assertFullSpace(value: number, context: string): asserts value is FullSpaceColumn {
  if (process.env['NODE_ENV'] === 'development') {
    if (!Number.isInteger(value)) {
      throw new Error(`${context}: Expected integer full-space column, got: ${value}`);
    }
    if (value < 0) {
      throw new Error(`${context}: Full-space column must be >= 0, got: ${value}`);
    }
  }
}
