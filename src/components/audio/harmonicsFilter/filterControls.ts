// js/components/Harmonics-Filter/filterControls.js
import store from '@state/index.ts';
import logger from '@utils/logger.ts';

interface FilterSettings {
  enabled?: boolean;
  blend?: number;
  cutoff?: number;
  resonance?: number;
  type?: string;
  mix?: number;
}

const filterControlsDebug: { level: string; args: unknown[]; timestamp: number }[] = [];

function recordFilterControlsDebug(level: string, ...args: unknown[]) {
  filterControlsDebug.push({ level, args, timestamp: Date.now() });
}

let blendThumb: HTMLElement | null,
  blendTrack: HTMLElement | null,
  cutoffThumb: HTMLElement | null,
  cutoffTrack: HTMLElement | null,
  container: HTMLElement | null;
let verticalBlendSlider: HTMLElement | null, verticalBlendTrack: HTMLElement | null;
let isDraggingCutoff = false;
let isDraggingBlend = false;
let isDraggingVerticalBlend = false;
let currentColor: string | null;

const CUTOFF_MIN = 1;
const CUTOFF_MAX = 31;
const BLEND_MIN = 0;
const BLEND_MAX = 2;

function getFilterState(): FilterSettings | null {
  if (!currentColor) {return null;}
  const timbre = store.state.timbres[currentColor];
  if (!timbre) {return null;}
  if (!timbre.filter) {
    timbre.filter = { enabled: true, blend: 0.0, cutoff: 16, resonance: 0, type: 'lowpass', mix: 0 };
  } else if (timbre.filter.enabled === undefined) {
    timbre.filter.enabled = true;
  }
  return timbre.filter;
}

function updateFromStore() {
  const filter = getFilterState();
  if (!filter) {return;}

  const { cutoff = 16, blend = 0, mix = 0 } = filter;

  if (blendThumb && blendTrack) {
    const blendPercent = (BLEND_MAX - blend) / (BLEND_MAX - BLEND_MIN);
    blendThumb.style.left = `${blendPercent * 100}%`;
    blendTrack.style.setProperty('--progress', `${blendPercent * 100}%`);
  }

  if (verticalBlendSlider && verticalBlendTrack) {
    const mixPercent = (mix || 0) / 100;
    verticalBlendSlider.style.bottom = `${mixPercent * 100}%`;
    verticalBlendTrack.style.setProperty('--blend-progress', `${mixPercent * 100}%`);
  }

  if (cutoffThumb && cutoffTrack) {
    const cutoffPercent = (cutoff - CUTOFF_MIN) / (CUTOFF_MAX - CUTOFF_MIN);
    cutoffThumb.style.left = `${cutoffPercent * 100}%`;
    cutoffThumb.style.top = '50%';
    cutoffThumb.style.transform = 'translate(-50%, -50%)';
    cutoffTrack.style.setProperty('--progress', `${cutoffPercent * 100}%`);
  }

  if (container && currentColor) {container.style.setProperty('--c-accent', currentColor);}
}

function handleCutoffDrag(e: PointerEvent) {
  if (!isDraggingCutoff || !currentColor || !cutoffTrack) {return;}
  const rect = cutoffTrack.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const w = rect.width;
  let percent = x / w;
  percent = Math.max(0, Math.min(1, percent));
  const value = percent * (CUTOFF_MAX - CUTOFF_MIN) + CUTOFF_MIN;
  store.setFilterSettings(currentColor, { cutoff: value });
}

function handleBlendDrag(e: PointerEvent) {
  if (!isDraggingBlend || !currentColor || !blendTrack) {return;}
  const rect = blendTrack.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const w = rect.width;
  let percent = x / w;
  percent = Math.max(0, Math.min(1, percent));
  const value = BLEND_MAX - (percent * (BLEND_MAX - BLEND_MIN));
  store.setFilterSettings(currentColor, { blend: value });
}

