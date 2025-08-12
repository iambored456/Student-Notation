// js/components/Harmonics-Filter/harmonicBins.js
import store from '../../state/index.js';
import { HARMONIC_BINS } from '../../constants.js';
import SynthEngine from '../../services/synthEngine.js';
import { hexToRgba, shadeHexColor } from '../../utils/colorUtils.js';
import logger from '../../utils/logger.js';
import phaseIcon0 from '/assets/icons/phaseButton_0.svg?raw';
import phaseIcon90 from '/assets/icons/phaseButton_90.svg?raw';
import phaseIcon180 from '/assets/icons/phaseButton_180.svg?raw';
import phaseIcon270 from '/assets/icons/phaseButton_270.svg?raw';

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
    const norm_cutoff = (cutoff - 1) / (BINS - 2);
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
    const res_q = 1.0 - resonance / 105;
    const peak_width = Math.max(0.01, 0.2 * res_q * res_q);
    const peak = Math.exp(-Math.pow((norm_pos - norm_cutoff) / peak_width, 2));
    const res_gain = (resonance / 100) * 0.6;
    return Math.min(1.0, shape + peak * res_gain);
}

function drawFilterOverlay() {
    if (!overlayCanvas || !overlayCtx || !harmonicBinsGrid) return;
    
    const rect = harmonicBinsGrid.getBoundingClientRect();
    const { width, height } = overlayCanvas;
    
    overlayCtx.clearRect(0, 0, width, height);
    
    const filterSettings = store.state.timbres[currentColor]?.filter;
    if (filterSettings && filterSettings.enabled) {
        const usableHeight = height;
        const maxBarHeight = usableHeight * 0.95;
        const barBaseY = height;
        
        overlayCtx.beginPath();
        const step = 2;
        for (let x = 0; x <= width; x += step) {
            const norm_pos = x / width;
            const amp = getFilterAmplitudeAt(norm_pos, filterSettings);
            const y = barBaseY - amp * maxBarHeight;
            if (x === 0) {
                overlayCtx.moveTo(x, y);
            } else {
                overlayCtx.lineTo(x, y);
            }
        }
        overlayCtx.strokeStyle = shadeHexColor(currentColor, -0.3);
        overlayCtx.lineWidth = 2.5;
        overlayCtx.stroke();
        overlayCtx.lineTo(width, barBaseY);
        overlayCtx.lineTo(0, barBaseY);
        overlayCtx.closePath();
        overlayCtx.fillStyle = hexToRgba(currentColor, 0.2);
        overlayCtx.fill();
    }
}

