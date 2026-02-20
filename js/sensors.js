// =============================================
// SensorScope — Sensor API Manager
// =============================================

export class SensorManager {
  constructor() {
    this._motionHandler = null;
    this._orientationHandler = null;
    this._geoWatchId = null;

    this._motionCallback = null;
    this._orientationCallback = null;
    this._geoCallback = null;

    this._permissionGranted = false;
  }

  /**
   * Check if DeviceMotion/Orientation requires permission (iOS 13+)
   */
  get needsPermission() {
    return typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function';
  }

  /**
   * Check if sensors are available
   */
  get isMotionAvailable() {
    return typeof DeviceMotionEvent !== 'undefined';
  }

  get isOrientationAvailable() {
    return typeof DeviceOrientationEvent !== 'undefined';
  }

  get isGeolocationAvailable() {
    return 'geolocation' in navigator;
  }

  get permissionGranted() {
    return this._permissionGranted;
  }

  /**
   * Check if running in a secure context (HTTPS or localhost)
   */
  get isSecureContext() {
    return window.isSecureContext === true;
  }

  /**
   * Request permission for motion/orientation sensors (iOS 13+)
   * Must be called from a user gesture event handler.
   * Returns: { granted: boolean, reason?: string }
   */
  async requestPermission() {
    if (!this.needsPermission) {
      // Non-iOS or older browsers: no permission needed
      this._permissionGranted = true;
      return { granted: true };
    }

    // iOS requires secure context (HTTPS) for sensor permission
    if (!this.isSecureContext) {
      console.warn('Sensor permissions require HTTPS (secure context)');
      this._permissionGranted = false;
      return { granted: false, reason: 'insecure' };
    }

    try {
      const [motionResult, orientationResult] = await Promise.all([
        DeviceMotionEvent.requestPermission(),
        DeviceOrientationEvent.requestPermission()
      ]);

      this._permissionGranted =
        motionResult === 'granted' && orientationResult === 'granted';

      return {
        granted: this._permissionGranted,
        reason: this._permissionGranted ? undefined : 'denied',
      };
    } catch (err) {
      console.error('Sensor permission request failed:', err);
      this._permissionGranted = false;
      return { granted: false, reason: 'error', error: err.message };
    }
  }

  /**
   * Start listening to DeviceMotion events.
   * Provides: acceleration (x,y,z), accelerationIncludingGravity (x,y,z), rotationRate (alpha,beta,gamma)
   */
  startMotion(callback) {
    if (!this.isMotionAvailable) return false;

    this._motionCallback = callback;
    this._motionHandler = (event) => {
      const data = {
        acceleration: {
          x: event.acceleration?.x ?? null,
          y: event.acceleration?.y ?? null,
          z: event.acceleration?.z ?? null,
        },
        accelerationIncludingGravity: {
          x: event.accelerationIncludingGravity?.x ?? null,
          y: event.accelerationIncludingGravity?.y ?? null,
          z: event.accelerationIncludingGravity?.z ?? null,
        },
        rotationRate: {
          alpha: event.rotationRate?.alpha ?? null,
          beta: event.rotationRate?.beta ?? null,
          gamma: event.rotationRate?.gamma ?? null,
        },
        interval: event.interval,
        timestamp: performance.now(),
      };
      callback(data);
    };

    window.addEventListener('devicemotion', this._motionHandler);
    return true;
  }

  stopMotion() {
    if (this._motionHandler) {
      window.removeEventListener('devicemotion', this._motionHandler);
      this._motionHandler = null;
      this._motionCallback = null;
    }
  }

  /**
   * Start listening to DeviceOrientation events.
   * Provides: alpha (0-360), beta (-180~180), gamma (-90~90), compassHeading (iOS)
   */
  startOrientation(callback) {
    if (!this.isOrientationAvailable) return false;

    this._orientationCallback = callback;
    this._orientationHandler = (event) => {
      const data = {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
        absolute: event.absolute,
        compassHeading: event.webkitCompassHeading ?? null,
        timestamp: performance.now(),
      };
      callback(data);
    };

    window.addEventListener('deviceorientation', this._orientationHandler);
    return true;
  }

  stopOrientation() {
    if (this._orientationHandler) {
      window.removeEventListener('deviceorientation', this._orientationHandler);
      this._orientationHandler = null;
      this._orientationCallback = null;
    }
  }

  /**
   * Start watching geolocation.
   * Provides: latitude, longitude, altitude, speed, heading, accuracy
   */
  startGeolocation(callback) {
    if (!this.isGeolocationAvailable) return false;

    this._geoCallback = callback;
    this._geoWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const data = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude,
          speed: position.coords.speed,
          heading: position.coords.heading,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        callback(data);
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        callback({ error: error.message, timestamp: performance.now() });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );

    return true;
  }

  stopGeolocation() {
    if (this._geoWatchId !== null) {
      navigator.geolocation.clearWatch(this._geoWatchId);
      this._geoWatchId = null;
      this._geoCallback = null;
    }
  }

  /**
   * Stop all sensors
   */
  stopAll() {
    this.stopMotion();
    this.stopOrientation();
    this.stopGeolocation();
  }
}
