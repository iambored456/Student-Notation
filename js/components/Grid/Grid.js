// js/components/Grid/Grid.js
import store from '../../state/store.js';
import CanvasContextService from '../../services/canvasContextService.js';
import { drawPitchGrid } from './renderers/pitchGridRenderer.js';
import { getPitchNotes } from '../../state/selectors.js';

console.log("PitchGridController: Module loaded.");

function renderPitchGrid() {
    const ctx = CanvasContextService.getPitchContext();
    if (!ctx || !ctx.canvas) {
        console.error("PitchGridController: Pitch grid context not available for rendering.");
        return;
    }
    
    const renderOptions = {
        placedNotes: getPitchNotes(store.state),
        // FIX: Use the new getter
        placedTonicSigns: store.placedTonicSigns,
        fullRowData: store.state.fullRowData,
        columnWidths: store.state.columnWidths,
        cellWidth: store.state.cellWidth,
        cellHeight: store.state.cellHeight,
        macrobeatGroupings: store.state.macrobeatGroupings,
        macrobeatBoundaryStyles: store.state.macrobeatBoundaryStyles,
        colorMode: 'color',
        // Pass the degree display mode instead of a boolean
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