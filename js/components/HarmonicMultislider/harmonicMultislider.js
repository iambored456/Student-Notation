// js/components/HarmonicMultislider/harmonicMultislider.js
import store from '../../state/store.js';
import SynthEngine from '../../services/synthEngine.js';

console.log("BipolarHarmonicSlider: Module loaded.");

// --- Constants ---
const BINS = 32; // Number of harmonics to show and control

// --- Module State ---
let canvas, ctx;
let bufferContainer; // Store a reference to the container
let coeffs = new Float32Array(BINS).fill(0);
let resizeTimeout;

// --- Drawing Logic ---
function draw() {
    if (!ctx) return;
    console.log(`[DRAW] Drawing with max value: ${Math.max(...coeffs)}`);

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
        ctx.fillStyle = '#26C6DA';
        if (c >= 0) {
            ctx.fillRect(x, midY - h, barW, h);
        } else {
            ctx.fillRect(x, midY, barW, h);
        }
    });

    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();
}

// --- Sizing Logic ---
function sizeCanvas() {
    if (!bufferContainer || !canvas) return;
    
    // Read the final, browser-computed size of the container.
    const { clientWidth, clientHeight } = bufferContainer;

    // Only resize and draw if the dimensions have actually changed.
    if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
        console.log(`[RESIZE] Sizing canvas to ${clientWidth}x${clientHeight}. Redrawing.`);
        canvas.width = clientWidth;
        canvas.height = clientHeight;
        draw();
    }
}

// --- Mouse Interaction ---
function handlePointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { width, height } = ctx.canvas;
    const midY = height / 2;
    const barW = (width - (BINS + 1) * 4) / BINS;
    const gap = 4;
    const idx = Math.floor((x - gap) / (barW + gap)) + 1;

    if (idx > 0 && idx < BINS) {
        console.log(`[HANDLE] Reading from store. Current max value: ${Math.max(...store.state.harmonicCoefficients)}`);
        const newCoeffs = new Float32Array(store.state.harmonicCoefficients);
        const v = (midY - y) / (midY * 0.95);
        newCoeffs[idx] = Math.max(-1, Math.min(1, v));
        console.log(`[HANDLE] Calculated v: ${v.toFixed(4)}. Set index ${idx} to ${newCoeffs[idx].toFixed(4)}.`);
        console.log(`[HANDLE] Sending new coeffs to store. New max value: ${Math.max(...newCoeffs)}`);
        store.setHarmonicCoefficients(newCoeffs);
    }
}

function startDrag(e) {
    e.preventDefault();
    handlePointerMove(e);
    const onMove = (ev) => handlePointerMove(ev);
    const stopDrag = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', stopDrag);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stopDrag);
}

// --- Initialization ---
export function initHarmonicMultislider() {
    // Get all necessary elements
    bufferContainer = document.querySelector('.multislider-container .buffer-container');
    canvas = document.getElementById('harmonic-multislider-canvas');
    
    if (!canvas || !bufferContainer) {
        console.error("BipolarHarmonicSlider: A required container element was not found.");
        return;
    }
    ctx = canvas.getContext('2d');

    // Initial state from the store
    coeffs = store.state.harmonicCoefficients;

    // Event listeners for interaction
    canvas.addEventListener('pointerdown', startDrag);
    store.on('harmonicCoefficientsChanged', (newCoeffs) => {
        console.log(`[LISTENER] Received newCoeffs from store. New max value: ${Math.max(...newCoeffs)}`);
        coeffs = newCoeffs;
        draw();
    });

    // Debounced resize handler for the window
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(sizeCanvas, 100);
    });

    // Perform the initial sizing and drawing
    sizeCanvas();

    console.log("BipolarHarmonicSlider: Initialized with logging.");
}