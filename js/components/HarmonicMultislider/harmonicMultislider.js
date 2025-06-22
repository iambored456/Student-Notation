// js/components/HarmonicMultislider/harmonicMultislider.js
import store from '../../state/store.js';
import SynthEngine from '../../services/synthEngine.js';

console.log("BipolarHarmonicSlider: Module loaded.");

const BINS = 32;
let canvas, ctx;
let bufferContainer;
let coeffs = new Float32Array(BINS).fill(0);
let resizeTimeout;

function draw() {
    if (!ctx) return;

    const { width, height } = ctx.canvas;
    const midY = height / 2;
    const barW = (width - (BINS + 1) * 4) / BINS;
    const gap = 4;
    const maxBarHeight = midY * 0.95;

    ctx.clearRect(0, 0, width, height);

    coeffs.forEach((c, i) => {
        if (i === 0) return;
        const x = gap + (i - 1) * (barW + gap);
        const h = Math.abs(c) * maxBarHeight;
        ctx.fillStyle = '#4A90E2';
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

// UPDATED: Restored original, more direct event handling logic
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
        const newCoeffs = new Float32Array(store.state.harmonicCoefficients);
        const v = (midY - y) / (midY * 0.95);
        newCoeffs[idx] = Math.max(-1, Math.min(1, v));
        store.setHarmonicCoefficients(newCoeffs);
    }
}

export function initHarmonicMultislider() {
    bufferContainer = document.querySelector('.multislider-container .buffer-container');
    canvas = document.getElementById('harmonic-multislider-canvas');
    
    if (!canvas || !bufferContainer) {
        console.error("BipolarHarmonicSlider: A required container element was not found.");
        return;
    }
    ctx = canvas.getContext('2d');

    coeffs = store.state.harmonicCoefficients;

    // UPDATED: Simplified event listeners
    canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        handlePointerEvent(e); // Handle initial click
        
        const onMove = (ev) => handlePointerEvent(ev);
        
        const stopDrag = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', stopDrag);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', stopDrag);
    });

    store.on('harmonicCoefficientsChanged', (newCoeffs) => {
        coeffs = newCoeffs;
        draw();
    });

    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(sizeCanvas, 100);
    });

    sizeCanvas();

    console.log("BipolarHarmonicSlider: Initialized.");
}