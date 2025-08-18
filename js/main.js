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
import store from './state/index.js';
import { fullRowData } from './state/pitchData.js';
import LayoutService from './services/layoutService.js';
import CanvasContextService from './services/canvasContextService.js';
import SynthEngine from './services/synthEngine.js';
import TransportService from './services/transportService.js';
import domCache from './services/domCache.js';
import logger from './utils/logger.js';
import { initSpacebarHandler } from './services/spacebarHandler.js';
import { initGridScrollHandler } from './services/gridScrollHandler.js';
import { initKeyboardHandler } from './services/keyboardHandler.js';
import scrollSyncService from './services/scrollSyncService.js';
import Toolbar from './components/Toolbar/Toolbar.js';
import GridManager from './components/Canvas/PitchGrid/gridManager.js';
import PitchGridController from './components/Canvas/PitchGrid/PitchGrid.js';
import Harmony from './components/Canvas/HarmonyAnalysis/Harmony.js';
import { initHarmonicBins } from './components/Harmonics-Filter/harmonicBins.js';
import { initAdsrComponent } from './components/ADSR/adsrComponent.js';
import { initFilterControls } from './components/Harmonics-Filter/filterControls.js';
import PrintPreview from './components/PrintPreview.js';
import { initStaticWaveformVisualizer } from './components/StaticWaveform/staticWaveformVisualizer.js';
import simpleEffectsTest from './components/Effects/simpleEffectsTest.js';

// Paint Components
import PaintCanvas from './components/PitchPaint/paintCanvas.js';
import PaintPlayheadRenderer from './components/PitchPaint/paintPlayheadRenderer.js';
import PaintControls from './components/PitchPaint/paintControls.js';

// Meter Components
import MeterController from './components/Meter/MeterController.js';

// Zoom System Components
import ZoomIndicator from './components/ZoomIndicator.js';

// Stamps Toolbar Component
import StampsToolbar from './components/StampsToolbar/StampsToolbar.js';
import TripletsToolbar from './components/StampsToolbar/TripletsToolbar.js';

// Modulation Testing (keep for advanced debugging)
import ModulationTest from './rhythm/modulationTest.js';


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

document.addEventListener("DOMContentLoaded", () => {
    logger.info('Main.js', 'DOMContentLoaded event fired');
    logger.section('STARTING INITIALIZATION');
    
    // Initialize DOM cache first
    domCache.init();

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
    store.state.fullRowData = fullRowData;
    
    const contexts = LayoutService.init();
    CanvasContextService.setContexts(contexts);
    
    SynthEngine.init();
    TransportService.init();
    initSpacebarHandler();
    initGridScrollHandler(); // This will now work correctly
    initKeyboardHandler();
    
    // Initialize scroll synchronization after all grid components are ready
    scrollSyncService.init();
    
    // Initialize UI components
    Toolbar.init();
    GridManager.init();
    Harmony.init();
    initAdsrComponent();
    initHarmonicBins();
    initFilterControls();
    PrintPreview.init();
    
    // Initialize Stamps Toolbar
    StampsToolbar.init();
    
    // Initialize Triplets Toolbar
    TripletsToolbar.init();
    
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
    
    logger.section('SETTING UP STATE SUBSCRIPTIONS');
    
    const renderAll = () => {
        GridManager.renderPitchGrid();
        GridManager.renderDrumGrid();
        Harmony.render();
    };

    store.on('notesChanged', renderAll);
    store.on('stampPlacementsChanged', renderAll);
    store.on('tripletPlacementsChanged', renderAll);
    store.on('modulationMarkersChanged', () => {
        logger.event('Main', 'modulationMarkersChanged event received, recalculating layout', null, 'state');
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
    
    logger.section('INITIALIZATION COMPLETE');
    
    // Initialize modulation testing (keep for advanced debugging)
    window.ModulationTest = ModulationTest;
    
    // Log viewport info after initialization
    setTimeout(() => {
        if (LayoutService.getViewportInfo) {
        }
    }, 1000);
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