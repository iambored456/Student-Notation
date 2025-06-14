// js/components/Toolbar/Toolbar.js
import store from '../../state/store.js';
import ConfigService from '../../services/configService.js';
import SynthEngine from '../../services/synthEngine.js';
import TransportService from '../../services/transportService.js';
import { renderRhythmUI } from './rhythmUI.js';
import { renderTimeSignatureDisplay } from './timeSignatureDisplay.js';

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
        link.style.visibility = 'hidden';
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
                const lines = content.split('\n').filter(line => line.trim() !== '');
                const importedNotes = lines.map(line => {
                    const parts = line.split(',');
                    return {
                        row: parseInt(parts[0]),
                        startColumnIndex: parseInt(parts[1]),
                        endColumnIndex: parseInt(parts[2]),
                        color: parts[3],
                        shape: parts[4],
                        tonicNumber: parts[5] || null,
                        isDrum: parts[6] === 'true',
                        drumTrack: parts[7] || null
                    };
                });
                store.loadNotes(importedNotes);
                console.log(`Toolbar: Imported ${importedNotes.length} notes.`);
            }
            reader.readAsText(file);
        }
        input.click();
    });
}

function initNoteSelection() {
    const noteBanks = document.querySelectorAll('.note-bank-container .note');
    const eraserTool = document.getElementById('eraser-tool');
    const tonicButtons = document.querySelectorAll('.tonicization-container .tonicization-button');

    noteBanks.forEach(note => {
        note.addEventListener('click', () => {
            const color = note.getAttribute('data-color');
            const type = note.getAttribute('data-type');
            store.setSelectedTool(type, color);
        });
    });

    eraserTool.addEventListener('click', () => store.setSelectedTool('eraser'));

    tonicButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tonicNumber = btn.getAttribute('data-tonic');
            // Using a consistent color for tonicization notes for now
            store.setSelectedTool('tonicization', '#000000', tonicNumber);
        });
    });
    
    // Listen for tool changes to update the UI (e.g., 'selected' class)
    store.on('toolChanged', (selectedTool) => {
        // Clear all previous selections
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

    playBtn.addEventListener('click', () => {
        if (!store.state.isPlaying || store.state.isPaused) {
            store.setPlaybackState(true, false);
            TransportService.start();
        } else {
            store.setPlaybackState(true, true); // Still "playing", but paused
            TransportService.pause();
        }
    });

    stopBtn.addEventListener('click', () => {
        store.setPlaybackState(false, false);
        TransportService.stop();
    });
    
    clearBtn.addEventListener('click', () => store.clearAllNotes());
    loopBtn.addEventListener('click', () => store.setLooping(!store.state.isLooping));

    // Update UI based on playback state changes
    store.on('playbackStateChanged', ({ isPlaying, isPaused }) => {
        if (isPlaying && !isPaused) {
            playBtn.textContent = "⏸";
            playBtn.classList.add("active");
        } else {
            playBtn.textContent = "⏵";
            playBtn.classList.remove("active");
        }
    });
    store.on('loopingChanged', (isLooping) => {
        loopBtn.classList.toggle('active', isLooping);
    });
}

function initAudioControls() {
    // Sliders
    document.getElementById('volume-slider').addEventListener('input', function() {
        const dB = (parseInt(this.value, 10) / 100) * 40 - 40; // Range from -40dB to 0dB
        SynthEngine.setVolume(dB);
    });
    document.getElementById('tempo-slider').addEventListener('input', function() {
        store.setTempo(parseInt(this.value, 10));
    });

    // Preset Buttons
    document.getElementById('preset-sine').addEventListener('click', () => SynthEngine.setOscillatorType('sine'));
    document.getElementById('preset-triangle').addEventListener('click', () => SynthEngine.setOscillatorType('triangle'));
    document.getElementById('preset-square').addEventListener('click', () => SynthEngine.setOscillatorType('square'));
    document.getElementById('preset-sawtooth').addEventListener('click', () => {
        // Sawtooth is our custom default that uses the multislider
        SynthEngine.setOscillatorType('custom');
    });
}

function initGridControls() {
    // Zoom
    document.getElementById('grid-expand-button').addEventListener('click', () => ConfigService.zoomIn());
    document.getElementById('grid-shrink-button').addEventListener('click', () => ConfigService.zoomOut());
    document.getElementById('fit-to-width').addEventListener('click', () => ConfigService.fitToWidth());
    document.getElementById('fit-to-height').addEventListener('click', () => ConfigService.fitToHeight());

    // Shift
    document.getElementById('shift-up-button').addEventListener('click', () => store.shiftGridUp());
    document.getElementById('shift-down-button').addEventListener('click', () => store.shiftGridDown());

    // Macrobeat adjustments
    document.getElementById('macrobeat-increase').addEventListener('click', () => store.increaseMacrobeatCount());
    document.getElementById('macrobeat-decrease').addEventListener('click', () => store.decreaseMacrobeatCount());
}


const Toolbar = {
    init() {
        initNoteSelection();
        initPlaybackControls();
        initAudioControls();
        initGridControls();
        initImportExport(); // Add this call
        console.log("ToolbarComponent: All controls initialized.");
    },
    renderRhythmUI() {
        renderRhythmUI();
        renderTimeSignatureDisplay(); // Also render the time signature
    }
};

export default Toolbar;