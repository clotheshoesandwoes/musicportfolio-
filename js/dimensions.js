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
  const SCENE_TYPES = 50;
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

  const SCENE_NAMES = ['Neon Horizon', 'Deep Ocean', 'Digital Void', 'Cosmic Drift', 'Crystal Cave',
    'Electric Storm', 'Organic Growth', 'Geometric Void', 'City Rain', 'Beach Midnight',
    'LA Sunset', 'Tokyo Neon', 'Desert Highway', 'Underwater Reef', 'Northern Lights',
    'Rainy Window', 'Vinyl Groove', 'Forest Canopy', 'Rooftop Night', 'Subway Tunnel',
    // 20-29
    'Rainy Alley', 'Chinatown', 'Freeway Overpass', 'Skatepark', 'Volcano',
    'Waterfall', 'Snowstorm', 'Meadow', 'Swamp', 'Canyon',
    // 30-39
    'Arcade', 'Laundromat', 'Aquarium', 'Recording Studio', 'Elevator',
    'Lava Lamp', 'Kaleidoscope', 'Circuit Board', 'Pendulum', 'Fractal Tree',
    // 40-49
    'Fog', 'Solar Eclipse', 'Meteor Shower', 'Tornado', 'Tidal Pool',
    'Bioluminescent Bay', 'Stairwell', 'Parking Garage', 'DNA Helix', 'Construction Site'];

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

  /* ============== MINI PARTICLE FACTORY ============== */
  function createMiniParticles(type, res) {
    const p = { a: [], b: [], c: [] };
    switch (type) {
      case 0: // neon horizon — grid + shapes
        for (let i = 0; i < 4; i++) p.a.push({ rot: Math.random() * 6.28, speed: (Math.random() - 0.5) * 0.01, sides: 3 + Math.floor(Math.random() * 3), x: Math.random(), y: 0.2 + Math.random() * 0.3, size: 8 + Math.random() * 12 });
        break;
      case 1: // deep ocean — bubbles
        for (let i = 0; i < 15; i++) p.a.push({ x: Math.random(), y: Math.random(), vy: -0.001 - Math.random() * 0.002, r: 1 + Math.random() * 3, wobble: Math.random() * 6.28 });
        break;
      case 2: // digital void — rain
        for (let i = 0; i < 15; i++) p.a.push({ x: Math.random(), y: Math.random(), speed: 0.003 + Math.random() * 0.005, len: 4 + Math.floor(Math.random() * 6) });
        break;
      case 3: // cosmic — stars
        for (let i = 0; i < 50; i++) p.a.push({ x: Math.random(), y: Math.random(), r: 0.3 + Math.random() * 1.5, tw: Math.random() * 6.28 });
        break;
      case 4: // crystal — formations
        for (let i = 0; i < 8; i++) p.a.push({ x: Math.random(), top: Math.random() > 0.5, len: 0.1 + Math.random() * 0.2, w: 0.01 + Math.random() * 0.02 });
        for (let i = 0; i < 15; i++) p.b.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.001, vy: (Math.random() - 0.5) * 0.001, hue: 180 + Math.random() * 60 });
        break;
      case 5: // storm — rain + bolt
        for (let i = 0; i < 30; i++) p.a.push({ x: Math.random(), y: Math.random(), vy: 0.008 + Math.random() * 0.01 });
        p.b.push({ life: 0, cd: 40 + Math.random() * 60, segs: [] });
        break;
      case 6: // organic — tendrils
        for (let i = 0; i < 4; i++) p.a.push({ ox: Math.random(), segs: 12, maxL: 0.2 + Math.random() * 0.2, ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 0.4 });
        for (let i = 0; i < 20; i++) p.b.push({ x: Math.random(), y: Math.random(), vy: -0.0005 - Math.random() * 0.001, a: 0.2 + Math.random() * 0.4 });
        break;
      case 7: // geometric — shapes
        for (let i = 0; i < 3; i++) p.a.push({ x: 0.2 + Math.random() * 0.6, y: 0.2 + Math.random() * 0.6, size: 15 + Math.random() * 25, rx: Math.random() * 3.14, ry: Math.random() * 3.14, srx: (Math.random() - 0.5) * 0.01, sry: (Math.random() - 0.5) * 0.013 });
        break;
      case 8: // city rain — buildings + rain
        for (let i = 0; i < 5; i++) p.a.push({ x: Math.random(), h: 0.2 + Math.random() * 0.4, w: 0.08 + Math.random() * 0.1, wins: 2 + Math.floor(Math.random() * 4) });
        for (let i = 0; i < 40; i++) p.b.push({ x: Math.random(), y: Math.random(), vy: 0.006 + Math.random() * 0.008 });
        break;
      case 9: // beach — waves + moon
        for (let i = 0; i < 30; i++) p.a.push({ x: Math.random(), y: Math.random() * 0.4, tw: Math.random() * 6.28 });
        break;
      case 10: // LA sunset — palms
        for (let i = 0; i < 4; i++) p.a.push({ x: 0.1 + Math.random() * 0.8, h: 0.15 + Math.random() * 0.25, fronds: 4 + Math.floor(Math.random() * 3) });
        break;
      case 11: // tokyo — buildings + signs
        for (let i = 0; i < 6; i++) p.a.push({ x: 0.05 + Math.random() * 0.9, h: 0.3 + Math.random() * 0.4, w: 0.04 + Math.random() * 0.06, hue: Math.random() * 360, fl: Math.random() * 6.28 });
        break;
      case 12: // desert — road + mountains
        for (let i = 0; i < 3; i++) p.a.push({ x: 0.15 + i * 0.3, h: 0.06 + Math.random() * 0.1 });
        for (let i = 0; i < 15; i++) p.b.push({ x: Math.random(), y: 0.55 + Math.random() * 0.35, vx: 0.0005 + Math.random() * 0.0008 });
        break;
      case 13: // reef — coral + fish
        for (let i = 0; i < 5; i++) p.a.push({ x: 0.1 + Math.random() * 0.8, y: 0.7 + Math.random() * 0.2, w: 0.06 + Math.random() * 0.08, h: 0.05 + Math.random() * 0.1, hue: 300 + Math.random() * 60, sw: Math.random() * 6.28 });
        for (let i = 0; i < 5; i++) p.b.push({ x: Math.random(), y: 0.3 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 0.001, size: 2 + Math.random() * 3 });
        break;
      case 14: // aurora — ribbons
        for (let i = 0; i < 3; i++) p.a.push({ off: Math.random() * 6.28, sp: 0.2 + Math.random() * 0.2, amp: 0.04 + Math.random() * 0.06, y: 0.15 + i * 0.1, hue: [120, 200, 280][i] });
        for (let i = 0; i < 25; i++) p.b.push({ x: Math.random(), y: Math.random(), vy: 0.0003 + Math.random() * 0.0006 });
        break;
      case 15: // rainy window — drops + bokeh
        for (let i = 0; i < 12; i++) p.a.push({ x: Math.random(), y: -Math.random() * 0.3, vy: 0.0005 + Math.random() * 0.0015, r: 2 + Math.random() * 4, trail: [], wb: Math.random() * 6.28 });
        for (let i = 0; i < 8; i++) p.b.push({ x: Math.random(), y: Math.random(), r: 6 + Math.random() * 15, hue: Math.random() * 360, a: 0.04 + Math.random() * 0.06 });
        break;
      case 16: // vinyl — record
        p.a.push({ angle: 0 });
        break;
      case 17: // forest — canopy + fireflies
        for (let i = 0; i < 20; i++) p.a.push({ x: Math.random(), y: Math.random(), pulse: Math.random() * 6.28, a: 0.3 + Math.random() * 0.5 });
        break;
      case 18: // rooftop — skyline + stars
        for (let i = 0; i < 6; i++) p.a.push({ x: Math.random(), h: 0.1 + Math.random() * 0.3, w: 0.04 + Math.random() * 0.06 });
        for (let i = 0; i < 30; i++) p.b.push({ x: Math.random(), y: Math.random() * 0.35, tw: Math.random() * 6.28 });
        break;
      case 19: // subway — tunnel lights
        for (let i = 0; i < 10; i++) p.a.push({ z: Math.random(), speed: 0.003 + Math.random() * 0.003, side: Math.random() > 0.5 ? 1 : -1, hue: Math.random() > 0.7 ? 40 : 200 });
        break;
      case 20: // rainy alley — puddles + dumpster + fire escape
        for (let i = 0; i < 50; i++) p.a.push({ x: Math.random(), y: Math.random(), vy: 0.006 + Math.random() * 0.008 });
        for (let i = 0; i < 4; i++) p.b.push({ x: 0.1 + Math.random() * 0.8, h: 0.3 + Math.random() * 0.35, w: 0.06 + Math.random() * 0.08 });
        break;
      case 21: // chinatown — lanterns + signs + steam
        for (let i = 0; i < 8; i++) p.a.push({ x: 0.1 + Math.random() * 0.8, y: 0.1 + Math.random() * 0.25, hue: Math.random() > 0.5 ? 0 : 40, swing: Math.random() * 6.28, size: 5 + Math.random() * 8 });
        for (let i = 0; i < 15; i++) p.b.push({ x: Math.random(), y: 1, vy: -0.001 - Math.random() * 0.002, size: 3 + Math.random() * 8, a: 0.05 + Math.random() * 0.1 });
        break;
      case 22: // freeway overpass — car lights streaking below
        for (let i = 0; i < 20; i++) p.a.push({ x: Math.random() > 0.5 ? -0.1 : 1.1, y: 0.6 + Math.random() * 0.15, vx: (Math.random() > 0.5 ? 1 : -1) * (0.002 + Math.random() * 0.004), hue: Math.random() > 0.5 ? 40 : 0, tail: 0.03 + Math.random() * 0.05 });
        break;
      case 23: // skatepark — ramps + graffiti splatters + lens flare
        for (let i = 0; i < 12; i++) p.a.push({ x: Math.random(), y: Math.random(), size: 3 + Math.random() * 8, hue: Math.random() * 360, a: 0.1 + Math.random() * 0.2 });
        for (let i = 0; i < 3; i++) p.b.push({ x1: Math.random() * 0.4, y1: 0.5 + Math.random() * 0.3, x2: 0.3 + Math.random() * 0.4, y2: 0.7 + Math.random() * 0.2 });
        break;
      case 24: // volcano — lava + smoke + embers
        for (let i = 0; i < 30; i++) p.a.push({ x: 0.4 + Math.random() * 0.2, y: 0.3 + Math.random() * 0.2, vx: (Math.random() - 0.5) * 0.003, vy: -0.001 - Math.random() * 0.003, size: 1 + Math.random() * 3, life: Math.random() });
        for (let i = 0; i < 8; i++) p.b.push({ x: 0.3 + Math.random() * 0.4, y: 0.4, vy: -0.0005 - Math.random() * 0.001, size: 10 + Math.random() * 20, a: 0.03 + Math.random() * 0.04 });
        break;
      case 25: // waterfall — flowing lines + mist + pool
        for (let i = 0; i < 40; i++) p.a.push({ x: 0.35 + Math.random() * 0.3, y: Math.random() * 0.6, vy: 0.003 + Math.random() * 0.006, a: 0.1 + Math.random() * 0.2 });
        for (let i = 0; i < 20; i++) p.b.push({ x: 0.25 + Math.random() * 0.5, y: 0.6 + Math.random() * 0.1, vx: (Math.random() - 0.5) * 0.001, vy: -0.0003 - Math.random() * 0.001, size: 2 + Math.random() * 4 });
        break;
      case 26: // snowstorm — heavy snow + wind + whiteout
        for (let i = 0; i < 80; i++) p.a.push({ x: Math.random(), y: Math.random(), vx: 0.001 + Math.random() * 0.002, vy: 0.001 + Math.random() * 0.003, size: 1 + Math.random() * 3 });
        break;
      case 27: // meadow — grass + flowers + butterflies + sun
        for (let i = 0; i < 15; i++) p.a.push({ x: Math.random(), phase: Math.random() * 6.28, hue: [40, 60, 300, 330, 280][Math.floor(Math.random() * 5)] });
        for (let i = 0; i < 4; i++) p.b.push({ x: Math.random(), y: 0.3 + Math.random() * 0.3, vx: (Math.random() - 0.5) * 0.001, wing: Math.random() * 6.28, hue: Math.random() * 360 });
        break;
      case 28: // swamp — fog layers + fireflies + gnarled trees
        for (let i = 0; i < 25; i++) p.a.push({ x: Math.random(), y: Math.random(), pulse: Math.random() * 6.28 });
        for (let i = 0; i < 5; i++) p.b.push({ x: Math.random(), h: 0.2 + Math.random() * 0.3, branches: 2 + Math.floor(Math.random() * 3) });
        break;
      case 29: // canyon — layered rock walls + eagles + dust
        for (let i = 0; i < 6; i++) p.a.push({ side: i % 2 === 0 ? -1 : 1, y: i * 0.15, w: 0.15 + Math.random() * 0.15, depth: Math.random() });
        for (let i = 0; i < 20; i++) p.b.push({ x: Math.random(), y: Math.random(), vx: 0.0003 + Math.random() * 0.0005, size: 1 + Math.random() * 2 });
        break;
      case 30: // arcade — cabinet glow + pixel rain + scanlines
        for (let i = 0; i < 6; i++) p.a.push({ x: 0.08 + i * 0.15, hue: Math.random() * 360, flicker: Math.random() * 6.28 });
        for (let i = 0; i < 30; i++) p.b.push({ x: Math.random(), y: Math.random(), vy: 0.002 + Math.random() * 0.004, char: String.fromCharCode(0x2580 + Math.floor(Math.random() * 16)), hue: Math.random() * 360 });
        break;
      case 31: // laundromat — spinning circles + warm light + bubbles
        for (let i = 0; i < 5; i++) p.a.push({ x: 0.1 + i * 0.18, y: 0.45, r: 12 + Math.random() * 6, speed: 0.02 + Math.random() * 0.02 });
        for (let i = 0; i < 15; i++) p.b.push({ x: Math.random(), y: Math.random(), vy: -0.0005 - Math.random() * 0.001, r: 1.5 + Math.random() * 3, wb: Math.random() * 6.28 });
        break;
      case 32: // aquarium — glass panels + tropical fish + blue light
        for (let i = 0; i < 10; i++) p.a.push({ x: Math.random(), y: 0.2 + Math.random() * 0.6, vx: (Math.random() - 0.5) * 0.001, size: 3 + Math.random() * 5, hue: Math.random() * 60 + 180, tail: Math.random() * 6.28 });
        for (let i = 0; i < 20; i++) p.b.push({ x: Math.random(), y: Math.random(), vy: -0.0003 - Math.random() * 0.0008, r: 1 + Math.random() * 2 });
        break;
      case 33: // recording studio — EQ bars + VU meters + waveform
        for (let i = 0; i < 24; i++) p.a.push({ x: i, h: 0.1 + Math.random() * 0.3, target: 0.1 + Math.random() * 0.3 });
        p.b.push({ needle: 0, target: 0.3 });
        break;
      case 34: // elevator — floor counter + doors + ambient hum lines
        p.a.push({ floor: 1, target: 1, doorOpen: 0 });
        for (let i = 0; i < 15; i++) p.b.push({ y: Math.random(), a: 0.02 + Math.random() * 0.04, speed: 0.5 + Math.random() * 1 });
        break;
      case 35: // lava lamp — floating blobs + warm glow
        for (let i = 0; i < 6; i++) p.a.push({ x: 0.3 + Math.random() * 0.4, y: Math.random(), vy: (Math.random() - 0.5) * 0.001, size: 15 + Math.random() * 25, hue: Math.random() * 40 + 10 });
        break;
      case 36: // kaleidoscope — rotating mirrored segments
        p.a.push({ angle: 0, segments: 6 + Math.floor(Math.random() * 6), innerR: 0.1, outerR: 0.4 });
        for (let i = 0; i < 20; i++) p.b.push({ r: 0.1 + Math.random() * 0.3, angle: Math.random() * 6.28, size: 2 + Math.random() * 5, hue: Math.random() * 360 });
        break;
      case 37: // circuit board — traces + nodes + data pulses
        for (let i = 0; i < 20; i++) p.a.push({ x: Math.random(), y: Math.random(), connections: Math.floor(Math.random() * 3) });
        for (let i = 0; i < 8; i++) p.b.push({ from: Math.floor(Math.random() * 20), to: Math.floor(Math.random() * 20), progress: Math.random(), speed: 0.005 + Math.random() * 0.01 });
        break;
      case 38: // pendulum — swinging weight + trail + tick marks
        p.a.push({ angle: 0, vel: 0, length: 0.35, trail: [] });
        break;
      case 39: // fractal tree — recursive branches + leaves
        p.a.push({ depth: 8, angle: Math.PI / 6, wind: 0 });
        for (let i = 0; i < 30; i++) p.b.push({ x: Math.random(), y: Math.random(), vy: 0.0002 + Math.random() * 0.0005, rot: Math.random() * 6.28 });
        break;
      case 40: // fog — layered fog banks + silhouettes
        for (let i = 0; i < 5; i++) p.a.push({ y: 0.3 + i * 0.12, speed: 0.1 + Math.random() * 0.2, offset: Math.random() * 100, a: 0.04 + Math.random() * 0.04 });
        for (let i = 0; i < 3; i++) p.b.push({ x: Math.random(), h: 0.1 + Math.random() * 0.15, w: 0.01 + Math.random() * 0.02 });
        break;
      case 41: // solar eclipse — corona + dark disk + flares
        p.a.push({ phase: 0 });
        for (let i = 0; i < 6; i++) p.b.push({ angle: Math.random() * 6.28, length: 20 + Math.random() * 40, width: 2 + Math.random() * 3, speed: (Math.random() - 0.5) * 0.005 });
        break;
      case 42: // meteor shower — streaks + radiant point + dust
        for (let i = 0; i < 8; i++) p.a.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, cd: Math.random() * 30 });
        for (let i = 0; i < 100; i++) p.b.push({ x: Math.random(), y: Math.random(), tw: Math.random() * 6.28 });
        break;
      case 43: // tornado — funnel + debris + dark sky
        for (let i = 0; i < 30; i++) p.a.push({ angle: Math.random() * 6.28, r: Math.random(), vy: -0.001 - Math.random() * 0.002, size: 1 + Math.random() * 3 });
        break;
      case 44: // tidal pool — ripples + starfish + anemones + shallow water
        for (let i = 0; i < 6; i++) p.a.push({ x: Math.random(), y: Math.random(), phase: Math.random() * 6.28, maxR: 10 + Math.random() * 20 });
        for (let i = 0; i < 8; i++) p.b.push({ x: Math.random(), y: Math.random(), type: Math.floor(Math.random() * 3), size: 3 + Math.random() * 5, hue: Math.random() * 60 + 280 });
        break;
      case 45: // bioluminescent bay — glowing water + ripples + kayak trail
        for (let i = 0; i < 60; i++) p.a.push({ x: Math.random(), y: 0.4 + Math.random() * 0.5, pulse: Math.random() * 6.28, size: 1 + Math.random() * 3 });
        p.b.push({ x: 0.2, y: 0.6, vx: 0.0005, trail: [] });
        break;
      case 46: // stairwell — perspective stairs + fluorescent + echo lines
        for (let i = 0; i < 15; i++) p.a.push({ step: i, flicker: Math.random() * 6.28 });
        break;
      case 47: // parking garage — concrete + fluorescent strips + car silhouettes
        for (let i = 0; i < 6; i++) p.a.push({ x: 0.05 + Math.random() * 0.9, w: 0.08 + Math.random() * 0.06, hue: [0, 210, 40, 120, 280, 0][i] });
        for (let i = 0; i < 4; i++) p.b.push({ y: 0.2 + i * 0.18, flicker: Math.random() * 6.28, br: 0.3 + Math.random() * 0.4 });
        break;
      case 48: // DNA helix — rotating double helix + base pair connections
        for (let i = 0; i < 20; i++) p.a.push({ y: i / 20, phase: i * 0.3 });
        break;
      case 49: // construction site — crane + sparks + framework
        for (let i = 0; i < 15; i++) p.a.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.003, vy: 0.001 + Math.random() * 0.003, life: Math.random(), size: 1 + Math.random() * 2 });
        p.b.push({ angle: 0, speed: 0.002 });
        break;
    }
    return p;
  }

  /* ============== EXPAND / COLLAPSE / NAVIGATE ============== */
  let expandedTrackListIndex = -1; // index into trackList (not originalIndex)

  function expandTile(trackIndex, type, colors, title) {
    if (typeof playTrack === 'function') playTrack(trackIndex);

    // find position in current trackList
    expandedTrackListIndex = trackList.findIndex(t => t.originalIndex === trackIndex);

    if (overlayEl) { document.removeEventListener('keydown', overlayEl._onKey); overlayEl.remove(); }
    overlayEl = document.createElement('div');
    overlayEl.className = 'dim-overlay';

    expandedCanvas = document.createElement('canvas');
    expandedCtx = expandedCanvas.getContext('2d');
    overlayEl.appendChild(expandedCanvas);

    const info = document.createElement('div');
    info.className = 'dim-overlay-info';
    info.id = 'dimOverlayInfo';
    info.innerHTML = `<div class="dim-overlay-title" id="dimExpTitle">${escapeHtml(title)}</div>
      <div class="dim-overlay-sub" id="dimExpSub">${SCENE_NAMES[type]}  ·  ◂ ▸ to navigate</div>`;
    overlayEl.appendChild(info);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'dim-overlay-close';
    closeBtn.textContent = '✕ close';
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeExpanded(); });
    overlayEl.appendChild(closeBtn);

    // prev/next buttons
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

    // size the canvas
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
  }

  function navigateExpanded(dir) {
    if (trackList.length === 0) return;
    expandedTrackListIndex = (expandedTrackListIndex + dir + trackList.length) % trackList.length;
    const track = trackList[expandedTrackListIndex];
    const idx = track.originalIndex;
    const type = sceneType(idx);
    const colors = getGradientColors(idx);

    if (typeof playTrack === 'function') playTrack(idx);

    // regenerate scene
    const ow = expandedTile.w, oh = expandedTile.h;
    expandedParts = createFullParticles(type, ow, oh);
    expandedTile = { trackIndex: idx, type, colors, title: track.title, w: ow, h: oh };

    // update labels
    const titleEl = document.getElementById('dimExpTitle');
    const subEl = document.getElementById('dimExpSub');
    if (titleEl) titleEl.textContent = track.title;
    if (subEl) subEl.textContent = SCENE_NAMES[type] + '  ·  ◂ ▸ to navigate';

    // update playing indicator on tiles
    tiles.forEach(t => t.el.classList.toggle('playing', t.index === idx));
  }

  function closeExpanded() {
    if (!overlayEl) return;
    document.removeEventListener('keydown', overlayEl._onKey);
    overlayEl.classList.remove('visible');
    setTimeout(() => { if (overlayEl) { overlayEl.remove(); overlayEl = null; } expandedTile = null; expandedCanvas = expandedCtx = expandedParts = null; }, 400);
  }

  /* ============== FULL PARTICLE FACTORY ============== */
  function createFullParticles(type, w, h) {
    const p = { a: [], b: [], c: [] };
    switch (type) {
      case 0: for (let i = 0; i < 12; i++) p.a.push({ x: Math.random(), y: 0.15 + Math.random() * 0.35, rot: Math.random() * 6.28, sp: (Math.random() - 0.5) * 0.012, sides: 3 + Math.floor(Math.random() * 4), size: 20 + Math.random() * 40 }); for (let i = 0; i < 60; i++) p.b.push({ x: Math.random(), y: Math.random(), vy: -0.0008 - Math.random() * 0.0012 }); break;
      case 1: for (let i = 0; i < 45; i++) p.a.push({ x: Math.random(), y: Math.random(), r: 2 + Math.random() * 7, vy: -0.0004 - Math.random() * 0.0016, wb: Math.random() * 6.28 }); for (let i = 0; i < 35; i++) p.b.push({ x: Math.random(), y: Math.random(), r: 1.5 + Math.random() * 3, pulse: Math.random() * 6.28, drift: (Math.random() - 0.5) * 0.0004 }); break;
      case 2: for (let i = 0; i < 40; i++) p.a.push({ x: Math.random(), y: Math.random(), speed: 0.002 + Math.random() * 0.004, chars: Array.from({ length: 12 + Math.floor(Math.random() * 10) }, () => String.fromCharCode(0x30A0 + Math.random() * 96)) }); for (let i = 0; i < 10; i++) p.b.push({ x: Math.random(), y: Math.random(), w: 0.04 + Math.random() * 0.1, h: 0.008 + Math.random() * 0.025, life: Math.random() }); break;
      case 3: for (let i = 0; i < 150; i++) p.a.push({ x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 2, br: 0.2 + Math.random() * 0.8, tw: Math.random() * 6.28 }); for (let i = 0; i < 4; i++) p.b.push({ active: false, x: 0, y: 0, angle: Math.PI * 0.6 + Math.random() * 0.5, speed: 0.004 + Math.random() * 0.004, life: 0, maxL: 0.5 + Math.random() * 0.5, cd: Math.random() * 120 }); break;
      case 4: for (let i = 0; i < 18; i++) p.a.push({ x: Math.random(), top: Math.random() > 0.5, len: 0.06 + Math.random() * 0.2, w: 0.008 + Math.random() * 0.025, hue: 180 + Math.random() * 60 }); for (let i = 0; i < 50; i++) p.b.push({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 3, vx: (Math.random() - 0.5) * 0.0008, vy: (Math.random() - 0.5) * 0.0008, hue: 180 + Math.random() * 60 }); break;
      case 5: for (let i = 0; i < 100; i++) p.a.push({ x: Math.random(), y: Math.random(), vy: 0.006 + Math.random() * 0.012 }); p.b.push({ segs: [], life: 0, cd: 40 + Math.random() * 70 }); break;
      case 6: for (let i = 0; i < 8; i++) p.a.push({ ox: Math.random(), oy: 0.88 + Math.random() * 0.12, segs: 20 + Math.floor(Math.random() * 15), maxL: 0.25 + Math.random() * 0.35, ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 0.5 }); for (let i = 0; i < 60; i++) p.b.push({ x: Math.random(), y: Math.random(), vy: -0.0003 - Math.random() * 0.001, a: 0.2 + Math.random() * 0.5 }); break;
      case 7: for (let i = 0; i < 6; i++) p.a.push({ x: 0.1 + Math.random() * 0.8, y: 0.1 + Math.random() * 0.8, size: 35 + Math.random() * 80, rx: Math.random() * 3.14, ry: Math.random() * 3.14, srx: (Math.random() - 0.5) * 0.008, sry: (Math.random() - 0.5) * 0.012, type: Math.floor(Math.random() * 3) }); break;
      case 8: for (let i = 0; i < 8; i++) p.a.push({ x: 0.05 + Math.random() * 0.9, h: 0.15 + Math.random() * 0.45, w: 0.03 + Math.random() * 0.06, wins: 3 + Math.floor(Math.random() * 6), floors: 4 + Math.floor(Math.random() * 8) }); for (let i = 0; i < 120; i++) p.b.push({ x: Math.random(), y: Math.random(), vy: 0.005 + Math.random() * 0.01 }); break;
      case 9: for (let i = 0; i < 80; i++) p.a.push({ x: Math.random(), y: Math.random() * 0.45, tw: Math.random() * 6.28 }); p.b.push({ angle: 0, sp: 0.3 }); break;
      case 10: for (let i = 0; i < 10; i++) p.a.push({ x: 0.05 + Math.random() * 0.9, h: 0.18 + Math.random() * 0.3, fronds: 5 + Math.floor(Math.random() * 4), lean: (Math.random() - 0.5) * 0.1 }); for (let i = 0; i < 5; i++) p.b.push({ x: Math.random(), y: 0.15 + Math.random() * 0.2, vx: 0.0003 + Math.random() * 0.0005, wing: Math.random() * 6.28 }); break;
      case 11: for (let i = 0; i < 14; i++) p.a.push({ x: 0.03 + Math.random() * 0.94, h: 0.3 + Math.random() * 0.5, w: 0.02 + Math.random() * 0.05, hue: Math.random() * 360, signs: 2 + Math.floor(Math.random() * 4), fl: Math.random() * 6.28 }); for (let i = 0; i < 8; i++) p.b.push({ x: Math.random(), y: 0.8 + Math.random() * 0.15, vx: 0.001 + Math.random() * 0.003, len: 0.05 + Math.random() * 0.1, hue: Math.random() * 360 }); break;
      case 12: for (let i = 0; i < 5; i++) p.a.push({ x: 0.1 + i * 0.2, h: 0.06 + Math.random() * 0.12 }); for (let i = 0; i < 50; i++) p.b.push({ x: Math.random(), y: 0.55 + Math.random() * 0.35, vx: 0.0005 + Math.random() * 0.0008, size: 1 + Math.random() * 2 }); break;
      case 13: for (let i = 0; i < 10; i++) p.a.push({ x: 0.05 + Math.random() * 0.9, y: 0.7 + Math.random() * 0.2, w: 0.05 + Math.random() * 0.08, h: 0.05 + Math.random() * 0.12, hue: 300 + Math.random() * 60, sw: Math.random() * 6.28 }); for (let i = 0; i < 12; i++) p.b.push({ x: Math.random(), y: 0.3 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 0.001, size: 3 + Math.random() * 5, tail: Math.random() * 6.28 }); break;
      case 14: for (let i = 0; i < 5; i++) p.a.push({ off: Math.random() * 6.28, sp: 0.2 + Math.random() * 0.3, amp: 0.05 + Math.random() * 0.1, y: 0.12 + i * 0.07, hue: [120, 160, 200, 280, 320][i] }); for (let i = 0; i < 80; i++) p.b.push({ x: Math.random(), y: Math.random(), vy: 0.0002 + Math.random() * 0.0007 }); break;
      case 15: for (let i = 0; i < 30; i++) p.a.push({ x: Math.random(), y: -Math.random() * 0.3, vy: 0.0005 + Math.random() * 0.002, r: 3 + Math.random() * 6, trail: [], wb: Math.random() * 6.28 }); for (let i = 0; i < 15; i++) p.b.push({ x: Math.random(), y: Math.random(), r: 10 + Math.random() * 30, hue: Math.random() * 360, a: 0.04 + Math.random() * 0.07 }); break;
      case 16: p.a.push({ angle: 0 }); for (let i = 0; i < 40; i++) p.b.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.0003, vy: -0.0001 - Math.random() * 0.0003, size: 0.5 + Math.random() * 1.5 }); break;
      case 17: for (let i = 0; i < 50; i++) p.a.push({ x: Math.random(), y: Math.random(), pulse: Math.random() * 6.28, a: 0.3 + Math.random() * 0.5 }); for (let i = 0; i < 5; i++) p.b.push({ x: Math.random(), y: 0.3 + Math.random() * 0.3, angle: Math.random() * 6.28, sp: 0.001 + Math.random() * 0.002 }); break;
      case 18: for (let i = 0; i < 12; i++) p.a.push({ x: 0.02 + Math.random() * 0.96, h: 0.1 + Math.random() * 0.35, w: 0.02 + Math.random() * 0.06, wins: 2 + Math.floor(Math.random() * 5) }); for (let i = 0; i < 100; i++) p.b.push({ x: Math.random(), y: Math.random() * 0.4, tw: Math.random() * 6.28 }); break;
      case 19: for (let i = 0; i < 20; i++) p.a.push({ z: Math.random(), speed: 0.003 + Math.random() * 0.004, side: Math.random() > 0.5 ? 1 : -1, hue: Math.random() > 0.7 ? 40 : 200 }); for (let i = 0; i < 6; i++) p.b.push({ z: Math.random(), fl: Math.random() * 6.28, br: 0.3 + Math.random() * 0.5 }); break;
      // For scenes 20-49, full particles mirror their mini particles but with more density
      default: {
        // Reuse the mini particle factory with larger counts for full screen
        const miniP = createMiniParticles(type, Math.max(w, 900));
        // Scale up particle counts by duplicating
        p.a = miniP.a;
        for (let i = 0; i < miniP.a.length; i++) p.a.push(Object.assign({}, miniP.a[i], { x: Math.random(), y: Math.random() }));
        p.b = miniP.b;
        if (miniP.c) p.c = miniP.c;
      } break;
    }
    return p;
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

    // breathe + beat on tiles
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const bs = 1 + Math.sin(breathPhase + tile.phase) * BREATH_AMP;
      const pulse = 1 + beatPulse * 0.05;
      if (!tile.el.matches(':hover')) tile.el.style.transform = `scale(${(bs * pulse).toFixed(4)})`;
    }

    // throttle mini canvas draws
    if (now - lastMiniDraw > MINI_INTERVAL) {
      lastMiniDraw = now;
      for (let i = 0; i < tiles.length; i++) drawMiniScene(tiles[i], t, bass, mid, treble);
    }

    // expanded view at full fps
    if (expandedTile && expandedCtx) drawFullScene(t, freq, bass, mid, treble);
  }

  /* ============== MINI SCENE RENDERERS ============== */
  function drawMiniScene(tile, t, bass, mid, treble) {
    const { ctx, canvas: cvs, type, colors, parts } = tile;
    const w = cvs.width, h = cvs.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a10';
    ctx.fillRect(0, 0, w, h);

    const col = colors;
    switch (type) {
      case 0: { // neon horizon
        const hor = h * 0.55;
        ctx.strokeStyle = hexToRGBA(col[0], 0.1); ctx.lineWidth = 0.4;
        for (let i = 1; i <= 10; i++) { const f = i / 10; ctx.beginPath(); ctx.moveTo(0, hor + f * f * (h - hor)); ctx.lineTo(w, hor + f * f * (h - hor)); ctx.stroke(); }
        for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(w / 2, hor); ctx.lineTo(w / 2 + i * (w / 5), h); ctx.stroke(); }
        const sr = 15 + bass * 8; const sg = ctx.createRadialGradient(w / 2, hor - 10, 0, w / 2, hor - 10, sr * 2); sg.addColorStop(0, hexToRGBA(col[0], 0.4)); sg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
        ctx.beginPath(); ctx.arc(w / 2, hor - 10, sr * 0.3, 0, Math.PI, true); ctx.fillStyle = hexToRGBA(col[0], 0.6); ctx.fill();
        for (const sh of parts.a) { sh.rot += sh.sp; ctx.save(); ctx.translate(sh.x * w + Math.sin(t * 0.2 + sh.rot) * 10, sh.y * h); ctx.rotate(sh.rot); ctx.strokeStyle = hexToRGBA(col[0], 0.2); ctx.lineWidth = 0.6; ctx.beginPath(); for (let v = 0; v <= sh.sides; v++) { const a = (v / sh.sides) * 6.28, px = Math.cos(a) * sh.size, py = Math.sin(a) * sh.size; v === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); } ctx.closePath(); ctx.stroke(); ctx.restore(); }
      } break;
      case 1: { // deep ocean
        const dg = ctx.createLinearGradient(0, 0, 0, h); dg.addColorStop(0, hexToRGBA(col[0], 0.05)); dg.addColorStop(1, hexToRGBA(col[1], 0.1)); ctx.fillStyle = dg; ctx.fillRect(0, 0, w, h);
        for (let l = 0; l < 3; l++) { ctx.beginPath(); for (let x = 0; x <= w; x += 3) { const y = 10 + l * 8 + Math.sin(x * 0.03 + t * (0.8 - l * 0.15)) * (4 + bass * 5); x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.strokeStyle = hexToRGBA(col[0], 0.08); ctx.lineWidth = 0.8; ctx.stroke(); }
        for (const b of parts.a) { b.y += b.vy; b.wb += 0.02; if (b.y < -0.05) { b.y = 1.05; b.x = Math.random(); } ctx.beginPath(); ctx.arc(b.x * w + Math.sin(b.wb) * 4, b.y * h, b.r, 0, 6.28); ctx.strokeStyle = hexToRGBA(col[0], 0.15); ctx.lineWidth = 0.5; ctx.stroke(); }
      } break;
      case 2: { // digital void
        for (let y = 0; y < h; y += 4) { ctx.fillStyle = `rgba(0,0,0,${0.06 + Math.sin(y * 0.15 + t * 4) * 0.03})`; ctx.fillRect(0, y, w, 1); }
        ctx.font = "9px 'JetBrains Mono',monospace";
        for (const c of parts.a) { c.y += c.speed * (1 + bass); if (c.y > 1.2) { c.y = -0.1; c.x = Math.random(); } for (let i = 0; i < c.len; i++) { const cy = (c.y - i * 0.03) * h; if (cy < 0 || cy > h) continue; ctx.fillStyle = i === 0 ? '#fff' : hexToRGBA(col[0], Math.max(0, 1 - i / c.len) * 0.5); ctx.fillText(String.fromCharCode(0x30A0 + Math.random() * 96), c.x * w, cy); } }
      } break;
      case 3: { // cosmic
        const cg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.45); cg.addColorStop(0, hexToRGBA(col[0], 0.06)); cg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = cg; ctx.fillRect(0, 0, w, h);
        for (const s of parts.a) { const tw = 0.3 + 0.7 * Math.sin(t * 1.3 + s.tw); ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r * (1 + beatPulse * 0.2), 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${tw * s.r * 0.2})`; ctx.fill(); }
      } break;
      case 4: { // crystal
        for (const f of parts.a) { const fx = f.x * w, fl = f.len * h * (1 + bass * 0.2), fw = f.w * w, fy = f.top ? 0 : h, dir = f.top ? 1 : -1; ctx.beginPath(); ctx.moveTo(fx - fw, fy); ctx.lineTo(fx, fy + fl * dir); ctx.lineTo(fx + fw, fy); ctx.closePath(); ctx.fillStyle = hexToRGBA(col[0], 0.12); ctx.fill(); }
        for (const g of parts.b) { g.x += g.vx; g.y += g.vy; if (g.x < 0) g.x = 1; if (g.x > 1) g.x = 0; if (g.y < 0) g.y = 1; if (g.y > 1) g.y = 0; ctx.beginPath(); ctx.arc(g.x * w, g.y * h, 1.5, 0, 6.28); ctx.fillStyle = `hsla(${g.hue},70%,60%,0.35)`; ctx.fill(); }
      } break;
      case 5: { // storm
        ctx.strokeStyle = hexToRGBA(col[0], 0.08); ctx.lineWidth = 0.5;
        for (const r of parts.a) { r.y += r.vy * (1 + bass); if (r.y > 1.05) { r.y = -0.05; r.x = Math.random(); } ctx.beginPath(); ctx.moveTo(r.x * w, r.y * h); ctx.lineTo(r.x * w - 0.3, r.y * h + 6); ctx.stroke(); }
        const bolt = parts.b[0]; bolt.cd--;
        if (bolt.cd <= 0) { bolt.segs = []; let lx = w * (0.2 + Math.random() * 0.6), ly = 0; while (ly < h * 0.8) { const nx = lx + (Math.random() - 0.5) * 30, ny = ly + 8 + Math.random() * 15; bolt.segs.push([lx, ly, nx, ny]); lx = nx; ly = ny; } bolt.life = 1; bolt.cd = 30 + Math.random() * 50; }
        if (bolt.life > 0) { bolt.life -= 0.04; ctx.strokeStyle = hexToRGBA(col[0], bolt.life * 0.6); ctx.lineWidth = 1.5 * bolt.life; for (const s of bolt.segs) { ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.stroke(); } }
      } break;
      case 6: { // organic
        for (const td of parts.a) { ctx.beginPath(); let tx = td.ox * w, ty = h * 0.92; ctx.moveTo(tx, ty); for (let s = 0; s < td.segs; s++) { const f = s / td.segs; const a = -Math.PI / 2 + Math.sin(t * 0.4 + td.ph + s * 0.25) * 0.3 * f; const sl = (td.maxL * h / td.segs) * Math.min(1, Math.sin(t * td.sp * 0.4) * 0.5 + 0.5 + f * 0.3); tx += Math.cos(a) * sl; ty += Math.sin(a) * sl; ctx.lineTo(tx, ty); } ctx.strokeStyle = hexToRGBA(col[0], 0.2); ctx.lineWidth = 1.5; ctx.stroke(); ctx.beginPath(); ctx.arc(tx, ty, 2 + mid * 3, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.4); ctx.fill(); }
        for (const sp of parts.b) { sp.y += sp.vy; if (sp.y < -0.05) { sp.y = 1.05; sp.x = Math.random(); } ctx.beginPath(); ctx.arc(sp.x * w + Math.sin(t + sp.a * 8) * 5, sp.y * h, 1, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], sp.a * 0.3); ctx.fill(); }
      } break;
      case 7: { // geometric
        ctx.strokeStyle = hexToRGBA(col[0], 0.03); ctx.lineWidth = 0.3;
        for (let x = 0; x < w; x += 20) for (let y = 0; y < h; y += 20) ctx.strokeRect(x + Math.sin(x * 0.01 + t) * 2, y + Math.cos(y * 0.01 + t * 0.7) * 2, 20, 20);
        for (const sh of parts.a) { sh.rx += sh.srx; sh.ry += sh.sry; const cx = sh.x * w, cy = sh.y * h; const vt = getVerts3(sh.type); const pr = vt.map(v => proj3(v, sh.rx, sh.ry, sh.size, cx, cy)); const ed = getEdges3(sh.type, vt.length); ctx.strokeStyle = hexToRGBA(col[0], 0.25); ctx.lineWidth = 0.6; for (const [a, b] of ed) { if (a >= pr.length || b >= pr.length) continue; ctx.beginPath(); ctx.moveTo(pr[a].x, pr[a].y); ctx.lineTo(pr[b].x, pr[b].y); ctx.stroke(); } }
      } break;
      case 8: { // city rain
        for (const b of parts.a) { ctx.fillStyle = 'rgba(12,12,20,0.8)'; ctx.fillRect(b.x * w, h - b.h * h, b.w * w, b.h * h); for (let f = 0; f < b.wins; f++) { const wy = h - b.h * h + 4 + f * (b.h * h / b.wins); ctx.fillStyle = Math.sin(t * 0.1 + f + b.x * 10) > 0 ? hexToRGBA(col[0], 0.15) : 'rgba(25,25,40,0.4)'; ctx.fillRect(b.x * w + 2, wy, b.w * w - 4, 2); } }
        ctx.strokeStyle = hexToRGBA(col[0], 0.07); ctx.lineWidth = 0.4;
        for (const r of parts.b) { r.y += r.vy * (1 + bass * 0.5); if (r.y > 1.05) { r.y = -0.05; r.x = Math.random(); } ctx.beginPath(); ctx.moveTo(r.x * w, r.y * h); ctx.lineTo(r.x * w, r.y * h + 5); ctx.stroke(); }
      } break;
      case 9: { // beach
        ctx.beginPath(); ctx.arc(w * 0.75, h * 0.15, 8, 0, 6.28); ctx.fillStyle = 'rgba(255,255,230,0.5)'; ctx.fill();
        for (const s of parts.a) { const tw = 0.3 + 0.7 * Math.sin(t * 1.5 + s.tw); ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r, 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${tw * 0.4})`; ctx.fill(); }
        const shore = h * 0.6;
        for (let l = 0; l < 4; l++) { ctx.beginPath(); for (let x = 0; x <= w; x += 3) { const y = shore + l * 10 + Math.sin(x * 0.02 + t * (0.6 - l * 0.1)) * (3 + bass * 4); x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.strokeStyle = hexToRGBA(col[0], 0.08); ctx.lineWidth = 0.6; ctx.stroke(); }
      } break;
      case 10: { // LA sunset
        const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6); sky.addColorStop(0, 'rgba(25,5,50,0.5)'); sky.addColorStop(0.5, hexToRGBA(col[0], 0.15)); sky.addColorStop(1, 'rgba(255,100,50,0.12)'); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
        ctx.beginPath(); ctx.arc(w * 0.6, h * 0.5, 12 + bass * 4, 0, 6.28); ctx.fillStyle = 'rgba(255,100,50,0.4)'; ctx.fill();
        ctx.fillStyle = 'rgba(8,6,12,0.6)'; ctx.fillRect(0, h * 0.6, w, h * 0.4);
        for (const p of parts.a) { const px = p.x * w, py = h * (0.6 - p.h), sway = Math.sin(t * 0.3 + p.x * 10) * 4; ctx.beginPath(); ctx.moveTo(px, h * 0.6); ctx.quadraticCurveTo(px + sway * 0.5, h * 0.6 - p.h * h * 0.5, px + sway, py); ctx.strokeStyle = 'rgba(8,6,12,0.8)'; ctx.lineWidth = 2; ctx.stroke(); for (let f = 0; f < p.fronds; f++) { const fa = (f / p.fronds) * 6.28 + t * 0.04; ctx.beginPath(); ctx.moveTo(px + sway, py); ctx.lineTo(px + sway + Math.cos(fa) * 15, py + Math.sin(fa) * 8 + Math.abs(Math.cos(fa)) * 8); ctx.strokeStyle = 'rgba(8,6,12,0.7)'; ctx.lineWidth = 1.2; ctx.stroke(); } }
      } break;
      case 11: { // tokyo
        for (const b of parts.a) { const bx = b.x * w, bh = b.h * h, bw = b.w * w; ctx.fillStyle = 'rgba(10,8,18,0.8)'; ctx.fillRect(bx, h - bh, bw, bh);
          for (let s = 0; s < 2; s++) { const sy = h - bh + 10 + s * (bh / 3); const flk = Math.sin(t * 3 + b.fl + s * 2) > -0.1 ? 1 : 0.1; ctx.fillStyle = `hsla(${(b.hue + s * 60) % 360},80%,60%,${0.12 * flk})`; ctx.fillRect(bx + 2, sy, bw - 4, 6); } }
        ctx.fillStyle = hexToRGBA(col[0], 0.015); ctx.fillRect(0, h * 0.85, w, h * 0.15);
      } break;
      case 12: { // desert
        for (const m of parts.a) { ctx.beginPath(); ctx.moveTo((m.x - 0.15) * w, h * 0.55); ctx.lineTo(m.x * w, h * (0.55 - m.h)); ctx.lineTo((m.x + 0.15) * w, h * 0.55); ctx.closePath(); ctx.fillStyle = hexToRGBA(col[1], 0.1); ctx.fill(); }
        ctx.fillStyle = hexToRGBA(col[1], 0.03); ctx.fillRect(0, h * 0.55, w, h * 0.45);
        ctx.beginPath(); ctx.moveTo(w * 0.43, h * 0.45); ctx.lineTo(0, h); ctx.lineTo(w, h); ctx.lineTo(w * 0.57, h * 0.45); ctx.closePath(); ctx.fillStyle = 'rgba(18,16,22,0.4)'; ctx.fill();
        for (const d of parts.b) { d.x += d.vx; if (d.x > 1.1) d.x = -0.1; ctx.beginPath(); ctx.arc(d.x * w, d.y * h, d.size, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.15); ctx.fill(); }
      } break;
      case 13: { // reef
        ctx.fillStyle = hexToRGBA('#0a2040', 0.15); ctx.fillRect(0, 0, w, h);
        for (const c of parts.a) { const cx = c.x * w, cy = c.y * h; ctx.beginPath(); ctx.ellipse(cx, cy, c.w * w, c.h * h, 0, 0, Math.PI); ctx.fillStyle = `hsla(${c.hue},60%,40%,0.15)`; ctx.fill(); }
        for (const f of parts.b) { f.x += f.vx; if (f.x > 1.1) f.x = -0.1; if (f.x < -0.1) f.x = 1.1; const fx = f.x * w, fy = f.y * h + Math.sin(t * 0.5 + f.x * 5) * 5; ctx.beginPath(); ctx.ellipse(fx, fy, f.size, f.size * 0.4, 0, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.2); ctx.fill(); }
      } break;
      case 14: { // aurora
        for (const r of parts.a) { ctx.beginPath(); for (let x = 0; x <= w; x += 3) { const y = r.y * h + Math.sin(x / w * 5 + t * r.sp + r.off) * r.amp * h; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.lineTo(w, r.y * h + 30); ctx.lineTo(0, r.y * h + 30); ctx.closePath(); ctx.fillStyle = `hsla(${r.hue},70%,55%,0.06)`; ctx.fill(); }
        ctx.fillStyle = 'rgba(5,5,10,0.6)'; ctx.fillRect(0, h * 0.82, w, h * 0.18);
        for (const s of parts.b) { s.y += s.vy; if (s.y > 1.05) { s.y = -0.05; s.x = Math.random(); } ctx.beginPath(); ctx.arc(s.x * w, s.y * h, 1, 0, 6.28); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill(); }
      } break;
      case 15: { // rainy window
        for (const l of parts.b) { const lg = ctx.createRadialGradient(l.x * w, l.y * h, 0, l.x * w, l.y * h, l.r); lg.addColorStop(0, `hsla(${l.hue},60%,50%,${l.a})`); lg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = lg; ctx.fillRect(l.x * w - l.r, l.y * h - l.r, l.r * 2, l.r * 2); }
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, w, h);
        for (const d of parts.a) { d.y += d.vy; d.wb += 0.025; if (d.y > 1.1) { d.y = -0.1; d.x = Math.random(); d.trail = []; } const dx = d.x * w + Math.sin(d.wb) * 2, dy = d.y * h; d.trail.push({ x: dx, y: dy }); if (d.trail.length > 12) d.trail.shift(); ctx.beginPath(); for (let i = 0; i < d.trail.length; i++) { i === 0 ? ctx.moveTo(d.trail[i].x, d.trail[i].y) : ctx.lineTo(d.trail[i].x, d.trail[i].y); } ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = d.r * 0.2; ctx.stroke(); ctx.beginPath(); ctx.arc(dx, dy, d.r * 0.4, 0, 6.28); ctx.fillStyle = 'rgba(200,220,255,0.1)'; ctx.fill(); }
      } break;
      case 16: { // vinyl
        const cx = w / 2, cy = h / 2, mr = Math.min(w, h) * 0.4;
        parts.a[0].angle += 0.006 + bass * 0.008;
        ctx.beginPath(); ctx.arc(cx, cy, mr, 0, 6.28); ctx.fillStyle = 'rgba(15,15,15,0.8)'; ctx.fill();
        for (let r = mr * 0.2; r < mr * 0.95; r += 3) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.28); ctx.strokeStyle = `rgba(35,35,35,${0.03 + Math.sin(r * 0.5 + t * 2) * 0.02})`; ctx.lineWidth = 0.4; ctx.stroke(); }
        ctx.beginPath(); ctx.arc(cx, cy, mr * 0.15, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.35); ctx.fill();
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(parts.a[0].angle); const lg = ctx.createLinearGradient(-mr, 0, mr, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.49, 'rgba(255,255,255,0.03)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.06)'); lg.addColorStop(0.51, 'rgba(255,255,255,0.03)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = lg; ctx.fillRect(-mr, -mr, mr * 2, mr * 2); ctx.restore();
      } break;
      case 17: { // forest
        ctx.fillStyle = hexToRGBA('#0a1a0a', 0.2); ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(18,12,8,0.2)'; ctx.fillRect(w * (0.15 + i * 0.3), 0, 3, h); }
        for (const ff of parts.a) { ff.pulse += 0.015; const glow = 0.5 + 0.5 * Math.sin(ff.pulse); ctx.beginPath(); ctx.arc(ff.x * w, ff.y * h, 1.5 + mid, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], ff.a * glow * 0.4); ctx.fill(); }
      } break;
      case 18: { // rooftop
        for (const s of parts.b) { const tw = 0.3 + 0.7 * Math.sin(t * 1.5 + s.tw); ctx.beginPath(); ctx.arc(s.x * w, s.y * h, 0.8, 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${tw * 0.4})`; ctx.fill(); }
        for (const b of parts.a) { ctx.fillStyle = 'rgba(8,8,15,0.7)'; ctx.fillRect(b.x * w, h * 0.55 - b.h * h, b.w * w, b.h * h + h * 0.45); for (let f = 0; f < b.wins; f++) { ctx.fillStyle = Math.sin(t * 0.08 + f + b.x * 10) > 0.2 ? hexToRGBA(col[0], 0.1) : 'rgba(12,12,20,0.3)'; ctx.fillRect(b.x * w + 1, h * 0.55 - b.h * h + 3 + f * (b.h * h / b.wins), b.w * w - 2, 2); } }
        ctx.fillStyle = 'rgba(12,12,18,0.5)'; ctx.fillRect(0, h * 0.55, w, h * 0.45);
      } break;
      case 19: { // subway
        const cx = w / 2, cy = h * 0.42, ow = w * 0.45, iw = w * 0.08, ih = h * 0.06;
        ctx.beginPath(); ctx.moveTo(cx - ow, h); ctx.lineTo(cx - iw, cy - ih); ctx.lineTo(cx + iw, cy - ih); ctx.lineTo(cx + ow, h); ctx.closePath(); ctx.fillStyle = 'rgba(15,13,20,0.6)'; ctx.fill();
        for (const lt of parts.a) { lt.z += lt.speed * (1 + bass); if (lt.z > 1) lt.z = Math.random() * 0.1; const f = lt.z; const px = lerp(iw, ow, f) * lt.side; const ly = lerp(cy, lt.side > 0 ? h * 0.3 : h * 0.7, f); ctx.beginPath(); ctx.arc(cx + px, ly, 1.5 + f * 3, 0, 6.28); ctx.fillStyle = `hsla(${lt.hue},60%,60%,${(1 - f) * 0.3})`; ctx.fill(); }
        const vg = ctx.createRadialGradient(cx, cy, 0, cx, cy, iw * 2); vg.addColorStop(0, hexToRGBA(col[0], 0.06)); vg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = vg; ctx.fillRect(cx - iw * 2, cy - ih * 2, iw * 4, ih * 4);
      } break;
      // === SCENES 20-49: mini renderers ===
      // Each draws a simplified version capturing the scene's visual identity
      default: {
        // Generic renderer for scenes 20-49 — each has its own visual
        const sc = type;
        if (sc === 20) { // rainy alley
          for (const b of parts.b) { ctx.fillStyle = 'rgba(15,12,20,0.8)'; ctx.fillRect(b.x * w, h - b.h * h, b.w * w, b.h * h); }
          ctx.strokeStyle = hexToRGBA(col[0], 0.08); ctx.lineWidth = 0.4;
          for (const r of parts.a) { r.y += r.vy * (1 + bass * 0.5); if (r.y > 1.05) { r.y = -0.05; r.x = Math.random(); } ctx.beginPath(); ctx.moveTo(r.x * w, r.y * h); ctx.lineTo(r.x * w, r.y * h + 5); ctx.stroke(); }
          ctx.fillStyle = hexToRGBA(col[0], 0.03); ctx.fillRect(0, h * 0.8, w, h * 0.2);
        } else if (sc === 21) { // chinatown
          ctx.fillStyle = 'rgba(15,8,8,0.3)'; ctx.fillRect(0, 0, w, h);
          for (const l of parts.a) { l.swing += 0.01; const lx = l.x * w + Math.sin(l.swing) * 3, ly = l.y * h; ctx.beginPath(); ctx.arc(lx, ly, l.size, 0, 6.28); ctx.fillStyle = `hsla(${l.hue},80%,50%,0.3)`; ctx.fill(); ctx.shadowBlur = 8; ctx.shadowColor = `hsl(${l.hue},80%,50%)`; ctx.beginPath(); ctx.arc(lx, ly, l.size * 0.6, 0, 6.28); ctx.fill(); ctx.shadowBlur = 0; }
          for (const s of parts.b) { s.y += s.vy; if (s.y < -0.1) { s.y = 1.1; s.x = Math.random(); } ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.size, 0, 6.28); ctx.fillStyle = `rgba(200,200,200,${s.a})`; ctx.fill(); }
        } else if (sc === 22) { // freeway overpass
          ctx.fillStyle = 'rgba(20,18,25,0.4)'; ctx.fillRect(0, h * 0.5, w, h * 0.25);
          for (const c of parts.a) { c.x += c.vx; if (c.x > 1.2) c.x = -0.2; if (c.x < -0.2) c.x = 1.2; ctx.beginPath(); ctx.moveTo(c.x * w, c.y * h); ctx.lineTo((c.x - c.tail * Math.sign(c.vx)) * w, c.y * h); ctx.strokeStyle = `hsla(${c.hue},70%,60%,0.2)`; ctx.lineWidth = 1.5; ctx.stroke(); }
          ctx.fillStyle = 'rgba(10,10,15,0.5)'; ctx.fillRect(0, h * 0.45, w, 6);
        } else if (sc === 23) { // skatepark
          ctx.fillStyle = 'rgba(15,15,20,0.3)'; ctx.fillRect(0, h * 0.65, w, h * 0.35);
          for (const b of parts.b) { ctx.beginPath(); ctx.moveTo(b.x1 * w, b.y1 * h); ctx.quadraticCurveTo((b.x1 + b.x2) / 2 * w, (b.y1 - 0.1) * h, b.x2 * w, b.y2 * h); ctx.strokeStyle = hexToRGBA(col[0], 0.15); ctx.lineWidth = 1; ctx.stroke(); }
          for (const s of parts.a) { ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.size, 0, 6.28); ctx.fillStyle = `hsla(${s.hue},70%,60%,${s.a})`; ctx.fill(); }
        } else if (sc === 24) { // volcano
          ctx.beginPath(); ctx.moveTo(w * 0.2, h); ctx.lineTo(w * 0.45, h * 0.35); ctx.lineTo(w * 0.55, h * 0.35); ctx.lineTo(w * 0.8, h); ctx.closePath(); ctx.fillStyle = 'rgba(30,15,10,0.6)'; ctx.fill();
          const lg = ctx.createRadialGradient(w / 2, h * 0.3, 0, w / 2, h * 0.3, 30); lg.addColorStop(0, hexToRGBA(col[0], 0.3 + bass * 0.2)); lg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
          for (const e of parts.a) { e.x += e.vx; e.y += e.vy; e.life += 0.01; if (e.life > 1) { e.x = 0.4 + Math.random() * 0.2; e.y = 0.3; e.life = 0; } ctx.beginPath(); ctx.arc(e.x * w, e.y * h, e.size * (1 - e.life), 0, 6.28); ctx.fillStyle = `rgba(255,${100 + Math.floor(e.life * 100)},0,${0.4 * (1 - e.life)})`; ctx.fill(); }
        } else if (sc === 25) { // waterfall
          ctx.fillStyle = hexToRGBA(col[0], 0.04); ctx.fillRect(w * 0.3, 0, w * 0.4, h * 0.65);
          for (const d of parts.a) { d.y += d.vy; if (d.y > 0.65) { d.y = Math.random() * 0.1; } ctx.beginPath(); ctx.moveTo(d.x * w, d.y * h); ctx.lineTo(d.x * w, d.y * h + 8); ctx.strokeStyle = hexToRGBA(col[0], d.a); ctx.lineWidth = 0.6; ctx.stroke(); }
          ctx.fillStyle = hexToRGBA(col[0], 0.06); ctx.fillRect(w * 0.2, h * 0.65, w * 0.6, h * 0.35);
          for (const m of parts.b) { m.y += m.vy; m.x += m.vx; if (m.y < 0.4) { m.y = 0.65; m.x = 0.35 + Math.random() * 0.3; } ctx.beginPath(); ctx.arc(m.x * w, m.y * h, m.size, 0, 6.28); ctx.fillStyle = 'rgba(200,220,255,0.08)'; ctx.fill(); }
        } else if (sc === 26) { // snowstorm
          for (const s of parts.a) { s.x += s.vx; s.y += s.vy; if (s.y > 1.05) { s.y = -0.05; s.x = Math.random(); } if (s.x > 1.05) s.x = -0.05; ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.size, 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.2})`; ctx.fill(); }
          ctx.fillStyle = 'rgba(200,210,220,0.02)'; ctx.fillRect(0, 0, w, h);
        } else if (sc === 27) { // meadow
          const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55); sky.addColorStop(0, 'rgba(100,180,255,0.08)'); sky.addColorStop(1, 'rgba(200,230,200,0.05)'); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = 'rgba(40,80,20,0.15)'; ctx.fillRect(0, h * 0.55, w, h * 0.45);
          for (const f of parts.a) { const fx = f.x * w, fy = h * 0.55 - 3 + Math.sin(t * 0.5 + f.phase) * 2; ctx.beginPath(); ctx.arc(fx, fy, 2, 0, 6.28); ctx.fillStyle = `hsla(${f.hue},70%,60%,0.4)`; ctx.fill(); }
          for (const b of parts.b) { b.x += b.vx; b.wing += 0.05; if (b.x > 1.1) b.x = -0.1; const bx = b.x * w, by = b.y * h + Math.sin(t * 0.8 + b.x * 5) * 5; ctx.beginPath(); ctx.moveTo(bx - 3, by); ctx.quadraticCurveTo(bx, by - 3 * Math.sin(b.wing), bx + 3, by); ctx.strokeStyle = `hsla(${b.hue},70%,60%,0.4)`; ctx.lineWidth = 0.8; ctx.stroke(); }
        } else if (sc === 28) { // swamp
          ctx.fillStyle = 'rgba(5,15,5,0.2)'; ctx.fillRect(0, 0, w, h);
          for (const tr of parts.b) { const tx = tr.x * w; ctx.fillStyle = 'rgba(20,12,8,0.3)'; ctx.fillRect(tx - 2, h * (0.4 - tr.h), 4, tr.h * h + h * 0.6); for (let b = 0; b < tr.branches; b++) { const by = h * (0.4 - tr.h) + b * 15; ctx.beginPath(); ctx.moveTo(tx, by); ctx.lineTo(tx + (b % 2 === 0 ? 1 : -1) * 12, by - 8); ctx.strokeStyle = 'rgba(20,12,8,0.3)'; ctx.lineWidth = 1.5; ctx.stroke(); } }
          for (const ff of parts.a) { ff.pulse += 0.015; const glow = 0.5 + 0.5 * Math.sin(ff.pulse); ctx.beginPath(); ctx.arc(ff.x * w, ff.y * h, 1.5, 0, 6.28); ctx.fillStyle = `rgba(100,255,50,${0.3 * glow})`; ctx.fill(); }
          ctx.fillStyle = 'rgba(5,15,5,0.04)'; for (let i = 0; i < 3; i++) { const fy = h * (0.6 + i * 0.1) + Math.sin(t * 0.2 + i) * 5; ctx.fillRect(0, fy, w, 15); }
        } else if (sc === 29) { // canyon
          for (const wall of parts.a) { const wx = wall.side > 0 ? w - wall.w * w : 0; ctx.fillStyle = hexToRGBA(col[1], 0.08 + wall.depth * 0.05); ctx.fillRect(wx, wall.y * h, wall.w * w, h); }
          ctx.fillStyle = hexToRGBA(col[0], 0.04); const cg = ctx.createLinearGradient(0, 0, 0, h * 0.3); cg.addColorStop(0, hexToRGBA(col[0], 0.06)); cg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = cg; ctx.fillRect(0, 0, w, h * 0.3);
          for (const d of parts.b) { d.x += d.vx; if (d.x > 1.1) d.x = -0.1; ctx.beginPath(); ctx.arc(d.x * w, d.y * h, d.size, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.15); ctx.fill(); }
        } else if (sc === 30) { // arcade
          for (let y = 0; y < h; y += 3) { ctx.fillStyle = `rgba(0,0,0,${0.04 + Math.sin(y * 0.2 + t * 3) * 0.02})`; ctx.fillRect(0, y, w, 1); }
          for (const cab of parts.a) { const cx = cab.x * w; ctx.fillStyle = 'rgba(10,10,15,0.7)'; ctx.fillRect(cx, h * 0.3, w * 0.1, h * 0.5); const flk = Math.sin(t * 2 + cab.flicker) > 0 ? 1 : 0.3; ctx.fillStyle = `hsla(${cab.hue},80%,50%,${0.15 * flk})`; ctx.fillRect(cx + 2, h * 0.32, w * 0.1 - 4, h * 0.15); }
          for (const px of parts.b) { px.y += px.vy; if (px.y > 1.05) { px.y = -0.05; px.x = Math.random(); } ctx.font = '7px monospace'; ctx.fillStyle = `hsla(${px.hue},80%,60%,0.3)`; ctx.fillText(px.char, px.x * w, px.y * h); }
        } else if (sc === 31) { // laundromat
          ctx.fillStyle = 'rgba(20,18,15,0.15)'; ctx.fillRect(0, 0, w, h);
          for (const m of parts.a) { ctx.beginPath(); ctx.arc(m.x * w, m.y * h, m.r, 0, 6.28); ctx.strokeStyle = 'rgba(100,100,110,0.2)'; ctx.lineWidth = 1.5; ctx.stroke(); const ia = t * m.speed; for (let s = 0; s < 4; s++) { const a = ia + s * 1.57; ctx.beginPath(); ctx.arc(m.x * w + Math.cos(a) * m.r * 0.5, m.y * h + Math.sin(a) * m.r * 0.5, 2, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.2); ctx.fill(); } }
          for (const b of parts.b) { b.y += b.vy; b.wb += 0.02; if (b.y < -0.05) { b.y = 1.05; b.x = Math.random(); } ctx.beginPath(); ctx.arc(b.x * w + Math.sin(b.wb) * 3, b.y * h, b.r, 0, 6.28); ctx.strokeStyle = 'rgba(200,220,255,0.1)'; ctx.lineWidth = 0.4; ctx.stroke(); }
        } else if (sc === 32) { // aquarium
          ctx.fillStyle = hexToRGBA('#061830', 0.2); ctx.fillRect(0, 0, w, h);
          for (const f of parts.a) { f.x += f.vx; f.tail += 0.06; if (f.x > 1.1) f.x = -0.1; if (f.x < -0.1) f.x = 1.1; const fx = f.x * w, fy = f.y * h + Math.sin(t * 0.4 + f.x * 5) * 8; ctx.beginPath(); ctx.ellipse(fx, fy, f.size, f.size * 0.4, 0, 0, 6.28); ctx.fillStyle = `hsla(${f.hue},60%,50%,0.25)`; ctx.fill(); }
          for (const b of parts.b) { b.y += b.vy; if (b.y < -0.05) { b.y = 1.05; b.x = Math.random(); } ctx.beginPath(); ctx.arc(b.x * w, b.y * h, b.r, 0, 6.28); ctx.strokeStyle = 'rgba(150,200,255,0.1)'; ctx.lineWidth = 0.4; ctx.stroke(); }
        } else if (sc === 33) { // recording studio
          for (let i = 0; i < parts.a.length; i++) { const bar = parts.a[i]; bar.h = lerp(bar.h, bar.target, 0.05); if (Math.random() < 0.02) bar.target = 0.05 + Math.random() * 0.5 + mid * 0.3; const bx = (i / parts.a.length) * w + 2, bw = w / parts.a.length - 3; ctx.fillStyle = hexToRGBA(col[0], 0.3 + bar.h * 0.3); ctx.fillRect(bx, h - bar.h * h * 0.6, bw, bar.h * h * 0.6); }
        } else if (sc === 34) { // elevator
          const el = parts.a[0]; el.floor = lerp(el.floor, el.target, 0.01); if (Math.random() < 0.005) el.target = 1 + Math.floor(Math.random() * 20);
          ctx.fillStyle = 'rgba(20,20,25,0.3)'; ctx.fillRect(w * 0.2, h * 0.1, w * 0.6, h * 0.8);
          ctx.font = "bold 24px 'JetBrains Mono',monospace"; ctx.textAlign = 'center'; ctx.fillStyle = hexToRGBA(col[0], 0.4); ctx.fillText(Math.floor(el.floor).toString(), w / 2, h * 0.4);
          for (const l of parts.b) { const ly = l.y * h; ctx.strokeStyle = hexToRGBA(col[0], l.a + Math.sin(t * l.speed + l.y * 10) * 0.01); ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(w * 0.25, ly); ctx.lineTo(w * 0.75, ly); ctx.stroke(); }
        } else if (sc === 35) { // lava lamp
          for (const blob of parts.a) { blob.y += blob.vy; if (blob.y < 0.1 || blob.y > 0.9) blob.vy *= -1; blob.vy += (Math.random() - 0.5) * 0.0001; const bx = blob.x * w + Math.sin(t * 0.5 + blob.y * 5) * 10; const g = ctx.createRadialGradient(bx, blob.y * h, 0, bx, blob.y * h, blob.size); g.addColorStop(0, `hsla(${blob.hue},80%,50%,0.3)`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(bx - blob.size, blob.y * h - blob.size, blob.size * 2, blob.size * 2); }
        } else if (sc === 36) { // kaleidoscope
          const k = parts.a[0]; k.angle += 0.003; const cx = w / 2, cy = h / 2;
          for (let s = 0; s < k.segments; s++) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(k.angle + s * (6.28 / k.segments));
            for (const dot of parts.b) { const dx = Math.cos(dot.angle + t * 0.3) * dot.r * w * 0.4, dy = Math.sin(dot.angle + t * 0.3) * dot.r * h * 0.4; ctx.beginPath(); ctx.arc(dx, dy, dot.size, 0, 6.28); ctx.fillStyle = `hsla(${(dot.hue + t * 20) % 360},70%,55%,0.15)`; ctx.fill(); }
          ctx.restore(); }
        } else if (sc === 37) { // circuit board
          ctx.strokeStyle = hexToRGBA(col[0], 0.08); ctx.lineWidth = 0.5;
          for (let i = 0; i < parts.a.length; i++) { const n = parts.a[i]; ctx.beginPath(); ctx.arc(n.x * w, n.y * h, 2, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.2); ctx.fill(); for (let j = i + 1; j < Math.min(i + 3, parts.a.length); j++) { const m = parts.a[j]; if (Math.abs(n.x - m.x) + Math.abs(n.y - m.y) < 0.4) { ctx.beginPath(); ctx.moveTo(n.x * w, n.y * h); ctx.lineTo(n.x * w, m.y * h); ctx.lineTo(m.x * w, m.y * h); ctx.stroke(); } } }
          for (const p of parts.b) { p.progress += p.speed; if (p.progress > 1) { p.progress = 0; p.from = Math.floor(Math.random() * parts.a.length); p.to = Math.floor(Math.random() * parts.a.length); } const f = parts.a[p.from] || parts.a[0], tt = parts.a[p.to] || parts.a[1]; const px = lerp(f.x, tt.x, p.progress) * w, py = lerp(f.y, tt.y, p.progress) * h; ctx.beginPath(); ctx.arc(px, py, 1.5, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.5); ctx.fill(); }
        } else if (sc === 38) { // pendulum
          const pd = parts.a[0]; pd.vel += -Math.sin(pd.angle) * 0.0008; pd.vel *= 0.998; pd.angle += pd.vel;
          const cx = w / 2, cy = h * 0.1, bx = cx + Math.sin(pd.angle) * pd.length * h, by = cy + Math.cos(pd.angle) * pd.length * h;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx, by); ctx.strokeStyle = hexToRGBA(col[0], 0.3); ctx.lineWidth = 1; ctx.stroke();
          ctx.beginPath(); ctx.arc(bx, by, 6, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.4); ctx.fill();
          pd.trail.push({ x: bx, y: by }); if (pd.trail.length > 30) pd.trail.shift();
          ctx.beginPath(); for (let i = 0; i < pd.trail.length; i++) { i === 0 ? ctx.moveTo(pd.trail[i].x, pd.trail[i].y) : ctx.lineTo(pd.trail[i].x, pd.trail[i].y); } ctx.strokeStyle = hexToRGBA(col[0], 0.08); ctx.lineWidth = 0.5; ctx.stroke();
        } else if (sc === 39) { // fractal tree
          const ft = parts.a[0]; ft.wind = Math.sin(t * 0.3) * 0.05;
          function drawBranch(x, y, len, angle, depth) { if (depth <= 0 || len < 2) return; const ex = x + Math.cos(angle) * len, ey = y + Math.sin(angle) * len; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.strokeStyle = hexToRGBA(col[0], 0.1 + (ft.depth - depth) * 0.02); ctx.lineWidth = depth * 0.3; ctx.stroke(); drawBranch(ex, ey, len * 0.7, angle - ft.angle + ft.wind, depth - 1); drawBranch(ex, ey, len * 0.7, angle + ft.angle + ft.wind, depth - 1); }
          drawBranch(w / 2, h * 0.9, h * 0.18, -Math.PI / 2, Math.min(ft.depth, 7));
          for (const l of parts.b) { l.y += l.vy; l.rot += 0.01; if (l.y > 1.05) { l.y = -0.05; l.x = Math.random(); } ctx.save(); ctx.translate(l.x * w, l.y * h); ctx.rotate(l.rot); ctx.beginPath(); ctx.ellipse(0, 0, 2, 1, 0, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.15); ctx.fill(); ctx.restore(); }
        } else if (sc === 40) { // fog
          for (const f of parts.a) { ctx.beginPath(); for (let x = 0; x <= w; x += 4) { const y = f.y * h + Math.sin(x * 0.01 + t * f.speed + f.offset) * 15 + Math.sin(x * 0.025 + t * f.speed * 0.7) * 8; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fillStyle = `rgba(180,190,200,${f.a})`; ctx.fill(); }
          for (const s of parts.b) { ctx.fillStyle = 'rgba(15,15,20,0.3)'; ctx.fillRect(s.x * w - s.w * w, h * (0.5 - s.h), s.w * w * 2, s.h * h); }
        } else if (sc === 41) { // solar eclipse
          const cx = w / 2, cy = h * 0.4;
          const cg = ctx.createRadialGradient(cx, cy, 15, cx, cy, 50); cg.addColorStop(0, 'rgba(0,0,0,0)'); cg.addColorStop(0.3, hexToRGBA(col[0], 0.15)); cg.addColorStop(0.6, hexToRGBA(col[0], 0.05)); cg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = cg; ctx.fillRect(0, 0, w, h);
          ctx.beginPath(); ctx.arc(cx, cy, 12, 0, 6.28); ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fill();
          for (const f of parts.b) { f.angle += f.speed; const fx = cx + Math.cos(f.angle) * (15 + f.length * 0.3), fy = cy + Math.sin(f.angle) * (15 + f.length * 0.3); ctx.beginPath(); ctx.moveTo(cx + Math.cos(f.angle) * 14, cy + Math.sin(f.angle) * 14); ctx.lineTo(fx, fy); ctx.strokeStyle = hexToRGBA(col[0], 0.15); ctx.lineWidth = f.width * 0.3; ctx.stroke(); }
        } else if (sc === 42) { // meteor shower
          for (const s of parts.b) { const tw = 0.3 + 0.7 * Math.sin(t * 1.3 + s.tw); ctx.beginPath(); ctx.arc(s.x * w, s.y * h, 0.8, 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${tw * 0.4})`; ctx.fill(); }
          for (const m of parts.a) { m.cd--; if (!m.active && m.cd <= 0) { m.active = true; m.x = 0.2 + Math.random() * 0.6; m.y = Math.random() * 0.3; m.vx = 0.003 + Math.random() * 0.003; m.vy = 0.002 + Math.random() * 0.004; m.life = 0; m.cd = 20 + Math.random() * 60; }
            if (m.active) { m.life += 0.02; m.x += m.vx; m.y += m.vy; const fade = m.life < 0.1 ? m.life * 10 : Math.max(0, 1 - m.life); ctx.beginPath(); ctx.moveTo(m.x * w, m.y * h); ctx.lineTo((m.x - m.vx * 15) * w, (m.y - m.vy * 15) * h); ctx.strokeStyle = `rgba(255,255,255,${fade * 0.5})`; ctx.lineWidth = 1.5; ctx.stroke(); if (m.life > 0.8) m.active = false; } }
        } else if (sc === 43) { // tornado
          const cx = w / 2, topY = h * 0.15, botY = h * 0.85;
          for (const d of parts.a) { d.angle += 0.04 + d.r * 0.02; d.r = Math.min(1, d.r + 0.001); const frac = d.r; const rr = frac * 30 + 3; const py = lerp(topY, botY, frac); const px = cx + Math.cos(d.angle) * rr; ctx.beginPath(); ctx.arc(px, py, d.size, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.2 * (1 - frac * 0.5)); ctx.fill(); if (d.r >= 1) { d.r = 0; d.angle = Math.random() * 6.28; } }
          ctx.fillStyle = 'rgba(20,15,10,0.03)'; ctx.fillRect(0, 0, w, h);
        } else if (sc === 44) { // tidal pool
          ctx.fillStyle = hexToRGBA(col[0], 0.03); ctx.fillRect(0, 0, w, h);
          for (const r of parts.a) { r.phase += 0.015; const ring = (Math.sin(r.phase) * 0.5 + 0.5) * r.maxR; ctx.beginPath(); ctx.arc(r.x * w, r.y * h, ring, 0, 6.28); ctx.strokeStyle = hexToRGBA(col[0], 0.08 * (1 - ring / r.maxR)); ctx.lineWidth = 0.5; ctx.stroke(); }
          for (const c of parts.b) { ctx.beginPath(); if (c.type === 0) { for (let a = 0; a < 5; a++) { const ax = c.x * w + Math.cos(a * 1.26) * c.size, ay = c.y * h + Math.sin(a * 1.26) * c.size; ctx.moveTo(c.x * w, c.y * h); ctx.lineTo(ax, ay); } ctx.strokeStyle = `hsla(${c.hue},60%,50%,0.2)`; ctx.lineWidth = 1; ctx.stroke(); } else { ctx.arc(c.x * w, c.y * h, c.size, 0, 6.28); ctx.fillStyle = `hsla(${c.hue},60%,50%,0.15)`; ctx.fill(); } }
        } else if (sc === 45) { // bioluminescent bay
          ctx.fillStyle = hexToRGBA('#051525', 0.15); ctx.fillRect(0, 0, w, h);
          for (const g of parts.a) { g.pulse += 0.012; const glow = 0.3 + 0.7 * Math.sin(g.pulse); ctx.beginPath(); ctx.arc(g.x * w, g.y * h, g.size, 0, 6.28); ctx.shadowBlur = 5; ctx.shadowColor = '#00ffaa'; ctx.fillStyle = `rgba(0,255,170,${0.15 * glow})`; ctx.fill(); } ctx.shadowBlur = 0;
          const k = parts.b[0]; k.x += k.vx; if (k.x > 1) k.x = 0; k.trail.push({ x: k.x, y: k.y }); if (k.trail.length > 30) k.trail.shift();
          ctx.beginPath(); for (let i = 0; i < k.trail.length; i++) { i === 0 ? ctx.moveTo(k.trail[i].x * w, k.trail[i].y * h) : ctx.lineTo(k.trail[i].x * w, k.trail[i].y * h); } ctx.strokeStyle = 'rgba(0,255,170,0.08)'; ctx.lineWidth = 2; ctx.stroke();
        } else if (sc === 46) { // stairwell
          const cx = w / 2;
          for (const st of parts.a) { const sy = h * (0.1 + st.step * 0.055); const sw = w * (0.6 - st.step * 0.02); ctx.fillStyle = `rgba(25,25,30,${0.2 + st.step * 0.03})`; ctx.fillRect(cx - sw / 2, sy, sw, 6); ctx.fillStyle = `rgba(25,25,30,${0.15 + st.step * 0.02})`; ctx.fillRect(cx - sw / 2, sy + 6, sw, h * 0.055 - 6);
            if (st.step % 3 === 0) { const fl = Math.sin(t * 2 + st.flicker) > 0.8 ? 0.2 : 1; ctx.fillStyle = `rgba(200,220,255,${0.03 * fl})`; ctx.fillRect(cx - sw * 0.3, sy - 2, sw * 0.6, 2); } }
        } else if (sc === 47) { // parking garage
          ctx.fillStyle = 'rgba(20,20,22,0.3)'; ctx.fillRect(0, 0, w, h);
          for (const fl of parts.b) { const flk = Math.sin(t * 1.5 + fl.flicker) > 0.9 ? 0.1 : 1; ctx.fillStyle = `rgba(200,220,255,${0.04 * fl.br * flk})`; ctx.fillRect(w * 0.1, fl.y * h, w * 0.8, 2); }
          for (const car of parts.a) { ctx.fillStyle = `hsla(${car.hue},50%,30%,0.15)`; ctx.fillRect(car.x * w, h * 0.65, car.w * w, h * 0.1); ctx.fillRect(car.x * w + car.w * w * 0.15, h * 0.58, car.w * w * 0.7, h * 0.07); }
          // concrete pillars
          for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(30,30,32,0.3)'; ctx.fillRect(w * (0.15 + i * 0.22), 0, 5, h); }
        } else if (sc === 48) { // DNA helix
          const cx = w / 2;
          for (const bp of parts.a) { const py = bp.y * h + (t * 20) % h; const y = ((py % h) + h) % h; const phase = bp.phase + t * 0.5; const x1 = cx + Math.sin(phase) * w * 0.2, x2 = cx + Math.sin(phase + Math.PI) * w * 0.2;
            ctx.beginPath(); ctx.arc(x1, y, 2, 0, 6.28); ctx.fillStyle = hexToRGBA(col[0], 0.35); ctx.fill();
            ctx.beginPath(); ctx.arc(x2, y, 2, 0, 6.28); ctx.fillStyle = hexToRGBA(col[1], 0.35); ctx.fill();
            if (Math.sin(phase * 2) > 0.5) { ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.strokeStyle = hexToRGBA(col[0], 0.1); ctx.lineWidth = 0.5; ctx.stroke(); } }
        } else if (sc === 49) { // construction site
          // crane
          const cr = parts.b[0]; cr.angle += cr.speed * 0.002;
          ctx.strokeStyle = 'rgba(60,60,50,0.3)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(w * 0.3, h); ctx.lineTo(w * 0.3, h * 0.1); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.12); ctx.lineTo(w * 0.3 + Math.cos(cr.angle) * w * 0.35, h * 0.12); ctx.stroke();
          // framework
          for (let i = 0; i < 4; i++) { ctx.strokeStyle = 'rgba(50,50,45,0.15)'; ctx.lineWidth = 0.5; ctx.strokeRect(w * (0.45 + i * 0.1), h * 0.4, w * 0.08, h * 0.5); }
          // sparks
          for (const s of parts.a) { s.x += s.vx; s.y += s.vy; s.life += 0.01; if (s.life > 1) { s.x = 0.5 + Math.random() * 0.2; s.y = 0.4 + Math.random() * 0.2; s.vx = (Math.random() - 0.5) * 0.003; s.vy = 0.001 + Math.random() * 0.003; s.life = 0; }
            ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.size * (1 - s.life), 0, 6.28); ctx.fillStyle = `rgba(255,200,50,${0.4 * (1 - s.life)})`; ctx.fill(); }
        }
      } break;
    }
  }

  // 3D helpers for geometric void mini
  function getVerts3(t) { if (t === 0) return [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]; if (t === 1) return [[0,-1,0],[1,0,0],[0,0,1],[-1,0,0],[0,0,-1],[0,1,0]]; const v = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.28, r = i % 2 === 0 ? 1 : 0.6; v.push([Math.cos(a) * r, Math.sin(a) * r, i < 6 ? -0.5 : 0.5]); } return v; }
  function getEdges3(t, n) { if (t === 0) return [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]; if (t === 1) return [[0,1],[0,2],[0,3],[0,4],[5,1],[5,2],[5,3],[5,4],[1,2],[2,3],[3,4],[4,1]]; const e = []; for (let i = 0; i < n; i++) e.push([i, (i + 1) % n]); for (let i = 0; i < 6; i++) e.push([i, i + 6]); return e; }
  function proj3(v, rx, ry, s, cx, cy) { let x = v[0] * Math.cos(ry) - v[2] * Math.sin(ry), z = v[0] * Math.sin(ry) + v[2] * Math.cos(ry), y = v[1]; const y2 = y * Math.cos(rx) - z * Math.sin(rx), z2 = y * Math.sin(rx) + z * Math.cos(rx), p = 3 / (3 + z2); return { x: cx + x * s * p, y: cy + y2 * s * p }; }

  /* ============== FULL SCENE RENDERER (expanded) ============== */
  function drawFullScene(t, freq, bass, mid, treble) {
    // delegate to tape-spine's scene renderers via the shared view
    // For the expanded view, we reuse the full tape-spine drawScene logic
    // by calling into the tapespine view's registered scene functions.
    // Since tapespine.js is an IIFE, we recreate the full renderers inline here.
    // This is the expanded version — same as tape-spine's full renderers.
    const ctx = expandedCtx;
    const W = expandedTile.w, H = expandedTile.h;
    const col = expandedTile.colors;
    const type = expandedTile.type;
    const p = expandedParts;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    // Call the appropriate full scene based on type
    // These mirror the tape-spine full renderers
    switch (type) {
      case 0: drawFullNeonHorizon(ctx, W, H, col, t, bass, mid, p); break;
      case 1: drawFullDeepOcean(ctx, W, H, col, t, bass, mid, p); break;
      case 2: drawFullDigitalVoid(ctx, W, H, col, t, bass, treble, p); break;
      case 3: drawFullCosmicDrift(ctx, W, H, col, t, bass, mid, p); break;
      case 4: drawFullCrystalCave(ctx, W, H, col, t, bass, treble, p); break;
      case 5: drawFullElectricStorm(ctx, W, H, col, t, bass, mid, p); break;
      case 6: drawFullOrganicGrowth(ctx, W, H, col, t, bass, mid, p); break;
      case 7: drawFullGeometricVoid(ctx, W, H, col, t, bass, treble, p); break;
      case 8: drawFullCityRain(ctx, W, H, col, t, bass, mid, p); break;
      case 9: drawFullBeachMidnight(ctx, W, H, col, t, bass, mid, p); break;
      case 10: drawFullLASunset(ctx, W, H, col, t, bass, mid, p); break;
      case 11: drawFullTokyoNeon(ctx, W, H, col, t, bass, mid, p); break;
      case 12: drawFullDesertHighway(ctx, W, H, col, t, bass, mid, p); break;
      case 13: drawFullUnderwaterReef(ctx, W, H, col, t, bass, mid, p); break;
      case 14: drawFullNorthernLights(ctx, W, H, col, t, bass, mid, p); break;
      case 15: drawFullRainyWindow(ctx, W, H, col, t, bass, mid, p); break;
      case 16: drawFullVinylGroove(ctx, W, H, col, t, bass, mid, p); break;
      case 17: drawFullForestCanopy(ctx, W, H, col, t, bass, mid, p); break;
      case 18: drawFullRooftopNight(ctx, W, H, col, t, bass, mid, p); break;
      case 19: drawFullSubwayTunnel(ctx, W, H, col, t, bass, mid, p); break;
      default: {
        // Scenes 20-49: reuse mini renderer at full viewport resolution
        drawMiniScene({ ctx, canvas: { width: W, height: H }, type, colors: col, parts: p, phase: 0 }, t, bass, mid, treble);
      } break;
    }
  }

  // === FULL SCENE RENDERERS (expanded overlay) ===
  // These are the rich, detailed versions shown when you click into a tile.
  // They mirror tape-spine.js renderers but are self-contained here.

  function drawFullNeonHorizon(c, W, H, col, t, bass, mid, p) {
    const hor = H * 0.55; c.strokeStyle = hexToRGBA(col[0], 0.12 + bass * 0.1); c.lineWidth = 0.5;
    for (let i = 1; i <= 25; i++) { const f = i / 25; c.beginPath(); c.moveTo(0, hor + f * f * (H - hor)); c.lineTo(W, hor + f * f * (H - hor)); c.stroke(); }
    for (let i = -12; i <= 12; i++) { c.beginPath(); c.moveTo(W / 2, hor); c.lineTo(W / 2 + i * (W / 12), H); c.stroke(); }
    const sr = 55 + bass * 25; const sg = c.createRadialGradient(W / 2, hor - 35, 0, W / 2, hor - 35, sr * 2.5); sg.addColorStop(0, hexToRGBA(col[0], 0.5)); sg.addColorStop(0.5, hexToRGBA(col[1], 0.12)); sg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sg; c.fillRect(0, 0, W, H);
    c.beginPath(); c.arc(W / 2, hor - 35, sr * 0.4, 0, Math.PI, true); c.fillStyle = hexToRGBA(col[0], 0.7); c.fill();
    for (const sh of p.a) { sh.rot += sh.sp; c.save(); c.translate(sh.x * W + Math.sin(t * 0.2 + sh.rot) * 25, sh.y * H + Math.cos(t * 0.15 + sh.rot * 0.7) * 12); c.rotate(sh.rot); c.strokeStyle = hexToRGBA(col[0], 0.25 + mid * 0.25); c.lineWidth = 1; c.beginPath(); for (let v = 0; v <= sh.sides; v++) { const a = (v / sh.sides) * 6.28, px = Math.cos(a) * sh.size, py = Math.sin(a) * sh.size; v === 0 ? c.moveTo(px, py) : c.lineTo(px, py); } c.closePath(); c.stroke(); c.restore(); }
    for (const pt of p.b) { pt.y += pt.vy; if (pt.y < -0.05) { pt.y = 1.05; pt.x = Math.random(); } c.beginPath(); c.arc(pt.x * W + Math.sin(t * 1.5 + pt.x * 8) * 20, pt.y * H, 1.5, 0, 6.28); c.fillStyle = hexToRGBA(col[0], 0.25); c.fill(); }
  }
  function drawFullDeepOcean(c, W, H, col, t, bass, mid, p) {
    const dg = c.createLinearGradient(0, 0, 0, H); dg.addColorStop(0, hexToRGBA(col[0], 0.06)); dg.addColorStop(1, hexToRGBA(col[1], 0.12)); c.fillStyle = dg; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 7; i++) { const bx = W * (0.08 + i * 0.13) + Math.sin(t * 0.25 + i) * 50; const bw = 18 + Math.sin(t * 0.4 + i * 2) * 12 + bass * 25; const g = c.createLinearGradient(bx, 0, bx + bw * 2, H); g.addColorStop(0, hexToRGBA(col[0], 0.05)); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(bx, 0); c.lineTo(bx + bw, 0); c.lineTo(bx + bw * 2, H); c.lineTo(bx - bw * 0.5, H); c.closePath(); c.fill(); }
    for (let l = 0; l < 4; l++) { c.beginPath(); for (let x = 0; x <= W; x += 3) { const y = 25 + l * 12 + Math.sin(x * 0.013 + t * (1 - l * 0.15)) * (7 + bass * 8); x === 0 ? c.moveTo(x, y) : c.lineTo(x, y); } c.strokeStyle = hexToRGBA(col[0], 0.1); c.lineWidth = 1; c.stroke(); }
    for (const b of p.a) { b.y += b.vy; b.wb += 0.02; if (b.y < -0.05) { b.y = 1.05; b.x = Math.random(); } const bx = b.x * W + Math.sin(b.wb) * 10; c.beginPath(); c.arc(bx, b.y * H, b.r * (1 + bass * 0.4), 0, 6.28); c.strokeStyle = hexToRGBA(col[0], 0.2); c.lineWidth = 0.7; c.stroke(); c.beginPath(); c.arc(bx - b.r * 0.3, b.y * H - b.r * 0.3, b.r * 0.2, 0, 6.28); c.fillStyle = 'rgba(255,255,255,0.2)'; c.fill(); }
    for (const bl of p.b) { bl.x += bl.drift; bl.pulse += 0.015; if (bl.x < -0.05) bl.x = 1.05; if (bl.x > 1.05) bl.x = -0.05; c.beginPath(); c.arc(bl.x * W, bl.y * H, bl.r + mid * 3, 0, 6.28); c.shadowBlur = 10 + mid * 12; c.shadowColor = col[0]; c.fillStyle = hexToRGBA(col[0], 0.25 + 0.3 * Math.sin(bl.pulse)); c.fill(); } c.shadowBlur = 0;
  }
  function drawFullDigitalVoid(c, W, H, col, t, bass, treble, p) { for (let y = 0; y < H; y += 3) { c.fillStyle = `rgba(0,0,0,${0.07 + Math.sin(y * 0.1 + t * 4) * 0.03})`; c.fillRect(0, y, W, 1); } c.font = "13px 'JetBrains Mono',monospace"; for (const r of p.a) { r.y += r.speed * (1 + bass * 1.5); if (r.y > 1.3) { r.y = -0.2; r.x = Math.random(); } const cx = r.x * W; for (let i = 0; i < r.chars.length; i++) { const cy = (r.y - i * 0.022) * H; if (cy < 0 || cy > H) continue; c.fillStyle = i === 0 ? '#fff' : hexToRGBA(col[0], Math.max(0, 1 - i / r.chars.length) * 0.6); if (Math.random() < 0.015) r.chars[i] = String.fromCharCode(0x30A0 + Math.random() * 96); c.fillText(r.chars[i], cx, cy); } } for (const g of p.b) { g.life += 0.007 + treble * 0.015; if (g.life > 1) { g.x = Math.random(); g.y = Math.random(); g.life = 0; } if (g.life < 0.1 || (g.life > 0.4 && g.life < 0.5)) { c.fillStyle = hexToRGBA(col[0], 0.08 + bass * 0.12); c.fillRect(g.x * W, g.y * H, g.w * W, g.h * H); } } }
  function drawFullCosmicDrift(c, W, H, col, t, bass, mid, p) { const cg = c.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.4); cg.addColorStop(0, hexToRGBA(col[0], 0.08 + bass * 0.08)); cg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = cg; c.fillRect(0, 0, W, H); for (let arm = 0; arm < 3; arm++) { c.beginPath(); for (let i = 0; i < 250; i++) { const f = i / 250, a = f * Math.PI * 3.5 + t * 0.08 + arm * 2.09, r = f * W * 0.42; c.lineTo(W / 2 + Math.cos(a) * r, H * 0.45 + Math.sin(a) * r * 0.55); } c.strokeStyle = hexToRGBA(col[0], 0.05 + bass * 0.03); c.lineWidth = 2.5; c.stroke(); } for (const s of p.a) { const tw = 0.3 + 0.7 * Math.sin(t * 1.3 + s.tw); c.beginPath(); c.arc(s.x * W, s.y * H, s.r * (1 + beatPulse * 0.2), 0, 6.28); c.fillStyle = `rgba(255,255,255,${s.br * tw * 0.7})`; c.fill(); } for (const ss of p.b) { ss.cd--; if (!ss.active && ss.cd <= 0) { ss.active = true; ss.life = 0; ss.x = Math.random(); ss.y = Math.random() * 0.3; ss.cd = 80 + Math.random() * 160; } if (ss.active) { ss.life += 0.012; const hx = ss.x * W + Math.cos(ss.angle) * ss.life * W * 0.5, hy = ss.y * H + Math.sin(ss.angle) * ss.life * H * 0.5; const fade = ss.life < 0.1 ? ss.life * 10 : Math.max(0, 1 - (ss.life - 0.3) / 0.7); c.beginPath(); c.moveTo(hx - Math.cos(ss.angle) * 70, hy - Math.sin(ss.angle) * 70); c.lineTo(hx, hy); const sg = c.createLinearGradient(hx - Math.cos(ss.angle) * 70, hy - Math.sin(ss.angle) * 70, hx, hy); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(1, `rgba(255,255,255,${fade * 0.6})`); c.strokeStyle = sg; c.lineWidth = 2; c.stroke(); if (ss.life > ss.maxL) ss.active = false; } } }
  function drawFullCrystalCave(c, W, H, col, t, bass, treble, p) { const ag = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.5); ag.addColorStop(0, hexToRGBA(col[0], 0.03)); ag.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = ag; c.fillRect(0, 0, W, H); for (const f of p.a) { const fx = f.x * W, fl = f.len * H * (1 + bass * 0.25), fw = f.w * W, fy = f.top ? 0 : H, dir = f.top ? 1 : -1; c.beginPath(); c.moveTo(fx - fw, fy); c.lineTo(fx, fy + fl * dir); c.lineTo(fx + fw, fy); c.closePath(); const fg = c.createLinearGradient(fx, fy, fx, fy + fl * dir * 0.5); fg.addColorStop(0, hexToRGBA(col[0], 0.15)); fg.addColorStop(1, hexToRGBA(col[1], 0.04)); c.fillStyle = fg; c.fill(); c.strokeStyle = hexToRGBA(col[0], 0.08 + treble * 0.15); c.lineWidth = 0.8; c.stroke(); } for (let i = 0; i < 5; i++) { const a = t * 0.15 + i * 1.25; c.beginPath(); c.moveTo(W / 2, H / 2); c.lineTo(W / 2 + Math.cos(a) * W * 0.3, H / 2 + Math.sin(a) * H * 0.3); c.strokeStyle = hexToRGBA(col[0], 0.04 + treble * 0.06); c.lineWidth = 1 + treble * 2; c.stroke(); } for (const g of p.b) { g.x += g.vx; g.y += g.vy; if (g.x < 0) g.x = 1; if (g.x > 1) g.x = 0; if (g.y < 0) g.y = 1; if (g.y > 1) g.y = 0; c.beginPath(); c.arc(g.x * W, g.y * H, g.r, 0, 6.28); c.shadowBlur = 6; c.shadowColor = `hsl(${g.hue},70%,60%)`; c.fillStyle = `hsla(${g.hue},70%,60%,0.4)`; c.fill(); } c.shadowBlur = 0; }
  function drawFullElectricStorm(c, W, H, col, t, bass, mid, p) { for (let cl = 0; cl < 4; cl++) { c.beginPath(); for (let x = 0; x <= W; x += 4) { const y = 15 + cl * 35 + Math.sin(x * 0.006 + t * 0.25 + cl) * 25; x === 0 ? c.moveTo(x, y) : c.lineTo(x, y); } c.lineTo(W, 0); c.lineTo(0, 0); c.closePath(); c.fillStyle = hexToRGBA(col[1], 0.04 + cl * 0.015); c.fill(); } c.strokeStyle = hexToRGBA(col[0], 0.12); c.lineWidth = 0.7; for (const r of p.a) { r.y += r.vy * (1 + bass * 1.5); if (r.y > 1.05) { r.y = -0.05; r.x = Math.random(); } c.beginPath(); c.moveTo(r.x * W, r.y * H); c.lineTo(r.x * W - 0.5, r.y * H + 15); c.stroke(); } const bolt = p.b[0]; bolt.cd--; if (bolt.cd <= 0 || (bass > 0.35 && bolt.cd < 15)) { bolt.segs = []; let lx = W * (0.15 + Math.random() * 0.7), ly = 0; while (ly < H * 0.85) { const nx = lx + (Math.random() - 0.5) * 70, ny = ly + 15 + Math.random() * 45; bolt.segs.push([lx, ly, nx, ny]); if (Math.random() < 0.35) bolt.segs.push([nx, ny, nx + (Math.random() - 0.5) * 90, ny + 25 + Math.random() * 50]); lx = nx; ly = ny; } bolt.life = 1; bolt.cd = 35 + Math.random() * 70; } if (bolt.life > 0) { bolt.life -= 0.035; c.strokeStyle = hexToRGBA(col[0], bolt.life * 0.7); c.lineWidth = 2.5 * bolt.life; c.shadowBlur = 25 * bolt.life; c.shadowColor = col[0]; for (const s of bolt.segs) { c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); c.stroke(); } c.shadowBlur = 0; if (bolt.life > 0.7) { c.fillStyle = hexToRGBA(col[0], (bolt.life - 0.7) * 0.12); c.fillRect(0, 0, W, H); } } }
  function drawFullOrganicGrowth(c, W, H, col, t, bass, mid, p) { const gg = c.createLinearGradient(0, H * 0.65, 0, H); gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(1, hexToRGBA(col[1], 0.08)); c.fillStyle = gg; c.fillRect(0, 0, W, H); for (const td of p.a) { c.beginPath(); let tx = td.ox * W, ty = td.oy * H; c.moveTo(tx, ty); for (let s = 0; s < td.segs; s++) { const f = s / td.segs, grow = Math.min(1, Math.sin(t * td.sp * 0.4) * 0.5 + 0.5 + f * 0.3), a = -Math.PI / 2 + Math.sin(t * 0.4 + td.ph + s * 0.25) * 0.35 * f, sl = (td.maxL * H / td.segs) * grow; tx += Math.cos(a) * sl; ty += Math.sin(a) * sl * (1 + bass * 0.4); c.lineTo(tx, ty); } c.strokeStyle = hexToRGBA(col[0], 0.2 + mid * 0.15); c.lineWidth = 2; c.stroke(); c.beginPath(); c.arc(tx, ty, 3 + mid * 5, 0, 6.28); c.shadowBlur = 8 + bass * 12; c.shadowColor = col[0]; c.fillStyle = hexToRGBA(col[0], 0.45); c.fill(); c.shadowBlur = 0; } for (const sp of p.b) { sp.y += sp.vy * (1 + mid * 1.5); if (sp.y < -0.05) { sp.y = 1.05; sp.x = Math.random(); } c.beginPath(); c.arc(sp.x * W + Math.sin(t * 1.2 + sp.a * 8) * 8, sp.y * H, 1.2, 0, 6.28); c.fillStyle = hexToRGBA(col[0], sp.a * 0.4); c.fill(); } }
  function drawFullGeometricVoid(c, W, H, col, t, bass, treble, p) { c.strokeStyle = hexToRGBA(col[0], 0.03 + treble * 0.03); c.lineWidth = 0.4; for (let x = 0; x < W; x += 35) for (let y = 0; y < H; y += 35) c.strokeRect(x + Math.sin(x * 0.008 + t * 0.8) * 3, y + Math.cos(y * 0.008 + t * 0.6) * 3, 35, 35); for (const sh of p.a) { sh.rx += sh.srx * (1 + bass * 1.5); sh.ry += sh.sry * (1 + bass * 1.5); const cx = sh.x * W + Math.sin(t * 0.2 + sh.rx) * 15, cy = sh.y * H + Math.cos(t * 0.15 + sh.ry) * 10; const vt = getVerts3(sh.type), pr = vt.map(v => proj3(v, sh.rx, sh.ry, sh.size * (1 + beatPulse * 0.15), cx, cy)), ed = getEdges3(sh.type, vt.length); c.strokeStyle = hexToRGBA(col[0], 0.3 + treble * 0.25); c.lineWidth = 0.8; c.shadowBlur = 4 + bass * 8; c.shadowColor = col[0]; for (const [a, b] of ed) { if (a >= pr.length || b >= pr.length) continue; c.beginPath(); c.moveTo(pr[a].x, pr[a].y); c.lineTo(pr[b].x, pr[b].y); c.stroke(); } c.shadowBlur = 0; } }
  // Scenes 8-19 expanded: use simplified versions that still look great fullscreen
  function drawFullCityRain(c, W, H, col, t, bass, mid, p) { for (const b of p.a) { const bx = b.x * W, bh = b.h * H, bw = b.w * W; c.fillStyle = 'rgba(15,15,25,0.85)'; c.fillRect(bx, H - bh, bw, bh); for (let f = 0; f < b.floors; f++) for (let w = 0; w < b.wins; w++) { const wx = bx + 3 + w * (bw - 6) / b.wins, wy = H - bh + 8 + f * (bh / b.floors); c.fillStyle = Math.sin(t * 0.1 + f + w * 3 + b.x * 10) > 0 ? hexToRGBA(col[0], 0.2 + mid * 0.15) : 'rgba(30,30,50,0.4)'; c.fillRect(wx, wy, (bw - 10) / b.wins * 0.6, (bh / b.floors) * 0.4); } } c.fillStyle = hexToRGBA(col[0], 0.03 + bass * 0.02); c.fillRect(0, H * 0.82, W, H * 0.18); for (let i = 0; i < 5; i++) { const lx = W * (0.1 + i * 0.2), ly = H * 0.55; const lg = c.createRadialGradient(lx, ly, 0, lx, ly, 60 + bass * 20); lg.addColorStop(0, hexToRGBA(col[0], 0.08)); lg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = lg; c.fillRect(lx - 80, ly - 80, 160, 160); c.beginPath(); c.arc(lx, ly, 3, 0, 6.28); c.fillStyle = hexToRGBA(col[0], 0.5); c.fill(); } c.strokeStyle = hexToRGBA(col[0], 0.1); c.lineWidth = 0.6; for (const r of p.b) { r.y += r.vy * (1 + bass); if (r.y > 1.05) { r.y = -0.05; r.x = Math.random(); } c.beginPath(); c.moveTo(r.x * W, r.y * H); c.lineTo(r.x * W - 0.5, r.y * H + 12); c.stroke(); } }
  function drawFullBeachMidnight(c, W, H, col, t, bass, mid, p) { const mx = W * 0.75, my = H * 0.15, mr = 25; const mg = c.createRadialGradient(mx, my, 0, mx, my, mr * 4); mg.addColorStop(0, 'rgba(255,255,240,0.3)'); mg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = mg; c.fillRect(0, 0, W, H); c.beginPath(); c.arc(mx, my, mr, 0, 6.28); c.fillStyle = 'rgba(255,255,230,0.7)'; c.fill(); for (const s of p.a) { const tw = 0.3 + 0.7 * Math.sin(t * 1.5 + s.tw); c.beginPath(); c.arc(s.x * W, s.y * H, 1 + s.tw * 0.3, 0, 6.28); c.fillStyle = `rgba(255,255,255,${tw * 0.5})`; c.fill(); } const shore = H * 0.65; c.fillStyle = hexToRGBA(col[1], 0.06); c.fillRect(0, shore, W, H); for (let w = 0; w < 5; w++) { c.beginPath(); for (let x = 0; x <= W; x += 3) { const y = shore + w * 20 + Math.sin(x * 0.01 + t * (0.8 - w * 0.1)) * (5 + bass * 6); x === 0 ? c.moveTo(x, y) : c.lineTo(x, y); } c.strokeStyle = hexToRGBA(col[0], 0.1 - w * 0.015); c.lineWidth = 1; c.stroke(); } c.beginPath(); for (let y = shore; y < H; y += 3) { const rx = mx + Math.sin(y * 0.05 + t) * (15 + (y - shore) * 0.15); c.moveTo(rx - 3, y); c.lineTo(rx + 3, y); } c.strokeStyle = 'rgba(255,255,230,0.08)'; c.lineWidth = 2; c.stroke(); const lh = p.b[0]; lh.angle += lh.sp * 0.005; const lhx = W * 0.1, lhy = H * 0.5; c.save(); c.translate(lhx, lhy); c.rotate(Math.sin(lh.angle) * 0.8); c.beginPath(); c.moveTo(0, 0); c.lineTo(W * 0.6, -15); c.lineTo(W * 0.6, 15); c.closePath(); c.fillStyle = `rgba(255,255,200,${0.02 + bass * 0.02})`; c.fill(); c.restore(); c.fillStyle = 'rgba(20,20,30,0.8)'; c.fillRect(lhx - 4, lhy, 8, H - lhy); }
  function drawFullLASunset(c, W, H, col, t, bass, mid, p) { const sky = c.createLinearGradient(0, 0, 0, H * 0.65); sky.addColorStop(0, 'rgba(25,5,50,0.6)'); sky.addColorStop(0.3, hexToRGBA(col[0], 0.25)); sky.addColorStop(0.6, 'rgba(255,100,50,0.2)'); sky.addColorStop(1, 'rgba(255,180,50,0.15)'); c.fillStyle = sky; c.fillRect(0, 0, W, H); const sunY = H * 0.52, sunR = 40 + bass * 10; c.beginPath(); c.arc(W * 0.6, sunY, sunR, 0, 6.28); c.fillStyle = 'rgba(255,120,50,0.5)'; c.fill(); c.fillStyle = 'rgba(10,8,15,0.7)'; c.fillRect(0, H * 0.62, W, H * 0.38); for (const palm of p.a) { const px = palm.x * W, py = H * (0.62 - palm.h), sway = Math.sin(t * 0.3 + palm.lean * 10) * 8; c.beginPath(); c.moveTo(px, H * 0.62); c.quadraticCurveTo(px + sway * 0.5, H * 0.62 - palm.h * H * 0.5, px + sway, py); c.strokeStyle = 'rgba(10,8,15,0.85)'; c.lineWidth = 4; c.stroke(); for (let f = 0; f < palm.fronds; f++) { const fa = (f / palm.fronds) * 6.28 + t * 0.05; c.beginPath(); c.moveTo(px + sway, py); c.quadraticCurveTo(px + sway + Math.cos(fa) * 20, py + Math.sin(fa) * 10, px + sway + Math.cos(fa) * 35, py + Math.sin(fa) * 15 + Math.abs(Math.cos(fa)) * 18); c.strokeStyle = 'rgba(10,8,15,0.8)'; c.lineWidth = 2; c.stroke(); } } for (const bird of p.b) { bird.x += bird.vx; bird.wing += 0.06; if (bird.x > 1.1) bird.x = -0.1; const bx = bird.x * W, by = bird.y * H + Math.sin(t * 0.5 + bird.x * 5) * 8; c.beginPath(); c.moveTo(bx - 6, by); c.quadraticCurveTo(bx - 3, by - 4 * Math.sin(bird.wing), bx, by); c.quadraticCurveTo(bx + 3, by - 4 * Math.sin(bird.wing + 0.5), bx + 6, by); c.strokeStyle = 'rgba(10,8,15,0.5)'; c.lineWidth = 1.2; c.stroke(); } }
  function drawFullTokyoNeon(c, W, H, col, t, bass, mid, p) { for (const b of p.a) { const bx = b.x * W, bh = b.h * H, bw = b.w * W; c.fillStyle = 'rgba(12,10,20,0.85)'; c.fillRect(bx, H - bh, bw, bh); for (let s = 0; s < b.signs; s++) { const sy = H - bh + 15 + s * (bh / (b.signs + 1)), sw = bw * 0.7, sh = 12; const flk = Math.sin(t * 3 + b.fl + s * 2) > -0.1 ? 1 : 0.1; c.fillStyle = `hsla(${(b.hue + s * 60) % 360},80%,60%,${(0.15 + mid * 0.15) * flk})`; c.fillRect(bx + (bw - sw) / 2, sy, sw, sh); const ng = c.createRadialGradient(bx + bw / 2, sy + sh / 2, 0, bx + bw / 2, sy + sh / 2, 40); ng.addColorStop(0, `hsla(${(b.hue + s * 60) % 360},80%,60%,${0.06 * flk})`); ng.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = ng; c.fillRect(bx - 20, sy - 20, bw + 40, sh + 40); } } c.fillStyle = hexToRGBA(col[0], 0.02); c.fillRect(0, H * 0.85, W, H * 0.15); for (const lt of p.b) { lt.x += lt.vx; if (lt.x > 1.2) { lt.x = -0.2; lt.hue = Math.random() * 360; } c.beginPath(); c.moveTo(lt.x * W, lt.y * H); c.lineTo((lt.x - lt.len) * W, lt.y * H); c.strokeStyle = `hsla(${lt.hue},80%,60%,0.15)`; c.lineWidth = 2; c.stroke(); } }
  function drawFullDesertHighway(c, W, H, col, t, bass, mid, p) { const sky = c.createLinearGradient(0, 0, 0, H * 0.55); sky.addColorStop(0, 'rgba(10,5,30,0.5)'); sky.addColorStop(1, hexToRGBA(col[0], 0.08)); c.fillStyle = sky; c.fillRect(0, 0, W, H); for (const m of p.a) { c.beginPath(); c.moveTo((m.x - 0.15) * W, H * 0.55); c.quadraticCurveTo(m.x * W, H * (0.55 - m.h), (m.x + 0.15) * W, H * 0.55); c.closePath(); c.fillStyle = hexToRGBA(col[1], 0.1); c.fill(); } c.fillStyle = hexToRGBA(col[1], 0.04); c.fillRect(0, H * 0.55, W, H * 0.45); c.beginPath(); c.moveTo(W * 0.42, H * 0.45); c.lineTo(0, H); c.lineTo(W, H); c.lineTo(W * 0.58, H * 0.45); c.closePath(); c.fillStyle = 'rgba(20,18,25,0.5)'; c.fill(); for (let i = 0; i < 15; i++) { const f = i / 15, dy = H * 0.45 + f * f * (H * 0.55), dw = 2 + f * 3, so = (t * 50 + i * 30) % (H * 0.06); c.fillStyle = hexToRGBA(col[0], 0.2 * f); c.fillRect(W / 2 - dw / 2, dy + so, dw, 8 * f); } for (const d of p.b) { d.x += d.vx; if (d.x > 1.1) d.x = -0.1; c.beginPath(); c.arc(d.x * W, d.y * H + Math.sin(t * 0.5 + d.x * 10) * 5, d.size, 0, 6.28); c.fillStyle = hexToRGBA(col[0], 0.2); c.fill(); } }
  function drawFullUnderwaterReef(c, W, H, col, t, bass, mid, p) { c.fillStyle = hexToRGBA('#0a2040', 0.2); c.fillRect(0, 0, W, H); for (let i = 0; i < 4; i++) { const sx = W * (0.15 + i * 0.2) + Math.sin(t * 0.2 + i) * 30; c.beginPath(); c.moveTo(sx, 0); c.lineTo(sx - 20, 0); c.lineTo(sx + 40, H); c.lineTo(sx + 80, H); c.closePath(); c.fillStyle = hexToRGBA(col[0], 0.02 + bass * 0.02); c.fill(); } for (const cr of p.a) { const cx = cr.x * W, cy = cr.y * H, sway = Math.sin(t * 0.3 + cr.sw) * 5; c.beginPath(); c.moveTo(cx, cy + cr.h * H); c.quadraticCurveTo(cx + sway, cy, cx + cr.w * W / 2, cy - cr.h * H * 0.3); c.quadraticCurveTo(cx + cr.w * W + sway, cy, cx + cr.w * W, cy + cr.h * H); c.closePath(); c.fillStyle = `hsla(${cr.hue},60%,40%,0.2)`; c.fill(); } for (const f of p.b) { f.x += f.vx; f.tail += 0.08; if (f.x > 1.1) f.x = -0.1; if (f.x < -0.1) f.x = 1.1; const fx = f.x * W, fy = f.y * H + Math.sin(t * 0.5 + f.x * 5) * 10, dir = f.vx > 0 ? 1 : -1; c.beginPath(); c.ellipse(fx, fy, f.size, f.size * 0.4, 0, 0, 6.28); c.fillStyle = hexToRGBA(col[0], 0.25); c.fill(); c.beginPath(); c.moveTo(fx - dir * f.size, fy); c.lineTo(fx - dir * (f.size + 6), fy - 3 + Math.sin(f.tail) * 2); c.lineTo(fx - dir * (f.size + 6), fy + 3 + Math.sin(f.tail) * 2); c.closePath(); c.fill(); } }
  function drawFullNorthernLights(c, W, H, col, t, bass, mid, p) { for (const r of p.a) { c.beginPath(); for (let x = 0; x <= W; x += 4) { const y = r.y * H + Math.sin(x / W * 5 + t * r.sp + r.off) * r.amp * H + Math.sin(x / W * 12 + t * r.sp * 1.5) * r.amp * H * 0.3 + bass * 15; x === 0 ? c.moveTo(x, y) : c.lineTo(x, y); } c.lineTo(W, r.y * H + 60); c.lineTo(0, r.y * H + 60); c.closePath(); const ag = c.createLinearGradient(0, r.y * H - r.amp * H, 0, r.y * H + 60); ag.addColorStop(0, `hsla(${r.hue},70%,55%,${0.08 + mid * 0.06})`); ag.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = ag; c.fill(); } c.fillStyle = 'rgba(5,5,10,0.6)'; c.fillRect(0, H * 0.85, W, H * 0.15); for (const s of p.b) { s.y += s.vy; s.x += Math.sin(t * 0.5 + s.x * 10) * 0.0003; if (s.y > 1.05) { s.y = -0.05; s.x = Math.random(); } c.beginPath(); c.arc(s.x * W, s.y * H, 1.2, 0, 6.28); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fill(); } }
  function drawFullRainyWindow(c, W, H, col, t, bass, mid, p) { for (const l of p.b) { const lg = c.createRadialGradient(l.x * W, l.y * H, 0, l.x * W, l.y * H, l.r + mid * 10); lg.addColorStop(0, `hsla(${l.hue},60%,50%,${l.a + bass * 0.03})`); lg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = lg; c.fillRect(l.x * W - l.r * 2, l.y * H - l.r * 2, l.r * 4, l.r * 4); } c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, 0, W, H); for (const d of p.a) { d.y += d.vy * (1 + d.r * 0.1); d.wb += 0.03; if (d.y > 1.1) { d.y = -0.1; d.x = Math.random(); d.trail = []; } const dx = d.x * W + Math.sin(d.wb) * 3, dy = d.y * H; d.trail.push({ x: dx, y: dy }); if (d.trail.length > 20) d.trail.shift(); c.beginPath(); for (let i = 0; i < d.trail.length; i++) i === 0 ? c.moveTo(d.trail[i].x, d.trail[i].y) : c.lineTo(d.trail[i].x, d.trail[i].y); c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = d.r * 0.3; c.stroke(); c.beginPath(); c.arc(dx, dy, d.r * 0.6, 0, 6.28); c.fillStyle = 'rgba(200,220,255,0.12)'; c.fill(); } }
  function drawFullVinylGroove(c, W, H, col, t, bass, mid, p) { const cx = W * 0.5, cy = H * 0.48, mr = Math.min(W, H) * 0.38; p.a[0].angle += 0.008 + bass * 0.01; const rg = c.createRadialGradient(cx, cy, 0, cx, cy, mr); rg.addColorStop(0, 'rgba(20,20,20,0.9)'); rg.addColorStop(0.15, 'rgba(5,5,5,0.9)'); rg.addColorStop(1, 'rgba(15,15,15,0.9)'); c.beginPath(); c.arc(cx, cy, mr, 0, 6.28); c.fillStyle = rg; c.fill(); for (let r = mr * 0.2; r < mr * 0.95; r += 3) { c.beginPath(); c.arc(cx, cy, r, 0, 6.28); c.strokeStyle = `rgba(40,40,40,${0.03 + Math.sin(r * 0.5 + t * 2) * 0.02 + mid * 0.03})`; c.lineWidth = 0.5; c.stroke(); } c.beginPath(); c.arc(cx, cy, mr * 0.18, 0, 6.28); c.fillStyle = hexToRGBA(col[0], 0.4); c.fill(); c.save(); c.translate(cx, cy); c.rotate(p.a[0].angle); const lg = c.createLinearGradient(-mr, 0, mr, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.49, 'rgba(255,255,255,0.04)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.08)'); lg.addColorStop(0.51, 'rgba(255,255,255,0.04)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = lg; c.fillRect(-mr, -mr, mr * 2, mr * 2); c.restore(); for (const d of p.b) { d.x += d.vx; d.y += d.vy; if (d.x < 0) d.x = 1; if (d.x > 1) d.x = 0; if (d.y < 0) d.y = 1; c.beginPath(); c.arc(d.x * W, d.y * H, d.size, 0, 6.28); c.fillStyle = 'rgba(255,255,255,0.1)'; c.fill(); } }
  function drawFullForestCanopy(c, W, H, col, t, bass, mid, p) { c.fillStyle = hexToRGBA('#0a1a0a', 0.3); c.fillRect(0, 0, W, H); for (let i = 0; i < 5; i++) { const sx = W * (0.15 + i * 0.18) + Math.sin(t * 0.15 + i) * 30; const sg = c.createLinearGradient(sx, 0, sx + 60, H * 0.7); sg.addColorStop(0, hexToRGBA(col[0], 0.05 + bass * 0.03)); sg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sg; c.beginPath(); c.moveTo(sx, 0); c.lineTo(sx + 20, 0); c.lineTo(sx + 60, H * 0.7); c.lineTo(sx - 20, H * 0.7); c.closePath(); c.fill(); } for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(20,15,10,0.25)'; c.fillRect(W * (0.1 + i * 0.25) + Math.sin(i * 3) * 30, 0, 6 + i * 2, H); } for (const ff of p.a) { ff.pulse += 0.02; const glow = 0.5 + 0.5 * Math.sin(ff.pulse); c.beginPath(); c.arc(ff.x * W, ff.y * H, 2 + mid * 2, 0, 6.28); c.shadowBlur = 8 + mid * 8; c.shadowColor = col[0]; c.fillStyle = hexToRGBA(col[0], ff.a * glow); c.fill(); } c.shadowBlur = 0; for (const leaf of p.b) { leaf.angle += leaf.sp; leaf.y += 0.0003; if (leaf.y > 1) leaf.y = 0; const lx = leaf.x * W + Math.sin(leaf.angle) * 30, ly = leaf.y * H; c.save(); c.translate(lx, ly); c.rotate(leaf.angle * 2); c.beginPath(); c.ellipse(0, 0, 4, 2, 0, 0, 6.28); c.fillStyle = hexToRGBA(col[0], 0.2); c.fill(); c.restore(); } }
  function drawFullRooftopNight(c, W, H, col, t, bass, mid, p) { const sg = c.createLinearGradient(0, 0, 0, H * 0.6); sg.addColorStop(0, 'rgba(5,5,15,0.5)'); sg.addColorStop(1, hexToRGBA(col[1], 0.05)); c.fillStyle = sg; c.fillRect(0, 0, W, H); for (const s of p.b) { const tw = 0.3 + 0.7 * Math.sin(t * 1.5 + s.tw); c.beginPath(); c.arc(s.x * W, s.y * H, 1, 0, 6.28); c.fillStyle = `rgba(255,255,255,${tw * 0.5})`; c.fill(); } for (const b of p.a) { const bx = b.x * W, bh = b.h * H, bw = b.w * W; c.fillStyle = 'rgba(10,10,18,0.8)'; c.fillRect(bx, H * 0.6 - bh, bw, bh + H * 0.4); for (let f = 0; f < b.wins; f++) { c.fillStyle = Math.sin(t * 0.08 + f * 2 + b.x * 10) > 0.2 ? hexToRGBA(col[0], 0.12 + mid * 0.08) : 'rgba(15,15,25,0.3)'; c.fillRect(bx + 2, H * 0.6 - bh + 5 + f * (bh / b.wins), bw - 4, 3); } } c.fillStyle = 'rgba(15,15,20,0.6)'; c.fillRect(0, H * 0.6, W, H * 0.4); for (let i = 0; i < 3; i++) { const gx = W * (0.2 + i * 0.3); const tg = c.createRadialGradient(gx, H * 0.6, 0, gx, H * 0.6, 50 + bass * 20); tg.addColorStop(0, hexToRGBA(col[0], 0.04 + bass * 0.03)); tg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = tg; c.fillRect(gx - 70, H * 0.6 - 30, 140, 60); } }
  function drawFullSubwayTunnel(c, W, H, col, t, bass, mid, p) { const cx = W / 2, cy = H * 0.45, ow = W * 0.48, iw = W * 0.08, ih = H * 0.06; c.beginPath(); c.moveTo(cx - ow, H); c.lineTo(cx - iw, cy - ih); c.lineTo(cx + iw, cy - ih); c.lineTo(cx + ow, H); c.closePath(); c.fillStyle = 'rgba(18,16,22,0.7)'; c.fill(); c.beginPath(); c.moveTo(cx - ow, 0); c.lineTo(cx - iw, cy - ih); c.lineTo(cx + iw, cy - ih); c.lineTo(cx + ow, 0); c.closePath(); c.fillStyle = 'rgba(12,10,16,0.6)'; c.fill(); for (const lt of p.a) { lt.z += lt.speed * (1 + bass * 1.5); if (lt.z > 1) lt.z = Math.random() * 0.1; const f = lt.z, px = lerp(iw, ow, f) * lt.side, ly = lerp(cy, lt.side > 0 ? H * 0.3 : H * 0.7, f); c.beginPath(); c.arc(cx + px, ly, 2 + f * 4, 0, 6.28); c.fillStyle = `hsla(${lt.hue},60%,60%,${(1 - f) * 0.4})`; c.fill(); c.beginPath(); c.moveTo(cx + px, ly); c.lineTo(cx + px + lt.side * 20 * f, ly + 10 * f); c.strokeStyle = `hsla(${lt.hue},60%,60%,${(1 - f) * 0.15})`; c.lineWidth = 1 + f * 2; c.stroke(); } for (const fl of p.b) { fl.fl += 0.05; fl.z += 0.001; if (fl.z > 0.8) fl.z = 0.1; const f = fl.z, ly = lerp(cy, 10, f), lw = lerp(iw * 0.3, ow * 0.3, f); const bright = fl.br * (0.7 + 0.3 * Math.sin(fl.fl)) * (Math.sin(fl.fl * 7) > 0.9 ? 0.2 : 1); c.fillStyle = `rgba(200,220,255,${bright * 0.15})`; c.fillRect(cx - lw, ly, lw * 2, 2 + f * 3); } for (let side = -1; side <= 1; side += 2) { c.beginPath(); c.moveTo(cx + ow * 0.6 * side, H); c.lineTo(cx + iw * 0.3 * side, cy); c.strokeStyle = 'rgba(60,60,70,0.3)'; c.lineWidth = 1.5; c.stroke(); } const vg = c.createRadialGradient(cx, cy, 0, cx, cy, iw * 2); vg.addColorStop(0, hexToRGBA(col[0], 0.08 + bass * 0.06)); vg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = vg; c.fillRect(cx - iw * 2, cy - ih * 2, iw * 4, ih * 4); }

  /* ============== VIEW HOOKS ============== */
  function onSearch(query) { searchQuery = query; buildTiles(); }
  function onTrackChange(index) { tiles.forEach(t => t.el.classList.toggle('playing', t.index === index)); }

  registerView('dimensions', { init, destroy, onSearch, onTrackChange });
})();
