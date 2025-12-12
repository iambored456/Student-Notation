/*
  DraggableNumber — a tiny, dependency-free replacement for NexusUI Number
  -----------------------------------------------------------------------
  Features
  - Text input with numeric filtering
  - Drag-to-adjust (vertical drag), with horizontal position changing sensitivity
  - min / max / step enforcement via internal Step helper
  - Emits "change" event whenever value updates (typing Enter, blur, or drag)
  - Lightweight styling via inline styles (override with CSS if you like)

  Usage
    import DraggableNumber from './draggableNumber.js'
    const num = new DraggableNumber('#target', {
      size: [60, 30], value: 0, min: 0, max: 20000, step: 1,
      decimalPlaces: 2,
      colors: { fill: '#e7e7e7', dark: '#333', light: '#fff', accent: '#d18' }
    })
    num.on('change', v => handleValueChange(v))

  Notes
  - No Nexus.Interface, util, math, or models.Step dependencies.
  - Public API mirrors the NexusUI Number where sensible: value, min, max, step, link(), passiveUpdate().
  - You can pass an HTMLElement instead of a selector as the first argument.
*/

interface DraggableNumberOptions {
  size?: [number, number];
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  decimalPlaces?: number;
  colors?: { fill?: string; dark?: string; light?: string; accent?: string };
  useAppStyling?: boolean;
}

export default class DraggableNumber {
  private parent: HTMLElement;
  private settings: {
    size: [number, number];
    value: number;
    min: number;
    max: number;
    step: number;
    decimalPlaces: number;
    colors: { fill: string; dark: string; light: string; accent: string };
    useAppStyling: boolean;
  };
  private _em: Emitter;
  private _value: Step;
  private decimalPlaces: number;
  private colors: { fill: string; dark: string; light: string; accent: string };
  private element: HTMLInputElement;
  private _minDimension: number;
  private actual = 0;
  private hasMoved = false;
  private clicked = false;
  private _start: { y: number } = { y: 0 };
  private _changeFactor = 1;

  constructor(parent: string | HTMLElement, opts: DraggableNumberOptions = {}) {
    // Resolve parent element
    const resolvedParent = typeof parent === 'string' ? document.querySelector(parent) : parent;
    this.parent = resolvedParent as HTMLElement;
    if (!this.parent) {throw new Error('DraggableNumber: parent element not found');}

    // Options & defaults
    const defaults: {
      size: [number, number];
      value: number;
      min: number;
      max: number;
      step: number;
      decimalPlaces: number;
      colors: { fill: string; dark: string; light: string; accent: string };
      useAppStyling: boolean;
    } = {
      size: [60, 30],
      value: 0,
      min: 0,
      max: 20000,
      step: 1,
      decimalPlaces: 2,
      colors: { fill: '#e7e7e7', dark: '#333', light: '#fff', accent: '#b35' },
      useAppStyling: false
    };
    const mergedColors: { fill: string; dark: string; light: string; accent: string } = {
      fill: opts.colors?.fill ?? defaults.colors.fill,
      dark: opts.colors?.dark ?? defaults.colors.dark,
      light: opts.colors?.light ?? defaults.colors.light,
      accent: opts.colors?.accent ?? defaults.colors.accent
    };
    this.settings = { ...defaults, ...opts, colors: mergedColors };

    // Internal helpers
    this._em = new Emitter();
    this._value = new Step(this.settings.min, this.settings.max, this.settings.step, this.settings.value);

    this.decimalPlaces = this.settings.decimalPlaces;
    this.colors = this.settings.colors;

    // Build DOM
    this.element = document.createElement('input');
    this.element.type = 'text';
    this.parent.appendChild(this.element);

    // Styling
    const [w, h] = this.settings.size;
    this._minDimension = Math.min(w, h);

    if (this.settings.useAppStyling) {
      // Use app-specific styling
      this.element.className = 'draggable-number-input';
      this.element.style.cssText = [
        `width:${w}px`,
        `height:${h}px`,
        'background-color: var(--c-surface)',
        'color: var(--c-text)',
        'border: 1px solid var(--c-border)',
        'border-radius: var(--border-radius-sm)',
        'font-family: var(--main-font)',
        'font-weight: 400',
        'font-size: 14px',
        'text-align: center',
        'outline: none',
        'padding: 0',
        'box-sizing: border-box',
        'user-select: text'
      ].join(';');
    } else {
      // Use original styling
      this.element.style.cssText = [
        `width:${w}px`,
        `height:${h}px`,
        `background-color:${this.colors.fill}`,
        `color:${this.colors.dark}`,
        'font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
        'font-weight:500',
        `font-size:${this._minDimension / 2}px`,
        'border: none',
        'outline: none',
        `padding:${this._minDimension / 4}px ${this._minDimension / 4}px`,
        'box-sizing:border-box',
        'user-select:text'
      ].join(';');
    }

    // Input filtering: only allow -, digits, optional decimal
    setInputFilter(this.element, v => /^-?\d*\.?\d*$/.test(v));

    // Init state & render
    this.actual = 0;
    this.hasMoved = false;
    this.clicked = false;
    this.element.value = prune(this._value.value, this.decimalPlaces);

    // Events
    this._bind();
  }

  /* -------------------------------------------------------
     Public API (similar to NexusUI Number)
  ------------------------------------------------------- */
  on(name: string, fn: (v: number) => void) { this._em.on(name, fn); return () => this._em.off(name, fn); }
  emit(name: string, data: number) { this._em.emit(name, data); }

  get value(): number { return this._value.value; }
  set value(v: number) {
    this._value.update(v);
    this.emit('change', this._value.value);
    this._render();
  }

  get min(): number { return this._value.min; }
  set min(v: number) { this._value.min = v; this._render(); }

