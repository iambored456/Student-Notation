// js/rhythm/modulationTest.js
// Simple test functions for modulation feature

import store from '@state/index.js';
import { MODULATION_RATIOS } from './modulationMapping.js';

const modulationTestMessages = [];

function recordDebug(...args) {
    modulationTestMessages.push(args);
}

// Test functions for modulation markers
export const ModulationTest = {
    /**
     * Enable modulation tool (for testing)
     */
    enableModulationTool() {
        store.setSelectedTool('modulation');
        recordDebug('[MODULATION TEST] Modulation tool enabled. Click on the grid to place markers.');
        recordDebug('[MODULATION TEST] Click marker labels to toggle 2:3 â†” 3:2');
        recordDebug('[MODULATION TEST] Drag marker barlines to move them');
    },

    /**
     * Add a test modulation marker at x=200 with 2:3 ratio
     */
    addTestMarker() {
        // Find the grid line closest to x=200
        const targetX = 200;
        const gridInfo = this.findNearestGridLine(targetX);
        const measureIndex = this.findMeasureIndexForX(gridInfo.x);
        
        const markerId = store.addModulationMarker(measureIndex, MODULATION_RATIOS.COMPRESSION_2_3, gridInfo.x, gridInfo.columnIndex);
        recordDebug('[MODULATION TEST] Added test marker at measure', measureIndex, 'columnIndex=', gridInfo.columnIndex, 'x=', gridInfo.x, '(snapped from', targetX, ')');
        return markerId;
    },

    /**
     * Add a test modulation marker at x=400 with 3:2 ratio
     */
    addTestMarker2() {
        // Find the grid line closest to x=400
        const targetX = 400;
        const gridInfo = this.findNearestGridLine(targetX);
        const measureIndex = this.findMeasureIndexForX(gridInfo.x);
        
        const markerId = store.addModulationMarker(measureIndex, MODULATION_RATIOS.EXPANSION_3_2, gridInfo.x, gridInfo.columnIndex);
        recordDebug('[MODULATION TEST] Added test marker 2 at measure', measureIndex, 'columnIndex=', gridInfo.columnIndex, 'x=', gridInfo.x, '(snapped from', targetX, ')');
        return markerId;
    },

    /**
     * Find the nearest grid line to a target X position and return column index
     */
    findNearestGridLine(targetX) {
        const state = store.state;
        let closestColumnIndex = 0;
        let closestX = 0;
        let minDistance = Infinity;
        
        // Check all column positions
        let currentX = 0;
        for (let i = 0; i < state.columnWidths.length; i++) {
            const distance = Math.abs(currentX - targetX);
            if (distance < minDistance) {
                minDistance = distance;
                closestX = currentX;
                closestColumnIndex = i;
            }
            
            const columnWidth = state.columnWidths[i] || 0;
            currentX += columnWidth * state.cellWidth;
        }
        
        recordDebug('[MODULATION TEST] findNearestGridLine:', {
            targetX,
            closestColumnIndex,
            closestX,
            minDistance
        });
        
        return { columnIndex: closestColumnIndex, x: closestX };
    },

    /**
     * Find a reasonable measure index for a given X position
     */
    findMeasureIndexForX(x) {
        // Simple approximation: assume roughly 4-6 columns per measure
        const cellWidth = store.state.cellWidth || 40;
        const columnsPerMeasure = 5; // Average estimate
        const columnIndex = Math.round(x / cellWidth);
        return Math.max(1, Math.round(columnIndex / columnsPerMeasure));
    },

    /**
     * Remove all modulation markers
     */
    clearAllMarkers() {
        const markers = [...(store.state.modulationMarkers || [])];
        markers.forEach(marker => {
            store.removeModulationMarker(marker.id);
        });
        recordDebug('[MODULATION TEST] Cleared all markers');
    },

    /**
     * Test coordinate mapping
     */
    testMapping() {
        const basePx = store.state.baseMicrobeatPx || store.state.cellWidth || 40;
        recordDebug('[MODULATION TEST] Base microbeat pixels:', basePx);
        recordDebug('[MODULATION TEST] Modulation markers:', store.state.modulationMarkers);
        
        // Test some coordinate conversions
        if (window.getModulationMapping) {
            const mapping = window.getModulationMapping();
            recordDebug('[MODULATION TEST] Coordinate mapping:', mapping);
            
            // Test specific coordinates
            const testPoints = [0, 100, 200, 300, 400, 500];
            testPoints.forEach(x => {
                const microbeat = mapping.canvasXToMicrobeat(x);
                const backToX = mapping.microbeatToCanvasX(microbeat);
                recordDebug(`[MODULATION TEST] x=${x} â†’ microbeat=${microbeat.toFixed(3)} â†’ x=${backToX.toFixed(1)}`);
            });
        }
    },

    /**
     * Test visual grid expansion after adding markers
     */
    testVisualExpansion() {
        recordDebug('[MODULATION TEST] Testing visual grid expansion...');
        
        // Clear any existing markers
        this.clearAllMarkers();
        
        // Add a 3:2 expansion marker at x=400
        const marker1 = this.addTestMarker2(); // 3:2 at x=400
        recordDebug('[MODULATION TEST] Added 3:2 expansion marker:', marker1);
        
        // Force layout recalculation and re-render
        if (typeof window !== 'undefined' && window.LayoutService) {
            recordDebug('[MODULATION TEST] Manually triggering layout recalculation...');
            window.LayoutService.recalculateLayout();
        }
        
        setTimeout(() => {
            recordDebug('[MODULATION TEST] Grid should now show expansion after x=400');
            recordDebug('[MODULATION TEST] Container should be wider to accommodate expansion');
            recordDebug('[MODULATION TEST] Check console for [LAYOUT], [GETCOLX], [GRIDLINES], and [NOTES] logs');
        }, 100);
    },

    /**
     * Test visual grid compression after adding markers
     */
    testVisualCompression() {
        recordDebug('[MODULATION TEST] Testing visual grid compression...');
        
        // Clear any existing markers
        this.clearAllMarkers();
        
        // Add a 2:3 compression marker at x=200
        const marker1 = this.addTestMarker(); // 2:3 at x=200
        recordDebug('[MODULATION TEST] Added 2:3 compression marker:', marker1);
        
        // Force layout recalculation and re-render
        if (typeof window !== 'undefined' && window.LayoutService) {
            recordDebug('[MODULATION TEST] Manually triggering layout recalculation...');
            window.LayoutService.recalculateLayout();
        }
        
        setTimeout(() => {
            recordDebug('[MODULATION TEST] Grid should now show compression after x=200');
            recordDebug('[MODULATION TEST] Container should adjust to accommodate compression');
            recordDebug('[MODULATION TEST] Check console for [LAYOUT], [GETCOLX], [GRIDLINES], and [NOTES] logs');
        }, 100);
    },

    /**
     * Log current state for debugging
     */
    logState() {
        recordDebug('[MODULATION TEST] Current state:', {
            selectedTool: store.state.selectedTool,
            modulationMarkers: store.state.modulationMarkers,
            baseMicrobeatPx: store.state.baseMicrobeatPx,
            cellWidth: store.state.cellWidth
        });
    }
};

// Expose to global for console access
if (typeof window !== 'undefined') {
    window.ModulationTest = ModulationTest;
    window.ModulationTestLogs = modulationTestMessages;
}

export default ModulationTest;

