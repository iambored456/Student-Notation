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
    
    // pitchGrid Assembly - contains time signature + tools + viewport
    const canvasContainer = document.getElementById('canvas-container');
    
    if (!pitchGridWrapper || !canvas || !canvasContainer) {
        console.error("LayoutService FATAL: Could not find essential canvas elements.");
        return {};
    }
    
    ctx = canvas.getContext('2d');
    drumCtx = drumCanvas.getContext('2d');
    return { ctx, drumCtx, canvasContainer };
}

function recalcAndApplyLayout() {
    if (!pitchGridWrapper || pitchGridWrapper.clientHeight === 0) {
        requestAnimationFrame(recalcAndApplyLayout);
        return;
    }

    // Prevent recursive calls during recalculation
    if (isRecalculating) {
        console.log('⚠️ Skipping recalculation - already in progress');
        return;
    }
    
    isRecalculating = true;

    const pitchGridContainer = document.getElementById('pitch-grid-container');
    const newViewportHeight = pitchGridContainer.clientHeight;
    const newViewportWidth = pitchGridWrapper.clientWidth;
    
    // Log viewport changes
    const heightDiff = Math.abs(newViewportHeight - viewportHeight);
    const widthDiff = Math.abs(newViewportWidth - (pitchGridWrapper._lastViewportWidth || 0));
    
    if (heightDiff > 0 || widthDiff > 0) {
        console.log('📏 Viewport Size Change:', {
            heightChange: `${viewportHeight} → ${newViewportHeight}`,
            widthChange: `${pitchGridWrapper._lastViewportWidth || 'unknown'} → ${newViewportWidth}`,
            heightDiff: newViewportHeight - viewportHeight,
            widthDiff: newViewportWidth - (pitchGridWrapper._lastViewportWidth || 0),
            significant: heightDiff > 3 || widthDiff > 3
        });
        
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
        console.log('📐 Cell Size Change:', {
            heightChange: `${store.state.cellHeight} → ${newCellHeight}`,
            widthChange: `${store.state.cellWidth} → ${newCellWidth}`,
            baseHeight,
            baseWidth,
            viewportHeight,
            zoomLevel: currentZoomLevel,
            DEFAULT_VISIBLE_SEMITONES,
            GRID_HEIGHT_MULTIPLIER,
            GRID_WIDTH_RATIO
        });
    }
    
    store.state.cellHeight = newCellHeight;
    store.state.cellWidth = newCellWidth;


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
    
    // EXPERIMENT: Remove width setting entirely - let CSS handle layout
    console.log('🔍 LayoutService Width Debug (NO SETTING):', {
        zoomLevel: currentZoomLevel,
        cellWidth: store.state.cellWidth,
        totalWidthUnits,
        calculatedWidth: totalCanvasWidthPx,
        cssHandledWidth: 'CSS determines width'
    });
    
    // SET CONTAINER WIDTHS: Since containers collapsed to 0px, set them to canvas width
    setTimeout(() => {
        const pitchGridContainer = document.getElementById('pitch-grid-container');
        const drumGridWrapper = document.getElementById('drum-grid-wrapper');
        const harmonyAnalysisGrid = document.getElementById('harmonyAnalysisGrid');
        const notationGrid = document.getElementById('notation-grid');
        const drumGrid = document.getElementById('drum-grid');
        const harmonyCanvas = document.getElementById('harmony-analysis-canvas');
        
        // Set all containers to exactly match canvas width
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
        
        console.log('📊 Container Width Sync:', {
            pitchGridContainer: pitchGridContainer?.clientWidth + 'px',
            drumGridWrapper: drumGridWrapper?.clientWidth + 'px',
            harmonyAnalysisGrid: harmonyAnalysisGrid?.clientWidth + 'px',
            notationCanvas: notationGrid?.width + 'px',
            drumCanvas: drumGrid?.width + 'px',
            harmonyCanvas: harmonyCanvas?.width + 'px',
            setTo: targetWidth,
            allMatch: 'Containers now match canvas widths exactly'
        });
    }, 0);
    
    // Don't set grid-container width - let CSS and natural layout handle it
    console.log('⏭️ Letting CSS handle grid-container width naturally');
    
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
    
    console.log('🥁 Drum Grid Height Debug (DEFERRED):', {
        drumRowHeight,
        drumCanvasHeight,
        lastCalculatedDrumHeight,
        drumHeightChanged,
        willUpdateDeferred: shouldUpdateDrumHeight
    });
    
    if (shouldUpdateDrumHeight) {
        console.log('📏 Setting drum-grid-wrapper height to:', drumHeightPx);
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
        
        console.log('🎯 LayoutService Canvas Heights (DEFERRED):', {
            oldViewportHeight: viewportHeight,
            finalViewportHeight,
            pitchGridContainer: finalPitchGridContainer?.clientHeight,
            pitchGridWrapper: pitchGridWrapper?.clientHeight
        });

        [canvas, playheadCanvas, hoverCanvas].forEach((c, index) => { 
            if(c && Math.abs(c.height - finalViewportHeight) > 1) { 
                const canvasNames = ['notation-grid', 'playhead-canvas', 'hover-canvas'];
                console.log(`📐 Setting ${canvasNames[index]} height (DEFERRED): ${c.height} → ${finalViewportHeight}`);
                c.height = finalViewportHeight; 
            } 
        });
        
        // Trigger grid re-render after deferred canvas resize
        // Use custom event to avoid circular dependencies
        document.dispatchEvent(new CustomEvent('canvasResized', { 
            detail: { source: 'layoutService-deferred' }
        }));
        console.log('🔄 Dispatched canvasResized event after deferred resize');
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
        console.log('✅ Final Canvas Heights (after layout):', {
            'pitch-grid-container': document.getElementById('pitch-grid-container')?.clientHeight,
            'notation-grid': document.getElementById('notation-grid')?.height,
            'pitch-paint-canvas': document.getElementById('pitch-paint-canvas')?.height,
            'playhead-canvas': document.getElementById('playhead-canvas')?.height,
            'hover-canvas': document.getElementById('hover-canvas')?.height,
            'pitch-canvas-wrapper': document.getElementById('pitch-canvas-wrapper')?.clientHeight
        });
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
                console.log('⚠️ Window resize: Skipping - recalculation in progress');
                return;
            }
            
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                console.log('🔄 Window resize: Triggering layout recalculation after debounce');
                recalcAndApplyLayout();
            }, RESIZE_DEBOUNCE_DELAY);
        };
        
        window.addEventListener('resize', handleWindowResize);
        console.log('🔍 Layout trigger: Using window resize events instead of ResizeObserver');
        return { ctx, drumCtx };
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
        const scrollAmount = (deltaY / viewportHeight) / 4;
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