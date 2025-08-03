// js/components/HarmonicMultislider/harmonicMultislider.js
import store from '../../state/index.js';
import { HARMONIC_BINS } from '../../constants.js';
import SynthEngine from '../../services/synthEngine.js';

console.log("HarmonicMultislider with Filter Overlay: Module loaded.");

function shadeHexColor(hex, percent) {
    if (!hex) hex = '#CCCCCC';
    const f = parseInt(hex.slice(1), 16),
        t = percent < 0 ? 0 : 255,
        p = percent < 0 ? percent * -1 : percent,
        R = f >> 16,
        G = (f >> 8) & 0x00FF,
        B = f & 0x0000FF;
    return (
        "#" +
        (
            0x1000000 +
            (Math.round((t - R) * p) + R) * 0x10000 +
            (Math.round((t - G) * p) + G) * 0x100 +
            (Math.round((t - B) * p) + B)
        )
            .toString(16)
            .slice(1)
    );
}

function hexToRgba(hex, alpha) {
    if (!hex) hex = '#CCCCCC';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const BINS = HARMONIC_BINS;
let canvas,
    ctx,
    overlayCanvas,
    overlayCtx,
    bufferContainer;
let coeffs = new Float32Array(BINS).fill(0);
let currentColor;
let phases = new Float32Array(BINS).fill(0);
const phaseControls = [];
// Bottom portion of the canvas where pointer interactions snap the value to zero
const SNAP_TO_ZERO_RATIO = 0.1;
// Any coefficient below this value is considered zero
const COEFF_ZERO_THRESHOLD = 0.1;
let isAuditioning = false;
// Delay updating the synth's coefficients when snapping to zero so the
// currently auditioned note can release smoothly without clicks.
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

function draw() {
    if (!ctx || !overlayCtx) return;
    const { width, height } = ctx.canvas;
    if (width === 0 || height === 0) return;
    const barW = (width - (BINS + 1) * 4) / BINS;
    const gap = 4;
    const snapZoneHeight = height * SNAP_TO_ZERO_RATIO;
    const usableHeight = height - snapZoneHeight;
    const maxBarHeight = usableHeight * 0.95;
    const barBaseY = height - snapZoneHeight;
    const barColor = shadeHexColor(currentColor, -0.1);

    overlayCtx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // indicate the snap-to-zero zone along the bottom
    ctx.fillStyle = '#f7f7f7';
    ctx.fillRect(0, height - snapZoneHeight, width, snapZoneHeight);

    coeffs.forEach((c, i) => {
        const x = gap + i * (barW + gap);
        const val = c < COEFF_ZERO_THRESHOLD ? 0 : c;
        const barHeight = val * maxBarHeight;

        if (barHeight === 0) return;

        ctx.fillStyle = barColor;
        ctx.fillRect(x, barBaseY - barHeight, barW, barHeight);
        ctx.strokeStyle = barColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, barBaseY - barHeight + 0.5, barW - 1, barHeight - 1);
    });

    const filterSettings = store.state.timbres[currentColor]?.filter;
    if (filterSettings && filterSettings.enabled) {
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

function sizeCanvas() {
    if (!bufferContainer || !canvas || !overlayCanvas) return;
    const { clientWidth, clientHeight } = bufferContainer;
    if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
        canvas.width = clientWidth;
        canvas.height = clientHeight;
        overlayCanvas.width = clientWidth;
        overlayCanvas.height = clientHeight;
        draw();
    }
}

function handlePointerEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { width, height } = ctx.canvas;
    const barW = (width - (BINS + 1) * 4) / BINS;
    const gap = 4;
    
    // Calculate the index correctly, accounting for the gap before the first bar
    const adjustedX = x - gap;
    
    // Determine which bar the pointer is over
    let idx = Math.floor(adjustedX / (barW + gap));
    
    // Clamp the index to the valid range (0 to BINS - 1)
    idx = Math.max(0, Math.min(BINS - 1, idx));

    // Check if we're actually within the bar's horizontal bounds
    const barStartX = gap + idx * (barW + gap);
    const barEndX = barStartX + barW;
    
    if (x >= barStartX && x <= barEndX) {
        // Calculate the coefficient value based on Y position with snap-to-zero zone
        const snapZoneHeight = height * SNAP_TO_ZERO_RATIO;
        const usableHeight = height - snapZoneHeight;
        const previous = coeffs[idx];
        let clampedValue;
        if (y >= usableHeight) {
            clampedValue = 0;
        } else {
            const v = (usableHeight - y) / (usableHeight * 0.95);
            clampedValue = Math.max(0, Math.min(1, v));
        }

        if (clampedValue < COEFF_ZERO_THRESHOLD) {
            clampedValue = 0;
        }

        coeffs[idx] = clampedValue;
        const releaseDelay =
            (store.state.timbres[currentColor]?.adsr?.release || 0) * 1000;

        if (clampedValue === 0) {
            if (previous > 0 && isAuditioning) {
                SynthEngine.triggerRelease('C4', currentColor);
                store.emit('spacebarPlayback', { color: currentColor, isPlaying: false });
                isAuditioning = false;
            }

            if (zeroUpdateTimeouts[idx]) {
                clearTimeout(zeroUpdateTimeouts[idx]);
            }
            zeroUpdateTimeouts[idx] = setTimeout(() => {
                const newCoeffs = new Float32Array(
                    store.state.timbres[currentColor].coeffs
                );
                newCoeffs[idx] = 0;
                store.setHarmonicCoefficients(currentColor, newCoeffs);
                zeroUpdateTimeouts[idx] = null;
            }, releaseDelay);
        } else {
            if (zeroUpdateTimeouts[idx]) {
                clearTimeout(zeroUpdateTimeouts[idx]);
                zeroUpdateTimeouts[idx] = null;
            }

            if (!isAuditioning) {
                SynthEngine.triggerAttack('C4', currentColor);
                store.emit('spacebarPlayback', { color: currentColor, isPlaying: true });
                isAuditioning = true;
            }

            const newCoeffs = new Float32Array(
                store.state.timbres[currentColor].coeffs
            );
            newCoeffs[idx] = clampedValue;
            store.setHarmonicCoefficients(currentColor, newCoeffs);
        }

        draw();
    }
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
        phaseControls.forEach(({ sincosBtn, polBtn }, i) => {
            if (!sincosBtn || !polBtn) return;
            const phase = phases[i] || 0;
            let p = phase % (2 * Math.PI);
            if (p < 0) p += 2 * Math.PI;
            const isCos =
                (p > Math.PI * 0.25 && p < Math.PI * 0.75) ||
                (p > Math.PI * 1.25 && p < Math.PI * 1.75);
            const isNeg = p > Math.PI * 0.75 && p < Math.PI * 1.25;
            sincosBtn.textContent = isCos ? 'cos' : 'sin';
            polBtn.textContent = isNeg ? '-' : '+';
        });
        draw();
    }
}

