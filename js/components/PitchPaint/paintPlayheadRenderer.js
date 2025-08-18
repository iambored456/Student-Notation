// js/components/PitchPaint/paintPlayheadRenderer.js
import store from '../../state/index.js';
import LayoutService from '../../services/layoutService.js';
import GridCoordsService from '../../services/gridCoordsService.js';
import { getPitchColor, getInterpolatedColor } from '../../utils/chromaticColors.js';
import { getRowY } from '../Canvas/PitchGrid/renderers/rendererUtils.js';
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
    console.log('PaintPlayheadRenderer: Paint state changed to:', isActive);
    const hoverCanvas = document.getElementById('hover-canvas');
    if (hoverCanvas) hoverCanvas.style.display = isActive ? 'none' : 'block';

    if (isActive) {
      console.log('PaintPlayheadRenderer: Starting rendering...');
      this.startRendering();
    } else {
      console.log('PaintPlayheadRenderer: Stopping rendering...');
      this.stopRendering();
    }
  }

  handlePitchDetection(pitchData) {
    // Store the pitch data for rendering (this will update the horizontal line)
    // No need to restrict this to only when playing
    
    // Only add permanent paint when music is actually playing
    if (store.state.paint.isMicPaintActive && store.state.isPlaying && !store.state.isPaused) {
      this.addPaintAtPlayhead(pitchData);
    }
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

    const playbackState = {
      isPlaying: store.state.isPlaying,
      isPaused: store.state.isPaused,
      shouldShowMoving: store.state.isPlaying && !store.state.isPaused
    };

    if (store.state.isPlaying && !store.state.isPaused) {
      this.renderMovingPlayhead();
    } else {
      this.renderStationaryPlayhead();
    }

    this.animationFrameId = requestAnimationFrame(() => this.render());
  }

  renderStationaryPlayhead() {
    const { detectedPitch } = store.state.paint;
    
    // Clear canvas first
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    const y = this.midiToY(detectedPitch.midi);
    const hasValidPitch = y !== null;

    // Get grid boundaries - from start of column 2 to end of grid
    const startX = LayoutService.getColumnX(2);
    const endX = LayoutService.getCanvasWidth();


    if (hasValidPitch) {
      // Use interpolated color for smooth transitions between pitches
      const colorRgb = getInterpolatedColor(detectedPitch.midi);
      const color = `rgb(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]})`;
      
      this.ctx.strokeStyle = color;
      this.ctx.globalAlpha = Math.min(detectedPitch.clarity * 1.2, 1.0);
      this.ctx.lineWidth = 4;
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 6;
      this.ctx.beginPath();
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = 1.0;
      
    } else {
      // Draw a neutral line in the center of the viewport when no pitch detected
      const viewportInfo = LayoutService.getViewportInfo();
      const centerY = viewportInfo.viewportHeight / 2;

      this.ctx.strokeStyle = 'rgba(74, 144, 226, 0.6)';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([8, 8]);
      this.ctx.beginPath();
      this.ctx.moveTo(startX, centerY);
      this.ctx.lineTo(endX, centerY);
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
        const colorRgb = getInterpolatedColor(detectedPitch.midi);
        const color = `rgb(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]})`;
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 4;
        this.ctx.beginPath();
        this.ctx.arc(xPos, y, 8, 0, 2 * Math.PI); // Slightly larger for better visibility
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
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
   * Convert MIDI to continuous Y coordinate with interpolation between rows
   */
  midiToY(midiValue) {
    if (midiValue === 0) return null;

    const { fullRowData } = store.state;
    if (!fullRowData || fullRowData.length === 0) {
      return null;
    }

    // Get the proper MIDI range (note: grid rows may be in descending order)
    const minRowMidi = Math.min(...fullRowData.map(row => Note.midi(row.toneNote)));
    const maxRowMidi = Math.max(...fullRowData.map(row => Note.midi(row.toneNote)));
    
    // Log data flow: input pitch vs available range
    console.log('🎵 [Pitch->Y] Input:', midiValue.toFixed(1), 'Grid range:', minRowMidi, '-', maxRowMidi);

    // Simple canvas mapping for pitches outside grid range
    if (midiValue < minRowMidi || midiValue > maxRowMidi) {
      const canvasHeight = this.canvas.height;
      let mappedY;
      
      if (midiValue > maxRowMidi) {
        // Pitch higher than grid - map to top portion of canvas
        const semitonesDiff = midiValue - maxRowMidi;
        mappedY = Math.max(20, canvasHeight * 0.2 - (semitonesDiff * 5));
        console.log('🔼 [Above Grid] Y:', mappedY.toFixed(1));
      } else {
        // Pitch lower than grid - map to bottom portion of canvas
        const semitonesDiff = minRowMidi - midiValue;
        mappedY = Math.min(canvasHeight - 20, canvasHeight * 0.8 + (semitonesDiff * 5));
        console.log('🔽 [Below Grid] Y:', mappedY.toFixed(1));
      }
      
      return Math.max(20, Math.min(mappedY, canvasHeight - 20));
    }

    // Find the closest rows for interpolation within grid
    let bestRowIndex = 0;
    let smallestDiff = Math.abs(Note.midi(fullRowData[0].toneNote) - midiValue);
    
    for (let i = 1; i < fullRowData.length; i++) {
      const rowMidi = Note.midi(fullRowData[i].toneNote);
      const diff = Math.abs(rowMidi - midiValue);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        bestRowIndex = i;
      }
    }

    // Use the grid's row positioning
    const rowY = getRowY(bestRowIndex, store.state);
    console.log('🎯 [Grid Match] Y:', rowY.toFixed(1), 'row:', bestRowIndex);
    
    // Ensure Y is within canvas bounds
    const clampedY = Math.max(20, Math.min(rowY, this.canvas.height - 20));
    if (clampedY !== rowY) {
      console.log('🔒 [Clamped] From', rowY.toFixed(1), 'to', clampedY.toFixed(1));
    }
    
    return clampedY;
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