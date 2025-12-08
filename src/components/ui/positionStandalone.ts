// js/components/UI/positionStandalone.js

type PositionMode = 'absolute' | 'relative';

interface PositionOptions {
  size?: [number, number];
  mode?: PositionMode;
  x?: number;
  minX?: number;
  maxX?: number;
  stepX?: number;
  y?: number;
  minY?: number;
  maxY?: number;
  stepY?: number;
  colors?: {
    accent?: string;
    fill?: string;
    stroke?: string;
    grid?: string;
    text?: string;
  };
}

interface PositionValue { x: number; y: number }

class MiniEmitter {
  private listeners = new Map<string, ((payload: PositionValue) => void)[]>();

  on(name: string, fn: (payload: PositionValue) => void) {
    const arr = this.listeners.get(name) || [];
    arr.push(fn);
    this.listeners.set(name, arr);
  }

  off(name: string, fn: (payload: PositionValue) => void) {
    const arr = this.listeners.get(name);
    if (!arr) {return;}
    const idx = arr.indexOf(fn);
    if (idx >= 0) {arr.splice(idx, 1);}
  }

  emit(name: string, payload: PositionValue) {
    const arr = this.listeners.get(name);
    if (!arr) {return;}
    arr.slice().forEach(fn => fn(payload));
  }
}

export default class Position {
  private static DEBUG_POSITION = false;

  private debugLog(...args: unknown[]) {
    if (!Position.DEBUG_POSITION) {return;}

    console.log('[Position]', ...args);
  }

  private _root: HTMLElement;
  private _svgWrapper: SVGSVGElement;
  private _bg: SVGRectElement;
  private _gridFill: SVGRectElement;
  private _gridPatternRect: SVGRectElement;
  private _dial: SVGCircleElement;
  private _crosshairV: SVGLineElement;
  private _crosshairH: SVGLineElement;
  private _label: SVGTextElement;
  private _em = new MiniEmitter();
  private _patternId: string;

  private _size: [number, number];
  private _mode: PositionMode;

  private _minX: number;
  private _maxX: number;
  private _stepX: number;
  private _minY: number;
  private _maxY: number;
  private _stepY: number;

  private _x: number;
  private _y: number;

  private _normX: number;
  private _normY: number;

  private _dragging = false;

  private colors = {
    accent: '#4a90e2',
    fill: '#1f1f1f',
    stroke: '#555',
    grid: '#333',
    text: '#fff',
    ...( {} as PositionOptions['colors'])
  };

  constructor(target: string | HTMLElement, opts: PositionOptions = {}) {
    this._root = typeof target === 'string' ? document.querySelector(target)! : target;
    if (!this._root) {throw new Error('Position: target not found');}

    const {
      size = [200, 200],
      mode = 'absolute',
      x = 0.5, minX = 0, maxX = 1, stepX = 0,
      y = 0.5, minY = 0, maxY = 1, stepY = 0,
      colors
    } = opts;

    // Use a unique pattern ID per instance so multiple pads don't clash in the DOM
    this._patternId = `pos-grid-${Math.random().toString(36).slice(2, 8)}`;

    // Pull theme colors from CSS variables if available (keeps pads from being pure black)
    try {
      const styles = getComputedStyle(document.documentElement);
      const surface = styles.getPropertyValue('--c-surface').trim();
      const border = styles.getPropertyValue('--c-border').trim();
      const grid = styles.getPropertyValue('--c-border-strong').trim();
      const textColor = styles.getPropertyValue('--c-text').trim();
      this.colors = {
        ...this.colors,
        fill: surface || this.colors.fill,
        stroke: border || this.colors.stroke,
        grid: grid || this.colors.grid,
        text: textColor || this.colors.text
      };
    } catch {
      // Ignore style resolution errors and keep defaults
    }

    this._size = size;
    this._mode = mode;
    this._minX = minX; this._maxX = maxX; this._stepX = stepX;
    this._minY = minY; this._maxY = maxY; this._stepY = stepY;
    if (colors) {this.colors = { ...this.colors, ...colors };}

    this._x = x;
    this._y = y;
    this._normX = 0;
    this._normY = 0;

    this._svgWrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svgWrapper.setAttribute('width', `${size[0]}`);
    this._svgWrapper.setAttribute('height', `${size[1]}`);
    this._svgWrapper.setAttribute('viewBox', `0 0 ${size[0]} ${size[1]}`);
    this._svgWrapper.style.touchAction = 'none';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gridPattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    gridPattern.setAttribute('id', this._patternId);
    gridPattern.setAttribute('width', '20');
    gridPattern.setAttribute('height', '20');
    gridPattern.setAttribute('patternUnits', 'userSpaceOnUse');
    this._gridPatternRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this._gridPatternRect.setAttribute('width', '20');
    this._gridPatternRect.setAttribute('height', '20');
    this._gridPatternRect.setAttribute('fill', 'none');
    this._gridPatternRect.setAttribute('stroke', this.colors.grid);
    this._gridPatternRect.setAttribute('stroke-width', '1');
    gridPattern.appendChild(this._gridPatternRect);
    defs.appendChild(gridPattern);
    this._svgWrapper.appendChild(defs);

    this._bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this._bg.setAttribute('x', '0');
    this._bg.setAttribute('y', '0');
    this._bg.setAttribute('width', `${size[0]}`);
    this._bg.setAttribute('height', `${size[1]}`);
    this._bg.setAttribute('fill', this.colors.fill);
    this._bg.setAttribute('stroke', this.colors.stroke);
    this._svgWrapper.appendChild(this._bg);

    this._gridFill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this._gridFill.setAttribute('x', '0');
    this._gridFill.setAttribute('y', '0');
    this._gridFill.setAttribute('width', `${size[0]}`);
    this._gridFill.setAttribute('height', `${size[1]}`);
    this._gridFill.setAttribute('fill', `url(#${this._patternId})`);
    this._gridFill.setAttribute('opacity', '0.2');
    this._svgWrapper.appendChild(this._gridFill);

    this._crosshairV = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this._crosshairH = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    [this._crosshairV, this._crosshairH].forEach(line => {
      line.setAttribute('stroke', this.colors.grid);
      line.setAttribute('stroke-width', '1');
      line.setAttribute('opacity', '0.6');
      this._svgWrapper.appendChild(line);
    });

    this._dial = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this._dial.setAttribute('r', '10');
    this._dial.setAttribute('fill', this.colors.accent);
    this._dial.setAttribute('stroke', '#fff');
    this._dial.setAttribute('stroke-width', '2');
    this._svgWrapper.appendChild(this._dial);

    this._label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    this._label.setAttribute('x', '8');
    this._label.setAttribute('y', `${size[1] - 8}`);
    this._label.setAttribute('fill', this.colors.text);
    this._label.setAttribute('font-size', '12');
    this._label.setAttribute('font-family', 'monospace');
    this._label.textContent = '';
    this._svgWrapper.appendChild(this._label);

    this._root.innerHTML = '';
    this._root.appendChild(this._svgWrapper);

    this._bind();
    this.setColors(); // apply initial colors to all layers
    this._updateFromValues();
  }

