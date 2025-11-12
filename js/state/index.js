// js/state/index.js
import { initialState } from './initialState/index.js';
import { fullRowData as masterRowData } from './pitchData.js';
import { historyActions } from './actions/historyActions.js';
import { noteActions } from './actions/noteActions.js';
import { timbreActions } from './actions/timbreActions.js';
import { rhythmActions } from './actions/rhythmActions.js';
import { viewActions } from './actions/viewActions.js';
import { harmonyActions } from './actions/harmonyActions.js';
import { paintActions } from './actions/paintActions.js';
import { stampActions } from './actions/stampActions.js';
import { tripletActions } from './actions/tripletActions.js';
import logger from '@utils/logger.js';

logger.moduleLoaded('Store', 'general');

const STORAGE_KEY = 'studentNotationState';

function loadStateFromLocalStorage() {
    try {
        const serializedState = localStorage.getItem(STORAGE_KEY);
        if (serializedState === null) return undefined;
        const parsedState = JSON.parse(serializedState);

        // This logic correctly converts plain objects/arrays from storage back to Float32Arrays
        if (parsedState.timbres) {
            for (const color in parsedState.timbres) {
                const timbre = parsedState.timbres[color];
                // Convert harmonic amplitude arrays back to Float32Array
                if (timbre.coeffs && typeof timbre.coeffs === 'object') {
                    const values = Array.isArray(timbre.coeffs) ? timbre.coeffs : Object.values(timbre.coeffs);
                    timbre.coeffs = new Float32Array(values);
                }
                // Convert harmonic phase arrays back to Float32Array
                if (timbre.phases && typeof timbre.phases === 'object') {
                    const values = Array.isArray(timbre.phases) ? timbre.phases : Object.values(timbre.phases);
                    timbre.phases = new Float32Array(values);
                }
            }
        }

        if (parsedState.paint) {
            // Merge paint state safely
            const initialPaintState = initialState.paint || {};
            const savedPaintState = parsedState.paint;
            parsedState.paint = {
                ...initialPaintState,
                ...savedPaintState,
                paintSettings: {
                    ...initialPaintState.paintSettings,
                    ...(savedPaintState.paintSettings || {})
                }
            };
        }

        if (parsedState.pitchRange) {
            const totalRows = masterRowData?.length || (parsedState.fullRowData?.length) || 0;
            const maxIndex = Math.max(0, totalRows - 1);
            const topIndex = Math.max(0, Math.min(maxIndex, parsedState.pitchRange.topIndex ?? 0));
            const bottomIndex = Math.max(topIndex, Math.min(maxIndex, parsedState.pitchRange.bottomIndex ?? maxIndex));
            parsedState.pitchRange = { topIndex, bottomIndex };
        }
        
        return parsedState;
    } catch (err) {
        logger.error('Store', 'Could not load state from localStorage', err, 'general');
        return undefined;
    }
}

function saveStateToLocalStorage(state) {
    try {
        // Create a deep copy of the state to avoid modifying the live state object
        const stateToPersist = JSON.parse(JSON.stringify({
            placedNotes: state.placedNotes,
            placedChords: state.placedChords,
            tonicSignGroups: state.tonicSignGroups,
            stampPlacements: state.stampPlacements,
            tripletPlacements: state.tripletPlacements,
            timbres: state.timbres,
            macrobeatGroupings: state.macrobeatGroupings,
            macrobeatBoundaryStyles: state.macrobeatBoundaryStyles,
            hasAnacrusis: state.hasAnacrusis,
            baseMicrobeatPx: state.baseMicrobeatPx,
            modulationMarkers: state.modulationMarkers,
            tempo: state.tempo,
            activeChordIntervals: state.activeChordIntervals,
            selectedNote: state.selectedNote,
            annotations: state.annotations,
            pitchRange: state.pitchRange,
            snapZoomToRange: state.snapZoomToRange,
            paint: {
                paintHistory: state.paint.paintHistory,
                paintSettings: state.paint.paintSettings
            }
        }));

        // THE FIX: Correctly convert the live Float32Array into a storable Array.
        if (state.timbres) {
            for (const color in state.timbres) {
                if (state.timbres[color].coeffs && stateToPersist.timbres[color]) {
                    stateToPersist.timbres[color].coeffs = Array.from(state.timbres[color].coeffs);
                }
                if (state.timbres[color].phases && stateToPersist.timbres[color]) {
                    stateToPersist.timbres[color].phases = Array.from(state.timbres[color].phases);
                }
            }
        }

        const serializedState = JSON.stringify(stateToPersist);
        localStorage.setItem(STORAGE_KEY, serializedState);
    } catch (err) {
        logger.error('Store', 'Could not save state to localStorage', err, 'general');
    }
}

const actions = {
    ...historyActions, ...noteActions, ...timbreActions,
    ...rhythmActions, ...viewActions, ...harmonyActions,
    ...paintActions, ...stampActions, ...tripletActions,
    clearSavedState() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            // Also clear effect dial values when creating a new page
            localStorage.removeItem('effectDialValues');
            window.location.reload(); 
        } catch (err) {
            logger.error('Store', 'Could not clear state from localStorage', err, 'general');
        }
    }
};

const _subscribers = {};
const persistedState = loadStateFromLocalStorage();
const isColdStart = !persistedState;

const safeInitialState = {
    ...initialState,
    ...persistedState
};

const store = {
    state: safeInitialState,
    on(eventName, callback) {
        if (!_subscribers[eventName]) _subscribers[eventName] = [];
        _subscribers[eventName].push(callback);
    },
    emit(eventName, data) {
        if (_subscribers[eventName]) {
            _subscribers[eventName].forEach(callback => {
                try { 
                    callback(data); 
                } catch (error) { 
                    logger.error('Store', `Error in listener for event "${eventName}"`, error, 'general'); 
                }
            });
        }
    }
};

store.isColdStart = isColdStart;

for (const key in actions) {
    store[key] = actions[key].bind(store);
}

// Persist tempo adjustments immediately so the slider matches after refresh
store.on('tempoChanged', () => {
    saveStateToLocalStorage(store.state);
});

const originalRecordState = store.recordState;
store.recordState = function(...args) {
    originalRecordState.apply(this, args);
    saveStateToLocalStorage(this.state);
};

if (!persistedState) {
    saveStateToLocalStorage(store.state);
}

export default store;
