// js/services/timbreEffects/effectsAnimation/baseAnimationEffect.js
import store from '../../../state/index.js';
import logger from '../../../utils/logger.js';

/**
 * Base Animation Effect
 * Shared functionality for all visual effects (vibrato, tremolo, etc.)
 * Eliminates code duplication between different effect types
 */
class BaseAnimationEffect {
    constructor(effectName) {
        this.effectName = effectName;
        this.animations = new Map(); // color -> animation state
        this.activeNoteAnimations = new Map(); // noteId -> color (for active interactions)
        this.ghostNoteAnimation = null; // Special handling for ghost note
        this.activeSoundingNotes = new Map(); // noteId -> color (for currently playing notes)

        // Playback state tracking
        this.isPlaybackActive = false;
        this.hasActiveInteraction = false;
        this.hasDialInteraction = false; // Track dial drag interactions

        logger.info(`${effectName}AnimationEffect`, 'Base initialized', null, 'animation');
    }

    /**
     * Initialize base animation effect
     * Should be called by subclasses
     */
    initBase() {
        // Subscribe to visual effect changes from main coordinator
        store.on('visualEffectChanged', ({ effectType, parameter, value, color, effectParams }) => {
            if (effectType === this.effectName.toLowerCase()) {
                this.updateAnimationParameters(color, effectParams);
            }
        });
        
        // Subscribe to playback events
        store.on('playbackStarted', () => {
            this.isPlaybackActive = true;
            
            // Trigger animation manager to update state when playback starts
            if (window.animationEffectsManager && window.animationEffectsManager.updateAnimationState) {
                window.animationEffectsManager.updateAnimationState();
            }
        });
        
        store.on('playbackStopped', () => {
            this.isPlaybackActive = false;
            this.activeNoteAnimations.clear();
            this.activeSoundingNotes.clear();
            
            // Trigger animation manager to update state when playback stops
            if (window.animationEffectsManager && window.animationEffectsManager.updateAnimationState) {
                window.animationEffectsManager.updateAnimationState();
            }
        });
        
        // Subscribe to note interactions
        store.on('noteInteractionStart', ({ noteId, color }) => this.onNoteInteractionStart(noteId, color));
        store.on('noteInteractionEnd', ({ noteId }) => this.onNoteInteractionEnd(noteId));
        
        // Subscribe to ghost note changes (for spacebar preview)
        store.on('ghostNoteUpdated', ({ color }) => this.onGhostNoteUpdated(color));
        store.on('ghostNoteCleared', () => this.onGhostNoteCleared());
        
        // Subscribe to spacebar playback events
        store.on('spacebarPlayback', ({ color, isPlaying }) => {
            if (isPlaying) {
                this.isPlaybackActive = true;
            } else {
                this.isPlaybackActive = false;
            }
            
            // Trigger animation manager to update state when playback changes
            if (window.animationEffectsManager && window.animationEffectsManager.updateAnimationState) {
                window.animationEffectsManager.updateAnimationState();
            }
        });
        
        // Subscribe to note attack/release events from transport service
        store.on('noteAttack', ({ noteId, color }) => this.onNoteAttack(noteId, color));
        store.on('noteRelease', ({ noteId, color }) => this.onNoteRelease(noteId, color));

        // Subscribe to dial interaction events (for visual preview during dial dragging)
        store.on('effectDialInteractionStart', ({ effectType, color }) => {
            if (effectType === this.effectName.toLowerCase()) {
                this.onDialInteractionStart(color);
            }
        });
        store.on('effectDialInteractionEnd', ({ effectType, color }) => {
            if (effectType === this.effectName.toLowerCase()) {
                this.onDialInteractionEnd(color);
            }
        });

        logger.info(`${this.effectName}AnimationEffect`, 'Base event subscriptions established', null, 'animation');
    }

    /**
     * Update animation parameters - to be implemented by subclasses
     */
    updateAnimationParameters(color, effectParams) {
        throw new Error('updateAnimationParameters must be implemented by subclass');
    }

    /**
     * Update animation phases - to be implemented by subclasses
     */
    updateAnimationPhases(currentTime) {
        throw new Error('updateAnimationPhases must be implemented by subclass');
    }

    /**
     * Check if we should animate notes of a given color
     */
    shouldAnimateColor(color) {
        const animation = this.animations.get(color);
        if (!animation) return false;
        
        // Subclasses should override this for specific logic
        return true;
    }

    /**
     * Check if a specific note should be animated
     */
    shouldAnimateNote(note) {
        const shouldAnimateColor = this.shouldAnimateColor(note.color);
        if (!shouldAnimateColor) {
            return false;
        }

        // During dial interaction, animate ALL notes of the active color (preview mode)
        if (this.hasDialInteraction && this.activeNoteAnimations.has('dial-preview')) {
            const dialPreviewColor = this.activeNoteAnimations.get('dial-preview');
            if (note.color === dialPreviewColor) {
                return true;
            }
        }

        // During playback, only animate notes that are actively sounding
        if (this.isPlaybackActive && note.uuid && this.activeSoundingNotes.has(note.uuid)) {
            return true;
        }

        // During interaction, only animate active notes
        if (this.hasActiveInteraction && note.uuid && this.activeNoteAnimations.has(note.uuid)) {
            return true;
        }

        // Ghost note animation - only during playback
        if (!note.uuid && this.ghostNoteAnimation && this.ghostNoteAnimation.color === note.color && this.isPlaybackActive) {
            return true;
        }

        return false;
    }

