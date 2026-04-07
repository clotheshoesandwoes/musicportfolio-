/* =========================================================
   WORLD.JS — Villa view (PS2-style 3D night Miami scene)
   Phase 1: shader proof-of-concept. Sky + pool + palm + lighting.
   Three.js loaded lazily from CDN on first activation.
   ========================================================= */

(function() {
  let container, canvas, renderer, scene, camera, animId;
  let lowResTarget, postScene, postCamera, postMaterial;
  let onResize, destroyed = false;
  let mouseX = 0, mouseY = 0;
  let yaw = 0, pitch = 0;
  let materials = [];
  let THREE_lib = null;
  const LOW_W = 480;
  const LOW_H = 270;

  async function init(cont) {
    container = cont;
    destroyed = false;

    // Loader overlay while we fetch Three.js
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

    // Canvas
    canvas = document.createElement('canvas');
    canvas.className = 'world-canvas';
    container.appendChild(canvas);

    // Renderer (no AA, no DPR scaling — period-accurate)
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.setClearColor(0x0a0e2e, 1);

    // Scene + heavy night fog
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1a0a3e, 0.022);

    // Camera
    camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 200);
    camera.position.set(0, 4, 12);
    camera.lookAt(0, 1, 0);

    // -----------------------------------------------------
    // Sky dome — gradient + procedural stars
    // -----------------------------------------------------
    const skyGeo = new THREE.SphereGeometry(100, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor:    { value: new THREE.Color(0x05071a) },
        midColor:    { value: new THREE.Color(0x1a0a3e) },
        bottomColor: { value: new THREE.Color(0x4a1a5e) },
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
            col = mix(midColor, topColor, smoothstep(0.0, 0.7, h));
          } else {
            col = mix(midColor, bottomColor, smoothstep(0.0, -0.3, h));
          }
          // Stars (only in upper hemisphere)
          if (h > 0.05) {
            vec2 sp = vec2(atan(vDir.z, vDir.x) * 80.0, h * 80.0);
            float n = hash(floor(sp));
            float star = step(0.992, n) * smoothstep(0.05, 0.4, h);
            col += vec3(star * 0.9);
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    // -----------------------------------------------------
    // Lights (uniforms passed manually into PS2 shader)
    // -----------------------------------------------------
    const lampPos   = new THREE.Vector3(7.5, 5.0, 4.0);
    const lampColor = new THREE.Color(0xff8c42);  // sodium orange
    const lampRange = 18;
    const poolPos   = new THREE.Vector3(0, 0.4, 0);
    const poolColor = new THREE.Color(0x1de9c5);  // turquoise
    const poolRange = 12;

    function makePS2Material(opts) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uColor:       { value: new THREE.Color(opts.color) },
          uEmissive:    { value: new THREE.Color(opts.emissive || 0x000000) },
          uEmissiveAmt: { value: opts.emissiveAmt || 0 },
          uLampPos:     { value: lampPos },
          uLampColor:   { value: lampColor },
          uLampRange:   { value: lampRange },
          uPoolPos:     { value: poolPos },
          uPoolColor:   { value: poolColor },
          uPoolRange:   { value: poolRange },
          uFogColor:    { value: new THREE.Color(0x1a0a3e) },
          uFogDensity:  { value: 0.022 },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vWorldPos;
          varying float vFogDepth;

          void main() {
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            vFogDepth = -mvPos.z;
            vec4 clip = projectionMatrix * mvPos;

            // PS2 vertex jitter — snap clip-space xy to a low-res grid.
            // This is the famous "wobble" — vertices shimmer as the camera moves.
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
          uniform vec3 uFogColor;
          uniform float uFogDensity;
          varying vec3 vNormal;
          varying vec3 vWorldPos;
          varying float vFogDepth;

          void main() {
            // Ambient (cool blue night)
            vec3 ambient = vec3(0.10, 0.10, 0.22);
            vec3 col = uColor * ambient;

            // Sodium streetlamp — warm point falloff
            vec3 toLamp = uLampPos - vWorldPos;
            float lampDist = length(toLamp);
            float lampFall = max(0.0, 1.0 - lampDist / uLampRange);
            lampFall *= lampFall;
            float lampNdl = max(dot(vNormal, normalize(toLamp)), 0.0);
            col += uColor * uLampColor * lampFall * (0.35 + lampNdl * 0.6);

            // Pool glow — turquoise point falloff (mostly upward)
            vec3 toPool = uPoolPos - vWorldPos;
            float poolDist = length(toPool);
            float poolFall = max(0.0, 1.0 - poolDist / uPoolRange);
            poolFall *= poolFall;
            float poolNdl = max(dot(vNormal, normalize(toPool)), 0.0);
            col += uColor * uPoolColor * poolFall * (0.25 + poolNdl * 0.5);

            // Self-emissive
            col += uEmissive * uEmissiveAmt;

            // Exponential fog blend (matches scene.fog)
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
    const groundMat = makePS2Material({ color: 0x14141c });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80, 6, 6), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    // -----------------------------------------------------
    // Pool — flat glowing slab
    // -----------------------------------------------------
    const poolMat = makePS2Material({
      color:       0x0fb5b5,
      emissive:    0x1de9c5,
      emissiveAmt: 1.6,
    });
    const pool = new THREE.Mesh(new THREE.BoxGeometry(8, 0.15, 5), poolMat);
    pool.position.set(0, 0.08, 0);
    scene.add(pool);

    // Pool rim (slightly raised concrete lip)
    const rimMat = makePS2Material({ color: 0x2a2630 });
    const rim = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.18, 5.6), rimMat);
    rim.position.set(0, 0.05, 0);
    scene.add(rim);

    // -----------------------------------------------------
    // Palm tree (low-poly silhouette)
    // -----------------------------------------------------
    const trunkMat = makePS2Material({ color: 0x0e0814 });
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 6.5, 5);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(-7.5, 3.25, 2.5);
    scene.add(trunk);

    const frondMat = makePS2Material({ color: 0x180a24 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.7, 1, 1), frondMat);
      frond.position.set(
        -7.5 + Math.cos(a) * 1.4,
        6.4,
        2.5 + Math.sin(a) * 1.4
      );
      frond.rotation.y = -a;
      frond.rotation.z = -0.35;
      scene.add(frond);
    }

    // -----------------------------------------------------
    // Low-res render target → fullscreen quad upscale
    // This is what gives us the chunky-pixel PS2 look.
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

  function animate() {
    if (destroyed || !renderer) return;
    animId = requestAnimationFrame(animate);

    // Gentle orbit driven by mouse position
    const targetYaw = -mouseX * 0.6;
    const targetPitch = -mouseY * 0.25;
    yaw += (targetYaw - yaw) * 0.05;
    pitch += (targetPitch - pitch) * 0.05;

    const radius = 13;
    camera.position.x = Math.sin(yaw) * radius;
    camera.position.z = Math.cos(yaw) * radius;
    camera.position.y = 4 + pitch * 4;
    camera.lookAt(0, 1.2, 0);

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
    if (lowResTarget) { lowResTarget.dispose(); lowResTarget = null; }
    if (postMaterial) { postMaterial.dispose(); postMaterial = null; }
    if (renderer) { renderer.dispose(); renderer = null; }
    scene = camera = postScene = postCamera = canvas = container = null;
    yaw = pitch = mouseX = mouseY = 0;
  }

  registerView('villa', { init, destroy });
})();
