// js/main.js

/**
 * DEBUGGING WITH LOGGER:
 *
 * By default, all logging is OFF except errors. To enable logging for debugging:
 *
 * In browser console:
 * - logger.enable('category') - Enable specific categories
 * - logger.enableAll() - Enable all logging
 * - logger.setLevel('DEBUG') - Enable all debug logs
 *
 * Categories: general, state, canvas, audio, ui, layout, harmony, paint,
 *            performance, initialization, transport, grid, toolbar, zoom,
 *            scroll, keyboard, mouse, adsr, filter, waveform, debug
 *
 * Examples:
 * - logger.enable('state') - See state changes
 * - logger.enable('audio', 'transport') - See audio/transport logs
 * - logger.enable('ui', 'grid') - See UI interactions and grid events
 */
import * as Tone from 'tone';
import store from '@state/index.js';
import { fullRowData } from '@state/pitchData.js';
import LayoutService from '@services/layoutService.js';
import PitchGridController from '@components/canvas/pitchGrid/pitchGrid.js';
import PrintService from '@services/printService.js';
import SynthEngine from '@services/synthEngine.js';
import TransportService from '@services/transportService.js';
import { initDeviceProfileService } from '@services/deviceProfileService.js';
import domCache from '@services/domCache.js';
import logger from '@utils/logger.js';
import loadingManager from './loadingManager.js';
import { enableStateMutationDetection, snapshotState, checkForMutations } from '@utils/stateMutationGuard.js';
// NOTE: effectsController.js handles UI dials and lives in @components/audio/Effects/
// All effects logic has been moved to @services/timbreEffects/ architecture

import rhythmPlaybackService from '@services/rhythmPlaybackService.js';



// Zoom System Components


// Modulation Testing (keep for advanced debugging)
import ModulationTest from '@/rhythm/modulationTest.js';
import { initUiComponents } from '@/bootstrap/ui/initUiComponents.js';
import { initAudioComponents } from '@/bootstrap/audio/initAudioComponents.js';
import { initRhythmUi } from '@/bootstrap/rhythm/initRhythmUi.js';
import { initCanvasServices } from '@/bootstrap/canvas/initCanvasServices.js';
import { initPaintSystem } from '@/bootstrap/paint/initPaintSystem.js';
import { initDrawSystem } from '@/bootstrap/draw/initDrawSystem.js';
import { initInputAndDiagnostics } from '@/bootstrap/input/initInputAndDiagnostics.js';
import { initStateSubscriptions } from '@/bootstrap/state/initStateSubscriptions.js';


// Global audio initialization function
let audioInitialized = false;
let audioInitPromise = null;
window.initAudio = async () => {
  if (audioInitialized) {return true;}
  if (audioInitPromise) {return audioInitPromise;} // Return existing promise to prevent multiple attempts

  audioInitPromise = (async () => {
    try {
      // Only start if the context is not already running
      if (Tone.context.state !== 'running') {
        await Tone.start();
        logger.info('Main.js', 'AudioContext started successfully');
      }
      audioInitialized = true;
      return true;
    } catch (e) {
      logger.error('Main.js', 'Could not start AudioContext', e);
      audioInitPromise = null; // Reset promise on failure so it can be retried
      return false;
    }
  })();

  return audioInitPromise;
};

// Auto-initialize audio on first user interaction to prevent console warnings
let userInteractionReceived = false;
const initAudioOnInteraction = () => {
  if (!userInteractionReceived) {
    userInteractionReceived = true;
    window.initAudio().catch(e => logger.warn('Main.js', 'Failed to initialize audio after user interaction', e, 'initialization'));
    // Remove listeners after first interaction
    document.removeEventListener('click', initAudioOnInteraction, true);
    document.removeEventListener('keydown', initAudioOnInteraction, true);
    document.removeEventListener('touchstart', initAudioOnInteraction, true);
  }
};

// Listen for any user interaction to initialize audio
document.addEventListener('click', initAudioOnInteraction, true);
document.addEventListener('keydown', initAudioOnInteraction, true);
document.addEventListener('touchstart', initAudioOnInteraction, true);
window.addEventListener('beforeunload', () => {
  if (typeof SynthEngine.teardown === 'function') {
    SynthEngine.teardown();
  }
});

