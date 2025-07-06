// js/components/Grid/drumGrid.js
import store from '../../state/index.js';
import CanvasContextService from '../../services/canvasContextService.js';
import { drawDrumGrid } from './renderers/drumGridRenderer.js';
import { getDrumNotes, getPlacedTonicSigns } from '../../state/selectors.js';

console.log("DrumGridController: Module loaded.");

function renderDrumGrid() {
    const ctx = CanvasContextService.getDrumContext();
    if (!ctx || !ctx.canvas) {
        console.error("DrumGridController: Drum grid context not available for rendering.");
        return;
    }
    
    const renderOptions = {
        placedNotes: getDrumNotes(store.state),
        placedTonicSigns: getPlacedTonicSigns(store.state),
        columnWidths: store.state.columnWidths,
        cellWidth: store.state.cellWidth,
        cellHeight: store.state.cellHeight,
        macrobeatGroupings: store.state.macrobeatGroupings,
        macrobeatBoundaryStyles: store.state.macrobeatBoundaryStyles,
    };

    drawDrumGrid(ctx, renderOptions);
}

const DrumGridController = {
    render() {
        renderDrumGrid();
    }
};

export default DrumGridController;