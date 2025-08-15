// js/components/Canvas/PitchGrid/gridManager.js
import PitchGridController from './PitchGrid.js';
import DrumGridController from '../DrumGrid/drumGrid.js';
import { initPitchGridInteraction } from './interactors/pitchGridInteractor.js';
import { initDrumGridInteraction } from '../DrumGrid/drumGridInteractor.js';


/**
 * The GridManager is responsible for initializing all grid-related components
 * and exposing their core functionalities (like rendering) to the main application.
 */
const GridManager = {
    init() {
        // Initialize the event handlers for both grids.
        initPitchGridInteraction();
        initDrumGridInteraction();
        
        // Listen for canvas resize events from layoutService
        document.addEventListener('canvasResized', (event) => {
            this.renderPitchGrid();
            this.renderDrumGrid();
        });
        
    },

    // Expose the render methods from the controller modules.
    // These will be called from main.js when the state changes.
    renderPitchGrid: PitchGridController.render,
    renderDrumGrid: DrumGridController.render
};

export default GridManager;