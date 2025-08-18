// js/components/Canvas/HarmonyAnalysis/harmonyRenderer.js
import { getNotesInMacrobeat, getKeyContextForBeat, getMacrobeatInfo } from '../../../state/selectors.js';
import TonalService from '../../../services/tonalService.js';
import LayoutService from '../../../services/layoutService.js';
import { getPlacedTonicSigns } from '../../../state/selectors.js';
import { Scale, Interval } from 'tonal';
import { renderModulationMarkers } from '../PitchGrid/renderers/modulationRenderer.js';

function drawVerticalHarmonyLines(ctx, options) {
    const { columnWidths, macrobeatGroupings, macrobeatBoundaryStyles, cellWidth } = options;
    const placedTonicSigns = getPlacedTonicSigns(options);
    const totalColumns = columnWidths.length;
    let macrobeatBoundaries = [];

    let current_col = 2;
    for(let i=0; i<macrobeatGroupings.length; i++) {
        // Skip over tonic columns when calculating macrobeat boundaries
        while(placedTonicSigns.some(ts => ts.columnIndex === current_col)) {
            current_col += 2;  // Fixed: Each tonic spans 2 columns
        }
        current_col += macrobeatGroupings[i];
        macrobeatBoundaries.push(current_col);
    }

    function getColumnX(index) {
        let x = 0;
        for (let i = 0; i < index; i++) {
            const widthMultiplier = columnWidths[i] || 0;
            x += widthMultiplier * cellWidth;
        }
        return x;
    }

    for (let i = 0; i <= totalColumns; i++) {
        const x = getColumnX(i);
        let style;
        const isBoundary = i === 2 || i === totalColumns - 2;
        const isTonicCol = placedTonicSigns.some(ts => ts.columnIndex === i);
        const isTonicColumnEnd = placedTonicSigns.some(ts => i === ts.columnIndex + 2);
        const isMacrobeatEnd = macrobeatBoundaries.includes(i);

        if (isBoundary || isTonicCol || isTonicColumnEnd) {
            style = { lineWidth: 2, strokeStyle: '#adb5bd', dash: [] };
        } else if (isMacrobeatEnd) {
            const mbIndex = macrobeatBoundaries.indexOf(i);
            if (mbIndex !== -1) {
                const boundaryStyle = macrobeatBoundaryStyles[mbIndex];
                if (boundaryStyle === 'anacrusis') continue;
                style = { lineWidth: 1, strokeStyle: '#adb5bd', dash: boundaryStyle === 'solid' ? [] : [5, 5] };
            } else { continue; }
        } else { continue; }
        
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


function drawAnalysisForMacrobeat(ctx, state, macrobeatIndex) {
    const notes = getNotesInMacrobeat(state, macrobeatIndex);
    
    const { startColumn, grouping } = getMacrobeatInfo(state, macrobeatIndex);
    const { keyTonic, keyMode } = getKeyContextForBeat(state, startColumn);
    
    // Use zoom-aware positioning like other grids
    function getColumnX(index) {
        let x = 0;
        for (let i = 0; i < index; i++) {
            const widthMultiplier = state.columnWidths[i] || 0;
            x += widthMultiplier * state.cellWidth;
        }
        return x;
    }
    
    const x = getColumnX(startColumn);
    const width = grouping * state.cellWidth;
    const centerX = x + width / 2;

    const romanNumeralInfo = TonalService.getRomanNumeralForNotes(notes, keyTonic, keyMode);
    
    // REMOVED: The variables for splitting the canvas height are no longer needed.
    // const degreeRowHeight = 60;
    // const romanRowHeight = 30;

    // REMOVED: This entire block of code was responsible for drawing the
    // individual scale degrees. By removing it, we achieve the desired visual result
    // without "nerfing" the Roman numeral calculation which happens next.
    /*
    if (notes.length > 0) {
        const chordRoot = romanNumeralInfo ? romanNumeralInfo.root : null;
        
        const degreeObjects = notes.map(notePc => ({
            degree: formatInterval(Interval.distance(keyTonic, notePc)),
            pc: notePc
        })).filter(d => d.degree);

        degreeObjects.sort((a, b) => parseInt(a.degree.replace(/\D/g, '')) - parseInt(b.degree.replace(/\D/g, '')));

        ctx.font = "bold 12px 'Atkinson Hyperlegible', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#343a40';
        
        degreeObjects.forEach((dObj, index) => {
            let label = dObj.degree;
            if (chordRoot && dObj.pc === chordRoot) {
                label = `r${dObj.degree}`;
            }
            const y = degreeRowHeight - (index * 15) - 10;
            ctx.fillText(label, centerX, y);
        });
    }
    */

    if (romanNumeralInfo && romanNumeralInfo.roman) {
        const { roman, ext } = romanNumeralInfo;
        
        // Scale font size based on canvas height to maintain aspect ratio
        const heightScaleFactor = ctx.canvas.height / 40; // 40px baseline height
        const mainFontSize = Math.max(12, Math.round(22 * heightScaleFactor)); // Minimum 12px
        const superFontSize = Math.max(8, Math.round(14 * heightScaleFactor)); // Minimum 8px
        
        const mainFont = `bold ${mainFontSize}px 'Atkinson Hyperlegible', sans-serif`;
        const superFont = `bold ${superFontSize}px 'Atkinson Hyperlegible', sans-serif`;
        
        ctx.font = mainFont;
        const mainWidth = ctx.measureText(roman).width;
        
        ctx.font = superFont;
        const extWidth = ctx.measureText(ext).width;

        const totalWidth = mainWidth + extWidth;
        const startX = centerX - totalWidth / 2;

        // CHANGED: The 'y' position is now calculated to be the vertical center of the canvas.
        const y = ctx.canvas.height / 2;

        ctx.font = mainFont;
        ctx.fillStyle = '#212529';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(roman, startX, y);
        
        if (ext) {
            ctx.font = superFont;
            ctx.fillText(ext, startX + mainWidth, y - 8); // Adjusted superscript position
        }
    }
}


export function drawHarmonyGrid(ctx, options) {
    const { state } = options;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // DEBUG: Log canvas positioning info
    const canvas = ctx.canvas;
    const rect = canvas.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(canvas);
    
    // REMOVED: The horizontal line dividing the two sections is no longer needed.
    // ctx.beginPath();
    // ctx.moveTo(0, 60);
    // ctx.lineTo(ctx.canvas.width, 60);
    // ctx.strokeStyle = '#e9ecef';
    // ctx.lineWidth = 1;
    // ctx.stroke();

    drawVerticalHarmonyLines(ctx, state);

    for (let i = 0; i < state.macrobeatGroupings.length; i++) {
        drawAnalysisForMacrobeat(ctx, state, i);
    }
    
    // Draw modulation markers (render on top of everything else)
    renderModulationMarkers(ctx, state);
}

// This helper function is no longer called, but we can leave it in case you want to use it elsewhere.
function formatInterval(interval) {
    if (!interval) return null;
    const details = Interval.get(interval);
    if (!details || !details.num) return null;
    let prefix = '';
    const alt = details.alt || 0;
    if (alt < 0) prefix = '♭'.repeat(Math.abs(alt));
    else if (alt > 0) prefix = '♯'.repeat(alt);
    return `${prefix}${details.num}`;
}