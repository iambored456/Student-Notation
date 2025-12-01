// js/state/actions/paintActions.ts
import logger from '@utils/logger.ts';
import type { Store, PaintSettings, PaintPoint } from '../../../types/state.js';

logger.moduleLoaded('paintActions', 'state');

export const paintActions = {
  setMicPaintActive(this: Store, isActive: boolean): void {
    this.state.paint.isMicPaintActive = isActive;
    logger.debug('paintActions', `Mic Paint Active set to: ${isActive}`, null, 'paint');
    this.emit('micPaintStateChanged', isActive);
  },

  setPaintDetectionState(this: Store, isDetecting: boolean): void {
    this.state.paint.isDetecting = isDetecting;
    logger.debug('paintActions', `Paint detection state set to: ${isDetecting}`, null, 'paint');
    this.emit('paintDetectionStateChanged', isDetecting);
  },

  setDetectedPitch(this: Store, pitchData: { frequency: number; clarity: number; midi: number; pitchClass: number }): void {
    this.state.paint.detectedPitch = pitchData;
    this.emit('pitchDetected', pitchData);
  },

  addPaintPoint(this: Store, point: PaintPoint): void {
    this.state.paint.paintHistory.push(point);
    // No emit for performance. Redraw is handled by the animation loop.
  },

  clearPaintHistory(this: Store): void {
    this.state.paint.paintHistory = [];
    logger.debug('paintActions', 'Paint history cleared', null, 'paint');
    this.emit('paintHistoryChanged');
    this.recordState();
  },

  setPaintSettings(this: Store, settings: Partial<PaintSettings>): void {
    Object.assign(this.state.paint.paintSettings, settings);
    logger.debug('paintActions', 'Paint settings updated', { settings: this.state.paint.paintSettings }, 'paint');
    this.emit('paintSettingsChanged', this.state.paint.paintSettings);
    this.recordState(); // Also save settings changes
  }
};
