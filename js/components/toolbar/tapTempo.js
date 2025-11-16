// js/components/Toolbar/tapTempo.js
import store from '@state/index.js';
import logger from '@utils/logger.js';
import tempoVisualizer from './tempoVisualizer.js';

/**
 * TapTempo handles tap tempo input on tempo icons
 * Allows users to tap tempo instead of using the slider
 */
class TapTempo {
  constructor() {
    // Tap state
    this.tapHistory = []; // Array of timestamps
    this.activeTapType = null; // 'eighth', 'quarter', or 'dottedQuarter'
    this.resetTimeout = null;
    this.resetWindowMs = 2000; // Reset after 2 seconds of no taps (adjustable based on running average)

    // Note duration multipliers (relative to quarter note)
    this.durationMultipliers = {
      'eighth': 0.5,        // Eighth note is half a quarter
      'quarter': 1.0,       // Quarter note is the base
      'dottedQuarter': 1.5  // Dotted quarter is 1.5x a quarter
    };

    // Icon elements
    this.iconElements = new Map(); // type -> icon element

    this.initElements();
  }

  initElements() {
    // Map tempo types to their icon elements
    const tempoTypes = [
      { type: 'eighth', containerId: 'eighth-note-tempo' },
      { type: 'quarter', containerId: 'quarter-note-tempo' },
      { type: 'dottedQuarter', containerId: 'dotted-quarter-tempo' }
    ];

    tempoTypes.forEach(({type, containerId}) => {
      const container = document.getElementById(containerId);
      const tempoGroup = container?.parentElement;
      const icon = tempoGroup?.querySelector('.tempo-label-icon');

      if (icon) {
        this.iconElements.set(type, icon);

        // Add click handler
        icon.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleTap(type);
        });

        // Make cursor pointer to indicate clickability
        icon.style.cursor = 'pointer';
      } else {
        logger.warn('TapTempo', `Could not find icon for ${type} tempo`, { type }, 'toolbar');
      }
    });
  }

  /**
     * Handle a tap on a tempo icon
     */
  handleTap(type) {
    const now = performance.now();

    // If switching to a different icon, reset
    if (this.activeTapType !== null && this.activeTapType !== type) {
      this.reset();
    }

    this.activeTapType = type;

    // Trigger pulse animation for this icon only
    tempoVisualizer.triggerPulse(type);

    // Add tap to history
    this.tapHistory.push(now);

    // If we have 2+ taps, calculate and apply tempo
    if (this.tapHistory.length >= 2) {
      this.calculateAndApplyTempo(type);
    }

    // Reset the timeout
    this.scheduleReset();
  }

  /**
     * Calculate tempo from tap history and apply it
     */
  calculateAndApplyTempo(type) {
    // Calculate intervals between consecutive taps
    const intervals = [];
    for (let i = 1; i < this.tapHistory.length; i++) {
      intervals.push(this.tapHistory[i] - this.tapHistory[i - 1]);
    }

    // Calculate running average of intervals
    const avgIntervalMs = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;

    // Convert interval to BPM based on note type
    // avgIntervalMs is the time between taps in milliseconds
    // For quarter notes: if user taps every 500ms, that's 120 BPM (60000ms / 500ms = 120)
    // For eighth notes: if user taps every 250ms, that's 120 BPM for eighth notes = 60 BPM quarter

    const durationMultiplier = this.durationMultipliers[type];
    const quarterNoteIntervalMs = avgIntervalMs / durationMultiplier;
    const bpm = 60000 / quarterNoteIntervalMs;

    // Clamp to valid tempo range (30-240 BPM)
    const clampedBPM = Math.max(30, Math.min(240, Math.round(bpm)));

    logger.debug(
      'TapTempo',
      `${type} tempo tap processed`,
      { intervals: intervals.length, averageMs: avgIntervalMs, bpm: clampedBPM },
      'toolbar'
    );

    // Apply tempo
    store.setTempo(clampedBPM);
  }

  /**
     * Schedule a reset of tap history after inactivity
     */
  scheduleReset() {
    // Clear existing timeout
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }

    // Calculate reset window based on running average
    // Reset window = 3.5x the current average interval (or 2s minimum)
    let resetWindow = this.resetWindowMs;

    if (this.tapHistory.length >= 2) {
      const intervals = [];
      for (let i = 1; i < this.tapHistory.length; i++) {
        intervals.push(this.tapHistory[i] - this.tapHistory[i - 1]);
      }
      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      resetWindow = Math.max(2000, avgInterval * 3.5);
    }

    // Schedule reset
    this.resetTimeout = setTimeout(() => {
      this.reset();
    }, resetWindow);
  }

  /**
     * Reset tap state
     */
  reset() {
    this.tapHistory = [];
    this.activeTapType = null;
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }
  }
}

// Create and export singleton instance
const tapTempo = new TapTempo();
export default tapTempo;
