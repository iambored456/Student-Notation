import logger from '@utils/logger.ts';

let pitchContext: CanvasRenderingContext2D | null = null;
let drumContext: CanvasRenderingContext2D | null = null;
let legendLeftContext: CanvasRenderingContext2D | null = null;
let legendRightContext: CanvasRenderingContext2D | null = null;

interface Contexts {
  ctx?: CanvasRenderingContext2D | null;
  drumCtx?: CanvasRenderingContext2D | null;
  legendLeftCtx?: CanvasRenderingContext2D | null;
  legendRightCtx?: CanvasRenderingContext2D | null;
}

const CanvasContextService = {
  /**
  * Sets the drawing contexts for the application.
  * Should be called once during initialization in main.ts.
   */
  setContexts({ ctx, drumCtx, legendLeftCtx, legendRightCtx }: Contexts): void {
    pitchContext = ctx ?? null;
    drumContext = drumCtx ?? null;
    legendLeftContext = legendLeftCtx ?? null;
    legendRightContext = legendRightCtx ?? null;
  },

  /**
   * Retrieves the pitch grid drawing context.
   */
  getPitchContext(): CanvasRenderingContext2D | null {
    if (!pitchContext) {
      logger.error('CanvasContextService', 'Pitch context requested before it was set.', null, 'canvas');
    }
    return pitchContext;
  },

  /**
   * Retrieves the drum grid drawing context.
   */
  getDrumContext(): CanvasRenderingContext2D | null {
    if (!drumContext) {
      logger.error('CanvasContextService', 'Drum context requested before it was set.', null, 'canvas');
    }
    return drumContext;
  },

  /**
   * Retrieves the left legend drawing context.
   */
  getLegendLeftContext(): CanvasRenderingContext2D | null {
    if (!legendLeftContext) {
      logger.error('CanvasContextService', 'Legend left context requested before it was set.', null, 'canvas');
    }
    return legendLeftContext;
  },

  /**
   * Retrieves the right legend drawing context.
   */
  getLegendRightContext(): CanvasRenderingContext2D | null {
    if (!legendRightContext) {
      logger.error('CanvasContextService', 'Legend right context requested before it was set.', null, 'canvas');
    }
    return legendRightContext;
  }
};

export default CanvasContextService;
