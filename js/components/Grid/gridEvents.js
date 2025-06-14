// js/components/Grid/gridEvents.js
import store from '../../state/store.js';
import ConfigService from '../../services/configService.js';
import SynthEngine from '../../services/synthEngine.js';

console.log("GridEvents: Module loaded.");

let isDragging = false;
let currentDraggedNote = null;
let isRightClickActive = false; // For eraser mode

function getColumnIndex(x) {
    let cumulative = 0;
    for (let i = 0; i < store.state.columnWidths.length; i++) {
        cumulative += store.state.columnWidths[i] * store.state.cellWidth;
        if (x < cumulative) return i;
    }
    return store.state.columnWidths.length - 1;
}

function getPitchForRow(rowIndex) {
    const fullRowIndex = store.state.gridPosition + rowIndex;
    const rowData = store.state.fullRowData[fullRowIndex];
    return rowData ? rowData.toneNote : null;
}

function handlePitchGridMouseDown(e) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const colIndex = getColumnIndex(x);
    if (colIndex < 2 || colIndex >= store.state.columnWidths.length - 2) return;

    const rowIndex = Math.floor(y / (store.state.cellHeight * 0.5));
    const fullRowIndex = store.state.gridPosition + rowIndex;

    // Right-click or Eraser Tool active
    if (e.button === 2 || store.state.selectedTool.type === 'eraser') {
        e.preventDefault();
        isRightClickActive = true;
        store.eraseNoteAt(colIndex, fullRowIndex);
        return;
    }

    if (e.button === 0) { // Left-click
        const { type, color } = store.state.selectedTool;
        
        const newNote = {
            row: fullRowIndex,
            startColumnIndex: colIndex,
            endColumnIndex: type === 'oval' ? colIndex : colIndex + 1,
            color: color,
            shape: type,
            isDrum: false
        };

        store.addNote(newNote);
        isDragging = (type === 'circle'); // Only allow dragging tails for circle notes
        currentDraggedNote = newNote;
        
        const pitch = getPitchForRow(rowIndex);
        if (pitch) {
            SynthEngine.playNote(pitch, '8n');
        }
    }
}

function handlePitchGridMouseMove(e) {
    if (isRightClickActive) {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const colIndex = getColumnIndex(x);
        const rowIndex = Math.floor(y / (store.state.cellHeight * 0.5));
        const fullRowIndex = store.state.gridPosition + rowIndex;
        store.eraseNoteAt(colIndex, fullRowIndex);
    }
    
    if (isDragging && currentDraggedNote) {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const colIndex = getColumnIndex(x);
        const newEndIndex = Math.max(currentDraggedNote.startColumnIndex, colIndex);
        if (newEndIndex !== currentDraggedNote.endColumnIndex) {
            store.updateNoteTail(currentDraggedNote, newEndIndex);
        }
    }
}

function handleDrumGridMouseDown(e) {
    e.preventDefault();
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const colIndex = getColumnIndex(x);
    if (colIndex < 2 || colIndex >= store.state.columnWidths.length - 2) return;
    
    const pitchRowHeight = 0.5 * store.state.cellHeight;
    const drumRow = Math.floor(y / pitchRowHeight);
    if (drumRow < 0 || drumRow > 2) return;

    const drumTrack = ['H', 'M', 'L'][drumRow];
    
    const drumHit = {
        isDrum: true,
        drumTrack: drumTrack,
        startColumnIndex: colIndex,
        endColumnIndex: colIndex, // Drums are single-column events
        color: '#000',
        shape: drumTrack === 'H' ? 'triangle' : drumTrack === 'M' ? 'square' : 'pentagon'
    };
    
    // Toggle the note on or off
    store.toggleDrumNote(drumHit);
    
    // Play sound on click
    if (window.transportService && window.transportService.drumPlayers) {
        window.transportService.drumPlayers.player(drumTrack).start();
    }
}

export function initGridEvents() {
    const pitchCanvas = document.getElementById('notation-grid');
    const drumCanvas = document.getElementById('drum-grid');

    pitchCanvas.addEventListener('mousedown', handlePitchGridMouseDown);
    pitchCanvas.addEventListener('mousemove', handlePitchGridMouseMove);
    pitchCanvas.addEventListener('contextmenu', e => e.preventDefault());

    drumCanvas.addEventListener('mousedown', handleDrumGridMouseDown);
    drumCanvas.addEventListener('contextmenu', e => e.preventDefault());

    // Stop dragging/erasing when mouse leaves window or button is released
    window.addEventListener('mouseup', () => {
        isDragging = false;
        currentDraggedNote = null;
        isRightClickActive = false;
    });

    console.log("GridEvents: All canvas event listeners attached.");
}