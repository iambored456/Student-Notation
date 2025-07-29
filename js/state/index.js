// js/state/index.js
import { initialState } from './initialState/index.js';
import { historyActions } from './actions/historyActions.js';
import { noteActions } from './actions/noteActions.js';
import { timbreActions } from './actions/timbreActions.js';
import { rhythmActions } from './actions/rhythmActions.js';
import { viewActions } from './actions/viewActions.js';
import { harmonyActions } from './actions/harmonyActions.js';

console.log("Store: Modular store loaded.");

const STORAGE_KEY = 'studentNotationState';

// This function is now correct
function loadStateFromLocalStorage() {
    try {
        const serializedState = localStorage.getItem(STORAGE_KEY);
        if (serializedState === null) return undefined;
        const parsedState = JSON.parse(serializedState);
        if (parsedState.timbres) {
            for (const color in parsedState.timbres) {
                const timbre = parsedState.timbres[color];
                if (timbre.coeffs && typeof timbre.coeffs === 'object' && !Array.isArray(timbre.coeffs)) {
                    timbre.coeffs = new Float32Array(Object.values(timbre.coeffs));
                }
            }
        }
        return parsedState;
    } catch (err) {
        console.error("Could not load state from localStorage:", err);
        return undefined;
    }
}

// This function is also now correct
function saveStateToLocalStorage(state) {
    try {
        const stateToPersist = {
            placedNotes: state.placedNotes,
            placedChords: state.placedChords,
            tonicSignGroups: state.tonicSignGroups,
            timbres: state.timbres,
            macrobeatGroupings: state.macrobeatGroupings,
            macrobeatBoundaryStyles: state.macrobeatBoundaryStyles,
            hasAnacrusis: state.hasAnacrusis,
            tempo: state.tempo,
            activeChordIntervals: state.activeChordIntervals,
            selectedNote: state.selectedNote 
        };
        const serializedState = JSON.stringify(stateToPersist);
        localStorage.setItem(STORAGE_KEY, serializedState);
    } catch (err) {
        console.error("Could not save state to localStorage:", err);
    }
}

const actions = {
    ...historyActions, ...noteActions, ...timbreActions,
    ...rhythmActions, ...viewActions, ...harmonyActions,
    clearSavedState() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            window.location.reload(); 
        } catch (err) {
            console.error("Could not clear state from localStorage:", err);
        }
    }
};

const _subscribers = {};
const persistedState = loadStateFromLocalStorage();

// --- THE FIX IS HERE ---
// We create a new, safe initial state by deeply merging the default with what was loaded.
// This ensures that properties missing from localStorage (like selectedNote)
// are correctly populated from the initialState default.
const safeInitialState = {
    ...initialState,
    ...persistedState
};

const store = {
    state: safeInitialState, // Use the safe, merged state
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
                    console.error(`[Store] Error in listener for event "${eventName}":`, error); 
                }
            });
        }
    }
};
// --- END OF FIX ---

for (const key in actions) {
    store[key] = actions[key].bind(store);
}

const originalRecordState = store.recordState;
store.recordState = function(...args) {
    originalRecordState.apply(this, args);
    saveStateToLocalStorage(this.state);
};

// Before starting the app, if there was no saved state,
// we should save the initial default state once.
if (!persistedState) {
    saveStateToLocalStorage(store.state);
}

export default store;