/* =========================================================
   SCENES-SELECTOR.JS — Cinematic /scenes selector
   Inside-a-space-station observation deck. 10 scenes as floating
   holographic panels arranged in a wrapping arc around the viewer.
   ESM module — loaded by scenes/index.html via importmap.
   ========================================================= */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }    from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass }    from 'three/addons/postprocessing/ShaderPass.js';

const SCENES = [
  { id: 'dimensions', num: '01', title: 'dimensions',  body: 'Layered planes of audio-reactive geometry. Depth as music — each frequency band carves its own slice through space.', hue: 0.74 },
  { id: 'livingwall', num: '02', title: 'living wall', body: 'An interactive sound-texture wall. Hover, click, watch it breathe back at the music.', hue: 0.40 },
  { id: 'organism',   num: '03', title: 'organism',    body: 'A bio-reactive node network. Cells multiply and decay with the kick — the catalog as a living thing.', hue: 0.92 },
  { id: 'freqmap',    num: '04', title: 'freq map',    body: 'Frequency mapped onto a navigable grid. The spectrum becomes terrain you can walk through.', hue: 0.58 },
  { id: 'tapespine',  num: '05', title: 'tape spine',  body: 'A vertical tape-style scrolling track index. Reads like a transmission log from the future.', hue: 0.10 },
  { id: 'wall',       num: '06', title: 'wall',        body: 'Track wall. Simple grid. Sometimes the basics are the move.', hue: 0.00 },
  { id: 'terrain',    num: '07', title: 'terrain',     body: 'Audio-reactive height terrain. Bass pushes mountains up. Treble carves valleys.', hue: 0.30 },
  { id: 'deepsea',    num: '08', title: 'deep sea',    body: 'A scrolling depth track list. Drift downward through the catalog. Pressure rises with each layer.', hue: 0.55 },
  { id: 'neural',     num: '09', title: 'neural',      body: 'Audio-reactive node graph. Tracks as neurons. Plays as synapse fires.', hue: 0.50 },
  { id: 'villa',      num: '10', title: 'villa',       body: 'A 3D Miami villa at sundown. PS2-era shaders, lambo on the deck. Click props for tracks.', hue: 0.86 },
];

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
  uniform vec3  uTint;
  varying vec2 vUv;
  float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec2 uv = vUv;
    float gAmt = 0.18 + uHover * 0.65 + uFocus * 0.45;

    // Block displacement — narrow strips, low amplitude
    float strips = 36.0;
    float blockY = floor(uv.y * strips) / strips;
    float blockSeed = rand(vec2(blockY * 4.31, floor(uTime * 9.0)));
    float dispActive = step(1.0 - 0.14 * gAmt, blockSeed);
    float disp = (rand(vec2(blockY, floor(uTime * 7.0))) - 0.5) * 0.04 * gAmt;
    uv.x += disp * dispActive;

    // RGB split
    float ca = 0.0014 + 0.008 * gAmt;
    float r = texture2D(uTex, uv + vec2(ca, 0.0)).r;
    float gC = texture2D(uTex, uv).g;
    float b = texture2D(uTex, uv - vec2(ca, 0.0)).b;
    float a = texture2D(uTex, uv).a;
    vec3 col = vec3(r, gC, b);

    // Scanlines
    col *= 0.92 + 0.08 * sin(uv.y * 540.0);

    // Glass panel surround tint — magenta-ish near edges
    float edge = max(
      smoothstep(0.96, 1.00, abs(uv.x - 0.5) * 2.0),
      smoothstep(0.96, 1.00, abs(uv.y - 0.5) * 2.0)
    );
    vec3 frame = mix(vec3(0.05, 0.06, 0.10), uTint, 0.85);
    col = mix(col, frame * (0.6 + uHover * 1.2 + uFocus * 0.8), edge);

    // Inner caution-stripe dim band at the bottom (where the description sits)
    float band = smoothstep(0.78, 0.80, uv.y) * (1.0 - smoothstep(1.0, 1.02, uv.y));
    col *= 1.0 - band * 0.20;

    col *= uTint;

    // Hover pulse glow
    float pulse = 0.5 + 0.5 * sin(uTime * 4.0);
    col += uTint * (uHover * 0.10 + uFocus * 0.08) * pulse;

    a *= 0.92 + uHover * 0.08;
    gl_FragColor = vec4(col, a);
  }
`;

const POST_FRAG = `
  uniform sampler2D tDiffuse;
  uniform float uTime;
  uniform vec2  uResolution;
  varying vec2 vUv;
  float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec2 uv = vUv;
    vec2 dir = uv - 0.5;
    // Mild CA
    float ca = 0.0020;
    float r = texture2D(tDiffuse, uv - dir * ca).r;
    float g = texture2D(tDiffuse, uv).g;
    float b = texture2D(tDiffuse, uv + dir * ca).b;
    vec3 col = vec3(r, g, b);
    // Scanline modulation
    col *= 0.96 + 0.04 * sin(uv.y * uResolution.y * 1.8);
    // Grain
    col += (rand(uv + fract(uTime * 0.7)) - 0.5) * 0.05;
    // Vignette
    col *= smoothstep(1.25, 0.40, length(dir) * 1.45);
    gl_FragColor = vec4(col, 1.0);
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

