/* =========================================================
   WALL.JS — "the WALL" sticker view (b054)
   ---------------------------------------------------------
   Default landing view. 100 gecs / Y2K hyperpop energy:
   hot magenta background, scrolling checker, every track
   rendered as a colorful tilted sticker, decorative pixel
   glyphs scattered between, audio-reactive pulse on the
   currently-playing track.

   2D canvas, no Three.js. Mirrors the neural.js IIFE
   pattern (init/destroy/registerView). ~320 lines.

   Click a sticker → opens the official track-detail panel
   via the global showTrackDetail(index).
   ========================================================= */

(function () {
  let canvas, ctx, container;
  let W, H, rafId;
  let mx = -9999, my = -9999;
  let stickers = [];
  let glyphs = [];
  let hovered = -1;
  let t0 = 0;
  const isMobile = () => window.innerWidth < 768;

  // Chaotic palette — bright, saturated, hyperpop
  const PALETTE = [
    ['#9cff3a', '#1a8a00'],   // lime
    ['#4ad8ff', '#0a4a8c'],   // cyan
    ['#ffe833', '#a86b00'],   // yellow
    ['#ff2bd6', '#5a0838'],   // hot pink
    ['#a855f7', '#3a0a6c'],   // electric purple
    ['#ff7a1a', '#7a2a00'],   // orange
    ['#ffffff', '#666666'],   // white
    ['#0aff9c', '#00564a'],   // mint
  ];

  // -------------------------------------------------------
  function init(cont) {
    container = cont;

    canvas = document.createElement('canvas');
    canvas.className = 'view-canvas';
    canvas.style.cursor = 'pointer';
    container.appendChild(canvas);
    ctx = canvas.getContext('2d');

    // Track count badge in the corner
    const info = document.createElement('div');
    info.className = 'info-panel';
    info.innerHTML = `
      <div class="info-label">click a sticker</div>
      <div class="info-title" id="wallTitle">// THE WALL</div>
      <div class="info-meta" id="wallMeta">${(window.tracks || []).length} tracks · 100% gecs</div>
    `;
    container.appendChild(info);

    container.addEventListener('mousemove', onMouse);
    container.addEventListener('mouseleave', onLeave);
    container.addEventListener('touchmove', onTouch, { passive: true });
    container.addEventListener('touchstart', onTouch, { passive: true });
    container.addEventListener('click', onClick);

    resize();
    window.addEventListener('resize', resize);
    t0 = performance.now();
    draw();
  }

  function destroy() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    window.removeEventListener('resize', resize);
    if (container) {
      container.removeEventListener('mousemove', onMouse);
      container.removeEventListener('mouseleave', onLeave);
      container.removeEventListener('touchmove', onTouch);
      container.removeEventListener('touchstart', onTouch);
      container.removeEventListener('click', onClick);
    }
    canvas = ctx = container = null;
    stickers = [];
    glyphs = [];
  }

  // -------------------------------------------------------
  function onMouse(e) {
    const r = container.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
  }
  function onLeave() { mx = my = -9999; }
  function onTouch(e) {
    const r = container.getBoundingClientRect();
    const t = e.touches[0];
    if (!t) return;
    mx = t.clientX - r.left;
    my = t.clientY - r.top;
  }
  function onClick() {
    if (hovered >= 0 && hovered < stickers.length) {
      const s = stickers[hovered];
      if (typeof window.showTrackDetail === 'function') {
        window.showTrackDetail(s.trackIndex);
      } else if (typeof playTrack === 'function') {
        playTrack(s.trackIndex);
      }
    }
  }

  // -------------------------------------------------------
  function resize() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStickers();
    buildGlyphs();
  }

  // Deterministic hash so layout is stable across resize
  function hash(str, seed) {
    let h = seed || 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i);
    return Math.abs(h);
  }

  // -------------------------------------------------------
  function buildStickers() {
    stickers = [];
    const tracks = window.tracks || [];
    if (tracks.length === 0) return;

    const mobile = isMobile();
    const margin = mobile ? 24 : 80;
    const cellW = mobile ? 130 : 190;
    const cellH = mobile ? 80 : 110;

    // Loose grid then jitter — guarantees coverage without overlap chaos
    const cols = Math.max(2, Math.floor((W - margin * 2) / cellW));
    const rows = Math.ceil(tracks.length / cols);

    for (let i = 0; i < tracks.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const h1 = hash(tracks[i].title, 1);
      const h2 = hash(tracks[i].title, 7);
      const h3 = hash(tracks[i].title, 13);

      const cx = margin + cellW * (col + 0.5) + ((h1 % 100) - 50) * 0.45;
      const cy = margin + cellH * (row + 0.5) + ((h2 % 100) - 50) * 0.45;
      const rot = ((h3 % 240) - 120) / 120 * (Math.PI / 14);  // ±~13°
      const palIdx = h1 % PALETTE.length;
      const w = mobile ? 105 : 155;
      const hgt = mobile ? 56 : 78;

      stickers.push({
        cx, cy, ox: cx, oy: cy,
        w, h: hgt,
        rot, restRot: rot,
        palIdx,
        trackIndex: i,
        title: (tracks[i].title || 'Untitled').toUpperCase(),
        badge: pickBadge(i, tracks[i], h1),
        bobPhase: (h2 % 1000) / 1000 * Math.PI * 2,
        bobAmp: 4 + (h3 % 6),
        scale: 1,
      });
    }
  }

  function pickBadge(i, track, h) {
    if (track && track.isNew) return '★ NEW';
    if (track && track.isFeatured) return '✦ HOT';
    const opts = [`#${String(i + 1).padStart(2, '0')}`, '★', '!!', 'XX', '°°', '++', '◆◆'];
    return opts[h % opts.length];
  }

  // -------------------------------------------------------
  function buildGlyphs() {
    glyphs = [];
    const N = isMobile() ? 24 : 60;
    for (let i = 0; i < N; i++) {
      const h = hash('glyph' + i, 99);
      glyphs.push({
        x: (h % 1000) / 1000 * W,
        y: ((h >> 8) % 1000) / 1000 * H,
        rot: ((h % 360) / 360) * Math.PI * 2,
        scale: 0.6 + ((h >> 4) % 100) / 100 * 1.4,
        kind: ['star', 'sparkle', 'cross', 'arrow', 'bolt', 'dot'][h % 6],
        color: ['#ffffff', '#9cff3a', '#4ad8ff', '#ffe833', '#0e0e0e'][h % 5],
        speed: 0.3 + ((h >> 12) % 100) / 100 * 0.7,
      });
    }
  }

  // -------------------------------------------------------
  // BACKGROUND — hot magenta with a scrolling diagonal
  // checker overlay. Cheap, very Y2K.
  // -------------------------------------------------------
  function drawBackground(t) {
    ctx.fillStyle = '#ff2bd6';
    ctx.fillRect(0, 0, W, H);

    // Scrolling checker — diagonal cells of two pinks
    const size = 36;
    const offX = (t * 18) % size;
    const offY = (t * 18) % size;
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    for (let y = -size + offY; y < H + size; y += size) {
      for (let x = -size + offX; x < W + size; x += size) {
        if (((Math.floor((x + offX) / size) + Math.floor((y + offY) / size)) & 1) === 0) {
          ctx.fillRect(x, y, size, size);
        }
      }
    }

    // Subtle scanlines
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

    // Big corner wordmark
    drawWordmark(t);
  }

  function drawWordmark(t) {
    ctx.save();
    const fontSize = isMobile() ? 60 : 140;
    ctx.font = `900 ${fontSize}px Syne, "Arial Black", sans-serif`;
    ctx.textBaseline = 'top';
    const txt = '// THE WALL';
    const x = isMobile() ? 16 : 40;
    const y = isMobile() ? H - fontSize - 20 : H - fontSize - 40;
    // Shadow stack
    ctx.fillStyle = '#0e0e0e';
    ctx.fillText(txt, x + 6, y + 6);
    ctx.fillStyle = '#9cff3a';
    ctx.fillText(txt, x + 3, y + 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(txt, x, y);
    ctx.restore();
  }

  // -------------------------------------------------------
  function drawGlyphs(t) {
    for (const g of glyphs) {
      const dy = Math.sin(t * g.speed + g.x * 0.01) * 8;
      ctx.save();
      ctx.translate(g.x, g.y + dy);
      ctx.rotate(g.rot + t * g.speed * 0.4);
      ctx.scale(g.scale, g.scale);
      ctx.fillStyle = g.color;
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 2;
      drawGlyphShape(g.kind);
      ctx.restore();
    }
  }
  function drawGlyphShape(kind) {
    const c = ctx;
    if (kind === 'star') {
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 === 0 ? 8 : 3;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
    } else if (kind === 'sparkle') {
      c.beginPath();
      c.moveTo(0, -10); c.lineTo(2, -2); c.lineTo(10, 0);
      c.lineTo(2, 2); c.lineTo(0, 10); c.lineTo(-2, 2);
      c.lineTo(-10, 0); c.lineTo(-2, -2); c.closePath();
      c.fill();
    } else if (kind === 'cross') {
      c.fillRect(-1.5, -8, 3, 16);
      c.fillRect(-8, -1.5, 16, 3);
    } else if (kind === 'arrow') {
      c.beginPath();
      c.moveTo(-8, 0); c.lineTo(6, 0);
      c.moveTo(2, -4); c.lineTo(6, 0); c.lineTo(2, 4);
      c.stroke();
    } else if (kind === 'bolt') {
      c.beginPath();
      c.moveTo(-3, -10); c.lineTo(3, -2); c.lineTo(-1, -2);
      c.lineTo(3, 10); c.lineTo(-3, 2); c.lineTo(1, 2); c.closePath();
      c.fill();
    } else {
      c.beginPath();
      c.arc(0, 0, 4, 0, Math.PI * 2);
      c.fill();
    }
  }

  // -------------------------------------------------------
  // STICKER — rounded card, gradient fill, hard outline,
  // chunky title, badge corner, drop shadow
  // -------------------------------------------------------
  function drawSticker(s, t, isHover, beat) {
    const bobY = Math.sin(t * 1.2 + s.bobPhase) * s.bobAmp;
    // Smoothly snap rotation toward 0 on hover
    const targetRot = isHover ? 0 : s.restRot;
    s.rot += (targetRot - s.rot) * 0.18;
    // Smooth scale toward target
    const targetScale = isHover ? 1.18 : (1 + beat * 0.04);
    s.scale += (targetScale - s.scale) * 0.18;

    const [light, dark] = PALETTE[s.palIdx];

    ctx.save();
    ctx.translate(s.cx, s.cy + bobY);
    ctx.rotate(s.rot);
    ctx.scale(s.scale, s.scale);

    // Hard offset shadow
    ctx.fillStyle = '#0e0e0e';
    roundRect(-s.w / 2 + 6, -s.h / 2 + 6, s.w, s.h, 4);
    ctx.fill();

    // Sticker body — vertical gradient
    const grad = ctx.createLinearGradient(0, -s.h / 2, 0, s.h / 2);
    grad.addColorStop(0, light);
    grad.addColorStop(1, dark);
    ctx.fillStyle = grad;
    roundRect(-s.w / 2, -s.h / 2, s.w, s.h, 4);
    ctx.fill();

    // Hard black outline
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 3;
    roundRect(-s.w / 2, -s.h / 2, s.w, s.h, 4);
    ctx.stroke();

    // Inner highlight stripe across the top
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(-s.w / 2 + 4, -s.h / 2 + 4, s.w - 8, 4);

    // Title
    const titleSize = isMobile() ? 13 : 17;
    ctx.font = `900 ${titleSize}px Syne, "Arial Black", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const title = s.title.length > 16 ? s.title.slice(0, 14) + '…' : s.title;
    // Drop shadow on text
    ctx.fillStyle = '#0e0e0e';
    ctx.fillText(title, -s.w / 2 + 11, -s.h / 2 + 13);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, -s.w / 2 + 9, -s.h / 2 + 11);

    // Badge
    ctx.font = `900 ${isMobile() ? 10 : 12}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#0e0e0e';
    ctx.fillText(s.badge, -s.w / 2 + 10, s.h / 2 - 18);

    // Pixel sticker corner notch — fake torn corner
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.moveTo(s.w / 2 - 14, -s.h / 2);
    ctx.lineTo(s.w / 2, -s.h / 2);
    ctx.lineTo(s.w / 2, -s.h / 2 + 14);
    ctx.closePath();
    ctx.fill();

    // Hover-only: artist line
    if (isHover) {
      ctx.font = `700 ${isMobile() ? 10 : 11}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText('▶ KANI', s.w / 2 - 56, s.h / 2 - 18);
    }

    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    const c = ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  // -------------------------------------------------------
  // HIT TEST — axis-aligned approximation against the
  // sticker's tilted box. Cheap and good enough.
  // -------------------------------------------------------
  function hitTest() {
    hovered = -1;
    if (mx < 0 || my < 0) return;
    // Iterate top to bottom so the top sticker wins
    for (let i = stickers.length - 1; i >= 0; i--) {
      const s = stickers[i];
      const dx = mx - s.cx;
      const dy = my - s.cy;
      // Inverse rotation
      const cs = Math.cos(-s.rot), sn = Math.sin(-s.rot);
      const lx = dx * cs - dy * sn;
      const ly = dx * sn + dy * cs;
      const halfW = (s.w * s.scale) / 2;
      const halfH = (s.h * s.scale) / 2;
      if (lx >= -halfW && lx <= halfW && ly >= -halfH && ly <= halfH) {
        hovered = i;
        break;
      }
    }
  }

  // -------------------------------------------------------
  // AUDIO REACT — pull a single beat-strength scalar from
  // the player's frequency data if available.
  // -------------------------------------------------------
  function getBeat() {
    if (typeof getFrequencyData !== 'function') return 0;
    const data = getFrequencyData();
    if (!data || data.length === 0) return 0;
    let sum = 0;
    const n = Math.min(data.length, 16);
    for (let i = 0; i < n; i++) sum += data[i];
    return Math.min(1, (sum / n) / 200);
  }

  // -------------------------------------------------------
  function draw() {
    if (!ctx || !canvas) return;
    const t = (performance.now() - t0) * 0.001;
    const beat = getBeat();

    drawBackground(t);
    drawGlyphs(t);
    hitTest();

    // Draw all non-hovered stickers first, then hovered on top
    for (let i = 0; i < stickers.length; i++) {
      if (i === hovered) continue;
      drawSticker(stickers[i], t, false, beat);
    }
    if (hovered >= 0) {
      drawSticker(stickers[hovered], t, true, beat);
    }

    rafId = requestAnimationFrame(draw);
  }

  // -------------------------------------------------------
  // Re-build stickers when search filters change so the
  // global search bar can drive the wall.
  // -------------------------------------------------------
  function onSearch(/* q */) {
    // We display all tracks regardless — search just updates
    // the meta line for now. Future: filter the wall.
    const meta = document.getElementById('wallMeta');
    if (meta) meta.textContent = `${(window.tracks || []).length} tracks · 100% gecs`;
  }

  registerView('wall', { init, destroy, onSearch });
})();
