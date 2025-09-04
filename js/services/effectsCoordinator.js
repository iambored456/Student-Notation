// js/services/effectsCoordinator.js
import store from '../state/index.js';
import logger from '../utils/logger.js';

logger.moduleLoaded('EffectsCoordinator');

/**
 * Effects Coordinator Service
 * Central hub for managing effect parameters and distributing them to audio and visual systems
 * 
 * Data Flow:
 * UI Dials → EffectsCoordinator → Audio Engine (for sound effects)
 *                               → Animation Engine (for visual effects)
 */
class EffectsCoordinator {
    constructor() {
        // Central effect parameter storage - separate from timbres
        this.effectParameters = new Map(); // color -> { vibrato: {...}, tremolo: {...}, ... }
        
        // Default effect configurations
        this.defaultEffects = {
            vibrato: { speed: 0, span: 0 },
            tremolo: { speed: 0, span: 0 },
            reverb: { roomSize: 0, decay: 0, wet: 10 }, // Reduced from 25% to 10% to prevent amplitude boost
            delay: { time: 0, feedback: 0, wet: 15 },   // Reduced from 30% to 15% to prevent amplitude boost  
            phaser: { rate: 50, depth: 75, stages: 6 }
        };
        
        logger.info('EffectsCoordinator', 'Initialized', null, 'effects');
    }

    /**
     * Initialize the effects coordinator
     */
    init() {
        // Initialize effect parameters for all existing colors
        Object.keys(store.state.timbres).forEach(color => {
            this.initializeColorEffects(color);
        });
        
        // Listen for new timbres being created
        store.on('timbreCreated', ({ color }) => {
            this.initializeColorEffects(color);
        });
        
        logger.info('EffectsCoordinator', 'Event subscriptions established', null, 'effects');
        return true;
    }

    /**
     * Initialize effect parameters for a specific color
     */
    initializeColorEffects(color) {
        if (!this.effectParameters.has(color)) {
            // Create fresh effect parameters for this color
            const colorEffects = {};
            Object.entries(this.defaultEffects).forEach(([effectType, defaultParams]) => {
                colorEffects[effectType] = { ...defaultParams };
            });
            
            this.effectParameters.set(color, colorEffects);
            
            // Check if there are existing effect values in timbres and migrate them
            const timbre = store.state.timbres[color];
                
            if (timbre) {
                // Migrate existing vibrato settings
                if (timbre.vibrato) {
                        colorEffects.vibrato = { ...timbre.vibrato };
                }
                // Migrate existing tremolo settings
                if (timbre.tremelo) {
                        colorEffects.tremolo = { ...timbre.tremelo };
                }
            }
            
                logger.debug('EffectsCoordinator', `Initialized effects for color ${color}`, colorEffects, 'effects');
        }
    }

    /**
     * Update a specific effect parameter for a color
     * This is the single entry point for all effect parameter changes
     */
    updateParameter(effectType, parameter, value, color) {
        console.log(`🎛️ [COORDINATOR DEBUG] updateParameter called:`, { effectType, parameter, value, color });
        
        if (!color) {
            logger.warn('EffectsCoordinator', 'Cannot update parameter: no color provided', { effectType, parameter, value }, 'effects');
            return;
        }

        // Ensure color effects are initialized
        this.initializeColorEffects(color);
        
        const colorEffects = this.effectParameters.get(color);
        if (!colorEffects[effectType]) {
            colorEffects[effectType] = { ...this.defaultEffects[effectType] };
        }

        // Update the parameter
        const oldValue = colorEffects[effectType][parameter];
        colorEffects[effectType][parameter] = value;
        
        console.log(`🎛️ [COORDINATOR DEBUG] Parameter updated: ${effectType}.${parameter} from ${oldValue} to ${value} for ${color}`);
        
        // Distribute to consumers with separate events
        this.notifyAudioEngine(effectType, parameter, value, color, colorEffects[effectType]);
        this.notifyAnimationEngine(effectType, parameter, value, color, colorEffects[effectType]);
        
        // Also update the timbre state for persistence (but don't use it as source of truth)
        this.updateTimbreState(effectType, colorEffects[effectType], color);
    }

