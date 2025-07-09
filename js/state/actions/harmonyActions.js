// js/state/actions/harmonyActions.js
import { buildNotes } from '../../harmony/utils/build-notes.js';

function generateUUID() {
    return `uuid-chord-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const harmonyActions = {
    /**
     * Adds a new chord to the state.
     * @param {object} chordData - The initial data for the chord, minus id and notes.
     */
    addChord(chordData) {
        const newChord = {
            ...chordData,
            id: generateUUID(),
        };
        this.state.placedChords.push(newChord);
        this.emit('chordsChanged', { newChord });
        // Set the newly created chord as active
        this.setActiveChord(newChord.id);
        this.recordState();
        return newChord;
    },

    /**
     * Updates an existing chord in the state.
     * @param {string} chordId - The ID of the chord to update.
     * @param {object} updates - An object containing the properties to change.
     */
    updateChord(chordId, updates) {
        const chord = this.state.placedChords.find(c => c.id === chordId);
        if (chord) {
            Object.assign(chord, updates);
            
            // After updating properties, regenerate the notes array.
            chord.notes = buildNotes(chord, this.state.keySignature);
            
            this.emit('chordsChanged', { updatedChordId: chordId });
        }
    },

    /**
     * Deletes a chord from the state.
     * @param {string} chordId - The ID of the chord to delete.
     */
    deleteChord(chordId) {
        this.state.placedChords = this.state.placedChords.filter(c => c.id !== chordId);
        if (this.state.activeChordId === chordId) {
            this.setActiveChord(null);
        }
        this.emit('chordsChanged');
        this.recordState();
    },

    /**
     * Sets the currently active/selected chord for editing.
     * @param {string | null} chordId - The ID of the chord to select, or null to deselect.
     */
    setActiveChord(chordId) {
        if (this.state.activeChordId !== chordId) {
            this.state.activeChordId = chordId;
            this.emit('activeChordChanged', chordId);
            // Don't record history for selection changes
        }
    },

    /**
     * Sets the analysis region.
     * @param {{startBeat: number, length: number}} newRegion 
     */
    setRegionContext(newRegion) {
        if (this.state.regionContext.startBeat !== newRegion.startBeat || this.state.regionContext.length !== newRegion.length) {
            this.state.regionContext = newRegion;
            this.emit('regionContextChanged', newRegion);
        }
    },

    /**
     * Loops through all placed chords and rebuilds their note arrays based on a new key.
     * @param {string} newKey - The new key signature tonic.
     */
    rebuildAllChords(newKey) {
        this.state.placedChords.forEach(chord => {
            chord.notes = buildNotes(chord, newKey);
        });
        this.emit('chordsChanged', { reason: 'keyChange' });
        this.recordState();
    }
};