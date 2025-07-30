// js/components/PitchPaint/paintPlayheadRenderer.js
import store from '../../state/index.js';
import LayoutService from '../../services/layoutService.js';
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
    console.log("PaintPlayheadRenderer: Instance created.");
  }

  initialize() {
    this.canvas = document.getElementById('playhead-canvas');
    if (!this.canvas) {
        console.error("PaintPlayheadRenderer: Could not find #playhead-canvas.");
        return;
    }
    this.ctx = this.canvas.getContext('2d');

    store.on('micPaintStateChanged', (isActive) => this.handlePaintStateChange(isActive));
    store.on('pitchDetected', (pitchData) => this.handlePitchDetection(pitchData));
    store.on('playbackStateChanged', () => {
        if (store.state.paint.isMicPaintActive) {
             console.log("PaintPlayheadRenderer: Playback state changed, will update visual in next frame.");
        }
    });

    console.log('PaintPlayheadRenderer: Initialized');
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
    console.log("PaintPlayheadRenderer: Starting render loop.");
    this.render();
  }

  stopRendering() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      console.log("PaintPlayheadRenderer: Stopped render loop.");
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
      // Draw the stationary playhead in the vertical center of the *visible* area
      const { gridPosition, logicRows, cellHeight } = store.state;
      const visibleCenterY = (gridPosition * (cellHeight * 0.5)) + (logicRows * (cellHeight * 0.5) / 2);

      this.ctx.strokeStyle = 'rgba(74, 144, 226, 0.8)';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([4, 4]);
      this.ctx.beginPath();
      this.ctx.arc(startX, visibleCenterY, 10, 0, 2 * Math.PI);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  renderMovingPlayhead() {
    const xPos = this.calculateXFromTime(Tone.Transport.seconds);
    if (xPos === null) return;

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
  
  // THE REFACTORED FUNCTION, ADAPTED FROM PITCH VISUALIZER
  midiToY(midiValue) {
    if (midiValue === 0) return null;

    const { fullRowData, cellHeight } = store.state;
    if (!fullRowData || fullRowData.length === 0 || cellHeight === 0) return null;

    // 1. Define the absolute MIDI boundaries of the entire grid.
    const topNoteMidi = Note.midi(fullRowData[0].toneNote); // e.g., C8 = 108
    const bottomNoteMidi = Note.midi(fullRowData[fullRowData.length - 1].toneNote); // e.g., C1 = 24
    const totalMidiRange = topNoteMidi - bottomNoteMidi;

    // 2. Define the absolute pixel boundaries of the entire canvas.
    const visualRowHeight = cellHeight * 0.5;
    const totalCanvasHeight = fullRowData.length * visualRowHeight;

    if (totalMidiRange <= 0) return null;

    // 3. Normalize the incoming pitch within the total MIDI range.
    // A value of 0.0 means the pitch is at the very top (C8).
    // A value of 1.0 means it's at the very bottom (C1).
    const normalizedPosition = (topNoteMidi - midiValue) / totalMidiRange;
    
    // 4. Map this normalized position to the total pixel height of the canvas.
    const y = normalizedPosition * totalCanvasHeight;

    // Return null if the pitch is outside the drawable range of the grid.
    if (y < 0 || y > totalCanvasHeight) {
        return null;
    }

    return y;
  }
}

export default new PaintPlayheadRenderer();