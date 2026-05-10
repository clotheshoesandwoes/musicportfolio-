/* =========================================================
   THE OBJECT — b161
   One liquid-metal sculpture in the void. 117 Voronoi cells
   on its surface, each one a song. Hover a cell → that region
   glitches & glows in its tint. Click → song plays and the
   whole sculpture morphs to its frequency spectrum until done.
   No flying, no scrolling. Camera is fixed. The Object rotates.
   Standalone — only mounted by object.html.
   ========================================================= */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/* ---------- Color helpers (ported from text-galaxy-pro) ---------- */
function hsl(h, s, l){
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(Math.min(k - 3, 9 - k), 1));
  };
  return [f(0), f(8), f(4)];
}
function strHash01(s){
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}
function tintForTrack(track, tier){
  const seed = strHash01((track.title || '') + (track.file || ''));
  let baseHue, hueRange, sat, lum;
  if (tier === 'featured') {
    baseHue = 0.07; hueRange = 0.12; sat = 0.84; lum = 0.72;
  } else if (tier === 'newer') {
    baseHue = 0.46; hueRange = 0.14; sat = 0.78; lum = 0.68;
  } else {
    baseHue = 0.74; hueRange = 0.18; sat = 0.62; lum = 0.62;
  }
  const h = (baseHue + seed * hueRange) % 1;
  return hsl(h, sat, lum);
}
function tierForTrack(t){
  if (t.isFeatured) return 'featured';
  if (t.isNew) return 'newer';
  return 'archive';
}
function tintHex(rgb){
  const [r, g, b] = rgb;
  return `rgb(${(r*255)|0},${(g*255)|0},${(b*255)|0})`;
}

/* Fibonacci-sphere distribution — even spread of N points on the unit sphere */
function fibonacciSphere(n){
  const out = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    out.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
  }
  return out;
}

/* ---------- Shaders (GLSL3 / WebGL2) ---------- */

const SPHERE_VERT = /* glsl */`
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uPlayingActive;
  uniform vec3  uPlayingSeed;
  uniform float uHoverActive;
  uniform vec3  uHoverSeed;

  out vec3 vWorldPos;
  out vec3 vWorldNormal;
  out vec3 vLocalDir;

  float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise3(vec3 p){
    vec3 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(
      mix(mix(hash3(i),                     hash3(i+vec3(1,0,0)), f.x),
          mix(hash3(i+vec3(0,1,0)),         hash3(i+vec3(1,1,0)), f.x), f.y),
      mix(mix(hash3(i+vec3(0,0,1)),         hash3(i+vec3(1,0,1)), f.x),
          mix(hash3(i+vec3(0,1,1)),         hash3(i+vec3(1,1,1)), f.x), f.y), f.z);
  }

  void main(){
    vec3 n = normalize(position);

    // Idle breath
    float breathe = sin(uTime * 0.7) * 0.04;
    // Bass pulse — uniform inflation
    float bassPulse = uBass * 0.22;
    // Curl-ish wobble
    float wob = (noise3(n * 2.0 + uTime * 0.25) - 0.5) * (0.10 + uMid * 0.20);
    // High-freq surface chatter when playing
    float hi  = (noise3(n * 14.0 + uTime * 2.2) - 0.5) * uHigh * 0.10 * uPlayingActive;
    // Bias toward playing cell — that region pushes outward
    float playCell  = max(0.0, dot(n, uPlayingSeed));
    playCell = pow(playCell, 6.0) * uPlayingActive * (0.10 + uBass * 0.30);
    // Hover pull
    float hoverCell = max(0.0, dot(n, uHoverSeed));
    hoverCell = pow(hoverCell, 12.0) * uHoverActive * 0.07;

    float disp = breathe + bassPulse + wob + hi + playCell + hoverCell;
    vec3 displaced = position + n * disp;

    vec4 wp = modelMatrix * vec4(displaced, 1.0);
    vWorldPos    = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * n);
    vLocalDir    = n;
    gl_Position  = projectionMatrix * viewMatrix * wp;
  }
`;

