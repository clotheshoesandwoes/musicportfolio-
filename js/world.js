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
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60, 40, 40), groundMat);
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
    // Villa — modernist beach house: wide & low, cantilever
    // roof, big glass walls, balcony with railing
    // -----------------------------------------------------
    const villaMat   = makePS2Material({ color: 0xa8a4b2 });   // bright cool concrete
    const roofMat    = makePS2Material({ color: 0x5a5666 });   // darker concrete slab
    const balconyMat = makePS2Material({ color: 0x6a6676 });
    const railMat    = makePS2Material({ color: 0x2a2632 });

    const villaCx = 12;
    const villaCz = 0;

    // Lower main volume — wide and low
    const lowerW = 13, lowerH = 3.2, lowerD = 7;
    const lower = new THREE.Mesh(new THREE.BoxGeometry(lowerW, lowerH, lowerD), villaMat);
    lower.position.set(villaCx, lowerH / 2, villaCz);
    scene.add(lower);

    // Cantilever roof slab over the lower volume
    const lowerRoof = new THREE.Mesh(new THREE.BoxGeometry(lowerW + 1.6, 0.3, lowerD + 1.6), roofMat);
    lowerRoof.position.set(villaCx, lowerH + 0.15, villaCz);
    scene.add(lowerRoof);

    // Upper volume — smaller, set back
    const upperW = 8, upperH = 2.8, upperD = 5;
    const upperY = lowerH + 0.3 + upperH / 2;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(upperW, upperH, upperD), villaMat);
    upper.position.set(villaCx + 0.5, upperY, villaCz - 0.6);
    scene.add(upper);

    // Upper roof slab
    const upperRoof = new THREE.Mesh(new THREE.BoxGeometry(upperW + 1, 0.3, upperD + 1), roofMat);
    upperRoof.position.set(villaCx + 0.5, upperY + upperH / 2 + 0.15, villaCz - 0.6);
    scene.add(upperRoof);

    // Glowing glass — single material reused on all openings
    const windowMat = makePS2Material({
      color:       0xffe6c8,
      emissive:    0xffd6a0,
      emissiveAmt: 1.8,
    });

    // Big glass wall on the -X face of the lower volume (facing pool)
    const lowerFrontX = villaCx - lowerW / 2;
    const lowerGlass = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, lowerD - 1.2), windowMat);
    lowerGlass.position.set(lowerFrontX - 0.06, lowerH / 2 + 0.2, villaCz);
    scene.add(lowerGlass);

    // Glass strip on the +Z face of the lower volume (camera side)
    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(lowerW - 2.5, 1.6, 0.12), windowMat);
    sideGlass.position.set(villaCx, lowerH / 2 + 0.3, villaCz + lowerD / 2 + 0.06);
    scene.add(sideGlass);

    // Glass strip on the -X face of the upper volume
    const upperFrontX = (villaCx + 0.5) - upperW / 2;
    const upperGlass = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, upperD - 1.0), windowMat);
    upperGlass.position.set(upperFrontX - 0.06, upperY + 0.1, villaCz - 0.6);
    scene.add(upperGlass);

    // Balcony floor extending forward (+z) from the upper volume
    const balcony = new THREE.Mesh(new THREE.BoxGeometry(upperW, 0.15, 1.8), balconyMat);
    balcony.position.set(villaCx + 0.5, lowerH + 0.55, villaCz - 0.6 + upperD / 2 + 0.9);
    scene.add(balcony);

    // Balcony top rail
    const railTop = new THREE.Mesh(new THREE.BoxGeometry(upperW, 0.08, 0.08), railMat);
    railTop.position.set(villaCx + 0.5, lowerH + 0.55 + 1.0, villaCz - 0.6 + upperD / 2 + 1.7);
    scene.add(railTop);

    // Balcony vertical railing posts
    for (let i = 0; i < 8; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), railMat);
      post.position.set(
        villaCx + 0.5 - upperW / 2 + 0.4 + i * (upperW - 0.8) / 7,
        lowerH + 0.55 + 0.5,
        villaCz - 0.6 + upperD / 2 + 1.7
      );
      scene.add(post);
    }

    // Door — slim glowing rectangle at ground level on the front
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.8, 1.0), windowMat);
    door.position.set(lowerFrontX - 0.07, 0.9, villaCz + 1.6);
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
  const CAM_CENTER_X = 3;
  const CAM_CENTER_Z = 0;
  const CAM_RADIUS = 16;

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
    camera.position.y = 5.0 + pitch * 9;
    camera.lookAt(CAM_CENTER_X, 1.8 + pitch * 2.5, CAM_CENTER_Z);

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
