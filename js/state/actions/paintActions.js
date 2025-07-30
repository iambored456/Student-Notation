// js/state/actions/paintActions.js
console.log("paintActions.js: Module loaded.");

export const paintActions = {
  setMicPaintActive(isActive) {
    this.state.paint.isMicPaintActive = isActive;
    console.log(`[STATE] Mic Paint Active set to: ${isActive}`);
    this.emit('micPaintStateChanged', isActive);
  },

  setDetectedPitch(pitchData) {
    this.state.paint.detectedPitch = pitchData;
    this.emit('pitchDetected', pitchData);
  },

  addPaintPoint(point) {
    this.state.paint.paintHistory.push(point);
    // No emit for performance. Redraw is handled by the animation loop.
  },

  clearPaintHistory() {
    this.state.paint.paintHistory = [];
    console.log("[STATE] Paint history cleared.");
    this.emit('paintHistoryChanged');
    this.recordState();
  },

  setPaintSettings(settings) {
    Object.assign(this.state.paint.paintSettings, settings);
    console.log("[STATE] Paint settings updated:", this.state.paint.paintSettings);
    this.emit('paintSettingsChanged', this.state.paint.paintSettings);
    this.recordState(); // Also save settings changes
  }
};