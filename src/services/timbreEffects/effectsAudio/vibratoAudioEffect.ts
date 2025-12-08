// js/services/timbreEffects/effectsAudio/vibratoAudioEffect.ts
import logger from '@utils/logger.ts';

logger.moduleLoaded('VibratoAudioEffect');

interface VibratoSettings {
  speed: number;
  span: number;
}

interface VibratoLFOSettings {
  frequency: number;
  depth: number;
}

interface Voice {
  _setVibrato?: (settings: VibratoSettings) => void;
  vibratoApplied?: boolean;
}

/**
 * Vibrato Audio Effect
 * Handles audio-only vibrato implementation using Tone.js
 * Extracted from synthEngine.js for clean separation
 */
class VibratoAudioEffect {
  private currentSettings = new Map<string, VibratoSettings>();

  constructor() {
    logger.info('VibratoAudioEffect', 'Initialized', null, 'audio');
  }

  /**
   * Initialize the vibrato audio effect
   */
  init(): boolean {
    logger.info('VibratoAudioEffect', 'Ready for audio processing', null, 'audio');
    return true;
  }

  /**
   * Update vibrato parameters for a specific color
   */
  updateParameters(effectParams: VibratoSettings, color: string): void {
    const { speed, span } = effectParams;

    // Store current settings for this color
    this.currentSettings.set(color, { speed, span });

    logger.debug('VibratoAudioEffect', `Updated parameters for ${color}`, { speed, span }, 'audio');

    // The actual application to voices happens in applyToVoice()
    // when voices are created/updated by the synthEngine
  }

  /**
   * Apply vibrato to a specific voice
   */
  applyToVoice(voice: Voice | null | undefined, color: string): void {
    if (!voice || typeof voice._setVibrato !== 'function') {
      return;
    }

    const settings = this.currentSettings.get(color);
    if (!settings) {
      logger.debug('VibratoAudioEffect', `No vibrato settings found for color ${color}`, null, 'audio');
      return;
    }

    try {
      voice._setVibrato(settings);
      voice.vibratoApplied = true;

      logger.debug('VibratoAudioEffect', `Applied vibrato to voice for ${color}`, settings, 'audio');
    } catch (error) {
      logger.warn('VibratoAudioEffect', `Failed to apply vibrato to voice for ${color}`, error, 'audio');
    }
  }

  /**
   * Get current settings for a color
   */
  getCurrentSettings(color: string): VibratoSettings {
    return this.currentSettings.get(color) ?? { speed: 0, span: 0 };
  }

  /**
   * Get effect instance for a color (for effects chaining)
   * Vibrato is applied directly to voice, so no separate instance needed
   */
  getEffectInstance(): null {
    // Vibrato modifies the voice directly, no separate effect instance
    return null;
  }

  /**
   * Create vibrato LFO settings for Tone.js
   * Helper method for voice creation
   */
  createVibratoSettings(speed: number, span: number): VibratoLFOSettings | null {
    if (speed === 0 || span === 0) {
      return null;
    }

    // Convert percentage values to Tone.js parameters
    const frequencyHz = (speed / 100) * 16; // 0-100% -> 0-16 Hz
    const depthCents = (span / 100) * 50; // 0-100% -> 0-50 cents

    return {
      frequency: frequencyHz,
      depth: depthCents
    };
  }

  /**
   * Disable vibrato for a specific color
   */
  disableForColor(color: string): void {
    this.updateParameters({ speed: 0, span: 0 }, color);
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.currentSettings.clear();
    logger.info('VibratoAudioEffect', 'Disposed', null, 'audio');
  }
}

export default VibratoAudioEffect;
