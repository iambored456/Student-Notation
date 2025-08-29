// js/utils/tonicColumnUtils.js
/**
 * Centralized utilities for handling tonic shape columns
 * Provides consistent logic for tonic column identification and validation
 */

import { getPlacedTonicSigns } from '../state/selectors.js';

/**
 * Check if a column index is a tonic column (where tonic shapes are placed)
 * @param {number} columnIndex - The column index to check
 * @param {Array} placedTonicSigns - Array of placed tonic signs
 * @returns {boolean} True if the column is a tonic column
 */
export function isTonicColumn(columnIndex, placedTonicSigns) {
    return placedTonicSigns.some(ts => ts.columnIndex === columnIndex);
}

/**
 * Check if a column index is within any tonic shape's 2-microbeat span
 * Tonic shapes occupy 2 microbeat columns: the placement column and the next column
 * @param {number} columnIndex - The column index to check
 * @param {Array} placedTonicSigns - Array of placed tonic signs
 * @returns {boolean} True if the column is within a tonic shape's span
 */
export function isWithinTonicSpan(columnIndex, placedTonicSigns) {
    return placedTonicSigns.some(ts => 
        columnIndex === ts.columnIndex || columnIndex === ts.columnIndex + 1
    );
}

/**
 * Get all tonic signs that affect a specific column index
 * @param {number} columnIndex - The column index to check
 * @param {Array} placedTonicSigns - Array of placed tonic signs
 * @returns {Array} Array of tonic signs that affect this column
 */
export function getTonicSignsAtColumn(columnIndex, placedTonicSigns) {
    return placedTonicSigns.filter(ts => ts.columnIndex === columnIndex);
}

/**
 * Check if note placement should be allowed at a specific column
 * Notes should not be placeable in tonic columns or the column immediately after
 * @param {number} columnIndex - The column index to check
 * @param {Object} state - The application state
 * @returns {boolean} True if notes can be placed at this column
 */
export function isNotePlayableAtColumn(columnIndex, state) {
    const placedTonicSigns = getPlacedTonicSigns(state);
    
    // Don't allow notes in tonic columns or the column immediately after
    return !isWithinTonicSpan(columnIndex, placedTonicSigns);
}

/**
 * Check if vertical grid lines should be drawn at a specific column
 * Vertical lines in the middle of tonic shapes should be suppressed
 * @param {number} columnIndex - The column index to check
 * @param {Array} placedTonicSigns - Array of placed tonic signs
 * @returns {boolean} True if vertical line should be drawn
 */
export function shouldDrawVerticalLineAtColumn(columnIndex, placedTonicSigns) {
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
 * Get all column indices that are tonic columns
 * @param {Array} placedTonicSigns - Array of placed tonic signs
 * @returns {Set} Set of column indices that are tonic columns
 */
export function getTonicColumnIndices(placedTonicSigns) {
    return new Set(placedTonicSigns.map(ts => ts.columnIndex));
}

/**
 * Get all column indices that are within tonic spans (including the +1 column)
 * @param {Array} placedTonicSigns - Array of placed tonic signs
 * @returns {Set} Set of column indices that are within tonic spans
 */
export function getTonicSpanColumnIndices(placedTonicSigns) {
    const spanColumns = new Set();
    placedTonicSigns.forEach(ts => {
        spanColumns.add(ts.columnIndex);
        spanColumns.add(ts.columnIndex + 1);
    });
    return spanColumns;
}