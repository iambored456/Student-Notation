// js/services/timbreEffects/effectsAnimation/animationEffectsManager.js
import store from '../../../state/index.js';
import logger from '../../../utils/logger.js';
import VibratoCanvasEffect from './vibratoCanvasEffect.js';
import TremoloWaveformEffect from './tremoloWaveformEffect.js';

logger.moduleLoaded('AnimationEffectsManager');

/**
 * Animation Effects Manager
 * Coordinates all visual effects with a SINGLE animation loop
 * Eliminates multiple competing animation loops
 * 
 * Data Flow:
 * EffectsCoordinator → AnimationEffectsManager → Specific Animation Effects → Canvas/Waveform Updates
 */
class AnimationEffectsManager {
    constructor() {
        // Initialize specific animation effect handlers
        this.vibratoEffect = new VibratoCanvasEffect();
        this.tremoloEffect = new TremoloWaveformEffect();
        
        // Single animation loop for all effects (eliminates conflicts)
        this.isRunning = false;
        this.animationFrameId = null;
        this.lastTime = 0;
        this.lastRenderTrigger = 0;
        
        logger.info('AnimationEffectsManager', 'Initialized with single animation loop', null, 'animation');
    }

    /**
     * Initialize the animation effects manager
     */
    init() {
        // Initialize individual effect handlers
        this.vibratoEffect.init();
        this.tremoloEffect.init();

        // Listen for visual effect changes from main coordinator
        // Note: Individual effects also listen, but we coordinate the main loop here
        store.on('visualEffectChanged', ({ effectType, parameter, value, color }) => {
            if (effectType === 'vibrato' || effectType === 'tremolo') {
                // Effect parameters changed - update animation state
                setTimeout(() => this.updateAnimationState(), 0); // Defer to avoid timing issues
                
                // For tremolo, immediately trigger amplitude updates for waveform/ADSR
                // regardless of animation timing - tremolo affects static displays too
                if (effectType === 'tremolo') {
                    setTimeout(() => this.triggerTremoloAmplitudeUpdate(), 0);
                }
            }
        });

        logger.info('AnimationEffectsManager', 'Event subscriptions established', null, 'animation');
        return true;
    }

    /**
     * Main animation loop - handles ALL visual effects
     */
    animate(currentTime) {
        if (!this.isRunning) {
            return;
        }
        
        this.lastTime = currentTime;
        
        
        // Update all effect animations
        this.vibratoEffect.updateAnimationPhases(currentTime);
        this.tremoloEffect.updateAnimationPhases(currentTime);
        
        // Trigger visual updates with throttling
        this.triggerVisualUpdates(currentTime);
        
        // Request next frame
        this.animationFrameId = requestAnimationFrame((time) => this.animate(time));
    }

    /**
     * Start the single animation loop
     */
    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.lastTime = performance.now();
        this.animationFrameId = requestAnimationFrame((time) => this.animate(time));

