// js/components/StaticWaveform/staticWaveformVisualizer.ts
import store from '@state/index.ts';
import { HARMONIC_BINS } from '@/core/constants.ts';
import { hexToRgba } from '@utils/colorUtils.ts';
import { getFilteredCoefficients } from '@components/audio/harmonicsFilter/harmonicBins.ts';
import DynamicWaveformVisualizer from '../dynamicWaveform/dynamicWaveformVisualizer.ts';
import logger from '@utils/logger.ts';

interface NoteChangedPayload {
  newNote?: {
    color?: string;
  };
}

interface AnimationEffectsManagerLike {
  getADSRTremoloAmplitudeMultiplier?: (color: string) => number;
}

const MAX_SAMPLES = 512;
const STANDARD_DEGREES = 360;
const EXTENDED_DEGREES = 480;

const getAnimationManager = (): AnimationEffectsManagerLike | undefined => {
  return (window as Window & { animationEffectsManager?: AnimationEffectsManagerLike }).animationEffectsManager;
};

logger.moduleLoaded('StaticWaveformVisualizer');

class StaticWaveformVisualizer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  public currentColor: string | null = null;
  private animationFrameId: number | null = null;
  private waveformData: Float32Array = new Float32Array(MAX_SAMPLES);
  private isInitialized = false;

  private isTransitioning = false;
  private transitionStartTime = 0;
  private readonly transitionDuration = 300;
  private fromWaveform: Float32Array | null = null;
  private toWaveform: Float32Array | null = null;
  private transitionAnimationId: number | null = null;

  private readonly dynamicVisualizer = new DynamicWaveformVisualizer();
  private animationSpeed = 100;
  private frameSkipCounter = 0;
  private resizeObserver: ResizeObserver | null = null;

  public calculatedAmplitude = 0;

  constructor() {
    logger.info('StaticWaveformVisualizer', 'Initialized with dynamic visualizer integration', null, 'waveform');
  }

  initialize(): boolean {
    this.canvas = document.getElementById('static-waveform-canvas') as HTMLCanvasElement | null;
    if (!this.canvas) {return false;}

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {return false;}

    this.ctx = ctx;
    this.currentColor = store.state.selectedNote?.color || '#4a90e2';

    const container = this.canvas.parentElement;
    if (container && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
    }

    this.resize();
    this.setupEventListeners();

    this.dynamicVisualizer.initialize(this.canvas, this.ctx);
    this.dynamicVisualizer.onWaveformUpdate = () => this.draw();

    this.generateWaveform();
    this.isInitialized = true;
    return true;
  }

  resize(): void {
    if (!this.canvas || !this.ctx) {return;}

    const container = this.canvas.parentElement;
    if (!container) {return;}

    const { clientWidth, clientHeight } = container;
    const currentCanvasWidth = this.canvas.width;
    const currentCanvasHeight = this.canvas.height;

    const shouldSkipResize = (clientWidth === 0 || clientHeight === 0) &&
      (this.canvas.width > 0 && this.canvas.height > 0);

    if (shouldSkipResize) {return;}

    const widthDiff = Math.abs(clientWidth - currentCanvasWidth);
    const heightDiff = Math.abs(clientHeight - currentCanvasHeight);
    const significantChange = widthDiff > 2 || heightDiff > 2;

    if (significantChange) {
      this.canvas.width = clientWidth;
      this.canvas.height = clientHeight;
      this.draw();
    }
  }

  private setupEventListeners(): void {
    store.on('noteChanged', (payload: NoteChangedPayload = {}) => {
      const nextColor = payload.newNote?.color;
      if (nextColor && nextColor !== this.currentColor) {
        this.currentColor = nextColor;
        this.generateWaveform();
      }
    });

    store.on('timbreChanged', (color?: string) => {
      if (color && color === this.currentColor) {
        this.generateWaveform();
      }
    });

    store.on('waveformExtendedViewChanged', () => {
      this.generateWaveform();
      this.updateToggleButton();
    });

    const tabButtons = document.querySelectorAll<HTMLElement>('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabId = button.dataset['tab'];
        if (tabId === 'timbre') {
          setTimeout(() => this.resize(), 100);
        }
      });
    });

    this.setupSpeedControls();
    this.setupExtendToggle();
  }

  private setupSpeedControls(): void {
    const speedButtons = Array.from(document.querySelectorAll<HTMLElement>('.waveform-speed-btn'));
    if (speedButtons.length === 0) {return;}

    speedButtons.forEach(button => {
      button.addEventListener('click', () => {
        const speedAttr = button.dataset['speed'];
        const speed = speedAttr ? parseInt(speedAttr, 10) : NaN;
        if (!Number.isFinite(speed)) {return;}

        if (button.classList.contains('active')) {
          button.classList.remove('active');
          this.setAnimationSpeed(100);
        } else {
          speedButtons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          this.setAnimationSpeed(speed);
        }
      });
    });
  }

  private setAnimationSpeed(percentage: number): void {
    if (!Number.isFinite(percentage)) {return;}
    this.animationSpeed = percentage;
    this.frameSkipCounter = 0;
    this.dynamicVisualizer.setAnimationSpeed(percentage);
  }

  private setupExtendToggle(): void {
    const toggleButton = document.getElementById('waveform-extend-toggle');
    if (!(toggleButton instanceof HTMLElement)) {return;}

    toggleButton.addEventListener('click', () => {
      store.toggleWaveformExtendedView();
    });

    this.updateToggleButton();
  }

  private updateToggleButton(): void {
    const toggleButton = document.getElementById('waveform-extend-toggle');
    if (!(toggleButton instanceof HTMLElement)) {return;}

    const isExtended = store.state.waveformExtendedView;
    toggleButton.classList.toggle('extended', isExtended);
    toggleButton.textContent = isExtended ? '480° View' : '360° View';
    toggleButton.title = isExtended ? 'Switch to 360° waveform view' : 'Switch to 480° waveform view (shows extra 120°)';
  }

  generateWaveform(): void {
    if (this.isTransitioning || !this.currentColor) {return;}

    const timbre = store.state.timbres[this.currentColor];
    if (!timbre?.coeffs) {return;}

    const coeffs = getFilteredCoefficients(this.currentColor) as Float32Array;
    const phases = timbre.phases ?? new Float32Array(HARMONIC_BINS);
    const numSamples = this.waveformData.length;

    this.waveformData.fill(0);

    let maxGeneratedAmp = 0;
    for (let sample = 0; sample < numSamples; sample++) {
      const maxDegrees = store.state.waveformExtendedView ? EXTENDED_DEGREES : STANDARD_DEGREES;
      const phaseMultiplier = maxDegrees / STANDARD_DEGREES;
      const phase = (sample / numSamples) * phaseMultiplier * 2 * Math.PI;
      let amplitude = 0;

      for (let i = 0; i < HARMONIC_BINS; i++) {
        const coeff = coeffs[i] ?? 0;
        if (coeff <= 0.001) {continue;}
        const phaseOffset = phases[i] ?? 0;
        const harmonicMultiplier = i + 1;
        amplitude += coeff * Math.sin(harmonicMultiplier * phase + phaseOffset);
      }

      this.waveformData[sample] = amplitude;
      maxGeneratedAmp = Math.max(maxGeneratedAmp, Math.abs(amplitude));
    }

    this.calculatedAmplitude = Math.min(1, maxGeneratedAmp);

    if (maxGeneratedAmp > 1) {
      const normalizationFactor = 1 / maxGeneratedAmp;
      for (let i = 0; i < this.waveformData.length; i++) {
        const value = this.waveformData[i] ?? 0;
        this.waveformData[i] = value * normalizationFactor;
      }
    }

    this.draw();
  }

  startPhaseTransition(fromPhases: Float32Array, toPhases: Float32Array, _changedIndex?: number): void {
    if (!this.isInitialized || !this.currentColor) {return;}

    if (this.isTransitioning && this.transitionAnimationId) {
      cancelAnimationFrame(this.transitionAnimationId);
    }

    this.fromWaveform = new Float32Array(this.waveformData);
    this.generateTargetWaveform(toPhases);
    this.toWaveform = new Float32Array(this.waveformData);
    this.waveformData = this.fromWaveform;

    this.isTransitioning = true;
    this.transitionStartTime = performance.now();
    this.animateTransition();
  }

  private generateTargetWaveform(targetPhases: Float32Array | number[] | null | undefined): void {
    if (!this.currentColor || !targetPhases) {return;}

    const timbre = store.state.timbres[this.currentColor];
    if (!timbre?.coeffs) {return;}

    const coeffs = getFilteredCoefficients(this.currentColor) as Float32Array;
    const phasesArray = targetPhases instanceof Float32Array ? targetPhases : new Float32Array(targetPhases);
    const numSamples = this.waveformData.length;

    this.waveformData.fill(0);
    let maxGeneratedAmp = 0;

    for (let sample = 0; sample < numSamples; sample++) {
      const maxDegrees = store.state.waveformExtendedView ? EXTENDED_DEGREES : STANDARD_DEGREES;
      const phaseMultiplier = maxDegrees / STANDARD_DEGREES;
      const phase = (sample / numSamples) * phaseMultiplier * 2 * Math.PI;
      let amplitude = 0;

      for (let i = 0; i < HARMONIC_BINS; i++) {
        const coeff = coeffs[i] ?? 0;
        if (coeff <= 0.001) {continue;}
        const phaseOffset = phasesArray[i] ?? 0;
        const harmonicMultiplier = i + 1;
        amplitude += coeff * Math.sin(harmonicMultiplier * phase + phaseOffset);
      }

      this.waveformData[sample] = amplitude;
      maxGeneratedAmp = Math.max(maxGeneratedAmp, Math.abs(amplitude));
    }

    this.calculatedAmplitude = Math.min(1, maxGeneratedAmp);

    if (maxGeneratedAmp > 1) {
      const normalizationFactor = 1 / maxGeneratedAmp;
      for (let i = 0; i < this.waveformData.length; i++) {
        const value = this.waveformData[i] ?? 0;
        this.waveformData[i] = value * normalizationFactor;
      }
    }
  }

  private animateTransition(): void {
    const fromWaveform = this.fromWaveform;
    const toWaveform = this.toWaveform;
    if (!this.isTransitioning || !fromWaveform || !toWaveform) {return;}

    const elapsed = performance.now() - this.transitionStartTime;
    const progress = Math.min(elapsed / this.transitionDuration, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    for (let i = 0; i < this.waveformData.length; i++) {
      const fromValue = fromWaveform[i] ?? 0;
      const toValue = toWaveform[i] ?? 0;
      this.waveformData[i] = fromValue + (toValue - fromValue) * easedProgress;
    }

    this.draw();

    if (progress >= 1) {
      this.isTransitioning = false;
      this.fromWaveform = null;
      this.toWaveform = null;
      this.transitionAnimationId = null;
    } else {
      this.transitionAnimationId = requestAnimationFrame(() => this.animateTransition());
    }
  }

  normalizeWaveform(): void {
    let maxAmp = 0;
    for (let i = 0; i < this.waveformData.length; i++) {
      const value = this.waveformData[i] ?? 0;
      maxAmp = Math.max(maxAmp, Math.abs(value));
    }

    if (maxAmp > 0) {
      const normalizer = 0.9 / maxAmp;
      for (let i = 0; i < this.waveformData.length; i++) {
        const value = this.waveformData[i] ?? 0;
        this.waveformData[i] = value * normalizer;
      }
    }
  }

  draw(): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) {return;}

    const { width, height } = canvas;
    const centerY = height / 2;
    const amplitude = height / 2;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    this.drawGrid(width, height, centerY, amplitude);

    if (this.dynamicVisualizer.isLiveMode()) {
      this.dynamicVisualizer.drawLiveWaveforms(width, centerY, amplitude);
    } else {
      this.drawWaveform(width, centerY, amplitude);
    }

    if (width > 200 && height > 100) {
      this.drawLabels(width, height);
    }
  }

  private drawGrid(width: number, height: number, centerY: number, amplitude: number): void {
    const ctx = this.ctx;
    if (!ctx) {return;}
    ctx.strokeStyle = '#ced4da';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);

    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    const maxDegrees = store.state.waveformExtendedView ? EXTENDED_DEGREES : STANDARD_DEGREES;
    const gridDegrees = store.state.waveformExtendedView ? [90, 180, 270, 360, 450] : [90, 180, 270];

    gridDegrees.forEach(degree => {
      const x = (width / maxDegrees) * degree;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });

    if (store.state.waveformExtendedView) {
      const deg360Position = (width / EXTENDED_DEGREES) * STANDARD_DEGREES;
      ctx.fillStyle = 'rgba(128, 128, 128, 0.15)';
      ctx.fillRect(deg360Position, 0, width - deg360Position, height);
    }

    const ampLines = [0.5];
    ampLines.forEach(amp => {
      const y1 = centerY - (amplitude * amp);
      const y2 = centerY + (amplitude * amp);

      ctx.beginPath();
      ctx.moveTo(0, y1);
      ctx.lineTo(width, y1);
      ctx.moveTo(0, y2);
      ctx.lineTo(width, y2);
      ctx.stroke();
    });

    ctx.setLineDash([]);
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 1;

    const maxY = centerY - amplitude;
    const minY = centerY + amplitude;

    ctx.beginPath();
    ctx.moveTo(0, maxY);
    ctx.lineTo(width, maxY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, minY);
    ctx.lineTo(width, minY);
    ctx.stroke();
  }

  private drawWaveform(width: number, centerY: number, amplitude: number): void {
    const ctx = this.ctx;
    if (!ctx || this.waveformData.length === 0) {return;}

    const color = this.currentColor || '#4a90e2';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const samplesPerPixel = this.waveformData.length / width;

    for (let x = 0; x < width; x++) {
      const sampleIndex = Math.floor(x * samplesPerPixel);
      const sample = this.waveformData[sampleIndex] || 0;
      const y = centerY - (sample * amplitude);

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
    ctx.lineTo(width, centerY);
    ctx.lineTo(0, centerY);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, centerY - amplitude, 0, centerY + amplitude);
    gradient.addColorStop(0, hexToRgba(color, 0.3));
    gradient.addColorStop(0.5, hexToRgba(color, 0.1));
    gradient.addColorStop(1, hexToRgba(color, 0.3));

    ctx.fillStyle = gradient;
    ctx.fill();
  }

  private drawLabels(width: number, height: number): void {
    const ctx = this.ctx;
    if (!ctx) {return;}
    const isExtended = store.state.waveformExtendedView;
    const maxDegrees = isExtended ? EXTENDED_DEGREES : STANDARD_DEGREES;
    const labels = isExtended ? ['0°', '90°', '180°', '270°', '360°', '450°'] : ['0°', '90°', '180°', '270°', '360°'];
    const degrees = isExtended ? [0, 90, 180, 270, 360, 450] : [0, 90, 180, 270, 360];

    ctx.fillStyle = '#666666';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';

    labels.forEach((label, index) => {
      const degreeValue = degrees[index] ?? 0;
      const x = (width / maxDegrees) * degreeValue + 10;
      ctx.fillText(label, x, height / 2 + 4);
    });

    ctx.textAlign = 'left';
    ctx.fillText('+1.0', 5, 15);
    ctx.fillText('-1.0', 5, height - 8);
  }

  getNormalizedAmplitude(): number {
    return this.calculatedAmplitude || 0;
  }

  getADSRTremoloAmplitude(): number {
    const baseAmplitude = this.calculatedAmplitude || 0;
    const animationManager = getAnimationManager();
    if (this.currentColor && animationManager?.getADSRTremoloAmplitudeMultiplier) {
      const tremoloMultiplier = animationManager.getADSRTremoloAmplitudeMultiplier(this.currentColor);
      return baseAmplitude * tremoloMultiplier;
    }
    return baseAmplitude;
  }

  startSingleNoteVisualization(color: string): void {
    this.dynamicVisualizer.startSingleNoteVisualization(color);
  }

  stopLiveVisualization(): void {
    this.dynamicVisualizer.stopLiveVisualization();
  }

  startLiveVisualization(): void {
    this.dynamicVisualizer.startLiveVisualization();
  }

  dispose(): void {
    this.dynamicVisualizer.dispose();

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.transitionAnimationId) {
      cancelAnimationFrame(this.transitionAnimationId);
      this.transitionAnimationId = null;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.isTransitioning = false;
    this.fromWaveform = null;
    this.toWaveform = null;
    this.isInitialized = false;
  }
}

const staticWaveformVisualizer = new StaticWaveformVisualizer();
window.staticWaveformVisualizer = staticWaveformVisualizer;

export function initStaticWaveformVisualizer(): boolean {
  return staticWaveformVisualizer.initialize();
}

export default staticWaveformVisualizer;
