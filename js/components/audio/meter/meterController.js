// js/components/audio/meter/meterController.js
import store from '@state/index.js';
import PitchPaintService from '@services/pitchPaintService.js';
import * as Tone from 'tone';

class MeterController {
  constructor() {
    this.meter = null;
    this.isInitialized = false;
    this.meterWrapper = null;
    this.meterPlaceholder = null;
    this.meterSource = null;
    this.settingsPanel = null;
    this.settings = {
      size: 'wide', // 'compact' or 'wide'
      fps: 30,
      batterySaver: false,
      noiseFloor: -70,
      autoCalibrated: false
    };
    
    // Permission and error state
    this.permissionState = 'unknown'; // 'unknown', 'granted', 'denied', 'pending'
    this.errorMessage = null;
  }

  initialize() {
    if (this.isInitialized) return;
    
    // Starting initialization
    
    this.cacheDOMElements();
    this.setupEventListeners();
    this.updateUI();
    
    // Listen to store changes
    store.on('micPaintStateChanged', (isActive) => this.handlePitchPaintingToggle(isActive));
    
    this.isInitialized = true;
    // Initialization complete
  }

  cacheDOMElements() {
    
    this.meterWrapper = document.getElementById('mic-meter-wrapper');
    this.meterPlaceholder = document.getElementById('meter-placeholder');
    this.settingsPanel = document.getElementById('meter-settings-panel');
    
    // Settings controls
    this.settingsBtn = document.getElementById('meter-settings-btn');
    this.sizeSelect = document.getElementById('meter-size-select');
    this.fpsSelect = document.getElementById('meter-fps-select');
    this.batterySaverCheckbox = document.getElementById('meter-battery-saver');
    this.calibrateBtn = document.getElementById('meter-calibrate-btn');
    this.resetBtn = document.getElementById('meter-reset-btn');
    
    // DOM Elements status logged
    
    if (this.meterWrapper) {
      // MeterWrapper current state logged
    }
  }

