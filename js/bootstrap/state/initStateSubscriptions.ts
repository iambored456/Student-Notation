// js/bootstrap/state/initStateSubscriptions.ts
import store from '@state/index.ts';
import LayoutService from '@services/layoutService.ts';
import rhythmPlaybackService from '@services/rhythmPlaybackService.ts';
import SynthEngine from '@services/synthEngine.ts';
import PitchGridController from '@components/canvas/PitchGrid/pitchGrid.ts';
import DrumGridController from '@components/canvas/drumGrid/drumGrid.js';
import logger from '@utils/logger.ts';

export function initStateSubscriptions(): { renderAll: () => void } {
  // Tempo changes
  store.on('tempoChanged', () => {
    SynthEngine.setBpm(store.state.tempo);
  });

  // Layout changes
  store.on('layoutChanged', () => {
    LayoutService.reflow();
  });

  // Rhythm playback updates
  store.on('rhythmPatternChanged', () => {
    if (rhythmPlaybackService.refresh) {
      rhythmPlaybackService.refresh();
    }
  });

  const renderAll = () => {
    try {
      PitchGridController.render();
      DrumGridController.render?.();
      logger.debug('StateSubscriptions', 'renderAll invoked', null, 'grid');
    } catch (err) {
      logger.error('StateSubscriptions', 'renderAll failed', err, 'grid');
    }
  };

  store.on('notesChanged', renderAll);
  store.on('stampPlacementsChanged', renderAll);
  store.on('tripletPlacementsChanged', renderAll);
  store.on('accidentalModeChanged', renderAll);
  store.on('frequencyLabelsChanged', renderAll);
  store.on('layoutConfigChanged', () => {
    PitchGridController.renderMacrobeatTools();
  });
  store.on('rhythmStructureChanged', () => {
    // Recalculate layout to update column widths based on new macrobeat structure
    LayoutService.reflow();
  });
  store.on('modulationMarkersChanged', () => {
    // Reflow to recalculate canvas dimensions with modulation adjustments
    LayoutService.reflow();
    // Render to display the visual changes
    renderAll();
  });

  logger.initSuccess('StateSubscriptions');
  return { renderAll };
}
