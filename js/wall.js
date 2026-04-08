/* =========================================================
   WALL.JS — "the WALL" creature view (b055)
   ---------------------------------------------------------
   Default landing view. Hot magenta + scrolling checker
   background (the user loved this from b054), with up to
   117 small animated clickable creatures floating around.
   Each creature is a track — click opens the official
   track-detail panel.

   Creature types (one per track, picked deterministically
   from a hash of the title): butterfly, drone, jellyfish,
   fish, comet, beetle, eye, crystal. Each has its own
   tiny canvas draw routine + per-frame animation.

   Decorative ambient glyphs (stars, sparkles, etc) drift
   in the background underneath the creatures.

   2D canvas, no Three.js. Mirrors the neural.js IIFE
   pattern (init/destroy/registerView).
   ========================================================= */

(function () {
  let canvas, ctx, container;
  let W, H, rafId;
  let mx = -9999, my = -9999;
  let creatures = [];
  let glyphs = [];
  let nebulas = [];
  let hovered = -1;
  let t0 = 0;
  const isMobile = () => window.innerWidth < 768;

  // Tight hyperpop / Marathon-ish accent palette
  const PALETTE = [
    ['#9cff3a', '#1a8a00'],   // lime
    ['#4ad8ff', '#0a4a8c'],   // cyan
    ['#ffe833', '#a86b00'],   // yellow
    ['#ffffff', '#888888'],   // white
    ['#a855f7', '#3a0a6c'],   // electric purple
    ['#ff7a1a', '#7a2a00'],   // orange
    ['#0aff9c', '#00564a'],   // mint
    ['#ff5cf2', '#5a0838'],   // pink-magenta
  ];

  const CREATURE_TYPES = [
    // b055 originals
    'butterfly', 'drone', 'jellyfish', 'fish',
    'comet', 'beetle', 'eye', 'crystal',
    // b056 new
    'ufo', 'planet', 'rocket', 'ghost',
    'bird', 'bee', 'flower', 'mushroom',
    'octopus', 'bat', 'note', 'cassette',
  ];

  // b056 — minimum on-screen creatures even if tracks.length is small.
  // Each creature still maps to a real track via i % tracks.length.
  const MIN_CREATURES = 100;

  // b056 — feedback flash state for queued/playing toast in info panel
  let toastUntil = 0;
  let toastText = '';

  // -------------------------------------------------------
  function init(cont) {
    container = cont;

    canvas = document.createElement('canvas');
    canvas.className = 'view-canvas';
    canvas.style.cursor = 'default';
    container.appendChild(canvas);
    ctx = canvas.getContext('2d');

    // Tiny info panel — track count, updates with hover
    const info = document.createElement('div');
    info.className = 'info-panel';
    info.innerHTML = `
      <div class="info-label" id="wallLabel">// hover a creature</div>
      <div class="info-title" id="wallTitle">THE WALL</div>
      <div class="info-meta" id="wallMeta">${(window.tracks || []).length} tracks adrift</div>
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
    creatures = [];
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
    if (hovered >= 0 && hovered < creatures.length) {
      const c = creatures[hovered];
      // b056 — click queues the song (or plays it if nothing's playing).
      if (typeof playOrQueue === 'function') {
        const result = playOrQueue(c.trackIndex);
        toastText = result === 'playing' ? '▶ PLAYING' : '+ QUEUED';
        toastUntil = performance.now() + 1400;
      } else if (typeof playTrack === 'function') {
        playTrack(c.trackIndex);
        toastText = '▶ PLAYING';
        toastUntil = performance.now() + 1400;
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
    buildCreatures();
    buildGlyphs();
    buildNebulas();
  }

  // -------------------------------------------------------
  // NEBULAS — large soft drifting radial gradients layered
  // between the base magenta and the checker. Cheap "bloom"
  // for a 2D canvas — gives the background depth and color
  // variation without an actual GL bloom pass.
  // -------------------------------------------------------
  function buildNebulas() {
    nebulas = [];
    const colors = [
      'rgba(74, 216, 255, 0.55)',   // cyan
      'rgba(156, 255, 58, 0.45)',   // lime
      'rgba(168, 85, 247, 0.55)',   // purple
      'rgba(255, 232, 51, 0.40)',   // yellow
      'rgba(10, 255, 156, 0.45)',   // mint
      'rgba(255, 122, 26, 0.40)',   // orange
    ];
    for (let i = 0; i < 6; i++) {
      const h = hash('neb' + i, 33);
      nebulas.push({
        baseX: (h % 1000) / 1000 * W,
        baseY: ((h >> 8) % 1000) / 1000 * H,
        radius: 280 + (h % 280),
        color: colors[i % colors.length],
        speedX: 0.05 + (h % 100) / 1500,
        speedY: 0.04 + ((h >> 4) % 100) / 1800,
        ampX: 60 + (h % 80),
        ampY: 50 + ((h >> 6) % 70),
        phase: ((h >> 12) % 1000) / 1000 * Math.PI * 2,
      });
    }
  }

  // Deterministic hash so layout is stable across resize
  function hash(str, seed) {
    let h = seed || 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i);
    return Math.abs(h);
  }

  // -------------------------------------------------------
  // CREATURES — at least MIN_CREATURES on screen so the
  // wall feels populated even when there are only a handful
  // of tracks. Each creature maps to a real track via
  // i % tracks.length, so multiple creatures can share a
  // track. If tracks.length > MIN_CREATURES, we render one
  // per track. Positions anchored — each creature bobs
  // around its anchor via sin/cos so they don't drift off.
  // -------------------------------------------------------
  function buildCreatures() {
    creatures = [];
    const tracks = window.tracks || [];
    if (tracks.length === 0) return;
    const N = Math.max(tracks.length, MIN_CREATURES);

    const margin = 60;
    for (let i = 0; i < N; i++) {
      const trackIndex = i % tracks.length;
      const title = tracks[trackIndex].title || ('untitled-' + trackIndex);
      // Per-CREATURE seed (not per-track) so multiple creatures sharing
      // a track still get different types, positions, and motion.
      const h1 = hash(title + '#' + i, 1);
      const h2 = hash(title + '#' + i, 7);
      const h3 = hash(title + '#' + i, 13);
      const type = CREATURE_TYPES[h1 % CREATURE_TYPES.length];

      // Loose poisson-ish: hash-based grid + jitter. Avoids
      // perfect grid look but mostly no overlaps.
      const cols = Math.max(6, Math.floor((W - margin * 2) / 95));
      const rows = Math.ceil(N / cols);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellW = (W - margin * 2) / cols;
      const cellH = (H - margin * 2) / Math.max(rows, 1);
      const baseX = margin + cellW * (col + 0.5) + ((h1 % 100) - 50) * 0.4;
      const baseY = margin + cellH * (row + 0.5) + ((h2 % 100) - 50) * 0.4;

      creatures.push({
        type,
        baseX, baseY,
        x: baseX, y: baseY,
        size: 16 + (h1 % 14),
        colorIdx: h1 % PALETTE.length,
        driftPhase: (h2 % 1000) / 1000 * Math.PI * 2,
        driftSpeedX: 0.3 + (h2 % 100) / 240,
        driftSpeedY: 0.25 + (h3 % 100) / 280,
        driftAmpX: 14 + (h1 % 18),
        driftAmpY: 10 + (h3 % 14),
        rotSpeed: ((h2 % 200) - 100) / 800,
        rot: (h3 % 360) / 360 * Math.PI * 2,
        wingPhase: (h1 % 1000) / 1000 * Math.PI * 2,
        trackIndex,
        title: title,
        scale: 1,
      });
    }
  }

  // -------------------------------------------------------
  function buildGlyphs() {
    glyphs = [];
    const N = isMobile() ? 30 : 75;
    for (let i = 0; i < N; i++) {
      const h = hash('glyph' + i, 99);
      glyphs.push({
        x: (h % 1000) / 1000 * W,
        y: ((h >> 8) % 1000) / 1000 * H,
        rot: ((h % 360) / 360) * Math.PI * 2,
        scale: 0.5 + ((h >> 4) % 100) / 100 * 1.2,
        kind: ['star', 'sparkle', 'cross', 'arrow', 'bolt', 'dot'][h % 6],
        color: ['#ffffff', '#9cff3a', '#4ad8ff', '#ffe833', '#0e0e0e'][h % 5],
        speed: 0.3 + ((h >> 12) % 100) / 100 * 0.7,
      });
    }
  }

  // -------------------------------------------------------
  // BACKGROUND — magenta base + drifting nebula bloom layer
  // (additive) + scrolling checker + scanlines.
  // The nebulas use globalCompositeOperation 'lighter' to
  // additively brighten the magenta where they overlap, so
  // the canvas gets a soft uneven bloom without any GL pass.
  // -------------------------------------------------------
  function drawBackground(t) {
    // Base magenta
    ctx.fillStyle = '#ff2bd6';
    ctx.fillRect(0, 0, W, H);

    // Bloom layer — additive radial gradients drifting around
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const n of nebulas) {
      const cx = n.baseX + Math.sin(t * n.speedX + n.phase) * n.ampX;
      const cy = n.baseY + Math.cos(t * n.speedY + n.phase * 0.7) * n.ampY;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, n.radius);
      grad.addColorStop(0, n.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - n.radius, cy - n.radius, n.radius * 2, n.radius * 2);
    }
    ctx.restore();

    // Scrolling checker — drawn over the bloom so the pattern
    // still reads even on the bright nebula spots
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

    // Soft corner vignette
    const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.40)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  // -------------------------------------------------------
  // AMBIENT GLYPHS — non-clickable background sparkles
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
        const r = i % 2 === 0 ? 7 : 2.5;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
    } else if (kind === 'sparkle') {
      c.beginPath();
      c.moveTo(0, -9); c.lineTo(2, -2); c.lineTo(9, 0);
      c.lineTo(2, 2); c.lineTo(0, 9); c.lineTo(-2, 2);
      c.lineTo(-9, 0); c.lineTo(-2, -2); c.closePath();
      c.fill();
    } else if (kind === 'cross') {
      c.fillRect(-1.5, -7, 3, 14);
      c.fillRect(-7, -1.5, 14, 3);
    } else if (kind === 'arrow') {
      c.beginPath();
      c.moveTo(-7, 0); c.lineTo(5, 0);
      c.moveTo(2, -3); c.lineTo(5, 0); c.lineTo(2, 3);
      c.stroke();
    } else if (kind === 'bolt') {
      c.beginPath();
      c.moveTo(-3, -9); c.lineTo(3, -2); c.lineTo(-1, -2);
      c.lineTo(3, 9); c.lineTo(-3, 2); c.lineTo(1, 2); c.closePath();
      c.fill();
    } else {
      c.beginPath();
      c.arc(0, 0, 3.5, 0, Math.PI * 2);
      c.fill();
    }
  }

  // -------------------------------------------------------
  // CREATURE TYPE DRAWERS — each runs at the creature's
  // local origin (already translated/rotated/scaled by
  // drawCreature). Use the creature's [light, dark] colors
  // and current wingPhase for animation.
  // -------------------------------------------------------
  function drawButterfly(c, light, dark, wingT) {
    const s = c.size;
    const flap = Math.sin(wingT * 6) * 0.45 + 0.55; // 0.10 to 1.0
    const wingW = s * flap;
    const wingH = s * 0.85;

    // Hard outline first (drawn slightly larger via stroke)
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;

    // Upper wings
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(-wingW * 0.55, -s * 0.2, wingW * 0.55, wingH * 0.55, -0.3, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse( wingW * 0.55, -s * 0.2, wingW * 0.55, wingH * 0.55,  0.3, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Lower wings
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(-wingW * 0.45, s * 0.25, wingW * 0.42, wingH * 0.42, 0.4, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse( wingW * 0.45, s * 0.25, wingW * 0.42, wingH * 0.42, -0.4, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Wing dots (eye spots)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-wingW * 0.55, -s * 0.25, s * 0.10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( wingW * 0.55, -s * 0.25, s * 0.10, 0, Math.PI * 2); ctx.fill();

    // Body
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.10, s * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Antennae
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-1.5, -s * 0.45);
    ctx.quadraticCurveTo(-s * 0.25, -s * 0.75, -s * 0.30, -s * 0.85);
    ctx.moveTo( 1.5, -s * 0.45);
    ctx.quadraticCurveTo( s * 0.25, -s * 0.75,  s * 0.30, -s * 0.85);
    ctx.stroke();
  }

  function drawDrone(c, light, dark, wingT) {
    const s = c.size;
    // Body — flat ellipse disc
    ctx.fillStyle = dark;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.95, s * 0.30, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Top dome
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.10, s * 0.55, s * 0.35, 0, Math.PI, 0);
    ctx.fill(); ctx.stroke();

    // Rim lights — 4 of them, alternate blink
    const blink = Math.sin(wingT * 4) > 0;
    for (let i = 0; i < 4; i++) {
      const lx = Math.cos((i / 4) * Math.PI * 2) * s * 0.78;
      ctx.fillStyle = (i % 2 === 0) === blink ? '#ffe833' : '#0e0e0e';
      ctx.beginPath();
      ctx.arc(lx, s * 0.05, s * 0.10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Beam
    ctx.fillStyle = 'rgba(255,232,51,0.30)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.20, s * 0.25);
    ctx.lineTo( s * 0.20, s * 0.25);
    ctx.lineTo( s * 0.40, s * 0.85);
    ctx.lineTo(-s * 0.40, s * 0.85);
    ctx.closePath();
    ctx.fill();
  }

  function drawJellyfish(c, light, dark, wingT) {
    const s = c.size;
    // Bell
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.15, s * 0.65, s * 0.45, 0, Math.PI, 0);
    ctx.lineTo(s * 0.65, -s * 0.15);
    ctx.lineTo(-s * 0.65, -s * 0.15);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Bell highlight
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.20, -s * 0.40, s * 0.18, s * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tentacles — wavy lines
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      const tx = i * s * 0.18;
      ctx.beginPath();
      ctx.moveTo(tx, -s * 0.10);
      for (let k = 1; k <= 4; k++) {
        const px = tx + Math.sin(wingT * 3 + i + k) * s * 0.08;
        const py = -s * 0.10 + (k / 4) * s * 0.85;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  function drawFish(c, light, dark, wingT) {
    const s = c.size;
    const tail = Math.sin(wingT * 5) * 0.4;

    // Body
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.85, s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Tail
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo( s * 0.85, 0);
    ctx.lineTo( s * 1.30, -s * 0.40 + tail * s * 0.20);
    ctx.lineTo( s * 1.10, 0);
    ctx.lineTo( s * 1.30,  s * 0.40 + tail * s * 0.20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Top fin
    ctx.beginPath();
    ctx.moveTo(-s * 0.10, -s * 0.40);
    ctx.lineTo( s * 0.05, -s * 0.75);
    ctx.lineTo( s * 0.30, -s * 0.40);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-s * 0.40, -s * 0.10, s * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(-s * 0.42, -s * 0.10, s * 0.06, 0, Math.PI * 2); ctx.fill();
  }

  function drawComet(c, light, dark, wingT) {
    const s = c.size;
    // Trail — multiple decreasing alpha ellipses
    for (let i = 6; i >= 1; i--) {
      ctx.fillStyle = light;
      ctx.globalAlpha = (i / 6) * 0.35;
      ctx.beginPath();
      ctx.ellipse(-i * s * 0.20, 0, s * 0.40, s * 0.20 * (i / 6), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Head
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Hot core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -s * 0.10, s * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Sparks orbiting
    const sp = wingT * 3;
    for (let i = 0; i < 3; i++) {
      const a = sp + i * (Math.PI * 2 / 3);
      ctx.fillStyle = '#ffe833';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * s * 0.65, Math.sin(a) * s * 0.65, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBeetle(c, light, dark, wingT) {
    const s = c.size;
    const wig = Math.sin(wingT * 8) * 0.2;

    // 6 legs (drawn first, behind body)
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    for (let side = -1; side <= 1; side += 2) {
      for (let j = -1; j <= 1; j++) {
        const ay = j * s * 0.35;
        ctx.beginPath();
        ctx.moveTo(side * s * 0.40, ay);
        ctx.lineTo(side * (s * 0.75 + wig * 0.2), ay + (j === 0 ? 0 : j * s * 0.15));
        ctx.stroke();
      }
    }

    // Body — round oval
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.55, s * 0.70, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Wing case split line
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.55); ctx.lineTo(0, s * 0.65);
    ctx.stroke();

    // Lighter highlight
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(-s * 0.20, -s * 0.20, s * 0.15, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.65, s * 0.30, s * 0.20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Antennae
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, -s * 0.80);
    ctx.lineTo(-s * 0.30, -s * 1.05);
    ctx.moveTo( s * 0.15, -s * 0.80);
    ctx.lineTo( s * 0.30, -s * 1.05);
    ctx.stroke();
  }

  function drawEye(c, light, dark, wingT) {
    const s = c.size;
    // Sclera (white eyeball)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.85, s * 0.65, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Iris — colored, tracks the cursor in canvas space
    let lookX = 0, lookY = 0;
    if (mx > 0 && my > 0) {
      const dx = mx - c.x;
      const dy = my - c.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.01) {
        lookX = (dx / d) * s * 0.20;
        lookY = (dy / d) * s * 0.18;
      }
    }
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(lookX, lookY, s * 0.35, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Pupil
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.arc(lookX, lookY, s * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Glint
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(lookX - s * 0.07, lookY - s * 0.07, s * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // Blink — squish vertically every few seconds
    const blinkPhase = Math.sin(wingT * 0.7);
    if (blinkPhase > 0.985) {
      ctx.fillStyle = '#ff2bd6'; // bg color overlay
      ctx.fillRect(-s, -s * 0.2, s * 2, s * 0.4);
    }
  }

  function drawCrystal(c, light, dark, wingT) {
    const s = c.size;
    // Outer hexagon crystal
    ctx.save();
    ctx.rotate(wingT * 0.5);
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * s * 0.85;
      const y = Math.sin(a) * s * 0.85;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Inner facet lines
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * s * 0.85, Math.sin(a) * s * 0.85);
      ctx.stroke();
    }

    // Inner highlight
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.15, -s * 0.20, s * 0.18, s * 0.10, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Sparkle dots around it
    for (let i = 0; i < 3; i++) {
      const a = wingT * 1.5 + i * 2.1;
      const r = s * 1.05;
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 3);
      ctx.lineTo(sx + 3, sy);
      ctx.lineTo(sx, sy + 3);
      ctx.lineTo(sx - 3, sy);
      ctx.closePath();
      ctx.fill();
    }
  }

  // -------------------------------------------------------
  // b056 — 12 NEW CREATURE TYPES
  // -------------------------------------------------------

  function drawUfo(c, light, dark, wingT) {
    const s = c.size;
    // Saucer body
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Top dome (transparent-feeling)
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.10, s * 0.45, s * 0.35, 0, Math.PI, 0);
    ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 1;
    // Bottom abduction beam (cone)
    const beamA = (Math.sin(wingT * 3) + 1) * 0.5 * 0.35 + 0.10;
    ctx.fillStyle = `rgba(156,255,58,${beamA})`;
    ctx.beginPath();
    ctx.moveTo(-s * 0.30, s * 0.20);
    ctx.lineTo( s * 0.30, s * 0.20);
    ctx.lineTo( s * 0.65, s * 1.05);
    ctx.lineTo(-s * 0.65, s * 1.05);
    ctx.closePath();
    ctx.fill();
    // 3 rotating bottom lights
    const sp = wingT * 4;
    for (let i = 0; i < 3; i++) {
      const a = sp + (i / 3) * Math.PI * 2;
      ctx.fillStyle = ['#ff5cf2', '#4ad8ff', '#ffe833'][i];
      ctx.beginPath();
      ctx.arc(Math.cos(a) * s * 0.75, s * 0.18, s * 0.10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlanet(c, light, dark, wingT) {
    const s = c.size;
    // Ring (back half)
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.15, s * 0.30, -0.25, Math.PI, Math.PI * 2);
    ctx.stroke();
    // Body
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.70, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Surface bands
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.15, s * 0.65, s * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, s * 0.20, s * 0.55, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ring (front half)
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.15, s * 0.30, -0.25, 0, Math.PI);
    ctx.stroke();
    // Orbiting moon
    const ma = wingT * 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(Math.cos(ma) * s * 1.30, Math.sin(ma) * s * 0.32, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0e0e0e';
    ctx.stroke();
  }

  function drawRocket(c, light, dark, wingT) {
    const s = c.size;
    const flame = (Math.sin(wingT * 12) + 1) * 0.5;
    // Flame
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.moveTo(-s * 0.30, s * 0.55);
    ctx.lineTo( s * 0.30, s * 0.55);
    ctx.lineTo( 0, s * (1.0 + flame * 0.4));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe833';
    ctx.beginPath();
    ctx.moveTo(-s * 0.18, s * 0.55);
    ctx.lineTo( s * 0.18, s * 0.55);
    ctx.lineTo( 0, s * (0.85 + flame * 0.3));
    ctx.closePath();
    ctx.fill();
    // Body — pointed cylinder
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.30, s * 0.55);
    ctx.lineTo(-s * 0.30, -s * 0.30);
    ctx.quadraticCurveTo(0, -s * 1.05, s * 0.30, -s * 0.30);
    ctx.lineTo( s * 0.30, s * 0.55);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Window
    ctx.fillStyle = '#4ad8ff';
    ctx.beginPath();
    ctx.arc(0, -s * 0.25, s * 0.18, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Fins
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-s * 0.30, s * 0.55);
    ctx.lineTo(-s * 0.55, s * 0.70);
    ctx.lineTo(-s * 0.30, s * 0.30);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo( s * 0.30, s * 0.55);
    ctx.lineTo( s * 0.55, s * 0.70);
    ctx.lineTo( s * 0.30, s * 0.30);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  function drawGhost(c, light, dark, wingT) {
    const s = c.size;
    const wob = Math.sin(wingT * 4) * s * 0.08;
    // Body — rounded top + wavy bottom
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.70, Math.PI, 0, false);
    // Wavy bottom
    const baseY = s * 0.55;
    ctx.lineTo( s * 0.70, baseY);
    for (let i = 0; i < 4; i++) {
      const x1 = s * 0.70 - (i + 0.5) * (s * 0.35);
      const x2 = s * 0.70 - (i + 1) * (s * 0.35);
      const y1 = baseY + (i % 2 === 0 ? wob : -wob) + s * 0.10;
      ctx.quadraticCurveTo(x1, y1, x2, baseY);
    }
    ctx.lineTo(-s * 0.70, baseY);
    ctx.lineTo(-s * 0.70, 0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Eyes
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.ellipse(-s * 0.25, -s * 0.15, s * 0.10, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( s * 0.25, -s * 0.15, s * 0.10, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    // Eye glints
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-s * 0.22, -s * 0.20, s * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( s * 0.28, -s * 0.20, s * 0.04, 0, Math.PI * 2); ctx.fill();
  }

  function drawBird(c, light, dark, wingT) {
    const s = c.size;
    const flap = Math.sin(wingT * 7);
    ctx.strokeStyle = '#0e0e0e';
    ctx.fillStyle = light;
    ctx.lineWidth = 2.5;
    // Two V wings
    ctx.beginPath();
    ctx.moveTo(-s, 0 + flap * s * 0.15);
    ctx.lineTo( 0, -s * 0.20 - flap * s * 0.10);
    ctx.lineTo( s, 0 + flap * s * 0.15);
    ctx.stroke();
    // Body dot in the middle
    ctx.beginPath();
    ctx.arc(0, -s * 0.10, s * 0.12, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }

  function drawBee(c, light, dark, wingT) {
    const s = c.size;
    const flap = Math.sin(wingT * 14) * 0.4 + 0.6;
    // Wings (drawn behind body)
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-s * 0.20, -s * 0.40, s * 0.30 * flap, s * 0.18, -0.4, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse( s * 0.20, -s * 0.40, s * 0.30 * flap, s * 0.18, 0.4, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Body — yellow oval
    ctx.fillStyle = '#ffe833';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.55, s * 0.40, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Stripes
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(-s * 0.30, -s * 0.10, s * 0.60, s * 0.08);
    ctx.fillRect(-s * 0.20, s * 0.06, s * 0.40, s * 0.08);
    // Stinger
    ctx.beginPath();
    ctx.moveTo(s * 0.55, 0);
    ctx.lineTo(s * 0.80, -s * 0.05);
    ctx.lineTo(s * 0.80, s * 0.05);
    ctx.closePath();
    ctx.fill();
    // Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-s * 0.35, -s * 0.10, s * 0.07, 0, Math.PI * 2); ctx.fill();
  }

  function drawFlower(c, light, dark, wingT) {
    const s = c.size;
    ctx.save();
    ctx.rotate(wingT * 0.6);
    // 5 petals
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.55, s * 0.30, s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    // Center
    ctx.fillStyle = '#ffe833';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.30, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Center dots
    ctx.fillStyle = '#0e0e0e';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * s * 0.10, Math.sin(a) * s * 0.10, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMushroom(c, light, dark, wingT) {
    const s = c.size;
    // Stem
    ctx.fillStyle = '#f5ecd8';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, s * 0.15);
    ctx.lineTo(-s * 0.20, s * 0.70);
    ctx.lineTo( s * 0.20, s * 0.70);
    ctx.lineTo( s * 0.25, s * 0.15);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Cap
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.85, s * 0.55, 0, Math.PI, 0);
    ctx.lineTo( s * 0.85, 0);
    ctx.lineTo(-s * 0.85, 0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Cap dots
    ctx.fillStyle = '#ffffff';
    const dots = [[-0.45, -0.15], [0.05, -0.30], [0.40, -0.10], [-0.20, -0.35]];
    for (const [dx, dy] of dots) {
      ctx.beginPath();
      ctx.arc(s * dx, s * dy, s * 0.10, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
  }

  function drawOctopus(c, light, dark, wingT) {
    const s = c.size;
    // 8 wavy tentacles drawn first
    ctx.strokeStyle = light;
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const baseA = (i / 8) * Math.PI * 2;
      const bx = Math.cos(baseA) * s * 0.35;
      const by = Math.sin(baseA) * s * 0.20 + s * 0.20;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      for (let k = 1; k <= 4; k++) {
        const r = s * (0.35 + k * 0.18);
        const wig = Math.sin(wingT * 3 + i + k) * s * 0.10;
        const px = Math.cos(baseA) * r + wig;
        const py = Math.sin(baseA) * r + s * 0.20 + k * s * 0.05;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // Head
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.10, s * 0.55, s * 0.50, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-s * 0.18, -s * 0.15, s * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc( s * 0.18, -s * 0.15, s * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(-s * 0.18, -s * 0.13, s * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( s * 0.18, -s * 0.13, s * 0.05, 0, Math.PI * 2); ctx.fill();
  }

  function drawBat(c, light, dark, wingT) {
    const s = c.size;
    const flap = Math.sin(wingT * 8) * 0.30 + 0.70;
    ctx.fillStyle = dark;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    // Left wing — angular
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s * 0.35, -s * 0.30 * flap);
    ctx.lineTo(-s * 0.85, -s * 0.10 * flap);
    ctx.lineTo(-s * 0.95, s * 0.20 * flap);
    ctx.lineTo(-s * 0.55, s * 0.10);
    ctx.lineTo(-s * 0.30, s * 0.30 * flap);
    ctx.lineTo(0, s * 0.10);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Right wing
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo( s * 0.35, -s * 0.30 * flap);
    ctx.lineTo( s * 0.85, -s * 0.10 * flap);
    ctx.lineTo( s * 0.95, s * 0.20 * flap);
    ctx.lineTo( s * 0.55, s * 0.10);
    ctx.lineTo( s * 0.30, s * 0.30 * flap);
    ctx.lineTo(0, s * 0.10);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Body
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.18, s * 0.30, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ears
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, -s * 0.30);
    ctx.lineTo(-s * 0.20, -s * 0.45);
    ctx.lineTo(-s * 0.05, -s * 0.30);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo( s * 0.12, -s * 0.30);
    ctx.lineTo( s * 0.20, -s * 0.45);
    ctx.lineTo( s * 0.05, -s * 0.30);
    ctx.closePath();
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#ff5cf2';
    ctx.beginPath(); ctx.arc(-s * 0.07, -s * 0.10, s * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( s * 0.07, -s * 0.10, s * 0.04, 0, Math.PI * 2); ctx.fill();
  }

  function drawNote(c, light, dark, wingT) {
    const s = c.size;
    // Note head — filled ellipse, slightly tilted
    ctx.save();
    ctx.rotate(-0.35);
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-s * 0.20, s * 0.45, s * 0.35, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // Stem
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(s * 0.05, -s * 0.65, s * 0.10, s * 1.10);
    // Flag
    ctx.beginPath();
    ctx.moveTo(s * 0.15, -s * 0.65);
    ctx.quadraticCurveTo(s * 0.55, -s * 0.40, s * 0.40, -s * 0.10);
    ctx.quadraticCurveTo(s * 0.30, -s * 0.30, s * 0.15, -s * 0.30);
    ctx.closePath();
    ctx.fill();
  }

  function drawCassette(c, light, dark, wingT) {
    const s = c.size;
    // Body
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    const w = s * 1.10, h = s * 0.75;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    // Label area
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.40);
    ctx.strokeRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.40);
    // Label lines
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(-w / 2 + 7, -h / 2 + 8, w * 0.5, 1.5);
    ctx.fillRect(-w / 2 + 7, -h / 2 + 13, w * 0.4, 1.5);
    // Two reels — rotating
    const rA = wingT * 4;
    for (let side = -1; side <= 1; side += 2) {
      const cx = side * s * 0.28;
      const cy = s * 0.15;
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.18, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // Spokes
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rA * side);
      ctx.strokeStyle = '#0e0e0e';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos((k / 4) * Math.PI * 2) * s * 0.16, Math.sin((k / 4) * Math.PI * 2) * s * 0.16);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // -------------------------------------------------------
  // CREATURE DRAW — translates/rotates/scales then dispatches
  // to the type-specific routine.
  // -------------------------------------------------------
  function updateCreature(c, t) {
    c.x = c.baseX + Math.sin(t * c.driftSpeedX + c.driftPhase) * c.driftAmpX;
    c.y = c.baseY + Math.cos(t * c.driftSpeedY + c.driftPhase * 0.7) * c.driftAmpY;
    c.rot += c.rotSpeed * 0.02;
  }

  function drawCreature(c, t, isHover, beat) {
    const targetScale = isHover ? 1.35 : (1 + beat * 0.06);
    c.scale += (targetScale - c.scale) * 0.18;

    const [light, dark] = PALETTE[c.colorIdx];
    const wingT = t + c.wingPhase;

    // b056 — soft additive glow halo behind the creature for
    // a cheap bloom feel. One radial gradient draw per
    // creature is fine perf-wise. Stronger on hover.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const haloR = c.size * c.scale * (isHover ? 2.6 : 2.0);
    const halo = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, haloR);
    halo.addColorStop(0, hexToRgba(light, isHover ? 0.55 : 0.30));
    halo.addColorStop(1, hexToRgba(light, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(c.x - haloR, c.y - haloR, haloR * 2, haloR * 2);
    ctx.restore();

    ctx.save();
    ctx.translate(c.x, c.y);
    // Some creatures have intentional non-rotating orientation
    const noRot = c.type === 'butterfly' || c.type === 'fish' ||
                  c.type === 'rocket' || c.type === 'note' ||
                  c.type === 'mushroom' || c.type === 'bee';
    if (!noRot) {
      ctx.rotate(c.rot * 0.3);
    }
    ctx.scale(c.scale, c.scale);

    switch (c.type) {
      case 'butterfly': drawButterfly(c, light, dark, wingT); break;
      case 'drone':     drawDrone(c, light, dark, wingT); break;
      case 'jellyfish': drawJellyfish(c, light, dark, wingT); break;
      case 'fish':      drawFish(c, light, dark, wingT); break;
      case 'comet':     drawComet(c, light, dark, wingT); break;
      case 'beetle':    drawBeetle(c, light, dark, wingT); break;
      case 'eye':       drawEye(c, light, dark, wingT); break;
      case 'crystal':   drawCrystal(c, light, dark, wingT); break;
      case 'ufo':       drawUfo(c, light, dark, wingT); break;
      case 'planet':    drawPlanet(c, light, dark, wingT); break;
      case 'rocket':    drawRocket(c, light, dark, wingT); break;
      case 'ghost':     drawGhost(c, light, dark, wingT); break;
      case 'bird':      drawBird(c, light, dark, wingT); break;
      case 'bee':       drawBee(c, light, dark, wingT); break;
      case 'flower':    drawFlower(c, light, dark, wingT); break;
      case 'mushroom':  drawMushroom(c, light, dark, wingT); break;
      case 'octopus':   drawOctopus(c, light, dark, wingT); break;
      case 'bat':       drawBat(c, light, dark, wingT); break;
      case 'note':      drawNote(c, light, dark, wingT); break;
      case 'cassette':  drawCassette(c, light, dark, wingT); break;
    }

    ctx.restore();
  }

  // -------------------------------------------------------
  // hexToRgba — turn a #rrggbb string into rgba(...) for
  // the bloom halo gradient. Cheap, one match per call.
  // -------------------------------------------------------
  function hexToRgba(hex, a) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return `rgba(255,255,255,${a})`;
    return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
  }

  // -------------------------------------------------------
  // HIT TEST — circular distance check against each
  // creature's effective radius. Cheap; 117 iterations on
  // mousemove is nothing.
  // -------------------------------------------------------
  function hitTest() {
    hovered = -1;
    if (mx < 0 || my < 0) return;
    let bestD2 = Infinity;
    for (let i = 0; i < creatures.length; i++) {
      const c = creatures[i];
      const dx = mx - c.x;
      const dy = my - c.y;
      const d2 = dx * dx + dy * dy;
      const r = c.size * c.scale * 1.1;
      if (d2 <= r * r && d2 < bestD2) {
        bestD2 = d2;
        hovered = i;
      }
    }
    if (canvas) canvas.style.cursor = hovered >= 0 ? 'pointer' : 'default';
  }

  // -------------------------------------------------------
  // HOVER TOOLTIP — small label near the hovered creature
  // -------------------------------------------------------
  function drawTooltip(c) {
    const label = c.title.toUpperCase();
    const padX = 10, padY = 6;
    ctx.font = '900 12px "JetBrains Mono", monospace';
    const w = ctx.measureText(label).width + padX * 2;
    const h = 22;
    let tx = c.x + c.size + 8;
    let ty = c.y - h - 6;
    if (tx + w > W - 4) tx = c.x - w - c.size - 8;
    if (ty < 4) ty = c.y + c.size + 6;

    // Shadow
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(tx + 3, ty + 3, w, h);
    // Body
    ctx.fillStyle = '#9cff3a';
    ctx.fillRect(tx, ty, w, h);
    // Outline
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.strokeRect(tx, ty, w, h);
    // Text
    ctx.fillStyle = '#0e0e0e';
    ctx.textBaseline = 'top';
    ctx.fillText(label, tx + padX, ty + padY);
  }

  // -------------------------------------------------------
  // AUDIO REACT — beat scalar from getFrequencyData
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

    // Update creature positions BEFORE hit test so the
    // current frame's positions are what we test against.
    for (let i = 0; i < creatures.length; i++) updateCreature(creatures[i], t);
    hitTest();

    // Draw all non-hovered creatures, then hovered on top
    for (let i = 0; i < creatures.length; i++) {
      if (i === hovered) continue;
      drawCreature(creatures[i], t, false, beat);
    }
    // b056 — toast (PLAYING / QUEUED) takes priority in the info
    // panel for ~1.4s after a click, then yields back to hover state.
    const lab = document.getElementById('wallLabel');
    const tit = document.getElementById('wallTitle');
    const showToast = performance.now() < toastUntil;

    if (hovered >= 0) {
      drawCreature(creatures[hovered], t, true, beat);
      drawTooltip(creatures[hovered]);
      if (lab) lab.textContent = showToast ? toastText : ('// ' + creatures[hovered].type);
      if (tit) tit.textContent = creatures[hovered].title.toUpperCase();
    } else {
      if (lab) lab.textContent = showToast ? toastText : '// hover a creature';
      if (tit) tit.textContent = 'THE WALL';
    }

    rafId = requestAnimationFrame(draw);
  }

  // -------------------------------------------------------
  function onSearch(/* q */) {
    const meta = document.getElementById('wallMeta');
    if (meta) meta.textContent = `${(window.tracks || []).length} tracks adrift`;
  }

  registerView('wall', { init, destroy, onSearch });
})();
