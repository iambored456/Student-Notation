// js/rhythm/tripletPlacements.ts
import { getTripletStampById, GROUP_WIDTH_CELLS } from './triplets.js';
import store from '@state/index.ts';
import logger from '@utils/logger.ts';
import { isWithinTonicSpan, type TonicSign } from '@utils/tonicColumnUtils.ts';
import { getPlacedTonicSigns } from '@state/selectors.ts';
import { timeToCanvas } from '../services/columnMapService.ts';
import type { TripletPlacement } from '../../types/state.js';

logger.moduleLoaded('TripletPlacements', 'triplets');

/**
 * Places a triplet group at the specified grid position
 */
export function placeTripletGroup(tripletStampId: number, startCellIndex: number, row: number, color = '#4a90e2'): TripletPlacement | null {
  const stamp = getTripletStampById(tripletStampId);
  if (!stamp) {
    logger.warn('TripletPlacements', `Invalid triplet stamp ID: ${tripletStampId}`, { tripletStampId }, 'triplets');
    return null;
  }

  const span = GROUP_WIDTH_CELLS[stamp.span] ?? 1;

  // Check for collisions with existing rhythm elements
  if (!canPlaceTripletAt(startCellIndex, span, row)) {
    logger.debug('TripletPlacements', `Cannot place triplet at cell ${startCellIndex}, row ${row} - collision detected`, {
      tripletStampId, startCellIndex, row, span
    }, 'triplets');
    return null;
  }

  // Calculate globalRow from current pitch range
  const pitchRange = store.state.pitchRange || { topIndex: 0, bottomIndex: store.state.fullRowData.length - 1 };
  const globalRow = row + pitchRange.topIndex;

  // Create the triplet placement
  const placement = {
    id: `triplet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    stampId: tripletStampId,
    startCellIndex,
    span,
    row,
    globalRow,
    color,
    timestamp: Date.now()
  };

  // Add to state store
  return store.addTripletPlacement(placement);
}

/**
 * Checks if a triplet group can be placed at the specified position
 */
export function canPlaceTripletAt(startCellIndex: number, span: number, row: number): boolean {
  const state = store.state;
  const placedTonicSigns = getPlacedTonicSigns(state) as TonicSign[];

  // Check for collisions with tonic columns
  // Triplets have a fixed TIME duration (span * 2 microbeats) but we need to check
  // if any tonic column falls within the CANVAS range they would occupy.
  //
  // Key insight: A triplet at time 6-10 occupies canvas columns based on its TIME span,
  // not the inflated canvas range that includes tonic offsets.
  // We check: is there any tonic with canvas column in [startCanvas, startCanvas + timeSpan)?

  const startTimeMicrobeat = startCellIndex * 2;
  const timeSpan = span * 2; // How many time columns (microbeats) this triplet occupies

  // Get the canvas-space start column
  const startCanvasCol = timeToCanvas(startTimeMicrobeat, state);

  // The triplet occupies `timeSpan` worth of PLAYABLE columns starting at startCanvasCol
  // We need to check if any tonic falls within the next `timeSpan` canvas columns
  // But we also need to account for any tonics that might be IN that range

  console.log(`[TRIPLET VALIDATION] Checking triplet: cells ${startCellIndex}-${startCellIndex + span}, time span=${timeSpan} microbeats`);
  console.log(`[TRIPLET VALIDATION] Start canvas col: ${startCanvasCol}`);
  console.log(`[TRIPLET VALIDATION] Tonic signs:`, placedTonicSigns);

  // Check if any tonic column index falls within our required canvas range
  // For a triplet needing `timeSpan` playable columns starting at startCanvasCol,
  // we check columns startCanvasCol to startCanvasCol + timeSpan - 1 (inclusive)
  // But we must also check if ANY tonic in between would push our end beyond where we want
  for (const tonicSign of placedTonicSigns) {
    const tonicStart = tonicSign.columnIndex;
    const tonicEnd = tonicSign.columnIndex + 1; // Tonic occupies 2 columns

    // A tonic blocks placement if it starts within our required time span from startCanvasCol
    // Since we need `timeSpan` playable columns, any tonic at canvas [startCanvasCol, startCanvasCol + timeSpan)
    // would cause the triplet to visually stretch over it
    if (tonicStart >= startCanvasCol && tonicStart < startCanvasCol + timeSpan) {
      console.log(`[TRIPLET VALIDATION] ❌ BLOCKED - tonic at canvas ${tonicStart} is within required span [${startCanvasCol}, ${startCanvasCol + timeSpan})`);
      return false;
    }

    // Also check if we're trying to start ON a tonic
    if (startCanvasCol >= tonicStart && startCanvasCol <= tonicEnd) {
      console.log(`[TRIPLET VALIDATION] ❌ BLOCKED - start canvas col ${startCanvasCol} is on tonic span ${tonicStart}-${tonicEnd}`);
      return false;
    }
  }

  console.log(`[TRIPLET VALIDATION] ✅ ALLOWED - no tonic collision in visual range`);

  // Check for collisions with existing stamp placements
  if (state.stampPlacements) {
    for (const placement of state.stampPlacements) {
      if (placement.row === row) {
        // Check if this stamp overlaps with our triplet cells
        const stampStartCell = Math.floor(placement.startColumn / 2); // Convert microbeat columns to cells
        const stampEndCell = Math.floor(placement.endColumn / 2);

        for (let i = 0; i < span; i++) {
          const cellIndex = startCellIndex + i;
          if (cellIndex >= stampStartCell && cellIndex <= stampEndCell) {
            return false;
          }
        }
      }
    }
  }

  // Check for collisions with existing triplet placements
  if (state.tripletPlacements) {
    for (const placement of state.tripletPlacements) {
      if (placement.row === row) {
        // Check if triplet groups overlap
        const existingEnd = placement.startCellIndex + placement.span - 1;
        const newEnd = startCellIndex + span - 1;

        if (!(newEnd < placement.startCellIndex || startCellIndex > existingEnd)) {
          return false; // Overlapping
        }
      }
    }
  }

  return true;
}

/**
 * Removes triplet groups that intersect with an eraser area
 */
export function eraseTripletGroups(eraseStartCol: number, eraseEndCol: number, eraseStartRow: number, eraseEndRow: number): boolean {
  const state = store.state;
  if (!state.tripletPlacements) {return false;}

  // Convert microbeat columns to cell indices
  const eraseStartCell = Math.floor(eraseStartCol / 2);
  const eraseEndCell = Math.floor(eraseEndCol / 2);

  const toRemove = [];

  for (const placement of state.tripletPlacements) {
    // Check if triplet is in the eraser's row range
    if (placement.row >= eraseStartRow && placement.row <= eraseEndRow) {
      // Check if triplet overlaps with eraser's cell range
      const tripletEndCell = placement.startCellIndex + placement.span - 1;

      if (!(tripletEndCell < eraseStartCell || placement.startCellIndex > eraseEndCell)) {
        toRemove.push(placement.id);
      }
    }
  }

  if (toRemove.length > 0) {
    toRemove.forEach(id => store.removeTripletPlacement(id));
    logger.debug('TripletPlacements', `Erased ${toRemove.length} triplet groups`, {
      removedIds: toRemove,
      eraseArea: { eraseStartCell, eraseEndCell, eraseStartRow, eraseEndRow }
    }, 'triplets');
    return true;
  }

  return false;
}

/**
 * Gets all triplet placements for playback scheduling
 */
export function getTripletPlaybackData(): unknown[] {
  const state = store.state;
  if (!state.tripletPlacements) {return [];}

  return state.tripletPlacements.map((placement: TripletPlacement) => ({
    startCellIndex: placement.startCellIndex,
    stampId: placement.stampId,
    row: placement.row,
    color: placement.color,
    span: placement.span,
    placement  // Include full placement object with shapeOffsets
  }));
}

/**
 * Clears all triplet placements
 */
export function clearAllTripletPlacements(): void {
  store.clearAllTripletPlacements();
  logger.info('TripletPlacements', 'Cleared all triplet placements', null, 'triplets');
}
