// js/components/Canvas/HarmonyAnalysis/Harmony.js
import store from '../../../state/index.js';
import { drawHarmonyGrid } from './harmonyRenderer.js';
import LayoutService from '../../../services/layoutService.js';
import logger from '../../../utils/logger.js';

let canvas, ctx;

function render() {
    if (!ctx) return;

    const totalWidth = LayoutService.getCanvasWidth();

    if (canvas.width !== totalWidth) {
        canvas.width = totalWidth;
    }

    // FIXED: Use a single row height instead of container height
    const drumRowHeight = 0.5 * store.state.cellHeight;
    if (canvas.height !== drumRowHeight) {
        canvas.height = drumRowHeight;
    }
    
    const renderOptions = {
        state: store.state,
    };

    drawHarmonyGrid(ctx, renderOptions);
}

const Harmony = {
    init() {
        canvas = document.getElementById('harmony-analysis-canvas');
        if (!canvas) {
            logger.error('Harmony', 'Could not find harmony canvas element', null, 'harmony');
            return;
        }
        ctx = canvas.getContext('2d');
        
        // Listen for layout changes that might affect width
        store.on('layoutConfigChanged', render);
        
        render(); // Initial render
        logger.info('Harmony', 'Initialized', null, 'harmony');
    },
    render
};

export default Harmony;