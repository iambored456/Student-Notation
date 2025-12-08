// js/services/timbreEffects/effectsAudio/audioEffectsManager.ts
import store from '@state/index.ts';
import logger from '@utils/logger.ts';
import VibratoAudioEffect from './vibratoAudioEffect.ts';
import TremoloAudioEffect from './tremoloAudioEffect.ts';
import ReverbAudioEffect from './reverbAudioEffect.ts';
import DelayAudioEffect from './delayAudioEffect.ts';

logger.moduleLoaded('AudioEffectsManager');

type AudioEffectType = 'vibrato' | 'tremolo' | 'reverb' | 'delay';

type VibratoSettings = Parameters<VibratoAudioEffect['updateParameters']>[0];
type TremoloSettings = Parameters<TremoloAudioEffect['updateParameters']>[0];
type ReverbSettings = Parameters<ReverbAudioEffect['updateParameters']>[0];
type DelaySettings = Parameters<DelayAudioEffect['updateParameters']>[0];

type VoiceParam =
  Parameters<VibratoAudioEffect['applyToVoice']>[0] &
  Parameters<TremoloAudioEffect['applyToVoice']>[0];

interface ConnectableNode {
  connect: (...args: any[]) => unknown;
  disconnect?: () => void;
}

type SynthNode = ConnectableNode & { disconnect: () => void };

type MasterGainNode = ConnectableNode;

interface AudioEffectChangeEvent {
  effectType: AudioEffectType;
  parameter: string;
  value: number;
  color: string;
  effectParams: Record<string, number>;
}

const getSynthEngine = () =>
  (window as Window & {
    synthEngine?: {
      updateSynthForColor?: (color: string) => void;
      getWaveformAnalyzer?: (color: string) => unknown;
    };
  }).synthEngine;

class AudioEffectsManager {
  private readonly vibratoEffect = new VibratoAudioEffect();
  private readonly tremoloEffect = new TremoloAudioEffect();
  private readonly reverbEffect = new ReverbAudioEffect();
  private readonly delayEffect = new DelayAudioEffect();

  init(): boolean {
    this.vibratoEffect.init();
    this.tremoloEffect.init();
    this.reverbEffect.init();
    this.delayEffect.init();

    store.on('audioEffectChanged', (data?: AudioEffectChangeEvent) => {
      if (!data) {return;}
      const { effectType, parameter, value, color, effectParams } = data;
      this.handleAudioEffectChange(effectType, parameter, value, color, effectParams);
    });

    logger.info('AudioEffectsManager', 'Event subscriptions established', null, 'audio');
    return true;
  }

  private handleAudioEffectChange(
    effectType: AudioEffectType,
    parameter: string,
    value: number,
    color: string,
    effectParams: Record<string, number>
  ): void {
    logger.debug(
      'AudioEffectsManager',
      `Processing audio effect: ${effectType}.${parameter} = ${value} for ${color}`,
      null,
      'audio'
    );

    switch (effectType) {
      case 'vibrato':
        this.vibratoEffect.updateParameters(effectParams as unknown as VibratoSettings, color);
        break;
      case 'tremolo':
        this.tremoloEffect.updateParameters(effectParams as unknown as TremoloSettings, color);
        break;
      case 'reverb':
        void this.reverbEffect.updateParameters(effectParams as unknown as ReverbSettings, color);
        break;
      case 'delay':
        this.delayEffect.updateParameters(effectParams as unknown as DelaySettings, color);
        break;
      default:
        logger.debug('AudioEffectsManager', `Effect type ${effectType} not handled by audio system`, null, 'audio');
    }
  }

  getEffectHandler(effectType: AudioEffectType) {
    switch (effectType) {
      case 'vibrato':
        return this.vibratoEffect;
      case 'tremolo':
        return this.tremoloEffect;
      case 'reverb':
        return this.reverbEffect;
      case 'delay':
        return this.delayEffect;
      default:
        return null;
    }
  }

  applySynthEffects(synth: SynthNode, color: string, masterGain: MasterGainNode): void {
    const reverbInstance = this.reverbEffect.getEffectInstance(color);
    const delayInstance = this.delayEffect.getEffectInstance(color);

    try {
      synth.disconnect();
    } catch {
      // ignore disconnect errors
    }

    let currentOutput: ConnectableNode = synth;

    if (reverbInstance) {
      try {
        reverbInstance.disconnect();
        currentOutput.connect(reverbInstance);
        currentOutput = reverbInstance;
      } catch {
        // ignore connection errors
      }
    }

    if (delayInstance) {
      try {
        delayInstance.disconnect();
        currentOutput.connect(delayInstance);
        currentOutput = delayInstance;
      } catch {
        // ignore connection errors
      }
    }

    try {
      currentOutput.connect(masterGain);

      const analyzer = getSynthEngine()?.getWaveformAnalyzer?.(color);
      if (analyzer) {
        synth.connect(analyzer);
      }
    } catch {
      // ignore masterGain connection errors
    }
  }

  applyEffectsToVoice(voice: VoiceParam, color: string): void {
    this.vibratoEffect.applyToVoice(voice, color);
    this.tremoloEffect.applyToVoice(voice, color);
  }

  dispose(): void {
    this.vibratoEffect.dispose();
    this.tremoloEffect.dispose();
    this.reverbEffect.dispose();
    this.delayEffect.dispose();
    logger.info('AudioEffectsManager', 'Disposed', null, 'audio');
  }
}

const audioEffectsManager = new AudioEffectsManager();
export default audioEffectsManager;
