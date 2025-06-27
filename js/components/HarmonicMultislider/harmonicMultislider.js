// js/components/HarmonicMultislider/harmonicMultislider.js
import store from '../../state/store.js';
import { HARMONIC_BINS } from '../../constants.js';

console.log("HarmonicMultislider with Filter Overlay: Module loaded.");

function shadeHexColor(hex, percent) {
    const f=parseInt(hex.slice(1),16),t=percent<0?0:255,p=percent<0?percent*-1:percent,R=f>>16,G=f>>8&0x00FF,B=f&0x0000FF;
    return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const BINS = HARMONIC_BINS;
let canvas, ctx, overlayCanvas, overlayCtx, bufferContainer;
let coeffs = new Float32Array(BINS).fill(0);
let currentColor;

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

    const res_q = 1.0 - (resonance / 105);
    const peak_width = Math.max(0.01, 0.2 * res_q * res_q);
    const peak = Math.exp(-Math.pow((norm_pos - norm_cutoff) / peak_width, 2));
    const res_gain = (resonance / 100) * 0.6;
    
    return Math.min(1.0, shape + peak * res_gain);
}

function draw() {
    if (!ctx || !overlayCtx) return;

    const { width, height } = ctx.canvas;
    const barW = (width - (BINS + 1) * 4) / BINS;
    const gap = 4;
    const maxBarHeight = height * 0.95;
    const barColor = shadeHexColor(currentColor, -0.1);
    const filterSettings = store.state.timbres[currentColor]?.filter;

    ctx.clearRect(0, 0, width, height);
    overlayCtx.clearRect(0, 0, width, height);
    
    if (!filterSettings) return;

    // --- Draw Harmonic Bars (Always at full height) ---
    coeffs.forEach((c, i) => {
        if (i === 0) return;
        const x = gap + (i - 1) * (barW + gap);
        const barHeight = c * maxBarHeight; // No longer modified by filter
        
        ctx.fillStyle = barColor;
        ctx.fillRect(x, height - barHeight, barW, barHeight);
    });

    // --- Draw Smooth Filter Curve Overlay ---
    if (filterSettings.enabled) {
        overlayCtx.beginPath();
        const step = 2;

        for (let x = 0; x <= width; x += step) {
            const norm_pos = x / width;
            const amp = getFilterAmplitudeAt(norm_pos, filterSettings);
            const y = height - (amp * maxBarHeight);
            if (x === 0) {
                overlayCtx.moveTo(x, y);
            } else {
                overlayCtx.lineTo(x, y);
            }
        }
        
        overlayCtx.strokeStyle = shadeHexColor(currentColor, -0.3);
        overlayCtx.lineWidth = 2.5;
        overlayCtx.stroke();
        
        overlayCtx.lineTo(width, height);
        overlayCtx.lineTo(0, height);
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
    // REMOVED: The check for whether the filter is enabled is gone.
    // This function will now run at all times.
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { width, height } = ctx.canvas;
    const barW = (width - (BINS + 1) * 4) / BINS;
    const gap = 4;
    
    const idx = Math.floor((x - gap) / (barW + gap)) + 1;

    if (idx > 0 && idx < BINS) {
        const newCoeffs = new Float32Array(store.state.timbres[currentColor].coeffs);
        const v = (height - y) / (height * 0.95);
        newCoeffs[idx] = Math.max(0, Math.min(1, v));
        store.setHarmonicCoefficients(currentColor, newCoeffs);
    }
}

function updateForNewColor(color) {
    if (!color) return;
    currentColor = color;
    const timbre = store.state.timbres[color];
    if (timbre) {
        coeffs = timbre.coeffs;
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
    
    currentColor = store.state.selectedTool.color;
    updateForNewColor(currentColor);

    canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        handlePointerEvent(e);
        const onMove = (ev) => handlePointerEvent(ev);
        const stopDrag = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', stopDrag);
            // We now record state regardless of filter, as bar editing is always possible.
            store.recordState();
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', stopDrag);
    });

    store.on('timbreChanged', (color) => {
        if (color === currentColor) {
            coeffs = store.state.timbres[color].coeffs;
            draw();
        }
    });

    store.on('toolChanged', ({ newTool }) => {
        if (newTool.color && newTool.color !== currentColor) {
            updateForNewColor(newTool.color);
        }
    });

    new ResizeObserver(sizeCanvas).observe(bufferContainer);
    sizeCanvas();

    console.log("HarmonicMultislider: Initialized with filter overlay.");
}