// ? Component readiness tracking for initialization order safeguards
const componentReadiness = {
  domCache: false,
  layoutService: false,
  canvasContextService: false,
  synthEngine: false,
  transportService: false,
  scrollSync: false,
  uiComponents: false,
  audioComponents: false,
  initialized: false
};

const TREBLE_CLEF_PRESET_TONES = {
  top: 'Ab5',
  bottom: 'C4'
};

function resolveRangeFromToneNotes(preset) {
  if (!preset?.top || !preset?.bottom) {
    return null;
  }

  const topIndex = fullRowData.findIndex(row => row.toneNote === preset.top);
  const bottomIndex = fullRowData.findIndex(row => row.toneNote === preset.bottom);

  if (topIndex === -1 || bottomIndex === -1) {
    logger.warn('Main.js', 'Failed to resolve preset range from tone notes', preset);
    return null;
  }

  return {
    topIndex: Math.min(topIndex, bottomIndex),
    bottomIndex: Math.max(topIndex, bottomIndex)
  };
}

function getTrebleClefPresetRange() {
  return resolveRangeFromToneNotes(TREBLE_CLEF_PRESET_TONES);
}

function markComponentReady(componentName) {
  componentReadiness[componentName] = true;
  // Component ready
}

function waitForComponent(componentName, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (componentReadiness[componentName]) {
      resolve();
      return;
    }

    const startTime = Date.now();
    const checkReady = () => {
      if (componentReadiness[componentName]) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Component ${componentName} not ready within ${timeout}ms`));
      } else {
        setTimeout(checkReady, 50);
      }
    };
    checkReady();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  window.initStartTime = Date.now();
  logger.info('Main.js', 'DOMContentLoaded event fired');
  logger.section('STARTING INITIALIZATION');
  // Starting initialization sequence
  const loadingPhases = [
    'dom-cache',
    'core-services',
    'ui-components',
    'audio-components',
    'initial-render',
    'finalize'
  ];

  try {
    await loadingManager.init();
    loadingPhases.forEach(phase => loadingManager.registerTask(phase));
    initDeviceProfileService();

    // ? Enable state mutation detection in development mode
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Enabling state mutation detection
      enableStateMutationDetection();
    }

    // Initialize DOM cache first
    // Phase 1: Initializing DOM cache
    loadingManager.updateStatus('Initializing interface...');
    domCache.init();
    markComponentReady('domCache');
    loadingManager.completeTask('dom-cache');

    // Setup user gesture handlers for audio initialization
    const setupAudioGesture = () => {
      const appContainer = domCache.get('appContainer') || document.getElementById('app-container');
      if (appContainer) {
        const events = ['click', 'keydown', 'touchstart'];
        events.forEach(eventType => {
          appContainer.addEventListener(eventType, window.initAudio, { once: true });
        });
      }
    };
    setupAudioGesture();

    // Initialize core data and services
    // Phase 2: Initializing core services
    loadingManager.updateStatus('Preparing core systems...');

    // ? Take initial state snapshot before any mutations
    snapshotState(store.state);

    // TEMPORARY: This is the one allowed direct state mutation during initialization
    const initialPitchRange = store.state.pitchRange || {
      topIndex: 0,
      bottomIndex: fullRowData.length - 1
    };
    const clampedTop =
        Math.max(0, Math.min(fullRowData.length - 1, initialPitchRange.topIndex ?? 0));
    const clampedBottom =
        Math.max(clampedTop, Math.min(fullRowData.length - 1, initialPitchRange.bottomIndex ?? (fullRowData.length - 1)));
    store.state.pitchRange = { topIndex: clampedTop, bottomIndex: clampedBottom };
    store.state.fullRowData = fullRowData.slice(clampedTop, clampedBottom + 1);
    // Allowed initialization mutation: fullRowData assignment

    // Phase 2a-b: Initializing layout + canvas services
    await initCanvasServices();
    markComponentReady('layoutService');
    markComponentReady('canvasContextService');

    // Phase 2c: Initializing SynthEngine
    SynthEngine.init();
    markComponentReady('synthEngine');

    // Phase 2c-1: Initializing RhythmPlaybackService
    // Don't await - this may need user interaction for audio context
    rhythmPlaybackService.initialize().catch(err => {
      logger.warn('Main.js', 'RhythmPlaybackService initialization deferred (needs user interaction)', err, 'initialization');
    });
    markComponentReady('rhythmPlaybackService');

    // Phase 2d: Initializing TransportService
    TransportService.init();
    markComponentReady('transportService');

    // Phase 2e: Initializing input handlers
    initInputAndDiagnostics();
    loadingManager.completeTask('core-services');

    // Phase 3: Initializing UI components
    loadingManager.updateStatus('Loading interface components...');
    await initUiComponents();
    markComponentReady('uiComponents');
    loadingManager.completeTask('ui-components');

    // Wait for UI components before audio components
    await waitForComponent('uiComponents');
    // Phase 4: Initializing audio components
    loadingManager.updateStatus('Preparing audio components...');
    await initAudioComponents();
    markComponentReady('audioComponents');
    loadingManager.completeTask('audio-components');

    // ? Check for unauthorized state mutations after audio components
    checkForMutations(store.state, 'audio-components-initialization');

    // Rhythm UI interactions
    initRhythmUi();

    await initPaintSystem();
    initDrawSystem();

    // Wait for all components before setting up event subscriptions
    await waitForComponent('audioComponents');
    // Phase 5: Setting up event subscriptions
    logger.section('SETTING UP STATE SUBSCRIPTIONS');

    const { renderAll } = initStateSubscriptions(store, componentReadiness);

    logger.section('PERFORMING INITIAL RENDER');

    store.setSelectedTool('note');
    store.setSelectedNote('circle', '#4a90e2');

    // Perform initial render explicitly to ensure canvas is drawn even on page refresh
    // This is necessary because LayoutService.init() uses requestAnimationFrame which may
    // fire before event listeners are set up, causing the initial layoutConfigChanged
    // event to be missed.
    loadingManager.updateStatus('Rendering workspace...');
    renderAll();
    PitchGridController.renderMacrobeatTools();
    loadingManager.completeTask('initial-render');
    PrintService.prefetchButtonGridSnapshot();

    markComponentReady('initialized');
    // Initialization sequence completed successfully

    logger.section('INITIALIZATION COMPLETE');
    loadingManager.updateStatus('Finalizing...');
    loadingManager.completeTask('finalize');

    if (store.isColdStart) {
      const treblePresetRange = getTrebleClefPresetRange();
      const currentRange = store.state.pitchRange;
      const alreadyApplied = treblePresetRange &&
            currentRange &&
            currentRange.topIndex === treblePresetRange.topIndex &&
            currentRange.bottomIndex === treblePresetRange.bottomIndex;

      const isLocked = store.state.isPitchRangeLocked !== false;

      if (treblePresetRange && !alreadyApplied) {
        logger.info('Main.js', `Cold start detected, applying Treble Clef preset range (locked=${isLocked})`);
        store.setSnapZoomToRange(isLocked);
        store.setPitchRange(treblePresetRange, {
          trimOutsideRange: isLocked,
          preserveContent: !isLocked
        });

        if (isLocked && LayoutService.snapZoomToCurrentRange) {
          LayoutService.snapZoomToCurrentRange();
        } else if (LayoutService.recalculateLayout) {
          LayoutService.recalculateLayout();
        }
      } else if (!treblePresetRange) {
        logger.warn('Main.js', 'Treble Clef preset range could not be resolved during cold start');
      }
    }

    await loadingManager.complete();

    // Initialize modulation testing (keep for advanced debugging)
    window.ModulationTest = ModulationTest;

    // Log viewport info after initialization (currently disabled)
    // setTimeout(() => {
    //   if (LayoutService.getViewportInfo) {
    //     // TODO: Log viewport info
    //   }
    // }, 1000);

  } catch (error) {
    logger.error('Main.js', 'Initialization failed', error, 'initialization');
    logger.error('Main.js', 'Component readiness snapshot at failure', { ...componentReadiness }, 'initialization');
    loadingManager.showError(error);

    // Show user-friendly error message
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #ff4444; color: white; padding: 20px; border-radius: 8px;
            z-index: 10000; font-family: monospace; max-width: 80vw;
        `;
    errorDiv.innerHTML = `
            <h3>Initialization Error</h3>
            <p>The application failed to initialize properly.</p>
            <details>
                <summary>Technical Details</summary>
                <pre>${error.message}</pre>
                <pre>Stack: ${error.stack}</pre>
            </details>
            <button onclick="location.reload()">Reload Page</button>
        `;
    document.body.appendChild(errorDiv);
  }
});
