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

    // --- Create and inject dummy rows for scrolling padding ---
    const topPaddingRows = 1;
    const bottomPaddingRows = 2; // One to match the top, one extra for buffer
    const dummyRow = { pitch: '', toneNote: '', frequency: 0, column: '', hex: 'transparent', isDummy: true };
    
    const topPadding = Array(topPaddingRows).fill(dummyRow);
    const bottomPadding = Array(bottomPaddingRows).fill(dummyRow);

    // Prepend and append the dummy rows to the actual data
    store.state.fullRowData = [...topPadding, ...fullRowData, ...bottomPadding];
    
    // Adjust the initial grid position to account for the new top rows
    store.state.gridPosition += topPaddingRows;


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
    
    store.setSelectedTool('circle', '#4a90e2');
    
    console.log("========================================");
    console.log("INITIALIZATION COMPLETE");
    console.log("========================================");
});