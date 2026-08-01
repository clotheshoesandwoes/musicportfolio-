/* =========================================================
   TRACKS-JUMP.JS — /tracks "The Jump" (t25)
   ---------------------------------------------------------
   Third-person Mirror's-Edge-inspired platformer. A low-poly
   runner character stands on a rooftop in a procedural sunset
   city. Each song lives on its own rooftop; click a banner,
   character jumps there with a parabolic arc + animated limbs,
   song plays on landing. Camera trails the runner with smooth
   orbit + zoom. Same module interface as the city / run.
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
    vec3 zenith  = vec3(0.16, 0.40, 0.62);
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
    col += vec3(1.00, 0.90, 0.72) * pow(s, 90.0) * 0.55;
    col += vec3(1.00, 0.70, 0.50) * pow(s, 8.0)  * 0.14;
    float band = sin((h * 20.0) + uTime * 0.05) * 0.5 + 0.5;
    band *= smoothstep(0.04, 0.20, h) * (1.0 - smoothstep(0.20, 0.40, h));
    col += vec3(1.0, 0.86, 0.70) * band * 0.08;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ===================== Helpers ===================== */

function _slug(s){
  return String(s || '').toLowerCase()
    .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
}

function _tierOf(track){
  if (track.featured) return 'featured';
  if (track.new || track['new']) return 'new';
  return 'archive';
}

