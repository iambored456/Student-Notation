// js/components/Grid/Grid.js
import store from '../../state/index.js';
import CanvasContextService from '../../services/canvasContextService.js';
import { drawPitchGrid } from './renderers/pitchGridRenderer.js';
import { getPitchNotes, getPlacedTonicSigns } from '../../state/selectors.js';

console.log("PitchGridController: Module loaded.");

function renderPitchGrid() {
    const ctx = CanvasContextService.getPitchContext();
    if (!ctx || !ctx.canvas) {
        console.error("PitchGridController: Pitch grid context not available for rendering.");
        return;
    }
    
    const renderOptions = {
        placedNotes: getPitchNotes(store.state),
        placedTonicSigns: getPlacedTonicSigns(store.state),
        fullRowData: store.state.fullRowData,
        columnWidths: store.state.columnWidths,
        cellWidth: store.state.cellWidth,
        cellHeight: store.state.cellHeight,
        macrobeatGroupings: store.state.macrobeatGroupings,
        macrobeatBoundaryStyles: store.state.macrobeatBoundaryStyles,
        colorMode: 'color',
        degreeDisplayMode: store.state.degreeDisplayMode 
    };
    
    drawPitchGrid(ctx, renderOptions);
}

const PitchGridController = {
    render() {
        renderPitchGrid();
    }
};

export default PitchGridController;