  // Public API
  on(name: 'change', fn: (payload: PositionValue) => void) {
    this._em.on(name, fn);
    return () => this._em.off(name, fn);
  }

  get value(): PositionValue {
    return { x: this._x, y: this._y };
  }

  get normalized(): PositionValue {
    return { x: this._normX, y: this._normY };
  }

  set x(v: number) {
    this._x = this._clamp(this._maybeStep(v, this._minX, this._maxX, this._stepX), this._minX, this._maxX);
    this._updateFromValues();
  }
  get x(): number { return this._x; }

  set y(v: number) {
    this._y = this._clamp(this._maybeStep(v, this._minY, this._maxY, this._stepY), this._minY, this._maxY);
    this._updateFromValues();
  }
  get y(): number { return this._y; }

  set minX(v: number) { this._minX = v; this._updateFromValues(); }
  set maxX(v: number) { this._maxX = v; this._updateFromValues(); }
  set minY(v: number) { this._minY = v; this._updateFromValues(); }
  set maxY(v: number) { this._maxY = v; this._updateFromValues(); }
  set stepX(v: number) { this._stepX = v; }
  set stepY(v: number) { this._stepY = v; }

  resize(w: number, h: number) {
    this._size = [w, h];
    this._svgWrapper.setAttribute('width', `${w}`);
    this._svgWrapper.setAttribute('height', `${h}`);
    this._svgWrapper.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this._label.setAttribute('y', `${h - 8}`);
    this._updateFromValues();
  }

  destroy() {
    this._root.innerHTML = '';
  }

  setColors(colors: PositionOptions['colors'] = {}) {
    this.colors = { ...this.colors, ...colors };
    this._bg.setAttribute('fill', this.colors.fill);
    this._bg.setAttribute('stroke', this.colors.stroke);
    this._gridPatternRect.setAttribute('stroke', this.colors.grid);
    this._gridFill.setAttribute('fill', `url(#${this._patternId})`);
    this._crosshairV.setAttribute('stroke', this.colors.grid);
    this._crosshairH.setAttribute('stroke', this.colors.grid);
    this._dial.setAttribute('fill', this.colors.accent);
    this._label.setAttribute('fill', this.colors.text);
  }

