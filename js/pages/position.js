// =============================================
// SensorScope — Position Tracker Page
// =============================================
// Uses sensor fusion (accelerometer + orientation) to estimate
// relative position via double integration with ZUPT filtering.
// Displays XY as radar plot and Z (height) as time-series graph.

import { formatNumber } from '../utils.js';

// --- Constants ---
const GRAVITY = 9.81;
const ACCEL_DEADZONE_XY = 0.4;        // m/s² — XY noise floor
const ACCEL_DEADZONE_Z = 0.6;         // m/s² — Z noise floor (higher, gravity residual)
const ZUPT_VELOCITY_THRESHOLD = 0.08; // m/s — below this + low accel => stationary
const ZUPT_ACCEL_THRESHOLD = 0.6;     // m/s² — used for stillness detection
const LP_ALPHA = 0.15;                // Low-pass filter (lower = smoother, more lag)
const VELOCITY_DAMPING = 0.97;        // Per-frame velocity decay (fights drift)
const TRAIL_MAX = 500;
const ACCEL_BUFFER_SIZE = 20;         // Samples for variance-based stillness detection
const CALIBRATION_SAMPLES = 50;       // Initial calibration period

export class PositionPage {
  constructor(app) {
    this.app = app;
    this._container = null;
    this._animId = null;

    // Position estimation state
    this._pos = { x: 0, y: 0, z: 0 };
    this._vel = { x: 0, y: 0, z: 0 };
    this._filteredAccel = { x: 0, y: 0, z: 0 };
    this._lastTimestamp = null;
    this._orientation = { alpha: 0, beta: 0, gamma: 0 };
    this._trail = [];
    this._heightHistory = [];
    this._startTime = 0;

    // Calibration & noise estimation
    this._accelBuffer = [];      // Recent world-frame accel magnitudes
    this._calibSamples = 0;
    this._accelBias = { x: 0, y: 0, z: 0 }; // Estimated bias
    this._calibrating = true;
    this._calibAccum = { x: 0, y: 0, z: 0 };

    // UI state
    this._scale = 5;
    this._radarCanvas = null;
    this._heightCanvas = null;
  }

  mount(container) {
    this._container = container;

    container.innerHTML = `
      <div class="position page">
        <div class="page-header">
          <h1 class="page-header__title">Position <span class="page-header__title-ja">位置推定</span></h1>
        </div>

        <div class="position__radar-wrap">
          <canvas class="position__radar" id="pos-radar"></canvas>
          <div class="position__coords">
            <span>X: <span id="pos-x" class="text-mono">0.00</span> m</span>
            <span>Y: <span id="pos-y" class="text-mono">0.00</span> m</span>
          </div>
        </div>

        <div class="position__height-wrap glass-card">
          <div class="position__height-header">
            <span class="card__title">Height 高さ</span>
            <span class="text-mono" style="color: var(--accent-green);" id="pos-z">0.00 m</span>
          </div>
          <canvas class="position__height" id="pos-height"></canvas>
        </div>

        <div class="position__controls">
          <div class="segment-control" id="pos-scale">
            <button class="segment-control__item" data-value="1">1 m</button>
            <button class="segment-control__item active" data-value="5">5 m</button>
            <button class="segment-control__item" data-value="10">10 m</button>
            <button class="segment-control__item" data-value="50">50 m</button>
          </div>
          <button class="btn btn--outline" id="pos-reset" style="margin-top: var(--space-sm);">
            ↻ リセット
          </button>
        </div>
      </div>
    `;

    this._radarCanvas = container.querySelector('#pos-radar');
    this._heightCanvas = container.querySelector('#pos-height');

    this._setupCanvases();
    this._reset();
    this._startSensors();
    this._startRendering();
    this._bindEvents();
  }

  // --- Canvas Setup ---

  _setupCanvases() {
    const dpr = window.devicePixelRatio || 1;

    // Radar: make it square, fitting width
    const radarWrap = this._radarCanvas.parentElement;
    const size = Math.min(radarWrap.clientWidth, 400);
    this._radarCanvas.style.width = size + 'px';
    this._radarCanvas.style.height = size + 'px';
    this._radarCanvas.width = size * dpr;
    this._radarCanvas.height = size * dpr;
    this._radarCtx = this._radarCanvas.getContext('2d');
    this._radarCtx.scale(dpr, dpr);
    this._radarSize = size;

    // Height graph
    const hRect = this._heightCanvas.getBoundingClientRect();
    this._heightCanvas.width = hRect.width * dpr;
    this._heightCanvas.height = hRect.height * dpr;
    this._heightCtx = this._heightCanvas.getContext('2d');
    this._heightCtx.scale(dpr, dpr);
    this._heightW = hRect.width;
    this._heightH = hRect.height;
  }

