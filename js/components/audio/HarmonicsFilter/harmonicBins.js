// js/components/Harmonics-Filter/harmonicBins.js
import store from '../../../state/index.js';
import { HARMONIC_BINS } from '../../../core/constants.js';
import SynthEngine from '../../../services/synthEngine.js';
import { hexToRgba, shadeHexColor } from '../../../utils/colorUtils.js';
import logger from '../../../utils/logger.js';
import phaseIcon0 from '../../../../src/assets/tabicons/phaseButton_0.svg?raw';
import phaseIcon90 from '../../../../src/assets/tabicons/phaseButton_90.svg?raw';
import phaseIcon180 from '../../../../src/assets/tabicons/phaseButton_180.svg?raw';
import phaseIcon270 from '../../../../src/assets/tabicons/phaseButton_270.svg?raw';

logger.moduleLoaded('HarmonicBins with Columnar Structure');

const phaseIconPaths = {
    0: phaseIcon0,
    90: phaseIcon90,
    180: phaseIcon180,
    270: phaseIcon270,
};


const BINS = HARMONIC_BINS;
let overlayCanvas, overlayCtx;
let coeffs = new Float32Array(BINS).fill(0);
let currentColor;
let phases = new Float32Array(BINS).fill(0);
const binColumns = [];
const phaseControls = [];
// Snap-to-zero feature removed
// const SNAP_TO_ZERO_RATIO = 0.1;
const COEFF_ZERO_THRESHOLD = 0.1;
let isAuditioning = false;
let harmonicBinsGrid = null;
const zeroUpdateTimeouts = new Array(BINS).fill(null);

// REMOVED: Amplitude normalization function (was causing coefficient contamination)

function getFilterAmplitudeAt(norm_pos, filterSettings) {
    const { blend, cutoff, resonance } = filterSettings;
    // Map cutoff (1-31) to normalized position across the 12 bins
    const norm_cutoff = (cutoff - 1) / (31 - 1);
    const steepness = 4;
    const lp_ratio = norm_cutoff > 0 ? norm_pos / norm_cutoff : norm_pos * 1e6;
    const hp_ratio = norm_pos > 0 ? norm_cutoff / norm_pos : norm_cutoff * 1e6;
    const lp = 1 / (1 + Math.pow(lp_ratio, 2 * steepness));
    const hp = 1 / (1 + Math.pow(hp_ratio, 2 * steepness));
    const bp = lp * hp * 4;
    let shape;
    if (blend <= 1.0) {
        shape = hp * (1 - blend) + bp * blend;
    } else {
        shape = bp * (2 - blend) + lp * (blend - 1);
    }
    const res_q = 1.0 - (resonance || 0) / 105;
    const peak_width = Math.max(0.01, 0.2 * res_q * res_q);
    const peak = Math.exp(-Math.pow((norm_pos - norm_cutoff) / peak_width, 2));
    const res_gain = ((resonance || 0) / 100) * 0.6;
    
    // Return the raw filter amplitude (0-1)
    return Math.min(1.0, shape + peak * res_gain);
}

function applyFilterMix(filterAmp, mixAmount) {
    // Apply mix: when mix = 0, no filtering (amp = 1), when mix = 100, full filtering
    const mixNorm = mixAmount / 100;
    return 1 - mixNorm + (mixNorm * filterAmp);
}

// Store discrete filter values for each bin
let binFilterValues = new Float32Array(BINS).fill(1);

