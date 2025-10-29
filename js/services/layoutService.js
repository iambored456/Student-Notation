// js/services/layoutService.js
import store from '../state/index.js';
import {
    DEFAULT_SCROLL_POSITION, GRID_WIDTH_RATIO,  BASE_DRUM_ROW_HEIGHT,
    DRUM_HEIGHT_SCALE_FACTOR, DRUM_ROW_COUNT, 
    MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL, ZOOM_IN_FACTOR, ZOOM_OUT_FACTOR, RESIZE_DEBOUNCE_DELAY
} from '../core/constants.js';
import { calculateColumnWidths, getColumnX as getColumnXFromColumns, getCanvasWidth as getCanvasWidthFromColumns } from './columnsLayout.js';

// Pure abstract units - independent of container size
const BASE_ABSTRACT_UNIT = 30;  // Fixed abstract unit size in pixels

let currentZoomLevel = 1.0;
let currentScrollPosition = DEFAULT_SCROLL_POSITION;

let viewportHeight = 0;
let /* gridContainer, */ pitchGridWrapper, canvas, ctx, drumGridWrapper, drumCanvas, drumCtx, drumPlayheadCanvas, playheadCanvas, hoverCanvas, drumHoverCanvas, pitchPaintCanvas, macrobeatToolsWrapper;
let resizeTimeout;
let isRecalculating = false;
let isZooming = false;
// let lastCalculatedWidth = 0;  // Unused variable
let lastCalculatedDrumHeight = 0;
let pendingSnapToRange = false;
let pendingStartRow = null;

function getDynamicMinZoomLevel() {
    const totalRanks = store.state.fullRowData?.length || 0;
    if (totalRanks === 0) {
        return MIN_ZOOM_LEVEL;
    }

    const pitchGridContainer = document.getElementById('pitch-grid-container');
    const fallbackViewport = viewportHeight || window.innerHeight || 0;
    const containerHeight = pitchGridContainer?.clientHeight || (fallbackViewport ? fallbackViewport * 0.7 : 0);

    if (!containerHeight || containerHeight <= 0) {
        return MIN_ZOOM_LEVEL;
    }

    const requiredZoom = (2 * containerHeight) / (totalRanks * BASE_ABSTRACT_UNIT);
    return Math.max(MIN_ZOOM_LEVEL, requiredZoom);
}

