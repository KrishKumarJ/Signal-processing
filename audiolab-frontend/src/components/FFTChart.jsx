// FFTChart.jsx
import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import styles from './Chart.module.css';

Chart.register(...registerables);

export default function FFTChart({ data, title = 'FFT SPECTRUM', color = '#00aaff' }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!data || !canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const ctx = canvasRef.current.getContext('2d');

    // Create gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasRef.current.offsetHeight || 200);
    gradient.addColorStop(0,   `${color}44`);
    gradient.addColorStop(1,   `${color}00`);

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.frequencies.map(f => f.toFixed(0)),
        datasets: [{
          data: data.magnitude_db,
          borderColor: color,
          borderWidth: 1.5,
          pointRadius: 0,
          fill: true,
          backgroundColor: gradient,
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
              title: (items) => `${items[0].label} Hz`,
              label: (item)  => `${item.raw.toFixed(1)} dB`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#6a8099',
              font: { family: 'Share Tech Mono', size: 9 },
              maxTicksLimit: 12,
              maxRotation: 0,
              callback: (val, idx, ticks) => {
                const freq = data.frequencies[idx];
                if (freq === undefined) return '';
                if (freq >= 1000) return `${(freq/1000).toFixed(1)}k`;
                return `${Math.round(freq)}`;
              },
            },
            grid: { color: 'rgba(30,45,61,0.8)' },
            border: { color: '#1e2d3d' },
            title: {
              display: true,
              text: 'FREQUENCY (Hz)',
              color: '#3a5068',
              font: { family: 'Share Tech Mono', size: 9 },
            },
          },
          y: {
            ticks: {
              color: '#6a8099',
              font: { family: 'Share Tech Mono', size: 9 },
              maxTicksLimit: 6,
              callback: (val) => `${val} dB`,
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
            0 – {(Math.max(...data.frequencies) / 1000).toFixed(1)} kHz
          </span>
        )}
      </div>
      <div className={styles.chartBody}>
        {data ? <canvas ref={canvasRef} /> : <div className={styles.empty}>NO SIGNAL</div>}
      </div>
    </div>
  );
}
