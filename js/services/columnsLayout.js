// js/services/columnsLayout.js
import {
    SIDE_COLUMN_WIDTH, BEAT_COLUMN_WIDTH
} from '../core/constants.js';
import { getPlacedTonicSigns } from '../state/selectors.js';
import logger from '../utils/logger.js';

/**
 * Calculates column widths dynamically based on tonic signs placement and macrobeat groupings
 * @param {Object} state - The application state
 * @returns {number[]} Array of column widths
 */
export function calculateColumnWidths(state) {
    const { macrobeatGroupings } = state;
    const placedTonicSigns = getPlacedTonicSigns(state);
    const oldColumnWidths = [...(state.columnWidths || [])];
    const newColumnWidths = [SIDE_COLUMN_WIDTH, SIDE_COLUMN_WIDTH];
    
    logger.debug('Columns Layout', 'Starting column width calculation', null, 'layout');
    logger.debug('Columns Layout', 'Placed tonic signs', placedTonicSigns.map(ts => `col:${ts.columnIndex},mb:${ts.preMacrobeatIndex}`), 'layout');
    logger.debug('Columns Layout', 'Old columnWidths', oldColumnWidths, 'layout');
    logger.debug('Columns Layout', 'Macrobeat groupings', macrobeatGroupings, 'layout');
    
    const sortedTonicSigns = [...placedTonicSigns].sort((a, b) => a.preMacrobeatIndex - b.preMacrobeatIndex);
    let tonicSignCursor = 0;
    
    const addTonicSignsForIndex = (mbIndex) => {
        let uuid = sortedTonicSigns[tonicSignCursor]?.uuid;
        while (sortedTonicSigns[tonicSignCursor] && sortedTonicSigns[tonicSignCursor].preMacrobeatIndex === mbIndex) {
            logger.debug('Columns Layout', `Adding tonic columns for mbIndex ${mbIndex}, tonic at column ${sortedTonicSigns[tonicSignCursor].columnIndex}`, null, 'layout');
            // Add 2 columns of width=1 for each tonic (for grid consistency)
            const columnCountBefore = newColumnWidths.length;
            newColumnWidths.push(BEAT_COLUMN_WIDTH);
            newColumnWidths.push(BEAT_COLUMN_WIDTH);
            logger.debug('Columns Layout', `Added 2 columns (width=${BEAT_COLUMN_WIDTH} each), total columns: ${columnCountBefore} -> ${newColumnWidths.length}`, null, 'layout');
            while(sortedTonicSigns[tonicSignCursor] && sortedTonicSigns[tonicSignCursor].uuid === uuid) {
                tonicSignCursor++;
            }
            uuid = sortedTonicSigns[tonicSignCursor]?.uuid;
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
 * Gets the X position of a specific column
 * @param {number} index - Column index
 * @param {number[]} columnWidths - Array of column widths
 * @param {number} cellWidth - Width of one cell unit in pixels
 * @returns {number} X position in pixels
 */
export function getColumnX(index, columnWidths, cellWidth) {
    let x = 0;
    for (let i = 0; i < index; i++) {
        x += (columnWidths[i] || 0) * cellWidth;
    }
    return x;
}

/**
 * Calculates total canvas width from column widths
 * @param {number[]} columnWidths - Array of column widths
 * @param {number} cellWidth - Width of one cell unit in pixels
 * @returns {number} Total canvas width in pixels
 */
export function getCanvasWidth(columnWidths, cellWidth) {
    return (columnWidths.reduce((sum, w) => sum + w, 0)) * cellWidth;
}