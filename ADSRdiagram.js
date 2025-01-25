/******************************
 * ADSRDiagram.js
 ******************************/

(function() {
    'use strict';
  
    /********************************
     * CONSTANTS & DOM REFERENCES
     ********************************/
    // Reference to the SVG and its elements
    const svg = document.getElementById('adsr-svg');
    const adsrPath = document.getElementById('adsr-path');
    const adsrPlayhead = document.getElementById('adsr-playhead');
    const attackNode = document.getElementById('attack-node');
    const decaySustainNode = document.getElementById('decay-sustain-node');
    const releaseNode = document.getElementById('release-node');
  
    // Reference to ADSR sliders
    const attackSlider = document.getElementById('attack-slider');
    const decaySlider = document.getElementById('decay-slider');
    const sustainSlider = document.getElementById('sustain-slider');
    const releaseSlider = document.getElementById('release-slider');
  
    // SVG dimensions and scaling
    const WIDTH = 400, HEIGHT = 150;
    const TOP_Y = 20, BOTTOM_Y = 130;
    const AMP_HEIGHT = BOTTOM_Y - TOP_Y;
    const X_SCALE = 100; // 1 second = 100px
  
    // ADSR state and current values
    let adsr = {
      attack: parseFloat(attackSlider.value),
      decay: parseFloat(decaySlider.value),
      sustain: parseFloat(sustainSlider.value),
      release: parseFloat(releaseSlider.value)
    };
    let adsrState = 'idle';
    let noteOnTime = 0, noteReleaseTime = 0;
  
    /********************************
     * UPDATE FUNCTIONS
     ********************************/
    function updateDiagramFromADSR() {
      const A_x = adsr.attack * X_SCALE;
      const A_y = TOP_Y;
  
      const D_x = (adsr.attack + adsr.decay) * X_SCALE;
      const D_y = BOTTOM_Y - (adsr.sustain * AMP_HEIGHT);
  
      const R_x = (adsr.attack + adsr.decay + adsr.release) * X_SCALE;
      const R_y = BOTTOM_Y;
  
      // Update path
      adsrPath.setAttribute('d', `M0,${BOTTOM_Y} L${A_x},${A_y} L${D_x},${D_y} L${R_x},${R_y}`);
  
      // Update nodes
      attackNode.setAttribute('cx', A_x);
      attackNode.setAttribute('cy', A_y);
  
      decaySustainNode.setAttribute('cx', D_x);
      decaySustainNode.setAttribute('cy', D_y);
  
      releaseNode.setAttribute('cx', R_x);
      releaseNode.setAttribute('cy', R_y);
    }
  
    function updateADSRValues() {
      adsr.attack = parseFloat(attackSlider.value);
      adsr.decay = parseFloat(decaySlider.value);
      adsr.sustain = parseFloat(sustainSlider.value);
      adsr.release = parseFloat(releaseSlider.value);
      updateDiagramFromADSR();
    }
  
    /********************************
     * PLAYHEAD ANIMATION
     ********************************/
    function getADSRAmplitude(currentTime) {
      const tSinceOn = currentTime - noteOnTime;
  
      if (adsrState === 'attack') {
        if (tSinceOn >= adsr.attack) {
          adsrState = 'decay';
          return 1.0;
        }
        return tSinceOn / adsr.attack;
      }
      if (adsrState === 'decay') {
        const tDecay = tSinceOn - adsr.attack;
        if (tDecay >= adsr.decay) {
          adsrState = 'sustain';
          return adsr.sustain;
        }
        const fraction = tDecay / adsr.decay;
        return 1 - fraction * (1 - adsr.sustain);
      }
      if (adsrState === 'sustain') {
        return adsr.sustain;
      }
      if (adsrState === 'release') {
        const tSinceRelease = currentTime - noteReleaseTime;
        if (tSinceRelease >= adsr.release) {
          adsrState = 'done';
          return 0;
        }
        const fraction = tSinceRelease / adsr.release;
        return adsr.sustain * (1 - fraction);
      }
      return 0;
    }
  
    function updatePlayhead() {
      if (adsrState === 'done' || adsrState === 'idle') {
        adsrPlayhead.setAttribute('d', '');
        return;
      }
  
      const now = window.AudioPlayback.audioCtx.currentTime;
      const amplitude = getADSRAmplitude(now);
      const x = (now - noteOnTime) * X_SCALE;
      const y = BOTTOM_Y - amplitude * AMP_HEIGHT;
  
      adsrPlayhead.setAttribute('d', `M0,${BOTTOM_Y} L${x},${y}`);
  
      requestAnimationFrame(updatePlayhead);
    }
  
    /********************************
     * EVENT HANDLERS
     ********************************/
    attackSlider.addEventListener('input', updateADSRValues);
    decaySlider.addEventListener('input', updateADSRValues);
    sustainSlider.addEventListener('input', updateADSRValues);
    releaseSlider.addEventListener('input', updateADSRValues);
  
    window.startNote = function() {
      adsrState = 'attack';
      noteOnTime = window.AudioPlayback.audioCtx.currentTime;
      requestAnimationFrame(updatePlayhead);
    };
  
    window.releaseNote = function() {
      if (adsrState === 'sustain') {
        adsrState = 'release';
        noteReleaseTime = window.AudioPlayback.audioCtx.currentTime;
      }
    };
  
    // Initial setup
    document.addEventListener('DOMContentLoaded', updateDiagramFromADSR);
  
  })();
  
