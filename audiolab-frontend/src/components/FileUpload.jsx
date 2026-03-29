// FileUpload.jsx
import { useState, useRef, useCallback } from 'react';
import styles from './FileUpload.module.css';

const ACCEPTED = ['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac', '.webm'];

export default function FileUpload({ onFileSelect, disabled }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile]         = useState(null);
  const inputRef                = useRef(null);

  const handleFile = useCallback((f) => {
    if (!f) return;
    setFile(f);
    onFileSelect(f);
  }, [onFileSelect]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const onDragOver  = (e) => { e.preventDefault(); if (!disabled) setDragging(true); };
  const onDragLeave = ()  => setDragging(false);
  const onInputChange = (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); };

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div
      className={`${styles.dropzone} ${dragging ? styles.dragging : ''} ${disabled ? styles.disabled : ''} ${file ? styles.loaded : ''}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        onChange={onInputChange}
        style={{ display: 'none' }}
      />

      {file ? (
        <div className={styles.fileInfo}>
          <div className={styles.fileIcon}>▶</div>
          <div className={styles.fileMeta}>
            <span className={styles.fileName}>{file.name}</span>
            <span className={styles.fileSize}>{formatSize(file.size)}</span>
          </div>
          {!disabled && (
            <button
              className={`btn btn-danger ${styles.clearBtn}`}
              onClick={(e) => { e.stopPropagation(); setFile(null); onFileSelect(null); }}
            >
              ✕
            </button>
          )}
        </div>
      ) : (
        <div className={styles.placeholder}>
          <div className={styles.icon}>⬡</div>
          <p className={styles.primary}>DROP AUDIO FILE</p>
          <p className={styles.secondary}>or click to browse</p>
          <p className={styles.formats}>{ACCEPTED.join('  ')}</p>
        </div>
      )}
    </div>
  );
}
