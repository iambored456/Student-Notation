// js/services/pitchPaintService.js
import * as Tone from 'tone';
import { PitchDetector } from 'pitchy';
import store from '@state/index.js';
import logger from '@utils/logger.js';
import { Note } from 'tonal';

class PitchPaintService {
  constructor() {
    this.mic = null;
    this.analyser = null;
    this.detector = null;
    this.animationFrameId = null;
    this.isInitialized = false;

    this.lastLogTime = 0;
    this.logThrottleMs = 5000; // Only log every 5 seconds

    // Pitch filtering for noise reduction
    this.pitchHistory = []; // Store last few pitch values with timestamps
    this.maxHistoryLength = 3;
    this.maxPitchJumpSemitones = 24; // Maximum allowed pitch jump in semitones
    this.maxJumpTimeMs = 20; // Time window for detecting jumps

    this.config = {
      FFT_SIZE: 2048,
      MIN_PITCH_HZ: 75,
      MAX_PITCH_HZ: 1300,
      MIN_VOLUME_DB: -50
    };

  }

  async initialize() {
    if (this.isInitialized) return;
    try {
      // Use global audio initialization to ensure user gesture compliance
      const audioInit = window.initAudio || (() => Tone.start());
      await audioInit();
      
      this.mic = new Tone.UserMedia();
      
      this.analyser = new Tone.Analyser('waveform', this.config.FFT_SIZE);
      
      this.micGain = new Tone.Gain(2.0); // Amplify mic input
      
      
      this.detector = PitchDetector.forFloat32Array(this.analyser.size);
      
      
      // Create a splitter for non-intrusive meter tapping
      this.micSplitter = new Tone.Gain(1.0);
      
      await this.mic.open();
      
      // Connect: mic -> gain -> splitter -> analyser (for pitch detection)
      this.mic.connect(this.micGain);
      this.micGain.connect(this.micSplitter);
      this.micSplitter.connect(this.analyser);
      
      this.isInitialized = true;
    } catch (error) {
      logger.error('PitchPaintService', 'Failed to initialize microphone', error, 'paint');
      store.setMicPaintActive(false);
      throw error;
    }
  }

  startDetection() {
    if (!this.isInitialized || store.state.paint.isDetecting) return;
    // âœ… FIXED: Use proper action instead of direct state mutation
    store.setPaintDetectionState(true);
    this.animationLoop();
  }

  stopDetection() {
    if (!store.state.paint.isDetecting) return;
    // âœ… FIXED: Use proper action instead of direct state mutation
    store.setPaintDetectionState(false);
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
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
      
      // Apply pitch jump filtering
      if (this.isPitchJumpValid(midi, now)) {
        this.addPitchToHistory(midi, now);
        const smoothedMidi = this.getSmoothedPitch();
        
        const pitchData = { 
          frequency: pitch, 
          clarity: clarity, 
          midi: smoothedMidi, 
          pitchClass: Math.round(smoothedMidi) % 12, 
          timestamp: now 
        };
        
        store.setDetectedPitch(pitchData);
      } else {
        // Pitch jump was too large - use previous smoothed value or nothing
        const smoothedMidi = this.getSmoothedPitch();
        if (smoothedMidi !== null) {
          const pitchData = { 
            frequency: pitch, 
            clarity: clarity, 
            midi: smoothedMidi, 
            pitchClass: Math.round(smoothedMidi) % 12, 
            timestamp: now 
          };
          store.setDetectedPitch(pitchData);
        } else {
          store.setDetectedPitch({ frequency: 0, clarity: 0, midi: 0, pitchClass: 0, timestamp: now });
        }
      }
    } else {
      store.setDetectedPitch({ frequency: 0, clarity: 0, midi: 0, pitchClass: 0, timestamp: now });
    }

    this.animationFrameId = requestAnimationFrame(() => this.animationLoop());
  }

  frequencyToMidi(frequency) {
    return 12 * Math.log2(frequency / 440) + 69;
  }

  // Add pitch to history and check for validity
  addPitchToHistory(midi, timestamp) {
    this.pitchHistory.push({ midi, timestamp });
    
    // Keep only recent history
    if (this.pitchHistory.length > this.maxHistoryLength) {
      this.pitchHistory.shift();
    }
  }

  // Check if a pitch jump is too large/fast (indicating noise)
  isPitchJumpValid(newMidi, timestamp) {
    if (this.pitchHistory.length === 0) return true; // First pitch is always valid
    
    const lastPitch = this.pitchHistory[this.pitchHistory.length - 1];
    const timeDiff = timestamp - lastPitch.timestamp;
    const semitoneDiff = Math.abs(newMidi - lastPitch.midi);
    
    // Allow large jumps if enough time has passed
    if (timeDiff > this.maxJumpTimeMs) return true;
    
    // Reject jumps that are too large in too short a time
    if (semitoneDiff > this.maxPitchJumpSemitones) {
      logger.debug('PitchPaintService', 'Pitch jump rejected', { semitoneDiff: semitoneDiff.toFixed(1), timeDiff: timeDiff.toFixed(0) }, 'paint');
      return false;
    }
    
    return true;
  }

  // Get smoothed pitch from recent history (median filtering)
  getSmoothedPitch() {
    if (this.pitchHistory.length < 3) {
      return this.pitchHistory.length > 0 ? this.pitchHistory[this.pitchHistory.length - 1].midi : null;
    }
    
    // Use median of last 3 pitches for smoothing
    const recentPitches = this.pitchHistory.slice(-3).map(p => p.midi).sort((a, b) => a - b);
    return recentPitches[1]; // Middle value
  }

  // Debug method to test microphone input
  testMicrophoneInput() {
    if (!this.isInitialized) {
        return false;
    }

    const waveform = this.analyser.getValue();
    const rms = Math.sqrt(waveform.reduce((sum, val) => sum + val * val, 0) / waveform.length);
    

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
  }
}

export default new PitchPaintService();
