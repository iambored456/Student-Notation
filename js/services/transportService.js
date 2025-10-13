// js/services/transportService.js
import * as Tone from 'tone';
import store from '../state/index.js';
import { getPlacedTonicSigns, getMacrobeatInfo } from '../state/selectors.js';
import LayoutService from './layoutService.js';
import SynthEngine from './synthEngine.js';
import GlobalService from './globalService.js';
import domCache from './domCache.js';
import logger from '../utils/logger.js';
import DrumPlayheadRenderer from '../components/Canvas/DrumGrid/drumPlayheadRenderer.js';

/**
 * Gets the base (non-modulated) column X position for playhead timing
 * @param {number} columnIndex - Column index
 * @returns {number} Base X position without modulation effects
 */
function getBaseColumnX(columnIndex) {
    let x = 0;
    for (let i = 0; i < columnIndex; i++) {
        const widthMultiplier = store.state.columnWidths[i] || 0;
        x += widthMultiplier * store.state.cellWidth;
    }
    return x;
}
import { getStampPlaybackData } from '../rhythm/stampPlacements.js';
import { getStampScheduleEvents } from '../rhythm/scheduleStamps.js';
import { getTripletPlaybackData } from '../rhythm/tripletPlacements.js';
import { getTripletScheduleEvents } from '../rhythm/scheduleTriplets.js';
import { createCoordinateMapping, canvasXToSeconds, secondsToCanvasX, columnToRegularTime } from '../rhythm/modulationMapping.js';
import { analyzeNoteCrossesMarkers } from '../components/Canvas/PitchGrid/renderers/notes.js';
import { getColumnX } from '../components/Canvas/PitchGrid/renderers/rendererUtils.js';

// Helper function to get pitch from row index (like in pitchGridInteractor.js)
function getPitchFromRow(rowIndex) {
    const rowData = store.state.fullRowData[rowIndex];
    return rowData ? rowData.toneNote.replace('♭', 'b').replace('♯', '#') : 'C4';
}

logger.moduleLoaded('TransportService');

let playheadAnimationFrame;
let drumPlayers;
let timeMap = [];

function getMicrobeatDuration() {
    const tempo = store.state.tempo;
    const microbeatBPM = tempo * 2; 
    return 60 / microbeatBPM;
}

function findNonAnacrusisStart() {
    if (!store.state.hasAnacrusis) {
        // No anacrusis, start from the beginning of first macrobeat
        return timeMap[2] || 0;
    }
    
    // Find the first solid boundary which marks the end of anacrusis
    for (let i = 0; i < store.state.macrobeatBoundaryStyles.length; i++) {
        if (store.state.macrobeatBoundaryStyles[i] === 'solid') {
            // Found the first solid boundary - the non-anacrusis starts after this macrobeat
            const macrobeatInfo = getMacrobeatInfo(store.state, i + 1);
            if (macrobeatInfo) {
                return timeMap[macrobeatInfo.startColumn] || 0;
            }
        }
    }
    
    // If no solid boundary found, anacrusis continues throughout, so use anacrusis start
    return timeMap[2] || 0;
}

function calculateTimeMap() {
    logger.debug('transportService', 'calculateTimeMap', { tempo: `${store.state.tempo} BPM` });
    timeMap = [];
    
    const microbeatDuration = getMicrobeatDuration();
    const { columnWidths, modulationMarkers } = store.state;
    const placedTonicSigns = getPlacedTonicSigns(store.state);
    
    // PLAYHEAD FIX: Always use regular timing for consistent playhead speed
    // Note triggers will be calculated separately using modulation mapping
    if (modulationMarkers && modulationMarkers.length > 0) {
    }
    calculateRegularTimeMap(microbeatDuration, columnWidths, placedTonicSigns);
    
    logger.timing('transportService', 'calculateTimeMap', { totalDuration: `${timeMap[timeMap.length - 1]?.toFixed(2)}s` });
}

