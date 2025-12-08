// js/services/effectsCoordinator.ts
import store from '@state/index.ts';
import logger from '@utils/logger.ts';

logger.moduleLoaded('EffectsCoordinator');

interface DebugMessage {
  level: string;
  args: unknown[];
  timestamp: number;
}

const effectsCoordinatorDebug: DebugMessage[] = [];

function recordCoordinatorDebug(level: string, ...args: unknown[]): void {
  effectsCoordinatorDebug.push({ level, args, timestamp: Date.now() });
}

type EffectParams = Record<string, number>;
type EffectType = 'vibrato' | 'tremolo' | 'reverb' | 'delay' | 'phaser';

type DefaultEffects = Record<EffectType, EffectParams>;
type ColorEffects = Partial<Record<EffectType, EffectParams>> & Record<string, EffectParams | undefined>;

/**
 * Effects Coordinator Service
 * Central hub for managing effect parameters and distributing them to audio and visual systems
 *
 * Data Flow:
 * UI Dials → EffectsCoordinator → Audio Engine (for sound effects)
 *                               → Animation Engine (for visual effects)
 */
class EffectsCoordinator {
  private effectParameters = new Map<string, ColorEffects>();
  private defaultEffects: DefaultEffects;

  private cloneDefault(effectType: string): EffectParams {
    return { ...(this.defaultEffects[effectType as EffectType] || {}) };
  }

  private ensureEffect(colorEffects: ColorEffects, effectType: string): EffectParams {
    if (!colorEffects[effectType]) {
      colorEffects[effectType] = this.cloneDefault(effectType);
    }
    return colorEffects[effectType];
  }

  constructor() {
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
  init(): boolean {
    // Initialize effect parameters for all existing colors
    Object.keys(store.state.timbres).forEach(color => {
      this.initializeColorEffects(color);
    });

    // Listen for new timbres being created
    store.on('timbreCreated', (data: unknown) => {
      const { color } = data as { color: string };
      this.initializeColorEffects(color);
    });

    logger.info('EffectsCoordinator', 'Event subscriptions established', null, 'effects');
    return true;
  }

  /**
     * Initialize effect parameters for a specific color
     */
  initializeColorEffects(color: string): void {
    if (!this.effectParameters.has(color)) {
      // Create fresh effect parameters for this color
      const colorEffects: ColorEffects = {};
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
  updateParameter(effectType: string, parameter: string, value: number, color: string): void {
    recordCoordinatorDebug('log', `🎛️ [COORDINATOR DEBUG] updateParameter called:`, { effectType, parameter, value, color });

    if (!color) {
      logger.warn('EffectsCoordinator', 'Cannot update parameter: no color provided', { effectType, parameter, value }, 'effects');
      return;
    }

    // Ensure color effects are initialized
    this.initializeColorEffects(color);

    const colorEffects = this.effectParameters.get(color)!;
    const targetEffect = this.ensureEffect(colorEffects, effectType);

    // Update the parameter
    const oldValue = targetEffect[parameter];
    targetEffect[parameter] = value;

    recordCoordinatorDebug('log', `🎛️ [COORDINATOR DEBUG] Parameter updated: ${effectType}.${parameter} from ${oldValue} to ${value} for ${color}`);

    // Distribute to consumers with separate events
    this.notifyAudioEngine(effectType, parameter, value, color, targetEffect);
    this.notifyAnimationEngine(effectType, parameter, value, color, targetEffect);

    // Also update the timbre state for persistence (but don't use it as source of truth)
    this.updateTimbreState(effectType, targetEffect, color);
  }

  /**
     * Notify the audio engine of effect changes
     */
  notifyAudioEngine(effectType: string, parameter: string, value: number, color: string, fullEffectParams: EffectParams): void {
    recordCoordinatorDebug('log', `🎛️ [COORDINATOR DEBUG] Notifying audio engine:`, { effectType, parameter, value, color, fullEffectParams });

    store.emit('audioEffectChanged', {
      effectType,
      parameter,
      value,
      color,
      effectParams: { ...fullEffectParams } // Send full effect parameters
    });

    recordCoordinatorDebug('log', `🎛️ [COORDINATOR DEBUG] audioEffectChanged event emitted for ${effectType}.${parameter} = ${value} for ${color}`);
    logger.debug('EffectsCoordinator', `Notified audio engine: ${effectType}.${parameter} = ${value} for ${color}`, null, 'effects');
  }

  /**
     * Notify the animation engine of effect changes
     */
  notifyAnimationEngine(effectType: string, parameter: string, value: number, color: string, fullEffectParams: EffectParams): void {
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
  updateTimbreState(effectType: string, effectParams: EffectParams, color: string): void {
    const timbre = store.state.timbres[color];
    if (!timbre) {return;}

    // Map effect types to timbre property names
    const timbrePropertyMap: Record<string, string> = {
      vibrato: 'vibrato',
      tremolo: 'tremelo' // Note: keeping the existing misspelling for compatibility
    };

    const timbreProperty = timbrePropertyMap[effectType];
    if (timbreProperty) {
      // Ensure the timbre property exists
      const timbreEffects = timbre as unknown as Record<string, EffectParams | undefined>;
      if (!timbreEffects[timbreProperty]) {
        timbreEffects[timbreProperty] = {};
      }

      // Update timbre state to match coordinator state
      Object.assign(timbreEffects[timbreProperty], effectParams);

      // Record state change for persistence
      store.recordState();
    }
  }

  /**
     * Get effect parameters for a specific color and effect type
     */
  getEffectParameters(color: string, effectType: string): EffectParams {
    const colorEffects = this.effectParameters.get(color);

    const effect = colorEffects?.[effectType];
    if (!effect) {
      return this.cloneDefault(effectType);
    }

    return { ...effect };
  }

  /**
     * Get all effect parameters for a specific color
     */
  getAllEffectParameters(color: string): ColorEffects {
    const colorEffects = this.effectParameters.get(color);
    if (!colorEffects) {
      const defaults: ColorEffects = {};
      Object.entries(this.defaultEffects).forEach(([key, params]) => {
        defaults[key] = { ...params };
      });
      return defaults;
    }
    const clone: ColorEffects = {};
    Object.entries(colorEffects).forEach(([key, params]) => {
      clone[key] = params ? { ...params } : undefined;
    });
    return clone;
  }

  /**
     * Reset all effects for a color to defaults
     */
  resetColorEffects(color: string): void {
    const colorEffects: ColorEffects = {};
    Object.entries(this.defaultEffects).forEach(([effectType, defaultParams]) => {
      colorEffects[effectType] = { ...defaultParams };
    });

    this.effectParameters.set(color, colorEffects);

    // Notify all systems of the reset
    Object.keys(colorEffects).forEach(effectType => {
      const params = colorEffects[effectType];
      if (!params) {return;}
      Object.keys(params).forEach(parameter => {
        const value = params[parameter];
        if (value === undefined) {return;}
        this.notifyAudioEngine(effectType, parameter, value, color, params);
        this.notifyAnimationEngine(effectType, parameter, value, color, params);
      });
    });

    logger.info('EffectsCoordinator', `Reset all effects for color ${color}`, colorEffects, 'effects');
  }

  /**
     * Cleanup
     */
  dispose(): void {
    this.effectParameters.clear();
    logger.info('EffectsCoordinator', 'Disposed', null, 'effects');
  }
}

// Create and export singleton
const effectsCoordinator = new EffectsCoordinator();

export function getEffectsCoordinatorDebugMessages(): DebugMessage[] {
  return effectsCoordinatorDebug.slice();
}

export default effectsCoordinator;
