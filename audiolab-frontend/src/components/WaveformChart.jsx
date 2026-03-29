// WaveformChart.jsx
import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import styles from './Chart.module.css';

Chart.register(...registerables);

export default function WaveformChart({ data, title = 'WAVEFORM', color = '#00ff88' }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!data || !canvasRef.current) return;

    if (chartRef.current) chartRef.current.destroy();

    const ctx = canvasRef.current.getContext('2d');

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.time.map(t => t.toFixed(2)),
        datasets: [{
          data: data.amplitude,
          borderColor: color,
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
          tension: 0,
        }],
      },
      options: {
        animation: { duration: 400 },
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: '#0d1117',
            borderColor: '#2a3f55',
            borderWidth: 1,
            titleColor: '#6a8099',
            bodyColor: color,
            titleFont: { family: 'Share Tech Mono', size: 10 },
            bodyFont:  { family: 'Share Tech Mono', size: 11 },
            callbacks: {
              title: (items) => `t = ${items[0].label}s`,
              label: (item)  => `amp = ${item.raw.toFixed(4)}`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#6a8099',
              font: { family: 'Share Tech Mono', size: 9 },
              maxTicksLimit: 10,
              maxRotation: 0,
            },
            grid: { color: 'rgba(30,45,61,0.8)' },
            border: { color: '#1e2d3d' },
          },
          y: {
            ticks: {
              color: '#6a8099',
              font: { family: 'Share Tech Mono', size: 9 },
              maxTicksLimit: 6,
            },
            grid: { color: 'rgba(30,45,61,0.8)' },
            border: { color: '#1e2d3d' },
          },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [data, color]);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <span className={styles.chartTitle}>{title}</span>
        {data && (
          <span className={styles.chartMeta}>
            {data.duration?.toFixed(2)}s · {data.sample_rate}Hz · {data.total_samples?.toLocaleString()} samples
          </span>
        )}
      </div>
      <div className={styles.chartBody}>
        {data ? <canvas ref={canvasRef} /> : <div className={styles.empty}>NO SIGNAL</div>}
      </div>
    </div>
  );
}