function initDOMElements() {
    // gridContainer = document.getElementById('grid-container');  // Unused variable
    pitchGridWrapper = document.getElementById('pitch-grid-wrapper'); 
    canvas = document.getElementById('notation-grid');
    drumGridWrapper = document.getElementById('drum-grid-wrapper');
    drumCanvas = document.getElementById('drum-grid');
    drumPlayheadCanvas = document.getElementById('drum-playhead-canvas');
    playheadCanvas = document.getElementById('playhead-canvas');
    hoverCanvas = document.getElementById('hover-canvas');
    drumHoverCanvas = document.getElementById('drum-hover-canvas');
    pitchPaintCanvas = document.getElementById('pitch-paint-canvas');
    macrobeatToolsWrapper = document.getElementById('canvas-macrobeat-tools');
    
    const canvasContainer = document.getElementById('canvas-container');
    
    if (!pitchGridWrapper || !canvas || !canvasContainer) {
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
    
    if (isRecalculating) {
        return;
    }
    
    isRecalculating = true;

    const pitchGridContainer = document.getElementById('pitch-grid-container');
    const containerWidth = pitchGridWrapper.clientWidth;
    const windowHeight = window.innerHeight;
    const referenceDiff = Math.abs(windowHeight - viewportHeight);
    
    if (referenceDiff > 3 || viewportHeight === 0) {
        viewportHeight = windowHeight;
    }

    const enforcedMinZoom = getDynamicMinZoomLevel();
    if (currentZoomLevel < enforcedMinZoom) {
        currentZoomLevel = enforcedMinZoom;
        console.log(`[Zoom] Enforcing minimum zoom to maintain grid height: ${Math.round(currentZoomLevel * 100)}%`);
    }
    
    // const availableHeight = pitchGridContainer.clientHeight || (windowHeight * 0.7);  // Unused variable
    // const viewportWidth = containerWidth;  // Unused variable
    // cellHeight is the fundamental abstract unit, scaled only by zoom
    const baseCellHeight = BASE_ABSTRACT_UNIT;
    const baseCellWidth = baseCellHeight * GRID_WIDTH_RATIO;
    const newCellHeight = baseCellHeight * currentZoomLevel;
    const newCellWidth = baseCellWidth * currentZoomLevel;
    
    store.setLayoutConfig({
        cellHeight: newCellHeight,
        cellWidth: newCellWidth
    });

    const newColumnWidths = calculateColumnWidths(store.state);
    
    store.setLayoutConfig({
        columnWidths: newColumnWidths
    });

    const totalWidthUnits = newColumnWidths.reduce((sum, w) => sum + w, 0);
    const totalCanvasWidth = totalWidthUnits * store.state.cellWidth;
    const modulatedCanvasWidth = LayoutService.getModulatedCanvasWidth();
    const finalCanvasWidth = modulatedCanvasWidth > totalCanvasWidth ? modulatedCanvasWidth : totalCanvasWidth;
    const totalCanvasWidthPx = Math.round(finalCanvasWidth);
    
    const drumGridWrapper = document.getElementById('drum-grid-wrapper');
    const targetWidth = totalCanvasWidthPx + 'px';
    
    if (pitchGridContainer) {
        pitchGridContainer.style.width = targetWidth;
    }
    
    if (pitchGridWrapper) {
        pitchGridWrapper.style.width = targetWidth;
    }
    
    const drumAreaEnd = store.state.columnWidths.length - 2;
    let drumGridWidth = 0;
    for (let i = 0; i < drumAreaEnd; i++) {
        drumGridWidth += (store.state.columnWidths[i] || 0) * store.state.cellWidth;
    }
    
    // Calculate macrobeat tools width (excluding left side columns)
    const macrobeatToolsStart = 2; // Skip first 2 side columns
    const macrobeatToolsEnd = store.state.columnWidths.length - 2; // Exclude right legend columns
    let macrobeatToolsWidth = 0;
    for (let i = macrobeatToolsStart; i < macrobeatToolsEnd; i++) {
        macrobeatToolsWidth += (store.state.columnWidths[i] || 0) * store.state.cellWidth;
    }
    
    
    if (drumGridWrapper) {
        drumGridWrapper.style.width = `${drumGridWidth}px`;
    }
    
    if (macrobeatToolsWrapper) {
        macrobeatToolsWrapper.style.width = `${macrobeatToolsWidth}px`;
        // Calculate the left offset to align with content columns (skip first 2 side columns)
        const leftOffset = store.state.columnWidths.slice(0, macrobeatToolsStart).reduce((sum, w) => sum + w * store.state.cellWidth, 0);
        macrobeatToolsWrapper.style.marginLeft = `${leftOffset}px`;
    }
    
    
    [canvas, playheadCanvas, hoverCanvas, pitchPaintCanvas].forEach(c => { 
        if(c && Math.abs(c.width - totalCanvasWidthPx) > 1) { 
            c.width = totalCanvasWidthPx; 
        }
    });
    
    [drumCanvas, drumPlayheadCanvas, drumHoverCanvas].forEach(c => { 
        if(c && Math.abs(c.width - drumGridWidth) > 1) { 
            c.width = drumGridWidth; 
        }
    });
    
    const drumRowHeight = Math.max(BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR * store.state.cellHeight);
    const drumCanvasHeight = DRUM_ROW_COUNT * drumRowHeight;
    const drumHeightPx = `${drumCanvasHeight}px`;
    
    const drumHeightChanged = Math.abs(lastCalculatedDrumHeight - drumCanvasHeight) > 5;
    const shouldUpdateDrumHeight = drumGridWrapper && (drumHeightChanged || lastCalculatedDrumHeight === 0);
    
    if (shouldUpdateDrumHeight) {
        drumGridWrapper.style.height = drumHeightPx;
        lastCalculatedDrumHeight = drumCanvasHeight;
    }
    if (drumCanvas && Math.abs(drumCanvas.height - drumCanvasHeight) > 1) {
        drumCanvas.height = drumCanvasHeight;
    }
    if (drumPlayheadCanvas && Math.abs(drumPlayheadCanvas.height - drumCanvasHeight) > 1) {
        drumPlayheadCanvas.height = drumCanvasHeight;
    }
    if (drumHoverCanvas && Math.abs(drumHoverCanvas.height - drumCanvasHeight) > 1) {
        drumHoverCanvas.height = drumCanvasHeight;
    }

    setTimeout(() => {
        const finalPitchGridContainer = document.getElementById('pitch-grid-container');
        const finalContainerHeight = finalPitchGridContainer.clientHeight;
        
        
        [canvas, playheadCanvas, hoverCanvas, pitchPaintCanvas].forEach((c, index) => { 
            if(c && Math.abs(c.height - finalContainerHeight) > 1) { 
                c.height = finalContainerHeight; 
            } 
        });
        
        document.dispatchEvent(new CustomEvent('canvasResized', { 
            detail: { source: 'layoutService-deferred' }
        }));
        
    }, );

    
    if (pendingStartRow !== null) {
        const totalRanks = store.state.fullRowData.length;
        if (totalRanks <= 0) {
            currentScrollPosition = 0;
        } else {
            const clampedRow = Math.max(0, Math.min(totalRanks - 1, pendingStartRow));
            const pitchGridContainer = document.getElementById('pitch-grid-container');
            const containerHeight = pitchGridContainer?.clientHeight || (viewportHeight * 0.7);
            const cellHeight = store.state.cellHeight || BASE_ABSTRACT_UNIT;
            const halfUnit = cellHeight / 2;
            const scrollableDist = Math.max(0, (totalRanks * halfUnit) - containerHeight);
            if (scrollableDist <= 0) {
                currentScrollPosition = 0;
            } else {
                const targetOffset = clampedRow * halfUnit;
                currentScrollPosition = Math.max(0, Math.min(1, targetOffset / scrollableDist));
            }
        }
        pendingStartRow = null;
    }

    store.emit('layoutConfigChanged');
    isRecalculating = false;
    if (pendingSnapToRange) {
        pendingSnapToRange = false;
        LayoutService.snapZoomToCurrentRange();
    }
}


const LayoutService = {
    init() {
        const { ctx, drumCtx, canvasContainer } = initDOMElements();
        requestAnimationFrame(recalcAndApplyLayout);
        this.initScrollHandler();
       
        const handleWindowResize = () => {
            if (isRecalculating) {
                return;
            }
            
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                recalcAndApplyLayout();
            }, RESIZE_DEBOUNCE_DELAY);
        };
        
        window.addEventListener('resize', handleWindowResize);
        return { ctx, drumCtx };
    },
    
    initScrollHandler() {
        const scrollContainer = document.getElementById('pitch-grid-wrapper'); 
        if (!scrollContainer) {
            return;
        }

        scrollContainer.addEventListener('wheel', (e) => {
            e.preventDefault();

            if (e.ctrlKey || e.metaKey) {
                if (e.deltaY < 0) {
                    this.zoomIn();
                } else {
                    this.zoomOut();
                }
            } else {
                const scrollDirection = e.deltaY > 0 ? 1 : -1;
                this.scrollByUnits(scrollDirection);
            }
        }, { passive: false });
    },
    
    zoomIn() {
        if (isZooming) return;
        if (store.state.snapZoomToRange) {
            store.setSnapZoomToRange(false);
        }
        isZooming = true;
        currentZoomLevel = Math.min(MAX_ZOOM_LEVEL, currentZoomLevel * ZOOM_IN_FACTOR);
        console.log(`[Zoom] Zoom level: ${Math.round(currentZoomLevel * 100)}%`);
        
        // Double RAF to ensure DOM has settled after zoom
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                recalcAndApplyLayout();
                isZooming = false;
            });
        });
    },

    zoomOut() {
        if (isZooming) return;
        
        if (store.state.snapZoomToRange) {
            store.setSnapZoomToRange(false);
        }
        isZooming = true;
        const minZoomLevel = getDynamicMinZoomLevel();
        const targetZoom = Math.max(MIN_ZOOM_LEVEL, currentZoomLevel * ZOOM_OUT_FACTOR);
        const clampedZoom = Math.max(minZoomLevel, targetZoom);
        if (clampedZoom !== targetZoom) {
            console.log(`[Zoom] Minimum zoom reached; clamping to ${Math.round(clampedZoom * 100)}%`);
        }
        currentZoomLevel = clampedZoom;
        console.log(`[Zoom] Zoom level: ${Math.round(currentZoomLevel * 100)}%`);
        
        // Double RAF to ensure DOM has settled after zoom
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                recalcAndApplyLayout();
                isZooming = false;
            });
        });
    },
    
    resetZoom() {
        if (isZooming) return;
        if (store.state.snapZoomToRange) {
            store.setSnapZoomToRange(false);
        }
        isZooming = true;
        currentZoomLevel = 1.0;
        console.log('[Zoom] Zoom level reset to 100%');
        
        // Double RAF to ensure DOM has settled after zoom
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                recalcAndApplyLayout();
                isZooming = false;
            });
        });
    },

    snapZoomToCurrentRange() {
        if (isZooming) {
            pendingSnapToRange = true;
            return;
        }
        const enforcedMinZoom = getDynamicMinZoomLevel();
        const targetZoom = Math.min(MAX_ZOOM_LEVEL, enforcedMinZoom);
        if (!isFinite(targetZoom) || targetZoom <= 0) {
            return;
        }

        const zoomChanged = Math.abs(currentZoomLevel - targetZoom) > 0.0001;

        isZooming = true;
        currentZoomLevel = targetZoom;
        if (enforcedMinZoom > MAX_ZOOM_LEVEL + 0.0001) {
            console.log(`[Zoom] Snap zoom limited by MAX_ZOOM_LEVEL (${Math.round(MAX_ZOOM_LEVEL * 100)}%)`);
        } else if (zoomChanged) {
            console.log(`[Zoom] Snap zoom to range: ${Math.round(currentZoomLevel * 100)}%`);
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                recalcAndApplyLayout();
                isZooming = false;
                if (pendingSnapToRange) {
                    pendingSnapToRange = false;
                    this.snapZoomToCurrentRange();
                }
            });
        });
    },
    
    setPendingStartRow(row) {
        if (typeof row === 'number' && Number.isFinite(row)) {
            pendingStartRow = Math.max(0, row);
        } else {
            pendingStartRow = null;
        }
    },

    scroll(deltaY) {
        const scrollAmount = (deltaY / viewportHeight) / 4;
        currentScrollPosition = Math.max(0, Math.min(1, currentScrollPosition + scrollAmount));
        store.emit('layoutConfigChanged');
    },
    
    scrollByUnits(direction) {
        const totalRanks = store.state.fullRowData.length;
        const cellHeight = store.state.cellHeight || BASE_ABSTRACT_UNIT;
        const halfUnit = cellHeight / 2;
        const fullVirtualHeight = totalRanks * halfUnit;
        const paddedVirtualHeight = fullVirtualHeight;
        
        const pitchGridContainer = document.getElementById('pitch-grid-container');
        const containerHeight = pitchGridContainer?.clientHeight || (viewportHeight * 0.7);
        const scrollableDist = Math.max(0, paddedVirtualHeight - containerHeight);
        
        if (scrollableDist > 0) {
            const unitScrollDelta = (direction * halfUnit) / scrollableDist;
            currentScrollPosition = Math.max(0, Math.min(1, currentScrollPosition + unitScrollDelta));
            store.emit('layoutConfigChanged');
        }
    },
    
    scrollByPixels(deltaY, deltaX = 0) {
        const invertedDeltaY = -deltaY;
        const totalRanks = store.state.fullRowData.length;
        const baseRankHeight = store.state.cellHeight || BASE_ABSTRACT_UNIT;
        const rankHeight = baseRankHeight * currentZoomLevel;
        const fullVirtualHeight = totalRanks * rankHeight;
        const paddedVirtualHeight = fullVirtualHeight;
        const scrollableDist = Math.max(0, paddedVirtualHeight - viewportHeight);
        
        if (scrollableDist > 0) {
            const scrollDelta = invertedDeltaY / scrollableDist;
            currentScrollPosition = Math.max(0, Math.min(1, currentScrollPosition + scrollDelta));
        }
        
        store.emit('layoutConfigChanged');
    },
    
    getViewportInfo() {
        const totalRanks = store.state.fullRowData.length;
        const pitchGridContainer = document.getElementById('pitch-grid-container');
        const containerHeight = pitchGridContainer?.clientHeight || (viewportHeight * 0.7);
        const cellHeight = store.state.cellHeight || BASE_ABSTRACT_UNIT;
        const halfUnit = cellHeight / 2;
        const fullVirtualHeight = totalRanks * halfUnit;
        const paddedVirtualHeight = fullVirtualHeight;
        const scrollableDist = Math.max(0, paddedVirtualHeight - containerHeight);
        const scrollOffset = scrollableDist * currentScrollPosition;
        const startRank = Math.max(0, Math.floor(scrollOffset / halfUnit));
        const visibleRankCount = containerHeight / halfUnit;
        const endRank = Math.min(totalRanks, Math.ceil(startRank + visibleRankCount)  );

        return {
            zoomLevel: currentZoomLevel,
            viewportHeight: viewportHeight,
            containerHeight: containerHeight,
            cellHeight: cellHeight,
            halfUnit: halfUnit,
            startRank: startRank,
            endRank: endRank,
            scrollOffset: scrollOffset
        };
    },
    
    getMacrobeatWidthPx(state, grouping) {
        return grouping * state.cellWidth;
    },

    getColumnX(index) {
        return getColumnXFromColumns(index, store.state.columnWidths, store.state.cellWidth);
    },

    getCanvasWidth() {
        return getCanvasWidthFromColumns(store.state.columnWidths, store.state.cellWidth);
    },

    getModulatedCanvasWidth() {
        const baseWidth = this.getCanvasWidth();
        
        if (!store.state.modulationMarkers || store.state.modulationMarkers.length === 0) {
            return baseWidth;
        }
        
        try {
            const baseMicrobeatPx = store.state.baseMicrobeatPx || store.state.cellWidth || 40;
            let estimatedWidth = baseWidth;
            
            store.state.modulationMarkers.forEach(marker => {
                if (marker.ratio > 1) {
                    estimatedWidth *= marker.ratio;
                }
            });
            
            const finalWidth = Math.max(baseWidth, estimatedWidth);
            return finalWidth;
            
        } catch (error) {
            return baseWidth;
        }
    },
    
    recalculateLayout() {
        recalcAndApplyLayout();
    },
    
    get isZooming() {
        return isZooming;
    }
};

export default LayoutService;
