// js/components/Toolbar/noteBank.js
import store from '../../state/store.js';

console.log("NoteBank: Module loaded.");

// Data for the notes to be created.
const NOTE_DATA = [
    { type: 'circle', color: '#000000', label: 'Black Circle Note' },
    { type: 'oval',   color: '#000000', label: 'Black Oval Note' },
    { type: 'circle', color: '#ff0000', label: 'Red Circle Note' },
    { type: 'oval',   color: '#ff0000', label: 'Red Oval Note' },
    { type: 'circle', color: '#0000ff', label: 'Blue Circle Note' },
    { type: 'oval',   color: '#0000ff', label: 'Blue Oval Note' },
    { type: 'circle', color: '#00ff00', label: 'Green Circle Note' },
    { type: 'oval',   color: '#00ff00', label: 'Green Oval Note' }
];

export function initNoteBank() {
    const container = document.querySelector('.note-bank-container');
    const template = document.getElementById('note-template');
    const eraser = document.getElementById('eraser-tool'); // The eraser is next to the notes

    if (!container || !template) {
        console.error("NoteBank: Could not find container or template element.");
        return;
    }

    // Create and insert a note for each item in our data array
    NOTE_DATA.forEach(noteInfo => {
        const clone = template.content.firstElementChild.cloneNode(true);

        // Set data attributes for logic
        clone.dataset.color = noteInfo.color;
        clone.dataset.type = noteInfo.type;
        
        // Add specific classes for styling
        clone.classList.add(`${noteInfo.type}-note`);

        // Set inline style for the color variable (used by style.css)
        clone.style.setProperty('--note-color', noteInfo.color);
        
        // Accessibility
        clone.setAttribute('aria-label', noteInfo.label);

        // Add event listener to select the tool on click
        clone.addEventListener('click', () => {
            store.setSelectedTool(noteInfo.type, noteInfo.color);
        });

        // Insert the new note into the container, before the eraser tool
        container.insertBefore(clone, eraser);
    });

    console.log("NoteBank: Initialized and populated from template.");
}