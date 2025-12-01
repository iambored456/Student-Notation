// js/bootstrap/ui/initUiComponents.ts
import toolbar from '@components/toolbar/toolbar.ts';
import toolSelectorInitializer from '@components/toolbar/initializers/toolSelectorInitializer.ts';
import { initPlaybackControls } from '@components/toolbar/initializers/playbackInitializer.js';
import { initFileActions } from '@components/toolbar/initializers/fileActionsInitializer.js';
import { initAudioControls } from '@components/toolbar/initializers/audioControlsInitializer.js';
import { initModulationControls } from '@components/toolbar/initializers/modulationInitializer.js';
import printPreview from '@components/ui/printPreview.ts';
import logger from '@utils/logger.ts';

export function initUiComponents(): void {
  // toolbar.init() handles all toolbar initializers internally (including playback, file actions, audio, modulation, grid, sidebar)
  // DO NOT call them again here or event listeners will be registered twice!
  toolbar.init();

  // These are called separately as they're not part of toolbar
  printPreview.init();
  logger.initSuccess('UiComponents');
}
