// =============================================
// SensorScope — Real-time Graph (Canvas)
// =============================================

export class RealtimeGraph {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} options
   * @param {Array<{key:string, label:string, color:string}>} options.lines
   * @param {number} [options.timeWindow=10] - seconds to display
   * @param {boolean} [options.showGrid=true]
   * @param {boolean} [options.autoScale=true]
   * @param {number} [options.minY=-20]
   * @param {number} [options.maxY=20]
   * @param {string} [options.unit='']
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lines = options.lines || [];
    this.timeWindow = options.timeWindow || 10; // seconds
    this.showGrid = options.showGrid !== false;
    this.autoScale = options.autoScale !== false;
    this.minY = options.minY ?? -20;
    this.maxY = options.maxY ?? 20;
    this.unit = options.unit || '';
    this.padding = { top: 8, right: 8, bottom: 22, left: 40 };

    // Data storage: ring buffer per line
    this._data = {};
    this._maxPoints = 2000;
    for (const line of this.lines) {
      this._data[line.key] = [];
    }

    this._animationId = null;
    this._running = false;

    this._setupCanvas();
  }

  _setupCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this._width = rect.width;
    this._height = rect.height;
  }

  resize() {
    this._setupCanvas();
  }

  /**
   * Add a data point
   * @param {number} timestamp - performance.now() value
   * @param {Object} values - { lineKey: value, ... }
   */
  addDataPoint(timestamp, values) {
    for (const line of this.lines) {
      const val = values[line.key];
      if (val !== undefined && val !== null) {
        const arr = this._data[line.key];
        arr.push({ t: timestamp, v: val });
        // Trim old data
        if (arr.length > this._maxPoints) {
          arr.splice(0, arr.length - this._maxPoints);
        }
      }
    }
  }

  /**
   * Clear all data
   */
  clearData() {
    for (const line of this.lines) {
      this._data[line.key] = [];
    }
  }

  /**
   * Start the rendering loop
   */
  startRendering() {
    if (this._running) return;
    this._running = true;
    const loop = () => {
      if (!this._running) return;
      this._draw();
      this._animationId = requestAnimationFrame(loop);
    };
    loop();
  }

  /**
   * Stop the rendering loop
   */
  stopRendering() {
    this._running = false;
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }

  setTimeWindow(seconds) {
    this.timeWindow = seconds;
  }

  setShowGrid(show) {
    this.showGrid = show;
  }

  /**
   * Get the current values (latest data point per line)
   */
  getCurrentValues() {
    const values = {};
    for (const line of this.lines) {
      const arr = this._data[line.key];
      values[line.key] = arr.length > 0 ? arr[arr.length - 1].v : null;
    }
    return values;
  }

  _draw() {
    const ctx = this.ctx;
    const w = this._width;
    const h = this._height;
    const p = this.padding;
    const plotW = w - p.left - p.right;
    const plotH = h - p.top - p.bottom;
    const now = performance.now();
    const windowMs = this.timeWindow * 1000;
    const tMin = now - windowMs;
    const tMax = now;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Auto scale
    let yMin = this.minY;
    let yMax = this.maxY;

    if (this.autoScale) {
      let dataMin = Infinity;
      let dataMax = -Infinity;
      for (const line of this.lines) {
        for (const pt of this._data[line.key]) {
          if (pt.t >= tMin && pt.t <= tMax) {
            if (pt.v < dataMin) dataMin = pt.v;
            if (pt.v > dataMax) dataMax = pt.v;
          }
        }
      }
      if (dataMin !== Infinity) {
        const range = dataMax - dataMin || 1;
        const margin = range * 0.15;
        yMin = dataMin - margin;
        yMax = dataMax + margin;
      }
    }

    // Draw grid
    if (this.showGrid) {
      this._drawGrid(ctx, p, plotW, plotH, tMin, tMax, yMin, yMax);
    }

    // Draw lines
    for (const line of this.lines) {
      this._drawLine(ctx, line, p, plotW, plotH, tMin, tMax, yMin, yMax);
    }
  }

  _drawGrid(ctx, p, plotW, plotH, tMin, tMax, yMin, yMax) {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.3)';
    ctx.font = '10px Inter, sans-serif';

    // Horizontal grid lines (Y axis)
    const ySteps = 5;
    const yRange = yMax - yMin;
    for (let i = 0; i <= ySteps; i++) {
      const val = yMin + (yRange * i) / ySteps;
      const y = p.top + plotH - (plotH * i) / ySteps;

      ctx.beginPath();
      ctx.moveTo(p.left, y);
      ctx.lineTo(p.left + plotW, y);
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(val.toFixed(1), p.left - 4, y);
    }

    // Vertical grid lines (Time axis)
    const tRange = tMax - tMin;
    const tSteps = Math.min(5, this.timeWindow);
    for (let i = 0; i <= tSteps; i++) {
      const x = p.left + (plotW * i) / tSteps;
      const t = tMin + (tRange * i) / tSteps;
      const secAgo = ((tMax - t) / 1000).toFixed(0);

      ctx.beginPath();
      ctx.moveTo(x, p.top);
      ctx.lineTo(x, p.top + plotH);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`-${secAgo}s`, x, p.top + plotH + 4);
    }
  }

  _drawLine(ctx, line, p, plotW, plotH, tMin, tMax, yMin, yMax) {
    const data = this._data[line.key];
    if (data.length < 2) return;

    const tRange = tMax - tMin;
    const yRange = yMax - yMin || 1;

    ctx.beginPath();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    let started = false;
    for (const pt of data) {
      if (pt.t < tMin || pt.t > tMax) continue;
      const x = p.left + ((pt.t - tMin) / tRange) * plotW;
      const y = p.top + plotH - ((pt.v - yMin) / yRange) * plotH;

      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Glow effect
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = 4;
    ctx.shadowColor = line.color;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  }
}
