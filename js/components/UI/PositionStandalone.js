// PositionStandalone.js
// A single-file, dependency-free reimplementation of NexusUI's "Position" widget.
//
// ───────────────────────────────────────────────────────────────────────────────
// HOW TO USE (Student Notation quick-start):
// 1) Import and create it:
//      import Position from './PositionStandalone.js';
//      const pos = new Position('#target', { size:[200,200], mode:'absolute' });
// 2) Listen for value changes (THIS IS THE OUTPUT YOU WANT):
//      pos.on('change', ({ x, y }) => {
//        // x and y are the current values in your configured ranges
//        // e.g., dispatch to your store or trigger audio/graphics updates
//      });
// 3) Optional: set initial values or constraints at runtime:
//      pos.x = 0.75; pos.y = 0.25; pos.minX = 0; pos.maxX = 1; pos.stepX = 0.01;
// 4) Optional: resize/destroy when your layout changes:
//      pos.resize(320, 240);  pos.destroy();
//
// OUTPUT NAMES (what your app reads):
//    - Event payload: { x, y }  // real values in [minX..maxX], [minY..maxY]
//    - Also available: pos.normalized => { x, y } in [0..1]
//
// WHAT'S NECESSARY VS OPTIONAL:
//    ✅ Necessary for function: Section A (core), Section B (public API), the SVG <svg>/<circle>.
//    🎨 Pure styling (optional/replaceable): color fields + _draw() cosmetics in Section C.
//    🧹 Omittable once integrated: colorize(), grid lines, text label. Keep only the knob/crosshair if you like.
// ───────────────────────────────────────────────────────────────────────────────

