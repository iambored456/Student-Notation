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
import { initHarmonicMultislider } from './components/HarmonicMultislider/harmonicMultislider.js';
import { initAdsrComponent } from './components/ADSR/adsrComponent.js';
import { initFilterControls } from './components/FilterControls/filterControls.js';
import PrintPreview from './components/PrintPreview.js';
import GlobalService from './services/globalService.js';

console.log("Main.js: Application starting...");

document.addEventListener("DOMContentLoaded", () => {
    console.log("Main.js: DOMContentLoaded event fired.");
    console.log("========================================");
    console.log("STARTING INITIALIZATION");
    console.log("========================================");

    // --- ADD THIS BLOCK TO HANDLE AUDIOCONTEXT ---
    const startAudio = async () => {
        try {
            await Tone.start();
            console.log("AudioContext started successfully!");
        } catch (e) {
            console.error("Could not start AudioContext:", e);
        }
    };
    // Use { once: true } to automatically remove the listener after it runs
    document.getElementById('app-container').addEventListener('click', startAudio, { once: true });
    document.getElementById('app-container').addEventListener('keydown', startAudio, { once: true });
    // --- END NEW BLOCK ---

    store.state.fullRowData = fullRowData;
    
    const contexts = LayoutService.init();
    CanvasContextService.setContexts(contexts);
    
    SynthEngine.init();
    TransportService.init();
    initSpacebarHandler();
    initGridScrollHandler();
    initKeyboardHandler();
    
    Toolbar.init();
    GridManager.init();
    initAdsrComponent();
    initHarmonicMultislider();
    initFilterControls();
    PrintPreview.init();
    
    console.log("----------------------------------------");
    console.log("SETTING UP STATE SUBSCRIPTIONS");
    console.log("----------------------------------------");
    
    store.on('notesChanged', () => {
        GridManager.renderPitchGrid();
        GridManager.renderDrumGrid();
    });
    
    store.on('rhythmStructureChanged', () => {
        GridManager.renderPitchGrid();
        GridManager.renderDrumGrid();
        Toolbar.renderRhythmUI();
    });

    store.on('layoutConfigChanged', () => {
        GridManager.renderPitchGrid();
        GridManager.renderDrumGrid();
        Toolbar.renderRhythmUI();
    });

    store.on('zoomIn', () => LayoutService.zoomIn());
    store.on('zoomOut', () => LayoutService.zoomOut());

    console.log("========================================");
    console.log("PERFORMING INITIAL RENDER");
    console.log("========================================");
    
    // RENDER CALLS REMOVED FROM HERE
    
    store.setSelectedTool('circle', '#4a90e2');
    
    console.log("========================================");
    console.log("INITIALIZATION COMPLETE");
    console.log("========================================");
});