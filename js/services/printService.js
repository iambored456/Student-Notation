// js/services/printService.js
import store from '../state/index.js';
import { getPlacedTonicSigns } from '../state/selectors.js';
import { drawPitchGrid } from '../components/Grid/renderers/pitchGridRenderer.js';
import { drawDrumGrid } from '../components/Grid/renderers/drumGridRenderer.js';

console.log("PrintService: Module loaded.");

// NEW HELPER FUNCTION FOR RENDERING PAINT TRAILS
function renderPaintTrails(ctx, paintHistory, options) {
    if (paintHistory.length < 2) return;
    
    ctx.globalAlpha = options.opacity;
    
    for (let i = 1; i < paintHistory.length; i++) {
        const prevPoint = paintHistory[i - 1];
        const currentPoint = paintHistory[i];
        
        if (currentPoint.timestamp - prevPoint.timestamp > 200) continue;
        
        const gradient = ctx.createLinearGradient(prevPoint.x, prevPoint.y, currentPoint.x, currentPoint.y);
        gradient.addColorStop(0, `rgb(${prevPoint.color.join(',')})`);
        gradient.addColorStop(1, `rgb(${currentPoint.color.join(',')})`);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = (prevPoint.thickness + currentPoint.thickness) / 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(prevPoint.x, prevPoint.y);
        ctx.lineTo(currentPoint.x, currentPoint.y);
        ctx.stroke();
    }
    
    ctx.globalAlpha = 1.0;
}

function generateScoreCanvas(printOptions, targetDimensions) {
    const mainState = store.state;
    const placedTonicSigns = getPlacedTonicSigns(store.state);
    
    const croppedRowData = mainState.fullRowData.slice(printOptions.topRow, printOptions.bottomRow + 1);
    
    let pitchNotes = mainState.placedNotes
        .filter(n => !n.isDrum && n.row >= printOptions.topRow && n.row <= printOptions.bottomRow)
        .map(n => ({ ...n, row: n.row - printOptions.topRow }));

    let drumNotes = printOptions.includeDrums ? mainState.placedNotes.filter(n => n.isDrum) : [];

    if (printOptions.colorMode === 'bw') {
        const toBlack = (notes) => notes.map(n => ({...n, color: '#212529' }));
        pitchNotes = toBlack(pitchNotes);
        drumNotes = toBlack(drumNotes);
    }
    
    const totalWidthUnits = mainState.columnWidths.reduce((sum, w) => sum + w, 0);
    const baseCellWidth = 50;
    const baseCellHeight = baseCellWidth * 2;

    const contentWidth = totalWidthUnits * baseCellWidth;
    const pitchGridHeight = (croppedRowData.length / 2) * baseCellHeight;
    const drumGridHeight = printOptions.includeDrums ? (3 * 0.5 * baseCellHeight) : 0;
    const DRUM_SPACING = drumGridHeight > 0 ? 30 : 0;
    const contentHeight = pitchGridHeight + DRUM_SPACING + drumGridHeight;

    const scale = Math.min(targetDimensions.width / contentWidth, targetDimensions.height / contentHeight);

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = contentWidth * scale;
    finalCanvas.height = contentHeight * scale;
    const ctx = finalCanvas.getContext('2d');
    ctx.scale(scale, scale);
    
    ctx.fillStyle = '#FFF';
    ctx.fillRect(0, 0, contentWidth, contentHeight);

    const pitchRenderOptions = {
        placedNotes: pitchNotes,
        placedTonicSigns: placedTonicSigns, 
        fullRowData: croppedRowData,
        columnWidths: mainState.columnWidths,
        cellWidth: baseCellWidth, cellHeight: baseCellHeight,
        macrobeatGroupings: mainState.macrobeatGroupings,
        macrobeatBoundaryStyles: mainState.macrobeatBoundaryStyles,
        colorMode: printOptions.colorMode,
        degreeDisplayMode: 'off'
    };
    const pitchCanvas = document.createElement('canvas');
    pitchCanvas.width = contentWidth;
    pitchCanvas.height = pitchGridHeight;
    drawPitchGrid(pitchCanvas.getContext('2d'), pitchRenderOptions);
    ctx.drawImage(pitchCanvas, 0, 0);

    // MODIFICATION: Render Paint Layer
    if (mainState.paint && mainState.paint.paintHistory.length > 0) {
        console.log(`[PrintService] Found ${mainState.paint.paintHistory.length} paint points to print.`);
        
        const paintCanvasForPrint = document.createElement('canvas');
        paintCanvasForPrint.width = contentWidth;
        paintCanvasForPrint.height = pitchGridHeight;
        const paintCtx = paintCanvasForPrint.getContext('2d');
        
        const onScreenPitchCanvas = document.getElementById('notation-grid');
        const scaleX = contentWidth / onScreenPitchCanvas.width;
        const scaleY = pitchGridHeight / (onScreenPitchCanvas.height * (croppedRowData.length / mainState.fullRowData.length));
        
        const yOffset = printOptions.topRow * (baseCellHeight / 2);

        const transformedPaintHistory = mainState.paint.paintHistory.map(p => ({
            ...p,
            x: p.x * scaleX,
            y: (p.y * scaleY) - yOffset,
            thickness: p.thickness * Math.min(scaleX, scaleY)
        }));
        
        renderPaintTrails(paintCtx, transformedPaintHistory, {
            opacity: mainState.paint.paintSettings.opacity / 100
        });
        
        ctx.drawImage(paintCanvasForPrint, 0, 0);
        console.log('[PrintService] Paint trail has been rendered for printing.');
    }

    if (printOptions.includeDrums) {
        const drumRenderOptions = {
            placedNotes: drumNotes,
            placedTonicSigns: placedTonicSigns,
            columnWidths: mainState.columnWidths,
            cellWidth: baseCellWidth, cellHeight: baseCellHeight,
            macrobeatGroupings: mainState.macrobeatGroupings,
            macrobeatBoundaryStyles: mainState.macrobeatBoundaryStyles
        };
        const drumCanvas = document.createElement('canvas');
        drumCanvas.width = contentWidth;
        drumCanvas.height = drumGridHeight;
        drawDrumGrid(drumCanvas.getContext('2d'), drumRenderOptions);
        ctx.drawImage(drumCanvas, 0, pitchGridHeight + DRUM_SPACING);
    }
    
    return finalCanvas;
}

const PrintService = {
    generateScoreCanvas,
    generateAndPrint() {
        const options = store.state.printOptions;
        const DPI = 300;
        const PRINT_WIDTH = (options.orientation === 'landscape' ? 10.5 : 8) * DPI;
        const PRINT_HEIGHT = (options.orientation === 'landscape' ? 8 : 10.5) * DPI;

        const finalCanvas = this.generateScoreCanvas(options, { width: PRINT_WIDTH, height: PRINT_HEIGHT });
        
        const stagingArea = document.getElementById('print-staging-area');
        stagingArea.innerHTML = ''; 

        const styleTag = document.getElementById('print-style-rules');
        styleTag.textContent = `@page { size: ${options.orientation}; margin: 0.25in; }`;
        
        const img = document.createElement('img');
        img.src = finalCanvas.toDataURL('image/png');
        img.style.width = '100%';
        img.style.height = 'auto';
        stagingArea.appendChild(img);
        
        setTimeout(() => window.print(), 100); 
    }
};

export default PrintService;