/* =========================================================
   SIGNAL CORRIDOR — b155
   Standalone corridor catalog. 117 tracks line a Z-axis tube
   with a glowing pink ceiling beam. Scroll throttles forward,
   drag looks around, click pulls a card to camera. Same shader
   family as text-galaxy-pro (RGB-split / scanlines / glitch).
   Mounted only by corridor.html — never touches the rest.
   ========================================================= */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/* ---------- Shaders ---------- */

const POST_VERTEX = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;

// CA + scanlines + grain + vignette + warp speed lines
const POST_FRAGMENT = `
  uniform sampler2D tDiffuse;
  uniform float uTime;
  uniform vec2  uResolution;
  uniform float uBass;
  uniform float uWarp;
  varying vec2 vUv;
  float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec2 uv = vUv;
    vec2 dir = uv - 0.5;

    // Speed-line streaks at high warp
    float streakAmt = uWarp * 0.55;
    float a = atan(dir.y, dir.x);
    float streak = pow(0.5 + 0.5 * sin(a * 80.0 + uTime * 30.0), 12.0);
    streak *= smoothstep(0.05, 0.45, length(dir));

    float ca = 0.0018 + uBass * 0.0070 + uWarp * 0.012;
    float r = texture2D(tDiffuse, uv - dir * ca).r;
    float g = texture2D(tDiffuse, uv).g;
    float b = texture2D(tDiffuse, uv + dir * ca).b;
    vec3 col = vec3(r, g, b);
    col += vec3(1.0, 0.4, 0.7) * streak * streakAmt * 0.45;
    col *= 0.94 + 0.06 * sin(uv.y * uResolution.y * 1.4);
    col += (rand(uv + fract(uTime * 0.7)) - 0.5) * 0.045;
    float vig = smoothstep(1.20, 0.45, length(dir) * 1.40);
    col *= vig;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Cards: glitch displacement + RGB-split + scanlines + tint
const CARD_VERTEX = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CARD_FRAGMENT = `
  uniform sampler2D uTex;
  uniform float uTime;
  uniform float uHover;
  uniform float uFocus;
  uniform float uBass;
  uniform float uOpacity;
  uniform vec3  uTint;
  varying vec2 vUv;
  float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec2 uv = vUv;
    float gAmt = 0.18 + uHover * 0.95 + uBass * 0.50 + uFocus * 0.40;
    float strips = 24.0;
    float blockY = floor(uv.y * strips) / strips;
    float blockSeed = rand(vec2(blockY * 7.31, floor(uTime * 14.0)));
    float dispActive = step(1.0 - 0.18 * gAmt, blockSeed);
    float disp = (rand(vec2(blockY, floor(uTime * 12.0))) - 0.5) * 0.06 * gAmt;
    uv.x += disp * dispActive;
    float ca = 0.0018 + 0.012 * gAmt;
    float r = texture2D(uTex, uv + vec2(ca, 0.0)).r;
    float gC = texture2D(uTex, uv).g;
    float b = texture2D(uTex, uv - vec2(ca, 0.0)).b;
    float a = texture2D(uTex, uv).a;
    vec3 col = vec3(r, gC, b);
    float sl = 0.94 + 0.06 * sin(uv.y * 320.0);
    col *= sl;
    float dropY = floor(uv.y * 90.0) / 90.0;
    float dropoutSeed = rand(vec2(dropY * 13.0, floor(uTime * 24.0)));
    if (dropoutSeed > 1.0 - 0.04 * gAmt) a *= 0.0;
    col *= mix(vec3(1.0), uTint, 0.85);
    a *= uOpacity;
    gl_FragColor = vec4(col, a);
  }
`;

// Walls: vertical scanlines + panel seams + beam-proximity tint
const WALL_VERTEX = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main(){
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const WALL_FRAGMENT = `
  uniform float uTime;
  uniform float uBass;
  uniform vec3  uCamPos;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    // vUv.x runs along corridor length, vUv.y is height (0 floor → 1 ceiling)
    float scan   = 0.5 + 0.5 * sin(vUv.y * 280.0);
    float scanS  = smoothstep(0.55, 1.0, scan) * 0.06;
    float seam   = step(0.985, fract(vUv.x * 90.0)) * 0.16;
    float micro  = rand(vec2(floor(vUv.x * 220.0), floor(vUv.y * 60.0)));
    float dust   = step(0.992, micro) * 0.30;
    float beamProx = smoothstep(0.55, 1.0, vUv.y);
    vec3  beamTint = vec3(1.0, 0.25, 0.62) * beamProx * (0.05 + uBass * 0.10);
    vec3  baseCol  = vec3(0.05, 0.06, 0.10);
    vec3  col      = baseCol + scanS + seam + dust + beamTint;
    // Fade with distance from camera (so wall blends into fog/far void)
    float dz = abs(vWorldPos.z - uCamPos.z);
    float distFade = 1.0 - smoothstep(40.0, 320.0, dz);
    float alpha = (0.28 + scanS * 1.2 + seam * 1.4 + dust * 0.8) * distFade + beamProx * 0.05 * distFade;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.7));
  }
