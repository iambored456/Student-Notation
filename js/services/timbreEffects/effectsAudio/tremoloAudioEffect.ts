// js/services/timbreEffects/effectsAudio/tremoloAudioEffect.ts
import logger from '@utils/logger.ts';

logger.moduleLoaded('TremoloAudioEffect');

interface TremoloSettings {
  speed: number;
  span: number;
}

interface TremoloLFOSettings {
  frequency: number;
  depth: number;
}

interface Voice {
  _setTremolo?: (settings: TremoloSettings) => void;
  tremoloApplied?: boolean;
}

/**
 * Tremolo Audio Effect
 * Handles audio-only tremolo implementation using Tone.js
 * Extracted from synthEngine.js for clean separation
 */
class TremoloAudioEffect {
  private currentSettings = new Map<string, TremoloSettings>();

  constructor() {
    logger.info('TremoloAudioEffect', 'Initialized', null, 'audio');
  }

  /**
   * Initialize the tremolo audio effect
   */
  init(): boolean {
    logger.info('TremoloAudioEffect', 'Ready for audio processing', null, 'audio');
    return true;
  }

  /**
   * Update tremolo parameters for a specific color
   */
  updateParameters(effectParams: TremoloSettings, color: string): void {
    const { speed, span } = effectParams;

    this.currentSettings.set(color, { speed, span });

    logger.debug('TremoloAudioEffect', `Updated parameters for ${color}`, { speed, span }, 'audio');
  }

  /**
   * Apply tremolo to a specific voice
   */
  applyToVoice(voice: Voice | null | undefined, color: string): void {
    if (!voice || typeof voice._setTremolo !== 'function') {
      return;
    }

    const settings = this.currentSettings.get(color);
    if (!settings) {
      logger.debug('TremoloAudioEffect', `No tremolo settings found for color ${color}`, null, 'audio');
      return;
    }

    try {
      voice._setTremolo(settings);
      voice.tremoloApplied = true;

      logger.debug('TremoloAudioEffect', `Applied tremolo to voice for ${color}`, settings, 'audio');
    } catch (error) {
      logger.warn('TremoloAudioEffect', `Failed to apply tremolo to voice for ${color}`, error, 'audio');
    }
  }

  /**
   * Get current settings for a color
   */
  getCurrentSettings(color: string): TremoloSettings {
    return this.currentSettings.get(color) ?? { speed: 0, span: 0 };
  }

  /**
   * Get effect instance for a color (for effects chaining)
   * Tremolo is applied directly to voice, so no separate instance needed
   */
  getEffectInstance(): null {
    return null;
  }

  /**
   * Create tremolo LFO settings for Tone.js
   * Helper method for voice creation
   */
  createTremoloSettings(speed: number, span: number): TremoloLFOSettings | null {
    if (speed === 0 || span === 0) {
      return null;
    }

    // Convert percentage values to Tone.js parameters
    const frequencyHz = (speed / 100) * 16; // 0-100% -> 0-16 Hz
    const depthPercentage = span / 100; // 0-100% -> 0-1

    return {
      frequency: frequencyHz,
      depth: depthPercentage
    };
  }

  /**
   * Disable tremolo for a specific color
   */
  disableForColor(color: string): void {
    this.updateParameters({ speed: 0, span: 0 }, color);
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.currentSettings.clear();
    logger.info('TremoloAudioEffect', 'Disposed', null, 'audio');
  }
}

export default TremoloAudioEffect;
