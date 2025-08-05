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
        const viewportInfo = LayoutService.getViewportInfo();
        
        if (!viewportInfo || viewportInfo.rowHeight === 0) {
            return -1;
        }
        
        // Since rowHeight already includes zoom scaling, convert mouse Y directly
        const yInVirtualSpace = y + viewportInfo.scrollOffset;
        const finalRowIndex = Math.floor(yInVirtualSpace / viewportInfo.rowHeight);
        
        return finalRowIndex;
    },
    
    getDrumRowIndex(y) {
        const pitchRowHeight = 0.5 * store.state.cellHeight;
        if (pitchRowHeight === 0) return -1;
        return Math.floor(y / pitchRowHeight);
    }
};

export default GridCoordsService;