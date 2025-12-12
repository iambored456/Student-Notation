// js/services/transportService.ts
import * as Tone from 'tone';
import store from '@state/index.ts';
import { getPlacedTonicSigns, getMacrobeatInfo } from '@state/selectors.ts';
import SynthEngine from './synthEngine.js';
import GlobalService from './globalService.ts';
import domCache from './domCache.ts';
import logger from '@utils/logger.ts';
import DrumPlayheadRenderer from '@components/canvas/drumGrid/drumPlayheadRenderer.js';
import { getLogicalCanvasWidth, getLogicalCanvasHeight } from '@utils/canvasDimensions.ts';
import { getTonicSpanColumnIndices } from '@utils/tonicColumnUtils.ts';

import { getStampPlaybackData } from '@/rhythm/stampPlacements.js';
import { getStampScheduleEvents } from '@/rhythm/scheduleStamps.js';
import { getTripletPlaybackData } from '@/rhythm/tripletPlacements.js';
import { getTripletScheduleEvents } from '@/rhythm/scheduleTriplets.js';
import { updatePlayheadModel, getColumnStartX, getColumnWidth, getRightLegendStartIndex } from '@services/playheadModel.ts';

const FLAT_SYMBOL = '\u266d';
const SHARP_SYMBOL = '\u266f';
const LOOP_EPSILON = 1e-4;

/**
 * Gets pitch from a global row index.
 * fullRowData contains the complete pitch gamut (never sliced).
 *
 * @param rowIndex - Global row index (0-104, index into fullRowData)
 * @returns Pitch in Tone.js notation (e.g., "C4", "Bb5")
 *
 * See src/utils/rowCoordinates.ts for coordinate system documentation.
 */
function getPitchFromRow(rowIndex: number) {
  const rowData = store.state.fullRowData[rowIndex];
  if (!rowData) {
    return 'C4';
  }
  return rowData.toneNote
    .replace(FLAT_SYMBOL, 'b')
    .replace(SHARP_SYMBOL, '#');
}

logger.moduleLoaded('TransportService');

let playheadAnimationFrame: number | null = null;
let drumPlayers: Tone.Players | null = null;
let timeMap: number[] = [];
let cachedMusicalEndTime = 0; // Cached modulation-adjusted end time
let configuredLoopStart = 0;
let configuredLoopEnd = 0;
const DRUM_START_EPSILON = 1e-4; // seconds; keeps Tone.Player start times strictly increasing
const lastDrumStartTimes = new Map<number, number>();
let shouldAnimatePlayhead = false; // Controls whether playhead animation should continue

function logTransportDebug(..._args: any[]) {
  // Logging disabled
}

function resetDrumStartTimes() {
  lastDrumStartTimes.clear();
}

function getSafeDrumStartTime(trackId: number, requestedTime: number) {
  let safeTime = Number.isFinite(requestedTime) ? requestedTime : Tone.now();
  const lastTime = lastDrumStartTimes.get(trackId) ?? -Infinity;

  if (!(safeTime > lastTime)) {
    safeTime = lastTime + DRUM_START_EPSILON;
  }

  lastDrumStartTimes.set(trackId, safeTime);
  return safeTime;
}

function reapplyConfiguredLoopBounds() {
  if (configuredLoopEnd > configuredLoopStart) {
    const loopStartDiff = Math.abs((Tone.Transport.loopStart as number) - configuredLoopStart);
    const loopEndDiff = Math.abs((Tone.Transport.loopEnd as number) - configuredLoopEnd);
    if (loopStartDiff > LOOP_EPSILON || loopEndDiff > LOOP_EPSILON) {
      Tone.Transport.loopStart = configuredLoopStart;
      Tone.Transport.loopEnd = configuredLoopEnd;
    }
    if (Tone.Transport.loop !== store.state.isLooping) {
      Tone.Transport.loop = store.state.isLooping;
    }
  }
}

function setLoopBounds(loopStart: number, loopEnd: number) {
  const minDuration = Math.max(getMicrobeatDuration(), 0.001);
  const safeStart = Number.isFinite(loopStart) ? loopStart : 0;
  let safeEnd = Number.isFinite(loopEnd) ? loopEnd : safeStart + minDuration;
  if (safeEnd <= safeStart) {
    safeEnd = safeStart + minDuration;
  }
  configuredLoopStart = safeStart;
  configuredLoopEnd = safeEnd;

  if (Tone?.Transport) {
    Tone.Transport.loopStart = safeStart;
    Tone.Transport.loopEnd = safeEnd;
  }
  reapplyConfiguredLoopBounds();
}

function updateLoopBoundsFromTimeline() {
  const loopStart = findNonAnacrusisStart();
  const loopEnd = getMusicalEndTime();
  setLoopBounds(loopStart, loopEnd);
}

function getMicrobeatDuration() {
  const tempo = store.state.tempo;
  const microbeatBPM = tempo * 2;
  return 60 / microbeatBPM;
}

function findNonAnacrusisStart() {
  if (!store.state.hasAnacrusis) {
    // No anacrusis, playback starts from time 0 (first beat)
    logger.debug('TransportService', '[ANACRUSIS] No anacrusis, starting from time 0');
    return 0;
  }

  // Find the first solid boundary which marks the end of anacrusis
  for (let i = 0; i < store.state.macrobeatBoundaryStyles.length; i++) {
    if (store.state.macrobeatBoundaryStyles[i] === 'solid') {
      // Found the first solid boundary - the non-anacrusis starts after this macrobeat
      const macrobeatInfo = getMacrobeatInfo(store.state, i + 1);
      if (macrobeatInfo) {
        const startTime = timeMap[macrobeatInfo.startColumn] || 0;
        logger.debug('TransportService', `[ANACRUSIS] Found solid boundary at macrobeat ${i}, non-anacrusis starts at column ${macrobeatInfo.startColumn}, time ${startTime.toFixed(3)}s`);
        return startTime;
      }
    }
  }

  // If no solid boundary found, anacrusis continues throughout, so start from beginning
  logger.debug('TransportService', '[ANACRUSIS] No solid boundary found, starting from time 0');
  return 0;
}