  get max(): number { return this._value.max; }
  set max(v: number) { this._value.max = v; this._render(); }

  get step(): number { return this._value.step; }
  set step(v: number) { this._value.step = v; this._render(); }

  passiveUpdate(v: number) { this._value.update(v); this._render(); }

  // Connect to another control that exposes min/max/step and emits change
  link(destination: { min: number; max: number; step: number; value: number; on?: (name: string, fn: (v: number) => void) => any }) {
    this.min = destination.min;
    this.max = destination.max;
    this.step = destination.step;

    if (typeof destination.on === 'function') {
      destination.on('change', v => this.passiveUpdate(v));
    }

    this.on('change', v => {
      if ('value' in destination) {destination.value = v;}
    });

    this.value = destination.value;
  }

  /* -------------------------------------------------------
     Private methods
  ------------------------------------------------------- */
  _bind() {
    // Blur commits value
    this.element.addEventListener('blur', () => {
      if (this.settings.useAppStyling) {
        this.element.style.backgroundColor = 'var(--c-surface)';
        this.element.style.color = 'var(--c-text)';
      } else {
        this.element.style.backgroundColor = this.colors.fill;
        this.element.style.color = this.colors.dark;
      }
      const parsed = parseFloat(this.element.value);
      if (!Number.isNaN(parsed) && parsed !== this.value) {
        this.value = parsed;
      } else {
        this._render(); // snap back formatting
      }
    });

    // Enter commits value
    this.element.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        this.element.blur();
        const parsed = parseFloat(this.element.value);
        if (!Number.isNaN(parsed)) {this.value = parsed;}
      }
    }, true);

    // Drag-to-adjust
    this.element.addEventListener('mousedown', (e) => this._onMouseDown(e));
    // Prevent text selection while dragging
    this.element.addEventListener('dragstart', e => e.preventDefault());
  }

  _onMouseDown(e: MouseEvent) {
    this.hasMoved = false;
    this.clicked = true;
    this.element.readOnly = true;
    this.actual = this.value;
    this._start = { y: e.clientY };

    const rect = this.element.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    this._changeFactor = invert(relX); // more sensitivity on the left side, like Nexus

    const mm = (ev: MouseEvent) => this._onMouseMove(ev);
    const mu = () => this._onMouseUp(mm, mu);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
  }

  _onMouseMove(e: MouseEvent) {
    if (!this.clicked) {return;}
    this.hasMoved = true;

    const dy = e.clientY - this._start.y;
    const range = clip(this.max - this.min, 0, 1000);
    const scale = (range / 200) * Math.pow(this._changeFactor, 2);
    const newValue = this.actual - dy * scale;

    this._value.update(newValue);
    this._render();
    if (this._value.changed) {this.emit('change', this._value.value);}
  }

  _onMouseUp(mm: (ev: MouseEvent) => void, mu: () => void) {
    this.clicked = false;
    window.removeEventListener('mousemove', mm);
    window.removeEventListener('mouseup', mu);

    if (!this.hasMoved) {
      // Focus-to-edit mode
      this.element.readOnly = false;
      this.element.focus();
      this.element.setSelectionRange(0, this.element.value.length);
      if (this.settings.useAppStyling) {
        this.element.style.backgroundColor = 'var(--c-accent)';
        this.element.style.color = 'var(--c-surface)';
      } else {
        this.element.style.backgroundColor = this.colors.accent;
        this.element.style.color = this.colors.light;
      }
    } else {
      // remove focus to avoid accidental typing
      document.body.focus();
    }
  }

  _render() {
    this.element.value = prune(this._value.value, this.decimalPlaces);
  }
}

/* -------------------------------------------------------
   Small helpers (internal)
------------------------------------------------------- */
class Step {
  min: number;
  max: number;
  step: number;
  private _value: number;
  changed: boolean;

  constructor(min: number, max: number, step: number, value: number) {
    this.min = Number(min);
    this.max = Number(max);
    this.step = Number(step) || 1;
    this._value = 0;
    this.changed = false;
    this.update(value);
  }
  get value(): number { return this._value; }
  update(v: number) {
    const clamped = clip(Number(v), this.min, this.max);
    const stepped = this._stepTo(clamped);
    const prev = this._value;
    this._value = stepped;
    this.changed = stepped !== prev;
  }
  _stepTo(v: number) {
    if (!isFinite(this.step) || this.step <= 0) {return v;}
    const n = Math.round((v - this.min) / this.step);
    return this.min + n * this.step;
  }
}

class Emitter {
  private _m: Map<string, ((data: number) => void)[]>;

  constructor() { this._m = new Map(); }
  on(name: string, fn: (data: number) => void) {
    const arr = this._m.get(name) || [];
    arr.push(fn);
    this._m.set(name, arr);
  }
  off(name: string, fn: (data: number) => void) {
    const arr = this._m.get(name); if (!arr) {return;}
    const i = arr.indexOf(fn); if (i >= 0) {arr.splice(i, 1);}
  }
  emit(name: string, data: number) {
    const arr = this._m.get(name); if (!arr) {return;}
    for (const fn of arr.slice()) {fn(data);}
  }
}

function clip(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function invert(t: number) { return 1 - clip(t, 0, 1); }
function prune(v: number, decimals = 2) {
  if (!isFinite(v)) {return '';}
  const s = Number(v).toFixed(Math.max(0, decimals));
  // strip trailing zeros without losing the single leading zero before decimal
  return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function setInputFilter(textbox: HTMLInputElement, inputFilter: (value: string) => boolean) {
  let last = textbox.value;
  textbox.addEventListener('input', () => {
    if (inputFilter(textbox.value)) {
      last = textbox.value;
    } else {
      textbox.value = last;
    }
  });
}
