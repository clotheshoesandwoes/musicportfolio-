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
      .dim-grid { display:flex; flex-wrap:wrap; gap:${TILE_GAP}px; padding:80px 20px 20px;
        justify-content:center; align-content:start; overflow-y:auto; height:100%; box-sizing:border-box; }
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
        z-index:2; pointer-events:none; opacity:0; transition:opacity .5s .2s; }
      .dim-overlay.visible .dim-overlay-info { opacity:1; }
      .dim-overlay-title { font-family:'Syne',sans-serif; font-size:36px; font-weight:700;
        color:#fff; letter-spacing:-0.02em; text-shadow:0 2px 20px rgba(0,0,0,0.5); }
      .dim-overlay-sub { font-family:'DM Sans',sans-serif; font-size:12px; color:rgba(255,255,255,0.4);
        margin-top:6px; }
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

    gridEl = document.createElement('div');
    gridEl.className = 'dim-grid';
    container.appendChild(gridEl);

    buildTiles();
    breathPhase = 0;
    lastMiniDraw = 0;
    rafId = requestAnimationFrame(animate);
  }

  function destroy() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    const s = document.getElementById('dimensionsStyle'); if (s) s.remove();
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    tiles = []; expandedTile = null; container = gridEl = null;
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
      sceneLbl.textContent = SCENE_NAMES[type];
      el.appendChild(sceneLbl);

      if (state.currentTrack === idx) el.classList.add('playing');

      el.addEventListener('click', () => expandTile(idx, type, colors, track.title));

      gridEl.appendChild(el);

      // persistent state for mini scene
      const parts = createMiniParticles(type, res);

      tiles.push({ el, canvas: cvs, ctx: cvs.getContext('2d'), index: idx,
        type, colors, parts, phase: (i % 10) * 0.5 + Math.floor(i / 10) * 0.3 });

      setTimeout(() => el.classList.remove('entering'), 25 + i * 15);
    });
  }


  /* ============== SCENE RENDERING (delegated to scenes.js) ============== */
  const SD = window.SCENE_DEFS;

  function createMiniParticles(type, res) {
    return SD ? SD.create(type, res, res) : { a: [], b: [], c: [] };
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
    if (SD) { try { SD.drawMini(type, ctx, w, h, colors, t, parts, bass, mid); } catch(e) {} }
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
