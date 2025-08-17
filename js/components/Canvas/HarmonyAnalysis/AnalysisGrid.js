// js/components/Canvas/HarmonyAnalysis/AnalysisGrid.js
import store from '../../../state/index.js';
import { renderAnalysisGrid } from './renderers/analysisRenderers.js';
import GridCoordsService from '../../../services/gridCoordsService.js';
import LayoutService from '../../../services/layoutService.js';

let container, degreeCanvas, degreeCtx, romanCanvas, romanCtx;
let isDragging = false;
let selectionRect = { startX: 0, endX: 0 };

function getBeatIndexFromX(canvasX) {
    const scrollLeft = document.getElementById('canvas-container').scrollLeft;
    return GridCoordsService.getColumnIndex(canvasX + scrollLeft);
}

function render() {
    if (!degreeCtx || !romanCtx) return;

    const renderOptions = {
        state: store.state,
        selectionRect,
        isDragging
    };

    renderAnalysisGrid(degreeCtx, romanCtx, renderOptions);
}

function handleMouseDown(e) {
    isDragging = true;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    const startBeat = getBeatIndexFromX(x);
    if (startBeat < 2) return; // Disallow dragging from legend

    selectionRect.startX = x;
    selectionRect.endX = x;

    store.setRegionContext({ startBeat: startBeat, length: 1 });
    render();
}

function handleMouseMove(e) {
    if (!isDragging) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    selectionRect.endX = x;

    const startBeat = store.state.regionContext.startBeat;
    const endBeat = getBeatIndexFromX(x);

    const newStart = Math.min(startBeat, endBeat);
    const newEnd = Math.max(startBeat, endBeat);
    
    // Clamp to valid grid area
    if (newStart < 2 || newEnd >= store.state.columnWidths.length - 2) return;

    store.setRegionContext({
        startBeat: newStart,
        length: newEnd - newStart + 1
    });
}

function handleMouseUp() {
    isDragging = false;
    render(); // Final render without the "isDragging" hint
}

export function initAnalysisGrid() {
    container = document.getElementById('analysis-grid-container');
    degreeCanvas = document.getElementById('analysis-degree-canvas');
    romanCanvas = document.getElementById('analysis-roman-canvas');

    if (!container || !degreeCanvas || !romanCanvas) {
        console.error("AnalysisGrid: Could not find required canvas elements.");
        return;
    }

    degreeCtx = degreeCanvas.getContext('2d');
    romanCtx = romanCanvas.getContext('2d');

    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    const resizeObserver = new ResizeObserver(() => {
        const totalWidth = LayoutService.getModulatedCanvasWidth();
        degreeCanvas.width = totalWidth;
        romanCanvas.width = totalWidth;
        render();
    });
    resizeObserver.observe(container);

    store.on('regionContextChanged', render);
    store.on('notesChanged', render);
    store.on('chordsChanged', render);
    store.on('layoutConfigChanged', render);
    store.on('modulationMarkersChanged', render);

    render();
    console.log("AnalysisGrid: Initialized.");
}