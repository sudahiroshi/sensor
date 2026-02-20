// =============================================
// SensorScope — Settings Page
// =============================================

export class SettingsPage {
  constructor(app) {
    this.app = app;
    this._container = null;
  }

  mount(container) {
    this._container = container;

    const settings = this.app.getSettings();

    container.innerHTML = `
      <div class="settings page">
        <div class="page-header">
          <h1 class="page-header__title">Settings</h1>
        </div>

        <div class="settings__section">
          <div class="settings__section-title">Graph</div>
          <div class="settings__item">
            <span class="settings__item-label">Default Duration</span>
            <select class="input" id="setting-duration" style="width: auto; min-height: 36px; padding: 4px 8px;">
              <option value="5" ${settings.defaultTimeWindow === 5 ? 'selected' : ''}>5s</option>
              <option value="10" ${settings.defaultTimeWindow === 10 ? 'selected' : ''}>10s</option>
              <option value="30" ${settings.defaultTimeWindow === 30 ? 'selected' : ''}>30s</option>
              <option value="60" ${settings.defaultTimeWindow === 60 ? 'selected' : ''}>60s</option>
            </select>
          </div>
          <div class="settings__item">
            <span class="settings__item-label">Show Grid</span>
            <label class="toggle">
              <input type="checkbox" id="setting-grid" ${settings.showGrid ? 'checked' : ''}>
              <span class="toggle__slider"></span>
            </label>
          </div>
        </div>

        <div class="settings__section">
          <div class="settings__section-title">Export</div>
          <div class="settings__item">
            <span class="settings__item-label">Default Format</span>
            <select class="input" id="setting-format" style="width: auto; min-height: 36px; padding: 4px 8px;">
              <option value="csv" ${settings.defaultFormat === 'csv' ? 'selected' : ''}>CSV</option>
              <option value="json" ${settings.defaultFormat === 'json' ? 'selected' : ''}>JSON</option>
            </select>
          </div>
        </div>

        <div class="settings__section">
          <div class="settings__section-title">Sensors</div>
          <div class="settings__item">
            <span class="settings__item-label">Motion Sensor</span>
            <span class="settings__item-value" id="status-motion">—</span>
          </div>
          <div class="settings__item">
            <span class="settings__item-label">Orientation Sensor</span>
            <span class="settings__item-value" id="status-orientation">—</span>
          </div>
          <div class="settings__item">
            <span class="settings__item-label">GPS</span>
            <span class="settings__item-value" id="status-gps">—</span>
          </div>
        </div>

        <div class="settings__section">
          <div class="settings__section-title">Data</div>
          <button class="btn btn--danger" id="setting-clear-all" style="margin-bottom: var(--space-sm);">
            すべての記録を削除
          </button>
          <button class="btn btn--outline" id="setting-reset-welcome">
            ウェルカム画面をリセット
          </button>
        </div>

        <div class="settings__section">
          <div class="settings__section-title">About</div>
          <div class="settings__item" style="border-radius: var(--radius-md);">
            <span class="settings__item-label">SensorScope</span>
            <span class="settings__item-value">v1.0.0</span>
          </div>
        </div>
      </div>
    `;

    this._updateSensorStatus();
    this._bindEvents();
  }

  _updateSensorStatus() {
    const sm = this.app.sensorManager;

    const setStatus = (id, available) => {
      const el = this._container.querySelector(`#${id}`);
      if (el) {
        el.textContent = available ? '✅ Available' : '❌ Unavailable';
        el.style.color = available ? 'var(--accent-green)' : 'var(--accent-red)';
      }
    };

    setStatus('status-motion', sm.isMotionAvailable);
    setStatus('status-orientation', sm.isOrientationAvailable);
    setStatus('status-gps', sm.isGeolocationAvailable);
  }

  _bindEvents() {
    // Duration setting
    this._container.querySelector('#setting-duration').addEventListener('change', (e) => {
      this.app.updateSettings({ defaultTimeWindow: parseInt(e.target.value) });
    });

    // Grid setting
    this._container.querySelector('#setting-grid').addEventListener('change', (e) => {
      this.app.updateSettings({ showGrid: e.target.checked });
    });

    // Format setting
    this._container.querySelector('#setting-format').addEventListener('change', (e) => {
      this.app.updateSettings({ defaultFormat: e.target.value });
    });

    // Clear all data
    this._container.querySelector('#setting-clear-all').addEventListener('click', () => {
      const overlay = document.getElementById('modal-overlay');
      const content = document.getElementById('modal-content');

      content.innerHTML = `
        <div class="modal__title">すべての記録を削除</div>
        <div class="modal__text">保存されているすべての記録データを削除しますか？<br>この操作は取り消せません。</div>
        <div class="modal__actions">
          <button class="btn btn--danger" id="confirm-clear">すべて削除する</button>
          <button class="btn btn--outline" id="cancel-clear">キャンセル</button>
        </div>
      `;

      overlay.classList.remove('hidden');

      content.querySelector('#confirm-clear').addEventListener('click', async () => {
        overlay.classList.add('hidden');
        await this.app.recorder.clearAll();
      });

      content.querySelector('#cancel-clear').addEventListener('click', () => {
        overlay.classList.add('hidden');
      });
    });

    // Reset welcome
    this._container.querySelector('#setting-reset-welcome').addEventListener('click', () => {
      localStorage.removeItem('sensorscope_welcomed');
      const overlay = document.getElementById('modal-overlay');
      const content = document.getElementById('modal-content');

      content.innerHTML = `
        <div class="modal__title">リセット完了</div>
        <div class="modal__text">次回アプリを開いた時にウェルカム画面が表示されます。</div>
        <div class="modal__actions">
          <button class="btn btn--secondary" id="ok-reset">OK</button>
        </div>
      `;

      overlay.classList.remove('hidden');
      content.querySelector('#ok-reset').addEventListener('click', () => {
        overlay.classList.add('hidden');
      });
    });
  }

  unmount() {}
}
