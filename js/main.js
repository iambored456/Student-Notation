// js/main.js
import * as Tone from 'tone';
import store from './state/index.js';
import { fullRowData } from './state/pitchData.js';
import LayoutService from './services/layoutService.js';
import CanvasContextService from './services/canvasContextService.js';
import SynthEngine from './services/synthEngine.js';
import TransportService from './services/transportService.js';
import { initSpacebarHandler } from './services/spacebarHandler.js';
import { initGridScrollHandler } from './services/gridScrollHandler.js';
import { initKeyboardHandler } from './services/keyboardHandler.js';
import Toolbar from './components/Toolbar/Toolbar.js';
import GridManager from './components/Grid/gridManager.js';
import Harmony from './components/Harmony/Harmony.js';
import { initHarmonicMultislider } from './components/HarmonicMultislider/harmonicMultislider.js';
import { initAdsrComponent } from './components/ADSR/adsrComponent.js';
import { initFilterControls } from './components/FilterControls/filterControls.js';
import PrintPreview from './components/PrintPreview.js';
import { initStaticWaveformVisualizer } from './components/StaticWaveform/staticWaveformVisualizer.js';

// Paint Components
import PaintCanvas from './components/PitchPaint/paintCanvas.js';
import PaintPlayheadRenderer from './components/PitchPaint/paintPlayheadRenderer.js';
import PaintControls from './components/PitchPaint/paintControls.js';

// NEW: Zoom System Components
import ZoomIndicator from './components/ZoomIndicator.js';

console.log("Main.js: Application starting...");

// Initialize the new zoom system
function initializeNewZoomSystem() {
    // Initialize the zoom indicator
    ZoomIndicator.initialize();
    
    // Add keyboard shortcuts for zoom
    document.addEventListener('keydown', (e) => {
        // Allow input fields to work normally
        const activeElement = document.activeElement.tagName.toLowerCase();
        if (['input', 'textarea'].includes(activeElement)) {
            return;
        }

        // Ctrl/Cmd + Plus/Equals for zoom in
        if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
            e.preventDefault();
            store.emit('zoomIn');
        }
        
        // Ctrl/Cmd + Minus for zoom out
        if ((e.ctrlKey || e.metaKey) && e.key === '-') {
            e.preventDefault();
            store.emit('zoomOut');
        }
        
        // Ctrl/Cmd + 0 to reset zoom to default
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
    console.log("Main.js: DOMContentLoaded event fired.");
    console.log("========================================");
    console.log("STARTING INITIALIZATION");
    console.log("========================================");

    const startAudio = async () => {
        try {
            await Tone.start();
            console.log("AudioContext started successfully!");
        } catch (e) {
            console.error("Could not start AudioContext:", e);
        }
    };
    document.getElementById('app-container').addEventListener('click', startAudio, { once: true });
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
    console.log("Main.js: Initializing Static Waveform Visualizer...");
    if (initStaticWaveformVisualizer()) {
        console.log("Main.js: Static Waveform Visualizer initialized successfully.");
    } else {
        console.warn("Main.js: Static Waveform Visualizer failed to initialize.");
    }

    // Initialize Paint components
    console.log("Main.js: Initializing Paint components...");
    PaintCanvas.initialize();
    PaintPlayheadRenderer.initialize();
    PaintControls.initialize();
    console.log("Main.js: Paint components initialized.");
    
    // NEW: Initialize the enhanced zoom system
    console.log("Main.js: Initializing new zoom system...");
    initializeNewZoomSystem();
    setupDebugTools();
    console.log("Main.js: New zoom system initialized.");
    
    console.log("----------------------------------------");
    console.log("SETTING UP STATE SUBSCRIPTIONS");
    console.log("----------------------------------------");
    
    const renderAll = () => {
        GridManager.renderPitchGrid();
        GridManager.renderDrumGrid();
        Harmony.render();
    };

    store.on('notesChanged', renderAll);
    
    store.on('rhythmStructureChanged', () => {
        renderAll();
        Toolbar.renderRhythmUI();
    });

    store.on('layoutConfigChanged', () => {
        renderAll();
        Toolbar.renderRhythmUI();
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

    console.log("========================================");
    console.log("PERFORMING INITIAL RENDER");
    console.log("========================================");
    
    store.setSelectedTool('note');
    store.setSelectedNote('circle', '#4a90e2');
    
    console.log("========================================");
    console.log("INITIALIZATION COMPLETE");
    console.log("========================================");
    
    // Log viewport info after initialization
    setTimeout(() => {
        if (LayoutService.getViewportInfo) {
            console.log("Initial viewport info:", LayoutService.getViewportInfo());
        }
    }, 1000);
});