"""
main.py
FastAPI backend for the audio analysis + noise reduction app.

Routes:
  POST /analyze          — upload audio, get all analysis data (waveform, FFT, spectrogram, etc.)
  POST /denoise          — upload audio, choose algorithm, get cleaned audio + before/after analysis
  GET  /algorithms       — list available noise reduction algorithms
  GET  /health           — health check
"""

import io
import tempfile
import os
import soundfile as sf
import numpy as np
import librosa

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

from audio_processor import full_analysis
from noise_reducer import reduce_noise, estimate_snr, ALGORITHMS


# ─────────────────────────────────────────────
# App setup
# ─────────────────────────────────────────────

app = FastAPI(
    title="Audio Analysis API",
    description="DSP backend: waveform, FFT, spectrogram, noise reduction",
    version="1.0.0",
)

# Allow all origins during development. Lock this down in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supported file types
SUPPORTED_FORMATS = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".webm"}
MAX_FILE_SIZE_MB = 50


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def load_audio_from_upload(file: UploadFile) -> tuple[np.ndarray, int]:
    """
    Load audio from an uploaded file.
    Converts to mono float32, resamples to 22050 Hz if needed.
    Returns (y, sr).
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{ext}'. Supported: {sorted(SUPPORTED_FORMATS)}"
        )

    contents = file.file.read()

    if len(contents) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_FILE_SIZE_MB}MB.")

    # Write to a temp file because librosa needs a file path for some formats
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        # Load with librosa: converts to mono float32, default sr=22050
        y, sr = librosa.load(tmp_path, sr=22050, mono=True)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not decode audio: {str(e)}")
    finally:
        os.unlink(tmp_path)

    return y, sr


def numpy_to_wav_bytes(y: np.ndarray, sr: int) -> bytes:
    """Convert numpy float32 array to WAV bytes for streaming."""
    buf = io.BytesIO()
    sf.write(buf, y, sr, format="WAV", subtype="PCM_16")
    buf.seek(0)
    return buf.read()


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/algorithms")
def list_algorithms():
    """Return available noise reduction algorithms with descriptions."""
    descriptions = {
        "spectral_subtraction": {
            "name": "Spectral Subtraction",
            "description": (
                "Classic algorithm. Estimates noise PSD from a quiet segment, "
                "subtracts it from the magnitude spectrum, reconstructs using original phase. "
                "Fast. May produce musical noise artifacts at high subtraction levels."
            ),
            "params": {
                "noise_duration": "Seconds at start used as noise estimate (default: 0.5)",
                "alpha": "Over-subtraction factor 1.0–3.0 (default: 2.0, higher = more aggressive)",
                "beta": "Spectral floor 0.001–0.1 (default: 0.01)",
            },
        },
        "noisereduce_stationary": {
            "name": "Wiener Filter (Stationary)",
            "description": (
                "Uses Wiener filtering with a fixed noise model. "
                "Assumes noise is constant throughout the recording. "
                "Better quality than spectral subtraction, fewer artifacts."
            ),
            "params": {
                "noise_duration": "Seconds at start used as noise estimate (default: 0.5)",
                "prop_decrease": "Reduction aggressiveness 0.0–1.0 (default: 1.0)",
            },
        },
        "noisereduce_nonstationary": {
            "name": "Wiener Filter (Non-Stationary)",
            "description": (
                "Adapts noise estimate over time using a rolling window. "
                "Best for audio with changing background noise (wind, crowd, traffic). "
                "Slightly slower than stationary."
            ),
            "params": {
                "prop_decrease": "Reduction aggressiveness 0.0–1.0 (default: 0.75)",
            },
        },
    }
    return {"algorithms": descriptions}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    """
    Upload an audio file. Returns full DSP analysis:
    waveform, FFT, spectrogram, RMS envelope, spectral centroid, ZCR.
    """
    y, sr = load_audio_from_upload(file)
    analysis = full_analysis(y, sr)

    return JSONResponse(content={
        "filename": file.filename,
        "sample_rate": sr,
        "duration": round(len(y) / sr, 4),
        "analysis": analysis,
    })


@app.post("/denoise")
async def denoise(
    file: UploadFile = File(...),
    algorithm: str = Form(default="noisereduce_stationary"),
    noise_duration: float = Form(default=0.5),
    alpha: float = Form(default=2.0),         # spectral subtraction only
    beta: float = Form(default=0.01),          # spectral subtraction only
    prop_decrease: float = Form(default=1.0),  # noisereduce only
    return_audio: bool = Form(default=True),   # if False, returns only analysis JSON
):
    """
    Upload audio, apply noise reduction, return:
    - Cleaned WAV file (streamed)
    - Before/after analysis data and SNR comparison in response headers as JSON ref

    Because we need to return both audio bytes AND analysis JSON, this endpoint
    returns the WAV file in the body and encodes the JSON analysis in a custom
    response header: X-Analysis-Data (URL-encoded JSON).

    The frontend should:
    1. Receive the WAV blob
    2. Read the X-Analysis-Data header for the JSON analysis
    """
    if algorithm not in ALGORITHMS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown algorithm. Choose from: {list(ALGORITHMS.keys())}"
        )

    y, sr = load_audio_from_upload(file)

    # Build kwargs for the chosen algorithm
    kwargs = {"noise_duration": noise_duration}
    if algorithm == "spectral_subtraction":
        kwargs["alpha"] = alpha
        kwargs["beta"] = beta
    elif algorithm in ("noisereduce_stationary", "noisereduce_nonstationary"):
        kwargs["prop_decrease"] = prop_decrease
        if algorithm == "noisereduce_nonstationary":
            kwargs.pop("noise_duration", None)  # non-stationary doesn't use noise_duration

    # Run noise reduction
    y_clean = reduce_noise(y, sr, algorithm=algorithm, **kwargs)

    # Compute before/after analysis
    analysis_before = full_analysis(y, sr)
    analysis_after = full_analysis(y_clean, sr)
    snr = estimate_snr(y, y_clean, noise_duration=noise_duration, sr=sr)

    if not return_audio:
        return JSONResponse(content={
            "algorithm": algorithm,
            "snr": snr,
            "before": analysis_before,
            "after": analysis_after,
        })

    # Return WAV audio as streaming response
    # Attach JSON analysis as a header (URL-encoded to avoid header encoding issues)
    import json, urllib.parse

    analysis_payload = json.dumps({
        "algorithm": algorithm,
        "snr": snr,
        "before": analysis_before,
        "after": analysis_after,
    })
    encoded_analysis = urllib.parse.quote(analysis_payload)

    wav_bytes = numpy_to_wav_bytes(y_clean, sr)

    return StreamingResponse(
    io.BytesIO(wav_bytes),
    media_type="audio/wav",
    headers={
        "Content-Disposition": f'attachment; filename="denoised_{file.filename}"',
    },
)


@app.post("/denoise/json")
async def denoise_json(
    file: UploadFile = File(...),
    algorithm: str = Form(default="noisereduce_stationary"),
    noise_duration: float = Form(default=0.5),
    alpha: float = Form(default=2.0),
    beta: float = Form(default=0.01),
    prop_decrease: float = Form(default=1.0),
):
    """
    Same as /denoise but returns only the JSON analysis — no audio file.
    Useful for testing or when the frontend only needs the visualization data.
    """
    if algorithm not in ALGORITHMS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown algorithm. Choose from: {list(ALGORITHMS.keys())}"
        )

    y, sr = load_audio_from_upload(file)

    kwargs = {"noise_duration": noise_duration}
    if algorithm == "spectral_subtraction":
        kwargs["alpha"] = alpha
        kwargs["beta"] = beta
    elif algorithm in ("noisereduce_stationary", "noisereduce_nonstationary"):
        kwargs["prop_decrease"] = prop_decrease
        if algorithm == "noisereduce_nonstationary":
            kwargs.pop("noise_duration", None)

    y_clean = reduce_noise(y, sr, algorithm=algorithm, **kwargs)

    analysis_before = full_analysis(y, sr)
    analysis_after = full_analysis(y_clean, sr)
    snr = estimate_snr(y, y_clean, noise_duration=noise_duration, sr=sr)

    return JSONResponse(content={
        "filename": file.filename,
        "algorithm": algorithm,
        "sample_rate": sr,
        "duration": round(len(y) / sr, 4),
        "snr": snr,
        "before": analysis_before,
        "after": analysis_after,
    })
