// js/harmony/ui/HarmonyToolbar.js
import store from '../../state/index.js';
import { Chord } from 'tonal';

// --- Private Variables ---
let qualitySelect, extensionSelect, bassSelect;

// --- Data for Dropdowns ---
const QUALITIES = [
    { value: 'M', text: 'Major' },
    { value: 'm', text: 'minor' },
    { value: 'dim', text: 'diminished' },
    { value: 'aug', text: 'Augmented' }
];

const EXTENSIONS = [
    { value: '', text: 'Triad' },
    { value: '7', text: '7th' },
    { value: 'M7', text: 'Major 7th' },
    { value: 'm7', text: 'minor 7th' },
    { value: 'add6', text: 'add 6' },
    { value: 'sus2', text: 'sus2' },
    { value: 'sus4', text: 'sus4' },
    { value: '7b9', text: '7(b9)' },
    { value: '7#9', text: '7(#9)' }
];

const DEGREED_BASS = [
    { value: '/1', text: '/1 (Root)' },
    { value: '/2', text: '/2' },
    { value: '/3', text: '/3' },
    { value: '/4', text: '/4' },
    { value: '/5', text: '/5' },
    { value: '/6', text: '/6' },
    { value: '/7', text: '/7' }
];

// --- Helper Functions ---
function populateSelect(select, options, selectedValue) {
    if (!select) return;
    select.innerHTML = '';
    options.forEach(opt => {
        const optionEl = document.createElement('option');
        optionEl.value = opt.value;
        optionEl.textContent = opt.text;
        if (opt.value === selectedValue) {
            optionEl.selected = true;
        }
        select.appendChild(optionEl);
    });
}

function updateChordShapeInStore() {
    const newShape = {
        quality: qualitySelect.value,
        extension: extensionSelect.value,
        degreedBass: bassSelect.value,
    };
    
    // Check for incompatible extensions and reset if needed
    // e.g., 'm' (minor) is not compatible with 'M7' (Major 7th)
    const testChord = Chord.get(`C${newShape.quality}${newShape.extension}`);
    if (testChord.empty) {
        // The combination is invalid. Reset extension to a safe default (triad).
        newShape.extension = '';
        populateSelect(extensionSelect, EXTENSIONS, newShape.extension);
    }
    
    store.setActiveChordShape(newShape);
}

// --- Main Initialization ---
export function initHarmonyToolbar() {
    qualitySelect = document.getElementById('harmony-quality-select');
    extensionSelect = document.getElementById('harmony-extension-select');
    bassSelect = document.getElementById('harmony-degreed-bass-select');

    if (!qualitySelect || !extensionSelect || !bassSelect) {
        return;
    }

    // Populate dropdowns with initial data
    populateSelect(qualitySelect, QUALITIES, store.state.activeChordShape.quality);
    populateSelect(extensionSelect, EXTENSIONS, store.state.activeChordShape.extension);
    populateSelect(bassSelect, DEGREED_BASS, store.state.activeChordShape.degreedBass);
    
    // Add event listeners
    qualitySelect.addEventListener('change', updateChordShapeInStore);
    extensionSelect.addEventListener('change', updateChordShapeInStore);
    bassSelect.addEventListener('change', updateChordShapeInStore);

}