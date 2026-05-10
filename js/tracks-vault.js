/* =========================================================
   TRACKS-VAULT.JS — /tracks WebGL catalog spire (b147)
   ---------------------------------------------------------
   v2 changes (b147):
   - Continuous scroll: panels wrap modulo total helix height,
     so scrolling cycles through the whole catalog forever.
   - Per-track hues: every panel gets its own hue via golden-ratio
     walk, no more 3-color tier monotone. Tier still readable
     through saturation/lightness + corner badge.
   - Living environment: nebula skybox (fbm purple/magenta/cyan),
     multi-layer audio-reactive core beam (4 stacked translucent
     cylinders + traveling light pulses), 3 wireframe orbital
     rings tilted around the spire, 22 drifting fresnel shards,
     denser dust, audio analyser drives bloom + core intensity.
   - Random shuffle of slot order so panels feel mixed, not
     sequential.
   ========================================================= */

import * as THREE from 'three';
import { EffectComposer }   from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }       from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }  from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass }       from 'three/addons/postprocessing/ShaderPass.js';

const PANEL_VERT = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PANEL_FRAG = `
  uniform sampler2D uTex;
  uniform float uTime;
  uniform float uHover;
  uniform float uFocus;
  uniform float uVis;
  uniform float uPlaying;
  uniform float uAudio;
  uniform vec3  uTint;
  varying vec2 vUv;
  float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 hsv2rgb(vec3 c){
    vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
    return c.z * mix(vec3(1.0), rgb, c.y);
  }
  void main(){
    vec2 uv = vUv;
    float gAmt = 0.14 + uHover * 0.40 + uFocus * 0.32 + uPlaying * (0.22 + uAudio * 0.30);

    float strips = 32.0;
    float blockY = floor(uv.y * strips) / strips;
    float blockSeed = rand(vec2(blockY * 4.31, floor(uTime * 9.0)));
    float dispActive = step(1.0 - 0.16 * gAmt, blockSeed);
    float disp = (rand(vec2(blockY, floor(uTime * 7.0))) - 0.5) * 0.05 * gAmt;
    uv.x += disp * dispActive;

    float ca = 0.0010 + 0.005 * gAmt;
    float r = texture2D(uTex, uv + vec2(ca, 0.0)).r;
    float gC = texture2D(uTex, uv).g;
    float b = texture2D(uTex, uv - vec2(ca, 0.0)).b;
    float a = texture2D(uTex, uv).a;
    vec3 col = vec3(r, gC, b);

    col *= 0.95 + 0.05 * sin(uv.y * 540.0);

    // Iridescent edge frame — hue shifts along the rim + over time so each panel
    // glimmers with its own rolling color when light catches it.
    float edge = max(
      smoothstep(0.96, 1.00, abs(uv.x - 0.5) * 2.0),
      smoothstep(0.96, 1.00, abs(uv.y - 0.5) * 2.0)
    );
    float edgeHue = fract(uTime * 0.08 + uv.x * 0.55 + uv.y * 0.40);
    vec3 iridescent = hsv2rgb(vec3(edgeHue, 0.55, 1.0));
    vec3 frame = mix(iridescent, uTint, 0.45);
    col = mix(col, frame * (0.55 + uHover * 0.85 + uFocus * 0.55 + uPlaying * (0.45 + uAudio * 0.6)), edge);

    // Tint the panel face (less aggressive than before — preserve readability of the canvas)
    col *= mix(vec3(1.0), uTint, 0.55);

    float pulse = 0.5 + 0.5 * sin(uTime * 4.0);
    col += uTint * (uHover * 0.08 + uFocus * 0.06 + uPlaying * (0.14 + uAudio * 0.22)) * pulse;

    a *= (0.95 + uHover * 0.05) * uVis;
    gl_FragColor = vec4(col, a);
  }
`;

