// js/services/spacebarHandler.js
import store from '../state/store.js';
import SynthEngine from './synthEngine.js';

console.log("SpacebarHandler: Module loaded.");

let spacebarPressed = false;
let currentSpacebarNote = null;

function getPitchForNote(note) {
    const rowData = store.state.fullRowData[note.row];
    return rowData ? rowData.toneNote : 'C4';
}

export function initSpacebarHandler() {
    document.addEventListener('keydown', (e) => {
        if (e.code !== 'Space' || spacebarPressed) return;
        
        const activeElement = document.activeElement.tagName.toLowerCase();
        if (['input', 'textarea'].includes(activeElement)) return;
        
        e.preventDefault();
        spacebarPressed = true;

        const lastNote = store.state.placedNotes.length > 0
            ? store.state.placedNotes[store.state.placedNotes.length - 1]
            : null;

        currentSpacebarNote = lastNote && !lastNote.isDrum ? getPitchForNote(lastNote) : 'C4';
        
        // --- FIX: Get the active tool's color and pass it to the synth engine ---
        const activeColor = store.state.selectedTool.color;
        if (activeColor) {
            SynthEngine.triggerAttack(currentSpacebarNote, activeColor);
            console.log(`Spacebar: Attack ${currentSpacebarNote} with color ${activeColor}`);
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code !== 'Space' || !spacebarPressed) return;
        
        e.preventDefault();
        spacebarPressed = false;
        
        if (currentSpacebarNote) {
            // --- FIX: Get the active tool's color for the release as well ---
            const activeColor = store.state.selectedTool.color;
            if (activeColor) {
                SynthEngine.triggerRelease(currentSpacebarNote, activeColor);
            }
            console.log(`Spacebar: Release ${currentSpacebarNote}`);
            currentSpacebarNote = null;
        }
    });
    
    console.log("SpacebarHandler: Initialized.");
}