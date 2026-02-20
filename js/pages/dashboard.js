// =============================================
// SensorScope — Dashboard Page
// =============================================

import { RealtimeGraph } from '../graph.js';
import { formatNumber, formatDuration } from '../utils.js';

export class DashboardPage {
  constructor(app) {
    this.app = app;
    this.graphs = {};
    this._container = null;
    this._recordingTimerInterval = null;
  }

  mount(container) {
    this._container = container;
    const isRecording = this.app.recorder.isRecording;

    container.innerHTML = `
      <div class="dashboard page">
        <div class="dashboard__header">
          <span class="dashboard__logo">SensorScope</span>
          <div id="dashboard-status" class="dashboard__status">
            <span class="dashboard__status-dot"></span>
            <span>Active</span>
          </div>
        </div>

        <div class="dashboard__cards">
          <!-- Acceleration Card -->
          <div class="card" data-sensor="acceleration" id="card-accel">
            <div class="card__header">
              <svg class="card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              <span class="card__title">Acceleration</span>
            </div>
            <canvas class="card__chart" id="chart-accel"></canvas>
            <div class="card__values">
              <span class="card__value"><span class="card__value-dot" style="background:var(--color-x)"></span>X: <span id="val-accel-x">—</span></span>
              <span class="card__value"><span class="card__value-dot" style="background:var(--color-y)"></span>Y: <span id="val-accel-y">—</span></span>
              <span class="card__value"><span class="card__value-dot" style="background:var(--color-z)"></span>Z: <span id="val-accel-z">—</span></span>
            </div>
          </div>

          <!-- Rotation Rate Card -->
          <div class="card" data-sensor="rotationRate" id="card-gyro">
            <div class="card__header">
              <svg class="card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.5 2v6h-6M2.5 22v-6h6"/>
                <path d="M2.5 15.5A10 10 0 0 1 21.5 8.5"/>
                <path d="M21.5 8.5A10 10 0 0 1 2.5 15.5"/>
              </svg>
              <span class="card__title">Rotation Rate</span>
            </div>
            <canvas class="card__chart" id="chart-gyro"></canvas>
            <div class="card__values">
              <span class="card__value"><span class="card__value-dot" style="background:var(--color-alpha)"></span>α: <span id="val-rot-alpha">—</span></span>
              <span class="card__value"><span class="card__value-dot" style="background:var(--color-beta)"></span>β: <span id="val-rot-beta">—</span></span>
              <span class="card__value"><span class="card__value-dot" style="background:var(--color-gamma)"></span>γ: <span id="val-rot-gamma">—</span></span>
            </div>
          </div>

          <!-- Orientation Card -->
          <div class="card" data-sensor="orientation" id="card-orient">
            <div class="card__header">
              <svg class="card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
              </svg>
              <span class="card__title">Orientation</span>
            </div>
            <canvas class="card__chart" id="chart-orient"></canvas>
            <div class="card__values">
              <span class="card__value"><span class="card__value-dot" style="background:var(--color-alpha)"></span>α: <span id="val-orient-alpha">—</span>°</span>
              <span class="card__value"><span class="card__value-dot" style="background:var(--color-beta)"></span>β: <span id="val-orient-beta">—</span>°</span>
              <span class="card__value"><span class="card__value-dot" style="background:var(--color-gamma)"></span>γ: <span id="val-orient-gamma">—</span>°</span>
            </div>
          </div>

          <!-- GPS Card -->
          <div class="card card--no-press" id="card-gps">
            <div class="card__header">
              <svg class="card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--color-y)">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span class="card__title">GPS Location</span>
            </div>
            <div class="card__values" style="flex-direction: column; gap: 4px;">
              <span class="card__value">Lat: <span id="val-gps-lat" class="text-mono">—</span></span>
              <span class="card__value">Lng: <span id="val-gps-lng" class="text-mono">—</span></span>
              <span class="card__value">Alt: <span id="val-gps-alt" class="text-mono">—</span> m</span>
              <span class="card__value">Speed: <span id="val-gps-speed" class="text-mono">—</span> m/s</span>
            </div>
          </div>
        </div>

        <!-- Recording Controls -->
        <div class="dashboard__recording card card--no-press" id="recording-panel">
          <div class="dashboard__recording-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-red)">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3" fill="currentColor"/>
            </svg>
            <span class="card__title">記録</span>
            <span id="rec-sample-count" class="dashboard__recording-count" style="display: ${isRecording ? 'inline' : 'none'}">0 samples</span>
          </div>

          <!-- Idle state -->
          <div id="rec-idle" style="display: ${isRecording ? 'none' : 'flex'}; flex-direction: column; gap: var(--space-sm);">
            <p style="font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.5;">
              全センサーのデータをまとめて記録します。<br>記録はRecordingsページからダウンロードできます。
            </p>
            <button class="btn btn--primary" id="rec-start-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <circle cx="12" cy="12" r="8"/>
              </svg>
              記録を開始
            </button>
          </div>

          <!-- Recording state -->
          <div id="rec-active" style="display: ${isRecording ? 'flex' : 'none'}; flex-direction: column; gap: var(--space-sm);">
            <div class="dashboard__recording-status">
              <span class="dashboard__recording-indicator"></span>
              <span style="font-size: 0.8125rem; font-weight: 600; color: var(--accent-red);">REC</span>
              <span id="rec-elapsed" style="font-family: var(--font-mono); font-size: 1.125rem; font-weight: 600; flex: 1; text-align: center;">00:00</span>
            </div>
            <button class="btn btn--outline" id="rec-stop-btn" style="border-color: rgba(255,71,87,0.4); color: var(--accent-red);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
              記録を停止して保存
            </button>
          </div>
        </div>
      </div>
    `;

    this._initGraphs();
    this._startSensors();
    this._initRecordingUI();

    // Card click → detail
    container.querySelectorAll('.card[data-sensor]').forEach((card) => {
      card.addEventListener('click', () => {
        const type = card.dataset.sensor;
        this.app.navigate(`#/detail/${type}`);
      });
    });

    // Restore timer if already recording
    if (isRecording) {
      this._startRecordingTimer();
    }
  }

