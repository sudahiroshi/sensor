// =============================================
// SensorScope — Sensor Detail Page
// =============================================

import { RealtimeGraph } from '../graph.js';
import { formatNumber } from '../utils.js';

const SENSOR_CONFIG = {
  acceleration: {
    title: 'Acceleration',
    unit: 'm/s²',
    lines: [
      { key: 'x', label: 'X', color: '#ff6b6b' },
      { key: 'y', label: 'Y', color: '#51cf66' },
      { key: 'z', label: 'Z', color: '#339af0' },
    ],
    minY: -20,
    maxY: 20,
    getValue: (data) => ({
      x: data.acceleration.x,
      y: data.acceleration.y,
      z: data.acceleration.z,
    }),
    sensorType: 'motion',
    recordKeys: ['acceleration'],
  },
  rotationRate: {
    title: 'Rotation Rate',
    unit: '°/s',
    lines: [
      { key: 'alpha', label: 'α', color: '#22d3ee' },
      { key: 'beta', label: 'β', color: '#f472b6' },
      { key: 'gamma', label: 'γ', color: '#fbbf24' },
    ],
    minY: -200,
    maxY: 200,
    getValue: (data) => ({
      alpha: data.rotationRate.alpha,
      beta: data.rotationRate.beta,
      gamma: data.rotationRate.gamma,
    }),
    sensorType: 'motion',
    recordKeys: ['rotationRate'],
  },
  orientation: {
    title: 'Orientation',
    unit: '°',
    lines: [
      { key: 'alpha', label: 'α', color: '#22d3ee' },
      { key: 'beta', label: 'β', color: '#f472b6' },
      { key: 'gamma', label: 'γ', color: '#fbbf24' },
    ],
    minY: -180,
    maxY: 360,
    getValue: (data) => ({
      alpha: data.alpha,
      beta: data.beta,
      gamma: data.gamma,
    }),
    sensorType: 'orientation',
    recordKeys: ['orientation'],
  },
};

export class DetailPage {
  constructor(app) {
    this.app = app;
    this.graph = null;
    this._container = null;
    this._type = null;
    this._config = null;
    this._timeWindow = 10;
    this._showGrid = true;
  }