function calculateTimeMap() {
  logger.debug('transportService', 'calculateTimeMap', { tempo: `${store.state.tempo} BPM` });
  timeMap = [];

  const microbeatDuration = getMicrobeatDuration();
  const { columnWidths } = store.state;
  const placedTonicSigns = getPlacedTonicSigns(store.state);

  // COORDINATE SYSTEM NOTE:
  // state.columnWidths is now CANVAS-SPACE (musical columns only, no legends)
  const musicalColumnWidths = columnWidths;

  // PLAYHEAD FIX: Always use regular timing for consistent playhead speed
  // Note triggers will be calculated separately using modulation mapping
  // Modulation markers are handled in calculateNoteTriggerTime, not here
  calculateRegularTimeMap(microbeatDuration, musicalColumnWidths, placedTonicSigns);

  logger.timing('transportService', 'calculateTimeMap', { totalDuration: `${timeMap[timeMap.length - 1]?.toFixed(2)}s` });

  calculateMusicalEndTime(); // Calculate and cache the modulation-adjusted end time
  const musicalEnd = getMusicalEndTime();

  updatePlayheadModel({
    timeMap,
    musicalEndTime: musicalEnd,
    columnWidths: store.state.columnWidths,
    cellWidth: store.state.cellWidth
  });

  updateLoopBoundsFromTimeline();

  if (typeof window !== 'undefined') {
    window.__transportTimeMap = [...timeMap];
    window.__transportMusicalEnd = musicalEnd.toString();
  }
}

/**
 * Calculates and caches the time (in seconds) where the musical grid ends.
 * This should be called whenever the time map or modulation markers change.
 * Since timeMap now only contains musical columns (no legends), the end is simply the last entry.
 */
function calculateMusicalEndTime() {
  const baseEndTime = timeMap.length > 0 ? timeMap[timeMap.length - 1] : 0;

  if (!Number.isFinite(baseEndTime) || baseEndTime === 0) {
    cachedMusicalEndTime = 0;
    return;
  }

  // Check if there are any active modulation markers
  const modulationMarkers = store.state.modulationMarkers?.filter(m => m.active) || [];

  if (modulationMarkers.length === 0) {
    // No modulation - use base time
    cachedMusicalEndTime = baseEndTime;
    return;
  }

  // Calculate adjusted end time based on modulation
  // Modulation stretches the visual grid, so we need to calculate how much longer
  // it takes to traverse the stretched portion at constant playhead speed

  // Sort markers by measure index
  const sortedMarkers = [...modulationMarkers].sort((a, b) => a.measureIndex - b.measureIndex);

  // Find where each marker starts in the time map
  let adjustedEndTime = baseEndTime;

  for (const marker of sortedMarkers) {
    // Find the time position where this modulation starts
    // This is approximate - we use measure info to find the column
    const macrobeatInfo = getMacrobeatInfo(store.state, marker.measureIndex);

    if (macrobeatInfo) {
      // Calculate time at start of modulation
      const modulationStartColumn = macrobeatInfo.endColumn - 1; // Adjust for timeMap indexing
      const modulationStartTime = timeMap[modulationStartColumn] !== undefined ? timeMap[modulationStartColumn] : baseEndTime;

      // Remaining time after this marker (at base speed)
      const remainingBaseTime = baseEndTime - modulationStartTime;

      // Adjust the end time: remove base remaining time, add stretched/compressed time
      const stretchedTime = remainingBaseTime * marker.ratio;

      adjustedEndTime = adjustedEndTime - remainingBaseTime + stretchedTime;

    }
  }

  cachedMusicalEndTime = adjustedEndTime;
}

/**
 * Returns the cached musical end time.
 * This is updated whenever calculateTimeMap() is called.
 */
function getMusicalEndTime() {
  return cachedMusicalEndTime;
}

function calculateRegularTimeMap(microbeatDuration: number, columnWidths: number[], placedTonicSigns: any[]) {
  // COORDINATE SYSTEM NOTE:
  // columnWidths is now CANVAS-SPACE (0 = first musical beat)
  // timeMap indices map 1:1 with canvas-space column indices
  // placedTonicSigns also use canvas-space column indices

  let currentTime = 0;

  logger.debug('TransportService', '[TIMEMAP] Building timeMap', {
    columnCount: columnWidths.length,
    tonicSignCount: placedTonicSigns.length,
    microbeatDuration
  });

  for (let i = 0; i < columnWidths.length; i++) {
    // timeMap index matches canvas-space column index
    timeMap[i] = currentTime;

    // Only advance time for non-tonic columns
    const isTonicColumn = placedTonicSigns.some(ts => ts.columnIndex === i);
    if (!isTonicColumn) {
      currentTime += (columnWidths[i] || 0) * microbeatDuration;
    } else {
      logger.debug('TransportService', `[TIMEMAP] Column ${i} is tonic, not advancing time`);
    }

    if (i < 5) {
      logger.debug('TransportService', `[TIMEMAP] timeMap[${i}] = ${timeMap[i].toFixed(3)}s (isTonic: ${isTonicColumn})`);
    }
  }

  logger.debug('TransportService', `[TIMEMAP] Complete. Total columns: ${timeMap.length}, Final time: ${currentTime.toFixed(3)}s`);
}

