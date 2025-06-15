// js/components/Toolbar/Toolbar.js
import store from '../../state/store.js';
import ConfigService from '../../services/configService.js';
import TransportService from '../../services/transportService.js';
import { renderRhythmUI } from './rhythmUI.js';
import { renderTimeSignatureDisplay } from './timeSignatureDisplay.js';
import { initNoteBank } from './noteBank.js';

console.log("ToolbarComponent: Module loaded.");

const BINS = 32; 

function generateSineCoeffs() {
    const coeffs = new Float32Array(BINS).fill(0);
    coeffs[1] = 1;
    return coeffs;
}

function generateSquareCoeffs() {
    const coeffs = new Float32Array(BINS).fill(0);
    for (let n = 1; n < BINS; n += 2) {
        coeffs[n] = 1 / n;
    }
    return coeffs;
}

function generateTriangleCoeffs() {
    const coeffs = new Float32Array(BINS).fill(0);
    for (let n = 1; n < BINS; n += 2) {
        coeffs[n] = (1 / (n * n)) * ((n - 1) / 2 % 2 === 0 ? 1 : -1);
    }
    return coeffs;
}

function generateSawtoothCoeffs() {
    const coeffs = new Float32Array(BINS).fill(0);
    for (let n = 1; n < BINS; n++) {
        coeffs[n] = 1 / n;
    }
    return coeffs;
}

function generatePianoPreset() {
    const coeffs = new Float32Array(BINS).fill(0);
    for (let n = 1; n < 20; n++) {
        coeffs[n] = (1 / (n * n)) * Math.pow(0.85, n);
    }
    const adsr = { attack: 0.01, decay: 0.8, sustain: 0.1, release: 1.0 };
    return { coeffs, adsr, name: 'piano' };
}

function generateStringsPreset() {
    const coeffs = new Float32Array(BINS).fill(0);
    for (let n = 1; n < 25; n++) {
        coeffs[n] = 1 / n;
    }
    const adsr = { attack: 0.4, decay: 0.1, sustain: 0.9, release: 0.5 };
    return { coeffs, adsr, name: 'strings' };
}

function generateWoodwindPreset() {
    const coeffs = new Float32Array(BINS).fill(0);
    for (let n = 1; n < BINS; n += 2) {
        coeffs[n] = 1 / n;
    }
    const adsr = { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.3 };
    return { coeffs, adsr, name: 'woodwind' };
}

function generateMarimbaPreset() {
    const coeffs = new Float32Array(BINS).fill(0);
    coeffs[1] = 1;
    coeffs[4] = 0.5;
    coeffs[9] = 0.2;
    const adsr = { attack: 0.01, decay: 1.2, sustain: 0, release: 1.2 };
    return { coeffs, adsr, name: 'marimba' };
}

function initImportExport() {
    document.getElementById('export-button').addEventListener('click', () => {
        const data = store.state.placedNotes.map(note => {
            return [
                note.row, note.startColumnIndex, note.endColumnIndex,
                note.color, note.shape, note.tonicNumber || '',
                note.isDrum, note.drumTrack || ''
            ].join(',');
        }).join('\n');
        
        const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "student-notation-export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    document.getElementById('import-button').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.txt';
        input.onchange = e => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = readerEvent => {
                const content = readerEvent.target.result;
                const importedNotes = content.split('\n').filter(line => line.trim()).map(line => {
                    const parts = line.split(',');
                    return {
                        row: parseInt(parts[0]), startColumnIndex: parseInt(parts[1]),
                        endColumnIndex: parseInt(parts[2]), color: parts[3],
                        shape: parts[4], tonicNumber: parts[5] || null,
                        isDrum: parts[6] === 'true', drumTrack: parts[7] || null
                    };
                });
                store.loadNotes(importedNotes);
            }
            reader.readAsText(file);
        }
        input.click();
    });
}