  // Internal
  private _updateFromValues() {
    // Only allow an “off” state at the true origin (0,0).
    // If either axis is at min while the other is not, nudge it to the first step.
    if (!(this._x === this._minX && this._y === this._minY)) {
      const origX = this._x;
      const origY = this._y;
      if (this._x === this._minX) {
        const minStepX = this._stepX > 0 ? this._stepX : Math.max((this._maxX - this._minX) / 100, 0.01);
        this._x = this._minX + minStepX;
      }
      if (this._y === this._minY) {
        const minStepY = this._stepY > 0 ? this._stepY : Math.max((this._maxY - this._minY) / 100, 0.01);
        this._y = this._minY + minStepY;
      }
      this.debugLog('Adjusted single-axis zero', { from: { x: origX, y: origY }, to: { x: this._x, y: this._y } });
    } else {
      this.debugLog('At origin (off state)', { x: this._x, y: this._y });
    }

    const normX = (this._x - this._minX) / (this._maxX - this._minX || 1);
    const normY = (this._y - this._minY) / (this._maxY - this._minY || 1);
    this._normX = this._clamp(normX, 0, 1);
    this._normY = this._clamp(normY, 0, 1);
    this._updateGraphics();
    this._em.emit('change', { x: this._x, y: this._y });
  }

  private _updateGraphics() {
    const [w, h] = this._size;
    const posX = this._normX * w;
    const posY = this._mode === 'absolute' ? this._normY * h : (1 - this._normY) * h;

    this._dial.setAttribute('cx', `${posX}`);
    this._dial.setAttribute('cy', `${posY}`);
    this._crosshairV.setAttribute('x1', `${posX}`);
    this._crosshairV.setAttribute('x2', `${posX}`);
    this._crosshairV.setAttribute('y1', '0');
    this._crosshairV.setAttribute('y2', `${h}`);
    this._crosshairH.setAttribute('x1', '0');
    this._crosshairH.setAttribute('x2', `${w}`);
    this._crosshairH.setAttribute('y1', `${posY}`);
    this._crosshairH.setAttribute('y2', `${posY}`);
    this._label.textContent = `x:${this._x.toFixed(3)} y:${this._y.toFixed(3)}`;
  }

  private _bind() {
    const onPointer = (ev: PointerEvent) => {
      this._dragging = true;
      this._handlePointer(ev);
      (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
    };
    const movePointer = (ev: PointerEvent) => {
      if (!this._dragging) {return;}
      this._handlePointer(ev);
    };
    const endPointer = (ev: PointerEvent) => {
      this._dragging = false;
      (ev.target as HTMLElement).releasePointerCapture?.(ev.pointerId);
    };

    this._svgWrapper.addEventListener('pointerdown', onPointer);
    this._svgWrapper.addEventListener('pointermove', movePointer);
    this._svgWrapper.addEventListener('pointerup', endPointer);
    this._svgWrapper.addEventListener('pointercancel', endPointer);
  }

  private _handlePointer(ev: PointerEvent) {
    const rect = this._svgWrapper.getBoundingClientRect();
    const nx = (ev.clientX - rect.left) / rect.width;
    const ny = (ev.clientY - rect.top) / rect.height;
    this._normX = this._clamp(nx, 0, 1);
    const normalizedY = this._mode === 'relative' ? 1 - ny : ny;
    this._normY = this._clamp(normalizedY, 0, 1);
    this._x = this._minX + this._normX * (this._maxX - this._minX);
    this._y = this._minY + this._normY * (this._maxY - this._minY);
    this.debugLog('Pointer move', {
      raw: { nx, ny },
      norm: { x: this._normX, y: this._normY },
      value: { x: this._x, y: this._y },
      mode: this._mode
    });
    if (this._stepX > 0) {
      const steppedX = this._maybeStep(this._x, this._minX, this._maxX, this._stepX);
      this._x = steppedX;
    }
    if (this._stepY > 0) {
      const steppedY = this._maybeStep(this._y, this._minY, this._maxY, this._stepY);
      this._y = steppedY;
    }
    // Only allow zero when both axes are zero; otherwise nudge the zero axis up to the first step
    if (!(this._x === this._minX && this._y === this._minY)) {
      if (this._x === this._minX) {
        const minStepX = this._stepX > 0 ? this._stepX : Math.max((this._maxX - this._minX) / 100, 0.01);
        this._x = this._minX + minStepX;
      }
      if (this._y === this._minY) {
        const minStepY = this._stepY > 0 ? this._stepY : Math.max((this._maxY - this._minY) / 100, 0.01);
        this._y = this._minY + minStepY;
      }
    }
    // Recompute norms after adjustments
    this._normX = this._clamp((this._x - this._minX) / (this._maxX - this._minX || 1), 0, 1);
    this._normY = this._clamp((this._y - this._minY) / (this._maxY - this._minY || 1), 0, 1);
    this._updateGraphics();
    this._em.emit('change', { x: this._x, y: this._y });
  }

  private _maybeStep(value: number, min: number, max: number, step: number) {
    if (step <= 0) {return value;}
    const delta = value - min;
    const rounded = Math.round(delta / step);
    const snapped = min + rounded * step;
    return this._clamp(snapped, min, max);
  }

  private _clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
  }
}
