// js/services/timbreEffects/effectsAudio/audioEffectsManager.js
import store from '@state/index.js';
import logger from '@utils/logger.js';
import VibratoAudioEffect from './vibratoAudioEffect.js';
import TremoloAudioEffect from './tremoloAudioEffect.js';
import ReverbAudioEffect from './reverbAudioEffect.js';
import DelayAudioEffect from './delayAudioEffect.js';

logger.moduleLoaded('AudioEffectsManager');

/**
 * Audio Effects Manager
 * Coordinates audio-only effect implementations
 * Handles integration with Tone.js and synthEngine
 * 
 * Data Flow:
 * EffectsCoordinator â†’ AudioEffectsManager â†’ Specific Audio Effects (vibrato, tremolo, etc.)
 */
class AudioEffectsManager {
    constructor() {
        // Initialize specific audio effect handlers
        this.vibratoEffect = new VibratoAudioEffect();
        this.tremoloEffect = new TremoloAudioEffect();
        this.reverbEffect = new ReverbAudioEffect();
        this.delayEffect = new DelayAudioEffect();

        logger.info('AudioEffectsManager', 'Initialized with audio effect handlers', null, 'audio');
    }

    /**
     * Initialize the audio effects manager
     */
    init() {
        // Initialize individual effect handlers
        this.vibratoEffect.init();
        this.tremoloEffect.init();
        this.reverbEffect.init();
        this.delayEffect.init();

        // Listen for audio effect changes from main coordinator
        store.on('audioEffectChanged', ({ effectType, parameter, value, color, effectParams }) => {
            this.handleAudioEffectChange(effectType, parameter, value, color, effectParams);
        });
        logger.info('AudioEffectsManager', 'Event subscriptions established', null, 'audio');
        return true;
    }

    /**
     * Handle audio effect parameter changes
     */
    handleAudioEffectChange(effectType, parameter, value, color, effectParams) {
        logger.debug('AudioEffectsManager', `Processing audio effect: ${effectType}.${parameter} = ${value} for ${color}`, null, 'audio');

        switch (effectType) {
            case 'vibrato':
                this.vibratoEffect.updateParameters(effectParams, color);
                break;

            case 'tremolo':
                this.tremoloEffect.updateParameters(effectParams, color);
                break;

            case 'reverb':
                this.reverbEffect.updateParameters(effectParams, color);
                break;

            case 'delay':
                this.delayEffect.updateParameters(effectParams, color);
                break;

            default:
                logger.debug('AudioEffectsManager', `Effect type ${effectType} not handled by audio system`, null, 'audio');
        }
    }

    /**
     * Get the current audio effect handler for a specific type
     */
    getEffectHandler(effectType) {
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

    /**
     * Apply effects to a synth (NOT individual voices)
     * This inserts effects between synth output and masterGain
     * Called during synth creation/update, not on every voice trigger
     */
    applySynthEffects(synth, color, masterGain) {
        // Vibrato and tremolo are applied to individual voices (they modify voice internally)
        // Reverb and delay are applied at synth level (inserted between synth and masterGain)

        // Get external effect instances
        const reverbInstance = this.reverbEffect.getEffectInstance(color);
        const delayInstance = this.delayEffect.getEffectInstance(color);

        const reverbSettings = this.reverbEffect.getCurrentSettings(color);
        const delaySettings = this.delayEffect.getCurrentSettings(color);

        // Disconnect synth from everything to rebuild clean chain
        try {
            synth.disconnect();
        } catch (error) {
            // Error disconnecting synth
        }

        // Create effects chain: Synth â†’ Reverb â†’ Delay â†’ MasterGain
        let currentOutput = synth;

        if (reverbInstance) {
            try {
                // Disconnect reverb from everything first to avoid double connections
                reverbInstance.disconnect();
                currentOutput.connect(reverbInstance);
                currentOutput = reverbInstance;
            } catch (error) {
                // Error connecting reverb
            }
        }

        if (delayInstance) {
            try {
                // Disconnect delay from everything first to avoid double connections
                delayInstance.disconnect();
                currentOutput.connect(delayInstance);
                currentOutput = delayInstance;
            } catch (error) {
                // Error connecting delay
            }
        }

        // Always reconnect final output to masterGain
        try {
            currentOutput.connect(masterGain);

            // Reconnect waveform analyzer if it exists
            if (window.synthEngine) {
                const analyzer = window.synthEngine.getWaveformAnalyzer(color);
                if (analyzer) {
                    synth.connect(analyzer);
                }
            }
        } catch (error) {
            // Error connecting to masterGain
        }
    }

    /**
     * Apply effects to individual voice (for vibrato/tremolo only)
     * Reverb/delay are now applied at synth level via applySynthEffects
     */
    applyEffectsToVoice(voice, color) {
        // Only apply vibrato and tremolo to individual voices
        // These modify the voice internally without creating parallel signal paths
        this.vibratoEffect.applyToVoice(voice, color);
        this.tremoloEffect.applyToVoice(voice, color);
    }

    /**
     * Cleanup
     */
    dispose() {
        this.vibratoEffect.dispose();
        this.tremoloEffect.dispose();
        this.reverbEffect.dispose();
        this.delayEffect.dispose();
        logger.info('AudioEffectsManager', 'Disposed', null, 'audio');
    }
}

// Create and export singleton
const audioEffectsManager = new AudioEffectsManager();
export default audioEffectsManager;