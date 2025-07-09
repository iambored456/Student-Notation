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
import Harmony from './components/Harmony/Harmony.js'; // This line must match the file path
import { initHarmonicMultislider } from './components/HarmonicMultislider/harmonicMultislider.js';
import { initAdsrComponent } from './components/ADSR/adsrComponent.js';
import { initFilterControls } from './components/FilterControls/filterControls.js';
import PrintPreview from './components/PrintPreview.js';
import GlobalService from './services/globalService.js';
import { initChordToolbar } from './harmony/ui/ChordToolbar.js';


console.log("Main.js: Application starting...");

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
    Harmony.init();
    initAdsrComponent();
    initHarmonicMultislider();
    initFilterControls();
    PrintPreview.init();
    initChordToolbar();
    
    console.log("----------------------------------------");
    console.log("SETTING UP STATE SUBSCRIPTIONS");
    console.log("----------------------------------------");
    
    const renderAll = () => {
        GridManager.renderPitchGrid();
        GridManager.renderDrumGrid();
        Harmony.render();
    };

    store.on('notesChanged', renderAll);
    store.on('chordsChanged', renderAll);
    
    store.on('rhythmStructureChanged', () => {
        renderAll();
        Toolbar.renderRhythmUI();
    });

    store.on('layoutConfigChanged', () => {
        renderAll();
        Toolbar.renderRhythmUI();
    });

    store.on('keySignatureChanged', (newKey) => {
        store.rebuildAllChords(newKey);
        renderAll(); 
    });

    store.on('zoomIn', () => LayoutService.zoomIn());
    store.on('zoomOut', () => LayoutService.zoomOut());

    console.log("========================================");
    console.log("PERFORMING INITIAL RENDER");
    console.log("========================================");
    
    store.setSelectedTool('circle', '#4a90e2');
    
    console.log("========================================");
    console.log("INITIALIZATION COMPLETE");
    console.log("========================================");
});