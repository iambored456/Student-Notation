// js/services/timbreEffects/effectsAnimation/reverbADSREffect.ts
import BaseAnimationEffect from './baseAnimationEffect.ts';
import logger from '@utils/logger.ts';

logger.moduleLoaded('ReverbADSREffect');

interface ReverbEffectParams {
  decay: number;
  roomSize: number;
}

interface ReverbAnimationState {
  decayFactor: number;
  sizeFactor: number;
  lastUpdate: number;
}

/**
 * Reverb ADSR Effect (PLACEHOLDER)
 * Handles reverb visual animations (envelope/decay visual feedback)
 * TODO: Implement actual reverb visualization - currently placeholder
 * Extends BaseAnimationEffect to eliminate code duplication
 */
class ReverbADSREffect extends BaseAnimationEffect<ReverbAnimationState, ReverbEffectParams> {
  constructor() {
    super('Reverb');

    logger.info('ReverbADSREffect', 'Initialized for reverb visualization (PLACEHOLDER)', null, 'animation');
  }

  /**
     * Initialize the reverb ADSR effect
     */
  init(): boolean {
    this.initBase(); // Initialize shared functionality

    logger.info('ReverbADSREffect', 'Ready for reverb animation (PLACEHOLDER)', null, 'animation');
    return true;
  }

  /**
     * Update reverb animation parameters
     */
  updateAnimationParameters(color: string, effectParams: ReverbEffectParams): void {
    const { decay, roomSize } = effectParams;

    if (decay === 0 && roomSize === 0) {
      // Disable reverb for this color
      this.animations.delete(color);
      logger.debug('ReverbADSREffect', `Disabled reverb animation for ${color}`, null, 'animation');
    } else {
      // TODO: Create/update reverb animation parameters
      // This could involve:
      // - Decay time visualization (longer tails)
      // - Room size affecting visual spread/blur
      // - Echo/reflection visual feedback

      const decayFactor = decay / 100; // 0-100% to 0-1
      const sizeFactor = roomSize / 100; // 0-100% to 0-1

      const animationData: ReverbAnimationState = {
        decayFactor,
        sizeFactor,
        lastUpdate: performance.now()
      };

      this.animations.set(color, animationData);

      logger.debug('ReverbADSREffect', `Updated reverb animation for ${color} (PLACEHOLDER)`, {
        decayFactor,
        sizeFactor
      }, 'animation');
    }
  }

  /**
     * Update reverb animation phases
     */
  updateAnimationPhases(currentTime: number): void {
    this.animations.forEach((animation) => {
      // TODO: Implement reverb animation phase updates
      // This could involve:
      // - Tracking decay envelope phases
      // - Managing multiple reflection/echo phases
      // - Room size affecting animation timing

      animation.lastUpdate = currentTime;
    });
  }

  /**
     * Get the current reverb visual effect for a note
     * TODO: Implement actual reverb visualization
     */
  getReverbEffect(color: string): { opacity: number; blur: number; spread: number } {
    const animation = this.animations.get(color);
    if (!animation) {
      return {
        opacity: 1,
        blur: 0,
        spread: 0
      };
    }

    // TODO: Calculate reverb visual effects based on parameters
    return {
      opacity: 1 - (animation.decayFactor * 0.2), // Slight opacity reduction for large rooms
      blur: animation.sizeFactor * 2, // Room size affects blur
      spread: animation.decayFactor * 3 // Decay affects spread
    };
  }

  /**
     * Override shouldBeRunning - reverb should animate during and after sound production
     */
  shouldBeRunning(): boolean {
    const hasAnimations = this.animations.size > 0;
    if (!hasAnimations) {return false;}

    // TODO: Reverb should run during AND after sound production (tail effect)
    // This is different from vibrato which only runs during active sound
    const hasRelevantDisplays = (
      this.isPlaybackActive ||                    // During transport playback
            this.hasActiveInteraction ||                // During note interactions
            (this.ghostNoteAnimation !== null)          // Ghost note (with possible tail)
    );

    return hasRelevantDisplays;
  }

  /**
     * Check if we should animate notes of a given color (reverb)
     */
  shouldAnimateColor(color: string): boolean {
    const animation = this.animations.get(color);
    if (!animation) {return false;}

    // Reverb should animate when decay > 0 OR roomSize > 0
    return animation.decayFactor > 0 || animation.sizeFactor > 0;
  }

  /**
     * Cleanup
     */
  dispose(): void {
    this.disposeBase();
    logger.info('ReverbADSREffect', 'Disposed', null, 'animation');
  }
}

export default ReverbADSREffect;

