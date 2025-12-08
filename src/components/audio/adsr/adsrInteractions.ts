// js/components/ADSR/adsrInteractions.ts
import store from '@state/index.ts';
import logger from '@utils/logger.ts';
import { BASE_ADSR_TIME_SECONDS } from './adsrComponent.ts';
import type { ADSRElements } from './adsrUI.ts';

interface AbsoluteTimes {
  a: number;
  d: number;
  r: number;
}

interface ADSRComponent {
  currentColor: string;
  ui: ADSRElements;
  svgContainer: SVGSVGElement;
  nodeLayer: SVGGElement;
  width: number;
  height: number;
}

function getCurrentMaxTime(): number {
  return BASE_ADSR_TIME_SECONDS * store.state.adsrTimeAxisScale;
}

/**
 * Derives new attack, decay, and release values from absolute time points
 * and updates the store. This is the single source of truth for ADSR time calculations.
 * @param newTimes - An object with {a, d, r} absolute time values.
 * @param component - The main ADSR component instance.
 */
function updateADSRFromAbsoluteTimes(newTimes: AbsoluteTimes, component: ADSRComponent): void {
  const timbre = store.state.timbres[component.currentColor];
  if (!timbre) {return;}
  const { sustain } = timbre.adsr;

  // 1. Ensure times are ordered and have a minimum gap to prevent overlaps.
  const MIN_GAP = 0.01; // 10ms minimum duration for each stage
  newTimes.d = Math.max(newTimes.a + MIN_GAP, newTimes.d);
  newTimes.r = Math.max(newTimes.d + MIN_GAP, newTimes.r);

  // 2. Derive new durations from the validated absolute times.
  const newAttack = newTimes.a;
  const newDecay = newTimes.d - newTimes.a;
  const newRelease = newTimes.r - newTimes.d;

  // 3. Final safety check for NaN before committing to the store.
  if (isNaN(newAttack) || isNaN(newDecay) || isNaN(newRelease)) {
    logger.error('AdsrInteractions', 'NaN value detected before setting ADSR. Aborting update.', { newAttack, newDecay, newRelease }, 'audio');
    return;
  }

  store.setADSR(component.currentColor, {
    attack: newAttack,
    decay: newDecay,
    release: newRelease,
    sustain: sustain // Sustain is not changed by the time sliders/nodes
  });
}

function initSustainSlider(elements: ADSRElements, component: ADSRComponent): void {
  let isDragging = false;

  const handleDrag = (e: PointerEvent): void => {
    if (!isDragging || !elements.sustainTrack) {return;}
    const rect = elements.sustainTrack.getBoundingClientRect();
    const y = e.clientY - rect.top;
    let percent = 100 - (y / rect.height) * 100;
    percent = Math.max(0, Math.min(100, percent));

    // Constrain sustain to normalized amplitude
    const normalizedAmplitude = (window as any).staticWaveformVisualizer?.getNormalizedAmplitude() || 1.0;
    const maxSustainPercent = normalizedAmplitude * 100;
    percent = Math.min(percent, maxSustainPercent);

    const currentTimbre = store.state.timbres[component.currentColor];
    if (!currentTimbre) {return;}
    store.setADSR(component.currentColor, { ...currentTimbre.adsr, sustain: percent / 100 });
  };

  const startDrag = (e: PointerEvent): void => {
    isDragging = true;
    handleDrag(e); // Call immediately for click-to-position behavior
  };

  const stopDrag = (): void => { isDragging = false; };

  elements.sustainTrack?.addEventListener('pointerdown', startDrag);
  document.addEventListener('pointermove', handleDrag);
  document.addEventListener('pointerup', stopDrag);
}

