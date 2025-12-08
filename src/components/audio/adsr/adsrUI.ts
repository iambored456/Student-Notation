// js/components/ADSR/adsrUI.ts

export interface ADSRElements {
  container: HTMLElement | null;
  parentContainer: HTMLElement | null;
  sustainTrack: HTMLElement | null;
  sustainThumb: HTMLElement | null;
  multiSliderContainer: HTMLElement | null;
  thumbA: HTMLElement | null;
  thumbD: HTMLElement | null;
  thumbR: HTMLElement | null;
}

// This object will hold all the cached DOM elements.
const elements: ADSRElements = {
  container: null,
  parentContainer: null,
  sustainTrack: null,
  sustainThumb: null,
  multiSliderContainer: null,
  thumbA: null,
  thumbD: null,
  thumbR: null
};

/**
 * Finds and caches all DOM elements needed for the ADSR component.
 * This should be called once when the component is initialized.
 * @returns The cached DOM elements.
 */
function init(): ADSRElements {
  elements.container = document.querySelector('#adsr-envelope');
  elements.parentContainer = elements.container?.closest('.adsr-container') || null;
  elements.sustainTrack = document.getElementById('sustain-slider-track');
  elements.sustainThumb = document.getElementById('sustain-slider-thumb');
  elements.multiSliderContainer = document.getElementById('multi-thumb-slider-container');
  elements.thumbA = document.getElementById('thumb-a');
  elements.thumbD = document.getElementById('thumb-d');
  elements.thumbR = document.getElementById('thumb-r');

  return elements;
}

export default {
  init,
  get elements(): ADSRElements {
    return elements;
  }
};
