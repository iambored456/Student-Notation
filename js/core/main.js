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
import GridManager from '@components/canvas/pitchGrid/gridManager.js';
import PitchGridController from '@components/canvas/pitchGrid/pitchGrid.js';
import SynthEngine from '@services/synthEngine.js';
import TransportService from '@services/transportService.js';
import domCache from '@services/domCache.js';
import logger from '@utils/logger.js';
import { enableStateMutationDetection, snapshotState, checkForMutations, createProtectedStore } from '@utils/stateMutationGuard.js';
// NOTE: effectsController.js handles UI dials and lives in @components/audio/Effects/
// All effects logic has been moved to @services/timbreEffects/ architecture

import rhythmPlaybackService from '@services/rhythmPlaybackService.js';

import annotationService from '@services/annotationService.js';



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
    if (audioInitialized) return true;
    if (audioInitPromise) return audioInitPromise; // Return existing promise to prevent multiple attempts
    
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
        window.initAudio().catch(e => console.warn('Failed to initialize audio:', e));
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

// ✅ Component readiness tracking for initialization order safeguards
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

document.addEventListener("DOMContentLoaded", async () => {
    window.initStartTime = Date.now();
    logger.info('Main.js', 'DOMContentLoaded event fired');
    logger.section('STARTING INITIALIZATION');
    // Starting initialization sequence
    
    try {
    
    // ✅ Enable state mutation detection in development mode
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Enabling state mutation detection
        enableStateMutationDetection();
    }
    
    // Initialize DOM cache first
    // Phase 1: Initializing DOM cache
    domCache.init();
    markComponentReady('domCache');

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
    
    // ✅ Take initial state snapshot before any mutations
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
        console.warn('[INIT] RhythmPlaybackService initialization deferred (needs user interaction):', err);
    });
    markComponentReady('rhythmPlaybackService');

    // Phase 2d: Initializing TransportService
    TransportService.init();
    markComponentReady('transportService');

    // Phase 2e: Initializing input handlers
    initInputAndDiagnostics();

    // Phase 3: Initializing UI components
    await initUiComponents();
    markComponentReady('uiComponents');

    // Wait for UI components before audio components
    await waitForComponent('uiComponents');
    // Phase 4: Initializing audio components
    await initAudioComponents();
    markComponentReady('audioComponents');

    // ✅ Check for unauthorized state mutations after audio components
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
    renderAll();
    PitchGridController.renderMacrobeatTools();

    markComponentReady('initialized');
    // Initialization sequence completed successfully

    logger.section('INITIALIZATION COMPLETE');
    
    // Initialize modulation testing (keep for advanced debugging)
    window.ModulationTest = ModulationTest;
    
    // Log viewport info after initialization
    setTimeout(() => {
        if (LayoutService.getViewportInfo) {
        }
    }, 1000);
    
    } catch (error) {
        console.error('[INIT] ❌ INITIALIZATION FAILED:', error);
        console.error('[INIT] Error stack:', error.stack);
        console.error('[INIT] Component readiness at failure:', componentReadiness);
        logger.error('Main.js', 'Initialization failed', error);
        
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
