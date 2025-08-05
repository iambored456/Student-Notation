// js/main.js
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
import Toolbar from './components/Toolbar/Toolbar.js';
import GridManager from './components/Canvas/PitchGrid/gridManager.js';
import PitchGridController from './components/Canvas/PitchGrid/PitchGrid.js';
import Harmony from './components/Canvas/HarmonyAnalysis/Harmony.js';
import { initHarmonicMultislider } from './components/Harmonics-Filter/harmonicMultislider.js';
import { initAdsrComponent } from './components/ADSR/adsrComponent.js';
import { initFilterControls } from './components/Harmonics-Filter/filterControls.js';
import PrintPreview from './components/PrintPreview.js';
import { initStaticWaveformVisualizer } from './components/StaticWaveform/staticWaveformVisualizer.js';

// Paint Components
import PaintCanvas from './components/PitchPaint/paintCanvas.js';
import PaintPlayheadRenderer from './components/PitchPaint/paintPlayheadRenderer.js';
import PaintControls from './components/PitchPaint/paintControls.js';

// Zoom System Components
import ZoomIndicator from './components/ZoomIndicator.js';

console.log("Main.js: Application starting...");

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
    
    console.log('New zoom system initialized with keyboard shortcuts');
}

// Debug helper - add to window for console debugging
function setupDebugTools() {
    window.debugZoom = {
        info: () => LayoutService.getViewportInfo ? LayoutService.getViewportInfo() : 'Viewport info not available',
        zoomTo: (level) => {
            console.log(`Setting zoom to ${level}`);
            // This would need to be implemented in LayoutService
        },
        scrollTo: (position) => {
            console.log(`Scrolling to position ${position}`);
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
                console.log(`scrollToNote not available. Requested: ${noteName}`);
            }
        }
    };
}

document.addEventListener("DOMContentLoaded", () => {
    logger.info('Main.js', 'DOMContentLoaded event fired');
    logger.section('STARTING INITIALIZATION');
    
    // Initialize DOM cache first
    domCache.init();

    const startAudio = async () => {
        try {
            await Tone.start();
            logger.info('Main.js', 'AudioContext started successfully');
        } catch (e) {
            logger.error('Main.js', 'Could not start AudioContext', e);
        }
    };
    domCache.get('appContainer')?.addEventListener('click', startAudio, { once: true });
    document.getElementById('app-container').addEventListener('keydown', startAudio, { once: true });

    // Initialize core data and services
    store.state.fullRowData = fullRowData;
    
    const contexts = LayoutService.init();
    CanvasContextService.setContexts(contexts);
    
    SynthEngine.init();
    TransportService.init();
    initSpacebarHandler();
    initGridScrollHandler(); // This will now work correctly
    initKeyboardHandler();
    
    // Initialize UI components
    Toolbar.init();
    GridManager.init();
    Harmony.init();
    initAdsrComponent();
    initHarmonicMultislider();
    initFilterControls();
    PrintPreview.init();

    // Initialize static waveform visualizer
    logger.initStart('Static Waveform Visualizer');
    if (initStaticWaveformVisualizer()) {
        logger.initSuccess('Static Waveform Visualizer');
    } else {
        logger.initFailed('Static Waveform Visualizer');
    }

    // Initialize Paint components
    logger.initStart('Paint components');
    PaintCanvas.initialize();
    PaintPlayheadRenderer.initialize();
    PaintControls.initialize();
    logger.initSuccess('Paint components');
    
    // NEW: Initialize the enhanced zoom system
    console.log("Main.js: Initializing new zoom system...");
    initializeNewZoomSystem();
    setupDebugTools();
    console.log("Main.js: New zoom system initialized.");
    
    logger.section('SETTING UP STATE SUBSCRIPTIONS');
    
    const renderAll = () => {
        GridManager.renderPitchGrid();
        GridManager.renderDrumGrid();
        Harmony.render();
    };

    store.on('notesChanged', renderAll);
    
    store.on('rhythmStructureChanged', () => {
        renderAll();
        PitchGridController.renderMacrobeatTools();
    });

    store.on('layoutConfigChanged', () => {
        renderAll();
        PitchGridController.renderMacrobeatTools();
    });

    // NEW: Enhanced zoom event handling
    store.on('zoomIn', () => {
        console.log("Main.js: Zoom in event received");
        LayoutService.zoomIn();
    });
    
    store.on('zoomOut', () => {
        console.log("Main.js: Zoom out event received");
        LayoutService.zoomOut();
    });

    logger.section('PERFORMING INITIAL RENDER');
    
    store.setSelectedTool('note');
    store.setSelectedNote('circle', '#4a90e2');
    
    logger.section('INITIALIZATION COMPLETE');
    
    // Log viewport info after initialization
    setTimeout(() => {
        if (LayoutService.getViewportInfo) {
            console.log("Initial viewport info:", LayoutService.getViewportInfo());
        }
    }, 1000);
});