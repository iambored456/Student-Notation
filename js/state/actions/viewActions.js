// js/state/actions/viewActions.js
import { fullRowData as masterRowData } from '../pitchData.js';

function remapAnnotation(annotation, oldRange, newRange) {
    if (!annotation || typeof annotation !== 'object') {
        return true;
    }

    const oldTop = oldRange.topIndex;
    const newTop = newRange.topIndex;
    const newBottom = newRange.bottomIndex;
    const maxRow = newBottom - newTop;

    let hasRowData = false;
    let hasRowWithinRange = false;

    const adjustValue = (value) => {
        if (typeof value !== 'number') return value;
        hasRowData = true;
        const global = value + oldTop;
        if (global >= newTop && global <= newBottom) {
            hasRowWithinRange = true;
        }
        const remapped = global - newTop;
        return Math.max(0, Math.min(maxRow, remapped));
    };

    if (typeof annotation.row === 'number') {
        annotation.row = adjustValue(annotation.row);
    }
    if (typeof annotation.startRow === 'number') {
        annotation.startRow = adjustValue(annotation.startRow);
    }
    if (typeof annotation.endRow === 'number') {
        annotation.endRow = adjustValue(annotation.endRow);
    }
    if (typeof annotation.mouseRow === 'number') {
        annotation.mouseRow = adjustValue(annotation.mouseRow);
    }
    if (typeof annotation.baseRow === 'number') {
        annotation.baseRow = adjustValue(annotation.baseRow);
    }

    if (Array.isArray(annotation.path)) {
        let pathWithin = false;
        annotation.path.forEach(point => {
            if (point && typeof point.row === 'number') {
                const global = point.row + oldTop;
                if (global >= newTop && global <= newBottom) {
                    pathWithin = true;
                }
                point.row = Math.max(0, Math.min(maxRow, global - newTop));
            }
        });
        if (annotation.path.length > 0) {
            hasRowData = true;
            if (pathWithin) {
                hasRowWithinRange = true;
            }
        }
    }

    if (Array.isArray(annotation.points)) {
        let pointsWithin = false;
        annotation.points.forEach(point => {
            if (point && typeof point.row === 'number') {
                const global = point.row + oldTop;
                if (global >= newTop && global <= newBottom) {
                    pointsWithin = true;
                }
                point.row = Math.max(0, Math.min(maxRow, global - newTop));
            }
        });
        if (annotation.points.length > 0) {
            hasRowData = true;
            if (pointsWithin) {
                hasRowWithinRange = true;
            }
        }
    }

    if (annotation.data && typeof annotation.data === 'object') {
        Object.entries(annotation.data).forEach(([key, value]) => {
            if (value && typeof value === 'object') {
                if (Array.isArray(value)) {
                    value.forEach(item => {
                        if (item && typeof item.row === 'number') {
                            const global = item.row + oldTop;
                            if (global >= newTop && global <= newBottom) {
                                hasRowWithinRange = true;
                            }
                            hasRowData = true;
                            item.row = Math.max(0, Math.min(maxRow, global - newTop));
                        }
                    });
                } else if (typeof value.row === 'number') {
                    const global = value.row + oldTop;
                    if (global >= newTop && global <= newBottom) {
                        hasRowWithinRange = true;
                    }
                    hasRowData = true;
                    value.row = Math.max(0, Math.min(maxRow, global - newTop));
                }
            }
        });
    }

    return !hasRowData || hasRowWithinRange;
}

