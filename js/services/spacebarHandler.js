// js/services/spacebarHandler.js
import store from '@state/index.js'; 
import SynthEngine from './synthEngine.js';
import GlobalService from './globalService.js';
import { Note } from 'tonal'; 


let spacebarPressed = false;
let currentSpacebarNote = 'C4';
let ghostNotePosition = null; // { col, row } when cursor is on pitchGrid
let triggeredNotes = []; // Store the actual notes that were triggered on keydown

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

        const activeElement = document.activeElement;
        const tagName = activeElement.tagName.toLowerCase();
        const isEditable = activeElement.contentEditable === 'true';
        if (['input', 'textarea'].includes(tagName) || isEditable) return;
        
        e.preventDefault();
        spacebarPressed = true;

        const toolColor = store.state.selectedNote?.color;

        // Determine which note(s) to play based on cursor position
        let noteToPlay, pitchesToPlay = [];

        if (ghostNotePosition && toolColor) {
            // Case 1: Cursor is on pitchGrid - use ghost note position
            const rowData = store.state.fullRowData[ghostNotePosition.row];
            noteToPlay = rowData ? rowData.toneNote : currentSpacebarNote;
            
            const toolType = store.state.selectedTool;
            if (toolType === 'chord') {
                pitchesToPlay = getChordNotesFromIntervals(noteToPlay);
            } else {
                pitchesToPlay = [noteToPlay];
            }
        } else if (toolColor && currentSpacebarNote) {
            // Case 2: Cursor is off pitchGrid - use current spacebar note (original behavior)
            noteToPlay = currentSpacebarNote;
            const toolType = store.state.selectedTool;
            
            if (toolType === 'chord') {
                pitchesToPlay = getChordNotesFromIntervals(currentSpacebarNote);
            } else {
                pitchesToPlay = [currentSpacebarNote];
            }
        }

        if (pitchesToPlay.length > 0) {
            // Store the triggered notes and metadata for proper release
            triggeredNotes = {
                pitches: [...pitchesToPlay],
                rootNote: noteToPlay,
                color: toolColor
            };

            pitchesToPlay.forEach(pitch => {
                SynthEngine.triggerAttack(pitch, toolColor);
            });

            // ADSR and waveform visualizer will still use the root note for simplicity
            const rowData = store.state.fullRowData.find(row => row.toneNote === noteToPlay);
            const pitchColor = rowData ? rowData.hex : '#888888';
            const adsr = store.state.timbres[toolColor].adsr;

            GlobalService.adsrComponent?.playheadManager.trigger('spacebar', 'attack', pitchColor, adsr);
            store.emit('spacebarPlayback', {
                note: noteToPlay,
                color: toolColor,
                isPlaying: true
            });

            // Emit noteAttack for animation service to track
            const noteId = `spacebar-${Date.now()}`;
            store.emit('noteAttack', { noteId, color: toolColor });

            // Store noteId for release
            triggeredNotes.noteId = noteId;
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code !== 'Space' || !spacebarPressed) return;
        
        e.preventDefault();
        spacebarPressed = false;
        
        // Release the exact notes that were triggered on keydown
        if (triggeredNotes.pitches && triggeredNotes.pitches.length > 0) {
            triggeredNotes.pitches.forEach(pitch => {
                SynthEngine.triggerRelease(pitch, triggeredNotes.color);
            });

            const rowData = store.state.fullRowData.find(row => row.toneNote === triggeredNotes.rootNote);
            const pitchColor = rowData ? rowData.hex : '#888888';
            const adsr = store.state.timbres[triggeredNotes.color].adsr;

            GlobalService.adsrComponent?.playheadManager.trigger('spacebar', 'release', pitchColor, adsr);
            store.emit('spacebarPlayback', {
                note: triggeredNotes.rootNote,
                color: triggeredNotes.color,
                isPlaying: false
            });

            // Emit noteRelease for animation service
            if (triggeredNotes.noteId) {
                store.emit('noteRelease', { noteId: triggeredNotes.noteId, color: triggeredNotes.color });
            }

            // Clear triggered notes
            triggeredNotes = [];
        }
    });
    
}

export function setDefaultSpacebarNote(note) {
    currentSpacebarNote = note;
}

export function setGhostNotePosition(col, row) {
    ghostNotePosition = { col, row };

    // Emit event for animation service if we have a ghost note and tool color
    const toolColor = store.state.selectedNote?.color;
    if (toolColor) {
        store.emit('ghostNoteUpdated', { color: toolColor });
    }
}

export function clearGhostNotePosition() {
    ghostNotePosition = null;
    
    // Emit event for animation service
    store.emit('ghostNoteCleared');
}