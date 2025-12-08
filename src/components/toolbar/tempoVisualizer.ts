// js/components/Toolbar/tempoVisualizer.js
import store from '@state/index.ts';
import logger from '@utils/logger.ts';

type TempoType = 'eighth' | 'quarter' | 'dottedQuarter';

interface TempoElement {
  container: HTMLElement;
  icon: HTMLElement;
  bpmMultiplier: number;
  originalTransform: string;
  originalIconTransform: string;
}

interface PulseAnimation {
  startTime: number;
  phase: 'scaleUp' | 'scaleDown' | 'complete';
}

/**
 * TempoVisualizer handles visual pulsing of tempo number boxes
 * when the tempo slider is being held/dragged
 */
class TempoVisualizer {
  private isActive = false;
  private pulseIntervals = new Map<TempoType, ReturnType<typeof setInterval>>();
  private tempoElements = new Map<TempoType, TempoElement>();
  // Animation settings - must be faster than shortest pulse interval
  // Shortest interval at max tempo (240 BPM eighth notes) = 125ms
  private readonly popDuration = {
    scaleUp: 40,    // Very fast scale up (ms)
    scaleDown: 80   // Quick scale down (ms)
  }; // Total: 120ms - faster than shortest possible pulse (125ms)
  private readonly popScale = 1.4; // 40% larger (more noticeable like drum pulse)
  private activeAnimations = new Map<TempoType, PulseAnimation>(); // tempo type -> animation state

  constructor() {
    // Initialize after DOM is ready
    this.initElements();
  }

  initElements(): void {
    // Map tempo types to their DOM elements
    const tempoTypes: { type: TempoType; containerId: string; bpmMultiplier: number }[] = [
      {
        type: 'eighth',
        containerId: 'eighth-note-tempo',
        bpmMultiplier: 2 // eighth notes are 2x quarter note tempo
      },
      {
        type: 'quarter',
        containerId: 'quarter-note-tempo',
        bpmMultiplier: 1 // base tempo
      },
      {
        type: 'dottedQuarter',
        containerId: 'dotted-quarter-tempo',
        bpmMultiplier: 0.666 // dotted quarter = 2/3 of quarter note tempo
      }
    ];

    tempoTypes.forEach(({type, containerId, bpmMultiplier}) => {
      const container = document.getElementById(containerId);
      // Find the icon in the same tempo-input-group as the container
      const tempoGroup = container?.parentElement;
      const icon = tempoGroup?.querySelector('.tempo-label-icon') as HTMLElement | null;

      if (container && icon) {
        this.tempoElements.set(type, {
          container,
          icon,
          bpmMultiplier,
          originalTransform: container.style.transform || '',
          originalIconTransform: icon.style.transform || ''
        });
      } else {
        logger.warn(
          'TempoVisualizer',
          `Could not find elements for ${type} tempo`,
          { container: !!container, icon: !!icon, tempoGroup: !!tempoGroup },
          'toolbar'
        );
      }
    });
  }

  /**
     * Start pulsing all tempo elements at their respective rates
     */
  start(): void {
    if (this.isActive) {return;}

    this.isActive = true;

    // Initialize elements if not already done (for deferred initialization)
    if (this.tempoElements.size === 0) {
      this.initElements();
    }

    // Start pulse intervals for each tempo type
    this.tempoElements.forEach((elements, type) => {
      this.startPulseForType(type);
    });
  }

  /**
     * Stop all pulsing and reset styles
     */
  stop(): void {
    if (!this.isActive) {return;}

    this.isActive = false;

    // Clear all intervals
    this.pulseIntervals.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.pulseIntervals.clear();

    // Clear all animations
    this.activeAnimations.clear();

    // Reset all element transforms
    this.tempoElements.forEach((elements) => {
      elements.container.style.transform = elements.originalTransform;
      elements.icon.style.transform = elements.originalIconTransform;
    });
  }

