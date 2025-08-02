// js/services/spacebarHandler.js
import store from '../state/index.js'; 
import SynthEngine from './synthEngine.js';
import GlobalService from './globalService.js';

console.log("SpacebarHandler: Module loaded.");

let spacebarPressed = false;
let currentSpacebarNote = null;
let defaultSpacebarNote = 'C4'; // Default note for startup and when no notes are placed

function getPitchForNote(note) {
    const rowData = store.state.fullRowData[note.row];
    return rowData ? rowData.toneNote : defaultSpacebarNote;
}

function updateSpacebarNote() {
    // Find the last placed pitch note (non-drum)
    const lastPitchNote = store.state.placedNotes
        .slice()
        .reverse()
        .find(note => !note.isDrum);
    
    if (lastPitchNote) {
        currentSpacebarNote = getPitchForNote(lastPitchNote);
        console.log(`[SpacebarHandler] Updated spacebar note to: ${currentSpacebarNote} (from last placed note)`);
    } else {
        currentSpacebarNote = defaultSpacebarNote;
        console.log(`[SpacebarHandler] No pitch notes found, using default: ${currentSpacebarNote}`);
    }
}

export function initSpacebarHandler() {
    // Initialize the spacebar note on startup
    updateSpacebarNote();
    
    // Listen for note changes to update the spacebar note
    store.on('notesChanged', updateSpacebarNote);
    
    document.addEventListener('keydown', (e) => {
        if (e.code !== 'Space' || spacebarPressed) return;
        
        const activeElement = document.activeElement.tagName.toLowerCase();
        if (['input', 'textarea'].includes(activeElement)) return;
        
        e.preventDefault();
        spacebarPressed = true;

        // Ensure we have the most current spacebar note
        if (!currentSpacebarNote) {
            updateSpacebarNote();
        }

        console.log(`[SpacebarHandler] Spacebar pressed - playing: ${currentSpacebarNote}`);
        
        const toolColor = store.state.selectedNote.color;
        if (toolColor && currentSpacebarNote) {
            SynthEngine.triggerAttack(currentSpacebarNote, toolColor);

            // Find the pitch color for the playhead
            const rowData = store.state.fullRowData.find(row => row.toneNote === currentSpacebarNote);
            const pitchColor = rowData ? rowData.hex : '#888888';
            const adsr = store.state.timbres[toolColor].adsr;

            // Trigger the visual playhead for the spacebar
            GlobalService.adsrComponent?.playheadManager.trigger('spacebar', 'attack', pitchColor, adsr);
            
            // NEW: Emit event for waveform visualizer
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
                SynthEngine.triggerRelease(currentSpacebarNote, toolColor);

                // Find the pitch color for the playhead
                const rowData = store.state.fullRowData.find(row => row.toneNote === currentSpacebarNote);
                const pitchColor = rowData ? rowData.hex : '#888888';
                const adsr = store.state.timbres[toolColor].adsr;

                 // Trigger the release of the visual playhead
                GlobalService.adsrComponent?.playheadManager.trigger('spacebar', 'release', pitchColor, adsr);
                
                // NEW: Emit event for waveform visualizer
                store.emit('spacebarPlayback', { 
                    note: currentSpacebarNote, 
                    color: toolColor, 
                    isPlaying: false 
                });
            }
            console.log(`[SpacebarHandler] Spacebar released - stopping: ${currentSpacebarNote}`);
        }
    });
    
    console.log("SpacebarHandler: Initialized with default note:", defaultSpacebarNote);
}

// Export function to manually set the default spacebar note (useful for testing or configuration)
export function setDefaultSpacebarNote(note) {
    defaultSpacebarNote = note;
    if (store.state.placedNotes.length === 0) {
        currentSpacebarNote = defaultSpacebarNote;
        console.log(`[SpacebarHandler] Default spacebar note changed to: ${defaultSpacebarNote}`);
    }
}