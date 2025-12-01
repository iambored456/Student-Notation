// js/services/timbreEffects/effectsAnimation/vibratoCanvasEffect.ts
import BaseAnimationEffect from './baseAnimationEffect.ts';
import logger from '@utils/logger.ts';

logger.moduleLoaded('VibratoCanvasEffect');

interface VibratoEffectParams {
  speed: number;
  span: number;
}

interface VibratoAnimationState {
  frequency: number;
  amplitude: number;
  phase: number;
  lastUpdate: number;
}

/**
 * Vibrato Canvas Effect
 * Handles vibrato visual animations (pitch/position modulation on canvas)
 * Extends BaseAnimationEffect to eliminate code duplication
 */
class VibratoCanvasEffect extends BaseAnimationEffect<VibratoAnimationState, VibratoEffectParams> {
  constructor() {
    super('Vibrato');

    logger.info('VibratoCanvasEffect', 'Initialized for canvas note positions', null, 'animation');
  }

  /**
     * Initialize the vibrato canvas effect
     */
  init(): boolean {
    this.initBase(); // Initialize shared functionality

    logger.info('VibratoCanvasEffect', 'Ready for canvas animation', null, 'animation');
    return true;
  }

  /**
     * Update vibrato animation parameters
     */
  updateAnimationParameters(color: string, effectParams: VibratoEffectParams): void {
    const { speed, span } = effectParams;

    if (speed === 0 || span === 0) {
      // Disable vibrato for this color
      this.animations.delete(color);
      logger.debug('VibratoCanvasEffect', `Disabled vibrato animation for ${color}`, null, 'animation');
    } else {
      // Get existing animation to preserve phase (prevent restart jitter)
      const existingAnimation = this.animations.get(color);

      // Create/update vibrato animation
      const frequencyHz = (speed / 100) * 16; // Convert 0-100% to 0-16 Hz
      const amplitudeSemitones = (span / 100) * 0.5; // Convert 0-100% to 0-0.5 semitone

      const animationData: VibratoAnimationState = {
        frequency: frequencyHz,
        amplitude: amplitudeSemitones,
        phase: existingAnimation?.phase || 0, // Start at 0 to match audio LFO phase
        lastUpdate: performance.now()
      };

      this.animations.set(color, animationData);

      logger.debug('VibratoCanvasEffect', `Updated vibrato animation for ${color}`, {
        frequency: frequencyHz,
        amplitude: amplitudeSemitones,
        preservedPhase: !!existingAnimation
      }, 'animation');
    }
  }

  /**
     * Update vibrato animation phases
     */
  updateAnimationPhases(currentTime: number): void {
    this.animations.forEach((animation) => {
      const deltaTime = (currentTime - animation.lastUpdate) / 1000; // Convert to seconds
      animation.phase += animation.frequency * deltaTime * 2 * Math.PI; // 2pi for full cycle
      animation.lastUpdate = currentTime;

      // Keep phase in reasonable range to prevent floating point overflow
      if (animation.phase > 4 * Math.PI) {
        animation.phase -= 4 * Math.PI;
      }
    });
  }

  /**
     * Get the current Y offset for a note based on vibrato animation
     */
  getVibratoYOffset(color?: string): number {
    if (!color) {
      return 0;
    }

    const animation = this.animations.get(color);
    if (!animation) {
      return 0;
    }

    // Check if animation should be running - if not, return static value
    if (window.animationEffectsManager && !window.animationEffectsManager.shouldVibratoBeRunning()) {
      return 0; // Animation stopped - return to static position
    }

    // Calculate sine wave offset
    // Negate to flip direction: positive offset should move pitch UP (visual UP on screen)
    const sineValue = Math.sin(animation.phase);
    const offset = -sineValue * animation.amplitude;
    logger.debug('VibratoCanvasEffect', 'Visual vibrato', { sine: sineValue.toFixed(3), offset: offset.toFixed(3), phase: animation.phase.toFixed(3) }, 'effects');
    return offset; // Returns offset in abstract units (semitones)
  }

  /**
     * Override shouldBeRunning - vibrato should only animate during active sound production
     */
  override shouldBeRunning(): boolean {
    const hasAnimations = this.animations.size > 0;
    if (!hasAnimations) {return false;}

    // Vibrato should ONLY run during active sound production (not continuously)
    const hasRelevantDisplays = (
      this.isPlaybackActive ||                    // During transport playback AND spacebar
            this.hasActiveInteraction ||                // During note interactions (placing/holding)
            this.hasDialInteraction ||                  // During dial dragging (NEW!)
            (this.ghostNoteAnimation !== null && this.isPlaybackActive) // Ghost note + spacebar only
            // NOTE: No continuous animation - vibrato only during active sound production
    );


    return hasRelevantDisplays;
  }

  /**
     * Check if we should animate notes of a given color (vibrato)
     */
  override shouldAnimateColor(color: string): boolean {
    const animation = this.animations.get(color);
    if (!animation) {return false;}

    // Vibrato should animate when speed > 0 and span > 0
    return animation.frequency > 0 && animation.amplitude > 0;
  }

  /**
     * Cleanup
     */
  dispose(): void {
    this.disposeBase();
    logger.info('VibratoCanvasEffect', 'Disposed', null, 'animation');
  }
}

export default VibratoCanvasEffect;
