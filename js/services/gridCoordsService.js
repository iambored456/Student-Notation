// js/services/gridCoordsService.js
import store from '../state/index.js';
import LayoutService from './layoutService.js';

const GridCoordsService = {
    getColumnIndex(x) {
        let cumulative = 0;
        const { columnWidths, cellWidth } = store.state;
        // Handle case where cellWidth might be zero during initial load
        if (cellWidth === 0) return 0;
        for (let i = 0; i < columnWidths.length; i++) {
            cumulative += columnWidths[i] * cellWidth;
            if (x < cumulative) return i;
        }
        return columnWidths.length - 1;
    },

    getPitchRowIndex(y) {
        // --- ADD LOGS HERE ---
        console.log(`[GridCoords] getPitchRowIndex called with y: ${y.toFixed(2)}`);
        const viewportInfo = LayoutService.getViewportInfo();
        console.log('[GridCoords] Fetched ViewportInfo:', viewportInfo);


        if (!viewportInfo || viewportInfo.rowHeight === 0 || viewportInfo.zoomLevel === 0) {
            // --- ADD LOG HERE ---
            console.warn('[GridCoords] Invalid viewportInfo. Returning -1.');
            return -1;
        }
        
        const yInFullUnscaledCanvas = (y / viewportInfo.zoomLevel) + viewportInfo.scrollOffset;
        const finalRowIndex = Math.floor(yInFullUnscaledCanvas / viewportInfo.rowHeight);
        
        // --- ADD LOGS HERE ---
        console.log(`[GridCoords] yInFullUnscaledCanvas: ${yInFullUnscaledCanvas.toFixed(2)}`);
        console.log(`[GridCoords] Returning finalRowIndex: ${finalRowIndex}`);

        return finalRowIndex;
    },
    
    getDrumRowIndex(y) {
        const pitchRowHeight = 0.5 * store.state.cellHeight;
        if (pitchRowHeight === 0) return -1;
        return Math.floor(y / pitchRowHeight);
    }
};

export default GridCoordsService;