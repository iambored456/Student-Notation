// js/services/configService.js
import store from '../state/store.js';

console.log("ConfigService: Module loaded.");

let resizeTimeout;
const DEBOUNCE_DELAY = 50;

// Grid DOM Elements
let gridContainer, canvas, ctx, drumCanvas, drumCtx, playheadCanvas;

function initDOMElements() {
    gridContainer = document.getElementById('grid-container');
    canvas = document.getElementById('notation-grid');
    drumCanvas = document.getElementById('drum-grid');
    playheadCanvas = document.getElementById('playhead-canvas');
    
    if (!canvas || !drumCanvas || !playheadCanvas) {
        console.error("ConfigService: A required canvas element was not found in the DOM.");
        return;
    }
    ctx = canvas.getContext('2d');
    drumCtx = drumCanvas.getContext('2d');
    
    // Storing contexts on the window object is a simple way to make them globally 
    // accessible to the dedicated drawing modules (Grid.js, drumGrid.js) without
    // needing to pass them as arguments through multiple layers.
    window.pitchGridCtx = ctx;
    window.drumGridCtx = drumCtx;
    
    console.log("ConfigService: DOM elements and drawing contexts initialized.");
}

function recalcGridColumns() {
    const mainGrid = store.state.macrobeatGroupings.flatMap(mb => Array(mb).fill(1));
    store.state.columnWidths = [3, 3, ...mainGrid, 3, 3];
    console.log("ConfigService: Recalculated column widths based on macrobeat groupings.");
}

function performResize() {
    console.log("ConfigService: Performing resize calculations.");
    const container = document.getElementById('grid-container-wrapper');
    if (!container) return;

    const containerHeight = container.offsetHeight;
    
    const cellHeight = containerHeight / store.state.visualRows;
    const cellWidth = cellHeight / 2;
    
    // Update the store with the new calculated dimensions
    store.state.cellWidth = cellWidth;
    store.state.cellHeight = cellHeight;
    
    const totalWidthUnits = store.state.columnWidths.reduce((sum, w) => sum + w, 0);
    const canvasWidth = cellWidth * totalWidthUnits;
    const canvasHeight = cellHeight * store.state.visualRows;
    
    // Update pitch grid and playhead canvas
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    playheadCanvas.width = canvasWidth;
    playheadCanvas.height = canvasHeight;
    gridContainer.style.width = `${canvasWidth}px`;
    
    // Update drum grid canvas
    const pitchRowHeight = 0.5 * store.state.cellHeight;
    drumCanvas.width = canvasWidth;
    drumCanvas.height = 3 * pitchRowHeight;
    
    // Notify all components that the grid has been resized so they can redraw themselves.
    store.emit('gridResized');
}

// Debounced resize for window events
function resizeCanvas() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(performResize, DEBOUNCE_DELAY);
}

// Immediate resize for UI button clicks
function immediateResizeCanvas() {
    clearTimeout(resizeTimeout);
    performResize();
}

// Public API for the service
const ConfigService = {
    init() {
        initDOMElements();
        recalcGridColumns();
        immediateResizeCanvas();

        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('orientationchange', resizeCanvas);

        // Listen for rhythm changes to recalc columns and resize
        store.on('rhythmChanged', () => {
            console.log("ConfigService: Detected rhythmChanged event, recalculating columns and resizing.");
            recalcGridColumns();
            immediateResizeCanvas();
        });
        console.log("ConfigService: Initialized and event listeners attached.");
    },

    // A helper function to get the X coordinate of any column index.
    // This is used by drawing and event listening modules.
    getColumnX(index) {
        let x = 0;
        for (let i = 0; i < index; i++) {
            // Ensure columnWidths is not empty to prevent errors on initial load
            const widthMultiplier = store.state.columnWidths[i] || 0;
            x += widthMultiplier * store.state.cellWidth;
        }
        return x;
    },

    fitToWidth() {
      console.log("ConfigService: Action -> fitToWidth");
      const container = document.getElementById('grid-container-wrapper');
      if (!container) return;
      
      const containerWidth = container.offsetWidth;
      const totalWidthUnits = store.state.columnWidths.reduce((sum, w) => sum + w, 0);
      
      store.state.cellWidth = containerWidth / totalWidthUnits;
      store.state.cellHeight = store.state.cellWidth * 2;
      
      immediateResizeCanvas();
    },

    fitToHeight() {
      console.log("ConfigService: Action -> fitToHeight");
      const container = document.getElementById('grid-container-wrapper');
      if (!container) return;
      
      const containerHeight = container.offsetHeight;
      const numRows = store.state.fullRowData.length;
      
      store.state.cellHeight = containerHeight / numRows;
      store.state.cellWidth = store.state.cellHeight / 2;
      
      store.state.visualRows = numRows;
      store.state.logicRows = numRows;
      store.state.gridPosition = 0;
      
      immediateResizeCanvas();
    },
    
    zoomIn() {
        const minVisualRows = 5;
        if (store.state.visualRows > minVisualRows) {
            store.state.visualRows--;
            store.state.logicRows = store.state.visualRows * 2;
            immediateResizeCanvas();
            console.log("ConfigService: Action -> zoomIn.");
        }
    },

    zoomOut() {
        const maxVisualRows = Math.floor(store.state.fullRowData.length / 2);
        if (store.state.visualRows < maxVisualRows) {
            store.state.visualRows++;
            store.state.logicRows = store.state.visualRows * 2;
            
            if (store.state.gridPosition + store.state.logicRows > store.state.fullRowData.length) {
                store.state.gridPosition = store.state.fullRowData.length - store.state.logicRows;
            }

            immediateResizeCanvas();
            console.log("ConfigService: Action -> zoomOut.");
        }
    }
};

export default ConfigService;