        logger.debug('AnimationEffectsManager', 'Single animation loop started', null, 'animation');
    }

    /**
     * Stop the animation loop
     */
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Trigger final updates to reset positions
        this.triggerFinalUpdates();
        
        logger.debug('AnimationEffectsManager', 'Animation loop stopped', null, 'animation');
    }

    /**
     * Effect-specific shouldBeRunning methods
     * Each effect has its own trigger conditions
     */
    shouldTremoloBeRunning() {
        const hasAnimations = this.tremoloEffect.animations.size > 0;
        if (!hasAnimations) {
            return false;
        }

        // Tremolo should run when:
        // 1. There are active sounding notes (playback/spacebar), OR
        // 2. User is interacting with tremolo dial controls
        // The activeSoundingNotes Map properly tracks note attack/release events
        const hasSoundingNotes = this.tremoloEffect.activeSoundingNotes.size > 0;
        const hasDialInteraction = this.tremoloEffect.hasDialInteraction;

        const shouldRun = hasSoundingNotes || hasDialInteraction;
        return shouldRun;
    }

    shouldVibratoBeRunning() {
        const hasAnimations = this.vibratoEffect.animations.size > 0;
        if (!hasAnimations) return false;

        // Vibrato should only run during active interactions and playback
        const hasRelevantDisplays = (
            this.vibratoEffect.isPlaybackActive ||
            this.vibratoEffect.hasActiveInteraction ||
            this.vibratoEffect.hasDialInteraction ||       // Dial dragging (NEW!)
            this.vibratoEffect.ghostNoteAnimation !== null
        );

        return hasRelevantDisplays;
    }

    /**
     * Update animation state - start/stop loop as needed
     */
    updateAnimationState() {
        const vibratoShouldRun = this.shouldVibratoBeRunning();
        const tremoloShouldRun = this.shouldTremoloBeRunning();
        const shouldAnimate = vibratoShouldRun || tremoloShouldRun;

        if (shouldAnimate && !this.isRunning) {
            this.start();
        } else if (!shouldAnimate && this.isRunning) {
            this.stop();
        }
    }

    /**
     * Trigger visual updates with throttling (60 FPS max)
     */
    triggerVisualUpdates(currentTime) {
        // Throttle updates to avoid performance issues
        if (!this.lastRenderTrigger || currentTime - this.lastRenderTrigger >= 16.67) {
            this.lastRenderTrigger = currentTime;

            // Get active colors from both effects
            const activeVibratoColors = this.vibratoEffect.getActiveColors();
            const activeTremoloColors = this.tremoloEffect.getActiveColors();

            // Emit canvas updates for vibrato (note positions)
            if (activeVibratoColors.length > 0) {
                store.emit('animationUpdate', {
                    type: 'vibrato',
                    activeColors: activeVibratoColors
                });
            }

            // Emit waveform/ADSR updates for tremolo (amplitude)
            if (activeTremoloColors.length > 0) {
                store.emit('tremoloAmplitudeUpdate', {
                    activeColors: activeTremoloColors
                });
            }
        }
    }

    /**
     * Trigger final updates when stopping animation
     */
    triggerFinalUpdates() {
        // Reset vibrato note positions - get ALL colors with animations, not just active ones
        const vibratoColors = Array.from(this.vibratoEffect.animations.keys());
        if (vibratoColors.length > 0) {
            store.emit('animationUpdate', {
                type: 'vibrato',
                activeColors: vibratoColors
            });
        }

        // Reset tremolo amplitude (return ADSR/waveform to original values)
        const tremoloColors = Array.from(this.tremoloEffect.animations.keys());
        if (tremoloColors.length > 0) {
            store.emit('tremoloAmplitudeUpdate', {
                activeColors: tremoloColors
            });
        }
    }

    /**
     * Check if a specific note should be animated (for canvas rendering)
     */
    shouldAnimateNote(note) {
        // For canvas rendering: only vibrato affects note positions
        return this.vibratoEffect.shouldAnimateNote(note);
    }

    /**
     * Delegation methods for backward compatibility
     */
    getVibratoYOffset(color) {
        return this.vibratoEffect.getVibratoYOffset(color);
    }

    getTremoloAmplitudeMultiplier(color) {
        return this.tremoloEffect.getTremoloAmplitudeMultiplier(color);
    }

    getADSRTremoloAmplitudeMultiplier(color) {
        return this.tremoloEffect.getADSRTremoloAmplitudeMultiplier(color);
    }

    /**
     * Trigger tremolo amplitude updates for waveform/ADSR displays
     * This is called immediately when tremolo parameters change, regardless of animation timing
     */
    triggerTremoloAmplitudeUpdate() {
        const activeTremoloColors = this.tremoloEffect.getActiveColors();
        
        if (activeTremoloColors.length > 0) {
            store.emit('tremoloAmplitudeUpdate', {
                activeColors: activeTremoloColors
            });
        }
    }

    /**
     * Get all active colors across all effects
     */
    getAllActiveColors() {
        const vibratoColors = this.vibratoEffect.getActiveColors();
        const tremoloColors = this.tremoloEffect.getActiveColors();
        return [...new Set([...vibratoColors, ...tremoloColors])];
    }

    /**
     * Cleanup
     */
    dispose() {
        this.stop();
        this.vibratoEffect.dispose();
        this.tremoloEffect.dispose();
        logger.info('AnimationEffectsManager', 'Disposed', null, 'animation');
    }
}

// Create and export singleton
const animationEffectsManager = new AnimationEffectsManager();
export default animationEffectsManager;