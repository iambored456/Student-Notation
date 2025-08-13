// js/components/PitchPaint/paintCanvas.js
import store from '../../state/index.js';
import { getInterpolatedColor } from '../../utils/chromaticColors.js';
// We need the renderer to use its calculation methods
import PaintPlayheadRenderer from './paintPlayheadRenderer.js';
import logger from '../../utils/logger.js';

class PaintCanvas {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.isInitialized = false;
    this.animationFrameId = null;
    this.lastHistoryLength = 0;
  }

  initialize() {
    this.canvas = document.getElementById('pitch-paint-canvas');
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
    
    store.on('micPaintStateChanged', (isActive) => {
        if (isActive) {
            this.startRendering();
        } else {
            this.stopRendering();
        }
    });

    this.resize();
    this.isInitialized = true;
  }
  
  startRendering() {
    if (this.animationFrameId) return;
    this.animationFrameId = requestAnimationFrame(() => this.animationLoop());
  }

  stopRendering() {
    if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
    }
  }

  animationLoop() {
    if (store.state.paint.paintHistory.length !== this.lastHistoryLength) {
        this.render();
        this.lastHistoryLength = store.state.paint.paintHistory.length;
    }
    this.animationFrameId = requestAnimationFrame(() => this.animationLoop());
  }


  resize() {
    if (!this.canvas) return;
    const wrapper = document.getElementById('pitch-canvas-wrapper');
    
    // DEFER to get final measurements after layout settles
    setTimeout(() => {
        const pitchGridContainer = document.getElementById('pitch-grid-container');
        const finalTargetHeight = pitchGridContainer ? pitchGridContainer.clientHeight : wrapper.clientHeight;
        
        // DEBUG: Log paint canvas height measurements
        logger.debug('PaintCanvas', 'Height Debug (DEFERRED)', {
            canvasId: 'pitch-paint-canvas',
            currentCanvasHeight: this.canvas.height,
            pitchGridContainer: pitchGridContainer?.clientHeight,
            pitchCanvasWrapper: wrapper?.clientHeight,
            finalTargetHeight,
            willResize: this.canvas.width !== wrapper.clientWidth || this.canvas.height !== finalTargetHeight
        }, 'paint');
        
        if (this.canvas.width !== wrapper.clientWidth || this.canvas.height !== finalTargetHeight) {
            logger.debug('PaintCanvas', `Setting pitch-paint-canvas height (DEFERRED): ${this.canvas.height} → ${finalTargetHeight}`, null, 'paint');
            this.canvas.width = wrapper.clientWidth;
            this.canvas.height = finalTargetHeight;
            this.render();
        }
    }, 30); // Slightly longer delay than layoutService
  }

  render() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    const paintHistory = store.state.paint.paintHistory;
    if (paintHistory.length === 0) return;

    this.renderPaintTrail(paintHistory);
  }

  renderPaintTrail(paintHistory) {
    if (paintHistory.length < 2) return;

    // THE BIG CHANGE STARTS HERE
    // 1. Create a new array of points with recalculated X and Y values
    const renderPoints = paintHistory.map(point => {
        const x = PaintPlayheadRenderer.calculateXFromTime(point.musicalTime);
        const y = PaintPlayheadRenderer.midiToY(point.midi);
        
        // Return null if the point is now off-screen or invalid
        if (x === null || y === null) return null;

        return {
            ...point, // keep original timestamp, thickness, color etc.
            x, // use the new, recalculated x
            y, // use the new, recalculated y
        };
    }).filter(p => p !== null); // Filter out any points that are no longer valid

    if (renderPoints.length < 2) return;

    // 2. Render using the newly calculated points
    const opacity = store.state.paint.paintSettings.opacity / 100;
    this.ctx.globalAlpha = opacity;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    for (let i = 1; i < renderPoints.length; i++) {
      const prevPoint = renderPoints[i - 1];
      const currentPoint = renderPoints[i];

      // Use original timestamp for continuity check
      if (currentPoint.timestamp - prevPoint.timestamp > 200) continue;
      
      this.drawPaintSegment(prevPoint, currentPoint);
    }
    this.ctx.globalAlpha = 1.0;
  }

  drawPaintSegment(point1, point2) {
    const gradient = this.ctx.createLinearGradient(point1.x, point1.y, point2.x, point2.y);
    gradient.addColorStop(0, `rgb(${point1.color.join(',')})`);
    gradient.addColorStop(1, `rgb(${point2.color.join(',')})`);

    this.ctx.strokeStyle = gradient;
    this.ctx.lineWidth = (point1.thickness + point2.thickness) / 2;
    
    this.ctx.beginPath();
    this.ctx.moveTo(point1.x, point1.y);
    this.ctx.lineTo(point2.x, point2.y);
    this.ctx.stroke();
  }

  // MODIFIED: This function now stores musicalTime instead of pixel coordinates
  addPaintPoint(musicalTime, midiValue) {
    const color = getInterpolatedColor(midiValue);
    const point = {
      musicalTime, // Store this instead of x
      midi: midiValue, // Store this instead of y
      color,
      timestamp: performance.now(),
      thickness: store.state.paint.paintSettings.thickness,
    };
    store.addPaintPoint(point);
  }

  clear() {
    store.clearPaintHistory();
  }
}

export default new PaintCanvas();