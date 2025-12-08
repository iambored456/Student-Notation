// js/services/timbreEffects/effectsAudio/reverbAudioEffect.ts
import * as Tone from 'tone';
import logger from '@utils/logger.ts';

logger.moduleLoaded('ReverbAudioEffect');

interface ReverbSettings {
  decay: number;
  roomSize: number;
  wet: number;
}

type ReverbInstance = Tone.Reverb & {
  _crossFade?: { fade: { value: number }; dispose: () => void };
  _wetAmount?: number;
};

interface Voice {
  connect?: (destination: Tone.ToneAudioNode | AudioNode) => void;
  output?: {
    connect?: (destination: Tone.ToneAudioNode | AudioNode) => void;
  };
  isDisposed?: () => boolean;
}

const getSynthEngine = () => (window as { synthEngine?: { updateSynthForColor?: (color: string) => void } }).synthEngine;

class ReverbAudioEffect {
  private currentSettings = new Map<string, ReverbSettings>();
  private reverbInstances = new Map<string, ReverbInstance>();

  init(): boolean {
    logger.info('ReverbAudioEffect', 'Ready for audio processing', null, 'audio');
    return true;
  }

  async updateParameters(effectParams: ReverbSettings, color: string): Promise<void> {
    const { decay, roomSize, wet } = effectParams;
    this.currentSettings.set(color, { decay, roomSize, wet });

    logger.debug('ReverbAudioEffect', `Updated parameters for ${color}`, { decay, roomSize, wet }, 'audio');

    let reverbInstance: ReverbInstance | null | undefined = this.reverbInstances.get(color);

    if (reverbInstance) {
      this.updateReverbInstance(reverbInstance, decay, roomSize, wet);
    } else if (decay > 0 || roomSize > 0) {
      reverbInstance = await this.createReverbInstance(decay, roomSize, wet);
      if (reverbInstance) {
        this.reverbInstances.set(color, reverbInstance);
        logger.debug('ReverbAudioEffect', `Created new reverb instance for ${color}`, { decay, roomSize, wet }, 'audio');
        getSynthEngine()?.updateSynthForColor?.(color);
      }
    }
  }

  async applyToVoice(voice: Voice | null | undefined, color: string): Promise<void> {
    if (!voice) {return;}

    const settings = this.currentSettings.get(color);
    if (!settings || (settings.decay === 0 && settings.roomSize === 0)) {return;}

    try {
      let reverbInstance: ReverbInstance | null | undefined = this.reverbInstances.get(color);
      if (!reverbInstance) {
        reverbInstance = await this.createReverbInstance(settings.decay, settings.roomSize, settings.wet);
        if (!reverbInstance) {return;}
        this.reverbInstances.set(color, reverbInstance);
      }

      const isDisposed = typeof voice.isDisposed === 'function' && voice.isDisposed();
      if (isDisposed) {return;}

      try {
        voice.connect?.(reverbInstance);
      } catch {
        voice.output?.connect?.(reverbInstance);
      }

      logger.debug('ReverbAudioEffect', `Applied reverb to voice for ${color}`, settings, 'audio');
    } catch (error) {
      logger.warn('ReverbAudioEffect', `Failed to apply reverb to voice for ${color}`, error, 'audio');
    }
  }

  getCurrentSettings(color: string): ReverbSettings {
    return this.currentSettings.get(color) ?? { decay: 0, roomSize: 0, wet: 0 };
  }

  getEffectInstance(color: string): ReverbInstance | null {
    const settings = this.getCurrentSettings(color);
    if (settings.wet > 0) {
      return this.reverbInstances.get(color) ?? null;
    }
    return null;
  }

  private async createReverbInstance(decay: number, roomSize: number, wet = 10): Promise<ReverbInstance | null> {
    if (decay === 0 && roomSize === 0) {
      return null;
    }

    const baseDecay = Math.max(0.1, (decay / 100) * 8);
    const roomSizeMultiplier = 1 + (roomSize / 100) * 1.5;
    const decayTime = baseDecay * roomSizeMultiplier;
    const wetAmount = wet / 100;

    const reverb = new Tone.Reverb({ decay: decayTime, wet: wetAmount }) as ReverbInstance;
    reverb._wetAmount = wetAmount;
    await reverb.ready;

    logger.debug('ReverbAudioEffect', 'Created reverb instance', { decayTime, wetAmount, roomSize }, 'audio');
    return reverb;
  }

  private updateReverbInstance(reverbInstance: ReverbInstance, decay: number, roomSize: number, wet = 10): void {
    const baseDecay = Math.max(0.1, (decay / 100) * 8);
    const roomSizeMultiplier = 1 + (roomSize / 100) * 1.5;
    const decayTime = baseDecay * roomSizeMultiplier;
    const wetAmount = wet / 100;

    try {
      reverbInstance.decay = decayTime;
      if (reverbInstance._crossFade) {
        reverbInstance._crossFade.fade.value = wetAmount;
      }
      reverbInstance._wetAmount = wetAmount;
      logger.debug('ReverbAudioEffect', 'Updated reverb instance', { decayTime, wetAmount, roomSize }, 'audio');
    } catch (error) {
      logger.warn('ReverbAudioEffect', 'Failed to update reverb instance', error, 'audio');
    }
  }

  createReverbSettings(decay: number, roomSize: number, wet = 25): ReverbSettings | null {
    if (decay === 0 && roomSize === 0) {
      return null;
    }

    const decayTime = Math.max(0.1, (decay / 100) * 10);
    const wetAmount = wet / 100;

    return {
      decay: decayTime,
      roomSize: roomSize / 100,
      wet: wetAmount
    };
  }

  disableForColor(color: string): void {
    this.updateParameters({ decay: 0, roomSize: 0, wet: 0 }, color);
    const reverbInstance = this.reverbInstances.get(color);
    if (reverbInstance) {
      try {
        reverbInstance._crossFade?.dispose();
        reverbInstance.dispose();
      } finally {
        this.reverbInstances.delete(color);
      }
    }
  }

  dispose(): void {
    this.reverbInstances.forEach((reverb, color) => {
      try {
        reverb._crossFade?.dispose();
        reverb.dispose();
      } catch (error) {
        logger.warn('ReverbAudioEffect', `Failed to dispose reverb for ${color}`, error, 'audio');
      }
    });

    this.currentSettings.clear();
    this.reverbInstances.clear();
    logger.info('ReverbAudioEffect', 'Disposed', null, 'audio');
  }
}

export default ReverbAudioEffect;
