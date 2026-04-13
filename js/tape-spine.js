/* =========================================================
   TAPE-SPINE.JS — "The Tape Spine" view (b076)
   ---------------------------------------------------------
   Vertical full-viewport scroll. Each track is an entire
   living dimension — multi-layered procedural scene with
   3-6 animated systems. Scrolling morphs fluidly between
   dimensions with crossfade + dimensional tear.

   20 scene types — abstract AND real-world:
    0  Neon Horizon       10  LA Sunset
    1  Deep Ocean         11  Tokyo Neon
    2  Digital Void       12  Desert Highway
    3  Cosmic Drift       13  Underwater Reef
    4  Crystal Cave       14  Northern Lights
    5  Electric Storm     15  Rainy Window
    6  Organic Growth     16  Vinyl Groove
    7  Geometric Void     17  Forest Canopy
    8  City Rain          18  Rooftop Night
    9  Beach Midnight     19  Subway Tunnel
   ========================================================= */

(function () {
  const SCENE_TYPES = 20;
  const BEAT_THRESHOLD = 0.32;
  const BEAT_COOLDOWN = 280;

  let canvas, ctx, container, scrollContainer, scrollInner;
  let W, H, rafId;
  let currentPage = 0, blendFactor = 0;
  let trackList = [];
  let beatPulse = 0, lastBeatTime = 0;
  let t0 = 0, scrollY = 0;
  let sceneParticles = {};

  function hexToRGBA(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  function hexToRGB(hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
  function rgbStr(r, g, b, a) { return `rgba(${r|0},${g|0},${b|0},${a})`; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hash(i) { return ((i * 2654435761) >>> 0); }
  function sceneType(idx) { return hash(idx) % SCENE_TYPES; }

  /* ============== INIT / DESTROY / RESIZE ============== */
  function init(viewContainer) {
    container = viewContainer;
    const style = document.createElement('style');
    style.id = 'tapeSpineStyle';
    style.textContent = `
      .ts-wrap{position:relative;width:100%;height:100%;overflow:hidden}
      .ts-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.15) transparent;-webkit-overflow-scrolling:touch}
      .ts-scroll::-webkit-scrollbar{width:4px}.ts-scroll::-webkit-scrollbar-track{background:transparent}.ts-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:2px}
      .ts-inner{width:100%}.ts-canvas{position:absolute;inset:0;pointer-events:none}
      .ts-nav{position:absolute;right:16px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:4px;z-index:10}
      .ts-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.2);cursor:pointer;transition:all .3s;border:none;padding:0}
      .ts-dot.active{background:#fff;box-shadow:0 0 8px #fff;transform:scale(1.5)}.ts-dot:hover{background:rgba(255,255,255,0.6)}
      .ts-counter{position:absolute;left:20px;bottom:20px;font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(255,255,255,0.3);z-index:10;pointer-events:none}
      @media(max-width:768px){.ts-nav{right:6px;gap:2px}.ts-dot{width:4px;height:4px}}`;
    document.head.appendChild(style);
    trackList = getFilteredTracks();
    const wrap = document.createElement('div'); wrap.className = 'ts-wrap';
    canvas = document.createElement('canvas'); canvas.className = 'ts-canvas'; wrap.appendChild(canvas);
    scrollContainer = document.createElement('div'); scrollContainer.className = 'ts-scroll';
    scrollInner = document.createElement('div'); scrollInner.className = 'ts-inner';
    scrollContainer.appendChild(scrollInner); wrap.appendChild(scrollContainer);
    const nav = document.createElement('div'); nav.className = 'ts-nav';
    const dotCount = Math.min(trackList.length, 50);
    for (let i = 0; i < dotCount; i++) {
      const dot = document.createElement('button'); dot.className = 'ts-dot';
      const tp = Math.floor(i / dotCount * trackList.length);
      dot.addEventListener('click', () => { scrollContainer.scrollTop = tp * H; });
      nav.appendChild(dot);
    }
    wrap.appendChild(nav);
    const counter = document.createElement('div'); counter.className = 'ts-counter'; counter.id = 'tsCounter';
    wrap.appendChild(counter); container.appendChild(wrap);
    resize();
    scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    scrollContainer.addEventListener('click', onClick);
    window.addEventListener('resize', resize);
    t0 = performance.now(); sceneParticles = {};
    rafId = requestAnimationFrame(draw);
  }

  function destroy() {
    if (rafId) cancelAnimationFrame(rafId); rafId = null;
    window.removeEventListener('resize', resize);
    const s = document.getElementById('tapeSpineStyle'); if (s) s.remove();
    canvas = ctx = container = scrollContainer = scrollInner = null;
    trackList = []; sceneParticles = {};
  }

  function resize() {
    if (!canvas || !scrollInner) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.parentElement.offsetWidth; H = canvas.parentElement.offsetHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scrollInner.style.height = (trackList.length * H) + 'px'; onScroll();
  }

  function onScroll() {
    if (!scrollContainer) return;
    scrollY = scrollContainer.scrollTop;
    currentPage = Math.floor(scrollY / H);
    blendFactor = (scrollY % H) / H;
    if (currentPage >= trackList.length) currentPage = trackList.length - 1;
    const dots = container.querySelectorAll('.ts-dot'), dc = dots.length;
    dots.forEach((d, i) => { d.classList.toggle('active', Math.floor(i / dc * trackList.length) === currentPage); });
    const c = document.getElementById('tsCounter');
    if (c) c.textContent = `${currentPage + 1} / ${trackList.length}`;
  }

  function onClick() {
    if (trackList.length === 0) return;
    const t = trackList[Math.min(currentPage, trackList.length - 1)];
    if (t && typeof playTrack === 'function') playTrack(t.originalIndex);
  }

  /* ============== PARTICLE FACTORY ============== */
  function getParticles(page, type) {
    if (sceneParticles[page]) return sceneParticles[page];
    const p = createParticles(type);
    sceneParticles[page] = p;
    const keys = Object.keys(sceneParticles).map(Number);
    if (keys.length > 5) keys.filter(k => Math.abs(k - currentPage) > 2).forEach(k => delete sceneParticles[k]);
    return p;
  }

  function rng(n) { const a = []; for (let i = 0; i < n; i++) a.push(Math.random()); return a; }

  function createParticles(type) {
    const p = { main: [], secondary: [], tertiary: [] };
    switch (type) {
      case 0: // neon horizon
        for (let i = 0; i < 12; i++) p.main.push({ x: Math.random(), y: 0.15 + Math.random() * 0.4, rot: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.015, sides: 3 + Math.floor(Math.random() * 4), size: 15 + Math.random() * 35 });
        for (let i = 0; i < 60; i++) p.secondary.push({ x: Math.random(), y: Math.random(), vy: -0.0008 - Math.random() * 0.0015, a: Math.random() });
        break;
      case 1: // deep ocean
        for (let i = 0; i < 45; i++) p.main.push({ x: Math.random(), y: Math.random(), r: 2 + Math.random() * 7, vy: -0.0004 - Math.random() * 0.0018, wobble: Math.random() * 6.28 });
        for (let i = 0; i < 35; i++) p.secondary.push({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 3, pulse: Math.random() * 6.28, drift: (Math.random() - 0.5) * 0.0004 });
        break;
      case 2: // digital void
        for (let i = 0; i < 40; i++) p.main.push({ x: Math.random(), y: Math.random(), speed: 0.002 + Math.random() * 0.005, chars: Array.from({ length: 10 + Math.floor(Math.random() * 14) }, () => String.fromCharCode(0x30A0 + Math.random() * 96)), head: Math.random() * 20 });
        for (let i = 0; i < 10; i++) p.secondary.push({ x: Math.random(), y: Math.random(), w: 0.04 + Math.random() * 0.12, h: 0.008 + Math.random() * 0.03, life: Math.random() });
        break;
      case 3: // cosmic drift
        for (let i = 0; i < 150; i++) p.main.push({ x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 2.2, brightness: 0.15 + Math.random() * 0.85, twinkle: Math.random() * 6.28 });
        for (let i = 0; i < 4; i++) p.secondary.push({ x: 0, y: 0, angle: Math.PI * 0.6 + Math.random() * 0.5, speed: 0.004 + Math.random() * 0.004, life: 0, maxLife: 0.4 + Math.random() * 0.6, active: false, cooldown: Math.random() * 150 });
        break;
      case 4: // crystal cave
        for (let i = 0; i < 18; i++) { const top = Math.random() > 0.5; p.main.push({ x: 0.03 + Math.random() * 0.94, fromTop: top, length: 0.06 + Math.random() * 0.2, width: 0.008 + Math.random() * 0.025, hue: Math.random() * 60 + 180 }); }
        for (let i = 0; i < 50; i++) p.secondary.push({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 3, vx: (Math.random() - 0.5) * 0.0008, vy: (Math.random() - 0.5) * 0.0008, hue: Math.random() * 60 + 180 });
        break;
      case 5: // electric storm
        for (let i = 0; i < 100; i++) p.main.push({ x: Math.random(), y: Math.random(), vy: 0.006 + Math.random() * 0.014, length: 0.015 + Math.random() * 0.04 });
        p.secondary.push({ segments: [], life: 0, cooldown: 40 + Math.random() * 80 });
        break;
      case 6: // organic growth
        for (let i = 0; i < 8; i++) p.main.push({ originX: Math.random(), originY: 0.88 + Math.random() * 0.12, segments: 22 + Math.floor(Math.random() * 18), maxLen: 0.25 + Math.random() * 0.35, phase: Math.random() * 6.28, speed: 0.4 + Math.random() * 0.6 });
        for (let i = 0; i < 60; i++) p.secondary.push({ x: Math.random(), y: Math.random(), r: 0.8 + Math.random() * 2.5, vx: (Math.random() - 0.5) * 0.0006, vy: -0.0002 - Math.random() * 0.001, alpha: 0.2 + Math.random() * 0.5 });
        break;
      case 7: // geometric void
        for (let i = 0; i < 6; i++) p.main.push({ x: 0.1 + Math.random() * 0.8, y: 0.1 + Math.random() * 0.8, size: 35 + Math.random() * 90, rotX: Math.random() * 3.14, rotY: Math.random() * 3.14, rotSpeedX: (Math.random() - 0.5) * 0.008, rotSpeedY: (Math.random() - 0.5) * 0.012, type: Math.floor(Math.random() * 3) });
        for (let i = 0; i < 50; i++) p.secondary.push({ x: Math.random(), y: Math.random(), size: 2 + Math.random() * 4, rot: Math.random() * 6.28, speed: (Math.random() - 0.5) * 0.002 });
        break;
      case 8: // city rain
        for (let i = 0; i < 120; i++) p.main.push({ x: Math.random(), y: Math.random(), vy: 0.005 + Math.random() * 0.01, len: 0.01 + Math.random() * 0.03 });
        for (let i = 0; i < 8; i++) p.secondary.push({ x: 0.05 + Math.random() * 0.9, h: 0.15 + Math.random() * 0.45, w: 0.03 + Math.random() * 0.06, windows: 3 + Math.floor(Math.random() * 6), floors: 4 + Math.floor(Math.random() * 10) });
        for (let i = 0; i < 15; i++) p.tertiary.push({ x: Math.random(), phase: Math.random() * 6.28, maxR: 8 + Math.random() * 15, speed: 0.5 + Math.random() * 1 });
        break;
      case 9: // beach midnight
        for (let i = 0; i < 80; i++) p.main.push({ x: Math.random(), y: Math.random() * 0.5, r: 0.5 + Math.random() * 1.5, twinkle: Math.random() * 6.28 });
        for (let i = 0; i < 20; i++) p.secondary.push({ x: Math.random(), foam: Math.random() * 6.28 });
        p.tertiary.push({ angle: 0, speed: 0.3 }); // lighthouse beam
        break;
      case 10: // LA sunset
        for (let i = 0; i < 12; i++) p.main.push({ x: 0.05 + Math.random() * 0.9, h: 0.2 + Math.random() * 0.3, lean: (Math.random() - 0.5) * 0.15, fronds: 5 + Math.floor(Math.random() * 4) });
        for (let i = 0; i < 6; i++) p.secondary.push({ x: Math.random(), y: 0.15 + Math.random() * 0.25, vx: 0.0003 + Math.random() * 0.0005, wing: Math.random() * 6.28 });
        for (let i = 0; i < 30; i++) p.tertiary.push({ x: Math.random(), y: Math.random(), vx: 0.0001 + Math.random() * 0.0003, size: 20 + Math.random() * 60, alpha: 0.02 + Math.random() * 0.04 });
        break;
      case 11: // tokyo neon
        for (let i = 0; i < 14; i++) p.main.push({ x: 0.03 + Math.random() * 0.94, h: 0.3 + Math.random() * 0.5, w: 0.02 + Math.random() * 0.05, hue: Math.random() * 360, signs: 2 + Math.floor(Math.random() * 4), flicker: Math.random() * 6.28 });
        for (let i = 0; i < 40; i++) p.secondary.push({ x: Math.random(), y: 0.85 + Math.random() * 0.1, vx: (Math.random() - 0.5) * 0.001, size: 0.01 + Math.random() * 0.015 });
        for (let i = 0; i < 8; i++) p.tertiary.push({ x: Math.random(), y: 0.8 + Math.random() * 0.15, vx: 0.001 + Math.random() * 0.003, length: 0.05 + Math.random() * 0.1, hue: Math.random() * 360 });
        break;
      case 12: // desert highway
        for (let i = 0; i < 5; i++) p.main.push({ x: 0.1 + i * 0.2, h: 0.08 + Math.random() * 0.15, peak: 0.3 + Math.random() * 0.3 });
        for (let i = 0; i < 50; i++) p.secondary.push({ x: Math.random(), y: 0.55 + Math.random() * 0.4, vx: 0.0005 + Math.random() * 0.001, size: 1 + Math.random() * 2, alpha: 0.15 + Math.random() * 0.3 });
        for (let i = 0; i < 6; i++) p.tertiary.push({ x: Math.random(), y: 0.4 + Math.random() * 0.1, size: 3 + Math.random() * 5 }); // cacti
        break;
      case 13: // underwater reef
        for (let i = 0; i < 10; i++) p.main.push({ x: 0.05 + Math.random() * 0.9, y: 0.7 + Math.random() * 0.25, w: 0.04 + Math.random() * 0.08, h: 0.05 + Math.random() * 0.15, hue: Math.random() * 60 + 300, sway: Math.random() * 6.28 });
        for (let i = 0; i < 12; i++) p.secondary.push({ x: Math.random(), y: 0.3 + Math.random() * 0.5, vx: (Math.random() - 0.5) * 0.001, vy: (Math.random() - 0.5) * 0.0005, size: 3 + Math.random() * 6, tail: Math.random() * 6.28 });
        for (let i = 0; i < 8; i++) p.tertiary.push({ x: Math.random(), segments: 8 + Math.floor(Math.random() * 8), sway: Math.random() * 6.28, h: 0.05 + Math.random() * 0.12 });
        break;
      case 14: // northern lights
        for (let i = 0; i < 5; i++) p.main.push({ offset: Math.random() * 6.28, speed: 0.2 + Math.random() * 0.3, amplitude: 0.05 + Math.random() * 0.1, y: 0.15 + i * 0.08, hue: [120, 160, 200, 280, 320][i] });
        for (let i = 0; i < 80; i++) p.secondary.push({ x: Math.random(), y: Math.random(), vy: 0.0002 + Math.random() * 0.0008, size: 1 + Math.random() * 2, alpha: 0.3 + Math.random() * 0.5 });
        for (let i = 0; i < 20; i++) p.tertiary.push({ x: 0.03 + Math.random() * 0.94, h: 0.05 + Math.random() * 0.12, w: 0.005 + Math.random() * 0.01 });
        break;
      case 15: // rainy window
        for (let i = 0; i < 30; i++) p.main.push({ x: Math.random(), y: -Math.random() * 0.3, vy: 0.0005 + Math.random() * 0.002, r: 3 + Math.random() * 6, trail: [], wobble: Math.random() * 6.28 });
        for (let i = 0; i < 15; i++) p.secondary.push({ x: Math.random(), y: Math.random(), r: 10 + Math.random() * 30, hue: Math.random() * 360, alpha: 0.05 + Math.random() * 0.08 });
        break;
      case 16: // vinyl groove
        p.main.push({ angle: 0, armAngle: -0.3 });
        for (let i = 0; i < 40; i++) p.secondary.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.0003, vy: -0.0001 - Math.random() * 0.0003, size: 0.5 + Math.random() * 1.5, alpha: 0.1 + Math.random() * 0.2 });
        break;
      case 17: // forest canopy
        for (let i = 0; i < 6; i++) p.main.push({ x: Math.random(), depth: i, size: 0.15 + Math.random() * 0.2, sway: Math.random() * 6.28 });
        for (let i = 0; i < 50; i++) p.secondary.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.0003, vy: 0.0001 + Math.random() * 0.0005, pulse: Math.random() * 6.28, alpha: 0.4 + Math.random() * 0.5 });
        for (let i = 0; i < 5; i++) p.tertiary.push({ x: 0.1 + Math.random() * 0.8, y: 0.3 + Math.random() * 0.3, angle: Math.random() * 6.28, speed: 0.001 + Math.random() * 0.002 });
        break;
      case 18: // rooftop night
        for (let i = 0; i < 12; i++) p.main.push({ x: 0.02 + Math.random() * 0.96, h: 0.1 + Math.random() * 0.35, w: 0.02 + Math.random() * 0.06, windows: 2 + Math.floor(Math.random() * 5), lit: Math.random() * 6.28 });
        for (let i = 0; i < 100; i++) p.secondary.push({ x: Math.random(), y: Math.random() * 0.4, r: 0.4 + Math.random() * 1.5, twinkle: Math.random() * 6.28 });
        p.tertiary.push({ x: 0.15 + Math.random() * 0.3, legH: 0.08 + Math.random() * 0.05 }); // water tower
        break;
      case 19: // subway tunnel
        for (let i = 0; i < 20; i++) p.main.push({ z: Math.random(), speed: 0.003 + Math.random() * 0.004, hue: Math.random() > 0.7 ? 40 : 200, side: Math.random() > 0.5 ? 1 : -1 });
        for (let i = 0; i < 6; i++) p.secondary.push({ z: Math.random(), flicker: Math.random() * 6.28, brightness: 0.3 + Math.random() * 0.5 });
        for (let i = 0; i < 30; i++) p.tertiary.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.002, vy: (Math.random() - 0.5) * 0.001, size: 1 + Math.random() * 2 });
        break;
    }
    return p;
  }

  /* ============== MAIN DRAW LOOP ============== */
  function draw(now) {
    rafId = requestAnimationFrame(draw);
    if (!ctx || trackList.length === 0) return;
    const t = (now - t0) * 0.001;
    const freq = typeof getFrequencyData === 'function' ? getFrequencyData() : null;
    let bass = 0, mid = 0, treble = 0;
    if (freq) {
      for (let i = 0; i < 6; i++) bass += freq[i]; bass /= (6 * 255);
      for (let i = 6; i < 24; i++) mid += freq[i]; mid /= (18 * 255);
      for (let i = 24; i < 64; i++) treble += freq[i]; treble /= (40 * 255);
      if (bass > BEAT_THRESHOLD && now - lastBeatTime > BEAT_COOLDOWN) { beatPulse = 1; lastBeatTime = now; }
    }
    beatPulse *= 0.91;

    const pageA = Math.min(currentPage, trackList.length - 1);
    const pageB = Math.min(pageA + 1, trackList.length - 1);
    const trackA = trackList[pageA], trackB = trackList[pageB];
    const colorsA = getGradientColors(trackA.originalIndex), colorsB = getGradientColors(trackB.originalIndex);
    const typeA = sceneType(trackA.originalIndex), typeB = sceneType(trackB.originalIndex);
    const rgbA0 = hexToRGB(colorsA[0]), rgbA1 = hexToRGB(colorsA[1]);
    const rgbB0 = hexToRGB(colorsB[0]), rgbB1 = hexToRGB(colorsB[1]);
    const c0 = [lerp(rgbA0[0], rgbB0[0], blendFactor), lerp(rgbA0[1], rgbB0[1], blendFactor), lerp(rgbA0[2], rgbB0[2], blendFactor)];
    const c1 = [lerp(rgbA1[0], rgbB1[0], blendFactor), lerp(rgbA1[1], rgbB1[1], blendFactor), lerp(rgbA1[2], rgbB1[2], blendFactor)];

    ctx.fillStyle = `rgb(${lerp(5, 3, blendFactor) | 0},${lerp(5, 3, blendFactor) | 0},${lerp(12, 8, blendFactor) | 0})`;
    ctx.fillRect(0, 0, W, H);

    ctx.save(); ctx.globalAlpha = 1 - blendFactor;
    drawScene(typeA, getParticles(pageA, typeA), colorsA, t, freq, bass, mid, treble);
    ctx.restore();

    if (blendFactor > 0.01 && pageA !== pageB) {
      ctx.save(); ctx.globalAlpha = blendFactor;
      drawScene(typeB, getParticles(pageB, typeB), colorsB, t, freq, bass, mid, treble);
      ctx.restore();
    }

    // dimensional tear
    if (blendFactor > 0.05 && blendFactor < 0.95) {
      const tearY = H * (1 - blendFactor);
      ctx.save();
      const tg = ctx.createLinearGradient(0, tearY - 30, 0, tearY + 30);
      tg.addColorStop(0, 'rgba(0,0,0,0)');
      tg.addColorStop(0.4, rgbStr(c0[0], c0[1], c0[2], 0.5 + beatPulse * 0.3));
      tg.addColorStop(0.5, '#fff');
      tg.addColorStop(0.6, rgbStr(c1[0], c1[1], c1[2], 0.5 + beatPulse * 0.3));
      tg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = tg; ctx.fillRect(0, tearY - 30, W, 60);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = rgbStr(c0[0], c0[1], c0[2], 0.15); ctx.fillRect(Math.random() * W * 0.3, tearY - 15 + Math.random() * 30, 30 + Math.random() * 100, 2); }
      ctx.restore();
    }

    // title overlay
    const titleTrack = blendFactor < 0.5 ? trackA : trackB;
    const titleAlpha = blendFactor < 0.5 ? 1 - blendFactor * 2 : (blendFactor - 0.5) * 2;
    const isPlaying = state.currentTrack === titleTrack.originalIndex;
    ctx.save(); ctx.textAlign = 'center';
    ctx.font = "700 120px 'Syne',sans-serif"; ctx.fillStyle = `rgba(255,255,255,${0.04 * titleAlpha})`;
    ctx.fillText(String(pageA + 1).padStart(3, '0'), W / 2, H / 2 + 40);
    ctx.font = `700 ${W < 768 ? 28 : 42}px 'Syne',sans-serif`; ctx.fillStyle = `rgba(255,255,255,${0.85 * titleAlpha})`;
    ctx.fillText(titleTrack.title, W / 2, H / 2 - 10);
    ctx.font = "400 13px 'DM Sans',sans-serif"; ctx.fillStyle = `rgba(255,255,255,${0.35 * titleAlpha})`;
    ctx.fillText(isPlaying ? 'now playing' : 'click to play', W / 2, H / 2 + 25);
    if (isPlaying) { const pr = 50 + Math.sin(t * 3) * 5 + beatPulse * 15; ctx.beginPath(); ctx.arc(W / 2, H / 2, pr, 0, Math.PI * 2); ctx.strokeStyle = `rgba(156,255,58,${0.3 * titleAlpha})`; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore();
  }

  /* ============== SCENE DISPATCHER ============== */
  function drawScene(type, parts, colors, t, freq, bass, mid, treble) {
    const fn = [drawNeonHorizon, drawDeepOcean, drawDigitalVoid, drawCosmicDrift,
      drawCrystalCave, drawElectricStorm, drawOrganicGrowth, drawGeometricVoid,
      drawCityRain, drawBeachMidnight, drawLASunset, drawTokyoNeon,
      drawDesertHighway, drawUnderwaterReef, drawNorthernLights, drawRainyWindow,
      drawVinylGroove, drawForestCanopy, drawRooftopNight, drawSubwayTunnel][type];
    if (fn) fn(parts, colors, t, freq, bass, mid, treble);
  }

  /* ============================================================
     SCENE RENDERERS — 20 types, each multi-layered + ambient
     ============================================================ */

  /* --- 0: NEON HORIZON --- */
  function drawNeonHorizon(p, col, t, freq, bass, mid) {
    const hor = H * 0.58;
    ctx.strokeStyle = hexToRGBA(col[0], 0.12 + bass * 0.1); ctx.lineWidth = 0.5;
    for (let i = 1; i <= 25; i++) { const f = i / 25; const y = hor + f * f * (H - hor); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(W / 2, hor); ctx.lineTo(W / 2 + i * (W / 12), H); ctx.stroke(); }
    // scrolling grid (ambient)
    const gridScroll = (t * 30) % (H * 0.05);
    for (let i = 0; i < 5; i++) { const y = hor + gridScroll + i * H * 0.05; if (y > hor && y < H) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.strokeStyle = hexToRGBA(col[0], 0.06); ctx.stroke(); } }
    const sunR = 55 + bass * 25 + Math.sin(t * 0.3) * 5;
    const sg = ctx.createRadialGradient(W / 2, hor - 35, 0, W / 2, hor - 35, sunR * 2.5);
    sg.addColorStop(0, hexToRGBA(col[0], 0.5)); sg.addColorStop(0.5, hexToRGBA(col[1], 0.12)); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    ctx.beginPath(); ctx.arc(W / 2, hor - 35, sunR * 0.4, 0, Math.PI, true); ctx.fillStyle = hexToRGBA(col[0], 0.7); ctx.fill();
    for (let s = 0; s < 6; s++) { ctx.fillStyle = 'rgba(5,5,12,0.5)'; ctx.fillRect(W / 2 - sunR, hor - 35 - sunR * 0.3 + s * sunR * 0.12, sunR * 2, 2); }
    for (const sh of p.main) { sh.rot += sh.rotSpeed; const sx = sh.x * W + Math.sin(t * 0.2 + sh.rot) * 20, sy = sh.y * H + Math.cos(t * 0.15 + sh.rot * 0.7) * 10; ctx.save(); ctx.translate(sx, sy); ctx.rotate(sh.rot); ctx.strokeStyle = hexToRGBA(col[0], 0.25 + mid * 0.25); ctx.lineWidth = 1; ctx.beginPath(); for (let v = 0; v <= sh.sides; v++) { const a = (v / sh.sides) * 6.28; const px = Math.cos(a) * sh.size, py = Math.sin(a) * sh.size; v === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); } ctx.closePath(); ctx.stroke(); ctx.beginPath(); for (let v = 0; v <= sh.sides; v++) { const a = (v / sh.sides) * 6.28 + 0.3; const px = Math.cos(a) * sh.size * 0.5, py = Math.sin(a) * sh.size * 0.5; v === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); } ctx.closePath(); ctx.stroke(); ctx.restore(); }
    for (const pt of p.secondary) { pt.y += pt.vy; if (pt.y < -0.05) { pt.y = 1.05; pt.x = Math.random(); } ctx.beginPath(); ctx.arc(pt.x * W + Math.sin(t * 1.5 + pt.a * 8) * 20, pt.y * H, 1.5, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.25 + Math.sin(t + pt.a * 5) * 0.15); ctx.fill(); }
  }

  /* --- 1: DEEP OCEAN --- */
  function drawDeepOcean(p, col, t, freq, bass, mid) {
    const dg = ctx.createLinearGradient(0, 0, 0, H); dg.addColorStop(0, hexToRGBA(col[0], 0.06)); dg.addColorStop(1, hexToRGBA(col[1], 0.12)); ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 7; i++) { const bx = W * (0.08 + i * 0.13) + Math.sin(t * 0.25 + i) * 50; const bw = 18 + Math.sin(t * 0.4 + i * 2) * 12 + bass * 25; const g = ctx.createLinearGradient(bx, 0, bx + bw * 2, H); g.addColorStop(0, hexToRGBA(col[0], 0.05)); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + bw, 0); ctx.lineTo(bx + bw * 2, H); ctx.lineTo(bx - bw * 0.5, H); ctx.closePath(); ctx.fill(); }
    for (let l = 0; l < 4; l++) { ctx.beginPath(); for (let x = 0; x <= W; x += 3) { const y = 25 + l * 12 + Math.sin(x * 0.013 + t * (1 - l * 0.15)) * (7 + bass * 8) + Math.sin(x * 0.007 + t * 0.4) * 4; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.strokeStyle = hexToRGBA(col[0], 0.12 - l * 0.02); ctx.lineWidth = 1.2 - l * 0.2; ctx.stroke(); }
    for (const b of p.main) { b.y += b.vy; b.wobble += 0.025; if (b.y < -0.05) { b.y = 1.05; b.x = Math.random(); } const bx = b.x * W + Math.sin(b.wobble) * 10, by = b.y * H; ctx.beginPath(); ctx.arc(bx, by, b.r * (1 + bass * 0.4), 0, 6.28); ctx.strokeStyle = hexToRGBA(col[0], 0.2); ctx.lineWidth = 0.7; ctx.stroke(); ctx.beginPath(); ctx.arc(bx - b.r * 0.3, by - b.r * 0.3, b.r * 0.2, 0, 6.28); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill(); }
    for (const bl of p.secondary) { bl.x += bl.drift; bl.pulse += 0.015; if (bl.x < -0.05) bl.x = 1.05; if (bl.x > 1.05) bl.x = -0.05; const glow = 0.25 + 0.35 * Math.sin(bl.pulse) + mid * 0.25; ctx.beginPath(); ctx.arc(bl.x * W, bl.y * H, bl.r + mid * 3, 0, 6.28); ctx.shadowBlur = 10 + mid * 12; ctx.shadowColor = col[0]; ctx.fillStyle = hexToRGBA(col[0], glow); ctx.fill(); } ctx.shadowBlur = 0;
  }

  /* --- 2: DIGITAL VOID --- */
  function drawDigitalVoid(p, col, t, freq, bass, treble) {
    for (let y = 0; y < H; y += 3) { ctx.fillStyle = `rgba(0,0,0,${0.07 + Math.sin(y * 0.1 + t * 4) * 0.03})`; ctx.fillRect(0, y, W, 1); }
    ctx.font = "13px 'JetBrains Mono',monospace";
    for (const c of p.main) { c.head += c.speed * (1 + bass * 1.5); if (c.head > 1.3) { c.head = -0.2; c.x = Math.random(); } const cx = c.x * W; for (let i = 0; i < c.chars.length; i++) { const cy = (c.head - i * 0.022) * H; if (cy < 0 || cy > H) continue; ctx.fillStyle = i === 0 ? '#fff' : hexToRGBA(col[0], Math.max(0, 1 - i / c.chars.length) * 0.6); if (Math.random() < 0.015) c.chars[i] = String.fromCharCode(0x30A0 + Math.random() * 96); ctx.fillText(c.chars[i], cx, cy); } }
    for (const g of p.secondary) { g.life += 0.007 + treble * 0.015; if (g.life > 1) { g.x = Math.random(); g.y = Math.random(); g.w = 0.04 + Math.random() * 0.12; g.h = 0.008 + Math.random() * 0.03; g.life = 0; } if (g.life < 0.1 || (g.life > 0.4 && g.life < 0.5)) { ctx.fillStyle = hexToRGBA(col[0], 0.08 + bass * 0.12); ctx.fillRect(g.x * W, g.y * H, g.w * W, g.h * H); } }
    if (bass > 0.2) for (let i = 0; i < 4; i++) { ctx.fillStyle = hexToRGBA(col[0], 0.06); ctx.fillRect(0, Math.random() * H, W, 1 + Math.random() * 2); }
    const sh = treble * 6; if (sh > 1) { ctx.fillStyle = 'rgba(255,0,0,0.02)'; ctx.fillRect(sh, 0, W, H); ctx.fillStyle = 'rgba(0,0,255,0.02)'; ctx.fillRect(-sh, 0, W, H); }
  }

  /* --- 3: COSMIC DRIFT --- */
  function drawCosmicDrift(p, col, t, freq, bass, mid) {
    const cg = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, W * 0.4); cg.addColorStop(0, hexToRGBA(col[0], 0.08 + bass * 0.08)); cg.addColorStop(0.3, hexToRGBA(col[1], 0.03)); cg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
    for (let arm = 0; arm < 3; arm++) { ctx.beginPath(); for (let i = 0; i < 250; i++) { const f = i / 250; const a = f * Math.PI * 3.5 + t * 0.08 + arm * 2.09; const r = f * W * 0.42; ctx.lineTo(W * 0.5 + Math.cos(a) * r, H * 0.45 + Math.sin(a) * r * 0.55); } ctx.strokeStyle = hexToRGBA(col[0], 0.05 + bass * 0.03); ctx.lineWidth = 2.5; ctx.stroke(); }
    for (const s of p.main) { const tw = 0.3 + 0.7 * Math.sin(t * 1.3 + s.twinkle); ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r * (1 + beatPulse * 0.25), 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${s.brightness * tw * 0.7})`; ctx.fill(); }
    for (const ss of p.secondary) { ss.cooldown--; if (!ss.active && ss.cooldown <= 0) { ss.active = true; ss.life = 0; ss.x = Math.random(); ss.y = Math.random() * 0.3; ss.cooldown = 80 + Math.random() * 160; } if (ss.active) { ss.life += 0.012; const hx = ss.x * W + Math.cos(ss.angle) * ss.life * W * 0.5, hy = ss.y * H + Math.sin(ss.angle) * ss.life * H * 0.5; const tx = hx - Math.cos(ss.angle) * 70, ty = hy - Math.sin(ss.angle) * 70; const fade = ss.life < 0.1 ? ss.life * 10 : Math.max(0, 1 - (ss.life - 0.3) / 0.7); const sg = ctx.createLinearGradient(tx, ty, hx, hy); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(1, `rgba(255,255,255,${fade * 0.6})`); ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.strokeStyle = sg; ctx.lineWidth = 2; ctx.stroke(); if (ss.life > ss.maxLife) ss.active = false; } }
  }

  /* --- 4: CRYSTAL CAVE --- */
  function drawCrystalCave(p, col, t, freq, bass, treble) {
    const ag = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.5); ag.addColorStop(0, hexToRGBA(col[0], 0.03)); ag.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = ag; ctx.fillRect(0, 0, W, H);
    for (const f of p.main) { const fx = f.x * W, fL = f.length * H * (1 + bass * 0.25), fW = f.width * W, fy = f.fromTop ? 0 : H, dir = f.fromTop ? 1 : -1; ctx.beginPath(); ctx.moveTo(fx - fW, fy); ctx.lineTo(fx, fy + fL * dir); ctx.lineTo(fx + fW, fy); ctx.closePath(); const fg = ctx.createLinearGradient(fx, fy, fx, fy + fL * dir * 0.5); fg.addColorStop(0, hexToRGBA(col[0], 0.15)); fg.addColorStop(1, hexToRGBA(col[1], 0.04)); ctx.fillStyle = fg; ctx.fill(); ctx.strokeStyle = hexToRGBA(col[0], 0.08 + treble * 0.15); ctx.lineWidth = 0.8; ctx.stroke(); }
    for (let i = 0; i < 5; i++) { const a = t * 0.15 + i * 1.25; const bx = W / 2 + Math.cos(a) * W * 0.3, by = H / 2 + Math.sin(a) * H * 0.3; ctx.beginPath(); ctx.moveTo(W / 2, H / 2); ctx.lineTo(bx, by); ctx.strokeStyle = hexToRGBA(col[0], 0.04 + treble * 0.06); ctx.lineWidth = 1 + treble * 2; ctx.stroke(); }
    for (const g of p.secondary) { g.x += g.vx; g.y += g.vy; if (g.x < 0) g.x = 1; if (g.x > 1) g.x = 0; if (g.y < 0) g.y = 1; if (g.y > 1) g.y = 0; ctx.beginPath(); ctx.arc(g.x * W, g.y * H, g.r, 0, 6.28); ctx.shadowBlur = 6; ctx.shadowColor = `hsl(${g.hue},70%,60%)`; ctx.fillStyle = `hsla(${g.hue},70%,60%,0.4)`; ctx.fill(); } ctx.shadowBlur = 0;
  }

  /* --- 5: ELECTRIC STORM --- */
  function drawElectricStorm(p, col, t, freq, bass, mid) {
    for (let c = 0; c < 4; c++) { ctx.beginPath(); for (let x = 0; x <= W; x += 4) { const y = 15 + c * 35 + Math.sin(x * 0.006 + t * 0.25 + c) * 25 + Math.sin(x * 0.015 + t * 0.6) * 12; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fillStyle = hexToRGBA(col[1], 0.04 + c * 0.015); ctx.fill(); }
    ctx.strokeStyle = hexToRGBA(col[0], 0.12); ctx.lineWidth = 0.7;
    for (const r of p.main) { r.y += r.vy * (1 + bass * 1.5); if (r.y > 1.05) { r.y = -0.05; r.x = Math.random(); } const rx = r.x * W + Math.sin(t * 0.8 + r.x * 8) * 2; ctx.beginPath(); ctx.moveTo(rx, r.y * H); ctx.lineTo(rx - 0.5, r.y * H + r.length * H); ctx.stroke(); }
    const bolt = p.secondary[0]; bolt.cooldown--;
    if (bolt.cooldown <= 0 || (bass > 0.35 && bolt.cooldown < 15)) { bolt.segments = []; let lx = W * (0.15 + Math.random() * 0.7), ly = 0; while (ly < H * 0.85) { const nx = lx + (Math.random() - 0.5) * 70, ny = ly + 15 + Math.random() * 45; bolt.segments.push({ x1: lx, y1: ly, x2: nx, y2: ny }); if (Math.random() < 0.35) bolt.segments.push({ x1: nx, y1: ny, x2: nx + (Math.random() - 0.5) * 90, y2: ny + 25 + Math.random() * 50 }); lx = nx; ly = ny; } bolt.life = 1; bolt.cooldown = 35 + Math.random() * 70; }
    if (bolt.life > 0) { bolt.life -= 0.035; ctx.strokeStyle = hexToRGBA(col[0], bolt.life * 0.7); ctx.lineWidth = 2.5 * bolt.life; ctx.shadowBlur = 25 * bolt.life; ctx.shadowColor = col[0]; for (const s of bolt.segments) { ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke(); } ctx.shadowBlur = 0; if (bolt.life > 0.7) { ctx.fillStyle = hexToRGBA(col[0], (bolt.life - 0.7) * 0.12); ctx.fillRect(0, 0, W, H); } }
  }

  /* --- 6: ORGANIC GROWTH --- */
  function drawOrganicGrowth(p, col, t, freq, bass, mid) {
    const gg = ctx.createLinearGradient(0, H * 0.65, 0, H); gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(1, hexToRGBA(col[1], 0.08)); ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
    for (const td of p.main) { ctx.beginPath(); let tx = td.originX * W, ty = td.originY * H; ctx.moveTo(tx, ty); for (let s = 0; s < td.segments; s++) { const f = s / td.segments; const grow = Math.min(1, Math.sin(t * td.speed * 0.4) * 0.5 + 0.5 + f * 0.3); const a = -Math.PI / 2 + Math.sin(t * 0.4 + td.phase + s * 0.25) * 0.35 * f; const sl = (td.maxLen * H / td.segments) * grow; tx += Math.cos(a) * sl; ty += Math.sin(a) * sl * (1 + bass * 0.4); ctx.lineTo(tx, ty); } ctx.strokeStyle = hexToRGBA(col[0], 0.2 + mid * 0.15); ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.arc(tx, ty, 3 + mid * 5, 0, 6.28); ctx.shadowBlur = 8 + bass * 12; ctx.shadowColor = col[0]; ctx.fillStyle = hexToRGBA(col[0], 0.45); ctx.fill(); ctx.shadowBlur = 0; }
    for (let i = 0; i < 6; i++) { const cx = W * (0.12 + i * 0.15), cy = H * 0.86, cr = 12 + Math.sin(t * 1 + i * 1.4) * 5 + bass * 8; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, 6.28); ctx.strokeStyle = hexToRGBA(col[0], 0.12 + mid * 0.1); ctx.lineWidth = 0.8; ctx.stroke(); }
    for (const sp of p.secondary) { sp.x += sp.vx; sp.y += sp.vy * (1 + mid * 1.5); if (sp.y < -0.05) { sp.y = 1.05; sp.x = Math.random(); } ctx.beginPath(); ctx.arc(sp.x * W + Math.sin(t * 1.2 + sp.alpha * 8) * 8, sp.y * H, sp.r, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], sp.alpha * (0.4 + mid * 0.4)); ctx.fill(); }
  }

  /* --- 7: GEOMETRIC VOID --- */
  function drawGeometricVoid(p, col, t, freq, bass, treble) {
    const gs = 35; ctx.strokeStyle = hexToRGBA(col[0], 0.03 + treble * 0.03); ctx.lineWidth = 0.4;
    for (let x = 0; x < W; x += gs) for (let y = 0; y < H; y += gs) { const d = Math.sin(x * 0.008 + t * 0.8) * 3 + Math.cos(y * 0.008 + t * 0.6) * 3; ctx.strokeRect(x + d, y + d, gs, gs); }
    for (const sh of p.main) { sh.rotX += sh.rotSpeedX * (1 + bass * 1.5); sh.rotY += sh.rotSpeedY * (1 + bass * 1.5); const cx = sh.x * W + Math.sin(t * 0.2 + sh.rotX) * 15, cy = sh.y * H + Math.cos(t * 0.15 + sh.rotY) * 10; const vt = getVerts(sh.type); const pr = vt.map(v => proj3D(v, sh.rotX, sh.rotY, sh.size * (1 + beatPulse * 0.15), cx, cy)); const ed = getEdges(sh.type, vt.length); ctx.strokeStyle = hexToRGBA(col[0], 0.3 + treble * 0.25); ctx.lineWidth = 0.8; ctx.shadowBlur = 4 + bass * 8; ctx.shadowColor = col[0]; for (const [a, b] of ed) { if (a >= pr.length || b >= pr.length) continue; ctx.beginPath(); ctx.moveTo(pr[a].x, pr[a].y); ctx.lineTo(pr[b].x, pr[b].y); ctx.stroke(); } for (const pv of pr) { ctx.beginPath(); ctx.arc(pv.x, pv.y, 1.5, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.4); ctx.fill(); } ctx.shadowBlur = 0; }
    for (const gp of p.secondary) { gp.rot += gp.speed; gp.y += 0.0002; if (gp.y > 1.1) { gp.y = -0.1; gp.x = Math.random(); } ctx.save(); ctx.translate(gp.x * W, gp.y * H); ctx.rotate(gp.rot); ctx.strokeStyle = hexToRGBA(col[0], 0.15); ctx.lineWidth = 0.4; ctx.strokeRect(-gp.size / 2, -gp.size / 2, gp.size, gp.size); ctx.restore(); }
  }
  function getVerts(t) { if (t === 0) return [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]; if (t === 1) return [[0,-1,0],[1,0,0],[0,0,1],[-1,0,0],[0,0,-1],[0,1,0]]; const v = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.28, r = i % 2 === 0 ? 1 : 0.6; v.push([Math.cos(a) * r, Math.sin(a) * r, i < 6 ? -0.5 : 0.5]); } return v; }
  function getEdges(t, n) { if (t === 0) return [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]; if (t === 1) return [[0,1],[0,2],[0,3],[0,4],[5,1],[5,2],[5,3],[5,4],[1,2],[2,3],[3,4],[4,1]]; const e = []; for (let i = 0; i < n; i++) e.push([i, (i + 1) % n]); for (let i = 0; i < 6; i++) e.push([i, i + 6]); return e; }
  function proj3D(v, rx, ry, s, cx, cy) { let x = v[0] * Math.cos(ry) - v[2] * Math.sin(ry), z = v[0] * Math.sin(ry) + v[2] * Math.cos(ry), y = v[1]; const y2 = y * Math.cos(rx) - z * Math.sin(rx), z2 = y * Math.sin(rx) + z * Math.cos(rx), p = 3 / (3 + z2); return { x: cx + x * s * p, y: cy + y2 * s * p }; }

  /* --- 8: CITY RAIN --- */
  function drawCityRain(p, col, t, freq, bass, mid) {
    // skyline silhouettes
    for (const b of p.secondary) { const bx = b.x * W, bh = b.h * H, bw = b.w * W; ctx.fillStyle = 'rgba(15,15,25,0.9)'; ctx.fillRect(bx, H - bh, bw, bh);
      for (let f = 0; f < b.floors; f++) for (let w = 0; w < b.windows; w++) { const wx = bx + 3 + w * (bw - 6) / b.windows, wy = H - bh + 8 + f * (bh / b.floors); const lit = Math.sin(t * 0.1 + f + w * 3 + b.x * 10) > 0; ctx.fillStyle = lit ? hexToRGBA(col[0], 0.2 + mid * 0.15) : 'rgba(30,30,50,0.5)'; ctx.fillRect(wx, wy, (bw - 10) / b.windows * 0.6, (bh / b.floors) * 0.5); } }
    // wet street reflections
    const reflY = H * 0.82; ctx.fillStyle = hexToRGBA(col[0], 0.03 + bass * 0.02); ctx.fillRect(0, reflY, W, H - reflY);
    for (const b of p.secondary) { const bx = b.x * W, bw = b.w * W; ctx.save(); ctx.globalAlpha = 0.06 + mid * 0.04; ctx.scale(1, -0.3); ctx.translate(0, -reflY * 4.3); ctx.fillStyle = hexToRGBA(col[0], 0.15); ctx.fillRect(bx, H - b.h * H, bw, b.h * H * 0.4); ctx.restore(); }
    // streetlights
    for (let i = 0; i < 5; i++) { const lx = W * (0.1 + i * 0.2), ly = H * 0.55; ctx.beginPath(); ctx.arc(lx, ly, 3, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.5 + Math.sin(t * 0.5 + i) * 0.2); ctx.fill(); const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 60 + bass * 20); lg.addColorStop(0, hexToRGBA(col[0], 0.08)); lg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = lg; ctx.fillRect(lx - 80, ly - 80, 160, 160); }
    // rain
    ctx.strokeStyle = hexToRGBA(col[0], 0.1); ctx.lineWidth = 0.6;
    for (const r of p.main) { r.y += r.vy * (1 + bass); if (r.y > 1.05) { r.y = -0.05; r.x = Math.random(); } const rx = r.x * W + Math.sin(t * 0.3) * 3; ctx.beginPath(); ctx.moveTo(rx, r.y * H); ctx.lineTo(rx - 0.5, r.y * H + r.len * H); ctx.stroke(); }
    // puddle ripples
    for (const pr of p.tertiary) { pr.phase += pr.speed * 0.02; const ring = (Math.sin(pr.phase) * 0.5 + 0.5) * pr.maxR; ctx.beginPath(); ctx.arc(pr.x * W, H * 0.88 + Math.random() * H * 0.05, ring, 0, 6.28); ctx.strokeStyle = hexToRGBA(col[0], 0.06 * (1 - ring / pr.maxR)); ctx.lineWidth = 0.5; ctx.stroke(); }
  }

  /* --- 9: BEACH MIDNIGHT --- */
  function drawBeachMidnight(p, col, t, freq, bass, mid) {
    // moon
    const moonX = W * 0.75, moonY = H * 0.15, moonR = 25;
    const mg = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 4);
    mg.addColorStop(0, 'rgba(255,255,240,0.3)'); mg.addColorStop(0.3, 'rgba(255,255,240,0.05)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H);
    ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, 6.28); ctx.fillStyle = 'rgba(255,255,230,0.7)'; ctx.fill();
    // stars
    for (const s of p.main) { const tw = 0.3 + 0.7 * Math.sin(t * 1.5 + s.twinkle); ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${tw * 0.6})`; ctx.fill(); }
    // ocean + waves
    const shoreline = H * 0.65;
    ctx.fillStyle = hexToRGBA(col[1], 0.06); ctx.fillRect(0, shoreline, W, H);
    for (let w = 0; w < 5; w++) { ctx.beginPath(); const wy = shoreline + w * 20 + Math.sin(t * 0.5 + w) * 8; for (let x = 0; x <= W; x += 3) { const y = wy + Math.sin(x * 0.01 + t * (0.8 - w * 0.1) + w) * (5 + bass * 6); x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.strokeStyle = hexToRGBA(col[0], 0.1 - w * 0.015); ctx.lineWidth = 1; ctx.stroke(); }
    // moonlight reflection on water
    ctx.beginPath(); for (let y = shoreline; y < H; y += 3) { const rx = moonX + Math.sin(y * 0.05 + t) * (15 + (y - shoreline) * 0.15); ctx.moveTo(rx - 3, y); ctx.lineTo(rx + 3, y); } ctx.strokeStyle = 'rgba(255,255,230,0.08)'; ctx.lineWidth = 2; ctx.stroke();
    // wet sand
    const sandY = H * 0.78; ctx.fillStyle = hexToRGBA(col[1], 0.03 + bass * 0.02); for (let x = 0; x < W; x += 30) { ctx.fillRect(x + Math.sin(t * 0.3 + x * 0.01) * 5, sandY + Math.sin(x * 0.02) * 3, 20, 1); }
    // foam
    for (const f of p.secondary) { const fy = shoreline + 5 + Math.sin(t * 0.6 + f.foam) * 10; ctx.beginPath(); ctx.arc(f.x * W + Math.sin(t * 0.4 + f.foam) * 15, fy, 2, 0, 6.28); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill(); }
    // lighthouse beam
    const lh = p.tertiary[0]; lh.angle += lh.speed * 0.005;
    const lhx = W * 0.1, lhy = H * 0.5;
    ctx.save(); ctx.translate(lhx, lhy); ctx.rotate(Math.sin(lh.angle) * 0.8);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.6, -15); ctx.lineTo(W * 0.6, 15); ctx.closePath();
    ctx.fillStyle = `rgba(255,255,200,${0.02 + bass * 0.02})`; ctx.fill(); ctx.restore();
    // lighthouse structure
    ctx.fillStyle = 'rgba(20,20,30,0.8)'; ctx.fillRect(lhx - 4, lhy, 8, H - lhy); ctx.beginPath(); ctx.arc(lhx, lhy, 5, 0, 6.28); ctx.fillStyle = `rgba(255,255,200,${0.5 + Math.sin(t * 2) * 0.2})`; ctx.fill();
  }

  /* --- 10: LA SUNSET --- */
  function drawLASunset(p, col, t, freq, bass, mid) {
    // sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.65);
    sky.addColorStop(0, hexToRGBA('#1a0533', 0.8)); sky.addColorStop(0.3, hexToRGBA(col[0], 0.3)); sky.addColorStop(0.6, hexToRGBA('#ff6b35', 0.25)); sky.addColorStop(1, hexToRGBA('#ffb347', 0.2));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // sun near horizon
    const sunY = H * 0.52; const sunR = 40 + bass * 10;
    const sg = ctx.createRadialGradient(W * 0.6, sunY, 0, W * 0.6, sunY, sunR * 3);
    sg.addColorStop(0, 'rgba(255,100,50,0.4)'); sg.addColorStop(0.4, 'rgba(255,150,50,0.1)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    ctx.beginPath(); ctx.arc(W * 0.6, sunY, sunR, 0, 6.28); ctx.fillStyle = 'rgba(255,120,50,0.6)'; ctx.fill();
    // haze clouds
    for (const c of p.tertiary) { c.x += c.vx; if (c.x > 1.3) c.x = -0.3; const cx = c.x * W, cy = c.y * H; const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, c.size); cg.addColorStop(0, hexToRGBA(col[0], c.alpha)); cg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = cg; ctx.fillRect(cx - c.size, cy - c.size, c.size * 2, c.size * 2); }
    // ground
    ctx.fillStyle = 'rgba(10,8,15,0.7)'; ctx.fillRect(0, H * 0.62, W, H * 0.38);
    // palm tree silhouettes
    for (const palm of p.main) { const px = palm.x * W, py = H * (0.62 - palm.h); const sway = Math.sin(t * 0.3 + palm.lean * 10) * 8;
      // trunk
      ctx.beginPath(); ctx.moveTo(px, H * 0.62); ctx.quadraticCurveTo(px + sway * 0.5, H * 0.62 - palm.h * H * 0.5, px + sway, py); ctx.strokeStyle = 'rgba(10,8,15,0.9)'; ctx.lineWidth = 4; ctx.stroke();
      // fronds
      for (let f = 0; f < palm.fronds; f++) { const fa = (f / palm.fronds) * Math.PI * 2 + t * 0.05; const fLen = 30 + Math.random() * 20; ctx.beginPath(); ctx.moveTo(px + sway, py); const fx = px + sway + Math.cos(fa) * fLen + Math.sin(t * 0.5 + f) * 5; const fy = py + Math.sin(fa) * fLen * 0.5 + Math.abs(Math.cos(fa)) * 15; ctx.quadraticCurveTo(px + sway + Math.cos(fa) * fLen * 0.5, py + Math.sin(fa) * fLen * 0.3, fx, fy); ctx.strokeStyle = 'rgba(10,8,15,0.85)'; ctx.lineWidth = 2; ctx.stroke(); }
    }
    // birds
    for (const bird of p.secondary) { bird.x += bird.vx; bird.wing += 0.06; if (bird.x > 1.1) bird.x = -0.1; const bx = bird.x * W, by = bird.y * H + Math.sin(t * 0.5 + bird.x * 5) * 8; ctx.beginPath(); ctx.moveTo(bx - 6, by); ctx.quadraticCurveTo(bx - 3, by - 4 * Math.sin(bird.wing), bx, by); ctx.quadraticCurveTo(bx + 3, by - 4 * Math.sin(bird.wing + 0.5), bx + 6, by); ctx.strokeStyle = 'rgba(10,8,15,0.6)'; ctx.lineWidth = 1.2; ctx.stroke(); }
  }

  /* --- 11: TOKYO NEON --- */
  function drawTokyoNeon(p, col, t, freq, bass, mid) {
    // buildings with neon signs
    for (const b of p.main) { const bx = b.x * W, bh = b.h * H, bw = b.w * W;
      ctx.fillStyle = 'rgba(12,10,20,0.85)'; ctx.fillRect(bx, H - bh, bw, bh);
      // neon signs
      for (let s = 0; s < b.signs; s++) { const sy = H - bh + 15 + s * (bh / (b.signs + 1)); const sw = bw * 0.7, sh = 12 + Math.random() * 8;
        const flk = Math.sin(t * 3 + b.flicker + s * 2) > -0.1 ? 1 : 0.1;
        ctx.fillStyle = `hsla(${(b.hue + s * 60) % 360},80%,60%,${(0.15 + mid * 0.15) * flk})`; ctx.fillRect(bx + (bw - sw) / 2, sy, sw, sh);
        // glow
        const ng = ctx.createRadialGradient(bx + bw / 2, sy + sh / 2, 0, bx + bw / 2, sy + sh / 2, 40);
        ng.addColorStop(0, `hsla(${(b.hue + s * 60) % 360},80%,60%,${0.06 * flk})`); ng.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ng; ctx.fillRect(bx - 20, sy - 20, bw + 40, sh + 40);
      } }
    // wet street reflection
    ctx.fillStyle = hexToRGBA(col[0], 0.02); ctx.fillRect(0, H * 0.85, W, H * 0.15);
    for (const b of p.main) { for (let s = 0; s < b.signs; s++) { const flk = Math.sin(t * 3 + b.flicker + s * 2) > -0.1 ? 1 : 0.1; const ry = H * 0.87 + s * 5; ctx.fillStyle = `hsla(${(b.hue + s * 60) % 360},80%,60%,${0.03 * flk})`; ctx.fillRect(b.x * W, ry, b.w * W, 3); } }
    // pedestrian silhouettes
    for (const ped of p.secondary) { ped.x += ped.vx; if (ped.x > 1.05) ped.x = -0.05; if (ped.x < -0.05) ped.x = 1.05; const px = ped.x * W, py = H * ped.y; ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(px, py - 12, 4, 12); ctx.beginPath(); ctx.arc(px + 2, py - 14, 2.5, 0, 6.28); ctx.fill(); }
    // car light trails
    for (const lt of p.tertiary) { lt.x += lt.vx; if (lt.x > 1.2) { lt.x = -0.2; lt.hue = Math.random() * 360; } const lx = lt.x * W, ly = lt.y * H; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - lt.length * W, ly); ctx.strokeStyle = `hsla(${lt.hue},80%,60%,0.15)`; ctx.lineWidth = 2; ctx.stroke(); }
  }

  /* --- 12: DESERT HIGHWAY --- */
  function drawDesertHighway(p, col, t, freq, bass, mid) {
    // sky gradient (warm)
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    sky.addColorStop(0, hexToRGBA('#0a0520', 0.6)); sky.addColorStop(1, hexToRGBA(col[0], 0.1));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // distant mountains
    for (const m of p.main) { ctx.beginPath(); ctx.moveTo(m.x * W - 0.15 * W, H * 0.55); const mx = m.x * W, my = H * (0.55 - m.h); const px = mx + Math.sin(t * 0.1 + m.x * 5) * 3; ctx.quadraticCurveTo(mx - 0.05 * W, my + m.peak * H * 0.1, px, my); ctx.quadraticCurveTo(mx + 0.05 * W, my + m.peak * H * 0.08, m.x * W + 0.15 * W, H * 0.55); ctx.closePath(); ctx.fillStyle = hexToRGBA(col[1], 0.12); ctx.fill(); }
    // ground
    ctx.fillStyle = hexToRGBA(col[1], 0.04); ctx.fillRect(0, H * 0.55, W, H * 0.45);
    // road (vanishing point)
    const vp = H * 0.45;
    ctx.beginPath(); ctx.moveTo(W * 0.42, vp); ctx.lineTo(0, H); ctx.lineTo(W, H); ctx.lineTo(W * 0.58, vp); ctx.closePath();
    ctx.fillStyle = 'rgba(20,18,25,0.5)'; ctx.fill();
    // center line dashes
    for (let i = 0; i < 15; i++) { const f = i / 15; const dy = vp + f * f * (H - vp); const dw = 2 + f * 3; const dx = W / 2 - dw / 2; const scrollOff = (t * 50 + i * 30) % (H * 0.06); ctx.fillStyle = hexToRGBA(col[0], 0.2 * f); ctx.fillRect(dx, dy + scrollOff, dw, 8 * f); }
    // heat shimmer
    for (let x = 0; x < W; x += 8) { const shimY = H * 0.55 + Math.sin(x * 0.03 + t * 2) * 2; ctx.fillStyle = hexToRGBA(col[0], 0.015); ctx.fillRect(x, shimY, 6, 1); }
    // dust particles
    for (const d of p.secondary) { d.x += d.vx; if (d.x > 1.1) d.x = -0.1; ctx.beginPath(); ctx.arc(d.x * W, d.y * H + Math.sin(t * 0.5 + d.x * 10) * 5, d.size, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], d.alpha * 0.3); ctx.fill(); }
    // cacti silhouettes
    for (const c of p.tertiary) { const cx = c.x * W, cy = c.y * H;
      ctx.fillStyle = 'rgba(10,10,15,0.5)'; ctx.fillRect(cx - 2, cy, 4, 20); ctx.fillRect(cx - 8, cy + 5, 6, 3); ctx.fillRect(cx - 8, cy + 5, 3, 10); ctx.fillRect(cx + 4, cy + 8, 6, 3); ctx.fillRect(cx + 7, cy + 8, 3, 8); }
  }

  /* --- 13: UNDERWATER REEF --- */
  function drawUnderwaterReef(p, col, t, freq, bass, mid) {
    const dg = ctx.createLinearGradient(0, 0, 0, H); dg.addColorStop(0, hexToRGBA('#0a2040', 0.3)); dg.addColorStop(1, hexToRGBA(col[1], 0.1)); ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H);
    // light shafts
    for (let i = 0; i < 4; i++) { const sx = W * (0.15 + i * 0.2) + Math.sin(t * 0.2 + i) * 30; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx - 20, 0); ctx.lineTo(sx + 40, H); ctx.lineTo(sx + 80, H); ctx.closePath(); ctx.fillStyle = hexToRGBA(col[0], 0.02 + bass * 0.02); ctx.fill(); }
    // seaweed
    for (const sw of p.tertiary) { ctx.beginPath(); let sx = sw.x * W, sy = H; ctx.moveTo(sx, sy); for (let s = 0; s < sw.segments; s++) { sy -= sw.h * H / sw.segments; sx += Math.sin(t * 0.8 + sw.sway + s * 0.5) * 4; ctx.lineTo(sx, sy); } ctx.strokeStyle = hexToRGBA(col[0], 0.15 + mid * 0.1); ctx.lineWidth = 2; ctx.stroke(); }
    // coral formations
    for (const c of p.main) { const cx = c.x * W, cy = c.y * H, cw = c.w * W, ch = c.h * H; const sway = Math.sin(t * 0.3 + c.sway) * 3;
      ctx.beginPath(); ctx.moveTo(cx, cy + ch); ctx.quadraticCurveTo(cx + sway, cy, cx + cw / 2, cy - ch * 0.3 + Math.sin(t * 0.5 + c.sway) * 3); ctx.quadraticCurveTo(cx + cw + sway, cy, cx + cw, cy + ch); ctx.closePath();
      ctx.fillStyle = `hsla(${c.hue},60%,40%,0.2)`; ctx.fill(); ctx.strokeStyle = `hsla(${c.hue},60%,50%,0.15)`; ctx.lineWidth = 1; ctx.stroke(); }
    // fish
    for (const f of p.secondary) { f.x += f.vx; f.y += f.vy; f.tail += 0.08; if (f.x > 1.1) f.x = -0.1; if (f.x < -0.1) f.x = 1.1; const fx = f.x * W, fy = f.y * H + Math.sin(t * 0.5 + f.x * 5) * 10; const dir = f.vx > 0 ? 1 : -1;
      ctx.beginPath(); ctx.ellipse(fx, fy, f.size, f.size * 0.4, 0, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.25); ctx.fill();
      // tail
      ctx.beginPath(); ctx.moveTo(fx - dir * f.size, fy); ctx.lineTo(fx - dir * (f.size + 6), fy - 3 + Math.sin(f.tail) * 2); ctx.lineTo(fx - dir * (f.size + 6), fy + 3 + Math.sin(f.tail) * 2); ctx.closePath(); ctx.fill(); }
  }

  /* --- 14: NORTHERN LIGHTS --- */
  function drawNorthernLights(p, col, t, freq, bass, mid) {
    // aurora ribbons
    for (const r of p.main) { ctx.beginPath(); for (let x = 0; x <= W; x += 4) { const nx = x / W; const y = r.y * H + Math.sin(nx * 5 + t * r.speed + r.offset) * r.amplitude * H + Math.sin(nx * 12 + t * r.speed * 1.5) * r.amplitude * H * 0.3 + bass * 15; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      // fill down
      ctx.lineTo(W, r.y * H + 60); ctx.lineTo(0, r.y * H + 60); ctx.closePath();
      const ag = ctx.createLinearGradient(0, r.y * H - r.amplitude * H, 0, r.y * H + 60);
      ag.addColorStop(0, `hsla(${r.hue},70%,55%,${0.08 + mid * 0.06})`); ag.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ag; ctx.fill(); }
    // tree line silhouette
    for (const tr of p.tertiary) { const tx = tr.x * W, th = tr.h * H; ctx.beginPath(); ctx.moveTo(tx, H); ctx.lineTo(tx, H - th); ctx.lineTo(tx + tr.w * W * 0.5, H - th * 1.3); ctx.lineTo(tx + tr.w * W, H - th); ctx.lineTo(tx + tr.w * W, H); ctx.closePath(); ctx.fillStyle = 'rgba(5,5,10,0.8)'; ctx.fill(); }
    // ground
    ctx.fillStyle = 'rgba(5,5,10,0.6)'; ctx.fillRect(0, H * 0.85, W, H * 0.15);
    // snow particles
    for (const s of p.secondary) { s.y += s.vy; s.x += Math.sin(t * 0.5 + s.alpha * 10) * 0.0003; if (s.y > 1.05) { s.y = -0.05; s.x = Math.random(); }
      ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.size, 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${s.alpha * 0.4})`; ctx.fill(); }
  }

  /* --- 15: RAINY WINDOW --- */
  function drawRainyWindow(p, col, t, freq, bass, mid) {
    // blurred city lights behind glass
    for (const l of p.secondary) { const lg = ctx.createRadialGradient(l.x * W, l.y * H, 0, l.x * W, l.y * H, l.r + mid * 10); lg.addColorStop(0, `hsla(${l.hue},60%,50%,${l.alpha + bass * 0.03})`); lg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = lg; ctx.fillRect(l.x * W - l.r * 2, l.y * H - l.r * 2, l.r * 4, l.r * 4); }
    // glass tint
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, W, H);
    // raindrops running down
    for (const d of p.main) { d.y += d.vy * (1 + d.r * 0.1); d.wobble += 0.03;
      if (d.y > 1.1) { d.y = -0.1; d.x = Math.random(); d.trail = []; }
      const dx = d.x * W + Math.sin(d.wobble) * 3, dy = d.y * H;
      // trail
      d.trail.push({ x: dx, y: dy });
      if (d.trail.length > 20) d.trail.shift();
      ctx.beginPath();
      for (let i = 0; i < d.trail.length; i++) { const tp = d.trail[i]; i === 0 ? ctx.moveTo(tp.x, tp.y) : ctx.lineTo(tp.x, tp.y); }
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = d.r * 0.3; ctx.stroke();
      // drop head
      ctx.beginPath(); ctx.arc(dx, dy, d.r * 0.6, 0, 6.28);
      ctx.fillStyle = 'rgba(200,220,255,0.12)'; ctx.fill();
      // refraction highlight
      ctx.beginPath(); ctx.arc(dx - d.r * 0.15, dy - d.r * 0.15, d.r * 0.15, 0, 6.28);
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill(); }
  }

  /* --- 16: VINYL GROOVE --- */
  function drawVinylGroove(p, col, t, freq, bass, mid) {
    const cx = W * 0.5, cy = H * 0.48, maxR = Math.min(W, H) * 0.38;
    p.main[0].angle += 0.008 + bass * 0.01;
    // record body
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    rg.addColorStop(0, 'rgba(20,20,20,0.9)'); rg.addColorStop(0.15, 'rgba(5,5,5,0.9)'); rg.addColorStop(1, 'rgba(15,15,15,0.9)');
    ctx.beginPath(); ctx.arc(cx, cy, maxR, 0, 6.28); ctx.fillStyle = rg; ctx.fill();
    // grooves
    for (let r = maxR * 0.2; r < maxR * 0.95; r += 3) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.28); const ga = 0.03 + Math.sin(r * 0.5 + t * 2) * 0.02 + mid * 0.03; ctx.strokeStyle = `rgba(40,40,40,${ga})`; ctx.lineWidth = 0.5; ctx.stroke(); }
    // label
    ctx.beginPath(); ctx.arc(cx, cy, maxR * 0.18, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.4); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, maxR * 0.03, 0, 6.28); ctx.fillStyle = 'rgba(30,30,30,0.9)'; ctx.fill();
    // light reflection moving across
    const refAngle = p.main[0].angle;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(refAngle);
    const lg = ctx.createLinearGradient(-maxR, 0, maxR, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.48, 'rgba(255,255,255,0.04)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.08)'); lg.addColorStop(0.52, 'rgba(255,255,255,0.04)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg; ctx.fillRect(-maxR, -maxR, maxR * 2, maxR * 2); ctx.restore();
    // tonearm
    const armAngle = p.main[0].armAngle; const armPivotX = W * 0.78, armPivotY = H * 0.12;
    ctx.save(); ctx.translate(armPivotX, armPivotY); ctx.rotate(armAngle + Math.sin(t * 0.1) * 0.02);
    ctx.strokeStyle = 'rgba(80,80,80,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-W * 0.25, H * 0.35); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, 6.28); ctx.fillStyle = 'rgba(60,60,60,0.7)'; ctx.fill(); ctx.restore();
    // dust motes
    for (const d of p.secondary) { d.x += d.vx; d.y += d.vy; if (d.x < 0) d.x = 1; if (d.x > 1) d.x = 0; if (d.y < 0) d.y = 1;
      ctx.beginPath(); ctx.arc(d.x * W, d.y * H, d.size, 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${d.alpha})`; ctx.fill(); }
  }

  /* --- 17: FOREST CANOPY --- */
  function drawForestCanopy(p, col, t, freq, bass, mid) {
    // deep green ambient
    ctx.fillStyle = hexToRGBA('#0a1a0a', 0.3); ctx.fillRect(0, 0, W, H);
    // light filtering through canopy
    for (let i = 0; i < 5; i++) { const sx = W * (0.15 + i * 0.18) + Math.sin(t * 0.15 + i) * 30, sy = 0; const sw = 25 + Math.sin(t * 0.3 + i * 2) * 10;
      const sg = ctx.createLinearGradient(sx, 0, sx + sw * 3, H); sg.addColorStop(0, hexToRGBA(col[0], 0.05 + bass * 0.03)); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx + sw, 0); ctx.lineTo(sx + sw * 3, H * 0.7); ctx.lineTo(sx - sw, H * 0.7); ctx.closePath(); ctx.fill(); }
    // layered leaf canopy
    for (const layer of p.main) { const lx = layer.x * W + Math.sin(t * 0.2 + layer.sway) * 15; const depth = layer.depth;
      for (let i = 0; i < 8; i++) { const leafX = lx + (Math.sin(i * 2.3 + layer.sway) * 40 + i * 20) * (1 + depth * 0.2); const leafY = depth * 30 + Math.sin(t * 0.3 + i + layer.sway) * 5;
        ctx.save(); ctx.translate(leafX, leafY); ctx.rotate(Math.sin(t * 0.2 + i + layer.sway) * 0.2);
        ctx.beginPath(); ctx.ellipse(0, 0, 15 + layer.size * 30, 6 + layer.size * 10, 0, 0, 6.28);
        ctx.fillStyle = hexToRGBA(col[0], 0.06 + depth * 0.01); ctx.fill(); ctx.restore(); } }
    // tree trunks
    for (let i = 0; i < 4; i++) { const tx = W * (0.1 + i * 0.25) + Math.sin(i * 3) * 30; ctx.fillStyle = 'rgba(20,15,10,0.25)'; ctx.fillRect(tx, 0, 6 + i * 2, H); }
    // fireflies
    for (const ff of p.secondary) { ff.pulse += 0.02; ff.x += ff.vx; ff.y += ff.vy; if (ff.y > 1) ff.y = 0; if (ff.x > 1) ff.x = 0; if (ff.x < 0) ff.x = 1;
      const glow = 0.5 + 0.5 * Math.sin(ff.pulse); ctx.beginPath(); ctx.arc(ff.x * W, ff.y * H, 2 + mid * 2, 0, 6.28);
      ctx.shadowBlur = 8 + mid * 8; ctx.shadowColor = col[0]; ctx.fillStyle = hexToRGBA(col[0], ff.alpha * glow); ctx.fill(); } ctx.shadowBlur = 0;
    // falling leaves
    for (const leaf of p.tertiary) { leaf.angle += leaf.speed; leaf.y += 0.0003; if (leaf.y > 1) leaf.y = 0;
      const lx = leaf.x * W + Math.sin(leaf.angle) * 30, ly = leaf.y * H; ctx.save(); ctx.translate(lx, ly); ctx.rotate(leaf.angle * 2);
      ctx.beginPath(); ctx.ellipse(0, 0, 4, 2, 0, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.2); ctx.fill(); ctx.restore(); }
  }

  /* --- 18: ROOFTOP NIGHT --- */
  function drawRooftopNight(p, col, t, freq, bass, mid) {
    // sky gradient
    const sg = ctx.createLinearGradient(0, 0, 0, H * 0.6); sg.addColorStop(0, hexToRGBA('#050515', 0.6)); sg.addColorStop(1, hexToRGBA(col[1], 0.05)); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    // stars
    for (const s of p.secondary) { const tw = 0.3 + 0.7 * Math.sin(t * 1.5 + s.twinkle); ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${tw * 0.5})`; ctx.fill(); }
    // city skyline silhouette
    for (const b of p.main) { const bx = b.x * W, bh = b.h * H, bw = b.w * W; ctx.fillStyle = 'rgba(10,10,18,0.8)'; ctx.fillRect(bx, H * 0.6 - bh, bw, bh + H * 0.4);
      // lit windows
      for (let f = 0; f < b.windows; f++) { const wx = bx + 2, wy = H * 0.6 - bh + 5 + f * (bh / b.windows); const lit = Math.sin(t * 0.08 + f * 2 + b.lit) > 0.2;
        ctx.fillStyle = lit ? hexToRGBA(col[0], 0.12 + mid * 0.08) : 'rgba(15,15,25,0.3)'; ctx.fillRect(wx, wy, bw - 4, 3); } }
    // rooftop surface
    ctx.fillStyle = 'rgba(15,15,20,0.6)'; ctx.fillRect(0, H * 0.6, W, H * 0.4);
    // water tower
    const wt = p.tertiary[0]; const wtx = wt.x * W, wty = H * 0.6 - wt.legH * H;
    ctx.fillStyle = 'rgba(25,25,30,0.7)'; ctx.fillRect(wtx - 3, wty, 2, wt.legH * H); ctx.fillRect(wtx + 10, wty, 2, wt.legH * H);
    ctx.beginPath(); ctx.ellipse(wtx + 5, wty - 10, 12, 15, 0, 0, 6.28); ctx.fillStyle = 'rgba(30,30,35,0.7)'; ctx.fill();
    // distant traffic glow
    for (let i = 0; i < 3; i++) { const gx = W * (0.2 + i * 0.3), gy = H * 0.6; const tg = ctx.createRadialGradient(gx, gy, 0, gx, gy, 50 + bass * 20);
      tg.addColorStop(0, hexToRGBA(col[0], 0.04 + bass * 0.03)); tg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = tg; ctx.fillRect(gx - 70, gy - 30, 140, 60); }
    // airplane blink
    const apX = (t * 15) % (W + 200) - 100, apY = H * 0.1 + Math.sin(t * 0.2) * 20;
    if (Math.sin(t * 2) > 0.7) { ctx.beginPath(); ctx.arc(apX, apY, 1.5, 0, 6.28); ctx.fillStyle = 'rgba(255,50,50,0.6)'; ctx.fill(); }
  }

  /* --- 19: SUBWAY TUNNEL --- */
  function drawSubwayTunnel(p, col, t, freq, bass, mid) {
    // tunnel shape (perspective)
    const cx = W / 2, cy = H * 0.45;
    const outerW = W * 0.48, outerH = H * 0.42;
    const innerW = W * 0.08, innerH = H * 0.06;
    // tunnel walls
    ctx.beginPath(); ctx.moveTo(cx - outerW, H); ctx.lineTo(cx - innerW, cy - innerH); ctx.lineTo(cx + innerW, cy - innerH); ctx.lineTo(cx + outerW, H); ctx.closePath();
    ctx.fillStyle = 'rgba(18,16,22,0.7)'; ctx.fill();
    // ceiling
    ctx.beginPath(); ctx.moveTo(cx - outerW, 0); ctx.lineTo(cx - innerW, cy - innerH); ctx.lineTo(cx + innerW, cy - innerH); ctx.lineTo(cx + outerW, 0); ctx.closePath();
    ctx.fillStyle = 'rgba(12,10,16,0.6)'; ctx.fill();
    // tunnel lights streaking
    for (const lt of p.main) { lt.z += lt.speed * (1 + bass * 1.5); if (lt.z > 1) lt.z = Math.random() * 0.1;
      const f = lt.z; const perspX = lerp(innerW, outerW, f) * lt.side; const perspY = lerp(cy - innerH, 0, f * 0.5);
      const lx = cx + perspX, ly = lerp(cy, lt.side > 0 ? H * 0.3 : H * 0.7, f);
      ctx.beginPath(); ctx.arc(lx, ly, 2 + f * 4, 0, 6.28);
      ctx.fillStyle = `hsla(${lt.hue},60%,60%,${(1 - f) * 0.4})`; ctx.fill();
      // streak
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + lt.side * 20 * f, ly + 10 * f);
      ctx.strokeStyle = `hsla(${lt.hue},60%,60%,${(1 - f) * 0.15})`; ctx.lineWidth = 1 + f * 2; ctx.stroke(); }
    // fluorescent lights on ceiling
    for (const fl of p.secondary) { fl.flicker += 0.05; fl.z += 0.001; if (fl.z > 0.8) fl.z = 0.1;
      const f = fl.z; const ly = lerp(cy, 10, f); const lw = lerp(innerW * 0.3, outerW * 0.3, f);
      const bright = fl.brightness * (0.7 + 0.3 * Math.sin(fl.flicker)) * (Math.sin(fl.flicker * 7) > 0.9 ? 0.2 : 1);
      ctx.fillStyle = `rgba(200,220,255,${bright * 0.15})`; ctx.fillRect(cx - lw, ly, lw * 2, 2 + f * 3); }
    // rails
    for (let side = -1; side <= 1; side += 2) { ctx.beginPath(); ctx.moveTo(cx + outerW * 0.6 * side, H); ctx.lineTo(cx + innerW * 0.3 * side, cy); ctx.strokeStyle = 'rgba(60,60,70,0.3)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    // sparks / dust
    for (const sp of p.tertiary) { sp.x += sp.vx; sp.y += sp.vy; if (Math.abs(sp.x - 0.5) > 0.5 || sp.y > 1 || sp.y < 0) { sp.x = 0.4 + Math.random() * 0.2; sp.y = 0.4 + Math.random() * 0.2; }
      ctx.beginPath(); ctx.arc(sp.x * W, sp.y * H, sp.size, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.2); ctx.fill(); }
    // vanishing point glow
    const vpg = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerW * 2);
    vpg.addColorStop(0, hexToRGBA(col[0], 0.08 + bass * 0.06)); vpg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = vpg; ctx.fillRect(cx - innerW * 2, cy - innerH * 2, innerW * 4, innerH * 4);
  }

  /* ============== VIEW HOOKS ============== */
  function onSearch(query) {
    trackList = getFilteredTracks();
    if (scrollInner) scrollInner.style.height = (trackList.length * H) + 'px';
    sceneParticles = {};
    if (scrollContainer) scrollContainer.scrollTop = 0;
    onScroll();
  }

  function onTrackChange(index) {
    for (let i = 0; i < trackList.length; i++) {
      if (trackList[i].originalIndex === index) { if (scrollContainer) scrollContainer.scrollTop = i * H; break; }
    }
  }

  registerView('tapespine', { init, destroy, onSearch, onTrackChange });
})();
