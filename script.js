// Modular JavaScript Structure
(function() {
  'use strict';

  /* Function to Detect Mobile Devices */
  function isMobileDevice() {
    return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  const isMobile = isMobileDevice();

  const config = {
    logicRows: 20,
    visualRows: 10,
    columnWidths: isMobile ? [3,3,...Array(32).fill(1)] : [3,3,...Array(6).fill(1),...Array(32).fill(1),3,3],
    debounceDelay: 200,
    beatDuration: 60/120
  };

  // Base pitch colors (no brightness modification yet)
  const pitchColors = {
    'C': '#f77878',
    'D': '#ffc076',
    'E': '#fcfc74',
    'F': '#9ef777',
    'G': '#78d9f7',
    'A': '#b288ff',
    'B': '#f778e0'
  };

  // Brightness adjustment function
  function adjustBrightness(hexColor, factor) {
    let r = parseInt(hexColor.slice(1,3),16);
    let g = parseInt(hexColor.slice(3,5),16);
    let b = parseInt(hexColor.slice(5,7),16);

    r = Math.min(255, Math.max(0, Math.round(r*factor)));
    g = Math.min(255, Math.max(0, Math.round(g*factor)));
    b = Math.min(255, Math.max(0, Math.round(b*factor)));

    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }

  // Generate octave-specific colors
  // Octave ranges from 1 to 7:
  // octave < 4: factor = 1 - 0.1*(4 - octave)
  // octave = 4: factor = 1
  // octave > 4: factor = 1 + 0.1*(octave - 4)
  function generateOctaveColors(baseColors, octaves=[1,2,3,4,5,6,7]) {
    const octaveColors={};
    for (const [pitch,color] of Object.entries(baseColors)) {
      octaveColors[pitch]={};
      for (const octave of octaves) {
        let factor = 1;
        if (octave<4) {
          factor = 1 - 0.1*(4 - octave);
        } else if (octave>4) {
          factor = 1 + 0.1*(octave - 4);
        } // octave=4 -> factor=1 no change
        octaveColors[pitch][octave] = adjustBrightness(color, factor);
      }
    }
    return octaveColors;
  }

  const octaveColors = generateOctaveColors(pitchColors);

  // Full pitch data from C1 to C8, etc.
  const fullRowData = [
    { pitch: 'C8', frequency: 4186.01, column: 'A' },
    { pitch: 'B7', frequency: 3951.07, column: 'B' },
    { pitch: 'B♭/A♯', frequency: 3729.31, column: 'A' },
    { pitch: 'A7', frequency: 3520.00, column: 'B' },
    { pitch: 'A♭/G♯', frequency: 3322.44, column: 'A' },
    { pitch: 'G7', frequency: 3135.96, column: 'B' },
    { pitch: 'G♭/F♯', frequency: 2959.96, column: 'A' },
    { pitch: 'F7', frequency: 2793.83, column: 'B' },
    { pitch: 'E7', frequency: 2637.02, column: 'A' },
    { pitch: 'E♭/D♯', frequency: 2489.02, column: 'B' },
    { pitch: 'D7', frequency: 2349.32, column: 'A' },
    { pitch: 'D♭/C♯', frequency: 2217.46, column: 'B' },
    { pitch: 'C7', frequency: 2093.00, column: 'A' },
    { pitch: 'B6', frequency: 1975.53, column: 'B' },
    { pitch: 'B♭/A♯', frequency: 1864.66, column: 'A' },
    { pitch: 'A6', frequency: 1760.00, column: 'B' },
    { pitch: 'A♭/G♯', frequency: 1661.22, column: 'A' },
    { pitch: 'G6', frequency: 1567.94, column: 'B' },
    { pitch: 'G♭/F♯', frequency: 1479.98, column: 'A' },
    { pitch: 'F6', frequency: 1396.91, column: 'B' },
    { pitch: 'E6', frequency: 1318.51, column: 'A' },
    { pitch: 'E♭/D♯', frequency: 1244.51, column: 'B' },
    { pitch: 'D6', frequency: 1174.66, column: 'A' },
    { pitch: 'D♭/C♯', frequency: 1108.73, column: 'B' },
    { pitch: 'C6', frequency: 1046.50, column: 'A' },
    { pitch: 'B5', frequency: 987.77, column: 'B' },
    { pitch: 'B♭/A♯', frequency: 932.33, column: 'A' },
    { pitch: 'A5', frequency: 880.00, column: 'B' },
    { pitch: 'A♭/G♯', frequency: 830.61, column: 'A' },
    { pitch: 'G5', frequency: 783.99, column: 'B' },
    { pitch: 'G♭/F♯', frequency: 739.99, column: 'A' },
    { pitch: 'F5', frequency: 698.46, column: 'B' },
    { pitch: 'E5', frequency: 659.25, column: 'A' },
    { pitch: 'E♭/D♯', frequency: 622.25, column: 'B' },
    { pitch: 'D5', frequency: 587.33, column: 'A' },
    { pitch: 'D♭/C♯', frequency: 554.37, column: 'B' },
    { pitch: 'C5', frequency: 523.25, column: 'A' },
    { pitch: 'B4', frequency: 493.88, column: 'B' },
    { pitch: 'B♭/A♯', frequency: 466.16, column: 'A' },
    { pitch: 'A4', frequency: 440.00, column: 'B' },
    { pitch: 'A♭/G♯', frequency: 415.30, column: 'A' },
    { pitch: 'G4', frequency: 392.00, column: 'B' },
    { pitch: 'G♭/F♯', frequency: 369.99, column: 'A' },
    { pitch: 'F4', frequency: 349.23, column: 'B' },
    { pitch: 'E4', frequency: 329.63, column: 'A' },
    { pitch: 'E♭/D♯', frequency: 311.13, column: 'B' },
    { pitch: 'D4', frequency: 293.66, column: 'A' },
    { pitch: 'D♭/C♯', frequency: 277.18, column: 'B' },
    { pitch: 'C4', frequency: 261.63, column: 'A' },
    { pitch: 'B3', frequency: 246.94, column: 'B' },
    { pitch: 'B♭/A♯', frequency: 233.08, column: 'A' },
    { pitch: 'A3', frequency: 220.00, column: 'B' },
    { pitch: 'A♭/G♯', frequency: 207.65, column: 'A' },
    { pitch: 'G3', frequency: 196.00, column: 'B' },
    { pitch: 'G♭/F♯', frequency: 185.00, column: 'A' },
    { pitch: 'F3', frequency: 174.61, column: 'B' },
    { pitch: 'E3', frequency: 164.81, column: 'A' },
    { pitch: 'E♭/D♯', frequency: 155.56, column: 'B' },
    { pitch: 'D3', frequency: 146.83, column: 'A' },
    { pitch: 'D♭/C♯', frequency: 138.59, column: 'B' },
    { pitch: 'C3', frequency: 130.81, column: 'A' },
    { pitch: 'B2', frequency: 123.47, column: 'B' },
    { pitch: 'B♭/A♯', frequency: 116.54, column: 'A' },
    { pitch: 'A2', frequency: 110.00, column: 'B' },
    { pitch: 'A♭/G♯', frequency: 103.83, column: 'A' },
    { pitch: 'G2', frequency: 98.00, column: 'B' },
    { pitch: 'G♭/F♯', frequency: 92.50, column: 'A' },
    { pitch: 'F2', frequency: 87.31, column: 'B' },
    { pitch: 'E2', frequency: 82.41, column: 'A' },
    { pitch: 'E♭/D♯', frequency: 77.78, column: 'B' },
    { pitch: 'D2', frequency: 73.42, column: 'A' },
    { pitch: 'D♭/C♯', frequency: 69.30, column: 'B' },
    { pitch: 'C2', frequency: 65.41, column: 'A' },
    { pitch: 'B1', frequency: 61.74, column: 'B' },
    { pitch: 'B♭/A♯', frequency: 58.27, column: 'A' },
    { pitch: 'A1', frequency: 55.00, column: 'B' },
    { pitch: 'A♭/G♯', frequency: 51.91, column: 'A' },
    { pitch: 'G1', frequency: 49.00, column: 'B' },
    { pitch: 'G♭/F♯', frequency: 46.25, column: 'A' },
    { pitch: 'F1', frequency: 43.65, column: 'B' },
    { pitch: 'E1', frequency: 41.20, column: 'A' },
    { pitch: 'E♭/D♯', frequency: 38.89, column: 'B' },
    { pitch: 'D1', frequency: 36.71, column: 'A' },
    { pitch: 'D♭/C♯', frequency: 34.65, column: 'B' },
    { pitch: 'C1', frequency: 32.70, column: 'A' },
  ];


  let cellWidth, cellHeight;
  const placedNotes = [];
  let audioCtx = null;
  let masterGainNode = null;
  let resizeTimeout;
  let highlightedCell = null;
  let selectedNoteColor = null;
  let harmonicLevels = Array(10).fill(0);
  harmonicLevels[0] = 1;
  let scheduledOscillators = [];
  let playbackStartTime = null;
  let animationFrameId = null;
  let totalPlaybackDuration = null;
  let isDragging = false;
  let currentDraggedNote = null;
  let isErasing = false;
  let eraseHighlightedCell = null;

  let gridPosition = 28;
  let rowData = fullRowData.slice(gridPosition, gridPosition+config.logicRows);

  const exportButton = document.getElementById('export-button');
  const importButton = document.getElementById('import-button');
  const canvas = document.getElementById('notation-grid');
  const ctx = canvas.getContext('2d');
  const playButton = document.getElementById('play-button');
  const stopButton = document.getElementById('stop-button');
  const clearButton = document.getElementById('clear-button');
  const notes = document.querySelectorAll('.note');
  const gridContainer = document.getElementById('grid-container');
  const tempoSlider = document.getElementById('tempo-slider');
  const volumeSlider = document.getElementById('volume-slider');
  const eraserTool = document.getElementById('eraser-tool');
  const harmonicSliders = [];
  for (let i=0;i<=9;i++){
    harmonicSliders.push(document.getElementById(`harmonic-${i}`));
  }
  const presetButtons = {
    sine: document.getElementById('preset-sine'),
    triangle: document.getElementById('preset-triangle'),
    square: document.getElementById('preset-square'),
    sawtooth: document.getElementById('preset-sawtooth')
  };
  const shiftUpButton = document.getElementById('shift-up-button');
  const shiftDownButton = document.getElementById('shift-down-button');

  const attackSlider = document.getElementById('attack-slider');
  const decaySlider = document.getElementById('decay-slider');
  const sustainSlider = document.getElementById('sustain-slider');
  const releaseSlider = document.getElementById('release-slider');

  // After we have octaveColors, assign colors to rowData:
  // Determine if pitch is natural and find its octave, then assign brightness-adjusted color.
  rowData.forEach(row=>{
    const pitchName=row.pitch;
    // Extract octave: assume last character is the octave number
    const octave = parseInt(pitchName.slice(-1),10);
    // Extract base pitch: first character A-G
    const basePitchMatch = pitchName.match(/^[A-G]/);
    if (basePitchMatch && !isAccidentalPitch(pitchName)) {
      const basePitch = basePitchMatch[0];
      // Clamp octave between 1 and 7
      let adjustedOctave = Math.min(7, Math.max(1, octave));
      row.color = octaveColors[basePitch][adjustedOctave];
    } else {
      // Accidentals remain null (white)
      row.color = null;
    }
  });

  function isAccidentalPitch(pitch) {
    return /[#♯b♭]/.test(pitch);
  }

  // Main grid line styles
  function getMainGridLineStyle(pitch) {
    const omittedPitches = ['Db/C♯','Eb/D♯','F','G','A','B'];
    if (omittedPitches.some(op => pitch.startsWith(op))) return { draw:false };

    if (pitch.startsWith('C') && !isAccidentalPitch(pitch)) {
      return { draw:true, lineWidth:3, dash:[], color:'#000' };
    }
    if (pitch.startsWith('E') && !isAccidentalPitch(pitch)) {
      return { draw:true, lineWidth:1, dash:[5,5], color:'#000' };
    }

    // D, Gb/F#, Ab/G#, Bb/A#
    const onePtSet = ['D','Gb/F♯','Ab/G♯','Bb/A♯'];
    for (let p of onePtSet) {
      if (pitch.startsWith(p)) return { draw:true, lineWidth:1, dash:[], color:'#000' };
    }

    return { draw:false };
  }

  // Y-axis horizontal lines
  function getYAxisHorizontalLineStyle(pitch, column) {
    if (column === 'A') {
      return { draw:true, lineWidth:1, dash:[], color:'#000' };
    } else {
      // B column
      if (pitch.includes('Db/C♯')) return { draw:false };
      if (pitch.includes('Eb/D♯')) return { draw:true, lineWidth:1, dash:[5,5], color:'#000' };
      return { draw:true, lineWidth:1, dash:[], color:'#000' };
    }
  }

  // Y-axis vertical lines
  function getYAxisVerticalLineStyle(i, columnCount) {
    // Left side: i=0 (outer 1pt), i=1(middle 1pt), i=2(inside 3pt)
    if (i===0||i===1) return { lineWidth:1, dash:[], color:'#000' };
    if (i===2) return { lineWidth:3, dash:[], color:'#000' };

    // Right side if not mobile:
    if (!isMobile) {
      // Inside vertical line of right Y-axis: columnCount-2 = 3pt
      if (i===columnCount-2) return { lineWidth:3, dash:[], color:'#000' };
      // Outer lines of right Y-axis: columnCount-1, columnCount = 1pt
      if (i===columnCount-1 || i===columnCount) return { lineWidth:1, dash:[], color:'#000' };
    }

    return null;
  }

  function playNoteAtTime(frequency, time, duration) {
    const noteOscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    const real = new Float32Array(harmonicLevels.length + 1);
    const imag = new Float32Array(harmonicLevels.length + 1);
    real[0] = 0;
    imag[0] = 0;
    harmonicLevels.forEach((level, index) => {
      real[index+1] = level;
      imag[index+1] = 0;
    });
    const periodicWave = audioCtx.createPeriodicWave(real, imag, { disableNormalization: false });
    noteOscillator.setPeriodicWave(periodicWave);
    noteOscillator.frequency.setValueAtTime(frequency,time);

    noteOscillator.connect(gainNode);
    gainNode.connect(masterGainNode);

    const attack = parseFloat(attackSlider.value);
    const decay = parseFloat(decaySlider.value);
    const sustain = parseFloat(sustainSlider.value);
    const release = parseFloat(releaseSlider.value);

    gainNode.gain.setValueAtTime(0.001,time);
    gainNode.gain.exponentialRampToValueAtTime(1.0,time+attack);
    gainNode.gain.exponentialRampToValueAtTime(sustain,time+attack+decay);
    gainNode.gain.setValueAtTime(sustain,time+duration-release);
    gainNode.gain.exponentialRampToValueAtTime(0.001,time+duration);

    noteOscillator.start(time);
    noteOscillator.stop(time+duration);
  }

  function shiftGridUp() {
    if (gridPosition>0) {
      gridPosition -= 2;
      updateRowData();
      adjustPlacedNotes();
      drawGrid();
    }
  }

  function shiftGridDown() {
    if (gridPosition + config.logicRows < fullRowData.length) {
      gridPosition += 2;
      updateRowData();
      adjustPlacedNotes();
      drawGrid();
    }
  }

  function updateRowData() {
    rowData = fullRowData.slice(gridPosition, gridPosition+config.logicRows);
  }

  function adjustPlacedNotes() {
    for (let i=placedNotes.length-1; i>=0; i--) {
      const noteRow = placedNotes[i].row;
      if (noteRow<gridPosition || noteRow>=gridPosition+config.logicRows) {
        placedNotes.splice(i,1);
      } else {
        placedNotes[i].rowIndex = placedNotes[i].row - gridPosition;
      }
    }
  }

  shiftUpButton.addEventListener('click', shiftGridUp);
  shiftDownButton.addEventListener('click', shiftGridDown);

  function resizeCanvas() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(()=>{
      const parentWidth = gridContainer.offsetWidth;
      const parentHeight = gridContainer.offsetHeight;

      const totalWidthUnits = config.columnWidths.reduce((a,b)=>a+b,0);
      const totalHeightUnits = config.visualRows*2;

      const widthScalingFactor = parentWidth / totalWidthUnits;
      const heightScalingFactor = parentHeight / totalHeightUnits;
      const scalingFactor = Math.min(widthScalingFactor,heightScalingFactor);

      cellWidth = scalingFactor;
      cellHeight = scalingFactor*2;

      canvas.width = cellWidth*totalWidthUnits;
      canvas.height= cellHeight*config.visualRows;

      canvas.style.width = `${canvas.width}px`;
      canvas.style.height = `${canvas.height}px`;
      drawGrid();
    }, config.debounceDelay);
  }

  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', resizeCanvas);
  resizeCanvas();

  function mod(n,m) {
    return ((n%m)+m)%m;
  }

  function getColumnX(index) {
    let x=0;
    for (let i=0;i<index;i++) {
      x+=config.columnWidths[i]*cellWidth;
    }
    return x;
  }

  function getColumnIndex(x) {
    let cumulativeWidth=0;
    for (let i=0;i<config.columnWidths.length;i++){
      cumulativeWidth+=config.columnWidths[i]*cellWidth;
      if (x<cumulativeWidth) return i;
    }
    return config.columnWidths.length-1;
  }

  function getRowY(index) {
    return (index*0.5)*cellHeight;
  }

  function drawGrid() {
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // DRAW ORDER:
    // 1. Greyed Rows (background)
    drawGreyedRows();

    // 2. Main Grid Lines (vertical, then horizontal)
    drawMainGridVerticalLines();
    drawMainGridHorizontalLines();

    // 3. Y-Axis Lines (on top of main grid)
    drawYAxisVerticalLines();
    drawYAxisHorizontalLines();

    // 4. Legends (labels on top)
    drawLegends();

    if (highlightedCell) highlightSpecificCell(highlightedCell, 'rgba(255,255,0,0.3)');
    if (eraseHighlightedCell) highlightSpecificCell(eraseHighlightedCell, 'rgba(255,0,0,0.3)');

    // 5. Notes last
    redrawNotesAndTails();
  }

  function drawGreyedRows() {
    const mainGridStartX = getColumnX(2);
    const mainGridEndX = isMobile ? getColumnX(config.columnWidths.length) : getColumnX(config.columnWidths.length-2);

    rowData.forEach((row,rowIndex)=>{
      if (row.pitch.toLowerCase().includes('g4')||row.pitch.toLowerCase().includes('g5')) {
        const y = getRowY(rowIndex);
        const rowHeight = cellHeight;
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--greyed-row-color');
        ctx.fillRect(mainGridStartX,y-rowHeight/2,mainGridEndX-mainGridStartX,rowHeight);
      }
    });
  }

  function drawMainGridVerticalLines() {
    let x = getColumnX(2);
    const startIndex=2;
    const endIndex = isMobile ? config.columnWidths.length : config.columnWidths.length-2;

    // Main grid vertical lines as before:
    for (let i=startIndex; i<=endIndex; i++){
      const gridColumn = isMobile ? i-2 : i-8;
      ctx.beginPath();
      ctx.moveTo(x,0);
      ctx.lineTo(x,canvas.height);

      if (gridColumn>=0) {
        if ((gridColumn%8)===0) {
          ctx.strokeStyle='#000';
          ctx.lineWidth=2;
          ctx.setLineDash([]);
          ctx.stroke();
        } else if ([2,4,6].includes(gridColumn%8)) {
          ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--grid-subdivision-color');
          ctx.lineWidth=1;
          ctx.setLineDash([5,5]);
          ctx.stroke();
        }
        // else no line drawn (just skip)
      }

      if (i<endIndex) x+=config.columnWidths[i]*cellWidth;
    }
  }

  function drawMainGridHorizontalLines() {
    const xStart = getColumnX(2);
    const xEnd = isMobile ? getColumnX(config.columnWidths.length) : getColumnX(config.columnWidths.length-2);

    for (let rowIndex=0; rowIndex<rowData.length; rowIndex++) {
      const pitch = rowData[rowIndex].pitch;
      const y = getRowY(rowIndex);
      const style = getMainGridLineStyle(pitch);
      if (style.draw) {
        ctx.beginPath();
        ctx.moveTo(xStart,y);
        ctx.lineTo(xEnd,y);
        ctx.lineWidth=style.lineWidth;
        ctx.setLineDash(style.dash||[]);
        ctx.strokeStyle=style.color;
        ctx.stroke();
      }
    }
  }

  function drawYAxisVerticalLines() {
    let x=0;
    const columnCount = config.columnWidths.length;

    for (let i=0; i<=columnCount; i++){
      const style = getYAxisVerticalLineStyle(i, columnCount);
      if (style) {
        ctx.beginPath();
        ctx.moveTo(x,0);
        ctx.lineTo(x,canvas.height);
        ctx.lineWidth=style.lineWidth;
        ctx.setLineDash(style.dash||[]);
        ctx.strokeStyle=style.color;
        ctx.stroke();
      }

      if (i<columnCount) x+=config.columnWidths[i]*cellWidth;
    }
  }

  function drawYAxisHorizontalLines() {
    // Y-Axis columns are 0 (A), 1 (B)
    const AColWidth = config.columnWidths[0]*cellWidth;
    const BColWidth = config.columnWidths[1]*cellWidth;

    for (let rowIndex=0; rowIndex<rowData.length; rowIndex++){
      const pitch = rowData[rowIndex].pitch;
      const y=getRowY(rowIndex);

      // A column line
      const styleA = getYAxisHorizontalLineStyle(pitch,'A');
      if (styleA.draw) {
        ctx.beginPath();
        ctx.moveTo(0,y);
        ctx.lineTo(AColWidth,y);
        ctx.lineWidth=styleA.lineWidth;
        ctx.setLineDash(styleA.dash);
        ctx.strokeStyle=styleA.color;
        ctx.stroke();
      }

      // B column line
      const styleB = getYAxisHorizontalLineStyle(pitch,'B');
      if (styleB.draw) {
        ctx.beginPath();
        ctx.moveTo(AColWidth,y);
        ctx.lineTo(AColWidth+BColWidth,y);
        ctx.lineWidth=styleB.lineWidth;
        ctx.setLineDash(styleB.dash);
        ctx.strokeStyle=styleB.color;
        ctx.stroke();
      }
    }
  }

  function drawLegends() {
    drawLegend(0,2,false,['A','B']);
    if (!isMobile) {
      drawLegend(config.columnWidths.length-2, config.columnWidths.length,true,['B','A']);
    }
  }

  function drawLegend(startColumnIndex,endColumnIndex,isRightSide=false,columnsOrder=['A','B']){
    const xStart=getColumnX(startColumnIndex);
    const columnWidthsPx = config.columnWidths.slice(startColumnIndex,endColumnIndex).map(w=>w*cellWidth);

    let cumulativeX=xStart;
    columnsOrder.forEach((colLabel,colIndex)=>{
      const columnWidth = columnWidthsPx[colIndex];
      rowData.forEach((row,rowIndex)=>{
        if (row.column===colLabel) {
          const y = getRowY(rowIndex);
          const color = row.color||getComputedStyle(document.documentElement).getPropertyValue('--legend-background-default');
          const pitchName=row.pitch;

          ctx.fillStyle=color;
          ctx.fillRect(cumulativeX,y-cellHeight/2,columnWidth,cellHeight);

          // Top border line
          ctx.beginPath();
          ctx.moveTo(cumulativeX,y-cellHeight/2);
          ctx.lineTo(cumulativeX+columnWidth,y-cellHeight/2);
          ctx.strokeStyle='#000';
          ctx.lineWidth=1;
          ctx.setLineDash([]);
          ctx.stroke();

          const fontSize = Math.max(12, Math.min(cellWidth*0.8, cellHeight*0.8));
          ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--legend-text-color');
          ctx.font=`${fontSize}px 'Zodeka One', sans-serif`;
          ctx.textAlign='center';
          ctx.textBaseline='middle';
          ctx.fillText(pitchName,cumulativeX+columnWidth/2,y);

          // Bottom border line logic:
          const isDbCsharp = pitchName.includes('D♭/C♯');
          const isF = pitchName.startsWith('F')&&!isAccidentalPitch(pitchName);
          const isBColumn=(row.column==='B');

          ctx.beginPath();
          ctx.moveTo(cumulativeX,y+cellHeight/2);
          ctx.lineTo(cumulativeX+columnWidth,y+cellHeight/2);
          if (isDbCsharp) {
            ctx.strokeStyle='#000';
            ctx.lineWidth=3;
            ctx.setLineDash([]);
          } else if (isF&&isBColumn) {
            ctx.strokeStyle='#000';
            ctx.lineWidth=1;
            ctx.setLineDash([5,5]);
          } else {
            ctx.strokeStyle='#000';
            ctx.lineWidth=1;
            ctx.setLineDash([]);
          }
          ctx.stroke();
        }
      });
      cumulativeX+=columnWidth;
    });
  }

  function highlightSpecificCell(cell,color='rgba(255,255,0,0.5)'){
    const {columnIndex,rowIndex}=cell;
    const cellsToHighlight=[{columnIndex,rowIndex}];

    const isDesktop=!isMobile;
    const mainGridEnd = isDesktop ? config.columnWidths.length-2 : config.columnWidths.length;

    if (columnIndex+1<mainGridEnd) {
      cellsToHighlight.push({columnIndex:columnIndex+1,rowIndex});
    }

    cellsToHighlight.forEach(c=>{
      const x=getColumnX(c.columnIndex);
      const y=getRowY(c.rowIndex);
      const columnWidth=config.columnWidths[c.columnIndex]*cellWidth;
      const rowHeight=cellHeight;
      ctx.fillStyle=color;
      ctx.fillRect(x,y-rowHeight/2,columnWidth,rowHeight);
    });
  }

  function drawNoteOnCanvas(note) {
    const noteRowIndex=note.row-gridPosition;
    const y=getRowY(noteRowIndex);

    const xStart=getColumnX(note.startColumnIndex);
    const columnWidth=config.columnWidths[note.startColumnIndex]*cellWidth;
    const nextColumnWidth=(note.endColumnIndex+1<config.columnWidths.length)?
      config.columnWidths[note.endColumnIndex+1]*cellWidth:
      config.columnWidths[note.endColumnIndex]*cellWidth;

    const totalWidth=columnWidth+nextColumnWidth;
    const radius=(totalWidth/2)*0.9;
    const centerX=xStart+(totalWidth)/2;

    ctx.beginPath();
    ctx.arc(centerX,y,radius,0,2*Math.PI);
    ctx.strokeStyle=note.color;
    ctx.lineWidth=6;
    ctx.setLineDash([]);
    ctx.stroke();
  }

  function redrawNotesAndTails() {
    placedNotes.forEach(note=>{
      const noteRowIndex=note.row-gridPosition;
      if (noteRowIndex<0||noteRowIndex>=config.logicRows) return;
      if (note.startColumnIndex===note.endColumnIndex) {
        drawNoteOnCanvas(note);
      } else if (note.startColumnIndex<note.endColumnIndex) {
        drawNoteWithTail(note);
      }
    });
  }

  function drawNoteWithTail(note) {
    drawNoteOnCanvas(note);
    const startX = getColumnX(note.startColumnIndex)+(config.columnWidths[note.startColumnIndex]*cellWidth)/2;
    const endX = getColumnX(note.endColumnIndex)+(config.columnWidths[note.endColumnIndex]*cellWidth)/2;
    const noteRowIndex=note.row-gridPosition;
    const y=getRowY(noteRowIndex);

    ctx.beginPath();
    ctx.moveTo(startX,y);
    ctx.lineTo(endX,y);
    ctx.strokeStyle=note.color;
    ctx.lineWidth=cellWidth*0.3;
    ctx.stroke();
  }

  notes.forEach(note=>{
    note.addEventListener('click',function(event){
      const color=event.target.getAttribute('data-color')||getComputedStyle(document.documentElement).getPropertyValue('--note-default-color');
      if (selectedNoteColor===color) {
        selectedNoteColor=null;
        note.classList.remove('selected');
        highlightedCell=null;
        drawGrid();
      } else {
        selectedNoteColor=color;
        notes.forEach(n=>n.classList.remove('selected'));
        note.classList.add('selected');
        drawGrid();
      }
    });
  });

  canvas.addEventListener('contextmenu',function(event){
    event.preventDefault();
  });

  canvas.addEventListener('mousedown',function(event){
    if (event.button===2) {
      event.preventDefault();
    }

    const rect=canvas.getBoundingClientRect();
    const x=event.clientX-rect.left;
    const y=event.clientY-rect.top;

    let columnIndex=getColumnIndex(x);
    if (columnIndex<2||columnIndex>=config.columnWidths.length-2) {
      return;
    }

    const columnX=getColumnX(Math.floor(columnIndex));
    const nextColumnX=getColumnX(Math.floor(columnIndex)+1);
    const columnMidpoint=(columnX+nextColumnX)/2;
    if (x>columnMidpoint) {
      columnIndex=Math.ceil(columnIndex);
    } else {
      columnIndex=Math.floor(columnIndex);
    }

    const rowIndex=Math.floor((y/canvas.height)*config.logicRows);
    if (rowIndex<0||rowIndex>=config.logicRows) {
      return;
    }
    const row=gridPosition+rowIndex;

    if (event.button===0 && selectedNoteColor) {
      const newNote={
        row:row,
        startColumnIndex:columnIndex,
        endColumnIndex:columnIndex,
        color:selectedNoteColor
      };
      placedNotes.push(newNote);
      isDragging=true;
      currentDraggedNote=newNote;
      event.preventDefault();
      drawGrid();
    } else if (event.button===2) {
      isErasing=true;
      eraseHighlightedCell={columnIndex,rowIndex};
      eraseNoteAtPosition(columnIndex,row);
      eraserTool.classList.add('selected');
      drawGrid();
    }
  });

  canvas.addEventListener('mousemove',function(event){
    const rect=canvas.getBoundingClientRect();
    const x=event.clientX-rect.left;
    const y=event.clientY-rect.top;

    let columnIndex=getColumnIndex(x);
    if (columnIndex<2||columnIndex>=config.columnWidths.length-2) {
      highlightedCell=null;
      eraseHighlightedCell=null;
      drawGrid();
      return;
    }

    const columnX=getColumnX(Math.floor(columnIndex));
    const nextColumnX=getColumnX(Math.floor(columnIndex)+1);
    const columnMidpoint=(columnX+nextColumnX)/2;
    if (x>columnMidpoint) {
      columnIndex=Math.ceil(columnIndex);
    } else {
      columnIndex=Math.floor(columnIndex);
    }

    const row=Math.min(config.logicRows-1, Math.floor((y/canvas.height)*config.logicRows));
    if (row<0||row>=config.logicRows) {
      highlightedCell=null;
      eraseHighlightedCell=null;
      drawGrid();
      return;
    }

    if (isErasing) {
      eraseHighlightedCell={columnIndex,rowIndex:row};
      eraseNoteAtPosition(columnIndex,row);
      drawGrid();
    } else if (selectedNoteColor&&!isDragging) {
      highlightedCell={columnIndex,rowIndex:row};
      drawGrid();
    } else if (isDragging&&currentDraggedNote) {
      let newColumnIndex=columnIndex;
      if (newColumnIndex<2) newColumnIndex=2;
      const mainGridEnd=isMobile?config.columnWidths.length:config.columnWidths.length-2;
      if (newColumnIndex>=mainGridEnd) newColumnIndex=mainGridEnd-1;
      if (newColumnIndex<currentDraggedNote.startColumnIndex) {
        newColumnIndex=currentDraggedNote.startColumnIndex;
      }
      currentDraggedNote.endColumnIndex=newColumnIndex;
      drawGrid();
    }
  });

  window.addEventListener('mouseup',function(event){
    if (event.button===0&&isDragging&&currentDraggedNote) {
      isDragging=false;
      currentDraggedNote=null;
      drawGrid();
    } else if (event.button===2&&isErasing) {
      isErasing=false;
      eraseHighlightedCell=null;
      eraserTool.classList.remove('selected');
      drawGrid();
    }
  });

  canvas.addEventListener('mouseleave',function(event){
    if (isDragging&&currentDraggedNote) {
      isDragging=false;
      currentDraggedNote=null;
      drawGrid();
    }
    if (isErasing) {
      isErasing=false;
      eraseHighlightedCell=null;
      eraserTool.classList.remove('selected');
      drawGrid();
    }
  });

  function eraseNoteAtPosition(columnIndex,rowIndex) {
    const cellsToErase=[{columnIndex,rowIndex}];

    const isDesktop=!isMobile;
    const mainGridEnd=isDesktop?config.columnWidths.length-2:config.columnWidths.length;

    if (columnIndex+1<mainGridEnd) {
      cellsToErase.push({columnIndex:columnIndex+1,rowIndex});
    }

    cellsToErase.forEach(cell=>{
      const noteIndex=placedNotes.findIndex(n=>n.row===cell.rowIndex && n.startColumnIndex<=cell.columnIndex && n.endColumnIndex>=cell.columnIndex);
      if (noteIndex!==-1) {
        placedNotes.splice(noteIndex,1);
      }
    });
  }

  document.addEventListener('click',function(event){
    const isClickInsideCanvas=canvas.contains(event.target);
    const isClickOnNote=event.target.classList.contains('note');
    const isClickOnControl=document.getElementById('controls').contains(event.target);

    if (!isClickInsideCanvas&&!isClickOnNote&&!isClickOnControl) {
      selectedNoteColor=null;
      notes.forEach(n=>n.classList.remove('selected'));
      highlightedCell=null;
      drawGrid();
    }
  });

  function initAudioContext() {
    if (!audioCtx) {
      window.AudioContext=window.AudioContext||window.webkitAudioContext;
      audioCtx=new AudioContext();
      masterGainNode=audioCtx.createGain();
      masterGainNode.gain.value=volumeSlider.value/100;
      masterGainNode.connect(audioCtx.destination);
    }
  }

  playButton.addEventListener('click',playMusic);
  stopButton.addEventListener('click',stopMusic);

  function playMusic() {
    initAudioContext();
    if (audioCtx.state==='suspended') {
      audioCtx.resume();
    }

    scheduledOscillators=[];
    playbackStartTime=audioCtx.currentTime;

    const unitDuration=config.beatDuration/2;
    const totalUnits=config.columnWidths.slice(2,isMobile?undefined:-2).reduce((a,b)=>a+b,0);
    totalPlaybackDuration=totalUnits*unitDuration;

    placedNotes.forEach(note=>{
      const columnIndex=note.startColumnIndex;
      const unitsFromStart=getUnitsFromStart(columnIndex);
      const startTime=playbackStartTime+unitsFromStart*unitDuration;
      const noteRowIndex=note.row-gridPosition;
      const rowInfo=rowData[noteRowIndex];
      const frequency=rowInfo.frequency;

      if (frequency) {
        const unitsDuration=note.endColumnIndex-note.startColumnIndex+1;
        const duration=unitsDuration*unitDuration;
        playNoteAtTime(frequency,startTime,duration);
      }
    });

    animatePlayhead();
  }

  function getUnitsFromStart(columnIndex){
    const startIndex=2;
    const endIndex=columnIndex;
    const unitsFromStart=config.columnWidths.slice(startIndex,endIndex).reduce((a,b)=>a+b,0);
    return unitsFromStart;
  }

  function animatePlayhead(){
    const currentTime=audioCtx.currentTime-playbackStartTime;
    if (currentTime>=totalPlaybackDuration) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId=null;
      playbackStartTime=null;
      drawGrid();
      return;
    }

    drawGrid();
    drawPlayhead(currentTime);
    animationFrameId=requestAnimationFrame(animatePlayhead);
  }

  function drawPlayhead(currentTime){
    const unitDuration=config.beatDuration/2;
    const unitsFromStart=currentTime/unitDuration;

    let cumulativeWidth=getColumnX(2);
    let unitsCounted=0;
    const columnCount=isMobile?config.columnWidths.length:config.columnWidths.length-2;

    for (let i=2;i<columnCount;i++){
      const columnWidthUnits=config.columnWidths[i];
      if (unitsCounted+columnWidthUnits>unitsFromStart) {
        const remainingUnits=unitsFromStart-unitsCounted;
        const x=cumulativeWidth+remainingUnits*cellWidth;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x,0);
        ctx.lineTo(x,canvas.height);
        ctx.strokeStyle='red';
        ctx.lineWidth=2;
        ctx.setLineDash([5,5]);
        ctx.stroke();
        ctx.restore();
        break;
      }
      unitsCounted+=columnWidthUnits;
      cumulativeWidth+=columnWidthUnits*cellWidth;
    }
  }

  function stopMusic() {
    if (audioCtx && audioCtx.state!=='closed') {
      scheduledOscillators.forEach(osc=>{
        try{osc.stop();}catch(e){}
      });
      scheduledOscillators=[];
      audioCtx.suspend();
    }

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId=null;
    }
    playbackStartTime=null;
    drawGrid();
  }

  exportButton.addEventListener('click',exportNotes);
  function exportNotes(){
    const data=placedNotes.map(note=>{
      return `${note.row},${note.startColumnIndex},${note.endColumnIndex},${note.color}`;
    }).join('\n');

    const blob=new Blob([data],{type:'text/plain'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='notation.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  importButton.addEventListener('click',importNotes);
  function importNotes(){
    const input=document.createElement('input');
    input.type='file';
    input.accept='.txt';
    input.onchange=function(event){
      const file=event.target.files[0];
      if(!file) return;
      const reader=new FileReader();
      reader.onload=function(e){
        const content=e.target.result;
        parseImportedNotes(content);
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function parseImportedNotes(data){
    const lines=data.trim().split('\n');
    const importedNotes=[];

    lines.forEach(line=>{
      const [rowStr,startColStr,endColStr,color]=line.split(',');
      const row=parseInt(rowStr,10);
      const startColumnIndex=parseInt(startColStr,10);
      const endColumnIndex=parseInt(endColStr,10);

      if (
        isNaN(row)||isNaN(startColumnIndex)||isNaN(endColumnIndex)||
        row<0||row>=config.logicRows||
        startColumnIndex<0||startColumnIndex>=config.columnWidths.length||
        endColumnIndex<startColumnIndex||endColumnIndex>=config.columnWidths.length
      ){
        console.error('Invalid note data:',line);
        return;
      }

      const note={
        row,
        startColumnIndex,
        endColumnIndex,
        color:color||getComputedStyle(document.documentElement).getPropertyValue('--note-default-color')
      };

      importedNotes.push(note);
    });

    placedNotes.length=0;
    placedNotes.push(...importedNotes);
    drawGrid();
  }

  clearButton.addEventListener('click',clearNotes);
  function clearNotes(){
    placedNotes.length=0;
    drawGrid();
  }

  tempoSlider.addEventListener('input',function(event){
    const bpm=parseInt(event.target.value,10);
    config.beatDuration=60/bpm;
  });

  volumeSlider.addEventListener('input',function(event){
    const volume=parseInt(event.target.value,10);
    if (masterGainNode){
      masterGainNode.gain.value=volume/100;
    }
  });

  function updateHarmonicLevels(){
    harmonicLevels=harmonicSliders.map(s=>parseFloat(s.value));
  }

  function updateSliderBackground(slider){
    const value=parseFloat(slider.value);
    const percentage=value*100;
    slider.style.background=`linear-gradient(to right,var(--slider-fill-color) ${percentage}%,var(--slider-track-color) ${percentage}%)`;
  }

  harmonicSliders.forEach(slider=>{
    slider.addEventListener('input',function(){
      updateHarmonicLevels();
      updateSliderBackground(slider);
    });
    updateSliderBackground(slider);
  });

  presetButtons.sine.addEventListener('click',()=>{
    setPreset([1.000,0.000,0.000,0.000,0.000,0.000,0.000,0.000,0.000,0.000]);
  });

  presetButtons.triangle.addEventListener('click',()=>{
    setPreset([1.000,1.000,0.000,0.111,0.000,0.040,0.000,0.020,0.000,0.012]);
  });

  presetButtons.square.addEventListener('click',()=>{
    setPreset([1.000,1.000,0.000,0.333,0.000,0.200,0.000,0.143,0.000,0.111]);
  });

  presetButtons.sawtooth.addEventListener('click',()=>{
    setPreset([1.000,0.500,0.333,0.250,0.200,0.167,0.143,0.125,0.111,0.100]);
  });

  function setPreset(values){
    harmonicSliders.forEach((slider,index)=>{
      slider.value=values[index];
      updateSliderBackground(slider);
    });
    updateHarmonicLevels();
  }

  document.addEventListener('DOMContentLoaded',function(){
    const defaultBPM=120;
    tempoSlider.value=defaultBPM;
    config.beatDuration=60/defaultBPM;

    const defaultVolume=100;
    volumeSlider.value=defaultVolume;

    setPreset([1,0,0,0,0,0,0,0,0,0]);
  });

  drawGrid();
})();
