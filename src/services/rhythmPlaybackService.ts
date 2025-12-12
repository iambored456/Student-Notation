// js/services/rhythmPlaybackService.ts
import * as Tone from 'tone';
import { getStampScheduleEvents } from '@/rhythm/scheduleStamps.js';
import { getTripletScheduleEvents } from '@/rhythm/scheduleTriplets.js';
import store from '@state/index.ts';
import SynthEngine from './synthEngine.js';
import logger from '@utils/logger.ts';
import type { StampPlacement, TripletPlacement } from '../../types/state.js';

logger.moduleLoaded('RhythmPlaybackService');

interface ScheduledEvent {
  pitch: string;
  color: string;
  attackTime: number;
  releaseTime: number;
}

/**
 * Service for playing rhythm patterns when clicking on stamped grid cells
 * Converts rhythm stamps into timed note events at the current project tempo
 */
class RhythmPlaybackService {
  private scheduledEvents: ScheduledEvent[] = [];
  private isInitialized = false;

  constructor() {
    this.scheduledEvents = [];
    this.isInitialized = false;
  }

  // Convenience aliases used elsewhere
  init(): Promise<void> {
    return this.initialize();
  }

  refresh(): void {
    this.stopCurrentPattern();
  }

  /**
     * Initialize the service
     */
  async initialize(): Promise<void> {
    if (this.isInitialized) {return;}

    // Ensure Tone.js audio context is started
    await Tone.start();
    this.isInitialized = true;

    logger.info('RhythmPlaybackService', 'Initialized');

    // Make service globally accessible for debugging
    (window as { rhythmPlaybackService?: RhythmPlaybackService }).rhythmPlaybackService = this;
  }

  /**
     * Play a rhythm pattern for a clicked cell
     */
  playRhythmPattern(stampId: number, pitch: string, color: string, noteShape: 'circle' | 'oval' = 'oval', placement: StampPlacement | null = null): void {
    if (!this.isInitialized) {
      logger.warn('RhythmPlaybackService', 'Not initialized, call initialize() first');
      return;
    }

    // Clear any previously scheduled preview events
    this.stopCurrentPattern();

    // Get the rhythm stamp's event structure with per-shape offsets
    const events = getStampScheduleEvents(stampId, placement);

    if (!events || events.length === 0) {
      logger.warn('RhythmPlaybackService', `No events found for stamp ${stampId}`);
      return;
    }

    logger.debug('RhythmPlaybackService', `Playing pattern for stamp ${stampId}: ${events.length} notes`, {
      stampId,
      basePitch: pitch,
      color,
      events,
      hasShapeOffsets: !!placement?.shapeOffsets
    });

    // Use direct SynthEngine calls with absolute timing
    const now = Tone.now();

    // Get the base row for calculating per-shape pitches
    // Use globalRow for pitch lookups (fullRowData is never sliced)
    const baseRow = placement?.globalRow ?? placement?.row;

    events.forEach((event, index) => {
      try {
        // Convert Tone.js time notation to absolute time
        const offsetSeconds = Tone.Time(String(event.offset)).toSeconds();
        const attackTime = now + offsetSeconds;

        // Adjust duration based on note shape
        // Circle notes (quarter notes) are twice as long as oval notes (eighth notes)
        const baseDuration = Tone.Time(String(event.duration)).toSeconds();
        const duration = noteShape === 'circle' ? baseDuration * 2 : baseDuration;

        const releaseTime = attackTime + duration;

        // Calculate pitch for this individual shape
        // If we have placement data with offsets, calculate the specific shape pitch
        let shapePitch = pitch;
        if (baseRow !== undefined && event.rowOffset !== 0) {
          const shapeRow = baseRow + event.rowOffset;
          const rowData = store.state.fullRowData[shapeRow];
          if (rowData) {
            shapePitch = rowData.toneNote.replace('♭', 'b').replace('♯', '#');
          }
        }

        // SynthEngine.triggerAttack accepts a time parameter
        // This schedules the note in Web Audio's future
        SynthEngine.triggerAttack(shapePitch, color, attackTime);

        // Schedule the release
        SynthEngine.triggerRelease(shapePitch, color, releaseTime);

        // Store the timing info for potential cancellation
        this.scheduledEvents.push({
          pitch: shapePitch,
          color,
          attackTime,
          releaseTime
        });

      } catch (error) {
        logger.warn('RhythmPlaybackService', `Error scheduling note ${index + 1}`, error);
      }
    });

    logger.info('RhythmPlaybackService', `Scheduled ${events.length} notes for rhythm pattern ${stampId}`);
  }

