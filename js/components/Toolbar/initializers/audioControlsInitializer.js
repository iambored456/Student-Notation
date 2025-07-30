// js/components/Toolbar/initializers/audioControlsInitializer.js
import store from '../../../state/index.js';
import { PRESETS } from '../../../services/presetData.js';

export function initAudioControls() {
    const tempoSlider = document.getElementById('tempo-slider');
    const eighthNoteInput = document.getElementById('eighth-note-tempo');
    const quarterNoteInput = document.getElementById('quarter-note-tempo');
    const dottedQuarterInput = document.getElementById('dotted-quarter-tempo');

    function updateTempoDisplays(baseBPM) {
        const quarterBPM = Math.round(baseBPM);
        if (parseInt(tempoSlider.value, 10) !== quarterBPM) tempoSlider.value = quarterBPM;
        
        const eighthBPM = quarterBPM * 2;
        const dottedQuarterBPM = Math.round(quarterBPM / 1.5);
        
        if (parseInt(eighthNoteInput.value, 10) !== eighthBPM) eighthNoteInput.value = eighthBPM;
        if (parseInt(quarterNoteInput.value, 10) !== quarterBPM) quarterNoteInput.value = quarterBPM;
        if (parseInt(dottedQuarterInput.value, 10) !== dottedQuarterBPM) dottedQuarterInput.value = dottedQuarterBPM;
        
        if (store.state.tempo !== quarterBPM) store.setTempo(quarterBPM);
    }

    if (tempoSlider && eighthNoteInput && quarterNoteInput && dottedQuarterInput) {
        tempoSlider.addEventListener('input', (e) => updateTempoDisplays(parseInt(e.target.value, 10)));
        eighthNoteInput.addEventListener('change', (e) => { const val = parseInt(e.target.value, 10); if (!isNaN(val) && val > 0) updateTempoDisplays(val / 2); });
        quarterNoteInput.addEventListener('change', (e) => { const val = parseInt(e.target.value, 10); if (!isNaN(val) && val > 0) updateTempoDisplays(val); });
        dottedQuarterInput.addEventListener('change', (e) => { const val = parseInt(e.target.value, 10); if (!isNaN(val) && val > 0) updateTempoDisplays(val * 1.5); });
        tempoSlider.addEventListener('mouseup', function() { this.blur(); });
        updateTempoDisplays(store.state.tempo);
    }


    const presetContainer = document.querySelector('.preset-container');
    document.querySelectorAll('.preset-button').forEach(button => {
        const presetId = button.id.replace('preset-', '');
        const preset = PRESETS[presetId];
        if (preset) {
            button.addEventListener('click', () => {
                // THE FIX: Get the current color from the selectedNOTE, not the selectedTOOL.
                const currentColor = store.state.selectedNote.color;
                if (currentColor) {
                    store.applyPreset(currentColor, preset);
                }
            });
        }
    });

    const updatePresetSelection = (color) => {
        if (!color || !presetContainer) return;
        const timbre = store.state.timbres[color];
        document.querySelectorAll('.preset-button').forEach(btn => {
            const presetId = btn.id.replace('preset-', '');
            btn.classList.toggle('selected', timbre && timbre.activePresetName === presetId);
        });
        presetContainer.style.setProperty('--c-accent', color);
    };
    
    // THE FIX: Listen for 'noteChanged' to update the UI when the color changes.
    store.on('noteChanged', ({ newNote }) => {
        if (newNote.color) {
            updatePresetSelection(newNote.color);
        } else {
            // Handle cases where there might not be a color (e.g. eraser tool selected)
            document.querySelectorAll('.preset-button').forEach(btn => btn.classList.remove('selected'));
            if(presetContainer) presetContainer.style.setProperty('--c-accent', '#4A90E2'); // Reset to default
        }
    });

    // THE FIX: Listen for 'timbreChanged' and check against the correct state property.
    store.on('timbreChanged', (color) => {
        if (color === store.state.selectedNote.color) {
            updatePresetSelection(color);
        }
    });
    
    // THE FIX: Get the initial color from the correct state property on load.
    const initialColor = store.state.selectedNote.color;
    if (initialColor) {
        updatePresetSelection(initialColor);
    }
}