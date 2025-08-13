// js/components/Toolbar/Toolbar.js
import { initSidebarAndVolume } from './initializers/sidebarInitializer.js';
import { initFileActions } from './initializers/fileActionsInitializer.js';
import { initToolSelectors } from './initializers/toolSelectorInitializer.js';
import { initPlaybackControls } from './initializers/playbackInitializer.js';
import { initAudioControls } from './initializers/audioControlsInitializer.js';
import { initGridControls } from './initializers/gridControlsInitializer.js';
import logger from '../../utils/logger.js';

logger.moduleLoaded('ToolbarComponent', 'toolbar');

const Toolbar = {
    init() {
        initSidebarAndVolume();
        initFileActions();
        initToolSelectors();
        initPlaybackControls();
        initAudioControls();
        initGridControls();
        
        logger.info('ToolbarComponent', 'All controls initialized', null, 'toolbar');
    },

};

export default Toolbar;