// js/state/actions/rhythmActions.js
import { ANACRUSIS_ON_GROUPINGS, ANACRUSIS_ON_STYLES, ANACRUSIS_OFF_GROUPINGS, ANACRUSIS_OFF_STYLES } from '../initialState/rhythm.js';

export const rhythmActions = {
    setAnacrusis(enabled) {
        if (this.state.hasAnacrusis === enabled) return;
        
        this.state.hasAnacrusis = enabled;
        if (enabled) {
            this.state.macrobeatGroupings = [...ANACRUSIS_ON_GROUPINGS];
            this.state.macrobeatBoundaryStyles = [...ANACRUSIS_ON_STYLES];
        } else {
            this.state.macrobeatGroupings = [...ANACRUSIS_OFF_GROUPINGS];
            this.state.macrobeatBoundaryStyles = [...ANACRUSIS_OFF_STYLES];
        }

        this.emit('anacrusisChanged', enabled);
        this.emit('rhythmStructureChanged');
        this.recordState();
    },

    /**
     * Toggles a macrobeat's grouping between 2 and 3 and intelligently transposes all
     * subsequent notes and tonic signs to keep them aligned with their musical position.
     * @param {number} index - The index of the macrobeat grouping to toggle.
     */
    toggleMacrobeatGrouping(index) {
        if (index === undefined || index < 0 || index >= this.state.macrobeatGroupings.length) {
            console.error(`[Store] Invalid index for toggleMacrobeatGrouping: ${index}`);
            return;
        }

        // --- 1. Determine the change and the boundary ---
        const currentValue = this.state.macrobeatGroupings[index];
        const newValue = currentValue === 2 ? 3 : 2;
        const delta = newValue - currentValue; // This will be +1 or -1

        // Calculate the absolute column index that marks the end of the macrobeat being changed.
        // This requires accounting for legends, all previous macrobeats, and any tonic signs.
        let boundaryColumnIndex = 2; // Start after the two left legend columns
        const placedTonicSigns = Object.values(this.state.tonicSignGroups).flat();
        
        // Find the number of unique tonic sign groups placed before the macrobeat we're changing
        const uniqueTonicGroupsBeforeBoundary = new Set(
            placedTonicSigns.filter(ts => ts.preMacrobeatIndex < index).map(ts => ts.uuid)
        ).size;
        
        boundaryColumnIndex += uniqueTonicGroupsBeforeBoundary;

        // Add the columns for all macrobeats up to and including the one being changed
        for (let i = 0; i <= index; i++) {
            boundaryColumnIndex += this.state.macrobeatGroupings[i];
        }
        
        // --- 2. Transpose all notes that occur after the boundary ---
        this.state.placedNotes.forEach(note => {
            // If a note starts at or after the boundary, it needs to be shifted.
            if (note.startColumnIndex >= boundaryColumnIndex) {
                note.startColumnIndex += delta;
                note.endColumnIndex += delta;
            }
        });

        // --- 3. Update the state and notify the application ---
        this.state.macrobeatGroupings[index] = newValue;
        
        // Emit both events to ensure the notes and the grid lines redraw correctly.
        this.emit('notesChanged');
        this.emit('rhythmStructureChanged'); 

        this.recordState();
    },
    
    cycleMacrobeatBoundaryStyle(index) {
        if (index === undefined || index < 0 || index >= this.state.macrobeatBoundaryStyles.length) {
             console.error(`[Store] Invalid index for cycleMacrobeatBoundaryStyle: ${index}`);
            return;
        }
        const styles = ['dashed', 'solid', 'anacrusis'];
        const currentStyle = this.state.macrobeatBoundaryStyles[index];
        const currentIndex = styles.indexOf(currentStyle);
        const nextIndex = (currentIndex + 1) % styles.length;
        this.state.macrobeatBoundaryStyles[index] = styles[nextIndex];

        this.emit('rhythmStructureChanged');
        this.recordState();
    },
    
    increaseMacrobeatCount() {
        this.state.macrobeatGroupings.push(2);
        this.state.macrobeatBoundaryStyles.push('dashed');
        this.emit('rhythmStructureChanged');
        this.recordState();
    },
    
    decreaseMacrobeatCount() {
        if (this.state.macrobeatGroupings.length > 1) {
            this.state.macrobeatGroupings.pop();
            this.state.macrobeatBoundaryStyles.pop();
            this.emit('rhythmStructureChanged');
            this.recordState();
        }
    },
};