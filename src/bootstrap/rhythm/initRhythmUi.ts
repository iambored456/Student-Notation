// js/bootstrap/rhythm/initRhythmUi.ts
import rhythmUI from '@components/canvas/macrobeatTools/rhythmUI.js';
import rhythmPlaybackService from '@services/rhythmPlaybackService.ts';
import stampToolbar from '@components/rhythm/stampsToolbar/stampsToolbar.js';
import tripletsToolbar from '@components/rhythm/stampsToolbar/tripletsToolbar.js';
import logger from '@utils/logger.ts';

export default function initRhythmUi() {
  rhythmUI.init();
  void (rhythmPlaybackService.initialize?.() ?? rhythmPlaybackService.init?.());
  stampToolbar.init();
  tripletsToolbar.init();
  logger.initSuccess('RhythmUi');
}
