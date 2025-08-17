// js/components/Toolbar/Toolbar.js
import { initSidebarAndVolume } from './initializers/sidebarInitializer.js';
import { initFileActions } from './initializers/fileActionsInitializer.js';
import { initToolSelectors } from './initializers/toolSelectorInitializer.js';
import { initPlaybackControls } from './initializers/playbackInitializer.js';
import { initAudioControls } from './initializers/audioControlsInitializer.js';
import { initGridControls } from './initializers/gridControlsInitializer.js';
import { initModulationControls } from './initializers/modulationInitializer.js';
import logger from '../../utils/logger.js';

logger.moduleLoaded('ToolbarComponent', 'toolbar');

const Toolbar = {
    init() {
        console.log('🎵 [TOOLBAR] Toolbar.init() starting...');
        initSidebarAndVolume();
        initFileActions();
        initToolSelectors();
        initPlaybackControls();
        initAudioControls();
        initGridControls();
        console.log('🎵 [TOOLBAR] About to call initModulationControls()...');
        initModulationControls();
        console.log('🎵 [TOOLBAR] initModulationControls() call completed');
        
        logger.info('ToolbarComponent', 'All controls initialized', null, 'toolbar');
        console.log('🎵 [TOOLBAR] Toolbar.init() completed');
    },

};

export default Toolbar;