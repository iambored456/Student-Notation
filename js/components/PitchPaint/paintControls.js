// js/components/PitchPaint/paintControls.js
import store from '../../state/index.js';
import PitchPaintService from '../../services/pitchPaintService.js';
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
    
    console.log('PaintControls: Initialized');
  }

  cacheDOMElements() {
    this.elements.toggleBtn = document.getElementById('mic-paint-toggle');
    this.elements.clearBtn = document.getElementById('paint-clear-btn');
    this.elements.thicknessSlider = document.getElementById('trail-thickness');
    this.elements.thicknessValue = document.getElementById('thickness-value');
    this.elements.opacitySlider = document.getElementById('trail-opacity');
    this.elements.opacityValue = document.getElementById('opacity-value');
  }

  setupEventListeners() {
    this.elements.toggleBtn.addEventListener('click', () => this.handleMicPaintToggle());
    this.elements.clearBtn.addEventListener('click', () => this.handleClearPaint());

    this.elements.thicknessSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value, 10);
      this.elements.thicknessValue.textContent = value;
      store.setPaintSettings({ thickness: value });
    });

    this.elements.opacitySlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value, 10);
      this.elements.opacityValue.textContent = `${value}%`;
      store.setPaintSettings({ opacity: value });
    });
  }

  async handleMicPaintToggle() {
    const isCurrentlyActive = store.state.paint.isMicPaintActive;
    this.elements.toggleBtn.disabled = true;
    
    if (!isCurrentlyActive) {
      try {
        await PitchPaintService.initialize();
        store.setMicPaintActive(true);
        PitchPaintService.startDetection();
        console.log('Mic Paint: Activated');
      } catch (error) {
        console.error('Failed to activate Mic Paint:', error);
        alert('Microphone access is required for Pitch Painting. Please check your browser permissions and try again.');
        store.setMicPaintActive(false);
      }
    } else {
      PitchPaintService.stopDetection();
      store.setMicPaintActive(false);
      console.log('Mic Paint: Deactivated');
    }
    this.elements.toggleBtn.disabled = false;
  }

  handleClearPaint() {
    if (confirm('Are you sure you want to clear the painted pitch trail? This cannot be undone.')) {
      PaintCanvas.clear();
    }
  }

  updateUI() {
    const { isMicPaintActive, paintHistory, paintSettings } = store.state.paint;

    this.elements.toggleBtn.textContent = isMicPaintActive ? 'Mic Paint (ON)' : 'Mic Paint (OFF)';
    this.elements.toggleBtn.classList.toggle('active', isMicPaintActive);
    
    this.elements.clearBtn.disabled = paintHistory.length === 0;

    this.elements.thicknessSlider.value = paintSettings.thickness;
    this.elements.thicknessValue.textContent = paintSettings.thickness;
    this.elements.opacitySlider.value = paintSettings.opacity;
    this.elements.opacityValue.textContent = `${paintSettings.opacity}%`;
  }
}

export default new PaintControls();