// js/harmony/ui/renderers/analysisRenderers.js
import { getNotesAtBeat, getUniqueNotesInRegion, getKeyContextForBeat } from '../../../state/selectors.js';
import TonalService from '../../../services/tonalService.js';
import LayoutService from '../../../services/layoutService.js';

function drawSelectionRect(ctx, renderOptions) {
    const { isDragging, state } = renderOptions;
    if (!isDragging && state.regionContext.length <= 0) return;

    const startX = LayoutService.getColumnX(state.regionContext.startBeat);
    const endX = LayoutService.getColumnX(state.regionContext.startBeat + state.regionContext.length);
    
    ctx.fillStyle = 'rgba(74, 144, 226, 0.2)';
    ctx.fillRect(startX, 0, endX - startX, ctx.canvas.height);
    
    ctx.strokeStyle = 'rgba(74, 144, 226, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, 0, endX - startX, ctx.canvas.height);
}

function renderDegreeRow(ctx, renderOptions) {
    const { state } = renderOptions;
    const { regionContext } = state;

    for (let i = 0; i < regionContext.length; i++) {
        const beatIndex = regionContext.startBeat + i;
        const notesAtBeat = getNotesAtBeat(state, beatIndex);
        if (notesAtBeat.length === 0) continue;

        const { keyTonic } = getKeyContextForBeat(state, beatIndex);
        const degrees = TonalService.getDegreesForNotes(notesAtBeat, keyTonic);
        const uniqueSortedDegrees = [...new Set(degrees)].sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, ''));
            const numB = parseInt(b.replace(/\D/g, ''));
            return numA - numB;
        }).reverse(); // Reverse for bottom-up drawing

        const x = LayoutService.getColumnX(beatIndex) + (LayoutService.getColumnX(beatIndex + 1) - LayoutService.getColumnX(beatIndex)) / 2;
        const fontSize = 12;
        ctx.font = `${fontSize}px 'Atkinson Hyperlegible', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#343a40';
        
        uniqueSortedDegrees.forEach((degree, stackIndex) => {
            const y = ctx.canvas.height - (stackIndex * (fontSize + 2)) - 5;
            ctx.fillText(degree, x, y);
        });
    }
}

function renderRomanRow(ctx, renderOptions) {
    const { state } = renderOptions;
    const { regionContext } = state;

    const notesInRegion = getUniqueNotesInRegion(state, regionContext);
    if (notesInRegion.length < 2) return;
    
    // The key for the whole region is determined by its starting point
    const { keyTonic, keyMode } = getKeyContextForBeat(state, regionContext.startBeat);
    const romanNumeralInfo = TonalService.getRomanNumeralForNotes(notesInRegion, keyTonic, keyMode);
    
    if (!romanNumeralInfo || !romanNumeralInfo.roman) return;
    
    const { roman, ext } = romanNumeralInfo;
    const startX = LayoutService.getColumnX(regionContext.startBeat);
    const endX = LayoutService.getColumnX(regionContext.startBeat + regionContext.length);
    const centerX = (startX + endX) / 2;
    const y = ctx.canvas.height / 2 + 5;

    // Drawing with superscript
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Main numeral
    ctx.font = "bold 20px 'Atkinson Hyperlegible', sans-serif";
    ctx.fillStyle = '#212529';
    ctx.fillText(roman, centerX, y);
    
    // Extension (superscript)
    if (ext) {
        const mainWidth = ctx.measureText(roman).width;
        ctx.font = "bold 12px 'Atkinson Hyperlegible', sans-serif";
        ctx.fillText(ext, centerX + mainWidth / 2, y - 6);
    }
}


export function renderAnalysisGrid(degreeCtx, romanCtx, renderOptions) {
    [degreeCtx, romanCtx].forEach(ctx => ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height));

    drawSelectionRect(degreeCtx, renderOptions);
    drawSelectionRect(romanCtx, renderOptions);

    renderDegreeRow(degreeCtx, renderOptions);
    renderRomanRow(romanCtx, renderOptions);
}