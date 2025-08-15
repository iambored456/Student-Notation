// js/rhythm/scheduleStamps.js
import * as Tone from 'tone';
import { SIXTEENTH_STAMPS, getStampById } from './stamps.js';
import logger from '../utils/logger.js';

logger.moduleLoaded('StampScheduler', 'stamps');

// Time offsets for each slot within a 2-microbeat cell
// slot 0 = start, slot 1 = 1st 16th, slot 2 = 8th beat, slot 3 = 3rd 16th (8n + 16n)
const SLOT_OFFSETS = ["0", "16n", "8n", {"8n": 1, "16n": 1}];

/**
 * Gets the stamp scheduling data for a cell
 * @param {number} stampId - The ID of the stamp to schedule
 * @returns {Array} Array of scheduling events {offset, duration}
 */
export function getStampScheduleEvents(stampId) {
  const stamp = getStampById(stampId);
  if (!stamp) {
    logger.warn('StampScheduler', `Unknown stamp ID: ${stampId}`, { stampId }, 'stamps');
    return [];
  }

  const events = [];

  // Add ovals (8th notes)
  stamp.ovals.forEach(start => {
    events.push({
      offset: SLOT_OFFSETS[start],
      duration: "8n",
      type: 'oval',
      slot: start
    });
    console.log(`[STAMP DEBUG] Stamp ${stampId} oval at slot ${start} with offset "${SLOT_OFFSETS[start]}"`);
  });

  // Add diamonds (16th notes)
  stamp.diamonds.forEach(slot => {
    events.push({
      offset: SLOT_OFFSETS[slot], 
      duration: "16n",
      type: 'diamond',
      slot: slot
    });
    console.log(`[STAMP DEBUG] Stamp ${stampId} diamond at slot ${slot} with offset "${SLOT_OFFSETS[slot]}"`);
  });

  console.log(`[STAMP DEBUG] Total events for stamp ${stampId}:`, events.length, events);
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