const SPHERE_FRAG = /* glsl */`
  precision highp float;

  uniform sampler2D uSeedTex;   // 117×1 RGBA float, RGB = seed direction
  uniform sampler2D uTintTex;   // 117×1 RGBA float, RGB = tint color
  uniform int   uCellCount;
  uniform float uHovered;       // index, -1.0 if none
  uniform float uPlaying;       // index, -1.0 if none
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform vec3  uCamPos;

  in vec3 vWorldPos;
  in vec3 vWorldNormal;
  in vec3 vLocalDir;

  out vec4 fragColor;

  float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main(){
    vec3 dir = normalize(vLocalDir);

    int   bestIdx   = 0;
    int   secondIdx = 0;
    float bestDot   = -2.0;
    float secondDot = -2.0;
    for (int i = 0; i < 256; i++) {
      if (i >= uCellCount) break;
      vec3 s = texelFetch(uSeedTex, ivec2(i, 0), 0).xyz;
      float d = dot(dir, s);
      if (d > bestDot) {
        secondDot = bestDot; secondIdx = bestIdx;
        bestDot = d; bestIdx = i;
      } else if (d > secondDot) {
        secondDot = d; secondIdx = i;
      }
    }

    vec3 tint = texelFetch(uTintTex, ivec2(bestIdx, 0), 0).xyz;

    // Border thickness: smaller (bestDot - secondDot) = closer to a Voronoi edge
    float edgeT = bestDot - secondDot;
    float border  = smoothstep(0.0, 0.014, edgeT);  // 0 at edge, 1 inside cell
    float thinEdge = 1.0 - smoothstep(0.0, 0.0035, edgeT);

    // Fresnel rim
    vec3 viewDir = normalize(uCamPos - vWorldPos);
    float fres = 1.0 - max(0.0, dot(normalize(vWorldNormal), viewDir));
    fres = pow(fres, 1.8);

    bool isHover = (uHovered >= 0.0) && (abs(float(bestIdx) - uHovered) < 0.5);
    bool isPlay  = (uPlaying >= 0.0) && (abs(float(bestIdx) - uPlaying) < 0.5);
    float hoverF = isHover ? 1.0 : 0.0;
    float playF  = isPlay  ? 1.0 : 0.0;

    float glAmt = 0.16 + hoverF * 0.85 + playF * 0.55 + uBass * 0.40;

    // Latitude scanlines on the surface
    float sl = 0.92 + 0.08 * sin(dir.y * 220.0);

    // Block dropout glitch (sparse vertical strips)
    float dropY = floor(dir.y * 90.0) / 90.0;
    float dropoutSeed = rand(vec2(dropY * 13.0, floor(uTime * 24.0)));
    float dropMul = (dropoutSeed > 1.0 - 0.05 * glAmt) ? 0.32 : 1.0;

    // RGB-split-style wobble on hover/play (shift tint channels)
    float wob = (rand(vec2(floor(dir.y * 28.0), floor(uTime * 14.0))) - 0.5) * 0.08 * glAmt;
    vec3 splitTint = vec3(
      tint.r * (1.0 + wob),
      tint.g,
      tint.b * (1.0 - wob)
    );

    // Body color
    vec3 col = splitTint * 0.42 * sl * dropMul;

    // Voronoi cell edges glow magenta (always faintly, brighter on hover/play)
    vec3 edgeColor = mix(vec3(1.0, 0.30, 0.66), vec3(0.40, 0.85, 1.0), 0.30 + tint.b * 0.40);
    col += thinEdge * edgeColor * (0.55 + hoverF * 0.6 + playF * 0.7);

    // Fresnel rim — soft tint blend
    col += fres * (tint * 0.55 + vec3(0.10, 0.04, 0.18));

    // Hover / play interior boost
    col += hoverF * tint * (0.55 + uBass * 0.45);
    col += playF  * tint * (1.05 + uBass * 0.80);

    // Dim cells that aren't the playing one (only when something is playing)
    float playingDim = (uPlaying >= 0.0) ? (playF > 0.5 ? 1.0 : 0.36) : 1.0;
    col *= playingDim;

    // Subtle cross-hatch
    col += sin(dir.x * 480.0 + uTime * 0.5) * 0.025;

    // Grain
    col += (rand(dir.xy + uTime * 0.3) - 0.5) * 0.035;

    fragColor = vec4(col, 1.0);
  }
`;

/* Post: CA + scanlines + grain + vignette (same family as galaxy/corridor) */
const POST_VERT = /* glsl */`
  out vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;
const POST_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform float uTime;
  uniform vec2  uResolution;
  uniform float uBass;
  in  vec2 vUv;
  out vec4 fragColor;
  float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec2 uv = vUv;
    vec2 dir = uv - 0.5;
    float ca = 0.0020 + uBass * 0.0080;
    float r = texture(tDiffuse, uv - dir * ca).r;
    float g = texture(tDiffuse, uv).g;
    float b = texture(tDiffuse, uv + dir * ca).b;
    vec3 col = vec3(r, g, b);
    col *= 0.94 + 0.06 * sin(uv.y * uResolution.y * 1.4);
    col += (rand(uv + fract(uTime * 0.7)) - 0.5) * 0.045;
    float vig = smoothstep(1.20, 0.40, length(dir) * 1.40);
    col *= vig;
    fragColor = vec4(col, 1.0);
  }
`;

