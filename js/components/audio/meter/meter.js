// js/components/audio/meter/meter.js — standalone ES module for audio level metering (RMS, multi-channel)

/* ---- Minimal math helpers used for drawing ---- */
const math = {
  normalize(value, min, max) {
    return (value - min) / (max - min);
  },
  scale(inNum, inMin, inMax, outMin, outMax) {
    if (inMin === inMax) {return outMin;}
    return (((inNum - inMin) * (outMax - outMin)) / (inMax - inMin)) + outMin;
  }
};

/* ---- HiDPI-aware canvas with optional FPS pacing ---- */
class SmartCanvas {
  constructor(parent, fps) {
    const p = typeof parent === 'string'
      ? document.querySelector(parent)
      : parent;
    if (!p) {throw new Error('Meter: parent element not found.');}

    this.element = document.createElement('canvas');
    this.context = this.element.getContext('2d');
    this.scale = window.devicePixelRatio || 1;
    this.lastRefreshTime = 0;
    this.millisecondsPerFrame = 0;
    p.appendChild(this.element);

    this.setFramerate(fps);
  }

  resize(w, h) {
    const width = Math.max(1, Math.floor(w * this.scale));
    const height = Math.max(1, Math.floor(h * this.scale));
    this.element.width = width;
    this.element.height = height;
    this.element.style.width = `${w}px`;
    this.element.style.height = `${h}px`;
  }

  setFramerate(newFps) {
    this.millisecondsPerFrame = newFps ? 1000 / newFps : 0; // 0 = render every RAF
  }

  refreshIntervalReached(currentTime) {
    if (!this.millisecondsPerFrame) {return true;}
    if ((currentTime - this.lastRefreshTime) >= this.millisecondsPerFrame) {
      this.lastRefreshTime = currentTime;
      return true;
    }
    return false;
  }
}

/**
 * Meter — RMS level meter that visualizes an arbitrary Web Audio AudioNode.
 *
 * Example:
 *   import Meter from './meter.js';
 *   const meter = new Meter({ target: '#meter', size: [150, 60], fps: 30 });
 *   meter.connect(someAudioNode); // auto-detects channels
 *
 * Options:
 *   target  : Element | selector (default: document.body)
 *   size    : [width, height] in CSS pixels (default: [30, 100])
 *   fps     : number | undefined (undefined = run every RAF)
 *   colors  : { fill: string, accent: string } (defaults: #eee / #2bb)
 *   floorDb : dB floor for drawing (default: -70)
 *   ceilingDb : dB ceiling for drawing (default: +5)
 */
export default class Meter {
  constructor(options = {}) {
    const {
      target = document.body,
      size = [30, 100],
      fps = undefined,
      colors = {},
      floorDb = -70,
      ceilingDb = 5
    } = options;

    this.width = size[0];
    this.height = size[1];

    this.colors = {
      fill: '#eee',
      accent: '#2bb',
      ...colors
    };

    this.floorDb = floorDb;
    this.ceilingDb = ceilingDb;

    // Audio / render state
    this.channels = 2;
    this.splitter = null;
    this.analysers = [];
    this.bufferLength = 0;
    this.dataArray = null;
    this.active = false;
    this.source = null;
    this.dbs = []; // per-channel dB values
    this.diagnostics = [];

    // Canvas
    const parentEl = typeof target === 'string'
      ? document.querySelector(target)
      : target;
    this.canvas = new SmartCanvas(parentEl, fps);
    this.element = this.canvas.element;
    this.canvas.resize(this.width, this.height);

    this._updateBarGeometry();
    this._renderOnce();

    // Optional click-to-toggle (only if a source exists)
    this.element.style.cursor = 'pointer';
    this.element.addEventListener('click', () => {
      if (!this.source) {return;}
      this.active = !this.active;
      this.render(); // (re)enter loop if needed
    });
  }

  /* ---------- Public API ---------- */

  setFramerate(newFramerate) {
    this.canvas.setFramerate(newFramerate);
  }

