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
        
        // Import store for animation events
        import('../../../state/index.js').then(({ default: store }) => {
            // Listen for animation updates to trigger canvas redraws
            store.on('animationUpdate', (data) => {
                // Only redraw if we have vibrato animations
                if (data.type === 'vibrato' && data.activeColors && data.activeColors.length > 0) {
                    this.renderPitchGrid();
                }
                // Also handle combined animations (both vibrato and tremolo)
                else if (data.type === 'combined' && data.vibratoColors && data.vibratoColors.length > 0) {
                    this.renderPitchGrid();
                }
            });
        });
        
    },

    // Expose the render methods from the controller modules.
    // These will be called from main.js when the state changes.
    renderPitchGrid: PitchGridController.render,
    renderDrumGrid: DrumGridController.render
};

export default GridManager;