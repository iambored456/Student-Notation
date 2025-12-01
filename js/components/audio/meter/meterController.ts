// js/components/audio/meter/meterController.js
import store from '@state/index.ts';
import PitchPaintService from '@services/pitchPaintService.ts';
import * as Tone from 'tone';

interface MeterInstance {
  connect: (node: AudioNode, channels?: number) => void;
  disconnect: () => void;
  destroy: () => void;
}

class MeterController {
  private meter: MeterInstance | null = null;
  private isInitialized = false;
  private meterWrapper: HTMLElement | null = null;
  private meterPlaceholder: HTMLElement | null = null;
  private meterSource: AudioNode | null = null;
  private settingsPanel: HTMLElement | null = null;

  private settingsBtn: HTMLElement | null = null;
  private sizeSelect: HTMLSelectElement | null = null;
  private fpsSelect: HTMLSelectElement | null = null;
  private batterySaverCheckbox: HTMLInputElement | null = null;
  private calibrateBtn: HTMLElement | null = null;
  private resetBtn: HTMLElement | null = null;

  private settings = {
    size: 'wide' as 'compact' | 'wide',
    fps: 30,
    batterySaver: false,
    noiseFloor: -70,
    autoCalibrated: false
  };

  private permissionState: 'unknown' | 'granted' | 'denied' | 'pending' = 'unknown';
  private errorMessage: string | null = null;

  initialize() {
    if (this.isInitialized) {return;}

    this.cacheDOMElements();
    this.setupEventListeners();
    this.updateUI();
    store.on('micPaintStateChanged', (isActive: boolean) => void this.handlePitchPaintingToggle(isActive));
    this.isInitialized = true;
  }

  private cacheDOMElements() {
    this.meterWrapper = document.getElementById('mic-meter-wrapper');
    this.meterPlaceholder = document.getElementById('meter-placeholder');
    this.settingsPanel = document.getElementById('meter-settings-panel');
    this.settingsBtn = document.getElementById('meter-settings-btn');
    this.sizeSelect = document.getElementById('meter-size-select') as HTMLSelectElement | null;
    this.fpsSelect = document.getElementById('meter-fps-select') as HTMLSelectElement | null;
    this.batterySaverCheckbox = document.getElementById('meter-battery-saver') as HTMLInputElement | null;
    this.calibrateBtn = document.getElementById('meter-calibrate-btn');
    this.resetBtn = document.getElementById('meter-reset-btn');
  }

  private setupEventListeners() {
    this.settingsBtn?.addEventListener('click', () => this.toggleSettingsPanel());
    this.sizeSelect?.addEventListener('change', (e) => this.handleSizeChange((e.target as HTMLSelectElement).value));
    this.fpsSelect?.addEventListener('change', (e) => this.handleFpsChange(parseInt((e.target as HTMLSelectElement).value, 10)));
    this.batterySaverCheckbox?.addEventListener('change', (e) => this.handleBatterySaverChange((e.target as HTMLInputElement).checked));
    this.calibrateBtn?.addEventListener('click', () => this.handleAutoCalibrate());
    this.resetBtn?.addEventListener('click', () => this.handleReset());
  }

  private async handlePitchPaintingToggle(isActive: boolean) {
    if (isActive) {
      await this.startMeter();
    } else {
      this.stopMeter();
    }
  }

  private async startMeter() {
    if (this.meter) {
      return;
    }

    try {
      await this.ensureMicrophoneAccess();
      const audioContext = Tone.context;
      if (!audioContext || audioContext.state === 'suspended') {
        throw new Error('Audio context not available or suspended');
      }
      await this.createMeterFromExistingMic();
      this.updateUI();
    } catch (error) {
      this.handleMeterError(error as Error);
    }
  }

  private async ensureMicrophoneAccess() {
    this.permissionState = 'pending';
    this.updateUI();
    this.permissionState = 'granted';
  }

  private async createMeterFromExistingMic() {
    if (!this.meterWrapper) {
      throw new Error('Meter wrapper not found - cannot create meter');
    }
    this.meterWrapper.innerHTML = '';
    const dimensions = this.getMeterDimensions();
    const Meter = (await import('./meter.js')).default;

    const micSplitter = (PitchPaintService as any)?.micSplitter;
    if (!micSplitter) {
      throw new Error('PitchPaintService microphone splitter not available');
    }

    const meterInstance = new Meter({
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

    meterInstance.connect(micSplitter);
    this.meter = meterInstance as unknown as MeterInstance;
    this.meterSource = micSplitter as AudioNode;
    this.meterWrapper.classList.add('active');
    this.meterWrapper.classList.remove('error');
  }

  private stopMeter() {
    if (this.meter) {
      this.meter.disconnect();
      try {
        this.meter.destroy();
      } catch { /* ignore */ }
      this.meter = null;
    }
    this.meterSource = null;
    this.updateUI();
  }

  private handleMeterError(_error: Error) {
    this.errorMessage = 'Meter error';
    this.permissionState = 'denied';
    this.updateUI();
  }

  private getMeterDimensions(): [number, number] {
    return this.settings.size === 'compact' ? [80, 60] : [200, 100];
  }

  private updateUI() {
    if (!this.meterWrapper || !this.meterPlaceholder) {return;}
    if (this.meter) {
      this.meterWrapper.classList.add('active');
      this.meterPlaceholder.classList.add('hidden');
    } else {
      this.meterWrapper.classList.remove('active');
      this.meterPlaceholder.classList.remove('hidden');
    }
  }

  private toggleSettingsPanel() {
    this.settingsPanel?.classList.toggle('open');
  }

  private handleSizeChange(newSize: string) {
    this.settings.size = newSize === 'compact' ? 'compact' : 'wide';
    if (this.meterWrapper && this.meter) {
      const [_w, _h] = this.getMeterDimensions();
      this.meter.destroy();
      this.meter = null;
      this.createMeterFromExistingMic().catch(() => {});
    }
  }

  private handleFpsChange(newFps: number) {
    this.settings.fps = Number.isFinite(newFps) ? newFps : this.settings.fps;
    if (this.meter && 'setFramerate' in this.meter) {
      (this.meter as any).setFramerate?.(this.settings.fps);
    }
  }

  private handleBatterySaverChange(enabled: boolean) {
    this.settings.batterySaver = enabled;
    if (this.meter && 'setFramerate' in this.meter) {
      const targetFps = enabled ? 15 : this.settings.fps;
      (this.meter as any).setFramerate?.(targetFps);
    }
  }

  private handleAutoCalibrate() {
    this.settings.autoCalibrated = true;
  }

  private handleReset() {
    this.settings = {
      size: 'wide',
      fps: 30,
      batterySaver: false,
      noiseFloor: -70,
      autoCalibrated: false
    };
    this.updateUI();
  }
}

const meterController = new MeterController();
export default meterController;
