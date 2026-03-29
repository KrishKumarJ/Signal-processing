// DenoisePanel.jsx — algorithm selection + parameter controls
import { useState } from 'react';
import styles from './DenoisePanel.module.css';

const ALGO_INFO = {
  spectral_subtraction: {
    label: 'Spectral Subtraction',
    desc: 'Classic algorithm. Estimates noise PSD from a quiet segment and subtracts it from the spectrum. May produce tonal artifacts.',
    params: ['noise_duration', 'alpha', 'beta'],
  },
  noisereduce_stationary: {
    label: 'Wiener Filter (Stationary)',
    desc: 'Wiener filtering with a fixed noise model. Assumes constant background noise. Better quality, fewer artifacts.',
    params: ['noise_duration', 'prop_decrease'],
  },
  noisereduce_nonstationary: {
    label: 'Wiener Filter (Non-Stationary)',
    desc: 'Adapts noise estimate over time. Best for changing backgrounds — wind, crowd, traffic.',
    params: ['prop_decrease'],
  },
};

const DEFAULTS = {
  noise_duration: 0.5,
  alpha: 2.0,
  beta: 0.01,
  prop_decrease: 1.0,
};

export default function DenoisePanel({ onDenoise, loading, disabled }) {
  const [algorithm, setAlgorithm] = useState('noisereduce_stationary');
  const [params, setParams]       = useState({ ...DEFAULTS });

  const info = ALGO_INFO[algorithm];

  const setParam = (key, val) => setParams(p => ({ ...p, [key]: val }));

  const handleSubmit = () => {
    if (disabled || loading) return;
    onDenoise({ algorithm, ...params });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>NOISE REDUCTION</span>
      </div>

      {/* Algorithm selector */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>ALGORITHM</label>
        <div className={styles.algoButtons}>
          {Object.entries(ALGO_INFO).map(([key, info]) => (
            <button
              key={key}
              className={`${styles.algoBtn} ${algorithm === key ? styles.algoBtnActive : ''}`}
              onClick={() => setAlgorithm(key)}
              disabled={loading}
            >
              {info.label}
            </button>
          ))}
        </div>
        <p className={styles.algoDesc}>{info.desc}</p>
      </div>

      {/* Parameters */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>PARAMETERS</label>
        <div className={styles.params}>

          {info.params.includes('noise_duration') && (
            <div className={styles.param}>
              <div className={styles.paramHeader}>
                <span className={styles.paramName}>NOISE SAMPLE</span>
                <span className={styles.paramValue}>{params.noise_duration.toFixed(2)}s</span>
              </div>
              <input
                type="range" min={0.1} max={2.0} step={0.1}
                value={params.noise_duration}
                onChange={e => setParam('noise_duration', parseFloat(e.target.value))}
                disabled={loading}
              />
              <span className={styles.paramHint}>Seconds from start used as noise reference</span>
            </div>
          )}

          {info.params.includes('alpha') && (
            <div className={styles.param}>
              <div className={styles.paramHeader}>
                <span className={styles.paramName}>ALPHA (over-subtract)</span>
                <span className={styles.paramValue}>{params.alpha.toFixed(1)}</span>
              </div>
              <input
                type="range" min={1.0} max={3.0} step={0.1}
                value={params.alpha}
                onChange={e => setParam('alpha', parseFloat(e.target.value))}
                disabled={loading}
              />
              <span className={styles.paramHint}>Higher = more aggressive subtraction</span>
            </div>
          )}

          {info.params.includes('beta') && (
            <div className={styles.param}>
              <div className={styles.paramHeader}>
                <span className={styles.paramName}>BETA (spectral floor)</span>
                <span className={styles.paramValue}>{params.beta.toFixed(3)}</span>
              </div>
              <input
                type="range" min={0.001} max={0.1} step={0.001}
                value={params.beta}
                onChange={e => setParam('beta', parseFloat(e.target.value))}
                disabled={loading}
              />
              <span className={styles.paramHint}>Prevents over-zeroing (reduces musical noise)</span>
            </div>
          )}

          {info.params.includes('prop_decrease') && (
            <div className={styles.param}>
              <div className={styles.paramHeader}>
                <span className={styles.paramName}>REDUCTION STRENGTH</span>
                <span className={styles.paramValue}>{(params.prop_decrease * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range" min={0.1} max={1.0} step={0.05}
                value={params.prop_decrease}
                onChange={e => setParam('prop_decrease', parseFloat(e.target.value))}
                disabled={loading}
              />
              <span className={styles.paramHint}>0% = no change, 100% = full reduction</span>
            </div>
          )}
        </div>
      </div>

      {/* Run button */}
      <button
        className={`btn btn-amber ${styles.runBtn} ${loading ? styles.loading : ''}`}
        onClick={handleSubmit}
        disabled={disabled || loading}
      >
        {loading ? (
          <span className={styles.spinner}>◌ PROCESSING...</span>
        ) : (
          '▶ RUN NOISE REDUCTION'
        )}
      </button>
    </div>
  );
}
