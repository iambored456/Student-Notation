// js/state/index.ts
import { initialState } from './initialState/index.js';
import { fullRowData as masterRowData } from './pitchData.js';
import { historyActions } from './actions/historyActions.js';
import { noteActions, ensureCircleNoteSpan } from './actions/noteActions.js';
import { timbreActions } from './actions/timbreActions.js';
import { rhythmActions } from './actions/rhythmActions.js';
import { viewActions } from './actions/viewActions.js';
import { harmonyActions } from './actions/harmonyActions.js';
import { paintActions } from './actions/paintActions.js';
import { stampActions } from './actions/stampActions.js';
import { tripletActions } from './actions/tripletActions.js';
import logger from '@utils/logger.ts';
import type { AppState, Store } from '../../types/state.js';

logger.moduleLoaded('Store', 'general');

const STORAGE_KEY = 'studentNotationState';

function loadStateFromLocalStorage(): Partial<AppState> | undefined {
  try {
    const serializedState = localStorage.getItem(STORAGE_KEY);
    if (serializedState === null) {
      return undefined;
    }
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

    if (parsedState.printOptions) {
      parsedState.printOptions = {
        ...initialState.printOptions,
        ...parsedState.printOptions
      };
    }

    if (parsedState.pitchRange) {
      const totalRows = masterRowData?.length || (parsedState.fullRowData?.length) || 0;
      const maxIndex = Math.max(0, totalRows - 1);
      const topIndex = Math.max(0, Math.min(maxIndex, parsedState.pitchRange.topIndex ?? 0));
      const bottomIndex = Math.max(topIndex, Math.min(maxIndex, parsedState.pitchRange.bottomIndex ?? maxIndex));
      parsedState.pitchRange = { topIndex, bottomIndex };
    }

    if (!Array.isArray(parsedState.parkedNotes)) {
      parsedState.parkedNotes = [];
    }

    if (parsedState.placedNotes?.length) {
      parsedState.placedNotes.forEach(ensureCircleNoteSpan);
    }
    if (parsedState.parkedNotes?.length) {
      parsedState.parkedNotes.forEach(ensureCircleNoteSpan);
    }

    return parsedState;
  } catch (err) {
    logger.error('Store', 'Could not load state from localStorage', err, 'general');
    return undefined;
  }
}

function saveStateToLocalStorage(state: AppState): void {
  try {
    // Create a deep copy of the state to avoid modifying the live state object
    const stateToPersist = JSON.parse(JSON.stringify({
      placedNotes: state.placedNotes,
      parkedNotes: state.parkedNotes,
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
      isPitchRangeLocked: state.isPitchRangeLocked,
      degreeDisplayMode: state.degreeDisplayMode,
      paint: {
        paintHistory: state.paint.paintHistory,
        paintSettings: state.paint.paintSettings
      }
    }));

    // THE FIX: Correctly convert the live Float32Array into a storable Array.
    if (state.timbres) {
      for (const color in state.timbres) {
        const timbre = state.timbres[color];
        const persistTimbre = stateToPersist.timbres?.[color];
        if (timbre?.coeffs && persistTimbre) {
          persistTimbre.coeffs = Array.from(timbre.coeffs);
        }
        if (timbre?.phases && persistTimbre) {
          persistTimbre.phases = Array.from(timbre.phases);
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

type EventCallback = (data?: any) => void;
const _subscribers: Record<string, EventCallback[]> = {};
const persistedState = loadStateFromLocalStorage();
const isColdStart = !persistedState;

const safeInitialState: AppState = {
  ...initialState,
  ...persistedState
} as AppState;

const store = {
  state: safeInitialState,
  on(eventName: string, callback: EventCallback) {
    if (!_subscribers[eventName]) {_subscribers[eventName] = [];}
    _subscribers[eventName].push(callback);
  },
  emit(eventName: string, data?: any) {
    if (_subscribers[eventName]) {
      _subscribers[eventName].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error('Store', `Error in listener for event "${eventName}"`, error, 'general');
        }
      });
    }
  },
  _isBoundaryInAnacrusis: () => false,
  // Placeholder methods - will be replaced by action bindings
  addNote: () => null,
  updateNoteTail: () => {},
  updateMultipleNoteTails: () => {},
  updateNoteRow: () => {},
  updateMultipleNoteRows: () => {},
  removeNote: () => {},
  removeMultipleNotes: () => {},
  clearAllNotes: () => {},
  loadNotes: () => {},
  recordState: () => {},
  undo: () => {},
  redo: () => {},
  clearSavedState: () => {},
  setPlaybackState: () => {},
  setLooping: () => {},
  setADSR: () => {},
  setAdsrTimeAxisScale: () => {},
  setAdsrComponentWidth: () => {},
  setPaintSettings: () => {},
  setMicPaintActive: () => {},
  addPaintPoint: () => {},
  clearPaintHistory: () => {},
  setPaintDetectionState: () => {},
  setDetectedPitch: () => {},
  increaseMacrobeatCount: () => {},
  decreaseMacrobeatCount: () => {},
  updateTimeSignature: () => {},
  setAnacrusis: () => {},
  addModulationMarker: () => null,
  removeModulationMarker: () => {},
  setModulationRatio: () => {},
  clearModulationMarkers: () => {},
  addStampPlacement: () => ({}) as any,
  removeStampPlacement: () => false,
  eraseStampsInArea: () => false,
  getAllStampPlacements: () => [],
  getStampAt: () => null,
  clearAllStamps: () => {},
  getStampPlaybackData: () => [],
  addTripletPlacement: () => ({}) as any,
  removeTripletPlacement: () => false,
  eraseTripletsInArea: () => false,
  getAllTripletPlacements: () => [],
  getTripletAt: () => null,
  clearAllTripletPlacements: () => {},
  getTripletPlaybackData: () => [],
  setSelectedTool: () => {},
  setSelectedNote: () => {},
  setTempo: () => {},
  applyPreset: () => {},
  setPitchRange: () => {},
  setLayoutConfig: () => {},
  setSnapZoomToRange: () => {},
  setActiveChordIntervals: () => {},
  setIntervalsInversion: () => {},
  setChordPosition: () => {},
  toggleAccidentalMode: () => {},
  toggleFrequencyLabels: () => {},
  toggleFocusColours: () => {},
  setDegreeDisplayMode: () => {},
  toggleWaveformExtendedView: () => {},
  shiftGridUp: () => {},
  shiftGridDown: () => {},
  toggleMacrobeatGrouping: () => {},
  cycleMacrobeatBoundaryStyle: () => {},
  setFilterSettings: () => {},
  setDeviceProfile: () => {},
  setPrintPreviewActive: () => {},
  setPrintOptions: () => {}
} as Store;

store.isColdStart = isColdStart;

for (const key in actions) {
  (store as Record<string, unknown>)[key] = (actions as Record<string, unknown>)[key];
}

// Persist tempo adjustments immediately so the slider matches after refresh
store.on('tempoChanged', () => {
  saveStateToLocalStorage(store.state);
});

// Persist degree display mode changes immediately
store.on('degreeDisplayModeChanged', () => {
  saveStateToLocalStorage(store.state);
});

const originalRecordState = store.recordState;
store.recordState = function() {
  originalRecordState.call(this);
  saveStateToLocalStorage((this).state);
};

if (!persistedState) {
  saveStateToLocalStorage(store.state);
}

export default store;
