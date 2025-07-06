// js/services/layoutService.js
import store from '../state/index.js';
import { getPlacedTonicSigns } from '../state/selectors.js';
import { RESIZE_DEBOUNCE_DELAY, MIN_VISUAL_ROWS } from '../constants.js';
import GridManager from '../components/Grid/gridManager.js';
import Toolbar from '../components/Toolbar/Toolbar.js';

console.log("LayoutService: Module loaded.");

// --- UPDATED: New initial view range from C5 down to G3 ---
const INITIAL_TOP_NOTE = 'C5';
const INITIAL_BOTTOM_NOTE = 'G3';

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
    const { macrobeatGroupings } = store.state;
    const placedTonicSigns = getPlacedTonicSigns(store.state);
    
    const newColumnWidths = [3, 3];
    const sortedTonicSigns = [...placedTonicSigns].sort((a, b) => a.preMacrobeatIndex - b.preMacrobeatIndex);
    let tonicSignCursor = 0;
    
    const addTonicSignsForIndex = (mbIndex) => {
        while (sortedTonicSigns[tonicSignCursor] && sortedTonicSigns[tonicSignCursor].preMacrobeatIndex === mbIndex) {
            newColumnWidths.push(2);
            const uuid = sortedTonicSigns[tonicSignCursor].uuid;
            store.state.tonicSignGroups[uuid].forEach(sign => {
                sign.columnIndex = newColumnWidths.length - 1;
            });
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
    if (!isInitialLayoutDone) return;

    const { cellWidth, cellHeight, columnWidths } = store.state;
    const totalWidthUnits = columnWidths.reduce((sum, w) => sum + w, 0);
    const canvasWidth = cellWidth * totalWidthUnits;
    const totalLogicRows = store.state.fullRowData.length;
    const canvasHeight = (totalLogicRows / 2) * cellHeight;
    
    [canvas, playheadCanvas, hoverCanvas].forEach(c => { c.width = canvasWidth; c.height = canvasHeight; });
    pitchCanvasWrapper.style.height = `${canvasHeight}px`;
    
    const rightLegendWidth = (columnWidths[columnWidths.length - 1] + columnWidths[columnWidths.length - 2]) * cellWidth;
    rightSideContainer.style.width = `${rightLegendWidth}px`;
    
    const drumCanvasWidth = canvasWidth;
    const pitchRowHeight = 0.5 * cellHeight;
    const drumCanvasHeight = 3 * pitchRowHeight;
    
    [drumCanvas, drumHoverCanvas].forEach(c => { c.width = drumCanvasWidth; c.height = drumCanvasHeight; });
    
    gridContainerWrapper.style.width = `${canvasWidth}px`;
    gridContainerWrapper.style.setProperty('--cell-width-val', `${cellWidth}`);
    bottomContentWrapper.style.width = `${canvasWidth}px`;
    
    store.emit('layoutConfigChanged');
}

function calculateAndApplyLayout() {
    console.log("[LayoutService] calculateAndApplyLayout called.");
    const container = document.getElementById('grid-container-wrapper');
    if (!container) return false;
    
    const containerHeight = container.offsetHeight;
    if (containerHeight < 50) return false;
    
    let needsInitialRender = false;

    if (!isInitialLayoutDone) {
        console.log("[LayoutService] Performing INITIAL layout calculation.");
        const topNoteIndex = store.state.fullRowData.findIndex(row => row.toneNote === INITIAL_TOP_NOTE);
        const bottomNoteIndex = store.state.fullRowData.findIndex(row => row.toneNote === INITIAL_BOTTOM_NOTE);
        
        if (topNoteIndex !== -1 && bottomNoteIndex !== -1) {
            const rowsInRange = Math.abs(bottomNoteIndex - topNoteIndex) + 1;
            const visualRows = Math.ceil(rowsInRange / 2);
            
            store.state.visualRows = visualRows;
            store.state.logicRows = visualRows * 2;
            store.state.gridPosition = topNoteIndex;

            console.log(`[LayoutService] Initial view calculated. visualRows: ${visualRows}, gridPosition: ${topNoteIndex}`);
        } else {
            console.error("[LayoutService] Could not find initial notes for layout!");
            store.state.visualRows = 10;
            store.state.logicRows = 20;
            store.state.gridPosition = store.state.fullRowData.findIndex(r => r.toneNote === 'C4');
        }
        
        isInitialLayoutDone = true;
        needsInitialRender = true;
    }
    
    const cellHeight = containerHeight / store.state.visualRows;
    store.state.cellWidth = cellHeight / 2;
    store.state.cellHeight = cellHeight;
    console.log(`[LayoutService] Cell dimensions calculated. cellHeight: ${cellHeight}`);
    
    applyDimensions();

    if (needsInitialRender) {
        // Trigger the very first render now that dimensions are known.
        console.log("[LayoutService] Triggering initial full render.");
        Toolbar.renderRhythmUI();
        GridManager.renderPitchGrid();
        GridManager.renderDrumGrid();
    }
    
    return true;
}

function resizeCanvas() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const container = document.getElementById('grid-container-wrapper');
        if (!container) return;
        const containerHeight = container.offsetHeight;
        const cellHeight = containerHeight / store.state.visualRows;
        store.state.cellWidth = cellHeight / 2;
        store.state.cellHeight = cellHeight;
        applyDimensions();
    }, RESIZE_DEBOUNCE_DELAY);
}

const LayoutService = {
    init() {
        const contexts = initDOMElements();
        recalcGridColumns();

        const observer = new ResizeObserver(entries => {
            console.log("[LayoutService] ResizeObserver fired.");
            if (!gridContainerWrapper) return;
            const entry = entries[0];
            if (entry.contentRect.height > 50 && !isInitialLayoutDone) {
                if (calculateAndApplyLayout()) {
                    console.log("[LayoutService] Initial layout complete, disconnecting observer.");
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
            resizeCanvas();
        }
    },

    zoomOut() {
        if (!isInitialLayoutDone) return;
        const maxVisualRows = Math.floor(store.state.fullRowData.length / 2);
        if (store.state.visualRows < maxVisualRows) {
            store.state.visualRows++;
            store.state.logicRows = store.state.visualRows * 2;
            resizeCanvas();
        }
    }
};

export default LayoutService;