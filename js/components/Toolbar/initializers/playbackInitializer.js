// js/components/Toolbar/initializers/playbackInitializer.js
import store from '../../../state/index.js';
import TransportService from '../../../services/transportService.js';

export function initPlaybackControls() {
    const playBtn = document.getElementById('play-button');
    const stopBtn = document.getElementById('stop-button');
    const clearBtn = document.getElementById('clear-button');
    const loopBtn = document.getElementById('loop-button');
    const undoBtn = document.getElementById('undo-button');
    const redoBtn = document.getElementById('redo-button');

    if (playBtn) {
        playBtn.addEventListener('click', () => {
            const { isPlaying, isPaused } = store.state;
            if (isPlaying && isPaused) {
                store.setPlaybackState(true, false);
                TransportService.resume();
            } else if (isPlaying && !isPaused) {
                store.setPlaybackState(true, true);
                TransportService.pause();
            } else {
                store.setPlaybackState(true, false);
                TransportService.start();
            }
        });
    }

    if(stopBtn) stopBtn.addEventListener('click', () => {
        store.setPlaybackState(false, false);
        TransportService.stop();
    });
    
    if(clearBtn) clearBtn.addEventListener('click', () => store.clearAllNotes());
    if(loopBtn) loopBtn.addEventListener('click', () => store.setLooping(!store.state.isLooping));
    if(undoBtn) undoBtn.addEventListener('click', () => store.undo());
    if(redoBtn) redoBtn.addEventListener('click', () => store.redo());

    store.on('playbackStateChanged', ({ isPlaying, isPaused }) => {
        if (playBtn) {
            playBtn.textContent = (isPlaying && !isPaused) ? "⏸" : "⏵";
            playBtn.classList.toggle("active", isPlaying && !isPaused);
        }
    });
    store.on('loopingChanged', isLooping => {
        if (loopBtn) loopBtn.classList.toggle('active', isLooping);
    });

    const updateHistoryButtons = () => {
        if (undoBtn) undoBtn.disabled = store.state.historyIndex <= 0;
        if (redoBtn) redoBtn.disabled = store.state.historyIndex >= store.state.history.length - 1;
    };

    store.on('historyChanged', updateHistoryButtons);
    updateHistoryButtons();
}