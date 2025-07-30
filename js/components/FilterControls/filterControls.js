// js/components/FilterControls/filterControls.js
import store from '../../state/index.js';

console.log("FilterControls: Module loaded.");

let enableToggle, blendThumb, blendTrack, cutoffThumb, cutoffTrack, container;
let isDraggingCutoff = false;
let isDraggingBlend = false;
let currentColor;

const CUTOFF_MIN = 1;
const CUTOFF_MAX = 31;
const BLEND_MIN = 0;
const BLEND_MAX = 2;

function updateFromStore() {
    if (!currentColor) return;

    const timbre = store.state.timbres[currentColor];
    if (!timbre || !timbre.filter) return;

    const { enabled, cutoff, blend } = timbre.filter;
    
    if(enableToggle) enableToggle.classList.toggle('active', enabled);
    if(container) container.classList.toggle('filter-disabled', !enabled);

    if(blendThumb && blendTrack) {
        // This calculation is inverted because 0 blend = 100% left on the slider
        const blendPercent = (BLEND_MAX - blend) / (BLEND_MAX - BLEND_MIN);
        blendThumb.style.left = `${blendPercent * 100}%`;
        // NEW: Update the track's progress variable
        blendTrack.style.setProperty('--progress', `${blendPercent * 100}%`);
    }
    
    if(cutoffThumb && cutoffTrack) {
        const cutoffPercent = (cutoff - CUTOFF_MIN) / (CUTOFF_MAX - CUTOFF_MIN);
        cutoffThumb.style.left = `${cutoffPercent * 100}%`;
        // NEW: Update the track's progress variable
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

export function initFilterControls() {
    container = document.querySelector('.multislider-container');
    enableToggle = document.getElementById('filter-enable-toggle');
    blendThumb = document.getElementById('thumb-b');
    blendTrack = document.getElementById('blend-slider-container');
    cutoffThumb = document.getElementById('thumb-c');
    cutoffTrack = document.getElementById('cutoff-slider-container');

    if (!container || !enableToggle || !blendThumb || !cutoffThumb) {
        console.error("FilterControls: Could not find one or more required filter UI elements.");
        return;
    }
    
    enableToggle.addEventListener('click', () => {
        // Guard against clicks when no color is selected.
        if (!currentColor) return;
        const isEnabled = !store.state.timbres[currentColor].filter.enabled;
        store.setFilterSettings(currentColor, { enabled: isEnabled });
        store.recordState();
    });

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

    // THE FIX: Listen to 'noteChanged' to get color updates.
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

    // THE FIX: Get the initial color from the correct state property.
    currentColor = store.state.selectedNote.color;
    updateFromStore();

    console.log("FilterControls: Initialized.");
}