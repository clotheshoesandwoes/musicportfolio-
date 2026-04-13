/* =========================================================
   DIMENSIONS.JS — Grid of living worlds (b077)
   ---------------------------------------------------------
   Merges Living Wall (tile grid) + Tape Spine (20 scene
   types). Each track is a tile running a mini version of
   its assigned scene. Click dives into the full immersive
   experience. The existing player bar handles all playback.

   20 scene types, each with a mini (tile) and full
   (expanded) renderer. Grid breathes, tiles pulse on beat.
   ========================================================= */

(function () {
  const SCENE_TYPES = window.SCENE_DEFS ? window.SCENE_DEFS.COUNT : 20;
  const TILE_GAP = 8;
  const MINI_FPS = 10;
  const MINI_INTERVAL = 1000 / MINI_FPS;
  const BREATH_SPEED = 0.0007;
  const BREATH_AMP = 0.02;
  const BEAT_THRESHOLD = 0.32;
  const BEAT_COOLDOWN = 280;

  let container, gridEl, overlayEl;
  let tiles = [];
  let rafId = null;
  let lastMiniDraw = 0;
  let breathPhase = 0;
  let beatPulse = 0, lastBeatTime = 0;
  let expandedTile = null;
  let expandedCanvas, expandedCtx, expandedParts;
  let searchQuery = '';
  let tileSize = 170;
  let t0 = 0;
  let trackList = [];

  // --- Feature: mouse trails ---
  let bgCanvas, bgCtx;
  let mouseTrails = [];
  let gridMX = -1, gridMY = -1;
  let sparkBursts = [];

  // --- Feature: interactive scene clicks ---
  let sceneClickEffects = [];

  // --- Feature: swipe ---
  let touchStartX = 0, touchStartY = 0;

  const SOUNDCLOUD_BASE = 'https://soundcloud.com/kanisongs';

  function soundcloudURL(title) {
    // slugify title → SoundCloud URL format
    const slug = title.toLowerCase()
      .replace(/['']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return SOUNDCLOUD_BASE + '/' + slug;
  }

  /* ----- helpers ----- */
  function hexToRGBA(hex, a) { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return `rgba(${r},${g},${b},${a})`; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hash(i) { return ((i * 2654435761) >>> 0); }
  // Shuffled permutation so all 20 types get used evenly across tracks.
  // Every block of 20 tracks gets all 20 types in a seeded-random order.
  function sceneType(idx) {
    const block = Math.floor(idx / SCENE_TYPES);
    const pos = idx % SCENE_TYPES;
    // Fisher-Yates shuffle seeded by block index
    const perm = [];
    for (let i = 0; i < SCENE_TYPES; i++) perm.push(i);
    let seed = block * 7919 + 1;
    for (let i = SCENE_TYPES - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const j = seed % (i + 1);
      const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp;
    }
    return perm[pos];
  }

  const SCENE_NAMES = window.SCENE_DEFS ? window.SCENE_DEFS.NAMES : [];

  /* ============== INIT ============== */
  function init(viewContainer) {
    container = viewContainer;
    t0 = performance.now();

    const style = document.createElement('style');
    style.id = 'dimensionsStyle';
    style.textContent = `
      .dim-bg { position:absolute; inset:0; pointer-events:none; z-index:0; }
      .dim-grid { display:flex; flex-wrap:wrap; gap:${TILE_GAP}px; padding:80px 20px 20px;
        justify-content:center; align-content:start; overflow-y:auto; height:100%; box-sizing:border-box;
        position:relative; z-index:1; cursor:none; }
      .dim-grid-cursor { position:fixed; width:8px; height:8px; border-radius:50%;
        background:rgba(168,85,247,0.6); pointer-events:none; z-index:100;
        box-shadow:0 0 12px rgba(168,85,247,0.4); transition:transform 0.1s; mix-blend-mode:screen; }
      .dim-entrance { position:absolute; inset:0; z-index:50; display:flex; align-items:center;
        justify-content:center; background:#050505; transition:opacity 0.8s; }
      .dim-entrance.fade { opacity:0; pointer-events:none; }
      .dim-entrance-logo { font-family:'Syne',sans-serif; font-size:64px; font-weight:700;
        color:#fff; opacity:0; animation:dim-logo-in 1.5s ease forwards; }
      @keyframes dim-logo-in { 0%{opacity:0;transform:scale(0.8);filter:blur(10px)} 50%{opacity:1;transform:scale(1.05);filter:blur(0)} 100%{opacity:0;transform:scale(1.1);filter:blur(5px)} }
      .dim-tile { position:relative; width:${tileSize}px; height:${tileSize}px; border-radius:12px;
        overflow:hidden; cursor:pointer; transition:transform .35s cubic-bezier(.22,.68,0,1.2),box-shadow .3s;
        will-change:transform; }
      .dim-tile canvas { display:block; width:100%; height:100%; border-radius:12px; }
      .dim-tile-label { position:absolute; bottom:0; left:0; right:0; padding:24px 10px 8px;
        font-family:'DM Sans',sans-serif; font-size:11px; font-weight:500; color:#fff;
        background:linear-gradient(transparent,rgba(0,0,0,0.75)); white-space:nowrap;
        overflow:hidden; text-overflow:ellipsis; pointer-events:none; opacity:0; transition:opacity .25s; }
      .dim-tile-scene { position:absolute; top:6px; right:8px; font-family:'JetBrains Mono',monospace;
        font-size:8px; color:rgba(255,255,255,0.25); pointer-events:none; opacity:0; transition:opacity .25s; }
      .dim-tile:hover .dim-tile-label, .dim-tile:hover .dim-tile-scene { opacity:1; }
      .dim-tile:hover { transform:scale(1.1); box-shadow:0 0 30px rgba(168,85,247,0.35); z-index:10; }
      .dim-tile.playing { box-shadow:0 0 20px rgba(156,255,58,0.4); }
      .dim-tile.playing::after { content:''; position:absolute; top:6px; left:8px; width:7px; height:7px;
        border-radius:50%; background:#9cff3a; box-shadow:0 0 8px #9cff3a; animation:dim-dot 1s ease-in-out infinite; }
      .dim-tile.hidden { display:none; }
      .dim-tile.entering { opacity:0; transform:scale(0.7) translateY(20px); }
      @keyframes dim-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }

      .dim-overlay { position:fixed; top:0; left:0; right:0; bottom:var(--player-h,80px);
        z-index:55; background:rgba(0,0,0,0); display:flex;
        flex-direction:column; transition:background .4s; }
      .dim-overlay.visible { background:rgba(0,0,0,0.96); }
      .dim-overlay canvas { position:absolute; inset:0; width:100%; height:100%; }
      .dim-overlay-info { position:absolute; bottom:24px; left:0; right:0; text-align:center;
        z-index:2; opacity:0; transition:opacity .5s .2s; pointer-events:none; }
      .dim-overlay.visible .dim-overlay-info { pointer-events:auto; }
      .dim-overlay.visible .dim-overlay-info { opacity:1; }
      .dim-overlay-title { font-family:'Syne',sans-serif; font-size:36px; font-weight:700;
        color:#fff; letter-spacing:-0.02em; text-shadow:0 2px 20px rgba(0,0,0,0.5); }
      .dim-overlay-sub { font-family:'DM Sans',sans-serif; font-size:12px; color:rgba(255,255,255,0.4);
        margin-top:6px; }
      .dim-sc-link { display:inline-flex; align-items:center; gap:8px; margin-top:14px;
        padding:10px 22px; border-radius:999px; background:rgba(255,85,0,0.15);
        border:1px solid rgba(255,85,0,0.3); color:#ff5500; text-decoration:none;
        font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600;
        transition:all 0.2s; pointer-events:auto; cursor:pointer;
        letter-spacing:0.02em; }
      .dim-sc-link:hover { background:rgba(255,85,0,0.28); box-shadow:0 0 15px rgba(255,85,0,0.2); }
      .dim-overlay-close { position:absolute; top:20px; right:24px; z-index:3; background:rgba(255,255,255,0.08);
        border:1px solid rgba(255,255,255,0.15); color:#fff; font-family:'DM Sans',sans-serif;
        font-size:12px; padding:8px 18px; border-radius:999px; cursor:pointer; transition:background .2s; }
      .dim-overlay-close:hover { background:rgba(255,255,255,0.15); }
      .dim-nav-btn { position:absolute; top:50%; z-index:3; transform:translateY(-50%);
        background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#fff;
        font-size:20px; width:44px; height:44px; border-radius:50%; cursor:pointer;
        display:flex; align-items:center; justify-content:center; transition:background .2s;
        font-family:'DM Sans',sans-serif; }
      .dim-nav-btn:hover { background:rgba(255,255,255,0.15); }
      .dim-nav-prev { left:16px; }
      .dim-nav-next { right:16px; }

      @media(max-width:768px) { .dim-grid{padding:70px 10px 10px;gap:6px}
        .dim-tile{width:140px;height:140px} .dim-overlay-title{font-size:24px}
        .dim-overlay-close{top:12px;right:12px;font-size:11px;padding:6px 14px}
        .dim-nav-btn{width:36px;height:36px;font-size:16px}
        .dim-nav-prev{left:8px} .dim-nav-next{right:8px} }
    `;
    document.head.appendChild(style);

    tileSize = window.innerWidth < 768 ? 140 : 170;

    // --- Cinematic entrance ---
    const entrance = document.createElement('div');
    entrance.className = 'dim-entrance';
    entrance.innerHTML = '<div class="dim-entrance-logo">Kani</div>';
    container.appendChild(entrance);
    setTimeout(() => entrance.classList.add('fade'), 1600);
    setTimeout(() => entrance.remove(), 2500);

    // --- Background canvas (mouse trails + audio-reactive ambient) ---
    bgCanvas = document.createElement('canvas');
    bgCanvas.className = 'dim-bg';
    container.appendChild(bgCanvas);

    // --- Custom cursor (desktop only) ---
    const cursor = document.createElement('div');
    cursor.className = 'dim-grid-cursor';
    cursor.id = 'dimCursor';
    if (window.innerWidth > 768) container.appendChild(cursor);

    gridEl = document.createElement('div');
    gridEl.className = 'dim-grid';
    container.appendChild(gridEl);

    // mouse tracking for trails
    gridEl.addEventListener('mousemove', (e) => {
      const r = container.getBoundingClientRect();
      gridMX = e.clientX - r.left; gridMY = e.clientY - r.top;
      const cur = document.getElementById('dimCursor');
      if (cur) { cur.style.left = e.clientX - 4 + 'px'; cur.style.top = e.clientY - 4 + 'px'; }
      // emit trail particles
      mouseTrails.push({ x: gridMX, y: gridMY, life: 0, size: 2 + Math.random() * 3, hue: 270 + Math.random() * 60 });
      if (mouseTrails.length > 80) mouseTrails.shift();
    });
    gridEl.addEventListener('mouseleave', () => { gridMX = -1; gridMY = -1; });

    // spark bursts when hovering tiles
    gridEl.addEventListener('mouseover', (e) => {
      const tile = e.target.closest('.dim-tile');
      if (tile) {
        const r = tile.getBoundingClientRect();
        const cr = container.getBoundingClientRect();
        const cx = r.left - cr.left + r.width / 2, cy = r.top - cr.top + r.height / 2;
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * 6.28;
          sparkBursts.push({ x: cx, y: cy, vx: Math.cos(angle) * (2 + Math.random() * 3), vy: Math.sin(angle) * (2 + Math.random() * 3), life: 0, size: 1.5 + Math.random() * 2 });
        }
      }
    });

    buildTiles();
    breathPhase = 0;
    lastMiniDraw = 0;
    resizeBgCanvas();
    window.addEventListener('resize', resizeBgCanvas);
    rafId = requestAnimationFrame(animate);
  }

  function destroy() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    window.removeEventListener('resize', resizeBgCanvas);
    const s = document.getElementById('dimensionsStyle'); if (s) s.remove();
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    tiles = []; expandedTile = null; container = gridEl = null;
    bgCanvas = bgCtx = null; mouseTrails = []; sparkBursts = [];
  }

  function resizeBgCanvas() {
    if (!bgCanvas || !container) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = container.offsetWidth, h = container.offsetHeight;
    bgCanvas.width = w * dpr; bgCanvas.height = h * dpr;
    bgCanvas.style.width = w + 'px'; bgCanvas.style.height = h + 'px';
    bgCtx = bgCanvas.getContext('2d');
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ============== BUILD TILES ============== */
  function buildTiles() {
    if (!gridEl) return;
    gridEl.innerHTML = '';
    tiles = [];
    trackList = getFilteredTracks();
    const filtered = trackList;
    const res = tileSize;

    filtered.forEach((track, i) => {
      try {
        const idx = track.originalIndex;
        const type = sceneType(idx);
        const colors = getGradientColors(idx);

        const el = document.createElement('div');
        el.className = 'dim-tile entering';

        const cvs = document.createElement('canvas');
        cvs.width = res; cvs.height = res;
        el.appendChild(cvs);

        const label = document.createElement('div');
        label.className = 'dim-tile-label';
        label.textContent = track.title;
        el.appendChild(label);

        const sceneLbl = document.createElement('div');
        sceneLbl.className = 'dim-tile-scene';
        sceneLbl.textContent = (SCENE_NAMES && SCENE_NAMES[type]) || '';
        el.appendChild(sceneLbl);

        if (state.currentTrack === idx) el.classList.add('playing');

        el.addEventListener('click', () => expandTile(idx, type, colors, track.title));

        gridEl.appendChild(el);

        const parts = createMiniParticles(type, res);

        tiles.push({ el, canvas: cvs, ctx: cvs.getContext('2d'), index: idx,
          type, colors, parts, phase: (i % 10) * 0.5 + Math.floor(i / 10) * 0.3 });

        setTimeout(() => el.classList.remove('entering'), 25 + i * 15);
      } catch(e) { console.error('Tile build error at track', i, e); }
    });
  }


  /* ============== EXPAND / COLLAPSE / NAVIGATE ============== */
  let expandedTrackListIndex = -1;
  let closeTimeout = null;

  function expandTile(trackIndex, type, colors, title) {
    if (typeof playTrack === 'function') playTrack(trackIndex);
    expandedTrackListIndex = trackList.findIndex(t => t.originalIndex === trackIndex);
    if (closeTimeout) { clearTimeout(closeTimeout); closeTimeout = null; }
    if (overlayEl) { document.removeEventListener('keydown', overlayEl._onKey); overlayEl.remove(); overlayEl = null; }
    expandedTile = null; expandedCanvas = expandedCtx = expandedParts = null;

    overlayEl = document.createElement('div');
    overlayEl.className = 'dim-overlay';
    expandedCanvas = document.createElement('canvas');
    expandedCtx = expandedCanvas.getContext('2d');
    overlayEl.appendChild(expandedCanvas);

    const info = document.createElement('div');
    info.className = 'dim-overlay-info';
    info.id = 'dimOverlayInfo';
    info.innerHTML = `<div class="dim-overlay-title" id="dimExpTitle">${escapeHtml(title)}</div>
      <div class="dim-overlay-sub" id="dimExpSub">${SCENE_NAMES[type] || ''}  ·  ◂ ▸ to navigate</div>
      <a href="${soundcloudURL(title)}" target="_blank" rel="noopener" class="dim-sc-link" id="dimExpSC">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.56 8.87V17h8.76c1.85 0 2.68-1.4 2.68-2.82 0-1.42-.83-2.82-2.68-2.82-.37 0-.73.07-1.06.2-.13-2.34-2.04-4.19-4.42-4.19-1.2 0-2.28.46-3.08 1.2-.1.09-.16.2-.2.3zM10.5 9.25V17h-.75V9.6c.24-.14.49-.26.75-.35zM8.75 10.5V17H8v-6.12c.24-.15.49-.28.75-.38zM7 11.69V17h-.75v-4.76c.23-.2.48-.38.75-.55zM5.25 13.14V17h-.75v-3.28c.22-.22.47-.4.75-.58zM3.5 14.81V17h-.75v-1.63c.18-.23.44-.4.75-.56zM1.75 16.07V17H1v-.58c.2-.15.46-.26.75-.35z"/></svg>
        Listen on SoundCloud
      </a>`;
    overlayEl.appendChild(info);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'dim-overlay-close';
    closeBtn.textContent = '✕ close';
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeExpanded(); });
    overlayEl.appendChild(closeBtn);

    const prevBtn = document.createElement('button');
    prevBtn.className = 'dim-nav-btn dim-nav-prev';
    prevBtn.textContent = '◂';
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); navigateExpanded(-1); });
    overlayEl.appendChild(prevBtn);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'dim-nav-btn dim-nav-next';
    nextBtn.textContent = '▸';
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); navigateExpanded(1); });
    overlayEl.appendChild(nextBtn);

    document.body.appendChild(overlayEl);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ow = window.innerWidth, oh = overlayEl.offsetHeight || window.innerHeight;
    expandedCanvas.width = ow * dpr; expandedCanvas.height = oh * dpr;
    expandedCanvas.style.width = ow + 'px'; expandedCanvas.style.height = oh + 'px';
    expandedCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    expandedParts = createFullParticles(type, ow, oh);
    expandedTile = { trackIndex, type, colors, title, w: ow, h: oh };

    requestAnimationFrame(() => overlayEl.classList.add('visible'));

    overlayEl._onKey = (e) => {
      if (e.code === 'Escape') closeExpanded();
      else if (e.code === 'ArrowLeft') navigateExpanded(-1);
      else if (e.code === 'ArrowRight') navigateExpanded(1);
    };
    document.addEventListener('keydown', overlayEl._onKey);

    // --- Swipe navigation (mobile) ---
    overlayEl.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    overlayEl.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        navigateExpanded(dx < 0 ? 1 : -1);
      }
    }, { passive: true });

    // --- Interactive scene clicks (scene-specific effects) ---
    sceneClickEffects = [];
    expandedCanvas.addEventListener('click', (e) => {
      if (!expandedTile) return;
      const r = expandedCanvas.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * expandedTile.w;
      const y = (e.clientY - r.top) / r.height * expandedTile.h;
      const type = expandedTile.type;
      const particles = [];
      const count = 15;

      if (type === 0) { // Tokyo Rain — splash + rain drops flying
        for (let i = 0; i < count; i++) { const a = Math.random() * 6.28; particles.push({ x, y, vx: Math.cos(a) * (1 + Math.random() * 2), vy: -Math.random() * 4 - 1, size: 1 + Math.random() * 1.5, color: 'rgba(180,190,220,A)', gravity: 0.1 }); }
      } else if (type === 1) { // Ocean — ripple rings + bubbles rising
        for (let i = 0; i < count; i++) { particles.push({ x: x + (Math.random() - 0.5) * 30, y, vx: (Math.random() - 0.5) * 0.5, vy: -1 - Math.random() * 3, size: 2 + Math.random() * 4, color: 'rgba(100,200,255,A)', gravity: -0.02 }); }
      } else if (type === 2) { // Campfire — embers burst upward
        for (let i = 0; i < count; i++) { const a = -Math.PI/2 + (Math.random() - 0.5) * 1.5; particles.push({ x, y, vx: Math.cos(a) * (2 + Math.random() * 3), vy: Math.sin(a) * (3 + Math.random() * 4), size: 1.5 + Math.random() * 2, color: `rgba(255,${100+Math.floor(Math.random()*120)},20,A)`, gravity: -0.03 }); }
      } else if (type === 3) { // Northern Lights — aurora wisps
        for (let i = 0; i < count; i++) { particles.push({ x: x + (Math.random() - 0.5) * 40, y, vx: (Math.random() - 0.5) * 2, vy: -0.5 - Math.random() * 1.5, size: 3 + Math.random() * 5, color: `hsla(${120 + Math.random() * 160},60%,55%,A)`, gravity: -0.01 }); }
      } else if (type === 4) { // Desert — sand burst
        for (let i = 0; i < 20; i++) { const a = Math.random() * 6.28; particles.push({ x, y, vx: Math.cos(a) * (3 + Math.random() * 4), vy: Math.sin(a) * (2 + Math.random() * 3) - 1, size: 1 + Math.random() * 2, color: 'rgba(180,150,100,A)', gravity: 0.08 }); }
      } else if (type === 5) { // Lightning — electric sparks
        for (let i = 0; i < count; i++) { const a = Math.random() * 6.28; particles.push({ x, y, vx: Math.cos(a) * (4 + Math.random() * 5), vy: Math.sin(a) * (4 + Math.random() * 5), size: 1 + Math.random() * 1.5, color: 'rgba(200,220,255,A)', gravity: 0 }); }
      } else if (type === 6) { // Snowy Cabin — snowflake burst
        for (let i = 0; i < 20; i++) { const a = Math.random() * 6.28; particles.push({ x, y, vx: Math.cos(a) * (1 + Math.random() * 2), vy: Math.sin(a) * (1 + Math.random() * 2), size: 2 + Math.random() * 3, color: 'rgba(255,255,255,A)', gravity: 0.02 }); }
      } else if (type === 7) { // Beach — water splash
        for (let i = 0; i < count; i++) { const a = -Math.PI/2 + (Math.random() - 0.5) * 2; particles.push({ x, y, vx: Math.cos(a) * (2 + Math.random() * 3), vy: Math.sin(a) * (3 + Math.random() * 3), size: 2 + Math.random() * 3, color: 'rgba(150,200,255,A)', gravity: 0.1 }); }
      } else if (type === 8) { // Space — stardust explosion
        for (let i = 0; i < 20; i++) { const a = Math.random() * 6.28; const sp = 1 + Math.random() * 3; particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 1 + Math.random() * 2, color: `hsla(${Math.random()*60+220},60%,70%,A)`, gravity: 0 }); }
      } else if (type === 12) { // Synthwave — neon shatter
        for (let i = 0; i < count; i++) { const a = Math.random() * 6.28; particles.push({ x, y, vx: Math.cos(a) * (3 + Math.random() * 4), vy: Math.sin(a) * (3 + Math.random() * 4), size: 2 + Math.random() * 2, color: `hsla(${Math.random()>0.5?300:180},80%,60%,A)`, gravity: 0 }); }
      } else if (type === 14) { // Volcano — lava splatter
        for (let i = 0; i < count; i++) { const a = -Math.PI/2 + (Math.random() - 0.5) * 1.8; particles.push({ x, y, vx: Math.cos(a) * (2 + Math.random() * 4), vy: Math.sin(a) * (4 + Math.random() * 5), size: 2 + Math.random() * 3, color: `rgba(255,${40+Math.floor(Math.random()*60)},0,A)`, gravity: 0.12 }); }
      } else if (type === 17) { // Aquarium — bubble burst
        for (let i = 0; i < count; i++) { particles.push({ x: x + (Math.random()-0.5)*20, y, vx: (Math.random()-0.5)*1.5, vy: -1.5 - Math.random()*3, size: 3 + Math.random()*5, color: 'rgba(150,200,255,A)', gravity: -0.02 }); }
      } else { // Default — colored burst matching scene palette
        const col = expandedTile.colors;
        for (let i = 0; i < count; i++) { const a = Math.random() * 6.28; particles.push({ x, y, vx: Math.cos(a) * (2 + Math.random() * 4), vy: Math.sin(a) * (2 + Math.random() * 4) - 1, size: 2 + Math.random() * 3, color: hexToRGBA(col[Math.random() > 0.5 ? 0 : 1], 'A'), gravity: 0.05 }); }
      }
      sceneClickEffects.push({ x, y, life: 0, type, particles });
    });
  }

  function navigateExpanded(dir) {
    if (trackList.length === 0) return;
    expandedTrackListIndex = (expandedTrackListIndex + dir + trackList.length) % trackList.length;
    const track = trackList[expandedTrackListIndex];
    const idx = track.originalIndex;
    const type = sceneType(idx);
    const colors = getGradientColors(idx);
    if (typeof playTrack === 'function') playTrack(idx);
    const ow = expandedTile.w, oh = expandedTile.h;
    expandedParts = createFullParticles(type, ow, oh);
    expandedTile = { trackIndex: idx, type, colors, title: track.title, w: ow, h: oh };
    const titleEl = document.getElementById('dimExpTitle');
    const subEl = document.getElementById('dimExpSub');
    if (titleEl) titleEl.textContent = track.title;
    if (subEl) subEl.textContent = (SCENE_NAMES[type] || '') + '  ·  ◂ ▸ to navigate';
    const scLink = document.getElementById('dimExpSC');
    if (scLink) scLink.href = soundcloudURL(track.title);
    tiles.forEach(t => t.el.classList.toggle('playing', t.index === idx));
  }

  function closeExpanded() {
    if (!overlayEl) return;
    if (closeTimeout) { clearTimeout(closeTimeout); closeTimeout = null; }
    document.removeEventListener('keydown', overlayEl._onKey);
    overlayEl.classList.remove('visible');
    closeTimeout = setTimeout(() => {
      closeTimeout = null;
      if (overlayEl) { overlayEl.remove(); overlayEl = null; }
      expandedTile = null; expandedCanvas = expandedCtx = expandedParts = null;
    }, 400);
  }

  /* ============== MAIN ANIMATION LOOP ============== */
  function animate(now) {
    rafId = requestAnimationFrame(animate);
    const t = (now - t0) * 0.001;
    breathPhase = now * BREATH_SPEED;

    const freq = typeof getFrequencyData === 'function' ? getFrequencyData() : null;
    let bass = 0, mid = 0, treble = 0;
    if (freq) {
      for (let i = 0; i < 6; i++) bass += freq[i]; bass /= (6 * 255);
      for (let i = 6; i < 24; i++) mid += freq[i]; mid /= (18 * 255);
      for (let i = 24; i < 64; i++) treble += freq[i]; treble /= (40 * 255);
      if (bass > BEAT_THRESHOLD && now - lastBeatTime > BEAT_COOLDOWN) { beatPulse = 1; lastBeatTime = now; }
    }
    beatPulse *= 0.92;

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const bs = 1 + Math.sin(breathPhase + tile.phase) * BREATH_AMP;
      const pulse = 1 + beatPulse * 0.05;
      if (!tile.el.matches(':hover')) tile.el.style.transform = `scale(${(bs * pulse).toFixed(4)})`;
    }

    if (now - lastMiniDraw > MINI_INTERVAL) {
      lastMiniDraw = now;
      for (let i = 0; i < tiles.length; i++) drawMiniScene(tiles[i], t, bass, mid, treble);
    }

    // --- Background layer: ambient glow + mouse trails + sparks ---
    if (bgCtx && bgCanvas) {
      const bw = bgCanvas.width / (Math.min(window.devicePixelRatio || 1, 2) || 1);
      const bh = bgCanvas.height / (Math.min(window.devicePixelRatio || 1, 2) || 1);
      bgCtx.clearRect(0, 0, bw, bh);

      // Audio-reactive ambient nebula
      if (bass > 0.05 || mid > 0.05) {
        const cx = bw / 2 + Math.sin(t * 0.1) * bw * 0.2;
        const cy = bh / 2 + Math.cos(t * 0.08) * bh * 0.15;
        const gr = bw * 0.4 + bass * bw * 0.2;
        const ng = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, gr);
        ng.addColorStop(0, `rgba(139,92,246,${0.03 + bass * 0.04})`);
        ng.addColorStop(0.5, `rgba(236,72,153,${0.015 + mid * 0.02})`);
        ng.addColorStop(1, 'rgba(0,0,0,0)');
        bgCtx.fillStyle = ng; bgCtx.fillRect(0, 0, bw, bh);
        // second nebula blob
        const cx2 = bw * 0.7 + Math.cos(t * 0.12) * bw * 0.15;
        const cy2 = bh * 0.3 + Math.sin(t * 0.09) * bh * 0.1;
        const ng2 = bgCtx.createRadialGradient(cx2, cy2, 0, cx2, cy2, gr * 0.6);
        ng2.addColorStop(0, `rgba(99,102,241,${0.02 + mid * 0.03})`);
        ng2.addColorStop(1, 'rgba(0,0,0,0)');
        bgCtx.fillStyle = ng2; bgCtx.fillRect(0, 0, bw, bh);
      }

      // Mouse trail particles
      for (let i = mouseTrails.length - 1; i >= 0; i--) {
        const p = mouseTrails[i];
        p.life += 0.025;
        if (p.life > 1) { mouseTrails.splice(i, 1); continue; }
        const fade = 1 - p.life;
        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.size * fade, 0, 6.28);
        bgCtx.fillStyle = `hsla(${p.hue},70%,60%,${0.25 * fade})`;
        bgCtx.fill();
      }

      // Spark bursts from tile hovers
      for (let i = sparkBursts.length - 1; i >= 0; i--) {
        const s = sparkBursts[i];
        s.x += s.vx; s.y += s.vy;
        s.vx *= 0.96; s.vy *= 0.96;
        s.life += 0.03;
        if (s.life > 1) { sparkBursts.splice(i, 1); continue; }
        const fade = 1 - s.life;
        bgCtx.beginPath();
        bgCtx.arc(s.x, s.y, s.size * fade, 0, 6.28);
        bgCtx.fillStyle = `rgba(168,85,247,${0.4 * fade})`;
        bgCtx.fill();
      }
    }

    if (expandedTile && expandedCtx) {
      drawFullScene(t, freq, bass, mid, treble);

      // --- Interactive scene click effects (scene-specific, drawn ON TOP) ---
      if (sceneClickEffects.length > 0) {
        const ctx = expandedCtx;
        for (let i = sceneClickEffects.length - 1; i >= 0; i--) {
          const e = sceneClickEffects[i];
          e.life += 0.018;
          if (e.life > 1) { sceneClickEffects.splice(i, 1); continue; }
          const fade = 1 - e.life;

          // Scene-specific origin effects
          if (e.type === 1 || e.type === 17) { // Ocean / Aquarium — ripple rings
            for (let r = 0; r < 4; r++) {
              const rr = e.life * (30 + r * 20);
              ctx.beginPath(); ctx.arc(e.x, e.y, rr, 0, 6.28);
              ctx.strokeStyle = `rgba(100,200,255,${0.12 * fade * (1 - r * 0.2)})`;
              ctx.lineWidth = 1.5 * fade; ctx.stroke();
            }
          } else if (e.type === 2) { // Campfire — warm glow
            const fg = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 40 * e.life);
            fg.addColorStop(0, `rgba(255,150,30,${0.15 * fade})`);
            fg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = fg; ctx.fillRect(e.x - 50, e.y - 50, 100, 100);
          } else if (e.type === 5) { // Lightning — flash
            if (e.life < 0.1) { ctx.fillStyle = `rgba(200,220,255,${0.08 * (1 - e.life * 10)})`; ctx.fillRect(0, 0, expandedTile.w, expandedTile.h); }
          } else if (e.type === 4) { // Desert — dust cloud
            ctx.beginPath(); ctx.arc(e.x, e.y, 20 + e.life * 40, 0, 6.28);
            ctx.fillStyle = `rgba(180,150,100,${0.04 * fade})`; ctx.fill();
          } else { // Default — subtle ring
            const rr = e.life * 50;
            ctx.beginPath(); ctx.arc(e.x, e.y, rr, 0, 6.28);
            ctx.strokeStyle = `rgba(255,255,255,${0.1 * fade})`;
            ctx.lineWidth = 1.5 * fade; ctx.stroke();
          }

          // Particles (use scene-specific colors/gravity)
          for (const p of e.particles) {
            p.x += p.vx; p.y += p.vy;
            p.vy += (p.gravity || 0.05);
            p.vx *= 0.98;
            const alpha = 0.5 * fade;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * fade, 0, 6.28);
            ctx.fillStyle = p.color.replace('A', alpha.toFixed(2));
            ctx.fill();
            // glow for embers/sparks
            if (e.type === 2 || e.type === 14 || e.type === 5) {
              ctx.shadowBlur = 4; ctx.shadowColor = p.color.replace('A', '0.5');
              ctx.fill(); ctx.shadowBlur = 0;
            }
          }
        }
      }
    }
  }

  /* ============== SCENE RENDERING (delegated to scenes.js) ============== */
  const SD = window.SCENE_DEFS;

  function createMiniParticles(type, res) {
    try { return SD ? SD.create(type, res, res) : { a: [], b: [], c: [] }; }
    catch(e) { return { a: [], b: [], c: [], p1: [], p2: [], extra: { angle: 0, val: 0, trail: [] } }; }
  }

  function createFullParticles(type, w, h) {
    return SD ? SD.create(type, w, h) : { a: [], b: [], c: [] };
  }

  function drawMiniScene(tile, t, bass, mid, treble) {
    const { ctx, canvas: cvs, type, colors, parts } = tile;
    const w = cvs.width, h = cvs.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a10';
    ctx.fillRect(0, 0, w, h);
    if (SD) {
      try { SD.drawMini(type, ctx, w, h, colors, t, parts, bass, mid); }
      catch(e) {
        // fallback: draw something visible so tile isn't just black
        const g = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w*0.4);
        g.addColorStop(0, hexToRGBA(colors[0], 0.15)); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      }
    }
  }

  function drawFullScene(t, freq, bass, mid, treble) {
    if (!expandedTile || !expandedCtx || !expandedParts) return;
    const ctx = expandedCtx;
    const W = expandedTile.w, H = expandedTile.h;
    if (!W || !H) return;
    const col = expandedTile.colors;
    const type = expandedTile.type;
    const p = expandedParts;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);
    if (SD) { try { SD.drawFull(type, ctx, W, H, col, t, p, bass, mid, treble); } catch(e) {} }
  }

  /* ============== VIEW HOOKS ============== */
  function onSearch(query) { searchQuery = query; buildTiles(); }
  function onTrackChange(index) { tiles.forEach(t => t.el.classList.toggle('playing', t.index === index)); }

  registerView('dimensions', { init, destroy, onSearch, onTrackChange });
})();
