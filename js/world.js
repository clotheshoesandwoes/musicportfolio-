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
    renderer.setClearColor(0x1a1238, 1);

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x40285a, 0.009);

    camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 320);
    // Initial position will be overwritten by animate() on first frame, but
    // set something reasonable so the first render isn't broken if anything
    // skips animate.
    camera.position.set(0, 12, 26);
    camera.lookAt(0, 4, -2);

    // -----------------------------------------------------
    // Sky dome — gradient + procedural stars + moon disc
    // -----------------------------------------------------
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        // "Sun just dipped" palette — pink/orange horizon, lavender mid, deep indigo zenith
        topColor:    { value: new THREE.Color(0x0a0a3a) },
        midColor:    { value: new THREE.Color(0x9a3070) },
        bottomColor: { value: new THREE.Color(0xff7050) },
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
    const lampPos     = new THREE.Vector3(0, 0.6, 9.5);  // middle deck lantern (b014)
    const lampColor   = new THREE.Color(0xffc080);  // warm lantern, not sodium
    const lampRange   = 22;  // bigger reach for the wider deck
    const poolPos     = new THREE.Vector3(0, 0.4, 5);  // bigger pool centerpoint (b014)
    const poolColor   = new THREE.Color(0x40fff0);  // brighter cyan glow
    const poolRange   = 26;  // bigger reach for the bigger pool
    const windowPos   = new THREE.Vector3(0, 4.5, -10);  // inside the bigger villa
    const windowColor = new THREE.Color(0xffd090);  // richer warm interior
    const windowRange = 18;  // b018 — was 32, the entire scene was washed out by interior glow

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
          uFogColor:     { value: new THREE.Color(0x40285a) },
          uFogDensity:   { value: 0.009 },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vWorldPos;
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
          varying float vFogDepth;

          vec3 pointLight(vec3 lp, vec3 lc, float lr, vec3 base) {
            vec3 d = lp - vWorldPos;
            float dist = length(d);
            float fall = max(0.0, 1.0 - dist / lr);
            fall *= fall;
            float ndl = max(dot(vNormal, normalize(d)), 0.0);
            return base * lc * fall * (0.30 + ndl * 0.70);
          }

          void main() {
            vec3 ambient = vec3(0.28, 0.24, 0.40);
            vec3 col = uColor * ambient;
            col += pointLight(uLampPos,   uLampColor,   uLampRange,   uColor);
            col += pointLight(uPoolPos,   uPoolColor,   uPoolRange,   uColor);
            col += pointLight(uWindowPos, uWindowColor, uWindowRange, uColor);
            col += uEmissive * uEmissiveAmt;
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
        uFogColor:    { value: new THREE.Color(0x40285a) },
        uFogDensity:  { value: 0.009 },
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
    const villaMat2      = makePS2Material({ color: 0xece4d0 });   // b018 — warmer plaster for the second upper volume so it reads as a separate floor
    const villaInteriorMat = makePS2Material({ color: 0xddd6c8 }); // slightly warmer interior plaster
    const floorInteriorMat = makePS2Material({ color: 0xc9c2b2 }); // warm travertine floor inside
    const roofMat        = makePS2Material({ color: 0xe0dcd0 });   // thin slab, slightly darker
    const stoneMat       = makePS2Material({ color: 0x8a847a });   // stacked natural stone
    const podiumMat      = makePS2Material({ color: 0x6f6960 });   // b018 — darker travertine plinth under the villa
    const woodSlatMat    = makePS2Material({ color: 0x6a4a30 });   // b019 — warm wood for louver slats over upper glass
    const railMat        = makePS2Material({ color: 0x141014 });   // b019 — dark metal balcony rails / planter trim
    const ledMat         = makePS2Material({                       // b019 — cyan LED accent strips under roof slabs
      color:       0x80f0ff,
      emissive:    0x80f0ff,
      emissiveAmt: 1.6,
    });
    const topiaryMat     = makePS2Material({ color: 0x2a4a25 });   // b019 — clipped topiary cone (matches shrub green)
    const coveMat        = makePS2Material({                       // recessed cove light
      color:       0xffd090,
      emissive:    0xffd090,
      emissiveAmt: 2.2,
    });

    const villaCx = 0;
    const villaCz = -10;

    // Lower volume dimensions — 2x in every axis vs b010
    const lowerW = 32, lowerH = 6.0, lowerD = 18;
    const wallT  = 0.35;  // wall thickness

    const lowerHalfW = lowerW / 2;
    const lowerHalfD = lowerD / 2;
    const lowerFrontZ = villaCz + lowerHalfD;  // +z face
    const lowerBackZ  = villaCz - lowerHalfD;  // -z face
    const lowerLeftX  = villaCx - lowerHalfW;
    const lowerRightX = villaCx + lowerHalfW;

    // ---- b018 — darker stone podium under the entire villa footprint
    // (slightly larger than the lower volume so it reads as a base, not
    // just floating plaster directly on the deck) ----
    const podium = new THREE.Mesh(
      new THREE.BoxGeometry(lowerW + 2.0, 0.8, lowerD + 2.0),
      podiumMat
    );
    podium.position.set(villaCx, 0.4, villaCz);
    scene.add(podium);

    // ---- Interior floor (travertine) — sits on top of the podium ----
    const interiorFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(lowerW - wallT * 2, lowerD - wallT * 2),
      floorInteriorMat
    );
    interiorFloor.rotation.x = -Math.PI / 2;
    interiorFloor.position.set(villaCx, 0.82, villaCz);
    scene.add(interiorFloor);

    // ---- Back wall (full, solid) ----
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(lowerW, lowerH, wallT),
      villaMat
    );
    backWall.position.set(villaCx, lowerH / 2, lowerBackZ + wallT / 2);
    scene.add(backWall);

    // ---- Left wall (solid) ----
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, lowerH, lowerD),
      villaMat
    );
    leftWall.position.set(lowerLeftX + wallT / 2, lowerH / 2, villaCz);
    scene.add(leftWall);

    // ---- Right wall (solid) ----
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallT, lowerH, lowerD),
      villaMat
    );
    rightWall.position.set(lowerRightX - wallT / 2, lowerH / 2, villaCz);
    scene.add(rightWall);

    // ---- Front face = stone columns + FTG glass between them ----
    // b016 — 7 columns instead of 5, TALLER (extend up to the underside
    // of the upper cantilever instead of just to the lower roof). More
    // prominent stone reading.
    const stoneColW = 1.6, stoneColH = lowerH + 0.5, stoneColD = 0.85;
    const colXs = [-14, -9.33, -4.66, 0, 4.66, 9.33, 14];
    colXs.forEach(cx => {
      const col = new THREE.Mesh(
        new THREE.BoxGeometry(stoneColW, stoneColH, stoneColD),
        stoneMat
      );
      col.position.set(villaCx + cx, stoneColH / 2, lowerFrontZ - stoneColD / 2);
      scene.add(col);
    });

    // ---- Lower roof slab (also serves as the interior ceiling) ----
    const lowerRoof = new THREE.Mesh(
      new THREE.BoxGeometry(lowerW + 0.6, 0.22, lowerD + 0.6),
      roofMat
    );
    lowerRoof.position.set(villaCx, lowerH + 0.11, villaCz);
    scene.add(lowerRoof);

    // Interior ceiling face — slightly warmer plaster on the inside
    const interiorCeiling = new THREE.Mesh(
      new THREE.PlaneGeometry(lowerW - wallT * 2, lowerD - wallT * 2),
      villaInteriorMat
    );
    interiorCeiling.rotation.x = Math.PI / 2;  // facing down
    interiorCeiling.position.set(villaCx, lowerH - 0.01, villaCz);
    scene.add(interiorCeiling);

    // -------------------------------------------------------------------
    // Upper volume — b016 ASYMMETRIC STACK to break the "just a square"
    // reading. Two stacked upper boxes shifted in opposite directions,
    // dramatic forward cantilever, plus a rooftop terrace wall.
    // -------------------------------------------------------------------
    // First upper volume: wider than lower in some directions, hangs
    // 2.8 forward over the deck (was 1.8), shifted 4 to +x so the east
    // side cantilevers more dramatically than the west
    const upperW = 28, upperH = 4.5, upperD = 12;
    const upperY = lowerH + 0.22 + upperH / 2;
    const upperZ = villaCz + 2.8;       // hangs further forward
    const upperX = villaCx + 4;         // shifted east for asymmetry
    const upper = new THREE.Mesh(new THREE.BoxGeometry(upperW, upperH, upperD), villaMat);
    upper.position.set(upperX, upperY, upperZ);
    scene.add(upper);

    // Upper roof slab — even thinner (0.16), wider overhang (2.5 each side)
    // for the dramatic "floating slab" reading
    const upperRoof = new THREE.Mesh(
      new THREE.BoxGeometry(upperW + 3.0, 0.16, upperD + 2.5),
      roofMat
    );
    upperRoof.position.set(upperX, upperY + upperH / 2 + 0.08, upperZ);
    scene.add(upperRoof);

    // Second upper volume (third floor box) — smaller, shifted -x to
    // create the asymmetric stepped pyramid look
    const upper2W = 14, upper2H = 3.5, upper2D = 8;
    const upper2Y = upperY + upperH / 2 + 0.16 + upper2H / 2 + 0.05;
    const upper2X = villaCx - 6;        // shifted west, opposite of first upper
    const upper2Z = villaCz - 0.5;      // pulled back slightly
    const upper2 = new THREE.Mesh(
      new THREE.BoxGeometry(upper2W, upper2H, upper2D),
      villaMat2
    );
    upper2.position.set(upper2X, upper2Y, upper2Z);
    scene.add(upper2);

    // Second upper roof — thinnest of all (the topmost floating slab)
    const upper2Roof = new THREE.Mesh(
      new THREE.BoxGeometry(upper2W + 2.0, 0.14, upper2D + 2.0),
      roofMat
    );
    upper2Roof.position.set(upper2X, upper2Y + upper2H / 2 + 0.07, upper2Z);
    scene.add(upper2Roof);

    // -------------------------------------------------------------------
    // b019 — LED accent strips under each roof slab edge (cyan emissive
    // lines that read as architectural lighting from the camera angle)
    // -------------------------------------------------------------------
    function addLedStrip(cx, cy, cz, lenX, lenZ) {
      // Two strips: one on the front (+z) edge, one on the bottom of the
      // overhang. Just the front edge is enough — that's what's visible.
      if (lenX > 0) {
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(lenX, 0.05, 0.08),
          ledMat
        );
        strip.position.set(cx, cy, cz);
        scene.add(strip);
      }
      if (lenZ > 0) {
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.05, lenZ),
          ledMat
        );
        strip.position.set(cx, cy, cz);
        scene.add(strip);
      }
    }
    // Lower roof — front edge strip
    addLedStrip(villaCx, lowerH - 0.02, villaCz + lowerD / 2 + 0.25, lowerW + 0.4, 0);
    // Upper roof — front edge strip (the dramatic cantilever)
    addLedStrip(upperX, upperY + upperH / 2 - 0.02, upperZ + upperD / 2 + 1.15, upperW + 2.6, 0);
    // Second upper roof — front edge strip
    addLedStrip(upper2X, upper2Y + upper2H / 2 - 0.02, upper2Z + upper2D / 2 + 0.95, upper2W + 1.6, 0);

    // Rooftop terrace wall — low parapet around the first upper volume
    // roof on the side NOT covered by upper2 (the +x and front sides)
    {
      const wallH = 0.9;
      const wallY = upperY + upperH / 2 + 0.16 + wallH / 2;
      // East wall (full length of first upper east edge)
      const eastWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.20, wallH, upperD - 0.2),
        villaMat
      );
      eastWall.position.set(upperX + upperW / 2 - 0.10, wallY, upperZ);
      scene.add(eastWall);
      // Front wall (across the east half of the first upper, where upper2 doesn't cover)
      const frontWall = new THREE.Mesh(
        new THREE.BoxGeometry(upperW * 0.55, wallH, 0.20),
        villaMat
      );
      frontWall.position.set(upperX + upperW * 0.20, wallY, upperZ + upperD / 2 - 0.10);
      scene.add(frontWall);
    }

    // Recessed cove light strip on the underside of the upper cantilever
    const coveZ = upperZ + upperD / 2;
    const cove = new THREE.Mesh(
      new THREE.BoxGeometry(upperW - 0.6, 0.06, 0.6),
      coveMat
    );
    cove.position.set(upperX, lowerH + 0.28, coveZ - 0.3);
    scene.add(cove);

    // Glowing glass — single warm material reused on all openings
    // b018 — emissiveAmt nerfed 2.0 → 0.95 so the FTG glass doesn't wash
    // out the entire villa front face into a yellow lite-brite blob.
    const windowMat = makePS2Material({
      color:       0xffd090,
      emissive:    0xffc880,
      emissiveAmt: 0.95,
    });

    // -------------------------------------------------------------------
    // Cylindrical corner tower (b016) — round 2-story rotunda at the
    // west front corner of the lower volume. Breaks all the right angles.
    // (must be declared AFTER windowMat — b016a hotfix)
    // -------------------------------------------------------------------
    {
      const towerR = 3.0;
      const towerH = lowerH + 2.5;  // pokes well above the lower roof
      // Tucked outside villa WEST wall (the upper cantilever extends east,
      // so the tower goes on the opposite corner for asymmetry)
      const towerX = lowerLeftX - towerR + 0.4;
      const towerZ = lowerFrontZ - towerR + 0.6;
      // Solid plaster cylinder body
      const towerBody = new THREE.Mesh(
        new THREE.CylinderGeometry(towerR, towerR, towerH, 16),
        villaMat
      );
      towerBody.position.set(towerX, towerH / 2, towerZ);
      scene.add(towerBody);
      // Open glass band wrapping the upper portion (the round room view)
      const towerGlass = new THREE.Mesh(
        new THREE.CylinderGeometry(towerR + 0.04, towerR + 0.04, towerH * 0.55, 16, 1, true),
        windowMat
      );
      towerGlass.position.set(towerX, towerH * 0.65, towerZ);
      scene.add(towerGlass);
      // Tower roof cap — a thin disc above
      const towerCap = new THREE.Mesh(
        new THREE.CylinderGeometry(towerR + 0.4, towerR + 0.4, 0.18, 16),
        roofMat
      );
      towerCap.position.set(towerX, towerH + 0.09, towerZ);
      scene.add(towerCap);
    }

    // ---- Floor-to-ceiling glass on the front of the lower volume ----
    // b016 — 6 panes filling the 6 gaps between the 7 columns
    function addLowerGlass(cx, width) {
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(width, lowerH - 0.4, 0.10),
        windowMat
      );
      glass.position.set(villaCx + cx, lowerH / 2, lowerFrontZ - stoneColD / 2);
      scene.add(glass);
    }
    // Column gaps: 7 columns at -14, -9.33, -4.66, 0, 4.66, 9.33, 14
    // Gap centers: -11.665, -6.995, -2.33, 2.33, 6.995, 11.665. Width per gap ~3.0
    addLowerGlass(-11.665, 3.0);
    addLowerGlass( -6.995, 3.0);
    addLowerGlass( -2.330, 3.0);
    addLowerGlass(  2.330, 3.0);
    addLowerGlass(  6.995, 3.0);
    addLowerGlass( 11.665, 3.0);

    // ---- Floor-to-ceiling glass on the front of the (wider+shifted) upper volume ----
    const upperFrontZ = upperZ + upperD / 2;
    const upperGlass = new THREE.Mesh(
      new THREE.BoxGeometry(upperW - 2.0, upperH - 0.6, 0.10),
      windowMat
    );
    upperGlass.position.set(upperX, upperY, upperFrontZ + 0.05);
    scene.add(upperGlass);

    // ---- Side glass strip on the east edge of upper volume ----
    const upperSideGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, upperH - 0.6, upperD - 1.5),
      windowMat
    );
    upperSideGlass.position.set(upperX + upperW / 2 + 0.05, upperY, upperZ);
    scene.add(upperSideGlass);

    // ---- FTG glass on the second upper volume (top floor, west side) ----
    const upper2Glass = new THREE.Mesh(
      new THREE.BoxGeometry(upper2W - 1.0, upper2H - 0.5, 0.10),
      windowMat
    );
    upper2Glass.position.set(upper2X, upper2Y, upper2Z + upper2D / 2 + 0.05);
    scene.add(upper2Glass);

    // ---- Front door — slot it in the gap between columns at x=-9.33 and x=-4.66 ----
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.8, 0.12), windowMat);
    door.position.set(villaCx - 6.995, 1.4, lowerFrontZ - stoneColD / 2);
    scene.add(door);

    // ---- Back door — opening on the rear wall facing the Miami neighborhood ----
    const backDoor = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.8, 0.12), windowMat);
    backDoor.position.set(villaCx, 1.4, lowerBackZ + wallT + 0.05);
    scene.add(backDoor);

    // -------------------------------------------------------------------
    // b019 — Wood louver slats across the front of the first upper volume
    // (vertical wood strips IN FRONT of the glass band — the glow shows
    // through the gaps. Classic modern Miami villa screen detail.)
    // -------------------------------------------------------------------
    {
      const slatCount = 14;
      const slatW = 0.18;
      const slatH = upperH - 0.5;
      const slatD = 0.10;
      const slatY = upperY;
      const slatZ = upperFrontZ + 0.20;  // 0.2 in front of the glass plane
      // Spread across the front of the upper, leaving 0.8 margin on each side
      const span = upperW - 1.6;
      for (let i = 0; i < slatCount; i++) {
        const t = (i + 0.5) / slatCount;
        const sx = upperX - upperW / 2 + 0.8 + t * span;
        const slat = new THREE.Mesh(
          new THREE.BoxGeometry(slatW, slatH, slatD),
          woodSlatMat
        );
        slat.position.set(sx, slatY, slatZ);
        scene.add(slat);
      }
    }

    // -------------------------------------------------------------------
    // b019 — Forward balcony with rails on the front of the first upper
    // (cantilevers further out over the deck, gives the cantilever even
    // more drama and adds a usable terrace level).
    // -------------------------------------------------------------------
    {
      const balconyD = 1.6;
      const balconyZ = upperFrontZ + balconyD / 2;
      // Sits just above the lower roof slab (lowerH+0.22 = 6.22) so it
      // reads as a separate floor between the lower roof and the upper.
      const balconyY = lowerH + 0.32;
      // Floor slab
      const balconyFloor = new THREE.Mesh(
        new THREE.BoxGeometry(upperW, 0.14, balconyD),
        villaMat
      );
      balconyFloor.position.set(upperX, balconyY, balconyZ);
      scene.add(balconyFloor);
      // Top rail running the full length of the balcony front
      const railY = balconyY + 1.0;
      const railZ = balconyZ + balconyD / 2 - 0.05;
      const topRail = new THREE.Mesh(
        new THREE.BoxGeometry(upperW, 0.08, 0.08),
        railMat
      );
      topRail.position.set(upperX, railY, railZ);
      scene.add(topRail);
      // Posts every ~1.6 along the balcony front
      const postCount = 18;
      for (let i = 0; i < postCount; i++) {
        const t = (i + 0.5) / postCount;
        const px = upperX - upperW / 2 + t * upperW;
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 1.0, 0.08),
          railMat
        );
        post.position.set(px, balconyY + 0.5, railZ);
        scene.add(post);
      }
    }

    // -------------------------------------------------------------------
    // b019 — Rooftop hot tub on the rooftop terrace (inside the parapet
    // wall on the east half of the first upper roof, where it's protected)
    // -------------------------------------------------------------------
    {
      const tubX = upperX + 5;
      const tubY = upperY + upperH / 2 + 0.16;  // on top of upperRoof slab
      const tubZ = upperZ;
      // Travertine rim
      const tubRim = new THREE.Mesh(
        new THREE.CylinderGeometry(1.85, 1.85, 0.18, 20),
        rimMat
      );
      tubRim.position.set(tubX, tubY + 0.09, tubZ);
      scene.add(tubRim);
      // Water (reuse poolMat for the cyan glow + caustics)
      const tubWater = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.6, 0.20, 20),
        poolMat
      );
      tubWater.position.set(tubX, tubY + 0.18, tubZ);
      scene.add(tubWater);
    }

    // -------------------------------------------------------------------
    // b019 — Spiral exterior staircase on the cylindrical tower (half
    // helix on the front-west side, the part facing AWAY from the villa)
    // -------------------------------------------------------------------
    {
      // The tower constants are local to the tower block, but we have all
      // the pieces here: lowerLeftX, lowerFrontZ. Recompute the same vals.
      const towerR = 3.0;
      const towerH = lowerH + 2.5;
      const towerX = lowerLeftX - towerR + 0.4;
      const towerZ = lowerFrontZ - towerR + 0.6;
      const stepCount = 12;
      const startAngle = Math.PI / 2;     // facing +z (south, the camera side)
      const endAngle   = 3 * Math.PI / 2; // facing -z (north, the back)
      const radius     = towerR + 0.55;
      for (let i = 0; i < stepCount; i++) {
        const t = i / (stepCount - 1);
        const angle = startAngle + t * (endAngle - startAngle);
        const sx = towerX + Math.cos(angle) * radius;
        const sz = towerZ + Math.sin(angle) * radius;
        const sy = 0.4 + t * (towerH - 1.2);
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(0.85, 0.14, 0.55),
          stoneMat
        );
        step.position.set(sx, sy, sz);
        // Tangent to the tower so each step faces outward correctly
        step.rotation.y = -angle + Math.PI / 2;
        scene.add(step);
      }
    }

    // -------------------------------------------------------------------
    // b019 — Grand entrance: stone steps from deck up to podium top in
    // front of the door, plus two big planters with topiary cones flanking.
    // -------------------------------------------------------------------
    {
      const doorX = villaCx - 6.995;
      // 4 steps from y=0 (deck) up to y=0.8 (podium top)
      // Each step is 3.0 wide × 0.2 tall × 0.5 deep
      for (let i = 0; i < 4; i++) {
        const stepY = 0.10 + i * 0.20;
        const stepZ = 0.25 + (3 - i) * 0.55;  // step 0 (lowest) is furthest forward
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(3.0, 0.20, 0.55),
          rimMat
        );
        step.position.set(doorX, stepY, stepZ);
        scene.add(step);
      }
      // Planter boxes flanking the steps
      function addPlanter(px) {
        const planter = new THREE.Mesh(
          new THREE.BoxGeometry(1.0, 1.0, 1.0),
          podiumMat
        );
        planter.position.set(px, 0.5, 1.4);
        scene.add(planter);
        // Dark metal trim band around the top
        const trim = new THREE.Mesh(
          new THREE.BoxGeometry(1.04, 0.06, 1.04),
          railMat
        );
        trim.position.set(px, 1.0, 1.4);
        scene.add(trim);
        // Topiary cone on top
        const cone = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.55, 1.6, 8),
          topiaryMat
        );
        cone.position.set(px, 1.83, 1.4);
        scene.add(cone);
      }
      addPlanter(doorX - 2.4);
      addPlanter(doorX + 2.4);
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

    addPalm(-9.0,  4.0, 6.8);
    addPalm(-7.0, -5.0, 6.0);
    addPalm( 4.0,  5.5, 5.4);
    addPalm( 7.5, -4.5, 6.2);

    // -----------------------------------------------------
    // Deck lanterns — small warm-glow lanterns on the pool deck
    // (b010 — replaces the old sodium streetlamp)
    // -----------------------------------------------------
    const lanternBaseMat = makePS2Material({ color: 0x2a241c });  // dark base
    const lanternGlowMat = makePS2Material({
      color:       0xffd090,
      emissive:    0xffd090,
      emissiveAmt: 2.6,
    });

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
    const garageCz = villaCz - lowerD / 2 - garageD / 2;  // touching villa back wall
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
    function addCar(cx, cz, bodyColorHex, rotY = 0) {
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
      scene.add(g);
    }

    // b014 — Yellow Lambo parked in the driveway, just in front of the
    // garage door (which now faces -z toward the street).
    addCar(garageCx, garageCz - garageD / 2 - 2.8, 0xf5d518);
    // b016 — Pink Lambo rotation flipped (-PI/4 not +PI/4) so hood points
    // toward (-x, +z) — diagonally toward the front-left of the property
    addCar(-14.0, 5.0, 0xff2d95, -Math.PI / 4);

    // Shrub helper (b015) + bigger cluster around pink Lambo (b016)
    const shrubMat = makePS2Material({ color: 0x2a4a25 });
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
        uColor:      { value: new THREE.Color(0x1a0a3e) },
        uHighlight:  { value: new THREE.Color(0x9a3a85) },
        uFogColor:   { value: new THREE.Color(0x40285a) },
        uFogDensity: { value: 0.009 },
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
    const hillMat = makePS2Material({ color: 0x2a3a25 });  // dark grassy green

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

    function addHill(cx, cy, cz, w, h, d) {
      const hill = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hillMat);
      hill.position.set(cx, h / 2 + cy, cz);
      scene.add(hill);
    }
    // Front ridge — wide, overlapping mounds right behind the mansions
    addHill(-55, 0, -85, 60, 14, 24);
    addHill(  0, 0, -92, 90, 20, 28);
    addHill( 55, 0, -85, 60, 15, 24);
    // Mid ridge — taller, deeper
    addHill(-30, 0, -105, 70, 24, 20);
    addHill( 30, 0, -105, 70, 22, 20);
    // Back ridge — the tallest, the silhouette behind everything
    addHill(  0, 0, -120, 120, 28, 24);

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
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          // Faint scanlines (lighter for PS2+ — less noisy at higher res)
          float line = sin(vUv.y * 960.0) * 0.022;
          c.rgb -= line;
          // Subtle vignette
          float v = smoothstep(1.1, 0.4, length(vUv - 0.5));
          c.rgb *= v;
          gl_FragColor = c;
        }
      `,
    });
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial));

    // -----------------------------------------------------
    // Input — b014 proper orbit camera (drag/wheel/pinch)
    // -----------------------------------------------------
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);
    // Hint cursor
    container.style.cursor = 'grab';

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

  function onMouseDown(e) {
    if (!container || e.button !== 0) return;
    isDragging = true;
    lastDragX = e.clientX;
    lastDragY = e.clientY;
    container.style.cursor = 'grabbing';
  }
  function onMouseMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - lastDragX;
    const dy = e.clientY - lastDragY;
    yaw   -= dx * ROTATE_SPEED;
    pitch  = clampPitch(pitch + dy * ROTATE_SPEED);
    lastDragX = e.clientX;
    lastDragY = e.clientY;
  }
  function onMouseUp() {
    isDragging = false;
    if (container) container.style.cursor = 'grab';
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
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    if (onResize) window.removeEventListener('resize', onResize);
    onResize = null;
    if (container) {
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseUp);
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