function handleVerticalBlendDrag(e: PointerEvent) {
  if (!isDraggingVerticalBlend || !currentColor || !verticalBlendTrack) {return;}
  const rect = verticalBlendTrack.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const h = rect.height;
  let percent = 1 - (y / h);
  percent = Math.max(0, Math.min(1, percent));
  const value = percent * 100;
  store.setFilterSettings(currentColor, { mix: value });
}

export function getFilterControlsDebugMessages() {
  return filterControlsDebug.slice();
}

export function initFilterControls() {
  container = document.querySelector('.filter-container');
  blendThumb = document.getElementById('thumb-b');
  blendTrack = document.getElementById('blend-slider-container');
  cutoffThumb = document.getElementById('thumb-c');
  cutoffTrack = document.getElementById('cutoff-slider-container');

  if (!container || !blendThumb || !cutoffThumb) {
    logger.error('FilterControls', 'Missing required elements', { container, blendThumb, cutoffThumb }, 'filter');
    return;
  }

  createVerticalBlendSlider();

  blendThumb.addEventListener('pointerdown', e => {
    recordFilterControlsDebug('log', '[BLEND SLIDER] Pointerdown on blend thumb');
    e.preventDefault();
    isDraggingBlend = true;
    document.body.style.cursor = 'ew-resize';
    const onMove = (ev: PointerEvent) => {
      recordFilterControlsDebug('log', '[BLEND SLIDER] Moving', { clientX: ev.clientX });
      handleBlendDrag(ev);
    };
    const onUp = () => {
      recordFilterControlsDebug('log', '[BLEND SLIDER] Pointerup');
      isDraggingBlend = false;
      document.body.style.cursor = 'default';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      store.recordState();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });

  cutoffThumb.addEventListener('pointerdown', e => {
    recordFilterControlsDebug('log', '[CUTOFF SLIDER] Pointerdown on cutoff thumb');
    e.preventDefault();
    isDraggingCutoff = true;
    document.body.style.cursor = 'ew-resize';
    const onMove = (ev: PointerEvent) => {
      recordFilterControlsDebug('log', '[CUTOFF SLIDER] Moving', { clientX: ev.clientX });
      handleCutoffDrag(ev);
    };
    const onUp = () => {
      recordFilterControlsDebug('log', '[CUTOFF SLIDER] Pointerup');
      isDraggingCutoff = false;
      document.body.style.cursor = 'default';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      store.recordState();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });

  store.on('noteChanged', ({ newNote }: { newNote: { color?: string } }) => {
    if (newNote.color && newNote.color !== currentColor) {
      currentColor = newNote.color;
      updateFromStore();
    }
  });

  store.on('timbreChanged', (color: string) => {
    if (color === currentColor) {
      updateFromStore();
    }
  });

  currentColor = store.state.selectedNote?.color || '#4a90e2';
  updateFromStore();
}

function createVerticalBlendSlider() {
  verticalBlendTrack = document.getElementById('vertical-blend-track');
  verticalBlendSlider = document.getElementById('vertical-blend-thumb');

  if (!verticalBlendTrack || !verticalBlendSlider) {
    logger.error('FilterControls', 'Vertical blend slider elements not found', null, 'filter');
    return;
  }

  verticalBlendSlider.addEventListener('pointerdown', e => {
    recordFilterControlsDebug('log', '[VERTICAL BLEND] Pointerdown on M thumb');
    e.preventDefault();
    isDraggingVerticalBlend = true;
    document.body.style.cursor = 'ns-resize';

    const onMove = (ev: PointerEvent) => {
      recordFilterControlsDebug('log', '[VERTICAL BLEND] Moving', { clientY: ev.clientY });
      handleVerticalBlendDrag(ev);
    };

    const onUp = () => {
      recordFilterControlsDebug('log', '[VERTICAL BLEND] Pointerup');
      isDraggingVerticalBlend = false;
      document.body.style.cursor = 'default';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      store.recordState();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
}
