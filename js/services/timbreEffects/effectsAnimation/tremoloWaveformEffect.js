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
            // Create/update tremolo animation
            const frequencyHz = (speed / 100) * 16; // Convert 0-100% to 0-16 Hz
            const amplitudeSpan = span / 100; // Convert 0-100% to 0-1 span
            
            const animationData = {
                frequency: frequencyHz,
                span: amplitudeSpan,
                phase: 0, // Start at 0 degrees
                lastUpdate: (window.Tone?.now ? window.Tone.now() * 1000 : performance.now()) // Use Tone.js audio clock for sync
            };
            
            this.animations.set(color, animationData);
            
            logger.debug('TremoloWaveformEffect', `Updated tremolo animation for ${color}`, {
                frequency: frequencyHz,
                span: amplitudeSpan
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
                console.log(`⚠️ TREMOLO PHASE NOT ADVANCING ${color}: delta=${deltaTime.toFixed(4)}s, freq=${animation.frequency}Hz`);
            }
            
            // Keep phase in reasonable range to prevent floating point overflow
            if (animation.phase > 4 * Math.PI) {
                animation.phase -= 4 * Math.PI;
            }
        });
        
        // Debug animation loop activity
        if (updatedCount > 0 && Math.random() < 0.05) { // Log occasionally
            const timingSource = window.Tone?.now ? 'Tone.js' : 'performance';
            console.log(`🔍 TREMOLO timing debug: window.Tone=${!!window.Tone}, window.Tone.now=${!!window.Tone?.now}, toneTime=${toneTime}, currentTime=${currentTime}`);
        }
    }

    /**
     * Get the current amplitude multiplier for a note based on tremolo animation
     * 
     * Tremolo oscillates around the center point between original amplitude and zero:
     * - Original amplitude = 100% reference point
     * - Zero = 0% reference point  
     * - Center = (original + 0) / 2
     * - Span defines the oscillation range around that center
     * 
     * Example: Original amplitude = 0.7, Span = 20%
     * - Center = 0.35
     * - Range = 0.7 * 0.2 = 0.14
     * - Oscillation = 0.35 ± 0.07 = 0.28 to 0.42
     * - Multiplier = oscillation / original = 0.4 to 0.6
     */
    getTremoloAmplitudeMultiplier(color) {
        const animation = this.animations.get(color);
        if (!animation) {
            return 1.0; // No tremolo - use original amplitude
        }
        
        
        // Get original waveform amplitude (the pre-tremolo reference)
        const originalAmplitude = window.staticWaveformVisualizer?.calculatedAmplitude || 1.0;
        
        // Calculate tremolo effect using correct amplitude formula
        const oscillation = Math.sin(animation.phase); // -1 to +1
        const depthPercentage = animation.span; // 0 to 1 (from 0-100% parameter)
        
        // Tremolo amplitude calculation:
        // maxima = originalAmplitude
        // minima = originalAmplitude × depthPercentage
        // centroid = minima + ((maxima - minima) / 2)
        const maxima = originalAmplitude;
        const minima = originalAmplitude * depthPercentage;
        const centroid = minima + ((maxima - minima) / 2);
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
                console.log(`⚠️ TREMOLO PHASE STUCK ${color}: phase=${animation.phase.toFixed(3)}, lastUpdate=${timeSinceUpdate.toFixed(1)}ms ago, expected advancement=${expectedAdvancement.toFixed(3)}`);
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