// js/services/layoutService.ts


import store from '@state/index.ts';
import { getTotalPixelWidth } from './pixelMapService.ts';
import logger from '@utils/logger.ts';
import {
  DEFAULT_SCROLL_POSITION, GRID_WIDTH_RATIO,  BASE_DRUM_ROW_HEIGHT,
  DRUM_HEIGHT_SCALE_FACTOR, DRUM_ROW_COUNT,
  MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL, ZOOM_IN_FACTOR, ZOOM_OUT_FACTOR, RESIZE_DEBOUNCE_DELAY,
  SIDE_COLUMN_WIDTH
} from '@/core/constants.ts';
import { calculateColumnWidths, getColumnX as getColumnXFromColumns, getCanvasWidth as getCanvasWidthFromColumns } from './columnsLayout.ts';
import { fullRowData as masterRowData } from '@state/pitchData.ts';





// Pure abstract units - independent of container size


const BASE_ABSTRACT_UNIT = 30;  // Fixed abstract unit size in pixels





let currentZoomLevel = 1.0;
let currentScrollPosition = DEFAULT_SCROLL_POSITION;

let viewportHeight = 0;

let /* gridContainer, */ pitchGridWrapper: HTMLElement | null,
  canvas: HTMLCanvasElement | null,
  ctx: CanvasRenderingContext2D | null,
  legendLeftCanvas: HTMLCanvasElement | null,
  legendRightCanvas: HTMLCanvasElement | null,
  drumGridWrapper: HTMLElement | null,
  drumCanvas: HTMLCanvasElement | null,
  drumCtx: CanvasRenderingContext2D | null,
  drumPlayheadCanvas: HTMLCanvasElement | null,
  playheadCanvas: HTMLCanvasElement | null,
  hoverCanvas: HTMLCanvasElement | null,
  drumHoverCanvas: HTMLCanvasElement | null,
  buttonGridWrapper: HTMLElement | null,
  gridScrollbarProxy: HTMLElement | null,
  gridScrollbarInner: HTMLElement | null;

let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

let isRecalculating = false;
let isZooming = false;
let pitchGridNotReadyLogged = false;
let beatLineWidthWarningShown = false;
let hasResolvedInitialLayout = false;
let resolveInitialLayout: (() => void) | null = null;
const initialLayoutPromise = new Promise<void>(resolve => {
  resolveInitialLayout = () => resolve();
});

// let lastCalculatedWidth = 0;  // Unused variable
let lastCalculatedDrumHeight = 0;
let lastCalculatedButtonGridHeight = 0;
let pendingSnapToRange = false;
let pendingStartRow: number | null = null;

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


  const clampedMin = Math.max(MIN_ZOOM_LEVEL, requiredZoom);


  return clampedMin;


}





function getDevicePixelRatio() {


  const ratio = window?.devicePixelRatio ?? 1;


  if (!Number.isFinite(ratio) || ratio <= 0) {


    return 1;


  }


  return ratio;


}





function resizeCanvasForPixelRatio(
  canvasElement: HTMLCanvasElement | null,
  logicalWidth: number | undefined,
  logicalHeight: number | undefined,
  pixelRatio: number,
  existingContext?: CanvasRenderingContext2D | null
) {


  if (!canvasElement) {


    return false;


  }


  const normalizedRatio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;


  canvasElement.dataset['pixelRatio'] = `${normalizedRatio}`;





  let resized = false;





  if (typeof logicalWidth === 'number') {


    const targetWidth = Math.max(1, Math.round(logicalWidth * normalizedRatio));


    if (Math.abs(canvasElement.width - targetWidth) > 0.5) {


      canvasElement.width = targetWidth;


      resized = true;


    }


    canvasElement.style.width = `${logicalWidth}px`;


    canvasElement.dataset['logicalWidth'] = `${logicalWidth}`;


  }





  if (typeof logicalHeight === 'number') {


    const targetHeight = Math.max(1, Math.round(logicalHeight * normalizedRatio));


    if (Math.abs(canvasElement.height - targetHeight) > 0.5) {


      canvasElement.height = targetHeight;


      resized = true;


    }


    canvasElement.style.height = `${logicalHeight}px`;


    canvasElement.dataset['logicalHeight'] = `${logicalHeight}`;


  }





  if (resized) {


    const ctxToScale = existingContext || canvasElement.getContext('2d');


    if (ctxToScale) {


      ctxToScale.setTransform(normalizedRatio, 0, 0, normalizedRatio, 0, 0);


    }


  }





  return resized;


}





