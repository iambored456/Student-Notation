// js/components/canvas/drumGrid/drumPlayheadRenderer.js
import store from '@state/index.js';
import * as Tone from 'tone';
import logger from '@utils/logger.js';
import {
  getTimeMapReference,
  getColumnStartX,
  getColumnWidth,
  getCachedMusicalEndTime
} from '@services/playheadModel.js';

class DrumPlayheadRenderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animationFrameId = null;
    this._lastColumnIndex = null;
    this._lastColumnProgress = 0;
    this._lastDebugLogTime = 0;
    
    // Animation system for drum note pops
    this.activeAnimations = new Map(); // key: "colIndex-drumTrack", value: {startTime, phase}
    this.popDuration = {
      scaleUp: 100,   // Fast scale up (ms)
      scaleDown: 300  // Slower scale down (ms)
    };
    this.popScale = 1.5; // 50% larger
  }

  initialize() {
    this.canvas = document.getElementById('drum-playhead-canvas');
    if (!this.canvas) {
      return;
    }
    this.ctx = this.canvas.getContext('2d');

    // Listen for playback state changes
    store.on('playbackStateChanged', () => this.handlePlaybackStateChange());
    store.on('tempoChanged', () => this.invalidateTimeMap());
  }

  handlePlaybackStateChange() {
    if (store.state.isPlaying && !store.state.isPaused) {
      this.startRendering();
    } else {
      this.stopRendering();
    }
  }

  invalidateTimeMap() {
    // Retained for compatibility; playheadModel keeps timing in sync.
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
    if (!store.state.isPlaying || store.state.isPaused || !this.ctx) {
      this.animationFrameId = null;
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const xPos = this.calculateXFromTime(Tone.Transport.seconds);
    if (xPos === null) {
      this.animationFrameId = requestAnimationFrame(() => this.render());
      return;
    }

    // Draw red vertical playhead line
    this.ctx.strokeStyle = '#FF6B35';
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = '#FF6B35';
    this.ctx.shadowBlur = 6;
    this.ctx.beginPath();
    this.ctx.moveTo(xPos, 0);
    this.ctx.lineTo(xPos, this.canvas.height);
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    this.debugPlayhead(Tone.Transport.seconds, xPos);

    this.animationFrameId = requestAnimationFrame(() => this.render());
  }

  calculateXFromTime(currentTime) {
    this._lastColumnIndex = null;
    this._lastColumnProgress = 0;

    const timeMap = getTimeMapReference();
    if (!Array.isArray(timeMap) || timeMap.length < 2) {
      return null;
    }

    for (let i = 0; i < timeMap.length - 1; i++) {
      if (currentTime >= timeMap[i] && currentTime < timeMap[i + 1]) {
        const colStartTime = timeMap[i];
        const colDuration = timeMap[i + 1] - colStartTime;
        const timeIntoCol = currentTime - colStartTime;
        
        const colStartX = getColumnStartX(i);
        const colWidth = getColumnWidth(i);
        
        this._lastColumnIndex = i;
        this._lastColumnProgress = colDuration > 0 ? timeIntoCol / colDuration : 0;
        return colStartX + (colDuration > 0 ? (timeIntoCol / colDuration) * colWidth : 0);
      }
    }
    return null;
  }

  debugPlayhead(currentTime, xPos) {
    if (!window.__DEBUG_PLAYHEAD_SYNC__) {
      return;
    }

    const now = performance.now();
    if (now - this._lastDebugLogTime < 250) {
      return;
    }
    this._lastDebugLogTime = now;

    const timeMap = getTimeMapReference();
    const colIndex = this._lastColumnIndex;
    const drumStartTime = (Array.isArray(timeMap) && colIndex !== null && colIndex >= 0) ? timeMap[colIndex] : undefined;
    const drumEndTime = (Array.isArray(timeMap) && colIndex !== null && colIndex + 1 < timeMap.length) ? timeMap[colIndex + 1] : undefined;
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
      toneLoopStart: Number((Tone.Transport.loopStart ?? 0).toFixed(3)),
      toneLoopEnd: Number((Tone.Transport.loopEnd ?? 0).toFixed(3)),
      storeLooping: store.state.isLooping
    };

    logger.debug('DrumPlayheadRenderer', 'Playhead diagnostics', info, 'canvas');
  }

  // Animation methods for drum note pops
  triggerNotePop(colIndex, drumTrack) {
    const key = `${colIndex}-${drumTrack}`;
    this.activeAnimations.set(key, {
      startTime: performance.now(),
      phase: 'scaleUp'
    });
    
    // Ensure drum grid is redrawn to show animation
    if (window.drumGridRenderer) {
      window.drumGridRenderer.render();
    }
  }

  getAnimationScale(colIndex, drumTrack) {
    const key = `${colIndex}-${drumTrack}`;
    const animation = this.activeAnimations.get(key);
    
    if (!animation) return 1.0;
    
    const now = performance.now();
    const elapsed = now - animation.startTime;
    
    if (animation.phase === 'scaleUp') {
      if (elapsed >= this.popDuration.scaleUp) {
        // Transition to scale down phase
        animation.phase = 'scaleDown';
        animation.startTime = now; // Reset timer for scale down
        return this.popScale;
      } else {
        // Scale up: 1.0 -> popScale over scaleUp duration
        const progress = elapsed / this.popDuration.scaleUp;
        return 1.0 + (this.popScale - 1.0) * progress;
      }
    } else if (animation.phase === 'scaleDown') {
      if (elapsed >= this.popDuration.scaleDown) {
        // Animation complete
        this.activeAnimations.delete(key);
        return 1.0;
      } else {
        // Scale down: popScale -> 1.0 over scaleDown duration  
        const progress = elapsed / this.popDuration.scaleDown;
        return this.popScale - (this.popScale - 1.0) * progress;
      }
    }
    
    return 1.0;
  }

  hasActiveAnimations() {
    return this.activeAnimations.size > 0;
  }

  // Clean up expired animations
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
