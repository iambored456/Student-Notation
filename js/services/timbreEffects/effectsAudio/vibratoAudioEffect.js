// js/services/timbreEffects/effectsAudio/vibratoAudioEffect.js
import logger from '../../../utils/logger.js';
import * as Tone from 'tone';

logger.moduleLoaded('VibratoAudioEffect');

/**
 * Vibrato Audio Effect
 * Handles audio-only vibrato implementation using Tone.js
 * Extracted from synthEngine.js for clean separation
 */
class VibratoAudioEffect {
    constructor() {
        this.currentSettings = new Map(); // color -> vibrato settings
        
        logger.info('VibratoAudioEffect', 'Initialized', null, 'audio');
    }

    /**
     * Initialize the vibrato audio effect
     */
    init() {
        logger.info('VibratoAudioEffect', 'Ready for audio processing', null, 'audio');
        return true;
    }

    /**
     * Update vibrato parameters for a specific color
     */
    updateParameters(effectParams, color) {
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
    applyToVoice(voice, color) {
        if (!voice || !voice._setVibrato) {
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
    getCurrentSettings(color) {
        return this.currentSettings.get(color) || { speed: 0, span: 0 };
    }

    /**
     * Get effect instance for a color (for effects chaining)
     * Vibrato is applied directly to voice, so no separate instance needed
     */
    getEffectInstance(color) {
        // Vibrato modifies the voice directly, no separate effect instance
        return null;
    }

    /**
     * Create vibrato LFO settings for Tone.js
     * Helper method for voice creation
     */
    createVibratoSettings(speed, span) {
        if (speed === 0 || span === 0) {
            return null;
        }

        // Convert percentage values to Tone.js parameters
        const frequencyHz = (speed / 100) * 16; // 0-100% → 0-16 Hz
        const depthCents = (span / 100) * 50; // 0-100% → 0-50 cents
        
        return {
            frequency: frequencyHz,
            depth: depthCents
        };
    }

    /**
     * Disable vibrato for a specific color
     */
    disableForColor(color) {
        this.updateParameters({ speed: 0, span: 0 }, color);
    }

    /**
     * Cleanup
     */
    dispose() {
        this.currentSettings.clear();
        logger.info('VibratoAudioEffect', 'Disposed', null, 'audio');
    }
}

export default VibratoAudioEffect;