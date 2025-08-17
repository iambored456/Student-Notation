// js/components/Canvas/PitchGrid/renderers/rendererUtils.js
import LayoutService from '../../../../services/layoutService.js';
import { createCoordinateMapping } from '../../../../rhythm/modulationMapping.js';
import store from '../../../../state/index.js';

// Set up cache invalidation when modulation markers change
store.on('modulationMarkersChanged', () => {
    invalidateCoordinateMapping();
});

// Cache for coordinate mapping to avoid recalculating on every frame
let cachedCoordinateMapping = null;
let lastMappingHash = null;

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
    
    // console.log('[COORD] getCoordinateMapping called with:', {
    //     markers: options.modulationMarkers,
    //     baseMicrobeatPx: options.baseMicrobeatPx || options.cellWidth || 40,
    //     currentHash,
    //     hasCached: !!cachedCoordinateMapping,
    //     hashMatch: currentHash === lastMappingHash
    // });
    
    if (cachedCoordinateMapping && currentHash === lastMappingHash) {
        // console.log('[COORD] Using cached mapping');
        return cachedCoordinateMapping;
    }
    
    const baseMicrobeatPx = options.baseMicrobeatPx || options.cellWidth || 40;
    console.log('[COORD] Creating new coordinate mapping with:', {
        markersCount: (options.modulationMarkers || []).length,
        baseMicrobeatPx,
        options: options
    });
    
    cachedCoordinateMapping = createCoordinateMapping(options.modulationMarkers || [], baseMicrobeatPx, options);
    lastMappingHash = currentHash;
    
    console.log('[COORD] Created mapping with segments:', cachedCoordinateMapping.segments);
    
    return cachedCoordinateMapping;
}

export function getColumnX(index, options) {
    // Calculate original position first
    let originalX = 0;
    for (let i = 0; i < index; i++) {
        const widthMultiplier = options.columnWidths[i] || 0;
        originalX += widthMultiplier * options.cellWidth;
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
    
    console.log('[GETCOLUMNX] Modulated position calculation:', {
        index,
        originalX,
        baseMicrobeatPx,
        microbeatIndex,
        modulatedX,
        difference: modulatedX - originalX,
        segmentCount: mapping.segments.length
    });
    
    return modulatedX;
}

export function getRowY(rowIndex, options) {
    const viewportInfo = LayoutService.getViewportInfo();
    const absoluteY = rowIndex * viewportInfo.rowHeight;
    // THE FIX: Don't apply zoom again since rowHeight already includes zoom
    return absoluteY - viewportInfo.scrollOffset;
}

export function getPitchClass(pitchWithOctave) {
  let pc = (pitchWithOctave || '').replace(/\d/g, '').trim();
  pc = pc.replace(/b/g, '♭').replace(/#/g, '♯');
  return pc;
}

export function getLineStyleFromPitchClass(pc) {
    switch (pc) {
        case 'C': return { lineWidth: 3.33, dash: [], color: '#adb5bd' };
        case 'E': return { lineWidth: 1, dash: [10, 20], color: '#adb5bd' };
        case 'G': return { lineWidth: 1, dash: [], color: '#dee2e6' };
        case 'D♭/C♯':
        case 'E♭/D♯':
        case 'F':
        case 'A':
        case 'B':
            return null;
        default: return { lineWidth: 1, dash: [], color: '#ced4da' };
    }
}

export function getVisibleRowRange() {
    const { startRow, endRow } = LayoutService.getViewportInfo();
    return { startRow, endRow };
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
 * @returns {number} Column index
 */
export function getColumnFromX(canvasX, options) {
    if (options.modulationMarkers && options.modulationMarkers.length > 0) {
        const mapping = getCoordinateMapping(options);
        return Math.round(mapping.canvasXToMicrobeat(canvasX));
    }
    
    // Fallback to original calculation
    let cumulative = 0;
    const { columnWidths, cellWidth } = options;
    if (cellWidth === 0) return 0;
    
    for (let i = 0; i < columnWidths.length; i++) {
        cumulative += columnWidths[i] * cellWidth;
        if (canvasX < cumulative) return i;
    }
    return columnWidths.length - 1;
}