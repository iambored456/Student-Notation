// js/components/PitchPaint/paintControls.js
import store from '../../state/index.js';
import PitchPaintService from '../../services/pitchPaintService.js';
import PaintCanvas from './paintCanvas.js';
import DraggableNumber from '../UI/DraggableNumber.js';

class PaintControls {
  constructor() {
    this.elements = {};
    this.draggableControls = {};
  }

  initialize() {
    this.cacheDOMElements();
    if (!this.elements.toggleBtn) return;

    this.initializeDraggableControls();
    this.setupEventListeners();
    this.updateUI();
    
    store.on('micPaintStateChanged', () => this.updateUI());
    store.on('paintHistoryChanged', () => this.updateUI());
    store.on('paintSettingsChanged', () => this.updateUI());
    
  }

  cacheDOMElements() {
    this.elements.toggleBtn = document.getElementById('mic-paint-toggle');
    this.elements.clearBtn = document.getElementById('paint-clear-btn');
  }

  initializeDraggableControls() {
    // Draggable number config similar to tempo controls
    const paintControlConfig = {
      size: [45, 24],
      step: 1,
      decimalPlaces: 0,
      useAppStyling: true
    };

    // Initialize Thickness draggable (2-20, default 6)
    this.draggableControls.thickness = new DraggableNumber('#trail-thickness', {
      ...paintControlConfig,
      value: 6,
      min: 2,
      max: 20
    });

    // Initialize Opacity draggable (20-100, default 80)
    this.draggableControls.opacity = new DraggableNumber('#trail-opacity', {
      ...paintControlConfig,
      value: 80,
      min: 20,
      max: 100
    });
  }

  setupEventListeners() {
    this.elements.toggleBtn.addEventListener('click', () => this.handleMicPaintToggle());
    this.elements.clearBtn.addEventListener('click', () => this.handleClearPaint());

    // Set up draggable number change listeners
    this.draggableControls.thickness.onChange = (value) => {
      store.setPaintSettings({ thickness: value });
    };

    this.draggableControls.opacity.onChange = (value) => {
      store.setPaintSettings({ opacity: value });
    };
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

  updateUI() {
    const { isMicPaintActive, paintHistory, paintSettings } = store.state.paint;

    this.elements.toggleBtn.textContent = isMicPaintActive ? 'Mic Paint (ON)' : 'Mic Paint (OFF)';
    this.elements.toggleBtn.classList.toggle('active', isMicPaintActive);
    
    this.elements.clearBtn.disabled = paintHistory.length === 0;

    // Update draggable controls with current values
    if (this.draggableControls.thickness && this.draggableControls.thickness.value !== paintSettings.thickness) {
      this.draggableControls.thickness.passiveUpdate(paintSettings.thickness);
    }
    if (this.draggableControls.opacity && this.draggableControls.opacity.value !== paintSettings.opacity) {
      this.draggableControls.opacity.passiveUpdate(paintSettings.opacity);
    }
  }
}

export default new PaintControls();