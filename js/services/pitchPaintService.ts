// js/services/pitchPaintService.ts
import * as Tone from 'tone';
import { PitchDetector } from 'pitchy';
import store from '@state/index.ts';
import logger from '@utils/logger.ts';

interface PitchHistoryEntry {
  midi: number;
  timestamp: number;
}

interface PitchData {
  frequency: number;
  clarity: number;
  midi: number;
  pitchClass: number;
  timestamp: number;
}

class PitchPaintService {
  private mic: Tone.UserMedia | null = null;
  private analyser: Tone.Analyser | null = null;
  private detector: PitchDetector<Float32Array> | null = null;
  private animationFrameId: number | null = null;
  private isInitialized = false;
  private micGain: Tone.Gain | null = null;
  private micSplitter: Tone.Gain | null = null;

  private lastLogTime = 0;
  private logThrottleMs = 5000; // Only log every 5 seconds

  // Pitch filtering for noise reduction
  private pitchHistory: PitchHistoryEntry[] = []; // Store last few pitch values with timestamps
  private maxHistoryLength = 3;
  private maxPitchJumpSemitones = 24; // Maximum allowed pitch jump in semitones
  private maxJumpTimeMs = 20; // Time window for detecting jumps

  private config = {
    FFT_SIZE: 2048,
    MIN_PITCH_HZ: 75,
    MAX_PITCH_HZ: 1300,
    MIN_VOLUME_DB: -50
  };

  async initialize(): Promise<void> {
    if (this.isInitialized) {return;}
    try {
      // Use global audio initialization to ensure user gesture compliance
      const audioInit = (typeof window !== 'undefined' && (window as { initAudio?: () => Promise<void> }).initAudio) || (() => Tone.start());
      await audioInit();

      this.mic = new Tone.UserMedia();

      this.analyser = new Tone.Analyser({ type: 'waveform', size: this.config.FFT_SIZE });

      this.micGain = new Tone.Gain({ gain: 2.0 }); // Amplify mic input


      this.detector = PitchDetector.forFloat32Array(this.analyser.size);


      // Create a splitter for non-intrusive meter tapping
      this.micSplitter = new Tone.Gain({ gain: 1.0 });

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

  startDetection(): void {
    if (!this.isInitialized || store.state.paint.isDetecting) {return;}
    // ✅ FIXED: Use proper action instead of direct state mutation
    store.setPaintDetectionState(true);
    this.animationLoop();
  }

  stopDetection(): void {
    if (!store.state.paint.isDetecting) {return;}
    // ✅ FIXED: Use proper action instead of direct state mutation
    store.setPaintDetectionState(false);
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  animationLoop(): void {
    if (!store.state.paint.isDetecting) {
      this.animationFrameId = null;
      return;
    }

    const waveform = this.analyser!.getValue() as Float32Array;

    // Calculate RMS volume to check for actual input
    const rms = Math.sqrt(waveform.reduce((sum, val) => sum + val * val, 0) / waveform.length);

    const now = performance.now();

    // Only attempt pitch detection if there's sufficient audio input
    let pitch: number | null = null;
    let clarity = 0;

    if (rms > 0.00001) { // Very low threshold for sensitive mics
      try {
        [pitch, clarity] = this.detector!.findPitch(waveform, Tone.context.sampleRate);

        // Handle null values from pitchy library
        if (pitch === null || pitch === undefined) {pitch = null;}
        if (clarity === null || clarity === undefined) {clarity = 0;}

        // Log successful pitch detections occasionally
        if (pitch && clarity > 0.1 && now - this.lastLogTime > this.logThrottleMs) {
          this.lastLogTime = now;
        }
      } catch {
        pitch = null;
        clarity = 0;
      }
    }

    const clarityThreshold = store.state.paint.paintSettings.minClarity;
    const isValidPitch = pitch !== null &&
      clarity > clarityThreshold &&
      pitch > this.config.MIN_PITCH_HZ &&
      pitch < this.config.MAX_PITCH_HZ;


    if (isValidPitch && pitch !== null) {
      const midi = this.frequencyToMidi(pitch);

      // Apply pitch jump filtering
      if (this.isPitchJumpValid(midi, now)) {
        this.addPitchToHistory(midi, now);
        const smoothedMidi = this.getSmoothedPitch();

        const pitchData: PitchData = {
          frequency: pitch,
          clarity: clarity,
          midi: smoothedMidi!,
          pitchClass: Math.round(smoothedMidi!) % 12,
          timestamp: now
        };

        store.setDetectedPitch(pitchData);
      } else {
        // Pitch jump was too large - use previous smoothed value or nothing
        const smoothedMidi = this.getSmoothedPitch();
        if (smoothedMidi !== null) {
          const pitchData: PitchData = {
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

  frequencyToMidi(frequency: number): number {
    return 12 * Math.log2(frequency / 440) + 69;
  }

  // Add pitch to history and check for validity
  addPitchToHistory(midi: number, timestamp: number): void {
    this.pitchHistory.push({ midi, timestamp });

    // Keep only recent history
    if (this.pitchHistory.length > this.maxHistoryLength) {
      this.pitchHistory.shift();
    }
  }

  // Check if a pitch jump is too large/fast (indicating noise)
  isPitchJumpValid(newMidi: number, timestamp: number): boolean {
    if (this.pitchHistory.length === 0) {return true;} // First pitch is always valid

    const lastPitch = this.pitchHistory[this.pitchHistory.length - 1];
    if (!lastPitch) {return true;}
    const timeDiff = timestamp - lastPitch.timestamp;
    const semitoneDiff = Math.abs(newMidi - lastPitch.midi);

    // Allow large jumps if enough time has passed
    if (timeDiff > this.maxJumpTimeMs) {return true;}

    // Reject jumps that are too large in too short a time
    if (semitoneDiff > this.maxPitchJumpSemitones) {
      logger.debug('PitchPaintService', 'Pitch jump rejected', { semitoneDiff: semitoneDiff.toFixed(1), timeDiff: timeDiff.toFixed(0) }, 'paint');
      return false;
    }

    return true;
  }

  // Get smoothed pitch from recent history (median filtering)
  getSmoothedPitch(): number | null {
    if (this.pitchHistory.length < 3) {
      const lastEntry = this.pitchHistory[this.pitchHistory.length - 1];
      return lastEntry ? lastEntry.midi : null;
    }

    // Use median of last 3 pitches for smoothing
    const recentPitches = this.pitchHistory.slice(-3).map(p => p.midi).sort((a, b) => a - b);
    return recentPitches[1] ?? null; // Middle value
  }

  // Debug method to test microphone input
  testMicrophoneInput(): boolean {
    if (!this.isInitialized) {
      return false;
    }

    const waveform = this.analyser!.getValue() as Float32Array;
    const rms = Math.sqrt(waveform.reduce((sum, val) => sum + val * val, 0) / waveform.length);


    return rms > 0.0001;
  }

  async dispose(): Promise<void> {
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
