// js/components/Toolbar/initializers/audioControlsInitializer.js
import store from '../../../state/index.js'; // <-- UPDATED PATH
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

    tempoSlider.addEventListener('input', (e) => updateTempoDisplays(parseInt(e.target.value, 10)));
    eighthNoteInput.addEventListener('input', (e) => { const val = parseInt(e.target.value, 10); if (!isNaN(val) && val > 0) updateTempoDisplays(val / 2); });
    quarterNoteInput.addEventListener('input', (e) => { const val = parseInt(e.target.value, 10); if (!isNaN(val) && val > 0) updateTempoDisplays(val); });
    dottedQuarterInput.addEventListener('input', (e) => { const val = parseInt(e.target.value, 10); if (!isNaN(val) && val > 0) updateTempoDisplays(val * 1.5); });
    tempoSlider.addEventListener('mouseup', function() { this.blur(); });
    updateTempoDisplays(store.state.tempo);

    const presetContainer = document.querySelector('.preset-container');
    document.querySelectorAll('.preset-button').forEach(button => {
        const presetId = button.id.replace('preset-', '');
        const preset = PRESETS[presetId];
        if (preset) {
            button.addEventListener('click', () => {
                const currentColor = store.state.selectedTool.color;
                if (currentColor) store.applyPreset(currentColor, preset);
            });
        }
    });

    const updatePresetSelection = (color) => {
        if (!color) return;
        const timbre = store.state.timbres[color];
        document.querySelectorAll('.preset-button').forEach(btn => {
            const presetId = btn.id.replace('preset-', '');
            btn.classList.toggle('selected', timbre && timbre.activePresetName === presetId);
        });
    };
    
    store.on('toolChanged', ({ newTool }) => {
        // Only react to tools that are directly associated with a timbre/color
        if (newTool.color && (newTool.type === 'circle' || newTool.type === 'oval')) {
            updatePresetSelection(newTool.color);
            presetContainer.style.setProperty('--c-accent', newTool.color);
        } else {
            // For any other tool (eraser, tonic, chord), reset the preset UI
            document.querySelectorAll('.preset-button').forEach(btn => btn.classList.remove('selected'));
            presetContainer.style.setProperty('--c-accent', '#4A90E2'); // Reset to default blue
        }
    });

    store.on('timbreChanged', (color) => {
        if (color === store.state.selectedTool.color) updatePresetSelection(color);
    });
    
    const initialColor = store.state.selectedTool.color;
    if (initialColor) {
        presetContainer.style.setProperty('--c-accent', initialColor);
        updatePresetSelection(initialColor);
    }
}