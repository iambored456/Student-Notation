// js/components/Harmonics-Filter/harmonicBins.js
import * as Tone from 'tone';
import store from '@state/index.js';
import { HARMONIC_BINS } from '@/core/constants.js';
import SynthEngine from '@services/synthEngine.js';
import { hexToRgba, shadeHexColor } from '@utils/colorUtils.js';
import logger from '@utils/logger.js';
import phaseIcon0 from '/assets/tabicons/phaseButton_0.svg?raw';
import phaseIcon90 from '/assets/tabicons/phaseButton_90.svg?raw';
import phaseIcon180 from '/assets/tabicons/phaseButton_180.svg?raw';
import phaseIcon270 from '/assets/tabicons/phaseButton_270.svg?raw';

logger.moduleLoaded('HarmonicBins with Columnar Structure');

const harmonicBinsDebugMessages = [];

function recordHarmonicBinsDebug(level, ...args) {
  harmonicBinsDebugMessages.push({ level, args, timestamp: Date.now() });
}

const phaseIconPaths = {
  0: phaseIcon0,
  90: phaseIcon90,
  180: phaseIcon180,
  270: phaseIcon270
};


const BINS = HARMONIC_BINS;
let overlayCanvas, overlayCtx;
let coeffs = new Float32Array(BINS).fill(0);
let currentColor;
let phases = new Float32Array(BINS).fill(0);
const binColumns = [];
const phaseControls = [];
let isAuditioning = false;
let harmonicBinsGrid = null;
const zeroUpdateTimeouts = new Array(BINS).fill(null);
let isDraggingBin = false; // Track if user is actively dragging a bin

// REMOVED: Amplitude normalization function (was causing coefficient contamination)

function getFilterAmplitudeAt(norm_pos, filterSettings) {
  const { blend, cutoff, resonance } = filterSettings;
  // Map cutoff (1-31) to normalized position across the 12 bins
  const norm_cutoff = (cutoff - 1) / (31 - 1);

  // Use linear distance instead of ratio for consistent curve width
  const steepness = 20; // Higher value creates sharper bandpass falloff
  const lp_distance = norm_pos - norm_cutoff;  // Distance right of cutoff
  const hp_distance = norm_cutoff - norm_pos;  // Distance left of cutoff

  // Apply steepness to distances (now maintains consistent curve shape)
  let lp = 1 / (1 + Math.pow(Math.max(0, lp_distance * steepness), 2));
  let hp = 1 / (1 + Math.pow(Math.max(0, hp_distance * steepness), 2));

  // Clamp near-zero values to exactly zero for cleaner filter tails
  const ZERO_THRESHOLD = 0.01;
  if (lp < ZERO_THRESHOLD) {lp = 0;}
  if (hp < ZERO_THRESHOLD) {hp = 0;}

  // Bandpass: product of LP and HP, normalized to 0-1 range
  const bp = lp * hp;

  let shape;
  if (blend <= 1.0) {
    // Blend from highpass (0) to bandpass (1)
    shape = hp * (1 - blend) + bp * blend;
  } else {
    // Blend from bandpass (1) to lowpass (2)
    shape = bp * (2 - blend) + lp * (blend - 1);
  }

  const res_q = 1.0 - (resonance || 0) / 105;
  const peak_width = Math.max(0.01, 0.2 * res_q * res_q);
  const peak = Math.exp(-Math.pow((norm_pos - norm_cutoff) / peak_width, 2));
  const res_gain = ((resonance || 0) / 100) * 0.6;

  // Add resonance peak but ensure total stays within 0-1 bounds
  const result = shape + peak * res_gain;

  // Final clamping with zero threshold
  const finalResult = Math.max(0, Math.min(1.0, result));
  return finalResult < ZERO_THRESHOLD ? 0 : finalResult;
}

function applyFilterMix(filterAmp, mixAmount) {
  // Apply mix: when mix = 0, no filtering (amp = 1), when mix = 100, full filtering
  const mixNorm = mixAmount / 100;
  return 1 - mixNorm + (mixNorm * filterAmp);
}

// Store discrete filter values for each bin
const binFilterValues = new Float32Array(BINS).fill(1);

// Store filtered coefficients (separate from original coefficients)
let filteredCoeffs = new Float32Array(BINS).fill(0);

