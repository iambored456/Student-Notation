// js/components/UI/printPreview.ts
import store from '@state/index.ts';
import PrintService from '@services/printService.ts';
import type { PrintOptions } from '../../../types/state.js';

const CANVAS_FRAME_PADDING = 16;

interface CropState {
  pageWidth: number;
  pageHeight: number;
  contentTop: number;
  contentLeft: number;
  contentHeight: number;
  contentWidth: number;
  cropTopY: number;
  cropBottomY: number;
  cropLeftX: number;
  cropRightX: number;
}

type DragHandle = 'top' | 'bottom' | 'left' | 'right' | null;

type ToggleKeys = 'orientation' | 'colorMode' | 'includeLeftLegend' | 'includeRightLegend';
interface ToggleValueMap {
  orientation: PrintOptions['orientation'];
  colorMode: PrintOptions['colorMode'];
  includeLeftLegend: PrintOptions['includeLeftLegend'];
  includeRightLegend: PrintOptions['includeRightLegend'];
}

class PrintPreviewController {
  overlay: HTMLElement | null = null;
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  cropOverlay: HTMLCanvasElement | null = null;
  cropCtx: CanvasRenderingContext2D | null = null;
  canvasWrapper: HTMLElement | null = null;
  orientationBtn: HTMLElement | null = null;
  colorBtn: HTMLElement | null = null;
  leftLegendBtn: HTMLElement | null = null;
  rightLegendBtn: HTMLElement | null = null;
  isDragging = false;
  dragHandle: DragHandle = null;
  handleSize = 20;
  handlePadding = 5;
  cropState: CropState | null = null;

  init(): void {
    this.overlay = document.getElementById('print-preview-overlay');
    this.canvas = document.getElementById('print-preview-canvas') as HTMLCanvasElement | null;
    this.ctx = this.canvas?.getContext('2d') ?? null;
    this.cropOverlay = document.getElementById('print-crop-overlay') as HTMLCanvasElement | null;
    this.cropCtx = this.cropOverlay?.getContext('2d') ?? null;
    this.canvasWrapper = (this.canvas?.parentElement as HTMLElement | null) ?? null;

    this.orientationBtn = document.getElementById('print-orientation-toggle');
    this.colorBtn = document.getElementById('print-color-mode-toggle');
    this.leftLegendBtn = document.getElementById('print-left-legend-toggle');
    this.rightLegendBtn = document.getElementById('print-right-legend-toggle');

    document.getElementById('print-close-button')?.addEventListener('click', () => this.hide());
    document.getElementById('print-confirm-button')?.addEventListener('click', () => {
      void PrintService.generateAndPrint();
      this.hide();
    });

    this.orientationBtn?.addEventListener('click', () => this.handleToggle('orientation', ['landscape', 'portrait']));
    this.colorBtn?.addEventListener('click', () => this.handleToggle('colorMode', ['color', 'bw']));
    this.leftLegendBtn?.addEventListener('click', () => this.handleToggle('includeLeftLegend', [true, false]));
    this.rightLegendBtn?.addEventListener('click', () => this.handleToggle('includeRightLegend', [true, false]));

    this.cropOverlay?.addEventListener('mousedown', (e) => this.onCropMouseDown(e));
    this.cropOverlay?.addEventListener('mousemove', (e) => this.onCropMouseMove(e));
    this.cropOverlay?.addEventListener('mouseup', () => this.onCropMouseUp());
    this.cropOverlay?.addEventListener('mouseleave', () => this.onCropMouseUp());

    store.on('printPreviewStateChanged', (isActive: boolean) => {
      if (isActive) {
        this.show();
      } else {
        this.hide();
      }
    });
    store.on('printOptionsChanged', () => {
      void this.render();
    });
    store.on('notesChanged', () => {
      if (store.state.isPrintPreviewActive) {
        void this.render();
      }
    });

    if (this.canvasWrapper) {
      const observer = new ResizeObserver(() => {
        if (store.state.isPrintPreviewActive) {
          void this.render();
        }
      });
      observer.observe(this.canvasWrapper);
    }
  }

  show(): void {
    if (!store.state.isPrintPreviewActive) {
      store.setPrintPreviewActive(true);
    }
    this.overlay?.classList.remove('hidden');
    store.setPrintOptions({
      cropTop: 0,
      cropBottom: 1,
      cropLeft: 0,
      cropRight: 1,
      includeButtonGrid: true,
      includeDrums: true,
      includeLeftLegend: true,
      includeRightLegend: true
    });
    void PrintService.prefetchButtonGridSnapshot(true, true);
    void this.render();
  }