/**
 * Gets the pitch (toneNote) for a placed note.
 * Uses globalRow for pitch lookup since fullRowData contains the complete gamut.
 * Falls back to note.row for legacy notes that don't have globalRow set.
 *
 * See src/utils/rowCoordinates.ts for coordinate system documentation.
 */
function getPitchForNote(note: any) {
  const rowData = store.state.fullRowData;
  // Use globalRow for pitch lookup (fullRowData is never sliced)
  const rowIndex = note.globalRow ?? note.row;
  if (rowData?.[rowIndex]) {
    const pitch = rowData[rowIndex].toneNote;
    return pitch
      .replace(FLAT_SYMBOL, 'b')
      .replace(SHARP_SYMBOL, '#');
  }
  return 'C4';
}

/**
 * Applies modulation to a time value based on active modulation markers
 * @param baseTime - The unmodulated time from timeMap
 * @param columnIndex - The musical column index (0-based, excluding legends)
 * @returns The modulated time accounting for compression/expansion
 */
function applyModulationToTime(baseTime: number, columnIndex: number): number {
  const modulationMarkers = store.state.modulationMarkers?.filter(m => m.active) || [];

  if (modulationMarkers.length === 0) {
    return baseTime;
  }

  // Sort markers by measure index
  const sortedMarkers = [...modulationMarkers].sort((a, b) => a.measureIndex - b.measureIndex);

  let adjustedTime = baseTime;

  // Debug logging for first few columns
  if (columnIndex < 5) {
    logger.debug('TransportService', `[MODULATION] Column ${columnIndex}: baseTime ${baseTime.toFixed(3)}s, ${sortedMarkers.length} active markers`);
  }

  for (const marker of sortedMarkers) {
    const macrobeatInfo = getMacrobeatInfo(store.state, marker.measureIndex);

    if (macrobeatInfo) {
      // macrobeatInfo.endColumn is already in canvas-space
      const modulationStartColumn = macrobeatInfo.endColumn;

      // Check if this note is after the modulation marker
      if (columnIndex > modulationStartColumn) {
        const modulationStartTime = timeMap[modulationStartColumn] !== undefined ? timeMap[modulationStartColumn] : 0;

        // Time from modulation start to this note (unmodulated)
        const deltaTime = baseTime - modulationStartTime;

        // Apply modulation ratio to the delta
        const modulatedDelta = deltaTime * marker.ratio;

        // Adjust the time: replace unmodulated delta with modulated delta
        adjustedTime = adjustedTime - deltaTime + modulatedDelta;

        if (columnIndex < 5) {
          logger.debug('TransportService', `[MODULATION] Column ${columnIndex}: Applied marker at measure ${marker.measureIndex} (col ${modulationStartColumn}), ratio ${marker.ratio}, adjustedTime ${adjustedTime.toFixed(3)}s`);
        }
      }
    }
  }

  return adjustedTime;
}

