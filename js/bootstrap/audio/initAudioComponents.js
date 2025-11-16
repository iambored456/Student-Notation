// js/bootstrap/audio/initAudioComponents.js
import logger from '@utils/logger.js';
import { initAdsrComponent } from '@components/audio/adsr/adsrComponent.js';
import { initHarmonicBins } from '@components/audio/harmonicsFilter/harmonicBins.js';
import { initFilterControls } from '@components/audio/harmonicsFilter/filterControls.js';
import { initStaticWaveformVisualizer } from '@components/staticWaveform/staticWaveformVisualizer.js';
import animationEffectsManager from '@services/timbreEffects/effectsAnimation/animationEffectsManager.js';
import audioEffectsManager from '@services/timbreEffects/effectsAudio/audioEffectsManager.js';
import effectsCoordinator from '@services/timbreEffects/effectsCoordinator.js';
import effectsController from '@components/audio/effects/effectsController.js';
import positionEffectsController from '@components/ui/positionEffectsController.js';

export async function initAudioComponents() {
  initAdsrComponent();
  initHarmonicBins();
  initFilterControls();

  logger.initStart('Static Waveform Visualizer');
  if (initStaticWaveformVisualizer()) {
    logger.initSuccess('Static Waveform Visualizer');
  } else {
    logger.initFailed('Static Waveform Visualizer');
  }

  // Initialize effects architecture
  logger.initStart('Effects Managers');
  animationEffectsManager.init();
  audioEffectsManager.init();

  effectsCoordinator.init();

  effectsController.init();
  positionEffectsController.init();

  // Expose for legacy consumers
  window.effectsCoordinator = effectsCoordinator;
  window.animationEffectsManager = animationEffectsManager;
  window.audioEffectsManager = audioEffectsManager;
  window.effectsController = effectsController;
  window.positionEffectsController = positionEffectsController;
  logger.initSuccess('Effects Managers');
}
