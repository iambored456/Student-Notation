// js/services/spacebarHandler.js
import store from '../state/index.js'; 
import SynthEngine from './synthEngine.js';
import GlobalService from './globalService.js';
import { Note } from 'tonal'; // NEW: Import Tonal for chord calculations

console.log("SpacebarHandler: Module loaded.");

let spacebarPressed = false;
let currentSpacebarNote = 'C4';

function getPitchForNote(note) {
    const rowData = store.state.fullRowData[note.row];
    return rowData ? rowData.toneNote : 'C4';
}

function updateSpacebarNote() {
    const lastPitchNote = store.state.placedNotes
        .slice()
        .reverse()
        .find(note => !note.isDrum);
    
    currentSpacebarNote = lastPitchNote ? getPitchForNote(lastPitchNote) : 'C4';
}

// NEW: Helper function to get chord notes based on the current active chord shape
function getChordNotesFromIntervals(rootNote) {
    const { activeChordIntervals } = store.state;
    if (!rootNote || !activeChordIntervals || !activeChordIntervals.length) return [];
    
    return activeChordIntervals.map(interval => {
        const transposedNote = Note.transpose(rootNote, interval);
        return Note.simplify(transposedNote);
    });
}

export function initSpacebarHandler() {
    updateSpacebarNote();
    store.on('notesChanged', updateSpacebarNote);
    
    document.addEventListener('keydown', (e) => {
        if (e.code !== 'Space' || spacebarPressed) return;
        
        const activeElement = document.activeElement.tagName.toLowerCase();
        if (['input', 'textarea'].includes(activeElement)) return;
        
        e.preventDefault();
        spacebarPressed = true;

        const toolColor = store.state.selectedNote.color;
        if (toolColor && currentSpacebarNote) {
            const toolType = store.state.selectedTool;
            let pitchesToPlay = [];

            // If chord tool is active, get all chord notes
            if (toolType === 'chord') {
                pitchesToPlay = getChordNotesFromIntervals(currentSpacebarNote);
            }
            
            // Fallback to single note for other tools or if chord generation fails
            if (pitchesToPlay.length === 0) {
                pitchesToPlay = [currentSpacebarNote];
            }

            pitchesToPlay.forEach(pitch => {
                SynthEngine.triggerAttack(pitch, toolColor);
            });

            // ADSR and waveform visualizer will still use the root note for simplicity
            const rowData = store.state.fullRowData.find(row => row.toneNote === currentSpacebarNote);
            const pitchColor = rowData ? rowData.hex : '#888888';
            const adsr = store.state.timbres[toolColor].adsr;

            GlobalService.adsrComponent?.playheadManager.trigger('spacebar', 'attack', pitchColor, adsr);
            store.emit('spacebarPlayback', { 
                note: currentSpacebarNote, 
                color: toolColor, 
                isPlaying: true 
            });
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code !== 'Space' || !spacebarPressed) return;
        
        e.preventDefault();
        spacebarPressed = false;
        
        if (currentSpacebarNote) {
            const toolColor = store.state.selectedNote.color;
            if (toolColor) {
                const toolType = store.state.selectedTool;
                let pitchesToRelease = [];

                if (toolType === 'chord') {
                    pitchesToRelease = getChordNotesFromIntervals(currentSpacebarNote);
                }
                if (pitchesToRelease.length === 0) {
                    pitchesToRelease = [currentSpacebarNote];
                }

                pitchesToRelease.forEach(pitch => {
                    SynthEngine.triggerRelease(pitch, toolColor);
                });
                
                const rowData = store.state.fullRowData.find(row => row.toneNote === currentSpacebarNote);
                const pitchColor = rowData ? rowData.hex : '#888888';
                const adsr = store.state.timbres[toolColor].adsr;

                GlobalService.adsrComponent?.playheadManager.trigger('spacebar', 'release', pitchColor, adsr);
                store.emit('spacebarPlayback', { 
                    note: currentSpacebarNote, 
                    color: toolColor, 
                    isPlaying: false 
                });
            }
        }
    });
    
    console.log("SpacebarHandler: Initialized with default note:", currentSpacebarNote);
}

export function setDefaultSpacebarNote(note) {
    currentSpacebarNote = note;
}