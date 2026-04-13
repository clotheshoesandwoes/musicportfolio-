/* =========================================================
   FREQUENCY-MAP.JS — "The Frequency Map" view (b074)
   ---------------------------------------------------------
   A dark sprawling constellation. Each star is a track,
   clustered loosely by vibe. The map drifts slowly,
   breathing. Click a star and it EXPLODES outward — the
   view zooms in, the star becomes a full audio-reactive
   environment (rings, particles, waveforms). Surrounding
   stars dim but stay visible. Search lights up matching
   stars like beacons. Scroll to zoom, drag to pan.

   Full-canvas 2D, no dependencies.
   ========================================================= */

(function () {
  /* ----- constants ----- */
  const STAR_BASE_R = 3;
  const STAR_HOVER_R = 10;
  const CLUSTER_SPREAD = 0.7;
  const DRIFT_SPEED = 0.00008;
  const TWINKLE_SPEED = 1.8;
  const BEAT_THRESHOLD = 0.3;
  const BEAT_COOLDOWN = 300;
  const NEBULA_COUNT = 6;

  // vibe clusters — keywords → cluster index
  const CLUSTER_KEYS = [
    { keys: ['rock', 'grunge', 'punk', 'metal', 'chains', 'nirvana', 'emo'], label: 'rock' },
    { keys: ['indie', 'valentine', 'moonlight', 'chill', 'acoustic', 'coffee'], label: 'indie' },
    { keys: ['rap', 'freestyle', 'hol up', 'bullshit', 'gucci', 'money', 'streets'], label: 'rap' },
    { keys: ['love', 'heart', 'girl', 'cute', 'romance', 'silk', 'french'], label: 'feels' },
    { keys: ['space', 'galaxy', 'star', 'cosmic', 'silo', 'robot', 'odst', 'mario'], label: 'space' },
    { keys: ['soul', 'jazz', 'funk', 'stayin', 'funky', 'moods'], label: 'soul' },
  ];

  const CLUSTER_COLORS = [
    '#f43f5e', // rock — red
    '#a3e635', // indie — lime
    '#f97316', // rap — orange
    '#ec4899', // feels — pink
    '#6366f1', // space — indigo
    '#eab308', // soul — gold
    '#06b6d4', // uncategorized — cyan
  ];

  /* ----- state ----- */
  let canvas, ctx, container;
  let W, H, rafId;
  let stars = [];
  let nebulas = [];
  let mx = -9999, my = -9999;
  let hovered = -1;
  let zoom = 1, targetZoom = 1;
  let panX = 0, panY = 0;
  let dragStart = null;
  let dragPanStart = null;
  let driftPhase = 0;
  let beatPulse = 0;
  let lastBeatTime = 0;
  let focusedStar = null;   // index into stars[] when zoomed into a star
  let focusAnim = 0;        // 0→1 transition into focused mode
  let searchHighlight = [];  // indices of matching stars
  let toastText = '', toastUntil = 0;
  let t0 = 0;
  let mapCX, mapCY;         // center of the map in world coords

  /* ----- helpers ----- */
  function hexToRGBA(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(x1, y1, x2, y2) { return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2); }
  function hash(i) { return ((i * 2654435761) >>> 0); }

  /* ----- classify track into cluster ----- */
  function classifyTrack(title) {
    const t = title.toLowerCase();
    for (let c = 0; c < CLUSTER_KEYS.length; c++) {
      for (const key of CLUSTER_KEYS[c].keys) {
        if (t.includes(key)) return c;
      }
    }
    return CLUSTER_KEYS.length; // uncategorized
  }

  /* ----- init ----- */
  function init(viewContainer) {
    container = viewContainer;
    canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block;cursor:crosshair;';
    container.appendChild(canvas);

    resize();
    buildStars();
    buildNebulas();

    container.addEventListener('mousemove', onMouse);
    container.addEventListener('mouseleave', onLeave);
    container.addEventListener('touchmove', onTouch, { passive: true });
    container.addEventListener('touchstart', onTouch, { passive: true });
    container.addEventListener('click', onClick);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('mousedown', onDragStart);
    container.addEventListener('mouseup', onDragEnd);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', resize);

    t0 = performance.now();
    rafId = requestAnimationFrame(draw);
  }

  function destroy() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    window.removeEventListener('resize', resize);
    document.removeEventListener('keydown', onKey);
    if (container) {
      container.removeEventListener('mousemove', onMouse);
      container.removeEventListener('mouseleave', onLeave);
      container.removeEventListener('touchmove', onTouch);
      container.removeEventListener('touchstart', onTouch);
      container.removeEventListener('click', onClick);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('mousedown', onDragStart);
      container.removeEventListener('mouseup', onDragEnd);
    }
    canvas = ctx = container = null;
    stars = [];
    nebulas = [];
    focusedStar = null;
  }

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mapCX = W / 2;
    mapCY = H / 2;
  }

  /* ----- build stars in clustered layout ----- */
  function buildStars() {
    stars = [];
    const filtered = getFilteredTracks();
    const n = filtered.length;
    const clusterCount = CLUSTER_KEYS.length + 1;
    const mapR = Math.min(W, H) * CLUSTER_SPREAD;

    // cluster centers arranged in a circle
    const clusterCenters = [];
    for (let c = 0; c < clusterCount; c++) {
      const angle = (c / clusterCount) * Math.PI * 2 - Math.PI / 2;
      const r = mapR * 0.55;
      clusterCenters.push({
        x: mapCX + Math.cos(angle) * r,
        y: mapCY + Math.sin(angle) * r,
      });
    }

    filtered.forEach((track, i) => {
      const idx = track.originalIndex;
      const cluster = classifyTrack(track.title);
      const center = clusterCenters[cluster];
      const colors = getGradientColors(idx);
      const clusterColor = CLUSTER_COLORS[cluster];

      // scatter within cluster with gaussian-ish distribution
      const h1 = hash(idx);
      const h2 = hash(idx + 1000);
      const scatter = mapR * 0.28;
      const sx = ((h1 % 1000) / 500 - 1) * scatter + ((h2 % 1000) / 1000 - 0.5) * scatter * 0.4;
      const sy = (((h1 >> 10) % 1000) / 500 - 1) * scatter + (((h2 >> 10) % 1000) / 1000 - 0.5) * scatter * 0.4;

      stars.push({
        x: center.x + sx,
        y: center.y + sy,
        index: idx,
        title: track.title,
        colors,
        clusterColor,
        cluster,
        brightness: 0.4 + (hash(idx + 500) % 600) / 1000,
        twinklePhase: (hash(idx + 200) % 1000) / 1000 * Math.PI * 2,
        size: STAR_BASE_R * (0.6 + (hash(idx + 300) % 500) / 500),
      });
    });
  }

  /* ----- nebula background blobs ----- */
  function buildNebulas() {
    nebulas = [];
    for (let i = 0; i < NEBULA_COUNT; i++) {
      nebulas.push({
        x: mapCX + (Math.random() - 0.5) * W * 0.8,
        y: mapCY + (Math.random() - 0.5) * H * 0.8,
        r: 80 + Math.random() * 150,
        color: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
        alpha: 0.03 + Math.random() * 0.03,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  /* ----- input ----- */
  function onMouse(e) {
    const r = container.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
    if (dragStart) {
      panX += (mx - dragStart.x) / zoom;
      panY += (my - dragStart.y) / zoom;
      dragStart = { x: mx, y: my };
    }
  }
  function onLeave() { mx = my = -9999; dragStart = null; canvas.style.cursor = 'crosshair'; }
  function onTouch(e) {
    const r = container.getBoundingClientRect();
    const t = e.touches[0];
    if (t) { mx = t.clientX - r.left; my = t.clientY - r.top; }
  }
  function onDragStart() {
    if (focusedStar !== null) return;
    dragStart = { x: mx, y: my };
    canvas.style.cursor = 'grabbing';
  }
  function onDragEnd() { dragStart = null; canvas.style.cursor = 'crosshair'; }
  function onWheel(e) {
    e.preventDefault();
    if (focusedStar !== null) return;
    targetZoom = Math.max(0.3, Math.min(3, targetZoom - e.deltaY * 0.001));
  }
  function onKey(e) {
    if (e.code === 'Escape' && focusedStar !== null) {
      unfocusStar();
    }
  }

  function onClick(e) {
    if (!container || stars.length === 0) return;

    // if focused, click outside the star zone unfocuses
    if (focusedStar !== null) {
      unfocusStar();
      return;
    }

    const r = container.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;

    // transform to world coords
    const wcx = (cx - W / 2) / zoom + mapCX - panX;
    const wcy = (cy - H / 2) / zoom + mapCY - panY;

    let best = -1, bestD = Infinity;
    for (let i = 0; i < stars.length; i++) {
      const d = dist(wcx, wcy, stars[i].x, stars[i].y);
      if (d < 20 && d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) return;

    // play the track
    const star = stars[best];
    if (typeof playTrack === 'function') playTrack(star.index);

    // focus on this star
    focusedStar = best;
    focusAnim = 0;
  }

  function unfocusStar() {
    focusedStar = null;
    focusAnim = 0;
  }

  /* =========================================================
     MAIN DRAW LOOP
     ========================================================= */
  function draw(now) {
    rafId = requestAnimationFrame(draw);
    if (!ctx) return;
    const t = (now - t0) * 0.001;
    driftPhase = t;

    zoom = lerp(zoom, targetZoom, 0.07);

    // audio
    const freq = typeof getFrequencyData === 'function' ? getFrequencyData() : null;
    let bass = 0, mid = 0, treble = 0;
    if (freq) {
      for (let i = 0; i < 6; i++) bass += freq[i]; bass /= (6 * 255);
      for (let i = 6; i < 24; i++) mid += freq[i]; mid /= (18 * 255);
      for (let i = 24; i < 64; i++) treble += freq[i]; treble /= (40 * 255);
      if (bass > BEAT_THRESHOLD && now - lastBeatTime > BEAT_COOLDOWN) {
        beatPulse = 1;
        lastBeatTime = now;
      }
    }
    beatPulse *= 0.92;

    // focus transition
    if (focusedStar !== null) {
      focusAnim = Math.min(1, focusAnim + 0.035);
    }

    // clear
    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // background gradient
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
    bg.addColorStop(0, '#0a0a18');
    bg.addColorStop(1, '#020208');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // focused mode: zoom into the star
    let focusZoom = zoom;
    let focusPanX = panX;
    let focusPanY = panY;
    if (focusedStar !== null && stars[focusedStar]) {
      const fs = stars[focusedStar];
      const tgtZoom = 4;
      focusZoom = lerp(zoom, tgtZoom, focusAnim);
      focusPanX = lerp(panX, mapCX - fs.x, focusAnim);
      focusPanY = lerp(panY, mapCY - fs.y, focusAnim);
    }

    ctx.translate(W / 2, H / 2);
    ctx.scale(focusZoom, focusZoom);
    ctx.translate(-mapCX + focusPanX, -mapCY + focusPanY);

    // --- nebulas ---
    for (const nb of nebulas) {
      const pulse = 1 + Math.sin(t * 0.3 + nb.phase) * 0.15 + bass * 0.3;
      const grad = ctx.createRadialGradient(nb.x, nb.y, 0, nb.x, nb.y, nb.r * pulse);
      grad.addColorStop(0, hexToRGBA(nb.color, nb.alpha + bass * 0.02));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(nb.x - nb.r * 2, nb.y - nb.r * 2, nb.r * 4, nb.r * 4);
    }

    // --- constellation lines between same-cluster stars ---
    ctx.lineWidth = 0.3;
    for (let i = 0; i < stars.length; i++) {
      const si = stars[i];
      for (let j = i + 1; j < stars.length; j++) {
        const sj = stars[j];
        if (si.cluster !== sj.cluster) continue;
        const d = dist(si.x, si.y, sj.x, sj.y);
        const maxD = 70;
        if (d < maxD) {
          const alpha = (1 - d / maxD) * 0.12;
          ctx.beginPath();
          ctx.moveTo(si.x, si.y);
          ctx.lineTo(sj.x, sj.y);
          ctx.strokeStyle = hexToRGBA(si.clusterColor, alpha);
          ctx.stroke();
        }
      }
    }

    // --- stars ---
    // find hovered star in world coords
    const wmx = (mx - W / 2) / focusZoom + mapCX - focusPanX;
    const wmy = (my - H / 2) / focusZoom + mapCY - focusPanY;
    hovered = -1;
    let hoverBestD = Infinity;
    for (let i = 0; i < stars.length; i++) {
      const d = dist(wmx, wmy, stars[i].x, stars[i].y);
      if (d < 18 && d < hoverBestD) { hoverBestD = d; hovered = i; }
    }

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const isHov = hovered === i;
      const isPlaying = state.currentTrack === s.index;
      const isFocused = focusedStar === i;
      const isSearchHit = searchHighlight.includes(i);

      // twinkle
      const twinkle = 0.5 + 0.5 * Math.sin(t * TWINKLE_SPEED + s.twinklePhase);
      const bright = s.brightness * twinkle;

      // dim non-focused stars when zoomed in
      let dimFactor = 1;
      if (focusedStar !== null && !isFocused) {
        dimFactor = 1 - focusAnim * 0.85;
      }

      const r = isFocused ? STAR_HOVER_R * 1.5
              : isHov ? STAR_HOVER_R
              : isPlaying ? s.size * 2
              : s.size;

      // glow
      if (isHov || isPlaying || isSearchHit || isFocused) {
        const glowR = r * (isFocused ? 8 : 4);
        const glowColor = isFocused ? s.colors[0] : isPlaying ? '#9cff3a' : isSearchHit ? '#fff' : s.clusterColor;
        const glowAlpha = (isFocused ? 0.3 : 0.2) + bass * 0.15;
        const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowR);
        grd.addColorStop(0, hexToRGBA(glowColor, glowAlpha * dimFactor));
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(s.x - glowR, s.y - glowR, glowR * 2, glowR * 2);
      }

      // star dot
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * (1 + beatPulse * 0.15), 0, Math.PI * 2);
      const dotAlpha = (isHov || isFocused ? 1 : bright) * dimFactor;
      ctx.fillStyle = hexToRGBA(isPlaying ? '#9cff3a' : s.clusterColor, dotAlpha);
      ctx.fill();

      // cross sparkle on bright stars
      if ((bright > 0.7 || isHov || isSearchHit) && !isFocused) {
        const sparkLen = r * (isHov ? 3 : 2);
        const sparkA = (isSearchHit ? 0.5 : 0.2) * dimFactor;
        ctx.strokeStyle = hexToRGBA(s.clusterColor, sparkA);
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(s.x - sparkLen, s.y); ctx.lineTo(s.x + sparkLen, s.y);
        ctx.moveTo(s.x, s.y - sparkLen); ctx.lineTo(s.x, s.y + sparkLen);
        ctx.stroke();
      }

      // label on hover
      if (isHov && focusedStar === null) {
        ctx.font = "500 11px 'DM Sans', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255,255,255,${0.9 * dimFactor})`;
        ctx.fillText(s.title, s.x, s.y - r - 8);
        // cluster label
        const clusterLabel = s.cluster < CLUSTER_KEYS.length ? CLUSTER_KEYS[s.cluster].label : 'misc';
        ctx.font = "400 9px 'JetBrains Mono', monospace";
        ctx.fillStyle = hexToRGBA(s.clusterColor, 0.6);
        ctx.fillText(clusterLabel, s.x, s.y - r - 20);
      }
    }

    // --- focused star: audio-reactive explosion ---
    if (focusedStar !== null && stars[focusedStar] && focusAnim > 0.2) {
      drawStarExplosion(stars[focusedStar], t, freq, bass, mid, treble);
    }

    ctx.restore(); // undo zoom/pan

    // --- HUD ---
    // cluster legend (top-left, small)
    if (focusedStar === null) {
      ctx.font = "400 10px 'JetBrains Mono', monospace";
      ctx.textAlign = 'left';
      for (let c = 0; c < CLUSTER_KEYS.length; c++) {
        const y = 85 + c * 16;
        ctx.fillStyle = CLUSTER_COLORS[c];
        ctx.fillRect(16, y - 4, 6, 6);
        ctx.fillStyle = hexToRGBA(CLUSTER_COLORS[c], 0.6);
        ctx.fillText(CLUSTER_KEYS[c].label, 28, y + 2);
      }
      // uncategorized
      const y = 85 + CLUSTER_KEYS.length * 16;
      ctx.fillStyle = CLUSTER_COLORS[CLUSTER_KEYS.length];
      ctx.fillRect(16, y - 4, 6, 6);
      ctx.fillStyle = hexToRGBA(CLUSTER_COLORS[CLUSTER_KEYS.length], 0.6);
      ctx.fillText('misc', 28, y + 2);
    }

    // focused star info
    if (focusedStar !== null && stars[focusedStar]) {
      const fs = stars[focusedStar];
      const fade = Math.min(1, focusAnim * 2);
      ctx.textAlign = 'center';
      ctx.font = "700 24px 'Syne', sans-serif";
      ctx.fillStyle = `rgba(255,255,255,${fade * 0.9})`;
      ctx.fillText(fs.title, W / 2, H - 100);

      const cl = fs.cluster < CLUSTER_KEYS.length ? CLUSTER_KEYS[fs.cluster].label : 'misc';
      ctx.font = "400 12px 'DM Sans', sans-serif";
      ctx.fillStyle = hexToRGBA(fs.clusterColor, fade * 0.6);
      ctx.fillText(cl + '  ·  click anywhere to return', W / 2, H - 75);
    }

    // toast
    if (now < toastUntil && toastText) {
      const fade = Math.min(1, (toastUntil - now) / 500);
      ctx.font = "600 14px 'Syne', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,255,255,${fade * 0.8})`;
      ctx.fillText(toastText, W / 2, H - 50);
    }

    // hint
    if (t < 5 && focusedStar === null) {
      const fade = Math.max(0, 1 - t / 4);
      ctx.font = "400 11px 'DM Sans', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,255,255,${fade * 0.3})`;
      ctx.fillText('scroll to zoom · drag to pan · click a star to explore', W / 2, H - 30);
    }
  }

  /* =========================================================
     FOCUSED STAR — audio-reactive explosion
     Rings, particles, waveform — all driven by frequency data
     ========================================================= */
  function drawStarExplosion(star, t, freq, bass, mid, treble) {
    const sx = star.x, sy = star.y;
    const intensity = focusAnim;

    // expanding rings
    const ringCount = 6;
    for (let r = 0; r < ringCount; r++) {
      const phase = (t * 0.5 + r / ringCount) % 1;
      const radius = phase * 80 * intensity * (1 + bass * 1.5);
      const alpha = (1 - phase) * 0.5 * intensity;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(1, radius), 0, Math.PI * 2);
      ctx.strokeStyle = hexToRGBA(r % 2 === 0 ? star.colors[0] : star.clusterColor, alpha);
      ctx.lineWidth = 2 - phase;
      ctx.shadowBlur = 10 + bass * 20;
      ctx.shadowColor = star.colors[0];
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // orbiting particles
    const particleCount = 24;
    for (let p = 0; p < particleCount; p++) {
      const angle = (p / particleCount) * Math.PI * 2 + t * 0.8;
      const orbitR = 30 + (freq ? (freq[p % 64] || 0) / 255 * 50 : 15) * intensity;
      const px = sx + Math.cos(angle) * orbitR;
      const py = sy + Math.sin(angle) * orbitR;
      const pr = 1.5 + (freq ? (freq[p % 64] || 0) / 255 * 3 : 1) * intensity;

      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = hexToRGBA(star.colors[p % 2], 0.7 * intensity);
      ctx.fill();
    }

    // radial waveform
    if (freq && intensity > 0.5) {
      ctx.beginPath();
      const wavePoints = 64;
      for (let i = 0; i <= wavePoints; i++) {
        const angle = (i / wavePoints) * Math.PI * 2;
        const amp = (freq[i] || 0) / 255 * 40 * intensity;
        const r = 20 + amp;
        const px = sx + Math.cos(angle) * r;
        const py = sy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = hexToRGBA(star.colors[0], 0.35 * intensity);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // filled inner shape
      const innerGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 60 * intensity);
      innerGrad.addColorStop(0, hexToRGBA(star.colors[0], 0.15 * intensity));
      innerGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = innerGrad;
      ctx.fill();
    }

    // central glow
    const coreR = 15 + bass * 25 * intensity;
    const coreGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, coreR);
    coreGrad.addColorStop(0, hexToRGBA(star.colors[0], 0.6 * intensity));
    coreGrad.addColorStop(0.5, hexToRGBA(star.clusterColor, 0.2 * intensity));
    coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coreGrad;
    ctx.fillRect(sx - coreR, sy - coreR, coreR * 2, coreR * 2);
  }

  /* ----- view hooks ----- */
  function onSearch(query) {
    searchHighlight = [];
    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      stars.forEach((s, i) => {
        if (s.title.toLowerCase().includes(q)) searchHighlight.push(i);
      });
    }
    // rebuild if we need filtered view
    if (!query || !query.trim()) {
      buildStars();
      buildNebulas();
    }
  }

  function onTrackChange(index) {
    // nothing special needed, draw loop reads state.currentTrack
  }

  /* ----- register ----- */
  registerView('freqmap', { init, destroy, onSearch, onTrackChange });
})();