  hide(): void {
    if (store.state.isPrintPreviewActive) {
      store.setPrintPreviewActive(false);
    }
    this.overlay?.classList.add('hidden');
  }

  handleToggle<K extends ToggleKeys>(optionKey: K, values: [ToggleValueMap[K], ToggleValueMap[K]]): void {
    const currentVal = store.state.printOptions[optionKey];
    const nextVal = currentVal === values[0] ? values[1] : values[0];
    store.setPrintOptions({ [optionKey]: nextVal } as Partial<PrintOptions>);
  }

  updateControls(): void {
    const buttons = [this.orientationBtn, this.colorBtn, this.leftLegendBtn, this.rightLegendBtn];
    if (buttons.some(btn => btn === null)) {return;}

    const { orientation, colorMode, includeLeftLegend, includeRightLegend } = store.state.printOptions;

    if (this.orientationBtn) {
      this.orientationBtn.textContent = orientation.charAt(0).toUpperCase() + orientation.slice(1);
    }
    if (this.colorBtn) {
      this.colorBtn.textContent = colorMode === 'color' ? 'Color' : 'B&W';
      this.colorBtn.classList.toggle('active', colorMode === 'color');
    }
    if (this.leftLegendBtn) {
      this.leftLegendBtn.textContent = includeLeftLegend ? 'Include' : 'Exclude';
      this.leftLegendBtn.classList.toggle('active', includeLeftLegend);
    }
    if (this.rightLegendBtn) {
      this.rightLegendBtn.textContent = includeRightLegend ? 'Include' : 'Exclude';
      this.rightLegendBtn.classList.toggle('active', includeRightLegend);
    }
  }

  async render(): Promise<void> {
    if (!store.state.isPrintPreviewActive) {return;}
    if (!this.canvas || !this.ctx) {return;}

    this.updateControls();

    const wrapperWidth = this.canvasWrapper?.clientWidth ?? 0;
    const wrapperHeight = this.canvasWrapper?.clientHeight ?? 0;
    if (wrapperWidth === 0 || wrapperHeight === 0) {return;}

    const orientation = store.state.printOptions.orientation;
    const pageWidthInches = orientation === 'landscape' ? 10.5 : 8;
    const pageHeightInches = orientation === 'landscape' ? 8 : 10.5;
    const marginInches = 0.25;

    const pageAspectRatio = pageWidthInches / pageHeightInches;
    const framePadding = CANVAS_FRAME_PADDING * 2;

    let pageDisplayWidth = Math.max(wrapperWidth - framePadding, 100);
    let pageDisplayHeight = Math.max(wrapperHeight - framePadding, 100);

    if (pageDisplayWidth / pageDisplayHeight > pageAspectRatio) {
      pageDisplayWidth = pageDisplayHeight * pageAspectRatio;
    } else {
      pageDisplayHeight = pageDisplayWidth / pageAspectRatio;
    }

    const marginDisplaySize = (marginInches / pageWidthInches) * pageDisplayWidth;
    const printableDisplayWidth = pageDisplayWidth - (2 * marginDisplaySize);
    const printableDisplayHeight = pageDisplayHeight - (2 * marginDisplaySize);

    const fullPrintOptions: PrintOptions = {
      ...store.state.printOptions,
      includeButtonGrid: true,
      includeDrums: true,
      includeLeftLegend: store.state.printOptions.includeLeftLegend,
      includeRightLegend: store.state.printOptions.includeRightLegend,
      cropTop: 0,
      cropBottom: 1,
      cropLeft: 0,
      cropRight: 1
    };

    const scoreCanvas = await PrintService.generateScoreCanvas(fullPrintOptions, {
      width: printableDisplayWidth,
      height: printableDisplayHeight
    });

    if (!scoreCanvas) {return;}

    this.canvas.width = pageDisplayWidth;
    this.canvas.height = pageDisplayHeight;

    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, pageDisplayWidth, pageDisplayHeight);

    this.ctx.strokeStyle = '#E0E0E0';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(marginDisplaySize, marginDisplaySize, printableDisplayWidth, printableDisplayHeight);