function initToolSelectors() {
    const eraserTool = document.getElementById('eraser-tool');
    const tonicButtons = document.querySelectorAll('.tonicization-container .tonicization-button');

    eraserTool.addEventListener('click', () => store.setSelectedTool('eraser'));

    tonicButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tonicNumber = btn.getAttribute('data-tonic');
            store.setSelectedTool('tonicization', '#000000', tonicNumber);
        });
    });
    
    store.on('toolChanged', (selectedTool) => {
        document.querySelectorAll('.note, .eraser, .tonicization-button').forEach(el => el.classList.remove('selected', 'active-eraser'));

        if (selectedTool.type === 'eraser') {
            eraserTool.classList.add('active-eraser');
        } else if (selectedTool.type === 'tonicization') {
            document.querySelector(`.tonicization-button[data-tonic='${selectedTool.tonicNumber}']`)?.classList.add('selected');
        } else {
            document.querySelector(`.note[data-type='${selectedTool.type}'][data-color='${selectedTool.color}']`)?.classList.add('selected');
        }
    });
}

function initPlaybackControls() {
    const playBtn = document.getElementById('play-button');
    const stopBtn = document.getElementById('stop-button');
    const clearBtn = document.getElementById('clear-button');
    const loopBtn = document.getElementById('loop-button');
    const undoBtn = document.getElementById('undo-button');
    const redoBtn = document.getElementById('redo-button');

    playBtn.addEventListener('click', () => {
        if (!store.state.isPlaying || store.state.isPaused) {
            store.setPlaybackState(true, false);
            TransportService.start();
        } else {
            store.setPlaybackState(true, true);
            TransportService.pause();
        }
    });

    stopBtn.addEventListener('click', () => {
        store.setPlaybackState(false, false);
        TransportService.stop();
    });
    
    clearBtn.addEventListener('click', () => store.clearAllNotes());
    loopBtn.addEventListener('click', () => store.setLooping(!store.state.isLooping));
    undoBtn.addEventListener('click', () => store.undo());
    redoBtn.addEventListener('click', () => store.redo());

    store.on('playbackStateChanged', ({ isPlaying, isPaused }) => {
        playBtn.textContent = (isPlaying && !isPaused) ? "⏸" : "⏵";
        playBtn.classList.toggle("active", isPlaying && !isPaused);
    });
    store.on('loopingChanged', isLooping => loopBtn.classList.toggle('active', isLooping));

    const updateHistoryButtons = () => {
        undoBtn.disabled = store.state.historyIndex <= 0;
        redoBtn.disabled = store.state.historyIndex >= store.state.history.length - 1;
        console.log(`[UI] History buttons updated. Undo enabled: ${!undoBtn.disabled}, Redo enabled: ${!redoBtn.disabled}`);
    };

    store.on('historyChanged', updateHistoryButtons);
    updateHistoryButtons();
}

