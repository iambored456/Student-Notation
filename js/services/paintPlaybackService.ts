// js/services/paintPlaybackService.ts
import * as Tone from 'tone';
import store from '@state/index.ts';
import logger from '@utils/logger.ts';

logger.moduleLoaded('PaintPlaybackService');

class PaintPlaybackService {
  private paintSynth: Tone.Synth | null = null;
  private scheduledEvents: number[] = [];
  private isInitialized = false;
  private paintGain: Tone.Gain | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) {return;}

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
      this.paintGain = new Tone.Gain({ gain: 0.3 }); // Lower volume than main instruments

      // Connect: paintSynth -> paintGain -> synthEngine master chain (with limiter)
      this.paintSynth.connect(this.paintGain);

      // Route through SynthEngine master chain if available (includes limiter + dynamic gain)
      if (typeof window !== 'undefined' && window.synthEngine?.getMainVolumeNode) {
        const mainVolumeNode = window.synthEngine.getMainVolumeNode() as Tone.ToneAudioNode | AudioNode | null;
        if (mainVolumeNode) {
          this.paintGain.connect(mainVolumeNode);
          logger.info('PaintPlaybackService', 'Connected to SynthEngine master chain (with limiter)');
        } else {
          this.paintGain.toDestination();
          logger.warn('PaintPlaybackService', 'SynthEngine main volume node not found, connecting directly to destination');
        }
      } else {
        this.paintGain.toDestination();
        logger.warn('PaintPlaybackService', 'SynthEngine not available, connecting directly to destination');
      }

      this.isInitialized = true;
      logger.info('PaintPlaybackService', 'Initialized with sine wave synthesis');

    } catch (error) {
      logger.error('PaintPlaybackService', 'Failed to initialize', error);
      throw error;
    }
  }

  // Convert MIDI value to frequency for sine wave playback
  midiToFrequency(midiValue: number): number {
    return 440 * Math.pow(2, (midiValue - 69) / 12);
  }

  // Schedule all paint points for playback
  schedulePaintPlayback(): void {
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
  clearScheduledEvents(): void {
    this.scheduledEvents.forEach(eventId => {
      Tone.Transport.clear(eventId);
    });
    this.scheduledEvents = [];
    logger.debug('PaintPlaybackService', 'Cleared all scheduled paint events');
  }

  // Handle transport start - schedule paint events if enabled
  onTransportStart(): void {
    if (store.state.paint.paintSettings.playbackEnabled) {
      this.schedulePaintPlayback();
    }
  }

  // Handle transport stop - clear scheduled events
  onTransportStop(): void {
    this.clearScheduledEvents();
  }

  // Update paint synth volume
  setPaintVolume(volume: number): void {
    if (this.paintGain) {
      this.paintGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  // Get current paint volume
  getPaintVolume(): number {
    return this.paintGain ? this.paintGain.gain.value : 0.3;
  }

  async dispose(): Promise<void> {
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