function applyDiscreteFiltering(originalCoeffs, filterSettings) {
  const mixAmount = filterSettings.mix || 0;

  if (mixAmount === 0) {
    // No filtering - return original coefficients
    return new Float32Array(originalCoeffs);
  }

  const filtered = new Float32Array(originalCoeffs.length);
  const mixNormalized = mixAmount / 100; // 0-1 range

  for (let i = 0; i < originalCoeffs.length; i++) {
    const harmonicAmplitude = originalCoeffs[i]; // Y position of harmonic (0-1)

    // Get discrete filter curve value at this bin's center
    const binCenterFreq = (i + 0.5) / BINS; // Normalized frequency (0-1)
    const filterCurveLevel = getFilterAmplitudeAt(binCenterFreq, filterSettings); // 0-1

    // Apply filtering logic
    if (filterCurveLevel < harmonicAmplitude) {
      // Filter curve is below harmonic - apply attenuation
      const distance = harmonicAmplitude - filterCurveLevel;
      const reduction = distance * mixNormalized;

      // When Mix = 100%, harmonic is reduced to exactly the filter curve level
      filtered[i] = harmonicAmplitude - reduction;
    } else {
      // Filter curve is above or equal to harmonic - no attenuation needed
      filtered[i] = harmonicAmplitude;
    }

    // Ensure we don't go below zero
    filtered[i] = Math.max(0, filtered[i]);
  }

  return filtered;
}

// Export function to get filtered coefficients for waveform visualization
export function getFilteredCoefficients(color) {
  const timbre = store.state.timbres[color];
  if (!timbre) {
    return new Float32Array(BINS);
  }

  const filterSettings = timbre.filter;
  if (filterSettings && (filterSettings.enabled !== false) && (filterSettings.mix || 0) > 0) {
    // Return filtered coefficients
    return applyDiscreteFiltering(timbre.coeffs, filterSettings);
  } else {
    // No filtering - return original coefficients
    return new Float32Array(timbre.coeffs);
  }
}

// Export function for synth engine integration
export function getFilterDataForSynth(color) {
  const timbre = store.state.timbres[color];
  if (!timbre || !timbre.filter || !timbre.filter.enabled) {
    return {
      enabled: false,
      coefficients: new Float32Array(timbre?.coeffs || new Float32Array(BINS)),
      settings: null
    };
  }

  const filterSettings = timbre.filter;
  const mixAmount = filterSettings.mix || 0;

  // If mix is 0, return original coefficients (no filtering)
  if (mixAmount === 0) {
    return {
      enabled: false,
      coefficients: new Float32Array(timbre.coeffs),
      settings: filterSettings
    };
  }

  // Apply discrete filtering to the coefficients
  const filteredCoefficients = applyDiscreteFiltering(timbre.coeffs, filterSettings);

  return {
    enabled: true,
    coefficients: filteredCoefficients,
    settings: {
      blend: filterSettings.blend,
      cutoff: filterSettings.cutoff,
      mix: mixAmount,
      resonance: filterSettings.resonance || 0
    }
  };
}

