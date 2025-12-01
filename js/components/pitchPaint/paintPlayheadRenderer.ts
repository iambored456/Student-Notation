// js/components/PitchPaint/paintPlayheadRenderer.js
import store from '@state/index.ts';
import { getPaintColor } from '@utils/chromaticColors.ts';
import { getRowY, getColumnX } from '@components/canvas/PitchGrid/renderers/rendererUtils.js';
import { getColumnStartX, getColumnWidth, getTimeMapReference } from '@services/playheadModel.ts';
import PaintCanvas from './paintCanvas.js';
import * as Tone from 'tone';
import { Note } from 'tonal';
import { getLogicalCanvasWidth, getLogicalCanvasHeight } from '@utils/canvasDimensions.ts';
import type { PaintState, PitchRowData } from '../../../types/state.js';

type DetectedPitch = PaintState['detectedPitch'];

class PaintPlayheadRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;
  private lastValidPitch: DetectedPitch | null = null;
  private lastValidPitchTime = 0;
  private fadeOutDurationMs = 100; // Fade out over 500ms
  private isFading = false;

  initialize(): void {
    this.canvas = document.getElementById('playhead-canvas') as HTMLCanvasElement | null;
    if (!this.canvas) {
      return;
    }
    this.ctx = this.canvas.getContext('2d');

    store.on('micPaintStateChanged', (isActive: boolean) => this.handlePaintStateChange(isActive));
    store.on('pitchDetected', (pitchData: DetectedPitch) => this.handlePitchDetection(pitchData));
    store.on('playbackStateChanged', () => {
      if (store.state.paint.isMicPaintActive) {
        // TODO: Handle playback state changes during mic paint
      }
    });

  }

  handlePaintStateChange(isActive: boolean): void {
    const hoverCanvas = document.getElementById('hover-canvas');
    if (hoverCanvas) {hoverCanvas.style.display = isActive ? 'none' : 'block';}

    if (isActive) {
      this.startRendering();
    } else {
      this.stopRendering();
    }
  }

  handlePitchDetection(pitchData: DetectedPitch): void {
    // Store the pitch data for rendering (this will update the horizontal line)
    // No need to restrict this to only when playing

    // Only add permanent paint when music is actually playing
    if (store.state.paint.isMicPaintActive && store.state.isPlaying && !store.state.isPaused) {
      this.addPaintAtPlayhead(pitchData);
    }
  }

  startRendering(): void {
    if (this.animationFrameId) {return;}
    this.render();
  }

  stopRendering(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.ctx) {
      this.ctx.clearRect(0, 0, getLogicalCanvasWidth(this.canvas), getLogicalCanvasHeight(this.canvas));
    }
  }

  render(): void {
    const ctx = this.ctx;
    if (!store.state.paint.isMicPaintActive || !ctx) {
      this.animationFrameId = null;
      return;
    }

    ctx.clearRect(0, 0, getLogicalCanvasWidth(this.canvas), getLogicalCanvasHeight(this.canvas));

    if (store.state.isPlaying && !store.state.isPaused) {
      this.renderMovingPlayhead();
    } else {
      this.renderStationaryPlayhead();
    }

    this.animationFrameId = requestAnimationFrame(() => this.render());
  }

  renderStationaryPlayhead(): void {
    const ctx = this.ctx;
    if (!ctx) {return;}
    const { detectedPitch } = store.state.paint;
    const now = performance.now();

    // Clear canvas first
    ctx.clearRect(0, 0, getLogicalCanvasWidth(this.canvas), getLogicalCanvasHeight(this.canvas));

    const y = this.midiToY(detectedPitch.midi);
    const hasValidPitch = y !== null;

    // CANVAS-SPACE FIX: Get grid boundaries using canvas-space coordinates
    const renderOptions = {
      ...store.state,
      modulationMarkers: store.state.modulationMarkers || [],
      cellWidth: store.state.cellWidth,
      columnWidths: store.state.columnWidths,
      musicalColumnWidths: store.state.musicalColumnWidths || store.state.columnWidths.slice(2, -2),
      baseMicrobeatPx: store.state.cellWidth
    };
    const startX = getColumnX(0, renderOptions);
    // End of grid = X position of the last musical column + its width
    const lastColumnIndex = (renderOptions.musicalColumnWidths?.length || 0) - 1;
    const endX = lastColumnIndex >= 0 ? getColumnX(lastColumnIndex + 1, renderOptions) : startX;

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

      ctx.strokeStyle = color;
      ctx.globalAlpha = Math.min(detectedPitch.clarity * 1.2, 1.0);
      ctx.lineWidth = 4;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;

    } else if (this.lastValidPitch && (now - this.lastValidPitchTime) < this.fadeOutDurationMs) {
      // Start or continue fade-out animation
      this.isFading = true;
      const fadeProgress = (now - this.lastValidPitchTime) / this.fadeOutDurationMs;

      // Use easing function for smoother fade
      const easedAlpha = this.easeOutCubic(1.0 - fadeProgress);

      const fadeY = this.midiToY(this.lastValidPitch.midi);
      if (fadeY !== null) {
        const { colorMode } = store.state.paint.paintSettings;
        const selectedNoteColor = store.state.selectedNote?.color;
        const colorRgb = getPaintColor(this.lastValidPitch.midi, colorMode, selectedNoteColor);
        const color = `rgb(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]})`;

        ctx.strokeStyle = color;
        ctx.globalAlpha = easedAlpha * Math.min(this.lastValidPitch.clarity * 1.2, 1.0);
        ctx.lineWidth = 4;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6 * easedAlpha;
        ctx.beginPath();
        ctx.moveTo(startX, fadeY);
        ctx.lineTo(endX, fadeY);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
      }
    } else {
      // Fade-out complete, clear fade state
      this.isFading = false;
      this.lastValidPitch = null;
    }
  }

  // Easing function for smooth fade-out
  easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  renderMovingPlayhead(): void {
    const ctx = this.ctx;
    if (!ctx) {return;}
    const xPos = this.calculateXFromTime(Tone.Transport.seconds);
    if (xPos === null) {return;}

    // UPDATED: Draw playhead line across the full canvas height
    ctx.strokeStyle = '#FF6B35';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#FF6B35';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(xPos, 0);
    ctx.lineTo(xPos, getLogicalCanvasHeight(this.canvas));
    ctx.stroke();
    ctx.shadowBlur = 0;

    const { detectedPitch } = store.state.paint;
    const y = this.midiToY(detectedPitch.midi);
    if (y !== null) {
      const { colorMode } = store.state.paint.paintSettings;
      const selectedNoteColor = store.state.selectedNote?.color;
      const colorRgb = getPaintColor(detectedPitch.midi, colorMode, selectedNoteColor);
      const color = `rgb(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]})`;
      ctx.fillStyle = color;
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(xPos, y, 8, 0, 2 * Math.PI); // Slightly larger for better visibility
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  addPaintAtPlayhead(pitchData: DetectedPitch): void {
    if (pitchData.midi === 0) {return;}
    const musicalTime = Tone.Transport.seconds;
    PaintCanvas.addPaintPoint(musicalTime, pitchData.midi);
  }

  calculateXFromTime(currentTime: number): number | null {
    const timeMap = getTimeMapReference() as number[] | null;
    if (!Array.isArray(timeMap) || timeMap.length < 2) {
      return null;
    }

    for (let i = 0; i < timeMap.length - 1; i++) {
      const colStartTime = timeMap[i];
      const colEndTime = timeMap[i + 1];
      if (typeof colStartTime !== 'number' || typeof colEndTime !== 'number') {
        continue;
      }
      if (currentTime >= colStartTime && currentTime < colEndTime) {
        const colDuration = colEndTime - colStartTime;
        const timeIntoCol = currentTime - colStartTime;

        const colStartX = getColumnStartX(i);
        const colWidth = getColumnWidth(i);

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
  midiToY(midiValue: number): number | null {
    if (midiValue === 0) {return null;}

    const fullRowData = store.state.fullRowData as PitchRowData[] | undefined;
    if (!fullRowData || fullRowData.length === 0) {
      return null;
    }

    const midiValues = fullRowData
      .map(row => Note.midi(row.toneNote))
      .filter((value): value is number => typeof value === 'number');
    if (midiValues.length === 0) {return null;}

    const minRowMidi = Math.min(...midiValues);
    const maxRowMidi = Math.max(...midiValues);

    // Filter out pitches outside reasonable range (C1-C8: MIDI 24-96)
    if (midiValue < 24 || midiValue > 96 || midiValue < minRowMidi || midiValue > maxRowMidi) {
      return null; // Don't paint invalid pitches
    }

    // Find the two adjacent rows that bracket the midiValue for interpolation
    let lowerRowIndex = -1, upperRowIndex = -1;
    let lowerMidi = -999, upperMidi = 999;

    for (let i = 0; i < fullRowData.length; i++) {
      const row = fullRowData[i];
      if (!row) {continue;}
      const midi = Note.midi(row.toneNote);
      if (typeof midi !== 'number') {
        continue;
      }

      // Find the highest row MIDI that's still <= midiValue (lower bound)
      if (midi <= midiValue && midi > lowerMidi) {
        lowerRowIndex = i;
        lowerMidi = midi;
      }

      // Find the lowest row MIDI that's still >= midiValue (upper bound)
      if (midi >= midiValue && midi < upperMidi) {
        upperRowIndex = i;
        upperMidi = midi;
      }
    }

    // Handle exact matches (midiValue exactly equals a grid row)
    if (lowerMidi === midiValue && lowerRowIndex >= 0) {
      const rowY = getRowY(lowerRowIndex, store.state);
      return Math.max(0, Math.min(rowY, getLogicalCanvasHeight(this.canvas)));
    }

    // Interpolate between adjacent rows for continuous positioning
    if (lowerRowIndex >= 0 && upperRowIndex >= 0 && lowerMidi !== upperMidi) {
      const lowerY = getRowY(lowerRowIndex, store.state);
      const upperY = getRowY(upperRowIndex, store.state);
      const interpolationFactor = (midiValue - lowerMidi) / (upperMidi - lowerMidi);
      const interpolatedY = lowerY + (upperY - lowerY) * interpolationFactor;


      return Math.max(0, Math.min(interpolatedY, getLogicalCanvasHeight(this.canvas)));
    }

    // Fallback: use closest row if interpolation fails
    const firstRow = fullRowData[0];
    if (!firstRow) {return null;}
    let bestRowIndex = 0;
    let firstMidi = Note.midi(firstRow.toneNote);
    if (typeof firstMidi !== 'number') {
      firstMidi = midiValue;
    }
    let smallestDiff = Math.abs(firstMidi - midiValue);

    for (let i = 1; i < fullRowData.length; i++) {
      const row = fullRowData[i];
      if (!row) {continue;}
      const rowMidi = Note.midi(row.toneNote);
      if (typeof rowMidi !== 'number') {continue;}
      const diff = Math.abs(rowMidi - midiValue);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        bestRowIndex = i;
      }
    }

    const rowY = getRowY(bestRowIndex, store.state);
    return Math.max(0, Math.min(rowY, getLogicalCanvasHeight(this.canvas)));
  }

}

export default new PaintPlayheadRenderer();
