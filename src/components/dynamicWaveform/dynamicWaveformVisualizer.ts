// js/components/DynamicWaveform/dynamicWaveformVisualizer.ts
import store from '@state/index.ts';
import { hexToRgba } from '@utils/colorUtils.ts';
import logger from '@utils/logger.ts';

interface WaveformAnalyser {
  getValue(): Float32Array;
}

interface SynthEngineWithAnalyser {
  createWaveformAnalyzer?: (color: string) => WaveformAnalyser | null;
  removeWaveformAnalyzer?: (color: string) => void;
}

interface VibratoAnimation { amplitude: number; phase: number }
interface VibratoEffect {
  animations: Map<string, VibratoAnimation>;
  shouldBeRunning: () => boolean;
}

interface AnimationEffectsManagerLike {
  getTremoloAmplitudeMultiplier: (color: string) => number;
  vibratoCanvasEffect?: VibratoEffect;
}

const getSynthEngine = (): SynthEngineWithAnalyser | null => {
  return (window as { synthEngine?: SynthEngineWithAnalyser }).synthEngine ?? null;
};

const getAnimationManager = (): AnimationEffectsManagerLike | null => {
  return (window as { animationEffectsManager?: AnimationEffectsManagerLike }).animationEffectsManager ?? null;
};

logger.moduleLoaded('DynamicWaveformVisualizer');

