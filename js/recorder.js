// =============================================
// SensorScope — Recorder (IndexedDB)
// =============================================

import { generateId, formatFileSize } from './utils.js';

const DB_NAME = 'SensorScopeDB';
const DB_VERSION = 1;

export class Recorder {
  constructor() {
    this._db = null;
    this._isRecording = false;
    this._currentRecording = null;
    this._samples = [];
    this._startTime = null;
    this._sensorTypes = [];
  }

  get isRecording() {
    return this._isRecording;
  }

  get currentRecording() {
    return this._currentRecording;
  }

  get elapsedMs() {
    if (!this._startTime) return 0;
    return Date.now() - this._startTime;
  }

  /**
   * Open the IndexedDB database
   */
  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('recordings')) {
          const store = db.createObjectStore('recordings', { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this._db = event.target.result;
        resolve();
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Start recording sensor data
   */
  startRecording(sensorTypes) {
    if (this._isRecording) return;

    this._isRecording = true;
    this._sensorTypes = sensorTypes;
    this._startTime = Date.now();
    this._samples = [];
    this._currentRecording = {
      id: generateId(),
      title: '',
      createdAt: this._startTime,
      sensorTypes: [...sensorTypes],
      duration: 0,
      sampleCount: 0,
      dataSize: 0,
    };
  }

  /**
   * Add a sensor data sample during recording
   */
  addSample(data) {
    if (!this._isRecording) return;
    this._samples.push({
      t: Date.now() - this._startTime,
      ...data,
    });
  }

  /**
   * Stop recording and save to IndexedDB
   */
  async stopRecording(title) {
    if (!this._isRecording) return null;

    this._isRecording = false;
    const duration = Date.now() - this._startTime;

    const recording = {
      ...this._currentRecording,
      title: title || `Recording #${Date.now().toString(36)}`,
      duration,
      sampleCount: this._samples.length,
      samples: this._samples,
      dataSize: new Blob([JSON.stringify(this._samples)]).size,
    };

    // Save to IndexedDB
    await this._saveRecording(recording);

    this._currentRecording = null;
    this._samples = [];
    this._startTime = null;

    return recording;
  }

  /**
   * Get all recordings (without samples for list view)
   */
  async getRecordings() {
    if (!this._db) await this.open();

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction('recordings', 'readonly');
      const store = tx.objectStore('recordings');
      const request = store.getAll();

      request.onsuccess = () => {
        const recordings = request.result.map((r) => ({
          id: r.id,
          title: r.title,
          createdAt: r.createdAt,
          sensorTypes: r.sensorTypes,
          duration: r.duration,
          sampleCount: r.sampleCount,
          dataSize: r.dataSize,
        }));
        recordings.sort((a, b) => b.createdAt - a.createdAt);
        resolve(recordings);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a single recording with its samples
   */
  async getRecording(id) {
    if (!this._db) await this.open();

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction('recordings', 'readonly');
      const store = tx.objectStore('recordings');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a recording
   */
  async deleteRecording(id) {
    if (!this._db) await this.open();

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction('recordings', 'readwrite');
      const store = tx.objectStore('recordings');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all recordings
   */
  async clearAll() {
    if (!this._db) await this.open();

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction('recordings', 'readwrite');
      const store = tx.objectStore('recordings');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async _saveRecording(recording) {
    if (!this._db) await this.open();

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction('recordings', 'readwrite');
      const store = tx.objectStore('recordings');
      const request = store.put(recording);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
