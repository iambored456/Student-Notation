// js/components/Canvas/DrumGrid/drumPlayheadRenderer.js
import store from '../../../state/index.js';
import LayoutService from '../../../services/layoutService.js';
import { getColumnX as getModulatedColumnX } from '../PitchGrid/renderers/rendererUtils.js';
import * as Tone from 'tone';

class DrumPlayheadRenderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animationFrameId = null;
    this.timeMap = [];
    this._lastTempo = 0;
    
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
    this._lastTempo = 0; // Force rebuild on next render
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

    this.animationFrameId = requestAnimationFrame(() => this.render());
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

  getColumnX(index) {
    // Use modulation-aware column positions if modulation exists
    const hasModulation = store.state.modulationMarkers && store.state.modulationMarkers.length > 0;
    
    if (hasModulation) {
      const options = {
        modulationMarkers: store.state.modulationMarkers,
        columnWidths: store.state.columnWidths,
        cellWidth: store.state.cellWidth,
        baseMicrobeatPx: store.state.baseMicrobeatPx || store.state.cellWidth || 40
      };
      return getModulatedColumnX(index, options);
    } else {
      return LayoutService.getColumnX(index);
    }
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
        
        const colStartX = this.getColumnX(i);
        const colWidth = this.getColumnX(i + 1) - colStartX;
        
        return colStartX + (colDuration > 0 ? (timeIntoCol / colDuration) * colWidth : 0);
      }
    }
    return null;
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