function drawFilterOverlay() {
  // Re-find canvas elements if they're missing (can happen after DOM updates during voice switching)
  if (!overlayCanvas || !overlayCtx || !harmonicBinsGrid) {
    overlayCanvas = document.getElementById('filter-overlay-canvas');
    harmonicBinsGrid = document.querySelector('.harmonic-bins-grid');
    if (overlayCanvas) {
      overlayCtx = overlayCanvas.getContext('2d');
    }
  }

  if (!overlayCanvas || !overlayCtx || !harmonicBinsGrid) {

    return;
  }

  const rect = harmonicBinsGrid.getBoundingClientRect();
  const { width, height } = overlayCanvas;

  overlayCtx.clearRect(0, 0, width, height);

  const usableHeight = height;
  const maxBarHeight = usableHeight * 0.95;
  const barBaseY = height;

  const filterSettings = store.state.timbres[currentColor]?.filter;

  // Fix: Default enabled to true if undefined (handles legacy state or missing property)
  const isFilterEnabled = filterSettings && (filterSettings.enabled !== false);

  if (filterSettings && isFilterEnabled) {
    const mixAmount = filterSettings.mix || 0;


    // If mix is 0, don't draw overlay and reset filter values to no filtering
    if (mixAmount === 0) {
      binFilterValues.fill(1);
      return;
    }

    // Calculate discrete filter values for each of the 12 bins
    const binAmplitudes = [];
    for (let i = 0; i < BINS; i++) {
      const norm_pos = (i + 0.5) / BINS; // Center of each bin
      const rawFilterAmp = getFilterAmplitudeAt(norm_pos, filterSettings);
      binFilterValues[i] = applyFilterMix(rawFilterAmp, mixAmount);
      binAmplitudes.push({
        bin: i + 1,
        rawFilterAmp: rawFilterAmp.toFixed(3),
        afterMix: binFilterValues[i].toFixed(3)
      });
    }


    // Draw continuous curve showing the RAW filter shape (not mixed)
    overlayCtx.beginPath();
    const step = 2;
    for (let x = 0; x <= width; x += step) {
      const norm_pos = x / width;
      const rawFilterAmp = getFilterAmplitudeAt(norm_pos, filterSettings);
      const y = barBaseY - rawFilterAmp * maxBarHeight;
      if (x === 0) {
        overlayCtx.moveTo(x, y);
      } else {
        overlayCtx.lineTo(x, y);
      }
    }

    // Use mix for transparency - higher mix = more visible overlay
    const mixNorm = mixAmount / 100;
    const strokeAlpha = 0.4 + (mixNorm * 0.6); // Range from 0.4 to 1.0
    const fillAlpha = mixNorm * 0.3; // Range from 0 to 0.3


    overlayCtx.strokeStyle = hexToRgba(shadeHexColor(currentColor, -0.3), strokeAlpha);
    overlayCtx.lineWidth = 2.5;
    overlayCtx.stroke();

    // Draw white transparency overlay above the filter curve
    const whiteOpacity = mixAmount / 100; // 0% mix = 0 opacity, 100% mix = 1.0 opacity

    if (whiteOpacity > 0) {
      // Create the white overlay shape above the filter curve
      overlayCtx.beginPath();

      // Start from top-left corner
      overlayCtx.moveTo(0, 0);

      // Draw along the top edge to top-right
      overlayCtx.lineTo(width, 0);

      // Draw down the right edge to the filter curve
      const rightFilterAmp = getFilterAmplitudeAt(1.0, filterSettings); // Right edge
      const rightY = barBaseY - rightFilterAmp * maxBarHeight;
      overlayCtx.lineTo(width, rightY);

      // Draw the filter curve from right to left
      for (let x = width; x >= 0; x -= 2) {
        const norm_pos = x / width;
        const rawFilterAmp = getFilterAmplitudeAt(norm_pos, filterSettings);
        const y = barBaseY - rawFilterAmp * maxBarHeight;
        overlayCtx.lineTo(x, y);
      }

      // Close the path back to top-left
      overlayCtx.closePath();

      // Fill the area above the filter curve with white transparency
      overlayCtx.fillStyle = `rgba(255, 255, 255, ${whiteOpacity})`;
      overlayCtx.fill();
    }

  } else {
    // Reset filter values when filter is disabled
    binFilterValues.fill(1);
  }
}

function updateSliderVisuals() {
  binColumns.forEach((column, i) => {
    const fill = column.sliderTrack.querySelector('.slider-fill');
    const label = column.sliderTrack.querySelector('.harmonic-label-internal');
    const val = coeffs[i]; // No threshold snapping - use raw value

    fill.style.height = `${val * 100}%`;

    if (val > 0) {
      // Standard single-color rendering
      const fillColor = shadeHexColor(currentColor, -0.1);
      fill.style.backgroundColor = hexToRgba(fillColor, 1);
    } else {
      fill.style.backgroundColor = 'transparent';
    }

    // Always clean up any canvas overlays
    const existingCanvas = fill.querySelector('canvas');
    if (existingCanvas) {
      existingCanvas.remove();
    }

    // Update label color based on bin level
    if (val > 0.1) {
      // High bin level - white text for contrast against colored fill
      label.style.color = 'rgba(255, 255, 255, 0.35)';
      label.style.textShadow = '0 0 2px rgba(0,0,0,0.3)';
    } else {
      // Low/zero bin level - dark text for visibility on light background
      label.style.color = 'rgba(51, 51, 51, 0.5)';
      label.style.textShadow = '0 0 1px rgba(255,255,255,0.3)';
    }
  });
  drawFilterOverlay();
}

