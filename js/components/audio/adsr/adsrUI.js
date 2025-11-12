// js/components/ADSR/adsrUI.js

// This object will hold all the cached DOM elements.
const elements = {};

/**
 * Finds and caches all DOM elements needed for the ADSR component.
 * This should be called once when the component is initialized.
 * @returns {object} The cached DOM elements.
 */
function init() {
    elements.container = document.querySelector('#adsr-envelope');
    elements.parentContainer = elements.container.closest('.adsr-container');
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
    get elements() {
        return elements;
    }
};