function _easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
function _easeInOutCubic(t){
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function _bakeBannerTexture(title, tier){
  const W = 192, H = 640;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  const baseRed = tier === 'featured'
    ? 'rgb(232,42,52)'
    : tier === 'new' ? 'rgb(212,32,44)' : 'rgb(178,28,38)';
  g.fillStyle = baseRed;
  g.fillRect(0, 0, W, H);

  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.fillRect(0, 0, W, 8);
  g.fillRect(0, H - 8, W, 8);

  g.strokeStyle = 'rgba(232,42,52,0.95)';
  g.lineWidth = 3;
  for (let x = -H; x < W + H; x += 12){
    g.beginPath(); g.moveTo(x, 0);     g.lineTo(x + 8, 8);     g.stroke();
    g.beginPath(); g.moveTo(x, H - 8); g.lineTo(x + 8, H);     g.stroke();
  }

  g.fillStyle = 'rgba(255,255,255,0.78)';
  g.fillRect(0, 8, 2, H - 16);
  g.fillRect(W - 2, 8, 2, H - 16);

  const text = String(title || '').toUpperCase();
  const fontPx = tier === 'featured' ? 68 : 56;
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(-Math.PI / 2);
  g.font = `900 ${fontPx}px "Space Grotesk", Inter, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  const maxW = H - 60;
  const m = g.measureText(text);
  let scale = 1;
  if (m.width > maxW) scale = maxW / m.width;
  if (scale !== 1) g.scale(scale, scale);
  g.fillText(text, 0, 0);
  g.restore();

  g.fillStyle = 'rgba(255,255,255,0.72)';
  g.font = `700 14px "Space Grotesk", system-ui`;
  g.textAlign = 'right';
  g.fillText(tier.toUpperCase(), W - 12, H - 22);

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/* ===================== Shared materials ===================== */

const SHARED = {};

function ensureShared(){
  if (SHARED.concrete) return;
  SHARED.concrete   = new THREE.MeshLambertMaterial({ color: 0xfaf6ec });
  SHARED.concreteHi = new THREE.MeshLambertMaterial({ color: 0xfffaf0 });
  SHARED.concreteLo = new THREE.MeshLambertMaterial({ color: 0xe2dccc });
  SHARED.concreteDk = new THREE.MeshLambertMaterial({ color: 0x9c958a });
  SHARED.rail       = new THREE.MeshLambertMaterial({ color: 0x32323a });
  SHARED.yellow     = new THREE.MeshLambertMaterial({ color: 0xffd435 });
  SHARED.vent       = new THREE.MeshLambertMaterial({ color: 0x82828c });
  SHARED.helBody    = new THREE.MeshLambertMaterial({ color: 0xffffff });
  SHARED.glass      = new THREE.MeshStandardMaterial({
    color: 0x9cc6d8, roughness: 0.10, metalness: 0.0,
    transparent: true, opacity: 0.65,
  });
  SHARED.glassWarm  = new THREE.MeshStandardMaterial({
    color: 0xe6a878, roughness: 0.18, metalness: 0.0,
    transparent: true, opacity: 0.55,
  });
  SHARED.redAccent  = new THREE.MeshBasicMaterial({ color: 0xdd1a2a });
  SHARED.helRotor   = new THREE.MeshBasicMaterial({ color: 0x18181c, transparent: true, opacity: 0.55 });
  SHARED.blink      = new THREE.MeshBasicMaterial({ color: 0xff3a3a });
  SHARED.bird       = new THREE.MeshBasicMaterial({ color: 0x1a1a22 });

  // Rooftop props.
  SHARED.solarPanel  = new THREE.MeshLambertMaterial({ color: 0x14182a });
  SHARED.helipadDark = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
  SHARED.helipadLine = new THREE.MeshBasicMaterial({ color: 0xffe96a });
  SHARED.pipeMat     = new THREE.MeshLambertMaterial({ color: 0xb0a890 });
  SHARED.plankMat    = new THREE.MeshLambertMaterial({ color: 0x6c5132 });
  SHARED.cable       = new THREE.MeshLambertMaterial({ color: 0x121218 });
  SHARED.dish        = new THREE.MeshLambertMaterial({ color: 0xe8e4d8 });
  SHARED.gardenLeaf  = new THREE.MeshLambertMaterial({ color: 0x2c5a30 });
  SHARED.gardenPlant = new THREE.MeshLambertMaterial({ color: 0x3a8a40 });

  // Character.
  SHARED.runnerShirt = new THREE.MeshLambertMaterial({ color: 0xdd1a2a });
  SHARED.runnerJacket= new THREE.MeshLambertMaterial({ color: 0xb01828 });
  SHARED.runnerSkin  = new THREE.MeshLambertMaterial({ color: 0xe8c0a0 });
  SHARED.runnerHair  = new THREE.MeshLambertMaterial({ color: 0x1f1818 });
  SHARED.runnerPant  = new THREE.MeshLambertMaterial({ color: 0x1c1c26 });
  SHARED.runnerShoe  = new THREE.MeshLambertMaterial({ color: 0xf6f6f6 });
}

/* ===================== Module ===================== */

const JUMP = {
  root: null, ctx: null, container: null,
  renderer: null, scene: null, camera: null, composer: null, bloom: null,
  raf: 0, clock: null,

  buildings: [],     // all buildings
  songRoofs: [],     // subset that have a banner (one per track)
  banners: [],
  helicopter: null,
  birds: [],
  sky: null, skyMat: null,

  // Character / motion.
  character: null,
  pendingJump: null,
  godView: false,
  godFly: null,

  // Camera orbit.
  cam: { az: -0.6, el: 0.38, dist: 18, az0: 0, el0: 0 },
  camTarget: null,
  camPosNow: null,

  // Audio.
  audioCtx: null, analyser: null, freqArr: null,
  bass: 0, mid: 0, hi: 0,

  // Input.
  drag: null, pinch: null,
  ray: null, mouse: null,
  hovered: null,
  focusedIdx: -1,

  // Filter / search.
  filter: 'all', query: '',

  // HUD refs.
  hudEl: null, transportEl: null,
  _filterChips: null, _searchEl: null,
  _activeTitleEl: null, _activeTierEl: null,
  _ovBtn: null,
  _tpTitle: null, _tpTime: null, _tpFill: null, _tpPlay: null,

  destroyed: false,

  /* ---------- Init ---------- */
  init(container, ctx){
    if (this.renderer) return;
    ensureShared();
    this.ctx = ctx || {};
    this.container = container;
    this.destroyed = false;
    this.buildings = [];
    this.songRoofs = [];
    this.banners = [];
    this.birds = [];
    this.connections = [];
    this.filter = ctx.filter || 'all';
    this.query  = (ctx.query || '').toLowerCase();
    this.bass = 0; this.mid = 0; this.hi = 0;
    this.godView = false;
    this.hovered = null;
    this.focusedIdx = -1;
    this.cam = { az: -0.6, el: 0.38, dist: 18, az0: 0, el0: 0 };
    this.camTarget = new THREE.Vector3();
    this.camPosNow = new THREE.Vector3();

    container.style.position = 'absolute';
    container.style.inset = '0';
    container.style.background = '#dfe5ea';
    container.style.overflow = 'hidden';

    const canvas = document.createElement('canvas');
    canvas.className = 'tj-canvas';
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width  = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'none';
    container.appendChild(canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
    this.renderer.setClearColor(0xc8d6dc, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xe2cab0, 220, 1400);

    // Sun matches the sky shader's pinned sun direction.
    const sun = new THREE.DirectionalLight(0xfff2dc, 1.55);
    sun.position.set(500, 160, 1000);
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.scene.add(new THREE.HemisphereLight(0xc8d8e0, 0xff9560, 0.70));
    this.scene.add(new THREE.AmbientLight(0xfff0e0, 0.38));

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 6000);

    this.drag  = { active: false, lx: 0, ly: 0, totalPx: 0 };
    this.pinch = { active: false, d0: 0, r0: 0 };
    this.walk  = {
      keys: { fwd: false, back: false, left: false, right: false },
      lastDir: new THREE.Vector3(0, 0, 1),
    };

    this._buildSky();
    this._buildCity();
    this._buildBanners();
    this._buildCharacter();
    this._buildHelicopter();
    this._buildCranes();
    this._buildBirds();
    this._buildDistantSkyline();
    this._buildGround();

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
    this._onKeyUp        = this._onKeyUp.bind(this);
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
    window.addEventListener('keyup',   this._onKeyUp);
    canvas.addEventListener('click', this._onClick);
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  this._onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   this._onTouchEnd);

    this._onResize();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Mirror's-Edge-ier bloom: more strength on highlights, slightly lower
    // threshold so the red banners + sun glow hit the eye harder.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.62, 0.78, 0.72);
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
    const geo = new THREE.SphereGeometry(3200, 32, 24);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: SKY_VS, fragmentShader: SKY_FS,
      side: THREE.BackSide, depthWrite: false,
    });
    const sky = new THREE.Mesh(geo, mat);
    this.scene.add(sky);
    this.sky = sky;
    this.skyMat = mat;
  },

  /* ---------- City ---------- */
  _buildCity(){
    const GX = 14, GZ = 10;
    const STEP = 28;

    // Archetype distribution — varies the skyline silhouette and gives the
    // walkable rooftops different shapes (footprint vs. tower-top vs. cylinder).
    const ARCHES = [
      'cube', 'cube', 'cube',
      'setback', 'setback',
      'podiumtower', 'podiumtower',
      'slimslab',
      'cylinder',
    ];

    for (let gx = 0; gx < GX; gx++){
      for (let gz = 0; gz < GZ; gz++){
        const jx = (Math.random() - 0.5) * 6;
        const jz = (Math.random() - 0.5) * 6;
        const cx = (gx - GX / 2 + 0.5) * STEP + jx;
        const cz = (gz - GZ / 2 + 0.5) * STEP + jz;

        const dist = Math.hypot(gx - GX / 2 + 0.5, gz - GZ / 2 + 0.5);
        const distNorm = dist / Math.max(GX, GZ) * 2;
        const baseH = 20 + (1 - Math.min(1, distNorm)) * 36;
        const h = baseH + Math.random() * 36;

        const arch = ARCHES[Math.floor(Math.random() * ARCHES.length)];
        let b;
        if      (arch === 'setback')     b = this._archSetback(cx, cz, h);
        else if (arch === 'podiumtower') b = this._archPodiumTower(cx, cz, h);
        else if (arch === 'slimslab')    b = this._archSlimSlab(cx, cz, h);
        else if (arch === 'cylinder')    b = this._archCylinder(cx, cz, h);
        else                              b = this._archCube(cx, cz, h);

        this._addRooftopProps(b);
        this.buildings.push(b);
      }
    }

    this._buildConnections();
  },

  _concreteFor(){
    const r = Math.random();
    if (r < 0.12) return SHARED.concreteHi;
    if (r < 0.28) return SHARED.concreteLo;
    return SHARED.concrete;
  },

  _addBuildingFacade(cx, cz, w, h, d, opts = {}){
    // Glass strip on one face — picks up specular sun.
    if (!opts.skipGlass && Math.random() < 0.70){
      const stripW = w * (0.22 + Math.random() * 0.28);
      const stripH = h * (0.58 + Math.random() * 0.32);
      const glassMat = Math.random() < 0.20 ? SHARED.glassWarm : SHARED.glass;
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(stripW, stripH), glassMat
      );
      const face = Math.floor(Math.random() * 4);
      const off = 0.02;
      const yC = h / 2;
      if (face === 0){       strip.position.set(cx,           yC, cz + d/2 + off); }
      else if (face === 1){  strip.position.set(cx,           yC, cz - d/2 - off); strip.rotation.y = Math.PI; }
      else if (face === 2){  strip.position.set(cx + w/2 + off, yC, cz);           strip.rotation.y = -Math.PI/2; }
      else {                 strip.position.set(cx - w/2 - off, yC, cz);           strip.rotation.y =  Math.PI/2; }
      this.scene.add(strip);
    }

    // Vertical accent stripe along one corner.
    if (Math.random() < 0.32){
      const accent = Math.random() < 0.62 ? SHARED.redAccent : SHARED.yellow;
      const aw = 0.30, ah = h * 0.90;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(aw, ah, 0.20), accent);
      const sx = Math.random() < 0.5 ? -w/2 + 0.30 : w/2 - 0.30;
      stripe.position.set(cx + sx, h / 2, cz + d/2 + 0.05);
      this.scene.add(stripe);
    }
  },

  _archCube(cx, cz, h){
    const w = 14 + Math.random() * 9;
    const d = 14 + Math.random() * 9;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._concreteFor());
    body.position.set(cx, h / 2, cz);
    this.scene.add(body);
    this._addBuildingFacade(cx, cz, w, h, d);
    return {
      cx, cz, w, d, h, mesh: body, archetype: 'cube',
      walkable: { cx, cz, w: w - 1.6, d: d - 1.6, h },
      trackIdx: -1,
    };
  },

  _archSetback(cx, cz, totalH){
    const w = 16 + Math.random() * 8;
    const d = 16 + Math.random() * 8;
    const h1 = totalH * (0.55 + Math.random() * 0.10);
    const h2 = totalH - h1;
    const mat = this._concreteFor();
    const lower = new THREE.Mesh(new THREE.BoxGeometry(w, h1, d), mat);
    lower.position.set(cx, h1 / 2, cz);
    this.scene.add(lower);
    const w2 = w * (0.60 + Math.random() * 0.15);
    const d2 = d * (0.60 + Math.random() * 0.15);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, d2), mat);
    upper.position.set(cx, h1 + h2 / 2, cz);
    this.scene.add(upper);
    this._addBuildingFacade(cx, cz, w, h1, d);
    return {
      cx, cz, w, d, h: totalH, mesh: upper, archetype: 'setback',
      walkable: { cx, cz, w: w2 - 1.4, d: d2 - 1.4, h: totalH },
      trackIdx: -1,
    };
  },

  _archPodiumTower(cx, cz, totalH){
    const wP = 18 + Math.random() * 8;
    const dP = 18 + Math.random() * 8;
    const hP = 6 + Math.random() * 6;
    const wT = 10 + Math.random() * 5;
    const dT = 10 + Math.random() * 5;
    const hT = totalH - hP;
    const mat = this._concreteFor();
    const podium = new THREE.Mesh(new THREE.BoxGeometry(wP, hP, dP), mat);
    podium.position.set(cx, hP / 2, cz);
    this.scene.add(podium);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(wT, hT, dT), mat);
    tower.position.set(cx, hP + hT / 2, cz);
    this.scene.add(tower);
    this._addBuildingFacade(cx, cz, wT, hT, dT);
    return {
      cx, cz, w: wP, d: dP, h: totalH, mesh: tower, archetype: 'podiumtower',
      walkable: { cx, cz, w: wT - 1.4, d: dT - 1.4, h: totalH },
      trackIdx: -1,
    };
  },

  _archSlimSlab(cx, cz, totalH){
    const w = 8 + Math.random() * 4;
    const d = 12 + Math.random() * 5;
    const h = totalH * 1.15;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._concreteFor());
    body.position.set(cx, h / 2, cz);
    this.scene.add(body);
    this._addBuildingFacade(cx, cz, w, h, d);
    return {
      cx, cz, w, d, h, mesh: body, archetype: 'slimslab',
      walkable: { cx, cz, w: w - 0.8, d: d - 0.8, h },
      trackIdx: -1,
    };
  },

  _archCylinder(cx, cz, totalH){
    const r = 8 + Math.random() * 3;
    const h = totalH;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, h, 24), this._concreteFor()
    );
    body.position.set(cx, h / 2, cz);
    this.scene.add(body);
    // Vertical glass band wrapping cylinder (just a thin shorter cylinder).
    if (Math.random() < 0.65){
      const bandH = h * (0.50 + Math.random() * 0.32);
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(r + 0.05, r + 0.05, bandH, 24, 1, true),
        SHARED.glass
      );
      band.position.set(cx, h * (0.20 + Math.random() * 0.40), cz);
      this.scene.add(band);
    }
    const side = r * Math.SQRT2 * 0.78;
    return {
      cx, cz, w: r * 2, d: r * 2, h, mesh: body, archetype: 'cylinder',
      walkable: { cx, cz, w: side, d: side, h },
      trackIdx: -1,
    };
  },

  /* ---------- Rooftop prop variants ---------- */
  _addRooftopProps(b){
    const propGroup = new THREE.Group();
    const k = b.walkable;

    // Parapet around the walkable edge — defines the rooftop silhouette
    // instead of leaving a raw cube top. Skipped on cylinders + slim slabs
    // since their walkable is too small to look right with a frame.
    if (b.archetype !== 'cylinder' && b.archetype !== 'slimslab'){
      const pH = 0.36, pT = 0.20;
      const mat = SHARED.concreteHi;
      // Four sides (a frame, not a closed box, so the rooftop reads as walkable).
      const north = new THREE.Mesh(new THREE.BoxGeometry(k.w + pT * 2, pH, pT), mat);
      north.position.set(k.cx, k.h + pH / 2, k.cz + k.d / 2 + pT / 2);
      propGroup.add(north);
      const south = new THREE.Mesh(new THREE.BoxGeometry(k.w + pT * 2, pH, pT), mat);
      south.position.set(k.cx, k.h + pH / 2, k.cz - k.d / 2 - pT / 2);
      propGroup.add(south);
      const east = new THREE.Mesh(new THREE.BoxGeometry(pT, pH, k.d), mat);
      east.position.set(k.cx + k.w / 2 + pT / 2, k.h + pH / 2, k.cz);
      propGroup.add(east);
      const west = new THREE.Mesh(new THREE.BoxGeometry(pT, pH, k.d), mat);
      west.position.set(k.cx - k.w / 2 - pT / 2, k.h + pH / 2, k.cz);
      propGroup.add(west);
    }

    const kinds = ['vent', 'helipad', 'water', 'solar', 'antenna', 'garden', 'empty'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];

    if (kind === 'vent'){
      this._propVent(propGroup, k);
    } else if (kind === 'helipad'){
      this._propHelipad(propGroup, k);
    } else if (kind === 'water'){
      this._propWaterTower(propGroup, k);
    } else if (kind === 'solar'){
      this._propSolarPanels(propGroup, k);
    } else if (kind === 'antenna'){
      this._propAntennaFarm(propGroup, k);
    } else if (kind === 'garden'){
      this._propGarden(propGroup, k);
    }
    // 'empty' = no rooftop props

    // Tall buildings get an extra antenna+blink even on top of base props.
    if (b.h > 38 && kind !== 'antenna' && kind !== 'helipad' && Math.random() < 0.45){
      const poleH = 1.6 + Math.random() * 2.4;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, poleH, 6), SHARED.rail
      );
      const px = k.cx + (Math.random() - 0.5) * k.w * 0.4;
      const pz = k.cz + (Math.random() - 0.5) * k.d * 0.4;
      pole.position.set(px, k.h + poleH / 2, pz);
      propGroup.add(pole);
      const blink = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 6, 5), SHARED.blink
      );
      blink.position.set(px, k.h + poleH + 0.22, pz);
      propGroup.add(blink);
    }

    this.scene.add(propGroup);
    b.propGroup = propGroup;
    b.propKind = kind;
  },

  _propVent(g, k){
    // Big HVAC unit with a few smaller boxes around it.
    const main = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 1.0, 2.0), SHARED.vent
    );
    const mx = k.cx + (Math.random() - 0.5) * (k.w - 4);
    const mz = k.cz + (Math.random() - 0.5) * (k.d - 4);
    main.position.set(mx, k.h + 0.5, mz);
    g.add(main);

    for (let i = 0; i < 2; i++){
      const small = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.6, 0.8), SHARED.vent
      );
      small.position.set(
        mx + (Math.random() - 0.5) * 3,
        k.h + 0.3,
        mz + (Math.random() - 0.5) * 3,
      );
      g.add(small);
    }

    // A small pipe bend off the main unit.
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8), SHARED.pipeMat
    );
    pipe.position.set(mx + 1.6, k.h + 0.7, mz);
    pipe.rotation.z = Math.PI / 2;
    g.add(pipe);
  },

  _propHelipad(g, k){
    // Dark circular pad + yellow "H" + 4 perimeter lights.
    const radius = Math.min(k.w, k.d) * 0.32;
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.10, 28), SHARED.helipadDark
    );
    pad.position.set(k.cx, k.h + 0.05, k.cz);
    g.add(pad);

    // Yellow ring.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.86, radius * 0.94, 28),
      SHARED.helipadLine
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(k.cx, k.h + 0.11, k.cz);
    g.add(ring);

    // H letter (3 boxes).
    const hMat = SHARED.helipadLine;
    const hW = radius * 0.16, hH = 0.04, hL = radius * 0.7;
    const left  = new THREE.Mesh(new THREE.BoxGeometry(hW, hH, hL), hMat);
    const right = new THREE.Mesh(new THREE.BoxGeometry(hW, hH, hL), hMat);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(hL * 0.62, hH, hW), hMat);
    left .position.set(k.cx - radius * 0.30, k.h + 0.13, k.cz);
    right.position.set(k.cx + radius * 0.30, k.h + 0.13, k.cz);
    cross.position.set(k.cx,                 k.h + 0.13, k.cz);
    g.add(left); g.add(right); g.add(cross);

    // 4 LED markers around perimeter.
    for (let i = 0; i < 4; i++){
      const ang = i * Math.PI / 2;
      const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 6, 5), SHARED.blink
      );
      led.position.set(
        k.cx + Math.cos(ang) * (radius + 0.6),
        k.h + 0.12,
        k.cz + Math.sin(ang) * (radius + 0.6),
      );
      g.add(led);
    }
  },

  _propWaterTower(g, k){
    const tankR = 0.9;
    const tankH = 2.2;
    const legH  = 1.6;
    const tx = k.cx + (Math.random() - 0.5) * (k.w - 3.0);
    const tz = k.cz + (Math.random() - 0.5) * (k.d - 3.0);

    // Legs.
    for (let i = 0; i < 4; i++){
      const ang = i * Math.PI / 2 + Math.PI / 4;
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, legH, 0.14), SHARED.rail
      );
      leg.position.set(
        tx + Math.cos(ang) * tankR * 0.85,
        k.h + legH / 2,
        tz + Math.sin(ang) * tankR * 0.85,
      );
      g.add(leg);
    }

    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(tankR, tankR, tankH, 14), SHARED.concreteDk
    );
    tank.position.set(tx, k.h + legH + tankH / 2, tz);
    g.add(tank);

    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(tankR + 0.05, 0.7, 14), SHARED.concreteDk
    );
    cap.position.set(tx, k.h + legH + tankH + 0.35, tz);
    g.add(cap);

    // Side ladder.
    const lr = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, legH + tankH, 0.06), SHARED.rail
    );
    lr.position.set(tx + tankR + 0.1, k.h + (legH + tankH) / 2, tz);
    g.add(lr);
    for (let rung = 0; rung < 6; rung++){
      const ry = k.h + 0.4 + rung * 0.5;
      const rg = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.05, 0.05), SHARED.rail
      );
      rg.position.set(tx + tankR + 0.1, ry, tz);
      g.add(rg);
    }
  },

  _propSolarPanels(g, k){
    // 3x3 grid of dark tilted panels.
    const cols = 3, rows = 3;
    const panelW = (k.w * 0.65) / cols;
    const panelD = (k.d * 0.65) / rows;
    const ox = k.cx - (cols - 1) * panelW * 0.5;
    const oz = k.cz - (rows - 1) * panelD * 0.5;
    for (let r = 0; r < rows; r++){
      for (let c = 0; c < cols; c++){
        const px = ox + c * panelW;
        const pz = oz + r * panelD;
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(panelW * 0.85, 0.08, panelD * 0.85),
          SHARED.solarPanel
        );
        panel.rotation.x = -0.28;
        panel.position.set(px, k.h + 0.45, pz);
        g.add(panel);
        // Front leg.
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.55, 0.08), SHARED.rail
        );
        leg.position.set(px, k.h + 0.28, pz + panelD * 0.30);
        g.add(leg);
      }
    }
  },

  _propAntennaFarm(g, k){
    // 3-4 thin poles + 1 dish, no helipad markings.
    const count = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++){
      const poleH = 2.0 + Math.random() * 3.0;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, poleH, 6), SHARED.rail
      );
      const px = k.cx + (Math.random() - 0.5) * (k.w * 0.6);
      const pz = k.cz + (Math.random() - 0.5) * (k.d * 0.6);
      pole.position.set(px, k.h + poleH / 2, pz);
      g.add(pole);
      // Crossbars.
      const cross = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.04, 0.04), SHARED.rail
      );
      cross.position.set(px, k.h + poleH * 0.7, pz);
      g.add(cross);
      if (Math.random() < 0.55){
        const blink = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 6, 5), SHARED.blink
        );
        blink.position.set(px, k.h + poleH + 0.18, pz);
        g.add(blink);
      }
    }
    // Satellite dish.
    const dishR = 0.7;
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(dishR, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      SHARED.dish
    );
    dish.rotation.x = Math.PI;       // bowl facing up-and-out
    dish.rotation.z = 0.6;
    const dx = k.cx + (Math.random() - 0.5) * (k.w * 0.5);
    const dz = k.cz + (Math.random() - 0.5) * (k.d * 0.5);
    dish.position.set(dx, k.h + 0.9, dz);
    g.add(dish);
    const mount = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 1.0, 0.18), SHARED.rail
    );
    mount.position.set(dx, k.h + 0.5, dz);
    g.add(mount);
  },

  _propGarden(g, k){
    // Stylized low-poly garden: terracotta-ish planters + stacked cone foliage
    // (not spheres — the previous "literal balls" got called out).
    const planterMat = SHARED.concreteDk;
    const planterW = k.w * 0.84, planterD = 1.1, planterH = 0.50;

    const planters = [
      { px: k.cx, pz: k.cz + k.d / 2 - planterD - 0.5 },
      { px: k.cx, pz: k.cz - k.d / 2 + planterD + 0.5 },
    ];
    for (const p of planters){
      // Planter box.
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(planterW, planterH, planterD), planterMat
      );
      box.position.set(p.px, k.h + planterH / 2, p.pz);
      g.add(box);
      // Inner soil strip (darker, slightly recessed).
      const soil = new THREE.Mesh(
        new THREE.BoxGeometry(planterW * 0.94, 0.08, planterD * 0.78),
        SHARED.runnerHair
      );
      soil.position.set(p.px, k.h + planterH - 0.04, p.pz);
      g.add(soil);

      const plantCount = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < plantCount; i++){
        const bx = p.px + (i / Math.max(1, plantCount - 1) - 0.5) * (planterW * 0.78);
        const bz = p.pz + (Math.random() - 0.5) * (planterD * 0.4);
        const dark = Math.random() < 0.5;
        const leafMat = dark ? SHARED.gardenLeaf : SHARED.gardenPlant;
        const kind = Math.floor(Math.random() * 3);
        if (kind === 0){
          // Stacked conifer: 3 cones of decreasing radius, low-poly (5 sides).
          const heights = [0.65, 0.55, 0.42];
          const radii   = [0.55, 0.42, 0.30];
          let y = k.h + planterH;
          for (let s = 0; s < heights.length; s++){
            const cone = new THREE.Mesh(
              new THREE.ConeGeometry(radii[s], heights[s], 5),
              leafMat
            );
            cone.position.set(bx, y + heights[s] / 2 - 0.10, bz);
            cone.rotation.y = Math.random() * Math.PI * 2;
            g.add(cone);
            y += heights[s] - 0.18;
          }
          // Thin trunk.
          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.07, 0.30, 6),
            SHARED.runnerHair
          );
          trunk.position.set(bx, k.h + planterH + 0.15, bz);
          g.add(trunk);
        } else if (kind === 1){
          // Pruned topiary: low-poly icosahedron (no smooth-shaded ball).
          const r = 0.36 + Math.random() * 0.10;
          const topiary = new THREE.Mesh(
            new THREE.IcosahedronGeometry(r, 0),
            leafMat
          );
          topiary.position.set(bx, k.h + planterH + r * 0.95, bz);
          topiary.rotation.y = Math.random() * Math.PI * 2;
          topiary.scale.set(1, 1.10, 1);
          g.add(topiary);
          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.07, 0.30, 6),
            SHARED.runnerHair
          );
          trunk.position.set(bx, k.h + planterH + 0.15, bz);
          g.add(trunk);
        } else {
          // Tall grass clump: 4-6 thin tapered cones leaning outward.
          const blades = 4 + Math.floor(Math.random() * 3);
          for (let bld = 0; bld < blades; bld++){
            const ang = (bld / blades) * Math.PI * 2 + Math.random() * 0.4;
            const blade = new THREE.Mesh(
              new THREE.ConeGeometry(0.06, 0.50 + Math.random() * 0.18, 4),
              leafMat
            );
            blade.position.set(
              bx + Math.cos(ang) * 0.10,
              k.h + planterH + 0.28,
              bz + Math.sin(ang) * 0.10,
            );
            blade.rotation.z = Math.cos(ang) * 0.30;
            blade.rotation.x = Math.sin(ang) * 0.30;
            g.add(blade);
          }
        }
      }
    }
  },

  /* ---------- Connections between adjacent rooftops ---------- */
  _buildConnections(){
    // For each building, find close neighbors and add a visible link.
    const seen = new Set();
    for (let i = 0; i < this.buildings.length; i++){
      const a = this.buildings[i];
      // Up to 2 connections per building, capped on length.
      const neighbors = [];
      for (let j = 0; j < this.buildings.length; j++){
        if (i === j) continue;
        const b = this.buildings[j];
        const dx = b.cx - a.cx;
        const dz = b.cz - a.cz;
        const planar = Math.hypot(dx, dz);
        const dy = Math.abs(b.walkable.h - a.walkable.h);
        if (planar > 36 || planar < 14) continue;
        if (dy > 14) continue;
        neighbors.push({ b, d: planar + dy * 0.6 });
      }
      neighbors.sort((x, y) => x.d - y.d);
      const take = neighbors.slice(0, 2);
      for (const n of take){
        const key = i < this.buildings.indexOf(n.b)
          ? `${i}-${this.buildings.indexOf(n.b)}`
          : `${this.buildings.indexOf(n.b)}-${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (Math.random() < 0.55) this._addConnection(a, n.b);
      }
    }
  },

  _addConnection(a, b){
    const ay = a.walkable.h;
    const by = b.walkable.h;
    const dx = b.cx - a.cx;
    const dz = b.cz - a.cz;
    const dy = by - ay;
    const planar = Math.hypot(dx, dz);

    // Edge pickup points: project the bearing onto each rooftop's rectangle
    // and snap to the actual edge (not a fraction of half-extent), so the
    // connection mesh starts AT the parapet, not floating inside the roof.
    const ang = Math.atan2(dx, dz);
    const edgeOf = (roof, sgn) => {
      const k = roof.walkable;
      const sx = Math.sin(ang), sz = Math.cos(ang);
      const halfW = k.w / 2, halfD = k.d / 2;
      // Scale factor to ray (sx, sz) until it hits the rectangle edge.
      const tx = sx !== 0 ? halfW / Math.abs(sx) : Infinity;
      const tz = sz !== 0 ? halfD / Math.abs(sz) : Infinity;
      const s = Math.min(tx, tz) - 0.12;       // tuck slightly inside parapet
      return { x: k.cx + sgn * sx * s, z: k.cz + sgn * sz * s };
    };
    const eA = edgeOf(a,  1);
    const eB = edgeOf(b, -1);
    const ax = eA.x, az = eA.z;
    const bx = eB.x, bz = eB.z;

    const len = Math.hypot(bx - ax, bz - az);
    const midX = (ax + bx) / 2;
    const midZ = (az + bz) / 2;
    const midY = (ay + by) / 2;
    const yawY = Math.atan2(bx - ax, bz - az);
    const pitchAng = Math.atan2(by - ay, len);
    const slant = Math.hypot(len, by - ay);
    const r = Math.random();

    let type;
    let walkTopOffset = 0.36;  // local-y from connection rest line to standable surface

    if (Math.abs(dy) > 6){
      type = 'cable';
      // Sagging cable — 3 segments between droop points so it reads as
      // a real catenary, not a stiff rod.
      const segs = 3;
      const sag = Math.min(1.6, slant * 0.06);
      const pts = [];
      for (let i = 0; i <= segs; i++){
        const t = i / segs;
        const px = ax + (bx - ax) * t;
        const pz = az + (bz - az) * t;
        const py = ay + (by - ay) * t - Math.sin(t * Math.PI) * sag;
        pts.push(new THREE.Vector3(px, py, pz));
      }
      for (let i = 0; i < segs; i++){
        const p0 = pts[i], p1 = pts[i + 1];
        const segLen = p0.distanceTo(p1);
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.07, segLen, 6), SHARED.cable
        );
        seg.position.set((p0.x + p1.x)/2, (p0.y + p1.y)/2, (p0.z + p1.z)/2);
        const dir = p1.clone().sub(p0).normalize();
        seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        this.scene.add(seg);
      }
      // Anchor pylons on each rooftop edge.
      for (const e of [[ax, ay, az], [bx, by, bz]]){
        const anchor = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.22, 0.6, 8), SHARED.rail
        );
        anchor.position.set(e[0], e[1] + 0.3, e[2]);
        this.scene.add(anchor);
      }
      walkTopOffset = 0.10;     // standing on a cable hand-over-hand
    } else if (r < 0.55){
      type = 'pipe';
      // Main pipe with flange collars + 2 support brackets along its length.
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.30, 0.30, slant, 14), SHARED.pipeMat
      );
      pipe.position.set(midX, midY + 0.30, midZ);
      pipe.rotation.y = yawY;
      pipe.rotation.x = Math.PI / 2 - pitchAng;
      this.scene.add(pipe);

      // Inner-darker stripe (visual depth on the pipe).
      const stripe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.305, 0.305, slant, 14, 1, true),
        SHARED.rail
      );
      stripe.position.copy(pipe.position);
      stripe.rotation.copy(pipe.rotation);
      stripe.scale.set(1, 0.18, 1);
      this.scene.add(stripe);

      // Flange collars at each end (wider rings).
      for (const e of [[ax, ay, az], [bx, by, bz]]){
        const flange = new THREE.Mesh(
          new THREE.CylinderGeometry(0.46, 0.46, 0.22, 14), SHARED.rail
        );
        flange.position.set(e[0], e[1] + 0.30, e[2]);
        flange.rotation.y = yawY;
        flange.rotation.x = Math.PI / 2 - pitchAng;
        this.scene.add(flange);
      }

      // Bracket supports at 1/3 and 2/3.
      for (const t of [0.33, 0.67]){
        const sx = ax + (bx - ax) * t;
        const sy = ay + (by - ay) * t;
        const sz = az + (bz - az) * t;
        const bracket = new THREE.Mesh(
          new THREE.BoxGeometry(0.40, 0.10, 0.18), SHARED.rail
        );
        bracket.position.set(sx, sy + 0.30, sz);
        bracket.rotation.y = yawY;
        this.scene.add(bracket);
      }
      walkTopOffset = 0.60;
    } else {
      type = 'plank';
      // Multi-plank wooden deck: 4 narrow planks side by side with gaps,
      // gives the bridge real geometry instead of one slab.
      const planks = 4;
      const totalWidth = 1.6;
      const pw = totalWidth / planks * 0.85;
      for (let p = 0; p < planks; p++){
        const offX = (p / (planks - 1) - 0.5) * totalWidth;
        const plank = new THREE.Mesh(
          new THREE.BoxGeometry(pw, 0.14, slant), SHARED.plankMat
        );
        const cos = Math.cos(yawY), sin = Math.sin(yawY);
        plank.position.set(
          midX + offX * cos,
          midY + 0.18,
          midZ - offX * sin,
        );
        plank.rotation.y = yawY;
        plank.rotation.x = -pitchAng;
        this.scene.add(plank);
      }
      // 4 corner posts + 2 side rails.
      const cos = Math.cos(yawY), sin = Math.sin(yawY);
      for (const sx of [-0.85, 0.85]){
        // Top rail.
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.08, slant), SHARED.rail
        );
        rail.position.set(midX + sx * cos, midY + 0.95, midZ - sx * sin);
        rail.rotation.y = yawY;
        rail.rotation.x = -pitchAng;
        this.scene.add(rail);
        // 3 posts along each side.
        for (const t of [0.05, 0.5, 0.95]){
          const px = ax + (bx - ax) * t;
          const pz = az + (bz - az) * t;
          const py = ay + (by - ay) * t;
          const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.85, 0.08), SHARED.rail
          );
          post.position.set(px + sx * cos, py + 0.60, pz - sx * sin);
          this.scene.add(post);
        }
      }
      walkTopOffset = 0.36;
    }

    // Record the connection so _tryJump can route the character across it
    // with a traversal animation instead of a parabolic leap.
    this.connections.push({
      a, b, type,
      endA: new THREE.Vector3(ax, ay + walkTopOffset, az),
      endB: new THREE.Vector3(bx, by + walkTopOffset, bz),
      length: len,
    });
  },

  _findConnection(a, b){
    return this.connections.find(c =>
      (c.a === a && c.b === b) || (c.a === b && c.b === a)
    );
  },

  /* ---------- Banners (one per track) ---------- */
  _buildBanners(){
    const tracks = (this.ctx.tracks || []).slice();
    if (!tracks.length || !this.buildings.length) return;

    // Featured tracks get the tallest most-central rooftops; new tracks get
    // mid-pop ones; archive fills out the rest. Center-distance sorts ties.
    const buildings = this.buildings.slice();
    buildings.forEach(b => {
      b.score = b.walkable.h - Math.hypot(b.cx, b.cz) * 0.12;
    });
    buildings.sort((a, b) => b.score - a.score);

    const featuredTracks = tracks.filter(t => t.featured);
    const newTracks      = tracks.filter(t => !t.featured && (t.new || t['new']));
    const archiveTracks  = tracks.filter(t => !t.featured && !(t.new || t['new']));
    const ordered = [...featuredTracks, ...newTracks, ...archiveTracks];

    for (let i = 0; i < ordered.length && i < buildings.length; i++){
      const b = buildings[i];
      const t = ordered[i];
      const trackIdx = tracks.indexOf(t);
      b.trackIdx = trackIdx;
      b.track = t;
      b.tier = _tierOf(t);
      this.songRoofs.push(b);
      this._addBanner(b);
    }
  },

  _addBanner(roof){
    const tier = roof.tier;
    const tex = _bakeBannerTexture(roof.track.title, tier);
    const mat = new THREE.MeshBasicMaterial({ map: tex });

    const bw = tier === 'featured' ? 4.0 : tier === 'new' ? 3.0 : 2.4;
    const bh = tier === 'featured' ? 12  : tier === 'new' ? 9   : 7;
    const bd = 0.30;
    const banner = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);

    // Mount on a back-edge of the walkable rooftop, facing the city center.
    const k = roof.walkable;
    const angToCenter = Math.atan2(-k.cx, -k.cz);
    const mountR = Math.min(k.w, k.d) * 0.42;
    const bx = k.cx + Math.cos(angToCenter + Math.PI) * mountR;
    const bz = k.cz + Math.sin(angToCenter + Math.PI) * mountR;
    banner.position.set(bx, k.h + bh / 2 + 0.5, bz);
    banner.rotation.y = angToCenter;
    this.scene.add(banner);

    // Base post (the banner stands on a thin metal pole).
    const poleH = 0.6;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, poleH, 6), SHARED.rail
    );
    pole.position.set(bx, k.h + poleH / 2, bz);
    this.scene.add(pole);

    // Halo plane behind banner — additive glow when active.
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xff3a44, transparent: true, opacity: 0.0,
      depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(bw * 3.2, bh * 1.7), haloMat
    );
    halo.position.set(bx, k.h + bh / 2 + 0.5, bz);
    halo.rotation.y = angToCenter;
    this.scene.add(halo);

    const data = {
      roof, mesh: banner, mat, tex, halo, haloMat,
      idx: roof.trackIdx, track: roof.track, tier,
      slug: _slug(roof.track.title),
      x: bx, y: k.h + bh / 2 + 0.5, z: bz,
      w: bw, h: bh, ang: angToCenter,
      visible: true,
    };
    banner.userData.banner = data;
    this.banners.push(data);
  },

  /* ---------- Character ---------- */
  _buildCharacter(){
    const g = new THREE.Group();
    // Feet at y=0, head crown near y=3.30. All offsets below are in local
    // group space so g.position = world feet position.

    // Hips (bridge between legs and torso).
    const hips = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 0.35, 0.50), SHARED.runnerPant
    );
    hips.position.y = 1.18;
    g.add(hips);

    // Torso — box shoulders, slight taper via two stacked boxes.
    const torsoLower = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.85, 0.50), SHARED.runnerShirt
    );
    torsoLower.position.y = 1.78;
    g.add(torsoLower);
    const torsoUpper = new THREE.Mesh(
      new THREE.BoxGeometry(1.00, 0.55, 0.55), SHARED.runnerJacket
    );
    torsoUpper.position.y = 2.46;
    g.add(torsoUpper);

    // Neck.
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 0.18, 8), SHARED.runnerSkin
    );
    neck.position.y = 2.82;
    g.add(neck);

    // Head (box-ish for chunky low-poly look).
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.66, 0.58), SHARED.runnerSkin
    );
    head.position.y = 3.20;
    g.add(head);

    // Hood: half-sphere sitting on the head, covering top + back.
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.50, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
      SHARED.runnerHair
    );
    hood.position.y = 3.32;
    g.add(hood);

    // Arms: two-segment with elbow pivot. Pivots at the shoulder.
    const upperArmGeo = new THREE.BoxGeometry(0.22, 0.55, 0.22);
    const foreArmGeo  = new THREE.BoxGeometry(0.20, 0.50, 0.20);
    const handGeo     = new THREE.BoxGeometry(0.24, 0.22, 0.22);

    const makeArm = (sx) => {
      const sh = new THREE.Group();
      sh.position.set(sx, 2.62, 0);
      const upper = new THREE.Mesh(upperArmGeo, SHARED.runnerJacket);
      upper.position.y = -0.275;
      sh.add(upper);

      const elbow = new THREE.Group();
      elbow.position.y = -0.55;
      sh.add(elbow);
      const fore = new THREE.Mesh(foreArmGeo, SHARED.runnerShirt);
      fore.position.y = -0.25;
      elbow.add(fore);
      const hand = new THREE.Mesh(handGeo, SHARED.runnerSkin);
      hand.position.y = -0.58;
      elbow.add(hand);
      g.add(sh);
      return { sh, elbow };
    };
    const lArm = makeArm(-0.58);
    const rArm = makeArm( 0.58);

    // Legs: two-segment with knee pivot. Pivots at the hip.
    const upperLegGeo = new THREE.BoxGeometry(0.30, 0.62, 0.30);
    const foreLegGeo  = new THREE.BoxGeometry(0.28, 0.58, 0.28);
    const shoeGeo     = new THREE.BoxGeometry(0.38, 0.18, 0.52);

    const makeLeg = (sx) => {
      const hip = new THREE.Group();
      hip.position.set(sx, 1.05, 0);
      const upper = new THREE.Mesh(upperLegGeo, SHARED.runnerPant);
      upper.position.y = -0.31;
      hip.add(upper);
      const knee = new THREE.Group();
      knee.position.y = -0.62;
      hip.add(knee);
      const fore = new THREE.Mesh(foreLegGeo, SHARED.runnerPant);
      fore.position.y = -0.29;
      knee.add(fore);
      const shoe = new THREE.Mesh(shoeGeo, SHARED.runnerShoe);
      shoe.position.set(0, -0.66, 0.05);
      knee.add(shoe);
      g.add(hip);
      return { hip, knee };
    };
    const lLeg = makeLeg(-0.20);
    const rLeg = makeLeg( 0.20);

    this.scene.add(g);

    const spawnRoof = this.songRoofs[0] || this.buildings[0];
    const sk = spawnRoof.walkable;
    const pos = new THREE.Vector3(sk.cx, sk.h, sk.cz);
    g.position.copy(pos);

    // Spawn facing away from the camera so we see the runner's back from
    // frame one (cam.az + π puts character forward along camera-forward).
    const spawnFacing = this.cam.az + Math.PI;
    g.rotation.y = spawnFacing;

    this.character = {
      group: g,
      head, hood,
      torsoLower, torsoUpper,
      lArm, rArm, lLeg, rLeg,
      pos,
      onRoof: spawnRoof,
      mode: 'roof',          // 'roof' | 'jump' | 'traverse' | 'fall'
      jumpT: 0, jumpDuration: 1.0,
      jumpStart: new THREE.Vector3(), jumpEnd: new THREE.Vector3(),
      apexY: 0,
      connectionPath: null,
      // Manual traversal state.
      traverseConn: null,
      traverseFrom: new THREE.Vector3(),
      traverseTo:   new THREE.Vector3(),
      traverseT: 0,
      traverseToRoof: null,
      // Falling state.
      fallVel: new THREE.Vector3(),
      fallSpin: { rx: 0, ry: 0, rz: 0 },
      // Common.
      facing: spawnFacing,
      facingTarget: spawnFacing,
      bodyBob: 0,
      walking: false,
      walkPhase: 0,
    };
  },

  _jumpTo(roof, play = true){
    if (!this.character) return;
    const c = this.character;
    if (c.mode !== 'roof') return;
    if (!roof || roof === c.onRoof) return;
    const start = c.pos.clone();
    const end = new THREE.Vector3(roof.walkable.cx, roof.walkable.h, roof.walkable.cz);
    const d = Math.hypot(end.x - start.x, end.z - start.z);
    c.jumpStart = start;
    c.jumpEnd = end;
    c.jumpDuration = Math.max(1.0, Math.min(2.6, 0.85 + d * 0.014));
    c.apexY = Math.max(start.y, end.y) + Math.min(28, 6 + d * 0.32);
    c.jumpT = 0;
    c.mode = 'jump';
    c.connectionPath = null;
    c.facingTarget = Math.atan2(end.x - start.x, end.z - start.z);
    c.targetRoof = roof;
    if (play && roof.trackIdx >= 0){
      this.focusedIdx = roof.trackIdx;
      this.ctx.onPlay?.(roof.trackIdx);
    }
  },

  _updateCharacter(dt){
    const c = this.character;
    if (!c) return;

    // Smooth facing toward target heading (skipped while falling — group
    // rotation is driven by ragdoll spin instead).
    if (c.mode !== 'fall'){
      let df = c.facingTarget - c.facing;
      while (df >  Math.PI) df -= Math.PI * 2;
      while (df < -Math.PI) df += Math.PI * 2;
      c.facing += df * Math.min(1, dt * 8);
      c.group.rotation.y = c.facing;
    }

    if (c.mode === 'jump')      { this._animateJump(dt); return; }
    if (c.mode === 'traverse')  { this._updateTraverse(dt); return; }
    if (c.mode === 'fall')      { this._updateFall(dt); return; }
    this._updateWalk(dt);
  },

  /* Phased jump animation: anticipation → liftoff → flight → tuck → land. */
  _animateJump(dt){
    const c = this.character;
    c.jumpT += dt / c.jumpDuration;
    const t = Math.min(1, c.jumpT);

    // Horizontal position eased.
    const eT = _easeInOutCubic(t);
    const x = c.jumpStart.x + (c.jumpEnd.x - c.jumpStart.x) * eT;
    const z = c.jumpStart.z + (c.jumpEnd.z - c.jumpStart.z) * eT;

    // Vertical quadratic Bezier (start → apex → end).
    const y0 = c.jumpStart.y, y1 = c.jumpEnd.y;
    const y  = (1 - t) * (1 - t) * y0
             + 2 * (1 - t) * t   * c.apexY
             +     t       * t   * y1;
    c.pos.set(x, y, z);
    c.group.position.copy(c.pos);

    // Phases — windup, liftoff, flight, prep-land, land.
    const PH = {
      WIND:  [0.00, 0.10],
      LIFT:  [0.10, 0.22],
      FLY:   [0.22, 0.78],
      PREP:  [0.78, 0.92],
      LAND:  [0.92, 1.00],
    };
    const inPhase = (p, T) => T >= p[0] && T <= p[1];
    const phaseT = (p, T) => Math.max(0, Math.min(1, (T - p[0]) / (p[1] - p[0])));

    let shoulderL = 0, shoulderR = 0;
    let elbowL = 0,    elbowR = 0;
    let hipL = 0,      hipR = 0;
    let kneeL = 0,     kneeR = 0;
    let lean = 0;
    let squashY = 1, squashXZ = 1;

    if (inPhase(PH.WIND, t)){
      const u = phaseT(PH.WIND, t);
      // Crouch + lean forward, arms back.
      shoulderL = -0.4 * u;
      shoulderR = -0.4 * u;
      elbowL = 1.5 * u; elbowR = 1.5 * u;
      hipL  = 0.55 * u; hipR  = 0.55 * u;
      kneeL = -1.1 * u; kneeR = -1.1 * u;
      lean = 0.20 * u;
      squashY = 1 - 0.20 * u;
      squashXZ = 1 + 0.06 * u;
    } else if (inPhase(PH.LIFT, t)){
      const u = phaseT(PH.LIFT, t);
      // Explode upward, arms forward+up, legs extend.
      shoulderL = -0.4 + (1.4 - -0.4) * u;
      shoulderR = -0.4 + (1.4 - -0.4) * u;
      elbowL = 1.5 + (0.4 - 1.5) * u;
      elbowR = 1.5 + (0.4 - 1.5) * u;
      hipL  = 0.55 + (-0.45 - 0.55) * u;
      hipR  = 0.55 + (-0.45 - 0.55) * u;
      kneeL = -1.1 + (-0.2 - -1.1) * u;
      kneeR = -1.1 + (-0.2 - -1.1) * u;
      lean = 0.20 + (0.42 - 0.20) * u;
      squashY = 0.80 + 0.30 * u;
      squashXZ = 1.06 - 0.10 * u;
    } else if (inPhase(PH.FLY, t)){
      const u = phaseT(PH.FLY, t);
      // Tuck pose: arms forward, knees up, gentle cycle.
      const cyc = Math.sin(u * Math.PI * 2 + 0.5) * 0.10;
      shoulderL = 1.4 + cyc;
      shoulderR = 1.4 - cyc;
      elbowL = 0.4; elbowR = 0.4;
      hipL  = -0.45 + cyc * 0.4;
      hipR  = -0.45 - cyc * 0.4;
      kneeL = -0.2 - cyc * 0.5;
      kneeR = -0.2 + cyc * 0.5;
      lean = 0.42;
      squashY = 1.04;
      squashXZ = 0.97;
    } else if (inPhase(PH.PREP, t)){
      const u = phaseT(PH.PREP, t);
      // Legs swing forward to plant; arms swing back for balance.
      shoulderL = 1.4 + (-0.6 - 1.4) * u;
      shoulderR = 1.4 + (-0.6 - 1.4) * u;
      elbowL = 0.4 + (0.9 - 0.4) * u;
      elbowR = 0.4 + (0.9 - 0.4) * u;
      hipL  = -0.45 + (0.85 - -0.45) * u;
      hipR  = -0.45 + (0.85 - -0.45) * u;
      kneeL = -0.2 + (-0.7 - -0.2) * u;
      kneeR = -0.2 + (-0.7 - -0.2) * u;
      lean = 0.42 + (0.10 - 0.42) * u;
      squashY = 1.04 + (1.0 - 1.04) * u;
      squashXZ = 0.97 + (1.0 - 0.97) * u;
    } else {
      const u = phaseT(PH.LAND, t);
      // Plant: big squash on contact, recoil up.
      shoulderL = -0.6 + 0.6 * u;
      shoulderR = -0.6 + 0.6 * u;
      elbowL = 0.9 - 0.9 * u;
      elbowR = 0.9 - 0.9 * u;
      hipL  = 0.85 - 0.85 * u;
      hipR  = 0.85 - 0.85 * u;
      kneeL = -0.7 + 0.7 * u;
      kneeR = -0.7 + 0.7 * u;
      lean = 0.10 - 0.10 * u;
      // Hard squash at moment of contact, easing out.
      const impact = Math.max(0, 1 - u * 2);
      squashY = 1.0 - 0.30 * impact;
      squashXZ = 1.0 + 0.12 * impact;
    }

    c.lArm.sh.rotation.x    = shoulderL;
    c.rArm.sh.rotation.x    = shoulderR;
    c.lArm.elbow.rotation.x = elbowL;
    c.rArm.elbow.rotation.x = elbowR;
    c.lLeg.hip.rotation.x   = hipL;
    c.rLeg.hip.rotation.x   = hipR;
    c.lLeg.knee.rotation.x  = kneeL;
    c.rLeg.knee.rotation.x  = kneeR;
    c.group.rotation.x = lean;
    c.group.scale.set(squashXZ, squashY, squashXZ);

    if (t >= 1){
      c.mode = 'roof';
      c.onRoof = c.targetRoof;
      c.pos.copy(c.jumpEnd);
      c.group.position.copy(c.pos);
      c.group.rotation.x = 0;
      c.group.scale.set(1, 1, 1);
      // Reset limbs.
      c.lArm.sh.rotation.x = 0; c.rArm.sh.rotation.x = 0;
      c.lArm.elbow.rotation.x = 0; c.rArm.elbow.rotation.x = 0;
      c.lLeg.hip.rotation.x = 0; c.rLeg.hip.rotation.x = 0;
      c.lLeg.knee.rotation.x = 0; c.rLeg.knee.rotation.x = 0;
    }
  },

  /* Walking on a rooftop: camera-relative WASD/arrows. Bounded to walkable.
     Walking off an edge enters traversal (if a connection is there) or falls. */
  _updateWalk(dt){
    const c = this.character;
    const w = this.walk;
    const k = c.onRoof ? c.onRoof.walkable : null;

    // Camera-relative input. right = forward × up (standard view-space basis).
    const fwd = this._cameraForwardXZ();
    const right = new THREE.Vector3();
    right.crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();

    let dx = 0, dz = 0;
    if (w.keys.fwd)   { dx += fwd.x;   dz += fwd.z;   }
    if (w.keys.back)  { dx -= fwd.x;   dz -= fwd.z;   }
    if (w.keys.right) { dx += right.x; dz += right.z; }
    if (w.keys.left)  { dx -= right.x; dz -= right.z; }
    const inLen = Math.hypot(dx, dz);

    const speed = 5.2;
    if (inLen > 0.001 && k){
      dx /= inLen; dz /= inLen;
      w.lastDir.set(dx, 0, dz);

      const nx = c.pos.x + dx * speed * dt;
      const nz = c.pos.z + dz * speed * dt;
      const hw = k.w / 2 - 0.4;
      const hd = k.d / 2 - 0.4;
      const outside = nx < k.cx - hw || nx > k.cx + hw || nz < k.cz - hd || nz > k.cz + hd;

      if (outside){
        // Stepped off the rooftop. Try to mount a nearby connection first.
        const conn = this._findConnectionFromHere(c.onRoof, nx, nz);
        if (conn){
          const isA = (conn.a === c.onRoof);
          const fromEnd = isA ? conn.endA : conn.endB;
          const toEnd   = isA ? conn.endB : conn.endA;
          c.mode = 'traverse';
          c.traverseConn = conn;
          c.traverseFrom.copy(fromEnd);
          c.traverseTo.copy(toEnd);
          c.traverseT = 0;
          c.traverseToRoof = isA ? conn.b : conn.a;
          c.pos.set(fromEnd.x, fromEnd.y, fromEnd.z);
          c.group.position.copy(c.pos);
          c.facingTarget = Math.atan2(toEnd.x - fromEnd.x, toEnd.z - fromEnd.z);
          return;
        }
        // No connection — fall off the edge.
        c.mode = 'fall';
        c.onRoof = null;
        c.fallVel.set(dx * speed, 1.0, dz * speed);   // little outward kick
        c.fallSpin = {
          rx: (Math.random() - 0.5) * 6.0,
          ry: (Math.random() - 0.5) * 3.0,
          rz: (Math.random() - 0.5) * 6.0,
        };
        return;
      }

      c.pos.x = nx; c.pos.z = nz;
      c.facingTarget = Math.atan2(dx, dz);
      c.walking = true;
    } else {
      c.walking = false;
    }

    // Animate.
    if (c.walking){
      c.walkPhase += dt * 8.5;
      const swing = Math.sin(c.walkPhase) * 0.55;
      const swing2 = Math.sin(c.walkPhase + Math.PI) * 0.55;
      c.lArm.sh.rotation.x = swing2 * 0.85;
      c.rArm.sh.rotation.x = swing  * 0.85;
      c.lArm.elbow.rotation.x = 0.20 + Math.max(0, swing2) * 0.4;
      c.rArm.elbow.rotation.x = 0.20 + Math.max(0, swing)  * 0.4;
      c.lLeg.hip.rotation.x = swing  * 0.55;
      c.rLeg.hip.rotation.x = swing2 * 0.55;
      c.lLeg.knee.rotation.x = -Math.max(0, swing)  * 0.6;
      c.rLeg.knee.rotation.x = -Math.max(0, swing2) * 0.6;
      const stepBob = Math.abs(Math.sin(c.walkPhase)) * 0.06;
      c.group.position.set(c.pos.x, c.pos.y + stepBob, c.pos.z);
      c.group.rotation.x = 0.08;
      c.group.rotation.z = 0;
    } else {
      // Idle: gentle bob + bass amplitude + slight arm sway.
      c.bodyBob += dt * 1.6;
      const bob = Math.sin(c.bodyBob) * 0.04 + this.bass * 0.07;
      c.group.position.set(c.pos.x, c.pos.y + bob, c.pos.z);
      c.group.rotation.x *= 0.85;        // ease out any residual lean
      c.group.rotation.z = Math.sin(c.bodyBob * 0.6) * 0.03;
      c.lArm.sh.rotation.x = Math.sin(c.bodyBob * 0.9) * 0.06;
      c.rArm.sh.rotation.x = -Math.sin(c.bodyBob * 0.9) * 0.06;
      c.lArm.elbow.rotation.x *= 0.85;
      c.rArm.elbow.rotation.x *= 0.85;
      c.lLeg.hip.rotation.x *= 0.85;
      c.rLeg.hip.rotation.x *= 0.85;
      c.lLeg.knee.rotation.x *= 0.85;
      c.rLeg.knee.rotation.x *= 0.85;
    }
  },

  _findConnectionFromHere(roof, nx, nz){
    // Find a connection whose endpoint on `roof` is within step-on range
    // of the requested exit position (nx, nz).
    for (const conn of this.connections){
      let endpoint = null;
      if (conn.a === roof) endpoint = conn.endA;
      else if (conn.b === roof) endpoint = conn.endB;
      if (!endpoint) continue;
      const d = Math.hypot(endpoint.x - nx, endpoint.z - nz);
      if (d < 3.2) return conn;
    }
    return null;
  },

  /* Manual traversal: player drives forward/back along a 1-D connection path. */
  _updateTraverse(dt){
    const c = this.character;
    const w = this.walk;
    const conn = c.traverseConn;
    if (!conn){ c.mode = 'roof'; return; }

    // Project camera-relative input onto the connection's bearing.
    const pathDx = c.traverseTo.x - c.traverseFrom.x;
    const pathDz = c.traverseTo.z - c.traverseFrom.z;
    const pathLen = Math.hypot(pathDx, pathDz);
    const pX = pathDx / pathLen;
    const pZ = pathDz / pathLen;

    const fwd = this._cameraForwardXZ();
    const right = new THREE.Vector3();
    right.crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();

    let dx = 0, dz = 0;
    if (w.keys.fwd)   { dx += fwd.x;   dz += fwd.z;   }
    if (w.keys.back)  { dx -= fwd.x;   dz -= fwd.z;   }
    if (w.keys.right) { dx += right.x; dz += right.z; }
    if (w.keys.left)  { dx -= right.x; dz -= right.z; }

    // Component of input along the connection path.
    const along = dx * pX + dz * pZ;

    const baseSpeed = conn.type === 'cable' ? 3.0 : 4.2;
    c.traverseT += along * baseSpeed * dt / pathLen;

    // Position on the path, with a small sag for cables / bounce for planks.
    let t = c.traverseT;
    let y = c.traverseFrom.y + (c.traverseTo.y - c.traverseFrom.y) * t;
    if (conn.type === 'cable'){
      const sag = Math.sin(Math.max(0, Math.min(1, t)) * Math.PI) * Math.min(1.6, pathLen * 0.06);
      y -= sag;
    } else if (conn.type === 'plank'){
      y += Math.sin(Math.max(0, Math.min(1, t)) * Math.PI) * 0.05;
    }
    c.pos.set(
      c.traverseFrom.x + pathDx * t,
      y,
      c.traverseFrom.z + pathDz * t,
    );
    c.group.position.copy(c.pos);
    // Face along the path forward direction (in or against, based on movement).
    if (Math.abs(along) > 0.01){
      const dir = along > 0 ? 1 : -1;
      c.facingTarget = Math.atan2(pX * dir, pZ * dir);
    }

    // Animate limbs.
    if (Math.abs(along) > 0.01){
      c.walkPhase += dt * 9 * Math.abs(along);
      const swing = Math.sin(c.walkPhase) * 0.55;
      const swingOpp = Math.sin(c.walkPhase + Math.PI) * 0.55;
      if (conn.type === 'cable'){
        c.lArm.sh.rotation.x = -1.30 + swing * 0.45;
        c.rArm.sh.rotation.x = -1.30 + swingOpp * 0.45;
        c.lArm.elbow.rotation.x = 1.05;
        c.rArm.elbow.rotation.x = 1.05;
        c.lLeg.hip.rotation.x = 0.35;
        c.rLeg.hip.rotation.x = 0.35;
        c.lLeg.knee.rotation.x = -0.55;
        c.rLeg.knee.rotation.x = -0.55;
        c.group.rotation.x = 0.05;
      } else {
        c.lArm.sh.rotation.x = swing    * 0.75;
        c.rArm.sh.rotation.x = swingOpp * 0.75;
        c.lArm.elbow.rotation.x = 0.20 + Math.max(0, swing)    * 0.40;
        c.rArm.elbow.rotation.x = 0.20 + Math.max(0, swingOpp) * 0.40;
        c.lLeg.hip.rotation.x = swingOpp * 0.55;
        c.rLeg.hip.rotation.x = swing    * 0.55;
        c.lLeg.knee.rotation.x = -Math.max(0, swingOpp) * 0.55;
        c.rLeg.knee.rotation.x = -Math.max(0, swing)    * 0.55;
        c.group.rotation.x = 0.08;
      }
    } else {
      // Standing still on the connection: gentle bob, idle pose.
      c.bodyBob += dt * 1.4;
      c.group.rotation.x *= 0.85;
    }
    c.group.scale.set(1, 1, 1);

    // Exit conditions: stepped onto either rooftop.
    if (c.traverseT >= 1.0){
      this._stepOffOnto(c.traverseToRoof);
    } else if (c.traverseT <= 0.0){
      const startRoof = (c.traverseConn.a === c.traverseToRoof) ? c.traverseConn.b : c.traverseConn.a;
      this._stepOffOnto(startRoof);
    }
  },

  _stepOffOnto(roof){
    const c = this.character;
    c.mode = 'roof';
    c.onRoof = roof;
    const k = roof.walkable;
    // Step a little inside the roof from the connection endpoint, so the
    // character isn't standing right on the parapet.
    const dir = new THREE.Vector3(k.cx - c.pos.x, 0, k.cz - c.pos.z);
    if (dir.lengthSq() > 0.001){
      dir.normalize();
      c.pos.set(c.pos.x + dir.x * 1.4, k.h, c.pos.z + dir.z * 1.4);
    } else {
      c.pos.set(k.cx, k.h, k.cz);
    }
    c.group.position.copy(c.pos);
    c.group.rotation.x = 0;
    c.traverseConn = null;
    c.traverseT = 0;
    // Reset limbs.
    c.lArm.sh.rotation.x = 0;    c.rArm.sh.rotation.x = 0;
    c.lArm.elbow.rotation.x = 0; c.rArm.elbow.rotation.x = 0;
    c.lLeg.hip.rotation.x = 0;   c.rLeg.hip.rotation.x = 0;
    c.lLeg.knee.rotation.x = 0;  c.rLeg.knee.rotation.x = 0;
  },

  /* Falling: gravity + ragdoll spin + flailing limbs. Respawn on ground hit. */
  _updateFall(dt){
    const c = this.character;
    // Gravity.
    c.fallVel.y -= 38 * dt;
    c.pos.x += c.fallVel.x * dt;
    c.pos.y += c.fallVel.y * dt;
    c.pos.z += c.fallVel.z * dt;

    // Ragdoll spin on the group.
    c.group.position.copy(c.pos);
    c.group.rotation.x += c.fallSpin.rx * dt;
    c.group.rotation.y += c.fallSpin.ry * dt;
    c.group.rotation.z += c.fallSpin.rz * dt;

    // Flail.
    c.walkPhase += dt * 12;
    c.lArm.sh.rotation.x = Math.sin(c.walkPhase) * 1.6;
    c.rArm.sh.rotation.x = Math.sin(c.walkPhase + 0.7) * 1.6;
    c.lArm.elbow.rotation.x = 0.6 + Math.sin(c.walkPhase * 1.3) * 0.4;
    c.rArm.elbow.rotation.x = 0.6 + Math.sin(c.walkPhase * 1.3 + 1.0) * 0.4;
    c.lLeg.hip.rotation.x = Math.sin(c.walkPhase * 0.9) * 1.0;
    c.rLeg.hip.rotation.x = Math.sin(c.walkPhase * 0.9 + Math.PI) * 1.0;
    c.lLeg.knee.rotation.x = -Math.abs(Math.sin(c.walkPhase * 0.7)) * 0.6;
    c.rLeg.knee.rotation.x = -Math.abs(Math.sin(c.walkPhase * 0.7 + 1.5)) * 0.6;

    // Hit ground? Respawn at closest rooftop.
    if (c.pos.y < 1.0){
      this._respawn();
    }
  },

  _respawn(){
    const c = this.character;
    // Closest rooftop by planar XZ distance.
    let closest = null, bestD = Infinity;
    for (const b of this.buildings){
      const d = Math.hypot(b.walkable.cx - c.pos.x, b.walkable.cz - c.pos.z);
      if (d < bestD){ bestD = d; closest = b; }
    }
    if (!closest) closest = this.buildings[0];
    const k = closest.walkable;
    c.pos.set(k.cx, k.h, k.cz);
    c.onRoof = closest;
    c.mode = 'roof';
    c.fallVel.set(0, 0, 0);
    c.fallSpin = { rx: 0, ry: 0, rz: 0 };
    c.group.position.copy(c.pos);
    c.group.rotation.set(0, c.facing, 0);
    c.group.scale.set(1, 1, 1);
    // Reset limbs.
    c.lArm.sh.rotation.set(0, 0, 0);
    c.rArm.sh.rotation.set(0, 0, 0);
    c.lArm.elbow.rotation.set(0, 0, 0);
    c.rArm.elbow.rotation.set(0, 0, 0);
    c.lLeg.hip.rotation.set(0, 0, 0);
    c.rLeg.hip.rotation.set(0, 0, 0);
    c.lLeg.knee.rotation.set(0, 0, 0);
    c.rLeg.knee.rotation.set(0, 0, 0);
  },

  /* ---------- Camera ---------- */
  _applyCamera(){
    if (this.godView){
      const cy = 360;
      const cz = (this.godFly ? this.godFly.z : 0);
      this.camera.position.set(0, cy, cz);
      this.camera.lookAt(0, 0, cz - 0.01);
      return;
    }

    const c = this.character ? this.character.group.position : new THREE.Vector3();
    // Target the character's upper-torso height so the chase reads as
    // shoulder-cam, not feet-cam.
    const head = new THREE.Vector3(c.x, c.y + 2.4, c.z);

    const off = new THREE.Vector3(
      Math.sin(this.cam.az) * Math.cos(this.cam.el) * this.cam.dist,
      Math.sin(this.cam.el) * this.cam.dist,
      Math.cos(this.cam.az) * Math.cos(this.cam.el) * this.cam.dist,
    );
    const targetPos = head.clone().add(off);

    // Smooth chase. Faster while in motion (jump/traverse/fall) for tight tracking.
    const moving = this.character && this.character.mode !== 'roof';
    const k = moving ? 0.16 : 0.10;
    this.camPosNow.lerp(targetPos, k);
    this.camTarget.lerp(head, k);
    this.camera.position.copy(this.camPosNow);
    this.camera.lookAt(this.camTarget);
  },

  /* ---------- Helicopter, cranes, birds, ground ---------- */
  _buildHelicopter(){
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 4.2), SHARED.helBody);
    g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 3.2), SHARED.helBody);
    tail.position.set(0, 0.2, -3.6); g.add(tail);
    const fin  = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.2, 0.7), SHARED.helBody);
    fin.position.set(0, 0.8, -5.0); g.add(fin);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.06, 0.30), SHARED.helRotor);
    rotor.position.set(0, 0.9, 0); g.add(rotor);
    const trotor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.10), SHARED.helRotor);
    trotor.position.set(0.4, 0.6, -5.0); g.add(trotor);
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), SHARED.blink);
    blink.position.set(0, -0.6, 0.5); g.add(blink);

    g.position.set(60, 120, 100);
    this.scene.add(g);
    this.helicopter = { group: g, rotor, trotor, blink, phase: 0 };
  },

  _buildCranes(){
    const cranes = [
      { x: -170, z:  -50, h: 90, arm: 50 },
      { x:  140, z:   30, h: 75, arm: 44 },
      { x:  -60, z:  120, h: 80, arm: 48 },
      { x:  170, z: -100, h: 95, arm: 56 },
    ];
    for (const p of cranes){
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, p.h, 2.2), SHARED.yellow
      );
      tower.position.set(p.x, p.h / 2, p.z);
      this.scene.add(tower);

      const armRot = Math.random() * Math.PI * 2;
      const armGroup = new THREE.Group();
      armGroup.position.set(p.x, p.h + 0.5, p.z);
      armGroup.rotation.y = armRot;

      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(p.arm, 1.2, 1.2), SHARED.yellow
      );
      arm.position.set(p.arm * 0.35, 0, 0);
      armGroup.add(arm);

      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(p.arm * 0.4, 0.9, 1.0), SHARED.concrete
      );
      counter.position.set(-p.arm * 0.25, 0, 0);
      armGroup.add(counter);

      // Hanging cable + small load.
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, p.h * 0.6, 6), SHARED.rail
      );
      cable.position.set(p.arm * 0.55, -p.h * 0.30, 0);
      armGroup.add(cable);
      const load = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 1.0, 1.0), SHARED.concreteLo
      );
      load.position.set(p.arm * 0.55, -p.h * 0.62, 0);
      armGroup.add(load);

      this.scene.add(armGroup);
    }
  },

  _buildBirds(){
    // 3 flocks circling the city.
    const flocks = [
      { cx: -80, cz: -40, radius: 60, alt: 70, speed: 0.5, count: 9 },
      { cx:  90, cz:  90, radius: 70, alt: 95, speed: 0.4, count: 7 },
      { cx:   0, cz:  -120, radius: 50, alt: 60, speed: 0.6, count: 8 },
    ];
    const geo = new THREE.ConeGeometry(0.5, 1.4, 4);
    for (const f of flocks){
      for (let i = 0; i < f.count; i++){
        const b = new THREE.Mesh(geo, SHARED.bird);
        b.scale.set(0.6, 0.4, 0.6);
        this.scene.add(b);
        this.birds.push({
          mesh: b,
          cx: f.cx, cz: f.cz, radius: f.radius, alt: f.alt, speed: f.speed,
          phase: (i / f.count) * Math.PI * 2 + Math.random() * 0.4,
          rJitter: (Math.random() - 0.5) * 8,
          yJitter: (Math.random() - 0.5) * 4,
        });
      }
    }
  },

  _buildDistantSkyline(){
    // 60 silhouette buildings far past the playable city.
    for (let i = 0; i < 60; i++){
      const ang = Math.random() * Math.PI * 2;
      const rad = 600 + Math.random() * 700;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      const h = 20 + Math.random() * 80;
      const w = 14 + Math.random() * 12;
      const d = 14 + Math.random() * 12;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d), SHARED.concreteLo
      );
      body.position.set(x, h / 2, z);
      this.scene.add(body);
    }
  },

  _buildGround(){
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(3200, 3200),
      SHARED.concreteDk
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 0);
    this.scene.add(ground);
  },

  /* ---------- HUD ---------- */
  _buildHud(){
    const root = document.createElement('div');
    root.className = 'tj-hud';
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
      color:rgba(20,22,28,0.74);
    `;
    corner.innerHTML = `
      <div style="color:#dd1a2a;font-weight:800;letter-spacing:0.20em;">CANTMUTE / THE JUMP</div>
      <div>${count} TRACKS &middot; ${build}</div>
    `;
    root.appendChild(corner);

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
    const title = document.createElement('div');
    title.style.cssText = `
      font:900 26px/1 "Space Grotesk", Inter, system-ui;
      letter-spacing:0.04em; text-transform:uppercase;
      color:#1a1c22; text-shadow:0 1px 0 rgba(255,255,255,0.6);
      max-width:60vw; text-align:center;
    `;
    active.appendChild(tier);
    active.appendChild(title);
    root.appendChild(active);
    this._activeTitleEl = title;
    this._activeTierEl = tier;

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
      pointer-events:auto;
    `;
    ovBtn.addEventListener('click', () => this._toggleGodView());
    root.appendChild(ovBtn);
    this._ovBtn = ovBtn;

    const help = document.createElement('div');
    help.style.cssText = `
      position:absolute; bottom:124px; left:20px;
      font-size:10px; letter-spacing:0.16em; text-transform:uppercase;
      color:rgba(20,22,28,0.55); line-height:1.7;
    `;
    help.innerHTML = `
      <div>WASD / ↑↓←→ &middot; walk &middot; off edges = fall</div>
      <div>STEP ONTO PIPES / PLANKS / CABLES &middot; cross by walking</div>
      <div>SPACE &middot; leap to next rooftop (no song change)</div>
      <div>CLICK BANNER &middot; jump there + play that song</div>
      <div>DRAG &middot; orbit camera &middot; SCROLL &middot; zoom</div>
      <div>Q / E &middot; prev / next song &middot; O / ESC &middot; overview</div>
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
    root.className = 'tj-transport';
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
      font-weight:700; letter-spacing:0.04em; color:#1a1c22;
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
    this.bass = this.bass * 0.78 + b * 0.22;
    this.mid  = this.mid  * 0.78 + m * 0.22;
    this.hi   = this.hi   * 0.78 + h * 0.22;
  },

  /* ---------- Active banner / hover ---------- */
  _updateActive(){
    if (!this.banners.length) return;

    // Active = currently focused/playing track if known, else nearest banner
    // to the character.
    let activeBanner = null;
    if (this.focusedIdx >= 0){
      activeBanner = this.banners.find(b => b.idx === this.focusedIdx) || null;
    }
    if (!activeBanner && this.character){
      const cp = this.character.pos;
      let bestD = Infinity;
      for (const b of this.banners){
        if (!b.visible) continue;
        const d = Math.hypot(b.x - cp.x, b.z - cp.z) + Math.abs(b.y - cp.y) * 0.5;
        if (d < bestD){ bestD = d; activeBanner = b; }
      }
    }

    if (activeBanner){
      const desired = (activeBanner.track.title || '').toUpperCase();
      if (this._activeTitleEl.textContent !== desired){
        this._activeTitleEl.textContent = desired;
        this._activeTierEl.textContent  = (activeBanner.tier || '').toUpperCase();
      }
    } else if (this._activeTitleEl.textContent){
      this._activeTitleEl.textContent = '';
      this._activeTierEl.textContent  = '';
    }

    // Halos.
    for (const b of this.banners){
      if (!b.visible){ b.haloMat.opacity = 0; continue; }
      const isActive = (b === activeBanner);
      const isHovered = (b === this.hovered);
      const targetHalo = isActive
        ? (0.30 + this.mid * 0.18)
        : (isHovered ? 0.22 : 0);
      b.haloMat.opacity = b.haloMat.opacity * 0.85 + targetHalo * 0.15;

      const c = isActive || isHovered ? 1.0 : 0.92;
      b.mat.color.setRGB(c, c, c);
    }
  },

  _updateHover(){
    if (!this.ray) return;
    this.ray.setFromCamera(this.mouse.ndc, this.camera);
    const meshes = this.banners.filter(b => b.visible).map(b => b.mesh);
    const hits = this.ray.intersectObjects(meshes, false);
    const newHover = hits.length ? hits[0].object.userData.banner : null;
    if (newHover !== this.hovered){
      this.hovered = newHover;
      this.renderer.domElement.style.cursor = newHover ? 'pointer' : 'grab';
    }
  },

  /* ---------- Filter / search ---------- */
  _applyFilter(){
    const q = (this.query || '').toLowerCase();
    for (const b of this.banners){
      let ok = true;
      if (this.filter === 'new')           ok = !!(b.track.new || b.track['new']);
      else if (this.filter === 'featured') ok = !!b.track.featured;
      if (ok && q){
        const hay = (b.track.title || '').toLowerCase() + ' '
          + ((b.track.tags || []).join(' ').toLowerCase());
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
      const prevFocused = this.focusedIdx;
      this.focusedIdx = cur;
      const roof = this.songRoofs.find(r => r.trackIdx === cur);
      if (roof && roof !== this.character?.onRoof && this.character?.mode === 'roof'
          && prevFocused !== cur){
        this._jumpTo(roof, /*play=*/false);
      }
    }
  },

  /* ---------- God view ---------- */
  _toggleGodView(){
    this.godView = !this.godView;
    if (this._ovBtn){
      this._ovBtn.textContent = this.godView ? 'BACK TO RUNNER' : 'OVERVIEW';
    }
    this.godFly = this.godView ? { z: this.character?.pos.z || 0 } : null;
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
      if (!this.godView){
        const sens = 0.005;
        this.cam.az -= dx * sens;
        this.cam.el += dy * sens;
        this.cam.el = Math.max(0.10, Math.min(1.30, this.cam.el));
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
    if (this.renderer){
      this.renderer.domElement.style.cursor = this.hovered ? 'pointer' : 'grab';
    }
  },

  _onWheel(e){
    e.preventDefault();
    if (this.godView) return;
    this.cam.dist *= (1 + e.deltaY * 0.0009);
    this.cam.dist = Math.max(6, Math.min(60, this.cam.dist));
  },

  _onTouchStart(e){
    if (e.touches.length === 2){
      this.drag.active = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.pinch.active = true;
      this.pinch.d0 = Math.hypot(dx, dy);
      this.pinch.r0 = this.cam.dist;
    } else if (e.touches.length === 1){
      this.drag.active = true;
      this.drag.lx = e.touches[0].clientX;
      this.drag.ly = e.touches[0].clientY;
      this.drag.totalPx = 0;
    }
    if (e.cancelable) e.preventDefault();
  },

  _onTouchMove(e){
    if (this.pinch.active && e.touches.length === 2){
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      if (this.pinch.d0 > 1 && !this.godView){
        this.cam.dist = this.pinch.r0 * (this.pinch.d0 / d);
        this.cam.dist = Math.max(6, Math.min(60, this.cam.dist));
      }
    } else if (this.drag.active && e.touches.length === 1){
      const t = e.touches[0];
      const dx = t.clientX - this.drag.lx;
      const dy = t.clientY - this.drag.ly;
      this.drag.lx = t.clientX;
      this.drag.ly = t.clientY;
      this.drag.totalPx += Math.abs(dx) + Math.abs(dy);
      if (!this.godView){
        const sens = 0.006;
        this.cam.az -= dx * sens;
        this.cam.el += dy * sens;
        this.cam.el = Math.max(0.10, Math.min(1.30, this.cam.el));
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
    const w = this.walk;

    if (k === 'w' || k === 'arrowup')    { w.keys.fwd   = true; e.preventDefault(); }
    else if (k === 's' || k === 'arrowdown')  { w.keys.back  = true; e.preventDefault(); }
    else if (k === 'a' || k === 'arrowleft')  { w.keys.left  = true; e.preventDefault(); }
    else if (k === 'd' || k === 'arrowright') { w.keys.right = true; e.preventDefault(); }
    else if (k === ' ')                  { e.preventDefault(); this._tryJump(); }
    else if (k === 'p')                  { e.preventDefault(); this.ctx.onTogglePlay?.(); }
    else if (k === 'q' || k === '[')     { e.preventDefault(); this.ctx.onPrev?.(); }
    else if (k === 'e' || k === ']')     { e.preventDefault(); this.ctx.onNext?.(); }
    else if (k === 'escape' || k === 'o'){ this._toggleGodView(); }
  },

  _onKeyUp(e){
    const k = e.key.toLowerCase();
    const w = this.walk;
    if (k === 'w' || k === 'arrowup')    w.keys.fwd   = false;
    else if (k === 's' || k === 'arrowdown')  w.keys.back  = false;
    else if (k === 'a' || k === 'arrowleft')  w.keys.left  = false;
    else if (k === 'd' || k === 'arrowright') w.keys.right = false;
  },

  _tryJump(){
    // Space: if moving, leap toward nearest rooftop in walk direction.
    // If standing still, leap toward the rooftop the camera is facing.
    if (!this.character || this.character.mode !== 'roof') return;
    const c = this.character;
    const w = this.walk;
    const hasInput = w.keys.fwd || w.keys.back || w.keys.left || w.keys.right;
    const dir = hasInput ? w.lastDir.clone() : this._cameraForwardXZ();
    if (dir.lengthSq() < 0.001) return;

    // Pick the best rooftop in `dir` from current position — score by
    // forward-projected distance, penalize sideways drift.
    let best = null, bestScore = Infinity;
    for (const b of this.buildings){
      if (b === c.onRoof) continue;
      const dx = b.walkable.cx - c.pos.x;
      const dz = b.walkable.cz - c.pos.z;
      const planar = Math.hypot(dx, dz);
      if (planar < 6 || planar > 80) continue;
      const forward = (dx * dir.x + dz * dir.z) / planar;
      if (forward < 0.45) continue;
      const sidewayPenalty = (1 - forward) * planar * 1.6;
      const score = planar + sidewayPenalty;
      if (score < bestScore){ bestScore = score; best = b; }
    }
    if (best){
      // Space-leap never auto-plays. Click a banner to play.
      this._jumpTo(best, /*play=*/false);
    } else {
      // No rooftop in range — small in-place hop.
      c.jumpStart = c.pos.clone();
      c.jumpEnd = c.pos.clone();
      c.jumpDuration = 0.55;
      c.apexY = c.pos.y + 3.2;
      c.jumpT = 0;
      c.mode = 'jump';
      c.facingTarget = Math.atan2(dir.x, dir.z);
      c.targetRoof = c.onRoof;
    }
  },

  _cameraForwardXZ(){
    const f = new THREE.Vector3();
    this.camera.getWorldDirection(f);
    f.y = 0;
    if (f.lengthSq() < 0.0001) return new THREE.Vector3(0, 0, 1);
    return f.normalize();
  },

  _onClick(){
    if (this.drag.totalPx > 6) return;

    if (this.godView){
      // Pick a banner if hovered in god view, else exit.
      this.ray.setFromCamera(this.mouse.ndc, this.camera);
      const meshes = this.banners.filter(b => b.visible).map(b => b.mesh);
      const hits = this.ray.intersectObjects(meshes, false);
      if (hits.length){
        const b = hits[0].object.userData.banner;
        if (b){
          this._toggleGodView();
          this._jumpTo(b.roof);
        }
      } else {
        this._toggleGodView();
      }
      return;
    }

    if (!this.hovered) return;
    this._jumpTo(this.hovered.roof);
  },

  /* ---------- Loop ---------- */
  _loop(){
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const t  = this.clock.elapsedTime;

    this._sampleAudio();

    if (this.skyMat) this.skyMat.uniforms.uTime.value = t;
    if (this.sky) this.sky.position.copy(this.camera.position);

    // Helicopter.
    if (this.helicopter){
      const h = this.helicopter;
      h.phase += dt * 0.30;
      const cx = Math.cos(h.phase) * 160;
      const cz = Math.sin(h.phase) * 200;
      const cy = 110 + Math.sin(h.phase * 1.3) * 8 + this.bass * 6;
      h.group.position.set(cx, cy, cz);
      h.group.rotation.y = -h.phase + Math.PI / 2;
      h.rotor.rotation.y  += dt * 30;
      h.trotor.rotation.x += dt * 36;
      h.blink.material.opacity = 0.5 + (Math.sin(t * 6) > 0 ? 0.5 : 0);
    }

    // Birds — circular paths with vertical wobble.
    for (const b of this.birds){
      b.phase += dt * b.speed;
      const x = b.cx + Math.cos(b.phase) * (b.radius + b.rJitter);
      const z = b.cz + Math.sin(b.phase) * (b.radius + b.rJitter);
      const y = b.alt + Math.sin(t * 1.2 + b.phase * 0.5) * 3 + b.yJitter;
      b.mesh.position.set(x, y, z);
      // Face tangent.
      b.mesh.rotation.y = -b.phase + Math.PI / 2;
      b.mesh.rotation.x = Math.PI / 2;
    }

    // God-view smooth.
    if (this.godView && this.godFly && this.character){
      this.godFly.z += ((this.character.pos.z) - this.godFly.z) * 0.06;
    }

    this._updateCharacter(dt);
    this._updateHover();
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
    window.removeEventListener('keyup', this._onKeyUp);
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
    this.buildings = [];
    this.songRoofs = [];
    this.banners = [];
    this.helicopter = null;
    this.birds = [];
    this.sky = null;
    this.character = null;
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

window.TracksDaw = JUMP;
