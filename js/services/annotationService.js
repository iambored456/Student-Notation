// js/services/annotationService.js
import store from '@state/index.js';
import logger from '@utils/logger.js';
import { getColumnFromX, getRowFromY, getColumnX, getRowY } from '@components/canvas/pitchGrid/renderers/rendererUtils.js';
import PitchGridController from '@components/canvas/pitchGrid/pitchGrid.js';
import { isPointInPolygon, calculateConvexHull, isPointNearHull, polygonIntersectsEllipse, polygonIntersectsRect } from '@utils/geometryUtils.js';

logger.moduleLoaded('AnnotationService', 'annotation');

class AnnotationService {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    // Note: annotations are now stored in store.state.annotations
    this.currentTool = null;
    this.isDrawing = false;
    this.currentPath = [];
    this.startPoint = null;
    this.tempAnnotation = null;
    this.selectedAnnotation = null;
    this.hoverAnnotation = null;
    this.eraserCursor = null;
    this.isDragging = false;
    this.dragOffset = null;
    this.isResizing = false;
    this.resizeHandle = null; // 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'
    this.resizeStartBounds = null;

    // Lasso selection state
    this.isDraggingSelection = false;
    this.selectionDragStart = null;
    this.selectionDragTotal = null; // Track total movement to avoid accumulation errors
  }

  initialize() {
    // Use pitch grid canvas for event handling (annotations render on pitch grid now)
    this.canvas = document.getElementById('notation-grid');
    if (!this.canvas) {
      logger.error('AnnotationService', 'Pitch grid canvas not found', null, 'annotation');
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.setupEventListeners();

    // Listen to store changes for undo/redo support
    store.on('annotationsChanged', () => {
      this.selectedAnnotation = null;
      this.render();
    });

    logger.initSuccess('AnnotationService');
  }

  setupEventListeners() {
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent context menu

    // Add keyboard listener for delete/backspace
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  handleKeyDown(e) {
    // Only handle delete/backspace if an annotation is selected
    if (!this.selectedAnnotation) {return;}

    // Check if we're in a text input (don't delete annotation if typing)
    const activeElement = document.activeElement;
    const isEditable = activeElement.contentEditable === 'true';
    const tagName = activeElement.tagName.toLowerCase();
    if (['input', 'textarea'].includes(tagName) || isEditable) {
      return;
    }

    // Delete or Backspace key
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault(); // Prevent browser back navigation on Backspace
      this.deleteSelectedAnnotation();
    }
  }

  deleteSelectedAnnotation() {
    if (!this.selectedAnnotation) {return;}

    // Find and remove the selected annotation
    const index = store.state.annotations.indexOf(this.selectedAnnotation);
    if (index > -1) {
      store.state.annotations.splice(index, 1);
      this.selectedAnnotation = null;
      store.recordState();
      this.render();
      logger.log('AnnotationService', 'Deleted annotation', 'annotation');
    }
  }

  resize() {
    if (!this.canvas) {return;}

    const notationGrid = document.getElementById('notation-grid');
    if (notationGrid) {
      this.canvas.width = notationGrid.width;
      this.canvas.height = notationGrid.height;
      this.render();
    }
  }

  /**
     * Helper to get render options for coordinate conversion
     */
  getRenderOptions() {
    return {
      columnWidths: store.state.columnWidths,
      cellWidth: store.state.cellWidth,
      cellHeight: store.state.cellHeight,
      modulationMarkers: store.state.modulationMarkers,
      baseMicrobeatPx: store.state.cellWidth
    };
  }

  /**
     * Convert canvas pixel coordinates to grid coordinates
     */
  canvasToGrid(canvasX, canvasY) {
    const options = this.getRenderOptions();
    return {
      col: getColumnFromX(canvasX, options),
      row: getRowFromY(canvasY, options)
    };
  }

  /**
     * Convert grid coordinates to canvas pixel coordinates
     */
  gridToCanvas(col, row) {
    const options = this.getRenderOptions();
    return {
      x: getColumnX(col, options),
      y: getRowY(row, options)
    };
  }

  setTool(toolName, settings) {
    this.currentTool = toolName;
    this.toolSettings = settings;

    // Update cursor based on tool
    if (this.canvas) {
      switch (toolName) {
        case 'arrow':
        case 'text':
          this.canvas.style.cursor = 'crosshair';
          break;
        case 'marker':
        case 'highlighter':
          this.canvas.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\'><circle cx=\'8\' cy=\'8\' r=\'4\' fill=\'rgba(0,0,0,0.5)\'/></svg>") 8 8, crosshair';
          break;
        case 'lasso':
          this.canvas.style.cursor = 'crosshair';
          break;
        default:
          this.canvas.style.cursor = 'default';
      }
    }
  }

  handleMouseDown(e) {
    if (!this.currentTool || !this.toolSettings) {return;}

    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // Convert canvas pixels to grid coordinates
    const gridCoords = this.canvasToGrid(canvasX, canvasY);

    // Right-click behavior depends on current tool
    if (e.button === 2) {
      // If lasso tool is active and there's a selection, remove clicked item from selection
      if (this.currentTool === 'lasso' && store.state.lassoSelection?.isActive) {
        this.removeFromLassoSelection(canvasX, canvasY);
        return;
      }

      // Otherwise, activate temporary eraser mode
      this.tempEraserMode = true;
      this.isDrawing = true;
      this.eraseAtPoint(canvasX, canvasY);
      this.showEraserCursor(canvasX, canvasY);
      return;
    }

    // Check for resize handle on selected text annotation
    if (this.selectedAnnotation && this.selectedAnnotation.type === 'text') {
      const handle = this.getResizeHandleAt(canvasX, canvasY, this.selectedAnnotation);
      if (handle) {
        this.isResizing = true;
        this.resizeHandle = handle;
        this.resizeStartBounds = {
          col: this.selectedAnnotation.col,
          row: this.selectedAnnotation.row,
          widthCols: this.selectedAnnotation.widthCols,
          heightRows: this.selectedAnnotation.heightRows,
          mouseCol: gridCoords.col,
          mouseRow: gridCoords.row
        };
        return;
      }
    }

    // Check if clicking on lasso selection to drag it
    if (store.state.lassoSelection?.isActive && store.state.lassoSelection.convexHull) {
      const isNearHull = isPointNearHull({ x: canvasX, y: canvasY }, store.state.lassoSelection.convexHull, 10);
      const isInsideHull = isPointInPolygon({ x: canvasX, y: canvasY }, store.state.lassoSelection.convexHull);

      if (isNearHull || isInsideHull) {
        this.isDraggingSelection = true;
        // Store original mouse position in canvas pixels
        this.selectionDragStart = {
          canvasX,
          canvasY
        };
        // Track total movement applied
        this.selectionDragTotal = {
          col: 0,
          row: 0
        };
        return;
      }
    }

    // Check for selection - single click selects text/arrow annotations
    const clicked = this.getAnnotationAt(canvasX, canvasY);
    if (clicked && (clicked.type === 'arrow' || clicked.type === 'text')) {
      // If clicking on already selected annotation, start dragging
      if (this.selectedAnnotation === clicked) {
        this.isDragging = true;
        if (clicked.type === 'arrow') {
          this.dragOffset = {
            startCol: gridCoords.col - clicked.startCol,
            startRow: gridCoords.row - clicked.startRow,
            endCol: gridCoords.col - clicked.endCol,
            endRow: gridCoords.row - clicked.endRow
          };
        } else if (clicked.type === 'text') {
          this.dragOffset = {
            col: gridCoords.col - clicked.col,
            row: gridCoords.row - clicked.row
          };
        }
        return;
      }

      // Otherwise, select the annotation
      this.selectedAnnotation = clicked;
      this.loadAnnotationSettings(clicked);
      this.render();
      return;
    } else {
      this.selectedAnnotation = null;
    }

    this.isDrawing = true;
    this.startPoint = gridCoords;
    this.currentPath = [gridCoords];

    switch (this.currentTool) {
      case 'arrow':
        this.tempAnnotation = {
          type: 'arrow',
          startCol: gridCoords.col,
          startRow: gridCoords.row,
          endCol: gridCoords.col,
          endRow: gridCoords.row,
          settings: { ...this.toolSettings.arrow }
        };
        break;
      case 'text':
        // Create temporary text box annotation for drag preview
        this.tempAnnotation = {
          type: 'text',
          startCol: gridCoords.col,
          startRow: gridCoords.row,
          endCol: gridCoords.col,
          endRow: gridCoords.row
        };
        break;
      case 'marker':
      case 'highlighter':
        this.tempAnnotation = {
          type: this.currentTool,
          path: [gridCoords],
          settings: { ...this.toolSettings[this.currentTool] }
        };
        break;
      case 'lasso':
        this.tempAnnotation = {
          type: 'lasso',
          path: [{ x: canvasX, y: canvasY }]
        };
        break;
    }
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // Convert to grid coordinates
    const gridCoords = this.canvasToGrid(canvasX, canvasY);

    // Handle eraser mode
    if (this.tempEraserMode) {
      this.eraseAtPoint(canvasX, canvasY);
      this.showEraserCursor(canvasX, canvasY);
      return;
    }

    // Handle resizing text annotation
    if (this.isResizing && this.selectedAnnotation && this.selectedAnnotation.type === 'text') {
      const dCol = gridCoords.col - this.resizeStartBounds.mouseCol;
      const dRow = gridCoords.row - this.resizeStartBounds.mouseRow;

      let newCol = this.resizeStartBounds.col;
      let newRow = this.resizeStartBounds.row;
      let newWidthCols = this.resizeStartBounds.widthCols;
      let newHeightRows = this.resizeStartBounds.heightRows;

      // Apply resize based on handle position
      if (this.resizeHandle.includes('n')) {
        newRow = this.resizeStartBounds.row + dRow;
        newHeightRows = this.resizeStartBounds.heightRows - dRow;
      }
      if (this.resizeHandle.includes('s')) {
        newHeightRows = this.resizeStartBounds.heightRows + dRow;
      }
      if (this.resizeHandle.includes('w')) {
        newCol = this.resizeStartBounds.col + dCol;
        newWidthCols = this.resizeStartBounds.widthCols - dCol;
      }
      if (this.resizeHandle.includes('e')) {
        newWidthCols = this.resizeStartBounds.widthCols + dCol;
      }

      // Enforce minimum dimensions (in grid units)
      const minWidthCols = 2;
      const minHeightRows = 1;
      if (newWidthCols < minWidthCols) {
        if (this.resizeHandle.includes('w')) {
          newCol = this.resizeStartBounds.col + this.resizeStartBounds.widthCols - minWidthCols;
        }
        newWidthCols = minWidthCols;
      }
      if (newHeightRows < minHeightRows) {
        if (this.resizeHandle.includes('n')) {
          newRow = this.resizeStartBounds.row + this.resizeStartBounds.heightRows - minHeightRows;
        }
        newHeightRows = minHeightRows;
      }

      this.selectedAnnotation.col = newCol;
      this.selectedAnnotation.row = newRow;
      this.selectedAnnotation.widthCols = newWidthCols;
      this.selectedAnnotation.heightRows = newHeightRows;

      this.render();
      return;
    }

    // Handle dragging lasso selection
    if (this.isDraggingSelection && this.selectionDragStart) {
      const options = this.getRenderOptions();

      // Calculate pixel delta from original start position
      const dPixelX = canvasX - this.selectionDragStart.canvasX;
      const dPixelY = canvasY - this.selectionDragStart.canvasY;

      // Convert pixel delta to grid steps (discrete)
      // Note: Rows use half-height spacing (dual-parity system)
      const dCol = Math.round(dPixelX / options.cellWidth);
      const dRow = Math.round(dPixelY / (options.cellHeight / 2));

      // Calculate what movement we need to apply (difference from already applied)
      const movementNeeded = {
        col: dCol - this.selectionDragTotal.col,
        row: dRow - this.selectionDragTotal.row
      };

      // Only update if there's actual new movement
      if (movementNeeded.col !== 0 || movementNeeded.row !== 0) {
        // Move all selected items by the needed amount
        store.state.lassoSelection.selectedItems.forEach(item => {
          if (item.type === 'note') {
            item.data.row += movementNeeded.row;
            const colIndex = item.data.columnIndex !== undefined ? 'columnIndex' : 'startColumnIndex';
            item.data[colIndex] += movementNeeded.col;
            if (item.data.endColumnIndex !== undefined) {
              item.data.endColumnIndex += movementNeeded.col;
            }
          } else if (item.type === 'stamp') {
            item.data.row += movementNeeded.row;
            item.data.startColumn += movementNeeded.col;
            item.data.endColumn += movementNeeded.col;
          } else if (item.type === 'triplet') {
            item.data.row += movementNeeded.row;
            item.data.column += movementNeeded.col;
          }
        });

        // Update total movement applied
        this.selectionDragTotal.col = dCol;
        this.selectionDragTotal.row = dRow;

        // Recalculate convex hull from updated positions
        const points = store.state.lassoSelection.selectedItems.map(item => {
          const colIndex = item.data.columnIndex !== undefined ? item.data.columnIndex :
            item.data.startColumnIndex !== undefined ? item.data.startColumnIndex :
              item.data.column;
          const x = getColumnX(colIndex, options);
          const y = getRowY(item.data.row, options);
          return { x, y };
        });
        store.state.lassoSelection.convexHull = calculateConvexHull(points);

        this.render();
      }
      return;
    }

    // Handle dragging selected annotation
    if (this.isDragging && this.selectedAnnotation) {
      if (this.selectedAnnotation.type === 'arrow') {
        this.selectedAnnotation.startCol = gridCoords.col - this.dragOffset.startCol;
        this.selectedAnnotation.startRow = gridCoords.row - this.dragOffset.startRow;
        this.selectedAnnotation.endCol = gridCoords.col - this.dragOffset.endCol;
        this.selectedAnnotation.endRow = gridCoords.row - this.dragOffset.endRow;
      } else if (this.selectedAnnotation.type === 'text') {
        this.selectedAnnotation.col = gridCoords.col - this.dragOffset.col;
        this.selectedAnnotation.row = gridCoords.row - this.dragOffset.row;
      }
      this.render();
      return;
    }

    // Handle hover detection when not drawing
    if (!this.isDrawing) {
      this.updateHover(canvasX, canvasY);
      return;
    }

    if (!this.tempAnnotation) {return;}

    switch (this.currentTool) {
      case 'arrow':
        this.tempAnnotation.endCol = gridCoords.col;
        this.tempAnnotation.endRow = gridCoords.row;
        this.render();
        break;
      case 'text':
        this.tempAnnotation.endCol = gridCoords.col;
        this.tempAnnotation.endRow = gridCoords.row;
        this.render();
        break;
      case 'marker':
      case 'highlighter':
        // Interpolate points for smooth continuous path
        if (this.tempAnnotation.path.length > 0) {
          const lastPoint = this.tempAnnotation.path[this.tempAnnotation.path.length - 1];
          const interpolated = this.interpolatePoints(lastPoint, gridCoords);
          this.tempAnnotation.path.push(...interpolated);
        } else {
          this.tempAnnotation.path.push(gridCoords);
        }
        this.render();
        break;
      case 'lasso':
        this.tempAnnotation.path.push({ x: canvasX, y: canvasY }); // Lasso still uses pixels for now
        this.render();
        break;
    }
  }

  handleMouseUp() {
    // Stop resizing
    if (this.isResizing) {
      this.isResizing = false;
      this.resizeHandle = null;
      this.resizeStartBounds = null;
      store.recordState();
      return;
    }

    // Stop dragging lasso selection
    if (this.isDraggingSelection) {
      this.isDraggingSelection = false;
      this.selectionDragStart = null;
      this.selectionDragTotal = null;
      store.recordState();
      return;
    }

    // Stop dragging
    if (this.isDragging) {
      this.isDragging = false;
      this.dragOffset = null;
      store.recordState();
      return;
    }

    if (!this.isDrawing) {return;}

    this.isDrawing = false;

    // Exit temporary eraser mode
    if (this.tempEraserMode) {
      this.tempEraserMode = false;
      this.render(); // Clear the eraser cursor
      return;
    }

    if (this.tempAnnotation) {
      // Handle text tool - open text input after drag
      if (this.currentTool === 'text') {
        const { startCol, startRow, endCol, endRow } = this.tempAnnotation;
        const widthCols = Math.abs(endCol - startCol);
        const heightRows = Math.abs(endRow - startRow);
        const col = Math.min(startCol, endCol);
        const row = Math.min(startRow, endRow);

        // Only create text input if user dragged (minimum size)
        if (widthCols > 0.5 && heightRows > 0.2) {
          this.createTextAnnotation(col, row, widthCols, heightRows);
        }
        this.tempAnnotation = null;
        this.render();
        return;
      }

      // Add completed annotation to list
      if (this.currentTool === 'lasso') {
        // Process lasso selection
        this.handleLassoSelection();
      } else {
        store.state.annotations.push(this.tempAnnotation);
        // Auto-select arrows after placement
        if (this.currentTool === 'arrow') {
          this.selectedAnnotation = this.tempAnnotation;
        }
        store.recordState();
      }
      this.tempAnnotation = null;
      this.render();
    }
  }

  handleMouseLeave(e) {
    if (this.isDrawing) {
      this.handleMouseUp(e);
    }
  }

  handleDoubleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if double-clicking on a text annotation
    const clicked = this.getAnnotationAt(x, y);
    if (clicked && clicked.type === 'text') {
      this.editTextAnnotation(clicked);
    }
  }

  editTextAnnotation(annotation) {
    // Open text editor for existing annotation
    const { col, row, widthCols, heightRows, text, settings } = annotation;

    // Temporarily remove from annotations array
    const index = store.state.annotations.indexOf(annotation);
    if (index > -1) {
      store.state.annotations.splice(index, 1);
      this.selectedAnnotation = null;
      this.render();
    }

    // Create editable text input with existing text
    this.createTextAnnotation(col, row, widthCols, heightRows, text, settings);
  }

  createTextAnnotation(col, row, widthCols, heightRows, existingText = null, existingSettings = null) {
    this.isDrawing = false;

    // Convert grid coordinates to canvas pixels for positioning the text input
    const gridPos = this.gridToCanvas(col, row);
    const gridEnd = this.gridToCanvas(col + widthCols, row + heightRows);
    const x = gridPos.x;
    const y = gridPos.y;
    const width = gridEnd.x - x;
    const height = gridEnd.y - y;

    // Get the actual font family from CSS variable (same as canvas)
    const computedStyle = window.getComputedStyle(document.documentElement);
    const mainFont = computedStyle.getPropertyValue('--main-font').trim() || '"Atkinson Hyperlegible", Arial, sans-serif';

    // Use existing settings if editing, otherwise use current tool settings
    const settings = existingSettings || this.toolSettings.text;

    // Create text input overlay
    const input = document.createElement('div');
    input.contentEditable = true;
    input.className = 'annotation-text-input';
    input.textContent = existingText || 'Type here...';
    const fontSize = settings.size;
    const lineHeight = fontSize * 1.2;

    input.style.width = `${width}px`;
    input.style.height = `${height}px`;
    input.style.padding = settings.background ? '4px 8px' : '4px';
    input.style.border = '2px dashed rgba(74, 144, 226, 0.5)';
    input.style.backgroundColor = settings.background ? '#ffffff' : 'transparent';
    input.style.color = settings.color;
    input.style.fontSize = `${fontSize}px`;
    input.style.lineHeight = `${lineHeight}px`;
    input.style.fontWeight = settings.bold ? 'bold' : 'normal';
    input.style.fontStyle = settings.italic ? 'italic' : 'normal';
    input.style.textDecoration = settings.underline ? 'underline' : 'none';

    // Apply superscript/subscript styling
    if (settings.superscript) {
      input.style.fontSize = `${fontSize * 0.6}px`;
      input.style.verticalAlign = 'super';
    } else if (settings.subscript) {
      input.style.fontSize = `${fontSize * 0.6}px`;
      input.style.verticalAlign = 'sub';
    }

    input.style.outline = 'none';
    input.style.zIndex = '10000';
    input.style.position = 'fixed';
    input.style.cursor = 'text';
    input.style.pointerEvents = 'auto';
    input.style.fontFamily = mainFont;
    input.style.whiteSpace = 'pre-wrap';
    input.style.wordWrap = 'break-word';
    input.style.overflow = 'hidden';
    input.style.boxSizing = 'border-box';

    const canvasRect = this.canvas.getBoundingClientRect();
    input.style.left = `${canvasRect.left + x}px`;
    input.style.top = `${canvasRect.top + y}px`;

    document.body.appendChild(input);
    input.focus();

    // Select all placeholder text on focus
    const range = document.createRange();
    range.selectNodeContents(input);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    let finished = false;
    const finishText = () => {
      if (finished) {return;}
      finished = true;

      const text = input.textContent.trim();
      // Don't save if empty or just placeholder
      if (text && text !== 'Type here...') {
        const annotation = {
          type: 'text',
          col,
          row,
          widthCols,
          heightRows,
          text,
          settings: { ...settings }
        };
        store.state.annotations.push(annotation);
        this.selectedAnnotation = store.state.annotations[store.state.annotations.length - 1];
        store.recordState();
        this.render();
      }
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    };

    // Clear placeholder on first input
    let placeholderCleared = false;
    input.addEventListener('input', () => {
      if (!placeholderCleared && input.textContent === 'Type here...') {
        input.textContent = '';
        placeholderCleared = true;
      }
    });

    // Delay blur listener to prevent immediate firing
    setTimeout(() => {
      input.addEventListener('blur', finishText);
    }, 100);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finishText();
      }
      if (e.key === 'Escape') {
        finished = true;
        if (document.body.contains(input)) {
          document.body.removeChild(input);
        }
      }
    });
  }

  handleLassoSelection() {
    if (!this.tempAnnotation || !this.tempAnnotation.path) {return;}

    const lassoPath = this.tempAnnotation.path;
    const selectedItems = [];
    const options = this.getRenderOptions();


    // Check if Shift is held to add to selection
    const isAdditive = window.event && window.event.shiftKey;

    // If additive, start with existing selection
    if (isAdditive && store.state.lassoSelection.selectedItems) {
      selectedItems.push(...store.state.lassoSelection.selectedItems);
    }

    // Check all placed notes (check shape intersection, not just center point)
    store.state.placedNotes.forEach((note, index) => {
      // Skip drum notes
      if (note.isDrum) {return;}

      const colIndex = note.columnIndex !== undefined ? note.columnIndex : note.startColumnIndex;
      const xStart = getColumnX(colIndex, options);
      const baseY = getRowY(note.row, options);

      // Calculate note dimensions (matching notes.js rendering logic)
      const { cellWidth, cellHeight } = options;
      let actualCellWidth = cellWidth;
      if (options.modulationMarkers && options.modulationMarkers.length > 0) {
        const nextX = getColumnX(colIndex + 1, options);
        actualCellWidth = nextX - xStart;
      }

      // Calculate note bounds as an ellipse (both oval and filled shapes are elliptical)
      const centerX = note.shape === 'oval' ? xStart + actualCellWidth : xStart + (actualCellWidth / 2);
      const centerY = baseY;
      const rx = note.shape === 'oval' ? actualCellWidth : actualCellWidth / 2;
      const ry = cellHeight / 2;


      // Check if polygon intersects with the note's ellipse
      if (polygonIntersectsEllipse(lassoPath, { centerX, centerY, rx, ry })) {
        const id = `note-${note.row}-${colIndex}-${note.color}-${note.shape}`;
        if (!selectedItems.find(item => item.id === id)) {
          selectedItems.push({
            type: 'note',
            id,
            data: note,
            index
          });
        }
      }
    });

    // Check all stamp placements (check bounding rectangle)
    store.state.stampPlacements.forEach((stamp, index) => {
      const { cellWidth, cellHeight } = options;

      // Stamps span 2 microbeats (from stamp renderer logic)
      const stampX = getColumnX(stamp.startColumn, options);
      const stampY = getRowY(stamp.row, options) - (cellHeight / 2);
      const stampWidth = cellWidth * 2;
      const stampHeight = cellHeight;

      // Check if polygon intersects with the stamp's rectangle
      if (polygonIntersectsRect(lassoPath, { x: stampX, y: stampY, width: stampWidth, height: stampHeight })) {
        const id = `stamp-${stamp.row}-${stamp.startColumn}-${stamp.stampId}`;
        if (!selectedItems.find(item => item.id === id)) {
          selectedItems.push({
            type: 'stamp',
            id,
            data: stamp,
            index
          });
        }
      }
    });

    // Check all triplet placements (check bounding rectangle)
    store.state.tripletPlacements.forEach((triplet, index) => {
      const { cellWidth, cellHeight } = options;

      // Triplets also span 2 microbeats (matching stamps logic)
      const tripletX = getColumnX(triplet.column, options);
      const tripletY = getRowY(triplet.row, options) - (cellHeight / 2);
      const tripletWidth = cellWidth * 2;
      const tripletHeight = cellHeight;

      // Check if polygon intersects with the triplet's rectangle
      if (polygonIntersectsRect(lassoPath, { x: tripletX, y: tripletY, width: tripletWidth, height: tripletHeight })) {
        const id = `triplet-${triplet.row}-${triplet.column}-${triplet.tripletId}`;
        if (!selectedItems.find(item => item.id === id)) {
          selectedItems.push({
            type: 'triplet',
            id,
            data: triplet,
            index
          });
        }
      }
    });


    // Calculate convex hull if we have selected items
    let convexHull = null;
    if (selectedItems.length > 0) {
      const points = selectedItems.map(item => {
        const colIndex = item.data.columnIndex !== undefined ? item.data.columnIndex :
          item.data.startColumnIndex !== undefined ? item.data.startColumnIndex :
            item.data.column;
        const x = getColumnX(colIndex, options);
        const y = getRowY(item.data.row, options);
        return { x, y };
      });
      convexHull = calculateConvexHull(points);
    }

    // Update store with selection
    store.state.lassoSelection = {
      selectedItems,
      convexHull,
      isActive: selectedItems.length > 0
    };

    // Record state for undo/redo
    store.recordState();

    logger.log('AnnotationService', `Lasso selection completed: ${selectedItems.length} items selected`, 'annotation');
    this.render();
  }

  updateLassoConvexHull() {
    // Only update if there's an active lasso selection
    if (!store.state.lassoSelection?.isActive || !store.state.lassoSelection.selectedItems?.length) {
      return;
    }

    const options = this.getRenderOptions();

    // Recalculate convex hull from current item positions
    const points = store.state.lassoSelection.selectedItems.map(item => {
      const colIndex = item.data.columnIndex !== undefined ? item.data.columnIndex :
        item.data.startColumnIndex !== undefined ? item.data.startColumnIndex :
          item.data.column;
      const x = getColumnX(colIndex, options);
      const y = getRowY(item.data.row, options);
      return { x, y };
    });

    store.state.lassoSelection.convexHull = calculateConvexHull(points);
  }

  removeFromLassoSelection(canvasX, canvasY) {
    if (!store.state.lassoSelection?.isActive) {return;}

    const options = this.getRenderOptions();
    const threshold = 15; // pixels

    // Find which item was clicked
    let clickedItemId = null;

    // Check notes
    store.state.placedNotes.forEach(note => {
      const centerX = getColumnX(note.columnIndex, options);
      const centerY = getRowY(note.row, options);
      const dist = Math.hypot(canvasX - centerX, canvasY - centerY);

      if (dist <= threshold) {
        clickedItemId = `note-${note.row}-${note.columnIndex}-${note.color}-${note.shape}`;
      }
    });

    // Check stamps
    if (!clickedItemId) {
      store.state.stampPlacements.forEach(stamp => {
        const centerX = getColumnX(stamp.column, options);
        const centerY = getRowY(stamp.row, options);
        const dist = Math.hypot(canvasX - centerX, canvasY - centerY);

        if (dist <= threshold) {
          clickedItemId = `stamp-${stamp.row}-${stamp.column}-${stamp.stampId}`;
        }
      });
    }

    // Check triplets
    if (!clickedItemId) {
      store.state.tripletPlacements.forEach(triplet => {
        const centerX = getColumnX(triplet.column, options);
        const centerY = getRowY(triplet.row, options);
        const dist = Math.hypot(canvasX - centerX, canvasY - centerY);

        if (dist <= threshold) {
          clickedItemId = `triplet-${triplet.row}-${triplet.column}-${triplet.tripletId}`;
        }
      });
    }

    // Remove from selection if found
    if (clickedItemId) {
      const selectedItems = store.state.lassoSelection.selectedItems.filter(
        item => item.id !== clickedItemId
      );

      // Recalculate convex hull
      let convexHull = null;
      if (selectedItems.length > 0) {
        const points = selectedItems.map(item => {
          const x = getColumnX(item.data.columnIndex || item.data.column, options);
          const y = getRowY(item.data.row, options);
          return { x, y };
        });
        convexHull = calculateConvexHull(points);
      }

      store.state.lassoSelection = {
        selectedItems,
        convexHull,
        isActive: selectedItems.length > 0
      };

      store.recordState();
      this.render();
      logger.log('AnnotationService', `Removed item from lasso selection. ${selectedItems.length} items remain.`, 'annotation');
    }
  }

  drawTempAnnotation() {
    if (!this.tempAnnotation) {return;}

    switch (this.tempAnnotation.type) {
      case 'arrow':
        this.drawArrow(this.tempAnnotation, true);
        break;
      case 'text':
        this.drawTextBoxPreview(this.tempAnnotation);
        break;
      case 'marker':
        this.drawPath(this.tempAnnotation, false);
        break;
      case 'highlighter':
        this.drawPath(this.tempAnnotation, true);
        break;
      case 'lasso':
        this.drawLassoPath(this.tempAnnotation);
        break;
    }
  }

  drawTextBoxPreview(annotation) {
    const { startX, startY, endX, endY } = annotation;
    const ctx = this.ctx;

    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    ctx.save();
    ctx.strokeStyle = 'rgba(74, 144, 226, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x, y, width, height);

    // Draw background preview if enabled
    if (this.toolSettings.text.background) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(x, y, width, height);
    }

    ctx.restore();
  }

  render() {
    // Trigger pitch grid re-render (annotations are now rendered as part of the pitch grid)
    PitchGridController.render();
  }

  drawArrow(annotation, isTemp = false, isSelected = false, isHovered = false) {
    const { startX, startY, endX, endY, settings } = annotation;
    const ctx = this.ctx;

    ctx.save();

    // Show selection highlight
    if (isSelected) {
      ctx.strokeStyle = '#4a90e2';
      ctx.lineWidth = this.getStrokeWidth(settings.strokeWeight) + 4;
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Show hover highlight
    if (isHovered && !isSelected) {
      ctx.strokeStyle = '#4a90e2';
      ctx.lineWidth = this.getStrokeWidth(settings.strokeWeight) + 4;
      ctx.globalAlpha = 0.15;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = isTemp ? 'rgba(0, 0, 0, 0.5)' : '#000000';
    ctx.lineWidth = this.getStrokeWidth(settings.strokeWeight);
    ctx.setLineDash(this.getLineDash(settings.lineStyle));

    // Calculate arrowhead size and angle
    const angle = Math.atan2(endY - startY, endX - startX);
    const arrowheadSize = settings.arrowheadSize || 12;

    // Calculate adjusted endpoints to stop at arrowhead base
    let adjustedStartX = startX;
    let adjustedStartY = startY;
    let adjustedEndX = endX;
    let adjustedEndY = endY;

    // Shorten line at start if there's an arrowhead
    if (settings.startArrowhead !== 'none') {
      adjustedStartX = startX + Math.cos(angle) * arrowheadSize;
      adjustedStartY = startY + Math.sin(angle) * arrowheadSize;
    }

    // Shorten line at end if there's an arrowhead
    if (settings.endArrowhead !== 'none') {
      adjustedEndX = endX - Math.cos(angle) * arrowheadSize;
      adjustedEndY = endY - Math.sin(angle) * arrowheadSize;
    }

    // Draw line with adjusted endpoints
    ctx.beginPath();
    ctx.moveTo(adjustedStartX, adjustedStartY);
    ctx.lineTo(adjustedEndX, adjustedEndY);
    ctx.stroke();

    // Draw arrowheads
    if (settings.startArrowhead !== 'none') {
      this.drawArrowhead(ctx, startX, startY, angle + Math.PI, settings.startArrowhead, arrowheadSize);
    }

    if (settings.endArrowhead !== 'none') {
      this.drawArrowhead(ctx, endX, endY, angle, settings.endArrowhead, arrowheadSize);
    }

    ctx.restore();
  }

  drawArrowhead(ctx, x, y, angle, type, size = 12) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Reset line dash for arrowheads
    ctx.setLineDash([]);

    switch (type) {
      case 'filled':
      case 'filled-arrow':
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size, -size / 2);
        ctx.lineTo(-size, size / 2);
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
        break;
      case 'unfilled':
      case 'unfilled-arrow':
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size, -size / 2);
        ctx.lineTo(-size, size / 2);
        ctx.closePath();
        ctx.stroke();
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(0, 0, size / 3, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
        break;
    }

    ctx.restore();
  }

  wrapText(ctx, text, maxWidth) {
    // Split by explicit newlines first
    const paragraphs = text.split('\n');
    const wrappedLines = [];

    paragraphs.forEach(paragraph => {
      if (!paragraph.trim()) {
        // Empty line
        wrappedLines.push('');
        return;
      }

      const words = paragraph.split(' ');
      let currentLine = '';

      words.forEach((word) => {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
          // Line is too long, push current line and start new one
          wrappedLines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });

      // Push the last line of this paragraph
      if (currentLine) {
        wrappedLines.push(currentLine);
      }
    });

    return wrappedLines;
  }

  drawText(annotation, isSelected = false, isHovered = false) {
    const { x, y, text, settings } = annotation;
    const ctx = this.ctx;

    ctx.save();

    // Get the actual font family from CSS variable
    const computedStyle = window.getComputedStyle(document.documentElement);
    const mainFont = computedStyle.getPropertyValue('--main-font').trim() || '"Atkinson Hyperlegible", Arial, sans-serif';

    const fontSizeValue = this.getSizeValue(settings.size);
    ctx.font = `${settings.italic ? 'italic ' : ''}${settings.bold ? 'bold ' : ''}${fontSizeValue} ${mainFont}`;
    ctx.textBaseline = 'top';


    const lineHeight = parseInt(fontSizeValue) * 1.2;

    // Use stored dimensions from the text box
    const maxWidth = annotation.width || 0;
    const totalHeight = annotation.height || 0;

    // Wrap text to fit within the box width
    const padding = settings.background ? 16 : 8; // Match input padding
    const availableWidth = maxWidth - padding;
    const lines = this.wrapText(ctx, text, availableWidth);


    // Draw background if enabled
    if (settings.background) {
      ctx.fillStyle = '#ffffff';
      const padding = 8;
      ctx.fillRect(x - padding/2, y - padding/2, maxWidth + padding, totalHeight + padding/2);
    }

    // Show hover highlight
    if (isHovered && !isSelected) {
      ctx.fillStyle = 'rgba(74, 144, 226, 0.1)';
      const padding = settings.background ? 8 : 2;
      ctx.fillRect(x - padding/2, y - padding/2, maxWidth + padding, totalHeight + padding/2);
    }

    // Show selection highlight
    if (isSelected) {
      ctx.fillStyle = 'rgba(74, 144, 226, 0.2)';
      const padding = settings.background ? 8 : 2;
      ctx.fillRect(x - padding/2, y - padding/2, maxWidth + padding, totalHeight + padding/2);
    }

    // Draw text with superscript support
    ctx.fillStyle = settings.color;
    const fontSize = parseInt(fontSizeValue);

    lines.forEach((line, i) => {
      const lineY = y + i * lineHeight;
      this.drawTextWithSuperscripts(ctx, line, x, lineY, fontSize, settings, mainFont);
    });

    // Draw resize handles if selected
    if (isSelected) {
      this.drawResizeHandles(x, y, maxWidth, totalHeight);
    }

    ctx.restore();
  }

  drawTextWithSuperscripts(ctx, text, x, y, fontSize, settings, fontFamily) {
    // If entire text is superscript or subscript from toolbar settings, render accordingly
    if (settings.superscript || settings.subscript) {
      ctx.save();
      const smallerSize = fontSize * 0.6;
      const offset = settings.superscript ? -fontSize * 0.4 : fontSize * 0.3;
      ctx.font = `${settings.italic ? 'italic ' : ''}${settings.bold ? 'bold ' : ''}${smallerSize}px ${fontFamily}`;
      ctx.fillText(text, x, y + offset);

      if (settings.underline) {
        const metrics = ctx.measureText(text);
        ctx.beginPath();
        ctx.strokeStyle = settings.color;
        ctx.lineWidth = 1;
        ctx.moveTo(x, y + offset + smallerSize * 1.2 - 2);
        ctx.lineTo(x + metrics.width, y + offset + smallerSize * 1.2 - 2);
        ctx.stroke();
      }

      ctx.restore();
      return;
    }

    // Parse text for:
    // 1. <sup>text</sup> - explicit superscript markers
    // 2. <sub>text</sub> - explicit subscript markers
    // 3. ^text - shorthand superscript until space

    let currentX = x;
    const segments = this.parseFormattedText(text);

    const drawSegment = (text, format) => {
      if (!text) {return;}

      ctx.save();

      if (format === 'superscript') {
        // Superscript: smaller font, raised position
        const superSize = fontSize * 0.6;
        const superOffset = -fontSize * 0.4;
        ctx.font = `${settings.italic ? 'italic ' : ''}${settings.bold ? 'bold ' : ''}${superSize}px ${fontFamily}`;
        ctx.fillText(text, currentX, y + superOffset);
        currentX += ctx.measureText(text).width;
      } else if (format === 'subscript') {
        // Subscript: smaller font, lowered position
        const subSize = fontSize * 0.6;
        const subOffset = fontSize * 0.3;
        ctx.font = `${settings.italic ? 'italic ' : ''}${settings.bold ? 'bold ' : ''}${subSize}px ${fontFamily}`;
        ctx.fillText(text, currentX, y + subOffset);
        currentX += ctx.measureText(text).width;
      } else {
        // Normal text
        ctx.font = `${settings.italic ? 'italic ' : ''}${settings.bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
        ctx.fillText(text, currentX, y);

        // Draw underline if enabled
        if (settings.underline) {
          const metrics = ctx.measureText(text);
          ctx.beginPath();
          ctx.strokeStyle = settings.color;
          ctx.lineWidth = 1;
          ctx.moveTo(currentX, y + fontSize * 1.2 - 2);
          ctx.lineTo(currentX + metrics.width, y + fontSize * 1.2 - 2);
          ctx.stroke();
        }

        currentX += ctx.measureText(text).width;
      }

      ctx.restore();
    };

    segments.forEach(segment => {
      drawSegment(segment.text, segment.format);
    });
  }

  parseFormattedText(text) {
    // Parse text into segments with formats: 'normal', 'superscript', or 'subscript'
    const segments = [];
    let i = 0;
    let currentSegment = '';
    let inCaretSuperscript = false;

    while (i < text.length) {
      // Check for <sup> tag
      if (text.substr(i, 5) === '<sup>') {
        // Save current segment as normal
        if (currentSegment) {
          segments.push({ text: currentSegment, format: 'normal' });
          currentSegment = '';
        }
        // Find closing </sup>
        const closeIndex = text.indexOf('</sup>', i);
        if (closeIndex !== -1) {
          const supText = text.substring(i + 5, closeIndex);
          segments.push({ text: supText, format: 'superscript' });
          i = closeIndex + 6;
          continue;
        }
      }

      // Check for <sub> tag
      if (text.substr(i, 5) === '<sub>') {
        // Save current segment as normal
        if (currentSegment) {
          segments.push({ text: currentSegment, format: 'normal' });
          currentSegment = '';
        }
        // Find closing </sub>
        const closeIndex = text.indexOf('</sub>', i);
        if (closeIndex !== -1) {
          const subText = text.substring(i + 5, closeIndex);
          segments.push({ text: subText, format: 'subscript' });
          i = closeIndex + 6;
          continue;
        }
      }

      // Check for ^ character (shorthand superscript)
      if (text[i] === '^' && !inCaretSuperscript) {
        // Save current segment as normal
        if (currentSegment) {
          segments.push({ text: currentSegment, format: 'normal' });
          currentSegment = '';
        }
        inCaretSuperscript = true;
        i++;
        continue;
      }

      // Space ends caret superscript
      if (inCaretSuperscript && text[i] === ' ') {
        // Save accumulated superscript
        if (currentSegment) {
          segments.push({ text: currentSegment, format: 'superscript' });
          currentSegment = '';
        }
        inCaretSuperscript = false;
        segments.push({ text: ' ', format: 'normal' });
        i++;
        continue;
      }

      currentSegment += text[i];
      i++;
    }

    // Save any remaining segment
    if (currentSegment) {
      segments.push({
        text: currentSegment,
        format: inCaretSuperscript ? 'superscript' : 'normal'
      });
    }

    return segments;
  }

  drawResizeHandles(x, y, width, height) {
    const ctx = this.ctx;
    const handleSize = 8;
    const handles = [
      { pos: 'nw', x: x, y: y },
      { pos: 'n', x: x + width / 2, y: y },
      { pos: 'ne', x: x + width, y: y },
      { pos: 'e', x: x + width, y: y + height / 2 },
      { pos: 'se', x: x + width, y: y + height },
      { pos: 's', x: x + width / 2, y: y + height },
      { pos: 'sw', x: x, y: y + height },
      { pos: 'w', x: x, y: y + height / 2 }
    ];

    ctx.save();
    handles.forEach(handle => {
      ctx.fillStyle = '#4a90e2';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
    });
    ctx.restore();
  }

  drawPath(annotation, isHighlighter) {
    const { path, settings } = annotation;
    const ctx = this.ctx;

    if (path.length < 2) {return;}

    ctx.save();

    if (isHighlighter) {
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = settings.color;
    } else {
      ctx.strokeStyle = settings.color;
    }

    ctx.lineWidth = this.getStrokeWidth(settings.size);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);

    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }

    ctx.stroke();
    ctx.restore();
  }

  drawLassoPath(annotation) {
    const { path } = annotation;
    const ctx = this.ctx;

    if (path.length < 2) {return;}

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 100, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);

    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }

    // Close the path back to start
    ctx.lineTo(path[0].x, path[0].y);
    ctx.stroke();
    ctx.restore();
  }

  getStrokeWidth(size) {
    // Handle numeric sizes
    if (typeof size === 'number') {
      return size;
    }
    // Handle legacy string sizes
    switch (size) {
      case 'small': return 2;
      case 'medium': return 4;
      case 'large': return 6;
      default: return 2;
    }
  }

  getLineDash(style) {
    switch (style) {
      case 'solid': return [];
      case 'dashed-big': return [10, 5];
      case 'dashed-small': return [5, 3];
      case 'dotted': return [2, 3];
      default: return [];
    }
  }

  getSizeValue(size) {
    // Handle numeric sizes (for text tool)
    if (typeof size === 'number') {
      return `${size}px`;
    }
    // Handle string sizes (for marker/highlighter)
    switch (size) {
      case 'small': return '14px';
      case 'medium': return '18px';
      case 'large': return '24px';
      default: return '16px';
    }
  }

  updateHover(x, y) {
    const previousHover = this.hoverAnnotation;

    // Check for resize handle on selected text annotation first
    if (this.selectedAnnotation && this.selectedAnnotation.type === 'text') {
      const handle = this.getResizeHandleAt(x, y, this.selectedAnnotation);
      if (handle) {
        // Set cursor based on resize direction
        const cursors = {
          'nw': 'nwse-resize',
          'n': 'ns-resize',
          'ne': 'nesw-resize',
          'e': 'ew-resize',
          'se': 'nwse-resize',
          's': 'ns-resize',
          'sw': 'nesw-resize',
          'w': 'ew-resize'
        };
        this.canvas.style.cursor = cursors[handle];
        return;
      }
    }

    // Check if hovering over lasso selection convex hull
    if (store.state.lassoSelection?.isActive && store.state.lassoSelection.convexHull) {
      const isNearHull = isPointNearHull({ x, y }, store.state.lassoSelection.convexHull, 10);
      const isInsideHull = isPointInPolygon({ x, y }, store.state.lassoSelection.convexHull);

      if (isNearHull || isInsideHull) {
        this.canvas.style.cursor = 'move';
        return;
      }
    }

    const annotation = this.getAnnotationAt(x, y);

    // Update cursor based on hover
    if (annotation && (annotation.type === 'arrow' || annotation.type === 'text')) {
      this.canvas.style.cursor = 'move';
      this.hoverAnnotation = annotation;
    } else {
      // Restore default cursor for current tool
      this.setTool(this.currentTool, this.toolSettings);
      this.hoverAnnotation = null;
    }

    // Re-render if hover state changed
    if (previousHover !== this.hoverAnnotation) {
      this.render();
    }
  }

  getResizeHandleAt(x, y, annotation) {
    if (!annotation || annotation.type !== 'text') {return null;}

    const handleSize = 8;
    const hitRadius = handleSize / 2 + 2; // Slightly larger hit area

    const textWidth = annotation.width || 0;
    const textHeight = annotation.height || 0;
    const ax = annotation.x;
    const ay = annotation.y;

    const handles = [
      { pos: 'nw', x: ax, y: ay },
      { pos: 'n', x: ax + textWidth / 2, y: ay },
      { pos: 'ne', x: ax + textWidth, y: ay },
      { pos: 'e', x: ax + textWidth, y: ay + textHeight / 2 },
      { pos: 'se', x: ax + textWidth, y: ay + textHeight },
      { pos: 's', x: ax + textWidth / 2, y: ay + textHeight },
      { pos: 'sw', x: ax, y: ay + textHeight },
      { pos: 'w', x: ax, y: ay + textHeight / 2 }
    ];

    for (const handle of handles) {
      const dist = Math.sqrt(Math.pow(x - handle.x, 2) + Math.pow(y - handle.y, 2));
      if (dist <= hitRadius) {
        return handle.pos;
      }
    }

    return null;
  }

  getAnnotationAt(x, y) {
    const hitRadius = 10;

    // Check in reverse order (top to bottom)
    for (let i = store.state.annotations.length - 1; i >= 0; i--) {
      const annotation = store.state.annotations[i];

      if (annotation.type === 'arrow') {
        const dist = this.distanceToLineSegment(x, y,
          annotation.startX, annotation.startY,
          annotation.endX, annotation.endY);
        if (dist < hitRadius) {
          return annotation;
        }
      } else if (annotation.type === 'text') {
        // Use stored width/height if available, otherwise calculate
        let textWidth = annotation.width;
        let textHeight = annotation.height;

        if (!textWidth || !textHeight) {
          // Fallback: calculate dimensions
          const lines = annotation.text.split('\n');
          const fontSize = annotation.settings.size;
          const lineHeight = fontSize * 1.2;

          this.ctx.font = `${fontSize}px Arial`;
          textWidth = 0;
          lines.forEach(line => {
            const metrics = this.ctx.measureText(line);
            textWidth = Math.max(textWidth, metrics.width);
          });
          textHeight = lines.length * lineHeight;
        }

        if (x >= annotation.x && x <= annotation.x + textWidth &&
                    y >= annotation.y && y <= annotation.y + textHeight) {
          return annotation;
        }
      }
    }

    return null;
  }

  showEraserCursor(x, y) {
    // Clear and redraw with eraser cursor
    this.render();

    // Get microbeat size from state (2 microbeats = cellWidth)
    const microbeatSize = store.state.cellWidth || 40;
    const size = microbeatSize * 2;

    // Draw transparent red square cursor (no border)
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(220, 53, 69, 0.3)'; // Transparent red
    this.ctx.fillRect(x - size/2, y - size/2, size, size);
    this.ctx.restore();
  }

  loadAnnotationSettings(annotation) {
    // Load settings from selected annotation into the toolbar
    if (annotation.type === 'arrow' && window.drawToolsController) {
      const settings = annotation.settings;
      window.drawToolsController.settings.arrow = { ...settings };
      // Re-render the arrow toolbar to reflect loaded settings
      window.drawToolsController.renderArrowOptions();
    } else if (annotation.type === 'text' && window.drawToolsController) {
      const settings = annotation.settings;
      window.drawToolsController.settings.text = { ...settings };
      // Re-render the text toolbar to reflect loaded settings
      window.drawToolsController.renderTextOptions();
    }
  }

  applyCurrentSettingsToSelected() {
    // Apply current toolbar settings to selected annotation
    if (!this.selectedAnnotation) {return;}

    if (this.selectedAnnotation.type === 'arrow' && this.toolSettings.arrow) {
      this.selectedAnnotation.settings = { ...this.toolSettings.arrow };
      this.render();
    } else if (this.selectedAnnotation.type === 'text' && this.toolSettings.text) {
      this.selectedAnnotation.settings = { ...this.toolSettings.text };
      this.render();
    }
  }

  clearAnnotations() {
    store.state.annotations = [];
    this.render();
  }

  eraseAtPoint(x, y) {
    const eraseRadius = 10; // Radius for erasing
    let changed = false;

    // Check each annotation for proximity
    store.state.annotations = store.state.annotations.filter(annotation => {
      let shouldKeep = true;

      if (annotation.type === 'arrow') {
        // Convert grid coordinates to canvas pixels for distance check
        const options = this.getRenderOptions();
        const startX = getColumnX(annotation.startCol, options);
        const startY = getRowY(annotation.startRow, options);
        const endX = getColumnX(annotation.endCol, options);
        const endY = getRowY(annotation.endRow, options);

        // Check if point is near the arrow line
        const dist = this.distanceToLineSegment(x, y, startX, startY, endX, endY);
        if (dist < eraseRadius) {
          shouldKeep = false;
          changed = true;
        }
      } else if (annotation.type === 'text') {
        // Convert grid coordinates to canvas pixels for bounding box check
        const options = this.getRenderOptions();
        const textX = getColumnX(annotation.col, options);
        const textY = getRowY(annotation.row, options);
        const textEndX = getColumnX(annotation.col + annotation.widthCols, options);
        const textEndY = getRowY(annotation.row + annotation.heightRows, options);

        // Check if point is within text bounding box
        if (x >= textX && x <= textEndX &&
                    y >= textY && y <= textEndY) {
          shouldKeep = false;
          changed = true;
        }
      } else if (annotation.type === 'marker' || annotation.type === 'highlighter') {
        // Convert grid coordinates to canvas pixels for path check
        const options = this.getRenderOptions();
        for (let i = 0; i < annotation.path.length; i++) {
          const pathX = getColumnX(annotation.path[i].col, options);
          const pathY = getRowY(annotation.path[i].row, options);
          const dx = x - pathX;
          const dy = y - pathY;
          if (Math.sqrt(dx * dx + dy * dy) < eraseRadius) {
            shouldKeep = false;
            changed = true;
            break;
          }
        }
      }

      return shouldKeep;
    });

    if (changed) {
      this.render();
    }
    return changed;
  }

  interpolatePoints(point1, point2) {
    // Interpolate points between two grid coordinates for smooth path
    const points = [];
    const colDiff = point2.col - point1.col;
    const rowDiff = point2.row - point1.row;
    const distance = Math.sqrt(colDiff * colDiff + rowDiff * rowDiff);

    // Add points every 0.1 grid units for smooth path
    const steps = Math.max(1, Math.floor(distance / 0.1));

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      points.push({
        col: point1.col + t * colDiff,
        row: point1.row + t * rowDiff
      });
    }

    return points;
  }

  distanceToLineSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      // Line segment is actually a point
      const dpx = px - x1;
      const dpy = py - y1;
      return Math.sqrt(dpx * dpx + dpy * dpy);
    }

    // Calculate projection of point onto line
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    // Find closest point on line segment
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    // Calculate distance
    const distX = px - closestX;
    const distY = py - closestY;
    return Math.sqrt(distX * distX + distY * distY);
  }

  deleteAnnotationAt(x, y) {
    this.eraseAtPoint(x, y);
  }

  getAnnotations() {
    return store.state.annotations;
  }

  loadAnnotations(annotations) {
    store.state.annotations = annotations || [];
    this.render();
  }

  applyInlineFormatting(type) {
    // Get the active text input if one exists
    const activeInput = document.querySelector('.annotation-text-input');
    if (!activeInput) {return;}

    const selection = window.getSelection();
    if (!selection.rangeCount) {return;}

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    if (!selectedText) {return;}

    // Create the marker-wrapped text
    let wrappedText;
    if (type === 'superscript') {
      wrappedText = `<sup>${selectedText}</sup>`;
    } else if (type === 'subscript') {
      wrappedText = `<sub>${selectedText}</sub>`;
    } else {
      return;
    }

    // Replace the selected text with the wrapped version
    range.deleteContents();
    const textNode = document.createTextNode(wrappedText);
    range.insertNode(textNode);

    // Move cursor after the inserted text
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);

    // Keep focus on the input
    activeInput.focus();
  }
}

const annotationService = new AnnotationService();
export default annotationService;
