import numpy as np
import noisereduce as nr
import librosa


# ─────────────────────────────────────────────
# ALGORITHM 1: Spectral Subtraction
# ─────────────────────────────────────────────
#
# Steps:
#  1. Estimate noise PSD from a quiet segment at the start
#  2. Compute STFT of noisy signal
#  3. Subtract noise magnitude from signal magnitude (with flooring to avoid artifacts)
#  4. Reconstruct signal using original phase
#
# Limitations: produces "musical noise" (tonal artifacts) at high subtraction levels.

def spectral_subtraction(
    y: np.ndarray,
    sr: int,
    noise_duration: float = 0.5,   # seconds to sample as noise at start
    alpha: float = 2.0,            # over-subtraction factor (higher = more aggressive)
    beta: float = 0.01,            # spectral floor (prevents negative values)
    n_fft: int = 1024,
    hop_length: int = 256,
) -> np.ndarray:
    """
    Classic spectral subtraction noise reduction.

    Args:
        y: Input audio signal
        sr: Sample rate
        noise_duration: How many seconds from the start to use as noise estimate
        alpha: Over-subtraction factor (1.0 - 3.0 typical range)
        beta: Spectral floor multiplier — prevents full zeroing of spectrum
        n_fft: FFT size
        hop_length: Hop length for STFT

    Returns:
        Cleaned audio signal as float32 numpy array
    """
    # 1. Estimate noise from the first `noise_duration` seconds
    noise_samples = int(noise_duration * sr)
    noise_samples = min(noise_samples, len(y) // 4)  # cap at 25% of signal
    noise_segment = y[:noise_samples]

    # Compute noise STFT and average magnitude (noise PSD estimate)
    noise_stft = librosa.stft(noise_segment, n_fft=n_fft, hop_length=hop_length)
    noise_mag = np.abs(noise_stft)
    noise_psd = np.mean(noise_mag, axis=1, keepdims=True)  # shape: (n_fft//2+1, 1)

    # 2. STFT of full noisy signal
    Y = librosa.stft(y, n_fft=n_fft, hop_length=hop_length)
    Y_mag = np.abs(Y)
    Y_phase = np.angle(Y)

    # 3. Spectral subtraction
    # Subtract alpha * noise PSD, floor at beta * noise PSD
    Y_clean_mag = Y_mag - alpha * noise_psd
    floor = beta * noise_psd
    Y_clean_mag = np.maximum(Y_clean_mag, floor)

    # 4. Reconstruct using original phase
    Y_clean = Y_clean_mag * np.exp(1j * Y_phase)
    y_clean = librosa.istft(Y_clean, hop_length=hop_length, length=len(y))

    return y_clean.astype(np.float32)


# ─────────────────────────────────────────────
# ALGORITHM 2: noisereduce (stationary)
# ─────────────────────────────────────────────
#
# Uses Wiener filtering with a statistical noise model.
# More sophisticated than spectral subtraction, fewer musical noise artifacts.
# "stationary" assumes noise profile is constant throughout.

def noisereduce_stationary(
    y: np.ndarray,
    sr: int,
    noise_duration: float = 0.5,
    prop_decrease: float = 1.0,    # 0.0 = no reduction, 1.0 = full reduction
) -> np.ndarray:
    """
    Stationary noise reduction using the noisereduce library.

    Args:
        y: Input audio
        sr: Sample rate
        noise_duration: Seconds from start used as noise sample
        prop_decrease: How aggressively to reduce noise (0 to 1)

    Returns:
        Cleaned audio as float32 numpy array
    """
    noise_samples = int(noise_duration * sr)
    noise_samples = min(noise_samples, len(y) // 4)
    noise_clip = y[:noise_samples]

    y_clean = nr.reduce_noise(
        y=y,
        sr=sr,
        y_noise=noise_clip,
        prop_decrease=prop_decrease,
        stationary=True,
    )
    return y_clean.astype(np.float32)


# ─────────────────────────────────────────────
# ALGORITHM 3: noisereduce (non-stationary)
# ─────────────────────────────────────────────
#
# Adapts noise estimate over time using a rolling window.
# Better for audio where background noise changes (e.g., wind, crowd noise).

def noisereduce_nonstationary(
    y: np.ndarray,
    sr: int,
    prop_decrease: float = 0.75,
) -> np.ndarray:
    """
    Non-stationary noise reduction — adapts to changing noise over time.

    Args:
        y: Input audio
        sr: Sample rate
        prop_decrease: Aggressiveness (0 to 1)

    Returns:
        Cleaned audio as float32 numpy array
    """
    y_clean = nr.reduce_noise(
        y=y,
        sr=sr,
        prop_decrease=prop_decrease,
        stationary=False,
    )
    return y_clean.astype(np.float32)


# ─────────────────────────────────────────────
# SNR ESTIMATION
# ─────────────────────────────────────────────

def estimate_snr(y_noisy: np.ndarray, y_clean: np.ndarray, noise_duration: float = 0.5, sr: int = 22050) -> dict:
    """
    Estimate SNR before and after noise reduction.
    Uses the first `noise_duration` seconds as a noise reference.

    Returns SNR in dB for both noisy and clean signals.
    """
    noise_samples = int(noise_duration * sr)
    noise_samples = min(noise_samples, len(y_noisy) // 4)

    # Noise power from first segment
    noise_power = np.mean(y_noisy[:noise_samples] ** 2)

    # Signal power from rest of signal
    signal_power_noisy = np.mean(y_noisy[noise_samples:] ** 2)
    signal_power_clean = np.mean(y_clean[noise_samples:] ** 2)

    snr_before = 10 * np.log10((signal_power_noisy / (noise_power + 1e-10)) + 1e-10)
    snr_after  = 10 * np.log10((signal_power_clean / (noise_power + 1e-10)) + 1e-10)

    return {
        "snr_before_db": round(float(snr_before), 2),
        "snr_after_db":  round(float(snr_after), 2),
        "snr_improvement_db": round(float(snr_after - snr_before), 2),
    }


# ─────────────────────────────────────────────
# DISPATCH — pick algorithm by name
# ─────────────────────────────────────────────

ALGORITHMS = {
    "spectral_subtraction": spectral_subtraction,
    "noisereduce_stationary": noisereduce_stationary,
    "noisereduce_nonstationary": noisereduce_nonstationary,
}

def reduce_noise(y: np.ndarray, sr: int, algorithm: str = "noisereduce_stationary", **kwargs) -> np.ndarray:
    """
    Dispatch to the chosen noise reduction algorithm.
    algorithm: one of 'spectral_subtraction', 'noisereduce_stationary', 'noisereduce_nonstationary'
    """
    if algorithm not in ALGORITHMS:
        raise ValueError(f"Unknown algorithm '{algorithm}'. Choose from: {list(ALGORITHMS.keys())}")
    return ALGORITHMS[algorithm](y, sr, **kwargs)
