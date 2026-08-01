/* =========================================================
   TRACKS-CITY.JS — /tracks "Central Park + Metro" (t19)
   ---------------------------------------------------------
   Apple-Maps / Division-style 3D angled view of a NYC
   neighborhood. Music tracks are typographic glitch-shader
   towers lining the long sides of a Central-Park-shaped
   green oblong. Around them: ~280 large trees in 5 species,
   ~30 people walking + sitting, birds circling, a gazebo,
   playground, picnic cluster, hot-dog cart, meandering
   stream with 3 stone arches, fountains and a pond.

   t18 — breaks out of the single-rectangle silhouette:
   ~130 non-music FILLER buildings (lit-window canvas
   textures in 12 cool/warm/neon colors) packed in a 3rd
   rank around the music belt; 3 satellite-neighborhood
   islands across the water with their own slabs + ~60
   filler towers; a distant horizon skyline of ~70 dark
   silhouettes far out; 18 cars driving the perimeter
   streets in two loops; 2 helicopters circling overhead;
   boats drift forward instead of just bobbing.

   Camera is orbit-only (AERIAL ↔ GROUND presets, drag
   rotates, wheel/pinch zooms). Same module interface as
   the old DAW.
   ========================================================= */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/* ===================== Tower shader ===================== */

const TOWER_VERTEX = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TOWER_FRAGMENT = `
  uniform sampler2D uTex;
  uniform float uTime;
  uniform float uBass;
  uniform float uHover;
  uniform float uFocus;
  uniform float uPlaying;
  uniform vec3  uTint;
  uniform float uHueShift;
  varying vec2 vUv;
  float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 hueShift(vec3 c, float h){
    vec3 k = vec3(0.57735);
    float ang = h * 6.28318530718;
    float ca = cos(ang);
    return c * ca + cross(k, c) * sin(ang) + k * dot(k, c) * (1.0 - ca);
  }
  void main(){
    vec2 uv = vUv;
    float gAmt = 0.16 + uHover * 0.85 + uBass * 0.55 + uFocus * 0.45 + uPlaying * 0.35;
    float strips = 38.0;
    float blockY = floor(uv.y * strips) / strips;
    float blockSeed = rand(vec2(blockY * 7.31, floor(uTime * 14.0)));
    float dispActive = step(1.0 - 0.18 * gAmt, blockSeed);
    float disp = (rand(vec2(blockY, floor(uTime * 12.0))) - 0.5) * 0.06 * gAmt;
    uv.x += disp * dispActive;
    float ca = 0.0018 + 0.011 * gAmt;
    float r = texture2D(uTex, uv + vec2(ca, 0.0)).r;
    float g = texture2D(uTex, uv).g;
    float b = texture2D(uTex, uv - vec2(ca, 0.0)).b;
    vec3 col = vec3(r, g, b);
    float sl = 0.93 + 0.07 * sin(uv.y * 520.0);
    col *= sl;
    float dropY = floor(uv.y * 130.0) / 130.0;
    float dropSeed = rand(vec2(dropY * 13.0, floor(uTime * 22.0)));
    if (dropSeed > 1.0 - 0.04 * gAmt) col *= 0.25;
    vec3 tint = clamp(hueShift(uTint, uHueShift), 0.0, 1.6);
    col *= tint;
    col *= (1.0 + uBass * 0.30 * uPlaying);
    col += tint * (uHover * 0.10 + uPlaying * 0.06);
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ===================== Water shader ===================== */

const WATER_VERTEX = `
  uniform float uTime;
  varying float vWave;
  void main(){
    vec3 p = position;
    float w = sin(p.x * 0.035 + uTime * 0.55) * 0.20
            + cos(p.y * 0.052 + uTime * 0.85) * 0.14
            + sin((p.x + p.y) * 0.018 + uTime * 1.25) * 0.08;
    p.z += w;
    vWave = w;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const WATER_FRAGMENT = `
  varying float vWave;
  void main(){
    vec3 base = vec3(0.018, 0.050, 0.118);
    vec3 high = vec3(0.055, 0.145, 0.275);
    float t = clamp(vWave * 0.55 + 0.5, 0.0, 1.0);
    vec3 col = mix(base, high, t);
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ===================== Colors ===================== */

function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

const TAG_HUE = {
  hard:[0.00,0.80,0.62], aggressive:[0.02,0.85,0.60], rap:[0.05,0.88,0.62],
  trap:[0.06,0.85,0.60], drill:[0.97,0.78,0.58], rage:[0.99,0.85,0.58],
  grunge:[0.10,0.65,0.60], alt:[0.11,0.62,0.62], rock:[0.08,0.70,0.58],
  emo:[0.92,0.65,0.62], sad:[0.62,0.45,0.62], chill:[0.55,0.72,0.64],
  vibe:[0.83,0.68,0.66], pop:[0.88,0.78,0.68], dance:[0.78,0.75,0.64],
  electronic:[0.50,0.70,0.62], ambient:[0.45,0.50,0.62], funk:[0.13,0.75,0.62],
  soul:[0.07,0.55,0.62], groove:[0.15,0.65,0.62], hyperpop:[0.85,0.85,0.68],
};

function colorForTrack(track, idx){
  if (track && Array.isArray(track.tags)) {
    for (const raw of track.tags) {
      const k = String(raw).toLowerCase();
      if (TAG_HUE[k]) {
        const h = TAG_HUE[k];
        return hslToRgb(h[0], h[1], h[2]);
      }
    }
  }
  const hash = ((idx * 9301 + 49297) % 233280) / 233280;
  return hslToRgb(hash, 0.72, 0.65);
}

function slugifyLocal(s) {
  return (s || '').toString().toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-');
}

function fmtTime(s) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss < 10 ? '0' + ss : ss}`;
}

function tierOf(t) {
  if (t.isFeatured) return 'featured';
  if (t.isNew) return 'new';
  return 'archive';
}

/* ===================== Filler-building textures ===================== */

// 12 base colors for the non-music filler towers. Mix of warm, cool, neon
// and muted so the cityscape between the music towers reads as a real
// neighborhood rather than a backdrop.
const FILLER_HEXES = [
  '#ffae45', '#ffd450', '#ff7a3d',       // warm
  '#46c5ff', '#6a9fff', '#4ad0e8',       // cool
  '#ff5fc8', '#b045ff', '#1cffa8',       // neon
  '#909098', '#7a7e90', '#bababf',       // muted
];

function _parseHex(hex){
  return {
    r: parseInt(hex.slice(1,3), 16),
    g: parseInt(hex.slice(3,5), 16),
    b: parseInt(hex.slice(5,7), 16),
  };
}

