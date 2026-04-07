/* =========================================================
   WORLD.JS — Villa view (PS2-style 3D night Miami scene)
   b003 — Phase 2: villa cube + windows, more palms, ocean,
   moon, distant skyline, pool ripples, warm window light.
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
  const LOW_W = 480;
  const LOW_H = 270;

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
    renderer.setClearColor(0x140828, 1);

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x3a1a55, 0.014);

    camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 250);
    camera.position.set(3, 4.5, 14);
    camera.lookAt(3, 1.6, 0);

    // -----------------------------------------------------
    // Sky dome — gradient + procedural stars + moon disc
    // -----------------------------------------------------
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor:    { value: new THREE.Color(0x1a1e4a) },
        midColor:    { value: new THREE.Color(0x6a1f95) },
        bottomColor: { value: new THREE.Color(0xc8358f) },
        moonDir:     { value: new THREE.Vector3(0.35, 0.35, -0.75).normalize() },
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
        uniform vec3 moonDir;
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

          // Stars (upper hemisphere only)
          if (h > 0.05) {
            vec2 sp = vec2(atan(vDir.z, vDir.x) * 80.0, h * 80.0);
            float n = hash(floor(sp));
            float star = step(0.992, n) * smoothstep(0.05, 0.4, h);
            col += vec3(star * 0.95);
          }

          // Moon disc + soft halo
          float m = dot(vDir, moonDir);
          float disc = smoothstep(0.9970, 0.9985, m);
          float halo = smoothstep(0.93, 0.999, m) * 0.45;
          col += vec3(0.96, 0.93, 1.0) * (disc + halo);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(110, 24, 16), skyMat));
    materials.push(skyMat);

    // -----------------------------------------------------
    // Light constants — passed manually as shader uniforms
    // -----------------------------------------------------
    const lampPos     = new THREE.Vector3(7.5, 5.0, 4.0);
    const lampColor   = new THREE.Color(0xff8c42);  // sodium orange
    const lampRange   = 28;
    const poolPos     = new THREE.Vector3(0, 0.4, 0);
    const poolColor   = new THREE.Color(0x2af0d0);  // turquoise
    const poolRange   = 14;
    const windowPos   = new THREE.Vector3(11.5, 3.5, 0);
    const windowColor = new THREE.Color(0xffe6c8);  // warm interior, paler
    const windowRange = 14;

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
          uFogColor:     { value: new THREE.Color(0x3a1a55) },
          uFogDensity:   { value: 0.014 },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vWorldPos;
          varying float vFogDepth;
          void main() {
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            vFogDepth = -mvPos.z;
            vec4 clip = projectionMatrix * mvPos;
            // PS2 vertex jitter
            vec2 grid = vec2(160.0, 90.0);
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
            vec3 ambient = vec3(0.22, 0.20, 0.36);
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
    // Ground (concrete patio)
    // -----------------------------------------------------
    const groundMat = makePS2Material({ color: 0x5a5560 });
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
        uBaseColor:   { value: new THREE.Color(0x0fb5b5) },
        uBrightColor: { value: new THREE.Color(0x8effe8) },
        uFogColor:    { value: new THREE.Color(0x3a1a55) },
        uFogDensity:  { value: 0.014 },
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
          // Boost so it reads as a glowing pool
          col *= mix(0.8, 3.0, vTopMask);
          float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
          col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    materials.push(poolMat);
    timeUniforms.push(poolMat.uniforms.uTime);

    const pool = new THREE.Mesh(new THREE.BoxGeometry(8, 0.18, 5, 12, 1, 8), poolMat);
    pool.position.set(0, 0.09, 0);
    scene.add(pool);

    // Pool concrete rim
    const rimMat = makePS2Material({ color: 0x4a4555 });
    const rim = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.2, 5.6), rimMat);
    rim.position.set(0, 0.05, 0);
    scene.add(rim);

    // -----------------------------------------------------
    // Villa — Miami millionaire mansion: 3 stories w/ penthouse,
    // cantilever roofs, big glass walls, deeper balcony
    // -----------------------------------------------------
    const villaMat   = makePS2Material({ color: 0xa8a4b2 });   // bright cool concrete
    const roofMat    = makePS2Material({ color: 0x5a5666 });   // darker concrete slab
    const balconyMat = makePS2Material({ color: 0x6a6676 });
    const railMat    = makePS2Material({ color: 0x2a2632 });

    const villaCx = 12;
    const villaCz = 0;

    // Lower main volume — bigger and more imposing
    const lowerW = 17, lowerH = 4.0, lowerD = 10;
    const lower = new THREE.Mesh(new THREE.BoxGeometry(lowerW, lowerH, lowerD), villaMat);
    lower.position.set(villaCx, lowerH / 2, villaCz);
    scene.add(lower);

    // Cantilever roof slab over the lower volume
    const lowerRoof = new THREE.Mesh(new THREE.BoxGeometry(lowerW + 1.8, 0.35, lowerD + 1.8), roofMat);
    lowerRoof.position.set(villaCx, lowerH + 0.175, villaCz);
    scene.add(lowerRoof);

    // Upper volume — second story, set back slightly
    const upperW = 11, upperH = 3.5, upperD = 6.5;
    const upperY = lowerH + 0.35 + upperH / 2;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(upperW, upperH, upperD), villaMat);
    upper.position.set(villaCx + 0.5, upperY, villaCz - 0.7);
    scene.add(upper);

    // Upper roof slab
    const upperRoof = new THREE.Mesh(new THREE.BoxGeometry(upperW + 1.2, 0.35, upperD + 1.2), roofMat);
    upperRoof.position.set(villaCx + 0.5, upperY + upperH / 2 + 0.175, villaCz - 0.7);
    scene.add(upperRoof);

    // Penthouse — third story, smaller, set back further
    const phW = 6, phH = 2.6, phD = 4.5;
    const phY = upperY + upperH / 2 + 0.35 + phH / 2;
    const penthouse = new THREE.Mesh(new THREE.BoxGeometry(phW, phH, phD), villaMat);
    penthouse.position.set(villaCx + 1, phY, villaCz - 1.5);
    scene.add(penthouse);

    // Penthouse roof slab
    const phRoof = new THREE.Mesh(new THREE.BoxGeometry(phW + 1, 0.3, phD + 1), roofMat);
    phRoof.position.set(villaCx + 1, phY + phH / 2 + 0.15, villaCz - 1.5);
    scene.add(phRoof);

    // Glowing glass — single material reused on all openings
    const windowMat = makePS2Material({
      color:       0xffe6c8,
      emissive:    0xffd6a0,
      emissiveAmt: 1.8,
    });

    // Big glass wall on the -X face of the lower volume (facing pool)
    const lowerFrontX = villaCx - lowerW / 2;
    const lowerGlass = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.0, lowerD - 1.2), windowMat);
    lowerGlass.position.set(lowerFrontX - 0.06, lowerH / 2 + 0.3, villaCz);
    scene.add(lowerGlass);

    // Glass strip on the +Z face of the lower volume (camera side)
    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(lowerW - 3.0, 2.0, 0.12), windowMat);
    sideGlass.position.set(villaCx, lowerH / 2 + 0.4, villaCz + lowerD / 2 + 0.06);
    scene.add(sideGlass);

    // Glass strip on the -X face of the upper volume
    const upperFrontX = (villaCx + 0.5) - upperW / 2;
    const upperGlass = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, upperD - 1.2), windowMat);
    upperGlass.position.set(upperFrontX - 0.06, upperY + 0.1, villaCz - 0.7);
    scene.add(upperGlass);

    // Penthouse glass on the -X face
    const phFrontX = (villaCx + 1) - phW / 2;
    const phGlass = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, phD - 0.8), windowMat);
    phGlass.position.set(phFrontX - 0.06, phY, villaCz - 1.5);
    scene.add(phGlass);

    // Balcony floor extending forward (+z) from the upper volume
    const balcony = new THREE.Mesh(new THREE.BoxGeometry(upperW, 0.18, 2.0), balconyMat);
    balcony.position.set(villaCx + 0.5, lowerH + 0.6, villaCz - 0.7 + upperD / 2 + 1.0);
    scene.add(balcony);

    // Balcony top rail
    const railTop = new THREE.Mesh(new THREE.BoxGeometry(upperW, 0.08, 0.08), railMat);
    railTop.position.set(villaCx + 0.5, lowerH + 0.6 + 1.0, villaCz - 0.7 + upperD / 2 + 1.95);
    scene.add(railTop);

    // Balcony vertical railing posts
    for (let i = 0; i < 9; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), railMat);
      post.position.set(
        villaCx + 0.5 - upperW / 2 + 0.5 + i * (upperW - 1.0) / 8,
        lowerH + 0.6 + 0.5,
        villaCz - 0.7 + upperD / 2 + 1.95
      );
      scene.add(post);
    }

    // Door — taller glowing rectangle at ground level on the front
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.13, 2.2, 1.3), windowMat);
    door.position.set(lowerFrontX - 0.07, 1.1, villaCz + 2.5);
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
    // Streetlamp mesh — gives the sodium light a visible source
    // -----------------------------------------------------
    {
      const poleMat = makePS2Material({ color: 0x0e0a0e });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 5.5, 5), poleMat);
      pole.position.set(lampPos.x, 2.75, lampPos.z);
      scene.add(pole);

      const bulbMat = makePS2Material({
        color:       0xffaa55,
        emissive:    0xffaa55,
        emissiveAmt: 2.4,
      });
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), bulbMat);
      bulb.position.set(lampPos.x, lampPos.y, lampPos.z);
      scene.add(bulb);

      const shadeMat = makePS2Material({ color: 0x1e1418 });
      const shade = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.14, 0.75), shadeMat);
      shade.position.set(lampPos.x, lampPos.y + 0.34, lampPos.z);
      scene.add(shade);
    }

    // -----------------------------------------------------
    // Garage — attached wing on the +X side of villa, scaled up
    // -----------------------------------------------------
    const garageW = 6.0, garageH = 3.5, garageD = 8.0;
    const garageCx = villaCx + lowerW / 2 + garageW / 2 - 0.05;
    {
      const garage = new THREE.Mesh(new THREE.BoxGeometry(garageW, garageH, garageD), villaMat);
      garage.position.set(garageCx, garageH / 2, 0);
      scene.add(garage);

      // Garage roof slab (slight overhang)
      const garageRoof = new THREE.Mesh(
        new THREE.BoxGeometry(garageW + 0.8, 0.3, garageD + 0.8),
        roofMat
      );
      garageRoof.position.set(garageCx, garageH + 0.15, 0);
      scene.add(garageRoof);

      // Glowing garage door on the +Z face (camera side)
      const garageDoor = new THREE.Mesh(
        new THREE.BoxGeometry(garageW - 0.7, garageH - 0.6, 0.12),
        windowMat
      );
      garageDoor.position.set(garageCx, (garageH - 0.6) / 2 + 0.05, garageD / 2 + 0.06);
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

    // Yellow Lambo parked in front of the (bigger) garage door
    addCar(garageCx, 7.0, 0xf5d518);
    // Pink Lambo parked next to the pool on the front-left
    addCar(-7.0, 4.0, 0xff2d95);

    // -----------------------------------------------------
    // Lagoon — small secondary water with sand, island, mini palm
    // -----------------------------------------------------
    {
      const lagoonCx = -7;
      const lagoonCz = -2;

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
    // Greenery — hedges + scattered bushes
    // -----------------------------------------------------
    const hedgeMat = makePS2Material({ color: 0x1a3a25 });

    // Long hedge along the back of the property
    {
      const h = new THREE.Mesh(new THREE.BoxGeometry(28, 0.85, 0.85), hedgeMat);
      h.position.set(8, 0.42, -8.5);
      scene.add(h);
    }
    // Side hedge on the -X edge
    {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 14), hedgeMat);
      h.position.set(-13, 0.42, -1);
      scene.add(h);
    }
    // Front hedge between pool and camera
    {
      const h = new THREE.Mesh(new THREE.BoxGeometry(10, 0.7, 0.7), hedgeMat);
      h.position.set(0, 0.35, 7.6);
      scene.add(h);
    }

    function addBush(x, z, size) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.7, size), hedgeMat);
      b.position.set(x, size * 0.35, z);
      scene.add(b);
    }
    addBush(-5,  -7.0, 0.9);
    addBush(-3,  -8.0, 1.1);
    addBush(30,  -6.0, 1.0);
    addBush(32,  -7.0, 0.8);
    addBush( 2,   7.0, 0.85);
    addBush(-1,   7.6, 0.7);
    addBush(33,   7.0, 0.9);
    addBush(36,   3.0, 0.85);

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

    // Around the pool deck
    addPathLight(-5,   3.5, 0x00d4ff); // cyan
    addPathLight(-5,  -3.5, 0xff2d95); // magenta
    addPathLight( 5,   3.5, 0xa44fff); // purple
    addPathLight( 5,  -3.5, 0xffaa55); // warm
    // Driveway / garage path (moved past the bigger garage)
    addPathLight(28,   5.5, 0x00d4ff);
    addPathLight(30,   7.5, 0xa44fff);
    addPathLight(34,   6.0, 0xff2d95);
    addPathLight(35,   0.0, 0xffaa55);
    // Property entry side
    addPathLight(-12,  5.0, 0x00d4ff);
    addPathLight(-12,  0.0, 0xa44fff);
    addPathLight(-12, -5.0, 0xff2d95);
    // Beach approach (where the patio meets the sand)
    addPathLight(-15,  8.0, 0x00d4ff);
    addPathLight(-25,  0.0, 0xa44fff);

    // -----------------------------------------------------
    // Ocean — far plane beyond the property
    // -----------------------------------------------------
    const oceanMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:       { value: 0 },
        uColor:      { value: new THREE.Color(0x14082e) },
        uHighlight:  { value: new THREE.Color(0x5a2080) },
        uFogColor:   { value: new THREE.Color(0x3a1a55) },
        uFogDensity: { value: 0.014 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vFogDepth;
        void main() {
          vUv = uv;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vFogDepth = -mvPos.z;
          vec4 clip = projectionMatrix * mvPos;
          vec2 grid = vec2(160.0, 90.0);
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

    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(220, 70, 40, 12), oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, -0.02, -50);
    scene.add(ocean);

    // Side ocean — extends the ocean to the LEFT of the property
    // (reuses the same shader/material as the back ocean)
    const sideOcean = new THREE.Mesh(new THREE.PlaneGeometry(60, 90, 30, 18), oceanMat);
    sideOcean.rotation.x = -Math.PI / 2;
    sideOcean.position.set(-90, -0.05, 0);
    scene.add(sideOcean);

    // -----------------------------------------------------
    // Beach — sand stretching from property's left edge to the side ocean
    // -----------------------------------------------------
    {
      const beachMat = makePS2Material({ color: 0xc0a878 });
      const beach = new THREE.Mesh(new THREE.PlaneGeometry(43, 60, 16, 16), beachMat);
      beach.rotation.x = -Math.PI / 2;
      beach.position.set(-38.5, 0.04, 0);
      scene.add(beach);
    }

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

    // 5 neighbor villas spread across the right side at varying scales
    addNeighborVilla(40,   8, 1.0);
    addNeighborVilla(48,  -2, 1.1);
    addNeighborVilla(46, -14, 0.9);
    addNeighborVilla(58,   5, 1.2);
    addNeighborVilla(55, -18, 1.0);

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
            vec2 grid = vec2(160.0, 90.0);
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
          // Faint scanlines
          float line = sin(vUv.y * 540.0) * 0.035;
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

  // Orbit around the visual center between pool and villa
  const CAM_CENTER_X = 4;
  const CAM_CENTER_Z = 0;
  const CAM_RADIUS = 22;

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
    camera.position.y = 7.0 + pitch * 12;
    camera.lookAt(CAM_CENTER_X, 2.8 + pitch * 3, CAM_CENTER_Z);

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
