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
  let yaw = 0, pitch = 0.30;     // initial slight downward tilt
  let radius = 26;               // initial orbit distance (was CAM_RADIUS const)
  let isDragging = false;
  let lastDragX = 0, lastDragY = 0;
  let touchMode = null;          // 'drag' | 'pinch' | null
  let pinchStartDist = 0;
  let pinchStartRadius = 0;
  const MIN_RADIUS = 8;
  const MAX_RADIUS = 80;
  const MIN_PITCH = -0.10;       // can dip just below horizontal
  const MAX_PITCH = 1.30;        // close to top-down
  const ROTATE_SPEED = 0.005;    // rad per pixel
  const ZOOM_SPEED = 0.025;      // radius per wheel delta
  let materials = [];
  let timeUniforms = [];
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
    scene.fog = new THREE.FogExp2(0x6a1850, 0.003);

    camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 320);
    // Initial position will be overwritten by animate() on first frame, but
    // set something reasonable so the first render isn't broken if anything
    // skips animate.
    camera.position.set(0, 12, 26);
    camera.lookAt(0, 4, -2);

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
    };

    // -----------------------------------------------------
    // Sky dome — gradient + procedural stars + moon disc
    // -----------------------------------------------------
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        // b028 — saturation pump. Hot pink horizon, deep magenta mid, rich
        // indigo zenith. Was 0x0a0a3a / 0x9a3070 / 0xff7050.
        topColor:    { value: new THREE.Color(0x180844) },
        midColor:    { value: new THREE.Color(0xc02888) },
        bottomColor: { value: new THREE.Color(0xff4090) },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 bottomColor;
        varying vec3 vDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          float h = vDir.y;
          vec3 col;
          if (h > 0.0) {
            col = mix(midColor, topColor, smoothstep(0.0, 0.85, h));
          } else {
            col = mix(midColor, bottomColor, smoothstep(0.0, -0.25, h));
          }

          // Stars only at the zenith — sun just dipped, sky still too bright
          // for stars near the horizon
          if (h > 0.4) {
            vec2 sp = vec2(atan(vDir.z, vDir.x) * 80.0, h * 80.0);
            float n = hash(floor(sp));
            float star = step(0.994, n) * smoothstep(0.4, 0.7, h);
            col += vec3(star * 0.85);
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
          uFogDensity:   { value: 0.003 },
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
            vec3 ambient = vec3(0.22, 0.16, 0.34);
            vec3 col = uColor * ambient;
            col += pointLight(uLampPos,   uLampColor,   uLampRange,   uColor);
            col += pointLight(uPoolPos,   uPoolColor,   uPoolRange,   uColor);
            col += pointLight(uWindowPos, uWindowColor, uWindowRange, uColor);
            col += uEmissive * uEmissiveAmt;

            // b028 — RIM LIGHT. Hot pink Fresnel against the sky. The single
            // biggest "I am playing a PS2 game" tell. ~3 lines of GLSL.
            float rim = 1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);
            rim = pow(rim, 2.4);
            col += vec3(1.00, 0.30, 0.65) * rim * 0.55;

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
    // b014 — extended to cover both the front patio (where the pool sits)
    // AND the back area between villa back wall and the new street.
    // The road/sidewalk planes overlay this on the street side, the front
    // beach overlays it on the camera side.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 80, 60, 40), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -10);
    scene.add(ground);

    // -----------------------------------------------------
    // Pool — custom water shader with tile lines + ripples
    // -----------------------------------------------------
    const poolMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:        { value: 0 },
        uBaseColor:   { value: new THREE.Color(0x18d8d0) },
        uBrightColor: { value: new THREE.Color(0xa8fff0) },
        uFogColor:    { value: new THREE.Color(0x6a1850) },
        uFogDensity:  { value: 0.003 },
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
    const pool = new THREE.Mesh(new THREE.BoxGeometry(22, 0.2, 6, 28, 1, 10), poolMat);
    pool.position.set(0, 0.10, 5);
    scene.add(pool);
    // Circular jacuzzi — attached at the +x end of the main pool
    const jacuzzi = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 0.20, 24),
      poolMat
    );
    jacuzzi.position.set(13.5, 0.10, 5);
    scene.add(jacuzzi);

    // Pool rim — white travertine matching the villa
    const rimMat = makePS2Material({ color: 0xe8e4dc });
    const rim = new THREE.Mesh(new THREE.BoxGeometry(22.6, 0.22, 6.6), rimMat);
    rim.position.set(0, 0.06, 5);
    scene.add(rim);
    const jacuzziRim = new THREE.Mesh(
      new THREE.CylinderGeometry(2.7, 2.7, 0.22, 24),
      rimMat
    );
    jacuzziRim.position.set(13.5, 0.06, 5);
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
    // VILLA — MEDITERRANEAN REBUILD (b025)
    //
    // U-shaped layout: central 2-story block flanked by two 1.5-story wings.
    // Stone ground floor + plaster upper floor on every section. Hipped
    // terracotta tile roofs. Arched windows with marble surrounds and dark
    // mullions. Symmetric front facade with arched main entry, marble
    // columns, wrought iron balcony above. Bell tower (campanile) embedded
    // in the back-west corner of the west wing rises above everything as
    // the iconic silhouette element.
    //
    // Replaces the b010-b019 modernist stack (lower volume + 2 cantilevered
    // upper boxes + cylindrical tower + LED strips + wood louvers + forward
    // balcony + rooftop hot tub + spiral stairs + ornate parapet). User
    // feedback b024: "house honestly looks ugly... like a bunch of shapes
    // glued together". Right call — the bones were wrong, no amount of
    // surface detail was going to save it.
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
    // Helper: arched window — pane + marble surround + sill + mullions
    // (PS2 chunky abstraction: rectangular frame + suggested arch via
    // a slightly wider top piece, no actual curved geometry)
    // -------------------------------------------------------------------
    function addArchedWindow(cx, cy, cz, w, h) {
      // Warm glow pane
      const pane = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), windowMat);
      pane.position.set(cx, cy, cz);
      scene.add(pane);
      // Marble top header (slightly wider)
      const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.22, 0.18), marbleMat);
      top.position.set(cx, cy + h / 2 + 0.11, cz);
      scene.add(top);
      // Marble side frames
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.16, h + 0.22, 0.18), marbleMat);
      left.position.set(cx - w / 2 - 0.08, cy, cz);
      scene.add(left);
      const right = new THREE.Mesh(new THREE.BoxGeometry(0.16, h + 0.22, 0.18), marbleMat);
      right.position.set(cx + w / 2 + 0.08, cy, cz);
      scene.add(right);
      // Marble sill
      const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.10, 0.22), marbleMat);
      sill.position.set(cx, cy - h / 2 - 0.05, cz);
      scene.add(sill);
      // 3 dark mullion bars dividing the pane
      for (let i = 1; i <= 3; i++) {
        const mx = cx - w / 2 + (w / 4) * i;
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.10), railMat);
        m.position.set(mx, cy, cz + 0.02);
        scene.add(m);
      }
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
    // Helper: hipped pyramid roof using ConeGeometry rad=4
    // The cone vertices land on the wall corners; flat sides face N/S/E/W
    // For non-square footprint, scale Z to stretch the pyramid
    // -------------------------------------------------------------------
    function addHippedRoof(cx, cy, cz, w, d, h, mat) {
      const overhang = 0.7;
      const baseRadius = (w / 2 + overhang) / Math.cos(Math.PI / 4);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(baseRadius, h, 4),
        mat
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.set(cx, cy + h / 2, cz);
      if (d !== w) {
        roof.scale.z = d / w;
      }
      scene.add(roof);
    }

    // -------------------------------------------------------------------
    // Helper: cornice strip — marble band wrapping a building section
    // at a given height (front + back + left + right)
    // -------------------------------------------------------------------
    function addCornice(cx, cy, cz, w, d) {
      const t = 0.18;
      const proj = 0.18;
      const front = new THREE.Mesh(
        new THREE.BoxGeometry(w + proj * 2, t, proj),
        marbleMat
      );
      front.position.set(cx, cy, cz + d / 2 + proj / 2);
      scene.add(front);
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(w + proj * 2, t, proj),
        marbleMat
      );
      back.position.set(cx, cy, cz - d / 2 - proj / 2);
      scene.add(back);
      const left = new THREE.Mesh(
        new THREE.BoxGeometry(proj, t, d),
        marbleMat
      );
      left.position.set(cx - w / 2 - proj / 2, cy, cz);
      scene.add(left);
      const right = new THREE.Mesh(
        new THREE.BoxGeometry(proj, t, d),
        marbleMat
      );
      right.position.set(cx + w / 2 + proj / 2, cy, cz);
      scene.add(right);
    }

    // =====================================================================
    // CENTRAL BLOCK (14×14, 2 floors + hipped terracotta roof)
    // =====================================================================

    // Stone ground floor walls
    addWallBox(villaCx, villaCz, centralW, centralD, centralH1, podiumTopY, stoneMat);
    // Plaster upper floor walls
    addWallBox(villaCx, villaCz, centralW, centralD, centralH2, podiumTopY + centralH1, villaMat);

    // Cornice between ground and upper floor
    addCornice(villaCx, podiumTopY + centralH1, villaCz, centralW, centralD);
    // Cornice at the top of upper floor (where the roof eave starts)
    addCornice(villaCx, podiumTopY + centralH1 + centralH2, villaCz, centralW, centralD);

    // Hipped terracotta roof — peak at y=10.32
    addHippedRoof(villaCx, centralTopY, villaCz, centralW, centralD, 3.5, terracottaMat);

    // Interior floor (travertine, sits on top of podium)
    const cInteriorFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(centralW - wallT * 2, centralD - wallT * 2),
      floorInteriorMat
    );
    cInteriorFloor.rotation.x = -Math.PI / 2;
    cInteriorFloor.position.set(villaCx, podiumTopY + 0.01, villaCz);
    scene.add(cInteriorFloor);

    // Interior ceiling (under the upper floor)
    const cInteriorCeiling = new THREE.Mesh(
      new THREE.PlaneGeometry(centralW - wallT * 2, centralD - wallT * 2),
      villaInteriorMat
    );
    cInteriorCeiling.rotation.x = Math.PI / 2;
    cInteriorCeiling.position.set(villaCx, podiumTopY + centralH1 - 0.01, villaCz);
    scene.add(cInteriorCeiling);

    // ---- Front facade arched windows ----
    const archYG = podiumTopY + centralH1 / 2 + 0.3;     // ground floor center
    const archYU = podiumTopY + centralH1 + centralH2 / 2 + 0.2;  // upper floor center
    // Ground floor: 2 windows flanking the entry
    addArchedWindow(villaCx - 4.5, archYG, centralFrontZ + 0.04, 1.6, 2.2);
    addArchedWindow(villaCx + 4.5, archYG, centralFrontZ + 0.04, 1.6, 2.2);
    // Upper floor: 3 windows (one above the entry door = balcony door)
    addArchedWindow(villaCx - 4.5, archYU, centralFrontZ + 0.04, 1.4, 2.0);
    addArchedWindow(villaCx,        archYU, centralFrontZ + 0.04, 1.4, 2.0);
    addArchedWindow(villaCx + 4.5, archYU, centralFrontZ + 0.04, 1.4, 2.0);

    // ---- Back facade arched windows ----
    addArchedWindow(villaCx - 4.5, archYG, centralBackZ - 0.04, 1.6, 2.2);
    addArchedWindow(villaCx + 4.5, archYG, centralBackZ - 0.04, 1.6, 2.2);
    addArchedWindow(villaCx - 4.5, archYU, centralBackZ - 0.04, 1.4, 2.0);
    addArchedWindow(villaCx,        archYU, centralBackZ - 0.04, 1.4, 2.0);
    addArchedWindow(villaCx + 4.5, archYU, centralBackZ - 0.04, 1.4, 2.0);

    // ---- Main entry — arched opening + marble columns + door ----
    {
      const entryW = 3.0;
      const entryH = 3.4;
      const entryY = podiumTopY + entryH / 2;
      const entryZ = centralFrontZ + 0.04;

      // Door pane (warm glow)
      const doorPane = new THREE.Mesh(new THREE.BoxGeometry(entryW, entryH, 0.10), windowMat);
      doorPane.position.set(villaCx, entryY, entryZ);
      scene.add(doorPane);

      // Dark inset slab (the actual door visible inside the arch)
      const doorSlab = new THREE.Mesh(new THREE.BoxGeometry(entryW - 0.5, entryH - 0.4, 0.06), railMat);
      doorSlab.position.set(villaCx, entryY, entryZ + 0.10);
      scene.add(doorSlab);

      // Marble side columns flanking the entry (round)
      for (const dx of [-entryW / 2 - 0.45, entryW / 2 + 0.45]) {
        const col = new THREE.Mesh(
          new THREE.CylinderGeometry(0.30, 0.34, entryH + 0.6, 12),
          marbleMat
        );
        col.position.set(villaCx + dx, podiumTopY + (entryH + 0.6) / 2, entryZ);
        scene.add(col);
        // Capital block on top
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(0.78, 0.20, 0.78),
          marbleMat
        );
        cap.position.set(villaCx + dx, podiumTopY + entryH + 0.7, entryZ);
        scene.add(cap);
      }

      // Marble header above the arched opening
      const header = new THREE.Mesh(
        new THREE.BoxGeometry(entryW + 1.4, 0.30, 0.30),
        marbleMat
      );
      header.position.set(villaCx, podiumTopY + entryH + 0.95, entryZ);
      scene.add(header);
    }

    // ---- Wrought iron balcony above the main entry ----
    {
      const balW = 4.5;
      const balD = 1.1;
      const balY = podiumTopY + centralH1 + 0.05;
      const balZ = centralFrontZ + balD / 2;
      // Marble floor slab (juts forward from the upper wall)
      const balFloor = new THREE.Mesh(
        new THREE.BoxGeometry(balW, 0.14, balD),
        marbleMat
      );
      balFloor.position.set(villaCx, balY, balZ);
      scene.add(balFloor);
      // Top rail (front + sides)
      const railH = 1.0;
      const railFront = new THREE.Mesh(
        new THREE.BoxGeometry(balW, 0.06, 0.06),
        railMat
      );
      railFront.position.set(villaCx, balY + railH, balZ + balD / 2 - 0.05);
      scene.add(railFront);
      // Front balustrade posts
      const postCount = 14;
      for (let i = 0; i < postCount; i++) {
        const t = (i + 0.5) / postCount;
        const px = villaCx - balW / 2 + t * balW;
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, railH - 0.05, 0.06),
          railMat
        );
        post.position.set(px, balY + (railH - 0.05) / 2 + 0.04, balZ + balD / 2 - 0.05);
        scene.add(post);
      }
      // Side rails
      for (const dx of [-balW / 2 + 0.03, balW / 2 - 0.03]) {
        const sideRail = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.06, balD),
          railMat
        );
        sideRail.position.set(villaCx + dx, balY + railH, balZ);
        scene.add(sideRail);
        // 4 posts per side
        for (let i = 0; i < 4; i++) {
          const t = (i + 0.5) / 4;
          const pz = balZ - balD / 2 + t * balD;
          const sp = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, railH - 0.05, 0.06),
            railMat
          );
          sp.position.set(villaCx + dx, balY + (railH - 0.05) / 2 + 0.04, pz);
          scene.add(sp);
        }
      }
    }

    // =====================================================================
    // EAST WING (9×14, stone ground + plaster upper + hipped roof)
    // =====================================================================
    addWallBox(eastWingCx, villaCz, wingW, wingD, wingH1, podiumTopY, stoneMat);
    addWallBox(eastWingCx, villaCz, wingW, wingD, wingH2, podiumTopY + wingH1, villaMat);
    addCornice(eastWingCx, podiumTopY + wingH1, villaCz, wingW, wingD);
    addCornice(eastWingCx, podiumTopY + wingH1 + wingH2, villaCz, wingW, wingD);
    addHippedRoof(eastWingCx, wingTopY, villaCz, wingW, wingD, 2.8, terracottaMat);

    // East wing front windows (2 ground + 2 upper)
    const archYWG = podiumTopY + wingH1 / 2 + 0.2;
    const archYWU = podiumTopY + wingH1 + wingH2 / 2 + 0.1;
    addArchedWindow(eastWingCx - 1.8, archYWG, centralFrontZ + 0.04, 1.4, 2.0);
    addArchedWindow(eastWingCx + 1.8, archYWG, centralFrontZ + 0.04, 1.4, 2.0);
    addArchedWindow(eastWingCx - 1.8, archYWU, centralFrontZ + 0.04, 1.2, 1.6);
    addArchedWindow(eastWingCx + 1.8, archYWU, centralFrontZ + 0.04, 1.2, 1.6);

    // East wing back windows
    addArchedWindow(eastWingCx - 1.8, archYWG, centralBackZ - 0.04, 1.4, 2.0);
    addArchedWindow(eastWingCx + 1.8, archYWG, centralBackZ - 0.04, 1.4, 2.0);

    // East wing side door (east-facing wall) — slab door + glow
    {
      const sideDoor = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.6, 1.4), windowMat);
      sideDoor.position.set(eastWingRightX + 0.05, podiumTopY + 1.3, villaCz);
      scene.add(sideDoor);
      // Marble surround
      const sFrame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.20, 1.7), marbleMat);
      sFrame.position.set(eastWingRightX + 0.06, podiumTopY + 2.7, villaCz);
      scene.add(sFrame);
    }

    // =====================================================================
    // WEST WING (9×14, mirror of east)
    // =====================================================================
    addWallBox(westWingCx, villaCz, wingW, wingD, wingH1, podiumTopY, stoneMat);
    addWallBox(westWingCx, villaCz, wingW, wingD, wingH2, podiumTopY + wingH1, villaMat);
    addCornice(westWingCx, podiumTopY + wingH1, villaCz, wingW, wingD);
    addCornice(westWingCx, podiumTopY + wingH1 + wingH2, villaCz, wingW, wingD);
    addHippedRoof(westWingCx, wingTopY, villaCz, wingW, wingD, 2.8, terracottaMat);

    addArchedWindow(westWingCx - 1.8, archYWG, centralFrontZ + 0.04, 1.4, 2.0);
    addArchedWindow(westWingCx + 1.8, archYWG, centralFrontZ + 0.04, 1.4, 2.0);
    addArchedWindow(westWingCx - 1.8, archYWU, centralFrontZ + 0.04, 1.2, 1.6);
    addArchedWindow(westWingCx + 1.8, archYWU, centralFrontZ + 0.04, 1.2, 1.6);

    addArchedWindow(westWingCx - 1.8, archYWG, centralBackZ - 0.04, 1.4, 2.0);
    addArchedWindow(westWingCx + 1.8, archYWG, centralBackZ - 0.04, 1.4, 2.0);

    {
      const sideDoor = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.6, 1.4), windowMat);
      sideDoor.position.set(westWingLeftX - 0.05, podiumTopY + 1.3, villaCz);
      scene.add(sideDoor);
      const sFrame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.20, 1.7), marbleMat);
      sFrame.position.set(westWingLeftX - 0.06, podiumTopY + 2.7, villaCz);
      scene.add(sFrame);
    }

    // =====================================================================
    // BELL TOWER (campanile) — embedded in the back-west corner of the
    // west wing, rises above all roofs as the iconic silhouette element.
    // 3 stages: plaster shaft + marble belfry + terracotta cap pyramid.
    // =====================================================================
    {
      const towerW = 3.6;
      const towerCx = westWingCx - 1.5;   // shifted toward west edge
      const towerCz = villaCz - 4.0;      // shifted toward back of wing

      // ---- Stone base (pedestal flare) ----
      const baseW = towerW + 0.6;
      const baseH = 1.4;
      const towerBase = new THREE.Mesh(
        new THREE.BoxGeometry(baseW, baseH, baseW),
        stoneMat
      );
      towerBase.position.set(towerCx, podiumTopY + baseH / 2, towerCz);
      scene.add(towerBase);

      // ---- Stage 1: plaster shaft (rises from base to belfry) ----
      // b026 — named as the click→card target for the bell tower
      const shaftH = 11.0;
      const shaft = new THREE.Mesh(
        new THREE.BoxGeometry(towerW, shaftH, towerW),
        villaMat
      );
      shaft.position.set(towerCx, podiumTopY + baseH + shaftH / 2, towerCz);
      shaft.name = 'bell_tower';
      scene.add(shaft);

      // Stone waist band on the shaft (about 1/3 of the way up)
      const waist = new THREE.Mesh(
        new THREE.BoxGeometry(towerW + 0.3, 0.30, towerW + 0.3),
        stoneMat
      );
      waist.position.set(towerCx, podiumTopY + baseH + shaftH * 0.4, towerCz);
      scene.add(waist);

      // Narrow tall window on each face of the shaft (4 windows)
      const winY = podiumTopY + baseH + shaftH * 0.7;
      // Front + back (narrow z, tall)
      for (const dz of [towerW / 2 + 0.06, -(towerW / 2 + 0.06)]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.50, 1.6, 0.10), windowMat);
        w.position.set(towerCx, winY, towerCz + dz);
        scene.add(w);
      }
      // Left + right faces
      for (const dx of [towerW / 2 + 0.06, -(towerW / 2 + 0.06)]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.6, 0.50), windowMat);
        w.position.set(towerCx + dx, winY, towerCz);
        scene.add(w);
      }

      // ---- Stage 2: belfry (slightly wider than shaft, 4 marble pillars
      //      with open arched openings between them, bell visible inside) ----
      const belfryH = 2.4;
      const belfryW = towerW + 0.8;
      const belfryY = podiumTopY + baseH + shaftH + belfryH / 2;

      // Bottom belfry slab (sits on top of shaft)
      const belfryBot = new THREE.Mesh(
        new THREE.BoxGeometry(belfryW + 0.4, 0.20, belfryW + 0.4),
        marbleMat
      );
      belfryBot.position.set(towerCx, belfryY - belfryH / 2 - 0.10, towerCz);
      scene.add(belfryBot);

      // 4 marble corner pillars
      for (const dx of [-belfryW / 2, belfryW / 2]) {
        for (const dz of [-belfryW / 2, belfryW / 2]) {
          const pillar = new THREE.Mesh(
            new THREE.BoxGeometry(0.40, belfryH, 0.40),
            marbleMat
          );
          pillar.position.set(towerCx + dx, belfryY, towerCz + dz);
          scene.add(pillar);
        }
      }

      // Top belfry slab
      const belfryTop = new THREE.Mesh(
        new THREE.BoxGeometry(belfryW + 0.6, 0.24, belfryW + 0.6),
        marbleMat
      );
      belfryTop.position.set(towerCx, belfryY + belfryH / 2 + 0.12, towerCz);
      scene.add(belfryTop);

      // Bell inside the belfry (dark icosahedron + warm glow rope mark)
      const bell = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.55, 1),
        railMat
      );
      bell.position.set(towerCx, belfryY + 0.1, towerCz);
      scene.add(bell);
      const bellRope = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.6, 0.06),
        lanternGlowMat
      );
      bellRope.position.set(towerCx, belfryY - 0.6, towerCz);
      scene.add(bellRope);

      // ---- Stage 3: terracotta cap pyramid ----
      const capH = 2.4;
      const capBaseHalf = belfryW / 2 + 0.4;
      const capRadius = capBaseHalf / Math.cos(Math.PI / 4);
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(capRadius, capH, 4),
        terracottaMat
      );
      cap.rotation.y = Math.PI / 4;
      cap.position.set(
        towerCx,
        belfryY + belfryH / 2 + 0.24 + capH / 2,
        towerCz
      );
      scene.add(cap);
    }

    // =====================================================================
    // WALL SCONCES (warm-glow lanterns flanking entries + at corners)
    // =====================================================================
    // Front facade — flanking the main entry
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
    // Wing front facade sconces
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
    function addDeckLantern(x, z) {
      // Tiny base
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.30, 0.12, 0.30),
        lanternBaseMat
      );
      base.position.set(x, 0.06, z);
      scene.add(base);
      // Glowing glass body
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.6, 0.25),
        lanternGlowMat
      );
      body.position.set(x, 0.42, z);
      scene.add(body);
      // Tiny dark cap on top
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.06, 0.32),
        lanternBaseMat
      );
      cap.position.set(x, 0.75, z);
      scene.add(cap);
    }

    // b014 — lanterns pushed forward to clear the new bigger pool
    addDeckLantern(-9.0, 9.5);
    addDeckLantern(-3.0, 9.5);
    addDeckLantern( 3.0, 9.5);
    addDeckLantern( 9.0, 9.5);

    // -----------------------------------------------------
    // Garage — b014 detached, behind the villa back wall facing the street
    // (was attached to right side w/ door facing +z; the b014 layout puts
    //  the road behind the villa so the garage moved + flipped)
    // -----------------------------------------------------
    const garageW = 8.0, garageH = 3.5, garageD = 8.0;
    const garageCx = 0;                       // centered behind villa
    const garageCz = villaCz - centralD / 2 - garageD / 2;  // b025 — touching central block back wall (was lowerD/2)
    {
      const garage = new THREE.Mesh(new THREE.BoxGeometry(garageW, garageH, garageD), villaMat);
      garage.position.set(garageCx, garageH / 2, garageCz);
      scene.add(garage);

      // Garage roof slab (slight overhang)
      const garageRoof = new THREE.Mesh(
        new THREE.BoxGeometry(garageW + 0.8, 0.3, garageD + 0.8),
        roofMat
      );
      garageRoof.position.set(garageCx, garageH + 0.15, garageCz);
      scene.add(garageRoof);

      // Glowing garage door on the -Z face (STREET side), facing the road
      const garageDoor = new THREE.Mesh(
        new THREE.BoxGeometry(garageW - 0.7, garageH - 0.6, 0.12),
        windowMat
      );
      garageDoor.position.set(garageCx, (garageH - 0.6) / 2 + 0.05, garageCz - garageD / 2 - 0.06);
      scene.add(garageDoor);
    }

    // -----------------------------------------------------
    // Lambo — wedge supercar. b015: built into a Group so we can rotate it
    // around its own center via the rotY parameter (CCW radians around Y).
    // -----------------------------------------------------
    function addCar(cx, cz, bodyColorHex, rotY = 0, name = null) {
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

      g.position.set(cx, 0, cz);
      g.rotation.y = rotY;
      if (name) g.name = name;
      scene.add(g);
      return g;
    }

    // b014 — Yellow Lambo parked in the driveway, just in front of the
    // garage door (which now faces -z toward the street).
    // b026 — named for click→card system
    addCar(garageCx, garageCz - garageD / 2 - 2.8, 0xf5d518, 0, 'lambo_yellow');
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
      g.position.set(x, 0.05, z);
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

    function addPathLight(x, z, colorHex) {
      const poleMat = makePS2Material({ color: 0x080808 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 4), poleMat);
      pole.position.set(x, 0.275, z);
      scene.add(pole);

      const bulbMat = makePS2Material({
        color:       colorHex,
        emissive:    colorHex,
        emissiveAmt: 2.4,
      });
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.20, 0.22), bulbMat);
      bulb.position.set(x, 0.62, z);
      scene.add(bulb);

      // Ground spot puddle — circular emissive disc on the patio
      // (y=0.06 so it sits above the beach sand at y=0.04)
      const spot = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), makeGroundSpotMat(colorHex));
      spot.rotation.x = -Math.PI / 2;
      spot.position.set(x, 0.06, z);
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
        uFogDensity: { value: 0.003 },
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

    // b014 — ocean ONLY on the front (camera/pool side). The back of the
    // villa now faces a street/neighborhood instead of more water.
    const beachMat = makePS2Material({ color: 0xc0a878 });

    // Front beach — sand band in front of the deck, transitions to ocean
    const frontBeach = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 28, 30, 8),
      beachMat
    );
    frontBeach.rotation.x = -Math.PI / 2;
    frontBeach.position.set(0, 0.03, 32);
    scene.add(frontBeach);

    // Front ocean plane — the only ocean in the scene now
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(320, 110, 40, 14), oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, -0.02, 100);
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
      g.position.set(x, 0.05, z);
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

    // -----------------------------------------------------
    // Neighbor villas — distant homes on the right side
    // -----------------------------------------------------
    function addNeighborVilla(cx, cz, scale) {
      const lw = 6 * scale, lh = 3 * scale, ld = 6 * scale;
      const uw = 4 * scale, uh = 2.5 * scale, ud = 4 * scale;

      // Lower volume
      const nlow = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, ld), villaMat);
      nlow.position.set(cx, lh / 2, cz);
      scene.add(nlow);

      // Lower roof slab
      const nlroof = new THREE.Mesh(new THREE.BoxGeometry(lw + 0.8, 0.25, ld + 0.8), roofMat);
      nlroof.position.set(cx, lh + 0.125, cz);
      scene.add(nlroof);

      // Upper volume
      const nup = new THREE.Mesh(new THREE.BoxGeometry(uw, uh, ud), villaMat);
      nup.position.set(cx, lh + 0.25 + uh / 2, cz);
      scene.add(nup);

      // Upper roof slab
      const nuroof = new THREE.Mesh(new THREE.BoxGeometry(uw + 0.6, 0.25, ud + 0.6), roofMat);
      nuroof.position.set(cx, lh + 0.25 + uh + 0.125, cz);
      scene.add(nuroof);

      // Glowing window on the +Z face (camera-facing)
      const nlglow = new THREE.Mesh(new THREE.BoxGeometry(lw - 1.2, lh * 0.55, 0.1), windowMat);
      nlglow.position.set(cx, lh * 0.45, cz + ld / 2 + 0.06);
      scene.add(nlglow);

      // Upper glowing window on the +Z face
      const nuglow = new THREE.Mesh(new THREE.BoxGeometry(uw - 0.8, uh * 0.5, 0.1), windowMat);
      nuglow.position.set(cx, lh + 0.25 + uh / 2, cz + ud / 2 + 0.06);
      scene.add(nuglow);
    }

    // -----------------------------------------------------
    // STREET SIDE (b014) — opposite the pool/ocean side. The villa's back
    // wall faces a Miami beachfront boulevard with other modernist mansions
    // across the street, palm-lined sidewalks, streetlamps, distant city.
    // -----------------------------------------------------
    {
      // Driveway — from sidewalk up to garage door (garage at center x=0,
      // detached behind villa back wall, door facing -z toward the street)
      const drivewayMat = makePS2Material({ color: 0xb8b4a8 });
      const driveway = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 9, 6, 6),
        drivewayMat
      );
      driveway.rotation.x = -Math.PI / 2;
      driveway.position.set(garageCx, 0.025, -31.5);
      scene.add(driveway);

      // Asphalt road — pushed further back to make room for the garage +
      // driveway + parked lambo between villa and street
      const asphaltMat = makePS2Material({ color: 0x1c1c20 });
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(160, 8, 40, 4),
        asphaltMat
      );
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.02, -41);
      scene.add(road);

      // Sidewalk strips on each side of the road
      const sidewalkMat = makePS2Material({ color: 0x4a4854 });
      const sidewalkNear = new THREE.Mesh(
        new THREE.PlaneGeometry(160, 2, 40, 2),
        sidewalkMat
      );
      sidewalkNear.rotation.x = -Math.PI / 2;
      sidewalkNear.position.set(0, 0.025, -36);
      scene.add(sidewalkNear);

      const sidewalkFar = new THREE.Mesh(
        new THREE.PlaneGeometry(160, 2, 40, 2),
        sidewalkMat
      );
      sidewalkFar.rotation.x = -Math.PI / 2;
      sidewalkFar.position.set(0, 0.025, -46);
      scene.add(sidewalkFar);

      // Dashed yellow center line on the road
      const dashMat = makePS2Material({
        color:       0xffd040,
        emissive:    0xffd040,
        emissiveAmt: 1.4,
      });
      for (let i = -75; i <= 75; i += 6) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.02, 0.18), dashMat);
        dash.position.set(i, 0.04, -41);
        scene.add(dash);
      }

      // Streetlamps — pole on the near sidewalk, arm + bulb extending over the road
      const lampPoleMat = makePS2Material({ color: 0x141014 });
      const lampBulbMat = makePS2Material({
        color:       0xffd090,
        emissive:    0xffd090,
        emissiveAmt: 2.6,
      });
      function addStreetLamp(x) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.14, 6.0, 5),
          lampPoleMat
        );
        pole.position.set(x, 3.0, -36);
        scene.add(pole);
        // Arm extending over the road
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 2.5), lampPoleMat);
        arm.position.set(x, 5.7, -37.6);
        scene.add(arm);
        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.40, 0.45), lampBulbMat);
        bulb.position.set(x, 5.55, -38.8);
        scene.add(bulb);
      }
      addStreetLamp(-60);
      addStreetLamp(-36);
      addStreetLamp(-12);
      addStreetLamp( 12);
      addStreetLamp( 36);
      addStreetLamp( 60);
    }

    // Other mansions across the street (past the far sidewalk z=-47)
    addNeighborVilla(-44, -58, 1.1);
    addNeighborVilla(-22, -56, 1.0);
    addNeighborVilla(  6, -58, 1.05);
    addNeighborVilla( 30, -56, 1.15);
    addNeighborVilla( 52, -58, 0.95);
    // A second row deeper back
    addNeighborVilla(-58, -76, 0.85);
    addNeighborVilla(-30, -78, 0.95);
    addNeighborVilla(  0, -80, 1.0);
    addNeighborVilla( 30, -78, 0.90);
    addNeighborVilla( 58, -76, 0.80);
    // Side flank houses (visible when orbiting around)
    addNeighborVilla(-46, -28, 0.9);
    addNeighborVilla( 46, -28, 0.95);

    // -----------------------------------------------------
    // b018 — Hills + grass behind the city. Hills are now closer (z=-85
    // to -120 instead of -90 to -118), much taller (14-28 instead of 5-12),
    // wider, and overlap so they read as a continuous ridge instead of
    // 5 isolated boxes. Plus a big grass plane filling the void behind
    // the cross-street mansions.
    // -----------------------------------------------------
    // b020/b021 — hill mat variants for color variation (was 1 mat).
    // b021 hotfix: b020's mid-tone (0x36482b) was only ~15% brighter than
    // base — invisible after FogExp2 ate it. Pushed mat2 way brighter and
    // re-tinted mat3 toward the dusk-pink sky for actual atmospheric
    // perspective (cool blue was the wrong direction against a magenta
    // sky). Bump caps also bumped up in size.
    const hillMat  = makePS2Material({ color: 0x2a3a25 });  // base dark grassy green (also used by grass plane)
    const hillMat2 = makePS2Material({ color: 0x607a38 });  // bright mid-tone — ridge alternation, survives the fog
    const hillMat3 = makePS2Material({ color: 0x6a4858 });  // rose-tinted distance — back ridge atmospheric perspective

    // Big grass plane filling the void from past the far sidewalk to the
    // back of the hills — fixes the "everything behind the mansions
    // drops into fog" complaint.
    const backGrass = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 100, 20, 8),
      hillMat
    );
    backGrass.rotation.x = -Math.PI / 2;
    backGrass.position.set(0, 0.04, -100);
    scene.add(backGrass);

    // b020 — addHill now takes a mat + a seed that drives 1-2 deterministic
    // "bump" caps stacked on top of the main box. The bumps break the flat
    // top silhouette so neighbors don't read as one continuous plateau from
    // elevated camera angles.
    function addHill(cx, cy, cz, w, h, d, mat, seed) {
      const hill = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      hill.position.set(cx, h / 2 + cy, cz);
      scene.add(hill);

      // b021 — bumps ~1.6× larger than b020 so silhouette breaks read at zoom
      const bumpCount = 2 + (seed % 2);
      for (let i = 0; i < bumpCount; i++) {
        const s  = seed + i * 7;
        const bw = w * (0.50 + ((s * 3) % 5) * 0.06);
        const bh = h * (0.30 + ((s * 5) % 4) * 0.08);
        const bd = d * (0.65 + ((s * 11) % 4) * 0.07);
        const bx = cx + (((s * 13) % 5) - 2) * w * 0.13;
        const bz = cz + (((s * 17) % 5) - 2) * d * 0.10;
        const bump = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
        bump.position.set(bx, h + bh / 2, bz);
        scene.add(bump);
      }
    }
    // Front ridge — alternating mats so adjacent mounds are distinguishable
    addHill(-55, 0, -85, 60, 14, 24, hillMat2, 1);
    addHill(  0, 0, -92, 90, 20, 28, hillMat,  3);
    addHill( 55, 0, -85, 60, 15, 24, hillMat2, 5);
    // Mid ridge — taller, deeper, alternated
    addHill(-30, 0, -105, 70, 24, 20, hillMat,  7);
    addHill( 30, 0, -105, 70, 22, 20, hillMat2, 9);
    // Back ridge — the tallest, hazy distance tone
    addHill(  0, 0, -120, 120, 28, 24, hillMat3, 11);

    // Houses ON the hills — elevated villas perched on the slopes
    // (rebuild a quick neighbor villa helper that takes a y offset)
    function addHillVilla(cx, cy, cz, scale) {
      const lw = 5 * scale, lh = 2.5 * scale, ld = 5 * scale;
      const nlow = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, ld), villaMat);
      nlow.position.set(cx, cy + lh / 2, cz);
      scene.add(nlow);
      const nlroof = new THREE.Mesh(
        new THREE.BoxGeometry(lw + 0.5, 0.18, ld + 0.5),
        roofMat
      );
      nlroof.position.set(cx, cy + lh + 0.09, cz);
      scene.add(nlroof);
      const nlglow = new THREE.Mesh(new THREE.BoxGeometry(lw - 0.8, lh * 0.5, 0.08), windowMat);
      nlglow.position.set(cx, cy + lh * 0.45, cz + ld / 2 + 0.04);
      scene.add(nlglow);
    }
    // b018 — repositioned onto the new (taller, closer) hills
    // Front ridge (y=14-20)
    addHillVilla(-50, 14, -85, 1.0);
    addHillVilla(-20, 20, -92, 1.1);
    addHillVilla( 20, 20, -92, 1.05);
    addHillVilla( 50, 15, -85, 0.95);
    // Mid ridge (y=22-24)
    addHillVilla(-30, 24, -105, 0.9);
    addHillVilla( 30, 22, -105, 0.95);
    // Back ridge (y=28, the deepest)
    addHillVilla(-25, 28, -120, 0.85);
    addHillVilla( 25, 28, -120, 0.90);
    addHillVilla(  0, 28, -120, 0.80);

    // Boulevard palms — concentrated along both sides of the street
    // (between villa back area and near sidewalk, and across the road)
    addPalm(-54, -34, 5.6);
    addPalm(-42, -34, 5.4);
    addPalm(-30, -34, 5.8);
    addPalm(-18, -34, 5.6);
    addPalm( 18, -34, 5.6);
    addPalm( 30, -34, 5.4);
    addPalm( 42, -34, 5.8);
    addPalm( 54, -34, 5.6);
    // Far side palms (between road and cross-street mansions)
    addPalm(-50, -48, 5.0);
    addPalm(-12, -48, 5.2);
    addPalm( 12, -48, 5.0);
    addPalm( 50, -48, 5.2);

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
      const gw = 22, gd = 18;
      const halfW = gw / 2, halfD = gd / 2;

      // ----- 1. Bright lawn plane (the actual grass, finally) -----
      const lawn = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd), lawnMat);
      lawn.rotation.x = -Math.PI / 2;
      lawn.position.set(cx, 0.05, cz);
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
      pathLong.position.set(cx, 0.10, cz);
      scene.add(pathLong);
      const pathCross = new THREE.Mesh(new THREE.BoxGeometry(gw - 0.6, 0.08, pathW), marbleMat);
      pathCross.position.set(cx, 0.10, cz);
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
      addDeckLantern(cx - 5.5, cz - 1.6);
      addDeckLantern(cx - 5.5, cz + 1.6);
      addDeckLantern(cx + 5.5, cz - 1.6);
      addDeckLantern(cx + 5.5, cz + 1.6);
      addDeckLantern(cx - 1.6, cz - 5.5);
      addDeckLantern(cx + 1.6, cz - 5.5);
    }
    addGarden(-32, 13);

    // ----- East lot: supercar showroom -----
    function addCarShowroom(cx, cz) {
      const sw = 14, sd = 10, sh = 4;
      // Stage floor (lighter stone slab)
      const floor = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.18, sd), rimMat);
      floor.position.set(cx, 0.09, cz);
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
      // 3 cars in a row, facing forward (toward camera)
      addCar(cx - 4.2, cz + 0.5, 0xff2050, 0);  // red
      addCar(cx,        cz + 0.5, 0x2080ff, 0);  // blue
      addCar(cx + 4.2, cz + 0.5, 0xffaa00, 0);  // orange
    }
    addCarShowroom(32, 13);

    // -----------------------------------------------------
    // Distant skyline dots (neon lights on the horizon)
    // -----------------------------------------------------
    const skylineColors = [0xff2d95, 0x00d4ff, 0xffaa55, 0xa44fff];
    const skylineMats = skylineColors.map(c => {
      const m = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(c) } },
        vertexShader: `
          void main() {
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            vec4 clip = projectionMatrix * mvPos;
            vec2 grid = vec2(320.0, 180.0);
            vec3 ndc = clip.xyz / clip.w;
            ndc.xy = floor(ndc.xy * grid + 0.5) / grid;
            clip.xyz = ndc * clip.w;
            gl_Position = clip;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          void main() { gl_FragColor = vec4(uColor * 1.3, 1.0); }
        `,
      });
      materials.push(m);
      return m;
    });
    // b014 — Miami skyline ONLY on the street side (back, behind the road).
    // Cities are inland from beaches; the front (camera/pool side) is open
    // ocean to the horizon. 80 buildings, ~20 of them tall high-rises.
    for (let i = 0; i < 80; i++) {
      const mat = skylineMats[i % skylineMats.length];
      const xrange = (i / 80 - 0.5) * 320;
      const yjit = 0.6 + Math.abs(Math.sin(i * 1.7)) * 0.5 + Math.abs(Math.sin(i * 3.3)) * 1.4;
      // Every 4th building is a tall high-rise
      const isTall = (i % 4 === 0);
      const tall = isTall
        ? 2.5 + Math.abs(Math.sin(i * 2.1)) * 3.0
        : 0.4 + Math.abs(Math.sin(i * 2.1)) * 1.2;
      const w = isTall ? 0.95 : 0.55;
      const dot = new THREE.Mesh(new THREE.BoxGeometry(w, tall, w), mat);
      dot.position.set(xrange, yjit + (isTall ? tall / 2 : 0), -100);
      scene.add(dot);
    }

    // -----------------------------------------------------
    // Low-res render target → fullscreen quad upscale
    // -----------------------------------------------------
    lowResTarget = new THREE.WebGLRenderTarget(LOW_W, LOW_H, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
    });

    postScene = new THREE.Scene();
    postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postMaterial = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: lowResTarget.texture } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
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

        void main() {
          vec4 c = texture2D(tDiffuse, vUv);

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
    return Math.max(MIN_PITCH, Math.min(MAX_PITCH, p));
  }
  function clampRadius(r) {
    return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, r));
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
    if (!container || e.button !== 0) return;
    isDragging = true;
    lastDragX = e.clientX;
    lastDragY = e.clientY;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragMoved = false;
    (canvas || container).style.cursor = 'grabbing';
  }
  function onMouseMove(e) {
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
      if (typeof playTrack === 'function') playTrack(index);
      closeVillaCard();
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
    radius = clampRadius(radius + e.deltaY * ZOOM_SPEED);
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
      pinchStartRadius = radius;
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
      // pinch out (dist increases) → smaller radius (zoom in)
      radius = clampRadius(pinchStartRadius * (pinchStartDist / dist));
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
    }
  }

  // Orbit center stays the same point in front of the villa
  const CAM_CENTER_X = 0;
  const CAM_CENTER_Y = 4.0;
  const CAM_CENTER_Z = -2;

  function animate(now) {
    if (destroyed || !renderer) return;
    animId = requestAnimationFrame(animate);

    const elapsed = (now || 0) / 1000;
    for (let i = 0; i < timeUniforms.length; i++) {
      timeUniforms[i].value = elapsed;
    }

    // b028 — drive the popover card waveform from live frequency data
    updateVillaCardWaveform();

    // b014 — proper spherical orbit. yaw/pitch/radius come from drag input.
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    camera.position.x = CAM_CENTER_X + Math.sin(yaw) * cosP * radius;
    camera.position.z = CAM_CENTER_Z + Math.cos(yaw) * cosP * radius;
    camera.position.y = CAM_CENTER_Y + sinP * radius;
    if (camera.position.y < 1.0) camera.position.y = 1.0;  // never below ground
    camera.lookAt(CAM_CENTER_X, CAM_CENTER_Y, CAM_CENTER_Z);

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
    }
    window.removeEventListener('mouseup', onMouseUp);
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
