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
    this.logThrottleMs = 5000; // Only log every 5 seconds

    this.config = {
      FFT_SIZE: 2048,
      MIN_PITCH_HZ: 60,
      MAX_PITCH_HZ: 1600,
      MIN_VOLUME_DB: -60
    };

  }

  async initialize() {
    if (this.isInitialized) return;
    console.log('PitchPaintService: Starting initialization...');
    try {
      console.log('PitchPaintService: Starting Tone.js...');
      await Tone.start();
      
      console.log('PitchPaintService: Creating UserMedia...');
      this.mic = new Tone.UserMedia();
      
      console.log('PitchPaintService: Creating Analyser...');
      this.analyser = new Tone.Analyser('waveform', this.config.FFT_SIZE);
      
      console.log('PitchPaintService: Creating gain node for microphone...');
      this.micGain = new Tone.Gain(2.0); // Amplify mic input
      
      console.log('🔍 [Pitchy] Initializing PitchDetector with analyser size:', this.analyser.size);
      console.log('🔍 [Pitchy] PitchDetector class available:', !!PitchDetector);
      console.log('🔍 [Pitchy] PitchDetector.forFloat32Array method:', typeof PitchDetector.forFloat32Array);
      
      this.detector = PitchDetector.forFloat32Array(this.analyser.size);
      
      console.log('🎯 [Pitchy] Detector created successfully:', {
        detectorExists: !!this.detector,
        detectorType: this.detector ? this.detector.constructor.name : 'null',
        analyserSize: this.analyser.size,
        fftSize: this.config.FFT_SIZE
      });
      
      // Create a splitter for non-intrusive meter tapping
      console.log('PitchPaintService: Creating splitter...');
      this.micSplitter = new Tone.Gain(1.0);
      
      console.log('PitchPaintService: Requesting microphone access...');
      await this.mic.open();
      
      // Connect: mic -> gain -> splitter -> analyser (for pitch detection)
      console.log('PitchPaintService: Connecting audio chain...');
      this.mic.connect(this.micGain);
      this.micGain.connect(this.micSplitter);
      this.micSplitter.connect(this.analyser);
      
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
    // ✅ FIXED: Use proper action instead of direct state mutation
    console.log('🎨 [PitchPaintService] Starting detection loop.');
    console.log('🎨 [PitchPaintService] Paint state before:', store.state.paint);
    console.log('🎨 [PitchPaintService] Config:', this.config);
    console.log('🎨 [PitchPaintService] Pitchy detector initialized:', !!this.detector);
    store.setPaintDetectionState(true);
    this.animationLoop();
  }

  stopDetection() {
    if (!store.state.paint.isDetecting) return;
    // ✅ FIXED: Use proper action instead of direct state mutation
    console.log('🎨 [PitchPaintService] Stopping detection, current state:', store.state.paint.isDetecting);
    store.setPaintDetectionState(false);
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
    
    // Calculate RMS volume to check for actual input
    const rms = Math.sqrt(waveform.reduce((sum, val) => sum + val * val, 0) / waveform.length);
    
    const now = performance.now();
    
    // Only attempt pitch detection if there's sufficient audio input
    let pitch = null;
    let clarity = 0;
    
    if (rms > 0.00001) { // Very low threshold for sensitive mics
      try {
        [pitch, clarity] = this.detector.findPitch(waveform, Tone.context.sampleRate);
        
        // Handle null values from pitchy library
        if (pitch === null || pitch === undefined) pitch = null;
        if (clarity === null || clarity === undefined) clarity = 0;
        
        // Log successful pitch detections occasionally
        if (pitch && clarity > 0.1 && now - this.lastLogTime > this.logThrottleMs) {
          console.log('🎯 [Pitch] Detected:', pitch.toFixed(1) + 'Hz, clarity:', clarity.toFixed(2));
          this.lastLogTime = now;
        }
      } catch (error) {
        pitch = null;
        clarity = 0;
      }
    }
    
    const clarityThreshold = store.state.paint.paintSettings.minClarity;
    const isValidPitch = pitch && 
      clarity > clarityThreshold && 
      pitch > this.config.MIN_PITCH_HZ && 
      pitch < this.config.MAX_PITCH_HZ;


    if (isValidPitch) {
      const midi = this.frequencyToMidi(pitch);
      const pitchData = { frequency: pitch, clarity: clarity, midi: midi, pitchClass: Math.round(midi) % 12, timestamp: now };
      
      store.setDetectedPitch(pitchData);
    } else {
      store.setDetectedPitch({ frequency: 0, clarity: 0, midi: 0, pitchClass: 0, timestamp: now });
    }

    this.animationFrameId = requestAnimationFrame(() => this.animationLoop());
  }

  frequencyToMidi(frequency) {
    return 12 * Math.log2(frequency / 440) + 69;
  }

  // Debug method to test microphone input
  testMicrophoneInput() {
    if (!this.isInitialized) {
      console.log('❌ [MicTest] PitchPaintService not initialized');
      return false;
    }

    const waveform = this.analyser.getValue();
    const rms = Math.sqrt(waveform.reduce((sum, val) => sum + val * val, 0) / waveform.length);
    
    console.log('🎤 [MicTest] Microphone Test Results:', {
      isInitialized: this.isInitialized,
      micOpen: this.mic && this.mic.state === 'started',
      contextState: Tone.context.state,
      sampleRate: Tone.context.sampleRate,
      waveformLength: waveform.length,
      rms: rms.toFixed(6),
      hasInput: rms > 0.0001,
      suggestion: rms <= 0.0001 ? 'Try speaking, singing, or making noise near your microphone' : 'Microphone is detecting audio!'
    });

    return rms > 0.0001;
  }

  async dispose() {
    this.stopDetection();
    if (this.mic) {
      this.mic.close();
      this.mic = null;
    }
    if (this.micGain) {
      this.micGain.dispose();
      this.micGain = null;
    }
    if (this.micSplitter) {
      this.micSplitter.dispose();
      this.micSplitter = null;
    }
    this.analyser = null;
    this.detector = null;
    this.isInitialized = false;
    console.log('PitchPaintService: Disposed.');
  }
}

export default new PitchPaintService();