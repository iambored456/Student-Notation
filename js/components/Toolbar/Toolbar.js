// js/components/Toolbar/Toolbar.js
import store from '../../state/store.js';
import ConfigService from '../../services/configService.js';
import TransportService from '../../services/transportService.js';
import { renderRhythmUI } from './rhythmUI.js';
import { renderTimeSignatureDisplay } from './timeSignatureDisplay.js';
import { initNoteBank } from './noteBank.js';
import { PRESETS } from '../../services/presetData.js';

console.log("ToolbarComponent: Module loaded.");

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
    const tonicButtons = document.querySelectorAll('.tonic-sign-container .tonic-sign-button');

    tonicButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tonicNumber = btn.getAttribute('data-tonic');
            store.setSelectedTool('tonicization', '#000000', tonicNumber);
        });
    });
    
    store.on('toolChanged', (selectedTool) => {
        document.querySelectorAll('.note, .note-pair, .tonic-sign-button').forEach(el => el.classList.remove('selected'));
        
        if (selectedTool.type === 'tonicization') {
            document.querySelector(`.tonic-sign-button[data-tonic='${selectedTool.tonicNumber}']`)?.classList.add('selected');
        } else {
            const targetPair = document.querySelector(`.note-pair[data-color='${selectedTool.color}']`);
            if (targetPair) {
                const targetNote = targetPair.querySelector(`.note[data-type='${selectedTool.type}']`);
                if (targetNote) {
                    targetNote.classList.add('selected');
                    targetPair.classList.add('selected');
                }
            }
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
    };

    store.on('historyChanged', updateHistoryButtons);
    updateHistoryButtons();
}

function initAudioControls() {
    const volumeSlider = document.getElementById('volume-slider');
    const tempoSlider = document.getElementById('tempo-slider');

    // Volume Slider Logic
    volumeSlider.addEventListener('input', function() {
        const value = parseInt(this.value, 10);
        const dB = (value === 0) ? -Infinity : (value / 100) * 50 - 50;
        store.emit('volumeChanged', dB);
    });
    volumeSlider.addEventListener('mouseup', function() { this.blur(); });
    volumeSlider.dispatchEvent(new Event('input'));

    // Tempo Slider Logic
    const eighthNoteInput = document.getElementById('eighth-note-tempo');
    const quarterNoteInput = document.getElementById('quarter-note-tempo');
    const dottedQuarterInput = document.getElementById('dotted-quarter-tempo');

    function updateTempoDisplays(baseBPM) {
        const quarterBPM = Math.round(baseBPM);
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

    tempoSlider.addEventListener('input', (e) => updateTempoDisplays(parseInt(e.target.value, 10)));
    eighthNoteInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val > 0) updateTempoDisplays(val / 2);
    });
    quarterNoteInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val > 0) updateTempoDisplays(val);
    });
    dottedQuarterInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val > 0) updateTempoDisplays(val * 1.5);
    });
    tempoSlider.addEventListener('mouseup', function() { this.blur(); });
    updateTempoDisplays(store.state.tempo);

    // Preset Buttons
    document.querySelectorAll('.preset-button').forEach(button => {
        const presetId = button.id.replace('preset-', '');
        const preset = PRESETS[presetId];
        
        if (preset) {
            button.addEventListener('click', () => {
                store.applyPreset(preset);
            });
        }
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
    document.getElementById('grid-zoom-in').addEventListener('click', () => ConfigService.zoomIn());
    document.getElementById('grid-zoom-out').addEventListener('click', () => ConfigService.zoomOut());
    document.getElementById('grid-scroll-up').addEventListener('click', () => store.shiftGridUp());
    document.getElementById('grid-scroll-down').addEventListener('click', () => store.shiftGridDown());
    
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