export default class Position {
  // ────────────────────────────────────────────────────────────────────────────
  // B) PUBLIC API (constructor signature mirrors NexusUI Position)
  //    new Position(target, {
  //      size: [w,h], mode: 'absolute'|'relative',
  //      x, minX, maxX, stepX,
  //      y, minY, maxY, stepY
  //    })
  // ────────────────────────────────────────────────────────────────────────────
  constructor(target, opts = {}) {
    // Resolve target element (selector or node)
    this._root = typeof target === 'string' ? document.querySelector(target) : target;
    if (!this._root) throw new Error('Position: target not found');

    // Defaults
    const {
      size = [200, 200],
      mode = 'absolute',      // "absolute" | "relative"
      x = 0.5,  minX = 0, maxX = 1, stepX = 0,
      y = 0.5,  minY = 0, maxY = 1, stepY = 0
    } = opts;

    // ──────────────────────────────────────────────────────────────────────────
    // A) REQUIRED CORE — tiny event emitter + value/interaction helpers
    // ──────────────────────────────────────────────────────────────────────────
    this._events = new Map();           // event emitter
    this._emit = (t, v) => { const s = this._events.get(t); if (s) for (const f of s) f(v); };

    // Step: clamps + quantizes a value in [min..max] with an optional step
    class Step {
      constructor(min, max, step, value) {
        this.min = min; this.max = max; this.step = step; this.value = 0;
        this.update(value);
      }
      update(v) {
        const clipped = Math.min(this.max, Math.max(this.min, v));
        if (!this.step || this.step <= 0) { this.value = clipped; return this.value; }
        const q = Math.round((clipped - this.min) / this.step) * this.step + this.min;
        this.value = Math.min(this.max, Math.max(this.min, parseFloat(q.toFixed(12))));
        return this.value;
      }
      updateNormal(n) { // n in [0..1]
        const span = (this.max - this.min) || 1;
        return this.update(this.min + span * Math.min(1, Math.max(0, n)));
      }
      get normalized() {
        const span = (this.max - this.min) || 1;
        return (this.value - this.min) / span;
      }
    }

    // Handle: maps pointer to normalized 0..1 values, absolute or relative
    class Handle {
      constructor(mode, orientation, xRange, yRange) {
        this.mode = mode;
        this.orient = orientation;       // 'horizontal' | 'vertical'
        this._xr = xRange.slice();       // [minXpx, maxXpx]
        this._yr = yRange.slice();       // [maxYpx, minYpx] (note vertical inversion)
        this.value = 0.5;                // normalized
        this._anchorN = 0.5;             // anchor normalized (for relative)
      }
      resize(xRange, yRange) { this._xr = xRange.slice(); this._yr = yRange.slice(); }
      set anchor(mouse) { this._anchorN = this._posToNorm(mouse); }
      update(mouse) {
        if (this.mode === 'absolute') {
          this.value = this._posToNorm(mouse);
        } else {
          const cur = this._posToNorm(mouse);
          const inc = cur - this._anchorN; // wrap not needed for linear axes
          this.value = clamp01(this.value + inc);
          this._anchorN = cur;
        }
        this.value = clamp01(this.value);
      }
      _posToNorm(m) {
        if (this.orient === 'horizontal') {
          const span = (this._xr[1] - this._xr[0]) || 1;
          return clamp01((m.x - this._xr[0]) / span);
        } else {
          // For vertical: top = max value, bottom = min value (intuitive behavior)
          const span = (this._yr[1] - this._yr[0]) || 1;
          return clamp01(1 - (m.y - this._yr[0]) / span); // Invert y for intuitive top=high behavior
        }
      }
    }

    const clamp01 = v => Math.min(1, Math.max(0, v));

    // ──────────────────────────────────────────────────────────────────────────
    // Internal numerical state (Step objects hold the real values)
    // ──────────────────────────────────────────────────────────────────────────
    this._x = new Step(minX, maxX, stepX, x);
    this._y = new Step(minY, maxY, stepY, y);

    // Canvas/SVG sizing
    this._w = Math.max(10, Math.floor(size[0]));
    this._h = Math.max(10, Math.floor(size[1]));

    // Interaction mode + handles (normalized 0..1)
    this._mode = (mode === 'relative') ? 'relative' : 'absolute';
    this._hX = new Handle(this._mode, 'horizontal', [0, this._w], [0, this._h]);
    this._hY = new Handle(this._mode, 'vertical',   [0, this._w], [0, this._h]);
    this._hX.value = this._x.normalized;
    this._hY.value = this._y.normalized;

    // ────────────────────────────────────────────────────────────────────────────
    // C) STYLING (Student Notation theme defaults)
    // ────────────────────────────────────────────────────────────────────────────
    this._style = {
      bg: 'rgba(74, 144, 226, 0.1)',  // Light blue background (default to blue shape note)
      grid: '#dee2e6',                // Light gray grid lines
      cross: '#6c757d',               // Medium gray crosshairs
      handle: '#4A90E2',              // Blue knob/handle (matches blue shape note)
      text: '#212529'                 // Dark text
    };

    // ────────────────────────────────────────────────────────────────────────────────────────────
    this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svg.setAttribute('width',  this._w);
    this._svg.setAttribute('height', this._h);
    this._svg.setAttribute('viewBox', `0 0 ${this._w} ${this._h}`);
    this._svg.style.display = 'block';
    this._svg.style.touchAction = 'none'; // prevent scroll on touch
    this._root.innerHTML = '';
    this._root.appendChild(this._svg);

    // (Optional) background rect + grid; remove if you prefer a plain canvas
    this._bg = document.createElementNS(this._svg.namespaceURI, 'rect');
    this._bg.setAttribute('x', 0); this._bg.setAttribute('y', 0);
    this._bg.setAttribute('width', this._w); this._bg.setAttribute('height', this._h);
    this._bg.setAttribute('fill', this._style.bg);
    this._svg.appendChild(this._bg);

    this._grid = document.createElementNS(this._svg.namespaceURI, 'g');
    this._grid.setAttribute('stroke', this._style.grid);
    this._grid.setAttribute('stroke-width', '1');
    const qv = [0.25, 0.5, 0.75];
    for (const q of qv) {
      const vx = document.createElementNS(this._svg.namespaceURI, 'line');
      vx.setAttribute('x1', this._w * q); vx.setAttribute('y1', 0);
      vx.setAttribute('x2', this._w * q); vx.setAttribute('y2', this._h);
      this._grid.appendChild(vx);
      const vy = document.createElementNS(this._svg.namespaceURI, 'line');
      vy.setAttribute('x1', 0); vy.setAttribute('y1', this._h * q);
      vy.setAttribute('x2', this._w); vy.setAttribute('y2', this._h * q);
      this._grid.appendChild(vy);
    }
    this._svg.appendChild(this._grid);

    // Crosshair lines (optional but helpful)
    this._xh = document.createElementNS(this._svg.namespaceURI, 'line'); // vertical
    this._yh = document.createElementNS(this._svg.namespaceURI, 'line'); // horizontal
    for (const l of [this._xh, this._yh]) {
      l.setAttribute('stroke', this._style.cross);
      l.setAttribute('stroke-width', '2');
      this._svg.appendChild(l);
    }

    // The handle (required for default visuals)
    this._knob = document.createElementNS(this._svg.namespaceURI, 'circle');
    this._knob.setAttribute('r', Math.max(4, Math.min(this._w, this._h) * 0.04));
    this._knob.setAttribute('fill', this._style.handle);
    this._svg.appendChild(this._knob);

    // (Optional) value label for debugging; remove in production
    // this._label = document.createElementNS(this._svg.namespaceURI, 'text');
    // this._label.setAttribute('x', 6);
    // this._label.setAttribute('y', 16);
    // this._label.setAttribute('fill', this._style.text);
    // this._label.setAttribute('font-size', '10');
    // this._label.setAttribute('font-family', 'system-ui, sans-serif');
    // this._svg.appendChild(this._label);

    // Pointer interaction
    this._clicked = false;
    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp   = this._onUp.bind(this);
    this._svg.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);

