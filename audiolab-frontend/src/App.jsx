// App.jsx
import { useState, useEffect, useCallback } from 'react';
import { analyzeAudio, denoiseAudio, healthCheck } from './api';

import FileUpload        from './components/FileUpload';
import WaveformChart     from './components/WaveformChart';
import FFTChart          from './components/FFTChart';
import SpectrogramCanvas from './components/SpectrogramCanvas';
import EnvelopeChart     from './components/EnvelopeChart';
import DenoisePanel      from './components/DenoisePanel';
import SNRDisplay        from './components/SNRDisplay';
import AudioPlayer       from './components/AudioPlayer';
import styles            from './App.module.css';

export default function App() {
  const [file, setFile]               = useState(null);
  const [originalUrl, setOriginalUrl] = useState(null);
  const [denoisedUrl, setDenoisedUrl] = useState(null);

  const [analysis, setAnalysis]           = useState(null);
  const [denoiseResult, setDenoiseResult] = useState(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [denoising, setDenoising] = useState(false);
  const [error, setError]         = useState(null);
  const [backendOk, setBackendOk] = useState(null);

  // 'original' | 'denoised' | 'compare'
  const [vizTab, setVizTab] = useState('original');

  useEffect(() => {
    healthCheck().then(ok => setBackendOk(ok));
  }, []);

  const handleFileSelect = useCallback(async (f) => {
    setFile(f);
    setAnalysis(null);
    setDenoiseResult(null);
    setDenoisedUrl(null);
    setError(null);
    setVizTab('original');

    if (originalUrl) URL.revokeObjectURL(originalUrl);

    if (!f) { setOriginalUrl(null); return; }

    setOriginalUrl(URL.createObjectURL(f));
    setAnalyzing(true);

    try {
      const result = await analyzeAudio(f);
      setAnalysis(result);
    } catch (e) {
      setError(`Analysis failed: ${e.message}`);
    } finally {
      setAnalyzing(false);
    }
  }, [originalUrl]);

  const handleDenoise = useCallback(async (options) => {
    if (!file) return;
    setDenoising(true);
    setError(null);

    if (denoisedUrl) URL.revokeObjectURL(denoisedUrl);

    try {
      const { audioBlob, analysis: da } = await denoiseAudio(file, options);
      setDenoisedUrl(URL.createObjectURL(audioBlob));
      setDenoiseResult({ ...da, algorithm: options.algorithm });
      setVizTab('compare');
    } catch (e) {
      setError(`Denoising failed: ${e.message}`);
    } finally {
      setDenoising(false);
    }
  }, [file, denoisedUrl]);

  const downloadDenoised = () => {
    if (!denoisedUrl || !file) return;
    const a = document.createElement('a');
    a.href     = denoisedUrl;
    a.download = `denoised_${file.name.replace(/\.[^.]+$/, '')}.wav`;
    a.click();
  };

  const hasAnalysis = !!analysis;
  const hasDenoise  = !!denoiseResult;

  const activeAnalysis = vizTab === 'denoised' && hasDenoise
    ? denoiseResult.after
    : analysis?.analysis;

  return (
    <div className={styles.app}>

      {/* ── Header ─────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>◈ AUDIOLAB</span>
          <span className={styles.logoSub}>DSP ANALYSIS + NOISE REDUCTION</span>
        </div>
        <div className={styles.headerRight}>
          <div className={`${styles.statusDot} ${
            backendOk === true  ? styles.statusOk  :
            backendOk === false ? styles.statusErr :
            styles.statusWait
          }`} />
          <span className={styles.statusText}>
            {backendOk === true  ? 'BACKEND ONLINE'  :
             backendOk === false ? 'BACKEND OFFLINE' : 'CONNECTING...'}
          </span>
        </div>
      </header>

      <main className={styles.main}>

        {/* ── Sidebar ─────────────────────────────────── */}
        <aside className={styles.sidebar}>

          <div className={styles.sideBlock}>
            <div className={styles.blockLabel}>INPUT</div>
            <FileUpload
              onFileSelect={handleFileSelect}
              disabled={analyzing || denoising}
            />
          </div>

          {hasAnalysis && (
            <div className={styles.sideBlock}>
              <div className={styles.blockLabel}>FILE INFO</div>
              <div className={styles.metaGrid}>
                <span className="label">DURATION</span>
                <span className="value">{analysis.duration?.toFixed(2)}s</span>
                <span className="label">SAMPLE RATE</span>
                <span className="value">{analysis.sample_rate} Hz</span>
                <span className="label">CENTROID</span>
                <span className="value">
                  {(analysis.analysis?.spectral_centroid?.mean_centroid_hz / 1000).toFixed(2)} kHz
                </span>
                <span className="label">MEAN ZCR</span>
                <span className="value">
                  {analysis.analysis?.zcr?.mean_zcr?.toFixed(4)}
                </span>
              </div>
            </div>
          )}

          {hasAnalysis && (
            <div className={styles.sideBlock}>
              <div className={styles.blockLabel}>PLAYBACK</div>
              <AudioPlayer src={originalUrl} label="ORIGINAL" color="phosphor" />
              {hasDenoise && (
                <>
                  <div style={{ marginTop: '0.4rem' }}>
                    <AudioPlayer src={denoisedUrl} label="DENOISED" color="amber" />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={downloadDenoised}
                    style={{ width: '100%', marginTop: '0.4rem', fontSize: '0.68rem' }}
                  >
                    ↓ DOWNLOAD DENOISED WAV
                  </button>
                </>
              )}
            </div>
          )}

          {hasAnalysis && (
            <DenoisePanel
              onDenoise={handleDenoise}
              loading={denoising}
              disabled={!hasAnalysis || analyzing}
            />
          )}

        </aside>

        {/* ── Main content ────────────────────────────── */}
        <section className={styles.content}>

          {error && (
            <div className={styles.errorBanner}>
              <span>⚠ {error}</span>
              <button className="btn btn-danger" onClick={() => setError(null)}>DISMISS</button>
            </div>
          )}

          {(analyzing || denoising) && (
            <div className={styles.loadingBar}>
              <div className={styles.loadingFill} />
              <span className={styles.loadingText}>
                {analyzing ? 'ANALYZING SIGNAL...' : 'APPLYING NOISE REDUCTION...'}
              </span>
            </div>
          )}

          {!hasAnalysis && !analyzing && (
            <div className={styles.emptyState}>
              <div className={styles.emptyGrid}>
                {[...Array(12)].map((_, i) => (
                  <div key={i} className={styles.emptyCell} style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
              <div className={styles.emptyText}>
                <p className={styles.emptyTitle}>NO SIGNAL LOADED</p>
                <p className={styles.emptySub}>Upload an audio file to begin DSP analysis</p>
              </div>
            </div>
          )}

          {hasAnalysis && (
            <>
              {/* Tab bar */}
              <div className={styles.tabBar}>
                <button
                  className={`${styles.tab} ${vizTab === 'original' ? styles.tabActive : ''}`}
                  onClick={() => setVizTab('original')}
                >
                  ORIGINAL
                </button>
                {hasDenoise && (
                  <>
                    <button
                      className={`${styles.tab} ${vizTab === 'denoised' ? styles.tabActiveAmber : ''}`}
                      onClick={() => setVizTab('denoised')}
                    >
                      DENOISED
                    </button>
                    <button
                      className={`${styles.tab} ${vizTab === 'compare' ? styles.tabActiveAmber : ''}`}
                      onClick={() => setVizTab('compare')}
                    >
                      ◈ COMPARE
                    </button>
                  </>
                )}
                <div className={styles.tabSpacer} />
                <span className={styles.tabFilename}>{file?.name}</span>
              </div>

              {/* SNR summary on compare tab */}
              {vizTab === 'compare' && hasDenoise && (
                <SNRDisplay snr={denoiseResult.snr} algorithm={denoiseResult.algorithm} />
              )}

              {/* Compare view — 2-column side by side */}
              {vizTab === 'compare' && hasDenoise ? (
                <div className={styles.compareGrid}>
                  <SpectrogramCanvas data={denoiseResult.before?.spectrogram} title="SPECTROGRAM — BEFORE" />
                  <SpectrogramCanvas data={denoiseResult.after?.spectrogram}  title="SPECTROGRAM — AFTER"  />
                  <WaveformChart data={denoiseResult.before?.waveform} title="WAVEFORM — BEFORE" color="#4a6a88" />
                  <WaveformChart data={denoiseResult.after?.waveform}  title="WAVEFORM — AFTER"  color="#00ff88" />
                  <FFTChart data={denoiseResult.before?.fft} title="FFT — BEFORE" color="#4a6a88" />
                  <FFTChart data={denoiseResult.after?.fft}  title="FFT — AFTER"  color="#ffaa00" />
                </div>
              ) : (
                /* Single analysis view */
                <div className={styles.vizGrid}>
                  <div className={styles.fullWidth}>
                    <WaveformChart
                      data={activeAnalysis?.waveform}
                      title={vizTab === 'denoised' ? 'WAVEFORM — DENOISED' : 'WAVEFORM'}
                      color={vizTab === 'denoised' ? '#ffaa00' : '#00ff88'}
                    />
                  </div>
                  <div className={styles.fullWidth}>
                    <SpectrogramCanvas
                      data={activeAnalysis?.spectrogram}
                      title={vizTab === 'denoised' ? 'SPECTROGRAM — DENOISED' : 'SPECTROGRAM'}
                    />
                  </div>
                  <FFTChart
                    data={activeAnalysis?.fft}
                    title="FFT SPECTRUM"
                    color={vizTab === 'denoised' ? '#ffaa00' : '#00aaff'}
                  />
                  <EnvelopeChart
                    rmsData={activeAnalysis?.rms_envelope}
                    centroidData={activeAnalysis?.spectral_centroid}
                  />
                </div>
              )}
            </>
          )}

        </section>
      </main>
    </div>
  );
}