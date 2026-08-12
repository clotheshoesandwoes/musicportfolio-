#!/usr/bin/env node
/* analyze.js — turn every track in config.json into drawable data.

   Zero dependencies. Shells out to ffmpeg (already on PATH) to decode each
   mp3 to mono 22.05kHz float PCM, then runs a hand-rolled FFT to extract
   the time series the site draws from.

   Why time series and not averages: per-track scalars (mean centroid, mean
   energy) cluster tightly across this catalogue — every track is "a Kani
   track" — so averages cannot tell 72 songs apart. The per-slice curves
   swing across nearly the full range and differentiate cleanly. Anything
   drawn on this site is drawn from the curves.

   Output: data/marks.json — per track, base64-packed Uint8 arrays.
     bands  6 x COLS   band energy over time, dB-mapped (absolute, so a
                       quiet track genuinely looks quieter than a loud one)
     cent   COLS       spectral centroid over time (brightness)
     peaks  PEAKS      waveform envelope
     plus duration, bpm, rms, crest, peakDb

   Usage:
     node scripts/analyze.js              analyze every config.json track
     node scripts/analyze.js --limit 8    first 8 only (quick iteration)
     node scripts/analyze.js --force      re-analyze even if cached
*/

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const AUDIO_DIR = path.join(ROOT, 'audio-mp3');
const CONFIG = path.join(ROOT, 'config.json');
const OUT_DIR = path.join(ROOT, 'data');
const OUT = path.join(OUT_DIR, 'marks.json');

const SR = 22050;          // decode rate — plenty for 8kHz top band
const FFT = 1024;          // ~46ms window
const HOP = 512;
const COLS = 256;          // time slices per track (fixed, duration-independent)
const PEAKS = 512;         // waveform envelope resolution
const BAND_EDGES = [40, 100, 250, 600, 1500, 4000, 10000];  // 6 bands
const DB_FLOOR = -60;

