// js/components/FilterControls/filterControls.js
import store from '../../state/index.js';

console.log("FilterControls: Module loaded.");

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
    if (!currentColor) return;

    const timbre = store.state.timbres[currentColor];
    if (!timbre || !timbre.filter) return;

    const { cutoff, blend } = timbre.filter;
    
    // Update horizontal blend slider
    if(blendThumb && blendTrack) {
        const blendPercent = (BLEND_MAX - blend) / (BLEND_MAX - BLEND_MIN);
        blendThumb.style.left = `${blendPercent * 100}%`;
        blendTrack.style.setProperty('--progress', `${blendPercent * 100}%`);
    }
    
    // Update vertical blend slider
    if (verticalBlendSlider && verticalBlendTrack) {
        const blendPercent = blend / BLEND_MAX; // 0 to 1
        verticalBlendSlider.style.bottom = `${blendPercent * 100}%`;
        verticalBlendTrack.style.setProperty('--blend-progress', `${blendPercent * 100}%`);
    }
    
    if(cutoffThumb && cutoffTrack) {
        const cutoffPercent = (cutoff - CUTOFF_MIN) / (CUTOFF_MAX - CUTOFF_MIN);
        cutoffThumb.style.left = `${cutoffPercent * 100}%`;
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
    const value = percent * BLEND_MAX;
    store.setFilterSettings(currentColor, { blend: value });
}

export function initFilterControls() {
    container = document.querySelector('.multislider-container');
    blendThumb = document.getElementById('thumb-b');
    blendTrack = document.getElementById('blend-slider-container');
    cutoffThumb = document.getElementById('thumb-c');
    cutoffTrack = document.getElementById('cutoff-slider-container');

    if (!container || !blendThumb || !cutoffThumb) {
        console.error("FilterControls: Could not find one or more required filter UI elements.");
        return;
    }
    
    // Remove the old filter toggle button logic
    // Create the vertical blend slider instead
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

    console.log("FilterControls: Initialized with vertical blend slider.");
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
    verticalBlendSlider.textContent = 'B';
    verticalBlendSlider.title = 'Filter Blend: 0% to 100%';
    
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
        const value = percent * BLEND_MAX;
        store.setFilterSettings(currentColor, { blend: value });
        store.recordState();
    });
}