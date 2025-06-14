// js/services/transportService.js
import * as Tone from 'tone';
import store from '../state/store.js';
import ConfigService from './configService.js';
import SynthEngine from './synthEngine.js';

console.log("TransportService: Module loaded.");

let playheadAnimationFrame;
// In-memory representation of drum players for scheduling
let drumPlayers; 

function getMicrobeatDuration() {
    const macrobeatBPM = store.state.tempo;
    const microbeatBPM = macrobeatBPM * 2;
    return 60 / microbeatBPM;
}

function getPitchForNote(note) {
    const rowData = store.state.fullRowData;
    if (rowData && rowData[note.row]) {
        // Normalize pitch to ensure compatibility with Tone.js
        const pitch = rowData[note.row].toneNote;
        return pitch.replace('♭', 'b').replace('♯', '#');
    }
    console.warn(`TransportService: Could not find pitch for note at row ${note.row}. Defaulting to C4.`);
    return 'C4';
}

function scheduleNotes() {
    Tone.Transport.cancel(); // Clear any previous events
    const microbeatDuration = getMicrobeatDuration();

    store.state.placedNotes.forEach(note => {
        if (note.shape === "tonicization") return; // Skip tonicization markers

        const startTime = (note.startColumnIndex - 2) * microbeatDuration;

        if (note.isDrum) {
            Tone.Transport.schedule(time => {
                if (store.state.isPaused) return;
                drumPlayers?.player(note.drumTrack)?.start(time);
            }, startTime);
        } else {
            const duration = (note.endColumnIndex - note.startColumnIndex + 1) * microbeatDuration;
            const pitch = getPitchForNote(note);
            
            Tone.Transport.schedule(time => {
                if (store.state.isPaused) return;
                SynthEngine.triggerAttack(pitch, time);
            }, startTime);

            Tone.Transport.schedule(time => {
                SynthEngine.triggerRelease(pitch, time);
            }, startTime + duration);
        }
    });

    console.log(`TransportService: Scheduled ${store.state.placedNotes.length} notes.`);
}

function animatePlayhead() {
    const playheadCanvas = document.getElementById('playhead-canvas');
    const ctx = playheadCanvas.getContext('2d');

    function draw() {
        if (store.state.isPaused) return; 

        ctx.clearRect(0, 0, playheadCanvas.width, playheadCanvas.height);
        
        let currentTime = Tone.Transport.seconds;
        if (Tone.Transport.loop) {
            const loopDuration = Tone.Transport.loopEnd - Tone.Transport.loopStart;
            if (loopDuration > 0) {
                 currentTime = (Tone.Transport.seconds - Tone.Transport.loopStart) % loopDuration + Tone.Transport.loopStart;
            }
        }

        const microbeatDuration = getMicrobeatDuration();
        const microbeatsElapsed = currentTime / microbeatDuration;
        const offset = ConfigService.getColumnX(2);
        const xPos = microbeatsElapsed * store.state.cellWidth + offset;

        ctx.strokeStyle = 'rgba(255,0,0,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(xPos, 0);
        ctx.lineTo(xPos, playheadCanvas.height);
        ctx.stroke();

        if (Tone.Transport.state === 'started') {
            playheadAnimationFrame = requestAnimationFrame(draw);
        }
    }
    playheadAnimationFrame = requestAnimationFrame(draw);
}

const TransportService = {
    init() {
        // Initialize drum players
        drumPlayers = new Tone.Players({
            H: 'https://tonejs.github.io/audio/drum-samples/CR78/hihat.mp3',
            M: 'https://tonejs.github.io/audio/drum-samples/CR78/snare.mp3',
            L: 'https://tonejs.github.io/audio/drum-samples/CR78/kick.mp3'
        }).toDestination();
        
        // Make drumPlayers accessible for gridEvents to use for click feedback
        window.transportService = { drumPlayers };

        // Listen for changes that require re-scheduling or transport updates
        store.on('notesChanged', () => this.handleStateChange());
        store.on('rhythmChanged', () => this.handleStateChange());
        store.on('tempoChanged', newTempo => Tone.Transport.bpm.value = newTempo * 2);
        store.on('loopingChanged', isLooping => Tone.Transport.loop = isLooping);

        console.log("TransportService: Initialized.");
    },

    handleStateChange() {
        if (store.state.isPlaying && !store.state.isPaused) {
            console.log("TransportService: Live re-scheduling notes due to state change.");
            scheduleNotes();
        }
    },

    start() {
        console.log("TransportService: Starting playback.");
        Tone.start().then(() => {
            const microbeatDuration = getMicrobeatDuration();
            const totalColumns = store.state.columnWidths.length;
            const loopEndTime = (totalColumns - 4) * microbeatDuration; 

            Tone.Transport.loopStart = 0;
            Tone.Transport.loopEnd = loopEndTime;
            Tone.Transport.loop = store.state.isLooping;
            Tone.Transport.bpm.value = store.state.tempo * 2;

            scheduleNotes();
            Tone.Transport.start();
            animatePlayhead();
        });
    },

    pause() {
        console.log("TransportService: Pausing playback.");
        Tone.Transport.pause();
        SynthEngine.releaseAll();
        cancelAnimationFrame(playheadAnimationFrame);
    },

    stop() {
        console.log("TransportService: Stopping playback.");
        Tone.Transport.stop();
        Tone.Transport.cancel();
        SynthEngine.releaseAll();

        cancelAnimationFrame(playheadAnimationFrame);
        const playheadCanvas = document.getElementById('playhead-canvas');
        if (playheadCanvas) {
            const ctx = playheadCanvas.getContext('2d');
            ctx.clearRect(0, 0, playheadCanvas.width, playheadCanvas.height);
        }
    }
};

export default TransportService;