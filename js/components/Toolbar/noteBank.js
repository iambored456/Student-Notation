// js/components/Toolbar/noteBank.js
import store from '../../state/store.js';

console.log("NoteBank: Module loaded.");

export function initNoteBank() {
    const notePairs = document.querySelectorAll('#note-bank-container .note-pair');
    
    if (!notePairs.length) {
        console.error("NoteBank: Could not find any note pair elements.");
        return;
    }

    notePairs.forEach(pair => {
        const color = pair.dataset.color;
        
        pair.querySelectorAll('.note').forEach(note => {
            const type = note.dataset.type;
            
            // Apply the color from the parent pair to the note's border
            note.style.setProperty('--note-color', color);

            // Add the click listener to set the correct tool
            note.addEventListener('click', () => {
                store.setSelectedTool(type, color);
            });
        });
    });

    console.log("NoteBank: Initialized with 2x2 paired layout.");
}