  connect(node, channels) {
    if (!node || !node.context) {
      throw new Error('Meter.connect: expected a Web Audio AudioNode.');
    }
    if (this.source) {this.disconnect();}

    // Determine channels and build analyser chain
    this.channels = Math.max(1, channels || node.channelCount || 2);
    const ctx = node.context;
    this.splitter = ctx.createChannelSplitter(this.channels);

    this.analysers = [];
    for (let i = 0; i < this.channels; i++) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;                 // mirrors original Nexus UI meter
      analyser.smoothingTimeConstant = 1;      // "slow" meter for steadier bars
      this.splitter.connect(analyser, i);
      this.analysers.push(analyser);
    }

    this.bufferLength = this.analysers[0].frequencyBinCount;
    this.dataArray = new Float32Array(this.bufferLength);
    this.dbs = new Array(this.channels).fill(-Infinity);

    this.source = node;
    this.source.connect(this.splitter);

    this._updateBarGeometry();

    this.active = true;
    this.render();
  }

  disconnect() {
    if (this.source && this.splitter) {
      try { this.source.disconnect(this.splitter); } catch { /* Ignore disconnect errors */ }
    }
    this.splitter = null;
    this.analysers = [];
    this.bufferLength = 0;
    this.dataArray = null;
    this.source = null;
    this.active = false;
    this.dbs = [];
    this._renderOnce(); // clear background
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.canvas.resize(width, height);
    this._updateBarGeometry();
    this._renderOnce();
  }

  destroy() {
    this.disconnect();
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  getDiagnostics() {
    return [...this.diagnostics];
  }

  /* ---------- Internal: rendering ---------- */

  render(nowTime = performance.now()) {
    if (this.active) {
      requestAnimationFrame(this.render.bind(this));
      if (!this.canvas.refreshIntervalReached(nowTime)) {return;}
    }

    // Performance monitoring
    if (this.active && typeof performance !== 'undefined') {
      const startTime = performance.now();
      this._drawFrame();
      const endTime = performance.now();

      // Log performance warnings if frame takes too long (> 16ms for 60fps)
      const frameTime = endTime - startTime;
      if (frameTime > 16 && Math.random() < 0.01) { // Sample 1% of frames
        this.diagnostics.push({
          type: 'slowFrame',
          frameTime,
          timestamp: Date.now()
        });
      }
    } else {
      this._drawFrame();
    }
  }

  _updateBarGeometry() {
    // Use device pixels for exact drawing on HiDPI canvases
    this._deviceWidth = this.element.width;
    this._deviceHeight = this.element.height;
    this._barWidth = Math.max(1, Math.floor(this._deviceWidth / Math.max(1, this.channels)));
  }

  _renderOnce() {
    const ctx = this.canvas.context;
    ctx.fillStyle = this.colors.fill;
    ctx.fillRect(0, 0, this.element.width, this.element.height);
  }

  _drawFrame() {
    const ctx = this.canvas.context;
    const width = this._deviceWidth;
    const height = this._deviceHeight;

    // Background
    ctx.fillStyle = this.colors.fill;
    ctx.fillRect(0, 0, width, height);

    if (!this.analysers.length) {return;}

    // For each channel, compute RMS -> dBFS and draw
    for (let ch = 0; ch < this.analysers.length; ch++) {
      let db = this._sampleDb(this.analysers[ch], this.dataArray);
      if (!isFinite(db)) {
        // decay after disconnect or silence to give a fade-out effect
        db = (this.dbs[ch] > this.floorDb - 130 && isFinite(this.dbs[ch]))
          ? this.dbs[ch] - 1
          : -Infinity;
      }
      this.dbs[ch] = db;

      if (db > this.floorDb) {
        // Map dB -> [0,1] -> simple perceptual boost (square) -> pixel y
        const linear = math.normalize(db, this.floorDb, this.ceilingDb);
        const exp = linear * linear;
        const y = math.scale(exp, 0, 1, height, 0);

        ctx.fillStyle = this.colors.accent;
        const x = ch * this._barWidth;
        const w = Math.max(1, this._barWidth - 1); // visual separation
        ctx.fillRect(x, y, w, height - y);
      }
    }
  }

  _sampleDb(analyser, buffer) {
    analyser.getFloatTimeDomainData(buffer);
    // Compute RMS
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      const v = buffer[i];
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buffer.length);
    // Convert to dBFS, clamp to avoid -Infinity flicker on exact zero
    const eps = 1e-12;
    return 20 * Math.log10(Math.max(rms, eps));
  }
}