    /**
     * Notify the audio engine of effect changes
     */
    notifyAudioEngine(effectType, parameter, value, color, fullEffectParams) {
        console.log(`🎛️ [COORDINATOR DEBUG] Notifying audio engine:`, { effectType, parameter, value, color, fullEffectParams });
        
        store.emit('audioEffectChanged', {
            effectType,
            parameter,
            value,
            color,
            effectParams: { ...fullEffectParams } // Send full effect parameters
        });
        
        console.log(`🎛️ [COORDINATOR DEBUG] audioEffectChanged event emitted for ${effectType}.${parameter} = ${value} for ${color}`);
        logger.debug('EffectsCoordinator', `Notified audio engine: ${effectType}.${parameter} = ${value} for ${color}`, null, 'effects');
    }

    /**
     * Notify the animation engine of effect changes
     */
    notifyAnimationEngine(effectType, parameter, value, color, fullEffectParams) {
        // Only send animation events for effects that have visual components
        if (effectType === 'vibrato' || effectType === 'tremolo') {
            store.emit('visualEffectChanged', {
                effectType,
                parameter,
                value,
                color,
                effectParams: { ...fullEffectParams } // Send full effect parameters
            });
            
            logger.debug('EffectsCoordinator', `Notified animation engine: ${effectType}.${parameter} = ${value} for ${color}`, null, 'effects');
        }
    }

    /**
     * Update timbre state for persistence (backward compatibility)
     */
    updateTimbreState(effectType, effectParams, color) {
        const timbre = store.state.timbres[color];
        if (!timbre) return;

        // Map effect types to timbre property names
        const timbrePropertyMap = {
            vibrato: 'vibrato',
            tremolo: 'tremelo' // Note: keeping the existing misspelling for compatibility
        };

        const timbreProperty = timbrePropertyMap[effectType];
        if (timbreProperty) {
            // Ensure the timbre property exists
            if (!timbre[timbreProperty]) {
                timbre[timbreProperty] = {};
            }
            
            // Update timbre state to match coordinator state
            Object.assign(timbre[timbreProperty], effectParams);
            
            // Record state change for persistence
            store.recordState();
        }
    }

    /**
     * Get effect parameters for a specific color and effect type
     */
    getEffectParameters(color, effectType) {
        const colorEffects = this.effectParameters.get(color);
        
        if (!colorEffects || !colorEffects[effectType]) {
            return { ...this.defaultEffects[effectType] };
        }
        
        return { ...colorEffects[effectType] };
    }

    /**
     * Get all effect parameters for a specific color
     */
    getAllEffectParameters(color) {
        const colorEffects = this.effectParameters.get(color);
        if (!colorEffects) {
            return { ...this.defaultEffects };
        }
        return { ...colorEffects };
    }

    /**
     * Reset all effects for a color to defaults
     */
    resetColorEffects(color) {
        const colorEffects = {};
        Object.entries(this.defaultEffects).forEach(([effectType, defaultParams]) => {
            colorEffects[effectType] = { ...defaultParams };
        });
        
        this.effectParameters.set(color, colorEffects);
        
        // Notify all systems of the reset
        Object.keys(colorEffects).forEach(effectType => {
            Object.keys(colorEffects[effectType]).forEach(parameter => {
                this.notifyAudioEngine(effectType, parameter, colorEffects[effectType][parameter], color, colorEffects[effectType]);
                this.notifyAnimationEngine(effectType, parameter, colorEffects[effectType][parameter], color, colorEffects[effectType]);
            });
        });
        
        logger.info('EffectsCoordinator', `Reset all effects for color ${color}`, colorEffects, 'effects');
    }

    /**
     * Cleanup
     */
    dispose() {
        this.effectParameters.clear();
        logger.info('EffectsCoordinator', 'Disposed', null, 'effects');
    }
}

// Create and export singleton
const effectsCoordinator = new EffectsCoordinator();
export default effectsCoordinator;