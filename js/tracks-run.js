/* =========================================================
   TRACKS-RUN.JS — /tracks "The Run" (t23)
   ---------------------------------------------------------
   Mirror's-Edge-inspired first-person rooftop runway. A
   single bright-white concrete path stretches into a cyan-
   to-orange sunset; the city sprawls below. Each track is
   a vertical red banner along the path; scroll/swipe/keys
   slide the camera forward, click a banner to play.

   Same module interface as the old city — registers
   window.TracksDaw = { init, destroy, setFilter, setQuery,
   onTrackChange, root }, so index.html bootTracksDaw stays
   unchanged.
   ========================================================= */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/* ===================== Sky shader ===================== */

const SKY_VS = `
  varying vec3 vDir;
  void main(){
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FS = `
  uniform float uTime;
  varying vec3 vDir;

  void main(){
    float h = vDir.y;
    vec3 zenith  = vec3(0.18, 0.42, 0.62);
    vec3 mid     = vec3(0.92, 0.74, 0.52);
    vec3 horizon = vec3(1.00, 0.62, 0.36);
    vec3 ground  = vec3(0.20, 0.20, 0.24);

    vec3 col;
    if (h > 0.0){
      col = mix(horizon, mid,    smoothstep(0.00, 0.32, h));
      col = mix(col,     zenith, smoothstep(0.35, 0.95, h));
    } else {
      col = mix(horizon, ground, smoothstep(0.00, 0.55, -h));
    }

    vec3 sunDir = normalize(vec3(0.50, 0.16, 1.00));
    float s = max(0.0, dot(vDir, sunDir));
    col += vec3(1.00, 0.90, 0.72) * pow(s, 90.0) * 0.70;
    col += vec3(1.00, 0.70, 0.50) * pow(s, 8.0)  * 0.16;

    // Cloud streaks (cheap horizontal sine bands near horizon).
    float band = sin((h * 18.0) + uTime * 0.04) * 0.5 + 0.5;
    band *= smoothstep(0.05, 0.22, h) * (1.0 - smoothstep(0.22, 0.42, h));
    col += vec3(1.0, 0.86, 0.70) * band * 0.10;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ===================== Banner texture ===================== */

function _slug(s){
  return String(s || '').toLowerCase()
    .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
}

function _tierOf(track){
  if (track.featured) return 'featured';
  if (track.new || track['new']) return 'new';
  return 'archive';
}

function _makeBannerTexture(title, tier){
  const W = 256;
  const H = 768;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  // Red field (Mirror's Edge accent).
  const baseRed = tier === 'featured'
    ? 'rgb(232,40,52)'
    : tier === 'new' ? 'rgb(212,32,44)' : 'rgb(180,28,38)';
  g.fillStyle = baseRed;
  g.fillRect(0, 0, W, H);

  // Top + bottom hatched accent bars — wayfinding strip.
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.fillRect(0, 0, W, 10);
  g.fillRect(0, H - 10, W, 10);

  // Diagonal hatch in accent bars.
  g.strokeStyle = 'rgba(232,40,52,0.95)';
  g.lineWidth = 3;
  for (let x = -H; x < W + H; x += 14){
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 10, 10); g.stroke();
    g.beginPath(); g.moveTo(x, H - 10); g.lineTo(x + 10, H); g.stroke();
  }

  // Side rails (thin white bars along each long edge).
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillRect(0, 10, 3, H - 20);
  g.fillRect(W - 3, 10, 3, H - 20);

  // Title — rotated -90° to read bottom→top along the banner.
  const text = String(title || '').toUpperCase();
  const fontPx = tier === 'featured' ? 78 : tier === 'new' ? 62 : 54;
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(-Math.PI / 2);
  g.font = `900 ${fontPx}px "Space Grotesk", Inter, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';

  const maxW = H - 80;
  const m = g.measureText(text);
  let scale = 1;
  if (m.width > maxW) scale = maxW / m.width;
  if (scale !== 1) g.scale(scale, scale);
  g.fillText(text, 0, 0);
  g.restore();

  // Small tier tag, bottom-right (Mirror's Edge spec-sheet vibe).
  g.fillStyle = 'rgba(255,255,255,0.78)';
  g.font = `700 18px "Space Grotesk", system-ui`;
  g.textAlign = 'right';
  g.fillText(tier.toUpperCase(), W - 16, H - 28);

  // Crosshair-style index notches at one-third points.
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(W - 24, H * 0.34, 12, 2);
  g.fillRect(W - 24, H * 0.66, 12, 2);

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/* ===================== Shared materials ===================== */

const SHARED = {
  concrete:    null,
  concreteHi:  null,
  concreteLo:  null,
  glass:       null,
  glassWarm:   null,
  rail:        null,
  yellow:      null,
  redAccent:   null,
  vent:        null,
  helBody:     null,
  helRotor:    null,
  blink:       null,
  bannerEdge:  null,
};

function ensureShared(){
  if (SHARED.concrete) return;
  // Lit materials (Lambert) take directional sun + hemi for form / shading.
  // Base colors pushed near white so tone mapping keeps lit faces bright.
  SHARED.concrete    = new THREE.MeshLambertMaterial({ color: 0xfaf6ec });
  SHARED.concreteHi  = new THREE.MeshLambertMaterial({ color: 0xfffaf0 });
  SHARED.concreteLo  = new THREE.MeshLambertMaterial({ color: 0xe2dccc });
  SHARED.rail        = new THREE.MeshLambertMaterial({ color: 0x44444a });
  SHARED.yellow      = new THREE.MeshLambertMaterial({ color: 0xffd435 });
  SHARED.vent        = new THREE.MeshLambertMaterial({ color: 0x82828c });
  SHARED.helBody     = new THREE.MeshLambertMaterial({ color: 0xffffff });
  // Glass: Standard so we get a hint of specular sheen off the sun.
  SHARED.glass       = new THREE.MeshStandardMaterial({
    color: 0x9cc6d8, roughness: 0.10, metalness: 0.0,
    transparent: true, opacity: 0.62,
  });
  SHARED.glassWarm   = new THREE.MeshStandardMaterial({
    color: 0xe6a878, roughness: 0.18, metalness: 0.0,
    transparent: true, opacity: 0.55,
  });
  // Self-luminous accents stay Basic so they always pop at full color.
  SHARED.redAccent   = new THREE.MeshBasicMaterial({ color: 0xdd1a2a });
  SHARED.helRotor    = new THREE.MeshBasicMaterial({ color: 0x18181c, transparent: true, opacity: 0.55 });
  SHARED.blink       = new THREE.MeshBasicMaterial({ color: 0xff3a3a });
  SHARED.bannerEdge  = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
}

/* ===================== Module ===================== */

const RUN = {
  root: null, ctx: null, container: null,
  renderer: null, scene: null, camera: null, composer: null, bloom: null,
  raf: 0, clock: null,
  banners: [],
  buildings: [],
  helicopter: null,
  sky: null, skyMat: null,
  runwayEndZ: 0,
  totalLength: 0,

  // Navigation state.
  runT: 0, targetT: 0, runSpeed: 0,
  godView: false,
  godFly: null,

  // Audio.
  audioCtx: null, analyser: null, freqArr: null, bass: 0, mid: 0, hi: 0,

  // Input.
  drag: null, pinch: null,
  ray: null, mouse: null,
  hovered: null,
  activeIdx: -1,
  focusedIdx: -1,

  // Filter / search.
  filter: 'all', query: '',

  // HUD refs.
  hudEl: null, transportEl: null,
  _filterChips: null, _searchEl: null,
  _activeTitleEl: null, _activeTierEl: null,
  _backBtn: null, _miniBar: null, _miniFill: null,
  _tpTitle: null, _tpTime: null, _tpFill: null, _tpPlay: null,

  destroyed: false,

  /* ---------- Init ---------- */
  init(container, ctx){
    if (this.renderer) return;
    ensureShared();
    this.ctx = ctx || {};
    this.container = container;
    this.destroyed = false;
    this.banners = [];
    this.buildings = [];
    this.filter = ctx.filter || 'all';
    this.query = (ctx.query || '').toLowerCase();
    this.runT = 0; this.targetT = 0; this.runSpeed = 0;
    this.godView = false;
    this.activeIdx = -1;
    this.focusedIdx = -1;
    this.hovered = null;
    this.bass = 0; this.mid = 0; this.hi = 0;

    container.style.position = 'absolute';
    container.style.inset = '0';
    container.style.background = '#dfe5ea';
    container.style.overflow = 'hidden';

    const canvas = document.createElement('canvas');
    canvas.className = 'tr-canvas';
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width  = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'none';
    container.appendChild(canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.setClearColor(0xc8d6dc, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // ACES cinematic tone mapping — compresses highlights nicely, lifts shadows,
    // so the white concrete reads as form instead of blown-out paper.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xe2cab0, 400, 2200);

    // Sun direction matches the pinned sun in the sky shader (vec3(0.50, 0.16, 1.00)).
    const sun = new THREE.DirectionalLight(0xfff2dc, 1.55);
    sun.position.set(500, 160, 1000);
    sun.target.position.set(0, 0, 0);
    this.scene.add(sun);
    this.scene.add(sun.target);

    // Cool-cyan top / warm-orange ground bounce for the sunset hemisphere term.
    const hemi = new THREE.HemisphereLight(0xc8d8e0, 0xff9560, 0.70);
    this.scene.add(hemi);

    // Soft warm ambient lift so shadow faces don't go murky.
    const ambient = new THREE.AmbientLight(0xfff0e0, 0.38);
    this.scene.add(ambient);

    this.camera = new THREE.PerspectiveCamera(64, 1, 0.1, 6000);

    this.drag  = { active: false, lx: 0, ly: 0, totalPx: 0 };
    this.pinch = { active: false, d0: 0 };

    // Build order: sky → runway floor → city → banners → helicopter.
    this._buildSky();
    this._buildRunway();
    this._buildCity();
    this._buildBanners();
    this._buildHelicopter();
    this._buildCranes();

    this.clock = new THREE.Clock();
    this.ray = new THREE.Raycaster();
    this.mouse = { x: 0.5, y: 0.5, ndc: new THREE.Vector2(0, 0) };

    this.hudEl = this._buildHud();
    container.appendChild(this.hudEl);
    this.transportEl = this._buildTransport();
    container.appendChild(this.transportEl);

    this._onResize       = this._onResize.bind(this);
    this._onMove         = this._onMove.bind(this);
    this._onPointerDown  = this._onPointerDown.bind(this);
    this._onPointerUp    = this._onPointerUp.bind(this);
    this._onWheel        = this._onWheel.bind(this);
    this._onKeyDown      = this._onKeyDown.bind(this);
    this._onClick        = this._onClick.bind(this);
    this._onTouchStart   = this._onTouchStart.bind(this);
    this._onTouchMove    = this._onTouchMove.bind(this);
    this._onTouchEnd     = this._onTouchEnd.bind(this);

    window.addEventListener('resize', this._onResize);
    canvas.addEventListener('pointermove', this._onMove);
    canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);
    canvas.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('keydown', this._onKeyDown);
    canvas.addEventListener('click', this._onClick);
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  this._onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   this._onTouchEnd);

    this._onResize();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Selective bloom: only the very brightest highlights (sun, banner halos)
    // glow. Threshold 0.88 keeps shaded concrete crisp; strength 0.22 is
    // a gentle nimbus, not the previous lens-soak.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.55, 0.88);
    this.composer.addPass(this.bloom);

    this._tryHookAudio();

    this.root = this;
    this._applyFilter();
    this._updateTransport();
    this._loop = this._loop.bind(this);
    this.raf = requestAnimationFrame(this._loop);
  },

  /* ---------- Sky ---------- */
  _buildSky(){
    const geo = new THREE.SphereGeometry(4500, 32, 24);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: SKY_VS,
      fragmentShader: SKY_FS,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const sky = new THREE.Mesh(geo, mat);
    this.scene.add(sky);
    this.sky = sky;
    this.skyMat = mat;
  },

  /* ---------- Runway + edge details ---------- */
  _buildRunway(){
    const tracks = (this.ctx.tracks || []).slice();
    const N = Math.max(8, tracks.length);
    const SPACING = 14;
    const LEN = N * SPACING + 200;
    this.totalLength = LEN;
    this.runwayEndZ = LEN;

    const RUNWAY_Y = 30;
    this.RUNWAY_Y = RUNWAY_Y;

    // Main concrete slab.
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1.2, LEN),
      SHARED.concrete
    );
    slab.position.set(0, RUNWAY_Y - 0.6, LEN / 2);
    this.scene.add(slab);

    // Center yellow lane stripes (dashed).
    const stripeGeo = new THREE.BoxGeometry(0.30, 0.04, 3.6);
    for (let z = 6; z < LEN; z += 9){
      const s = new THREE.Mesh(stripeGeo, SHARED.yellow);
      s.position.set(0, RUNWAY_Y + 0.04, z);
      this.scene.add(s);
    }

    // Red edge accent stripes (the iconic ME wayfinding red along the path).
    const edgeGeo = new THREE.BoxGeometry(0.20, 0.08, LEN);
    for (const sx of [-5.10, 5.10]){
      const e = new THREE.Mesh(edgeGeo, SHARED.redAccent);
      e.position.set(sx, RUNWAY_Y + 0.06, LEN / 2);
      this.scene.add(e);
    }

    // Side railings — short low bars every 6u.
    const postGeo = new THREE.BoxGeometry(0.18, 0.9, 0.18);
    const railGeo = new THREE.BoxGeometry(0.20, 0.10, 6);
    for (let z = 6; z < LEN; z += 6){
      for (const sx of [-5.4, 5.4]){
        const post = new THREE.Mesh(postGeo, SHARED.rail);
        post.position.set(sx, RUNWAY_Y + 0.45, z);
        this.scene.add(post);
        if (z % 12 === 6){
          const rail = new THREE.Mesh(railGeo, SHARED.rail);
          rail.position.set(sx, RUNWAY_Y + 0.86, z + 3);
          this.scene.add(rail);
        }
      }
    }

    // Start cap — a giant red gateway frame at z≈0, like Faith's spawn-line.
    const gateW = 14, gateH = 18, gateD = 0.6;
    const gateFrameH = 1.0;
    const gateLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, gateH, gateD), SHARED.redAccent
    );
    gateLeft.position.set(-gateW / 2, RUNWAY_Y + gateH / 2, 4);
    this.scene.add(gateLeft);
    const gateRight = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, gateH, gateD), SHARED.redAccent
    );
    gateRight.position.set(gateW / 2, RUNWAY_Y + gateH / 2, 4);
    this.scene.add(gateRight);
    const gateTop = new THREE.Mesh(
      new THREE.BoxGeometry(gateW + 0.7, gateFrameH, gateD), SHARED.redAccent
    );
    gateTop.position.set(0, RUNWAY_Y + gateH - gateFrameH / 2, 4);
    this.scene.add(gateTop);

    // End cap — same gate.
    const gateLeftE = gateLeft.clone();   gateLeftE.position.z  = LEN - 4; this.scene.add(gateLeftE);
    const gateRightE = gateRight.clone(); gateRightE.position.z = LEN - 4; this.scene.add(gateRightE);
    const gateTopE = gateTop.clone();     gateTopE.position.z   = LEN - 4; this.scene.add(gateTopE);

    // Support pylons (the runway is a sky-bridge).
    for (let z = 60; z < LEN; z += 120){
      const pyl = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, RUNWAY_Y, 2.4), SHARED.concreteLo
      );
      pyl.position.set(0, RUNWAY_Y / 2 - 1, z);
      this.scene.add(pyl);
    }
  },

  /* ---------- City below ---------- */
  _buildCity(){
    const LEN = this.totalLength;

    // Ground far below the runway — large white plaza.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, LEN + 600),
      SHARED.concreteLo
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -8, LEN / 2);
    this.scene.add(ground);

    // Building palette: mostly white concrete + glass strips. Sparse accents.
    const accentMats = [SHARED.redAccent, SHARED.yellow];

    const place = (x, z, w, h, d, opts = {}) => {
      const mat = opts.warm ? SHARED.concreteHi : SHARED.concrete;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      body.position.set(x, h / 2 - 8, z);
      this.scene.add(body);
      this.buildings.push(body);

      // Vertical glass strip on one face.
      if (Math.random() < 0.72){
        const stripW = w * 0.32;
        const stripH = h * 0.74;
        const glassMat = Math.random() < 0.18 ? SHARED.glassWarm : SHARED.glass;
        const strip = new THREE.Mesh(
          new THREE.PlaneGeometry(stripW, stripH), glassMat
        );
        const face = Math.floor(Math.random() * 4);
        const off = 0.02;
        if (face === 0){ strip.position.set(x, h / 2 - 8, z + d / 2 + off); }
        else if (face === 1){
          strip.position.set(x, h / 2 - 8, z - d / 2 - off);
          strip.rotation.y = Math.PI;
        } else if (face === 2){
          strip.position.set(x + w / 2 + off, h / 2 - 8, z);
          strip.rotation.y = -Math.PI / 2;
        } else {
          strip.position.set(x - w / 2 - off, h / 2 - 8, z);
          strip.rotation.y =  Math.PI / 2;
        }
        this.scene.add(strip);
      }

      // Rare red/yellow accent stripe along one edge.
      if (Math.random() < 0.28){
        const accent = accentMats[Math.floor(Math.random() * accentMats.length)];
        const aw = w * 0.10, ah = h * 0.92;
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(aw, ah, 0.20), accent);
        stripe.position.set(x + (Math.random() < 0.5 ? -w/2 + aw/2 : w/2 - aw/2), h / 2 - 8, z + d / 2 + 0.02);
        this.scene.add(stripe);
      }

      // Rooftop blinker (red LED).
      if (h > 28 && Math.random() < 0.45){
        const poleH = 1.8 + Math.random() * 2.4;
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.10, 0.10, poleH, 6), SHARED.rail
        );
        pole.position.set(x, h - 8 + poleH / 2, z);
        this.scene.add(pole);
        const blink = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 6, 5), SHARED.blink
        );
        blink.position.set(x, h - 8 + poleH + 0.22, z);
        this.scene.add(blink);
      }

      // Rooftop vent.
      if (h > 20 && Math.random() < 0.55){
        const vw = Math.min(w * 0.45, 2.5);
        const vd = Math.min(d * 0.45, 2.5);
        const vent = new THREE.Mesh(
          new THREE.BoxGeometry(vw, 0.9, vd), SHARED.vent
        );
        vent.position.set(
          x + (Math.random() - 0.5) * (w - vw),
          h - 8 + 0.45,
          z + (Math.random() - 0.5) * (d - vd)
        );
        this.scene.add(vent);
      }
    };

    // Buildings along both sides of the runway in a rolling 3-rank pattern.
    const sideMin = 14, sideMax = 320;
    const ranks = [
      { off: 22,  hMin: 18, hMax: 50, every: 16, jitter: 4 },
      { off: 56,  hMin: 22, hMax: 64, every: 22, jitter: 6 },
      { off: 110, hMin: 30, hMax: 86, every: 28, jitter: 8 },
      { off: 190, hMin: 18, hMax: 52, every: 32, jitter: 10 },
    ];
    for (const side of [-1, 1]){
      for (const r of ranks){
        for (let z = -40; z < LEN + 80; z += r.every){
          if (Math.random() < 0.16) continue; // sparse
          const w = 8 + Math.random() * 10;
          const d = 8 + Math.random() * 10;
          const h = r.hMin + Math.random() * (r.hMax - r.hMin);
          const x = side * (r.off + (Math.random() - 0.5) * r.jitter);
          place(x, z + (Math.random() - 0.5) * r.jitter, w, h, d, {
            warm: Math.random() < 0.18,
          });
        }
      }
    }

    // A distant horizon ring of silhouette buildings far past the runway end.
    const farRing = 12;
    for (let i = 0; i < 50; i++){
      const ang = Math.random() * Math.PI * 2;
      const rad = 600 + Math.random() * 800;
      const x = Math.cos(ang) * rad;
      const z = LEN / 2 + Math.sin(ang) * rad * 0.6;
      const h = 24 + Math.random() * farRing * 4;
      const w = 14 + Math.random() * 14;
      const d = 14 + Math.random() * 14;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), SHARED.concreteLo);
      body.position.set(x, h / 2 - 8, z);
      this.scene.add(body);
    }
  },

  /* ---------- Banners ---------- */
  _buildBanners(){
    const tracks = (this.ctx.tracks || []).slice();
    if (!tracks.length) return;
    const SPACING = 14;
    const RUNWAY_Y = this.RUNWAY_Y;

    const featuredGeo = new THREE.BoxGeometry(8, 16, 0.35);
    const newGeo      = new THREE.BoxGeometry(5, 12, 0.30);
    const archiveGeo  = new THREE.BoxGeometry(3, 8,  0.25);

    // Featured banners get top priority (hang over center). Otherwise alternate
    // L/R. Archive sits further out so the eye reads the visible path first.
    tracks.forEach((t, i) => {
      const tier = _tierOf(t);
      const tex  = _makeBannerTexture(t.title, tier);
      const mat  = new THREE.MeshBasicMaterial({ map: tex });
      const z    = 20 + i * SPACING;

      let geo, x, y, w, h;
      if (tier === 'featured'){
        geo = featuredGeo;
        x = 0;
        y = RUNWAY_Y + 22;    // hangs above center, like a gantry sign
        w = 8; h = 16;
      } else if (tier === 'new'){
        geo = newGeo;
        const side = (i % 2 === 0) ? -1 : 1;
        x = side * 6.2;
        y = RUNWAY_Y + 7 + 1.2;
        w = 5; h = 12;
      } else {
        geo = archiveGeo;
        const side = (i % 2 === 0) ? -1 : 1;
        x = side * 9.5;
        y = RUNWAY_Y + 5 + 1.0;
        w = 3; h = 8;
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      // Slight cant toward path center so it reads better as you approach.
      const cant = (x === 0) ? 0 : (x > 0 ? -0.12 : 0.12);
      mesh.rotation.y = cant;
      this.scene.add(mesh);

      // Suspension wire for featured / archive banners.
      if (tier === 'featured'){
        const wireH = 6;
        const wire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.05, wireH, 6), SHARED.rail
        );
        wire.position.set(0, y + h / 2 + wireH / 2, z);
        this.scene.add(wire);
      }

      // Glow halo plane behind banner — visible from either side
      // (camera passes the banner, so it reads as a glow on approach AND
      // glances back).
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xff3a44, transparent: true, opacity: 0.0,
        depthWrite: false, blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const halo = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 3.0, h * 1.6), haloMat
      );
      halo.position.set(x, y, z + 0.6);
      halo.rotation.y = cant;
      this.scene.add(halo);

      const banner = {
        mesh, mat, tex, halo, haloMat,
        idx: i, track: t, tier,
        slug: _slug(t.title),
        bannerT: z,         // z position
        baseY: y, w, h, cant, x,
        phase: Math.random() * Math.PI * 2,
        visible: true,
      };
      mesh.userData.banner = banner;
      this.banners.push(banner);
    });

    // Place camera at start.
    this.runT = 0;
    this.targetT = 0;
    this._applyCamera();
  },

  _buildHelicopter(){
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.0, 4.2), SHARED.helBody
    );
    g.add(body);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.4, 3.2), SHARED.helBody
    );
    tail.position.set(0, 0.2, -3.6);
    g.add(tail);
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 1.2, 0.7), SHARED.helBody
    );
    fin.position.set(0, 0.8, -5.0);
    g.add(fin);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(7.0, 0.06, 0.30), SHARED.helRotor
    );
    rotor.position.set(0, 0.9, 0);
    g.add(rotor);
    const trotor = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 1.0, 0.10), SHARED.helRotor
    );
    trotor.position.set(0.4, 0.6, -5.0);
    g.add(trotor);
    const blink = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 6, 5), SHARED.blink
    );
    blink.position.set(0, -0.6, 0.5);
    g.add(blink);

    g.position.set(60, 100, 200);
    this.scene.add(g);
    this.helicopter = { group: g, rotor, trotor, blink, phase: 0 };
  },

  _buildCranes(){
    // 3 distant yellow construction cranes for ME-style cityscape texture.
    const placements = [
      { x: -260, z: this.totalLength * 0.25, h: 80, arm: 50 },
      { x:  280, z: this.totalLength * 0.62, h: 95, arm: 60 },
      { x: -180, z: this.totalLength * 0.88, h: 70, arm: 44 },
    ];
    for (const p of placements){
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, p.h, 2.4), SHARED.yellow
      );
      tower.position.set(p.x, p.h / 2 - 8, p.z);
      this.scene.add(tower);

      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(p.arm, 1.4, 1.4), SHARED.yellow
      );
      arm.position.set(p.x + p.arm * 0.35, p.h - 8 + 0.7, p.z);
      this.scene.add(arm);

      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(p.arm * 0.4, 1.0, 1.2), SHARED.concrete
      );
      counter.position.set(p.x - p.arm * 0.25, p.h - 8 + 0.5, p.z);
      this.scene.add(counter);
    }
  },

  /* ---------- Camera / navigation ---------- */
  _applyCamera(){
    if (this.godView){
      // Top-down look at the full runway.
      const cz = (this.godFly ? this.godFly.z : this.totalLength / 2);
      this.camera.position.set(0, this.RUNWAY_Y + 380, cz);
      this.camera.lookAt(0, this.RUNWAY_Y, cz - 1);
      this.camera.rotation.z = 0;
      return;
    }

    const z = this.runT * this.totalLength;
    const bob = Math.sin(z * 0.06) * 0.05 + this.bass * 0.30;
    const eyeY = this.RUNWAY_Y + 5.0 + bob;
    this.camera.position.set(0, eyeY, z);

    // Look forward + slightly downward to catch the runway.
    const look = new THREE.Vector3(0, eyeY - 0.6, z + 40);
    this.camera.lookAt(look);
  },

  /* ---------- Audio ---------- */
  _tryHookAudio(){
    try {
      const a = this.ctx.audio;
      if (!a) return;
      if (a.__floorAnalyser){
        this.analyser = a.__floorAnalyser;
        this.freqArr  = new Uint8Array(this.analyser.frequencyBinCount);
      }
    } catch(e){}
  },

  _sampleAudio(){
    if (!this.analyser){
      this._tryHookAudio();
      if (!this.analyser) return;
    }
    this.analyser.getByteFrequencyData(this.freqArr);
    const n = this.freqArr.length;
    let bs = 0, ms = 0, hs = 0;
    const bn = Math.max(2, Math.floor(n * 0.10));
    const mn = Math.max(2, Math.floor(n * 0.30));
    for (let i = 0; i < bn; i++) bs += this.freqArr[i];
    for (let i = bn; i < mn; i++) ms += this.freqArr[i];
    for (let i = mn; i < n; i++) hs += this.freqArr[i];
    const b = (bs / bn) / 255;
    const m = (ms / (mn - bn)) / 255;
    const h = (hs / (n - mn)) / 255;
    // Smooth.
    this.bass = this.bass * 0.78 + b * 0.22;
    this.mid  = this.mid  * 0.78 + m * 0.22;
    this.hi   = this.hi   * 0.78 + h * 0.22;
  },

  /* ---------- HUD ---------- */
  _buildHud(){
    const root = document.createElement('div');
    root.className = 'tr-hud';
    root.style.cssText = `
      position:absolute; inset:0; pointer-events:none;
      font:13px/1.4 "Space Grotesk", Inter, system-ui, sans-serif;
      color:#1a1c22; z-index:10;
    `;

    const build = this.ctx.buildNumber || '';
    const count = (this.ctx.tracks || []).length;

    const corner = document.createElement('div');
    corner.style.cssText = `
      position:absolute; top:18px; left:20px;
      display:flex; flex-direction:column; gap:5px;
      font-size:11px; letter-spacing:0.16em; text-transform:uppercase;
      color:rgba(20,22,28,0.72);
    `;
    corner.innerHTML = `
      <div style="color:#dd1a2a;font-weight:800;letter-spacing:0.20em;">CANTMUTE / THE RUN</div>
      <div>${count} TRACKS &middot; ${build}</div>
    `;
    root.appendChild(corner);

    // Filter chips (top right).
    const filters = document.createElement('div');
    filters.style.cssText = `
      position:absolute; top:18px; right:20px;
      display:flex; gap:8px; pointer-events:auto;
    `;
    const chips = [
      { v: 'all',      label: 'ALL' },
      { v: 'new',      label: 'NEW' },
      { v: 'featured', label: 'FEATURED' },
    ];
    chips.forEach(c => {
      const b = document.createElement('button');
      b.textContent = c.label;
      b.dataset.filter = c.v;
      b.style.cssText = `
        appearance:none; background:rgba(255,255,255,0.55);
        border:1px solid rgba(20,22,28,0.30);
        color:#1a1c22;
        padding:6px 12px; font:700 10px/1 "Space Grotesk", system-ui;
        letter-spacing:0.18em; text-transform:uppercase;
        cursor:pointer; border-radius:2px;
        transition:all 180ms ease;
      `;
      b.addEventListener('click', () => {
        this.filter = c.v;
        if (c.v === 'new') history.pushState({}, '', '/tracks/new');
        else               history.pushState({}, '', '/tracks');
        this._applyFilter();
        this._syncChips();
      });
      filters.appendChild(b);
    });
    root.appendChild(filters);
    this._filterChips = filters;

    // Search (top center).
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'search tracks…';
    search.style.cssText = `
      position:absolute; top:18px; left:50%; transform:translateX(-50%);
      width:260px; max-width:36vw;
      background:rgba(255,255,255,0.70);
      border:1px solid rgba(20,22,28,0.30);
      color:#1a1c22; padding:8px 12px;
      font:13px "Space Grotesk", system-ui; letter-spacing:0.03em;
      border-radius:2px; outline:none;
      pointer-events:auto;
    `;
    search.value = this.query || '';
    search.addEventListener('input', () => {
      this.query = search.value.toLowerCase();
      this._applyFilter();
    });
    root.appendChild(search);
    this._searchEl = search;

    // Active-banner big title overlay (top-center, BELOW search).
    const active = document.createElement('div');
    active.style.cssText = `
      position:absolute; top:64px; left:50%; transform:translateX(-50%);
      pointer-events:none;
      display:flex; flex-direction:column; align-items:center; gap:4px;
    `;
    const tier = document.createElement('div');
    tier.style.cssText = `
      font:800 10px/1 "Space Grotesk", system-ui;
      letter-spacing:0.34em; color:#dd1a2a;
    `;
    tier.textContent = '';
    const title = document.createElement('div');
    title.style.cssText = `
      font:900 28px/1 "Space Grotesk", Inter, system-ui;
      letter-spacing:0.04em; text-transform:uppercase;
      color:#1a1c22; text-shadow:0 1px 0 rgba(255,255,255,0.7);
      max-width:60vw; text-align:center;
    `;
    title.textContent = '';
    active.appendChild(tier);
    active.appendChild(title);
    root.appendChild(active);
    this._activeTitleEl = title;
    this._activeTierEl = tier;

    // Mini-progress bar (just under active title).
    const mini = document.createElement('div');
    mini.style.cssText = `
      position:absolute; top:118px; left:50%; transform:translateX(-50%);
      width:280px; height:3px;
      background:rgba(20,22,28,0.18);
      border-radius:1px; pointer-events:none;
    `;
    const fill = document.createElement('div');
    fill.style.cssText = `
      position:absolute; left:0; top:0; bottom:0; width:0%;
      background:#dd1a2a;
    `;
    mini.appendChild(fill);
    root.appendChild(mini);
    this._miniBar = mini;
    this._miniFill = fill;

    // Overview button (top-down god view) — bottom right.
    const ovBtn = document.createElement('button');
    ovBtn.textContent = 'OVERVIEW';
    ovBtn.style.cssText = `
      position:absolute; bottom:96px; right:20px;
      appearance:none; background:rgba(255,255,255,0.78);
      border:1px solid rgba(20,22,28,0.34);
      color:#1a1c22;
      padding:9px 14px; font:800 11px/1 "Space Grotesk", system-ui;
      letter-spacing:0.20em; text-transform:uppercase;
      cursor:pointer; border-radius:2px;
      pointer-events:auto; transition:all 180ms ease;
    `;
    ovBtn.addEventListener('mouseenter', () => { ovBtn.style.background = 'rgba(255,255,255,1.0)'; });
    ovBtn.addEventListener('mouseleave', () => { ovBtn.style.background = 'rgba(255,255,255,0.78)'; });
    ovBtn.addEventListener('click', () => this._toggleGodView());
    root.appendChild(ovBtn);
    this._ovBtn = ovBtn;

    // Bottom-left help text.
    const help = document.createElement('div');
    help.style.cssText = `
      position:absolute; bottom:124px; left:20px;
      font-size:10px; letter-spacing:0.16em; text-transform:uppercase;
      color:rgba(20,22,28,0.52); line-height:1.7;
    `;
    help.innerHTML = `
      <div>SCROLL / SWIPE / ↑↓ &middot; run</div>
      <div>CLICK BANNER &middot; play</div>
      <div>← → &middot; prev / next song</div>
      <div>O / ESC &middot; overview</div>
    `;
    root.appendChild(help);

    setTimeout(() => this._syncChips(), 0);
    return root;
  },

  _syncChips(){
    if (!this._filterChips) return;
    this._filterChips.querySelectorAll('button').forEach(b => {
      const on = b.dataset.filter === this.filter;
      b.style.background  = on ? '#1a1c22' : 'rgba(255,255,255,0.55)';
      b.style.color       = on ? '#fff'    : '#1a1c22';
      b.style.borderColor = on ? '#1a1c22' : 'rgba(20,22,28,0.30)';
    });
  },

  _buildTransport(){
    const root = document.createElement('div');
    root.className = 'tr-transport';
    root.style.cssText = `
      position:absolute; left:50%; bottom:30px; transform:translateX(-50%);
      display:flex; gap:14px; align-items:center;
      background:rgba(255,255,255,0.80);
      border:1px solid rgba(20,22,28,0.28);
      padding:10px 16px;
      font:12px "Space Grotesk", system-ui; color:#1a1c22;
      letter-spacing:0.06em;
      pointer-events:auto; z-index:11;
      backdrop-filter:blur(6px);
      border-radius:2px;
    `;

    const btn = (label, action) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = `
        appearance:none; background:transparent; color:#1a1c22;
        border:1px solid rgba(20,22,28,0.32);
        padding:6px 9px; font:700 11px "Space Grotesk", system-ui;
        cursor:pointer; min-width:30px; border-radius:2px;
      `;
      b.addEventListener('click', action);
      b.addEventListener('mouseenter', () => { b.style.background = 'rgba(20,22,28,0.10)'; });
      b.addEventListener('mouseleave', () => { b.style.background = 'transparent'; });
      return b;
    };

    const prev = btn('‹', () => this.ctx.onPrev?.());
    const play = btn('▶', () => this.ctx.onTogglePlay?.());
    const next = btn('›', () => this.ctx.onNext?.());
    this._tpPlay = play;

    const title = document.createElement('div');
    title.style.cssText = `
      min-width:180px; max-width:36vw; overflow:hidden;
      white-space:nowrap; text-overflow:ellipsis;
      font-weight:700; letter-spacing:0.04em;
      color:#1a1c22;
    `;
    title.textContent = '—';

    const time = document.createElement('div');
    time.style.cssText = `
      font:11px "Space Grotesk", system-ui;
      letter-spacing:0.08em; color:rgba(20,22,28,0.56);
      min-width:88px; text-align:right;
    `;
    time.textContent = '0:00 / 0:00';

    const bar = document.createElement('div');
    bar.style.cssText = `
      position:relative; width:200px; height:4px;
      background:rgba(20,22,28,0.20); cursor:pointer; border-radius:1px;
    `;
    const fill = document.createElement('div');
    fill.style.cssText = `
      position:absolute; left:0; top:0; bottom:0; width:0%;
      background:#dd1a2a;
    `;
    bar.appendChild(fill);
    bar.addEventListener('click', (e) => {
      const r = bar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      this.ctx.onSeek?.(pct);
    });

    root.appendChild(prev);
    root.appendChild(play);
    root.appendChild(next);
    root.appendChild(title);
    root.appendChild(bar);
    root.appendChild(time);

    this._tpTitle = title;
    this._tpTime  = time;
    this._tpFill  = fill;
    return root;
  },

  _updateTransport(){
    if (!this._tpTitle) return;
    const cur = this.ctx.getCurrent ? this.ctx.getCurrent() : -1;
    const audio = this.ctx.audio;
    if (cur < 0 || !this.ctx.tracks?.[cur]){
      this._tpTitle.textContent = '— no track —';
      this._tpFill.style.width = '0%';
      this._tpTime.textContent = '0:00 / 0:00';
      if (this._tpPlay) this._tpPlay.textContent = '▶';
      return;
    }
    const t = this.ctx.tracks[cur];
    this._tpTitle.textContent = t.title || '—';
    if (audio && audio.duration){
      const pct = (audio.currentTime / audio.duration) * 100;
      this._tpFill.style.width = pct + '%';
      this._tpTime.textContent = _fmt(audio.currentTime) + ' / ' + _fmt(audio.duration);
    }
    if (this._tpPlay) this._tpPlay.textContent = audio?.paused === false ? '❚❚' : '▶';
  },

  /* ---------- Active-banner detection ---------- */
  _updateActive(){
    if (!this.banners.length) return;
    const z = this.runT * this.totalLength;
    let best = -1, bestD = Infinity;
    for (let i = 0; i < this.banners.length; i++){
      const b = this.banners[i];
      if (!b.visible) continue;
      const d = Math.abs(b.bannerT - z);
      if (d < bestD){ bestD = d; best = i; }
    }
    this.activeIdx = best;

    if (best >= 0){
      const b = this.banners[best];
      if (this._activeTitleEl && this._activeTitleEl.textContent !== (b.track.title || '')){
        this._activeTitleEl.textContent = (b.track.title || '').toUpperCase();
        this._activeTierEl.textContent  = (b.tier || '').toUpperCase();
      }
      // Mini-bar shows position along the run.
      if (this._miniFill){
        this._miniFill.style.width = (this.runT * 100).toFixed(1) + '%';
      }
    }

    // Per-banner highlight + bass-scaled halo on active.
    for (let i = 0; i < this.banners.length; i++){
      const b = this.banners[i];
      if (!b.visible) continue;
      const isActive = (i === best);
      const isFocused = (b.idx === this.focusedIdx);
      // brighten texture color via material.color
      const tint = isFocused ? 1.0 : (isActive ? 0.96 : 0.86);
      b.mat.color.setRGB(tint, tint, tint);
      // halo opacity — much gentler post-bloom-tame so the focused banner
      // glows like a wayfinding mark, not a lens flare blob.
      const targetHalo = isFocused
        ? (0.28 + this.mid * 0.18)
        : (isActive ? (0.10 + this.bass * 0.10) : 0);
      b.haloMat.opacity = b.haloMat.opacity * 0.85 + targetHalo * 0.15;
    }
  },

  /* ---------- Filter / search ---------- */
  _applyFilter(){
    const q = (this.query || '').toLowerCase();
    for (const b of this.banners){
      let ok = true;
      if (this.filter === 'new')      ok = !!(b.track.new || b.track['new']);
      else if (this.filter === 'featured') ok = !!b.track.featured;
      if (ok && q){
        const hay = (b.track.title || '').toLowerCase()
          + ' ' + ((b.track.tags || []).join(' ').toLowerCase());
        ok = hay.includes(q);
      }
      b.visible = ok;
      b.mesh.visible = ok;
      b.halo.visible = ok;
    }
  },

  setFilter(f){
    this.filter = f || 'all';
    this._applyFilter();
    this._syncChips();
  },

  setQuery(q){
    this.query = (q || '').toLowerCase();
    if (this._searchEl && this._searchEl.value !== this.query) this._searchEl.value = this.query;
    this._applyFilter();
  },

  onTrackChange(){
    this._updateTransport();
    const cur = this.ctx.getCurrent?.();
    if (typeof cur === 'number' && cur >= 0){
      this.focusedIdx = cur;
      // Glide camera to that banner so prev/next browses song-by-song.
      const b = this.banners.find(x => x.idx === cur);
      if (b && b.visible && !this.godView){
        this.targetT = (b.bannerT - 12) / this.totalLength;
        this.targetT = Math.max(0, Math.min(1, this.targetT));
      }
    }
  },

  /* ---------- God view ---------- */
  _toggleGodView(){
    this.godView = !this.godView;
    if (this._ovBtn){
      this._ovBtn.textContent = this.godView ? 'RETURN TO RUN' : 'OVERVIEW';
    }
    if (this.godView){
      // Show whole runway from above. Center on current camera position.
      this.godFly = { z: this.runT * this.totalLength };
    } else {
      this.godFly = null;
    }
  },

  /* ---------- Input ---------- */
  _onResize(){
    if (!this.renderer || !this.container) return;
    const w = this.container.clientWidth  || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.bloom) this.bloom.resolution.set(w, h);
  },

  _onMove(e){
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) / r.width;
    this.mouse.y = (e.clientY - r.top)  / r.height;
    this.mouse.ndc.set(this.mouse.x * 2 - 1, -(this.mouse.y * 2 - 1));

    if (this.drag.active){
      const dx = e.clientX - this.drag.lx;
      const dy = e.clientY - this.drag.ly;
      this.drag.lx = e.clientX;
      this.drag.ly = e.clientY;
      this.drag.totalPx += Math.abs(dx) + Math.abs(dy);
      // Vertical drag drives forward/backward along the run (first-person only).
      if (!this.godView){
        const sens = 0.0009;
        this.targetT -= dy * sens;
        this.targetT = Math.max(0, Math.min(1, this.targetT));
      }
    }
  },

  _onPointerDown(e){
    this.drag.active = true;
    this.drag.lx = e.clientX;
    this.drag.ly = e.clientY;
    this.drag.totalPx = 0;
    this.renderer.domElement.style.cursor = 'grabbing';
  },

  _onPointerUp(){
    this.drag.active = false;
    if (this.renderer) this.renderer.domElement.style.cursor = 'grab';
  },

  _onWheel(e){
    e.preventDefault();
    if (this.godView){
      // In god view, wheel zooms in/out (do nothing for now; keep simple).
      return;
    }
    // ~3x slower than t23. Wheel deltaY 100 → 0.004 of run per tick (~0.3 banners).
    const sens = 0.00004;
    this.targetT += e.deltaY * sens;
    this.targetT = Math.max(0, Math.min(1, this.targetT));
  },

  _onTouchStart(e){
    if (e.touches.length === 2){
      this.drag.active = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.pinch.active = true;
      this.pinch.d0 = Math.hypot(dx, dy);
    } else if (e.touches.length === 1){
      this.drag.active = true;
      this.drag.lx = e.touches[0].clientX;
      this.drag.ly = e.touches[0].clientY;
      this.drag.totalPx = 0;
    }
    if (e.cancelable) e.preventDefault();
  },

  _onTouchMove(e){
    if (this.drag.active && e.touches.length === 1){
      const t = e.touches[0];
      const dx = t.clientX - this.drag.lx;
      const dy = t.clientY - this.drag.ly;
      this.drag.lx = t.clientX;
      this.drag.ly = t.clientY;
      this.drag.totalPx += Math.abs(dx) + Math.abs(dy);
      if (!this.godView){
        const sens = 0.0012;
        this.targetT -= dy * sens;
        this.targetT = Math.max(0, Math.min(1, this.targetT));
      }
    }
    if (e.cancelable) e.preventDefault();
  },

  _onTouchEnd(){
    this.drag.active = false;
    this.pinch.active = false;
  },

  _onKeyDown(e){
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === ' '){ e.preventDefault(); this.ctx.onTogglePlay?.(); }
    else if (k === 'arrowup'   || k === 'w'){
      if (!this.godView){ e.preventDefault(); this.targetT = Math.min(1, this.targetT + 0.006); }
    }
    else if (k === 'arrowdown' || k === 's'){
      if (!this.godView){ e.preventDefault(); this.targetT = Math.max(0, this.targetT - 0.006); }
    }
    else if (k === 'arrowleft'){ e.preventDefault(); this.ctx.onPrev?.(); }
    else if (k === 'arrowright'){ e.preventDefault(); this.ctx.onNext?.(); }
    else if (k === 'escape' || k === 'o'){
      this._toggleGodView();
    }
  },

  _onClick(e){
    if (this.drag.totalPx > 6) return;

    if (this.godView){
      // Click in god view = return to first-person at the click's z target.
      // Project mouse onto the runway plane (y = RUNWAY_Y).
      this.ray.setFromCamera(this.mouse.ndc, this.camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.RUNWAY_Y);
      const hit = new THREE.Vector3();
      const ok = this.ray.ray.intersectPlane(plane, hit);
      if (ok){
        this.targetT = Math.max(0, Math.min(1, hit.z / this.totalLength));
        this.runT = this.targetT;
      }
      this._toggleGodView();
      return;
    }

    // First-person: check banner raycast.
    this.ray.setFromCamera(this.mouse.ndc, this.camera);
    const meshes = this.banners.filter(b => b.visible).map(b => b.mesh);
    const hits = this.ray.intersectObjects(meshes, false);
    if (hits.length){
      const b = hits[0].object.userData.banner;
      if (b){
        this.focusedIdx = b.idx;
        this.targetT = Math.max(0, Math.min(1, (b.bannerT - 12) / this.totalLength));
        this.ctx.onPlay?.(b.idx);
      }
    }
  },

  /* ---------- Loop ---------- */
  _loop(){
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const t  = this.clock.elapsedTime;

    // Audio sample.
    this._sampleAudio();

    // Ease runT toward targetT. Slower than t23 — gives a weighted stride
    // rather than the previous slingshot.
    if (!this.godView){
      const k = 1 - Math.pow(0.001, dt);
      this.runT += (this.targetT - this.runT) * Math.min(1, k * 2.4);
    }

    // Sky animates slowly + follows the camera so the horizon stays infinite.
    if (this.skyMat) this.skyMat.uniforms.uTime.value = t;
    if (this.sky) this.sky.position.copy(this.camera.position);

    // Helicopter circles, bobs on bass.
    if (this.helicopter){
      const h = this.helicopter;
      h.phase += dt * 0.32;
      const cx = 0 + Math.cos(h.phase) * 180;
      const cz = this.totalLength * 0.5 + Math.sin(h.phase) * 240;
      const cy = 95 + Math.sin(h.phase * 1.3) * 8 + this.bass * 6;
      h.group.position.set(cx, cy, cz);
      h.group.rotation.y = -h.phase + Math.PI / 2;
      h.rotor.rotation.y  += dt * 32;
      h.trotor.rotation.x += dt * 38;
      h.blink.material.opacity = 0.5 + (Math.sin(t * 6) > 0 ? 0.5 : 0);
    }

    // God-view smooth zoom-out / zoom-in for visual continuity.
    if (this.godView && this.godFly){
      const target = this.runT * this.totalLength;
      this.godFly.z += (target - this.godFly.z) * 0.06;
    }

    this._updateActive();
    this._applyCamera();
    this._updateTransport();

    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  },

  /* ---------- Destroy ---------- */
  destroy(){
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('keydown', this._onKeyDown);
    if (this.composer){
      try { this.composer.passes.forEach(p => p.dispose?.()); } catch(e){}
    }
    if (this.renderer){
      try { this.renderer.dispose(); } catch(e){}
      try { this.renderer.domElement.remove(); } catch(e){}
    }
    if (this.scene){
      this.scene.traverse(o => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material){
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => {
            if (m.uniforms?.uTex?.value) m.uniforms.uTex.value.dispose?.();
            if (m.map && !SHARED_HAS(m)) m.map.dispose?.();
          });
        }
      });
    }
    if (this.hudEl) this.hudEl.remove();
    if (this.transportEl) this.transportEl.remove();
    this.root = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.bloom = null;
    this.banners = [];
    this.buildings = [];
    this.helicopter = null;
    this.sky = null;
    this.hudEl = null;
    this.transportEl = null;
    this.container = null;
  },
};

function SHARED_HAS(mat){
  for (const k in SHARED){
    if (SHARED[k] === mat) return true;
  }
  return false;
}

function _fmt(s){
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60);
  const r = String(s % 60).padStart(2, '0');
  return `${m}:${r}`;
}

window.TracksDaw = RUN;
