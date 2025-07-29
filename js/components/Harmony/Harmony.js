// js/components/Harmony/Harmony.js
import store from '../../state/index.js';
import { drawHarmonyGrid } from './harmonyRenderer.js';
import LayoutService from '../../services/layoutService.js';

let canvas, ctx;

function render() {
    if (!ctx) return;

    const totalWidth = LayoutService.getCanvasWidth();

    if (canvas.width !== totalWidth) {
        canvas.width = totalWidth;
    }

    // THE FIX: Set the canvas height dynamically from its container's actual height
    if (canvas.height !== canvas.clientHeight) {
        canvas.height = canvas.clientHeight;
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
            console.error("Harmony: Could not find harmony canvas element.");
            return;
        }
        ctx = canvas.getContext('2d');
        
        // Listen for layout changes that might affect width
        store.on('layoutConfigChanged', render);
        
        render(); // Initial render
        console.log("Harmony: Initialized.");
    },
    render
};

export default Harmony;