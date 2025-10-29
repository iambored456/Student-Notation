// js/components/Canvas/PitchGrid/PitchGrid.js
import store from '../../../state/index.js';
import CanvasContextService from '../../../services/canvasContextService.js';
import { drawPitchGrid } from './renderers/pitchGridRenderer.js';
import { renderRhythmUI } from '../MacrobeatTools/rhythmUI.js';
import { renderTimeSignatureDisplay } from '../MacrobeatTools/timeSignatureDisplay.js';
import { getPitchNotes, getPlacedTonicSigns } from '../../../state/selectors.js';
import LayoutService from '../../../services/layoutService.js';
import logger from '../../../utils/logger.js';

logger.moduleLoaded('PitchGridController', 'grid');

function renderPitchGrid() {
    const ctx = CanvasContextService.getPitchContext();
    if (!ctx || !ctx.canvas) {
        logger.error('PitchGridController', 'Pitch grid context not available for rendering', null, 'grid');
        return;
    }
    
    const renderOptions = {
        placedNotes: getPitchNotes(store.state),
        placedTonicSigns: getPlacedTonicSigns(store.state),
        fullRowData: store.state.fullRowData,
        columnWidths: store.state.columnWidths,
        cellWidth: store.state.cellWidth,
        cellHeight: store.state.cellHeight,
        rowHeight: store.state.cellHeight * 0.5,
        macrobeatGroupings: store.state.macrobeatGroupings,
        macrobeatBoundaryStyles: store.state.macrobeatBoundaryStyles,
        colorMode: 'color',
        degreeDisplayMode: store.state.degreeDisplayMode,
        zoomLevel: LayoutService.getViewportInfo().zoomLevel,
        viewportHeight: ctx.canvas.height
    };
    
    drawPitchGrid(ctx, renderOptions);
}

const PitchGridController = {
    render() {
        renderPitchGrid();
    },
    
    renderMacrobeatTools() {
        renderRhythmUI();
        renderTimeSignatureDisplay();
    }
};

export default PitchGridController;
