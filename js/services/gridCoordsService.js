// js/services/gridCoordsService.js
import store from '../state/store.js';

const GridCoordsService = {
    /**
     * Gets the column index from a horizontal (x) position on the canvas.
     * @param {number} x - The x-coordinate.
     * @returns {number} The column index.
     */
    getColumnIndex(x) {
        let cumulative = 0;
        const { columnWidths, cellWidth } = store.state;
        for (let i = 0; i < columnWidths.length; i++) {
            cumulative += columnWidths[i] * cellWidth;
            if (x < cumulative) return i;
        }
        return columnWidths.length - 1;
    },

    /**
     * Gets the pitch row index from a vertical (y) position on the pitch canvas.
     * @param {number} y - The y-coordinate.
     * @returns {number} The row index.
     */
    getPitchRowIndex(y) {
        const visualRowHeight = store.state.cellHeight * 0.5;
        // The + visualRowHeight / 2 accounts for the line being in the middle of the cell
        return Math.floor((y + visualRowHeight / 2) / visualRowHeight);
    },

    /**
     * Gets the drum row index from a vertical (y) position on the drum canvas.
     * @param {number} y - The y-coordinate.
     * @returns {number} The drum row index (0, 1, or 2).
     */
    getDrumRowIndex(y) {
        const pitchRowHeight = 0.5 * store.state.cellHeight;
        return Math.floor(y / pitchRowHeight);
    }
};

export default GridCoordsService;