export const viewActions = {
    // Tools
    toggleAccidentalMode(type) {
        if (!this.state.accidentalMode.hasOwnProperty(type)) return;
        this.state.accidentalMode[type] = !this.state.accidentalMode[type];
        // Removed constraint - both buttons can now be inactive simultaneously
        this.emit('accidentalModeChanged', this.state.accidentalMode);
        this.emit('layoutConfigChanged');
    },

    toggleFrequencyLabels() {
        const wasShowingFrequencies = this.state.showFrequencyLabels;

        if (wasShowingFrequencies) {
            // Turning OFF frequency mode - restore previous accidental state
            this.state.showFrequencyLabels = false;
            this.state.accidentalMode = { ...this.state.savedAccidentalMode };
        } else {
            // Turning ON frequency mode - save current accidental state and disable both
            this.state.savedAccidentalMode = { ...this.state.accidentalMode };
            this.state.showFrequencyLabels = true;
            this.state.accidentalMode = { sharp: false, flat: false };
        }

        this.emit('frequencyLabelsChanged', this.state.showFrequencyLabels);
        this.emit('accidentalModeChanged', this.state.accidentalMode);
        this.emit('layoutConfigChanged');
    },

    toggleFocusColours() {
        this.state.focusColours = !this.state.focusColours;
        this.emit('focusColoursChanged', this.state.focusColours);
        this.emit('layoutConfigChanged');
    },

    setSnapZoomToRange(enabled) {
        const normalized = Boolean(enabled);
        if (this.state.snapZoomToRange === normalized) {
            return;
        }
        this.state.snapZoomToRange = normalized;
        this.emit('snapZoomSettingChanged', normalized);
    },

    setDegreeDisplayMode(mode) {
        const oldMode = this.state.degreeDisplayMode;
        this.state.degreeDisplayMode = this.state.degreeDisplayMode === mode ? 'off' : mode;
        const newMode = this.state.degreeDisplayMode;

        this.emit('layoutConfigChanged');
        this.emit('degreeDisplayModeChanged', newMode);
    },

    // REVISED: This now sets the tool type and optional tonic number
    setSelectedTool(type, tonicNumber) {
        const stateChanged = this.state.selectedTool !== type || 
                           (type === 'tonicization' && this.state.selectedToolTonicNumber !== tonicNumber);
        
        if (stateChanged) {
            const oldTool = this.state.selectedTool;
            this.state.previousTool = oldTool;
            this.state.selectedTool = type;
            
            if (type === 'tonicization' && tonicNumber) {
                this.state.selectedToolTonicNumber = parseInt(tonicNumber, 10);
            }
            
            this.emit('toolChanged', { newTool: type, oldTool });
        }
    },

    // NEW: Action to set the active note properties
    setSelectedNote(shape, color) {
        const oldNote = { ...this.state.selectedNote };
        this.state.selectedNote = { shape, color };
        this.emit('noteChanged', { newNote: this.state.selectedNote, oldNote });
    },

    setKeySignature(newKey) {
        if (this.state.keySignature !== newKey) {
            this.state.keySignature = newKey;
            this.emit('keySignatureChanged', newKey);
        }
    },

    // Playback
    setTempo(newTempo) { this.state.tempo = newTempo; this.emit('tempoChanged', newTempo); },
    setLooping(isLooping) { this.state.isLooping = isLooping; this.emit('loopingChanged', isLooping); },
    setPlaybackState(isPlaying, isPaused = false) { this.state.isPlaying = isPlaying; this.state.isPaused = isPaused; this.emit('playbackStateChanged', { isPlaying, isPaused }); },

    // Waveform
    toggleWaveformExtendedView() {
        this.state.waveformExtendedView = !this.state.waveformExtendedView;
        this.emit('waveformExtendedViewChanged', this.state.waveformExtendedView);
    },

    // ADSR
    setAdsrTimeAxisScale(scale) {
        const clampedScale = Math.max(0.1, Math.min(5.0, scale)); // Clamp between 0.1x and 5.0x
        this.state.adsrTimeAxisScale = clampedScale;
        this.emit('adsrTimeAxisScaleChanged', clampedScale);
    },

    setAdsrComponentWidth(widthPercent) {
        const clampedWidth = Math.max(50, Math.min(200, widthPercent)); // Clamp between 50% and 200%
        this.state.adsrComponentWidth = clampedWidth;
        this.emit('adsrComponentWidthChanged', clampedWidth);
    },
    
    // Layout & Viewport
    setLayoutConfig(config) {
        const oldConfig = {
            cellWidth: this.state.cellWidth,
            cellHeight: this.state.cellHeight,
            columnWidths: [...(this.state.columnWidths || [])]
        };
        
        let hasChanges = false;
        
        if (config.cellWidth !== undefined && this.state.cellWidth !== config.cellWidth) {
            this.state.cellWidth = config.cellWidth;
            hasChanges = true;
        }
        
        if (config.cellHeight !== undefined && this.state.cellHeight !== config.cellHeight) {
            this.state.cellHeight = config.cellHeight;
            hasChanges = true;
        }
        
        if (config.columnWidths !== undefined) {
            const oldWidths = JSON.stringify(this.state.columnWidths || []);
            const newWidths = JSON.stringify(config.columnWidths);
            if (oldWidths !== newWidths) {
                this.state.columnWidths = [...config.columnWidths];
                hasChanges = true;
            }
        }
        
        if (hasChanges) {
            this.emit('layoutConfigChanged', {
                oldConfig,
                newConfig: {
                    cellWidth: this.state.cellWidth,
                    cellHeight: this.state.cellHeight,
                    columnWidths: [...(this.state.columnWidths || [])]
                }
            });
        } else {
        }
    },
    
    setGridPosition(newPosition) {
        const maxPosition = this.state.fullRowData.length - (this.state.viewportRows * 2);
        const clampedPosition = Math.max(0, Math.min(newPosition, maxPosition));
        if (this.state.gridPosition !== clampedPosition) {
            this.state.gridPosition = clampedPosition;
            this.emit('layoutConfigChanged');
        }
    },
    shiftGridUp() { this.setGridPosition(this.state.gridPosition - 1); },
    shiftGridDown() { this.setGridPosition(this.state.gridPosition + 1); },
    
    // Print
    setPrintOptions(newOptions) {
        this.state.printOptions = { ...this.state.printOptions, ...newOptions };
        this.emit('printOptionsChanged', this.state.printOptions);
    },

    setPrintPreviewActive(isActive) {
        const wasActive = this.state.isPrintPreviewActive;
        this.state.isPrintPreviewActive = isActive;
        this.emit('printPreviewStateChanged', isActive);
    },

    /**
     * Sets the active pitch range for the grid and removes/adjusts content outside the range.
     * @param {Object} range - The desired range { topIndex, bottomIndex } in masterRowData indices.
     */
    setPitchRange(range, options = {}) {
        const totalRows = masterRowData.length;
        const oldRange = this.state.pitchRange || { topIndex: 0, bottomIndex: totalRows - 1 };

        if (!range || totalRows === 0) {
            return;
        }

        const requestedTop = range.topIndex ?? oldRange.topIndex;
        const requestedBottom = range.bottomIndex ?? oldRange.bottomIndex;

        const newTopIndex = Math.max(0, Math.min(totalRows - 1, requestedTop));
        const newBottomIndex = Math.max(newTopIndex, Math.min(totalRows - 1, requestedBottom));

        if (oldRange.topIndex === newTopIndex && oldRange.bottomIndex === newBottomIndex) {
            return;
        }

        const newFullRowData = masterRowData.slice(newTopIndex, newBottomIndex + 1);
        const maxRowIndex = newFullRowData.length - 1;
        let removedNotes = 0;
        let removedStamps = 0;
        let removedTriplets = 0;

        // Remap placed notes
        this.state.placedNotes = this.state.placedNotes.filter(note => {
            if (note.isDrum) {
                return true;
            }
            const globalRow = note.row + oldRange.topIndex;
            if (globalRow < newTopIndex || globalRow > newBottomIndex) {
                removedNotes += 1;
                return false;
            }
            note.row = globalRow - newTopIndex;
            return true;
        });

        // Remap tonic sign groups
        if (this.state.tonicSignGroups) {
            const updatedGroups = {};
            Object.entries(this.state.tonicSignGroups).forEach(([uuid, group]) => {
                const adjustedGroup = group
                    .map(sign => {
                        if (typeof sign.row !== 'number') return null;
                        const globalRow = sign.row + oldRange.topIndex;
                        if (globalRow < newTopIndex || globalRow > newBottomIndex) {
                            return null;
                        }
                        return { ...sign, row: globalRow - newTopIndex };
                    })
                    .filter(Boolean);

                if (adjustedGroup.length > 0) {
                    updatedGroups[uuid] = adjustedGroup;
                }
            });
            this.state.tonicSignGroups = updatedGroups;
        }

        // Remap stamp placements
        if (Array.isArray(this.state.stampPlacements)) {
            this.state.stampPlacements = this.state.stampPlacements.filter(placement => {
                const globalRow = placement.row + oldRange.topIndex;
                if (globalRow < newTopIndex || globalRow > newBottomIndex) {
                    removedStamps += 1;
                    return false;
                }
                placement.row = globalRow - newTopIndex;
                return true;
            });
        }

        // Remap triplet placements
        if (Array.isArray(this.state.tripletPlacements)) {
            this.state.tripletPlacements = this.state.tripletPlacements.filter(placement => {
                const globalRow = placement.row + oldRange.topIndex;
                if (globalRow < newTopIndex || globalRow > newBottomIndex) {
                    removedTriplets += 1;
                    return false;
                }
                placement.row = globalRow - newTopIndex;
                return true;
            });
        }

        // Adjust annotations
        if (Array.isArray(this.state.annotations) && this.state.annotations.length > 0) {
            const newRange = { topIndex: newTopIndex, bottomIndex: newBottomIndex };
            this.state.annotations = this.state.annotations.filter(annotation =>
                remapAnnotation(annotation, oldRange, newRange)
            );
        }

        // Adjust print options
        if (this.state.printOptions) {
            const currentTop = this.state.printOptions.topRow ?? 0;
            const currentBottom = this.state.printOptions.bottomRow ?? maxRowIndex;
            const offset = oldRange.topIndex - newTopIndex;
            const adjustedTop = Math.max(0, Math.min(maxRowIndex, currentTop + offset));
            const adjustedBottom = Math.max(adjustedTop, Math.min(maxRowIndex, currentBottom + offset));
            this.state.printOptions = {
                ...this.state.printOptions,
                topRow: adjustedTop,
                bottomRow: adjustedBottom
            };
        }

        this.state.pitchRange = { topIndex: newTopIndex, bottomIndex: newBottomIndex };
        this.state.fullRowData = newFullRowData;

        let maintainStartRow = null;
        if (typeof options.maintainGlobalStart === 'number' && Number.isFinite(options.maintainGlobalStart)) {
            const candidate = Math.round(options.maintainGlobalStart - newTopIndex);
            maintainStartRow = Math.max(0, Math.min(maxRowIndex, candidate));
        }

        const metadata = {
            removedNotes,
            removedStamps,
            removedTriplets,
            maintainStartRow
        };

        this.emit('pitchRangeChanged', {
            topIndex: newTopIndex,
            bottomIndex: newBottomIndex,
            metadata
        });

        this.emit('layoutConfigChanged');
        this.emit('notesChanged');
        this.emit('stampPlacementsChanged');
        this.emit('tripletPlacementsChanged');
        this.emit('annotationsChanged');

        this.recordState();
    }
};
