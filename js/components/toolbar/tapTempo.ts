// js/components/Toolbar/tapTempo.js
import store from '@state/index.ts';
import logger from '@utils/logger.ts';
import tempoVisualizer from './tempoVisualizer.js';

type TapType = 'eighth' | 'quarter' | 'dottedQuarter';

/**
 * TapTempo handles tap tempo input on tempo icons
 * Allows users to tap tempo instead of using the slider
 */
class TapTempo {
  private tapHistory: number[] = [];
  private activeTapType: TapType | null = null;
  private resetTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly resetWindowMs = 2000;
  private readonly durationMultipliers: Record<TapType, number> = {
    eighth: 0.5,
    quarter: 1.0,
    dottedQuarter: 1.5
  };
  private iconElements = new Map<TapType, HTMLElement>();

  constructor() {
    this.initElements();
  }

  private initElements(): void {
    const tempoTypes: { type: TapType; containerId: string }[] = [
      { type: 'eighth', containerId: 'eighth-note-tempo' },
      { type: 'quarter', containerId: 'quarter-note-tempo' },
      { type: 'dottedQuarter', containerId: 'dotted-quarter-tempo' }
    ];

    tempoTypes.forEach(({ type, containerId }) => {
      const container = document.getElementById(containerId);
      const tempoGroup = container?.parentElement;
      const icon = tempoGroup?.querySelector('.tempo-label-icon') as HTMLElement | null;

      if (icon) {
        this.iconElements.set(type, icon);

        icon.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleTap(type);
        });

        icon.style.cursor = 'pointer';
      } else {
        logger.warn('TapTempo', `Could not find icon for ${type} tempo`, { type }, 'toolbar');
      }
    });
  }

  handleTap(type: TapType): void {
    const now = performance.now();

    if (this.activeTapType !== null && this.activeTapType !== type) {
      this.reset();
    }

    this.activeTapType = type;
    tempoVisualizer.triggerPulse(type);
    this.tapHistory.push(now);

    if (this.tapHistory.length >= 2) {
      this.calculateAndApplyTempo(type);
    }

    this.scheduleReset();
  }

  private calculateAndApplyTempo(type: TapType): void {
    const intervals: number[] = [];
    for (let i = 1; i < this.tapHistory.length; i++) {
      const current = this.tapHistory[i] ?? 0;
      const previous = this.tapHistory[i - 1] ?? 0;
      intervals.push(current - previous);
    }

    if (intervals.length === 0) {
      return;
    }

    const avgIntervalMs = intervals.reduce((sum: number, interval: number) => sum + interval, 0) / intervals.length;
    const durationMultiplier = this.durationMultipliers[type] ?? 1;
    const quarterNoteIntervalMs = avgIntervalMs / durationMultiplier;
    const bpm = 60000 / quarterNoteIntervalMs;
    const clampedBPM = Math.max(30, Math.min(240, Math.round(bpm)));

    logger.debug(
      'TapTempo',
      `${type} tempo tap processed`,
      { intervals: intervals.length, averageMs: avgIntervalMs, bpm: clampedBPM },
      'toolbar'
    );

    store.emit('tempoChange', { bpm: clampedBPM, source: 'tap-tempo', duration: type });
  }

  private scheduleReset(): void {
    if (this.resetTimeout !== null) {
      clearTimeout(this.resetTimeout);
    }
    this.resetTimeout = setTimeout(() => {
      this.reset();
    }, this.resetWindowMs);
  }

  reset(): void {
    this.tapHistory = [];
    this.activeTapType = null;
    if (this.resetTimeout !== null) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }
  }
}

const tapTempo = new TapTempo();
export default tapTempo;
