// Hit testing utility for detecting individual shapes within stamps
/**
 * COORDINATE SYSTEM NOTE:
 * - placement.startColumn is canvas-space (0 = first musical beat)
 * - getColumnX() converts canvas-space column index to pixel position
 * - All hit testing uses canvas-space coordinates
 */

import { getStampById } from '@/rhythm/stamps.ts';
import { getColumnX, getRowY } from '@components/canvas/PitchGrid/renderers/rendererUtils.js';

export interface StampPlacement {
  stampId: number | string;
  startColumn: number;
  row: number;
  shapeOffsets?: Record<string, number>;
  [key: string]: unknown;
}

export interface StampRenderOptions {
  cellWidth: number;
  cellHeight: number;
  columnWidths?: number[];
  [key: string]: unknown;
}

export interface StampHitResult {
  type: 'diamond' | 'oval';
  slot: number;
  shapeKey: string;
  cx: number;
  cy: number;
  placement: StampPlacement;
}

/**
 * Finds the individual shape (diamond or oval) under mouse position.
 */
export function hitTestStampShape(mouseX: number, mouseY: number, placement: StampPlacement, options: StampRenderOptions): StampHitResult | null {
  const stampId = typeof placement.stampId === 'string' ? Number(placement.stampId) : placement.stampId;
  const stamp = getStampById(stampId);
  if (!stamp) {
    return null;
  }

  // Calculate stamp bounds
  const stampX = getColumnX(placement.startColumn, options);
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
    if (cx === undefined) {
      continue;
    }
    const distance = Math.sqrt(
      Math.pow(mouseX - cx, 2) + Math.pow(mouseY - shapeCenterY, 2)
    );

    // Hit radius - increased for easier hover detection and dragging
    const hitRadius = Math.min(stampWidth * 0.20, stampHeight * 1.0);

    if (distance < hitRadius) {
      return {
        type: 'diamond',
        slot: slot ?? 0,
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
 * Tests if mouse is over any stamp shape in the given placements array.
 */
export function hitTestAnyStampShape(mouseX: number, mouseY: number, placements: StampPlacement[], options: StampRenderOptions): StampHitResult | null {
  for (const placement of placements) {
    const hitResult = hitTestStampShape(mouseX, mouseY, placement, options);
    if (hitResult) {
      return hitResult;
    }
  }

  return null;
}
