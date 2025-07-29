// js/components/Toolbar/Toolbar.js
import { renderRhythmUI } from './rhythmUI.js';
import { renderTimeSignatureDisplay } from './timeSignatureDisplay.js';
import { initSidebarAndVolume } from './initializers/sidebarInitializer.js';
import { initFileActions } from './initializers/fileActionsInitializer.js';
import { initToolSelectors } from './initializers/toolSelectorInitializer.js';
import { initPlaybackControls } from './initializers/playbackInitializer.js';
import { initAudioControls } from './initializers/audioControlsInitializer.js';
import { initGridControls } from './initializers/gridControlsInitializer.js';

console.log("ToolbarComponent: Module loaded.");

const Toolbar = {
    init() {
        initSidebarAndVolume();
        initFileActions();
        initToolSelectors();
        initPlaybackControls();
        initAudioControls();
        initGridControls();
        
        console.log("ToolbarComponent: All controls initialized.");
    },

    renderRhythmUI() {
        renderRhythmUI();
        renderTimeSignatureDisplay();
    }
};

export default Toolbar;