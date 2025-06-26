// js/services/printService.js
import store from '../state/store.js';
import { drawPitchGrid } from '../components/Grid/renderers/pitchGridRenderer.js';
import { drawDrumGrid } from '../components/Grid/renderers/drumGridRenderer.js';

console.log("PrintService: Module loaded.");

/**
 * A centralized function to generate a canvas of the score.
 * This can be used by both the print preview and the final print service.
 * @param {object} printOptions - The options from the store (crop, color, etc.).
 * @param {object} targetDimensions - The desired { width, height } of the output canvas.
 * @returns {HTMLCanvasElement} A new canvas element with the score drawn on it.
 */
function generateScoreCanvas(printOptions, targetDimensions) {
    const mainState = store.state;
    
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = targetDimensions.width;
    finalCanvas.height = targetDimensions.height;
    const ctx = finalCanvas.getContext('2d');
    
    // --- 1. Prepare Data ---
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
    
    // --- 2. Calculate Scaling and Layout ---
    const PADDING = 20;
    const DRUM_SPACING = 15;
    
    const availableWidth = finalCanvas.width - (PADDING * 2);
    const availableHeight = finalCanvas.height - (PADDING * 2);

    const totalWidthUnits = mainState.columnWidths.reduce((sum, w) => sum + w, 0);
    const cellWidth = availableWidth / totalWidthUnits;
    const cellHeight = cellWidth * 2;
    
    const pitchGridHeight = (croppedRowData.length / 2) * cellHeight;
    const drumGridHeight = printOptions.includeDrums ? (3 * 0.5 * cellHeight) : 0;
    const totalContentHeight = pitchGridHeight + (drumGridHeight > 0 ? DRUM_SPACING + drumGridHeight : 0);

    let scale = 1;
    if (totalContentHeight > availableHeight) {
        scale = availableHeight / totalContentHeight;
    }
    
    const finalContentWidth = availableWidth * scale;
    const finalContentHeight = totalContentHeight * scale;
    const offsetX = (finalCanvas.width - finalContentWidth) / 2;
    const offsetY = (finalCanvas.height - finalContentHeight) / 2;
    
    // --- 3. Render to Canvas ---
    ctx.fillStyle = '#FFF';
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    const pitchRenderOptions = {
        placedNotes: pitchNotes,
        placedTonicSigns: mainState.placedTonicSigns, // Pass tonic signs
        fullRowData: croppedRowData,
        columnWidths: mainState.columnWidths,
        cellWidth, cellHeight,
        macrobeatGroupings: mainState.macrobeatGroupings,
        macrobeatBoundaryStyles: mainState.macrobeatBoundaryStyles,
        colorMode: printOptions.colorMode
    };
    const pitchCanvas = document.createElement('canvas');
    pitchCanvas.width = availableWidth;
    pitchCanvas.height = pitchGridHeight;
    drawPitchGrid(pitchCanvas.getContext('2d'), pitchRenderOptions);
    ctx.drawImage(pitchCanvas, 0, 0);

    if (printOptions.includeDrums) {
        const drumRenderOptions = {
            placedNotes: drumNotes,
            columnWidths: mainState.columnWidths,
            cellWidth, cellHeight,
            macrobeatGroupings: mainState.macrobeatGroupings,
            macrobeatBoundaryStyles: mainState.macrobeatBoundaryStyles
        };
        const drumCanvas = document.createElement('canvas');
        drumCanvas.width = availableWidth;
        drumCanvas.height = drumGridHeight;
        drawDrumGrid(drumCanvas.getContext('2d'), drumRenderOptions);
        ctx.drawImage(drumCanvas, 0, pitchGridHeight + DRUM_SPACING);
    }
    
    ctx.restore();
    return finalCanvas;
}


const PrintService = {
    generateScoreCanvas,

    generateAndPrint() {
        const options = store.state.printOptions;

        const DPI = 300;
        const PRINT_WIDTH = (options.orientation === 'landscape' ? 10 : 7.5) * DPI;
        const PRINT_HEIGHT = (options.orientation === 'landscape' ? 7.5 : 10) * DPI;

        const finalCanvas = this.generateScoreCanvas(options, { width: PRINT_WIDTH, height: PRINT_HEIGHT });
        
        const stagingArea = document.getElementById('print-staging-area');
        stagingArea.innerHTML = ''; 

        const styleTag = document.getElementById('print-style-rules');
        styleTag.textContent = `@page { size: ${options.orientation}; margin: 0.5in; }`;
        
        const img = document.createElement('img');
        img.src = finalCanvas.toDataURL('image/png');
        stagingArea.appendChild(img);
        
        setTimeout(() => {
            window.print();
            styleTag.textContent = '';
        }, 100); 
    }
};

export default PrintService;