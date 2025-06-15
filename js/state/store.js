// js/state/store.js

console.log("Store: Module loaded");

const _subscribers = {};

const store = {
    // --- STATE ---
    state: {
        placedNotes: [],
        history: [[]], // Initialize with an empty state
        historyIndex: 0, // Track our position in history
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
            console.log(`[HISTORY] Undo to index ${this.state.historyIndex}`);
            this.state.placedNotes = JSON.parse(JSON.stringify(this.state.history[this.state.historyIndex]));
            this.emit('notesChanged');
            this.emit('historyChanged');
        } else {
            console.log("[HISTORY] Nothing to undo.");
        }
    },

    redo() {
        if (this.state.historyIndex < this.state.history.length - 1) {
            this.state.historyIndex++;
            console.log(`[HISTORY] Redo to index ${this.state.historyIndex}`);
            this.state.placedNotes = JSON.parse(JSON.stringify(this.state.history[this.state.historyIndex]));
            this.emit('notesChanged');
            this.emit('historyChanged');
        } else {
            console.log("[HISTORY] Nothing to redo.");
        }
    },

    // --- ACTIONS / MUTATIONS (now with history recording) ---
    addNote(note) {
        this.state.placedNotes.push(note);
        this.emit('notesChanged');
        this.recordState();
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
        this.state.gridPosition = Math.max(0, Math.min(newPosition, maxPosition));
        this.emit('gridChanged');
    },
    
    shiftGridUp() {
      this.setGridPosition(this.state.gridPosition - 1);
    },

    shiftGridDown() {
      this.setGridPosition(this.state.gridPosition + 1);
    },
    
    toggleMacrobeatGrouping(index) {
        this.state.macrobeatGroupings[index] = this.state.macrobeatGroupings[index] === 2 ? 3 : 2;
        this.emit('rhythmChanged');
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
        this.emit('rhythmStyleChanged');
    },

    increaseMacrobeatCount() {
        this.state.macrobeatGroupings.push(2);
        this.state.macrobeatBoundaryStyles.push('dashed');
        this.emit('rhythmChanged');
    },

    decreaseMacrobeatCount() {
        if (this.state.macrobeatGroupings.length > 1) {
            this.state.macrobeatGroupings.pop();
            this.state.macrobeatBoundaryStyles.pop();
            this.emit('rhythmChanged');
        }
    },

    setActivePreset(presetName) {
        this.state.activePreset = presetName;
        this.emit('presetChanged', presetName);
        console.log(`[STORE] Active preset changed to: ${presetName}`);
    },

    setHarmonicCoefficients(coeffs) {
        console.log(`[STORE] setHarmonicCoefficients called. Incoming max value: ${Math.max(...coeffs)}`);
        this.state.harmonicCoefficients = coeffs;
        console.log(`[STORE] State updated. New max value in store: ${Math.max(...this.state.harmonicCoefficients)}`);
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