// Bake a building texture: dark base + grid of lit windows in the building's
// color. Used as a `map` on a MeshBasicMaterial — no shader needed per filler.
function _makeFillerTexture(hex){
  const W = 128, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  const { r, g, b } = _parseHex(hex);
  ctx.fillStyle = `rgb(${Math.floor(r*0.16)},${Math.floor(g*0.16)},${Math.floor(b*0.18)})`;
  ctx.fillRect(0, 0, W, H);

  const cols = 5;
  const rows = 22;
  const cellW = W / cols;
  const cellH = H / rows;

  for (let row = 1; row < rows - 1; row++){
    for (let col = 0; col < cols; col++){
      if (Math.random() < 0.45) continue;
      const flick = 0.78 + Math.random() * 0.30;
      const lr = Math.min(255, Math.floor(r * flick));
      const lg = Math.min(255, Math.floor(g * flick));
      const lb = Math.min(255, Math.floor(b * flick));
      ctx.fillStyle = `rgb(${lr},${lg},${lb})`;
      const x = col * cellW + cellW * 0.22;
      const y = row * cellH + cellH * 0.20;
      const w = cellW * 0.56;
      const h = cellH * 0.62;
      ctx.fillRect(x, y, w, h);
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(0, 0, 1, H);
  ctx.fillRect(W - 1, 0, 1, H);

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, W, 6);

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/* ===================== Shared sub-materials ===================== */

const SHARED = {
  trunk:      null,
  fol:        [],
  folDark:    null,
  blink:      null,
  lamp:       null,
  lampHalo:   null,
  metal:      null,
  metalLight: null,
  metalDark:  null,
  stone:      null,
  stoneLight: null,
  benchWood:  null,
  flower:     [],
  skin:       null,
  shirts:     [],
  pants:      null,
  hair:       [],
  boatHull:   null,
  boatCabin:  null,
  boatSail:   null,
  bird:       null,
  hotdogRed:  null,
  hotdogWhite:null,
  hotdogYellow:null,
  sand:       null,
  rope:       null,
  streamMat:  null,
  roof:       null,
  // t18:
  fillerMats: [],
  carBodies:  [],
  carCabin:   null,
  carRed:     null,
  helRed:     null,
  helBlue:    null,
};

function ensureShared(){
  if (SHARED.trunk) return;
  SHARED.trunk      = new THREE.MeshBasicMaterial({ color: 0x3a2616 });
  SHARED.fol        = [
    new THREE.MeshBasicMaterial({ color: 0x1d5c2a }),
    new THREE.MeshBasicMaterial({ color: 0x276c34 }),
    new THREE.MeshBasicMaterial({ color: 0x3b8240 }),
    new THREE.MeshBasicMaterial({ color: 0x143f1c }),
    new THREE.MeshBasicMaterial({ color: 0x4a9050 }),
  ];
  SHARED.folDark    = new THREE.MeshBasicMaterial({ color: 0x0e2e16 });
  SHARED.blink      = new THREE.MeshBasicMaterial({ color: 0xff3030 });
  SHARED.lamp       = new THREE.MeshBasicMaterial({ color: 0xffd9a8 });
  SHARED.lampHalo   = new THREE.MeshBasicMaterial({
    color: 0xffc880, transparent: true, opacity: 0.16, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  SHARED.metal      = new THREE.MeshBasicMaterial({ color: 0x434348 });
  SHARED.metalLight = new THREE.MeshBasicMaterial({ color: 0x6a6a72 });
  SHARED.metalDark  = new THREE.MeshBasicMaterial({ color: 0x202024 });
  SHARED.stone      = new THREE.MeshBasicMaterial({ color: 0x5a5a62 });
  SHARED.stoneLight = new THREE.MeshBasicMaterial({ color: 0x7e7e86 });
  SHARED.benchWood  = new THREE.MeshBasicMaterial({ color: 0x3a2818 });

  SHARED.flower = [
    new THREE.MeshBasicMaterial({ color: 0xff5a5a }),
    new THREE.MeshBasicMaterial({ color: 0xffd84a }),
    new THREE.MeshBasicMaterial({ color: 0xf5f5f5 }),
    new THREE.MeshBasicMaterial({ color: 0xb96ff0 }),
    new THREE.MeshBasicMaterial({ color: 0xff8ad6 }),
    new THREE.MeshBasicMaterial({ color: 0xff9648 }),
  ];

  SHARED.skin   = new THREE.MeshBasicMaterial({ color: 0xc89978 });
  SHARED.shirts = [
    new THREE.MeshBasicMaterial({ color: 0xc83a3a }),
    new THREE.MeshBasicMaterial({ color: 0x3a82c8 }),
    new THREE.MeshBasicMaterial({ color: 0xe6c850 }),
    new THREE.MeshBasicMaterial({ color: 0x3aaa6a }),
    new THREE.MeshBasicMaterial({ color: 0xe2e2e8 }),
    new THREE.MeshBasicMaterial({ color: 0x222226 }),
    new THREE.MeshBasicMaterial({ color: 0xb55ec0 }),
    new THREE.MeshBasicMaterial({ color: 0xff7a3d }),
  ];
  SHARED.pants  = new THREE.MeshBasicMaterial({ color: 0x1b2238 });
  SHARED.hair   = [
    new THREE.MeshBasicMaterial({ color: 0x1a0f08 }),
    new THREE.MeshBasicMaterial({ color: 0x4a2e16 }),
    new THREE.MeshBasicMaterial({ color: 0x9a6a3a }),
    new THREE.MeshBasicMaterial({ color: 0xc8a050 }),
    new THREE.MeshBasicMaterial({ color: 0x2a2a2e }),
  ];

  SHARED.boatHull  = new THREE.MeshBasicMaterial({ color: 0xd8d8de });
  SHARED.boatCabin = new THREE.MeshBasicMaterial({ color: 0xc23a3a });
  SHARED.boatSail  = new THREE.MeshBasicMaterial({ color: 0xf5f5f0 });

  SHARED.bird = new THREE.MeshBasicMaterial({
    color: 0xeaeaee, side: THREE.DoubleSide,
    transparent: true, opacity: 0.95, depthWrite: false,
  });

  SHARED.hotdogRed    = new THREE.MeshBasicMaterial({ color: 0xc83838 });
  SHARED.hotdogWhite  = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
  SHARED.hotdogYellow = new THREE.MeshBasicMaterial({ color: 0xe8c038 });

  SHARED.sand   = new THREE.MeshBasicMaterial({ color: 0xc8a868 });
  SHARED.rope   = new THREE.MeshBasicMaterial({ color: 0x807060 });
  SHARED.streamMat = new THREE.MeshBasicMaterial({ color: 0x1d4a6e });
  SHARED.roof   = new THREE.MeshBasicMaterial({ color: 0x3a2a1c });

  // Filler textured materials — one per color, baked once.
  SHARED.fillerMats = FILLER_HEXES.map(hex =>
    new THREE.MeshBasicMaterial({ map: _makeFillerTexture(hex) })
  );

  SHARED.carBodies = [
    new THREE.MeshBasicMaterial({ color: 0xc04040 }),
    new THREE.MeshBasicMaterial({ color: 0x3a82c8 }),
    new THREE.MeshBasicMaterial({ color: 0xe6c850 }),
    new THREE.MeshBasicMaterial({ color: 0xe6e6ec }),
    new THREE.MeshBasicMaterial({ color: 0x2a2a30 }),
    new THREE.MeshBasicMaterial({ color: 0x8a40a0 }),
    new THREE.MeshBasicMaterial({ color: 0x408050 }),
    new THREE.MeshBasicMaterial({ color: 0xff7a3d }),
  ];
  SHARED.carCabin = new THREE.MeshBasicMaterial({ color: 0x18181c });
  SHARED.carRed   = new THREE.MeshBasicMaterial({ color: 0xff2a2a });

  SHARED.helRed  = new THREE.MeshBasicMaterial({ color: 0xc83838 });
  SHARED.helBlue = new THREE.MeshBasicMaterial({ color: 0x2a72b8 });
}

/* ===================== Module ===================== */

const TracksCity = {
  root: null, ctx: null, container: null,
  scene: null, camera: null, renderer: null, composer: null, bloom: null,
  clock: null, raf: 0, destroyed: false,
  towers: [],
  fountains: [],
  trees: [],
  people: [],
  birds: [],
  cars: [],
  helicopters: [],
  blinkers: [],
  benchPositions: [],
  water: null,
  hovered: null, focusedIdx: -1,
  audioCtx: null, analyser: null, freqArr: null, bass: 0,
  cam: null, drag: null, pinch: null, flyTo: null,
  filter: 'all', query: '',
  hudEl: null, transportEl: null,
  ray: null, mouse: null,
  hueShift: 0,
  PARK_W: 0, PARK_L: 0,
  BLOCK_W: 0, BLOCK_L: 0,
  viewMode: 'aerial',

  /* ---------- Init ---------- */
  init(container, ctx){
    if (this.renderer) return;
    ensureShared();
    this.ctx = ctx || {};
    this.container = container;
    this.destroyed = false;
    this.filter = ctx.filter || 'all';
    this.query = (ctx.query || '').toLowerCase();
    this.towers = [];
    this.fountains = [];
    this.trees = [];
    this.people = [];
    this.birds = [];
    this.cars = [];
    this.helicopters = [];
    this.blinkers = [];
    this.benchPositions = [];
    this.hovered = null;
    this.focusedIdx = -1;
    this.bass = 0;
    this.hueShift = 0;
    this.viewMode = 'aerial';
    this._boats = [];

    this.PARK_W = 92;
    this.PARK_L = 340;
    this.BLOCK_W = this.PARK_W + 116;  // t19: wider so the outer building belt has room
    this.BLOCK_L = this.PARK_L + 184;  // t19: longer so the cap building zones fit ~4 ranks

    container.style.position = 'absolute';
    container.style.inset = '0';
    container.style.background = '#02060d';
    container.style.overflow = 'hidden';

    const canvas = document.createElement('canvas');
    canvas.className = 'tc-canvas';
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'none';
    container.appendChild(canvas);

    this.cam = {
      target:    new THREE.Vector3(0, 4, 0),
      radius:    360,
      azimuth:   0.45,
      elevation: 0.52,
    };
    this.drag  = { active: false, lx: 0, ly: 0, totalPx: 0 };
    this.pinch = { active: false, d0: 0, r0: 0 };
    this.flyTo = null;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.setClearColor(0x02060d, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x02060d, 0.0038);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 3000);
    this._applyCamera();

    // Build order matters for visual layering.
    // t19: distant skyline dropped — it read as random black dots, not buildings.
    this._buildWater();
    this._buildBlockBase();
    this._buildPark();
    this._buildStream();
    this._buildBridges();
    this._buildFountains();
    this._buildStatue();
    this._buildGazebo();
    this._buildPlayground();
    this._buildPicnicArea();
    this._buildHotDogCart();
    this._buildLampposts();
    this._buildBenches();
    this._buildStreetlights();
    this._buildFlowerBeds();
    this._buildTrees();
    this._buildPeople();
    this._buildBoats();
    this._buildBirds();
    this._buildStarfield();
    this._buildBlock();          // music towers
    this._buildFillers();        // non-music fillers around music
    this._buildSatelliteIslands();
    this._buildCars();
    this._buildHelicopters();

    this.clock = new THREE.Clock();
    this.ray = new THREE.Raycaster();
    this.mouse = { x: 0.5, y: 0.5, ndc: new THREE.Vector2(0, 0) };

    this.hudEl = this._buildHud();
    container.appendChild(this.hudEl);
    this.transportEl = this._buildTransport();
    container.appendChild(this.transportEl);

    this._onResize      = this._onResize.bind(this);
    this._onMove        = this._onMove.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp   = this._onPointerUp.bind(this);
    this._onWheel       = this._onWheel.bind(this);
    this._onKeyDown     = this._onKeyDown.bind(this);
    this._onClick       = this._onClick.bind(this);
    this._onTouchStart  = this._onTouchStart.bind(this);
    this._onTouchMove   = this._onTouchMove.bind(this);
    this._onTouchEnd    = this._onTouchEnd.bind(this);

    window.addEventListener('resize', this._onResize);
    canvas.addEventListener('pointermove', this._onMove);
    canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);
    canvas.addEventListener('wheel', this._onWheel, { passive: false });
    canvas.addEventListener('click', this._onClick);
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  this._onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   this._onTouchEnd,   { passive: false });
    window.addEventListener('keydown', this._onKeyDown);

    this._setupComposer();
    this._onResize();
    this._hookAudio();
    this._applyFilter();
    this._updateTransport();

    this.root = canvas;

    this.animate = this.animate.bind(this);
    this.animate();
  },

  /* ---------- Water ---------- */
  _buildWater(){
    const size = 2400;
    const geo = new THREE.PlaneGeometry(size, size, 100, 100);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
    });
    const water = new THREE.Mesh(geo, mat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -2.0;
    this.scene.add(water);
    this.water = water;
  },

  /* ---------- Block base (thick concrete island) ---------- */
  _buildBlockBase(){
    const W = this.BLOCK_W;
    const L = this.BLOCK_L;

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(W, 3.0, L),
      new THREE.MeshBasicMaterial({ color: 0x10121a })
    );
    slab.position.y = -1.5;
    this.scene.add(slab);

    const rim = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 6, L + 6),
      new THREE.MeshBasicMaterial({ color: 0x1d1e26 })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = -0.02;
    this.scene.add(rim);

    const div = 8;
    const grid = new THREE.GridHelper(Math.max(W, L) * 1.0, div, 0x232434, 0x171823);
    grid.position.y = 0.01;
    grid.material.transparent = true;
    grid.material.opacity = 0.42;
    grid.material.depthWrite = false;
    this.scene.add(grid);
  },

  /* ---------- Park ---------- */
  _buildPark(){
    const W = this.PARK_W;
    const L = this.PARK_L;

    const grassRim = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 6, L + 6),
      new THREE.MeshBasicMaterial({ color: 0x07150c })
    );
    grassRim.rotation.x = -Math.PI / 2;
    grassRim.position.y = 0.02;
    this.scene.add(grassRim);

    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(W, L),
      new THREE.MeshBasicMaterial({ color: 0x12381f })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = 0.03;
    this.scene.add(grass);

    const pathMat = new THREE.MeshBasicMaterial({ color: 0x2e2f35, transparent: true, opacity: 0.92 });

    const spine = new THREE.Mesh(new THREE.PlaneGeometry(2.4, L * 0.96), pathMat);
    spine.rotation.x = -Math.PI / 2;
    spine.position.y = 0.06;
    this.scene.add(spine);

    for (let i = 0; i < 4; i++){
      const p = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.86, 1.4), pathMat);
      p.rotation.x = -Math.PI / 2;
      p.position.y = 0.05;
      p.position.z = -L / 2 + (i + 1) * (L / 5) + (Math.random() - 0.5) * 8;
      p.rotation.z = (Math.random() - 0.5) * 0.4;
      this.scene.add(p);
    }

    const pondGeo = new THREE.CircleGeometry(11, 48);
    const pondMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main(){
          vec2 c = vUv - 0.5;
          float r = length(c);
          float ring = 0.5 + 0.5 * sin(r * 36.0 - uTime * 1.8);
          vec3 base = vec3(0.05, 0.18, 0.32);
          vec3 high = vec3(0.18, 0.38, 0.62);
          vec3 col = mix(base, high, ring * (1.0 - r * 1.4));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const pond = new THREE.Mesh(pondGeo, pondMat);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(0, 0.07, L * 0.30);
    this.scene.add(pond);
    this._pondMat = pondMat;
    this._pondCenter = { x: 0, z: L * 0.30 };
  },

  /* ---------- Stream ---------- */
  _buildStream(){
    const W = this.PARK_W;
    const L = this.PARK_L;

    this._streamZ = -L * 0.04;
    const segLen = 1.6;
    const segs = Math.floor(W / segLen);
    for (let i = 0; i < segs; i++){
      const x = -W / 2 + (i + 0.5) * (W / segs);
      const meander = Math.sin(i * 0.42) * 1.6 + Math.sin(i * 1.1) * 0.4;
      const seg = new THREE.Mesh(
        new THREE.PlaneGeometry(W / segs + 0.4, 3.0),
        SHARED.streamMat
      );
      seg.rotation.x = -Math.PI / 2;
      seg.position.set(x, 0.04, this._streamZ + meander);
      this.scene.add(seg);
    }
  },

  /* ---------- Bridges ---------- */
  _buildBridges(){
    const z = this._streamZ || 0;
    this._buildBridge(0, z);
    this._buildBridge(this.PARK_W * 0.32, z);
    this._buildBridge(-this.PARK_W * 0.32, z);
  },

  _buildBridge(x, z){
    const g = new THREE.Group();

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.4, 5.0),
      SHARED.stone
    );
    deck.position.y = 1.0;
    g.add(deck);

    const archGeo = new THREE.TorusGeometry(2.0, 0.35, 8, 14, Math.PI);
    const arch1 = new THREE.Mesh(archGeo, SHARED.stoneLight);
    arch1.rotation.y = Math.PI / 2;
    arch1.position.set(0, 0.1, 0);
    g.add(arch1);

    for (let i = 0; i < 5; i++){
      const xx = -1.4 + i * 0.7;
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.9, 0.18),
        SHARED.stoneLight
      );
      post.position.set(xx, 1.7, 2.2);
      g.add(post);
      const post2 = post.clone();
      post2.position.z = -2.2;
      g.add(post2);
    }
    const rail1 = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.12, 0.12), SHARED.stoneLight
    );
    rail1.position.set(0, 2.10, 2.2);
    g.add(rail1);
    const rail2 = rail1.clone();
    rail2.position.z = -2.2;
    g.add(rail2);

    g.position.set(x, 0, z);
    this.scene.add(g);
  },

  /* ---------- Fountains ---------- */
  _buildFountains(){
    const L = this.PARK_L;
    this._buildFountain(0, -L * 0.22);
    this._buildFountain(0,  L * 0.06);
  },

  _buildFountain(x, z){
    const grp = new THREE.Group();

    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(5.2, 36),
      new THREE.MeshBasicMaterial({ color: 0x14385a })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.07;
    grp.add(pool);

    const rim = new THREE.Mesh(
      new THREE.RingGeometry(5.0, 5.6, 36),
      new THREE.MeshBasicMaterial({ color: 0x4a4b54, side: THREE.DoubleSide })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.10;
    grp.add(rim);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.9, 2.4, 18),
      SHARED.metalLight
    );
    pillar.position.y = 1.2;
    grp.add(pillar);

    const spout = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xb8e0ff, transparent: true, opacity: 0.95 })
    );
    spout.position.y = 2.7;
    grp.add(spout);

    const jetGeo = new THREE.BufferGeometry();
    const N = 80;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++){
      const a  = Math.random() * Math.PI * 2;
      const rr = Math.random() * 0.6;
      pos[i*3]   = Math.cos(a) * rr;
      pos[i*3+1] = 2.5 + Math.random() * 2.5;
      pos[i*3+2] = Math.sin(a) * rr;
    }
    jetGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const jetMat = new THREE.PointsMaterial({
      color: 0xcfe8ff, size: 0.20, sizeAttenuation: true,
      transparent: true, opacity: 0.80, depthWrite: false,
    });
    const jet = new THREE.Points(jetGeo, jetMat);
    grp.add(jet);

    grp.position.set(x, 0, z);
    this.scene.add(grp);
    this.fountains.push({ group: grp, spout, jet, jetGeo, x, z });
  },

  /* ---------- Statue ---------- */
  _buildStatue(){
    const g = new THREE.Group();
    const z = this.PARK_L * 0.42;

    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 1.2, 3.4),
      SHARED.stone
    );
    plinth.position.y = 0.6;
    g.add(plinth);

    const plinthCap = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.16, 3.6),
      SHARED.stoneLight
    );
    plinthCap.position.y = 1.28;
    g.add(plinthCap);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.58, 6.0, 14),
      SHARED.stoneLight
    );
    pillar.position.y = 1.2 + 3.0;
    g.add(pillar);

    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.1, 1),
      new THREE.MeshBasicMaterial({ color: 0x8a8a92 })
    );
    orb.position.y = 1.2 + 6.0 + 0.9;
    g.add(orb);

    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.4, 8),
      SHARED.stoneLight
    );
    cap.position.y = 1.2 + 6.0 + 0.9 + 1.4;
    g.add(cap);

    g.position.set(0, 0, z);
    this.scene.add(g);
    this._statueZ = z;
  },

  /* ---------- Gazebo ---------- */
  _buildGazebo(){
    const g = new THREE.Group();
    const z = -this.PARK_L * 0.36;
    const x = this.PARK_W * 0.20;

    const floorGeo = new THREE.CylinderGeometry(5.0, 5.0, 0.4, 8);
    const floor = new THREE.Mesh(floorGeo, SHARED.stoneLight);
    floor.position.y = 0.20;
    g.add(floor);

    const stepGeo = new THREE.CylinderGeometry(5.4, 5.4, 0.16, 8);
    const step = new THREE.Mesh(stepGeo, SHARED.stone);
    step.position.y = 0.08;
    g.add(step);

    const pillarH = 4.2;
    for (let i = 0; i < 8; i++){
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const p = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.20, pillarH, 8),
        SHARED.stoneLight
      );
      p.position.set(Math.cos(a) * 4.7, 0.4 + pillarH / 2, Math.sin(a) * 4.7);
      g.add(p);
    }

    const ringGeo = new THREE.TorusGeometry(4.7, 0.10, 6, 16);
    const ring = new THREE.Mesh(ringGeo, SHARED.stoneLight);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4 + pillarH;
    g.add(ring);

    const roofGeo = new THREE.ConeGeometry(5.6, 3.0, 8);
    const roof = new THREE.Mesh(roofGeo, SHARED.roof);
    roof.position.y = 0.4 + pillarH + 1.5;
    g.add(roof);

    const finialGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6);
    const finial = new THREE.Mesh(finialGeo, SHARED.metal);
    finial.position.y = 0.4 + pillarH + 3.0 + 0.6;
    g.add(finial);
    const finBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 10, 8),
      SHARED.metalLight
    );
    finBall.position.y = 0.4 + pillarH + 3.0 + 1.3;
    g.add(finBall);

    g.position.set(x, 0, z);
    this.scene.add(g);
    this._gazeboPos = { x, z };
  },

  /* ---------- Playground ---------- */
  _buildPlayground(){
    const g = new THREE.Group();
    const cx = -this.PARK_W * 0.22;
    const cz = -this.PARK_L * 0.06;

    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      SHARED.sand
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = 0.04;
    g.add(sand);

    const slideStruct = new THREE.Group();
    const ladder1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 3.0, 0.12), SHARED.metal
    );
    ladder1.position.set(-0.6, 1.5, 0);
    slideStruct.add(ladder1);
    const ladder2 = ladder1.clone();
    ladder2.position.x = 0.6;
    slideStruct.add(ladder2);
    for (let i = 0; i < 4; i++){
      const rung = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.08, 0.08), SHARED.metal
      );
      rung.position.set(0, 0.6 + i * 0.7, 0);
      slideStruct.add(rung);
    }
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.12, 1.6), SHARED.boatHull
    );
    platform.position.set(0, 3.0, 0.8);
    slideStruct.add(platform);
    const slideRamp = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.10, 4.6), SHARED.stoneLight
    );
    slideRamp.position.set(0, 1.55, 3.0);
    slideRamp.rotation.x = -0.32;
    slideStruct.add(slideRamp);
    const slideRail1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.30, 4.6), SHARED.metal
    );
    slideRail1.position.set(-0.6, 1.75, 3.0);
    slideRail1.rotation.x = -0.32;
    slideStruct.add(slideRail1);
    const slideRail2 = slideRail1.clone();
    slideRail2.position.x = 0.6;
    slideStruct.add(slideRail2);
    slideStruct.position.set(-4, 0, 0);
    g.add(slideStruct);

    const swingFrame = new THREE.Group();
    const sp1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 2.8, 0.18), SHARED.metal
    );
    sp1.position.set(-2, 1.4, 0);
    swingFrame.add(sp1);
    const sp2 = sp1.clone();
    sp2.position.x = 2;
    swingFrame.add(sp2);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.16, 0.16), SHARED.metal
    );
    top.position.y = 2.8;
    swingFrame.add(top);
    for (let i = 0; i < 2; i++){
      const offset = i === 0 ? -1.0 : 1.0;
      const rope1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 1.6, 0.05), SHARED.rope
      );
      rope1.position.set(offset - 0.3, 2.0, 0);
      swingFrame.add(rope1);
      const rope2 = rope1.clone();
      rope2.position.x = offset + 0.3;
      swingFrame.add(rope2);
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.10, 0.32), SHARED.benchWood
      );
      seat.position.set(offset, 1.2, 0);
      swingFrame.add(seat);
    }
    swingFrame.position.set(2.5, 0, -2.5);
    g.add(swingFrame);

    const seesaw = new THREE.Group();
    const pivot = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.6, 0.3), SHARED.metal
    );
    pivot.position.y = 0.3;
    seesaw.add(pivot);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.14, 4.2), SHARED.benchWood
    );
    board.position.y = 0.65;
    board.rotation.x = 0.08;
    seesaw.add(board);
    seesaw.position.set(3.5, 0, 2.8);
    seesaw.rotation.y = 0.4;
    g.add(seesaw);

    g.position.set(cx, 0, cz);
    this.scene.add(g);
  },

  /* ---------- Picnic area ---------- */
  _buildPicnicArea(){
    const g = new THREE.Group();
    const cx = this.PARK_W * 0.22;
    const cz = this.PARK_L * 0.22;

    const positions = [
      [-2.2, -2.0,  0.2],
      [ 2.4, -1.6, -0.4],
      [-2.0,  2.2,  0.7],
      [ 2.2,  2.4, -0.3],
    ];
    for (const [dx, dz, rot] of positions){
      const t = new THREE.Group();

      const top = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.10, 1.0), SHARED.benchWood
      );
      top.position.y = 0.7;
      t.add(top);

      const bench1 = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.10, 0.4), SHARED.benchWood
      );
      bench1.position.set(0, 0.45, 0.75);
      t.add(bench1);
      const bench2 = bench1.clone();
      bench2.position.z = -0.75;
      t.add(bench2);

      const leg1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.7, 0.12), SHARED.benchWood
      );
      leg1.position.set(-1.1, 0.35, 0);
      t.add(leg1);
      const leg2 = leg1.clone();
      leg2.position.x = 1.1;
      t.add(leg2);

      const umbrellaPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 3.6, 6),
        SHARED.metalDark
      );
      umbrellaPole.position.y = 0.7 + 1.8;
      t.add(umbrellaPole);

      const umbrella = new THREE.Mesh(
        new THREE.ConeGeometry(1.9, 0.9, 8),
        SHARED.hotdogRed
      );
      umbrella.position.y = 0.7 + 3.6 + 0.45;
      t.add(umbrella);

      t.position.set(dx, 0, dz);
      t.rotation.y = rot;
      g.add(t);
    }

    g.position.set(cx, 0, cz);
    this.scene.add(g);
  },

  /* ---------- Hot dog cart ---------- */
  _buildHotDogCart(){
    const g = new THREE.Group();
    const cx = -this.PARK_W * 0.34;
    const cz = this.PARK_L * 0.36;

    const cart = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.1, 1.4),
      SHARED.hotdogWhite
    );
    cart.position.y = 0.75;
    g.add(cart);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.21, 0.18, 1.41),
      SHARED.hotdogRed
    );
    stripe.position.y = 1.05;
    g.add(stripe);

    for (let i = -1; i <= 1; i += 2){
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.30, 0.30, 0.18, 12),
        SHARED.metalDark
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(i * 0.9, 0.30, 0.5);
      g.add(wheel);
      const wheel2 = wheel.clone();
      wheel2.position.z = -0.5;
      g.add(wheel2);
    }

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6),
      SHARED.metalDark
    );
    pole.position.y = 1.1 + 1.7;
    g.add(pole);

    const parasol = new THREE.Mesh(
      new THREE.ConeGeometry(1.8, 0.7, 8),
      SHARED.hotdogYellow
    );
    parasol.position.y = 1.1 + 3.4 + 0.35;
    g.add(parasol);

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.4),
      SHARED.hotdogRed
    );
    sign.position.set(0, 0.85, 0.71);
    g.add(sign);

    g.position.set(cx, 0, cz);
    g.rotation.y = 0.3;
    this.scene.add(g);
    this._hotdogPos = { x: cx, z: cz };
  },

  /* ---------- Lampposts ---------- */
  _buildLampposts(){
    const L = this.PARK_L;
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.18, 4.2, 6);
    const lampGeo = new THREE.SphereGeometry(0.35, 10, 8);
    const haloGeo = new THREE.PlaneGeometry(7, 7);

    const COUNT = 10;
    for (let i = 0; i < COUNT; i++){
      const z = -L * 0.45 + (i / (COUNT - 1)) * L * 0.90;
      for (const x of [2.2, -2.2]){
        const g = new THREE.Group();
        const pole = new THREE.Mesh(poleGeo, SHARED.metalDark);
        pole.position.y = 2.1;
        g.add(pole);
        const lamp = new THREE.Mesh(lampGeo, SHARED.lamp);
        lamp.position.y = 4.2;
        g.add(lamp);
        const halo = new THREE.Mesh(haloGeo, SHARED.lampHalo);
        halo.rotation.x = -Math.PI / 2;
        halo.position.y = 0.08;
        g.add(halo);
        g.position.set(x, 0, z);
        this.scene.add(g);
      }
    }
  },

  /* ---------- Benches ---------- */
  _buildBenches(){
    const L = this.PARK_L;
    const seatGeo = new THREE.BoxGeometry(2.0, 0.10, 0.45);
    const backGeo = new THREE.BoxGeometry(2.0, 0.50, 0.08);
    const legGeo  = new THREE.BoxGeometry(0.10, 0.40, 0.50);

    const positions = [
      [ 5.4, -L * 0.36,  1],
      [-5.4, -L * 0.36, -1],
      [ 5.4, -L * 0.18,  1],
      [-5.4, -L * 0.18, -1],
      [ 5.4,  L * 0.04,  1],
      [-5.4,  L * 0.04, -1],
      [ 5.4,  L * 0.22,  1],
      [-5.4,  L * 0.22, -1],
      [ 5.4,  L * 0.36,  1],
      [-5.4,  L * 0.36, -1],
    ];

    for (const [x, z, faceDir] of positions){
      const g = new THREE.Group();

      const seat = new THREE.Mesh(seatGeo, SHARED.benchWood);
      seat.position.y = 0.55;
      g.add(seat);

      const back = new THREE.Mesh(backGeo, SHARED.benchWood);
      back.position.y = 0.85;
      back.position.z = -0.2 * faceDir;
      g.add(back);

      const leg1 = new THREE.Mesh(legGeo, SHARED.metalDark);
      leg1.position.set(-0.9, 0.30, 0);
      g.add(leg1);

      const leg2 = new THREE.Mesh(legGeo, SHARED.metalDark);
      leg2.position.set(0.9, 0.30, 0);
      g.add(leg2);

      const ry = x > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      this.scene.add(g);

      const cosR = Math.cos(ry), sinR = Math.sin(ry);
      const ax = cosR, az = -sinR;
      this.benchPositions.push({
        x: x + ax * 0.55, z: z + az * 0.55,
        rot: ry + Math.PI / 2,
      });
      this.benchPositions.push({
        x: x - ax * 0.55, z: z - az * 0.55,
        rot: ry + Math.PI / 2,
      });
    }
  },

  /* ---------- Streetlights ---------- */
  _buildStreetlights(){
    const W = this.BLOCK_W;
    const L = this.BLOCK_L;
    const poleGeo = new THREE.CylinderGeometry(0.10, 0.15, 5.0, 6);
    const lampGeo = new THREE.SphereGeometry(0.30, 10, 8);
    const haloGeo = new THREE.PlaneGeometry(5, 5);

    const addOne = (x, z) => {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(poleGeo, SHARED.metalDark);
      pole.position.y = 2.5;
      g.add(pole);
      const lamp = new THREE.Mesh(lampGeo, SHARED.lamp);
      lamp.position.y = 5.0;
      g.add(lamp);
      const halo = new THREE.Mesh(haloGeo, SHARED.lampHalo);
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.08;
      g.add(halo);
      g.position.set(x, 0, z);
      this.scene.add(g);
    };

    const longCount = 6;
    for (let i = 0; i < longCount; i++){
      const z = -L * 0.45 + (i / (longCount - 1)) * L * 0.90;
      addOne( W / 2 - 1.6, z);
      addOne(-W / 2 + 1.6, z);
    }
    const capCount = 3;
    for (let i = 0; i < capCount; i++){
      const x = -W * 0.36 + (i / (capCount - 1)) * W * 0.72;
      addOne(x,  L / 2 - 1.6);
      addOne(x, -L / 2 + 1.6);
    }
  },

  /* ---------- Flower beds ---------- */
  _buildFlowerBeds(){
    const W = this.PARK_W;
    const L = this.PARK_L;
    const beds = [];

    for (let i = 0; i < 10; i++){
      const z = -L * 0.45 + (i / 9) * L * 0.90 + (Math.random() - 0.5) * 6;
      beds.push({ x: 5.6 + (Math.random() - 0.5) * 1.4, z, r: 1.6 });
      beds.push({ x: -5.6 + (Math.random() - 0.5) * 1.4, z, r: 1.6 });
    }
    for (const f of this.fountains){
      for (let i = 0; i < 4; i++){
        const a = (i / 4) * Math.PI * 2 + 0.4;
        beds.push({ x: f.x + Math.cos(a) * 6.8, z: f.z + Math.sin(a) * 6.8, r: 1.4 });
      }
    }
    for (let i = 0; i < 14; i++){
      const x = (Math.random() - 0.5) * W * 0.78;
      const z = (Math.random() - 0.5) * L * 0.88;
      if (Math.abs(x) < 3.5) continue;
      if (this._pondCenter && Math.hypot(x - this._pondCenter.x, z - this._pondCenter.z) < 14) continue;
      let near = false;
      for (const f of this.fountains){
        if (Math.hypot(x - f.x, z - f.z) < 9) { near = true; break; }
      }
      if (near) continue;
      beds.push({ x, z, r: 1.8 + Math.random() * 0.8 });
    }

    const flowerGeo = new THREE.SphereGeometry(0.30, 6, 5);
    const stemGeo   = new THREE.CylinderGeometry(0.04, 0.04, 0.55, 5);
    const stemMat   = SHARED.fol[2];
    for (const bed of beds){
      const N = 8 + Math.floor(Math.random() * 7);
      const g = new THREE.Group();
      const mulch = new THREE.Mesh(
        new THREE.CircleGeometry(bed.r * 1.25, 16),
        new THREE.MeshBasicMaterial({ color: 0x2a1a10 })
      );
      mulch.rotation.x = -Math.PI / 2;
      mulch.position.y = 0.04;
      g.add(mulch);

      for (let i = 0; i < N; i++){
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * bed.r * 0.95;
        const fx = Math.cos(a) * r;
        const fz = Math.sin(a) * r;
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.set(fx, 0.3, fz);
        g.add(stem);
        const head = new THREE.Mesh(flowerGeo,
          SHARED.flower[Math.floor(Math.random() * SHARED.flower.length)]);
        head.position.set(fx, 0.6, fz);
        head.scale.setScalar(0.7 + Math.random() * 0.6);
        g.add(head);
      }
      g.position.set(bed.x, 0, bed.z);
      this.scene.add(g);
    }
  },

  /* ---------- Trees ---------- */
  _buildTrees(){
    const W = this.PARK_W;
    const L = this.PARK_L;

    const TREE_COUNT = 280;
    let placed = 0;
    let guard = 0;
    while (placed < TREE_COUNT && guard < TREE_COUNT * 10){
      guard++;
      const x = (Math.random() - 0.5) * W * 0.94;
      const z = (Math.random() - 0.5) * L * 0.96;

      let blocked = false;
      for (const f of this.fountains){
        if (Math.hypot(x - f.x, z - f.z) < 8.5) { blocked = true; break; }
      }
      if (blocked) continue;
      if (this._pondCenter && Math.hypot(x - this._pondCenter.x, z - this._pondCenter.z) < 14) continue;
      if (this._statueZ != null && Math.abs(z - this._statueZ) < 6 && Math.abs(x) < 4) continue;
      if (this._gazeboPos && Math.hypot(x - this._gazeboPos.x, z - this._gazeboPos.z) < 7) continue;
      if (this._hotdogPos && Math.hypot(x - this._hotdogPos.x, z - this._hotdogPos.z) < 5) continue;
      if (Math.abs(x) < 2.2) continue;
      if (this._streamZ != null && Math.abs(z - this._streamZ) < 4) continue;

      const type = Math.random();
      const g = new THREE.Group();
      const fol = SHARED.fol[Math.floor(Math.random() * SHARED.fol.length)];

      if (type < 0.02){
        const trunkH = 6.0 + Math.random() * 3.0;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.65, 0.95, trunkH, 9), SHARED.trunk
        );
        trunk.position.y = trunkH / 2;
        g.add(trunk);
        for (let i = 0; i < 5; i++){
          const r = 4.0 * (1 - i * 0.16);
          const h = 4.0;
          const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), fol);
          cone.position.y = trunkH + i * h * 0.55 + h * 0.4;
          g.add(cone);
        }
      }
      else if (type < 0.30){
        const trunkH = 2.4 + Math.random() * 1.4;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.32, 0.46, trunkH, 7), SHARED.trunk
        );
        trunk.position.y = trunkH / 2;
        g.add(trunk);
        const baseR = 2.2 + Math.random() * 0.9;
        const layers = 3 + Math.floor(Math.random() * 2);
        const layerH = 2.4 + Math.random() * 1.0;
        for (let i = 0; i < layers; i++){
          const r = baseR * (1 - i * 0.22);
          const cone = new THREE.Mesh(new THREE.ConeGeometry(r, layerH, 10), fol);
          cone.position.y = trunkH + i * layerH * 0.6 + layerH * 0.4;
          g.add(cone);
        }
      }
      else if (type < 0.60){
        const trunkH = 2.6 + Math.random() * 1.4;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.34, 0.46, trunkH, 7), SHARED.trunk
        );
        trunk.position.y = trunkH / 2;
        g.add(trunk);
        const crownR = 2.6 + Math.random() * 1.2;
        const lobeCount = 4 + Math.floor(Math.random() * 2);
        for (let i = 0; i < lobeCount; i++){
          const sph = new THREE.Mesh(
            new THREE.IcosahedronGeometry(crownR * (0.70 + Math.random() * 0.35), 0),
            fol
          );
          const ang = (i / lobeCount) * Math.PI * 2 + Math.random() * 0.5;
          sph.position.set(
            Math.cos(ang) * crownR * 0.50,
            trunkH + crownR * 0.55 + Math.random() * 0.5,
            Math.sin(ang) * crownR * 0.50,
          );
          sph.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
          g.add(sph);
        }
        const top = new THREE.Mesh(
          new THREE.IcosahedronGeometry(crownR * 0.90, 0), fol
        );
        top.position.y = trunkH + crownR * 1.10;
        g.add(top);
      }
      else if (type < 0.86){
        const trunkH = 0.6 + Math.random() * 0.6;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.30, trunkH, 6), SHARED.trunk
        );
        trunk.position.y = trunkH / 2;
        g.add(trunk);
        const layers = 2 + Math.floor(Math.random() * 2);
        let yCursor = trunkH;
        for (let i = 0; i < layers; i++){
          const r = (1.6 - i * 0.25) + Math.random() * 0.4;
          const h = 1.8 + Math.random() * 0.6;
          const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), fol);
          c.position.y = yCursor + h * 0.45;
          c.position.x = (Math.random() - 0.5) * 0.5;
          c.position.z = (Math.random() - 0.5) * 0.5;
          g.add(c);
          yCursor += h * 0.55;
        }
      }
      else {
        const bush = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1.1 + Math.random() * 0.5, 0), fol
        );
        bush.position.y = 0.7;
        bush.scale.y = 0.7;
        g.add(bush);
      }

      g.position.set(x, 0, z);
      g.rotation.y = Math.random() * Math.PI;
      this.scene.add(g);
      this.trees.push(g);
      placed++;
    }
  },

  /* ---------- People ---------- */
  _buildPeople(){
    const W = this.PARK_W;
    const L = this.PARK_L;

    for (const bp of this.benchPositions){
      if (Math.random() > 0.55) continue;
      const g = this._makeFigure({ sitting: true });
      g.position.set(bp.x, 0, bp.z);
      g.rotation.y = bp.rot;
      this.scene.add(g);
      this.people.push({ group: g, kind: 'sit', t0: Math.random() * 100 });
    }

    for (let i = 0; i < 12; i++){
      const a = -L * 0.45 + Math.random() * L * 0.90;
      const b = -L * 0.45 + Math.random() * L * 0.90;
      const xOff = (Math.random() < 0.5 ? -0.6 : 0.6) * (Math.random() * 0.5 + 0.5);
      const seg = {
        start: new THREE.Vector3(xOff, 0, a),
        end:   new THREE.Vector3(xOff, 0, b),
      };
      const g = this._makeFigure({});
      g.position.copy(seg.start);
      this.scene.add(g);
      this.people.push({
        group: g, kind: 'walk', seg,
        t: Math.random(),
        speed: 0.020 + Math.random() * 0.028,
        dir: Math.random() < 0.5 ? 1 : -1,
        t0: Math.random() * 100,
      });
    }

    const crossZs = [-L * 0.30, -L * 0.10, L * 0.10, L * 0.30];
    for (const cz of crossZs){
      for (let k = 0; k < 2; k++){
        const seg = {
          start: new THREE.Vector3(-W * 0.40, 0, cz),
          end:   new THREE.Vector3( W * 0.40, 0, cz),
        };
        const g = this._makeFigure({});
        g.position.copy(seg.start.clone().lerp(seg.end, Math.random()));
        this.scene.add(g);
        this.people.push({
          group: g, kind: 'walk', seg,
          t: Math.random(),
          speed: 0.018 + Math.random() * 0.022,
          dir: Math.random() < 0.5 ? 1 : -1,
          t0: Math.random() * 100,
        });
      }
    }

    if (this._hotdogPos){
      const g = this._makeFigure({});
      g.position.set(this._hotdogPos.x + 1.4, 0, this._hotdogPos.z + 0.2);
      g.rotation.y = -Math.PI / 2;
      this.scene.add(g);
      this.people.push({ group: g, kind: 'static', t0: Math.random() * 100 });
    }

    if (this._gazeboPos){
      const g1 = this._makeFigure({});
      g1.position.set(this._gazeboPos.x + 1.4, 0, this._gazeboPos.z + 0.6);
      this.scene.add(g1);
      this.people.push({ group: g1, kind: 'static', t0: Math.random() * 100 });

      const g2 = this._makeFigure({});
      g2.position.set(this._gazeboPos.x - 1.0, 0, this._gazeboPos.z - 1.2);
      g2.rotation.y = Math.PI;
      this.scene.add(g2);
      this.people.push({ group: g2, kind: 'static', t0: Math.random() * 100 });
    }
  },

  _makeFigure({ sitting = false } = {}){
    const g = new THREE.Group();
    const shirt = SHARED.shirts[Math.floor(Math.random() * SHARED.shirts.length)];
    const hair  = SHARED.hair[Math.floor(Math.random() * SHARED.hair.length)];

    const bodyH = 0.95;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20, 0.22, bodyH, 8), shirt
    );
    body.position.y = (sitting ? 0.55 : 0.95);
    g.add(body);

    const legs = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.20, 0.85, 8), SHARED.pants
    );
    if (sitting){
      legs.position.set(0, 0.30, 0.30);
      legs.rotation.x = Math.PI / 2.3;
      legs.scale.y = 0.55;
    } else {
      legs.position.y = 0.42;
    }
    g.add(legs);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8), SHARED.skin
    );
    head.position.y = (sitting ? 1.20 : 1.62);
    g.add(head);

    const hat = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.24, 0), hair
    );
    hat.position.y = (sitting ? 1.36 : 1.78);
    hat.scale.y = 0.55;
    g.add(hat);

    return g;
  },

  /* ---------- Boats ---------- */
  _buildBoats(){
    const positions = [
      [-280, -180,  0.4], [-340,   80, -0.6], [-260,  340,  0.2],
      [ 300, -340, -0.3], [ 360,  -40,  0.7], [ 290,  240, -0.5],
      [-120, -400,  1.1], [ 140,  420, -1.0],
      [ 460, -180,  0.6], [-460,   200, -1.2],
    ];
    for (const [x, z, ry] of positions){
      const g = new THREE.Group();

      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(4.0, 0.9, 1.5),
        SHARED.boatHull
      );
      hull.position.y = -0.65;
      g.add(hull);

      const bow = new THREE.Mesh(
        new THREE.ConeGeometry(0.75, 1.2, 4),
        SHARED.boatHull
      );
      bow.rotation.z = -Math.PI / 2;
      bow.rotation.y = Math.PI / 4;
      bow.position.set(2.4, -0.65, 0);
      g.add(bow);

      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.7, 1.0),
        SHARED.boatCabin
      );
      cabin.position.set(-0.4, 0.0, 0);
      g.add(cabin);

      const sail = new THREE.Mesh(
        new THREE.PlaneGeometry(2.0, 2.6),
        SHARED.boatSail
      );
      sail.position.set(0.4, 1.0, 0);
      sail.rotation.y = Math.PI / 2;
      g.add(sail);

      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 3.0, 5),
        SHARED.metalDark
      );
      mast.position.set(0.4, 1.0, 0);
      g.add(mast);

      g.position.set(x, -0.8, z);
      g.rotation.y = ry;
      this.scene.add(g);
      g.userData.boatBobY  = g.position.y;
      g.userData.boatPhase = Math.random() * Math.PI * 2;
      g.userData.boatSpeed = 0.6 + Math.random() * 0.7;
      this._boats.push(g);
    }
  },

  /* ---------- Birds ---------- */
  _buildBirds(){
    const COUNT = 18;
    const birdGeo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      -0.7, 0, 0,
       0.0, 0, 0.18,
       0.7, 0, 0,
       0.0, 0, -0.10,
    ]);
    const idx = new Uint16Array([0,1,2, 0,2,3]);
    birdGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    birdGeo.setIndex(new THREE.BufferAttribute(idx, 1));
    birdGeo.computeVertexNormals();

    for (let i = 0; i < COUNT; i++){
      const mesh = new THREE.Mesh(birdGeo, SHARED.bird);
      const cx = (Math.random() - 0.5) * 400;
      const cz = (Math.random() - 0.5) * 650;
      const radius = 40 + Math.random() * 140;
      const altitude = 60 + Math.random() * 90;
      const speed = 0.16 + Math.random() * 0.22;
      const phase = Math.random() * Math.PI * 2;
      const flapSpeed = 6 + Math.random() * 5;
      mesh.position.set(cx + radius, altitude, cz);
      this.scene.add(mesh);
      this.birds.push({
        mesh, cx, cz, radius, altitude, speed, phase, flapSpeed,
      });
    }
  },

  /* ---------- Starfield ---------- */
  _buildStarfield(){
    const N = 1100;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++){
      const r = 800 + Math.random() * 700;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
      pos[i*3+1] = Math.abs(r * Math.cos(ph)) * 0.5 + 50;
      pos[i*3+2] = r * Math.sin(ph) * Math.sin(th);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xb8c0d8, size: 0.85, sizeAttenuation: true,
      transparent: true, opacity: 0.55, depthWrite: false,
    });
    this.scene.add(new THREE.Points(geo, mat));
  },

  /* ---------- Block (music towers) ---------- */
  _buildBlock(){
    const tracks = (this.ctx.tracks || []).slice();
    if (!tracks.length) return;

    const N = tracks.length;
    const W = this.PARK_W;
    const L = this.PARK_L;

    const longSideShare = 0.80;
    const perLongSide   = Math.ceil(N * longSideShare / 2);
    const perLongRank   = Math.ceil(perLongSide / 2);
    const perCap        = Math.ceil((N - perLongRank * 4) / 2);

    const rankPitchX = 13;
    const r1OffX = W / 2 + rankPitchX * 0.55;
    const r2OffX = r1OffX + rankPitchX;
    this._r1OffX = r1OffX;
    this._r2OffX = r2OffX;
    this._musicTrackCount = N;

    const slots = [];
    const jitter = (k) => (Math.random() - 0.5) * k;

    const pushLongRank = (xCenter, side, rank) => {
      const rowL = L + 30;
      for (let i = 0; i < perLongRank; i++){
        const tNorm = (i + 0.5) / perLongRank;
        const z = -rowL / 2 + tNorm * rowL + jitter(2.6);
        const x = xCenter + jitter(2.4);
        slots.push({ x, z, side, rank, prio: rank === 1 ? 0 : 1 });
      }
    };
    pushLongRank( r1OffX, 'east', 1);
    pushLongRank( r2OffX, 'east', 2);
    pushLongRank(-r1OffX, 'west', 1);
    pushLongRank(-r2OffX, 'west', 2);

    const pushCap = (zCenter, side) => {
      const rowW = W + 2 * (r2OffX - W / 2) + 6;
      for (let i = 0; i < perCap; i++){
        const tNorm = (i + 0.5) / perCap;
        const x = -rowW / 2 + tNorm * rowW + jitter(2.4);
        const z = zCenter + jitter(2.4);
        slots.push({ x, z, side, rank: 1, prio: 2 });
      }
    };
    const capZ = L / 2 + rankPitchX * 1.2;
    pushCap( capZ, 'north');
    pushCap(-capZ, 'south');
    this._capZ = capZ;

    const indexed = tracks.map((t, i) => ({ t, i }));
    indexed.sort((a, b) => {
      const ra = a.t.isFeatured ? 0 : a.t.isNew ? 1 : 2;
      const rb = b.t.isFeatured ? 0 : b.t.isNew ? 1 : 2;
      if (ra !== rb) return ra - rb;
      return (b.t.date || '').localeCompare(a.t.date || '');
    });

    const shuf = (arr) => {
      for (let i = arr.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };
    const front = shuf(slots.filter(s => s.prio === 0));
    const back  = shuf(slots.filter(s => s.prio === 1));
    const caps  = shuf(slots.filter(s => s.prio === 2));
    const ordered = [...front, ...back, ...caps];

    for (let i = 0; i < indexed.length; i++){
      const slot = ordered[i];
      if (!slot) break;
      const e = indexed[i];
      this._addTower(e.t, e.i, slot.x, slot.z, slot);
    }
  },

  _addTower(track, idx, x, z, slot){
    const tier  = tierOf(track);
    const tint  = colorForTrack(track, idx);
    const tintV = new THREE.Vector3(tint[0], tint[1], tint[2]);

    let height, width;
    if (tier === 'featured') { height = 70 + Math.random() * 28; width = 6.2 + Math.random() * 1.6; }
    else if (tier === 'new') { height = 50 + Math.random() * 16; width = 5.6 + Math.random() * 1.0; }
    else                     { height = 30 + Math.random() * 14; width = 5.0 + Math.random() * 0.8; }

    const depth = width * (0.82 + Math.random() * 0.36);

    const tex = this._makeTowerTexture(track.title, tier);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex:      { value: tex },
        uTime:     { value: Math.random() * 100 },
        uBass:     { value: 0 },
        uHover:    { value: 0 },
        uFocus:    { value: 0 },
        uPlaying:  { value: 0 },
        uTint:     { value: tintV },
        uHueShift: { value: 0 },
      },
      vertexShader: TOWER_VERTEX,
      fragmentShader: TOWER_FRAGMENT,
      transparent: false,
    });

    const geo  = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, mat);
    const yRot = (Math.random() - 0.5) * 0.18;
    mesh.position.set(x, height / 2, z);
    mesh.rotation.y = yRot;

    const group = new THREE.Group();
    group.add(mesh);

    const haloGeo = new THREE.PlaneGeometry(width * 4.6, width * 4.6);
    const haloMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(tint[0], tint[1], tint[2]),
      transparent: true, opacity: 0.0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(x, 0.08, z);
    group.add(halo);

    const tower = {
      mesh, group, halo, haloMat, mat, tex,
      idx, track, slug: slugifyLocal(track.title), tier,
      basePos: new THREE.Vector3(x, height / 2, z),
      basePosY: height / 2,
      height, width, depth, yRot,
      tint, tintV,
      timeOffset: Math.random() * 100,
      slot,
    };

    this._addCrown(tower);
    this.scene.add(group);

    this.towers.push(tower);
    mesh.userData.tower = tower;
  },

  _addCrown(tower){
    const baseY = tower.mesh.position.y + tower.height / 2;
    const cx = tower.mesh.position.x;
    const cz = tower.mesh.position.z;
    const yRot = tower.yRot;

    const bias = tower.tier === 'featured' ? -0.18 : tower.tier === 'archive' ? 0.20 : 0;
    const r = Math.random() + bias;

    const crownColor = new THREE.Color(
      tower.tint[0] * 0.35 + 0.10,
      tower.tint[1] * 0.35 + 0.10,
      tower.tint[2] * 0.35 + 0.12,
    );
    const crownMat = new THREE.MeshBasicMaterial({ color: crownColor });

    if (r < 0.20){ return; }

    if (r < 0.50){
      const poleH = 5 + Math.random() * 5;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, poleH, 6),
        SHARED.metal
      );
      pole.position.set(cx, baseY + poleH / 2, cz);
      tower.group.add(pole);
      const blink = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 8, 6),
        SHARED.blink
      );
      blink.position.set(cx, baseY + poleH + 0.35, cz);
      tower.group.add(blink);
      this.blinkers.push(blink);
      return;
    }

    if (r < 0.74){
      const sH = 4 + Math.random() * 10;
      const sW = tower.width * (0.55 + Math.random() * 0.20);
      const sD = tower.depth * (0.55 + Math.random() * 0.20);
      const setback = new THREE.Mesh(new THREE.BoxGeometry(sW, sH, sD), crownMat);
      setback.position.set(cx, baseY + sH / 2, cz);
      setback.rotation.y = yRot;
      tower.group.add(setback);

      if (Math.random() < 0.45){
        const s2H = 2 + Math.random() * 4;
        const s2W = sW * 0.62;
        const s2D = sD * 0.62;
        const s2 = new THREE.Mesh(new THREE.BoxGeometry(s2W, s2H, s2D), crownMat);
        s2.position.set(cx, baseY + sH + s2H / 2, cz);
        s2.rotation.y = yRot;
        tower.group.add(s2);
        if (Math.random() < 0.5){
          const tipH = 3 + Math.random() * 3;
          const tip = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.12, tipH, 6),
            SHARED.metal
          );
          tip.position.set(cx, baseY + sH + s2H + tipH / 2, cz);
          tower.group.add(tip);
        }
      }
      return;
    }

    if (r < 0.88){
      const pH = 5 + Math.random() * 7;
      const pR = tower.width * 0.62;
      const pyr = new THREE.Mesh(new THREE.ConeGeometry(pR, pH, 4), crownMat);
      pyr.position.set(cx, baseY + pH / 2, cz);
      pyr.rotation.y = yRot + Math.PI / 4;
      tower.group.add(pyr);
      return;
    }

    const tankR = tower.width * 0.30;
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(tankR, tankR, 2.6, 14),
      SHARED.metalDark
    );
    tank.position.set(cx, baseY + 1.3 + 1.0, cz);
    tower.group.add(tank);

    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(tankR + 0.04, 0.8, 14),
      SHARED.metalDark
    );
    cap.position.set(cx, baseY + 1.3 + 2.0 + 0.4 + 0.5, cz);
    tower.group.add(cap);

    for (let i = 0; i < 4; i++){
      const a = (i / 4) * Math.PI * 2 + yRot;
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 1.3, 0.18),
        SHARED.metalDark
      );
      leg.position.set(
        cx + Math.cos(a) * tankR * 0.85,
        baseY + 0.65,
        cz + Math.sin(a) * tankR * 0.85,
      );
      tower.group.add(leg);
    }
  },

  _makeTowerTexture(title, tier){
    const text   = (title || '').toUpperCase();
    const W      = 256;
    const H      = 1024;
    const fontPx = tier === 'featured' ? 158 : tier === 'new' ? 138 : 120;

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0.00, '#0a0a14');
    grad.addColorStop(0.50, '#13131c');
    grad.addColorStop(1.00, '#070710');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 1);

    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    for (let i = 0; i < 14; i++){
      const y = (i + 0.5) * (H / 14);
      ctx.fillRect(W * 0.08, y - 0.5, W * 0.84, 1);
    }

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = `900 ${fontPx}px "Space Grotesk", Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    const maxWidth = H - 60;
    const m = ctx.measureText(text);
    let scale = 1;
    if (m.width > maxWidth) scale = maxWidth / m.width;
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.fillText(text, 0, 0);
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.fillRect(4, 0, 1, H);
    ctx.fillRect(W - 5, 0, 1, H);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  },

  /* ---------- FILLER buildings (non-music) on the main block ---------- */
  /* t19 rewrite — pack the *entire grid space* outside the music belt with
     buildings in continuous rows, not just one outer rank. East/West gets
     3 ranks of filler; the north/south caps get 4 ranks. Inner rank is
     deliberately shorter so the music towers still dominate the silhouette. */
  _buildFillers(){
    const W = this.PARK_W;
    const L = this.PARK_L;
    const BW = this.BLOCK_W;
    const BL = this.BLOCK_L;
    const r2OffX = this._r2OffX || (W / 2 + 13 * 1.55);
    const capZ   = this._capZ   || (L / 2 + 13 * 1.2);

    // ---------- East / West long sides ----------
    // Strip is from r2OffX + 6 (just outside the music rank-2 line) to
    // the block edge minus a 3u sidewalk.
    const longBegin = r2OffX + 6;
    const longEnd   = BW / 2 - 3;
    const longRanks = Math.max(2, Math.floor((longEnd - longBegin) / 8.5));
    const longSlots = 38;

    for (let r = 0; r < longRanks; r++){
      const xc = longBegin + (r + 0.5) * (longEnd - longBegin) / longRanks;
      const isInner = (r === 0);
      for (let i = 0; i < longSlots; i++){
        const tNorm = (i + 0.5) / longSlots;
        const z = -BL / 2 + 6 + tNorm * (BL - 12) + (Math.random() - 0.5) * 1.6;
        this._addFiller( xc + (Math.random() - 0.5) * 1.8, z, { small: isInner });
        this._addFiller(-xc + (Math.random() - 0.5) * 1.8, z, { small: isInner });
      }
    }

    // ---------- North / South caps ----------
    // From the cap music line out to the block edge — ample room for 4 ranks.
    const capBegin = capZ + 6;
    const capEnd   = BL / 2 - 3;
    const capRanks = Math.max(2, Math.floor((capEnd - capBegin) / 8.5));
    const capSlots = 16;

    for (let r = 0; r < capRanks; r++){
      const zc = capBegin + (r + 0.5) * (capEnd - capBegin) / capRanks;
      const isInner = (r === 0);
      for (let i = 0; i < capSlots; i++){
        const tNorm = (i + 0.5) / capSlots;
        const x = -BW / 2 + 6 + tNorm * (BW - 12) + (Math.random() - 0.5) * 1.6;
        this._addFiller(x,  zc + (Math.random() - 0.5) * 1.8, { small: isInner });
        this._addFiller(x, -zc + (Math.random() - 0.5) * 1.8, { small: isInner });
      }
    }
  },

  _addFiller(x, z, opts = {}){
    const { small = false } = opts;
    const mats = SHARED.fillerMats;
    const mat = mats[Math.floor(Math.random() * mats.length)];

    // Inner rank stays as low plain boxes so music towers dominate up close.
    if (small){
      const h = 6 + Math.random() * 10;
      const w = 3.0 + Math.random() * 2.4;
      const d = 3.0 + Math.random() * 2.4;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, h / 2, z);
      mesh.rotation.y = (Math.random() - 0.5) * 0.18;
      this.scene.add(mesh);
      return;
    }

    // Height tier: most are mid-rise, ~30% tall, ~10% hero so the silhouette varies.
    let height;
    const rh = Math.random();
    if (rh < 0.58)      height =  9 + Math.random() * 14;   //  9-23u mid-rise
    else if (rh < 0.88) height = 22 + Math.random() * 22;   // 22-44u tall
    else                height = 42 + Math.random() * 36;   // 42-78u hero

    const baseW = 3.0 + Math.random() * 2.6;
    const baseD = 3.0 + Math.random() * 2.6;
    const yRot  = (Math.random() - 0.5) * 0.18;

    // Body archetype — adds NYC-style silhouette variety beyond plain boxes.
    let topY = height, topW = baseW, topD = baseD;
    const ra = Math.random();

    if (ra < 0.30){
      // Plain box
      const m = new THREE.Mesh(new THREE.BoxGeometry(baseW, height, baseD), mat);
      m.position.set(x, height / 2, z);
      m.rotation.y = yRot;
      this.scene.add(m);
    } else if (ra < 0.55){
      // Stepped setback — 2 tiers, narrower on top (Art-Deco feel).
      const t1H = height * (0.60 + Math.random() * 0.12);
      const t2H = height - t1H;
      const t1 = new THREE.Mesh(new THREE.BoxGeometry(baseW, t1H, baseD), mat);
      t1.position.set(x, t1H / 2, z);
      t1.rotation.y = yRot;
      this.scene.add(t1);
      const t2W = baseW * (0.60 + Math.random() * 0.20);
      const t2D = baseD * (0.60 + Math.random() * 0.20);
      const t2 = new THREE.Mesh(new THREE.BoxGeometry(t2W, t2H, t2D), mat);
      t2.position.set(x, t1H + t2H / 2, z);
      t2.rotation.y = yRot;
      this.scene.add(t2);
      topW = t2W; topD = t2D;
    } else if (ra < 0.74){
      // Wide podium + narrow tower (lots of these around Central Park).
      const podH = 2.4 + Math.random() * 3.6;
      const podW = baseW * (1.30 + Math.random() * 0.20);
      const podD = baseD * (1.30 + Math.random() * 0.20);
      const pod = new THREE.Mesh(new THREE.BoxGeometry(podW, podH, podD), mat);
      pod.position.set(x, podH / 2, z);
      pod.rotation.y = yRot;
      this.scene.add(pod);
      const towH = height - podH;
      const tow = new THREE.Mesh(new THREE.BoxGeometry(baseW, towH, baseD), mat);
      tow.position.set(x, podH + towH / 2, z);
      tow.rotation.y = yRot;
      this.scene.add(tow);
    } else if (ra < 0.87){
      // Cylindrical body (curved-tower variety; texture wraps the 5 window strips around).
      const r = (baseW + baseD) * 0.26;
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, height, 14), mat);
      cyl.position.set(x, height / 2, z);
      cyl.rotation.y = yRot;
      this.scene.add(cyl);
      topW = r * 2; topD = r * 2;
    } else {
      // Twin-tower complex on a shared podium.
      const podH = 1.8 + Math.random() * 2.4;
      const podW = baseW * 2.2;
      const pod = new THREE.Mesh(new THREE.BoxGeometry(podW, podH, baseD), mat);
      pod.position.set(x, podH / 2, z);
      pod.rotation.y = yRot;
      this.scene.add(pod);
      const tH = height - podH;
      const tW = baseW * 0.78;
      const off = baseW * 0.62;
      const cs = Math.cos(yRot), sn = Math.sin(yRot);
      for (const dx of [-off, off]){
        const lx = x + cs * dx;
        const lz = z - sn * dx;
        const t = new THREE.Mesh(new THREE.BoxGeometry(tW, tH, baseD), mat);
        t.position.set(lx, podH + tH / 2, lz);
        t.rotation.y = yRot;
        this.scene.add(t);
      }
      topW = tW; topD = baseD;
    }

    this._addFillerRoof(x, z, topY, topW, topD, yRot, mat);
  },

  _addFillerRoof(x, z, baseY, w, d, yRot, mat){
    const rr = Math.random();

    // 18% clean cut — keeps the eye from getting noisy.
    if (rr < 0.18) return;

    if (rr < 0.40){
      // Antenna + red blinker (the city-wide LED pulse).
      const poleH = 1.8 + Math.random() * 3.6;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.10, 0.10, poleH, 6), SHARED.metal
      );
      pole.position.set(x, baseY + poleH / 2, z);
      this.scene.add(pole);
      const blink = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 6, 5), SHARED.blink
      );
      blink.position.set(x, baseY + poleH + 0.24, z);
      this.scene.add(blink);
      this.blinkers.push(blink);
      return;
    }

    if (rr < 0.58){
      // Tall narrow spire (Chrysler-ish needle).
      const sH = 3.0 + Math.random() * 6.0;
      const sR = Math.min(w, d) * 0.24;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(sR, sH, 8), mat);
      spire.position.set(x, baseY + sH / 2, z);
      spire.rotation.y = yRot;
      this.scene.add(spire);
      return;
    }

    if (rr < 0.73){
      // Pyramidal cap (Empire-State-ish hipped top).
      const pH = 1.8 + Math.random() * 2.6;
      const pR = Math.min(w, d) * 0.62;
      const pyr = new THREE.Mesh(new THREE.ConeGeometry(pR, pH, 4), mat);
      pyr.position.set(x, baseY + pH / 2, z);
      pyr.rotation.y = yRot + Math.PI / 4;
      this.scene.add(pyr);
      return;
    }

    if (rr < 0.84){
      // Hemispherical dome (Helmsley/observatory-ish).
      const dR = Math.min(w, d) * 0.55;
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(dR, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        mat
      );
      dome.position.set(x, baseY, z);
      this.scene.add(dome);
      return;
    }

    if (rr < 0.93){
      // Rooftop water tower (the NYC silhouette signature).
      const tankR = Math.min(w, d) * 0.30;
      const tankH = 1.4 + Math.random() * 1.2;
      const legsH = 0.7;
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(tankR, tankR, tankH, 10),
        SHARED.metalDark
      );
      tank.position.set(x, baseY + legsH + tankH / 2, z);
      this.scene.add(tank);
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(tankR + 0.04, 0.5, 10),
        SHARED.metalDark
      );
      cap.position.set(x, baseY + legsH + tankH + 0.25, z);
      this.scene.add(cap);
      return;
    }

    // Twin spires (cathedral / Trump-Tower-ish double finial).
    const sH = 2.4 + Math.random() * 3.6;
    const sR = Math.min(w, d) * 0.18;
    const off = Math.min(w, d) * 0.30;
    const cs = Math.cos(yRot), sn = Math.sin(yRot);
    for (const dx of [-off, off]){
      const lx = x + cs * dx;
      const lz = z - sn * dx;
      const s = new THREE.Mesh(new THREE.ConeGeometry(sR, sH, 6), mat);
      s.position.set(lx, baseY + sH / 2, lz);
      s.rotation.y = yRot;
      this.scene.add(s);
    }
  },

  /* ---------- Satellite islands (smaller neighborhoods across the water) ---------- */
  _buildSatelliteIslands(){
    // t20: 3×3 city-block layout. Music block is the center cell; 8 satellite
    // neighborhoods tile the surrounding cells so the surrounding grid reads
    // as a continuous urban grid instead of scattered random islands.
    const BW = this.BLOCK_W;
    const BL = this.BLOCK_L;
    const gap = 14;              // water/road between cells
    const sideW = 160;           // E/W neighborhood width
    const endL  = 160;           // N/S neighborhood length
    const ex = BW / 2 + gap + sideW / 2;   // ±x center of E/W cells
    const nz = BL / 2 + gap + endL  / 2;   // ±z center of N/S cells

    const islands = [
      // E / W long-side neighborhoods (match center L)
      { cx:  ex, cz: 0, w: sideW, l: BL,    count: 90 },
      { cx: -ex, cz: 0, w: sideW, l: BL,    count: 90 },
      // N / S cap neighborhoods (match center W)
      { cx: 0, cz:  nz, w: BW,    l: endL,  count: 44 },
      { cx: 0, cz: -nz, w: BW,    l: endL,  count: 44 },
      // 4 corner neighborhoods
      { cx:  ex, cz:  nz, w: sideW, l: endL, count: 34 },
      { cx: -ex, cz:  nz, w: sideW, l: endL, count: 34 },
      { cx:  ex, cz: -nz, w: sideW, l: endL, count: 34 },
      { cx: -ex, cz: -nz, w: sideW, l: endL, count: 34 },
    ];
    for (const i of islands) this._buildSatellite(i);
  },

  _buildSatellite(island){
    const { cx, cz, w, l, count } = island;

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(w, 3.0, l),
      new THREE.MeshBasicMaterial({ color: 0x10121a })
    );
    slab.position.set(cx, -1.5, cz);
    this.scene.add(slab);

    const rim = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 4, l + 4),
      new THREE.MeshBasicMaterial({ color: 0x1d1e26 })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(cx, -0.02, cz);
    this.scene.add(rim);

    const grid = new THREE.GridHelper(Math.max(w, l), 6, 0x232434, 0x171823);
    grid.position.set(cx, 0.01, cz);
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    grid.material.depthWrite = false;
    this.scene.add(grid);

    // Pack buildings on a jittered grid.
    const cols = Math.max(3, Math.round(Math.sqrt(count * w / l)));
    const rows = Math.ceil(count / cols);
    const colP = w / cols;
    const rowP = l / rows;
    let placed = 0;
    for (let r = 0; r < rows && placed < count; r++){
      for (let c = 0; c < cols && placed < count; c++){
        const x = cx - w/2 + (c + 0.5) * colP + (Math.random() - 0.5) * 1.6;
        const z = cz - l/2 + (r + 0.5) * rowP + (Math.random() - 0.5) * 1.6;
        this._addFiller(x, z);
        placed++;
      }
    }

    // A couple of streetlights at corners for life.
    const poleGeo = new THREE.CylinderGeometry(0.10, 0.15, 4.0, 6);
    const lampGeo = new THREE.SphereGeometry(0.25, 8, 6);
    const haloGeo = new THREE.PlaneGeometry(4, 4);
    const addLight = (lx, lz) => {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(poleGeo, SHARED.metalDark);
      pole.position.y = 2.0;
      g.add(pole);
      const lamp = new THREE.Mesh(lampGeo, SHARED.lamp);
      lamp.position.y = 4.0;
      g.add(lamp);
      const halo = new THREE.Mesh(haloGeo, SHARED.lampHalo);
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.05;
      g.add(halo);
      g.position.set(lx, 0, lz);
      this.scene.add(g);
    };
    addLight(cx - w/2 + 2, cz - l/2 + 2);
    addLight(cx + w/2 - 2, cz - l/2 + 2);
    addLight(cx - w/2 + 2, cz + l/2 - 2);
    addLight(cx + w/2 - 2, cz + l/2 - 2);
  },

  /* ---------- Cars (perimeter traffic) ---------- */
  _buildCars(){
    const W = this.BLOCK_W;
    const L = this.BLOCK_L;

    const innerOff = 1.4;
    const outerOff = 5.2;

    const innerPath = [
      new THREE.Vector3( W/2 - innerOff, 0, -L/2 + innerOff),
      new THREE.Vector3( W/2 - innerOff, 0,  L/2 - innerOff),
      new THREE.Vector3(-W/2 + innerOff, 0,  L/2 - innerOff),
      new THREE.Vector3(-W/2 + innerOff, 0, -L/2 + innerOff),
    ];
    const outerPath = [
      new THREE.Vector3(-W/2 - outerOff, 0, -L/2 - outerOff),
      new THREE.Vector3( W/2 + outerOff, 0, -L/2 - outerOff),
      new THREE.Vector3( W/2 + outerOff, 0,  L/2 + outerOff),
      new THREE.Vector3(-W/2 - outerOff, 0,  L/2 + outerOff),
    ];

    const lengths = (path) => {
      const segLens = [];
      let total = 0;
      for (let i = 0; i < path.length; i++){
        const len = path[(i + 1) % path.length].distanceTo(path[i]);
        segLens.push(len);
        total += len;
      }
      return { segLens, total };
    };

    const carGeo   = new THREE.BoxGeometry(1.6, 0.6, 2.8);
    const cabinGeo = new THREE.BoxGeometry(1.4, 0.4, 1.4);
    const lampGeo  = new THREE.BoxGeometry(0.28, 0.14, 0.06);

    const makeCar = () => {
      const car = new THREE.Group();
      const body = new THREE.Mesh(
        carGeo, SHARED.carBodies[Math.floor(Math.random() * SHARED.carBodies.length)]
      );
      body.position.y = 0.35;
      car.add(body);

      const cabin = new THREE.Mesh(cabinGeo, SHARED.carCabin);
      cabin.position.set(0, 0.85, -0.2);
      car.add(cabin);

      const h1 = new THREE.Mesh(lampGeo, SHARED.lamp);
      h1.position.set(-0.5, 0.4, 1.42);
      car.add(h1);
      const h2 = h1.clone();
      h2.position.x = 0.5;
      car.add(h2);

      const t1 = new THREE.Mesh(lampGeo, SHARED.carRed);
      t1.position.set(-0.5, 0.4, -1.42);
      car.add(t1);
      const t2 = t1.clone();
      t2.position.x = 0.5;
      car.add(t2);
      return car;
    };

    const placeCars = (path, count, reverse) => {
      const meta = lengths(path);
      for (let i = 0; i < count; i++){
        const car = makeCar();
        this.scene.add(car);
        this.cars.push({
          group: car,
          path,
          segLens: meta.segLens,
          total:   meta.total,
          t: i / count,
          speed: 0.022 + Math.random() * 0.018,
          reverse,
        });
      }
    };

    placeCars(innerPath, 9, false);
    placeCars(outerPath, 11, true);
  },

  /* ---------- Helicopters ---------- */
  _buildHelicopters(){
    for (let n = 0; n < 2; n++){
      const g = new THREE.Group();
      const bodyMat = n === 0 ? SHARED.helRed : SHARED.helBlue;

      const body = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.2, 1.6), bodyMat);
      g.add(body);

      const tail = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.4, 0.4), bodyMat);
      tail.position.x = -2.6;
      g.add(tail);

      const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.5), bodyMat);
      tailFin.position.set(-3.8, 0.4, 0);
      g.add(tailFin);

      const tailRotor = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.05), SHARED.metalDark
      );
      tailRotor.position.set(-3.8, 0.4, 0.3);
      tailRotor.rotation.x = Math.PI / 2;
      g.add(tailRotor);

      const rotor = new THREE.Mesh(
        new THREE.PlaneGeometry(7.0, 0.10), SHARED.metalDark
      );
      rotor.position.y = 0.95;
      g.add(rotor);

      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.20, 6, 5), SHARED.blink
      );
      light.position.set(0, -0.8, 0);
      g.add(light);

      const skid = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.08, 0.08), SHARED.metalDark
      );
      skid.position.set(0, -0.7, 0.6);
      g.add(skid);
      const skid2 = skid.clone();
      skid2.position.z = -0.6;
      g.add(skid2);

      const cx = 0;
      const cz = 0;
      const radius = 360 + n * 90;
      const altitude = 130 + n * 35;
      const speed = 0.05 + Math.random() * 0.02;
      const phase = Math.random() * Math.PI * 2;

      g.position.set(cx + radius, altitude, cz);
      this.scene.add(g);
      this.helicopters.push({
        group: g, rotor, cx, cz, radius, altitude, speed, phase,
      });
    }
  },

  /* ---------- HUD ---------- */
  _buildHud(){
    const root = document.createElement('div');
    root.className = 'tc-hud';
    root.style.cssText = `
      position:absolute; inset:0; pointer-events:none;
      font:13px/1.4 "Space Grotesk", Inter, system-ui, sans-serif;
      color:#dcdde6; z-index:10;
    `;

    const build = this.ctx.buildNumber || '';
    const count = (this.ctx.tracks || []).length;

    const corner = document.createElement('div');
    corner.style.cssText = `
      position:absolute; top:16px; left:18px;
      display:flex; flex-direction:column; gap:6px;
      font-size:11px; letter-spacing:0.14em; text-transform:uppercase;
      color:#7c7d8a;
    `;
    corner.innerHTML = `
      <div style="color:#f0f0f5;font-weight:700;letter-spacing:0.18em;">CANTMUTE / TRACKS</div>
      <div>${count} TRACKS &middot; ${build}</div>
    `;
    root.appendChild(corner);

    const filters = document.createElement('div');
    filters.style.cssText = `
      position:absolute; top:16px; right:18px;
      display:flex; gap:8px; pointer-events:auto;
    `;
    const chips = [
      { v:'all',      label:'ALL' },
      { v:'new',      label:'NEW' },
      { v:'featured', label:'FEATURED' },
    ];
    chips.forEach(c => {
      const b = document.createElement('button');
      b.textContent = c.label;
      b.dataset.filter = c.v;
      b.style.cssText = `
        appearance:none; background:transparent;
        border:1px solid rgba(255,255,255,0.18);
        color:#cfd0d8;
        padding:6px 12px; font:600 10px/1 "Space Grotesk", system-ui;
        letter-spacing:0.18em; text-transform:uppercase;
        cursor:pointer; border-radius:2px;
        transition:all 180ms ease;
      `;
      b.addEventListener('mouseenter', () => { b.style.background = 'rgba(255,255,255,0.06)'; });
      b.addEventListener('mouseleave', () => {
        if (this.filter !== c.v) b.style.background = 'transparent';
      });
      b.addEventListener('click', () => {
        this.filter = c.v;
        if (c.v === 'new') history.pushState({}, '', '/tracks/new');
        else               history.pushState({}, '', '/tracks');
        this._applyFilter();
        this._syncFilterChips();
      });
      filters.appendChild(b);
    });
    root.appendChild(filters);
    this._filterChips = filters;

    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'search tracks…';
    search.style.cssText = `
      position:absolute; top:16px; left:50%; transform:translateX(-50%);
      width:260px; max-width:36vw;
      background:rgba(8,12,22,0.55);
      border:1px solid rgba(255,255,255,0.14);
      color:#e8e8f0; padding:8px 12px;
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

    const viewBtn = document.createElement('button');
    viewBtn.textContent = 'GROUND VIEW';
    viewBtn.style.cssText = `
      position:absolute; bottom:90px; right:18px;
      appearance:none; background:rgba(8,12,22,0.55);
      border:1px solid rgba(255,255,255,0.20);
      color:#e8e8f0;
      padding:8px 14px; font:600 10px/1 "Space Grotesk", system-ui;
      letter-spacing:0.18em; text-transform:uppercase;
      cursor:pointer; border-radius:2px;
      pointer-events:auto; backdrop-filter:blur(6px);
      transition:all 180ms ease;
    `;
    viewBtn.addEventListener('mouseenter', () => { viewBtn.style.background = 'rgba(255,255,255,0.10)'; });
    viewBtn.addEventListener('mouseleave', () => { viewBtn.style.background = 'rgba(8,12,22,0.55)'; });
    viewBtn.addEventListener('click', () => {
      const next = this.viewMode === 'ground' ? 'aerial' : 'ground';
      this._setView(next);
      viewBtn.textContent = next === 'ground' ? 'AERIAL VIEW' : 'GROUND VIEW';
    });
    root.appendChild(viewBtn);
    this._viewBtn = viewBtn;

    // Contextual "back to overview" pill — only visible when focused on a tower.
    const backBtn = document.createElement('button');
    backBtn.textContent = '← OVERVIEW';
    backBtn.style.cssText = `
      position:absolute; top:60px; left:50%; transform:translateX(-50%);
      appearance:none; background:rgba(8,12,22,0.78);
      border:1px solid rgba(255,255,255,0.32);
      color:#fff;
      padding:8px 14px; font:600 11px/1 "Space Grotesk", system-ui;
      letter-spacing:0.18em; text-transform:uppercase;
      cursor:pointer; border-radius:2px;
      pointer-events:auto; backdrop-filter:blur(6px);
      display:none; transition:all 180ms ease;
    `;
    backBtn.addEventListener('mouseenter', () => { backBtn.style.background = 'rgba(255,255,255,0.14)'; });
    backBtn.addEventListener('mouseleave', () => { backBtn.style.background = 'rgba(8,12,22,0.78)'; });
    backBtn.addEventListener('click', () => this._exitFocus());
    root.appendChild(backBtn);
    this._backBtn = backBtn;

    const help = document.createElement('div');
    help.style.cssText = `
      position:absolute; bottom:120px; left:18px;
      font-size:10px; letter-spacing:0.16em; text-transform:uppercase;
      color:#5a5b66; line-height:1.7;
    `;
    help.innerHTML = `
      <div>DRAG &middot; orbit</div>
      <div>SCROLL / PINCH &middot; zoom</div>
      <div>TAP TOWER &middot; play</div>
      <div>PREV / NEXT &middot; jump to song</div>
      <div>ESC / TAP GROUND &middot; overview</div>
    `;
    root.appendChild(help);

    setTimeout(() => this._syncFilterChips(), 0);
    return root;
  },

  _exitFocus(){
    this.focusedIdx = -1;
    this._setView('aerial');
    this._updateFocusUI();
  },

  _updateFocusUI(){
    if (this._backBtn){
      this._backBtn.style.display = (this.focusedIdx !== -1) ? 'block' : 'none';
    }
  },

  _syncFilterChips(){
    if (!this._filterChips) return;
    this._filterChips.querySelectorAll('button').forEach(b => {
      const on = b.dataset.filter === this.filter;
      b.style.background = on ? 'rgba(255,255,255,0.10)' : 'transparent';
      b.style.borderColor = on ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.18)';
      b.style.color = on ? '#fff' : '#cfd0d8';
    });
  },

  _buildTransport(){
    const root = document.createElement('div');
    root.className = 'tc-transport';
    root.style.cssText = `
      position:absolute; left:50%; bottom:28px; transform:translateX(-50%);
      display:flex; gap:14px; align-items:center;
      background:rgba(6,9,18,0.74);
      border:1px solid rgba(255,255,255,0.14);
      padding:10px 16px;
      font:12px "Space Grotesk", system-ui; color:#e8e8f0;
      letter-spacing:0.06em;
      pointer-events:auto; z-index:11;
      backdrop-filter:blur(6px);
    `;

    const btn = (label, action) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = `
        appearance:none; background:transparent; color:#e8e8f0;
        border:1px solid rgba(255,255,255,0.20);
        padding:6px 9px; font:600 11px "Space Grotesk", system-ui;
        cursor:pointer; min-width:30px; border-radius:2px;
      `;
      b.addEventListener('click', action);
      b.addEventListener('mouseenter', () => { b.style.background = 'rgba(255,255,255,0.08)'; });
      b.addEventListener('mouseleave', () => { b.style.background = 'transparent'; });
      return b;
    };

    const prev = btn('‹', () => this.ctx.onPrev?.());
    const play = btn('▶', () => this.ctx.onTogglePlay?.());
    const next = btn('›', () => this.ctx.onNext?.());

    const title = document.createElement('div');
    title.style.cssText = `
      min-width:180px; max-width:36vw; overflow:hidden;
      white-space:nowrap; text-overflow:ellipsis;
      font-weight:600; letter-spacing:0.04em;
      color:#dadbe6;
    `;
    title.textContent = '—';

    const time = document.createElement('div');
    time.style.cssText = `
      font:11px "Space Grotesk", system-ui;
      letter-spacing:0.08em; color:#8b8c98;
      min-width:88px; text-align:right;
    `;
    time.textContent = '0:00 / 0:00';

    const bar = document.createElement('div');
    bar.style.cssText = `
      position:relative; width:200px; height:4px;
      background:rgba(255,255,255,0.10); cursor:pointer; border-radius:1px;
    `;
    const fill = document.createElement('div');
    fill.style.cssText = `
      position:absolute; left:0; top:0; bottom:0; width:0%;
      background:#fff;
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
    this._tpPlay  = play;

    return root;
  },

  _updateTransport(){
    if (!this._tpTitle) return;
    const cur = this.ctx.getCurrent ? this.ctx.getCurrent() : -1;
    const audio = this.ctx.audio;
    if (cur < 0 || !this.ctx.tracks?.[cur]) {
      this._tpTitle.textContent = '— no track —';
      this._tpTime.textContent  = '0:00 / 0:00';
      this._tpFill.style.width  = '0%';
      this._tpPlay.textContent  = '▶';
      return;
    }
    const t = this.ctx.tracks[cur];
    this._tpTitle.textContent = t.title;
    if (audio) {
      const c = audio.currentTime || 0;
      const d = audio.duration || 0;
      this._tpTime.textContent = `${fmtTime(c)} / ${fmtTime(d)}`;
      this._tpFill.style.width = d ? `${(c / d) * 100}%` : '0%';
      this._tpPlay.textContent = audio.paused ? '▶' : '❚❚';
    }
  },

  /* ---------- Filter ---------- */
  _applyFilter(){
    const q = this.query;
    for (const tw of this.towers) {
      const t = tw.track;
      let visible = true;
      if (this.filter === 'featured') visible = !!t.isFeatured;
      else if (this.filter === 'new') visible = !!t.isNew;
      if (visible && q) {
        visible = t.title.toLowerCase().includes(q)
               || (Array.isArray(t.tags) && t.tags.some(tag => String(tag).toLowerCase().includes(q)));
      }
      tw.group.visible = visible;
    }
    this._syncFilterChips?.();
  },

  /* ---------- Audio ---------- */
  _hookAudio(){
    const a = this.ctx.audio;
    if (!a) return;
    if (a.__floorAnalyser) {
      this.audioCtx = a.__floorAnalyser.ctx;
      this.analyser = a.__floorAnalyser.analyser;
      this.freqArr  = a.__floorAnalyser.freqArr;
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      const src = ac.createMediaElementSource(a);
      const an  = ac.createAnalyser();
      an.fftSize = 256;
      an.smoothingTimeConstant = 0.85;
      src.connect(an);
      an.connect(ac.destination);
      this.audioCtx = ac;
      this.analyser = an;
      this.freqArr  = new Uint8Array(an.frequencyBinCount);
      a.__floorAnalyser = { ctx: ac, source: src, analyser: an, freqArr: this.freqArr };
    } catch (e) { console.warn('[tc] analyser failed', e); }
  },

  _readBass(){
    if (!this.analyser) return 0;
    this.analyser.getByteFrequencyData(this.freqArr);
    let s = 0;
    for (let i = 2; i < 10; i++) s += this.freqArr[i];
    return Math.min(1, s / (8 * 255)) * 0.5;
  },

  /* ---------- Camera ---------- */
  _applyCamera(){
    const c = this.cam;
    const cosE = Math.cos(c.elevation);
    const sinE = Math.sin(c.elevation);
    const sinA = Math.sin(c.azimuth);
    const cosA = Math.cos(c.azimuth);
    this.camera.position.set(
      c.target.x + c.radius * sinA * cosE,
      c.target.y + c.radius * sinE,
      c.target.z + c.radius * cosA * cosE,
    );
    this.camera.lookAt(c.target);
  },

  _stepCamera(dt){
    if (this.flyTo) {
      const f = this.flyTo;
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = 1 - Math.pow(1 - f.t, 3);
      this.cam.target.lerpVectors(f.target0, f.target1, e);
      this.cam.radius    = f.radius0 + (f.radius1 - f.radius0) * e;
      this.cam.azimuth   = f.az0     + (f.az1     - f.az0)     * e;
      this.cam.elevation = f.el0     + (f.el1     - f.el0)     * e;
      if (f.t >= 1) this.flyTo = null;
    }
    this._applyCamera();
  },

  _flyToParams(target, radius, azimuth, elevation, dur = 1.1){
    this.flyTo = {
      t: 0, dur,
      target0: this.cam.target.clone(), target1: target.clone(),
      radius0: this.cam.radius,           radius1: radius,
      az0:     this.cam.azimuth,          az1:     azimuth,
      el0:     this.cam.elevation,        el1:     elevation,
    };
  },

  _setView(mode){
    this.viewMode = mode;
    if (mode === 'ground'){
      const target = new THREE.Vector3(0, 2, this.PARK_L * 0.10);
      this._flyToParams(target, 26, this.cam.azimuth, 0.10, 1.3);
    } else {
      const target = new THREE.Vector3(0, 4, 0);
      this._flyToParams(target, 360, this.cam.azimuth, 0.52, 1.3);
    }
  },

  _flyToTower(tw){
    const dx = tw.basePos.x;
    const dz = tw.basePos.z;
    let desiredAz = Math.atan2(dx, dz);
    if (Math.abs(dx) < 4) desiredAz = this.cam.azimuth;

    const minRadius = Math.max(60, tw.height * 1.1);
    const newTarget = new THREE.Vector3(
      tw.basePos.x * 0.85,
      Math.max(tw.height * 0.42, 10),
      tw.basePos.z * 0.85,
    );
    this._flyToParams(
      newTarget,
      minRadius,
      desiredAz,
      Math.max(0.30, Math.min(0.70, this.cam.elevation)),
      1.0,
    );
    if (this.viewMode === 'ground' && this._viewBtn){
      this.viewMode = 'aerial';
      this._viewBtn.textContent = 'GROUND VIEW';
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
  },

  _onMove(e){
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) / r.width;
    this.mouse.y = (e.clientY - r.top)  / r.height;
    this.mouse.ndc.set(this.mouse.x * 2 - 1, -(this.mouse.y * 2 - 1));
    if (this.drag.active) {
      const dx = e.clientX - this.drag.lx;
      const dy = e.clientY - this.drag.ly;
      this.drag.lx = e.clientX;
      this.drag.ly = e.clientY;
      this.drag.totalPx += Math.abs(dx) + Math.abs(dy);
      const sens = 0.0055;
      this.cam.azimuth   -= dx * sens;
      this.cam.elevation += dy * sens;
      const minEl = 0.05, maxEl = 1.34;
      if (this.cam.elevation < minEl) this.cam.elevation = minEl;
      if (this.cam.elevation > maxEl) this.cam.elevation = maxEl;
      if (this.flyTo) this.flyTo = null;
    }
  },

  _onPointerDown(e){
    if (e.pointerType === 'touch' && e.isPrimary === false) return;
    this.drag.active  = true;
    this.drag.lx      = e.clientX;
    this.drag.ly      = e.clientY;
    this.drag.totalPx = 0;
    this.renderer.domElement.style.cursor = 'grabbing';
  },

  _onPointerUp(){
    this.drag.active = false;
    if (this.renderer) this.renderer.domElement.style.cursor = 'grab';
  },

  _onWheel(e){
    e.preventDefault();
    this.cam.radius *= (1 + e.deltaY * 0.0012);
    if (this.cam.radius < 16) this.cam.radius = 16;
    if (this.cam.radius > 1100) this.cam.radius = 1100;
    if (this.flyTo) this.flyTo = null;
  },

  _onTouchStart(e){
    if (e.touches.length === 2){
      this.drag.active = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.pinch.active = true;
      this.pinch.d0 = Math.hypot(dx, dy);
      this.pinch.r0 = this.cam.radius;
      e.preventDefault();
    }
  },

  _onTouchMove(e){
    if (this.pinch.active && e.touches.length === 2){
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d  = Math.hypot(dx, dy);
      if (this.pinch.d0 > 1){
        this.cam.radius = this.pinch.r0 * (this.pinch.d0 / d);
        if (this.cam.radius < 16) this.cam.radius = 16;
        if (this.cam.radius > 1100) this.cam.radius = 1100;
        if (this.flyTo) this.flyTo = null;
      }
      e.preventDefault();
    } else if (e.cancelable){
      e.preventDefault();
    }
  },

  _onTouchEnd(e){
    if (e.touches.length < 2) this.pinch.active = false;
  },

  _onKeyDown(e){
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); this.ctx.onTogglePlay?.(); }
    if (k === 'escape') {
      if (this.focusedIdx !== -1) this._exitFocus();
    }
    if (k === 'arrowleft')  this.cam.azimuth   += 0.08;
    if (k === 'arrowright') this.cam.azimuth   -= 0.08;
    if (k === 'arrowup')    this.cam.elevation = Math.min(1.34, this.cam.elevation + 0.05);
    if (k === 'arrowdown')  this.cam.elevation = Math.max(0.05, this.cam.elevation - 0.05);
    if (k === 'g'){
      const next = this.viewMode === 'ground' ? 'aerial' : 'ground';
      this._setView(next);
      if (this._viewBtn) this._viewBtn.textContent = next === 'ground' ? 'AERIAL VIEW' : 'GROUND VIEW';
    }
  },

  _onClick(){
    if (this.drag.totalPx > 6) return;
    if (!this.hovered){
      // Empty-ground click while focused = exit. Lets the user "tap out"
      // of a tower without hunting for the back button.
      if (this.focusedIdx !== -1) this._exitFocus();
      return;
    }
    const tw = this.hovered;
    this.focusedIdx = tw.idx;
    this._flyToTower(tw);
    this.ctx.onPlay?.(tw.idx);
    this._updateFocusUI();
  },

  /* ---------- Hover (raycast) ---------- */
  _updateHover(){
    if (!this.ray) return;
    this.ray.setFromCamera(this.mouse.ndc, this.camera);
    const meshes = [];
    for (const tw of this.towers) {
      if (tw.group.visible) meshes.push(tw.mesh);
    }
    const hits = this.ray.intersectObjects(meshes, false);
    this.hovered = hits.length ? hits[0].object.userData.tower : null;
    if (this.renderer && !this.drag.active) {
      this.renderer.domElement.style.cursor = this.hovered ? 'pointer' : 'grab';
    }
  },

  /* ---------- Composer ---------- */
  _setupComposer(){
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.6, 0.18);
    bloom.threshold = 0.18;
    bloom.strength  = 0.55;
    bloom.radius    = 0.6;
    this.bloom = bloom;
    this.composer.addPass(bloom);
  },

  /* ---------- Animate ---------- */
  animate(){
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, this.clock.getDelta());
    const t  = this.clock.elapsedTime;

    const targetBass = this._readBass();
    this.bass += (targetBass - this.bass) * 0.18;

    this.hueShift = (t * 0.012) % 1;

    this._stepCamera(dt);
    this._updateHover();

    if (this.water) this.water.material.uniforms.uTime.value = t;
    if (this._pondMat) this._pondMat.uniforms.uTime.value = t;

    const pulse = Math.sin(t * 2.6) * 0.5 + 0.5;
    SHARED.blink.color.setRGB(0.65 + pulse * 0.35, 0.05 + pulse * 0.08, 0.05);

    // Fountains
    for (const f of this.fountains){
      const s = f.spout;
      const bob = Math.sin(t * 2.8 + f.x * 0.1) * 0.14;
      s.position.y = 2.7 + bob;
      const pos = f.jetGeo.attributes.position;
      const a = pos.array;
      const N = a.length / 3;
      for (let i = 0; i < N; i++){
        const speed = 1.6 + (i % 5) * 0.2;
        let y = a[i*3+1] + speed * dt;
        if (y > 4.6){
          const ang = Math.random() * Math.PI * 2;
          const rr  = Math.random() * 0.55;
          a[i*3]   = Math.cos(ang) * rr;
          a[i*3+2] = Math.sin(ang) * rr;
          y = 2.5;
        }
        a[i*3+1] = y;
      }
      pos.needsUpdate = true;
    }

    // People
    for (const p of this.people){
      if (p.kind === 'walk'){
        p.t += p.speed * dt * p.dir;
        if (p.t >= 1){ p.t = 1; p.dir = -1; }
        else if (p.t <= 0){ p.t = 0; p.dir = 1; }
        const pos = p.seg.start.clone().lerp(p.seg.end, p.t);
        p.group.position.set(pos.x, 0, pos.z);
        const dirVec = p.seg.end.clone().sub(p.seg.start).multiplyScalar(p.dir);
        if (dirVec.lengthSq() > 1e-6){
          p.group.rotation.y = Math.atan2(dirVec.x, dirVec.z);
        }
        const bob = Math.sin(t * 8 + p.t0) * 0.04;
        p.group.position.y = bob;
      } else if (p.kind === 'sit'){
        p.group.rotation.y += Math.sin(t * 0.7 + p.t0) * 0.0003;
      } else if (p.kind === 'static'){
        p.group.rotation.y += Math.sin(t * 0.5 + p.t0) * 0.0004;
      }
    }

    // Boats — bob + slow forward drift along facing dir, wrap on bounds.
    for (const b of this._boats){
      const baseY = b.userData.boatBobY;
      const phase = b.userData.boatPhase;
      const spd   = b.userData.boatSpeed;
      b.position.y = baseY + Math.sin(t * 0.9 + phase) * 0.12;
      b.rotation.z = Math.sin(t * 0.8 + phase) * 0.04;
      b.rotation.x = Math.cos(t * 1.1 + phase) * 0.03;

      const ry = b.rotation.y;
      b.position.x += Math.sin(ry) * spd * dt;
      b.position.z += Math.cos(ry) * spd * dt;

      // Wrap around when out of bounds.
      const bound = 700;
      if (b.position.x >  bound) b.position.x = -bound;
      if (b.position.x < -bound) b.position.x =  bound;
      if (b.position.z >  bound) b.position.z = -bound;
      if (b.position.z < -bound) b.position.z =  bound;
    }

    // Birds
    for (const b of this.birds){
      const a = t * b.speed + b.phase;
      b.mesh.position.set(
        b.cx + Math.cos(a) * b.radius,
        b.altitude + Math.sin(a * 0.4) * 6,
        b.cz + Math.sin(a) * b.radius,
      );
      const tx = -Math.sin(a) * b.radius;
      const tz =  Math.cos(a) * b.radius;
      b.mesh.rotation.y = Math.atan2(tx, tz);
      const flap = 0.65 + 0.35 * Math.abs(Math.sin(t * b.flapSpeed + b.phase));
      b.mesh.scale.set(1.0, 1.0, flap);
    }

    // Helicopters
    for (const h of this.helicopters){
      const a = t * h.speed + h.phase;
      h.group.position.set(
        h.cx + Math.cos(a) * h.radius,
        h.altitude,
        h.cz + Math.sin(a) * h.radius,
      );
      const tx = -Math.sin(a) * h.radius;
      const tz =  Math.cos(a) * h.radius;
      h.group.rotation.y = Math.atan2(tx, tz);
      h.rotor.rotation.y = t * 30;
    }

    // Cars — advance along path by length.
    for (const c of this.cars){
      c.t += c.speed * dt * (c.reverse ? -1 : 1);
      if (c.t > 1) c.t -= 1;
      if (c.t < 0) c.t += 1;

      const targetLen = c.t * c.total;
      let cumLen = 0;
      const path = c.path;
      for (let i = 0; i < path.length; i++){
        if (cumLen + c.segLens[i] >= targetLen){
          const localT = (targetLen - cumLen) / c.segLens[i];
          const A = path[i];
          const B = path[(i + 1) % path.length];
          const px = A.x + (B.x - A.x) * localT;
          const pz = A.z + (B.z - A.z) * localT;
          c.group.position.set(px, 0.1, pz);
          const dx = B.x - A.x;
          const dz = B.z - A.z;
          c.group.rotation.y = Math.atan2(dx, dz);
          break;
        }
        cumLen += c.segLens[i];
      }
    }

    // Towers
    const cur = this.ctx.getCurrent ? this.ctx.getCurrent() : -1;
    for (const tw of this.towers) {
      const u = tw.mat.uniforms;
      u.uTime.value     = t + tw.timeOffset;
      u.uBass.value     = this.bass;
      u.uHueShift.value = this.hueShift;

      const hoverT = (this.hovered === tw) ? 1 : 0;
      const focusT = (this.focusedIdx === tw.idx) ? 1 : 0;
      const playT  = (cur === tw.idx) ? 1 : 0;

      u.uHover.value   += (hoverT - u.uHover.value)   * 0.16;
      u.uFocus.value   += (focusT - u.uFocus.value)   * 0.06;
      u.uPlaying.value += (playT  - u.uPlaying.value) * 0.08;

      tw.haloMat.opacity = 0.05 * u.uPlaying.value
                         + 0.12 * u.uPlaying.value * this.bass
                         + 0.06 * u.uHover.value;

      const sway = playT * Math.sin(t * 2.2 + tw.timeOffset) * 0.18 * (0.3 + this.bass * 2);
      tw.mesh.position.y = tw.basePosY + sway;
    }

    this._updateTransport();
    this.composer.render();
  },

  /* ---------- Public API ---------- */
  setFilter(filter){
    this.filter = filter || 'all';
    this._applyFilter();
  },

  setQuery(q){
    this.query = (q || '').toLowerCase();
    if (this._searchEl && this._searchEl.value !== this.query) this._searchEl.value = this.query;
    this._applyFilter();
  },

  onTrackChange(){
    this._updateTransport();
    // If the user is already inside the city looking at a tower, keep them
    // "in the city" by flying the camera to the new track's tower. Prev/Next
    // (transport buttons or audio auto-advance) now browses song-by-song
    // instead of stranding them at the previous tower.
    if (this.focusedIdx !== -1){
      const cur = this.ctx.getCurrent?.();
      if (typeof cur === 'number' && cur >= 0 && cur !== this.focusedIdx){
        const tw = this.towers.find(t => t.idx === cur);
        if (tw && tw.group.visible){
          this.focusedIdx = cur;
          this._flyToTower(tw);
        }
      }
    }
  },

  destroy(){
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('keydown', this._onKeyDown);
    if (this.composer) {
      try { this.composer.passes.forEach(p => p.dispose?.()); } catch(e) {}
    }
    if (this.renderer) {
      try { this.renderer.dispose(); } catch(e) {}
      try { this.renderer.domElement.remove(); } catch(e) {}
    }
    if (this.scene) {
      this.scene.traverse(o => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => {
            if (m.uniforms?.uTex?.value) m.uniforms.uTex.value.dispose?.();
            if (m.map) m.map.dispose?.();
            // SHARED.* are reused — don't dispose them.
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
    this.towers = [];
    this.fountains = [];
    this.trees = [];
    this.people = [];
    this.birds = [];
    this.cars = [];
    this.helicopters = [];
    this.blinkers = [];
    this.benchPositions = [];
    this.water = null;
    this._boats = [];
    this.hovered = null;
    this.focusedIdx = -1;
    this.hudEl = null;
    this.transportEl = null;
    this.container = null;
  },
};

window.TracksDaw = TracksCity;
