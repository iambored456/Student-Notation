// js/components/PitchPaint/paintPlayheadRenderer.js
import store from '@state/index.js';
import LayoutService from '@services/layoutService.js';
import GridCoordsService from '@services/gridCoordsService.js';
import { getPitchColor, getInterpolatedColor, getPaintColor } from '@utils/chromaticColors.js';
import { getRowY } from '@components/canvas/pitchGrid/renderers/rendererUtils.js';
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
    
    // Fade-out animation properties
    this.lastValidPitch = null;
    this.lastValidPitchTime = 0;
    this.fadeOutDurationMs = 100; // Fade out over 500ms
    this.isFading = false;
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
    const now = performance.now();
    
    // Clear canvas first
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    const y = this.midiToY(detectedPitch.midi);
    const hasValidPitch = y !== null;

    // Get grid boundaries - from start of column 2 to end of grid
    const startX = LayoutService.getColumnX(2);
    const endX = LayoutService.getCanvasWidth();

    if (hasValidPitch) {
      // Update last valid pitch data
      this.lastValidPitch = detectedPitch;
      this.lastValidPitchTime = now;
      this.isFading = false;
      
      // Render current pitch normally with color mode
      const { colorMode } = store.state.paint.paintSettings;
      const selectedNoteColor = store.state.selectedNote?.color;
      const colorRgb = getPaintColor(detectedPitch.midi, colorMode, selectedNoteColor);
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
      
    } else if (this.lastValidPitch && (now - this.lastValidPitchTime) < this.fadeOutDurationMs) {
      // Start or continue fade-out animation
      this.isFading = true;
      const fadeProgress = (now - this.lastValidPitchTime) / this.fadeOutDurationMs;
      const fadeAlpha = Math.max(0, 1.0 - fadeProgress);
      
      // Use easing function for smoother fade
      const easedAlpha = this.easeOutCubic(1.0 - fadeProgress);
      
      const fadeY = this.midiToY(this.lastValidPitch.midi);
      if (fadeY !== null) {
        const { colorMode } = store.state.paint.paintSettings;
        const selectedNoteColor = store.state.selectedNote?.color;
        const colorRgb = getPaintColor(this.lastValidPitch.midi, colorMode, selectedNoteColor);
        const color = `rgb(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]})`;
        
        this.ctx.strokeStyle = color;
        this.ctx.globalAlpha = easedAlpha * Math.min(this.lastValidPitch.clarity * 1.2, 1.0);
        this.ctx.lineWidth = 4;
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 6 * easedAlpha;
        this.ctx.beginPath();
        this.ctx.moveTo(startX, fadeY);
        this.ctx.lineTo(endX, fadeY);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = 1.0;
      }
    } else {
      // Fade-out complete, clear fade state
      this.isFading = false;
      this.lastValidPitch = null;
    }
  }

  // Easing function for smooth fade-out
  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
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
        const { colorMode } = store.state.paint.paintSettings;
        const selectedNoteColor = store.state.selectedNote?.color;
        const colorRgb = getPaintColor(detectedPitch.midi, colorMode, selectedNoteColor);
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
   * Convert MIDI to continuous Y coordinate with smooth interpolation between grid rows.
   * Enables true glissando painting by calculating precise positions between semitones.
   * Filters out pitches outside C1-C8 range (MIDI 24-96).
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
    
    // Filter out pitches outside reasonable range (C1-C8: MIDI 24-96)
    if (midiValue < 24 || midiValue > 96 || midiValue < minRowMidi || midiValue > maxRowMidi) {
      return null; // Don't paint invalid pitches
    }

    // Find the two adjacent rows that bracket the midiValue for interpolation
    let lowerRowIndex = -1, upperRowIndex = -1;
    let lowerMidi = -999, upperMidi = 999;

    for (let i = 0; i < fullRowData.length; i++) {
      const rowMidi = Note.midi(fullRowData[i].toneNote);
      
      // Find the highest row MIDI that's still <= midiValue (lower bound)
      if (rowMidi <= midiValue && rowMidi > lowerMidi) {
        lowerRowIndex = i;
        lowerMidi = rowMidi;
      }
      
      // Find the lowest row MIDI that's still >= midiValue (upper bound)
      if (rowMidi >= midiValue && rowMidi < upperMidi) {
        upperRowIndex = i;
        upperMidi = rowMidi;
      }
    }

    // Handle exact matches (midiValue exactly equals a grid row)
    if (lowerMidi === midiValue) {
      const rowY = getRowY(lowerRowIndex, store.state);
      return Math.max(0, Math.min(rowY, this.canvas.height));
    }

    // Interpolate between adjacent rows for continuous positioning
    if (lowerRowIndex >= 0 && upperRowIndex >= 0 && lowerMidi !== upperMidi) {
      const lowerY = getRowY(lowerRowIndex, store.state);
      const upperY = getRowY(upperRowIndex, store.state);
      const interpolationFactor = (midiValue - lowerMidi) / (upperMidi - lowerMidi);
      const interpolatedY = lowerY + (upperY - lowerY) * interpolationFactor;
      
      
      return Math.max(0, Math.min(interpolatedY, this.canvas.height));
    }

    // Fallback: use closest row if interpolation fails
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

    const rowY = getRowY(bestRowIndex, store.state);
    return Math.max(0, Math.min(rowY, this.canvas.height));
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