// Export function for synth engine integration
export function getFilterDataForSynth(color) {
    const timbre = store.state.timbres[color];
    if (!timbre || !timbre.filter || !timbre.filter.enabled) {
        return {
            enabled: false,
            binValues: new Float32Array(BINS).fill(1),
            settings: null
        };
    }
    
    const filterSettings = timbre.filter;
    const mixAmount = filterSettings.mix || 0;
    
    // If mix is 0, return no filtering
    if (mixAmount === 0) {
        return {
            enabled: false,
            binValues: new Float32Array(BINS).fill(1),
            settings: filterSettings
        };
    }
    
    // Calculate the actual filter multipliers for each harmonic bin
    const outputBinValues = new Float32Array(BINS);
    for (let i = 0; i < BINS; i++) {
        const norm_pos = (i + 0.5) / BINS; // Center of each bin
        const rawFilterAmp = getFilterAmplitudeAt(norm_pos, filterSettings);
        outputBinValues[i] = applyFilterMix(rawFilterAmp, mixAmount);
    }
    
    return {
        enabled: true,
        binValues: outputBinValues,
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
    
    const filterSettings = store.state.timbres[currentColor]?.filter;
    
    // Fix: Default enabled to true if undefined (handles legacy state or missing property)
    const isFilterEnabled = filterSettings && (filterSettings.enabled !== false);
    
    if (filterSettings && isFilterEnabled) {
        const usableHeight = height;
        const maxBarHeight = usableHeight * 0.95;
        const barBaseY = height;
        const mixAmount = filterSettings.mix || 0;
        
        
        // If mix is 0, don't draw overlay and reset filter values to no filtering
        if (mixAmount === 0) {
            binFilterValues.fill(1);
            return;
        }
        
        // Calculate discrete filter values for each of the 12 bins
        for (let i = 0; i < BINS; i++) {
            const norm_pos = (i + 0.5) / BINS; // Center of each bin
            const rawFilterAmp = getFilterAmplitudeAt(norm_pos, filterSettings);
            binFilterValues[i] = applyFilterMix(rawFilterAmp, mixAmount);
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
        overlayCtx.lineTo(width, barBaseY);
        overlayCtx.lineTo(0, barBaseY);
        overlayCtx.closePath();
        overlayCtx.fillStyle = hexToRgba(currentColor, fillAlpha);
        overlayCtx.fill();
        
    } else {
        // Reset filter values when filter is disabled
        binFilterValues.fill(1);
    }
}

function updateSliderVisuals() {
    binColumns.forEach((column, i) => {
        const fill = column.sliderTrack.querySelector('.slider-fill');
        const label = column.sliderTrack.querySelector('.harmonic-label-internal');
        const val = coeffs[i] < COEFF_ZERO_THRESHOLD ? 0 : coeffs[i];
        
        fill.style.height = `${val * 100}%`;
        
        if (val > 0) {
            // Check if this bin's value is above or below the filter curve
            const filterValue = binFilterValues[i] || 1;
            const isFiltered = val > filterValue;
            
            // Base color and opacity
            let fillColor = shadeHexColor(currentColor, -0.1);
            let opacity = 1;
            
            // If the bar extends above the filter curve, make that portion more transparent
            if (isFiltered) {
                // Calculate how much of the bar is above the filter curve
                const filteredPortion = (val - filterValue) / val;
                // Reduce opacity based on how much is filtered (more filtered = more transparent)
                opacity = 1 - (filteredPortion * 0.6); // Max 60% transparency for filtered portion
            }
            
            fill.style.backgroundColor = hexToRgba(fillColor, opacity);
        } else {
            fill.style.backgroundColor = 'transparent';
        }
        
        // Update label color based on bin level
        if (val > 0.1) {
            // High bin level - white text for contrast against colored fill
            label.style.color = '#ffffff';
            label.style.textShadow = '0 0 2px rgba(0,0,0,0.5)';
        } else {
            // Low/zero bin level - dark text for visibility on light background
            label.style.color = '#333333';
            label.style.textShadow = '0 0 1px rgba(255,255,255,0.5)';
        }
    });
    drawFilterOverlay();
}

function handleBinPointerEvent(e, binIndex = null) {
    logger.debug('HarmonicBins', 'handleBinPointerEvent called', { target: e.target.className }, 'filter');
    
    // CRITICAL: Block phase button events completely
    if (e.target.classList.contains('phase-button') || 
        e.target.closest('.phase-button') || 
        e.target.tagName === 'path' ||  // SVG elements in phase buttons
        e.target.tagName === 'svg') {   // SVG containers
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
    }
    
    logger.debug('HarmonicBins', 'handleBinPointerEvent - binIndex', { binIndex }, 'filter');
    
    const sliderTrack = binColumns[binIndex].sliderTrack;
    const rect = sliderTrack.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const trackHeight = rect.height;
    
    const usableHeight = trackHeight;
    const previous = coeffs[binIndex];
    
    // Direct mapping without snap-to-zero zone
    const v = (usableHeight - y) / usableHeight;
    let clampedValue = Math.max(0, Math.min(1, v));

    if (clampedValue < COEFF_ZERO_THRESHOLD) {
        clampedValue = 0;
    }

    const releaseDelay = (store.state.timbres[currentColor]?.adsr?.release || 0) * 1000;

    if (clampedValue === 0) {
        if (previous > 0 && isAuditioning) {
            SynthEngine.triggerRelease('C4', currentColor);
            store.emit('spacebarPlayback', { color: currentColor, isPlaying: false });
            isAuditioning = false;
        }

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
        
        // DEBUG: Log coefficient updates
        logger.debug('HarmonicBins', `Updated coefficient H${binIndex + 1} to ${clampedValue} for color ${currentColor}`, null, 'filter');
        logger.debug('HarmonicBins', 'All coefficients', { newCoeffs }, 'filter');
    }

    updateSliderVisuals();
}

function updateForNewColor(color) {
    if (!color) return;
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
        
        // Direct copy without zero threshold manipulation
        coeffs = new Float32Array(timbre.coeffs);
        
        // Fix the phase array creation
        if (timbre.phases) {
            phases = new Float32Array(timbre.phases);
        } else {
            phases = new Float32Array(coeffs.length).fill(0);
        }
        
        logger.debug('HarmonicBins', 'updateForNewColor - final coeffs', { coeffs }, 'filter');
        logger.debug('HarmonicBins', 'updateForNewColor - final phases', { phases }, 'filter');
        
        phaseControls.forEach(({ phaseBtn }, i) => {
            if (!phaseBtn) return;
            const phase = phases[i] || 0;
            let p = phase % (2 * Math.PI);
            if (p < 0) p += 2 * Math.PI;
            
            const tolerance = 0.1;
            let phaseState = 0;
            if (Math.abs(p - Math.PI/2) < tolerance) phaseState = 90;
            else if (Math.abs(p - Math.PI) < tolerance) phaseState = 180;
            else if (Math.abs(p - 3*Math.PI/2) < tolerance) phaseState = 270;
            
            phaseBtn.innerHTML = phaseIconPaths[phaseState];
        });
        
        updateSliderVisuals();
    }
}

export function initHarmonicBins() {
    const harmonicBinsContainer = document.querySelector('.harmonic-bins-container');
    const filterMainPanel = harmonicBinsContainer?.querySelector('.filter-main-panel');
    
    if (!harmonicBinsContainer || !filterMainPanel) return;

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
        
        phaseBtn.addEventListener('click', (e) => {
            logger.debug('HarmonicBins', 'Phase button click handler started', null, 'filter');
            logger.debug('HarmonicBins', 'Current coeffs before phase change', { coeffs }, 'filter');
            
            // Prevent event bubbling to avoid triggering grid's pointer handler
            e.preventDefault();
            e.stopPropagation();
            
            // Store old phases for transition animation
            const oldPhases = new Float32Array(phases);
            
            const newPhases = new Float32Array(phases);
            const currentPhase = newPhases[i] || 0;
            let p = currentPhase % (2 * Math.PI);
            if (p < 0) p += 2 * Math.PI;
            
            const tolerance = 0.1;
            let nextPhase = 0;
            if (Math.abs(p) < tolerance) nextPhase = Math.PI / 2;
            else if (Math.abs(p - Math.PI/2) < tolerance) nextPhase = Math.PI;
            else if (Math.abs(p - Math.PI) < tolerance) nextPhase = 3 * Math.PI / 2;
            else nextPhase = 0;
            
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
            
            logger.debug('HarmonicBins', `Phase button clicked for H${i + 1}, new phase: ${degrees}°`, null, 'filter');
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
        // Check if the click came from a phase button
        if (e.target.classList.contains('phase-button') || e.target.closest('.phase-button')) {
            logger.debug('HarmonicBins', 'Pointerdown blocked - phase button clicked', null, 'filter');
            return; // Don't handle phase button clicks as bin interactions
        }
        
        logger.debug('HarmonicBins', 'Pointerdown - handling bin interaction', null, 'filter');
        e.preventDefault();
        
        SynthEngine.triggerAttack('C4', currentColor);
        store.emit('spacebarPlayback', { color: currentColor, isPlaying: true });
        isAuditioning = true;
        
        handleBinPointerEvent(e);
        
        const onMove = (ev) => handleBinPointerEvent(ev);
        const stopDrag = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', stopDrag);
            store.recordState();
            
            SynthEngine.triggerRelease('C4', currentColor);
            store.emit('spacebarPlayback', { color: currentColor, isPlaying: false });
            isAuditioning = false;
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

    // Add grid to the filter panel
    filterMainPanel.prepend(harmonicBinsGrid);

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
    currentColor = store.state.selectedNote.color;
    
    // TEMPORARY: Force clear H7 contamination
    const timbre = store.state.timbres[currentColor];
    if (timbre && timbre.coeffs[6] > 0.001) {
        logger.debug('HarmonicBins', `CLEARING H7 contamination: ${timbre.coeffs[6]} -> 0`, null, 'filter');
        const cleanCoeffs = new Float32Array(timbre.coeffs);
        cleanCoeffs[6] = 0;
        store.setHarmonicCoefficients(currentColor, cleanCoeffs);
    }
    
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
            coeffs = new Float32Array(newCoeffs);
            
            if (coeffsChanged) {
                logger.debug('HarmonicBins', 'Coefficients changed - updating visuals', null, 'filter');
                updateSliderVisuals();
            } else {
                logger.debug('HarmonicBins', 'No coefficient changes detected - but local coeffs synced', null, 'filter');
                // Still need to redraw overlay in case filter settings changed
                drawFilterOverlay();
            }
            
            // Always update phases (they change more frequently)
            if (newPhases) {
                phases = new Float32Array(newPhases);
            } else {
                phases = new Float32Array(coeffs.length).fill(0);
            }
            
            // Update phase button visuals
            phaseControls.forEach(({ phaseBtn }, i) => {
                if (!phaseBtn) return;
                const phase = phases[i] || 0;
                let p = phase % (2 * Math.PI);
                if (p < 0) p += 2 * Math.PI;
                
                const tolerance = 0.1;
                let phaseState = 0;
                if (Math.abs(p - Math.PI/2) < tolerance) phaseState = 90;
                else if (Math.abs(p - Math.PI) < tolerance) phaseState = 180;
                else if (Math.abs(p - 3*Math.PI/2) < tolerance) phaseState = 270;
                
                phaseBtn.innerHTML = phaseIconPaths[phaseState];
            });
        }
    });

    store.on('noteChanged', ({ newNote }) => {
        if (newNote.color && newNote.color !== currentColor) {
            updateForNewColor(newNote.color);
        }
    });

    // Observe resize for overlay canvas
    new ResizeObserver(sizeOverlayCanvas).observe(harmonicBinsGrid);
    sizeOverlayCanvas();

    logger.info('HarmonicBins', 'Initialized with columnar div structure and perfect alignment', null, 'filter');
}