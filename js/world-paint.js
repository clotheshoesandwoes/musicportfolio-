/* =========================================================
   WORLD-PAINT.JS — Painterly POC (b051)
   ---------------------------------------------------------
   Self-contained proof-of-concept for the "Miami villa as a
   Studio Ghibli watercolor" art direction. Activated via the
   ?paint=1 URL flag, which switches the boot view from 'villa'
   to 'paint'. Lives entirely separately from world.js — does
   not import, modify, or share state with the b047-b050 villa
   pipeline. If the user hates it, this single file gets
   deleted and the URL flag check in app.js gets removed.

   Scope (intentionally minimal):
   - Procedural canvas paper texture (~30 lines, no assets)
   - makePainterlyMaterial: flat color × paper × world-pos
     color bleed × top-down soft tint. No PBR, no shadows.
   - Sky dome: brush-wash gradient horizon→mid→top + sun disc +
     loose cloud band noise + paper grain
   - Ocean: flat cyan with painted-on horizontal brush strokes
   - Sand ground: warm beige with darker dab noise
   - Mansion shell: 3 walls + roof slab + colonnade + 4 columns
     (NO interior rooms — POC just shows the volume)
   - 4 flat-card palms (deliberately back to b023 silhouette
     style — painterly works with flat shapes, not detailed 3D)
   - 1 yellow lambo (3 simple boxes)
   - Pool with painted brush strokes
   - Camera: simple orbit (LMB drag rotates, wheel zooms)
   - 1 click target: lambo → small DOM card popup with track 0
   ========================================================= */

