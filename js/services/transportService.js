// js/services/transportService.js
import * as Tone from 'tone';
import store from '../state/index.js';
import { getPlacedTonicSigns } from '../state/selectors.js';
import LayoutService from './layoutService.js';
import SynthEngine from './synthEngine.js';
import GlobalService from './globalService.js';

console.log("TransportService: Module loaded.");

let playheadAnimationFrame;
let drumPlayers;
let timeMap = [];

function getMicrobeatDuration() {
    const tempo = store.state.tempo;
    const microbeatBPM = tempo * 2; 
    return 60 / microbeatBPM;
}

function calculateTimeMap() {
    console.log(`[transportService] calculateTimeMap: Recalculating with tempo ${store.state.tempo} BPM.`);
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
    console.log(`[transportService] calculateTimeMap: New total duration is ${currentTime.toFixed(2)} seconds.`);
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
    console.log("[transportService] scheduleNotes: Clearing previous transport events and rescheduling all notes.");
    Tone.Transport.cancel();
    calculateTimeMap();
    GlobalService.adsrComponent?.playheadManager.clearAll();

    store.state.placedNotes.forEach(note => {
        const startTime = timeMap[note.startColumnIndex];
        if (startTime === undefined) return;

        const endTime = timeMap[note.endColumnIndex + 1];
        const duration = endTime - startTime;

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
                console.warn(`[transportService] Timbre not found for color ${toolColor}. Skipping note ${noteId}.`);
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
     console.log("[transportService] scheduleNotes: Finished scheduling.");
}

function animatePlayhead() {
    const playheadCanvas = document.getElementById('playhead-canvas');
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
        console.log(`[animatePlayhead] Checking stop condition: currentTime=${currentTime.toFixed(3)}, musicalDuration=${musicalDuration.toFixed(3)}, isLooping=${isLooping}`);
        
        if (!isLooping && currentTime >= musicalDuration) {
            console.error(`[animatePlayhead] Playback reached end. Forcing stop.`);
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
            console.log(`[transportService] EVENT: tempoChanged triggered with new value: ${newTempo} BPM`);
            
            if (Tone.Transport.state === 'started') {
                console.log("[transportService] Tempo changed WHILE PLAYING. Resynchronizing transport...");

                const currentPosition = Tone.Transport.position;
                console.log(`[transportService]   - Saved musical position: ${currentPosition}`);
                
                Tone.Transport.pause();
                console.log("[transportService]   - Transport paused.");

                if (playheadAnimationFrame) {
                    cancelAnimationFrame(playheadAnimationFrame);
                    playheadAnimationFrame = null;
                }
                
                Tone.Transport.bpm.value = newTempo;
                console.log(`[transportService]   - New BPM set to ${Tone.Transport.bpm.value}.`);
                
                scheduleNotes();
                
                Tone.Transport.start(undefined, currentPosition);
                console.log(`[transportService]   - Transport restarted at musical position ${currentPosition}.`);
                
                if (!store.state.paint.isMicPaintActive) {
                    animatePlayhead();
                }

            } else {
                console.log("[transportService] Tempo changed while stopped/paused. Updating BPM for next run.");
                Tone.Transport.bpm.value = newTempo;
                calculateTimeMap();
            }
        });
        
        store.on('loopingChanged', isLooping => Tone.Transport.loop = isLooping);
        
        Tone.Transport.on('stop', () => {
            console.log("[transportService] EVENT: Tone.Transport 'stop' fired. Resetting playback state.");
            store.setPlaybackState(false, false);
            GlobalService.adsrComponent?.playheadManager.clearAll();
             if (playheadAnimationFrame) {
                cancelAnimationFrame(playheadAnimationFrame);
                playheadAnimationFrame = null;
            }
        });

        console.log("TransportService: Initialized.");
    },

    handleStateChange() {
        if (Tone.Transport.state === 'started') {
            console.log("[transportService] handleStateChange: Notes or rhythm changed during playback. Rescheduling.");
            
            const currentPosition = Tone.Transport.position;
            Tone.Transport.pause();
            scheduleNotes();
            Tone.Transport.start(undefined, currentPosition);

        } else {
            calculateTimeMap();
        }
    },

    start() {
        console.log("[transportService] start: Starting playback.");
        Tone.start().then(() => {
            scheduleNotes();
            const totalDuration = timeMap[timeMap.length - 1];
            const anacrusisOffset = timeMap[2] || 0;

            Tone.Transport.loopStart = anacrusisOffset;
            Tone.Transport.loopEnd = totalDuration;
            Tone.Transport.loop = store.state.isLooping;
            Tone.Transport.bpm.value = store.state.tempo;
            
            console.log(`[transportService] start: Transport configured. Loop: ${Tone.Transport.loop}, BPM: ${Tone.Transport.bpm.value}, StartOffset: ${anacrusisOffset}`);
            Tone.Transport.start(Tone.now(), anacrusisOffset); 
            
            if (store.state.paint.isMicPaintActive) {
                store.emit('playbackStateChanged', { isPlaying: true, isPaused: false });
                console.log("[transportService] Paint playhead is active, skipping regular playhead animation.");
            } else {
                animatePlayhead();
            }
        });
    },

    resume() {
        console.log("[transportService] resume: Resuming playback.");
        Tone.start().then(() => {
            Tone.Transport.start();
            if (!store.state.paint.isMicPaintActive) {
                animatePlayhead();
            }
        });
    },

    pause() {
        console.log("[transportService] pause: Pausing playback.");
        Tone.Transport.pause();
        if (playheadAnimationFrame) {
            cancelAnimationFrame(playheadAnimationFrame);
            playheadAnimationFrame = null;
        }
    },

    stop() {
        console.log("[transportService] stop: Stopping playback and clearing visuals.");
        Tone.Transport.stop(); 
        
        Tone.Transport.cancel();
        SynthEngine.releaseAll();

        const playheadCanvas = document.getElementById('playhead-canvas');
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