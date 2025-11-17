// js/utils/stampHitTest.js
// Hit testing utility for detecting individual shapes within stamps

import { getStampById } from '@/rhythm/stamps.js';
import { getColumnX, getRowY } from '@components/canvas/pitchGrid/renderers/rendererUtils.js';

/**
 * Finds the individual shape (diamond or oval) under mouse position
 * @param {number} mouseX - Canvas x position
 * @param {number} mouseY - Canvas y position
 * @param {Object} placement - StampPlacement object
 * @param {Object} options - Rendering options (cellWidth, cellHeight, columnWidths, etc.)
 * @returns {Object|null} { type: 'diamond'|'oval', slot: 0-3, cx, cy, placement } or null
 */
export function hitTestStampShape(mouseX, mouseY, placement, options) {
  const stamp = getStampById(placement.stampId);
  if (!stamp) {
    return null;
  }

  // Calculate stamp bounds
  const stampX = getColumnX(placement.startColumn, options);
  const stampY = getRowY(placement.row, options) - (options.cellHeight / 2);
  const stampWidth = options.cellWidth * 2; // Stamps span 2 microbeats
  const stampHeight = options.cellHeight;

  // Calculate slot centers (matching stampRenderer.js)
  const slotCenters = [0.125, 0.375, 0.625, 0.875].map(
    ratio => stampX + ratio * stampWidth
  );

  // Test diamonds first (smaller, more precise hit targets)
  for (const slot of stamp.diamonds) {
    const shapeKey = `diamond_${slot}`;
    const rowOffset = (placement.shapeOffsets?.[shapeKey]) || 0;
    const shapeRow = placement.row + rowOffset;
    const shapeCenterY = getRowY(shapeRow, options);

    const cx = slotCenters[slot];
    const distance = Math.sqrt(
      Math.pow(mouseX - cx, 2) + Math.pow(mouseY - shapeCenterY, 2)
    );

    // Hit radius - increased for easier hover detection and dragging
    const hitRadius = Math.min(stampWidth * 0.20, stampHeight * 1.0);

    if (distance < hitRadius) {
      return {
        type: 'diamond',
        slot,
        shapeKey,
        cx,
        cy: shapeCenterY,
        placement
      };
    }
  }

  // Test ovals (larger hit targets)
  for (const ovalStart of stamp.ovals) {
    const shapeKey = `oval_${ovalStart}`;
    const rowOffset = (placement.shapeOffsets?.[shapeKey]) || 0;
    const shapeRow = placement.row + rowOffset;
    const shapeCenterY = getRowY(shapeRow, options);

    const cx = ovalStart === 0 ?
      stampX + 0.25 * stampWidth :
      stampX + 0.75 * stampWidth;

    const distance = Math.sqrt(
      Math.pow(mouseX - cx, 2) + Math.pow(mouseY - shapeCenterY, 2)
    );

    // Hit radius for ovals - larger for easier interaction
    const hitRadius = Math.min(stampWidth * 0.25, stampHeight * 1.0);

    if (distance < hitRadius) {
      return {
        type: 'oval',
        slot: ovalStart,
        shapeKey,
        cx,
        cy: shapeCenterY,
        placement
      };
    }
  }

  return null;
}

/**
 * Tests if mouse is over any stamp shape in the given placements array
 * @param {number} mouseX - Canvas x position
 * @param {number} mouseY - Canvas y position
 * @param {Array} placements - Array of StampPlacement objects
 * @param {Object} options - Rendering options
 * @returns {Object|null} Hit result or null
 */
export function hitTestAnyStampShape(mouseX, mouseY, placements, options) {
  for (const placement of placements) {
    const hitResult = hitTestStampShape(mouseX, mouseY, placement, options);
    if (hitResult) {
      return hitResult;
    }
  }

  return null;
}
