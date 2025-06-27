// js/components/FilterControls/filterControls.js
import store from '../../state/store.js';

console.log("FilterControls: Module loaded.");

let enableToggle, blendThumb, blendTrack, cutoffThumb, cutoffTrack, resonanceThumb, resonanceTrack, container;
let isDraggingResonance = false;
let isDraggingCutoff = false;
let isDraggingBlend = false; // New state for blend dragging
let currentColor;

const CUTOFF_MIN = 1;
const CUTOFF_MAX = 31;
const BLEND_MIN = 0;
const BLEND_MAX = 2;

function updateFromStore() {
    if (!currentColor) return;

    const timbre = store.state.timbres[currentColor];
    if (!timbre || !timbre.filter) return;

    const { enabled, cutoff, blend, resonance } = timbre.filter;
    
    enableToggle.classList.toggle('active', enabled);
    container.classList.toggle('filter-disabled', !enabled);

    // Update blend thumb position (inverted)
    const blendPercent = (BLEND_MAX - blend) / (BLEND_MAX - BLEND_MIN);
    blendThumb.style.left = `${blendPercent * 100}%`;
    
    const cutoffPercent = (cutoff - CUTOFF_MIN) / (CUTOFF_MAX - CUTOFF_MIN);
    cutoffThumb.style.left = `${cutoffPercent * 100}%`;
    
    const resonancePercent = resonance / 100;
    resonanceThumb.style.bottom = `${resonancePercent * 100}%`;
    resonanceTrack.style.setProperty('--resonance-progress', `${resonancePercent * 100}%`);

    container.style.setProperty('--c-accent', currentColor);
}

function handleResonanceDrag(e) {
    if (!isDraggingResonance) return;
    const rect = resonanceTrack.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    let percent = 1 - (y / h);
    percent = Math.max(0, Math.min(1, percent));
    store.setFilterSettings(currentColor, { resonance: percent * 100 });
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
    // Invert the value: 0% left = 2.0, 100% left = 0.0
    const value = BLEND_MAX - (percent * (BLEND_MAX - BLEND_MIN));
    store.setFilterSettings(currentColor, { blend: value });
}

export function initFilterControls() {
    container = document.querySelector('.multislider-container');
    enableToggle = document.getElementById('filter-enable-toggle');
    blendThumb = document.getElementById('thumb-b');
    blendTrack = document.getElementById('blend-slider-container');
    cutoffThumb = document.getElementById('thumb-c');
    cutoffTrack = document.getElementById('cutoff-slider-container');
    resonanceThumb = document.getElementById('resonance-slider-thumb');
    resonanceTrack = document.getElementById('resonance-slider-track');

    if (!enableToggle || !blendThumb || !cutoffThumb || !resonanceThumb) {
        console.error("FilterControls: Could not find required filter UI elements.");
        return;
    }
    
    enableToggle.addEventListener('click', () => {
        const isEnabled = !store.state.timbres[currentColor].filter.enabled;
        store.setFilterSettings(currentColor, { enabled: isEnabled });
        store.recordState();
    });

    // --- Blend Thumb Drag Logic ---
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

    // --- Cutoff Thumb Drag Logic ---
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

    // --- Resonance Thumb Drag Logic ---
    resonanceThumb.addEventListener('mousedown', e => {
        e.preventDefault();
        isDraggingResonance = true;
        document.body.style.cursor = 'ns-resize';
        const onMove = (ev) => handleResonanceDrag(ev);
        const onUp = () => {
            isDraggingResonance = false;
            document.body.style.cursor = 'default';
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            store.recordState();
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    });

    store.on('toolChanged', ({ newTool }) => {
        if (newTool.color && newTool.color !== currentColor) {
            currentColor = newTool.color;
            updateFromStore();
        }
    });

    store.on('timbreChanged', (color) => {
        if (color === currentColor) {
            updateFromStore();
        }
    });

    currentColor = store.state.selectedTool.color;
    updateFromStore();

    console.log("FilterControls: Initialized.");
}