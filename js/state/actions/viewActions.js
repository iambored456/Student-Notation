// js/state/actions/viewActions.js

export const viewActions = {
    // Tools
    toggleAccidentalMode(type) {
        if (!this.state.accidentalMode.hasOwnProperty(type)) return;
        this.state.accidentalMode[type] = !this.state.accidentalMode[type];
        // Removed constraint - both buttons can now be inactive simultaneously
        this.emit('accidentalModeChanged', this.state.accidentalMode);
        this.emit('layoutConfigChanged');
    },

    toggleFocusColours() {
        this.state.focusColours = !this.state.focusColours;
        this.emit('focusColoursChanged', this.state.focusColours);
        this.emit('layoutConfigChanged');
    },

    setDegreeDisplayMode(mode) {
        const oldMode = this.state.degreeDisplayMode;
        this.state.degreeDisplayMode = this.state.degreeDisplayMode === mode ? 'off' : mode;
        const newMode = this.state.degreeDisplayMode;
        
        console.log(`🏪 [STORE] setDegreeDisplayMode called: ${oldMode} → ${newMode} (requested: ${mode})`);
        
        this.emit('layoutConfigChanged');
        this.emit('degreeDisplayModeChanged', newMode);
        
        console.log(`📡 [STORE] Emitted events: layoutConfigChanged, degreeDisplayModeChanged(${newMode})`);
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
            console.log('🎯 [STORE] Grid position changed:', {
                oldPosition: this.state.gridPosition,
                newPosition: clampedPosition,
                maxPosition,
                viewportRows: this.state.viewportRows,
                source: 'setGridPosition'
            });
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
};