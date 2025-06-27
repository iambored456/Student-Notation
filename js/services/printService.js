// js/services/printService.js
import store from '../state/store.js';
import { drawPitchGrid } from '../components/Grid/renderers/pitchGridRenderer.js';
import { drawDrumGrid } from '../components/Grid/renderers/drumGridRenderer.js';

console.log("PrintService: Module loaded.");

function generateScoreCanvas(printOptions, targetDimensions) {
    const mainState = store.state;
    const placedTonicSigns = store.placedTonicSigns;
    
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
    
    // --- REFACTORED SCALING LOGIC ---
    const totalWidthUnits = mainState.columnWidths.reduce((sum, w) => sum + w, 0);
    const baseCellWidth = 50; // Use a high-res base for sharp rendering
    const baseCellHeight = baseCellWidth * 2;

    const contentWidth = totalWidthUnits * baseCellWidth;
    const pitchGridHeight = (croppedRowData.length / 2) * baseCellHeight;
    const drumGridHeight = printOptions.includeDrums ? (3 * 0.5 * baseCellHeight) : 0;
    const DRUM_SPACING = drumGridHeight > 0 ? 30 : 0; // Spacing in base units
    const contentHeight = pitchGridHeight + DRUM_SPACING + drumGridHeight;

    // Determine the scale to fit the content within the target dimensions
    const scale = Math.min(targetDimensions.width / contentWidth, targetDimensions.height / contentHeight);

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = contentWidth * scale;
    finalCanvas.height = contentHeight * scale;
    const ctx = finalCanvas.getContext('2d');
    ctx.scale(scale, scale);
    
    ctx.fillStyle = '#FFF';
    ctx.fillRect(0, 0, contentWidth, contentHeight);

    // Render Pitch Grid
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

    // Render Drum Grid
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