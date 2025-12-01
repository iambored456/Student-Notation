// js/state/actions/tripletActions.ts
import logger from '@utils/logger.ts';
import type { Store, TripletPlacement, CanvasSpaceColumn } from '../../../types/state.js';

logger.moduleLoaded('TripletActions', 'triplets');

/**
 * COORDINATE SYSTEM NOTE:
 * Triplets use CELL INDICES where 1 cell = 2 microbeats (canvas-space columns).
 * - cellIndex 0 = columns 0-1 (canvas-space)
 * - cellIndex 1 = columns 2-3 (canvas-space)
 * - cellIndex N = columns (N*2) to (N*2+1) (canvas-space)
 */

function generateTripletId(): string {
  return `triplet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const tripletActions = {
  /**
     * Adds a triplet placement to the state
     * @param placement - The triplet placement object
     * @returns The placed triplet or null if invalid
     */
  addTripletPlacement(this: Store, placement: Omit<TripletPlacement, 'id'>): TripletPlacement {
    // Ensure tripletPlacements array exists
    if (!this.state.tripletPlacements) {
      this.state.tripletPlacements = [];
    }

    // Check for collision with existing triplets
    const existingTriplet = this.state.tripletPlacements.find(existing =>
      existing.row === placement.row &&
            !(existing.startCellIndex + existing.span <= placement.startCellIndex ||
              placement.startCellIndex + placement.span <= existing.startCellIndex)
    );

    if (existingTriplet) {
      // Remove existing colliding triplet
      tripletActions.removeTripletPlacement.call(this, existingTriplet.id);
    }

    // Check for collision with existing stamp placements
    if (this.state.stampPlacements) {
      const collidingStamps = this.state.stampPlacements.filter(stamp => {
        if (stamp.row !== placement.row) {return false;}

        // Convert stamp columns (canvas-space microbeats) to cells (1 cell = 2 microbeats)
        const stampStartCell = Math.floor((stamp.startColumn as number) / 2);
        const stampEndCell = Math.floor((stamp.endColumn as number) / 2);
        const tripletEndCell = placement.startCellIndex + placement.span - 1;

        return !(stampEndCell < placement.startCellIndex || stampStartCell > tripletEndCell);
      });

      // Remove colliding stamps
      collidingStamps.forEach(stamp => (this as Store & { removeStampPlacement: (id: string) => boolean }).removeStampPlacement(stamp.id));
    }

    const finalPlacement = {
      id: generateTripletId(),
      ...placement
    };

    this.state.tripletPlacements.push(finalPlacement);
    this.emit('tripletPlacementsChanged');

    // Force grid refresh
    this.emit('rhythmStructureChanged');

    logger.debug('TripletActions', `Added triplet ${placement.stampId} at cell ${placement.startCellIndex}, row ${placement.row}`, {
      stampId: placement.stampId,
      startCellIndex: placement.startCellIndex,
      span: placement.span,
      row: placement.row,
      placementId: finalPlacement.id
    }, 'triplets');

    return finalPlacement;
  },

  /**
     * Removes a triplet placement by ID
     * @param placementId - The placement ID to remove
     * @returns True if a triplet was removed
     */
  removeTripletPlacement(this: Store, placementId: string): boolean {
    if (!this.state.tripletPlacements) {return false;}

    const index = this.state.tripletPlacements.findIndex(p => p.id === placementId);
    if (index === -1) {return false;}

    const removed = this.state.tripletPlacements.splice(index, 1)[0];
    if (!removed) {return false;}

    this.emit('tripletPlacementsChanged');

    logger.debug('TripletActions', `Removed triplet ${removed.stampId} at cell ${removed.startCellIndex}, row ${removed.row}`, {
      placementId,
      stampId: removed.stampId,
      startCellIndex: removed.startCellIndex,
      span: removed.span,
      row: removed.row
    }, 'triplets');

    return true;
  },

  /**
     * Removes triplets that intersect with an eraser area
     * @param eraseStartCol - Start column of eraser (canvas-space microbeat column)
     * @param eraseEndCol - End column of eraser (canvas-space microbeat column)
     * @param eraseStartRow - Start row of eraser
     * @param eraseEndRow - End row of eraser
     * @returns True if any triplets were removed
     */
  eraseTripletsInArea(this: Store, eraseStartCol: CanvasSpaceColumn, eraseEndCol: CanvasSpaceColumn, eraseStartRow: number, eraseEndRow: number): boolean {
    if (!this.state.tripletPlacements) {return false;}

    // Convert canvas-space microbeat columns to cell indices (1 cell = 2 microbeats)
    const eraseStartCell = Math.floor((eraseStartCol as number) / 2);
    const eraseEndCell = Math.floor((eraseEndCol as number) / 2);

    const toRemove: string[] = [];

    for (const placement of this.state.tripletPlacements) {
      // Check if triplet is in the eraser's row range
      if (placement.row >= eraseStartRow && placement.row <= eraseEndRow) {
        // Check if triplet overlaps with eraser's cell range
        const tripletEndCell = placement.startCellIndex + placement.span - 1;

        if (!(tripletEndCell < eraseStartCell || placement.startCellIndex > eraseEndCell)) {
          toRemove.push(placement.id);
        }
      }
    }

    let removed = false;
    toRemove.forEach(id => {
      if (tripletActions.removeTripletPlacement.call(this, id)) {
        removed = true;
      }
    });

    return removed;
  },

  /**
     * Gets all triplet placements
     * @returns Array of all placed triplets
     */
  getAllTripletPlacements(this: Store): TripletPlacement[] {
    return [...(this.state.tripletPlacements || [])];
  },

  /**
     * Gets triplet placement at specific position
     * @param cellIndex - Grid cell index
     * @param row - Grid row index
     * @returns The triplet at this position or null
     */
  getTripletAt(this: Store, cellIndex: number, row: number): TripletPlacement | null {
    if (!this.state.tripletPlacements) {return null;}

    return this.state.tripletPlacements.find(placement =>
      placement.row === row &&
            cellIndex >= placement.startCellIndex &&
            cellIndex < placement.startCellIndex + placement.span
    ) || null;
  },

  /**
     * Clears all triplet placements
     */
  clearAllTripletPlacements(this: Store): void {
    if (!this.state.tripletPlacements) {return;}

    const hadTriplets = this.state.tripletPlacements.length > 0;
    this.state.tripletPlacements = [];

    if (hadTriplets) {
      this.emit('tripletPlacementsChanged');
      logger.info('TripletActions', 'Cleared all triplet placements', null, 'triplets');
    }
  },

  /**
     * Gets triplet placements for playback scheduling
     * @returns Array of playback data for triplets
     */
  getTripletPlaybackData(this: Store): {
    startCellIndex: number;
    stampId: number;
    row: number;
    pitch: string;
    color: string;
    span: number;
    placement: TripletPlacement;
  }[] {
    if (!this.state.tripletPlacements) {return [];}

    return this.state.tripletPlacements.map(placement => {
      const rowData = this.state.fullRowData[placement.row];
      return {
        startCellIndex: placement.startCellIndex,
        stampId: placement.stampId,
        row: placement.row,
        pitch: rowData?.toneNote ?? '',
        color: placement.color,
        span: placement.span,
        placement  // Include full placement object with shapeOffsets
      };
    }).filter(data => data.pitch); // Only include triplets with valid pitches
  },

  /**
     * Updates the pitch offset for an individual shape within a triplet group
     * @param placementId - The triplet placement ID
     * @param shapeKey - The shape identifier (e.g., "triplet_0", "triplet_1", "triplet_2")
     * @param rowOffset - The pitch offset in rows (can be negative)
     */
  updateTripletShapeOffset(this: Store, placementId: string, shapeKey: string, rowOffset: number): void {
    const placement = this.state.tripletPlacements?.find(p => p.id === placementId);
    if (!placement) {
      logger.warn('TripletActions', '[TRIPLET SHAPE OFFSET] Placement not found', { placementId }, 'triplets');
      return;
    }

    if (!placement.shapeOffsets) {
      placement.shapeOffsets = {};
    }

    logger.debug('TripletActions', '[TRIPLET SHAPE OFFSET] Updating shape offset', {
      placementId,
      shapeKey,
      oldOffset: placement.shapeOffsets[shapeKey] || 0,
      newOffset: rowOffset,
      baseRow: placement.row,
      targetRow: placement.row + rowOffset
    }, 'triplets');

    placement.shapeOffsets[shapeKey] = rowOffset;
    this.emit('tripletPlacementsChanged');
  },

  /**
     * Gets the effective row for a specific shape within a triplet group
     * @param placement - The triplet placement object
     * @param shapeKey - The shape identifier
     * @returns The effective row index
     */
  getTripletShapeRow(this: Store, placement: TripletPlacement, shapeKey: string): number {
    const rowOffset = (placement.shapeOffsets?.[shapeKey]) || 0;
    return placement.row + rowOffset;
  }
};