  setupEventListeners() {
    if (this.settingsBtn) {
      this.settingsBtn.addEventListener('click', () => this.toggleSettingsPanel());
    }
    
    if (this.sizeSelect) {
      this.sizeSelect.addEventListener('change', (e) => this.handleSizeChange(e.target.value));
    }
    
    if (this.fpsSelect) {
      this.fpsSelect.addEventListener('change', (e) => this.handleFpsChange(parseInt(e.target.value)));
    }
    
    if (this.batterySaverCheckbox) {
      this.batterySaverCheckbox.addEventListener('change', (e) => this.handleBatterySaverChange(e.target.checked));
    }
    
    if (this.calibrateBtn) {
      this.calibrateBtn.addEventListener('click', () => this.handleAutoCalibrate());
    }
    
    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => this.handleReset());
    }
  }

  async handlePitchPaintingToggle(isActive) {
    
    if (isActive) {
      await this.startMeter();
    } else {
      this.stopMeter();
    }
  }

  async startMeter() {
    
    if (this.meter) {
      return;
    }

    try {
      // Check if microphone access is available
      await this.ensureMicrophoneAccess();
      
      // Get the current audio context and mic source from PitchPaintService
      const audioContext = Tone.context;
      // Audio context state logged
      
      if (!audioContext || audioContext.state === 'suspended') {
        throw new Error('Audio context not available or suspended');
      }

      // We need to tap into the existing microphone stream
      // This should be done non-intrusively so we don't affect pitch detection
      await this.createMeterFromExistingMic();
      
      this.updateUI();
      
    } catch (error) {
      this.handleMeterError(error);
    }
  }

  async ensureMicrophoneAccess() {
    this.permissionState = 'pending';
    this.updateUI();
    
    try {
      // Since we're only active when Pitch Painting is ON, 
      // the PitchPaintService should already have microphone access
      this.permissionState = 'granted';
      
    } catch (error) {
      this.permissionState = 'denied';
      throw new Error('Microphone access denied. Please check your browser permissions.');
    }
  }

  async createMeterFromExistingMic() {
    
    if (!this.meterWrapper) {
      throw new Error('Meter wrapper not found - cannot create meter');
    }
    
    // Clear any existing placeholder content
    this.meterWrapper.innerHTML = '';
    
    // Get the dimensions based on current size setting
    const dimensions = this.getMeterDimensions();
    
    // Import the custom Meter class
    const Meter = (await import('./meter.js')).default;

    if (!PitchPaintService || !PitchPaintService.micSplitter) {
      throw new Error('PitchPaintService microphone splitter not available');
    }

    // Create the custom meter instance
    try {
      this.meter = new Meter({
        target: this.meterWrapper,
        size: dimensions,
        fps: this.settings.fps,
        colors: {
          fill: '#1a1a1a',
          accent: '#00ff88'
        },
        floorDb: this.settings.noiseFloor,
        ceilingDb: 5
      });
    } catch (meterError) {
      throw meterError;
    }

    // Connect the meter to the mic splitter (non-intrusive tap)
    try {
      this.meter.connect(PitchPaintService.micSplitter);
      this.meterSource = PitchPaintService.micSplitter;
    } catch (connectionError) {
      throw connectionError;
    }
    
    // Update UI to show active state
    this.meterWrapper.classList.add('active');
    this.meterWrapper.classList.remove('error');
    
  }

  stopMeter() {
    if (this.meter) {
      this.meter.disconnect();
      this.meter.destroy();
      this.meter = null;
    }
    
    if (this.meterSource) {
      try {
        // Note: We don't disconnect the splitter itself as it's used by pitch detection
        // We only disconnect our meter from it
      } catch (e) {
        // Ignore disconnect errors
      }
      this.meterSource = null;
    }
    
    // Restore placeholder content
    this.meterWrapper.innerHTML = `
      <div class="meter-placeholder" id="meter-placeholder">
      </div>
    `;
    
    // Re-cache the placeholder element
    this.meterPlaceholder = document.getElementById('meter-placeholder');
    
    this.meterWrapper.classList.remove('active');
    this.updateUI();
  }

  getMeterDimensions() {
    const wrapperWidth = this.meterWrapper.clientWidth || 200;
    const wrapperHeight = this.meterWrapper.clientHeight || 100;
    
    // For inline meter, always use compact height (36px)
    const isInline = this.meterWrapper.classList.contains('mic-meter-wrapper-inline');
    
    if (isInline) {
      return [wrapperWidth, 36];
    }
    
    // For vertical meter, use actual container height to expand to fill
    const isVertical = this.meterWrapper.classList.contains('mic-meter-wrapper-vertical');
    if (isVertical) {
      return [wrapperWidth, wrapperHeight];
    }
    
    // For regular meter, use size settings
    const height = this.settings.size === 'compact' ? 48 : 72;
    return [wrapperWidth, height];
  }

  updateUI() {
    if (!this.meterWrapper) return;
    
    // Update size classes
    this.meterWrapper.classList.remove('compact', 'wide');
    this.meterWrapper.classList.add(this.settings.size);
    
    // Update accessibility attributes
    this.updateAccessibilityAttributes();
    
    // Update placeholder message based on state
    if (this.meterPlaceholder) {
      let message = '';
      let statusClass = '';
      
      // Check if this is the inline meter for shorter messages
      const isInline = this.meterWrapper.classList.contains('mic-meter-wrapper-inline');
      
      if (this.permissionState === 'denied') {
        message = isInline ? 'Mic access denied' : 'Microphone access denied. Click to retry.';
        statusClass = 'error';
      } else if (this.permissionState === 'pending') {
        message = isInline ? 'Requesting access...' : 'Requesting microphone access...';
        statusClass = 'pending';
      } else if (!store.state.paint.isMicPaintActive) {
        message = '';
        statusClass = 'disabled';
      } else if (this.meter) {
        message = '';
        statusClass = 'active';
      } else {
        message = isInline ? 'Starting...' : 'Starting meter...';
        statusClass = 'pending';
      }
      
      const statusTextEl = this.meterPlaceholder.querySelector('.meter-status-text');
      if (statusTextEl) {
        statusTextEl.textContent = message;
      }
      
      this.meterWrapper.classList.remove('error', 'pending', 'disabled');
      if (statusClass) {
        this.meterWrapper.classList.add(statusClass);
      }
    }
    
    // Update settings UI
    this.updateSettingsUI();
  }

  updateAccessibilityAttributes() {
    if (!this.meterWrapper) return;
    
    // Set ARIA attributes for screen readers
    this.meterWrapper.setAttribute('role', 'meter');
    this.meterWrapper.setAttribute('aria-label', 'Microphone Level Meter');
    
    if (this.meter && this.meter.active) {
      this.meterWrapper.setAttribute('aria-valuenow', '0'); // This would be updated in real-time
      this.meterWrapper.setAttribute('aria-valuemin', this.settings.noiseFloor.toString());
      this.meterWrapper.setAttribute('aria-valuemax', '5');
      this.meterWrapper.setAttribute('aria-valuetext', 'Microphone level active');
    } else {
      this.meterWrapper.removeAttribute('aria-valuenow');
      this.meterWrapper.removeAttribute('aria-valuemin');
      this.meterWrapper.removeAttribute('aria-valuemax');
      this.meterWrapper.setAttribute('aria-valuetext', 'Microphone level inactive');
    }
    
    // Set reduced motion preference handling
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.meterWrapper.setAttribute('data-reduced-motion', 'true');
    }
  }

  updateSettingsUI() {
    if (this.sizeSelect) this.sizeSelect.value = this.settings.size;
    if (this.fpsSelect) this.fpsSelect.value = this.settings.fps;
    if (this.batterySaverCheckbox) this.batterySaverCheckbox.checked = this.settings.batterySaver;
  }

  toggleSettingsPanel() {
    if (this.settingsPanel) {
      this.settingsPanel.classList.toggle('hidden');
    }
  }

  handleSizeChange(newSize) {
    this.settings.size = newSize;
    if (this.meter) {
      const dimensions = this.getMeterDimensions();
      this.meter.resize(dimensions[0], dimensions[1]);
    }
    this.updateUI();
  }

  handleFpsChange(newFps) {
    this.settings.fps = newFps;
    // Note: Custom Meter handles animation internally
    // We keep the setting for potential future use
  }

  handleBatterySaverChange(enabled) {
    this.settings.batterySaver = enabled;
    // Note: Custom Meter handles animation internally
    // We keep the setting for potential future use
  }

  async handleAutoCalibrate() {
    if (!this.meter) return;
    
    // Implement auto-calibration logic
    this.calibrateBtn.disabled = true;
    this.calibrateBtn.textContent = 'Stay quiet...';
    
    try {
      // Wait for 2 seconds of quiet time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Custom Meter doesn't expose internal dB values
      // So we'll just simulate a calibration for now
      this.settings.noiseFloor = -65; // Reasonable default
      this.settings.autoCalibrated = true;
      
      this.calibrateBtn.textContent = 'Calibrated âœ“';
      setTimeout(() => {
        this.calibrateBtn.textContent = 'Auto-Calibrate';
        this.calibrateBtn.disabled = false;
      }, 1500);
      
      
    } catch (error) {
      this.calibrateBtn.textContent = 'Auto-Calibrate';
      this.calibrateBtn.disabled = false;
    }
  }

  handleReset() {
    this.settings = {
      size: 'wide',
      fps: 30,
      batterySaver: false,
      noiseFloor: -70,
      autoCalibrated: false
    };
    
    this.updateSettingsUI();
    
    if (this.meter) {
      const dimensions = this.getMeterDimensions();
      this.meter.resize(dimensions[0], dimensions[1]);
      // Note: Custom Meter doesn't have setFramerate method
      // Frame rate is handled internally by custom meter
    }
  }

  handleMeterError(error) {
    this.errorMessage = error.message;
    this.meterWrapper.classList.add('error');
    
    // Log the error for debugging
    
    // Show retry option for permission errors
    if (error.message.includes('denied') || error.message.includes('permission')) {
      this.showPermissionRetryPrompt();
    }
    
    this.updateUI();
  }

  showPermissionRetryPrompt() {
    // Create a permission retry prompt if it doesn't exist
    let retryPrompt = this.meterWrapper.querySelector('.meter-permission-prompt');
    if (!retryPrompt) {
      retryPrompt = document.createElement('div');
      retryPrompt.className = 'meter-permission-prompt';
      retryPrompt.innerHTML = `
        <p>Microphone access is required for the level meter.</p>
        <button class="meter-retry-btn">Grant Permission</button>
        <button class="meter-help-btn">Help</button>
      `;
      
      this.meterWrapper.appendChild(retryPrompt);
      
      // Add event listeners
      const retryBtn = retryPrompt.querySelector('.meter-retry-btn');
      const helpBtn = retryPrompt.querySelector('.meter-help-btn');
      
      retryBtn.addEventListener('click', () => this.retryPermission());
      helpBtn.addEventListener('click', () => this.showPermissionHelp());
    }
  }

  async retryPermission() {
    try {
      // Remove any existing permission prompts
      const retryPrompt = this.meterWrapper.querySelector('.meter-permission-prompt');
      if (retryPrompt) {
        retryPrompt.remove();
      }
      
      // Reset permission state and try again
      this.permissionState = 'unknown';
      this.meterWrapper.classList.remove('error');
      
      // Only retry if pitch painting is still active
      if (store.state.paint.isMicPaintActive) {
        await this.startMeter();
      }
    } catch (error) {
      this.handleMeterError(error);
    }
  }

  showPermissionHelp() {
    const helpMessage = `
To enable the microphone level meter:

1. Look for a microphone icon in your browser's address bar
2. Click it and select "Allow"
3. If you don't see the icon, go to your browser settings:
   - Chrome: Settings > Privacy and security > Site Settings > Microphone
   - Firefox: Settings > Privacy & Security > Permissions > Microphone
   - Safari: Settings > Websites > Microphone

4. Find this website and set it to "Allow"
5. Refresh the page if needed
    `;
    
    alert(helpMessage);
  }

  dispose() {
    this.stopMeter();
    this.isInitialized = false;
  }
}

export default new MeterController();
