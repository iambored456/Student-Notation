// js/services/canvasContextService.js

import logger from '@utils/logger.js';

let pitchContext = null;
let drumContext = null;

const CanvasContextService = {
    /**
     * Sets the drawing contexts for the application.
     * Should be called once during initialization in main.js.
     * @param {object} contexts - An object containing the contexts.
     * @param {CanvasRenderingContext2D} contexts.ctx - The context for the main pitch grid.
     * @param {CanvasRenderingContext2D} contexts.drumCtx - The context for the drum grid.
     */
    setContexts({ ctx, drumCtx }) {
        pitchContext = ctx;
        drumContext = drumCtx;
    },

    /**
     * Retrieves the pitch grid drawing context.
     * @returns {CanvasRenderingContext2D} The 2D rendering context.
     */
    getPitchContext() {
        if (!pitchContext) {
            logger.error('CanvasContextService', 'Pitch context requested before it was set.', null, 'canvas');
        }
        return pitchContext;
    },

    /**
     * Retrieves the drum grid drawing context.
     * @returns {CanvasRenderingContext2D} The 2D rendering context.
     */
    getDrumContext() {
        if (!drumContext) {
            logger.error('CanvasContextService', 'Drum context requested before it was set.', null, 'canvas');
        }
        return drumContext;
    }
};

export default CanvasContextService;
