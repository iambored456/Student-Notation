// js/components/Harmonics-Filter/filterControls.js
import store from '../../../state/index.js';


let blendThumb, blendTrack, cutoffThumb, cutoffTrack, container;
let verticalBlendSlider, verticalBlendTrack;
let isDraggingCutoff = false;
let isDraggingBlend = false;
let isDraggingVerticalBlend = false;
let currentColor;

const CUTOFF_MIN = 1;
const CUTOFF_MAX = 31;
const BLEND_MIN = 0;
const BLEND_MAX = 2;

function updateFromStore() {
    if (!currentColor) {
        return;
    }

    const timbre = store.state.timbres[currentColor];
    if (!timbre) {
        return;
    }
    
    // Fix: Ensure filter state is properly initialized
    if (!timbre.filter) {
        timbre.filter = { enabled: true, blend: 0.0, cutoff: 16, resonance: 0, type: 'lowpass', mix: 0 };
    } else if (timbre.filter.enabled === undefined) {
        timbre.filter.enabled = true;
    }

    const { cutoff, blend, mix } = timbre.filter;
    
    // Update horizontal blend slider
    if(blendThumb && blendTrack) {
        const blendPercent = (BLEND_MAX - blend) / (BLEND_MAX - BLEND_MIN);
        blendThumb.style.left = `${blendPercent * 100}%`;
        blendTrack.style.setProperty('--progress', `${blendPercent * 100}%`);
    }
    
    // Update vertical mix slider (renamed from blend)
    if (verticalBlendSlider && verticalBlendTrack) {
        const mixPercent = (mix || 0) / 100; // 0 to 1
        verticalBlendSlider.style.bottom = `${mixPercent * 100}%`;
        verticalBlendTrack.style.setProperty('--blend-progress', `${mixPercent * 100}%`);
    }
    
    
    if(cutoffThumb && cutoffTrack) {
        const cutoffPercent = (cutoff - CUTOFF_MIN) / (CUTOFF_MAX - CUTOFF_MIN);
        cutoffThumb.style.left = `${cutoffPercent * 100}%`;
        cutoffThumb.style.top = '50%'; // Ensure proper vertical centering
        cutoffThumb.style.transform = 'translate(-50%, -50%)'; // Ensure proper positioning
        cutoffTrack.style.setProperty('--progress', `${cutoffPercent * 100}%`);
    }
    
    if(container) container.style.setProperty('--c-accent', currentColor);
}

function handleCutoffDrag(e) {
    if (!isDraggingCutoff) return;
    const rect = cutoffTrack.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    let percent = x / w;
    percent = Math.max(0, Math.min(1, percent));
    const value = percent * (CUTOFF_MAX - CUTOFF_MIN) + CUTOFF_MIN;
    store.setFilterSettings(currentColor, { cutoff: value });
}

function handleBlendDrag(e) {
    if (!isDraggingBlend) return;
    const rect = blendTrack.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    let percent = x / w;
    percent = Math.max(0, Math.min(1, percent));
    const value = BLEND_MAX - (percent * (BLEND_MAX - BLEND_MIN));
    store.setFilterSettings(currentColor, { blend: value });
}

function handleVerticalBlendDrag(e) {
    if (!isDraggingVerticalBlend) return;
    const rect = verticalBlendTrack.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    let percent = 1 - (y / h); // Invert because bottom is 100%
    percent = Math.max(0, Math.min(1, percent));
    const value = percent * 100; // Mix is 0-100%
    store.setFilterSettings(currentColor, { mix: value });
}


