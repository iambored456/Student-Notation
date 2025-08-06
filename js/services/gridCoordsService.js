// js/services/gridCoordsService.js
import store from '../state/index.js';
import LayoutService from './layoutService.js';
import { BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR } from '../constants.js';

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
        // Use the same drum row height calculation as LayoutService
        const drumRowHeight = Math.max(BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR * store.state.cellHeight);
        if (drumRowHeight === 0) return -1;
        const rowIndex = Math.floor(y / drumRowHeight);
        return rowIndex;
    }
};

export default GridCoordsService;