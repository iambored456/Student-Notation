// js/components/Toolbar/initializers/playbackInitializer.js
import store from '../../../state/index.js'; // <-- UPDATED PATH
import TransportService from '../../../services/transportService.js';

export function initPlaybackControls() {
    const playBtn = document.getElementById('play-button');
    const stopBtn = document.getElementById('stop-button');
    const clearBtn = document.getElementById('clear-button');
    const loopBtn = document.getElementById('loop-button');
    const undoBtn = document.getElementById('undo-button');
    const redoBtn = document.getElementById('redo-button');

    playBtn.addEventListener('click', () => {
        const { isPlaying, isPaused } = store.state;

        // Condition 1: If it's currently paused, RESUME playback.
        if (isPlaying && isPaused) {
            store.setPlaybackState(true, false);
            TransportService.resume();
        } 
        // Condition 2: If it's currently playing, PAUSE it.
        else if (isPlaying && !isPaused) {
            store.setPlaybackState(true, true);
            TransportService.pause();
        }
        // Condition 3: If it's stopped, START playback from the beginning.
        else {
            store.setPlaybackState(true, false);
            TransportService.start();
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