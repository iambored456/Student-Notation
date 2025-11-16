// js/services/timbreEffects/effectsCoordinator.js
import store from '@state/index.js';
import logger from '@utils/logger.js';

logger.moduleLoaded('EffectsCoordinator');

/**
 * Effects Coordinator Service - MAIN COORDINATOR
 * Central hub for managing effect parameters and distributing them to specialized systems
 *
 * Data Flow:
 * UI Dials → EffectsCoordinator → Audio Manager (for sound effects)
 *                               → Animation Manager (for visual effects)
 *
 * External UI Dependencies:
 * - js/components/audio/Effects/effectsController.js (handles dial UI interactions)
 */
class EffectsCoordinator {
  constructor() {
    // Central effect parameter storage - separate from timbres
    this.effectParameters = new Map(); // color -> { vibrato: {...}, tremolo: {...}, ... }

    // Default effect configurations (all start at 0,0)
    this.defaultEffects = {
      vibrato: { speed: 0, span: 0 },
      tremolo: { speed: 0, span: 0 },
      reverb: { decay: 0, roomSize: 0 },  // x: decay (time), y: roomSize (size)
      delay: { time: 0, feedback: 0 }     // x: time, y: feedback (echoes)
    };

    logger.info('EffectsCoordinator', 'Initialized as main coordinator', null, 'effects');
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

    // Load saved values from localStorage
    this.loadSavedValues();

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

    // Distribute to consumers with separate events
    this.notifyAudioSystem(effectType, parameter, value, color, colorEffects[effectType]);
    this.notifyAnimationSystem(effectType, parameter, value, color, colorEffects[effectType]);

    // Also update the timbre state for persistence (but don't use it as source of truth)
    this.updateTimbreState(effectType, colorEffects[effectType], color);

    // Save to localStorage whenever parameters change
    this.saveValues();
  }

  /**
     * Notify the audio system of effect changes
     */
  notifyAudioSystem(effectType, parameter, value, color, fullEffectParams) {
    store.emit('audioEffectChanged', {
      effectType,
      parameter,
      value,
      color,
      effectParams: { ...fullEffectParams } // Send full effect parameters
    });

    logger.debug('EffectsCoordinator', `Notified audio system: ${effectType}.${parameter} = ${value} for ${color}`, null, 'effects');
  }

  /**
     * Notify the animation system of effect changes
     */
  notifyAnimationSystem(effectType, parameter, value, color, fullEffectParams) {
    // Only send animation events for effects that have visual components
    if (effectType === 'vibrato' || effectType === 'tremolo') {
      store.emit('visualEffectChanged', {
        effectType,
        parameter,
        value,
        color,
        effectParams: { ...fullEffectParams } // Send full effect parameters
      });

      logger.debug('EffectsCoordinator', `Notified animation system: ${effectType}.${parameter} = ${value} for ${color}`, null, 'effects');
    }
  }

  /**
     * Update timbre state for persistence (backward compatibility)
     */
  updateTimbreState(effectType, effectParams, color) {
    const timbre = store.state.timbres[color];
    if (!timbre) {return;}

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
        this.notifyAudioSystem(effectType, parameter, colorEffects[effectType][parameter], color, colorEffects[effectType]);
        this.notifyAnimationSystem(effectType, parameter, colorEffects[effectType][parameter], color, colorEffects[effectType]);
      });
    });

    logger.info('EffectsCoordinator', `Reset all effects for color ${color}`, colorEffects, 'effects');
  }

  /**
     * Save effect values to localStorage
     */
  saveValues() {
    const dialData = {};

    // Save values for all colors and all effect types
    Object.keys(store.state.timbres).forEach(color => {
      const colorEffects = this.effectParameters.get(color);
      if (colorEffects) {
        dialData[color] = {
          vibrato: colorEffects.vibrato || { speed: 0, span: 0 },
          tremelo: colorEffects.tremolo || { speed: 0, span: 0 },
          reverb: colorEffects.reverb || { decay: 0, roomSize: 0 },
          delay: colorEffects.delay || { time: 0, feedback: 0 }
        };
      }
    });

    try {
      localStorage.setItem('effectDialValues', JSON.stringify(dialData));
      logger.debug('EffectsCoordinator', 'Saved effect values to localStorage', null, 'effects');
    } catch (e) {
      logger.warn('EffectsCoordinator', 'Failed to save effect values to localStorage', e, 'effects');
    }
  }

  /**
     * Load saved values from localStorage
     */
  loadSavedValues() {
    try {
      const saved = localStorage.getItem('effectDialValues');
      if (!saved) {
        logger.debug('EffectsCoordinator', 'No saved effect values found', null, 'effects');
        return;
      }

      const dialData = JSON.parse(saved);
      logger.debug('EffectsCoordinator', 'Loading saved effect values', null, 'effects');

      // Apply saved values through our own updateParameter method for proper data flow
      Object.keys(dialData).forEach(color => {
        const timbre = store.state.timbres[color];
        const savedData = dialData[color];

        if (timbre && savedData) {
          // Route through our updateParameter for proper data flow separation
          if (savedData.vibrato) {
            Object.entries(savedData.vibrato).forEach(([param, value]) => {
              if (typeof value === 'number') {
                this.updateParameter('vibrato', param, value, color);
              }
            });
          }

          // Route through our updateParameter for proper data flow separation
          if (savedData.tremelo) {
            Object.entries(savedData.tremelo).forEach(([param, value]) => {
              if (typeof value === 'number') {
                this.updateParameter('tremolo', param, value, color);
              }
            });
          }

          // Route reverb through our updateParameter
          if (savedData.reverb) {
            Object.entries(savedData.reverb).forEach(([param, value]) => {
              if (typeof value === 'number') {
                this.updateParameter('reverb', param, value, color);
              }
            });
          }

          // Route delay through our updateParameter
          if (savedData.delay) {
            Object.entries(savedData.delay).forEach(([param, value]) => {
              if (typeof value === 'number') {
                this.updateParameter('delay', param, value, color);
              }
            });
          }
        }
      });

      logger.info('EffectsCoordinator', 'Applied saved effect values', null, 'effects');

      // After loading saved values, trigger synth re-initialization for reverb/delay
      // This ensures effect instances are connected to existing synths
      if (window.synthEngine) {
        Object.keys(dialData).forEach(color => {
          const savedData = dialData[color];
          // Only trigger if reverb or delay effects are enabled
          if ((savedData.reverb && (savedData.reverb.decay > 0 || savedData.reverb.roomSize > 0)) ||
                        (savedData.delay && (savedData.delay.time > 0 || savedData.delay.feedback > 0))) {
            window.synthEngine.updateSynthForColor(color);
            logger.debug('EffectsCoordinator', `Re-applied effects to synth for ${color}`, null, 'effects');
          }
        });
      }
    } catch (e) {
      logger.warn('EffectsCoordinator', 'Failed to load saved effect values', e, 'effects');
    }
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
