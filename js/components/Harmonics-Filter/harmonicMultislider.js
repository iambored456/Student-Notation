// js/components/Harmonics-Filter/harmonicMultislider.js
import store from '../../state/index.js';
import { HARMONIC_BINS } from '../../constants.js';
import SynthEngine from '../../services/synthEngine.js';
import { hexToRgba, shadeHexColor } from '../../utils/colorUtils.js';
import logger from '../../utils/logger.js';
import phaseIcon0 from '/assets/icons/phaseButton_0.svg?raw';
import phaseIcon90 from '/assets/icons/phaseButton_90.svg?raw';
import phaseIcon180 from '/assets/icons/phaseButton_180.svg?raw';
import phaseIcon270 from '/assets/icons/phaseButton_270.svg?raw';

logger.moduleLoaded('HarmonicMultislider with Columnar Structure');

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
const sliderColumns = [];
const phaseControls = [];
const SNAP_TO_ZERO_RATIO = 0.1;
const COEFF_ZERO_THRESHOLD = 0.1;
let isAuditioning = false;
let multisliderGrid = null;
const zeroUpdateTimeouts = new Array(BINS).fill(null);

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
    if (!overlayCanvas || !overlayCtx || !multisliderGrid) return;
    
    const rect = multisliderGrid.getBoundingClientRect();
    const { width, height } = overlayCanvas;
    
    overlayCtx.clearRect(0, 0, width, height);
    
    const filterSettings = store.state.timbres[currentColor]?.filter;
    if (filterSettings && filterSettings.enabled) {
        const snapZoneHeight = height * SNAP_TO_ZERO_RATIO;
        const usableHeight = height - snapZoneHeight;
        const maxBarHeight = usableHeight * 0.95;
        const barBaseY = height - snapZoneHeight;
        
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
    sliderColumns.forEach((column, i) => {
        const fill = column.sliderTrack.querySelector('.slider-fill');
        const val = coeffs[i] < COEFF_ZERO_THRESHOLD ? 0 : coeffs[i];
        fill.style.height = `${val * 100}%`;
        fill.style.backgroundColor = val > 0 ? shadeHexColor(currentColor, -0.1) : 'transparent';
    });
    drawFilterOverlay();
}

function handleSliderPointerEvent(e, sliderIndex) {
    const sliderTrack = sliderColumns[sliderIndex].sliderTrack;
    const rect = sliderTrack.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const trackHeight = rect.height;
    
    const snapZoneHeight = trackHeight * SNAP_TO_ZERO_RATIO;
    const usableHeight = trackHeight - snapZoneHeight;
    const previous = coeffs[sliderIndex];
    
    let clampedValue;
    if (y >= usableHeight) {
        clampedValue = 0;
    } else {
        const v = (usableHeight - y) / usableHeight;
        clampedValue = Math.max(0, Math.min(1, v));
    }

    if (clampedValue < COEFF_ZERO_THRESHOLD) {
        clampedValue = 0;
    }

    coeffs[sliderIndex] = clampedValue;
    const releaseDelay = (store.state.timbres[currentColor]?.adsr?.release || 0) * 1000;

    if (clampedValue === 0) {
        if (previous > 0 && isAuditioning) {
            SynthEngine.triggerRelease('C4', currentColor);
            store.emit('spacebarPlayback', { color: currentColor, isPlaying: false });
            isAuditioning = false;
        }

        if (zeroUpdateTimeouts[sliderIndex]) {
            clearTimeout(zeroUpdateTimeouts[sliderIndex]);
        }
        zeroUpdateTimeouts[sliderIndex] = setTimeout(() => {
            const newCoeffs = new Float32Array(store.state.timbres[currentColor].coeffs);
            newCoeffs[sliderIndex] = 0;
            store.setHarmonicCoefficients(currentColor, newCoeffs);
            zeroUpdateTimeouts[sliderIndex] = null;
        }, releaseDelay);
    } else {
        if (zeroUpdateTimeouts[sliderIndex]) {
            clearTimeout(zeroUpdateTimeouts[sliderIndex]);
            zeroUpdateTimeouts[sliderIndex] = null;
        }

        if (!isAuditioning) {
            SynthEngine.triggerAttack('C4', currentColor);
            store.emit('spacebarPlayback', { color: currentColor, isPlaying: true });
            isAuditioning = true;
        }

        const newCoeffs = new Float32Array(store.state.timbres[currentColor].coeffs);
        newCoeffs[sliderIndex] = clampedValue;
        store.setHarmonicCoefficients(currentColor, newCoeffs);
    }

    updateSliderVisuals();
}

