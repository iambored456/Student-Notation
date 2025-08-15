// js/components/PitchPaint/paintPlayheadRenderer.js
import store from '../../state/index.js';
import LayoutService from '../../services/layoutService.js';
import GridCoordsService from '../../services/gridCoordsService.js';
import { getPitchColor } from '../../utils/chromaticColors.js';
import PaintCanvas from './paintCanvas.js';
import * as Tone from 'tone';
import { Note } from 'tonal';

class PaintPlayheadRenderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animationFrameId = null;
    this.timeMap = [];
    this._lastTempo = 0;
  }

  initialize() {
    this.canvas = document.getElementById('playhead-canvas');
    if (!this.canvas) {
        return;
    }
    this.ctx = this.canvas.getContext('2d');

    store.on('micPaintStateChanged', (isActive) => this.handlePaintStateChange(isActive));
    store.on('pitchDetected', (pitchData) => this.handlePitchDetection(pitchData));
    store.on('playbackStateChanged', () => {
        if (store.state.paint.isMicPaintActive) {
        }
    });

  }

  handlePaintStateChange(isActive) {
    const hoverCanvas = document.getElementById('hover-canvas');
    if (hoverCanvas) hoverCanvas.style.display = isActive ? 'none' : 'block';

    if (isActive) {
      this.startRendering();
    } else {
      this.stopRendering();
    }
  }

  handlePitchDetection(pitchData) {
    if (!store.state.paint.isMicPaintActive || !store.state.isPlaying || store.state.isPaused) return;
    this.addPaintAtPlayhead(pitchData);
  }

  startRendering() {
    if (this.animationFrameId) return;
    this.render();
  }

  stopRendering() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  render() {
    if (!store.state.paint.isMicPaintActive || !this.ctx) {
      this.animationFrameId = null;
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (store.state.isPlaying && !store.state.isPaused) {
      this.renderMovingPlayhead();
    } else {
      this.renderStationaryPlayhead();
    }

    this.animationFrameId = requestAnimationFrame(() => this.render());
  }

  renderStationaryPlayhead() {
    const startX = LayoutService.getColumnX(2);
    const { detectedPitch } = store.state.paint;
    const y = this.midiToY(detectedPitch.midi);
    const hasValidPitch = y !== null;

    if (hasValidPitch) {
      const color = getPitchColor(detectedPitch.midi);
      const radius = 10 + (detectedPitch.clarity * 10);
      
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = detectedPitch.clarity;
      this.ctx.beginPath();
      this.ctx.arc(startX, y, radius, 0, 2 * Math.PI);
      this.ctx.fill();
      this.ctx.globalAlpha = 1.0;

      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    } else {
      // UPDATED: Draw the stationary playhead in the center of the current viewport
      const viewportInfo = LayoutService.getViewportInfo();
      const centerY = viewportInfo.viewportHeight / 2;

      this.ctx.strokeStyle = 'rgba(74, 144, 226, 0.8)';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([4, 4]);
      this.ctx.beginPath();
      this.ctx.arc(startX, centerY, 10, 0, 2 * Math.PI);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  renderMovingPlayhead() {
    const xPos = this.calculateXFromTime(Tone.Transport.seconds);
    if (xPos === null) return;

    // UPDATED: Draw playhead line across the full canvas height
    this.ctx.strokeStyle = '#FF6B35';
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = '#FF6B35';
    this.ctx.shadowBlur = 6;
    this.ctx.beginPath();
    this.ctx.moveTo(xPos, 0);
    this.ctx.lineTo(xPos, this.canvas.height);
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    const { detectedPitch } = store.state.paint;
    const y = this.midiToY(detectedPitch.midi);
    if (y !== null) {
        const color = getPitchColor(detectedPitch.midi);
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(xPos, y, 7, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.stroke();
    }
  }

  addPaintAtPlayhead(pitchData) {
    if (pitchData.midi === 0) return;
    const musicalTime = Tone.Transport.seconds;
    PaintCanvas.addPaintPoint(musicalTime, pitchData.midi);
  }

  buildTimeMap() {
    this.timeMap = [];
    let currentTime = 0;
    const microbeatDuration = 30 / store.state.tempo;
    
    for (let i = 0; i < store.state.columnWidths.length; i++) {
        this.timeMap[i] = currentTime;
        currentTime += store.state.columnWidths[i] * microbeatDuration;
    }
    this.timeMap.push(currentTime);
  }

  calculateXFromTime(currentTime) {
    if (store.state.tempo !== this._lastTempo) {
        this.buildTimeMap();
        this._lastTempo = store.state.tempo;
    }

    for (let i = 0; i < this.timeMap.length - 1; i++) {
      if (currentTime >= this.timeMap[i] && currentTime < this.timeMap[i + 1]) {
        const colStartTime = this.timeMap[i];
        const colDuration = this.timeMap[i + 1] - colStartTime;
        const timeIntoCol = currentTime - colStartTime;
        
        const colStartX = LayoutService.getColumnX(i);
        const colWidth = LayoutService.getColumnX(i + 1) - colStartX;
        
        return colStartX + (colDuration > 0 ? (timeIntoCol / colDuration) * colWidth : 0);
      }
    }
    return null;
  }
  
  /**
   * UPDATED: Convert MIDI to absolute canvas Y coordinate (not viewport-relative)
   * The transform system will handle the viewport positioning
   */
  midiToY(midiValue) {
    if (midiValue === 0) return null;

    const { fullRowData, cellHeight } = store.state;
    if (!fullRowData || fullRowData.length === 0 || cellHeight === 0) return null;

    // Find the row for this MIDI value
    const rowIndex = fullRowData.findIndex(row => {
      const rowMidi = Note.midi(row.toneNote);
      return Math.abs(rowMidi - midiValue) < 0.5; // Allow for slight pitch variations
    });

    if (rowIndex === -1) return null;

    // Return absolute canvas Y coordinate
    const visualRowHeight = cellHeight * 0.5;
    return rowIndex * visualRowHeight;
  }

  /**
   * NEW: Convert absolute canvas Y coordinate to current viewport Y
   * Useful for UI elements that need to know where things appear on screen
   */
  canvasYToViewportY(canvasY) {
    const viewportInfo = LayoutService.getViewportInfo();
    return GridCoordsService.canvasToViewportY(canvasY, viewportInfo);
  }

  /**
   * NEW: Check if a canvas Y coordinate is currently visible
   */
  isCanvasYVisible(canvasY) {
    const viewportY = this.canvasYToViewportY(canvasY);
    const viewportInfo = LayoutService.getViewportInfo();
    return viewportY >= 0 && viewportY <= viewportInfo.viewportHeight;
  }
}

export default new PaintPlayheadRenderer();