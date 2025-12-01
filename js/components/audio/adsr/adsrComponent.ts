// js/components/ADSR/adsrComponent.ts
import store from '@state/index.ts';
import logger from '@utils/logger.ts';
import ui from './adsrUI.ts';
import type { ADSRElements } from './adsrUI.ts';
import { initInteractions } from './adsrInteractions.ts';
import { drawTempoGridlines, drawEnvelope, applyTheme } from './adsrRender.ts';
import { initPlayheadManager } from './adsrPlayhead.ts';
import GlobalService from '@services/globalService.ts';

export const BASE_ADSR_TIME_SECONDS = 2.5;

interface ADSRValues {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

interface EnvelopePoint {
  x: number;
  y: number;
}

interface NoteChangedPayload {
  newNote?: {
    color?: string;
  };
}

interface PlaybackStatePayload {
  isPlaying?: boolean;
  isPaused?: boolean;
}

interface TremoloAmplitudePayload {
  activeColors?: string[];
}

interface AudioEffectPayload {
  effectType?: string;
  color?: string;
}

class AdsrComponent {
  public ui: ADSRElements;
  public currentColor: string;
  private attack: number;
  private decay: number;
  private sustain: number;
  private release: number;
  public width: number;
  public height: number;
  private reverbCanvas: HTMLCanvasElement | null = null;
  private reverbCtx: CanvasRenderingContext2D | null = null;
  public svgContainer!: SVGSVGElement;
  private gridLayer!: SVGGElement;
  private envelopeLayer!: SVGGElement;
  public nodeLayer!: SVGGElement;
  public playheadLayer!: SVGGElement;
  private playheadManager: ReturnType<typeof initPlayheadManager>;

  constructor() {
    this.ui = ui.init();

    if (!this.ui.container) {
      logger.error('AdsrComponent', 'ADSR container element not found', null, 'adsr');
      throw new Error('ADSR container element not found');
    }

    this.currentColor = store.state.selectedNote?.color || '#4a90e2';
    this.attack = 0;
    this.decay = 0;
    this.sustain = 0;
    this.release = 0;
    this.width = 0;
    this.height = 0;

    this.createSVGLayers();
    this.resize();

    this.playheadManager = initPlayheadManager(this);
    GlobalService.adsrComponent = this;

    initInteractions(this);
    this.listenForStoreChanges();
    this.initControls();

    const container = this.ui.container;
    if (container) {
      new ResizeObserver(() => this.resize()).observe(container);
    }

    this.updateFromStore();

    logger.info('ADSR Component', 'Initialized', null, 'adsr');
  }

  resize(): void {
    if (!this.ui.container) {return;}
    this.width = this.ui.container.clientWidth;
    this.height = this.ui.container.clientHeight;

    if (this.reverbCanvas) {
      const dpr = window.devicePixelRatio || 1;
      this.reverbCanvas.width = this.width * dpr;
      this.reverbCanvas.height = this.height * dpr;
      if (this.reverbCtx) {
        this.reverbCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.reverbCtx.scale(dpr, dpr);
      }
    }

    if (this.svgContainer) {
      this.svgContainer.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    }
    this.render();
  }

  updateFromStore(): void {
    const timbre = store.state.timbres[this.currentColor];
    if (!timbre) {return;}

    const { attack, decay, sustain, release } = timbre.adsr;
    this.attack = attack;
    this.decay = decay;
    this.sustain = sustain;
    this.release = release;

    this.render();
    this.updateControls();
  }

  getCurrentMaxTime(): number {
    return BASE_ADSR_TIME_SECONDS * store.state.adsrTimeAxisScale;
  }

  initControls(): void {
    const timeScaleSlider = document.getElementById('adsr-time-scale') as HTMLInputElement | null;
    const timeScaleValue = document.getElementById('adsr-time-scale-value');

    if (timeScaleSlider && timeScaleValue) {
      timeScaleSlider.value = String(store.state.adsrTimeAxisScale);
      timeScaleValue.textContent = `${store.state.adsrTimeAxisScale}x`;

      timeScaleSlider.addEventListener('input', (event) => {
        const target = event.currentTarget as HTMLInputElement | null;
        if (!target) {return;}
        const scale = parseFloat(target.value);
        if (!Number.isFinite(scale)) {return;}
        store.setAdsrTimeAxisScale(scale);
        timeScaleValue.textContent = `${scale}x`;
      });
    }
  }

