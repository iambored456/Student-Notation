// js/services/timbreEffects/effectsAudio/reverbAudioEffect.js
import logger from '../../../utils/logger.js';
import * as Tone from 'tone';

logger.moduleLoaded('ReverbAudioEffect');

/**
 * Reverb Audio Effect
 * Handles audio-only reverb implementation using Tone.js
 * Parameters: decay (Time - x-axis), roomSize (Size - y-axis), wet (Mix - vertical slider)
 */
class ReverbAudioEffect {
    constructor() {
        this.currentSettings = new Map(); // color -> reverb settings
        this.reverbInstances = new Map(); // color -> Tone.Reverb instance
        
        logger.info('ReverbAudioEffect', 'Initialized', null, 'audio');
    }

    /**
     * Initialize the reverb audio effect
     */
    init() {
        logger.info('ReverbAudioEffect', 'Ready for audio processing', null, 'audio');
        return true;
    }

    /**
     * Update reverb parameters for a specific color
     */
    updateParameters(effectParams, color) {
        const { decay, roomSize, wet = 10 } = effectParams;
        
        console.log(`🔊 [REVERB DEBUG] updateParameters called:`, { color, decay, roomSize, wet });
        
        // Store current settings for this color
        this.currentSettings.set(color, { decay, roomSize, wet });

        logger.debug('ReverbAudioEffect', `Updated parameters for ${color}`, { decay, roomSize, wet }, 'audio');
        
        // Update existing reverb instance if it exists
        const reverbInstance = this.reverbInstances.get(color);
        if (reverbInstance) {
            console.log(`🔊 [REVERB DEBUG] Updating existing reverb instance for ${color}`);
            this.updateReverbInstance(reverbInstance, decay, roomSize, wet);
        } else {
            console.log(`🔊 [REVERB DEBUG] No existing reverb instance for ${color}, will create on next voice`);
        }
    }

    /**
     * Apply reverb to a specific voice
     */
    async applyToVoice(voice, color) {
        console.log(`🔊 [REVERB DEBUG] applyToVoice called:`, { voice: !!voice, color });
        
        if (!voice) {
            console.log(`🔊 [REVERB DEBUG] No voice provided, skipping reverb`);
            return;
        }

        const settings = this.currentSettings.get(color);
        console.log(`🔊 [REVERB DEBUG] Current settings for ${color}:`, settings);
        
        // Don't apply effects to existing voices if settings are undefined (not yet configured)
        // or if effect is disabled (both parameters are 0)
        if (!settings || (settings.decay === 0 && settings.roomSize === 0)) {
            console.log(`🔊 [REVERB DEBUG] No reverb needed or reverb disabled for ${color} - leaving voice in original audio chain`);
            return;
        }

        try {
            // Create reverb instance for this color if not exists
            let reverbInstance = this.reverbInstances.get(color);
            if (!reverbInstance) {
                console.log(`🔊 [REVERB DEBUG] Creating new reverb instance for ${color}`);
                reverbInstance = await this.createReverbInstance(settings.decay, settings.roomSize, settings.wet);
                this.reverbInstances.set(color, reverbInstance);
                console.log(`🔊 [REVERB DEBUG] Reverb instance created and stored for ${color}`);
            } else {
                console.log(`🔊 [REVERB DEBUG] Using existing reverb instance for ${color}`);
            }

            // Connect voice directly to reverb (Tone.Reverb handles wet/dry mixing internally)
            // No need to disconnect from main volume - built-in wet control handles proper mixing
            if (voice && voice.output && (typeof voice.isDisposed !== 'function' || !voice.isDisposed())) {
                try {
                    voice.connect(reverbInstance); // Direct connection - reverb handles wet/dry internally
                    console.log(`🔊 [REVERB DEBUG] Voice connected directly to reverb (built-in wet/dry mixing)`);
                    
                    // AMPLITUDE DEBUG: Track reverb effect application
                    console.log(`🎵 [AMPLITUDE] Reverb Applied [${color}] - Decay: ${settings.decay}%, Room: ${settings.roomSize}%, Wet: ${settings.wet}%`);
                } catch (connectError) {
                    console.warn(`🔊 [REVERB DEBUG] Connection error for ${color}:`, connectError.message);
                    // Try alternative connection method
                    if (voice.output) {
                        voice.output.connect(reverbInstance);
                        console.log(`🔊 [REVERB DEBUG] Connected using voice.output instead`);
                    }
                }
            } else {
                console.error(`🔊 [REVERB DEBUG] Invalid voice state - voice:${!!voice}, voice.output:${!!(voice?.output)}, hasIsDisposed:${typeof voice?.isDisposed === 'function'}, disposed:${voice?.isDisposed?.()}`);
            }
            
            logger.debug('ReverbAudioEffect', `Applied reverb to voice for ${color}`, settings, 'audio');
        } catch (error) {
            console.error(`🔊 [REVERB DEBUG] Error applying reverb to voice for ${color}:`, error);
            logger.warn('ReverbAudioEffect', `Failed to apply reverb to voice for ${color}`, error, 'audio');
        }
    }

    /**
     * Get current settings for a color
     */
    getCurrentSettings(color) {
        return this.currentSettings.get(color) || { decay: 0, roomSize: 0 };
    }

