// js/services/timbreEffects/effectsAudio/audioEffectsManager.js
import store from '../../../state/index.js';
import logger from '../../../utils/logger.js';
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
 * EffectsCoordinator → AudioEffectsManager → Specific Audio Effects (vibrato, tremolo, etc.)
 */
class AudioEffectsManager {
    constructor() {
        // Initialize specific audio effect handlers
        this.vibratoEffect = new VibratoAudioEffect();
        this.tremoloEffect = new TremoloAudioEffect();
        this.reverbEffect = new ReverbAudioEffect();
        this.delayEffect = new DelayAudioEffect();
        
        console.log('🎛️ [AUDIO MANAGER DEBUG] AudioEffectsManager initialized with all effect handlers');
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

        console.log('🎛️ [AUDIO MANAGER DEBUG] All effect handlers initialized');

        // Listen for audio effect changes from main coordinator
        store.on('audioEffectChanged', ({ effectType, parameter, value, color, effectParams }) => {
            console.log('🎛️ [AUDIO MANAGER DEBUG] Received audioEffectChanged event:', { effectType, parameter, value, color, effectParams });
            this.handleAudioEffectChange(effectType, parameter, value, color, effectParams);
        });

        console.log('🎛️ [AUDIO MANAGER DEBUG] Event subscriptions established');
        logger.info('AudioEffectsManager', 'Event subscriptions established', null, 'audio');
        return true;
    }

    /**
     * Handle audio effect parameter changes
     */
    handleAudioEffectChange(effectType, parameter, value, color, effectParams) {
        console.log(`🎛️ [AUDIO MANAGER DEBUG] Processing audio effect: ${effectType}.${parameter} = ${value} for ${color}`, effectParams);
        logger.debug('AudioEffectsManager', `Processing audio effect: ${effectType}.${parameter} = ${value} for ${color}`, null, 'audio');

        switch (effectType) {
            case 'vibrato':
                console.log(`🎛️ [AUDIO MANAGER DEBUG] Routing to vibratoEffect`);
                this.vibratoEffect.updateParameters(effectParams, color);
                break;
                
            case 'tremolo':
                console.log(`🎛️ [AUDIO MANAGER DEBUG] Routing to tremoloEffect`);
                this.tremoloEffect.updateParameters(effectParams, color);
                break;
                
            case 'reverb':
                console.log(`🎛️ [AUDIO MANAGER DEBUG] Routing to reverbEffect`);
                this.reverbEffect.updateParameters(effectParams, color);
                break;
                
            case 'delay':
                console.log(`🎛️ [AUDIO MANAGER DEBUG] Routing to delayEffect`);
                this.delayEffect.updateParameters(effectParams, color);
                break;
                
            default:
                console.log(`🎛️ [AUDIO MANAGER DEBUG] Effect type ${effectType} not handled by audio system`);
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
     * Apply effects to a newly created voice
     */
    applyEffectsToVoice(voice, color) {
        console.log(`🎛️ [AUDIO MANAGER DEBUG] Creating effects chain for voice for ${color}`);
        
        // AMPLITUDE FIX: Create serial effects chain instead of parallel connections
        // Chain: Voice → [Vibrato/Tremolo applied directly] → Reverb → Delay → MainVolume
        
        // Apply vibrato and tremolo directly to voice (they modify the voice internally)
        this.vibratoEffect.applyToVoice(voice, color);
        this.tremoloEffect.applyToVoice(voice, color);
        
        // Get external effect instances for chaining
        const reverbInstance = this.reverbEffect.getEffectInstance(color);
        const delayInstance = this.delayEffect.getEffectInstance(color);
        
        // Create effects chain - only voice connects to first external effect, then serial chain
        let currentOutput = voice;
        
        if (reverbInstance) {
            currentOutput.connect(reverbInstance);
            currentOutput = reverbInstance;
            console.log(`🎛️ [EFFECTS CHAIN] → Reverb`);
        }
        
        if (delayInstance) {
            currentOutput.connect(delayInstance);
            currentOutput = delayInstance;
            console.log(`🎛️ [EFFECTS CHAIN] → Delay`);
        }
        
        // Final connection to main volume
        const mainVolume = window.synthEngine?.getMainVolumeNode();
        if (mainVolume && currentOutput !== voice) {
            currentOutput.connect(mainVolume);
            console.log(`🎛️ [EFFECTS CHAIN] → MainVolume`);
        } else if (mainVolume && currentOutput === voice) {
            // No effects active, connect voice directly to main volume
            voice.connect(mainVolume);
            console.log(`🎛️ [EFFECTS CHAIN] Voice → MainVolume (no effects)`);
        }
        
        console.log(`🎛️ [AUDIO MANAGER DEBUG] Effects chain completed for ${color}`);
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