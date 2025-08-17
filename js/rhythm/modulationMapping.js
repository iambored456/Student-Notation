// js/rhythm/modulationMapping.js

import { getMacrobeatInfo } from '../state/selectors.js';

// Modulation ratio constants
export const MODULATION_RATIOS = {
    COMPRESSION_2_3: 2/3,  // 0.6666666667
    EXPANSION_3_2: 3/2     // 1.5
};

/**
 * Converts a measure index to canvas X position
 * @param {number} measureIndex - Measure index (0 = start, 1+ = after measure boundaries)
 * @param {Object} state - Application state
 * @returns {number} Canvas X position
 */
function measureIndexToCanvasX(measureIndex, state) {
    console.log('[MODULATION] measureIndexToCanvasX called:', {
        measureIndex,
        hasState: !!state,
        cellWidth: state ? state.cellWidth : 'N/A'
    });
    
    if (!state) {
        console.warn('[MODULATION] No state provided for measure conversion');
        const fallbackX = measureIndex * 200;
        console.log('[MODULATION] Using fallback calculation:', fallbackX);
        return fallbackX;
    }
    
    // Simple conversion using cellWidth for now (avoiding circular imports)
    const cellWidth = state.cellWidth || 40;
    console.log('[MODULATION] Using cellWidth:', cellWidth);
    
    if (measureIndex === 0) {
        // Start of first measure (column 2)
        const result = 2 * cellWidth;
        console.log('[MODULATION] Measure 0 → column 2 →', result);
        return result;
    }
    
    // Find the macrobeat that corresponds to this measure
    const macrobeatIndex = measureIndex - 1;
    console.log('[MODULATION] Looking for macrobeat index:', macrobeatIndex);
    
    const measureInfo = getMacrobeatInfo(state, macrobeatIndex);
    console.log('[MODULATION] getMacrobeatInfo result:', measureInfo);
    
    if (measureInfo) {
        // Position at end of this measure
        const result = (measureInfo.endColumn + 1) * cellWidth;
        console.log('[MODULATION] Found measure info, calculated position:', result);
        return result;
    }
    
    console.warn('[MODULATION] Could not find measure info for index:', measureIndex);
    // Use a more reasonable fallback based on average column width
    const fallbackX = measureIndex * cellWidth * 4; // Assume ~4 columns per measure
    console.log('[MODULATION] Using improved fallback calculation:', fallbackX);
    return fallbackX;
}

/**
 * Creates a new modulation marker at a measure boundary
 * @param {number} measureIndex - Index of the measure after which modulation starts
 * @param {number} ratio - Modulation ratio (2/3 or 3/2)
 * @param {number} xPosition - Optional X position override (for accurate placement)
 * @param {number} columnIndex - Optional column index for stable positioning
 * @param {number} macrobeatIndex - Optional macrobeat index for stable positioning
 * @returns {Object} ModulationMarker object
 */
export function createModulationMarker(measureIndex, ratio, xPosition = null, columnIndex = null, macrobeatIndex = null) {
    return {
        id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        measureIndex: measureIndex,
        ratio: ratio,
        active: true,
        xPosition: xPosition, // Store the actual boundary position if provided
        columnIndex: columnIndex, // Store column index for stable positioning
        macrobeatIndex: macrobeatIndex // Store macrobeat index for stable positioning
    };
}

/**
 * Gets display text for a modulation ratio
 * @param {number} ratio - The modulation ratio
 * @returns {string} Display text like "2:3" or "3:2"
 */
export function getModulationDisplayText(ratio) {
    if (Math.abs(ratio - MODULATION_RATIOS.COMPRESSION_2_3) < 0.001) {
        return "2:3";
    } else if (Math.abs(ratio - MODULATION_RATIOS.EXPANSION_3_2) < 0.001) {
        return "3:2";
    }
    return `${ratio}`;
}

/**
 * Gets the color for a modulation marker based on ratio
 * @param {number} ratio - The modulation ratio
 * @returns {string} CSS color string
 */
export function getModulationColor(ratio) {
    if (Math.abs(ratio - MODULATION_RATIOS.COMPRESSION_2_3) < 0.001) {
        return "#dc3545"; // Red for compression
    } else if (Math.abs(ratio - MODULATION_RATIOS.EXPANSION_3_2) < 0.001) {
        return "#007bff"; // Blue for expansion
    }
    return "#6c757d"; // Gray fallback
}