  listenForStoreChanges(): void {
    store.on('noteChanged', (payload?: NoteChangedPayload) => {
      const nextColor = payload?.newNote?.color;
      if (nextColor && nextColor !== this.currentColor) {
        this.currentColor = nextColor;
        this.updateFromStore();
      }
    });

    store.on('timbreChanged', (color?: string) => {
      if (color === this.currentColor) {
        this.updateFromStore();
      }
    });

    store.on('tempoChanged', () => this.render());

    store.on('adsrTimeAxisScaleChanged', () => {
      this.render();
      this.updateControls();
    });

    store.on('tremoloAmplitudeUpdate', (payload?: TremoloAmplitudePayload) => {
      const activeColors = payload?.activeColors;
      if (activeColors?.includes(this.currentColor)) {
        this.render();
      }
    });

    store.on('playbackStateChanged', (payload?: PlaybackStatePayload) => {
      if (!payload) {return;}
      const { isPlaying, isPaused } = payload;
      if (!isPlaying) {
        this.playheadManager.clearAll();
      } else if (isPaused) {
        this.playheadManager.pause();
      } else {
        this.playheadManager.resume();
      }
    });

    store.on('audioEffectChanged', (payload?: AudioEffectPayload) => {
      if (!payload) {return;}
      const { effectType, color } = payload;
      if (color === this.currentColor && (effectType === 'delay' || effectType === 'reverb')) {
        this.render();
      }
    });
  }

  createSVGLayers(): void {
    if (!this.ui.container) {return;}

    this.reverbCanvas = document.createElement('canvas');
    this.reverbCanvas.className = 'adsr-reverb-canvas';
    this.reverbCanvas.style.position = 'absolute';
    this.reverbCanvas.style.top = '0';
    this.reverbCanvas.style.left = '0';
    this.reverbCanvas.style.width = '100%';
    this.reverbCanvas.style.height = '100%';
    this.reverbCanvas.style.pointerEvents = 'none';
    this.ui.container.appendChild(this.reverbCanvas);
    this.reverbCtx = this.reverbCanvas.getContext('2d');

    this.svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgContainer.setAttribute('width', '100%');
    this.svgContainer.setAttribute('height', '100%');
    this.ui.container.appendChild(this.svgContainer);

    this.gridLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svgContainer.appendChild(this.gridLayer);

    this.envelopeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svgContainer.appendChild(this.envelopeLayer);

    this.nodeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svgContainer.appendChild(this.nodeLayer);

    this.playheadLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svgContainer.appendChild(this.playheadLayer);
  }

  calculateEnvelopePoints(sourceAdsr?: ADSRValues): EnvelopePoint[] {
    const { attack, decay, sustain, release } = sourceAdsr ?? {
      attack: this.attack,
      decay: this.decay,
      sustain: this.sustain,
      release: this.release
    };
    if (!this.width || !this.height) {return [];}
    const timeToX = (time: number) => (time / this.getCurrentMaxTime()) * this.width;

    let tremoloMultiplier = 1.0;
    const animationManager = window.animationEffectsManager;
    if (animationManager?.shouldTremoloBeRunning?.()) {
      tremoloMultiplier = animationManager.getADSRTremoloAmplitudeMultiplier(this.currentColor);
    }

    const originalAmplitude = window.staticWaveformVisualizer?.calculatedAmplitude ?? 1.0;
    const normalizedAmplitude = originalAmplitude * tremoloMultiplier;

    logger.debug('AdsrComponent', '[ADSR] Amplitude calculation', {
      originalAmplitude,
      tremoloMultiplier,
      normalizedAmplitude
    });

    const p1: EnvelopePoint = { x: 0, y: this.height };
    const p2: EnvelopePoint = { x: timeToX(attack), y: this.height * (1 - normalizedAmplitude) };
    const p3: EnvelopePoint = {
      x: timeToX(attack + decay),
      y: this.height * (1 - Math.min(sustain * normalizedAmplitude, normalizedAmplitude))
    };
    const p4: EnvelopePoint = { x: timeToX(attack + decay + release), y: this.height };
    return [p1, p2, p3, p4];
  }

