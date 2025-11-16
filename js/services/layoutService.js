// js/services/layoutService.js
import store from '@state/index.js';
import logger from '@utils/logger.js';
import {
  DEFAULT_SCROLL_POSITION, GRID_WIDTH_RATIO,  BASE_DRUM_ROW_HEIGHT,
  DRUM_HEIGHT_SCALE_FACTOR, DRUM_ROW_COUNT,
  MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL, ZOOM_IN_FACTOR, ZOOM_OUT_FACTOR, RESIZE_DEBOUNCE_DELAY
} from '@/core/constants.js';
import { calculateColumnWidths, getColumnX as getColumnXFromColumns, getCanvasWidth as getCanvasWidthFromColumns } from './columnsLayout.js';
import { fullRowData as masterRowData } from '@state/pitchData.js';

// Pure abstract units - independent of container size
const BASE_ABSTRACT_UNIT = 30;  // Fixed abstract unit size in pixels

let currentZoomLevel = 1.0;
let currentScrollPosition = DEFAULT_SCROLL_POSITION;

let viewportHeight = 0;
let /* gridContainer, */ pitchGridWrapper, canvas, ctx, drumGridWrapper, drumCanvas, drumCtx, drumPlayheadCanvas, playheadCanvas, hoverCanvas, drumHoverCanvas, pitchPaintCanvas, buttonGridWrapper, gridScrollbarProxy, gridScrollbarInner;
let resizeTimeout;
let isRecalculating = false;
let isZooming = false;
// let lastCalculatedWidth = 0;  // Unused variable
let lastCalculatedDrumHeight = 0;
let lastCalculatedButtonGridHeight = 0;
let pendingSnapToRange = false;
let pendingStartRow = null;
let pitchGridNotReadyLogged = false;
let beatLineWidthWarningShown = false;

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

