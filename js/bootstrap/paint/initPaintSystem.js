// js/bootstrap/paint/initPaintSystem.js
import logger from '@utils/logger.js';
import PaintCanvas from '@components/pitchPaint/paintCanvas.js';
import PaintPlayheadRenderer from '@components/pitchPaint/paintPlayheadRenderer.js';
import PaintControls from '@components/pitchPaint/paintControls.js';
import PaintPlaybackService from '@services/paintPlaybackService.js';
import MeterController from '@components/audio/meter/meterController.js';

export async function initPaintSystem() {
  logger.initStart('Paint components');
  PaintCanvas.initialize();
  PaintPlayheadRenderer.initialize();
  PaintControls.initialize();
  await PaintPlaybackService.initialize();
  window.PaintPlaybackService = PaintPlaybackService;
  MeterController.initialize();
  logger.initSuccess('Paint components');
}
