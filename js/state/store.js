// js/state/store.js

console.log("Store: Module loaded");

// A simple reactive store using a publish/subscribe pattern.
const _subscribers = {};

const store = {
    // --- STATE ---
    // The single source of truth for the application.
    state: {
        placedNotes: [],
        history: [[]],
        historyIndex: 0,
        macrobeatGroupings: Array(19).fill(2),
        macrobeatBoundaryStyles: [
            'anacrusis', 'anacrusis', 'solid',
            'dashed', 'dashed', 'dashed', 'solid',
            'dashed', 'dashed', 'dashed', 'solid',
            'dashed', 'dashed', 'dashed', 'solid',
            'dashed', 'dashed', 'dashed', 'solid'
        ],
        timeSignatureToggleStates: {},
        fullRowData: [],
        selectedTool: { type: 'circle', color: '#000000', tonicNumber: null },
        gridPosition: 34,
        visualRows: 10,
        logicRows: 20,
        cellWidth: 0,
        cellHeight: 0,
        columnWidths: [],
        isPlaying: false,
        isPaused: false,
        isLooping: false,
        tempo: 90,
        activePreset: 'sine',
        harmonicCoefficients: (() => {
            const coeffs = new Float32Array(32).fill(0);
            coeffs[1] = 1;
            return coeffs;
        })(),
        adsr: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.3 }
    },

    // --- HISTORY MANAGEMENT ---
    recordState() {
        console.log(`[HISTORY] Recording state at index ${this.state.historyIndex + 1}`);
        this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);
        const newSnapshot = JSON.parse(JSON.stringify(this.state.placedNotes));
        this.state.history.push(newSnapshot);
        this.state.historyIndex++;
        this.emit('historyChanged');
    },

    undo() {
        if (this.state.historyIndex > 0) {
            this.state.historyIndex--;
            this.state.placedNotes = JSON.parse(JSON.stringify(this.state.history[this.state.historyIndex]));
            this.emit('notesChanged');
            this.emit('historyChanged');
        }
    },

    redo() {
        if (this.state.historyIndex < this.state.history.length - 1) {
            this.state.historyIndex++;
            this.state.placedNotes = JSON.parse(JSON.stringify(this.state.history[this.state.historyIndex]));
            this.emit('notesChanged');
            this.emit('historyChanged');
        }
    },

    // --- ACTIONS / MUTATIONS ---
    addNote(note) {
        const existingNoteIndex = this.state.placedNotes.findIndex(n => 
            !n.isDrum && 
            n.row === note.row && 
            n.startColumnIndex === note.startColumnIndex &&
            n.shape === note.shape
        );
        if (existingNoteIndex !== -1) return;
        this.state.placedNotes.push(note);
        this.emit('notesChanged');
        if (note.shape !== 'circle') {
             this.recordState();
        }
    },

    updateNoteTail(note, newEndColumn) {
        note.endColumnIndex = newEndColumn;
        this.emit('notesChanged');
    },

    eraseNoteAt(colIndex, row) {
        const initialCount = this.state.placedNotes.length;
        this.state.placedNotes = this.state.placedNotes.filter(note => 
            !( !note.isDrum && note.row === row && colIndex >= note.startColumnIndex && colIndex <= note.endColumnIndex )
        );
        if (this.state.placedNotes.length < initialCount) {
            this.emit('notesChanged');
            this.recordState();
        }
    },
    
    eraseDrumNoteAt(colIndex, drumTrack) {
        const initialCount = this.state.placedNotes.length;
        this.state.placedNotes = this.state.placedNotes.filter(note => 
            !(note.isDrum && note.drumTrack === drumTrack && note.startColumnIndex === colIndex)
        );
        if (this.state.placedNotes.length < initialCount) {
            this.emit('notesChanged');
            this.recordState();
        }
    },

    toggleDrumNote(drumHit) {
        const existingIndex = this.state.placedNotes.findIndex(note =>
            note.isDrum && note.drumTrack === drumHit.drumTrack && note.startColumnIndex === drumHit.startColumnIndex
        );
        if (existingIndex >= 0) {
            this.state.placedNotes.splice(existingIndex, 1);
        } else {
            this.state.placedNotes.push(drumHit);
        }
        this.emit('notesChanged');
        this.recordState();
    },

    clearAllNotes() {
        this.state.placedNotes = [];
        this.emit('notesChanged');
        this.recordState();
    },

    loadNotes(notesData) {
        this.state.placedNotes = notesData;
        this.emit('notesChanged');
        this.recordState();
    },

    // NEW: A single action to apply a full preset object
    applyPreset(preset) {
        if (!preset) return;
        this.setADSR(preset.adsr);
        this.setHarmonicCoefficients(preset.coeffs);
        this.setActivePreset(preset.name);
    },
    
    setSelectedTool(type, color = null, tonicNumber = null) {
        this.state.selectedTool = { type, color, tonicNumber };
        this.emit('toolChanged', this.state.selectedTool);
    },

    setTempo(newTempo) {
        this.state.tempo = newTempo;
        this.emit('tempoChanged', newTempo);
    },

    setLooping(isLooping) {
        this.state.isLooping = isLooping;
        this.emit('loopingChanged', isLooping);
    },

    setPlaybackState(isPlaying, isPaused = false) {
        this.state.isPlaying = isPlaying;
        this.state.isPaused = isPaused;
        this.emit('playbackStateChanged', { isPlaying, isPaused });
    },

    setGridPosition(newPosition) {
        const maxPosition = this.state.fullRowData.length - this.state.logicRows;
        const clampedPosition = Math.max(0, Math.min(newPosition, maxPosition));
        if (this.state.gridPosition !== clampedPosition) {
            this.state.gridPosition = clampedPosition;
            this.emit('layoutConfigChanged');
        }
    },
    
    shiftGridUp() {
      this.setGridPosition(this.state.gridPosition - 1);
    },

    shiftGridDown() {
      this.setGridPosition(this.state.gridPosition + 1);
    },
    
    toggleMacrobeatGrouping(index) {
        this.state.macrobeatGroupings[index] = this.state.macrobeatGroupings[index] === 2 ? 3 : 2;
        this.emit('rhythmStructureChanged'); 
    },

    cycleMacrobeatBoundaryStyle(index) {
        const currentStyle = this.state.macrobeatBoundaryStyles[index];
        const canBeAnacrusis = index < 2 && (index === 0 || this.state.macrobeatBoundaryStyles[index - 1] === 'anacrusis');
        let nextStyle;

        if (currentStyle === 'dashed') nextStyle = 'solid';
        else if (currentStyle === 'solid') nextStyle = canBeAnacrusis ? 'anacrusis' : 'dashed';
        else nextStyle = 'dashed';
        
        this.state.macrobeatBoundaryStyles[index] = nextStyle;

        if (nextStyle !== 'anacrusis') {
            for (let i = index + 1; i < this.state.macrobeatBoundaryStyles.length; i++) {
                if (this.state.macrobeatBoundaryStyles[i] === 'anacrusis') this.state.macrobeatBoundaryStyles[i] = 'dashed';
                else break;
            }
        }
        this.emit('layoutConfigChanged');
    },

    increaseMacrobeatCount() {
        this.state.macrobeatGroupings.push(2);
        this.state.macrobeatBoundaryStyles.push('dashed');
        this.emit('rhythmStructureChanged');
    },

    decreaseMacrobeatCount() {
        if (this.state.macrobeatGroupings.length > 1) {
            this.state.macrobeatGroupings.pop();
            this.state.macrobeatBoundaryStyles.pop();
            this.emit('rhythmStructureChanged');
        }
    },

    setADSR(newADSR) {
        this.state.adsr = newADSR;
        this.emit('adsrChanged', newADSR);
    },

    setActivePreset(presetName) {
        this.state.activePreset = presetName;
        this.emit('presetChanged', presetName);
    },

    setHarmonicCoefficients(coeffs) {
        this.state.harmonicCoefficients = coeffs;
        this.emit('harmonicCoefficientsChanged', coeffs);
    },
    
    on(eventName, callback) {
        if (!_subscribers[eventName]) _subscribers[eventName] = [];
        _subscribers[eventName].push(callback);
    },

    emit(eventName, data) {
        if (_subscribers[eventName]) {
            _subscribers[eventName].forEach(callback => callback(data));
        }
    }
};

export default store;