    /**
     * Check if animation should be running for this effect
     */
    shouldBeRunning() {
        // Only run if we have animations AND when there are visual displays that need updates
        const hasAnimations = this.animations.size > 0;
        if (!hasAnimations) return false;

        const hasRelevantDisplays = (
            this.isPlaybackActive ||                    // During playback
            this.hasActiveInteraction ||                // During note interactions
            this.hasDialInteraction ||                  // During dial dragging (NEW!)
            this.ghostNoteAnimation !== null ||         // During ghost note preview
            hasAnimations                               // Always run when animations exist (notes on canvas need continuous animation)
        );


        return hasRelevantDisplays;
    }

    // Event handlers
    onNoteInteractionStart(noteId, color) {
        if (this.shouldAnimateColor(color)) {
            this.activeNoteAnimations.set(noteId, color);
            this.hasActiveInteraction = true;
            logger.debug(`${this.effectName}AnimationEffect`, `Started interaction animation for note ${noteId} (${color})`, null, 'animation');

            // Trigger animation manager to update state when interaction starts
            if (window.animationEffectsManager && window.animationEffectsManager.updateAnimationState) {
                window.animationEffectsManager.updateAnimationState();
            }
        }
    }

    onNoteInteractionEnd(noteId) {
        this.activeNoteAnimations.delete(noteId);
        this.hasActiveInteraction = this.activeNoteAnimations.size > 0;
        logger.debug(`${this.effectName}AnimationEffect`, `Ended interaction animation for note ${noteId}`, null, 'animation');

        // Trigger animation manager to update state when interaction ends
        if (window.animationEffectsManager && window.animationEffectsManager.updateAnimationState) {
            window.animationEffectsManager.updateAnimationState();
        }
    }

    onGhostNoteUpdated(color) {
        if (this.shouldAnimateColor(color)) {
            this.ghostNoteAnimation = { color, active: true };
            logger.debug(`${this.effectName}AnimationEffect`, `Ghost note animation updated for color ${color}`, null, 'animation');
        } else {
            this.ghostNoteAnimation = null;
        }
    }

    onGhostNoteCleared() {
        this.ghostNoteAnimation = null;
        logger.debug(`${this.effectName}AnimationEffect`, 'Ghost note animation cleared', null, 'animation');
    }

    onNoteAttack(noteId, color) {
        if (this.shouldAnimateColor(color)) {
            this.activeSoundingNotes.set(noteId, color);
            logger.debug(`${this.effectName}AnimationEffect`, `Note attack: ${noteId} (${color}) added to active sounding notes`, null, 'animation');

            // Trigger animation manager to update state
            if (window.animationEffectsManager && window.animationEffectsManager.updateAnimationState) {
                window.animationEffectsManager.updateAnimationState();
            }
        }
    }

    onNoteRelease(noteId, color) {
        this.activeSoundingNotes.delete(noteId);
        logger.debug(`${this.effectName}AnimationEffect`, `Note release: ${noteId} (${color}) removed from active sounding notes`, null, 'animation');

        // Trigger animation manager to update state
        if (window.animationEffectsManager && window.animationEffectsManager.updateAnimationState) {
            window.animationEffectsManager.updateAnimationState();
        }
    }

    onDialInteractionStart(color) {
        if (this.shouldAnimateColor(color)) {
            this.hasDialInteraction = true;
            // Create a synthetic "dial preview" animation for this color
            this.activeNoteAnimations.set('dial-preview', color);
            logger.debug(`${this.effectName}AnimationEffect`, `Dial interaction started for ${color}`, null, 'animation');

            // Trigger animation manager to update state
            if (window.animationEffectsManager && window.animationEffectsManager.updateAnimationState) {
                window.animationEffectsManager.updateAnimationState();
            }
        }
    }

    onDialInteractionEnd(color) {
        this.hasDialInteraction = false;
        this.activeNoteAnimations.delete('dial-preview');
        logger.debug(`${this.effectName}AnimationEffect`, `Dial interaction ended for ${color}`, null, 'animation');

        // Trigger animation manager to update state
        if (window.animationEffectsManager && window.animationEffectsManager.updateAnimationState) {
            window.animationEffectsManager.updateAnimationState();
        }
    }

    /**
     * Get all currently active colors for this effect
     * Only returns colors that have notes actively sounding or interacting
     */
    getActiveColors() {
        // Only return colors that are actually being animated (have active notes)
        const activeColors = new Set();

        // Add colors from actively sounding notes (during playback)
        for (const [noteId, color] of this.activeSoundingNotes.entries()) {
            if (this.shouldAnimateColor(color)) {
                activeColors.add(color);
            }
        }

        // Add colors from active interactions (spacebar, note placement)
        for (const [noteId, color] of this.activeNoteAnimations.entries()) {
            if (this.shouldAnimateColor(color)) {
                activeColors.add(color);
            }
        }

        // Add ghost note color if active
        if (this.ghostNoteAnimation && this.shouldAnimateColor(this.ghostNoteAnimation.color)) {
            activeColors.add(this.ghostNoteAnimation.color);
        }

        return Array.from(activeColors);
    }

    /**
     * Dispose base resources
     */
    disposeBase() {
        this.animations.clear();
        this.activeNoteAnimations.clear();
        this.activeSoundingNotes.clear();
        this.ghostNoteAnimation = null;
        
        logger.info(`${this.effectName}AnimationEffect`, 'Base disposed', null, 'animation');
    }
}

export default BaseAnimationEffect;