// js/components/PrintPreview.js
import store from '../state/store.js';
import PrintService from '../services/printService.js';
// We no longer need to import the grid drawers here directly
// import { drawPitchGrid } from './Grid/Grid.js';
// import { drawDrumGrid } from './Grid/drumGrid.js';

console.log("PrintPreview: Module loaded.");

const PrintPreview = {
    init() {
        this.overlay = document.getElementById('print-preview-overlay');
        if (!this.overlay) return;

        this.canvas = document.getElementById('print-preview-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvasWrapper = this.canvas.parentElement;

        // Controls
        this.topRowSlider = document.getElementById('print-top-row-slider');
        this.bottomRowSlider = document.getElementById('print-bottom-row-slider');
        this.topRowLabel = document.getElementById('print-top-row-label');
        this.bottomRowLabel = document.getElementById('print-bottom-row-label');
        this.orientationBtn = document.getElementById('print-orientation-toggle');
        this.colorBtn = document.getElementById('print-color-mode-toggle');
        this.drumsBtn = document.getElementById('print-drums-toggle');

        // Main buttons
        document.getElementById('print-close-button').addEventListener('click', () => store.setPrintPreviewActive(false));
        document.getElementById('print-confirm-button').addEventListener('click', () => {
            PrintService.generateAndPrint(); 
            store.setPrintPreviewActive(false);
        });

        // Event listeners
        this.topRowSlider.addEventListener('input', e => this.handleSliderChange(e, 'topRow'));
        this.bottomRowSlider.addEventListener('input', e => this.handleSliderChange(e, 'bottomRow'));
        this.orientationBtn.addEventListener('click', () => this.handleToggle('orientation', ['landscape', 'portrait']));
        this.colorBtn.addEventListener('click', () => this.handleToggle('colorMode', ['color', 'bw']));
        this.drumsBtn.addEventListener('click', () => this.handleToggle('includeDrums', [true, false]));

        // Listen for changes
        store.on('printPreviewStateChanged', isActive => isActive ? this.show() : this.hide());
        store.on('printOptionsChanged', () => this.renderPreview());
        store.on('notesChanged', () => {
            if (store.state.isPrintPreviewActive) this.renderPreview();
        });

        new ResizeObserver(() => {
            if (store.state.isPrintPreviewActive) this.renderPreview();
        }).observe(this.canvasWrapper);
    },

    show() {
        const pitchNotes = store.state.placedNotes.filter(n => !n.isDrum);
        let minRow = pitchNotes.length > 0 ? Infinity : 34;
        let maxRow = pitchNotes.length > 0 ? -Infinity : 54;

        pitchNotes.forEach(n => {
            minRow = Math.min(minRow, n.row);
            maxRow = Math.max(maxRow, n.row);
        });

        const PADDING = 2;
        const topRow = Math.max(0, minRow - PADDING);
        const bottomRow = Math.min(store.state.fullRowData.length - 1, maxRow + PADDING);

        this.topRowSlider.max = store.state.fullRowData.length - 1;
        this.bottomRowSlider.max = store.state.fullRowData.length - 1;

        store.setPrintOptions({ topRow, bottomRow });
        
        this.overlay.classList.remove('hidden');
        this.renderPreview();
    },

    hide() {
        this.overlay.classList.add('hidden');
    },

    handleSliderChange(e, optionKey) {
        const value = parseInt(e.target.value, 10);
        store.setPrintOptions({ [optionKey]: value });
    },

    handleToggle(optionKey, values) {
        const currentVal = store.state.printOptions[optionKey];
        const nextVal = currentVal === values[0] ? values[1] : values[0];
        console.log(`[PrintPreview] Toggling option '${optionKey}' to new value:`, nextVal);
        store.setPrintOptions({ [optionKey]: nextVal });
    },

    updateControls() {
        const { topRow, bottomRow, orientation, colorMode, includeDrums } = store.state.printOptions;
        
        if (bottomRow < topRow) {
            this.bottomRowSlider.value = topRow;
            store.setPrintOptions({ bottomRow: topRow });
            return;
        }
        
        this.topRowSlider.value = topRow;
        this.bottomRowSlider.value = bottomRow;
        this.topRowLabel.textContent = store.state.fullRowData[topRow]?.pitch || 'N/A';
        this.bottomRowLabel.textContent = store.state.fullRowData[bottomRow]?.pitch || 'N/A';

        this.orientationBtn.textContent = orientation.charAt(0).toUpperCase() + orientation.slice(1);
        this.colorBtn.textContent = colorMode === 'color' ? 'Color' : 'B&W';
        this.drumsBtn.textContent = includeDrums ? 'Yes' : 'No';
        
        this.drumsBtn.classList.toggle('active', includeDrums);
        this.colorBtn.classList.toggle('active', colorMode === 'color');
        // No 'active' class needed for orientation button
    },

    renderPreview() {
        if (!store.state.isPrintPreviewActive) return;
        this.updateControls();
        const printOptions = store.state.printOptions;
        
        // --- 1. Calculate Preview Canvas Dimensions ---
        const wrapperWidth = this.canvasWrapper.clientWidth;
        const wrapperHeight = this.canvasWrapper.clientHeight;
        if (wrapperWidth === 0 || wrapperHeight === 0) return; // Don't render if not visible

        const isLandscape = printOptions.orientation === 'landscape';
        const aspectRatio = isLandscape ? 11 / 8.5 : 8.5 / 11;
        
        let canvasWidth = wrapperWidth;
        let canvasHeight = canvasWidth / aspectRatio;

        if (canvasHeight > wrapperHeight) {
            canvasHeight = wrapperHeight;
            canvasWidth = canvasHeight * aspectRatio;
        }
        
        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;

        // --- 2. Generate the Score Image using the Centralized Service ---
        const scoreCanvas = PrintService.generateScoreCanvas(printOptions, { 
            width: this.canvas.width, 
            height: this.canvas.height 
        });

        // --- 3. Draw the Generated Image onto the Preview Canvas ---
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(scoreCanvas, 0, 0);
        console.log('[PrintPreview] Preview canvas updated.');
    }
};

export default PrintPreview;