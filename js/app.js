// =============================================
// SensorScope — App Entry Point & SPA Router
// =============================================

import { SensorManager } from './sensors.js';
import { Recorder } from './recorder.js';
import { formatDuration } from './utils.js';
import { WelcomePage } from './pages/welcome.js';
import { DashboardPage } from './pages/dashboard.js';
import { DetailPage } from './pages/detail.js';
import { RecordingsPage } from './pages/recordings.js';
import { SettingsPage } from './pages/settings.js';
import { PositionPage } from './pages/position.js';

class App {
  constructor() {
    this.sensorManager = new SensorManager();
    this.recorder = new Recorder();
    this._currentPage = null;
    this._currentPageName = '';
    this._container = document.getElementById('app');
    this._recordingTimerInterval = null;

    this._settings = this._loadSettings();

    this._pages = {
      welcome: new WelcomePage(this),
      dashboard: new DashboardPage(this),
      detail: new DetailPage(this),
      recordings: new RecordingsPage(this),
      settings: new SettingsPage(this),
      position: new PositionPage(this),
    };
  }

  async init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('./sw.js');
      } catch (err) {
        console.warn('SW registration failed:', err);
      }
    }

    // Open IndexedDB
    await this.recorder.open();

    // Apply saved theme
    this.applyTheme();

    // Setup routing
    window.addEventListener('hashchange', () => this._onRoute());

    // Setup recording bar
    document.getElementById('recording-bar-stop').addEventListener('click', () => {
      this.stopRecording();
    });

    // Dismiss modal on overlay click
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') {
        e.target.classList.add('hidden');
      }
    });

    // Handle tab visibility changes: remount current page when tab
    // becomes visible again so that rAF + sensor listeners restart with
    // fresh timestamps (rAF pauses while tab is hidden but
    // performance.now() keeps advancing, leaving graph data stale).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this._currentPage) {
        const skip = ['welcome', 'settings', 'recordings'];
        if (!skip.includes(this._currentPageName)) {
          this._remountCurrentPage();
        }
      }
    });

    // Initial route
    if (!localStorage.getItem('sensorscope_welcomed')) {
      window.location.hash = '#/welcome';
    } else if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/welcome') {
      window.location.hash = '#/';
    }

    this._onRoute();
  }

  navigate(hash) {
    window.location.hash = hash;
  }

  _onRoute() {
    const hash = window.location.hash || '#/';

    // Parse route
    let pageName, params = {};

    if (hash === '#/welcome') {
      pageName = 'welcome';
    } else if (hash === '#/' || hash === '#') {
      pageName = 'dashboard';
    } else if (hash.startsWith('#/detail/')) {
      pageName = 'detail';
      params.type = hash.replace('#/detail/', '');
    } else if (hash === '#/recordings') {
      pageName = 'recordings';
    } else if (hash === '#/settings') {
      pageName = 'settings';
    } else if (hash === '#/position') {
      pageName = 'position';
    } else {
      pageName = 'dashboard';
    }

    // Unmount current page
    if (this._currentPage && this._currentPage.unmount) {
      this._currentPage.unmount();
    }

    // Update nav
    this._updateNav(pageName);

    // Mount new page
    this._container.innerHTML = '';
    this._currentPageName = pageName;
    this._currentPage = this._pages[pageName];



    if (this._currentPage && this._currentPage.mount) {
      this._currentPage.mount(this._container, params);
    }

    // Hide bottom nav on welcome
    const nav = document.getElementById('bottom-nav');
    if (pageName === 'welcome') {
      nav.classList.add('hidden');
    } else {
      nav.classList.remove('hidden');
    }
  }

  /**
   * Unmount and remount the current page in-place.
   * This restarts sensor listeners and rendering loops after
   * the browser tab resumes from being hidden.
   */
  _remountCurrentPage() {
    if (!this._currentPage) return;

    // Rebuild params from current hash
    const hash = window.location.hash || '#/';
    const params = {};
    if (hash.startsWith('#/detail/')) {
      params.type = hash.replace('#/detail/', '');
    }

    if (this._currentPage.unmount) {
      this._currentPage.unmount();
    }
    this._container.innerHTML = '';
    if (this._currentPage.mount) {
      this._currentPage.mount(this._container, params);
    }
  }

  _updateNav(pageName) {
    const navMap = {
      dashboard: 'dashboard',
      detail: 'dashboard',
      recordings: 'recordings',
      settings: 'settings',
      position: 'position',
    };

    const activePage = navMap[pageName] || '';

    document.querySelectorAll('.bottom-nav__item').forEach((item) => {
      if (item.dataset.page === activePage) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  // --- Recording Management ---

  startRecording(sensorTypes) {
    const allTypes = sensorTypes || ['acceleration', 'rotationRate', 'orientation', 'geolocation'];
    this.recorder.startRecording(allTypes);

    // Show recording bar
    const bar = document.getElementById('recording-bar');
    bar.classList.remove('hidden');
    document.body.classList.add('recording');

    // Start timer
    const timeEl = document.getElementById('recording-bar-time');
    this._recordingTimerInterval = setInterval(() => {
      timeEl.textContent = formatDuration(this.recorder.elapsedMs);
    }, 200);
  }

  async stopRecording() {
    // Stop timer
    if (this._recordingTimerInterval) {
      clearInterval(this._recordingTimerInterval);
      this._recordingTimerInterval = null;
    }

    // Hide recording bar
    const bar = document.getElementById('recording-bar');
    bar.classList.add('hidden');
    document.body.classList.remove('recording');

    // Show title dialog
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    const now = new Date();
    const defaultName = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
    ].join('');

    content.innerHTML = `
      <div class="modal__title">記録を保存</div>
      <div class="modal__text">記録にタイトルを付けてください。</div>
      <input class="input mb-md" id="recording-title" type="text" value="${defaultName}" placeholder="Recording title..." autofocus>
      <div class="modal__actions">
        <button class="btn btn--secondary" id="save-recording">保存</button>
        <button class="btn btn--outline" id="discard-recording">破棄</button>
      </div>
    `;

    overlay.classList.remove('hidden');

    return new Promise((resolve) => {
      content.querySelector('#save-recording').addEventListener('click', async () => {
        const title = content.querySelector('#recording-title').value.trim();
        const recording = await this.recorder.stopRecording(title || defaultName);
        overlay.classList.add('hidden');
        resolve(recording);
      });

      content.querySelector('#discard-recording').addEventListener('click', () => {
        this.recorder._isRecording = false;
        this.recorder._samples = [];
        this.recorder._startTime = null;
        this.recorder._currentRecording = null;
        overlay.classList.add('hidden');
        resolve(null);
      });
    });
  }

  // --- Settings Management ---

  getSettings() {
    return { ...this._settings };
  }

  updateSettings(updates) {
    Object.assign(this._settings, updates);
    localStorage.setItem('sensorscope_settings', JSON.stringify(this._settings));
  }

  applyTheme() {
    const theme = this._settings.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = theme === 'light' ? '#f0f2f5' : '#0a0e1a';
    }
  }

  _loadSettings() {
    const defaults = {
      defaultTimeWindow: 10,
      showGrid: true,
      defaultFormat: 'csv',
      theme: 'dark',
    };

    try {
      const saved = JSON.parse(localStorage.getItem('sensorscope_settings'));
      return { ...defaults, ...saved };
    } catch {
      return defaults;
    }
  }
}

// --- Bootstrap ---
const app = new App();
app.init().catch(console.error);
