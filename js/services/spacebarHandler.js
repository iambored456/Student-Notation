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
        
        SynthEngine.triggerAttack(currentSpacebarNote);
        console.log(`Spacebar: Attack ${currentSpacebarNote}`);
    });

    document.addEventListener('keyup', (e) => {
        if (e.code !== 'Space' || !spacebarPressed) return;
        
        e.preventDefault();
        spacebarPressed = false;
        
        if (currentSpacebarNote) {
            SynthEngine.triggerRelease(currentSpacebarNote);
            console.log(`Spacebar: Release ${currentSpacebarNote}`);
            currentSpacebarNote = null;
        }
    });
    
    console.log("SpacebarHandler: Initialized.");
}