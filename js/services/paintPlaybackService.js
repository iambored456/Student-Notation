// js/services/paintPlaybackService.js
import * as Tone from 'tone';
import store from '../state/index.js';
import logger from '../utils/logger.js';

logger.moduleLoaded('PaintPlaybackService');

class PaintPlaybackService {
  constructor() {
    this.paintSynth = null;
    this.scheduledEvents = [];
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Create a simple sine wave synth for paint playback
      this.paintSynth = new Tone.Synth({
        oscillator: {
          type: 'sine'
        },
        envelope: {
          attack: 0.01,
          decay: 0.1, 
          sustain: 0,
          release: 0.1
        }
      });

      // Create a dedicated gain node for paint volume control
      this.paintGain = new Tone.Gain(0.3); // Lower volume than main instruments
      
      // Connect: paintSynth -> paintGain -> master output
      this.paintSynth.connect(this.paintGain);
      this.paintGain.toDestination();
      
      this.isInitialized = true;
      logger.info('PaintPlaybackService', 'Initialized with sine wave synthesis');
      
    } catch (error) {
      logger.error('PaintPlaybackService', 'Failed to initialize', error);
      throw error;
    }
  }

  // Convert MIDI value to frequency for sine wave playback
  midiToFrequency(midiValue) {
    return 440 * Math.pow(2, (midiValue - 69) / 12);
  }

  // Schedule all paint points for playback
  schedulePaintPlayback() {
    if (!this.isInitialized || !store.state.paint.paintSettings.playbackEnabled) {
      return;
    }

    // Clear any previously scheduled events
    this.clearScheduledEvents();

    const paintHistory = store.state.paint.paintHistory;
    if (!paintHistory || paintHistory.length === 0) {
      logger.debug('PaintPlaybackService', 'No paint history to schedule');
      return;
    }

    logger.info('PaintPlaybackService', `Scheduling ${paintHistory.length} paint points for playback`);

    // Schedule each paint point
    paintHistory.forEach((point, index) => {
      const frequency = this.midiToFrequency(point.midi);
      const duration = 0.2; // Short note duration for paint points
      
      // Schedule the note to play at the recorded musical time
      const eventId = Tone.Transport.schedule((time) => {
        if (this.paintSynth && store.state.paint.paintSettings.playbackEnabled) {
          this.paintSynth.triggerAttackRelease(frequency, duration, time);
          logger.debug('PaintPlaybackService', `Playing paint point ${index}: ${point.midi.toFixed(2)} MIDI (${frequency.toFixed(1)}Hz) at time ${point.musicalTime.toFixed(2)}s`);
        }
      }, point.musicalTime);

      this.scheduledEvents.push(eventId);
    });

    logger.info('PaintPlaybackService', `Scheduled ${this.scheduledEvents.length} paint events`);
  }

  // Clear all scheduled paint events
  clearScheduledEvents() {
    this.scheduledEvents.forEach(eventId => {
      Tone.Transport.clear(eventId);
    });
    this.scheduledEvents = [];
    logger.debug('PaintPlaybackService', 'Cleared all scheduled paint events');
  }

  // Handle transport start - schedule paint events if enabled
  onTransportStart() {
    if (store.state.paint.paintSettings.playbackEnabled) {
      this.schedulePaintPlayback();
    }
  }

  // Handle transport stop - clear scheduled events
  onTransportStop() {
    this.clearScheduledEvents();
  }

  // Update paint synth volume
  setPaintVolume(volume) {
    if (this.paintGain) {
      this.paintGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  // Get current paint volume
  getPaintVolume() {
    return this.paintGain ? this.paintGain.gain.value : 0.3;
  }

  async dispose() {
    this.clearScheduledEvents();
    
    if (this.paintSynth) {
      this.paintSynth.dispose();
      this.paintSynth = null;
    }
    
    if (this.paintGain) {
      this.paintGain.dispose();
      this.paintGain = null;
    }
    
    this.isInitialized = false;
    logger.info('PaintPlaybackService', 'Disposed');
  }
}

export default new PaintPlaybackService();