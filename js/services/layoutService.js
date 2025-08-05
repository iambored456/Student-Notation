// js/services/layoutService.js
import store from '../state/index.js';
import {
    DEFAULT_ZOOM_LEVEL, DEFAULT_SCROLL_POSITION, GRID_HEIGHT_MULTIPLIER, GRID_WIDTH_RATIO,
    SIDE_COLUMN_WIDTH, TONIC_COLUMN_WIDTH, BEAT_COLUMN_WIDTH, BASE_DRUM_ROW_HEIGHT,
    DRUM_HEIGHT_SCALE_FACTOR, DRUM_ROW_COUNT, BASE_HARMONY_HEIGHT, MAX_ZOOM_LEVEL,
    MIN_ZOOM_LEVEL, ZOOM_IN_FACTOR, ZOOM_OUT_FACTOR
} from '../constants.js';
import { getPlacedTonicSigns } from '../state/selectors.js';
import { RESIZE_DEBOUNCE_DELAY } from '../constants.js';
import { Note } from 'tonal';


const DEFAULT_VISIBLE_SEMITONES = 24;

let currentZoomLevel = DEFAULT_ZOOM_LEVEL;
let currentScrollPosition = DEFAULT_SCROLL_POSITION;
let viewportHeight = 0;

let gridContainer, pitchGridWrapper, canvas, ctx, drumGridWrapper, drumCanvas, drumCtx, playheadCanvas, hoverCanvas, harmonyContainer, harmonyCanvas, drumHoverCanvas;
let resizeTimeout;

// DEBUG: Function to trace container width propagation
function logContainerWidths() {
    const containers = [
        { name: 'toolbar', el: document.getElementById('toolbar') },
        { name: 'app-container', el: document.getElementById('app-container') },
        { name: 'grid-container', el: document.getElementById('grid-container') },
        { name: 'pitch-grid-container', el: document.getElementById('pitch-grid-container') },
        { name: 'pitch-grid-wrapper', el: document.getElementById('pitch-grid-wrapper') },
        { name: 'canvas-content', el: document.getElementById('canvas-content') },
        { name: 'canvas-container', el: document.getElementById('canvas-container') },
        { name: 'harmonyAnalysisGrid', el: document.getElementById('harmonyAnalysisGrid') },
        { name: 'drum-grid-wrapper', el: document.getElementById('drum-grid-wrapper') }
    ];
    
    console.log('📐 Container Width Pipeline:');
    containers.forEach(({ name, el }) => {
        if (el) {
            const computedStyle = window.getComputedStyle(el);
            console.log(`  ${name}:`, {
                setWidth: el.style.width || 'auto',
                computedWidth: computedStyle.width,
                clientWidth: el.clientWidth + 'px',
                scrollWidth: el.scrollWidth + 'px'
            });
        } else {
            console.log(`  ${name}: NOT FOUND`);
        }
    });
}