function resizeCanvasForPixelRatio(canvasElement, logicalWidth, logicalHeight, pixelRatio, existingContext = null) {
  if (!canvasElement) {
    return false;
  }
  const normalizedRatio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  canvasElement.dataset.pixelRatio = `${normalizedRatio}`;

  let resized = false;

  if (typeof logicalWidth === 'number') {
    const targetWidth = Math.max(1, Math.round(logicalWidth * normalizedRatio));
    if (Math.abs(canvasElement.width - targetWidth) > 0.5) {
      canvasElement.width = targetWidth;
      resized = true;
    }
    canvasElement.style.width = `${logicalWidth}px`;
    canvasElement.dataset.logicalWidth = `${logicalWidth}`;
  }

  if (typeof logicalHeight === 'number') {
    const targetHeight = Math.max(1, Math.round(logicalHeight * normalizedRatio));
    if (Math.abs(canvasElement.height - targetHeight) > 0.5) {
      canvasElement.height = targetHeight;
      resized = true;
    }
    canvasElement.style.height = `${logicalHeight}px`;
    canvasElement.dataset.logicalHeight = `${logicalHeight}`;
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
  canvas = document.getElementById('notation-grid');
  drumGridWrapper = document.getElementById('drum-grid-wrapper');
  drumCanvas = document.getElementById('drum-grid');
  drumPlayheadCanvas = document.getElementById('drum-playhead-canvas');
  playheadCanvas = document.getElementById('playhead-canvas');
  hoverCanvas = document.getElementById('hover-canvas');
  drumHoverCanvas = document.getElementById('drum-hover-canvas');
  pitchPaintCanvas = document.getElementById('pitch-paint-canvas');
  buttonGridWrapper = document.getElementById('button-grid');
  gridScrollbarProxy = document.getElementById('grid-scrollbar-proxy');
  gridScrollbarInner = gridScrollbarProxy?.querySelector('.grid-scrollbar-inner') || null;

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
  const containerWidth = pitchGridWrapper.clientWidth;
  const windowHeight = window.innerHeight;
  const referenceDiff = Math.abs(windowHeight - viewportHeight);

  if (referenceDiff > 3 || viewportHeight === 0) {
    viewportHeight = windowHeight;
  }

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

  if (!store.state.cellWidth || !newColumnWidths.length) {
    logger.warn('LayoutService', 'Unexpected layout configuration', {
      cellWidth: store.state.cellWidth,
      columnCount: newColumnWidths.length
    }, 'layout');
  }

  const totalWidthUnits = newColumnWidths.reduce((sum, w) => sum + w, 0);
  const totalCanvasWidth = totalWidthUnits * store.state.cellWidth;
  const modulatedCanvasWidth = LayoutService.getModulatedCanvasWidth();
  const finalCanvasWidth = modulatedCanvasWidth > totalCanvasWidth ? modulatedCanvasWidth : totalCanvasWidth;
  const totalCanvasWidthPx = Math.round(finalCanvasWidth);
  const pixelRatio = getDevicePixelRatio();

  const drumGridWrapper = document.getElementById('drum-grid-wrapper');
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
  const columnWidthsCount = store.state.columnWidths?.length ?? 0;
  const middleCellStart = 2; // Skip first 2 legend columns on left
  const middleCellEnd = columnWidthsCount - 2; // Exclude right legend columns
  let middleCellWidth = 0;
  for (let i = middleCellStart; i < middleCellEnd; i++) {
    middleCellWidth += (store.state.columnWidths[i] || 0) * store.state.cellWidth;
  }
  if (columnWidthsCount <= 4) {
    logger.warn('LayoutService', 'Column widths array does not contain interior columns.', {
      columnWidthsCount,
      columnWidths: store.state.columnWidths
    }, 'layout');
  }
  if (middleCellWidth < 50 && columnWidthsCount > 4) {
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
    const leftCellWidth = store.state.columnWidths.slice(0, 2).reduce((sum, w) => sum + w * store.state.cellWidth, 0);

    // Calculate right legend width (last 2 columns)
    const rightCellWidth = store.state.columnWidths.slice(-2).reduce((sum, w) => sum + w * store.state.cellWidth, 0);

    const buttonGridHeightChanged = Math.abs(lastCalculatedButtonGridHeight - buttonGridHeight) > 5;
    const shouldUpdateButtonGridHeight = buttonGridHeightChanged || lastCalculatedButtonGridHeight === 0;

    if (shouldUpdateButtonGridHeight) {
      buttonGridWrapper.style.height = buttonGridHeightPx;
      lastCalculatedButtonGridHeight = buttonGridHeight;
    }

    const applyCellSizing = (cell, widthPx) => {
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

  const pitchCanvasTargets = [
    { element: canvas, context: ctx },
    { element: playheadCanvas },
    { element: hoverCanvas },
    { element: pitchPaintCanvas }
  ];

  pitchCanvasTargets.forEach(({ element, context }) => {
    resizeCanvasForPixelRatio(element, totalCanvasWidthPx, undefined, pixelRatio, context);
  });

  const drumCanvasTargets = [
    { element: drumCanvas, context: drumCtx },
    { element: drumPlayheadCanvas },
    { element: drumHoverCanvas }
  ];

  drumCanvasTargets.forEach(({ element, context }) => {
    resizeCanvasForPixelRatio(element, totalCanvasWidthPx, drumCanvasHeight, pixelRatio, context);
  });

  const drumHeightChanged = Math.abs(lastCalculatedDrumHeight - drumCanvasHeight) > 5;
  const shouldUpdateDrumHeight = drumGridWrapper && (drumHeightChanged || lastCalculatedDrumHeight === 0);

  if (shouldUpdateDrumHeight) {
    drumGridWrapper.style.height = drumHeightPx;
    lastCalculatedDrumHeight = drumCanvasHeight;
  }

  const scheduledPixelRatio = pixelRatio;
  const scheduledPitchWidth = totalCanvasWidthPx;

  setTimeout(() => {
    const finalPitchGridContainer = document.getElementById('pitch-grid-container');
    const finalContainerHeight = finalPitchGridContainer.clientHeight;

    pitchCanvasTargets.forEach(({ element, context }) => {
      resizeCanvasForPixelRatio(element, scheduledPitchWidth, finalContainerHeight, scheduledPixelRatio, context);
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

  getCurrentZoomLevel() {
    return currentZoomLevel;
  },

  setZoomLevel(newZoom) {
    currentZoomLevel = newZoom;
    recalcAndApplyLayout();
  },

  _canScrollRange(direction) {
    const currentRange = store.state.pitchRange;
    if (!currentRange || !masterRowData || masterRowData.length === 0) {return false;}
    const maxMasterIndex = masterRowData.length - 1;
    const canScrollUp = direction < 0 && currentRange.topIndex > 0;
    const canScrollDown = direction > 0 && currentRange.bottomIndex < maxMasterIndex;
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
    const minZoomLevel = getDynamicMinZoomLevel();
    const targetZoom = Math.max(MIN_ZOOM_LEVEL, currentZoomLevel * ZOOM_OUT_FACTOR);
    const clampedZoom = Math.max(minZoomLevel, targetZoom);
    if (clampedZoom !== targetZoom) {
      logger.debug('LayoutService', `[Zoom] Minimum zoom reached; clamping to ${Math.round(clampedZoom * 100)}%`, null, 'layout');
    }
    currentZoomLevel = clampedZoom;
    logger.debug('LayoutService', `[Zoom] Zoom level: ${Math.round(currentZoomLevel * 100)}%`, null, 'layout');

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
    });
  },

  scrollByPixels(deltaY, deltaX = 0) {
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