function handleBinPointerEvent(e, binIndex = null) {
  recordHarmonicBinsDebug('log', '[BINS DRAG] handleBinPointerEvent called', { clientX: e.clientX, clientY: e.clientY });
  logger.debug('HarmonicBins', 'handleBinPointerEvent called', { target: e.target.className }, 'filter');

  // CRITICAL: Block phase button events completely
  if (e.target.classList.contains('phase-button') ||
        e.target.closest('.phase-button') ||
        e.target.tagName === 'path' ||  // SVG elements in phase buttons
        e.target.tagName === 'svg') {   // SVG containers
    recordHarmonicBinsDebug('log', '[BINS DRAG] Blocked - phase button element');
    logger.debug('HarmonicBins', 'Blocking phase button interaction in handleBinPointerEvent', null, 'filter');
    return;
  }

  // If no binIndex provided, determine from pointer position
  if (binIndex === null) {
    const gridRect = harmonicBinsGrid.getBoundingClientRect();
    const x = e.clientX - gridRect.left;
    const binWidth = gridRect.width / BINS;
    binIndex = Math.floor(x / binWidth);
    binIndex = Math.max(0, Math.min(BINS - 1, binIndex));
    recordHarmonicBinsDebug('log', '[BINS DRAG] Calculated binIndex:', binIndex, 'from x:', x, 'binWidth:', binWidth);
  }

  logger.debug('HarmonicBins', 'handleBinPointerEvent - binIndex', { binIndex }, 'filter');

  const sliderTrack = binColumns[binIndex].sliderTrack;
  const rect = sliderTrack.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const trackHeight = rect.height;

  const previous = coeffs[binIndex];

  // Direct mapping - no snap zone logic
  const v = (trackHeight - y) / trackHeight;
  const clampedValue = Math.max(0, Math.min(1, v));
  recordHarmonicBinsDebug('log', '[BINS DRAG] Setting bin', binIndex + 1, 'value:', clampedValue.toFixed(3));

  const releaseDelay = (store.state.timbres[currentColor]?.adsr?.release || 0) * 1000;

  if (clampedValue === 0) {
    // Don't stop audio playback when setting individual harmonics to zero
    // The playback should continue so user can hear the effect of removing this harmonic

    // Immediately update store with zero value
    logger.debug('HarmonicBins', 'Setting coefficient to zero immediately for bin', { binIndex }, 'filter');
    const newCoeffs = new Float32Array(store.state.timbres[currentColor].coeffs);
    newCoeffs[binIndex] = 0;
    coeffs[binIndex] = 0; // Keep local array in sync
    store.setHarmonicCoefficients(currentColor, newCoeffs);

    // Clear any pending timeout for this bin
    if (zeroUpdateTimeouts[binIndex]) {
      clearTimeout(zeroUpdateTimeouts[binIndex]);
      zeroUpdateTimeouts[binIndex] = null;
    }

    // Start audio if not already playing (user is interacting)
    if (!isAuditioning) {
      SynthEngine.triggerAttack('C4', currentColor);
      store.emit('spacebarPlayback', { color: currentColor, isPlaying: true });
      isAuditioning = true;
    }

    // Update filtered coefficients when harmonic bins change (including zero)
    const filterSettings = store.state.timbres[currentColor]?.filter;
    if (filterSettings && (filterSettings.enabled !== false) && (filterSettings.mix || 0) > 0) {
      filteredCoeffs = applyDiscreteFiltering(newCoeffs, filterSettings);
    } else {
      // No filtering - use original coefficients
      filteredCoeffs = new Float32Array(newCoeffs);
    }

    // Update static waveform in real-time during dragging (including zero)
    if (window.staticWaveformVisualizer && window.staticWaveformVisualizer.generateWaveform) {
      window.staticWaveformVisualizer.generateWaveform();
    }

    // DEBUG: Log zero coefficient updates
    logger.debug('HarmonicBins', `Set coefficient H${binIndex + 1} to 0 for color ${currentColor}`, null, 'filter');
  } else {
    if (zeroUpdateTimeouts[binIndex]) {
      clearTimeout(zeroUpdateTimeouts[binIndex]);
      zeroUpdateTimeouts[binIndex] = null;
    }

    if (!isAuditioning) {
      SynthEngine.triggerAttack('C4', currentColor);
      store.emit('spacebarPlayback', { color: currentColor, isPlaying: true });
      isAuditioning = true;
    }

    logger.debug('HarmonicBins', 'BEFORE creating newCoeffs - store coeffs', { coeffs: store.state.timbres[currentColor].coeffs }, 'filter');
    const newCoeffs = new Float32Array(store.state.timbres[currentColor].coeffs);
    logger.debug('HarmonicBins', 'AFTER copying to newCoeffs', { newCoeffs }, 'filter');
    newCoeffs[binIndex] = clampedValue;
    coeffs[binIndex] = clampedValue; // Keep local array in sync
    logger.debug('HarmonicBins', `AFTER setting newCoeffs[${binIndex}] = ${clampedValue}`, { newCoeffs }, 'filter');

    // Update the timbre directly (amplitude normalization removed)
    store.setHarmonicCoefficients(currentColor, newCoeffs);

    // Update filtered coefficients when harmonic bins change
    const filterSettings = store.state.timbres[currentColor]?.filter;
    if (filterSettings && (filterSettings.enabled !== false) && (filterSettings.mix || 0) > 0) {
      filteredCoeffs = applyDiscreteFiltering(newCoeffs, filterSettings);
    } else {
      // No filtering - use original coefficients
      filteredCoeffs = new Float32Array(newCoeffs);
    }

    // Update static waveform in real-time during dragging
    if (window.staticWaveformVisualizer && window.staticWaveformVisualizer.generateWaveform) {
      window.staticWaveformVisualizer.generateWaveform();
    }

    // DEBUG: Log coefficient updates
    logger.debug('HarmonicBins', `Updated coefficient H${binIndex + 1} to ${clampedValue} for color ${currentColor}`, null, 'filter');
    logger.debug('HarmonicBins', 'All coefficients', { newCoeffs }, 'filter');
  }

  updateSliderVisuals();
}

