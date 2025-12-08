// js/components/Canvas/PitchGrid/renderers/modulationRenderer.ts
import { getModulationDisplayText, getModulationColor } from '../../../../rhythm/modulationMapping.js';
import { getMacrobeatInfo } from '@state/selectors.ts';
import { getColumnX } from './rendererUtils.js';
import logger from '@utils/logger.ts';
import { getLogicalCanvasHeight } from '@utils/canvasDimensions.ts';
import store from '@state/index.ts';
import type { AppState, ModulationMarker } from '../../../../../types/state.js';

type RendererOptions = AppState & { columnWidths: number[]; modulationMarkers: ModulationMarker[] };
type MarkerWithCanvas = ModulationMarker & { xCanvas: number };
type HitResult = { marker: MarkerWithCanvas; type: 'label' | 'barline'; canDrag: boolean } | null;

/**
 * Converts a measure index to canvas X position for rendering
 * @param {number} measureIndex - Measure index
 * @param {Object} options - Render options with state
 * @returns {number} Canvas X position
 */
function measureIndexToCanvasX(measureIndex: number, options: RendererOptions): number {
  if (measureIndex === 0) {
    // Start of first measure (canvas-space column 0)
    return getColumnX(0, options);
  }

  // Find the macrobeat that corresponds to this measure
  // measureIndex is 1-based (measureIndex 1 = "after macrobeat 0")
  // Convert to 0-based macrobeatIndex
  const macrobeatIndex = measureIndex - 1;
  // IMPORTANT: Use store.state instead of options to ensure we have the latest tonic data
  const measureInfo = getMacrobeatInfo(store.state, macrobeatIndex);

  if (measureInfo) {
    // Position at end of this measure (getMacrobeatInfo returns canvas-space coordinates)
    return getColumnX(measureInfo.endColumn + 1, options);
  }

  logger.warn('ModulationRenderer', 'Could not find measure info for index', { measureIndex }, 'grid');
  return measureIndex * 200; // Fallback
}

/**
 * Renders modulation markers with barlines and labels
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} options - Render options containing modulation markers
 */
export function renderModulationMarkers(ctx: CanvasRenderingContext2D, options: RendererOptions): void {
  const { modulationMarkers } = options;

  if (!modulationMarkers || modulationMarkers.length === 0) {
    return;
  }

  // Convert measure-based markers to canvas positions
  const markersWithCanvasX: MarkerWithCanvas[] = modulationMarkers
    .filter(marker => marker.active)
    .map(marker => {
      let canvasX: number;

      // ALIGNMENT FIX: Check what data the marker actually has and calculate accordingly
      if (marker.columnIndex !== null && marker.columnIndex !== undefined) {
        // Use modulated column calculation to match current grid display
        canvasX = getColumnX(marker.columnIndex + 1, options); // +1 because getColumnX gives end of column
      } else if (marker.macrobeatIndex !== null && marker.macrobeatIndex !== undefined && marker.macrobeatIndex >= 0) {
        // Use the macrobeat index to find the correct boundary position
        // IMPORTANT: Use store.state instead of options to ensure we have the latest tonic data
        const macrobeatInfo = getMacrobeatInfo(store.state, marker.macrobeatIndex);
        if (macrobeatInfo) {
          canvasX = getColumnX(macrobeatInfo.endColumn + 1, options);
        } else {
          logger.warn('ModulationRenderer', 'Could not find macrobeat info for index', { macrobeatIndex: marker.macrobeatIndex }, 'grid');
          canvasX = marker.xPosition ?? 0;
        }
      } else if (marker.measureIndex !== null && marker.measureIndex !== undefined) {
        // Fallback to measure calculation (handles measureIndex 0 and macrobeatIndex -1)
        canvasX = measureIndexToCanvasX(marker.measureIndex, options);
      } else {
        // Final fallback to stored position
        canvasX = marker.xPosition ?? 0;
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
    renderSingleMarker(ctx, marker);
  });

  // Restore context state
  ctx.restore();
}

// Renders a single modulation marker
function renderSingleMarker(ctx: CanvasRenderingContext2D, marker: MarkerWithCanvas): void {
  const xCanvas = marker.xCanvas;
  const ratio = marker.ratio;
  const color = getModulationColor(ratio);
  const displayText = getModulationDisplayText(ratio);

  // Draw vertical barline
  drawBarline(ctx, xCanvas, color);

  // Draw ratio label above the barline
  drawRatioLabel(ctx, xCanvas, displayText, color);
}

/**
 * Draws the vertical barline for a modulation marker
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} xCanvas - X position of the marker
 * @param {string} color - Color for the barline
 */
function drawBarline(ctx: CanvasRenderingContext2D, xCanvas: number, color: string): void {
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
 */
function drawRatioLabel(ctx: CanvasRenderingContext2D, xCanvas: number, displayText: string, color: string): void {
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
function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fillColor: string): void {
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
 * @returns {Object|null} Hit test result with marker and interaction type
 */
export function hitTestModulationMarker(x: number, y: number, marker: MarkerWithCanvas): HitResult {
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
export function getModulationMarkerCursor(hitResult: HitResult): string {
  if (!hitResult) {return 'default';}

  switch (hitResult.type) {
    case 'label':
      return 'pointer';
    case 'barline':
      return hitResult.canDrag ? 'ew-resize' : 'pointer';
    default:
      return 'default';
  }
}