/**
 * Calculates piecewise-linear coordinate mapping for modulation
 * @param {Array} markers - Array of ModulationMarker objects with measureIndex
 * @param {number} baseMicrobeatPx - Base pixels per microbeat
 * @param {Object} state - Application state to get measure info
 * @returns {Object} Mapping functions and segment data
 */
/**
 * Creates an empty coordinate mapping (no modulation)
 * @param {number} baseMicrobeatPx - Base pixels per microbeat
 * @returns {Object} Empty mapping functions
 */
function createEmptyMapping(baseMicrobeatPx) {
    return {
        segments: [{
            startX: 0,
            endX: Infinity,
            scale: 1.0,
            spacingPx: baseMicrobeatPx
        }],
        
        microbeatToCanvasX(microbeatIndex) {
            return microbeatIndex * baseMicrobeatPx;
        },
        
        canvasXToMicrobeat(canvasX) {
            return canvasX / baseMicrobeatPx;
        },
        
        getSegmentAtX(canvasX) {
            return this.segments[0];
        },
        
        getGhostGridPositions(segment, baseMicrobeatPx) {
            return []; // No ghost grid when no modulation
        }
    };
}

export function createCoordinateMapping(markers, baseMicrobeatPx, state = null) {
    // Early return if no markers
    if (!markers || markers.length === 0) {
        return createEmptyMapping(baseMicrobeatPx);
    }
    
    // Sort markers by measure index
    const sortedMarkers = [...markers.filter(m => m.active)].sort((a, b) => a.measureIndex - b.measureIndex);
    
    // If no active markers, return empty mapping
    if (sortedMarkers.length === 0) {
        return createEmptyMapping(baseMicrobeatPx);
    }
    
    console.log('[MODULATION] Creating coordinate mapping for markers:', sortedMarkers);
    
    // Convert measure-based markers to canvas positions using state info
    const markersWithCanvasX = sortedMarkers.map(marker => {
        // Use stored position if available, otherwise calculate from measure index
        let canvasX;
        if (marker.xPosition !== null && marker.xPosition !== undefined) {
            canvasX = marker.xPosition;
            console.log(`[MODULATION] Marker at measure ${marker.measureIndex} → using stored x=${canvasX}`);
        } else {
            canvasX = measureIndexToCanvasX(marker.measureIndex, state);
            console.log(`[MODULATION] Marker at measure ${marker.measureIndex} → calculated x=${canvasX}`);
        }
        
        console.log(`[MODULATION] Final marker position:`, {
            id: marker.id,
            measureIndex: marker.measureIndex,
            canvasX,
            isStored: marker.xPosition !== null && marker.xPosition !== undefined
        });
        
        return {
            ...marker,
            xCanvas: canvasX
        };
    });
    
    // Create segments with cumulative scaling
    const segments = [];
    let currentX = 0;
    let cumulativeScale = 1.0;
    
    // Add initial segment (before first marker)
    if (markersWithCanvasX.length === 0 || markersWithCanvasX[0].xCanvas > 0) {
        segments.push({
            startX: 0,
            endX: markersWithCanvasX.length > 0 ? markersWithCanvasX[0].xCanvas : Infinity,
            scale: 1.0,
            spacingPx: baseMicrobeatPx
        });
    }
    
    // Process each marker to create segments
    for (let i = 0; i < markersWithCanvasX.length; i++) {
        const marker = markersWithCanvasX[i];
        const nextMarkerX = i + 1 < markersWithCanvasX.length ? markersWithCanvasX[i + 1].xCanvas : Infinity;
        
        // Update cumulative scale
        cumulativeScale *= marker.ratio;
        
        segments.push({
            startX: marker.xCanvas,
            endX: nextMarkerX,
            scale: cumulativeScale,
            spacingPx: baseMicrobeatPx * cumulativeScale,
            marker: marker
        });
    }
    
    return {
        segments,
        
        /**
         * Converts microbeat index to canvas x position
         * @param {number} microbeatIndex - The microbeat index
         * @returns {number} Canvas x position
         */
        microbeatToCanvasX(microbeatIndex) {
            let x = 0;
            let currentMicrobeat = 0;
            
            for (const segment of segments) {
                // Calculate how many microbeats can fit in this segment
                const segmentWidth = segment.endX - segment.startX;
                const microbeatsInSegment = segmentWidth / segment.spacingPx;
                
                if (currentMicrobeat + microbeatsInSegment >= microbeatIndex) {
                    // Target microbeat is in this segment
                    const offsetInSegment = microbeatIndex - currentMicrobeat;
                    return segment.startX + offsetInSegment * segment.spacingPx;
                }
                
                currentMicrobeat += microbeatsInSegment;
                x = segment.endX;
            }
            
            return x;
        },
        
        /**
         * Converts canvas x position to microbeat index
         * @param {number} canvasX - Canvas x position
         * @returns {number} Microbeat index
         */
        canvasXToMicrobeat(canvasX) {
            let microbeatIndex = 0;
            
            for (const segment of segments) {
                if (canvasX >= segment.startX && canvasX < segment.endX) {
                    // Position is in this segment
                    const offsetInSegment = canvasX - segment.startX;
                    const microbeatsInOffset = offsetInSegment / segment.spacingPx;
                    return microbeatIndex + microbeatsInOffset;
                }
                
                // Add microbeats from this entire segment
                const segmentWidth = segment.endX - segment.startX;
                microbeatIndex += segmentWidth / segment.spacingPx;
            }
            
            return microbeatIndex;
        },
        
        /**
         * Gets the segment containing a given canvas x position
         * @param {number} canvasX - Canvas x position
         * @returns {Object|null} Segment object or null if not found
         */
        getSegmentAtX(canvasX) {
            return segments.find(seg => canvasX >= seg.startX && canvasX < seg.endX) || null;
        },
        
        /**
         * Gets all ghost grid positions for a segment based on actual grid structure
         * @param {Object} segment - Segment object  
         * @param {Object} options - Render options with grid structure
         * @returns {Array} Array of x positions for ghost grid lines
         */
        getGhostGridPositions(segment, options) {
            console.log('[GHOST-CALC] getGhostGridPositions called with:', {
                segment,
                hasMarker: !!segment.marker,
                hasOptions: !!options
            });
            
            if (!segment.marker) {
                console.log('[GHOST-CALC] No marker on segment, returning empty array');
                return []; // No ghost grid for base segment
            }
            
            if (!options || !options.columnWidths) {
                console.warn('[GHOST-CALC] No grid options provided');
                return [];
            }
            
            const ghostPositions = [];
            const { columnWidths, cellWidth } = options;
            
            console.log('[GHOST-CALC] Options check:', { 
                hasColumnWidths: !!columnWidths, 
                columnCount: columnWidths ? columnWidths.length : 0,
                cellWidth,
                segmentStartX: segment.startX,
                segmentEndX: segment.endX,
                segmentScale: segment.scale
            });
            
            if (!columnWidths || !cellWidth || cellWidth === 0) {
                console.warn('[GHOST-CALC] Missing grid data');
                return [];
            }
            
            // Calculate original grid line positions within this segment
            let currentX = 0;
            for (let col = 0; col < columnWidths.length; col++) {
                const lineX = currentX;
                
                // Check if this grid line falls within the modulated segment
                // For infinite segments, check if line is after segment start
                const isInSegment = segment.endX === Infinity ? 
                    lineX >= segment.startX : 
                    (lineX >= segment.startX && lineX < segment.endX);
                
                if (isInSegment) {
                    // For infinite segments, use a reasonable finite width for calculation
                    let effectiveSegmentWidth;
                    let effectiveEndX;
                    
                    if (segment.endX === Infinity) {
                        // Use remaining grid width as effective segment width
                        const totalGridWidth = columnWidths.reduce((sum, w) => sum + w, 0) * cellWidth;
                        effectiveEndX = Math.max(totalGridWidth, segment.startX + 800); // At least 800px
                        effectiveSegmentWidth = effectiveEndX - segment.startX;
                    } else {
                        effectiveSegmentWidth = segment.endX - segment.startX;
                        effectiveEndX = segment.endX;
                    }
                    
                    if (effectiveSegmentWidth > 0 && segment.scale > 0) {
                        const relativePosition = (lineX - segment.startX) / effectiveSegmentWidth;
                        const originalSpacing = effectiveSegmentWidth / segment.scale;
                        const ghostX = segment.startX + relativePosition * originalSpacing;
                        
                        if (!isNaN(ghostX) && isFinite(ghostX)) {
                            ghostPositions.push(ghostX);
                        }
                    }
                }
                
                // Move to next column
                const columnWidth = columnWidths[col] || 0;
                currentX += columnWidth * cellWidth;
                
                // For infinite segments, continue until end of grid
                // For finite segments, stop if we've gone past the segment
                if (segment.endX !== Infinity && currentX > segment.endX) break;
            }
            
            return ghostPositions;
        }
    };
}

