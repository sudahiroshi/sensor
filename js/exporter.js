// =============================================
// SensorScope — Exporter (CSV / JSON)
// =============================================

export class Exporter {
  /**
   * Convert recording samples to CSV string
   */
  static toCSV(recording) {
    const samples = recording.samples || [];
    if (samples.length === 0) return '';

    // Build header based on recorded sensor types
    const headers = ['timestamp_ms'];
    const types = recording.sensorTypes || [];

    if (types.includes('acceleration')) {
      headers.push('accel_x', 'accel_y', 'accel_z');
    }
    if (types.includes('accelerationIncludingGravity')) {
      headers.push('accel_gravity_x', 'accel_gravity_y', 'accel_gravity_z');
    }
    if (types.includes('rotationRate')) {
      headers.push('rot_alpha', 'rot_beta', 'rot_gamma');
    }
    if (types.includes('orientation')) {
      headers.push('orient_alpha', 'orient_beta', 'orient_gamma');
    }
    if (types.includes('geolocation')) {
      headers.push('latitude', 'longitude', 'altitude', 'speed');
    }

    const rows = [headers.join(',')];

    for (const s of samples) {
      const row = [s.t];

      if (types.includes('acceleration')) {
        row.push(
          s.accel_x ?? '',
          s.accel_y ?? '',
          s.accel_z ?? ''
        );
      }
      if (types.includes('accelerationIncludingGravity')) {
        row.push(
          s.accel_gravity_x ?? '',
          s.accel_gravity_y ?? '',
          s.accel_gravity_z ?? ''
        );
      }
      if (types.includes('rotationRate')) {
        row.push(
          s.rot_alpha ?? '',
          s.rot_beta ?? '',
          s.rot_gamma ?? ''
        );
      }
      if (types.includes('orientation')) {
        row.push(
          s.orient_alpha ?? '',
          s.orient_beta ?? '',
          s.orient_gamma ?? ''
        );
      }
      if (types.includes('geolocation')) {
        row.push(
          s.latitude ?? '',
          s.longitude ?? '',
          s.altitude ?? '',
          s.speed ?? ''
        );
      }

      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Convert recording to JSON string
   */
  static toJSON(recording) {
    return JSON.stringify({
      id: recording.id,
      title: recording.title,
      createdAt: recording.createdAt,
      duration: recording.duration,
      sensorTypes: recording.sensorTypes,
      sampleCount: recording.sampleCount,
      samples: recording.samples,
    }, null, 2);
  }

  /**
   * Trigger file download in the browser
   */
  static download(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Export and download recording as CSV
   */
  static downloadCSV(recording) {
    const csv = Exporter.toCSV(recording);
    const filename = `${recording.title || 'recording'}_${recording.id}.csv`;
    Exporter.download(csv, filename, 'text/csv');
  }

  /**
   * Export and download recording as JSON
   */
  static downloadJSON(recording) {
    const json = Exporter.toJSON(recording);
    const filename = `${recording.title || 'recording'}_${recording.id}.json`;
    Exporter.download(json, filename, 'application/json');
  }
}
