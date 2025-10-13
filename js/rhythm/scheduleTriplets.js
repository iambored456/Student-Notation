// js/rhythm/scheduleTriplets.js
import * as Tone from 'tone';
import { TRIPLET_STAMPS, getTripletStampById, GROUP_WIDTH_CELLS } from './triplets.js';
import logger from '../utils/logger.js';

logger.moduleLoaded('TripletScheduler', 'triplets');

/**
 * Convert a cell index to absolute seconds.
 * Each cell = 2 microbeats = one quarter note ("4n")
 */
function getCellStartSeconds(cellIndex) {
  // Using Tone.js time notation where 1 cell = "4n" (quarter note)
  return Tone.Time(`${cellIndex} * 4n`).toSeconds();
}

/**
 * Gets the triplet scheduling data for a triplet group
 * @param {number} tripletStampId - The ID of the triplet stamp to schedule
 * @param {Object} placement - Optional placement object with shapeOffsets for per-shape pitches
 * @returns {Array} Array of scheduling events {offset, duration, slot, shapeKey, rowOffset}
 */
export function getTripletScheduleEvents(tripletStampId, placement = null) {
  const stamp = getTripletStampById(tripletStampId);
  if (!stamp) {
    logger.warn('TripletScheduler', `Unknown triplet stamp ID: ${tripletStampId}`, { tripletStampId }, 'triplets');
    return [];
  }

  const events = [];
  const stepStr = stamp.span === "eighth" ? "8t" : "4t"; // triplet eighth or triplet quarter
  const stepDuration = stepStr; // duration equals the step for clean reads

  // Create events for each active slot in the triplet
  stamp.hits.forEach(slot => {
    const shapeKey = `triplet_${slot}`;
    const rowOffset = placement?.shapeOffsets?.[shapeKey] || 0;

    // Calculate proper offset for each slot using simple multiplication
    let offset;
    if (slot === 0) {
      offset = "0";
    } else if (slot === 1) {
      offset = stepStr; // First triplet step (8t or 4t)
    } else if (slot === 2) {
      // Calculate two triplet steps
      const stepSeconds = Tone.Time(stepStr).toSeconds();
      offset = Tone.Time(stepSeconds * 2).toNotation();
    } else {
      // Fallback for other slots
      const stepSeconds = Tone.Time(stepStr).toSeconds();
      offset = Tone.Time(stepSeconds * slot).toNotation();
    }

    events.push({
      offset: offset,
      duration: stepDuration,
      type: stamp.span === "eighth" ? 'triplet-eighth' : 'triplet-quarter',
      slot: slot,
      shapeKey,
      rowOffset  // Pitch offset from base row
    });
    logger.debug('TripletScheduler', `Triplet stamp ${tripletStampId} ${stamp.span} at slot ${slot} with offset "${offset}", rowOffset: ${rowOffset}`, 'triplets');
  });

  logger.debug('TripletScheduler', `Total events for triplet stamp ${tripletStampId}:`, events.length, 'triplets');
  return events;
}

/**
 * Schedules a single triplet group
 * @param {Object} tripletGroup - {startCellIndex, stampId, pitch}
 * @param {Tone.Instrument} synth - The synth to trigger
 */
export function scheduleTripletGroup(tripletGroup, synth) {
  const { startCellIndex, stampId, pitch } = tripletGroup;
  const stamp = getTripletStampById(stampId);
  
  if (!stamp) {
    logger.warn('TripletScheduler', `Cannot schedule unknown triplet stamp ID: ${stampId}`, { stampId }, 'triplets');
    return;
  }

  const groupStart = getCellStartSeconds(startCellIndex);
  const stepStr = stamp.span === "eighth" ? "8t" : "4t";
  const stepSec = Tone.Time(stepStr).toSeconds();

  logger.debug('TripletScheduler', `Scheduling triplet group`, { 
    startCellIndex, 
    stampId, 
    pitch, 
    groupStart, 
    stepStr,
    stepSec,
    hits: stamp.hits 
  }, 'triplets');

  // Trigger each active slot
  stamp.hits.forEach(slot => {
    const triggerTime = groupStart + slot * stepSec;
    // Duration: one triplet step reads cleanly; adjust if you want legato/overlap
    synth.triggerAttackRelease(pitch, stepSec, triggerTime);
    
    logger.debug('TripletScheduler', `Scheduled triplet note`, { 
      slot, 
      triggerTime, 
      duration: stepSec,
      pitch 
    }, 'triplets');
  });
}

/**
 * Schedules multiple triplet groups in sequence
 * @param {Array} tripletGroupsData - Array of {startCellIndex, stampId, pitch, synth} objects
 */
export function scheduleTripletGroups(tripletGroupsData) {
  tripletGroupsData.forEach(groupData => {
    scheduleTripletGroup({
      startCellIndex: groupData.startCellIndex,
      stampId: groupData.stampId,
      pitch: groupData.pitch
    }, groupData.synth);
  });
}

/**
 * Helper function to get the cell span for a triplet stamp
 * @param {number} tripletStampId - The triplet stamp ID
 * @returns {number} Number of cells the triplet group spans
 */
export function getTripletGroupSpan(tripletStampId) {
  const stamp = getTripletStampById(tripletStampId);
  return stamp ? GROUP_WIDTH_CELLS[stamp.span] : 1;
}

/**
 * Validates if a triplet group can be placed at the given cell index
 * @param {number} startCellIndex - Starting cell index
 * @param {number} tripletStampId - The triplet stamp ID
 * @param {Array} existingPlacements - Array of existing rhythm placements to check for conflicts
 * @returns {boolean} True if placement is valid
 */
export function canPlaceTripletGroup(startCellIndex, tripletStampId, existingPlacements = []) {
  const span = getTripletGroupSpan(tripletStampId);
  
  // Check if the required cells are available
  for (let i = 0; i < span; i++) {
    const cellIndex = startCellIndex + i;
    const hasConflict = existingPlacements.some(placement => 
      placement.cellIndex === cellIndex || 
      (placement.tripletGroup && 
       placement.tripletGroup.startCellIndex <= cellIndex && 
       cellIndex < placement.tripletGroup.startCellIndex + getTripletGroupSpan(placement.tripletGroup.stampId))
    );
    
    if (hasConflict) {
      logger.debug('TripletScheduler', `Triplet placement conflict at cell ${cellIndex}`, { 
        startCellIndex, 
        tripletStampId, 
        span 
      }, 'triplets');
      return false;
    }
  }
  
  return true;
}