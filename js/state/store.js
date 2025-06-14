// js/state/store.js

console.log("Store: Module loaded");

// A simple reactive store using a publish/subscribe pattern.
const _subscribers = {};

const store = {
    // --- STATE ---
    // The single source of truth for the application.
    state: {
        // Note Data
        placedNotes: [],
        
        // Rhythm and Meter
        macrobeatGroupings: Array(19).fill(2),
        macrobeatBoundaryStyles: Array(19).fill(false),
        timeSignatureToggleStates: {}, // For detailed/simple view
        
        // Static Data
        fullRowData: [],
        
        // UI Tool State
        selectedTool: {
            type: 'circle', // 'circle', 'oval', 'tonicization', 'eraser'
            color: '#000000',
            tonicNumber: null,
        },
        
        // Grid Display State
        gridPosition: 34, // Starting row
        visualRows: 10,
        logicRows: 20,
        cellWidth: 0,
        cellHeight: 0,
        columnWidths: [], // Will be calculated from macrobeats
        
        // Playback State
        isPlaying: false,
        isPaused: false,
        isLooping: false,
        tempo: 120,

        // Audio Engine State
        harmonicLevels: [1, 0.5, 0.333, 0.25, 0.2, 0.167, 0.143, 0.125, 0.111, 0.1, 0.1],
        adsr: {
            attack: 0.1,
            decay: 0.2,
            sustain: 0.8,
            release: 0.3,
        }
    },

    // --- ACTIONS / MUTATIONS ---
    // Functions to modify the state. Components call these.
    
    // Note Actions
    addNote(note) {
        console.log("Store: addNote action called", note);
        this.state.placedNotes.push(note);
        this.emit('notesChanged');
    },

    updateNoteTail(note, newEndColumn) {
        console.log(`Store: updateNoteTail action called for note, new end: ${newEndColumn}`);
        note.endColumnIndex = newEndColumn;
        this.emit('notesChanged');
    },

    eraseNoteAt(colIndex, row) {
        console.log(`Store: eraseNoteAt action called for col:${colIndex}, row:${row}`);
        const initialCount = this.state.placedNotes.length;
        this.state.placedNotes = this.state.placedNotes.filter(note => 
            !( !note.isDrum && note.row === row && colIndex >= note.startColumnIndex && colIndex <= note.endColumnIndex )
        );
        if (this.state.placedNotes.length < initialCount) {
            this.emit('notesChanged');
        }
    },
    
    toggleDrumNote(drumHit) {
        console.log("Store: toggleDrumNote action called", drumHit);
        const existingIndex = this.state.placedNotes.findIndex(note =>
            note.isDrum &&
            note.drumTrack === drumHit.drumTrack &&
            note.startColumnIndex === drumHit.startColumnIndex
        );

        if (existingIndex >= 0) {
            this.state.placedNotes.splice(existingIndex, 1);
        } else {
            this.state.placedNotes.push(drumHit);
        }
        this.emit('notesChanged');
    },

    clearAllNotes() {
        console.log("Store: clearAllNotes action called");
        this.state.placedNotes = [];
        this.emit('notesChanged');
    },

    loadNotes(notesData) {
        console.log("Store: loadNotes action called");
        this.state.placedNotes = notesData;
        this.emit('notesChanged');
    },

    // Tool Actions
    setSelectedTool(type, color = null, tonicNumber = null) {
        console.log(`Store: setSelectedTool action called - Type: ${type}, Color: ${color}`);
        this.state.selectedTool.type = type;
        this.state.selectedTool.color = color;
        this.state.selectedTool.tonicNumber = tonicNumber;
        this.emit('toolChanged', this.state.selectedTool);
    },

    // Playback Actions
    setTempo(newTempo) {
        console.log(`Store: setTempo action called - Tempo: ${newTempo}`);
        this.state.tempo = newTempo;
        this.emit('tempoChanged', newTempo);
    },

    setLooping(isLooping) {
        console.log(`Store: setLooping action called - Looping: ${isLooping}`);
        this.state.isLooping = isLooping;
        this.emit('loopingChanged', isLooping);
    },

    setPlaybackState(isPlaying, isPaused = false) {
        console.log(`Store: setPlaybackState action called - Playing: ${isPlaying}, Paused: ${isPaused}`);
        this.state.isPlaying = isPlaying;
        this.state.isPaused = isPaused;
        this.emit('playbackStateChanged', { isPlaying, isPaused });
    },

    // Grid Actions
    shiftGridUp() {
      if (this.state.gridPosition > 0) {
        this.state.gridPosition--;
        console.log(`Store: shiftGridUp action called. New position: ${this.state.gridPosition}`);
        this.emit('gridChanged');
      }
    },

    shiftGridDown() {
      if (this.state.gridPosition + this.state.logicRows < this.state.fullRowData.length) {
        this.state.gridPosition++;
        console.log(`Store: shiftGridDown action called. New position: ${this.state.gridPosition}`);
        this.emit('gridChanged');
      }
    },
    
    // Rhythm Actions
    toggleMacrobeatGrouping(index) {
        const current = this.state.macrobeatGroupings[index];
        this.state.macrobeatGroupings[index] = (current === 2) ? 3 : 2;
        console.log(`Store: Toggled macrobeat grouping at index ${index} to ${this.state.macrobeatGroupings[index]}`);
        this.emit('rhythmChanged');
    },

    toggleMacrobeatBoundaryStyle(index) {
        this.state.macrobeatBoundaryStyles[index] = !this.state.macrobeatBoundaryStyles[index];
        console.log(`Store: Toggled macrobeat boundary style at index ${index}`);
        this.emit('rhythmChanged');
    },

    increaseMacrobeatCount() {
        this.state.macrobeatGroupings.push(2);
        console.log("Store: Increased macrobeat count.");
        this.emit('rhythmChanged');
    },

    decreaseMacrobeatCount() {
        if (this.state.macrobeatGroupings.length > 1) {
            this.state.macrobeatGroupings.pop();
            console.log("Store: Decreased macrobeat count.");
            this.emit('rhythmChanged');
        }
    },
    
    // --- PUBSUB SYSTEM ---
    on(eventName, callback) {
        if (!_subscribers[eventName]) {
            _subscribers[eventName] = [];
        }
        _subscribers[eventName].push(callback);
    },

    emit(eventName, data) {
        console.log(`Store: Emitting event -> ${eventName}`, data || '');
        if (_subscribers[eventName]) {
            _subscribers[eventName].forEach(callback => callback(data));
        }
    }
};

export default store;