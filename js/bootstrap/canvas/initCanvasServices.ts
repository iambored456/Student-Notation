// js/bootstrap/canvas/initCanvasServices.ts
import LayoutService from '@services/layoutService.ts';
import CanvasContextService from '@services/canvasContextService.ts';
import scrollSyncService from '@services/scrollSyncService.ts';
import GridManager from '@components/canvas/PitchGrid/gridManager.ts';

/**
 * Initializes layout + canvas contexts and prepares scroll synchronization.
 * Returns any context objects LayoutService exposes so consumers can render.
 */
export function initCanvasServices() {
  const contexts = LayoutService.init();
  CanvasContextService.setContexts(contexts);
  scrollSyncService.init();
  GridManager.init();
  return contexts;
}
