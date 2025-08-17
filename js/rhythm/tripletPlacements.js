// js/rhythm/tripletPlacements.js
import { getTripletStampById, GROUP_WIDTH_CELLS } from './triplets.js';
import store from '../state/index.js';
import logger from '../utils/logger.js';

logger.moduleLoaded('TripletPlacements', 'triplets');

/**
 * Represents a placed triplet group
 * @typedef {Object} TripletPlacement
 * @property {string} id - Unique identifier
 * @property {number} stampId - ID of the triplet stamp (1-14)
 * @property {number} startCellIndex - Start cell index in the grid (cell = 2 microbeats)
 * @property {number} span - Number of cells the triplet spans (1 or 2)
 * @property {number} row - Row index in the grid (pitch)
 * @property {string} color - Color for the triplet
 * @property {number} timestamp - When placed
 */

/**
 * Places a triplet group at the specified grid position
 * @param {number} tripletStampId - The triplet stamp ID to place (1-14)
 * @param {number} startCellIndex - Grid start cell index
 * @param {number} row - Grid row index
 * @param {string} color - Color for the triplet
 * @returns {TripletPlacement|null} The placed triplet or null if invalid
 */
export function placeTripletGroup(tripletStampId, startCellIndex, row, color = '#4a90e2') {
  const stamp = getTripletStampById(tripletStampId);
  if (!stamp) {
    logger.warn('TripletPlacements', `Invalid triplet stamp ID: ${tripletStampId}`, { tripletStampId }, 'triplets');
    return null;
  }

  const span = GROUP_WIDTH_CELLS[stamp.span];
  
  // Check for collisions with existing rhythm elements
  if (!canPlaceTripletAt(startCellIndex, span, row)) {
    logger.debug('TripletPlacements', `Cannot place triplet at cell ${startCellIndex}, row ${row} - collision detected`, { 
      tripletStampId, startCellIndex, row, span 
    }, 'triplets');
    return null;
  }

  // Create the triplet placement
  const placement = {
    id: `triplet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    stampId: tripletStampId,
    startCellIndex,
    span,
    row,
    color,
    timestamp: Date.now()
  };

  // Add to state store
  return store.addTripletPlacement(placement);
}

/**
 * Checks if a triplet group can be placed at the specified position
 * @param {number} startCellIndex - Start cell index
 * @param {number} span - Number of cells the triplet spans
 * @param {number} row - Row index
 * @returns {boolean} True if placement is valid
 */
export function canPlaceTripletAt(startCellIndex, span, row) {
  const state = store.state;
  
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
 * @param {number} eraseStartCol - Start column of eraser (in microbeats)
 * @param {number} eraseEndCol - End column of eraser (in microbeats)
 * @param {number} eraseStartRow - Start row of eraser
 * @param {number} eraseEndRow - End row of eraser
 * @returns {boolean} True if any triplets were removed
 */
export function eraseTripletGroups(eraseStartCol, eraseEndCol, eraseStartRow, eraseEndRow) {
  const state = store.state;
  if (!state.tripletPlacements) return false;

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
 * @returns {Array} Array of triplet placement data for scheduling
 */
export function getTripletPlaybackData() {
  const state = store.state;
  if (!state.tripletPlacements) return [];

  return state.tripletPlacements.map(placement => ({
    startCellIndex: placement.startCellIndex,
    stampId: placement.stampId,
    row: placement.row,
    color: placement.color,
    span: placement.span
  }));
}

/**
 * Clears all triplet placements
 */
export function clearAllTripletPlacements() {
  store.clearAllTripletPlacements();
  logger.info('TripletPlacements', 'Cleared all triplet placements', null, 'triplets');
}