/**
 * Converts canvas x to time in seconds for audio scheduling
 * @param {number} canvasX - Canvas x position
 * @param {Object} coordinateMapping - Result from createCoordinateMapping
 * @param {number} baseMicrobeatDuration - Base duration per microbeat in seconds
 * @returns {number} Time in seconds
 */
export function canvasXToSeconds(canvasX, coordinateMapping, baseMicrobeatDuration) {
    let totalSeconds = 0;
    
    for (const segment of coordinateMapping.segments) {
        if (canvasX >= segment.startX && canvasX < segment.endX) {
            // Position is in this segment
            const offsetInSegment = canvasX - segment.startX;
            const microbeatsInOffset = offsetInSegment / segment.spacingPx;
            const segmentDuration = baseMicrobeatDuration / segment.scale;
            return totalSeconds + microbeatsInOffset * segmentDuration;
        }
        
        // Add duration from this entire segment
        const segmentWidth = segment.endX - segment.startX;
        const microbeatsInSegment = segmentWidth / segment.spacingPx;
        const segmentDuration = baseMicrobeatDuration / segment.scale;
        totalSeconds += microbeatsInSegment * segmentDuration;
    }
    
    return totalSeconds;
}

/**
 * Converts time in seconds to canvas x position
 * @param {number} seconds - Time in seconds
 * @param {Object} coordinateMapping - Result from createCoordinateMapping
 * @param {number} baseMicrobeatDuration - Base duration per microbeat in seconds
 * @returns {number} Canvas x position
 */
