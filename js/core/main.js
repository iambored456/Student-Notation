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
import store from '../state/index.js';
import { fullRowData } from '../state/pitchData.js';
import LayoutService from '../services/layoutService.js';
import CanvasContextService from '../services/canvasContextService.js';
import SynthEngine from '../services/synthEngine.js';
import TransportService from '../services/transportService.js';
import domCache from '../services/domCache.js';
import logger from '../utils/logger.js';
import { initSpacebarHandler } from '../services/spacebarHandler.js';
import { enableStateMutationDetection, snapshotState, checkForMutations, createProtectedStore } from '../utils/stateMutationGuard.js';
import { initGridScrollHandler } from '../services/gridScrollHandler.js';
import { initKeyboardHandler } from '../services/keyboardHandler.js';
import scrollSyncService from '../services/scrollSyncService.js';
import Toolbar from '../components/Toolbar/Toolbar.js';
import GridManager from '../components/Canvas/PitchGrid/gridManager.js';
import PitchGridController from '../components/Canvas/PitchGrid/PitchGrid.js';
import Harmony from '../components/Canvas/HarmonyAnalysis/Harmony.js';
import { initHarmonicBins } from '../components/audio/HarmonicsFilter/harmonicBins.js';
import { initAdsrComponent } from '../components/audio/ADSR/adsrComponent.js';
import { initFilterControls } from '../components/audio/HarmonicsFilter/filterControls.js';
import PrintPreview from '../components/UI/PrintPreview.js';
import { initStaticWaveformVisualizer } from '../components/StaticWaveform/staticWaveformVisualizer.js';
import simpleEffectsTest from '../components/audio/Effects/simpleEffectsTest.js';

// Paint Components
import PaintCanvas from '../components/PitchPaint/paintCanvas.js';
import PaintPlayheadRenderer from '../components/PitchPaint/paintPlayheadRenderer.js';
import PaintControls from '../components/PitchPaint/paintControls.js';

// Meter Components
import MeterController from '../components/audio/Meter/MeterController.js';

// Zoom System Components
import ZoomIndicator from '../components/UI/ZoomIndicator.js';

// Stamps Toolbar Component
import StampsToolbar from '../components/Rhythm/StampsToolbar/StampsToolbar.js';
import TripletsToolbar from '../components/Rhythm/StampsToolbar/TripletsToolbar.js';

// Modulation Testing (keep for advanced debugging)
import ModulationTest from '../rhythm/modulationTest.js';


function initializeNewZoomSystem() {
    ZoomIndicator.initialize();
        document.addEventListener('keydown', (e) => {
        const activeElement = document.activeElement.tagName.toLowerCase();
        if (['input', 'textarea'].includes(activeElement)) {
            return;
        }

        if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
            e.preventDefault();
            store.emit('zoomIn');
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === '-') {
            e.preventDefault();
            store.emit('zoomOut');
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === '0') {
            e.preventDefault();
            if (LayoutService.resetZoom) {
                LayoutService.resetZoom();
            }
        }
    });
    
}

function setupDebugTools() {
    window.debugZoom = {
        info: () => LayoutService.getViewportInfo ? LayoutService.getViewportInfo() : 'Viewport info not available',
        zoomTo: (level) => {
            logger.debug('Debug Tools', `Setting zoom to ${level}`, null, 'zoom');
            // This would need to be implemented in LayoutService
        },
        scrollTo: (position) => {
            logger.debug('Debug Tools', `Scrolling to position ${position}`, null, 'scroll');
            if (LayoutService.scroll) {
                // Assuming position is a value from 0 to 1
                const viewportInfo = LayoutService.getViewportInfo();
                const currentScrollPixels = viewportInfo.scrollPosition * (store.state.fullRowData.length * store.state.cellHeight * 0.5);
                const targetScrollPixels = position * (store.state.fullRowData.length * store.state.cellHeight * 0.5);
                LayoutService.scroll(targetScrollPixels - currentScrollPixels);
            }
        },
        goToNote: (noteName) => {
            if (LayoutService.scrollToNote) {
                LayoutService.scrollToNote(noteName);
            } else {
                logger.warn('Debug Tools', `scrollToNote not available. Requested: ${noteName}`, null, 'debug');
            }
        }
    };
}

