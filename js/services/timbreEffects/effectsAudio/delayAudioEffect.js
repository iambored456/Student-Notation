// js/services/timbreEffects/effectsAudio/delayAudioEffect.js
import logger from '@utils/logger.js';
import * as Tone from 'tone';

logger.moduleLoaded('DelayAudioEffect');

/**
 * Delay Audio Effect
 * Handles audio-only delay implementation using Tone.js
 * Parameters: time (Delay Time - x-axis), feedback (Echoes - y-axis), wet (Mix - vertical slider)
 */
class DelayAudioEffect {
    constructor() {
        this.currentSettings = new Map(); // color -> delay settings
        this.delayInstances = new Map(); // color -> Tone.FeedbackDelay instance
        
        logger.info('DelayAudioEffect', 'Initialized', null, 'audio');
    }

    /**
     * Initialize the delay audio effect
     */
    init() {
        logger.info('DelayAudioEffect', 'Ready for audio processing', null, 'audio');
        return true;
    }

    /**
     * Update delay parameters for a specific color
     */
    updateParameters(effectParams, color) {
        const { time, feedback, wet = 15 } = effectParams;

        // Store current settings for this color
        this.currentSettings.set(color, { time, feedback, wet });

        logger.debug('DelayAudioEffect', `Updated parameters for ${color}`, { time, feedback, wet }, 'audio');

        // Update existing delay instance if it exists, or create new one if needed
        let delayInstance = this.delayInstances.get(color);

        if (delayInstance) {
            // Update existing instance
            this.updateDelayInstance(delayInstance, time, feedback, wet);
        } else if (time > 0 || feedback > 0) {
            // Create new instance if effect is enabled
            delayInstance = this.createDelayInstance(time, feedback, wet);
            if (delayInstance) {
                this.delayInstances.set(color, delayInstance);
                logger.debug('DelayAudioEffect', `Created new delay instance for ${color}`, { time, feedback, wet }, 'audio');

                // Trigger synth effects re-application
                if (window.synthEngine) {
                    window.synthEngine.updateSynthForColor(color);
                }
            }
        }
    }

    /**
     * Apply delay to a specific voice
     */
    applyToVoice(voice, color) {
        if (!voice) {
            return;
        }

        const settings = this.currentSettings.get(color);

        // Don't apply effects to existing voices if settings are undefined (not yet configured)
        // or if effect is disabled (both parameters are 0)
        if (!settings || (settings.time === 0 && settings.feedback === 0)) {
            return;
        }

        try {
            // Create delay instance for this color if not exists
            let delayInstance = this.delayInstances.get(color);
            if (!delayInstance) {
                delayInstance = this.createDelayInstance(settings.time, settings.feedback, settings.wet);
                this.delayInstances.set(color, delayInstance);
            }

            // Connect voice directly to delay (Tone.FeedbackDelay handles wet/dry mixing internally)
            // No need to disconnect from main volume - built-in wet control handles proper mixing
            if (voice && voice.output && (typeof voice.isDisposed !== 'function' || !voice.isDisposed())) {
                try {
                    voice.connect(delayInstance); // Direct connection - delay handles wet/dry internally
                } catch (connectError) {
                    // Try alternative connection method
                    if (voice.output) {
                        voice.output.connect(delayInstance);
                    }
                }
            }

            logger.debug('DelayAudioEffect', `Applied delay to voice for ${color}`, settings, 'audio');
        } catch (error) {
            logger.warn('DelayAudioEffect', `Failed to apply delay to voice for ${color}`, error, 'audio');
        }
    }

    /**
     * Get current settings for a color
     */
    getCurrentSettings(color) {
        return this.currentSettings.get(color) || { time: 0, feedback: 0 };
    }

    /**
     * Get effect instance for a color (for effects chaining)
     */
    getEffectInstance(color) {
        const settings = this.getCurrentSettings(color);
        // Only return instance if delay is actually enabled (time > 0 and wet > 0)
        if (settings.time > 0 && settings.wet > 0) {
            return this.delayInstances.get(color);
        }
        return null;
    }

    /**
     * Create a new Tone.FeedbackDelay instance with specified parameters
     */
    createDelayInstance(time, feedback, wet = 30) {
        if (time === 0 && feedback === 0) {
            return null;
        }

        // Convert percentage values to Tone.js parameters
        const delayTime = Math.max(0.01, (time / 100) * 0.5); // 0-100% â†’ 0.01-0.5 seconds (min 0.01 to avoid issues)
        const feedbackAmount = Math.min(0.95, feedback / 100); // 0-100% â†’ 0-0.95 (max 0.95 to avoid feedback loops)
        const wetAmount = wet / 100; // 0-100% â†’ 0-1
        
        // Use Tone.FeedbackDelay's built-in wet/dry mixing (same as Tone.Reverb)
        // DO NOT connect here - audioEffectsManager will connect it in the effects chain
        const delay = new Tone.FeedbackDelay({
            delayTime: delayTime,
            feedback: feedbackAmount,
            wet: wetAmount  // Use built-in wet control for equal loudness
        });

        delay._wetAmount = wetAmount;
        
        logger.debug('DelayAudioEffect', 'Created delay instance', { delayTime, feedbackAmount, wetAmount }, 'audio');
        return delay;
    }

    /**
     * Update an existing delay instance with new parameters
     */
    updateDelayInstance(delayInstance, time, feedback, wet = 15) {
        if (!delayInstance) return;
        
        try {
            const delayTime = Math.max(0.01, (time / 100) * 0.5);
            const feedbackAmount = Math.min(0.95, feedback / 100);
            const wetAmount = wet / 100;
            
            // Update delay timing and feedback parameters
            delayInstance.delayTime.value = delayTime;
            delayInstance.feedback.value = feedbackAmount;
            
            // Update crossfade mix amount (this is the key for Mix slider)
            if (delayInstance._crossFade) {
                delayInstance._crossFade.fade.value = wetAmount;
            }

            // Store updated wet amount
            delayInstance._wetAmount = wetAmount;
            
            logger.debug('DelayAudioEffect', 'Updated delay instance', { delayTime, feedbackAmount, wetAmount }, 'audio');
        } catch (error) {
            logger.warn('DelayAudioEffect', 'Failed to update delay instance', error, 'audio');
        }
    }

    /**
     * Create delay settings for Tone.js (legacy method for compatibility)
     */
    createDelaySettings(time, feedback, wet = 30) {
        if (time === 0 && feedback === 0) {
            return null;
        }

        const delayTime = Math.max(0.01, (time / 100) * 0.5); // 0-100% â†’ 0.01-0.5 seconds
        const feedbackAmount = Math.min(0.95, feedback / 100); // 0-100% â†’ 0-0.95
        const wetAmount = wet / 100; // 0-100% â†’ 0-1
        
        return {
            delayTime: delayTime,
            feedback: feedbackAmount,
            wet: wetAmount
        };
    }

    /**
     * Disable delay for a specific color
     */
    disableForColor(color) {
        this.updateParameters({ time: 0, feedback: 0, wet: 0 }, color);
        
        // Dispose of the delay instance and its crossfade mixer
        const delayInstance = this.delayInstances.get(color);
        if (delayInstance) {
            if (delayInstance._crossFade) {
                delayInstance._crossFade.dispose();
            }
            delayInstance.dispose();
            this.delayInstances.delete(color);
        }
    }

    /**
     * Cleanup
     */
    dispose() {
        // Dispose all delay instances and their crossfade mixers
        this.delayInstances.forEach((delay, color) => {
            try {
                if (delay._crossFade) {
                    delay._crossFade.dispose();
                }
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