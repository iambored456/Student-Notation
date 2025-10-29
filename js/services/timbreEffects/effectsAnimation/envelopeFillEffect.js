// js/services/timbreEffects/effectsAnimation/envelopeFillEffect.js
import store from '../../../state/index.js';
import logger from '../../../utils/logger.js';
import * as Tone from 'tone';

logger.moduleLoaded('EnvelopeFillEffect');

/**
 * Envelope Fill Animation Effect
 * Creates a radiating fill animation for shape notes during playback
 * Fill level is driven by the real-time ADSR envelope amplitude
 *
 * NOTE: Does NOT extend BaseAnimationEffect because envelope fill
 * works differently - it's driven purely by ADSR envelope, not by
 * user interactions or effect parameters.
 */
class EnvelopeFillEffect {
    constructor() {
        // Track fill levels for each currently playing note
        // noteId -> { fillLevel: 0-1, color: string, startTime: number, adsr: object, phase: string }
        this.activeFills = new Map();
        this.instanceId = Math.random().toString(36).substring(7);

        logger.info('EnvelopeFillEffect', 'Initialized', null, 'animation');
    }

    /**
     * Initialize the envelope fill effect
     */
    init() {
        // Subscribe to note attack events to start fill animation
        store.on('noteAttack', ({ noteId, color }) => {

            const timbre = store.state.timbres[color];
            if (!timbre) {
                console.warn('[ENVELOPE FILL] ⚠️ No timbre found for color:', color);
                return;
            }

            this.activeFills.set(noteId, {
                fillLevel: 0,
                color: color,
                startTime: Tone.now(),
                adsr: timbre.adsr,
                phase: 'attack' // attack, decay, sustain, release
            });

            logger.debug('EnvelopeFillEffect', `Started fill animation for note ${noteId}`, null, 'animation');

            // Trigger animation manager to update state and start loop if needed
            if (window.animationEffectsManager && window.animationEffectsManager.updateAnimationState) {
                window.animationEffectsManager.updateAnimationState();
            }
        });

        // Subscribe to note release events to begin release phase
        store.on('noteRelease', ({ noteId, color }) => {
            const fillData = this.activeFills.get(noteId);
            if (fillData) {
                fillData.phase = 'release';
                fillData.releaseStartTime = Tone.now();
                fillData.releaseStartLevel = fillData.fillLevel;

                logger.debug('EnvelopeFillEffect', `Started release phase for note ${noteId}`, null, 'animation');
            } else {
                console.warn('[ENVELOPE FILL] ⚠️ No fill data found for release:', noteId);
            }
        });

        // Clean up completed fills
        store.on('playbackStopped', () => {
            this.activeFills.clear();

            // Trigger animation state update to stop animation loop
            if (window.animationEffectsManager && window.animationEffectsManager.updateAnimationState) {
                window.animationEffectsManager.updateAnimationState();
            }

            // Trigger one final canvas redraw to clear the fill visuals
            store.emit('animationUpdate', {
                type: 'envelopeFill',
                activeColors: [],
                hasEnvelopeFills: false
            });
        });

        logger.info('EnvelopeFillEffect', 'Event subscriptions established', null, 'animation');
    }

    /**
     * Update fill levels for all active notes based on ADSR envelope
     */
    updateAnimationPhases(currentTime) {
        const now = Tone.now();

        // Update each active fill based on its ADSR envelope
        for (const [noteId, fillData] of this.activeFills.entries()) {
            const { adsr, startTime, phase, releaseStartTime, releaseStartLevel } = fillData;
            const timeSinceStart = now - startTime;

            if (phase === 'attack') {
                // Attack phase: fill level rises from 0 to 1
                const attackDuration = adsr.attack || 0.01;
                if (timeSinceStart < attackDuration) {
                    fillData.fillLevel = timeSinceStart / attackDuration;
                } else {
                    // Move to decay phase
                    fillData.phase = 'decay';
                    fillData.decayStartTime = now;
                }
            } else if (phase === 'decay') {
                // Decay phase: fill level falls from 1 to sustain level
                const decayDuration = adsr.decay || 0.1;
                const timeSinceDecay = now - fillData.decayStartTime;
                const sustainLevel = adsr.sustain !== undefined ? adsr.sustain : 0.5;

                if (timeSinceDecay < decayDuration) {
                    const decayProgress = timeSinceDecay / decayDuration;
                    fillData.fillLevel = 1 - (decayProgress * (1 - sustainLevel));
                } else {
                    // Move to sustain phase
                    fillData.phase = 'sustain';
                    fillData.fillLevel = sustainLevel;
                }
            } else if (phase === 'sustain') {
                // Sustain phase: fill level stays at sustain level
                const sustainLevel = adsr.sustain !== undefined ? adsr.sustain : 0.5;
                fillData.fillLevel = sustainLevel;
            } else if (phase === 'release') {
                // Release phase: fill level falls from current level to 0
                const releaseDuration = adsr.release || 0.5;
                const timeSinceRelease = now - releaseStartTime;

                if (timeSinceRelease < releaseDuration) {
                    const releaseProgress = timeSinceRelease / releaseDuration;
                    fillData.fillLevel = releaseStartLevel * (1 - releaseProgress);
                } else {
                    // Animation complete - remove from active fills
                    this.activeFills.delete(noteId);
                    logger.debug('EnvelopeFillEffect', `Completed fill animation for note ${noteId}`, null, 'animation');

                    // Check if we should stop animation loop
                    if (this.activeFills.size === 0 && window.animationEffectsManager && window.animationEffectsManager.updateAnimationState) {
                        window.animationEffectsManager.updateAnimationState();
                    }
                }
            }
        }
    }

    /**
     * Get the fill level for a specific note (0 to 1)
     * @param {object} note - The note object
     * @returns {number} Fill level from 0 (empty) to 1 (full)
     */
    getFillLevel(note) {
        if (!note.uuid) return 0;

        const fillData = this.activeFills.get(note.uuid);
        if (!fillData) return 0;

        return fillData.fillLevel;
    }

    /**
     * Check if a note should have fill animation
     * @param {object} note - The note object
     * @returns {boolean} True if the note should be filled
     */
    shouldFillNote(note) {
        if (!note.uuid) return false;
        return this.activeFills.has(note.uuid);
    }

    /**
     * Check if the envelope fill effect should be running
     */
    shouldBeRunning() {
        return this.activeFills.size > 0;
    }

    /**
     * Dispose envelope fill effect resources
     */
    dispose() {
        this.activeFills.clear();
        logger.info('EnvelopeFillEffect', 'Disposed', null, 'animation');
    }
}

export default EnvelopeFillEffect;