  mount(container, params) {
    this._container = container;
    this._type = params.type;
    this._config = SENSOR_CONFIG[this._type];

    if (!this._config) {
      container.innerHTML = '<div class="page"><p class="text-center text-secondary mt-lg">Unknown sensor type</p></div>';
      return;
    }

    const c = this._config;
    const valueIndicators = c.lines.map((line) => `
      <div class="value-indicator">
        <div class="value-indicator__label" style="color:${line.color}">${line.label}-Axis</div>
        <div class="value-indicator__value" style="color:${line.color}" id="detail-val-${line.key}">—</div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="detail page">
        <div class="page-header">
          <button class="page-header__back" id="detail-back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h1 class="page-header__title">${c.title}</h1>
          <label class="toggle">
            <input type="checkbox" id="detail-toggle" checked>
            <span class="toggle__slider"></span>
          </label>
        </div>

        <canvas class="detail__chart" id="detail-chart"></canvas>

        <div class="detail__values value-row">
          ${valueIndicators}
        </div>

        <div class="detail__settings">
          <div class="slider-group">
            <div class="slider-group__header">
              <span>Graph Duration</span>
              <span class="slider-group__value" id="duration-label">${this._timeWindow}s</span>
            </div>
            <div class="segment-control" id="time-segment">
              <button class="segment-control__item ${this._timeWindow === 5 ? 'active' : ''}" data-value="5">5s</button>
              <button class="segment-control__item ${this._timeWindow === 10 ? 'active' : ''}" data-value="10">10s</button>
              <button class="segment-control__item ${this._timeWindow === 30 ? 'active' : ''}" data-value="30">30s</button>
              <button class="segment-control__item ${this._timeWindow === 60 ? 'active' : ''}" data-value="60">60s</button>
            </div>
          </div>

          <div class="detail__settings-row">
            <span style="font-size: 0.875rem;">Show Grid</span>
            <label class="toggle">
              <input type="checkbox" id="grid-toggle" ${this._showGrid ? 'checked' : ''}>
              <span class="toggle__slider"></span>
            </label>
          </div>
        </div>

        <div class="detail__actions">
          <button class="btn btn--primary" id="detail-record">
            ● Start Recording
          </button>
          <button class="btn btn--outline" id="detail-export">
            ↓ Export CSV (current graph data)
          </button>
        </div>
      </div>
    `;

    this._initGraph();
    this._startSensor();
    this._bindEvents();
  }

  _initGraph() {
    const canvas = this._container.querySelector('#detail-chart');
    this.graph = new RealtimeGraph(canvas, {
      lines: this._config.lines,
      timeWindow: this._timeWindow,
      showGrid: this._showGrid,
      minY: this._config.minY,
      maxY: this._config.maxY,
      unit: this._config.unit,
    });
    this.graph.startRendering();
  }

  _startSensor() {
    const sm = this.app.sensorManager;
    const c = this._config;

    if (c.sensorType === 'motion') {
      sm.startMotion((data) => {
        const values = c.getValue(data);
        this.graph.addDataPoint(data.timestamp, values);
        this._updateValues(values);
      });
    } else if (c.sensorType === 'orientation') {
      sm.startOrientation((data) => {
        const values = c.getValue(data);
        this.graph.addDataPoint(data.timestamp, values);
        this._updateValues(values);
      });
    }
  }

  _updateValues(values) {
    for (const [key, val] of Object.entries(values)) {
      const el = this._container.querySelector(`#detail-val-${key}`);
      if (el) el.textContent = formatNumber(val, 2) + ' ' + this._config.unit;
    }
  }

  _bindEvents() {
    // Back button
    this._container.querySelector('#detail-back').addEventListener('click', () => {
      this.app.navigate('#/');
    });

    // Toggle sensor
    this._container.querySelector('#detail-toggle').addEventListener('change', (e) => {
      if (e.target.checked) {
        this._startSensor();
        this.graph.startRendering();
      } else {
        const sm = this.app.sensorManager;
        if (this._config.sensorType === 'motion') sm.stopMotion();
        else sm.stopOrientation();
        this.graph.stopRendering();
      }
    });

    // Time segment
    this._container.querySelector('#time-segment').addEventListener('click', (e) => {
      const btn = e.target.closest('.segment-control__item');
      if (!btn) return;
      const value = parseInt(btn.dataset.value);
      this._timeWindow = value;
      this.graph.setTimeWindow(value);

      this._container.querySelectorAll('.segment-control__item').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      this._container.querySelector('#duration-label').textContent = value + 's';
    });

    // Grid toggle
    this._container.querySelector('#grid-toggle').addEventListener('change', (e) => {
      this._showGrid = e.target.checked;
      this.graph.setShowGrid(this._showGrid);
    });

    // Record button
    this._container.querySelector('#detail-record').addEventListener('click', () => {
      if (this.app.recorder.isRecording) {
        this.app.stopRecording();
      } else {
        this.app.startRecording(this._config.recordKeys);
      }
      this._updateRecordButton();
    });

    // Export
    this._container.querySelector('#detail-export').addEventListener('click', () => {
      this._exportCurrentData();
    });
  }

  _updateRecordButton() {
    const btn = this._container.querySelector('#detail-record');
    if (this.app.recorder.isRecording) {
      btn.textContent = '■ Stop Recording';
      btn.classList.remove('btn--primary');
      btn.classList.add('btn--danger');
    } else {
      btn.textContent = '● Start Recording';
      btn.classList.remove('btn--danger');
      btn.classList.add('btn--primary');
    }
  }

  _exportCurrentData() {
    // Export current graph buffer as CSV
    const lines = this._config.lines;
    const headers = ['timestamp_ms', ...lines.map((l) => l.key)];
    const csvRows = [headers.join(',')];

    // Get data from graph (using the first line's data as reference for timestamps)
    const firstLineData = this.graph._data[lines[0].key];
    for (let i = 0; i < firstLineData.length; i++) {
      const row = [firstLineData[i].t.toFixed(1)];
      for (const line of lines) {
        const d = this.graph._data[line.key];
        row.push(d[i] ? d[i].v.toFixed(4) : '');
      }
      csvRows.push(row.join(','));
    }

    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sensorscope_${this._type}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  unmount() {
    if (this.graph) {
      this.graph.stopRendering();
      this.graph = null;
    }
    this.app.sensorManager.stopAll();
  }
}
