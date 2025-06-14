import * as Tone from 'tone';
import store from './state/store.js';
import { fullRowData } from './state/pitchData.js';

// Services
import ConfigService from './services/configService.js';
import SynthEngine from './services/synthEngine.js';
import TransportService from './services/transportService.js';
import { initSpacebarHandler } from './services/spacebarHandler.js';

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

    ConfigService.init();
    SynthEngine.init();
    TransportService.init();
    
    Toolbar.init();
    initGridEvents();
    initSpacebarHandler();
    const adsrEnv = initADSR();
    SynthEngine.setCustomEnvelope(adsrEnv);
    initHarmonicMultislider();
    
    console.log("Main.js: Setting up state subscriptions.");
    store.on('notesChanged', () => {
        DrumGrid.render();
        Grid.render();
    });
    
    store.on('gridChanged', () => {
        DrumGrid.render();
        Grid.render();
    });

    store.on('gridResized', () => {
        DrumGrid.render();
        Grid.render();
        Toolbar.renderRhythmUI();
    });

    store.on('rhythmChanged', () => {
        // ConfigService automatically resizes, which triggers gridResized event
    });

    console.log("Main.js: Performing initial render.");
    Toolbar.renderRhythmUI();
    DrumGrid.render();
    Grid.render();
    
    console.log("Main.js: Application initialization complete.");
});