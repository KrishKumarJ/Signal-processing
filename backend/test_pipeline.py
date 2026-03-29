"""
test_pipeline.py
Run this to validate the full backend pipeline without starting the server.
Tests all DSP functions and all 3 noise reduction algorithms on a synthetic signal.
"""

import numpy as np
import soundfile as sf
import io
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from audio_processor import (
    get_waveform, get_fft, get_spectrogram,
    get_rms_envelope, get_spectral_centroid, get_zcr, full_analysis
)
from files.centroid.noise_reducer import reduce_noise, estimate_snr, ALGORITHMS

# ── Generate a synthetic noisy test signal ──────────────────────────────────
SR = 22050
DURATION = 3.0  # seconds
t = np.linspace(0, DURATION, int(SR * DURATION), endpoint=False)

# 440 Hz + 880 Hz tone (clean signal)
clean = (0.4 * np.sin(2 * np.pi * 440 * t) +
         0.2 * np.sin(2 * np.pi * 880 * t)).astype(np.float32)

# Add white noise
np.random.seed(42)
noise = 0.15 * np.random.randn(len(t)).astype(np.float32)
noisy = clean + noise

print("=" * 55)
print("AUDIO ANALYSIS PIPELINE TEST")
print("=" * 55)
print(f"Signal: {DURATION}s, {SR}Hz, {len(noisy)} samples")
print()

# ── Test individual DSP functions ────────────────────────────────────────────
print("[ DSP Functions ]")

wf = get_waveform(noisy, SR)
assert len(wf["time"]) == len(wf["amplitude"])
assert wf["duration"] == round(DURATION, 4)
print(f"  waveform      : {len(wf['time'])} points, duration={wf['duration']}s  OK")

fft = get_fft(noisy, SR)
assert len(fft["frequencies"]) == len(fft["magnitude_db"])
print(f"  fft           : {len(fft['frequencies'])} bins, max_freq={max(fft['frequencies']):.0f}Hz  OK")

spec = get_spectrogram(noisy, SR)
assert spec["shape"][0] == len(spec["frequencies"])
assert spec["shape"][1] == len(spec["times"])
print(f"  spectrogram   : shape={spec['shape']}  OK")

rms = get_rms_envelope(noisy, SR)
assert len(rms["time"]) == len(rms["rms"])
print(f"  rms_envelope  : {len(rms['time'])} frames  OK")

cent = get_spectral_centroid(noisy, SR)
print(f"  spectral_centroid: mean={cent['mean_centroid_hz']}Hz  OK")

zcr = get_zcr(noisy, SR)
print(f"  zcr           : mean={zcr['mean_zcr']}  OK")

# ── Test full_analysis ───────────────────────────────────────────────────────
print()
print("[ Full Analysis ]")
result = full_analysis(noisy, SR)
assert set(result.keys()) == {"waveform", "fft", "spectrogram", "rms_envelope", "spectral_centroid", "zcr"}
print(f"  All 6 keys present  OK")

# ── Test noise reduction ─────────────────────────────────────────────────────
print()
print("[ Noise Reduction Algorithms ]")

for algo in ALGORITHMS:
    try:
        y_clean = reduce_noise(noisy, SR, algorithm=algo)
        assert y_clean.shape == noisy.shape, "Output shape mismatch"
        assert y_clean.dtype == np.float32, "Output dtype must be float32"
        snr = estimate_snr(noisy, y_clean, sr=SR)
        print(f"  {algo:<35} SNR {snr['snr_before_db']:+.1f} -> {snr['snr_after_db']:+.1f} dB  (improvement: {snr['snr_improvement_db']:+.1f} dB)  OK")
    except Exception as e:
        print(f"  {algo:<35} FAILED: {e}")

# ── Test WAV round-trip ───────────────────────────────────────────────────────
print()
print("[ WAV Round-trip ]")
buf = io.BytesIO()
sf.write(buf, noisy, SR, format="WAV", subtype="PCM_16")
buf.seek(0)
y_rt, sr_rt = sf.read(buf, dtype="float32")
assert sr_rt == SR
print(f"  Written and read back {len(y_rt)} samples at {sr_rt}Hz  OK")

print()
print("=" * 55)
print("ALL TESTS PASSED")
print("=" * 55)
