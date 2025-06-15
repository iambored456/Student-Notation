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

// Components
import Toolbar from './components/Toolbar/Toolbar.js';
import Grid from './components/Grid/Grid.js';
import DrumGrid from './components/Grid/drumGrid.js';
import { initGridEvents } from './components/Grid/gridEvents.js';
import { initHarmonicMultislider } from './components/HarmonicMultislider/harmonicMultislider.js';
import { initADSR } from './components/ADSR/customenvelope.js';

console.log("Main.js: Application starting...");

document.addEventListener("DOMContentLoaded", () => {
    console.log("Main.js: DOMContentLoaded event fired.");

    store.state.fullRowData = fullRowData;

    const contexts = ConfigService.init();
    CanvasContextService.setContexts(contexts);
    
    SynthEngine.init();
    TransportService.init();
    
    Toolbar.init();
    initGridEvents();
    initSpacebarHandler();
    initGridScrollHandler();
    const adsrEnv = initADSR();
    SynthEngine.setCustomEnvelope(adsrEnv);
    initHarmonicMultislider();
    
    console.log("Main.js: Setting up state subscriptions.");
    store.on('notesChanged', () => {
        console.log("[EVENT] `notesChanged` detected. Re-rendering grids.");
        DrumGrid.render();
        Grid.render();
    });
    
    store.on('gridChanged', () => {
        console.log("[EVENT] `gridChanged` detected. Re-rendering grids.");
        DrumGrid.render();
        Grid.render();
    });

    store.on('gridResized', () => {
        console.log("[EVENT] `gridResized` detected. Re-rendering grids and rhythm UI.");
        DrumGrid.render();
        Grid.render();
        Toolbar.renderRhythmUI();
    });

    store.on('rhythmStyleChanged', () => {
        console.log("[EVENT] `rhythmStyleChanged` detected. Re-rendering grids and rhythm UI.");
        DrumGrid.render();
        Grid.render();
        Toolbar.renderRhythmUI();
    });

    console.log("Main.js: Performing initial render.");
    Toolbar.renderRhythmUI();
    DrumGrid.render();
    Grid.render();
    
    store.setSelectedTool('circle', '#000000');
    
    console.log("Main.js: Application initialization complete.");
});