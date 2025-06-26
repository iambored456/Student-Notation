// js/components/HarmonicMultislider/harmonicMultislider.js
import store from '../../state/store.js';
import { HARMONIC_BINS } from '../../constants.js';

console.log("BipolarHarmonicSlider: Module loaded.");

// --- Color Utility ---
function shadeHexColor(hex, percent) {
    const f=parseInt(hex.slice(1),16),t=percent<0?0:255,p=percent<0?percent*-1:percent,R=f>>16,G=f>>8&0x00FF,B=f&0x0000FF;
    return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
}

const BINS = HARMONIC_BINS;
let canvas, ctx, bufferContainer;
let coeffs = new Float32Array(BINS).fill(0);
let currentColor;

function draw() {
    if (!ctx) return;

    const { width, height } = ctx.canvas;
    const midY = height / 2;
    const barW = (width - (BINS + 1) * 4) / BINS;
    const gap = 4;
    const maxBarHeight = midY * 0.95;
    const barColor = shadeHexColor(currentColor, -0.1);

    ctx.clearRect(0, 0, width, height);

    coeffs.forEach((c, i) => {
        if (i === 0) return;
        const x = gap + (i - 1) * (barW + gap);
        const h = Math.abs(c) * maxBarHeight;
        ctx.fillStyle = barColor;
        if (c >= 0) {
            ctx.fillRect(x, midY - h, barW, h);
        } else {
            ctx.fillRect(x, midY, barW, h);
        }
    });

    ctx.strokeStyle = '#dee2e6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();
}

function sizeCanvas() {
    if (!bufferContainer || !canvas) return;
    const { clientWidth, clientHeight } = bufferContainer;
    if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
        canvas.width = clientWidth;
        canvas.height = clientHeight;
        draw();
    }
}

function handlePointerEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { width, height } = ctx.canvas;
    const midY = height / 2;
    const barW = (width - (BINS + 1) * 4) / BINS;
    const gap = 4;
    const idx = Math.floor((x - gap) / (barW + gap)) + 1;

    if (idx > 0 && idx < BINS) {
        const newCoeffs = new Float32Array(store.state.timbres[currentColor].coeffs);
        const v = (midY - y) / (midY * 0.95);
        newCoeffs[idx] = Math.max(-1, Math.min(1, v));
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
    if (!canvas || !bufferContainer) return;
    ctx = canvas.getContext('2d');
    
    currentColor = store.state.selectedTool.color;
    updateForNewColor(currentColor);

    canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        handlePointerEvent(e);
        const onMove = (ev) => handlePointerEvent(ev);
        const stopDrag = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', stopDrag);
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

    console.log("BipolarHarmonicSlider: Initialized.");
}