/* ---------- Constants ---------- */
const SPHERE_RADIUS = 5.6;
const SPHERE_DETAIL = 6;            // 6 → 5120 tris, 2562 verts
const CAM_DIST_INIT = 14.0;
const CAM_DIST_MIN  = 9.0;
const CAM_DIST_MAX  = 22.0;
const AUTO_SPIN_Y   = 0.06;         // rad/sec
const AUTO_SPIN_X   = 0.018;

/* ---------- Module ---------- */
const LiquidObject = {
  ctx: null, container: null,
  scene: null, camera: null, renderer: null, composer: null, postPass: null, bloom: null,
  clock: null, raf: 0,
  group: null, sphereMesh: null, material: null,
  motes: null, halo: null,
  seeds: [], tints: [],
  hovered: -1, playing: -1, lastPlayingIdx: -1,
  audioCtx: null, analyser: null, freqArr: null,
  ray: null, mouse: null,
  hudEl: null, jumpEl: null, destroyed: false,

  camDist: CAM_DIST_INIT,
  spinVelX: 0, spinVelY: 0,
  pointerDragging: false, lastDrag: null,
  pressMoved: 0, pressedHovered: -1,

  init(container, ctx){
    if (this.renderer) return;
    this.ctx = ctx;
    this.container = container;
    this.destroyed = false;
    this.mouse = { x: 0.5, y: 0.5, ndc: new THREE.Vector2(0, 0) };

    const canvas = document.createElement('canvas');
    canvas.className = 'lo-canvas';
    container.appendChild(canvas);

    this.hudEl = this._buildHud();
    container.appendChild(this.hudEl);
    this.jumpEl = this._buildJumpList();
    container.appendChild(this.jumpEl);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.setClearColor(0x040406, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x040406, 0.020);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    this.camera.position.set(0, 0, this.camDist);
    this.camera.lookAt(0, 0, 0);

    this._buildSphere();
    this._buildMotes();
    this._buildHalo();

    this.clock = new THREE.Clock();
    this.ray = new THREE.Raycaster();

    this._onResize       = this._onResize.bind(this);
    this._onPointerMove  = this._onPointerMove.bind(this);
    this._onPointerDown  = this._onPointerDown.bind(this);
    this._onPointerUp    = this._onPointerUp.bind(this);
    this._onWheel        = this._onWheel.bind(this);
    this._onKeyDown      = this._onKeyDown.bind(this);
    this._onTouchStart   = this._onTouchStart.bind(this);
    this._onTouchMove    = this._onTouchMove.bind(this);
    this._onTouchEnd     = this._onTouchEnd.bind(this);

    window.addEventListener('resize', this._onResize);
    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);
    canvas.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('keydown', this._onKeyDown);
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', this._onTouchEnd, { passive: false });

    // Listen for audio finish so we can clear the playing cell glow
    this._onAudioEnded = () => { this.playing = -1; this._refreshNow(); };
    this.ctx.audio?.addEventListener('ended', this._onAudioEnded);
    this._onAudioPlay  = () => { /* visual handled via this.playing already set on click */ };
    this.ctx.audio?.addEventListener('play',  this._onAudioPlay);

    this._setupComposer();
    this._onResize();
    this._hookAudio();

    this.animate = this.animate.bind(this);
    this.animate();
  },

  /* ---------- HUD ---------- */
  _buildHud(){
    const root = document.createElement('div');
    root.className = 'lo-hud';
    const buildN = this.ctx.buildNumber || '';
    const trackN = this.ctx.tracks ? this.ctx.tracks.length : 0;
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const moveHint = isTouch ? 'drag rotate · tap a cell to play' : 'drag rotate · hover · click play · tab=index';
    root.innerHTML = `
      <div class="lo-tl">
        <div class="lo-brand">kani</div>
        <div class="lo-meta">OBJ.<span id="lo-objn">000</span> · ${trackN} signals · ${buildN} the object</div>
        <div class="lo-nav">
          <a href="/">home</a>
          <a href="/tracks">catalog</a>
          <a href="/corridor.html">corridor</a>
        </div>
      </div>
      <div class="lo-tr">
        <button class="lo-list-btn" id="lo-list-btn" aria-label="all signals">≡ index</button>
        <div class="lo-mark">cantmute.me</div>
      </div>
      <div class="lo-bl">
        <div class="lo-hint" id="lo-hint">${moveHint}</div>
      </div>
      <div class="lo-br">
        <div class="lo-hover" id="lo-hover"></div>
        <div class="lo-hover-meta" id="lo-hover-meta"></div>
      </div>
      <div class="lo-spectrum" aria-hidden="true">
        <span id="lo-now" class="lo-now"></span>
        <span class="lo-spec-bars" id="lo-spec-bars">
          ${'<i></i>'.repeat(20)}
        </span>
        <span id="lo-tc">00:00</span>
      </div>
    `;
    root.querySelector('#lo-list-btn').addEventListener('click', e => {
      e.stopPropagation();
      this._toggleJumpList();
    });
    return root;
  },

  _buildJumpList(){
    const root = document.createElement('div');
    root.className = 'lo-jump';
    root.innerHTML = `
      <div class="lo-jump-inner">
        <div class="lo-jump-head">
          <input type="text" class="lo-jump-search" id="lo-jump-search" placeholder="search & play..." />
          <button class="lo-jump-close" id="lo-jump-close" aria-label="close">×</button>
        </div>
        <div class="lo-jump-list" id="lo-jump-list"></div>
      </div>
    `;
    root.addEventListener('click', e => { if (e.target === root) this._toggleJumpList(false); });
    root.querySelector('#lo-jump-close').addEventListener('click', () => this._toggleJumpList(false));
    return root;
  },

  _populateJumpList(filter = ''){
    const wrap = this.jumpEl.querySelector('#lo-jump-list');
    if (!wrap) return;
    const f = filter.trim().toLowerCase();
    const tracks = this.ctx.tracks || [];
    const items = tracks
      .map((track, idx) => ({ track, idx, tier: tierForTrack(track) }))
      .filter(n => !f || n.track.title.toLowerCase().includes(f));
    wrap.innerHTML = items.map(n => {
      const tint = this.tints[n.idx] || [1,1,1];
      const hex = tintHex(tint);
      const meta = [n.tier, n.track.date ? new Date(n.track.date).getFullYear() : ''].filter(Boolean).join(' · ');
      return `<button class="lo-jump-item" data-i="${n.idx}">
        <span class="lo-jump-dot" style="background:${hex};color:${hex}"></span>
        <span class="lo-jump-title">${n.track.title.toLowerCase()}</span>
        <span class="lo-jump-meta">${meta}</span>
      </button>`;
    }).join('') || '<div class="lo-jump-empty">no matches</div>';
    wrap.querySelectorAll('.lo-jump-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.i);
        this._toggleJumpList(false);
        this._aimAtCell(i, true);
        this._playCell(i);
      });
    });
  },

  _toggleJumpList(force){
    const open = (typeof force === 'boolean') ? force : !this.jumpEl.classList.contains('on');
    if (open) {
      this._populateJumpList('');
      this.jumpEl.classList.add('on');
      const inp = this.jumpEl.querySelector('#lo-jump-search');
      inp.value = '';
      inp.oninput = () => this._populateJumpList(inp.value);
      setTimeout(() => inp.focus(), 30);
    } else {
      this.jumpEl.classList.remove('on');
    }
  },

  /* ---------- Sphere ---------- */
  _buildSphere(){
    const tracks = this.ctx.tracks || [];
    const N = tracks.length;
    this.seeds = fibonacciSphere(N);
    this.tints = tracks.map((t, i) => tintForTrack(t, tierForTrack(t)));

    // Pack seeds + tints into 1×N RGBA float textures
    const seedData = new Float32Array(N * 4);
    const tintData = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      seedData[i*4]   = this.seeds[i].x;
      seedData[i*4+1] = this.seeds[i].y;
      seedData[i*4+2] = this.seeds[i].z;
      seedData[i*4+3] = 1.0;
      tintData[i*4]   = this.tints[i][0];
      tintData[i*4+1] = this.tints[i][1];
      tintData[i*4+2] = this.tints[i][2];
      tintData[i*4+3] = 1.0;
    }
    const seedTex = new THREE.DataTexture(seedData, N, 1, THREE.RGBAFormat, THREE.FloatType);
    seedTex.minFilter = THREE.NearestFilter; seedTex.magFilter = THREE.NearestFilter;
    seedTex.needsUpdate = true;
    const tintTex = new THREE.DataTexture(tintData, N, 1, THREE.RGBAFormat, THREE.FloatType);
    tintTex.minFilter = THREE.NearestFilter; tintTex.magFilter = THREE.NearestFilter;
    tintTex.needsUpdate = true;

    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        uTime:           { value: 0 },
        uBass:           { value: 0 },
        uMid:            { value: 0 },
        uHigh:           { value: 0 },
        uPlayingActive:  { value: 0 },
        uPlayingSeed:    { value: new THREE.Vector3(0, 1, 0) },
        uHoverActive:    { value: 0 },
        uHoverSeed:      { value: new THREE.Vector3(0, 1, 0) },
        uSeedTex:        { value: seedTex },
        uTintTex:        { value: tintTex },
        uCellCount:      { value: N },
        uHovered:        { value: -1 },
        uPlaying:        { value: -1 },
        uCamPos:         { value: new THREE.Vector3() },
      },
      vertexShader: SPHERE_VERT,
      fragmentShader: SPHERE_FRAG,
      transparent: false,
    });
    this.material = material;

    const geo = new THREE.IcosahedronGeometry(SPHERE_RADIUS, SPHERE_DETAIL);
    const mesh = new THREE.Mesh(geo, material);
    this.sphereMesh = mesh;

    const grp = new THREE.Group();
    grp.add(mesh);
    this.scene.add(grp);
    this.group = grp;
  },

  _buildHalo(){
    // Soft radial back-glow sprite so the void doesn't feel completely flat
    const sz = 256;
    const c = document.createElement('canvas');
    c.width = c.height = sz;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(sz/2, sz/2, 0, sz/2, sz/2, sz/2);
    g.addColorStop(0,   'rgba(255, 70, 160, 0.42)');
    g.addColorStop(0.4, 'rgba(120, 50, 200, 0.16)');
    g.addColorStop(1,   'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, sz, sz);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(mat);
    s.scale.set(38, 38, 1);
    s.position.set(0, 0, -2);
    this.scene.add(s);
    this.halo = s;
  },

  _buildMotes(){
    const N = 1100;
    const positions = new Float32Array(N * 3);
    const phases = new Float32Array(N);
    const sizes = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      // Spherical shell around the object
      const r = 8 + Math.random() * 18;
      const u = Math.random(), v = Math.random();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i*3+2] = r * Math.cos(phi);
      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = 0.4 + Math.random() * 1.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { uTime: { value: 0 }, uPxr: { value: this.renderer.getPixelRatio() } },
      vertexShader: `
        in float aPhase;
        in float aSize;
        out float vAlpha;
        uniform float uTime;
        uniform float uPxr;
        void main(){
          vec3 p = position;
          float t = uTime * 0.10 + aPhase;
          p.x += sin(t) * 0.6;
          p.y += cos(t * 0.8) * 0.5;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float fade = smoothstep(34.0, 6.0, length(mv.xyz));
          vAlpha = 0.30 * fade;
          gl_PointSize = aSize * uPxr * (130.0 / max(length(mv.xyz), 1.0));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        precision highp float;
        in float vAlpha;
        out vec4 fragColor;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          float a = smoothstep(0.5, 0.0, r);
          a = pow(a, 2.0);
          fragColor = vec4(vec3(0.85, 0.55, 0.95), a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.motes = new THREE.Points(geo, mat);
    this.scene.add(this.motes);
  },

  /* ---------- Composer ---------- */
  _setupComposer(){
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.95, 0.55, 0.05);
    bloom.threshold = 0.05;
    bloom.strength  = 0.95;
    bloom.radius    = 0.55;
    this.bloom = bloom;
    this.composer.addPass(bloom);
    this.postPass = new ShaderPass({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tDiffuse:    { value: null },
        uTime:       { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uBass:       { value: 0 },
      },
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
    });
    this.composer.addPass(this.postPass);
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
      const an = ac.createAnalyser();
      an.fftSize = 256;
      an.smoothingTimeConstant = 0.85;
      src.connect(an);
      an.connect(ac.destination);
      this.audioCtx = ac;
      this.analyser = an;
      this.freqArr = new Uint8Array(an.frequencyBinCount);
      a.__floorAnalyser = { ctx: ac, source: src, analyser: an, freqArr: this.freqArr };
    } catch (e) { console.warn('[object] analyser failed', e); }
  },

  _readBands(){
    if (!this.analyser) return [0, 0, 0];
    this.analyser.getByteFrequencyData(this.freqArr);
    let bass = 0, mid = 0, hi = 0;
    for (let i = 2; i < 10; i++)  bass += this.freqArr[i];
    for (let i = 12; i < 40; i++) mid  += this.freqArr[i];
    for (let i = 50; i < 120; i++) hi  += this.freqArr[i];
    return [
      Math.min(1, bass / (8 * 255)),
      Math.min(1, mid  / (28 * 255)),
      Math.min(1, hi   / (70 * 255)),
    ];
  },

  /* ---------- Input ---------- */
  _onResize(){
    if (!this.renderer || !this.container) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = (h > w) ? 70 : 55;
    this.camera.updateProjectionMatrix();
    if (this.postPass) this.postPass.uniforms.uResolution.value.set(w, h);
  },

  _onPointerMove(e){
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) / r.width;
    this.mouse.y = (e.clientY - r.top) / r.height;
    this.mouse.ndc.set(this.mouse.x * 2 - 1, -(this.mouse.y * 2 - 1));

    if (this.pointerDragging && this.lastDrag && e.pointerType !== 'touch') {
      const dx = e.clientX - this.lastDrag.x;
      const dy = e.clientY - this.lastDrag.y;
      this.lastDrag.x = e.clientX;
      this.lastDrag.y = e.clientY;
      this.pressMoved += Math.hypot(dx, dy);
      this.spinVelY += dx * 0.005;
      this.spinVelX += dy * 0.005;
    } else {
      this._raycast();
    }
  },

  _onPointerDown(e){
    if (e.pointerType === 'touch') return;
    this.pointerDragging = true;
    this.lastDrag = { x: e.clientX, y: e.clientY };
    this.pressMoved = 0;
    this.pressedHovered = this.hovered;
    this.renderer.domElement.style.cursor = 'grabbing';
  },

  _onPointerUp(e){
    if (this.pointerDragging) {
      this.pointerDragging = false;
      this.renderer.domElement.style.cursor = '';
      this.lastDrag = null;
      // Tap (small drag) → play hovered cell
      if (this.pressMoved < 6 && this.pressedHovered >= 0) {
        this._playCell(this.pressedHovered);
      }
    }
  },

  _onWheel(e){
    e.preventDefault();
    this.camDist += e.deltaY * 0.012;
    if (this.camDist < CAM_DIST_MIN) this.camDist = CAM_DIST_MIN;
    if (this.camDist > CAM_DIST_MAX) this.camDist = CAM_DIST_MAX;
  },

  _onKeyDown(e){
    const inJumpInput = (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    if (e.key === 'Tab' && !inJumpInput) { e.preventDefault(); this._toggleJumpList(); return; }
    if (e.key === 'Escape') {
      if (this.jumpEl.classList.contains('on')) { this._toggleJumpList(false); return; }
      const a = this.ctx.audio;
      if (a && !a.paused) { a.pause(); }
    }
    if (e.key === ' ' && !inJumpInput) {
      e.preventDefault();
      const a = this.ctx.audio;
      if (a) { if (a.paused) a.play().catch(()=>{}); else a.pause(); }
    }
  },

  _onTouchStart(e){
    const r = this.renderer.domElement.getBoundingClientRect();
    const t = e.changedTouches[0];
    if (!t) return;
    this.pointerDragging = true;
    this.lastDrag = { x: t.clientX, y: t.clientY };
    this.pressMoved = 0;
    // Pre-set ndc so raycast on touchstart populates hovered for tap-to-play
    this.mouse.ndc.set(((t.clientX - r.left) / r.width) * 2 - 1, -(((t.clientY - r.top) / r.height) * 2 - 1));
    this._raycast();
    this.pressedHovered = this.hovered;
  },

  _onTouchMove(e){
    e.preventDefault();
    const t = e.changedTouches[0];
    if (!t || !this.lastDrag) return;
    const dx = t.clientX - this.lastDrag.x;
    const dy = t.clientY - this.lastDrag.y;
    this.lastDrag.x = t.clientX;
    this.lastDrag.y = t.clientY;
    this.pressMoved += Math.hypot(dx, dy);
    this.spinVelY += dx * 0.006;
    this.spinVelX += dy * 0.006;
  },

  _onTouchEnd(){
    if (this.pointerDragging) {
      this.pointerDragging = false;
      this.lastDrag = null;
      if (this.pressMoved < 8 && this.pressedHovered >= 0) {
        this._playCell(this.pressedHovered);
      }
    }
  },

  /* ---------- Raycast → Voronoi ---------- */
  _raycast(){
    if (!this.sphereMesh) return;
    this.ray.setFromCamera(this.mouse.ndc, this.camera);
    const hits = this.ray.intersectObject(this.sphereMesh, false);
    if (hits.length) {
      const local = this.group.worldToLocal(hits[0].point.clone()).normalize();
      let bestIdx = -1, bestDot = -2;
      for (let i = 0; i < this.seeds.length; i++) {
        const d = local.dot(this.seeds[i]);
        if (d > bestDot) { bestDot = d; bestIdx = i; }
      }
      if (bestIdx !== this.hovered) {
        this.hovered = bestIdx;
        this._refreshHover();
      }
      this.renderer.domElement.style.cursor = this.pointerDragging ? 'grabbing' : 'pointer';
    } else {
      if (this.hovered !== -1) {
        this.hovered = -1;
        this._refreshHover();
      }
      this.renderer.domElement.style.cursor = this.pointerDragging ? 'grabbing' : 'grab';
    }
  },

  _refreshHover(){
    const u = this.material.uniforms;
    if (this.hovered >= 0) {
      u.uHovered.value = this.hovered;
      u.uHoverActive.value = 1;
      u.uHoverSeed.value.copy(this.seeds[this.hovered]);
      const t = this.ctx.tracks[this.hovered];
      const tier = tierForTrack(t);
      const titleEl = this.hudEl.querySelector('#lo-hover');
      const metaEl  = this.hudEl.querySelector('#lo-hover-meta');
      if (titleEl) titleEl.textContent = (t?.title || '').toLowerCase();
      const metaParts = [];
      if (t?.date) metaParts.push(new Date(t.date).getFullYear());
      if (t?.tags && t.tags[0]) metaParts.push(String(t.tags[0]));
      metaParts.push(tier);
      if (metaEl) metaEl.textContent = metaParts.join(' · ');
      const objN = this.hudEl.querySelector('#lo-objn');
      if (objN) objN.textContent = String(this.hovered + 1).padStart(3, '0');
    } else {
      u.uHovered.value = -1;
      u.uHoverActive.value = 0;
      const titleEl = this.hudEl.querySelector('#lo-hover');
      const metaEl  = this.hudEl.querySelector('#lo-hover-meta');
      if (titleEl) titleEl.textContent = '';
      if (metaEl) metaEl.textContent = '';
      // Object number falls back to playing index, otherwise 000
      const objN = this.hudEl.querySelector('#lo-objn');
      if (objN) objN.textContent = (this.playing >= 0 ? String(this.playing + 1) : '000').padStart(3, '0');
    }
  },

  _playCell(idx){
    if (!this.ctx.tracks[idx]) return;
    this.playing = idx;
    this.lastPlayingIdx = idx;
    const u = this.material.uniforms;
    u.uPlaying.value = idx;
    u.uPlayingActive.value = 1;
    u.uPlayingSeed.value.copy(this.seeds[idx]);
    this.ctx.onPlay?.(idx);
    this._refreshNow();
    this._aimAtCell(idx, false);
  },

  /* Rotate the group so the chosen cell faces the camera */
  _aimAtCell(idx, snap){
    const seed = this.seeds[idx];
    // Want seed (in local) to align with camera direction (0,0,1) in world
    // We control group.rotation. Compute target euler so that
    // R * seed = (0, 0, 1) (approximately).
    // Easiest: aim by setting yaw = atan2(-seed.x, seed.z), pitch = asin(seed.y).
    // Group rotation is applied in 'XYZ' order (default); pitch first then yaw.
    const targetYaw   = Math.atan2(-seed.x, seed.z);
    const targetPitch = Math.asin(Math.max(-1, Math.min(1, seed.y)));
    this._aimTarget = { yaw: targetYaw, pitch: targetPitch, t: 0, dur: snap ? 0.0 : 1.1 };
  },

  _refreshNow(){
    const nowEl = this.hudEl.querySelector('#lo-now');
    const t = this.ctx.tracks[this.playing];
    if (nowEl) nowEl.textContent = (this.playing >= 0 && t) ? `▶ ${t.title.toLowerCase()}` : '';
  },

  /* ---------- Loop ---------- */
  animate(){
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, this.clock.getDelta());
    const time = this.clock.elapsedTime;

    const [bass, mid, hi] = this._readBands();

    // Aim animation (when jumping to a cell from list / on play click)
    if (this._aimTarget) {
      this._aimTarget.t = Math.min(1, this._aimTarget.t + dt / Math.max(0.0001, this._aimTarget.dur));
      const k = 1 - Math.pow(1 - this._aimTarget.t, 3);
      const fromY = this.group.rotation.y, fromP = this.group.rotation.x;
      // Only nudge — preserve user spin influence
      this.group.rotation.y = fromY + (this._aimTarget.yaw   - fromY) * k * 0.05;
      this.group.rotation.x = fromP + (this._aimTarget.pitch - fromP) * k * 0.05;
      if (this._aimTarget.t >= 1 || this._aimTarget.dur === 0) {
        if (this._aimTarget.dur === 0) {
          this.group.rotation.y = this._aimTarget.yaw;
          this.group.rotation.x = this._aimTarget.pitch;
        }
        this._aimTarget = null;
      }
    }

    // Auto-spin + drag accumulator
    this.group.rotation.y += (AUTO_SPIN_Y + this.spinVelY) * dt;
    this.group.rotation.x += (AUTO_SPIN_X + this.spinVelX) * dt;
    this.spinVelY *= Math.exp(-2.0 * dt);
    this.spinVelX *= Math.exp(-2.0 * dt);
    // Clamp pitch
    const pmax = Math.PI * 0.45;
    if (this.group.rotation.x > pmax) { this.group.rotation.x = pmax; this.spinVelX = 0; }
    if (this.group.rotation.x < -pmax){ this.group.rotation.x = -pmax; this.spinVelX = 0; }

    // Camera dolly toward camDist
    const z = this.camera.position.z;
    this.camera.position.z = z + (this.camDist - z) * Math.min(1, dt * 4);
    this.camera.lookAt(0, 0, 0);

    // Sphere uniforms
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uBass.value = bass;
    u.uMid.value  = mid;
    u.uHigh.value = hi;
    u.uCamPos.value.copy(this.camera.position);
    // Active flag eases when audio actually playing
    const audioPlaying = this.ctx.audio && !this.ctx.audio.paused && this.ctx.audio.readyState > 2;
    const targetActive = (this.playing >= 0 && audioPlaying) ? 1 : 0;
    u.uPlayingActive.value += (targetActive - u.uPlayingActive.value) * Math.min(1, dt * 4);

    if (this.motes) this.motes.material.uniforms.uTime.value = time;

    if (this.postPass) {
      this.postPass.uniforms.uTime.value = time;
      this.postPass.uniforms.uBass.value = bass;
    }
    if (this.bloom) {
      this.bloom.strength = 0.85 + bass * 0.55 + (this.playing >= 0 ? 0.15 : 0);
    }

    // Spectrum HUD bars
    const bars = this.hudEl.querySelectorAll('#lo-spec-bars i');
    if (bars.length && this.freqArr) {
      const step = Math.floor(this.freqArr.length / bars.length);
      for (let i = 0; i < bars.length; i++) {
        const v = this.freqArr[i * step] / 255;
        bars[i].style.height = `${Math.max(2, Math.round(2 + v * 16))}px`;
      }
    }

    // Time code
    const tcEl = this.hudEl.querySelector('#lo-tc');
    if (tcEl) {
      const a = this.ctx.audio;
      const sec = Math.floor(a && !isNaN(a.currentTime) ? a.currentTime : 0);
      const mm = String(Math.floor(sec / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      tcEl.textContent = `${mm}:${ss}`;
    }

    this.composer.render();
  },

  destroy(){
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('pointerup', this._onPointerUp);
    if (this.ctx.audio) {
      this.ctx.audio.removeEventListener('ended', this._onAudioEnded);
      this.ctx.audio.removeEventListener('play',  this._onAudioPlay);
    }
    if (this.composer) {
      try { this.composer.passes.forEach(p => p.dispose?.()); } catch (e) {}
    }
    if (this.renderer) {
      try { this.renderer.dispose(); } catch (e) {}
      try { this.renderer.domElement.remove(); } catch (e) {}
    }
    if (this.scene) {
      this.scene.traverse(o => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => {
            for (const k in (m.uniforms || {})) {
              const v = m.uniforms[k]?.value;
              if (v && v.isTexture) v.dispose?.();
            }
            if (m.map) m.map.dispose?.();
            m.dispose?.();
          });
        }
      });
    }
    if (this.hudEl) this.hudEl.remove();
    if (this.jumpEl) this.jumpEl.remove();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.postPass = null;
    this.bloom = null;
    this.material = null;
    this.sphereMesh = null;
    this.group = null;
    this.motes = null;
    this.halo = null;
    this.seeds = [];
    this.tints = [];
    this.hudEl = null;
    this.jumpEl = null;
    this.container = null;
  },
};

window.LiquidObject = LiquidObject;