    // Initial draw
    this._draw();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // B) PUBLIC API — EVENTS
  //    change: { x, y } (real values in your configured ranges)
  // ────────────────────────────────────────────────────────────────────────────
  on(type, fn) {
    if (!this._events.has(type)) this._events.set(type, new Set());
    this._events.get(type).add(fn);
    return () => this.off(type, fn);
  }
  off(type, fn) {
    const set = this._events.get(type);
    if (set) set.delete(fn);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // B) PUBLIC API — PROPERTIES (match Nexus names; setters clamp/step + emit)
  // ────────────────────────────────────────────────────────────────────────────
  get x() { return this._x.value; }
  set x(v) {
    const prev = this._x.value;
    this._x.update(v);
    this._hX.value = this._x.normalized;
    if (this._x.value !== prev) { this._emit('change', { x: this._x.value, y: this._y.value }); this._draw(); }
  }

  get y() { return this._y.value; }
  set y(v) {
    const prev = this._y.value;
    this._y.update(v);
    this._hY.value = this._y.normalized;
    if (this._y.value !== prev) { this._emit('change', { x: this._x.value, y: this._y.value }); this._draw(); }
  }

  get minX() { return this._x.min; }  set minX(v) { this._x.min = v; this.x = this._x.value; }
  get maxX() { return this._x.max; }  set maxX(v) { this._x.max = v; this.x = this._x.value; }
  get stepX(){ return this._x.step;}  set stepX(v){ this._x.step = v; this.x = this._x.value; }

  get minY() { return this._y.min; }  set minY(v) { this._y.min = v; this.y = this._y.value; }
  get maxY() { return this._y.max; }  set maxY(v) { this._y.max = v; this.y = this._y.value; }
  get stepY(){ return this._y.step;}  set stepY(v){ this._y.step = v; this.y = this._y.value; }

  // Absolute jumps to pointer; Relative adds deltas
  get mode() { return this._mode; }
  set mode(v) {
    this._mode = (v === 'relative') ? 'relative' : 'absolute';
    this._hX.mode = this._mode;
    this._hY.mode = this._mode;
  }

  // Normalized values (read-only): { x:0..1, y:0..1 }
  get normalized() { return { x: this._x.normalized, y: this._y.normalized }; }

  // ────────────────────────────────────────────────────────────────────────────
  // B) PUBLIC API — METHODS
  // ────────────────────────────────────────────────────────────────────────────
  resize(width, height) {
    this._w = Math.max(10, Math.floor(width));
    this._h = Math.max(10, Math.floor(height));
    this._svg.setAttribute('width',  this._w);
    this._svg.setAttribute('height', this._h);
    this._svg.setAttribute('viewBox', `0 0 ${this._w} ${this._h}`);

    // Update ranges for handles
    this._hX.resize([0, this._w], [0, this._h]);
    this._hY.resize([0, this._w], [0, this._h]);

    // Resize background + grid lines
    this._bg.setAttribute('width', this._w);
    this._bg.setAttribute('height', this._h);
    // Rebuild grid lines
    while (this._grid.firstChild) this._grid.removeChild(this._grid.firstChild);
    const qv = [0.25, 0.5, 0.75];
    for (const q of qv) {
      const vx = document.createElementNS(this._svg.namespaceURI, 'line');
      vx.setAttribute('x1', this._w * q); vx.setAttribute('y1', 0);
      vx.setAttribute('x2', this._w * q); vx.setAttribute('y2', this._h);
      this._grid.appendChild(vx);
      const vy = document.createElementNS(this._svg.namespaceURI, 'line');
      vy.setAttribute('x1', 0); vy.setAttribute('y1', this._h * q);
      vy.setAttribute('x2', this._w); vy.setAttribute('y2', this._h * q);
      this._grid.appendChild(vy);
    }

    // Redraw everything
    this._draw();
  }

  destroy() {
    this._svg.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onUp);
    window.removeEventListener('pointermove', this._onMove);
    if (this._root && this._root.contains(this._svg)) this._root.removeChild(this._svg);
    this._events.clear();
  }