function updateForNewColor(color) {
    if (!color) return;
    currentColor = color;
    const timbre = store.state.timbres[color];
    if (timbre) {
        coeffs = new Float32Array(timbre.coeffs);
        for (let i = 0; i < coeffs.length; i++) {
            if (coeffs[i] < COEFF_ZERO_THRESHOLD) {
                coeffs[i] = 0;
            }
        }
        phases = new Float32Array(timbre.phases || coeffs.length);
        
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

export function initHarmonicMultislider() {
    const multisliderContainer = document.querySelector('.multislider-container');
    const filterMainPanel = multisliderContainer?.querySelector('.filter-main-panel');
    
    if (!multisliderContainer || !filterMainPanel) return;

    // Create the main grid container
    multisliderGrid = document.createElement('div');
    multisliderGrid.className = 'multislider-grid';

    // Create 12 columns, each containing label, slider, and phase button
    for (let i = 0; i < BINS; i++) {
        const column = document.createElement('div');
        column.className = 'slider-column';

        // Label
        const label = document.createElement('div');
        label.className = 'harmonic-label';
        label.textContent = i === 0 ? 'F0' : `H${i}`;
        column.appendChild(label);

        // Slider track
        const sliderTrack = document.createElement('div');
        sliderTrack.className = 'slider-track';
        
        // Add snap zone at bottom
        const snapZone = document.createElement('div');
        snapZone.className = 'slider-snap-zone';
        sliderTrack.appendChild(snapZone);
        
        // Add slider fill
        const sliderFill = document.createElement('div');
        sliderFill.className = 'slider-fill';
        sliderTrack.appendChild(sliderFill);
        column.appendChild(sliderTrack);

        // Phase button
        const phaseBtn = document.createElement('button');
        phaseBtn.className = 'phase-button';
        phaseBtn.innerHTML = phaseIconPaths[0];
        
        phaseBtn.addEventListener('click', () => {
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
            store.setHarmonicPhases(currentColor, newPhases);
            
            const degrees = nextPhase === 0 ? 0 : 
                           Math.abs(nextPhase - Math.PI/2) < tolerance ? 90 :
                           Math.abs(nextPhase - Math.PI) < tolerance ? 180 : 270;
            phaseBtn.innerHTML = phaseIconPaths[degrees];
        });
        
        column.appendChild(phaseBtn);
        multisliderGrid.appendChild(column);

        // Store references
        sliderColumns.push({ 
            column, 
            label, 
            sliderTrack, 
            sliderFill, 
            phaseBtn 
        });
        phaseControls.push({ phaseBtn });

        // Add pointer event handlers
        sliderTrack.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            
            SynthEngine.triggerAttack('C4', currentColor);
            store.emit('spacebarPlayback', { color: currentColor, isPlaying: true });
            isAuditioning = true;
            
            handleSliderPointerEvent(e, i);
            
            const onMove = (ev) => handleSliderPointerEvent(ev, i);
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
    }

    // Create filter overlay canvas
    overlayCanvas = document.createElement('canvas');
    overlayCanvas.id = 'filter-overlay-canvas';
    overlayCanvas.className = 'filter-overlay-canvas';
    overlayCtx = overlayCanvas.getContext('2d');
    multisliderGrid.appendChild(overlayCanvas);

    // Add grid to the filter panel
    filterMainPanel.prepend(multisliderGrid);

    // Size the overlay canvas
    const sizeOverlayCanvas = () => {
        const rect = multisliderGrid.getBoundingClientRect();
        if (overlayCanvas.width !== rect.width || overlayCanvas.height !== rect.height) {
            overlayCanvas.width = rect.width;
            overlayCanvas.height = rect.height;
            drawFilterOverlay();
        }
    };

    // Initialize with current color
    currentColor = store.state.selectedNote.color;
    updateForNewColor(currentColor);

    // Set up event listeners
    store.on('timbreChanged', (color) => {
        if (color === currentColor) {
            coeffs = new Float32Array(store.state.timbres[color].coeffs);
            phases = new Float32Array(store.state.timbres[color].phases || coeffs.length);
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
    });

    store.on('noteChanged', ({ newNote }) => {
        if (newNote.color && newNote.color !== currentColor) {
            updateForNewColor(newNote.color);
        }
    });

    // Observe resize for overlay canvas
    new ResizeObserver(sizeOverlayCanvas).observe(multisliderGrid);
    sizeOverlayCanvas();

    console.log('HarmonicMultislider: Initialized with columnar div sliders and perfect alignment.');
}