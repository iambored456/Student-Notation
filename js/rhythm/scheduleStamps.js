// js/rhythm/scheduleStamps.js
import * as Tone from 'tone';
import { SIXTEENTH_STAMPS, getStampById } from './stamps.js';
import logger from '@utils/logger.js';

logger.moduleLoaded('StampScheduler', 'stamps');

// Time offsets for each slot within a 2-microbeat cell
// slot 0 = start, slot 1 = 1st 16th, slot 2 = 8th beat, slot 3 = 3rd 16th (8n + 16n)
const SLOT_OFFSETS = ['0', '16n', '8n', {'8n': 1, '16n': 1}];

/**
 * Gets the stamp scheduling data for a cell
 * @param {number} stampId - The ID of the stamp to schedule
 * @param {Object} placement - Optional placement object with shapeOffsets for per-shape pitches
 * @returns {Array} Array of scheduling events {offset, duration, type, slot, shapeKey, rowOffset}
 */
export function getStampScheduleEvents(stampId, placement = null) {
  const stamp = getStampById(stampId);
  if (!stamp) {
    logger.warn('StampScheduler', `Unknown stamp ID: ${stampId}`, { stampId }, 'stamps');
    return [];
  }

  const events = [];

  // Add ovals (8th notes) with per-shape pitch offsets
  stamp.ovals.forEach(start => {
    const shapeKey = `oval_${start}`;
    const rowOffset = placement?.shapeOffsets?.[shapeKey] || 0;

    events.push({
      offset: SLOT_OFFSETS[start],
      duration: '8n',
      type: 'oval',
      slot: start,
      shapeKey,
      rowOffset  // Pitch offset from base row
    });
  });

  // Add diamonds (16th notes) with per-shape pitch offsets
  stamp.diamonds.forEach(slot => {
    const shapeKey = `diamond_${slot}`;
    const rowOffset = placement?.shapeOffsets?.[shapeKey] || 0;

    events.push({
      offset: SLOT_OFFSETS[slot],
      duration: '16n',
      type: 'diamond',
      slot: slot,
      shapeKey,
      rowOffset  // Pitch offset from base row
    });
  });

  return events;
}

/**
 * Schedules multiple stamped cells in sequence
 * @param {Array} cellsData - Array of {cellStartSec, stampId, pitch, synth} objects
 */
export function scheduleCells(cellsData) {
  cellsData.forEach(cellData => {
    scheduleCell(cellData.cellStartSec, cellData.stampId, cellData.pitch, cellData.synth);
  });
}

/**
 * Helper function to convert cell index to time based on tempo
 * @param {number} cellIndex - The cell index in the sequence
 * @param {number} cellDuration - Duration of each cell in seconds (2 microbeats)
 * @returns {number} Time in seconds
 */
export function cellIndexToTime(cellIndex, cellDuration) {
  return cellIndex * cellDuration;
}

/**
 * Helper function to get cell duration based on current tempo
 * Each cell represents 2 microbeats = 1 quarter note = 4 sixteenth notes
 * @param {number} bpm - Beats per minute (quarter note tempo)
 * @returns {number} Cell duration in seconds
 */
export function getCellDuration(bpm) {
  return 60 / bpm; // 1 quarter note duration
}

export { SLOT_OFFSETS };
