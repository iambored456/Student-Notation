// js/bootstrap/draw/initDrawSystem.ts
import annotationService from '@services/annotationService.ts';
import drawToolsController from '@components/draw/drawToolsController.ts';
import logger from '@utils/logger.ts';

export function initDrawSystem() {
  // Initialize annotation service and drawing tools UI
  annotationService.initialize();
  drawToolsController.initialize?.();
  logger.initSuccess('DrawSystem');

  // Expose annotationService for debugging
  if (typeof window !== 'undefined') {
    (window as typeof window & { annotationService?: typeof annotationService }).annotationService = annotationService;
  }

  return {
    annotationService
  };
}
