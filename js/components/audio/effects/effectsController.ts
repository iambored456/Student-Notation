// js/components/Effects/effectsController.js

import logger from '@utils/logger.ts';
import store from '@state/index.ts';
import effectsCoordinator from '@services/effectsCoordinator.ts';
import SynthEngine from '@services/synthEngine.ts';
import GlobalService from '@services/globalService.ts';
import { Note } from 'tonal';

interface EffectControlConfig {
  label: string;
  min: number;
  max: number;
  default: number;
  unit?: string;
}

interface EffectConfig {
  name: string;
  controls: Record<string, EffectControlConfig>;
}

interface DialEntry {
  dial: { element: HTMLInputElement; value: number; destroy: () => void };
  control: string;
  effectType: string;
  valueDisplay: HTMLElement;
  controlConfig: EffectControlConfig;
}

class EffectsController {
  private currentEffect: string | null = null;
  private effectControlsContainer: HTMLElement | null = null;
  private effectButtons: NodeListOf<HTMLElement> = [] as any;
  private dials: DialEntry[] = [];
  private currentColor: string | null = null;
  private isDialInteractionActive = false;
  private lastPreviewAt: Record<string, number> = {};
  private readonly previewThrottleMs = 180;
  private readonly previewDurationMs = 220;
  private readonly previewPitch = 'C4';
  private holdPreviews: Record<string, { pitches: string[]; root: string; color: string; noteId: string }> = {};

  private effectConfigs: Record<string, EffectConfig> = {
    reverb: {
      name: 'Reverb',
      controls: {
        decay: { label: 'Time', min: 0, max: 100, default: 0, unit: '%' },
        roomSize: { label: 'Size', min: 0, max: 100, default: 0, unit: '%' },
        wet: { label: 'Mix', min: 0, max: 100, default: 10, unit: '%' }
      }
    },
    delay: {
      name: 'Delay',
      controls: {
        time: { label: 'Time', min: 0, max: 100, default: 0, unit: '%' },
        feedback: { label: 'Echoes', min: 0, max: 95, default: 0, unit: '%' },
        wet: { label: 'Mix', min: 0, max: 100, default: 15, unit: '%' }
      }
    },
    vibrato: {
      name: 'Vibrato',
      controls: {
        speed: { label: 'Speed', min: 0, max: 100, default: 0, unit: '%' },
        span: { label: 'Span', min: 0, max: 100, default: 0, unit: '%' }
      }
    },
    tremolo: {
      name: 'Tremolo',
      controls: {
        speed: { label: 'Speed', min: 0, max: 100, default: 0, unit: '%' },
        span: { label: 'Span', min: 0, max: 100, default: 0, unit: '%' }
      }
    }
  };

  init() {
    logger.initStart('Effects Controller');

    this.effectControlsContainer = document.getElementById('effect-controls');
    this.effectButtons = document.querySelectorAll('.effect-button[data-effect]');

    if (!this.effectControlsContainer || this.effectButtons.length === 0) {
      logger.initFailed('Effects Controller', 'Required DOM elements not found');
      return false;
    }

    this.setupEventListeners();
    this.initializeSelectedColorTracking();
    this.setupGlobalMouseUpHandler();
    logger.initSuccess('Effects Controller');
    return true;
  }

  private setupGlobalMouseUpHandler() {
    document.addEventListener('mouseup', () => {
      if (this.isDialInteractionActive) {
        this.onDialInteractionEnd(this.currentEffect);
      }
    });
  }

