// js/state/actions/stampActions.ts
import logger from '@utils/logger.ts';
import { isWithinTonicSpan, type TonicSign } from '@utils/tonicColumnUtils.ts';
import { getPlacedTonicSigns } from '@state/selectors.ts';
import type { Store, StampPlacement, CanvasSpaceColumn } from '../../../types/state.js';

logger.moduleLoaded('StampActions', 'stamps');

function generateStampId(): string {
  return `stamp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const stampActions = {
  /**
     * Adds a stamp placement to the state
     * @param startColumn Canvas-space column index (0 = first musical beat)
     * @returns The placement if successful, null if blocked by tonic column
     */
  addStampPlacement(this: Store, stampId: number, startColumn: CanvasSpaceColumn, row: number, color = '#4a90e2'): StampPlacement | null {
    const endColumn = (startColumn + 2) as CanvasSpaceColumn; // Stamps span 2 microbeats (endColumn is exclusive)

    // Check for collision with tonic columns (stamps span 2 microbeats)
    const placedTonicSigns = getPlacedTonicSigns(this.state) as TonicSign[];
    if (isWithinTonicSpan(startColumn, placedTonicSigns) ||
        isWithinTonicSpan(startColumn + 1, placedTonicSigns)) {
      logger.debug('StampActions', `Cannot place stamp - overlaps tonic column`, {
        stampId, startColumn, row
      }, 'stamps');
      return null;
    }

    // Check for collision with existing stamps (2-microbeat collision detection)
    const existingStamp = this.state.stampPlacements.find(placement =>
      placement.row === row &&
            placement.startColumn <= endColumn &&
            placement.endColumn >= startColumn
    );

    if (existingStamp) {
      // Remove existing colliding stamp
      stampActions.removeStampPlacement.call(this, existingStamp.id);
    }

    // Calculate globalRow from current pitch range
    const pitchRange = this.state.pitchRange || { topIndex: 0, bottomIndex: this.state.fullRowData.length - 1 };
    const globalRow = row + pitchRange.topIndex;

    const placement: StampPlacement = {
      id: generateStampId(),
      stampId,
      startColumn,
      endColumn,
      row,
      globalRow,
      color,
      timestamp: Date.now()
    };

    this.state.stampPlacements.push(placement);
    this.emit('stampPlacementsChanged');

    logger.debug('StampActions', `Added stamp ${stampId} at canvas-space ${startColumn}-${endColumn},${row}`, {
      stampId,
      startColumn,
      endColumn,
      row,
      placementId: placement.id
    }, 'stamps');

    return placement;
  },

  /**
     * Removes a stamp placement by ID
     */
  removeStampPlacement(this: Store, placementId: string): boolean {
    const index = this.state.stampPlacements.findIndex(p => p.id === placementId);
    if (index === -1) {return false;}

    const removed = this.state.stampPlacements.splice(index, 1)[0];
    if (!removed) {return false;}

    this.emit('stampPlacementsChanged');

    logger.debug('StampActions', `Removed stamp ${removed.stampId} at ${removed.startColumn}-${removed.endColumn},${removed.row}`, {
      placementId,
      stampId: removed.stampId,
      startColumn: removed.startColumn,
      endColumn: removed.endColumn,
      row: removed.row
    }, 'stamps');

    return true;
  },

  /**
     * Removes stamps that intersect with an eraser area
     * @param eraseStartCol Canvas-space column index
     * @param eraseEndCol Canvas-space column index
     */
  eraseStampsInArea(this: Store, eraseStartCol: CanvasSpaceColumn, eraseEndCol: CanvasSpaceColumn, eraseStartRow: number, eraseEndRow: number): boolean {
    const toRemove = [];

    for (const placement of this.state.stampPlacements) {
      // Check for overlap between stamp's 2×1 area and eraser's area
      const horizontalOverlap = placement.startColumn <= eraseEndCol && placement.endColumn >= eraseStartCol;
      const verticalOverlap = placement.row >= eraseStartRow && placement.row <= eraseEndRow;

      if (horizontalOverlap && verticalOverlap) {
        toRemove.push(placement.id);
      }
    }

    let removed = false;
    toRemove.forEach(id => {
      if (stampActions.removeStampPlacement.call(this, id)) {
        removed = true;
      }
    });

    return removed;
  },

  /**
     * Gets all stamp placements
     */
  getAllStampPlacements(this: Store): StampPlacement[] {
    return [...this.state.stampPlacements];
  },

  /**
     * Gets stamp placement at specific position
     * @param column Canvas-space column index (0 = first musical beat)
     */
  getStampAt(this: Store, column: CanvasSpaceColumn, row: number): StampPlacement | null {
    return this.state.stampPlacements.find(placement =>
      placement.row === row &&
            column >= placement.startColumn &&
            column <= placement.endColumn
    ) || null;
  },

  /**
     * Clears all stamp placements
     */
  clearAllStamps(this: Store): void {
    const hadStamps = this.state.stampPlacements.length > 0;
    this.state.stampPlacements = [];

    if (hadStamps) {
      this.emit('stampPlacementsChanged');
      logger.info('StampActions', 'Cleared all stamp placements', null, 'stamps');
    }
  },

  /**
     * Gets stamp placements for playback scheduling
     */
  getStampPlaybackData(this: Store): unknown[] {
    return this.state.stampPlacements.map(placement => {
      const rowData = this.state.fullRowData[placement.row];
      return {
        stampId: placement.stampId,
        column: placement.startColumn,
        startColumn: placement.startColumn,
        endColumn: placement.endColumn,
        row: placement.row,
        pitch: rowData?.toneNote,
        color: placement.color,
        placement  // Include full placement object with shapeOffsets
      };
    }).filter(data => data.pitch); // Only include stamps with valid pitches
  },

  /**
     * Updates the pitch offset for an individual shape within a stamp
     */
  updateStampShapeOffset(this: Store, placementId: string, shapeKey: string, rowOffset: number): void {
    const placement = this.state.stampPlacements.find(p => p.id === placementId);
    if (!placement) {
      logger.warn('StampActions', '[STAMP SHAPE OFFSET] Placement not found', { placementId }, 'stamps');
      return;
    }

    // Initialize shapeOffsets if it doesn't exist
    if (!placement.shapeOffsets) {
      placement.shapeOffsets = {};
    }

    logger.debug('StampActions', '[STAMP SHAPE OFFSET] Updating shape offset', {
      placementId,
      shapeKey,
      oldOffset: placement.shapeOffsets[shapeKey] || 0,
      newOffset: rowOffset,
      baseRow: placement.row,
      targetRow: placement.row + rowOffset
    }, 'stamps');

    placement.shapeOffsets[shapeKey] = rowOffset;
    this.emit('stampPlacementsChanged');
  },

  /**
     * Gets the effective row for a specific shape within a stamp
     */
  getShapeRow(this: Store, placement: StampPlacement, shapeKey: string): number {
    const offset = (placement.shapeOffsets?.[shapeKey]) || 0;
    return placement.row + offset;
  }
};
