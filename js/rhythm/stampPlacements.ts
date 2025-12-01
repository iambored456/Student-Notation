// js/rhythm/stampPlacements.ts
import { getStampById } from './stamps.js';
import store from '@state/index.ts';
import logger from '@utils/logger.ts';
import type { StampPlacement } from '../../types/state.js';

logger.moduleLoaded('StampPlacements', 'stamps');

// Note: Stamp placements are now stored in the main state store instead of a local Map
// This provides persistence, undo/redo support, and proper state management

/**
 * Places a stamp at the specified grid position
 */
export function placeStamp(stampId: number, startColumn: number, row: number, color = '#4a90e2'): StampPlacement | null {
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
 */
export function removeStampsInEraserArea(eraseStartCol: number, eraseEndCol: number, eraseStartRow: number, eraseEndRow: number): boolean {
  // Use store method for erasing stamps
  return store.eraseStampsInArea(eraseStartCol, eraseEndCol, eraseStartRow, eraseEndRow);
}

/**
 * Legacy function for backward compatibility - removes stamps at a specific position
 */
export function removeStampAt(column: number, row: number): boolean {
  return removeStampsInEraserArea(column, column + 1, row, row);
}

/**
 * Gets all stamp placements
 */
export function getAllStampPlacements(): StampPlacement[] {
  return store.getAllStampPlacements();
}

/**
 * Gets stamp placement at specific position
 */
export function getStampAt(column: number, row: number): StampPlacement | null {
  return store.getStampAt(column, row);
}

/**
 * Clears all stamp placements
 */
export function clearAllStamps(): void {
  store.clearAllStamps();
}

/**
 * Gets stamp placements for playback scheduling
 */
export function getStampPlaybackData(): unknown[] {
  return store.getStampPlaybackData();
}
