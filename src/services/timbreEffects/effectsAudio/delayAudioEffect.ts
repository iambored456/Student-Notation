// js/services/timbreEffects/effectsAudio/delayAudioEffect.ts
import * as Tone from 'tone';
import logger from '@utils/logger.ts';

logger.moduleLoaded('DelayAudioEffect');

interface DelaySettings {
  time: number;
  feedback: number;
  wet: number;
}

type DelayInstance = Tone.FeedbackDelay & {
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

class DelayAudioEffect {
  private currentSettings = new Map<string, DelaySettings>();
  private delayInstances = new Map<string, DelayInstance>();

  init(): boolean {
    logger.info('DelayAudioEffect', 'Ready for audio processing', null, 'audio');
    return true;
  }

  updateParameters(effectParams: DelaySettings, color: string): void {
    const { time, feedback, wet } = effectParams;
    this.currentSettings.set(color, { time, feedback, wet });

    logger.debug('DelayAudioEffect', `Updated parameters for ${color}`, { time, feedback, wet }, 'audio');

    let delayInstance: DelayInstance | null | undefined = this.delayInstances.get(color);

    if (delayInstance) {
      this.updateDelayInstance(delayInstance, time, feedback, wet);
    } else if (time > 0 || feedback > 0) {
      delayInstance = this.createDelayInstance(time, feedback, wet);
      if (delayInstance) {
        this.delayInstances.set(color, delayInstance);
        logger.debug('DelayAudioEffect', `Created new delay instance for ${color}`, { time, feedback, wet }, 'audio');
        getSynthEngine()?.updateSynthForColor?.(color);
      }
    }
  }

  applyToVoice(voice: Voice | null | undefined, color: string): void {
    if (!voice) {return;}

    const settings = this.currentSettings.get(color);
    if (!settings || (settings.time === 0 && settings.feedback === 0)) {return;}

    try {
      let delayInstance: DelayInstance | null | undefined = this.delayInstances.get(color);
      if (!delayInstance) {
        delayInstance = this.createDelayInstance(settings.time, settings.feedback, settings.wet);
        if (!delayInstance) {return;}
        this.delayInstances.set(color, delayInstance);
      }

      const isDisposed = typeof voice.isDisposed === 'function' && voice.isDisposed();
      if (isDisposed) {return;}

      try {
        voice.connect?.(delayInstance);
      } catch {
        voice.output?.connect?.(delayInstance);
      }

      logger.debug('DelayAudioEffect', `Applied delay to voice for ${color}`, settings, 'audio');
    } catch (error) {
      logger.warn('DelayAudioEffect', `Failed to apply delay to voice for ${color}`, error, 'audio');
    }
  }

  getCurrentSettings(color: string): DelaySettings {
    return this.currentSettings.get(color) ?? { time: 0, feedback: 0, wet: 0 };
  }

  getEffectInstance(color: string): DelayInstance | null {
    const settings = this.getCurrentSettings(color);
    if (settings.time > 0 && settings.wet > 0) {
      return this.delayInstances.get(color) ?? null;
    }
    return null;
  }

  private createDelayInstance(time: number, feedback: number, wet = 30): DelayInstance | null {
    if (time === 0 && feedback === 0) {
      return null;
    }

    const delayTime = Math.max(0.01, (time / 100) * 0.5);
    const feedbackAmount = Math.min(0.95, feedback / 100);
    const wetAmount = wet / 100;

    const delay = new Tone.FeedbackDelay({ delayTime, feedback: feedbackAmount, wet: wetAmount }) as DelayInstance;
    delay._wetAmount = wetAmount;

    logger.debug('DelayAudioEffect', 'Created delay instance', { delayTime, feedbackAmount, wetAmount }, 'audio');
    return delay;
  }

  private updateDelayInstance(delayInstance: DelayInstance, time: number, feedback: number, wet = 15): void {
    const delayTime = Math.max(0.01, (time / 100) * 0.5);
    const feedbackAmount = Math.min(0.95, feedback / 100);
    const wetAmount = wet / 100;

    try {
      delayInstance.delayTime.value = delayTime;
      delayInstance.feedback.value = feedbackAmount;
      if (delayInstance._crossFade) {
        delayInstance._crossFade.fade.value = wetAmount;
      }
      delayInstance._wetAmount = wetAmount;
      logger.debug('DelayAudioEffect', 'Updated delay instance', { delayTime, feedbackAmount, wetAmount }, 'audio');
    } catch (error) {
      logger.warn('DelayAudioEffect', 'Failed to update delay instance', error, 'audio');
    }
  }

  createDelaySettings(time: number, feedback: number, wet = 30): DelaySettings | null {
    if (time === 0 && feedback === 0) {
      return null;
    }

    const delayTime = Math.max(0.01, (time / 100) * 0.5);
    const feedbackAmount = Math.min(0.95, feedback / 100);
    const wetAmount = wet / 100;

    return {
      time: delayTime,
      feedback: feedbackAmount,
      wet: wetAmount
    };
  }

  disableForColor(color: string): void {
    this.updateParameters({ time: 0, feedback: 0, wet: 0 }, color);
    const delayInstance = this.delayInstances.get(color);
    if (delayInstance) {
      try {
        delayInstance._crossFade?.dispose();
        delayInstance.dispose();
      } finally {
        this.delayInstances.delete(color);
      }
    }
  }

  dispose(): void {
    this.delayInstances.forEach((delay, color) => {
      try {
        delay._crossFade?.dispose();
        delay.dispose();
      } catch (error) {
        logger.warn('DelayAudioEffect', `Failed to dispose delay for ${color}`, error, 'audio');
      }
    });

    this.currentSettings.clear();
    this.delayInstances.clear();
    logger.info('DelayAudioEffect', 'Disposed', null, 'audio');
  }
}

export default DelayAudioEffect;
