// js/state/actions/harmonyActions.js
function generateUUID() {
  return `uuid-chord-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const harmonyActions = {
  // ... (keep all your existing functions like addChord, updateChord, etc.)
  addChord(chordData) { /* ... existing code ... */ },
  updateChord(chordId, updates) { /* ... existing code ... */ },
  deleteChord(chordId) { /* ... existing code ... */ },
  setActiveChord(chordId) { /* ... existing code ... */ },
  setRegionContext(newRegion) { /* ... existing code ... */ },
  rebuildAllChords(newKey) { /* ... existing code ... */ },
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