const ScenesSelector = {
  scene: null, camera: null, renderer: null, composer: null, postPass: null, bloom: null,
  clock: null, raf: 0,
  panels: [], hovered: null, focused: null,
  ray: null, mouse: null,
  gaze: null, drag: null,
  hudEl: null, destroyed: false,
  arc: null, floor: null,

  init(container) {
    if (this.renderer) return;
    this.destroyed = false;
    this.panels = [];
    this.hovered = null;
    this.focused = null;
    this.mouse = { x: 0.5, y: 0.5, ndc: new THREE.Vector2(0, 0) };
    this.gaze = { yaw: 0, pitch: -0.05 };
    this.drag = { active: false, x0: 0, y0: 0, lx: 0, ly: 0, totalPx: 0 };

    const canvas = document.createElement('canvas');
    canvas.className = 'ss-canvas';
    container.appendChild(canvas);

    this.hudEl = this._buildHud();
    container.appendChild(this.hudEl);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.setClearColor(0x06080d, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x06080d, 0.015);

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 420);
    this.camera.position.set(0, 0, 0);

    this._buildEnvironment();
    this._buildHexDeck();              // b171: hexagonal observation deck (replaces painted helipad)
    this._buildStandoff();
    this._buildCentralDish();
    this._buildPelicanPad();
    this._buildPlanet();
    this._buildStationLights();
    this._buildFlybys();
    this._buildScriptedPelican();
    this._buildPatrolWarthog();
    this._buildBarracksRow();          // b171: 3 barracks lined up beside the existing one
    this._buildFuelDepot();            // b171: cylindrical fuel tanks at far-right
    this._buildAntennaArray();         // b171: dense comms antenna farm (back-left)
    this._buildWatchtowers();          // b171: 4 perimeter watchtowers
    this._buildPerimeterClutter();     // b171: jersey walls, floodlight catenary, fence segments
    this._buildAllStructures();        // b173: pre-build every panel-host body so panel mounts only add trim
    this._buildFloorProps();
    this._buildPanels();
    this._buildStructureUplights();    // illuminate the buildings from below
    this._buildBuildingFloodBeams();   // b171: focused volumetric beams ON the dishes/silo/radar
    this._buildBuildingWindows();      // b173: lit window grids on existing buildings (more man-made lighting)
    this._buildPelicanLights();        // b173: cockpit/nav/ramp glow + 4 floodlight stands around pelican
    this._buildEngineerCrew();         // b173: 3 ODST engineers around the parked pelican
    this._buildTents();                // b184: 3 bivouac clusters of GP-medium tents
    this._buildPersonnel();            // b184: 8 soldiers walking between tents/buildings
    this._buildScorpions();            // b173: 1 parked Scorpion tank + 1 slow patroller
    this._setupComposer();

    this.clock = new THREE.Clock();
    this.ray = new THREE.Raycaster();

    this._onResize = this._onResize.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onKey = this._onKey.bind(this);
    window.addEventListener('resize', this._onResize);
    canvas.addEventListener('pointermove', this._onMove);
    canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('keydown', this._onKey);

    this._onResize();
    this.animate = this.animate.bind(this);
    this.animate();
  },

  /* ---------- Environment: Standoff-style outpost deck at night ---------- */
  _buildEnvironment() {
    // Concrete deck pad with painted helipad markings + caution stripes,
    // fading to dirt/rock at the edges. Replaces the b140 magenta grid so
    // the scene reads as a real ground surface, not a void-floating panel.
    const floorGeo = new THREE.PlaneGeometry(220, 220, 1, 1);
    const floorMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec3 vWorld;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vWorld;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
        }
        void main(){
          // p.x = world X, p.y = world Z
          vec2 p = vWorld.xz;
          float d = length(p);

          // ---- Tan dusty desert ground (Standoff/MGS-island vibe) ----
          vec3 dirt = vec3(0.135, 0.112, 0.075);
          dirt += (noise(p * 0.16) - 0.5) * 0.050;     // big patches
          dirt += (noise(p * 0.85) - 0.5) * 0.028;     // mid scrub
          dirt += (noise(p * 4.20) - 0.5) * 0.018;     // grain
          // Sparse darker rocks
          float pebble = step(0.91, noise(p * 3.1));
          dirt -= vec3(0.020, 0.018, 0.013) * pebble;
          // Sparse dry-grass tufts
          float scrub = smoothstep(0.78, 0.92, noise(p * 0.65 + 13.4));
          dirt += vec3(0.015, 0.018, 0.008) * scrub;

          // ---- Road network (b182): rectangular perimeter loop + spine ----
          // The base is enclosed by a 4-edge perimeter road. Vehicles
          // patrol the full loop. A single spine road runs from the deck
          // out to the north edge so the camera sees a clear axis into
          // the base interior. Cement walkways branch off the spine to
          // building clusters; dirt is left visible BETWEEN buildings
          // so the desert ground reads through.
          //
          // Loop bounds (centerlines): x = ±LX, z in [LN, LS].
          //   LX = 78  → east/west legs
          //   LN = -90 → north (deepest) leg
          //   LS = +50 → south (front) leg, behind camera
          // ROAD_HW = 4.5u half-width (matches old spine road).

          float northMask = smoothstep(0.5, 0.0, abs(p.y + 90.0) - 4.5)
                          * step(-78.0, p.x) * step(p.x, 78.0);
          float southMask = smoothstep(0.5, 0.0, abs(p.y - 50.0) - 4.5)
                          * step(-78.0, p.x) * step(p.x, 78.0);
          float eastMask  = smoothstep(0.5, 0.0, abs(p.x - 78.0) - 4.5)
                          * step(-90.0, p.y) * step(p.y, 50.0);
          float westMask  = smoothstep(0.5, 0.0, abs(p.x + 78.0) - 4.5)
                          * step(-90.0, p.y) * step(p.y, 50.0);
          // Central spine: from deck edge (z=-12) back to north loop edge.
          float spineMask = smoothstep(0.5, 0.0, abs(p.x) - 4.5)
                          * step(-90.0, p.y) * step(p.y, -12.0);

          float roadMask = clamp(northMask + southMask + eastMask + westMask
                               + spineMask, 0.0, 1.0);

          // Dashed center lines on every leg + spine
          float northCL = smoothstep(0.18, 0.0, abs(p.y + 90.0))
                        * step(-78.0, p.x) * step(p.x, 78.0)
                        * step(0.55, fract(abs(p.x) * 0.40));
          float southCL = smoothstep(0.18, 0.0, abs(p.y - 50.0))
                        * step(-78.0, p.x) * step(p.x, 78.0)
                        * step(0.55, fract(abs(p.x) * 0.40));
          float eastCL  = smoothstep(0.18, 0.0, abs(p.x - 78.0))
                        * step(-90.0, p.y) * step(p.y, 50.0)
                        * step(0.55, fract(abs(p.y) * 0.40));
          float westCL  = smoothstep(0.18, 0.0, abs(p.x + 78.0))
                        * step(-90.0, p.y) * step(p.y, 50.0)
                        * step(0.55, fract(abs(p.y) * 0.40));
          float spineCL = smoothstep(0.18, 0.0, abs(p.x))
                        * step(-90.0, p.y) * step(p.y, -12.0)
                        * step(0.55, fract(abs(p.y) * 0.40));
          float lineMask = clamp(northCL + southCL + eastCL + westCL
                               + spineCL, 0.0, 1.0);

          vec3 asphalt = vec3(0.048, 0.052, 0.060);
          asphalt += (noise(p * 1.8) - 0.5) * 0.012;
          asphalt = mix(asphalt, vec3(0.46, 0.38, 0.10), lineMask * 0.85);

          vec3 col = mix(dirt, asphalt, roadMask);

          // ---- Cement walkways (b182): pale-grey foot paths between
          // buildings. Narrower than roads (1.6u half-width). Dirt still
          // shows BETWEEN walkways, so the ground reads as desert with
          // paved walks, not paved-everywhere. ----
          // Concentric ring around the hex deck: r in [13, 18]
          float deckRing = smoothstep(0.5, 0.0, abs(d - 15.5) - 2.5);
          // Cross walkway @ z=-30 connecting buildings on east/west of spine
          float xwalk1 = smoothstep(0.4, 0.0, abs(p.y + 30.0) - 1.6)
                       * step(-72.0, p.x) * step(p.x, 72.0);
          // Cross walkway @ z=-58 (deeper interior)
          float xwalk2 = smoothstep(0.4, 0.0, abs(p.y + 58.0) - 1.6)
                       * step(-72.0, p.x) * step(p.x, 72.0);
          // Side walkway @ x=-30 connecting deck-ring → mid-walk
          float ywalk1 = smoothstep(0.4, 0.0, abs(p.x + 30.0) - 1.6)
                       * step(-58.0, p.y) * step(p.y, -18.0);
          // Side walkway @ x=+30
          float ywalk2 = smoothstep(0.4, 0.0, abs(p.x - 30.0) - 1.6)
                       * step(-58.0, p.y) * step(p.y, -18.0);
          float walkRaw = clamp(deckRing + xwalk1 + xwalk2 + ywalk1 + ywalk2,
                                0.0, 1.0);
          // Walkways shouldn't paint OVER asphalt (roads win)
          float walkMask = walkRaw * (1.0 - roadMask);
          vec3 cement = vec3(0.165, 0.168, 0.182);
          cement += (noise(p * 2.6) - 0.5) * 0.020;
          col = mix(col, cement, walkMask);

          // ---- Compacted-dirt apron under the deck ----
          float apron = smoothstep(14.0, 8.0, d) * (1.0 - roadMask) * (1.0 - walkMask);
          col = mix(col, vec3(0.105, 0.085, 0.058), apron * 0.45);

          // ---- Distance dimming (b182: pushed out so the perimeter
          // loop and back buildings stay readable; previously kicked in
          // at d=80 which dimmed everything past the radar building).
          float fade = 1.0 - smoothstep(140.0, 260.0, d) * 0.45;
          col *= 0.78 + 0.22 * fade;

          // ---- Subtle moonlight cool tint ----
          col += vec3(0.005, 0.008, 0.014);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.floor = new THREE.Mesh(floorGeo, floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -8;
    this.scene.add(this.floor);

    // Floodlight poles around the deck perimeter — replaces the b140 hangar
    // bulkhead frame + ceiling light strips. Cool white-blue cones throw
    // moonlight-ish ambient onto the pad.
    this._buildFloodlightRig();

    // Drifting dust motes — a few hundred small points
    const N = 600;
    const positions = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 6 + Math.random() * 24;
      const th = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.4) * 14;
      positions[i*3]   = Math.cos(th) * r;
      positions[i*3+1] = y;
      positions[i*3+2] = Math.sin(th) * r;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dustMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPxr: { value: this.renderer.getPixelRatio() } },
      vertexShader: `
        uniform float uTime;
        uniform float uPxr;
        varying float vAlpha;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * 0.10 + position.y * 0.4) * 0.5;
          p.y += cos(uTime * 0.07 + position.x * 0.3) * 0.4;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float dist = length(mv.xyz);
          vAlpha = smoothstep(40.0, 6.0, dist) * 0.5;
          gl_PointSize = uPxr * (60.0 / max(dist, 1.0));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          float a = smoothstep(0.5, 0.0, r);
          gl_FragColor = vec4(vec3(0.9, 0.85, 1.0), a * a * vAlpha);
        }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.dust = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dust);

    // Atmospheric back-glow — wide soft sprite far behind
    const bgTex = this._makeRadialGlowTexture('rgba(180,80,160,0.55)');
    const bgMat = new THREE.SpriteMaterial({ map: bgTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.45 });
    const bg = new THREE.Sprite(bgMat);
    bg.scale.set(140, 70, 1);
    bg.position.set(0, 0, -55);
    this.scene.add(bg);

    const bg2Tex = this._makeRadialGlowTexture('rgba(80,180,200,0.40)');
    const bg2Mat = new THREE.SpriteMaterial({ map: bg2Tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.40 });
    const bg2 = new THREE.Sprite(bg2Mat);
    bg2.scale.set(110, 60, 1);
    bg2.position.set(-30, 5, -45);
    this.scene.add(bg2);
  },

  _makeRadialGlowTexture(rgba) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0.0, rgba);
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  },

  /* ---------- Floodlight rig — 8 dim perimeter poles ----
     b169: pulled WAY back. The b168 poles were blowing out the camera
     view with bright sphere lenses + huge bloom cones. The pole's job
     is now just "dim moonlight on the deck" — actual dramatic
     illumination of base structures is done by `_buildStructureUplights`. */
  _buildFloodlightRig() {
    const poleMat = new THREE.MeshBasicMaterial({ color: 0x14171e });
    const fixtureMat = new THREE.MeshBasicMaterial({ color: 0x0c0e14 });
    const radius = 30;
    const height = 9;
    const groundSpotTex = this._makeGroundSpotTexture();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, height, 6), poleMat);
      pole.position.set(x, -8 + height / 2, z);
      this.scene.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.6), poleMat);
      arm.position.set(x - Math.cos(a) * 0.6, -8 + height - 0.1, z - Math.sin(a) * 0.6);
      arm.lookAt(0, -8 + height - 0.1, 0);
      this.scene.add(arm);
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.30, 0.35), fixtureMat);
      fixture.position.set(x - Math.cos(a) * 0.6, -8 + height - 0.25, z - Math.sin(a) * 0.6);
      fixture.lookAt(0, -8 + height - 0.25, 0);
      this.scene.add(fixture);
      const lens = this._makeRunningLight(0xc8d4e8, 0.32);
      lens.position.set(x - Math.cos(a) * 0.5, -8 + height - 0.25, z - Math.sin(a) * 0.5);
      this.scene.add(lens);
      // Dim ground splash on the deck
      const spotMat = new THREE.SpriteMaterial({
        map: groundSpotTex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0.18,
      });
      const spot = new THREE.Sprite(spotMat);
      spot.scale.set(9, 9, 1);
      spot.position.set(x * 0.55, -7.88, z * 0.55);
      this.scene.add(spot);
    }
  },

  /* ---------- Structure uplights — light each major structure from below ---
     b169: this is where the dramatic illumination happens. Each major
     building / dish / silo gets a tall additive light-cone sprite at its
     base, painting the structure visible against the night sky. */
  _buildStructureUplights() {
    const tex = this._makeUplightTexture();
    // b184: dropped saturated palette (magenta/red/green looked like
    // colored fog around buildings). All uplights now warm / cool / amber
    // — readable industrial lighting, not a rave. Opacity 0.82 → 0.65 so
    // the splash doesn't overpower the building silhouette.
    const add = (x, z, scale = 1, color = 'warm') => {
      const colors = {
        warm:   { mat: 0xffd9a4 },
        cool:   { mat: 0xb8d4ff },
        amber:  { mat: 0xffaa55 },
      };
      const c = colors[color] || colors.warm;
      const mat = new THREE.SpriteMaterial({
        map: tex, color: c.mat, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0.65,
      });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(10 * scale, 20 * scale, 1);
      sp.center.set(0.5, 0.0);  // pivot at bottom-center so scaling extends UP
      sp.position.set(x, -8 + 0.1, z);
      this.scene.add(sp);
    };
    // Central dish at (15, -8, -110) — biggest uplight
    add(15, -110, 3.2, 'warm');
    // Missile silo at (-55, -8, -84)
    add(-55, -84, 1.8, 'amber');
    // Cmd bunker at (-40, -8, -71)
    add(-40, -71, 1.4, 'cool');
    // Radar building at (20, -8, -47)
    add(20, -47, 1.3, 'cool');
    // Vehicle bay at (50, -8, -27)
    add(50, -27, 1.2, 'amber');
    // Comm tower at (-38, -8, -24)
    add(-38, -24, 1.6, 'cool');
    // Helipad at (42, -8, -19)
    add(42, -19, 1.2, 'amber');
    // Barracks at (-65, -8, -22)
    add(-65, -22, 1.2, 'amber');
    // Supply depot at (65, -8, -13)
    add(65, -13, 1.2, 'cool');
    // Back-far dishes — kept atmospheric (background distance, low scale)
    add(58, 58, 1.0, 'warm');
    add(-72, -45, 1.2, 'warm');
    // b182 structures, b184 desaturated -----------------------------
    add( 12, 38, 1.0, 'cool');     // biostation (was green)
    add(-58, -49, 1.0, 'cool');    // antenna shed
    add( 38,  44, 0.9, 'amber');   // back-right comm tower (was red)
    add(-46, -28, 0.9, 'cool');    // mid-left comm tower
    add(-12,  62, 0.9, 'amber');   // far-back comm tower (was red)
    add( 48, -22, 0.9, 'cool');    // mid-right comm tower
    add( 42, -38, 0.8, 'amber');   // standoff bunker (motor pool)
    add(-30,  48, 0.8, 'amber');   // standoff bunker (back-left)
    add(-58,  10, 0.8, 'amber');   // standoff bunker (mid-left)
    // Note: removed the wall back-billboard (45,38) uplight — that was
    // painting a magenta wash onto the panel face every frame.
  },

  _makeUplightTexture() {
    // Tall radial gradient — bright at bottom-center, fading to transparent
    // at the top. Renders as an upward-pointing cone of light.
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 256, 0, 64, 256, 220);
    g.addColorStop(0.0, 'rgba(255, 255, 255, 0.85)');
    g.addColorStop(0.30, 'rgba(255, 255, 255, 0.40)');
    g.addColorStop(0.70, 'rgba(255, 255, 255, 0.10)');
    g.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  },

  _makeGroundSpotTexture() {
    // Pure radial gradient — used as a "puddle" of light on the deck.
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0.0, 'rgba(220, 235, 255, 0.85)');
    g.addColorStop(0.5, 'rgba(160, 185, 230, 0.30)');
    g.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  },

  _makeFloodConeTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    // Soft elongated radial — brighter at the top, falls off at the bottom
    const g = ctx.createRadialGradient(128, 96, 0, 128, 128, 130);
    g.addColorStop(0.0, 'rgba(200, 220, 255, 0.55)');
    g.addColorStop(0.45, 'rgba(150, 175, 220, 0.18)');
    g.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  },

  /* ---------- b171: Hexagonal observation deck at the camera position ----
     The user's vantage point. Hex (not circle) on the ground, sandbag
     wraparound on 5 of 6 faces, open forward face for clear view. Six
     corner floodlight posts illuminate the deck and surrounding apron.
     Replaces the painted-helipad reading of the immediate ground. */
  _buildHexDeck() {
    const grp = new THREE.Group();
    const deckR = 12.0;
    const floorY = -8.0;
    const deckH = 0.40;

    const deckMat = new THREE.MeshBasicMaterial({ color: 0x1a1c22 });
    const tread   = new THREE.MeshBasicMaterial({ color: 0x232730 });
    const steel   = new THREE.MeshBasicMaterial({ color: 0x14171e });
    const sandbag = new THREE.MeshBasicMaterial({ color: 0x14171d });
    const yellow  = new THREE.MeshBasicMaterial({ color: 0x6a5618 });

    // Hex deck floor (cylinder with 6-side geometry sits flat on the ground)
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(deckR, deckR, deckH, 6),
      deckMat,
    );
    platform.position.y = floorY + deckH / 2;
    platform.rotation.y = Math.PI / 2;  // flat face perpendicular to -Z (forward)
    grp.add(platform);

    // Tread surface (slightly lighter inset)
    const treadMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(deckR - 0.20, deckR - 0.20, 0.06, 6),
      tread,
    );
    treadMesh.position.y = floorY + deckH + 0.03;
    treadMesh.rotation.y = Math.PI / 2;
    grp.add(treadMesh);

    // Spoke rib pattern from center
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(deckR - 1.5, 0.012, 0.10),
        steel,
      );
      rib.position.set(
        Math.cos(a) * (deckR / 2 - 0.5),
        floorY + deckH + 0.07,
        Math.sin(a) * (deckR / 2 - 0.5),
      );
      rib.rotation.y = -a;
      grp.add(rib);
    }

    // Hex corners: angles 0, 60, 120, 180, 240, 300. Face midpoints at 30, 90,
    // 150, 210, 270, 330. Face index 4 has midpoint at 270° = (0,0,-1) = -Z =
    // forward — leave that face open so the user has a clear view.
    const corners = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      corners.push({ x: Math.cos(a) * deckR, z: Math.sin(a) * deckR, a });
    }

    // Sandbag walls along 5 faces (skip face 4)
    const bagW = 0.95, bagH = 0.55, bagD = 0.70;
    for (let k = 0; k < 6; k++) {
      if (k === 4) continue;
      const c0 = corners[k];
      const c1 = corners[(k + 1) % 6];
      const len = Math.hypot(c1.x - c0.x, c1.z - c0.z);
      const ang = Math.atan2(c1.z - c0.z, c1.x - c0.x);
      const cx = (c0.x + c1.x) / 2;
      const cz = (c0.z + c1.z) / 2;
      const count = Math.floor(len / 1.05);
      for (let i = 0; i < count; i++) {
        const off = (i - (count - 1) / 2) * 1.05;
        const bx = cx + Math.cos(ang) * off;
        const bz = cz + Math.sin(ang) * off;
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(bagW, bagH, bagD), sandbag);
        b1.position.set(bx, floorY + deckH + bagH / 2, bz);
        b1.rotation.y = -ang + (Math.random() - 0.5) * 0.10;
        grp.add(b1);
        if (i < count - 1) {
          const off2 = off + 0.525;
          const bx2 = cx + Math.cos(ang) * off2;
          const bz2 = cz + Math.sin(ang) * off2;
          const b2 = new THREE.Mesh(new THREE.BoxGeometry(bagW, bagH, bagD), sandbag);
          b2.position.set(bx2, floorY + deckH + bagH * 1.5, bz2);
          b2.rotation.y = -ang + (Math.random() - 0.5) * 0.10;
          grp.add(b2);
        }
      }
    }

    // Front face: yellow caution stripe at the deck edge (no sandbags — open)
    const fc4 = corners[4], fc5 = corners[5];
    const fcx = (fc4.x + fc5.x) / 2;
    const fcz = (fc4.z + fc5.z) / 2;
    const flen = Math.hypot(fc5.x - fc4.x, fc5.z - fc4.z);
    const fang = Math.atan2(fc5.z - fc4.z, fc5.x - fc4.x);
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(flen - 0.5, 0.40),
      yellow,
    );
    stripe.position.set(fcx, floorY + deckH + 0.10, fcz - 0.05);
    stripe.rotation.x = -Math.PI / 2;
    stripe.rotation.z = -fang;
    grp.add(stripe);

    // 6 corner floodlight posts going up, fixtures aimed outward
    corners.forEach(c => {
      const postH = 5.0;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.18, postH, 6),
        steel,
      );
      post.position.set(c.x, floorY + postH / 2, c.z);
      grp.add(post);
      const armEndX = c.x + Math.cos(c.a) * 0.7;
      const armEndZ = c.z + Math.sin(c.a) * 0.7;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.7), steel);
      arm.position.set((c.x + armEndX) / 2, floorY + postH - 0.20, (c.z + armEndZ) / 2);
      arm.lookAt(armEndX, floorY + postH - 0.20, armEndZ);
      grp.add(arm);
      const fixt = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.30, 0.42), steel);
      fixt.position.set(armEndX, floorY + postH - 0.30, armEndZ);
      fixt.lookAt(c.x + Math.cos(c.a) * 4, floorY + postH - 0.30, c.z + Math.sin(c.a) * 4);
      grp.add(fixt);
      const lens = this._makeRunningLight(0xd4e0f0, 0.34);
      lens.position.set(armEndX + Math.cos(c.a) * 0.18, floorY + postH - 0.30, armEndZ + Math.sin(c.a) * 0.18);
      grp.add(lens);
      // Volumetric cone aimed outward+downward
      const coneTex = this._makeFloodConeTexture();
      const coneMat = new THREE.SpriteMaterial({
        map: coneTex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0.30, color: 0xb8c8e0,
      });
      const cone = new THREE.Sprite(coneMat);
      cone.scale.set(8, 12, 1);
      cone.center.set(0.5, 1.0);
      cone.position.set(c.x + Math.cos(c.a) * 2.0, floorY + postH - 0.40, c.z + Math.sin(c.a) * 2.0);
      grp.add(cone);
    });

    this.scene.add(grp);
    this.observationDeck = grp;
  },

  /* ---------- b171: Barracks row — adds 3 more barracks beside the existing
     big barracks at (-65,-22), filling out the left-flank living quarters. */
  _buildBarracksRow() {
    const concrete = new THREE.MeshBasicMaterial({ color: 0x242a36 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x303848 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x0a0c12 });
    const olive = new THREE.MeshBasicMaterial({ color: 0x232714 });
    const yellow = new THREE.MeshBasicMaterial({ color: 0x5a4a14 });

    // Spec: 3 barracks at x=-50, -38, -26 along z=-12 (north-facing entries)
    const positions = [
      { cx: -50, cz: -12 },
      { cx: -38, cz: -12 },
      { cx: -28, cz: -12 },
    ];
    positions.forEach(({ cx, cz }, i) => {
      const grp = new THREE.Group();
      const W = 9, H = 4.5, D = 12;
      const shell = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), concrete);
      shell.position.set(0, H / 2, 0);
      grp.add(shell);
      // Gable roof plane (flat)
      const roofPlane = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.4, D + 0.4), olive);
      roofPlane.rotation.x = -Math.PI / 2;
      roofPlane.position.set(0, H + 0.05, 0);
      grp.add(roofPlane);
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, D + 0.4), dark);
      ridge.position.set(0, H + 0.20, 0);
      grp.add(ridge);
      // 3 lit window strips down the long side facing the road (z=+D/2)
      for (let w = -1; w <= 1; w++) {
        const winMat = new THREE.MeshBasicMaterial({
          color: 0xffaa55, transparent: true, opacity: 0.70,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), winMat);
        win.position.set(w * 2.6, H * 0.6, D / 2 + 0.04);
        win.userData = { rate: 4.0 + Math.random() * 2, phase: Math.random() * 6, baseOpacity: 0.70 };
        grp.add(win);
        this.standoff?.windows.push(win);
      }
      // Door (warm glow)
      const doorMat = new THREE.MeshBasicMaterial({
        color: 0xffaa55, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.8), doorMat);
      door.position.set(W / 2 - 1.2, 0.9, D / 2 + 0.04);
      grp.add(door);
      // Stenciled number
      const stencil = new THREE.MeshBasicMaterial({ color: 0xc6c2a8 });
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), stencil);
      num.position.set(-W / 2 + 0.7, H * 0.85, D / 2 + 0.05);
      grp.add(num);
      // Antenna stub on roof
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.8, 4), concreteLit);
      ant.position.set(W / 2 - 0.5, H + 1.1, -D / 4);
      grp.add(ant);
      // Caution stripe on roof front
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.10, 0.06), yellow);
      stripe.position.set(0, H + 0.30, D / 2 + 0.20);
      grp.add(stripe);
      grp.position.set(cx, -8, cz);
      // b173 fix: don't rotate — local +Z window face was being mapped to
      // world -Z (away from camera) by the prior Math.PI, so the lit
      // windows ended up on the back of the building. Remove rotation to
      // put them on the camera-facing front.
      this.scene.add(grp);
    });
  },

  /* ---------- b171: Fuel depot — 4 cylindrical fuel tanks with pipework
     placed at far-right (x=70, z=+5) so it's visible in mid-distance and
     fills the otherwise-empty far-right zone. */
  _buildFuelDepot() {
    const grp = new THREE.Group();
    const concrete = new THREE.MeshBasicMaterial({ color: 0x242a36 });
    const tankPaint = new THREE.MeshBasicMaterial({ color: 0x6a6a4a });
    const tankBand = new THREE.MeshBasicMaterial({ color: 0x4a4a32 });
    const steel = new THREE.MeshBasicMaterial({ color: 0x14171e });
    const yellow = new THREE.MeshBasicMaterial({ color: 0x6a5618 });

    // Concrete pad
    const pad = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 14), concrete);
    pad.position.set(0, 0.2, 0);
    grp.add(pad);

    // 4 cylindrical tanks in a 2x2 grid
    const tankR = 2.4, tankH = 4.5;
    [{x:-5,z:-3}, {x:5,z:-3}, {x:-5,z:3}, {x:5,z:3}].forEach((pos, i) => {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(tankR, tankR, tankH, 16),
        tankPaint,
      );
      tank.position.set(pos.x, 0.4 + tankH / 2, pos.z);
      grp.add(tank);
      // Top dome
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(tankR, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        tankPaint,
      );
      dome.position.set(pos.x, 0.4 + tankH, pos.z);
      grp.add(dome);
      // Reinforcing band
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(tankR + 0.03, 0.10, 4, 16),
        tankBand,
      );
      band.rotation.x = Math.PI / 2;
      band.position.set(pos.x, 0.4 + tankH * 0.55, pos.z);
      grp.add(band);
      // Stenciled number
      const stencil = new THREE.MeshBasicMaterial({ color: 0xc6c2a8 });
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), stencil);
      num.position.set(pos.x, 0.4 + tankH * 0.65, pos.z + tankR + 0.02);
      grp.add(num);
      // Caution stripe at base
      for (let s = 0; s < 12; s++) {
        const a = (s / 12) * Math.PI * 2;
        const tab = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.20, 0.12), s % 2 === 0 ? yellow : concrete);
        tab.position.set(pos.x + Math.cos(a) * (tankR + 0.05), 0.6, pos.z + Math.sin(a) * (tankR + 0.05));
        tab.rotation.y = a;
        grp.add(tab);
      }
      // Tank-top strobe (every other)
      if (i % 2 === 0) {
        const tip = this._makeRunningLight(0xff3344, 0.20);
        tip.position.set(pos.x, 0.4 + tankH + tankR * 0.6, pos.z);
        tip.userData = { rate: 1.7, phase: Math.random() * 6 };
        grp.add(tip);
        this.standoff?.strobes.push(tip);
      }
    });

    // Pipework spanning between adjacent tanks
    [
      { a: [-5, 0.4 + tankH * 0.4, -3], b: [5, 0.4 + tankH * 0.4, -3] },
      { a: [-5, 0.4 + tankH * 0.4, 3],  b: [5, 0.4 + tankH * 0.4, 3] },
      { a: [-5, 0.4 + tankH * 0.4, -3], b: [-5, 0.4 + tankH * 0.4, 3] },
    ].forEach(p => {
      const ax = p.a[0], ay = p.a[1], az = p.a[2];
      const bx = p.b[0], by = p.b[1], bz = p.b[2];
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const len = Math.hypot(dx, dy, dz);
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, len, 8),
        steel,
      );
      pipe.position.set((ax+bx)/2, (ay+by)/2, (az+bz)/2);
      // Align cylinder Y-axis with the segment direction
      pipe.lookAt(bx, by, bz);
      pipe.rotateX(Math.PI / 2);
      grp.add(pipe);
    });

    // Perimeter chain-link fence (just posts + horizontal rails)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = 10.5;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.0, 4), steel);
      post.position.set(Math.cos(a) * r, 1.0, Math.sin(a) * r);
      grp.add(post);
    }

    grp.position.set(72, -8, 8);
    this.scene.add(grp);
  },

  /* ---------- b171: Antenna array — dense field of comms masts at back-left,
     adds visual density to the otherwise sparse back-left zone. */
  _buildAntennaArray() {
    const grp = new THREE.Group();
    const steel = new THREE.MeshBasicMaterial({ color: 0x14171e });
    const accent = new THREE.MeshBasicMaterial({ color: 0x1e222b });

    // Concrete service pad
    const pad = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 14), accent);
    pad.position.set(0, 0.2, 0);
    grp.add(pad);

    // 8 antennas of varying heights in a loose grid
    const antPositions = [
      { x: -5, z: -5, h: 12 },
      { x:  0, z: -5, h: 16 },
      { x:  5, z: -5, h: 10 },
      { x: -5, z:  0, h:  8 },
      { x:  5, z:  0, h: 14 },
      { x: -5, z:  5, h: 11 },
      { x:  0, z:  5, h:  9 },
      { x:  5, z:  5, h: 13 },
    ];
    antPositions.forEach((p, i) => {
      // Mast
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.10, p.h, 4),
        steel,
      );
      mast.position.set(p.x, p.h / 2, p.z);
      grp.add(mast);
      // Cross arm at mid-height
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.06), steel);
      arm.position.set(p.x, p.h * 0.6, p.z);
      grp.add(arm);
      // Top dipole
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 4), steel);
      top.position.set(p.x, p.h + 0.4, p.z);
      grp.add(top);
      // Strobe (every 3rd has aviation light)
      if (i % 3 === 0) {
        const tip = this._makeRunningLight(0xff3344, 0.22);
        tip.position.set(p.x, p.h + 0.85, p.z);
        tip.userData = { rate: 1.6, phase: Math.random() * 6 };
        grp.add(tip);
        this.standoff?.strobes.push(tip);
      }
      // Guy wires (just diagonals to suggest stability)
      [-1, 1].forEach(s => {
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, p.h * 1.1, 3), steel);
        wire.position.set(p.x + s * 0.8, p.h * 0.3, p.z);
        wire.rotation.z = -s * 0.30;
        grp.add(wire);
      });
    });

    // Small equipment shed at the south edge of the pad
    const shed = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 3), accent);
    shed.position.set(0, 1.2, 6);
    grp.add(shed);
    const shedRoof = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.2, 3.4), steel);
    shedRoof.position.set(0, 2.5, 6);
    grp.add(shedRoof);
    // Lit shed door
    const doorMat = new THREE.MeshBasicMaterial({
      color: 0xffaa55, transparent: true, opacity: 0.60,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), doorMat);
    door.position.set(0, 0.8, 6 + 1.5 + 0.04);
    grp.add(door);

    grp.position.set(-58, -8, -56);
    this.scene.add(grp);
  },

  /* ---------- b171: Watchtowers at perimeter corners ---------- */
  _buildWatchtowers() {
    const steel = new THREE.MeshBasicMaterial({ color: 0x14171e });
    const accent = new THREE.MeshBasicMaterial({ color: 0x1e222b });
    const dark = new THREE.MeshBasicMaterial({ color: 0x0a0c12 });

    // b184: nudged corners outward so all 4 sit OUTSIDE the new perimeter
    // loop (x=±78, z=-90..50). The old "front-right" at (78, -78) sat
    // dead-center on the east leg of the loop; Warthogs were going to
    // drive through it.
    const positions = [
      { x:  88, z:  58, lightColor: 0xff3344 },  // back-right (SE)
      { x: -88, z:  58, lightColor: 0x4488ff },  // back-left  (SW)
      { x:  88, z: -98, lightColor: 0x4488ff },  // front-right (NE)
      { x: -88, z: -98, lightColor: 0xff3344 },  // front-left  (NW)
    ];

    positions.forEach(({ x, z, lightColor }) => {
      const grp = new THREE.Group();
      const towerH = 14;
      const baseW = 2.8;
      // 4 lattice legs
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.10, 0.16, towerH, 4),
          steel,
        );
        leg.position.set(Math.cos(a) * baseW * 0.5, towerH / 2, Math.sin(a) * baseW * 0.5);
        grp.add(leg);
      }
      // Cross-bracing
      for (let h = 1.5; h < towerH - 1; h += 2.2) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(baseW * 0.55, 0.04, 4, 14),
          steel,
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = h;
        grp.add(ring);
      }
      // Cabin at the top — small enclosed booth
      const cabinH = 2.4;
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(baseW * 1.4, cabinH, baseW * 1.4),
        accent,
      );
      cabin.position.y = towerH + cabinH / 2;
      grp.add(cabin);
      // Roof overhang
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(baseW * 1.7, 0.20, baseW * 1.7),
        dark,
      );
      roof.position.y = towerH + cabinH + 0.10;
      grp.add(roof);
      // Lit window strip (warm interior glow)
      const winMat = new THREE.MeshBasicMaterial({
        color: 0xffaa55, transparent: true, opacity: 0.75,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(theta => {
        const win = new THREE.Mesh(
          new THREE.PlaneGeometry(baseW * 1.1, 0.7),
          winMat.clone(),
        );
        win.position.set(
          Math.cos(theta) * (baseW * 0.71),
          towerH + cabinH * 0.6,
          Math.sin(theta) * (baseW * 0.71),
        );
        win.lookAt(
          Math.cos(theta) * 100,
          towerH + cabinH * 0.6,
          Math.sin(theta) * 100,
        );
        win.userData = { rate: 4.5, phase: Math.random() * 6, baseOpacity: 0.75 };
        grp.add(win);
        this.standoff?.windows.push(win);
      });
      // Searchlight on top — slowly rotating beam
      const slMast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.6, 4),
        steel,
      );
      slMast.position.y = towerH + cabinH + 0.5;
      grp.add(slMast);
      const slPivot = new THREE.Group();
      slPivot.position.y = towerH + cabinH + 0.85;
      grp.add(slPivot);
      const slHead = new THREE.Mesh(
        new THREE.CylinderGeometry(0.30, 0.40, 0.6, 8),
        steel,
      );
      slHead.rotation.z = Math.PI / 2;
      slHead.position.x = 0.4;
      slPivot.add(slHead);
      const slLens = this._makeRunningLight(0xfff0c8, 0.36);
      slLens.position.set(0.75, 0, 0);
      slPivot.add(slLens);
      slPivot.userData.spinRate = 0.2 + Math.random() * 0.15;
      this._watchtowerLights ??= [];
      this._watchtowerLights.push(slPivot);
      // Aviation strobe at the tip
      const strobeMast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 4), steel);
      strobeMast.position.y = towerH + cabinH + 1.2;
      grp.add(strobeMast);
      const strobe = this._makeRunningLight(lightColor, 0.45);
      strobe.position.y = towerH + cabinH + 2.0;
      strobe.userData = { rate: 1.7, phase: Math.random() * 6 };
      grp.add(strobe);
      this.standoff?.strobes.push(strobe);

      grp.position.set(x, -8, z);
      this.scene.add(grp);
    });
  },

  /* ---------- b171: Perimeter clutter — jersey walls, fence segments,
     concrete blast walls. Loose props that fill the negative space
     between major buildings without adding more click targets. */
  _buildPerimeterClutter() {
    const concrete = new THREE.MeshBasicMaterial({ color: 0x303848 });
    const steel = new THREE.MeshBasicMaterial({ color: 0x14171e });
    const yellow = new THREE.MeshBasicMaterial({ color: 0x5a4a14 });

    const addJerseyWallLine = (x1, z1, x2, z2) => {
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const ang = Math.atan2(dz, dx);
      const count = Math.floor(len / 2.4);
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        const cx = x1 + dx * t;
        const cz = z1 + dz * t;
        const j = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 0.7), concrete);
        j.position.set(cx, -8 + 0.5, cz);
        j.rotation.y = -ang + Math.PI / 2;
        this.scene.add(j);
      }
    };

    // Jersey walls flanking the spine road shoulders (between launch complex and ops row)
    addJerseyWallLine( 6, -50,  6, -85);
    addJerseyWallLine(-6, -50, -6, -85);
    // Around the parked motor pool
    addJerseyWallLine(28, -42, 48, -42);
    // Between barracks row and the road
    addJerseyWallLine(-58, -16, -22, -16);

    // Floodlight catenary along spine road — pole-mounted lights
    for (let i = 0; i < 5; i++) {
      const z = -20 - i * 16;
      [-7, 7].forEach(x => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 7, 4), steel);
        pole.position.set(x, -8 + 3.5, z);
        this.scene.add(pole);
        const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.15, 0.55), steel);
        lampHead.position.set(x - Math.sign(x) * 0.6, -8 + 6.7, z);
        this.scene.add(lampHead);
        const lens = this._makeRunningLight(0xffe6a0, 0.18);
        lens.position.set(x - Math.sign(x) * 0.9, -8 + 6.6, z);
        this.scene.add(lens);
        // Down-cast cone
        const coneTex = this._makeFloodConeTexture();
        const coneMat = new THREE.SpriteMaterial({
          map: coneTex, transparent: true, depthWrite: false,
          blending: THREE.AdditiveBlending, opacity: 0.22, color: 0xffe6a0,
        });
        const cone = new THREE.Sprite(coneMat);
        cone.scale.set(5, 7, 1);
        cone.center.set(0.5, 1.0);
        cone.position.set(x - Math.sign(x) * 1.5, -8 + 6.0, z);
        this.scene.add(cone);
      });
    }

    // Chain-link fence around the perimeter — posts only, every 8u out at r=92
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const r = 92;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 4), steel);
      post.position.set(Math.cos(a) * r, -8 + 1.2, Math.sin(a) * r);
      this.scene.add(post);
      // Short top barb segment
      if (i % 2 === 0) {
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.8), steel);
        top.position.set(Math.cos(a) * (r + 0.2), -8 + 2.5, Math.sin(a) * (r + 0.2));
        top.rotation.y = a;
        this.scene.add(top);
      }
    }
  },

  /* ---------- b171: Focused volumetric flood beams ON major structures ----
     b169 added uplight halo SPRITES at building bases — those produced a
     glow column but didn't actually illuminate the structure. This adds
     focused VOLUMETRIC CONES aimed AT the structure body (silo/dish/etc)
     so they read as lit, not silhouetted. */
  _buildBuildingFloodBeams() {
    const beamTex = this._makeFloodConeTexture();
    const addBeam = (sx, sz, tx, ty, tz, scaleY = 14, scaleX = 5, color = 0xffe6a0, opacity = 0.30) => {
      // sx,sz: spotlight ground origin; tx,ty,tz: aim point on the structure
      // Ground spotlight fixture (small box at the source)
      const fixt = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.4, 0.5),
        new THREE.MeshBasicMaterial({ color: 0x14171e }),
      );
      fixt.position.set(sx, -8 + 0.2, sz);
      fixt.lookAt(tx, ty, tz);
      this.scene.add(fixt);
      // Lens
      const lens = this._makeRunningLight(color, 0.28);
      lens.position.set(sx, -8 + 0.30, sz);
      this.scene.add(lens);
      // Volumetric cone sprite — pivot at base, aimed at target
      const coneMat = new THREE.SpriteMaterial({
        map: beamTex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity, color,
      });
      const cone = new THREE.Sprite(coneMat);
      cone.scale.set(scaleX, scaleY, 1);
      cone.center.set(0.5, 0.0);
      // Sprites always face camera — to suggest a directional beam we place
      // multiple along the path from source toward target.
      const dx = tx - sx, dy = ty - (-8 + 0.30), dz = tz - sz;
      const len = Math.hypot(dx, dy, dz);
      const steps = 4;
      for (let s = 0; s < steps; s++) {
        const f = s / steps;
        const c = new THREE.Sprite(coneMat.clone());
        c.scale.set(scaleX * (0.4 + f * 0.6), scaleY * 0.3, 1);
        c.position.set(sx + dx * f, (-8 + 0.30) + dy * f, sz + dz * f);
        this.scene.add(c);
      }
      // Bright spot at the target (where the beam HITS the structure)
      const hitGlow = this._makeRunningLight(color, 0.55);
      hitGlow.position.set(tx, ty, tz);
      this.scene.add(hitGlow);
    };

    // Beams onto the central dish (multiple angles to really light it up)
    addBeam( 30, -95, 15,  4, -110, 18, 7, 0xfff0c8, 0.40);
    addBeam(  0, -95, 15,  4, -110, 18, 7, 0xfff0c8, 0.40);
    addBeam(-15, -95, 15,  4, -110, 18, 7, 0xffd9a4, 0.34);
    // Beams onto the missile silo
    addBeam(-46, -78, -55, 6, -84, 14, 6, 0xffaa55, 0.45);
    addBeam(-66, -78, -55, 6, -84, 14, 6, 0xffaa55, 0.45);
    addBeam(-46, -94, -55, 6, -84, 14, 6, 0xffd9a4, 0.40);
    // Beams onto the standoff back-right dish
    addBeam( 50,  46,  58, 8,  58, 16, 6, 0xff99cc, 0.35);
    addBeam( 66,  46,  58, 8,  58, 16, 6, 0xff99cc, 0.35);
    // Beams onto the standoff back-left dish
    addBeam(-62, -56, -72, 8, -45, 16, 6, 0x88aaff, 0.35);
    addBeam(-82, -36, -72, 8, -45, 16, 6, 0x88aaff, 0.35);
    // Beams onto the cmd bunker
    addBeam(-30, -58, -40, 4, -71, 12, 5, 0xb8d4ff, 0.34);
    addBeam(-50, -58, -40, 4, -71, 12, 5, 0xb8d4ff, 0.34);
    // Beams onto the radar building
    addBeam( 12, -34, 20, 3, -47, 10, 4, 0xb8d4ff, 0.32);
    addBeam( 28, -34, 20, 3, -47, 10, 4, 0xb8d4ff, 0.32);
    // Beam onto the comm tower
    addBeam(-30, -16, -38, 8, -24, 14, 4, 0xb8d4ff, 0.30);
    // Beam onto the antenna array
    addBeam(-50, -46, -58, 8, -56, 14, 5, 0xb8d4ff, 0.30);
    // Beam onto the fuel depot
    addBeam( 60,   0, 72, 4,   8, 12, 5, 0xfff0c8, 0.32);
  },

  /* ---------- b173: pre-build every panel-host body up-front, so panel
     mounts only add trim. Lets the panel remap (option A) move panels off
     buildings without losing the building itself. */
  _buildAllStructures() {
    this._builtBuildings ??= new Set();
    const ensure = (kind, fn) => {
      if (this._builtBuildings.has(kind)) return;
      this._builtBuildings.add(kind);
      fn.call(this);
    };
    ensure('cmdbunker',     this._buildCmdBunker);
    ensure('radarbuilding', this._buildRadarBuilding);
    ensure('vehiclebay',    this._buildVehicleBay);
    ensure('barracks',      this._buildBarracksBig);
    ensure('supplydepot',   this._buildSupplyDepot);
    ensure('commtower',     this._buildCommTowerBig);
    ensure('helipad',       this._buildHelipad);
    ensure('missilesite',   this._buildMissileSite);
  },

  /* ---------- b173: extra lit window grids on existing buildings ----
     Adds canvas-textured window-grid emissive panels on the camera-facing
     faces of the major buildings, so they read as occupied/in-use rather
     than dark concrete silhouettes. Each window's opacity is registered
     in `standoff.windows` so the existing flicker tick animates them. */
  _buildBuildingWindows() {
    const make = (cols, rows, color) => {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 256, 128);
      const cw = 256 / cols, rh = 128 / rows;
      for (let r = 0; r < rows; r++) {
        for (let cc = 0; cc < cols; cc++) {
          // Random fraction of windows lit
          if (Math.random() < 0.65) {
            const lit = 0.55 + Math.random() * 0.40;
            const cx = cc * cw + cw * 0.18;
            const cy = r * rh + rh * 0.22;
            ctx.fillStyle = `rgba(${(0xff*lit)|0}, ${(0xaa*lit)|0}, ${(0x55*lit)|0}, 1)`;
            ctx.fillRect(cx, cy, cw * 0.64, rh * 0.56);
          }
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      mat.userData = { rate: 4.0 + Math.random() * 2, phase: Math.random() * 6, baseOpacity: 0.85 };
      return mat;
    };

    const addGrid = (x, y, z, w, h, lookAtVec, cols, rows) => {
      const mat = make(cols, rows);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      plane.position.set(x, y, z);
      plane.lookAt(lookAtVec);
      plane.userData = mat.userData;
      this.standoff?.windows.push(plane);
      this.scene.add(plane);
    };
    const cam = new THREE.Vector3(0, 0, 0);

    // Cmd bunker at world (-40, -8, -71). Front face camera-facing at z = -71 + 12/2 = -65.
    addGrid(-40, -8 + 6, -65 + 0.05, 14, 4, cam, 6, 2);
    // Radar building at (20, -8, -47.5). Front face at z = -42.5.
    addGrid(20, -8 + 3.0, -42.5 + 0.05, 9, 2.5, cam, 5, 2);
    // Vehicle bay at (50, -8, -25). Side wall facing camera (left side at x=43): face the camera through east face.
    addGrid(50 - 7.2, -8 + 4.0, -25, 9, 4, cam, 4, 2);
    // Big barracks at (-65, -8, -22). Front face camera-facing at z = -22 + 16/2 = -14.
    addGrid(-65, -8 + 3.6, -14 + 0.05, 8, 2.4, cam, 5, 2);
    // Supply depot at (65, -8, -13). Front face at z = -13 + 12/2 = -7.
    addGrid(65, -8 + 4.5, -7 + 0.05, 7, 2, cam, 5, 2);
    // Standoff bunker at (42, -8, -38) — close-ish, light its long side
    addGrid(42, -8 + 2.4, -38 + 4.5, 5, 1.5, cam, 4, 1);
    // Standoff bunker at (-30, -8, 48)
    addGrid(-30, -8 + 2.0, 48 + 3.0, 4, 1.4, cam, 3, 1);

    // Wall-mounted exterior lamps along big buildings (warm cone splash)
    const lampCone = this._makeFloodConeTexture();
    const addLamp = (x, y, z, dir = -1) => {
      // Lamp fixture
      const f = new THREE.Mesh(
        new THREE.BoxGeometry(0.20, 0.14, 0.22),
        new THREE.MeshBasicMaterial({ color: 0x14171e }),
      );
      f.position.set(x, y, z);
      this.scene.add(f);
      // Lens
      const lens = this._makeRunningLight(0xffe6a0, 0.22);
      lens.position.set(x, y - 0.05, z + dir * 0.18);
      this.scene.add(lens);
      // Down-cast cone (b182: opacity 0.18→0.32 + scale 2.4×4→3.2×5.2)
      const mat = new THREE.SpriteMaterial({
        map: lampCone, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0.32, color: 0xffe6a0,
      });
      const cone = new THREE.Sprite(mat);
      cone.scale.set(3.2, 5.2, 1);
      cone.center.set(0.5, 1.0);
      cone.position.set(x, y - 0.30, z + dir * 0.4);
      this.scene.add(cone);
    };
    // Cmd bunker — 3 lamps along front face top edge
    [-5, 0, 5].forEach(xo => addLamp(-40 + xo, -8 + 11 - 0.2, -65 + 0.15, 1));
    // Big barracks — 4 lamps
    [-2.5, -0.5, 1.5, 3.5].forEach(xo => addLamp(-65 + xo, -8 + 6 - 0.2, -14 + 0.15, 1));
    // Supply depot — 2 lamps on top container
    [-2, 2].forEach(xo => addLamp(65 + xo, -8 + 6 - 0.2, -7 + 0.15, 1));
    // Radar building — 2 lamps
    [-3, 3].forEach(xo => addLamp(20 + xo, -8 + 5 - 0.2, -42.5 + 0.15, 1));
    // b182: lamps for previously-unlit buildings -----------------
    // Missile silo (-55, -8, -84): front face at z=-78
    [-3, 0, 3].forEach(xo => addLamp(-55 + xo, -8 + 6.5, -78 + 0.15, 1));
    // Vehicle bay (50, -8, -27): front (z=-19), 2 lamps
    [-3, 3].forEach(xo => addLamp(50 + xo, -8 + 4.0, -19 + 0.15, 1));
    // Comm tower base (-38, -8, -24): front face splash
    [-2, 2].forEach(xo => addLamp(-38 + xo, -8 + 3.5, -19 + 0.15, 1));
    // Biostation (12, -8, ~38): front face splash
    [-2, 2].forEach(xo => addLamp(12 + xo, -8 + 4.0, 32 + 0.15, 1));
    // Antenna shed (-58, -8, -49)
    [-2, 2].forEach(xo => addLamp(-58 + xo, -8 + 3.5, -45 + 0.15, 1));
  },

  /* ---------- b173: Pelican area lighting ----
     Cockpit windows on, nav lights (red port / green starboard / tail
     strobe), open rear ramp with warm interior glow, plus 4 portable
     construction floodlight stands around the pad aimed AT the Pelican. */
  _buildPelicanLights() {
    // Pelican pad world center: (-2, -8, 24). Pelican on top at y=-8 + padH(1.2) + 1.8 = -5.0.
    // b187: pulled forward from z=48 to z=24 to clear the south perimeter road (z=50±4.5).
    const padX = -2, padY = -8, padZ = 24;
    const pelY = padY + 3.0;

    // Cockpit window glow (3 small lights at the front of the pelican)
    [-0.7, 0, 0.7].forEach(dx => {
      const w = this._makeRunningLight(0xffe6a0, 0.30);
      // Pelican faces +Z (rotation Math.PI), so cockpit at -Z relative to pelican = world +Z
      w.position.set(padX + dx, pelY + 0.5, padZ + 3.5);
      this.scene.add(w);
    });
    // Nav lights — red port (left) + green starboard (right) at wingtips
    const portNav = this._makeRunningLight(0xff3344, 0.32);
    portNav.position.set(padX - 5.0, pelY + 0.85, padZ);  // left wingtip
    portNav.userData = { rate: 1.4, phase: 0 };
    this.scene.add(portNav);
    this.standoff?.strobes.push(portNav);
    const stbdNav = this._makeRunningLight(0x33ff66, 0.32);
    stbdNav.position.set(padX + 5.0, pelY + 0.85, padZ);  // right wingtip
    stbdNav.userData = { rate: 1.4, phase: Math.PI };
    this.scene.add(stbdNav);
    this.standoff?.strobes.push(stbdNav);
    // Tail strobe
    const tailStrobe = this._makeRunningLight(0xfff0c8, 0.40);
    tailStrobe.position.set(padX, pelY + 1.4, padZ - 4.0);
    tailStrobe.userData = { rate: 2.6, phase: Math.random() * 6 };
    this.scene.add(tailStrobe);
    this.standoff?.strobes.push(tailStrobe);
    // Rear ramp warm glow (open ramp interior)
    const rampGlow = this._makeRunningLight(0xffaa55, 0.55);
    rampGlow.position.set(padX, pelY - 0.3, padZ - 4.6);
    this.scene.add(rampGlow);
    // Ramp itself — a flat plane angled down behind the pelican
    const rampMat = new THREE.MeshBasicMaterial({ color: 0x2a2e22 });
    const ramp = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.5), rampMat);
    ramp.position.set(padX, pelY - 0.6, padZ - 5.5);
    ramp.rotation.x = -Math.PI * 0.42;  // tilt down toward pad
    this.scene.add(ramp);

    // 4 portable construction floodlight stands around the pad, aimed at pelican
    const standMat = new THREE.MeshBasicMaterial({ color: 0x3a3416 });  // yellow-ish construction
    const standDark = new THREE.MeshBasicMaterial({ color: 0x14171e });
    const coneTex = this._makeFloodConeTexture();
    const standPositions = [
      { x: padX - 11, z: padZ + 1, color: 0xfff0c8 },
      { x: padX + 11, z: padZ + 1, color: 0xfff0c8 },
      { x: padX - 8,  z: padZ + 9, color: 0xfff0c8 },
      { x: padX + 8,  z: padZ + 9, color: 0xfff0c8 },
    ];
    standPositions.forEach(s => {
      const grp = new THREE.Group();
      grp.position.set(s.x, padY, s.z);
      // Tripod legs (3 splayed cylinders)
      [0, Math.PI * 2 / 3, Math.PI * 4 / 3].forEach(theta => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.6, 4), standDark);
        leg.position.set(Math.cos(theta) * 0.35, 0.7, Math.sin(theta) * 0.35);
        leg.rotation.z = -Math.cos(theta) * 0.30;
        leg.rotation.x = -Math.sin(theta) * 0.30;
        grp.add(leg);
      });
      // Vertical pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 4), standDark);
      pole.position.y = 1.3;
      grp.add(pole);
      // Lamp head (yellow construction housing)
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.40, 0.32), standMat);
      head.position.y = 2.5;
      head.lookAt(padX, pelY, padZ);
      grp.add(head);
      // Lens
      const lens = this._makeRunningLight(s.color, 0.28);
      const dirToPel = new THREE.Vector3(padX - s.x, pelY - (padY + 2.5), padZ - s.z).normalize();
      lens.position.set(dirToPel.x * 0.20, 2.5 + dirToPel.y * 0.20, dirToPel.z * 0.20);
      grp.add(lens);
      // Volumetric beam aimed at the pelican
      const beamMat = new THREE.SpriteMaterial({
        map: coneTex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0.32, color: s.color,
      });
      // 3 sprite chain along path
      const dx = padX - s.x, dy = pelY - (padY + 2.5), dz = padZ - s.z;
      const len = Math.hypot(dx, dy, dz);
      for (let k = 1; k <= 3; k++) {
        const f = k / 4;
        const sp = new THREE.Sprite(beamMat.clone());
        sp.scale.set(2.0 * (0.5 + f), 4.0 * f, 1);
        sp.position.set(dx * f, 2.5 + dy * f, dz * f);
        grp.add(sp);
      }
      // Warning strobe on top of the lamp head
      const tip = this._makeRunningLight(0xffaa55, 0.16);
      tip.position.y = 2.85;
      tip.userData = { rate: 2.0, phase: Math.random() * 6 };
      grp.add(tip);
      this.standoff?.strobes.push(tip);
      this.scene.add(grp);
    });
  },

  /* ---------- b173: ODST engineer crew around the pelican ----
     Three procedural humanoid figures with helmet+cyan-visor, torso, arms,
     legs as primitives. ~2u tall. Closed-helmet ODST style — no open faces. */
  _buildEngineerCrew() {
    const padX = -2, padZ = 24;
    const pelY = -8 + 3.0;
    const ground = -8;

    const armor = new THREE.MeshBasicMaterial({ color: 0x1f2218 });        // ODST dark olive
    const armorHi = new THREE.MeshBasicMaterial({ color: 0x2c3122 });      // shoulder/chest plate accent
    const visorRim = new THREE.MeshBasicMaterial({ color: 0x0c0e14 });     // helmet shell
    const glove = new THREE.MeshBasicMaterial({ color: 0x14171e });

    const buildEngineer = (poseKneeling) => {
      const g = new THREE.Group();
      const scale = 1.0;
      // Legs
      const legGeo = new THREE.CylinderGeometry(0.10, 0.10, 0.85 * scale, 6);
      [-1, 1].forEach(s => {
        const leg = new THREE.Mesh(legGeo, armor);
        if (poseKneeling && s === 1) {
          // Right knee bent: shorter visible leg, knee forward
          leg.position.set(s * 0.18, 0.30, 0.20);
          leg.rotation.x = 0.85;
        } else {
          leg.position.set(s * 0.18, 0.42, 0);
        }
        g.add(leg);
      });
      // Boots
      [-1, 1].forEach(s => {
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.12, 0.32), glove);
        boot.position.set(s * 0.18, 0.06, poseKneeling && s === 1 ? 0.50 : 0.05);
        g.add(boot);
      });
      // Torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.58, 0.32), armor);
      torso.position.set(0, poseKneeling ? 1.05 : 1.15, 0);
      g.add(torso);
      // Chest plate
      const chest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.06), armorHi);
      chest.position.set(0, poseKneeling ? 1.15 : 1.25, 0.18);
      g.add(chest);
      // Shoulder pauldrons
      [-1, 1].forEach(s => {
        const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.30), armorHi);
        pauldron.position.set(s * 0.34, poseKneeling ? 1.30 : 1.40, 0);
        g.add(pauldron);
      });
      // Arms
      [-1, 1].forEach(s => {
        const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.42, 6), armor);
        upper.position.set(s * 0.36, poseKneeling ? 1.10 : 1.20, 0);
        g.add(upper);
        const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.42, 6), armor);
        if (poseKneeling) {
          // Forearm out toward 'panel' — angled forward
          lower.position.set(s * 0.36, 0.85, 0.30);
          lower.rotation.x = Math.PI / 2;
        } else {
          lower.position.set(s * 0.36, 0.79, 0.05);
          lower.rotation.x = 0.2;
        }
        g.add(lower);
        const fist = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.14), glove);
        if (poseKneeling) {
          fist.position.set(s * 0.36, 0.80, 0.55);
        } else {
          fist.position.set(s * 0.36, 0.55, 0.12);
        }
        g.add(fist);
      });
      // Helmet — ODST closed style: rounded shell + flat front for visor
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 8), visorRim);
      helmet.position.set(0, poseKneeling ? 1.50 : 1.65, 0);
      g.add(helmet);
      // Faceplate / visor (cyan glowing rectangle on the front)
      const visor = new THREE.Mesh(
        new THREE.PlaneGeometry(0.28, 0.12),
        new THREE.MeshBasicMaterial({
          color: 0x66e0ff, transparent: true, opacity: 0.85,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      visor.position.set(0, poseKneeling ? 1.50 : 1.65, 0.20);
      g.add(visor);
      // Visor "running light" (point glow)
      const visorGlow = this._makeRunningLight(0x66e0ff, 0.10);
      visorGlow.position.set(0, poseKneeling ? 1.50 : 1.65, 0.22);
      g.add(visorGlow);
      // Helmet cap detail
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 0.06, 8), armorHi);
      cap.position.set(0, poseKneeling ? 1.62 : 1.77, 0);
      g.add(cap);
      return g;
    };

    // Engineer 1 — kneeling at access panel near rear ramp (right of ramp)
    const e1 = buildEngineer(true);
    e1.position.set(padX + 1.6, ground + 1.2, padZ - 6.0);  // slightly elevated on the pad
    e1.rotation.y = -Math.PI / 4;
    this.scene.add(e1);
    // Engineer 2 — standing, holding clipboard, at left rear of pelican
    const e2 = buildEngineer(false);
    e2.position.set(padX - 2.2, ground + 1.2, padZ - 5.0);
    e2.rotation.y = Math.PI / 6;
    // Add a small clipboard prop in left hand
    const clip = new THREE.Mesh(
      new THREE.BoxGeometry(0.30, 0.40, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x4a4a32 }),
    );
    clip.position.set(-0.36, 0.55, 0.20);
    e2.add(clip);
    this.scene.add(e2);
    // Engineer 3 — standing, beside the right wing inspection point
    const e3 = buildEngineer(false);
    e3.position.set(padX + 4.5, ground + 1.2, padZ + 1.0);
    e3.rotation.y = -Math.PI / 2;
    this.scene.add(e3);
  },

  /* ---------- b184: GP-medium tents + walking personnel ----
     Two bivouac clusters of canvas tents flank the deck on the inside of
     the perimeter loop, between the major buildings. Personnel sprites
     walk back-and-forth between waypoint pairs (tent ↔ building) so the
     base reads as occupied, not deserted. */
  _makeTent(w = 4.0, l = 5.5, h = 2.4) {
    const olive = new THREE.MeshBasicMaterial({ color: 0x363f2c });
    const oliveD = new THREE.MeshBasicMaterial({ color: 0x232a1c });
    const positions = new Float32Array([
      -w/2, 0,  l/2,
       w/2, 0,  l/2,
      -w/2, 0, -l/2,
       w/2, 0, -l/2,
         0, h,  l/2,
         0, h, -l/2,
    ]);
    const indices = [
      0, 1, 4,                 // front gable
      3, 2, 5,                 // back gable
      2, 0, 4,  2, 4, 5,       // left slope
      1, 3, 5,  1, 5, 4,       // right slope
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(geo, olive));
    // Door flap on the front face — slightly darker rectangle
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, h * 0.7), oliveD);
    door.position.set(0, h * 0.35, l/2 + 0.005);
    grp.add(door);
    // Faint warm interior glow (canvas-lit-from-within)
    const glow = this._makeRunningLight(0xffaa55, 0.08);
    glow.scale.set(2.4, 1.4, 1);
    glow.position.set(0, h * 0.45, l/2 + 0.04);
    grp.add(glow);
    return grp;
  },

  _buildTents() {
    const cluster = (cx, cz, jitterRot = 0) => {
      const layout = [
        { dx:  0,    dz:  0,    yaw:  0.05 },
        { dx: -5.2,  dz:  1.6,  yaw: -0.18 },
        { dx:  5.4,  dz: -1.4,  yaw:  0.22 },
      ];
      layout.forEach(spec => {
        const tent = this._makeTent(4.0, 5.5, 2.4);
        tent.position.set(cx + spec.dx, -8, cz + spec.dz);
        tent.rotation.y = spec.yaw + jitterRot;
        this.scene.add(tent);
      });
    };
    // West bivouac — between the deck and the barracks row
    cluster(-50, 6, 0.18);
    // East bivouac — between the deck and the supply depot
    cluster( 50, 6, -0.20);
    // North bivouac — pulled west to clear the spine road (x=0±4.5).
    // Was (-8, -56) which put the +5.4-offset tent at x=-2.6 ON the road.
    cluster(-22, -56, 0.05);
  },

  _buildPersonnel() {
    this.personnel = [];
    const olive  = new THREE.MeshBasicMaterial({ color: 0x4a5238 });
    const skin   = new THREE.MeshBasicMaterial({ color: 0xb89072 });
    const dark   = new THREE.MeshBasicMaterial({ color: 0x14171e });
    const accent = new THREE.MeshBasicMaterial({ color: 0x2a3022 });

    const makeFigure = () => {
      const grp = new THREE.Group();
      // Torso
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.85, 0.30), olive);
      body.position.y = 1.05;
      grp.add(body);
      // Vest plate
      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.50, 0.06), accent);
      vest.position.set(0, 1.10, 0.16);
      grp.add(vest);
      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), skin);
      head.position.y = 1.65;
      grp.add(head);
      // Helmet
      const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.34), dark);
      helmet.position.y = 1.78;
      grp.add(helmet);
      // Legs (animated via rotation in tick)
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.65, 0.20), olive);
      legL.position.set(-0.13, 0.35, 0);
      legL.userData.isLeg = true;
      legL.userData.side = -1;
      grp.add(legL);
      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.65, 0.20), olive);
      legR.position.set( 0.13, 0.35, 0);
      legR.userData.isLeg = true;
      legR.userData.side = 1;
      grp.add(legR);
      // Boots
      [-0.13, 0.13].forEach(lx => {
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.10, 0.30), dark);
        boot.position.set(lx, 0.05, 0.04);
        grp.add(boot);
      });
      // Rifle (slung horizontally on chest)
      const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.85), dark);
      rifle.position.set(0, 1.10, 0.22);
      rifle.rotation.y = 0.18;
      grp.add(rifle);
      grp.userData.legL = legL;
      grp.userData.legR = legR;
      return grp;
    };

    // Walking routes — pairs of waypoints inside the perimeter loop.
    // Carefully picked to NOT cross the spine road (x=0) except at the
    // front-cross walkway (z=-30) where it makes sense for soldiers to.
    const routes = [
      { from: [-50,  6], to: [-65, -10], speed: 1.8 },  // W bivouac → barracks
      { from: [-50,  6], to: [-30, -30], speed: 1.7 },  // W bivouac → mid walk
      { from: [ 50,  6], to: [ 50, -22], speed: 1.7 },  // E bivouac → vehicle bay
      { from: [ 50,  6], to: [ 65, -13], speed: 1.6 },  // E bivouac → supply depot
      { from: [-30, -30], to: [ 30, -30], speed: 2.0 }, // soldier crossing midbase
      { from: [ 20, -47], to: [ 50, -27], speed: 1.5 }, // radar → vehicle bay
      { from: [-40, -65], to: [-20, -55], speed: 1.4 }, // cmdbunker area runner
      { from: [-22, -56], to: [-30, -50], speed: 1.6 }, // N bivouac → mid
    ];
    routes.forEach((r, i) => {
      const fig = makeFigure();
      fig.userData.from = new THREE.Vector2(r.from[0], r.from[1]);
      fig.userData.to   = new THREE.Vector2(r.to[0],   r.to[1]);
      fig.userData.dist = fig.userData.from.distanceTo(fig.userData.to);
      fig.userData.speed = r.speed;
      fig.userData.t = Math.random() * 30;
      this.scene.add(fig);
      this.personnel.push(fig);
    });
  },

  _tickPersonnel(dt, t) {
    if (!this.personnel) return;
    this.personnel.forEach(fig => {
      const ud = fig.userData;
      ud.t += dt * ud.speed;
      const cycle = ud.dist * 2;
      const phase = ((ud.t % cycle) + cycle) % cycle;
      const k = phase < ud.dist ? phase / ud.dist : 2 - phase / ud.dist;
      const x = ud.from.x + (ud.to.x - ud.from.x) * k;
      const z = ud.from.y + (ud.to.y - ud.from.y) * k;
      const goingForward = phase < ud.dist;
      const dirX = (ud.to.x - ud.from.x) * (goingForward ? 1 : -1);
      const dirZ = (ud.to.y - ud.from.y) * (goingForward ? 1 : -1);
      // Mesh forward = -Z. Yaw to align -Z with (dirX, dirZ): θ = atan2(-dirX, -dirZ)
      fig.rotation.y = Math.atan2(-dirX, -dirZ);
      // Gait: vertical bob + leg swing
      const stride = ud.t * 4.5;
      const bob = Math.abs(Math.sin(stride)) * 0.06;
      fig.position.set(x, -8 + bob, z);
      if (ud.legL) ud.legL.rotation.x =  Math.sin(stride) * 0.6;
      if (ud.legR) ud.legR.rotation.x = -Math.sin(stride) * 0.6;
    });
  },

  /* ---------- b173: Halo Scorpion tank — 1 parked + 1 patrolling ---- */
  _buildScorpionMesh() {
    // UNSC M808B Scorpion silhouette: wide hull, two long track skids,
    // turret with main gun + forward MG bubble, headlights.
    const grp = new THREE.Group();
    const olive = new THREE.MeshBasicMaterial({ color: 0x3a4030 });
    const oliveHi = new THREE.MeshBasicMaterial({ color: 0x4d5440 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x14171e });
    const tread = new THREE.MeshBasicMaterial({ color: 0x0c0e14 });

    // Main hull (wide and squat)
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.85, 5.5), olive);
    hull.position.y = 0.85;
    grp.add(hull);
    // Hull top sloped front block
    const front = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.40, 1.6), oliveHi);
    front.position.set(0, 1.15, -1.6);
    grp.add(front);

    // Two outboard track sponsons (Scorpion has 4 quad tracks — 2 left, 2 right)
    [-1, 1].forEach(side => {
      // Outer track sponson (long block)
      const sponson = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.0, 5.8), olive);
      sponson.position.set(side * 2.30, 0.55, 0);
      grp.add(sponson);
      // Track itself (dark band along the side of the sponson)
      const trk = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.80, 5.6), tread);
      trk.position.set(side * 2.80, 0.50, 0);
      grp.add(trk);
      // Road wheels (5 per track)
      for (let w = 0; w < 5; w++) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.28, 8), dark);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * 2.55, 0.30, -2.2 + w * 1.10);
        grp.add(wheel);
      }
      // Skid plate
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.20, 5.6), dark);
      skid.position.set(side * 2.30, 0.10, 0);
      grp.add(skid);
    });

    // Turret base (round drum on hull top)
    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.35, 12), oliveHi);
    turretBase.position.set(0, 1.45, 0.30);
    grp.add(turretBase);
    // Turret body (boxy)
    const turret = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 1.8), olive);
    turret.position.set(0, 1.95, 0.30);
    grp.add(turret);
    // Turret rear extension
    const turretBack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.9), oliveHi);
    turretBack.position.set(0, 1.85, 1.30);
    grp.add(turretBack);
    // Main gun (90mm) — long cylinder forward
    const mainGun = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 3.5, 8), dark);
    mainGun.rotation.x = Math.PI / 2;
    mainGun.position.set(0, 2.05, -1.55);
    grp.add(mainGun);
    // Muzzle brake
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.30, 8), tread);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 2.05, -3.20);
    grp.add(muzzle);
    // Mantlet (where gun meets turret)
    const mantlet = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.45), dark);
    mantlet.position.set(0, 2.05, -0.30);
    grp.add(mantlet);
    // MG bubble on top-front of turret
    const mgBubble = new THREE.Mesh(new THREE.SphereGeometry(0.30, 10, 8), oliveHi);
    mgBubble.position.set(0.55, 2.40, -0.30);
    grp.add(mgBubble);
    const mgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), dark);
    mgBarrel.rotation.x = Math.PI / 2;
    mgBarrel.position.set(0.55, 2.40, -0.85);
    grp.add(mgBarrel);

    // Headlights (front of hull)
    const hl1 = this._makeRunningLight(0xfff0c8, 0.30);
    hl1.position.set(-1.30, 1.10, -2.85);
    hl1.userData = { isRunningLight: true, blinkSeed: 99 };
    grp.add(hl1);
    const hl2 = this._makeRunningLight(0xfff0c8, 0.30);
    hl2.position.set(1.30, 1.10, -2.85);
    hl2.userData = { isRunningLight: true, blinkSeed: 99 };
    grp.add(hl2);
    // Tail-light
    const tl = this._makeRunningLight(0xff3344, 0.18);
    tl.position.set(0, 1.10, 2.85);
    grp.add(tl);

    grp.userData.headlights = [hl1, hl2];
    grp.userData.wheels = grp.children.filter(
      c => c.geometry?.type === 'CylinderGeometry' && c.geometry.parameters.height === 0.28,
    );
    return grp;
  },

  _buildScorpions() {
    // 1 parked in the motor pool (front-right cluster, on the gravel apron
    // beside the parked Warthogs but offset so it reads as the "heavy" zone).
    const parked = this._buildScorpionMesh();
    parked.position.set(40, -8, -38);
    parked.rotation.y = Math.PI * 0.65;
    this.scene.add(parked);

    // b182: tank patrols the SAME perimeter loop as the Warthog, but
    // CLOCKWISE and offset by half a loop so the two vehicles read as
    // coordinated patrol — they meet on opposite sides of the base.
    const mover = this._buildScorpionMesh();
    mover.userData.t = 296;  // total/2 = 592/2 — start opposite the Warthog
    this.scene.add(mover);
    this.patrolScorpion = mover;
  },

  _tickPatrolScorpion(dt, t) {
    if (!this.patrolScorpion) return;
    const ud = this.patrolScorpion.userData;
    ud.t += dt * 8.5;  // slower than the Warthog (~70s/loop), it's a tank
    const p = this._samplePerimeter(ud.t, false);  // clockwise
    this.patrolScorpion.position.set(p.x, -8, p.z);
    this.patrolScorpion.rotation.y = p.yaw;
    if (ud.wheels) {
      ud.wheels.forEach(w => { w.rotation.x += dt * 4; });
    }
    // Headlight flicker while moving
    if (ud.headlights) {
      ud.headlights.forEach(h => {
        h.material.opacity = 0.85 + Math.sin(t * 8 + h.position.x) * 0.10;
      });
    }
  },

  /* ---------- Standoff: dishes, towers, bunkers, sandbags, ridgeline ---------- */
  _buildStandoff() {
    this.standoff = { dishes: [], strobes: [], windows: [] };

    // Distant ridgeline silhouette ring — kills the void at the horizon.
    this._buildRidgeline();

    // Two satellite dishes (the iconic Standoff feature). Placed off the
    // panel arc so their bulk reads above the panel tops without occluding
    // the panel arc itself.
    this._buildDish( 58, -8,  58, 11, 0xff3344, 1.2);   // back-right, red strobe
    this._buildDish(-72, -8, -45, 13, 0x4488ff, -0.7);  // back-left,  blue strobe

    // Comm towers — tall lattice, blinking aviation strobes
    this._buildCommTower( 38, -8,  44, 22, 0xff3344);
    this._buildCommTower(-46, -8, -28, 26, 0x4488ff);
    this._buildCommTower(-12, -8,  62, 18, 0xff3344);
    this._buildCommTower( 48, -8, -22, 20, 0x4488ff);

    // Low bunker silhouettes with warm interior window glow
    this._buildBunker( 42, -8, -38, 7, 4.0, 9, 0xffaa55);
    this._buildBunker(-30, -8,  48, 8, 3.5, 6, 0xffaa55);
    this._buildBunker(-58, -8,  10, 6, 3.0, 6, 0xffaa55);

    // b171: removed loose sandbag berms — the hex observation deck now has
    // its own integrated sandbag wrap, and the loose berms here were
    // floating awkwardly between buildings.
  },

  _buildRidgeline() {
    // Two concentric jagged ridge rings (near + far) for parallax depth.
    const buildRing = (segs, baseR, jitterR, baseH, jitterH, color) => {
      const positions = [];
      const indices = [];
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const r = baseR + (Math.sin(a * 2.3) + Math.sin(a * 5.7 + 0.8)) * jitterR * 0.4 + Math.random() * jitterR;
        const h = baseH + Math.sin(a * 3.7) * jitterH * 0.4 + Math.sin(a * 8.1 + 1.3) * jitterH * 0.3 + Math.random() * jitterH;
        positions.push(Math.cos(a) * r, -8, Math.sin(a) * r);
        positions.push(Math.cos(a) * r, -8 + h, Math.sin(a) * r);
      }
      for (let i = 0; i < segs; i++) {
        const a0 = i * 2;
        const a1 = i * 2 + 1;
        const b0 = ((i + 1) % segs) * 2;
        const b1 = ((i + 1) % segs) * 2 + 1;
        indices.push(a0, b0, a1, b0, b1, a1);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
      this.scene.add(new THREE.Mesh(geo, mat));
    };
    buildRing(112, 100, 12,  6, 7,  0x080a12);  // near ridge
    buildRing( 72, 165, 16, 14, 10, 0x040611);  // far ridge — taller, darker

    // b177: aviation beacons sprinkled along the near ridgeline so the
    // background isn't pitch-black void. 14 strobes around the full 360°,
    // alternating red/amber/cyan, perched on top of the ridge silhouette.
    // Heights vary between 7..12u (above the ridge top of ~6) so they
    // read as standing comms masts on distant peaks.
    const beaconColors = [0xff3344, 0xffaa55, 0x4488ff];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.10;
      const r = 100 + (Math.sin(a * 2.3) + Math.sin(a * 5.7 + 0.8)) * 4.8 + Math.random() * 8;
      const beaconY = -8 + 8 + Math.random() * 4;  // above the ridge top
      const color = beaconColors[i % beaconColors.length];
      // Slim mast under the strobe (a thin silhouette so it reads as a tower)
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.12, beaconY - (-8), 4),
        new THREE.MeshBasicMaterial({ color: 0x040611 }),
      );
      mast.position.set(Math.cos(a) * r, (-8 + beaconY) / 2, Math.sin(a) * r);
      this.scene.add(mast);
      // Strobe at the top
      const strobe = this._makeRunningLight(color, 0.55);
      strobe.position.set(Math.cos(a) * r, beaconY, Math.sin(a) * r);
      strobe.userData = { rate: 1.2 + Math.random() * 0.8, phase: Math.random() * 6 };
      this.scene.add(strobe);
      this.standoff?.strobes.push(strobe);
    }
    // 24 distant building-window glints scattered across the FAR ridge to
    // suggest occupied structures across the valley. Tiny additive points.
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 165 + (Math.random() - 0.5) * 25;
      const y = -8 + 4 + Math.random() * 8;
      const warm = Math.random() < 0.7;
      const c = warm ? 0xffaa55 : 0x88aaff;
      const win = this._makeRunningLight(c, 0.18 + Math.random() * 0.08);
      win.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      // Static (no blink) — these are window lights, not aviation strobes
      this.scene.add(win);
    }
  },

  _buildDish(x, y, z, dishR, strobeColor, baseYaw) {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.userData.baseYaw = baseYaw;
    grp.rotation.y = baseYaw;
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x22252e });
    const accentMat = new THREE.MeshBasicMaterial({ color: 0x16191f });
    const struMat = new THREE.MeshBasicMaterial({ color: 0x0e1118 });

    // Concrete plinth/platform
    const plinthH = 2.4;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(8, plinthH, 8), accentMat);
    plinth.position.y = plinthH / 2;
    grp.add(plinth);
    // Stepped base
    const step = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.6, 6.5), bodyMat);
    step.position.y = plinthH + 0.3;
    grp.add(step);

    // Pedestal column
    const colH = 5.2;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, colH, 10), bodyMat);
    ped.position.y = plinthH + 0.6 + colH / 2;
    grp.add(ped);

    // Yoke (the rotating mount)
    const yokeY = plinthH + 0.6 + colH + 0.5;
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.9, 1.2), bodyMat);
    yoke.position.y = yokeY;
    grp.add(yoke);
    // Yoke side flanges
    [-1.4, 1.4].forEach(sx => {
      const flange = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.8), bodyMat);
      flange.position.set(sx, yokeY + 0.5, 0);
      grp.add(flange);
    });

    // Dish — half-flat sphere section forms the parabola
    const tilt = -Math.PI * 0.34;  // points up/sky
    const dishGeo = new THREE.SphereGeometry(dishR, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.42);
    const dishMat = new THREE.MeshBasicMaterial({ color: 0x1c1f27, side: THREE.DoubleSide });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.set(0, yokeY + 1.0, 0);
    dish.rotation.x = tilt;
    grp.add(dish);
    // Concentric panel ribs across the dish (silver rim)
    for (let r = 0.30; r < 1.0; r += 0.20) {
      const ribGeo = new THREE.TorusGeometry(dishR * r, 0.03, 4, 36);
      const rib = new THREE.Mesh(ribGeo, struMat);
      rib.position.copy(dish.position);
      // Project onto the dish surface (approx)
      rib.position.y += Math.sqrt(Math.max(0, dishR * dishR - (dishR * r) * (dishR * r))) * 0.20;
      rib.rotation.x = Math.PI / 2;
      grp.add(rib);
    }
    // Outer rim of the dish
    const rimGeo = new THREE.TorusGeometry(dishR, 0.10, 5, 48);
    const rim = new THREE.Mesh(rimGeo, struMat);
    rim.position.copy(dish.position);
    rim.rotation.x = Math.PI / 2;
    grp.add(rim);

    // 3-prong receiver tripod at the dish focal point
    const focalY = yokeY + 1.0 + dishR * 0.55;
    [0, Math.PI * 2 / 3, Math.PI * 4 / 3].forEach(theta => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, dishR * 0.85, 4), struMat);
      arm.position.set(Math.cos(theta) * dishR * 0.4, yokeY + 1.0 + dishR * 0.18, Math.sin(theta) * dishR * 0.4);
      arm.lookAt(0, focalY, 0);
      arm.rotateX(Math.PI / 2);
      grp.add(arm);
    });
    const recv = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.7, 8), struMat);
    recv.position.set(0, focalY, 0);
    grp.add(recv);

    // Antenna spikes on the yoke
    [-1.2, 0, 1.2].forEach(sx => {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3 + Math.random() * 1.5, 4), struMat);
      const len = ant.geometry.parameters.height;
      ant.position.set(sx, yokeY + 0.5 + len / 2, 0);
      grp.add(ant);
    });

    // Aviation warning strobe at the highest antenna tip
    const strobe = this._makeRunningLight(strobeColor, 0.55);
    strobe.position.set(0, yokeY + 5.0, 0);
    strobe.userData = { isRunningLight: false, rate: 1.6, phase: Math.random() * 6 };
    grp.add(strobe);
    this.standoff.strobes.push(strobe);

    // Dim cyan/magenta receiver tell-tale at the focal point
    const tell = this._makeRunningLight(0xff66cc, 0.32);
    tell.position.set(0, focalY, 0);
    tell.userData = { isRunningLight: false, rate: 0.9, phase: Math.random() * 6 };
    grp.add(tell);
    this.standoff.strobes.push(tell);

    this.scene.add(grp);
    this.standoff.dishes.push(grp);
  },

  _buildCommTower(x, y, z, height, lightColor) {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    const mat = new THREE.MeshBasicMaterial({ color: 0x10131a });

    // 4 lattice legs
    const baseW = 1.2;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, height, 4), mat);
      leg.position.set(Math.cos(a) * baseW * 0.5, height * 0.5, Math.sin(a) * baseW * 0.5);
      grp.add(leg);
    }
    // Cross-bracing rings every 2.5u
    for (let h = 2; h < height - 1; h += 2.5) {
      const ringGeo = new THREE.TorusGeometry(baseW * 0.45, 0.025, 4, 14);
      const ring = new THREE.Mesh(ringGeo, mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = h;
      grp.add(ring);
    }
    // Top antenna mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 3, 4), mat);
    mast.position.y = height + 1.5;
    grp.add(mast);
    // Strobe at the mast tip
    const strobe = this._makeRunningLight(lightColor, 0.50);
    strobe.position.y = height + 3.2;
    strobe.userData = { isRunningLight: false, rate: lightColor === 0xff3344 ? 1.8 : 1.1, phase: Math.random() * 6 };
    grp.add(strobe);
    this.standoff.strobes.push(strobe);

    this.scene.add(grp);
  },

  _buildBunker(x, y, z, w, h, d, glowColor) {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.rotation.y = Math.random() * Math.PI * 2;
    const wallMat = new THREE.MeshBasicMaterial({ color: 0x222836 });
    const accentMat = new THREE.MeshBasicMaterial({ color: 0x1c2028 });

    // Main concrete shell
    const shell = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    shell.position.y = h / 2;
    grp.add(shell);
    // Recessed roof slab
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.3, d * 0.92), accentMat);
    roof.position.y = h + 0.15;
    grp.add(roof);

    // Window strip with warm interior glow (front face)
    const winMat = new THREE.MeshBasicMaterial({
      color: glowColor, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, 0.6), winMat);
    win.position.set(0, h * 0.55, d / 2 + 0.02);
    win.userData = { rate: 4.5, phase: Math.random() * 6, baseOpacity: 0.85 };
    grp.add(win);
    this.standoff.windows.push(win);

    // Door slot on the front (dimmer)
    const doorMat = new THREE.MeshBasicMaterial({
      color: glowColor, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.8), doorMat);
    door.position.set(w * 0.3, 0.9, d / 2 + 0.02);
    door.userData = { rate: 3.1, phase: Math.random() * 6, baseOpacity: 0.55 };
    grp.add(door);
    this.standoff.windows.push(door);

    // Antenna stub on top with red strobe
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 4), wallMat);
    ant.position.set(-w * 0.3, h + 1.4, 0);
    grp.add(ant);
    const tip = this._makeRunningLight(0xff3344, 0.32);
    tip.position.set(-w * 0.3, h + 2.7, 0);
    tip.userData = { isRunningLight: false, rate: 2.2, phase: Math.random() * 6 };
    grp.add(tip);
    this.standoff.strobes.push(tip);

    this.scene.add(grp);
  },

  _buildSandbagBerm(radius, theta, length) {
    const grp = new THREE.Group();
    const cx = Math.cos(theta) * radius;
    const cz = Math.sin(theta) * radius;
    grp.position.set(cx, -8, cz);
    // Tangent direction to the deck circle
    const tx = -Math.sin(theta);
    const tz = Math.cos(theta);
    const bagMat = new THREE.MeshBasicMaterial({ color: 0x14171d });
    const spacing = 1.05;
    for (let i = 0; i < length; i++) {
      const offset = (i - (length - 1) / 2) * spacing;
      // Bottom row
      const bag1 = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.40, 0.65), bagMat);
      bag1.position.set(tx * offset, 0.20, tz * offset);
      bag1.rotation.y = (Math.random() - 0.5) * 0.15;
      grp.add(bag1);
      // Top row, staggered
      if (i < length - 1) {
        const bag2 = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.40, 0.65), bagMat);
        bag2.position.set(tx * (offset + spacing * 0.5), 0.58, tz * (offset + spacing * 0.5));
        bag2.rotation.y = (Math.random() - 0.5) * 0.15;
        grp.add(bag2);
      }
    }
    this.scene.add(grp);
  },

  /* ---------- Distant ringed planet (huge backdrop element) ---------- */
  _buildPlanet() {
    const planetGeo = new THREE.SphereGeometry(38, 56, 56);
    const planetMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec3 vN;
        varying vec3 vP;
        varying vec3 vWP;
        void main(){
          vN = normalize(normalMatrix * normal);
          vP = position;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWP = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vN;
        varying vec3 vP;
        varying vec3 vWP;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0,0.0)), f.x), mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), f.x), f.y);
        }
        float fbm(vec2 p){
          float v = 0.0, a = 0.5;
          for(int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.05; a *= 0.55; }
          return v;
        }
        void main(){
          vec3 n = normalize(vN);
          // Surface uvs derived from local position (banded gas-giant style)
          vec2 uv = vec2(atan(vP.z, vP.x) * 0.20, vP.y * 0.018);
          float bands = sin(vP.y * 0.18 + fbm(uv * 1.5 + uTime * 0.005) * 4.0);
          float n1 = fbm(uv * 2.0 + vec2(uTime * 0.006, 0.0));
          // Palette — purple/magenta gas giant w/ orange storm streaks
          vec3 c1 = vec3(0.18, 0.10, 0.32);
          vec3 c2 = vec3(0.55, 0.20, 0.55);
          vec3 c3 = vec3(0.85, 0.45, 0.35);
          vec3 base = mix(c1, c2, smoothstep(-0.4, 0.4, bands));
          base = mix(base, c3, smoothstep(0.55, 0.85, n1) * 0.45);
          // Rim light (atmospheric edge glow facing camera)
          vec3 viewDir = normalize(cameraPosition - vWP);
          float rim = pow(1.0 - max(0.0, dot(n, viewDir)), 3.0);
          vec3 rimCol = vec3(0.95, 0.55, 0.85);
          vec3 col = base + rimCol * rim * 0.65;
          // Self-shadowing fake (terminator) — fade away from camera
          float sl = 0.45 + 0.55 * max(0.0, dot(n, viewDir));
          col *= sl;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.planet = new THREE.Mesh(planetGeo, planetMat);
    this.planet.position.set(-110, 12, -130);
    this.scene.add(this.planet);

    // Atmospheric halo behind planet — soft sprite
    const haloC = document.createElement('canvas');
    haloC.width = haloC.height = 256;
    const hcx = haloC.getContext('2d');
    const hg = hcx.createRadialGradient(128, 128, 0, 128, 128, 128);
    hg.addColorStop(0, 'rgba(200, 110, 200, 0.55)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    hcx.fillStyle = hg; hcx.fillRect(0, 0, 256, 256);
    const haloTex = new THREE.CanvasTexture(haloC);
    haloTex.minFilter = THREE.LinearFilter;
    const haloMat = new THREE.SpriteMaterial({ map: haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 });
    this.planetHalo = new THREE.Sprite(haloMat);
    this.planetHalo.scale.set(120, 120, 1);
    this.planetHalo.position.copy(this.planet.position);
    this.scene.add(this.planetHalo);

    // Ring system
    const ringGeo = new THREE.RingGeometry(46, 76, 96, 1);
    // Tweak UVs so we can radial-fade in shader (default RingGeometry UVs are a bit weird)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xc88a55,
      transparent: true, opacity: 0.50,
      side: THREE.DoubleSide, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.planetRing = new THREE.Mesh(ringGeo, ringMat);
    this.planetRing.position.copy(this.planet.position);
    this.planetRing.rotation.x = Math.PI / 2 - 0.45;
    this.planetRing.rotation.y = 0.18;
    this.scene.add(this.planetRing);

    // Inner brighter ring
    const ring2Geo = new THREE.RingGeometry(58, 64, 96, 1);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0xff9966,
      transparent: true, opacity: 0.65,
      side: THREE.DoubleSide, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.planetRing2 = new THREE.Mesh(ring2Geo, ring2Mat);
    this.planetRing2.position.copy(this.planet.position);
    this.planetRing2.rotation.copy(this.planetRing.rotation);
    this.scene.add(this.planetRing2);
  },

  /* ---------- Distant station lights — blinking points scattered far away ---------- */
  _buildStationLights() {
    const N = 60;
    const positions = new Float32Array(N * 3);
    const seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const r = 80 + Math.random() * 80;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      positions[i*3]   = r * Math.sin(ph) * Math.cos(th);
      positions[i*3+1] = r * Math.cos(ph) * 0.8;
      positions[i*3+2] = r * Math.sin(ph) * Math.sin(th);
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPxr: { value: this.renderer.getPixelRatio() } },
      vertexShader: `
        uniform float uTime;
        uniform float uPxr;
        attribute float seed;
        varying float vAlpha;
        varying float vSeed;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float dist = length(mv.xyz);
          // Each light has its own blink period
          float period = 1.5 + seed * 4.0;
          float blink = step(0.65, fract(uTime / period + seed * 7.0));
          vSeed = seed;
          vAlpha = blink * 0.95;
          gl_PointSize = uPxr * (28.0 / max(dist, 1.0));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying float vSeed;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          float a = smoothstep(0.5, 0.0, r);
          // Three flavors: red/cyan/amber running lights
          vec3 col;
          if (vSeed < 0.33)      col = vec3(1.0, 0.35, 0.35);
          else if (vSeed < 0.66) col = vec3(0.45, 0.85, 1.0);
          else                   col = vec3(1.0, 0.78, 0.40);
          gl_FragColor = vec4(col, a * vAlpha);
        }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.stationLights = new THREE.Points(geo, mat);
    this.scene.add(this.stationLights);
  },

  /* ---------- Capital ships flying past the observation deck ---------- */
  _buildFlybys() {
    this.flybys = [];
    // 5 ship designs with varied silhouettes, sizes, engine palettes.
    const designs = [
      { kind: 'capital',  size: 1.4, engineColor: 'rgba(120, 220, 255, 1.0)', runningLight: 0xff8866, bodyColor: 0x303040 },
      { kind: 'cruiser',  size: 1.0, engineColor: 'rgba(255, 130, 200, 1.0)', runningLight: 0x88ddff, bodyColor: 0x252535 },
      { kind: 'pelican',  size: 0.85, engineColor: 'rgba(140, 200, 255, 1.0)', runningLight: 0xff4444, bodyColor: 0x202028 },
      { kind: 'fighter',  size: 0.55, engineColor: 'rgba(255, 200, 120, 1.0)', runningLight: 0xff6677, bodyColor: 0x303040 },
      { kind: 'forerunner', size: 0.95, engineColor: 'rgba(180, 140, 255, 1.0)', runningLight: 0xc8a8ff, bodyColor: 0x202030 },
    ];
    designs.forEach((d, i) => {
      const ship = this._makeShip(d);
      ship.userData.respawnDelay = i * 6 + Math.random() * 8;  // staggered first appearances
      ship.userData.kind = d.kind;
      this._respawnFlyby(ship);
      ship.visible = false;  // hidden until first respawn delay elapses
      this.scene.add(ship);
      this.flybys.push(ship);
    });
  },

  // Ship convention: forward is -Z (nose at -Z, engines at +Z, wings along X).
  // Three.js Object3D.lookAt() points +Z at the target for non-camera/light
  // objects, so callers must rotateY(PI) after lookAt() to flip the nose toward
  // the target — see _respawnFlyby and _startPelicanRun.
  _makeShip(d) {
    const grp = new THREE.Group();
    const bodyMat = new THREE.MeshBasicMaterial({ color: d.bodyColor });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x808090 });
    const sz = d.size;

    if (d.kind === 'capital') {
      // Long fuselage along Z, capped nose + flared rear, twin wings + a vertical fin
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * sz, 1.3 * sz, 16 * sz, 12), bodyMat);
      body.rotation.x = Math.PI / 2;
      grp.add(body);
      // Nose cone
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.9 * sz, 2.2 * sz, 12), bodyMat);
      nose.rotation.x = -Math.PI / 2;
      nose.position.z = -9.1 * sz;
      grp.add(nose);
      // Top spine fin
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6 * sz, 5 * sz), bodyMat);
      fin.position.set(0, 1.0 * sz, 1.0 * sz);
      grp.add(fin);
      // Wings (flat horizontal, extending along X)
      [1, -1].forEach(s => {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(7 * sz, 0.22, 3.4 * sz), bodyMat);
        wing.position.set(s * 4.0 * sz, -0.05, 1.2 * sz);
        wing.rotation.y = s * 0.10; // slight sweep
        grp.add(wing);
        // Wingtip strobe (red/green like an aircraft)
        const tip = this._makeRunningLight(s > 0 ? 0xff3344 : 0x33ff66, 0.55);
        tip.position.set(s * 7.2 * sz, 0.0, 1.2 * sz);
        grp.add(tip);
      });
      // Cockpit / bridge windows (cluster of small bright squares near the nose, top side)
      for (let i = 0; i < 5; i++) {
        const w = this._makeRunningLight(0xffe6a0, 0.18);
        w.position.set((i - 2) * 0.32 * sz, 0.78 * sz, -5.5 * sz);
        grp.add(w);
      }
      // Hull running lights along both sides
      for (let z = -7; z <= 6; z += 1.8) {
        [1, -1].forEach(s => {
          const lt = this._makeRunningLight(d.runningLight, 0.28);
          lt.position.set(s * 0.95 * sz, 0.0, z * sz);
          grp.add(lt);
        });
      }
      // Rear engine cluster — 3 glow sprites for thrust width
      [-1.0, 0, 1.0].forEach((dx) => {
        const eng = this._makeEngineGlow(d.engineColor, 4.0 * sz);
        eng.position.set(dx * 0.9 * sz, 0, 8.4 * sz);
        grp.add(eng);
      });
    } else if (d.kind === 'cruiser') {
      // Sleek arrow — long cone nose, prismatic mid, twin engine pods
      const nose = new THREE.Mesh(new THREE.ConeGeometry(1.2 * sz, 5 * sz, 8), bodyMat);
      nose.rotation.x = -Math.PI / 2;
      nose.position.z = -3.2 * sz;
      grp.add(nose);
      const mid = new THREE.Mesh(new THREE.CylinderGeometry(1.2 * sz, 1.5 * sz, 4 * sz, 8), bodyMat);
      mid.rotation.x = Math.PI / 2;
      mid.position.z = 1.5 * sz;
      grp.add(mid);
      // Twin engine pods on either side
      [1, -1].forEach(s => {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.4 * sz, 0.4 * sz, 2.4 * sz, 8), bodyMat);
        pod.rotation.x = Math.PI / 2;
        pod.position.set(s * 1.7 * sz, -0.2 * sz, 2.0 * sz);
        grp.add(pod);
        const eng = this._makeEngineGlow(d.engineColor, 1.8 * sz);
        eng.position.set(s * 1.7 * sz, -0.2 * sz, 3.4 * sz);
        grp.add(eng);
        // Strobe at nose flank
        const lt = this._makeRunningLight(s > 0 ? 0xff3344 : 0x33ff66, 0.32);
        lt.position.set(s * 0.9 * sz, 0, -2.0 * sz);
        grp.add(lt);
      });
      // Cockpit window
      const cock = this._makeRunningLight(0xffe6a0, 0.32);
      cock.position.set(0, 0.45 * sz, -3.6 * sz);
      grp.add(cock);
    } else if (d.kind === 'pelican') {
      // Pelican-style dropship — boxy fuselage along Z, horizontal wing, twin engines on the wings
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.4 * sz, 1.5 * sz, 6.5 * sz), bodyMat);
      grp.add(body);
      // Tail boom — narrower box at the rear
      const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6 * sz, 1.0 * sz, 2.4 * sz), bodyMat);
      tail.position.set(0, 0.0, 4.0 * sz);
      grp.add(tail);
      // Cockpit window cluster on the nose
      [-0.5, 0, 0.5].forEach(dx => {
        const w = this._makeRunningLight(0xffe6a0, 0.22);
        w.position.set(dx * sz, 0.55 * sz, -3.2 * sz);
        grp.add(w);
      });
      // Wing along X axis, mounted on top
      const wing = new THREE.Mesh(new THREE.BoxGeometry(8 * sz, 0.32, 1.7 * sz), bodyMat);
      wing.position.set(0, 0.85 * sz, 1.4 * sz);
      grp.add(wing);
      // Twin engines hanging under the wing
      [1, -1].forEach(s => {
        const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * sz, 0.42 * sz, 1.6 * sz, 10), bodyMat);
        nacelle.rotation.x = Math.PI / 2;
        nacelle.position.set(s * 3.0 * sz, 0.55 * sz, 1.6 * sz);
        grp.add(nacelle);
        const eng = this._makeEngineGlow(d.engineColor, 1.7 * sz);
        eng.position.set(s * 3.0 * sz, 0.55 * sz, 2.5 * sz);
        grp.add(eng);
        // Wingtip strobe
        const tip = this._makeRunningLight(s > 0 ? 0xff3344 : 0x33ff66, 0.30);
        tip.position.set(s * 4.1 * sz, 0.85 * sz, 1.4 * sz);
        grp.add(tip);
      });
    } else if (d.kind === 'fighter') {
      // Sabre-style fighter — flat nose, swept wings, single engine
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5 * sz, 2.4 * sz, 6), bodyMat);
      nose.rotation.x = -Math.PI / 2;
      nose.position.z = -1.0 * sz;
      grp.add(nose);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8 * sz, 0.6 * sz, 2 * sz), bodyMat);
      body.position.z = 0.8 * sz;
      grp.add(body);
      // Swept wings
      [1, -1].forEach(s => {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4 * sz, 0.14, 1.4 * sz), bodyMat);
        wing.position.set(s * 1.3 * sz, -0.1, 0.8 * sz);
        wing.rotation.y = s * 0.35;
        grp.add(wing);
        const tip = this._makeRunningLight(s > 0 ? 0xff3344 : 0x33ff66, 0.22);
        tip.position.set(s * 2.4 * sz, 0, 1.0 * sz);
        grp.add(tip);
      });
      // Cockpit
      const cock = this._makeRunningLight(0xffe6a0, 0.22);
      cock.position.set(0, 0.32 * sz, -0.4 * sz);
      grp.add(cock);
      // Single rear engine
      const eng = this._makeEngineGlow(d.engineColor, 1.8 * sz);
      eng.position.set(0, 0, 2.2 * sz);
      grp.add(eng);
    } else if (d.kind === 'forerunner') {
      // Geometric pod — octahedron core, perpendicular spinning rings, no clear "front"
      // (looks intentional — Forerunner tech doesn't fly like aircraft)
      const body = new THREE.Mesh(new THREE.OctahedronGeometry(1.8 * sz, 0), bodyMat);
      grp.add(body);
      // Spinning ring 1
      const ring1 = new THREE.Mesh(
        new THREE.TorusGeometry(2.5 * sz, 0.08, 6, 48),
        new THREE.MeshBasicMaterial({ color: 0xc8a8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      ring1.rotation.x = Math.PI / 2;
      ring1.userData = { spin: 'z' };
      grp.add(ring1);
      // Spinning ring 2 (perpendicular)
      const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(2.1 * sz, 0.06, 6, 48),
        new THREE.MeshBasicMaterial({ color: 0xa0c0ff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      ring2.userData = { spin: 'y' };
      grp.add(ring2);
      // Edge running lights on the octahedron
      [[0, 1.8 * sz, 0], [0, -1.8 * sz, 0], [1.8 * sz, 0, 0], [-1.8 * sz, 0, 0]].forEach(pos => {
        const lt = this._makeRunningLight(0xc8a8ff, 0.22);
        lt.position.set(...pos);
        grp.add(lt);
      });
      const eng = this._makeEngineGlow(d.engineColor, 4 * sz);
      grp.add(eng);
    }
    return grp;
  },

  _makeEngineGlow(rgba, scale) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const cx = c.getContext('2d');
    const g = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.25, rgba);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scale, scale, 1);
    return sprite;
  },

  _makeRunningLight(color, scale) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const cx = c.getContext('2d');
    const g = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    const col = new THREE.Color(color);
    g.addColorStop(0.4, `rgba(${(col.r*255)|0},${(col.g*255)|0},${(col.b*255)|0},0.85)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scale, scale, 1);
    sprite.userData = { isRunningLight: true, blinkSeed: Math.random() * 6 };
    return sprite;
  },

  _respawnFlyby(ship) {
    // Build a path that actually crosses the camera's forward view.
    // Spawn off to one side, target the opposite side, midpoint a chosen
    // depth in front of camera. Yaw-aware so it tracks user gaze.
    const camY = this._camBaseY || 0;
    const yaw  = this.gaze?.yaw || 0;
    const fx = Math.sin(yaw),  fz = -Math.cos(yaw);   // horizontal forward
    const rx = Math.cos(yaw),  rz = Math.sin(yaw);    // horizontal right

    const passDepth  = 35 + Math.random() * 35;       // 35–70u in front of camera
    const passSign   = Math.random() < 0.5 ? 1 : -1;  // L→R or R→L
    const sideExtent = 80 + Math.random() * 40;       // off-screen spawn margin

    // Altitude: 70% eye-level, 18% high pass (over panels), 12% low pass (under)
    let altitude;
    const r = Math.random();
    if (r < 0.18)      altitude = camY + 18 + Math.random() * 10;
    else if (r < 0.30) altitude = camY - 6  - Math.random() * 4;
    else               altitude = camY + (Math.random() - 0.3) * 5;

    // Forward-axis jitter so ships don't all cross at the same depth/angle
    const spawnFwd  = passDepth + (Math.random() - 0.5) * 25;
    const targetFwd = passDepth + (Math.random() - 0.5) * 25;

    const startPos = new THREE.Vector3(
      fx * spawnFwd  + rx * (-passSign * sideExtent),
      altitude,
      fz * spawnFwd  + rz * (-passSign * sideExtent),
    );
    const altDelta = (Math.random() - 0.5) * 5;
    const target = new THREE.Vector3(
      fx * targetFwd + rx * ( passSign * sideExtent),
      altitude + altDelta,
      fz * targetFwd + rz * ( passSign * sideExtent),
    );
    const dir = target.clone().sub(startPos).normalize();
    const speedTable = { capital: 8, cruiser: 14, pelican: 11, fighter: 26, forerunner: 6 };
    const baseSpeed = speedTable[ship.userData.kind] || 12;
    const speed = baseSpeed + Math.random() * baseSpeed * 0.3;
    ship.position.copy(startPos);
    ship.userData.vel = dir.clone().multiplyScalar(speed);
    ship.userData.target = target;
    ship.userData.spawnPos = startPos.clone();
    ship.userData.totalDist = startPos.distanceTo(target);
    ship.lookAt(target);
    ship.rotateY(Math.PI);  // flip nose-forward (see Ship convention note above)
    // Slight banking roll on each respawn for visual variety
    ship.rotation.z += (Math.random() - 0.5) * 0.5;
  },

  /* ---------- Scripted pelican dropoff ----------
     A separate pelican that runs a loop: wait → approach → hover with rear
     hatch open → drop a sequence of crates / cones / fusion coils → close
     hatch → ascend and depart. Dropped cargo joins the existing `props`
     physics pool so it falls, bounces, rolls and accumulates on the floor. */
  _buildScriptedPelican() {
    const grp = new THREE.Group();
    const sz = 1.0;
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x202028 });
    const engineColor = 'rgba(140, 200, 255, 1.0)';

    // Forward fuselage (nose at -Z). Geometry mirrors the random pelican but
    // we leave the rear of the tail open so the hatch ramp can swing down.
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4 * sz, 1.5 * sz, 6.5 * sz), bodyMat);
    grp.add(body);
    [-0.5, 0, 0.5].forEach(dx => {
      const w = this._makeRunningLight(0xffe6a0, 0.22);
      w.position.set(dx * sz, 0.55 * sz, -3.2 * sz);
      grp.add(w);
    });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(8 * sz, 0.32, 1.7 * sz), bodyMat);
    wing.position.set(0, 0.85 * sz, 1.4 * sz);
    grp.add(wing);
    [1, -1].forEach(s => {
      const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * sz, 0.42 * sz, 1.6 * sz, 10), bodyMat);
      nacelle.rotation.x = Math.PI / 2;
      nacelle.position.set(s * 3.0 * sz, 0.55 * sz, 1.6 * sz);
      grp.add(nacelle);
      const eng = this._makeEngineGlow(engineColor, 1.7 * sz);
      eng.position.set(s * 3.0 * sz, 0.55 * sz, 2.5 * sz);
      grp.add(eng);
      const tip = this._makeRunningLight(s > 0 ? 0xff3344 : 0x33ff66, 0.30);
      tip.position.set(s * 4.1 * sz, 0.85 * sz, 1.4 * sz);
      grp.add(tip);
    });
    // Tail boom — slightly shorter than the random pelican so the hatch
    // visibly gaps open at the rear.
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6 * sz, 1.0 * sz, 1.8 * sz), bodyMat);
    tail.position.set(0, 0.0, 3.7 * sz);
    grp.add(tail);

    // Rear hatch ramp — pivots about its top-front edge so it swings DOWN
    // and BACK as it opens. Pivot Group sits at the hinge point; the panel
    // mesh extends along +Z from the hinge.
    const hatchPivot = new THREE.Group();
    hatchPivot.position.set(0, -0.50 * sz, 4.6 * sz);
    grp.add(hatchPivot);
    const hatchPanel = new THREE.Mesh(new THREE.BoxGeometry(1.4 * sz, 0.10 * sz, 1.6 * sz), bodyMat);
    hatchPanel.position.set(0, 0, 0.80 * sz);
    hatchPivot.add(hatchPanel);

    // Warm cargo-bay glow inside the tail — visible only when the hatch is
    // open enough to see in.
    const bayGlow = this._makeRunningLight(0xffaa55, 0.7);
    bayGlow.position.set(0, -0.05 * sz, 3.8 * sz);
    grp.add(bayGlow);

    grp.userData.kind = 'pelican_drop';
    grp.userData.hatchPivot = hatchPivot;
    grp.userData.bayGlow = bayGlow;
    grp.userData.phase = 'wait';
    grp.userData.phaseT = 6 + Math.random() * 8;  // first run starts soon-ish
    grp.userData.vel = new THREE.Vector3();
    grp.visible = false;
    bayGlow.visible = false;

    this.scene.add(grp);
    this.scriptedPelican = grp;
  },

  _startPelicanRun() {
    const sp = this.scriptedPelican;
    if (!sp) return;
    const ud = sp.userData;
    const yaw = this.gaze?.yaw || 0;
    const fx = Math.sin(yaw),  fz = -Math.cos(yaw);
    const rx = Math.cos(yaw),  rz = Math.sin(yaw);

    // Drop zone: in front of camera, slightly off the central forward axis so
    // the pelican doesn't park between camera and the panels.
    const passDepth  = 30;
    const passSign   = Math.random() < 0.5 ? 1 : -1;
    const sideExtent = 65;
    const altitude   = (this._camBaseY || 0) + 7;

    const startPos = new THREE.Vector3(
      fx * passDepth + rx * (-passSign * sideExtent),
      altitude,
      fz * passDepth + rz * (-passSign * sideExtent),
    );
    const dropZone = new THREE.Vector3(
      fx * passDepth + rx * (passSign * 6),
      altitude,
      fz * passDepth + rz * (passSign * 6),
    );
    const dir = dropZone.clone().sub(startPos).normalize();
    const speed = 14;

    sp.position.copy(startPos);
    sp.lookAt(dropZone);
    sp.rotateY(Math.PI);  // nose-forward (see Ship convention note)
    ud.vel.copy(dir).multiplyScalar(speed);
    ud.dropZone = dropZone;
    ud.hatchPivot.rotation.x = 0;
    ud.bayGlow.visible = false;

    // Time the approach so we reach (close to) the drop zone right when the
    // hatch starts opening.
    const dist = startPos.distanceTo(dropZone);
    ud.phase = 'approach';
    ud.phaseT = Math.max(1.5, dist / speed - 0.8);
    sp.visible = true;
  },

  _tickScriptedPelican(dt, t) {
    const sp = this.scriptedPelican;
    if (!sp) return;
    const ud = sp.userData;
    ud.phaseT -= dt;

    if (ud.phase === 'wait') {
      if (ud.phaseT <= 0) this._startPelicanRun();
      return;
    }

    if (ud.phase === 'approach') {
      sp.position.add(ud.vel.clone().multiplyScalar(dt));
      if (ud.phaseT <= 0) {
        ud.phase = 'opening';
        ud.phaseT = 1.6;
        ud.bayGlow.visible = true;
      }
      return;
    }

    const HATCH_OPEN = Math.PI * 0.55;

    if (ud.phase === 'opening') {
      // Decelerate toward a slow drift over the drop zone
      ud.vel.multiplyScalar(Math.max(0, 1 - 1.5 * dt));
      sp.position.add(ud.vel.clone().multiplyScalar(dt));
      const open = 1 - Math.max(0, ud.phaseT / 1.6);
      ud.hatchPivot.rotation.x = open * HATCH_OPEN;
      if (ud.phaseT <= 0) {
        ud.hatchPivot.rotation.x = HATCH_OPEN;
        ud.phase = 'dropping';
        ud.phaseT = 5.0;
        ud.nextDropAt = 0.2;
        ud.dropsRemaining = 6 + Math.floor(Math.random() * 3);
      }
      return;
    }

    if (ud.phase === 'dropping') {
      sp.position.add(ud.vel.clone().multiplyScalar(dt));
      ud.nextDropAt -= dt;
      if (ud.nextDropAt <= 0 && ud.dropsRemaining > 0) {
        this._dropCargoFromPelican();
        ud.dropsRemaining--;
        ud.nextDropAt = 0.50 + Math.random() * 0.35;
      }
      if (ud.phaseT <= 0 || ud.dropsRemaining <= 0) {
        ud.phase = 'closing';
        ud.phaseT = 1.6;
      }
      return;
    }

    if (ud.phase === 'closing') {
      sp.position.add(ud.vel.clone().multiplyScalar(dt));
      const close = Math.max(0, ud.phaseT / 1.6);
      ud.hatchPivot.rotation.x = close * HATCH_OPEN;
      if (ud.phaseT <= 0) {
        ud.hatchPivot.rotation.x = 0;
        ud.bayGlow.visible = false;
        // Re-accelerate along the nose direction (-Z in local space)
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(sp.quaternion);
        ud.vel.copy(fwd).multiplyScalar(20);
        ud.phase = 'depart';
        ud.phaseT = 7.0;
      }
      return;
    }

    if (ud.phase === 'depart') {
      sp.position.add(ud.vel.clone().multiplyScalar(dt));
      sp.position.y += dt * 1.5;  // climb out
      if (ud.phaseT <= 0) {
        sp.visible = false;
        ud.phase = 'wait';
        ud.phaseT = 30 + Math.random() * 25;
      }
      return;
    }
  },

  _dropCargoFromPelican() {
    if (!this.props) return;  // floor not ready yet
    const sp = this.scriptedPelican;
    if (!sp) return;

    const r = Math.random();
    let cargo;
    if (r < 0.55)       cargo = this._makeCrate();
    else if (r < 0.85)  cargo = this._makeTrafficCone();
    else                cargo = this._makeFusionCoil();

    // Spawn at the open rear hatch in world space (local: behind the tail,
    // slightly below the fuselage centerline).
    const localOffset = new THREE.Vector3(0, -0.6, 5.4);
    const spawnPos = localOffset.applyMatrix4(sp.matrixWorld);
    cargo.position.copy(spawnPos);
    cargo.rotation.set(
      (Math.random() - 0.5) * 0.6,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.6,
    );

    // Inherit a fraction of the pelican's velocity, plus a downward shove so
    // the cargo clearly falls out the back rather than floating.
    const vel = sp.userData.vel.clone().multiplyScalar(0.35);
    vel.y -= 2.5;
    cargo.userData.vel = vel;
    cargo.userData.angVel = new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 4,
    );
    cargo.userData.floorY = -8;
    cargo.userData.kicked = true;
    cargo.userData.fromDrop = true;
    this.scene.add(cargo);
    this.props.push(cargo);

    // Cap the dropped pile so the prop list (and physics cost) doesn't grow
    // forever — recycle the oldest air-dropped item once we hit the limit.
    let dropped = 0;
    for (let i = 0; i < this.props.length; i++) if (this.props[i].userData.fromDrop) dropped++;
    if (dropped > 30) {
      const oldestIdx = this.props.findIndex(p => p.userData.fromDrop);
      if (oldestIdx >= 0) {
        this.scene.remove(this.props[oldestIdx]);
        this.props.splice(oldestIdx, 1);
      }
    }
  },

  _tickFlybys(dt, t) {
    if (!this.flybys) return;
    this.flybys.forEach(ship => {
      // Initial respawn delay (so they don't all appear at once)
      if (ship.userData.respawnDelay > 0) {
        ship.userData.respawnDelay -= dt;
        if (ship.userData.respawnDelay <= 0) {
          this._respawnFlyby(ship);
          ship.visible = true;
        }
        return;
      }
      ship.position.add(ship.userData.vel.clone().multiplyScalar(dt));
      // If we've passed the target by some margin → respawn
      const traveled = ship.position.distanceTo(ship.userData.spawnPos);
      if (traveled > ship.userData.totalDist + 30) {
        this._respawnFlyby(ship);
        // Random pause before next pass
        ship.userData.respawnDelay = 4 + Math.random() * 14;
        ship.visible = false;
      }
      // Per-frame extras
      if (ship.userData.kind === 'forerunner') {
        // Spin both rings around different axes
        ship.children.forEach(c => {
          if (c.userData?.spin === 'z') c.rotation.z += dt * 1.0;
          if (c.userData?.spin === 'y') c.rotation.y += dt * 0.8;
        });
      }
      if (ship.userData.kind === 'fighter' || ship.userData.kind === 'cruiser') {
        // Subtle banking sway
        ship.rotation.z = Math.sin(t * 0.8 + ship.userData.totalDist) * 0.18;
      }
      // Blink running lights
      ship.children.forEach(c => {
        if (c.userData?.isRunningLight) {
          c.material.opacity = 0.5 + 0.5 * (Math.sin(t * 4.5 + c.userData.blinkSeed) > 0.3 ? 1 : 0.15);
        }
      });
    });
  },

  /* ---------- Floor props — Halo Reach Forge clutter on the deck ---------- */
  _pickFloorPosition(minR, maxR) {
    let attempts = 0;
    while (attempts++ < 60) {
      const r = minR + Math.random() * (maxR - minR);
      const th = Math.random() * Math.PI * 2;
      const x = Math.cos(th) * r;
      const z = Math.sin(th) * r;
      // Avoid the panel-arc band (panels at radius 18, want clearance ±2.5)
      if (r > 15.5 && r < 20.5) continue;
      // b184: avoid the spine road (x=0, z<-12, ±5u clearance)
      if (Math.abs(x) < 5.5 && z < -10) continue;
      // b184: avoid the deck-ring cement walkway (r in [12, 19])
      if (r > 12.5 && r < 19) continue;
      return { x, z };
    }
    return { x: minR + Math.random() * (maxR - minR), z: 6 };
  },

  _buildFloorProps() {
    this.props = [];
    this.explosionParticles = [];
    const FLOOR_Y = -8;
    const placeRandomly = (minR, maxR) => this._pickFloorPosition(minR, maxR);

    // Helper: add a freshly-built prop with physics defaults
    const addProp = (prop, x, z, restY) => {
      prop.position.set(x, restY, z);
      prop.userData.floorY = restY;
      prop.userData.kicked = false;
      this.scene.add(prop);
      this.props.push(prop);
    };

    // 10 traffic cones — kept off the hex deck (deck r=12)
    for (let i = 0; i < 10; i++) {
      const cone = this._makeTrafficCone();
      const p = placeRandomly(14, 32);
      cone.rotation.y = Math.random() * Math.PI * 2;
      // Some cones knocked over for chaos
      if (Math.random() < 0.20) {
        cone.rotation.z = (Math.random() - 0.5) * Math.PI * 0.7;
      }
      addProp(cone, p.x, p.z, FLOOR_Y);
    }

    // 5 fusion coils — kept off the deck and away from buildings
    for (let i = 0; i < 5; i++) {
      const coil = this._makeFusionCoil();
      const p = placeRandomly(15, 28);
      coil.rotation.y = Math.random() * Math.PI * 2;
      addProp(coil, p.x, p.z, FLOOR_Y);
    }

    // 2 kill balls — pushed FAR out (radius 70-90) so they read as distant
    // plasma reactors at the back of the base instead of foreground orbs
    // blocking the buildings. b169: count 4→2, radius 26-36→70-90.
    for (let i = 0; i < 2; i++) {
      const ball = this._makeKillBall();
      const r = 70 + Math.random() * 20;
      const th = (i === 0 ? Math.PI * 0.85 : -Math.PI * 0.30);  // back-left and back-right
      const bx = Math.cos(th) * r;
      const bz = Math.sin(th) * r;
      const restY = FLOOR_Y + 6;
      ball.userData.bobBase = restY;
      ball.userData.bobSeed = Math.random() * 10;
      addProp(ball, bx, bz, restY);
    }

    // 8 supply crates — outside the deck, scattered across the apron
    for (let i = 0; i < 8; i++) {
      const crate = this._makeCrate();
      const p = placeRandomly(15, 30);
      crate.rotation.y = Math.random() * Math.PI * 2;
      addProp(crate, p.x, p.z, FLOOR_Y);
    }
  },

  /* ---------- Click-to-kick physics on floor props ---------- */
  _tryKickProp() {
    if (!this.props || !this.props.length) return false;
    this.ray.setFromCamera(this.mouse.ndc, this.camera);
    const hits = this.ray.intersectObjects(this.props, true);
    if (!hits.length) return false;
    // Walk up the parent chain to find which prop group was hit
    let target = hits[0].object;
    while (target && !this.props.includes(target)) target = target.parent;
    if (!target) return false;
    this._kickProp(target);
    return true;
  },

  _kickProp(prop) {
    if (prop.userData.exploded) return;
    const now = this.clock?.elapsedTime || 0;

    // Coil mechanic: 3 clicks → countdown → explosion. 3rd click does NOT
    // detonate; it just lights the fuse.
    if (prop.userData.isCoil) {
      // Already counting down — extra clicks shave a little time off the fuse
      if (prop.userData.detonateAt > 0) {
        prop.userData.detonateAt = Math.max(now + 0.25, prop.userData.detonateAt - 0.4);
        return;
      }
      prop.userData.hits = (prop.userData.hits || 0) + 1;
      const hits = prop.userData.hits;
      const threshold = prop.userData.hitThreshold;
      // Pre-countdown heat ramps 0 → 1 over the click count
      prop.userData.heat = Math.min(1.0, hits / threshold);
      if (prop.userData.plasmaMats) {
        prop.userData.plasmaMats.forEach(m => { m.uniforms.uHeat.value = prop.userData.heat; });
      }
      if (hits >= threshold) {
        // 3rd click: light the fuse. Tiny in-place jiggle, no fly-away kick.
        prop.userData.detonateAt = now + prop.userData.countdownDuration;
        prop.userData.kicked = true;
        prop.userData.vel = new THREE.Vector3(
          (Math.random() - 0.5) * 0.6,
          0.6 + Math.random() * 0.3,
          (Math.random() - 0.5) * 0.6,
        );
        prop.userData.angVel = new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
        );
        if (prop.userData.floorY === undefined) prop.userData.floorY = -8;
        return;
      }
      // Pre-threshold clicks fall through to a normal physics kick (small)
    }

    // Horizontal direction from camera to prop, projected to floor plane.
    const dir = new THREE.Vector3();
    dir.subVectors(prop.position, this.camera.position);
    dir.y = 0;
    if (dir.lengthSq() < 0.001) {
      dir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    }
    dir.normalize();

    // Per-type tuning so kicks feel right for each prop's mass/shape.
    // b151: doubled speeds + pop so kicks actually launch props instead of
    // nudging them. Should feel like a real punt, not a tap.
    // b156: midpoint tuning — b154 was too violent, original b150 was a tap.
    // b158: speeds bumped back up. Real fix is in physics tick — bounce-fric
    // was firing every rest-contact frame, which killed all carry.
    let speedScale = 1.40, spinScale = 1.05, popY = 2.0 + Math.random() * 1.0;
    if (prop.userData.isCone)          { speedScale = 1.30; spinScale = 1.20; popY = 1.5 + Math.random() * 0.9; }
    else if (prop.userData.isCrate)    { speedScale = 1.40; spinScale = 0.85; popY = 1.8 + Math.random() * 1.0; }
    else if (prop.userData.isCoil)     { speedScale = 1.55; spinScale = 0.55; popY = 1.9 + Math.random() * 0.9; }
    else if (prop.userData.isKillBall) { speedScale = 1.50; spinScale = 0.55; popY = 1.2 + Math.random() * 0.6; }

    const speed = (9.0 + Math.random() * 5.0) * speedScale;
    const spinM = 6 * spinScale;
    prop.userData.vel = new THREE.Vector3(
      dir.x * speed,
      popY,
      dir.z * speed,
    );
    // b153: bias initial tumble to roll along the kick direction. Rolling-axis
    // for motion along (dx,0,dz) is (dz, 0, -dx) by RHR — pure random spin
    // looked like wobble, this looks like a kick. Random jitter still layered.
    // b156: rollMag halved so the spin reads as a tumble, not a blender.
    const rollMag = (5 + Math.random() * 3) * spinScale;
    prop.userData.angVel = new THREE.Vector3(
      dir.z * rollMag + (Math.random() - 0.5) * spinM * 0.5,
      (Math.random() - 0.5) * spinM * 0.4,
      -dir.x * rollMag + (Math.random() - 0.5) * spinM * 0.5,
    );
    prop.userData.kicked = true;
    if (prop.userData.floorY === undefined) prop.userData.floorY = -8;
  },

  /* ---------- Coil explosion + respawn ---------- */
  _explodeCoil(coil) {
    const cx = coil.position.x, cy = coil.position.y + 0.9, cz = coil.position.z;

    // 1) Bright flash sprite at the explosion point
    const flashCanvas = document.createElement('canvas');
    flashCanvas.width = flashCanvas.height = 256;
    const fcx = flashCanvas.getContext('2d');
    const fg = fcx.createRadialGradient(128, 128, 0, 128, 128, 128);
    fg.addColorStop(0, 'rgba(255, 255, 240, 1.0)');
    fg.addColorStop(0.4, 'rgba(255, 180, 80, 0.85)');
    fg.addColorStop(1, 'rgba(120, 30, 0, 0.0)');
    fcx.fillStyle = fg; fcx.fillRect(0, 0, 256, 256);
    const flashTex = new THREE.CanvasTexture(flashCanvas);
    flashTex.minFilter = THREE.LinearFilter;
    const flashMat = new THREE.SpriteMaterial({ map: flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 1 });
    const flash = new THREE.Sprite(flashMat);
    flash.scale.set(0.5, 0.5, 1);
    flash.position.set(cx, cy, cz);
    this.scene.add(flash);

    this.explosionParticles.push({
      mesh: flash, kind: 'flash', life: 0, lifeMax: 0.55,
      growFrom: 0.5, growTo: 9.0,
    });

    // 2) Fragment particles — small bright sprites flying outward + falling
    const fragCanvas = document.createElement('canvas');
    fragCanvas.width = fragCanvas.height = 32;
    const fragCx = fragCanvas.getContext('2d');
    const fragG = fragCx.createRadialGradient(16, 16, 0, 16, 16, 16);
    fragG.addColorStop(0, 'rgba(255, 240, 200, 1.0)');
    fragG.addColorStop(0.5, 'rgba(255, 130, 40, 0.85)');
    fragG.addColorStop(1, 'rgba(80, 10, 0, 0)');
    fragCx.fillStyle = fragG; fragCx.fillRect(0, 0, 32, 32);
    const fragTex = new THREE.CanvasTexture(fragCanvas);
    fragTex.minFilter = THREE.LinearFilter;

    for (let i = 0; i < 36; i++) {
      const fragMat = new THREE.SpriteMaterial({ map: fragTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 1 });
      const frag = new THREE.Sprite(fragMat);
      const scale = 0.25 + Math.random() * 0.45;
      frag.scale.set(scale, scale, 1);
      frag.position.set(cx, cy, cz);
      this.scene.add(frag);
      // Random outward velocity (mostly horizontal + small upward arc)
      const ang = Math.random() * Math.PI * 2;
      const horizSpeed = 4 + Math.random() * 8;
      const vy = 2 + Math.random() * 6;
      this.explosionParticles.push({
        mesh: frag, kind: 'frag',
        vel: new THREE.Vector3(Math.cos(ang) * horizSpeed, vy, Math.sin(ang) * horizSpeed),
        life: 0, lifeMax: 1.2 + Math.random() * 0.8,
      });
    }

    // 3) Hide the coil + schedule respawn
    coil.visible = false;
    coil.userData.exploded = true;
    coil.userData.kicked = false;
    if (coil.userData.vel) coil.userData.vel.set(0, 0, 0);
    if (coil.userData.angVel) coil.userData.angVel.set(0, 0, 0);
    // Respawn 60s from now
    coil.userData.respawnAt = (this.clock?.elapsedTime || 0) + 60;
  },

  _respawnCoil(coil) {
    const p = this._pickFloorPosition(5, 24);
    coil.position.set(p.x, -8, p.z);
    coil.rotation.set(0, Math.random() * Math.PI * 2, 0);
    coil.userData.hits = 0;
    coil.userData.heat = 0;
    coil.userData.hitThreshold = 3 + Math.floor(Math.random() * 3);
    coil.userData.exploded = false;
    coil.userData.respawnAt = 0;
    coil.userData.floorY = -8;
    coil.visible = true;
    if (coil.userData.plasmaMats) {
      coil.userData.plasmaMats.forEach(m => { m.uniforms.uHeat.value = 0; });
    }
  },

  _tickExplosions(dt) {
    if (!this.explosionParticles || !this.explosionParticles.length) return;
    for (let i = this.explosionParticles.length - 1; i >= 0; i--) {
      const ep = this.explosionParticles[i];
      ep.life += dt;
      const t = ep.life / ep.lifeMax;
      if (t >= 1) {
        this.scene.remove(ep.mesh);
        ep.mesh.material.dispose?.();
        if (ep.mesh.material.map) ep.mesh.material.map.dispose?.();
        this.explosionParticles.splice(i, 1);
        continue;
      }
      if (ep.kind === 'flash') {
        const s = ep.growFrom + (ep.growTo - ep.growFrom) * t;
        ep.mesh.scale.set(s, s, 1);
        ep.mesh.material.opacity = 1 - t;
      } else if (ep.kind === 'frag') {
        // Integrate
        ep.mesh.position.x += ep.vel.x * dt;
        ep.mesh.position.y += ep.vel.y * dt;
        ep.mesh.position.z += ep.vel.z * dt;
        ep.vel.y -= 14.0 * dt;  // gravity
        // Fade out + slightly shrink
        ep.mesh.material.opacity = 1 - t;
      }
    }
  },

  _tickCoilRespawns(t) {
    if (!this.props) return;
    this.props.forEach(p => {
      if (p.userData?.isCoil && p.userData.exploded && p.userData.respawnAt > 0 && t >= p.userData.respawnAt) {
        this._respawnCoil(p);
      }
    });
  },

  _tickCoilCountdowns(t) {
    if (!this.props) return;
    this.props.forEach(p => {
      if (!p.userData?.isCoil || p.userData.exploded) return;
      if (p.userData.detonateAt <= 0) return;

      const remaining = p.userData.detonateAt - t;
      const total = p.userData.countdownDuration;
      const progress = Math.max(0, Math.min(1, 1 - remaining / total));

      // Push uHeat past 1.0 toward 1.6 over the countdown — plasma rages,
      // shader's flicker term goes wild because of the sin(uTime * (8 + uHeat * 14))
      const overheat = 1.0 + progress * 0.6;
      if (p.userData.plasmaMats) {
        p.userData.plasmaMats.forEach(m => { m.uniforms.uHeat.value = overheat; });
      }

      // Ground-shake the coil a tiny bit during fuse (only if it's resting)
      if (!p.userData.kicked) {
        const shake = progress * 0.06;
        p.position.x += (Math.random() - 0.5) * shake;
        p.position.z += (Math.random() - 0.5) * shake;
      }

      if (remaining <= 0) {
        this._explodeCoil(p);
      }
    });
  },

  _tickPropsPhysics(dt) {
    if (!this.props) return;
    this.props.forEach(p => {
      if (!p.userData?.kicked || !p.userData.vel) return;
      const vel = p.userData.vel;
      const av  = p.userData.angVel;
      // Integrate position + rotation
      p.position.x += vel.x * dt;
      p.position.y += vel.y * dt;
      p.position.z += vel.z * dt;
      p.rotation.x += av.x * dt;
      p.rotation.y += av.y * dt;
      p.rotation.z += av.z * dt;
      // Gravity
      vel.y -= 14.0 * dt;
      // Per-type damping so cones roll, crates skid, coils settle, balls drift.
      // b151: lighter air damping so the bigger kicks actually carry distance.
      // b153: angular damping eased further so spin survives long enough to read.
      // b156: bumped both back up a notch — kicks were carrying & spinning too long.
      // b157: pulled airRate/angRate back down — b156 settled in ~1s, looked dead.
      const isCone = !!p.userData.isCone;
      const airRate = isCone ? 0.11 : 0.18;
      const angRate = isCone ? 0.20 : 0.32;
      const airDamp = Math.max(0, 1 - airRate * dt);
      vel.x *= airDamp;
      vel.z *= airDamp;
      const angDamp = Math.max(0, 1 - angRate * dt);
      av.x *= angDamp; av.y *= angDamp; av.z *= angDamp;
      // Floor collision via bounding box — handles tumbling rotations so
      // tipped cones / rolling crates don't sink through the grid.
      const FLOOR = -8;
      const box = p.userData._box || (p.userData._box = new THREE.Box3());
      box.setFromObject(p);
      const sinkDepth = FLOOR - box.min.y;
      if (sinkDepth > 0) {
        p.position.y += sinkDepth;
        // b158: only treat this as a real impact bounce if vel.y is meaningfully
        // negative. Without this guard, gravity → tiny negative vel.y → contact
        // → slideFric ran every other frame at rest, killing all horiz carry in
        // ~1 second. Now small contacts just zero out vel.y (resting), and only
        // honest impacts apply bounce/slide friction.
        if (vel.y < -0.8) {
          vel.y = -vel.y * 0.30;
          const slideFric = isCone ? 0.94 : 0.86;
          const angBounce = isCone ? 0.92 : 0.80;
          vel.x *= slideFric;
          vel.z *= slideFric;
          av.x *= angBounce; av.y *= angBounce; av.z *= angBounce;
        } else if (vel.y < 0) {
          vel.y = 0;
        }
      }
      // b153: rolling assist — while the box is in contact with the floor and
      // the prop has horizontal velocity, steer angVel toward the physically
      // correct rolling rate (v/r) about the perpendicular axis. Makes slides
      // look like rolls instead of frozen-spin skids.
      // b156: target scaled to 0.55× of true v/r — physically-correct rolling
      // looks hyperactive on miniature props at scene scale.
      const onFloorContact = box.min.y <= FLOOR + 0.05;
      const horizSpdSq = vel.x * vel.x + vel.z * vel.z;
      if (onFloorContact && horizSpdSq > 0.04) {
        const radius = Math.max(0.4, (box.max.y - box.min.y) * 0.5);
        // b159: coils are tall + skinny — using box-height/2 as the rolling
        // radius gives a tiny denominator and absurdly high target spin. Cut
        // their effective rolling contribution way down.
        const rollK = p.userData.isCoil ? 0.20 : 0.55;
        const targetAngX =  rollK * vel.z / radius;
        const targetAngZ = -rollK * vel.x / radius;
        const k = 1 - Math.exp(-2.5 * dt);
        av.x += (targetAngX - av.x) * k;
        av.z += (targetAngZ - av.z) * k;
        // b158: gentle continuous ground-rolling friction (replaces the per-
        // frame slideFric that used to fire at rest). Cones roll farther.
        const groundRate = isCone ? 0.25 : 0.55;
        const groundDamp = Math.max(0, 1 - groundRate * dt);
        vel.x *= groundDamp;
        vel.z *= groundDamp;
      }
      // Sleep when slow enough (use box bottom — tumbled cones can rest on
      // their side on the floor without origin being at floorY).
      const horizSpeedSq = vel.x * vel.x + vel.z * vel.z;
      const onFloor = box.min.y <= FLOOR + 0.05;
      if (Math.abs(vel.y) < 0.12 && horizSpeedSq < 0.05 && onFloor) {
        p.userData.kicked = false;
        vel.set(0, 0, 0);
        av.multiplyScalar(0.25);
        if (av.length() < 0.05) av.set(0, 0, 0);
      }
    });
  },

  _makeTrafficCone() {
    const grp = new THREE.Group();
    const orangeMat = new THREE.MeshBasicMaterial({ color: 0xff5a1a });
    const orangeDarkMat = new THREE.MeshBasicMaterial({ color: 0xc8420f });
    // Thick rectangular base (matches Halo Reach reference — no white stripes)
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.18, 1.05), orangeMat);
    base.position.y = 0.09;
    grp.add(base);
    // Slight bevel cap on top of the base for thickness
    const baseTop = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.85), orangeDarkMat);
    baseTop.position.y = 0.20;
    grp.add(baseTop);
    // Cone body — taller, smooth, single solid orange
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.10, 18), orangeMat);
    cone.position.y = 0.78;
    grp.add(cone);
    // Tiny dark hollow cap on tip (the open hole on a real cone)
    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12),
      new THREE.MeshBasicMaterial({ color: 0x4a1a08 }),
    );
    tip.position.y = 1.35;
    grp.add(tip);
    grp.userData.isCone = true;
    return grp;
  },

  _makeFusionCoil() {
    // Halo Reach style — tall rectangular cage with glass windows showing
    // animated plasma fire inside (orange variant).
    const grp = new THREE.Group();
    const casing = new THREE.MeshBasicMaterial({ color: 0x2a2e36 });   // dark gunmetal
    const accent = new THREE.MeshBasicMaterial({ color: 0x6a4022 });   // copper accent
    const W = 0.65, D = 0.55, H = 1.85;

    // Plasma window shader — turbulent fire. uHeat (0..1) ramps up with each
    // kick so the coil visibly destabilizes before exploding.
    const plasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: Math.random() * 100 },
        uHeat: { value: 0 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime;
        uniform float uHeat;
        varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
        }
        float fbm(vec2 p){
          float v = 0.0, a = 0.55;
          for(int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.05; a *= 0.55; }
          return v;
        }
        void main(){
          vec2 uv = vUv;
          // Animation speed scales with heat
          float speed = 0.4 + uHeat * 1.6;
          float n1 = fbm(uv * vec2(3.0, 5.0)         + vec2(0.0, -uTime * speed));
          float n2 = fbm(uv * vec2(6.0 + uHeat * 5.0, 9.0) + vec2(uTime * 0.2, -uTime * (0.7 + uHeat * 1.5)));
          float plasma = (n1 + n2 * 0.5) / 1.5;
          float center = 1.0 - distance(uv, vec2(0.5)) * 1.6;
          center = clamp(center, 0.0, 1.0);
          float intensity = plasma * (0.55 + center * 0.7);
          intensity *= 1.0 + uHeat * 0.6;
          vec3 dark   = vec3(0.40, 0.06, 0.02);
          vec3 mid    = vec3(1.00, 0.35, 0.05);
          vec3 hot    = vec3(1.00, 0.85, 0.45);
          vec3 white  = vec3(1.00, 0.95, 0.85);
          vec3 col = mix(dark, mid, smoothstep(0.25, 0.55, intensity));
          col = mix(col, hot, smoothstep(0.65, 0.95, intensity));
          // Heat shifts the entire palette toward white-hot + brightens
          col = mix(col, white, uHeat * 0.55);
          col *= 1.1 + uHeat * 0.8;
          // Bass-like flicker as it nears explosion
          col *= 1.0 + uHeat * 0.25 * sin(uTime * (8.0 + uHeat * 14.0));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    // Top + bottom caps
    const cap = new THREE.Mesh(new THREE.BoxGeometry(W + 0.08, 0.16, D + 0.08), casing);
    cap.position.y = 0.08;
    grp.add(cap);
    const capTop = new THREE.Mesh(new THREE.BoxGeometry(W + 0.08, 0.16, D + 0.08), casing);
    capTop.position.y = H - 0.08;
    grp.add(capTop);
    // Top accent rim
    const rim = new THREE.Mesh(new THREE.BoxGeometry(W + 0.10, 0.04, D + 0.10), accent);
    rim.position.y = H - 0.16;
    grp.add(rim);
    const rimBot = new THREE.Mesh(new THREE.BoxGeometry(W + 0.10, 0.04, D + 0.10), accent);
    rimBot.position.y = 0.16;
    grp.add(rimBot);

    // 4 corner posts (vertical struts)
    const postW = 0.08, postH = H - 0.32;
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(postW, postH, postW), casing);
      post.position.set(sx * (W / 2), H / 2, sz * (D / 2));
      grp.add(post);
    });

    // All 4 sides — glass plasma windows (front, back, left, right).
    // Each uses its own plasma shader instance so the fire animations don't
    // sync visibly across the 4 faces.
    const plasmaMats = [];
    const makePlasmaInstance = () => {
      const m = plasmaMat.clone();
      m.uniforms = THREE.UniformsUtils.clone(plasmaMat.uniforms);
      m.uniforms.uTime.value = Math.random() * 100;
      plasmaMats.push(m);
      return m;
    };
    // Front + back (along Z)
    [1, -1].forEach(sz => {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.78, postH * 0.92), makePlasmaInstance());
      win.position.set(0, H / 2, sz * (D / 2 + 0.001));
      win.rotation.y = sz > 0 ? 0 : Math.PI;
      grp.add(win);
      const frameH = postH * 0.92;
      [frameH / 2 + 0.03, -frameH / 2 - 0.03].forEach(dy => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(W * 0.78 + 0.10, 0.06, 0.05), casing);
        bar.position.set(0, H / 2 + dy, sz * (D / 2 + 0.02));
        grp.add(bar);
      });
    });
    // Left + right (along X) — same plasma window treatment
    [1, -1].forEach(sx => {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(D * 0.82, postH * 0.92), makePlasmaInstance());
      win.position.set(sx * (W / 2 + 0.001), H / 2, 0);
      win.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      grp.add(win);
      const frameH = postH * 0.92;
      [frameH / 2 + 0.03, -frameH / 2 - 0.03].forEach(dy => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, D * 0.82 + 0.10), casing);
        bar.position.set(sx * (W / 2 + 0.02), H / 2 + dy, 0);
        grp.add(bar);
      });
      // Accent strip on the corner posts
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, postH * 0.8, 0.06), accent);
      strip.position.set(sx * (W / 2 + 0.06), H / 2, 0);
      grp.add(strip);
    });

    // Top warning sticker (tiny accent block)
    const sticker = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.02, 0.10), new THREE.MeshBasicMaterial({ color: 0xffcc55 }));
    sticker.position.set(0, H + 0.01, 0);
    grp.add(sticker);

    grp.userData = {
      plasmaMats, isCoil: true,
      hits: 0,
      hitThreshold: 3,
      heat: 0,
      detonateAt: 0,
      countdownDuration: 2.5 + Math.random() * 1.0,   // 2.5–3.5 s fuse
      respawnAt: 0,
      exploded: false,
    };
    return grp;
  },

  _makeKillBall() {
    // Halo Reach Forge object — bright inner core inside a translucent outer
    // shell with surface lightning crackles and internal plasma turbulence.
    // These are HUGE in Reach (the size of a small room), placed behind the
    // panel arc so they read as deep-space hazards in the distance.
    const grp = new THREE.Group();
    const SCALE = 4.0;  // ~3.5x larger than the v1

    // Inner bright core — small dense sphere, hot white-orange
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 * SCALE, 24, 24),
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: Math.random() * 100 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform float uTime;
          varying vec2 vUv;
          void main(){
            float pulse = 0.85 + 0.15 * sin(uTime * 4.0);
            vec3 col = vec3(1.0, 0.95, 0.85) * pulse * 1.3;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    );
    grp.add(core);
    grp.userData.core = core;

    // Outer shell — translucent fresnel sphere with surface lightning crackles
    // and animated plasma turbulence, additive on top of the core
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.62 * SCALE, 48, 36),
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: Math.random() * 100 } },
        vertexShader: `
          varying vec3 vN;
          varying vec3 vV;
          varying vec3 vP;
          void main(){
            vN = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vV = normalize(-mv.xyz);
            vP = position;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          varying vec3 vN;
          varying vec3 vV;
          varying vec3 vP;
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
            float v = 0.0, a = 0.55;
            for(int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.05; a *= 0.55; }
            return v;
          }
          void main(){
            vec3 n = normalize(vN);
            vec3 v = normalize(vV);
            float fres = pow(1.0 - max(0.0, dot(n, v)), 1.8);

            // Surface plasma turbulence — animated 3D noise on the unit sphere
            float plasma = fbm(vP * 4.0 + vec3(0.0, uTime * 0.3, 0.0));
            float plasma2 = fbm(vP * 8.0 - vec3(uTime * 0.2, 0.0, 0.0));

            // Lightning crackles — narrow high-frequency noise bands
            float lightCore = abs(plasma2 - 0.5);
            float lightning = smoothstep(0.04, 0.0, lightCore);
            // Bias lightning to be thin (only 1.5% of pixels)
            lightning *= smoothstep(0.85, 1.0, fbm(vP * 14.0 + uTime * 0.4));

            // Color buildup: deep red shell → hot mid → white-hot for lightning
            vec3 deep   = vec3(0.55, 0.07, 0.02);
            vec3 mid    = vec3(1.00, 0.30, 0.06);
            vec3 hot    = vec3(1.00, 0.78, 0.40);
            vec3 col = mix(deep, mid, smoothstep(0.30, 0.65, plasma));
            col = mix(col, hot, smoothstep(0.65, 0.85, plasma) * 0.7);

            // Strong rim glow (it's a shell)
            col += vec3(1.00, 0.55, 0.20) * fres * 1.2;

            // Lightning streaks — bright white, additive
            col += vec3(1.0, 0.95, 0.85) * lightning * 2.5;

            // Translucent — fresnel makes the shell look like glowing energy boundary
            float a = 0.55 + fres * 0.45 + lightning * 0.5;
            gl_FragColor = vec4(col, a);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    grp.add(shell);
    grp.userData.shell = shell;

    // Soft halo behind the ball
    const haloC = document.createElement('canvas');
    haloC.width = haloC.height = 128;
    const hcx = haloC.getContext('2d');
    const hg = hcx.createRadialGradient(64, 64, 0, 64, 64, 64);
    hg.addColorStop(0, 'rgba(255, 110, 50, 0.95)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    hcx.fillStyle = hg; hcx.fillRect(0, 0, 128, 128);
    const haloTex = new THREE.CanvasTexture(haloC);
    haloTex.minFilter = THREE.LinearFilter;
    const haloMat = new THREE.SpriteMaterial({ map: haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.75 });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(2.4 * SCALE, 2.4 * SCALE, 1);
    grp.add(halo);
    grp.userData.halo = halo;
    grp.userData.isKillBall = true;
    grp.userData.scale = SCALE;
    return grp;
  },

  _makeCrate() {
    // b154: military gear-box. Cleaner silhouette than the prior "supply crate"
    // — olive-drab body, steel hardware, two front latch clamps, stencil stripe
    // on the lid. No top handle / LED / rivet noise.
    const grp = new THREE.Group();
    const body    = new THREE.MeshBasicMaterial({ color: 0x3a4030 });   // olive drab
    const bodyHi  = new THREE.MeshBasicMaterial({ color: 0x4d5440 });   // lighter olive (rib highlights)
    const steel   = new THREE.MeshBasicMaterial({ color: 0x1a1d22 });   // dark steel hardware
    const steelHi = new THREE.MeshBasicMaterial({ color: 0x2a2f36 });   // mid steel (latch faces)
    const stencil = new THREE.MeshBasicMaterial({ color: 0xc6c2a8 });   // stencil bone-white

    const W = 1.10, H = 0.92, D = 1.30;

    // Main body — olive drab
    const main = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), body);
    main.position.y = H / 2;
    grp.add(main);

    // Bottom skid runners — two parallel steel rails along the depth axis
    [-1, 1].forEach(sx => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.08, D + 0.06), steel);
      rail.position.set(sx * (W / 2 - 0.10), 0.04, 0);
      grp.add(rail);
    });

    // Lid — proud of the body, steel-cap colored
    const lid = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.10, D + 0.04), steelHi);
    lid.position.y = H + 0.01;
    grp.add(lid);
    // Stencil stripe across the lid
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(W * 0.55, 0.012, D * 0.10), stencil);
    stripe.position.set(0, H + 0.062, 0);
    grp.add(stripe);

    // Corner reinforcement caps — short steel cubes at the 8 corners
    const cw = 0.13;
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
      [0, H].forEach(yBase => {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.16, cw), steel);
        cap.position.set(
          sx * (W / 2 - cw / 2 + 0.014),
          yBase === 0 ? 0.08 : H - 0.08,
          sz * (D / 2 - cw / 2 + 0.014),
        );
        grp.add(cap);
      });
    });

    // Vertical rib detail on the long sides (front/back) — three thin highlights
    [1, -1].forEach(sz => {
      [-0.30, 0, 0.30].forEach(dx => {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.04, H * 0.70, 0.018), bodyHi);
        rib.position.set(dx, H / 2, sz * (D / 2 + 0.010));
        grp.add(rib);
      });
    });

    // Two latch clamps on the front face — the silhouette feature that reads "ammo crate"
    [-W * 0.28, W * 0.28].forEach(dx => {
      // Backing plate
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.18, 0.02), steelHi);
      plate.position.set(dx, H - 0.02, D / 2 + 0.020);
      grp.add(plate);
      // Latch hook — small steel block hanging below the plate, biting into the body
      const hook = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.12, 0.04), steel);
      hook.position.set(dx, H - 0.10, D / 2 + 0.034);
      grp.add(hook);
    });

    // Single small stencil block on the front lower-left — implies a unit number
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.012), stencil);
    mark.position.set(-W * 0.30, H * 0.28, D / 2 + 0.020);
    grp.add(mark);

    grp.userData.isCrate = true;
    return grp;
  },

  _makePylon() {
    const grp = new THREE.Group();
    const casing = new THREE.MeshBasicMaterial({ color: 0x383d48 });
    // Base pad
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.10, 8), casing);
    pad.position.y = 0.05;
    grp.add(pad);
    // Vertical strut
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 2.4, 6), casing);
    strut.position.y = 1.30;
    grp.add(strut);
    // Top emitter — small bright shader sphere
    const emitter = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 16, 16),
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: Math.random() * 100 } },
        vertexShader: `
          varying vec3 vN;
          varying vec3 vV;
          void main(){
            vN = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          varying vec3 vN;
          varying vec3 vV;
          void main(){
            float fres = pow(1.0 - max(0.0, dot(normalize(vN), normalize(vV))), 2.0);
            float pulse = 0.7 + 0.3 * sin(uTime * 1.6);
            vec3 col = mix(vec3(0.30, 0.60, 1.0), vec3(0.85, 0.95, 1.0), fres) * pulse;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    );
    emitter.position.y = 2.70;
    grp.add(emitter);
    grp.userData.emitter = emitter;
    // Spinning halo ring around the emitter
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.04, 6, 36),
      new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.position.y = 2.70;
    ring.rotation.x = Math.PI / 2;
    grp.add(ring);
    grp.userData.ring = ring;
    grp.userData.isPylon = true;
    return grp;
  },

  /* ---------- Holographic scene panels ----------
     Each panel lives in the world as a diegetic display — billboard,
     bunker monitor, command-tent TV, console terminal, comm tower display,
     server rack, barracks wall, topo podium, dish booth, Warthog screen,
     CRT on supply crates. The panel itself stays a flat Plane with the
     existing glitch shader so click → focus animation still works; the
     surrounding chassis is built by per-host helpers and lives in `panelHosts`. */
  _buildPanels() {
    this.panels = [];
    this.panelHosts = [];
    const home = { id: 'home', num: '00', title: 'galaxy', body: 'Back to the main hall — track titles drifting in the void. Click any to surface it.', hue: 0.55, isHome: true };

    // b167 layout: panels are now embedded WINDOWS in real buildings spread
    // asymmetrically across a forward arc. Heavy concentration in front
    // (-Z), sparse on the sides, near-empty behind. Smaller panels (5×3
    // default) so they read as displays mounted on big buildings, not as
    // floating UI cards. Foreground holds 3 small console terminals close
    // to camera so the user has something close grounding them.
    // b169 layout: buildings pushed out 50-70%. Panel sizes grow to keep
    // readability from camera. Foreground 3 close consoles ground the
    // user; everything else is 40-90u out so the installation reads as
    // a real base extending outward, not a ring.
    // b173 layout (option A — full theme remap). Every panel mounted on a
    // thematically-justifiable building. Foreground floating tables killed;
    // organism moves onto the barracks-row middle building, terrain + villa
    // become deck-rail kiosks at the front of the hex deck.
    // b176 layout — fixes the left-side cluster pile-up + the stretched
    // portrait aspect on tape spine & wall. Panel texture is hardcoded
    // 720×432 (1.667 landscape), so any panel sized portrait gets visibly
    // squashed. Three relocations:
    //   - tape spine: 5×8 portrait → 8×4.8 landscape, mounted on top of
    //     the supply-depot container stack instead of awkwardly floating.
    //   - wall: 4×6.5 portrait on fuel-tank (behind camera at +97°) →
    //     8×4.8 landscape on a new back-perimeter billboard at +130° az.
    //   - organism: middle-barracks at -82° azimuth (the biggest left
    //     cluster offender) → new biostation host at +165° az, behind
    //     the deck. Fills the previously empty rear-center void.
    const mounts = [
      // KEEP — these stayed in place:
      { scene: home,      pos: [-55,   8, -78], size: [16, 9.6],  host: 'missilesite' },             // galaxy → silo
      { scene: SCENES[1], pos: [ 20,   1, -42], size: [9,  5.4],  host: 'radarbuilding' },           // living wall → radar
      { scene: SCENES[3], pos: [-38,   5, -25], size: [8,  4.8],  host: 'commtowerbig' },            // freq map → comm tower
      { scene: SCENES[0], pos: [-58,  11, -49], size: [7,  4.2],  host: 'antenna_shed' },            // dimensions → antenna shed (b177: y=2 → y=11 to stratify above galaxy/deep-sea)
      { scene: SCENES[7], pos: [-72,   8, -38], size: [11, 6.6],  host: 'standoff_dish_billboard' }, // deep sea → standoff dish

      // RELOCATED (b176) — break the left cluster + fix portrait aspect:
      { scene: SCENES[4], pos: [ 60,   4,  -2], size: [8,  4.8],  host: 'supplydepot_top' },         // tape spine → horizontal billboard atop containers
      // RELOCATED (b187) — pulled the south-edge panels interior so the host buildings
      // sit clear of the south perimeter road (z=50±4.5). Was z=38 (12u from the road
      // edge, building footprint ate into that gap). Stagger z so wall + organism don't read flat.
      { scene: SCENES[5], pos: [ 45,   4,  32], size: [8,  4.8],  host: 'back_billboard' },          // wall → back-perimeter billboard (b187: z=38 → 32)
      { scene: SCENES[2], pos: [ 12,   3,  28], size: [7,  4.2],  host: 'biostation' },              // organism → biostation greenhouse (b187: z=38 → 28)

      // RELOCATED (b187) — neural was at (40, -22), 3u from the helipad at (42, -25).
      // Building host stack-up read as a chaotic single mass. Pulled forward + east to
      // give the neural billboard its own clean foreground.
      { scene: SCENES[8], pos: [ 52,   4, -16], size: [7,  4.2],  host: 'back_billboard' },          // neural → standalone back-billboard, clear of helipad (b187)

      // DECK-RAIL TACTICAL KIOSKS:
      { scene: SCENES[6], pos: [ -5, -3.0, -10], size: [3.0, 1.8], host: 'rail_kiosk_left' },        // terrain → topo display kiosk
      { scene: SCENES[9], pos: [  5, -3.0, -10], size: [3.0, 1.8], host: 'rail_kiosk_right' },       // villa → CRT kiosk
    ];

    mounts.forEach(m => {
      const s = m.scene;
      const [x, y, z] = m.pos;
      const [w, h] = m.size;
      const tex = this._makePanelTexture(s);
      const tint = hslToRgb(s.hue, 0.78, 0.62);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTex:   { value: tex },
          uTime:  { value: Math.random() * 100 },
          uHover: { value: 0 },
          uFocus: { value: 0 },
          uTint:  { value: new THREE.Vector3(tint[0], tint[1], tint[2]) },
        },
        vertexShader: PANEL_VERT,
        fragmentShader: PANEL_FRAG,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      const pos = new THREE.Vector3(x, y, z);
      plane.position.copy(pos);
      plane.lookAt(0, y * 0.5, 0);
      plane.userData = { isPanel: true, scene: s, basePos: pos.clone(), baseScale: 1, sizeW: w, sizeH: h };
      this.scene.add(plane);

      // b184: was a 1.8× radial sprite at 0.45 opacity which painted a
      // huge saturated splash onto whatever building was behind the panel.
      // Now a tight 1.05× backing card at 0.10 opacity — gives the panel
      // a subtle screen-glow rim without the colored fog.
      const haloTex = this._makeRadialGlowTexture(`rgba(${(tint[0]*255)|0},${(tint[1]*255)|0},${(tint[2]*255)|0},0.55)`);
      const haloMat = new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.10 });
      const halo = new THREE.Sprite(haloMat);
      halo.scale.set(w * 1.05, h * 1.05, 1);
      halo.position.copy(pos);
      this.scene.add(halo);

      this.panels.push({ mesh: plane, halo, scene: s, basePos: pos.clone(), tint, sizeW: w, sizeH: h });

      this._buildPanelHost(m.host, x, y, z, w, h);
    });
  },

  _buildPanelHost(kind, px, py, pz, w, h) {
    // Build the chassis or full building around a panel. The panel is a
    // flat plane at (px, py, pz) facing the camera (origin). The chassis
    // group is positioned at the panel and oriented to match (lookAt origin),
    // so local +Y is up, local -Z is "behind the panel" (away from camera),
    // and local +Z is toward camera. Floor sits at world y=-8; local floor-y
    // = (-8 - py). Multi-panel buildings (cmdbunker_*) build the big shared
    // mass on the FIRST referencing panel, then subsequent panels just add
    // a window-frame trim.
    this._builtBuildings ??= new Set();
    const grp = new THREE.Group();
    grp.position.set(px, py, pz);
    grp.lookAt(0, py * 0.5, 0);
    const floorY = -8 - py;  // local Y of the world floor

    const steel  = new THREE.MeshBasicMaterial({ color: 0x14171e });
    const accent = new THREE.MeshBasicMaterial({ color: 0x1e222b });
    const dark   = new THREE.MeshBasicMaterial({ color: 0x0c0e14 });
    const concrete = new THREE.MeshBasicMaterial({ color: 0x222836 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x2c3344 });
    const yellow = new THREE.MeshBasicMaterial({ color: 0x5a4a14 });
    const olive  = new THREE.MeshBasicMaterial({ color: 0x3a4030 });
    const oliveHi= new THREE.MeshBasicMaterial({ color: 0x4d5440 });

    // Window-frame trim around the panel (skip on cmdbunker_billboard which
    // is a free-standing roof billboard, not a window).
    const isBillboard = kind === 'cmdbunker_billboard';
    if (!isBillboard) {
      const fW = w * 1.10, fH = h * 1.16, fT = 0.20;
      [-fH/2, fH/2].forEach(yo => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(fW, fT, 0.25), steel);
        r.position.set(0, yo, -0.04); grp.add(r);
      });
      [-fW/2, fW/2].forEach(xo => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(fT, fH, 0.25), steel);
        r.position.set(xo, 0, -0.04); grp.add(r);
      });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.02, h * 1.04), dark);
      back.position.set(0, 0, -0.10);
      grp.add(back);
    }

    if (kind === 'missilesite') {
      if (!this._builtBuildings.has('missilesite')) {
        this._builtBuildings.add('missilesite');
        this._buildMissileSite();
      }
      // Galaxy panel: thicker outer frame + 2 short support struts so it
      // reads as a control-station billboard adjacent to the launch pad.
      const fW = w * 1.10, fH = h * 1.20, fT = 0.30;
      [-fH/2, fH/2].forEach(yo => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(fW, fT, 0.40), steel);
        r.position.set(0, yo, -0.05); grp.add(r);
      });
      [-fW/2, fW/2].forEach(xo => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(fT, fH, 0.40), steel);
        r.position.set(xo, 0, -0.05); grp.add(r);
      });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.04, h * 1.06), dark);
      back.position.set(0, 0, -0.18);
      grp.add(back);
      // Twin masts to the launch pad below
      [-fW * 0.40, fW * 0.40].forEach(xo => {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, -floorY, 6), steel);
        mast.position.set(xo, floorY / 2, -0.30);
        grp.add(mast);
      });
      const strobe = this._makeRunningLight(0xff3344, 0.45);
      strobe.position.set(0, fH/2 + 0.6, 0);
      strobe.userData = { rate: 1.6, phase: Math.random() * 6 };
      grp.add(strobe);
      this.standoff?.strobes.push(strobe);
    }

    else if (kind === 'cmdbunker_window') {
      if (!this._builtBuildings.has('cmdbunker')) {
        this._builtBuildings.add('cmdbunker');
        this._buildCmdBunker();
      }
      const sill = new THREE.Mesh(new THREE.BoxGeometry(w * 1.30, 0.20, 0.40), concreteLit);
      sill.position.set(0, -h/2 - 0.30, -0.05);
      grp.add(sill);
    }

    else if (kind === 'radarbuilding') {
      if (!this._builtBuildings.has('radarbuilding')) {
        this._builtBuildings.add('radarbuilding');
        this._buildRadarBuilding();
      }
      // Awning above the panel + concrete sill
      const awning = new THREE.Mesh(new THREE.BoxGeometry(w * 1.45, 0.20, 0.85), concreteLit);
      awning.position.set(0, h/2 + 0.40, 0.30);
      grp.add(awning);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(w * 1.30, 0.20, 0.40), concreteLit);
      sill.position.set(0, -h/2 - 0.30, -0.05);
      grp.add(sill);
    }

    else if (kind === 'vehiclebay') {
      if (!this._builtBuildings.has('vehiclebay')) {
        this._builtBuildings.add('vehiclebay');
        this._buildVehicleBay();
      }
      // Panel sits on the back interior wall — no extra trim needed
    }

    else if (kind === 'barracksbig') {
      if (!this._builtBuildings.has('barracks')) {
        this._builtBuildings.add('barracks');
        this._buildBarracksBig();
      }
      // Sandbag berm in front of the window
      const bagMat = new THREE.MeshBasicMaterial({ color: 0x14171d });
      for (let i = -2; i <= 2; i++) {
        const x1 = i * 0.95;
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.36, 0.55), bagMat);
        b1.position.set(x1, floorY + 0.18, 0.55);
        b1.rotation.y = (Math.random() - 0.5) * 0.15;
        grp.add(b1);
        if (i < 2) {
          const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.36, 0.55), bagMat);
          b2.position.set(x1 + 0.475, floorY + 0.52, 0.55);
          b2.rotation.y = (Math.random() - 0.5) * 0.15;
          grp.add(b2);
        }
      }
    }

    else if (kind === 'supplydepot') {
      if (!this._builtBuildings.has('supplydepot')) {
        this._builtBuildings.add('supplydepot');
        this._buildSupplyDepot();
      }
      // Caution stripe above the vertical screen
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(w * 1.30, 0.10, 0.06), yellow);
      stripe.position.set(0, h/2 + 0.30, 0);
      grp.add(stripe);
    }

    else if (kind === 'supplydepot_top') {
      // b176: tape spine landscape billboard mounted on top of the
      // stacked-container depot. Same depot shared with `supplydepot` (built
      // once). Adds an under-panel catwalk + a yellow caution stripe above.
      if (!this._builtBuildings.has('supplydepot')) {
        this._builtBuildings.add('supplydepot');
        this._buildSupplyDepot();
      }
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(w * 1.30, 0.12, 0.08), yellow);
      stripe.position.set(0, h/2 + 0.34, 0);
      grp.add(stripe);
      // Catwalk under the panel suggesting roof-mounted service access
      const cat = new THREE.Mesh(new THREE.BoxGeometry(w * 1.20, 0.16, 0.65), accent);
      cat.position.set(0, -h/2 - 0.35, 0.12);
      grp.add(cat);
      const railA = new THREE.Mesh(new THREE.BoxGeometry(w * 1.20, 0.04, 0.04), steel);
      railA.position.set(0, -h/2 - 0.35 + 0.55, 0.42);
      grp.add(railA);
      // Twin short masts up to the panel from the catwalk
      [-w * 0.42, w * 0.42].forEach(xo => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.55, 6), steel);
        m.position.set(xo, -h/2 - 0.10, 0.18);
        grp.add(m);
      });
      // Strobe on top edge
      const strobe = this._makeRunningLight(0xffaa55, 0.30);
      strobe.position.set(w * 0.35, h/2 + 0.55, 0);
      strobe.userData = { rate: 1.4, phase: Math.random() * 6 };
      grp.add(strobe);
      this.standoff?.strobes.push(strobe);
    }

    else if (kind === 'back_billboard') {
      // b176: free-standing horizontal billboard at the back perimeter
      // (host for `wall`). Twin steel masts down to floor + thicker frame
      // + concrete footing pads. Visually similar to the antenna-shed
      // billboard but heavier (it's the only thing back there).
      const fW = w * 1.10, fH = h * 1.22, fT = 0.34;
      [-fH/2, fH/2].forEach(yo => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(fW, fT, 0.45), steel);
        r.position.set(0, yo, -0.06); grp.add(r);
      });
      [-fW/2, fW/2].forEach(xo => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(fT, fH, 0.45), steel);
        r.position.set(xo, 0, -0.06); grp.add(r);
      });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.04, h * 1.06), dark);
      back.position.set(0, 0, -0.20);
      grp.add(back);
      // Twin support masts
      [-fW * 0.40, fW * 0.40].forEach(xo => {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.26, -floorY, 6), steel);
        mast.position.set(xo, floorY / 2, -0.34);
        grp.add(mast);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 1.1), concrete);
        foot.position.set(xo, floorY + 0.25, -0.34);
        grp.add(foot);
      });
      // Caution stripe along the bottom
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.12, 0.08), yellow);
      stripe.position.set(0, -fH/2 - 0.30, 0.05);
      grp.add(stripe);
      // Top strobe
      const strobe = this._makeRunningLight(0xff3344, 0.40);
      strobe.position.set(0, fH/2 + 0.6, 0);
      strobe.userData = { rate: 1.6, phase: Math.random() * 6 };
      grp.add(strobe);
      this.standoff?.strobes.push(strobe);
    }

    else if (kind === 'biostation') {
      // b176: small greenhouse / biolab structure (host for `organism`).
      // The host trim is the panel frame (already added above for non-
      // billboard kinds). The actual biostation building is placed once.
      if (!this._builtBuildings.has('biostation')) {
        this._builtBuildings.add('biostation');
        this._buildBioStation();
      }
      // Concrete sill + thin top awning to read as a window in a building
      const sill = new THREE.Mesh(new THREE.BoxGeometry(w * 1.30, 0.20, 0.40), concreteLit);
      sill.position.set(0, -h/2 - 0.30, -0.05);
      grp.add(sill);
      const awn = new THREE.Mesh(new THREE.BoxGeometry(w * 1.40, 0.14, 0.55), concreteLit);
      awn.position.set(0, h/2 + 0.30, 0.20);
      grp.add(awn);
    }

    else if (kind === 'commtowerbig') {
      if (!this._builtBuildings.has('commtower')) {
        this._builtBuildings.add('commtower');
        this._buildCommTowerBig();
      }
      // Service platform / catwalk under the display
      const plat = new THREE.Mesh(new THREE.BoxGeometry(w * 1.30, 0.18, 1.6), accent);
      plat.position.set(0, -h/2 - 0.20, -0.15);
      grp.add(plat);
      // Catwalk railing
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w * 1.30, 0.04, 0.04), steel);
      rail.position.set(0, -h/2 - 0.20 + 0.65, 0.55);
      grp.add(rail);
    }

    else if (kind === 'helipadbooth') {
      if (!this._builtBuildings.has('helipad')) {
        this._builtBuildings.add('helipad');
        this._buildHelipad();
      }
      // Dish-uplink antenna on top of the booth
      const antMast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.10, 1.6, 4), steel);
      antMast.position.set(0, h/2 + 0.8, -0.15);
      grp.add(antMast);
      const miniDish = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
        accent,
      );
      miniDish.position.set(0, h/2 + 1.7, -0.15);
      miniDish.rotation.x = -Math.PI * 0.40;
      grp.add(miniDish);
    }

    // ============================================================
    // FOREGROUND consoles — small, ground-level, close to camera.
    // No big building behind them; they're terminal stations.
    // ============================================================
    else if (kind === 'fgconsole_left' || kind === 'fgconsole_topo') {
      // Console table: tilted-screen + keyboard bar + table + LEDs
      const tableH = 2.4;
      const top = new THREE.Mesh(new THREE.BoxGeometry(w * 1.5, 0.18, 1.6), accent);
      top.position.set(0, -h/2 - 0.30, -0.15);
      grp.add(top);
      [-w * 0.65, w * 0.65].forEach(xo => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, tableH, 0.18), steel);
        leg.position.set(xo, -h/2 - 0.30 - tableH / 2, -0.15);
        grp.add(leg);
      });
      const kb = new THREE.Mesh(new THREE.BoxGeometry(w * 1.20, 0.10, 0.45), steel);
      kb.position.set(0, -h/2 - 0.40, 0.25);
      grp.add(kb);
      [-0.6, 0, 0.6].forEach(xo => {
        const led = this._makeRunningLight(xo === 0 ? 0xff3344 : 0x66ff99, 0.08);
        led.position.set(xo, -h/2 - 0.20, 0.10);
        grp.add(led);
      });
      // Topo podium gets an extra amber map-light ring
      if (kind === 'fgconsole_topo') {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.3, 0.04, 4, 24),
          new THREE.MeshBasicMaterial({ color: 0xffaa55, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, -h/2 - 0.20, -0.15);
        grp.add(ring);
      }
    }

    else if (kind === 'fgconsole_crt') {
      // Stacked supply crates beneath a chunky CRT
      const crateMat = olive;
      const crateRibMat = oliveHi;
      const stencil = new THREE.MeshBasicMaterial({ color: 0xc6c2a8 });
      const stack = [
        { x: -0.55, y: floorY + 0.50, z: 0.10 },
        { x:  0.60, y: floorY + 0.50, z: -0.10 },
        { x:  0.10, y: floorY + 1.50, z: 0.00 },
      ];
      stack.forEach(s => {
        const c = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.92, 1.3), crateMat);
        c.position.set(s.x, s.y, s.z);
        c.rotation.y = (Math.random() - 0.5) * 0.20;
        grp.add(c);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.10, 1.34), crateRibMat);
        lid.position.set(s.x, s.y + 0.51, s.z);
        lid.rotation.y = c.rotation.y;
        grp.add(lid);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.012, 0.13), stencil);
        stripe.position.set(s.x, s.y + 0.57, s.z);
        stripe.rotation.y = c.rotation.y;
        grp.add(stripe);
      });
      // Beefy CRT bezel + cathode hump
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(w * 1.30, h * 1.35, 0.85), accent);
      bezel.position.set(0, 0, -0.45);
      grp.add(bezel);
      const hump = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.30, 1.0, 12), accent);
      hump.rotation.x = Math.PI / 2;
      hump.position.set(0, 0, -1.30);
      grp.add(hump);
    }

    // ============================================================
    // b173 NEW HOSTS
    // ============================================================
    else if (kind === 'antenna_shed') {
      // Free-standing billboard adjacent to the antenna array. Twin support
      // poles + thicker outer frame + back panel.
      const fW = w * 1.10, fH = h * 1.20, fT = 0.30;
      [-fH/2, fH/2].forEach(yo => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(fW, fT, 0.40), steel);
        r.position.set(0, yo, -0.05); grp.add(r);
      });
      [-fW/2, fW/2].forEach(xo => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(fT, fH, 0.40), steel);
        r.position.set(xo, 0, -0.05); grp.add(r);
      });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.04, h * 1.06), dark);
      back.position.set(0, 0, -0.18);
      grp.add(back);
      // Twin support masts down to the ground
      [-fW * 0.40, fW * 0.40].forEach(xo => {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, -floorY, 6), steel);
        mast.position.set(xo, floorY / 2, -0.30);
        grp.add(mast);
      });
      // Concrete footing pads
      [-fW * 0.40, fW * 0.40].forEach(xo => {
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.9), concrete);
        foot.position.set(xo, floorY + 0.20, -0.30);
        grp.add(foot);
      });
      // Strobe on top
      const strobe = this._makeRunningLight(0xff3344, 0.35);
      strobe.position.set(0, fH/2 + 0.5, 0);
      strobe.userData = { rate: 1.6, phase: Math.random() * 6 };
      grp.add(strobe);
      this.standoff?.strobes.push(strobe);
    }

    else if (kind === 'fuel_tank') {
      // Panel mounted as a banner on the side of one of the fuel tanks.
      // Tall vertical frame + bracket clamps + visible bands wrapping the
      // tank. Local +Z faces camera.
      const fW = w * 1.10, fH = h * 1.10, fT = 0.18;
      [-fH/2, fH/2].forEach(yo => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(fW, fT, 0.18), steel);
        r.position.set(0, yo, -0.04); grp.add(r);
      });
      [-fW/2, fW/2].forEach(xo => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(fT, fH, 0.18), steel);
        r.position.set(xo, 0, -0.04); grp.add(r);
      });
      // 4 bracket clamps (corners) suggesting it's bolted to the tank
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
        const cl = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.30, 0.32), accent);
        cl.position.set(sx * (fW / 2 - 0.15), sy * (fH / 2 - 0.15), -0.20);
        grp.add(cl);
      });
      // Hazardous-cargo caution stripe at the top
      const yellow = new THREE.MeshBasicMaterial({ color: 0x6a5618 });
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.10, 0.06), yellow);
      stripe.position.set(0, fH / 2 + 0.30, 0);
      grp.add(stripe);
    }

    else if (kind === 'standoff_dish_billboard') {
      // Free-standing billboard near the back-left standoff dish.
      // Thicker outer frame + 2 angled support struts.
      const fW = w * 1.08, fH = h * 1.16, fT = 0.30;
      [-fH/2, fH/2].forEach(yo => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(fW, fT, 0.40), steel);
        r.position.set(0, yo, -0.05); grp.add(r);
      });
      [-fW/2, fW/2].forEach(xo => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(fT, fH, 0.40), steel);
        r.position.set(xo, 0, -0.05); grp.add(r);
      });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.02, h * 1.04), dark);
      back.position.set(0, 0, -0.18);
      grp.add(back);
      // Support struts to ground
      [-fW * 0.40, fW * 0.40].forEach(xo => {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, -floorY, 6), steel);
        mast.position.set(xo, floorY / 2, -0.30);
        grp.add(mast);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.0), concrete);
        foot.position.set(xo, floorY + 0.25, -0.30);
        grp.add(foot);
      });
    }

    else if (kind === 'barracks_row_window') {
      // Panel as a window mount on the middle barracks of the row at
      // (-38, -8, -12). Add a concrete sill and small awning above.
      const sill = new THREE.Mesh(new THREE.BoxGeometry(w * 1.30, 0.20, 0.40), concreteLit);
      sill.position.set(0, -h/2 - 0.30, -0.05);
      grp.add(sill);
      const awning = new THREE.Mesh(new THREE.BoxGeometry(w * 1.40, 0.12, 0.55), concreteLit);
      awning.position.set(0, h/2 + 0.25, 0.20);
      grp.add(awning);
      // Sandbag berm in front (small, 4 bags wide)
      const bagMat = new THREE.MeshBasicMaterial({ color: 0x14171d });
      for (let i = -1; i <= 2; i++) {
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.36, 0.55), bagMat);
        b1.position.set(i * 0.95 - 0.45, floorY + 0.18, 0.55);
        b1.rotation.y = (Math.random() - 0.5) * 0.15;
        grp.add(b1);
      }
    }

    else if (kind === 'rail_kiosk_left' || kind === 'rail_kiosk_right') {
      // Tactical-display kiosk on the deck rail. Tall single pole with the
      // panel mounted toward the user, angled console base at the deck floor.
      const dy = floorY - 0.30;  // deck top is roughly at floorY+0.10 since deck floor is y=-7.6 vs world floor y=-8
      // Pole from deck floor up to behind the panel
      const poleH = (-h/2) - dy - 0.30;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, Math.max(0.5, poleH), 6), steel);
      pole.position.set(0, dy + Math.max(0.5, poleH) / 2, -0.10);
      grp.add(pole);
      // Bracket clamping panel to the pole
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.30, h * 0.6, 0.35), accent);
      bracket.position.set(0, 0, -0.22);
      grp.add(bracket);
      // Angled control plate beneath the panel (kiosk console)
      const plate = new THREE.Mesh(new THREE.BoxGeometry(w * 1.10, 0.08, 0.45), accent);
      plate.position.set(0, -h/2 - 0.20, 0.18);
      plate.rotation.x = -0.30;
      grp.add(plate);
      // 3 mini LEDs on the plate
      [-0.5, 0, 0.5].forEach(xo => {
        const led = this._makeRunningLight(xo === 0 ? 0xff3344 : 0x66ff99, 0.06);
        led.position.set(xo, -h/2 - 0.15, 0.30);
        grp.add(led);
      });
      // Foot plate (anchored to the deck)
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.10, 0.6), accent);
      foot.position.set(0, dy + 0.05, -0.10);
      grp.add(foot);
    }

    this.scene.add(grp);
    this.panelHosts.push(grp);
  },

  /* ---------- Major buildings (built once, may host multiple panels) ---------- */

  _placeBuilding(grp, cx, cy, cz) {
    // Place a building in world space. The building is built in local
    // coords with its FRONT FACE along local +Z (i.e. mesh `back wall` at
    // z<0, `front wall` at z>0). After lookAt(origin), local +Z faces the
    // camera so the front wall is what the user sees.
    grp.position.set(cx, cy, cz);
    grp.lookAt(0, 0, 0);
    this.scene.add(grp);
  },

  _buildCmdBunker() {
    // Forward-left: 2-story concrete bunker. 18 wide × 12 tall × 14 deep.
    // Sized so its front-face roof sits where the cmdbunker_billboard mounts.
    const grp = new THREE.Group();
    const concrete = new THREE.MeshBasicMaterial({ color: 0x242a36 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x303848 });
    const dark   = new THREE.MeshBasicMaterial({ color: 0x0a0c12 });
    const yellow = new THREE.MeshBasicMaterial({ color: 0x5a4a14 });

    const W = 16, H = 11, D = 12;
    // Main shell
    const shell = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), concrete);
    shell.position.set(0, H / 2, 0);
    grp.add(shell);
    // Roof slab (slightly wider)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.5, D + 0.6), concreteLit);
    roof.position.set(0, H + 0.25, 0);
    grp.add(roof);
    // Caution stripe on the roof front edge
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.18, 0.10), yellow);
    stripe.position.set(0, H + 0.40, D / 2 + 0.30);
    grp.add(stripe);
    // Vertical concrete ribs on the front face
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;  // leave middle clear for door
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.30, H, 0.40), concreteLit);
      rib.position.set(i * 3.0, H / 2, D / 2 + 0.18);
      grp.add(rib);
    }
    // Side wall vents
    [-W/2 - 0.05, W/2 + 0.05].forEach(xo => {
      for (let i = 0; i < 3; i++) {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.50, 1.4), dark);
        vent.position.set(xo, H * 0.25 + i * 1.2, -D / 4 + i * 0.3);
        grp.add(vent);
      }
    });
    // Roof HVAC boxes
    for (let i = 0; i < 3; i++) {
      const hvac = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.4), concrete);
      hvac.position.set(-3 + i * 3, H + 0.85, -2 - i * 0.3);
      grp.add(hvac);
    }
    // Two roof antennas
    [-5, 5].forEach(xo => {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 3.5, 4), concreteLit);
      ant.position.set(xo, H + 2.0, -3);
      grp.add(ant);
      const tip = this._makeRunningLight(0xff3344, 0.25);
      tip.position.set(xo, H + 3.7, -3);
      tip.userData = { rate: 1.4 + Math.random() * 0.5, phase: Math.random() * 6 };
      grp.add(tip);
      this.standoff?.strobes.push(tip);
    });
    // World position: center the bunker so its front face roof is at the
    // billboard panel position (-30, 8, -42). Rooftop at world y=H-8, front
    // face at world distance based on panel z.
    this._placeBuilding(grp, -40, -8, -65 - 6);
  },

  _buildVehicleBay() {
    // Open-front garage. 14×7×11 with an open front (no front wall) so the
    // parked Warthog inside is visible. Panel mounts on the back interior.
    const grp = new THREE.Group();
    const concrete = new THREE.MeshBasicMaterial({ color: 0x242a36 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x303848 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x0a0c12 });
    const yellow = new THREE.MeshBasicMaterial({ color: 0x5a4a14 });
    const olive   = new THREE.MeshBasicMaterial({ color: 0x3a4030 });
    const oliveHi = new THREE.MeshBasicMaterial({ color: 0x4d5440 });
    const steel   = new THREE.MeshBasicMaterial({ color: 0x14171e });

    const W = 14, H = 7, D = 11;
    // Side walls (no front wall — open garage)
    [-W/2, W/2].forEach(xo => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, H, D), concrete);
      wall.position.set(xo, H / 2, 0);
      grp.add(wall);
    });
    // Back wall
    const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.4), concrete);
    back.position.set(0, H / 2, -D / 2);
    grp.add(back);
    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.4, D + 0.5), concreteLit);
    roof.position.set(0, H + 0.2, 0);
    grp.add(roof);
    // Garage-door frame across the open front
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(W, 0.6, 0.4), concreteLit);
    lintel.position.set(0, H - 0.4, D / 2);
    grp.add(lintel);
    // Yellow caution stripes around the open front
    [-W/2 + 0.30, W/2 - 0.30].forEach(xo => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, H - 0.6, 0.28), yellow);
      post.position.set(xo, (H - 0.6) / 2, D / 2 + 0.05);
      grp.add(post);
    });
    // Floor inside (slightly elevated concrete pad)
    const inFloor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.8, 0.20, D - 0.8), concreteLit);
    inFloor.position.set(0, 0.10, 0);
    grp.add(inFloor);
    // Parked Warthog inside, facing out (+Z)
    const car = this._buildWarthogMesh(olive, oliveHi, steel, dark);
    car.position.set(0, 0.40, 0.5);
    grp.add(car);
    // 2 hanging interior lights
    [-3, 3].forEach(xo => {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 1.0), dark);
      fixture.position.set(xo, H - 0.7, 0);
      grp.add(fixture);
      const lens = this._makeRunningLight(0xfff0c8, 0.35);
      lens.position.set(xo, H - 1.0, 0);
      grp.add(lens);
    });
    // Stacked supply crates next to the side wall
    [{ x: -W/2 - 1.6, y: 0.50, z: 1.5 }, { x: -W/2 - 1.6, y: 0.50, z: -0.2 }, { x: -W/2 - 1.6, y: 1.50, z: 0.7 }].forEach(p => {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.3), olive);
      crate.position.set(p.x, p.y, p.z);
      grp.add(crate);
    });
    // Position: panel at (35, 1, -32) is on the back wall interior. World back-wall
    // center sits at building position (cx, 0, cz - D/2). Want that ~= (35, 1, -32).
    this._placeBuilding(grp, 50, -8, -32 + D / 2 + 1.5);
  },

  _buildBarracksBig() {
    // Long low building, gable roof. 11×6×16.
    const grp = new THREE.Group();
    const concrete = new THREE.MeshBasicMaterial({ color: 0x242a36 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x303848 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x0a0c12 });
    const olive = new THREE.MeshBasicMaterial({ color: 0x232714 });

    const W = 11, H = 6, D = 16;
    const shell = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), concrete);
    shell.position.set(0, H / 2, 0);
    grp.add(shell);
    // Sloped gable roof (two angled planes)
    const roofPlane = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.6, D + 0.6), olive);
    roofPlane.rotation.x = -Math.PI / 2;
    roofPlane.position.set(0, H + 0.05, 0);
    grp.add(roofPlane);
    // Roof ridgeline cap
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, D + 0.6), dark);
    ridge.position.set(0, H + 0.20, 0);
    grp.add(ridge);
    // Door slot near the panel (dim warm interior glow)
    const doorMat = new THREE.MeshBasicMaterial({
      color: 0xffaa55, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2), doorMat);
    door.position.set(2.6, 1.1, D / 2 + 0.04);
    grp.add(door);
    // Side antennas
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.5, 4), concreteLit);
    ant.position.set(W / 2 - 0.5, H + 1.5, -D / 2 + 1.5);
    grp.add(ant);
    const tip = this._makeRunningLight(0xff3344, 0.22);
    tip.position.set(W / 2 - 0.5, H + 2.7, -D / 2 + 1.5);
    tip.userData = { rate: 2.0, phase: Math.random() * 6 };
    grp.add(tip);
    this.standoff?.strobes.push(tip);
    // Position: panel at (-44, 0.5, -10) is on the front wall. World front face at building (cx, 0, cz + D/2).
    this._placeBuilding(grp, -65, -8, -14 - D / 2 - 1.0);
  },

  _buildSupplyDepot() {
    // Stacked shipping-container style — 2 containers stacked, with a
    // vertical screen on the side facing camera.
    const grp = new THREE.Group();
    const oliveDark = new THREE.MeshBasicMaterial({ color: 0x232714 });
    const oliveMid = new THREE.MeshBasicMaterial({ color: 0x2e3318 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x0a0c12 });
    const stencil = new THREE.MeshBasicMaterial({ color: 0xc6c2a8 });

    const cW = 8, cH = 3.0, cD = 12;
    // Bottom container
    const lower = new THREE.Mesh(new THREE.BoxGeometry(cW, cH, cD), oliveDark);
    lower.position.set(0, cH / 2, 0);
    grp.add(lower);
    // Top container (slightly offset)
    const upper = new THREE.Mesh(new THREE.BoxGeometry(cW * 0.92, cH, cD * 0.95), oliveMid);
    upper.position.set(0.4, cH + cH / 2 + 0.1, -0.4);
    grp.add(upper);
    // Container ribs (corrugated look — vertical bars on sides)
    for (let i = -3; i <= 3; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.10, cH, 0.10), oliveMid);
      rib.position.set(cW / 2 + 0.04, cH / 2, i * 1.5);
      grp.add(rib);
    }
    // Stencil markings
    const mark = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.20, 0.04), stencil);
    mark.position.set(0, cH * 0.7, cD / 2 + 0.04);
    grp.add(mark);
    // Loose crates on the ground beside the depot
    [{ x: -cW/2 - 1.4, y: 0.50, z: 2.0 }, { x: -cW/2 - 1.4, y: 0.50, z: 0.4 }, { x: -cW/2 - 1.4, y: 1.50, z: 1.2 }].forEach(p => {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.3), oliveDark);
      crate.position.set(p.x, p.y, p.z);
      crate.rotation.y = (Math.random() - 0.5) * 0.2;
      grp.add(crate);
    });
    // Position: panel at (42, 0.5, -2). Place container so panel sits flush with the front face.
    this._placeBuilding(grp, 65, -8, -7 - cD / 2 - 0.8);
  },

  /* ---------- b176: Biostation — small greenhouse for the organism panel.
     Host for `organism` panel at (12, 3, 38) [back-center]. Shed body
     in concrete with a glass-roof skylight, warm pink grow-light strips
     visible through the roof. Reads as a small life-sciences outpost. */
  _buildBioStation() {
    const grp = new THREE.Group();
    const concrete = new THREE.MeshBasicMaterial({ color: 0x242a36 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x303848 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x0a0c12 });
    const yellow = new THREE.MeshBasicMaterial({ color: 0x5a4a14 });
    const glass = new THREE.MeshBasicMaterial({
      color: 0xff5fa8, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });

    const W = 10, H = 4.0, D = 8;
    // Concrete shell
    const shell = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), concrete);
    shell.position.set(0, H / 2, 0);
    grp.add(shell);
    // Pitched glass-roof skylight (two angled panels glowing pink-magenta)
    const roofW = W + 0.4, roofD = D * 0.55;
    [-1, 1].forEach(side => {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(roofW, roofD), glass);
      r.position.set(0, H + 0.5, side * D * 0.15);
      r.rotation.x = side * 0.45;
      grp.add(r);
    });
    // Roof ridge
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.18, 0.18), concreteLit);
    ridge.position.set(0, H + 0.95, 0);
    grp.add(ridge);
    // Caution stripe along the roof front
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.12, 0.06), yellow);
    stripe.position.set(0, H + 0.20, D / 2 + 0.18);
    grp.add(stripe);
    // Vertical concrete ribs flanking the panel window
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.30, H, 0.40), concreteLit);
      rib.position.set(i * 2.2, H / 2, D / 2 + 0.18);
      grp.add(rib);
    }
    // Door on the front face (warm glow)
    const doorMat = new THREE.MeshBasicMaterial({
      color: 0xffaa55, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.7), doorMat);
    door.position.set(W / 2 - 1.1, 0.85, D / 2 + 0.05);
    grp.add(door);
    // 2 small lit vents on the side
    [-W/2 - 0.04, W/2 + 0.04].forEach(xo => {
      const vent = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), doorMat);
      vent.position.set(xo, H * 0.6, 0);
      vent.rotation.y = xo > 0 ? -Math.PI / 2 : Math.PI / 2;
      grp.add(vent);
    });
    // Roof-mounted exhaust stack
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.4, 6), dark);
    stack.position.set(W / 2 - 1.0, H + 1.5, -D / 4);
    grp.add(stack);
    // Tiny strobe on top
    const strobe = this._makeRunningLight(0xff3344, 0.20);
    strobe.position.set(0, H + 1.4, D / 2 - 0.5);
    strobe.userData = { rate: 1.8, phase: Math.random() * 6 };
    grp.add(strobe);
    this.standoff?.strobes.push(strobe);

    // Place: panel at (12, 3, 38). Building center at (12, -8, 38 + D/2 + 0.8)
    // pushes the building back so the panel sits flush with the front face.
    this._placeBuilding(grp, 12, -8, 38 + D / 2 + 0.8);
  },

  _buildCommTowerBig() {
    // Tall 4-leg lattice tower with a service platform near the top
    // (where the freq-map display mounts) + dish + strobe at the very tip.
    const grp = new THREE.Group();
    const steel = new THREE.MeshBasicMaterial({ color: 0x14171e });
    const accent = new THREE.MeshBasicMaterial({ color: 0x1e222b });

    const towerH = 16;
    const baseW = 2.4;
    // 4 legs
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.16, towerH, 4), steel);
      leg.position.set(Math.cos(a) * baseW * 0.5, towerH * 0.5, Math.sin(a) * baseW * 0.5);
      grp.add(leg);
    }
    // Cross-bracing rings every 2u
    for (let h = 1.5; h < towerH - 0.5; h += 2.0) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(baseW * 0.55, 0.04, 4, 14), steel);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = h;
      grp.add(ring);
    }
    // Platform partway up (where the panel mounts) — rough grating
    const platY = towerH * 0.78;
    const plat = new THREE.Mesh(new THREE.BoxGeometry(baseW * 1.6, 0.18, baseW * 1.4), accent);
    plat.position.set(0, platY, 0);
    grp.add(plat);
    // Top antenna mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.0, 4), steel);
    mast.position.set(0, towerH + 2.0, 0);
    grp.add(mast);
    // Strobe at the tip
    const strobe = this._makeRunningLight(0xff3344, 0.55);
    strobe.position.set(0, towerH + 4.2, 0);
    strobe.userData = { rate: 1.8, phase: Math.random() * 6 };
    grp.add(strobe);
    this.standoff?.strobes.push(strobe);
    // Small dish on the platform side
    const miniDish = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
      accent,
    );
    miniDish.position.set(baseW * 0.7, platY + 0.6, 0);
    miniDish.rotation.x = -Math.PI * 0.40;
    miniDish.rotation.z = -Math.PI / 2;
    grp.add(miniDish);
    // Position: panel at (-26, 5, -18). Tower base on the floor; panel sits at the platform height.
    this._placeBuilding(grp, -38, -8, -25 + 0.8);
  },

  _buildHelipad() {
    // Round elevated helipad with a control booth on the side.
    const grp = new THREE.Group();
    const concrete = new THREE.MeshBasicMaterial({ color: 0x242a36 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x303848 });
    const yellow = new THREE.MeshBasicMaterial({ color: 0x5a4a14 });
    const stencil = new THREE.MeshBasicMaterial({ color: 0xc6c2a8 });

    const padR = 5.5, padH = 1.8;
    // Cylindrical base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(padR, padR + 0.4, padH, 16), concrete);
    base.position.set(0, padH / 2, 0);
    grp.add(base);
    // Pad surface (slightly raised top)
    const surface = new THREE.Mesh(new THREE.CylinderGeometry(padR - 0.1, padR - 0.1, 0.10, 24), concreteLit);
    surface.position.set(0, padH + 0.05, 0);
    grp.add(surface);
    // Painted "H" — two vertical bars + crossbar
    [-1.0, 1.0].forEach(xo => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.02, 2.4), stencil);
      bar.position.set(xo, padH + 0.115, 0);
      grp.add(bar);
    });
    const cross = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.02, 0.40), stencil);
    cross.position.set(0, padH + 0.115, 0);
    grp.add(cross);
    // Painted outer ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(padR - 0.6, padR - 0.4, 32),
      stencil,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, padH + 0.12, 0);
    grp.add(ring);
    // Yellow caution stripe along the rim
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const tab = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.10, 0.25), i % 2 === 0 ? yellow : concreteLit);
      tab.position.set(Math.cos(a) * (padR + 0.05), padH * 0.85, Math.sin(a) * (padR + 0.05));
      tab.rotation.y = a;
      grp.add(tab);
    }
    // Control booth on the back side
    const booth = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 3), concrete);
    booth.position.set(0, 2.0, -padR - 1.6);
    grp.add(booth);
    const boothRoof = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.3, 3.4), concreteLit);
    boothRoof.position.set(0, 4.15, -padR - 1.6);
    grp.add(boothRoof);
    // Approach lights — 4 amber LED markers at cardinals
    [0, 0.5, 1.0, 1.5].forEach(t => {
      const a = t * Math.PI;
      const led = this._makeRunningLight(0xffaa55, 0.18);
      led.position.set(Math.cos(a) * (padR + 0.3), padH + 0.20, Math.sin(a) * (padR + 0.3));
      grp.add(led);
    });
    // Position: panel at (28, 1, -22) on the booth front (booth -Z face = front toward camera)
    // Booth front face center at building (cx, 2, cz + booth-front-z = -padR - 1.6 + 1.5 = -padR - 0.1)
    // Want world (28, 1, -22) ≈ booth front. Place building accordingly.
    this._placeBuilding(grp, 42, -8, -25 + padR + 1.0);
  },

  /* ---------- Missile launch site (galaxy panel host) ---------- */
  _buildMissileSite() {
    // Concrete launch pad with a vertical missile silo + control bunker
    // adjacent to it. Galaxy panel mounts on the side of the control
    // bunker as a free-standing billboard.
    const grp = new THREE.Group();
    const concrete = new THREE.MeshBasicMaterial({ color: 0x242a36 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x303848 });
    const yellow = new THREE.MeshBasicMaterial({ color: 0x6a5618 });
    const stencil = new THREE.MeshBasicMaterial({ color: 0xc6c2a8 });
    const steel = new THREE.MeshBasicMaterial({ color: 0x14171e });
    const accent = new THREE.MeshBasicMaterial({ color: 0x2c3344 });

    // Octagonal launch pad
    const padR = 7.5, padH = 0.6;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(padR, padR + 0.3, padH, 8), concrete);
    pad.position.set(0, padH / 2, 0);
    grp.add(pad);
    // Painted target rings
    [padR * 0.95, padR * 0.65].forEach(rr => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(rr - 0.18, rr, 32),
        stencil,
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, padH + 0.05, 0);
      grp.add(ring);
    });
    // Painted center cross
    [0, Math.PI / 2].forEach(theta => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(padR * 1.2, 0.02, 0.45), stencil);
      bar.rotation.y = theta;
      bar.position.set(0, padH + 0.06, 0);
      grp.add(bar);
    });
    // Yellow caution-stripe rim
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const tab = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.18, 0.30), i % 2 === 0 ? yellow : concreteLit);
      tab.position.set(Math.cos(a) * (padR + 0.10), padH * 0.6, Math.sin(a) * (padR + 0.10));
      tab.rotation.y = a;
      grp.add(tab);
    }

    // Vertical silo / launch tube — central feature
    const siloR = 1.5, siloH = 12;
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(siloR, siloR + 0.3, siloH, 12), concrete);
    silo.position.set(0, padH + siloH / 2, 0);
    grp.add(silo);
    // Caution chevrons up the silo (ring of yellow stripes)
    for (let h = padH + 1; h < padH + siloH - 1; h += 2) {
      const chev = new THREE.Mesh(new THREE.TorusGeometry(siloR + 0.05, 0.10, 4, 16), yellow);
      chev.rotation.x = Math.PI / 2;
      chev.position.set(0, h, 0);
      grp.add(chev);
    }
    // Number "07" stencil
    const stencilNum = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), stencil);
    stencilNum.position.set(0, padH + siloH * 0.5, siloR + 0.05);
    grp.add(stencilNum);
    // Silo cap — domed/conical top
    const cap = new THREE.Mesh(new THREE.ConeGeometry(siloR + 0.1, 1.4, 12), concreteLit);
    cap.position.set(0, padH + siloH + 0.7, 0);
    grp.add(cap);
    // Missile body partially extruded (suggests silo is loaded)
    const missile = new THREE.Mesh(new THREE.CylinderGeometry(siloR * 0.55, siloR * 0.50, 4, 12), accent);
    missile.position.set(0, padH + siloH + 0.5, 0);
    grp.add(missile);
    const missileNose = new THREE.Mesh(new THREE.ConeGeometry(siloR * 0.55, 1.6, 12), stencil);
    missileNose.position.set(0, padH + siloH + 3.3, 0);
    grp.add(missileNose);
    // Strobe at the silo cap
    const siloStrobe = this._makeRunningLight(0xff3344, 0.55);
    siloStrobe.position.set(0, padH + siloH + 1.6, 0);
    siloStrobe.userData = { rate: 1.4, phase: Math.random() * 6 };
    grp.add(siloStrobe);
    this.standoff?.strobes.push(siloStrobe);

    // Launch service gantry — open lattice tower beside the silo
    const gantryH = siloH + 2;
    [-1, 1].forEach(side => {
      const xo = side * (siloR + 1.4);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, gantryH, 5), steel);
      post.position.set(xo, padH + gantryH / 2, -2.8);
      grp.add(post);
    });
    // Cross bracing on the gantry
    for (let h = padH + 1.5; h < gantryH; h += 2) {
      const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 4), steel);
      cross.rotation.z = Math.PI / 2;
      cross.position.set(0, h, -2.8);
      grp.add(cross);
    }
    // Service arm reaching toward silo at mid-height
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 0.6), steel);
    arm.position.set(0, padH + siloH * 0.55, -1.4);
    grp.add(arm);

    // Adjacent control bunker — small, behind the launch pad
    const cbW = 5, cbH = 4, cbD = 5;
    const cb = new THREE.Mesh(new THREE.BoxGeometry(cbW, cbH, cbD), concrete);
    cb.position.set(padR + 1.5, cbH / 2, -3.0);
    grp.add(cb);
    const cbRoof = new THREE.Mesh(new THREE.BoxGeometry(cbW + 0.4, 0.3, cbD + 0.4), concreteLit);
    cbRoof.position.set(padR + 1.5, cbH + 0.15, -3.0);
    grp.add(cbRoof);
    // Slit window with warm interior glow
    const slit = new THREE.Mesh(
      new THREE.PlaneGeometry(cbW * 0.7, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xffaa55, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    slit.position.set(padR + 1.5, cbH * 0.65, cbD / 2 + 0.04 - 3.0);
    slit.userData = { rate: 4.2, phase: Math.random() * 6, baseOpacity: 0.85 };
    grp.add(slit);
    this.standoff?.windows.push(slit);

    // Sandbag perimeter around the launch pad
    const bagMat = new THREE.MeshBasicMaterial({ color: 0x14171d });
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const r = padR + 1.4;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.40, 0.65), bagMat);
      b.position.set(Math.cos(a) * r, padH + 0.20, Math.sin(a) * r);
      b.rotation.y = a + (Math.random() - 0.5) * 0.10;
      grp.add(b);
    }
    // Jersey barriers between sandbags and gantry
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (i - 1.5) * 0.25;
      const r = padR + 3.0;
      const jersey = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 0.7), concreteLit);
      jersey.position.set(Math.cos(a) * r, padH + 0.50, Math.sin(a) * r);
      jersey.rotation.y = a + Math.PI / 2;
      grp.add(jersey);
    }

    this._placeBuilding(grp, -55, -8, -78 - 6);
  },

  /* ---------- Radar / operations building (living wall panel host) ---------- */
  _buildRadarBuilding() {
    // Squat operations building with a rotating radar antenna on the roof.
    const grp = new THREE.Group();
    const concrete = new THREE.MeshBasicMaterial({ color: 0x242a36 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x303848 });
    const steel = new THREE.MeshBasicMaterial({ color: 0x14171e });
    const accent = new THREE.MeshBasicMaterial({ color: 0x2c3344 });
    const yellow = new THREE.MeshBasicMaterial({ color: 0x6a5618 });

    const W = 12, H = 5, D = 10;
    const shell = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), concrete);
    shell.position.set(0, H / 2, 0);
    grp.add(shell);
    // Roof slab
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.4, D + 0.5), concreteLit);
    roof.position.set(0, H + 0.2, 0);
    grp.add(roof);
    // Caution stripe on the roof front edge
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.14, 0.06), yellow);
    stripe.position.set(0, H + 0.40, D / 2 + 0.28);
    grp.add(stripe);
    // Vertical concrete ribs on the front face (around but not over the panel)
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.30, H, 0.40), concreteLit);
      rib.position.set(i * 2.4, H / 2, D / 2 + 0.18);
      grp.add(rib);
    }
    // Side wall vents
    [-W/2 - 0.05, W/2 + 0.05].forEach(xo => {
      for (let i = 0; i < 3; i++) {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.40, 1.2), steel);
        vent.position.set(xo, H * 0.35 + i * 1.0, -D / 4 + i * 0.3);
        grp.add(vent);
      }
    });
    // Rotating radar antenna on the roof
    const radarBase = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.2, 8), concrete);
    radarBase.position.set(-W * 0.30, H + 0.80, 0);
    grp.add(radarBase);
    const radarPivot = new THREE.Group();
    radarPivot.position.set(-W * 0.30, H + 1.6, 0);
    grp.add(radarPivot);
    const radarBar = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.18, 0.18), accent);
    radarBar.position.set(0, 0, 0);
    radarPivot.add(radarBar);
    const radarFin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 0.10), accent);
    radarFin.position.set(2.0, 0.5, 0);
    radarPivot.add(radarFin);
    grp.userData.radar = radarPivot;
    this._radarBuildingPivots ??= [];
    this._radarBuildingPivots.push(radarPivot);
    // Rooftop strobe
    const strobe = this._makeRunningLight(0x4488ff, 0.40);
    strobe.position.set(W * 0.40, H + 0.80, 0);
    strobe.userData = { rate: 1.1, phase: Math.random() * 6 };
    grp.add(strobe);
    this.standoff?.strobes.push(strobe);

    this._placeBuilding(grp, 20, -8, -42 - D / 2 - 0.5);
  },

  /* ---------- Pelican landing pad behind the camera ----------
     Fills the back direction so when the user turns around there's a
     clear themed feature instead of a void. Big concrete pad with
     painted markings, a parked simplified Pelican on top, perimeter
     deck lights. */
  _buildPelicanPad() {
    const grp = new THREE.Group();
    const concrete = new THREE.MeshBasicMaterial({ color: 0x242a36 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x303848 });
    const stencil = new THREE.MeshBasicMaterial({ color: 0xc6c2a8 });
    const yellow = new THREE.MeshBasicMaterial({ color: 0x6a5618 });

    const padR = 9, padH = 1.2;
    // Cylindrical pad
    const base = new THREE.Mesh(new THREE.CylinderGeometry(padR, padR + 0.3, padH, 16), concrete);
    base.position.set(0, padH / 2, 0);
    grp.add(base);
    const surface = new THREE.Mesh(new THREE.CylinderGeometry(padR - 0.1, padR - 0.1, 0.10, 24), concreteLit);
    surface.position.set(0, padH + 0.05, 0);
    grp.add(surface);
    // Painted "P" pad marker (just a big circle since "P" letterform is fiddly)
    const ring1 = new THREE.Mesh(
      new THREE.RingGeometry(padR * 0.65 - 0.20, padR * 0.65, 32),
      stencil,
    );
    ring1.rotation.x = -Math.PI / 2;
    ring1.position.set(0, padH + 0.12, 0);
    grp.add(ring1);
    const ring2 = new THREE.Mesh(
      new THREE.RingGeometry(padR * 0.92 - 0.20, padR * 0.92, 32),
      stencil,
    );
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.set(0, padH + 0.12, 0);
    grp.add(ring2);
    // Yellow caution-tab rim
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const tab = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.18, 0.30), i % 2 === 0 ? yellow : concreteLit);
      tab.position.set(Math.cos(a) * (padR + 0.10), padH * 0.6, Math.sin(a) * (padR + 0.10));
      tab.rotation.y = a;
      grp.add(tab);
    }
    // Approach lights at cardinals
    [0, 0.5, 1.0, 1.5].forEach(t => {
      const a = t * Math.PI;
      const led = this._makeRunningLight(0xffaa55, 0.22);
      led.position.set(Math.cos(a) * (padR + 0.4), padH + 0.30, Math.sin(a) * (padR + 0.4));
      grp.add(led);
    });
    // Parked Pelican on top of the pad
    const pelican = this._makeParkedPelican();
    pelican.position.set(0, padH + 1.8, 0);
    pelican.rotation.y = Math.PI;  // facing backward (visible from camera)
    grp.add(pelican);

    // Position: forward of the deck, well clear of the south perimeter road
    // (z=50±4.5). Was z=48 — patrol warthog/scorpion drove straight through it.
    grp.position.set(-2, -8, 24);
    grp.rotation.y = -0.2;
    this.scene.add(grp);
  },

  _makeParkedPelican() {
    // Simplified Pelican silhouette (mirrors `_buildScriptedPelican` body but
    // without the moving hatch / glow / engines on)
    const grp = new THREE.Group();
    const sz = 1.2;
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x202028 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4 * sz, 1.5 * sz, 6.5 * sz), bodyMat);
    grp.add(body);
    // Cockpit windows (dim)
    [-0.5, 0, 0.5].forEach(dx => {
      const w = this._makeRunningLight(0xffe6a0, 0.18);
      w.position.set(dx * sz, 0.55 * sz, -3.2 * sz);
      grp.add(w);
    });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(8 * sz, 0.32, 1.7 * sz), bodyMat);
    wing.position.set(0, 0.85 * sz, 1.4 * sz);
    grp.add(wing);
    [1, -1].forEach(s => {
      const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * sz, 0.42 * sz, 1.6 * sz, 10), bodyMat);
      nacelle.rotation.x = Math.PI / 2;
      nacelle.position.set(s * 3.0 * sz, 0.55 * sz, 1.6 * sz);
      grp.add(nacelle);
      const tip = this._makeRunningLight(s > 0 ? 0xff3344 : 0x33ff66, 0.30);
      tip.position.set(s * 4.1 * sz, 0.85 * sz, 1.4 * sz);
      grp.add(tip);
    });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6 * sz, 1.0 * sz, 2.4 * sz), bodyMat);
    tail.position.set(0, 0.0, 4.0 * sz);
    grp.add(tail);
    // Landing-gear struts
    [-1, 1].forEach(sx => {
      [-1, 1].forEach(sz_ => {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 1.6, 4), bodyMat);
        strut.position.set(sx * 1.0 * sz, -1.0 * sz, sz_ * 1.6 * sz);
        grp.add(strut);
      });
    });
    return grp;
  },

  /* ---------- Central iconic Standoff dish — the focal feature ---------- */
  _buildCentralDish() {
    // Standoff's defining element: a massive parabolic dish sitting on a
    // tall reinforced concrete pedestal in the middle distance, slightly
    // off-axis so it doesn't perfectly bisect the panel layout. Big enough
    // to dominate the skyline and silhouette against the moon/nebula.
    const grp = new THREE.Group();
    const concrete = new THREE.MeshBasicMaterial({ color: 0x222836 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x303848 });
    const steel  = new THREE.MeshBasicMaterial({ color: 0x14171e });
    const accent = new THREE.MeshBasicMaterial({ color: 0x1e222b });

    // Massive concrete plinth — 2-tier
    const plinthH = 3.8;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(14, plinthH, 14), concrete);
    plinth.position.y = plinthH / 2;
    grp.add(plinth);
    const step = new THREE.Mesh(new THREE.BoxGeometry(11, 0.8, 11), concreteLit);
    step.position.y = plinthH + 0.4;
    grp.add(step);
    // Pedestal column tapering up
    const colH = 8.0;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, colH, 12), concrete);
    col.position.y = plinthH + 0.8 + colH / 2;
    grp.add(col);
    // Cooling vents on the column
    [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(theta => {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.6, colH * 0.7, 0.10), accent);
      vent.position.set(Math.cos(theta) * 1.6, plinthH + 0.8 + colH / 2, Math.sin(theta) * 1.6);
      vent.rotation.y = theta;
      grp.add(vent);
    });
    // Cap above column
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 1.6, 1.0, 12), concreteLit);
    cap.position.y = plinthH + 0.8 + colH + 0.5;
    grp.add(cap);
    // Massive yoke
    const yokeY = plinthH + 0.8 + colH + 1.4;
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(7.0, 1.4, 2.2), steel);
    yoke.position.y = yokeY;
    grp.add(yoke);
    // Yoke side flanges (the actuators)
    [-3.4, 3.4].forEach(sx => {
      const flange = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.6, 1.5), steel);
      flange.position.set(sx, yokeY + 0.8, 0);
      grp.add(flange);
    });

    // The dish itself — huge, tilted skyward
    const dishR = 16;
    const tilt = -Math.PI * 0.32;
    const dishGeo = new THREE.SphereGeometry(dishR, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.42);
    const dishMat = new THREE.MeshBasicMaterial({ color: 0x1a1d24, side: THREE.DoubleSide });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.set(0, yokeY + 1.6, 0);
    dish.rotation.x = tilt;
    grp.add(dish);
    // Concentric panel ribs
    for (let r = 0.25; r < 1.0; r += 0.18) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(dishR * r, 0.04, 4, 48), accent);
      rib.position.copy(dish.position);
      rib.position.y += Math.sqrt(Math.max(0, dishR * dishR - (dishR * r) * (dishR * r))) * 0.18;
      rib.rotation.x = Math.PI / 2;
      grp.add(rib);
    }
    // Outer rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(dishR, 0.18, 6, 64), accent);
    rim.position.copy(dish.position);
    rim.rotation.x = Math.PI / 2;
    grp.add(rim);
    // Receiver feed-horn tripod at focal point
    const focalY = yokeY + 1.6 + dishR * 0.55;
    [0, Math.PI * 2 / 3, Math.PI * 4 / 3].forEach(theta => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, dishR * 0.85, 4), accent);
      arm.position.set(Math.cos(theta) * dishR * 0.4, yokeY + 1.6 + dishR * 0.18, Math.sin(theta) * dishR * 0.4);
      arm.lookAt(0, focalY, 0);
      arm.rotateX(Math.PI / 2);
      grp.add(arm);
    });
    const recv = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.40, 1.4, 8), accent);
    recv.position.set(0, focalY, 0);
    grp.add(recv);
    // Antenna spikes on the yoke
    [-2.6, 0, 2.6].forEach(sx => {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 4 + Math.random() * 1.5, 4), accent);
      const len = ant.geometry.parameters.height;
      ant.position.set(sx, yokeY + 0.8 + len / 2, -1.0);
      grp.add(ant);
    });
    // Aviation strobe at the highest spike
    const strobe = this._makeRunningLight(0xff3344, 0.85);
    strobe.position.set(0, yokeY + 7.0, -1.0);
    strobe.userData = { rate: 1.4, phase: Math.random() * 6 };
    grp.add(strobe);
    this.standoff?.strobes.push(strobe);
    // Magenta receiver tell-tale at the focal point
    const tell = this._makeRunningLight(0xff66cc, 0.50);
    tell.position.set(0, focalY, 0);
    tell.userData = { rate: 0.9, phase: Math.random() * 6 };
    grp.add(tell);
    this.standoff?.strobes.push(tell);

    // Position: forward and slightly off-axis so it doesn't bisect the
    // panel layout, far enough back that buildings sit between camera and dish.
    grp.position.set(15, -8, -110);
    grp.rotation.y = -0.25;  // slight rotation so the dish faces a different sky direction
    this.scene.add(grp);
    // Track for slow-yaw tracking animation in the existing standoff tick
    grp.userData.baseYaw = -0.25;
    this.standoff?.dishes.push(grp);
  },

  _buildWarthogMesh(olive, oliveHi, steel, dark) {
    // Simplified UNSC Warthog silhouette — body, hood, roll cage, 4 wheels,
    // turret stub. Sized so length ~5u and ride-height ~1.4u (panel-friendly).
    const grp = new THREE.Group();
    // Main chassis
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.65, 4.4), olive);
    body.position.y = 0.55;
    grp.add(body);
    // Hood block (front)
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 1.6), oliveHi);
    hood.position.set(0, 0.85, -1.10);
    grp.add(hood);
    // Cab back
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.85, 1.4), olive);
    cab.position.set(0, 1.15, 0.30);
    grp.add(cab);
    // Roll cage — 4 vertical bars + 2 cross
    const cageMat = steel;
    [[-1.0, -0.20], [1.0, -0.20], [-1.0, 1.40], [1.0, 1.40]].forEach(([cx, cz]) => {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 5), cageMat);
      bar.position.set(cx, 1.55, cz);
      grp.add(bar);
    });
    [[-1.0, 1], [1.0, 1]].forEach(([cx]) => {
      const sideBar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 5), cageMat);
      sideBar.rotation.x = Math.PI / 2;
      sideBar.position.set(cx, 2.10, 0.60);
      grp.add(sideBar);
    });
    const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.0, 5), cageMat);
    cross.rotation.z = Math.PI / 2;
    cross.position.set(0, 2.10, 0.60);
    grp.add(cross);
    // 4 wheels
    [[-1.30, 0.45, -1.50], [1.30, 0.45, -1.50], [-1.30, 0.45, 1.40], [1.30, 0.45, 1.40]].forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.55, 12), dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      grp.add(wheel);
      // Hub
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.58, 6), steel);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(wx, wy, wz);
      grp.add(hub);
    });
    // Headlights
    [-0.85, 0.85].forEach(hx => {
      const head = this._makeRunningLight(0xfff0c8, 0.40);
      head.position.set(hx, 0.95, -1.95);
      head.userData = { isRunningLight: true, blinkSeed: 99 };  // exclude from blink
      grp.add(head);
    });
    // Tail-light
    [-0.85, 0.85].forEach(hx => {
      const tail = this._makeRunningLight(0xff3344, 0.20);
      tail.position.set(hx, 0.95, 1.05);
      grp.add(tail);
    });
    // Turret stub on the back
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.40, 0.45, 8), steel);
    turret.position.set(0, 1.85, 1.20);
    grp.add(turret);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 1.2, 6), steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 1.95, 0.50);
    grp.add(barrel);
    return grp;
  },

  /* ---------- Parked + slow-driving Warthogs along the cross road ----------
     b171: replaces the "circling jeep around the deck" — now we have
     STATIC parked vehicles (motor pool clutter) plus ONE Warthog crawling
     down the cross road from far-left to far-right. Reads as a base in
     active use, not a carousel. */
  _buildPatrolWarthog() {
    const olive   = new THREE.MeshBasicMaterial({ color: 0x3a4030 });
    const oliveHi = new THREE.MeshBasicMaterial({ color: 0x4d5440 });
    const steel   = new THREE.MeshBasicMaterial({ color: 0x14171e });
    const dark    = new THREE.MeshBasicMaterial({ color: 0x0c0e14 });
    this._parkedHogs = [];

    // Three parked Warthogs in the motor-pool zone, south of the new
    // right-flank service road (which terminates at ~(44, -38)). Pulled
    // back to z=-42…-46 so they don't sit on the asphalt.
    const parkedSpots = [
      { x: 50, z: -44, yaw:  Math.PI * 0.10 },
      { x: 40, z: -47, yaw:  Math.PI * 1.05 },
      { x: 32, z: -44, yaw: -Math.PI * 0.15 },
    ];
    parkedSpots.forEach(s => {
      const car = this._buildWarthogMesh(olive, oliveHi, steel, dark);
      car.position.set(s.x, -8, s.z);
      car.rotation.y = s.yaw;
      this.scene.add(car);
      this._parkedHogs.push(car);
    });

    // b184: 3 patrol Warthogs spaced 1/3 of the loop apart, all CCW. With
    // the loop's full perimeter ~592u and 13 u/s speed (~46s/loop), at any
    // given moment there's almost always one visible from the deck. The
    // Scorpion runs CW so they cross paths every quarter loop.
    this.patrolHogs = [];
    [0, 197, 395].forEach(phaseOffset => {
      const car = this._buildWarthogMesh(olive, oliveHi, steel, dark);
      car.userData.wheels = car.children.filter(
        c => c.geometry?.type === 'CylinderGeometry' && c.geometry.parameters.height === 0.55
      );
      car.userData.t = phaseOffset;  // distance along loop (units)
      this.scene.add(car);
      this.patrolHogs.push(car);
    });
  },

  // Sample a point + heading on the perimeter loop at distance `s` (units)
  // from the SE corner, traveling counterclockwise. Loop dims: x=±78,
  // z in [-90, 50]. Mesh is built facing -Z so yaw=0 means traveling -Z.
  _samplePerimeter(s, ccw) {
    const LX = 78, LN = -90, LS = 50;
    const legE = LS - LN;  // 140 — east leg (z: 50 → -90, travel -Z)
    const legN = 2 * LX;   // 156 — north leg (x: +78 → -78, travel -X)
    const legW = LS - LN;  // 140 — west leg (z: -90 → 50, travel +Z)
    const legS = 2 * LX;   // 156 — south leg (x: -78 → +78, travel +X)
    const total = legE + legN + legW + legS;
    let phase = ((s % total) + total) % total;
    if (!ccw) phase = total - phase;  // CW reverses direction along same path
    let x, z, yaw;
    if (phase < legE) {
      // East leg: SE (78, 50) → NE (78, -90), traveling -Z
      x = LX;
      z = LS - phase;
      yaw = 0;
    } else if (phase < legE + legN) {
      // North leg: NE (78, -90) → NW (-78, -90), traveling -X
      // Mesh forward = -Z. To rotate -Z → -X, yaw = +π/2.
      const k = phase - legE;
      x = LX - k;
      z = LN;
      yaw = Math.PI / 2;
    } else if (phase < legE + legN + legW) {
      // West leg: NW (-78, -90) → SW (-78, 50), traveling +Z
      const k = phase - legE - legN;
      x = -LX;
      z = LN + k;
      yaw = Math.PI;
    } else {
      // South leg: SW (-78, 50) → SE (78, 50), traveling +X
      // Mesh forward = -Z. To rotate -Z → +X, yaw = -π/2.
      const k = phase - legE - legN - legW;
      x = -LX + k;
      z = LS;
      yaw = -Math.PI / 2;
    }
    if (!ccw) yaw += Math.PI;  // facing the other way
    return { x, z, yaw };
  },

  _tickPatrolWarthog(dt, t) {
    if (!this.patrolHogs || !this.patrolHogs.length) return;
    this.patrolHogs.forEach(hog => {
      const ud = hog.userData;
      ud.t += dt * 13.0;  // distance traveled at 13 u/s — full loop ~46s
      const p = this._samplePerimeter(ud.t, true);
      hog.position.set(p.x, -8, p.z);
      hog.rotation.y = p.yaw;
      if (ud.wheels) {
        ud.wheels.forEach(w => { w.rotation.x -= dt * 8; });
      }
      hog.children.forEach(c => {
        if (c.userData?.blinkSeed === 99 && c.material) {
          c.material.opacity = 0.85 + Math.sin(t * 7 + c.position.x) * 0.10;
        }
      });
    });
  },

  _makePanelTexture(s) {
    const W = 720, H = 432;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    // Background — translucent dark with subtle gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'rgba(8, 10, 16, 0.92)');
    bg.addColorStop(1, 'rgba(14, 16, 24, 0.92)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Top kicker — magenta mono
    ctx.font = '600 16px "Space Mono", monospace';
    ctx.fillStyle = '#ff7ec3';
    ctx.textBaseline = 'top';
    ctx.fillText(`EXPERIMENT  ${s.num}`, 32, 28);

    // Title — huge lowercase Space Grotesk
    ctx.font = '800 84px "Space Grotesk", system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(s.title, 28, 78);

    // Body — wrapped mono
    ctx.font = '400 16px "Space Mono", monospace';
    ctx.fillStyle = '#cfd5e0';
    this._wrapText(ctx, s.body, 32, 220, W - 64, 24);

    // Bottom bar — caution stripe + ENTER prompt
    ctx.fillStyle = 'rgba(255,126,195,0.18)';
    ctx.fillRect(0, H - 48, W, 48);
    ctx.fillStyle = '#ff7ec3';
    ctx.font = '600 14px "Space Mono", monospace';
    ctx.fillText('▶ HOVER · CLICK · ENTER →', 32, H - 32);

    // Corner brackets (HUD-style)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    const bs = 18;
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

  _wrapText(ctx, text, x, y, maxW, lineH) {
    const words = text.split(/\s+/);
    let line = '';
    let yy = y;
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = words[i];
        yy += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  },

  /* ---------- HUD overlay (corner UI) ---------- */
  _buildHud() {
    const root = document.createElement('div');
    root.className = 'ss-hud';
    root.innerHTML = `
      <div class="ss-tl">
        <div class="ss-kicker">— scene index —</div>
        <div class="ss-title">kani / scenes</div>
        <div class="ss-meta">10 experiments + galaxy portal · station observation deck</div>
        <div class="ss-nav">
          <a href="/">← back to galaxy</a>
          <a href="/tracks">catalog</a>
        </div>
      </div>
      <div class="ss-tr">
        <div class="ss-mark">cantmute.me</div>
        <div class="ss-meta">drag to look · tap a panel to focus</div>
      </div>
      <div class="ss-bl">
        <div class="ss-hint" id="ss-hint">— select a panel —</div>
      </div>
      <div class="ss-focus" id="ss-focus" style="display:none">
        <div class="ss-focus-num" id="ss-focus-num"></div>
        <div class="ss-focus-title" id="ss-focus-title"></div>
        <div class="ss-focus-body" id="ss-focus-body"></div>
        <div class="ss-focus-actions">
          <a class="ss-act" id="ss-focus-enter" href="#">enter →</a>
          <button class="ss-act ss-act-dim" data-act="release">close</button>
        </div>
      </div>
    `;
    root.querySelectorAll('[data-act="release"]').forEach(b => {
      b.addEventListener('click', e => { e.stopPropagation(); this._release(); });
    });
    return root;
  },

  /* ---------- Composer ---------- */
  _setupComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.65, 0.55, 0.10);
    bloom.threshold = 0.10;
    bloom.strength  = 0.65;
    bloom.radius    = 0.55;
    this.bloom = bloom;
    this.composer.addPass(bloom);
    this.postPass = new ShaderPass({
      uniforms: {
        tDiffuse:    { value: null },
        uTime:       { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
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
    // b152: portrait phones get a wider FOV + raised camera so more of the
    // panel arc fits and the empty grid floor doesn't dominate the screen.
    const portrait = h > w;
    this.camera.fov = portrait ? 96 : 72;
    this._camBaseY = portrait ? 1.8 : 0;
    this.camera.updateProjectionMatrix();
    if (this.postPass) this.postPass.uniforms.uResolution.value.set(w, h);
  },

  _onMove(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) / r.width;
    this.mouse.y = (e.clientY - r.top) / r.height;
    this.mouse.ndc.set(this.mouse.x * 2 - 1, -(this.mouse.y * 2 - 1));
    if (this.drag.active) {
      const dx = e.clientX - this.drag.lx;
      const dy = e.clientY - this.drag.ly;
      this.drag.totalPx += Math.abs(dx) + Math.abs(dy);
      this.gaze.yaw   -= dx * 0.0032;
      this.gaze.pitch += dy * 0.0024;
      this.gaze.pitch = Math.max(-0.40, Math.min(0.30, this.gaze.pitch));
      this.drag.lx = e.clientX;
      this.drag.ly = e.clientY;
    } else {
      this._raycast();
    }
  },

  _onPointerDown(e) {
    if (e.target !== this.renderer.domElement) return;
    this.drag.active = true;
    this.drag.x0 = e.clientX; this.drag.y0 = e.clientY;
    this.drag.lx = e.clientX; this.drag.ly = e.clientY;
    this.drag.totalPx = 0;
    // b152: sync mouse ndc to the press point so tap-to-focus works on touch
    // (touch devices have no hover phase that would set mouse.ndc otherwise).
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) / r.width;
    this.mouse.y = (e.clientY - r.top) / r.height;
    this.mouse.ndc.set(this.mouse.x * 2 - 1, -(this.mouse.y * 2 - 1));
  },

  _onPointerUp(e) {
    if (!this.drag.active) return;
    this.drag.active = false;
    if (this.drag.totalPx < 6) {
      if (this.focused) { this._release(); return; }
      // b152: explicit raycast at tap position. `this.hovered` is only set by
      // pointermove's hover branch, which never fires on touch — so the prior
      // `if (this.hovered)` check made tap-to-focus impossible on mobile.
      if (this.panels && this.panels.length) {
        this.ray.setFromCamera(this.mouse.ndc, this.camera);
        const meshes = this.panels.map(p => p.mesh);
        const hits = this.ray.intersectObjects(meshes, false);
        if (hits.length) {
          const hit = this.panels.find(p => p.mesh === hits[0].object);
          if (hit) { this._focus(hit); return; }
        }
      }
      // No panel under tap — fall through to floor prop kick
      this._tryKickProp();
    }
  },

  _onKey(e) {
    if (e.key === 'Escape' && this.focused) this._release();
  },

  _raycast() {
    if (this.focused) return;
    this.ray.setFromCamera(this.mouse.ndc, this.camera);
    const hits = this.ray.intersectObjects(this.panels.map(p => p.mesh), false);
    const next = hits.length ? this.panels.find(p => p.mesh === hits[0].object) : null;
    if (next === this.hovered) return;
    this.hovered = next;
    const hint = document.getElementById('ss-hint');
    if (hint) hint.textContent = next
      ? `→ ${next.scene.title.toUpperCase()}  ·  EXPERIMENT ${next.scene.num}`
      : '— select a panel —';
    document.body.style.cursor = next ? 'pointer' : '';
  },

  _focus(panel) {
    this.focused = panel;
    document.body.style.cursor = '';
    const f = document.getElementById('ss-focus');
    document.getElementById('ss-focus-num').textContent  = `EXPERIMENT ${panel.scene.num}`;
    document.getElementById('ss-focus-title').textContent = panel.scene.title;
    document.getElementById('ss-focus-body').textContent  = panel.scene.body;
    document.getElementById('ss-focus-enter').href = panel.scene.isHome
      ? '/'
      : `/scenes/play.html?scene=${panel.scene.id}`;
    f.style.display = '';
    requestAnimationFrame(() => f.classList.add('on'));
  },

  _release() {
    this.focused = null;
    const f = document.getElementById('ss-focus');
    if (f) {
      f.classList.remove('on');
      setTimeout(() => { if (!this.focused && f) f.style.display = 'none'; }, 350);
    }
  },

  _forwardVec() {
    const cy = Math.cos(this.gaze.pitch);
    return new THREE.Vector3(
      Math.sin(this.gaze.yaw) * cy,
      Math.sin(this.gaze.pitch),
      -Math.cos(this.gaze.yaw) * cy,
    );
  },

  /* ---------- Loop ---------- */
  animate() {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, this.clock.getDelta());
    const t  = this.clock.elapsedTime;

    // Camera orientation from gaze (locked at origin, drag to look)
    const fwd = this._forwardVec();
    const lookAt = new THREE.Vector3().copy(this.camera.position).add(fwd.multiplyScalar(20));
    this.camera.lookAt(lookAt);

    // Subtle camera bob (offset from portrait/landscape base height)
    this.camera.position.y = (this._camBaseY || 0) + Math.sin(t * 0.5) * 0.10;

    // Floor + dust uniforms
    if (this.floor) this.floor.material.uniforms.uTime.value = t;
    if (this.dust)  this.dust.material.uniforms.uTime.value = t;

    // Distant planet — slow rotation + ring tilt drift
    if (this.planet) {
      this.planet.material.uniforms.uTime.value = t;
      this.planet.rotation.y = t * 0.018;
    }
    if (this.planetRing)  this.planetRing.rotation.z  = t * 0.012;
    if (this.planetRing2) this.planetRing2.rotation.z = t * 0.012 - 0.4;
    if (this.planetHalo) {
      this.planetHalo.material.opacity = 0.42 + 0.10 * Math.sin(t * 0.4);
    }

    // Station lights — vertex shader handles blinking via uTime
    if (this.stationLights) this.stationLights.material.uniforms.uTime.value = t;

    // Capital ship flybys
    this._tickFlybys(dt, t);
    // Scripted pelican dropoff (separate from the random flyby pool)
    this._tickScriptedPelican(dt, t);
    // Patrolling Warthog driving a loop around the deck
    this._tickPatrolWarthog(dt, t);
    // b184: walking personnel between tents and buildings
    this._tickPersonnel(dt, t);
    // b173: patrolling Scorpion tank with headlights on
    this._tickPatrolScorpion(dt, t);

    // Floor props — pulse fusion coil cores, kill balls, pylon emitters/rings
    if (this.props) {
      this.props.forEach(p => {
        if (p.userData?.isCoil && p.userData.plasmaMats) {
          // Each side has its own plasma shader instance — tick them all
          for (let i = 0; i < p.userData.plasmaMats.length; i++) {
            p.userData.plasmaMats[i].uniforms.uTime.value = t + i * 17.3;
          }
        }
        if (p.userData?.isKillBall) {
          p.userData.shell.material.uniforms.uTime.value = t;
          p.userData.core.material.uniforms.uTime.value = t;
          if (!p.userData.kicked) {
            p.position.y = p.userData.bobBase + Math.sin(t * 0.9 + p.userData.bobSeed) * 0.40;
            p.rotation.y = t * 0.4;
          }
          p.userData.halo.material.opacity = 0.60 + 0.20 * Math.sin(t * 1.6 + p.userData.bobSeed);
        }
      });
      // Run the click-to-kick physics integration
      this._tickPropsPhysics(dt);
      // Coil fuse countdowns → explosions → respawn timers → particles
      this._tickCoilCountdowns(t);
      this._tickCoilRespawns(t);
      this._tickExplosions(dt);
    }

    // Standoff aviation strobes + dish slow tracking + radar spin
    if (this._radarBuildingPivots) {
      this._radarBuildingPivots.forEach(p => { p.rotation.y = t * 0.6; });
    }
    // b171: watchtower searchlights — slow rotation, each pivot at its own rate
    if (this._watchtowerLights) {
      this._watchtowerLights.forEach(p => {
        p.rotation.y = t * (p.userData.spinRate || 0.2);
      });
    }
    if (this.standoff) {
      this.standoff.dishes.forEach((d, i) => {
        d.rotation.y = d.userData.baseYaw + Math.sin(t * 0.05 + i * 1.7) * 0.12;
      });
      this.standoff.strobes.forEach((s) => {
        // Slow steady aviation pulse — 1Hz for red, 0.6Hz for blue
        const k = 0.5 + 0.5 * Math.sin(t * s.userData.rate + s.userData.phase);
        s.material.opacity = 0.30 + k * 0.70;
      });
      this.standoff.windows.forEach((w) => {
        // Subtle warmth flicker on bunker windows
        const k = 0.85 + Math.sin(t * w.userData.rate + w.userData.phase) * 0.10;
        w.material.opacity = w.userData.baseOpacity * k;
      });
    }

    // Per-panel updates: hover/focus lerps, idle drift
    this.panels.forEach(p => {
      const u = p.mesh.material.uniforms;
      u.uTime.value = t + p.basePos.x * 0.7;
      const isHover = this.hovered === p;
      const isFocus = this.focused === p;
      const targetH = isHover ? 1.0 : 0.0;
      const targetF = isFocus ? 1.0 : 0.0;
      u.uHover.value += (targetH - u.uHover.value) * Math.min(1, dt * 8);
      u.uFocus.value += (targetF - u.uFocus.value) * Math.min(1, dt * 6);

      // Position: focused → fly forward toward camera; hover → lift forward
      // along the camera-facing direction (toward viewer) + small upward
      // bump; otherwise idle drift around the diegetic mount.
      let target;
      if (isFocus) {
        target = this.camera.position.clone().add(this._forwardVec().multiplyScalar(11));
      } else if (isHover) {
        // Direction from camera (origin) to panel — hover lifts it OUT
        // (away from camera) … wait no, we want it to come TOWARD the
        // viewer so it reads as "popping out." Negative direction.
        const toCam = p.basePos.clone().normalize().multiplyScalar(-0.7);
        target = p.basePos.clone().add(toCam).add(new THREE.Vector3(0, 0.30, 0));
      } else {
        const drift = Math.sin(t * 0.4 + p.basePos.x * 0.3) * 0.20;
        target = p.basePos.clone().add(new THREE.Vector3(0, drift, 0));
      }
      p.mesh.position.lerp(target, Math.min(1, dt * (isFocus ? 6 : 3)));
      p.halo.position.copy(p.mesh.position);
      // Halo opacity tracks hover/focus
      p.halo.material.opacity = 0.28 + u.uHover.value * 0.30 + u.uFocus.value * 0.28;
      // Scale boost on hover
      const targetScale = isFocus ? 1.18 : (isHover ? 1.05 : 1.0);
      p.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, 1), Math.min(1, dt * 5));
      // Halo is a sprite — scales with panel size
      const haloW = (p.sizeW * 1.8) * targetScale;
      const haloH = (p.sizeH * 1.8) * targetScale;
      p.halo.scale.lerp(new THREE.Vector3(haloW, haloH, 1), Math.min(1, dt * 5));
      // Re-orient panel to face camera when focused
      if (isFocus) p.mesh.lookAt(this.camera.position);
      else if (Math.abs(u.uFocus.value) < 0.02) p.mesh.lookAt(0, p.basePos.y * 0.5, 0);
    });

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
    this.composer = null; this.panels = [];
  },
};

window.ScenesSelector = ScenesSelector;
