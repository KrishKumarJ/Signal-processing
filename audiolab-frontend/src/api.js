// api.js — all backend communication

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Upload audio file for full DSP analysis.
 * Returns analysis JSON.
 */
export async function analyzeAudio(file) {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${BASE_URL}/analyze`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${res.status}`);
  }
  return res.json();
}

/**
 * Upload audio file + run noise reduction.
 * Returns { audioBlob, analysis } where analysis is the JSON from the X-Analysis-Data header.
 */
export async function denoiseAudio(file, options = {}) {
  const {
    algorithm      = 'noisereduce_stationary',
    noise_duration = 0.5,
    alpha          = 2.0,
    beta           = 0.01,
    prop_decrease  = 1.0,
  } = options;

  const buildForm = () => {
    const form = new FormData();
    form.append('file', file);
    form.append('algorithm', algorithm);
    form.append('noise_duration', noise_duration);
    form.append('alpha', alpha);
    form.append('beta', beta);
    form.append('prop_decrease', prop_decrease);
    return form;
  };

  // First call: get analysis JSON
  const jsonRes = await fetch(`${BASE_URL}/denoise/json`, {
    method: 'POST',
    body: buildForm(),
  });
  if (!jsonRes.ok) {
    const err = await jsonRes.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${jsonRes.status}`);
  }
  const analysis = await jsonRes.json();

  // Second call: get the audio file
  const audioRes = await fetch(`${BASE_URL}/denoise`, {
    method: 'POST',
    body: buildForm(),
  });
  if (!audioRes.ok) {
    const err = await audioRes.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${audioRes.status}`);
  }
  const audioBlob = await audioRes.blob();

  return { audioBlob, analysis };
}

/**
 * Fetch list of available noise reduction algorithms.
 */
export async function fetchAlgorithms() {
  const res = await fetch(`${BASE_URL}/algorithms`);
  if (!res.ok) throw new Error('Failed to fetch algorithms');
  return res.json();
}

/**
 * Health check.
 */
export async function healthCheck() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    return res.ok;
  } catch { return false; }
}