  render(): void {
    if (!this.width || !this.height || !this.gridLayer || !this.envelopeLayer || !this.nodeLayer) {return;}
    const dimensions = { width: this.width, height: this.height };
    const points = this.calculateEnvelopePoints();
    const maxTime = this.getCurrentMaxTime();
    drawTempoGridlines(this.gridLayer, dimensions, maxTime);
    drawEnvelope(this.envelopeLayer, this.nodeLayer, points, dimensions, this.currentColor, maxTime, this.reverbCtx);
    applyTheme(this.ui.parentContainer, this.currentColor);
  }

  updateControls(): void {
    const {
      sustainThumb,
      sustainTrack,
      thumbA,
      thumbD,
      thumbR,
      multiSliderContainer
    } = this.ui;

    if (!sustainThumb || !sustainTrack || !thumbA || !thumbD || !thumbR || !multiSliderContainer) {
      return;
    }

    const currentTimbre = store.state.timbres[this.currentColor];
    if (!currentTimbre) {return;}

    let tremoloMultiplier = 1.0;
    const animationManager = window.animationEffectsManager;
    if (animationManager?.shouldTremoloBeRunning?.()) {
      tremoloMultiplier = animationManager.getADSRTremoloAmplitudeMultiplier(this.currentColor);
    }

    const originalAmplitude = window.staticWaveformVisualizer?.calculatedAmplitude || 1.0;
    const normalizedAmplitude = originalAmplitude * tremoloMultiplier;
    const maxSustainPercent = normalizedAmplitude * 100;

    if (this.sustain > normalizedAmplitude) {
      store.setADSR(this.currentColor, { ...currentTimbre.adsr, sustain: normalizedAmplitude });
      this.sustain = normalizedAmplitude;
    }

    const sustainPercent = this.sustain * 100;
    sustainThumb.style.bottom = `${sustainPercent}%`;
    sustainTrack.style.setProperty('--sustain-progress', `${sustainPercent}%`);

    const ineligiblePercent = 100 - maxSustainPercent;
    sustainTrack.style.setProperty('--ineligible-height', `${ineligiblePercent}%`);

    const maxTime = this.getCurrentMaxTime();
    const aPercent = (this.attack / maxTime) * 100;
    const dPercent = ((this.attack + this.decay) / maxTime) * 100;
    const rPercent = ((this.attack + this.decay + this.release) / maxTime) * 100;

    thumbA.style.left = `${aPercent}%`;
    thumbD.style.left = `${dPercent}%`;
    thumbR.style.left = `${rPercent}%`;
    multiSliderContainer.style.setProperty('--adr-progress', `${rPercent}%`);

    const formatTime = (t: number) => `${t.toFixed(3)}s`;
    const formatSustain = (s: number) => `${(s * 100).toFixed(0)}%`;

    thumbA.title = `Attack: ${formatTime(this.attack)}`;
    thumbD.title = `Decay: ${formatTime(this.decay)}`;
    thumbR.title = `Release: ${formatTime(this.release)}`;
    sustainThumb.title = `Sustain: ${formatSustain(this.sustain)}`;

    const attackNodeTitle = this.nodeLayer.querySelector<SVGTitleElement>('#attack-node > title');
    if (attackNodeTitle) {
      attackNodeTitle.textContent = `Attack: ${formatTime(this.attack)}`;
    }
    const decaySustainNodeTitle = this.nodeLayer.querySelector<SVGTitleElement>('#decay-sustain-node > title');
    if (decaySustainNodeTitle) {
      decaySustainNodeTitle.textContent = `Decay: ${formatTime(this.decay)}\nSustain: ${formatSustain(this.sustain)}`;
    }
    const releaseNodeTitle = this.nodeLayer.querySelector<SVGTitleElement>('#release-node > title');
    if (releaseNodeTitle) {
      releaseNodeTitle.textContent = `Release: ${formatTime(this.release)}`;
    }
  }
}

export function initAdsrComponent(): AdsrComponent | null {
  if (!document.getElementById('adsr-envelope')) {return null;}
  return new AdsrComponent();
}

export default AdsrComponent;