  // --- Reset ---

  _reset() {
    this._pos = { x: 0, y: 0, z: 0 };
    this._vel = { x: 0, y: 0, z: 0 };
    this._filteredAccel = { x: 0, y: 0, z: 0 };
    this._lastTimestamp = null;
    this._trail = [];
    this._heightHistory = [];
    this._startTime = performance.now();
    this._accelBuffer = [];
    this._calibSamples = 0;
    this._accelBias = { x: 0, y: 0, z: 0 };
    this._calibrating = true;
    this._calibAccum = { x: 0, y: 0, z: 0 };
  }

  // --- Sensor Fusion ---

  _startSensors() {
    const sm = this.app.sensorManager;

    // Orientation (for coordinate transform)
    sm.startOrientation((data) => {
      this._orientation = {
        alpha: (data.alpha || 0) * Math.PI / 180,
        beta: (data.beta || 0) * Math.PI / 180,
        gamma: (data.gamma || 0) * Math.PI / 180,
      };
    });

    // Motion (accelerometer)
    sm.startMotion((data) => {
      const now = data.timestamp;
      if (this._lastTimestamp === null) {
        this._lastTimestamp = now;
        return;
      }

      const dt = (now - this._lastTimestamp) / 1000;
      this._lastTimestamp = now;
      if (dt <= 0 || dt > 0.5) return;

      // Use accelerationIncludingGravity and manually subtract gravity.
      // This is more reliable than device-provided gravity-free acceleration.
      const rawAx = data.accelerationIncludingGravity.x ?? 0;
      const rawAy = data.accelerationIncludingGravity.y ?? 0;
      const rawAz = data.accelerationIncludingGravity.z ?? 0;

      // Transform raw acceleration to world frame
      const worldRaw = this._deviceToWorld(rawAx, rawAy, rawAz);

      // Subtract gravity (world Z-up = +9.81)
      const worldAccel = {
        x: worldRaw.x,
        y: worldRaw.y,
        z: worldRaw.z - GRAVITY,
      };

      // --- Calibration phase: estimate sensor bias while stationary ---
      if (this._calibrating) {
        this._calibAccum.x += worldAccel.x;
        this._calibAccum.y += worldAccel.y;
        this._calibAccum.z += worldAccel.z;
        this._calibSamples++;
        if (this._calibSamples >= CALIBRATION_SAMPLES) {
          this._accelBias.x = this._calibAccum.x / this._calibSamples;
          this._accelBias.y = this._calibAccum.y / this._calibSamples;
          this._accelBias.z = this._calibAccum.z / this._calibSamples;
          this._calibrating = false;
        }
        return; // Don't integrate during calibration
      }

      // Subtract estimated bias
      const corrected = {
        x: worldAccel.x - this._accelBias.x,
        y: worldAccel.y - this._accelBias.y,
        z: worldAccel.z - this._accelBias.z,
      };

      // Low-pass filter
      this._filteredAccel.x = LP_ALPHA * corrected.x + (1 - LP_ALPHA) * this._filteredAccel.x;
      this._filteredAccel.y = LP_ALPHA * corrected.y + (1 - LP_ALPHA) * this._filteredAccel.y;
      this._filteredAccel.z = LP_ALPHA * corrected.z + (1 - LP_ALPHA) * this._filteredAccel.z;

      const fa = this._filteredAccel;

      // Per-axis dead zone (ignore noise-level accelerations)
      const effX = Math.abs(fa.x) > ACCEL_DEADZONE_XY ? fa.x : 0;
      const effY = Math.abs(fa.y) > ACCEL_DEADZONE_XY ? fa.y : 0;
      const effZ = Math.abs(fa.z) > ACCEL_DEADZONE_Z ? fa.z : 0;

      // Track acceleration magnitude for stillness detection
      const aMag = Math.sqrt(fa.x * fa.x + fa.y * fa.y + fa.z * fa.z);
      this._accelBuffer.push(aMag);
      if (this._accelBuffer.length > ACCEL_BUFFER_SIZE) this._accelBuffer.shift();

      // Variance-based stillness detection
      const isStill = this._detectStillness();

      // Integrate acceleration → velocity
      this._vel.x += effX * dt;
      this._vel.y += effY * dt;
      this._vel.z += effZ * dt;

      // Continuous velocity damping (fights unbounded drift)
      this._vel.x *= VELOCITY_DAMPING;
      this._vel.y *= VELOCITY_DAMPING;
      this._vel.z *= VELOCITY_DAMPING;

      // ZUPT: aggressively zero velocity when stationary
      const vMag = Math.sqrt(this._vel.x ** 2 + this._vel.y ** 2 + this._vel.z ** 2);
      if (isStill || (vMag < ZUPT_VELOCITY_THRESHOLD && aMag < ZUPT_ACCEL_THRESHOLD)) {
        this._vel.x = 0;
        this._vel.y = 0;
        this._vel.z = 0;
      }

      // Integrate velocity → position
      this._pos.x += this._vel.x * dt;
      this._pos.y += this._vel.y * dt;
      this._pos.z += this._vel.z * dt;

      // Record trail
      const lastTrail = this._trail[this._trail.length - 1];
      if (!lastTrail || (now - lastTrail.t) > 50) {
        this._trail.push({ x: this._pos.x, y: this._pos.y, t: now });
        if (this._trail.length > TRAIL_MAX) this._trail.shift();
      }

      // Record height
      this._heightHistory.push({ t: now, z: this._pos.z });
      if (this._heightHistory.length > TRAIL_MAX) this._heightHistory.shift();
    });
  }

