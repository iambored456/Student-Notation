// js/components/Canvas/DrumGrid/drumGrid.js
import store from '../../../state/index.js';
import CanvasContextService from '../../../services/canvasContextService.js';
import { drawDrumGrid } from './drumGridRenderer.js';
import { getDrumNotes, getPlacedTonicSigns } from '../../../state/selectors.js';


function renderDrumGrid() {
    const ctx = CanvasContextService.getDrumContext();
    if (!ctx || !ctx.canvas) {
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
        modulationMarkers: store.state.modulationMarkers,
        baseMicrobeatPx: store.state.cellWidth
    };

    drawDrumGrid(ctx, renderOptions);
}

const DrumGridController = {
    render() {
        renderDrumGrid();
    }
};

export default DrumGridController;