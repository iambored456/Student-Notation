// js/state/actions/rhythmActions.js
import { ANACRUSIS_ON_GROUPINGS, ANACRUSIS_ON_STYLES, ANACRUSIS_OFF_GROUPINGS, ANACRUSIS_OFF_STYLES } from '../initialState/rhythm.js';
import logger from '../../utils/logger.js';

export const rhythmActions = {
    setAnacrusis(enabled) {
        if (this.state.hasAnacrusis === enabled) return;
        
        // Calculate the column shift needed
        const oldGroupings = this.state.macrobeatGroupings;
        const newGroupings = enabled ? ANACRUSIS_ON_GROUPINGS : ANACRUSIS_OFF_GROUPINGS;
        
        // Calculate total columns for old and new configurations
        const oldTotalColumns = oldGroupings.reduce((sum, val) => sum + val, 0);
        const newTotalColumns = newGroupings.reduce((sum, val) => sum + val, 0);
        const columnShift = newTotalColumns - oldTotalColumns;

        // Update the state
        this.state.hasAnacrusis = enabled;
        this.state.macrobeatGroupings = [...newGroupings];
        this.state.macrobeatBoundaryStyles = enabled ? [...ANACRUSIS_ON_STYLES] : [...ANACRUSIS_OFF_STYLES];
        
        // Shift all existing notes if there's a column difference
        if (columnShift !== 0) {
            // Track notes that need to be removed if they fall outside valid bounds
            const notesToRemove = [];
            
            this.state.placedNotes.forEach(note => {
                // Shift notes from the beginning of the grid (after legend columns)
                // Legend columns are at index 0 and 1, so notes start from column 2
                const legendColumns = 2;
                if (note.startColumnIndex >= legendColumns) {
                    const newStartColumn = note.startColumnIndex + columnShift;
                    const newEndColumn = note.endColumnIndex + columnShift;
                    
                    // Check bounds - ensure notes don't go before the legend columns
                    if (newStartColumn < legendColumns) {
                        // Mark note for removal if it would go into invalid territory
                        notesToRemove.push(note);
                    } else {
                        note.startColumnIndex = newStartColumn;
                        note.endColumnIndex = newEndColumn;
                    }
                }
            });
            
            // Remove notes that would fall outside valid bounds
            notesToRemove.forEach(noteToRemove => {
                const index = this.state.placedNotes.indexOf(noteToRemove);
                if (index > -1) {
                    this.state.placedNotes.splice(index, 1);
                }
            });
            
            // Also shift stamp placements (16th note stamps)
            const stampsToRemove = [];
            
            this.state.stampPlacements.forEach(stamp => {
                // Stamps use startColumn/endColumn instead of startColumnIndex/endColumnIndex
                const legendColumns = 2;
                if (stamp.startColumn >= legendColumns) {
                    const newStartColumn = stamp.startColumn + columnShift;
                    const newEndColumn = stamp.endColumn + columnShift;
                    
                    // Check bounds - ensure stamps don't go before the legend columns
                    if (newStartColumn < legendColumns) {
                        // Mark stamp for removal if it would go into invalid territory
                        stampsToRemove.push(stamp);
                    } else {
                        stamp.startColumn = newStartColumn;
                        stamp.endColumn = newEndColumn;
                    }
                }
            });
            
            // Remove stamps that would fall outside valid bounds
            stampsToRemove.forEach(stampToRemove => {
                const index = this.state.stampPlacements.indexOf(stampToRemove);
                if (index > -1) {
                    this.state.stampPlacements.splice(index, 1);
                }
            });
            
            // Also shift any tonic signs that may have been placed
            Object.values(this.state.tonicSignGroups).flat().forEach(tonicSign => {
                // Tonic signs are placed before macrobeats, so they need adjustment too
                // The preMacrobeatIndex should remain the same, but we need to ensure
                // the visual positioning accounts for the column shift
                if (tonicSign.preMacrobeatIndex >= 0) {
                    // The tonic sign positioning will be recalculated by the rendering system
                    // based on the new macrobeat structure, so no direct column adjustment needed
                }
            });
        }

        this.emit('anacrusisChanged', enabled);
        this.emit('notesChanged'); // Ensure notes are redrawn with new positions
        this.emit('stampPlacementsChanged'); // Ensure stamps are redrawn with new positions
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
            logger.error('rhythmActions', `Invalid index for toggleMacrobeatGrouping: ${index}`, null, 'state');
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
             logger.error('rhythmActions', `Invalid index for cycleMacrobeatBoundaryStyle: ${index}`, null, 'state');
            return;
        }

        // Determine if this boundary is within anacrusis area
        const isInAnacrusis = this._isBoundaryInAnacrusis(index);
        
        let styles;
        if (isInAnacrusis) {
            // In anacrusis: cycle through all 3 states (dashed, solid, anacrusis)
            styles = ['dashed', 'solid', 'anacrusis'];
        } else {
            // Outside anacrusis: only cycle between dashed and solid
            styles = ['dashed', 'solid'];
        }

        const currentStyle = this.state.macrobeatBoundaryStyles[index];
        const currentIndex = styles.indexOf(currentStyle);
        
        // If current style is not in the allowed styles for this area, start from beginning
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % styles.length;
        this.state.macrobeatBoundaryStyles[index] = styles[nextIndex];

        this.emit('rhythmStructureChanged');
        this.recordState();
    },

    _isBoundaryInAnacrusis(boundaryIndex) {
        if (!this.state.hasAnacrusis) return false;
        
        // Check if any boundary before this one (or this one) has 'solid' style
        // Anacrusis continues until the first solid boundary
        for (let i = 0; i <= boundaryIndex; i++) {
            if (this.state.macrobeatBoundaryStyles[i] === 'solid') {
                return i === boundaryIndex; // Only the solid boundary itself is still considered anacrusis
            }
        }
        return true; // No solid boundary found yet, so still in anacrusis
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
    
    /**
     * Updates a specific measure's time signature by replacing its macrobeat groupings
     * @param {number} measureIndex - The index of the measure to update
     * @param {Array} newGroupings - Array of 2s and 3s defining the new time signature
     */
    updateTimeSignature(measureIndex, newGroupings) {
        if (!Array.isArray(newGroupings) || newGroupings.length === 0) {
            logger.error('rhythmActions', 'Invalid groupings provided to updateTimeSignature', null, 'state');
            return;
        }

        // Find the start and end indices of the measure in the macrobeatGroupings array
        let measureStartIndex = 0;
        let measureEndIndex = 0;
        let currentMeasure = 0;
        
        for (let i = 0; i < this.state.macrobeatGroupings.length; i++) {
            if (currentMeasure === measureIndex) {
                measureStartIndex = i;
                break;
            }
            
            // Check if this boundary ends a measure (solid boundary or last beat)
            const isLastBeat = (i === this.state.macrobeatGroupings.length - 1);
            const boundaryStyle = this.state.macrobeatBoundaryStyles[i];
            const isSolidBoundary = (boundaryStyle === 'solid');
            
            if (isSolidBoundary || isLastBeat) {
                currentMeasure++;
            }
        }
        
        // Find the end of the target measure
        currentMeasure = 0;
        for (let i = 0; i < this.state.macrobeatGroupings.length; i++) {
            if (currentMeasure === measureIndex) {
                const isLastBeat = (i === this.state.macrobeatGroupings.length - 1);
                const boundaryStyle = this.state.macrobeatBoundaryStyles[i];
                const isSolidBoundary = (boundaryStyle === 'solid');
                
                if (isSolidBoundary || isLastBeat) {
                    measureEndIndex = i;
                    break;
                }
            } else if (currentMeasure < measureIndex) {
                const isLastBeat = (i === this.state.macrobeatGroupings.length - 1);
                const boundaryStyle = this.state.macrobeatBoundaryStyles[i];
                const isSolidBoundary = (boundaryStyle === 'solid');
                
                if (isSolidBoundary || isLastBeat) {
                    currentMeasure++;
                }
            }
        }

        // Calculate column shift for existing notes
        const oldLength = measureEndIndex - measureStartIndex + 1;
        const newLength = newGroupings.length;
        const columnShift = newGroupings.reduce((sum, val) => sum + val, 0) - 
                           this.state.macrobeatGroupings.slice(measureStartIndex, measureEndIndex + 1)
                               .reduce((sum, val) => sum + val, 0);

        // Calculate the boundary column after this measure
        let boundaryColumnIndex = 2; // Start after legends
        const placedTonicSigns = Object.values(this.state.tonicSignGroups).flat();
        const uniqueTonicGroupsBeforeBoundary = new Set(
            placedTonicSigns.filter(ts => ts.preMacrobeatIndex <= measureEndIndex).map(ts => ts.uuid)
        ).size;
        boundaryColumnIndex += uniqueTonicGroupsBeforeBoundary;
        
        for (let i = 0; i <= measureEndIndex; i++) {
            boundaryColumnIndex += this.state.macrobeatGroupings[i];
        }

        // Shift notes that come after this measure
        if (columnShift !== 0) {
            this.state.placedNotes.forEach(note => {
                if (note.startColumnIndex >= boundaryColumnIndex) {
                    note.startColumnIndex += columnShift;
                    note.endColumnIndex += columnShift;
                }
            });
        }

        // Replace the measure's macrobeat groupings
        const newGroupingsCopy = [...newGroupings];
        const newStylesArray = new Array(newLength - 1).fill('dashed');
        
        // Preserve the final boundary style of the measure if it's not the last measure
        if (measureEndIndex < this.state.macrobeatBoundaryStyles.length) {
            const originalFinalStyle = this.state.macrobeatBoundaryStyles[measureEndIndex];
            if (newLength > 0) {
                newStylesArray.push(originalFinalStyle);
            }
        }

        this.state.macrobeatGroupings.splice(measureStartIndex, oldLength, ...newGroupingsCopy);
        this.state.macrobeatBoundaryStyles.splice(measureStartIndex, oldLength - 1, ...newStylesArray);

        this.emit('notesChanged');
        this.emit('rhythmStructureChanged');
        this.recordState();
    },
};