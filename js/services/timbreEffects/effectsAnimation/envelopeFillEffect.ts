// js/services/timbreEffects/effectsAnimation/envelopeFillEffect.ts
import store from '@state/index.ts';
import logger from '@utils/logger.ts';
import * as Tone from 'tone';
import type { AnimatableNote, TimbreState } from '../../../../types/state.js';

logger.moduleLoaded('EnvelopeFillEffect');

type EnvelopePhase = 'attack' | 'decay' | 'sustain' | 'release';

interface FillData {
  fillLevel: number;
  color: string;
  startTime: number;
  adsr: TimbreState['adsr'];
  phase: EnvelopePhase;
  releaseStartTime?: number;
  releaseStartLevel?: number;
  decayStartTime?: number;
}

class EnvelopeFillEffect {
  public readonly activeFills: Map<string, FillData>;
  private readonly instanceId: string;

  constructor() {
    this.activeFills = new Map();
    this.instanceId = Math.random().toString(36).substring(7);

    logger.info('EnvelopeFillEffect', 'Initialized', null, 'animation');
  }

  init(): void {
    // Subscribe to note attack events to start fill animation
    store.on('noteAttack', (payload?: { noteId?: string; color?: string }) => {
      const noteId = payload?.noteId;
      const color = payload?.color;
      if (!noteId || !color) {
        return;
      }

      const timbre = store.state.timbres?.[color] as TimbreState | undefined;
      if (!timbre) {
        logger.warn('EnvelopeFillEffect', 'No timbre found for color', { color }, 'effects');
        return;
      }

      this.activeFills.set(noteId, {
        fillLevel: 0,
        color,
        startTime: Tone.now(),
        adsr: timbre.adsr,
        phase: 'attack'
      });

      logger.debug('EnvelopeFillEffect', `Started fill animation for note ${noteId}`, null, 'animation');

      // Trigger animation manager to update state and start loop if needed
      window.animationEffectsManager?.updateAnimationState();
    });

    // Subscribe to note release events to begin release phase
    store.on('noteRelease', (payload?: { noteId?: string }) => {
      const noteId = payload?.noteId;
      if (!noteId) {
        return;
      }
      const fillData = this.activeFills.get(noteId);
      if (fillData) {
        fillData.phase = 'release';
        fillData.releaseStartTime = Tone.now();
        fillData.releaseStartLevel = fillData.fillLevel;

        logger.debug('EnvelopeFillEffect', `Started release phase for note ${noteId}`, null, 'animation');
      } else {
        logger.warn('EnvelopeFillEffect', 'No fill data found for release', { noteId }, 'effects');
      }
    });

    // Clean up completed fills
    store.on('playbackStopped', () => {
      this.activeFills.clear();

      // Trigger animation state update to stop animation loop
      window.animationEffectsManager?.updateAnimationState();

      // Trigger one final canvas redraw to clear the fill visuals
      store.emit('animationUpdate', {
        type: 'envelopeFill',
        activeColors: [],
        hasEnvelopeFills: false
      });
    });

    logger.info('EnvelopeFillEffect', 'Event subscriptions established', null, 'animation');
  }

  updateAnimationPhases(_currentTime: number): void {
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
        const timeSinceDecay = now - (fillData.decayStartTime ?? now);
        const sustainLevel = adsr.sustain ?? 0.5;

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
        const sustainLevel = adsr.sustain ?? 0.5;
        fillData.fillLevel = sustainLevel;
      } else if (phase === 'release') {
        // Release phase: fill level falls from current level to 0
        const releaseDuration = adsr.release || 0.5;
        const timeSinceRelease = releaseStartTime ? now - releaseStartTime : 0;
        const startLevel = releaseStartLevel ?? fillData.fillLevel;

        if (timeSinceRelease < releaseDuration) {
          const releaseProgress = timeSinceRelease / releaseDuration;
          fillData.fillLevel = startLevel * (1 - releaseProgress);
        } else {
          // Animation complete - remove from active fills
          this.activeFills.delete(noteId);
          logger.debug('EnvelopeFillEffect', `Completed fill animation for note ${noteId}`, null, 'animation');

          // Check if we should stop animation loop
          if (this.activeFills.size === 0) {
            window.animationEffectsManager?.updateAnimationState();
          }
        }
      }
    }
  }

  getFillLevel(note: AnimatableNote): number {
    if (!note.uuid) {return 0;}

    const fillData = this.activeFills.get(note.uuid);
    if (!fillData) {return 0;}

    return fillData.fillLevel;
  }

  shouldFillNote(note: AnimatableNote): boolean {
    if (!note.uuid) {return false;}
    return this.activeFills.has(note.uuid);
  }

  shouldBeRunning(): boolean {
    return this.activeFills.size > 0;
  }

  dispose(): void {
    this.activeFills.clear();
    logger.info('EnvelopeFillEffect', 'Disposed', null, 'animation');
  }
}

export default EnvelopeFillEffect;

