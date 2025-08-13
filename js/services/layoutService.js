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
import logger from '../utils/logger.js';


const DEFAULT_VISIBLE_SEMITONES = 24;

let currentZoomLevel = DEFAULT_ZOOM_LEVEL;
let currentScrollPosition = DEFAULT_SCROLL_POSITION;
let viewportHeight = 0;

let gridContainer, pitchGridWrapper, canvas, ctx, drumGridWrapper, drumCanvas, drumCtx, playheadCanvas, hoverCanvas, harmonyContainer, harmonyCanvas, drumHoverCanvas;
let resizeTimeout;
let isRecalculating = false;
let lastCalculatedWidth = 0;
let lastCalculatedDrumHeight = 0;

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
    
    logger.debug('Layout Service', 'Container Width Pipeline', null, 'layout');
    containers.forEach(({ name, el }) => {
        if (el) {
            const computedStyle = window.getComputedStyle(el);
            logger.debug('Layout Service', `${name} container info`, {
                setWidth: el.style.width || 'auto',
                computedWidth: computedStyle.width,
                clientWidth: el.clientWidth + 'px',
                scrollWidth: el.scrollWidth + 'px'
            }, 'layout');
        } else {
            logger.warn('Layout Service', `${name}: NOT FOUND`, null, 'layout');
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
    
    // pitchGrid Assembly - contains time signature + tools + viewport
    const canvasContainer = document.getElementById('canvas-container');
    
    if (!pitchGridWrapper || !canvas || !canvasContainer) {
        logger.error('Layout Service', 'FATAL: Could not find essential canvas elements', null, 'initialization');
        return {};
    }
    
    ctx = canvas.getContext('2d');
    drumCtx = drumCanvas.getContext('2d');
    return { ctx, drumCtx, canvasContainer };
}

function recalcAndApplyLayout() {
    logger.debug('Layout Service', 'recalcAndApplyLayout() called', null, 'layout');
    if (!pitchGridWrapper || pitchGridWrapper.clientHeight === 0) {
        logger.debug('Layout Service', 'Deferring layout - pitchGridWrapper not ready', null, 'layout');
        requestAnimationFrame(recalcAndApplyLayout);
        return;
    }

    // Prevent recursive calls during recalculation
    if (isRecalculating) {
        logger.warn('Layout Service', 'Skipping recalculation - already in progress', null, 'layout');
        return;
    }
    
    logger.debug('Layout Service', 'Beginning layout recalculation', null, 'layout');
    isRecalculating = true;

    const pitchGridContainer = document.getElementById('pitch-grid-container');
    const newViewportHeight = pitchGridContainer.clientHeight;
    const newViewportWidth = pitchGridWrapper.clientWidth;
    
    // Log viewport changes
    const heightDiff = Math.abs(newViewportHeight - viewportHeight);
    const widthDiff = Math.abs(newViewportWidth - (pitchGridWrapper._lastViewportWidth || 0));
    
    if (heightDiff > 0 || widthDiff > 0) {
        logger.debug('Layout Service', 'Viewport changed', `${newViewportWidth}×${newViewportHeight}`, 'layout');
        
        // Only update viewport dimensions for significant changes
        // This helps prevent micro-adjustments from causing layout instability
        if (heightDiff > 3 || viewportHeight === 0) {
            viewportHeight = newViewportHeight;
        }
        if (widthDiff > 3 || !pitchGridWrapper._lastViewportWidth) {
            pitchGridWrapper._lastViewportWidth = newViewportWidth;
        }
    }
    
    // Always use the current values for calculations
    const viewportWidth = newViewportWidth;

    // FIXED: Maintain proper aspect ratio by scaling both dimensions independently
    const baseHeight = (viewportHeight / DEFAULT_VISIBLE_SEMITONES) * GRID_HEIGHT_MULTIPLIER;
    const baseWidth = baseHeight * GRID_WIDTH_RATIO;
    const newCellHeight = baseHeight * currentZoomLevel;
    const newCellWidth = baseWidth * currentZoomLevel;
    
    // Log cell size changes
    if (store.state.cellWidth !== newCellWidth || store.state.cellHeight !== newCellHeight) {
        logger.debug('Layout Service', 'Cell size changed', `${newCellWidth.toFixed(1)}×${newCellHeight.toFixed(1)}`, 'layout');
    }
    
    store.state.cellHeight = newCellHeight;
    store.state.cellWidth = newCellWidth;


    const { macrobeatGroupings } = store.state;
    const placedTonicSigns = getPlacedTonicSigns(store.state);
    const oldColumnWidths = [...(store.state.columnWidths || [])];
    const newColumnWidths = [SIDE_COLUMN_WIDTH, SIDE_COLUMN_WIDTH];
    
    logger.debug('Layout Service', 'Starting layout recalculation', null, 'layout');
    logger.debug('Layout Service', 'Placed tonic signs', placedTonicSigns.map(ts => `col:${ts.columnIndex},mb:${ts.preMacrobeatIndex}`), 'layout');
    logger.debug('Layout Service', 'Old columnWidths', oldColumnWidths, 'layout');
    logger.debug('Layout Service', 'Macrobeat groupings', macrobeatGroupings, 'layout');
    const sortedTonicSigns = [...placedTonicSigns].sort((a, b) => a.preMacrobeatIndex - b.preMacrobeatIndex);
    let tonicSignCursor = 0;
    
    const addTonicSignsForIndex = (mbIndex) => {
        let uuid = sortedTonicSigns[tonicSignCursor]?.uuid;
        while (sortedTonicSigns[tonicSignCursor] && sortedTonicSigns[tonicSignCursor].preMacrobeatIndex === mbIndex) {
            logger.debug('Layout Service', `Adding tonic columns for mbIndex ${mbIndex}, tonic at column ${sortedTonicSigns[tonicSignCursor].columnIndex}`, null, 'layout');
            // Add 2 columns of width=1 for each tonic (for grid consistency)
            const columnCountBefore = newColumnWidths.length;
            newColumnWidths.push(BEAT_COLUMN_WIDTH);
            newColumnWidths.push(BEAT_COLUMN_WIDTH);
            logger.debug('Layout Service', `Added 2 columns (width=${BEAT_COLUMN_WIDTH} each), total columns: ${columnCountBefore} -> ${newColumnWidths.length}`, null, 'layout');
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
    
    logger.debug('Layout Service', 'Final newColumnWidths', newColumnWidths, 'layout');
    logger.debug('Layout Service', 'Width change', `${oldColumnWidths.length} -> ${newColumnWidths.length} columns`, 'layout');
    logger.debug('Layout Service', 'Old total width units', oldColumnWidths.reduce((sum, w) => sum + w, 0), 'layout');
    logger.debug('Layout Service', 'New total width units', newColumnWidths.reduce((sum, w) => sum + w, 0), 'layout');
    
    store.state.columnWidths = newColumnWidths;

    const totalWidthUnits = newColumnWidths.reduce((sum, w) => sum + w, 0);
    const totalCanvasWidth = totalWidthUnits * store.state.cellWidth;

    // Only update dimensions if they actually changed to prevent resize loops
    const totalCanvasWidthPx = Math.round(totalCanvasWidth);
    
    // EXPERIMENT: Remove width setting entirely - let CSS handle layout
    // Simplified width debug
    logger.debug('Layout Service', 'Grid width calculated', `${totalCanvasWidthPx}px (${totalWidthUnits} units)`, 'layout');
    
    // SET CONTAINER WIDTHS: Synchronize container widths with canvas updates to prevent scrollbar flash
    const drumGridWrapper = document.getElementById('drum-grid-wrapper');
    const harmonyAnalysisGrid = document.getElementById('harmonyAnalysisGrid');
    
    // Set all containers to exactly match canvas width BEFORE resizing canvases
    const targetWidth = totalCanvasWidthPx + 'px';
    
    if (pitchGridContainer) {
        pitchGridContainer.style.width = targetWidth;
    }
    if (drumGridWrapper) {
        drumGridWrapper.style.width = targetWidth;
    }
    if (harmonyAnalysisGrid) {
        harmonyAnalysisGrid.style.width = targetWidth;
    }
    
    logger.debug('Layout Service', 'Container Width Sync', {
        pitchGridContainer: pitchGridContainer?.clientWidth + 'px',
        drumGridWrapper: drumGridWrapper?.clientWidth + 'px',
        harmonyAnalysisGrid: harmonyAnalysisGrid?.clientWidth + 'px',
        setTo: targetWidth,
        allMatch: 'Containers synchronized with canvas widths'
    }, 'layout');
    
    // Don't set grid-container width - let CSS and natural layout handle it
    // Let CSS handle grid-container width naturally
    
    [canvas, playheadCanvas, hoverCanvas, drumCanvas, drumHoverCanvas, harmonyCanvas].forEach(c => { 
        if(c && Math.abs(c.width - totalCanvasWidthPx) > 1) { 
            c.width = totalCanvasWidthPx; 
        }
    });
    
    // Drum grid height scales with zoom but has minimum size
    const drumRowHeight = Math.max(BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR * store.state.cellHeight);
    const drumCanvasHeight = DRUM_ROW_COUNT * drumRowHeight;
    const drumHeightPx = `${drumCanvasHeight}px`;
    
    // DEFERRED: Set drum height after layout stabilizes to avoid ResizeObserver cascade
    const drumHeightChanged = Math.abs(lastCalculatedDrumHeight - drumCanvasHeight) > 5;
    const shouldUpdateDrumHeight = drumGridWrapper && (drumHeightChanged || lastCalculatedDrumHeight === 0);
    
    logger.debug('Layout Service', 'Drum Grid Height Debug (DEFERRED)', {
        drumRowHeight,
        drumCanvasHeight,
        lastCalculatedDrumHeight,
        drumHeightChanged,
        willUpdateDeferred: shouldUpdateDrumHeight
    }, 'layout');
    
    if (shouldUpdateDrumHeight) {
        logger.debug('Layout Service', 'Setting drum-grid-wrapper height to', drumHeightPx, 'layout');
        drumGridWrapper.style.height = drumHeightPx;
        lastCalculatedDrumHeight = drumCanvasHeight;
    }
    if (drumCanvas && Math.abs(drumCanvas.height - drumCanvasHeight) > 1) {
        drumCanvas.height = drumCanvasHeight;
    }
    if (drumHoverCanvas && Math.abs(drumHoverCanvas.height - drumCanvasHeight) > 1) {
        drumHoverCanvas.height = drumCanvasHeight;
    }

    // DEFER canvas height setting until containers stabilize
    setTimeout(() => {
        const finalPitchGridContainer = document.getElementById('pitch-grid-container');
        const finalViewportHeight = finalPitchGridContainer.clientHeight;
        
        logger.debug('Layout Service', 'Canvas Heights (DEFERRED)', {
            oldViewportHeight: viewportHeight,
            finalViewportHeight,
            pitchGridContainer: finalPitchGridContainer?.clientHeight,
            pitchGridWrapper: pitchGridWrapper?.clientHeight
        }, 'layout');

        [canvas, playheadCanvas, hoverCanvas].forEach((c, index) => { 
            if(c && Math.abs(c.height - finalViewportHeight) > 1) { 
                const canvasNames = ['notation-grid', 'playhead-canvas', 'hover-canvas'];
                logger.debug('Layout Service', `Setting ${canvasNames[index]} height (DEFERRED): ${c.height} → ${finalViewportHeight}`, null, 'layout');
                c.height = finalViewportHeight; 
            } 
        });
        
        // Trigger grid re-render after deferred canvas resize
        // Use custom event to avoid circular dependencies
        document.dispatchEvent(new CustomEvent('canvasResized', { 
            detail: { source: 'layoutService-deferred' }
        }));
        logger.debug('Layout Service', 'Dispatched canvasResized event after deferred resize', null, 'layout');
    }, 25); // Allow DOM to settle

    // Harmony grid height scales with zoom but has minimum size
    const harmonyHeight = Math.max(BASE_HARMONY_HEIGHT, drumRowHeight);
    if (harmonyContainer && Math.abs(parseFloat(harmonyContainer.style.height) - harmonyHeight) > 1) {
        harmonyContainer.style.height = `${harmonyHeight}px`;
    }
    if (harmonyCanvas && Math.abs(harmonyCanvas.height - harmonyHeight) > 1) {
        harmonyCanvas.height = harmonyHeight;
    }

    store.emit('layoutConfigChanged');
    
    // DEBUG: Final DOM state after layout complete
    setTimeout(() => {
        logger.debug('Layout Service', 'Final Canvas Heights (after layout)', {
            'pitch-grid-container': document.getElementById('pitch-grid-container')?.clientHeight,
            'notation-grid': document.getElementById('notation-grid')?.height,
            'pitch-paint-canvas': document.getElementById('pitch-paint-canvas')?.height,
            'playhead-canvas': document.getElementById('playhead-canvas')?.height,
            'hover-canvas': document.getElementById('hover-canvas')?.height,
            'pitch-canvas-wrapper': document.getElementById('pitch-canvas-wrapper')?.clientHeight
        }, 'layout');
    }, 50); // Small delay to ensure DOM updates are complete
    
    // Reset the recalculation flag
    isRecalculating = false;
}

const LayoutService = {
    init() {
        const { ctx, drumCtx, canvasContainer } = initDOMElements();
        requestAnimationFrame(recalcAndApplyLayout);
       
       
        // EXPERIMENTAL: Use window resize instead of ResizeObserver to avoid cascade
        const handleWindowResize = () => {
            // Only process if we're not already recalculating
            if (isRecalculating) {
                logger.warn('Layout Service', 'Window resize: Skipping - recalculation in progress', null, 'layout');
                return;
            }
            
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                logger.debug('Layout Service', 'Window resize: Triggering layout recalculation after debounce', null, 'layout');
                recalcAndApplyLayout();
            }, RESIZE_DEBOUNCE_DELAY);
        };
        
        window.addEventListener('resize', handleWindowResize);
        logger.debug('Layout Service', 'Layout trigger: Using window resize events instead of ResizeObserver', null, 'layout');
        return { ctx, drumCtx };
    },
    
    zoomIn() {
        const oldZoom = currentZoomLevel;
        currentZoomLevel = Math.min(MAX_ZOOM_LEVEL, currentZoomLevel * ZOOM_IN_FACTOR);
        logger.debug('Layout Service', 'ZOOM IN', { from: oldZoom, to: currentZoomLevel }, 'zoom');
        recalcAndApplyLayout();
    },

    zoomOut() {
        const oldZoom = currentZoomLevel;
        currentZoomLevel = Math.max(MIN_ZOOM_LEVEL, currentZoomLevel * ZOOM_OUT_FACTOR);
        logger.debug('Layout Service', 'ZOOM OUT', { from: oldZoom, to: currentZoomLevel }, 'zoom');
        recalcAndApplyLayout();
    },
    
    resetZoom() {
        currentZoomLevel = 1.0;
        recalcAndApplyLayout();
    },
    
    scroll(deltaY) {
        const scrollAmount = (deltaY / viewportHeight) / 4;
        currentScrollPosition = Math.max(0, Math.min(1, currentScrollPosition + scrollAmount));
        store.emit('layoutConfigChanged');
    },
    
    // Pixel-level scrolling for middle mouse drag
    scrollByPixels(deltaY, deltaX = 0) {
        // Invert vertical direction: dragging down should move view up (negative deltaY)
        const invertedDeltaY = -deltaY;
        
        // Convert pixel delta to scroll position delta
        const totalRows = store.state.fullRowData.length;
        const baseRowHeight = (viewportHeight / DEFAULT_VISIBLE_SEMITONES);
        const rowHeight = baseRowHeight * currentZoomLevel;
        const fullVirtualHeight = totalRows * rowHeight;
        const paddedVirtualHeight = fullVirtualHeight + rowHeight;
        const scrollableDist = Math.max(0, paddedVirtualHeight - viewportHeight);
        
        if (scrollableDist > 0) {
            const scrollDelta = invertedDeltaY / scrollableDist;
            currentScrollPosition = Math.max(0, Math.min(1, currentScrollPosition + scrollDelta));
        }
        
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
    },
    
    // Force a layout recalculation (e.g., when rhythm structure changes)
    recalculateLayout() {
        recalcAndApplyLayout();
    }
};

// DEBUG: Expose debugging function globally for manual testing
window.debugContainerWidths = logContainerWidths;

export default LayoutService;