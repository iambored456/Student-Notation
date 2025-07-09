// js/components/Harmony/Harmony.js
import store from '../../state/index.js';
import { drawHarmonyGrid } from './harmonyRenderer.js';
import LayoutService from '../../services/layoutService.js';

let canvas, ctx;

function render() {
    if (!ctx) return;

    // Revert to simpler width/height management
    const totalWidth = LayoutService.getCanvasWidth();

    if (canvas.width !== totalWidth) {
        canvas.width = totalWidth;
    }
    // Set to the new fixed height from CSS
    canvas.height = 90;

    const renderOptions = {
        state: store.state,
    };

    drawHarmonyGrid(ctx, renderOptions);
}

const Harmony = {
    init() {
        canvas = document.getElementById('harmony-analysis-canvas');
        if (!canvas) {
            console.error("Harmony: Could not find harmony canvas element.");
            return;
        }
        ctx = canvas.getContext('2d');
        
        // Removed the ResizeObserver as it's no longer needed for dynamic height.
        
        render(); // Initial render
        console.log("Harmony: Initialized.");
    },
    render
};

export default Harmony;