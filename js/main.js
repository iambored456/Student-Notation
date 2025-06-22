// js/main.js
import * as Tone from 'tone';
import store from './state/store.js';
import { fullRowData } from './state/pitchData.js';

// Services
import ConfigService from './services/configService.js';
import CanvasContextService from './services/canvasContextService.js';
import SynthEngine from './services/synthEngine.js';
import TransportService from './services/transportService.js';
import { initSpacebarHandler } from './services/spacebarHandler.js';
import { initGridScrollHandler } from './services/gridScrollHandler.js';
import { initKeyboardHandler } from './services/keyboardHandler.js';

// Components
import Toolbar from './components/Toolbar/Toolbar.js';
import GridManager from './components/Grid/gridManager.js'; // UPDATED
import Grid from './components/Grid/Grid.js';
import DrumGrid from './components/Grid/drumGrid.js';
import { initHarmonicMultislider } from './components/HarmonicMultislider/harmonicMultislider.js';
import { initADSR } from './components/ADSR/customenvelope.js';

console.log("Main.js: Application starting...");

document.addEventListener("DOMContentLoaded", () => {
    console.log("Main.js: DOMContentLoaded event fired.");

    // --- 1. Initial State and Configuration ---
    store.state.fullRowData = fullRowData;
    const contexts = ConfigService.init();
    CanvasContextService.setContexts(contexts);
    
    // --- 2. Initialize Services ---
    SynthEngine.init();
    TransportService.init();
    initSpacebarHandler();
    initGridScrollHandler();
    initKeyboardHandler();
    
    // --- 3. Initialize Components ---
    Toolbar.init();
    GridManager.init(); // NEW: Single entry point for all grid logic
    const adsrEnv = initADSR();
    SynthEngine.setCustomEnvelope(adsrEnv);
    initHarmonicMultislider();
    
    // --- 4. Set up State Subscriptions ---
    console.log("Main.js: Setting up state subscriptions.");
    
    // Listen for any change to placed notes (add, remove, drag, load)
    store.on('notesChanged', () => {
        console.log("[EVENT] `notesChanged` detected. Re-rendering grids.");
        Grid.render();
        DrumGrid.render();
    });
    
    // REFACTORED: Listen for a single event for all grid layout/rhythm changes
    store.on('layoutConfigChanged', () => {
        console.log("[EVENT] `layoutConfigChanged` detected. Re-rendering grids and rhythm UI.");
        Grid.render();
        DrumGrid.render();
        Toolbar.renderRhythmUI();
    });

    // --- 5. Initial Render and Default Settings ---
    console.log("Main.js: Performing initial render.");
    Toolbar.renderRhythmUI();
    Grid.render();
    DrumGrid.render();
    
    store.setSelectedTool('circle', '#0000ff');
    store.setActivePreset('sine');
    
    console.log("Main.js: Application initialization complete.");
});