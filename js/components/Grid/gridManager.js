// js/components/Grid/gridManager.js
import PitchGridController from './Grid.js';
import DrumGridController from './drumGrid.js';
import { initPitchGridInteraction } from './interactors/pitchGridInteractor.js';
import { initDrumGridInteraction } from './interactors/drumGridInteractor.js';

console.log("GridManager: Module loaded.");

/**
 * The GridManager is responsible for initializing all grid-related components
 * and exposing their core functionalities (like rendering) to the main application.
 */
const GridManager = {
    init() {
        // Initialize the event handlers for both grids.
        initPitchGridInteraction();
        initDrumGridInteraction();
        
        console.log("GridManager: Pitch and Drum interactors have been initialized.");
    },

    // Expose the render methods from the controller modules.
    // These will be called from main.js when the state changes.
    renderPitchGrid: PitchGridController.render,
    renderDrumGrid: DrumGridController.render
};

export default GridManager;