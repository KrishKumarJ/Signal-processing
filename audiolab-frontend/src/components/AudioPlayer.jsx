// AudioPlayer.jsx — minimal audio player for original + denoised audio
import { useEffect, useRef, useState } from 'react';
import styles from './AudioPlayer.module.css';

export default function AudioPlayer({ src, label, color = 'phosphor' }) {
  const audioRef   = useRef(null);
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    setDuration(0);
    if (audioRef.current) audioRef.current.load();
  }, [src]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else         { a.play();  setPlaying(true);  }
  };

  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    setProgress(a.currentTime / a.duration);
  };

  const onLoadedMetadata = () => {
    setDuration(audioRef.current?.duration || 0);
  };

  const onEnded = () => setPlaying(false);

  const seek = (e) => {
    const a = audioRef.current;
    if (!a) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t    = (e.clientX - rect.left) / rect.width;
    a.currentTime = t * a.duration;
    setProgress(t);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2,'0')}`;
  };

  return (
    <div className={`${styles.player} ${styles[color]}`}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
      />

      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        <span className={styles.time}>
          {formatTime(duration * progress)} / {formatTime(duration)}
        </span>
      </div>

      <div className={styles.controls}>
        <button className={styles.playBtn} onClick={toggle} disabled={!src}>
          {playing ? '⏸' : '▶'}
        </button>

        <div className={styles.progressTrack} onClick={seek}>
          <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
