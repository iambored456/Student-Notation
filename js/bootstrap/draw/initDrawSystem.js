// js/bootstrap/draw/initDrawSystem.js
import logger from '@utils/logger.js';
import annotationService from '@services/annotationService.js';
import drawToolsController from '@components/draw/drawToolsController.js';
import DrumPlayheadRenderer from '@components/canvas/drumGrid/drumPlayheadRenderer.js';

export function initDrawSystem() {
  logger.initStart('Draw Tools');
  annotationService.initialize();
  drawToolsController.initialize();
  window.drawToolsController = drawToolsController;
  window.annotationService = annotationService;
  logger.initSuccess('Draw Tools');

  logger.initStart('Drum components');
  DrumPlayheadRenderer.initialize();
  logger.initSuccess('Drum components');
}
