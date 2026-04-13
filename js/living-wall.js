/* =========================================================
   LIVING-WALL.JS — "Living Wall 2.0" view (b072)
   ---------------------------------------------------------
   Grid of tiles, each a mini living canvas with its own
   procedural visual (determined by track index). The wall
   breathes — tiles shift scale in a slow organic wave.
   Hover expands a tile; click takes it over the viewport
   as a full audio-reactive experience.

   6 visual types: waves, particles, rings, bars, spiral, mesh.
   Canvas 2D, no dependencies.
   ========================================================= */

(function () {
  /* ----- constants ----- */
  const TILE_GAP = 10;
  const VISUAL_TYPES = 6;
  const MINI_FPS = 12;                // throttle mini canvases
  const MINI_INTERVAL = 1000 / MINI_FPS;
  const BREATH_SPEED = 0.0008;        // wall breathing speed
  const BREATH_AMP = 0.025;           // scale oscillation +-
  const BEAT_THRESHOLD = 0.35;        // bass hit threshold (0-1)
  const BEAT_COOLDOWN = 280;          // ms between beat pulses

  /* ----- state ----- */
  let container, gridEl, overlayEl;
  let tiles = [];       // { el, canvas, ctx, index, visualType, particles, phase, colors }
  let rafId = null;
  let lastMiniDraw = 0;
  let breathPhase = 0;
  let beatPulse = 0;    // 1 → 0 decay on bass hit
  let lastBeatTime = 0;
  let expandedTile = null;
  let expandedCanvas, expandedCtx;
  let searchQuery = '';
  let tileSize = 170;

  /* ----- helpers ----- */
  function hashIndex(i) { return ((i * 2654435761) >>> 0) % VISUAL_TYPES; }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function hsl(h, s, l, a) {
    return a !== undefined
      ? `hsla(${h},${s}%,${l}%,${a})`
      : `hsl(${h},${s}%,${l}%)`;
  }

  /* ----- init ----- */
  function init(viewContainer) {
    container = viewContainer;

    // inject styles
    const style = document.createElement('style');
    style.id = 'livingWallStyle';
    style.textContent = `
      .lw-grid {
        display: flex;
        flex-wrap: wrap;
        gap: ${TILE_GAP}px;
        padding: 80px 24px 24px;
        justify-content: center;
        align-content: start;
        overflow-y: auto;
        height: 100%;
        box-sizing: border-box;
      }
      .lw-tile {
        position: relative;
        width: ${tileSize}px;
        height: ${tileSize}px;
        border-radius: 14px;
        overflow: hidden;
        cursor: pointer;
        transition: transform 0.35s cubic-bezier(.22,.68,0,1.2), box-shadow 0.3s ease;
        will-change: transform;
      }
      .lw-tile canvas {
        display: block;
        width: 100%;
        height: 100%;
        border-radius: 14px;
      }
      .lw-tile-label {
        position: absolute;
        bottom: 0; left: 0; right: 0;
        padding: 8px 10px;
        font-family: 'DM Sans', sans-serif;
        font-size: 11px;
        font-weight: 500;
        color: #fff;
        background: linear-gradient(transparent, rgba(0,0,0,0.7));
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.25s;
      }
      .lw-tile:hover .lw-tile-label { opacity: 1; }
      .lw-tile:hover {
        transform: scale(1.12);
        box-shadow: 0 0 30px rgba(168,85,247,0.4);
        z-index: 10;
      }
      .lw-tile.playing {
        box-shadow: 0 0 24px rgba(156,255,58,0.5);
      }
      .lw-tile.playing::after {
        content: '';
        position: absolute;
        top: 8px; right: 8px;
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #9cff3a;
        box-shadow: 0 0 8px #9cff3a;
        animation: lw-pulse-dot 1s ease-in-out infinite;
      }
      .lw-tile.hidden { display: none; }
      @keyframes lw-pulse-dot {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.4); }
      }
      .lw-tile.entering {
        opacity: 0;
        transform: scale(0.7) translateY(20px);
      }

      /* expanded overlay */
      .lw-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(0,0,0,0.92);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.35s ease;
        cursor: pointer;
      }
      .lw-overlay.visible { opacity: 1; }
      .lw-overlay canvas {
        width: 90vw;
        height: 65vh;
        max-width: 900px;
        border-radius: 20px;
      }
      .lw-overlay-info {
        margin-top: 24px;
        text-align: center;
        color: #fff;
        font-family: 'Syne', sans-serif;
      }
      .lw-overlay-title {
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      .lw-overlay-sub {
        font-size: 13px;
        color: rgba(255,255,255,0.5);
        margin-top: 6px;
        font-family: 'DM Sans', sans-serif;
      }
      .lw-overlay-play {
        margin-top: 18px;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        color: #fff;
        font-family: 'DM Sans', sans-serif;
        font-size: 14px;
        font-weight: 500;
        padding: 10px 28px;
        border-radius: 999px;
        cursor: pointer;
        transition: background 0.2s;
      }
      .lw-overlay-play:hover { background: rgba(255,255,255,0.2); }

      @media (max-width: 768px) {
        .lw-grid { padding: 70px 12px 12px; gap: 8px; }
        .lw-tile { width: 140px; height: 140px; }
        .lw-overlay canvas { width: 95vw; height: 55vh; }
        .lw-overlay-title { font-size: 22px; }
      }
    `;
    document.head.appendChild(style);

    // compute tile size based on viewport
    tileSize = window.innerWidth < 768 ? 140 : 170;

    // grid container
    gridEl = document.createElement('div');
    gridEl.className = 'lw-grid';
    container.appendChild(gridEl);

    buildTiles();
    breathPhase = 0;
    lastMiniDraw = 0;
    rafId = requestAnimationFrame(animate);
  }

  function destroy() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    const style = document.getElementById('livingWallStyle');
    if (style) style.remove();
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    tiles = [];
    expandedTile = null;
    container = gridEl = null;
  }

  /* ----- build tiles ----- */
  function buildTiles() {
    if (!gridEl) return;
    gridEl.innerHTML = '';
    tiles = [];

    const filtered = getFilteredTracks();
    const res = tileSize; // canvas pixel resolution

    filtered.forEach((track, i) => {
      const idx = track.originalIndex;
      const visualType = hashIndex(idx);
      const colors = getGradientColors(idx);

      const el = document.createElement('div');
      el.className = 'lw-tile entering';

      const cvs = document.createElement('canvas');
      cvs.width = res;
      cvs.height = res;
      const ctx = cvs.getContext('2d');
      el.appendChild(cvs);

      const label = document.createElement('div');
      label.className = 'lw-tile-label';
      label.textContent = track.title;
      el.appendChild(label);

      // playing indicator
      if (state.currentTrack === idx) el.classList.add('playing');

      // click handler
      el.addEventListener('click', () => onTileClick(idx, visualType, colors, track.title));

      gridEl.appendChild(el);

      // generate persistent particle data for particle-type tiles
      let particles = null;
      if (visualType === 1) {
        particles = [];
        for (let p = 0; p < 25; p++) {
          particles.push({
            x: Math.random() * res,
            y: Math.random() * res,
            vx: (Math.random() - 0.5) * 0.6,
            vy: (Math.random() - 0.5) * 0.6,
            r: 1.5 + Math.random() * 2,
          });
        }
      }

      tiles.push({
        el, canvas: cvs, ctx, index: idx,
        visualType, particles, colors,
        phase: (i % 12) * 0.5 + Math.floor(i / 12) * 0.3,
      });

      // staggered entrance animation
      setTimeout(() => el.classList.remove('entering'), 30 + i * 18);
    });
  }

  /* ----- tile click → expand ----- */
  function onTileClick(trackIndex, visualType, colors, title) {
    // play the track
    if (typeof playTrack === 'function') playTrack(trackIndex);

    // build overlay
    if (overlayEl) overlayEl.remove();
    overlayEl = document.createElement('div');
    overlayEl.className = 'lw-overlay';

    expandedCanvas = document.createElement('canvas');
    expandedCanvas.width = 900;
    expandedCanvas.height = 600;
    expandedCtx = expandedCanvas.getContext('2d');
    overlayEl.appendChild(expandedCanvas);

    const info = document.createElement('div');
    info.className = 'lw-overlay-info';
    info.innerHTML = `
      <div class="lw-overlay-title">${escapeHtml(title)}</div>
      <div class="lw-overlay-sub">click anywhere to close</div>
    `;
    overlayEl.appendChild(info);

    overlayEl.addEventListener('click', (e) => {
      if (e.target === expandedCanvas) return;
      closeExpanded();
    });
    expandedCanvas.addEventListener('click', (e) => e.stopPropagation());

    document.body.appendChild(overlayEl);
    requestAnimationFrame(() => overlayEl.classList.add('visible'));

    expandedTile = { trackIndex, visualType, colors, title };
  }

  function closeExpanded() {
    if (!overlayEl) return;
    overlayEl.classList.remove('visible');
    setTimeout(() => {
      if (overlayEl) { overlayEl.remove(); overlayEl = null; }
      expandedTile = null;
      expandedCanvas = expandedCtx = null;
    }, 350);
  }

  /* ----- main animation loop ----- */
  function animate(time) {
    rafId = requestAnimationFrame(animate);
    breathPhase = time * BREATH_SPEED;

    // beat detection
    const freq = typeof getFrequencyData === 'function' ? getFrequencyData() : null;
    let bass = 0;
    if (freq) {
      for (let i = 0; i < 6; i++) bass += freq[i];
      bass = bass / (6 * 255);
      if (bass > BEAT_THRESHOLD && time - lastBeatTime > BEAT_COOLDOWN) {
        beatPulse = 1;
        lastBeatTime = time;
      }
    }
    beatPulse *= 0.92; // decay

    // breathing + beat transforms on tiles
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const breathScale = 1 + Math.sin(breathPhase + tile.phase) * BREATH_AMP;
      const pulse = 1 + beatPulse * 0.06;
      const s = breathScale * pulse;
      if (!tile.el.matches(':hover')) {
        tile.el.style.transform = `scale(${s.toFixed(4)})`;
      }
    }

    // throttle mini canvas draws
    if (time - lastMiniDraw > MINI_INTERVAL) {
      lastMiniDraw = time;
      const t = time * 0.001; // seconds
      for (let i = 0; i < tiles.length; i++) {
        drawTile(tiles[i], t, freq);
      }
    }

    // expanded view at full fps
    if (expandedTile && expandedCtx) {
      drawExpanded(time * 0.001, freq);
    }
  }

  /* =========================================================
     MINI TILE DRAWING
     ========================================================= */
  function drawTile(tile, t, freq) {
    const { ctx, canvas: cvs, visualType, colors } = tile;
    const w = cvs.width, h = cvs.height;
    ctx.clearRect(0, 0, w, h);

    // dark background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);

    switch (visualType) {
      case 0: drawWaves(ctx, w, h, t, colors, tile, freq, false); break;
      case 1: drawParticles(ctx, w, h, t, colors, tile, freq, false); break;
      case 2: drawRings(ctx, w, h, t, colors, tile, freq, false); break;
      case 3: drawBars(ctx, w, h, t, colors, tile, freq, false); break;
      case 4: drawSpiral(ctx, w, h, t, colors, tile, freq, false); break;
      case 5: drawMesh(ctx, w, h, t, colors, tile, freq, false); break;
    }
  }

  /* =========================================================
     EXPANDED DRAWING — full audio-reactive
     ========================================================= */
  function drawExpanded(t, freq) {
    const ctx = expandedCtx;
    const w = expandedCanvas.width, h = expandedCanvas.height;
    const { visualType, colors } = expandedTile;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#06060c';
    ctx.fillRect(0, 0, w, h);

    // pseudo tile object for expanded
    const fakeTile = { phase: 0, particles: expandedTile._particles || null };

    // init particles for expanded if needed
    if (visualType === 1 && !expandedTile._particles) {
      expandedTile._particles = [];
      for (let i = 0; i < 80; i++) {
        expandedTile._particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2,
          r: 2 + Math.random() * 3,
        });
      }
      fakeTile.particles = expandedTile._particles;
    }

    switch (visualType) {
      case 0: drawWaves(ctx, w, h, t, colors, fakeTile, freq, true); break;
      case 1: drawParticles(ctx, w, h, t, colors, fakeTile, freq, true); break;
      case 2: drawRings(ctx, w, h, t, colors, fakeTile, freq, true); break;
      case 3: drawBars(ctx, w, h, t, colors, fakeTile, freq, true); break;
      case 4: drawSpiral(ctx, w, h, t, colors, fakeTile, freq, true); break;
      case 5: drawMesh(ctx, w, h, t, colors, fakeTile, freq, true); break;
    }
  }

  /* =========================================================
     VISUAL TYPE 0 — WAVES
     Layered sine waves flowing across the canvas
     ========================================================= */
  function drawWaves(ctx, w, h, t, colors, tile, freq, expanded) {
    const layers = expanded ? 5 : 3;
    const amp = expanded ? h * 0.18 : h * 0.15;
    let audioBoost = 0;
    if (freq) {
      for (let i = 0; i < 10; i++) audioBoost += freq[i];
      audioBoost = audioBoost / (10 * 255);
    }

    for (let l = 0; l < layers; l++) {
      const phase = t * (0.8 + l * 0.3) + tile.phase + l * 1.2;
      const yOff = h * (0.3 + l * 0.12);
      const a = expanded ? 0.6 - l * 0.08 : 0.5 - l * 0.1;
      const waveAmp = amp * (1 + audioBoost * 1.5);

      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 3) {
        const nx = x / w;
        const y = yOff + Math.sin(nx * 4 + phase) * waveAmp * (0.5 + nx * 0.5)
                       + Math.sin(nx * 7 + phase * 1.3) * waveAmp * 0.3;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, yOff - waveAmp, 0, h);
      grad.addColorStop(0, hexToRGBA(colors[0], a));
      grad.addColorStop(1, hexToRGBA(colors[1], a * 0.3));
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  /* =========================================================
     VISUAL TYPE 1 — PARTICLES
     Drifting dots connected by lines when close
     ========================================================= */
  function drawParticles(ctx, w, h, t, colors, tile, freq, expanded) {
    const pts = tile.particles;
    if (!pts) return;
    const connectDist = expanded ? 120 : 40;
    let audioBoost = 0;
    if (freq) {
      for (let i = 3; i < 12; i++) audioBoost += freq[i];
      audioBoost = audioBoost / (9 * 255);
    }

    // update positions
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      p.x += p.vx * (1 + audioBoost * 3);
      p.y += p.vy * (1 + audioBoost * 3);
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;
    }

    // draw connections
    ctx.strokeStyle = hexToRGBA(colors[0], 0.15);
    ctx.lineWidth = expanded ? 1 : 0.5;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < connectDist) {
          ctx.globalAlpha = 1 - d / connectDist;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;

    // draw dots
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const glow = expanded ? 6 + audioBoost * 10 : 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 + audioBoost * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = colors[0];
      if (glow > 0) ctx.shadowBlur = glow;
      if (glow > 0) ctx.shadowColor = colors[0];
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  /* =========================================================
     VISUAL TYPE 2 — RINGS
     Concentric circles expanding from center, fading out
     ========================================================= */
  function drawRings(ctx, w, h, t, colors, tile, freq, expanded) {
    const cx = w / 2, cy = h / 2;
    const maxR = Math.min(w, h) * 0.48;
    const ringCount = expanded ? 10 : 6;
    const speed = 0.4;
    let audioBoost = 0;
    if (freq) {
      for (let i = 0; i < 8; i++) audioBoost += freq[i];
      audioBoost = audioBoost / (8 * 255);
    }

    for (let i = 0; i < ringCount; i++) {
      const phase = (t * speed + tile.phase * 0.1 + i / ringCount) % 1;
      const r = phase * maxR * (1 + audioBoost * 0.5);
      const alpha = (1 - phase) * (expanded ? 0.7 : 0.5);
      const lw = expanded ? 2.5 - phase * 1.5 : 1.5 - phase;

      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2);
      ctx.strokeStyle = hexToRGBA(i % 2 === 0 ? colors[0] : colors[1], alpha);
      ctx.lineWidth = Math.max(0.5, lw);
      if (expanded) {
        ctx.shadowBlur = 8 + audioBoost * 15;
        ctx.shadowColor = colors[0];
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  /* =========================================================
     VISUAL TYPE 3 — BARS
     Vertical EQ-style bars with sine-driven heights
     ========================================================= */
  function drawBars(ctx, w, h, t, colors, tile, freq, expanded) {
    const barCount = expanded ? 48 : 16;
    const gap = expanded ? 2 : 1;
    const barW = (w - gap * (barCount - 1)) / barCount;

    for (let i = 0; i < barCount; i++) {
      let barH;
      if (freq && expanded) {
        const fi = Math.floor(i / barCount * 64);
        barH = (freq[fi] || 0) / 255 * h * 0.85;
      } else {
        const nx = i / barCount;
        barH = (0.3 + 0.4 * Math.sin(nx * 5 + t * 2 + tile.phase)
              + 0.2 * Math.sin(nx * 11 + t * 3.3)) * h * 0.7;
      }

      const x = i * (barW + gap);
      const grad = ctx.createLinearGradient(x, h, x, h - barH);
      grad.addColorStop(0, hexToRGBA(colors[1], 0.8));
      grad.addColorStop(1, hexToRGBA(colors[0], expanded ? 0.9 : 0.6));
      ctx.fillStyle = grad;

      const radius = expanded ? 3 : 2;
      roundRect(ctx, x, h - barH, barW, barH, radius);
      ctx.fill();
    }
  }

  /* =========================================================
     VISUAL TYPE 4 — SPIRAL
     Points along a rotating spiral arm
     ========================================================= */
  function drawSpiral(ctx, w, h, t, colors, tile, freq, expanded) {
    const cx = w / 2, cy = h / 2;
    const arms = expanded ? 3 : 2;
    const points = expanded ? 120 : 50;
    const maxR = Math.min(w, h) * 0.44;
    let audioBoost = 0;
    if (freq) {
      for (let i = 5; i < 20; i++) audioBoost += freq[i];
      audioBoost = audioBoost / (15 * 255);
    }

    for (let a = 0; a < arms; a++) {
      const armOff = (a / arms) * Math.PI * 2;
      for (let i = 0; i < points; i++) {
        const frac = i / points;
        const angle = frac * Math.PI * 4 + t * 0.7 + armOff + tile.phase;
        const r = frac * maxR * (1 + audioBoost * 0.4);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        const size = (expanded ? 3.5 : 2) * (1 - frac * 0.5) * (1 + audioBoost * 1.5);
        const alpha = (1 - frac * 0.6) * (expanded ? 0.85 : 0.6);

        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, size), 0, Math.PI * 2);
        ctx.fillStyle = hexToRGBA(frac < 0.5 ? colors[0] : colors[1], alpha);
        ctx.fill();
      }
    }

    // center glow
    if (expanded) {
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30 + audioBoost * 40);
      grd.addColorStop(0, hexToRGBA(colors[0], 0.4));
      grd.addColorStop(1, hexToRGBA(colors[0], 0));
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    }
  }

  /* =========================================================
     VISUAL TYPE 5 — MESH
     Grid of dots that distort with a sine wave
     ========================================================= */
  function drawMesh(ctx, w, h, t, colors, tile, freq, expanded) {
    const cols = expanded ? 20 : 8;
    const rows = expanded ? 14 : 8;
    const spacingX = w / (cols + 1);
    const spacingY = h / (rows + 1);
    const distort = expanded ? 14 : 6;
    let audioBoost = 0;
    if (freq) {
      for (let i = 0; i < 16; i++) audioBoost += freq[i];
      audioBoost = audioBoost / (16 * 255);
    }

    const pts = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bx = (c + 1) * spacingX;
        const by = (r + 1) * spacingY;
        const dx = Math.sin(t * 1.2 + r * 0.5 + c * 0.3 + tile.phase) * distort * (1 + audioBoost * 2);
        const dy = Math.cos(t * 0.9 + r * 0.4 + c * 0.6 + tile.phase) * distort * (1 + audioBoost * 2);
        pts.push({ x: bx + dx, y: by + dy });
      }
    }

    // draw connections
    ctx.strokeStyle = hexToRGBA(colors[0], expanded ? 0.2 : 0.15);
    ctx.lineWidth = expanded ? 0.8 : 0.5;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (c < cols - 1) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
          ctx.stroke();
        }
        if (r < rows - 1) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[i + cols].x, pts[i + cols].y);
          ctx.stroke();
        }
      }
    }

    // draw dots
    for (let i = 0; i < pts.length; i++) {
      const dotR = expanded ? 2.5 + audioBoost * 3 : 1.5;
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = hexToRGBA(i % 3 === 0 ? colors[0] : colors[1], expanded ? 0.7 : 0.5);
      ctx.fill();
    }
  }

  /* =========================================================
     UTILITY
     ========================================================= */
  function hexToRGBA(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ----- view hooks ----- */
  function onSearch(query) {
    searchQuery = query;
    buildTiles();
  }

  function onTrackChange(index) {
    tiles.forEach(t => {
      t.el.classList.toggle('playing', t.index === index);
    });
  }

  /* ----- register ----- */
  registerView('livingwall', { init, destroy, onSearch, onTrackChange });
})();