function initDOMElements() {


  // gridContainer = document.getElementById('grid-container');  // Unused variable


  pitchGridWrapper = document.getElementById('pitch-grid-wrapper');


  canvas = document.getElementById('notation-grid') as HTMLCanvasElement | null;


  legendLeftCanvas = document.getElementById('legend-left-canvas') as HTMLCanvasElement | null;


  legendRightCanvas = document.getElementById('legend-right-canvas') as HTMLCanvasElement | null;


  drumGridWrapper = document.getElementById('drum-grid-wrapper');


  drumCanvas = document.getElementById('drum-grid') as HTMLCanvasElement | null;


  drumPlayheadCanvas = document.getElementById('drum-playhead-canvas') as HTMLCanvasElement | null;


  playheadCanvas = document.getElementById('playhead-canvas') as HTMLCanvasElement | null;


  hoverCanvas = document.getElementById('hover-canvas') as HTMLCanvasElement | null;


  drumHoverCanvas = document.getElementById('drum-hover-canvas') as HTMLCanvasElement | null;



  buttonGridWrapper = document.getElementById('button-grid');


  gridScrollbarProxy = document.getElementById('grid-scrollbar-proxy');


  gridScrollbarInner = (gridScrollbarProxy?.querySelector('.grid-scrollbar-inner')!) || null;





  const canvasContainer = document.getElementById('canvas-container');





  if (!pitchGridWrapper || !canvas || !canvasContainer) {


    return {};


  }





  ctx = canvas.getContext('2d');


  drumCtx = drumCanvas?.getContext('2d') || null;


  const legendLeftCtx = legendLeftCanvas?.getContext('2d') || null;


  const legendRightCtx = legendRightCanvas?.getContext('2d') || null;


  return { ctx, drumCtx, legendLeftCtx, legendRightCtx, canvasContainer };


}





function markInitialLayoutReady(): void {
  if (hasResolvedInitialLayout) {
    return;
  }

  const hasColumns = (store.state.columnWidths?.length || 0) > 0;
  const hasCellWidth = Boolean(store.state.cellWidth && store.state.cellWidth > 0);

  if (!hasColumns || !hasCellWidth) {
    return;
  }

  hasResolvedInitialLayout = true;
  resolveInitialLayout?.();
}