    /**
     * Get effect instance for a color (for effects chaining)
     */
    getEffectInstance(color) {
        const settings = this.getCurrentSettings(color);
        // Only return instance if reverb is actually enabled (wet > 0)
        if (settings.wet > 0) {
            return this.reverbInstances.get(color);
        }
        return null;
    }

    /**
     * Create a new Tone.Reverb instance with specified parameters
     */
    async createReverbInstance(decay, roomSize, wet = 10) {
        console.log(`🔊 [REVERB DEBUG] createReverbInstance called:`, { decay, roomSize, wet });
        
        if (decay === 0 && roomSize === 0) {
            console.log(`🔊 [REVERB DEBUG] Both decay and roomSize are 0, returning null`);
            return null;
        }

        // Convert percentage values to Tone.js parameters
        // Use both decay and roomSize to determine reverb characteristics
        const baseDecay = Math.max(0.1, (decay / 100) * 8); // 0-100% → 0.1-8 seconds
        const roomSizeMultiplier = 1 + (roomSize / 100) * 1.5; // roomSize adds 0-150% to decay time
        const decayTime = baseDecay * roomSizeMultiplier;
        const wetAmount = wet / 100; // 0-100% → 0-1
        
        console.log(`🔊 [REVERB DEBUG] Converted parameters:`, { baseDecay, roomSizeMultiplier, decayTime, wetAmount });
        
        // Use Tone.Reverb's built-in wet/dry mixing for consistent loudness
        console.log(`🔊 [REVERB DEBUG] Creating Tone.Reverb instance with built-in wet/dry mixing...`);
        const reverb = new Tone.Reverb({
            decay: decayTime,
            wet: wetAmount  // Use Tone.Reverb's built-in wet control - maintains equal loudness!
        }).connect(window.synthEngine?.getMainVolumeNode() || Tone.Destination);
        
        console.log(`🔊 [REVERB DEBUG] Reverb created with built-in ${(wetAmount * 100).toFixed(1)}% wet mix`);
        console.log(`🎵 [AMPLITUDE] Using Tone.Reverb built-in wet control - Equal loudness maintained automatically!`);
        
        // Store wet amount for parameter updates
        reverb._wetAmount = wetAmount;
        
        console.log(`🔊 [REVERB DEBUG] Tone.Reverb created, waiting for ready...`);
        
        // Wait for reverb to generate its impulse response
        await reverb.ready;
        
        console.log(`🔊 [REVERB DEBUG] Reverb instance ready!`, { decayTime, wetAmount, roomSize });
        logger.debug('ReverbAudioEffect', 'Created reverb instance', { decayTime, wetAmount, roomSize }, 'audio');
        return reverb;
    }

    /**
     * Update an existing reverb instance with new parameters
     */
    updateReverbInstance(reverbInstance, decay, roomSize, wet = 10) {
        if (!reverbInstance) return;
        
        try {
            // Calculate new decay time with room size
            const baseDecay = Math.max(0.1, (decay / 100) * 8);
            const roomSizeMultiplier = 1 + (roomSize / 100) * 1.5;
            const decayTime = baseDecay * roomSizeMultiplier;
            const wetAmount = wet / 100;
            
            // Update reverb decay time
            reverbInstance.decay = decayTime;
            
            // Update crossfade mix amount (this is the key for Mix slider)
            if (reverbInstance._crossFade) {
                reverbInstance._crossFade.fade.value = wetAmount;
                console.log(`🔊 [REVERB DEBUG] Updated crossfade mix to ${(wetAmount * 100).toFixed(1)}% wet`);
            }
            
            // Store updated wet amount
            reverbInstance._wetAmount = wetAmount;
            
            logger.debug('ReverbAudioEffect', 'Updated reverb instance', { decayTime, wetAmount, roomSize }, 'audio');
        } catch (error) {
            logger.warn('ReverbAudioEffect', 'Failed to update reverb instance', error, 'audio');
        }
    }

    /**
     * Create reverb settings for Tone.js (legacy method for compatibility)
     */
    createReverbSettings(decay, roomSize, wet = 25) {
        if (decay === 0 && roomSize === 0) {
            return null;
        }

        const decayTime = Math.max(0.1, (decay / 100) * 10); // 0-100% → 0.1-10 seconds
        const wetAmount = wet / 100; // 0-100% → 0-1
        
        return {
            decay: decayTime,
            roomSize: roomSize / 100, // For future use if room size becomes relevant
            wet: wetAmount
        };
    }

    /**
     * Disable reverb for a specific color
     */
    disableForColor(color) {
        this.updateParameters({ decay: 0, roomSize: 0, wet: 0 }, color);
        
        // Dispose of the reverb instance and its crossfade mixer
        const reverbInstance = this.reverbInstances.get(color);
        if (reverbInstance) {
            if (reverbInstance._crossFade) {
                reverbInstance._crossFade.dispose();
            }
            reverbInstance.dispose();
            this.reverbInstances.delete(color);
        }
    }

    /**
     * Cleanup
     */
    dispose() {
        // Dispose all reverb instances and their crossfade mixers
        this.reverbInstances.forEach((reverb, color) => {
            try {
                if (reverb._crossFade) {
                    reverb._crossFade.dispose();
                }
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