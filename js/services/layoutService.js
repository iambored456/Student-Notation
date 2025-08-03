// js/services/layoutService.js
import store from '../state/index.js';
import { getPlacedTonicSigns } from '../state/selectors.js';
import { RESIZE_DEBOUNCE_DELAY } from '../constants.js';
import { Note } from 'tonal';

console.log("LayoutService: Module loaded for viewport virtualization.");

const DEFAULT_VISIBLE_SEMITONES = 24;

let currentZoomLevel = 1.0;
let currentScrollPosition = 0.4;
let viewportHeight = 0;

let gridContainer, pitchGridWrapper, canvas, ctx, drumGridWrapper, drumCanvas, drumCtx, playheadCanvas, hoverCanvas, harmonyContainer, harmonyCanvas, drumHoverCanvas;
let resizeTimeout;

function initDOMElements() {
    gridContainer = document.getElementById('grid-container');
    pitchGridWrapper = document.getElementById('pitch-grid-wrapper'); 
    canvas = document.getElementById('notation-grid');
    drumGridWrapper = document.getElementById('drum-grid-wrapper');
    drumCanvas = document.getElementById('drum-grid');
    playheadCanvas = document.getElementById('playhead-canvas');
    hoverCanvas = document.getElementById('hover-canvas');
    drumHoverCanvas = document.getElementById('drum-hover-canvas');
    harmonyContainer = document.getElementById('harmony-container');
    harmonyCanvas = document.getElementById('harmony-analysis-canvas');
    
    if (!pitchGridWrapper || !canvas) {
        console.error("LayoutService FATAL: Could not find essential canvas elements.");
        return {};
    }
    
    ctx = canvas.getContext('2d');
    drumCtx = drumCanvas.getContext('2d');
    return { ctx, drumCtx };
}

function recalcAndApplyLayout() {
    if (!pitchGridWrapper || pitchGridWrapper.clientHeight === 0) {
        requestAnimationFrame(recalcAndApplyLayout);
        return;
    }

    // --- ADD LOGS HERE ---
    console.log(`[LayoutService] recalcAndApplyLayout triggered. pitchGridWrapper.clientHeight: ${pitchGridWrapper.clientHeight}`);

    viewportHeight = pitchGridWrapper.clientHeight;
    const viewportWidth = pitchGridWrapper.clientWidth;

    store.state.cellHeight = (viewportHeight / DEFAULT_VISIBLE_SEMITONES) * 2;
    store.state.cellWidth = store.state.cellHeight * 0.5;

    // --- AND HERE ---
    console.log(`[LayoutService] Calculated Dimensions -> viewportHeight: ${viewportHeight}, cellHeight: ${store.state.cellHeight}, cellWidth: ${store.state.cellWidth}`);


    const { macrobeatGroupings } = store.state;
    const placedTonicSigns = getPlacedTonicSigns(store.state);
    const newColumnWidths = [3, 3];
    const sortedTonicSigns = [...placedTonicSigns].sort((a, b) => a.preMacrobeatIndex - b.preMacrobeatIndex);
    let tonicSignCursor = 0;
    
    const addTonicSignsForIndex = (mbIndex) => {
        let uuid = sortedTonicSigns[tonicSignCursor]?.uuid;
        while (sortedTonicSigns[tonicSignCursor] && sortedTonicSigns[tonicSignCursor].preMacrobeatIndex === mbIndex) {
            newColumnWidths.push(2);
            while(sortedTonicSigns[tonicSignCursor] && sortedTonicSigns[tonicSignCursor].uuid === uuid) {
                tonicSignCursor++;
            }
            uuid = sortedTonicSigns[tonicSignCursor]?.uuid;
        }
    };

    addTonicSignsForIndex(-1);
    macrobeatGroupings.forEach((group, mbIndex) => {
        for (let i = 0; i < group; i++) newColumnWidths.push(1);
        addTonicSignsForIndex(mbIndex);
    });
    newColumnWidths.push(3, 3);
    store.state.columnWidths = newColumnWidths;

    const totalWidthUnits = newColumnWidths.reduce((sum, w) => sum + w, 0);
    const totalCanvasWidth = totalWidthUnits * store.state.cellWidth;

    if (gridContainer) gridContainer.style.width = `${totalCanvasWidth}px`;
    
    [canvas, playheadCanvas, hoverCanvas, drumCanvas, drumHoverCanvas, harmonyCanvas].forEach(c => { 
        if(c) { c.width = totalCanvasWidth; }
    });
    
    const drumRowHeight = 0.5 * store.state.cellHeight;
    const drumCanvasHeight = 3 * drumRowHeight;
    if (drumGridWrapper) drumGridWrapper.style.height = `${drumCanvasHeight}px`;
    if (drumCanvas) drumCanvas.height = drumCanvasHeight;
    if (drumHoverCanvas) drumHoverCanvas.height = drumCanvasHeight;

    [canvas, playheadCanvas, hoverCanvas].forEach(c => { 
        if(c) { c.height = viewportHeight; } 
    });

    if (harmonyContainer) {
        harmonyContainer.style.height = `${drumRowHeight}px`;
        if(harmonyCanvas) harmonyCanvas.height = drumRowHeight;
    }

    store.emit('layoutConfigChanged');
}

