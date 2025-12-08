// js/rhythm/scheduleTriplets.ts
import * as Tone from 'tone';
import { getTripletStampById, GROUP_WIDTH_CELLS } from './triplets.js';
import logger from '@utils/logger.ts';
import type { TripletPlacement } from '../../types/state.js';

logger.moduleLoaded('TripletScheduler', 'triplets');

export interface TripletScheduleEvent {
  offset: string;
  duration: string;
  type: 'triplet-eighth' | 'triplet-quarter';
  slot: number;
  shapeKey: string;
  rowOffset: number;
}

interface RhythmPlacement {
  cellIndex?: number;
  tripletGroup?: {
    startCellIndex: number;
    stampId: number;
  };
}

interface TriggerableSynth {
  triggerAttackRelease: (pitch: string, duration: number, time?: number) => void;
}

/**
 * Convert a cell index to absolute seconds.
 * Each cell = 2 microbeats = one quarter note ("4n")
 */
function getCellStartSeconds(cellIndex: number): number {
  // Using Tone.js time notation where 1 cell = "4n" (quarter note)
  return Tone.Time(`${cellIndex} * 4n`).toSeconds();
}

/**
 * Gets the triplet scheduling data for a triplet group
 * @param tripletStampId - The ID of the triplet stamp to schedule
 * @param placement - Optional placement object with shapeOffsets for per-shape pitches
 * @returns Array of scheduling events {offset, duration, slot, shapeKey, rowOffset}
 */
export function getTripletScheduleEvents(tripletStampId: number, placement: TripletPlacement | null = null): TripletScheduleEvent[] {
  const stamp = getTripletStampById(tripletStampId);
  if (!stamp) {
    logger.warn('TripletScheduler', `Unknown triplet stamp ID: ${tripletStampId}`, { tripletStampId }, 'triplets');
    return [];
  }

  const events: TripletScheduleEvent[] = [];
  const stepStr = stamp.span === 'eighth' ? '8t' : '4t'; // triplet eighth or triplet quarter
  const stepDuration = stepStr; // duration equals the step for clean reads

  // Create events for each active slot in the triplet
  stamp.hits.forEach(slot => {
    const shapeKey = `triplet_${slot}`;
    const rowOffset = placement?.shapeOffsets?.[shapeKey] || 0;

    // Calculate proper offset for each slot using simple multiplication
    let offset: string;
    if (slot === 0) {
      offset = '0';
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
      type: stamp.span === 'eighth' ? 'triplet-eighth' : 'triplet-quarter',
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
 * @param tripletGroup - {startCellIndex, stampId, pitch}
 * @param synth - The synth to trigger
 */
export function scheduleTripletGroup(
  tripletGroup: { startCellIndex: number; stampId: number; pitch: string },
  synth: TriggerableSynth
): void {
  const { startCellIndex, stampId, pitch } = tripletGroup;
  const stamp = getTripletStampById(stampId);

  if (!stamp) {
    logger.warn('TripletScheduler', `Cannot schedule unknown triplet stamp ID: ${stampId}`, { stampId }, 'triplets');
    return;
  }

  const groupStart = getCellStartSeconds(startCellIndex);
  const stepStr = stamp.span === 'eighth' ? '8t' : '4t';
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
 * @param tripletGroupsData - Array of {startCellIndex, stampId, pitch, synth} objects
 */
export function scheduleTripletGroups(
  tripletGroupsData: { startCellIndex: number; stampId: number; pitch: string; synth: TriggerableSynth }[]
): void {
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
 * @param tripletStampId - The triplet stamp ID
 * @returns Number of cells the triplet group spans
 */
export function getTripletGroupSpan(tripletStampId: number): number {
  const stamp = getTripletStampById(tripletStampId);
  return stamp ? (GROUP_WIDTH_CELLS[stamp.span] ?? 1) : 1;
}

/**
 * Validates if a triplet group can be placed at the given cell index
 * @param startCellIndex - Starting cell index
 * @param tripletStampId - The triplet stamp ID
 * @param existingPlacements - Array of existing rhythm placements to check for conflicts
 * @returns True if placement is valid
 */
export function canPlaceTripletGroup(startCellIndex: number, tripletStampId: number, existingPlacements: RhythmPlacement[] = []): boolean {
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