class DynamicWaveformVisualizer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private currentColor: string | null = null;

  private isPlaybackActive = false;
  private liveAnalysers = new Map<string, WaveformAnalyser>();
  private liveWaveforms = new Map<string, Float32Array>();
  private playbackAnimationId: number | null = null;

  private animationSpeed = 100;
  private frameSkipCounter = 0;

  onWaveformUpdate?: () => void;

  initialize(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): boolean {
    this.canvas = canvas;
    this.ctx = ctx;
    this.currentColor = store.state.selectedNote?.color || '#4a90e2';
    this.setupEventListeners();
    logger.info('DynamicWaveformVisualizer', 'Initialized with canvas context', null, 'waveform');
    return true;
  }

  private setupEventListeners(): void {
    store.on('noteChanged', ({ newNote }: { newNote?: { color?: string } }) => {
      if (newNote?.color && newNote.color !== this.currentColor) {
        this.currentColor = newNote.color;
      }
    });

    store.on('playbackStateChanged', ({ isPlaying, isPaused }: { isPlaying: boolean; isPaused: boolean }) => {
      if (isPlaying && !isPaused) {
        this.startLiveVisualization();
      } else {
        this.stopLiveVisualization();
      }
    });

    store.on('spacebarPlayback', ({ color, isPlaying }: { color?: string; isPlaying: boolean }) => {
      if (isPlaying && color) {
        this.startSingleNoteVisualization(color);
      } else {
        this.stopLiveVisualization();
      }
    });

    store.on('tremoloAmplitudeUpdate', ({ activeColors }: { activeColors?: string[] }) => {
      if (this.isPlaybackActive && activeColors?.some(color => this.liveWaveforms.has(color))) {
        logger.debug('DynamicWaveformVisualizer', 'Tremolo update received for active colors', activeColors, 'waveform');
      }
    });

    logger.info('DynamicWaveformVisualizer', 'Event subscriptions established', null, 'waveform');
  }

  setAnimationSpeed(percentage: number): void {
    this.animationSpeed = percentage;
    this.frameSkipCounter = 0;
  }

  startLiveVisualization(): void {
    if (this.isPlaybackActive) {return;}
    this.isPlaybackActive = true;
    this.setupLiveAnalysers();
    this.updateContainerState(true);
    this.animateLiveWaveforms();
    logger.debug('DynamicWaveformVisualizer', 'Started live visualization', null, 'waveform');
  }

  startSingleNoteVisualization(color: string): void {
    if (this.isPlaybackActive) {return;}
    this.isPlaybackActive = true;
    this.setupSingleAnalyser(color);
    this.updateContainerState(true);
    this.animateLiveWaveforms();
    logger.debug('DynamicWaveformVisualizer', `Started single note visualization for ${color}`, null, 'waveform');
  }

  stopLiveVisualization(): void {
    this.isPlaybackActive = false;
    const synthEngine = getSynthEngine();
    this.liveAnalysers.forEach((_, color) => {
      synthEngine?.removeWaveformAnalyzer?.(color);
    });
    this.liveAnalysers.clear();
    this.liveWaveforms.clear();
    if (this.playbackAnimationId) {
      cancelAnimationFrame(this.playbackAnimationId);
      this.playbackAnimationId = null;
    }
    this.updateContainerState(false);
    logger.debug('DynamicWaveformVisualizer', 'Stopped live visualization', null, 'waveform');
  }

  private updateContainerState(isLive: boolean): void {
    const wrapper = this.canvas?.parentElement;
    if (!wrapper) {return;}
    if (isLive) {
      wrapper.classList.add('live-mode');
      if (store.state.isPlaying && !store.state.isPaused) {
        wrapper.classList.add('pulsing');
      }
    } else {
      wrapper.classList.remove('live-mode', 'pulsing');
    }
  }

  private setupLiveAnalysers(): void {
    const synthEngine = getSynthEngine();
    if (!synthEngine) {
      logger.warn('DynamicWaveformVisualizer', 'SynthEngine not available for live analysis', null, 'waveform');
      return;
    }
    const activeColors = this.getActivePlayingColors();
    activeColors.forEach(color => {
      const analyser = synthEngine.createWaveformAnalyzer?.(color);
      if (analyser) {
        this.liveAnalysers.set(color, analyser);
        this.liveWaveforms.set(color, new Float32Array(1024));
        logger.debug('DynamicWaveformVisualizer', `Created analyser for ${color}`, null, 'waveform');
      }
    });
  }

  private setupSingleAnalyser(color: string): void {
    const synthEngine = getSynthEngine();
    if (!synthEngine) {return;}
    const analyser = synthEngine.createWaveformAnalyzer?.(color);
    if (analyser) {
      this.liveAnalysers.set(color, analyser);
      this.liveWaveforms.set(color, new Float32Array(1024));
      logger.debug('DynamicWaveformVisualizer', `Created single analyser for ${color}`, null, 'waveform');
    }
  }

  private getActivePlayingColors(): string[] {
    const playingColors = new Set<string>();
    const placedNotes = store.state.placedNotes;
    if (store.state.isPlaying) {
      placedNotes.forEach(note => {
        if (!note.isDrum && note.color) {
          playingColors.add(note.color);
        }
      });
    }
    if (playingColors.size === 0 && this.currentColor) {
      playingColors.add(this.currentColor);
    }
    const result = Array.from(playingColors);
    logger.debug('DynamicWaveformVisualizer', 'Active playing colors detected', result, 'waveform');
    return result;
  }

  private animateLiveWaveforms(): void {
    if (!this.isPlaybackActive) {return;}
    this.frameSkipCounter++;
    const skipFrames = Math.max(1, Math.floor(100 / Math.max(this.animationSpeed, 1)));
    if (this.frameSkipCounter % skipFrames !== 0) {
      this.playbackAnimationId = requestAnimationFrame(() => this.animateLiveWaveforms());
      return;
    }

    this.liveAnalysers.forEach((analyser, color) => {
      const newWaveformArray = analyser.getValue();
      this.liveWaveforms.set(color, newWaveformArray);
    });

    this.onWaveformUpdate?.();
    this.playbackAnimationId = requestAnimationFrame(() => this.animateLiveWaveforms());
  }

  drawLiveWaveforms(width: number, centerY: number, baseAmplitude: number): void {
    const ctx = this.ctx;
    if (!ctx) {return;}
    const colors = Array.from(this.liveWaveforms.keys());
    if (colors.length === 1) {
      const color = colors[0];
      if (!color) {return;}
      const waveform = this.liveWaveforms.get(color);
      this.drawSingleLiveWaveform(waveform, color, width, centerY, baseAmplitude);
    } else if (colors.length > 1) {
      colors.forEach(color => {
        if (!color) {return;}
        const waveform = this.liveWaveforms.get(color);
        this.drawLayeredLiveWaveform(waveform, color, width, centerY, baseAmplitude, colors.length);
      });
    }
  }

  private drawSingleLiveWaveform(
    waveform: Float32Array | undefined,
    color: string,
    width: number,
    centerY: number,
    baseAmplitude: number
  ): void {
    const ctx = this.ctx;
    if (!ctx || !waveform || waveform.length === 0) {return;}

    const animationManager = getAnimationManager();
    let amplitude = baseAmplitude;
    if (animationManager) {
      const multiplier = animationManager.getTremoloAmplitudeMultiplier(color);
      amplitude *= multiplier;
    }

    let vibratoStretch = 0;
    const vibratoEffect = animationManager?.vibratoCanvasEffect;
    const vibratoAnimation = vibratoEffect?.animations.get(color);
    if (vibratoEffect && vibratoAnimation && vibratoEffect.shouldBeRunning()) {
      const sineValue = Math.sin(vibratoAnimation.phase);
      vibratoStretch = sineValue * vibratoAnimation.amplitude * 0.4;
    }

    let maxAmp = 0;
    for (let i = 0; i < waveform.length; i++) {
      const sampleValue = waveform[i] ?? 0;
      maxAmp = Math.max(maxAmp, Math.abs(sampleValue));
    }
    const normalizationFactor = maxAmp > 1 ? 1 / maxAmp : 1;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const baseSpread = waveform.length / width;
    const stretchedSpread = baseSpread * (1 + vibratoStretch);

    for (let x = 0; x < width; x++) {
      const shiftAmount = vibratoStretch * width * 0.3;
      const shiftedX = x + shiftAmount;
      const sampleIndex = Math.floor(shiftedX * stretchedSpread);
      const clampedIndex = Math.max(0, Math.min(waveform.length - 1, sampleIndex));
      const sample = (waveform[clampedIndex] ?? 0) * normalizationFactor;
      const y = centerY - (sample * amplitude);

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    logger.debug('DynamicWaveformVisualizer', `Drew single live waveform for ${color} with tremolo and vibrato stretch`,
      { amplitudeRatio: amplitude / baseAmplitude, vibratoStretch }, 'waveform');
  }

  private drawLayeredLiveWaveform(
    waveform: Float32Array | undefined,
    color: string,
    width: number,
    centerY: number,
    baseAmplitude: number,
    totalLayers: number
  ): void {
    const ctx = this.ctx;
    if (!ctx || !waveform || waveform.length === 0) {return;}

    const animationManager = getAnimationManager();
    let amplitude = baseAmplitude;
    if (animationManager) {
      amplitude *= animationManager.getTremoloAmplitudeMultiplier(color);
    }

    let vibratoStretch = 0;
    const vibratoEffect = animationManager?.vibratoCanvasEffect;
    const vibratoAnimation = vibratoEffect?.animations.get(color);
    if (vibratoEffect && vibratoAnimation && vibratoEffect.shouldBeRunning()) {
      const sineValue = Math.sin(vibratoAnimation.phase);
      vibratoStretch = sineValue * vibratoAnimation.amplitude * 0.4;
    }

    let maxAmp = 0;
    for (let i = 0; i < waveform.length; i++) {
      const sampleValue = waveform[i] ?? 0;
      maxAmp = Math.max(maxAmp, Math.abs(sampleValue));
    }
    const normalizationFactor = maxAmp > 1 ? 1 / maxAmp : 1;

    const alpha = Math.max(0.4, 1.0 / totalLayers);
    ctx.strokeStyle = hexToRgba(color, alpha * 2);
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const baseSpread = waveform.length / width;
    const stretchedSpread = baseSpread * (1 + vibratoStretch);

    for (let x = 0; x < width; x++) {
      const shiftAmount = vibratoStretch * width * 0.3;
      const shiftedX = x + shiftAmount;
      const sampleIndex = Math.floor(shiftedX * stretchedSpread);
      const clampedIndex = Math.max(0, Math.min(waveform.length - 1, sampleIndex));
      const sample = (waveform[clampedIndex] ?? 0) * normalizationFactor;
      const y = centerY - (sample * amplitude * 0.7);

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }

  isLiveMode(): boolean {
    return this.isPlaybackActive;
  }

  getLiveColors(): string[] {
    return Array.from(this.liveWaveforms.keys());
  }

  dispose(): void {
    this.stopLiveVisualization();
    logger.info('DynamicWaveformVisualizer', 'Disposed', null, 'waveform');
  }
}

export default DynamicWaveformVisualizer;