function recalcAndApplyLayout() {


  if (!pitchGridWrapper || pitchGridWrapper.clientHeight === 0) {


    if (!pitchGridNotReadyLogged) {


      logger.warn('LayoutService', 'Pitch grid wrapper not ready for layout (height=0). Retrying on next frame.', null, 'layout');


      pitchGridNotReadyLogged = true;


    }


    requestAnimationFrame(recalcAndApplyLayout);


    return;


  }


  pitchGridNotReadyLogged = false;





  if (isRecalculating) {


    return;


  }





  isRecalculating = true;





  const pitchGridContainer = document.getElementById('pitch-grid-container');


  const _containerWidth = pitchGridWrapper.clientWidth;

  const windowHeight = window.innerHeight;


  const referenceDiff = Math.abs(windowHeight - viewportHeight);





  if (referenceDiff > 3 || viewportHeight === 0) {


    viewportHeight = windowHeight;


  }





  // Always enforce minimum zoom to prevent whitespace
  const enforcedMinZoom = getDynamicMinZoomLevel();

  if (currentZoomLevel < enforcedMinZoom) {
    currentZoomLevel = enforcedMinZoom;
    logger.debug('LayoutService', `[Zoom] Enforcing minimum zoom to maintain grid height: ${Math.round(currentZoomLevel * 100)}%`, null, 'layout');
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






  markInitialLayoutReady();



  if (!store.state.cellWidth || !newColumnWidths.length) {


    logger.warn('LayoutService', 'Unexpected layout configuration', {


      cellWidth: store.state.cellWidth,


      columnCount: newColumnWidths.length


    }, 'layout');


  }





  const totalWidthUnits = newColumnWidths.reduce((sum, w) => sum + w, 0);


  const musicalCanvasWidth = totalWidthUnits * store.state.cellWidth;  // Musical area only (canvas-space)


  const modulatedMusicalWidth = LayoutService.getModulatedCanvasWidth();


  // Always use modulated width if modulation is active (allows compression)
  // Only fall back to unmodulated musical width if no modulation present
  const hasModulation = store.state.modulationMarkers && store.state.modulationMarkers.length > 0;
  const finalMusicalWidth = hasModulation ? modulatedMusicalWidth : musicalCanvasWidth;

  // After Phase 8: Add legend widths to musical width to get total grid width
  const leftLegendWidthUnits = SIDE_COLUMN_WIDTH * 2 * store.state.cellWidth;
  const rightLegendWidthUnits = SIDE_COLUMN_WIDTH * 2 * store.state.cellWidth;
  const totalCanvasWidthPx = Math.round(finalMusicalWidth + leftLegendWidthUnits + rightLegendWidthUnits);

  const pixelRatio = getDevicePixelRatio();





  const _drumGridWrapper = document.getElementById('drum-grid-wrapper');


  const gridsWrapper = document.getElementById('grids-wrapper');


  const targetWidth = totalCanvasWidthPx + 'px';




  // Both pitch grid and drum grid now use the same total width (unified grid system)


  if (pitchGridContainer) {
    pitchGridContainer.style.width = targetWidth;
  }





  if (pitchGridWrapper) {


    pitchGridWrapper.style.width = targetWidth;


  }





  if (drumGridWrapper) {


    drumGridWrapper.style.width = targetWidth;


  }





  // Scrollbar proxy should fill viewport (width: 100%), inner should be full grid width


  if (gridScrollbarInner && gridScrollbarProxy) {


    gridScrollbarInner.style.width = targetWidth;





    // Check if grids extend beyond viewport


    const gridsWrapperWidth = gridsWrapper?.getBoundingClientRect().width || 0;


    const needsScrollbar = totalCanvasWidthPx > gridsWrapperWidth;





    // Show/hide scrollbar based on whether content exceeds viewport


    if (needsScrollbar) {


      gridScrollbarProxy.style.display = '';


    } else {


      gridScrollbarProxy.style.display = 'none';


    }





  }





  // Calculate button grid height (same as drum grid for visual consistency)


  const buttonRowHeight = Math.max(BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR * store.state.cellHeight);


  const buttonGridHeight = DRUM_ROW_COUNT * buttonRowHeight;


  const buttonGridHeightPx = `${buttonGridHeight}px`;





  // Calculate middle cell width (excluding left and right legend columns)
  // IMPORTANT: Apply modulation if active to match the musical canvas width


  const columnWidthsCount = store.state.columnWidths?.length ?? 0;


  let middleCellWidth = 0;

  if (hasModulation) {
    // Use modulated width calculation (columnWidths is now canvas-space after Phase 8)
    const renderOptions = {
      cellWidth: store.state.cellWidth,
      columnWidths: store.state.columnWidths,
      modulationMarkers: store.state.modulationMarkers,
      baseMicrobeatPx: store.state.cellWidth,
      cellHeight: store.state.cellHeight,
      state: store.state
    };
    // Get total modulated width from pixelMapService
    middleCellWidth = getTotalPixelWidth(renderOptions);
  } else {
    // No modulation: use unmodulated width calculation
    // columnWidths is now canvas-space (no legends), so sum all of it
    for (let i = 0; i < columnWidthsCount; i++) {


      middleCellWidth += (store.state.columnWidths[i] || 0) * store.state.cellWidth;


    }
  }


  if (columnWidthsCount === 0) {


    logger.warn('LayoutService', 'Column widths array is empty.', {


      columnWidthsCount,


      columnWidths: store.state.columnWidths


    }, 'layout');


  }


  if (middleCellWidth < 50 && columnWidthsCount > 0) {


    logger.warn('LayoutService', 'Computed button-grid middle cell width is unexpectedly small.', {


      middleCellWidth,


      columnWidthsSample: store.state.columnWidths?.slice(0, 10),


      cellWidth: store.state.cellWidth,


      macrobeatGroupings: store.state.macrobeatGroupings


    }, 'layout');


  }





  // Set widths and heights for the three-cell button grid structure


  if (buttonGridWrapper) {


    const leftCell = buttonGridWrapper.querySelector('.button-grid-left-cell');


    const middleCell = buttonGridWrapper.querySelector('.button-grid-middle-cell');


    const rightCell = buttonGridWrapper.querySelector('.button-grid-right-cell');





    // Calculate left legend width (first 2 columns)


    const leftCellWidth = SIDE_COLUMN_WIDTH * 2 * store.state.cellWidth;





    // Calculate right legend width (last 2 columns)


    const rightCellWidth = SIDE_COLUMN_WIDTH * 2 * store.state.cellWidth;





    const buttonGridHeightChanged = Math.abs(lastCalculatedButtonGridHeight - buttonGridHeight) > 5;


    const shouldUpdateButtonGridHeight = buttonGridHeightChanged || lastCalculatedButtonGridHeight === 0;





    if (shouldUpdateButtonGridHeight) {


      buttonGridWrapper.style.height = buttonGridHeightPx;


      lastCalculatedButtonGridHeight = buttonGridHeight;


    }





    const applyCellSizing = (cell: HTMLElement | null, widthPx: number) => {


      if (!cell) {return;}


      const widthValue = `${Math.max(0, widthPx)}px`;


      cell.style.width = widthValue;


      cell.style.flex = `0 0 ${widthValue}`;


      cell.style.maxWidth = widthValue;


      cell.style.minWidth = widthValue;


      cell.style.height = buttonGridHeightPx;


    };





    if (leftCell) {


      applyCellSizing(leftCell, leftCellWidth);


      const leftRect = leftCell.getBoundingClientRect();


      if (leftCellWidth > 0 && leftRect.width === 0) {


        logger.warn('LayoutService', 'Left button-grid cell measured width is 0 after assignment.', {


          assignedWidth: leftCellWidth,


          measuredWidth: leftRect.width,


          computedDisplay: window.getComputedStyle(leftCell).display


        }, 'layout');


      }


    }





    if (middleCell) {


      if (middleCellWidth === 0) {


        logger.warn('LayoutService', 'Calculated middle button-grid width is 0. Check column width data.', {


          columnWidths: store.state.columnWidths,


          cellWidth: store.state.cellWidth


        }, 'layout');


      }


      applyCellSizing(middleCell, middleCellWidth);


      const middleRect = middleCell.getBoundingClientRect();


      if (middleCellWidth > 0 && middleRect.width === 0) {


        logger.warn('LayoutService', 'Middle button-grid cell assigned width but still measures 0.', {


          assignedWidth: middleCellWidth,


          measuredWidth: middleRect.width,


          computedStyles: window.getComputedStyle(middleCell)


        }, 'layout');


      }


      if (Math.abs(middleRect.width - middleCellWidth) > 5) {


        logger.warn('LayoutService', 'Middle cell measured width does not match assigned width.', {


          assignedWidth: middleCellWidth,


          measuredWidth: middleRect.width,


          styleWidth: middleCell.style.width,


          cellWidth: store.state.cellWidth


        }, 'layout');


        requestAnimationFrame(() => {


          const postRect = middleCell.getBoundingClientRect();


          if (Math.abs(postRect.width - middleCellWidth) > 5) {


            logger.warn('LayoutService', 'Middle cell still mismatched after RAF.', {


              assignedWidth: middleCellWidth,


              measuredWidth: postRect.width,


              delta: postRect.width - middleCellWidth,


              computedStyles: window.getComputedStyle(middleCell)


            }, 'layout');


          }


        });


      }





      if (!beatLineWidthWarningShown) {


        const beatLineLayer = middleCell.querySelector('#beat-line-button-layer');


        if (beatLineLayer) {


          const beatLineRect = beatLineLayer.getBoundingClientRect();


          if (beatLineRect.width === 0) {


            const beatLineStyles = window.getComputedStyle(beatLineLayer);


            logger.warn('LayoutService', '#beat-line-button-layer width is 0 despite middle cell sizing.', {


              beatLineRect,


              beatLineStyles: {


                display: beatLineStyles.display,


                position: beatLineStyles.position,


                flex: {


                  direction: beatLineStyles.flexDirection,


                  grow: beatLineStyles.flexGrow,


                  shrink: beatLineStyles.flexShrink,


                  basis: beatLineStyles.flexBasis


                },


                width: beatLineStyles.width,


                minWidth: beatLineStyles.minWidth,


                maxWidth: beatLineStyles.maxWidth


              },


              middleRect,


              middleCellComputedWidth: beatLineStyles.width


            }, 'layout');


            beatLineWidthWarningShown = true;


          }


        } else {


          logger.warn('LayoutService', 'Could not find #beat-line-button-layer inside middle cell to measure.', null, 'layout');


          beatLineWidthWarningShown = true;


        }


      }


    }





    if (rightCell) {


      applyCellSizing(rightCell, rightCellWidth);


      const rightRect = rightCell.getBoundingClientRect();


      if (rightCellWidth > 0 && rightRect.width === 0) {


        logger.warn('LayoutService', 'Right button-grid cell measured width is 0 after assignment.', {


          assignedWidth: rightCellWidth,


          measuredWidth: rightRect.width,


          computedDisplay: window.getComputedStyle(rightCell).display


        }, 'layout');


      }


    }





    const totalButtonGridWidth = leftCellWidth + middleCellWidth + rightCellWidth;





    // Button grid should match the total canvas width (same as pitch/drum grids)


    // Use targetWidth directly to ensure alignment


    if (Number.isFinite(totalButtonGridWidth) && totalButtonGridWidth > 0) {


      buttonGridWrapper.style.width = targetWidth;


      buttonGridWrapper.style.maxWidth = targetWidth;


      buttonGridWrapper.style.minWidth = targetWidth;





    }





    const buttonGridRect = buttonGridWrapper.getBoundingClientRect();


    if (buttonGridRect.width === 0) {


      logger.warn('LayoutService', 'Entire button grid wrapper width is 0 after layout pass.', {


        leftCellWidth,


        middleCellWidth,


        rightCellWidth,


        wrapperStyles: window.getComputedStyle(buttonGridWrapper)


      }, 'layout');


    }





  }





  // Both pitch and drum canvases now use the same unified width


  const drumRowHeight = Math.max(BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR * store.state.cellHeight);


  const drumCanvasHeight = DRUM_ROW_COUNT * drumRowHeight;


  const drumHeightPx = `${drumCanvasHeight}px`;





  // ============================================================================
  // CANVAS ARCHITECTURE:
  // - Container (pitch-grid-container): Full width including legends
  // - Left legend canvas: Positioned at left: 0, width = 2 columns
  // - Main canvases (notation-grid, playhead, hover):
  //     Width = musical area only (excluding legends)
  //     Positioned with left offset to start after left legend
  // - Right legend canvas: Positioned at right: 0, width = 2 columns
  // ============================================================================

  // Calculate musical-only width (excluding left and right legends)
  const pitchContainerHeight = pitchGridContainer?.clientHeight || 0;
  // Legend columns are fixed width (not in newColumnWidths after Phase 8)
  const leftLegendWidthPx = Math.round(SIDE_COLUMN_WIDTH * 2 * store.state.cellWidth);
  const rightLegendWidthPx = Math.round(SIDE_COLUMN_WIDTH * 2 * store.state.cellWidth);

  // Musical canvas width is already calculated above as finalMusicalWidth
  const musicalCanvasWidthPx = Math.round(finalMusicalWidth);

  const pitchCanvasTargets = [
    { element: canvas, context: ctx },
    { element: playheadCanvas },
    { element: hoverCanvas }
  ];

  // Size main pitch canvases to MUSICAL width only (excluding legends)
  pitchCanvasTargets.forEach(({ element, context }) => {
    resizeCanvasForPixelRatio(element, musicalCanvasWidthPx, undefined, pixelRatio, context);

    // Position canvas after the left legend
    if (element) {
      element.style.left = `${leftLegendWidthPx}px`;
    }
  });

  // Size legend canvases separately - they have fixed widths (2 columns each)
  // and should match the height of the pitch grid container
  resizeCanvasForPixelRatio(legendLeftCanvas, leftLegendWidthPx, pitchContainerHeight, pixelRatio, null);
  resizeCanvasForPixelRatio(legendRightCanvas, rightLegendWidthPx, pitchContainerHeight, pixelRatio, null);





  const drumCanvasTargets = [


    { element: drumCanvas, context: drumCtx },


    { element: drumPlayheadCanvas },


    { element: drumHoverCanvas }


  ];





  drumCanvasTargets.forEach(({ element, context }) => {


    resizeCanvasForPixelRatio(element, musicalCanvasWidthPx, drumCanvasHeight, pixelRatio, context);


  });





  if (drumGridWrapper) {

    const drumLeftCell = drumGridWrapper.querySelector('.drum-grid-left-cell');

    const drumMiddleCell = drumGridWrapper.querySelector('.drum-grid-middle-cell');

    const drumRightCell = drumGridWrapper.querySelector('.drum-grid-right-cell');

    const applyDrumCellSizing = (cell: HTMLElement | null, widthPx: number) => {

      if (!cell) {return;}

      const widthValue = `${Math.max(0, Math.round(widthPx))}px`;

      cell.style.width = widthValue;

      cell.style.flex = `0 0 ${widthValue}`;

      cell.style.maxWidth = widthValue;

      cell.style.minWidth = widthValue;

      cell.style.height = drumHeightPx;

    };

    applyDrumCellSizing(drumLeftCell as HTMLElement | null, leftLegendWidthPx);

    applyDrumCellSizing(drumMiddleCell as HTMLElement | null, musicalCanvasWidthPx);

    applyDrumCellSizing(drumRightCell as HTMLElement | null, rightLegendWidthPx);

    const drumCanvasWrapper = drumMiddleCell?.querySelector('#drum-canvas-wrapper') as HTMLElement | null;

    if (drumCanvasWrapper) {

      drumCanvasWrapper.style.width = '100%';

      drumCanvasWrapper.style.height = drumHeightPx;

    }

  }


  const drumHeightChanged = Math.abs(lastCalculatedDrumHeight - drumCanvasHeight) > 5;


  const shouldUpdateDrumHeight = drumGridWrapper && (drumHeightChanged || lastCalculatedDrumHeight === 0);





  if (shouldUpdateDrumHeight) {


    drumGridWrapper.style.height = drumHeightPx;


    lastCalculatedDrumHeight = drumCanvasHeight;


  }





  const scheduledPixelRatio = pixelRatio;


  const scheduledPitchWidth = musicalCanvasWidthPx; // Use musical width, not total width





  setTimeout(() => {


    const finalPitchGridContainer = document.getElementById('pitch-grid-container');


    const finalContainerHeight = finalPitchGridContainer?.clientHeight || 0;





    pitchCanvasTargets.forEach(({ element, context }) => {


      resizeCanvasForPixelRatio(element, scheduledPitchWidth, finalContainerHeight, scheduledPixelRatio, context);

      // Re-apply positioning after resize
      if (element) {
        element.style.left = `${leftLegendWidthPx}px`;
      }


    });





    document.dispatchEvent(new CustomEvent('canvasResized', {


      detail: { source: 'layoutService-deferred' }


    }));





  } );








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


    const { ctx, drumCtx, legendLeftCtx, legendRightCtx } = initDOMElements();


    requestAnimationFrame(recalcAndApplyLayout);


    this.initScrollHandler();





    const handleWindowResize = () => {


      if (isRecalculating) {


        return;


      }





      if (resizeTimeout !== null) {
        clearTimeout(resizeTimeout);
      }


      resizeTimeout = setTimeout(() => {


        recalcAndApplyLayout();


      }, RESIZE_DEBOUNCE_DELAY);


    };





    window.addEventListener('resize', handleWindowResize);


    // Listen to zoom events from store
    store.on('zoomIn', () => {
      this.zoomIn();
    });

    store.on('zoomOut', () => {
      this.zoomOut();
    });


    return { ctx, drumCtx, legendLeftCtx, legendRightCtx };


  },


  waitForInitialLayout() {


    if (hasResolvedInitialLayout) {
      return Promise.resolve();
    }
    return initialLayoutPromise;


  },



  getCurrentZoomLevel() {


    return currentZoomLevel;


  },





  setZoomLevel(newZoom: number) {


    currentZoomLevel = newZoom;


    recalcAndApplyLayout();


  },





  _canScrollRange(direction: number | 'up' | 'down') {


    const currentRange = store.state.pitchRange;


    if (!currentRange || !masterRowData || masterRowData.length === 0) {return false;}


    const maxMasterIndex = masterRowData.length - 1;


    const directionValue = typeof direction === 'string' ? (direction === 'up' ? -1 : 1) : direction;


    const canScrollUp = directionValue < 0 && currentRange.topIndex > 0;


    const canScrollDown = directionValue > 0 && currentRange.bottomIndex < maxMasterIndex;


    return canScrollUp || canScrollDown;


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


        const isLocked = store.state.isPitchRangeLocked;





        if (isLocked) {


          // Locked: stay within current slice; allow pixel scroll inside it


          this.scrollByPixels(e.deltaY);


        } else if (this._canScrollRange(scrollDirection)) {


          this.scrollByUnits(scrollDirection);


        } else {


          this.scrollByPixels(e.deltaY);


        }


      }


    }, { passive: false });


  },





  zoomIn() {


    if (isZooming) {return;}


    if (store.state.snapZoomToRange) {


      store.setSnapZoomToRange(false);


    }


    isZooming = true;


    currentZoomLevel = Math.min(MAX_ZOOM_LEVEL, currentZoomLevel * ZOOM_IN_FACTOR);


    logger.debug('LayoutService', `[Zoom] Zoom level: ${Math.round(currentZoomLevel * 100)}%`, null, 'layout');





    // Double RAF to ensure DOM has settled after zoom


    requestAnimationFrame(() => {


      requestAnimationFrame(() => {


        recalcAndApplyLayout();


        isZooming = false;


      });


    });


  },





  zoomOut() {


    if (isZooming) {return;}





    if (store.state.snapZoomToRange) {


      store.setSnapZoomToRange(false);


    }


    isZooming = true;


    // When unlocked: expand range to show more rows
    // When locked: zoom out current range only
    if (!store.state.isPitchRangeLocked) {


      // Unlocked: Try to expand the range to show more rows
      const currentRange = store.state.pitchRange || { topIndex: 0, bottomIndex: masterRowData.length - 1 };

      // Add 2 rows per side for gradual expansion
      const rowsToAddTop = 2;
      const rowsToAddBottom = 2;

      const newTopIndex = Math.max(0, currentRange.topIndex - rowsToAddTop);
      const newBottomIndex = Math.min(masterRowData.length - 1, currentRange.bottomIndex + rowsToAddBottom);

      const canExpandRange = (newTopIndex !== currentRange.topIndex || newBottomIndex !== currentRange.bottomIndex);

      if (canExpandRange) {
        const newRowCount = newBottomIndex - newTopIndex + 1;

        // Expand the range
        store.setPitchRange(
          { topIndex: newTopIndex, bottomIndex: newBottomIndex },
          { trimOutsideRange: false, preserveContent: true }
        );

        // Calculate zoom to fit the new range (maintain "fit to range" behavior)
        const pitchGridContainer = document.getElementById('pitch-grid-container');
        const containerHeight = pitchGridContainer?.clientHeight || (viewportHeight * 0.7);
        const targetZoom = (2 * containerHeight) / (newRowCount * BASE_ABSTRACT_UNIT);
        currentZoomLevel = Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, targetZoom));
      } else {
        // Already at full range - can't expand further, so just apply zoom factor
        currentZoomLevel = Math.max(MIN_ZOOM_LEVEL, currentZoomLevel * ZOOM_OUT_FACTOR);
      }


    } else {


      // Locked: actually zoom out
      const targetZoom = Math.max(MIN_ZOOM_LEVEL, currentZoomLevel * ZOOM_OUT_FACTOR);
      const minZoomLevel = getDynamicMinZoomLevel();
      const clampedZoom = Math.max(minZoomLevel, targetZoom);

      if (clampedZoom !== targetZoom) {
        logger.debug('LayoutService', `[Zoom] Minimum zoom reached (locked); clamping to ${Math.round(clampedZoom * 100)}%`, null, 'layout');
      }

      currentZoomLevel = clampedZoom;
      logger.debug('LayoutService', `[Zoom] Zoom level: ${Math.round(currentZoomLevel * 100)}%`, null, 'layout');


    }





    // Double RAF to ensure DOM has settled after zoom


    requestAnimationFrame(() => {


      requestAnimationFrame(() => {


        recalcAndApplyLayout();


        isZooming = false;


      });


    });


  },





  resetZoom() {


    if (isZooming) {return;}


    if (store.state.snapZoomToRange) {


      store.setSnapZoomToRange(false);


    }


    isZooming = true;


    currentZoomLevel = 1.0;


    logger.debug('LayoutService', '[Zoom] Zoom level reset to 100%', null, 'layout');





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


      logger.debug('LayoutService', `[Zoom] Snap zoom limited by MAX_ZOOM_LEVEL (${Math.round(MAX_ZOOM_LEVEL * 100)}%)`, null, 'layout');


    } else if (zoomChanged) {


      logger.debug('LayoutService', `[Zoom] Snap zoom to range: ${Math.round(currentZoomLevel * 100)}%`, null, 'layout');


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





  setPendingStartRow(row: number | null) {


    if (typeof row === 'number' && Number.isFinite(row)) {


      pendingStartRow = Math.max(0, row);


    } else {


      pendingStartRow = null;


    }


  },





  scroll(deltaY: number) {


    const scrollAmount = (deltaY / viewportHeight) / 4;


    currentScrollPosition = Math.max(0, Math.min(1, currentScrollPosition + scrollAmount));


    store.emit('layoutConfigChanged');


  },





  scrollByUnits(direction: number) {


    // Shift the pitch range by moving topIndex and bottomIndex


    // This scrolls through the master pitch data


    const currentRange = store.state.pitchRange;


    if (!currentRange || !masterRowData || masterRowData.length === 0) {return;}


    if (store.state.isPitchRangeLocked) {


      return;


    }





    const newTopIndex = currentRange.topIndex + direction;


    const newBottomIndex = currentRange.bottomIndex + direction;


    const maxMasterIndex = masterRowData.length - 1;





    // Clamp to valid range in master data


    if (newTopIndex < 0 || newBottomIndex > maxMasterIndex) {


      return; // Can't scroll further


    }





    // Update pitch range while maintaining the same range size


    store.setPitchRange({
      topIndex: newTopIndex,
      bottomIndex: newBottomIndex
    }, { trimOutsideRange: false, preserveContent: true });


  },





  scrollByPixels(deltaY: number, _deltaX = 0) {


    const totalRanks = store.state.fullRowData.length;


    const baseRankHeight = store.state.cellHeight || BASE_ABSTRACT_UNIT;


    const rankHeight = baseRankHeight * currentZoomLevel;


    const fullVirtualHeight = totalRanks * rankHeight;


    const paddedVirtualHeight = fullVirtualHeight;


    const scrollableDist = Math.max(0, paddedVirtualHeight - viewportHeight);





    if (scrollableDist > 0) {


      const scrollDelta = deltaY / scrollableDist;


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





  getMacrobeatWidthPx(state: any, grouping: number) {


    return grouping * state.cellWidth;


  },





  getColumnX(index: number) {
    const result = getColumnXFromColumns(index, store.state.columnWidths, store.state.cellWidth);
    return result;


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


      const cellWidth = store.state.cellWidth || 40;
      const columnWidths = store.state.columnWidths || [];  // Canvas-space after Phase 8

      const renderOptions = {
        cellWidth,
        columnWidths,
        modulationMarkers: store.state.modulationMarkers,
        baseMicrobeatPx: cellWidth,
        cellHeight: store.state.cellHeight || 40,
        state: store.state
      };

      // Get total pixel width from pixelMapService (includes modulation)
      const modulatedMusicalWidth = getTotalPixelWidth(renderOptions);

      // After Phase 8: This function returns MUSICAL width only (no legends)
      return modulatedMusicalWidth;





    } catch {
      return baseWidth;


    }


  },





  recalculateLayout() {


    recalcAndApplyLayout();


  },





  reflow() {


    recalcAndApplyLayout();


  },





  get isZooming() {


    return isZooming;


  }


};





export default LayoutService;



