// js/main.js
import * as Tone from 'tone';
import store from './state/store.js';
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
import { initADSR } from './components/ADSR/customenvelope.js';
import PrintPreview from './components/PrintPreview.js';

console.log("Main.js: Application starting...");

document.addEventListener("DOMContentLoaded", () => {
    console.log("Main.js: DOMContentLoaded event fired.");
    console.log("========================================");
    console.log("STARTING INITIALIZATION");
    console.log("========================================");

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
    initADSR(); // Initialize the ADSR component
    // FIX: Removed the obsolete call to SynthEngine.setCustomEnvelope
    initHarmonicMultislider();
    PrintPreview.init();
    
    console.log("----------------------------------------");
    console.log("SETTING UP STATE SUBSCRIPTIONS");
    console.log("----------------------------------------");
    
    store.on('notesChanged', () => {
        GridManager.renderPitchGrid();
        GridManager.renderDrumGrid();
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
    Toolbar.renderRhythmUI();
    GridManager.renderPitchGrid();
    GridManager.renderDrumGrid();
    
    store.setSelectedTool('circle', '#0000ff');
    
    console.log("========================================");
    console.log("INITIALIZATION COMPLETE");
    console.log("========================================");
});