// js/state/index.js
import { initialState } from './initialState/index.js';
import { historyActions } from './actions/historyActions.js';
import { noteActions } from './actions/noteActions.js';
import { timbreActions } from './actions/timbreActions.js';
import { rhythmActions } from './actions/rhythmActions.js';
import { viewActions } from './actions/viewActions.js';
import { harmonyActions } from './actions/harmonyActions.js';

console.log("Store: Modular store loaded.");

// --- NEW: PERSISTENCE LOGIC ---
const STORAGE_KEY = 'studentNotationState';

function loadStateFromLocalStorage() {
    try {
        const serializedState = localStorage.getItem(STORAGE_KEY);
        if (serializedState === null) {
            return undefined; // No state found
        }
        const parsedState = JSON.parse(serializedState);

        // --- ADD THIS "REHYDRATION" LOGIC ---
        // Ensure timbre coefficients are Float32Array
        if (parsedState.timbres) {
            for (const color in parsedState.timbres) {
                const timbre = parsedState.timbres[color];
                if (timbre.coeffs && typeof timbre.coeffs === 'object' && !Array.isArray(timbre.coeffs)) {
                    // It's a plain object from JSON, convert it back.
                    const coefficentValues = Object.values(timbre.coeffs);
                    timbre.coeffs = new Float32Array(coefficentValues);
                }
            }
        }
        // --- END REHYDRATION LOGIC ---

        return parsedState;
    } catch (err) {
        console.error("Could not load state from localStorage:", err);
        return undefined;
    }
}

function saveStateToLocalStorage(state) {
    try {
        // We only persist the data that represents the user's "document"
        const stateToPersist = {
            placedNotes: state.placedNotes,
            placedChords: state.placedChords, // Save chords
            tonicSignGroups: state.tonicSignGroups,
            timbres: state.timbres,
            macrobeatGroupings: state.macrobeatGroupings,
            macrobeatBoundaryStyles: state.macrobeatBoundaryStyles,
            hasAnacrusis: state.hasAnacrusis,
            tempo: state.tempo
        };
        const serializedState = JSON.stringify(stateToPersist);
        localStorage.setItem(STORAGE_KEY, serializedState);
    } catch (err) {
        console.error("Could not save state to localStorage:", err);
    }
}
// --- END: NEW PERSISTENCE LOGIC ---

const actions = {
    ...historyActions,
    ...noteActions,
    ...timbreActions,
    ...rhythmActions,
    ...viewActions,
    ...harmonyActions, // <-- THIS LINE FIXES THE CRASH
    // --- NEW: Action to clear saved state ---
    clearSavedState() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            console.log("Saved state cleared from localStorage.");
            // Optional: You could reload the page to reset the app
            window.location.reload(); 
        } catch (err) {
            console.error("Could not clear state from localStorage:", err);
        }
    }
};

const _subscribers = {};

// --- MODIFIED: Load persisted state on startup ---
const persistedState = loadStateFromLocalStorage();

const store = {
    // Merge the default initial state with any persisted state
    state: {
        ...initialState,
        ...persistedState 
    },

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

for (const key in actions) {
    store[key] = actions[key].bind(store);
}

// --- MODIFIED: Automatically save state when history is recorded ---
// We hook into `recordState` as it's the perfect trigger for saving.
const originalRecordState = store.recordState;
store.recordState = function(...args) {
    originalRecordState.apply(this, args);
    saveStateToLocalStorage(this.state);
};

export default store;