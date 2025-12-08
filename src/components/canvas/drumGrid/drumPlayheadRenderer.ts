// js/components/canvas/drumGrid/drumPlayheadRenderer.js
import store from '@state/index.ts';
import * as Tone from 'tone';
import logger from '@utils/logger.ts';
import {
  getTimeMapReference,
  getColumnStartX,
  getColumnWidth,
  getCachedMusicalEndTime
} from '@services/playheadModel.ts';
import { getLogicalCanvasWidth, getLogicalCanvasHeight } from '@utils/canvasDimensions.ts';

type AnimationPhase = 'scaleUp' | 'scaleDown';
interface PopAnimation { startTime: number; phase: AnimationPhase }

class DrumPlayheadRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;
  private _lastColumnIndex: number | null = null;
  private _lastColumnProgress = 0;
  private _lastDebugLogTime = 0;

  private activeAnimations = new Map<string, PopAnimation>();
  private popDuration = { scaleUp: 100, scaleDown: 300 };
  private popScale = 1.5;

  initialize() {
    this.canvas = document.getElementById('drum-playhead-canvas') as HTMLCanvasElement | null;
    if (!this.canvas) {
      return;
    }
    this.ctx = this.canvas.getContext('2d');
    store.on('playbackStateChanged', () => this.handlePlaybackStateChange());
    store.on('tempoChanged', () => this.invalidateTimeMap());
  }

  private handlePlaybackStateChange() {
    if (store.state.isPlaying && !store.state.isPaused) {
      this.startRendering();
    } else {
      this.stopRendering();
    }
  }

  private invalidateTimeMap() {
    // Kept for compatibility; playheadModel keeps timing in sync.
  }

  private startRendering() {
    if (this.animationFrameId) {return;}
    this.render();
  }

  private stopRendering() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, getLogicalCanvasWidth(this.canvas), getLogicalCanvasHeight(this.canvas));
    }
  }

  private render() {
    if (!store.state.isPlaying || store.state.isPaused || !this.ctx || !this.canvas) {
      this.animationFrameId = null;
      return;
    }

    this.ctx.clearRect(0, 0, getLogicalCanvasWidth(this.canvas), getLogicalCanvasHeight(this.canvas));
    const transportSeconds = Number((Tone.Transport.seconds as any) || 0);
    const xPos = this.calculateXFromTime(transportSeconds);
    if (xPos === null) {
      this.animationFrameId = requestAnimationFrame(() => this.render());
      return;
    }

    this.ctx.strokeStyle = '#FF6B35';
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = '#FF6B35';
    this.ctx.shadowBlur = 6;
    this.ctx.beginPath();
    this.ctx.moveTo(xPos, 0);
    this.ctx.lineTo(xPos, getLogicalCanvasHeight(this.canvas));
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    this.debugPlayhead(Tone.Transport.seconds, xPos);
    this.animationFrameId = requestAnimationFrame(() => this.render());
  }

  private calculateXFromTime(currentTime: number): number | null {
    this._lastColumnIndex = null;
    this._lastColumnProgress = 0;

    const timeMap = getTimeMapReference() as number[] | undefined;
    if (!Array.isArray(timeMap) || timeMap.length < 2) {
      return null;
    }

    for (let i = 0; i < timeMap.length - 1; i++) {
      const colStartTime = timeMap[i];
      const colEndTime = timeMap[i + 1];
      if (typeof colStartTime !== 'number' || typeof colEndTime !== 'number') {continue;}
      if (currentTime >= colStartTime && currentTime < colEndTime) {
        const colDuration = colEndTime - colStartTime;
        const timeIntoCol = currentTime - colStartTime;

        const colStartX = getColumnStartX(i) ?? 0;
        const colWidth = getColumnWidth(i) ?? 0;

        this._lastColumnIndex = i;
        this._lastColumnProgress = colDuration > 0 ? timeIntoCol / colDuration : 0;
        return colStartX + (colDuration > 0 ? (timeIntoCol / colDuration) * colWidth : 0);
      }
    }
    return null;
  }

  private debugPlayhead(currentTime: number, xPos: number) {
    if (!(window as any).__DEBUG_PLAYHEAD_SYNC__) {
      return;
    }

    const now = performance.now();
    if (now - this._lastDebugLogTime < 250) {
      return;
    }
    this._lastDebugLogTime = now;

    const timeMap = getTimeMapReference();
    const colIndex = this._lastColumnIndex;
    const drumStartTime = Array.isArray(timeMap) && colIndex !== null && colIndex >= 0 ? timeMap[colIndex] : undefined;
    const drumEndTime = Array.isArray(timeMap) && colIndex !== null && colIndex + 1 < timeMap.length ? timeMap[colIndex + 1] : undefined;
    const drumTimelineEnd = Array.isArray(timeMap) ? (timeMap[timeMap.length - 1] ?? 0) : 0;
    const transportTimelineEnd = getCachedMusicalEndTime();

    const info = {
      transportSeconds: Number(currentTime.toFixed(3)),
      drumX: Number((xPos ?? 0).toFixed(2)),
      columnIndex: colIndex,
      columnProgress: Number(this._lastColumnProgress.toFixed(3)),
      drumStartTime: Number(drumStartTime?.toFixed(3) ?? NaN),
      transportStartTime: Number(drumStartTime?.toFixed(3) ?? NaN),
      startDelta: 0,
      drumEndTime: Number(drumEndTime?.toFixed(3) ?? NaN),
      transportEndTime: Number(drumEndTime?.toFixed(3) ?? NaN),
      endDelta: 0,
      drumTimelineEnd: Number(drumTimelineEnd.toFixed(3)),
      transportTimelineEnd: Number((transportTimelineEnd ?? 0).toFixed(3)),
      timelineDelta: Number((drumTimelineEnd - (transportTimelineEnd ?? 0)).toFixed(3)),
      toneLoopStart: Number(Number((Tone.Transport.loopStart as any) ?? 0).toFixed(3)),
      toneLoopEnd: Number(Number((Tone.Transport.loopEnd as any) ?? 0).toFixed(3)),
      storeLooping: store.state.isLooping
    };

    logger.debug('DrumPlayheadRenderer', 'Playhead diagnostics', info, 'canvas');
  }

  triggerNotePop(colIndex: number, drumTrack: string | number) {
    const key = `${colIndex}-${drumTrack}`;
    this.activeAnimations.set(key, {
      startTime: performance.now(),
      phase: 'scaleUp'
    });
    if ((window as any).drumGridRenderer) {
      (window as any).drumGridRenderer.render();
    }
  }

  getAnimationScale(colIndex: number, drumTrack: string | number) {
    const key = `${colIndex}-${drumTrack}`;
    const animation = this.activeAnimations.get(key);
    if (!animation) {return 1.0;}

    const now = performance.now();
    const elapsed = now - animation.startTime;

    if (animation.phase === 'scaleUp') {
      if (elapsed >= this.popDuration.scaleUp) {
        animation.phase = 'scaleDown';
        animation.startTime = now;
        return this.popScale;
      } else {
        const progress = elapsed / this.popDuration.scaleUp;
        return 1.0 + (this.popScale - 1.0) * progress;
      }
    } else if (animation.phase === 'scaleDown') {
      if (elapsed >= this.popDuration.scaleDown) {
        this.activeAnimations.delete(key);
        return 1.0;
      } else {
        const progress = elapsed / this.popDuration.scaleDown;
        return this.popScale - (this.popScale - 1.0) * progress;
      }
    }
    return 1.0;
  }

  hasActiveAnimations() {
    return this.activeAnimations.size > 0;
  }

  cleanupAnimations() {
    const now = performance.now();
    for (const [key, animation] of this.activeAnimations.entries()) {
      const elapsed = now - animation.startTime;
      const totalDuration = animation.phase === 'scaleUp'
        ? this.popDuration.scaleUp
        : this.popDuration.scaleUp + this.popDuration.scaleDown;
      if (elapsed > totalDuration) {
        this.activeAnimations.delete(key);
      }
    }
  }
}

export default new DrumPlayheadRenderer();