export function secondsToCanvasX(seconds, coordinateMapping, baseMicrobeatDuration) {
    let currentSeconds = 0;
    
    for (const segment of coordinateMapping.segments) {
        const segmentWidth = segment.endX - segment.startX;
        const microbeatsInSegment = segmentWidth / segment.spacingPx;
        const segmentDuration = baseMicrobeatDuration / segment.scale;
        const totalSegmentDuration = microbeatsInSegment * segmentDuration;
        
        if (currentSeconds + totalSegmentDuration >= seconds) {
            // Target time is in this segment
            const offsetInSegment = seconds - currentSeconds;
            const microbeatsInOffset = offsetInSegment / segmentDuration;
            return segment.startX + microbeatsInOffset * segment.spacingPx;
        }
        
        currentSeconds += totalSegmentDuration;
    }
    
    return coordinateMapping.segments[coordinateMapping.segments.length - 1]?.endX || 0;
}

/**
 * Converts a column's modulated trigger time to regular transport time for scheduling
 * This is needed because Tone.Transport runs at regular speed but notes need to
 * trigger when the playhead reaches their visual position on the modulated grid.
 * 
 * @param {number} columnIndex - The column index of the note
 * @param {Array} regularTimeMap - Regular time map (timeMap from transportService)
 * @returns {number} Regular transport time in seconds
 */
export function columnToRegularTime(columnIndex, regularTimeMap) {
    if (columnIndex >= 0 && columnIndex < regularTimeMap.length) {
        const regularTime = regularTimeMap[columnIndex];
        console.log(`[TIME-CONVERSION] Column ${columnIndex} → regular=${regularTime.toFixed(4)}s`);
        return regularTime;
    }
    
    // Fallback: return a reasonable approximation
    console.warn(`[TIME-CONVERSION] Column ${columnIndex} out of range, using fallback`);
    return columnIndex * 0.333; // Rough approximation
}