function scheduleNotes() {
  logger.debug('transportService', 'scheduleNotes', 'Clearing previous transport events and rescheduling all notes');
  Tone.Transport.cancel();
  resetDrumStartTimes();
  calculateTimeMap();
  GlobalService.adsrComponent?.playheadManager.clearAll();

  // Find where the non-anacrusis section starts (where the "real" music begins)
  const anacrusisOffset = findNonAnacrusisStart();

  const hasModulation = store.state.modulationMarkers && store.state.modulationMarkers.length > 0;

  logger.debug('TransportService', `[ANACRUSIS] hasAnacrusis: ${store.state.hasAnacrusis}, anacrusisOffset: ${anacrusisOffset.toFixed(3)}s`);

  logTransportDebug('scheduleNotes:start', {
    anacrusisOffset,
    noteCount: store.state.placedNotes.length,
    hasModulation,
    lassoActive: Boolean(store.state.lassoSelection?.isActive),
    hasAnacrusis: store.state.hasAnacrusis
  });

  // Check if lasso selection is active for playback isolation
  const lassoActive = store.state.lassoSelection?.isActive;
  const selectedNoteIds = lassoActive ? new Set(
    store.state.lassoSelection.selectedItems
      .filter(item => item.type === 'note')
      .map(item => item.id)
  ) : null;

  store.state.placedNotes.forEach((note, noteIndex) => {
    // If lasso selection is active, only schedule selected notes
    if (lassoActive) {
      const noteId = `note-${note.row}-${note.columnIndex}-${note.color}-${note.shape}`;
      if (!selectedNoteIds.has(noteId)) {
        return; // Skip this note
      }
    }

    // COORDINATE SYSTEM NOTE:
    // note.startColumnIndex and note.endColumnIndex are in canvas-space (0 = first musical beat)
    // timeMap indices also use canvas-space, so direct mapping
    const canvasStartIndex = note.startColumnIndex;
    const canvasEndIndex = note.endColumnIndex;

    const regularStartTime = timeMap[canvasStartIndex];

    if (regularStartTime === undefined) {
      logger.warn('TransportService', `[NOTE SCHEDULE] Note ${noteIndex}: timeMap[${canvasStartIndex}] undefined, skipping`);
      return;
    }

    // Skip notes that would be scheduled before the anacrusis offset (loop start)
    if (regularStartTime < anacrusisOffset) {
      logger.debug('transportService', `Skipping note at canvas column ${canvasStartIndex}, time ${regularStartTime.toFixed(3)}s - before anacrusis offset (${anacrusisOffset.toFixed(3)}s)`);
      return;
    }

    // Apply modulation to get the actual schedule time
    const scheduleTime = applyModulationToTime(regularStartTime, canvasStartIndex);

    if (noteIndex < 3) {
      logger.debug('TransportService', `[NOTE SCHEDULE] Note ${noteIndex}: canvas cols [${canvasStartIndex}-${canvasEndIndex}], startTime ${regularStartTime.toFixed(3)}s, scheduleTime ${scheduleTime.toFixed(3)}s`);
    }

    // Calculate duration based on note shape
    let duration;
    const regularEndTime = timeMap[canvasEndIndex + 1];

    // Safety check: if endTime is undefined, skip this note
    if (regularEndTime === undefined) {
      logger.warn('TransportService', `Skipping note with invalid endColumnIndex: ${note.endColumnIndex + 1} (note ends at ${note.endColumnIndex})`, {
        noteId: note.uuid,
        startColumnIndex: note.startColumnIndex,
        endColumnIndex: note.endColumnIndex,
        lookupIndex: note.endColumnIndex + 1,
        timeMapLength: timeMap.length,
        maxValidIndex: timeMap.length - 1,
        noteShape: note.shape
      }, 'audio');
      return;
    }

    // Apply modulation to the end time as well
    const modulatedEndTime = applyModulationToTime(regularEndTime, canvasEndIndex + 1);

    // Calculate modulated duration
    const tailDuration = modulatedEndTime - scheduleTime;

    if (note.shape === 'circle') {
      // Circle notes should respect their tail duration
      duration = tailDuration;

      // Log duration calculation for circle notes
    } else {
      // Oval notes and others use the current duration (1 microbeat equivalent)
      duration = tailDuration;

    }

    if (note.isDrum) {
      Tone.Transport.schedule(time => {
        if (store.state.isPaused) {return;}
        const safeTime = getSafeDrumStartTime(note.drumTrack, time);
        drumPlayers?.player(note.drumTrack)?.start(safeTime);

        // Trigger drum note pop animation
        DrumPlayheadRenderer.triggerNotePop(note.startColumnIndex, note.drumTrack);
      }, scheduleTime);
    } else {
      const pitch = getPitchForNote(note);
      const toolColor = note.color;
      // Use globalRow for pitch data lookup (fullRowData is never sliced)
      const rowIndex = note.globalRow ?? note.row;
      const pitchColor = store.state.fullRowData[rowIndex]?.hex || '#888888';
      const noteId = note.uuid;
      const timbre = store.state.timbres[toolColor];

      if (!timbre) {
        logger.warn('TransportService', `Timbre not found for color ${toolColor}. Skipping note ${noteId}`, null, 'audio');
        return;
      }

      let releaseTime = scheduleTime + duration;

      // CRITICAL FIX: Ensure release happens BEFORE loop end to prevent feedback loop
      // If release time is at or beyond loop end, clamp it to slightly before loop end
      const RELEASE_SAFETY_MARGIN = 0.001; // 1ms before loop end
      const maxReleaseTime = configuredLoopEnd - RELEASE_SAFETY_MARGIN;
      const needsClamp = releaseTime >= configuredLoopEnd;

      if (needsClamp) {
        releaseTime = Math.max(scheduleTime + 0.001, maxReleaseTime); // Ensure at least 1ms duration
      }

      Tone.Transport.schedule(time => {
        if (store.state.isPaused) {return;}
        SynthEngine.triggerAttack(pitch, toolColor, time);
        GlobalService.adsrComponent?.playheadManager.trigger(noteId, 'attack', pitchColor, timbre.adsr);

        // Emit event for animation service to track note attack
        store.emit('noteAttack', { noteId, color: toolColor });
      }, scheduleTime);

      Tone.Transport.schedule(time => {
        SynthEngine.triggerRelease(pitch, toolColor, time);
        GlobalService.adsrComponent?.playheadManager.trigger(noteId, 'release', pitchColor, timbre.adsr);

        // Emit event for animation service to track note release
        store.emit('noteRelease', { noteId, color: toolColor });
      }, releaseTime);
    }
  });

  // Schedule stamps with per-shape pitch offsets
  const stampPlaybackData = getStampPlaybackData();

  // Build selected stamps set if lasso is active
  const selectedStampIds = lassoActive ? new Set(
    store.state.lassoSelection.selectedItems
      .filter(item => item.type === 'stamp')
      .map(item => item.id)
  ) : null;

  stampPlaybackData.forEach(stampData => {
    // If lasso selection is active, only schedule selected stamps
    if (lassoActive) {
      const stampId = `stamp-${stampData.row}-${stampData.column}-${stampData.stampId}`;
      if (!selectedStampIds.has(stampId)) {
        return; // Skip this stamp
      }
    }

    // stampData.column is already in canvas-space (0 = first musical beat)
    const canvasColumnIndex = stampData.column;
    const cellStartTime = timeMap[canvasColumnIndex];
    if (cellStartTime === undefined) {return;}

    // Debug logging for first few columns
    if (canvasColumnIndex < 5) {
      logger.debug('TransportService', `[STAMP SCHEDULE] Stamp at column ${canvasColumnIndex}: cellStartTime ${cellStartTime.toFixed(3)}s, anacrusisOffset ${anacrusisOffset.toFixed(3)}s`);
    }

    // Skip stamps that would be scheduled before the anacrusis offset
    if (cellStartTime < anacrusisOffset) {
      logger.debug('TransportService', `Skipping stamp at column ${stampData.column} - before anacrusis offset`);
      return;
    }

    // Get the schedule events for this stamp, passing placement for per-shape offsets
    const scheduleEvents = getStampScheduleEvents(stampData.stampId, stampData.placement);

    scheduleEvents.forEach(event => {
      const offsetTime = Tone.Time(event.offset).toSeconds();
      const duration = Tone.Time(event.duration).toSeconds();
      const triggerTime = cellStartTime + offsetTime;
      const releaseTime = triggerTime + duration;

      // Calculate pitch for this individual shape
      // event.rowOffset contains the pitch offset from the base row
      const shapeRow = stampData.row + event.rowOffset;
      const shapePitch = getPitchFromRow(shapeRow);

      // Schedule attack with per-shape pitch
      Tone.Transport.schedule(time => {
        if (store.state.isPaused) {return;}
        SynthEngine.triggerAttack(shapePitch, stampData.color, time);
      }, triggerTime);

      // Schedule release with per-shape pitch
      Tone.Transport.schedule(time => {
        if (store.state.isPaused) {return;}
        SynthEngine.triggerRelease(shapePitch, stampData.color, time);
      }, releaseTime);
    });

    logger.debug('TransportService', `Scheduled stamp ${stampData.stampId} with ${scheduleEvents.length} events at column ${stampData.column}`, {
      stampId: stampData.stampId,
      column: stampData.column,
      basePitch: stampData.pitch,
      baseRow: stampData.row,
      startTime: cellStartTime,
      events: scheduleEvents.length,
      hasShapeOffsets: !!stampData.placement?.shapeOffsets
    }, 'audio');
  });

  // Schedule triplet groups with per-shape pitch offsets
  const tripletPlaybackData = getTripletPlaybackData();

  // Build selected triplets set if lasso is active
  const selectedTripletIds = lassoActive ? new Set(
    store.state.lassoSelection.selectedItems
      .filter(item => item.type === 'triplet')
      .map(item => item.id)
  ) : null;

  tripletPlaybackData.forEach(tripletData => {
    // If lasso selection is active, only schedule selected triplets
    if (lassoActive) {
      const tripletId = `triplet-${tripletData.row}-${tripletData.column}-${tripletData.tripletId}`;
      if (!selectedTripletIds.has(tripletId)) {
        return; // Skip this triplet
      }
    }

    // Convert cell index to microbeat column index (canvas-space)
    // cell index * 2 microbeats per cell = canvas-space column (0 = first musical beat)
    const canvasColumnIndex = tripletData.startCellIndex * 2;
    const cellStartTime = timeMap[canvasColumnIndex];

    if (cellStartTime === undefined) {return;}

    // Skip triplets that would be scheduled before the anacrusis offset
    if (cellStartTime < anacrusisOffset) {
      logger.debug('TransportService', `Skipping triplet at cell ${tripletData.startCellIndex} - before anacrusis offset`);
      return;
    }

    // Get the schedule events for this triplet, passing placement for per-shape offsets
    logger.debug('TransportService', '[TRANSPORT DEBUG] Scheduling triplet', {
      stampId: tripletData.stampId,
      baseRow: tripletData.row,
      hasPlacement: !!tripletData.placement,
      hasShapeOffsets: !!tripletData.placement?.shapeOffsets,
      shapeOffsets: tripletData.placement?.shapeOffsets
    });

    const scheduleEvents = getTripletScheduleEvents(tripletData.stampId, tripletData.placement);

    scheduleEvents.forEach(event => {
      const offsetTime = Tone.Time(event.offset).toSeconds();
      const eventDuration = Tone.Time(event.duration).toSeconds();

      const triggerTime = cellStartTime + offsetTime;
      const releaseTime = triggerTime + eventDuration;

      // Calculate pitch for this individual shape
      // event.rowOffset contains the pitch offset from the base row
      const shapeRow = tripletData.row + event.rowOffset;
      const shapePitch = getPitchFromRow(shapeRow);

      logger.debug('TransportService', '[TRANSPORT DEBUG] Scheduling shape', {
        slot: event.slot,
        rowOffset: event.rowOffset,
        baseRow: tripletData.row,
        shapeRow,
        shapePitch
      });

      // Schedule attack with per-shape pitch
      Tone.Transport.schedule(time => {
        if (store.state.isPaused) {return;}
        SynthEngine.triggerAttack(shapePitch, tripletData.color, time);
      }, triggerTime);

      // Schedule release with per-shape pitch
      Tone.Transport.schedule(time => {
        if (store.state.isPaused) {return;}
        SynthEngine.triggerRelease(shapePitch, tripletData.color, time);
      }, releaseTime);
    });

    logger.debug('TransportService', `Scheduled triplet ${tripletData.stampId} with ${scheduleEvents.length} events at cell ${tripletData.startCellIndex}`, {
      stampId: tripletData.stampId,
      cellIndex: tripletData.startCellIndex,
      basePitch: getPitchFromRow(tripletData.row),
      baseRow: tripletData.row,
      startTime: cellStartTime,
      events: scheduleEvents.length,
      hasShapeOffsets: !!tripletData.placement?.shapeOffsets
    }, 'audio');
  });

  logger.debug('TransportService', 'scheduleNotes', `Finished scheduling ${store.state.placedNotes.length} notes, ${stampPlaybackData.length} stamps, and ${tripletPlaybackData.length} triplets`, 'audio');
  logTransportDebug('scheduleNotes:complete', {
    noteCount: store.state.placedNotes.length,
    stampCount: stampPlaybackData.length,
    tripletCount: tripletPlaybackData.length,
    hasModulation
  });
}