  /**
     * Start pulsing for a specific tempo type
     */
  startPulseForType(type: TempoType): void {
    const elements = this.tempoElements.get(type);
    if (!elements) {return;}

    const currentTempo = store.state.tempo; // quarter note BPM
    const actualBPM = currentTempo * elements.bpmMultiplier;
    const pulseInterval = (60 / actualBPM) * 1000; // convert to milliseconds

    // Trigger immediate pulse
    this.triggerPulse(type);

    // Set up recurring pulse - remove requestAnimationFrame delay that might cause timing issues
    const intervalId = setInterval(() => {
      if (this.isActive) {
        this.triggerPulse(type);
      }
    }, pulseInterval);

    this.pulseIntervals.set(type, intervalId);
  }

  /**
     * Trigger a single pulse animation for a tempo type
     */
  triggerPulse(type: TempoType): void {
    const now = performance.now();

    // Always reset/start new animation (handles overlapping pulses)
    const animationState: PulseAnimation = {
      startTime: now,
      phase: 'scaleUp'
    };

    this.activeAnimations.set(type, animationState);

    // Temporarily enable animation for tap tempo pulses
    const wasActive = this.isActive;
    this.isActive = true;

    // Start animation loop if not already running
    if (this.activeAnimations.size === 1) {
      this.animationLoop();
    }

    // Restore isActive after animation completes
    if (!wasActive) {
      setTimeout(() => {
        if (this.activeAnimations.size === 0) {
          this.isActive = false;
        }
      }, this.popDuration.scaleUp + this.popDuration.scaleDown + 50);
    }
  }

  /**
     * Main animation loop
     */
  animationLoop(): void {
    if (this.activeAnimations.size === 0 || !this.isActive) {
      return; // Stop loop when no active animations
    }

    const now = performance.now();

    // Process each active animation
    this.activeAnimations.forEach((animation, type) => {
      const scale = this.calculateScale(animation, now);
      this.applyScale(type, scale);

      // Check if animation is complete - only when scaleDown phase finishes
      if (scale === 1.0 && animation.phase === 'complete') {
        this.activeAnimations.delete(type);
      }
    });

    // Continue loop if there are still active animations
    if (this.activeAnimations.size > 0) {
      requestAnimationFrame(() => this.animationLoop());
    }
  }

  /**
     * Calculate current scale based on animation state and elapsed time
     */
  calculateScale(animation: PulseAnimation, now: number): number {
    const elapsed = now - animation.startTime;

    if (animation.phase === 'scaleUp') {
      if (elapsed >= this.popDuration.scaleUp) {
        // Transition to scale down phase
        animation.phase = 'scaleDown';
        animation.startTime = now; // Reset timer for scale down
        return this.popScale;
      } else {
        // Scale up: 1.0 -> popScale over scaleUp duration
        const progress = Math.min(elapsed / this.popDuration.scaleUp, 1.0); // Ensure progress doesn't exceed 1
        const scale = 1.0 + (this.popScale - 1.0) * progress;


        return scale;
      }
    } else if (animation.phase === 'scaleDown') {
      if (elapsed >= this.popDuration.scaleDown) {
        // Animation complete - mark as finished
        animation.phase = 'complete';
        return 1.0;
      } else {
        // Scale down: popScale -> 1.0 over scaleDown duration
        const progress = Math.min(elapsed / this.popDuration.scaleDown, 1.0); // Ensure progress doesn't exceed 1
        const scale = this.popScale - (this.popScale - 1.0) * progress;
        return scale;
      }
    }

    return 1.0;
  }

  /**
     * Apply scale transform to tempo elements
     */
  applyScale(type: TempoType, scale: number): void {
    const elements = this.tempoElements.get(type);
    if (!elements) {
      return;
    }

    const transform = `scale(${scale})`;


    // Apply transform to both container and icon
    elements.container.style.transform = elements.originalTransform + ' ' + transform;
    elements.icon.style.transform = elements.originalIconTransform + ' ' + transform;

    // Add smooth transition for scale down (but not scale up for responsiveness)
    const transition = scale < this.popScale ? 'transform 0.08s ease-out' : 'none';
    elements.container.style.transition = transition;
    elements.icon.style.transition = transition;
  }

  /**
     * Update pulse rates when tempo changes
     */
  updateTempo(): void {
    if (!this.isActive) {return;}


    // Restart all pulses with new tempo
    this.stop();
    this.start();
  }
}

// Create and export singleton instance
const tempoVisualizer = new TempoVisualizer();
export default tempoVisualizer;
