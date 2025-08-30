// js/components/ADSR/adsrInteractions.js
import store from '../../../state/index.js';
import { MAX_ADSR_TIME_SECONDS } from './adsrComponent.js';

/**
 * Derives new attack, decay, and release values from absolute time points
 * and updates the store. This is the single source of truth for ADSR time calculations.
 * @param {object} newTimes - An object with {a, d, r} absolute time values.
 * @param {object} component - The main ADSR component instance.
 */
function updateADSRFromAbsoluteTimes(newTimes, component) {
    const { sustain } = store.state.timbres[component.currentColor].adsr;
    
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
        console.error("NaN value detected before setting ADSR. Aborting update.", {newAttack, newDecay, newRelease});
        return;
    }

    store.setADSR(component.currentColor, {
        attack: newAttack,
        decay: newDecay,
        release: newRelease,
        sustain: sustain // Sustain is not changed by the time sliders/nodes
    });
}

function initSustainSlider(elements, component) {
    let isDragging = false;

    const handleDrag = (e) => {
        if (!isDragging) return;
        const rect = elements.sustainTrack.getBoundingClientRect();
        const y = e.clientY - rect.top;
        let percent = 100 - (y / rect.height) * 100;
        percent = Math.max(0, Math.min(100, percent));
        
        // Constrain sustain to normalized amplitude
        const normalizedAmplitude = window.staticWaveformVisualizer?.getNormalizedAmplitude() || 1.0;
        const maxSustainPercent = normalizedAmplitude * 100;
        percent = Math.min(percent, maxSustainPercent);
        
        const currentTimbre = store.state.timbres[component.currentColor];
        store.setADSR(component.currentColor, { ...currentTimbre.adsr, sustain: percent / 100 });
    };

    const startDrag = (e) => {
        isDragging = true;
        handleDrag(e); // Call immediately for click-to-position behavior
    };
    
    const stopDrag = () => { isDragging = false; };

    elements.sustainTrack.addEventListener('pointerdown', startDrag);
    document.addEventListener('pointermove', handleDrag);
    document.addEventListener('pointerup', stopDrag);
}

function initMultiThumbSlider(elements, component) {
    let activeThumb = null;

    const handleDrag = (e) => {
        if (!activeThumb) return;

        const rect = elements.multiSliderContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        let percent = (x / rect.width) * 100;
        percent = Math.max(0, Math.min(100, percent));
        
        const timeVal = (percent / 100) * MAX_ADSR_TIME_SECONDS;

        const { attack, decay, release } = store.state.timbres[component.currentColor].adsr;
        const currentTimes = {
            a: attack,
            d: attack + decay,
            r: attack + decay + release
        };

        if (activeThumb.id === 'thumb-a') currentTimes.a = timeVal;
        if (activeThumb.id === 'thumb-d') currentTimes.d = timeVal;
        if (activeThumb.id === 'thumb-r') currentTimes.r = timeVal;

        updateADSRFromAbsoluteTimes(currentTimes, component);
    };

    const startDrag = (e) => {
        if (e.target.classList.contains('time-slider-thumb')) {
            activeThumb = e.target;
            handleDrag(e); // Call immediately
        }
    };

    const stopDrag = () => { activeThumb = null; };

    elements.multiSliderContainer.addEventListener('pointerdown', startDrag);
    document.addEventListener('pointermove', handleDrag);
    document.addEventListener('pointerup', stopDrag);
}

function initNodeDragging(elements, component) {
    let activeNode = null;

    const handleDrag = (e) => {
        if (!activeNode) return;
        const svg = component.svgContainer;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

        let xPercent = (svgP.x / component.width) * 100;
        let yPercent = 1 - (svgP.y / component.height);
        xPercent = Math.max(0, Math.min(100, xPercent));
        yPercent = Math.max(0, Math.min(1, yPercent));

        const timeVal = (xPercent / 100) * MAX_ADSR_TIME_SECONDS;
        const currentTimbre = store.state.timbres[component.currentColor];
        let { attack, decay, release, sustain } = currentTimbre.adsr;
        
        const currentTimes = {
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
            case 'decay-sustain-node':
                currentTimes.d = timeVal;
                // Get normalized amplitude to constrain sustain level
                const normalizedAmplitude = window.staticWaveformVisualizer?.getNormalizedAmplitude() || 1.0;
                sustain = Math.min(yPercent, normalizedAmplitude); // Constrain sustain to normalized amplitude
                break;
            case 'release-node':
                currentTimes.r = timeVal;
                break;
        }
        
        // Update sustain separately if needed
        const oldSustain = store.state.timbres[component.currentColor].adsr.sustain;
        if (sustain !== oldSustain) {
             store.setADSR(component.currentColor, { attack, decay, release, sustain });
        }
        
        updateADSRFromAbsoluteTimes(currentTimes, component);
    };

    const startDrag = (e) => {
        if (e.target.classList.contains('adsr-node')) {
            activeNode = e.target;
            activeNode.style.cursor = 'grabbing';
            handleDrag(e);
        }
    };

    const stopDrag = () => {
        if (activeNode) {
            activeNode.style.cursor = 'grab';
            activeNode = null;
        }
    };
    
    component.nodeLayer.addEventListener('pointerdown', startDrag);
    document.addEventListener('pointermove', handleDrag);
    document.addEventListener('pointerup', stopDrag);
}

export function initInteractions(component) {
    const elements = component.ui;
    initSustainSlider(elements, component);
    initMultiThumbSlider(elements, component);
    initNodeDragging(elements, component);
}