function calculateRegularTimeMap(microbeatDuration, columnWidths, placedTonicSigns) {
    let currentTime = 0;
    
    for (let i = 0; i < columnWidths.length; i++) {
        timeMap[i] = currentTime;
        const isTonicColumn = placedTonicSigns.some(ts => ts.columnIndex === i);
        if (!isTonicColumn) {
            currentTime += columnWidths[i] * microbeatDuration;
        }
    }
    timeMap.push(currentTime);
}

function calculateModulatedTimeMap(microbeatDuration, columnWidths, placedTonicSigns) {
    const baseMicrobeatPx = store.state.baseMicrobeatPx || store.state.cellWidth || 40;
    const coordinateMapping = createCoordinateMapping(store.state.modulationMarkers, baseMicrobeatPx, store.state);
    
    
    // Calculate time for each column using modulation mapping
    for (let i = 0; i < columnWidths.length; i++) {
        const columnX = getColumnXForTimeMap(i, columnWidths, baseMicrobeatPx);
        const timeSeconds = canvasXToSeconds(columnX, coordinateMapping, microbeatDuration);
        timeMap[i] = timeSeconds;
        
        // Skip tonic columns (they don't consume time)
        const isTonicColumn = placedTonicSigns.some(ts => ts.columnIndex === i);
        
    }
    
    // Add final time point
    const finalX = getColumnXForTimeMap(columnWidths.length, columnWidths, baseMicrobeatPx);
    const finalTime = canvasXToSeconds(finalX, coordinateMapping, microbeatDuration);
    timeMap.push(finalTime);
    
}

function getColumnXForTimeMap(columnIndex, columnWidths, baseMicrobeatPx) {
    // Calculate actual column X position based on column widths (same logic as getBaseColumnX)
    let x = 0;
    for (let i = 0; i < columnIndex; i++) {
        const widthMultiplier = columnWidths[i] || 0;
        x += widthMultiplier * baseMicrobeatPx;
    }
    return x;
}

/**
 * Calculates the trigger time for a note, accounting for modulation if present
 * @param {number} columnIndex - Column index of the note
 * @returns {number} Time in seconds when the note should trigger
 */
function calculateNoteTriggerTime(columnIndex) {
    const { modulationMarkers } = store.state;
    
    if (!modulationMarkers || modulationMarkers.length === 0) {
        // No modulation - use regular time map
        return timeMap[columnIndex];
    }
    
    // With modulation - calculate trigger time using modulation mapping
    const microbeatDuration = getMicrobeatDuration();
    const baseMicrobeatPx = store.state.baseMicrobeatPx || store.state.cellWidth || 40;
    const coordinateMapping = createCoordinateMapping(modulationMarkers, baseMicrobeatPx, store.state);
    
    // Convert column index to canvas X position
    const columnX = getColumnXForTimeMap(columnIndex, store.state.columnWidths, baseMicrobeatPx);
    
    // Convert canvas X to modulated time
    const modulatedTime = canvasXToSeconds(columnX, coordinateMapping, microbeatDuration);
    
    
    return modulatedTime;
}

function getPitchForNote(note) {
    const rowData = store.state.fullRowData; 
    if (rowData && rowData[note.row]) {
        const pitch = rowData[note.row].toneNote;
        return pitch.replace('♭', 'b').replace('♯', '#');
    }
    return 'C4';
}