function updateSliderVisuals() {
    binColumns.forEach((column, i) => {
        const fill = column.sliderTrack.querySelector('.slider-fill');
        const label = column.sliderTrack.querySelector('.harmonic-label-internal');
        const val = coeffs[i] < COEFF_ZERO_THRESHOLD ? 0 : coeffs[i];
        
        fill.style.height = `${val * 100}%`;
        fill.style.backgroundColor = val > 0 ? shadeHexColor(currentColor, -0.1) : 'transparent';
        
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
    console.log('[HarmonicBins] handleBinPointerEvent called', e.target, e.target.className);
    
    // CRITICAL: Block phase button events completely
    if (e.target.classList.contains('phase-button') || 
        e.target.closest('.phase-button') || 
        e.target.tagName === 'path' ||  // SVG elements in phase buttons
        e.target.tagName === 'svg') {   // SVG containers
        console.log('[HarmonicBins] Blocking phase button interaction in handleBinPointerEvent');
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
    
    console.log('[HarmonicBins] handleBinPointerEvent - binIndex:', binIndex);
    
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
        console.log('[HarmonicBins] Setting coefficient to zero immediately for bin', binIndex);
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

        console.log(`[HarmonicBins] BEFORE creating newCoeffs - store coeffs:`, store.state.timbres[currentColor].coeffs);
        const newCoeffs = new Float32Array(store.state.timbres[currentColor].coeffs);
        console.log(`[HarmonicBins] AFTER copying to newCoeffs:`, newCoeffs);
        newCoeffs[binIndex] = clampedValue;
        coeffs[binIndex] = clampedValue; // Keep local array in sync
        console.log(`[HarmonicBins] AFTER setting newCoeffs[${binIndex}] = ${clampedValue}:`, newCoeffs);
        
        // Update the timbre directly (amplitude normalization removed)
        store.setHarmonicCoefficients(currentColor, newCoeffs);
        
        // DEBUG: Log coefficient updates
        console.log(`[HarmonicBins] Updated coefficient H${binIndex + 1} to ${clampedValue} for color ${currentColor}`);
        console.log(`[HarmonicBins] All coefficients:`, newCoeffs);
    }

    updateSliderVisuals();
}

function updateForNewColor(color) {
    if (!color) return;
    currentColor = color;
    const timbre = store.state.timbres[color];
    if (timbre) {
        console.log(`[HarmonicBins] updateForNewColor - timbre.coeffs:`, timbre.coeffs);
        console.log(`[HarmonicBins] updateForNewColor - timbre.phases:`, timbre.phases);
        
        // Direct copy without zero threshold manipulation
        coeffs = new Float32Array(timbre.coeffs);
        
        // Fix the phase array creation
        if (timbre.phases) {
            phases = new Float32Array(timbre.phases);
        } else {
            phases = new Float32Array(coeffs.length).fill(0);
        }
        
        console.log(`[HarmonicBins] updateForNewColor - final coeffs:`, coeffs);
        console.log(`[HarmonicBins] updateForNewColor - final phases:`, phases);
        
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
            console.log('[HarmonicBins] Phase button click handler started');
            console.log('[HarmonicBins] Current coeffs before phase change:', coeffs);
            
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
            
            console.log(`[HarmonicBins] Phase button clicked for H${i + 1}, new phase: ${degrees}°`);
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
            console.log('[HarmonicBins] Pointerdown blocked - phase button clicked');
            return; // Don't handle phase button clicks as bin interactions
        }
        
        console.log('[HarmonicBins] Pointerdown - handling bin interaction');
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
        console.log(`[HarmonicBins] CLEARING H7 contamination: ${timbre.coeffs[6]} -> 0`);
        const cleanCoeffs = new Float32Array(timbre.coeffs);
        cleanCoeffs[6] = 0;
        store.setHarmonicCoefficients(currentColor, cleanCoeffs);
    }
    
    updateForNewColor(currentColor);

    // Set up event listeners
    store.on('timbreChanged', (color) => {
        if (color === currentColor) {
            console.log('[HarmonicBins] timbreChanged event - checking what changed');
            const timbre = store.state.timbres[color];
            const newCoeffs = timbre.coeffs;
            const newPhases = timbre.phases;
            
            // Check if coefficients actually changed (not just phases)
            let coeffsChanged = false;
            console.log('[HarmonicBins] Comparing coefficients...');
            console.log('[HarmonicBins] Local coeffs:', coeffs);
            console.log('[HarmonicBins] Store coeffs:', newCoeffs);
            
            if (!coeffs || coeffs.length !== newCoeffs.length) {
                console.log('[HarmonicBins] Array length mismatch - coeffsChanged = true');
                coeffsChanged = true;
            } else {
                for (let i = 0; i < newCoeffs.length; i++) {
                    const diff = Math.abs(coeffs[i] - newCoeffs[i]);
                    if (diff > 0.001) {
                        console.log(`[HarmonicBins] Coefficient ${i} changed: ${coeffs[i]} -> ${newCoeffs[i]} (diff: ${diff})`);
                        coeffsChanged = true;
                        break;
                    }
                }
            }
            
            // ALWAYS sync local coeffs with store to prevent drift (no threshold manipulation)
            console.log('[HarmonicBins] Force syncing local coeffs with store');
            coeffs = new Float32Array(newCoeffs);
            
            if (coeffsChanged) {
                console.log('[HarmonicBins] Coefficients changed - updating visuals');
                updateSliderVisuals();
            } else {
                console.log('[HarmonicBins] No coefficient changes detected - but local coeffs synced');
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

    console.log('HarmonicBins: Initialized with columnar div structure and perfect alignment.');
}