// Global audio initialization function
let audioInitialized = false;
window.initAudio = async () => {
    if (audioInitialized) return true;
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
        return false;
    }
};

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
    console.log('🚀 [INIT] Component ready:', componentName, {
        readiness: componentReadiness,
        totalReady: Object.values(componentReadiness).filter(r => r).length,
        totalComponents: Object.keys(componentReadiness).length
    });
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
    console.log('🚀 [INIT] Starting initialization sequence');
    
    try {
    
    // ✅ Enable state mutation detection in development mode
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('🛡️ [DEV MODE] Enabling state mutation detection');
        enableStateMutationDetection();
    }
    
    // Initialize DOM cache first
    console.log('🚀 [INIT] Phase 1: Initializing DOM cache');
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
    console.log('🚀 [INIT] Phase 2: Initializing core services');
    
    // ✅ Take initial state snapshot before any mutations
    snapshotState(store.state);
    
    // TEMPORARY: This is the one allowed direct state mutation during initialization
    store.state.fullRowData = fullRowData;
    console.log('🛡️ [STATE GUARD] Allowed initialization mutation: fullRowData assignment');
    
    console.log('🚀 [INIT] Phase 2a: Initializing LayoutService');
    const contexts = LayoutService.init();
    markComponentReady('layoutService');
    
    console.log('🚀 [INIT] Phase 2b: Initializing CanvasContextService');
    CanvasContextService.setContexts(contexts);
    markComponentReady('canvasContextService');
    
    console.log('🚀 [INIT] Phase 2c: Initializing SynthEngine');
    SynthEngine.init();
    markComponentReady('synthEngine');
    
    console.log('🚀 [INIT] Phase 2d: Initializing TransportService');
    TransportService.init();
    markComponentReady('transportService');
    
    console.log('🚀 [INIT] Phase 2e: Initializing input handlers');
    initSpacebarHandler();
    initGridScrollHandler(); // This will now work correctly
    initKeyboardHandler();
    
    // Wait for core services before initializing scroll sync
    await waitForComponent('layoutService');
    await waitForComponent('canvasContextService');
    console.log('🚀 [INIT] Phase 2f: Initializing scroll synchronization');
    scrollSyncService.init();
    markComponentReady('scrollSync');
    
    // ✅ Check for unauthorized state mutations after core services
    checkForMutations(store.state, 'core-services-initialization');
    
    // Wait for scroll sync before UI components  
    await waitForComponent('scrollSync');
    console.log('🚀 [INIT] Phase 3: Initializing UI components');
    Toolbar.init();
    GridManager.init();
    Harmony.init();
    PrintPreview.init();
    
    // Initialize Stamps Toolbar
    StampsToolbar.init();
    
    // Initialize Triplets Toolbar
    TripletsToolbar.init();
    
    markComponentReady('uiComponents');
    
    // Wait for UI components before audio components
    await waitForComponent('uiComponents');
    console.log('🚀 [INIT] Phase 4: Initializing audio components');
    initAdsrComponent();
    initHarmonicBins();
    initFilterControls();
    
    markComponentReady('audioComponents');
    
    // ✅ Check for unauthorized state mutations after audio components
    checkForMutations(store.state, 'audio-components-initialization');
    
    // Initialize Rhythm Tabs
    initRhythmTabs();

    // Initialize static waveform visualizer
    logger.initStart('Static Waveform Visualizer');
    if (initStaticWaveformVisualizer()) {
        logger.initSuccess('Static Waveform Visualizer');
    } else {
        logger.initFailed('Static Waveform Visualizer');
    }

    // Initialize simple effects test
    simpleEffectsTest.init();

    // Initialize Paint components
    logger.initStart('Paint components');
    PaintCanvas.initialize();
    PaintPlayheadRenderer.initialize();
    PaintControls.initialize();
    MeterController.initialize();
    logger.initSuccess('Paint components');
    
    // NEW: Initialize the enhanced zoom system
    initializeNewZoomSystem();
    setupDebugTools();
    
    // Wait for all components before setting up event subscriptions
    await waitForComponent('audioComponents');
    console.log('🚀 [INIT] Phase 5: Setting up event subscriptions');
    logger.section('SETTING UP STATE SUBSCRIPTIONS');
    
    const renderAll = () => {
        console.log('🔄 [EVENTS] renderAll() called - checking component readiness');
        if (!componentReadiness.uiComponents) {
            console.warn('⚠️ [EVENTS] UI components not ready, skipping render');
            return;
        }
        GridManager.renderPitchGrid();
        GridManager.renderDrumGrid();
        Harmony.render();
    };

    store.on('notesChanged', () => {
        console.log('🔄 [EVENTS] notesChanged event received');
        renderAll();
    });
    store.on('stampPlacementsChanged', () => {
        console.log('🔄 [EVENTS] stampPlacementsChanged event received');
        renderAll();
    });
    store.on('tripletPlacementsChanged', () => {
        console.log('🔄 [EVENTS] tripletPlacementsChanged event received');
        renderAll();
    });
    store.on('modulationMarkersChanged', () => {
        console.log('🔄 [EVENTS] modulationMarkersChanged event received');
        logger.event('Main', 'modulationMarkersChanged event received, recalculating layout', null, 'state');
        if (!componentReadiness.layoutService) {
            console.warn('⚠️ [EVENTS] LayoutService not ready, skipping layout recalculation');
            return;
        }
        LayoutService.recalculateLayout();
        logger.debug('Main', 'Layout recalculated for modulation, calling renderAll()', null, 'state');
        renderAll();
        logger.debug('Main', 'renderAll() completed, calling renderMacrobeatTools() for modulation', null, 'state');
        PitchGridController.renderMacrobeatTools();
        logger.debug('Main', 'modulationMarkersChanged handling complete', null, 'state');
    });
    
    store.on('rhythmStructureChanged', () => {
        logger.event('Main', 'rhythmStructureChanged event received, recalculating layout', null, 'state');
        LayoutService.recalculateLayout();
        logger.debug('Main', 'Layout recalculated, calling renderAll()', null, 'state');
        renderAll();
        logger.debug('Main', 'renderAll() completed, calling renderMacrobeatTools()', null, 'state');
        PitchGridController.renderMacrobeatTools();
        logger.debug('Main', 'rhythmStructureChanged handling complete', null, 'state');
    });

    store.on('layoutConfigChanged', () => {
        renderAll();
        PitchGridController.renderMacrobeatTools();
    });

    // NEW: Enhanced zoom event handling
    store.on('zoomIn', () => {
        logger.event('Main', 'Zoom in event received', null, 'zoom');
        LayoutService.zoomIn();
    });
    
    store.on('zoomOut', () => {
        logger.event('Main', 'Zoom out event received', null, 'zoom');
        LayoutService.zoomOut();
    });

    logger.section('PERFORMING INITIAL RENDER');
    
    store.setSelectedTool('note');
    store.setSelectedNote('circle', '#4a90e2');
    
    markComponentReady('initialized');
    console.log('🚀 [INIT] ✅ Initialization sequence completed successfully!', {
        totalTime: Date.now() - (window.initStartTime || Date.now()),
        allComponentsReady: Object.values(componentReadiness).every(r => r)
    });
    
    logger.section('INITIALIZATION COMPLETE');
    
    // Initialize modulation testing (keep for advanced debugging)
    window.ModulationTest = ModulationTest;
    
    // Log viewport info after initialization
    setTimeout(() => {
        if (LayoutService.getViewportInfo) {
        }
    }, 1000);
    
    } catch (error) {
        console.error('❌ [INIT] Initialization failed:', error);
        console.error('❌ [INIT] Component readiness at failure:', componentReadiness);
        logger.error('Main.js', 'Initialization failed', error);
        
        // Show user-friendly error message
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #ff4444; color: white; padding: 20px; border-radius: 8px;
            z-index: 10000; font-family: monospace; max-width: 80vw;
        `;
        errorDiv.innerHTML = `
            <h3>🚫 Initialization Error</h3>
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

// Rhythm Tabs Functionality
function initRhythmTabs() {
    
    const rhythmContainer = document.querySelector('.rhythm-stamps-container');
    const rhythmTabSidebar = document.querySelector('.rhythm-tab-sidebar');
    const rhythmTabContent = document.querySelector('.rhythm-tab-content');
    const rhythmTabButtons = document.querySelectorAll('.rhythm-tab-button');
    const rhythmTabPanels = document.querySelectorAll('.rhythm-tab-panel');
    
    
    if (rhythmContainer) {
        const containerStyles = window.getComputedStyle(rhythmContainer);
        
        // Check if we have the expected classes
    }
    
    if (rhythmTabSidebar) {
        const sidebarStyles = window.getComputedStyle(rhythmTabSidebar);
    }
    
    if (!rhythmTabButtons.length || !rhythmTabPanels.length) {
        return;
    }
    
    rhythmTabButtons.forEach((button, index) => {
        
        button.addEventListener('click', (e) => {
            const targetTab = button.getAttribute('data-rhythm-tab');
            
            // Remove active class from all buttons and panels
            rhythmTabButtons.forEach(btn => btn.classList.remove('active'));
            rhythmTabPanels.forEach(panel => panel.classList.remove('active'));
            
            // Add active class to clicked button and corresponding panel
            button.classList.add('active');
            const targetPanel = document.getElementById(`${targetTab}-panel`);
            
            if (targetPanel) {
                targetPanel.classList.add('active');
            } else {
            }
        });
    });
    
}