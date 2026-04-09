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
  let bursts = [];          // b058 — click burst rings
  let constellations = [];  // b059 — precomputed creature pair indices for star-map lines
  let hovered = -1;
  let t0 = 0;
  // b061 — pagination so the user can see ALL 177 tracks even
  // when only ~30 creatures fit on a mobile screen. pageIndex
  // bumps per shuffle button click; buildCreatures offsets the
  // trackIndex by `pageIndex * pageSize` so each page surfaces
  // a different slice of the catalog.
  let pageIndex = 0;
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

  // b060 — per-track icon overrides. Special creature drawers
  // for specific song titles. Match is case-insensitive substring
  // against track.title. The first creature placed for each
  // matching track gets the override (depth 2 + bumped size);
  // any additional creatures sharing that track stay random.
  // Add more entries here to give more songs custom art — each
  // override type needs a draw* function and a dispatch case.
  // ORDER MATTERS — first match wins. Put more-specific
  // matches before less-specific ones (e.g. "space star"
  // before any future "space" entry).
  const ICON_OVERRIDES = [
    { match: 'odst',             type: 'helmet'     },  // ODST → halo ODST helmet
    { match: 'rolla',            type: 'supercar'   },  // Rolla → yellow Lambo
    { match: 'silk pillowcase',  type: 'pillowcase' },  // Silk Pillowcase → silk pillow
    // b061 — additional hero icons for signature tracks
    { match: 'space star',       type: 'spaceship'  },  // Space Star Galactica → spaceship
    { match: 'hotel california', type: 'hotelsign'  },  // Hotel California → neon hotel sign
    { match: 'coffee',           type: 'coffeecup'  },  // Coffee (Back in the Day) → cup
    { match: 'robot',            type: 'robotbody'  },  // Robot Song → robot
    { match: "stayin",           type: 'discoball'  },  // Stayin' Alive → disco ball
    { match: 'mario',            type: 'mariostar'  },  // Mario Island → Mario star
    { match: 'chains',           type: 'chainlink'  },  // Chains (Grunge) → chain links
    { match: 'nirvana',          type: 'wonkysmile' },  // Nirvana / Nirvana (Alt) → smiley
    { match: 'arkham',           type: 'villainmask'},  // Arkham Villain → villain mask
  ];

  function getOverrideType(title) {
    if (!title) return null;
    const lower = title.toLowerCase();
    for (const o of ICON_OVERRIDES) {
      if (lower.includes(o.match)) return o.type;
    }
    return null;
  }

  // b056 — minimum on-screen creatures even if tracks.length is small.
  // Each creature still maps to a real track via i % tracks.length.
  // b058 — mobile cap dropped from 100 to 30 (117 was unreadable on phones).
  const MIN_CREATURES_DESKTOP = 100;
  const MIN_CREATURES_MOBILE = 30;

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

    // b058 — minimal info panel: single line "click any creature →"
    // until something is hovered/playing. No more THE WALL header.
    const info = document.createElement('div');
    info.className = 'info-panel';
    info.style.cssText = 'pointer-events:none;';
    info.innerHTML = `
      <div class="info-label" id="wallLabel" style="font-size:11px; letter-spacing:0.16em; opacity:0.7;">click any creature →</div>
      <div class="info-title" id="wallTitle" style="font-size:14px; margin-top:2px; display:none;"></div>
    `;
    container.appendChild(info);

    // b061 — page shuffle button. Bottom-right floating button
    // that bumps pageIndex and rebuilds creatures so the user
    // can cycle through ALL tracks on mobile (30 at a time).
    // Renders on desktop too — handy for cycling through 117
    // creatures when you have 177 tracks.
    const shuffleBtn = document.createElement('button');
    shuffleBtn.id = 'wallShuffleBtn';
    shuffleBtn.type = 'button';
    shuffleBtn.style.cssText = `
      position:absolute;
      right:16px;
      bottom:96px;
      z-index:50;
      background:rgba(14,14,14,0.75);
      backdrop-filter:blur(8px);
      color:#9cff3a;
      border:1.5px solid #9cff3a;
      border-radius:999px;
      padding:10px 16px;
      font-family:'JetBrains Mono', monospace;
      font-size:12px;
      font-weight:700;
      letter-spacing:0.10em;
      cursor:pointer;
      box-shadow:0 0 20px rgba(156,255,58,0.25);
      pointer-events:auto;
      display:flex;
      align-items:center;
      gap:8px;
    `;
    shuffleBtn.innerHTML = `<span style="font-size:14px;">↻</span> <span id="wallPageLabel">NEXT</span>`;
    shuffleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pageIndex++;
      buildCreatures();
      updatePageLabel();
    });
    container.appendChild(shuffleBtn);

    function updatePageLabel() {
      const lbl = document.getElementById('wallPageLabel');
      if (!lbl) return;
      const tracks = window.tracks || [];
      if (tracks.length === 0) { lbl.textContent = 'NEXT'; return; }
      const minCount = isMobile() ? MIN_CREATURES_MOBILE : MIN_CREATURES_DESKTOP;
      const N = Math.min(Math.max(tracks.length, minCount), isMobile() ? 32 : 117);
      const totalPages = Math.max(1, Math.ceil(tracks.length / N));
      lbl.textContent = `${pageIndex + 1}/${totalPages}`;
    }
    // Stash for the resize handler so we can refresh after rebuild
    container._updatePageLabel = updatePageLabel;

    container.addEventListener('mousemove', onMouse);
    container.addEventListener('mouseleave', onLeave);
    container.addEventListener('touchmove', onTouch, { passive: true });
    container.addEventListener('touchstart', onTouch, { passive: true });
    container.addEventListener('click', onClick);

    resize();
    updatePageLabel();
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
  function onClick(e) {
    // b057 — inline hit test at click time. The previous version
    // read `hovered` from the draw loop, which on mobile is racy:
    // a tap fires `click` BEFORE the next requestAnimationFrame runs
    // hit test, so hovered was still -1 → tap did nothing. We now
    // compute the position from the event itself and walk creatures
    // here, with a fatter hit radius for fingers.
    if (!container || creatures.length === 0) return;
    const r = container.getBoundingClientRect();
    let cx, cy;
    if (e && e.clientX !== undefined) {
      cx = e.clientX - r.left;
      cy = e.clientY - r.top;
    } else if (e && e.changedTouches && e.changedTouches[0]) {
      cx = e.changedTouches[0].clientX - r.left;
      cy = e.changedTouches[0].clientY - r.top;
    } else {
      cx = mx; cy = my;
    }
    if (cx < 0 || cy < 0) return;

    // Find the closest creature within a generous touch radius
    // (1.7× size on desktop, 2.4× on mobile so fat fingers can land).
    const radiusMult = isMobile() ? 2.4 : 1.7;
    let best = -1;
    let bestD2 = Infinity;
    for (let i = 0; i < creatures.length; i++) {
      const c = creatures[i];
      const dx = cx - c.x;
      const dy = cy - c.y;
      const d2 = dx * dx + dy * dy;
      const rr = c.size * c.scale * radiusMult;
      if (d2 <= rr * rr && d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
    if (best < 0) return;

    // b057 — user said: forget queue, new icon just plays new song.
    // Always replace the currently-playing track, no queueing.
    const c = creatures[best];
    if (typeof playTrack === 'function') {
      playTrack(c.trackIndex);
      toastText = '▶ ' + (c.title || '').toLowerCase();
      toastUntil = performance.now() + 1800;
    }
    // b058 — click burst: expanding fading ring at the click point
    bursts.push({
      x: c.x, y: c.y,
      birth: performance.now(),
      color: PALETTE[c.colorIdx][0],
    });
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
    if (container && container._updatePageLabel) container._updatePageLabel();
  }

  // -------------------------------------------------------
  // NEBULAS — b059 fix for the b058 center-blowout. The 7
  // blobs were converging on the middle and washing the
  // wall to white. Three-part fix:
  //   1. Count down 7 → 5
  //   2. Alphas down ~25%
  //   3. baseX/baseY are forced to a 5-quadrant spread
  //      so they CAN'T all stack in the center, and the
  //      drift amplitude is clamped < quadrant size.
  // The additive layer in drawBackground also caps with
  // a frame-level globalAlpha (0.65 + treble pulse).
  // -------------------------------------------------------
  function buildNebulas() {
    nebulas = [];
    const colors = [
      'rgba(74, 216, 255, 0.40)',   // cyan
      'rgba(255, 92, 242, 0.42)',   // hot pink
      'rgba(156, 255, 58, 0.32)',   // lime
      'rgba(168, 85, 247, 0.45)',   // purple
      'rgba(255, 122, 26, 0.30)',   // orange
    ];
    // 5 anchor positions spread across the canvas — one per
    // quadrant + one center. Guarantees no convergence.
    const anchors = [
      [0.20, 0.25],
      [0.80, 0.30],
      [0.50, 0.55],
      [0.25, 0.80],
      [0.78, 0.78],
    ];
    for (let i = 0; i < colors.length; i++) {
      const h = hash('neb' + i, 33);
      const [ax, ay] = anchors[i];
      nebulas.push({
        baseX: ax * W,
        baseY: ay * H,
        radius: 460 + (h % 340),     // slightly smaller
        color: colors[i],
        speedX: 0.05 + (h % 100) / 1600,
        speedY: 0.04 + ((h >> 4) % 100) / 1700,
        // Drift amplitudes capped at ~120/100 — can't reach
        // the next anchor's territory, so they stay in their lane
        ampX: 80 + (h % 60),
        ampY: 60 + ((h >> 6) % 50),
        phase: ((h >> 12) % 1000) / 1000 * Math.PI * 2,
        radiusPulseSpeed: 0.20 + ((h >> 9) % 100) / 600,
        radiusPulseAmp: 0.15 + ((h >> 11) % 100) / 500,
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
    const minCount = isMobile() ? MIN_CREATURES_MOBILE : MIN_CREATURES_DESKTOP;
    const N = Math.min(Math.max(tracks.length, minCount), isMobile() ? 32 : 117);
    // b061 — pagination: each page surfaces a different slice
    // of the track list. Page size = creature count, so flipping
    // pages cycles through every track in the catalog over
    // ceil(tracks.length / N) presses.
    const pageSize = N;
    const totalPages = Math.max(1, Math.ceil(tracks.length / pageSize));
    pageIndex = ((pageIndex % totalPages) + totalPages) % totalPages;
    const pageOffset = pageIndex * pageSize;

    const margin = 60;
    // b058 — dart-throwing poisson placement: each creature
    // tries up to 30 hash-derived candidate positions and
    // accepts the first one that's at least minDist away
    // from anything already placed. Breaks the grid feel.
    const minDist = isMobile() ? 56 : 72;
    const placed = []; // {x,y}
    // b060 — track which trackIndices have already received
    // their override "hero" creature. Only the FIRST creature
    // for each matched track gets the override + front depth +
    // bumped size, so the special icons appear exactly once.
    const overrideUsed = new Set();
    function tooClose(x, y) {
      for (const p of placed) {
        const dx = p.x - x, dy = p.y - y;
        if (dx * dx + dy * dy < minDist * minDist) return true;
      }
      return false;
    }

    for (let i = 0; i < N; i++) {
      // b061 — page-aware track index. With 30 creatures and
      // 177 tracks, page 0 shows tracks 0..29, page 1 shows
      // 30..59, etc. Wraps via modulo so we never index OOB.
      const trackIndex = (i + pageOffset) % tracks.length;
      const title = tracks[trackIndex].title || ('untitled-' + trackIndex);
      // Per-CREATURE seed (not per-track) so multiple creatures sharing
      // a track still get different types, positions, and motion.
      const h1 = hash(title + '#' + i, 1);
      const h2 = hash(title + '#' + i, 7);
      const h3 = hash(title + '#' + i, 13);
      // b057 — type distribution: stride by i (coprime with 20)
      let type = CREATURE_TYPES[(i * 7 + h1) % CREATURE_TYPES.length];
      // b060 — icon override: if this track has a custom icon
      // and we haven't placed it yet, use the override.
      const overrideType = getOverrideType(title);
      let isOverride = false;
      if (overrideType && !overrideUsed.has(trackIndex)) {
        type = overrideType;
        overrideUsed.add(trackIndex);
        isOverride = true;
      }

      // b058 — dart-throw placement.
      let baseX = margin + (W - margin * 2) * 0.5;
      let baseY = margin + (H - margin * 2) * 0.5;
      for (let attempt = 0; attempt < 30; attempt++) {
        const ah = hash(title + '#' + i + '@' + attempt, 23);
        const cx = margin + ((ah % 10000) / 10000) * (W - margin * 2);
        const cy = margin + (((ah >> 10) % 10000) / 10000) * (H - margin * 2);
        if (!tooClose(cx, cy)) { baseX = cx; baseY = cy; break; }
        if (attempt === 29) { baseX = cx; baseY = cy; } // accept last fallback
      }
      placed.push({ x: baseX, y: baseY });

      // b057 — wider size range so creatures don't all look "same".
      // ~70% small (14-26), ~30% larger hero (28-44).
      const sizeRoll = (h2 % 100);
      let size = sizeRoll < 70
        ? 14 + (h1 % 13)
        : 28 + (h1 % 17);

      // b059 — parallax depth: 25% back, 60% mid, 15% front.
      // Back is smaller + dimmer + slower; front is larger +
      // brighter + faster. Real visual hierarchy.
      // b060 — override icons forced to depth 2 (front) and
      // bumped size so the special art reads as a hero element.
      const depthRoll = (h3 % 100);
      const depth = isOverride ? 2 : (depthRoll < 25 ? 0 : depthRoll < 85 ? 1 : 2);
      const depthScale     = depth === 0 ? 0.55 : depth === 1 ? 1.00 : 1.30;
      const depthAlpha     = depth === 0 ? 0.55 : depth === 1 ? 1.00 : 1.00;
      const depthDriftMult = depth === 0 ? 0.55 : depth === 1 ? 1.00 : 1.40;
      const depthSpeedMult = depth === 0 ? 0.60 : depth === 1 ? 1.00 : 1.30;

      size = size * depthScale;
      if (isOverride) size = Math.max(size * 1.4, 40);

      creatures.push({
        type,
        depth,
        depthAlpha,
        baseX, baseY,
        x: baseX, y: baseY,
        size,
        colorIdx: (i * 3 + h1) % PALETTE.length,  // also stride colors
        driftPhase: (h2 % 1000) / 1000 * Math.PI * 2,
        driftSpeedX: (0.3 + (h2 % 100) / 240) * depthSpeedMult,
        driftSpeedY: (0.25 + (h3 % 100) / 280) * depthSpeedMult,
        driftAmpX: (14 + (h1 % 18)) * depthDriftMult,
        driftAmpY: (10 + (h3 % 14)) * depthDriftMult,
        rotSpeed: ((h2 % 200) - 100) / 800,
        rot: (h3 % 360) / 360 * Math.PI * 2,
        wingPhase: (h1 % 1000) / 1000 * Math.PI * 2,
        trackIndex,
        title: title,
        scale: 1,
        inNeighborhood: false,
      });
    }

    // b059 — precompute constellation pairs for the star-map
    // line layer (creature i↔j with base distance < 75px).
    buildConstellations();
  }

  // -------------------------------------------------------
  // CONSTELLATIONS — precomputed creature pair indices for
  // the star-map line layer. O(n²) once at build time, cap 250.
  // -------------------------------------------------------
  function buildConstellations() {
    constellations = [];
    const threshold = 75;
    for (let i = 0; i < creatures.length; i++) {
      for (let j = i + 1; j < creatures.length; j++) {
        const dx = creatures[i].baseX - creatures[j].baseX;
        const dy = creatures[i].baseY - creatures[j].baseY;
        if (dx * dx + dy * dy < threshold * threshold) {
          constellations.push([i, j]);
          if (constellations.length >= 250) return;
        }
      }
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
  // BACKGROUND — b059 takes optional `bands` for a treble-
  // reactive nebula brightness pulse. The additive layer is
  // wrapped in a frame-level globalAlpha (0.55 baseline +
  // treble * 0.30) which CAPS the additive sum and fixes
  // the b058 center-blowout where 7 blobs converged.
  // -------------------------------------------------------
  function drawBackground(t, bands) {
    // Dark plum base
    ctx.fillStyle = '#1a0820';
    ctx.fillRect(0, 0, W, H);

    // Gradient mesh — additive blobs, but capped by globalAlpha
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55 + (bands ? bands.treble * 0.30 : 0);
    for (const n of nebulas) {
      const cx = n.baseX + Math.sin(t * n.speedX + n.phase) * n.ampX;
      const cy = n.baseY + Math.cos(t * n.speedY + n.phase * 0.7) * n.ampY;
      const radius = n.radius * (1 + Math.sin(t * n.radiusPulseSpeed + n.phase) * n.radiusPulseAmp);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, n.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }
    ctx.restore();

    // Subtle scanlines
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

    // Soft corner vignette
    const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.30, W / 2, H / 2, Math.max(W, H) * 0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.45)');
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
  // b060 — OVERRIDE CREATURE DRAWERS
  // Custom art for specific song titles. Each one's an
  // intentional hero icon — front layer, bumped size, more
  // detail than the random creature types.
  // -------------------------------------------------------

  function drawHelmet(c, light, dark, wingT) {
    // ODST helmet — angular sci-fi shape, dark visor, side
    // armor block, front antenna node. Nods to Halo ODST
    // without copying the exact silhouette.
    const s = c.size;

    // Outer helmet body — slightly tapered hex shape
    ctx.fillStyle = '#3a4555';   // gunmetal
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, -s * 0.10);
    ctx.lineTo(-s * 0.75, -s * 0.65);
    ctx.lineTo(-s * 0.30, -s * 0.92);
    ctx.lineTo( s * 0.30, -s * 0.92);
    ctx.lineTo( s * 0.75, -s * 0.65);
    ctx.lineTo( s * 0.85, -s * 0.10);
    ctx.lineTo( s * 0.78,  s * 0.55);
    ctx.lineTo( s * 0.50,  s * 0.85);
    ctx.lineTo(-s * 0.50,  s * 0.85);
    ctx.lineTo(-s * 0.78,  s * 0.55);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Top crown plate — slightly lighter
    ctx.fillStyle = '#4a5565';
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.65);
    ctx.lineTo(-s * 0.30, -s * 0.85);
    ctx.lineTo( s * 0.30, -s * 0.85);
    ctx.lineTo( s * 0.55, -s * 0.65);
    ctx.lineTo( s * 0.40, -s * 0.45);
    ctx.lineTo(-s * 0.40, -s * 0.45);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Visor — wide dark band with cyan glow
    ctx.fillStyle = '#0a0e16';
    ctx.beginPath();
    ctx.moveTo(-s * 0.78, -s * 0.10);
    ctx.lineTo(-s * 0.65, -s * 0.40);
    ctx.lineTo( s * 0.65, -s * 0.40);
    ctx.lineTo( s * 0.78, -s * 0.10);
    ctx.lineTo( s * 0.65,  s * 0.05);
    ctx.lineTo(-s * 0.65,  s * 0.05);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Visor cyan inner glow
    ctx.fillStyle = '#4ad8ff';
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.30);
    ctx.lineTo( s * 0.55, -s * 0.30);
    ctx.lineTo( s * 0.50, -s * 0.05);
    ctx.lineTo(-s * 0.50, -s * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Visor highlight
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-s * 0.45, -s * 0.25, s * 0.20, s * 0.04);

    // Side armor blocks (cheek guards)
    ctx.fillStyle = '#2a3340';
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, -s * 0.05);
    ctx.lineTo(-s * 0.55,  s * 0.10);
    ctx.lineTo(-s * 0.55,  s * 0.50);
    ctx.lineTo(-s * 0.78,  s * 0.55);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo( s * 0.85, -s * 0.05);
    ctx.lineTo( s * 0.55,  s * 0.10);
    ctx.lineTo( s * 0.55,  s * 0.50);
    ctx.lineTo( s * 0.78,  s * 0.55);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Bottom mouth guard
    ctx.fillStyle = '#1a2230';
    ctx.beginPath();
    ctx.moveTo(-s * 0.50, s * 0.20);
    ctx.lineTo( s * 0.50, s * 0.20);
    ctx.lineTo( s * 0.40, s * 0.65);
    ctx.lineTo(-s * 0.40, s * 0.65);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Mouth grille lines
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s * 0.18, s * 0.25);
      ctx.lineTo(i * s * 0.18, s * 0.60);
      ctx.stroke();
    }

    // Front antenna nub (animated blink)
    const blink = Math.sin(wingT * 4) > 0;
    ctx.fillStyle = blink ? '#9cff3a' : '#3a4555';
    ctx.beginPath();
    ctx.arc(0, -s * 0.78, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0e0e0e';
    ctx.stroke();

    // ODST stencil (subtle lime text behind visor area)
    ctx.fillStyle = 'rgba(156,255,58,0.6)';
    ctx.font = `bold ${Math.max(6, s * 0.18)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ODST', 0, s * 0.42);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function drawSupercar(c, light, dark, wingT) {
    // Lambo-style wedge supercar — low body, raked
    // windshield, two big wheels, glowing headlight.
    const s = c.size;
    const wheelSpin = wingT * 6;

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.40)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.55, s * 1.15, s * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body wedge — sharp angular front, low slung
    ctx.fillStyle = '#ffe833';   // hot yellow lambo
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-s * 1.05,  s * 0.30);   // rear bottom
    ctx.lineTo(-s * 1.10,  s * 0.05);   // rear top
    ctx.lineTo(-s * 0.70, -s * 0.05);   // rear shoulder
    ctx.lineTo(-s * 0.30, -s * 0.30);   // roof rear
    ctx.lineTo( s * 0.20, -s * 0.30);   // roof front
    ctx.lineTo( s * 0.55, -s * 0.05);   // hood top
    ctx.lineTo( s * 1.10,  s * 0.10);   // nose tip
    ctx.lineTo( s * 1.10,  s * 0.30);   // front bottom
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Windshield + side window
    ctx.fillStyle = '#1a2230';
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, -s * 0.05);
    ctx.lineTo(-s * 0.20, -s * 0.27);
    ctx.lineTo( s * 0.18, -s * 0.27);
    ctx.lineTo( s * 0.40, -s * 0.05);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Cyan windshield reflection
    ctx.fillStyle = '#4ad8ff';
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, -s * 0.10);
    ctx.lineTo(-s * 0.15, -s * 0.22);
    ctx.lineTo( s * 0.05, -s * 0.22);
    ctx.lineTo( s * 0.10, -s * 0.10);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Side intake / vent
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, s * 0.05);
    ctx.lineTo(-s * 0.20, s * 0.05);
    ctx.lineTo(-s * 0.30, s * 0.20);
    ctx.lineTo(-s * 0.65, s * 0.20);
    ctx.closePath();
    ctx.fill();

    // Body line / character crease
    ctx.strokeStyle = '#a86b00';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-s * 1.00, s * 0.18);
    ctx.lineTo( s * 1.00, s * 0.18);
    ctx.stroke();

    // Headlight — glowing white
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(s * 0.85, -s * 0.02, s * 0.12, s * 0.07, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Tail light — magenta
    ctx.fillStyle = '#ff5cf2';
    ctx.beginPath();
    ctx.ellipse(-s * 0.95, -s * 0.05, s * 0.08, s * 0.05, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Wheels — two big black tires with spinning rims
    for (const wx of [-s * 0.55, s * 0.55]) {
      // Tire
      ctx.fillStyle = '#0e0e0e';
      ctx.beginPath();
      ctx.arc(wx, s * 0.40, s * 0.30, 0, Math.PI * 2);
      ctx.fill();
      // Rim
      ctx.fillStyle = '#cccccc';
      ctx.beginPath();
      ctx.arc(wx, s * 0.40, s * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0e0e0e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Spinning spokes
      ctx.save();
      ctx.translate(wx, s * 0.40);
      ctx.rotate(wheelSpin);
      ctx.strokeStyle = '#0e0e0e';
      ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos((k / 5) * Math.PI * 2) * s * 0.16, Math.sin((k / 5) * Math.PI * 2) * s * 0.16);
        ctx.stroke();
      }
      ctx.restore();
      // Center cap
      ctx.fillStyle = '#0e0e0e';
      ctx.beginPath();
      ctx.arc(wx, s * 0.40, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPillowcase(c, light, dark, wingT) {
    // Soft silk pillow — rounded rectangle, fold lines,
    // tasseled corners, gentle wobble.
    const s = c.size;
    const wob = Math.sin(wingT * 2) * 0.04;
    const w = s * 1.20;
    const h = s * 0.85;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.65, w * 0.70, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pillow body — rounded blob with sag
    ctx.fillStyle = '#f5d4e8';   // silk pink
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    // top edge with slight wobble
    ctx.moveTo(-w * 0.50, -h * 0.45);
    ctx.quadraticCurveTo(0, -h * (0.55 + wob), w * 0.50, -h * 0.45);
    // right edge
    ctx.quadraticCurveTo(w * 0.62, 0, w * 0.50, h * 0.50);
    // bottom edge
    ctx.quadraticCurveTo(0, h * (0.62 - wob), -w * 0.50, h * 0.50);
    // left edge
    ctx.quadraticCurveTo(-w * 0.62, 0, -w * 0.50, -h * 0.45);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Silk highlight band — diagonal sheen
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-w * 0.18, -h * 0.18, w * 0.30, h * 0.10, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Fold lines from each corner toward center
    ctx.strokeStyle = '#d49bc4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, -h * 0.40);
    ctx.quadraticCurveTo(-w * 0.15, -h * 0.10, 0, 0);
    ctx.moveTo( w * 0.45, -h * 0.40);
    ctx.quadraticCurveTo( w * 0.15, -h * 0.10, 0, 0);
    ctx.moveTo(-w * 0.45,  h * 0.45);
    ctx.quadraticCurveTo(-w * 0.15,  h * 0.10, 0, 0);
    ctx.moveTo( w * 0.45,  h * 0.45);
    ctx.quadraticCurveTo( w * 0.15,  h * 0.10, 0, 0);
    ctx.stroke();

    // Center button (silk pillow tuft)
    ctx.fillStyle = '#ff5cf2';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.10, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Tassels at the 4 corners
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    const corners = [
      [-w * 0.50, -h * 0.45],
      [ w * 0.50, -h * 0.45],
      [ w * 0.50,  h * 0.50],
      [-w * 0.50,  h * 0.50],
    ];
    for (const [tx, ty] of corners) {
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + (tx > 0 ? 4 : -4), ty + (ty > 0 ? 4 : -4));
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(tx + (tx > 0 ? 4 : -4), ty + (ty > 0 ? 4 : -4), 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // -------------------------------------------------------
  // b061 — 9 ADDITIONAL OVERRIDE DRAWERS
  // -------------------------------------------------------

  function drawSpaceship(c, light, dark, wingT) {
    // Sleek angular sci-fi cruiser with engine glow trail
    const s = c.size;
    const flame = (Math.sin(wingT * 14) + 1) * 0.5;

    // Engine trail (drawn first, behind body)
    for (let i = 6; i >= 1; i--) {
      ctx.fillStyle = '#4ad8ff';
      ctx.globalAlpha = (i / 6) * 0.40;
      ctx.beginPath();
      ctx.ellipse(-s * (0.85 + i * 0.18), 0, s * 0.18, s * 0.10 * (i / 6), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Hull body — long arrowhead pointing right
    ctx.fillStyle = '#cccccc';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, -s * 0.20);
    ctx.lineTo(-s * 0.45, -s * 0.30);
    ctx.lineTo( s * 0.55, -s * 0.18);
    ctx.lineTo( s * 1.05,  0);
    ctx.lineTo( s * 0.55,  s * 0.18);
    ctx.lineTo(-s * 0.45,  s * 0.30);
    ctx.lineTo(-s * 0.85,  s * 0.20);
    ctx.lineTo(-s * 0.65,  0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Top spine highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-s * 0.40, -s * 0.10);
    ctx.lineTo( s * 0.55, -s * 0.05);
    ctx.lineTo( s * 0.55,  s * 0.05);
    ctx.lineTo(-s * 0.40,  s * 0.10);
    ctx.closePath();
    ctx.fill();

    // Wings — angled back delta
    ctx.fillStyle = '#3a4555';
    ctx.beginPath();
    ctx.moveTo(-s * 0.10, -s * 0.10);
    ctx.lineTo(-s * 0.55, -s * 0.55);
    ctx.lineTo(-s * 0.30, -s * 0.20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.10, s * 0.10);
    ctx.lineTo(-s * 0.55, s * 0.55);
    ctx.lineTo(-s * 0.30, s * 0.20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Cockpit — cyan dome on top of nose
    ctx.fillStyle = '#4ad8ff';
    ctx.beginPath();
    ctx.ellipse(s * 0.40, -s * 0.05, s * 0.18, s * 0.10, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s * 0.45, -s * 0.08, s * 0.04, 0, Math.PI * 2);
    ctx.fill();

    // Engine flame (yellow core inside the trail)
    ctx.fillStyle = '#ffe833';
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, -s * 0.10);
    ctx.lineTo(-s * (1.10 + flame * 0.20), 0);
    ctx.lineTo(-s * 0.85,  s * 0.10);
    ctx.closePath();
    ctx.fill();
  }

  function drawHotelsign(c, light, dark, wingT) {
    // Vertical neon "HOTEL" sign on a pole. Tropical Cali vibe.
    const s = c.size;
    const blink = (Math.sin(wingT * 3) + 1) * 0.5;

    // Pole
    ctx.fillStyle = '#3a3a3a';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-s * 0.06, -s * 0.10, s * 0.12, s * 1.10);
    ctx.strokeRect(-s * 0.06, -s * 0.10, s * 0.12, s * 1.10);

    // Sign body
    const w = s * 0.85, h = s * 1.20;
    ctx.fillStyle = '#0a1018';
    ctx.lineWidth = 2;
    ctx.fillRect(-w / 2, -h * 0.95, w, h);
    ctx.strokeRect(-w / 2, -h * 0.95, w, h);

    // Neon outer border (magenta)
    ctx.strokeStyle = '#ff5cf2';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6 + blink * 0.4;
    ctx.strokeRect(-w / 2 + 4, -h * 0.95 + 4, w - 8, h - 8);
    ctx.globalAlpha = 1;

    // "HOTEL" letters stacked vertically — cyan neon
    ctx.fillStyle = '#4ad8ff';
    ctx.globalAlpha = 0.7 + blink * 0.3;
    const letters = ['H', 'O', 'T', 'E', 'L'];
    ctx.font = `900 ${Math.max(7, s * 0.22)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < letters.length; i++) {
      ctx.fillText(letters[i], 0, -h * 0.78 + i * (h * 0.18));
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;

    // Bottom star ornament
    ctx.fillStyle = '#ffe833';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? s * 0.13 : s * 0.05;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r + s * 0.10);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0e0e0e';
    ctx.stroke();
  }

  function drawCoffeecup(c, light, dark, wingT) {
    // White ceramic cup w/ brown coffee + animated steam
    const s = c.size;

    // Saucer
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.65, s * 0.95, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Cup body — wider at top
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.10);
    ctx.lineTo(-s * 0.45,  s * 0.55);
    ctx.lineTo( s * 0.45,  s * 0.55);
    ctx.lineTo( s * 0.55, -s * 0.10);
    ctx.lineTo( s * 0.55, -s * 0.20);
    ctx.lineTo(-s * 0.55, -s * 0.20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Coffee surface — brown ellipse at the rim
    ctx.fillStyle = '#3a1a08';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.20, s * 0.55, s * 0.10, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Coffee crema highlight
    ctx.fillStyle = '#a86b00';
    ctx.beginPath();
    ctx.ellipse(-s * 0.10, -s * 0.22, s * 0.20, s * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();

    // Handle — right side oval
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(s * 0.65, s * 0.18, s * 0.18, s * 0.22, 0, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();

    // Steam wisps — 3 animated curves rising from the cup
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.75;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      const baseX = i * s * 0.20;
      ctx.moveTo(baseX, -s * 0.30);
      for (let k = 1; k <= 6; k++) {
        const y = -s * 0.30 - k * s * 0.13;
        const x = baseX + Math.sin(wingT * 3 + k * 0.6 + i) * s * 0.12;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawRobotbody(c, light, dark, wingT) {
    // Boxy retro robot — antenna, LED eyes, body, treads
    const s = c.size;
    const blink = Math.sin(wingT * 4) > 0.5 ? 0 : 1;

    // Antenna
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.95);
    ctx.lineTo(0, -s * 0.70);
    ctx.stroke();
    ctx.fillStyle = blink ? '#ff5cf2' : '#9cff3a';
    ctx.beginPath();
    ctx.arc(0, -s * 1.00, s * 0.08, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Head — square
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(-s * 0.45, -s * 0.70, s * 0.90, s * 0.55);
    ctx.strokeRect(-s * 0.45, -s * 0.70, s * 0.90, s * 0.55);

    // Eye visor — black band with two LED dots
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(-s * 0.35, -s * 0.55, s * 0.70, s * 0.18);
    ctx.fillStyle = '#4ad8ff';
    ctx.globalAlpha = 0.6 + blink * 0.4;
    ctx.beginPath(); ctx.arc(-s * 0.18, -s * 0.46, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( s * 0.18, -s * 0.46, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Mouth — small grille
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s * 0.08, -s * 0.30);
      ctx.lineTo(i * s * 0.08, -s * 0.20);
      ctx.stroke();
    }

    // Body — slightly wider rounded rect
    ctx.fillStyle = '#9aa5b5';
    ctx.lineWidth = 2;
    ctx.fillRect(-s * 0.55, -s * 0.10, s * 1.10, s * 0.65);
    ctx.strokeRect(-s * 0.55, -s * 0.10, s * 1.10, s * 0.65);

    // Chest panel — colored screen
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(-s * 0.30, s * 0.05, s * 0.60, s * 0.30);
    ctx.fillStyle = '#9cff3a';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(-s * 0.26, s * 0.09, s * 0.52, s * 0.10);
    ctx.fillStyle = '#ffe833';
    ctx.fillRect(-s * 0.26, s * 0.22, s * 0.36, s * 0.08);
    ctx.globalAlpha = 1;

    // Side rivets
    ctx.fillStyle = '#666666';
    for (const ry of [-s * 0.02, s * 0.18, s * 0.40]) {
      ctx.beginPath(); ctx.arc(-s * 0.48, ry, s * 0.04, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( s * 0.48, ry, s * 0.04, 0, Math.PI * 2); ctx.fill();
    }

    // Arms — short stubs
    ctx.fillStyle = '#9aa5b5';
    ctx.fillRect(-s * 0.75, s * 0.05, s * 0.18, s * 0.40);
    ctx.strokeRect(-s * 0.75, s * 0.05, s * 0.18, s * 0.40);
    ctx.fillRect( s * 0.57, s * 0.05, s * 0.18, s * 0.40);
    ctx.strokeRect( s * 0.57, s * 0.05, s * 0.18, s * 0.40);

    // Tread feet
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(-s * 0.55, s * 0.55, s * 0.50, s * 0.20);
    ctx.fillRect( s * 0.05, s * 0.55, s * 0.50, s * 0.20);
  }

  function drawDiscoball(c, light, dark, wingT) {
    // Hanging disco ball with rotating sparkle
    const s = c.size;

    // Hanging chain
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.10);
    ctx.lineTo(0, -s * 0.85);
    ctx.stroke();
    // Top loop
    ctx.fillStyle = '#cccccc';
    ctx.beginPath();
    ctx.arc(0, -s * 1.00, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0e0e0e';
    ctx.stroke();

    // Ball body
    ctx.fillStyle = '#cccccc';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Mirror tile grid — clipped to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2);
    ctx.clip();
    // Vertical "longitude" arcs
    ctx.strokeStyle = 'rgba(0,0,0,0.30)';
    ctx.lineWidth = 1;
    for (let i = -5; i <= 5; i++) {
      const x = (i / 5) * s * 0.85;
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.abs(x), s * 0.85, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Horizontal lines
    for (let i = -4; i <= 4; i++) {
      const y = (i / 5) * s * 0.85;
      ctx.beginPath();
      ctx.moveTo(-s * 0.85, y);
      ctx.lineTo( s * 0.85, y);
      ctx.stroke();
    }
    // Random colored mirror highlights
    const tiles = [
      ['#4ad8ff', -0.3, -0.3],
      ['#ff5cf2',  0.2, -0.4],
      ['#ffe833', -0.5,  0.2],
      ['#9cff3a',  0.4,  0.3],
      ['#ffffff', -0.1,  0.0],
      ['#a855f7',  0.0, -0.5],
    ];
    for (const [col, tx, ty] of tiles) {
      ctx.fillStyle = col;
      ctx.fillRect(tx * s, ty * s, s * 0.16, s * 0.16);
    }
    ctx.restore();

    // Sparkle dots orbiting
    const sp = wingT * 1.5;
    for (let i = 0; i < 5; i++) {
      const a = sp + i * (Math.PI * 2 / 5);
      const r = s * 1.10;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r;
      ctx.moveTo(sx, sy - 4);
      ctx.lineTo(sx + 4, sy);
      ctx.lineTo(sx, sy + 4);
      ctx.lineTo(sx - 4, sy);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawMariostar(c, light, dark, wingT) {
    // Cute Mario-style 5-point star with face
    const s = c.size;
    const wob = Math.sin(wingT * 4) * 0.15;

    ctx.save();
    ctx.rotate(wob * 0.3);

    // Star outline + fill
    ctx.fillStyle = '#ffe833';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? s * 0.95 : s * 0.40;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Inner highlight ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? s * 0.75 : s * 0.30;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // Eyes — two cartoon ovals
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(-s * 0.18, -s * 0.05, s * 0.12, s * 0.16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse( s * 0.18, -s * 0.05, s * 0.12, s * 0.16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Pupils
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(-s * 0.16, -s * 0.02, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( s * 0.20, -s * 0.02, s * 0.06, 0, Math.PI * 2); ctx.fill();

    // Smile
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, s * 0.10, s * 0.20, 0.1, Math.PI - 0.1);
    ctx.stroke();

    ctx.restore();
  }

  function drawChainlink(c, light, dark, wingT) {
    // 3 interlocked metal chain links, slight sway
    const s = c.size;
    const sway = Math.sin(wingT * 1.5) * 0.10;

    ctx.save();
    ctx.rotate(sway);

    // Helper: draw one oval link at (x, y) with rotation
    function link(lx, ly, rot, col1, col2) {
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(rot);
      // Outer
      ctx.fillStyle = col1;
      ctx.strokeStyle = '#0e0e0e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.30, s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // Inner cutout (background show-through approximation)
      ctx.fillStyle = '#1a0820';
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.18, s * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.strokeStyle = col2;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(-s * 0.05, -s * 0.10, s * 0.20, s * 0.28, 0, Math.PI * 1.1, Math.PI * 1.7);
      ctx.stroke();
      ctx.restore();
    }

    // Three links — alternating angle
    link(0, -s * 0.65, 0, '#aaaaaa', '#ffffff');
    link(0,  0,        Math.PI / 2, '#888888', '#cccccc');
    link(0,  s * 0.65, 0, '#aaaaaa', '#ffffff');

    ctx.restore();
  }

  function drawWonkysmile(c, light, dark, wingT) {
    // Nirvana-style wonky smiley face — yellow circle, X eyes,
    // crooked mouth + tongue
    const s = c.size;

    // Face
    ctx.fillStyle = '#ffe833';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // X eyes
    ctx.lineWidth = 3;
    const eyeR = s * 0.10;
    // left
    ctx.beginPath();
    ctx.moveTo(-s * 0.32 - eyeR, -s * 0.20 - eyeR);
    ctx.lineTo(-s * 0.32 + eyeR, -s * 0.20 + eyeR);
    ctx.moveTo(-s * 0.32 + eyeR, -s * 0.20 - eyeR);
    ctx.lineTo(-s * 0.32 - eyeR, -s * 0.20 + eyeR);
    ctx.stroke();
    // right
    ctx.beginPath();
    ctx.moveTo( s * 0.32 - eyeR, -s * 0.20 - eyeR);
    ctx.lineTo( s * 0.32 + eyeR, -s * 0.20 + eyeR);
    ctx.moveTo( s * 0.32 + eyeR, -s * 0.20 - eyeR);
    ctx.lineTo( s * 0.32 - eyeR, -s * 0.20 + eyeR);
    ctx.stroke();

    // Crooked mouth — wonky scribble curve
    ctx.beginPath();
    ctx.moveTo(-s * 0.40, s * 0.20);
    ctx.quadraticCurveTo(-s * 0.20, s * 0.50, 0, s * 0.30);
    ctx.quadraticCurveTo( s * 0.20, s * 0.55, s * 0.45, s * 0.18);
    ctx.stroke();

    // Tongue sticking out the right side
    ctx.fillStyle = '#ff5cf2';
    ctx.beginPath();
    ctx.moveTo(s * 0.30, s * 0.30);
    ctx.quadraticCurveTo(s * 0.50, s * 0.50, s * 0.60, s * 0.42);
    ctx.quadraticCurveTo(s * 0.55, s * 0.30, s * 0.42, s * 0.28);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  function drawVillainmask(c, light, dark, wingT) {
    // Joker-style villain face — pale, red lips, green hair,
    // dark eyes. Slightly tilted manic energy.
    const s = c.size;

    // Hair behind (green clumps)
    ctx.fillStyle = '#0aff9c';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      const ax = i * s * 0.20;
      ctx.moveTo(ax - s * 0.12, -s * 0.30);
      ctx.lineTo(ax,            -s * 0.95);
      ctx.lineTo(ax + s * 0.12, -s * 0.30);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    // Face — pale oval
    ctx.fillStyle = '#f5ecd8';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.70, s * 0.85, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Dark eye sockets
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.ellipse(-s * 0.28, -s * 0.10, s * 0.18, s * 0.22, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse( s * 0.28, -s * 0.10, s * 0.18, s * 0.22, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Tiny white pupil dots
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-s * 0.25, -s * 0.10, s * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( s * 0.31, -s * 0.10, s * 0.04, 0, Math.PI * 2); ctx.fill();

    // Wide red grin
    ctx.fillStyle = '#ff2a4a';
    ctx.beginPath();
    ctx.moveTo(-s * 0.50, s * 0.20);
    ctx.quadraticCurveTo(0, s * 0.75, s * 0.50, s * 0.20);
    ctx.quadraticCurveTo(0, s * 0.55, -s * 0.50, s * 0.20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Teeth line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, s * 0.27);
    ctx.quadraticCurveTo(0, s * 0.55, s * 0.45, s * 0.27);
    ctx.stroke();
    // Vertical teeth ticks
    for (let i = -3; i <= 3; i++) {
      ctx.strokeStyle = '#0e0e0e';
      ctx.lineWidth = 1;
      const tx = i * s * 0.10;
      ctx.beginPath();
      ctx.moveTo(tx, s * 0.27 + Math.abs(i) * 0.01 * s);
      ctx.lineTo(tx, s * 0.40);
      ctx.stroke();
    }

    // Question mark scar on cheek
    ctx.fillStyle = '#a855f7';
    ctx.font = `bold ${Math.max(8, s * 0.30)}px "Syne", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('?', s * 0.55, -s * 0.25);
    ctx.textAlign = 'left';
  }

  // -------------------------------------------------------
  // CREATURE DRAW — translates/rotates/scales then dispatches
  // to the type-specific routine.
  // -------------------------------------------------------
  function updateCreature(c, t) {
    let x = c.baseX + Math.sin(t * c.driftSpeedX + c.driftPhase) * c.driftAmpX;
    let y = c.baseY + Math.cos(t * c.driftSpeedY + c.driftPhase * 0.7) * c.driftAmpY;
    // b058 — gentle attraction toward cursor (within 100px). Pulls
    // creatures up to ~22px toward mx/my so the wall feels alive
    // when you move the mouse around. Disabled when no cursor
    // (mx === -9999) and on mobile (no hover concept).
    if (mx > 0 && my > 0) {
      const dx = mx - x;
      const dy = my - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const range = 100;
      if (d < range && d > 0.01) {
        const pull = (1 - d / range) * 22;
        x += (dx / d) * pull;
        y += (dy / d) * pull;
      }
    }
    c.x = x;
    c.y = y;
    c.rot += c.rotSpeed * 0.02;
  }

  function drawCreature(c, t, isHover, bands) {
    const bass = bands ? bands.bass : 0;
    const mid = bands ? bands.mid : 0;
    const targetScale = isHover ? 1.35 : (1 + bass * 0.18);
    c.scale += (targetScale - c.scale) * 0.18;

    const [light, dark] = PALETTE[c.colorIdx];
    // b059 — wing/spin animation speedup tied to mid-band audio.
    // 0 mid → normal speed; 1 mid → 2.2x.
    const wingT = (t + c.wingPhase) * (1 + mid * 1.2);

    // b059 — apply depth alpha (back layer = 0.55, mid/front = 1.0).
    // Neighborhood creatures of the playing track get a +0.18 boost
    // so they visibly "light up" near the playing one.
    const baseAlpha = c.depthAlpha + (c.inNeighborhood ? 0.20 : 0);
    const drawAlpha = Math.min(1, baseAlpha);

    ctx.save();
    ctx.globalAlpha = drawAlpha;

    // b057 — soft additive glow halo, b059 mobile-skipped.
    // Front-depth creatures get a slightly stronger halo.
    if (!isMobile()) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const haloMult = c.depth === 2 ? 1.15 : 1.0;
      const haloR = c.size * c.scale * (isHover ? 2.1 : 1.5) * haloMult;
      const halo = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, haloR);
      halo.addColorStop(0, hexToRgba(light, isHover ? 0.28 : 0.10));
      halo.addColorStop(1, hexToRgba(light, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(c.x - haloR, c.y - haloR, haloR * 2, haloR * 2);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(c.x, c.y);
    // Some creatures have intentional non-rotating orientation
    const noRot = c.type === 'butterfly' || c.type === 'fish' ||
                  c.type === 'rocket' || c.type === 'note' ||
                  c.type === 'mushroom' || c.type === 'bee' ||
                  c.type === 'helmet' || c.type === 'supercar' ||
                  c.type === 'pillowcase' ||
                  // b061 — additional override types stay upright
                  c.type === 'spaceship' || c.type === 'hotelsign' ||
                  c.type === 'coffeecup' || c.type === 'robotbody' ||
                  c.type === 'discoball' || c.type === 'mariostar' ||
                  c.type === 'chainlink' || c.type === 'wonkysmile' ||
                  c.type === 'villainmask';
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
      // b060 — per-track override art
      case 'helmet':     drawHelmet(c, light, dark, wingT); break;
      case 'supercar':   drawSupercar(c, light, dark, wingT); break;
      case 'pillowcase': drawPillowcase(c, light, dark, wingT); break;
      // b061 — 9 more override types
      case 'spaceship':   drawSpaceship(c, light, dark, wingT); break;
      case 'hotelsign':   drawHotelsign(c, light, dark, wingT); break;
      case 'coffeecup':   drawCoffeecup(c, light, dark, wingT); break;
      case 'robotbody':   drawRobotbody(c, light, dark, wingT); break;
      case 'discoball':   drawDiscoball(c, light, dark, wingT); break;
      case 'mariostar':   drawMariostar(c, light, dark, wingT); break;
      case 'chainlink':   drawChainlink(c, light, dark, wingT); break;
      case 'wonkysmile':  drawWonkysmile(c, light, dark, wingT); break;
      case 'villainmask': drawVillainmask(c, light, dark, wingT); break;
    }

    ctx.restore();  // pops translate/rotate/scale
    ctx.restore();  // b059 — pops the outer globalAlpha (depthAlpha)
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
  // AUDIO REACT — b059 split into 3 bands (bass / mid / treble)
  // for richer reactivity than the b056 single-scalar beat.
  //   bass   → creature scale pulse (0..0.18)
  //   mid    → wing/spin animation speedup (0..1.2x extra)
  //   treble → background nebula brightness pulse (0..0.30)
  // -------------------------------------------------------
  function getAudioBands() {
    if (typeof getFrequencyData !== 'function') {
      return { bass: 0, mid: 0, treble: 0 };
    }
    const data = getFrequencyData();
    if (!data || data.length === 0) return { bass: 0, mid: 0, treble: 0 };
    let b = 0, m = 0, tr = 0;
    const bassEnd = Math.min(5, data.length);
    const midEnd = Math.min(31, data.length);
    for (let i = 0; i < bassEnd; i++) b += data[i];
    for (let i = bassEnd; i < midEnd; i++) m += data[i];
    for (let i = midEnd; i < data.length; i++) tr += data[i];
    const bassN = bassEnd || 1;
    const midN = (midEnd - bassEnd) || 1;
    const treN = (data.length - midEnd) || 1;
    return {
      bass:   Math.min(1, (b / bassN) / 200),
      mid:    Math.min(1, (m / midN) / 200),
      treble: Math.min(1, (tr / treN) / 200),
    };
  }

  // -------------------------------------------------------
  function draw() {
    if (!ctx || !canvas) return;
    const t = (performance.now() - t0) * 0.001;
    const bands = getAudioBands();

    drawBackground(t, bands);
    drawGlyphs(t);

    // Update creature positions BEFORE hit test so the
    // current frame's positions are what we test against.
    for (let i = 0; i < creatures.length; i++) updateCreature(creatures[i], t);
    hitTest();

    // b059 — find creatures whose track is currently playing,
    // then mark all creatures within 200px of any playing one
    // as "in neighborhood". They get a +0.20 alpha boost in
    // drawCreature so the wall visibly clusters around the song.
    const playingIdx = (typeof state !== 'undefined' && state) ? state.currentTrack : -1;
    const playingCreatures = [];
    for (const c of creatures) {
      c.inNeighborhood = false;
      if (playingIdx >= 0 && c.trackIndex === playingIdx) playingCreatures.push(c);
    }
    if (playingCreatures.length > 0) {
      for (const c of creatures) {
        if (c.trackIndex === playingIdx) continue;
        for (const p of playingCreatures) {
          const dx = p.x - c.x;
          const dy = p.y - c.y;
          if (dx * dx + dy * dy < 200 * 200) {
            c.inNeighborhood = true;
            break;
          }
        }
      }
    }

    // b059 — constellation lines: faint white pair lines that
    // stretch as creatures drift. Drawn UNDER everything else
    // so they read as a star map background layer.
    if (constellations.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      for (const [i, j] of constellations) {
        const a = creatures[i], b = creatures[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 130) continue;  // hide stretched lines (cursor pulled apart)
        ctx.globalAlpha = (1 - d / 130) * 0.10;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // b059 — neighborhood connection lines: faint lime lines
    // from each playing creature to each creature in its
    // neighborhood. Distance-falloff alpha.
    if (playingCreatures.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#9cff3a';
      ctx.lineWidth = 1.2;
      for (const p of playingCreatures) {
        for (const c of creatures) {
          if (!c.inNeighborhood) continue;
          const dx = p.x - c.x;
          const dy = p.y - c.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 200 || d < 0.01) continue;
          ctx.globalAlpha = (1 - d / 200) * 0.45;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // b058 — cursor connecting lines: thin lime threads from
    // the cursor to any creature within 90px. Skipped on mobile.
    if (mx > 0 && my > 0 && !isMobile()) {
      ctx.save();
      ctx.strokeStyle = 'rgba(156,255,58,0.30)';
      ctx.lineWidth = 1;
      for (const c of creatures) {
        const dx = c.x - mx;
        const dy = c.y - my;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 90 && d > 0.01) {
          ctx.globalAlpha = (1 - d / 90) * 0.5;
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // b059 — 3-pass parallax draw order: back → mid → front.
    // Hovered always drawn last on top. Within each depth pass
    // we skip the hovered index.
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < creatures.length; i++) {
        if (creatures[i].depth !== pass) continue;
        if (i === hovered) continue;
        drawCreature(creatures[i], t, false, bands);
      }
    }

    // b058 — currently-playing ring AFTER creatures so it sits
    // on top. Slow rotating dashed lime circle around the
    // creature(s) whose trackIndex matches the playing track.
    if (playingIdx >= 0) {
      for (const c of playingCreatures) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(t * 0.6);
        ctx.strokeStyle = '#9cff3a';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, c.size * c.scale * 1.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // b058 — info panel.
    const lab = document.getElementById('wallLabel');
    const tit = document.getElementById('wallTitle');
    const showToast = performance.now() < toastUntil;

    if (hovered >= 0) {
      drawCreature(creatures[hovered], t, true, bands);
      drawTooltip(creatures[hovered]);
      if (lab) lab.textContent = showToast ? toastText : ('▸ ' + creatures[hovered].title.toLowerCase());
      if (tit) tit.style.display = 'none';
    } else {
      if (lab) lab.textContent = showToast ? toastText : 'click any creature →';
      if (tit) tit.style.display = 'none';
    }

    // b058 — burst rings: expand + fade over 700ms.
    // Drawn last so they sit above everything.
    const now = performance.now();
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      const age = (now - b.birth) / 700;
      if (age >= 1) { bursts.splice(i, 1); continue; }
      const r = 12 + age * 70;
      ctx.save();
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = (1 - age) * 0.85;
      ctx.lineWidth = 3 * (1 - age) + 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.stroke();
      // inner faint ring
      ctx.globalAlpha = (1 - age) * 0.4;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
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