function initMultiThumbSlider(elements: ADSRElements, component: ADSRComponent): void {
  let activeThumb: HTMLElement | null = null;

  const handleDrag = (e: PointerEvent): void => {
    if (!activeThumb || !elements.multiSliderContainer) {return;}

    const rect = elements.multiSliderContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let percent = (x / rect.width) * 100;
    percent = Math.max(0, Math.min(100, percent));

    const timeVal = (percent / 100) * getCurrentMaxTime();

    const timbre = store.state.timbres[component.currentColor];
    if (!timbre) {return;}
    const { attack, decay, release } = timbre.adsr;
    const currentTimes: AbsoluteTimes = {
      a: attack,
      d: attack + decay,
      r: attack + decay + release
    };

    if (activeThumb.id === 'thumb-a') {currentTimes.a = timeVal;}
    if (activeThumb.id === 'thumb-d') {currentTimes.d = timeVal;}
    if (activeThumb.id === 'thumb-r') {currentTimes.r = timeVal;}

    updateADSRFromAbsoluteTimes(currentTimes, component);
  };

  const startDrag = (e: PointerEvent): void => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('time-slider-thumb')) {
      activeThumb = target;
      handleDrag(e); // Call immediately
    }
  };

  const stopDrag = (): void => { activeThumb = null; };

  elements.multiSliderContainer?.addEventListener('pointerdown', startDrag);
  document.addEventListener('pointermove', handleDrag);
  document.addEventListener('pointerup', stopDrag);
}

function initNodeDragging(elements: ADSRElements, component: ADSRComponent): void {
  let activeNode: SVGElement | null = null;

  const handleDrag = (e: PointerEvent): void => {
    if (!activeNode) {return;}
    const svg = component.svgContainer;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const screenCTM = svg.getScreenCTM();
    if (!screenCTM) {return;}
    const svgP = pt.matrixTransform(screenCTM.inverse());

    let xPercent = (svgP.x / component.width) * 100;
    let yPercent = 1 - (svgP.y / component.height);
    xPercent = Math.max(0, Math.min(100, xPercent));
    yPercent = Math.max(0, Math.min(1, yPercent));

    const timeVal = (xPercent / 100) * getCurrentMaxTime();
    const currentTimbre = store.state.timbres[component.currentColor];
    if (!currentTimbre) {return;}
    const { attack, decay, release } = currentTimbre.adsr;
    let sustain = currentTimbre.adsr.sustain;

    const currentTimes: AbsoluteTimes = {
      a: attack,
      d: attack + decay,
      r: attack + decay + release
    };

    switch(activeNode.id) {
      case 'attack-node':
        // Attack node: only allow X movement (time), Y is controlled by normalized amplitude
        currentTimes.a = timeVal;
        // Don't update sustain or Y position - it's locked to normalized amplitude
        break;
      case 'decay-sustain-node': {
        currentTimes.d = timeVal;
        // Get normalized amplitude to constrain sustain level
        const normalizedAmplitude = (window as any).staticWaveformVisualizer?.getNormalizedAmplitude() || 1.0;
        sustain = Math.min(yPercent, normalizedAmplitude); // Constrain sustain to normalized amplitude
        break;
      }
      case 'release-node':
        currentTimes.r = timeVal;
        break;
    }

    // Update sustain separately if needed
    const oldTimbre = store.state.timbres[component.currentColor];
    if (!oldTimbre) {return;}
    const oldSustain = oldTimbre.adsr.sustain;
    if (sustain !== oldSustain) {
      store.setADSR(component.currentColor, { attack, decay, release, sustain });
    }

    updateADSRFromAbsoluteTimes(currentTimes, component);
  };

  const startDrag = (e: PointerEvent): void => {
    const target = e.target as SVGElement;
    if (target.classList.contains('adsr-node')) {
      activeNode = target;
      activeNode.style.cursor = 'grabbing';
      handleDrag(e);
    }
  };

  const stopDrag = (): void => {
    if (activeNode) {
      activeNode.style.cursor = 'grab';
      activeNode = null;
    }
  };

  component.nodeLayer.addEventListener('pointerdown', startDrag);
  document.addEventListener('pointermove', handleDrag);
  document.addEventListener('pointerup', stopDrag);
}

export function initInteractions(component: ADSRComponent): void {
  const elements = component.ui;
  initSustainSlider(elements, component);
  initMultiThumbSlider(elements, component);
  initNodeDragging(elements, component);
}
