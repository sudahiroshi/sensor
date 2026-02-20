// =============================================
// SensorScope — Recordings Page
// =============================================

import { Exporter } from '../exporter.js';
import { formatDuration, formatFileSize, formatDate, escapeHtml } from '../utils.js';

const SENSOR_TAG_MAP = {
  acceleration: { label: 'Accel', class: 'sensor-tag--accel' },
  accelerationIncludingGravity: { label: 'Gravity', class: 'sensor-tag--accel' },
  rotationRate: { label: 'Gyro', class: 'sensor-tag--gyro' },
  orientation: { label: 'Orient', class: 'sensor-tag--orient' },
  geolocation: { label: 'GPS', class: 'sensor-tag--gps' },
};

export class RecordingsPage {
  constructor(app) {
    this.app = app;
    this._container = null;
  }

  async mount(container) {
    this._container = container;

    container.innerHTML = `
      <div class="recordings page">
        <div class="page-header">
          <h1 class="page-header__title">Recordings</h1>
        </div>
        <div id="recordings-list" class="recordings__list">
          <div class="text-center text-secondary mt-lg">Loading...</div>
        </div>
      </div>
    `;

    await this._loadRecordings();
  }

  async _loadRecordings() {
    const listEl = this._container.querySelector('#recordings-list');

    try {
      const recordings = await this.app.recorder.getRecordings();

      if (recordings.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state__icon">📭</div>
            <div class="empty-state__title">記録がありません</div>
            <div class="empty-state__text">ダッシュボードまたはセンサー詳細画面から記録を開始してください</div>
          </div>
        `;
        return;
      }

      listEl.innerHTML = recordings.map((rec) => this._renderCard(rec)).join('');
      this._bindCardEvents(listEl);
    } catch (err) {
      console.error('Failed to load recordings:', err);
      listEl.innerHTML = '<div class="text-center text-secondary mt-lg">読み込みに失敗しました</div>';
    }
  }

  _renderCard(rec) {
    const tags = (rec.sensorTypes || []).map((type) => {
      const tag = SENSOR_TAG_MAP[type] || { label: type, class: '' };
      return `<span class="sensor-tag ${tag.class}">${tag.label}</span>`;
    }).join('');

    return `
      <div class="card recording-card" data-id="${rec.id}">
        <div class="recording-card__header">
          <span class="recording-card__title">${escapeHtml(rec.title)}</span>
          <span class="recording-card__duration">${formatDuration(rec.duration)}</span>
        </div>
        <div class="recording-card__date">${formatDate(rec.createdAt)}</div>
        <div class="recording-card__footer">
          <div class="recording-card__tags">
            ${tags}
            <span class="recording-card__size">${formatFileSize(rec.dataSize || 0)}</span>
          </div>
          <div class="recording-card__actions">
            <button class="btn btn--icon btn--small action-download" data-id="${rec.id}" title="Download">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            <button class="btn btn--icon btn--small action-delete" data-id="${rec.id}" title="Delete" style="color: var(--accent-red)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _bindCardEvents(listEl) {
    // Download
    listEl.querySelectorAll('.action-download').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        await this._downloadRecording(id);
      });
    });

    // Delete
    listEl.querySelectorAll('.action-delete').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        await this._deleteRecording(id);
      });
    });
  }

  async _downloadRecording(id) {
    try {
      const recording = await this.app.recorder.getRecording(id);
      if (!recording) return;

      this._showFormatDialog(recording);
    } catch (err) {
      console.error('Download failed:', err);
    }
  }

  _showFormatDialog(recording) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    content.innerHTML = `
      <div class="modal__title">ダウンロード形式</div>
      <div class="modal__text">${escapeHtml(recording.title)} のデータをダウンロードします。形式を選択してください。</div>
      <div class="modal__actions">
        <button class="btn btn--secondary" id="dl-csv">CSV形式</button>
        <button class="btn btn--outline" id="dl-json">JSON形式</button>
        <button class="btn btn--outline" id="dl-cancel">キャンセル</button>
      </div>
    `;

    overlay.classList.remove('hidden');

    content.querySelector('#dl-csv').addEventListener('click', () => {
      Exporter.downloadCSV(recording);
      overlay.classList.add('hidden');
    });

    content.querySelector('#dl-json').addEventListener('click', () => {
      Exporter.downloadJSON(recording);
      overlay.classList.add('hidden');
    });

    content.querySelector('#dl-cancel').addEventListener('click', () => {
      overlay.classList.add('hidden');
    });
  }

  async _deleteRecording(id) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    content.innerHTML = `
      <div class="modal__title">記録を削除</div>
      <div class="modal__text">この記録を削除しますか？この操作は取り消せません。</div>
      <div class="modal__actions">
        <button class="btn btn--danger" id="confirm-delete">削除する</button>
        <button class="btn btn--outline" id="cancel-delete">キャンセル</button>
      </div>
    `;

    overlay.classList.remove('hidden');

    content.querySelector('#confirm-delete').addEventListener('click', async () => {
      overlay.classList.add('hidden');
      try {
        await this.app.recorder.deleteRecording(id);
        await this._loadRecordings();
      } catch (err) {
        console.error('Delete failed:', err);
      }
    });

    content.querySelector('#cancel-delete').addEventListener('click', () => {
      overlay.classList.add('hidden');
    });
  }

  unmount() {}
}
