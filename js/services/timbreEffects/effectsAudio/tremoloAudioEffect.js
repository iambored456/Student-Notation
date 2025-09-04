// js/services/timbreEffects/effectsAudio/tremoloAudioEffect.js
import logger from '../../../utils/logger.js';
import * as Tone from 'tone';

logger.moduleLoaded('TremoloAudioEffect');

/**
 * Tremolo Audio Effect
 * Handles audio-only tremolo implementation using Tone.js
 * Extracted from synthEngine.js for clean separation
 */
class TremoloAudioEffect {
    constructor() {
        this.currentSettings = new Map(); // color -> tremolo settings
        
        logger.info('TremoloAudioEffect', 'Initialized', null, 'audio');
    }

    /**
     * Initialize the tremolo audio effect
     */
    init() {
        logger.info('TremoloAudioEffect', 'Ready for audio processing', null, 'audio');
        return true;
    }

    /**
     * Update tremolo parameters for a specific color
     */
    updateParameters(effectParams, color) {
        const { speed, span } = effectParams;
        
        // Store current settings for this color
        this.currentSettings.set(color, { speed, span });

        logger.debug('TremoloAudioEffect', `Updated parameters for ${color}`, { speed, span }, 'audio');
        
        // The actual application to voices happens in applyToVoice()
        // when voices are created/updated by the synthEngine
    }

    /**
     * Apply tremolo to a specific voice
     */
    applyToVoice(voice, color) {
        if (!voice || !voice._setTremolo) {
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
    getCurrentSettings(color) {
        return this.currentSettings.get(color) || { speed: 0, span: 0 };
    }

    /**
     * Get effect instance for a color (for effects chaining)
     * Tremolo is applied directly to voice, so no separate instance needed
     */
    getEffectInstance(color) {
        // Tremolo modifies the voice directly, no separate effect instance
        return null;
    }

    /**
     * Create tremolo LFO settings for Tone.js
     * Helper method for voice creation
     */
    createTremoloSettings(speed, span) {
        if (speed === 0 || span === 0) {
            return null;
        }

        // Convert percentage values to Tone.js parameters
        const frequencyHz = (speed / 100) * 16; // 0-100% → 0-16 Hz
        const depthPercentage = span / 100; // 0-100% → 0-1
        
        return {
            frequency: frequencyHz,
            depth: depthPercentage
        };
    }

    /**
     * Disable tremolo for a specific color
     */
    disableForColor(color) {
        this.updateParameters({ speed: 0, span: 0 }, color);
    }

    /**
     * Cleanup
     */
    dispose() {
        this.currentSettings.clear();
        logger.info('TremoloAudioEffect', 'Disposed', null, 'audio');
    }
}

export default TremoloAudioEffect;