function initDOMElements() {
    gridContainer = document.getElementById('grid-container');
    pitchGridWrapper = document.getElementById('pitch-grid-wrapper'); 
    canvas = document.getElementById('notation-grid');
    drumGridWrapper = document.getElementById('drum-grid-wrapper');
    drumCanvas = document.getElementById('drum-grid');
    playheadCanvas = document.getElementById('playhead-canvas');
    hoverCanvas = document.getElementById('hover-canvas');
    drumHoverCanvas = document.getElementById('drum-hover-canvas');
    harmonyContainer = document.getElementById('harmonyAnalysisGrid');
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

    viewportHeight = pitchGridWrapper.clientHeight;
    const viewportWidth = pitchGridWrapper.clientWidth;

    // FIXED: Maintain proper aspect ratio by scaling both dimensions independently
    const baseHeight = (viewportHeight / DEFAULT_VISIBLE_SEMITONES) * GRID_HEIGHT_MULTIPLIER;
    const baseWidth = baseHeight * GRID_WIDTH_RATIO;
    store.state.cellHeight = baseHeight * currentZoomLevel;
    store.state.cellWidth = baseWidth * currentZoomLevel;


    const { macrobeatGroupings } = store.state;
    const placedTonicSigns = getPlacedTonicSigns(store.state);
    const newColumnWidths = [SIDE_COLUMN_WIDTH, SIDE_COLUMN_WIDTH];
    const sortedTonicSigns = [...placedTonicSigns].sort((a, b) => a.preMacrobeatIndex - b.preMacrobeatIndex);
    let tonicSignCursor = 0;
    
    const addTonicSignsForIndex = (mbIndex) => {
        let uuid = sortedTonicSigns[tonicSignCursor]?.uuid;
        while (sortedTonicSigns[tonicSignCursor] && sortedTonicSigns[tonicSignCursor].preMacrobeatIndex === mbIndex) {
            newColumnWidths.push(TONIC_COLUMN_WIDTH);
            while(sortedTonicSigns[tonicSignCursor] && sortedTonicSigns[tonicSignCursor].uuid === uuid) {
                tonicSignCursor++;
            }
            uuid = sortedTonicSigns[tonicSignCursor]?.uuid;
        }
    };

    addTonicSignsForIndex(-1);
    macrobeatGroupings.forEach((group, mbIndex) => {
        for (let i = 0; i < group; i++) newColumnWidths.push(BEAT_COLUMN_WIDTH);
        addTonicSignsForIndex(mbIndex);
    });
    newColumnWidths.push(SIDE_COLUMN_WIDTH, SIDE_COLUMN_WIDTH);
    store.state.columnWidths = newColumnWidths;

    const totalWidthUnits = newColumnWidths.reduce((sum, w) => sum + w, 0);
    const totalCanvasWidth = totalWidthUnits * store.state.cellWidth;

    // Only update dimensions if they actually changed to prevent resize loops
    const totalCanvasWidthPx = Math.round(totalCanvasWidth);
    
    // DEBUG: Log container width calculations
    const currentWidth = parseFloat(gridContainer?.style.width) || 0;
    const willUpdate = gridContainer && Math.abs(currentWidth - totalCanvasWidthPx) > 1;
    
    console.log('🔍 LayoutService Width Debug:', {
        zoomLevel: currentZoomLevel,
        cellWidth: store.state.cellWidth,
        totalWidthUnits,
        calculatedWidth: totalCanvasWidthPx,
        currentGridWidth: gridContainer?.style.width || 'empty',
        currentWidthParsed: currentWidth,
        willUpdate
    });
    
    if (willUpdate) {
        console.log('📏 Setting grid-container width to:', totalCanvasWidthPx + 'px');
        gridContainer.style.width = `${totalCanvasWidthPx}px`;
        
        // DEBUG: Log container expansion pipeline after width change
        setTimeout(() => {
            logContainerWidths();
        }, 0);
    } else {
        console.log('⏭️ Skipping width update - no significant change needed');
    }
    
    [canvas, playheadCanvas, hoverCanvas, drumCanvas, drumHoverCanvas, harmonyCanvas].forEach(c => { 
        if(c && Math.abs(c.width - totalCanvasWidthPx) > 1) { 
            c.width = totalCanvasWidthPx; 
        }
    });
    
    // Drum grid height scales with zoom but has minimum size
    const drumRowHeight = Math.max(BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR * store.state.cellHeight);
    const drumCanvasHeight = DRUM_ROW_COUNT * drumRowHeight;
    const drumHeightPx = `${drumCanvasHeight}px`;
    
    // DEBUG: Log drum grid height calculations
    const currentDrumHeight = parseFloat(drumGridWrapper?.style.height) || 0;
    const willUpdateDrumWrapper = drumGridWrapper && Math.abs(currentDrumHeight - drumCanvasHeight) > 1;
    
    console.log('🥁 Drum Grid Height Debug:', {
        drumRowHeight,
        drumCanvasHeight,
        drumHeightPx,
        currentWrapperHeight: drumGridWrapper?.style.height || 'empty',
        currentHeightParsed: currentDrumHeight,
        willUpdateWrapper: willUpdateDrumWrapper
    });
    
    if (willUpdateDrumWrapper) {
        console.log('📏 Setting drum-grid-wrapper height to:', drumHeightPx);
        drumGridWrapper.style.height = drumHeightPx;
    } else {
        console.log('⏭️ Skipping drum height update - no significant change needed');
    }
    if (drumCanvas && Math.abs(drumCanvas.height - drumCanvasHeight) > 1) {
        drumCanvas.height = drumCanvasHeight;
    }
    if (drumHoverCanvas && Math.abs(drumHoverCanvas.height - drumCanvasHeight) > 1) {
        drumHoverCanvas.height = drumCanvasHeight;
    }

    [canvas, playheadCanvas, hoverCanvas].forEach(c => { 
        if(c && Math.abs(c.height - viewportHeight) > 1) { 
            c.height = viewportHeight; 
        } 
    });

    // Harmony grid height scales with zoom but has minimum size
    const harmonyHeight = Math.max(BASE_HARMONY_HEIGHT, drumRowHeight);
    if (harmonyContainer && Math.abs(parseFloat(harmonyContainer.style.height) - harmonyHeight) > 1) {
        harmonyContainer.style.height = `${harmonyHeight}px`;
    }
    if (harmonyCanvas && Math.abs(harmonyCanvas.height - harmonyHeight) > 1) {
        harmonyCanvas.height = harmonyHeight;
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
        const oldZoom = currentZoomLevel;
        currentZoomLevel = Math.min(MAX_ZOOM_LEVEL, currentZoomLevel * ZOOM_IN_FACTOR);
        console.log('🔍 ZOOM IN:', { from: oldZoom, to: currentZoomLevel });
        recalcAndApplyLayout();
    },

    zoomOut() {
        const oldZoom = currentZoomLevel;
        currentZoomLevel = Math.max(MIN_ZOOM_LEVEL, currentZoomLevel * ZOOM_OUT_FACTOR);
        console.log('🔍 ZOOM OUT:', { from: oldZoom, to: currentZoomLevel });
        recalcAndApplyLayout();
    },
    
    resetZoom() {
        currentZoomLevel = 1.0;
        recalcAndApplyLayout();
    },
    
    scroll(deltaY) {
        const scrollAmount = (deltaY / viewportHeight);
        currentScrollPosition = Math.max(0, Math.min(1, currentScrollPosition + scrollAmount));
        store.emit('layoutConfigChanged');
    },
    
    getViewportInfo() {
        const totalRows = store.state.fullRowData.length;
        // Use base row height without zoom scaling to avoid double-scaling
        const baseRowHeight = (viewportHeight / DEFAULT_VISIBLE_SEMITONES);
        const rowHeight = baseRowHeight * currentZoomLevel;
        const fullVirtualHeight = totalRows * rowHeight;
        
        // Add padding to ensure first and last rows are fully visible
        // Use half-row padding on each end to center rows properly
        const paddedVirtualHeight = fullVirtualHeight + rowHeight;
        const scrollableDist = Math.max(0, paddedVirtualHeight - viewportHeight);
        const scrollOffset = (scrollableDist * currentScrollPosition) - (rowHeight / 2);

        const startRow = Math.max(0, Math.floor(scrollOffset / rowHeight) - 2);
        const visibleRowCount = viewportHeight / rowHeight;
        const endRow = Math.min(totalRows - 1, Math.ceil(startRow + visibleRowCount + 2));

        const info = {
            zoomLevel: currentZoomLevel,
            viewportHeight: viewportHeight,
            rowHeight: rowHeight,
            startRow: startRow,
            endRow: endRow,
            scrollOffset: scrollOffset
        };
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

// DEBUG: Expose debugging function globally for manual testing
window.debugContainerWidths = logContainerWidths;

export default LayoutService;