function animatePlayhead() {
  const playheadCanvas = domCache.get('playheadCanvas');
  if (!playheadCanvas) {
    return;
  }
  const ctx = playheadCanvas.getContext('2d');

  const baseTempo = store.state.tempo;
  const TEMPO_MULTIPLIER_EPSILON = 0.0001;
  const MARKER_PASS_EPSILON = 0.5; // pixels
  const getMarkerX = marker => marker?.xPosition ?? 477.5;
  const initialBpm = typeof Tone.Transport?.bpm?.value === 'number'
    ? Tone.Transport.bpm.value
    : baseTempo;
  let lastAppliedTempoMultiplier = baseTempo !== 0 ? initialBpm / baseTempo : 1.0;

  shouldAnimatePlayhead = true; // Start the animation

  function draw() {
    if (!shouldAnimatePlayhead || !playheadCanvas) {
      return;
    }

    // If Transport hasn't started yet (scheduled), just continue looping and wait
    if (Tone.Transport.state === 'stopped') {
      playheadAnimationFrame = requestAnimationFrame(draw);
      return;
    }

    const transportLoopEnd = Tone.Transport.loopEnd ?? 0;
    const isLooping = store.state.isLooping;
    const musicalEnd = getMusicalEndTime();
    const playbackEnd = (isLooping && transportLoopEnd > 0) ? transportLoopEnd : musicalEnd;
    const currentTime = Tone.Transport.seconds;

    frameCount++;

    const reachedEnd = currentTime >= (playbackEnd - 0.001);

    // Stop only when looping is disabled; otherwise let Tone.js handle the wrap-around
    if (!isLooping && reachedEnd) {
      logger.info('TransportService', 'Playback reached end. Stopping playhead.', { currentTime, playbackEnd, isLooping }, 'transport');
      logTransportDebug('animate:stop-guard', { currentTime, playbackEnd, isLooping, loopStart: Tone.Transport.loopStart, loopEnd: Tone.Transport.loopEnd });
      TransportService.stop();
      return;
    }

    if (store.state.isPaused) {
      playheadAnimationFrame = requestAnimationFrame(draw);
      return;
    };
    const logicalWidth = getLogicalCanvasWidth(playheadCanvas);
    const logicalHeight = getLogicalCanvasHeight(playheadCanvas);
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    let loopAwareTime = currentTime;
    if (isLooping) {
      const loopDuration = Tone.Transport.loopEnd - Tone.Transport.loopStart;
      if (loopDuration > 0) {
        loopAwareTime = (currentTime - Tone.Transport.loopStart) % loopDuration + Tone.Transport.loopStart;
      }
    }

    const maxXPos = getColumnStartX(getRightLegendStartIndex());

    // Get tonic column spans for visual skipping
    const placedTonicSigns = getPlacedTonicSigns(store.state);
    const tonicSpanColumns = getTonicSpanColumnIndices(placedTonicSigns);

    let xPos = 0;
    for (let i = 0; i < timeMap.length - 1; i++) {
      if (timeMap[i] === undefined) {continue;}

      if (loopAwareTime >= timeMap[i] && loopAwareTime < timeMap[i+1]) {
        // Found the column containing current time

        // TONIC SKIP: If this column is a tonic span, jump to the first non-tonic column
        let displayColIndex = i;
        while (tonicSpanColumns.has(displayColIndex) && displayColIndex < timeMap.length - 1) {
          displayColIndex++;
        }

        // Calculate position at the (possibly skipped) column
        const colStartX = getColumnStartX(displayColIndex);
        const colWidth = getColumnWidth(displayColIndex);

        // Only interpolate within non-tonic columns
        if (!tonicSpanColumns.has(i)) {
          const colStartTime = timeMap[i];
          const colEndTime = timeMap[i+1];
          const colDuration = colEndTime - colStartTime;
          const timeIntoCol = loopAwareTime - colStartTime;
          const ratio = colDuration > 0 ? timeIntoCol / colDuration : 0;
          xPos = colStartX + ratio * colWidth;
        } else {
          // Tonic column: snap to the start of the next non-tonic column
          xPos = colStartX;
        }

        break;
      }
    }

    const finalXPos = Math.min(xPos, maxXPos);

    // DYNAMIC TEMPO: Apply modulation based on marker positions each frame
    const modulationMarkers = Array.isArray(store.state.modulationMarkers)
      ? store.state.modulationMarkers
      : [];

    const activeMarkers = modulationMarkers
      .filter(marker => marker?.active && typeof marker.ratio === 'number' && marker.ratio !== 0)
      .sort((a, b) => getMarkerX(a) - getMarkerX(b));

    if (activeMarkers.length > 0) {
      let targetMultiplier = 1.0;

      for (const marker of activeMarkers) {
        const markerX = getMarkerX(marker);
        if (finalXPos + MARKER_PASS_EPSILON >= markerX) {
          targetMultiplier *= 1 / marker.ratio;
        } else {
          break;
        }
      }

      if (!Number.isFinite(targetMultiplier) || targetMultiplier <= 0) {
        targetMultiplier = 1.0;
      }

      if (Math.abs(targetMultiplier - lastAppliedTempoMultiplier) > TEMPO_MULTIPLIER_EPSILON) {
        const newTempo = baseTempo * targetMultiplier;
        Tone.Transport.bpm.value = newTempo;
        reapplyConfiguredLoopBounds();
        lastAppliedTempoMultiplier = targetMultiplier;
        const tempoDetails = {
          targetMultiplier: Number(targetMultiplier.toFixed(6)),
          newTempo: Number(newTempo.toFixed(3)),
          markerCount: activeMarkers.length,
          finalXPos: Number(finalXPos.toFixed(2))
        };
        logger.debug(
          'TransportService',
          `Tempo multiplier updated to ${targetMultiplier.toFixed(3)} (${newTempo.toFixed(2)} BPM)`,
          tempoDetails,
          'transport'
        );
        logTransportDebug('tempo:multiplier:update', tempoDetails);
      }
    } else if (Math.abs(lastAppliedTempoMultiplier - 1.0) > TEMPO_MULTIPLIER_EPSILON) {
      Tone.Transport.bpm.value = baseTempo;
      reapplyConfiguredLoopBounds();
      lastAppliedTempoMultiplier = 1.0;
      const tempoDetails = {
        targetMultiplier: 1.0,
        newTempo: Number(baseTempo.toFixed(3)),
        markerCount: activeMarkers.length,
        finalXPos: Number(finalXPos.toFixed(2))
      };
      logger.debug(
        'TransportService',
        `Tempo reset to base ${baseTempo} BPM`,
        tempoDetails,
        'transport'
      );
      logTransportDebug('tempo:multiplier:reset', tempoDetails);
    }

    if (finalXPos >= 0) {
      // No offset needed - finalXPos is already in musical canvas coordinates
      // (playheadModel returns positions relative to musical area, and canvas is now sized to musical area only)
      const canvasXPos = finalXPos;

      ctx.strokeStyle = 'rgba(255,0,0,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvasXPos, 0);
      const canvasHeight = getLogicalCanvasHeight(playheadCanvas);
      ctx.lineTo(canvasXPos, canvasHeight);
      ctx.stroke();
    }

    playheadAnimationFrame = requestAnimationFrame(draw);
  }
  draw();
}

