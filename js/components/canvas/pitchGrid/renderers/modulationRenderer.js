// js/components/Canvas/PitchGrid/renderers/modulationRenderer.js

import { getModulationDisplayText, getModulationColor } from '../../../../rhythm/modulationMapping.js';
import { getMacrobeatInfo } from '../../../../state/selectors.js';
import { getColumnX } from './rendererUtils.js';
import logger from '@utils/logger.js';
import { getLogicalCanvasHeight } from '@utils/canvasDimensions.js';

/**
 * Converts a measure index to canvas X position for rendering
 * @param {number} measureIndex - Measure index
 * @param {Object} options - Render options with state
 * @returns {number} Canvas X position
 */
function measureIndexToCanvasX(measureIndex, options) {
    const cellWidth = options.cellWidth || 40;
    
    if (measureIndex === 0) {
        // Start of first measure (column 2)
        return 2 * cellWidth;
    }
    
    // Find the macrobeat that corresponds to this measure
    const macrobeatIndex = measureIndex - 1;
    const measureInfo = getMacrobeatInfo(options, macrobeatIndex);
    
    if (measureInfo) {
        // Position at end of this measure
        return (measureInfo.endColumn + 1) * cellWidth;
    }
    
    logger.warn('ModulationRenderer', 'Could not find measure info for index', { measureIndex }, 'grid');
    return measureIndex * 200; // Fallback
}

/**
 * Calculates column X position without modulation effects (for stable marker positioning)
 * @param {number} columnIndex - Column index
 * @param {Object} options - Render options
 * @returns {number} Non-modulated X position
 */
function getBaseColumnX(columnIndex, options) {
    let x = 0;
    for (let i = 0; i < columnIndex; i++) {
        const widthMultiplier = options.columnWidths[i] || 0;
        x += widthMultiplier * options.cellWidth;
    }
    return x;
}

/**
 * Renders modulation markers with barlines and labels
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} options - Render options containing modulation markers
 */
export function renderModulationMarkers(ctx, options) {
    const { modulationMarkers } = options;
    
    if (!modulationMarkers || modulationMarkers.length === 0) {
        return;
    }
    
    // Convert measure-based markers to canvas positions
    const markersWithCanvasX = modulationMarkers
        .filter(marker => marker.active)
        .map(marker => {
            let canvasX;
            
            // ALIGNMENT FIX: Check what data the marker actually has and calculate accordingly
            if (marker.columnIndex !== null && marker.columnIndex !== undefined) {
                // Use modulated column calculation to match current grid display
                canvasX = getColumnX(marker.columnIndex + 1, options); // +1 because getColumnX gives end of column
            } else if (marker.macrobeatIndex !== null && marker.macrobeatIndex !== undefined) {
                // Use the macrobeat index to find the correct boundary position
                const macrobeatInfo = getMacrobeatInfo(options, marker.macrobeatIndex);
                if (macrobeatInfo) {
                    canvasX = getColumnX(macrobeatInfo.endColumn + 1, options);
                } else {
                    logger.warn('ModulationRenderer', 'Could not find macrobeat info for index', { macrobeatIndex: marker.macrobeatIndex }, 'grid');
                    canvasX = marker.xPosition || 0;
                }
            } else if (marker.measureIndex !== null && marker.measureIndex !== undefined) {
                // Fallback to measure calculation
                canvasX = measureIndexToCanvasX(marker.measureIndex, options);
            } else {
                // Final fallback to stored position
                canvasX = marker.xPosition || 0;
            }
            
            return {
                ...marker,
                xCanvas: canvasX
            };
        });
    
    // Save context state
    ctx.save();
    
    // Render each active marker
    markersWithCanvasX.forEach(marker => {
        renderSingleMarker(ctx, marker, options);
    });
    
    // Restore context state
    ctx.restore();
}

// Renders a single modulation marker
function renderSingleMarker(ctx, marker, options) {
    const xCanvas = marker.xCanvas;
    const ratio = marker.ratio;
    const color = getModulationColor(ratio);
    const displayText = getModulationDisplayText(ratio);
    
    // Draw vertical barline
    drawBarline(ctx, xCanvas, color, options);
    
    // Draw ratio label above the barline
    drawRatioLabel(ctx, xCanvas, displayText, color, options);
}

/**
 * Draws the vertical barline for a modulation marker
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} xCanvas - X position of the marker
 * @param {string} color - Color for the barline
 * @param {Object} options - Render options
 */
function drawBarline(ctx, xCanvas, color, options) {
    const lineWidth = 3; // Thick barline as specified
    const canvasHeight = getLogicalCanvasHeight(ctx.canvas);
    
    ctx.beginPath();
    ctx.moveTo(xCanvas, 0);
    ctx.lineTo(xCanvas, canvasHeight);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.setLineDash([]); // Solid line
    ctx.stroke();
}

/**
 * Draws the ratio label above a modulation marker
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} xCanvas - X position of the marker
 * @param {string} displayText - Text to display (e.g., "2:3")
 * @param {string} color - Color for the label
 * @param {Object} options - Render options
 */
function drawRatioLabel(ctx, xCanvas, displayText, color, options) {
    const fontSize = 14;
    const fontFamily = 'Arial, sans-serif';
    const padding = 6;
    const cornerRadius = 8;
    const yOffset = 20; // Distance from top of canvas
    
    // Set font for text measurement
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Measure text dimensions
    const textMetrics = ctx.measureText(displayText);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;
    
    // Calculate pill dimensions
    const pillWidth = textWidth + (padding * 2);
    const pillHeight = textHeight + (padding * 2);
    const pillX = xCanvas - (pillWidth / 2);
    const pillY = yOffset;
    
    // Draw pill background with rounded corners
    drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, cornerRadius, color);
    
    // Draw text
    ctx.fillStyle = 'white';
    ctx.fillText(displayText, xCanvas, pillY + (pillHeight / 2));
}

/**
 * Draws a rounded rectangle (for the pill-shaped label background)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Width
 * @param {number} height - Height
 * @param {number} radius - Corner radius
 * @param {string} fillColor - Fill color
 */
function drawRoundedRect(ctx, x, y, width, height, radius, fillColor) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    
    // Fill with color
    ctx.fillStyle = fillColor;
    ctx.fill();
    
    // Add subtle shadow/border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
}

/**
 * Checks if a point is inside a modulation marker's interaction area
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Object} marker - Modulation marker object
 * @param {Object} options - Render options
 * @returns {Object|null} Hit test result with marker and interaction type
 */
export function hitTestModulationMarker(x, y, marker, options) {
    const { xCanvas } = marker;
    const barlineWidth = 6; // Slightly wider hit area than visual width
    const labelHeight = 40; // Approximate label area height
    
    // Test barline hit area
    if (Math.abs(x - xCanvas) <= barlineWidth / 2) {
        if (y <= labelHeight) {
            return {
                marker,
                type: 'label',
                canDrag: false // Labels are clickable but not draggable
            };
        } else {
            return {
                marker,
                type: 'barline',
                canDrag: true // Barlines can be dragged to move the marker
            };
        }
    }
    
    return null;
}

/**
 * Gets the interaction cursor for a hit test result
 * @param {Object} hitResult - Result from hitTestModulationMarker
 * @returns {string} CSS cursor value
 */
export function getModulationMarkerCursor(hitResult) {
    if (!hitResult) return 'default';
    
    switch (hitResult.type) {
        case 'label':
            return 'pointer';
        case 'barline':
            return hitResult.canDrag ? 'ew-resize' : 'pointer';
        default:
            return 'default';
    }
}
