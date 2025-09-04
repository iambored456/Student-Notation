// js/components/Canvas/DrumGrid/drumGrid.js
import store from '../../../state/index.js';
import CanvasContextService from '../../../services/canvasContextService.js';
import { drawDrumGrid } from './drumGridRenderer.js';
import { getDrumNotes, getPlacedTonicSigns } from '../../../state/selectors.js';
import { getVolumeIconState } from './drumGridInteractor.js';
import DrumPlayheadRenderer from './drumPlayheadRenderer.js';


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
        baseMicrobeatPx: store.state.cellWidth,
        volumeIconState: getVolumeIconState()
    };

    drawDrumGrid(ctx, renderOptions);
}

const DrumGridController = {
    animationFrameId: null,
    
    render() {
        renderDrumGrid();
        
        // If there are active animations, keep rendering
        if (DrumPlayheadRenderer.hasActiveAnimations()) {
            if (!DrumGridController.animationFrameId) {
                DrumGridController.startAnimationLoop();
            }
        } else {
            DrumGridController.stopAnimationLoop();
        }
    },
    
    startAnimationLoop() {
        if (DrumGridController.animationFrameId) return;
        
        const animate = () => {
            DrumPlayheadRenderer.cleanupAnimations();
            renderDrumGrid();
            
            if (DrumPlayheadRenderer.hasActiveAnimations()) {
                DrumGridController.animationFrameId = requestAnimationFrame(animate);
            } else {
                DrumGridController.animationFrameId = null;
            }
        };
        
        DrumGridController.animationFrameId = requestAnimationFrame(animate);
    },
    
    stopAnimationLoop() {
        if (DrumGridController.animationFrameId) {
            cancelAnimationFrame(DrumGridController.animationFrameId);
            DrumGridController.animationFrameId = null;
        }
    }
};

// Make globally accessible for interactor
window.drumGridRenderer = DrumGridController;

export default DrumGridController;