function initAudioControls() {
    document.getElementById('volume-slider').addEventListener('input', function() {
        const dB = (parseInt(this.value, 10) / 100) * 40 - 40;
        store.emit('volumeChanged', dB);
    });

    const tempoSlider = document.getElementById('tempo-slider');
    const eighthNoteInput = document.getElementById('eighth-note-tempo');
    const quarterNoteInput = document.getElementById('quarter-note-tempo');
    const dottedQuarterInput = document.getElementById('dotted-quarter-tempo');

    function updateTempoDisplays(baseBPM) {
        const quarterBPM = Math.round(baseBPM);
        console.log(`[TEMPO] Updating displays to base BPM: ${quarterBPM}`);
        if (parseInt(tempoSlider.value, 10) !== quarterBPM) {
            tempoSlider.value = quarterBPM;
        }
        const eighthBPM = quarterBPM * 2;
        const dottedQuarterBPM = Math.round(quarterBPM / 1.5);
        if (parseInt(eighthNoteInput.value, 10) !== eighthBPM) eighthNoteInput.value = eighthBPM;
        if (parseInt(quarterNoteInput.value, 10) !== quarterBPM) quarterNoteInput.value = quarterBPM;
        if (parseInt(dottedQuarterInput.value, 10) !== dottedQuarterBPM) dottedQuarterInput.value = dottedQuarterBPM;
        if (store.state.tempo !== quarterBPM) {
            store.setTempo(quarterBPM);
        }
    }

    tempoSlider.addEventListener('input', (e) => {
        updateTempoDisplays(parseInt(e.target.value, 10));
    });
    eighthNoteInput.addEventListener('input', (e) => {
        const eighthBPM = parseInt(e.target.value, 10);
        if (!isNaN(eighthBPM) && eighthBPM > 0) {
            updateTempoDisplays(eighthBPM / 2);
        }
    });
    quarterNoteInput.addEventListener('input', (e) => {
        const quarterBPM = parseInt(e.target.value, 10);
        if (!isNaN(quarterBPM) && quarterBPM > 0) {
            updateTempoDisplays(quarterBPM);
        }
    });
    dottedQuarterInput.addEventListener('input', (e) => {
        const dottedQuarterBPM = parseInt(e.target.value, 10);
        if (!isNaN(dottedQuarterBPM) && dottedQuarterBPM > 0) {
            updateTempoDisplays(dottedQuarterBPM * 1.5);
        }
    });
    updateTempoDisplays(store.state.tempo);

    document.getElementById('preset-sine').addEventListener('click', () => {
        store.state.adsr = { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.3 };
        store.emit('adsrChanged', store.state.adsr);
        store.setHarmonicCoefficients(generateSineCoeffs());
        store.setActivePreset('sine');
    });
    document.getElementById('preset-triangle').addEventListener('click', () => {
        store.state.adsr = { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.3 };
        store.emit('adsrChanged', store.state.adsr);
        store.setHarmonicCoefficients(generateTriangleCoeffs());
        store.setActivePreset('triangle');
    });
    document.getElementById('preset-square').addEventListener('click', () => {
        store.state.adsr = { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.3 };
        store.emit('adsrChanged', store.state.adsr);
        store.setHarmonicCoefficients(generateSquareCoeffs());
        store.setActivePreset('square');
    });
    document.getElementById('preset-sawtooth').addEventListener('click', () => {
        store.state.adsr = { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.3 };
        store.emit('adsrChanged', store.state.adsr);
        store.setHarmonicCoefficients(generateSawtoothCoeffs());
        store.setActivePreset('sawtooth');
    });
    document.getElementById('preset-piano').addEventListener('click', () => {
        const preset = generatePianoPreset();
        store.state.adsr = preset.adsr;
        store.emit('adsrChanged', preset.adsr);
        store.setHarmonicCoefficients(preset.coeffs);
        store.setActivePreset(preset.name);
    });
    document.getElementById('preset-strings').addEventListener('click', () => {
        const preset = generateStringsPreset();
        store.state.adsr = preset.adsr;
        store.emit('adsrChanged', preset.adsr);
        store.setHarmonicCoefficients(preset.coeffs);
        store.setActivePreset(preset.name);
    });
    document.getElementById('preset-woodwind').addEventListener('click', () => {
        const preset = generateWoodwindPreset();
        store.state.adsr = preset.adsr;
        store.emit('adsrChanged', preset.adsr);
        store.setHarmonicCoefficients(preset.coeffs);
        store.setActivePreset(preset.name);
    });
    document.getElementById('preset-marimba').addEventListener('click', () => {
        const preset = generateMarimbaPreset();
        store.state.adsr = preset.adsr;
        store.emit('adsrChanged', preset.adsr);
        store.setHarmonicCoefficients(preset.coeffs);
        store.setActivePreset(preset.name);
    });

    store.on('presetChanged', (presetName) => {
        document.querySelectorAll('.preset-button').forEach(btn => btn.classList.remove('selected'));
        const activeBtn = document.getElementById(`preset-${presetName}`);
        if (activeBtn) {
            activeBtn.classList.add('selected');
        }
    });
}

function initGridControls() {
    document.getElementById('grid-expand-button').addEventListener('click', () => ConfigService.zoomIn());
    document.getElementById('grid-shrink-button').addEventListener('click', () => ConfigService.zoomOut());
    document.getElementById('fit-to-width').addEventListener('click', () => ConfigService.fitToWidth());
    document.getElementById('fit-to-height').addEventListener('click', () => ConfigService.fitToHeight());
    document.getElementById('shift-up-button').addEventListener('click', () => store.shiftGridUp());
    document.getElementById('shift-down-button').addEventListener('click', () => store.shiftGridDown());
    document.getElementById('macrobeat-increase').addEventListener('click', () => store.increaseMacrobeatCount());
    document.getElementById('macrobeat-decrease').addEventListener('click', () => store.decreaseMacrobeatCount());
}

const Toolbar = {
    init() {
        initNoteBank();
        initToolSelectors();
        initPlaybackControls();
        initAudioControls();
        initGridControls();
        initImportExport();
        console.log("ToolbarComponent: All controls initialized.");
    },
    renderRhythmUI() {
        renderRhythmUI();
        renderTimeSignatureDisplay();
    }
};

export default Toolbar;