/******************************
 * Toolbar.js
 ******************************/
(function() {
    'use strict';
  
    /************************************
     * DOM Elements: Toolbar + ADSR
     ************************************/
  
    // Title and Import/Export
    const titleInput = document.getElementById('title-input');
    const exportButton = document.getElementById('export-button');
    const importButton = document.getElementById('import-button');
  
    // Waveform Preset Buttons
    const presetButtons = {
      sine: document.getElementById('preset-sine'),
      triangle: document.getElementById('preset-triangle'),
      square: document.getElementById('preset-square'),
      sawtooth: document.getElementById('preset-sawtooth')
    };
  
    // Harmonic Sliders
    const harmonicSliders = [];
    for (let i = 0; i <= 9; i++) {
      harmonicSliders.push(document.getElementById(`harmonic-${i}`));
    }
  
    // ADSR Sliders
    const attackSlider  = document.getElementById('attack-slider');
    const decaySlider   = document.getElementById('decay-slider');
    const sustainSlider = document.getElementById('sustain-slider');
    const releaseSlider = document.getElementById('release-slider');
  
    // Notes Container and Eraser
    const notes = document.querySelectorAll('.note');
    const eraserTool = document.getElementById('eraser-tool');
  
    // Shift Grid
    const shiftUpButton = document.getElementById('shift-up-button');
    const shiftDownButton = document.getElementById('shift-down-button');
  
    /************************************
     * Harmonic Levels + Presets
     ************************************/
    // Default array of 10 harmonics; H0 = fundamental.
    let harmonicLevels = Array(10).fill(0);
    harmonicLevels[0] = 1;
  
    function updateHarmonicLevels() {
      harmonicLevels = harmonicSliders.map(s => parseFloat(s.value));
    }
  
    // Visually color the slider track
    function updateSliderBackground(slider) {
      const value = parseFloat(slider.value);
      const percentage = value * 100;
      slider.style.background =
        `linear-gradient(to right, var(--slider-fill-color) ${percentage}%, var(--slider-track-color) ${percentage}%)`;
    }
  
    harmonicSliders.forEach(slider => {
      slider.addEventListener('input', function() {
        updateHarmonicLevels();
        updateSliderBackground(slider);
        // You could call drawGrid() or other refresh logic here if desired
      });
      // Initialize each slider's background on load
      updateSliderBackground(slider);
    });
  
    // Preset Buttons
    function setPreset(values) {
      harmonicSliders.forEach((slider, index) => {
        slider.value = values[index];
        updateSliderBackground(slider);
      });
      updateHarmonicLevels();
    }
  
    presetButtons.sine.addEventListener('click', () => {
      setPreset([1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]);
    });
  
    presetButtons.triangle.addEventListener('click', () => {
      setPreset([1.0, 1.0, 0.0, 0.111, 0.0, 0.040, 0.0, 0.020, 0.0, 0.012]);
    });
  
    presetButtons.square.addEventListener('click', () => {
      setPreset([1.0, 1.0, 0.0, 0.333, 0.0, 0.200, 0.0, 0.143, 0.0, 0.111]);
    });
  
    presetButtons.sawtooth.addEventListener('click', () => {
      setPreset([1.0, 0.5, 0.333, 0.25, 0.2, 0.167, 0.143, 0.125, 0.111, 0.1]);
    });
  
    /************************************
     * ADSR
     ************************************/
    // Attack, Decay, Sustain, Release sliders (only UI code here)
    // If you have logic that uses them, that typically goes in your Audio code
  
    /************************************
     * Notes + Eraser Tool
     ************************************/
    let selectedNoteColor = null;
  
    notes.forEach(note => {
      note.addEventListener('click', function(event) {
        const color = event.target.getAttribute('data-color') ||
                      getComputedStyle(document.documentElement)
                        .getPropertyValue('--note-default-color');
        if (selectedNoteColor === color) {
          // Deselect if already selected
          selectedNoteColor = null;
          window.selectedNoteColor = null;  // <-- also set global to null
          note.classList.remove('selected');
        } else {
          // Select new color
          selectedNoteColor = color;
          window.selectedNoteColor = color; // <-- also set global
          // Clear selection from other notes
          notes.forEach(n => n.classList.remove('selected'));
          note.classList.add('selected');
        }
      });
    });
  
    // Eraser tool is typically used on the canvas events, but we can at least show selection here
    eraserTool.addEventListener('click', () => {
      if (eraserTool.classList.contains('selected')) {
        eraserTool.classList.remove('selected');
      } else {
        // Deselect other note colors
        notes.forEach(n => n.classList.remove('selected'));
        selectedNoteColor = null;
        window.selectedNoteColor = null; // <-- clear the global color
        eraserTool.classList.add('selected');
      }
    });
    
  
    /************************************
     * Shift Grid Buttons
     ************************************/
    shiftUpButton.addEventListener('click', () => {
      window.NotationGrid.shiftGridUp();
      window.NotationGrid.drawGrid();
    });
    
    shiftDownButton.addEventListener('click', () => {
      window.NotationGrid.shiftGridDown();
      window.NotationGrid.drawGrid();
    });
    
    /*************************************
     * ADSR Diagram Logic
     *************************************/
    (function() {
      'use strict';

      // 1) Get references to the ADSR Sliders
      const attackSlider   = document.getElementById('attack-slider');
      const decaySlider    = document.getElementById('decay-slider');
      const sustainSlider  = document.getElementById('sustain-slider');
      const releaseSlider  = document.getElementById('release-slider');

      // 2) Get references to the SVG elements
      const adsrSVG             = document.getElementById('adsr-svg');
      const adsrPath            = document.getElementById('adsr-path');
      const attackNode          = document.getElementById('attack-node');
      const decaySustainNode    = document.getElementById('decay-sustain-node');
      const releaseNode         = document.getElementById('release-node');

      // We’ll assume your SVG is 400px wide x 150px high:
      const WIDTH  = 400;
      const HEIGHT = 150;

      // The amplitude = 1.0 corresponds to ~20px from top, amplitude=0 => ~130px (from top).
      // (You can tweak these to move the envelope up/down.)
      const TOP_Y       = 20;
      const BOTTOM_Y    = 130;
      const AMP_HEIGHT  = BOTTOM_Y - TOP_Y; // ~110 px for amplitude range

      // Attack/Decay/Release each range 0..2 seconds => we’ll map that to 0..200 px
      // i.e. 1 second = 100 px
      const X_SCALE     = 100;

      // We'll store the four values in an object so it's easy to read/update.
      let adsr = {
        attack:  parseFloat(attackSlider.value),
        decay:   parseFloat(decaySlider.value),
        sustain: parseFloat(sustainSlider.value),
        release: parseFloat(releaseSlider.value)
      };

      /**
       * Based on current ADSR, compute positions for the three nodes, then update the <path> d.
       */
      function updateDiagramFromADSR() {
        // Attack node: x= attack * X_SCALE, y= top (peak)
        const A_x = adsr.attack * X_SCALE;
        const A_y = TOP_Y;

        // Decay/Sustain node: x= (attack + decay) * X_SCALE, y= sustain amplitude
        const D_x = (adsr.attack + adsr.decay) * X_SCALE;
        // y = BOTTOM_Y - (sustain * AMP_HEIGHT)
        const D_y = BOTTOM_Y - (adsr.sustain * AMP_HEIGHT);

        // Release node: x= (attack + decay + release) * X_SCALE, y= bottom (0 amplitude)
        const R_x = (adsr.attack + adsr.decay + adsr.release) * X_SCALE;
        const R_y = BOTTOM_Y;

        // Move the three circles
        attackNode.setAttribute('cx', A_x);
        attackNode.setAttribute('cy', A_y);

        decaySustainNode.setAttribute('cx', D_x);
        decaySustainNode.setAttribute('cy', D_y);

        releaseNode.setAttribute('cx', R_x);
        releaseNode.setAttribute('cy', R_y);

        // Path: M0,bottom -> Attack -> Decay -> Release
        // Start from x=0, y=bottom (which is amplitude=0).
        const pathData = `M0,${BOTTOM_Y}
                          L${A_x},${A_y}
                          L${D_x},${D_y}
                          L${R_x},${R_y}`;
        adsrPath.setAttribute('d', pathData);
      }

      /**
       * When a slider moves, store new ADSR values, then update the diagram.
       */
      function sliderChanged() {
        adsr.attack  = parseFloat(attackSlider.value);
        adsr.decay   = parseFloat(decaySlider.value);
        adsr.sustain = parseFloat(sustainSlider.value);
        adsr.release = parseFloat(releaseSlider.value);
        updateDiagramFromADSR();
      }

      [attackSlider, decaySlider, sustainSlider, releaseSlider].forEach(slider => {
        slider.addEventListener('input', sliderChanged);
      });

      /**
       * DRAG-AND-DROP SUPPORT
       * We’ll let the user drag each node horizontally or vertically (if needed).
       */
      let activeNode = null;

      function getSVGCoords(evt) {
        // Convert mouse coords to the local SVG coordinate system
        const pt = adsrSVG.createSVGPoint();
        pt.x = evt.clientX;
        pt.y = evt.clientY;
        const svgP = pt.matrixTransform(adsrSVG.getScreenCTM().inverse());
        return { x: svgP.x, y: svgP.y };
      }

      function startDrag(evt) {
        activeNode = evt.target; // which circle is clicked
      }

      function drag(evt) {
        if (!activeNode) return;
        evt.preventDefault();
        const { x, y } = getSVGCoords(evt);

        // Attack node => controls adsr.attack (horizontal only)
        if (activeNode === attackNode) {
          let newAttack = x / X_SCALE;
          // clamp 0..2
          if (newAttack < 0) newAttack = 0;
          if (newAttack > 2) newAttack = 2;
          adsr.attack = newAttack;
        }
        // Decay/Sustain node => adsr.decay (horizontal) & adsr.sustain (vertical)
        else if (activeNode === decaySustainNode) {
          // Horizontal => decay is x minus the attack portion
          let newDecay = (x / X_SCALE) - adsr.attack;
          if (newDecay < 0) newDecay = 0;
          if (newDecay > 2) newDecay = 2;
          adsr.decay = newDecay;

          // Vertical => sustain amplitude
          let amplitude = 1 - (y - TOP_Y) / AMP_HEIGHT;
          if (amplitude < 0) amplitude = 0;
          if (amplitude > 1) amplitude = 1;
          adsr.sustain = amplitude;
        }
        // Release node => adsr.release (horizontal only)
        else if (activeNode === releaseNode) {
          let newRelease = (x / X_SCALE) - (adsr.attack + adsr.decay);
          if (newRelease < 0) newRelease = 0;
          if (newRelease > 2) newRelease = 2;
          adsr.release = newRelease;
        }

        // Update the actual slider elements
        attackSlider.value  = adsr.attack;
        decaySlider.value   = adsr.decay;
        sustainSlider.value = adsr.sustain;
        releaseSlider.value = adsr.release;

        // Re-draw
        updateDiagramFromADSR();
      }

      function endDrag() {
        activeNode = null;
      }

      // Attach event listeners
      [attackNode, decaySustainNode, releaseNode].forEach(node => {
        node.addEventListener('mousedown', startDrag);
      });
      adsrSVG.addEventListener('mousemove', drag);
      adsrSVG.addEventListener('mouseup', endDrag);
      adsrSVG.addEventListener('mouseleave', endDrag);

      // 3) On page load, or DOMContentLoaded, sync once:
      document.addEventListener('DOMContentLoaded', function() {
        updateDiagramFromADSR();
      });
    })();

  
    /************************************
     * Export / Import
     ************************************/
    // If placedNotes is a global or passed from elsewhere, you can use it here.
    // The code below is identical to your original script, minus mobile references.
    function exportNotes() {
      // Example: uses a global or external 'placedNotes' array
      if (!window.placedNotes) return;
  
      const data = window.placedNotes.map(note => {
        return `${note.row},${note.startColumnIndex},${note.endColumnIndex},${note.color}`;
      }).join('\n');
  
      const blob = new Blob([data], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'notation.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  
    function importNotes() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt';
      input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
          const content = e.target.result;
          parseImportedNotes(content);
          // Optionally: drawGrid() if you want to refresh
        };
        reader.readAsText(file);
      };
      input.click();
    }
  
    function parseImportedNotes(data) {
      // Example: uses a global or external 'placedNotes' array + config
      if (!window.placedNotes) return;
  
      const lines = data.trim().split('\n');
      const importedNotes = [];
  
      lines.forEach(line => {
        const [rowStr, startColStr, endColStr, color] = line.split(',');
        const row = parseInt(rowStr, 10);
        const startColumnIndex = parseInt(startColStr, 10);
        const endColumnIndex = parseInt(endColStr, 10);
  
        // If you want bounds-checking, you can do so here:
        // if (row < 0 || row >= config.logicRows) { ... }
  
        const note = {
          row,
          startColumnIndex,
          endColumnIndex,
          color: color || getComputedStyle(document.documentElement)
                          .getPropertyValue('--note-default-color')
        };
        importedNotes.push(note);
      });
  
      window.placedNotes.length = 0;
      window.placedNotes.push(...importedNotes);
    }
  
    exportButton.addEventListener('click', exportNotes);
    importButton.addEventListener('click', importNotes);
  
    /************************************
     * Default Initialization
     ************************************/
    document.addEventListener('DOMContentLoaded', function() {
      // Example: set a default BPM or default harmonic preset
      setPreset([1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      // Optionally restore volume, ADSR defaults, etc.
    });
  
  })();
  