  /**
   * Detect if the device is still using variance of recent
   * acceleration magnitudes.
   */
  _detectStillness() {
    if (this._accelBuffer.length < ACCEL_BUFFER_SIZE) return false;
    const mean = this._accelBuffer.reduce((s, v) => s + v, 0) / this._accelBuffer.length;
    const variance = this._accelBuffer.reduce((s, v) => s + (v - mean) ** 2, 0) / this._accelBuffer.length;
    return variance < 0.1 && mean < ZUPT_ACCEL_THRESHOLD;
  }

  /**
   * Transform device-frame vector to world frame.
   * R = Rz(alpha) * Rx(beta) * Ry(gamma) — ZXY convention
   * per W3C DeviceOrientation spec.
   */
  _deviceToWorld(ax, ay, az) {
    const { alpha, beta, gamma } = this._orientation;

    const sa = Math.sin(alpha), ca = Math.cos(alpha);
    const sb = Math.sin(beta),  cb = Math.cos(beta);
    const sg = Math.sin(gamma), cg = Math.cos(gamma);

    // Correct ZXY rotation matrix:
    // Row 0: [ca·cg - sa·sb·sg,  -sa·cb,  ca·sg + sa·sb·cg]
    // Row 1: [sa·cg + ca·sb·sg,   ca·cb,  sa·sg - ca·sb·cg]
    // Row 2: [-cb·sg,              sb,     cb·cg           ]
    const wx = ax * (ca * cg - sa * sb * sg) + ay * (-sa * cb) + az * (ca * sg + sa * sb * cg);
    const wy = ax * (sa * cg + ca * sb * sg) + ay * (ca * cb)  + az * (sa * sg - ca * sb * cg);
    const wz = ax * (-cb * sg)               + ay * sb         + az * (cb * cg);

    return { x: wx, y: wy, z: wz };
  }

  // --- Rendering ---

  _startRendering() {
    const loop = () => {
      this._drawRadar();
      this._drawHeight();
      this._updateReadouts();
      this._animId = requestAnimationFrame(loop);
    };
    loop();
  }

