// js/state/actions/viewActions.js

export const viewActions = {
    // Tools
    toggleAccidentalMode(type) {
        if (!this.state.accidentalMode.hasOwnProperty(type)) return;
        this.state.accidentalMode[type] = !this.state.accidentalMode[type];
        if (!this.state.accidentalMode.sharp && !this.state.accidentalMode.flat) {
            const otherType = type === 'sharp' ? 'flat' : 'sharp';
            this.state.accidentalMode[otherType] = true;
        }
        this.emit('accidentalModeChanged', this.state.accidentalMode);
        this.emit('layoutConfigChanged');
    },

    setDegreeDisplayMode(mode) {
        this.state.degreeDisplayMode = this.state.degreeDisplayMode === mode ? 'off' : mode;
        this.emit('layoutConfigChanged');
        this.emit('degreeDisplayModeChanged', this.state.degreeDisplayMode);
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
        console.log('🔧 [STATE] setLayoutConfig called with:', config);
        const oldConfig = {
            cellWidth: this.state.cellWidth,
            cellHeight: this.state.cellHeight,
            columnWidths: [...(this.state.columnWidths || [])]
        };
        
        let hasChanges = false;
        
        if (config.cellWidth !== undefined && this.state.cellWidth !== config.cellWidth) {
            console.log('🔧 [STATE] cellWidth changed:', this.state.cellWidth, '->', config.cellWidth);
            this.state.cellWidth = config.cellWidth;
            hasChanges = true;
        }
        
        if (config.cellHeight !== undefined && this.state.cellHeight !== config.cellHeight) {
            console.log('🔧 [STATE] cellHeight changed:', this.state.cellHeight, '->', config.cellHeight);
            this.state.cellHeight = config.cellHeight;
            hasChanges = true;
        }
        
        if (config.columnWidths !== undefined) {
            const oldWidths = JSON.stringify(this.state.columnWidths || []);
            const newWidths = JSON.stringify(config.columnWidths);
            if (oldWidths !== newWidths) {
                console.log('🔧 [STATE] columnWidths changed:', this.state.columnWidths?.length || 0, '->', config.columnWidths.length, 'columns');
                this.state.columnWidths = [...config.columnWidths];
                hasChanges = true;
            }
        }
        
        if (hasChanges) {
            console.log('🔧 [STATE] Layout config updated, emitting layoutConfigChanged');
            this.emit('layoutConfigChanged', {
                oldConfig,
                newConfig: {
                    cellWidth: this.state.cellWidth,
                    cellHeight: this.state.cellHeight,
                    columnWidths: [...(this.state.columnWidths || [])]
                }
            });
        } else {
            console.log('🔧 [STATE] No layout changes detected, skipping emission');
        }
    },
    
    setGridPosition(newPosition) {
        const maxPosition = this.state.fullRowData.length - (this.state.visualRows * 2);
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
        console.log('🖨️ [PRINT STATE] Preview active state changed:', wasActive, '->', isActive);
        this.emit('printPreviewStateChanged', isActive);
    },
};