(function () {
  let scene, camera, renderer, container, canvas;
  let raycaster, mouseNDC;
  let animationId, destroyed = false;
  let THREE;
  let paperTex;
  const timeUniforms = [];
  const clickTargets = [];

  // Camera (orbit only for POC)
  let camYaw = 0.55, camPitch = 0.42, camRadius = 58;
  const camCenter = { x: 0, y: 4, z: -10 };
  let dragging = false, lastX = 0, lastY = 0;

  // -------------------------------------------------------
  // PROCEDURAL PAPER TEXTURE — drawn on a 512×512 canvas
  // Cream base + thousands of small darker dabs + a handful of
  // long fiber strokes. Tiles via RepeatWrapping in materials.
  // -------------------------------------------------------
  function makePaperTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    // Cream base
    ctx.fillStyle = '#f5ecd8';
    ctx.fillRect(0, 0, 512, 512);
    // Paper grain — random small darker dabs
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const a = 0.025 + Math.random() * 0.07;
      const r = 0.4 + Math.random() * 1.6;
      ctx.fillStyle = `rgba(120, 90, 60, ${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Long fiber lines for texture variety
    for (let i = 0; i < 80; i++) {
      ctx.strokeStyle = `rgba(140, 110, 80, ${0.04 + Math.random() * 0.05})`;
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60);
      ctx.stroke();
    }
    // A few darker "wash" blotches
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 20 + Math.random() * 50;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(110, 80, 50, 0.10)');
      grad.addColorStop(1, 'rgba(110, 80, 50, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // -------------------------------------------------------
  // PAINTERLY MATERIAL — flat color × paper × world-noise
  // color bleed. No PBR. Soft top-tint instead of real lights.
  // -------------------------------------------------------
  function makePainterlyMaterial(opts) {
    opts = opts || {};
    const color = new THREE.Color(opts.color != null ? opts.color : 0xffffff);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:        { value: 0 },
        uColor:       { value: color },
        uPaper:       { value: paperTex },
        uPaperAmount: { value: opts.paperAmount != null ? opts.paperAmount : 0.20 },
        uBleed:       { value: opts.bleed != null ? opts.bleed : 0.10 },
        uPaperScale:  { value: opts.paperScale != null ? opts.paperScale : 0.08 },
        uTopBoost:    { value: opts.topBoost != null ? opts.topBoost : 1.10 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3  uColor;
        uniform sampler2D uPaper;
        uniform float uPaperAmount;
        uniform float uBleed;
        uniform float uPaperScale;
        uniform float uTopBoost;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          float a = hash(i), b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        void main() {
          vec3 base = uColor;
          // Color bleed — low-freq world-pos noise shifts the base
          // color slightly so flat surfaces have organic variation
          float bleed1 = vnoise(vWorldPos.xz * 0.35) - 0.5;
          float bleed2 = vnoise(vWorldPos.xz * 0.95 + 7.3) - 0.5;
          base += vec3(bleed1, bleed2, bleed1 * 0.4) * uBleed;
          // Soft top-down tint (no real lighting — just a directional cue)
          float topLit = clamp(vNormal.y * 0.5 + 0.5, 0.0, 1.0);
          base *= mix(0.74, uTopBoost, topLit);
          // Paper grain multiply — sampled in world XZ so it tiles
          // across the scene continuously regardless of mesh UVs
          vec2 puv = vWorldPos.xz * uPaperScale;
          float p = texture2D(uPaper, puv).r;
          base *= mix(1.0, p * 1.15 + 0.20, uPaperAmount);
          // Faint warm wash overlay — pulls everything toward the
          // sunset palette so even cool colors feel like part of the painting
          base = mix(base, base * vec3(1.10, 0.96, 0.88), 0.18);
          gl_FragColor = vec4(base, 1.0);
        }
      `,
    });
    timeUniforms.push(mat.uniforms.uTime);
    return mat;
  }

  // -------------------------------------------------------
  // SKY DOME — brush-wash gradient + sun disc + cloud bands
  // -------------------------------------------------------
  function makeSkyDome() {
    const geom = new THREE.SphereGeometry(400, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTime:  { value: 0 },
        uPaper: { value: paperTex },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uPaper;
        varying vec3 vDir;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          float a = hash(i), b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        void main() {
          float t = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 horizon = vec3(0.98, 0.55, 0.40);   // warm coral
          vec3 mid     = vec3(0.78, 0.28, 0.48);   // deep magenta
          vec3 top     = vec3(0.16, 0.10, 0.32);   // indigo
          vec3 col;
          if (t < 0.55) {
            col = mix(horizon, mid, smoothstep(0.0, 0.55, t));
          } else {
            col = mix(mid, top, smoothstep(0.55, 1.0, t));
          }
          // Wet bleed — wobble color via slow noise so the wash isn't a clean gradient
          float bleed = vnoise(vDir.xz * 5.0 + uTime * 0.04);
          col += (bleed - 0.5) * 0.10;
          // Sun disc + halo
          vec3 sunDir = normalize(vec3(0.30, 0.18, -1.0));
          float sun = max(0.0, dot(vDir, sunDir));
          col += vec3(1.00, 0.80, 0.50) * smoothstep(0.985, 0.998, sun) * 1.6;
          col += vec3(1.00, 0.65, 0.38) * smoothstep(0.93, 0.985, sun) * 0.55;
          col += vec3(1.00, 0.55, 0.34) * smoothstep(0.78, 0.93, sun) * 0.18;
          // Cloud band smears — only in the lower-mid sky
          float band = smoothstep(0.05, 0.30, vDir.y) * smoothstep(0.55, 0.10, vDir.y);
          float cloud = vnoise(vec2(vDir.x * 6.0 + uTime * 0.06, vDir.z * 6.0)) * band;
          col += vec3(1.00, 0.85, 0.78) * cloud * 0.40;
          // Paper grain on the sky too (subtle)
          vec2 puv = vDir.xz * 0.5 + 0.5;
          float p = texture2D(uPaper, puv).r;
          col *= mix(1.0, p * 1.10 + 0.05, 0.10);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    timeUniforms.push(mat.uniforms.uTime);
    return new THREE.Mesh(geom, mat);
  }

  // -------------------------------------------------------
  // OCEAN — flat cyan with painted horizontal brush strokes
  // -------------------------------------------------------
  function makeOcean() {
    const geom = new THREE.PlaneGeometry(400, 200, 1, 1);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:  { value: 0 },
        uPaper: { value: paperTex },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uPaper;
        varying vec3 vWorldPos;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          float a = hash(i), b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        void main() {
          // Base cyan-teal flat wash
          vec3 deep  = vec3(0.10, 0.32, 0.42);
          vec3 light = vec3(0.32, 0.62, 0.68);
          // Distance-driven mix so the ocean recedes into deep
          float d = clamp(length(vWorldPos.xz - vec2(0.0, 50.0)) / 200.0, 0.0, 1.0);
          vec3 col = mix(light, deep, d);
          // Painted horizontal brush strokes — long thin noise lines
          float stripe = vnoise(vec2(vWorldPos.x * 0.08, vWorldPos.z * 1.2 + uTime * 0.10));
          col += vec3(0.98, 0.96, 0.92) * smoothstep(0.72, 0.85, stripe) * 0.50;
          // Color bleed
          float bleed = vnoise(vWorldPos.xz * 0.20) - 0.5;
          col += vec3(bleed * 0.08, bleed * 0.10, bleed * 0.06);
          // Paper grain
          float p = texture2D(uPaper, vWorldPos.xz * 0.05).r;
          col *= mix(1.0, p * 1.12 + 0.10, 0.18);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    timeUniforms.push(mat.uniforms.uTime);
    const m = new THREE.Mesh(geom, mat);
    m.position.set(0, -0.05, 60);
    return m;
  }

  // -------------------------------------------------------
  // POOL — small flat cyan with painted caustic strokes
  // -------------------------------------------------------
  function makePool() {
    const geom = new THREE.PlaneGeometry(22, 6, 1, 1);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:  { value: 0 },
        uPaper: { value: paperTex },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uPaper;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          float a = hash(i), b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        void main() {
          vec3 base = vec3(0.26, 0.72, 0.78);
          // Painted caustic strokes
          float caustic = vnoise(vUv * vec2(20.0, 8.0) + uTime * 0.20);
          base += vec3(0.95, 1.00, 0.95) * smoothstep(0.65, 0.85, caustic) * 0.55;
          float stroke = vnoise(vUv * vec2(40.0, 4.0) - uTime * 0.10);
          base += vec3(0.90, 1.00, 0.95) * smoothstep(0.78, 0.92, stroke) * 0.35;
          // Paper grain
          float p = texture2D(uPaper, vWorldPos.xz * 0.10).r;
          base *= mix(1.0, p * 1.10 + 0.10, 0.15);
          gl_FragColor = vec4(base, 1.0);
        }
      `,
    });
    timeUniforms.push(mat.uniforms.uTime);
    const m = new THREE.Mesh(geom, mat);
    m.position.set(0, 0.42, 5);
    return m;
  }

  // -------------------------------------------------------
  // FLAT-CARD PALM — back to b023 style. Trunk = thin tapered
  // cylinder, fronds = 6 rotated PlaneGeometry cards. Painterly
  // works best with intentionally flat shapes — the b048 3D
  // drooping fronds were overkill for this aesthetic.
  // -------------------------------------------------------
  function addPalm(x, z, height) {
    const trunkMat = makePainterlyMaterial({ color: 0x4a3220, paperAmount: 0.25 });
    const frondMat = makePainterlyMaterial({ color: 0x3a1a4a, paperAmount: 0.30, bleed: 0.18 });
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.32, height, 8),
      trunkMat
    );
    trunk.position.set(x, height / 2, z);
    scene.add(trunk);
    const fronds = 6;
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * Math.PI * 2;
      const f = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 0.85, 1, 1),
        frondMat
      );
      f.position.set(
        x + Math.cos(a) * 1.4,
        height - 0.10,
        z + Math.sin(a) * 1.4
      );
      f.rotation.y = -a;
      f.rotation.z = -0.55;
      scene.add(f);
    }
  }

  // -------------------------------------------------------
  // YELLOW LAMBO — 3 simple boxes (body, cabin, hood) +
  // 4 wheel cylinders. Click target.
  // -------------------------------------------------------
  function addLambo(x, z) {
    const bodyMat  = makePainterlyMaterial({ color: 0xf6c828, bleed: 0.18, paperAmount: 0.22 });
    const dkMat    = makePainterlyMaterial({ color: 0x18120c, paperAmount: 0.25 });
    const wheelMat = makePainterlyMaterial({ color: 0x0b0a08, paperAmount: 0.30 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.55, 1.85), bodyMat);
    body.position.set(x, 0.85, z);
    body.name = 'lambo_painterly';
    scene.add(body);
    clickTargets.push(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 1.55), dkMat);
    cabin.position.set(x - 0.20, 1.40, z);
    scene.add(cabin);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.10, 1.65), bodyMat);
    hood.position.set(x + 1.10, 1.18, z);
    scene.add(hood);

    for (const [wx, wz] of [[-1.4, -0.85], [1.4, -0.85], [-1.4, 0.85], [1.4, 0.85]]) {
      const w = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.30, 12),
        wheelMat
      );
      w.position.set(x + wx, 0.42, z + wz);
      w.rotation.x = Math.PI / 2;
      scene.add(w);
    }
  }

  // -------------------------------------------------------
  // MANSION SHELL — minimal version: 3 walls (back + 2 sides),
  // floor podium, roof slab, 9-column colonnade across the
  // front. NO interior rooms (POC just shows the volume).
  // -------------------------------------------------------
  function addMansionShell() {
    const villaMat  = makePainterlyMaterial({ color: 0xf0d8b8, paperAmount: 0.22, bleed: 0.10 });
    const marbleMat = makePainterlyMaterial({ color: 0xf6efde, paperAmount: 0.18, bleed: 0.06 });
    const podiumMat = makePainterlyMaterial({ color: 0x8a6a48, paperAmount: 0.25 });
    const sandMat   = makePainterlyMaterial({ color: 0xd6b88a, paperAmount: 0.28, bleed: 0.14, paperScale: 0.04 });

    // Sand ground (huge plane)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300, 1, 1), sandMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -10);
    scene.add(ground);

    // Mansion footprint matches b049 (56×28 centered at z=-17)
    const cx = 0, cz = -17, w = 56, d = 28;
    const podiumTopY = 0.82;
    const wallT = 0.4;
    const h1 = 5.0, h2 = 4.5;
    const roofY = podiumTopY + h1 + h2;

    // Podium
    const podium = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 0.8, d + 6), podiumMat);
    podium.position.set(cx, 0.4, cz);
    scene.add(podium);

    // Helper: 3-walled box (open front), one floor at a time
    function addOpenBox(yBase, h) {
      const cy = yBase + h / 2;
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallT), villaMat);
      back.position.set(cx, cy, cz - d / 2 + wallT / 2);
      scene.add(back);
      const left = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, d), villaMat);
      left.position.set(cx - w / 2 + wallT / 2, cy, cz);
      scene.add(left);
      const right = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, d), villaMat);
      right.position.set(cx + w / 2 - wallT / 2, cy, cz);
      scene.add(right);
    }
    addOpenBox(podiumTopY, h1);
    addOpenBox(podiumTopY + h1, h2);

    // Upper floor slab (between floors)
    const upperSlab = new THREE.Mesh(
      new THREE.BoxGeometry(w - wallT * 2, 0.30, d - wallT * 2),
      villaMat
    );
    upperSlab.position.set(cx, podiumTopY + h1 - 0.15, cz);
    scene.add(upperSlab);

    // Flat roof slab
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.22, d + 0.8), villaMat);
    roof.position.set(cx, roofY + 0.11, cz);
    scene.add(roof);

    // Front colonnade — 9 columns spanning the front face
    const colCount = 9;
    const colY = 0;
    const colH = podiumTopY + h1;
    const colZ = cz + d / 2 + 3.0;
    for (let i = 0; i < colCount; i++) {
      const t = i / (colCount - 1);
      const x = cx - w / 2 + 0.8 + t * (w - 1.6);
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, colH, 12),
        villaMat
      );
      col.position.set(x, colY + colH / 2, colZ);
      scene.add(col);
    }

    // Eyebrow cantilever above the colonnade
    const eyebrow = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.20, 1.6), villaMat);
    eyebrow.position.set(cx, colY + colH + 0.10, colZ);
    scene.add(eyebrow);

    // Marble grand entrance steps (4 wide steps)
    for (let i = 0; i < 4; i++) {
      const stepY = 0.10 + i * 0.20;
      const stepZ = cz + d / 2 + 0.5 + (3 - i) * 0.55;
      const step = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.20, 0.55), marbleMat);
      step.position.set(cx, stepY, stepZ);
      scene.add(step);
    }
  }

  // -------------------------------------------------------
  // CLICK CARD — minimal DOM popover at the click point
  // showing track 0 from window.tracks. Same shape as the
  // existing villa system, just standalone for the POC.
  // -------------------------------------------------------
  function showCard(trackIdx, x, y) {
    closeCard();
    const t = (window.tracks && window.tracks[trackIdx]) || {
      title: 'Sample Track', artist: 'Kani'
    };
    const card = document.createElement('div');
    card.id = 'paintCard';
    card.style.cssText = `
      position: fixed;
      left: ${Math.min(window.innerWidth - 280, Math.max(20, x))}px;
      top:  ${Math.min(window.innerHeight - 200, Math.max(20, y))}px;
      width: 260px;
      padding: 18px;
      background: rgba(245, 236, 216, 0.97);
      color: #2a1a0e;
      font-family: 'DM Sans', sans-serif;
      border-radius: 6px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(120, 90, 60, 0.30);
      z-index: 9999;
      pointer-events: auto;
    `;
    card.innerHTML = `
      <div style="font-size:11px; letter-spacing:0.18em; opacity:0.55; margin-bottom:6px;">PAINTERLY POC</div>
      <div style="font-size:20px; font-weight:600; margin-bottom:4px;">${t.title || 'Sample Track'}</div>
      <div style="font-size:13px; opacity:0.70; margin-bottom:14px;">Kani · click→card system works</div>
      <button id="paintCardClose" style="
        background: #2a1a0e; color: #f5ecd8;
        border: none; padding: 8px 16px; font-size: 12px;
        font-family: inherit; cursor: pointer; border-radius: 3px;
        letter-spacing: 0.08em;
      ">CLOSE</button>
    `;
    document.body.appendChild(card);
    card.querySelector('#paintCardClose').addEventListener('click', closeCard);
  }
  function closeCard() {
    const c = document.getElementById('paintCard');
    if (c) c.remove();
  }

  // -------------------------------------------------------
  // CAMERA — orbit only, LMB drag rotates, wheel zooms
  // -------------------------------------------------------
  function updateCamera() {
    const cosP = Math.cos(camPitch);
    const x = camCenter.x + camRadius * Math.sin(camYaw) * cosP;
    const y = camCenter.y + camRadius * Math.sin(camPitch);
    const z = camCenter.z + camRadius * Math.cos(camYaw) * cosP;
    camera.position.set(x, y, z);
    camera.lookAt(camCenter.x, camCenter.y, camCenter.z);
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    camYaw   -= dx * 0.005;
    camPitch += dy * 0.005;
    camPitch = Math.max(0.05, Math.min(1.4, camPitch));
    updateCamera();
  }
  function onPointerUp() { dragging = false; }
  function onWheel(e) {
    e.preventDefault();
    camRadius *= (1 + e.deltaY * 0.0012);
    camRadius = Math.max(15, Math.min(140, camRadius));
    updateCamera();
  }
  function onClick(e) {
    if (Math.abs(e.clientX - lastX) > 4 || Math.abs(e.clientY - lastY) > 4) return;
    const rect = canvas.getBoundingClientRect();
    mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouseNDC, camera);
    const hits = raycaster.intersectObjects(clickTargets, true);
    if (hits.length > 0) {
      showCard(0, e.clientX, e.clientY);
    }
  }

  // -------------------------------------------------------
  // INIT
  // -------------------------------------------------------
  async function init(c) {
    container = c;
    destroyed = false;

    const loader = document.createElement('div');
    loader.className = 'world-loader';
    loader.innerHTML = `
      <div class="world-loader-text">LOADING PAINTERLY POC</div>
      <div class="world-loader-bar"><div class="world-loader-fill"></div></div>
    `;
    container.appendChild(loader);

    try {
      const lib = await import('https://unpkg.com/three@0.160.0/build/three.module.js');
      THREE = lib;
    } catch (err) {
      console.error('Three.js load failed', err);
      loader.innerHTML = `<div class="world-loader-text">FAILED TO LOAD 3D ENGINE</div>`;
      return;
    }
    if (destroyed) { loader.remove(); return; }

    canvas = document.createElement('canvas');
    canvas.className = 'world-canvas';
    container.appendChild(canvas);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x1a0a20, 1.0);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);

    raycaster = new THREE.Raycaster();
    mouseNDC = new THREE.Vector2();

    paperTex = makePaperTexture();

    // Build the scene
    scene.add(makeSkyDome());
    addMansionShell();
    scene.add(makeOcean());
    scene.add(makePool());

    // Pool rim — slim cream marble strip
    const rimMat = makePainterlyMaterial({ color: 0xf2ebd6, paperAmount: 0.20 });
    const rim = new THREE.Mesh(new THREE.BoxGeometry(22.6, 0.20, 6.6), rimMat);
    rim.position.set(0, 0.30, 5);
    scene.add(rim);

    // Palms — 6 framing the pool + front lawn
    addPalm(-14.0, 16.0, 7.0);
    addPalm( 14.0, 16.0, 6.4);
    addPalm(-22.0, 12.0, 6.8);
    addPalm( 22.0, 12.0, 6.6);
    addPalm(-12.0, 24.0, 6.0);
    addPalm( 12.0, 24.0, 6.2);

    // Lambo on the deck (click target)
    addLambo(-14.0, 5.0);

    // Camera initial setup
    updateCamera();

    // Listeners
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('click', onClick);
    window.addEventListener('resize', onResize);

    loader.remove();

    // Animate
    const t0 = performance.now();
    function tick() {
      if (destroyed) return;
      const t = (performance.now() - t0) * 0.001;
      for (const u of timeUniforms) u.value = t;
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(tick);
    }
    tick();
  }

  function onResize() {
    if (!renderer || !camera || !container) return;
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  }

  function destroy() {
    destroyed = true;
    if (animationId) cancelAnimationFrame(animationId);
    closeCard();
    if (canvas) {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('click', onClick);
    }
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('resize', onResize);
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
    if (container) container.innerHTML = '';
    timeUniforms.length = 0;
    clickTargets.length = 0;
  }

  registerView('paint', { init, destroy });
})();
