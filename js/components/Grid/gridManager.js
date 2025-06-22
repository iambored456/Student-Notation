// js/components/Grid/gridManager.js
import Grid from './Grid.js';
import DrumGrid from './drumGrid.js';

console.log("GridManager: Module loaded.");

/**
 * The GridManager is responsible for initializing all grid-related components.
 * It follows the "facade" pattern, providing a single, simple entry point (`init`)
 * to set up the entire interactive grid system.
 * This approach decouples the main application from the internal details of
 * how the pitch and drum grids are constructed and managed.
 */
const GridManager = {
    init() {
        // Initialize each grid component. They will handle their own
        // event listeners and rendering logic internally.
        Grid.init();
        DrumGrid.init();
        
        console.log("GridManager: Pitch and Drum grids have been initialized.");
    }
};

export default GridManager;