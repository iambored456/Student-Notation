// js/services/transportService.js
import * as Tone from 'tone';
import store from '../state/index.js';
import { getPlacedTonicSigns, getMacrobeatInfo } from '../state/selectors.js';
import LayoutService from './layoutService.js';
import SynthEngine from './synthEngine.js';
import GlobalService from './globalService.js';
import domCache from './domCache.js';
import logger from '../utils/logger.js';

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
    let currentTime = 0;
    const microbeatDuration = getMicrobeatDuration();
    const { columnWidths } = store.state;
    const placedTonicSigns = getPlacedTonicSigns(store.state);

    for (let i = 0; i < columnWidths.length; i++) {
        timeMap[i] = currentTime;
        const isTonicColumn = placedTonicSigns.some(ts => ts.columnIndex === i);
        if (!isTonicColumn) {
            currentTime += columnWidths[i] * microbeatDuration;
        }
    }
    timeMap.push(currentTime); 
    logger.timing('transportService', 'calculateTimeMap', { totalDuration: `${currentTime.toFixed(2)}s` });
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

    store.state.placedNotes.forEach(note => {
        const startTime = timeMap[note.startColumnIndex];
        if (startTime === undefined) return;

        // Skip notes that would be scheduled before the anacrusis offset (loop start)
        if (startTime < anacrusisOffset) {
            logger.debug('transportService', `Skipping note at column ${note.startColumnIndex} (time ${startTime}) - before anacrusis offset (${anacrusisOffset})`);
            return;
        }

        // Calculate duration based on note shape
        let duration;
        if (note.shape === 'circle') {
            // Circle notes get 2 microbeats duration
            const microbeatDuration = getMicrobeatDuration();
            duration = 2 * microbeatDuration;
        } else {
            // Oval notes and others use the current duration (1 microbeat equivalent)
            const endTime = timeMap[note.endColumnIndex + 1];
            duration = endTime - startTime;
        }

        if (note.isDrum) {
            Tone.Transport.schedule(time => {
                if (store.state.isPaused) return;
                drumPlayers?.player(note.drumTrack)?.start(time);
            }, startTime);
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
            
            Tone.Transport.schedule(time => {
                if (store.state.isPaused) return;
                SynthEngine.triggerAttack(pitch, toolColor, time);
                GlobalService.adsrComponent?.playheadManager.trigger(noteId, 'attack', pitchColor, timbre.adsr);
            }, startTime);

            Tone.Transport.schedule(time => {
                SynthEngine.triggerRelease(pitch, toolColor, time);
                GlobalService.adsrComponent?.playheadManager.trigger(noteId, 'release', pitchColor, timbre.adsr);
            }, startTime + duration);
        }
    });
     logger.debug('TransportService', 'scheduleNotes', 'Finished scheduling', 'audio');
}

function animatePlayhead() {
    const playheadCanvas = domCache.get('playheadCanvas');
    if (!playheadCanvas) return;
    const ctx = playheadCanvas.getContext('2d');
    const maxXPos = LayoutService.getColumnX(store.state.columnWidths.length - 2);
    const musicalDuration = timeMap[store.state.columnWidths.length - 2] || 0;

    function draw() {
        if (Tone.Transport.state !== 'started' || !playheadCanvas) {
            return; 
        }

        const isLooping = store.state.isLooping;
        const currentTime = Tone.Transport.seconds;
        
        // NEW LOGS FOR DEBUGGING THE STOP ISSUE
        logger.timing('TransportService', 'stop condition check', { currentTime, musicalDuration, isLooping }, 'transport');
        
        if (!isLooping && currentTime >= musicalDuration) {
            logger.error('TransportService', 'Playback reached end. Forcing stop', null, 'transport');
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
                
                const colStartX = LayoutService.getColumnX(i);
                const colWidth = LayoutService.getColumnX(i + 1) - colStartX;
                
                const ratio = colDuration > 0 ? timeIntoCol / colDuration : 0;
                xPos = colStartX + ratio * colWidth;
                break;
            }
        }
        
        const finalXPos = Math.min(xPos, maxXPos);
        
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
        drumPlayers = new Tone.Players({
            H: 'https://tonejs.github.io/audio/drum-samples/CR78/hihat.mp3',
            M: 'https://tonejs.github.io/audio/drum-samples/CR78/snare.mp3',
            L: 'https://tonejs.github.io/audio/drum-samples/CR78/kick.mp3'
        }).toDestination();
        
        window.transportService = { drumPlayers };
        
        Tone.Transport.bpm.value = store.state.tempo;

        store.on('rhythmStructureChanged', () => this.handleStateChange());
        store.on('notesChanged', () => this.handleStateChange());
        
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
        Tone.start().then(() => {
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
            
            // Always start from anacrusis (pickup) on first play, but loops will skip anacrusis
            Tone.Transport.start(Tone.now(), anacrusisOffset); 
            
            if (store.state.paint.isMicPaintActive) {
                store.emit('playbackStateChanged', { isPlaying: true, isPaused: false });
                logger.debug('TransportService', 'Paint playhead is active, skipping regular playhead animation', null, 'transport');
            } else {
                animatePlayhead();
            }
        });
    },

    resume() {
        logger.info('TransportService', 'Resuming playback', null, 'transport');
        Tone.start().then(() => {
            Tone.Transport.start();
            if (!store.state.paint.isMicPaintActive) {
                animatePlayhead();
            }
        });
    },

    pause() {
        logger.info('TransportService', 'Pausing playback', null, 'transport');
        Tone.Transport.pause();
        if (playheadAnimationFrame) {
            cancelAnimationFrame(playheadAnimationFrame);
            playheadAnimationFrame = null;
        }
    },

    stop() {
        logger.info('TransportService', 'Stopping playback and clearing visuals', null, 'transport');
        Tone.Transport.stop(); 
        
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
    }
};

export default TransportService;