`;

// Ceiling beam: solid additive pink with audio pulse + travelling light
const BEAM_FRAGMENT = `
  uniform float uTime;
  uniform float uBass;
  varying vec2 vUv;
  void main(){
    // vUv.y around the cylinder, vUv.x along its length
    float core   = smoothstep(0.50, 0.50, abs(vUv.y - 0.5)); // unused, kept for tuning
    float around = 1.0 - abs(vUv.y - 0.5) * 2.0;             // 0 at edges, 1 in middle
    around = pow(max(around, 0.0), 1.6);
    // Travelling pulse along corridor
    float pulse = 0.5 + 0.5 * sin(vUv.x * 60.0 - uTime * 4.5);
    pulse = pow(pulse, 6.0);
    vec3 col = vec3(1.0, 0.28, 0.66) * (1.0 + uBass * 0.6);
    float a = around * (0.55 + pulse * 0.45 + uBass * 0.20);
    gl_FragColor = vec4(col, a);
  }
`;

/* ---------- Color helpers ---------- */

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
    baseHue = 0.07; hueRange = 0.12;
    sat = 0.82; lum = 0.74;
  } else if (tier === 'newer') {
    baseHue = 0.46; hueRange = 0.14;
    sat = 0.78; lum = 0.70;
  } else {
    baseHue = 0.74; hueRange = 0.16;
    sat = 0.62; lum = 0.66;
  }
  const h = (baseHue + seed * hueRange) % 1;
  const [r, g, b] = hsl(h, sat, lum);
  return [r, g, b];
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

/* ---------- Constants ---------- */

const WALL_X        = 11.5;   // half-width of corridor
const CARD_INSET    = 0.55;   // card sits this far inside the wall
const CARD_Z_STEP   = 14.0;   // distance between consecutive cards (alternating sides)
const CARD_Z_START  = -28.0;  // first card depth
const BEAM_Y        = 7.6;    // ceiling beam height
const CARD_Y        = 0.0;    // card vertical center
const CARD_W        = 9.0;
const CARD_H        = 5.0;
const FORWARD_MAX   = 70.0;   // cap throttle speed
const FORWARD_BOOST = 2.4;
const Z_BACK_LIMIT  = 30.0;   // can pull camera back this far before first card

/* ---------- Module ---------- */

const SignalCorridor = {
  ctx: null, container: null,
  scene: null, camera: null, renderer: null, composer: null, postPass: null, bloom: null,
  clock: null, raf: 0,
  cards: [],
  walls: [], beam: null, motes: null,
  hovered: null, focused: null,
  audioCtx: null, analyser: null, freqArr: null,
  ray: null, mouse: null,
  hudEl: null, jumpEl: null, destroyed: false,

  yaw: 0, pitch: 0,
  velZ: 0,                       // forward velocity (negative = into corridor)
  velX: 0,                       // strafe velocity
  keys: null,
  pointerDragging: false,
  lastDrag: null,
  joyActive: false, joyStart: null, joyVec: null, joyTouchId: null,
  lookActive: false, lookLast: null, lookTouchId: null,
  warp: 0,
  corridorEndZ: 0,

  init(container, ctx){
    if (this.renderer) return;
    this.ctx = ctx;
    this.container = container;
    this.destroyed = false;
    this.cards = [];
    this.walls = [];
    this.hovered = null;
    this.focused = null;
    this.mouse = { x: 0.5, y: 0.5, ndc: new THREE.Vector2(0, 0) };
    this.keys = new Set();
    this.joyVec = new THREE.Vector2();

    const canvas = document.createElement('canvas');
    canvas.className = 'sc-canvas';
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
    this.scene.fog = new THREE.FogExp2(0x040406, 0.0050);

    this.camera = new THREE.PerspectiveCamera(64, 1, 0.1, 1200);
    this.camera.position.set(0, 0, 0);

    this._buildCorridor();
    this._buildBeam();
    this._buildMotes();
    this._buildCards();

    this.clock = new THREE.Clock();
    this.ray = new THREE.Raycaster();

    this._onResize       = this._onResize.bind(this);
    this._onPointerMove  = this._onPointerMove.bind(this);
    this._onPointerDown  = this._onPointerDown.bind(this);
    this._onPointerUp    = this._onPointerUp.bind(this);
    this._onClick        = this._onClick.bind(this);
    this._onKeyDown      = this._onKeyDown.bind(this);
    this._onKeyUp        = this._onKeyUp.bind(this);
    this._onTouchStart   = this._onTouchStart.bind(this);
    this._onTouchMove    = this._onTouchMove.bind(this);
    this._onTouchEnd     = this._onTouchEnd.bind(this);
    this._onWheel        = this._onWheel.bind(this);

    window.addEventListener('resize', this._onResize);
    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);
    canvas.addEventListener('click', this._onClick);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', this._onTouchEnd, { passive: false });
    canvas.addEventListener('wheel', this._onWheel, { passive: false });

    this._setupComposer();
    this._onResize();
    this._hookAudio();

    this.animate = this.animate.bind(this);
    this.animate();
  },

  /* ---------- HUD ---------- */
  _buildHud(){
    const root = document.createElement('div');
    root.className = 'sc-hud';
    const buildN = this.ctx.buildNumber || '';
    const trackN = this.ctx.tracks ? this.ctx.tracks.length : 0;
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const moveHint = isTouch ? 'left thumb · drag · tap card' : 'scroll/W · drag · click · tab=list';
    root.innerHTML = `
      <div class="sc-tl">
        <div class="sc-brand">kani</div>
        <div class="sc-meta"><span id="sc-tc">CORR.000</span> · ${trackN} signals · ${buildN} corridor</div>
        <div class="sc-nav">
          <a href="/">home</a>
          <a href="/tracks">catalog</a>
        </div>
      </div>
      <div class="sc-tr">
        <button class="sc-list-btn" id="sc-list-btn" aria-label="all tracks">≡ all signals</button>
        <div class="sc-mark">cantmute.me</div>
      </div>
      <div class="sc-bl">
        <div class="sc-hint" id="sc-hint">${moveHint}</div>
      </div>
      <div class="sc-br">
        <div class="sc-hover" id="sc-hover"></div>
      </div>
      <div class="sc-depth" aria-hidden="true">
        <span>depth</span>
        <span class="sc-depth-bar"><span class="sc-depth-fill" id="sc-depth-fill"></span></span>
        <span id="sc-depth-num">000/000</span>
      </div>
      <div class="sc-focus" id="sc-focus" style="display:none">
        <div class="sc-focus-inner">
          <div class="sc-focus-kicker" id="sc-focus-kicker">— signal acquired —</div>
          <h1 class="sc-focus-title" id="sc-focus-title"></h1>
          <div class="sc-focus-meta" id="sc-focus-meta"></div>
          <div class="sc-focus-actions">
            <button class="sc-act" data-act="play">▶ play</button>
            <button class="sc-act sc-act-dim" data-act="release">close</button>
          </div>
        </div>
      </div>
      <div class="sc-joy" id="sc-joy" aria-hidden="true"><div class="sc-joy-knob" id="sc-joy-knob"></div></div>
      <div class="sc-boost" id="sc-boost" aria-hidden="true">WARP</div>
    `;
    root.querySelectorAll('.sc-act').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        const act = b.dataset.act;
        if (act === 'play' && this.focused) this.ctx.onPlay?.(this.focused.index);
        else if (act === 'release') this._release();
      });
    });
    root.querySelector('#sc-list-btn').addEventListener('click', e => {
      e.stopPropagation();
      this._toggleJumpList();
    });
    const boost = root.querySelector('#sc-boost');
    const setBoost = (v) => { if (v) this.keys.add('shift'); else this.keys.delete('shift'); };
    boost.addEventListener('touchstart', e => { e.preventDefault(); setBoost(true); boost.classList.add('on'); }, { passive: false });
    boost.addEventListener('touchend',   e => { e.preventDefault(); setBoost(false); boost.classList.remove('on'); }, { passive: false });
    boost.addEventListener('touchcancel',e => { setBoost(false); boost.classList.remove('on'); });
    return root;
  },

  _buildJumpList(){
    const root = document.createElement('div');
    root.className = 'sc-jump';
    root.innerHTML = `
      <div class="sc-jump-inner">
        <div class="sc-jump-head">
          <input type="text" class="sc-jump-search" id="sc-jump-search" placeholder="search & jump..." />
          <button class="sc-jump-close" id="sc-jump-close" aria-label="close">×</button>
        </div>
        <div class="sc-jump-list" id="sc-jump-list"></div>
      </div>
    `;
    root.addEventListener('click', e => { if (e.target === root) this._toggleJumpList(false); });
    root.querySelector('#sc-jump-close').addEventListener('click', () => this._toggleJumpList(false));
    return root;
  },

  _populateJumpList(filter = ''){
    const wrap = this.jumpEl.querySelector('#sc-jump-list');
    if (!wrap) return;
    const f = filter.trim().toLowerCase();
    const items = this.cards
      .filter(n => !f || n.track.title.toLowerCase().includes(f))
      .sort((a, b) => a.index - b.index);
    wrap.innerHTML = items.map(n => {
      const hex = tintHex(n.tintRgb);
      const meta = [n.tier, n.track.date ? new Date(n.track.date).getFullYear() : ''].filter(Boolean).join(' · ');
      return `<button class="sc-jump-item" data-i="${n.index}">
        <span class="sc-jump-dot" style="background:${hex};color:${hex}"></span>
        <span class="sc-jump-title">${n.track.title.toLowerCase()}</span>
        <span class="sc-jump-meta">${meta}</span>
      </button>`;
    }).join('') || '<div class="sc-jump-empty">no matches</div>';
    wrap.querySelectorAll('.sc-jump-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.i);
        const node = this.cards.find(n => n.index === i);
        if (node) {
          this._toggleJumpList(false);
          this._jumpTo(node);
        }
      });
    });
  },

  _toggleJumpList(force){
    const open = (typeof force === 'boolean') ? force : !this.jumpEl.classList.contains('on');
    if (open) {
      this._populateJumpList('');
      this.jumpEl.classList.add('on');
      const inp = this.jumpEl.querySelector('#sc-jump-search');
      inp.value = '';
      inp.oninput = () => this._populateJumpList(inp.value);
      setTimeout(() => inp.focus(), 30);
    } else {
      this.jumpEl.classList.remove('on');
    }
  },

  /* ---------- Corridor walls ---------- */
  _buildCorridor(){
    const total = (this.ctx.tracks || []).length;
    const corridorLen = Math.abs(CARD_Z_START) + total * CARD_Z_STEP * 0.5 + 80;
    this.corridorEndZ = -(Math.abs(CARD_Z_START) + total * CARD_Z_STEP * 0.5 + 40);
    const planeW = corridorLen + 60;
    const planeH = 16;

    const sharedUniforms = {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
    };

    const wallMat = new THREE.ShaderMaterial({
      uniforms: sharedUniforms,
      vertexShader: WALL_VERTEX,
      fragmentShader: WALL_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const buildWall = (x, faceDir) => {
      const geo = new THREE.PlaneGeometry(planeW, planeH, 1, 1);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(x, 0, -corridorLen / 2 + 20);
      mesh.rotation.y = faceDir > 0 ? -Math.PI / 2 : Math.PI / 2;
      this.scene.add(mesh);
      this.walls.push(mesh);
    };
    buildWall(-WALL_X, +1); // left wall, faces +x
    buildWall(+WALL_X, -1); // right wall, faces -x

    // Floor + ceiling slabs (very subtle, mostly to anchor the geometry)
    const slabMat = new THREE.ShaderMaterial({
      uniforms: sharedUniforms,
      vertexShader: WALL_VERTEX,
      fragmentShader: `
        uniform float uTime;
        uniform vec3  uCamPos;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          float seam = step(0.985, fract(vUv.x * 60.0)) * 0.10;
          float dust = step(0.994, rand(vec2(floor(vUv.x*180.0), floor(vUv.y*40.0)))) * 0.18;
          vec3 col = vec3(0.04, 0.05, 0.08) + seam + dust;
          float dz = abs(vWorldPos.z - uCamPos.z);
          float distFade = 1.0 - smoothstep(40.0, 280.0, dz);
          float alpha = (0.20 + seam * 1.2 + dust * 1.0) * distFade;
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.5));
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const floorGeo = new THREE.PlaneGeometry(planeW, WALL_X * 2, 1, 1);
    const floor = new THREE.Mesh(floorGeo, slabMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -8, -corridorLen / 2 + 20);
    floor.rotation.z = Math.PI / 2; // align uv.x along Z
    this.scene.add(floor);
    this.walls.push(floor);

    const ceil = new THREE.Mesh(floorGeo, slabMat);
    ceil.rotation.x =  Math.PI / 2;
    ceil.position.set(0, 8, -corridorLen / 2 + 20);
    ceil.rotation.z = Math.PI / 2;
    this.scene.add(ceil);
    this.walls.push(ceil);

    this._sharedUniforms = sharedUniforms;
  },

  /* ---------- Beam ---------- */
  _buildBeam(){
    const total = (this.ctx.tracks || []).length;
    const beamLen = Math.abs(this.corridorEndZ) + 60;
    const geo = new THREE.CylinderGeometry(0.10, 0.10, beamLen, 12, 1, true);
    const uniforms = {
      uTime: { value: 0 },
      uBass: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: BEAM_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(0, BEAM_Y, this.corridorEndZ / 2 + 20);
    this.scene.add(mesh);
    this.beam = mesh;

    // Outer halo cylinder
    const haloGeo = new THREE.CylinderGeometry(0.55, 0.55, beamLen, 16, 1, true);
    const haloMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uBass;
        varying vec2 vUv;
        void main(){
          float around = 1.0 - abs(vUv.y - 0.5) * 2.0;
          around = pow(max(around, 0.0), 2.5);
          vec3 col = vec3(1.0, 0.30, 0.68);
          float a = around * (0.16 + uBass * 0.18);
          gl_FragColor = vec4(col, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.copy(mesh.position);
    this.scene.add(halo);
    this._beamUniforms = uniforms;
  },

  /* ---------- Floating motes ---------- */
  _buildMotes(){
    const N = 800;
    const positions = new Float32Array(N * 3);
    const phases = new Float32Array(N);
    const sizes = new Float32Array(N);
    const corridorLen = Math.abs(this.corridorEndZ) + 80;
    for (let i = 0; i < N; i++) {
      positions[i*3]   = (Math.random() - 0.5) * (WALL_X * 2 - 1);
      positions[i*3+1] = (Math.random() - 0.5) * 14;
      positions[i*3+2] = -Math.random() * corridorLen + 20;
      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = 0.4 + Math.random() * 1.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPxr: { value: this.renderer.getPixelRatio() } },
      vertexShader: `
        attribute float aPhase;
        attribute float aSize;
        varying float vAlpha;
        uniform float uTime;
        uniform float uPxr;
        void main(){
          vec3 p = position;
          float t = uTime * 0.12 + aPhase;
          p.x += sin(t) * 0.6;
          p.y += cos(t * 0.7) * 0.4;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float fade = smoothstep(280.0, 20.0, length(mv.xyz));
          vAlpha = 0.32 * fade;
          gl_PointSize = aSize * uPxr * (130.0 / max(length(mv.xyz), 1.0));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          float a = smoothstep(0.5, 0.0, r);
          a = pow(a, 2.0);
          gl_FragColor = vec4(vec3(0.85, 0.55, 0.85), a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.motes = new THREE.Points(geo, mat);
    this.scene.add(this.motes);
  },

  /* ---------- Cards ---------- */
  _buildCards(){
    const all = this.ctx.tracks || [];
    if (!all.length) return;

    all.forEach((track, i) => {
      const tier = tierForTrack(track);
      const tintRgb = tintForTrack(track, tier);
      const side = (i % 2 === 0) ? -1 : +1; // -1 = left wall, +1 = right wall
      const x = (WALL_X - CARD_INSET) * side;
      const z = CARD_Z_START - i * (CARD_Z_STEP * 0.5);
      const y = CARD_Y;

      const tex = this._makeCardTexture(track, i, tier, tintRgb);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTex:     { value: tex },
          uTime:    { value: Math.random() * 100 },
          uHover:   { value: 0 },
          uFocus:   { value: 0 },
          uBass:    { value: 0 },
          uOpacity: { value: 1.0 },
          uTint:    { value: new THREE.Vector3(tintRgb[0], tintRgb[1], tintRgb[2]) },
        },
        vertexShader: CARD_VERTEX,
        fragmentShader: CARD_FRAGMENT,
        transparent: true,
        depthWrite: false,
      });
      const geo = new THREE.PlaneGeometry(CARD_W, CARD_H);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      // Face inward (toward center axis)
      mesh.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
      // Slight tilt-toward-camera so cards angle at the corridor center
      mesh.userData = { isCard: true, index: i, side };
      this.scene.add(mesh);

      this.cards.push({
        mesh,
        index: i,
        track,
        tier,
        tintRgb,
        basePos: mesh.position.clone(),
        baseRotY: mesh.rotation.y,
        flickerSeed: Math.random() * 100,
      });
    });
  },

  _makeCardTexture(track, idx, tier, tintRgb){
    const W = 1024, H = 576;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const accent = `rgb(${(tintRgb[0]*255)|0},${(tintRgb[1]*255)|0},${(tintRgb[2]*255)|0})`;
    const accentDim = `rgba(${(tintRgb[0]*255)|0},${(tintRgb[1]*255)|0},${(tintRgb[2]*255)|0},.45)`;

    ctx.clearRect(0, 0, W, H);

    // Faint inner glow / vignette
    const grd = ctx.createRadialGradient(W/2, H/2, 100, W/2, H/2, W*0.6);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // Frame border
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    const pad = 22;
    ctx.strokeRect(pad, pad, W - pad*2, H - pad*2);

    // Corner brackets (over the frame for emphasis)
    const bracket = (x, y, dx, dy) => {
      ctx.beginPath();
      ctx.moveTo(x, y + dy * 28);
      ctx.lineTo(x, y);
      ctx.lineTo(x + dx * 28, y);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 6;
      ctx.stroke();
    };
    bracket(pad,         pad,         +1, +1);
    bracket(W - pad,     pad,         -1, +1);
    bracket(pad,         H - pad,     +1, -1);
    bracket(W - pad,     H - pad,     -1, -1);

    // TRK number top-left
    ctx.fillStyle = accent;
    ctx.font = `500 22px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const num = String(idx + 1).padStart(3, '0');
    ctx.fillText(`▮ TRK.${num}`, pad + 22, pad + 22);

    // Tier tag top-right
    const tagText = tier === 'featured' ? '[FEATURED]' : tier === 'newer' ? '[ NEWER ]' : '[ARCHIVE]';
    ctx.textAlign = 'right';
    ctx.fillText(tagText, W - pad - 22, pad + 22);

    // Title
    const title = (track.title || '').toLowerCase();
    let titleSize = 130;
    ctx.font = `700 ${titleSize}px "Space Grotesk", system-ui, sans-serif`;
    while (ctx.measureText(title).width > W - pad*2 - 80 && titleSize > 60) {
      titleSize -= 6;
      ctx.font = `700 ${titleSize}px "Space Grotesk", system-ui, sans-serif`;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(title, pad + 44, H * 0.50);

    // Underline strip under title
    const tw = Math.min(W - pad*2 - 80, ctx.measureText(title).width);
    ctx.fillStyle = accent;
    ctx.fillRect(pad + 44, H * 0.50 + titleSize * 0.55, tw * 0.45, 4);

    // Bottom row: tier word + waveform-ish dashes
    ctx.font = `500 20px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = accentDim;
    let metaParts = [];
    if (track.date) metaParts.push(new Date(track.date).getFullYear());
    if (track.tags && track.tags[0]) metaParts.push(String(track.tags[0]).toLowerCase());
    metaParts.push(tier);
    ctx.fillText(metaParts.join(' · '), pad + 44, H - pad - 60);

    // Waveform diamonds on the right
    ctx.fillStyle = accent;
    const wfX = W - pad - 220;
    const wfY = H - pad - 50;
    for (let i = 0; i < 8; i++) {
      const sz = 8 + Math.sin(i * 0.9 + idx * 0.3) * 5;
      ctx.beginPath();
      ctx.moveTo(wfX + i * 24,         wfY);
      ctx.lineTo(wfX + i * 24 + sz/2,  wfY - sz/2);
      ctx.lineTo(wfX + i * 24 + sz,    wfY);
      ctx.lineTo(wfX + i * 24 + sz/2,  wfY + sz/2);
      ctx.closePath();
      ctx.fill();
    }

    // Hover-style strip at bottom
    ctx.fillStyle = accent;
    ctx.font = `500 16px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textBaseline = 'bottom';
    ctx.fillText('▶ HOVER · CLICK · PLAY', pad + 22, H - pad - 14);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
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
      uniforms: {
        tDiffuse:    { value: null },
        uTime:       { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uBass:       { value: 0 },
        uWarp:       { value: 0 },
      },
      vertexShader: POST_VERTEX,
      fragmentShader: POST_FRAGMENT,
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
    } catch (e) { console.warn('[corridor] analyser failed', e); }
  },

  _readBass(){
    if (!this.analyser) return 0;
    this.analyser.getByteFrequencyData(this.freqArr);
    let s = 0;
    for (let i = 2; i < 10; i++) s += this.freqArr[i];
    return Math.min(1, s / (8 * 255));
  },

  /* ---------- Input ---------- */
  _onResize(){
    if (!this.renderer || !this.container) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    // Slightly wider FOV in portrait so corridor stays readable on mobile
    this.camera.fov = (h > w) ? 76 : 64;
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
      const sens = 0.0030;
      this.yaw   -= dx * sens;
      this.pitch -= dy * sens;
      const ylim = 0.55;   // ±31°
      const plim = 0.40;   // ±23°
      if (this.yaw   >  ylim) this.yaw   =  ylim;
      if (this.yaw   < -ylim) this.yaw   = -ylim;
      if (this.pitch >  plim) this.pitch =  plim;
      if (this.pitch < -plim) this.pitch = -plim;
    }
    this._raycast();
  },

  _onPointerDown(e){
    if (e.pointerType === 'touch') return;
    this.pointerDragging = true;
    this.lastDrag = { x: e.clientX, y: e.clientY };
    this.renderer.domElement.style.cursor = 'grabbing';
  },

  _onPointerUp(){
    if (this.pointerDragging) {
      this.pointerDragging = false;
      this.renderer.domElement.style.cursor = '';
      this.lastDrag = null;
    }
  },

  _raycast(){
    if (this.focused) return;
    this.ray.setFromCamera(this.mouse.ndc, this.camera);
    const meshes = this.cards.map(t => t.mesh);
    const hits = this.ray.intersectObjects(meshes, false);
    const hit = hits[0]?.object?.userData;
    const hoverEl = document.getElementById('sc-hover');
    if (hit && hit.isCard) {
      this.hovered = this.cards.find(t => t.index === hit.index);
      if (hoverEl) hoverEl.textContent = this.hovered.track.title.toLowerCase();
      if (!this.pointerDragging) this.renderer.domElement.style.cursor = 'pointer';
    } else {
      this.hovered = null;
      if (hoverEl) hoverEl.textContent = '';
      if (!this.pointerDragging) this.renderer.domElement.style.cursor = '';
    }
  },

  _onClick(e){
    if (e.target.closest('.sc-focus, .sc-act, .sc-jump, .sc-list-btn, .sc-joy, .sc-boost, a')) return;
    if (this.focused) { this._release(); return; }
    if (this.hovered) this._focus(this.hovered);
  },

  _onKeyDown(e){
    const inJumpInput = (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    if (e.key === 'Tab' && !inJumpInput) { e.preventDefault(); this._toggleJumpList(); return; }
    if (e.key === 'Escape') {
      if (this.jumpEl.classList.contains('on')) { this._toggleJumpList(false); return; }
      if (this.focused) { this._release(); return; }
    }
    if (inJumpInput) return;
    const k = e.key.toLowerCase();
    if (['w','a','s','d',' ','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(k)) {
      this.keys.add(k === ' ' ? 'space' : k);
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
    }
  },

  _onKeyUp(e){
    const k = e.key.toLowerCase();
    this.keys.delete(k === ' ' ? 'space' : k);
  },

  _onWheel(e){
    e.preventDefault();
    // Wheel = throttle along corridor (deltaY positive = wheel forward = into corridor = -z)
    this.velZ -= e.deltaY * 0.06;
    // Clamp velocity peak
    if (this.velZ < -FORWARD_MAX * FORWARD_BOOST) this.velZ = -FORWARD_MAX * FORWARD_BOOST;
    if (this.velZ >  FORWARD_MAX * FORWARD_BOOST) this.velZ =  FORWARD_MAX * FORWARD_BOOST;
  },

  _onTouchStart(e){
    const r = this.renderer.domElement.getBoundingClientRect();
    for (const t of e.changedTouches) {
      const x = t.clientX - r.left;
      const y = t.clientY - r.top;
      const isLeft = x < r.width * 0.45;
      if (isLeft && !this.joyActive) {
        this.joyActive = true;
        this.joyTouchId = t.identifier;
        this.joyStart = { x, y };
        this.joyVec.set(0, 0);
        const joy = document.getElementById('sc-joy');
        if (joy) {
          joy.style.left = `${x}px`;
          joy.style.top = `${y}px`;
          joy.classList.add('on');
        }
      } else if (!this.lookActive) {
        this.lookActive = true;
        this.lookTouchId = t.identifier;
        this.lookLast = { x: t.clientX, y: t.clientY };
        // Cache start point so a stationary tap can route to click→focus
        this._tapStart = { x: t.clientX, y: t.clientY, t: performance.now() };
      }
    }
  },

  _onTouchMove(e){
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.joyTouchId && this.joyActive) {
        const r = this.renderer.domElement.getBoundingClientRect();
        const x = t.clientX - r.left;
        const y = t.clientY - r.top;
        const dx = x - this.joyStart.x;
        const dy = y - this.joyStart.y;
        const mag = Math.hypot(dx, dy);
        const cap = 60;
        const m = Math.min(mag, cap);
        const nx = mag > 0 ? dx / mag : 0;
        const ny = mag > 0 ? dy / mag : 0;
        this.joyVec.set(nx * (m / cap), ny * (m / cap));
        const knob = document.getElementById('sc-joy-knob');
        if (knob) knob.style.transform = `translate(${nx * m}px, ${ny * m}px)`;
      } else if (t.identifier === this.lookTouchId && this.lookActive) {
        const dx = t.clientX - this.lookLast.x;
        const dy = t.clientY - this.lookLast.y;
        this.lookLast.x = t.clientX;
        this.lookLast.y = t.clientY;
        const sens = 0.004;
        this.yaw   -= dx * sens;
        this.pitch -= dy * sens;
        const ylim = 0.55;
        const plim = 0.40;
        if (this.yaw   >  ylim) this.yaw   =  ylim;
        if (this.yaw   < -ylim) this.yaw   = -ylim;
        if (this.pitch >  plim) this.pitch =  plim;
        if (this.pitch < -plim) this.pitch = -plim;
        if (this._tapStart) {
          const moved = Math.hypot(t.clientX - this._tapStart.x, t.clientY - this._tapStart.y);
          if (moved > 8) this._tapStart = null;
        }
      }
    }
  },

  _onTouchEnd(e){
    for (const t of e.changedTouches) {
      if (t.identifier === this.joyTouchId) {
        this.joyActive = false; this.joyTouchId = null;
        this.joyVec.set(0, 0);
        const joy = document.getElementById('sc-joy');
        const knob = document.getElementById('sc-joy-knob');
        if (joy) joy.classList.remove('on');
        if (knob) knob.style.transform = '';
      }
      if (t.identifier === this.lookTouchId) {
        this.lookActive = false; this.lookTouchId = null;
        // Stationary tap → focus hovered card
        if (this._tapStart && performance.now() - this._tapStart.t < 350) {
          const r = this.renderer.domElement.getBoundingClientRect();
          const tx = (this._tapStart.x - r.left) / r.width;
          const ty = (this._tapStart.y - r.top) / r.height;
          this.mouse.ndc.set(tx * 2 - 1, -(ty * 2 - 1));
          this._raycast();
          if (this.hovered && !this.focused) this._focus(this.hovered);
        }
        this._tapStart = null;
      }
    }
  },

  /* ---------- Focus / release ---------- */
  _focus(node){
    this.focused = node;
    const card = node.mesh;
    const fovRad = this.camera.fov * Math.PI / 180;
    const targetDist = (CARD_W / 2) / Math.tan(fovRad / 2) * 0.92;

    // Approach perpendicular to card's face direction (its inward-facing normal)
    // Left-side card faces +x; right-side card faces -x.
    const sideSign = node.basePos.x < 0 ? +1 : -1;
    const target = node.basePos.clone();
    const camPos = new THREE.Vector3(
      target.x + sideSign * targetDist * 0.55,
      target.y,
      target.z + targetDist * 0.85,
    );
    this._flyTo(camPos, target);

    const focus = document.getElementById('sc-focus');
    const t = node.track;
    document.getElementById('sc-focus-title').textContent = t.title.toLowerCase();
    const meta = [];
    if (t.date) meta.push(new Date(t.date).getFullYear());
    if (t.tags && t.tags[0]) meta.push(String(t.tags[0]).toLowerCase());
    meta.push(node.tier);
    document.getElementById('sc-focus-meta').textContent = meta.join(' · ');
    focus.style.display = '';
    requestAnimationFrame(() => {
      focus.classList.add('on');
      this._glitchType(document.getElementById('sc-focus-title'), t.title.toLowerCase());
    });
    const hint = document.getElementById('sc-hint');
    if (hint) hint.textContent = 'esc or click background to release';
  },

  _flyTo(targetPos, lookAtPos){
    this._flying = {
      from: this.camera.position.clone(),
      to: targetPos.clone(),
      lookAt: lookAtPos.clone(),
      t: 0,
      dur: 0.85,
    };
  },

  _jumpTo(node){
    // Teleport camera up the corridor near this card, then release any focus
    const camZ = node.basePos.z + 18;
    this.camera.position.set(0, 0, camZ);
    this.velZ = 0; this.velX = 0;
  },

  _glitchType(el, finalText){
    const chars = '!<>-_\\/[]{}—=+*^?#________';
    let frame = 0;
    const total = 26;
    const step = () => {
      frame++;
      let out = '';
      for (let i = 0; i < finalText.length; i++) {
        const reveal = i < (frame / total) * finalText.length;
        if (reveal) out += finalText[i];
        else out += chars[Math.floor(Math.random() * chars.length)];
      }
      el.textContent = out;
      if (frame < total) requestAnimationFrame(step);
      else el.textContent = finalText;
    };
    step();
  },

  _release(){
    this.focused = null;
    this._flying = null;
    const focus = document.getElementById('sc-focus');
    if (focus) {
      focus.classList.remove('on');
      setTimeout(() => { if (!this.focused && focus) focus.style.display = 'none'; }, 350);
    }
    const hint = document.getElementById('sc-hint');
    if (hint) {
      const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      hint.textContent = isTouch ? 'left thumb · drag · tap card' : 'scroll/W · drag · click · tab=list';
    }
  },

  /* ---------- Loop ---------- */
  animate(){
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, this.clock.getDelta());
    const t  = this.clock.elapsedTime;
    const bass = this._readBass();

    if (this._flying) {
      this._flying.t = Math.min(1, this._flying.t + dt / this._flying.dur);
      const e = this._flying.t;
      const k = 1 - Math.pow(1 - e, 3);
      this.camera.position.lerpVectors(this._flying.from, this._flying.to, k);
      this.camera.lookAt(this._flying.lookAt);
      if (e >= 1) this._flying = null;
    } else {
      // Camera control: yaw + pitch from drag, throttle along Z, optional strafe X
      const cy = Math.cos(this.yaw),  sy = Math.sin(this.yaw);
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const forward = new THREE.Vector3(sy * cp, sp, -cy * cp);

      const boost = this.keys.has('shift') ? FORWARD_BOOST : 1.0;
      const accelZ = 60.0;
      const accelX = 40.0;
      const friction = 1.6;

      let mz = 0, mx = 0;
      if (this.keys.has('w') || this.keys.has('arrowup'))    mz -= 1;
      if (this.keys.has('s') || this.keys.has('arrowdown'))  mz += 1;
      if (this.keys.has('a') || this.keys.has('arrowleft'))  mx -= 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;
      if (this.joyActive) {
        mz += this.joyVec.y;   // push up = forward = -z (joy.y is screen-down positive)
        mx += this.joyVec.x;
      }

      // Apply input thrust
      if (mz !== 0) this.velZ += mz * accelZ * boost * dt;
      if (mx !== 0) this.velX += mx * accelX * boost * dt;
      // Friction (always)
      this.velZ -= this.velZ * Math.min(1, friction * dt);
      this.velX -= this.velX * Math.min(1, friction * dt);
      // Cap
      const maxV = FORWARD_MAX * FORWARD_BOOST;
      if (this.velZ < -maxV) this.velZ = -maxV;
      if (this.velZ >  maxV) this.velZ =  maxV;
      if (Math.abs(this.velX) > 18) this.velX = Math.sign(this.velX) * 18;

      // Move
      this.camera.position.z += this.velZ * dt;
      this.camera.position.x += this.velX * dt;

      // Wrap-around so corridor feels infinite
      if (this.camera.position.z < this.corridorEndZ + 10) {
        this.camera.position.z = Z_BACK_LIMIT - 4;
      } else if (this.camera.position.z > Z_BACK_LIMIT) {
        this.camera.position.z = Z_BACK_LIMIT;
        if (this.velZ > 0) this.velZ = 0;
      }
      // X soft clamp inside walls
      const xLim = WALL_X - 1.5;
      if (this.camera.position.x >  xLim) { this.camera.position.x =  xLim; if (this.velX > 0) this.velX = 0; }
      if (this.camera.position.x < -xLim) { this.camera.position.x = -xLim; if (this.velX < 0) this.velX = 0; }

      // Subtle bob with motion
      const speedFrac = Math.min(1, Math.abs(this.velZ) / FORWARD_MAX);
      this.camera.position.y = Math.sin(t * 1.6) * 0.06 + Math.sin(t * 5.2) * 0.02 * speedFrac;

      // Aim
      const target = this.camera.position.clone().add(forward);
      this.camera.lookAt(target);
    }

    // Warp ramp from speed
    const speedFrac = Math.min(1, Math.abs(this.velZ) / FORWARD_MAX);
    const targetWarp = Math.max(0, (speedFrac - 0.45) / 0.55);
    this.warp += (targetWarp - this.warp) * Math.min(1, dt * 4);

    // Shared uniform updates
    if (this._sharedUniforms) {
      this._sharedUniforms.uTime.value = t;
      this._sharedUniforms.uBass.value = bass;
      this._sharedUniforms.uCamPos.value.copy(this.camera.position);
    }
    if (this._beamUniforms) {
      this._beamUniforms.uTime.value = t;
      this._beamUniforms.uBass.value = bass;
    }
    if (this.motes) this.motes.material.uniforms.uTime.value = t;

    // Per-card glitch + hover/focus
    this.cards.forEach(n => {
      const u = n.mesh.material.uniforms;
      u.uTime.value = t + n.flickerSeed;
      u.uBass.value = bass;
      const isHover = this.hovered && this.hovered.index === n.index;
      const isFocus = this.focused && this.focused.index === n.index;
      const targetH = isHover ? 1 : 0;
      u.uHover.value += (targetH - u.uHover.value) * Math.min(1, dt * 9);
      const targetF = isFocus ? 1 : 0;
      u.uFocus.value += (targetF - u.uFocus.value) * Math.min(1, dt * 6);
      let targetOp;
      if (this.focused) targetOp = isFocus ? 1.0 : 0.10;
      else targetOp = 1.0;
      u.uOpacity.value += (targetOp - u.uOpacity.value) * Math.min(1, dt * 5);
    });

    if (this.postPass) {
      this.postPass.uniforms.uTime.value = t;
      this.postPass.uniforms.uBass.value = bass;
      this.postPass.uniforms.uWarp.value = this.warp;
    }
    if (this.bloom) {
      this.bloom.strength = 0.85 + bass * 0.45 + this.warp * 0.25;
    }

    // HUD readouts: depth marker + index pill
    const total = this.cards.length || 1;
    const distIntoCorridor = Math.max(0, Math.min(1, (Z_BACK_LIMIT - this.camera.position.z) / (Z_BACK_LIMIT - this.corridorEndZ)));
    const idxAprox = Math.min(total, Math.max(0, Math.floor(distIntoCorridor * total)));
    const fillEl = document.getElementById('sc-depth-fill');
    const numEl  = document.getElementById('sc-depth-num');
    if (fillEl) fillEl.style.width = (distIntoCorridor * 100).toFixed(1) + '%';
    if (numEl)  numEl.textContent  = `${String(idxAprox).padStart(3,'0')}/${String(total).padStart(3,'0')}`;
    const tcEl = document.getElementById('sc-tc');
    if (tcEl) tcEl.textContent = `CORR.${String(idxAprox).padStart(3,'0')}`;

    this.composer.render();
  },

  destroy(){
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('pointerup', this._onPointerUp);
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
            if (m.uniforms?.uTex?.value) m.uniforms.uTex.value.dispose?.();
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
    this.beam = null;
    this.motes = null;
    this.walls = [];
    this.cards = [];
    this.hovered = null;
    this.focused = null;
    this.hudEl = null;
    this.jumpEl = null;
    this.container = null;
  },
};

window.SignalCorridor = SignalCorridor;
