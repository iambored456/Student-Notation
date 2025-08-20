// js/components/Canvas/HarmonyAnalysis/Harmony.js
import store from '../../../state/index.js';
import { renderAnalysisGrid } from '../../../harmony/ui/renderers/analysisRenderers.js';
import LayoutService from '../../../services/layoutService.js';
import logger from '../../../utils/logger.js';

let degreeCanvas, degreeCtx, romanCanvas, romanCtx;

function render() {
    if (!degreeCtx || !romanCtx) return;

    const totalWidth = LayoutService.getModulatedCanvasWidth();
    const rowHeight = store.state.cellHeight; // Use full row height like pitchGrid

    // Update canvas dimensions
    [degreeCanvas, romanCanvas].forEach(canvas => {
        if (canvas.width !== totalWidth) {
            canvas.width = totalWidth;
        }
        if (canvas.height !== rowHeight) {
            canvas.height = rowHeight;
        }
    });
    
    // Create a regionContext that spans all beats for analysis
    const totalBeats = store.state.columnWidths.length - 4; // Exclude side columns (2 at start, 2 at end)
    const fullRegionContext = {
        startBeat: 2, // Start after the first two side columns
        length: totalBeats
    };

    const renderOptions = {
        state: {
            ...store.state,
            regionContext: fullRegionContext
        },
        selectionRect: { startX: 0, endX: 0 },
        isDragging: false
    };

    renderAnalysisGrid(degreeCtx, romanCtx, renderOptions);
}

const Harmony = {
    init() {
        degreeCanvas = document.getElementById('analysis-degree-canvas');
        romanCanvas = document.getElementById('analysis-roman-canvas');
        
        if (!degreeCanvas || !romanCanvas) {
            logger.error('Harmony', 'Could not find analysis canvas elements', null, 'harmony');
            return;
        }
        
        degreeCtx = degreeCanvas.getContext('2d');
        romanCtx = romanCanvas.getContext('2d');
        
        // Listen for layout changes that might affect width
        store.on('layoutConfigChanged', render);
        store.on('modulationMarkersChanged', render);
        store.on('notesChanged', render);
        store.on('chordsChanged', render);
        
        render(); // Initial render
        logger.info('Harmony', 'Initialized with two-row layout', null, 'harmony');
    },
    render
};

export default Harmony;