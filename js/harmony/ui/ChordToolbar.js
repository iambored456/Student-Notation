// js/harmony/ui/ChordToolbar.js
import store from '../../state/index.js';
import { rules } from '../models/rules.js';
// REMOVED: Layout service imports are no longer needed for positioning.
// import LayoutService from '../../services/layoutService.js';
// import { getRowY } from '../../components/Grid/renderers/rendererUtils.js';

let wrapper, qualitySelect, inversionSelect, extensionSelect, collapseBtn;
let activeChord = null;

function prettify(value) {
    if (value === '') return "None";
    if (value === '7' && activeChord?.quality === 'dom') return "7 (implied)";
    return value.toString().replace(/b/g, '♭').replace(/#/g, '♯').replace('add', 'add ').replace('sus', 'sus ');
}

function flashInvalid(element) {
    element.classList.add('invalid-reset');
    setTimeout(() => element.classList.remove('invalid-reset'), 800);
}

function getExtensionOptions(shape) {
    const allowed = rules.extensionByQuality[shape.quality];
    let options = allowed.map(v => ({ value: v, label: prettify(v), disabled: false }));

    const currentExt = shape.extension;
    if (currentExt.startsWith('sus')) {
        const conflictKey = currentExt;
        const blocked = rules.susConflicts[conflictKey];
        if (blocked) {
            options.forEach(o => { if (blocked.includes(o.value)) o.disabled = true; });
        }
    } else if (currentExt.match(/^(b|#)?9/)) {
        const sus2Opt = options.find(o => o.value === 'sus2');
        if (sus2Opt) sus2Opt.disabled = true;
    } else if (currentExt.match(/^(b|#)?11/)) {
        const sus4Opt = options.find(o => o.value === 'sus4');
        if (sus4Opt) sus4Opt.disabled = true;
    }

    return options;
}

function populateSelect(select, options, selectedValue) {
    select.innerHTML = '';
    options.forEach(opt => {
        const optionEl = document.createElement('option');
        optionEl.value = opt.value;
        optionEl.textContent = opt.label;
        optionEl.disabled = opt.disabled || false;
        if (opt.title) optionEl.title = opt.title;
        if (opt.value.toString() === selectedValue.toString()) {
            optionEl.selected = true;
        }
        select.appendChild(optionEl);
    });
}

function updateToolbar() {
    activeChord = store.state.placedChords.find(c => c.id === store.state.activeChordId);
    if (!activeChord) return;

    // 1. Populate Quality
    populateSelect(qualitySelect, rules.qualities.map(q => ({value: q, label: q})), activeChord.quality);

    // 2. Populate Inversion
    const isTetrad = (activeChord.extension && activeChord.extension !== "" && activeChord.extension !== "add6" && !activeChord.extension.startsWith("sus")) || activeChord.quality === 'dom';
    const allowedInversions = isTetrad ? rules.inversion.tetrad : rules.inversion.triad;
    let inversionOptions = allowedInversions.map(i => ({value: i, label: `Inv. ${i}`}));
    
    if (activeChord.quality === 'dim' && activeChord.extension === '7') {
        const rootEqOption = inversionOptions.find(o => o.value === 3);
        if (rootEqOption) {
            rootEqOption.label = 'Inv. 3 (root-eq.)';
            rootEqOption.title = 'Enharmonic return to root.';
        }
    }
    populateSelect(inversionSelect, inversionOptions, activeChord.inversion);

    // 3. Populate Extension
    const extensionOptions = getExtensionOptions(activeChord);
    populateSelect(extensionSelect, extensionOptions, activeChord.extension);

    /* REMOVED: Absolute positioning logic is no longer needed. */
    // 4. Position Toolbar
}

function handleSelectionChange() {
    if (!activeChord) return;
    
    const updates = {
        quality: qualitySelect.value,
        inversion: parseInt(inversionSelect.value, 10),
        extension: extensionSelect.value,
    };

    const newQuality = updates.quality;
    let currentExtension = updates.extension;

    if (!rules.extensionByQuality[newQuality].includes(currentExtension)) {
        updates.extension = newQuality === 'dom' ? '7' : '';
        flashInvalid(extensionSelect);
    }
    
    const isTetrad = (updates.extension && updates.extension !== "" && updates.extension !== "add6" && !updates.extension.startsWith("sus")) || newQuality === 'dom';
    const maxInversion = isTetrad ? 3 : 2;
    if (updates.inversion > maxInversion) {
        updates.inversion = 0;
        flashInvalid(inversionSelect);
    }

    store.updateChord(activeChord.id, updates);
    updateToolbar();
}

function onFinalChange() {
    store.recordState();
}

export function initChordToolbar() {
    wrapper = document.getElementById('chord-toolbar-wrapper');
    qualitySelect = document.getElementById('chord-quality-select');
    inversionSelect = document.getElementById('chord-inversion-select');
    extensionSelect = document.getElementById('chord-extension-select');
    collapseBtn = document.getElementById('chord-toolbar-collapse-btn');
    
    if (!wrapper || !qualitySelect || !inversionSelect || !extensionSelect) {
        console.error("ChordToolbar: Could not find all required elements.");
        return;
    }

    [qualitySelect, inversionSelect, extensionSelect].forEach(el => {
        el.addEventListener('input', handleSelectionChange);
        el.addEventListener('change', onFinalChange);
    });

    collapseBtn.addEventListener('click', () => store.setActiveChord(null));

    store.on('activeChordChanged', (activeChordId) => {
        // This logic remains the same. It just toggles visibility now.
        wrapper.classList.toggle('collapsed', !activeChordId);
        if (activeChordId) {
            updateToolbar();
        }
    });

    store.on('chordsChanged', ({ updatedChordId }) => {
        if (updatedChordId && updatedChordId === store.state.activeChordId) {
            updateToolbar();
        }
    });
    
    /* REMOVED: Scroll listener is no longer needed. */

    console.log("ChordToolbar: Initialized.");
}