  /**
     * Stop the current pattern (release all notes immediately)
     */
  stopCurrentPattern(): void {
    if (this.scheduledEvents.length === 0) {return;}

    logger.debug('RhythmPlaybackService', `Clearing ${this.scheduledEvents.length} scheduled events`);

    // Release all notes immediately
    // Note: We can't cancel future-scheduled Web Audio events,
    // but we can release all currently playing notes
    SynthEngine.releaseAll();

    this.scheduledEvents = [];
  }

  /**
     * Check if a stamp exists at a given grid position
     */
  getStampAtPosition(columnIndex: number, rowIndex: number): StampPlacement | null {
    if (!store.state.stampPlacements) {return null;}

    // Find a stamp that overlaps this position
    // Stamps span 2 columns (startColumn and endColumn)
    const stamp = store.state.stampPlacements.find(placement => {
      const rowMatches = placement.row === rowIndex;
      const columnMatches = columnIndex >= placement.startColumn &&
                                  columnIndex <= placement.endColumn;
      return rowMatches && columnMatches;
    });

    return stamp || null;
  }

  /**
     * Play a triplet rhythm pattern for a clicked cell
     */
  playTripletPattern(tripletStampId: number, pitch: string, color: string, placement: TripletPlacement | null = null): void {
    if (!this.isInitialized) {
      logger.warn('RhythmPlaybackService', 'Not initialized, call initialize() first');
      return;
    }

    // Clear any previously scheduled preview events
    this.stopCurrentPattern();

    // Get the triplet's event structure with per-shape offsets
    const events = getTripletScheduleEvents(tripletStampId, placement);

    if (!events || events.length === 0) {
      logger.warn('RhythmPlaybackService', `No events found for triplet ${tripletStampId}`);
      return;
    }

    logger.debug('RhythmPlaybackService', `Playing triplet pattern ${tripletStampId}: ${events.length} notes`, {
      tripletStampId,
      basePitch: pitch,
      color,
      events,
      hasShapeOffsets: !!placement?.shapeOffsets
    });

    // Use direct SynthEngine calls with absolute timing
    const now = Tone.now();
    // Get the base row for calculating per-shape pitches
    // Use globalRow for pitch lookups (fullRowData is never sliced)
    const baseRow = placement?.globalRow ?? placement?.row;

    events.forEach((event, index) => {
      try {
        // Convert Tone.js time notation to absolute time
        const offsetSeconds = Tone.Time(event.offset).toSeconds();
        const attackTime = now + offsetSeconds;
        const duration = Tone.Time(event.duration).toSeconds();
        const releaseTime = attackTime + duration;

        // Calculate pitch for this individual shape
        let shapePitch = pitch;
        if (baseRow !== undefined && event.rowOffset !== 0) {
          const shapeRow = baseRow + event.rowOffset;
          const rowData = store.state.fullRowData[shapeRow];
          if (rowData) {
            shapePitch = rowData.toneNote.replace('?T-', 'b').replace('?T_', '#');
          }
        }

        // Schedule the note
        SynthEngine.triggerAttack(shapePitch, color, attackTime);
        SynthEngine.triggerRelease(shapePitch, color, releaseTime);

        // Store the timing info for potential cancellation
        this.scheduledEvents.push({
          pitch: shapePitch,
          color,
          attackTime,
          releaseTime
        });

      } catch (error) {
        logger.warn('RhythmPlaybackService', `Error scheduling triplet note ${index + 1}`, error);
      }
    });

    logger.info('RhythmPlaybackService', `Scheduled ${events.length} notes for triplet pattern ${tripletStampId}`);
  }

  /**
     * Check if a triplet exists at a given grid position
     */
  getTripletAtPosition(cellIndex: number, rowIndex: number): TripletPlacement | null {
    if (!store.state.tripletPlacements) {return null;}

    return store.state.tripletPlacements.find(placement =>
      placement.row === rowIndex &&
            cellIndex >= placement.startCellIndex &&
            cellIndex < placement.startCellIndex + placement.span
    ) || null;
  }

  /**
     * Dispose of the service and clean up resources
     */
  dispose(): void {
    this.stopCurrentPattern();
    this.isInitialized = false;
    logger.info('RhythmPlaybackService', 'Disposed');
  }
}

// Create singleton instance
const rhythmPlaybackService = new RhythmPlaybackService();

export default rhythmPlaybackService;