const POST_FRAG = `
  uniform sampler2D tDiffuse;
  uniform float uTime;
  uniform vec2  uResolution;
  uniform float uCAOn;
  uniform float uCAAmt;
  uniform float uFlaresOn;
  uniform float uGradeOn;
  uniform float uScanOn;
  uniform float uGrainOn;
  uniform float uVignetteOn;
  varying vec2 vUv;
  float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec2 uv = vUv;
    vec2 dir = uv - 0.5;

    // Radial CA (sells lens-feel without smearing detail)
    float ca = uCAAmt * uCAOn;
    float r = texture2D(tDiffuse, uv - dir * ca).r;
    float g = texture2D(tDiffuse, uv).g;
    float b = texture2D(tDiffuse, uv + dir * ca).b;
    vec3 col = vec3(r, g, b);

    // Anamorphic horizontal streak — wide soft taps, only adds light, never replaces.
    if (uFlaresOn > 0.5) {
      vec3 streak = vec3(0.0);
      streak += texture2D(tDiffuse, uv + vec2(-0.014, 0.0)).rgb * 0.8;
      streak += texture2D(tDiffuse, uv + vec2(-0.007, 0.0)).rgb * 1.0;
      streak += texture2D(tDiffuse, uv + vec2( 0.007, 0.0)).rgb * 1.0;
      streak += texture2D(tDiffuse, uv + vec2( 0.014, 0.0)).rgb * 0.8;
      streak += texture2D(tDiffuse, uv + vec2( 0.024, 0.0)).rgb * 0.5;
      streak += texture2D(tDiffuse, uv + vec2(-0.024, 0.0)).rgb * 0.5;
      vec3 hi = max(streak / 4.6 - 0.35, vec3(0.0));
      col += hi * vec3(0.9, 0.95, 1.0) * 0.18;
    }

    // Cinematic split-tone color grade: cool shadows, warm highlights
    if (uGradeOn > 0.5) {
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 shadowTint    = vec3(0.86, 0.94, 1.16);
      vec3 highlightTint = vec3(1.12, 1.00, 0.85);
      col *= mix(shadowTint, highlightTint, smoothstep(0.0, 0.65, lum));
      vec3 gray = vec3(dot(col, vec3(0.299, 0.587, 0.114)));
      col = mix(gray, col, 1.12);
    }

    // Subtle scanlines
    if (uScanOn > 0.5) {
      col *= 0.97 + 0.03 * sin(uv.y * uResolution.y * 1.6);
    }

    // Film grain — animated, breaks up gradient banding
    if (uGrainOn > 0.5) {
      col += (rand(uv + fract(uTime * 0.8)) - 0.5) * 0.035;
    }

    // Cinematic vignette
    if (uVignetteOn > 0.5) {
      col *= smoothstep(1.45, 0.45, length(dir) * 1.42);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

const NEBULA_FRAG = `
  uniform float uTime;
  varying vec3 vWorld;
  float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float noise(vec3 p){
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash(i + vec3(0,0,0));
    float n100 = hash(i + vec3(1,0,0));
    float n010 = hash(i + vec3(0,1,0));
    float n110 = hash(i + vec3(1,1,0));
    float n001 = hash(i + vec3(0,0,1));
    float n101 = hash(i + vec3(1,0,1));
    float n011 = hash(i + vec3(0,1,1));
    float n111 = hash(i + vec3(1,1,1));
    float n00 = mix(n000, n100, f.x);
    float n10 = mix(n010, n110, f.x);
    float n01 = mix(n001, n101, f.x);
    float n11 = mix(n011, n111, f.x);
    return mix(mix(n00, n10, f.y), mix(n01, n11, f.y), f.z);
  }
  float fbm(vec3 p){
    float v = 0.0;
    float amp = 0.55;
    for(int i = 0; i < 5; i++){
      v += amp * noise(p);
      p *= 2.05;
      amp *= 0.55;
    }
    return v;
  }
  void main(){
    vec3 dir = normalize(vWorld);
    float n = fbm(dir * 1.6 + vec3(uTime * 0.012, uTime * 0.008, 0.0));
    float n2 = fbm(dir * 4.0 - vec3(0.0, uTime * 0.014, uTime * 0.010));
    // Higher floor on the cloud lift so the void stays mostly dark — the nebula
    // should be a *backdrop*, not a wash-light over the foreground.
    float clouds = pow(0.5 + 0.5 * (n - 0.62) * 1.4, 1.5);
    clouds = clamp(clouds, 0.0, 1.0);

    // Cool, deep palette — indigo / teal / dim cyan, with magenta only as a rare accent.
    vec3 c1 = vec3(0.012, 0.012, 0.030);   // void
    vec3 c2 = vec3(0.060, 0.085, 0.190);   // deep indigo
    vec3 c3 = vec3(0.110, 0.200, 0.320);   // teal
    vec3 c4 = vec3(0.300, 0.110, 0.260);   // muted magenta accent
    vec3 c5 = vec3(0.020, 0.025, 0.060);   // navy

    vec3 col = mix(c1, c2, smoothstep(0.0, 0.55, clouds));
    col = mix(col, c3, smoothstep(0.55, 0.95, clouds) * 0.55);
    col = mix(col, c4, n2 * 0.18);
    col = mix(col, c5, smoothstep(0.55, 1.0, abs(dir.y)) * 0.55);

    float starN = noise(dir * 90.0 + vec3(uTime * 0.001));
    float stars = pow(starN, 38.0) * 6.0;
    col += vec3(0.92, 0.94, 1.0) * stars;

    // Final gain — keep nebula muted enough to not wash, lifted enough to not
    // band. Tiny noise dither hides quantization on cheap displays.
    col *= 0.72;
    col += (noise(dir * 320.0 + vec3(uTime * 0.05)) - 0.5) * 0.012;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const NEBULA_VERT = `
  varying vec3 vWorld;
  void main(){
    vWorld = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SHARD_VERT = `
  varying vec3 vNormal;
  varying vec3 vView;
  void main(){
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const SHARD_FRAG = `
  uniform vec3 uTint;
  varying vec3 vNormal;
  varying vec3 vView;
  void main(){
    float fres = pow(1.0 - max(0.0, dot(normalize(vNormal), normalize(vView))), 2.4);
    vec3 base = mix(vec3(0.04, 0.04, 0.08), uTint, 0.35);
    vec3 col = mix(base, uTint * 1.25, fres);
    col += vec3(0.7, 0.75, 1.0) * pow(fres, 4.0) * 0.45;
    float a = 0.42 + fres * 0.5;
    gl_FragColor = vec4(col, a);
  }
`;

const CORE_VERT = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CORE_FRAG = `
  uniform float uTime;
  uniform float uAudio;
  uniform vec3  uTintA;
  uniform vec3  uTintB;
  varying vec2 vUv;
  float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    // Multi-frequency flowing energy pattern — replaces the flat sine bands
    // that were showing as ugly cylinder seams. 3 layered sine bands at very
    // different frequencies + a slight uv.x dependence to disguise the seam.
    float n1 = sin(vUv.y * 80.0  - uTime * (3.0 + uAudio * 2.5));
    float n2 = sin(vUv.y * 200.0 + uTime * 1.7) * 0.55;
    float n3 = sin(vUv.y * 16.0  + uTime * 0.6 + vUv.x * 14.0) * 0.40;
    float band = 0.5 + 0.5 * (n1 + n2 + n3) * 0.40;
    float v = 0.46 + band * 0.40;
    vec3 col = mix(uTintA, uTintB, v);

    // Tiny dither so the gradient doesn't band on cheap displays
    col += (rand(vUv * 600.0 + uTime) - 0.5) * 0.025;

    float pulse = 1.0 + uAudio * 1.0;
    float a = (0.46 + 0.20 * sin(uTime * 0.6 + vUv.y * 30.0)) * pulse;
    gl_FragColor = vec4(col * pulse, a);
  }
`;

function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function tierOf(track) {
  if (track.isFeatured) return 'featured';
  if (track.isNew)      return 'new';
  return 'archive';
}

// Per-track unique hue via golden-ratio walk through the slot index.
// Tier modulates saturation + lightness so featured/new still pop while
// every track gets its own personality color.
const PHI = 0.6180339887;
function paletteForSlot(slotIdx, tier) {
  const hue = (slotIdx * PHI) % 1;
  let s, l;
  if (tier === 'featured')      { s = 0.85; l = 0.66; }
  else if (tier === 'new')      { s = 0.78; l = 0.62; }
  else                          { s = 0.62; l = 0.58; }
  return { hue, sat: s, lit: l, rgb: hslToRgb(hue, s, l) };
}

function slugifyLocal(s) {
  return (s || '').toString().toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-');
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const HELIX = {
  radius: 13,
  yStep: 1.6,
  panelsPerTurn: 6,
  panelW: 4.4,
  panelH: 2.6,
  camRadius: 21,
};

const TracksVault = {
  scene: null, camera: null, renderer: null, composer: null, postPass: null, bloom: null,
  clock: null, raf: 0,
  panels: [], shards: [], pulses: [], rings: [], glints: [],
  hovered: null, focused: null,
  ray: null, mouse: null,
  cam: null, drag: null,
  hudEl: null, destroyed: false,
  ctx: null,
  filter: 'all', query: '',
  totalH: 100, halfH: 50,
  scroll: 0,
  starfield: null, dust: null, nebula: null, energyStream: null,
  coreLayers: [], backGlows: [],
  audio: null, audioCtx: null, analyser: null, freqArr: null,
  bass: 0, energy: 0,
  // Admin state
  adminEl: null, _adminTime: 0,
  _paused: false, _timeScale: 1,
  _hudHidden: false,
  _autoYawOn: true, _autoScrollOn: true, _inertiaOn: true, _bassRotateOn: false,
  _density: 117,

  init(container, ctx) {
    if (this.renderer) return;
    this.destroyed = false;
    this.panels = []; this.shards = []; this.pulses = []; this.rings = []; this.glints = []; this.coreLayers = []; this.backGlows = [];
    this.hovered = null; this.focused = null;
    this.ctx = ctx || {};
    this.audio = ctx?.audio || null;
    this.filter = ctx?.filter || 'all';
    this.query  = (ctx?.query || '').toLowerCase();
    this.mouse = { x: 0.5, y: 0.5, ndc: new THREE.Vector2(0, 0) };
    this.cam = { yaw: 0 };
    this.drag = { active: false, lx: 0, ly: 0, totalPx: 0 };
    this.scroll = 0;
    this.bass = 0; this.energy = 0;

    const canvas = document.createElement('canvas');
    canvas.className = 'tv-canvas';
    container.appendChild(canvas);

    this.hudEl = this._buildHud();
    container.appendChild(this.hudEl);
    this.adminEl = this._buildAdminPanel();
    container.appendChild(this.adminEl);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setClearColor(0x040406, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05070b, 0.009);

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 460);

    this._buildEnvironment();
    this._buildPanels();
    this._buildTagIndex();
    this._buildShards();
    this._buildPulses();
    this._setupComposer();

    this.clock = new THREE.Clock();
    this.ray = new THREE.Raycaster();

    this._onResize       = this._onResize.bind(this);
    this._onMove         = this._onMove.bind(this);
    this._onPointerDown  = this._onPointerDown.bind(this);
    this._onPointerUp    = this._onPointerUp.bind(this);
    this._onWheel        = this._onWheel.bind(this);
    this._onKey          = this._onKey.bind(this);
    window.addEventListener('resize', this._onResize);
    canvas.addEventListener('pointermove', this._onMove);
    canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);
    canvas.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('keydown', this._onKey);

    this._onResize();
    this._applyVisibility(true);
    this._updateHudHeader();
    this.onTrackChange();
    this.animate = this.animate.bind(this);
    this.animate();
  },

  /* ---------- Environment ---------- */
  _buildEnvironment() {
    // Nebula skybox — big inverted sphere, fbm clouds + starbursts
    const nebGeo = new THREE.SphereGeometry(220, 48, 32);
    const nebMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
      side: THREE.BackSide, depthWrite: false,
    });
    this.nebula = new THREE.Mesh(nebGeo, nebMat);
    this.scene.add(this.nebula);

    // Foreground starfield (closer than nebula, brighter twinkles)
    const N = 600;
    const starPos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 70 + Math.random() * 50;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      starPos[i*3]   = r * Math.sin(ph) * Math.cos(th);
      starPos[i*3+1] = r * Math.cos(ph) * 0.7;
      starPos[i*3+2] = r * Math.sin(ph) * Math.sin(th);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPxr: { value: this.renderer.getPixelRatio() } },
      vertexShader: `
        uniform float uPxr;
        varying float vSeed;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float dist = length(mv.xyz);
          vSeed = position.x * 0.13 + position.y * 0.07 + position.z * 0.09;
          gl_PointSize = uPxr * (90.0 / max(dist, 1.0));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying float vSeed;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          float a = smoothstep(0.5, 0.0, r);
          float tw = 0.55 + 0.45 * sin(uTime * 0.8 + vSeed * 4.0);
          gl_FragColor = vec4(vec3(0.85, 0.88, 1.0) * tw, a * 0.75);
        }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.starfield = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starfield);

    // Multi-layer core beam — bumped opacities + smaller inner radii so the
    // bloom pass gets enough signal to flare the column, hiding cylinder seams.
    // Color stays cool (white core, cyan, muted purple) — no pink-wash.
    const coreSpecs = [
      { r: 0.06, opacity: 0.95, a: [0.95, 0.98, 1.00], b: [0.80, 0.92, 1.00] },  // bright white core
      { r: 0.18, opacity: 0.55, a: [0.55, 0.80, 1.00], b: [0.90, 0.95, 1.00] },  // cool blue → white
      { r: 0.46, opacity: 0.32, a: [0.25, 0.55, 0.92], b: [0.65, 0.32, 0.78] },  // cyan → soft magenta
      { r: 1.10, opacity: 0.16, a: [0.18, 0.40, 0.72], b: [0.50, 0.20, 0.58] },  // outer halo
    ];
    coreSpecs.forEach(spec => {
      const geo = new THREE.CylinderGeometry(spec.r, spec.r, 280, 24, 1, true);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uAudio: { value: 0 },
          uTintA: { value: new THREE.Vector3(...spec.a) },
          uTintB: { value: new THREE.Vector3(...spec.b) },
        },
        vertexShader: CORE_VERT,
        fragmentShader: CORE_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        opacity: spec.opacity,
      });
      const m = new THREE.Mesh(geo, mat);
      this.scene.add(m);
      this.coreLayers.push(m);
    });

    // Saturn-style horizontal ring — single dim torus, almost flat to the
    // helix axis, blooms softly. Replaces the b148 wireframe-line tris that
    // showed as ugly diagonal lasers across the FOV.
    {
      const ringGeo = new THREE.TorusGeometry(28, 0.20, 10, 220);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.55, 0.40, 0.95),
        transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2 + 0.05;
      ring.userData = { rate: 0.04 };
      this.scene.add(ring);
      this.rings.push(ring);
    }
    {
      const ringGeo = new THREE.TorusGeometry(36, 0.14, 10, 220);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.30, 0.70, 1.0),
        transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2 - 0.06;
      ring.userData = { rate: -0.03 };
      this.scene.add(ring);
      this.rings.push(ring);
    }

    // Energy stream — vertical particle column flowing UP the spire axis,
    // wrapping at top/bottom. Sells "data flowing through the core" — beam
    // stops looking 2D once you can see particles streaming through it.
    this._buildEnergyStream();

    // Dense dust motes drifting in the spire volume
    const Nd = 700;
    const dpos = new Float32Array(Nd * 3);
    for (let i = 0; i < Nd; i++) {
      const r = 2 + Math.random() * 26;
      const th = Math.random() * Math.PI * 2;
      dpos[i*3]   = Math.cos(th) * r;
      dpos[i*3+1] = (Math.random() - 0.5) * 90;
      dpos[i*3+2] = Math.sin(th) * r;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    const dustMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPxr: { value: this.renderer.getPixelRatio() } },
      vertexShader: `
        uniform float uTime;
        uniform float uPxr;
        varying float vAlpha;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * 0.10 + position.y * 0.4) * 0.6;
          p.z += cos(uTime * 0.07 + position.y * 0.3) * 0.5;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float dist = length(mv.xyz);
          vAlpha = smoothstep(60.0, 4.0, dist) * 0.7;
          gl_PointSize = uPxr * (55.0 / max(dist, 1.0));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          float a = smoothstep(0.5, 0.0, r);
          gl_FragColor = vec4(vec3(0.95, 0.85, 1.0), a * vAlpha);
        }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.dust = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dust);

    // Soft back-glow sprites
    const mkGlow = (rgba, x, y, z, sx, sy, opacity) => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const cx = c.getContext('2d');
      const g = cx.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, rgba);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = g; cx.fillRect(0, 0, 256, 256);
      const tex = new THREE.CanvasTexture(c);
      tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity });
      const s = new THREE.Sprite(mat);
      s.scale.set(sx, sy, 1);
      s.position.set(x, y, z);
      this.scene.add(s);
      this.backGlows.push(s);
    };
    // Pulled-back back-glows so they never out-shine the foreground.
    mkGlow('rgba(110, 130, 200, 0.50)', 0,  20, -55, 160, 110, 0.22);
    mkGlow('rgba(80, 160, 200, 0.40)',  0, -40, -55, 140, 110, 0.18);
    mkGlow('rgba(180, 90, 160, 0.35)',  0,  60, -55, 100,  80, 0.12);

    // Twinkle glints — small bright sprites scattered through the spire volume
    // that pulse on/off. Reads like light catching on glass — the user asked for
    // "glimmers of color or light" and these are the cheapest satisfying answer.
    this._buildGlints();
  },

  _buildEnergyStream() {
    const N = 280;
    const positions = new Float32Array(N * 3);
    const seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const r = Math.random() * 0.85;
      const th = Math.random() * Math.PI * 2;
      positions[i*3]   = Math.cos(th) * r;
      positions[i*3+1] = (Math.random() - 0.5) * 200;
      positions[i*3+2] = Math.sin(th) * r;
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPxr:  { value: this.renderer.getPixelRatio() },
        uAudio: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uPxr;
        uniform float uAudio;
        attribute float seed;
        varying float vAlpha;
        varying float vSeed;
        void main(){
          vec3 p = position;
          float speed = 9.0 + seed * 14.0 + uAudio * 18.0;
          p.y = mod(p.y + uTime * speed + 100.0, 200.0) - 100.0;
          // small radial wobble for organic flow
          p.x += sin(uTime * 1.5 + seed * 7.0) * 0.18;
          p.z += cos(uTime * 1.8 + seed * 5.0) * 0.18;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float dist = length(mv.xyz);
          vSeed = seed;
          vAlpha = (0.55 + uAudio * 0.55) * smoothstep(70.0, 4.0, dist);
          gl_PointSize = uPxr * (50.0 + uAudio * 60.0) / max(dist, 1.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying float vSeed;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          float a = pow(smoothstep(0.5, 0.0, r), 1.7);
          // Per-particle hue: cool whites + occasional warm flecks
          vec3 col;
          if (vSeed < 0.20)      col = vec3(1.00, 0.65, 0.85);   // pink fleck
          else if (vSeed < 0.50) col = vec3(0.65, 0.85, 1.00);   // cool blue
          else                   col = vec3(1.00, 0.95, 0.92);   // warm white
          gl_FragColor = vec4(col, a * vAlpha);
        }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.energyStream = new THREE.Points(geo, mat);
    this.scene.add(this.energyStream);
  },

  _buildGlints() {
    const c = document.createElement('canvas');
    c.width = c.height = 48;
    const cx = c.getContext('2d');
    const g = cx.createRadialGradient(24, 24, 0, 24, 24, 24);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.3, 'rgba(255, 230, 255, 0.65)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    cx.fillStyle = g; cx.fillRect(0, 0, 48, 48);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;

    this.glints = [];
    const N = 36;
    for (let i = 0; i < N; i++) {
      const hue = Math.random();
      const tint = hslToRgb(hue, 0.75, 0.70);
      const rgba = `rgb(${(tint[0]*255)|0}, ${(tint[1]*255)|0}, ${(tint[2]*255)|0})`;
      const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0,
        color: new THREE.Color(rgba),
      });
      const s = new THREE.Sprite(mat);
      const sz = 0.9 + Math.random() * 1.6;
      s.scale.set(sz, sz, 1);
      const r = 10 + Math.random() * 22;
      const th = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 80;
      s.position.set(Math.cos(th) * r, y, Math.sin(th) * r);
      s.userData = {
        baseR: r, baseTh: th, baseY: y,
        period: 3 + Math.random() * 5,
        offset: Math.random() * 10,
        hue,
      };
      this.scene.add(s);
      this.glints.push(s);
    }
  },

  /* ---------- Vertical light pulses traveling along the spire axis ---------- */
  _buildPulses() {
    const N = 8;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const cx = c.getContext('2d');
    const g = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255, 230, 255, 1)');
    g.addColorStop(0.4, 'rgba(255, 120, 220, 0.6)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;

    for (let i = 0; i < N; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 });
      const s = new THREE.Sprite(mat);
      const sz = 0.9 + Math.random() * 1.4;
      s.scale.set(sz, sz, 1);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const speed = 6 + Math.random() * 10;
      const offset = Math.random() * 100 - 50;
      s.position.set(0, offset, 0);
      s.userData = { dir, speed, offset };
      this.scene.add(s);
      this.pulses.push(s);
    }
  },

  /* ---------- Mech-debris shards ---------- */
  _buildShards() {
    const N = 22;
    const geos = [
      new THREE.IcosahedronGeometry(0.6, 0),
      new THREE.OctahedronGeometry(0.55, 0),
      new THREE.TetrahedronGeometry(0.7, 0),
      new THREE.DodecahedronGeometry(0.5, 0),
      new THREE.ConeGeometry(0.4, 1.0, 6, 1),
    ];
    for (let i = 0; i < N; i++) {
      const geo = geos[i % geos.length];
      const hue = (i * 0.27 + 0.5) % 1;
      const tint = hslToRgb(hue, 0.65, 0.62);
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTint: { value: new THREE.Vector3(...tint) } },
        vertexShader: SHARD_VERT,
        fragmentShader: SHARD_FRAG,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(geo, mat);
      const r = 16 + Math.random() * 20;
      const th = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 80;
      m.position.set(Math.cos(th) * r, y, Math.sin(th) * r);
      m.userData = {
        baseR: r, baseTh: th, baseY: y,
        rotV: new THREE.Vector3(
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 0.7,
          (Math.random() - 0.5) * 0.5,
        ),
        orbitV: (Math.random() - 0.5) * 0.06,
        bobAmp: 1.5 + Math.random() * 2.5,
        bobPhase: Math.random() * Math.PI * 2,
        scaleBase: 0.7 + Math.random() * 1.5,
      };
      m.scale.setScalar(m.userData.scaleBase);
      this.scene.add(m);
      this.shards.push(m);
    }
  },

  /* ---------- Panels ---------- */
  _buildPanels() {
    const tracks = this.ctx.tracks || [];
    const N = tracks.length;
    if (!N) return;

    // Build a shuffled slot-to-track mapping. Each slot has a slotIdx which
    // determines its hue (golden-ratio walk over slot order, not track order),
    // so the visual rainbow runs along the helix even though tracks are mixed.
    const slots = tracks.map((track, originalIdx) => ({ track, originalIdx }));
    shuffleInPlace(slots);

    const halfStrand = Math.ceil(slots.length / 2);
    const yStep = HELIX.yStep;
    const angleStep = (Math.PI * 2) / HELIX.panelsPerTurn;
    const topY = (halfStrand - 1) * yStep / 2;
    this.totalH = halfStrand * yStep;
    this.halfH  = this.totalH / 2;

    slots.forEach((slot, slotIdx) => {
      const { track, originalIdx } = slot;
      const strand = slotIdx % 2;
      const k = Math.floor(slotIdx / 2);
      const angle = k * angleStep + (strand === 1 ? Math.PI : 0);
      const y = topY - k * yStep;
      const x = Math.cos(angle) * HELIX.radius;
      const z = Math.sin(angle) * HELIX.radius;
      const pos = new THREE.Vector3(x, y, z);

      const tier = tierOf(track);
      const pal = paletteForSlot(slotIdx, tier);
      const tint = pal.rgb;
      const tex = this._makePanelTexture(track, originalIdx, tier, pal);

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTex:     { value: tex },
          uTime:    { value: Math.random() * 100 },
          uHover:   { value: 0 },
          uFocus:   { value: 0 },
          uVis:     { value: 1 },
          uPlaying: { value: 0 },
          uAudio:   { value: 0 },
          uTint:    { value: new THREE.Vector3(tint[0], tint[1], tint[2]) },
        },
        vertexShader: PANEL_VERT,
        fragmentShader: PANEL_FRAG,
        transparent: true, depthWrite: false, side: THREE.FrontSide,
      });
      // Thin glass slab — sides are now subtle accent glow instead of solid
      // colored plastic. Back is near-black so cards never read as bright bricks.
      const sideMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(tint[0] * 0.5, tint[1] * 0.5, tint[2] * 0.5),
        transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const backMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.05, 0.06, 0.10),
        transparent: true, opacity: 0.85,
        depthWrite: false,
      });
      // BoxGeometry material indices: [+X, -X, +Y, -Y, +Z front, -Z back]
      const matArray = [sideMat, sideMat, sideMat, sideMat, mat, backMat];
      const plane = new THREE.Mesh(new THREE.BoxGeometry(HELIX.panelW, HELIX.panelH, 0.14), matArray);
      plane.position.copy(pos);
      plane.lookAt(pos.x * 2, pos.y, pos.z * 2);

      const haloC = document.createElement('canvas');
      haloC.width = haloC.height = 256;
      const hcx = haloC.getContext('2d');
      const hg = hcx.createRadialGradient(128, 128, 0, 128, 128, 128);
      hg.addColorStop(0, `rgba(${(tint[0]*255)|0},${(tint[1]*255)|0},${(tint[2]*255)|0}, 0.65)`);
      hg.addColorStop(1, 'rgba(0,0,0,0)');
      hcx.fillStyle = hg; hcx.fillRect(0, 0, 256, 256);
      const haloTex = new THREE.CanvasTexture(haloC);
      haloTex.minFilter = THREE.LinearFilter; haloTex.magFilter = THREE.LinearFilter;
      const haloMat = new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.30 });
      const halo = new THREE.Sprite(haloMat);
      halo.scale.set(HELIX.panelW * 1.7, HELIX.panelH * 1.7, 1);
      halo.position.copy(pos);

      this.scene.add(halo);
      this.scene.add(plane);

      this.panels.push({
        mesh: plane, halo, basePos: pos.clone(), tint, hue: pal.hue,
        track, idx: originalIdx, slotIdx, tier, slug: slugifyLocal(track.title),
        glitchUntil: 0, hidden: false,
        angle,        // base angle on the helix (for rendering)
        layerY: y,    // base y on the helix (before scroll wrap)
      });
    });
  },

  _makePanelTexture(track, idx, tier, pal) {
    const W = 720, H = 432;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');

    const accent = `hsl(${(pal.hue * 360) | 0}, ${(pal.sat * 100) | 0}%, ${((pal.lit + 0.10) * 100) | 0}%)`;
    const accentRGB = pal.rgb.map(v => Math.min(255, (v * 255) | 0)).join(',');
    const tierColor = tier === 'featured' ? '#ff7ec3' : tier === 'new' ? '#66ddff' : '#cfd5e0';
    const num = String(idx + 1).padStart(3, '0');

    // ---- Backdrop: dark gradient + faint horizontal scanline grid + decorative left rail ----
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'rgba(2, 3, 6, 0.97)');
    bg.addColorStop(1, 'rgba(8, 10, 16, 0.97)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Faint horizontal scan grid in body (every 4px)
    ctx.fillStyle = 'rgba(255,255,255,0.024)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);

    // Decorative LEFT rail — vertical accent strip with tick marks (data-port look)
    ctx.fillStyle = `rgba(${accentRGB},0.30)`;
    ctx.fillRect(0, 0, 14, H);
    ctx.fillStyle = `rgba(${accentRGB},0.95)`;
    ctx.fillRect(0, 0, 6, H);
    // Tick marks down the rail
    ctx.fillStyle = `rgba(${accentRGB},0.55)`;
    for (let y = 18; y < H - 18; y += 14) ctx.fillRect(14, y, 6, 2);

    // Decorative RIGHT rail — thinner mirror
    ctx.fillStyle = `rgba(${accentRGB},0.40)`;
    ctx.fillRect(W - 4, 0, 4, H);

    // Inner content area frame (sits inset from rails)
    const PAD_L = 32, PAD_R = 28;

    // ---- Top header bar ----
    ctx.fillStyle = `rgba(${accentRGB},0.10)`;
    ctx.fillRect(PAD_L - 4, 18, W - PAD_L - PAD_R + 8, 42);
    ctx.strokeStyle = `rgba(${accentRGB},0.55)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD_L - 4, 18, W - PAD_L - PAD_R + 8, 42);

    // Number left
    ctx.font = '700 24px "Space Mono", monospace';
    ctx.fillStyle = accent;
    ctx.textBaseline = 'top';
    ctx.fillText(`▣ TRK.${num}`, PAD_L + 4, 26);

    // Tier badge right
    ctx.font = '700 16px "Space Mono", monospace';
    const tierText = `[${tier.toUpperCase()}]`;
    ctx.fillStyle = tierColor;
    ctx.textAlign = 'right';
    ctx.fillText(tierText, W - PAD_R - 4, 28);
    ctx.textAlign = 'left';

    // SC indicator — small orange tag under the tier badge, signals the link is wired.
    ctx.font = '700 11px "Space Mono", monospace';
    ctx.fillStyle = '#ff7a3d';
    ctx.textAlign = 'right';
    ctx.fillText('↗ SC', W - PAD_R - 4, 64);
    ctx.textAlign = 'left';

    // ---- Title block (the hero) ----
    const title = (track.title || 'untitled').toLowerCase();
    let size = 96;
    ctx.font = `900 ${size}px "Space Grotesk", system-ui, sans-serif`;
    while (ctx.measureText(title).width > W - 80 && size > 32) {
      size -= 4;
      ctx.font = `900 ${size}px "Space Grotesk", system-ui, sans-serif`;
    }
    const titleY = H/2 - size * 0.55;

    // Underline accent bar (sits under the title)
    ctx.fillStyle = `rgba(${accentRGB},0.65)`;
    ctx.fillRect(PAD_L, titleY + size + 6, 80, 4);
    ctx.fillStyle = `rgba(${accentRGB},0.22)`;
    ctx.fillRect(PAD_L + 92, titleY + size + 7, W - PAD_L - PAD_R - 92, 2);

    // Title text — strong stroke + accent glow + white fill
    ctx.shadowColor = `rgba(${accentRGB},0.95)`;
    ctx.shadowBlur = 32;
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.97)';
    ctx.strokeText(title, PAD_L, titleY);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, PAD_L, titleY);

    // ---- Meta row (year · tag, with decorative dots) ----
    const year = track.date ? new Date(track.date).getFullYear() : '—';
    const tag  = (track.tags && track.tags[0]) ? track.tags[0].toUpperCase() : '';
    ctx.font = '600 20px "Space Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText(`${year}` + (tag ? `  ·  ${tag}` : ''), PAD_L, H - 96);

    // Faux waveform / data-trace at right of meta row — sells "audio data"
    const waveX = W - PAD_R - 200;
    const waveY = H - 88;
    ctx.strokeStyle = `rgba(${accentRGB},0.85)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let waveSeed = (idx * 13.7) % 100;
    for (let i = 0; i < 60; i++) {
      const x = waveX + i * 3;
      const h = 6 + (Math.sin(i * 0.6 + waveSeed) * 0.5 + 0.5) * 14
               + (Math.sin(i * 1.7 + waveSeed * 0.4) * 0.5 + 0.5) * 4;
      ctx.moveTo(x, waveY - h/2);
      ctx.lineTo(x, waveY + h/2);
    }
    ctx.stroke();

    // ---- Bottom action stripe ----
    const stripeH = 56;
    ctx.fillStyle = `rgba(${accentRGB},0.16)`;
    ctx.fillRect(0, H - stripeH, W, stripeH);
    // Accent bar at top of stripe
    ctx.fillStyle = `rgba(${accentRGB},0.85)`;
    ctx.fillRect(0, H - stripeH, W, 2);

    // PLAY label + LED indicators
    ctx.fillStyle = accent;
    ctx.font = '700 18px "Space Mono", monospace';
    ctx.fillText('▶ HOVER · CLICK · PLAY', PAD_L, H - 36);

    // 3 blinking-LED dots on the right
    const ledY = H - 28;
    [0, 1, 2].forEach(i => {
      const ledX = W - PAD_R - 8 - i * 16;
      const on = (idx + i) % 3 === 0;
      ctx.fillStyle = on ? accent : `rgba(${accentRGB},0.25)`;
      ctx.beginPath();
      ctx.arc(ledX, ledY, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // ---- Corner brackets ----
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    const bs = 24;
    [[16,16,1,1],[W-16,16,-1,1],[16,H-16,1,-1],[W-16,H-16,-1,-1]].forEach(([x,y,sx,sy])=>{
      ctx.beginPath();
      ctx.moveTo(x, y + bs * sy);
      ctx.lineTo(x, y);
      ctx.lineTo(x + bs * sx, y);
      ctx.stroke();
    });

    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  },

  /* ---------- HUD ---------- */
  _buildHud() {
    const root = document.createElement('div');
    root.className = 'tv-hud';
    const totalTracks = (this.ctx.tracks || []).length;
    const filters = ['all','featured','new','hard','chill','grunge','vibe'];
    root.innerHTML = `
      <div class="tv-tl">
        <div class="tv-kicker">— archive index — <span class="tv-acc">KANI</span> · CANTMUTE.ME</div>
        <div class="tv-title" id="tv-title">the catalog.</div>
        <div class="tv-meta" id="tv-meta">${totalTracks} signals · drag to scan · scroll forever</div>
        <div class="tv-search">
          <span class="tv-search-prefix">SEARCH ▸</span>
          <input id="tv-search-input" type="text" autocomplete="off" spellcheck="false" placeholder="title…" />
        </div>
      </div>
      <div class="tv-tr">
        <div class="tv-mark">cantmute.me</div>
        <div class="tv-meta">drag · scroll · click</div>
        <div class="tv-nav">
          <a href="/">← galaxy</a>
          <a href="/scenes">scenes</a>
          <button type="button" class="tv-admin-link" data-act="admin">[ admin ]</button>
        </div>
        <div class="tv-shuffle-hint">
          <kbd>SPACE</kbd> play  <kbd>R</kbd> shuffle  <kbd>←</kbd><kbd>→</kbd> jump
        </div>
      </div>
      <div class="tv-bl">
        <div class="tv-hint" id="tv-hint">— scan the spire —</div>
      </div>
      <div class="tv-br">
        <div class="tv-chips" id="tv-chips">
          ${filters.map(f => `<button class="tv-chip ${f === this.filter ? 'on' : ''}" data-filter="${f}">${f}</button>`).join('')}
          <button class="tv-chip" data-act="shuffle" title="random track (R)">⤬ shuffle</button>
        </div>
      </div>
      <div class="tv-focus" id="tv-focus" style="display:none">
        <div class="tv-focus-num" id="tv-focus-num"></div>
        <div class="tv-focus-title" id="tv-focus-title"></div>
        <div class="tv-focus-body" id="tv-focus-body"></div>
        <div class="tv-focus-actions">
          <button class="tv-act" id="tv-focus-play">▸ play</button>
          <a class="tv-act tv-act-sc" id="tv-focus-sc" href="#" target="_blank" rel="noopener" title="open on SoundCloud">
            <svg class="tv-sc-glyph" viewBox="0 0 26 14" aria-hidden="true">
              <g fill="currentColor">
                <rect x="0"  y="6" width="1.6" height="6"/>
                <rect x="2.4" y="4" width="1.6" height="9"/>
                <rect x="4.8" y="2" width="1.6" height="11"/>
                <rect x="7.2" y="1" width="1.6" height="12"/>
                <path d="M11 1.5c.5-.4 1.2-.6 1.9-.5.6.1 1.2.5 1.5 1.1.4-.2.9-.3 1.4-.2.6.1 1.2.5 1.5 1.1.5-.4 1.2-.6 1.9-.4 1 .2 1.7 1 1.8 2 2 .1 3.6 1.7 3.6 3.7s-1.7 3.7-3.7 3.7H11V1.5z"/>
              </g>
            </svg>
            <span>soundcloud</span>
          </a>
          <a class="tv-act tv-act-dim" id="tv-focus-details" href="#">details</a>
          <button class="tv-act tv-act-dim" id="tv-focus-share">share</button>
          <button class="tv-act tv-act-dim" data-act="release">close</button>
        </div>
      </div>
      <div class="tv-now" id="tv-now">
        <div class="tv-now-meta">
          <span class="tv-now-num" id="tv-now-num">— · —</span>
          <span class="tv-now-title" id="tv-now-title" title="focus the playing track">▸ no signal</span>
          <span class="tv-now-tags" id="tv-now-tags"></span>
        </div>
        <div class="tv-now-bar">
          <button class="tv-now-btn" data-act="prev" title="previous (←)">⏮</button>
          <button class="tv-now-btn is-play" data-act="play" id="tv-now-play" title="play / pause (space)">▶</button>
          <button class="tv-now-btn" data-act="next" title="next (→)">⏭</button>
          <button class="tv-now-btn" data-act="shuffle" title="random (R)">⤬</button>
          <div class="tv-now-progress" id="tv-now-progress" title="click to seek">
            <div class="tv-now-progress-track">
              <div class="tv-now-fill" id="tv-now-fill"></div>
            </div>
            <div class="tv-now-knob" id="tv-now-knob"></div>
          </div>
          <span class="tv-now-time" id="tv-now-time">0:00 / 0:00</span>
          <a class="tv-now-btn is-sc" data-act="sc" id="tv-now-sc" href="#" target="_blank" rel="noopener" title="open on SoundCloud">
            <svg class="tv-sc-glyph" viewBox="0 0 26 14" aria-hidden="true">
              <g fill="currentColor">
                <rect x="0"  y="6" width="1.6" height="6"/>
                <rect x="2.4" y="4" width="1.6" height="9"/>
                <rect x="4.8" y="2" width="1.6" height="11"/>
                <rect x="7.2" y="1" width="1.6" height="12"/>
                <path d="M11 1.5c.5-.4 1.2-.6 1.9-.5.6.1 1.2.5 1.5 1.1.4-.2.9-.3 1.4-.2.6.1 1.2.5 1.5 1.1.5-.4 1.2-.6 1.9-.4 1 .2 1.7 1 1.8 2 2 .1 3.6 1.7 3.6 3.7s-1.7 3.7-3.7 3.7H11V1.5z"/>
              </g>
            </svg>
          </a>
        </div>
      </div>
    `;
    root.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const f = btn.dataset.filter;
        this.setFilter(f);
        const path = location.pathname;
        if (f === 'new' && path !== '/tracks/new') history.pushState(null, '', '/tracks/new');
        else if ((f === 'all' || (f !== 'new' && f !== 'featured')) && path !== '/tracks') {
          history.pushState(null, '', '/tracks');
        }
      });
    });
    const search = root.querySelector('#tv-search-input');
    if (search) {
      search.value = this.query || '';
      search.addEventListener('input', e => {
        e.stopPropagation();
        this.setQuery(e.target.value);
      });
      search.addEventListener('keydown', e => e.stopPropagation());
    }
    root.querySelectorAll('[data-act="release"]').forEach(b => {
      b.addEventListener('click', e => { e.stopPropagation(); this._release(); });
    });
    root.querySelectorAll('[data-act="admin"]').forEach(b => {
      b.addEventListener('click', e => { e.stopPropagation(); this._toggleAdmin(); });
    });
    root.querySelectorAll('[data-act="shuffle"]').forEach(b => {
      b.addEventListener('click', e => { e.stopPropagation(); this._shuffle(); });
    });
    root.querySelectorAll('[data-act="prev"]').forEach(b => {
      b.addEventListener('click', e => { e.stopPropagation(); this.ctx.onPrev && this.ctx.onPrev(); });
    });
    root.querySelectorAll('[data-act="next"]').forEach(b => {
      b.addEventListener('click', e => { e.stopPropagation(); this.ctx.onNext && this.ctx.onNext(); });
    });
    root.querySelectorAll('[data-act="play"]').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        if (this.ctx.onTogglePlay) this.ctx.onTogglePlay();
        if (this.audioCtx?.state === 'suspended') this.audioCtx.resume().catch(()=>{});
      });
    });
    const titleNow = root.querySelector('#tv-now-title');
    if (titleNow) titleNow.addEventListener('click', e => {
      e.stopPropagation();
      const cur = (this.ctx.getCurrent && this.ctx.getCurrent()) ?? -1;
      if (cur < 0) return;
      const p = this.panels.find(pp => pp.idx === cur);
      if (p) this._focus(p);
    });
    const prog = root.querySelector('#tv-now-progress');
    if (prog) {
      const seekFromEvent = (e) => {
        const r = prog.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0]?.clientX) || 0) - r.left;
        const pct = Math.max(0, Math.min(1, x / r.width));
        if (this.ctx.onSeek) this.ctx.onSeek(pct);
      };
      prog.addEventListener('click', e => { e.stopPropagation(); seekFromEvent(e); });
      prog.addEventListener('pointerdown', e => {
        e.stopPropagation();
        prog.setPointerCapture?.(e.pointerId);
        seekFromEvent(e);
        const move = (ev) => seekFromEvent(ev);
        const up   = () => {
          prog.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        prog.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });
    }
    return root;
  },

  _updateHudHeader() {
    const titleEl = document.getElementById('tv-title');
    if (!titleEl) return;
    if (this.focused) {
      titleEl.textContent = (this.focused.track.title || '').toLowerCase() + '.';
    } else {
      const cur = (this.ctx.getCurrent && this.ctx.getCurrent()) ?? -1;
      const tracks = this.ctx.tracks || [];
      if (cur >= 0 && tracks[cur]) {
        titleEl.textContent = tracks[cur].title.toLowerCase() + '.';
      } else {
        titleEl.textContent = 'the catalog.';
      }
    }
    const metaEl = document.getElementById('tv-meta');
    if (metaEl) {
      const visible = this.panels.filter(p => !p.hidden).length;
      const total = this.panels.length;
      metaEl.textContent = (visible === total)
        ? `${total} signals · drag to scan · scroll forever`
        : `${visible} / ${total} signals · ${this.filter !== 'all' ? this.filter : 'search'}`;
    }
  },

  /* ---------- Filter / search ---------- */
  setFilter(name) {
    this.filter = name || 'all';
    if (this.hudEl) {
      this.hudEl.querySelectorAll('[data-filter]').forEach(btn => {
        btn.classList.toggle('on', btn.dataset.filter === this.filter);
      });
    }
    this._applyVisibility();
    this._updateHudHeader();
  },

  setQuery(q) {
    this.query = (q || '').toLowerCase();
    this._applyVisibility();
    this._updateHudHeader();
  },

  _matchesFilter(p) {
    const t = p.track;
    if (this.filter === 'featured' && !t.isFeatured) return false;
    if (this.filter === 'new'      && !t.isNew)      return false;
    if (this.filter !== 'all' && this.filter !== 'featured' && this.filter !== 'new') {
      const tags = (t.tags || []).map(x => String(x).toLowerCase());
      if (!tags.includes(this.filter)) return false;
    }
    if (this.query && !(t.title || '').toLowerCase().includes(this.query)) return false;
    return true;
  },

  _applyVisibility(initial = false) {
    this.panels.forEach(p => {
      const want = this._matchesFilter(p) && !p.densityHidden;
      p.hidden = !want;
      if (initial) {
        const u = this._panelUniforms(p);
        if (u) u.uVis.value = want ? 1 : 0;
        p.halo.material.opacity = want ? 0.30 : 0;
      }
    });
  },

  /* ---------- Audio analyser ---------- */
  _ensureAnalyser() {
    if (this.analyser || !this.audio) return;
    if (this.audio.__floorAnalyser) {
      this.audioCtx = this.audio.__floorAnalyser.ctx;
      this.analyser = this.audio.__floorAnalyser.analyser;
      this.freqArr  = this.audio.__floorAnalyser.freqArr;
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AC();
      const src = this.audioCtx.createMediaElementSource(this.audio);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.85;
      src.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      this.freqArr = new Uint8Array(this.analyser.frequencyBinCount);
      this.audio.__floorAnalyser = { ctx: this.audioCtx, source: src, analyser: this.analyser, freqArr: this.freqArr };
    } catch (e) { /* ignore — analyser is optional */ }
  },

  _readAudio() {
    if (!this.analyser || !this.freqArr) return;
    if (this.audioCtx?.state === 'suspended') { try { this.audioCtx.resume(); } catch (e) {} }
    this.analyser.getByteFrequencyData(this.freqArr);
    let bass = 0, sum = 0;
    for (let i = 0; i < 8; i++) bass += this.freqArr[i] || 0;
    bass /= 8 * 255;
    for (let i = 0; i < this.freqArr.length; i++) sum += this.freqArr[i] || 0;
    const energy = sum / (this.freqArr.length * 255);
    // Smooth a bit so it doesn't strobe
    this.bass   += (bass - this.bass)     * 0.35;
    this.energy += (energy - this.energy) * 0.25;
  },

  /* ---------- Composer ---------- */
  _setupComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Bloom rebalanced — enough flare to hide cylinder banding + sell highlights,
    // not enough to wash the foreground. Threshold gates dark areas.
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.60, 0.70, 0.16);
    bloom.threshold = 0.16;
    bloom.strength  = 0.60;
    bloom.radius    = 0.70;
    this.bloom = bloom;
    this.composer.addPass(bloom);
    this.postPass = new ShaderPass({
      uniforms: {
        tDiffuse:    { value: null },
        uTime:       { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uCAOn:       { value: 1 },
        uCAAmt:      { value: 0.0014 },
        uFlaresOn:   { value: 1 },
        uGradeOn:    { value: 1 },
        uScanOn:     { value: 1 },
        uGrainOn:    { value: 1 },
        uVignetteOn: { value: 1 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: POST_FRAG,
    });
    this.composer.addPass(this.postPass);
  },

  /* ---------- Input ---------- */
  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.postPass) this.postPass.uniforms.uResolution.value.set(w, h);
  },

  _onMove(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) / r.width;
    this.mouse.y = (e.clientY - r.top)  / r.height;
    this.mouse.ndc.set(this.mouse.x * 2 - 1, -(this.mouse.y * 2 - 1));
    if (this.drag.active) {
      const dx = e.clientX - this.drag.lx;
      const dy = e.clientY - this.drag.ly;
      this.drag.totalPx += Math.abs(dx) + Math.abs(dy);
      this.cam.yaw -= dx * 0.0040;
      // Drag DOWN scrolls the spire DOWN past us (panels move up). Continuous, no clamp.
      this.scroll -= dy * 0.060;
      this.drag.lx = e.clientX;
      this.drag.ly = e.clientY;
    } else {
      this._raycast();
    }
  },

  _onPointerDown(e) {
    if (e.target !== this.renderer.domElement) return;
    this.drag.active = true;
    this.drag.lx = e.clientX; this.drag.ly = e.clientY;
    this.drag.totalPx = 0;
  },

  _onPointerUp(e) {
    if (!this.drag.active) return;
    this.drag.active = false;
    if (this.drag.totalPx < 6) {
      if (this.focused) { this._release(); return; }
      if (this.hovered) this._focus(this.hovered);
    }
  },

  _onWheel(e) {
    e.preventDefault();
    this.scroll += e.deltaY * 0.025;   // wheel down = descend (panels move up = scroll positive)
  },

  _onKey(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === '`' || e.key === '~') { e.preventDefault(); this._toggleAdmin(); return; }
    if (e.key === 'Escape' && this.focused) { this._release(); return; }
    if (e.code === 'Space') {
      e.preventDefault();
      if (this.ctx.onTogglePlay) this.ctx.onTogglePlay();
      if (this.audioCtx?.state === 'suspended') this.audioCtx.resume().catch(()=>{});
      return;
    }
    if (e.key === 'r' || e.key === 'R') { this._shuffle(); return; }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); this._focusByOffset(-1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); this._focusByOffset(+1); return; }
    if (e.key === 's' || e.key === 'S') {
      const panel = this.focused || this.panels.find(p => p.idx === ((this.ctx.getCurrent && this.ctx.getCurrent()) ?? -1));
      if (!panel) return;
      const url = `${location.origin}/t/${panel.slug}`;
      if (this.ctx.onCopy) this.ctx.onCopy(url);
      if (this.ctx.onToast) this.ctx.onToast('link copied');
    }
  },

  _raycast() {
    if (this.focused) return;
    this.ray.setFromCamera(this.mouse.ndc, this.camera);
    const visMeshes = this.panels.filter(p => !p.hidden).map(p => p.mesh);
    const hits = this.ray.intersectObjects(visMeshes, false);
    const next = hits.length ? this.panels.find(p => p.mesh === hits[0].object) : null;
    if (next === this.hovered) return;
    this.hovered = next;
    const hint = document.getElementById('tv-hint');
    if (hint) hint.textContent = next
      ? `→ ${(next.track.title || '').toUpperCase()}  ·  TRACK ${String(next.idx+1).padStart(3,'0')} / ${this.panels.length}`
      : '— scan the spire —';
    document.body.style.cursor = next ? 'pointer' : '';
  },

  _focus(panel) {
    this.focused = panel;
    document.body.style.cursor = '';
    const f       = document.getElementById('tv-focus');
    const numEl   = document.getElementById('tv-focus-num');
    const titleEl = document.getElementById('tv-focus-title');
    const bodyEl  = document.getElementById('tv-focus-body');
    const playEl  = document.getElementById('tv-focus-play');
    const detEl   = document.getElementById('tv-focus-details');
    const shareEl = document.getElementById('tv-focus-share');
    const scEl    = document.getElementById('tv-focus-sc');
    if (numEl)   numEl.textContent = `▣ TRACK ${String(panel.idx+1).padStart(3,'0')} / ${this.panels.length}  ·  ${panel.tier.toUpperCase()}`;
    if (titleEl) titleEl.textContent = (panel.track.title || '').toLowerCase();
    if (bodyEl) {
      const year = panel.track.date ? new Date(panel.track.date).getFullYear() : '—';
      const tags = (panel.track.tags || []).join(' · ');
      bodyEl.textContent = `${year}${tags ? '  ·  ' + tags : ''}`;
    }
    if (detEl)  detEl.href = `/t/${panel.slug}`;
    if (scEl)   scEl.href  = this._scUrlFor(panel.track);
    if (playEl) {
      playEl.onclick = (e) => {
        e.stopPropagation();
        if (this.ctx.onPlay) this.ctx.onPlay(panel.idx);
        // Resume audio context for analyser if it was suspended
        if (this.audioCtx?.state === 'suspended') this.audioCtx.resume().catch(()=>{});
        else this._ensureAnalyser();
      };
    }
    if (shareEl) shareEl.onclick = (e) => {
      e.stopPropagation();
      const url = `${location.origin}/t/${panel.slug}`;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          shareEl.textContent = 'copied';
          setTimeout(() => { shareEl.textContent = 'share'; }, 1100);
        }).catch(() => {});
      }
    };
    if (f) {
      f.style.display = '';
      requestAnimationFrame(() => f.classList.add('on'));
    }
    this._updateHudHeader();
  },

  _scUrlFor(track) {
    const explicit = track && track.links && (track.links.soundcloud || track.links.sc);
    if (explicit) return explicit;
    if (this.ctx?.scUrl) return this.ctx.scUrl(track?.title || '');
    const slug = (track?.title || '').toString().toLowerCase()
      .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
    return `https://soundcloud.com/kanisongs/${slug}`;
  },

  _shuffle() {
    const visible = this.panels.filter(p => !p.hidden);
    if (!visible.length) return;
    const cur = (this.ctx?.getCurrent && this.ctx.getCurrent()) ?? -1;
    let pick = visible[Math.floor(Math.random() * visible.length)];
    // avoid re-picking the same currently-playing track if we have alternatives
    if (visible.length > 1 && pick.idx === cur) {
      pick = visible[(visible.indexOf(pick) + 1) % visible.length];
    }
    if (this.ctx.onPlay) this.ctx.onPlay(pick.idx);
    this._focus(pick);
    if (this.audioCtx?.state === 'suspended') this.audioCtx.resume().catch(()=>{});
  },

  _focusByOffset(offset) {
    const visible = this.panels.filter(p => !p.hidden);
    if (!visible.length) return;
    let i = 0;
    if (this.focused) {
      i = visible.indexOf(this.focused);
      if (i < 0) i = 0;
    } else {
      const cur = (this.ctx?.getCurrent && this.ctx.getCurrent()) ?? -1;
      const ix = visible.findIndex(p => p.idx === cur);
      if (ix >= 0) i = ix;
    }
    const next = visible[((i + offset) % visible.length + visible.length) % visible.length];
    this._focus(next);
  },

  _release() {
    this.focused = null;
    const f = document.getElementById('tv-focus');
    if (f) {
      f.classList.remove('on');
      setTimeout(() => { if (!this.focused && f) f.style.display = 'none'; }, 350);
    }
    this._updateHudHeader();
  },

  /* ---------- Admin panel ---------- */
  _toggleAdmin() {
    if (!this.adminEl) return;
    const open = this.adminEl.classList.toggle('on');
    this.adminEl.style.display = open ? 'flex' : 'none';
    if (open && this._adminUpdateState) this._adminUpdateState();
  },

  _buildAdminPanel() {
    const root = document.createElement('div');
    root.className = 'tv-admin';
    root.style.display = 'none';
    root.innerHTML = `
      <div class="tv-admin-head">
        <span class="tv-admin-brand">vault · admin</span>
        <button class="tv-admin-x" data-act="close" aria-label="Close">×</button>
      </div>
      <div class="tv-admin-search">
        <span>FILTER ▸</span>
        <input id="tv-admin-q" type="text" autocomplete="off" spellcheck="false" placeholder="filter actions…" />
      </div>
      <div class="tv-admin-section" data-cat="preset" data-key="preset">
        <div class="tv-admin-label">presets</div>
        <button data-act="preset-default">default</button>
        <button data-act="preset-minimal">minimal</button>
        <button data-act="preset-cinematic">cinematic</button>
        <button data-act="preset-photo">photo · clean</button>
        <button data-act="preset-party">party · saturated</button>
      </div>
      <div class="tv-admin-section" data-cat="event" data-key="event">
        <div class="tv-admin-label">vault events <span class="tv-admin-soon">soon</span></div>
        <button disabled>decryption sweep</button>
        <button disabled>data courier drone</button>
        <button disabled>archive flythrough</button>
        <button disabled>panel surge</button>
        <button disabled>catalog index highlight</button>
        <button disabled>tier rainbow</button>
        <button disabled>discovery beacon</button>
        <button disabled>stack collapse</button>
        <button disabled>glitch storm</button>
        <button disabled>track aura · scene-tint to playing</button>
        <div class="tv-admin-hint">events ship next pass — wiring shell first</div>
      </div>
      <div class="tv-admin-section" data-cat="event" data-key="micro">
        <div class="tv-admin-label">micro fx <span class="tv-admin-soon">soon</span></div>
        <button disabled>meteor</button>
        <button disabled>pulsar</button>
        <button disabled>comm scrap</button>
        <button disabled>emp flash</button>
        <button disabled>bit drift on a panel</button>
        <button disabled>shelf rumble</button>
      </div>
      <div class="tv-admin-section" data-cat="camera" data-key="camera">
        <div class="tv-admin-label">camera</div>
        <button data-act="cam-reset">reset camera</button>
        <button data-act="cam-random">🎲 hop to random panel</button>
        <button data-act="cam-prev">◀ prev panel</button>
        <button data-act="cam-next">next panel ▶</button>
        <button data-act="cam-release">release focus</button>
        <div class="tv-admin-row">
          <span class="tv-admin-rowlabel">FOV</span>
          <input type="range" id="tv-fov-slider" min="40" max="100" step="1" value="70" />
          <span class="tv-admin-rowval" id="tv-fov-val">70°</span>
        </div>
        <button data-act="cam-fov-down">FOV −5°</button>
        <button data-act="cam-fov-up">FOV +5°</button>
        <button data-act="cam-fov-reset">FOV reset (70°)</button>
      </div>
      <div class="tv-admin-section" data-cat="feel" data-key="feel">
        <div class="tv-admin-label">feel · motion</div>
        <button data-act="feel-yaw"     id="tv-feel-yaw">auto-yaw drift: <span>ON</span></button>
        <button data-act="feel-scroll"  id="tv-feel-scroll">auto-scroll: <span>ON</span></button>
        <button data-act="feel-inertia" id="tv-feel-inertia">drag inertia: <span>ON</span></button>
        <button data-act="feel-bassrot" id="tv-feel-bassrot">bass-rotate panels: <span>OFF</span></button>
        <div class="tv-admin-row">
          <span class="tv-admin-rowlabel">descent</span>
          <input type="range" id="tv-scroll-slider" min="-180" max="180" step="0.5" value="0" />
          <span class="tv-admin-rowval" id="tv-scroll-val">0.0</span>
        </div>
      </div>
      <div class="tv-admin-section" data-cat="helix" data-key="helix">
        <div class="tv-admin-label">helix</div>
        <button data-act="helix-shuffle">↻ reshuffle slot order</button>
        <button data-act="helix-density-117" id="tv-density-117">density: 117 <span></span></button>
        <button data-act="helix-density-60"  id="tv-density-60">density: 60 <span></span></button>
        <button data-act="helix-density-30"  id="tv-density-30">density: 30 <span></span></button>
        <button data-act="helix-density-feat" id="tv-density-feat">density: featured only <span></span></button>
        <div class="tv-admin-hint" id="tv-helix-info"></div>
      </div>
      <div class="tv-admin-section" data-cat="filter" data-key="filter">
        <div class="tv-admin-label">filter · tier</div>
        <button data-act="filt-all"      id="tv-filt-all">all</button>
        <button data-act="filt-featured" id="tv-filt-featured">featured</button>
        <button data-act="filt-new"      id="tv-filt-new">new</button>
        <button data-act="filt-hard"     id="tv-filt-hard">hard</button>
        <button data-act="filt-chill"    id="tv-filt-chill">chill</button>
        <button data-act="filt-grunge"   id="tv-filt-grunge">grunge</button>
        <button data-act="filt-vibe"     id="tv-filt-vibe">vibe</button>
      </div>
      <div class="tv-admin-section" data-cat="elements" data-key="elements">
        <div class="tv-admin-label">scene elements</div>
        <div class="tv-admin-row tv-admin-master">
          <button data-act="el-all-on">all on</button>
          <button data-act="el-all-off">all off</button>
        </div>
        <button data-act="el-nebula"     id="tv-el-nebula">nebula skybox: <span>ON</span></button>
        <button data-act="el-stars"      id="tv-el-stars">foreground starfield: <span>ON</span></button>
        <button data-act="el-energy"     id="tv-el-energy">energy stream: <span>ON</span></button>
        <button data-act="el-dust"       id="tv-el-dust">dust motes: <span>ON</span></button>
        <button data-act="el-glints"     id="tv-el-glints">glints: <span>ON</span></button>
        <button data-act="el-shards"     id="tv-el-shards">debris shards: <span>ON</span></button>
        <button data-act="el-pulses"     id="tv-el-pulses">core pulses: <span>ON</span></button>
        <button data-act="el-rings"      id="tv-el-rings">saturn rings: <span>ON</span></button>
        <button data-act="el-glows"      id="tv-el-glows">back-glow sprites: <span>ON</span></button>
        <button data-act="el-panels"     id="tv-el-panels">helix panels: <span>ON</span></button>
        <button data-act="el-core"       id="tv-el-core">core beam (master): <span>ON</span></button>
        <button data-act="el-core-0"     id="tv-el-core-0">core · inner white: <span>ON</span></button>
        <button data-act="el-core-1"     id="tv-el-core-1">core · blue layer: <span>ON</span></button>
        <button data-act="el-core-2"     id="tv-el-core-2">core · cyan layer: <span>ON</span></button>
        <button data-act="el-core-3"     id="tv-el-core-3">core · outer halo: <span>ON</span></button>
      </div>
      <div class="tv-admin-section" data-cat="fx" data-key="fx">
        <div class="tv-admin-label">post fx</div>
        <button data-act="fx-bloom"    id="tv-fx-bloom">bloom: <span>ON</span></button>
        <div class="tv-admin-row">
          <span class="tv-admin-rowlabel">bloom strength</span>
          <input type="range" id="tv-bloom-slider" min="0" max="2.5" step="0.05" value="0.6" />
          <span class="tv-admin-rowval" id="tv-bloom-val">0.60</span>
        </div>
        <button data-act="fx-ca"       id="tv-fx-ca">chromatic aberration: <span>ON</span></button>
        <div class="tv-admin-row">
          <span class="tv-admin-rowlabel">CA amount</span>
          <input type="range" id="tv-ca-slider" min="0" max="0.012" step="0.0002" value="0.0014" />
          <span class="tv-admin-rowval" id="tv-ca-val">0.0014</span>
        </div>
        <button data-act="fx-flares"   id="tv-fx-flares">anamorphic flares: <span>ON</span></button>
        <button data-act="fx-grade"    id="tv-fx-grade">color grade: <span>ON</span></button>
        <button data-act="fx-scan"     id="tv-fx-scan">scanlines: <span>ON</span></button>
        <button data-act="fx-grain"    id="tv-fx-grain">film grain: <span>ON</span></button>
        <button data-act="fx-vignette" id="tv-fx-vignette">vignette: <span>ON</span></button>
      </div>
      <div class="tv-admin-section" data-cat="time" data-key="time">
        <div class="tv-admin-label">time</div>
        <button data-act="time-pause" id="tv-time-pause">⏸ pause</button>
        <button data-act="time-0.25" id="tv-time-0.25">0.25×</button>
        <button data-act="time-0.5"  id="tv-time-0.5">0.5×</button>
        <button data-act="time-1"    id="tv-time-1">1× (normal)</button>
        <button data-act="time-2"    id="tv-time-2">2×</button>
      </div>
      <div class="tv-admin-section" data-cat="capture" data-key="capture">
        <div class="tv-admin-label">capture</div>
        <button data-act="cap-png">📸 save canvas as PNG</button>
        <button data-act="cap-hud" id="tv-cap-hud">hide HUD: <span>OFF</span></button>
        <button data-act="cap-random">🎲 hop to random panel</button>
      </div>
      <div class="tv-admin-section" data-cat="stage" data-key="stage">
        <div class="tv-admin-label">stage</div>
        <button data-act="stage-clear">clear all events</button>
        <button data-act="stage-resetfocus">reset focus</button>
        <button data-act="stage-resetfilter">reset filter (= all)</button>
        <button data-act="stage-resetcam">reset camera</button>
      </div>
      <div class="tv-admin-foot">~ to toggle · build <span id="tv-admin-build"></span></div>
    `;

    // Wiring
    root.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn || btn.disabled) return;
      e.stopPropagation();
      const act = btn.dataset.act;
      try { this._adminDispatch(act); }
      catch (err) { console.warn('[tv-admin]', act, err); }
    });

    // Sliders
    root.addEventListener('input', e => {
      const t = e.target;
      if (!t || t.tagName !== 'INPUT') return;
      if (t.id === 'tv-fov-slider')    this._adminSetFov(parseFloat(t.value));
      if (t.id === 'tv-bloom-slider')  this._adminSetBloom(parseFloat(t.value));
      if (t.id === 'tv-ca-slider')     this._adminSetCA(parseFloat(t.value));
      if (t.id === 'tv-scroll-slider') { this.scroll = parseFloat(t.value); this._adminUpdateState(); }
    });
    // Search filter — hides any button whose label doesn't include the query.
    const q = root.querySelector('#tv-admin-q');
    if (q) {
      q.addEventListener('input', e => {
        const v = e.target.value.trim().toLowerCase();
        root.querySelectorAll('.tv-admin-section').forEach(sec => {
          let visible = 0;
          sec.querySelectorAll('button[data-act]:not(.tv-admin-x)').forEach(b => {
            const txt = b.textContent.toLowerCase();
            const match = !v || txt.includes(v);
            b.style.display = match ? '' : 'none';
            if (match) visible++;
          });
          sec.classList.toggle('tv-admin-empty', visible === 0 && !!v);
        });
      });
      q.addEventListener('keydown', e => e.stopPropagation());
    }

    const buildSpan = root.querySelector('#tv-admin-build');
    if (buildSpan) buildSpan.textContent = (window.BUILD_NUMBER || '');

    this._adminUpdateState = () => this._adminRefreshLabels(root);
    this._adminUpdateState();
    this._adminInitCollapse(root);
    return root;
  },

  _adminInitCollapse(root) {
    const STORAGE = 'tv-admin-collapse-v1';
    let state = {};
    try { state = JSON.parse(localStorage.getItem(STORAGE) || '{}') || {}; } catch (_) { state = {}; }
    root.querySelectorAll('.tv-admin-section').forEach(sec => {
      const key = sec.dataset.key;
      if (!key) return;
      const label = sec.querySelector('.tv-admin-label');
      if (!label) return;
      const body = document.createElement('div');
      body.className = 'tv-admin-body';
      while (label.nextSibling) body.appendChild(label.nextSibling);
      sec.appendChild(body);
      label.classList.add('tv-collapsible');
      const setOpen = (open) => {
        sec.classList.toggle('tv-collapsed', !open);
        body.classList.toggle('is-hidden', !open);
      };
      // Default open for control sections, collapsed for "soon" event sections
      const defaultOpen = (key === 'event' || key === 'micro') ? false : true;
      setOpen(state[key] ?? defaultOpen);
      label.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = !sec.classList.contains('tv-collapsed');
        setOpen(!isOpen);
        state[key] = !isOpen;
        try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch (_) {}
      });
    });
  },

  _adminDispatch(act) {
    if (!act) return;
    if (act === 'close') return this._toggleAdmin();
    // Presets
    if (act === 'preset-default')   return this._adminApplyPreset('default');
    if (act === 'preset-minimal')   return this._adminApplyPreset('minimal');
    if (act === 'preset-cinematic') return this._adminApplyPreset('cinematic');
    if (act === 'preset-photo')     return this._adminApplyPreset('photo');
    if (act === 'preset-party')     return this._adminApplyPreset('party');
    // Camera
    if (act === 'cam-reset')      { this.cam.yaw = 0; this.scroll = 0; this._adminUpdateState(); return; }
    if (act === 'cam-random')     return this._shuffle();
    if (act === 'cam-prev')       return this._focusByOffset(-1);
    if (act === 'cam-next')       return this._focusByOffset(+1);
    if (act === 'cam-release')    return this._release();
    if (act === 'cam-fov-down')   return this._adminSetFov(this.camera.fov - 5);
    if (act === 'cam-fov-up')     return this._adminSetFov(this.camera.fov + 5);
    if (act === 'cam-fov-reset')  return this._adminSetFov(70);
    // Feel
    if (act === 'feel-yaw')      { this._autoYawOn = !this._autoYawOn; this._adminUpdateState(); return; }
    if (act === 'feel-scroll')   { this._autoScrollOn = !this._autoScrollOn; this._adminUpdateState(); return; }
    if (act === 'feel-inertia')  { this._inertiaOn = !this._inertiaOn; this._adminUpdateState(); return; }
    if (act === 'feel-bassrot')  { this._bassRotateOn = !this._bassRotateOn; this._adminUpdateState(); return; }
    // Helix
    if (act === 'helix-shuffle')  return this._adminReshuffleSlots();
    if (act && act.startsWith('helix-density-')) return this._adminSetDensity(act.slice('helix-density-'.length));
    // Filter
    if (act && act.startsWith('filt-')) {
      this.setFilter(act.slice('filt-'.length));
      this._adminUpdateState();
      return;
    }
    // Elements
    if (act === 'el-all-on')      return this._adminAllElements(true);
    if (act === 'el-all-off')     return this._adminAllElements(false);
    if (act && act.startsWith('el-core-')) {
      const i = parseInt(act.slice('el-core-'.length), 10);
      if (this.coreLayers[i]) this.coreLayers[i].visible = !this.coreLayers[i].visible;
      this._adminUpdateState();
      return;
    }
    if (act && act.startsWith('el-')) return this._adminToggleElement(act.slice(3));
    // FX
    if (act === 'fx-bloom')    { if (this.bloom) this.bloom.enabled = !this.bloom.enabled; this._adminUpdateState(); return; }
    if (act === 'fx-ca')       return this._adminToggleFx('uCAOn');
    if (act === 'fx-flares')   return this._adminToggleFx('uFlaresOn');
    if (act === 'fx-grade')    return this._adminToggleFx('uGradeOn');
    if (act === 'fx-scan')     return this._adminToggleFx('uScanOn');
    if (act === 'fx-grain')    return this._adminToggleFx('uGrainOn');
    if (act === 'fx-vignette') return this._adminToggleFx('uVignetteOn');
    // Time
    if (act === 'time-pause')  { this._paused = !this._paused; this._adminUpdateState(); return; }
    if (act && act.startsWith('time-')) {
      this._timeScale = parseFloat(act.slice(5));
      this._paused = false;
      this._adminUpdateState();
      return;
    }
    // Capture
    if (act === 'cap-png')    return this._adminSavePng();
    if (act === 'cap-hud')    { this._hudHidden = !this._hudHidden; if (this.hudEl) this.hudEl.style.visibility = this._hudHidden ? 'hidden' : 'visible'; this._adminUpdateState(); return; }
    if (act === 'cap-random') return this._shuffle();
    // Stage
    if (act === 'stage-clear')        { /* events not implemented yet */ return; }
    if (act === 'stage-resetfocus')   return this._release();
    if (act === 'stage-resetfilter')  { this.setFilter('all'); this.setQuery(''); const inp = document.getElementById('tv-search-input'); if (inp) inp.value = ''; this._adminUpdateState(); return; }
    if (act === 'stage-resetcam')     { this.cam.yaw = 0; this.scroll = 0; this._adminSetFov(70); this._adminUpdateState(); return; }
  },

  _adminToggleElement(key) {
    const map = {
      nebula: () => this.nebula,
      stars:  () => this.starfield,
      energy: () => this.energyStream,
      dust:   () => this.dust,
      glints: () => this.glints,        // array of sprites
      shards: () => this.shards,        // array of meshes
      pulses: () => this.pulses,        // array of sprites
      rings:  () => this.rings,         // array of meshes
      glows:  () => this.backGlows,     // array of sprites
      panels: () => this.panels.map(p => p.mesh).concat(this.panels.map(p => p.halo)),
      core:   () => this.coreLayers,    // array of meshes
    };
    const get = map[key];
    if (!get) return;
    const target = get();
    if (!target) return;
    if (Array.isArray(target)) {
      const cur = target.length > 0 && target[0].visible;
      target.forEach(t => { if (t) t.visible = !cur; });
    } else {
      target.visible = !target.visible;
    }
    this._adminUpdateState();
  },

  _adminAllElements(on) {
    [this.nebula, this.starfield, this.energyStream, this.dust].forEach(o => { if (o) o.visible = on; });
    [this.glints, this.shards, this.pulses, this.rings, this.backGlows, this.coreLayers].forEach(arr => {
      if (Array.isArray(arr)) arr.forEach(o => { if (o) o.visible = on; });
    });
    this.panels.forEach(p => { if (p.mesh) p.mesh.visible = on; if (p.halo) p.halo.visible = on; });
    this._adminUpdateState();
  },

  _adminToggleFx(name) {
    const u = this.postPass && this.postPass.uniforms[name];
    if (!u) return;
    u.value = u.value > 0.5 ? 0 : 1;
    this._adminUpdateState();
  },

  _adminSetFov(v) {
    const fov = Math.max(30, Math.min(120, v));
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this._adminUpdateState();
  },

  _adminSetBloom(v) {
    if (!this.bloom) return;
    this.bloom._adminBase = v;
    // The animate loop overrides strength every frame; stash a base override.
    this.bloom.strength = v;
    this._adminUpdateState();
  },

  _adminSetCA(v) {
    const u = this.postPass && this.postPass.uniforms.uCAAmt;
    if (u) u.value = v;
    this._adminUpdateState();
  },

  _adminReshuffleSlots() {
    // Re-pick layerY for each panel by reshuffling slot order, keeping helix structure.
    const N = this.panels.length;
    if (!N) return;
    const order = this.panels.map((_, i) => i);
    shuffleInPlace(order);
    const halfStrand = Math.ceil(N / 2);
    this.panels.forEach((p, i) => {
      const slotIdx = order[i];
      const strand  = slotIdx % 2;
      const turn    = Math.floor(slotIdx / 2);
      const angle   = (turn / HELIX.panelsPerTurn) * Math.PI * 2 + (strand ? Math.PI : 0);
      const y       = -turn * HELIX.yStep + halfStrand * HELIX.yStep * 0.5;
      p.layerY = y;
      p.basePos.set(Math.cos(angle) * HELIX.radius, y, Math.sin(angle) * HELIX.radius);
    });
  },

  _adminSetDensity(key) {
    this._density = key;
    const featuredOnly = (key === 'feat');
    const cap = featuredOnly ? Infinity : parseInt(key, 10);
    this.panels.forEach((p, i) => {
      let want;
      if (featuredOnly) want = !!p.track.isFeatured;
      else              want = i < cap;
      p.densityHidden = !want;
    });
    this.panels.forEach(p => {
      const matchesFilter = this._matchesFilter(p);
      p.hidden = !matchesFilter || p.densityHidden;
    });
    this._adminUpdateState();
  },

  _adminSavePng() {
    try {
      const w = this.renderer.domElement;
      const url = w.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `tracks-vault-${(window.BUILD_NUMBER || 'b000')}-${Date.now()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { console.warn('[tv-admin] PNG save failed', e); }
  },

  _adminApplyPreset(name) {
    const u = this.postPass && this.postPass.uniforms;
    const setVis = (target, vis) => {
      if (!target) return;
      if (Array.isArray(target)) target.forEach(t => { if (t) t.visible = vis; });
      else target.visible = vis;
    };
    // Reset to a known baseline
    if (u) {
      u.uCAOn.value = 1; u.uFlaresOn.value = 1; u.uGradeOn.value = 1;
      u.uScanOn.value = 1; u.uGrainOn.value = 1; u.uVignetteOn.value = 1;
      u.uCAAmt.value = 0.0014;
    }
    if (this.bloom) { this.bloom.enabled = true; this.bloom.strength = 0.60; this.bloom._adminBase = 0.60; }
    if (this.camera) { this.camera.fov = 70; this.camera.updateProjectionMatrix(); }
    setVis(this.nebula, true); setVis(this.starfield, true); setVis(this.energyStream, true);
    setVis(this.dust, true); setVis(this.glints, true); setVis(this.shards, true);
    setVis(this.pulses, true); setVis(this.rings, true); setVis(this.backGlows, true);
    setVis(this.coreLayers, true);
    this.panels.forEach(p => { if (p.mesh) p.mesh.visible = true; if (p.halo) p.halo.visible = true; });
    this._timeScale = 1; this._paused = false;

    if (name === 'minimal') {
      // Strip everything ambient. Just panels + core beam + dust.
      setVis(this.nebula, false); setVis(this.starfield, false);
      setVis(this.glints, false); setVis(this.shards, false); setVis(this.pulses, false);
      setVis(this.rings, false); setVis(this.backGlows, false);
      if (u) { u.uFlaresOn.value = 0; u.uGradeOn.value = 0; u.uScanOn.value = 0; u.uGrainOn.value = 0; }
      if (this.bloom) { this.bloom.strength = 0.30; this.bloom._adminBase = 0.30; }
    } else if (name === 'cinematic') {
      if (this.bloom) { this.bloom.strength = 1.10; this.bloom._adminBase = 1.10; }
      if (u) u.uCAAmt.value = 0.0028;
      this._timeScale = 0.5;
    } else if (name === 'photo') {
      if (u) { u.uGrainOn.value = 0; u.uScanOn.value = 0; u.uCAAmt.value = 0.0006; }
      if (this.bloom) { this.bloom.strength = 0.45; this.bloom._adminBase = 0.45; }
      this._hudHidden = true; if (this.hudEl) this.hudEl.style.visibility = 'hidden';
    } else if (name === 'party') {
      if (u) u.uCAAmt.value = 0.0048;
      if (this.bloom) { this.bloom.strength = 1.45; this.bloom._adminBase = 1.45; }
      this._timeScale = 1.5;
    } else {
      this._hudHidden = false; if (this.hudEl) this.hudEl.style.visibility = 'visible';
    }
    this._adminUpdateState();
  },

  _adminRefreshLabels(root) {
    const setOn = (id, on) => {
      const el = root.querySelector('#' + id);
      if (!el) return;
      const sp = el.querySelector('span');
      if (sp) sp.textContent = on ? 'ON' : 'OFF';
      el.classList.toggle('tv-on', !!on);
    };
    // Feel
    setOn('tv-feel-yaw', this._autoYawOn);
    setOn('tv-feel-scroll', this._autoScrollOn);
    setOn('tv-feel-inertia', this._inertiaOn);
    setOn('tv-feel-bassrot', this._bassRotateOn);
    // Capture
    setOn('tv-cap-hud', this._hudHidden);
    // Pause label
    const pauseBtn = root.querySelector('#tv-time-pause');
    if (pauseBtn) {
      pauseBtn.textContent = this._paused ? '▶ resume' : '⏸ pause';
      pauseBtn.classList.toggle('tv-on', !!this._paused);
    }
    // Time scale highlight
    ['tv-time-0.25','tv-time-0.5','tv-time-1','tv-time-2'].forEach(id => {
      const el = root.querySelector('#' + id);
      if (!el) return;
      const v = parseFloat(id.slice('tv-time-'.length));
      el.classList.toggle('tv-on', !this._paused && Math.abs(v - (this._timeScale ?? 1)) < 0.001);
    });
    // Density highlight
    ['117','60','30','feat'].forEach(k => {
      const el = root.querySelector('#tv-density-' + k);
      if (el) el.classList.toggle('tv-on', this._density == k);
    });
    // Filter highlight
    ['all','featured','new','hard','chill','grunge','vibe'].forEach(f => {
      const el = root.querySelector('#tv-filt-' + f);
      if (el) el.classList.toggle('tv-on', this.filter === f);
    });
    // Elements
    const visOf = (target) => {
      if (!target) return false;
      if (Array.isArray(target)) return target.length > 0 && target[0].visible;
      return target.visible;
    };
    setOn('tv-el-nebula', visOf(this.nebula));
    setOn('tv-el-stars',  visOf(this.starfield));
    setOn('tv-el-energy', visOf(this.energyStream));
    setOn('tv-el-dust',   visOf(this.dust));
    setOn('tv-el-glints', visOf(this.glints));
    setOn('tv-el-shards', visOf(this.shards));
    setOn('tv-el-pulses', visOf(this.pulses));
    setOn('tv-el-rings',  visOf(this.rings));
    setOn('tv-el-glows',  visOf(this.backGlows));
    setOn('tv-el-panels', this.panels.length > 0 && this.panels[0].mesh.visible);
    setOn('tv-el-core',   visOf(this.coreLayers));
    for (let i = 0; i < 4; i++) setOn('tv-el-core-' + i, this.coreLayers[i] && this.coreLayers[i].visible);
    // FX
    const u = this.postPass && this.postPass.uniforms;
    if (u) {
      setOn('tv-fx-ca',       u.uCAOn.value > 0.5);
      setOn('tv-fx-flares',   u.uFlaresOn.value > 0.5);
      setOn('tv-fx-grade',    u.uGradeOn.value > 0.5);
      setOn('tv-fx-scan',     u.uScanOn.value > 0.5);
      setOn('tv-fx-grain',    u.uGrainOn.value > 0.5);
      setOn('tv-fx-vignette', u.uVignetteOn.value > 0.5);
      const caSlider = root.querySelector('#tv-ca-slider');
      const caVal    = root.querySelector('#tv-ca-val');
      if (caSlider) caSlider.value = u.uCAAmt.value;
      if (caVal)    caVal.textContent = u.uCAAmt.value.toFixed(4);
    }
    setOn('tv-fx-bloom', this.bloom ? this.bloom.enabled : false);
    const bSlider = root.querySelector('#tv-bloom-slider');
    const bVal    = root.querySelector('#tv-bloom-val');
    if (this.bloom && bSlider) bSlider.value = this.bloom.strength;
    if (this.bloom && bVal)    bVal.textContent = this.bloom.strength.toFixed(2);
    // FOV slider
    const fovSlider = root.querySelector('#tv-fov-slider');
    const fovVal    = root.querySelector('#tv-fov-val');
    if (this.camera && fovSlider) fovSlider.value = this.camera.fov;
    if (this.camera && fovVal)    fovVal.textContent = Math.round(this.camera.fov) + '°';
    // Scroll slider
    const scSlider = root.querySelector('#tv-scroll-slider');
    const scVal    = root.querySelector('#tv-scroll-val');
    if (scSlider) scSlider.value = this.scroll || 0;
    if (scVal)    scVal.textContent = (this.scroll || 0).toFixed(1);
    // Helix info
    const info = root.querySelector('#tv-helix-info');
    if (info) {
      const visible = this.panels.filter(p => !p.hidden).length;
      info.textContent = `${visible} / ${this.panels.length} panels visible · density ${this._density}`;
    }
  },

  /* ---------- Track-change hook ---------- */
  onTrackChange() {
    const cur = (this.ctx?.getCurrent && this.ctx.getCurrent()) ?? -1;
    this.panels.forEach(p => {
      const u = this._panelUniforms(p);
      if (u) u.uPlaying.value = (p.idx === cur) ? 1 : 0;
    });
    this.playingPanel = this.panels.find(p => p.idx === cur) || null;
    this._rebuildConstellation();
    this._ensureAnalyser();
    if (this.audioCtx?.state === 'suspended') this.audioCtx.resume().catch(()=>{});
    this._updateHudHeader();
  },

  // Helper: panel material is an array (BoxGeometry) — front face is index 4,
  // which is the only face running the holographic shader.
  _panelUniforms(p) {
    const m = p.mesh.material;
    if (Array.isArray(m)) return m[4]?.uniforms || null;
    return m?.uniforms || null;
  },

  /* ---------- Tag-constellation: lines from the playing panel to its tag-siblings ---------- */
  _buildTagIndex() {
    this._tagIndex = new Map();
    this.panels.forEach(p => {
      (p.track.tags || []).forEach(tagRaw => {
        const tag = String(tagRaw).toLowerCase();
        if (!this._tagIndex.has(tag)) this._tagIndex.set(tag, new Set());
        this._tagIndex.get(tag).add(p);
      });
    });
    this.constellationGroup = new THREE.Group();
    this.constellationGroup.frustumCulled = false;
    this.scene.add(this.constellationGroup);
    this.constellationLines = [];   // {line, peer, phase}
    this.playingPanel = null;
  },

  _rebuildConstellation() {
    // Wipe existing
    if (!this.constellationGroup) return;
    this.constellationLines.forEach(({ line }) => {
      this.constellationGroup.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    });
    this.constellationLines = [];

    const pp = this.playingPanel;
    if (!pp) return;

    // Tag-based peers (excluding self)
    const tags = (pp.track.tags || []).map(s => String(s).toLowerCase());
    const peers = new Set();
    tags.forEach(tag => {
      const set = this._tagIndex.get(tag);
      if (set) set.forEach(p => { if (p !== pp) peers.add(p); });
    });

    // Tier fallback so untagged tracks still get a constellation: nearest 6 tier-mates.
    if (peers.size === 0) {
      const sameTier = this.panels.filter(p => p !== pp && p.tier === pp.tier);
      sameTier.sort((a, b) =>
        a.basePos.distanceToSquared(pp.basePos) - b.basePos.distanceToSquared(pp.basePos)
      );
      sameTier.slice(0, 6).forEach(p => peers.add(p));
    }

    const tint = pp.tint;
    const baseCol = new THREE.Color(tint[0], tint[1], tint[2]);

    [...peers].forEach((peer, i) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      geo.frustumCulled = false;
      const mat = new THREE.LineBasicMaterial({
        color: baseCol.clone(),
        transparent: true, opacity: 0.0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      this.constellationGroup.add(line);
      this.constellationLines.push({ line, peer, phase: Math.random() * Math.PI * 2 });
    });
  },

  _tickConstellation(t, bass) {
    const pp = this.playingPanel;
    if (!pp || !this.constellationLines.length) return;
    const a = pp.mesh.position;
    for (let i = 0; i < this.constellationLines.length; i++) {
      const { line, peer, phase } = this.constellationLines[i];
      const arr = line.geometry.attributes.position.array;
      const b = peer.mesh.position;
      arr[0] = a.x; arr[1] = a.y; arr[2] = a.z;
      arr[3] = b.x; arr[4] = b.y; arr[5] = b.z;
      line.geometry.attributes.position.needsUpdate = true;
      // Each line breathes on its own phase; bass thumps lift them all.
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.9 + phase);
      const peerHover = peer === this.hovered ? 0.45 : 0;
      line.material.opacity = (0.10 + 0.30 * pulse + peerHover) * (0.7 + bass * 0.6);
    }
  },

  _updateNowPlaying(t) {
    const nowEl = document.getElementById('tv-now');
    if (!nowEl) return;
    const cur = (this.ctx?.getCurrent && this.ctx.getCurrent()) ?? -1;
    const tracks = this.ctx?.tracks || [];
    const audio  = this.ctx?.audio;
    const track  = (cur >= 0 && tracks[cur]) ? tracks[cur] : null;

    if (!track) {
      nowEl.classList.remove('on');
      return;
    }
    nowEl.classList.add('on');

    const numEl   = document.getElementById('tv-now-num');
    const titleEl = document.getElementById('tv-now-title');
    const tagsEl  = document.getElementById('tv-now-tags');
    const playEl  = document.getElementById('tv-now-play');
    const fillEl  = document.getElementById('tv-now-fill');
    const knobEl  = document.getElementById('tv-now-knob');
    const timeEl  = document.getElementById('tv-now-time');
    const scEl    = document.getElementById('tv-now-sc');

    if (numEl)   numEl.textContent = `TRK.${String(cur + 1).padStart(3, '0')}`;
    if (titleEl) titleEl.textContent = `▸ ${(track.title || '').toLowerCase()}`;
    if (tagsEl) {
      const tags = (track.tags || []).slice(0, 3).join(' · ');
      tagsEl.textContent = tags || '';
    }
    if (scEl) scEl.href = this._scUrlFor(track);

    let pct = 0, dur = 0, cTime = 0, paused = true;
    if (audio) {
      cTime = audio.currentTime || 0;
      dur   = isFinite(audio.duration) ? audio.duration : 0;
      paused = !!audio.paused;
      pct = dur > 0 ? cTime / dur : 0;
    }
    if (fillEl) fillEl.style.width = (pct * 100).toFixed(2) + '%';
    if (knobEl) knobEl.style.left  = (pct * 100).toFixed(2) + '%';
    if (timeEl) timeEl.textContent = `${this._fmtTime(cTime)} / ${this._fmtTime(dur)}`;
    if (playEl) {
      const wantTxt = paused ? '▶' : '❚❚';
      if (playEl.textContent !== wantTxt) playEl.textContent = wantTxt;
    }
  },

  _fmtTime(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${m}:${ss < 10 ? '0' : ''}${ss}`;
  },

  /* ---------- Wrap helper for continuous scroll ---------- */
  _wrapY(yRaw) {
    // Wrap into [-halfH, +halfH]. JS modulo of negatives needs the +totalH dance.
    const H = this.totalH;
    const half = this.halfH;
    let y = yRaw + half;
    y = ((y % H) + H) % H;
    return y - half;
  },

  /* ---------- Loop ---------- */
  animate() {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.animate);
    const rawDt = Math.min(0.05, this.clock.getDelta());
    const scale = this._paused ? 0 : (this._timeScale ?? 1);
    const dt = rawDt * scale;
    this._adminTime = (this._adminTime ?? 0) + dt;
    const t  = this._adminTime;

    // Audio
    this._readAudio();
    const bass = this.bass, energy = this.energy;

    // Camera orbit — fixed y, fixed radius. Auto-yaw drifts when enabled.
    const camYaw = this.cam.yaw + (this._autoYawOn === false ? 0 : t * 0.012);
    const cx = Math.cos(camYaw) * HELIX.camRadius;
    const cz = Math.sin(camYaw) * HELIX.camRadius;
    this.camera.position.set(cx, 0, cz);
    this.camera.lookAt(0, -0.3, 0);

    // Auto-scroll component — slow continuous descent so it's never frozen
    if (this._autoScrollOn !== false) this.scroll += dt * 1.2;

    // Env uniforms
    if (this.nebula)    this.nebula.material.uniforms.uTime.value = t;
    if (this.starfield) this.starfield.material.uniforms.uTime.value = t;
    if (this.dust)      this.dust.material.uniforms.uTime.value = t;
    if (this.energyStream) {
      this.energyStream.material.uniforms.uTime.value  = t;
      this.energyStream.material.uniforms.uAudio.value = bass;
    }
    this.coreLayers.forEach(m => {
      m.material.uniforms.uTime.value = t;
      m.material.uniforms.uAudio.value = bass;
    });

    // Slow nebula rotation
    if (this.nebula) {
      this.nebula.rotation.y = t * 0.005;
      this.nebula.rotation.x = Math.sin(t * 0.003) * 0.05;
    }

    // Orbital rings rotate around their tilted axes
    this.rings.forEach(r => {
      r.rotation.z += r.userData.rate * dt;
    });

    // Bloom strength reacts to bass (capped — never above 0.95 so foreground reads)
    // Admin can pin a base via _adminBase; otherwise the default 0.60 baseline applies.
    if (this.bloom) {
      const base = (this.bloom._adminBase != null) ? this.bloom._adminBase : 0.60;
      this.bloom.strength = base + bass * 0.35;
    }

    // Glint sprites — short, sharp pulses on each one (sells "light catching glass")
    this.glints.forEach(s => {
      const phase = (t / s.userData.period + s.userData.offset) % 1;
      // Quick spike: 0 most of the time, briefly pops to ~1 in a narrow window
      const spike = Math.pow(Math.max(0, Math.sin(phase * Math.PI)), 28);
      s.material.opacity = spike * 0.85;
    });

    // Vertical pulses traveling along the spire
    this.pulses.forEach(s => {
      s.userData.offset += s.userData.dir * s.userData.speed * dt;
      const half = 90;
      while (s.userData.offset > half) s.userData.offset -= 2 * half;
      while (s.userData.offset < -half) s.userData.offset += 2 * half;
      s.position.set(0, s.userData.offset, 0);
      s.material.opacity = 0.45 + 0.45 * Math.sin(t * 1.2 + s.userData.offset * 0.07);
    });

    // Shards drift + spin
    this.shards.forEach(sh => {
      sh.rotation.x += sh.userData.rotV.x * dt;
      sh.rotation.y += sh.userData.rotV.y * dt;
      sh.rotation.z += sh.userData.rotV.z * dt;
      sh.userData.baseTh += sh.userData.orbitV * dt;
      const r = sh.userData.baseR;
      const th = sh.userData.baseTh;
      const yWobble = Math.sin(t * 0.4 + sh.userData.bobPhase) * sh.userData.bobAmp;
      sh.position.set(Math.cos(th) * r, sh.userData.baseY + yWobble, Math.sin(th) * r);
    });

    // Per-panel
    this.panels.forEach(p => {
      const u = this._panelUniforms(p);
      if (!u) return;
      u.uTime.value = t + p.layerY * 0.7;
      u.uAudio.value = energy;

      const targetVis = p.hidden ? 0 : 1;
      u.uVis.value += (targetVis - u.uVis.value) * Math.min(1, dt * 5);

      const isHover = this.hovered === p;
      const isFocus = this.focused === p;
      const targetH = isHover ? 1 : 0;
      const targetF = isFocus ? 1 : 0;
      u.uHover.value += (targetH - u.uHover.value) * Math.min(1, dt * 8);
      u.uFocus.value += (targetF - u.uFocus.value) * Math.min(1, dt * 6);

      // Bumped glitch frequency 0.0014 → 0.0050 + audio-amped on bass.
      // The catalog should feel chaotic, not calm.
      const glitchRate = 0.0050 + bass * 0.012;
      if (!p.hidden && !isFocus && t > p.glitchUntil && Math.random() < glitchRate) {
        u.uHover.value = Math.max(u.uHover.value, 0.65);
        p.glitchUntil = t + 0.35;
      }

      // Continuous scroll: wrap base layer Y into [-halfH, halfH]
      const wrappedY = this._wrapY(p.layerY - this.scroll);
      const drift = Math.sin(t * 0.5 + p.layerY * 0.4) * 0.18;

      let target;
      if (isFocus) {
        const fwd = new THREE.Vector3();
        this.camera.getWorldDirection(fwd);
        target = this.camera.position.clone().add(fwd.multiplyScalar(7.5));
      } else if (p.hidden) {
        // Retract toward axis (xz=0) but still scroll
        target = new THREE.Vector3(0, wrappedY, 0);
      } else {
        target = new THREE.Vector3(p.basePos.x, wrappedY + drift, p.basePos.z);
      }
      p.mesh.position.lerp(target, Math.min(1, dt * (isFocus ? 7 : 6)));
      p.halo.position.copy(p.mesh.position);

      // Audio-reactive halo opacity (only the playing track)
      const audioBoost = u.uPlaying.value * (0.20 + bass * 0.5);
      p.halo.material.opacity = (0.18 + u.uHover.value * 0.32 + u.uFocus.value * 0.32 + audioBoost) * u.uVis.value;

      const targetScale = isFocus ? 1.18 : (isHover ? 1.06 : 1.0);
      p.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, 1), Math.min(1, dt * 5));
      const playingPulse = u.uPlaying.value * (1 + bass * 0.20);
      const haloS = HELIX.panelW * (1.7 + playingPulse * 0.20) * targetScale;
      p.halo.scale.lerp(new THREE.Vector3(haloS, HELIX.panelH * (1.7 + playingPulse * 0.20) * targetScale, 1), Math.min(1, dt * 5));

      if (isFocus) {
        p.mesh.lookAt(this.camera.position);
      } else if (Math.abs(u.uFocus.value) < 0.02) {
        const pp = p.mesh.position;
        p.mesh.lookAt(pp.x * 2, pp.y, pp.z * 2);
      }
    });

    // Constellation lines + now-playing transport
    this._tickConstellation(t, bass);
    this._updateNowPlaying(t);

    if (this.postPass) this.postPass.uniforms.uTime.value = t;
    this.composer.render();
  },

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('keydown', this._onKey);
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
    this.scene = null; this.camera = null; this.renderer = null;
    this.composer = null; this.panels = []; this.shards = []; this.pulses = [];
    this.rings = []; this.glints = []; this.coreLayers = [];
    this.constellationGroup = null; this.constellationLines = [];
    this.playingPanel = null; this._tagIndex = null;
    this.ctx = null;
    document.body.style.cursor = '';
  },
};

window.TracksVault = TracksVault;
