// js/services/timbreEffects/effectsAnimation/tremoloWaveformEffect.js
import BaseAnimationEffect from './baseAnimationEffect.js';
import logger from '../../../utils/logger.js';

logger.moduleLoaded('TremoloWaveformEffect');

/**
 * Tremolo Waveform Effect
 * Handles tremolo visual animations for:
 * - Dynamic waveform visualization (during playback only)
 * - ADSR Attack and Sustain nodes (amplitude-based nodes)
 * 
 * Tremolo Behavior:
 * - Speed: 0-100% → 0-16 Hz oscillation frequency
 * - Span: 0-100% → amplitude reduction from full (1.0) to zero (0.0)
 * - Triggers: Only during spacebar, note placement, transport playback
 * - Independent per color with synchronized start
 * 
 * NOTE: Does NOT affect static waveforms or canvas note positions
 */
class TremoloWaveformEffect extends BaseAnimationEffect {
    constructor() {
        super('Tremolo');
        
        logger.info('TremoloWaveformEffect', 'Initialized for waveform/ADSR amplitude', null, 'animation');
    }

    /**
     * Initialize the tremolo waveform effect
     */
    init() {
        this.initBase(); // Initialize shared functionality
        
        logger.info('TremoloWaveformEffect', 'Ready for waveform/ADSR animation', null, 'animation');
        return true;
    }

    /**
     * Update tremolo animation parameters
     */
    updateAnimationParameters(color, effectParams) {
        const { speed, span } = effectParams;

        if (speed === 0 || span === 0) {
            // Disable tremolo for this color
            this.animations.delete(color);
            logger.debug('TremoloWaveformEffect', `Disabled tremolo animation for ${color}`, null, 'animation');
        } else {
            // Get existing animation to preserve phase (prevent restart jitter)
            const existingAnimation = this.animations.get(color);

            // Create/update tremolo animation
            const frequencyHz = (speed / 100) * 16; // Convert 0-100% to 0-16 Hz
            const amplitudeSpan = span / 100; // Convert 0-100% to 0-1 span

            const animationData = {
                frequency: frequencyHz,
                span: amplitudeSpan,
                phase: existingAnimation?.phase || 0, // Preserve existing phase to avoid restart jitter
                lastUpdate: (window.Tone?.now ? window.Tone.now() * 1000 : performance.now()) // Use Tone.js audio clock for sync
            };

            this.animations.set(color, animationData);

            logger.debug('TremoloWaveformEffect', `Updated tremolo animation for ${color}`, {
                frequency: frequencyHz,
                span: amplitudeSpan,
                preservedPhase: !!existingAnimation
            }, 'animation');
        }
    }

    /**
     * Update tremolo animation phases
     */
    updateAnimationPhases(currentTime) {
        let updatedCount = 0;
        const toneTime = (window.Tone?.now ? window.Tone.now() * 1000 : currentTime); // Use Tone.js time for audio sync
        
        this.animations.forEach((animation, color) => {
            const deltaTime = (toneTime - animation.lastUpdate) / 1000; // Convert to seconds
            const oldPhase = animation.phase;
            animation.phase += animation.frequency * deltaTime * 2 * Math.PI; // 2π for full cycle
            animation.lastUpdate = toneTime;
            updatedCount++;
            
            // Debug phase advancement
            if (Math.abs(animation.phase - oldPhase) < 0.001) {
                logger.warn('TremoloWaveformEffect', `Phase not advancing for ${color}`, {
                    deltaSeconds: Number(deltaTime.toFixed(4)),
                    frequency: animation.frequency
                }, 'animation');
            }
            
            // Keep phase in reasonable range to prevent floating point overflow
            if (animation.phase > 4 * Math.PI) {
                animation.phase -= 4 * Math.PI;
            }
        });
        
        // Debug animation loop activity
        if (updatedCount > 0 && Math.random() < 0.05) { // Log occasionally
            const timingSource = window.Tone?.now ? 'Tone.js' : 'performance';
            logger.debug('TremoloWaveformEffect', 'Timing sample', {
                hasTone: !!window.Tone,
                hasToneNow: !!window.Tone?.now,
                toneTime,
                currentTime,
                timingSource
            }, 'animation');
        }
    }

