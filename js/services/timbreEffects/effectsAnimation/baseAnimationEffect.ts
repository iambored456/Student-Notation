// js/services/timbreEffects/effectsAnimation/baseAnimationEffect.ts
import store from '@state/index.ts';
import logger from '@utils/logger.ts';
import type { AnimatableNote } from '../../../../types/state.js';

type AnimationEffectType = 'vibrato' | 'tremolo' | 'delay' | 'reverb';

interface VisualEffectChangeEvent<Params> {
  effectType: AnimationEffectType;
  color: string;
  effectParams: Params;
}

interface NoteInteractionPayload {
  noteId: string;
  color: string;
}

interface GhostNotePayload {
  color: string;
}

interface PlaybackTogglePayload {
  isPlaying: boolean;
}

interface DialInteractionPayload {
  effectType: string;
  color: string;
}

interface GhostNoteAnimation {
  color: string;
  active: boolean;
}

abstract class BaseAnimationEffect<
  TAnimationState = Record<string, unknown>,
  TEffectParams extends object = Record<string, unknown>
> {
  public readonly effectName: string;
  public readonly animations: Map<string, TAnimationState>;
  public readonly activeNoteAnimations: Map<string, string>;
  public ghostNoteAnimation: GhostNoteAnimation | null;
  public readonly activeSoundingNotes: Map<string, string>;
  public isPlaybackActive: boolean;
  public hasActiveInteraction: boolean;
  public hasDialInteraction: boolean;

  protected constructor(effectName: string) {
    this.effectName = effectName;
    this.animations = new Map();
    this.activeNoteAnimations = new Map();
    this.ghostNoteAnimation = null;
    this.activeSoundingNotes = new Map();
    this.isPlaybackActive = false;
    this.hasActiveInteraction = false;
    this.hasDialInteraction = false;

    logger.info(`${effectName}AnimationEffect`, 'Base initialized', null, 'animation');
  }

  initBase(): void {
    store.on('visualEffectChanged', (payload?: VisualEffectChangeEvent<TEffectParams>) => {
      if (!payload) {
        return;
      }
      const { effectType, color, effectParams } = payload;
      if (effectType === this.effectName.toLowerCase()) {
        this.updateAnimationParameters(color, effectParams);
      }
    });

    store.on('playbackStarted', () => {
      this.isPlaybackActive = true;
      this.requestAnimationStateUpdate();
    });

    store.on('playbackStopped', () => {
      this.isPlaybackActive = false;
      this.activeNoteAnimations.clear();
      this.activeSoundingNotes.clear();
      this.requestAnimationStateUpdate();
    });

    store.on('noteInteractionStart', (payload?: NoteInteractionPayload) => {
      if (!payload) {
        return;
      }
      this.onNoteInteractionStart(payload.noteId, payload.color);
    });

    store.on('noteInteractionEnd', (payload?: { noteId: string }) => {
      const noteId = payload?.noteId;
      if (!noteId) {
        return;
      }
      this.onNoteInteractionEnd(noteId);
    });

    store.on('ghostNoteUpdated', (payload?: GhostNotePayload) => {
      if (!payload) {
        return;
      }
      this.onGhostNoteUpdated(payload.color);
    });
    store.on('ghostNoteCleared', () => this.onGhostNoteCleared());

    store.on('spacebarPlayback', (payload?: PlaybackTogglePayload) => {
      if (!payload) {
        return;
      }
      this.isPlaybackActive = payload.isPlaying;
      this.requestAnimationStateUpdate();
    });

    store.on('noteAttack', (payload?: NoteInteractionPayload) => {
      if (!payload) {
        return;
      }
      this.onNoteAttack(payload.noteId, payload.color);
    });
    store.on('noteRelease', (payload?: NoteInteractionPayload) => {
      if (!payload) {
        return;
      }
      this.onNoteRelease(payload.noteId, payload.color);
    });

    store.on('effectDialInteractionStart', (payload?: DialInteractionPayload) => {
      if (!payload) {
        return;
      }
      if (payload.effectType === this.effectName.toLowerCase()) {
        this.onDialInteractionStart(payload.color);
      }
    });
    store.on('effectDialInteractionEnd', (payload?: DialInteractionPayload) => {
      if (!payload) {
        return;
      }
      if (payload.effectType === this.effectName.toLowerCase()) {
        this.onDialInteractionEnd(payload.color);
      }
    });

    logger.info(`${this.effectName}AnimationEffect`, 'Base event subscriptions established', null, 'animation');
  }

  abstract updateAnimationParameters(color: string, effectParams: TEffectParams): void;

  abstract updateAnimationPhases(currentTime: number): void;

  shouldAnimateColor(color: string): boolean {
    return this.animations.has(color);
  }

  shouldAnimateNote(note: AnimatableNote | null | undefined): boolean {
    if (!note?.color) {
      return false;
    }

    if (!this.shouldAnimateColor(note.color)) {
      return false;
    }

    if (this.hasDialInteraction && this.activeNoteAnimations.has('dial-preview')) {
      const dialPreviewColor = this.activeNoteAnimations.get('dial-preview');
      if (dialPreviewColor && note.color === dialPreviewColor) {
        return true;
      }
    }

    if (this.isPlaybackActive && note.uuid && this.activeSoundingNotes.has(note.uuid)) {
      return true;
    }

    if (this.hasActiveInteraction && note.uuid && this.activeNoteAnimations.has(note.uuid)) {
      return true;
    }

    if (!note.uuid && this.ghostNoteAnimation && this.ghostNoteAnimation.color === note.color && this.isPlaybackActive) {
      return true;
    }

    return false;
  }

  shouldBeRunning(): boolean {
    const hasAnimations = this.animations.size > 0;
    if (!hasAnimations) {
      return false;
    }

    return Boolean(
      this.isPlaybackActive ||
      this.hasActiveInteraction ||
      this.hasDialInteraction ||
      this.ghostNoteAnimation !== null ||
      hasAnimations
    );
  }

  protected onNoteInteractionStart(noteId: string, color: string): void {
    if (!this.shouldAnimateColor(color)) {
      return;
    }
    this.activeNoteAnimations.set(noteId, color);
    this.hasActiveInteraction = true;
    logger.debug(`${this.effectName}AnimationEffect`, `Started interaction animation for note ${noteId} (${color})`, null, 'animation');
    this.requestAnimationStateUpdate();
  }

  protected onNoteInteractionEnd(noteId: string): void {
    this.activeNoteAnimations.delete(noteId);
    this.hasActiveInteraction = this.activeNoteAnimations.size > 0;
    logger.debug(`${this.effectName}AnimationEffect`, `Ended interaction animation for note ${noteId}`, null, 'animation');
    this.requestAnimationStateUpdate();
  }

  protected onGhostNoteUpdated(color: string): void {
    if (this.shouldAnimateColor(color)) {
      this.ghostNoteAnimation = { color, active: true };
      logger.debug(`${this.effectName}AnimationEffect`, `Ghost note animation updated for color ${color}`, null, 'animation');
    } else {
      this.ghostNoteAnimation = null;
    }
  }

  protected onGhostNoteCleared(): void {
    this.ghostNoteAnimation = null;
    logger.debug(`${this.effectName}AnimationEffect`, 'Ghost note animation cleared', null, 'animation');
  }

  protected onNoteAttack(noteId: string, color: string): void {
    if (!this.shouldAnimateColor(color)) {
      return;
    }
    this.activeSoundingNotes.set(noteId, color);
    logger.debug(`${this.effectName}AnimationEffect`, `Note attack: ${noteId} (${color}) added to active sounding notes`, null, 'animation');
    this.requestAnimationStateUpdate();
  }

  protected onNoteRelease(noteId: string, color: string): void {
    this.activeSoundingNotes.delete(noteId);
    logger.debug(`${this.effectName}AnimationEffect`, `Note release: ${noteId} (${color}) removed from active sounding notes`, null, 'animation');
    this.requestAnimationStateUpdate();
  }

  protected onDialInteractionStart(color: string): void {
    if (!this.shouldAnimateColor(color)) {
      return;
    }
    this.hasDialInteraction = true;
    this.activeNoteAnimations.set('dial-preview', color);
    logger.debug(`${this.effectName}AnimationEffect`, `Dial interaction started for ${color}`, null, 'animation');
    this.requestAnimationStateUpdate();
  }

  protected onDialInteractionEnd(color: string): void {
    this.hasDialInteraction = false;
    this.activeNoteAnimations.delete('dial-preview');
    logger.debug(`${this.effectName}AnimationEffect`, `Dial interaction ended for ${color}`, null, 'animation');
    this.requestAnimationStateUpdate();
  }

  getActiveColors(): string[] {
    const activeColors = new Set<string>();

    for (const [, color] of this.activeSoundingNotes.entries()) {
      if (this.shouldAnimateColor(color)) {
        activeColors.add(color);
      }
    }

    for (const [, color] of this.activeNoteAnimations.entries()) {
      if (this.shouldAnimateColor(color)) {
        activeColors.add(color);
      }
    }

    if (this.ghostNoteAnimation && this.shouldAnimateColor(this.ghostNoteAnimation.color)) {
      activeColors.add(this.ghostNoteAnimation.color);
    }

    return Array.from(activeColors);
  }

  protected disposeBase(): void {
    this.animations.clear();
    this.activeNoteAnimations.clear();
    this.activeSoundingNotes.clear();
    this.ghostNoteAnimation = null;

    logger.info(`${this.effectName}AnimationEffect`, 'Base disposed', null, 'animation');
  }

  private requestAnimationStateUpdate(): void {
    window.animationEffectsManager?.updateAnimationState();
  }
}

export default BaseAnimationEffect;
