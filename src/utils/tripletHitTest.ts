// Hit testing utility for detecting individual shapes within triplet groups
/**
 * COORDINATE SYSTEM NOTE:
 * - placement.startCellIndex is a time-based cell index (ignores tonic columns)
 * - Must convert: cell index → time index → visual column → canvas-space column
 * - Uses timeIndexToVisualColumn() just like tripletRenderer
 */

import { getTripletStampById, tripletCenterPercents } from '@/rhythm/triplets.ts';
import { getColumnX, getRowY } from '@components/canvas/PitchGrid/renderers/rendererUtils.js';
import { timeIndexToVisualColumn } from '@services/columnMap.ts';
import store from '@state/index.ts';

export interface TripletPlacement {
  stampId: number | string;
  startCellIndex: number;
  span: number;
  row: number;
  shapeOffsets?: Record<string, number>;
  [key: string]: unknown;
}

export interface TripletRenderOptions {
  cellWidth: number;
  cellHeight: number;
  columnWidths?: number[];
  [key: string]: unknown;
}

export interface TripletHitResult {
  type: 'triplet';
  slot: number;
  shapeKey: string;
  cx: number;
  cy: number;
  placement: TripletPlacement;
}

/**
 * Finds the individual shape (notehead) under mouse position within a triplet group.
 */
export function hitTestTripletShape(mouseX: number, mouseY: number, placement: TripletPlacement, options: TripletRenderOptions): TripletHitResult | null {
  const stampId = typeof placement.stampId === 'string' ? Number(placement.stampId) : placement.stampId;
  const stamp = getTripletStampById(stampId);
  if (!stamp) {
    return null;
  }

  // COORDINATE SYSTEM NOTE:
  // Convert cell index → time index → visual column → canvas-space column
  // (Same conversion as tripletRenderer to ensure consistency)
  const startTimeIndex = placement.startCellIndex * 2; // Each cell = 2 microbeats
  const endTimeIndex = (placement.startCellIndex + placement.span) * 2;

  const startVisual = timeIndexToVisualColumn(store.state, startTimeIndex);
  const endVisual = timeIndexToVisualColumn(store.state, endTimeIndex);

  if (startVisual === null || endVisual === null) {
    return null;
  }

  // Convert full-space to canvas-space
  const startColumn = startVisual - 2;
  const endColumn = endVisual - 2;

  // Calculate triplet group bounds
  const groupX = getColumnX(startColumn, options);
  const groupEndX = getColumnX(endColumn, options);
  const groupWidth = groupEndX - groupX;
  const groupHeight = options.cellHeight;

  // Test each active slot in the triplet
  for (const slot of stamp.hits) {
    const shapeKey = `triplet_${slot}`;
    const rowOffset = (placement.shapeOffsets?.[shapeKey]) || 0;
    const shapeRow = placement.row + rowOffset;
    const shapeCenterY = getRowY(shapeRow, options);

    // Calculate notehead position (matching tripletRenderer.js)
    const centerPercent = tripletCenterPercents[slot];
    if (centerPercent === undefined) {
      continue;
    }
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
 * Tests if mouse is over any triplet shape in the given placements array.
 */
export function hitTestAnyTripletShape(mouseX: number, mouseY: number, placements: TripletPlacement[], options: TripletRenderOptions): TripletHitResult | null {
  for (const placement of placements) {
    const hitResult = hitTestTripletShape(mouseX, mouseY, placement, options);
    if (hitResult) {
      return hitResult;
    }
  }

  return null;
}
