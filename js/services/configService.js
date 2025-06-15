// js/services/configService.js
import store from '../state/store.js';

console.log("ConfigService: Module loaded.");

let resizeTimeout;
const DEBOUNCE_DELAY = 50;
const MIN_VISUAL_ROWS = 5;

let gridContainer, canvas, ctx, drumCanvas, drumCtx, playheadCanvas, hoverCanvas, drumHoverCanvas, pitchCanvasWrapper;

function initDOMElements() {
    gridContainer = document.getElementById('grid-container');
    pitchCanvasWrapper = document.getElementById('pitch-canvas-wrapper');
    canvas = document.getElementById('notation-grid');
    drumCanvas = document.getElementById('drum-grid');
    playheadCanvas = document.getElementById('playhead-canvas');
    hoverCanvas = document.getElementById('hover-canvas');
    drumHoverCanvas = document.getElementById('drum-hover-canvas');
    
    if (!canvas || !drumCanvas || !playheadCanvas || !hoverCanvas || !drumHoverCanvas || !pitchCanvasWrapper) {
        console.error("ConfigService: A required canvas or wrapper element was not found in the DOM.");
        return { ctx: null, drumCtx: null };
    }
    ctx = canvas.getContext('2d');
    drumCtx = drumCanvas.getContext('2d');
    
    console.log("ConfigService: DOM elements and drawing contexts initialized.");
    return { ctx, drumCtx };
}

function recalcGridColumns() {
    const mainGrid = store.state.macrobeatGroupings.flatMap(mb => Array(mb).fill(1));
    store.state.columnWidths = [3, 3, ...mainGrid, 3, 3];
    console.log("ConfigService: Recalculated column widths based on macrobeat groupings.");
}

function applyDimensions() {
    console.log("ConfigService: Applying stored dimensions to canvas elements.");
    const { cellWidth, cellHeight, columnWidths } = store.state;
    
    const totalWidthUnits = columnWidths.reduce((sum, w) => sum + w, 0);
    const canvasWidth = cellWidth * totalWidthUnits;

    const totalLogicRows = store.state.fullRowData.length;
    const totalVisualRows = totalLogicRows / 2;
    const canvasHeight = cellHeight * totalVisualRows;
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    playheadCanvas.width = canvasWidth;
    playheadCanvas.height = canvasHeight;
    hoverCanvas.width = canvasWidth;
    hoverCanvas.height = canvasHeight;

    pitchCanvasWrapper.style.height = `${canvasHeight}px`;
    
    const pitchRowHeight = 0.5 * cellHeight;
    const drumCanvasHeight = 3 * pitchRowHeight;
    drumCanvas.width = canvasWidth;
    drumCanvas.height = drumCanvasHeight;
    drumHoverCanvas.width = canvasWidth;
    drumHoverCanvas.height = drumCanvasHeight;
    
    gridContainer.style.width = `${canvasWidth}px`;
    
    store.emit('gridResized');
}

function calculateAndApplyHeightBasedDimensions() {
    console.log("ConfigService: Calculating height-based dimensions.");
    const container = document.getElementById('grid-container-wrapper');
    if (!container) return;

    const containerHeight = container.offsetHeight;
    const cellHeight = containerHeight / store.state.visualRows;
    const cellWidth = cellHeight / 2;
    
    store.state.cellWidth = cellWidth;
    store.state.cellHeight = cellHeight;

    applyDimensions();
}

function resizeCanvas() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(calculateAndApplyHeightBasedDimensions, DEBOUNCE_DELAY);
}

function immediateResizeCanvas() {
    clearTimeout(resizeTimeout);
    calculateAndApplyHeightBasedDimensions();
}

const ConfigService = {
    init() {
        const contexts = initDOMElements();
        recalcGridColumns();
        immediateResizeCanvas();

        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('orientationchange', resizeCanvas);

        store.on('rhythmChanged', () => {
            recalcGridColumns();
            immediateResizeCanvas();
        });
        
        console.log("ConfigService: Initialized and event listeners attached.");
        return contexts;
    },

    getColumnX(index) {
        let x = 0;
        for (let i = 0; i < index; i++) {
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
      const cellWidth = containerWidth / totalWidthUnits;
      const cellHeight = cellWidth * 2;
      
      const containerHeight = container.offsetHeight;
      const maxVisualRows = Math.floor(store.state.fullRowData.length / 2);
      let newVisualRows = Math.floor(containerHeight / cellHeight);
      
      newVisualRows = Math.max(MIN_VISUAL_ROWS, Math.min(newVisualRows, maxVisualRows));
      
      store.state.cellWidth = cellWidth;
      store.state.cellHeight = cellHeight;
      store.state.visualRows = newVisualRows;
      
      store.state.logicRows = newVisualRows * 2;
      
      if (store.state.gridPosition + store.state.logicRows > store.state.fullRowData.length) {
          store.state.gridPosition = store.state.fullRowData.length - store.state.logicRows;
      }

      applyDimensions();
    },

    fitToHeight() {
      console.log("ConfigService: Action -> fitToHeight");
      const numLogicRows = store.state.fullRowData.length;
      const numVisualRows = numLogicRows / 2;
      
      store.state.logicRows = numLogicRows;
      store.state.visualRows = numVisualRows;
      store.state.gridPosition = 0;
      
      immediateResizeCanvas();
    },
    
    zoomIn() {
        if (store.state.visualRows > MIN_VISUAL_ROWS) {
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