    /**
     * Get the current amplitude multiplier for a note based on tremolo animation
     *
     * Tremolo oscillates amplitude reduction:
     * - Span = 0% → No reduction (multiplier stays at 1.0)
     * - Span = 100% → Full reduction (multiplier oscillates 1.0 to 0.0)
     * - The oscillation range is proportional to span
     *
     * Example: Span = 50%
     * - Center = 0.75 (midpoint between 1.0 and 0.5)
     * - Range = 0.25 (half of the reduction)
     * - Oscillation = 0.75 ± 0.25 = 0.5 to 1.0
     */
    getTremoloAmplitudeMultiplier(color) {
        const animation = this.animations.get(color);
        if (!animation) {
            return 1.0; // No tremolo - use original amplitude
        }

        // Check if animation should be running - if not, return static value
        if (window.animationEffectsManager && !window.animationEffectsManager.shouldTremoloBeRunning()) {
            return 1.0; // Animation stopped - return to static value
        }

        // Get original waveform amplitude (the pre-tremolo reference)
        const originalAmplitude = window.staticWaveformVisualizer?.calculatedAmplitude || 1.0;

        // Calculate tremolo effect with corrected span direction
        const oscillation = Math.sin(animation.phase); // -1 to +1
        const depthPercentage = animation.span; // 0 to 1 (from 0-100% parameter)

        // Tremolo amplitude calculation (fixed direction):
        // maxima = originalAmplitude (full amplitude)
        // minima = originalAmplitude × (1 - depthPercentage) (reduced by span)
        // centroid = (maxima + minima) / 2
        const maxima = originalAmplitude;
        const minima = originalAmplitude * (1.0 - depthPercentage); // Fixed: span reduces amplitude
        const centroid = (maxima + minima) / 2;
        const oscillationRange = (maxima - minima) / 2;

        // Current oscillated amplitude: centroid ± oscillationRange
        const currentAmplitude = centroid + (oscillation * oscillationRange);

        // Return multiplier relative to original amplitude
        const multiplier = currentAmplitude / originalAmplitude;
        
        // Only log tremolo issues when phase is actually stuck (not advancing)
        // Note: Don't check oscillation value since sin() naturally crosses zero
        const currentTime = window.Tone?.now() * 1000 || performance.now();
        const timeSinceUpdate = currentTime - animation.lastUpdate;
        if (timeSinceUpdate > 100 && animation.span > 0) { // Only warn if no updates for 100ms+
            // Check if phase advancement is too small relative to expected frequency
            const expectedAdvancement = animation.frequency * (timeSinceUpdate / 1000) * 2 * Math.PI;
            if (expectedAdvancement > 0.1) { // Should have advanced significantly
                logger.warn('TremoloWaveformEffect', `Phase stagnation detected for ${color}`, {
                    phase: Number(animation.phase.toFixed(3)),
                    millisecondsSinceUpdate: Number(timeSinceUpdate.toFixed(1)),
                    expectedAdvancement: Number(expectedAdvancement.toFixed(3))
                }, 'animation');
            }
        }
        
        // Ensure within bounds [0, 1]
        return Math.max(0.0, Math.min(1.0, multiplier));
    }

    /**
     * Get amplitude multiplier for ADSR visualization (same as regular tremolo)
     */
    getADSRTremoloAmplitudeMultiplier(color) {
        return this.getTremoloAmplitudeMultiplier(color);
    }


    /**
     * Check if we should animate notes of a given color (tremolo)
     */
    shouldAnimateColor(color) {
        const animation = this.animations.get(color);
        
        if (!animation) return false;
        
        // Tremolo should animate when speed > 0 and span > 0
        const shouldAnimate = animation.frequency > 0 && animation.span > 0;
        
        return shouldAnimate;
    }

    /**
     * Cleanup
     */
    dispose() {
        this.disposeBase();
        logger.info('TremoloWaveformEffect', 'Disposed', null, 'animation');
    }
}

export default TremoloWaveformEffect;
