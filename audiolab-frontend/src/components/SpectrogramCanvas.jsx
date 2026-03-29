// SpectrogramCanvas.jsx
// Renders the spectrogram as a 2D heatmap directly on an HTML canvas.
// No Chart.js — we paint it pixel-by-pixel for performance and accuracy.

import { useEffect, useRef } from 'react';
import styles from './Chart.module.css';

// Maps a normalized value [0, 1] to an RGB color using a viridis-like palette
// that works well on dark backgrounds.
function dbToColor(normVal) {
  // normVal: 0 = min dB (silence), 1 = max dB (loudest)
  // Palette: dark navy → blue → cyan → green → yellow → orange
  const stops = [
    [0.00, [8,  11, 20]],
    [0.20, [10, 40, 90]],
    [0.40, [0,  100,180]],
    [0.55, [0,  200,150]],
    [0.70, [0,  255,100]],
    [0.85, [200,255, 0]],
    [1.00, [255,180, 0]],
  ];

  for (let i = 1; i < stops.length; i++) {
    const [t0, c0] = stops[i-1];
    const [t1, c1] = stops[i];
    if (normVal <= t1) {
      const t = (normVal - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + t * (c1[0] - c0[0])),
        Math.round(c0[1] + t * (c1[1] - c0[1])),
        Math.round(c0[2] + t * (c1[2] - c0[2])),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

export default function SpectrogramCanvas({ data, title = 'SPECTROGRAM' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');

    const { spectrogram, frequencies, times } = data;
    const nFreq = spectrogram.length;
    const nTime = spectrogram[0].length;

    canvas.width  = nTime;
    canvas.height = nFreq;

    // Find global min/max for normalization
    let minDb = Infinity, maxDb = -Infinity;
    for (let f = 0; f < nFreq; f++) {
      for (let t = 0; t < nTime; t++) {
        const v = spectrogram[f][t];
        if (v < minDb) minDb = v;
        if (v > maxDb) maxDb = v;
      }
    }
    const range = maxDb - minDb || 1;

    // Paint pixels — frequency axis is flipped (low freq at bottom)
    const imageData = ctx.createImageData(nTime, nFreq);
    for (let f = 0; f < nFreq; f++) {
      const row = nFreq - 1 - f; // flip so low freq is at bottom
      for (let t = 0; t < nTime; t++) {
        const val  = (spectrogram[f][t] - minDb) / range;
        const [r, g, b] = dbToColor(val);
        const idx  = (row * nTime + t) * 4;
        imageData.data[idx]     = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);

  }, [data]);

  const duration = data?.times ? data.times[data.times.length - 1]?.toFixed(2) : null;
  const maxFreq  = data?.frequencies ? (Math.max(...data.frequencies) / 1000).toFixed(1) : null;

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>{title}</span>
        {data && (
          <span className={styles.chartMeta}>
            0 – {maxFreq} kHz · {duration}s
          </span>
        )}
      </div>
      <div className={styles.spectrogramBody}>
        {data ? (
          <div className={styles.spectrogramWrapper}>
            {/* Y axis labels */}
            <div className={styles.spectrogramYAxis}>
              {['8k','6k','4k','2k','1k','0'].map(l => (
                <span key={l} className={styles.axisLabel}>{l}</span>
              ))}
            </div>
            {/* The canvas */}
            <div className={styles.canvasContainer}>
              <canvas ref={canvasRef} className={styles.spectrogramCanvas} />
            </div>
          </div>
        ) : (
          <div className={styles.empty}>NO SIGNAL</div>
        )}
        {/* Color scale legend */}
        {data && (
          <div className={styles.colorScale}>
            <span className={styles.axisLabel}>LOW</span>
            <div className={styles.colorBar} />
            <span className={styles.axisLabel}>HIGH dB</span>
          </div>
        )}
      </div>
    </div>
  );
}