/* ---------- FFT (iterative radix-2, in-place) ---------- */
function fftMag(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

const HANN = new Float32Array(FFT);
for (let i = 0; i < FFT; i++) HANN[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (FFT - 1));

/* ---------- decode ---------- */
function decode(file) {
  const r = spawnSync('ffmpeg', [
    '-v', 'error', '-i', file,
    '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-',
  ], { maxBuffer: 1024 * 1024 * 512, encoding: 'buffer' });
  if (r.status !== 0 || !r.stdout || !r.stdout.length) {
    throw new Error(`ffmpeg failed: ${r.stderr ? r.stderr.toString().slice(0, 200) : 'no output'}`);
  }
  const buf = r.stdout;
  // Buffer may not be 4-byte aligned for Float32Array view — copy if needed.
  const usable = buf.length - (buf.length % 4);
  return new Float32Array(buf.buffer, buf.byteOffset, usable / 4);
}

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
const packB64 = (arr) => Buffer.from(arr).toString('base64');

/* ---------- analysis ---------- */
function analyze(pcm) {
  const n = pcm.length;
  const duration = n / SR;
  const frames = Math.max(1, Math.floor((n - FFT) / HOP));

  // Band bin ranges
  const binHz = SR / FFT;
  const bandBins = [];
  for (let b = 0; b < 6; b++) {
    bandBins.push([
      Math.max(1, Math.floor(BAND_EDGES[b] / binHz)),
      Math.min(FFT / 2 - 1, Math.ceil(BAND_EDGES[b + 1] / binHz)),
    ]);
  }

  const bandFrames = [];       // frames x 6, linear energy
  const centFrames = new Float32Array(frames);
  const fluxFrames = new Float32Array(frames);
  let prevMag = new Float32Array(FFT / 2);

  const re = new Float64Array(FFT);
  const im = new Float64Array(FFT);

  for (let f = 0; f < frames; f++) {
    const off = f * HOP;
    for (let i = 0; i < FFT; i++) { re[i] = pcm[off + i] * HANN[i]; im[i] = 0; }
    fftMag(re, im);

    const mag = new Float32Array(FFT / 2);
    for (let i = 0; i < FFT / 2; i++) mag[i] = Math.hypot(re[i], im[i]);

    const row = new Float32Array(6);
    for (let b = 0; b < 6; b++) {
      const [lo, hi] = bandBins[b];
      let s = 0;
      for (let i = lo; i <= hi; i++) s += mag[i] * mag[i];
      row[b] = Math.sqrt(s / Math.max(1, hi - lo + 1));
    }
    bandFrames.push(row);

    let num = 0, den = 0, flux = 0;
    for (let i = 1; i < FFT / 2; i++) {
      num += i * binHz * mag[i];
      den += mag[i];
      const d = mag[i] - prevMag[i];
      if (d > 0) flux += d;
    }
    centFrames[f] = den > 1e-9 ? num / den : 0;
    fluxFrames[f] = flux;
    prevMag = mag;
  }

  // --- downsample frames -> COLS ---
  // Two products, because they answer different questions and one cannot do
  // both. MEASURED on the real 72: absolute dB-mapped curves put 746 of 2556
  // track pairs within 5/255 of each other (visually identical) because this
  // catalogue is uniformly loud and compressed. Per-band contrast stretching
  // drops that to 36 and lifts the mean pair distance 14 -> 83. So:
  //   bands[]   per-band normalized — STRUCTURE (where the bass drops out,
  //             where the hats come in). This is what makes 72 marks look
  //             like 72 different songs. Draw detail from this.
  //   balance[] absolute mean dB per band — CHARACTER (bass-heavy vs bright).
  //             Per-band stretching necessarily throws the band balance away,
  //             so it is preserved here as 6 scalars. Drive colour/weight
  //             from this.
  const bandsAbs = [];
  for (let b = 0; b < 6; b++) {
    const out = new Float32Array(COLS);
    for (let c = 0; c < COLS; c++) {
      const a = Math.floor(c * frames / COLS);
      const z = Math.max(a + 1, Math.floor((c + 1) * frames / COLS));
      let m = 0;
      for (let f = a; f < z && f < frames; f++) m = Math.max(m, bandFrames[f][b]);
      const db = 20 * Math.log10(Math.max(m, 1e-7));
      out[c] = ((db - DB_FLOOR) / -DB_FLOOR) * 255;
    }
    bandsAbs.push(out);
  }

  const balance = bandsAbs.map((a) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i];
    return Math.round((s / a.length) * 10) / 10;
  });

  const bands = bandsAbs.map((a) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < a.length; i++) { if (a[i] < lo) lo = a[i]; if (a[i] > hi) hi = a[i]; }
    const r = Math.max(1, hi - lo);
    const out = new Uint8Array(COLS);
    for (let i = 0; i < COLS; i++) out[i] = clamp255(((a[i] - lo) / r) * 255);
    return out;
  });

  const cent = new Uint8Array(COLS);
  for (let c = 0; c < COLS; c++) {
    const a = Math.floor(c * frames / COLS);
    const z = Math.max(a + 1, Math.floor((c + 1) * frames / COLS));
    let s = 0, k = 0;
    for (let f = a; f < z && f < frames; f++) { s += centFrames[f]; k++; }
    const hz = k ? s / k : 0;
    cent[c] = clamp255((Math.min(hz, 8000) / 8000) * 255);
  }

  // --- waveform envelope ---
  const peaks = new Uint8Array(PEAKS);
  for (let p = 0; p < PEAKS; p++) {
    const a = Math.floor(p * n / PEAKS);
    const z = Math.max(a + 1, Math.floor((p + 1) * n / PEAKS));
    let m = 0;
    for (let i = a; i < z && i < n; i++) { const v = Math.abs(pcm[i]); if (v > m) m = v; }
    peaks[p] = clamp255(m * 255);
  }

  // --- loudness ---
  let sum2 = 0, peak = 0;
  for (let i = 0; i < n; i++) { sum2 += pcm[i] * pcm[i]; const v = Math.abs(pcm[i]); if (v > peak) peak = v; }
  const rms = Math.sqrt(sum2 / n);
  const rmsDb = 20 * Math.log10(Math.max(rms, 1e-7));
  const peakDb = 20 * Math.log10(Math.max(peak, 1e-7));

  // --- BPM: autocorrelate the onset (flux) envelope ---
  const fps = SR / HOP;
  let bpm = 0, bestScore = 0;
  const mean = fluxFrames.reduce((s, v) => s + v, 0) / Math.max(1, frames);
  const oe = Float32Array.from(fluxFrames, (v) => Math.max(0, v - mean));
  for (let cand = 60; cand <= 180; cand += 0.5) {
    const lag = Math.round(fps * 60 / cand);
    if (lag < 2 || lag >= frames) continue;
    let s = 0;
    for (let i = 0; i + lag < frames; i++) s += oe[i] * oe[i + lag];
    s /= (frames - lag);
    if (s > bestScore) { bestScore = s; bpm = cand; }
  }

  // onset count per second — how busy the track is
  let onsets = 0;
  const thr = mean * 2.2;
  for (let f = 1; f < frames - 1; f++) {
    if (fluxFrames[f] > thr && fluxFrames[f] > fluxFrames[f - 1] && fluxFrames[f] >= fluxFrames[f + 1]) onsets++;
  }

  return {
    duration: Math.round(duration * 100) / 100,
    bpm: Math.round(bpm),
    rmsDb: Math.round(rmsDb * 10) / 10,
    peakDb: Math.round(peakDb * 10) / 10,
    crest: Math.round((peakDb - rmsDb) * 10) / 10,
    onsetRate: Math.round((onsets / Math.max(duration, 0.01)) * 100) / 100,
    balance,
    bands: bands.map(packB64),
    cent: packB64(cent),
    peaks: packB64(peaks),
  };
}

