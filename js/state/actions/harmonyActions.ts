// js/state/actions/harmonyActions.ts
import type { Store } from '../../../types/state.js';

export const harmonyActions = {
  setActiveChordIntervals(this: Store, intervals: string[]): void {
    this.state.activeChordIntervals = intervals;
    this.emit('activeChordIntervalsChanged', intervals);
  },

  setIntervalsInversion(this: Store, isInverted: boolean): void {
    this.state.isIntervalsInverted = isInverted;
    this.emit('intervalsInversionChanged', isInverted);
  },

  setChordPosition(this: Store, positionState: number): void {
    this.state.chordPositionState = positionState;
    this.emit('chordPositionChanged', positionState);
  }
};
