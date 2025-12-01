// js/components/PitchPaint/paintControls.ts
import store from '@state/index.ts';
import PitchPaintService from '@services/pitchPaintService.ts';
import PaintCanvas from './paintCanvas.js';

interface PaintControlElements {
  toggleBtn: HTMLElement | null;
  clearBtn: HTMLButtonElement | null;
  thicknessSelect: HTMLSelectElement | null;
  opacitySelect: HTMLSelectElement | null;
  colorToggle: HTMLElement | null;
  playbackToggle: HTMLElement | null;
}

class PaintControls {
  private elements: PaintControlElements = {
    toggleBtn: null,
    clearBtn: null,
    thicknessSelect: null,
    opacitySelect: null,
    colorToggle: null,
    playbackToggle: null
  };

  initialize(): void {
    this.cacheDOMElements();
    if (!this.elements.toggleBtn) {return;}

    this.setupEventListeners();
    this.updateUI();

    store.on('micPaintStateChanged', () => this.updateUI());
    store.on('paintHistoryChanged', () => this.updateUI());
    store.on('paintSettingsChanged', () => this.updateUI());

  }

  cacheDOMElements(): void {
    this.elements.toggleBtn = document.getElementById('mic-paint-toggle');
    this.elements.clearBtn = document.getElementById('paint-clear-btn') as HTMLButtonElement | null;
    this.elements.thicknessSelect = document.getElementById('sidebar-trail-thickness') as HTMLSelectElement | null;
    this.elements.opacitySelect = document.getElementById('sidebar-trail-opacity') as HTMLSelectElement | null;
    this.elements.colorToggle = document.getElementById('paint-color-toggle');
    this.elements.playbackToggle = document.getElementById('paint-playback-toggle');
  }

  setupEventListeners(): void {
    this.elements.toggleBtn!.addEventListener('click', () => void this.handleMicPaintToggle());
    this.elements.clearBtn!.addEventListener('click', () => this.handleClearPaint());

    // Set up dropdown change listeners
    this.elements.thicknessSelect!.addEventListener('change', (e: Event) => {
      const thickness = parseInt((e.target as HTMLSelectElement).value, 10);
      store.setPaintSettings({ thickness });
    });

    this.elements.opacitySelect!.addEventListener('change', (e: Event) => {
      const opacity = parseInt((e.target as HTMLSelectElement).value, 10);
      store.setPaintSettings({ opacity });
    });

    // Set up color toggle listener
    this.elements.colorToggle!.addEventListener('click', () => this.handleColorToggle());

    // Set up playback toggle listener
    this.elements.playbackToggle!.addEventListener('click', () => this.handlePlaybackToggle());
  }

  async handleMicPaintToggle(): Promise<void> {
    const isCurrentlyActive = store.state.paint.isMicPaintActive;
    (this.elements.toggleBtn as HTMLButtonElement).disabled = true;

    if (!isCurrentlyActive) {
      try {
        await PitchPaintService.initialize();
        store.setMicPaintActive(true);
        PitchPaintService.startDetection();
      } catch {
        alert('Microphone access is required for Pitch Painting. Please check your browser permissions and try again.');
        store.setMicPaintActive(false);
      }
    } else {
      PitchPaintService.stopDetection();
      store.setMicPaintActive(false);
    }
    (this.elements.toggleBtn as HTMLButtonElement).disabled = false;
  }

  handleClearPaint(): void {
    if (confirm('Are you sure you want to clear the painted pitch trail? This cannot be undone.')) {
      PaintCanvas.clear();
    }
  }

  handleColorToggle(): void {
    const currentMode = store.state.paint.paintSettings.colorMode;
    const newMode = currentMode === 'chromatic' ? 'shapenote' : 'chromatic';
    store.setPaintSettings({ colorMode: newMode });
  }

  handlePlaybackToggle(): void {
    const currentEnabled = store.state.paint.paintSettings.playbackEnabled;
    store.setPaintSettings({ playbackEnabled: !currentEnabled });
  }

  updateUI(): void {
    const { isMicPaintActive, paintHistory, paintSettings } = store.state.paint;

    this.elements.toggleBtn!.textContent = isMicPaintActive ? 'Mic Paint (ON)' : 'Mic Paint (OFF)';
    this.elements.toggleBtn!.classList.toggle('active', isMicPaintActive);

    this.elements.clearBtn!.disabled = paintHistory.length === 0;

    // Update dropdown selections with current values
    if (this.elements.thicknessSelect && this.elements.thicknessSelect.value !== paintSettings.thickness.toString()) {
      this.elements.thicknessSelect.value = paintSettings.thickness.toString();
    }
    if (this.elements.opacitySelect && this.elements.opacitySelect.value !== paintSettings.opacity.toString()) {
      this.elements.opacitySelect.value = paintSettings.opacity.toString();
    }

    // Update color toggle state
    if (this.elements.colorToggle) {
      const isShapeNote = paintSettings.colorMode === 'shapenote';
      this.elements.colorToggle.classList.toggle('active', isShapeNote);
    }

    // Update playback toggle state
    if (this.elements.playbackToggle) {
      this.elements.playbackToggle.classList.toggle('active', paintSettings.playbackEnabled);
    }
  }
}

export default new PaintControls();
