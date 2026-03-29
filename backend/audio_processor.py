"""
audio_processor.py
Core DSP module - extracts all analysis data from an audio signal.
All functions take (y, sr) as input: y = numpy float32 array, sr = sample rate.
"""

import numpy as np
import librosa


# ─────────────────────────────────────────────
# 1. WAVEFORM
# ─────────────────────────────────────────────

def get_waveform(y: np.ndarray, sr: int, max_points: int = 8000) -> dict:
    """
    Downsample waveform for frontend rendering.
    Returns time array and amplitude array.
    """
    total_samples = len(y)
    duration = total_samples / sr

    # Downsample by taking evenly spaced samples
    if total_samples > max_points:
        indices = np.linspace(0, total_samples - 1, max_points, dtype=int)
        y_down = y[indices]
        t_down = indices / sr
    else:
        y_down = y
        t_down = np.arange(total_samples) / sr

    return {
        "time": t_down.tolist(),
        "amplitude": y_down.tolist(),
        "duration": round(duration, 4),
        "sample_rate": sr,
        "total_samples": total_samples,
    }


# ─────────────────────────────────────────────
# 2. FFT MAGNITUDE SPECTRUM
# ─────────────────────────────────────────────

def get_fft(y: np.ndarray, sr: int, max_freq: float = 8000.0) -> dict:
    """
    Compute FFT magnitude spectrum.
    Only returns up to max_freq Hz (most audio content of interest is below 8kHz).
    Uses the full signal - gives average spectral shape.
    """
    N = len(y)
    window = np.hanning(N)
    Y = np.fft.rfft(y * window)
    magnitude = np.abs(Y) / N  # normalize
    magnitude_db = 20 * np.log10(magnitude + 1e-10)  # avoid log(0)

    freqs = np.fft.rfftfreq(N, d=1.0 / sr)

    # Limit to max_freq
    mask = freqs <= max_freq
    freqs = freqs[mask]
    magnitude_db = magnitude_db[mask]

    # Downsample to 2000 points max for response size
    if len(freqs) > 2000:
        idx = np.linspace(0, len(freqs) - 1, 2000, dtype=int)
        freqs = freqs[idx]
        magnitude_db = magnitude_db[idx]

    return {
        "frequencies": freqs.tolist(),
        "magnitude_db": magnitude_db.tolist(),
    }


# ─────────────────────────────────────────────
# 3. SPECTROGRAM (Short-Time Fourier Transform)
# ─────────────────────────────────────────────

def get_spectrogram(y: np.ndarray, sr: int, n_fft: int = 1024, hop_length: int = 256) -> dict:
    """
    Compute STFT spectrogram in dB.
    Returns a 2D array: rows = frequency bins, cols = time frames.
    Limits frequency axis to 8kHz.
    """
    S = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop_length))
    S_db = librosa.amplitude_to_db(S, ref=np.max)

    freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
    times = librosa.frames_to_time(np.arange(S.shape[1]), sr=sr, hop_length=hop_length)

    # Limit to 8kHz
    freq_mask = freqs <= 8000
    freqs = freqs[freq_mask]
    S_db = S_db[freq_mask, :]

    # Downsample time axis if too many frames (cap at 500 frames for response size)
    if S_db.shape[1] > 500:
        t_idx = np.linspace(0, S_db.shape[1] - 1, 500, dtype=int)
        S_db = S_db[:, t_idx]
        times = times[t_idx]

    return {
        "spectrogram": S_db.tolist(),   # 2D list [freq_bins][time_frames]
        "frequencies": freqs.tolist(),
        "times": times.tolist(),
        "shape": list(S_db.shape),      # [n_freq_bins, n_time_frames]
    }


# ─────────────────────────────────────────────
# 4. RMS ENVELOPE
# ─────────────────────────────────────────────

def get_rms_envelope(y: np.ndarray, sr: int, frame_length: int = 1024, hop_length: int = 256) -> dict:
    """
    RMS energy over time — the loudness envelope.
    """
    rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
    times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop_length)

    rms_db = 20 * np.log10(rms + 1e-10)

    return {
        "time": times.tolist(),
        "rms": rms.tolist(),
        "rms_db": rms_db.tolist(),
    }


# ─────────────────────────────────────────────
# 5. SPECTRAL CENTROID
# ─────────────────────────────────────────────

def get_spectral_centroid(y: np.ndarray, sr: int, hop_length: int = 256) -> dict:
    """
    Spectral centroid over time — the 'brightness' or center of mass of the spectrum.
    High centroid = brighter/noisier sound. Low centroid = bassier sound.
    """
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)[0]
    times = librosa.frames_to_time(np.arange(len(centroid)), sr=sr, hop_length=hop_length)

    return {
        "time": times.tolist(),
        "centroid_hz": centroid.tolist(),
        "mean_centroid_hz": round(float(np.mean(centroid)), 2),
    }


# ─────────────────────────────────────────────
# 6. ZERO CROSSING RATE
# ─────────────────────────────────────────────

def get_zcr(y: np.ndarray, sr: int, hop_length: int = 256) -> dict:
    """
    Zero crossing rate — how often the signal changes sign.
    High ZCR = noisy / unvoiced. Low ZCR = tonal / voiced.
    """
    zcr = librosa.feature.zero_crossing_rate(y=y, hop_length=hop_length)[0]
    times = librosa.frames_to_time(np.arange(len(zcr)), sr=sr, hop_length=hop_length)

    return {
        "time": times.tolist(),
        "zcr": zcr.tolist(),
        "mean_zcr": round(float(np.mean(zcr)), 6),
    }


# ─────────────────────────────────────────────
# 7. FULL ANALYSIS — runs all of the above
# ─────────────────────────────────────────────

def full_analysis(y: np.ndarray, sr: int) -> dict:
    """
    Run all analysis functions and return combined result.
    """
    return {
        "waveform": get_waveform(y, sr),
        "fft": get_fft(y, sr),
        "spectrogram": get_spectrogram(y, sr),
        "rms_envelope": get_rms_envelope(y, sr),
        "spectral_centroid": get_spectral_centroid(y, sr),
        "zcr": get_zcr(y, sr),
    }