const LayoutService = {
    init() {
        const contexts = initDOMElements();
        requestAnimationFrame(recalcAndApplyLayout);
       
        const observer = new ResizeObserver(() => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(recalcAndApplyLayout, RESIZE_DEBOUNCE_DELAY);
        });
        
        if (pitchGridWrapper) {
            observer.observe(pitchGridWrapper);
        }
        return contexts;
    },
    
    zoomIn() {
        currentZoomLevel = Math.min(8.0, currentZoomLevel * 1.25);
        recalcAndApplyLayout();
    },

    zoomOut() {
        currentZoomLevel = Math.max(0.25, currentZoomLevel * 0.8);
        recalcAndApplyLayout();
    },
    
    scroll(deltaY) {
        const scrollAmount = (deltaY / viewportHeight);
        currentScrollPosition = Math.max(0, Math.min(1, currentScrollPosition + scrollAmount));
        store.emit('layoutConfigChanged');
    },
    
    getViewportInfo() {
        const totalRows = store.state.fullRowData.length;
        const rowHeight = store.state.cellHeight * 0.5;
        const fullVirtualHeight = totalRows * rowHeight;
        
        const scrollableDist = Math.max(0, fullVirtualHeight - (viewportHeight / currentZoomLevel));
        const scrollOffset = scrollableDist * currentScrollPosition;

        const startRow = Math.max(0, Math.floor(scrollOffset / rowHeight) - 5);
        const visibleRowCount = (viewportHeight / currentZoomLevel) / rowHeight;
        const endRow = Math.min(totalRows - 1, Math.ceil(startRow + visibleRowCount + 10));

        const info = {
            zoomLevel: currentZoomLevel,
            viewportHeight: viewportHeight,
            rowHeight: rowHeight,
            startRow: startRow,
            endRow: endRow,
            scrollOffset: scrollOffset // THE FIX: Use this precise value
        };

        // --- ADD LOG HERE ---
        console.log('[LayoutService] getViewportInfo returning:', info);

        return info;
    },
    
    getMacrobeatWidthPx(state, grouping) {
        return grouping * state.cellWidth;
    },

    getColumnX(index) {
        let x = 0;
        for (let i = 0; i < index; i++) {
            x += (store.state.columnWidths[i] || 0) * store.state.cellWidth;
        }
        return x;
    },

    getCanvasWidth() {
        return (store.state.columnWidths.reduce((sum, w) => sum + w, 0)) * store.state.cellWidth;
    }
};

export default LayoutService;