export function initFilterControls() {
    container = document.querySelector('.harmonic-bins-container');
    blendThumb = document.getElementById('thumb-b');
    blendTrack = document.getElementById('blend-slider-container');
    cutoffThumb = document.getElementById('thumb-c');
    cutoffTrack = document.getElementById('cutoff-slider-container');

    if (!container || !blendThumb || !cutoffThumb) {
        return;
    }
    
    
    // Get the blend slider wrapper and inner elements
    const blendWrapper = document.querySelector('.blend-slider-container');
    if (blendWrapper && blendTrack) {
        const wrapperRect = blendWrapper.getBoundingClientRect();
        const trackRect = blendTrack.getBoundingClientRect();
    }
    
    // Get cutoff slider dimensions
    if (cutoffTrack) {
        const cutoffRect = cutoffTrack.getBoundingClientRect();

    }
    
    // Create the vertical blend slider
    createVerticalBlendSlider();

    blendThumb.addEventListener('mousedown', e => {
        e.preventDefault();
        isDraggingBlend = true;
        document.body.style.cursor = 'ew-resize';
        const onMove = (ev) => handleBlendDrag(ev);
        const onUp = () => {
            isDraggingBlend = false;
            document.body.style.cursor = 'default';
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            store.recordState();
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    });

    cutoffThumb.addEventListener('mousedown', e => {
        e.preventDefault();
        isDraggingCutoff = true;
        document.body.style.cursor = 'ew-resize';
        const onMove = (ev) => handleCutoffDrag(ev);
        const onUp = () => {
            isDraggingCutoff = false;
            document.body.style.cursor = 'default';
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            store.recordState();
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    });

    store.on('noteChanged', ({ newNote }) => {
        if (newNote.color && newNote.color !== currentColor) {
            currentColor = newNote.color;
            updateFromStore();
        }
    });

    store.on('timbreChanged', (color) => {
        if (color === currentColor) {
            updateFromStore();
        }
    });

    currentColor = store.state.selectedNote.color;
    updateFromStore();

    // Log final dimensions after initialization
    setTimeout(() => {
        
        const blendWrapper = document.querySelector('.blend-slider-container');
        if (blendWrapper) {
            const wrapperRect = blendWrapper.getBoundingClientRect();
            
        }
        
    }, 100);

}

function createVerticalBlendSlider() {
    // Find the filter button wrapper and replace it
    const filterButtonWrapper = document.querySelector('.filter-button-wrapper');
    if (!filterButtonWrapper) return;
    
    // Clear the wrapper and create new vertical slider
    filterButtonWrapper.innerHTML = '';
    filterButtonWrapper.className = 'vertical-blend-wrapper';
    
    // Create the vertical track
    verticalBlendTrack = document.createElement('div');
    verticalBlendTrack.id = 'vertical-blend-track';
    verticalBlendTrack.className = 'vertical-slider-track';
    
    // Create the thumb
    verticalBlendSlider = document.createElement('div');
    verticalBlendSlider.id = 'vertical-blend-thumb';
    verticalBlendSlider.className = 'vertical-slider-thumb';
    verticalBlendSlider.textContent = 'M';
    verticalBlendSlider.title = 'Filter Mix: 0% to 100%';
    
    verticalBlendTrack.appendChild(verticalBlendSlider);
    filterButtonWrapper.appendChild(verticalBlendTrack);
    
    // Add event listeners for the vertical slider
    verticalBlendSlider.addEventListener('mousedown', e => {
        e.preventDefault();
        isDraggingVerticalBlend = true;
        document.body.style.cursor = 'ns-resize';
        
        const onMove = (ev) => handleVerticalBlendDrag(ev);
        const onUp = () => {
            isDraggingVerticalBlend = false;
            document.body.style.cursor = 'default';
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            store.recordState();
        };
        
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    });
    
    // Click on track to position slider
    verticalBlendTrack.addEventListener('click', e => {
        if (e.target === verticalBlendSlider) return;
        const rect = verticalBlendTrack.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const h = rect.height;
        let percent = 1 - (y / h);
        percent = Math.max(0, Math.min(1, percent));
        const value = percent * 100; // Mix is 0-100%
        store.setFilterSettings(currentColor, { mix: value });
        store.recordState();
    });
}

