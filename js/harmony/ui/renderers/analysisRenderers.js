// js/harmony/ui/renderers/analysisRenderers.js
import { getNotesAtBeat, getUniqueNotesInRegion, getKeyContextForBeat, getPlacedTonicSigns } from '../../../state/selectors.js';
import TonalService from '../../../services/tonalService.js';
import LayoutService from '../../../services/layoutService.js';
import { getColumnX } from '../../../components/Canvas/PitchGrid/renderers/rendererUtils.js';
import { shouldDrawVerticalLineAtColumn, isTonicColumn } from '../../../utils/tonicColumnUtils.js';

/**
 * Get column X position with modulation awareness
 * @param {number} columnIndex - Column index
 * @param {Object} state - Application state
 * @returns {number} X position (modulated if modulation exists)
 */
function getModulationAwareColumnX(columnIndex, state) {
    const hasModulation = state.modulationMarkers && state.modulationMarkers.length > 0;
    
    if (hasModulation) {
        return getColumnX(columnIndex, {
            ...state,
            modulationMarkers: state.modulationMarkers,
            cellWidth: state.cellWidth,
            columnWidths: state.columnWidths,
            baseMicrobeatPx: state.cellWidth
        });
    } else {
        return LayoutService.getColumnX(columnIndex);
    }
}

function drawVerticalGridLines(ctx, renderOptions) {
    const { state } = renderOptions;
    const { columnWidths, macrobeatGroupings, macrobeatBoundaryStyles } = state;
    const placedTonicSigns = getPlacedTonicSigns(state);
    const totalColumns = columnWidths.length;
    let macrobeatBoundaries = [];

    // Calculate macrobeat boundaries (same logic as other grids)
    let current_col = 2;
    for(let i = 0; i < macrobeatGroupings.length; i++) {
        while(placedTonicSigns.some(ts => ts.columnIndex === current_col)) {
            current_col += 2;  // Each tonic spans 2 columns
        }
        current_col += macrobeatGroupings[i];
        macrobeatBoundaries.push(current_col);
    }
    
    for (let i = 0; i <= totalColumns; i++) {
        const x = getModulationAwareColumnX(i, state);
        
        let style;
        const isBoundary = i === 2 || i === totalColumns - 2;
        const isTonicColumnStart = isTonicColumn(i, placedTonicSigns);
        const isTonicColumnEnd = placedTonicSigns.some(ts => i === ts.columnIndex + 2);
        const isMacrobeatEnd = macrobeatBoundaries.includes(i);
        const shouldDraw = shouldDrawVerticalLineAtColumn(i, placedTonicSigns);

        // Skip drawing vertical lines in the middle of tonic shapes
        if (!shouldDraw) {
            continue;
        }

        if (isBoundary || isTonicColumnStart || isTonicColumnEnd) {
            style = { lineWidth: 2, strokeStyle: '#adb5bd', dash: [] };
        } else if (isMacrobeatEnd) {
            const mbIndex = macrobeatBoundaries.indexOf(i);
            if (mbIndex !== -1) {
                const boundaryStyle = macrobeatBoundaryStyles[mbIndex];
                if (boundaryStyle === 'anacrusis') {
                    continue;
                }
                style = { lineWidth: 1, strokeStyle: '#adb5bd', dash: boundaryStyle === 'solid' ? [] : [5, 5] };
            } else { 
                continue; 
            }
        } else { 
            continue; 
        }
        
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ctx.canvas.height);
        ctx.lineWidth = style.lineWidth;
        ctx.strokeStyle = style.strokeStyle;
        ctx.setLineDash(style.dash);
        ctx.stroke();
    }
    ctx.setLineDash([]);
}

function drawSelectionRect(ctx, renderOptions) {
    const { isDragging, state } = renderOptions;
    if (!isDragging && state.regionContext.length <= 0) return;

    const startX = getModulationAwareColumnX(state.regionContext.startBeat, state);
    const endX = getModulationAwareColumnX(state.regionContext.startBeat + state.regionContext.length, state);
    
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

        const columnStart = getModulationAwareColumnX(beatIndex, state);
        const columnEnd = getModulationAwareColumnX(beatIndex + 1, state);
        const x = columnStart + (columnEnd - columnStart) / 2;
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
    const startX = getModulationAwareColumnX(regionContext.startBeat, state);
    const endX = getModulationAwareColumnX(regionContext.startBeat + regionContext.length, state);
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

    // Draw vertical grid lines on both canvases for continuity with other grids
    drawVerticalGridLines(degreeCtx, renderOptions);
    drawVerticalGridLines(romanCtx, renderOptions);

    drawSelectionRect(degreeCtx, renderOptions);
    drawSelectionRect(romanCtx, renderOptions);

    renderDegreeRow(degreeCtx, renderOptions);
    renderRomanRow(romanCtx, renderOptions);
}