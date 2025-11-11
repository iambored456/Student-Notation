// js/components/PitchPaint/paintControls.js
import store from '@state/index.js';
import PitchPaintService from '@services/pitchPaintService.js';
import PaintCanvas from './paintCanvas.js';

class PaintControls {
  constructor() {
    this.elements = {};
  }

  initialize() {
    this.cacheDOMElements();
    if (!this.elements.toggleBtn) return;

    this.setupEventListeners();
    this.updateUI();
    
    store.on('micPaintStateChanged', () => this.updateUI());
    store.on('paintHistoryChanged', () => this.updateUI());
    store.on('paintSettingsChanged', () => this.updateUI());
    
  }

  cacheDOMElements() {
    this.elements.toggleBtn = document.getElementById('mic-paint-toggle');
    this.elements.clearBtn = document.getElementById('paint-clear-btn');
    this.elements.thicknessSelect = document.getElementById('sidebar-trail-thickness');
    this.elements.opacitySelect = document.getElementById('sidebar-trail-opacity');
    this.elements.colorToggle = document.getElementById('paint-color-toggle');
    this.elements.playbackToggle = document.getElementById('paint-playback-toggle');
  }

  setupEventListeners() {
    this.elements.toggleBtn.addEventListener('click', () => this.handleMicPaintToggle());
    this.elements.clearBtn.addEventListener('click', () => this.handleClearPaint());

    // Set up dropdown change listeners
    this.elements.thicknessSelect.addEventListener('change', (e) => {
      const thickness = parseInt(e.target.value, 10);
      store.setPaintSettings({ thickness });
    });

    this.elements.opacitySelect.addEventListener('change', (e) => {
      const opacity = parseInt(e.target.value, 10);
      store.setPaintSettings({ opacity });
    });

    // Set up color toggle listener
    this.elements.colorToggle.addEventListener('click', () => this.handleColorToggle());
    
    // Set up playback toggle listener
    this.elements.playbackToggle.addEventListener('click', () => this.handlePlaybackToggle());
  }

  async handleMicPaintToggle() {
    const isCurrentlyActive = store.state.paint.isMicPaintActive;
    this.elements.toggleBtn.disabled = true;
    
    if (!isCurrentlyActive) {
      try {
        await PitchPaintService.initialize();
        store.setMicPaintActive(true);
        PitchPaintService.startDetection();
      } catch (error) {
        alert('Microphone access is required for Pitch Painting. Please check your browser permissions and try again.');
        store.setMicPaintActive(false);
      }
    } else {
      PitchPaintService.stopDetection();
      store.setMicPaintActive(false);
    }
    this.elements.toggleBtn.disabled = false;
  }

  handleClearPaint() {
    if (confirm('Are you sure you want to clear the painted pitch trail? This cannot be undone.')) {
      PaintCanvas.clear();
    }
  }

  handleColorToggle() {
    const currentMode = store.state.paint.paintSettings.colorMode;
    const newMode = currentMode === 'chromatic' ? 'shapenote' : 'chromatic';
    store.setPaintSettings({ colorMode: newMode });
  }

  handlePlaybackToggle() {
    const currentEnabled = store.state.paint.paintSettings.playbackEnabled;
    store.setPaintSettings({ playbackEnabled: !currentEnabled });
  }

  updateUI() {
    const { isMicPaintActive, paintHistory, paintSettings } = store.state.paint;

    this.elements.toggleBtn.textContent = isMicPaintActive ? 'Mic Paint (ON)' : 'Mic Paint (OFF)';
    this.elements.toggleBtn.classList.toggle('active', isMicPaintActive);
    
    this.elements.clearBtn.disabled = paintHistory.length === 0;

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