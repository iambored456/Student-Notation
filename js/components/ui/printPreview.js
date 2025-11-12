// js/components/UI/printPreview.js
import store from '@state/index.js';
import PrintService from '@services/printService.js';

const CANVAS_FRAME_PADDING = 16;

const PrintPreview = {
    init() {
        this.overlay = document.getElementById('print-preview-overlay');
        if (!this.overlay) return;

        this.canvas = document.getElementById('print-preview-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.cropOverlay = document.getElementById('print-crop-overlay');
        this.cropCtx = this.cropOverlay.getContext('2d');
        this.canvasWrapper = this.canvas.parentElement;

        this.orientationBtn = document.getElementById('print-orientation-toggle');
        this.colorBtn = document.getElementById('print-color-mode-toggle');
        this.drumsBtn = document.getElementById('print-drums-toggle');
        this.buttonsBtn = document.getElementById('print-buttons-toggle');

        // Crop interaction state
        this.isDragging = false;
        this.dragHandle = null; // 'top', 'bottom', 'left', or 'right'
        this.handleSize = 20;
        this.handlePadding = 5;

        document.getElementById('print-close-button').addEventListener('click', () => this.hide());
        document.getElementById('print-confirm-button').addEventListener('click', () => {
            PrintService.generateAndPrint();
            this.hide();
        });

        this.orientationBtn.addEventListener('click', () => this.handleToggle('orientation', ['landscape', 'portrait']));
        this.colorBtn.addEventListener('click', () => this.handleToggle('colorMode', ['color', 'bw']));
        this.drumsBtn.addEventListener('click', () => this.handleToggle('includeDrums', [true, false]));
        this.buttonsBtn.addEventListener('click', () => this.handleToggle('includeButtonGrid', [true, false]));

        // Crop overlay mouse events
        this.cropOverlay.addEventListener('mousedown', (e) => this.onCropMouseDown(e));
        this.cropOverlay.addEventListener('mousemove', (e) => this.onCropMouseMove(e));
        this.cropOverlay.addEventListener('mouseup', () => this.onCropMouseUp());
        this.cropOverlay.addEventListener('mouseleave', () => this.onCropMouseUp());

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
        if (!store.state.isPrintPreviewActive) {
            store.setPrintPreviewActive(true);
        }
        this.overlay.classList.remove('hidden');

        // Reset crop to full range when opening
        store.setPrintOptions({ cropTop: 0, cropBottom: 1.0, cropLeft: 0, cropRight: 1.0 });
        if (store.state.printOptions.includeButtonGrid) {
            PrintService.prefetchButtonGridSnapshot();
        }

        this.render();
    },

    hide() {
        if (store.state.isPrintPreviewActive) {
            store.setPrintPreviewActive(false);
        }
        this.overlay.classList.add('hidden');
    },

    handleToggle(optionKey, values) {
        const currentVal = store.state.printOptions[optionKey];
        const nextVal = currentVal === values[0] ? values[1] : values[0];
        store.setPrintOptions({ [optionKey]: nextVal });
        if (optionKey === 'includeButtonGrid' && nextVal === true) {
            PrintService.prefetchButtonGridSnapshot();
        }
    },

    updateControls() {
        const { orientation, colorMode, includeDrums, includeButtonGrid } = store.state.printOptions;

        this.orientationBtn.textContent = orientation.charAt(0).toUpperCase() + orientation.slice(1);
        this.colorBtn.textContent = colorMode === 'color' ? 'Color' : 'B&W';
        this.drumsBtn.textContent = includeDrums ? 'Include' : 'Exclude';
        this.buttonsBtn.textContent = includeButtonGrid ? 'Include' : 'Exclude';

        this.drumsBtn.classList.toggle('active', includeDrums);
        this.buttonsBtn.classList.toggle('active', includeButtonGrid);
        this.colorBtn.classList.toggle('active', colorMode === 'color');
    },

    async render() {
        if (!store.state.isPrintPreviewActive) return;
        this.updateControls();

        const wrapperWidth = this.canvasWrapper.clientWidth;
        const wrapperHeight = this.canvasWrapper.clientHeight;
        if (wrapperWidth === 0 || wrapperHeight === 0) return;

        const orientation = store.state.printOptions.orientation;

        // Page dimensions in inches
        const pageWidthInches = orientation === 'landscape' ? 10.5 : 8;
        const pageHeightInches = orientation === 'landscape' ? 8 : 10.5;
        const marginInches = 0.25;

        // Calculate printable area
        const pageAspectRatio = pageWidthInches / pageHeightInches;
        const framePadding = CANVAS_FRAME_PADDING * 2;

        // Fit page to wrapper while maintaining aspect ratio
        let pageDisplayWidth = Math.max(wrapperWidth - framePadding, 100);
        let pageDisplayHeight = Math.max(wrapperHeight - framePadding, 100);

        if (pageDisplayWidth / pageDisplayHeight > pageAspectRatio) {
            pageDisplayWidth = pageDisplayHeight * pageAspectRatio;
        } else {
            pageDisplayHeight = pageDisplayWidth / pageAspectRatio;
        }

        // Calculate margin size in display pixels
        const marginDisplaySize = (marginInches / pageWidthInches) * pageDisplayWidth;
        const printableDisplayWidth = pageDisplayWidth - (2 * marginDisplaySize);
        const printableDisplayHeight = pageDisplayHeight - (2 * marginDisplaySize);

        // Generate score canvas WITHOUT crop applied (full content)
        // We'll apply crop visually via the overlay only
        const fullPrintOptions = {
            ...store.state.printOptions,
            cropTop: 0,
            cropBottom: 1.0,
            cropLeft: 0,
            cropRight: 1.0
        };
        const scoreCanvas = await PrintService.generateScoreCanvas(fullPrintOptions, {
            width: printableDisplayWidth,
            height: printableDisplayHeight
        });

        if (scoreCanvas) {
            // Set canvas size to page size
            this.canvas.width = pageDisplayWidth;
            this.canvas.height = pageDisplayHeight;

            // Draw page background
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fillRect(0, 0, pageDisplayWidth, pageDisplayHeight);

            // Draw margin boundaries
            this.ctx.strokeStyle = '#E0E0E0';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(marginDisplaySize, marginDisplaySize, printableDisplayWidth, printableDisplayHeight);

            // Draw score content within margins
            this.ctx.drawImage(scoreCanvas, marginDisplaySize, marginDisplaySize);

            // Draw corner marks
            this.drawCornerMarks(marginDisplaySize, printableDisplayWidth, printableDisplayHeight);

            // Position and render crop overlay
            this.renderCropOverlay(pageDisplayWidth, pageDisplayHeight, marginDisplaySize, printableDisplayHeight);
        }
    },

    drawCornerMarks(marginDisplaySize, printableDisplayWidth, printableDisplayHeight) {
        this.ctx.strokeStyle = '#CCCCCC';
        this.ctx.lineWidth = 1;
        const markLength = 10;
        const rightX = marginDisplaySize + printableDisplayWidth;
        const bottomY = marginDisplaySize + printableDisplayHeight;

        this.ctx.beginPath();
        // Top-left
        this.ctx.moveTo(marginDisplaySize, marginDisplaySize - markLength);
        this.ctx.lineTo(marginDisplaySize, marginDisplaySize + markLength);
        this.ctx.moveTo(marginDisplaySize - markLength, marginDisplaySize);
        this.ctx.lineTo(marginDisplaySize + markLength, marginDisplaySize);
        // Top-right
        this.ctx.moveTo(rightX, marginDisplaySize - markLength);
        this.ctx.lineTo(rightX, marginDisplaySize + markLength);
        this.ctx.moveTo(rightX - markLength, marginDisplaySize);
        this.ctx.lineTo(rightX + markLength, marginDisplaySize);
        // Bottom-left
        this.ctx.moveTo(marginDisplaySize, bottomY - markLength);
        this.ctx.lineTo(marginDisplaySize, bottomY + markLength);
        this.ctx.moveTo(marginDisplaySize - markLength, bottomY);
        this.ctx.lineTo(marginDisplaySize + markLength, bottomY);
        // Bottom-right
        this.ctx.moveTo(rightX, bottomY - markLength);
        this.ctx.lineTo(rightX, bottomY + markLength);
        this.ctx.moveTo(rightX - markLength, bottomY);
        this.ctx.lineTo(rightX + markLength, bottomY);
        this.ctx.stroke();
    },

    renderCropOverlay(pageWidth, pageHeight, marginSize, printableHeight) {
        // Position overlay to match main canvas
        const canvasRect = this.canvas.getBoundingClientRect();
        const wrapperRect = this.canvasWrapper.getBoundingClientRect();

        this.cropOverlay.width = pageWidth;
        this.cropOverlay.height = pageHeight;
        this.cropOverlay.style.left = `${canvasRect.left - wrapperRect.left}px`;
        this.cropOverlay.style.top = `${canvasRect.top - wrapperRect.top}px`;
        this.cropOverlay.style.width = `${pageWidth}px`;
        this.cropOverlay.style.height = `${pageHeight}px`;

        const { cropTop, cropBottom, cropLeft, cropRight } = store.state.printOptions;

        // Calculate content area (within margins)
        const contentTop = marginSize;
        const contentLeft = marginSize;
        const printableWidth = pageWidth - (2 * marginSize);
        const contentHeight = printableHeight;
        const contentWidth = printableWidth;

        // Calculate crop positions in canvas coordinates
        const cropTopY = contentTop + (cropTop * contentHeight);
        const cropBottomY = contentTop + (cropBottom * contentHeight);
        const cropLeftX = contentLeft + (cropLeft * contentWidth);
        const cropRightX = contentLeft + (cropRight * contentWidth);

        // Draw gray-out areas without stacking overlaps
        this.cropCtx.clearRect(0, 0, pageWidth, pageHeight);
        this.cropCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';

        // Top gray-out (full width, including top margin)
        if (cropTop > 0) {
            this.cropCtx.fillRect(0, 0, pageWidth, cropTopY);
        }

        // Bottom gray-out (full width, including bottom margin)
        if (cropBottom < 1.0) {
            this.cropCtx.fillRect(0, cropBottomY, pageWidth, pageHeight - cropBottomY);
        }

        // Left gray-out (only in the vertical crop region to avoid stacking, including left margin)
        if (cropLeft > 0) {
            this.cropCtx.fillRect(0, cropTopY, cropLeftX, cropBottomY - cropTopY);
        }

        // Right gray-out (only in the vertical crop region to avoid stacking, including right margin)
        if (cropRight < 1.0) {
            this.cropCtx.fillRect(cropRightX, cropTopY, pageWidth - cropRightX, cropBottomY - cropTopY);
        }

        // Draw crop handles
        this.drawVerticalHandle(cropTopY, pageWidth, 'top');
        this.drawVerticalHandle(cropBottomY, pageWidth, 'bottom');
        this.drawHorizontalHandle(cropLeftX, pageHeight, 'left');
        this.drawHorizontalHandle(cropRightX, pageHeight, 'right');

        // Store for hit detection
        this.cropState = {
            pageWidth,
            pageHeight,
            contentTop,
            contentLeft,
            contentHeight,
            contentWidth,
            cropTopY,
            cropBottomY,
            cropLeftX,
            cropRightX
        };
    },

    drawVerticalHandle(y, width, type) {
        const handleWidth = 60;
        const handleX = (width - handleWidth) / 2;

        // Draw line across full width to eliminate gaps
        this.cropCtx.fillStyle = '#4a90e2';
        this.cropCtx.fillRect(0, y - 1, width, 2);

        // Handle background
        this.cropCtx.fillStyle = '#4a90e2';
        this.cropCtx.fillRect(handleX, y - this.handleSize / 2, handleWidth, this.handleSize);

        // Handle border
        this.cropCtx.strokeStyle = '#FFFFFF';
        this.cropCtx.lineWidth = 2;
        this.cropCtx.strokeRect(handleX, y - this.handleSize / 2, handleWidth, this.handleSize);

        // Handle grip lines
        this.cropCtx.strokeStyle = '#FFFFFF';
        this.cropCtx.lineWidth = 1;
        const gripCount = 3;
        const gripSpacing = 6;
        const gripLength = 30;
        const gripStartX = (width - gripLength) / 2;

        for (let i = 0; i < gripCount; i++) {
            const gripY = y + (i - 1) * gripSpacing;
            this.cropCtx.beginPath();
            this.cropCtx.moveTo(gripStartX, gripY);
            this.cropCtx.lineTo(gripStartX + gripLength, gripY);
            this.cropCtx.stroke();
        }

    },

    drawHorizontalHandle(x, height, type) {
        const handleHeight = 60;
        const handleY = (height - handleHeight) / 2;

        // Draw line across full height to eliminate gaps
        this.cropCtx.fillStyle = '#4a90e2';
        this.cropCtx.fillRect(x - 1, 0, 2, height);

        // Handle background
        this.cropCtx.fillStyle = '#4a90e2';
        this.cropCtx.fillRect(x - this.handleSize / 2, handleY, this.handleSize, handleHeight);

        // Handle border
        this.cropCtx.strokeStyle = '#FFFFFF';
        this.cropCtx.lineWidth = 2;
        this.cropCtx.strokeRect(x - this.handleSize / 2, handleY, this.handleSize, handleHeight);

        // Handle grip lines
        this.cropCtx.strokeStyle = '#FFFFFF';
        this.cropCtx.lineWidth = 1;
        const gripCount = 3;
        const gripSpacing = 6;
        const gripLength = 30;
        const gripStartY = (height - gripLength) / 2;

        for (let i = 0; i < gripCount; i++) {
            const gripX = x + (i - 1) * gripSpacing;
            this.cropCtx.beginPath();
            this.cropCtx.moveTo(gripX, gripStartY);
            this.cropCtx.lineTo(gripX, gripStartY + gripLength);
            this.cropCtx.stroke();
        }

    },

    onCropMouseDown(e) {
        if (!this.cropState) return;

        const rect = this.cropOverlay.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicking on top handle
        if (Math.abs(y - this.cropState.cropTopY) < this.handleSize + this.handlePadding) {
            this.isDragging = true;
            this.dragHandle = 'top';
            this.cropOverlay.style.cursor = 'ns-resize';
            return;
        }

        // Check if clicking on bottom handle
        if (Math.abs(y - this.cropState.cropBottomY) < this.handleSize + this.handlePadding) {
            this.isDragging = true;
            this.dragHandle = 'bottom';
            this.cropOverlay.style.cursor = 'ns-resize';
            return;
        }

        // Check if clicking on left handle
        if (Math.abs(x - this.cropState.cropLeftX) < this.handleSize + this.handlePadding) {
            this.isDragging = true;
            this.dragHandle = 'left';
            this.cropOverlay.style.cursor = 'ew-resize';
            return;
        }

        // Check if clicking on right handle
        if (Math.abs(x - this.cropState.cropRightX) < this.handleSize + this.handlePadding) {
            this.isDragging = true;
            this.dragHandle = 'right';
            this.cropOverlay.style.cursor = 'ew-resize';
            return;
        }
    },

    onCropMouseMove(e) {
        if (!this.cropState) return;

        const rect = this.cropOverlay.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.isDragging && this.dragHandle) {
            if (this.dragHandle === 'top' || this.dragHandle === 'bottom') {
                // Calculate normalized vertical position
                const contentY = y - this.cropState.contentTop;
                const normalized = Math.max(0, Math.min(1, contentY / this.cropState.contentHeight));

                if (this.dragHandle === 'top') {
                    const currentBottom = store.state.printOptions.cropBottom;
                    if (normalized < currentBottom - 0.05) { // Minimum 5% crop region
                        store.setPrintOptions({ cropTop: normalized });
                    }
                } else if (this.dragHandle === 'bottom') {
                    const currentTop = store.state.printOptions.cropTop;
                    if (normalized > currentTop + 0.05) { // Minimum 5% crop region
                        store.setPrintOptions({ cropBottom: normalized });
                    }
                }
            } else if (this.dragHandle === 'left' || this.dragHandle === 'right') {
                // Calculate normalized horizontal position
                const contentX = x - this.cropState.contentLeft;
                const normalized = Math.max(0, Math.min(1, contentX / this.cropState.contentWidth));

                if (this.dragHandle === 'left') {
                    const currentRight = store.state.printOptions.cropRight;
                    if (normalized < currentRight - 0.05) { // Minimum 5% crop region
                        store.setPrintOptions({ cropLeft: normalized });
                    }
                } else if (this.dragHandle === 'right') {
                    const currentLeft = store.state.printOptions.cropLeft;
                    if (normalized > currentLeft + 0.05) { // Minimum 5% crop region
                        store.setPrintOptions({ cropRight: normalized });
                    }
                }
            }
        } else {
            // Update cursor based on hover
            const isNearTop = Math.abs(y - this.cropState.cropTopY) < this.handleSize + this.handlePadding;
            const isNearBottom = Math.abs(y - this.cropState.cropBottomY) < this.handleSize + this.handlePadding;
            const isNearLeft = Math.abs(x - this.cropState.cropLeftX) < this.handleSize + this.handlePadding;
            const isNearRight = Math.abs(x - this.cropState.cropRightX) < this.handleSize + this.handlePadding;

            if (isNearTop || isNearBottom) {
                this.cropOverlay.style.cursor = 'ns-resize';
            } else if (isNearLeft || isNearRight) {
                this.cropOverlay.style.cursor = 'ew-resize';
            } else {
                this.cropOverlay.style.cursor = 'default';
            }
        }
    },

    onCropMouseUp() {
        this.isDragging = false;
        this.dragHandle = null;
        this.cropOverlay.style.cursor = 'default';
    }
};

export default PrintPreview;
