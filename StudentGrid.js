/******************************
 * StudentGrid.js
 ******************************/
(function() {
  'use strict';

  /************************************
   * Configuration
   ************************************/
  const config = {
    logicRows: 20,
    visualRows: 10,
    columnWidths: [
      3, 3,                   // Example: two columns on the left
      ...Array(6).fill(1),    // optional extra columns
      ...Array(32).fill(1),   // main grid
      3, 3                    // two columns on the right
    ],
    debounceDelay: 200,
    beatDuration: 60 / 120
  };

  /************************************
   * DOM and Canvas Setup
   ************************************/
  const gridContainer = document.getElementById('grid-container');
  const canvas = document.getElementById('notation-grid');
  const ctx = canvas.getContext('2d');
  let cellWidth, cellHeight;
  let resizeTimeout;

  const shiftUpButton = document.getElementById('shift-up-button'); // Ensure these IDs match your HTML
  const shiftDownButton = document.getElementById('shift-down-button');

  // 12-tone color map (ignoring octaves)
  const pitchClassColors = {
    'C':        '#f090ae',
    'D♭/C♯':    '#f59383',
    'D':        '#ea9e5e',
    'E♭/D♯':    '#d0ae4e',
    'E':        '#a8bd61',
    'F':        '#76c788',
    'G♭/F♯':    '#41cbb5',
    'G':        '#33c6dc',
    'A♭/G♯':    '#62bbf7',
    'A':        '#94adff',
    'B♭/A♯':    '#bea0f3',
    'B':        '#dd95d6'
  };

  function getPitchClass(pitchWithOctave) {
    return pitchWithOctave.replace(/\d/g, '').trim();
  }

  // rowData is the visible portion of window.fullRowData
  let gridPosition = 28;
  let rowData = [];
  updateRowData();

  function updateRowData() {
    rowData = window.fullRowData.slice(gridPosition, gridPosition + config.logicRows);
  }

  function adjustPlacedNotes() {
    if (!window.placedNotes) return;
    for (let i = window.placedNotes.length - 1; i >= 0; i--) {
      const note = window.placedNotes[i];
      if (note.row < gridPosition || note.row >= gridPosition + config.logicRows) {
        window.placedNotes.splice(i, 1);
      } else {
        note.rowIndex = note.row - gridPosition;
      }
    }
  }

  // Shift grid up/down by 1 row
  function shiftGridUp() {
    if (gridPosition > 0) {
      gridPosition -= 0.5;
      updateRowData();
      adjustPlacedNotes();
      drawGrid();
    }
  }

  function shiftGridDown() {
    if (gridPosition + config.logicRows < window.fullRowData.length) {
      gridPosition += 0.5;
      updateRowData();
      adjustPlacedNotes();
      drawGrid();
    }
  }

  // Add event listeners to toolbar buttons
  shiftUpButton.addEventListener('click', () => {
    shiftGridUp();
    drawGrid();
  });

  shiftDownButton.addEventListener('click', () => {
    shiftGridDown();
    drawGrid();
  });

  // Resize canvas to fit parent container
  function resizeCanvas() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const parentWidth = gridContainer.offsetWidth;
      const parentHeight = gridContainer.offsetHeight;

      const totalWidthUnits = config.columnWidths.reduce((a, b) => a + b, 0);
      const totalHeightUnits = config.visualRows * 2;

      const widthFactor = parentWidth / totalWidthUnits;
      const heightFactor = parentHeight / totalHeightUnits;
      const scaling = Math.min(widthFactor, heightFactor);

      cellWidth = scaling;
      cellHeight = scaling * 2;

      canvas.width = cellWidth * totalWidthUnits;
      canvas.height = cellHeight * config.visualRows;

      canvas.style.width = `${canvas.width}px`;
      canvas.style.height = `${canvas.height}px`;

      drawGrid();
    }, config.debounceDelay);
  }

  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', resizeCanvas);
  resizeCanvas();

  /************************************
   * Grid Drawing
   ************************************/
  function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackgroundRectangle();
    drawLegends();
    drawHorizontalLines();
    drawVerticalLines();
    redrawNotesAndTails();
  }

    /************************************
     * Grey G Rectangle
     ************************************/
    function drawBackgroundRectangle() {
      const startColumnIndex = 2;
      const endColumnIndex = config.columnWidths.length - 2; // `ColumnCount - 2`
      const rowStartIndex = 6; // Assuming G-Row starts at index 6
      const rowEndIndex = rowStartIndex + 2; // Two rows high

      const xStart = getColumnX(startColumnIndex);
      const xEnd = getColumnX(endColumnIndex + 1); // Include the end column
      const yStart = getRowY(rowStartIndex);
      const yEnd = getRowY(rowEndIndex);

      const width = xEnd - xStart;
      const height = yEnd - yStart;

      ctx.fillStyle = 'rgba(128, 128, 128, 0.5)'; // Grey color with slight transparency
      ctx.fillRect(xStart, yStart, width, height);
    }
  
  /************************************
   * Legend (Left/Right Columns)
   ************************************/
  function drawLegends() {
    // Left side columns: 0..2
    drawLegend(0, 2, ['A', 'B']);
    // Right side columns: (columnCount - 2)..(columnCount)
    drawLegend(config.columnWidths.length - 2, config.columnWidths.length, ['B', 'A']);
  }

  function drawLegend(startCol, endCol, columnsOrder) {
    const xStart = getColumnX(startCol);
    const columnWidthsPx = config.columnWidths.slice(startCol, endCol).map(w => w * cellWidth);
    let cumulativeX = xStart;

    columnsOrder.forEach((colLabel, colIndex) => {
      const colWidth = columnWidthsPx[colIndex];
      rowData.forEach((row, rowIndex) => {
        if (row.column === colLabel) {
          const y = getRowY(rowIndex);
          const pitchClass = getPitchClass(row.pitch);
          const color = pitchClassColors[pitchClass] || '#fff';

          // Fill each legend cell
          ctx.fillStyle = color;
          ctx.fillRect(cumulativeX, y - cellHeight / 2, colWidth, cellHeight);

          // Label text
          const fontSize = Math.max(12, Math.min(cellWidth * 0.8, cellHeight * 0.8));
          ctx.fillStyle = '#000';
          ctx.font = `${fontSize}px 'Zodeka One', sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(row.pitch, cumulativeX + colWidth / 2, y);
        }
      });
      cumulativeX += colWidth;
    });
  }


  /************************************
   * Horizontal Lines
   ************************************/


  
  // Y‑Axis Set A: columns 1..(columnCount - 1)
  const yAxisSetA = new Set(['C','D','E','G♭/F♯','A♭/G♯','B♭/A♯']);

  // Y‑Axis Set B: columns 0 and (columnCount - 1)
  const yAxisSetB = new Set(['D♭/C♯','E♭/D♯','F','G','A','B']);

  function drawHorizontalLines() {
    const columnCount = config.columnWidths.length;

    rowData.forEach((row, rowIndex) => {
      const y = getRowY(rowIndex);
      const pitchClass = getPitchClass(row.pitch);
      const style = getLineStyleFromPitchClass(pitchClass);

      // If pitch is in Y‑Axis Set A:
      //   only draw columns i=1..(columnCount - 1)
      if (yAxisSetA.has(pitchClass)) {
        // e.g. if columnCount=40, we do i in [1..39)
        for (let i = 1; i < columnCount - 1; i++) {
          const xStart = getColumnX(i);
          const xEnd = getColumnX(i + 1);
          drawHorizontalSegment(xStart, xEnd, y, style);
        }
      }
      // If pitch is in Y‑Axis Set B:
      //   only draw columns 0 and (columnCount - 1)
      else if (yAxisSetB.has(pitchClass)) {
        // 1) Column 0 => column 1
        {
          const xStart = getColumnX(0);
          const xEnd = getColumnX(1);
          drawHorizontalSegment(xStart, xEnd, y, style);
        }
        // 2) Column (columnCount - 1) => columnCount
        //    But note: the last "column index" is columnCount - 1. 
        //    To draw that boundary, we go from (columnCount - 1) to 
        //    the "edge" of the canvas (columnCount). 
        //    i.e., getColumnX(columnCount - 1) => getColumnX(columnCount).
        {
          const xStart = getColumnX(columnCount - 1);
          const xEnd = getColumnX(columnCount); 
          // getColumnX(columnCount) means summing widths up to the "virtual" nth column
          // which is effectively the far-right boundary of the canvas.
          drawHorizontalSegment(xStart, xEnd, y, style);
        }
      }
      // If you have pitches outside those sets,
      //   you could either skip them or default them to Set A logic.
      else {
        // Example: treat them like Set A, or skip entirely
        for (let i = 1; i < columnCount - 2; i++) {
          const xStart = getColumnX(i);
          const xEnd = getColumnX(i + 1);
          drawHorizontalSegment(xStart, xEnd, y, style);
        }
      }
    });
  }

  function drawHorizontalSegment(xStart, xEnd, y, style) {
    ctx.beginPath();
    ctx.moveTo(xStart, y);
    ctx.lineTo(xEnd, y);
    ctx.lineWidth = style.lineWidth;
    ctx.setLineDash(style.dash || []);
    ctx.strokeStyle = style.color;
    ctx.stroke();
  }

  /**
   * Every pitch draws lines, 
   * but we differentiate thickness or dash.
   */
  function getLineStyleFromPitchClass(pc) {
    switch (pc) {
      case 'C':         return { draw: true, lineWidth: 3, dash: [],     color: '#000' };
      case 'D♭/C♯':     return { draw: true, lineWidth: 1, dash: [],     color: '#000' };
      case 'D':         return { draw: true, lineWidth: 1, dash: [],     color: '#000' };
      case 'E♭/D♯':     return { draw: true, lineWidth: 1, dash: [],     color: '#000' };
      case 'E':         return { draw: true, lineWidth: 1, dash: [5, 5],  color: '#000' };
      case 'F':         return { draw: true, lineWidth: 1, dash: [],     color: '#000' };
      case 'G♭/F♯':     return { draw: true, lineWidth: 1, dash: [],     color: '#000' };
      case 'G':         return { draw: true, lineWidth: 1, dash: [],     color: '#000' };
      case 'A♭/G♯':     return { draw: true, lineWidth: 1, dash: [],     color: '#000' };
      case 'A':         return { draw: true, lineWidth: 1, dash: [],     color: '#000' };
      case 'B♭/A♯':     return { draw: true, lineWidth: 1, dash: [],     color: '#000' };
      case 'B':         return { draw: true, lineWidth: 1, dash: [],     color: '#000' };
      default:          return { draw: true, lineWidth: 1, dash: [],     color: '#000' };
    }
  }



  /************************************
   * Vertical Lines
   ************************************/
  function drawVerticalLines() {
    const columnCount = config.columnWidths.length;
  
    for (let i = 0; i <= columnCount; i++) { // Includes `columnCount` for the right boundary
      const x = getColumnX(i); // Use getColumnX for x positions
      const style = getVerticalLineStyle(i, columnCount);
      if (style) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.lineWidth = style.lineWidth;
        ctx.setLineDash(style.dash || []);
        ctx.strokeStyle = style.color;
        ctx.stroke();
      }
    }
  }
  
  function getColumnX(index) {
    // Calculate the x position by summing up column widths up to the given index
    let x = 0;
    for (let i = 0; i < index; i++) {
      x += config.columnWidths[i] * cellWidth;
    }
    return x;
  }
  
  function getVerticalLineStyle(i, columnCount) {
    // Define line styles based on the column index
    if (i === 0 || i === columnCount) {
      return { lineWidth: 5, dash: [], color: '#000' }; // Left and right boundaries
    }
    if (i === 1 || i === 2 || i === columnCount - 1) {
      return { lineWidth: 1, dash: [], color: '#000' }; // Inner boundary lines
    }
  
    // Additional measure logic (e.g., styled measure lines)
    const startPattern = 8;
    const interval = 2;
    if (i >= startPattern && i < columnCount) {
      const offset = i - startPattern;
      if (offset % (interval * 4) === 0) {
        return { lineWidth: 1, dash: [], color: '#000' };
      } else if (offset % interval === 0) {
        return { lineWidth: 1, dash: [5, 5], color: '#000' };
      }
    }
  
    return null; // No style for unspecified lines
  }
  

  /************************************
   * Note Rendering
   ************************************/
  function redrawNotesAndTails() {
    if (!window.placedNotes) return;

    window.placedNotes.forEach(note => {
      const noteRowIndex = note.row - gridPosition;
      if (noteRowIndex < 0 || noteRowIndex >= config.logicRows) return;

      // single-col note vs. multi-col "tail"
      if (note.startColumnIndex === note.endColumnIndex) {
        drawNoteOnCanvas(note);
      } else {
        drawNoteWithTail(note);
      }
    });
  }

  function drawNoteOnCanvas(note) {
    const noteRowIndex = note.row - gridPosition;
    const y = getRowY(noteRowIndex);

    const xStart = getColumnX(note.startColumnIndex);
    const colWidth = config.columnWidths[note.startColumnIndex] * cellWidth;
    const nextWidth = (note.endColumnIndex + 1 < config.columnWidths.length)
      ? config.columnWidths[note.endColumnIndex + 1] * cellWidth
      : config.columnWidths[note.endColumnIndex] * cellWidth;

    const totalWidth = colWidth + nextWidth;
    const radius = (totalWidth / 2) * 0.9;
    const centerX = xStart + totalWidth / 2;

    ctx.beginPath();
    ctx.arc(centerX, y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = note.color;
    ctx.lineWidth = 6;
    ctx.setLineDash([]);
    ctx.stroke();
  }

  function drawNoteWithTail(note) {
    // draw the note first
    drawNoteOnCanvas(note);

    const startX = getColumnX(note.startColumnIndex)
      + (config.columnWidths[note.startColumnIndex] * cellWidth) / 2;
    const endX = getColumnX(note.endColumnIndex)
      + (config.columnWidths[note.endColumnIndex] * cellWidth) / 2;

    const noteRowIndex = note.row - gridPosition;
    const y = getRowY(noteRowIndex);

    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.strokeStyle = note.color;
    ctx.lineWidth = cellWidth * 0.3;
    ctx.stroke();
  }

  /************************************
   * Mouse Events (Placement, Drag, Erase)
   ************************************/
  let isDragging = false;
  let currentDraggedNote = null;
  let eraseHighlightedCell = null;

  canvas.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  });

  canvas.addEventListener('mousedown', function(e) {
    if (!window.placedNotes) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let colIndex = getColumnIndex(x);
    if (colIndex < 2 || colIndex >= config.columnWidths.length - 2) {
      // outside main area if you wish
      return;
    }

    const colX = getColumnX(Math.floor(colIndex));
    const nextColX = getColumnX(Math.floor(colIndex) + 1);
    const midpoint = (colX + nextColX) / 2;
    colIndex = (x > midpoint) ? Math.ceil(colIndex) : Math.floor(colIndex);

    const rowIndex = Math.floor((y / canvas.height) * config.logicRows);
    if (rowIndex < 0 || rowIndex >= config.logicRows) return;

    const row = gridPosition + rowIndex;

    // Left click => place/drag a note
    if (e.button === 0 && window.selectedNoteColor) {
      const newNote = {
        row,
        startColumnIndex: colIndex,
        endColumnIndex: colIndex,
        color: window.selectedNoteColor
      };
      window.placedNotes.push(newNote);
      isDragging = true;
      currentDraggedNote = newNote;
      e.preventDefault();
      drawGrid();
    }
    // Right click => erase
    else if (e.button === 2) {
      eraseHighlightedCell = { colIndex, rowIndex };
      eraseNoteAtPosition(colIndex, row);
      document.getElementById('eraser-tool').classList.add('selected');
      drawGrid();
    }
  });

  canvas.addEventListener('mousemove', function(e) {
    if (!window.placedNotes) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let colIndex = getColumnIndex(x);
    if (colIndex < 2 || colIndex >= config.columnWidths.length - 2) return;

    const colX = getColumnX(Math.floor(colIndex));
    const nextColX = getColumnX(Math.floor(colIndex) + 1);
    const midpoint = (colX + nextColX) / 2;
    colIndex = (x > midpoint) ? Math.ceil(colIndex) : Math.floor(colIndex);

    const rowIndex = Math.floor((y / canvas.height) * config.logicRows);
    if (rowIndex < 0 || rowIndex >= config.logicRows) return;

    // If erasing (right-button drag)
    if (document.getElementById('eraser-tool').classList.contains('selected') && e.buttons === 2) {
      eraseHighlightedCell = { colIndex, rowIndex };
      eraseNoteAtPosition(colIndex, gridPosition + rowIndex);
      drawGrid();
    }
    // If dragging a newly placed note
    else if (isDragging && currentDraggedNote && e.buttons === 1) {
      let newCol = colIndex;
      if (newCol < 2) newCol = 2;
      if (newCol >= config.columnWidths.length - 2) {
        newCol = config.columnWidths.length - 3;
      }
      if (newCol < currentDraggedNote.startColumnIndex) {
        newCol = currentDraggedNote.startColumnIndex;
      }
      currentDraggedNote.endColumnIndex = newCol;
      drawGrid();
    }
  });

  window.addEventListener('mouseup', function(e) {
    if (!window.placedNotes) return;

    // stop dragging
    if (e.button === 0 && isDragging && currentDraggedNote) {
      isDragging = false;
      currentDraggedNote = null;
      drawGrid();
    } 
    // stop erasing
    else if (e.button === 2 && document.getElementById('eraser-tool').classList.contains('selected')) {
      document.getElementById('eraser-tool').classList.remove('selected');
      eraseHighlightedCell = null;
      drawGrid();
    }
  });

  canvas.addEventListener('mouseleave', function() {
    if (isDragging && currentDraggedNote) {
      isDragging = false;
      currentDraggedNote = null;
      drawGrid();
    }
    if (document.getElementById('eraser-tool').classList.contains('selected')) {
      document.getElementById('eraser-tool').classList.remove('selected');
      eraseHighlightedCell = null;
      drawGrid();
    }
  });

  function eraseNoteAtPosition(columnIndex, row) {
    for (let i = window.placedNotes.length - 1; i >= 0; i--) {
      const note = window.placedNotes[i];
      if (
        note.row === row &&
        note.startColumnIndex <= columnIndex &&
        note.endColumnIndex >= columnIndex
      ) {
        window.placedNotes.splice(i, 1);
      }
    }
  }

  // Utility: x => column index
  function getColumnIndex(x) {
    let cumulative = 0;
    for (let i = 0; i < config.columnWidths.length; i++) {
      cumulative += config.columnWidths[i] * cellWidth;
      if (x < cumulative) return i;
    }
    return config.columnWidths.length - 1;
  }

  // Utility: column index => x
  function getColumnX(index) {
    let x = 0;
    for (let i = 0; i < index; i++) {
      x += config.columnWidths[i] * cellWidth;
    }
    return x;
  }

  // row index => y center
  function getRowY(index) {
    return index * 0.5 * cellHeight;
  }

  /************************************
   * Public API
   ************************************/
  window.NotationGrid = {
    config,
    shiftGridUp,
    shiftGridDown,
    drawGrid,
    resizeCanvas
  };

})();
