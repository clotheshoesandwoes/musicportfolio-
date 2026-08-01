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

    // b208: shader edge-frame removed. The outer-4 percent UV mix to
    // uTint produced bright tint-squared pixels along every border,
    // which bloom then smeared outward into a wide colored rectangle
    // around each panel. Real 3D steel framing already lives around
    // the panel via _buildPanelHost, so the painted-on tint frame was
    // redundant.

    // Inner caution-stripe dim band at the bottom (where the description sits)
    float band = smoothstep(0.78, 0.80, uv.y) * (1.0 - smoothstep(1.0, 1.02, uv.y));
    col *= 1.0 - band * 0.20;

    // b216: tint RESTORED. The huge tinted halos the user kept seeing
    // were the structure-uplight sprites, not this multiplication.
    col *= uTint;

    // Hover pulse — adds the panel's own tint when hovered/focused.
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
    // b224: global brightness lift. The base reads as silhouettes because every
    // building uses MeshBasicMaterial with a near-black hex (0x2a3142 family),
    // so no light source could ever brighten them — only the post pass can.
    // Gain + tiny black-floor lift so dark structures separate from the ground
    // without blowing out the panels (which already sit in the bright register).
    col = col * 1.18 + 0.028;
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
  labels: null,

  init(container) {
    if (this.renderer) return;
    this.destroyed = false;
    this.panels = [];
    this.hovered = null;
    this.focused = null;
    // s13: debug label overlay (?labels=1 or L key) — see docs/scenes/LABEL_OVERLAY_PLAN.md
    const wantLabels = new URLSearchParams(location.search).get('labels') === '1';
    this.labels = { enabled: wantLabels, sprites: [], texCache: new Map() };
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
    this.scene.fog = new THREE.FogExp2(0x0e1218, 0.0115);

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 420);
    this.camera.position.set(0, 0, 0);

    this._buildEnvironment();
    this._buildHexDeck();              // b171: hexagonal observation deck (replaces painted helipad)
    this._buildStandoff();
    this._buildCentralDish();
    this._buildPelicanPad();           // b193: relocated to SE airfield (was -2,+24 behind camera, now 50,+25)
    this._buildPlanet();
    this._buildStationLights();
    this._buildFlybys();
    this._buildScriptedPelican();
    this._buildPatrolWarthog();
    // b193: barracks row + antenna array DISABLED — both sat in v2 panel zones
    // (barracks at z=-12 between camera and freqmap; antenna array at -58,-56
    // overlapping the broken-dish + dimensions hosts). Will rebuild repositioned
    // for the bivouac zone in b198 / NW comms cluster polish in b196.
    this._buildFuelDepot();            // b171: cylindrical fuel tanks at far-right (kept — no v2 collision)
    this._buildAntennaArray();         // b227: relocated outside east fence (was disabled in b193 — clipped panels)
    this._buildWatchtowers();          // b171: 4 perimeter watchtowers
    this._buildPerimeterClutter();     // b171/b227: real rectangular double fence + razor wire + conex stacks on flanks
    this._buildDeckFlankFill();        // b237: fill the empty zones between deck and panel arc — guard shacks, equip sheds, drums, pallets, floods
    // s12: _buildOuterCompounds DISABLED — the 4 anchors at (±95, -25/-65)
    // and (±92, -100) read as "ugly distant cities" outside the base
    // perimeter loop. User wants buildings ON the road grid INSIDE the base.
    // Definition kept in file for now in case we re-enable selectively.
    // this._buildOuterCompounds();
    this._buildNWQuadrantFill();       // s5: layered fill for the NW quadrant (broken-dish POI) — SIGINT vans, relay tower, maintenance pad, aid station, conex depot, watchtower
    // s12: _buildSWQuadrantFill DISABLED — the 7-cluster fill piled up
    // around the biostation panel from BIOSTATION SW POI no matter how many
    // times we shifted individual buildings off the S-perim road. Ripping
    // out the cluster; re-add selectively in defined grid plots if user
    // wants stuff back. Definition kept in file.
    // this._buildSWQuadrantFill();
    this._buildAllStructures();        // b173/b193: now only ensures missile silo (other hosts inline)
    this._buildFloorProps();
    this._buildPanels();
    this._buildStructureUplights();    // illuminate the buildings from below
    this._buildBuildingFloodBeams();   // b171: focused volumetric beams ON the dishes/silo/radar
    this._buildBuildingWindows();      // b173: lit window grids on existing buildings (more man-made lighting)
    this._buildBaseLighting();         // b201: perimeter streetlamps + stadium pylons + scaffold lights
    this._buildPOI();                  // b202: discrete waypoint navigation across the base
    this._buildPelicanLights();        // b173: cockpit/nav/ramp glow + 4 floodlight stands around pelican
    this._buildEngineerCrew();         // b173: 3 ODST engineers around the parked pelican
    this._buildTents();                // b184: 3 bivouac clusters of GP-medium tents
    this._buildPersonnel();            // b184: 8 soldiers walking between tents/buildings
    this._buildScorpions();            // b173: 1 parked Scorpion tank + 1 slow patroller
    this._buildVtolHangar();           // s18: Shadow Moses-style VTOL hangar + parked Hind in the far-NW empty desert
    this._buildLabels();               // s13: debug ID labels (?labels=1 / L key)
    this._setupComposer();

    this.clock = new THREE.Clock();
    this.ray = new THREE.Raycaster();

    this._onResize = this._onResize.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onKey = this._onKey.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    // s18: free-cam state. F toggles it; WASD strafe, QE up/down, Shift = fast,
    // ESC / 0-9 / clicking a viewport button returns to scripted POI mode.
    this.freecam = { active: false, speed: 28, fastMult: 4.0 };
    this.keys = new Set();
    window.addEventListener('resize', this._onResize);
    canvas.addEventListener('pointermove', this._onMove);
    canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKeyUp);

    this._onResize();
    this.animate = this.animate.bind(this);
    this.animate();
  },

  /* ---------- Environment: Standoff-style outpost deck at night ---------- */
  _buildEnvironment() {
    // Concrete deck pad with painted helipad markings + caution stripes,
    // fading to dirt/rock at the edges. Replaces the b140 magenta grid so
    // the scene reads as a real ground surface, not a void-floating panel.
    const floorGeo = new THREE.PlaneGeometry(360, 360, 1, 1);  // b227: was 220 — expanded for bigger perimeter
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
          // b224: lifted base value (.135/.112/.075 → .175/.148/.105) so the
          // ground reads as moonlit-dusty, not a dark void. The post-pass
          // brightness gain alone wasn't enough — the desert needed to start
          // brighter so the buildings sit ON it instead of lost in it.
          vec3 dirt = vec3(0.175, 0.148, 0.105);
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
          // b214: base brightness raised 0.78→1.05 + moonlight wash
          // tripled. Old values matched a "pitch-night-without-streetlights"
          // read; user wanted the base lit "like a real military
          // installation," not silhouettes against tan dust.
          float fade = 1.0 - smoothstep(140.0, 260.0, d) * 0.45;
          col *= 1.05 + 0.30 * fade;

          // ---- Moonlight cool wash (b214: bumped 0.005/0.008/0.014 → 0.022/0.028/0.038) ----
          col += vec3(0.022, 0.028, 0.038);

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

    // Atmospheric back-glow — wide soft sprite far behind.
    // b214: opacity dropped 0.45/0.40 → 0.18/0.15, scale tightened. These
    // were a big chunk of the "random colored tint" haze the user flagged
    // — wide additive blobs floating in the middle of the scene. Pushed
    // back to z=-95/-105 so they sit beyond the missile silo (z=-107) as
    // a true horizon glow instead of veiling the foreground.
    const bgTex = this._makeRadialGlowTexture('rgba(180,80,160,0.55)');
    const bgMat = new THREE.SpriteMaterial({ map: bgTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.18 });
    const bg = new THREE.Sprite(bgMat);
    bg.scale.set(110, 50, 1);
    bg.position.set(0, 4, -100);
    this.scene.add(bg);

    const bg2Tex = this._makeRadialGlowTexture('rgba(80,180,200,0.40)');
    const bg2Mat = new THREE.SpriteMaterial({ map: bg2Tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.15 });
    const bg2 = new THREE.Sprite(bg2Mat);
    bg2.scale.set(90, 42, 1);
    bg2.position.set(-30, 6, -95);
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
    const poleMat = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const fixtureMat = new THREE.MeshBasicMaterial({ color: 0x1d2230 });
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
    // b216: ENTIRE FUNCTION DELETED. 16 calls × `_makeUplightTexture` ×
    // additive sprite at every panel host's base = a tall tinted column
    // sitting directly behind every billboard. Sprites face camera, so
    // each one reads as a giant tinted rectangle. THIS WAS THE SOURCE of
    // the orange box behind tape spine, the blue box behind freq map,
    // the pink behind organism, the amber behind galaxy and deep sea —
    // every halo flagged across screenshots. b215's "tighten to 8×14
    // opacity 0.38" was not enough; user still saw them at full force.
    // No more sprites. Buildings will read as silhouettes against the sky.
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
    grp.name = 'hex_deck';
    const deckR = 12.0;
    const floorY = -8.0;
    const deckH = 0.40;

    const deckMat = new THREE.MeshBasicMaterial({ color: 0x303440 });
    const tread   = new THREE.MeshBasicMaterial({ color: 0x3a4050 });
    const steel   = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const sandbag = new THREE.MeshBasicMaterial({ color: 0x2a3040 });
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
      const lens = this._makeRunningLight(0xd4e0f0, 0.20);
      lens.position.set(armEndX + Math.cos(c.a) * 0.18, floorY + postH - 0.30, armEndZ + Math.sin(c.a) * 0.18);
      grp.add(lens);
      // b213: hex-deck floodlight cone removed (scale 8×12 painted a glowing
      // rectangle off each post). Lens dot remains.
    });

    this.scene.add(grp);
    this.observationDeck = grp;
  },

  /* ---------- b171: Barracks row — adds 3 more barracks beside the existing
     big barracks at (-65,-22), filling out the left-flank living quarters. */
  _buildBarracksRow() {
    const concrete = new THREE.MeshBasicMaterial({ color: 0x3a4358 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x4a5468 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x191d28 });
    const olive = new THREE.MeshBasicMaterial({ color: 0x3a401e });
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
    grp.name = 'fuel_depot';
    const concrete = new THREE.MeshBasicMaterial({ color: 0x3a4358 });
    const tankPaint = new THREE.MeshBasicMaterial({ color: 0x6a6a4a });
    const tankBand = new THREE.MeshBasicMaterial({ color: 0x4a4a32 });
    const steel = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
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

    // b214: fuel depot pulled west x=72 → x=62. Old position put the east
    // tank pair at world x=77, sitting inside the E perimeter road
    // (x=78 ±4.5) — those are the "4 silos blocking the road" from the
    // user's screenshot. New center keeps the depot well off the road.
    grp.position.set(62, -8, 8);
    this.scene.add(grp);
  },

  /* ---------- b171: Antenna array — dense field of comms masts at back-left,
     adds visual density to the otherwise sparse back-left zone. */
  _buildAntennaArray() {
    const grp = new THREE.Group();
    grp.name = 'antenna_array';
    const steel = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const accent = new THREE.MeshBasicMaterial({ color: 0x363c4a });

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

    // b227: relocated outside the eastern fence (was disabled in b193 because
    // the original spot at (-58,-56) clipped through the broken-dish + dimensions
    // panel hosts). Antenna farm is silhouette punctuation outside the wire,
    // visible from the ridge POI as the eastern flank's silhouette frame.
    // Pushed out further with the bigger b227 perimeter (outer fence at x=125).
    grp.position.set(150, -8, -25);
    this.scene.add(grp);
  },

  /* ---------- b171: Watchtowers at perimeter corners ---------- */
  _buildWatchtowers() {
    const steel = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const accent = new THREE.MeshBasicMaterial({ color: 0x363c4a });
    const dark = new THREE.MeshBasicMaterial({ color: 0x191d28 });

    // b227: corners pushed out to sit at the NEW outer fence corners
    // (x=±125, z=-142/+98). Watchtowers should anchor the visible perimeter
    // envelope, not float midway between fence and patrol road.
    const positions = [
      { x:  127, z:  100, lightColor: 0xff3344 },  // back-right (SE)
      { x: -127, z:  100, lightColor: 0x4488ff },  // back-left  (SW)
      { x:  127, z: -144, lightColor: 0x4488ff },  // front-right (NE)
      { x: -127, z: -144, lightColor: 0xff3344 },  // front-left  (NW)
    ];

    positions.forEach(({ x, z, lightColor }) => {
      const grp = new THREE.Group();
      grp.name = `watchtower_${x}_${z}`;
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
    const concrete = new THREE.MeshBasicMaterial({ color: 0x4a5468 });
    const steel = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
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

    // b193 v2: jersey walls re-anchored to v2 layout shoulder protection.
    // Spine road still goes from deck (z=-12) deep into base (z=-90), so the
    // shoulder jerseys make sense; pulled inward to flank the missile silo
    // approach (now at x=0 dead-axis, deeper at z=-94).
    // Spine road shoulders (between deck and missile silo)
    addJerseyWallLine( 6, -50,  6, -85);
    addJerseyWallLine(-6, -50, -6, -85);
    // Around the SE airfield motor pool (parked vehicles)
    // b214: pushed jersey line z=12 → z=4. Old line ran straight through
    // the spread-out motor pool (vehicles at z=8/12/22). Now sits at the
    // airfield south frontage as a fence between deck and motor pool.
    addJerseyWallLine(26,   4, 48,   4);
    // Behind the SW bivouac (suggests bivouac perimeter, b214: bivouac at -26,20)
    addJerseyWallLine(-34, 28, -18, 28);

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
        const lens = this._makeRunningLight(0xffe6a0, 0.14);
        lens.position.set(x - Math.sign(x) * 0.9, -8 + 6.6, z);
        this.scene.add(lens);
        // b213: catenary down-cone removed.
      });
    }

    // b227: real rectangular DOUBLE chain-link perimeter — replaces the b171
    // sparse circle of 32 posts at r=92 (invisible from ridge POI; floats
    // disconnected from the actual rectangular base loop the patrols use).
    // Inner fence at x=±82, z=-94/+54 (just inside the corner watchtowers at
    // ±88,±58/±98). Outer fence at x=±90, z=-102/+62, with ~8u "clear zone"
    // strip between. Razor wire coils on top of inner fence only. Sells a
    // hardened installation perimeter from any vantage including ridge.
    const fenceMat = new THREE.MeshBasicMaterial({ color: 0x363c4a });
    const meshMat = new THREE.MeshBasicMaterial({
      color: 0x2a3142, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
    });
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x8a94a4 });
    const buildFenceLeg = (x1, z1, x2, z2, addRazor) => {
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const ang = Math.atan2(dz, dx);
      // Posts every ~8u
      const POST_STEP = 8;
      const postCount = Math.max(2, Math.round(len / POST_STEP));
      for (let i = 0; i <= postCount; i++) {
        const t = i / postCount;
        const cx = x1 + dx * t, cz = z1 + dz * t;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.13, 2.6, 4), fenceMat);
        post.position.set(cx, -8 + 1.3, cz);
        this.scene.add(post);
      }
      // One continuous mesh-panel plane along the leg — semi-transparent so it
      // reads as wire mesh, not a wall. Cheaper than 30 individual panels.
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.0), meshMat);
      panel.position.set((x1 + x2) / 2, -8 + 1.0, (z1 + z2) / 2);
      panel.rotation.y = -ang;
      this.scene.add(panel);
      // Razor-wire coils on top of inner fence
      if (addRazor) {
        const COIL_STEP = 2.4;
        const coils = Math.max(1, Math.round(len / COIL_STEP));
        for (let i = 0; i < coils; i++) {
          const t = (i + 0.5) / coils;
          const cx = x1 + dx * t, cz = z1 + dz * t;
          const coil = new THREE.Mesh(
            new THREE.TorusGeometry(0.32, 0.03, 3, 6),
            wireMat,
          );
          coil.rotation.y = -ang;
          coil.rotation.x = Math.PI / 2;
          coil.position.set(cx, -8 + 2.55, cz);
          this.scene.add(coil);
        }
      }
    };
    // Inner fence (with razor wire) — bigger envelope per "bigger perimeter"
    const IX = 110, INZ = -128, IPZ = 85;
    buildFenceLeg(-IX, INZ,  IX, INZ, true);  // N
    buildFenceLeg( IX, INZ,  IX, IPZ, true);  // E
    buildFenceLeg( IX, IPZ, -IX, IPZ, true);  // S
    buildFenceLeg(-IX, IPZ, -IX, INZ, true);  // W
    // Outer fence (chain-link only) — 15u clear-strip beyond inner
    const OX = 125, ONZ = -142, OPZ = 98;
    buildFenceLeg(-OX, ONZ,  OX, ONZ, false);
    buildFenceLeg( OX, ONZ,  OX, OPZ, false);
    buildFenceLeg( OX, OPZ, -OX, OPZ, false);
    buildFenceLeg(-OX, OPZ, -OX, ONZ, false);

    // b227: conex shipping container stacks staged in the clear-strip BETWEEN
    // the inner (x=±82) and outer (x=±90) perimeter fences — that's the only
    // place real installations stage them outside the wire. Earlier b227
    // placement put them in the panel/road infield (x=±70, z=-30) which
    // blocked sight lines to the v2 panels from ridge POI. Aligned along the
    // fence axis (yaw=±π/2 so the long 6u side runs along ±Z), centered at
    // x=±86 (3u to inner fence, 1u to outer). Mix of single + double stacks.
    const conexPalette = [0x3a4030, 0x4d4730, 0x36404f];
    const buildConexStack = (x, z, yaw, count) => {
      const grp = new THREE.Group();
      grp.name = `conex_stack_${x}_${z}`;
      for (let i = 0; i < count; i++) {
        const col = conexPalette[(i + Math.abs((x | 0) + (z | 0))) % 3];
        const mat = new THREE.MeshBasicMaterial({ color: col });
        const box = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.4), mat);
        box.position.y = 1.3 + i * 2.65;
        grp.add(box);
        // Door end-cap — slightly darker
        const door = new THREE.Mesh(
          new THREE.PlaneGeometry(2.3, 2.4),
          new THREE.MeshBasicMaterial({ color: 0x1d2230 }),
        );
        door.position.set(3.01, 1.3 + i * 2.65, 0);
        door.rotation.y = Math.PI / 2;
        grp.add(door);
      }
      grp.position.set(x, -8, z);
      grp.rotation.y = yaw;
      this.scene.add(grp);
    };
    const HALFPI = Math.PI / 2;
    // East clear-strip (between inner x=110 and outer x=125)
    buildConexStack( 117, -120,  HALFPI, 2);
    buildConexStack( 117,  -80,  HALFPI, 1);
    buildConexStack( 117,  -40,  HALFPI, 2);
    buildConexStack( 117,    0,  HALFPI, 1);
    buildConexStack( 117,   45,  HALFPI, 2);
    // West clear-strip
    buildConexStack(-117, -120, -HALFPI, 1);
    buildConexStack(-117,  -80, -HALFPI, 2);
    buildConexStack(-117,  -40, -HALFPI, 1);
    buildConexStack(-117,    0, -HALFPI, 2);
    buildConexStack(-117,   45, -HALFPI, 1);
  },

  /* ---------- b237: deck-flank fill — gap zones between deck and panel arc.
     User flagged the empty desert zones on either side of the spine corridor
     from the observation-deck POV. Drops guard shacks, equipment sheds,
     drum clusters, pallet stacks, and floodlight poles in the dead space
     between the rail kiosks (z=-10) and the cement walkways (z=-30/-58).
     Symmetrical-ish density on each flank; far-side fill past the deepsea/
     neural panel hosts where x=±70 was empty between panel and patrol road. */
  _buildDeckFlankFill() {
    const concrete = new THREE.MeshBasicMaterial({ color: 0x3a4358 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x4a5468 });
    const olive = new THREE.MeshBasicMaterial({ color: 0x3a4030 });
    const oliveHi = new THREE.MeshBasicMaterial({ color: 0x4d5440 });
    const steel = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const accent = new THREE.MeshBasicMaterial({ color: 0x424c64 });

    const buildGuardShack = (x, z, yaw) => {
      const grp = new THREE.Group();
      grp.name = `guard_shack_${x}_${z}`;
      const shack = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.0, 2.6), concrete);
      shack.position.y = 1.5;
      grp.add(shack);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.25, 3.0), concreteLit);
      roof.position.y = 3.13;
      grp.add(roof);
      const door = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 1.8),
        new THREE.MeshBasicMaterial({ color: 0xffaa55, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      door.position.set(0, 1.1, 1.32);
      door.userData = { rate: 4.0, phase: Math.random() * 6, baseOpacity: 0.55 };
      this.standoff?.windows.push(door);
      grp.add(door);
      const window = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.55),
        new THREE.MeshBasicMaterial({ color: 0xffaa55, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      window.position.set(1.1, 2.0, 1.32);
      window.userData = { rate: 5.0, phase: Math.random() * 6, baseOpacity: 0.65 };
      this.standoff?.windows.push(window);
      grp.add(window);
      const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 4), steel);
      whip.position.set(-1.1, 4.3, 0);
      grp.add(whip);
      grp.position.set(x, -8, z);
      grp.rotation.y = yaw;
      this.scene.add(grp);
    };

    const buildEquipShed = (x, z, yaw) => {
      const grp = new THREE.Group();
      grp.name = `equip_shed_${x}_${z}`;
      const W = 5.0, H = 3.2, D = 3.6;
      const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), olive);
      body.position.y = H / 2;
      grp.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.22, D + 0.4), oliveHi);
      roof.position.y = H + 0.11;
      grp.add(roof);
      // Roll-up door (closed, dim outline)
      const rollup = new THREE.Mesh(new THREE.PlaneGeometry(2.4, H * 0.85), accent);
      rollup.position.set(0, H * 0.43, D / 2 + 0.04);
      grp.add(rollup);
      // Yellow caution stripe along door frame
      [-1.3, 1.3].forEach(xo => {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.10, H * 0.85, 0.06),
          new THREE.MeshBasicMaterial({ color: 0x6a5618 }),
        );
        stripe.position.set(xo, H * 0.43, D / 2 + 0.06);
        grp.add(stripe);
      });
      // Side air vents
      [-W / 2 - 0.04, W / 2 + 0.04].forEach(xo => {
        for (let i = 0; i < 3; i++) {
          const vent = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.30, 0.45), steel);
          vent.position.set(xo, H * 0.5 + i * 0.45, -D / 4);
          grp.add(vent);
        }
      });
      grp.position.set(x, -8, z);
      grp.rotation.y = yaw;
      this.scene.add(grp);
    };

    const buildDrumCluster = (x, z) => {
      const grp = new THREE.Group();
      grp.name = `drum_cluster_${x}_${z}`;
      grp.position.set(x, -8, z);
      const positions = [[0, 0], [0.95, 0], [0.48, 0.85], [1.43, 0.85], [-0.05, 1.7]];
      positions.forEach(([dx, dz], i) => {
        const drum = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.45, 1.0, 10),
          i % 2 === 0 ? olive : oliveHi,
        );
        drum.position.set(dx, 0.5, dz);
        grp.add(drum);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 10), steel);
        lid.position.set(dx, 1.02, dz);
        grp.add(lid);
      });
      this.scene.add(grp);
    };

    const buildPalletStack = (x, z, yaw) => {
      const grp = new THREE.Group();
      grp.name = `pallet_stack_${x}_${z}`;
      const pallet = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 1.8), olive);
      pallet.position.y = 0.09;
      grp.add(pallet);
      [[0.55, 0.55, 0.65, 0.45], [-0.55, 0.55, 0.65, 0.45], [0, 1.30, 0.75, 0.5], [0, 2.00, 0.55, 0.4]].forEach(([dx, dh, w, d]) => {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(w, 0.65, d), oliveHi);
        crate.position.set(dx, dh, 0);
        grp.add(crate);
      });
      grp.position.set(x, -8, z);
      grp.rotation.y = yaw;
      this.scene.add(grp);
    };

    const buildFloodPole = (x, z, headDir) => {
      const grp = new THREE.Group();
      grp.name = `flood_pole_${x}_${z}`;
      grp.position.set(x, -8, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 9.5, 5), steel);
      pole.position.y = 4.75;
      grp.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, 0.65), accent);
      head.position.set(headDir.x * 0.45, 9.6, headDir.z * 0.45);
      grp.add(head);
      const lens = this._makeRunningLight(0xfff0c8, 0.32);
      lens.position.set(headDir.x * 0.75, 9.5, headDir.z * 0.75);
      grp.add(lens);
      this.scene.add(grp);
    };

    // ----- Left flank -----
    buildGuardShack(-22, -10,  0.4);
    buildEquipShed(-38, -22,  0.2);
    buildDrumCluster(-26, -25);
    buildPalletStack(-44, -8,  0.3);
    buildFloodPole(-26, -16, { x: 1, z: 0 });
    buildFloodPole(-50, -28, { x: 1, z: 0 });

    // ----- Right flank -----
    buildGuardShack( 22, -10, -0.4);
    buildEquipShed( 38, -22, -0.2);
    buildDrumCluster(24, -25);
    buildPalletStack( 44, -8, -0.3);
    buildFloodPole( 26, -16, { x: -1, z: 0 });
    buildFloodPole( 50, -28, { x: -1, z: 0 });

    // ----- Far-left flank (between deepsea panel host at x=-66 and west patrol road at x=-78) -----
    buildEquipShed(-72, -22, -Math.PI / 2);
    buildPalletStack(-72,  -8, -Math.PI / 2);
    buildDrumCluster(-72,   8);
    buildFloodPole(-72, -36, { x: 1, z: 0 });

    // ----- Far-right flank (between neural at x=66 and east patrol road at x=78) -----
    buildEquipShed( 72, -22,  Math.PI / 2);
    buildPalletStack( 72,  -8,  Math.PI / 2);
    buildDrumCluster( 71,   8);
    buildFloodPole( 72, -36, { x: -1, z: 0 });

    // ===== s2: deck-flank readability pass =====
    // User feedback: from the MISSILE SILO POI the wide floor on either
    // flank reads as empty. Existing fills (3u guard shacks + 5u equip
    // sheds + 1u drums) silhouette as small dots from 30-50u away. Adding
    // taller / more recognizable assets — parked Warthogs, comm uplink
    // trailers w/ slewed dish, HESCO barrier rows — to give each flank a
    // distinct mid-distance read.

    const buildCommUplinkTrailer = (x, z, yaw) => {
      const grp = new THREE.Group();
      grp.name = `comm_uplink_trailer_${x}_${z}`;
      // Trailer box (camouflage-olive, longer than the equip shed)
      const tW = 3.4, tH = 2.0, tD = 5.4;
      const body = new THREE.Mesh(new THREE.BoxGeometry(tW, tH, tD), olive);
      body.position.y = tH / 2 + 0.45;
      grp.add(body);
      // Roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(tW + 0.2, 0.18, tD + 0.2), oliveHi);
      roof.position.y = tH + 0.55;
      grp.add(roof);
      // Stabilizer jack legs (4 corners — short angled struts)
      [[-tW / 2, -tD / 2], [tW / 2, -tD / 2], [-tW / 2, tD / 2], [tW / 2, tD / 2]].forEach(([sx, sz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.95, 5), steel);
        leg.position.set(sx * 0.92, 0.45, sz * 0.92);
        grp.add(leg);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.10, 0.36), accent);
        foot.position.set(sx * 0.92, 0.05, sz * 0.92);
        grp.add(foot);
      });
      // Wheel pair (suggests trailer was towed in)
      [-1.6, 1.6].forEach(wz => {
        [-(tW / 2 + 0.05), tW / 2 + 0.05].forEach(wx => {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.30, 10), steel);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(wx, 0.42, wz);
          grp.add(wheel);
        });
      });
      // Lit window strip on the long face
      const winMat = new THREE.MeshBasicMaterial({
        color: 0xffaa55, transparent: true, opacity: 0.72,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.36), winMat);
      win.position.set(0, tH * 0.65 + 0.45, tD / 2 + 0.04);
      win.userData = { rate: 4.6, phase: Math.random() * 6, baseOpacity: 0.72 };
      grp.add(win);
      this.standoff?.windows.push(win);
      // Door glow at the cab end
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.5), winMat.clone());
      door.material.opacity = 0.55;
      door.position.set(-tW * 0.30, 1.2, tD / 2 + 0.05);
      door.userData = { rate: 3.4, phase: Math.random() * 6, baseOpacity: 0.55 };
      grp.add(door);
      this.standoff?.windows.push(door);
      // Tilted parabolic dish on the roof — proper SATCOM uplink silhouette
      const dishMast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 1.6, 5), steel);
      dishMast.position.set(0.4, tH + 1.4, -0.6);
      grp.add(dishMast);
      const dish = new THREE.Mesh(
        new THREE.SphereGeometry(1.25, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
        accent,
      );
      dish.position.set(0.4, tH + 2.1, -0.6);
      dish.rotation.x = -Math.PI * 0.42;
      dish.rotation.z = -Math.PI / 2;
      grp.add(dish);
      // Dish feed horn
      const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.18, 0.55, 6), steel);
      feed.position.set(0.4 + 0.55, tH + 2.1, -0.6);
      feed.rotation.z = Math.PI / 2;
      grp.add(feed);
      // Status LED beside the dish
      const led = this._makeRunningLight(0x4488ff, 0.20);
      led.position.set(-0.7, tH + 1.0, tD / 2 + 0.1);
      led.userData = { rate: 2.8, phase: Math.random() * 6 };
      grp.add(led);
      // Cable spool drum on the ground beside the trailer
      const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.45, 14), accent);
      spool.position.set(-tW / 2 - 0.95, 0.30, tD * 0.20);
      grp.add(spool);
      const spoolHub = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.50, 8), steel);
      spoolHub.position.set(-tW / 2 - 0.95, 0.30, tD * 0.20);
      grp.add(spoolHub);
      grp.position.set(x, -8, z);
      grp.rotation.y = yaw;
      this.scene.add(grp);
    };

    const buildHescoRow = (x, z, yaw, count) => {
      // Row of HESCO Bastion barriers — wire-frame cubes filled with rubble.
      // Real-world ubiquitous on FOBs, instantly reads as a fortified wall.
      const grp = new THREE.Group();
      grp.name = `hesco_row_${x}_${z}`;
      const cubeW = 1.4, cubeH = 1.3, cubeD = 1.1;
      const fillMat = new THREE.MeshBasicMaterial({ color: 0x4a4438 });
      const meshMat = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
      for (let i = 0; i < count; i++) {
        const cx = (i - (count - 1) / 2) * (cubeW + 0.06);
        // Inner fill cube (slightly inset)
        const fill = new THREE.Mesh(new THREE.BoxGeometry(cubeW * 0.94, cubeH * 0.96, cubeD * 0.92), fillMat);
        fill.position.set(cx, cubeH / 2, 0);
        grp.add(fill);
        // Outer wire-frame cage (4 vertical edges + 2 horizontal bands)
        [[-cubeW / 2, -cubeD / 2], [cubeW / 2, -cubeD / 2], [-cubeW / 2, cubeD / 2], [cubeW / 2, cubeD / 2]].forEach(([ex, ez]) => {
          const edge = new THREE.Mesh(new THREE.BoxGeometry(0.04, cubeH, 0.04), meshMat);
          edge.position.set(cx + ex, cubeH / 2, ez);
          grp.add(edge);
        });
        [0.20, 0.95].forEach(yh => {
          [-cubeD / 2, cubeD / 2].forEach(zh => {
            const band = new THREE.Mesh(new THREE.BoxGeometry(cubeW + 0.06, 0.04, 0.04), meshMat);
            band.position.set(cx, yh, zh);
            grp.add(band);
          });
          [-cubeW / 2, cubeW / 2].forEach(xh => {
            const band = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, cubeD + 0.06), meshMat);
            band.position.set(cx + xh, yh, 0);
            grp.add(band);
          });
        });
        // 2nd-row stacked cube (every other for irregular skyline)
        if (i % 2 === 0) {
          const fill2 = new THREE.Mesh(new THREE.BoxGeometry(cubeW * 0.94, cubeH * 0.96, cubeD * 0.92), fillMat);
          fill2.position.set(cx, cubeH * 1.5, 0);
          grp.add(fill2);
        }
      }
      grp.position.set(x, -8, z);
      grp.rotation.y = yaw;
      this.scene.add(grp);
    };

    const buildParkedWarthog = (x, z, yaw) => {
      const car = this._buildWarthogMesh(olive, oliveHi, steel,
        new THREE.MeshBasicMaterial({ color: 0x191d28 }));
      car.name = `parked_warthog_flank_${x}_${z}`;
      car.position.set(x, -8, z);
      car.rotation.y = yaw;
      this.scene.add(car);
    };

    // LEFT FLANK — vehicle line + uplink trailer + HESCO wall along the
    // cross road shoulder. Avoids the x=-30 cement walkway and the comms
    // array shed at z=-72; everything sits in z=-32..-52 mid-ground.
    buildParkedWarthog(-20, -32,  Math.PI * 0.55);
    buildParkedWarthog(-26, -36,  Math.PI * 0.55);
    buildCommUplinkTrailer(-40, -42,  Math.PI * 0.42);
    buildHescoRow(-22, -52,  Math.PI * 0.05, 6);
    buildFloodPole(-34, -50, { x: 1, z: 0.3 });

    // RIGHT FLANK — mirror layout. Stays clear of the x=+30 walkway and
    // the forward_ops bunker at z=-72.
    buildParkedWarthog( 20, -32, -Math.PI * 0.55);
    buildParkedWarthog( 26, -36, -Math.PI * 0.55);
    buildCommUplinkTrailer( 40, -42, -Math.PI * 0.42);
    buildHescoRow( 22, -52, -Math.PI * 0.05, 6);
    buildFloodPole( 34, -50, { x: -1, z: 0.3 });
  },

  /* ---------- b201: comprehensive base lighting ----
     Adds man-made light sources covering every quadrant: perimeter
     streetlamps along all 4 loop legs, stadium-tower cluster around the
     missile silo, scaffold floodlight at the broken dish, building-corner
     running LEDs on every standoff structure we kept. The goal is "no
     building reads as a black silhouette from any camera angle." */
  _buildBaseLighting() {
    const steel = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const dark  = new THREE.MeshBasicMaterial({ color: 0x191d28 });
    const coneTex = this._makeFloodConeTexture();

    // ----- Streetlamp helper -----
    // b213: down-cast cone sprite removed. ~20 streetlamps × additive cone =
    // 20 glowing rectangles painted on the road. Now just pole + head +
    // small lens dot — the lens still reads "lamp is on" via subtle bloom.
    const addStreetlamp = (x, z, headDir) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 7.5, 5), steel);
      pole.position.set(x, -8 + 3.75, z);
      this.scene.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.65), steel);
      head.position.set(x + headDir.x * 0.6, -8 + 7.2, z + headDir.z * 0.6);
      this.scene.add(head);
      const lens = this._makeRunningLight(0xffe6a0, 0.18);
      lens.position.set(x + headDir.x * 0.85, -8 + 7.0, z + headDir.z * 0.85);
      this.scene.add(lens);
    };

    // ----- Perimeter streetlamps -----
    // Loop bounds: x = ±78, z ∈ [-90, +50]. Place lamps every 32u, alternating
    // sides where possible to avoid one-side blowout.
    // North leg (z=-90, lamps at z=-87 facing +z toward road)
    for (let x = -65; x <= 65; x += 32) {
      addStreetlamp(x, -87, { x: 0, z: 1 });
    }
    // South leg (z=+50, lamps at z=+47 facing -z toward road)
    for (let x = -65; x <= 65; x += 32) {
      addStreetlamp(x, 47, { x: 0, z: -1 });
    }
    // West leg (x=-78, lamps at x=-75 facing +x toward road)
    for (let z = -65; z <= 30; z += 32) {
      addStreetlamp(-75, z, { x: 1, z: 0 });
    }
    // East leg (x=+78, lamps at x=+75 facing -x toward road)
    for (let z = -65; z <= 30; z += 32) {
      addStreetlamp(75, z, { x: -1, z: 0 });
    }

    // ----- Stadium-light pylons around missile silo @ (0, -8, -118) -----
    // s2: re-symmetrized brackets at z=-110/-126 around the silo at z=-118
    // (was -98/-120 — bracket center sat at z=-109, 9u north of the silo).
    [[14, -110], [-14, -110], [14, -126], [-14, -126]].forEach(([px, pz]) => {
      const grp = new THREE.Group();
      grp.name = `stadium_pylon_${px}_${pz}`;
      grp.position.set(px, -8, pz);
      const pylonH = 14;
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, pylonH, 5), steel);
      pylon.position.y = pylonH / 2;
      grp.add(pylon);
      // 3 lamp heads at the top, splayed.
      // b213: per-head volumetric cone sprite REMOVED. 4 pylons × 3 cones at
      // scale 6×18 were the dominant rectangular halo column around the
      // missile silo (the "translucent box on the tower" in screenshot 3).
      // Buildings don't get real lighting from these anyway — keep the
      // head + lens so the pylon still reads as illuminated, drop the haze.
      [-0.5, 0, 0.5].forEach((spread, i) => {
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.4), dark);
        head.position.set(spread * 0.8, pylonH - 0.3, 0);
        head.lookAt(-px + spread * 0.4, pylonH - 1.0, -118 - pz);
        grp.add(head);
        const lens = this._makeRunningLight(0xfff0c8, 0.18);
        lens.position.set(spread * 0.8, pylonH - 0.5, 0);
        grp.add(lens);
      });
      // Aviation strobe at top
      const strobe = this._makeRunningLight(0xff3344, 0.18);
      strobe.position.y = pylonH + 0.7;
      strobe.userData = { rate: 1.4, phase: Math.random() * 6 };
      grp.add(strobe);
      this.standoff?.strobes.push(strobe);
      this.scene.add(grp);
    });

    // ----- Portable scaffold floodlights at broken dish -----
    // 2 yellow construction lamp stands, aimed at the broken rim
    [[-58, -30], [-66, -28]].forEach(([sx, sz]) => {
      const grp = new THREE.Group();
      grp.name = `scaffold_floodlight_${sx}_${sz}`;
      grp.position.set(sx, -8, sz);
      const tripodMat = new THREE.MeshBasicMaterial({ color: 0x3a3416 });
      // Tripod
      [0, Math.PI * 2 / 3, Math.PI * 4 / 3].forEach(theta => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.6, 4), dark);
        leg.position.set(Math.cos(theta) * 0.35, 0.7, Math.sin(theta) * 0.35);
        leg.rotation.z = -Math.cos(theta) * 0.30;
        leg.rotation.x = -Math.sin(theta) * 0.30;
        grp.add(leg);
      });
      // Vertical pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 4), dark);
      pole.position.y = 1.3;
      grp.add(pole);
      // Lamp head (yellow)
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.40, 0.32), tripodMat);
      head.position.y = 2.5;
      head.lookAt(-70 - sx, -8 + 4 - 0.5, -38 - sz);
      grp.add(head);
      const lens = this._makeRunningLight(0xfff0c8, 0.18);
      const dxd = -70 - sx, dzd = -38 - sz;
      const distd = Math.hypot(dxd, dzd);
      const dirXd = dxd / distd, dirZd = dzd / distd;
      lens.position.set(dirXd * 0.25, 2.5, dirZd * 0.25);
      grp.add(lens);
      // b213: 3-step volumetric cone chain at broken-dish scaffold removed
      // — that's the bright orange disc near the deepsea host the user
      // flagged. Lens dot remains.
      this.scene.add(grp);
    });

    // ----- Distant-tower base LEDs -----
    // Standoff comm tower (38, 44) and (-12, 62) — already have lit cabin
    // windows from the rebuilt _buildCommTower. Add a low ground-marker pair
    // at the base of each so the foot reads from camera too.
    [[38, 44], [-12, 62], [58, 58]].forEach(([tx, tz]) => {
      [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(theta => {
        const led = this._makeRunningLight(0xff3344, 0.10);
        led.position.set(tx + Math.cos(theta) * 1.4, -8 + 0.30, tz + Math.sin(theta) * 1.4);
        this.scene.add(led);
      });
    });
  },

  /* ---------- b171: Focused volumetric flood beams ON major structures ----
     b169 added uplight halo SPRITES at building bases — those produced a
     glow column but didn't actually illuminate the structure. This adds
     focused VOLUMETRIC CONES aimed AT the structure body (silo/dish/etc)
     so they read as lit, not silhouetted. */
  _buildBuildingFloodBeams() {
    // b213: volumetric-beam cone sprites + hit-glow at target REMOVED.
    // Sprites always face camera, so the 4 cone-step stack read as a
    // glowing rectangular column up the building (the "translucent box
    // around the tower" the user flagged). Hit-glow at the target was a
    // bright additive dot painted on each building face, which bloom then
    // smeared into a colored halo. Buildings use MeshBasicMaterial so the
    // beams never illuminated anything anyway — they were pure decoration.
    // Now: keep the spotlight fixture (real geometry, suggests purpose)
    // + a small "lens on" dot at the source so it reads as an active fixture.
    // No additive cone column, no painted hit-glow on the target.
    const addBeam = (sx, sz, tx, ty, tz, _scaleY, _scaleX, color = 0xffe6a0, _opacity) => {
      const fixt = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.4, 0.5),
        new THREE.MeshBasicMaterial({ color: 0x2a3142 }),
      );
      fixt.position.set(sx, -8 + 0.2, sz);
      fixt.lookAt(tx, ty, tz);
      this.scene.add(fixt);
      // b214: lens dot opacity 0.16 → 0.08. ~22 of these scattered around
      // the base, each blooms into a small halo that aggregates into haze.
      const lens = this._makeRunningLight(color, 0.08);
      lens.position.set(sx, -8 + 0.30, sz);
      this.scene.add(lens);
    };

    // b193 v2 — beams aim at new v2 panel host positions.
    // Beams onto the central dish (multiple angles to really light it up)
    addBeam( 30, -95, 15,  4, -110, 18, 7, 0xfff0c8, 0.40);
    addBeam(  0, -95, 15,  4, -110, 18, 7, 0xfff0c8, 0.40);
    addBeam(-15, -95, 15,  4, -110, 18, 7, 0xffd9a4, 0.34);
    // Beams onto the missile silo @ (0, -8, -118) — galaxy hero (s2: silo z
    // canonical is -118; old -107 sources were 11u north of target.)
    addBeam(-12, -110, 0, 6, -118, 16, 7, 0xffaa55, 0.50);
    addBeam( 12, -110, 0, 6, -118, 16, 7, 0xffaa55, 0.50);
    addBeam(  0, -130, 0, 6, -118, 14, 6, 0xffd9a4, 0.40);
    // Beams onto comms array shed (dim host) @ (-26, -8, -70)
    addBeam(-12, -62, -26, 4, -70, 12, 5, 0xb8d4ff, 0.32);
    addBeam(-40, -62, -26, 4, -70, 12, 5, 0xb8d4ff, 0.32);
    // Beams onto forward ops radar (livwall) @ (26, -8, -70)
    addBeam( 12, -62,  26, 4, -70, 12, 5, 0xfff0c8, 0.34);
    addBeam( 40, -62,  26, 4, -70, 12, 5, 0xfff0c8, 0.34);
    // Beams onto SIGINT tower (freq) @ (-43, -8, -48)
    addBeam(-30, -34, -43, 8, -48, 14, 4, 0xb8d4ff, 0.32);
    addBeam(-56, -34, -43, 8, -48, 14, 4, 0xb8d4ff, 0.32);
    // Beams onto logistics yard (tape) @ (43, -8, -48)
    addBeam( 30, -34,  43, 4, -48, 12, 5, 0xfff0c8, 0.36);
    addBeam( 56, -34,  43, 4, -48, 12, 5, 0xffaa55, 0.32);
    // Beams onto BROKEN DISH (deepsea) @ (-70, -8, -38) — magenta-pink hazard tint
    addBeam(-58, -50, -70, 8, -38, 16, 6, 0xff66aa, 0.40);
    addBeam(-82, -28, -70, 8, -38, 16, 6, 0xff66aa, 0.40);
    // Beams onto sensor pylon (neural) @ (66, -8, -35)
    addBeam( 56, -22,  66, 4, -35, 12, 4, 0x88ddff, 0.30);
    // Beams onto biostation (organism) @ (-42, -8, +42) — pink for grow lights
    addBeam(-30,  30, -42, 4,  42, 10, 4, 0xff5fa8, 0.28);
    // Beam onto wall billboard @ (42, -8, +42)
    addBeam( 30,  30,  42, 4,  42, 10, 4, 0xb8d4ff, 0.28);
    // Beams onto the standoff back-right dish (silhouette only)
    addBeam( 50,  46,  58, 8,  58, 16, 6, 0xff99cc, 0.35);
    addBeam( 66,  46,  58, 8,  58, 16, 6, 0xff99cc, 0.35);
    // Beam onto the fuel depot (b214: depot moved 72→62)
    addBeam( 50,   0, 62, 4,   8, 12, 5, 0xfff0c8, 0.32);
    // Beams onto pelican pad (SE airfield) @ (50, -8, +30)
    addBeam( 38,  18,  50, 2,  30, 10, 5, 0xfff0c8, 0.32);
    addBeam( 62,  18,  50, 2,  30, 10, 5, 0xfff0c8, 0.32);
  },

  /* ---------- b173: pre-build every panel-host body up-front, so panel
     mounts only add trim. Lets the panel remap (option A) move panels off
     buildings without losing the building itself. */
  _buildAllStructures() {
    // b193: pruned to ONLY the structures still referenced by v2 hosts.
    // The v2 panel hosts (`_buildPanelHost`) build their own complete
    // chassis inline — no longer depend on these big bodies — so most
    // of the b173-b187 ensure list is gone. Missile silo stays because
    // the galaxy host still calls _buildMissileSite() for its launch
    // pad + gantry + sandbags; it's just placed at the new dead-axis
    // hero position now. The _build* methods of the removed kinds
    // (cmdbunker, radarbuilding, vehiclebay, barracksbig, supplydepot,
    // commtowerbig, helipad) stay in the file as deadcode — pruned
    // in a follow-up cleanup pass.
    this._builtBuildings ??= new Set();
    const ensure = (kind, fn) => {
      if (this._builtBuildings.has(kind)) return;
      this._builtBuildings.add(kind);
      fn.call(this);
    };
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

    // b193 v2: window grids on the v2 panel-host bodies. The grids face the
    // camera (lookAt origin) so they're always visible when looking outward
    // from the deck. Positions match the new radial layout.
    // Forward ops radar (livwall) @ (26, -8, -70). Big body, side window strip.
    addGrid(26 - 5.5, -8 + 3.0, -70, 6, 2.4, cam, 4, 2);
    addGrid(26 + 5.5, -8 + 3.0, -70, 6, 2.4, cam, 4, 2);
    // Comms array shed (dim) @ (-26, -8, -70). Compact side window.
    addGrid(-26 - 2.5, -8 + 1.8, -70, 3, 1.6, cam, 3, 1);
    // SIGINT tower (freq) base trailers @ (-43, -8, -48): trailer side strip
    addGrid(-43 - 4.0, -8 + 1.4, -48, 3, 1.0, cam, 3, 1);
    addGrid(-43 + 4.0, -8 + 1.4, -48, 3, 1.0, cam, 3, 1);
    // Logistics yard (tape) @ (43, -8, -48). Container side strip.
    addGrid(43 + 4.5, -8 + 2.0, -48, 5, 1.6, cam, 4, 1);
    // Biostation (org) @ (-42, -8, +42). Side wall lit windows (faint).
    addGrid(-42 - 3.5, -8 + 2.0, 42, 4, 1.2, cam, 3, 1);
    // Standoff bunker @ (-58, -8, +10) — kept in standoff
    addGrid(-58, -8 + 2.0, 10 + 3.0, 4, 1.4, cam, 3, 1);

    // Wall-mounted exterior lamps along big buildings (warm cone splash)
    const lampCone = this._makeFloodConeTexture();
    const addLamp = (x, y, z, dir = -1) => {
      // Lamp fixture
      const f = new THREE.Mesh(
        new THREE.BoxGeometry(0.20, 0.14, 0.22),
        new THREE.MeshBasicMaterial({ color: 0x2a3142 }),
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
    // b193 v2: lamps on the v2 panel-host bodies (faces camera-side).
    // Forward ops radar (livwall) @ (26, -8, -70): 3 lamps along top of front face
    [-3.6, 0, 3.6].forEach(xo => addLamp(26 + xo, -8 + 5 - 0.2, -70 + 0.15, 1));
    // Comms array shed (dim) @ (-26, -8, -70): 2 lamps
    [-1.8, 1.8].forEach(xo => addLamp(-26 + xo, -8 + 3.6 - 0.2, -70 + 0.15, 1));
    // SIGINT tower (freq) base @ (-43, -8, -48): 2 lamps at trailer height
    [-3.6, 3.6].forEach(xo => addLamp(-43 + xo, -8 + 1.8, -48 + 0.15, 1));
    // Logistics yard (tape) @ (43, -8, -48): 2 lamps on top container front
    [-2, 2].forEach(xo => addLamp(43 + xo, -8 + 6 - 0.2, -48 + 4.5 + 0.15, 1));
    // Missile silo @ (0, -8, -107): 3 lamps along control bunker (b214: silo pushed back)
    [-3, 0, 3].forEach(xo => addLamp(0 + xo, -8 + 6.5, -101 + 0.15, 1));
    // Biostation (org) @ (-42, -8, +42): 2 lamps
    [-2, 2].forEach(xo => addLamp(-42 + xo, -8 + 4.0 - 0.2, 42 + 0.15, 1));
    // Wall billboard @ (42, -8, +42): 2 lamps at base
    [-2, 2].forEach(xo => addLamp(42 + xo, -8 + 4.0, 42 + 0.15, 1));
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
    // b193: pelican pad relocated SE airfield at (50, -8, 30). Pelican on top
    // at y=-8 + padH(1.2) + 1.8 = -5.0. The host pad's grp.rotation.y = -0.6
    // angles cockpit toward NE corridor — these light positions stay in
    // unrotated world coords, since they're offsets approximating the parked
    // pelican silhouette and look fine within ~30° rotation tolerance.
    const padX = 50, padY = -8, padZ = 30;
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
    const standDark = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const coneTex = this._makeFloodConeTexture();
    const standPositions = [
      { x: padX - 11, z: padZ + 1, color: 0xfff0c8 },
      { x: padX + 11, z: padZ + 1, color: 0xfff0c8 },
      { x: padX - 8,  z: padZ + 9, color: 0xfff0c8 },
      { x: padX + 8,  z: padZ + 9, color: 0xfff0c8 },
    ];
    standPositions.forEach((s, i) => {
      const grp = new THREE.Group();
      grp.name = `pelican_floodlight_${i}`;
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
      const lens = this._makeRunningLight(s.color, 0.18);
      const dirToPel = new THREE.Vector3(padX - s.x, pelY - (padY + 2.5), padZ - s.z).normalize();
      lens.position.set(dirToPel.x * 0.20, 2.5 + dirToPel.y * 0.20, dirToPel.z * 0.20);
      grp.add(lens);
      // b213: 3-step volumetric cone chain to pelican removed.
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
    // b193: pelican pad relocated from (-2, +24) to SE airfield (50, +30)
    const padX = 50, padZ = 30;
    const pelY = -8 + 3.0;
    const ground = -8;

    const armor = new THREE.MeshBasicMaterial({ color: 0x363c2c });        // ODST dark olive
    const armorHi = new THREE.MeshBasicMaterial({ color: 0x42493a });      // shoulder/chest plate accent
    const visorRim = new THREE.MeshBasicMaterial({ color: 0x1d2230 });     // helmet shell
    const glove = new THREE.MeshBasicMaterial({ color: 0x2a3142 });

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
    e1.name = 'engineer_kneeling';
    e1.position.set(padX + 1.6, ground + 1.2, padZ - 6.0);  // slightly elevated on the pad
    e1.rotation.y = -Math.PI / 4;
    this.scene.add(e1);
    // Engineer 2 — standing, holding clipboard, at left rear of pelican
    const e2 = buildEngineer(false);
    e2.name = 'engineer_clipboard';
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
    e3.name = 'engineer_inspector';
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
    const oliveD = new THREE.MeshBasicMaterial({ color: 0x3a4030 });
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
    const cluster = (cx, cz, jitterRot = 0, tag = '') => {
      const layout = [
        { dx:  0,    dz:  0,    yaw:  0.05 },
        { dx: -5.2,  dz:  1.6,  yaw: -0.18 },
        { dx:  5.4,  dz: -1.4,  yaw:  0.22 },
      ];
      layout.forEach((spec, i) => {
        const tent = this._makeTent(4.0, 5.5, 2.4);
        tent.name = `tent_${tag || cx + '_' + cz}_${i}`;
        tent.position.set(cx + spec.dx, -8, cz + spec.dz);
        tent.rotation.y = spec.yaw + jitterRot;
        this.scene.add(tent);
      });
    };
    // b193: bivouac re-anchored to the v2 layout. Old west cluster sat in
    // the new SIGINT-tower lane; old east cluster sat in the new logistics
    // approach. Pulled tents inward to a clean band south of camera (the
    // back-of-house "bivouac" zone in BASEMAP.md), one cluster offset NW
    // and another NE so the tents read as a long base camp behind the deck.
    // b214: SE bivouac was sitting at (22,16) inside the motor pool spread
    // — tents, hogs, scorpion all clustered in the same 12u square. Pulled
    // west to (8,24) so the bivouac and the airfield read as separate zones.
    cluster(-26,  20, 0.18, 'sw_bivouac');   // SW bivouac (clear of biostation @ -42,+42)
    cluster(  8,  24, -0.20, 'se_bivouac');  // SE bivouac (clear of motor pool x∈[32,50])
    // Removed N bivouac — now overlapped by the new comms-array shed and
    // missile silo at the deeper N positions.
  },

  _buildPersonnel() {
    this.personnel = [];
    const olive  = new THREE.MeshBasicMaterial({ color: 0x4a5238 });
    const skin   = new THREE.MeshBasicMaterial({ color: 0xb89072 });
    const dark   = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
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

    // b193 v2 walking routes. Anchored to the new v2 panel hosts so the
    // base reads as occupied and trafficked between the actual buildings.
    const routes = [
      // Bivouac → forward ops cluster (b214: bivouac coords updated)
      { from: [-26, 20], to: [-26, -64], speed: 1.7 },  // SW bivouac → comms array shed
      { from: [  8, 24], to: [ 26, -64], speed: 1.7 },  // SE bivouac → forward ops bunker
      // Cross-base inspection sweeps
      { from: [-30, -42], to: [ 30, -42], speed: 2.0 }, // forward cross-road E↔W
      { from: [-26, 20], to: [  8, 24], speed: 1.6 },   // SW ↔ SE bivouac
      // Tape-spine logistics yard ↔ pelican pad (crew loading dock walk)
      { from: [ 43, -42], to: [ 50, 24], speed: 1.5 },
      // Sigint tower ↔ broken-dish (engineers walking to repair)
      { from: [-43, -42], to: [-66, -32], speed: 1.4 },
      // Galaxy hero ground crew (around launch pad perimeter, b214: silo at z=-107)
      { from: [-10, -98], to: [ 10, -98], speed: 1.3 },
      // Sensor pylon ↔ logistics
      { from: [ 60, -32], to: [ 48, -44], speed: 1.6 },
    ];
    routes.forEach((r, i) => {
      const fig = makeFigure();
      fig.name = `personnel_${i}`;
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
    const dark = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const tread = new THREE.MeshBasicMaterial({ color: 0x1d2230 });

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

  /* ---------- s18: Shadow Moses-style VTOL hangar + parked Hind ----
     Big Alaskan-base hangar in the far-NW empty desert past nw_radio_shack.
     Steel-and-concrete construction, twin sliding bay doors (closed but
     with a vertical seam glow showing interior is lit), three lit window
     rows on the upper office level, roof exhaust ducts, comm antenna, red
     aviation strobe. A Hind-D silhouette is parked on the apron in front,
     hint of MGS1 cold-war espionage. */
  _buildVtolHangar() {
    const concrete = new THREE.MeshBasicMaterial({ color: 0x363c4a });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x4a5468 });
    const steel = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const steelLit = new THREE.MeshBasicMaterial({ color: 0x3a4258 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x191d28 });
    const yellow = new THREE.MeshBasicMaterial({ color: 0x6a5618 });
    const winGlow = (op) => new THREE.MeshBasicMaterial({
      color: 0xffaa55, transparent: true, opacity: op,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });

    const grp = new THREE.Group();
    grp.name = 'vtol_hangar';
    grp.position.set(-95, -8, -132);
    grp.rotation.y = Math.PI * 0.18;  // angled toward the base center

    // ----- Main hangar shell — wide concrete box with a metal arched roof
    const hW = 22, hH = 9, hD = 16;
    const shell = new THREE.Mesh(new THREE.BoxGeometry(hW, hH, hD), concrete);
    shell.position.set(0, hH / 2, 0);
    shell.name = 'vtol_hangar_shell';
    grp.add(shell);
    // Arched steel roof on top (half-cylinder rotated)
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(hW / 2, hW / 2, hD + 0.4, 24, 1, false, 0, Math.PI),
      steelLit,
    );
    roof.rotation.x = Math.PI / 2;
    roof.rotation.z = Math.PI / 2;
    roof.position.set(0, hH, 0);
    grp.add(roof);

    // ----- Twin bay doors on the camera-facing front face -----
    // Each door is a tall steel rectangle with horizontal ribs. A vertical
    // glowing seam down the centerline hints "interior is lit, doors closed."
    [-1, 1].forEach(side => {
      const dW = hW / 2 - 0.4, dH = hH * 0.78;
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(dW, dH, 0.25),
        steel,
      );
      door.position.set(side * (dW / 2 + 0.1), dH / 2, hD / 2 + 0.05);
      door.name = `vtol_bay_door_${side > 0 ? 'r' : 'l'}`;
      grp.add(door);
      // Horizontal ribs across the door (5 ribs)
      for (let r = 1; r <= 5; r++) {
        const rib = new THREE.Mesh(
          new THREE.BoxGeometry(dW * 0.96, 0.10, 0.06),
          steelLit,
        );
        rib.position.set(side * (dW / 2 + 0.1), dH * (r / 6), hD / 2 + 0.20);
        grp.add(rib);
      }
      // Yellow caution stripes on door edges
      const stripeEdge = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, dH, 0.06),
        yellow,
      );
      stripeEdge.position.set(side * (dW + 0.06), dH / 2, hD / 2 + 0.22);
      grp.add(stripeEdge);
    });
    // Vertical glowing seam down centerline of the closed doors (interior glow leaking out)
    const seam = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, hH * 0.74),
      winGlow(0.95),
    );
    seam.position.set(0, hH * 0.39, hD / 2 + 0.30);
    seam.userData = { rate: 5.0, phase: Math.random() * 6, baseOpacity: 0.95 };
    grp.add(seam);
    this.standoff?.windows.push(seam);

    // ----- Upper-level office windows on the front face (above the bay doors) -----
    for (let i = 0; i < 5; i++) {
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 0.7),
        winGlow(0.78),
      );
      win.position.set(-hW / 2 + 2.4 + i * (hW - 4.8) / 4, hH * 0.88, hD / 2 + 0.05);
      win.userData = { rate: 4.2 + i * 0.3, phase: Math.random() * 6, baseOpacity: 0.78 };
      grp.add(win);
      this.standoff?.windows.push(win);
    }
    // Yellow caution stripe under the office windows
    const officeStripe = new THREE.Mesh(
      new THREE.BoxGeometry(hW * 0.9, 0.14, 0.06),
      yellow,
    );
    officeStripe.position.set(0, hH * 0.74, hD / 2 + 0.08);
    grp.add(officeStripe);

    // ----- Vertical concrete ribs framing the bay doors -----
    [-hW / 2, 0, hW / 2].forEach(xo => {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.45, hH, 0.35), concreteLit);
      rib.position.set(xo, hH / 2, hD / 2 + 0.18);
      grp.add(rib);
    });

    // ----- Roof exhaust ducts (MGS-style industrial venting) -----
    [-hW * 0.30, 0, hW * 0.30].forEach((xo, idx) => {
      const duct = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 1.4, 1.6),
        steelLit,
      );
      duct.position.set(xo, hH + 1.0, -hD * 0.20);
      duct.name = `vtol_hangar_vent_${idx}`;
      grp.add(duct);
      // Stack pipe out the top
      const stack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.30, 0.35, 1.8, 8),
        steel,
      );
      stack.position.set(xo, hH + 2.6, -hD * 0.20);
      grp.add(stack);
      // Stack cap
      const stackCap = new THREE.Mesh(
        new THREE.ConeGeometry(0.45, 0.30, 8),
        steel,
      );
      stackCap.position.set(xo, hH + 3.65, -hD * 0.20);
      grp.add(stackCap);
      // Louvre vent face
      const louvre = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 1.2),
        dark,
      );
      louvre.position.set(xo, hH + 1.0, -hD * 0.20 + 0.82);
      grp.add(louvre);
    });

    // ----- Comm/radar antenna on the roof -----
    const antPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 5.5, 5),
      steel,
    );
    antPole.position.set(hW * 0.36, hH + 2.75, hD * 0.20);
    grp.add(antPole);
    const antDish = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
      steelLit,
    );
    antDish.rotation.x = -Math.PI * 0.42;
    antDish.position.set(hW * 0.36, hH + 5.3, hD * 0.20);
    antDish.name = 'vtol_hangar_dish';
    grp.add(antDish);
    // Cross bars on the antenna
    for (let h = 1.5; h < 5; h += 1.2) {
      const xbar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4),
        steel,
      );
      xbar.rotation.z = Math.PI / 2;
      xbar.position.set(hW * 0.36, hH + h, hD * 0.20);
      grp.add(xbar);
    }
    // Aviation strobe at the top
    const topStrobe = this._makeRunningLight(0xff3344, 0.55);
    topStrobe.position.set(hW * 0.36, hH + 5.7, hD * 0.20);
    topStrobe.userData = { rate: 1.6, phase: Math.random() * 6 };
    grp.add(topStrobe);
    this.standoff?.strobes.push(topStrobe);

    // ----- Concrete loading apron in front of the bay doors -----
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(hW + 4, 0.16, 12),
      concreteLit,
    );
    apron.position.set(0, 0.08, hD / 2 + 6);
    apron.name = 'vtol_apron';
    grp.add(apron);
    // Painted center stripes leading to the doors
    [-1, 1].forEach(side => {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.40, 0.02, 10),
        new THREE.MeshBasicMaterial({ color: 0xc6c2a8 }),
      );
      stripe.position.set(side * hW * 0.20, 0.17, hD / 2 + 6);
      grp.add(stripe);
    });
    // Yellow apron edge stripe
    const apronStripe = new THREE.Mesh(
      new THREE.BoxGeometry(hW + 4, 0.06, 0.20),
      yellow,
    );
    apronStripe.position.set(0, 0.18, hD / 2 + 12);
    grp.add(apronStripe);

    // ----- Parked Hind-D silhouette on the apron (MGS1 iconic) -----
    const hind = this._buildHind();
    hind.position.set(hW * 0.25, 0, hD / 2 + 7.5);
    hind.rotation.y = Math.PI * 0.85;  // angled across the apron
    hind.name = 'parked_hind';
    grp.add(hind);

    // ----- 2 floodlight poles framing the apron -----
    [-1, 1].forEach((side, idx) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.18, 8, 5),
        steel,
      );
      pole.position.set(side * (hW / 2 + 2.5), 4, hD / 2 + 4);
      grp.add(pole);
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.50, 0.30, 0.60),
        steelLit,
      );
      head.position.set(side * (hW / 2 + 2.5) - side * 0.6, 7.8, hD / 2 + 4.4);
      grp.add(head);
      const lens = this._makeRunningLight(0xfff0c8, 0.28);
      lens.position.set(side * (hW / 2 + 2.5) - side * 0.9, 7.7, hD / 2 + 4.7);
      grp.add(lens);
    });

    // ----- Exhaust pipes on the side wall (MGS industrial detail) -----
    [-1, 1].forEach(side => {
      // Vertical exhaust pipe running up the side
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, hH * 0.85, 8),
        steel,
      );
      pipe.position.set(side * (hW / 2 + 0.25), hH * 0.43, -hD * 0.30);
      grp.add(pipe);
      // Output cap angled outward
      const exitElbow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.20, 0.24, 1.0, 8),
        steel,
      );
      exitElbow.rotation.z = side * Math.PI * 0.30;
      exitElbow.position.set(side * (hW / 2 + 0.7), hH * 0.85, -hD * 0.30);
      grp.add(exitElbow);
    });

    this.scene.add(grp);
  },

  /* ---------- Hind-D helicopter (parked) — simplified silhouette ---- */
  _buildHind() {
    const olive = new THREE.MeshBasicMaterial({ color: 0x2a3018 });
    const oliveHi = new THREE.MeshBasicMaterial({ color: 0x3a4022 });
    const steel = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x191d28 });

    const g = new THREE.Group();
    // Main fuselage (long and lean, MGS1-style)
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 9.0), olive);
    body.position.y = 1.6;
    g.add(body);
    // Tapered nose (cockpit canopy)
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.2, 1.8),
      oliveHi,
    );
    nose.position.set(0, 1.85, -4.8);
    g.add(nose);
    // Cockpit glass (warm interior glow)
    const cockpit = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.7),
      new THREE.MeshBasicMaterial({
        color: 0xffaa55, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    cockpit.position.set(0, 2.25, -5.75);
    cockpit.rotation.x = -0.15;
    g.add(cockpit);
    // Stub wings with weapon hardpoints (Hind iconic)
    [-1, 1].forEach(side => {
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.20, 1.6),
        oliveHi,
      );
      wing.position.set(side * 1.8, 1.6, -0.5);
      wing.rotation.z = side * 0.05;  // slight anhedral
      g.add(wing);
      // Rocket pod (cylinder hanging off the wingtip)
      const pod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.30, 0.30, 1.6, 10),
        steel,
      );
      pod.rotation.x = Math.PI / 2;
      pod.position.set(side * 2.9, 1.35, -0.5);
      g.add(pod);
    });
    // Tail boom (extending back from main body)
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 5.0),
      olive,
    );
    tail.position.set(0, 1.7, 6.5);
    g.add(tail);
    // Vertical tail fin
    const tailFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 1.8, 1.6),
      oliveHi,
    );
    tailFin.position.set(0, 2.6, 8.5);
    g.add(tailFin);
    // Tail rotor (small disc, vertical)
    const tailRotor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 0.06, 16),
      dark,
    );
    tailRotor.rotation.z = Math.PI / 2;
    tailRotor.position.set(0.30, 2.6, 9.1);
    g.add(tailRotor);
    // Main rotor mast + blades (parked, blades drooping)
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 0.9, 8),
      steel,
    );
    mast.position.set(0, 2.85, 0);
    g.add(mast);
    const rotorHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.16, 12),
      steel,
    );
    rotorHub.position.set(0, 3.30, 0);
    g.add(rotorHub);
    // 5 blades drooping at ~5° (parked)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.08, 6.5),
        dark,
      );
      blade.position.set(Math.cos(a) * 3.0, 3.25, Math.sin(a) * 3.0);
      blade.rotation.y = a + Math.PI / 2;
      blade.rotation.x = 0.07;  // slight droop
      g.add(blade);
    }
    // Landing skids/wheels — 3 small wheels (one nose, two main)
    const wheelMat = dark;
    [[-0.85, -3.0], [0.85, -3.0], [0, -4.0]].forEach(([wx, wz]) => {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.30, 0.30, 0.25, 10),
        wheelMat,
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.30, wz);
      g.add(wheel);
      // Strut up to body
      const strut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.7, 4),
        steel,
      );
      strut.position.set(wx, 0.80, wz);
      g.add(strut);
    });
    // Nav lights — port red, starboard green, tail white
    const navL = this._makeRunningLight(0xff3344, 0.18);
    navL.position.set(-2.9, 1.35, -0.5);
    g.add(navL);
    const navR = this._makeRunningLight(0x33ff66, 0.18);
    navR.position.set(2.9, 1.35, -0.5);
    g.add(navR);
    const navTail = this._makeRunningLight(0xffffff, 0.16);
    navTail.position.set(0, 2.8, 9.6);
    navTail.userData = { rate: 1.4, phase: Math.random() * 6 };
    g.add(navTail);

    return g;
  },

  _buildScorpions() {
    // b193: parked Scorpion moved with the rest of the motor pool from
    // (40, -38) — sat in the v2 logistics-yard host — to a spot south of
    // the SE airfield, "heavy" of the airfield ground vehicles.
    // b214: pulled west from (28,16) so the tank doesn't crowd the parked
    // Warthogs (now at z=8/12/22) — sits at the airfield's west edge.
    const parked = this._buildScorpionMesh();
    parked.name = 'scorpion_parked';
    parked.position.set(22, -8, 14);
    parked.rotation.y = Math.PI * 0.65;
    this.scene.add(parked);

    // b182: tank patrols the SAME perimeter loop as the Warthog, but
    // CLOCKWISE and offset by half a loop so the two vehicles read as
    // coordinated patrol — they meet on opposite sides of the base.
    const mover = this._buildScorpionMesh();
    mover.name = 'scorpion_patrol';
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
    // b193: back-LEFT standoff dish removed — replaced by `_buildBrokenDish`
    // (deepsea panel host, dramatic damaged variant placed at a similar
    // bearing but at the v2 panel coords). Back-right kept as silhouette.
    this._buildDish( 58, -8,  58, 11, 0xff3344, 1.2);   // back-right, red strobe

    // Comm towers — tall lattice, blinking aviation strobes
    // b193: trimmed comm towers that sat in the v2 panel zones (NW & NE).
    // Kept the rear/back ones for the silhouette ring.
    this._buildCommTower( 38, -8,  44, 22, 0xff3344);   // back-right of camera
    this._buildCommTower(-12, -8,  62, 18, 0xff3344);   // due-rear
    // Removed: (-46, -28) sat 5u from the new freqmap host @ (-43, -48); too close
    // Removed: (48, -22) sat in the new tape spine zone

    // Low bunker silhouettes with warm interior window glow
    // b193: removed (42, -38) — sat in the new tape-spine corridor.
    // Removed (-30, +48) — sat ON the south perimeter road.
    this._buildBunker(-58, -8,  10, 6, 3.0, 6, 0xffaa55);   // SW silhouette only

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
    // b227 sized too far back (180/240) — ridges visually disappeared from
    // ridge POI, fog blended them past the readable horizon line. Pulled in
    // to 145/200: near ring just outside the N-S axis fence at z=±142,
    // axis-aligned outer fence at x=±125 sits inside the silhouette. Heights
    // bumped (7→11 / 16→24) so the horizon reads as substantial mountains
    // not pancake bumps. Inner-fence diagonal corners (~169) poke past the
    // near ridge silhouette — acceptable since corners sit far back-left/
    // back-right and read as "fence in front of mountain" at most.
    buildRing(112, 145, 18, 11, 14, 0x080a12);  // near ridge
    buildRing( 72, 200, 22, 24, 18, 0x040611);  // far ridge — taller, darker

    // b177: aviation beacons sprinkled along the near ridgeline so the
    // background isn't pitch-black void. 14 strobes around the full 360°,
    // alternating red/amber/cyan, perched on top of the ridge silhouette.
    // Heights vary between 7..12u (above the ridge top of ~6) so they
    // read as standing comms masts on distant peaks.
    const beaconColors = [0xff3344, 0xffaa55, 0x4488ff];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.10;
      const r = 145 + (Math.sin(a * 2.3) + Math.sin(a * 5.7 + 0.8)) * 5.0 + Math.random() * 9;
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
      const r = 200 + (Math.random() - 0.5) * 28;
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
    grp.name = `dish_${x}_${z}`;
    grp.position.set(x, y, z);
    grp.userData.baseYaw = baseYaw;
    grp.rotation.y = baseYaw;
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x3a3e4a });
    const accentMat = new THREE.MeshBasicMaterial({ color: 0x2c303a });
    const struMat = new THREE.MeshBasicMaterial({ color: 0x0e1118 });

    // Concrete plinth/platform
    const plinthH = 2.4;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(8, plinthH, 8), accentMat);
    plinth.position.y = plinthH / 2;
    grp.add(plinth);
    // b201: lit operator-room windows on the plinth — 1 per face — so
    // the dish base reads as occupied even from the far side of the base.
    const winMat = new THREE.MeshBasicMaterial({
      color: 0xffaa55, transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(theta => {
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 0.55),
        winMat.clone(),
      );
      win.position.set(Math.cos(theta) * 4.05, plinthH * 0.62, Math.sin(theta) * 4.05);
      win.lookAt(
        Math.cos(theta) * 100,
        plinthH * 0.62,
        Math.sin(theta) * 100,
      );
      win.userData = { rate: 4.0 + Math.random(), phase: Math.random() * 6, baseOpacity: 0.75 };
      this.standoff?.windows.push(win);
      grp.add(win);
    });
    // 4 corner running lights on the plinth top
    [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sz]) => {
      const led = this._makeRunningLight(0xffe6a0, 0.18);
      led.position.set(sx * 3.95, plinthH + 0.30, sz * 3.95);
      grp.add(led);
    });
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
    const dishMat = new THREE.MeshBasicMaterial({ color: 0x32384a, side: THREE.DoubleSide });
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

  /* ---------- b193: BROKEN DISH (deepsea panel host) ----------
     Damaged parabolic dish replacing the back-left standoff dish. Built
     as a complete parabola but with a chunk of the east rim *missing*
     (clipped sphere section) + a sagging fragment hanging by a single
     truss + scaffold prop + hazard cones + sparking sprite at the
     break point. Marks the gap position on `standoff.brokenDishGap`
     so future flyby code (b196) can detour Longswords through it.
     World position: (-66, -8, -35) — adjacent to the deepsea panel
     billboard at (-66, 8, -35). */
  _buildBrokenDish() {
    const grp = new THREE.Group();
    grp.name = 'broken_dish_geom';
    const x = -70, y = -8, z = -38;
    grp.position.set(x, y, z);
    const baseYaw = Math.atan2(-x, -z);  // face origin
    grp.userData.baseYaw = baseYaw;
    grp.rotation.y = baseYaw;

    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x3a3e4a });
    const accentMat = new THREE.MeshBasicMaterial({ color: 0x2c303a });
    const struMat = new THREE.MeshBasicMaterial({ color: 0x0e1118 });
    const yellow = new THREE.MeshBasicMaterial({ color: 0x6a5618 });
    const brokenSteel = new THREE.MeshBasicMaterial({ color: 0x4a3225 });  // burnt/rusted

    const dishR = 10;

    // Concrete plinth/platform
    const plinthH = 2.4;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(8, plinthH, 8), accentMat);
    plinth.position.y = plinthH / 2;
    grp.add(plinth);
    const step = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.6, 6.5), bodyMat);
    step.position.y = plinthH + 0.3;
    grp.add(step);
    // b201: lit operator/equipment windows on the plinth — fault-tinted
    // (more red, less amber) so it reads as a damaged-but-still-occupied
    // facility. Each side face gets a window.
    const plinthWinMat = new THREE.MeshBasicMaterial({
      color: 0xff7755, transparent: true, opacity: 0.65,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(theta => {
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 0.50),
        plinthWinMat.clone(),
      );
      win.position.set(Math.cos(theta) * 4.05, plinthH * 0.60, Math.sin(theta) * 4.05);
      win.lookAt(
        Math.cos(theta) * 100,
        plinthH * 0.60,
        Math.sin(theta) * 100,
      );
      win.userData = { rate: 5.5 + Math.random(), phase: Math.random() * 6, baseOpacity: 0.65, fault: true };
      this.standoff?.windows.push(win);
      grp.add(win);
    });
    // 4 corner running lights on the plinth (red — fault status)
    [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sz]) => {
      const led = this._makeRunningLight(0xff3344, 0.16);
      led.position.set(sx * 3.95, plinthH + 0.30, sz * 3.95);
      grp.add(led);
    });

    // Pedestal column
    const colH = 5.2;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, colH, 10), bodyMat);
    ped.position.y = plinthH + 0.6 + colH / 2;
    grp.add(ped);

    // Yoke — TILTED in damage (the dish couldn't slew level any more)
    const yokeY = plinthH + 0.6 + colH + 0.5;
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.9, 1.2), bodyMat);
    yoke.position.y = yokeY;
    yoke.rotation.z = 0.18;  // permanent lean
    grp.add(yoke);
    [-1.4, 1.4].forEach(sx => {
      const flange = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.8), bodyMat);
      flange.position.set(sx, yokeY + 0.5, 0);
      flange.rotation.z = 0.18;
      grp.add(flange);
    });

    // Dish — partial sphere section. We use thetaStart + thetaLength to
    // CARVE OUT the east rim (the broken part). 240° arc instead of full 360°.
    const dishTilt = -Math.PI * 0.34;
    const dishYawCarve = Math.PI * 0.65;  // start of carved section
    const dishArc = Math.PI * 1.6;        // 288° — leaves a ~72° gap in east rim
    const dishGeo = new THREE.SphereGeometry(
      dishR, 28, 18,
      dishYawCarve, dishArc,
      0, Math.PI * 0.42,
    );
    const dishMat = new THREE.MeshBasicMaterial({ color: 0x32384a, side: THREE.DoubleSide });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.set(0, yokeY + 1.0, 0);
    dish.rotation.x = dishTilt;
    dish.rotation.z = 0.18;  // matches yoke lean
    grp.add(dish);

    // Concentric ribs only across the intact arc
    for (let r = 0.30; r < 1.0; r += 0.20) {
      const ribGeo = new THREE.TorusGeometry(
        dishR * r, 0.03, 4, 36,
        dishArc,  // partial torus matching the dish arc
      );
      const rib = new THREE.Mesh(ribGeo, struMat);
      rib.position.copy(dish.position);
      rib.position.y += Math.sqrt(Math.max(0, dishR * dishR - (dishR * r) * (dishR * r))) * 0.20;
      rib.rotation.x = Math.PI / 2;
      rib.rotation.z = dishYawCarve;
      grp.add(rib);
    }
    // Outer rim — also partial
    const rimGeo = new THREE.TorusGeometry(dishR, 0.10, 5, 48, dishArc);
    const rim = new THREE.Mesh(rimGeo, struMat);
    rim.position.copy(dish.position);
    rim.rotation.x = Math.PI / 2;
    rim.rotation.z = dishYawCarve;
    grp.add(rim);

    // SAGGING FRAGMENT — a chunk of dish ripped off, hanging by a single
    // strap, dangling below the broken rim. Positioned at the gap center.
    const gapAngle = dishYawCarve + dishArc + (Math.PI * 0.4 / 2);  // middle of the missing 72°
    const gapX = Math.cos(gapAngle) * dishR;
    const gapZ = Math.sin(gapAngle) * dishR;
    const fragGroup = new THREE.Group();
    fragGroup.position.set(gapX, yokeY - 1.4, gapZ);
    fragGroup.rotation.set(0.85, gapAngle, 0.40);  // tilted/twisted
    grp.add(fragGroup);
    // Fragment plate (a small slice of curved dish material)
    const fragGeo = new THREE.SphereGeometry(
      dishR * 0.85, 14, 8,
      0, Math.PI * 0.42,
      0, Math.PI * 0.30,
    );
    const fragMat = new THREE.MeshBasicMaterial({ color: 0x2c303a, side: THREE.DoubleSide });
    const frag = new THREE.Mesh(fragGeo, fragMat);
    fragGroup.add(frag);
    // Strap holding the fragment up (single thin steel cable to rim)
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.5, 4), brokenSteel);
    strap.position.set(-1.5, 1.6, 0);
    strap.rotation.z = 0.45;
    fragGroup.add(strap);

    // Snapped support truss — a single beam jutting out where the support
    // arm broke. Burnt/rusted material.
    const snapBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.0, 6), brokenSteel);
    snapBeam.position.set(gapX * 0.5, yokeY - 0.8, gapZ * 0.5);
    snapBeam.lookAt(gapX * 1.4, yokeY + 1.6, gapZ * 1.4);
    snapBeam.rotateX(Math.PI / 2);
    grp.add(snapBeam);
    // Burnt-end charring sprite at the snap point
    const burnTex = this._makeRadialGlowTexture('rgba(255,80,40,0.85)');
    const burn = new THREE.Sprite(new THREE.SpriteMaterial({ map: burnTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
    burn.scale.set(1.2, 1.2, 1);
    burn.position.set(gapX * 0.5, yokeY - 0.8, gapZ * 0.5);
    grp.add(burn);

    // 3 scaffolding posts propping the damaged rim from below — bright
    // industrial yellow so the user reads "active repair site"
    [-1.6, 0, 1.6].forEach((offset, i) => {
      const sx = gapX * 0.7 + Math.cos(gapAngle + Math.PI / 2) * offset;
      const sz = gapZ * 0.7 + Math.sin(gapAngle + Math.PI / 2) * offset;
      const sH = yokeY - 0.5;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, sH, 4), yellow);
      post.position.set(sx, sH / 2, sz);
      grp.add(post);
      // Cross-brace at mid-height to next post
      if (i < 2) {
        const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 4), yellow);
        brace.rotation.z = Math.PI / 2;
        const bx = sx + Math.cos(gapAngle + Math.PI / 2) * 0.8;
        const bz = sz + Math.sin(gapAngle + Math.PI / 2) * 0.8;
        brace.position.set(bx, sH * 0.55, bz);
        brace.lookAt(bx + 1, sH * 0.55, bz);
        brace.rotateX(Math.PI / 2);
        grp.add(brace);
      }
    });

    // Welder pulse — additive sprite that blinks bright every ~4s on top
    // scaffold post, simulating a repair crew arc-welding. Drives off
    // standoff.windows so the existing flicker tick handles it (high rate).
    const welderTex = this._makeRadialGlowTexture('rgba(150,200,255,0.95)');
    const welder = new THREE.Sprite(new THREE.SpriteMaterial({ map: welderTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.0, color: 0xc8e0ff }));
    welder.scale.set(2.6, 2.6, 1);
    welder.position.set(gapX * 0.7, yokeY - 0.3, gapZ * 0.7);
    welder.userData = { rate: 6.0, phase: Math.random() * 6, baseOpacity: 0.65, isWelder: true };
    grp.add(welder);
    this.standoff?.windows.push(welder);

    // Continuous spark sprite at the break point (bigger, sustained
    // additive, additional small jittery point particles)
    const sparkTex = this._makeRadialGlowTexture('rgba(255,180,80,0.95)');
    const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.45, color: 0xffd070 }));
    spark.scale.set(1.6, 1.6, 1);
    spark.position.set(gapX * 0.55, yokeY - 0.4, gapZ * 0.55);
    spark.userData = { rate: 8.0, phase: Math.random() * 6, baseOpacity: 0.55, isSpark: true };
    grp.add(spark);
    this.standoff?.windows.push(spark);

    // Hazard cones around the dish base
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = 5.5;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.30, 0.85, 6), yellow);
      cone.position.set(Math.cos(a) * r, plinthH + 0.45, Math.sin(a) * r);
      grp.add(cone);
    }

    // FAULT-PATTERN aviation strobe — uses irregular rate so it reads as
    // damaged (skipping flashes vs steady cadence)
    const strobe = this._makeRunningLight(0xff3344, 0.55);
    strobe.position.set(0, yokeY + 4.5, 0);
    strobe.userData = { rate: 0.8, phase: Math.random() * 6, fault: true };
    grp.add(strobe);
    this.standoff?.strobes.push(strobe);

    // Receiver tell-tale at focal point — DEAD (very dim, no pulse)
    const tell = this._makeRunningLight(0x882244, 0.10);
    const focalY = yokeY + 1.0 + dishR * 0.55;
    tell.position.set(0, focalY, 0);
    grp.add(tell);

    this.scene.add(grp);
    this.standoff?.dishes.push(grp);

    // Mark the gap position in WORLD coords for b196 flyby-through gag.
    // `gapAngle` is local; rotate by baseYaw to get world bearing.
    const worldGapAngle = baseYaw + gapAngle;
    this.standoff.brokenDishGap = {
      x: x + Math.cos(worldGapAngle) * dishR,
      y: y + yokeY + 1.0,
      z: z + Math.sin(worldGapAngle) * dishR,
      // outward normal pointing camera-ward (will be hand-tuned in b196)
      normal: new THREE.Vector3(-Math.cos(worldGapAngle), 0, -Math.sin(worldGapAngle)),
    };
  },

  _buildCommTower(x, y, z, height, lightColor) {
    const grp = new THREE.Group();
    grp.name = `comm_tower_${x}_${z}`;
    grp.position.set(x, y, z);
    const mat = new THREE.MeshBasicMaterial({ color: 0x3a4050 });
    const accentMat = new THREE.MeshBasicMaterial({ color: 0x32384a });

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
    // b201: operator booth at the top of every standoff comm tower. Was
    // a pure-silhouette mast — now reads as a manned tower with a lit
    // 4-sided cabin facing every cardinal direction.
    const cabinH = 1.8;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(baseW * 1.1, cabinH, baseW * 1.1), accentMat);
    cabin.position.y = height - cabinH / 2 - 0.4;
    grp.add(cabin);
    const winMat = new THREE.MeshBasicMaterial({
      color: 0xffaa55, transparent: true, opacity: 0.78,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(theta => {
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(baseW * 0.85, 0.55),
        winMat.clone(),
      );
      win.position.set(
        Math.cos(theta) * (baseW * 0.56),
        height - cabinH / 2 - 0.4,
        Math.sin(theta) * (baseW * 0.56),
      );
      win.lookAt(
        Math.cos(theta) * 100,
        height - cabinH / 2 - 0.4,
        Math.sin(theta) * 100,
      );
      win.userData = { rate: 4.5 + Math.random(), phase: Math.random() * 6, baseOpacity: 0.78 };
      this.standoff?.windows.push(win);
      grp.add(win);
    });
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
    // b201: leg-corner running lights at base — small dim red points so
    // the ground footprint reads from camera even when the tower is far
    [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(theta => {
      const led = this._makeRunningLight(0xff3344, 0.10);
      led.position.set(Math.cos(theta) * baseW * 0.6, 0.4, Math.sin(theta) * baseW * 0.6);
      grp.add(led);
    });

    this.scene.add(grp);
  },

  _buildBunker(x, y, z, w, h, d, glowColor) {
    const grp = new THREE.Group();
    grp.name = `bunker_${x}_${z}`;
    grp.position.set(x, y, z);
    grp.rotation.y = Math.random() * Math.PI * 2;
    const wallMat = new THREE.MeshBasicMaterial({ color: 0x36404f });
    const accentMat = new THREE.MeshBasicMaterial({ color: 0x32384a });

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
    const bagMat = new THREE.MeshBasicMaterial({ color: 0x2a3040 });
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
    this.planet.name = 'planet';
    // s18: moved up and out along the same back-left diagonal so the
    // planet sits as a sky element behind the ridge instead of clipping
    // the dirt floor. 1.6× further on x/z, ~6× higher in y.
    this.planet.position.set(-180, 75, -215);
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
      { kind: 'pelican',  size: 0.85, engineColor: 'rgba(140, 200, 255, 1.0)', runningLight: 0xff4444, bodyColor: 0x363640 },
      { kind: 'fighter',  size: 0.55, engineColor: 'rgba(255, 200, 120, 1.0)', runningLight: 0xff6677, bodyColor: 0x303040 },
      { kind: 'forerunner', size: 0.95, engineColor: 'rgba(180, 140, 255, 1.0)', runningLight: 0xc8a8ff, bodyColor: 0x202030 },
    ];
    designs.forEach((d, i) => {
      const ship = this._makeShip(d);
      ship.name = `flyby_${d.kind}`;
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

    // Altitude: 70% mid-air pass (above deck, around panel height), 18% high pass
    // (over panels), 12% low-but-clear pass. All clamped above ground to stop
    // ships clipping through the deck/desert floor.
    let altitude;
    const r = Math.random();
    if (r < 0.18)      altitude = camY + 18 + Math.random() * 10;          // high — above buildings
    else if (r < 0.30) altitude = camY + 3 + Math.random() * 3;            // low pass — just above deck (was -6..-10, clipped ground)
    else               altitude = camY + 6 + Math.random() * 6;            // mid — panel/building height (was -1.5..+3.5)

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
    // three.js Object3D.lookAt aims +Z at the target (NOT -Z — that's only the
    // camera/light convention). Ships are modelled with nose at -Z, so we
    // rotate 180° around Y to put the nose at +Z = the lookAt-aligned axis.
    // Removing this flip makes ships fly tail-forward.
    ship.rotateY(Math.PI);
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
    grp.name = 'pelican_scripted';
    const sz = 1.0;
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x363640 });
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
    // three.js Object3D.lookAt aims +Z at target (non-camera convention).
    // Pelican model is nose-at-(-Z), so flip 180° around Y to put the nose
    // at +Z = the axis lookAt aligned with dropZone.
    sp.rotateY(Math.PI);
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

    // b200: bumped counts + extended outer radius to fill the mid-foreground
    // gap between deck (r≈15) and the new v2 panel arc (r≈60-90). The b199
    // orphan-building purge left a lot of empty desert between camera and
    // the working base; more props + wider scatter sells "active base."

    // 18 traffic cones — kept off the hex deck (deck r=12)
    for (let i = 0; i < 18; i++) {
      const cone = this._makeTrafficCone();
      const p = placeRandomly(14, 50);
      cone.rotation.y = Math.random() * Math.PI * 2;
      // Some cones knocked over for chaos
      if (Math.random() < 0.20) {
        cone.rotation.z = (Math.random() - 0.5) * Math.PI * 0.7;
      }
      addProp(cone, p.x, p.z, FLOOR_Y);
    }

    // 9 fusion coils — kept off the deck and away from buildings
    for (let i = 0; i < 9; i++) {
      const coil = this._makeFusionCoil();
      const p = placeRandomly(15, 45);
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

    // 16 supply crates — outside the deck, scattered across the apron +
    // mid-foreground fill
    for (let i = 0; i < 16; i++) {
      const crate = this._makeCrate();
      const p = placeRandomly(15, 50);
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

    // b193 v2 layout — RADIAL SPEC. Locked in BASEMAP.md.
    // Every panel ≥18u from any other panel in (x,z); 11 clean radial bearings
    // from the camera so no two panels collapse into one along the sight axis.
    // Each host builds its own complete on-site structure (no dependency on
    // pre-built `_buildAllStructures` bodies — those are now orphans being
    // phased out). Bearings are measured from forward (-Z); R is panel radius
    // from camera.
    //
    //  galaxy       0°    R=88   HERO, dead-axis
    //  dimensions  -20°   R=75   NW
    //  livingwall  +20°   R=75   NE
    //  freqmap     -42°   R=65   W-mid
    //  tape spine  +42°   R=65   E-mid
    //  deepsea     -62°   R=75   NW-far (broken dish)
    //  neural      +62°   R=75   E-far  (sensor pylon)
    //  organism   -135°   R=60   SW-rear
    //  wall       +135°   R=60   SE-rear
    //  terrain / villa   deck-rail kiosks (unchanged)
    // b200: y-tier system — panel altitude is a function of distance, not
    // building roof, so the arc reads as a clean tiered horizon instead of
    // the b199 chaos (y=1 on radar, y=8 on dish, y=3 on biostation, all
    // mixed). Hero galaxy at y=10. Far panels (R≥75) at y=7. Mid (R≈65)
    // at y=5. Rear panels (R=60) at y=4. Kiosks at y=-3.
    const mounts = [
      { scene: home,      pos: [-14,  10, -88], size: [16, 9.6],  host: 'missilesite' },             // galaxy   →   missile silo (HERO; s2: panel offset west so the silo at world (0,-8,-118) sits unobstructed dead-center from the MISSILE SILO POI; billboard reads as an offset entry sign)
      { scene: SCENES[0], pos: [-26,   7, -70], size: [8,  4.8],  host: 'comms_array_shed' },        // dimensions → comms array shed
      { scene: SCENES[1], pos: [ 26,   7, -70], size: [9,  5.4],  host: 'forward_ops_radar' },       // livingwall → forward ops bunker w/ rotating radar
      { scene: SCENES[3], pos: [-43,   5, -48], size: [8,  4.8],  host: 'sigint_tower' },            // freqmap   → SIGINT tower
      { scene: SCENES[4], pos: [ 43,   5, -48], size: [8,  4.8],  host: 'logistics_yard' },          // tape spine → logistics yard (containers)
      { scene: SCENES[7], pos: [-66,   7, -35], size: [11, 6.6],  host: 'broken_dish' },             // deepsea   → BROKEN parabolic dish (sparking, scaffold, flyby gag)
      { scene: SCENES[8], pos: [ 66,   7, -35], size: [7,  4.2],  host: 'sensor_pylon' },            // neural    → sensor pylon w/ obelisk ring
      { scene: SCENES[2], pos: [-42,   4,  30], size: [7,  4.2],  host: 'biostation_quarantine' },   // organism  → biostation w/ quarantine perimeter (s12: pulled 12u north from z=42 → z=30 so the host's diagonal-rotated front corner clears the S-perim road span at z=45.5..54.5 by ≥10u instead of touching the edge)
      { scene: SCENES[5], pos: [ 42,   4,  42], size: [8,  4.8],  host: 'back_billboard_lattice' },  // wall      → free-standing lattice billboard (rear-right)

      // DECK-RAIL TACTICAL KIOSKS (unchanged):
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
      // b200: face the camera horizontally — the animate-loop tick will
      // refresh this every frame; matching here so the first frame is
      // upright not tilted.
      plane.lookAt(0, y, 0);
      plane.userData = { isPanel: true, scene: s, basePos: pos.clone(), baseScale: 1, sizeW: w, sizeH: h };
      this.scene.add(plane);

      // b208: halo sprite removed. The 1.05× additive card sat directly on
      // top of the panel — combined with bloom (strength 0.65, radius 0.55,
      // threshold 0.10) it painted that ghosted cyan ring around every
      // billboard. The shader's edge frame + bloom alone now carry the glow.
      this.panels.push({ mesh: plane, scene: s, basePos: pos.clone(), tint, sizeW: w, sizeH: h });

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
    grp.name = kind;  // s13: panel-host ID for debug label overlay
    grp.position.set(px, py, pz);
    // b200: face camera HORIZONTALLY (was `py * 0.5` which tilted the
    // chassis by atan(py/2 / R). For galaxy at py=10, R=88 → 3° tilt;
    // not catastrophic but it leaned the gantry tower visibly. Building
    // chassis must be upright; the panel mesh itself does its own lookAt.
    grp.lookAt(0, py, 0);
    const floorY = -8 - py;  // local Y of the world floor

    const steel  = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const accent = new THREE.MeshBasicMaterial({ color: 0x363c4a });
    const dark   = new THREE.MeshBasicMaterial({ color: 0x1d2230 });
    const concrete = new THREE.MeshBasicMaterial({ color: 0x36404f });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x424c64 });
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

    // ============================================================
    // b193 v2 RADIAL HOSTS — each builds its own complete chassis
    // around the panel. No dependency on _buildAllStructures bodies.
    // ============================================================

    else if (kind === 'comms_array_shed') {
      // Dimensions panel @ NW (-26, 7, -70). Equipment shed behind panel +
      // 3 antennas flanking + 2 sigint trailers + caution stripes +
      // 2 support masts down to ground so panel reads as mounted.
      // Support masts (panel altitude → floor)
      [-w * 0.42, w * 0.42].forEach(xo => {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, -floorY, 6), steel);
        mast.position.set(xo, floorY / 2, -0.30);
        grp.add(mast);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.9), concrete);
        foot.position.set(xo, floorY + 0.20, -0.30);
        grp.add(foot);
      });
      const sW = 5.0, sH = 3.6, sD = 4.5;
      const shed = new THREE.Mesh(new THREE.BoxGeometry(sW, sH, sD), concrete);
      shed.position.set(0, floorY + sH / 2, -sD / 2 - 0.45);
      grp.add(shed);
      const shedRoof = new THREE.Mesh(new THREE.BoxGeometry(sW + 0.4, 0.30, sD + 0.4), concreteLit);
      shedRoof.position.set(0, floorY + sH + 0.15, -sD / 2 - 0.45);
      grp.add(shedRoof);
      // 2 lit window slits on the front face + warm door glow
      [-1.0, 1.0].forEach(xo => {
        const slit = new THREE.Mesh(
          new THREE.PlaneGeometry(sW * 0.32, 0.42),
          new THREE.MeshBasicMaterial({ color: 0xffaa55, transparent: true, opacity: 0.80, blending: THREE.AdditiveBlending, depthWrite: false }),
        );
        slit.position.set(xo, floorY + sH * 0.72, 0.04);
        slit.userData = { rate: 4.0 + Math.random(), phase: Math.random() * 6, baseOpacity: 0.80 };
        grp.add(slit);
        this.standoff?.windows.push(slit);
      });
      // Door (warm glow) at base center
      const door = new THREE.Mesh(
        new THREE.PlaneGeometry(0.85, 1.6),
        new THREE.MeshBasicMaterial({ color: 0xffaa55, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      door.position.set(0, floorY + 0.85, 0.05);
      grp.add(door);
      // 3 antennas — 12u, 16u, 14u
      [{ x: -3.6, h: 12, color: 0x4488ff }, { x:  3.4, h: 16, color: 0xff3344 }, { x:  4.8, h: 14, color: 0x4488ff }].forEach(a => {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, a.h, 5), steel);
        mast.position.set(a.x, floorY + a.h / 2, -1.2);
        grp.add(mast);
        // Cross arm
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.06), steel);
        arm.position.set(a.x, floorY + a.h * 0.6, -1.2);
        grp.add(arm);
        // Tip strobe
        const tip = this._makeRunningLight(a.color, 0.25);
        tip.position.set(a.x, floorY + a.h + 0.4, -1.2);
        tip.userData = { rate: 1.6 + Math.random() * 0.4, phase: Math.random() * 6 };
        grp.add(tip);
        this.standoff?.strobes.push(tip);
      });
      // 2 sigint trailers (boxy vans w/ rooftop antennas)
      [{ x: -5.0, z: -0.5 }, { x: 4.6, z: 0.6 }].forEach(t => {
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 4.0), olive);
        body.position.set(t.x, floorY + 0.95, t.z);
        body.rotation.y = (Math.random() - 0.5) * 0.20;
        grp.add(body);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 1.4), oliveHi);
        cab.position.set(t.x, floorY + 1.4, t.z + 1.2);
        cab.rotation.y = body.rotation.y;
        grp.add(cab);
        // Rooftop dish
        const tDish = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), accent);
        tDish.position.set(t.x, floorY + 2.0, t.z - 0.6);
        tDish.rotation.x = -Math.PI * 0.45;
        grp.add(tDish);
      });
      // Caution stripe along base of panel
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(w * 1.30, 0.10, 0.06), yellow);
      stripe.position.set(0, -h/2 - 0.30, 0.05);
      grp.add(stripe);
    }

    else if (kind === 'forward_ops_radar') {
      // Livingwall panel @ NE (26, 7, -70). Concrete ops bunker w/ rotating
      // radar on the roof + lit windows + 2 support masts so the panel
      // reads as mounted on a roof billboard above the bunker.
      // Support masts (panel altitude → floor)
      [-w * 0.42, w * 0.42].forEach(xo => {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, -floorY, 6), steel);
        mast.position.set(xo, floorY / 2, -0.30);
        grp.add(mast);
      });
      const bW = 11, bH = 5.0, bD = 8;
      const shell = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, bD), concrete);
      shell.position.set(0, floorY + bH / 2, -bD / 2 - 0.45);
      grp.add(shell);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(bW + 0.5, 0.35, bD + 0.5), concreteLit);
      roof.position.set(0, floorY + bH + 0.18, -bD / 2 - 0.45);
      grp.add(roof);
      // Caution stripe on roof front
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(bW + 0.5, 0.14, 0.08), yellow);
      stripe.position.set(0, floorY + bH + 0.36, 0.10);
      grp.add(stripe);
      // Vertical concrete ribs flanking the panel
      [-2, 2].forEach(i => {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.30, bH, 0.40), concreteLit);
        rib.position.set(i * 2.4, floorY + bH / 2, 0.04);
        grp.add(rib);
      });
      // 2 lit windows above the panel (warm interior glow, on bunker face)
      [-2.6, 2.6].forEach(xo => {
        const winMat = new THREE.MeshBasicMaterial({
          color: 0xffaa55, transparent: true, opacity: 0.78,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), winMat);
        win.position.set(xo, h / 2 + 0.85, 0.06);
        win.userData = { rate: 4.4 + Math.random(), phase: Math.random() * 6, baseOpacity: 0.78 };
        grp.add(win);
        this.standoff?.windows.push(win);
      });
      // 4 lit windows BELOW the panel on the front face — gives the bunker
      // body a strong "occupied/ops-room" read at the panel altitude
      [-3.6, -1.2, 1.2, 3.6].forEach(xo => {
        const winMat = new THREE.MeshBasicMaterial({
          color: 0xffaa55, transparent: true, opacity: 0.66,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.45), winMat);
        win.position.set(xo, floorY + bH * 0.55, 0.04);
        win.userData = { rate: 5.0 + Math.random(), phase: Math.random() * 6, baseOpacity: 0.66 };
        grp.add(win);
        this.standoff?.windows.push(win);
      });
      // Rotating radar antenna on the roof — pushed onto the spin pivot list.
      // s2: moved to OUTER (east) corner of the bunker so the rotating bar
      // doesn't sweep across the missile-silo silhouette from the MISSILE
      // SILO POI. Strobe flipped to inner corner so the two roof features
      // sit on opposite ends instead of stacked.
      const radarBase = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 1.1, 8), concrete);
      radarBase.position.set(bW * 0.30, floorY + bH + 0.75, -bD / 2 - 0.45);
      grp.add(radarBase);
      const radarPivot = new THREE.Group();
      radarPivot.position.set(bW * 0.30, floorY + bH + 1.5, -bD / 2 - 0.45);
      grp.add(radarPivot);
      const radarBar = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.18, 0.18), accent);
      radarBar.position.set(0, 0, 0);
      radarPivot.add(radarBar);
      const radarFin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 0.10), accent);
      radarFin.position.set(2.0, 0.5, 0);
      radarPivot.add(radarFin);
      this._radarBuildingPivots ??= [];
      this._radarBuildingPivots.push(radarPivot);
      // Rooftop strobe (inner / west corner)
      const strobe = this._makeRunningLight(0xff3344, 0.40);
      strobe.position.set(-bW * 0.40, floorY + bH + 0.80, -bD / 2 - 0.45);
      strobe.userData = { rate: 1.1, phase: Math.random() * 6 };
      grp.add(strobe);
      this.standoff?.strobes.push(strobe);
      // Sandbag berm in front of the panel
      const bagMat = new THREE.MeshBasicMaterial({ color: 0x2a3040 });
      for (let i = -3; i <= 3; i++) {
        const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.36, 0.55), bagMat);
        b1.position.set(i * 0.95, floorY + 0.18, 0.65);
        b1.rotation.y = (Math.random() - 0.5) * 0.15;
        grp.add(b1);
      }
    }

    else if (kind === 'sigint_tower') {
      // Freqmap panel @ W-mid (-43, 5, -48). Tall lattice comm tower; panel
      // mounted on a service platform partway up. Slewing dish on platform.
      const towerH = 16;
      const baseW = 2.8;
      // 4 lattice legs
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.16, towerH, 4), steel);
        leg.position.set(Math.cos(a) * baseW * 0.5, floorY + towerH / 2, Math.sin(a) * baseW * 0.5 - 0.45);
        grp.add(leg);
      }
      // Cross-bracing rings
      for (let hh = floorY + 1.5; hh < floorY + towerH - 0.5; hh += 2.0) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(baseW * 0.55, 0.04, 4, 14), steel);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, hh, -0.45);
        grp.add(ring);
      }
      // Service platform (where the panel mounts)
      const plat = new THREE.Mesh(new THREE.BoxGeometry(baseW * 1.8, 0.20, baseW * 1.6), accent);
      plat.position.set(0, -h/2 - 0.20, -0.10);
      grp.add(plat);
      // Catwalk railing front of panel
      const rail = new THREE.Mesh(new THREE.BoxGeometry(baseW * 1.8, 0.05, 0.05), steel);
      rail.position.set(0, -h/2 - 0.20 + 0.65, 0.50);
      grp.add(rail);
      // Top antenna mast
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.0, 4), steel);
      mast.position.set(0, floorY + towerH + 2.0, -0.45);
      grp.add(mast);
      // Tip strobe
      const strobe = this._makeRunningLight(0xff3344, 0.55);
      strobe.position.set(0, floorY + towerH + 4.2, -0.45);
      strobe.userData = { rate: 1.8, phase: Math.random() * 6 };
      grp.add(strobe);
      this.standoff?.strobes.push(strobe);
      // Slewing dish on platform side (slow b194 anim hook)
      const platDish = new THREE.Mesh(
        new THREE.SphereGeometry(0.85, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
        accent,
      );
      platDish.position.set(baseW * 0.85, -h/2 - 0.20 + 0.85, 0.30);
      platDish.rotation.x = -Math.PI * 0.40;
      platDish.rotation.z = -Math.PI / 2;
      grp.add(platDish);
      // 2 sigint vans at base — both with lit windscreens
      [{ x: -3.8, z: 1.0, c: olive }, { x: 3.6, z: 1.4, c: oliveHi }].forEach(t => {
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 3.6), t.c);
        body.position.set(t.x, floorY + 0.90, t.z);
        body.rotation.y = (Math.random() - 0.5) * 0.20;
        grp.add(body);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 1.3), accent);
        cab.position.set(t.x, floorY + 1.35, t.z + 1.2);
        cab.rotation.y = body.rotation.y;
        grp.add(cab);
        // Lit windscreen
        const wsMat = new THREE.MeshBasicMaterial({
          color: 0xffaa55, transparent: true, opacity: 0.72,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.45), wsMat);
        ws.position.set(t.x, floorY + 1.40, t.z + 1.86);
        ws.rotation.y = body.rotation.y;
        ws.userData = { rate: 4.6, phase: Math.random() * 6, baseOpacity: 0.72 };
        grp.add(ws);
        this.standoff?.windows.push(ws);
        // Body side strip
        const sideStrip = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.18), wsMat.clone());
        sideStrip.position.set(t.x + 1.12, floorY + 1.05, t.z);
        sideStrip.rotation.y = -Math.PI / 2;
        sideStrip.userData = { rate: 4.0, phase: Math.random() * 6, baseOpacity: 0.55 };
        sideStrip.material.opacity = 0.55;
        grp.add(sideStrip);
        this.standoff?.windows.push(sideStrip);
      });
      // Cable run from van to tower base
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.5, 5), steel);
      cable.rotation.z = Math.PI / 2;
      cable.position.set(-1.8, floorY + 0.10, 1.2);
      grp.add(cable);
    }

    else if (kind === 'logistics_yard') {
      // Tape spine panel @ E-mid (43, 4, -48). Stacked containers (panel
      // mounted on top of upper container) + crane + crates + caution rim.
      const cW = 8, cH = 3.0, cD = 9;
      // Bottom container
      const lower = new THREE.Mesh(new THREE.BoxGeometry(cW, cH, cD), olive);
      lower.position.set(0, floorY + cH / 2, -cD / 2 - 0.5);
      grp.add(lower);
      // Top container offset
      const upper = new THREE.Mesh(new THREE.BoxGeometry(cW * 0.92, cH, cD * 0.95), oliveHi);
      upper.position.set(0.5, floorY + cH + cH / 2 + 0.10, -cD / 2 - 0.5 - 0.4);
      grp.add(upper);
      // Container ribs
      for (let i = -3; i <= 3; i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.10, cH, 0.10), oliveHi);
        rib.position.set(cW / 2 + 0.04, floorY + cH / 2, -cD / 2 - 0.5 + i * 1.2);
        grp.add(rib);
      }
      // Stencil mark on lower container
      const stencil = new THREE.MeshBasicMaterial({ color: 0xc6c2a8 });
      const mark = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.20, 0.04), stencil);
      mark.position.set(0, floorY + cH * 0.7, 0.04);
      grp.add(mark);
      // Open container door strip — warm interior glow (cargo hold lit
      // for the loading crew)
      const doorMat = new THREE.MeshBasicMaterial({
        color: 0xffaa55, transparent: true, opacity: 0.78,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const cargoDoor = new THREE.Mesh(new THREE.PlaneGeometry(2.2, cH * 0.65), doorMat);
      cargoDoor.position.set(-1.5, floorY + cH * 0.45, 0.04);
      cargoDoor.userData = { rate: 4.0, phase: Math.random() * 6, baseOpacity: 0.78 };
      grp.add(cargoDoor);
      this.standoff?.windows.push(cargoDoor);
      // Top container side strip lights
      const topStrip = new THREE.Mesh(new THREE.PlaneGeometry(cW * 0.70, 0.18), doorMat.clone());
      topStrip.position.set(0.5, floorY + cH * 1.7, 0.04);
      topStrip.material.opacity = 0.60;
      topStrip.userData = { rate: 4.4, phase: Math.random() * 6, baseOpacity: 0.60 };
      grp.add(topStrip);
      this.standoff?.windows.push(topStrip);
      // Catwalk under panel
      const cat = new THREE.Mesh(new THREE.BoxGeometry(w * 1.20, 0.16, 0.65), accent);
      cat.position.set(0, -h/2 - 0.35, 0.12);
      grp.add(cat);
      const railA = new THREE.Mesh(new THREE.BoxGeometry(w * 1.20, 0.04, 0.04), steel);
      railA.position.set(0, -h/2 - 0.35 + 0.55, 0.42);
      grp.add(railA);
      // 2 short support posts from catwalk down to top container so the
      // billboard reads as bolted to the container stack, not floating
      const containerTopLocal = floorY + 6.10;  // 2× cH (3.0) + 0.10 offset
      const postLen = (-h/2 - 0.35) - containerTopLocal;
      [-w * 0.42, w * 0.42].forEach(xo => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, postLen, 6), steel);
        post.position.set(xo, (-h/2 - 0.35 + containerTopLocal) / 2, 0.04);
        grp.add(post);
      });
      // Caution stripe above panel
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(w * 1.30, 0.12, 0.08), yellow);
      stripe.position.set(0, h/2 + 0.34, 0);
      grp.add(stripe);
      // Loose crates on the ground beside containers
      [{ x: -cW/2 - 1.4, z: -1.2 }, { x: -cW/2 - 1.4, z: -2.7 }, { x: -cW/2 - 2.5, z: -1.9 }].forEach(p => {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.3), olive);
        crate.position.set(p.x, floorY + 0.45, p.z);
        crate.rotation.y = (Math.random() - 0.5) * 0.20;
        grp.add(crate);
      });
      // Stack of crates on the right
      [{ y: 0.45 }, { y: 1.35 }].forEach(p => {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.3), oliveHi);
        crate.position.set(cW/2 + 1.4, floorY + p.y, -1.5);
        crate.rotation.y = 0.10;
        grp.add(crate);
      });
      // Crane / forklift suggestion: yellow boom on a base 4u east
      const craneBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 2.2), accent);
      craneBase.position.set(cW/2 + 2.8, floorY + 0.80, 1.2);
      grp.add(craneBase);
      const boom = new THREE.Mesh(new THREE.BoxGeometry(0.30, 5.0, 0.30), yellow);
      boom.position.set(cW/2 + 2.8, floorY + 3.0, 1.2);
      boom.rotation.z = 0.40;
      grp.add(boom);
      const boomTip = this._makeRunningLight(0xffaa55, 0.18);
      boomTip.position.set(cW/2 + 2.0, floorY + 5.4, 1.2);
      grp.add(boomTip);
      // Top strobe on container stack
      const strobe = this._makeRunningLight(0xffaa55, 0.30);
      strobe.position.set(w * 0.35, h/2 + 0.55, 0);
      strobe.userData = { rate: 1.4, phase: Math.random() * 6 };
      grp.add(strobe);
      this.standoff?.strobes.push(strobe);
    }

    else if (kind === 'sensor_pylon') {
      // Neural panel @ E-far (66, 4, -35). Single pylon mast w/ ring of 8
      // small sensor obelisks around the base.
      // Mast supporting the panel
      const mastH = -floorY + h / 2;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.40, mastH, 6), steel);
      mast.position.set(0, floorY + mastH / 2, -0.40);
      grp.add(mast);
      // Concrete footing
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.40, 12), concrete);
      foot.position.set(0, floorY + 0.20, -0.40);
      grp.add(foot);
      // Top dish above the panel
      const topDish = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
        accent,
      );
      topDish.position.set(0, h/2 + 0.85, -0.25);
      topDish.rotation.x = -Math.PI * 0.45;
      grp.add(topDish);
      // Tip strobe
      const tipStrobe = this._makeRunningLight(0x4488ff, 0.30);
      tipStrobe.position.set(0, h/2 + 1.6, -0.25);
      tipStrobe.userData = { rate: 1.5, phase: Math.random() * 6 };
      grp.add(tipStrobe);
      this.standoff?.strobes.push(tipStrobe);
      // Ring of 8 sensor obelisks around the base
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = 4.5;
        const ox = Math.cos(a) * r;
        const oz = Math.sin(a) * r - 0.40;
        // Obelisk body
        const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.6, 4), accent);
        obelisk.position.set(ox, floorY + 0.80, oz);
        grp.add(obelisk);
        // Obelisk LED tip
        const led = this._makeRunningLight(0x66ff99, 0.10);
        led.position.set(ox, floorY + 1.65, oz);
        led.userData = { rate: 1.0 + i * 0.15, phase: i * 0.5 };
        grp.add(led);
        this.standoff?.strobes.push(led);
      }
      // Cable run snaking on the ground (3 short segments)
      [-2.0, 0, 2.0].forEach(xo => {
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 5), steel);
        cable.rotation.z = Math.PI / 2;
        cable.position.set(xo, floorY + 0.06, -2.5);
        grp.add(cable);
      });
      // Tech-shed (small box) behind the array
      const techShed = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.0, 2.0), concrete);
      techShed.position.set(0, floorY + 1.0, -3.5);
      grp.add(techShed);
      const techDoor = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 1.4),
        new THREE.MeshBasicMaterial({ color: 0xffaa55, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      techDoor.position.set(0, floorY + 0.70, -2.45);
      grp.add(techDoor);
    }

    else if (kind === 'biostation_quarantine') {
      // s6: REWRITTEN. Was a small greenhouse + a few hazard posts. User
      // said "biostation is completely empty give it cool building colors
      // etc". Now: 3-pod xenobio research facility w/ neon pink/cyan/
      // purple/green glow, larger central airlock dome, 6 bio-luminescent
      // specimen tanks, animated grow lights, caution chevrons. The
      // surrounding SW quadrant fill lives in `_buildSWQuadrantFill`.
      const neonPink   = new THREE.MeshBasicMaterial({ color: 0xff5fa8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      const neonCyan   = new THREE.MeshBasicMaterial({ color: 0x44ddee, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      const neonPurple = new THREE.MeshBasicMaterial({ color: 0xaa44ee, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      const neonGreen  = new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      const labWhite   = new THREE.MeshBasicMaterial({ color: 0xb8c4d4 });
      const labWhiteHi = new THREE.MeshBasicMaterial({ color: 0xd4dce8 });
      // Support masts (panel altitude → floor)
      [-w * 0.42, w * 0.42].forEach(xo => {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, -floorY, 6), steel);
        mast.position.set(xo, floorY / 2, -0.30);
        grp.add(mast);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.8), concrete);
        foot.position.set(xo, floorY + 0.20, -0.30);
        grp.add(foot);
      });
      // ===== Central airlock dome (the hero shape) =====
      const domeR = 3.2;
      const domeBase = new THREE.Mesh(
        new THREE.CylinderGeometry(domeR, domeR + 0.3, 0.6, 16),
        labWhite,
      );
      domeBase.position.set(0, floorY + 0.30, -domeR - 1.0);
      grp.add(domeBase);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(domeR, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        labWhiteHi,
      );
      dome.position.set(0, floorY + 0.60, -domeR - 1.0);
      grp.add(dome);
      // Glowing dome equator band (cyan)
      const eqBand = new THREE.Mesh(
        new THREE.TorusGeometry(domeR + 0.04, 0.18, 6, 24),
        neonCyan,
      );
      eqBand.rotation.x = Math.PI / 2;
      eqBand.position.set(0, floorY + 0.60, -domeR - 1.0);
      grp.add(eqBand);
      // Glowing dome apex (pink) — visible from any POI
      const apex = this._makeRunningLight(0xff5fa8, 0.55);
      apex.position.set(0, floorY + 0.60 + domeR + 0.15, -domeR - 1.0);
      apex.userData = { rate: 0.5, phase: Math.random() * 6 };
      grp.add(apex);
      this.standoff?.strobes.push(apex);
      // Airlock entry door (lit warm interior)
      const airlockDoor = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 2.2),
        new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      airlockDoor.position.set(0, floorY + 1.40, -0.96);
      airlockDoor.userData = { rate: 4.0, phase: Math.random() * 6, baseOpacity: 0.55 };
      grp.add(airlockDoor);
      this.standoff?.windows.push(airlockDoor);
      // Airlock door frame
      const airlockFrame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.6, 0.20), steel);
      airlockFrame.position.set(0, floorY + 1.40, -0.92);
      grp.add(airlockFrame);
      // ===== 3 connected research pods (left/right of dome) =====
      const podW = 4.0, podH = 3.0, podD = 5.5;
      [{ x: -domeR - podW / 2 - 0.4, glow: neonPink },
       { x:  domeR + podW / 2 + 0.4, glow: neonPurple }].forEach(p => {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(podW, podH, podD), labWhite);
        pod.position.set(p.x, floorY + podH / 2, -domeR - 1.0);
        grp.add(pod);
        // Roof
        const podRoof = new THREE.Mesh(new THREE.BoxGeometry(podW + 0.30, 0.20, podD + 0.30), labWhiteHi);
        podRoof.position.set(p.x, floorY + podH + 0.10, -domeR - 1.0);
        grp.add(podRoof);
        // Glowing window strip on the front face (camera side)
        const winStrip = new THREE.Mesh(new THREE.PlaneGeometry(podW * 0.78, 1.4), p.glow);
        winStrip.position.set(p.x, floorY + podH * 0.55, -domeR - 1.0 + podD / 2 + 0.04);
        winStrip.userData = { rate: 1.2, phase: Math.random() * 6, baseOpacity: 0.85 };
        grp.add(winStrip);
        this.standoff?.windows.push(winStrip);
        // Vertical glowing accent strip on outer side
        const sideAccent = new THREE.Mesh(new THREE.PlaneGeometry(0.30, podH * 0.85), p.glow);
        sideAccent.position.set(p.x + (p.x < 0 ? -1 : 1) * (podW / 2 + 0.04), floorY + podH * 0.5, -domeR - 1.0);
        sideAccent.rotation.y = (p.x < 0 ? -Math.PI / 2 : Math.PI / 2);
        sideAccent.material = p.glow.clone();
        sideAccent.material.opacity = 0.65;
        grp.add(sideAccent);
        this.standoff?.windows.push(sideAccent);
        // Connecting tube to dome
        const tube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.85, 0.85, Math.abs(p.x) - domeR - 0.1, 12),
          labWhite,
        );
        tube.rotation.z = Math.PI / 2;
        tube.position.set((p.x + (p.x < 0 ? domeR : -domeR)) / 2, floorY + 1.4, -domeR - 1.0);
        grp.add(tube);
        // Tube glow band
        const tubeBand = new THREE.Mesh(new THREE.TorusGeometry(0.85 + 0.04, 0.08, 4, 18), p.glow);
        tubeBand.position.set((p.x + (p.x < 0 ? domeR : -domeR)) / 2, floorY + 1.4, -domeR - 1.0);
        tubeBand.rotation.y = Math.PI / 2;
        grp.add(tubeBand);
        // Roof vent stacks (2 per pod)
        [-podW * 0.25, podW * 0.25].forEach(vo => {
          const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.2, 6), labWhiteHi);
          vent.position.set(p.x + vo, floorY + podH + 0.85, -domeR - 1.0 - podD * 0.30);
          grp.add(vent);
          const ventCap = new THREE.Mesh(new THREE.ConeGeometry(0.30, 0.25, 6), steel);
          ventCap.position.set(p.x + vo, floorY + podH + 1.55, -domeR - 1.0 - podD * 0.30);
          grp.add(ventCap);
        });
      });
      // ===== Pitched glass-roof skylight (pink) over central dome =====
      [-1, 1].forEach(side => {
        const r = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 3.2), neonPink.clone());
        r.material.opacity = 0.45;
        r.position.set(0, floorY + 4.2 + 0.45, -domeR - 1.0 + side * 1.0);
        r.rotation.x = side * 0.42;
        grp.add(r);
      });
      // ===== 6 bio-luminescent specimen tanks in front of the dome
      // (s8: tightened x-spacing 1.4 → 1.0 so the front-right tank doesn't
      // reach into the S-perimeter road at world z=45.5 once host-rotated) =====
      const tankColors = [0xff5fa8, 0x44ddee, 0x66ff88, 0xaa44ee, 0xff5fa8, 0x44ddee];
      tankColors.forEach((color, i) => {
        const xo = (i - 2.5) * 1.0;
        // Glass cylinder
        const tank = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.55, 1.8, 14),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
        );
        tank.position.set(xo, floorY + 1.0, 1.6);
        tank.userData = { rate: 0.4 + i * 0.1, phase: i * 0.7, baseOpacity: 0.55 };
        grp.add(tank);
        this.standoff?.windows.push(tank);
        // Steel base
        const tankBase = new THREE.Mesh(
          new THREE.CylinderGeometry(0.62, 0.70, 0.30, 14),
          accent,
        );
        tankBase.position.set(xo, floorY + 0.15, 1.6);
        grp.add(tankBase);
        // Top cap w/ pipes
        const tankCap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.62, 0.62, 0.18, 14),
          steel,
        );
        tankCap.position.set(xo, floorY + 1.95, 1.6);
        grp.add(tankCap);
        // Pulsing glow inside
        const tankGlow = this._makeRunningLight(color, 0.30);
        tankGlow.position.set(xo, floorY + 1.0, 1.6);
        tankGlow.userData = { rate: 0.6 + i * 0.08, phase: i * 0.7 };
        grp.add(tankGlow);
        this.standoff?.strobes.push(tankGlow);
      });
      // ===== Caution chevron strip along bottom of panel =====
      for (let i = -5; i <= 5; i++) {
        const chev = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.20, 0.06),
          i % 2 === 0 ? yellow : new THREE.MeshBasicMaterial({ color: 0x101218 }));
        chev.position.set(i * 0.7, -h/2 - 0.30, 0.05);
        grp.add(chev);
      }
      // ===== 4 hazard posts forming a wider perimeter
      // (s8: shrunk from (±5.5, +2.2/-4.5) to (±4, +0.5/-3.5). Old footprint
      // diagonally rotated to put front-right post at world z=47.45 (inside
      // the S-perim road) and back-right at z=34.93 (1.4u inside back-cross
      // road). New footprint clears both by ≥2u once host-rotated.) =====
      [[-4, 0.5], [4, 0.5], [-4, -3.5], [4, -3.5]].forEach(([px, pz]) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.8, 4), yellow);
        post.position.set(px, floorY + 0.90, pz);
        grp.add(post);
        // Strobe on top
        const postStrobe = this._makeRunningLight(0xffaa22, 0.18);
        postStrobe.position.set(px, floorY + 1.95, pz);
        postStrobe.userData = { rate: 2.4, phase: Math.random() * 6 };
        grp.add(postStrobe);
        this.standoff?.strobes.push(postStrobe);
      });
      // Yellow tape spans (s8: matched to the shrunk hazard post coords)
      const tape = new THREE.MeshBasicMaterial({ color: 0x6a5618 });
      [
        { a: [-4, 0.5], b: [4, 0.5] },
        { a: [-4, -3.5], b: [4, -3.5] },
        { a: [-4, -3.5], b: [-4, 0.5] },
        { a: [4, -3.5], b: [4, 0.5] },
      ].forEach(p => {
        const dx = p.b[0] - p.a[0], dz = p.b[1] - p.a[1];
        const len = Math.hypot(dx, dz);
        const span = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.04), tape);
        span.position.set((p.a[0] + p.b[0]) / 2, floorY + 1.30, (p.a[1] + p.b[1]) / 2);
        span.rotation.y = Math.atan2(dz, dx);
        grp.add(span);
      });
      // Big BIOHAZARD warning sign on a stake in front (s8: x -5.5 → -4 to
      // match the shrunk perimeter)
      const signBg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6),
        new THREE.MeshBasicMaterial({ color: 0xe8a020 }));
      signBg.position.set(-4, floorY + 0.90, 1.05);
      grp.add(signBg);
      // Trefoil center disk (the bio-hazard symbol — simplified to a ring)
      const trefoil = new THREE.Mesh(new THREE.RingGeometry(0.20, 0.50, 24),
        new THREE.MeshBasicMaterial({ color: 0x101218, side: THREE.DoubleSide }));
      trefoil.position.set(-4, floorY + 0.90, 1.06);
      grp.add(trefoil);
      // 3 trefoil lobes (small disks at 120° apart)
      [0, 2.094, 4.188].forEach(theta => {
        const lobe = new THREE.Mesh(new THREE.CircleGeometry(0.18, 12),
          new THREE.MeshBasicMaterial({ color: 0x101218 }));
        lobe.position.set(-4 + Math.cos(theta) * 0.55, floorY + 0.90 + Math.sin(theta) * 0.55, 1.07);
        grp.add(lobe);
      });
      // Central trefoil dot
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12),
        new THREE.MeshBasicMaterial({ color: 0x101218 }));
      dot.position.set(-4, floorY + 0.90, 1.08);
      grp.add(dot);
      // Roof strobe
      const strobe = this._makeRunningLight(0xff3344, 0.30);
      strobe.position.set(0, floorY + 4.6, -domeR - 1.0);
      strobe.userData = { rate: 1.8, phase: Math.random() * 6 };
      grp.add(strobe);
      this.standoff?.strobes.push(strobe);
    }

    else if (kind === 'back_billboard_lattice') {
      // Wall panel @ SE-rear (42, 4, +42). Free-standing lattice billboard
      // with maintenance scaffolding on one leg + worker spotlight.
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
      // Twin support masts down to the ground
      [-fW * 0.40, fW * 0.40].forEach(xo => {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.26, -floorY, 6), steel);
        mast.position.set(xo, floorY / 2, -0.34);
        grp.add(mast);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 1.1), concrete);
        foot.position.set(xo, floorY + 0.25, -0.34);
        grp.add(foot);
      });
      // Maintenance scaffolding on the LEFT leg (x = -fW * 0.40)
      const scaffX = -fW * 0.40;
      const scaffH = -floorY * 0.85;
      // 4 scaffold uprights forming a 1.4×1.4 cage
      [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].forEach(([sx, sz]) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, scaffH, 4), steel);
        post.position.set(scaffX + sx, floorY + scaffH / 2, sz - 0.30);
        grp.add(post);
      });
      // 3 platform decks
      for (let lvl = 1; lvl <= 3; lvl++) {
        const dy = floorY + (scaffH * lvl / 3);
        const deck = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.10, 1.6), accent);
        deck.position.set(scaffX, dy, -0.30);
        grp.add(deck);
        const railF = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.04), steel);
        railF.position.set(scaffX, dy + 0.55, 0.40);
        grp.add(railF);
      }
      // Worker spotlight at the top scaffold
      const wlight = this._makeRunningLight(0xffe6a0, 0.30);
      wlight.position.set(scaffX, floorY + scaffH + 0.20, -0.30);
      grp.add(wlight);
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

    else if (kind === 'broken_dish') {
      // Deepsea panel @ NW-far (-66, 8, -35). Damaged parabolic dish — east
      // half of rim sags, support truss snapped, scaffold prop, hazard cones,
      // sparking sprite at break point. Panel mounts on the intact west rim.
      // The dish itself is built by the standalone _buildBrokenDish() (called
      // once from _buildStandoff). Here we just place panel-host trim:
      // a small support frame + the spark sprite + the welder pulse.
      if (!this._builtBuildings.has('broken_dish_host')) {
        this._builtBuildings.add('broken_dish_host');
        this._buildBrokenDish();
      }
      // Support masts (panel altitude → floor) so the billboard reads as
      // a free-standing sign in front of the dish, not floating
      [-w * 0.42, w * 0.42].forEach(xo => {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.26, -floorY, 6), steel);
        mast.position.set(xo, floorY / 2, -0.34);
        grp.add(mast);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.0), concrete);
        foot.position.set(xo, floorY + 0.25, -0.34);
        grp.add(foot);
      });
      // Frame around panel (heavy — it's bolted to the intact rim)
      const fW = w * 1.10, fH = h * 1.16, fT = 0.30;
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
      // Caution stripe across the panel (this dish is FAULTY)
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.12, 0.08), yellow);
      stripe.position.set(0, -fH/2 - 0.30, 0.05);
      grp.add(stripe);
    }

    // ============================================================
    // DEADCODE — pre-v2 host kinds, no longer referenced by mounts table.
    // Left in place for one cycle in case anything else needs them; pruned
    // in a follow-up cleanup pass. The `else if` chain stays intact so the
    // file parses; the cases just never fire.
    // ============================================================
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
      const bagMat = new THREE.MeshBasicMaterial({ color: 0x2a3040 });
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
      const bagMat = new THREE.MeshBasicMaterial({ color: 0x2a3040 });
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
    grp.name = 'cmd_bunker';
    const concrete = new THREE.MeshBasicMaterial({ color: 0x3a4358 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x4a5468 });
    const dark   = new THREE.MeshBasicMaterial({ color: 0x191d28 });
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
    grp.name = 'vehicle_bay';
    const concrete = new THREE.MeshBasicMaterial({ color: 0x3a4358 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x4a5468 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x191d28 });
    const yellow = new THREE.MeshBasicMaterial({ color: 0x5a4a14 });
    const olive   = new THREE.MeshBasicMaterial({ color: 0x3a4030 });
    const oliveHi = new THREE.MeshBasicMaterial({ color: 0x4d5440 });
    const steel   = new THREE.MeshBasicMaterial({ color: 0x2a3142 });

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
    grp.name = 'barracks_big';
    const concrete = new THREE.MeshBasicMaterial({ color: 0x3a4358 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x4a5468 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x191d28 });
    const olive = new THREE.MeshBasicMaterial({ color: 0x3a401e });

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
    grp.name = 'supply_depot';
    const oliveDark = new THREE.MeshBasicMaterial({ color: 0x3a401e });
    const oliveMid = new THREE.MeshBasicMaterial({ color: 0x2e3318 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x191d28 });
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
    grp.name = 'bio_station';
    const concrete = new THREE.MeshBasicMaterial({ color: 0x3a4358 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x4a5468 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x191d28 });
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
    grp.name = 'comm_tower_big';
    const steel = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const accent = new THREE.MeshBasicMaterial({ color: 0x363c4a });

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
    grp.name = 'helipad';
    const concrete = new THREE.MeshBasicMaterial({ color: 0x3a4358 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x4a5468 });
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
    grp.name = 'missile_site';
    const concrete = new THREE.MeshBasicMaterial({ color: 0x3a4358 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x4a5468 });
    const yellow = new THREE.MeshBasicMaterial({ color: 0x6a5618 });
    const stencil = new THREE.MeshBasicMaterial({ color: 0xc6c2a8 });
    const steel = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const accent = new THREE.MeshBasicMaterial({ color: 0x424c64 });
    // b220: missing material decls for the generator shed (b217 added the
    // shed code at line ~6039 but never declared these — broke /scenes init).
    const olive = new THREE.MeshBasicMaterial({ color: 0x3a4030 });
    const oliveHi = new THREE.MeshBasicMaterial({ color: 0x4d5440 });

    // Octagonal launch pad — b235 scaled up substantially (7.5 → 13) so the
    // silo reads as monumental from missile-silo POI at z=-55 (~52u away).
    const padR = 13, padH = 1.2;
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
    // b235: scaled 1.5/12 → 2.8/22 — silo now stands 23u above the pad,
    // dwarfing the panel at y=10 the way real Minuteman launch tubes dominate.
    const siloR = 2.8, siloH = 22;
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(siloR, siloR + 0.3, siloH, 12), concrete);
    silo.position.set(0, padH + siloH / 2, 0);
    grp.add(silo);
    // Caution chevrons up the silo (ring of yellow stripes) — wider spacing for taller silo
    for (let h = padH + 1.5; h < padH + siloH - 1; h += 3) {
      const chev = new THREE.Mesh(new THREE.TorusGeometry(siloR + 0.05, 0.10, 4, 16), yellow);
      chev.rotation.x = Math.PI / 2;
      chev.position.set(0, h, 0);
      grp.add(chev);
    }
    // Number "07" stencil — bigger to match scaled silo
    const stencilNum = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.7), stencil);
    stencilNum.position.set(0, padH + siloH * 0.5, siloR + 0.05);
    grp.add(stencilNum);
    // Silo cap — domed/conical top
    const cap = new THREE.Mesh(new THREE.ConeGeometry(siloR + 0.2, 2.4, 12), concreteLit);
    cap.position.set(0, padH + siloH + 1.2, 0);
    grp.add(cap);
    // Missile body partially extruded (suggests silo is loaded)
    const missile = new THREE.Mesh(new THREE.CylinderGeometry(siloR * 0.60, siloR * 0.55, 7, 12), accent);
    missile.position.set(0, padH + siloH + 1.0, 0);
    grp.add(missile);
    const missileNose = new THREE.Mesh(new THREE.ConeGeometry(siloR * 0.60, 2.8, 12), stencil);
    missileNose.position.set(0, padH + siloH + 5.9, 0);
    grp.add(missileNose);
    // Strobe at the silo cap
    const siloStrobe = this._makeRunningLight(0xff3344, 0.85);
    siloStrobe.position.set(0, padH + siloH + 2.5, 0);
    siloStrobe.userData = { rate: 1.4, phase: Math.random() * 6 };
    grp.add(siloStrobe);
    this.standoff?.strobes.push(siloStrobe);

    // b217: full 4-leg lattice service gantry beside the silo (was 2 posts).
    // Tower stands behind+left of silo, three service platforms at 1/3,
    // 2/3, and top. Diagonal bracing on every face. Vertical ladder run on
    // the camera-facing leg.
    const gantryH = siloH + 4;
    const gx = -(siloR + 5.0), gz = -3.6, gWidth = 2.8, gDepth = 2.4;
    const legPositions = [
      [gx - gWidth / 2, gz - gDepth / 2],
      [gx + gWidth / 2, gz - gDepth / 2],
      [gx - gWidth / 2, gz + gDepth / 2],
      [gx + gWidth / 2, gz + gDepth / 2],
    ];
    legPositions.forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, gantryH, 5), steel);
      leg.position.set(lx, padH + gantryH / 2, lz);
      grp.add(leg);
    });
    // Diagonal X-bracing on all 4 faces
    const addXBrace = (x1, z1, x2, z2, h) => {
      const span = Math.hypot(x2 - x1, z2 - z1);
      const diag = Math.hypot(span, h);
      const yaw = Math.atan2(z2 - z1, x2 - x1);
      [+1, -1].forEach(dir => {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, diag, 4), steel);
        bar.position.set((x1 + x2) / 2, padH + h / 2 + (legPositions[0] ? 0 : 0), (z1 + z2) / 2);
        bar.rotation.order = 'YXZ';
        bar.rotation.y = yaw;
        bar.rotation.z = Math.PI / 2 - dir * Math.atan2(h, span);
        grp.add(bar);
      });
    };
    for (let tier = 0; tier < 5; tier++) {
      const yBase = padH + tier * (gantryH / 5);
      const tierH = gantryH / 5;
      const setOnFace = (x1, z1, x2, z2) => addXBrace(x1, z1, x2, z2, tierH);
      // 4 faces — front/back/left/right of leg square
      // Front (cam-side, +z)
      const yMid = yBase + tierH / 2;
      [
        [legPositions[2], legPositions[3]],
        [legPositions[0], legPositions[1]],
        [legPositions[0], legPositions[2]],
        [legPositions[1], legPositions[3]],
      ].forEach(([a, b]) => {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const diag = Math.hypot(len, tierH);
        [+1, -1].forEach(dir => {
          const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, diag, 4), steel);
          bar.position.set((a[0] + b[0]) / 2, yMid, (a[1] + b[1]) / 2);
          const yaw = Math.atan2(b[1] - a[1], b[0] - a[0]);
          bar.rotation.order = 'YXZ';
          bar.rotation.y = yaw;
          bar.rotation.z = dir * Math.atan2(tierH, len) + Math.PI / 2;
          grp.add(bar);
        });
        // Horizontal stringer at top of tier
        const horiz = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 4), steel);
        horiz.position.set((a[0] + b[0]) / 2, yBase + tierH, (a[1] + b[1]) / 2);
        horiz.rotation.y = Math.atan2(b[1] - a[1], b[0] - a[0]);
        horiz.rotation.z = Math.PI / 2;
        grp.add(horiz);
      });
    }
    // 3 service platforms at 1/3, 2/3, top — slatted deck + handrails
    const accentLit = new THREE.MeshBasicMaterial({ color: 0x424c64 });
    [0.33, 0.66, 0.95].forEach((frac, idx) => {
      const yp = padH + gantryH * frac;
      // Deck reaches from gantry toward silo
      const deckW = (siloR + 2.4 - gx + gWidth / 2);
      const deckCenterX = (gx + gWidth / 2 + (siloR + 0.4)) / 2;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.10, gDepth + 0.6), accentLit);
      deck.position.set(deckCenterX, yp, gz);
      grp.add(deck);
      // Slats
      for (let s = -3; s <= 3; s++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.04, 0.06), steel);
        slat.position.set(deckCenterX, yp + 0.08, gz + s * 0.30);
        grp.add(slat);
      }
      // Toe-kick + handrail ring along the silo-facing edge
      [-(gDepth / 2 + 0.30), (gDepth / 2 + 0.30)].forEach(zOff => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.05, 0.05), steel);
        rail.position.set(deckCenterX, yp + 1.05, gz + zOff);
        grp.add(rail);
        const midRail = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.04, 0.04), steel);
        midRail.position.set(deckCenterX, yp + 0.55, gz + zOff);
        grp.add(midRail);
      });
      // 4 handrail posts
      [-deckW / 2 + 0.2, deckW / 2 - 0.2].forEach(xOff => {
        [-(gDepth / 2 + 0.30), (gDepth / 2 + 0.30)].forEach(zOff => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.10, 0.05), steel);
          post.position.set(deckCenterX + xOff, yp + 0.55, gz + zOff);
          grp.add(post);
        });
      });
      // Service arm: connects platform to silo at this tier
      if (idx < 2) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.20, 0.40), steel);
        arm.position.set(siloR + 0.20, yp + 0.30, gz);
        grp.add(arm);
        // Hose loop suggesting fuel/cryo line
        const hose = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 4, 12, Math.PI), accentLit);
        hose.position.set(siloR + 0.10, yp + 0.50, gz);
        hose.rotation.y = Math.PI / 2;
        grp.add(hose);
      }
    });
    // Vertical ladder up the camera-facing leg pair
    {
      const ladderLegs = [legPositions[2], legPositions[3]];
      const lx = (ladderLegs[0][0] + ladderLegs[1][0]) / 2;
      const lz = ladderLegs[0][1] + 0.18;
      // Side rails
      [-0.30, 0.30].forEach(off => {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, gantryH - 0.5, 4), steel);
        rail.position.set(lx + off, padH + (gantryH - 0.5) / 2, lz);
        grp.add(rail);
      });
      // Rungs every 0.4u
      for (let h = padH + 0.3; h < padH + gantryH - 0.3; h += 0.40) {
        const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 4), steel);
        rung.rotation.z = Math.PI / 2;
        rung.position.set(lx, h, lz);
        grp.add(rung);
      }
      // Safety cage hoops above 3u
      for (let h = padH + 3.0; h < padH + gantryH - 0.5; h += 0.7) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 4, 12, Math.PI * 1.1), steel);
        hoop.position.set(lx, h, lz);
        hoop.rotation.x = Math.PI / 2;
        hoop.rotation.z = -Math.PI / 2;
        grp.add(hoop);
      }
    }
    // Lightning rod + aviation strobe at the gantry top
    const tipMast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.0, 4), steel);
    tipMast.position.set(gx, padH + gantryH + 1.0, gz);
    grp.add(tipMast);
    const gantryStrobe = this._makeRunningLight(0xff3344, 0.40);
    gantryStrobe.position.set(gx, padH + gantryH + 2.0, gz);
    gantryStrobe.userData = { rate: 1.6, phase: Math.random() * 6 };
    grp.add(gantryStrobe);
    this.standoff?.strobes.push(gantryStrobe);

    // ----- LOX / cryo tank — insulated cylinder beside silo (s2: pushed
    // further from siloR+11.5 → siloR+15 so the west compound breathes;
    // user feedback "everything is too close together on the missile side") -----
    // s18: LOX cluster sits on dirt OUTSIDE the pad, so y-references anchor
    // to ground (y=0) not padH. Previously every off-pad mesh inherited the
    // padH offset and floated 1.2u above the ground.
    const loxR = 1.8, loxH = 6.5;
    const loxX = -(siloR + 15), loxZ = 4.0;
    const lox = new THREE.Mesh(new THREE.CylinderGeometry(loxR, loxR, loxH, 12), concreteLit);
    lox.position.set(loxX, loxH / 2, loxZ);
    grp.add(lox);
    [0.20, 0.50, 0.80].forEach(f => {
      const band = new THREE.Mesh(new THREE.TorusGeometry(loxR + 0.04, 0.06, 4, 18), stencil);
      band.rotation.x = Math.PI / 2;
      band.position.set(loxX, loxH * f, loxZ);
      grp.add(band);
    });
    const loxCap = new THREE.Mesh(new THREE.SphereGeometry(loxR, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), concreteLit);
    loxCap.position.set(loxX, loxH, loxZ);
    grp.add(loxCap);
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 1.6, 4), steel);
    vent.position.set(loxX, loxH + 0.8, loxZ);
    grp.add(vent);
    const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, Math.abs(loxX) + siloR, 5), steel);
    conduit.rotation.z = Math.PI / 2;
    conduit.position.set(loxX / 2, 0.20, loxZ);
    grp.add(conduit);
    [-loxH * 0.30, loxH * 0.30].forEach(off => {
      const cradle = new THREE.Mesh(new THREE.BoxGeometry(loxR * 1.6, 0.50, 0.30), accent);
      cradle.position.set(loxX + off / 4, 0.25, loxZ);
      cradle.rotation.y = Math.PI / 2;
      grp.add(cradle);
    });
    const placard = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), yellow);
    placard.position.set(loxX, loxH * 0.55, loxZ + loxR + 0.04);
    grp.add(placard);

    // ----- Generator shed beside the launch pad (s2: padR+6 → padR+9 so
    // shed clears the bunker side wall and the pad reads less crowded.) -----
    const gsW = 5.5, gsH = 3.5, gsD = 6.5;
    const gsX = padR + 9, gsZ = 8.5;
    // s18: generator shed cluster — off-pad, anchored to ground.
    const gShed = new THREE.Mesh(new THREE.BoxGeometry(gsW, gsH, gsD), olive);
    gShed.position.set(gsX, gsH / 2, gsZ);
    grp.add(gShed);
    const gsRoof = new THREE.Mesh(new THREE.BoxGeometry(gsW + 0.3, 0.18, gsD + 0.3), oliveHi);
    gsRoof.position.set(gsX, gsH + 0.09, gsZ);
    grp.add(gsRoof);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 1.4, 6), steel);
    stack.position.set(gsX + gsW * 0.35, gsH + 0.85, gsZ - gsD * 0.30);
    grp.add(stack);
    const stackCap = new THREE.Mesh(new THREE.ConeGeometry(0.30, 0.20, 6), steel);
    stackCap.position.set(gsX + gsW * 0.35, gsH + 1.65, gsZ - gsD * 0.30);
    grp.add(stackCap);
    for (let i = -2; i <= 2; i++) {
      const louvre = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.50), steel);
      louvre.position.set(gsX - gsW / 2 - 0.04, gsH * 0.55, gsZ + i * 0.55);
      grp.add(louvre);
    }
    const gsDoor = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.6),
      new THREE.MeshBasicMaterial({ color: 0xffaa55, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    gsDoor.position.set(gsX + gsW * 0.30, 0.80, gsZ + gsD / 2 + 0.03);
    gsDoor.userData = { rate: 3.2, phase: Math.random() * 6, baseOpacity: 0.45 };
    grp.add(gsDoor);
    this.standoff?.windows.push(gsDoor);
    [-gsW / 2 - 0.4, -gsW / 2 - 0.9].forEach((off, i) => {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.0, 10), i === 0 ? olive : oliveHi);
      drum.position.set(gsX + off, 0.50, gsZ - gsD / 2 + 0.4);
      grp.add(drum);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 10), steel);
      lid.position.set(gsX + off, 1.02, gsZ - gsD / 2 + 0.4);
      grp.add(lid);
    });

    // ----- Bunker constants — single source of truth for everything that
    // references the control bunker (b237: extracted from scattered
    // `padR + 1.5` / `-3.0` literals that were left stale when the bunker
    // grew + moved in b235, causing blast door, HVAC, cable trays, slit
    // window, and antenna farm to clip OR float in front of the new bunker).
    const cbW = 8, cbH = 6, cbD = 7;
    const bunkerX = padR + 2.5;   // bunker center X
    const bunkerZ = -4.5;         // bunker center Z
    const bunkerFront = bunkerZ + cbD / 2;  // +Z face (toward camera/silo)

    // ----- Cable tray network — runs from generator → bunker → silo -----
    const trayMat = new THREE.MeshBasicMaterial({ color: 0x303540 });
    // Horizontal run from generator to bunker (sits south of both, z=+2)
    const tray1Span = Math.abs(gsX - bunkerX);
    // s18: tray1 + its support pillars run from off-pad gShed toward bunker;
    // anchored to ground. tray2 stays inside the pad radius so keeps padH.
    const tray1 = new THREE.Mesh(new THREE.BoxGeometry(tray1Span + 0.5, 0.10, 0.40), trayMat);
    tray1.position.set((gsX + bunkerX) / 2, 0.10, 2.0);
    grp.add(tray1);
    // Tray from bunker side to silo base — runs along bunker's silo-side wall
    const tray2Span = bunkerFront - 0 + 1.5;
    const tray2 = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.10, tray2Span), trayMat);
    tray2.position.set(bunkerX - cbW / 2 - 0.4, padH + 0.10, (bunkerFront + 1.5) / 2 - 0.5);
    grp.add(tray2);
    // 3 cable supports along tray1
    for (let i = 1; i <= 3; i++) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.30, 0.50), steel);
      pillar.position.set(gsX - i * 1.2, 0.15, 2.0);
      grp.add(pillar);
    }

    // ----- Antenna farm — pushed out beyond the bunker -----
    // s2: padR+14 → padR+18 (= 31) and farmZ -12 → -16 so the dipole array
    // sits well clear of the new generator shed at gsX=padR+9 and reads as
    // a distinct east outbuilding instead of being lost in the bunker mass.
    // s18: antenna farm dipoles + guy wires anchor to ground (off-pad).
    const farmX = padR + 18, farmZ = -16;
    [0, 1, 2].forEach(i => {
      const dipoleH = 4.5 - i * 0.6;
      const dipole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, dipoleH, 4), steel);
      dipole.position.set(farmX + i * 0.9, dipoleH / 2, farmZ);
      grp.add(dipole);
      const xEl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4), steel);
      xEl.rotation.z = Math.PI / 2;
      xEl.position.set(farmX + i * 0.9, dipoleH * 0.85, farmZ);
      grp.add(xEl);
    });
    [0, 2.094, 4.188].forEach(theta => {
      const guy = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 5.5, 3), steel);
      const tipX = farmX, tipY = 4.2, tipZ = farmZ;
      const baseX = farmX + Math.cos(theta) * 2.4;
      const baseZ = farmZ + Math.sin(theta) * 2.4;
      const dx = tipX - baseX, dy = tipY, dz = tipZ - baseZ;
      const len = Math.hypot(dx, dy, dz);
      guy.scale.y = len / 5.5;
      guy.position.set((tipX + baseX) / 2, tipY / 2, (tipZ + baseZ) / 2);
      guy.lookAt(tipX, tipY, tipZ);
      guy.rotateX(Math.PI / 2);
      grp.add(guy);
    });

    // s18: bunker stairs + blast door + frame + wall lamp anchor to ground.
    const stairW = 1.6;
    [0, 1, 2].forEach(step => {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(stairW, 0.18, 0.45), concreteLit);
      tread.position.set(bunkerX - cbW * 0.25, 0.09 + step * 0.18, bunkerFront + 0.6 + step * 0.45);
      grp.add(tread);
    });
    const blastDoor = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.6, 0.20), steel);
    blastDoor.position.set(bunkerX - cbW * 0.25, 1.40, bunkerFront + 0.04);
    grp.add(blastDoor);
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(2.20, 2.80, 0.10), accent);
    doorFrame.position.set(bunkerX - cbW * 0.25, 1.40, bunkerFront + 0.10);
    grp.add(doorFrame);
    const wallLamp = this._makeRunningLight(0xffaa55, 0.22);
    wallLamp.position.set(bunkerX - cbW * 0.25 - 1.5, 2.6, bunkerFront + 0.04);
    grp.add(wallLamp);

    // ----- HVAC unit on the bunker roof -----
    const hvac = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.4), accent);
    hvac.position.set(bunkerX + cbW * 0.25, cbH + 0.45, bunkerZ - cbD * 0.30);
    grp.add(hvac);
    const hvacFan = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.12, 12), steel);
    hvacFan.rotation.x = Math.PI / 2;
    hvacFan.position.set(bunkerX + cbW * 0.25, cbH + 0.95, bunkerZ - cbD * 0.30);
    grp.add(hvacFan);

    // ----- Blast deflector ring — thick concrete lip around silo base -----
    const deflector = new THREE.Mesh(
      new THREE.CylinderGeometry(siloR + 1.6, siloR + 2.2, 0.70, 16),
      concreteLit,
    );
    deflector.position.set(0, padH + 0.40, 0);
    grp.add(deflector);
    // Yellow caution paint on deflector
    const deflectorRing = new THREE.Mesh(
      new THREE.RingGeometry(siloR + 1.6, siloR + 2.15, 32),
      yellow,
    );
    deflectorRing.rotation.x = -Math.PI / 2;
    deflectorRing.position.set(0, padH + 0.78, 0);
    grp.add(deflectorRing);

    // Adjacent control bunker — anchored to bunkerX/bunkerZ
    const cb = new THREE.Mesh(new THREE.BoxGeometry(cbW, cbH, cbD), concrete);
    cb.position.set(bunkerX, cbH / 2, bunkerZ);
    grp.add(cb);
    const cbRoof = new THREE.Mesh(new THREE.BoxGeometry(cbW + 0.4, 0.3, cbD + 0.4), concreteLit);
    cbRoof.position.set(bunkerX, cbH + 0.15, bunkerZ);
    grp.add(cbRoof);
    // Slit window with warm interior glow — front face
    const slit = new THREE.Mesh(
      new THREE.PlaneGeometry(cbW * 0.7, 0.9),
      new THREE.MeshBasicMaterial({ color: 0xffaa55, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    slit.position.set(bunkerX, cbH * 0.65, bunkerFront + 0.04);
    slit.userData = { rate: 4.2, phase: Math.random() * 6, baseOpacity: 0.85 };
    grp.add(slit);
    this.standoff?.windows.push(slit);

    // s18: sandbags + jersey barriers ring the pad on dirt (off-pad) — y=ground.
    const bagMat = new THREE.MeshBasicMaterial({ color: 0x2a3040 });
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * Math.PI * 2;
      const r = padR + 1.8;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.40, 0.65), bagMat);
      b.position.set(Math.cos(a) * r, 0.20, Math.sin(a) * r);
      b.rotation.y = a + (Math.random() - 0.5) * 0.10;
      grp.add(b);
    }
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (i - 1.5) * 0.25;
      const r = padR + 3.0;
      const jersey = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 0.7), concreteLit);
      jersey.position.set(Math.cos(a) * r, 0.50, Math.sin(a) * r);
      jersey.rotation.y = a + Math.PI / 2;
      grp.add(jersey);
    }

    // ===== b235: typical LF (Launch Facility) compound features =====
    // Real Minuteman LFs are ringed with: 4 corner floodlight pylons, security
    // cameras on poles at compass points, "DEADLY FORCE AUTHORIZED" red signs
    // on stakes facing outward, an above-ground diesel fuel tank, a payload
    // transporter (PT) truck parked nearby for missile maintenance, a sloped
    // concrete personnel access hatch separate from the main blast door, and
    // an inner LF security fence around the whole compound.

    const compoundR = padR + 17;  // s2: padR+12 → padR+17 LF compound — perimeter pulled out so floodlight pylons / cameras / warning signs ring the spread-out compound instead of clustering on top of the moved-outboard equipment.

    // s18: LF compound perimeter (pylons / cameras / warning signs) sits
    // outside the pad on dirt → all anchor to ground (y=0).
    [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sz]) => {
      const px = sx * compoundR * 0.78, pz = sz * compoundR * 0.78;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 11, 5), steel);
      pole.position.set(px, 5.5, pz);
      grp.add(pole);
      const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.10, 1.6), steel);
      yoke.position.set(px - sx * 0.5, 11, pz - sz * 0.5);
      yoke.rotation.y = Math.atan2(-sz, -sx);
      grp.add(yoke);
      [-0.45, 0, 0.45].forEach(off => {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.30, 0.55), accent);
        lamp.position.set(px - sx * 1.2 + off * sz, 11, pz - sz * 1.2 - off * sx);
        grp.add(lamp);
        const lens = this._makeRunningLight(0xfff0c8, 0.30);
        lens.position.set(px - sx * 1.5 + off * sz, 10.85, pz - sz * 1.5 - off * sx);
        grp.add(lens);
      });
      const tipStrobe = this._makeRunningLight(0xff3344, 0.50);
      tipStrobe.position.set(px, 11.8, pz);
      tipStrobe.userData = { rate: 1.5 + Math.random() * 0.5, phase: Math.random() * 6 };
      grp.add(tipStrobe);
      this.standoff?.strobes.push(tipStrobe);
    });

    [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(theta => {
      const cx = Math.cos(theta) * (compoundR * 0.62);
      const cz = Math.sin(theta) * (compoundR * 0.62);
      const cpole = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.13, 6, 5), steel);
      cpole.position.set(cx, 3, cz);
      grp.add(cpole);
      const cam = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.30, 0.65), accent);
      cam.position.set(cx, 6.0, cz);
      cam.lookAt(0, padH + 1, 0);  // look-at target stays on the pad (silo base)
      grp.add(cam);
      const led = this._makeRunningLight(0xff3344, 0.10);
      led.position.set(cx, 6.2, cz);
      led.userData = { rate: 2.8, phase: Math.random() * 6 };
      grp.add(led);
    });

    const signMat = new THREE.MeshBasicMaterial({
      color: 0xc83838, side: THREE.DoubleSide,
    });
    const signWhite = new THREE.MeshBasicMaterial({
      color: 0xe8e0d0, side: THREE.DoubleSide,
    });
    [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75].forEach(theta => {
      const sx = Math.cos(theta) * (compoundR * 0.92);
      const sz = Math.sin(theta) * (compoundR * 0.92);
      const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 4), steel);
      stake.position.set(sx, 1.2, sz);
      grp.add(stake);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), signMat);
      sign.position.set(sx, 1.9, sz);
      sign.lookAt(0, 1.9, 0);
      grp.add(sign);
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.18), signWhite);
      stripe.position.set(sx, 1.95, sz);
      stripe.lookAt(0, 1.95, 0);
      stripe.translateZ(0.02);
      grp.add(stripe);
    });

    // ----- Above-ground diesel fuel tank beside generator shed -----
    const fuelR = 1.6, fuelL = 5.5;
    const fuelX = gsX + gsW / 2 + fuelR + 1.0;
    const fuelTank = new THREE.Mesh(
      new THREE.CylinderGeometry(fuelR, fuelR, fuelL, 14),
      concreteLit,
    );
    // s18: diesel fuel tank cluster off-pad, anchored to ground.
    fuelTank.rotation.z = Math.PI / 2;
    fuelTank.position.set(fuelX, fuelR, gsZ - 0.5);
    grp.add(fuelTank);
    [+1, -1].forEach(s => {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(fuelR, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        concreteLit,
      );
      cap.position.set(fuelX + s * fuelL / 2, fuelR, gsZ - 0.5);
      cap.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      grp.add(cap);
    });
    [-fuelL * 0.3, fuelL * 0.3].forEach(off => {
      const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, fuelR * 1.8), accent);
      saddle.position.set(fuelX + off, 0.6, gsZ - 0.5);
      grp.add(saddle);
    });
    const fuelPlacard = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), yellow);
    fuelPlacard.position.set(fuelX, fuelR, gsZ - 0.5 + fuelR + 0.04);
    grp.add(fuelPlacard);
    const fuelVent = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 1.8, 4), steel);
    fuelVent.position.set(fuelX - fuelL * 0.35, fuelR + 0.9, gsZ - 0.5);
    grp.add(fuelVent);

    // ===== s3: rocket-propulsion-themed clutter to fill the SW compound
    // floor between the LOX tank and the payload transporter. User feedback:
    // "in screenshotted area more fuel tanks or shit that makes sense near
    // rockets". Real Minuteman/Atlas LFs have helium/GN2 bottle racks, a
    // second oxidizer tank, hypergolic propellant cabinets, hose reels, and
    // spill-containment berms in this exact zone.

    // ----- Secondary spherical oxidizer/fuel tank, west of the launch pad -----
    // Spherical pressurized tank w/ skirt support, hazard placard.
    {
      const sphR = 2.4;
      const sphX = -(siloR + 9), sphZ = -7;
      const sph = new THREE.Mesh(
        new THREE.SphereGeometry(sphR, 18, 12),
        concreteLit,
      );
      // s18: sphere oxidizer sits just outside pad on dirt → y=ground.
      sph.position.set(sphX, sphR + 0.8, sphZ);
      grp.add(sph);
      const skirt = new THREE.Mesh(
        new THREE.CylinderGeometry(sphR * 0.55, sphR * 0.65, 1.4, 12),
        accent,
      );
      skirt.position.set(sphX, 0.7, sphZ);
      grp.add(skirt);
      const eq = new THREE.Mesh(new THREE.TorusGeometry(sphR + 0.04, 0.10, 4, 18), stencil);
      eq.rotation.x = Math.PI / 2;
      eq.position.set(sphX, sphR + 0.8, sphZ);
      grp.add(eq);
      const sphVent = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.13, 2.4, 4), steel);
      sphVent.position.set(sphX, sphR + 0.8 + sphR + 1.2, sphZ);
      grp.add(sphVent);
      const sphVentCap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.25, 6), steel);
      sphVentCap.position.set(sphX, sphR + 0.8 + sphR + 2.5, sphZ);
      grp.add(sphVentCap);
      const sphPlacard = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6),
        new THREE.MeshBasicMaterial({ color: 0xc83838 }));
      sphPlacard.position.set(sphX, sphR + 0.8, sphZ + sphR + 0.04);
      grp.add(sphPlacard);
      const sphPipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, Math.abs(sphX) + siloR, 5),
        steel,
      );
      sphPipe.rotation.z = Math.PI / 2;
      sphPipe.position.set(sphX / 2, 0.30, sphZ);
      grp.add(sphPipe);
    }

    // ----- Helium / GN2 high-pressure bottle rack (12 cylinders in caged frame) -----
    {
      // s18: bottle rack just outside pad on dirt → y=ground.
      const rkX = -(siloR + 6), rkZ = -10;
      const frameW = 3.6, frameH = 2.2, frameD = 1.2;
      [[-frameW / 2, -frameD / 2], [frameW / 2, -frameD / 2], [-frameW / 2, frameD / 2], [frameW / 2, frameD / 2]].forEach(([fx, fz]) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, frameH, 0.08), steel);
        post.position.set(rkX + fx, frameH / 2, rkZ + fz);
        grp.add(post);
      });
      [0.30, frameH - 0.15].forEach(yh => {
        [-frameD / 2, frameD / 2].forEach(fz => {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(frameW + 0.08, 0.06, 0.06), steel);
          rail.position.set(rkX, yh, rkZ + fz);
          grp.add(rail);
        });
      });
      const bottleR = 0.22, bottleH = 1.85;
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 6; col++) {
          const bx = rkX - frameW / 2 + 0.30 + col * 0.60;
          const bz = rkZ - frameD / 2 + 0.30 + row * 0.60;
          const bottle = new THREE.Mesh(
            new THREE.CylinderGeometry(bottleR, bottleR, bottleH, 10),
            (col + row) % 2 === 0 ? olive : oliveHi,
          );
          bottle.position.set(bx, bottleH / 2 + 0.08, bz);
          grp.add(bottle);
          const valve = new THREE.Mesh(new THREE.SphereGeometry(bottleR * 0.55, 6, 5), steel);
          valve.position.set(bx, bottleH + 0.10, bz);
          grp.add(valve);
        }
      }
      const rkPlacard = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), yellow);
      rkPlacard.position.set(rkX, frameH * 0.85, rkZ + frameD / 2 + 0.06);
      grp.add(rkPlacard);
    }

    // ----- Hypergolic propellant cabinet (closed steel locker w/ hazard tape) -----
    {
      const cabX = -(siloR + 4), cabZ = 7;
      const cabW = 2.2, cabH = 2.6, cabD = 1.4;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(cabW, cabH, cabD), accent);
      cab.position.set(cabX, padH + cabH / 2, cabZ);
      grp.add(cab);
      // Roof
      const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(cabW + 0.18, 0.14, cabD + 0.18), steel);
      cabRoof.position.set(cabX, padH + cabH + 0.07, cabZ);
      grp.add(cabRoof);
      // Door split lines (2 hinged doors)
      const split = new THREE.Mesh(new THREE.BoxGeometry(0.04, cabH * 0.85, 0.04), steel);
      split.position.set(cabX, padH + cabH * 0.5, cabZ + cabD / 2 + 0.02);
      grp.add(split);
      // Hazard diamond (orange — corrosive/oxidizer)
      const diamond = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7),
        new THREE.MeshBasicMaterial({ color: 0xd06420 }));
      diamond.rotation.z = Math.PI / 4;
      diamond.position.set(cabX, padH + cabH * 0.70, cabZ + cabD / 2 + 0.04);
      grp.add(diamond);
      // Yellow caution stripes around base
      const baseStripe = new THREE.Mesh(new THREE.BoxGeometry(cabW + 0.10, 0.18, cabD + 0.10), yellow);
      baseStripe.position.set(cabX, padH + 0.09, cabZ);
      grp.add(baseStripe);
    }

    // ----- Propellant drum cluster on a caged pallet (4 drums, color-coded) -----
    {
      const dpX = -(siloR + 2.5), dpZ = 11;
      // Pallet base
      const pallet = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.20, 2.2), oliveHi);
      pallet.position.set(dpX, padH + 0.10, dpZ);
      grp.add(pallet);
      // 4 drums (red oxidizer, olive fuel, yellow caution, blue water)
      const drumColors = [0xc83838, 0x3a4030, 0x8a7020, 0x3a5870];
      [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]].forEach(([dx, dz], i) => {
        const drum = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.45, 1.2, 12),
          new THREE.MeshBasicMaterial({ color: drumColors[i] }),
        );
        drum.position.set(dpX + dx, padH + 0.80, dpZ + dz);
        grp.add(drum);
        // Lid
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 12), steel);
        lid.position.set(dpX + dx, padH + 1.42, dpZ + dz);
        grp.add(lid);
        // Top band (black ring around upper third)
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 4, 12),
          new THREE.MeshBasicMaterial({ color: 0x101218 }));
        band.rotation.x = Math.PI / 2;
        band.position.set(dpX + dx, padH + 1.20, dpZ + dz);
        grp.add(band);
      });
      // Cage corner posts
      [[-1.0, -1.0], [1.0, -1.0], [-1.0, 1.0], [1.0, 1.0]].forEach(([px, pz]) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.7, 0.06), steel);
        post.position.set(dpX + px, padH + 0.95, dpZ + pz);
        grp.add(post);
      });
    }

    // ----- Hose reel + fuel pump cabinet (small ground unit between sphere
    // tank and silo) -----
    {
      const hrX = -(siloR + 5), hrZ = -2;
      // Pump cabinet base
      const pump = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.6, 0.8), accent);
      pump.position.set(hrX, padH + 0.80, hrZ);
      grp.add(pump);
      // Pump cap
      const pumpCap = new THREE.Mesh(new THREE.BoxGeometry(1.10, 0.10, 0.90), steel);
      pumpCap.position.set(hrX, padH + 1.65, hrZ);
      grp.add(pumpCap);
      // Hose reel (round drum w/ hose wrapped)
      const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.50, 12), steel);
      reel.rotation.x = Math.PI / 2;
      reel.position.set(hrX + 0.85, padH + 0.85, hrZ);
      grp.add(reel);
      const reelCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.55, 8), accent);
      reelCenter.rotation.x = Math.PI / 2;
      reelCenter.position.set(hrX + 0.85, padH + 0.85, hrZ);
      grp.add(reelCenter);
      // Hose snake to ground
      const hose = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 4, 12, Math.PI), steel);
      hose.position.set(hrX + 0.85, padH + 0.30, hrZ + 0.5);
      hose.rotation.x = Math.PI / 2;
      grp.add(hose);
      // Status LED
      const pumpLed = this._makeRunningLight(0x44dd66, 0.10);
      pumpLed.position.set(hrX, padH + 1.45, hrZ + 0.42);
      grp.add(pumpLed);
    }

    // ----- Spill-containment berm — low concrete curb around the propellant
    // cluster so the area reads as engineered, not random clutter -----
    {
      const bermPts = [
        [-(siloR + 17), -3], [-(siloR + 17), 14],
        [-(siloR + 1),  14], [-(siloR + 1),  -12],
        [-(siloR + 17), -12], [-(siloR + 17), -3],
      ];
      // s18: berm curb on dirt around propellant cluster → y=ground.
      for (let i = 0; i < bermPts.length - 1; i++) {
        const [x1, z1] = bermPts[i];
        const [x2, z2] = bermPts[i + 1];
        const len = Math.hypot(x2 - x1, z2 - z1);
        const yaw = Math.atan2(z2 - z1, x2 - x1);
        const curb = new THREE.Mesh(new THREE.BoxGeometry(len, 0.32, 0.30), concreteLit);
        curb.position.set((x1 + x2) / 2, 0.16, (z1 + z2) / 2);
        curb.rotation.y = -yaw;
        grp.add(curb);
        const stripe2 = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.32), yellow);
        stripe2.position.set((x1 + x2) / 2, 0.34, (z1 + z2) / 2);
        stripe2.rotation.y = -yaw;
        grp.add(stripe2);
      }
    }

    // ----- Payload transporter (PT) — flatbed semi parked SW of pad
    // (s2: -padR-8 / +9 → -padR-13 / +14 so the truck doesn't crowd the
    // LOX tank now that LOX itself moved further west.) -----
    const ptX = -padR - 13, ptZ = 14;
    const ptYaw = -0.3;
    const pt = new THREE.Group();
    // s18: dropped padH offsets — transporter sits on the dirt OFF the pad,
    // wheels (r=0.55) should touch the ground. Was floating 1.2u with wheels dangling.
    const ptCab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 3.0), olive);
    ptCab.position.set(0, 1.5, -3.5);
    pt.add(ptCab);
    const ptCabRoof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 3.0), oliveHi);
    ptCabRoof.position.set(0, 2.7, -3.5);
    pt.add(ptCabRoof);
    [-1.0, 1.0].forEach(hx => {
      const hl = this._makeRunningLight(0xfff0c8, 0.30);
      hl.position.set(hx, 1.4, -5.0);
      pt.add(hl);
    });
    const ptWind = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.0),
      new THREE.MeshBasicMaterial({ color: 0xffaa55, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ptWind.position.set(0, 2.1, -5.01);
    pt.add(ptWind);
    const ptBed = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.6, 9), olive);
    ptBed.position.set(0, 1.0, 2.8);
    pt.add(ptBed);
    const ptCargo = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 8.0, 12), oliveHi);
    ptCargo.rotation.x = Math.PI / 2;
    ptCargo.position.set(0, 1.85, 3.0);
    pt.add(ptCargo);
    for (let i = -2; i <= 2; i++) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 0.10), steel);
      strap.position.set(0, 1.65, 3.0 + i * 1.5);
      pt.add(strap);
    }
    const wheelMat = new THREE.MeshBasicMaterial({ color: 0x191d28 });
    [[-1.4, -4.5],[1.4, -4.5],[-1.4, -2.6],[1.4, -2.6],
     [-1.4, 0.4],[1.4, 0.4],[-1.4, 3.0],[1.4, 3.0],[-1.4, 5.6],[1.4, 5.6]].forEach(([wx, wz]) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.55, wz);
      pt.add(wheel);
    });
    const ptBeacon = this._makeRunningLight(0xffaa22, 0.45);
    ptBeacon.position.set(0, 3.0, -3.5);
    ptBeacon.userData = { rate: 2.4, phase: Math.random() * 6 };
    grp.add(ptBeacon);  // add at top level so animation tick can find via standoff windows
    pt.position.set(ptX, 0, ptZ);
    pt.rotation.y = ptYaw;
    grp.add(pt);

    // s18: personnel hatch sits on dirt → y=ground.
    const hatchX = padR - 2, hatchZ = -padR + 2;
    const hatch = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 2.6), concreteLit);
    hatch.position.set(hatchX, 0.45, hatchZ);
    grp.add(hatch);
    const hatchLid = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 2.4), steel);
    hatchLid.position.set(hatchX, 1.05, hatchZ);
    hatchLid.rotation.x = -0.25;
    grp.add(hatchLid);
    const hatchStripe = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 0.04), yellow);
    hatchStripe.position.set(hatchX, 0.20, hatchZ + 1.32);
    grp.add(hatchStripe);
    [-1.0, 1.0].forEach(rx => {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 4), steel);
      rail.position.set(hatchX + rx, 1.3, hatchZ);
      grp.add(rail);
    });
    const railTop = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 4), steel);
    railTop.rotation.z = Math.PI / 2;
    railTop.position.set(hatchX, 1.8, hatchZ);
    grp.add(railTop);

    // b214: silo pushed back z=-94 → z=-107. Old position straddled the N
    // perimeter road (z=-90 ±4.5). Sandbag perimeter (silo+8.9u) at z=-85.1
    // sat dead in the road; jeeps couldn't pass without clipping. New
    // position puts the sandbag north edge at z=-98.1 — 3.6u south of the
    // road's south edge — leaving a clean asphalt strip between the road
    // and the launch pad. Panel still floats at (0, 10, -88) so the
    // billboard reads as the entry sign for the launch zone behind it.
    // b235: pad scaled up + new LF compound features added; pushed deeper
    // (z=-107 → z=-118) so the bigger compound clears the road shoulder.
    this._placeBuilding(grp, 0, -8, -118);
  },

  /* ---------- Radar / operations building (living wall panel host) ---------- */
  _buildRadarBuilding() {
    // Squat operations building with a rotating radar antenna on the roof.
    const grp = new THREE.Group();
    grp.name = 'radar_building';
    const concrete = new THREE.MeshBasicMaterial({ color: 0x3a4358 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x4a5468 });
    const steel = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const accent = new THREE.MeshBasicMaterial({ color: 0x424c64 });
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

  /* ---------- s4: outer-base silhouette anchors ----------
     User feedback: "use our available free space ... we built a floor
     plan originally so you'd get an idea of how to shape shit doesn't
     mean be rigid". The wide flanks at x=±78..±110 (between the
     perimeter loop road and the inner fence) and the deep N at z=-90..-110
     read as black void from every front-facing POI. Four big BUILDINGS
     out there to anchor the silhouette: west propellant tank farm,
     east aircraft hangar, NW secondary launch silo, NE SAM battery. */
  _buildOuterCompounds() {
    const concrete = new THREE.MeshBasicMaterial({ color: 0x3a4358 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x4a5468 });
    const olive = new THREE.MeshBasicMaterial({ color: 0x3a4030 });
    const oliveHi = new THREE.MeshBasicMaterial({ color: 0x4d5440 });
    const steel = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const accent = new THREE.MeshBasicMaterial({ color: 0x424c64 });
    const yellow = new THREE.MeshBasicMaterial({ color: 0x5a4a14 });
    const stencil = new THREE.MeshBasicMaterial({ color: 0xc6c2a8 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x191d28 });
    const winMat = (op = 0.72) => new THREE.MeshBasicMaterial({
      color: 0xffaa55, transparent: true, opacity: op,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });

    /* ===== WEST PROPELLANT TANK FARM ===== centered (-95, -8, -65) =====
       3 vertical fuel tanks in a row, walkway between them, gantry catwalk
       on top, hazard placards. (s8: shrunk 5 tanks → 3 + moved from (-92,-45)
       to (-95,-65) so the 22-wide pad clears both the W-perim road at x=-78
       (east edge -82.5) AND the cross-road at z=-50 (south edge -53.5).) */
    {
      const grp = new THREE.Group();
      grp.position.set(-95, -8, -65);
      // 3 tanks
      const tankR = 3.0, tankH = 11;
      for (let i = 0; i < 3; i++) {
        const tx = (i - 1) * 6.5;
        const tank = new THREE.Mesh(
          new THREE.CylinderGeometry(tankR, tankR, tankH, 16),
          i % 2 === 0 ? concreteLit : oliveHi,
        );
        tank.position.set(tx, tankH / 2 + 0.4, 0);
        grp.add(tank);
        // Dome top
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(tankR, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
          concreteLit,
        );
        dome.position.set(tx, tankH + 0.4, 0);
        grp.add(dome);
        // Equator banding (frost ring)
        [tankH * 0.30, tankH * 0.65].forEach(yh => {
          const band = new THREE.Mesh(new THREE.TorusGeometry(tankR + 0.04, 0.08, 4, 20), stencil);
          band.rotation.x = Math.PI / 2;
          band.position.set(tx, yh + 0.4, 0);
          grp.add(band);
        });
        // Vent stack on dome
        const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.2, 5), steel);
        vent.position.set(tx, tankH + 0.4 + tankR + 1.1, 0);
        grp.add(vent);
        // Aviation strobe at vent tip
        const strobe = this._makeRunningLight(0xff3344, 0.30);
        strobe.position.set(tx, tankH + 0.4 + tankR + 2.4, 0);
        strobe.userData = { rate: 1.4, phase: i * 0.7 };
        grp.add(strobe);
        this.standoff?.strobes.push(strobe);
        // Hazard placard on south face
        const placard = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), yellow);
        placard.position.set(tx, tankH * 0.55 + 0.4, tankR + 0.04);
        grp.add(placard);
      }
      // Gantry catwalk linking dome tops (s8: 34u → 13u for 3 tanks)
      const cat = new THREE.Mesh(new THREE.BoxGeometry(13, 0.20, 1.0), accent);
      cat.position.set(0, tankH + 0.4 + tankR + 0.12, 0);
      grp.add(cat);
      [-0.50, 0.50].forEach(zo => {
        const railTop = new THREE.Mesh(new THREE.BoxGeometry(13, 0.06, 0.06), steel);
        railTop.position.set(0, tankH + 0.4 + tankR + 1.1, zo);
        grp.add(railTop);
        const railMid = new THREE.Mesh(new THREE.BoxGeometry(13, 0.04, 0.04), steel);
        railMid.position.set(0, tankH + 0.4 + tankR + 0.6, zo);
        grp.add(railMid);
      });
      // Concrete pad under tanks (s8: 36u → 22u for 3 tanks)
      const pad = new THREE.Mesh(new THREE.BoxGeometry(22, 0.30, 8), concrete);
      pad.position.set(0, 0.15, 0);
      grp.add(pad);
      // Containment berm around the pad (s8: 36.4 → 22.4, sx*18 → sx*11)
      [[-1, 0, 0, 8.4], [1, 0, 0, 8.4], [0, 0, -1, 22.4], [0, 0, 1, 22.4]].forEach(([sx, _sy, sz, len]) => {
        const isLong = sz === 0;
        const curb = new THREE.Mesh(
          new THREE.BoxGeometry(isLong ? 0.40 : len, 0.45, isLong ? 8.4 : 0.40),
          concreteLit,
        );
        curb.position.set(sx * 11, 0.22, sz * 4);
        grp.add(curb);
      });
      // Service ladder up the middle tank
      for (let h = 0.8; h < tankH; h += 0.40) {
        const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 4), steel);
        rung.rotation.z = Math.PI / 2;
        rung.position.set(0, h, tankR + 0.10);
        grp.add(rung);
      }
      // Pumphouse shed at the south end (s8: x -19 → -13)
      const shed = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.0, 4.0), concrete);
      shed.position.set(-13, 1.5, 0);
      grp.add(shed);
      const shedRoof = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.20, 4.4), concreteLit);
      shedRoof.position.set(-13, 3.10, 0);
      grp.add(shedRoof);
      const shedDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.7), winMat(0.55));
      shedDoor.position.set(-13, 0.85, 2.04);
      shedDoor.userData = { rate: 4.0, phase: Math.random() * 6, baseOpacity: 0.55 };
      grp.add(shedDoor);
      this.standoff?.windows.push(shedDoor);
      // 2 service vehicles parked alongside (s8: x 14/17 → 8/11)
      [{ x: 8, z: -5.5, c: olive }, { x: 11, z: -5.5, c: oliveHi }].forEach(v => {
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 4.5), v.c);
        body.position.set(v.x, 0.95, v.z);
        body.rotation.y = -0.1;
        grp.add(body);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.5), accent);
        cab.position.set(v.x, 1.5, v.z + 1.6);
        cab.rotation.y = body.rotation.y;
        grp.add(cab);
      });
      this.scene.add(grp);
    }

    /* ===== EAST AIRCRAFT MAINTENANCE HANGAR ===== centered (+95, -8, -25) =====
       Arch hangar w/ open south door, lit interior, parked silhouette
       inside, antenna mast on roof, side personnel doors. (s8: shrunk
       18×28 → 14×22 hangar w/ 20×30 apron, moved (+92,-45) → (+95,-25)
       so the apron clears the E-perim road at x=+78 (west edge +82.5)
       AND the cross-road at z=-50 (south edge -53.5).) */
    {
      const grp = new THREE.Group();
      grp.position.set(95, -8, -25);
      const hW = 14, hH = 9, hD = 22;
      // Concrete apron
      const apron = new THREE.Mesh(new THREE.BoxGeometry(hW + 6, 0.25, hD + 8), concrete);
      apron.position.set(0, 0.12, 0);
      grp.add(apron);
      // Hangar shell — box w/ chamfered top suggesting arch
      const shell = new THREE.Mesh(new THREE.BoxGeometry(hW, hH, hD), oliveHi);
      shell.position.set(0, hH / 2, 0);
      grp.add(shell);
      // Arched roof — half cylinder
      const roof = new THREE.Mesh(
        new THREE.CylinderGeometry(hW / 2, hW / 2, hD, 14, 1, true, 0, Math.PI),
        oliveHi,
      );
      roof.rotation.x = Math.PI / 2;
      roof.rotation.z = Math.PI;  // open side faces +y, capped on bottom by the shell
      roof.position.set(0, hH, 0);
      grp.add(roof);
      // Roof ribs (visual structure)
      for (let i = -hD / 2 + 2; i <= hD / 2 - 2; i += 4) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(hW / 2 + 0.15, 0.10, 4, 16, Math.PI), accent);
        rib.rotation.y = Math.PI / 2;
        rib.position.set(0, hH, i);
        grp.add(rib);
      }
      // South-end open hangar door — big lit rectangle showing interior
      const doorOpen = new THREE.Mesh(new THREE.PlaneGeometry(hW * 0.78, hH * 0.85), winMat(0.55));
      doorOpen.position.set(0, hH * 0.42, hD / 2 + 0.05);
      doorOpen.userData = { rate: 3.6, phase: Math.random() * 6, baseOpacity: 0.55 };
      grp.add(doorOpen);
      this.standoff?.windows.push(doorOpen);
      // Door frame
      const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(hW * 0.82, 0.30, 0.35), steel);
      doorFrame.position.set(0, hH * 0.85 + 0.15, hD / 2 + 0.10);
      grp.add(doorFrame);
      // Parked vehicle silhouette inside (visible through open door)
      const parkedBody = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 8), dark);
      parkedBody.position.set(-2, 0.85, 4);
      grp.add(parkedBody);
      const parkedCab = new THREE.Mesh(new THREE.BoxGeometry(4, 1.0, 2.4), dark);
      parkedCab.position.set(-2, 1.95, 5.5);
      grp.add(parkedCab);
      // Yellow caution chevrons painted on apron in front of door
      [-3, -1, 1, 3].forEach(off => {
        const chev = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 1.4), yellow);
        chev.position.set(off, 0.26, hD / 2 + 2.0);
        grp.add(chev);
      });
      // Side personnel doors w/ warm glow
      [-hD / 4, hD / 4].forEach(zo => {
        const sideDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.7), winMat(0.55));
        sideDoor.position.set(-hW / 2 - 0.05, 0.85, zo);
        sideDoor.rotation.y = Math.PI / 2;
        sideDoor.userData = { rate: 4.2, phase: Math.random() * 6, baseOpacity: 0.55 };
        grp.add(sideDoor);
        this.standoff?.windows.push(sideDoor);
      });
      // Roof antenna mast
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 6, 5), steel);
      mast.position.set(hW * 0.3, hH + hW / 2 + 3, -hD * 0.3);
      grp.add(mast);
      const mastStrobe = this._makeRunningLight(0xff3344, 0.35);
      mastStrobe.position.set(hW * 0.3, hH + hW / 2 + 6.5, -hD * 0.3);
      mastStrobe.userData = { rate: 1.3, phase: Math.random() * 6 };
      grp.add(mastStrobe);
      this.standoff?.strobes.push(mastStrobe);
      // Lit window strip on the long west face
      for (let zw = -hD / 2 + 4; zw <= hD / 2 - 4; zw += 4) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), winMat(0.65));
        w.position.set(-hW / 2 - 0.05, hH * 0.65, zw);
        w.rotation.y = Math.PI / 2;
        w.userData = { rate: 4.6 + Math.random(), phase: Math.random() * 6, baseOpacity: 0.65 };
        grp.add(w);
        this.standoff?.windows.push(w);
      }
      // Apron taxi-line lights
      for (let zw = -hD / 2 + 2; zw <= hD / 2 + 6; zw += 2) {
        const light = this._makeRunningLight(0x4488ff, 0.10);
        light.position.set(hW / 2 + 2, 0.15, zw);
        grp.add(light);
        const light2 = this._makeRunningLight(0x4488ff, 0.10);
        light2.position.set(-hW / 2 - 2, 0.15, zw);
        grp.add(light2);
      }
      // Fuel bowser parked beside the hangar
      const bowser = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 5.5), olive);
      bowser.position.set(hW / 2 + 4, 1.05, 4);
      grp.add(bowser);
      const bowserTank = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 4, 14),
        concreteLit,
      );
      bowserTank.rotation.z = Math.PI / 2;
      bowserTank.position.set(hW / 2 + 4, 2.55, 3.5);
      grp.add(bowserTank);
      this.scene.add(grp);
    }

    /* ===== NW SECONDARY LAUNCH PAD ===== centered (-92, -8, -100) =====
       Smaller silo (Pad 8 reads as a sister site to the hero Pad 7). Just
       silo + pad + service gantry + sandbag wrap + warning sign. */
    {
      const grp = new THREE.Group();
      grp.position.set(-92, -8, -100);
      // Octagonal pad
      const padR = 7, padH = 1.0;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(padR, padR + 0.3, padH, 8), concrete);
      pad.position.set(0, padH / 2, 0);
      grp.add(pad);
      // Painted target ring
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(padR * 0.85 - 0.18, padR * 0.85, 32),
        stencil,
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, padH + 0.05, 0);
      grp.add(ring);
      // Silo (smaller than Pad 7's)
      const siloR = 1.8, siloH = 14;
      const silo = new THREE.Mesh(new THREE.CylinderGeometry(siloR, siloR + 0.25, siloH, 12), concrete);
      silo.position.set(0, padH + siloH / 2, 0);
      grp.add(silo);
      // Caution chevrons
      for (let h = padH + 1.5; h < padH + siloH - 1; h += 3) {
        const chev = new THREE.Mesh(new THREE.TorusGeometry(siloR + 0.05, 0.08, 4, 14), yellow);
        chev.rotation.x = Math.PI / 2;
        chev.position.set(0, h, 0);
        grp.add(chev);
      }
      // Number "08" stencil
      const num = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), stencil);
      num.position.set(0, padH + siloH * 0.5, siloR + 0.04);
      grp.add(num);
      // Cap
      const cap = new THREE.Mesh(new THREE.ConeGeometry(siloR + 0.15, 1.6, 12), concreteLit);
      cap.position.set(0, padH + siloH + 0.8, 0);
      grp.add(cap);
      // Strobe
      const siloStrobe = this._makeRunningLight(0xff3344, 0.55);
      siloStrobe.position.set(0, padH + siloH + 1.8, 0);
      siloStrobe.userData = { rate: 1.5, phase: Math.random() * 6 };
      grp.add(siloStrobe);
      this.standoff?.strobes.push(siloStrobe);
      // 2-leg service mast (no full lattice — secondary site is leaner)
      [-1, 1].forEach(s => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, siloH + 1, 5), steel);
        post.position.set(s * (siloR + 1.6), (siloH + 1) / 2 + padH, 0);
        grp.add(post);
      });
      const xbar = new THREE.Mesh(new THREE.BoxGeometry((siloR + 1.6) * 2, 0.14, 0.14), steel);
      xbar.position.set(0, padH + siloH * 0.55, 0);
      grp.add(xbar);
      // Sandbag perimeter (s18: off-pad → y=ground)
      const bagMat = new THREE.MeshBasicMaterial({ color: 0x2a3040 });
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        const r = padR + 1.5;
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.36, 0.55), bagMat);
        b.position.set(Math.cos(a) * r, 0.18, Math.sin(a) * r);
        b.rotation.y = a;
        grp.add(b);
      }
      // Small bunker beside it
      const bcW = 5, bcH = 4, bcD = 5;
      const bunker = new THREE.Mesh(new THREE.BoxGeometry(bcW, bcH, bcD), concrete);
      bunker.position.set(padR + 5, bcH / 2, 4);
      grp.add(bunker);
      const bunkerRoof = new THREE.Mesh(new THREE.BoxGeometry(bcW + 0.3, 0.22, bcD + 0.3), concreteLit);
      bunkerRoof.position.set(padR + 5, bcH + 0.11, 4);
      grp.add(bunkerRoof);
      const slit = new THREE.Mesh(new THREE.PlaneGeometry(bcW * 0.6, 0.6), winMat(0.78));
      slit.position.set(padR + 5, bcH * 0.6, 4 + bcD / 2 + 0.04);
      slit.userData = { rate: 4.4, phase: Math.random() * 6, baseOpacity: 0.78 };
      grp.add(slit);
      this.standoff?.windows.push(slit);
      // 4 corner floodlight pylons (smaller than hero pad)
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
        const px = sx * (padR + 6), pz = sz * (padR + 6);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.20, 8, 5), steel);
        pole.position.set(px, 4, pz);
        grp.add(pole);
        const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.25, 0.50), accent);
        lampHead.position.set(px - sx * 0.6, 7.8, pz - sz * 0.6);
        grp.add(lampHead);
        const lens = this._makeRunningLight(0xfff0c8, 0.22);
        lens.position.set(px - sx * 0.9, 7.6, pz - sz * 0.9);
        grp.add(lens);
        const tipS = this._makeRunningLight(0xff3344, 0.30);
        tipS.position.set(px, 8.5, pz);
        tipS.userData = { rate: 1.6, phase: Math.random() * 6 };
        grp.add(tipS);
        this.standoff?.strobes.push(tipS);
      });
      this.scene.add(grp);
    }

    /* ===== NE SAM BATTERY ===== centered (+92, -8, -100) =====
       Air defense site: 3 inclined launcher rails, 1 fire-control radar
       dish, command trailer w/ rotating dish on top. Reads as Patriot/
       THAAD-style battery. */
    {
      const grp = new THREE.Group();
      grp.position.set(92, -8, -100);
      // Concrete pad
      const pad = new THREE.Mesh(new THREE.BoxGeometry(20, 0.25, 18), concrete);
      pad.position.set(0, 0.12, 0);
      grp.add(pad);
      // 3 launcher units (inclined box-launchers on swivel base)
      const launcherPositions = [[-6, -3], [0, -5], [6, -3]];
      launcherPositions.forEach(([lx, lz]) => {
        // Swivel base
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.8, 10), olive);
        base.position.set(lx, 0.65, lz);
        grp.add(base);
        // Trailer chassis
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 4.5), oliveHi);
        chassis.position.set(lx, 0.30, lz);
        grp.add(chassis);
        // Inclined launcher box (4 missile cells, raised at 65°)
        const launcherBox = new THREE.Group();
        launcherBox.position.set(lx, 1.4, lz);
        launcherBox.rotation.x = -Math.PI * 0.35;  // tilted up toward N
        const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.0, 1.6), olive);
        box.position.y = 2.0;
        launcherBox.add(box);
        // 4 cell tubes on top of box face
        [[-0.65, -0.40], [0.65, -0.40], [-0.65, 0.40], [0.65, 0.40]].forEach(([cx, cz]) => {
          const cell = new THREE.Mesh(
            new THREE.CylinderGeometry(0.30, 0.30, 4.0, 8),
            steel,
          );
          cell.position.set(cx, 2.0, cz + 0.85);
          launcherBox.add(cell);
          // Missile nose poking out
          const noseTip = new THREE.Mesh(new THREE.ConeGeometry(0.30, 0.55, 8), accent);
          noseTip.position.set(cx, 4.25, cz + 0.85);
          launcherBox.add(noseTip);
        });
        grp.add(launcherBox);
        // Wheels
        [[-1.0, -1.6], [1.0, -1.6], [-1.0, 1.6], [1.0, 1.6]].forEach(([wx, wz]) => {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.30, 10), dark);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(lx + wx, 0.42, lz + wz);
          grp.add(wheel);
        });
      });
      // Fire-control radar — large parabolic dish on a tracked mount
      {
        const fcX = 0, fcZ = 4;
        const fcBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 4.0), oliveHi);
        fcBase.position.set(fcX, 0.30, fcZ);
        grp.add(fcBase);
        const fcMast = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.40, 2.6, 8), steel);
        fcMast.position.set(fcX, 1.85, fcZ);
        grp.add(fcMast);
        // Pivot
        const fcPivot = new THREE.Group();
        fcPivot.position.set(fcX, 3.2, fcZ);
        grp.add(fcPivot);
        const fcDish = new THREE.Mesh(
          new THREE.SphereGeometry(2.4, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
          accent,
        );
        fcDish.rotation.x = -Math.PI * 0.30;
        fcPivot.add(fcDish);
        // Feed horn
        const feedHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.30, 0.95, 6), steel);
        feedHorn.position.set(0, 1.3, 0.5);
        feedHorn.rotation.x = Math.PI / 2;
        fcPivot.add(feedHorn);
        // Cross-bar struts holding feed
        [-1, 1].forEach(s => {
          const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 4), steel);
          strut.position.set(s * 0.6, 0.7, 0.4);
          strut.rotation.x = Math.PI / 2;
          strut.rotation.z = -s * 0.4;
          fcPivot.add(strut);
        });
        // Tracks (visible)
        [-1.6, 1.6].forEach(tx => {
          const track = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 4.4), dark);
          track.position.set(fcX + tx, 0.22, fcZ);
          grp.add(track);
        });
        this._radarBuildingPivots ??= [];
        this._radarBuildingPivots.push(fcPivot);
      }
      // Command trailer w/ small uplink dish on roof
      {
        const ctX = -8, ctZ = 4;
        const ctBody = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.4, 5.2), olive);
        ctBody.position.set(ctX, 1.20, ctZ);
        grp.add(ctBody);
        const ctRoof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 5.4), oliveHi);
        ctRoof.position.set(ctX, 2.49, ctZ);
        grp.add(ctRoof);
        // Lit window strip
        const ctWin = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), winMat(0.70));
        ctWin.position.set(ctX, 1.55, ctZ + 2.62);
        ctWin.userData = { rate: 4.6, phase: Math.random() * 6, baseOpacity: 0.70 };
        grp.add(ctWin);
        this.standoff?.windows.push(ctWin);
        // Small uplink dish
        const ctDish = new THREE.Mesh(
          new THREE.SphereGeometry(0.8, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
          accent,
        );
        ctDish.position.set(ctX, 3.4, ctZ - 1.5);
        ctDish.rotation.x = -Math.PI * 0.40;
        ctDish.rotation.z = -Math.PI / 2;
        grp.add(ctDish);
      }
      // Ammo / reload pallet stack on the east edge
      [[8, 4, oliveHi], [8, 6, olive]].forEach(([rx, rz, c]) => {
        const reload = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.6), c);
        reload.position.set(rx, 0.50, rz);
        grp.add(reload);
        // Missile-canister cylinders on top
        [-0.55, 0.55].forEach(co => {
          const can = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.9, 8), steel);
          can.rotation.x = Math.PI / 2;
          can.position.set(rx, 1.12, rz + co);
          grp.add(can);
        });
      });
      // 2 corner floods
      [[1, 1], [-1, 1]].forEach(([sx, sz]) => {
        const px = sx * 8.5, pz = sz * 7.5;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.20, 7, 5), steel);
        pole.position.set(px, 3.5, pz);
        grp.add(pole);
        const lampH = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.25, 0.50), accent);
        lampH.position.set(px - sx * 0.5, 6.85, pz - sz * 0.5);
        grp.add(lampH);
        const lens = this._makeRunningLight(0xfff0c8, 0.22);
        lens.position.set(px - sx * 0.8, 6.7, pz - sz * 0.8);
        grp.add(lens);
      });
      this.scene.add(grp);
    }
  },

  /* ---------- s5: NW quadrant fill (broken-dish POI) ----------
     User feedback: "we have this area from broken dish fill it out i don't
     want empty space anywhere". From the BROKEN DISH POI cam at (-38, 8,
     -14) yaw -0.98 the foreground asphalt and mid-distance flanks read
     as empty road between the deck and the broken-dish host at (-66, -35).
     6 layered clusters at FOREGROUND (8-15u), MID (20-35u), FAR (40-65u)
     so every depth band has silhouette. */
  _buildNWQuadrantFill() {
    const olive = new THREE.MeshBasicMaterial({ color: 0x3a4030 });
    const oliveHi = new THREE.MeshBasicMaterial({ color: 0x4d5440 });
    const concrete = new THREE.MeshBasicMaterial({ color: 0x3a4358 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x4a5468 });
    const steel = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const accent = new THREE.MeshBasicMaterial({ color: 0x424c64 });
    const yellow = new THREE.MeshBasicMaterial({ color: 0x5a4a14 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x191d28 });
    const stencil = new THREE.MeshBasicMaterial({ color: 0xc6c2a8 });
    const winMat = (op = 0.72) => new THREE.MeshBasicMaterial({
      color: 0xffaa55, transparent: true, opacity: op,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });

    /* ----- FOREGROUND (8-15u from broken-dish cam): field maintenance pad
       w/ Warthog up on jack stands, tool crates, work lamp ----- */
    {
      const grp = new THREE.Group();
      grp.name = 'nw_maintenance_pad';
      grp.position.set(-22, -8, -22);
      // Concrete pad
      const pad = new THREE.Mesh(new THREE.BoxGeometry(7, 0.2, 6), concreteLit);
      pad.position.set(0, 0.10, 0);
      grp.add(pad);
      // Yellow caution border
      [[-3.5, 0, 0.30, 6.0], [3.5, 0, 0.30, 6.0], [0, -3.0, 7.0, 0.30], [0, 3.0, 7.0, 0.30]].forEach(([x, z, w, d]) => {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), yellow);
        stripe.position.set(x, 0.22, z);
        grp.add(stripe);
      });
      // Warthog up on jack stands (raised 0.4u)
      const car = this._buildWarthogMesh(olive, oliveHi, steel, dark);
      car.position.set(0, 0.40, 0);
      car.rotation.y = Math.PI * 0.5;
      grp.add(car);
      // 4 jack stands under the wheels (visible triangular bases)
      [[-1.30, -1.50], [1.30, -1.50], [-1.30, 1.40], [1.30, 1.40]].forEach(([wx, wz]) => {
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.30, 0.45, 6), steel);
        stand.position.set(wz, 0.225, -wx);  // rotated 90° to match car
        grp.add(stand);
      });
      // Tool crates
      [[-2.8, -2.2, oliveHi], [-2.8, -1.0, olive], [2.8, -1.6, olive]].forEach(([cx, cz, c]) => {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 1.0), c);
        crate.position.set(cx, 0.45, cz);
        crate.rotation.y = (Math.random() - 0.5) * 0.20;
        grp.add(crate);
      });
      // Work lamp on telescoping pole
      const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.6, 5), steel);
      lampPole.position.set(2.5, 1.90, 1.8);
      grp.add(lampPole);
      const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.30, 0.40), accent);
      lampHead.position.set(2.5, 3.55, 1.8);
      grp.add(lampHead);
      const lampLens = this._makeRunningLight(0xfff0c8, 0.30);
      lampLens.position.set(2.5, 3.40, 2.10);
      grp.add(lampLens);
      // Mechanic's tool chest (red)
      const chest = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.0, 0.55),
        new THREE.MeshBasicMaterial({ color: 0xc83838 }),
      );
      chest.position.set(-2.6, 0.60, 1.6);
      grp.add(chest);
      this.scene.add(grp);
    }

    /* ----- MID-LEFT (20-30u): SIGINT mobile listening post — 3 vans
       parallel-parked w/ rooftop antennas, lit windscreens, cable runs ----- */
    {
      const grp = new THREE.Group();
      grp.name = 'nw_sigint_vans';
      grp.position.set(-38, -8, -28);  // s7: shifted west off the x=-30 walkway
      [{ z: -6, c: olive }, { z: 0, c: oliveHi }, { z: 6, c: olive }].forEach((v, i) => {
        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 4.6), v.c);
        body.position.set(0, 1.10, v.z);
        grp.add(body);
        // Cab
        const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, 1.5), accent);
        cab.position.set(0, 1.55, v.z + 1.85);
        grp.add(cab);
        // Lit windscreen
        const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.55), winMat(0.78));
        ws.position.set(0, 1.65, v.z + 2.61);
        ws.userData = { rate: 4.4 + Math.random(), phase: Math.random() * 6, baseOpacity: 0.78 };
        grp.add(ws);
        this.standoff?.windows.push(ws);
        // Body side panel light strip
        const sideStrip = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.18), winMat(0.55));
        sideStrip.position.set(1.31, 1.30, v.z);
        sideStrip.rotation.y = -Math.PI / 2;
        sideStrip.userData = { rate: 4.0, phase: Math.random() * 6, baseOpacity: 0.55 };
        grp.add(sideStrip);
        this.standoff?.windows.push(sideStrip);
        // Wheels
        [[-1.30, -1.5], [1.30, -1.5], [-1.30, 1.5], [1.30, 1.5]].forEach(([wx, wz]) => {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.30, 10), dark);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(wx, 0.45, v.z + wz);
          grp.add(wheel);
        });
        // Rooftop dish (different angle per van)
        const dish = new THREE.Mesh(
          new THREE.SphereGeometry(0.65, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
          accent,
        );
        dish.position.set(0, 2.4, v.z - 0.6);
        dish.rotation.x = -Math.PI * 0.40 + i * 0.15;
        dish.rotation.z = -Math.PI / 2 + i * 0.20;
        grp.add(dish);
        // Vertical whip antenna
        const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 2.4, 4), steel);
        whip.position.set(-0.9, 3.20, v.z + 0.3);
        grp.add(whip);
        // Tip strobe
        const tipS = this._makeRunningLight(0x4488ff, 0.10);
        tipS.position.set(-0.9, 4.40, v.z + 0.3);
        tipS.userData = { rate: 2.8, phase: i * 1.3 };
        grp.add(tipS);
      });
      // Cable run between vans (low-profile bundle along the ground)
      const cable = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.10, 14), accent);
      cable.position.set(-1.6, 0.05, 0);
      grp.add(cable);
      // Diesel generator beside the convoy
      const gen = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 2.6), olive);
      gen.position.set(-3.0, 0.65, -3);
      grp.add(gen);
      const genStack = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.2, 5), steel);
      genStack.position.set(-3.0 + 0.55, 1.85, -3 - 0.6);
      grp.add(genStack);
      this.scene.add(grp);
    }

    /* ----- MID-CENTER (35-45u): tactical aid station — GP-medium tent
       w/ red cross, medics' jeep, fuel cans ----- */
    {
      const grp = new THREE.Group();
      grp.name = 'nw_aid_station';
      grp.position.set(-50, -8, -10);
      // Tent — long ridge tent (6u long)
      const tentL = 6.5, tentW = 4.0, tentH = 2.4;
      // Front wall (triangular)
      const frontPts = [
        new THREE.Vector3(-tentW / 2, 0, 0),
        new THREE.Vector3(tentW / 2, 0, 0),
        new THREE.Vector3(0, tentH, 0),
      ];
      const buildTri = (z) => {
        const tri = new THREE.BufferGeometry();
        tri.setAttribute('position', new THREE.Float32BufferAttribute([
          frontPts[0].x, frontPts[0].y, z,
          frontPts[1].x, frontPts[1].y, z,
          frontPts[2].x, frontPts[2].y, z,
        ], 3));
        tri.setIndex([0, 1, 2]);
        tri.computeVertexNormals();
        return new THREE.Mesh(tri, oliveHi);
      };
      grp.add(buildTri(-tentL / 2));
      grp.add(buildTri(tentL / 2));
      // Sloped sides (2 quads from ridge to ground)
      [-1, 1].forEach(s => {
        const slope = new THREE.Mesh(
          new THREE.PlaneGeometry(Math.hypot(tentW / 2, tentH), tentL),
          olive,
        );
        slope.position.set(s * tentW / 4, tentH / 2, 0);
        slope.rotation.y = Math.PI / 2;
        slope.rotation.x = -s * Math.atan2(tentW / 2, tentH);
        grp.add(slope);
      });
      // Ridge pole
      const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, tentL + 0.2, 5), steel);
      ridge.rotation.x = Math.PI / 2;
      ridge.position.set(0, tentH, 0);
      grp.add(ridge);
      // Front door panel (lit warm interior)
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6), winMat(0.65));
      door.position.set(0, 0.80, -tentL / 2 - 0.04);
      door.userData = { rate: 4.0, phase: Math.random() * 6, baseOpacity: 0.65 };
      grp.add(door);
      this.standoff?.windows.push(door);
      // Red cross panel on the side
      const crossBg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), stencil);
      crossBg.position.set(tentW / 2 - 0.05, 1.4, 0);
      crossBg.rotation.y = -Math.PI / 2;
      grp.add(crossBg);
      const crossV = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.7),
        new THREE.MeshBasicMaterial({ color: 0xc83838 }));
      crossV.position.set(tentW / 2 - 0.04, 1.4, 0);
      crossV.rotation.y = -Math.PI / 2;
      grp.add(crossV);
      const crossH = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.25),
        new THREE.MeshBasicMaterial({ color: 0xc83838 }));
      crossH.position.set(tentW / 2 - 0.04, 1.4, 0);
      crossH.rotation.y = -Math.PI / 2;
      grp.add(crossH);
      // Medics' jeep parked beside
      const jeep = this._buildWarthogMesh(olive, oliveHi, steel, dark);
      jeep.position.set(-tentW - 1, 0, 1.5);
      jeep.rotation.y = Math.PI * 0.45;
      // Mark roof w/ red cross too
      const jeepCross = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), stencil);
      jeepCross.position.set(0, 2.2, -0.2);
      jeepCross.rotation.x = -Math.PI / 2;
      jeep.add(jeepCross);
      const jcV = new THREE.Mesh(new THREE.PlaneGeometry(0.20, 0.55),
        new THREE.MeshBasicMaterial({ color: 0xc83838 }));
      jcV.position.set(0, 2.21, -0.2);
      jcV.rotation.x = -Math.PI / 2;
      jeep.add(jcV);
      const jcH = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.20),
        new THREE.MeshBasicMaterial({ color: 0xc83838 }));
      jcH.position.set(0, 2.21, -0.2);
      jcH.rotation.x = -Math.PI / 2;
      jeep.add(jcH);
      grp.add(jeep);
      // Fuel cans rack beside tent
      [[3.5, -2.5], [3.8, -2.0], [3.5, -1.5]].forEach(([cx, cz]) => {
        const can = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.50, 0.40), olive);
        can.position.set(cx, 0.25, cz);
        grp.add(can);
      });
      this.scene.add(grp);
    }

    /* ----- MID-FAR (40-55u): signal-relay tower — tall lattice w/
       slewing dish on platform, vertical antennas, base equipment ----- */
    {
      const grp = new THREE.Group();
      grp.name = 'nw_signal_relay_tower';
      grp.position.set(-58, -8, -22);
      const towerH = 22, baseW = 3.0;
      // 4 lattice legs
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, towerH, 5), steel);
        leg.position.set(Math.cos(a) * baseW * 0.5, towerH / 2, Math.sin(a) * baseW * 0.5);
        grp.add(leg);
      }
      // Cross-bracing rings every 2u
      for (let h = 1.5; h < towerH - 0.5; h += 2.0) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(baseW * 0.55, 0.05, 4, 16), steel);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, h, 0);
        grp.add(ring);
      }
      // Diagonal X-bracing per face per tier
      for (let tier = 0; tier < 8; tier++) {
        const yBase = tier * (towerH / 8);
        const tierH = towerH / 8;
        [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(theta => {
          const x1 = Math.cos(theta) * baseW * 0.5;
          const z1 = Math.sin(theta) * baseW * 0.5;
          const x2 = Math.cos(theta + Math.PI / 2) * baseW * 0.5;
          const z2 = Math.sin(theta + Math.PI / 2) * baseW * 0.5;
          const len = Math.hypot(x2 - x1, z2 - z1);
          const diag = Math.hypot(len, tierH);
          [+1, -1].forEach(dir => {
            const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, diag, 4), steel);
            bar.position.set((x1 + x2) / 2, yBase + tierH / 2, (z1 + z2) / 2);
            bar.rotation.order = 'YXZ';
            bar.rotation.y = Math.atan2(z2 - z1, x2 - x1);
            bar.rotation.z = Math.PI / 2 - dir * Math.atan2(tierH, len);
            grp.add(bar);
          });
        });
      }
      // Service platform at 2/3 height
      const plat = new THREE.Mesh(new THREE.BoxGeometry(baseW * 1.8, 0.12, baseW * 1.6), accent);
      plat.position.set(0, towerH * 0.66, 0.30);
      grp.add(plat);
      // Slewing dish on platform (rotates via _radarBuildingPivots)
      const dishPivot = new THREE.Group();
      dishPivot.position.set(0.6, towerH * 0.66 + 0.6, 0.50);
      grp.add(dishPivot);
      const dish = new THREE.Mesh(
        new THREE.SphereGeometry(1.4, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
        accent,
      );
      dish.rotation.x = -Math.PI * 0.40;
      dishPivot.add(dish);
      const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.18, 0.55, 6), steel);
      feed.position.set(0, 0.6, 0.6);
      feed.rotation.x = Math.PI / 2;
      dishPivot.add(feed);
      this._radarBuildingPivots ??= [];
      this._radarBuildingPivots.push(dishPivot);
      // Top mast w/ aviation strobe
      const topMast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.10, 4.5, 5), steel);
      topMast.position.set(0, towerH + 2.25, 0);
      grp.add(topMast);
      const topStrobe = this._makeRunningLight(0xff3344, 0.55);
      topStrobe.position.set(0, towerH + 4.7, 0);
      topStrobe.userData = { rate: 1.4, phase: Math.random() * 6 };
      grp.add(topStrobe);
      this.standoff?.strobes.push(topStrobe);
      // Mid-mast strobes (red)
      [towerH * 0.40, towerH * 0.80].forEach(yh => {
        const ms = this._makeRunningLight(0xff3344, 0.30);
        ms.position.set(baseW * 0.5 + 0.20, yh, 0);
        ms.userData = { rate: 1.6, phase: Math.random() * 6 };
        grp.add(ms);
        this.standoff?.strobes.push(ms);
      });
      // Base equipment shed
      const shed = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.6, 3.6), concrete);
      shed.position.set(3.5, 1.30, 0);
      grp.add(shed);
      const shedRoof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.20, 3.9), concreteLit);
      shedRoof.position.set(3.5, 2.70, 0);
      grp.add(shedRoof);
      const shedDoor = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), winMat(0.55));
      shedDoor.position.set(3.5, 0.85, 1.84);
      shedDoor.userData = { rate: 4.0, phase: Math.random() * 6, baseOpacity: 0.55 };
      grp.add(shedDoor);
      this.standoff?.windows.push(shedDoor);
      // Cable from shed to tower base
      const cableTray = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 0.30), accent);
      cableTray.position.set(2.0, 0.10, 0);
      grp.add(cableTray);
      // 2 vertical whip antennas flanking the tower
      [-baseW - 1, baseW + 1].forEach(xo => {
        const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 8, 5), steel);
        whip.position.set(xo, 4.0, -2);
        grp.add(whip);
        const whipTip = this._makeRunningLight(0x4488ff, 0.18);
        whipTip.position.set(xo, 8.1, -2);
        grp.add(whipTip);
      });
      this.scene.add(grp);
    }

    /* ----- MID-FAR-LEFT (40-55u): conex container depot — stacked
       containers, forklift, hazard light ----- */
    {
      const grp = new THREE.Group();
      grp.name = 'nw_conex_depot';
      grp.position.set(-92, -8, -18);  // s7: shifted west off the W-perim road at x=-78
      const cW = 4.5, cH = 2.5, cD = 8.5;
      // Bottom row of 3
      [{ x: -5, c: olive }, { x: 0, c: oliveHi }, { x: 5, c: olive }].forEach(({ x, c }) => {
        const cont = new THREE.Mesh(new THREE.BoxGeometry(cW, cH, cD), c);
        cont.position.set(x, cH / 2, 0);
        grp.add(cont);
        // Vertical ribs
        for (let i = -3; i <= 3; i++) {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, cH, 0.08), oliveHi);
          rib.position.set(x + cW / 2 + 0.04, cH / 2, i * 1.2);
          grp.add(rib);
        }
      });
      // Top row of 2 (offset)
      [{ x: -2.5, c: oliveHi }, { x: 2.5, c: olive }].forEach(({ x, c }) => {
        const cont = new THREE.Mesh(new THREE.BoxGeometry(cW, cH, cD * 0.92), c);
        cont.position.set(x, cH * 1.5 + 0.10, 0.3);
        grp.add(cont);
      });
      // 3rd-tier single
      const top = new THREE.Mesh(new THREE.BoxGeometry(cW, cH, cD * 0.85), olive);
      top.position.set(0, cH * 2.5 + 0.20, -0.1);
      grp.add(top);
      // Stencil mark on bottom-row mid container
      const mark = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.30, 0.04), stencil);
      mark.position.set(0, cH * 0.7, cD / 2 + 0.03);
      grp.add(mark);
      // Open container door (lit)
      const cDoor = new THREE.Mesh(new THREE.PlaneGeometry(2.0, cH * 0.75), winMat(0.70));
      cDoor.position.set(-5, cH * 0.45, cD / 2 + 0.03);
      cDoor.userData = { rate: 4.0, phase: Math.random() * 6, baseOpacity: 0.70 };
      grp.add(cDoor);
      this.standoff?.windows.push(cDoor);
      // Forklift parked in front
      {
        const fl = new THREE.Group();
        const fbody = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 2.4), yellow);
        fbody.position.set(0, 0.80, 0);
        fl.add(fbody);
        const fcab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 1.2), accent);
        fcab.position.set(0, 1.90, 0.3);
        fl.add(fcab);
        // Mast
        const mast = new THREE.Mesh(new THREE.BoxGeometry(0.20, 2.6, 0.20), steel);
        mast.position.set(0, 2.10, -1.4);
        fl.add(mast);
        // Forks
        [-0.35, 0.35].forEach(fx => {
          const fork = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 1.8), steel);
          fork.position.set(fx, 0.30, -2.3);
          fl.add(fork);
        });
        // Wheels
        [[-0.65, -1.0], [0.65, -1.0], [-0.65, 1.0], [0.65, 1.0]].forEach(([wx, wz]) => {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.25, 8), dark);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(wx, 0.30, wz);
          fl.add(wheel);
        });
        // Roof beacon
        const beacon = this._makeRunningLight(0xffaa22, 0.22);
        beacon.position.set(0, 2.55, 0);
        beacon.userData = { rate: 2.8, phase: Math.random() * 6 };
        fl.add(beacon);
        fl.position.set(-2, 0, 6.5);
        fl.rotation.y = -0.3;
        grp.add(fl);
      }
      // Hazard light pole
      const hPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 5), steel);
      hPole.position.set(8, 3.0, 5);
      grp.add(hPole);
      const hLamp = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.30, 0.40), accent);
      hLamp.position.set(8 - 0.4, 5.85, 5 - 0.4);
      grp.add(hLamp);
      const hLens = this._makeRunningLight(0xffaa55, 0.30);
      hLens.position.set(8 - 0.7, 5.7, 5 - 0.7);
      grp.add(hLens);
      // Loose pallets on the ground
      [[7.5, 1.5], [9, 1.0], [-9, -1.5]].forEach(([px, pz]) => {
        const pallet = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 1.4), oliveHi);
        pallet.position.set(px, 0.09, pz);
        pallet.rotation.y = Math.random() * 0.4;
        grp.add(pallet);
      });
      this.scene.add(grp);
    }

    /* ----- FAR-LEFT (50-65u): perimeter watchtower w/ rotating searchlight,
       lit cabin, ladder ----- */
    {
      const grp = new THREE.Group();
      grp.name = 'nw_perimeter_watchtower';
      grp.position.set(-92, -8, -8);  // s7: shifted west off the W-perim road at x=-78
      const towH = 9;
      // 4 legs
      [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.20, towH, 5), steel);
        leg.position.set(lx, towH / 2, lz);
        grp.add(leg);
      });
      // Cross-braces
      for (let h = 2; h < towH - 1; h += 2) {
        [[-1.4, -1.4, 1.4, -1.4], [1.4, -1.4, 1.4, 1.4], [1.4, 1.4, -1.4, 1.4], [-1.4, 1.4, -1.4, -1.4]].forEach(([x1, z1, x2, z2]) => {
          const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.0, 4), steel);
          b1.position.set((x1 + x2) / 2, h, (z1 + z2) / 2);
          b1.rotation.order = 'YXZ';
          b1.rotation.y = Math.atan2(z2 - z1, x2 - x1);
          b1.rotation.z = Math.PI / 2;
          grp.add(b1);
        });
      }
      // Cabin floor
      const cabFloor = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.20, 3.6), accent);
      cabFloor.position.set(0, towH, 0);
      grp.add(cabFloor);
      // Cabin walls (4 sides)
      [[0, 1.7, -3.4 / 2 - 0.05, 3.4, 1.5], [0, 1.7, 3.4 / 2 + 0.05, 3.4, 1.5], [-3.4 / 2 - 0.05, 1.7, 0, 1.5, 3.4], [3.4 / 2 + 0.05, 1.7, 0, 1.5, 3.4]].forEach(([x, _y, z, w, d]) => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, d), olive);
        wall.position.set(x, towH + 0.85, z);
        grp.add(wall);
      });
      // Roof
      const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.20, 3.8), oliveHi);
      cabRoof.position.set(0, towH + 1.65, 0);
      grp.add(cabRoof);
      // Lit windows on all 4 sides
      [[0, towH + 1.0, 1.71], [0, towH + 1.0, -1.71], [1.71, towH + 1.0, 0, true], [-1.71, towH + 1.0, 0, true]].forEach(([wx, wy, wz, rotY]) => {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.55), winMat(0.78));
        w.position.set(wx, wy, wz);
        if (rotY) w.rotation.y = Math.PI / 2;
        w.userData = { rate: 4.4, phase: Math.random() * 6, baseOpacity: 0.78 };
        grp.add(w);
        this.standoff?.windows.push(w);
      });
      // Searchlight (rotates) on roof
      const slPivot = new THREE.Group();
      slPivot.position.set(0, towH + 2.0, 0);
      grp.add(slPivot);
      const slBase = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.30, 0.20, 8), steel);
      slPivot.add(slBase);
      const slHead = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 1.0), accent);
      slHead.position.set(0, 0.40, 0.45);
      slPivot.add(slHead);
      const slLens = this._makeRunningLight(0xffe6a0, 0.40);
      slLens.position.set(0, 0.40, 1.05);
      slPivot.add(slLens);
      this._radarBuildingPivots ??= [];
      this._radarBuildingPivots.push(slPivot);
      // Ladder up one side
      for (let h = 0.5; h < towH - 0.3; h += 0.4) {
        const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 4), steel);
        rung.rotation.z = Math.PI / 2;
        rung.position.set(1.4, h, 1.7);
        grp.add(rung);
      }
      // Aviation strobe at very top
      const tipStrobe = this._makeRunningLight(0xff3344, 0.40);
      tipStrobe.position.set(0, towH + 3.2, 0);
      tipStrobe.userData = { rate: 1.5, phase: Math.random() * 6 };
      grp.add(tipStrobe);
      this.standoff?.strobes.push(tipStrobe);
      this.scene.add(grp);
    }

    /* ----- BACK-CENTER (between broken dish + freq map): radio shack +
       barracks w/ lit windows ----- */
    {
      const grp = new THREE.Group();
      grp.name = 'nw_radio_shack';
      grp.position.set(-58, -8, -60);  // s7: shifted south to clear cross-road at z=-50
      // Long barracks
      const bW = 9, bH = 3.2, bD = 4.0;
      const barracks = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, bD), oliveHi);
      barracks.position.set(0, bH / 2, 0);
      grp.add(barracks);
      const bRoof = new THREE.Mesh(new THREE.BoxGeometry(bW + 0.4, 0.25, bD + 0.4), olive);
      bRoof.position.set(0, bH + 0.13, 0);
      grp.add(bRoof);
      // 4 lit windows per long side
      [-bD / 2 - 0.05, bD / 2 + 0.05].forEach(zo => {
        for (let i = -1; i <= 1; i++) {
          const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), winMat(0.78));
          w.position.set(i * 2.6, bH * 0.55, zo);
          if (zo < 0) w.rotation.y = Math.PI;
          w.userData = { rate: 4.6 + Math.random(), phase: Math.random() * 6, baseOpacity: 0.78 };
          grp.add(w);
          this.standoff?.windows.push(w);
        }
      });
      // Door at one end (warm glow)
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.7), winMat(0.55));
      door.position.set(-bW / 2 - 0.05, 0.85, 0);
      door.rotation.y = -Math.PI / 2;
      door.userData = { rate: 3.6, phase: Math.random() * 6, baseOpacity: 0.55 };
      grp.add(door);
      this.standoff?.windows.push(door);
      // Roof whip antennas
      [[-2, 0], [2, 0]].forEach(([wx, wz]) => {
        const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 4, 5), steel);
        whip.position.set(wx, bH + 2, wz);
        grp.add(whip);
      });
      // Smaller radio shack beside it
      const rW = 3.6, rH = 2.6, rD = 3.2;
      const radio = new THREE.Mesh(new THREE.BoxGeometry(rW, rH, rD), concrete);
      radio.position.set(bW / 2 + 3, rH / 2, 0);
      grp.add(radio);
      const rRoof = new THREE.Mesh(new THREE.BoxGeometry(rW + 0.3, 0.20, rD + 0.3), concreteLit);
      rRoof.position.set(bW / 2 + 3, rH + 0.10, 0);
      grp.add(rRoof);
      const rDoor = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.6), winMat(0.65));
      rDoor.position.set(bW / 2 + 3, 0.80, rD / 2 + 0.04);
      rDoor.userData = { rate: 4.0, phase: Math.random() * 6, baseOpacity: 0.65 };
      grp.add(rDoor);
      this.standoff?.windows.push(rDoor);
      // Roof dish array (3 small dishes)
      [-1.0, 0, 1.0].forEach((xo, i) => {
        const d = new THREE.Mesh(
          new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
          accent,
        );
        d.position.set(bW / 2 + 3 + xo, rH + 0.7, -0.5);
        d.rotation.x = -Math.PI * 0.40;
        d.rotation.z = -Math.PI / 2 + i * 0.2;
        grp.add(d);
      });
      this.scene.add(grp);
    }
  },

  /* ---------- s6: SW quadrant fill (biostation POI) ----------
     User feedback: "biostation is completely empty give it cool building
     colors etc". The biostation host itself was rebuilt in `_buildPanels`
     with neon pink/cyan/purple/green colored pods + airlock dome + 6
     bio-luminescent specimen tanks. This function adds the surrounding
     SW quadrant fill: research lab, decontamination unit, refrigerated
     specimen yard, geodesic greenhouse cluster, incinerator stack,
     waste-water clarifier — all keyed to the same neon bio palette so
     the whole quadrant reads as a xenobio research zone. */
  _buildSWQuadrantFill() {
    const labWhite   = new THREE.MeshBasicMaterial({ color: 0xb8c4d4 });
    const labWhiteHi = new THREE.MeshBasicMaterial({ color: 0xd4dce8 });
    const concrete = new THREE.MeshBasicMaterial({ color: 0x3a4358 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x4a5468 });
    const steel = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const accent = new THREE.MeshBasicMaterial({ color: 0x424c64 });
    const yellow = new THREE.MeshBasicMaterial({ color: 0x5a4a14 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x191d28 });
    const stencil = new THREE.MeshBasicMaterial({ color: 0xc6c2a8 });
    const neonPink = (op = 0.85) => new THREE.MeshBasicMaterial({ color: 0xff5fa8, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
    const neonCyan = (op = 0.85) => new THREE.MeshBasicMaterial({ color: 0x44ddee, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
    const neonGreen = (op = 0.85) => new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
    const neonPurple = (op = 0.85) => new THREE.MeshBasicMaterial({ color: 0xaa44ee, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
    const winMat = (op = 0.72) => new THREE.MeshBasicMaterial({
      color: 0xffaa55, transparent: true, opacity: op,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });

    /* ===== BIO-RESEARCH LAB ===== centered (-25, -8, 30) =====
       Multi-story clean-white concrete building w/ neon-cyan window grid,
       neon-green airlock door, animated rooftop equipment. */
    {
      const grp = new THREE.Group();
      grp.position.set(-25, -8, 20);  // s11: reverted s10 — splitting it east just made a 2nd distant cluster that looked worse
      const bW = 9, bH = 6.5, bD = 6;
      const shell = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, bD), labWhite);
      shell.position.set(0, bH / 2, 0);
      grp.add(shell);
      // Roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(bW + 0.4, 0.30, bD + 0.4), labWhiteHi);
      roof.position.set(0, bH + 0.15, 0);
      grp.add(roof);
      // Cyan window grid on the front face (3 cols × 2 rows)
      for (let row = 0; row < 2; row++) {
        for (let col = -1; col <= 1; col++) {
          const w = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), neonCyan(0.78));
          w.position.set(col * 2.6, bH * 0.30 + row * 2.4, bD / 2 + 0.04);
          w.userData = { rate: 4.0 + Math.random(), phase: Math.random() * 6, baseOpacity: 0.78 };
          grp.add(w);
          this.standoff?.windows.push(w);
        }
      }
      // Neon-green airlock door (camera-facing centered)
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.4), neonGreen(0.72));
      door.position.set(0, 1.2, bD / 2 + 0.05);
      door.userData = { rate: 3.6, phase: Math.random() * 6, baseOpacity: 0.72 };
      grp.add(door);
      this.standoff?.windows.push(door);
      // Door frame
      const dframe = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.7, 0.18), steel);
      dframe.position.set(0, 1.35, bD / 2 + 0.10);
      grp.add(dframe);
      // Side accent strip (vertical pink, full height)
      [-bW / 2 - 0.05, bW / 2 + 0.05].forEach((xo, i) => {
        const accentStrip = new THREE.Mesh(new THREE.PlaneGeometry(0.45, bH * 0.85), i === 0 ? neonPink(0.65) : neonPurple(0.65));
        accentStrip.position.set(xo, bH * 0.5, 0);
        accentStrip.rotation.y = i === 0 ? -Math.PI / 2 : Math.PI / 2;
        accentStrip.userData = { rate: 2.0, phase: i * 1.5, baseOpacity: 0.65 };
        grp.add(accentStrip);
        this.standoff?.windows.push(accentStrip);
      });
      // Roof equipment — HVAC + fume hood stacks
      const hvac = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 1.8), accent);
      hvac.position.set(-bW * 0.30, bH + 0.90, -bD * 0.20);
      grp.add(hvac);
      const hvacFan = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.14, 12), steel);
      hvacFan.rotation.x = Math.PI / 2;
      hvacFan.position.set(-bW * 0.30, bH + 1.55, -bD * 0.20);
      grp.add(hvacFan);
      // 2 fume hood stacks (cyan glow at tip)
      [-0.5, 0.5].forEach(xo => {
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.25, 2.6, 6), steel);
        stack.position.set(bW * 0.30 + xo, bH + 1.30, -bD * 0.30);
        grp.add(stack);
        const stackTip = this._makeRunningLight(0x44ddee, 0.20);
        stackTip.position.set(bW * 0.30 + xo, bH + 2.65, -bD * 0.30);
        stackTip.userData = { rate: 1.6, phase: Math.random() * 6 };
        grp.add(stackTip);
      });
      // Roof strobe (red aviation)
      const rstrobe = this._makeRunningLight(0xff3344, 0.30);
      rstrobe.position.set(bW * 0.30, bH + 1.0, bD * 0.30);
      rstrobe.userData = { rate: 1.5, phase: Math.random() * 6 };
      grp.add(rstrobe);
      this.standoff?.strobes.push(rstrobe);
      // BIOHAZARD label on south wall (visible from biostation POI looking back)
      const labelBg = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.55),
        new THREE.MeshBasicMaterial({ color: 0xe8a020 }));
      labelBg.position.set(0, bH * 0.78, bD / 2 + 0.06);
      grp.add(labelBg);
      // Concrete pad surrounding the building
      const pad = new THREE.Mesh(new THREE.BoxGeometry(bW + 4, 0.20, bD + 4), concreteLit);
      pad.position.set(0, 0.10, 0);
      grp.add(pad);
      this.scene.add(grp);
    }

    /* ===== DECONTAMINATION UNIT ===== centered (-15, -8, 38) =====
       4-stall shower row w/ steam glow, drainage grates, supply tanks. */
    {
      const grp = new THREE.Group();
      grp.position.set(-15, -8, 30);  // s9: pushed north to 15u from S-perim road (real road, was 7u)
      const stallW = 1.5, stallH = 2.5, stallD = 1.8;
      // Concrete base pad
      const base = new THREE.Mesh(new THREE.BoxGeometry(stallW * 4 + 0.6, 0.20, stallD + 1.2), concreteLit);
      base.position.set(0, 0.10, 0);
      grp.add(base);
      // 4 shower stalls
      for (let i = 0; i < 4; i++) {
        const sx = (i - 1.5) * (stallW + 0.05);
        // Stall walls (3-sided box)
        const back = new THREE.Mesh(new THREE.BoxGeometry(stallW, stallH, 0.10), labWhite);
        back.position.set(sx, stallH / 2 + 0.20, -stallD / 2);
        grp.add(back);
        [-stallW / 2 + 0.05, stallW / 2 - 0.05].forEach(xo => {
          const wall = new THREE.Mesh(new THREE.BoxGeometry(0.10, stallH, stallD), labWhite);
          wall.position.set(sx + xo, stallH / 2 + 0.20, 0);
          grp.add(wall);
        });
        // Roof slab
        const sRoof = new THREE.Mesh(new THREE.BoxGeometry(stallW + 0.12, 0.10, stallD + 0.12), labWhiteHi);
        sRoof.position.set(sx, stallH + 0.25, 0);
        grp.add(sRoof);
        // Steam/water glow inside (cyan)
        const steam = new THREE.Mesh(new THREE.PlaneGeometry(stallW * 0.85, stallH * 0.90), neonCyan(0.45));
        steam.position.set(sx, stallH / 2 + 0.20, 0);
        steam.userData = { rate: 2.0 + i * 0.3, phase: i * 1.1, baseOpacity: 0.45 };
        grp.add(steam);
        this.standoff?.windows.push(steam);
        // Shower head (overhead)
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 0.14, 8), steel);
        head.position.set(sx, stallH + 0.10, 0);
        grp.add(head);
        // Drain grate on floor
        const grate = new THREE.Mesh(new THREE.BoxGeometry(stallW * 0.55, 0.04, stallD * 0.40), dark);
        grate.position.set(sx, 0.22, 0);
        grp.add(grate);
        // Status LED on stall door (green = ready)
        const led = this._makeRunningLight(0x66ff88, 0.10);
        led.position.set(sx, 2.0, stallD / 2 + 0.05);
        led.userData = { rate: 2.4, phase: i * 0.6 };
        grp.add(led);
      }
      // 2 supply tanks behind the row (decon fluid)
      [-1.6, 1.6].forEach(xo => {
        const tank = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.55, 2.2, 12),
          accent,
        );
        tank.position.set(xo, 1.30, -stallD / 2 - 0.85);
        grp.add(tank);
        // Equator band
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.06, 4, 16), stencil);
        band.rotation.x = Math.PI / 2;
        band.position.set(xo, 1.30, -stallD / 2 - 0.85);
        grp.add(band);
        // Status placard (green check for ready)
        const placard = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.30), neonGreen(0.65));
        placard.position.set(xo, 1.50, -stallD / 2 - 0.85 + 0.60);
        grp.add(placard);
      });
      this.scene.add(grp);
    }

    /* ===== REFRIGERATED SPECIMEN CONTAINER YARD ===== centered (-58, -8, 32) =====
       Row of refrigerated containers with cyan cooling glow, condenser units
       on top, hazard signs. */
    {
      const grp = new THREE.Group();
      grp.position.set(-58, -8, 20);  // s7: shifted north off back-cross road at z=+30
      const cW = 4.5, cH = 2.6, cD = 8.5;
      [-cW - 0.3, 0, cW + 0.3].forEach((xo, i) => {
        // Container body
        const cont = new THREE.Mesh(new THREE.BoxGeometry(cW, cH, cD), labWhite);
        cont.position.set(xo, cH / 2 + 0.2, 0);
        grp.add(cont);
        // Vertical ribs
        for (let j = -3; j <= 3; j++) {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, cH, 0.08), labWhiteHi);
          rib.position.set(xo + cW / 2 + 0.04, cH / 2 + 0.2, j * 1.2);
          grp.add(rib);
        }
        // Condenser unit on roof (refrigeration)
        const cond = new THREE.Mesh(new THREE.BoxGeometry(cW * 0.85, 0.85, 1.6), accent);
        cond.position.set(xo, cH + 0.65, -cD * 0.30);
        grp.add(cond);
        // Cooling fins
        for (let f = -0.5; f <= 0.5; f += 0.20) {
          const fin = new THREE.Mesh(new THREE.BoxGeometry(cW * 0.80, 0.04, 0.08), steel);
          fin.position.set(xo, cH + 0.85, -cD * 0.30 + f);
          grp.add(fin);
        }
        // Cyan cooling glow under the door
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(cW * 0.85, 1.6), neonCyan(0.55));
        glow.position.set(xo, cH * 0.45 + 0.2, cD / 2 + 0.04);
        glow.userData = { rate: 0.8 + i * 0.15, phase: i * 1.3, baseOpacity: 0.55 };
        grp.add(glow);
        this.standoff?.windows.push(glow);
        // Door frame
        const df = new THREE.Mesh(new THREE.BoxGeometry(cW * 0.92, 1.85, 0.12), steel);
        df.position.set(xo, cH * 0.50 + 0.2, cD / 2 + 0.08);
        grp.add(df);
        // Hazard placard above door
        const hp = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), yellow);
        hp.position.set(xo, cH * 0.85 + 0.2, cD / 2 + 0.06);
        grp.add(hp);
        // Status LED on condenser (cooling = cyan blink)
        const led = this._makeRunningLight(0x44ddee, 0.18);
        led.position.set(xo - cW * 0.30, cH + 1.20, -cD * 0.30);
        led.userData = { rate: 1.8, phase: i * 0.7 };
        grp.add(led);
        this.standoff?.strobes.push(led);
      });
      // Concrete pad
      const pad = new THREE.Mesh(new THREE.BoxGeometry(3 * cW + 2.6, 0.20, cD + 2), concrete);
      pad.position.set(0, 0.10, 0);
      grp.add(pad);
      this.scene.add(grp);
    }

    /* ===== GEODESIC GREENHOUSE CLUSTER ===== centered (-55, -8, 55) =====
       4 small geodesic domes (icosahedron approximation) w/ different
       neon glow colors. Reads as alien-flora research domes. */
    {
      const grp = new THREE.Group();
      grp.position.set(-55, -8, 70);  // s9: 15u south of S-perim road (was 7u, too close visually)
      const domes = [
        { x: -3.5, z: -3, color: 0xff5fa8, r: 2.2 },  // pink
        { x:  3.5, z: -3, color: 0x66ff88, r: 2.2 },  // green
        { x: -3.5, z:  3, color: 0xaa44ee, r: 2.0 },  // purple
        { x:  3.5, z:  3, color: 0x44ddee, r: 2.4 },  // cyan
      ];
      domes.forEach(d => {
        // Dome shell — icosahedron geometry for the geodesic look
        const shell = new THREE.Mesh(
          new THREE.IcosahedronGeometry(d.r, 1),
          new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.40, blending: THREE.AdditiveBlending, depthWrite: false }),
        );
        shell.position.set(d.x, d.r * 0.55, d.z);
        // Squash to half-sphere visually by scaling Y
        shell.scale.y = 0.65;
        grp.add(shell);
        // Geodesic frame — wireframe overlay
        const frame = new THREE.Mesh(
          new THREE.IcosahedronGeometry(d.r + 0.04, 1),
          new THREE.MeshBasicMaterial({ color: 0x2a3142, wireframe: true }),
        );
        frame.position.copy(shell.position);
        frame.scale.copy(shell.scale);
        grp.add(frame);
        // Concrete ring base
        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(d.r + 0.10, d.r + 0.20, 0.20, 14),
          concreteLit,
        );
        base.position.set(d.x, 0.10, d.z);
        grp.add(base);
        // Door slit (warm warm glow at front)
        const slit = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.0), winMat(0.55));
        slit.position.set(d.x, 0.55, d.z + d.r + 0.06);
        slit.userData = { rate: 4.0, phase: Math.random() * 6, baseOpacity: 0.55 };
        grp.add(slit);
        this.standoff?.windows.push(slit);
        // Pulsing apex glow
        const apex = this._makeRunningLight(d.color, 0.30);
        apex.position.set(d.x, d.r * 0.55 + d.r * 0.65 + 0.25, d.z);
        apex.userData = { rate: 0.5 + Math.random() * 0.3, phase: Math.random() * 6 };
        grp.add(apex);
        this.standoff?.strobes.push(apex);
      });
      // Connecting walkway (cement) between the 4 domes
      [[-3.5, 0, 3.5, 0], [0, -3, 0, 3]].forEach(([x1, z1, x2, z2]) => {
        const len = Math.hypot(x2 - x1, z2 - z1);
        const wlk = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.85), concreteLit);
        wlk.position.set((x1 + x2) / 2, 0.06, (z1 + z2) / 2);
        wlk.rotation.y = Math.atan2(z2 - z1, x2 - x1);
        grp.add(wlk);
      });
      this.scene.add(grp);
    }

    /* ===== BIO-WASTE INCINERATOR STACK ===== centered (-72, -8, 22) =====
       Tall industrial chimney w/ heat haze, base furnace, hot orange glow. */
    {
      const grp = new THREE.Group();
      grp.position.set(-72, -8, 22);
      // Furnace base (square brick mass)
      const fW = 4.5, fH = 4.0, fD = 4.5;
      const furnace = new THREE.Mesh(new THREE.BoxGeometry(fW, fH, fD), concrete);
      furnace.position.set(0, fH / 2, 0);
      grp.add(furnace);
      const furnaceRoof = new THREE.Mesh(new THREE.BoxGeometry(fW + 0.3, 0.25, fD + 0.3), concreteLit);
      furnaceRoof.position.set(0, fH + 0.12, 0);
      grp.add(furnaceRoof);
      // Glowing furnace door (hot orange)
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6),
        new THREE.MeshBasicMaterial({ color: 0xff7022, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      door.position.set(0, 1.0, fD / 2 + 0.04);
      door.userData = { rate: 3.0, phase: Math.random() * 6, baseOpacity: 0.85 };
      grp.add(door);
      this.standoff?.windows.push(door);
      // Door frame
      const dFrame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.0, 0.20), steel);
      dFrame.position.set(0, 1.05, fD / 2 + 0.10);
      grp.add(dFrame);
      // Tall chimney stack
      const stkH = 14;
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.1, stkH, 12), concreteLit);
      stack.position.set(0, fH + stkH / 2, -fD * 0.20);
      grp.add(stack);
      // Reinforcement bands
      [0.30, 0.60, 0.90].forEach(f => {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.10, 4, 18), steel);
        band.rotation.x = Math.PI / 2;
        band.position.set(0, fH + stkH * f, -fD * 0.20);
        grp.add(band);
      });
      // Top cap
      const stackCap = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.85, 0.45, 12), accent);
      stackCap.position.set(0, fH + stkH + 0.22, -fD * 0.20);
      grp.add(stackCap);
      // Hot exhaust glow at top (hazy orange)
      const exhaust = this._makeRunningLight(0xff7022, 0.50);
      exhaust.position.set(0, fH + stkH + 0.6, -fD * 0.20);
      exhaust.userData = { rate: 0.8, phase: Math.random() * 6 };
      grp.add(exhaust);
      this.standoff?.strobes.push(exhaust);
      // Aviation strobe at top
      const tipS = this._makeRunningLight(0xff3344, 0.45);
      tipS.position.set(0, fH + stkH + 1.4, -fD * 0.20);
      tipS.userData = { rate: 1.4, phase: Math.random() * 6 };
      grp.add(tipS);
      this.standoff?.strobes.push(tipS);
      // External ladder
      for (let h = 0.6; h < fH + stkH - 0.3; h += 0.40) {
        const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.50, 4), steel);
        rung.rotation.z = Math.PI / 2;
        rung.position.set(0.95, h, -fD * 0.20 + 0.85);
        grp.add(rung);
      }
      // Hazard sign on the south wall
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6),
        new THREE.MeshBasicMaterial({ color: 0xc83838 }));
      sign.position.set(-fW * 0.35, 2.2, fD / 2 + 0.05);
      grp.add(sign);
      // Ash collection drum at the side
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.0, 12), accent);
      drum.position.set(fW / 2 + 1.0, 0.50, fD / 2 - 0.5);
      grp.add(drum);
      const drumLid = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.05, 12), steel);
      drumLid.position.set(fW / 2 + 1.0, 1.02, fD / 2 - 0.5);
      grp.add(drumLid);
      this.scene.add(grp);
    }

    /* ===== WASTE-WATER CLARIFIER ===== centered (-38, -8, 60) =====
       Circular open-top concrete tank w/ central rotating skimmer arm
       (bio-fluid sloshing; murky cyan surface). */
    {
      const grp = new THREE.Group();
      grp.position.set(-38, -8, 68);  // s7: shifted further south to clear S-perim at z=+50
      const tankR = 4.5;
      // Outer concrete ring wall
      const wall = new THREE.Mesh(
        new THREE.CylinderGeometry(tankR, tankR + 0.20, 1.4, 24, 1, true),
        concreteLit,
      );
      wall.position.set(0, 0.70, 0);
      grp.add(wall);
      // Top rim
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(tankR, 0.18, 6, 24),
        concrete,
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.set(0, 1.40, 0);
      grp.add(rim);
      // Floor of the tank (bio-fluid surface — murky cyan glow)
      const surface = new THREE.Mesh(
        new THREE.CircleGeometry(tankR - 0.1, 24),
        new THREE.MeshBasicMaterial({ color: 0x44aabb, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      surface.rotation.x = -Math.PI / 2;
      surface.position.set(0, 1.20, 0);
      surface.userData = { rate: 0.4, phase: 0, baseOpacity: 0.65 };
      grp.add(surface);
      this.standoff?.windows.push(surface);
      // Central support column
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 2.4, 8), steel);
      col.position.set(0, 2.20, 0);
      grp.add(col);
      // Rotating skimmer arm (registered to spin pivots)
      const skimmerPivot = new THREE.Group();
      skimmerPivot.position.set(0, 1.50, 0);
      grp.add(skimmerPivot);
      const skimArm = new THREE.Mesh(new THREE.BoxGeometry(tankR * 1.85, 0.18, 0.18), steel);
      skimmerPivot.add(skimArm);
      const skimBlade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.30, 0.85), steel);
      skimBlade.position.set(tankR * 0.80, -0.20, 0);
      skimmerPivot.add(skimBlade);
      this._radarBuildingPivots ??= [];
      this._radarBuildingPivots.push(skimmerPivot);
      // 4 access stairs around the rim
      [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(theta => {
        const stairX = Math.cos(theta) * (tankR + 0.6);
        const stairZ = Math.sin(theta) * (tankR + 0.6);
        const stair = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.40, 0.50), accent);
        stair.position.set(stairX, 0.70, stairZ);
        stair.lookAt(0, 0.70, 0);
        grp.add(stair);
      });
      // Effluent pipe out (warm metal)
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4, 8), steel);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(tankR + 2, 0.60, 0);
      grp.add(pipe);
      this.scene.add(grp);
    }

    /* ===== SOLAR-PANEL CANOPY (efficiency: fills the gap between lab and
       greenhouse cluster w/ a long low silhouette) ===== centered (-42, -8, 45) ===== */
    {
      const grp = new THREE.Group();
      grp.position.set(-42, -8, 28);  // s9: pushed north of S-perim road by 17u (s7 fix was based on phantom back-cross from BASEMAP doc; only real road in SW is S-perim z=50)
      const rows = 3, cols = 6;
      const panelW = 1.8, panelD = 1.0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const px = (c - (cols - 1) / 2) * (panelW + 0.1);
          const pz = (r - (rows - 1) / 2) * (panelD + 0.4);
          // Support post
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 5), steel);
          post.position.set(px, 0.70, pz);
          grp.add(post);
          // Panel (dark blue-black w/ subtle shimmer)
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(panelW, 0.06, panelD),
            new THREE.MeshBasicMaterial({ color: 0x1a2238 }),
          );
          panel.position.set(px, 1.45, pz);
          panel.rotation.x = -Math.PI * 0.18;
          grp.add(panel);
          // Cyan grid lines on panel
          for (let g = -panelW * 0.4; g <= panelW * 0.4; g += panelW * 0.2) {
            const line = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, panelD * 0.95), neonCyan(0.30));
            line.position.set(px + g, 1.48, pz);
            line.rotation.x = -Math.PI * 0.18;
            grp.add(line);
          }
        }
      }
      this.scene.add(grp);
    }
  },

  /* ---------- Pelican landing pad behind the camera ----------
     Fills the back direction so when the user turns around there's a
     clear themed feature instead of a void. Big concrete pad with
     painted markings, a parked simplified Pelican on top, perimeter
     deck lights. */
  _buildPelicanPad() {
    const grp = new THREE.Group();
    grp.name = 'pelican_pad';
    const concrete = new THREE.MeshBasicMaterial({ color: 0x3a4358 });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x4a5468 });
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

    // b193: relocated from (-2, +24) directly south-of-camera to SE
    // airfield zone (+50, +30) so a camera-spin reveals a real "active
    // landing pad" feature instead of just a parked Pelican against the
    // back perimeter. Still well clear of the south perimeter road
    // (z=50±4.5) and the new back cross-road at z=+30 (3.5u half-width
    // — pad sits at z=+30 with 9u radius, so it overlaps the back cross
    // road; the road shader was extended to make the pad an INTENTIONAL
    // road-edge feature with the cross-road terminating at the pad).
    grp.position.set(50, -8, 30);
    grp.rotation.y = -0.6;  // angled slightly so cockpit faces NE corridor
    this.scene.add(grp);
  },

  _makeParkedPelican() {
    // Simplified Pelican silhouette (mirrors `_buildScriptedPelican` body but
    // without the moving hatch / glow / engines on)
    const grp = new THREE.Group();
    const sz = 1.2;
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x363640 });

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
    grp.name = 'central_dish';
    const concrete = new THREE.MeshBasicMaterial({ color: 0x36404f });
    const concreteLit = new THREE.MeshBasicMaterial({ color: 0x4a5468 });
    const steel  = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const accent = new THREE.MeshBasicMaterial({ color: 0x363c4a });

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
    const dishMat = new THREE.MeshBasicMaterial({ color: 0x303540, side: THREE.DoubleSide });
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
    const steel   = new THREE.MeshBasicMaterial({ color: 0x2a3142 });
    const dark    = new THREE.MeshBasicMaterial({ color: 0x1d2230 });
    this._parkedHogs = [];

    // b193: motor pool relocated. Old (50,-44)/(40,-47)/(32,-44) sat inside
    // the new v2 logistics-yard host @ (43,-8,-48) and clipped through the
    // container stack. Moved south next to the SE airfield (Pelican pad
    // @ 50,+30) so the vehicles read as airfield ground support.
    // b214: vehicles were packed within ~13u of each other on the airfield
    // (user: "tents cars and a tank all packed togehter in a tiny little
    // space"). Spread along the +X axis with z spans 8→22 so they read as
    // a real motor pool with breathing room, not a parking-lot pile.
    const parkedSpots = [
      { x: 32, z:   8, yaw:  Math.PI * 0.10 },
      { x: 50, z:  12, yaw:  Math.PI * 1.05 },
      { x: 40, z:  22, yaw: -Math.PI * 0.15 },
    ];
    parkedSpots.forEach((s, i) => {
      const car = this._buildWarthogMesh(olive, oliveHi, steel, dark);
      car.name = `parked_warthog_motorpool_${i}`;
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
    [0, 197, 395].forEach((phaseOffset, i) => {
      const car = this._buildWarthogMesh(olive, oliveHi, steel, dark);
      car.name = `patrol_warthog_${i}`;
      car.userData.wheels = car.children.filter(
        c => c.geometry?.type === 'CylinderGeometry' && c.geometry.parameters.height === 0.55
      );
      car.userData.t = phaseOffset;  // distance along loop (units)
      // b227: rotating amber security beacon on cab roof — sells "this base
      // is actively patrolled" from any vantage. Sprite faces camera always,
      // so we fake the rotating-mirror sweep by pulsing opacity in tick.
      const beaconBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.10, 0.10, 0.20, 8),
        steel,
      );
      beaconBase.position.set(0, 2.32, 0.60);
      car.add(beaconBase);
      const beaconLens = this._makeRunningLight(0xffaa22, 0.70);
      beaconLens.position.set(0, 2.58, 0.60);
      beaconLens.userData = { isBeacon: true, phase: Math.random() * 6 };
      car.add(beaconLens);
      car.userData.beacon = beaconLens;
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
      // b227: amber roof beacon — sharp flash + decay on each rotation pass
      if (ud.beacon?.material) {
        const phase = ud.beacon.userData.phase + t * 5.5;
        const flash = 0.5 + 0.5 * Math.cos(phase);
        ud.beacon.material.opacity = 0.25 + flash * flash * 0.75;
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

    // b216: bright colors RESTORED. The b214 dim-down was wrong — the
    // huge halos behind panels were _buildStructureUplights, not bloom of
    // the panel content. Reverting to the original vibrant text.
    // Top kicker — magenta mono
    ctx.font = '600 16px "Space Mono", monospace';
    ctx.fillStyle = '#ff7ec3';
    ctx.textBaseline = 'top';
    ctx.fillText(`EXPERIMENT  ${s.num}`, 32, 28);

    // Title — huge lowercase Space Grotesk, white
    ctx.font = '800 84px "Space Grotesk", system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(s.title, 28, 78);

    // Body — wrapped mono
    ctx.font = '400 16px "Space Mono", monospace';
    ctx.fillStyle = '#cfd5e0';
    this._wrapText(ctx, s.body, 32, 220, W - 64, 24);

    // Bottom bar — caution stripe + ENTER prompt (magenta accent)
    ctx.fillStyle = 'rgba(255,126,195,0.18)';
    ctx.fillRect(0, H - 48, W, 48);
    ctx.fillStyle = '#ff7ec3';
    ctx.font = '600 14px "Space Mono", monospace';
    ctx.fillText('▶ HOVER · CLICK · ENTER →', 32, H - 32);

    // Corner brackets (HUD-style) — white
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
  /* ---------- b202: POI navigation system ----
     Discrete waypoints across the base. Camera animates pos + yaw + pitch
     between POIs over 1.6s with cubic ease. Drag-look continues from
     each POI. ESC returns to deck. 0-9 hotkeys jump direct. N/P cycle. */
  _buildPOI() {
    // b207: pulled all POIs back ~50% further from their target so each
    // structure reads in context with the surrounding base instead of
    // filling the frame. Yaw vectors stay aligned (cam→target line is
    // unchanged); pitches dipped slightly so framing tilts down for a
    // more "looking across the base" feel.
    this.poi = {
      list: [
        { id: 'deck',     name: 'OBSERVATION DECK', pos: [  0,  0,   0], yaw:  0.000, pitch: -0.05 },
        { id: 'silo',     name: 'MISSILE SILO',     pos: [  0,  5, -55], yaw:  0.000, pitch:  0.10 },
        { id: 'broken',   name: 'BROKEN DISH',      pos: [-38,  8, -14], yaw: -0.98,  pitch: -0.05 },
        { id: 'sigint',   name: 'SIGINT TOWER',     pos: [-20,  5, -25], yaw: -0.79,  pitch:  0.00 },
        { id: 'logistic', name: 'LOGISTICS YARD',   pos: [ 20,  5, -25], yaw:  0.79,  pitch:  0.00 },
        { id: 'fwd_ops',  name: 'FORWARD OPS',      pos: [ 10,  5, -45], yaw:  0.61,  pitch: -0.02 },
        { id: 'comms',    name: 'COMMS ARRAY',      pos: [-10,  5, -45], yaw: -0.61,  pitch: -0.02 },
        { id: 'airfield', name: 'SE AIRFIELD',      pos: [ 25,  7,  10], yaw:  2.23,  pitch: -0.05 },
        { id: 'biolab',   name: 'BIOSTATION SW',    pos: [-22,  6,  20], yaw: -2.36,  pitch: -0.05 },
        { id: 'ridge',    name: 'RIDGE VIEW',       pos: [  0, 26,  72], yaw:  0.000, pitch: -0.18 },
      ],
      current: 0,
      inTransit: false,
      fromPos: new THREE.Vector3(),
      toPos:   new THREE.Vector3(),
      fromYaw: 0, toYaw: 0,
      fromPitch: 0, toPitch: -0.05,
      t: 0,
      duration: 1.6,
    };
    // HUD strip: bottom-center, clickable buttons
    const strip = document.createElement('div');
    strip.className = 'ss-poi-strip';
    strip.id = 'ss-poi-strip';
    strip.innerHTML = '<div class="ss-poi-label">— viewpoint —</div>'
      + this.poi.list.map((p, i) =>
          `<button class="ss-poi-btn" data-poi="${i}"><span class="ss-poi-num">${i}</span>${p.name}</button>`
        ).join('')
      // s18: free-cam toggle on the viewpoint strip.
      + '<button class="ss-poi-btn" id="ss-freecam-btn" data-act="freecam" '
      +   'style="border-color:rgba(180,220,255,0.45);color:#cfe6ff">'
      +   '<span class="ss-poi-num">F</span>FREE CAM'
      + '</button>';
    strip.addEventListener('click', e => {
      let target = e.target;
      while (target && !target.dataset?.poi && !target.dataset?.act && target !== strip) {
        target = target.parentElement;
      }
      if (target?.dataset?.act === 'freecam') { this._toggleFreeCam(); return; }
      const idx = target?.dataset?.poi;
      if (idx != null) this._gotoPOI(parseInt(idx, 10));
    });
    this.hudEl.appendChild(strip);
    this._highlightPOI();
  },

  _gotoPOI(idx) {
    if (!this.poi || idx < 0 || idx >= this.poi.list.length) return;
    // s18: tapping a viewport while in free-cam exits free-cam first.
    if (this.freecam.active) this._toggleFreeCam(false);
    if (idx === this.poi.current && !this.poi.inTransit) return;
    const p = this.poi.list[idx];
    // Capture current actual camera position (strip out the bob offset)
    this.poi.fromPos.set(this.camera.position.x, this.poi.list[this.poi.current].pos[1], this.camera.position.z);
    this.poi.toPos.set(p.pos[0], p.pos[1], p.pos[2]);
    this.poi.fromYaw   = this.gaze.yaw;
    this.poi.toYaw     = p.yaw;
    // Shortest-path yaw lerp (avoid full-circle spin)
    let dy = this.poi.toYaw - this.poi.fromYaw;
    if (dy >  Math.PI) this.poi.toYaw -= Math.PI * 2;
    if (dy < -Math.PI) this.poi.toYaw += Math.PI * 2;
    this.poi.fromPitch = this.gaze.pitch;
    this.poi.toPitch   = p.pitch;
    this.poi.t = 0;
    this.poi.inTransit = true;
    this.poi.current = idx;
    this._highlightPOI();
  },

  _highlightPOI() {
    if (!this.poi) return;
    const strip = document.getElementById('ss-poi-strip');
    if (!strip) return;
    strip.querySelectorAll('.ss-poi-btn').forEach((b, i) => {
      b.classList.toggle('active', i === this.poi.current);
    });
  },

  _tickPOI(dt, t) {
    if (!this.poi) return;
    // s18: free-cam owns the camera position when active; POI tick is a no-op.
    if (this.freecam.active) return;
    if (this.poi.inTransit) {
      this.poi.t += dt / this.poi.duration;
      if (this.poi.t >= 1) {
        this.poi.t = 1;
        this.poi.inTransit = false;
      }
      // Smoothstep ease
      const k = this.poi.t * this.poi.t * (3 - 2 * this.poi.t);
      const fp = this.poi.fromPos, tp = this.poi.toPos;
      this.camera.position.x = fp.x + (tp.x - fp.x) * k;
      this.camera.position.y = fp.y + (tp.y - fp.y) * k + Math.sin(t * 0.5) * 0.06;
      this.camera.position.z = fp.z + (tp.z - fp.z) * k;
      this.gaze.yaw   = this.poi.fromYaw   + (this.poi.toYaw   - this.poi.fromYaw)   * k;
      this.gaze.pitch = this.poi.fromPitch + (this.poi.toPitch - this.poi.fromPitch) * k;
    } else {
      // Parked at current POI — snap pos + add bob
      const p = this.poi.list[this.poi.current];
      this.camera.position.x = p.pos[0];
      this.camera.position.z = p.pos[2];
      this.camera.position.y = p.pos[1] + (this._camBaseY || 0) + Math.sin(t * 0.5) * 0.10;
    }
  },

  /* ---------- s13: Debug label overlay ----------
     Walks the scene once after build, finds every node with a non-empty
     .name, and parents a text-canvas Sprite above it. Toggle via ?labels=1
     query param OR the L key. depthTest:false so labels read through walls.
     See docs/scenes/LABEL_OVERLAY_PLAN.md. */
  _makeLabelTexture(text) {
    if (this.labels.texCache.has(text)) return this.labels.texCache.get(text);
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = 'bold 22px ui-monospace, Menlo, Consolas, monospace';
    const m = ctx.measureText(text);
    const padX = 14, padY = 10, textW = Math.min(m.width, 220);
    const pillW = Math.min(256, textW + padX * 2);
    const pillH = 36;
    const pillX = (256 - pillW) / 2, pillY = (64 - pillH) / 2;
    ctx.fillStyle = 'rgba(8, 12, 20, 0.88)';
    ctx.fillRect(pillX, pillY, pillW, pillH);
    ctx.strokeStyle = 'rgba(140, 200, 255, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pillX + 0.5, pillY + 0.5, pillW - 1, pillH - 1);
    ctx.fillStyle = '#e8f2ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32, 220);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    this.labels.texCache.set(text, tex);
    return tex;
  },

  _buildLabels() {
    if (!this.scene) return;
    const seen = new Set();
    this.scene.traverse(node => {
      if (!node.name) return;
      // Skip THREE's auto-assigned defaults (empty by default; only user-set
      // .name strings should label). Also skip the labels themselves.
      if (node.userData?.__isLabel) return;
      if (seen.has(node)) return;
      seen.add(node);
      // Compute world-space top of the node to position label above it.
      const box = new THREE.Box3().setFromObject(node);
      if (!isFinite(box.max.y) || !isFinite(box.min.y)) return;
      const worldTopY = box.max.y;
      // Convert worldTopY to node-local Y.
      const worldPos = new THREE.Vector3();
      node.getWorldPosition(worldPos);
      const localTopOffset = worldTopY - worldPos.y;
      const tex = this._makeLabelTexture(node.name);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const sprite = new THREE.Sprite(mat);
      // Sprite native aspect 256:64 = 4:1. Width 8u → height 2u.
      sprite.scale.set(8, 2, 1);
      sprite.position.set(0, localTopOffset + 1.8, 0);
      sprite.renderOrder = 9999;
      sprite.userData.__isLabel = true;
      sprite.visible = this.labels.enabled;
      node.add(sprite);
      this.labels.sprites.push(sprite);
    });
    this._updateLabelsHud();
  },

  _setLabelsEnabled(on) {
    if (!this.labels) return;
    this.labels.enabled = !!on;
    this.labels.sprites.forEach(s => { s.visible = this.labels.enabled; });
    this._updateLabelsHud();
    // s18: keep the admin panel's labels button in sync.
    const btn = document.getElementById('ss-admin-labels');
    if (btn) {
      btn.textContent = `[L] LABELS ${this.labels.enabled ? 'on' : 'off'}`;
      btn.classList.toggle('active', this.labels.enabled);
    }
  },

  _updateLabelsHud() {
    const el = document.getElementById('ss-labels-hint');
    if (el) el.textContent = `[L] labels: ${this.labels?.enabled ? 'on' : 'off'}`;
  },

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
        <!-- s18: admin/debug panel — labels + freecam toggles, copy coords, jump-to-x,z. -->
        <div id="ss-admin" style="margin-top:14px;padding:10px 12px;
             background:rgba(8,12,20,0.75);border:1px solid rgba(180,220,255,0.30);
             font:11px ui-monospace,Menlo,Consolas,monospace;color:#cfe6ff;
             letter-spacing:0.08em;pointer-events:auto;min-width:230px">
          <div style="opacity:0.55;font-size:9px;margin-bottom:6px">— debug —</div>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <button id="ss-admin-labels" class="ss-poi-btn"
                    style="flex:1;padding:4px 6px;font-size:10px">[L] LABELS off</button>
            <button id="ss-admin-freecam" class="ss-poi-btn"
                    style="flex:1;padding:4px 6px;font-size:10px">[F] FREECAM off</button>
          </div>
          <div id="ss-admin-coords" style="opacity:0.80;font-size:10px;line-height:1.5;margin-bottom:6px">
            x 0.0  y 0.0  z 0.0<br>yaw 0°  pitch 0°
          </div>
          <button id="ss-admin-copy" class="ss-poi-btn"
                  style="width:100%;padding:4px 6px;font-size:10px;margin-bottom:8px">copy coords</button>
          <div style="display:flex;gap:4px;align-items:center;font-size:10px">
            <span style="opacity:0.55">jump x,z</span>
            <input id="ss-admin-jx" type="text" inputmode="numeric" placeholder="0"
                   style="width:42px;background:rgba(20,28,40,0.9);border:1px solid rgba(180,220,255,0.30);
                          color:#cfe6ff;font:10px ui-monospace,Menlo,Consolas,monospace;padding:2px 4px">
            <input id="ss-admin-jz" type="text" inputmode="numeric" placeholder="-70"
                   style="width:42px;background:rgba(20,28,40,0.9);border:1px solid rgba(180,220,255,0.30);
                          color:#cfe6ff;font:10px ui-monospace,Menlo,Consolas,monospace;padding:2px 4px">
            <button id="ss-admin-jump" class="ss-poi-btn"
                    style="flex:1;padding:2px 6px;font-size:10px">go</button>
          </div>
        </div>
      </div>
      <div class="ss-bl">
        <div class="ss-hint" id="ss-hint">— select a panel —</div>
        <div class="ss-labels-hint" id="ss-labels-hint" style="margin-top:6px;font-size:10px;opacity:0.55;letter-spacing:0.08em">[L] labels: off</div>
        <div class="ss-labels-hint" style="margin-top:2px;font-size:10px;opacity:0.55;letter-spacing:0.08em">[F] free cam · WASD + QE · shift = fast</div>
      </div>
      <div id="ss-freecam-hud" style="display:none;position:fixed;left:50%;top:14px;transform:translateX(-50%);
           padding:6px 14px;background:rgba(8,12,20,0.78);border:1px solid rgba(180,220,255,0.45);
           font:11px ui-monospace,Menlo,Consolas,monospace;color:#cfe6ff;letter-spacing:0.10em;
           pointer-events:none;z-index:60">
        <div style="opacity:0.55;font-size:9px">— free cam · drag to look · F or ESC to exit —</div>
        <div id="ss-freecam-readout" style="margin-top:2px">x 0.0  y 0.0  z 0.0    yaw 0°  pitch 0°</div>
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
    // s18: admin panel handlers — toggles, copy, jump-to-coord.
    const adminLabels  = root.querySelector('#ss-admin-labels');
    const adminFreecam = root.querySelector('#ss-admin-freecam');
    const adminCopy    = root.querySelector('#ss-admin-copy');
    const adminJump    = root.querySelector('#ss-admin-jump');
    const adminJx      = root.querySelector('#ss-admin-jx');
    const adminJz      = root.querySelector('#ss-admin-jz');
    if (adminLabels) adminLabels.addEventListener('click', e => {
      e.stopPropagation();
      this._setLabelsEnabled(!this.labels.enabled);
    });
    if (adminFreecam) adminFreecam.addEventListener('click', e => {
      e.stopPropagation();
      this._toggleFreeCam();
    });
    if (adminCopy) adminCopy.addEventListener('click', async e => {
      e.stopPropagation();
      const p = this.camera.position;
      const yawDeg = (this.gaze.yaw * 180 / Math.PI).toFixed(1);
      const pitchDeg = (this.gaze.pitch * 180 / Math.PI).toFixed(1);
      const txt = `x=${p.x.toFixed(2)} y=${p.y.toFixed(2)} z=${p.z.toFixed(2)} yaw=${yawDeg}° pitch=${pitchDeg}°`;
      try {
        await navigator.clipboard.writeText(txt);
        adminCopy.textContent = 'copied ✓';
        setTimeout(() => { adminCopy.textContent = 'copy coords'; }, 1200);
      } catch (err) {
        adminCopy.textContent = 'copy failed';
        setTimeout(() => { adminCopy.textContent = 'copy coords'; }, 1200);
      }
    });
    if (adminJump) {
      const doJump = () => {
        const x = parseFloat(adminJx.value);
        const z = parseFloat(adminJz.value);
        if (Number.isNaN(x) || Number.isNaN(z)) return;
        if (!this.freecam.active) this._toggleFreeCam(true);
        this.camera.position.set(x, 4, z);
      };
      adminJump.addEventListener('click', e => { e.stopPropagation(); doJump(); });
      [adminJx, adminJz].forEach(inp => inp && inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); doJump(); }
      }));
    }
    return root;
  },

  /* ---------- Composer ---------- */
  _setupComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // b214: bloom raised to threshold 0.75 so dim panel content (now
    // gray text on dark bg, max brightness ~0.72) never blooms. Strength
    // 0.20 keeps an actual screen-glow on the few genuinely bright sources
    // left in the scene (planet rim, sun strobes, vehicle headlights,
    // missile-silo strobe). Radius stays tight at 0.25 so even those
    // glow tightly to source.
    // b216: bloom restored to a moderate setting now that the dominant
    // halo source (`_buildStructureUplights`) is gone. Tight radius so
    // bright pixels (panel text, planet rim, strobes) get a clean
    // screen-glow, not the wide haze of earlier passes.
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.30, 0.30);
    bloom.threshold = 0.30;
    bloom.strength  = 0.45;
    bloom.radius    = 0.30;
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
      // s18: relaxed pitch in free-cam so the user can look straight down at
      // the floor to debug spatial layouts. Scripted POI mode keeps the old
      // tight clamp so panels don't drift out of frame.
      const pitchLo = this.freecam.active ? -Math.PI * 0.48 : -0.40;
      const pitchHi = this.freecam.active ?  Math.PI * 0.48 :  0.30;
      this.gaze.pitch = Math.max(pitchLo, Math.min(pitchHi, this.gaze.pitch));
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
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
    // ESC: release focus → exit free-cam → snap back to deck (POI 0)
    if (e.key === 'Escape') {
      if (this.focused) this._release();
      else if (this.freecam.active) this._toggleFreeCam(false);
      else if (this.poi && this.poi.current !== 0) this._gotoPOI(0);
      return;
    }
    // s18: F toggles free-cam mode
    if (e.key === 'f' || e.key === 'F') {
      this._toggleFreeCam();
      return;
    }
    // Digit hotkeys: jump to POI N (0..9). Exits free-cam first.
    if (this.poi && /^[0-9]$/.test(e.key)) {
      const idx = parseInt(e.key, 10);
      if (idx < this.poi.list.length) {
        if (this.freecam.active) this._toggleFreeCam(false);
        this._gotoPOI(idx);
      }
      return;
    }
    // N/P: cycle next/prev (only when not in free-cam — N is a strafe key)
    if (this.poi && !this.freecam.active && (e.key === 'n' || e.key === 'N')) {
      this._gotoPOI((this.poi.current + 1) % this.poi.list.length);
      return;
    }
    if (this.poi && !this.freecam.active && (e.key === 'p' || e.key === 'P')) {
      this._gotoPOI((this.poi.current - 1 + this.poi.list.length) % this.poi.list.length);
      return;
    }
    // s13: L toggles debug ID labels above named objects
    if (e.key === 'l' || e.key === 'L') {
      this._setLabelsEnabled(!this.labels.enabled);
      return;
    }
    // s18: WASD/QE/Shift held-key tracking (only meaningful in free-cam)
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === 'q' || k === 'e' || k === 'shift') {
      this.keys.add(k);
    }
  },

  _onKeyUp(e) {
    const k = e.key.toLowerCase();
    if (this.keys.has(k)) this.keys.delete(k);
  },

  _toggleFreeCam(force) {
    const next = (typeof force === 'boolean') ? force : !this.freecam.active;
    if (next === this.freecam.active) return;
    this.freecam.active = next;
    if (next) {
      if (this.focused) this._release();
      if (this.poi) this.poi.inTransit = false;
      this.keys.clear();
    } else if (this.poi) {
      const p = this.poi.list[this.poi.current];
      this.gaze.yaw   = p.yaw;
      this.gaze.pitch = p.pitch;
    }
    const fc = document.getElementById('ss-freecam-hud');
    if (fc) fc.style.display = next ? '' : 'none';
    const btn = document.getElementById('ss-freecam-btn');
    if (btn) btn.classList.toggle('active', next);
    const aBtn = document.getElementById('ss-admin-freecam');
    if (aBtn) {
      aBtn.textContent = `[F] FREECAM ${next ? 'on' : 'off'}`;
      aBtn.classList.toggle('active', next);
    }
  },

  _tickFreeCam(dt) {
    this._updateAdminCoords();
    if (!this.freecam.active) return;
    const k = this.keys;
    let fwd = 0, strafe = 0, lift = 0;
    if (k.has('w')) fwd    += 1;
    if (k.has('s')) fwd    -= 1;
    if (k.has('d')) strafe += 1;
    if (k.has('a')) strafe -= 1;
    if (k.has('e')) lift   += 1;
    if (k.has('q')) lift   -= 1;
    if (fwd || strafe || lift) {
      const mult = k.has('shift') ? this.freecam.fastMult : 1;
      const step = this.freecam.speed * mult * dt;
      const yaw = this.gaze.yaw;
      const fx = Math.sin(yaw), fz = -Math.cos(yaw);
      const sx = Math.cos(yaw), sz = Math.sin(yaw);
      this.camera.position.x += (fx * fwd + sx * strafe) * step;
      this.camera.position.z += (fz * fwd + sz * strafe) * step;
      this.camera.position.y += lift * step;
      if (this.camera.position.y < -6) this.camera.position.y = -6;
    }
    const el = document.getElementById('ss-freecam-readout');
    if (el) {
      const p = this.camera.position;
      const yawDeg = (this.gaze.yaw * 180 / Math.PI).toFixed(0);
      const pitchDeg = (this.gaze.pitch * 180 / Math.PI).toFixed(0);
      el.textContent = `x ${p.x.toFixed(1)}  y ${p.y.toFixed(1)}  z ${p.z.toFixed(1)}    yaw ${yawDeg}°  pitch ${pitchDeg}°`;
    }
  },

  _updateAdminCoords() {
    const el = document.getElementById('ss-admin-coords');
    if (!el) return;
    const p = this.camera.position;
    const yawDeg = (this.gaze.yaw * 180 / Math.PI).toFixed(0);
    const pitchDeg = (this.gaze.pitch * 180 / Math.PI).toFixed(0);
    el.innerHTML = `x ${p.x.toFixed(1)}  y ${p.y.toFixed(1)}  z ${p.z.toFixed(1)}<br>yaw ${yawDeg}°  pitch ${pitchDeg}°`;
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

    // b202: POI-aware camera positioning. _tickPOI sets camera.position
    // (lerping mid-transit OR snapping to current POI + bob).
    this._tickPOI(dt, t);
    this._tickFreeCam(dt);

    // Camera orientation from gaze (drag updates yaw/pitch; POI transit
    // also lerps yaw/pitch toward target).
    const fwd = this._forwardVec();
    const lookAt = new THREE.Vector3().copy(this.camera.position).add(fwd.multiplyScalar(20));
    this.camera.lookAt(lookAt);

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
        // b202: dialed flicker WAY down — was ±10% which read as
        // "holographic blinking cards." Now ±2% so windows hold steady
        // with a near-imperceptible warm shimmer. Welder/spark items
        // (userData.isWelder / .isSpark) keep their dramatic flicker.
        let k;
        if (w.userData.isWelder) {
          // Welder: sharp bright pulses every ~4s
          const ph = (t * 0.25 + w.userData.phase) % 1.0;
          k = ph < 0.06 ? 1.4 + Math.random() * 0.5 : 0.0;
        } else if (w.userData.isSpark) {
          // Spark: sustained jitter
          k = 0.7 + Math.sin(t * w.userData.rate + w.userData.phase) * 0.30 + Math.random() * 0.2;
        } else if (w.userData.fault) {
          // Fault windows (broken-dish plinth): irregular skips
          const ph = (t * w.userData.rate + w.userData.phase) % (Math.PI * 2);
          k = ph < 0.4 ? 0.30 : 0.95 + Math.sin(ph * 3) * 0.05;
        } else {
          // Standard window: ±2% steady warm shimmer
          k = 0.97 + Math.sin(t * w.userData.rate + w.userData.phase) * 0.02;
        }
        w.material.opacity = Math.max(0, w.userData.baseOpacity * k);
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

      // b200: panels are billboards mounted on buildings — they DO NOT
      // bob in idle. Old `sin(t * 0.4) * 0.20` drift made fixed-position
      // displays float like UI cards. Killed.
      // Position: focused → fly forward; hover → small forward pop;
      // otherwise locked to basePos.
      let target;
      if (isFocus) {
        target = this.camera.position.clone().add(this._forwardVec().multiplyScalar(11));
      } else if (isHover) {
        const toCam = p.basePos.clone().normalize().multiplyScalar(-0.7);
        target = p.basePos.clone().add(toCam).add(new THREE.Vector3(0, 0.30, 0));
      } else {
        target = p.basePos;
      }
      p.mesh.position.lerp(target, Math.min(1, dt * (isFocus ? 6 : 3)));
      const targetScale = isFocus ? 1.18 : (isHover ? 1.05 : 1.0);
      p.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, 1), Math.min(1, dt * 5));
      // b200: panels are mounted upright on real buildings. Face the
      // camera horizontally (no down-tilt to half-altitude). Old code
      // tilted high panels (galaxy y=8 → looked at y=4) by ~22° down.
      if (isFocus) p.mesh.lookAt(this.camera.position);
      else if (Math.abs(u.uFocus.value) < 0.02) {
        p.mesh.lookAt(0, p.basePos.y, 0);
      }
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
    window.removeEventListener('keyup', this._onKeyUp);
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
    if (this.labels) {
      this.labels.sprites.forEach(s => {
        try { s.material?.map?.dispose?.(); } catch (e) {}
        try { s.material?.dispose?.(); } catch (e) {}
        try { s.parent?.remove(s); } catch (e) {}
      });
      this.labels.texCache.forEach(t => { try { t.dispose?.(); } catch (e) {} });
      this.labels = null;
    }
    this.scene = null; this.camera = null; this.renderer = null;
    this.composer = null; this.panels = [];
  },
};

window.ScenesSelector = ScenesSelector;
