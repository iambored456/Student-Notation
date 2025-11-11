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

    // Log ADSR container dimensions
    if (elements.parentContainer) {
        logADSRDimensions();

        // Log on resize
        const resizeObserver = new ResizeObserver(() => {
            logADSRDimensions();
        });
        resizeObserver.observe(elements.parentContainer);
    }

    return elements;
}

function logADSRDimensions() {
    const container = elements.parentContainer;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const computed = window.getComputedStyle(container);

    // Get parent chain
    const parent = container.parentElement;
    const grandparent = parent?.parentElement;

    const parentComputed = parent ? window.getComputedStyle(parent) : null;
    const gpComputed = grandparent ? window.getComputedStyle(grandparent) : null;

    console.log('=== ADSR Layout Chain ===');
    console.log('Container:', {
        width: rect.width,
        classes: container.className,
        'max-width': computed.maxWidth,
        'min-width': computed.minWidth,
        flex: computed.flex,
        display: computed.display,
        'grid-template-columns': computed.gridTemplateColumns
    });
    console.log('Parent:', {
        name: parent?.className,
        width: parent?.getBoundingClientRect().width,
        display: parentComputed?.display,
        'flex-direction': parentComputed?.flexDirection,
        flex: parentComputed?.flex
    });
    console.log('Grandparent:', {
        name: grandparent?.className,
        width: grandparent?.getBoundingClientRect().width,
        display: gpComputed?.display,
        'flex-direction': gpComputed?.flexDirection
    });
    console.log('Window width:', window.innerWidth);
    console.log('================================');
}

export default {
    init,
    get elements() {
        return elements;
    }
};