// js/state/store.js
console.log("Store: Module loaded");

const _subscribers = {};

function generateUUID() {
    return `uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// --- Default Timbre Definitions ---
const defaultSineCoeffs = (() => { const c = new Float32Array(32).fill(0); c[1] = 1; return c; })();
const defaultSquareCoeffs = (() => { const c = new Float32Array(32).fill(0); for (let n = 1; n < 32; n += 2) { c[n] = 1 / n; } return c; })();
const defaultSawtoothCoeffs = (() => { const c = new Float32Array(32).fill(0); for (let n = 1; n < 32; n++) { c[n] = 1 / n; } return c; })();

const defaultADSR = { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.3 };
const pluckedADSR = { attack: 0.01, decay: 0.8, sustain: 0.1, release: 0.5 };

const store = {
    state: {
        placedNotes: [],
        tonicSignGroups: {},
        history: [ { notes: [], tonicSignGroups: {} } ],
        historyIndex: 0,
        macrobeatGroupings: Array(19).fill(2),
        macrobeatBoundaryStyles: ['anacrusis','anacrusis','solid','dashed','dashed','dashed','solid','dashed','dashed','dashed','solid','dashed','dashed','dashed','solid','dashed','dashed','dashed','solid'],
        fullRowData: [],
        selectedTool: { type: 'circle', color: '#0000ff', tonicNumber: null },
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
        degreeDisplayMode: 'off',
        
        // --- NEW TIMBRE STATE STRUCTURE ---
        timbres: {
            '#0000ff': { name: 'Blue', adsr: defaultADSR, coeffs: defaultSineCoeffs, activePresetName: 'sine' },
            '#000000': { name: 'Black', adsr: defaultADSR, coeffs: defaultSquareCoeffs, activePresetName: 'square' },
            '#ff0000': { name: 'Red', adsr: pluckedADSR, coeffs: defaultSawtoothCoeffs, activePresetName: 'sawtooth' },
            '#00ff00': { name: 'Green', adsr: pluckedADSR, coeffs: defaultSineCoeffs, activePresetName: 'sine' }
        },
        
        isPrintPreviewActive: false,
        printOptions: { topRow: 0, bottomRow: 87, includeDrums: true, orientation: 'landscape', colorMode: 'color' }
    },
    
    get placedTonicSigns() {
        return Object.values(this.state.tonicSignGroups).flat();
    },

    setDegreeDisplayMode(mode) {
        if (this.state.degreeDisplayMode === mode) {
            this.state.degreeDisplayMode = 'off';
        } else {
            this.state.degreeDisplayMode = mode;
        }
        this.emit('layoutConfigChanged');
        this.emit('degreeDisplayModeChanged', this.state.degreeDisplayMode);
    },

    recordState() {
        this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);
        const newSnapshot = {
            notes: JSON.parse(JSON.stringify(this.state.placedNotes)),
            tonicSignGroups: JSON.parse(JSON.stringify(this.state.tonicSignGroups)),
            timbres: JSON.parse(JSON.stringify(this.state.timbres)) // Also save timbre state
        };
        this.state.history.push(newSnapshot);
        this.state.historyIndex++;
        this.emit('historyChanged');
    },

    undo() {
        if (this.state.historyIndex > 0) {
            this.state.historyIndex--;
            const snapshot = this.state.history[this.state.historyIndex];
            this.state.placedNotes = JSON.parse(JSON.stringify(snapshot.notes));
            this.state.tonicSignGroups = JSON.parse(JSON.stringify(snapshot.tonicSignGroups));
            this.state.timbres = JSON.parse(JSON.stringify(snapshot.timbres));
            this.emit('notesChanged');
            this.emit('rhythmStructureChanged');
            this.emit('timbreChanged', this.state.selectedTool.color);
            this.emit('historyChanged');
        }
    },

    redo() {
        if (this.state.historyIndex < this.state.history.length - 1) {
            this.state.historyIndex++;
            const snapshot = this.state.history[this.state.historyIndex];
            this.state.placedNotes = JSON.parse(JSON.stringify(snapshot.notes));
            this.state.tonicSignGroups = JSON.parse(JSON.stringify(snapshot.tonicSignGroups));
            this.state.timbres = JSON.parse(JSON.stringify(snapshot.timbres));
            this.emit('notesChanged');
            this.emit('rhythmStructureChanged');
            this.emit('timbreChanged', this.state.selectedTool.color);
            this.emit('historyChanged');
        }
    },

    // --- REFACTORED ACTIONS FOR TIMBRE ---
    setADSR(color, newADSR) {
        this.state.timbres[color].adsr = newADSR;
        this.state.timbres[color].activePresetName = null; // Custom change invalidates preset
        this.emit('timbreChanged', color);
    },

    setHarmonicCoefficients(color, coeffs) {
        this.state.timbres[color].coeffs = coeffs;
        this.state.timbres[color].activePresetName = null; // Custom change invalidates preset
        this.emit('timbreChanged', color);
    },

    applyPreset(color, preset) {
        if (!preset) return;
        this.state.timbres[color].adsr = preset.adsr;
        this.state.timbres[color].coeffs = preset.coeffs;
        this.state.timbres[color].activePresetName = preset.name;
        this.emit('timbreChanged', color);
    },

    // --- Actions below are mostly unchanged ---
    addNote(note) {
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

    addTonicSignGroup(tonicSignGroup) {
        const uuid = generateUUID();
        const firstSign = tonicSignGroup[0];
        if (this.placedTonicSigns.some(ts => ts.preMacrobeatIndex === firstSign.preMacrobeatIndex)) {
            return;
        }
        const groupWithId = tonicSignGroup.map(sign => ({ ...sign, uuid }));
        this.state.tonicSignGroups[uuid] = groupWithId;
        this.emit('rhythmStructureChanged');
        this.recordState();
    },

    eraseTonicSignGroup(uuid) {
        if (this.state.tonicSignGroups[uuid]) {
            delete this.state.tonicSignGroups[uuid];
            this.emit('rhythmStructureChanged');
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
        this.state.tonicSignGroups = {};
        this.emit('notesChanged');
        this.emit('rhythmStructureChanged');
        this.recordState();
    },

    setSelectedTool(type, color = null, tonicNumber = null) {
        const oldTool = this.state.selectedTool;
        this.state.selectedTool = { type, color, tonicNumber };
        this.emit('toolChanged', { newTool: this.state.selectedTool, oldTool });
    },

    // --- Other state setters remain the same ---
    setTempo(newTempo) { this.state.tempo = newTempo; this.emit('tempoChanged', newTempo); },
    setLooping(isLooping) { this.state.isLooping = isLooping; this.emit('loopingChanged', isLooping); },
    setPlaybackState(isPlaying, isPaused = false) { this.state.isPlaying = isPlaying; this.emit('playbackStateChanged', { isPlaying, isPaused }); },
    setGridPosition(newPosition) {
        const maxPosition = this.state.fullRowData.length - this.state.logicRows;
        const clampedPosition = Math.max(0, Math.min(newPosition, maxPosition));
        if (this.state.gridPosition !== clampedPosition) {
            this.state.gridPosition = clampedPosition;
            this.emit('layoutConfigChanged');
        }
    },
    shiftGridUp() { this.setGridPosition(this.state.gridPosition - 1); },
    shiftGridDown() { this.setGridPosition(this.state.gridPosition + 1); },
    on(eventName, callback) {
        if (!_subscribers[eventName]) _subscribers[eventName] = [];
        _subscribers[eventName].push(callback);
    },
    emit(eventName, data) {
        if (_subscribers[eventName]) {
            _subscribers[eventName].forEach(callback => {
                try { callback(data); } catch (error) { console.error(`[Store] Error in listener for event "${eventName}":`, error); }
            });
        }
    }
};

export default store;