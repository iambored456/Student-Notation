// js/bootstrap/canvas/initCanvasServices.js
import LayoutService from '@services/layoutService.js';
import CanvasContextService from '@services/canvasContextService.js';
import scrollSyncService from '@services/scrollSyncService.js';

/**
 * Initializes layout + canvas contexts and prepares scroll synchronization.
 * Returns any context objects LayoutService exposes so consumers can render.
 */
export async function initCanvasServices() {
    const contexts = LayoutService.init();
    CanvasContextService.setContexts(contexts);
    scrollSyncService.init();
    return contexts;
}
