// js/services/spacebarHandler.js
import store from '../state/store.js';
import SynthEngine from './synthEngine.js';
import GlobalService from './globalService.js';

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
        
        const toolColor = store.state.selectedTool.color;
        if (toolColor) {
            SynthEngine.triggerAttack(currentSpacebarNote, toolColor);

            // Find the pitch color for the playhead
            const rowData = store.state.fullRowData.find(row => row.toneNote === currentSpacebarNote);
            const pitchColor = rowData ? rowData.hex : '#888888';

            // Trigger the visual playhead for the spacebar
            GlobalService.adsrComponent?.playheadManager.trigger('spacebar', 'attack', pitchColor);
            console.log(`Spacebar: Attack ${currentSpacebarNote} with color ${toolColor}`);
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code !== 'Space' || !spacebarPressed) return;
        
        e.preventDefault();
        spacebarPressed = false;
        
        if (currentSpacebarNote) {
            const toolColor = store.state.selectedTool.color;
            if (toolColor) {
                SynthEngine.triggerRelease(currentSpacebarNote, toolColor);

                // Find the pitch color for the playhead
                const rowData = store.state.fullRowData.find(row => row.toneNote === currentSpacebarNote);
                const pitchColor = rowData ? rowData.hex : '#888888';

                 // Trigger the release of the visual playhead
                GlobalService.adsrComponent?.playheadManager.trigger('spacebar', 'release', pitchColor);
            }
            console.log(`Spacebar: Release ${currentSpacebarNote}`);
            currentSpacebarNote = null;
        }
    });
    
    console.log("SpacebarHandler: Initialized.");
}