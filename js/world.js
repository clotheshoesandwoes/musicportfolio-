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
  let mouseX = 0, mouseY = 0;
  let yaw = 0, pitch = 0;
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

    camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 250);
    camera.position.set(-2, 5, 16);
    camera.lookAt(0, 3.2, -2);

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
    const lampPos     = new THREE.Vector3(0, 0.6, 6.4);  // middle deck lantern
    const lampColor   = new THREE.Color(0xffc080);  // warm lantern, not sodium
    const lampRange   = 18;
    const poolPos     = new THREE.Vector3(0, 0.4, 4);  // long pool centerpoint
    const poolColor   = new THREE.Color(0x40fff0);  // brighter cyan glow
    const poolRange   = 22;
    const windowPos   = new THREE.Vector3(0, 3.5, -10);  // inside the villa
    const windowColor = new THREE.Color(0xffd090);  // richer warm interior
    const windowRange = 22;

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
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 80, 60, 40), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
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

    // Long infinity-edge pool, runs along the front of the villa (X axis)
    const pool = new THREE.Mesh(new THREE.BoxGeometry(14, 0.2, 4, 20, 1, 8), poolMat);
    pool.position.set(0, 0.10, 4);
    scene.add(pool);

    // Pool concrete rim — white travertine, matches the villa
    const rimMat = makePS2Material({ color: 0xe8e4dc });
    const rim = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.22, 4.6), rimMat);
    rim.position.set(0, 0.06, 4);
    scene.add(rim);

    // -----------------------------------------------------
    // Villa — modernist 2-story stacked white box w/ cantilever
    // upper, stacked stone column accents, FTG glass walls
    // (b010 redesign per Mykonos/Miami reference photos)
    // -----------------------------------------------------
    const villaMat   = makePS2Material({ color: 0xeeeae0 });   // white plaster
    const roofMat    = makePS2Material({ color: 0xe0dcd0 });   // thin slab, slightly darker
    const stoneMat   = makePS2Material({ color: 0x8a847a });   // stacked natural stone
    const coveMat    = makePS2Material({                       // recessed cove light
      color:       0xffd090,
      emissive:    0xffd090,
      emissiveAmt: 2.2,
    });

    const villaCx = 0;
    const villaCz = -10;

    // Lower volume — wide, shallow, the main living box
    const lowerW = 20, lowerH = 4.0, lowerD = 11;
    const lower = new THREE.Mesh(new THREE.BoxGeometry(lowerW, lowerH, lowerD), villaMat);
    lower.position.set(villaCx, lowerH / 2, villaCz);
    scene.add(lower);

    // Lower roof slab — thin, slightly oversized
    const lowerRoof = new THREE.Mesh(new THREE.BoxGeometry(lowerW + 0.6, 0.22, lowerD + 0.6), roofMat);
    lowerRoof.position.set(villaCx, lowerH + 0.11, villaCz);
    scene.add(lowerRoof);

    // Upper volume — narrower, set back on the rear, hangs forward
    // over the pool deck (the signature cantilever)
    const upperW = 13, upperH = 3.5, upperD = 7;
    const upperY = lowerH + 0.22 + upperH / 2;
    // Set back 1.5 on the rear (-z) so it overhangs the front (+z) by 1.0
    const upperZ = villaCz + 1.0;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(upperW, upperH, upperD), villaMat);
    upper.position.set(villaCx, upperY, upperZ);
    scene.add(upper);

    // Upper roof slab — VERY thin, wider than upper (the floating slab look)
    const upperRoof = new THREE.Mesh(new THREE.BoxGeometry(upperW + 1.5, 0.20, upperD + 1.5), roofMat);
    upperRoof.position.set(villaCx, upperY + upperH / 2 + 0.10, upperZ);
    scene.add(upperRoof);

    // Recessed cove light strip on the underside of the upper cantilever,
    // glowing down onto the pool deck — warm, sells the warm/cool contrast
    const coveZ = upperZ + upperD / 2;  // front edge of upper volume
    const cove = new THREE.Mesh(
      new THREE.BoxGeometry(upperW - 0.6, 0.06, 0.6),
      coveMat
    );
    cove.position.set(villaCx, lowerH + 0.28, coveZ - 0.3);
    scene.add(cove);

    // Glowing glass — single warm material reused on all openings
    const windowMat = makePS2Material({
      color:       0xffd090,
      emissive:    0xffc880,
      emissiveAmt: 2.0,
    });

    // ---- Stacked stone column accents on the front face of lower volume ----
    // Three columns break up the long white wall and read as the photo's
    // signature stone-cladding move
    const stoneColW = 1.2, stoneColH = lowerH, stoneColD = 0.6;
    const lowerFrontZ = villaCz + lowerD / 2;
    const colXs = [-7.5, 0, 7.5];
    colXs.forEach(cx => {
      const col = new THREE.Mesh(
        new THREE.BoxGeometry(stoneColW, stoneColH, stoneColD),
        stoneMat
      );
      col.position.set(villaCx + cx, stoneColH / 2, lowerFrontZ + stoneColD / 2);
      scene.add(col);
    });

    // ---- Floor-to-ceiling glass on the front of the lower volume ----
    // Two large glass panes filling the gaps between the stone columns
    function addLowerGlass(cx, width) {
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(width, lowerH - 0.4, 0.10),
        windowMat
      );
      glass.position.set(villaCx + cx, lowerH / 2, lowerFrontZ + 0.05);
      scene.add(glass);
    }
    addLowerGlass(-3.75, 6.3);  // between left and middle column
    addLowerGlass( 3.75, 6.3);  // between middle and right column

    // ---- Floor-to-ceiling glass on the front of the upper volume ----
    const upperFrontZ = upperZ + upperD / 2;
    const upperGlass = new THREE.Mesh(
      new THREE.BoxGeometry(upperW - 1.0, upperH - 0.5, 0.10),
      windowMat
    );
    upperGlass.position.set(villaCx, upperY, upperFrontZ + 0.05);
    scene.add(upperGlass);

    // ---- Side glass strip on the camera-facing edge of upper volume ----
    // (catches the eye when orbiting around the side)
    const upperSideGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, upperH - 0.5, upperD - 1.0),
      windowMat
    );
    upperSideGlass.position.set(villaCx + upperW / 2 + 0.05, upperY, upperZ);
    scene.add(upperSideGlass);

    // ---- Recessed front door — taller glowing rectangle, slightly inset ----
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.10), windowMat);
    door.position.set(villaCx - 5.0, 1.2, lowerFrontZ + 0.08);
    scene.add(door);

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

    // Four lanterns along the front edge of the pool deck
    addDeckLantern(-6.0, 6.4);
    addDeckLantern(-2.0, 6.4);
    addDeckLantern( 2.0, 6.4);
    addDeckLantern( 6.0, 6.4);

    // -----------------------------------------------------
    // Garage — attached wing on the +X side of villa, scaled up
    // -----------------------------------------------------
    const garageW = 6.0, garageH = 3.5, garageD = 8.0;
    const garageCx = villaCx + lowerW / 2 + garageW / 2 - 0.05;
    {
      const garage = new THREE.Mesh(new THREE.BoxGeometry(garageW, garageH, garageD), villaMat);
      garage.position.set(garageCx, garageH / 2, villaCz);
      scene.add(garage);

      // Garage roof slab (slight overhang)
      const garageRoof = new THREE.Mesh(
        new THREE.BoxGeometry(garageW + 0.8, 0.3, garageD + 0.8),
        roofMat
      );
      garageRoof.position.set(garageCx, garageH + 0.15, villaCz);
      scene.add(garageRoof);

      // Glowing garage door on the +Z face (camera side)
      const garageDoor = new THREE.Mesh(
        new THREE.BoxGeometry(garageW - 0.7, garageH - 0.6, 0.12),
        windowMat
      );
      garageDoor.position.set(garageCx, (garageH - 0.6) / 2 + 0.05, villaCz + garageD / 2 + 0.06);
      scene.add(garageDoor);
    }

    // -----------------------------------------------------
    // Lambo — yellow wedge supercar parked on the driveway
    // -----------------------------------------------------
    function addCar(cx, cz, bodyColorHex) {
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

      // Main body — long along z, low and wide
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.55, 4.4), bodyMat);
      body.position.set(cx, 0.55, cz);
      scene.add(body);

      // Hood wedge (smaller box on top toward the front)
      const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 1.7), bodyMat);
      hood.position.set(cx, 0.93, cz + 1.1);
      scene.add(hood);

      // Cabin — slightly back from center
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.42, 1.8), cabMat);
      cab.position.set(cx, 1.05, cz - 0.4);
      scene.add(cab);

      // Wheels — 4 dark squat boxes at the corners
      const wheelOffsets = [
        [-0.97,  1.6],
        [ 0.97,  1.6],
        [-0.97, -1.6],
        [ 0.97, -1.6],
      ];
      wheelOffsets.forEach(([dx, dz]) => {
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.55, 0.78), wheelMat);
        w.position.set(cx + dx, 0.27, cz + dz);
        scene.add(w);
      });

      // Headlights (front, +z end)
      [-0.55, 0.55].forEach(dx => {
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 0.08), headlightMat);
        h.position.set(cx + dx, 0.78, cz + 2.22);
        scene.add(h);
      });

      // Taillights (rear, -z end)
      [-0.55, 0.55].forEach(dx => {
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.08), taillightMat);
        t.position.set(cx + dx, 0.78, cz - 2.22);
        scene.add(t);
      });
    }

    // Yellow Lambo parked in front of the garage door (z just past the door)
    addCar(garageCx, villaCz + garageD / 2 + 2.5, 0xf5d518);
    // Pink Lambo — moved further left + forward in b010 to clear the new wider pool
    addCar(-11.0, 9.0, 0xff2d95);

    // -----------------------------------------------------
    // Lagoon — small secondary water with sand, island, mini palm
    // -----------------------------------------------------
    {
      // Moved further left in b010 to clear the new wider pool + boulder line
      const lagoonCx = -14;
      const lagoonCz = -3;

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

    // Cluster between pool back (z=2) and villa front (z=-4.5)
    addBoulder(-6.5, 0.8, 0.55);
    addBoulder(-3.5, 1.0, 0.42);
    addBoulder( 0.0, 0.8, 0.50);
    addBoulder( 3.5, 1.0, 0.45);
    addBoulder( 6.5, 0.8, 0.55);
    // Outboard, beyond the pool ends
    addBoulder(-9.0, 4.0, 0.60);
    addBoulder( 9.0, 4.0, 0.55);
    // Scattered around the villa front corners
    addBoulder(-11.5, -3.0, 0.70);
    addBoulder( 11.5, -3.0, 0.65);
    addBoulder(-11.5,  4.5, 0.50);

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

    // Three daybeds along the front edge of the pool deck, slotted between
    // the deck lanterns (lanterns at x=-6,-2,2,6 — daybeds at -4,0,4)
    addDaybed(-4.0, 7.5, 0);
    addDaybed( 0.0, 7.5, 0);
    addDaybed( 4.0, 7.5, 0);

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

    // Around the pool deck (long pool x:-7..7, daybeds at front z=7.5)
    addPathLight(-8.5, 8.8, 0x00d4ff); // cyan, front-left, outboard of daybeds
    addPathLight(-8.5,-1.2, 0xff2d95); // magenta, back-left, behind boulder line
    addPathLight( 8.5, 8.8, 0xa44fff); // purple, front-right, outboard of daybeds
    addPathLight( 8.5,-1.2, 0xffaa55); // warm, back-right, behind boulder line
    // Driveway between the pool area and the new garage
    addPathLight( 8,  -3.0, 0x00d4ff);
    addPathLight(15,  -3.0, 0xa44fff);
    addPathLight( 8,  -8.0, 0xff2d95);
    addPathLight(16,  -8.0, 0xffaa55);
    // Left side of property (along the side of the house)
    addPathLight(-12,  5.0, 0x00d4ff);
    addPathLight(-12,  0.0, 0xa44fff);
    addPathLight(-12, -8.0, 0xff2d95);
    // Beach approach — path that leads from the side of the house to the beach
    addPathLight(-12, -16.0, 0x00d4ff);
    addPathLight( 12, -16.0, 0xa44fff);

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

    // Back ocean — pushed further back (was z=-50, beach is now at z=-30)
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(260, 70, 40, 12), oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, -0.02, -75);
    scene.add(ocean);

    // -----------------------------------------------------
    // Beach — sand BEHIND the house, between house back and ocean
    // -----------------------------------------------------
    const beachMat = makePS2Material({ color: 0xc0a878 });
    const beachCx = 0;
    const beachCz = -30;
    const beachW  = 50;
    const beachD  = 30;
    {
      const beach = new THREE.Mesh(new THREE.PlaneGeometry(beachW, beachD, 20, 12), beachMat);
      beach.rotation.x = -Math.PI / 2;
      beach.position.set(beachCx, 0.04, beachCz);
      scene.add(beach);
    }

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

    // 2 lounger setups + a couple of solo chairs
    addBeachUmbrella(-7, -25, 0xff5fa0);
    addBeachChair  (-8, -27, 0.1);
    addBeachChair  (-6, -27, -0.1);

    addBeachUmbrella( 7, -25, 0xffa040);
    addBeachChair  ( 8, -27, 0.1);
    addBeachChair  ( 6, -27, -0.1);

    // Couple of solo chairs further out
    addBeachChair  (-2, -34,  0.0);
    addBeachChair  ( 2, -34,  0.0);

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

    // 5 neighbor villas flanking the property along its sides
    addNeighborVilla(-28,  -8, 1.0);
    addNeighborVilla( 28,  -8, 1.1);
    addNeighborVilla(-32,   5, 0.9);
    addNeighborVilla( 32,   5, 1.2);
    addNeighborVilla(-30, -25, 1.0);

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
    for (let i = 0; i < 32; i++) {
      const mat = skylineMats[i % skylineMats.length];
      const xrange = (i / 32 - 0.5) * 200;
      const yjit = 0.6 + Math.abs(Math.sin(i * 1.7)) * 0.5 + Math.abs(Math.sin(i * 3.3)) * 1.4;
      const tall = 0.4 + Math.abs(Math.sin(i * 2.1)) * 1.2;
      const dot = new THREE.Mesh(new THREE.BoxGeometry(0.55, tall, 0.55), mat);
      dot.position.set(xrange, yjit, -78);
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
    // Input
    // -----------------------------------------------------
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('touchmove', onTouchMove, { passive: true });

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

  function onMouseMove(e) {
    if (!container) return;
    const r = container.getBoundingClientRect();
    mouseX = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouseY = ((e.clientY - r.top) / r.height) * 2 - 1;
  }

  function onTouchMove(e) {
    if (!container) return;
    const t = e.touches[0];
    if (!t) return;
    const r = container.getBoundingClientRect();
    mouseX = ((t.clientX - r.left) / r.width) * 2 - 1;
    mouseY = ((t.clientY - r.top) / r.height) * 2 - 1;
  }

  // Orbit around the visual center of the new layout
  // (long pool at z=4, villa at z=-10 — center is just in front of villa)
  const CAM_CENTER_X = 0;
  const CAM_CENTER_Z = -2;
  const CAM_RADIUS = 20;

  function animate(now) {
    if (destroyed || !renderer) return;
    animId = requestAnimationFrame(animate);

    const elapsed = (now || 0) / 1000;
    for (let i = 0; i < timeUniforms.length; i++) {
      timeUniforms[i].value = elapsed;
    }

    // Position-based orbit — full ±180° yaw, ±34° pitch
    const targetYaw = -mouseX * Math.PI;
    const targetPitch = -mouseY * 0.6;
    yaw += (targetYaw - yaw) * 0.05;
    pitch += (targetPitch - pitch) * 0.05;

    camera.position.x = CAM_CENTER_X + Math.sin(yaw) * CAM_RADIUS;
    camera.position.z = CAM_CENTER_Z + Math.cos(yaw) * CAM_RADIUS;
    camera.position.y = 7.5 + pitch * 13;
    camera.lookAt(CAM_CENTER_X, 3.2 + pitch * 3, CAM_CENTER_Z);

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
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('touchmove', onTouchMove);
    }
    materials.forEach(m => m.dispose && m.dispose());
    materials = [];
    timeUniforms = [];
    if (lowResTarget) { lowResTarget.dispose(); lowResTarget = null; }
    if (postMaterial) { postMaterial.dispose(); postMaterial = null; }
    if (renderer) { renderer.dispose(); renderer = null; }
    scene = camera = postScene = postCamera = canvas = container = null;
    yaw = pitch = mouseX = mouseY = 0;
  }

  registerView('villa', { init, destroy });
})();
