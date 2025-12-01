// js/components/PitchPaint/paintCanvas.ts
import store from '@state/index.ts';
import { getPaintColor } from '@utils/chromaticColors.ts';
// We need the renderer to use its calculation methods
import PaintPlayheadRenderer from './paintPlayheadRenderer.js';
import logger from '@utils/logger.ts';
import { getLogicalCanvasWidth, getLogicalCanvasHeight } from '@utils/canvasDimensions.ts';
import type { PaintPoint } from '../../../types/state.js';

interface RenderPoint extends PaintPoint {
  x: number;
  y: number;
}

class PaintCanvas {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isInitialized = false;
  private animationFrameId: number | null = null;
  private lastHistoryLength = 0;

  initialize(): void {
    this.canvas = document.getElementById('pitch-paint-canvas') as HTMLCanvasElement | null;
    if (!this.canvas) {
      logger.error('PaintCanvas', 'Could not find #pitch-paint-canvas element', null, 'paint');
      return;
    }
    this.ctx = this.canvas.getContext('2d');

    const wrapper = document.getElementById('pitch-canvas-wrapper');
    if (!wrapper) {
      logger.error('PaintCanvas', 'Could not find #pitch-canvas-wrapper element', null, 'paint');
      return;
    }

    store.on('paintHistoryChanged', () => this.render());
    store.on('layoutConfigChanged', () => this.resize());

    store.on('micPaintStateChanged', (data: unknown) => {
      const isActive = data as boolean;
      if (isActive) {
        this.startRendering();
      } else {
        this.stopRendering();
      }
    });

    this.resize();
    this.isInitialized = true;
  }

  startRendering(): void {
    if (this.animationFrameId) {return;}
    this.animationFrameId = requestAnimationFrame(() => this.animationLoop());
  }

  stopRendering(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  animationLoop(): void {
    if (store.state.paint.paintHistory.length !== this.lastHistoryLength) {
      this.render();
      this.lastHistoryLength = store.state.paint.paintHistory.length;
    }
    this.animationFrameId = requestAnimationFrame(() => this.animationLoop());
  }


  resize(): void {
    if (!this.canvas) {return;}
    // LayoutService now drives the backing-store sizing; just re-render.
    this.render();
  }

  render(): void {
    if (!this.ctx || !this.canvas) {return;}
    this.ctx.clearRect(0, 0, getLogicalCanvasWidth(this.canvas), getLogicalCanvasHeight(this.canvas));

    const paintHistory = store.state.paint.paintHistory;

    if (paintHistory.length === 0) {return;}

    this.renderPaintTrail(paintHistory);
  }

  renderPaintTrail(paintHistory: PaintPoint[]): void {
    if (paintHistory.length < 2) {return;}

    // THE BIG CHANGE STARTS HERE
    // 1. Create a new array of points with recalculated X and Y values
    const renderPoints = paintHistory.map(point => {
      const x = (PaintPlayheadRenderer as any).calculateXFromTime(point.musicalTime);
      const y = (PaintPlayheadRenderer as any).midiToY(point.midi);

      // Return null if the point is now off-screen or invalid
      if (x === null || y === null) {return null;}

      return {
        ...point, // keep original timestamp, thickness, color etc.
        x, // use the new, recalculated x
        y // use the new, recalculated y
      };
    }).filter((p): p is RenderPoint => p !== null); // Filter out any points that are no longer valid

    if (renderPoints.length < 2) {return;}

    // 2. Render using the newly calculated points
    const opacity = store.state.paint.paintSettings.opacity / 100;
    this.ctx!.globalAlpha = opacity;
    this.ctx!.lineCap = 'round';
    this.ctx!.lineJoin = 'round';

    for (let i = 1; i < renderPoints.length; i++) {
      const prevPoint = renderPoints[i - 1];
      const currentPoint = renderPoints[i];
      if (!prevPoint || !currentPoint) {
        continue;
      }

      // Use original timestamp for continuity check
      if (currentPoint.timestamp - prevPoint.timestamp > 200) {continue;}

      this.drawPaintSegment(prevPoint, currentPoint);
    }
    this.ctx!.globalAlpha = 1.0;
  }

  drawPaintSegment(point1: RenderPoint, point2: RenderPoint): void {
    const gradient = this.ctx!.createLinearGradient(point1.x, point1.y, point2.x, point2.y);
    gradient.addColorStop(0, `rgb(${point1.color.join(',')})`);
    gradient.addColorStop(1, `rgb(${point2.color.join(',')})`);

    this.ctx!.strokeStyle = gradient;
    this.ctx!.lineWidth = (point1.thickness + point2.thickness) / 2;

    this.ctx!.beginPath();
    this.ctx!.moveTo(point1.x, point1.y);
    this.ctx!.lineTo(point2.x, point2.y);
    this.ctx!.stroke();
  }

  // MODIFIED: This function now stores musicalTime instead of pixel coordinates
  addPaintPoint(musicalTime: number, midiValue: number): void {
    const { colorMode } = store.state.paint.paintSettings;
    const selectedNoteColor = store.state.selectedNote?.color;
    const color = getPaintColor(midiValue, colorMode, selectedNoteColor);

    const point: PaintPoint = {
      musicalTime, // Store this instead of x
      midi: midiValue, // Store this instead of y
      color,
      timestamp: performance.now(),
      thickness: store.state.paint.paintSettings.thickness
    };
    store.addPaintPoint(point);
  }

  clear(): void {
    store.clearPaintHistory();
  }
}

export default new PaintCanvas();
