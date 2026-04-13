/* =========================================================
   TAPE-SPINE.JS — "The Tape Spine" view (b075)
   ---------------------------------------------------------
   Vertical full-viewport scroll. Each track is an entire
   living dimension — multi-layered procedural scene with
   3-5 animated systems running simultaneously. Scrolling
   morphs fluidly between dimensions with crossfade +
   dimensional tear. Single canvas, virtual scroll for
   performance. Click/tap to play the visible track.

   8 dimension types, each genuinely complex:
   0 — Neon Horizon (perspective grid, wireframes, particles)
   1 — Deep Ocean (waves, bubbles, caustics, bioluminescence)
   2 — Digital Void (matrix rain, glitch blocks, scan lines)
   3 — Cosmic Drift (galaxy arms, dust, shooting stars)
   4 — Crystal Cave (formations, reflections, gem particles)
   5 — Electric Storm (lightning, rain, cloud layers, flash)
   6 — Organic Growth (tendrils, spores, pulsing cells)
   7 — Geometric Void (wireframe shapes, tessellation)

   Full-canvas 2D, no dependencies.
   ========================================================= */

(function () {
  /* ----- constants ----- */
  const SCENE_TYPES = 8;
  const BEAT_THRESHOLD = 0.32;
  const BEAT_COOLDOWN = 280;

  /* ----- state ----- */
  let canvas, ctx, container, scrollContainer, scrollInner;
  let W, H, rafId;
  let currentPage = 0;
  let blendFactor = 0;       // 0 = fully currentPage, 1 = fully nextPage
  let trackList = [];         // filtered tracks
  let beatPulse = 0, lastBeatTime = 0;
  let t0 = 0;
  let scrollY = 0;
  // persistent particle pools per scene slot (current + next only)
  let sceneParticles = {};

  /* ----- helpers ----- */
  function hexToRGBA(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  function hexToRGB(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }
  function rgbStr(r, g, b, a) { return `rgba(${r|0},${g|0},${b|0},${a})`; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hash(i) { return ((i * 2654435761) >>> 0); }
  function sceneType(idx) { return hash(idx) % SCENE_TYPES; }

  /* ----- init ----- */
  function init(viewContainer) {
    container = viewContainer;

    // inject styles
    const style = document.createElement('style');
    style.id = 'tapeSpineStyle';
    style.textContent = `
      .ts-wrap { position:relative; width:100%; height:100%; overflow:hidden; }
      .ts-scroll { position:absolute; inset:0; overflow-y:auto; overflow-x:hidden;
        scrollbar-width:thin; scrollbar-color:rgba(255,255,255,0.15) transparent;
        -webkit-overflow-scrolling:touch; }
      .ts-scroll::-webkit-scrollbar { width:4px; }
      .ts-scroll::-webkit-scrollbar-track { background:transparent; }
      .ts-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15); border-radius:2px; }
      .ts-inner { width:100%; }
      .ts-canvas { position:absolute; inset:0; pointer-events:none; }
      .ts-nav { position:absolute; right:16px; top:50%; transform:translateY(-50%);
        display:flex; flex-direction:column; gap:4px; z-index:10; }
      .ts-dot { width:6px; height:6px; border-radius:50%; background:rgba(255,255,255,0.2);
        cursor:pointer; transition:all 0.3s; border:none; padding:0; }
      .ts-dot.active { background:#fff; box-shadow:0 0 8px #fff; transform:scale(1.5); }
      .ts-dot:hover { background:rgba(255,255,255,0.6); }
      .ts-counter { position:absolute; left:20px; bottom:20px; font-family:'JetBrains Mono',monospace;
        font-size:11px; color:rgba(255,255,255,0.3); z-index:10; pointer-events:none; }
      @media(max-width:768px) { .ts-nav { right:6px; gap:2px; }
        .ts-dot { width:4px; height:4px; } }
    `;
    document.head.appendChild(style);

    trackList = getFilteredTracks();

    // structure
    const wrap = document.createElement('div');
    wrap.className = 'ts-wrap';

    canvas = document.createElement('canvas');
    canvas.className = 'ts-canvas';
    wrap.appendChild(canvas);

    scrollContainer = document.createElement('div');
    scrollContainer.className = 'ts-scroll';
    scrollInner = document.createElement('div');
    scrollInner.className = 'ts-inner';
    scrollContainer.appendChild(scrollInner);
    wrap.appendChild(scrollContainer);

    // nav dots (max 40 visible, otherwise too many)
    const nav = document.createElement('div');
    nav.className = 'ts-nav';
    const dotCount = Math.min(trackList.length, 50);
    for (let i = 0; i < dotCount; i++) {
      const dot = document.createElement('button');
      dot.className = 'ts-dot';
      const targetPage = Math.floor(i / dotCount * trackList.length);
      dot.addEventListener('click', () => {
        scrollContainer.scrollTop = targetPage * H;
      });
      nav.appendChild(dot);
    }
    wrap.appendChild(nav);

    // counter
    const counter = document.createElement('div');
    counter.className = 'ts-counter';
    counter.id = 'tsCounter';
    wrap.appendChild(counter);

    container.appendChild(wrap);

    resize();
    scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    scrollContainer.addEventListener('click', onClick);
    window.addEventListener('resize', resize);

    t0 = performance.now();
    sceneParticles = {};
    rafId = requestAnimationFrame(draw);
  }

  function destroy() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    window.removeEventListener('resize', resize);
    const style = document.getElementById('tapeSpineStyle');
    if (style) style.remove();
    canvas = ctx = container = scrollContainer = scrollInner = null;
    trackList = [];
    sceneParticles = {};
  }

  function resize() {
    if (!canvas || !scrollInner || !scrollContainer) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.parentElement.offsetWidth;
    H = canvas.parentElement.offsetHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scrollInner.style.height = (trackList.length * H) + 'px';
    onScroll();
  }

  function onScroll() {
    if (!scrollContainer) return;
    scrollY = scrollContainer.scrollTop;
    currentPage = Math.floor(scrollY / H);
    blendFactor = (scrollY % H) / H;
    if (currentPage >= trackList.length) currentPage = trackList.length - 1;

    // update nav dots
    const dots = container.querySelectorAll('.ts-dot');
    const dotCount = dots.length;
    dots.forEach((d, i) => {
      const p = Math.floor(i / dotCount * trackList.length);
      d.classList.toggle('active', p === currentPage);
    });

    // counter
    const counter = document.getElementById('tsCounter');
    if (counter) counter.textContent = `${currentPage + 1} / ${trackList.length}`;
  }

  function onClick() {
    if (trackList.length === 0) return;
    const idx = Math.min(currentPage, trackList.length - 1);
    const track = trackList[idx];
    if (track && typeof playTrack === 'function') {
      playTrack(track.originalIndex);
    }
  }

  /* ----- get or create particles for a page ----- */
  function getParticles(page, type) {
    if (sceneParticles[page]) return sceneParticles[page];
    const p = createParticles(type);
    sceneParticles[page] = p;
    // keep only 4 pages cached
    const keys = Object.keys(sceneParticles).map(Number);
    if (keys.length > 4) {
      const toRemove = keys.filter(k => Math.abs(k - currentPage) > 2);
      toRemove.forEach(k => delete sceneParticles[k]);
    }
    return p;
  }

  function createParticles(type) {
    const p = { main: [], secondary: [], tertiary: [] };
    switch (type) {
      case 0: // neon horizon — floating shapes + particle trails
        for (let i = 0; i < 12; i++) p.main.push({ x: Math.random(), y: 0.2 + Math.random() * 0.4, z: 0.3 + Math.random() * 0.7, rot: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.02, sides: 3 + Math.floor(Math.random() * 4), size: 15 + Math.random() * 30 });
        for (let i = 0; i < 60; i++) p.secondary.push({ x: Math.random(), y: Math.random(), vy: -0.001 - Math.random() * 0.002, alpha: Math.random() });
        break;
      case 1: // deep ocean — bubbles + bioluminescent + caustics
        for (let i = 0; i < 40; i++) p.main.push({ x: Math.random(), y: Math.random(), r: 2 + Math.random() * 6, vy: -0.0005 - Math.random() * 0.002, wobble: Math.random() * Math.PI * 2 });
        for (let i = 0; i < 30; i++) p.secondary.push({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 3, pulse: Math.random() * Math.PI * 2, drift: (Math.random() - 0.5) * 0.0005 });
        break;
      case 2: // digital void — rain columns + glitch blocks
        for (let i = 0; i < 35; i++) p.main.push({ x: Math.random(), y: Math.random(), speed: 0.003 + Math.random() * 0.006, chars: Array.from({length: 8 + Math.floor(Math.random() * 12)}, () => String.fromCharCode(0x30A0 + Math.random() * 96)), head: Math.floor(Math.random() * 20) });
        for (let i = 0; i < 8; i++) p.secondary.push({ x: Math.random(), y: Math.random(), w: 0.05 + Math.random() * 0.15, h: 0.01 + Math.random() * 0.04, life: Math.random() });
        break;
      case 3: // cosmic drift — dust + shooting stars
        for (let i = 0; i < 120; i++) p.main.push({ x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 2, brightness: 0.2 + Math.random() * 0.8, twinkle: Math.random() * Math.PI * 2 });
        for (let i = 0; i < 3; i++) p.secondary.push({ x: Math.random(), y: Math.random(), angle: Math.PI * 0.7 + Math.random() * 0.3, speed: 0.005 + Math.random() * 0.005, life: 0, maxLife: 0.5 + Math.random() * 0.5, active: false, cooldown: Math.random() * 200 });
        break;
      case 4: // crystal cave — formations + gem particles
        for (let i = 0; i < 15; i++) { const fromTop = Math.random() > 0.5; p.main.push({ x: 0.05 + Math.random() * 0.9, fromTop, length: 0.08 + Math.random() * 0.18, width: 0.01 + Math.random() * 0.03, hue: Math.random() * 60 + 180 }); }
        for (let i = 0; i < 40; i++) p.secondary.push({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 3, vx: (Math.random() - 0.5) * 0.001, vy: (Math.random() - 0.5) * 0.001, hue: Math.random() * 60 + 180 });
        break;
      case 5: // electric storm — lightning + rain
        for (let i = 0; i < 80; i++) p.main.push({ x: Math.random(), y: Math.random(), vy: 0.008 + Math.random() * 0.012, length: 0.02 + Math.random() * 0.04 });
        p.secondary.push({ segments: [], life: 0, cooldown: 60 + Math.random() * 120 });
        break;
      case 6: // organic growth — tendrils + spores
        for (let i = 0; i < 6; i++) p.main.push({ originX: Math.random(), originY: 0.9 + Math.random() * 0.1, segments: 20 + Math.floor(Math.random() * 15), maxLen: 0.3 + Math.random() * 0.3, phase: Math.random() * Math.PI * 2, speed: 0.5 + Math.random() * 0.5 });
        for (let i = 0; i < 50; i++) p.secondary.push({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 2.5, vx: (Math.random() - 0.5) * 0.0008, vy: -0.0003 - Math.random() * 0.001, alpha: 0.3 + Math.random() * 0.5 });
        break;
      case 7: // geometric void — wireframe shapes
        for (let i = 0; i < 5; i++) p.main.push({ x: 0.15 + Math.random() * 0.7, y: 0.15 + Math.random() * 0.7, size: 40 + Math.random() * 80, rotX: Math.random() * Math.PI, rotY: Math.random() * Math.PI, rotSpeedX: (Math.random() - 0.5) * 0.01, rotSpeedY: (Math.random() - 0.5) * 0.015, type: Math.floor(Math.random() * 3) }); // 0=cube,1=octa,2=icosa
        for (let i = 0; i < 40; i++) p.secondary.push({ x: Math.random(), y: Math.random(), size: 2 + Math.random() * 4, rot: Math.random() * Math.PI * 2, speed: (Math.random() - 0.5) * 0.003 });
        break;
    }
    return p;
  }

  /* =========================================================
     MAIN DRAW LOOP
     ========================================================= */
  function draw(now) {
    rafId = requestAnimationFrame(draw);
    if (!ctx || trackList.length === 0) return;
    const t = (now - t0) * 0.001;

    // audio
    const freq = typeof getFrequencyData === 'function' ? getFrequencyData() : null;
    let bass = 0, mid = 0, treble = 0;
    if (freq) {
      for (let i = 0; i < 6; i++) bass += freq[i]; bass /= (6 * 255);
      for (let i = 6; i < 24; i++) mid += freq[i]; mid /= (18 * 255);
      for (let i = 24; i < 64; i++) treble += freq[i]; treble /= (40 * 255);
      if (bass > BEAT_THRESHOLD && now - lastBeatTime > BEAT_COOLDOWN) {
        beatPulse = 1; lastBeatTime = now;
      }
    }
    beatPulse *= 0.91;

    const pageA = Math.min(currentPage, trackList.length - 1);
    const pageB = Math.min(pageA + 1, trackList.length - 1);
    const trackA = trackList[pageA];
    const trackB = trackList[pageB];
    const colorsA = getGradientColors(trackA.originalIndex);
    const colorsB = getGradientColors(trackB.originalIndex);
    const typeA = sceneType(trackA.originalIndex);
    const typeB = sceneType(trackB.originalIndex);

    // blend colors
    const rgbA0 = hexToRGB(colorsA[0]), rgbA1 = hexToRGB(colorsA[1]);
    const rgbB0 = hexToRGB(colorsB[0]), rgbB1 = hexToRGB(colorsB[1]);
    const c0 = [lerp(rgbA0[0], rgbB0[0], blendFactor), lerp(rgbA0[1], rgbB0[1], blendFactor), lerp(rgbA0[2], rgbB0[2], blendFactor)];
    const c1 = [lerp(rgbA1[0], rgbB1[0], blendFactor), lerp(rgbA1[1], rgbB1[1], blendFactor), lerp(rgbA1[2], rgbB1[2], blendFactor)];

    // clear with blended dark bg
    ctx.fillStyle = `rgb(${lerp(5,3,blendFactor)|0},${lerp(5,3,blendFactor)|0},${lerp(12,8,blendFactor)|0})`;
    ctx.fillRect(0, 0, W, H);

    // draw scene A
    ctx.save();
    ctx.globalAlpha = 1 - blendFactor;
    drawScene(typeA, getParticles(pageA, typeA), colorsA, t, freq, bass, mid, treble);
    ctx.restore();

    // draw scene B (blending in)
    if (blendFactor > 0.01 && pageA !== pageB) {
      ctx.save();
      ctx.globalAlpha = blendFactor;
      drawScene(typeB, getParticles(pageB, typeB), colorsB, t, freq, bass, mid, treble);
      ctx.restore();
    }

    // dimensional tear line at blend boundary
    if (blendFactor > 0.05 && blendFactor < 0.95) {
      const tearY = H * (1 - blendFactor);
      ctx.save();
      const tearGrad = ctx.createLinearGradient(0, tearY - 30, 0, tearY + 30);
      tearGrad.addColorStop(0, 'rgba(0,0,0,0)');
      tearGrad.addColorStop(0.4, rgbStr(c0[0], c0[1], c0[2], 0.5 + beatPulse * 0.3));
      tearGrad.addColorStop(0.5, '#fff');
      tearGrad.addColorStop(0.6, rgbStr(c1[0], c1[1], c1[2], 0.5 + beatPulse * 0.3));
      tearGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = tearGrad;
      ctx.fillRect(0, tearY - 30, W, 60);
      // glitch offset strips near the tear
      for (let i = 0; i < 5; i++) {
        const gy = tearY - 15 + Math.random() * 30;
        const gx = Math.random() * W * 0.3;
        const gw = 30 + Math.random() * 100;
        ctx.fillStyle = rgbStr(c0[0], c0[1], c0[2], 0.15);
        ctx.fillRect(gx, gy, gw, 2);
      }
      ctx.restore();
    }

    // track title + number overlay
    const titleTrack = blendFactor < 0.5 ? trackA : trackB;
    const titleAlpha = blendFactor < 0.5 ? 1 - blendFactor * 2 : (blendFactor - 0.5) * 2;
    const isPlaying = state.currentTrack === titleTrack.originalIndex;

    ctx.save();
    ctx.textAlign = 'center';
    // track number (big, faint)
    ctx.font = "700 120px 'Syne', sans-serif";
    ctx.fillStyle = `rgba(255,255,255,${0.04 * titleAlpha})`;
    ctx.fillText(String(pageA + 1).padStart(3, '0'), W / 2, H / 2 + 40);
    // track title
    ctx.font = `700 ${W < 768 ? 28 : 42}px 'Syne', sans-serif`;
    ctx.fillStyle = `rgba(255,255,255,${0.85 * titleAlpha})`;
    ctx.fillText(titleTrack.title, W / 2, H / 2 - 10);
    // play hint
    ctx.font = "400 13px 'DM Sans', sans-serif";
    ctx.fillStyle = `rgba(255,255,255,${0.35 * titleAlpha})`;
    ctx.fillText(isPlaying ? 'now playing' : 'click to play', W / 2, H / 2 + 25);
    // playing indicator ring
    if (isPlaying) {
      const pr = 50 + Math.sin(t * 3) * 5 + beatPulse * 15;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, pr, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(156,255,58,${0.3 * titleAlpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  /* =========================================================
     SCENE RENDERERS — one per type, all multi-layered
     ========================================================= */
  function drawScene(type, parts, colors, t, freq, bass, mid, treble) {
    switch (type) {
      case 0: drawNeonHorizon(parts, colors, t, freq, bass, mid); break;
      case 1: drawDeepOcean(parts, colors, t, freq, bass, mid); break;
      case 2: drawDigitalVoid(parts, colors, t, freq, bass, treble); break;
      case 3: drawCosmicDrift(parts, colors, t, freq, bass, mid); break;
      case 4: drawCrystalCave(parts, colors, t, freq, bass, treble); break;
      case 5: drawElectricStorm(parts, colors, t, freq, bass, mid); break;
      case 6: drawOrganicGrowth(parts, colors, t, freq, bass, mid); break;
      case 7: drawGeometricVoid(parts, colors, t, freq, bass, treble); break;
    }
  }

  /* --- TYPE 0: NEON HORIZON --- */
  function drawNeonHorizon(p, colors, t, freq, bass, mid) {
    const horizon = H * 0.6;
    // perspective grid floor
    ctx.strokeStyle = hexToRGBA(colors[0], 0.15 + bass * 0.1);
    ctx.lineWidth = 0.5;
    // horizontal lines
    for (let i = 1; i <= 20; i++) {
      const frac = i / 20;
      const y = horizon + frac * frac * (H - horizon);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // vertical lines (converge to center)
    for (let i = -10; i <= 10; i++) {
      const bottomX = W / 2 + i * (W / 10);
      ctx.beginPath();
      ctx.moveTo(W / 2, horizon);
      ctx.lineTo(bottomX, H);
      ctx.stroke();
    }
    // neon sun
    const sunR = 50 + bass * 20;
    const sunGrad = ctx.createRadialGradient(W / 2, horizon - 30, 0, W / 2, horizon - 30, sunR * 2);
    sunGrad.addColorStop(0, hexToRGBA(colors[0], 0.5));
    sunGrad.addColorStop(0.5, hexToRGBA(colors[1], 0.15));
    sunGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, W, H);
    // sun disk
    ctx.beginPath(); ctx.arc(W / 2, horizon - 30, sunR * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = hexToRGBA(colors[0], 0.7);
    ctx.fill();
    // horizontal stripe cutouts on sun
    for (let s = 0; s < 5; s++) {
      const sy = horizon - 30 - sunR * 0.3 + s * sunR * 0.15;
      ctx.fillStyle = 'rgba(5,5,12,0.6)';
      ctx.fillRect(W / 2 - sunR, sy, sunR * 2, 2);
    }
    // floating wireframe shapes
    for (const shape of p.main) {
      shape.rot += shape.rotSpeed;
      const sx = shape.x * W, sy = shape.y * H;
      const sz = shape.size * (1 + mid * 0.5);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(shape.rot);
      ctx.strokeStyle = hexToRGBA(colors[0], 0.3 + mid * 0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let v = 0; v <= shape.sides; v++) {
        const a = (v / shape.sides) * Math.PI * 2;
        const px = Math.cos(a) * sz, py = Math.sin(a) * sz;
        v === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
      // inner ring
      ctx.beginPath();
      for (let v = 0; v <= shape.sides; v++) {
        const a = (v / shape.sides) * Math.PI * 2 + 0.3;
        const px = Math.cos(a) * sz * 0.5, py = Math.sin(a) * sz * 0.5;
        v === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
      ctx.restore();
    }
    // particle trails rising
    for (const pt of p.secondary) {
      pt.y += pt.vy;
      if (pt.y < -0.05) { pt.y = 1.05; pt.x = Math.random(); }
      const px = pt.x * W + Math.sin(t * 2 + pt.alpha * 10) * 15;
      ctx.beginPath();
      ctx.arc(px, pt.y * H, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = hexToRGBA(colors[0], 0.3 + Math.sin(t + pt.alpha * 5) * 0.2);
      ctx.fill();
    }
  }

  /* --- TYPE 1: DEEP OCEAN --- */
  function drawDeepOcean(p, colors, t, freq, bass, mid) {
    // depth gradient
    const depthGrad = ctx.createLinearGradient(0, 0, 0, H);
    depthGrad.addColorStop(0, hexToRGBA(colors[0], 0.08));
    depthGrad.addColorStop(1, hexToRGBA(colors[1], 0.15));
    ctx.fillStyle = depthGrad;
    ctx.fillRect(0, 0, W, H);
    // caustic light beams from above
    for (let i = 0; i < 6; i++) {
      const bx = W * (0.1 + i * 0.15) + Math.sin(t * 0.3 + i) * 40;
      const bw = 20 + Math.sin(t * 0.5 + i * 2) * 10 + bass * 30;
      const grad = ctx.createLinearGradient(bx, 0, bx + bw * 2, H);
      grad.addColorStop(0, hexToRGBA(colors[0], 0.06));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(bx, 0); ctx.lineTo(bx + bw, 0);
      ctx.lineTo(bx + bw * 2, H); ctx.lineTo(bx - bw * 0.5, H);
      ctx.closePath(); ctx.fill();
    }
    // surface waves
    for (let l = 0; l < 3; l++) {
      ctx.beginPath();
      const waveY = 30 + l * 15;
      for (let x = 0; x <= W; x += 4) {
        const y = waveY + Math.sin(x * 0.015 + t * (1.2 - l * 0.2)) * (8 + bass * 10) + Math.sin(x * 0.008 + t * 0.5) * 5;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = hexToRGBA(colors[0], 0.15 - l * 0.03);
      ctx.lineWidth = 1.5 - l * 0.3;
      ctx.stroke();
    }
    // bubbles
    for (const b of p.main) {
      b.y += b.vy;
      b.wobble += 0.03;
      if (b.y < -0.05) { b.y = 1.05; b.x = Math.random(); }
      const bx = b.x * W + Math.sin(b.wobble) * 8;
      const by = b.y * H;
      ctx.beginPath(); ctx.arc(bx, by, b.r * (1 + bass * 0.5), 0, Math.PI * 2);
      ctx.strokeStyle = hexToRGBA(colors[0], 0.25);
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // highlight
      ctx.beginPath(); ctx.arc(bx - b.r * 0.3, by - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
    }
    // bioluminescent particles
    for (const bl of p.secondary) {
      bl.x += bl.drift;
      bl.pulse += 0.02;
      if (bl.x < -0.05) bl.x = 1.05;
      if (bl.x > 1.05) bl.x = -0.05;
      const glow = 0.3 + 0.4 * Math.sin(bl.pulse) + mid * 0.3;
      const bx = bl.x * W, by = bl.y * H;
      ctx.beginPath(); ctx.arc(bx, by, bl.r + mid * 3, 0, Math.PI * 2);
      ctx.shadowBlur = 12 + mid * 15;
      ctx.shadowColor = colors[0];
      ctx.fillStyle = hexToRGBA(colors[0], glow);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  /* --- TYPE 2: DIGITAL VOID --- */
  function drawDigitalVoid(p, colors, t, freq, bass, treble) {
    // scan lines
    for (let y = 0; y < H; y += 3) {
      ctx.fillStyle = `rgba(0,0,0,${0.08 + Math.sin(y * 0.1 + t * 5) * 0.04})`;
      ctx.fillRect(0, y, W, 1);
    }
    // matrix rain
    ctx.font = "13px 'JetBrains Mono', monospace";
    for (const col of p.main) {
      col.head += col.speed * (1 + bass * 2);
      if (col.head > 1.3) { col.head = -0.2; col.x = Math.random(); }
      const cx = col.x * W;
      for (let c = 0; c < col.chars.length; c++) {
        const cy = (col.head - c * 0.025) * H;
        if (cy < 0 || cy > H) continue;
        const fade = c === 0 ? 1 : Math.max(0, 1 - c / col.chars.length);
        ctx.fillStyle = c === 0 ? '#fff' : hexToRGBA(colors[0], fade * 0.7);
        // cycle character occasionally
        if (Math.random() < 0.02) col.chars[c] = String.fromCharCode(0x30A0 + Math.random() * 96);
        ctx.fillText(col.chars[c], cx, cy);
      }
    }
    // glitch blocks
    for (const g of p.secondary) {
      g.life += 0.008 + treble * 0.02;
      if (g.life > 1) { g.x = Math.random(); g.y = Math.random(); g.w = 0.05 + Math.random() * 0.15; g.h = 0.01 + Math.random() * 0.04; g.life = 0; }
      if (g.life < 0.1 || (g.life > 0.4 && g.life < 0.5)) {
        ctx.fillStyle = hexToRGBA(colors[0], 0.1 + bass * 0.15);
        ctx.fillRect(g.x * W, g.y * H, g.w * W, g.h * H);
      }
    }
    // horizontal interference lines
    if (bass > 0.2) {
      for (let i = 0; i < 3; i++) {
        const iy = Math.random() * H;
        ctx.fillStyle = hexToRGBA(colors[0], 0.08);
        ctx.fillRect(0, iy, W, 1 + Math.random() * 2);
      }
    }
    // RGB shift effect on edges
    const shiftAmt = treble * 8;
    if (shiftAmt > 1) {
      ctx.fillStyle = `rgba(255,0,0,0.03)`;
      ctx.fillRect(shiftAmt, 0, W, H);
      ctx.fillStyle = `rgba(0,0,255,0.03)`;
      ctx.fillRect(-shiftAmt, 0, W, H);
    }
  }

  /* --- TYPE 3: COSMIC DRIFT --- */
  function drawCosmicDrift(p, colors, t, freq, bass, mid) {
    // galaxy core glow
    const coreGrad = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, W * 0.4);
    coreGrad.addColorStop(0, hexToRGBA(colors[0], 0.1 + bass * 0.1));
    coreGrad.addColorStop(0.3, hexToRGBA(colors[1], 0.04));
    coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coreGrad;
    ctx.fillRect(0, 0, W, H);
    // spiral arms
    for (let arm = 0; arm < 2; arm++) {
      ctx.beginPath();
      const armOff = arm * Math.PI;
      for (let i = 0; i < 200; i++) {
        const frac = i / 200;
        const angle = frac * Math.PI * 3 + t * 0.1 + armOff;
        const r = frac * W * 0.4;
        const x = W * 0.5 + Math.cos(angle) * r;
        const y = H * 0.45 + Math.sin(angle) * r * 0.6;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = hexToRGBA(colors[0], 0.06 + bass * 0.04);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // stars/dust
    for (const s of p.main) {
      const twinkle = 0.3 + 0.7 * Math.sin(t * 1.5 + s.twinkle);
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r * (1 + beatPulse * 0.3), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.brightness * twinkle * 0.8})`;
      ctx.fill();
    }
    // shooting stars
    for (const ss of p.secondary) {
      ss.cooldown--;
      if (!ss.active && ss.cooldown <= 0) {
        ss.active = true; ss.life = 0;
        ss.x = Math.random(); ss.y = Math.random() * 0.3;
        ss.cooldown = 100 + Math.random() * 200;
      }
      if (ss.active) {
        ss.life += 0.015;
        const headX = ss.x * W + Math.cos(ss.angle) * ss.life * W * 0.6;
        const headY = ss.y * H + Math.sin(ss.angle) * ss.life * H * 0.6;
        const tailLen = 60;
        const tailX = headX - Math.cos(ss.angle) * tailLen;
        const tailY = headY - Math.sin(ss.angle) * tailLen;
        const fade = ss.life < 0.1 ? ss.life * 10 : Math.max(0, 1 - (ss.life - 0.3) / 0.7);
        const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(1, `rgba(255,255,255,${fade * 0.7})`);
        ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(headX, headY);
        ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.stroke();
        if (ss.life > ss.maxLife) ss.active = false;
      }
    }
  }

  /* --- TYPE 4: CRYSTAL CAVE --- */
  function drawCrystalCave(p, colors, t, freq, bass, treble) {
    // ambient glow
    const ambGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.5);
    ambGrad.addColorStop(0, hexToRGBA(colors[0], 0.04));
    ambGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ambGrad;
    ctx.fillRect(0, 0, W, H);
    // stalactites + stalagmites
    for (const f of p.main) {
      const fx = f.x * W;
      const fLen = f.length * H * (1 + bass * 0.3);
      const fW = f.width * W;
      const fy = f.fromTop ? 0 : H;
      const dir = f.fromTop ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(fx - fW, fy);
      ctx.lineTo(fx, fy + fLen * dir);
      ctx.lineTo(fx + fW, fy);
      ctx.closePath();
      const fGrad = ctx.createLinearGradient(fx, fy, fx, fy + fLen * dir * 0.5);
      fGrad.addColorStop(0, hexToRGBA(colors[0], 0.2));
      fGrad.addColorStop(1, hexToRGBA(colors[1], 0.05));
      ctx.fillStyle = fGrad;
      ctx.fill();
      // edge glow
      ctx.strokeStyle = hexToRGBA(colors[0], 0.1 + treble * 0.2);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // light reflection beams
    for (let i = 0; i < 4; i++) {
      const angle = t * 0.2 + i * 1.5;
      const bx = W / 2 + Math.cos(angle) * W * 0.3;
      const by = H / 2 + Math.sin(angle) * H * 0.3;
      ctx.beginPath();
      ctx.moveTo(W / 2, H / 2);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = hexToRGBA(colors[0], 0.06 + treble * 0.08);
      ctx.lineWidth = 1 + treble * 3;
      ctx.stroke();
    }
    // gem particles
    for (const g of p.secondary) {
      g.x += g.vx; g.y += g.vy;
      if (g.x < 0) g.x = 1; if (g.x > 1) g.x = 0;
      if (g.y < 0) g.y = 1; if (g.y > 1) g.y = 0;
      const gx = g.x * W, gy = g.y * H;
      ctx.beginPath(); ctx.arc(gx, gy, g.r, 0, Math.PI * 2);
      ctx.shadowBlur = 8;
      ctx.shadowColor = `hsl(${g.hue},70%,60%)`;
      ctx.fillStyle = `hsla(${g.hue},70%,60%,0.5)`;
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  /* --- TYPE 5: ELECTRIC STORM --- */
  function drawElectricStorm(p, colors, t, freq, bass, mid) {
    // cloud layers
    for (let c = 0; c < 3; c++) {
      const cy = 20 + c * 40;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 5) {
        const y = cy + Math.sin(x * 0.008 + t * 0.3 + c) * 20 + Math.sin(x * 0.02 + t * 0.7) * 10;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.closePath();
      ctx.fillStyle = hexToRGBA(colors[1], 0.05 + c * 0.02);
      ctx.fill();
    }
    // rain
    ctx.strokeStyle = hexToRGBA(colors[0], 0.15);
    ctx.lineWidth = 0.8;
    for (const r of p.main) {
      r.y += r.vy * (1 + bass * 2);
      if (r.y > 1.05) { r.y = -0.05; r.x = Math.random(); }
      const rx = r.x * W + Math.sin(t + r.x * 10) * 3;
      const ry = r.y * H;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 1, ry + r.length * H);
      ctx.stroke();
    }
    // lightning
    const bolt = p.secondary[0];
    bolt.cooldown--;
    if (bolt.cooldown <= 0 || (bass > 0.4 && bolt.cooldown < 20)) {
      // generate new bolt
      bolt.segments = [];
      let lx = W * (0.2 + Math.random() * 0.6);
      let ly = 0;
      while (ly < H * 0.8) {
        const nlx = lx + (Math.random() - 0.5) * 60;
        const nly = ly + 20 + Math.random() * 40;
        bolt.segments.push({ x1: lx, y1: ly, x2: nlx, y2: nly });
        // branch sometimes
        if (Math.random() < 0.3) {
          const bx = nlx + (Math.random() - 0.5) * 80;
          const by = nly + 30 + Math.random() * 50;
          bolt.segments.push({ x1: nlx, y1: nly, x2: bx, y2: by });
        }
        lx = nlx; ly = nly;
      }
      bolt.life = 1;
      bolt.cooldown = 40 + Math.random() * 80;
    }
    if (bolt.life > 0) {
      bolt.life -= 0.04;
      ctx.strokeStyle = hexToRGBA(colors[0], bolt.life * 0.8);
      ctx.lineWidth = 2 * bolt.life;
      ctx.shadowBlur = 20 * bolt.life;
      ctx.shadowColor = colors[0];
      for (const seg of bolt.segments) {
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      // flash
      if (bolt.life > 0.7) {
        ctx.fillStyle = hexToRGBA(colors[0], (bolt.life - 0.7) * 0.15);
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  /* --- TYPE 6: ORGANIC GROWTH --- */
  function drawOrganicGrowth(p, colors, t, freq, bass, mid) {
    // ground gradient
    const groundGrad = ctx.createLinearGradient(0, H * 0.7, 0, H);
    groundGrad.addColorStop(0, 'rgba(0,0,0,0)');
    groundGrad.addColorStop(1, hexToRGBA(colors[1], 0.1));
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 0, W, H);
    // tendrils growing from bottom
    for (const tendril of p.main) {
      ctx.beginPath();
      let tx = tendril.originX * W;
      let ty = tendril.originY * H;
      ctx.moveTo(tx, ty);
      for (let s = 0; s < tendril.segments; s++) {
        const frac = s / tendril.segments;
        const growPhase = Math.min(1, (Math.sin(t * tendril.speed * 0.5) * 0.5 + 0.5 + frac * 0.3));
        const angle = -Math.PI / 2 + Math.sin(t * 0.5 + tendril.phase + s * 0.3) * 0.4 * frac;
        const segLen = (tendril.maxLen * H / tendril.segments) * growPhase;
        tx += Math.cos(angle) * segLen;
        ty += Math.sin(angle) * segLen * (1 + bass * 0.5);
        ctx.lineTo(tx, ty);
      }
      ctx.strokeStyle = hexToRGBA(colors[0], 0.25 + mid * 0.2);
      ctx.lineWidth = 2.5 - 1.5 * 0.5;
      ctx.stroke();
      // tip glow
      ctx.beginPath(); ctx.arc(tx, ty, 4 + mid * 6, 0, Math.PI * 2);
      ctx.shadowBlur = 10 + bass * 15;
      ctx.shadowColor = colors[0];
      ctx.fillStyle = hexToRGBA(colors[0], 0.5);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // pulsing cells at base
    for (let i = 0; i < 5; i++) {
      const cx = W * (0.15 + i * 0.17);
      const cy = H * 0.88;
      const cr = 15 + Math.sin(t * 1.2 + i * 1.5) * 5 + bass * 10;
      ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRGBA(colors[0], 0.15 + mid * 0.15);
      ctx.lineWidth = 1;
      ctx.stroke();
      // inner membrane
      ctx.beginPath(); ctx.arc(cx, cy, cr * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = hexToRGBA(colors[1], 0.08);
      ctx.fill();
    }
    // spores floating up
    for (const sp of p.secondary) {
      sp.x += sp.vx; sp.y += sp.vy * (1 + mid * 2);
      if (sp.y < -0.05) { sp.y = 1.05; sp.x = Math.random(); }
      const sx = sp.x * W + Math.sin(t * 1.5 + sp.alpha * 10) * 10;
      ctx.beginPath(); ctx.arc(sx, sp.y * H, sp.r, 0, Math.PI * 2);
      ctx.fillStyle = hexToRGBA(colors[0], sp.alpha * (0.5 + mid * 0.5));
      ctx.fill();
    }
  }

  /* --- TYPE 7: GEOMETRIC VOID --- */
  function drawGeometricVoid(p, colors, t, freq, bass, treble) {
    // subtle grid tessellation background
    const gridSize = 40;
    ctx.strokeStyle = hexToRGBA(colors[0], 0.04 + treble * 0.04);
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += gridSize) {
      for (let y = 0; y < H; y += gridSize) {
        const distort = Math.sin(x * 0.01 + t) * 3 + Math.cos(y * 0.01 + t * 0.7) * 3;
        ctx.strokeRect(x + distort, y + distort, gridSize, gridSize);
      }
    }
    // 3D wireframe shapes (projected)
    for (const shape of p.main) {
      shape.rotX += shape.rotSpeedX * (1 + bass * 2);
      shape.rotY += shape.rotSpeedY * (1 + bass * 2);
      const cx = shape.x * W, cy = shape.y * H;
      const verts = getShapeVerts(shape.type);
      const projected = verts.map(v => project3D(v, shape.rotX, shape.rotY, shape.size * (1 + beatPulse * 0.2), cx, cy));

      // draw edges
      const edges = getShapeEdges(shape.type, verts.length);
      ctx.strokeStyle = hexToRGBA(colors[0], 0.35 + treble * 0.3);
      ctx.lineWidth = 1;
      ctx.shadowBlur = 5 + bass * 10;
      ctx.shadowColor = colors[0];
      for (const [a, b] of edges) {
        if (a >= projected.length || b >= projected.length) continue;
        ctx.beginPath();
        ctx.moveTo(projected[a].x, projected[a].y);
        ctx.lineTo(projected[b].x, projected[b].y);
        ctx.stroke();
      }
      // vertices
      for (const pv of projected) {
        ctx.beginPath(); ctx.arc(pv.x, pv.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = hexToRGBA(colors[0], 0.5);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
    // floating geometric particles
    for (const gp of p.secondary) {
      gp.rot += gp.speed;
      gp.y += 0.0003;
      if (gp.y > 1.1) { gp.y = -0.1; gp.x = Math.random(); }
      const gpx = gp.x * W, gpy = gp.y * H;
      ctx.save();
      ctx.translate(gpx, gpy);
      ctx.rotate(gp.rot);
      ctx.strokeStyle = hexToRGBA(colors[0], 0.2);
      ctx.lineWidth = 0.5;
      ctx.strokeRect(-gp.size / 2, -gp.size / 2, gp.size, gp.size);
      ctx.restore();
    }
  }

  // 3D geometry helpers
  function getShapeVerts(type) {
    if (type === 0) { // cube
      return [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
    } else if (type === 1) { // octahedron
      return [[0,-1,0],[1,0,0],[0,0,1],[-1,0,0],[0,0,-1],[0,1,0]];
    } else { // dodeca-ish (simplified)
      const p = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = i % 2 === 0 ? 1 : 0.6;
        const z = i < 6 ? -0.5 : 0.5;
        p.push([Math.cos(a) * r, Math.sin(a) * r, z]);
      }
      return p;
    }
  }

  function getShapeEdges(type, vertCount) {
    if (type === 0) return [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    if (type === 1) return [[0,1],[0,2],[0,3],[0,4],[5,1],[5,2],[5,3],[5,4],[1,2],[2,3],[3,4],[4,1]];
    const edges = [];
    for (let i = 0; i < vertCount; i++) edges.push([i, (i + 1) % vertCount]);
    for (let i = 0; i < 6; i++) edges.push([i, i + 6]);
    return edges;
  }

  function project3D(v, rx, ry, scale, cx, cy) {
    // rotate Y
    let x = v[0] * Math.cos(ry) - v[2] * Math.sin(ry);
    let z = v[0] * Math.sin(ry) + v[2] * Math.cos(ry);
    let y = v[1];
    // rotate X
    const y2 = y * Math.cos(rx) - z * Math.sin(rx);
    const z2 = y * Math.sin(rx) + z * Math.cos(rx);
    // perspective
    const perspective = 3 / (3 + z2);
    return { x: cx + x * scale * perspective, y: cy + y2 * scale * perspective };
  }

  /* ----- view hooks ----- */
  function onSearch(query) {
    trackList = getFilteredTracks();
    if (scrollInner) scrollInner.style.height = (trackList.length * H) + 'px';
    sceneParticles = {};
    if (scrollContainer) scrollContainer.scrollTop = 0;
    onScroll();
  }

  function onTrackChange(index) {
    // scroll to the track
    for (let i = 0; i < trackList.length; i++) {
      if (trackList[i].originalIndex === index) {
        if (scrollContainer) scrollContainer.scrollTop = i * H;
        break;
      }
    }
  }

  /* ----- register ----- */
  registerView('tapespine', { init, destroy, onSearch, onTrackChange });
})();
