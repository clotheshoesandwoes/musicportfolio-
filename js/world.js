/* =========================================================
   WORLD.JS — Villa view (PS2+ Miami modernist villa, dusk)
   b010 — Villa redesign: 2-story cantilever villa with stacked
   stone column accents, long infinity-edge pool, "sun just
   dipped" sky palette, daybeds + deck lanterns + boulders.
   Render upgraded to 854x480 + 320x180 jitter grid (PS2+).
   Three.js loaded lazily from CDN on first activation.
   ========================================================= */

(function() {
  let container, canvas, renderer, scene, camera, animId;
  let lowResTarget, postScene, postCamera, postMaterial;
  let onResize, destroyed = false;
  // b014 — proper orbit camera input: drag to rotate, scroll/pinch to zoom
  // b032 — dual-mode camera: 'orbit' (exterior anchors) and 'firstPerson'
  // (interior anchors). Orbit uses center+yaw+pitch+radius spherical math.
  // First-person uses fixed position+yaw+pitch+fov, drag rotates lookAt in
  // place, scroll changes FOV instead of distance.
  let camMode = 'orbit';         // 'orbit' | 'firstPerson'
  let yaw = 0.20, pitch = 0.10;  // b036 — lower, slightly off-axis dramatic angle
  let radius = 22;               // orbit distance (orbit mode only)
  let fov = 70;                  // perspective FOV (first-person zoom target)
  let isDragging = false;
  let lastDragX = 0, lastDragY = 0;
  // b038 — RMB drag (or shift+LMB) pans camCenter; held WASD/QE moves it.
  // Both work in orbit AND first-person mode — orbit pans the look-at point,
  // first-person dollies/strafes the camera position. Anchor presets are
  // unchanged; pan just moves the camera away from the snapped starting pose.
  let isPanning = false;
  let lastPanX = 0, lastPanY = 0;
  const heldKeys = new Set();    // 'w','a','s','d','q','e','shift'
  let lastFrameTime = 0;
  let twoFingerLastCx = 0, twoFingerLastCy = 0;  // touch pan center tracking
  let pinchLastDist = 0;         // touch pinch incremental tracking
  let touchMode = null;          // 'drag' | 'pinch' | null
  let pinchStartDist = 0;
  let pinchStartRadius = 0;
  let pinchStartFov = 70;
  const MIN_RADIUS = 8;
  const MAX_RADIUS = 80;
  const MIN_PITCH = -0.10;       // orbit: can dip just below horizontal
  const MAX_PITCH = 1.30;        // orbit: close to top-down
  const MIN_PITCH_FP = -1.35;    // first-person: nearly straight down
  const MAX_PITCH_FP =  1.35;    // first-person: nearly straight up
  const MIN_FOV = 35;
  const MAX_FOV = 95;
  const ROTATE_SPEED = 0.005;    // rad per pixel
  const ZOOM_SPEED = 0.025;      // radius per wheel delta (orbit)
  const FOV_ZOOM_SPEED = 0.05;   // fov per wheel delta (first-person)
  let materials = [];
  let timeUniforms = [];
  // b029 — Day/night cycle uniform shared across sky + PS2 shaders.
  // MUST live at IIFE level (not inside init) so animate() can write to
  // it from the rAF loop. animate() can't see init() local consts.
  const cycleUniform = { value: 0 };
  let THREE_lib = null;
  const LOW_W = 854;
  const LOW_H = 480;
  // b026 — click→card system state
  let raycaster = null;
  let mouseNDC = null;
  let dragStartX = 0, dragStartY = 0;
  let dragMoved = false;
  const DRAG_CLICK_THRESHOLD = 4;  // pixels of movement before mousedown→up counts as drag, not click
  let propTracks = {};             // prop name → track index, populated in init
  let hoveredProp = null;
  let anchorBarEl = null;          // b029 — DOM anchor strip
  let anchorButtons = null;

  async function init(cont) {
    container = cont;
    destroyed = false;

    const loader = document.createElement('div');
    loader.className = 'world-loader';
    loader.innerHTML = `
      <div class="world-loader-text">LOADING VILLA</div>
      <div class="world-loader-bar"><div class="world-loader-fill"></div></div>
    `;
    container.appendChild(loader);

    let THREE;
    try {
      THREE_lib = await import('https://unpkg.com/three@0.160.0/build/three.module.js');
      THREE = THREE_lib;
    } catch (e) {
      console.error('Three.js load failed', e);
      loader.innerHTML = `<div class="world-loader-text">FAILED TO LOAD 3D ENGINE</div>`;
      return;
    }

    if (destroyed) { loader.remove(); return; }

    canvas = document.createElement('canvas');
    canvas.className = 'world-canvas';
    container.appendChild(canvas);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    // b028 — richer pink-magenta clear color, was muddy indigo 0x1a1238
    renderer.setClearColor(0x2a0a35, 1);

    scene = new THREE.Scene();
    // b028 — fog density slashed 0.009 → 0.003 and color shifted from
    // muddy purple 0x40285a to a richer magenta 0x6a1850. The old fog was
    // eating saturation across the whole scene and making it look pastel.
    // b036 — fog density bumped 0.003 → 0.0055 so the distant ground doesn't
    // read as a flat Roblox slab. Distant trees and ocean fade into the dusk
    // haze instead of every pixel sitting at full saturation.
    scene.fog = new THREE.FogExp2(0x6a1850, 0.0055);

    camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 1.5, 320);
    // Initial position will be overwritten by animate() on first frame, but
    // set something reasonable so the first render isn't broken if anything
    // skips animate.
    camera.position.set(0, 12, 26);
    camera.lookAt(0, 4, -2);

    // b029 — cycleUniform lives at IIFE level (see top of file). It must be
    // outside init() so animate() can write to it from the rAF loop.

    // b026 — click→card system: raycaster + prop→track lookup
    // Each entry maps a prop's THREE.Object3D `.name` to a track index in
    // config.json's tracks list. The click handler walks up the parent chain
    // from any raycast hit and picks the first ancestor whose name is in
    // this lookup. Track indices wrap around with `% tracks.length` so the
    // table doesn't break if config.json has fewer tracks than props.
    raycaster = new THREE.Raycaster();
    mouseNDC = new THREE.Vector2();
    propTracks = {
      'lambo_pink':      0,
      'lambo_yellow':    1,
      'yacht':           2,
      'jetski':          3,
      'tikibar':         4,
      'firepit':         5,
      'bbqbar':          6,
      'fountain':        7,
      'pierDeck':        8,
      'statue_obelisk':  9,
      'statue_sphere':   10,
      'statue_abstract': 11,
      'bell_tower':      12,
      'surfboard':       13,
      // b029 — INTERIOR props (new in the WORLD rebuild)
      'living_tv':       14,
      'pool_table':      15,
      'bar_counter':     16,
      'bed':             17,
      'indoor_pool':     18,
      'sauna':           19,
    };

    // -----------------------------------------------------
    // Sky dome — gradient + procedural stars + moon disc
    // -----------------------------------------------------
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        // b029 — TWO palettes interpolated by uCycle (0=sunset, 1=night).
        // Sunset: warm peach horizon, coral mid, soft lilac top.
        // Night:  hot pink horizon, deep magenta mid, rich indigo top.
        sunsetTop:    { value: new THREE.Color(0x402080) },
        sunsetMid:    { value: new THREE.Color(0xc04088) },
        sunsetBottom: { value: new THREE.Color(0xff8060) },
        nightTop:     { value: new THREE.Color(0x180844) },
        nightMid:     { value: new THREE.Color(0xa01880) },
        nightBottom:  { value: new THREE.Color(0xff3090) },
        uCycle:       cycleUniform,
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 sunsetTop;
        uniform vec3 sunsetMid;
        uniform vec3 sunsetBottom;
        uniform vec3 nightTop;
        uniform vec3 nightMid;
        uniform vec3 nightBottom;
        uniform float uCycle;
        varying vec3 vDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          // b029 — interpolate sunset → night by uCycle
          vec3 topColor    = mix(sunsetTop,    nightTop,    uCycle);
          vec3 midColor    = mix(sunsetMid,    nightMid,    uCycle);
          vec3 bottomColor = mix(sunsetBottom, nightBottom, uCycle);

          float h = vDir.y;
          vec3 col;
          if (h > 0.0) {
            col = mix(midColor, topColor, smoothstep(0.0, 0.85, h));
          } else {
            col = mix(midColor, bottomColor, smoothstep(0.0, -0.25, h));
          }

          // b029 — stars fade in only at night (uCycle > ~0.5)
          if (h > 0.4) {
            vec2 sp = vec2(atan(vDir.z, vDir.x) * 80.0, h * 80.0);
            float n = hash(floor(sp));
            float star = step(0.994, n) * smoothstep(0.4, 0.7, h);
            col += vec3(star * 0.85 * smoothstep(0.45, 0.85, uCycle));
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(110, 24, 16), skyMat));
    materials.push(skyMat);

    // -----------------------------------------------------
    // Light constants — passed manually as shader uniforms
    // -----------------------------------------------------
    // b028 — brighter, more saturated, tighter falloff. Hard pools of light
    // instead of a uniform glow. Colors are full-blown saturated, ranges
    // shrunk so the unlit areas read as actually unlit (more contrast).
    const lampPos     = new THREE.Vector3(0, 0.6, 9.5);
    const lampColor   = new THREE.Color(0xffaa50);  // hotter orange
    const lampRange   = 14;                          // was 22
    const poolPos     = new THREE.Vector3(0, 0.4, 5);
    const poolColor   = new THREE.Color(0x30ffe8);   // saturated cyan
    const poolRange   = 18;                          // was 26
    const windowPos   = new THREE.Vector3(0, 4.5, -10);
    const windowColor = new THREE.Color(0xffc070);   // richer warm
    const windowRange = 12;                          // was 18

    // -----------------------------------------------------
    // PS2 material factory — vertex jitter + 3-light shader
    // -----------------------------------------------------
    function makePS2Material(opts) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uColor:        { value: new THREE.Color(opts.color) },
          uEmissive:     { value: new THREE.Color(opts.emissive || 0x000000) },
          uEmissiveAmt:  { value: opts.emissiveAmt || 0 },
          uLampPos:      { value: lampPos },
          uLampColor:    { value: lampColor },
          uLampRange:    { value: lampRange },
          uPoolPos:      { value: poolPos },
          uPoolColor:    { value: poolColor },
          uPoolRange:    { value: poolRange },
          uWindowPos:    { value: windowPos },
          uWindowColor:  { value: windowColor },
          uWindowRange:  { value: windowRange },
          uFogColor:     { value: new THREE.Color(0x6a1850) },
          uFogDensity:{ value: 0.0055 },
          uCycle:        cycleUniform,   // b029 — shared day/night cycle
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vWorldPos;
          varying vec3 vViewDir;
          varying float vFogDepth;
          void main() {
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            vFogDepth = -mvPos.z;
            vec4 clip = projectionMatrix * mvPos;
            // PS2+ vertex jitter — finer grid than original PS2 (320x180)
            vec2 grid = vec2(320.0, 180.0);
            vec3 ndc = clip.xyz / clip.w;
            ndc.xy = floor(ndc.xy * grid + 0.5) / grid;
            clip.xyz = ndc * clip.w;
            gl_Position = clip;
            vNormal = normalize(mat3(modelMatrix) * normal);
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            vViewDir = normalize(cameraPosition - vWorldPos);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform vec3 uEmissive;
          uniform float uEmissiveAmt;
          uniform vec3 uLampPos;
          uniform vec3 uLampColor;
          uniform float uLampRange;
          uniform vec3 uPoolPos;
          uniform vec3 uPoolColor;
          uniform float uPoolRange;
          uniform vec3 uWindowPos;
          uniform vec3 uWindowColor;
          uniform float uWindowRange;
          uniform vec3 uFogColor;
          uniform float uFogDensity;
          uniform float uCycle;
          varying vec3 vNormal;
          varying vec3 vWorldPos;
          varying vec3 vViewDir;
          varying float vFogDepth;

          // b028 — brighter pool of light. ndl term weighted heavier so lit
          // surfaces really pop, unlit ones go nearly black instead of just
          // dimmer. Bumped fall^2 to fall^1.7 to make the falloff feel less
          // mathematical and more cinematic.
          vec3 pointLight(vec3 lp, vec3 lc, float lr, vec3 base) {
            vec3 d = lp - vWorldPos;
            float dist = length(d);
            float fall = max(0.0, 1.0 - dist / lr);
            fall = pow(fall, 1.7);
            float ndl = max(dot(vNormal, normalize(d)), 0.0);
            return base * lc * fall * (0.18 + ndl * 1.05);
          }

          void main() {
            // b028 — darker, cooler ambient so pools of light pop
            vec3 ambient = vec3(0.18, 0.12, 0.28);
            vec3 col = uColor * ambient;

            // b029 — HEMISPHERIC SKY FILL, now blended between sunset and
            // night palettes by uCycle. Sunset = warm peach top + warm sand
            // bounce. Night = cool magenta top + hot pink ground bounce.
            vec3 hemiTopSunset = vec3(0.55, 0.32, 0.40);
            vec3 hemiBotSunset = vec3(0.70, 0.45, 0.30);
            vec3 hemiTopNight  = vec3(0.45, 0.16, 0.42);
            vec3 hemiBotNight  = vec3(0.55, 0.14, 0.30);
            vec3 hemiTop = mix(hemiTopSunset, hemiTopNight, uCycle);
            vec3 hemiBot = mix(hemiBotSunset, hemiBotNight, uCycle);
            float upDot = vNormal.y * 0.5 + 0.5;
            vec3 hemi = mix(hemiBot, hemiTop, upDot) * 0.85;
            col += uColor * hemi;

            // b029 — DIRECTIONAL "SUN" term, only at sunset (uCycle close to
            // 0). Fakes a low warm sun coming from the +x/-y horizon. Cheap
            // fill that gives sunset its golden hour, fades out at night.
            float sunAmt = 1.0 - smoothstep(0.0, 0.5, uCycle);
            vec3 sunDir = normalize(vec3(0.5, 0.3, 0.2));
            float sunNL = max(dot(normalize(vNormal), sunDir), 0.0);
            col += uColor * vec3(1.20, 0.75, 0.45) * sunNL * sunAmt * 0.65;

            // b029 — point lights brighter at night, dim at sunset.
            // Multiplier ramps from 0.35 (sunset) to 1.15 (night).
            float lightMul = 0.35 + uCycle * 0.80;
            col += pointLight(uLampPos,   uLampColor,   uLampRange,   uColor) * lightMul;
            col += pointLight(uPoolPos,   uPoolColor,   uPoolRange,   uColor) * lightMul;
            col += pointLight(uWindowPos, uWindowColor, uWindowRange, uColor) * lightMul;
            col += uEmissive * uEmissiveAmt;

            // b028 — RIM LIGHT. Hot pink Fresnel against the sky. The single
            // biggest "I am playing a PS2 game" tell. ~3 lines of GLSL.
            float rim = 1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);
            rim = pow(rim, 2.4);
            col += vec3(1.00, 0.30, 0.65) * rim * 0.55;

            // b036 — WORLD-SPACE NOISE HASH. Big flat surfaces (sand, deck,
            // showroom slab, asphalt) all looked like flat Roblox baseplates
            // because every fragment of a single mesh got identical color.
            // Hashing the world position into a small color delta breaks up
            // the flatness without needing textures. Sampled at multiple
            // scales for coarse + fine grain. Strength is small (±0.06) so
            // it reads as material variation, not noise.
            vec3 hp = floor(vWorldPos * 6.0);
            float h1 = fract(sin(dot(hp.xz, vec2(12.9898, 78.233))) * 43758.5453);
            vec3 hp2 = floor(vWorldPos * 1.5);
            float h2 = fract(sin(dot(hp2.xz + hp2.y, vec2(45.165, 91.371))) * 12345.6789);
            float grain = (h1 - 0.5) * 0.10 + (h2 - 0.5) * 0.06;
            // Tint the grain slightly cooler in shadow, warmer in light, so
            // it reads as material grit instead of color noise
            col += vec3(grain * 0.9, grain * 0.85, grain * 1.05);
            // Per-fragment AO-ish darkening on near-horizontal upward faces
            // sitting near y=0..1 (catches the deck/sand edges)
            float lowSurface = (1.0 - smoothstep(0.0, 1.5, vWorldPos.y)) * max(vNormal.y, 0.0);
            col *= mix(1.0, 0.78, lowSurface * 0.55);

            float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
            col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      });
      materials.push(mat);
      return mat;
    }

    // -----------------------------------------------------
    // Ground (white travertine patio — matches the villa deck)
    // -----------------------------------------------------
    const groundMat = makePS2Material({ color: 0xc0bcb0 });
    // b029 — Deck shrunk from 180×80 to a 56×52 patio that just covers the
    // villa footprint + pool deck. The new 360° beach wraps around it.
    // y bumped slightly above the beach (0.04 vs beach 0.02) so the deck
    // sits on top as an elevated patio.
    // b035 — converted from a flat PlaneGeometry to a thick BoxGeometry so
    // its top sits at y=0.20 (well above the beach top at 0.00 and the
    // lowered ocean at -1.50). Big y gaps eliminate the coplanar z-fight
    // that was making the deck/sand/water flicker as the camera moved.
    const ground = new THREE.Mesh(new THREE.BoxGeometry(56, 0.40, 52), groundMat);
    ground.position.set(0, 0.00, -10);  // top y = 0.20
    scene.add(ground);

    // -----------------------------------------------------
    // b035 — DECK_TOP_Y is the new y for the villa deck top surface. Used
    // by everything that "sits on the deck" so the y stack stays consistent
    // and we never have coplanar fights. Beach top = 0.00, deck top = 0.20.
    // Pool — custom water shader with tile lines + ripples
    // -----------------------------------------------------
    const poolMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:        { value: 0 },
        uBaseColor:   { value: new THREE.Color(0x18d8d0) },
        uBrightColor: { value: new THREE.Color(0xa8fff0) },
        uFogColor:    { value: new THREE.Color(0x6a1850) },
        uFogDensity:{ value: 0.0055 },
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vTopMask;
        varying float vFogDepth;
        void main() {
          vUv = uv;
          vec3 p = position;
          vTopMask = step(0.5, normal.y);
          // Ripple displacement on the top face only — subtle so the
          // surface stays readable as water during camera movement
          if (vTopMask > 0.5) {
            p.y += sin(p.x * 1.6 + uTime * 0.9) * 0.012
                 + sin(p.z * 2.1 - uTime * 0.7) * 0.008;
          }
          // No PS2 jitter on the pool — water shouldn't shatter
          vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
          vFogDepth = -mvPos.z;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uBaseColor;
        uniform vec3 uBrightColor;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        varying vec2 vUv;
        varying float vTopMask;
        varying float vFogDepth;
        void main() {
          // Tile grid
          vec2 g = abs(fract(vUv * vec2(8.0, 5.0)) - 0.5);
          float gridLine = smoothstep(0.42, 0.5, max(g.x, g.y));
          // Caustic-ish moving bands
          float band = sin((vUv.x + vUv.y * 0.6) * 18.0 + uTime * 1.8) * 0.5 + 0.5;
          float band2 = sin((vUv.x * 0.6 - vUv.y) * 22.0 - uTime * 1.3) * 0.5 + 0.5;
          float caustic = (band * band2);
          vec3 col = mix(uBaseColor, uBrightColor, caustic * 0.6 + gridLine * 0.5);
          // Boost so it reads as a glowing pool — brighter for the new aesthetic
          col *= mix(0.8, 3.6, vTopMask);
          float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
          col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    materials.push(poolMat);
    timeUniforms.push(poolMat.uniforms.uTime);

    // b016 — main pool stays the long infinity-edge bar from b014, but
    // gets a circular jacuzzi attached at the east end for shape variety
    // b035 — pool stack raised so it sits cleanly above the deck (top 0.20).
    // pool rim top 0.36 (small lip above deck), pool water top 0.45 (clear
    // separation from rim so the two never z-fight along the overlap area).
    const pool = new THREE.Mesh(new THREE.BoxGeometry(22, 0.2, 6, 28, 1, 10), poolMat);
    pool.position.set(0, 0.35, 5);
    scene.add(pool);
    // Circular jacuzzi — attached at the +x end of the main pool
    const jacuzzi = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 0.20, 24),
      poolMat
    );
    jacuzzi.position.set(13.5, 0.35, 5);
    scene.add(jacuzzi);

    // Pool rim — white travertine matching the villa
    const rimMat = makePS2Material({ color: 0xe8e4dc });
    const rim = new THREE.Mesh(new THREE.BoxGeometry(22.6, 0.22, 6.6), rimMat);
    rim.position.set(0, 0.25, 5);
    scene.add(rim);
    const jacuzziRim = new THREE.Mesh(
      new THREE.CylinderGeometry(2.7, 2.7, 0.22, 24),
      rimMat
    );
    jacuzziRim.position.set(13.5, 0.25, 5);
    scene.add(jacuzziRim);

    // -----------------------------------------------------
    // Villa — modernist 2-story w/ cantilever upper, stacked stone column
    // accents, FTG glass walls. b013: lower volume is now a HOLLOW SHELL
    // (4 walls + floor + ceiling) instead of a solid box, dimensions
    // roughly 2x in every axis. Ready for interior props in b014.
    // -----------------------------------------------------
    const villaMat       = makePS2Material({ color: 0xeeeae0 });   // white plaster (exterior)
    const villaInteriorMat = makePS2Material({ color: 0xddd6c8 }); // slightly warmer interior plaster
    const floorInteriorMat = makePS2Material({ color: 0xc9c2b2 }); // warm travertine floor inside
    const roofMat        = makePS2Material({ color: 0xe0dcd0 });   // thin slab, slightly darker
    const stoneMat       = makePS2Material({ color: 0x8a847a });   // stacked natural stone
    const podiumMat      = makePS2Material({ color: 0x6f6960 });   // b018 — darker travertine plinth under the villa
    const woodSlatMat    = makePS2Material({ color: 0x6a4a30 });   // b019 — warm wood (also used by pier, tiki bar, fire pit logs)
    const railMat        = makePS2Material({ color: 0x141014 });   // b019 — dark metal — rails, mullions, sconce housings
    const ledMat         = makePS2Material({                       // b019 — cyan LED accent strips
      color:       0x80f0ff,
      emissive:    0x80f0ff,
      emissiveAmt: 1.6,
    });
    // b024 palette
    const topiaryMat       = makePS2Material({ color: 0x3a6028 }); // brighter manicured topiary
    const lawnMat          = makePS2Material({ color: 0x5a8c38 }); // bright manicured lawn
    const bougainvilleaMat = makePS2Material({ color: 0xd83080 }); // magenta Miami villa bloom
    const roseMat          = makePS2Material({ color: 0xc02030 }); // deep red rose
    const lavenderMat      = makePS2Material({ color: 0x9468d0 }); // purple lavender
    const marbleMat        = makePS2Material({ color: 0xf6f1e4 }); // luxury white marble — paths, fountains, statues, columns, balconies, frames
    // b025 — windowMat moved up here (was declared inside the old villa block).
    // Used by: villa windows, doors, neighbor villas, yacht windows, tiki bar
    // glow, BBQ bottles, showroom glass walls. Must be declared before any
    // of those, so it lives at the top of the material section now.
    const windowMat = makePS2Material({
      color:       0xffd090,
      emissive:    0xffc880,
      emissiveAmt: 0.95,
    });
    // b025 — terracotta tile roof for the new Mediterranean villa
    const terracottaMat = makePS2Material({ color: 0xc05030 });
    // b025 — lanternBaseMat + lanternGlowMat moved up here (were declared
    // around line 980 inside the deck-lantern block). Used by: deck lanterns,
    // villa wall sconces, bell tower bell rope, BBQ heat strip, fire pit
    // glow, jet ski seats, garden urn glows, garden pathway lanterns. Must
    // be declared before the villa block uses them in addSconce, otherwise
    // TDZ — node --check passes but page crashes silently on init (b017
    // lesson, b025 hotfix).
    const lanternBaseMat = makePS2Material({ color: 0x2a241c });
    const lanternGlowMat = makePS2Material({
      color:       0xffd090,
      emissive:    0xffd090,
      emissiveAmt: 2.6,
    });

    // =====================================================================
    // VILLA — MODERN MIAMI BEACH MANSION REBUILD (b037)
    //
    // U-shaped footprint preserved (so interior LIVING/BEDROOM/BILLIARD
    // rooms keep working untouched), but the surface language is rewritten
    // top to bottom: all white plaster (no more stone ground floor), flat
    // roofs with rooftop terraces (no more hipped terracotta), floor-to-
    // ceiling frameless glass spans (no more arched windows + mullion grids),
    // a slim white horizontal eyebrow + open colonnade across the full front
    // (no more arched entry with round marble columns + iron balustrade),
    // a cylindrical drum pavilion at the east-front corner to break the
    // all-rectangles silhouette, and a rooftop pavilion replacing the
    // bell-tower campanile as the iconic vertical element. The
    // `bell_tower` click→card target is preserved on the new pavilion so
    // its track card still wires.
    //
    // User feedback b036: "lowkey still super robloxy cuz its super blocky.
    // also mansion is not an open design. fack the windows i want a huge
    // white mansion, crazy looking almost like some vacation resort type
    // shit by the beach. modern miami yes that correct."
    //
    // Replaces the b025 Mediterranean U-shape (stone+plaster, hipped
    // terracotta, arched windows, marble surrounds, mullion grids, bell
    // tower, wrought iron balustrade). Replaced before that the b010-b019
    // modernist stack — this rebuild is essentially modernist done right
    // (resort scale, deep cantilever shadows, frameless glass, slim
    // colonnade) instead of the b010 "boxes glued together" version.
    // =====================================================================

    const villaCx = 0;
    const villaCz = -10;
    const podiumTopY = 0.82;   // top of the podium (where the villa sits)
    const wallT = 0.4;

    // ---- Footprint constants ----
    const centralW = 14;
    const centralD = 14;
    const centralH1 = 4;       // ground floor height
    const centralH2 = 4;       // upper floor height
    const centralTopY = podiumTopY + centralH1 + centralH2;  // 8.82

    const wingW = 9;
    const wingD = 14;          // flush with central depth
    const wingH1 = 3;          // wing ground floor height
    const wingH2 = 3;          // wing upper floor height
    const wingTopY = podiumTopY + wingH1 + wingH2;  // 6.82

    const villaFullW = centralW + 2 * wingW;  // 32
    const villaFullD = centralD;              // 14

    const centralLeftX  = villaCx - centralW / 2;   // -7
    const centralRightX = villaCx + centralW / 2;   //  7
    const centralFrontZ = villaCz + centralD / 2;   // -3
    const centralBackZ  = villaCz - centralD / 2;   // -17

    const eastWingCx     = centralRightX + wingW / 2;   //  11.5
    const westWingCx     = centralLeftX  - wingW / 2;   // -11.5
    const eastWingRightX = eastWingCx + wingW / 2;      //  16
    const westWingLeftX  = westWingCx - wingW / 2;      // -16

    // ---- Podium (b018, slightly enlarged) ----
    const podium = new THREE.Mesh(
      new THREE.BoxGeometry(villaFullW + 2.0, 0.8, villaFullD + 6.0),
      podiumMat
    );
    podium.position.set(villaCx, 0.4, villaCz);
    scene.add(podium);

    // -------------------------------------------------------------------
    // Helper: 4-sided wall box around a footprint
    // -------------------------------------------------------------------
    function addWallBox(cx, cz, w, d, h, yBase, mat) {
      const cy = yBase + h / 2;
      const front = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallT), mat);
      front.position.set(cx, cy, cz + d / 2 - wallT / 2);
      scene.add(front);
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallT), mat);
      back.position.set(cx, cy, cz - d / 2 + wallT / 2);
      scene.add(back);
      const left = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, d), mat);
      left.position.set(cx - w / 2 + wallT / 2, cy, cz);
      scene.add(left);
      const right = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, d), mat);
      right.position.set(cx + w / 2 - wallT / 2, cy, cz);
      scene.add(right);
    }

    // -------------------------------------------------------------------
    // Helper: 3-sided wall box (front face omitted) — used when the front
    // of a section is fully glass instead of plaster
    // -------------------------------------------------------------------
    function addWallBoxOpenFront(cx, cz, w, d, h, yBase, mat) {
      const cy = yBase + h / 2;
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallT), mat);
      back.position.set(cx, cy, cz - d / 2 + wallT / 2);
      scene.add(back);
      const left = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, d), mat);
      left.position.set(cx - w / 2 + wallT / 2, cy, cz);
      scene.add(left);
      const right = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, d), mat);
      right.position.set(cx + w / 2 - wallT / 2, cy, cz);
      scene.add(right);
    }

    // -------------------------------------------------------------------
    // Helper: floor-to-ceiling frameless glass span — single big pane,
    // slim marble reveal at the slab top + bottom only (no mullion grid,
    // no side frames). The "frameless" look is the whole point of the
    // modern Miami language — opposite of the b025 arched/mullion windows.
    // -------------------------------------------------------------------
    function addGlassSpan(cx, cy, cz, w, h) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), windowMat);
      pane.position.set(cx, cy, cz);
      scene.add(pane);
      // Slim marble reveal at the top (where this span meets the slab above)
      const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.10, 0.10, 0.16), marbleMat);
      top.position.set(cx, cy + h / 2 + 0.05, cz);
      scene.add(top);
      // Slim marble reveal at the bottom (where this span meets the floor)
      const bot = new THREE.Mesh(new THREE.BoxGeometry(w + 0.10, 0.10, 0.16), marbleMat);
      bot.position.set(cx, cy - h / 2 - 0.05, cz);
      scene.add(bot);
    }

    // -------------------------------------------------------------------
    // Helper: wall sconce — small dark housing + warm glow box
    // -------------------------------------------------------------------
    function addSconce(x, y, z) {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.18), railMat);
      housing.position.set(x, y, z);
      scene.add(housing);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.12), lanternGlowMat);
      glow.position.set(x, y + 0.05, z);
      scene.add(glow);
    }

    // -------------------------------------------------------------------
    // Helper: flat roof slab + parapet wall around its perimeter. Combined
    // because every flat roof in this build wants both. parapetH=0.5 reads
    // as a knee-high modernist parapet at this scale.
    // -------------------------------------------------------------------
    function addFlatRoofWithParapet(cx, cz, w, d, yTop) {
      // Roof slab (slightly oversized — projects 0.2 past walls)
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.4, 0.20, d + 0.4),
        villaMat
      );
      slab.position.set(cx, yTop + 0.10, cz);
      scene.add(slab);
      // Travertine deck plane sitting on top of the slab (rooftop terrace)
      const deck = new THREE.Mesh(
        new THREE.PlaneGeometry(w + 0.2, d + 0.2),
        floorInteriorMat
      );
      deck.rotation.x = -Math.PI / 2;
      deck.position.set(cx, yTop + 0.21, cz);
      scene.add(deck);
      // Parapet (4 sides, knee-high)
      const ph = 0.5;
      const pt = 0.18;
      const py = yTop + 0.20 + ph / 2;
      const pw = w + 0.4;
      const pd = d + 0.4;
      const front = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pt), villaMat);
      front.position.set(cx, py, cz + pd / 2 - pt / 2);
      scene.add(front);
      const back = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pt), villaMat);
      back.position.set(cx, py, cz - pd / 2 + pt / 2);
      scene.add(back);
      const left = new THREE.Mesh(new THREE.BoxGeometry(pt, ph, pd), villaMat);
      left.position.set(cx - pw / 2 + pt / 2, py, cz);
      scene.add(left);
      const right = new THREE.Mesh(new THREE.BoxGeometry(pt, ph, pd), villaMat);
      right.position.set(cx + pw / 2 - pt / 2, py, cz);
      scene.add(right);
    }

    // -------------------------------------------------------------------
    // Helper: slim round white column (the colonnade column language)
    // -------------------------------------------------------------------
    function addColumn(cx, cz, h, yBase) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, h, 12),
        villaMat
      );
      col.position.set(cx, yBase + h / 2, cz);
      scene.add(col);
    }

    // -------------------------------------------------------------------
    // Helper: horizontal eyebrow slab — slim white cantilever projecting
    // forward from a facade at a given height. The other half of the
    // modern Miami language: deep horizontal shadows.
    // -------------------------------------------------------------------
    function addEyebrow(cx, cy, cz, w, proj) {
      const eb = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.18, proj),
        villaMat
      );
      eb.position.set(cx, cy, cz + proj / 2);
      scene.add(eb);
    }

    // =====================================================================
    // CENTRAL BLOCK (14×14, 2 floors, FLAT ROOF + rooftop terrace)
    //
    // All-white plaster, 3 walls (back + 2 sides) per floor — front face
    // is glass spans + a wide open entry. Solid plaster strip behind the
    // existing living-room TV (which sits at x=0±2.5, z≈-3.6) so the TV
    // doesn't read against the open colonnade beyond.
    // =====================================================================

    // Back + side walls only — front is glass
    addWallBoxOpenFront(villaCx, villaCz, centralW, centralD, centralH1, podiumTopY, villaMat);
    addWallBoxOpenFront(villaCx, villaCz, centralW, centralD, centralH2, podiumTopY + centralH1, villaMat);

    // Solid plaster strip behind the living-room TV (ground floor only)
    {
      const tvBackW = 5.4;
      const tvBack = new THREE.Mesh(
        new THREE.BoxGeometry(tvBackW, centralH1, wallT),
        villaMat
      );
      tvBack.position.set(
        villaCx,
        podiumTopY + centralH1 / 2,
        centralFrontZ - wallT / 2
      );
      scene.add(tvBack);

      // Glass spans flanking the TV strip (ground floor)
      const sideW = (centralW - tvBackW) / 2 - wallT - 0.2;
      const sideCxLeft  = villaCx - tvBackW / 2 - sideW / 2 - 0.1;
      const sideCxRight = villaCx + tvBackW / 2 + sideW / 2 + 0.1;
      const groundY = podiumTopY + centralH1 / 2;
      addGlassSpan(sideCxLeft,  groundY, centralFrontZ + 0.04, sideW, centralH1 - 0.4);
      addGlassSpan(sideCxRight, groundY, centralFrontZ + 0.04, sideW, centralH1 - 0.4);
    }

    // Upper floor — 3 huge frameless glass spans across the full width
    {
      const upperY = podiumTopY + centralH1 + centralH2 / 2;
      const usable = centralW - wallT * 2 - 0.4;
      const spanW = usable / 3 - 0.1;
      for (let i = 0; i < 3; i++) {
        const cx = villaCx - usable / 2 + spanW / 2 + i * (spanW + 0.1);
        addGlassSpan(cx, upperY, centralFrontZ + 0.04, spanW, centralH2 - 0.4);
      }
    }

    // Slim marble floor-line eyebrow between ground + upper (full width,
    // projects forward 0.4 — modern Miami's signature horizontal line)
    const cFloorLine = new THREE.Mesh(
      new THREE.BoxGeometry(centralW + 0.8, 0.16, 0.4),
      marbleMat
    );
    cFloorLine.position.set(villaCx, podiumTopY + centralH1, centralFrontZ + 0.20);
    scene.add(cFloorLine);

    // Interior floor (travertine, kept — interior rooms depend on this)
    const cInteriorFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(centralW - wallT * 2, centralD - wallT * 2),
      floorInteriorMat
    );
    cInteriorFloor.rotation.x = -Math.PI / 2;
    cInteriorFloor.position.set(villaCx, podiumTopY + 0.01, villaCz);
    scene.add(cInteriorFloor);

    // Interior ceiling under the upper floor
    const cInteriorCeiling = new THREE.Mesh(
      new THREE.PlaneGeometry(centralW - wallT * 2, centralD - wallT * 2),
      villaInteriorMat
    );
    cInteriorCeiling.rotation.x = Math.PI / 2;
    cInteriorCeiling.position.set(villaCx, podiumTopY + centralH1 - 0.01, villaCz);
    scene.add(cInteriorCeiling);

    // Flat roof slab + rooftop terrace + parapet
    addFlatRoofWithParapet(villaCx, villaCz, centralW, centralD, centralTopY);

    // Two travertine planters with topiary cones on the central rooftop
    // (front edge, flanking the rooftop pavilion)
    for (const dx of [-centralW / 2 + 1.8, centralW / 2 - 1.8]) {
      const planter = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.7, 1.4),
        marbleMat
      );
      planter.position.set(
        villaCx + dx,
        centralTopY + 0.20 + 0.35,
        centralFrontZ - 1.6
      );
      scene.add(planter);
      const topiary = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.65, 1.6, 8),
        topiaryMat
      );
      topiary.position.set(
        villaCx + dx,
        centralTopY + 0.20 + 0.7 + 0.8,
        centralFrontZ - 1.6
      );
      scene.add(topiary);
    }

    // =====================================================================
    // EAST WING (9×14, all white plaster, flat roof + rooftop terrace)
    // =====================================================================
    // Back + side walls only — front face is glass spans
    addWallBoxOpenFront(eastWingCx, villaCz, wingW, wingD, wingH1, podiumTopY, villaMat);
    addWallBoxOpenFront(eastWingCx, villaCz, wingW, wingD, wingH2, podiumTopY + wingH1, villaMat);

    // Front facade: 2 huge glass spans on each floor
    {
      const wgY = podiumTopY + wingH1 / 2;
      const wuY = podiumTopY + wingH1 + wingH2 / 2;
      const spanW = (wingW - wallT * 2) / 2 - 0.2;
      addGlassSpan(eastWingCx - spanW / 2 - 0.1, wgY, centralFrontZ + 0.04, spanW, wingH1 - 0.4);
      addGlassSpan(eastWingCx + spanW / 2 + 0.1, wgY, centralFrontZ + 0.04, spanW, wingH1 - 0.4);
      addGlassSpan(eastWingCx - spanW / 2 - 0.1, wuY, centralFrontZ + 0.04, spanW, wingH2 - 0.4);
      addGlassSpan(eastWingCx + spanW / 2 + 0.1, wuY, centralFrontZ + 0.04, spanW, wingH2 - 0.4);
    }

    // Floor-line eyebrow between wing's two floors
    {
      const eb = new THREE.Mesh(
        new THREE.BoxGeometry(wingW + 0.6, 0.16, 0.4),
        marbleMat
      );
      eb.position.set(eastWingCx, podiumTopY + wingH1, centralFrontZ + 0.20);
      scene.add(eb);
    }

    // Flat roof + rooftop terrace + parapet
    addFlatRoofWithParapet(eastWingCx, villaCz, wingW, wingD, wingTopY);

    // East wing side door (east-facing wall) — slab door + glow (kept)
    {
      const sideDoor = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.6, 1.4), windowMat);
      sideDoor.position.set(eastWingRightX + 0.05, podiumTopY + 1.3, villaCz);
      scene.add(sideDoor);
      const sFrame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.20, 1.7), marbleMat);
      sFrame.position.set(eastWingRightX + 0.06, podiumTopY + 2.7, villaCz);
      scene.add(sFrame);
    }

    // =====================================================================
    // EAST WING — CYLINDRICAL CORNER PAVILION
    // Cylindrical white drum at the front-east corner of the east wing,
    // 1 story tall, flat canopy on top. The single non-rectangular volume
    // in the whole composition — kills the all-blocks read, gives the
    // building one curved silhouette element. Sits half outside the wing
    // footprint so it reads as a clearly separate form.
    // =====================================================================
    {
      const drumR = 2.4;
      const drumH = wingH1 + wingH2;   // full wing height
      const drumCx = eastWingRightX + 0.4;
      const drumCz = centralFrontZ + 0.4;

      // White drum
      const drum = new THREE.Mesh(
        new THREE.CylinderGeometry(drumR, drumR, drumH, 16),
        villaMat
      );
      drum.position.set(drumCx, podiumTopY + drumH / 2, drumCz);
      scene.add(drum);

      // Continuous floor-to-ceiling glass band wrapping the drum at the
      // upper floor — slim windowMat ring just outside the drum surface
      const glassRing = new THREE.Mesh(
        new THREE.CylinderGeometry(drumR + 0.04, drumR + 0.04, wingH2 - 0.6, 16, 1, true),
        windowMat
      );
      glassRing.position.set(drumCx, podiumTopY + wingH1 + wingH2 / 2, drumCz);
      scene.add(glassRing);

      // Flat circular canopy slab on top
      const drumRoof = new THREE.Mesh(
        new THREE.CylinderGeometry(drumR + 0.5, drumR + 0.5, 0.20, 16),
        villaMat
      );
      drumRoof.position.set(drumCx, podiumTopY + drumH + 0.10, drumCz);
      scene.add(drumRoof);

      // Marble floor-line ring at the slab between floors
      const drumRing = new THREE.Mesh(
        new THREE.CylinderGeometry(drumR + 0.12, drumR + 0.12, 0.18, 16),
        marbleMat
      );
      drumRing.position.set(drumCx, podiumTopY + wingH1, drumCz);
      scene.add(drumRing);
    }

    // =====================================================================
    // WEST WING (9×14, mirror of east — no corner pavilion, has bedroom)
    // =====================================================================
    addWallBoxOpenFront(westWingCx, villaCz, wingW, wingD, wingH1, podiumTopY, villaMat);
    addWallBoxOpenFront(westWingCx, villaCz, wingW, wingD, wingH2, podiumTopY + wingH1, villaMat);

    {
      const wgY = podiumTopY + wingH1 / 2;
      const wuY = podiumTopY + wingH1 + wingH2 / 2;
      const spanW = (wingW - wallT * 2) / 2 - 0.2;
      addGlassSpan(westWingCx - spanW / 2 - 0.1, wgY, centralFrontZ + 0.04, spanW, wingH1 - 0.4);
      addGlassSpan(westWingCx + spanW / 2 + 0.1, wgY, centralFrontZ + 0.04, spanW, wingH1 - 0.4);
      addGlassSpan(westWingCx - spanW / 2 - 0.1, wuY, centralFrontZ + 0.04, spanW, wingH2 - 0.4);
      addGlassSpan(westWingCx + spanW / 2 + 0.1, wuY, centralFrontZ + 0.04, spanW, wingH2 - 0.4);
    }

    {
      const eb = new THREE.Mesh(
        new THREE.BoxGeometry(wingW + 0.6, 0.16, 0.4),
        marbleMat
      );
      eb.position.set(westWingCx, podiumTopY + wingH1, centralFrontZ + 0.20);
      scene.add(eb);
    }

    addFlatRoofWithParapet(westWingCx, villaCz, wingW, wingD, wingTopY);

    {
      const sideDoor = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.6, 1.4), windowMat);
      sideDoor.position.set(westWingLeftX - 0.05, podiumTopY + 1.3, villaCz);
      scene.add(sideDoor);
      const sFrame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.20, 1.7), marbleMat);
      sFrame.position.set(westWingLeftX - 0.06, podiumTopY + 2.7, villaCz);
      scene.add(sFrame);
    }

    // =====================================================================
    // OPEN COLONNADE — slim white round columns spanning the full front,
    // supporting a horizontal cantilever eyebrow that runs the entire
    // 32-wide façade. The "resort entry" silhouette — kills the boxy read.
    // 7 columns, 1 story tall, sit forward of the front wall at z=0.
    // =====================================================================
    {
      const colY = 0;                 // ground (deck) level
      const colH = podiumTopY + centralH1;   // ground floor full height
      const colZ = centralFrontZ + 3.0;
      const colCount = 7;
      for (let i = 0; i < colCount; i++) {
        const t = i / (colCount - 1);
        const x = -villaFullW / 2 + 0.8 + t * (villaFullW - 1.6);
        addColumn(x, colZ, colH, colY);
      }

      // Horizontal cantilever eyebrow on top of the columns, extending
      // the full façade width. Slim slab — projects 1.6 deep.
      const ebSlab = new THREE.Mesh(
        new THREE.BoxGeometry(villaFullW + 0.8, 0.22, 1.6),
        villaMat
      );
      ebSlab.position.set(villaCx, colY + colH + 0.11, colZ);
      scene.add(ebSlab);

      // Cove glow strip on the underside of the eyebrow, facing the
      // colonnade — warm hidden lighting (modern Miami signature)
      const cove = new THREE.Mesh(
        new THREE.BoxGeometry(villaFullW - 0.8, 0.06, 1.2),
        lanternGlowMat
      );
      cove.position.set(villaCx, colY + colH - 0.04, colZ);
      scene.add(cove);
    }

    // =====================================================================
    // ROOFTOP PAVILION — small white cube + cantilever canopy on slim
    // columns, sitting on the central rooftop terrace. The new iconic
    // vertical accent (replaces the b025 bell tower campanile). Carries
    // the `bell_tower` click→card target so its track card still wires.
    // =====================================================================
    {
      const pavCx = villaCx;
      const pavCz = villaCz - 1.5;
      const pavY  = centralTopY + 0.20;   // rooftop deck top
      const pavW = 4.0;
      const pavD = 4.0;
      const pavH = 2.6;

      // White cube room (the pavilion volume)
      const pavRoom = new THREE.Mesh(
        new THREE.BoxGeometry(pavW, pavH, pavD),
        villaMat
      );
      pavRoom.position.set(pavCx, pavY + pavH / 2, pavCz);
      pavRoom.name = 'bell_tower';   // preserve b025 click→card target
      scene.add(pavRoom);

      // Warm glow front face (so it reads as a lit pavilion at dusk)
      const pavFront = new THREE.Mesh(
        new THREE.BoxGeometry(pavW - 0.6, pavH - 0.6, 0.06),
        windowMat
      );
      pavFront.position.set(pavCx, pavY + pavH / 2, pavCz + pavD / 2 + 0.04);
      scene.add(pavFront);

      // Flat canopy slab cantilevering forward over the rooftop deck
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(pavW + 4.0, 0.20, pavD + 2.4),
        villaMat
      );
      canopy.position.set(pavCx, pavY + pavH + 0.10, pavCz + 0.6);
      scene.add(canopy);

      // 2 slim columns supporting the canopy front edge
      for (const dx of [-(pavW / 2 + 1.6), pavW / 2 + 1.6]) {
        addColumn(pavCx + dx, pavCz + pavD / 2 + 0.6, pavH, pavY);
      }

      // Sconce on each side of the pavilion front
      addSconce(pavCx - pavW / 2 - 0.3, pavY + pavH * 0.6, pavCz + pavD / 2 + 0.05);
      addSconce(pavCx + pavW / 2 + 0.3, pavY + pavH * 0.6, pavCz + pavD / 2 + 0.05);
    }

    // =====================================================================
    // WALL SCONCES (warm-glow lanterns at entries + corners + colonnade)
    // =====================================================================
    // Front facade — flanking the central entry behind the colonnade
    addSconce(villaCx - 2.8, podiumTopY + 2.6, centralFrontZ + 0.20);
    addSconce(villaCx + 2.8, podiumTopY + 2.6, centralFrontZ + 0.20);
    // Front facade — front corners of central upper floor
    addSconce(centralLeftX  + 0.4, podiumTopY + centralH1 + 1.5, centralFrontZ + 0.20);
    addSconce(centralRightX - 0.4, podiumTopY + centralH1 + 1.5, centralFrontZ + 0.20);
    // East wing side door sconces
    addSconce(eastWingRightX + 0.20, podiumTopY + 2.4, villaCz - 1.5);
    addSconce(eastWingRightX + 0.20, podiumTopY + 2.4, villaCz + 1.5);
    // West wing side door sconces
    addSconce(westWingLeftX - 0.20, podiumTopY + 2.4, villaCz - 1.5);
    addSconce(westWingLeftX - 0.20, podiumTopY + 2.4, villaCz + 1.5);
    // Back facade — flanking the back door area
    addSconce(villaCx - 1.8, podiumTopY + 2.6, centralBackZ - 0.20);
    addSconce(villaCx + 1.8, podiumTopY + 2.6, centralBackZ - 0.20);
    // Wing front facade sconces (between the floors, on the eyebrow line)
    addSconce(eastWingCx, podiumTopY + wingH1 + 1.0, centralFrontZ + 0.20);
    addSconce(westWingCx, podiumTopY + wingH1 + 1.0, centralFrontZ + 0.20);

    // ---- Back door (warm glow slab on the central block back wall) ----
    {
      const bd = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.8, 0.10), windowMat);
      bd.position.set(villaCx, podiumTopY + 1.4, centralBackZ - 0.04);
      scene.add(bd);
      const bdSlab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.06), railMat);
      bdSlab.position.set(villaCx, podiumTopY + 1.4, centralBackZ - 0.10);
      scene.add(bdSlab);
    }

    // =====================================================================
    // GRAND ENTRANCE — marble steps + planters at the new central entry
    // (relocated from b019 doorX = -6.995 to villaCx = 0)
    // =====================================================================
    {
      const doorX = villaCx;
      // 4 marble steps from y=0 (deck) up to y=0.8 (podium top)
      for (let i = 0; i < 4; i++) {
        const stepY = 0.10 + i * 0.20;
        const stepZ = centralFrontZ + 0.5 + (3 - i) * 0.55;
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(5.0, 0.20, 0.55),
          marbleMat
        );
        step.position.set(doorX, stepY, stepZ);
        scene.add(step);
      }
      // Marble planter boxes flanking the steps
      function addEntryPlanter(px) {
        const planter = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 1.1, 1.1),
          marbleMat
        );
        planter.position.set(px, 0.55, centralFrontZ + 1.6);
        scene.add(planter);
        const trim = new THREE.Mesh(
          new THREE.BoxGeometry(1.16, 0.06, 1.16),
          railMat
        );
        trim.position.set(px, 1.10, centralFrontZ + 1.6);
        scene.add(trim);
        const cone = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.60, 1.8, 8),
          topiaryMat
        );
        cone.position.set(px, 2.00, centralFrontZ + 1.6);
        scene.add(cone);
      }
      addEntryPlanter(doorX - 3.4);
      addEntryPlanter(doorX + 3.4);
    }

    // -----------------------------------------------------
    // Palms — helper + scattered around the property
    // -----------------------------------------------------
    const trunkMat = makePS2Material({ color: 0x4a3868 });
    const frondMat = makePS2Material({ color: 0x7a3aa8 });

    function addPalm(x, z, height) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.30, height, 5),
        trunkMat
      );
      trunk.position.set(x, height / 2, z);
      scene.add(trunk);
      const fronds = 9;
      for (let i = 0; i < fronds; i++) {
        const a = (i / fronds) * Math.PI * 2;
        const f = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.55, 1, 1), frondMat);
        f.position.set(x + Math.cos(a) * 1.4, height - 0.15, z + Math.sin(a) * 1.4);
        f.rotation.y = -a;
        f.rotation.z = -0.7;
        scene.add(f);
      }
    }

    // b023 — pool/villa palms relocated. Original positions
    // (-9, 4) and (4, 5.5) were INSIDE the pool (x ∈ [-11,11], z ∈ [2,8]),
    // and (-7, -5) and (7.5, -4.5) were INSIDE the villa lower volume
    // (z ∈ [-19,-1]). Pool grew in b014 + villa grew in b013 and these
    // never got repositioned. Now framing the front entry approach.
    addPalm(-14.0, 16.0, 6.8);
    addPalm(-12.0, 24.0, 6.0);
    addPalm( 14.0, 16.0, 5.4);
    addPalm( 12.0, 24.0, 6.2);

    // -----------------------------------------------------
    // Deck lanterns — small warm-glow lanterns on the pool deck
    // (b010 — replaces the old sodium streetlamp)
    // (b025 — lanternBaseMat + lanternGlowMat declarations moved up to
    //  the top of the material section so the villa sconces can use them)
    // -----------------------------------------------------
    // b035 — baseY param so pool-deck callsites (deck top 0.20) and garden
    // callsites (lawn top ~0.10) place lanterns at the right height.
    function addDeckLantern(x, z, baseY = 0.20) {
      // Tiny base
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.30, 0.12, 0.30),
        lanternBaseMat
      );
      base.position.set(x, baseY + 0.06, z);
      scene.add(base);
      // Glowing glass body
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.6, 0.25),
        lanternGlowMat
      );
      body.position.set(x, baseY + 0.42, z);
      scene.add(body);
      // Tiny dark cap on top
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.06, 0.32),
        lanternBaseMat
      );
      cap.position.set(x, baseY + 0.75, z);
      scene.add(cap);
    }

    // b014 — lanterns pushed forward to clear the new bigger pool
    addDeckLantern(-9.0, 9.5);
    addDeckLantern(-3.0, 9.5);
    addDeckLantern( 3.0, 9.5);
    addDeckLantern( 9.0, 9.5);

    // b029 — Garage REMOVED. The street/road/neighborhood is gone in the
    // WORLD rebuild — house is now on a private beach with no inland side.
    // Yellow Lambo relocated to the deck near the pink Lambo.

    // -----------------------------------------------------
    // Lambo — wedge supercar. b015: built into a Group so we can rotate it
    // around its own center via the rotY parameter (CCW radians around Y).
    // -----------------------------------------------------
    function addCar(cx, cz, bodyColorHex, rotY = 0, name = null, baseY = 0.20) {
      const bodyMat = makePS2Material({
        color:       bodyColorHex,
        emissive:    bodyColorHex,
        emissiveAmt: 0.18,
      });
      const cabMat       = makePS2Material({ color: 0x080810 });
      const wheelMat     = makePS2Material({ color: 0x050505 });
      const headlightMat = makePS2Material({
        color:       0xfff8e0,
        emissive:    0xfff8e0,
        emissiveAmt: 2.4,
      });
      const taillightMat = makePS2Material({
        color:       0xff1a30,
        emissive:    0xff2030,
        emissiveAmt: 1.8,
      });

      const g = new THREE.Group();

      // Main body — long along z, low and wide (hood at +z end)
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.55, 4.4), bodyMat);
      body.position.set(0, 0.55, 0);
      g.add(body);

      // Hood wedge (smaller box on top toward the front)
      const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 1.7), bodyMat);
      hood.position.set(0, 0.93, 1.1);
      g.add(hood);

      // Cabin — slightly back from center
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.42, 1.8), cabMat);
      cab.position.set(0, 1.05, -0.4);
      g.add(cab);

      // Wheels — 4 dark squat boxes at the corners
      const wheelOffsets = [
        [-0.97,  1.6],
        [ 0.97,  1.6],
        [-0.97, -1.6],
        [ 0.97, -1.6],
      ];
      wheelOffsets.forEach(([dx, dz]) => {
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.55, 0.78), wheelMat);
        w.position.set(dx, 0.27, dz);
        g.add(w);
      });

      // Headlights (front, +z end)
      [-0.55, 0.55].forEach(dx => {
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 0.08), headlightMat);
        h.position.set(dx, 0.78, 2.22);
        g.add(h);
      });

      // Taillights (rear, -z end)
      [-0.55, 0.55].forEach(dx => {
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.08), taillightMat);
        t.position.set(dx, 0.78, -2.22);
        g.add(t);
      });

      // b035 — baseY lifts the car so its wheels touch the deck/showroom-
      // floor top instead of the old y=0 ground. Default 0.20 = deck top.
      g.position.set(cx, baseY, cz);
      g.rotation.y = rotY;
      if (name) g.name = name;
      scene.add(g);
      return g;
    }

    // b029 — Yellow Lambo relocated from the (deleted) driveway to the
    // east side of the deck, mirroring the pink Lambo on the west side.
    // Both supercars now on display flanking the pool.
    addCar(14.0, 5.0, 0xf5d518, Math.PI / 4, 'lambo_yellow');
    // b016 — Pink Lambo rotation flipped (-PI/4 not +PI/4) so hood points
    // toward (-x, +z) — diagonally toward the front-left of the property
    addCar(-14.0, 5.0, 0xff2d95, -Math.PI / 4, 'lambo_pink');

    // Shrub helper (b015) + bigger cluster around pink Lambo (b016)
    // b024 — bumped from 0x2a4a25 (fog-killed dark) to 0x4a7a30 (manicured green that survives the fog)
    const shrubMat = makePS2Material({ color: 0x4a7a30 });
    function addShrub(x, z, size) {
      const s = new THREE.Mesh(
        new THREE.IcosahedronGeometry(size, 0),
        shrubMat
      );
      s.position.set(x, size * 0.55, z);
      s.rotation.set(x * 0.13, z * 0.21, x * 0.07);
      scene.add(s);
    }
    // b018 — shrubs moved to ONE side (north of car only) so the Lambo is
    // visible from the camera default angle. Was a tight surround in b016
    // that engulfed the car.
    addShrub(-16.5, 7.0, 0.95);
    addShrub(-14.5, 8.0, 0.75);
    addShrub(-17.5, 5.5, 0.65);

    // =====================================================
    // b029 — INDOOR POOL ATRIUM (attached to back of villa)
    // Where the garage used to be, now a tall glass-walled atrium with a
    // smaller indoor pool, lounge chairs, and a sauna door. Camera anchor
    // "Indoor Pool" flies inside this room.
    // =====================================================
    {
      const atriumW = 16, atriumH = 8, atriumD = 12;
      const atriumCx = 0;
      const atriumCz = villaCz - centralD / 2 - atriumD / 2 - 0.2;  // touching back wall
      const atriumYBase = podiumTopY;

      // Atrium walls — use the existing windowMat (emissive glass)
      // Side walls (east/west)
      const atriumWallE = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, atriumH, atriumD),
        windowMat
      );
      atriumWallE.position.set(atriumCx + atriumW / 2, atriumYBase + atriumH / 2, atriumCz);
      scene.add(atriumWallE);

      const atriumWallW = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, atriumH, atriumD),
        windowMat
      );
      atriumWallW.position.set(atriumCx - atriumW / 2, atriumYBase + atriumH / 2, atriumCz);
      scene.add(atriumWallW);

      // Back wall (the far one, opposite the villa)
      const atriumWallB = new THREE.Mesh(
        new THREE.BoxGeometry(atriumW, atriumH, 0.2),
        windowMat
      );
      atriumWallB.position.set(atriumCx, atriumYBase + atriumH / 2, atriumCz - atriumD / 2);
      scene.add(atriumWallB);

      // Atrium roof slab — slightly darker than villa, lets the room read as covered
      const atriumRoof = new THREE.Mesh(
        new THREE.BoxGeometry(atriumW + 0.6, 0.3, atriumD + 0.6),
        roofMat
      );
      atriumRoof.position.set(atriumCx, atriumYBase + atriumH + 0.15, atriumCz);
      scene.add(atriumRoof);

      // Atrium floor — pale tile, slightly raised above the deck
      const tileMat = makePS2Material({ color: 0xc8d6e0 });
      const atriumFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(atriumW - 0.4, atriumD - 0.4),
        tileMat
      );
      atriumFloor.rotation.x = -Math.PI / 2;
      atriumFloor.position.set(atriumCx, atriumYBase + 0.02, atriumCz);
      scene.add(atriumFloor);

      // Indoor pool — smaller cyan rectangle inside the atrium
      const indoorPool = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.18, 4, 12, 1, 6),
        poolMat
      );
      indoorPool.position.set(atriumCx, atriumYBase + 0.10, atriumCz + 0.5);
      indoorPool.name = 'indoor_pool';
      scene.add(indoorPool);

      // Sauna — small wooden box at one end of the atrium
      const saunaMat = makePS2Material({ color: 0x6a3a1a });   // dark wood
      const saunaW = 3, saunaH = 2.6, saunaD = 2.6;
      const saunaCx = atriumCx + atriumW / 2 - saunaW / 2 - 0.4;
      const saunaCz = atriumCz - atriumD / 2 + saunaD / 2 + 0.4;
      const sauna = new THREE.Mesh(
        new THREE.BoxGeometry(saunaW, saunaH, saunaD),
        saunaMat
      );
      sauna.position.set(saunaCx, atriumYBase + saunaH / 2, saunaCz);
      sauna.name = 'sauna';
      scene.add(sauna);
      // Sauna door — glowing yellow rectangle on the +z face
      const saunaDoorMat = makePS2Material({
        color:       0xffc060,
        emissive:    0xffc060,
        emissiveAmt: 1.6,
      });
      const saunaDoor = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 1.7, 0.08),
        saunaDoorMat
      );
      saunaDoor.position.set(saunaCx, atriumYBase + 0.85, saunaCz + saunaD / 2 + 0.05);
      scene.add(saunaDoor);

      // Two lounge chairs beside the indoor pool
      const indoorChairMat = makePS2Material({ color: 0xf0e8d0 });
      function addIndoorLounger(cx, cz) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 1.8), indoorChairMat);
        seat.position.set(cx, atriumYBase + 0.32, cz);
        scene.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.12), indoorChairMat);
        back.position.set(cx, atriumYBase + 0.55, cz - 0.85);
        back.rotation.x = -0.2;
        scene.add(back);
      }
      addIndoorLounger(atriumCx - 5.2, atriumCz + 0.5);
      addIndoorLounger(atriumCx + 5.2, atriumCz + 0.5);

      // A potted palm in the corner for the atrium reference look
      const potMat = makePS2Material({ color: 0xd0c0a0 });
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.7, 8), potMat);
      pot.position.set(atriumCx - atriumW / 2 + 1.0, atriumYBase + 0.35, atriumCz - atriumD / 2 + 1.0);
      scene.add(pot);
      const palmFronds = makePS2Material({
        color:       0x2a8050,
        emissive:    0x2a8050,
        emissiveAmt: 0.15,
      });
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const frond = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.35), palmFronds);
        frond.position.set(
          atriumCx - atriumW / 2 + 1.0 + Math.cos(ang) * 0.4,
          atriumYBase + 1.2,
          atriumCz - atriumD / 2 + 1.0 + Math.sin(ang) * 0.4
        );
        frond.rotation.y = ang;
        frond.rotation.z = -0.3;
        scene.add(frond);
      }
    }

    // =====================================================
    // b029 — INTERIOR FURNITURE (living room, bedroom, billiard)
    // Furniture clusters inside the existing villa shell. Camera anchors
    // fly to each cluster. No physical partitions — the orbit framing at
    // each anchor sells the "room" identity.
    // =====================================================

    // ----- LIVING ROOM (central ground floor) -----
    {
      const lrCx = villaCx;
      const lrCz = villaCz;       // -10
      const lrY  = podiumTopY;    // 0.82, ground floor

      // Big sectional sofa — long L-shape
      const sofaMat = makePS2Material({ color: 0x2a3548 });   // deep navy
      const sofaSeat = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.5, 1.6), sofaMat);
      sofaSeat.position.set(lrCx, lrY + 0.45, lrCz - 4.0);
      scene.add(sofaSeat);
      const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.85, 0.4), sofaMat);
      sofaBack.position.set(lrCx, lrY + 0.85, lrCz - 4.7);
      scene.add(sofaBack);
      // L-extension on the right
      const sofaL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.6), sofaMat);
      sofaL.position.set(lrCx + 4.3, lrY + 0.45, lrCz - 2.4);
      scene.add(sofaL);
      const sofaLBack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.85, 2.6), sofaMat);
      sofaLBack.position.set(lrCx + 5.0, lrY + 0.85, lrCz - 2.4);
      scene.add(sofaLBack);

      // Coffee table — low glass-ish slab
      const coffeeMat = makePS2Material({
        color:       0x101820,
        emissive:    0x4080a0,
        emissiveAmt: 0.3,
      });
      const coffee = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 1.2), coffeeMat);
      coffee.position.set(lrCx - 0.5, lrY + 0.45, lrCz - 2.4);
      scene.add(coffee);

      // Big TV/screen on the back wall (faces the sofa)
      const tvFrameMat = makePS2Material({ color: 0x05050a });
      const tvScreenMat = makePS2Material({
        color:       0x4030a0,
        emissive:    0xa050ff,
        emissiveAmt: 1.6,
      });
      const tvFrame = new THREE.Mesh(new THREE.BoxGeometry(5.0, 2.4, 0.16), tvFrameMat);
      tvFrame.position.set(lrCx, lrY + 1.9, lrCz + 6.4);
      scene.add(tvFrame);
      const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(4.7, 2.1, 0.04), tvScreenMat);
      tvScreen.position.set(lrCx, lrY + 1.9, lrCz + 6.32);
      tvScreen.name = 'living_tv';
      scene.add(tvScreen);

      // Rug under the seating area
      const rugMat = makePS2Material({ color: 0x6a2438 });
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 4.5), rugMat);
      rug.rotation.x = -Math.PI / 2;
      // b033 — bumped from +0.03 to +0.06 to clear coplanar z-fighting with
      // the interior floor at lrY + 0.01
      rug.position.set(lrCx, lrY + 0.06, lrCz - 3.0);
      scene.add(rug);
    }

    // ----- BEDROOM (west wing upper floor) -----
    {
      const bdCx = westWingCx;    // -11.5
      const bdCz = villaCz;       // -10
      const bdY  = podiumTopY + wingH1;   // 3.82 — upper floor

      // Bed frame
      const bedMat = makePS2Material({ color: 0xd8c0a0 });
      const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 4.6), bedMat);
      bedFrame.position.set(bdCx, bdY + 0.45, bdCz);
      scene.add(bedFrame);
      // Mattress + sheets
      const sheetMat = makePS2Material({ color: 0xf2eadc });
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.28, 4.4), sheetMat);
      mattress.position.set(bdCx, bdY + 0.78, bdCz);
      scene.add(mattress);
      // Pillows
      const pillow1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.7), sheetMat);
      pillow1.position.set(bdCx - 0.7, bdY + 1.00, bdCz - 1.7);
      scene.add(pillow1);
      const pillow2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.7), sheetMat);
      pillow2.position.set(bdCx + 0.7, bdY + 1.00, bdCz - 1.7);
      scene.add(pillow2);
      // Headboard
      const headboard = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 0.18), bedMat);
      headboard.position.set(bdCx, bdY + 1.20, bdCz - 2.4);
      scene.add(headboard);
      headboard.name = 'bed';

      // Two nightstands flanking the bed
      const nsMat = makePS2Material({ color: 0x9a7050 });
      const ns1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.7), nsMat);
      ns1.position.set(bdCx - 2.2, bdY + 0.35, bdCz - 1.9);
      scene.add(ns1);
      const ns2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.7), nsMat);
      ns2.position.set(bdCx + 2.2, bdY + 0.35, bdCz - 1.9);
      scene.add(ns2);

      // Lamp on one nightstand
      const lampShadeMat = makePS2Material({
        color:       0xffc880,
        emissive:    0xffc880,
        emissiveAmt: 1.4,
      });
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), lampShadeMat);
      lamp.position.set(bdCx - 2.2, bdY + 0.95, bdCz - 1.9);
      scene.add(lamp);

      // Dresser opposite the bed
      const dresser = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.0, 0.7), nsMat);
      dresser.position.set(bdCx, bdY + 0.50, bdCz + 2.5);
      scene.add(dresser);
    }

    // ----- BILLIARD / BAR ROOM (east wing ground floor) -----
    {
      const brCx = eastWingCx;    // 11.5
      const brCz = villaCz;       // -10
      const brY  = podiumTopY;    // 0.82

      // Pool table — green felt top, dark wood frame
      const feltMat = makePS2Material({ color: 0x186030 });
      const tableFrameMat = makePS2Material({ color: 0x3a1f0e });
      const tableFrame = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.18, 2.4), tableFrameMat);
      tableFrame.position.set(brCx, brY + 0.85, brCz - 1.5);
      scene.add(tableFrame);
      const felt = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.06, 2.0), feltMat);
      felt.position.set(brCx, brY + 0.97, brCz - 1.5);
      scene.add(felt);
      felt.name = 'pool_table';
      // 4 table legs
      [[-1.9, -1.0], [1.9, -1.0], [-1.9, 1.0], [1.9, 1.0]].forEach(([dx, dz]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), tableFrameMat);
        leg.position.set(brCx + dx, brY + 0.42, brCz - 1.5 + dz);
        scene.add(leg);
      });
      // Cue ball + a couple of colored balls (small white/red boxes)
      const ballWhiteMat = makePS2Material({ color: 0xffffff });
      const ballRedMat = makePS2Material({ color: 0xd03020 });
      const ball1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), ballWhiteMat);
      ball1.position.set(brCx - 0.8, brY + 1.04, brCz - 1.5);
      scene.add(ball1);
      const ball2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), ballRedMat);
      ball2.position.set(brCx + 0.4, brY + 1.04, brCz - 1.4);
      scene.add(ball2);

      // Bar counter along the back wall of the wing
      const barMat = makePS2Material({ color: 0x4a2818 });
      const barCounter = new THREE.Mesh(new THREE.BoxGeometry(6.0, 1.1, 0.9), barMat);
      barCounter.position.set(brCx, brY + 0.55, brCz + 5.0);
      scene.add(barCounter);
      barCounter.name = 'bar_counter';
      // Bar top (slightly wider)
      const barTopMat = makePS2Material({ color: 0x2a1808 });
      const barTop = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.10, 1.0), barTopMat);
      barTop.position.set(brCx, brY + 1.15, brCz + 5.0);
      scene.add(barTop);
      // 3 bottles on the bar — emissive for that liquor-shelf glow
      const bottleColors = [0xc04060, 0xffaa30, 0x40d0a0];
      bottleColors.forEach((c, i) => {
        const m = makePS2Material({
          color:       c,
          emissive:    c,
          emissiveAmt: 0.9,
        });
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.55, 6), m);
        bottle.position.set(brCx - 1.0 + i * 1.0, brY + 1.45, brCz + 5.0);
        scene.add(bottle);
      });
      // 3 bar stools facing the bar
      const stoolMat = makePS2Material({ color: 0x101010 });
      [-1.4, 0, 1.4].forEach(dx => {
        const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.10, 8), stoolMat);
        stoolSeat.position.set(brCx + dx, brY + 0.85, brCz + 4.0);
        scene.add(stoolSeat);
        const stoolPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.85, 5), stoolMat);
        stoolPole.position.set(brCx + dx, brY + 0.42, brCz + 4.0);
        scene.add(stoolPole);
      });

      // Neon bar sign on the wall above the counter
      const neonMat = makePS2Material({
        color:       0xff40a0,
        emissive:    0xff40a0,
        emissiveAmt: 2.4,
      });
      const neon = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 0.08), neonMat);
      neon.position.set(brCx, brY + 2.4, brCz + 5.5);
      scene.add(neon);
    }

    // -----------------------------------------------------
    // Lagoon — small secondary water with sand, island, mini palm
    // -----------------------------------------------------
    {
      // b013 — moved further left + forward to clear the much bigger villa
      // (lower volume now spans x=-16..16, z=-19..-1)
      const lagoonCx = -22;
      const lagoonCz = 4;

      // Sand ring (warm tan, slightly raised)
      const sandMat = makePS2Material({ color: 0xc0a878 });
      const sand = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.05, 3.8), sandMat);
      sand.position.set(lagoonCx, 0.025, lagoonCz);
      scene.add(sand);

      // Lagoon water — reuse the pool water shader for tile/caustic look
      const lagoonWater = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 2.6, 8, 1, 8), poolMat);
      lagoonWater.position.set(lagoonCx, 0.10, lagoonCz);
      scene.add(lagoonWater);

      // Island in the middle of the lagoon
      const island = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.18, 0.85), sandMat);
      island.position.set(lagoonCx, 0.13, lagoonCz);
      scene.add(island);

      // Mini palm on the island (smaller than the regular palms)
      const miniHeight = 2.6;
      const miniTrunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.13, miniHeight, 5),
        trunkMat
      );
      miniTrunk.position.set(lagoonCx, 0.22 + miniHeight / 2, lagoonCz);
      scene.add(miniTrunk);
      const miniFronds = 7;
      for (let i = 0; i < miniFronds; i++) {
        const a = (i / miniFronds) * Math.PI * 2;
        const f = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.3, 1, 1), frondMat);
        f.position.set(
          lagoonCx + Math.cos(a) * 0.62,
          0.22 + miniHeight - 0.05,
          lagoonCz + Math.sin(a) * 0.62
        );
        f.rotation.y = -a;
        f.rotation.z = -0.7;
        scene.add(f);
      }
    }

    // -----------------------------------------------------
    // Boulders — round low-poly rocks, replace hedges/bushes
    // (b010 — landscape match for the Mykonos reference photos)
    // -----------------------------------------------------
    const boulderMat = makePS2Material({ color: 0x6a6560 });

    function addBoulder(x, z, size) {
      const b = new THREE.Mesh(
        new THREE.IcosahedronGeometry(size, 0),
        boulderMat
      );
      b.position.set(x, size * 0.6, z);
      // Random-ish rotation per position so they don't all look identical
      b.rotation.set(x * 0.13, z * 0.21, x * 0.07 + z * 0.05);
      scene.add(b);
    }

    // Cluster between pool back (z=2) and villa front (z=-1)
    addBoulder(-7.5, 0.5, 0.55);
    addBoulder(-3.5, 0.7, 0.42);
    addBoulder( 0.0, 0.5, 0.50);
    addBoulder( 3.5, 0.7, 0.45);
    addBoulder( 7.5, 0.5, 0.55);
    // Outboard, beside the pool (x outside pool x range -11..11)
    addBoulder(-13.0, 5.0, 0.60);
    addBoulder( 13.0, 5.0, 0.55);
    // Scattered along the villa front corners
    addBoulder(-19.0, 1.5, 0.70);
    addBoulder( 19.0, 1.5, 0.65);
    addBoulder(-19.0, 9.0, 0.50);
    addBoulder( 19.0, 9.0, 0.55);

    // -----------------------------------------------------
    // Pool deck daybeds — wood base + white cushion + pillow
    // (b010 — replaces the photo's signature pool-side furniture)
    // -----------------------------------------------------
    const daybedWoodMat = makePS2Material({ color: 0x6b4a30 });  // warm wood
    const daybedCushionMat = makePS2Material({ color: 0xf0ece0 }); // cream cushion
    const daybedPillowMat = makePS2Material({ color: 0xe8e2d0 });  // slightly darker pillow

    function addDaybed(x, z, rotY) {
      const g = new THREE.Group();
      // Wood base
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 1.2), daybedWoodMat);
      base.position.y = 0.20;
      g.add(base);
      // White cushion on top
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 1.0), daybedCushionMat);
      cushion.position.y = 0.49;
      g.add(cushion);
      // Pillow at one end
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.85), daybedPillowMat);
      pillow.position.set(-0.65, 0.65, 0);
      g.add(pillow);
      g.position.set(x, 0.20, z);  // b035 — deck top
      g.rotation.y = rotY;
      scene.add(g);
    }

    // b014 — daybeds pushed forward to clear the new bigger pool (z range 2-8)
    // Lanterns now at z=9.5, daybeds at z=10.8 (slotted between the lanterns)
    addDaybed(-6.0, 10.8, 0);
    addDaybed( 0.0, 10.8, 0);
    addDaybed( 6.0, 10.8, 0);

    // -----------------------------------------------------
    // Colored path lights — small accent bulbs + ground spot puddle
    // -----------------------------------------------------
    function makeGroundSpotMat(colorHex) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(colorHex) } },
        transparent: true,
        depthWrite: false,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            vec2 c = vUv - 0.5;
            float d = length(c) * 2.0;
            float a = smoothstep(1.0, 0.0, d);
            gl_FragColor = vec4(uColor * 1.6, a * 0.55);
          }
        `,
      });
      materials.push(mat);
      return mat;
    }

    // b035 — baseY so deck-area path lights sit on deck top (0.20)
    function addPathLight(x, z, colorHex, baseY = 0.20) {
      const poleMat = makePS2Material({ color: 0x080808 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 4), poleMat);
      pole.position.set(x, baseY + 0.275, z);
      scene.add(pole);

      const bulbMat = makePS2Material({
        color:       colorHex,
        emissive:    colorHex,
        emissiveAmt: 2.4,
      });
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.20, 0.22), bulbMat);
      bulb.position.set(x, baseY + 0.62, z);
      scene.add(bulb);

      // Ground spot puddle — circular emissive disc, lifted above the
      // deck top so it doesn't z-fight the deck surface.
      const spot = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), makeGroundSpotMat(colorHex));
      spot.rotation.x = -Math.PI / 2;
      spot.position.set(x, baseY + 0.02, z);
      spot.renderOrder = 1;
      scene.add(spot);
    }

    // b014 — repositioned for the bigger pool (x:-11..11, z:2..8) and the
    // street-side back. No more pool-side path lights inside the new pool;
    // no more beach-approach lights since the back beach is gone.
    // Around the pool deck — outboard of the new wider pool
    addPathLight(-13, 12.5, 0x00d4ff); // cyan, front-left, past daybeds
    addPathLight( 13, 12.5, 0xa44fff); // purple, front-right, past daybeds
    // Right side of property (outboard of villa right wall, between villa and driveway)
    addPathLight(24,   3.0, 0x00d4ff);
    addPathLight(24,  -8.0, 0xff2d95);
    // Left side of property (outboard of villa left wall, on the front beach side)
    addPathLight(-24,   3.0, 0x00d4ff);
    addPathLight(-24,  -8.0, 0xff2d95);

    // -----------------------------------------------------
    // Ocean — far plane beyond the property
    // -----------------------------------------------------
    const oceanMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:       { value: 0 },
        uColor:      { value: new THREE.Color(0x2a0a55) },
        uHighlight:  { value: new THREE.Color(0xc04098) },
        uFogColor:   { value: new THREE.Color(0x6a1850) },
        uFogDensity:{ value: 0.0055 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vFogDepth;
        void main() {
          vUv = uv;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vFogDepth = -mvPos.z;
          vec4 clip = projectionMatrix * mvPos;
          vec2 grid = vec2(320.0, 180.0);
          vec3 ndc = clip.xyz / clip.w;
          ndc.xy = floor(ndc.xy * grid + 0.5) / grid;
          clip.xyz = ndc * clip.w;
          gl_Position = clip;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform vec3 uHighlight;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        varying vec2 vUv;
        varying float vFogDepth;
        void main() {
          float r1 = sin(vUv.x * 60.0 + uTime * 1.2) * 0.5 + 0.5;
          float r2 = sin(vUv.y * 35.0 - uTime * 0.7) * 0.5 + 0.5;
          float ripple = r1 * r2;
          vec3 col = mix(uColor, uHighlight, ripple * 0.45);
          float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
          col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    materials.push(oceanMat);
    timeUniforms.push(oceanMat.uniforms.uTime);

    // b029 — 360° BEACH + OCEAN WRAP. The villa now sits on a private
    // beach island. Sand wraps the property on all 4 sides, ocean wraps
    // the sand on all 4 sides. No more "front beach" / "back street"
    // distinction — every direction is the same paradise.
    const beachMat = makePS2Material({ color: 0xe8d090 });  // warmer sun-bleached sand

    // Big sand plane — covers ~200×200 around the villa, eats the old
    // ground plane visually. The existing ground plane underneath stays
    // for the deck immediately around the pool/house.
    // b035 — beach is now a thick BoxGeometry (top y=0.00, bottom y=-1.20)
    // so its sides hide the gap down to the lowered ocean and there's no
    // coplanar plane fighting the deck above.
    const beach = new THREE.Mesh(
      new THREE.BoxGeometry(200, 1.20, 200),
      beachMat
    );
    beach.position.set(0, -0.60, -10);  // top y = 0.00
    scene.add(beach);

    // Ocean — big plane far below the beach so it never z-fights with sand.
    // The beach box's sides hide the air gap from the camera at all angles.
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 50, 50), oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, -1.50, -10);
    scene.add(ocean);

    // -----------------------------------------------------
    // Beach chairs + umbrellas on the sand
    // -----------------------------------------------------
    const chairMat = makePS2Material({ color: 0xe0d8b8 });
    const chairLegMat = makePS2Material({ color: 0x4a3a2a });

    function addBeachChair(x, z, rotY) {
      const g = new THREE.Group();
      // Seat
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 1.8), chairMat);
      seat.position.y = 0.35;
      g.add(seat);
      // Tilted backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.9), chairMat);
      back.position.set(0, 0.62, 0.75);
      back.rotation.x = -0.45;
      g.add(back);
      // 4 legs
      const legPositions = [[-0.3, -0.85], [0.3, -0.85], [-0.3, 0.85], [0.3, 0.85]];
      legPositions.forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.06), chairLegMat);
        leg.position.set(lx, 0.16, lz);
        g.add(leg);
      });
      g.position.set(x, 0.00, z);  // b035 — beach top
      g.rotation.y = rotY;
      scene.add(g);
    }

    function addBeachUmbrella(x, z, colorHex) {
      const poleMat = makePS2Material({ color: 0x1a1a1a });
      const canopyMat = makePS2Material({
        color:       colorHex,
        emissive:    colorHex,
        emissiveAmt: 0.4,
      });
      // Pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5), poleMat);
      pole.position.set(x, 1.25, z);
      scene.add(pole);
      // Canopy — wide flat octagonal-ish shape via two crossed boxes
      const canopy1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 1.4), canopyMat);
      canopy1.position.set(x, 2.4, z);
      scene.add(canopy1);
      const canopy2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 2.4), canopyMat);
      canopy2.position.set(x, 2.42, z);
      scene.add(canopy2);
    }

    // b014 — moved to the FRONT beach (no more back beach in this build)
    // 2 lounger setups flanking the property + a couple of solo chairs
    addBeachUmbrella(-22, 32, 0xff5fa0);
    addBeachChair  (-23, 34, 0.1);
    addBeachChair  (-21, 34, -0.1);

    addBeachUmbrella( 22, 32, 0xffa040);
    addBeachChair  ( 23, 34, 0.1);
    addBeachChair  ( 21, 34, -0.1);

    // Solo chairs further out toward the shore
    addBeachChair  (-12, 40,  0.0);
    addBeachChair  ( 12, 40,  0.0);

    // b029 — addNeighborVilla helper REMOVED with the rest of the street
    // side. No more cross-street mansions in the WORLD rebuild.

    // -----------------------------------------------------
    // b029 — STREET SIDE REMOVED. No more road, sidewalks, streetlamps,
    // dashed center line, cross-street neighbor villas, hills, hill villas,
    // backyard grass plane, or boulevard palms. The villa is now on a
    // private beach island; the back side faces beach and ocean instead
    // of urban Miami. Beach + scattered organic palms below.
    // -----------------------------------------------------

    // b029 — scattered organic palms on the beach side, replacing the
    // boulevard rows. Random-ish positions, avoiding the deck area.
    addPalm(-26, -38, 6.2);
    addPalm( -8, -42, 5.8);
    addPalm( 14, -40, 6.4);
    addPalm( 30, -36, 5.6);
    addPalm(-44, -22, 5.4);
    addPalm( 44, -24, 5.8);
    addPalm(-38,  44, 5.4);
    addPalm( 38,  46, 5.8);
    addPalm(-58, -10, 5.2);
    addPalm( 58, -12, 5.4);

    // -----------------------------------------------------
    // b022 — Beach + grounds scenery batch
    // Yachts, jet skis, pier, tiki bar w/ surfboards, fire pit,
    // BBQ bar, garden statues. All exterior, all named groups so
    // the click→card system can wire them up later.
    // -----------------------------------------------------

    // ----- Yachts on the front ocean -----
    function addYacht(x, z, scale, rotY) {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(8 * scale, 1.2 * scale, 2.6 * scale), villaMat);
      hull.position.y = 0.6 * scale;
      g.add(hull);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(4.5 * scale, 1.0 * scale, 2.0 * scale), villaMat);
      deck.position.set(-0.4 * scale, 1.7 * scale, 0);
      g.add(deck);
      const win = new THREE.Mesh(new THREE.BoxGeometry(4.0 * scale, 0.4 * scale, 2.05 * scale), windowMat);
      win.position.set(-0.4 * scale, 1.65 * scale, 0);
      g.add(win);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(2.4 * scale, 0.8 * scale, 1.6 * scale), villaMat);
      bridge.position.set(0.2 * scale, 2.6 * scale, 0);
      g.add(bridge);
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.12 * scale, 1.8 * scale, 0.12 * scale), railMat);
      mast.position.set(-1.6 * scale, 3.5 * scale, 0);
      g.add(mast);
      g.position.set(x, 0.5, z);
      g.rotation.y = rotY;
      g.name = 'yacht';
      scene.add(g);
    }
    addYacht(-18, 62, 1.0,   0.30);
    addYacht( 25, 78, 1.15, -0.40);
    addYacht(-40, 92, 0.85,  0.15);

    // ----- Jet skis closer to shore -----
    function addJetSki(x, z, rotY, accentMat) {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.95), villaMat);
      hull.position.y = 0.5;
      g.add(hull);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.28, 0.7), accentMat);
      seat.position.set(0.0, 0.86, 0);
      g.add(seat);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.42, 0.7), railMat);
      handle.position.set(0.85, 1.0, 0);
      g.add(handle);
      g.position.set(x, 0.0, z);
      g.rotation.y = rotY;
      g.name = 'jetski';
      scene.add(g);
    }
    addJetSki( -6, 50,  0.50, lanternGlowMat);
    addJetSki( 18, 54, -0.60, ledMat);
    addJetSki(-22, 58,  0.20, lanternGlowMat);

    // ----- Pier from beach into ocean (east of center, clears beach chairs at x=12) -----
    function addPier(x, zNear, zFar, w) {
      const length = zFar - zNear;
      const cz = (zNear + zFar) / 2;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, length), woodSlatMat);
      deck.position.set(x, 0.65, cz);
      deck.name = 'pierDeck';
      scene.add(deck);
      // Pilings under the deck
      const pileCount = Math.floor(length / 4);
      for (let i = 0; i <= pileCount; i++) {
        const pz = zNear + (i / pileCount) * length;
        for (const xs of [-1, 1]) {
          const piling = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.3), woodSlatMat);
          piling.position.set(x + xs * (w / 2 - 0.2), 0.0, pz);
          scene.add(piling);
        }
      }
      // Posts + top rail
      const postCount = Math.floor(length / 2.5);
      for (let i = 0; i <= postCount; i++) {
        const pz = zNear + (i / postCount) * length;
        for (const xs of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), railMat);
          post.position.set(x + xs * (w / 2 - 0.1), 1.15, pz);
          scene.add(post);
        }
      }
      for (const xs of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, length), railMat);
        rail.position.set(x + xs * (w / 2 - 0.1), 1.45, cz);
        scene.add(rail);
      }
      // End-of-pier warm lantern
      const tipLight = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), lanternGlowMat);
      tipLight.position.set(x, 1.7, zFar - 0.5);
      scene.add(tipLight);
    }
    addPier(8, 30, 66, 3.0);

    // ----- Tiki bar + surfboards (far west on the beach, away from villa) -----
    const tikiX = -34, tikiZ = 36;
    function addTikiBar(cx, cz) {
      const g = new THREE.Group();
      // 4 corner posts
      for (const dx of [-1.8, 1.8]) {
        for (const dz of [-1.8, 1.8]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 3.6, 0.32), woodSlatMat);
          post.position.set(dx, 1.8, dz);
          g.add(post);
        }
      }
      // Two stacked thatched roof slabs
      const roof1 = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.4, 5.4), daybedWoodMat);
      roof1.position.set(0, 3.8, 0);
      g.add(roof1);
      const roof2 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 4.2), daybedWoodMat);
      roof2.position.set(0, 4.15, 0);
      g.add(roof2);
      // Bar counter (front face) + lighter top slab
      const counter = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.0, 0.8), woodSlatMat);
      counter.position.set(0, 0.5, -1.6);
      g.add(counter);
      const counterTop = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.08, 0.85), rimMat);
      counterTop.position.set(0, 1.04, -1.6);
      g.add(counterTop);
      // Warm under-roof glow
      const glow = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 3.2), windowMat);
      glow.position.set(0, 3.50, 0);
      g.add(glow);
      // 3 stools at the bar
      for (const dx of [-1.2, 0, 1.2]) {
        const stool = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), railMat);
        stool.position.set(dx, 0.45, -2.4);
        g.add(stool);
      }
      g.position.set(cx, 0, cz);
      g.name = 'tikibar';
      scene.add(g);
    }
    addTikiBar(tikiX, tikiZ);
    // Palms flanking the tiki bar
    addPalm(tikiX - 4.5, tikiZ + 0.5, 6.4);
    addPalm(tikiX + 4.5, tikiZ - 0.5, 6.0);

    // Surfboards leaning against the tiki bar (3 colors)
    function addSurfboard(x, z, rotY, colorMat) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.6, 0.1), colorMat);
      board.position.set(x, 1.2, z);
      board.rotation.y = rotY;
      board.rotation.z = -0.32;
      board.name = 'surfboard';
      scene.add(board);
    }
    addSurfboard(tikiX - 2.4, tikiZ + 2.0,  0.30, villaMat);
    addSurfboard(tikiX - 1.9, tikiZ + 2.0, -0.50, lanternGlowMat);
    addSurfboard(tikiX + 2.4, tikiZ + 2.0,  0.70, ledMat);

    // ----- Fire pit + outdoor seating circle (west of pool deck) -----
    function addFirePit(cx, cz) {
      const g = new THREE.Group();
      // Stone ring
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.55, 0.5, 12), stoneMat);
      ring.position.set(0, 0.25, 0);
      g.add(ring);
      // Inner glow disc
      const fireGlow = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.42, 10), lanternGlowMat);
      fireGlow.position.set(0, 0.45, 0);
      g.add(fireGlow);
      // 3 small log boxes
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const log = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.16), woodSlatMat);
        log.position.set(Math.cos(a) * 0.35, 0.55, Math.sin(a) * 0.35);
        log.rotation.y = a;
        g.add(log);
      }
      g.position.set(cx, 0, cz);
      g.name = 'firepit';
      scene.add(g);
      // 5 chair stubs around the pit
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        const sx = cx + Math.cos(a) * 3.2;
        const sz = cz + Math.sin(a) * 3.2;
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.45, 0.95), daybedWoodMat);
        seat.position.set(sx, 0.225, sz);
        seat.rotation.y = -a;
        scene.add(seat);
        const cush = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.18, 0.85), daybedCushionMat);
        cush.position.set(sx, 0.55, sz);
        cush.rotation.y = -a;
        scene.add(cush);
      }
    }
    addFirePit(-22, 18);

    // ----- Outdoor BBQ / bar near the pool (east of jacuzzi) -----
    function addBBQBar(cx, cz) {
      const g = new THREE.Group();
      // L-shaped counter
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.0, 0.8), stoneMat);
      c1.position.set(0, 0.5, 0);
      g.add(c1);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 2.0), stoneMat);
      c2.position.set(1.1, 0.5, 1.0);
      g.add(c2);
      // Lighter counter tops
      const top1 = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.08, 0.85), rimMat);
      top1.position.set(0, 1.04, 0);
      g.add(top1);
      const top2 = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 2.05), rimMat);
      top2.position.set(1.1, 1.04, 1.0);
      g.add(top2);
      // Grill body + heat strip
      const grill = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.6), railMat);
      grill.position.set(-0.5, 1.25, 0);
      g.add(grill);
      const heat = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.5), lanternGlowMat);
      heat.position.set(-0.5, 1.43, 0);
      g.add(heat);
      // Bottles on the counter (warm-glow stand-ins)
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), windowMat);
        b.position.set(0.8 + i * 0.3, 1.34, -0.2);
        g.add(b);
      }
      g.position.set(cx, 0, cz);
      g.name = 'bbqbar';
      scene.add(g);
    }
    addBBQBar(17, 9);

    // ----- Garden statues (3 — front lawn between deck and beach) -----
    function addStatue(cx, cz, type) {
      const g = new THREE.Group();
      if (type === 'obelisk') {
        const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.2), stoneMat);
        base.position.y = 0.2;
        g.add(base);
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.0, 0.7), stoneMat);
        shaft.position.y = 2.4;
        g.add(shaft);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.5, 0.8, 4), stoneMat);
        cap.position.y = 4.8;
        cap.rotation.y = Math.PI / 4;
        g.add(cap);
      } else if (type === 'sphere') {
        const ped = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.6, 1.0), stoneMat);
        ped.position.y = 0.8;
        g.add(ped);
        const sph = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), rimMat);
        sph.position.y = 2.3;
        g.add(sph);
      } else if (type === 'abstract') {
        for (let i = 0; i < 4; i++) {
          const sz = 0.95 - i * 0.13;
          const b = new THREE.Mesh(new THREE.BoxGeometry(sz, sz, sz), stoneMat);
          b.position.y = 0.5 + i * 0.85;
          b.rotation.y = i * 0.7;
          g.add(b);
        }
      }
      g.position.set(cx, 0, cz);
      g.name = 'statue_' + type;
      scene.add(g);
    }
    addStatue( 26, 22, 'obelisk');
    addStatue(-28, 24, 'sphere');
    addStatue(  0, 26, 'abstract');

    // -----------------------------------------------------
    // b023 — Two flanking lots either side of the villa
    // West: formal garden (hedges + fountain + topiary + paths)
    // East: glass-walled supercar showroom with 3 cars on display
    // -----------------------------------------------------

    // ----- West lot: LUXURY GARDEN (b024 rewrite) -----
    // b023's garden was a tiny checkered terrace with floating cubes. v2 is
    // a proper exorbitant-wealth Miami villa garden: bright lawn plane,
    // marble cross paths, 3-tier marble fountain, taller manicured hedge
    // perimeter, 30+ varied plants (topiary cones/spheres/spirals,
    // bougainvillea, rose bushes, lavender), 2 marble corner statues, 2
    // benches, 2 pergola archways with bougainvillea drape, 6 pathway
    // lanterns, 8 marble urn planters. Density > size. ~85 meshes.
    function addGarden(cx, cz) {
      // b034 — gw 22→30, gd 18→24 (footprint expansion)
      const gw = 30, gd = 24;
      const halfW = gw / 2, halfD = gd / 2;

      // ----- 1. Bright lawn plane (the actual grass, finally) -----
      // b035 — lawn raised to y=0.10 (above the new beach top at 0.00,
      // but below the deck top at 0.20). Path thickness (0.08) sits above.
      const lawn = new THREE.Mesh(new THREE.BoxGeometry(gw, 0.08, gd), lawnMat);
      lawn.position.set(cx, 0.06, cz);
      scene.add(lawn);

      // ----- 2. Manicured hedge perimeter (taller + brighter) -----
      const hedgeH = 1.4, hedgeT = 0.6;
      const hF = new THREE.Mesh(new THREE.BoxGeometry(gw, hedgeH, hedgeT), shrubMat);
      hF.position.set(cx, hedgeH / 2, cz + halfD);
      scene.add(hF);
      const hB = new THREE.Mesh(new THREE.BoxGeometry(gw, hedgeH, hedgeT), shrubMat);
      hB.position.set(cx, hedgeH / 2, cz - halfD);
      scene.add(hB);
      const hL = new THREE.Mesh(new THREE.BoxGeometry(hedgeT, hedgeH, gd), shrubMat);
      hL.position.set(cx - halfW, hedgeH / 2, cz);
      scene.add(hL);
      const hR = new THREE.Mesh(new THREE.BoxGeometry(hedgeT, hedgeH, gd), shrubMat);
      hR.position.set(cx + halfW, hedgeH / 2, cz);
      scene.add(hR);

      // ----- 3. Marble cross paths -----
      const pathW = 2.6;
      const pathLong = new THREE.Mesh(new THREE.BoxGeometry(pathW, 0.08, gd - 0.6), marbleMat);
      pathLong.position.set(cx, 0.18, cz);  // b035 — above lawn top (0.10)
      scene.add(pathLong);
      const pathCross = new THREE.Mesh(new THREE.BoxGeometry(gw - 0.6, 0.08, pathW), marbleMat);
      pathCross.position.set(cx, 0.18, cz);
      scene.add(pathCross);

      // ----- 4. 3-tier ornate marble fountain (the centerpiece) -----
      // Lower basin (b026 — named as the click→card target for the fountain)
      const basin1 = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.5, 0.55, 20), marbleMat);
      basin1.position.set(cx, 0.275, cz);
      basin1.name = 'fountain';
      scene.add(basin1);
      const water1 = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.10, 20), poolMat);
      water1.position.set(cx, 0.56, cz);
      scene.add(water1);
      // Middle column
      const col1 = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.9, 12), marbleMat);
      col1.position.set(cx, 1.05, cz);
      scene.add(col1);
      // Middle basin
      const basin2 = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.4, 16), marbleMat);
      basin2.position.set(cx, 1.65, cz);
      scene.add(basin2);
      const water2 = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.08, 16), poolMat);
      water2.position.set(cx, 1.88, cz);
      scene.add(water2);
      // Upper column
      const col2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.7, 10), marbleMat);
      col2.position.set(cx, 2.20, cz);
      scene.add(col2);
      // Top tier (small)
      const basin3 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.3, 12), marbleMat);
      basin3.position.set(cx, 2.70, cz);
      scene.add(basin3);
      // Crowning sphere
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), marbleMat);
      crown.position.set(cx, 3.15, cz);
      scene.add(crown);

      // ----- 5. Plant helpers (used inside this garden + future scenery) -----
      function addTopiaryCone(px, pz, h) {
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.7, h, 8), topiaryMat);
        cone.position.set(px, h / 2, pz);
        scene.add(cone);
      }
      function addTopiarySphere(px, pz, r) {
        const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), topiaryMat);
        ball.position.set(px, r + 0.2, pz);
        scene.add(ball);
        // Tiny stone base
        const base = new THREE.Mesh(new THREE.BoxGeometry(r * 1.4, 0.2, r * 1.4), marbleMat);
        base.position.set(px, 0.1, pz);
        scene.add(base);
      }
      function addTopiarySpiral(px, pz) {
        // 3 stacked spheres tapering up
        const sizes = [0.55, 0.42, 0.30];
        let y = 0.4;
        for (const s of sizes) {
          const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), topiaryMat);
          ball.position.set(px, y + s, pz);
          scene.add(ball);
          y += s * 1.7;
        }
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.9), marbleMat);
        base.position.set(px, 0.125, pz);
        scene.add(base);
      }
      function addBougainvillea(px, pz, scale) {
        // Green base + magenta bloom cluster on top (icosahedron)
        const greenBase = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 * scale, 1), shrubMat);
        greenBase.position.set(px, 0.55 * scale, pz);
        scene.add(greenBase);
        // Bloom cluster — 3 magenta spheres of varied size
        const blooms = [
          { dx: 0,    dy: 0.8 * scale, dz: 0,    r: 0.55 * scale },
          { dx: 0.4 * scale,  dy: 0.6 * scale, dz: 0.2 * scale,  r: 0.40 * scale },
          { dx: -0.3 * scale, dy: 0.7 * scale, dz: -0.3 * scale, r: 0.42 * scale },
        ];
        for (const b of blooms) {
          const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(b.r, 1), bougainvilleaMat);
          bloom.position.set(px + b.dx, 0.55 * scale + b.dy, pz + b.dz);
          scene.add(bloom);
        }
      }
      function addRoseBush(px, pz) {
        // Small green base + 5 tiny red bloom boxes
        const base = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), shrubMat);
        base.position.set(px, 0.45, pz);
        scene.add(base);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const r = 0.35;
          const bloom = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), roseMat);
          bloom.position.set(px + Math.cos(a) * r, 0.7, pz + Math.sin(a) * r);
          scene.add(bloom);
        }
      }
      function addLavenderClump(px, pz) {
        // 5 tall thin purple stalks clustered
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const r = 0.22;
          const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), lavenderMat);
          stalk.position.set(px + Math.cos(a) * r, 0.35, pz + Math.sin(a) * r);
          scene.add(stalk);
        }
        // Flower top blob
        const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), lavenderMat);
        top.position.set(px, 0.85, pz);
        scene.add(top);
      }
      function addUrnPlanter(px, pz) {
        // Marble urn (tapered cylinder) + small topiary on top
        const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.30, 0.7, 10), marbleMat);
        urn.position.set(px, 0.35, pz);
        scene.add(urn);
        const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.50, 0.10, 10), marbleMat);
        lip.position.set(px, 0.75, pz);
        scene.add(lip);
        const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.40, 1), topiaryMat);
        ball.position.set(px, 1.10, pz);
        scene.add(ball);
      }

      // ----- 6. Topiary at the 4 corners (cones, taller) -----
      addTopiaryCone(cx - halfW + 1.8, cz - halfD + 1.8, 2.4);
      addTopiaryCone(cx + halfW - 1.8, cz - halfD + 1.8, 2.4);
      addTopiaryCone(cx - halfW + 1.8, cz + halfD - 1.8, 2.4);
      addTopiaryCone(cx + halfW - 1.8, cz + halfD - 1.8, 2.4);

      // ----- 7. More topiary cones lining the inner hedge edges -----
      addTopiaryCone(cx - halfW + 1.8, cz, 1.9);
      addTopiaryCone(cx + halfW - 1.8, cz, 1.9);
      addTopiaryCone(cx, cz - halfD + 1.8, 1.9);
      addTopiaryCone(cx, cz + halfD - 1.8, 1.9);

      // ----- 8. Topiary spheres flanking the fountain (4) -----
      addTopiarySphere(cx - 4.5, cz - 4.5, 0.6);
      addTopiarySphere(cx + 4.5, cz - 4.5, 0.6);
      addTopiarySphere(cx - 4.5, cz + 4.5, 0.6);
      addTopiarySphere(cx + 4.5, cz + 4.5, 0.6);

      // ----- 9. Topiary spirals at the path corners -----
      addTopiarySpiral(cx - 2.0, cz - 2.0);
      addTopiarySpiral(cx + 2.0, cz - 2.0);
      addTopiarySpiral(cx - 2.0, cz + 2.0);
      addTopiarySpiral(cx + 2.0, cz + 2.0);

      // ----- 10. Bougainvillea bushes spilling over the hedges -----
      addBougainvillea(cx - halfW + 0.8, cz - halfD + 5.5, 1.1);
      addBougainvillea(cx - halfW + 0.8, cz + halfD - 5.5, 1.1);
      addBougainvillea(cx + halfW - 0.8, cz - halfD + 5.5, 1.1);
      addBougainvillea(cx + halfW - 0.8, cz + halfD - 5.5, 1.1);
      addBougainvillea(cx - 6.0, cz - halfD + 0.8, 0.9);
      addBougainvillea(cx + 6.0, cz - halfD + 0.8, 0.9);

      // ----- 11. Rose bushes scattered in the quadrants -----
      addRoseBush(cx - 6.5, cz - 2.5);
      addRoseBush(cx + 6.5, cz - 2.5);
      addRoseBush(cx - 6.5, cz + 2.5);
      addRoseBush(cx + 6.5, cz + 2.5);
      addRoseBush(cx - 3.2, cz - 6.8);
      addRoseBush(cx + 3.2, cz - 6.8);

      // ----- 12. Lavender clumps -----
      addLavenderClump(cx - 7.5, cz - 6.5);
      addLavenderClump(cx + 7.5, cz - 6.5);
      addLavenderClump(cx - 7.5, cz + 6.5);
      addLavenderClump(cx + 7.5, cz + 6.5);

      // ----- 13. Urn planters at hedge corners + path intersections -----
      addUrnPlanter(cx - halfW + 1.0, cz - halfD + 0.8);
      addUrnPlanter(cx + halfW - 1.0, cz - halfD + 0.8);
      addUrnPlanter(cx - halfW + 1.0, cz + halfD - 0.8);
      addUrnPlanter(cx + halfW - 1.0, cz + halfD - 0.8);
      addUrnPlanter(cx - 1.6, cz - halfD + 0.8);
      addUrnPlanter(cx + 1.6, cz - halfD + 0.8);
      addUrnPlanter(cx - 1.6, cz + halfD - 0.8);
      addUrnPlanter(cx + 1.6, cz + halfD - 0.8);

      // ----- 14. 2 marble corner statues -----
      // (small obelisk + sphere-on-pedestal flanking the fountain on the long axis)
      // Obelisk
      const oBase = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 1.0), marbleMat);
      oBase.position.set(cx - 7.5, 0.15, cz);
      scene.add(oBase);
      const oShaft = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.6, 0.55), marbleMat);
      oShaft.position.set(cx - 7.5, 1.6, cz);
      scene.add(oShaft);
      const oCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.4, 0.6, 4), marbleMat);
      oCap.position.set(cx - 7.5, 3.20, cz);
      oCap.rotation.y = Math.PI / 4;
      scene.add(oCap);
      // Sphere on pedestal
      const sPed = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.4, 0.85), marbleMat);
      sPed.position.set(cx + 7.5, 0.7, cz);
      scene.add(sPed);
      const sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), marbleMat);
      sphere.position.set(cx + 7.5, 2.0, cz);
      scene.add(sphere);

      // ----- 15. 2 marble benches flanking the fountain -----
      function addBench(px, pz, rotY) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 0.7), marbleMat);
        seat.position.set(px, 0.55, pz);
        seat.rotation.y = rotY;
        scene.add(seat);
        for (const dx of [-0.95, 0.95]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.7), marbleMat);
          const lx = px + dx * Math.cos(rotY);
          const lz = pz + dx * Math.sin(rotY);
          leg.position.set(lx, 0.25, lz);
          leg.rotation.y = rotY;
          scene.add(leg);
        }
        const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 0.12), marbleMat);
        const backOffsetX = -Math.sin(rotY) * 0.32;
        const backOffsetZ =  Math.cos(rotY) * 0.32;
        back.position.set(px + backOffsetX, 1.0, pz + backOffsetZ);
        back.rotation.y = rotY;
        scene.add(back);
      }
      addBench(cx, cz - 5.5, 0);
      addBench(cx, cz + 5.5, Math.PI);

      // ----- 16. 2 pergola archways at north + south path entrances -----
      function addPergola(px, pz) {
        // 4 marble posts forming a square
        for (const dx of [-1.4, 1.4]) {
          for (const dz of [-0.6, 0.6]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 3.0, 0.32), marbleMat);
            post.position.set(px + dx, 1.5, pz + dz);
            scene.add(post);
          }
        }
        // Top beams (long axis)
        for (const dz of [-0.6, 0.6]) {
          const beam = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 0.18), marbleMat);
          beam.position.set(px, 3.0, pz + dz);
          scene.add(beam);
        }
        // Cross slats (5 across)
        for (let i = 0; i < 5; i++) {
          const lx = px - 1.2 + i * 0.6;
          const slat = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.12, 1.5), marbleMat);
          slat.position.set(lx, 3.10, pz);
          scene.add(slat);
        }
        // Bougainvillea draping over the top
        addBougainvillea(px - 1.0, pz, 0.85);
        addBougainvillea(px + 1.0, pz, 0.85);
        // Lift the bloom cluster onto the pergola top by drawing extra blooms
        for (const dx of [-1.0, 0.0, 1.0]) {
          const drape = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), bougainvilleaMat);
          drape.position.set(px + dx, 3.45, pz);
          scene.add(drape);
        }
      }
      addPergola(cx, cz - halfD);
      addPergola(cx, cz + halfD);

      // ----- 17. 6 pathway lanterns lining the marble paths -----
      // b035 — garden lawn top is ~0.10, pass that as baseY
      addDeckLantern(cx - 5.5, cz - 1.6, 0.10);
      addDeckLantern(cx - 5.5, cz + 1.6, 0.10);
      addDeckLantern(cx + 5.5, cz - 1.6, 0.10);
      addDeckLantern(cx + 5.5, cz + 1.6, 0.10);
      addDeckLantern(cx - 1.6, cz - 5.5, 0.10);
      addDeckLantern(cx + 1.6, cz - 5.5, 0.10);
    }
    addGarden(-32, 13);

    // ----- East lot: supercar showroom (b034 — enlarged + relocated NE) -----
    function addCarShowroom(cx, cz) {
      const sw = 28, sd = 16, sh = 5;
      // b035 — thick raised slab so the showroom reads as a stone podium on
      // the sand, and bottom sits well below beach top (0.00) — top y=0.20.
      const floor = new THREE.Mesh(new THREE.BoxGeometry(sw, 1.20, sd), rimMat);
      floor.position.set(cx, -0.40, cz);
      scene.add(floor);
      // Roof slab
      const roof = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.3, sd), villaMat);
      roof.position.set(cx, sh + 0.15, cz);
      scene.add(roof);
      // 4 corner posts
      for (const dx of [-sw / 2 + 0.2, sw / 2 - 0.2]) {
        for (const dz of [-sd / 2 + 0.2, sd / 2 - 0.2]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, sh, 0.45), villaMat);
          post.position.set(cx + dx, sh / 2, cz + dz);
          scene.add(post);
        }
      }
      // Glass back wall (faces away from camera, toward street side)
      const back = new THREE.Mesh(new THREE.BoxGeometry(sw - 0.5, sh - 0.6, 0.1), windowMat);
      back.position.set(cx, sh / 2 + 0.2, cz - sd / 2 + 0.05);
      scene.add(back);
      // Glass left wall
      const lw = new THREE.Mesh(new THREE.BoxGeometry(0.1, sh - 0.6, sd - 0.5), windowMat);
      lw.position.set(cx - sw / 2 + 0.05, sh / 2 + 0.2, cz);
      scene.add(lw);
      // Glass right wall
      const rw = new THREE.Mesh(new THREE.BoxGeometry(0.1, sh - 0.6, sd - 0.5), windowMat);
      rw.position.set(cx + sw / 2 - 0.05, sh / 2 + 0.2, cz);
      scene.add(rw);
      // LED accent strip along the front edge (open side)
      const ledFront = new THREE.Mesh(new THREE.BoxGeometry(sw - 0.4, 0.1, 0.12), ledMat);
      ledFront.position.set(cx, 0.22, cz + sd / 2 - 0.1);
      scene.add(ledFront);
      // LED strip along the floor centerline
      const ledMid = new THREE.Mesh(new THREE.BoxGeometry(sw - 0.6, 0.08, 0.1), ledMat);
      ledMid.position.set(cx, 0.21, cz);
      scene.add(ledMid);
      // b034 — 6 cars in 2 rows of 3, facing forward
      addCar(cx - 8.5, cz + 3.0, 0xff2050, 0);  // red
      addCar(cx,        cz + 3.0, 0x2080ff, 0);  // blue
      addCar(cx + 8.5, cz + 3.0, 0xffaa00, 0);  // orange
      addCar(cx - 8.5, cz - 2.5, 0x10ff80, 0);  // mint
      addCar(cx,        cz - 2.5, 0xff10c0, 0);  // hot pink
      addCar(cx + 8.5, cz - 2.5, 0xffffff, 0);  // pearl white
    }
    addCarShowroom(32, -28);

    // -----------------------------------------------------
    // b034 — LAGOON (west water) + LOOP ROAD + FOREST
    // West side of property: a private lagoon (water plane reusing the
    // ocean shader, sat above the beach sand). East side: a forested
    // grove with a circular driveway loop and a connector approach
    // road from the villa.
    // -----------------------------------------------------

    // ----- Lagoon — relocated to the pier/yacht area, custom ocean shader -----
    // b034c — moved from west (-78,0) to centered over the pier (x=8, z=30..66)
    // and yachts (z=62..92). Replaced poolMat (which read as a pool) with a
    // dedicated darker teal shader: rolling waves, no caustic grid, no top
    // boost. Sits at y=0.06 just above the beach so the pier deck
    // (y=0.65) and yacht hulls (y=0.5..) still float above it correctly.
    const lagoonMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:       { value: 0 },
        uBase:       { value: new THREE.Color(0x08323c) },
        uHi:         { value: new THREE.Color(0x3a92a8) },
        uFogColor:   { value: new THREE.Color(0x6a1850) },
        uFogDensity:{ value: 0.0055 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vFogDepth;
        void main() {
          vUv = uv;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vFogDepth = -mvPos.z;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uBase;
        uniform vec3 uHi;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        varying vec2 vUv;
        varying float vFogDepth;
        void main() {
          float w1 = sin(vUv.x * 22.0 + uTime * 0.6) * 0.5 + 0.5;
          float w2 = sin(vUv.y * 14.0 - uTime * 0.4) * 0.5 + 0.5;
          float w3 = sin((vUv.x + vUv.y) * 9.0 + uTime * 0.3) * 0.5 + 0.5;
          float wave = w1 * w2 * 0.55 + w3 * 0.18;
          vec3 col = mix(uBase, uHi, wave);
          col *= 1.35;
          float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
          col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    materials.push(lagoonMat);
    timeUniforms.push(lagoonMat.uniforms.uTime);

    // b035d — front edge pulled back to z=50 (was 32, too far inland). Pier
    // (z=30..66) still extends over water for the outer ~16 units. Beach
    // chairs at z=32..40 are now back on dry sand.
    const lagoon = new THREE.Mesh(
      new THREE.BoxGeometry(260, 0.40, 170),
      lagoonMat
    );
    lagoon.position.set(0, 0.10, 135);  // top y = 0.30, z range 50..220
    scene.add(lagoon);

    // ----- Loop driveway road (east, threaded through the forest) -----
    // b034b — single RingGeometry mesh for the loop instead of 16 tangent
    // boxes. One smooth ring, no polygon seams. Approach roads are still
    // short box segments since they're straight.
    const asphaltMat = makePS2Material({ color: 0x1a1a22 });
    const stripeMat  = makePS2Material({
      color:       0xfff080,
      emissive:    0xfff080,
      emissiveAmt: 0.6,
    });

    // b035 — road slab is THICKER (height 0.30) and sits with top at 0.15,
    // well above the beach top (0.00). Stripes lifted to 0.18 so the dashes
    // sit above the road surface without coplanar fight.
    function addRoadSegment(x, z, len, rotY) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.30, len), asphaltMat);
      seg.position.set(x, 0.00, z);  // top y = 0.15
      seg.rotation.y = rotY;
      scene.add(seg);
      for (let k = -1; k <= 1; k++) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, len * 0.18), stripeMat);
        const offset = k * len * 0.30;
        dash.position.set(
          x + Math.sin(rotY) * offset,
          0.18,
          z + Math.cos(rotY) * offset
        );
        dash.rotation.y = rotY;
        scene.add(dash);
      }
    }

    // b034c — Loop relocated. The +z side is owned by pool/pier/yachts/beach
    // chairs, so the driveway loop goes on the back side (-z) where the only
    // truly empty land is. Single straight road runs from the villa back wall
    // (z=-3) outward through the loop and into the dense jungle beyond.
    const ringCx = 0, ringCz = -58;
    // b035 — ring road raised to top y=0.16 (above new beach top 0.00).
    // RingGeometry stays a thin disk (no sides) but the y separation alone
    // is enough since nothing else overlaps it at this z.
    const ringRoad = new THREE.Mesh(
      new THREE.RingGeometry(13.0, 17.5, 64, 1),
      asphaltMat
    );
    ringRoad.rotation.x = -Math.PI / 2;
    ringRoad.position.set(ringCx, 0.16, ringCz);
    scene.add(ringRoad);
    const ringStripe = new THREE.Mesh(
      new THREE.RingGeometry(15.15, 15.35, 64, 1),
      stripeMat
    );
    ringStripe.rotation.x = -Math.PI / 2;
    ringStripe.position.set(ringCx, 0.20, ringCz);
    scene.add(ringStripe);

    // b035e — single road leading outward from the loop into the deep
    // jungle. No more villa→loop connector — the loop IS the driveway,
    // so the only road is the one heading away from the house.
    // b037b — pushed both segments further back so segment 1 starts AT the
    // loop's back outer edge (z = ringCz - 17.5 = -75.5) instead of inside
    // the donut hole. Previously segment 1 at z=-85 len=40 spanned z=-65
    // to z=-105, with the front 10 units protruding into the loop interior.
    addRoadSegment(0, -91.5, 32, 0);   // spans z=-75.5 to z=-107.5
    addRoadSegment(0, -117.5, 20, 0);  // spans z=-107.5 to z=-127.5

    // ----- Forest — pine cones + extra palms east + north -----
    // b034b — bigger trees + brighter emissive needles so they read at
    // distance against the dusk fog. Trees use a dedicated forestMat
    // (brighter than shrubMat which gets eaten by fog).
    const forestMat = makePS2Material({
      color:       0x4a8030,
      emissive:    0x4a8030,
      emissiveAmt: 0.30,
    });
    function addPineTree(x, z, h) {
      h *= 1.7;
      const trunkH = h * 0.30;
      const t = new THREE.Mesh(
        new THREE.CylinderGeometry(0.30, 0.45, trunkH, 5),
        trunkMat
      );
      t.position.set(x, trunkH / 2, z);
      scene.add(t);
      // 4 stacked tapering cones for fuller silhouette
      const cones = 4;
      for (let i = 0; i < cones; i++) {
        const baseR = 2.4 - i * 0.45;
        const ch    = h * 0.32;
        const cy    = trunkH + i * (h * 0.20) + ch / 2;
        const cone = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0, baseR, ch, 7),
          forestMat
        );
        cone.position.set(x, cy, z);
        scene.add(cone);
      }
    }

    // b034c — Far Cry 3 jungle: pack pines TIGHT around the loop + road,
    // not scattered to the horizon. Inner ring just outside the loop
    // (r≈19), road shoulder rows along x=±6.5, deep forest band beyond
    // the loop at z<-75. Avoid the garage footprint at (32, -28) ±13×7.
    const forestPines = [
      // Tight inner ring hugging the loop's outer edge (r ≈ 19..23)
      [ 22, -58, 5.4], [ 21, -52, 5.0], [ 21, -64, 5.2],
      [ 19, -44, 5.6], [ 19, -72, 5.4],
      [ 14, -38, 5.0], [ 14, -78, 5.2],
      [  6, -34, 5.4], [  6, -82, 5.6],
      [ -6, -34, 5.0], [ -6, -82, 5.4],
      [-14, -38, 5.6], [-14, -78, 5.0],
      [-19, -44, 5.2], [-19, -72, 5.6],
      [-21, -52, 5.4], [-21, -64, 5.0], [-22, -58, 5.6],
      // Second ring just outside the first, denser
      [ 26, -55, 4.8], [ 25, -47, 5.2], [ 25, -69, 5.0],
      [-26, -55, 5.4], [-25, -47, 5.0], [-25, -69, 5.2],
      [ 16, -32, 5.2], [-16, -32, 4.8],
      [ 16, -84, 5.0], [-16, -84, 5.4],
      // Road shoulder — rows of trees lining the villa→loop approach
      [  7, -10, 4.6], [ -7, -10, 5.0],
      [  7, -16, 5.2], [ -7, -16, 4.8],
      [  8, -24, 5.0], [ -8, -24, 5.4],
      // Past the loop — dense back jungle wall
      [ -4, -94, 5.6], [  4, -94, 5.4],
      [-12, -92, 5.2], [ 12, -92, 5.6],
      [-22, -90, 5.0], [ 22, -90, 5.0],
      [-32, -88, 5.4], [ 32, -88, 5.2],
      [-42, -84, 5.6], [ 42, -84, 5.0],
      [-52, -78, 5.0], [ 52, -78, 5.4],
      [-62, -70, 5.4], [ 62, -70, 5.2],
      // West/east edges of the jungle band, clearing villa east wing + garage
      [-36, -50, 5.0], [-44, -42, 5.4], [-52, -32, 5.0],
      [ 56, -55, 5.2], [ 64, -42, 5.6], [ 70, -30, 5.0],
      // Front-side forest pockets (away from pool/yacht zone), east of garage
      [ 70,  20, 5.4], [ 78,  40, 5.0], [ 60,   0, 5.2],
      // Front-side west pocket (away from pool deck and garden)
      [-70,  20, 5.4], [-78,  40, 5.0], [-60,   0, 5.2],
    ];
    forestPines.forEach(([x, z, h]) => addPineTree(x, z, h));

    // Mix in tall palms for variety inside the dense jungle
    addPalm(  9, -48, 6.0);
    addPalm( -9, -64, 5.8);
    addPalm( 11, -68, 6.2);
    addPalm(-11, -48, 5.6);
    addPalm( 18, -86, 6.0);
    addPalm(-18, -86, 5.8);
    addPalm(  0, -100, 6.4);
    addPalm( 32, -76, 5.8);
    addPalm(-32, -76, 6.0);

    // b029 — Distant Miami skyline REMOVED. The new WORLD vibe is private
    // beach island, no inland city visible on the horizon. Just open ocean
    // and sky in every direction.

    // -----------------------------------------------------
    // Low-res render target → fullscreen quad upscale
    // -----------------------------------------------------
    // b033 — explicit 24-bit DepthTexture. The default depthBuffer:true on
    // a WebGLRenderTarget gets a 16-bit DEPTH_COMPONENT16 renderbuffer on
    // many drivers, which combined with the low-res 854×480 grid produces
    // visible z-fighting on coplanar interior surfaces (rug/floor/walls).
    // UnsignedIntType + DEPTH_COMPONENT24 fixes it.
    const depthTex = new THREE.DepthTexture(LOW_W, LOW_H);
    depthTex.type = THREE.UnsignedIntType;
    lowResTarget = new THREE.WebGLRenderTarget(LOW_W, LOW_H, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      depthTexture: depthTex,
    });

    postScene = new THREE.Scene();
    postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: lowResTarget.texture },
        uTexel:   { value: new THREE.Vector2(1 / LOW_W, 1 / LOW_H) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uTexel;
        varying vec2 vUv;

        // b028 — 4x4 Bayer matrix dither. Adds the chunky banded gradient
        // look from PS1/Saturn era and helps the saturated colors hold their
        // hue at low brightness. Pattern matches the 854x480 framebuffer.
        float bayer4(vec2 p) {
          int x = int(mod(p.x, 4.0));
          int y = int(mod(p.y, 4.0));
          int i = x + y * 4;
          float v = 0.0;
          if (i == 0)  v =  0.0;
          if (i == 1)  v =  8.0;
          if (i == 2)  v =  2.0;
          if (i == 3)  v = 10.0;
          if (i == 4)  v = 12.0;
          if (i == 5)  v =  4.0;
          if (i == 6)  v = 14.0;
          if (i == 7)  v =  6.0;
          if (i == 8)  v =  3.0;
          if (i == 9)  v = 11.0;
          if (i == 10) v =  1.0;
          if (i == 11) v =  9.0;
          if (i == 12) v = 15.0;
          if (i == 13) v =  7.0;
          if (i == 14) v = 13.0;
          if (i == 15) v =  5.0;
          return v / 16.0 - 0.5;
        }

        // b036 — Cheap single-pass bloom. For each output pixel, sample 13
        // neighbors in a wide ring, threshold each one to keep only the
        // bright pixels (lanterns, pool, lambo emissives, fire pit), and
        // accumulate them as additive glow on top of the base color. Real
        // bloom would do a separable Gaussian blur chain into a half-res
        // target — this is the poor man's version that fits in one pass and
        // looks ~80% as good for our blocky low-res output.
        vec3 bloomSample(vec2 uv) {
          vec3 s = texture2D(tDiffuse, uv).rgb;
          // Threshold: only contribute the part above 0.75 luminance
          float lum = dot(s, vec3(0.299, 0.587, 0.114));
          float t = max(0.0, lum - 0.72);
          return s * t * 1.6;
        }

        void main() {
          vec4 c = texture2D(tDiffuse, vUv);

          // b036 — Bloom accumulation. 13 taps in two rings (inner + outer)
          // gives a soft halo without obvious sample patterns.
          vec3 bloom = vec3(0.0);
          float r1 = 2.5, r2 = 5.5;
          // Inner ring (8 taps, distance r1)
          bloom += bloomSample(vUv + vec2( r1, 0.0) * uTexel);
          bloom += bloomSample(vUv + vec2(-r1, 0.0) * uTexel);
          bloom += bloomSample(vUv + vec2(0.0,  r1) * uTexel);
          bloom += bloomSample(vUv + vec2(0.0, -r1) * uTexel);
          bloom += bloomSample(vUv + vec2( r1,  r1) * uTexel * 0.7);
          bloom += bloomSample(vUv + vec2(-r1,  r1) * uTexel * 0.7);
          bloom += bloomSample(vUv + vec2( r1, -r1) * uTexel * 0.7);
          bloom += bloomSample(vUv + vec2(-r1, -r1) * uTexel * 0.7);
          // Outer ring (4 taps, distance r2)
          bloom += bloomSample(vUv + vec2( r2, 0.0) * uTexel) * 0.7;
          bloom += bloomSample(vUv + vec2(-r2, 0.0) * uTexel) * 0.7;
          bloom += bloomSample(vUv + vec2(0.0,  r2) * uTexel) * 0.7;
          bloom += bloomSample(vUv + vec2(0.0, -r2) * uTexel) * 0.7;
          bloom /= 11.6;
          c.rgb += bloom * 1.4;

          // b028 — tone curve: lift midtones, mild contrast, saturation pump
          c.rgb = pow(c.rgb, vec3(0.92));         // gamma lift
          float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
          c.rgb = mix(vec3(lum), c.rgb, 1.32);    // saturation +32%
          c.rgb = (c.rgb - 0.5) * 1.08 + 0.5;     // contrast +8%

          // Faint scanlines (lighter for PS2+)
          float line = sin(vUv.y * 960.0) * 0.020;
          c.rgb -= line;

          // b028 — Bayer dither into ~5 bits per channel. Pixel-perfect
          // bands; adds nostalgia without crushing saturation.
          vec2 pix = vUv * vec2(854.0, 480.0);
          float d = bayer4(floor(pix)) * (1.0 / 32.0);
          c.rgb += d;
          c.rgb = floor(c.rgb * 32.0 + 0.5) / 32.0;

          // Subtle vignette
          float v = smoothstep(1.1, 0.4, length(vUv - 0.5));
          c.rgb *= v;
          gl_FragColor = c;
        }
      `,
    });
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial));

    // -----------------------------------------------------
    // b026b — DEBUG OUTLINES: yellow wireframe boxes around every
    // clickable prop, so the user can see at a glance which objects
    // are wired up to a song card. Walk the whole scene, find every
    // Object3D whose `.name` is in propTracks, and add a BoxHelper.
    // depthTest off + high renderOrder so the outline always pops.
    // -----------------------------------------------------
    {
      const wanted = new Set(Object.keys(propTracks));
      const found = [];
      scene.traverse(obj => {
        if (obj.name && wanted.has(obj.name)) found.push(obj);
      });
      for (const obj of found) {
        const helper = new THREE.BoxHelper(obj, 0xffee00);
        helper.material.depthTest = false;
        helper.material.transparent = true;
        helper.material.opacity = 0.9;
        helper.renderOrder = 999;
        scene.add(helper);
      }
      console.log('[villa b026b] clickable props found:', found.map(o => o.name));
    }

    // -----------------------------------------------------
    // b029 — Camera anchor strip (DOM overlay). Small horizontal bar at
    // the bottom of the canvas with one button per anchor. Click → fly.
    // -----------------------------------------------------
    anchorBarEl = document.createElement('div');
    anchorBarEl.className = 'world-anchor-bar';
    anchorButtons = [];
    cameraAnchors.forEach((a, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'world-anchor-btn' + (i === 0 ? ' active' : '');
      btn.textContent = a.label;
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        flyToAnchor(i);
      });
      // Prevent the click from also reaching the canvas (would dispatch a
      // villa-card click). The anchor bar lives over the canvas.
      btn.addEventListener('mousedown', (ev) => ev.stopPropagation());
      anchorBarEl.appendChild(btn);
      anchorButtons.push(btn);
    });
    container.appendChild(anchorBarEl);

    // -----------------------------------------------------
    // Input — b014 proper orbit camera (drag/wheel/pinch)
    //         b026b — real `click` listener for card dispatch
    // -----------------------------------------------------
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp);
    container.addEventListener('click', onCanvasClick);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);
    // b038 — RMB drag = pan, so suppress the browser context menu on the canvas
    container.addEventListener('contextmenu', onContextMenu);
    // b038 — keyboard nav: WASD/QE move, R resets to current anchor
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    // Hint cursor
    (canvas || container).style.cursor = 'grab';

    onResize = () => {
      if (!renderer || !container) return;
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    loader.remove();
    animate();
  }

  function clampPitch(p) {
    // b032 — first-person mode gets a much wider pitch range so the user
    // can look nearly straight up/down inside a room. Orbit keeps the
    // narrower range so the camera doesn't flip upside-down on exterior shots.
    if (camMode === 'firstPerson') {
      return Math.max(MIN_PITCH_FP, Math.min(MAX_PITCH_FP, p));
    }
    return Math.max(MIN_PITCH, Math.min(MAX_PITCH, p));
  }
  function clampRadius(r) {
    return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, r));
  }
  function clampFov(f) {
    return Math.max(MIN_FOV, Math.min(MAX_FOV, f));
  }

  // b038 — pan: slides camCenter perpendicular to the camera view direction
  // using the camera's right + up basis vectors. In orbit mode this moves
  // the look-at target; in first-person mode this moves the camera position
  // (since camCenter IS the camera position in FP). Sign convention: drag
  // right → world slides right under cursor → camCenter moves left.
  function panCamera(dx, dy) {
    if (!camera || !THREE_lib) return;
    const right = new THREE_lib.Vector3().setFromMatrixColumn(camera.matrix, 0);
    const up    = new THREE_lib.Vector3().setFromMatrixColumn(camera.matrix, 1);
    const speed = (camMode === 'orbit') ? Math.max(0.01, radius * 0.0018) : 0.018;
    camCenterX += (-right.x * dx + up.x * dy) * speed;
    camCenterY += (-right.y * dx + up.y * dy) * speed;
    camCenterZ += (-right.z * dx + up.z * dy) * speed;
  }

  // b038 — dolly: slides camCenter along the camera forward direction. Used
  // by FP wheel/pinch in place of FOV-zoom (FOV zoom didn't help users
  // escape locked room positions; dolly does).
  function dollyForward(amount) {
    if (!camera || !THREE_lib) return;
    const dir = new THREE_lib.Vector3();
    camera.getWorldDirection(dir);
    camCenterX += dir.x * amount;
    camCenterY += dir.y * amount;
    camCenterZ += dir.z * amount;
  }

  // b038 — keyboard movement, called from animate() with frame dt. WASD =
  // forward/back/strafe, QE = down/up, Shift = 3× boost. In orbit mode the
  // forward direction is projected to the ground plane so W doesn't fly the
  // look-at into the ground. In first-person mode forward is full 3D so the
  // user can fly through the room.
  function applyKeyMovement(dt) {
    if (heldKeys.size === 0 || !camera || !THREE_lib) return;
    let f = 0, s = 0, v = 0;
    if (heldKeys.has('w')) f += 1;
    if (heldKeys.has('s')) f -= 1;
    if (heldKeys.has('d')) s += 1;
    if (heldKeys.has('a')) s -= 1;
    if (heldKeys.has('e')) v += 1;
    if (heldKeys.has('q')) v -= 1;
    if (f === 0 && s === 0 && v === 0) return;
    const boost = heldKeys.has('shift') ? 3 : 1;
    const baseSpeed = (camMode === 'orbit') ? Math.max(8, radius * 0.6) : 6;
    const speed = baseSpeed * boost * dt;

    const dir = new THREE_lib.Vector3();
    camera.getWorldDirection(dir);
    if (camMode === 'orbit') { dir.y = 0; dir.normalize(); }
    const right = new THREE_lib.Vector3().setFromMatrixColumn(camera.matrix, 0);

    camCenterX += (dir.x * f + right.x * s) * speed;
    camCenterY += (dir.y * f) * speed + v * speed;
    camCenterZ += (dir.z * f + right.z * s) * speed;
  }

  // b038 — keyboard listeners. WASD/QE add to heldKeys, R re-flies to the
  // current anchor (reset). Skip while typing in any input/textarea so the
  // top-bar search doesn't intercept letters as movement.
  function onKeyDown(e) {
    if (destroyed) return;
    const tgt = e.target;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === 'q' || k === 'e') {
      heldKeys.add(k);
      e.preventDefault();
    } else if (k === 'shift') {
      heldKeys.add('shift');
    } else if (k === 'r') {
      flyToAnchor(currentAnchorIdx);
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    const k = e.key.toLowerCase();
    if (k === 'shift') heldKeys.delete('shift');
    else heldKeys.delete(k);
  }
  function onContextMenu(e) {
    e.preventDefault();
  }

  // b026 — convert mouse position to normalized device coordinates
  function updateMouseNDC(e) {
    if (!mouseNDC || !container) return;
    const rect = container.getBoundingClientRect();
    mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  // b026 — raycast and walk up parent chain to find a clickable prop name
  function pickPropAtMouse() {
    if (!raycaster || !scene || !camera) return null;
    raycaster.setFromCamera(mouseNDC, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    for (const h of hits) {
      let obj = h.object;
      while (obj) {
        if (obj.name && propTracks[obj.name] !== undefined) {
          return obj.name;
        }
        obj = obj.parent;
      }
    }
    return null;
  }

  function onMouseDown(e) {
    if (!container) return;
    // b038 — RMB or Shift+LMB starts a pan instead of a rotate
    if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
      isPanning = true;
      lastPanX = e.clientX;
      lastPanY = e.clientY;
      (canvas || container).style.cursor = 'move';
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    isDragging = true;
    lastDragX = e.clientX;
    lastDragY = e.clientY;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragMoved = false;
    (canvas || container).style.cursor = 'grabbing';
  }
  function onMouseMove(e) {
    // b038 — pan path (RMB or shift+LMB)
    if (isPanning) {
      const dx = e.clientX - lastPanX;
      const dy = e.clientY - lastPanY;
      panCamera(dx, dy);
      lastPanX = e.clientX;
      lastPanY = e.clientY;
      return;
    }
    if (isDragging) {
      const dx = e.clientX - lastDragX;
      const dy = e.clientY - lastDragY;
      yaw   -= dx * ROTATE_SPEED;
      pitch  = clampPitch(pitch + dy * ROTATE_SPEED);
      lastDragX = e.clientX;
      lastDragY = e.clientY;
      // b026 — track total movement from mousedown so we can tell click from drag
      if (Math.abs(e.clientX - dragStartX) > DRAG_CLICK_THRESHOLD ||
          Math.abs(e.clientY - dragStartY) > DRAG_CLICK_THRESHOLD) {
        dragMoved = true;
      }
      return;
    }
    // b026 — hover detection (only when not dragging). Updates cursor.
    updateMouseNDC(e);
    const hit = pickPropAtMouse();
    if (hit !== hoveredProp) {
      hoveredProp = hit;
      if (container) (canvas || container).style.cursor = hit ? 'pointer' : 'grab';
    }
  }
  function onMouseUp(e) {
    isDragging = false;
    isPanning = false;
    if (container) (canvas || container).style.cursor = hoveredProp ? 'pointer' : 'grab';
    // b026b — click dispatch moved to onCanvasClick (real `click` event).
    // The browser only fires `click` when mousedown→mouseup happened on the
    // same element with no significant movement, so it's strictly more reliable
    // than tracking it manually here. Mouseup just resets cursor + drag state.
  }

  // b027 — real `click` listener. Uses the cached `hoveredProp` from the
  // most recent mousemove as the source of truth — same value that drives
  // the cursor flip. If the cursor was a pointer, the click hits.
  // Re-raycasting at click time was unreliable on desktop (returned null
  // even when the user was clearly clicking on a highlighted prop).
  function onCanvasClick(e) {
    if (dragMoved) { dragMoved = false; return; }
    if (!hoveredProp) return;
    if (typeof tracks === 'undefined' || tracks.length === 0) return;
    const trackIdx = propTracks[hoveredProp];
    const safeIdx = trackIdx % tracks.length;
    showVillaCard(safeIdx, e.clientX, e.clientY);
  }

  // b027 — small popover card anchored at the click position. Replaces
  // the slide-in side panel for the villa view. Has thumbnail, title,
  // artist, description, play button, animated waveform.
  // b028 — waveform now driven by getFrequencyData() ONLY when this card's
  // track is the one currently playing. Otherwise the bars sit flat.
  let villaCardEl = null;
  let villaCardOutsideHandler = null;
  let villaCardTrackIdx = -1;
  let villaCardBars = null;
  function closeVillaCard() {
    if (villaCardEl && villaCardEl.parentNode) {
      villaCardEl.parentNode.removeChild(villaCardEl);
    }
    villaCardEl = null;
    villaCardBars = null;
    villaCardTrackIdx = -1;
    if (villaCardOutsideHandler) {
      document.removeEventListener('mousedown', villaCardOutsideHandler, true);
      villaCardOutsideHandler = null;
    }
  }
  // b028 — called from animate(). Pulls live frequency data when this
  // card's track is playing; otherwise leaves the bars at their flat
  // resting height (set by CSS, no JS height applied).
  function updateVillaCardWaveform() {
    if (!villaCardBars || villaCardTrackIdx < 0) return;
    const playing = (typeof state !== 'undefined')
      && state.isPlaying
      && state.currentTrack === villaCardTrackIdx;
    if (!playing) {
      // Reset to flat resting state once when playback stops
      for (let i = 0; i < villaCardBars.length; i++) {
        villaCardBars[i].style.height = '';
      }
      return;
    }
    const data = (typeof getFrequencyData === 'function') ? getFrequencyData() : null;
    if (!data || !data.length) return;
    const n = villaCardBars.length;
    const step = Math.floor(data.length / n) || 1;
    for (let i = 0; i < n; i++) {
      // Sample a band per bar from the lower 2/3 of the spectrum (the
      // upper 1/3 is mostly silence for music).
      const sample = data[Math.min(data.length - 1, i * step)];
      const h = 8 + (sample / 255) * 92;
      villaCardBars[i].style.height = h.toFixed(1) + '%';
    }
  }
  function showVillaCard(index, screenX, screenY) {
    closeVillaCard();
    const t = tracks[index];
    if (!t) return;
    const grad = (typeof getGradient === 'function')
      ? getGradient(index)
      : 'linear-gradient(135deg,#8b5cf6,#6d28d9)';

    const card = document.createElement('div');
    card.className = 'villa-card';
    villaCardEl = card;

    // b028 — bars sit flat (CSS sets the resting height) until JS drives
    // them from getFrequencyData() when this track starts playing.
    let bars = '';
    for (let i = 0; i < 22; i++) {
      bars += '<span></span>';
    }

    const desc = t.description
      ? `<div class="villa-card-desc">${escapeHtmlSafe(t.description)}</div>`
      : '';
    const newBadge = t.isNew ? '<span class="villa-card-badge new">NEW</span>' : '';
    const featBadge = t.isFeatured ? '<span class="villa-card-badge feat">FEAT</span>' : '';

    card.innerHTML = `
      <button class="villa-card-close" type="button" aria-label="Close">&times;</button>
      <div class="villa-card-row">
        <div class="villa-card-art" style="background:${grad}"></div>
        <div class="villa-card-meta">
          <div class="villa-card-badges">${newBadge}${featBadge}</div>
          <div class="villa-card-title">${escapeHtmlSafe(t.title || 'Untitled')}</div>
          <div class="villa-card-artist">${escapeHtmlSafe((typeof siteConfig !== 'undefined' && siteConfig.artist) || 'Kani')}</div>
        </div>
      </div>
      ${desc}
      <div class="villa-card-wave">${bars}</div>
      <button class="villa-card-play" type="button">▶ PLAY</button>
    `;

    // b028 — capture bar refs for the audio-reactive update loop
    villaCardTrackIdx = index;

    // Position the card. Anchor above the click point; if it would clip the
    // top of the viewport, flip below. Clamp horizontally.
    document.body.appendChild(card);
    villaCardBars = card.querySelectorAll('.villa-card-wave span');
    const rect = card.getBoundingClientRect();
    const margin = 12;
    let x = screenX - rect.width / 2;
    let y = screenY - rect.height - 18;
    if (y < margin) y = screenY + 18;
    if (x < margin) x = margin;
    if (x + rect.width > window.innerWidth - margin) x = window.innerWidth - rect.width - margin;
    if (y + rect.height > window.innerHeight - margin) y = window.innerHeight - rect.height - margin;
    card.style.left = x + 'px';
    card.style.top  = y + 'px';
    requestAnimationFrame(() => card.classList.add('visible'));

    // Wire up buttons
    card.querySelector('.villa-card-close').addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeVillaCard();
    });
    card.querySelector('.villa-card-play').addEventListener('click', (ev) => {
      ev.stopPropagation();
      // b028a — keep the card open after pressing play so the user can
      // watch the waveform react to the audio they just started.
      if (typeof playTrack === 'function') playTrack(index);
    });

    // Click outside the card closes it (use capture so it fires before any
    // canvas handlers). Schedule on next frame so the click that opened the
    // card doesn't immediately close it.
    requestAnimationFrame(() => {
      villaCardOutsideHandler = (ev) => {
        if (villaCardEl && !villaCardEl.contains(ev.target)) closeVillaCard();
      };
      document.addEventListener('mousedown', villaCardOutsideHandler, true);
    });
  }

  // Local HTML escape so we don't depend on app.js's `escapeHtml` being
  // accessible from inside this IIFE.
  function escapeHtmlSafe(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function onWheel(e) {
    e.preventDefault();
    if (camMode === 'orbit') {
      radius = clampRadius(radius + e.deltaY * ZOOM_SPEED);
    } else {
      // b038 — first-person wheel now dollies the camera forward/back along
      // the view direction instead of changing FOV. FOV zoom didn't help
      // users escape locked room positions; dolly does.
      dollyForward(-e.deltaY * 0.012);
    }
  }

  function onTouchStart(e) {
    if (!container) return;
    if (e.touches.length === 1) {
      touchMode = 'drag';
      isDragging = true;
      lastDragX = e.touches[0].clientX;
      lastDragY = e.touches[0].clientY;
      // b026 — track tap-vs-drag start position
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      dragMoved = false;
    } else if (e.touches.length === 2) {
      touchMode = 'pinch';
      isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist = Math.hypot(dx, dy) || 1;
      pinchLastDist = pinchStartDist;
      pinchStartRadius = radius;
      pinchStartFov = fov;
      // b038 — also track 2-finger center for pan
      twoFingerLastCx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      twoFingerLastCy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    }
  }
  function onTouchMove(e) {
    if (!container) return;
    if (touchMode === 'drag' && e.touches.length === 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - lastDragX;
      const dy = e.touches[0].clientY - lastDragY;
      yaw   -= dx * ROTATE_SPEED;
      pitch  = clampPitch(pitch + dy * ROTATE_SPEED);
      lastDragX = e.touches[0].clientX;
      lastDragY = e.touches[0].clientY;
      // b026 — track total movement for tap-vs-drag
      if (Math.abs(e.touches[0].clientX - dragStartX) > DRAG_CLICK_THRESHOLD ||
          Math.abs(e.touches[0].clientY - dragStartY) > DRAG_CLICK_THRESHOLD) {
        dragMoved = true;
      }
    } else if (touchMode === 'pinch' && e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy) || 1;
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      // b038 — pinch handles BOTH zoom (distance change) AND pan (center
      // movement) per frame. Tracking deltas instead of start values so
      // pan + zoom can compose smoothly.
      const distDelta = dist - pinchLastDist;
      if (camMode === 'orbit') {
        // pinch out (dist grows) → smaller radius (zoom in)
        radius = clampRadius(radius - distDelta * 0.12);
      } else {
        // b038 — FP pinch dollies forward instead of FOV zoom (matches wheel)
        dollyForward(distDelta * 0.04);
      }
      panCamera(cx - twoFingerLastCx, cy - twoFingerLastCy);
      pinchLastDist = dist;
      twoFingerLastCx = cx;
      twoFingerLastCy = cy;
    }
  }
  function onTouchEnd(e) {
    if (e.touches.length === 0) {
      // b027 — if this was a tap (drag mode + no movement), raycast at the
      // tap position and dispatch the villa card popover.
      const wasTap = touchMode === 'drag' && !dragMoved;
      if (wasTap) {
        updateMouseNDC({ clientX: lastDragX, clientY: lastDragY });
        const hit = pickPropAtMouse();
        if (hit && typeof tracks !== 'undefined' && tracks.length > 0) {
          const safeIdx = propTracks[hit] % tracks.length;
          showVillaCard(safeIdx, lastDragX, lastDragY);
        }
      }
      touchMode = null;
      isDragging = false;
      twoFingerLastCx = 0;
      twoFingerLastCy = 0;
    }
  }

  // b029 — Orbit center is now mutable state, driven by the camera anchor
  // system. flyToAnchor() tweens the values; animate() reads them every frame.
  let camCenterX = 0;
  let camCenterY = 4.0;
  let camCenterZ = -2;

  // b029 — Camera anchors for the jumper system. Each entry is a complete
  // camera state: orbit center + initial yaw/pitch/radius. Click an anchor
  // button → flyToAnchor() tweens current state into the target state over
  // ANCHOR_FLY_MS, then resumes free orbit at the new anchor.
  const ANCHOR_FLY_MS = 1400;
  const cameraAnchors = [
    // b032 — Anchors carry an explicit camera MODE.
    //   - 'orbit'       → cx/cy/cz = orbit center; yaw/pitch/radius spherical
    //   - 'firstPerson' → px/py/pz = fixed camera position; yaw/pitch lookAt
    //                     direction; fov for zoom
    // Interior rooms use first-person so the user can stand in place and
    // pan their view (orbit-around-a-point arcs the camera through walls in
    // tight spaces, plus the radius clamp makes interior orbits unstable).
    { name: 'pool',     label: 'POOL',     mode: 'orbit',       cx:   0,    cy: 3.0, cz:   2,    yaw: 0.20,         pitch: 0.10, radius: 22  },
    { name: 'beach',    label: 'BEACH',    mode: 'orbit',       cx:   0,    cy: 4.0, cz:  -8,    yaw: 0,            pitch: 0.05, radius: 35  },
    { name: 'aerial',   label: 'AERIAL',   mode: 'orbit',       cx:   0,    cy: 0.0, cz: -10,    yaw: 0,            pitch: 1.25, radius: 42  },
    { name: 'living',   label: 'LIVING',   mode: 'firstPerson', px:   0,    py: 3.5, pz: -15.8,  yaw: Math.PI,      pitch: 0.10, fov: 75 },
    { name: 'bedroom',  label: 'BEDROOM',  mode: 'firstPerson', px: -11.5,  py: 5.8, pz:  -6.0,  yaw: 0,             pitch: 0.18, fov: 75 },
    { name: 'billiard', label: 'BILLIARD', mode: 'firstPerson', px:  14.5,  py: 3.0, pz: -12.5,  yaw: Math.PI / 2,   pitch: 0.20, fov: 75 },
    { name: 'indoor',   label: 'INDOOR',   mode: 'firstPerson', px:   0,    py: 4.0, pz: -18.0,  yaw: 0,             pitch: 0.12, fov: 78 },
  ];
  let currentAnchorIdx = 0;
  let flyState = null;  // b032: { startTime, fromPos, fromLook, fromFov, toPos, toLook, toFov, target }

  // b032 — helpers for the cartesian fly tween. They convert between the
  // mode-specific state and a unified (camera position + lookAt point) pair.

  function currentLookAtPoint() {
    // Where is the camera currently looking?
    if (camMode === 'orbit') {
      return new THREE_lib.Vector3(camCenterX, camCenterY, camCenterZ);
    }
    // first-person — derive lookAt from position + forward(yaw, pitch)
    const cp = Math.cos(pitch);
    return new THREE_lib.Vector3(
      camCenterX - Math.sin(yaw) * cp,
      camCenterY - Math.sin(pitch),
      camCenterZ - Math.cos(yaw) * cp
    );
  }
  function anchorCameraPosition(a) {
    if (a.mode === 'orbit') {
      const cp = Math.cos(a.pitch);
      return new THREE_lib.Vector3(
        a.cx + Math.sin(a.yaw) * cp * a.radius,
        a.cy + Math.sin(a.pitch) * a.radius,
        a.cz + Math.cos(a.yaw) * cp * a.radius
      );
    }
    return new THREE_lib.Vector3(a.px, a.py, a.pz);
  }
  function anchorLookAtPoint(a) {
    if (a.mode === 'orbit') {
      return new THREE_lib.Vector3(a.cx, a.cy, a.cz);
    }
    const cp = Math.cos(a.pitch);
    return new THREE_lib.Vector3(
      a.px - Math.sin(a.yaw) * cp,
      a.py - Math.sin(a.pitch),
      a.pz - Math.cos(a.yaw) * cp
    );
  }

  function flyToAnchor(idx) {
    if (idx < 0 || idx >= cameraAnchors.length) return;
    const target = cameraAnchors[idx];

    // b032 — Tween cartesian (position + lookAt point + fov), not the underlying
    // mode-specific state. This works seamlessly across mode switches: an orbit
    // anchor flying to a first-person anchor (or vice versa) just lerps through
    // intermediate camera positions without any visible pop. The mode swap
    // happens at t=1 when we settle the underlying state vars.
    const fromPos = camera.position.clone();
    const fromLook = currentLookAtPoint();
    const toPos = anchorCameraPosition(target);
    const toLook = anchorLookAtPoint(target);
    const toFov = (target.mode === 'firstPerson' ? target.fov : 70);

    flyState = {
      startTime: performance.now(),
      fromPos, fromLook, fromFov: camera.fov,
      toPos, toLook, toFov,
      target,
    };
    currentAnchorIdx = idx;
    // Update the active button styling
    if (anchorButtons) {
      anchorButtons.forEach((b, i) => {
        b.classList.toggle('active', i === idx);
      });
    }
    // Close any open villa card so it doesn't stick to a dead position
    closeVillaCard();
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function animate(now) {
    if (destroyed || !renderer) return;
    animId = requestAnimationFrame(animate);

    const t = now || performance.now();
    // b038 — frame dt for keyboard movement integration. Cap at 100ms so a
    // long tab-out doesn't fling the camera on the first frame back.
    const dt = lastFrameTime === 0 ? 1 / 60 : Math.min(0.1, (t - lastFrameTime) / 1000);
    lastFrameTime = t;
    if (!flyState) applyKeyMovement(dt);

    const elapsed = (now || 0) / 1000;
    for (let i = 0; i < timeUniforms.length; i++) {
      timeUniforms[i].value = elapsed;
    }

    // b029 — Day/night cycle: smoothly oscillates 0..1..0 over 60 seconds.
    // 0 = sunset, 1 = night, then back to sunset. Uses cosine for smooth
    // ease in/out at the extremes (lingers a bit on each).
    cycleUniform.value = 0.5 - 0.5 * Math.cos(elapsed * Math.PI * 2 / 60);

    // b028 — drive the popover card waveform from live frequency data
    updateVillaCardWaveform();

    // b032 — Camera anchor fly-to tween (cartesian). Lerps camera position +
    // lookAt point + fov in straight 3D space, so an orbit anchor → first-person
    // anchor (or vice versa) flies smoothly without a mode-switch pop. The user's
    // drag/zoom input is ignored during the tween — at t=1 we settle the
    // mode-specific state vars and hand control back to the matching free-input
    // path below.
    if (flyState) {
      const t = Math.min(1, ((now || 0) - flyState.startTime) / ANCHOR_FLY_MS);
      const k = easeInOutCubic(t);
      const px = flyState.fromPos.x  + (flyState.toPos.x  - flyState.fromPos.x)  * k;
      const py = flyState.fromPos.y  + (flyState.toPos.y  - flyState.fromPos.y)  * k;
      const pz = flyState.fromPos.z  + (flyState.toPos.z  - flyState.fromPos.z)  * k;
      const lx = flyState.fromLook.x + (flyState.toLook.x - flyState.fromLook.x) * k;
      const ly = flyState.fromLook.y + (flyState.toLook.y - flyState.fromLook.y) * k;
      const lz = flyState.fromLook.z + (flyState.toLook.z - flyState.fromLook.z) * k;
      camera.position.set(px, py, pz);
      camera.lookAt(lx, ly, lz);
      const newFov = flyState.fromFov + (flyState.toFov - flyState.fromFov) * k;
      if (Math.abs(camera.fov - newFov) > 0.01) {
        camera.fov = newFov;
        camera.updateProjectionMatrix();
      }
      if (t >= 1) {
        // Settle into the target anchor's mode + state. After this frame the
        // free-input path takes over and the user can drag/zoom from here.
        const tgt = flyState.target;
        camMode = tgt.mode;
        if (tgt.mode === 'orbit') {
          camCenterX = tgt.cx; camCenterY = tgt.cy; camCenterZ = tgt.cz;
          yaw = tgt.yaw; pitch = tgt.pitch; radius = tgt.radius;
          fov = 70;
        } else {
          camCenterX = tgt.px; camCenterY = tgt.py; camCenterZ = tgt.pz;
          yaw = tgt.yaw; pitch = tgt.pitch; fov = tgt.fov;
        }
        flyState = null;
      }
    } else if (camMode === 'orbit') {
      // b014 — spherical orbit around (camCenterX/Y/Z). yaw/pitch/radius come
      // from drag/wheel/pinch input.
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      camera.position.x = camCenterX + Math.sin(yaw) * cosP * radius;
      camera.position.z = camCenterZ + Math.cos(yaw) * cosP * radius;
      camera.position.y = camCenterY + sinP * radius;
      if (camera.position.y < 1.0) camera.position.y = 1.0;  // never below ground
      camera.lookAt(camCenterX, camCenterY, camCenterZ);
      if (camera.fov !== 70) { camera.fov = 70; camera.updateProjectionMatrix(); }
    } else {
      // b032 — first-person: camera position is fixed at (camCenterX/Y/Z),
      // drag rotates the lookAt direction in place, wheel/pinch adjusts FOV.
      camera.position.set(camCenterX, camCenterY, camCenterZ);
      const cp = Math.cos(pitch);
      camera.lookAt(
        camCenterX - Math.sin(yaw) * cp,
        camCenterY - Math.sin(pitch),
        camCenterZ - Math.cos(yaw) * cp
      );
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }

    // Pass 1 — render scene to low-res target
    renderer.setRenderTarget(lowResTarget);
    renderer.clear();
    renderer.render(scene, camera);

    // Pass 2 — upscale to canvas
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCamera);
  }

  function destroy() {
    destroyed = true;
    closeVillaCard();
    if (anchorBarEl && anchorBarEl.parentNode) anchorBarEl.parentNode.removeChild(anchorBarEl);
    anchorBarEl = null;
    anchorButtons = null;
    flyState = null;
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    if (onResize) window.removeEventListener('resize', onResize);
    onResize = null;
    if (container) {
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseUp);
      container.removeEventListener('click', onCanvasClick);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
      container.removeEventListener('contextmenu', onContextMenu);
    }
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    heldKeys.clear();
    isPanning = false;
    lastFrameTime = 0;
    materials.forEach(m => m.dispose && m.dispose());
    materials = [];
    timeUniforms = [];
    if (lowResTarget) { lowResTarget.dispose(); lowResTarget = null; }
    if (postMaterial) { postMaterial.dispose(); postMaterial = null; }
    if (renderer) { renderer.dispose(); renderer = null; }
    scene = camera = postScene = postCamera = canvas = container = null;
    yaw = 0; pitch = 0.30; radius = 26;
    isDragging = false; touchMode = null;
  }

  registerView('villa', { init, destroy });
})();