// âœ… State synchronization validation helper
function validateStateSync(localCoeffs, localPhases, storeTimbre, context) {
  const storeCoeffs = storeTimbre.coeffs;
  const storePhases = storeTimbre.phases || new Float32Array(storeCoeffs.length).fill(0);

  let coeffsMatch = true;
  let phasesMatch = true;

  if (localCoeffs.length !== storeCoeffs.length) {
    coeffsMatch = false;
  } else {
    for (let i = 0; i < localCoeffs.length; i++) {
      if (Math.abs(localCoeffs[i] - storeCoeffs[i]) > 0.001) {
        coeffsMatch = false;
        break;
      }
    }
  }

  if (localPhases.length !== storePhases.length) {
    phasesMatch = false;
  } else {
    for (let i = 0; i < localPhases.length; i++) {
      if (Math.abs(localPhases[i] - storePhases[i]) > 0.001) {
        phasesMatch = false;
        break;
      }
    }
  }

  const isSync = coeffsMatch && phasesMatch;


  return isSync;
}

function updateForNewColor(color) {
  if (!color) {return;}
  currentColor = color;
  const timbre = store.state.timbres[color];
  if (timbre) {
    // Fix: Ensure filter state is properly initialized with enabled property
    if (!timbre.filter) {
      timbre.filter = { enabled: true, blend: 0.0, cutoff: 16, resonance: 0, type: 'lowpass', mix: 0 };
    } else if (timbre.filter.enabled === undefined) {
      timbre.filter.enabled = true;
    }
    logger.debug('HarmonicBins', 'updateForNewColor - timbre.coeffs', { coeffs: timbre.coeffs }, 'filter');
    logger.debug('HarmonicBins', 'updateForNewColor - timbre.phases', { phases: timbre.phases }, 'filter');

    // Store old values for comparison
    const oldCoeffs = coeffs ? Array.from(coeffs) : [];
    const oldPhases = phases ? Array.from(phases) : [];

    // Direct copy without zero threshold manipulation
    coeffs = new Float32Array(timbre.coeffs);

    // Fix the phase array creation
    if (timbre.phases) {
      phases = new Float32Array(timbre.phases);
    } else {
      phases = new Float32Array(coeffs.length).fill(0);
    }

    // âœ… Validate synchronization after update
    validateStateSync(coeffs, phases, timbre, 'updateForNewColor');


    logger.debug('HarmonicBins', 'updateForNewColor - final coeffs', { coeffs }, 'filter');
    logger.debug('HarmonicBins', 'updateForNewColor - final phases', { phases }, 'filter');

    phaseControls.forEach(({ phaseBtn }, i) => {
      if (!phaseBtn) {return;}
      const phase = phases[i] || 0;
      let p = phase % (2 * Math.PI);
      if (p < 0) {p += 2 * Math.PI;}

      const tolerance = 0.1;
      let phaseState = 0;
      if (Math.abs(p - Math.PI/2) < tolerance) {phaseState = 90;}
      else if (Math.abs(p - Math.PI) < tolerance) {phaseState = 180;}
      else if (Math.abs(p - 3*Math.PI/2) < tolerance) {phaseState = 270;}

      phaseBtn.innerHTML = phaseIconPaths[phaseState];
    });

    updateSliderVisuals();
  }
}

