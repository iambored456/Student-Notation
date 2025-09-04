// js/services/timbreEffects/effectsAudio/delayAudioEffect.js
import logger from '../../../utils/logger.js';
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
        
        console.log(`🔊 [DELAY DEBUG] updateParameters called:`, { color, time, feedback, wet });
        
        // Store current settings for this color
        this.currentSettings.set(color, { time, feedback, wet });

        logger.debug('DelayAudioEffect', `Updated parameters for ${color}`, { time, feedback, wet }, 'audio');
        
        // Update existing delay instance if it exists
        const delayInstance = this.delayInstances.get(color);
        if (delayInstance) {
            console.log(`🔊 [DELAY DEBUG] Updating existing delay instance for ${color}`);
            this.updateDelayInstance(delayInstance, time, feedback, wet);
        } else {
            console.log(`🔊 [DELAY DEBUG] No existing delay instance for ${color}, will create on next voice`);
        }
    }

    /**
     * Apply delay to a specific voice
     */
    applyToVoice(voice, color) {
        console.log(`🔊 [DELAY DEBUG] applyToVoice called:`, { voice: !!voice, color });
        
        if (!voice) {
            console.log(`🔊 [DELAY DEBUG] No voice provided, skipping delay`);
            return;
        }

        const settings = this.currentSettings.get(color);
        console.log(`🔊 [DELAY DEBUG] Current settings for ${color}:`, settings);
        
        // Don't apply effects to existing voices if settings are undefined (not yet configured)
        // or if effect is disabled (both parameters are 0)
        if (!settings || (settings.time === 0 && settings.feedback === 0)) {
            console.log(`🔊 [DELAY DEBUG] No delay needed or delay disabled for ${color} - leaving voice in original audio chain`);
            return;
        }

        try {
            // Create delay instance for this color if not exists
            let delayInstance = this.delayInstances.get(color);
            if (!delayInstance) {
                console.log(`🔊 [DELAY DEBUG] Creating new delay instance for ${color}`);
                delayInstance = this.createDelayInstance(settings.time, settings.feedback, settings.wet);
                this.delayInstances.set(color, delayInstance);
                console.log(`🔊 [DELAY DEBUG] Delay instance created and stored for ${color}`);
            } else {
                console.log(`🔊 [DELAY DEBUG] Using existing delay instance for ${color}`);
            }

            // Connect voice directly to delay (Tone.FeedbackDelay handles wet/dry mixing internally)
            // No need to disconnect from main volume - built-in wet control handles proper mixing
            if (voice && voice.output && (typeof voice.isDisposed !== 'function' || !voice.isDisposed())) {
                try {
                    voice.connect(delayInstance); // Direct connection - delay handles wet/dry internally
                    console.log(`🔊 [DELAY DEBUG] Voice connected directly to delay (built-in wet/dry mixing)`);
                    
                    // AMPLITUDE DEBUG: Track delay effect application
                    console.log(`🎵 [AMPLITUDE] Delay Applied [${color}] - Time: ${settings.time}%, Feedback: ${settings.feedback}%, Wet: ${settings.wet}%`);
                } catch (connectError) {
                    console.warn(`🔊 [DELAY DEBUG] Connection error for ${color}:`, connectError.message);
                    // Try alternative connection method
                    if (voice.output) {
                        voice.output.connect(delayInstance);
                        console.log(`🔊 [DELAY DEBUG] Connected using voice.output instead`);
                    }
                }
            } else {
                console.error(`🔊 [DELAY DEBUG] Invalid voice state - voice:${!!voice}, voice.output:${!!(voice?.output)}, hasIsDisposed:${typeof voice?.isDisposed === 'function'}, disposed:${voice?.isDisposed?.()}`);
            }
            
            logger.debug('DelayAudioEffect', `Applied delay to voice for ${color}`, settings, 'audio');
        } catch (error) {
            console.error(`🔊 [DELAY DEBUG] Error applying delay to voice for ${color}:`, error);
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
        const delayTime = Math.max(0.01, (time / 100) * 0.5); // 0-100% → 0.01-0.5 seconds (min 0.01 to avoid issues)
        const feedbackAmount = Math.min(0.95, feedback / 100); // 0-100% → 0-0.95 (max 0.95 to avoid feedback loops)
        const wetAmount = wet / 100; // 0-100% → 0-1
        
        // Use Tone.FeedbackDelay's built-in wet/dry mixing (same as Tone.Reverb)
        const delay = new Tone.FeedbackDelay({
            delayTime: delayTime,
            feedback: feedbackAmount,
            wet: wetAmount  // Use built-in wet control for equal loudness
        }).connect(window.synthEngine?.getMainVolumeNode() || Tone.Destination);
        
        console.log(`🔊 [DELAY DEBUG] Delay created with built-in ${(wetAmount * 100).toFixed(1)}% wet mix`);
        console.log(`🎵 [AMPLITUDE] Using Tone.FeedbackDelay built-in wet control - Equal loudness maintained!`);
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
                console.log(`🔊 [DELAY DEBUG] Updated crossfade mix to ${(wetAmount * 100).toFixed(1)}% wet`);
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

        const delayTime = Math.max(0.01, (time / 100) * 0.5); // 0-100% → 0.01-0.5 seconds
        const feedbackAmount = Math.min(0.95, feedback / 100); // 0-100% → 0-0.95
        const wetAmount = wet / 100; // 0-100% → 0-1
        
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