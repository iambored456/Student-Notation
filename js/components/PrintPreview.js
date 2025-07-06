// js/components/PrintPreview.js
import store from '../state/index.js'; // <-- UPDATED PATH
import PrintService from '../services/printService.js';

console.log("PrintPreview: Module loaded.");

const PrintPreview = {
    init() {
        this.overlay = document.getElementById('print-preview-overlay');
        if (!this.overlay) return;

        this.canvas = document.getElementById('print-preview-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvasWrapper = this.canvas.parentElement;

        this.topRowSlider = document.getElementById('print-top-row-slider');
        this.bottomRowSlider = document.getElementById('print-bottom-row-slider');
        this.topRowLabel = document.getElementById('print-top-row-label');
        this.bottomRowLabel = document.getElementById('print-bottom-row-label');
        this.orientationBtn = document.getElementById('print-orientation-toggle');
        this.colorBtn = document.getElementById('print-color-mode-toggle');
        this.drumsBtn = document.getElementById('print-drums-toggle');

        document.getElementById('print-close-button').addEventListener('click', () => this.hide());
        document.getElementById('print-confirm-button').addEventListener('click', () => {
            PrintService.generateAndPrint();
            this.hide();
        });

        this.topRowSlider.addEventListener('input', (e) => store.setPrintOptions({ topRow: parseInt(e.target.value) }));
        this.bottomRowSlider.addEventListener('input', (e) => store.setPrintOptions({ bottomRow: parseInt(e.target.value) }));
        this.orientationBtn.addEventListener('click', () => this.handleToggle('orientation', ['landscape', 'portrait']));
        this.colorBtn.addEventListener('click', () => this.handleToggle('colorMode', ['color', 'bw']));
        this.drumsBtn.addEventListener('click', () => this.handleToggle('includeDrums', [true, false]));

        store.on('printPreviewStateChanged', isActive => isActive ? this.show() : this.hide());
        store.on('printOptionsChanged', () => this.render());
        store.on('notesChanged', () => {
            if (store.state.isPrintPreviewActive) this.render();
        });
        
        new ResizeObserver(() => {
            if (store.state.isPrintPreviewActive) this.render();
        }).observe(this.canvasWrapper);
    },
    
    show() {
        store.state.isPrintPreviewActive = true;
        this.overlay.classList.remove('hidden');
        
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
        
        store.setPrintOptions({ ...store.state.printOptions, topRow, bottomRow });
    },

    hide() {
        store.state.isPrintPreviewActive = false;
        this.overlay.classList.add('hidden');
    },

    handleToggle(optionKey, values) {
        const currentVal = store.state.printOptions[optionKey];
        const nextVal = currentVal === values[0] ? values[1] : values[0];
        store.setPrintOptions({ [optionKey]: nextVal });
    },

    updateControls() {
        const { topRow, bottomRow, orientation, colorMode, includeDrums } = store.state.printOptions;
        
        this.topRowSlider.value = topRow;
        this.bottomRowSlider.value = bottomRow;
        
        this.topRowLabel.textContent = store.state.fullRowData[topRow]?.pitch || 'N/A';
        this.bottomRowLabel.textContent = store.state.fullRowData[bottomRow]?.pitch || 'N/A';

        this.orientationBtn.textContent = orientation.charAt(0).toUpperCase() + orientation.slice(1);
        this.colorBtn.textContent = colorMode === 'color' ? 'Color' : 'B&W';
        this.drumsBtn.textContent = includeDrums ? 'Yes' : 'No';
        
        this.drumsBtn.classList.toggle('active', includeDrums);
        this.colorBtn.classList.toggle('active', colorMode === 'color');
    },

    render() {
        if (!store.state.isPrintPreviewActive) return;
        this.updateControls();
        
        const wrapperWidth = this.canvasWrapper.clientWidth;
        const wrapperHeight = this.canvasWrapper.clientHeight;
        if (wrapperWidth === 0 || wrapperHeight === 0) return;

        const scoreCanvas = PrintService.generateScoreCanvas(store.state.printOptions, { 
            width: wrapperWidth, 
            height: wrapperHeight 
        });

        if (scoreCanvas) {
            this.canvas.width = scoreCanvas.width;
            this.canvas.height = scoreCanvas.height;
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(scoreCanvas, 0, 0);
        }
    }
};

export default PrintPreview;