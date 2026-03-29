// EnvelopeChart.jsx — RMS envelope + spectral centroid on separate y-axes
import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import styles from './Chart.module.css';

Chart.register(...registerables);

export default function EnvelopeChart({ rmsData, centroidData }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if ((!rmsData && !centroidData) || !canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const ctx = canvasRef.current.getContext('2d');

    const datasets = [];
    if (rmsData) {
      datasets.push({
        label: 'RMS (dB)',
        data: rmsData.rms_db,
        borderColor: '#00ff88',
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        tension: 0.3,
        yAxisID: 'y',
      });
    }
    if (centroidData) {
      datasets.push({
        label: 'Centroid (Hz)',
        data: centroidData.centroid_hz,
        borderColor: '#ffaa00',
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        tension: 0.3,
        yAxisID: 'y1',
      });
    }

    const labels = (rmsData || centroidData).time.map(t => t.toFixed(2));

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        animation: { duration: 400 },
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: {
              color: '#6a8099',
              font: { family: 'Share Tech Mono', size: 9 },
              boxWidth: 12,
              padding: 8,
            },
          },
          tooltip: {
            backgroundColor: '#0d1117',
            borderColor: '#2a3f55',
            borderWidth: 1,
            titleColor: '#6a8099',
            bodyColor: '#c8d8e8',
            titleFont: { family: 'Share Tech Mono', size: 10 },
            bodyFont:  { family: 'Share Tech Mono', size: 11 },
            callbacks: {
              title: (items) => `t = ${items[0].label}s`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#6a8099', font: { family: 'Share Tech Mono', size: 9 }, maxTicksLimit: 10, maxRotation: 0 },
            grid:  { color: 'rgba(30,45,61,0.8)' },
            border: { color: '#1e2d3d' },
          },
          y: {
            position: 'left',
            ticks: { color: '#00ff88', font: { family: 'Share Tech Mono', size: 9 }, maxTicksLimit: 5, callback: v => `${v.toFixed(0)}dB` },
            grid:  { color: 'rgba(30,45,61,0.5)' },
            border: { color: '#1e2d3d' },
          },
          y1: {
            position: 'right',
            ticks: { color: '#ffaa00', font: { family: 'Share Tech Mono', size: 9 }, maxTicksLimit: 5, callback: v => `${(v/1000).toFixed(1)}k` },
            grid:  { drawOnChartArea: false },
            border: { color: '#1e2d3d' },
          },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [rmsData, centroidData]);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>RMS ENVELOPE + SPECTRAL CENTROID</span>
        {centroidData && (
          <span className={styles.chartMeta}>
            mean centroid: {(centroidData.mean_centroid_hz / 1000).toFixed(2)} kHz
          </span>
        )}
      </div>
      <div className={styles.chartBody}>
        {(rmsData || centroidData) ? <canvas ref={canvasRef} /> : <div className={styles.empty}>NO SIGNAL</div>}
      </div>
    </div>
  );
}