  _drawRadar() {
    const ctx = this._radarCtx;
    const s = this._radarSize;
    const cx = s / 2;
    const cy = s / 2;
    const r = s / 2 - 16; // usable radius
    const scale = this._scale; // metres per radius

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    ctx.clearRect(0, 0, s, s);

    // --- Background ---
    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // --- Grid circles ---
    const gridColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
    const textColor = isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.25)';
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    const rings = 4;
    for (let i = 1; i <= rings; i++) {
      const rr = (r * i) / rings;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.stroke();

      // Scale label
      const label = ((scale * i) / rings).toFixed(1) + 'm';
      ctx.fillStyle = textColor;
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, cx + 3, cy - rr - 2);
    }

    // --- Crosshair ---
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();

    // --- Compass labels ---
    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - r - 8);
    ctx.fillText('S', cx, cy + r + 10);
    ctx.fillText('E', cx + r + 10, cy);
    ctx.fillText('W', cx - r - 10, cy);

    // --- Trail ---
    if (this._trail.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = isLight ? 'rgba(51, 154, 240, 0.3)' : 'rgba(51, 154, 240, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';

      for (let i = 0; i < this._trail.length; i++) {
        const pt = this._trail[i];
        const px = cx + (pt.x / scale) * r;
        const py = cy - (pt.y / scale) * r; // Y up = screen up
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // --- Current position dot ---
    const dotX = cx + (this._pos.x / scale) * r;
    const dotY = cy - (this._pos.y / scale) * r;

    // Glow
    ctx.beginPath();
    ctx.arc(dotX, dotY, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(51, 154, 240, 0.2)';
    ctx.fill();

    // Dot
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#339af0';
    ctx.fill();

    // Origin cross
    ctx.strokeStyle = isLight ? 'rgba(255, 71, 87, 0.4)' : 'rgba(255, 71, 87, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy);
    ctx.lineTo(cx + 4, cy);
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx, cy + 4);
    ctx.stroke();
  }

  _drawHeight() {
    const ctx = this._heightCtx;
    const w = this._heightW;
    const h = this._heightH;
    const data = this._heightHistory;

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    ctx.clearRect(0, 0, w, h);

    if (data.length < 2) return;

    // Determine Y range
    let minZ = Infinity, maxZ = -Infinity;
    for (const pt of data) {
      if (pt.z < minZ) minZ = pt.z;
      if (pt.z > maxZ) maxZ = pt.z;
    }
    const range = Math.max(maxZ - minZ, 0.5);
    const margin = range * 0.2;
    minZ -= margin;
    maxZ += margin;

    const tMin = data[0].t;
    const tMax = data[data.length - 1].t;
    const tRange = Math.max(tMax - tMin, 1);

    const pad = { left: 36, right: 8, top: 8, bottom: 20 };
    const pw = w - pad.left - pad.right;
    const ph = h - pad.top - pad.bottom;

    // Grid
    ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.3)';
    ctx.font = '9px Inter, sans-serif';
    ctx.lineWidth = 1;

    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const val = minZ + ((maxZ - minZ) * i) / ySteps;
      const y = pad.top + ph - (ph * i) / ySteps;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + pw, y);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(val.toFixed(1), pad.left - 4, y);
    }

    // Zero line
    const zeroY = pad.top + ph - ((0 - minZ) / (maxZ - minZ)) * ph;
    if (zeroY > pad.top && zeroY < pad.top + ph) {
      ctx.strokeStyle = isLight ? 'rgba(255,71,87,0.2)' : 'rgba(255,71,87,0.15)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.left, zeroY);
      ctx.lineTo(pad.left + pw, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#51cf66';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    for (let i = 0; i < data.length; i++) {
      const pt = data[i];
      const x = pad.left + ((pt.t - tMin) / tRange) * pw;
      const y = pad.top + ph - ((pt.z - minZ) / (maxZ - minZ)) * ph;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Glow
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = 5;
    ctx.shadowColor = '#51cf66';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  }

  _updateReadouts() {
    const xEl = this._container.querySelector('#pos-x');
    const yEl = this._container.querySelector('#pos-y');
    const zEl = this._container.querySelector('#pos-z');
    if (xEl) xEl.textContent = formatNumber(this._pos.x, 2);
    if (yEl) yEl.textContent = formatNumber(this._pos.y, 2);
    if (zEl) zEl.textContent = formatNumber(this._pos.z, 2) + ' m';
  }

  // --- Events ---

  _bindEvents() {
    // Scale selector
    this._container.querySelector('#pos-scale').addEventListener('click', (e) => {
      const btn = e.target.closest('.segment-control__item');
      if (!btn) return;
      this._scale = parseFloat(btn.dataset.value);
      this._container.querySelectorAll('#pos-scale .segment-control__item')
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });

    // Reset
    this._container.querySelector('#pos-reset').addEventListener('click', () => {
      this._reset();
    });
  }

  unmount() {
    if (this._animId) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
    this.app.sensorManager.stopMotion();
    this.app.sensorManager.stopOrientation();
  }
}
