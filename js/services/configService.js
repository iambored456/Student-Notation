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
    
    return { ctx, drumCtx };
}

function recalcGridColumns() {
    const mainGrid = store.state.macrobeatGroupings.flatMap(mb => Array(mb).fill(1));
    store.state.columnWidths = [3, 3, ...mainGrid, 3, 3];
}

function applyDimensions() {
    const { cellWidth, cellHeight, columnWidths } = store.state;
    
    const totalWidthUnits = columnWidths.reduce((sum, w) => sum + w, 0);
    const canvasWidth = cellWidth * totalWidthUnits;

    const totalLogicRows = store.state.fullRowData.length;
    const totalVisualRows = totalLogicRows / 2;
    const canvasHeight = cellHeight * totalVisualRows;
    
    [canvas, playheadCanvas, hoverCanvas].forEach(c => {
        c.width = canvasWidth;
        c.height = canvasHeight;
    });

    pitchCanvasWrapper.style.height = `${canvasHeight}px`;
    
    const pitchRowHeight = 0.5 * cellHeight;
    const drumCanvasHeight = 3 * pitchRowHeight;
    
    [drumCanvas, drumHoverCanvas].forEach(c => {
        c.width = canvasWidth;
        c.height = drumCanvasHeight;
    });
    
    gridContainer.style.width = `${canvasWidth}px`;
    
    store.emit('layoutConfigChanged');
}

function calculateAndApplyHeightBasedDimensions() {
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
    resizeTimeout = setTimeout(calculateAndApplyHeightBasedDimensions, 50);
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

        store.on('rhythmStructureChanged', () => {
            recalcGridColumns();
            applyDimensions(); 
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
    
    zoomIn() {
        if (store.state.visualRows > MIN_VISUAL_ROWS) {
            const oldVisualRows = store.state.visualRows;
            const centerRow = store.state.gridPosition + (oldVisualRows / 2);
            
            store.state.visualRows--;
            const newGridPosition = Math.round(centerRow - (store.state.visualRows / 2));
            
            store.setGridPosition(newGridPosition);
            
            store.state.logicRows = store.state.visualRows * 2;
            immediateResizeCanvas();
        }
    },

    zoomOut() {
        const maxVisualRows = Math.floor(store.state.fullRowData.length / 2);
        if (store.state.visualRows < maxVisualRows) {
            const oldVisualRows = store.state.visualRows;
            const centerRow = store.state.gridPosition + (oldVisualRows / 2);

            store.state.visualRows++;
            let newGridPosition = Math.round(centerRow - (store.state.visualRows / 2));
            
            store.state.logicRows = store.state.visualRows * 2;
            
            const maxPosition = store.state.fullRowData.length - store.state.logicRows;
            if (newGridPosition > maxPosition) {
                newGridPosition = maxPosition;
            }

            store.setGridPosition(newGridPosition);

            immediateResizeCanvas();
        }
    }
};

export default ConfigService;