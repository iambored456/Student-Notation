// js/services/gridCoordsService.js
import store from '../state/index.js';
import LayoutService from './layoutService.js';
import { BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR } from '../constants.js';
import { getColumnX } from '../components/Canvas/PitchGrid/renderers/rendererUtils.js';

const GridCoordsService = {
    getColumnIndex(x) {
        const { columnWidths, cellWidth, modulationMarkers } = store.state;
        // Handle case where cellWidth might be zero during initial load
        if (cellWidth === 0) return 0;
        
        const hasModulation = modulationMarkers && modulationMarkers.length > 0;
        
        if (hasModulation) {
            // Use modulation-aware column positions
            const renderOptions = {
                ...store.state,
                modulationMarkers,
                cellWidth,
                columnWidths,
                baseMicrobeatPx: cellWidth
            };
            
            for (let i = 0; i < columnWidths.length; i++) {
                const columnX = getColumnX(i + 1, renderOptions); // Get end of this column
                if (x < columnX) {
                    return i;
                }
            }
        } else {
            // Use base column positions
            let cumulative = 0;
            for (let i = 0; i < columnWidths.length; i++) {
                cumulative += columnWidths[i] * cellWidth;
                if (x < cumulative) {
                    return i;
                }
            }
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