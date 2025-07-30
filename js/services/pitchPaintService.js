// js/services/pitchPaintService.js
import * as Tone from 'tone';
import { PitchDetector } from 'pitchy';
import store from '../state/index.js';
import { Note } from 'tonal'; // NEW: Import Tonal for MIDI to Note conversion

class PitchPaintService {
  constructor() {
    this.mic = null;
    this.analyser = null;
    this.detector = null;
    this.animationFrameId = null;
    this.isInitialized = false;

    this.lastLogTime = 0;
    this.logThrottleMs = 1000;

    this.config = {
      FFT_SIZE: 2048,
      MIN_PITCH_HZ: 60,
      MAX_PITCH_HZ: 1600,
      MIN_VOLUME_DB: -60
    };

    console.log("PitchPaintService: Instance created.");
  }

  async initialize() {
    if (this.isInitialized) return;
    try {
      await Tone.start();
      this.mic = new Tone.UserMedia(this.config.MIN_VOLUME_DB);
      this.analyser = new Tone.Analyser('waveform', this.config.FFT_SIZE);
      this.detector = PitchDetector.forFloat32Array(this.analyser.size);
      await this.mic.open();
      this.mic.connect(this.analyser);
      this.isInitialized = true;
      console.log('PitchPaintService: Initialized successfully');
    } catch (error) {
      console.error('PitchPaintService: Failed to initialize microphone:', error);
      store.setMicPaintActive(false);
      throw error;
    }
  }

  startDetection() {
    if (!this.isInitialized || store.state.paint.isDetecting) return;
    store.state.paint.isDetecting = true;
    console.log('PitchPaintService: Starting detection loop.');
    this.animationLoop();
  }

  stopDetection() {
    if (!store.state.paint.isDetecting) return;
    store.state.paint.isDetecting = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      console.log('PitchPaintService: Stopped detection loop.');
    }
  }

  animationLoop() {
    if (!store.state.paint.isDetecting) {
      this.animationFrameId = null;
      return;
    }

    const waveform = this.analyser.getValue();
    const [pitch, clarity] = this.detector.findPitch(waveform, Tone.context.sampleRate);
    
    const now = performance.now();
    
    const clarityThreshold = store.state.paint.paintSettings.minClarity;
    const isValidPitch = pitch && 
      clarity > clarityThreshold && 
      pitch > this.config.MIN_PITCH_HZ && 
      pitch < this.config.MAX_PITCH_HZ;

    if (isValidPitch) {
      const midi = this.frequencyToMidi(pitch);
      const pitchData = { frequency: pitch, clarity: clarity, midi: midi, pitchClass: Math.round(midi) % 12, timestamp: now };
      
      // MODIFIED: Throttle the VALID pitch log
      if (now - this.lastLogTime > this.logThrottleMs) {
          const noteName = Note.fromMidi(Math.round(midi));
          console.log(`[PitchDetector] VALID pitch: ${noteName} (MIDI: ${midi.toFixed(2)})`);
          this.lastLogTime = now;
      }

      store.setDetectedPitch(pitchData);
    } else {
      store.setDetectedPitch({ frequency: 0, clarity: 0, midi: 0, pitchClass: 0, timestamp: now });
    }

    this.animationFrameId = requestAnimationFrame(() => this.animationLoop());
  }

  frequencyToMidi(frequency) {
    return 12 * Math.log2(frequency / 440) + 69;
  }

  async dispose() {
    this.stopDetection();
    if (this.mic) {
      this.mic.close();
      this.mic = null;
    }
    this.analyser = null;
    this.detector = null;
    this.isInitialized = false;
    console.log('PitchPaintService: Disposed.');
  }
}

export default new PitchPaintService();