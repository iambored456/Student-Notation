// js/bootstrap/audio/initAudioComponents.js
import logger from '@utils/logger.ts';
import { initAdsrComponent } from '@components/audio/adsr/adsrComponent.ts';
import { initHarmonicBins } from '@components/audio/harmonicsFilter/harmonicBins.ts';
import { initFilterControls } from '@components/audio/harmonicsFilter/filterControls.ts';
import { initStaticWaveformVisualizer } from '@components/staticWaveform/staticWaveformVisualizer.ts';
import animationEffectsManager from '@services/timbreEffects/effectsAnimation/animationEffectsManager.ts';
import audioEffectsManager from '@services/timbreEffects/effectsAudio/audioEffectsManager.ts';
import effectsCoordinator from '@services/timbreEffects/effectsCoordinator.ts';
import effectsController from '@components/audio/effects/effectsController.ts';
import positionEffectsController from '@components/ui/positionEffectsController.ts';

export function initAudioComponents(): void {
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

  const globalWindow = window as typeof window & {
    effectsCoordinator?: typeof effectsCoordinator;
    animationEffectsManager?: typeof animationEffectsManager;
    audioEffectsManager?: typeof audioEffectsManager;
    effectsController?: typeof effectsController;
    positionEffectsController?: typeof positionEffectsController;
  };

  globalWindow.effectsCoordinator = effectsCoordinator;
  globalWindow.animationEffectsManager = animationEffectsManager;
  globalWindow.audioEffectsManager = audioEffectsManager;
  globalWindow.effectsController = effectsController;
  globalWindow.positionEffectsController = positionEffectsController;
  logger.initSuccess('Effects Managers');
}
