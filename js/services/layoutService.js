// js/services/layoutService.js
import store from '../state/store.js';
import { RESIZE_DEBOUNCE_DELAY, MIN_VISUAL_ROWS } from '../constants.js';

console.log("LayoutService: Module loaded.");

let resizeTimeout;
let gridContainer, canvas, ctx, drumCanvas, drumCtx, playheadCanvas, hoverCanvas, drumHoverCanvas, pitchCanvasWrapper, drumGridWrapper, gridContainerWrapper, rightSideContainer, bottomContentWrapper;
let isInitialLayoutDone = false;

function initDOMElements() {
    console.log("[LayoutService] initDOMElements START");
    gridContainerWrapper = document.getElementById('grid-container-wrapper'); 
    gridContainer = document.getElementById('grid-container');
    pitchCanvasWrapper = document.getElementById('pitch-canvas-wrapper');
    canvas = document.getElementById('notation-grid');
    drumCanvas = document.getElementById('drum-grid');
    playheadCanvas = document.getElementById('playhead-canvas');
    hoverCanvas = document.getElementById('hover-canvas');
    drumHoverCanvas = document.getElementById('drum-hover-canvas');
    bottomContentWrapper = document.getElementById('bottom-content-wrapper');
    drumGridWrapper = document.getElementById('drum-grid-wrapper'); 
    rightSideContainer = document.getElementById('right-side-container'); 
    
    if (!gridContainerWrapper) console.error("FATAL: gridContainerWrapper not found");
    
    ctx = canvas.getContext('2d');
    drumCtx = drumCanvas.getContext('2d');
    console.log("[LayoutService] initDOMElements END");
    return { ctx, drumCtx };
}

function recalcGridColumns() {
    // FIX: Use the new getter `store.placedTonicSigns` instead of the non-existent `store.state.placedTonicSigns`
    const { macrobeatGroupings } = store.state;
    const placedTonicSigns = store.placedTonicSigns; // Use the getter
    
    const newColumnWidths = [3, 3];
    const sortedTonicSigns = [...placedTonicSigns].sort((a, b) => a.preMacrobeatIndex - b.preMacrobeatIndex);
    let tonicSignCursor = 0;
    
    const addTonicSignsForIndex = (mbIndex) => {
        while (sortedTonicSigns[tonicSignCursor] && sortedTonicSigns[tonicSignCursor].preMacrobeatIndex === mbIndex) {
            // A tonic sign occupies one index in the array but has a width of 2 units.
            newColumnWidths.push(2);
            // Assign the correct columnIndex to the entire group
            const uuid = sortedTonicSigns[tonicSignCursor].uuid;
            store.state.tonicSignGroups[uuid].forEach(sign => {
                sign.columnIndex = newColumnWidths.length - 1;
            });
            
            // Advance cursor past all signs with the same UUID
            while(sortedTonicSigns[tonicSignCursor] && sortedTonicSigns[tonicSignCursor].uuid === uuid) {
                tonicSignCursor++;
            }
        }
    };

    addTonicSignsForIndex(-1);
    macrobeatGroupings.forEach((group, mbIndex) => {
        for (let i = 0; i < group; i++) {
            newColumnWidths.push(1);
        }
        addTonicSignsForIndex(mbIndex);
    });
    newColumnWidths.push(3, 3);
    store.state.columnWidths = newColumnWidths;
}

function applyDimensions() {
    if (!isInitialLayoutDone) {
        return;
    }

    const { cellWidth, cellHeight, columnWidths } = store.state;
    const totalWidthUnits = columnWidths.reduce((sum, w) => sum + w, 0);
    const canvasWidth = cellWidth * totalWidthUnits;
    const totalLogicRows = store.state.fullRowData.length;
    const totalVisualRows = totalLogicRows / 2;
    const canvasHeight = cellHeight * totalVisualRows;
    
    [canvas, playheadCanvas, hoverCanvas].forEach(c => { c.width = canvasWidth; c.height = canvasHeight; });
    pitchCanvasWrapper.style.height = `${canvasHeight}px`;
    
    const rightLegendWidth = (columnWidths[columnWidths.length - 1] + columnWidths[columnWidths.length - 2]) * cellWidth;
    rightSideContainer.style.width = `${rightLegendWidth}px`;
    
    const drumCanvasWidth = canvasWidth;
    const pitchRowHeight = 0.5 * cellHeight;
    const drumCanvasHeight = 3 * pitchRowHeight;
    
    [drumCanvas, drumHoverCanvas].forEach(c => { c.width = drumCanvasWidth; c.height = drumCanvasHeight; });
    
    gridContainerWrapper.style.width = `${canvasWidth}px`;
    // NEW: Set CSS variable for dynamic positioning of accidental buttons
    gridContainerWrapper.style.setProperty('--cell-width-val', `${cellWidth}`);

    bottomContentWrapper.style.width = `${canvasWidth}px`;
    
    store.emit('layoutConfigChanged');
}

function calculateAndApplyLayout() {
    const container = document.getElementById('grid-container-wrapper');
    if (!container) {
        console.error("FATAL: grid-container-wrapper not found.");
        return false;
    }
    const containerHeight = container.offsetHeight;
    if (containerHeight < 50) {
        return false;
    }
    
    const cellHeight = containerHeight / store.state.visualRows;
    const cellWidth = cellHeight / 2;
    
    store.state.cellWidth = cellWidth;
    store.state.cellHeight = cellHeight;

    if (!isInitialLayoutDone) {
        isInitialLayoutDone = true;
    }
    
    applyDimensions();
    return true;
}

function resizeCanvas() {
    if (!isInitialLayoutDone) return;
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(calculateAndApplyLayout, RESIZE_DEBOUNCE_DELAY);
}

const LayoutService = {
    init() {
        const contexts = initDOMElements();
        recalcGridColumns();

        const observer = new ResizeObserver(entries => {
            if (!gridContainerWrapper) return;
            const entry = entries[0];
            if (entry.contentRect.height > 50 && !isInitialLayoutDone) {
                if (calculateAndApplyLayout()) {
                    observer.disconnect();
                }
            }
        });

        if (gridContainerWrapper) {
            observer.observe(gridContainerWrapper);
        }

        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('orientationchange', resizeCanvas);

        store.on('rhythmStructureChanged', () => {
            recalcGridColumns();
            applyDimensions(); 
        });
        
        console.log("LayoutService: Initialized.");
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
        if (!isInitialLayoutDone) return;
        if (store.state.visualRows > MIN_VISUAL_ROWS) {
            store.state.visualRows--;
            store.state.logicRows = store.state.visualRows * 2;
            calculateAndApplyLayout();
        }
    },

    zoomOut() {
        if (!isInitialLayoutDone) return;
        const maxVisualRows = Math.floor(store.state.fullRowData.length / 2);
        if (store.state.visualRows < maxVisualRows) {
            store.state.visualRows++;
            store.state.logicRows = store.state.visualRows * 2;
            calculateAndApplyLayout();
        }
    }
};

export default LayoutService;