    this.ctx.drawImage(scoreCanvas, marginDisplaySize, marginDisplaySize);
    this.drawCornerMarks(marginDisplaySize, printableDisplayWidth, printableDisplayHeight);
    this.renderCropOverlay(pageDisplayWidth, pageDisplayHeight, marginDisplaySize, printableDisplayHeight);
  }

  private drawCornerMarks(marginDisplaySize: number, printableDisplayWidth: number, printableDisplayHeight: number): void {
    if (!this.ctx) {return;}
    this.ctx.strokeStyle = '#CCCCCC';
    this.ctx.lineWidth = 1;
    const markLength = 10;
    const rightX = marginDisplaySize + printableDisplayWidth;
    const bottomY = marginDisplaySize + printableDisplayHeight;

    this.ctx.beginPath();
    this.ctx.moveTo(marginDisplaySize, marginDisplaySize - markLength);
    this.ctx.lineTo(marginDisplaySize, marginDisplaySize + markLength);
    this.ctx.moveTo(marginDisplaySize - markLength, marginDisplaySize);
    this.ctx.lineTo(marginDisplaySize + markLength, marginDisplaySize);

    this.ctx.moveTo(rightX, marginDisplaySize - markLength);
    this.ctx.lineTo(rightX, marginDisplaySize + markLength);
    this.ctx.moveTo(rightX - markLength, marginDisplaySize);
    this.ctx.lineTo(rightX + markLength, marginDisplaySize);

    this.ctx.moveTo(marginDisplaySize, bottomY - markLength);
    this.ctx.lineTo(marginDisplaySize, bottomY + markLength);
    this.ctx.moveTo(marginDisplaySize - markLength, bottomY);
    this.ctx.lineTo(marginDisplaySize + markLength, bottomY);

    this.ctx.moveTo(rightX, bottomY - markLength);
    this.ctx.lineTo(rightX, bottomY + markLength);
    this.ctx.moveTo(rightX - markLength, bottomY);
    this.ctx.lineTo(rightX + markLength, bottomY);
    this.ctx.stroke();
  }

  private renderCropOverlay(pageWidth: number, pageHeight: number, marginSize: number, printableHeight: number): void {
    const canvasRect = this.canvas?.getBoundingClientRect();
    const wrapperRect = this.canvasWrapper?.getBoundingClientRect();

    if (!canvasRect || !wrapperRect || !this.cropOverlay || !this.cropCtx) {return;}

    this.cropOverlay.width = pageWidth;
    this.cropOverlay.height = pageHeight;
    this.cropOverlay.style.left = `${canvasRect.left - wrapperRect.left}px`;
    this.cropOverlay.style.top = `${canvasRect.top - wrapperRect.top}px`;
    this.cropOverlay.style.width = `${pageWidth}px`;
    this.cropOverlay.style.height = `${pageHeight}px`;

    const { cropTop, cropBottom, cropLeft, cropRight } = store.state.printOptions;

    const contentTop = marginSize;
    const contentLeft = marginSize;
    const printableWidth = pageWidth - (2 * marginSize);
    const contentHeight = printableHeight;
    const contentWidth = printableWidth;

    const cropTopY = contentTop + (cropTop * contentHeight);
    const cropBottomY = contentTop + (cropBottom * contentHeight);
    const cropLeftX = contentLeft + (cropLeft * contentWidth);
    const cropRightX = contentLeft + (cropRight * contentWidth);

    this.cropCtx.clearRect(0, 0, pageWidth, pageHeight);
    this.cropCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';

    if (cropTop > 0) {
      this.cropCtx.fillRect(0, 0, pageWidth, cropTopY);
    }

    if (cropBottom < 1) {
      this.cropCtx.fillRect(0, cropBottomY, pageWidth, pageHeight - cropBottomY);
    }

    if (cropLeft > 0) {
      this.cropCtx.fillRect(0, cropTopY, cropLeftX, cropBottomY - cropTopY);
    }

    if (cropRight < 1) {
      this.cropCtx.fillRect(cropRightX, cropTopY, pageWidth - cropRightX, cropBottomY - cropTopY);
    }

    this.drawVerticalHandle(cropTopY, pageWidth, 'top');
    this.drawVerticalHandle(cropBottomY, pageWidth, 'bottom');
    this.drawHorizontalHandle(cropLeftX, pageHeight, 'left');
    this.drawHorizontalHandle(cropRightX, pageHeight, 'right');

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
  }

  private drawVerticalHandle(y: number, width: number, _handle: Exclude<DragHandle, 'left' | 'right' | null>): void {
    if (!this.cropCtx) {return;}
    const handleWidth = 60;
    const handleX = (width - handleWidth) / 2;

    this.cropCtx.fillStyle = '#4a90e2';
    this.cropCtx.fillRect(0, y - 1, width, 2);
    this.cropCtx.fillRect(handleX, y - this.handleSize / 2, handleWidth, this.handleSize);

    this.cropCtx.strokeStyle = '#FFFFFF';
    this.cropCtx.lineWidth = 2;
    this.cropCtx.strokeRect(handleX, y - this.handleSize / 2, handleWidth, this.handleSize);

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
  }

  private drawHorizontalHandle(x: number, height: number, _handle: Exclude<DragHandle, 'top' | 'bottom' | null>): void {
    if (!this.cropCtx) {return;}
    const handleHeight = 60;
    const handleY = (height - handleHeight) / 2;

    this.cropCtx.fillStyle = '#4a90e2';
    this.cropCtx.fillRect(x - 1, 0, 2, height);
    this.cropCtx.fillRect(x - this.handleSize / 2, handleY, this.handleSize, handleHeight);

    this.cropCtx.strokeStyle = '#FFFFFF';
    this.cropCtx.lineWidth = 2;
    this.cropCtx.strokeRect(x - this.handleSize / 2, handleY, this.handleSize, handleHeight);

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
  }

  private onCropMouseDown(event: MouseEvent): void {
    if (!this.cropState || !this.cropOverlay) {return;}
    const rect = this.cropOverlay.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const nearTop = Math.abs(y - this.cropState.cropTopY) < this.handleSize + this.handlePadding;
    const nearBottom = Math.abs(y - this.cropState.cropBottomY) < this.handleSize + this.handlePadding;
    const nearLeft = Math.abs(x - this.cropState.cropLeftX) < this.handleSize + this.handlePadding;
    const nearRight = Math.abs(x - this.cropState.cropRightX) < this.handleSize + this.handlePadding;

    if (nearTop) {
      this.isDragging = true;
      this.dragHandle = 'top';
      this.cropOverlay.style.cursor = 'ns-resize';
    } else if (nearBottom) {
      this.isDragging = true;
      this.dragHandle = 'bottom';
      this.cropOverlay.style.cursor = 'ns-resize';
    } else if (nearLeft) {
      this.isDragging = true;
      this.dragHandle = 'left';
      this.cropOverlay.style.cursor = 'ew-resize';
    } else if (nearRight) {
      this.isDragging = true;
      this.dragHandle = 'right';
      this.cropOverlay.style.cursor = 'ew-resize';
    }
  }

  private onCropMouseMove(event: MouseEvent): void {
    if (!this.cropState || !this.cropOverlay) {return;}
    const rect = this.cropOverlay.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (this.isDragging && this.dragHandle) {
      this.handleCropDrag(x, y);
      return;
    }

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

  private handleCropDrag(x: number, y: number): void {
    if (!this.cropState) {return;}
    const { contentTop, contentLeft, contentHeight, contentWidth } = this.cropState;
    const minRange = 0.05;

    if (this.dragHandle === 'top') {
      const normalized = Math.max(0, Math.min(1, (y - contentTop) / contentHeight));
      const currentBottom = store.state.printOptions.cropBottom;
      if (normalized < currentBottom - minRange) {
        store.setPrintOptions({ cropTop: normalized });
      }
    } else if (this.dragHandle === 'bottom') {
      const normalized = Math.max(0, Math.min(1, (y - contentTop) / contentHeight));
      const currentTop = store.state.printOptions.cropTop;
      if (normalized > currentTop + minRange) {
        store.setPrintOptions({ cropBottom: normalized });
      }
    } else if (this.dragHandle === 'left') {
      const normalized = Math.max(0, Math.min(1, (x - contentLeft) / contentWidth));
      const currentRight = store.state.printOptions.cropRight;
      if (normalized < currentRight - minRange) {
        store.setPrintOptions({ cropLeft: normalized });
      }
    } else if (this.dragHandle === 'right') {
      const normalized = Math.max(0, Math.min(1, (x - contentLeft) / contentWidth));
      const currentLeft = store.state.printOptions.cropLeft;
      if (normalized > currentLeft + minRange) {
        store.setPrintOptions({ cropRight: normalized });
      }
    }
  }

  private onCropMouseUp(): void {
    this.isDragging = false;
    this.dragHandle = null;
    if (this.cropOverlay) {
      this.cropOverlay.style.cursor = 'default';
    }
  }
}

const PrintPreview = new PrintPreviewController();
export default PrintPreview;
