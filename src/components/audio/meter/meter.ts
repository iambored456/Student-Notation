// js/components/audio/meter/meter.js — standalone ES module for audio level metering (RMS, multi-channel)

interface MeterOptions {
  target?: HTMLElement | string;
  size?: [number, number];
  fps?: number;
  colors?: { fill?: string; accent?: string };
  floorDb?: number;
  ceilingDb?: number;
}

/* ---- Minimal math helpers used for drawing ---- */
const math = {
  normalize(value: number, min: number, max: number) {
    return (value - min) / (max - min || 1);
  },
  scale(inNum: number, inMin: number, inMax: number, outMin: number, outMax: number) {
    if (inMin === inMax) {return outMin;}
    return (((inNum - inMin) * (outMax - outMin)) / (inMax - inMin)) + outMin;
  }
};

/* ---- HiDPI-aware canvas with optional FPS pacing ---- */
class SmartCanvas {
  element: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;
  scale: number;
  lastRefreshTime = 0;
  millisecondsPerFrame = 0;

  constructor(parent: HTMLElement | string, fps?: number) {
    const p = typeof parent === 'string'
      ? document.querySelector(parent)
      : parent;
    if (!p) {throw new Error('Meter: parent element not found.');}

    this.element = document.createElement('canvas');
    this.context = this.element.getContext('2d');
    this.scale = window.devicePixelRatio || 1;
    p.appendChild(this.element);
    this.setFramerate(fps);
  }

  resize(w: number, h: number) {
    const width = Math.max(1, Math.floor(w * this.scale));
    const height = Math.max(1, Math.floor(h * this.scale));
    this.element.width = width;
    this.element.height = height;
    this.element.style.width = `${w}px`;
    this.element.style.height = `${h}px`;
  }

  setFramerate(newFps?: number) {
    this.millisecondsPerFrame = newFps ? 1000 / newFps : 0; // 0 = render every RAF
  }

  refreshIntervalReached(currentTime: number) {
    if (!this.millisecondsPerFrame) {return true;}
    if ((currentTime - this.lastRefreshTime) >= this.millisecondsPerFrame) {
      this.lastRefreshTime = currentTime;
      return true;
    }
    return false;
  }
}

export default class Meter {
  width: number;
  height: number;
  colors: { fill: string; accent: string };
  floorDb: number;
  ceilingDb: number;

  channels = 2;
  splitter: ChannelSplitterNode | null = null;
  analysers: AnalyserNode[] = [];
  bufferLength = 0;
  dataArray: Float32Array | null = null;
  active = false;
  source: AudioNode | null = null;
  dbs: number[] = [];
  diagnostics: string[] = [];

  canvas: SmartCanvas;
  element: HTMLCanvasElement;

  barPadding = 2;
  barWidth = 0;
  timestamp = 0;

  constructor(options: MeterOptions = {}) {
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

    const parentEl = typeof target === 'string'
      ? document.querySelector(target)
      : target;
    this.canvas = new SmartCanvas(parentEl || document.body, fps);
    this.element = this.canvas.element;
    this.canvas.resize(this.width, this.height);

    this._updateBarGeometry();
    this._renderOnce();

    this.element.style.cursor = 'pointer';
    this.element.addEventListener('click', () => {
      if (!this.source) {return;}
      this.active = !this.active;
      this.render();
    });
  }

  setFramerate(newFramerate?: number) {
    this.canvas.setFramerate(newFramerate);
  }

  connect(node: AudioNode, channels?: number) {
    if (!node || !(node as any).context) {
      throw new Error('Meter.connect: expected a Web Audio AudioNode.');
    }
    if (this.source) {this.disconnect();}

    this.channels = Math.max(1, channels || (node as any).channelCount || 2);
    const ctx: BaseAudioContext = (node as any).context;
    this.splitter = ctx.createChannelSplitter(this.channels);

    this.analysers = [];
    for (let i = 0; i < this.channels; i++) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 1;
      this.splitter.connect(analyser, i);
      this.analysers.push(analyser);
    }

    this.bufferLength = this.analysers[0]?.frequencyBinCount || 0;
    this.dataArray = new Float32Array(this.bufferLength || 1);
    this.dbs = new Array(this.channels).fill(-Infinity);

    this.source = node;
    this.source.connect(this.splitter);

    this._updateBarGeometry();
    this.active = true;
    this.render();
  }

  disconnect() {
    if (this.source && this.splitter) {
      try {
        this.source.disconnect(this.splitter);
      } catch { /* ignore */ }
    }
    this.active = false;
    this.source = null;
    this.splitter = null;
  }

  render() {
    if (!this.active) {return;}
    const raf = (time: number) => {
      this.timestamp = time;
      this._renderOnce();
      if (this.active) {window.requestAnimationFrame(raf);}
    };
    window.requestAnimationFrame(raf);
  }

  private _updateBarGeometry() {
    this.barWidth = (this.width - (this.barPadding * (this.channels + 1))) / this.channels;
  }

  private _renderOnce() {
    if (!this.canvas.context || !this.dataArray) {return;}
    const ctx = this.canvas.context;
    ctx.clearRect(0, 0, this.canvas.element.width, this.canvas.element.height);

    for (let channel = 0; channel < this.channels; channel++) {
      const analyser = this.analysers[channel];
      if (!analyser) {continue;}

      analyser.getFloatTimeDomainData(this.dataArray as Float32Array<ArrayBuffer>);
      let sumSquares = 0;
      for (let i = 0; i < this.bufferLength; i++) {
        const sample = this.dataArray[i] ?? 0;
        sumSquares += sample * sample;
      }
      const rms = Math.sqrt(sumSquares / this.bufferLength) || 0;
      const db = 20 * Math.log10(rms || 1e-8);
      this.dbs[channel] = db;

      const norm = math.normalize(db, this.floorDb, this.ceilingDb);
      const heightPx = math.scale(norm, 0, 1, 0, this.canvas.element.height);

      const x = this.barPadding + channel * (this.barWidth + this.barPadding);
      const y = this.canvas.element.height - heightPx;

      ctx.fillStyle = this.colors.fill;
      ctx.fillRect(x, 0, this.barWidth, this.canvas.element.height);

      ctx.fillStyle = this.colors.accent;
      ctx.fillRect(x, y, this.barWidth, heightPx);
    }
  }
}