export function initHarmonicBins() {
  const filterContainer = document.querySelector('.filter-container');
  const filterBinsWrapper = filterContainer?.querySelector('.filter-bins-wrapper');
  const filterVerticalBlendWrapper = filterContainer?.querySelector('.filter-vertical-blend-wrapper');

  if (!filterContainer || !filterBinsWrapper || !filterVerticalBlendWrapper) {
    logger.error('HarmonicBins', 'Missing required elements - aborting init', null, 'audio');
    return;
  }

  // Create the main grid container
  harmonicBinsGrid = document.createElement('div');
  harmonicBinsGrid.className = 'harmonic-bins-grid';

  // Create 12 columns, each containing bin control and phase button
  for (let i = 0; i < BINS; i++) {
    const column = document.createElement('div');
    column.className = 'slider-column';

    // Bin control track
    const sliderTrack = document.createElement('div');
    sliderTrack.className = 'slider-track';

    // Add bin fill
    const sliderFill = document.createElement('div');
    sliderFill.className = 'slider-fill';
    sliderTrack.appendChild(sliderFill);

    // Label inside the bin at the bottom
    const label = document.createElement('div');
    label.className = 'harmonic-label-internal';
    label.textContent = `${i + 1}`;
    sliderTrack.appendChild(label);

    column.appendChild(sliderTrack);

    // Phase button
    const phaseBtn = document.createElement('button');
    phaseBtn.className = 'phase-button';
    phaseBtn.innerHTML = phaseIconPaths[0];
    phaseBtn.dataset.binIndex = i; // Store bin index for snap-to-zero

    // Snap-to-zero when dragging onto phase button
    phaseBtn.addEventListener('pointerenter', (e) => {
      if (isDraggingBin) {
        recordHarmonicBinsDebug('log', '[SNAP-TO-ZERO] ðŸŽ¯ Drag entered phase button for bin', i + 1);

        // Apply smooth ramp to zero to avoid pops/clicks
        const rampTime = 0.015; // 15ms ramp to avoid audio artifacts
        const now = Tone.now();

        // Get the oscillator for this harmonic
        const timbre = store.state.timbres[currentColor];
        if (SynthEngine.synths?.[currentColor]?.activeNotes?.['C4']) {
          const activeNote = SynthEngine.synths[currentColor].activeNotes['C4'];
          if (activeNote.oscillators?.[i]) {
            const osc = activeNote.oscillators[i];
            // Smoothly ramp volume to zero
            osc.volume.linearRampTo(-Infinity, rampTime, now);
            recordHarmonicBinsDebug('log', '[SNAP-TO-ZERO] Applied smooth ramp for bin', i + 1);
          }
        }

        // Update coefficients after ramp completes
        setTimeout(() => {
          const newCoeffs = new Float32Array(store.state.timbres[currentColor].coeffs);
          newCoeffs[i] = 0;
          coeffs[i] = 0;
          store.setHarmonicCoefficients(currentColor, newCoeffs);

          // Update filtered coefficients
          const filterSettings = store.state.timbres[currentColor]?.filter;
          if (filterSettings && (filterSettings.enabled !== false) && (filterSettings.mix || 0) > 0) {
            filteredCoeffs = applyDiscreteFiltering(newCoeffs, filterSettings);
          } else {
            filteredCoeffs = new Float32Array(newCoeffs);
          }

          updateSliderVisuals();
          recordHarmonicBinsDebug('log', '[SNAP-TO-ZERO] âœ“ Bin', i + 1, 'snapped to ZERO via phase button drag');
        }, rampTime * 1000);
      }
    });

    phaseBtn.addEventListener('click', (e) => {
      // Only handle click if not dragging (prevent phase change during drag-to-zero)
      if (isDraggingBin) {
        recordHarmonicBinsDebug('log', '[SNAP-TO-ZERO] Click blocked during drag');
        e.preventDefault();
        return;
      }

      logger.debug('HarmonicBins', 'Phase button click handler started', null, 'filter');
      logger.debug('HarmonicBins', 'Current coeffs before phase change', { coeffs }, 'filter');

      // Prevent event bubbling to avoid triggering grid's pointer handler
      e.preventDefault();

      // Store old phases for transition animation
      const oldPhases = new Float32Array(phases);

      const newPhases = new Float32Array(phases);
      const currentPhase = newPhases[i] || 0;
      let p = currentPhase % (2 * Math.PI);
      if (p < 0) {p += 2 * Math.PI;}

      const tolerance = 0.1;
      let nextPhase = 0;
      if (Math.abs(p) < tolerance) {nextPhase = Math.PI / 2;}
      else if (Math.abs(p - Math.PI/2) < tolerance) {nextPhase = Math.PI;}
      else if (Math.abs(p - Math.PI) < tolerance) {nextPhase = 3 * Math.PI / 2;}
      else {nextPhase = 0;}

      newPhases[i] = nextPhase;
      phases = newPhases;

      // Start transition animation before updating store
      if (window.staticWaveformVisualizer && window.staticWaveformVisualizer.startPhaseTransition) {
        window.staticWaveformVisualizer.startPhaseTransition(oldPhases, newPhases, i);
      }

      // Update store (but don't trigger immediate waveform regeneration due to transition guard)
      store.setHarmonicPhases(currentColor, newPhases);

      const degrees = nextPhase === 0 ? 0 :
        Math.abs(nextPhase - Math.PI/2) < tolerance ? 90 :
          Math.abs(nextPhase - Math.PI) < tolerance ? 180 : 270;
      phaseBtn.innerHTML = phaseIconPaths[degrees];

      logger.debug('HarmonicBins', `Phase button clicked for H${i + 1}, new phase: ${degrees}Â°`, null, 'filter');
    });

    column.appendChild(phaseBtn);
    harmonicBinsGrid.appendChild(column);

    // Store references
    binColumns.push({
      column,
      label,
      sliderTrack,
      sliderFill,
      phaseBtn
    });
    phaseControls.push({ phaseBtn });

  }

  // Add cross-bin drag functionality to the entire grid
  harmonicBinsGrid.addEventListener('pointerdown', (e) => {
    recordHarmonicBinsDebug('log', '[BINS DRAG] Pointerdown event fired', { target: e.target, className: e.target.className });

    // Check if the click came from a phase button
    if (e.target.classList.contains('phase-button') || e.target.closest('.phase-button')) {
      recordHarmonicBinsDebug('log', '[BINS DRAG] Blocked - phase button clicked');
      logger.debug('HarmonicBins', 'Pointerdown blocked - phase button clicked', null, 'filter');
      return; // Don't handle phase button clicks as bin interactions
    }

    recordHarmonicBinsDebug('log', '[BINS DRAG] Starting drag interaction');
    logger.debug('HarmonicBins', 'Pointerdown - handling bin interaction', null, 'filter');
    e.preventDefault();

    isDraggingBin = true; // Enable snap-to-zero via phase button pointerenter
    recordHarmonicBinsDebug('log', '[SNAP-TO-ZERO] Drag started - isDraggingBin = true');

    SynthEngine.triggerAttack('C4', currentColor);
    store.emit('spacebarPlayback', { color: currentColor, isPlaying: true });
    isAuditioning = true;

    handleBinPointerEvent(e);

    const onMove = (ev) => handleBinPointerEvent(ev);
    const stopDrag = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stopDrag);
      isDraggingBin = false; // Disable snap-to-zero
      recordHarmonicBinsDebug('log', '[SNAP-TO-ZERO] Drag ended - isDraggingBin = false');
      const waveformAvailable = !!window.staticWaveformVisualizer?.generateWaveform;
      recordHarmonicBinsDebug('log', '[HarmonicBins] stopDrag invoked', {
        waveformAvailable,
        hasChanges: typeof handleBinPointerEvent === 'function'
      });

      store.recordState();

      SynthEngine.triggerRelease('C4', currentColor);
      store.emit('spacebarPlayback', { color: currentColor, isPlaying: false });
      isAuditioning = false;

      if (waveformAvailable) {
        setTimeout(() => {
          recordHarmonicBinsDebug('log', '[HarmonicBins] Generating static waveform after drag');
          window.staticWaveformVisualizer.generateWaveform();
        }, 0);
      } else {
        logger.warn('HarmonicBins', 'Static waveform visualizer not ready when drag ended', null, 'audio');
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stopDrag);
  });

  // Create filter overlay canvas
  overlayCanvas = document.createElement('canvas');
  overlayCanvas.id = 'filter-overlay-canvas';
  overlayCanvas.className = 'filter-overlay-canvas';
  overlayCanvas.style.pointerEvents = 'none';
  overlayCtx = overlayCanvas.getContext('2d');
  harmonicBinsGrid.appendChild(overlayCanvas);

  // Create vertical blend (M) slider
  const verticalBlendWrapper = document.createElement('div');
  verticalBlendWrapper.className = 'vertical-blend-wrapper';

  const verticalBlendTrack = document.createElement('div');
  verticalBlendTrack.id = 'vertical-blend-track';

  const verticalBlendThumb = document.createElement('div');
  verticalBlendThumb.id = 'vertical-blend-thumb';
  verticalBlendThumb.textContent = 'M';

  verticalBlendTrack.appendChild(verticalBlendThumb);
  verticalBlendWrapper.appendChild(verticalBlendTrack);

  // Add grid and vertical slider to their respective wrappers
  filterBinsWrapper.appendChild(harmonicBinsGrid);
  filterVerticalBlendWrapper.appendChild(verticalBlendWrapper);

  // Size the overlay canvas
  const sizeOverlayCanvas = () => {
    const rect = overlayCanvas.getBoundingClientRect(); // Use canvas rect, not grid rect
    if (overlayCanvas.width !== rect.width || overlayCanvas.height !== rect.height) {
      overlayCanvas.width = rect.width;
      overlayCanvas.height = rect.height;
      drawFilterOverlay();
    }
  };

  // Initialize with current color
  currentColor = store.state.selectedNote?.color || '#4a90e2';

  updateForNewColor(currentColor);

  // Set up event listeners
  store.on('timbreChanged', (color) => {
    if (color === currentColor) {
      logger.debug('HarmonicBins', 'timbreChanged event - checking what changed', null, 'filter');
      const timbre = store.state.timbres[color];
      const newCoeffs = timbre.coeffs;
      const newPhases = timbre.phases;

      // Check if coefficients actually changed (not just phases)
      let coeffsChanged = false;
      logger.debug('HarmonicBins', 'Comparing coefficients...', null, 'filter');
      logger.debug('HarmonicBins', 'Local coeffs', { coeffs }, 'filter');
      logger.debug('HarmonicBins', 'Store coeffs', { newCoeffs }, 'filter');

      if (!coeffs || coeffs.length !== newCoeffs.length) {
        logger.debug('HarmonicBins', 'Array length mismatch - coeffsChanged = true', null, 'filter');
        coeffsChanged = true;
      } else {
        for (let i = 0; i < newCoeffs.length; i++) {
          const diff = Math.abs(coeffs[i] - newCoeffs[i]);
          if (diff > 0.001) {
            logger.debug('HarmonicBins', `Coefficient ${i} changed: ${coeffs[i]} -> ${newCoeffs[i]} (diff: ${diff})`, null, 'filter');
            coeffsChanged = true;
            break;
          }
        }
      }

      // ALWAYS sync local coeffs with store to prevent drift (no threshold manipulation)
      logger.debug('HarmonicBins', 'Force syncing local coeffs with store', null, 'filter');

      // âœ… Validate state before sync
      const wasSynced = validateStateSync(coeffs || new Float32Array(12), phases || new Float32Array(12), timbre, 'timbreChanged-before');

      coeffs = new Float32Array(newCoeffs);

      // Always update phases (they change more frequently)
      if (newPhases) {
        phases = new Float32Array(newPhases);
      } else {
        phases = new Float32Array(coeffs.length).fill(0);
      }

      // âœ… Validate state after sync
      const isSyncedNow = validateStateSync(coeffs, phases, timbre, 'timbreChanged-after');


      if (coeffsChanged) {
        logger.debug('HarmonicBins', 'Coefficients changed - updating visuals', null, 'filter');
        updateSliderVisuals();
      } else {
        logger.debug('HarmonicBins', 'No coefficient changes detected - but local coeffs synced', null, 'filter');
        // Still need to redraw overlay in case filter settings changed
        drawFilterOverlay();
      }

      // Update phase button visuals
      phaseControls.forEach(({ phaseBtn }, i) => {
        if (!phaseBtn) {return;}
        const phase = phases[i] || 0;
        let p = phase % (2 * Math.PI);
        if (p < 0) {p += 2 * Math.PI;}

        const tolerance = 0.1;
        let phaseState = 0;
        if (Math.abs(p - Math.PI/2) < tolerance) {phaseState = 90;}
        else if (Math.abs(p - Math.PI) < tolerance) {phaseState = 180;}
        else if (Math.abs(p - 3*Math.PI/2) < tolerance) {phaseState = 270;}

        phaseBtn.innerHTML = phaseIconPaths[phaseState];
      });
    }
  });

  store.on('noteChanged', ({ newNote }) => {
    if (newNote.color && newNote.color !== currentColor) {
      updateForNewColor(newNote.color);
    }
  });

  // Listen for filter changes to update bin visuals and apply filtering
  store.on('filterChanged', (color) => {
    if (color === currentColor) {
      // Update visuals
      updateSliderVisuals();

      // Apply discrete filtering to coefficients and send to synth
      const timbre = store.state.timbres[currentColor];
      const filterSettings = timbre?.filter;

      if (filterSettings && (filterSettings.enabled !== false) && (filterSettings.mix || 0) > 0) {
        filteredCoeffs = applyDiscreteFiltering(timbre.coeffs, filterSettings);
      } else {
        // No filtering - use original coefficients
        filteredCoeffs = new Float32Array(timbre.coeffs);
      }
    }
  });

  // Observe resize for overlay canvas
  new ResizeObserver(sizeOverlayCanvas).observe(harmonicBinsGrid);
  sizeOverlayCanvas();

  logger.info('HarmonicBins', 'Initialized with columnar div structure and perfect alignment', null, 'filter');
}

export function getHarmonicBinsDebugMessages() {
  return harmonicBinsDebugMessages.slice();
}





