// js/state/actions/harmonyActions.js
export const harmonyActions = {
  setActiveChordIntervals(intervals) {
    this.state.activeChordIntervals = intervals;
    this.emit('activeChordIntervalsChanged', intervals);
  },

  setIntervalsInversion(isInverted) {
    this.state.isIntervalsInverted = isInverted;
    this.emit('intervalsInversionChanged', isInverted);
  },

  setChordPosition(positionState) {
    this.state.chordPositionState = positionState;
    this.emit('chordPositionChanged', positionState);
  }
};