const TransportService = {
  init() {
    // Create drum volume control node
    const drumVolumeNode = new Tone.Volume(0); // 0dB = 100% volume

    drumPlayers = new Tone.Players({
      H: 'https://tonejs.github.io/audio/drum-samples/CR78/hihat.mp3',
      M: 'https://tonejs.github.io/audio/drum-samples/CR78/snare.mp3',
      L: 'https://tonejs.github.io/audio/drum-samples/CR78/kick.mp3'
    }).connect(drumVolumeNode);

    // Connect drums to the same main audio chain as synths to avoid volume conflicts
    // Check if main volume control exists from SynthEngine
    if (window.synthEngine) {
      // Try to connect to the main volume control chain
      const synthEngineDestination = window.synthEngine.getMainVolumeNode?.();
      if (synthEngineDestination) {
        drumVolumeNode.connect(synthEngineDestination);
      } else {
        drumVolumeNode.toDestination();
      }
    } else {
      drumVolumeNode.toDestination();
    }

    // Store reference to drum volume node for external access
    window.drumVolumeNode = drumVolumeNode;

    window.transportService = { drumPlayers };

    Tone.Transport.bpm.value = store.state.tempo;

    store.on('rhythmStructureChanged', () => this.handleStateChange());
    store.on('notesChanged', () => this.handleStateChange());
    store.on('stampPlacementsChanged', () => this.handleStateChange());
    store.on('modulationMarkersChanged', () => {
      // Recalculate the cached musical end time when modulation markers change
      if (timeMap.length > 0) {
        calculateMusicalEndTime();
      }
      this.handleStateChange();
    });
    // Also listen to layoutConfigChanged to recalculate when column widths change
    // This ensures transport uses updated column widths after rhythm structure changes
    store.on('layoutConfigChanged', (data: any) => {
      // Check if column widths actually changed
      const oldWidths = data?.oldConfig?.columnWidths || [];
      const newWidths = data?.newConfig?.columnWidths || [];
      const columnWidthsChanged = oldWidths.length !== newWidths.length;

      if (columnWidthsChanged) {
        // Always recalculate when column widths change (even during playback)
        calculateTimeMap();
      }
    });

    store.on('tempoChanged', newTempo => {
      logger.event('TransportService', `tempoChanged triggered with new value: ${newTempo} BPM`, null, 'transport');
      logTransportDebug('tempoChanged:event', { newTempo });

      if (Tone.Transport.state === 'started') {
        logger.info('TransportService', 'Tempo changed WHILE PLAYING. Resynchronizing transport...', null, 'transport');

        const currentPosition = Tone.Transport.position;
        logger.debug('TransportService', `Saved musical position: ${currentPosition}`, null, 'transport');

        Tone.Transport.pause();
        logger.debug('TransportService', 'Transport paused', null, 'transport');
        logTransportDebug('tempoChanged:paused-for-update', { currentPosition });

        if (playheadAnimationFrame) {
          cancelAnimationFrame(playheadAnimationFrame);
          playheadAnimationFrame = null;
        }

        Tone.Transport.bpm.value = newTempo;
        reapplyConfiguredLoopBounds();
        logger.debug('TransportService', `New BPM set to ${Tone.Transport.bpm.value}`, null, 'transport');
        logTransportDebug('tempoChanged:set-bpm', { newTempo });

        scheduleNotes();
        logTransportDebug('tempoChanged:rescheduled', { newTempo, currentPosition });

        Tone.Transport.start(undefined, currentPosition);
        logger.debug('TransportService', `Transport restarted at musical position ${currentPosition}`, null, 'transport');
        logTransportDebug('tempoChanged:restarted', { currentPosition });

        animatePlayhead();

      } else {
        logger.debug('TransportService', 'Tempo changed while stopped/paused. Updating BPM for next run', null, 'transport');
        Tone.Transport.bpm.value = newTempo;
        reapplyConfiguredLoopBounds();
        calculateTimeMap();
        logTransportDebug('tempoChanged:idle-update', { newTempo });
      }
    });

    store.on('loopingChanged', isLooping => {
      Tone.Transport.loop = isLooping;
      if (isLooping && Tone.Transport.loopEnd <= Tone.Transport.loopStart) {
        Tone.Transport.loopEnd = Tone.Transport.loopStart + Math.max(getMicrobeatDuration(), 0.001);
      }
      if (isLooping) {
        configuredLoopStart = Tone.Transport.loopStart;
        configuredLoopEnd = Tone.Transport.loopEnd;
      } else {
        configuredLoopStart = 0;
        configuredLoopEnd = 0;
      }
      logTransportDebug('loopingChanged:event', {
        isLooping,
        loopStart: Tone.Transport.loopStart,
        loopEnd: Tone.Transport.loopEnd
      });
    });

    Tone.Transport.on('stop', () => {
      logger.event('TransportService', "Tone.Transport 'stop' fired. Resetting playback state", null, 'transport');
      store.setPlaybackState(false, false);
      GlobalService.adsrComponent?.playheadManager.clearAll();
      if (playheadAnimationFrame) {
        cancelAnimationFrame(playheadAnimationFrame);
        playheadAnimationFrame = null;
      }
      logTransportDebug('transport-event:stop');
    });

    logger.info('TransportService', 'Initialized', null, 'transport');
    logTransportDebug('init:complete');
  },

  handleStateChange() {
    const transportState = Tone.Transport.state;
    logTransportDebug('handleStateChange', { transportState });

    if (transportState === 'started') {
      logger.debug('TransportService', 'handleStateChange: Notes or rhythm changed during playback. Rescheduling', null, 'transport');

      const currentPosition = Tone.Transport.position;
      Tone.Transport.pause();
      logTransportDebug('handleStateChange:paused', { position: currentPosition });
      scheduleNotes();
      logTransportDebug('handleStateChange:rescheduled', { position: currentPosition });
      Tone.Transport.start(undefined, currentPosition);
      logTransportDebug('handleStateChange:restart', { position: currentPosition });

    } else {
      calculateTimeMap();
      logTransportDebug('handleStateChange:recalculate', { transportState });
    }
  },

  start() {
    logger.info('TransportService', 'Starting playback', null, 'transport');
    logTransportDebug('start:requested', {
      requestedTempo: store.state.tempo,
      isLooping: store.state.isLooping,
      placedNotes: store.state.placedNotes.length
    });
    // Use global audio initialization to ensure user gesture compliance
    const audioInit = window.initAudio || (() => Tone.start());
    void audioInit().then(() => {
      scheduleNotes();
      logTransportDebug('start:after-schedule', {
        scheduledNotes: store.state.placedNotes.length,
        scheduledStamps: getStampPlaybackData().length,
        scheduledTriplets: getTripletPlaybackData().length
      });
      const timelineEnd = timeMap.length > 0 ? timeMap[timeMap.length - 1] : 0;
      const musicalDuration = getMusicalEndTime();

      // Set loop bounds for the entire musical timeline (including any pickup/anacrusis columns)
      setLoopBounds(0, musicalDuration);
      Tone.Transport.bpm.value = store.state.tempo;

      logger.debug('TransportService', `Transport configured. Loop: ${Tone.Transport.loop}, BPM: ${Tone.Transport.bpm.value}`, null, 'transport');
      logTransportDebug('start:configured', {
        loopStart: Tone.Transport.loopStart,
        loopEnd: Tone.Transport.loopEnd,
        timelineEnd,
        musicalDuration
      });

      // Start playback from the beginning (position 0)
      // The playhead will move across all columns including anacrusis
      const startTime = Tone.now() + 0.1; // Schedule start slightly in future
      Tone.Transport.start(startTime, 0);
      logTransportDebug('start:transport-started', { startPosition: 0, startTime });

      animatePlayhead();

      // Emit playback events for animation service
      store.emit('playbackStarted');
      logTransportDebug('start:playback-started');
    });
  },

  resume() {
    logger.info('TransportService', 'Resuming playback', null, 'transport');
    logTransportDebug('resume:requested');
    // Use global audio initialization to ensure user gesture compliance
    const audioInit = window.initAudio || (() => Tone.start());
    void audioInit().then(() => {
      Tone.Transport.start();
      logTransportDebug('resume:transport-started');

      animatePlayhead();

      // Emit playback events for animation service
      store.emit('playbackResumed');
      logTransportDebug('resume:playback-resumed');
    });
  },

  pause() {
    logger.info('TransportService', 'Pausing playback', null, 'transport');
    logTransportDebug('pause:requested');
    Tone.Transport.pause();
    logTransportDebug('pause:transport-paused');
    if (playheadAnimationFrame) {
      cancelAnimationFrame(playheadAnimationFrame);
      playheadAnimationFrame = null;
    }

    // Emit playback events for animation service
    store.emit('playbackPaused');
    logTransportDebug('pause:playback-paused');
  },

  stop() {
    logger.info('TransportService', 'Stopping playback and clearing visuals', null, 'transport');
    logTransportDebug('stop:requested');

    // Stop the animation loop
    shouldAnimatePlayhead = false;
    if (playheadAnimationFrame) {
      cancelAnimationFrame(playheadAnimationFrame);
      playheadAnimationFrame = null;
    }

    Tone.Transport.stop();
    logTransportDebug('stop:transport-stopped');

    Tone.Transport.cancel();
    resetDrumStartTimes();
    Tone.Transport.bpm.value = store.state.tempo;
    reapplyConfiguredLoopBounds();
    logTransportDebug('stop:transport-reset', { tempoResetTo: store.state.tempo });
    SynthEngine.releaseAll();

    const playheadCanvas = domCache.get('playheadCanvas');
    if (playheadCanvas) {
      const ctx = playheadCanvas.getContext('2d');
      ctx.clearRect(0, 0, getLogicalCanvasWidth(playheadCanvas), getLogicalCanvasHeight(playheadCanvas));
    }

    // Emit playback events for animation service
    store.emit('playbackStopped');
    logTransportDebug('stop:playback-stopped');
  }
};

export default TransportService;
