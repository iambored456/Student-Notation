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

    setSelectedTool(type, color = null, tonicNumber = null) {
        const oldTool = this.state.selectedTool;
        this.state.selectedTool = { type, color, tonicNumber };
        this.emit('toolChanged', { newTool: this.state.selectedTool, oldTool });
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
};