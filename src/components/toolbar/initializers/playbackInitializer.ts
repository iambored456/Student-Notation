// js/components/toolbar/initializers/playbackInitializer.ts
import store from '@state/index.ts';
import TransportService from '@services/transportService.ts';
import { clearAllStamps } from '@/rhythm/stampPlacements.js';
import { clearAllTripletPlacements } from '@/rhythm/tripletPlacements.js';
import { getIconPath } from '@utils/assetPaths.ts';

interface PlaybackStateEvent {
  isPlaying: boolean;
  isPaused: boolean;
}

export function initPlaybackControls(): void {
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
      // Remove focus to prevent lingering blue highlight
      // playBtn.blur(); // TEMP: Disabled to test if this causes double-click
    });
  }

  if(stopBtn) {stopBtn.addEventListener('click', () => {
    store.setPlaybackState(false, false);
    TransportService.stop();
    stopBtn.blur(); // Remove focus to prevent lingering blue highlight
  });}

  if(clearBtn) {clearBtn.addEventListener('click', () => {
    clearBtn.classList.add('flash');
    setTimeout(() => clearBtn.classList.remove('flash'), 300);
    store.clearAllNotes();
    clearAllStamps();
    clearAllTripletPlacements();
    clearBtn.blur(); // Remove focus to prevent lingering blue highlight
  });}

  if(loopBtn) {loopBtn.addEventListener('click', () => {
    store.setLooping(!store.state.isLooping);
    // Don't blur the loop button since it should maintain its active state
  });}

  if(undoBtn) {undoBtn.addEventListener('click', () => {
    store.undo();
    undoBtn.blur(); // Remove focus to prevent lingering blue highlight
  });}

  if(redoBtn) {redoBtn.addEventListener('click', () => {
    store.redo();
    redoBtn.blur(); // Remove focus to prevent lingering blue highlight
  });}

  store.on('playbackStateChanged', (data: unknown) => {
    const { isPlaying, isPaused } = data as PlaybackStateEvent;
    if (playBtn) {
      const playIcon = `<img src="${getIconPath('play.svg')}" alt="Play">`;
      const pauseIcon = `<img src="${getIconPath('pause.svg')}" alt="Pause">`;
      playBtn.innerHTML = (isPlaying && !isPaused) ? pauseIcon : playIcon;

    }
  });
  store.on('loopingChanged', (data: unknown) => {
    const isLooping = data as boolean;
    if (loopBtn) {loopBtn.classList.toggle('active', isLooping);}
  });

  const updateHistoryButtons = (): void => {
    if (undoBtn) {(undoBtn as HTMLButtonElement).disabled = store.state.historyIndex <= 0;}
    if (redoBtn) {(redoBtn as HTMLButtonElement).disabled = store.state.historyIndex >= store.state.history.length - 1;}
  };

  store.on('historyChanged', updateHistoryButtons);
  updateHistoryButtons();
}
