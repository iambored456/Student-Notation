// js/services/transportService.js
import * as Tone from 'tone';
import store from '../state/store.js';
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
    timeMap = [];
    let currentTime = 0;
    const microbeatDuration = getMicrobeatDuration();
    const { columnWidths } = store.state;
    const placedTonicSigns = store.placedTonicSigns;
    
    for (let i = 0; i < columnWidths.length; i++) {
        timeMap[i] = currentTime;
        const isTonicColumn = placedTonicSigns.some(ts => ts.columnIndex === i);
        if (!isTonicColumn) {
            currentTime += columnWidths[i] * microbeatDuration;
        }
    }
    timeMap.push(currentTime); 
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
            const toolColor = note.color; // The color for the synth voice
            const pitchColor = store.state.fullRowData[note.row]?.hex || '#888888'; // The color for the playhead
            const noteId = note.uuid;
            
            Tone.Transport.schedule(time => {
                if (store.state.isPaused) return;
                SynthEngine.triggerAttack(pitch, toolColor, time);
                GlobalService.adsrComponent?.playheadManager.trigger(noteId, 'attack', pitchColor);
            }, startTime);

            Tone.Transport.schedule(time => {
                SynthEngine.triggerRelease(pitch, toolColor, time);
                GlobalService.adsrComponent?.playheadManager.trigger(noteId, 'release', pitchColor);
            }, startTime + duration);
        }
    });
}

function animatePlayhead() {
    const playheadCanvas = document.getElementById('playhead-canvas');
    const ctx = playheadCanvas.getContext('2d');

    function draw() {
        if (store.state.isPaused) {
            playheadAnimationFrame = requestAnimationFrame(draw);
            return;
        }; 
        ctx.clearRect(0, 0, playheadCanvas.width, playheadCanvas.height);
        
        let currentTime = Tone.Transport.seconds;
        if (Tone.Transport.loop) {
            const loopDuration = Tone.Transport.loopEnd - Tone.Transport.loopStart;
            if (loopDuration > 0) {
                 currentTime = (Tone.Transport.seconds - Tone.Transport.loopStart) % loopDuration + Tone.Transport.loopStart;
            }
        }

        let xPos = 0;
        for (let i = 0; i < timeMap.length - 1; i++) {
            if (timeMap[i] === undefined) continue; 

            if (currentTime >= timeMap[i] && currentTime < timeMap[i+1]) {
                const colStartTime = timeMap[i];
                const colEndTime = timeMap[i+1];
                const colDuration = colEndTime - colStartTime;
                const timeIntoCol = currentTime - colStartTime;
                
                const colStartX = LayoutService.getColumnX(i);
                const colWidth = LayoutService.getColumnX(i + 1) - colStartX;
                
                const ratio = colDuration > 0 ? timeIntoCol / colDuration : 0;
                xPos = colStartX + ratio * colWidth;
                break;
            }
        }
        
        if (xPos > 0) {
            ctx.strokeStyle = 'rgba(255,0,0,0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(xPos, 0);
            ctx.lineTo(xPos, playheadCanvas.height);
            ctx.stroke();
        }

        if (Tone.Transport.state === 'started') {
            playheadAnimationFrame = requestAnimationFrame(draw);
        }
    }
    playheadAnimationFrame = requestAnimationFrame(draw);
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
        store.on('tempoChanged', newTempo => Tone.Transport.bpm.value = newTempo);
        store.on('loopingChanged', isLooping => Tone.Transport.loop = isLooping);

        console.log("TransportService: Initialized.");
    },

    handleStateChange() {
        if (store.state.isPlaying && !store.state.isPaused) {
            scheduleNotes();
        } else {
            calculateTimeMap();
        }
    },

    start() {
        Tone.start().then(() => {
            scheduleNotes();
            const totalDuration = timeMap[timeMap.length - 1];
            const anacrusisOffset = timeMap[2] || 0;

            Tone.Transport.loopStart = anacrusisOffset;
            Tone.Transport.loopEnd = totalDuration;
            Tone.Transport.loop = store.state.isLooping;
            Tone.Transport.bpm.value = store.state.tempo;
            Tone.Transport.start(Tone.now(), anacrusisOffset); 
            
            animatePlayhead();
        });
    },

    pause() {
        Tone.Transport.pause();
        SynthEngine.releaseAll();
        if (playheadAnimationFrame) cancelAnimationFrame(playheadAnimationFrame);
    },

    stop() {
        Tone.Transport.stop();
        Tone.Transport.cancel();
        SynthEngine.releaseAll();

        if (playheadAnimationFrame) cancelAnimationFrame(playheadAnimationFrame);
        const playheadCanvas = document.getElementById('playhead-canvas');
        if (playheadCanvas) {
            const ctx = playheadCanvas.getContext('2d');
            ctx.clearRect(0, 0, playheadCanvas.width, playheadCanvas.height);
        }
    }
};

export default TransportService;