/******************************
 * Audio Playback.js
 ******************************/
(function() {
    'use strict';
  
    /************************************
     * DOM Elements
     ************************************/
    const playButton    = document.getElementById('play-button');
    const stopButton    = document.getElementById('stop-button');
    const clearButton   = document.getElementById('clear-button'); // If you want "Clear" logic here
    const volumeSlider  = document.getElementById('volume-slider');
    const tempoSlider   = document.getElementById('tempo-slider');
    const attackSlider  = document.getElementById('attack-slider');
    const decaySlider   = document.getElementById('decay-slider');
    const sustainSlider = document.getElementById('sustain-slider');
    const releaseSlider = document.getElementById('release-slider');
  
    // We use the same canvas as the Notation Grid for the playhead
    const canvas = document.getElementById('notation-grid');
    const ctx = canvas.getContext('2d');
  
    /************************************
     * Configuration
     ************************************/
    // If you prefer to rely on NotationGrid.config, you can do:
    //   const config = window.NotationGrid.config;
    // Or define your own local config here if you keep them separate.
    const config = window.NotationGrid
      ? window.NotationGrid.config
      : {
          // fallback if NotationGrid.config isn't present
          columnWidths: [3,3, ...Array(6).fill(1), ...Array(32).fill(1), 3,3],
          beatDuration: 60 / 120
        };
  
    /************************************
     * Audio Context + Gain
     ************************************/
    let audioCtx        = null;
    let masterGainNode  = null;
    let scheduledOscillators = [];
  
    // Start or reuse audio context
    function initAudioContext() {
      if (!audioCtx) {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        masterGainNode = audioCtx.createGain();
        masterGainNode.connect(audioCtx.destination);
        // Set initial volume from slider
        if (volumeSlider) {
          masterGainNode.gain.value = parseInt(volumeSlider.value, 10) / 100;
        }
      }
    }
  
    /************************************
     * ADSR Envelope
     ************************************/
    // Called inside playNoteAtTime to shape the note
    function applyADSR(gainNode, startTime, duration) {
      const attack  = parseFloat(attackSlider.value);
      const decay   = parseFloat(decaySlider.value);
      const sustain = parseFloat(sustainSlider.value);
      const release = parseFloat(releaseSlider.value);
  
      // Attack from near-zero up to 1.0
      gainNode.gain.setValueAtTime(0.001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(1.0, startTime + attack);
  
      // Decay down to sustain
      gainNode.gain.exponentialRampToValueAtTime(sustain, startTime + attack + decay);
  
      // Sustain for most of the note, then release
      const releaseStart = startTime + duration - release;
      if (releaseStart > startTime + attack + decay) {
        // Only schedule release if it doesn't overlap Attack/Decay
        gainNode.gain.setValueAtTime(sustain, releaseStart);
        gainNode.gain.exponentialRampToValueAtTime(0.001, releaseStart + release);
      }
    }
  
    /************************************
     * Periodic Wave (Harmonics)
     ************************************/
    function createHarmonicOscillator(frequency, startTime) {
      const oscNode = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
  
      // Build the PeriodicWave from window.harmonicLevels
      // (which an external file, e.g. Toolbar.js, sets)
      const levels = window.harmonicLevels || [1,0,0,0,0,0,0,0,0,0];
      const real = new Float32Array(levels.length + 1);
      const imag = new Float32Array(levels.length + 1);
      // Index 0 must be 0 for a typical custom wave
      real[0] = 0; 
      imag[0] = 0;
      levels.forEach((level, i) => {
        real[i + 1] = level;
        imag[i + 1] = 0;
      });
      const periodicWave = audioCtx.createPeriodicWave(real, imag, {
        disableNormalization: false
      });
      oscNode.setPeriodicWave(periodicWave);
      oscNode.frequency.setValueAtTime(frequency, startTime);
  
      oscNode.connect(gainNode);
      gainNode.connect(masterGainNode);
  
      return { oscNode, gainNode };
    }
  
    /************************************
     * Note Scheduling
     ************************************/
    function playNoteAtTime(frequency, startTime, duration) {
      const { oscNode, gainNode } = createHarmonicOscillator(frequency, startTime);
      applyADSR(gainNode, startTime, duration);
  
      // Start & stop
      oscNode.start(startTime);
      oscNode.stop(startTime + duration);
  
      // Keep reference if needed for stopping early
      scheduledOscillators.push(oscNode);
    }
  
    // Called once user presses "Play"
    let playbackStartTime = null;
    let totalPlaybackDuration = null;
    let animationFrameId = null;
  
    function playMusic() {
      if (!window.placedNotes) return;
      initAudioContext();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
  
      scheduledOscillators = [];
      playbackStartTime = audioCtx.currentTime;
  
      const unitDuration = config.beatDuration / 2;
      // We skip columns 0..1 (left Y-axis) and last 2 (right Y-axis)
      const totalUnits = config.columnWidths
        .slice(2, config.columnWidths.length - 2)
        .reduce((a, b) => a + b, 0);
      totalPlaybackDuration = totalUnits * unitDuration;
  
      // Schedule each placed note
      window.placedNotes.forEach(note => {
        const freq = getFrequencyForNote(note);
        if (!freq) return;
        // Calculate start time and duration in "units"
        const startUnits = getUnitsFromStart(note.startColumnIndex);
        const durationUnits = note.endColumnIndex - note.startColumnIndex + 1;
        const noteStartTime = playbackStartTime + startUnits * unitDuration;
        const noteDuration  = durationUnits * unitDuration;
  
        playNoteAtTime(freq, noteStartTime, noteDuration);
      });
  
      // Start animating the red playhead
      animatePlayhead();
    }
  
    // Helper: sum up column widths from column 2..(note.startColumnIndex)
    function getUnitsFromStart(columnIndex) {
      const startIndex = 2;
      let sum = 0;
      for (let i = startIndex; i < columnIndex; i++) {
        sum += config.columnWidths[i];
      }
      return sum;
    }
  
    // If your notes store row/frequency differently, adapt here
    // In the original code, each row in your `fullRowData` had { pitch, frequency }.
    // This example just calls a function or does an array lookup.
    function getFrequencyForNote(note) {
      // If you have a `window.fullRowData` or we rely on `NotationGrid` data:
      //   const rowIndex = note.row; // absolute row in full data
      //   return window.fullRowData[rowIndex]?.frequency ?? null;
      // Adjust as needed:
      if (!window.fullRowData) return null;
      const rowEntry = window.fullRowData[note.row];
      return rowEntry && rowEntry.frequency ? rowEntry.frequency : null;
    }
  
    /************************************
     * Animation (Playhead)
     ************************************/
    function animatePlayhead() {
      const currentTime = audioCtx.currentTime - playbackStartTime;
      if (currentTime >= totalPlaybackDuration) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        playbackStartTime = null;
        // If NotationGrid is defined, redraw once to remove final line
        if (window.NotationGrid && window.NotationGrid.drawGrid) {
          window.NotationGrid.drawGrid();
        }
        return;
      }
  
      // If NotationGrid is defined, let it redraw everything...
      if (window.NotationGrid && window.NotationGrid.drawGrid) {
        window.NotationGrid.drawGrid();
        // ...then draw the red line on top
        drawPlayhead(currentTime);
      } else {
        // If you want to draw the line manually without NotationGrid,
        // you'd do something like:
        //   ctx.clearRect(0, 0, canvas.width, canvas.height);
        //   drawPlayhead(currentTime);
        // Or skip it entirely.
      }
  
      animationFrameId = requestAnimationFrame(animatePlayhead);
    }
  
    function drawPlayhead(currentTime) {
      // how many "units" have elapsed
      const unitDuration = config.beatDuration / 2;
      const unitsFromStart = currentTime / unitDuration;
  
      let cumulativeWidth = getColumnX(2);
      let unitsCounted = 0;
      const endIndex = config.columnWidths.length - 2;
  
      for (let i = 2; i < endIndex; i++) {
        const colWidthUnits = config.columnWidths[i];
        if (unitsCounted + colWidthUnits > unitsFromStart) {
          const remainder = unitsFromStart - unitsCounted;
          const x = cumulativeWidth + remainder * cellWidth();
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.strokeStyle = 'red';
          ctx.lineWidth = 2;
          ctx.setLineDash([5,5]);
          ctx.stroke();
          ctx.restore();
          break;
        }
        unitsCounted += colWidthUnits;
        cumulativeWidth += colWidthUnits * cellWidth();
      }
    }
  
    // Helper to get X pixel offset for a given column (partially replicates NotationGrid)
    function getColumnX(colIndex) {
      let x = 0;
      for (let i = 0; i < colIndex; i++) {
        x += config.columnWidths[i] * cellWidth();
      }
      return x;
    }
  
    // We need cellWidth() from NotationGrid or local. Typically:
    function cellWidth() {
      // If NotationGrid is present, reuse its computed cellWidth
      if (window.NotationGrid && window.NotationGrid.resizeCanvas) {
        // If we store a global or a public variable for cellWidth in NotationGrid
        // we could read it. Otherwise, for simplicity, pick a default or recalc.
        // For a minimal approach, we can assume something:
        return canvas.width / config.columnWidths.reduce((a,b)=>a+b,0);
      }
      // Fallback if no NotationGrid
      return canvas.width / config.columnWidths.reduce((a,b)=>a+b,0);
    }
  
    /************************************
     * Stop + Clear
     ************************************/
    function stopMusic() {
      if (audioCtx && audioCtx.state !== 'closed') {
        scheduledOscillators.forEach(osc => {
          try {
            osc.stop();
          } catch (e) {
            /* ignore already stopped */
          }
        });
        scheduledOscillators = [];
        // Pause the audio context so no new envelopes start
        audioCtx.suspend();
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      playbackStartTime = null;
      // Redraw to remove playhead line
      if (window.NotationGrid && window.NotationGrid.drawGrid) {
        window.NotationGrid.drawGrid();
      }
    }
  
    // If you want to clear notes from here (some prefer doing this in the toolbar)
    function clearNotes() {
      if (!window.placedNotes) return;
      window.placedNotes.length = 0;
      if (window.NotationGrid && window.NotationGrid.drawGrid) {
        window.NotationGrid.drawGrid();
      }
    }
  
    /************************************
     * Event Listeners
     ************************************/
    if (playButton) {
      playButton.addEventListener('click', playMusic);
    }
    if (stopButton) {
      stopButton.addEventListener('click', stopMusic);
    }
    if (clearButton) {
      clearButton.addEventListener('click', clearNotes);
    }
  
    // Volume slider => masterGainNode
    if (volumeSlider) {
      volumeSlider.addEventListener('input', function(e) {
        const volValue = parseInt(e.target.value, 10);
        if (masterGainNode) {
          masterGainNode.gain.value = volValue / 100;
        }
      });
    }
  
    // Tempo slider => set config.beatDuration
    if (tempoSlider) {
      tempoSlider.addEventListener('input', function(e) {
        const bpm = parseInt(e.target.value, 10);
        config.beatDuration = 60 / bpm;
      });
    }
  
    /************************************
     * Public API (Optional)
     ************************************/
    window.AudioPlayback = {
      playMusic,
      stopMusic,
      clearNotes,
      initAudioContext
      // ...any others you want to expose
    };
  
  })();
  