  _initRecordingUI() {
    const startBtn = this._container.querySelector('#rec-start-btn');
    const stopBtn = this._container.querySelector('#rec-stop-btn');

    startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._startRecordingFromDashboard();
    });

    stopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._stopRecordingFromDashboard();
    });
  }

  _startRecordingFromDashboard() {
    // Start recording all sensors
    this.app.startRecording(['acceleration', 'rotationRate', 'orientation', 'geolocation']);

    // Update UI
    const idleEl = this._container.querySelector('#rec-idle');
    const activeEl = this._container.querySelector('#rec-active');
    const countEl = this._container.querySelector('#rec-sample-count');

    if (idleEl) idleEl.style.display = 'none';
    if (activeEl) activeEl.style.display = 'flex';
    if (countEl) countEl.style.display = 'inline';

    this._startRecordingTimer();
  }

  _startRecordingTimer() {
    const elapsedEl = this._container?.querySelector('#rec-elapsed');
    const countEl = this._container?.querySelector('#rec-sample-count');

    this._recordingTimerInterval = setInterval(() => {
      if (elapsedEl) {
        elapsedEl.textContent = formatDuration(this.app.recorder.elapsedMs);
      }
      if (countEl && this.app.recorder._samples) {
        const n = this.app.recorder._samples.length;
        countEl.textContent = `${n.toLocaleString()} samples`;
      }
    }, 200);
  }

  async _stopRecordingFromDashboard() {
    // Stop local timer
    if (this._recordingTimerInterval) {
      clearInterval(this._recordingTimerInterval);
      this._recordingTimerInterval = null;
    }

    // Use the app's stop recording (shows modal for title)
    await this.app.stopRecording();

    // Update UI back to idle
    const idleEl = this._container?.querySelector('#rec-idle');
    const activeEl = this._container?.querySelector('#rec-active');
    const countEl = this._container?.querySelector('#rec-sample-count');
    const elapsedEl = this._container?.querySelector('#rec-elapsed');

    if (idleEl) idleEl.style.display = 'flex';
    if (activeEl) activeEl.style.display = 'none';
    if (countEl) { countEl.style.display = 'none'; countEl.textContent = '0 samples'; }
    if (elapsedEl) elapsedEl.textContent = '00:00';
  }

  _initGraphs() {
    // Acceleration graph
    const accelCanvas = this._container.querySelector('#chart-accel');
    this.graphs.accel = new RealtimeGraph(accelCanvas, {
      lines: [
        { key: 'x', label: 'X', color: '#ff6b6b' },
        { key: 'y', label: 'Y', color: '#51cf66' },
        { key: 'z', label: 'Z', color: '#339af0' },
      ],
      timeWindow: 10,
      minY: -20,
      maxY: 20,
    });
    this.graphs.accel.startRendering();

    // Rotation rate graph
    const gyroCanvas = this._container.querySelector('#chart-gyro');
    this.graphs.gyro = new RealtimeGraph(gyroCanvas, {
      lines: [
        { key: 'alpha', label: 'α', color: '#22d3ee' },
        { key: 'beta', label: 'β', color: '#f472b6' },
        { key: 'gamma', label: 'γ', color: '#fbbf24' },
      ],
      timeWindow: 10,
      minY: -200,
      maxY: 200,
    });
    this.graphs.gyro.startRendering();

    // Orientation graph
    const orientCanvas = this._container.querySelector('#chart-orient');
    this.graphs.orient = new RealtimeGraph(orientCanvas, {
      lines: [
        { key: 'alpha', label: 'α', color: '#22d3ee' },
        { key: 'beta', label: 'β', color: '#f472b6' },
        { key: 'gamma', label: 'γ', color: '#fbbf24' },
      ],
      timeWindow: 10,
      minY: -180,
      maxY: 360,
    });
    this.graphs.orient.startRendering();
  }

  _startSensors() {
    const sm = this.app.sensorManager;

    sm.startMotion((data) => {
      const ts = data.timestamp;
      const a = data.acceleration;
      const r = data.rotationRate;

      // Acceleration
      this.graphs.accel.addDataPoint(ts, { x: a.x, y: a.y, z: a.z });
      this._updateValue('val-accel-x', a.x);
      this._updateValue('val-accel-y', a.y);
      this._updateValue('val-accel-z', a.z);

      // Rotation rate
      this.graphs.gyro.addDataPoint(ts, {
        alpha: r.alpha,
        beta: r.beta,
        gamma: r.gamma,
      });
      this._updateValue('val-rot-alpha', r.alpha, 1);
      this._updateValue('val-rot-beta', r.beta, 1);
      this._updateValue('val-rot-gamma', r.gamma, 1);

      // Add to recorder if recording
      if (this.app.recorder.isRecording) {
        this.app.recorder.addSample({
          accel_x: a.x, accel_y: a.y, accel_z: a.z,
          accel_gravity_x: data.accelerationIncludingGravity.x,
          accel_gravity_y: data.accelerationIncludingGravity.y,
          accel_gravity_z: data.accelerationIncludingGravity.z,
          rot_alpha: r.alpha, rot_beta: r.beta, rot_gamma: r.gamma,
        });
      }
    });

    sm.startOrientation((data) => {
      const ts = data.timestamp;

      this.graphs.orient.addDataPoint(ts, {
        alpha: data.alpha,
        beta: data.beta,
        gamma: data.gamma,
      });
      this._updateValue('val-orient-alpha', data.alpha, 1);
      this._updateValue('val-orient-beta', data.beta, 1);
      this._updateValue('val-orient-gamma', data.gamma, 1);

      if (this.app.recorder.isRecording) {
        this.app.recorder.addSample({
          orient_alpha: data.alpha,
          orient_beta: data.beta,
          orient_gamma: data.gamma,
        });
      }
    });

    sm.startGeolocation((data) => {
      if (data.error) return;
      this._updateValue('val-gps-lat', data.latitude, 6);
      this._updateValue('val-gps-lng', data.longitude, 6);
      this._updateValue('val-gps-alt', data.altitude, 1);
      this._updateValue('val-gps-speed', data.speed, 2);

      if (this.app.recorder.isRecording) {
        this.app.recorder.addSample({
          latitude: data.latitude,
          longitude: data.longitude,
          altitude: data.altitude,
          speed: data.speed,
        });
      }
    });
  }

  _updateValue(id, value, digits = 2) {
    const el = this._container.querySelector(`#${id}`);
    if (el) el.textContent = formatNumber(value, digits);
  }

  unmount() {
    // Stop recording timer
    if (this._recordingTimerInterval) {
      clearInterval(this._recordingTimerInterval);
      this._recordingTimerInterval = null;
    }

    // Stop graphs
    Object.values(this.graphs).forEach((g) => g.stopRendering());
    this.graphs = {};

    // Stop sensors
    this.app.sensorManager.stopAll();
  }
}