export function initHarmonicMultislider() {
    bufferContainer = document.querySelector('.multislider-container .buffer-container');
    canvas = document.getElementById('harmonic-multislider-canvas');
    overlayCanvas = document.getElementById('filter-overlay-canvas');
    if (!canvas || !bufferContainer || !overlayCanvas) return;
    ctx = canvas.getContext('2d');
    overlayCtx = overlayCanvas.getContext('2d');

    if (bufferContainer && !bufferContainer.style.height && !bufferContainer.style.minHeight) {
        bufferContainer.style.minHeight = '80px';
    }

    const multisliderContainer = document.querySelector('.multislider-container');
    const filterMainPanel = multisliderContainer?.querySelector('.filter-main-panel');

    if (multisliderContainer && filterMainPanel) {
        // 1. Create Label Row (Top)
        if (!multisliderContainer.querySelector('.harmonic-label-row')) {
            const labelRow = document.createElement('div');
            labelRow.className = 'harmonic-label-row';
            labelRow.style.display = 'flex';
            labelRow.style.justifyContent = 'space-around';
            labelRow.style.marginBottom = '4px';
            for (let i = 0; i < BINS; i++) {
                const label = document.createElement('span');
                label.textContent = i === 0 ? 'F0' : `H${i}`;
                label.style.fontSize = '0.7rem';
                label.style.flex = '1';
                label.style.textAlign = 'center';
                labelRow.appendChild(label);
            }
            multisliderContainer.insertBefore(labelRow, filterMainPanel);
        }

        // 2. Create Phase Control Row (Bottom)
        if (!multisliderContainer.querySelector('.harmonic-phase-row')) {
            const phaseRow = document.createElement('div');
            phaseRow.className = 'harmonic-phase-row';
            phaseRow.style.display = 'flex';
            phaseRow.style.justifyContent = 'space-around';
            phaseRow.style.marginTop = '4px';
            
            for (let i = 0; i < BINS; i++) {
                const wrapper = document.createElement('div');
                wrapper.className = 'phase-button-pair';
                wrapper.style.display = 'flex';
                wrapper.style.flexDirection = 'column'; // CHANGED: Stack vertically
                wrapper.style.alignItems = 'center';
                wrapper.style.flex = '1';
                wrapper.style.justifyContent = 'center';
                wrapper.style.gap = '2px';
                
                const sincosBtn = document.createElement('button');
                sincosBtn.textContent = 'sin';
                sincosBtn.className = 'phase-button';
                sincosBtn.addEventListener('click', () => {
                    const newPhases = new Float32Array(phases);
                    if (sincosBtn.textContent === 'sin') {
                        sincosBtn.textContent = 'cos';
                        newPhases[i] = (newPhases[i] || 0) + Math.PI / 2;
                    } else {
                        sincosBtn.textContent = 'sin';
                        newPhases[i] = (newPhases[i] || 0) - Math.PI / 2;
                    }
                    phases = newPhases;
                    store.setHarmonicPhases(currentColor, newPhases);
                });
        
                const polBtn = document.createElement('button');
                polBtn.textContent = '+';
                polBtn.className = 'phase-button';
                polBtn.addEventListener('click', () => {
                    const newPhases = new Float32Array(phases);
                    if (polBtn.textContent === '+') {
                        polBtn.textContent = '-';
                        newPhases[i] = (newPhases[i] || 0) + Math.PI;
                    } else {
                        polBtn.textContent = '+';
                        newPhases[i] = (newPhases[i] || 0) - Math.PI;
                    }
                    phases = newPhases;
                    store.setHarmonicPhases(currentColor, newPhases);
                });
        
                // CHANGED: Order is now sin/cos on top, +/- on bottom
                wrapper.appendChild(sincosBtn);
                wrapper.appendChild(polBtn);
                phaseRow.appendChild(wrapper);
                phaseControls.push({ sincosBtn, polBtn });
            }
            filterMainPanel.parentNode.insertBefore(phaseRow, filterMainPanel.nextSibling);
        }
    }

    currentColor = store.state.selectedNote.color;
    updateForNewColor(currentColor);

    canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        
        // Start live auditioning
        SynthEngine.triggerAttack('C4', currentColor);
        store.emit('spacebarPlayback', { color: currentColor, isPlaying: true });
        isAuditioning = true;
        
        handlePointerEvent(e);
        const onMove = (ev) => handlePointerEvent(ev);
        const stopDrag = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', stopDrag);
            store.recordState();
            
            // Stop live auditioning
            SynthEngine.triggerRelease('C4', currentColor);
            store.emit('spacebarPlayback', { color: currentColor, isPlaying: false });
            isAuditioning = true;
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', stopDrag);
    });

    store.on('timbreChanged', (color) => {
        if (color === currentColor) {
            coeffs = new Float32Array(store.state.timbres[color].coeffs);
            phases = new Float32Array(store.state.timbres[color].phases || coeffs.length);
            phaseControls.forEach(({ sincosBtn, polBtn }, i) => {
                if (!sincosBtn || !polBtn) return;
                const phase = phases[i] || 0;
                let p = phase % (2 * Math.PI);
                if (p < 0) p += 2 * Math.PI;
                const isCos =
                    (p > Math.PI * 0.25 && p < Math.PI * 0.75) ||
                    (p > Math.PI * 1.25 && p < Math.PI * 1.75);
                const isNeg = p > Math.PI * 0.75 && p < Math.PI * 1.25;
                sincosBtn.textContent = isCos ? 'cos' : 'sin';
                polBtn.textContent = isNeg ? '-' : '+';
            });
            draw();
        }
    });

    store.on('noteChanged', ({ newNote }) => {
        if (newNote.color && newNote.color !== currentColor) {
            updateForNewColor(newNote.color);
        }
    });

    new ResizeObserver(sizeCanvas).observe(bufferContainer);
    sizeCanvas();

    console.log('HarmonicMultislider: Initialized with new layout and auditioning.');
}