// js/utils/tripletHitTest.js
// Hit testing utility for detecting individual shapes within triplet groups

import { getTripletStampById, tripletCenterPercents } from '@/rhythm/triplets.js';
import { getColumnX, getRowY } from '@components/canvas/pitchGrid/renderers/rendererUtils.js';

/**
 * Finds the individual shape (notehead) under mouse position within a triplet group
 * @param {number} mouseX - Canvas x position
 * @param {number} mouseY - Canvas y position
 * @param {Object} placement - TripletPlacement object
 * @param {Object} options - Rendering options (cellWidth, cellHeight, columnWidths, etc.)
 * @returns {Object|null} { type: 'triplet', slot: 0-2, shapeKey, cx, cy, placement } or null
 */
export function hitTestTripletShape(mouseX, mouseY, placement, options) {
    const stamp = getTripletStampById(placement.stampId);
    if (!stamp) {
        return null;
    }

    // Convert cell index to microbeat columns
    const startColumn = placement.startCellIndex * 2; // Each cell = 2 microbeats

    // Calculate triplet group bounds
    const groupX = getColumnX(startColumn, options);
    const groupY = getRowY(placement.row, options) - (options.cellHeight / 2);
    const groupWidth = options.cellWidth * 2 * placement.span; // span cells * 2 microbeats per cell
    const groupHeight = options.cellHeight;

    // Test each active slot in the triplet
    for (const slot of stamp.hits) {
        const shapeKey = `triplet_${slot}`;
        const rowOffset = (placement.shapeOffsets?.[shapeKey]) || 0;
        const shapeRow = placement.row + rowOffset;
        const shapeCenterY = getRowY(shapeRow, options);

        // Calculate notehead position (matching tripletRenderer.js)
        const centerPercent = tripletCenterPercents[slot];
        const cx = groupX + (groupWidth * centerPercent / 100);

        const distance = Math.sqrt(
            Math.pow(mouseX - cx, 2) + Math.pow(mouseY - shapeCenterY, 2)
        );

        // Hit radius - generous vertical hit area for easier dragging
        const hitRadius = Math.min(groupWidth * 0.15, groupHeight * 1.0);

        if (distance < hitRadius) {
            return {
                type: 'triplet',
                slot,
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
 * Tests if mouse is over any triplet shape in the given placements array
 * @param {number} mouseX - Canvas x position
 * @param {number} mouseY - Canvas y position
 * @param {Array} placements - Array of TripletPlacement objects
 * @param {Object} options - Rendering options
 * @returns {Object|null} Hit result or null
 */
export function hitTestAnyTripletShape(mouseX, mouseY, placements, options) {
    for (const placement of placements) {
        const hitResult = hitTestTripletShape(mouseX, mouseY, placement, options);
        if (hitResult) {
            return hitResult;
        }
    }

    return null;
}
