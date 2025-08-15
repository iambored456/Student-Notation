// js/rhythm/stampPlacements.js
import { getStampById } from './stamps.js';
import store from '../state/index.js';
import logger from '../utils/logger.js';

logger.moduleLoaded('StampPlacements', 'stamps');

// Note: Stamp placements are now stored in the main state store instead of a local Map
// This provides persistence, undo/redo support, and proper state management

/**
 * Represents a placed stamp
 * @typedef {Object} StampPlacement
 * @property {string} id - Unique identifier
 * @property {number} stampId - ID of the stamp from SIXTEENTH_STAMPS
 * @property {number} startColumn - Start column index in the grid (spans 2 microbeats)
 * @property {number} endColumn - End column index (startColumn + 1)
 * @property {number} row - Row index in the grid (pitch)
 * @property {string} color - Color for the stamp
 * @property {number} timestamp - When placed
 */

/**
 * Places a stamp at the specified grid position
 * @param {number} stampId - The stamp ID to place
 * @param {number} startColumn - Grid start column index
 * @param {number} row - Grid row index
 * @param {string} color - Color for the stamp
 * @returns {StampPlacement|null} The placed stamp or null if invalid
 */
export function placeStamp(stampId, startColumn, row, color = '#4a90e2') {
  const stamp = getStampById(stampId);
  if (!stamp) {
    logger.warn('StampPlacements', `Invalid stamp ID: ${stampId}`, { stampId }, 'stamps');
    return null;
  }

  // Use store methods for placement with collision detection and state management
  return store.addStampPlacement(stampId, startColumn, row, color);
}

// Note: Collision detection and removal functions are now handled by the store actions

/**
 * Removes stamps that intersect with an eraser area (similar to circle note erasing)
 * @param {number} eraseStartCol - Start column of eraser
 * @param {number} eraseEndCol - End column of eraser
 * @param {number} eraseStartRow - Start row of eraser
 * @param {number} eraseEndRow - End row of eraser
 * @returns {boolean} True if any stamps were removed
 */
export function removeStampsInEraserArea(eraseStartCol, eraseEndCol, eraseStartRow, eraseEndRow) {
  console.log('[STAMP ERASE] Function called with:', {
    eraseStartCol,
    eraseEndCol, 
    eraseStartRow,
    eraseEndRow,
    totalStamps: store.state.stampPlacements.length,
    allStampPlacements: store.state.stampPlacements.map(p => ({
      id: p.id,
      startCol: p.startColumn,
      endCol: p.endColumn,
      row: p.row
    }))
  });
  
  // Use store method for erasing stamps
  return store.eraseStampsInArea(eraseStartCol, eraseEndCol, eraseStartRow, eraseEndRow);
}

/**
 * Legacy function for backward compatibility - removes stamps at a specific position
 * @param {number} column - Grid column index
 * @param {number} row - Grid row index
 * @returns {boolean} True if a stamp was removed
 */
export function removeStampAt(column, row) {
  return removeStampsInEraserArea(column, column + 1, row, row);
}

/**
 * Gets all stamp placements
 * @returns {Array<StampPlacement>} Array of all placed stamps
 */
export function getAllStampPlacements() {
  return store.getAllStampPlacements();
}

/**
 * Gets stamp placement at specific position
 * @param {number} column - Grid column index
 * @param {number} row - Grid row index
 * @returns {StampPlacement|null} The stamp at this position or null
 */
export function getStampAt(column, row) {
  return store.getStampAt(column, row);
}

/**
 * Clears all stamp placements
 */
export function clearAllStamps() {
  store.clearAllStamps();
}

/**
 * Gets stamp placements for playback scheduling
 * @returns {Array<Object>} Array of playback data for stamps
 */
export function getStampPlaybackData() {
  return store.getStampPlaybackData();
}