function scheduleNotes() {
    logger.debug('transportService', 'scheduleNotes', 'Clearing previous transport events and rescheduling all notes');
    Tone.Transport.cancel();
    calculateTimeMap();
    GlobalService.adsrComponent?.playheadManager.clearAll();

    const anacrusisOffset = timeMap[2] || 0;

    const hasModulation = store.state.modulationMarkers && store.state.modulationMarkers.length > 0;

    // Check if lasso selection is active for playback isolation
    const lassoActive = store.state.lassoSelection?.isActive;
    const selectedNoteIds = lassoActive ? new Set(
        store.state.lassoSelection.selectedItems
            .filter(item => item.type === 'note')
            .map(item => item.id)
    ) : null;

    store.state.placedNotes.forEach(note => {
        // If lasso selection is active, only schedule selected notes
        if (lassoActive) {
            const noteId = `note-${note.row}-${note.columnIndex}-${note.color}-${note.shape}`;
            if (!selectedNoteIds.has(noteId)) {
                return; // Skip this note
            }
        }
        // Calculate note trigger times
        const regularStartTime = timeMap[note.startColumnIndex]; // Regular transport time
        const modulatedStartTime = hasModulation ? calculateNoteTriggerTime(note.startColumnIndex) : regularStartTime;
        
        if (regularStartTime === undefined) return;

        // Skip notes that would be scheduled before the anacrusis offset (loop start)
        if (regularStartTime < anacrusisOffset) {
            logger.debug('transportService', `Skipping note at column ${note.startColumnIndex} (regular time ${regularStartTime}) - before anacrusis offset (${anacrusisOffset})`);
            return;
        }
        
        // TIMING FIX: For modulation, use regular time since playhead moves at constant speed
        // The modulated time is just for musical calculation - transport scheduling uses regular time
        const scheduleTime = regularStartTime;
        
        
        // Show timing comparison when modulation is active
        if (hasModulation) {
            const timeDifference = modulatedStartTime - regularStartTime;
        }

        // Calculate duration based on note shape
        let duration;
        const regularEndTime = timeMap[note.endColumnIndex + 1];
        const modulatedEndTime = hasModulation ? calculateNoteTriggerTime(note.endColumnIndex + 1) : regularEndTime;
        
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
        
        // Use regular duration for transport scheduling (playhead moves at constant speed)
        const tailDuration = regularEndTime - regularStartTime;
        
        if (note.shape === 'circle') {
            // Circle notes should respect their tail duration
            duration = tailDuration;
            const microbeatDuration = getMicrobeatDuration();
            const defaultCircleDuration = 2 * microbeatDuration;
            
            // Log duration calculation for circle notes
        } else {
            // Oval notes and others use the current duration (1 microbeat equivalent)
            duration = tailDuration;
            
        }

        if (note.isDrum) {
            Tone.Transport.schedule(time => {
                if (store.state.isPaused) return;
                drumPlayers?.player(note.drumTrack)?.start(time);
                
                // Trigger drum note pop animation
                DrumPlayheadRenderer.triggerNotePop(note.startColumnIndex, note.drumTrack);
            }, scheduleTime);
        } else {
            const pitch = getPitchForNote(note);
            const toolColor = note.color;
            const pitchColor = store.state.fullRowData[note.row]?.hex || '#888888';
            const noteId = note.uuid;
            const timbre = store.state.timbres[toolColor];

            if (!timbre) {
                logger.warn('TransportService', `Timbre not found for color ${toolColor}. Skipping note ${noteId}`, null, 'audio');
                return;
            }
            
            // Log when attack is scheduled
            
            Tone.Transport.schedule(time => {
                if (store.state.isPaused) return;
                SynthEngine.triggerAttack(pitch, toolColor, time);
                GlobalService.adsrComponent?.playheadManager.trigger(noteId, 'attack', pitchColor, timbre.adsr);
                
                // Emit event for animation service to track note attack
                store.emit('noteAttack', { noteId, color: toolColor });
            }, scheduleTime);

            // Log when release is scheduled
            const releaseTime = scheduleTime + duration;
            
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

        const cellStartTime = timeMap[stampData.column];
        if (cellStartTime === undefined) return;

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
                if (store.state.isPaused) return;
                SynthEngine.triggerAttack(shapePitch, stampData.color, time);
            }, triggerTime);

            // Schedule release with per-shape pitch
            Tone.Transport.schedule(time => {
                if (store.state.isPaused) return;
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

        // Convert cell index to microbeat column index (same as stamps)
        const columnIndex = tripletData.startCellIndex * 2; // cell index * 2 microbeats per cell
        const cellStartTime = timeMap[columnIndex];

        if (cellStartTime === undefined) return;

        // Skip triplets that would be scheduled before the anacrusis offset
        if (cellStartTime < anacrusisOffset) {
            logger.debug('TransportService', `Skipping triplet at cell ${tripletData.startCellIndex} - before anacrusis offset`);
            return;
        }

        // Get the schedule events for this triplet, passing placement for per-shape offsets
        console.log('[TRANSPORT DEBUG] Scheduling triplet:', {
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

            console.log('[TRANSPORT DEBUG] Scheduling shape:', {
                slot: event.slot,
                rowOffset: event.rowOffset,
                baseRow: tripletData.row,
                shapeRow,
                shapePitch
            });

            // Schedule attack with per-shape pitch
            Tone.Transport.schedule(time => {
                if (store.state.isPaused) return;
                SynthEngine.triggerAttack(shapePitch, tripletData.color, time);
            }, triggerTime);

            // Schedule release with per-shape pitch
            Tone.Transport.schedule(time => {
                if (store.state.isPaused) return;
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
}

function animatePlayhead() {
    const playheadCanvas = domCache.get('playheadCanvas');
    if (!playheadCanvas) return;
    const ctx = playheadCanvas.getContext('2d');
    
    // DYNAMIC TEMPO: Track modulation markers and adjust BPM as playhead crosses them
    const hasModulation = store.state.modulationMarkers && store.state.modulationMarkers.length > 0;
    const maxXPos = getBaseColumnX(store.state.columnWidths.length - 2);
    const musicalDuration = timeMap[store.state.columnWidths.length - 2] || 0;
    
    // Track which modulation markers we've passed
    let passedMarkers = new Set();
    const baseTempo = store.state.tempo;
    let currentTempoMultiplier = 1.0;

    function draw() {
        if (Tone.Transport.state !== 'started' || !playheadCanvas) {
            return;
        }

        const isLooping = store.state.isLooping;
        const currentTime = Tone.Transport.seconds;

        // Check if we should stop - either when not looping OR when we reach the end even with looping
        if (currentTime >= musicalDuration) {
            logger.info('TransportService', 'Playback reached end. Stopping playhead.', { currentTime, musicalDuration, isLooping }, 'transport');
            TransportService.stop();
            return;
        }

        if (store.state.isPaused) {
            playheadAnimationFrame = requestAnimationFrame(draw);
            return;
        };
        ctx.clearRect(0, 0, playheadCanvas.width, playheadCanvas.height);
        
        let loopAwareTime = currentTime;
        if (isLooping) {
            const loopDuration = Tone.Transport.loopEnd - Tone.Transport.loopStart;
            if (loopDuration > 0) {
                 loopAwareTime = (currentTime - Tone.Transport.loopStart) % loopDuration + Tone.Transport.loopStart;
            }
        }

        let xPos = 0;
        for (let i = 0; i < timeMap.length - 1; i++) {
            if (timeMap[i] === undefined) continue; 

            if (loopAwareTime >= timeMap[i] && loopAwareTime < timeMap[i+1]) {
                const colStartTime = timeMap[i];
                const colEndTime = timeMap[i+1];
                const colDuration = colEndTime - colStartTime;
                const timeIntoCol = loopAwareTime - colStartTime;
                
                // PLAYHEAD FIX: Always use base column positions for consistent playhead speed
                // The playhead moves at constant tempo regardless of modulation
                const colStartX = getBaseColumnX(i);
                const colWidth = getBaseColumnX(i + 1) - colStartX;
                
                const ratio = colDuration > 0 ? timeIntoCol / colDuration : 0;
                xPos = colStartX + ratio * colWidth;
                
                // Debug logging every 30 frames (~0.5 seconds at 60fps)
                break;
            }
        }
        
        const finalXPos = Math.min(xPos, maxXPos);
        
        // DYNAMIC TEMPO: Check if playhead has crossed any modulation markers
        if (hasModulation && store.state.modulationMarkers) {
            for (const marker of store.state.modulationMarkers) {
                if (!marker.active) continue;
                
                // Get marker's visual X position  
                const markerX = marker.xPosition || 477.5; // Fallback to stored position
                
                // Check if playhead has just crossed this marker
                if (finalXPos >= markerX && !passedMarkers.has(marker.id)) {
                    passedMarkers.add(marker.id);
                    
                    // Apply tempo modulation based on marker type
                    let tempoAdjustment;
                    if (Math.abs(marker.ratio - (2/3)) < 0.001) {
                        // 2:3 compression: tempo should increase (1/ratio = 1.5x faster)
                        tempoAdjustment = 1 / marker.ratio;
                    } else if (Math.abs(marker.ratio - (3/2)) < 0.001) {
                        // 3:2 expansion: tempo should decrease (1/ratio = 0.667x slower)
                        tempoAdjustment = 1 / marker.ratio;
                    } else {
                        // Other ratios: use inverted ratio as default
                        tempoAdjustment = 1 / marker.ratio;
                    }
                    
                    currentTempoMultiplier *= tempoAdjustment;
                    const newTempo = baseTempo * currentTempoMultiplier;
                    
                    
                    // Apply the tempo change
                    Tone.Transport.bpm.value = newTempo;
                }
            }
        }
        
        if (finalXPos > 0) {
            ctx.strokeStyle = 'rgba(255,0,0,0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(finalXPos, 0);
            ctx.lineTo(finalXPos, playheadCanvas.height);
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
            const synthEngineDestination = window.synthEngine.getMainVolumeNode && window.synthEngine.getMainVolumeNode();
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
        store.on('modulationMarkersChanged', () => this.handleStateChange());
        
        store.on('tempoChanged', newTempo => {
            logger.event('TransportService', `tempoChanged triggered with new value: ${newTempo} BPM`, null, 'transport');
            
            if (Tone.Transport.state === 'started') {
                logger.info('TransportService', 'Tempo changed WHILE PLAYING. Resynchronizing transport...', null, 'transport');

                const currentPosition = Tone.Transport.position;
                logger.debug('TransportService', `Saved musical position: ${currentPosition}`, null, 'transport');
                
                Tone.Transport.pause();
                logger.debug('TransportService', 'Transport paused', null, 'transport');

                if (playheadAnimationFrame) {
                    cancelAnimationFrame(playheadAnimationFrame);
                    playheadAnimationFrame = null;
                }
                
                Tone.Transport.bpm.value = newTempo;
                logger.debug('TransportService', `New BPM set to ${Tone.Transport.bpm.value}`, null, 'transport');
                
                scheduleNotes();
                
                Tone.Transport.start(undefined, currentPosition);
                logger.debug('TransportService', `Transport restarted at musical position ${currentPosition}`, null, 'transport');
                
                if (!store.state.paint.isMicPaintActive) {
                    animatePlayhead();
                }

            } else {
                logger.debug('TransportService', 'Tempo changed while stopped/paused. Updating BPM for next run', null, 'transport');
                Tone.Transport.bpm.value = newTempo;
                calculateTimeMap();
            }
        });
        
        store.on('loopingChanged', isLooping => Tone.Transport.loop = isLooping);
        
        Tone.Transport.on('stop', () => {
            logger.event('TransportService', "Tone.Transport 'stop' fired. Resetting playback state", null, 'transport');
            store.setPlaybackState(false, false);
            GlobalService.adsrComponent?.playheadManager.clearAll();
             if (playheadAnimationFrame) {
                cancelAnimationFrame(playheadAnimationFrame);
                playheadAnimationFrame = null;
            }
        });

        logger.info('TransportService', 'Initialized', null, 'transport');
    },

    handleStateChange() {
        if (Tone.Transport.state === 'started') {
            logger.debug('TransportService', 'handleStateChange: Notes or rhythm changed during playback. Rescheduling', null, 'transport');
            
            const currentPosition = Tone.Transport.position;
            Tone.Transport.pause();
            scheduleNotes();
            Tone.Transport.start(undefined, currentPosition);

        } else {
            calculateTimeMap();
        }
    },

    start() {
        logger.info('TransportService', 'Starting playback', null, 'transport');
        // Use global audio initialization to ensure user gesture compliance
        const audioInit = window.initAudio || (() => Tone.start());
        audioInit().then(() => {
            scheduleNotes();
            const musicalDuration = timeMap[store.state.columnWidths.length - 2] || 0;
            const anacrusisOffset = timeMap[2] || 0;
            const nonAnacrusisStart = findNonAnacrusisStart();

            // Loop starts at non-anacrusis area (skipping pickup notes on repeats)
            Tone.Transport.loopStart = nonAnacrusisStart;
            Tone.Transport.loopEnd = musicalDuration;
            Tone.Transport.loop = store.state.isLooping;
            Tone.Transport.bpm.value = store.state.tempo;
            
            logger.debug('TransportService', `Transport configured. Loop: ${Tone.Transport.loop}, BPM: ${Tone.Transport.bpm.value}, StartOffset: ${anacrusisOffset}, LoopStart: ${nonAnacrusisStart}`, null, 'transport');
            
            // Log modulation setup
            if (store.state.modulationMarkers && store.state.modulationMarkers.length > 0) {
            }
            
            // Always start from anacrusis (pickup) on first play, but loops will skip anacrusis
            Tone.Transport.start(Tone.now(), anacrusisOffset); 
            
            // Initialize paint playback if enabled
            if (window.PaintPlaybackService && window.PaintPlaybackService.onTransportStart) {
                window.PaintPlaybackService.onTransportStart();
            }
            
            if (store.state.paint.isMicPaintActive) {
                store.emit('playbackStateChanged', { isPlaying: true, isPaused: false });
                logger.debug('TransportService', 'Paint playhead is active, skipping regular playhead animation', null, 'transport');
            } else {
                animatePlayhead();
            }
            
            // Emit playback events for animation service
            store.emit('playbackStarted');
        });
    },

    resume() {
        logger.info('TransportService', 'Resuming playback', null, 'transport');
        // Use global audio initialization to ensure user gesture compliance
        const audioInit = window.initAudio || (() => Tone.start());
        audioInit().then(() => {
            Tone.Transport.start();
            
            // Initialize paint playback if enabled
            if (window.PaintPlaybackService && window.PaintPlaybackService.onTransportStart) {
                window.PaintPlaybackService.onTransportStart();
            }
            
            if (!store.state.paint.isMicPaintActive) {
                animatePlayhead();
            }
            
            // Emit playback events for animation service
            store.emit('playbackResumed');
        });
    },

    pause() {
        logger.info('TransportService', 'Pausing playback', null, 'transport');
        Tone.Transport.pause();
        if (playheadAnimationFrame) {
            cancelAnimationFrame(playheadAnimationFrame);
            playheadAnimationFrame = null;
        }
        
        // Emit playback events for animation service
        store.emit('playbackPaused');
    },

    stop() {
        logger.info('TransportService', 'Stopping playback and clearing visuals', null, 'transport');
        Tone.Transport.stop(); 
        
        // Clear paint playback events if enabled
        if (window.PaintPlaybackService && window.PaintPlaybackService.onTransportStop) {
            window.PaintPlaybackService.onTransportStop();
        }
        
        Tone.Transport.cancel();
        SynthEngine.releaseAll();

        const playheadCanvas = domCache.get('playheadCanvas');
        if (playheadCanvas) {
            const ctx = playheadCanvas.getContext('2d');
            ctx.clearRect(0, 0, playheadCanvas.width, playheadCanvas.height);
        }
        
        if (store.state.paint.isMicPaintActive) {
            store.emit('playbackStateChanged', { isPlaying: false, isPaused: false });
        }
        
        // Emit playback events for animation service
        store.emit('playbackStopped');
    }
};

export default TransportService;