  // 🎨 Optional styling hook
  colorize(map) {
    // map: { bg?, grid?, cross?, handle?, text? }
    Object.assign(this._style, map || {});
    this._bg.setAttribute('fill', this._style.bg);
    this._xh.setAttribute('stroke', this._style.cross);
    this._yh.setAttribute('stroke', this._style.cross);
    this._knob.setAttribute('fill', this._style.handle);
    if (this._label) this._label.setAttribute('fill', this._style.text);
    this._grid.setAttribute('stroke', this._style.grid);
    this._draw();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Required pointer plumbing
  // ────────────────────────────────────────────────────────────────────────────
  _localPoint(evt) {
    const r = this._svg.getBoundingClientRect();
    return { x: evt.clientX - r.left, y: evt.clientY - r.top };
  }
  _onDown(e) {
    this._svg.setPointerCapture?.(e.pointerId);
    this._clicked = true;
    const m = this._localPoint(e);
    // Absolute: jump immediately; Relative: set anchors then wait for move
    if (this._mode === 'absolute') {
      this._hX.update(m);
      this._hY.update(m);
      this._batchSetFromHandles(); // emits + draws if changed
    } else {
      this._hX.anchor = m;
      this._hY.anchor = m;
    }
    window.addEventListener('pointermove', this._onMove, { passive: false });
    // Emit 'down' event for interaction tracking
    this._emit('down', { x: this._x.value, y: this._y.value });
    e.preventDefault();
  }
  _onMove(e) {
    if (!this._clicked) return;
    const m = this._localPoint(e);
    this._hX.update(m);
    this._hY.update(m);
    this._batchSetFromHandles(); // emits + draws if changed
    e.preventDefault();
  }
  _onUp() {
    if (!this._clicked) return;
    this._clicked = false;
    window.removeEventListener('pointermove', this._onMove);
    // Emit 'up' event for interaction tracking
    this._emit('up', { x: this._x.value, y: this._y.value });
  }

  // Apply both axes at once (single emit + draw)
  _batchSetFromHandles() {
    const nx = this._hX.value, ny = this._hY.value;
    const vx = this._x.updateNormal(nx);
    const vy = this._y.updateNormal(ny);
    // Redundancy guard: only emit if either axis changed
    if (vx !== undefined || vy !== undefined) {
      this._emit('change', { x: this._x.value, y: this._y.value });
    }
    this._draw();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // C) STYLING & DRAWING (you can simplify/remove most of this if you prefer)
  // ────────────────────────────────────────────────────────────────────────────
  _draw() {
    // Crosshair positions
    const px = (this._w - 1) * this._x.normalized;
    const py = (this._h - 1) * (1 - this._y.normalized); // invert y for screen coords

    // Crosshair
    this._xh.setAttribute('x1', px); this._xh.setAttribute('y1', 0);
    this._xh.setAttribute('x2', px); this._xh.setAttribute('y2', this._h);
    this._yh.setAttribute('x1', 0);  this._yh.setAttribute('y1', py);
    this._yh.setAttribute('x2', this._w); this._yh.setAttribute('y2', py);

    // Knob
    this._knob.setAttribute('cx', px);
    this._knob.setAttribute('cy', py);

    // Label (optional; comment out to remove)
    // this._label.textContent = `x: ${this._x.value.toFixed(2)}  y: ${this._y.value.toFixed(2)}`;
  }
}
// End of PositionStandalone.js