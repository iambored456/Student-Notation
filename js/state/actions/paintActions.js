// js/state/actions/paintActions.js
import logger from '@utils/logger.js';

logger.moduleLoaded('paintActions', 'state');

export const paintActions = {
  setMicPaintActive(isActive) {
    this.state.paint.isMicPaintActive = isActive;
    logger.debug('paintActions', `Mic Paint Active set to: ${isActive}`, null, 'paint');
    this.emit('micPaintStateChanged', isActive);
  },

  setPaintDetectionState(isDetecting) {
    const wasDetecting = this.state.paint.isDetecting;
    this.state.paint.isDetecting = isDetecting;
    logger.debug('paintActions', `Paint detection state set to: ${isDetecting}`, null, 'paint');
    this.emit('paintDetectionStateChanged', isDetecting);
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
    logger.debug('paintActions', 'Paint history cleared', null, 'paint');
    this.emit('paintHistoryChanged');
    this.recordState();
  },

  setPaintSettings(settings) {
    Object.assign(this.state.paint.paintSettings, settings);
    logger.debug('paintActions', 'Paint settings updated', { settings: this.state.paint.paintSettings }, 'paint');
    this.emit('paintSettingsChanged', this.state.paint.paintSettings);
    this.recordState(); // Also save settings changes
  }
};
