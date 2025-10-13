// js/components/Canvas/PitchGrid/renderers/rendererUtils.js
import LayoutService from '../../../../services/layoutService.js';
import { createCoordinateMapping } from '../../../../rhythm/modulationMapping.js';
import store from '../../../../state/index.js';

// Set up cache invalidation when modulation markers change
store.on('modulationMarkersChanged', () => {
    invalidateCoordinateMapping();
});

// Set up cache invalidation when viewport changes
store.on('scrollChanged', () => {
    cachedViewportInfo = null;
    lastViewportFrame = null;
});

store.on('zoomChanged', () => {
    cachedViewportInfo = null;
    lastViewportFrame = null;
});

// Cache for coordinate mapping to avoid recalculating on every frame
let cachedCoordinateMapping = null;
let lastMappingHash = null;

// Cache for viewport info to avoid recalculating on every row
let cachedViewportInfo = null;
let lastViewportFrame = null;

/**
 * Gets or creates a coordinate mapping for modulation markers
 * @param {Object} options - Render options containing modulation markers
 * @returns {Object} Coordinate mapping object
 */
function getCoordinateMapping(options) {
    const currentHash = JSON.stringify({
        markers: options.modulationMarkers || [],
        baseMicrobeatPx: options.baseMicrobeatPx || options.cellWidth || 40
    });
    
    
    if (cachedCoordinateMapping && currentHash === lastMappingHash) {
        return cachedCoordinateMapping;
    }
    
    const baseMicrobeatPx = options.baseMicrobeatPx || options.cellWidth || 40;
    
    cachedCoordinateMapping = createCoordinateMapping(options.modulationMarkers || [], baseMicrobeatPx, options);
    lastMappingHash = currentHash;
    
    
    return cachedCoordinateMapping;
}

/**
 * Gets cached viewport info to avoid recalculating on every row
 * @returns {Object} Viewport info object
 */
function getCachedViewportInfo() {
    const currentFrame = performance.now();
    
    // Invalidate cache if it's from a different frame (1ms threshold)
    if (!cachedViewportInfo || !lastViewportFrame || (currentFrame - lastViewportFrame) > 1) {
        cachedViewportInfo = LayoutService.getViewportInfo();
        lastViewportFrame = currentFrame;
    }
    
    return cachedViewportInfo;
}

export function getColumnX(index, options) {
    // Calculate original position first, handling fractional indices
    let originalX = 0;
    const integerPart = Math.floor(index);
    const fractionalPart = index - integerPart;

    // Sum up all complete columns
    for (let i = 0; i < integerPart; i++) {
        const widthMultiplier = options.columnWidths[i] || 0;
        originalX += widthMultiplier * options.cellWidth;
    }

    // Add fractional part of the current column
    if (fractionalPart > 0 && integerPart < options.columnWidths.length) {
        const widthMultiplier = options.columnWidths[integerPart] || 0;
        originalX += fractionalPart * widthMultiplier * options.cellWidth;
    }

    // If no modulation markers, return original position
    if (!options.modulationMarkers || options.modulationMarkers.length === 0) {
        return originalX;
    }

    // Use coordinate mapping to get modulated position
    const mapping = getCoordinateMapping(options);

    // For modulation, we need to convert the original X position to microbeat, then back to modulated X
    // This preserves the relationship between column positions and their modulated equivalents
    const baseMicrobeatPx = options.baseMicrobeatPx || options.cellWidth || 40;
    const microbeatIndex = originalX / baseMicrobeatPx;
    const modulatedX = mapping.microbeatToCanvasX(microbeatIndex);


    return modulatedX;
}

export function getRowY(rowIndex, options) {
    const viewportInfo = getCachedViewportInfo();
    // Calculate row position relative to viewport start using dual-parity grid spacing
    // cellHeight represents the full unit, ranks are spaced at cellHeight/2 intervals
    const relativeRowIndex = rowIndex - viewportInfo.startRank;
    const halfUnit = options.cellHeight / 2;
    const yPosition = relativeRowIndex * halfUnit;
    
    
    return yPosition;
}

export function getPitchClass(pitchWithOctave) {
  let pc = (pitchWithOctave || '').replace(/\d/g, '').trim();
  pc = pc.replace(/b/g, '♭').replace(/#/g, '♯');
  return pc;
}

export function getLineStyleFromPitchClass(pc, zoomLevel = 1) {
    switch (pc) {
        case 'C': return { lineWidth: 3.33, dash: [], color: '#adb5bd' };
        case 'E': return { lineWidth: 1, dash: [5, 5], color: '#adb5bd' }; // Use same pattern as vertical dashed lines
        case 'G': return { lineWidth: 1, dash: [], color: '#dee2e6' };
        case 'B':
        case 'A':
        case 'F':
        case 'E♭/D♯':
        case 'D♭/C♯':
            return { lineWidth: 1, dash: [], color: '#ced4da' }; // Simple solid gray lines for conditional pitches
        default: return { lineWidth: 1, dash: [], color: '#ced4da' }; // D, Bb/A#, and others use default styling
    }
}

export function getVisibleRowRange() {
    const viewportInfo = LayoutService.getViewportInfo();
    const { startRank, endRank } = viewportInfo; // FIXED: use startRank/endRank instead of startRow/endRow
    const result = { startRow: startRank, endRow: endRank };
    
    
    return result;
}

/**
 * Gets the current coordinate mapping for modulation (exposed for other renderers)
 * @param {Object} options - Render options
 * @returns {Object} Coordinate mapping object
 */
export function getCurrentCoordinateMapping(options) {
    return getCoordinateMapping(options);
}

/**
 * Invalidates the coordinate mapping cache (call when modulation markers change)
 */
export function invalidateCoordinateMapping() {
    cachedCoordinateMapping = null;
    lastMappingHash = null;
}

/**
 * Converts a canvas X position back to a column index using modulation mapping
 * @param {number} canvasX - Canvas x position
 * @param {Object} options - Render options
 * @returns {number} Column index (fractional for precision)
 */
export function getColumnFromX(canvasX, options) {
    if (options.modulationMarkers && options.modulationMarkers.length > 0) {
        const mapping = getCoordinateMapping(options);
        const baseMicrobeatPx = options.baseMicrobeatPx || options.cellWidth || 40;
        const microbeatIndex = mapping.canvasXToMicrobeat(canvasX);
        return microbeatIndex * baseMicrobeatPx / options.cellWidth;
    }

    // Fallback to original calculation
    let cumulative = 0;
    const { columnWidths, cellWidth } = options;
    if (cellWidth === 0) return 0;

    for (let i = 0; i < columnWidths.length; i++) {
        const colWidth = columnWidths[i] * cellWidth;
        if (canvasX < cumulative + colWidth) {
            // Return fractional column for precision
            const fractionIntoColumn = (canvasX - cumulative) / colWidth;
            return i + fractionIntoColumn;
        }
        cumulative += colWidth;
    }
    return columnWidths.length - 1;
}

/**
 * Converts a canvas Y position back to a row index
 * @param {number} canvasY - Canvas y position
 * @param {Object} options - Render options
 * @returns {number} Row index (fractional for precision)
 */
export function getRowFromY(canvasY, options) {
    const viewportInfo = getCachedViewportInfo();
    const halfUnit = options.cellHeight / 2;
    const relativeRowIndex = canvasY / halfUnit;
    const rowIndex = relativeRowIndex + viewportInfo.startRank;

    return rowIndex;
}