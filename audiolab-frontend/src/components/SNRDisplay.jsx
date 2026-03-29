// SNRDisplay.jsx — shows SNR before/after noise reduction
import styles from './SNRDisplay.module.css';

export default function SNRDisplay({ snr, algorithm }) {
  if (!snr) return null;

  const improved = snr.snr_improvement_db > 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>NOISE REDUCTION RESULT</span>
        <span className={styles.algo}>{algorithm?.replace(/_/g, ' ').toUpperCase()}</span>
      </div>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.label}>SNR BEFORE</span>
          <span className={`${styles.value} ${styles.before}`}>
            {snr.snr_before_db > 0 ? '+' : ''}{snr.snr_before_db} dB
          </span>
        </div>

        <div className={styles.arrow}>→</div>

        <div className={styles.metric}>
          <span className={styles.label}>SNR AFTER</span>
          <span className={`${styles.value} ${styles.after}`}>
            {snr.snr_after_db > 0 ? '+' : ''}{snr.snr_after_db} dB
          </span>
        </div>

        <div className={styles.separator} />

        <div className={styles.metric}>
          <span className={styles.label}>IMPROVEMENT</span>
          <span className={`${styles.value} ${improved ? styles.positive : styles.negative}`}>
            {improved ? '▲' : '▼'} {Math.abs(snr.snr_improvement_db)} dB
          </span>
        </div>
      </div>

      {/* Progress bar for visual impact */}
      <div className={styles.barTrack}>
        <div
          className={styles.barFill}
          style={{ width: `${Math.min(100, Math.max(0, (snr.snr_after_db + 60) / 120 * 100))}%` }}
        />
      </div>
    </div>
  );
}