  private setupEventListeners() {
    this.effectButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const effect = target.dataset['effect'];
        if (effect) {
          this.selectEffect(effect);
        }
      });
    });
  }

  selectEffect(effectType: string) {
    logger.debug('Effects', `Selecting effect: ${effectType}`, null, 'ui');

    if (!this.effectConfigs[effectType]) {
      logger.info('Effects', `Effect ${effectType} not configured`, null, 'ui');
      return;
    }

    this.effectButtons.forEach(btn => {
      btn.classList.remove('active');
      if ((btn).dataset['effect'] === effectType) {
        btn.classList.add('active');
      }
    });

    if (this.currentEffect === effectType) {
      this.currentEffect = null;
      this.hideEffectControls();
      return;
    }

    this.currentEffect = effectType;
    this.showEffectControls(effectType);
  }

  private showEffectControls(effectType: string) {
    const config = this.effectConfigs[effectType];
    if (!config || !this.effectControlsContainer) {
      logger.warn('Effects', `No configuration found for effect: ${effectType}`, null, 'ui');
      return;
    }

    this.clearControls();

    this.effectControlsContainer.innerHTML = '<div class="effect-controls"></div>';
    const controlsContainer = this.effectControlsContainer.querySelector('.effect-controls');
    if (!controlsContainer) {return;}

    Object.entries(config.controls).forEach(([key, control]) => {
      const effectParams = this.currentColor ? (effectsCoordinator as any).getEffectParameters?.(this.currentColor, effectType) : null;
      const currentValue = effectParams?.[key] ?? control.default ?? 0;

      const sliderContainer = document.createElement('div');
      sliderContainer.className = 'effect-slider-group';
      sliderContainer.style.cssText = 'margin-bottom: 15px; padding: 10px; border: 1px solid #ccc; border-radius: 5px;';
      controlsContainer.appendChild(sliderContainer);

      const label = document.createElement('label');
      label.className = 'effect-slider-label';
      label.textContent = control.label;
      label.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold; color: #333;';
      sliderContainer.appendChild(label);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = `${control.min}`;
      slider.max = `${control.max}`;
      slider.value = `${currentValue}`;
      slider.className = 'effect-slider';
      slider.style.cssText = 'width: 100%; margin: 5px 0;';
      sliderContainer.appendChild(slider);

      const valueDisplay = document.createElement('div');
      valueDisplay.className = 'effect-slider-value';
      const displayValue = control.unit ? `${Math.round(currentValue)}${control.unit}` : Math.round(currentValue);
      valueDisplay.textContent = `${displayValue}`;
      valueDisplay.style.cssText = 'text-align: center; font-size: 12px; color: #666;';
      sliderContainer.appendChild(valueDisplay);

      this.dials.push({
        dial: {
          element: slider,
          value: currentValue,
          destroy: () => {}
        },
        control: key,
        effectType,
        valueDisplay,
        controlConfig: control
      });

      const handleSliderChange = (e: Event) => {
        const target = e.target as HTMLInputElement | null;
        if (!target) {return;}
        const value = parseFloat(target.value);
        const displayVal = control.unit ? `${Math.round(value)}${control.unit}` : Math.round(value);
        valueDisplay.textContent = `${displayVal}`;
        logger.debug('Effects', `${effectType} ${key}: ${value}`, null, 'audio');
        this.onEffectParameterChange(effectType, key, value);
      };

      slider.addEventListener('input', handleSliderChange);
      slider.addEventListener('change', handleSliderChange);

      slider.addEventListener('mousedown', () => this.onDialInteractionStart(effectType));
      slider.addEventListener('mouseup', () => this.onDialInteractionEnd(effectType));
      slider.addEventListener('mouseleave', (ev) => {
        if ((ev.buttons & 1) === 1) {
          this.onDialInteractionEnd(effectType);
        }
      });
    });
  }

  private hideEffectControls() {
    this.clearControls();
    this.currentEffect = null;
  }

  private clearControls() {
    this.dials.forEach(d => d.dial.destroy());
    this.dials = [];
    if (this.effectControlsContainer) {
      this.effectControlsContainer.innerHTML = '';
    }
  }

  private onEffectParameterChange(effectType: string, param: string, value: number) {
    const color = this.currentColor || store.state.selectedNote?.color;
    if (!color) {return;}
    effectsCoordinator.updateParameter(effectType, param, value, color);
  }

  /**
   * Used by the position (X/Y) canvas controls to push simultaneous updates.
   */
  updateEffect(effectType: string, params: Record<string, number>) {
    const color = this.currentColor || store.state.selectedNote?.color;
    if (!color) {return;}
    Object.entries(params).forEach(([param, value]) => {
      if (typeof value === 'number') {
        effectsCoordinator.updateParameter(effectType, param, value, color);
      }
    });
  }

  /**
   * Allow position canvases to pull the latest values for the active color.
   */
  getEffectState(effectType: string): Record<string, number> {
    const color = this.currentColor || store.state.selectedNote?.color;
    if (!color) {return {};}
    return effectsCoordinator.getEffectParameters(color, effectType) || {};
  }

  /**
   * Expose the active color for other controllers (e.g., position canvases).
   */
  getActiveColor(): string | null {
    return this.currentColor || store.state.selectedNote?.color || null;
  }

  /**
   * Determine preview pitches similar to spacebar behavior.
   */
  private getPreviewNotes(): { pitches: string[]; root: string; color: string } | null {
    const color = this.getActiveColor();
    if (!color) {return null;}

    const lastPitchNote = store.state.placedNotes
      .slice()
      .reverse()
      .find(note => !note.isDrum);

    const root = lastPitchNote
      ? (store.state.fullRowData[lastPitchNote.row]?.toneNote || this.previewPitch)
      : this.previewPitch;

    const toolType = store.state.selectedTool;
    let pitches: string[] = [root];
    if (toolType === 'chord' && Array.isArray(store.state.activeChordIntervals)) {
      const intervals = store.state.activeChordIntervals as string[];
      pitches = intervals.map(interval => Note.simplify(Note.transpose(root, interval)));
    }

    return { pitches, root, color };
  }

  /**
   * Play a short preview note and emit animation events while the dial is being dragged.
   */
  previewEffect(effectType: string): void {
    const color = this.getActiveColor();
    if (!color) {return;}

    const now = Date.now();
    const last = this.lastPreviewAt[effectType] ?? 0;
    if (now - last < this.previewThrottleMs) {return;}
    this.lastPreviewAt[effectType] = now;

    // Avoid piling previews on top of active transport playback
    const { isPlaying, isPaused } = store.state as any;
    if (isPlaying && !isPaused) {return;}

    const noteId = `effect-preview-${effectType}`;
    // Trigger animation system
    store.emit?.('noteAttack', { noteId, color });

    try {
      SynthEngine.triggerAttack(this.previewPitch, color);
      setTimeout(() => SynthEngine.triggerRelease(this.previewPitch, color), this.previewDurationMs);
    } catch (err) {
      logger.warn('Effects', 'Preview trigger failed', { err }, 'audio');
    } finally {
      setTimeout(() => store.emit?.('noteRelease', { noteId, color }), this.previewDurationMs);
    }
  }

  /**
   * Start a sustained preview (on pointer down) behaving like holding spacebar.
   */
  startHoldPreview(effectType: string): void {
    if (this.holdPreviews[effectType]) {return;}
    const context = this.getPreviewNotes();
    if (!context) {return;}

    const { pitches, root, color } = context;
    const noteId = `effect-hold-${effectType}-${Date.now()}`;
    this.holdPreviews[effectType] = { pitches, root, color, noteId };

    // Do not layer previews over active playback
    const { isPlaying, isPaused } = store.state as any;
    if (isPlaying && !isPaused) {return;}

    pitches.forEach(pitch => SynthEngine.triggerAttack(pitch, color));

    const rowData = store.state.fullRowData.find(row => row.toneNote === root);
    const pitchColor = rowData ? rowData.hex : '#888888';
    const timbre = store.state.timbres[color];
    if (timbre) {
      GlobalService.adsrComponent?.playheadManager.trigger(noteId, 'attack', pitchColor, timbre.adsr);
    }

    store.emit('spacebarPlayback', { note: root, color, isPlaying: true });
    store.emit('noteAttack', { noteId, color });
  }

  /**
   * Stop a sustained preview (on pointer up) matching spacebar release.
   */
  stopHoldPreview(effectType: string): void {
    const preview = this.holdPreviews[effectType];
    if (!preview) {return;}
    delete this.holdPreviews[effectType];

    const { pitches, root, color, noteId } = preview;
    pitches.forEach(pitch => SynthEngine.triggerRelease(pitch, color));

    const rowData = store.state.fullRowData.find(row => row.toneNote === root);
    const pitchColor = rowData ? rowData.hex : '#888888';
    const timbre = store.state.timbres[color];
    if (timbre) {
      GlobalService.adsrComponent?.playheadManager.trigger(noteId, 'release', pitchColor, timbre.adsr);
    }

    store.emit('spacebarPlayback', { note: root, color, isPlaying: false });
    store.emit('noteRelease', { noteId, color });
  }

  private initializeSelectedColorTracking() {
    store.on('noteChanged', ({ newNote }: { newNote: { color?: string } }) => {
      this.currentColor = newNote.color || null;
      if (this.currentColor && this.currentEffect) {
        this.showEffectControls(this.currentEffect);
      }
    });
    this.currentColor = store.state.selectedNote?.color || null;
  }

  private onDialInteractionStart(effectType: string | null) {
    this.isDialInteractionActive = true;
    if (effectType) {
      logger.debug('Effects', `Dial interaction start for ${effectType}`, null, 'ui');
    }
  }

  private onDialInteractionEnd(effectType: string | null) {
    this.isDialInteractionActive = false;
    if (effectType) {
      logger.debug('Effects', `Dial interaction end for ${effectType}`, null, 'ui');
    }
  }
}

const effectsController = new EffectsController();
export default effectsController;