/* ---------- main ---------- */
function main() {
  const args = process.argv.slice(2);
  const limitArg = args.indexOf('--limit');
  const limit = limitArg >= 0 ? parseInt(args[limitArg + 1], 10) : Infinity;
  const force = args.includes('--force');

  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const tracks = cfg.tracks.filter((t) => t.file);

  let cache = {};
  if (!force && fs.existsSync(OUT)) {
    try { cache = JSON.parse(fs.readFileSync(OUT, 'utf8')).tracks || {}; } catch (e) { cache = {}; }
  }

  const out = {};
  let done = 0, failed = 0, skipped = 0;
  const t0 = process.hrtime.bigint();

  tracks.slice(0, limit === Infinity ? undefined : limit).forEach((t, i) => {
    const key = t.file;
    const file = path.join(AUDIO_DIR, key);
    if (!fs.existsSync(file)) {
      console.log(`  MISSING  ${key}`);
      failed++;
      return;
    }
    if (cache[key] && !force) { out[key] = cache[key]; skipped++; return; }
    process.stdout.write(`[${String(i + 1).padStart(3)}/${tracks.length}] ${key.slice(0, 46).padEnd(48)}`);
    try {
      const a = analyze(decode(file));
      a.title = t.title;
      a.date = t.date || '';
      out[key] = a;
      done++;
      console.log(`ok  ${a.duration}s  ${a.bpm}bpm  ${a.rmsDb}dB`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${e.message.slice(0, 60)}`);
    }
  });

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    cols: COLS, peaks: PEAKS, bandEdges: BAND_EDGES, dbFloor: DB_FLOOR, sr: SR,
    tracks: out,
  }));

  const secs = Number(process.hrtime.bigint() - t0) / 1e9;
  const kb = fs.statSync(OUT).size / 1024;
  console.log(`\nanalyzed ${done}, cached ${skipped}, failed ${failed}`);
  console.log(`wrote data/marks.json — ${kb.toFixed(0)} KB for ${Object.keys(out).length} tracks in ${secs.toFixed(1)}s`);
}

main();
