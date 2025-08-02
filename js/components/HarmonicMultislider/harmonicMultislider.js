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
let oscilloCanvas;
let oscilloCtx;
let oscilloAnimationId = null;

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
    const maxBarHeight = height * 0.95;
    const barColor = shadeHexColor(currentColor, -0.1);

    overlayCtx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    coeffs.forEach((c, i) => {
        const x = gap + i * (barW + gap);
        let barHeight = c * maxBarHeight;
        let fillStyle;
        let strokeStyle;
        if (c <= 0.001) {
            barHeight = 2;
            fillStyle = shadeHexColor(currentColor, 0.4);
            strokeStyle = shadeHexColor(currentColor, 0.3);
        } else {
            fillStyle = barColor;
            strokeStyle = barColor;
        }
        ctx.fillStyle = fillStyle;
        ctx.fillRect(x, height - barHeight, barW, barHeight);
        // Draw a thin border to make each bar stand out
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, height - barHeight + 0.5, barW - 1, barHeight - 1);
    });

    const filterSettings = store.state.timbres[currentColor]?.filter;
    if (filterSettings && filterSettings.enabled) {
        overlayCtx.beginPath();
        const step = 2;
        for (let x = 0; x <= width; x += step) {
            const norm_pos = x / width;
            const amp = getFilterAmplitudeAt(norm_pos, filterSettings);
            const y = height - amp * maxBarHeight;
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

function drawOscilloscope() {
    if (!oscilloCtx || !oscilloCanvas) return;
    const analyser = SynthEngine.getWaveformForColor(currentColor);
    const width = oscilloCanvas.width;
    const height = oscilloCanvas.height;
    oscilloCtx.clearRect(0, 0, width, height);
    if (analyser) {
        const values = analyser.getValue();
        const len = values.length;
        oscilloCtx.beginPath();
        for (let i = 0; i < len; i++) {
            const x = (i / (len - 1)) * width;
            const y = height * 0.5 - values[i] * height * 0.5;
            if (i === 0) {
                oscilloCtx.moveTo(x, y);
            } else {
                oscilloCtx.lineTo(x, y);
            }
        }
        oscilloCtx.strokeStyle = '#007AFF';
        oscilloCtx.lineWidth = 1;
        oscilloCtx.stroke();
    }
    oscilloAnimationId = requestAnimationFrame(drawOscilloscope);
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
    if (oscilloCanvas) {
        const cw = oscilloCanvas.clientWidth;
        const ch = oscilloCanvas.clientHeight;
        if (oscilloCanvas.width !== cw || oscilloCanvas.height !== ch) {
            oscilloCanvas.width = cw;
            oscilloCanvas.height = ch;
        }
    }
}

function handlePointerEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { width, height } = ctx.canvas;
    const barW = (width - (BINS + 1) * 4) / BINS;
    const gap = 4;
    const idx = Math.floor((x - gap) / (barW + gap)) + 1;
    if (idx > 0 && idx < BINS) {
        const newCoeffs = new Float32Array(
            store.state.timbres[currentColor].coeffs
        );
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
        coeffs = new Float32Array(timbre.coeffs);
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
        if (oscilloAnimationId !== null) {
            cancelAnimationFrame(oscilloAnimationId);
            oscilloAnimationId = null;
        }
        if (oscilloCanvas) {
            oscilloCanvas.width = oscilloCanvas.clientWidth;
            oscilloCanvas.height = oscilloCanvas.clientHeight;
        }
        drawOscilloscope();
    }
}

export function initHarmonicMultislider() {
    bufferContainer = document.querySelector(
        '.multislider-container .buffer-container'
    );
    canvas = document.getElementById('harmonic-multislider-canvas');
    overlayCanvas = document.getElementById('filter-overlay-canvas');
    if (!canvas || !bufferContainer || !overlayCanvas) return;
    ctx = canvas.getContext('2d');
    overlayCtx = overlayCanvas.getContext('2d');

    // Guarantee the buffer container has a visible height.  Without this,
    // flexbox layouts may collapse it, resulting in a zero-height canvas.
    if (
        bufferContainer &&
        !bufferContainer.style.height &&
        !bufferContainer.style.minHeight
    ) {
        bufferContainer.style.minHeight = '80px';
    }

    // Insert the label/phase control row above the filter main panel
    {
        const multisliderContainer = document.querySelector(
            '.multislider-container'
        );
        const filterMainPanel = multisliderContainer
            ? multisliderContainer.querySelector('.filter-main-panel')
            : null;
        if (
            multisliderContainer &&
            filterMainPanel &&
            !multisliderContainer.querySelector('.harmonic-label-row')
        ) {
            const labelRow = document.createElement('div');
            labelRow.className = 'harmonic-label-row';
            labelRow.style.display = 'flex';
            labelRow.style.justifyContent = 'space-between';
            labelRow.style.marginBottom = '4px';
            for (let i = 0; i < BINS; i++) {
                const wrapper = document.createElement('div');
                wrapper.style.display = 'flex';
                wrapper.style.flexDirection = 'column';
                wrapper.style.alignItems = 'center';
                wrapper.style.flex = '1';
                const label = document.createElement('span');
                label.textContent = i === 0 ? 'F0' : `H${i}`;
                label.style.fontSize = '0.7rem';
                label.style.marginBottom = '2px';
                const sincosBtn = document.createElement('button');
                sincosBtn.textContent = 'sin';
                sincosBtn.style.fontSize = '0.6rem';
                sincosBtn.style.padding = '1px 4px';
                sincosBtn.style.marginBottom = '2px';
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
                polBtn.style.fontSize = '0.6rem';
                polBtn.style.padding = '1px 4px';
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
                wrapper.appendChild(label);
                wrapper.appendChild(sincosBtn);
                wrapper.appendChild(polBtn);
                labelRow.appendChild(wrapper);
                phaseControls.push({ sincosBtn, polBtn });
            }
            multisliderContainer.insertBefore(labelRow, filterMainPanel);
        }
    }

    // Insert the oscilloscope canvas below the harmonic bars and above the cutoff slider
    {
        const container = document.querySelector('.multislider-container');
        if (container && !oscilloCanvas) {
            oscilloCanvas = document.createElement('canvas');
            oscilloCanvas.id = 'oscilloscope-canvas';
            oscilloCanvas.style.width = '100%';
            oscilloCanvas.style.height = '80px';
            oscilloCanvas.style.display = 'block';
            oscilloCanvas.style.marginTop = '4px';
            oscilloCtx = oscilloCanvas.getContext('2d');
            const cutoffContainer = container.querySelector(
                '#cutoff-slider-container'
            );
            if (cutoffContainer) {
                container.insertBefore(oscilloCanvas, cutoffContainer);
            } else {
                container.appendChild(oscilloCanvas);
            }
        }
    }

    currentColor = store.state.selectedNote.color;
    updateForNewColor(currentColor);

    canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        handlePointerEvent(e);
        const onMove = (ev) => handlePointerEvent(ev);
        const stopDrag = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', stopDrag);
            store.recordState();
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', stopDrag);
    });

    store.on('timbreChanged', (color) => {
        if (color === currentColor) {
            coeffs = new Float32Array(store.state.timbres[color].coeffs);
            phases = new Float32Array(
                store.state.timbres[color].phases || coeffs.length
            );
            phaseControls.forEach(({ sincosBtn, polBtn }, i) => {
                const phase = phases[i] || 0;
                let p = phase % (2 * Math.PI);
                if (p < 0) p += 2 * Math.PI;
                const isCos =
                    (p > Math.PI * 0.25 && p < Math.PI * 0.75) ||
                    (p > Math.PI * 1.25 && p < Math.PI * 1.75);
                const isNeg =
                    p > Math.PI * 0.75 && p < Math.PI * 1.25;
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

    if (oscilloCanvas) {
        oscilloCanvas.width = oscilloCanvas.clientWidth;
        oscilloCanvas.height = oscilloCanvas.clientHeight;
        drawOscilloscope();
    }

    new ResizeObserver(sizeCanvas).observe(bufferContainer);
    sizeCanvas();

    console.log('HarmonicMultislider: Initialized.');
}
