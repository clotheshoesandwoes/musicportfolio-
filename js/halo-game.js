/* =========================================================
   HALO-GAME — b108
   "Cartographer Cove" — Halo Silent-Cartographer-inspired mini-mission.
   Land on the beach, drive the Mongoose inland, dismount, shoot Grunts,
   recover Kani's tracks at 6 holo-pylons placed at landmarks, push to
   the bunker. Standalone — mounted only by halo.html.

   Visual approach:
   - Toon shading via MeshToonMaterial + 4-step gradient ramp.
   - Saturated palette, strong sun + deep ambient for Bruno-style flat
     low-poly feel without GLB assets.
   - Procedural primitives with bevels (RoundedBoxGeometry) and proper
     proportions. Will be swapped for Kenney/Quaternius GLBs next turn.

   Gameplay:
   - Screen-relative WASD (Diablo/Bruno-style) — controls feel right on
     a fixed-angle isometric camera.
   - Mouse aim on foot — player faces world point under cursor; LMB fires.
   - Mongoose: drive into things, ram Grunts, dismount with E.
   - 6 song pickups → existing R2 audio playback via ctx.onPlay.
   ========================================================= */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const HaloGame = {
  ctx: null, container: null,
  renderer: null, scene: null, camera: null, clock: null, raf: 0,
  destroyed: false,

  // Materials (built once with the toon ramp)
  toonRamp: null,
  mat: {},

  // Player state — third-person ODST who can ride a Mongoose
  player: {
    pos: new THREE.Vector3(0, 0, 18),  // spawn on the beach
    vel: new THREE.Vector3(),
    yaw: 0,
    aim: new THREE.Vector3(0, 0, -1), // world-space aim direction
    onGround: true,
    radius: 0.45,
    height: 1.85,
    health: 100, shields: 100, shieldRecharge: 0,
    fireCd: 0,
    onMongoose: false,
    mesh: null,
    armRig: null,
  },

  // World contents
  obstacles: [],     // { box, mesh }
  enemies: [],
  pickups: [],
  bullets: [],
  effects: [],
  pelicans: [],
  mongoose: null,
  ground: null,
  sea: null,
  hud: null,

  // Mouse / pointer
  mouse: { x: 0.5, y: 0.5, ndc: new THREE.Vector2(0,0), worldPoint: new THREE.Vector3(), leftDown: false },
  keys: null,
  ray: null,

  // Mission state
  tracksRecovered: 0,
  tracksTotal: 0,

  init(container, ctx){
    if (this.renderer) return;
    this.ctx = ctx;
    this.container = container;
    this.destroyed = false;
    this.keys = new Set();
    this.tracksRecovered = 0;

    const canvas = document.createElement('canvas');
    canvas.className = 'hg-canvas';
    container.appendChild(canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.setClearColor(0x6fb8e0, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xa8d4ec, 90, 380);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
    this.camera.position.set(10, 14, 14);
    this.camera.lookAt(0, 0.5, 0);

    this.clock = new THREE.Clock();
    this.ray = new THREE.Raycaster();

    this._buildMaterials();
    this._buildHUD();
    this._onResize();

    try {
      this._buildSkyAndLights();
      this._buildLevel();
      this._buildPlayer();
      this._buildMongoose();
      this._spawnEnemies();
      this._spawnPickups();
      this._spawnPelicans();
    } catch (err){
      console.error('[halo] world build failed:', err);
      const hint = this.hud?.querySelector('#hg-hint');
      if (hint) hint.textContent = 'world build failed — see console';
      throw err;
    }

    // Bind input
    this._onResize    = this._onResize.bind(this);
    this._onKeyDown   = this._onKeyDown.bind(this);
    this._onKeyUp     = this._onKeyUp.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp   = this._onMouseUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('mousemove', this._onMouseMove);

    this.animate = this.animate.bind(this);
    this.animate();
  },

  /* ============= Materials ============= */

  _buildMaterials(){
    // 4-step gradient ramp → MeshToonMaterial gets that flat-shaded
    // low-poly look without writing custom GLSL.
    const c = document.createElement('canvas');
    c.width = 4; c.height = 1;
    const ctx = c.getContext('2d');
    const stops = ['#3d3d3d', '#7d7d7d', '#bdbdbd', '#ffffff'];
    stops.forEach((s, i) => { ctx.fillStyle = s; ctx.fillRect(i, 0, 1, 1); });
    const ramp = new THREE.CanvasTexture(c);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
    this.toonRamp = ramp;

    const T = (color) => new THREE.MeshToonMaterial({ color, gradientMap: ramp });
    this.mat = {
      sand:        T(0xefc880),
      sandDark:    T(0xc99c5a),
      grass:       T(0x66a83a),
      grassDark:   T(0x3f7a25),
      rock:        T(0x707880),
      rockDark:    T(0x4a505a),
      water:       new THREE.MeshToonMaterial({ color: 0x3088c8, gradientMap: ramp, transparent: true, opacity: 0.85 }),
      foam:        new THREE.MeshToonMaterial({ color: 0xe8f6ff, gradientMap: ramp, transparent: true, opacity: 0.7 }),
      palmTrunk:   T(0x6b4a2a),
      palmLeaf:    T(0x35a04a),
      armorBlack:  T(0x14161a),
      armorMid:    T(0x222629),
      visor:       new THREE.MeshBasicMaterial({ color: 0xff4828 }),
      gunMetal:    T(0x1a1c20),
      mongOlive:   T(0x4a5836),
      mongDark:    T(0x252a1c),
      chrome:      T(0xa8b0bc),
      tire:        T(0x121316),
      headlight:   new THREE.MeshBasicMaterial({ color: 0xffe8a8 }),
      gruntOrange: T(0xe07028),
      gruntOrangeDark: T(0x9a4818),
      gruntFlesh:  T(0x593218),
      gruntTank:   T(0x363a3e),
      plasmaGreen: new THREE.MeshBasicMaterial({ color: 0x40ff60 }),
      plasmaBlue:  new THREE.MeshBasicMaterial({ color: 0x4ad8ff }),
      bunkerWall:  T(0x6a7480),
      bunkerRoof:  T(0x3a4248),
      bunkerStripe:new THREE.MeshBasicMaterial({ color: 0x44ff66 }),
      coilRed:     T(0xc83828),
      coilStripe:  new THREE.MeshBasicMaterial({ color: 0xffe14a }),
      pylonCyan:   new THREE.MeshBasicMaterial({ color: 0x44e8ff }),
      pylonCyanDim:new THREE.MeshBasicMaterial({ color: 0x44e8ff, transparent: true, opacity: 0.7 }),
      pelican:     T(0x2a3038),
      pelicanGlow: new THREE.MeshBasicMaterial({ color: 0xffaa44 }),
    };
  },

  /* ============= Sky & Lights ============= */

  _buildSkyAndLights(){
    // Halo CE sky — bright saturated blue, warm horizon
    const skyGeo = new THREE.SphereGeometry(450, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uTop:    { value: new THREE.Color(0x2c70c8) },
        uHorizon:{ value: new THREE.Color(0xb0e0f5) },
        uGround: { value: new THREE.Color(0x88a888) },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTop, uHorizon, uGround;
        varying vec3 vWorld;
        void main(){
          float h = normalize(vWorld).y;
          vec3 col;
          if (h > 0.0) col = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));
          else         col = mix(uHorizon, uGround, smoothstep(0.0, -0.35, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Distant Halo ring on horizon
    const ringGeo = new THREE.RingGeometry(380, 415, 64, 1, Math.PI * 0.18, Math.PI * 0.64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xeaf2f8, side: THREE.DoubleSide,
      transparent: true, opacity: 0.5, depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -0.16;
    ring.position.set(-30, 70, -360);
    this.scene.add(ring);

    // Sun
    const sun = new THREE.DirectionalLight(0xfff0c8, 3.4);
    sun.position.set(80, 140, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 350;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 3;
    this.scene.add(sun);

    this.scene.add(new THREE.HemisphereLight(0xa8d4ec, 0x6a7045, 0.55));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.22));
  },

  /* ============= Level: Cartographer Cove ============= */

  _buildLevel(){
    // Beach (south, +Z) — sand plane, water beyond, palms scattered
    // Hills (center, around 0) — rocky outcrops
    // Bunker (north, -Z) — UNSC objective

    // Sand
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220, 1, 1),
      this.mat.sand,
    );
    sand.rotation.x = -Math.PI / 2;
    sand.receiveShadow = true;
    this.scene.add(sand);
    this.ground = sand;

    // Sea (further south)
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 400),
      this.mat.water,
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.05, 220);
    this.scene.add(sea);
    this.sea = sea;

    // Foam line where sand meets sea
    const foam = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 6),
      this.mat.foam,
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(0, 0.02, 105);
    this.scene.add(foam);

    // Wet sand strip (darker tone near water)
    const wetSand = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 18),
      this.mat.sandDark,
    );
    wetSand.rotation.x = -Math.PI / 2;
    wetSand.position.set(0, 0.005, 95);
    this.scene.add(wetSand);

    // Inland grass patch (north)
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 110),
      this.mat.grass,
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, 0.005, -55);
    grass.receiveShadow = true;
    this.scene.add(grass);

    // Path: tan stripe from beach → bunker, bezier-curved
    this._buildPath();

    // Palms on the beach
    for (let i = 0; i < 14; i++){
      const x = (Math.random() - 0.5) * 200;
      const z = 50 + Math.random() * 45;
      if (Math.abs(x) < 6 && z > 14 && z < 28) continue; // keep spawn clear
      this._buildPalm(x, z);
    }
    // Inland palms (sparser)
    for (let i = 0; i < 8; i++){
      const x = (Math.random() - 0.5) * 180;
      const z = -20 - Math.random() * 60;
      if (Math.abs(x) < 8 && z > -30 && z < -10) continue; // keep path clear
      this._buildPalm(x, z, 0.85);
    }

    // Rocks — hills middle band
    for (let i = 0; i < 24; i++){
      const cluster = Math.floor(i / 4);
      const cx = (cluster % 3 - 1) * 35 + (Math.random() - 0.5) * 14;
      const cz = -10 - Math.floor(cluster / 3) * 28 + (Math.random() - 0.5) * 18;
      this._buildRock(cx, cz, 0.8 + Math.random() * 1.4);
    }

    // Distant mountain ridge to the sides + far north
    this._buildRidges();

    // Bunker (north, the objective)
    this._buildBunker(0, -95);

    // Grass blade instance field on the inland patch
    this._buildGrassBlades();

    // Map clamp
    this.mapBounds = { minX: -100, maxX: 100, minZ: -110, maxZ: 100 };
  },

  _buildPath(){
    // Curved tan path from beach (z≈22, x≈0) inland (z≈-90, x≈0)
    // Approximate with a series of overlapping tan rectangles
    const pathMat = this.mat.sandDark;
    const segs = 26;
    for (let i = 0; i < segs; i++){
      const t = i / (segs - 1);
      const z = 22 - t * 110;
      const x = Math.sin(t * Math.PI * 1.4) * 8;     // gentle s-curve
      const w = 5 + Math.sin(t * Math.PI) * 1.5;
      const seg = new THREE.Mesh(new THREE.PlaneGeometry(w, 6), pathMat);
      seg.rotation.x = -Math.PI / 2;
      seg.position.set(x, 0.01, z);
      this.scene.add(seg);
    }
  },

  _buildPalm(x, z, scale = 1){
    const g = new THREE.Group();
    const trunkH = 4 + Math.random() * 2;
    // Trunk — slight curve via 3 segments
    for (let i = 0; i < 4; i++){
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18 - i * 0.02, 0.22 - i * 0.02, trunkH / 4, 8),
        this.mat.palmTrunk,
      );
      seg.position.y = trunkH / 4 * (i + 0.5);
      seg.position.x = Math.sin(i * 0.5) * 0.15;
      seg.castShadow = true;
      g.add(seg);
    }
    // Coconuts
    for (let i = 0; i < 3; i++){
      const a = (i / 3) * Math.PI * 2;
      const co = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 6),
        this.mat.palmTrunk,
      );
      co.position.set(Math.cos(a) * 0.3, trunkH - 0.1, Math.sin(a) * 0.3);
      g.add(co);
    }
    // Fronds — flat oblong leaves splaying out
    const frondGeo = new THREE.PlaneGeometry(2.6, 0.9, 1, 1);
    const frondMat = this.mat.palmLeaf;
    for (let i = 0; i < 7; i++){
      const a = (i / 7) * Math.PI * 2;
      const f = new THREE.Mesh(frondGeo, frondMat);
      f.material = frondMat.clone();
      f.material.side = THREE.DoubleSide;
      f.position.set(Math.cos(a) * 1.1, trunkH + 0.1, Math.sin(a) * 1.1);
      f.rotation.y = a;
      f.rotation.z = -0.45 + Math.sin(i) * 0.15;
      f.castShadow = true;
      g.add(f);
    }
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
    this.scene.add(g);
    // Trunk obstacle
    g.updateMatrixWorld(true);
    const trunkBox = new THREE.Box3(
      new THREE.Vector3(x - 0.3 * scale, 0, z - 0.3 * scale),
      new THREE.Vector3(x + 0.3 * scale, trunkH * scale, z + 0.3 * scale),
    );
    this.obstacles.push({ box: trunkBox, mesh: g, kind: 'palm' });
  },

  _buildRock(x, z, scale){
    const r = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.0 * scale, 0),
      Math.random() < 0.5 ? this.mat.rock : this.mat.rockDark,
    );
    r.position.set(x, 0.4 * scale, z);
    r.rotation.set(Math.random(), Math.random(), Math.random());
    r.castShadow = true; r.receiveShadow = true;
    this.scene.add(r);
    const halfR = 0.9 * scale;
    const box = new THREE.Box3(
      new THREE.Vector3(x - halfR, 0, z - halfR),
      new THREE.Vector3(x + halfR, scale * 1.4, z + halfR),
    );
    this.obstacles.push({ box, mesh: r, kind: 'rock' });
  },

  _buildRidges(){
    // Distant mountain silhouette to flank east + west + far north
    const ridgeMat = this.mat.rockDark;
    for (let side = -1; side <= 1; side += 2){
      for (let i = 0; i < 16; i++){
        const x = side * (95 + Math.random() * 12);
        const z = -100 + i * 15;
        const h = 7 + Math.random() * 12;
        const w = 12 + Math.random() * 10;
        const r = new THREE.Mesh(
          new THREE.ConeGeometry(w * 0.7, h, 5),
          ridgeMat,
        );
        r.position.set(x, h / 2, z);
        r.rotation.y = Math.random() * Math.PI;
        this.scene.add(r);
      }
    }
    // Far north backdrop ridge
    for (let i = 0; i < 10; i++){
      const x = -90 + i * 20;
      const h = 10 + Math.random() * 14;
      const r = new THREE.Mesh(
        new THREE.ConeGeometry(13, h, 5),
        ridgeMat,
      );
      r.position.set(x, h / 2, -120);
      this.scene.add(r);
    }
  },

  _buildBunker(x, z){
    const g = new THREE.Group();
    // Main hall
    const wall = new THREE.Mesh(new RoundedBoxGeometry(14, 5, 9, 3, 0.18), this.mat.bunkerWall);
    wall.position.y = 2.5; wall.castShadow = true; wall.receiveShadow = true;
    g.add(wall);
    // Roof
    const roof = new THREE.Mesh(new RoundedBoxGeometry(15, 0.5, 10, 2, 0.08), this.mat.bunkerRoof);
    roof.position.y = 5.25; roof.castShadow = true;
    g.add(roof);
    // Door
    const door = new THREE.Mesh(new RoundedBoxGeometry(2.0, 3.0, 0.2, 2, 0.05), this.mat.bunkerRoof);
    door.position.set(0, 1.5, 4.55);
    g.add(door);
    // Green stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(13.8, 0.18, 0.06), this.mat.bunkerStripe);
    stripe.position.set(0, 1.0, 4.51);
    g.add(stripe);
    // Antenna mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 8), this.mat.chrome);
    mast.position.set(5.5, 7.5, -3); g.add(mast);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.4, 0.18, 12), this.mat.chrome);
    dish.position.set(5.5, 9.5, -3); dish.rotation.x = -0.4;
    g.add(dish);
    // Side crates
    for (let i = -1; i <= 1; i += 2){
      const crate = new THREE.Mesh(new RoundedBoxGeometry(1.6, 1.6, 1.6, 3, 0.08), this.mat.mongDark);
      crate.position.set(i * 8.5, 0.8, 3); crate.castShadow = true;
      g.add(crate);
    }
    g.position.set(x, 0, z);
    this.scene.add(g);
    g.updateMatrixWorld(true);
    // Whole bunker box as obstacle
    const box = new THREE.Box3(
      new THREE.Vector3(x - 7, 0, z - 5),
      new THREE.Vector3(x + 7, 5, z + 5),
    );
    this.obstacles.push({ box, mesh: g, kind: 'bunker' });
  },

  _buildGrassBlades(){
    // Tiny instanced grass blades on the inland patch only
    const bladeGeo = new THREE.ConeGeometry(0.05, 0.32, 4);
    bladeGeo.translate(0, 0.16, 0);
    const N = 2400;
    const inst = new THREE.InstancedMesh(bladeGeo, this.mat.grassDark, N);
    const m = new THREE.Matrix4();
    const eu = new THREE.Euler();
    let placed = 0;
    for (let i = 0; i < N * 1.5 && placed < N; i++){
      const x = (Math.random() - 0.5) * 200;
      const z = -10 - Math.random() * 100;
      // Avoid path
      const pathX = Math.sin(((22 - z) / 110) * Math.PI * 1.4) * 8;
      if (Math.abs(x - pathX) < 4) continue;
      const s = 0.7 + Math.random() * 0.7;
      eu.set(0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.15);
      m.makeRotationFromEuler(eu);
      m.scale(new THREE.Vector3(s, s, s));
      m.setPosition(x, 0, z);
      inst.setMatrixAt(placed++, m);
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    inst.receiveShadow = true;
    this.scene.add(inst);
  },

  /* ============= Player (ODST) ============= */

  _buildPlayer(){
    const g = new THREE.Group();
    const M = this.mat;
    // Torso
    const torso = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.7, 0.55, 3, 0.08), M.armorBlack);
    torso.position.y = 1.25; torso.castShadow = true; g.add(torso);
    // Abdomen
    const abd = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.4, 0.5, 3, 0.06), M.armorMid);
    abd.position.y = 0.85; abd.castShadow = true; g.add(abd);
    // Hips
    const hips = new THREE.Mesh(new RoundedBoxGeometry(0.85, 0.3, 0.55, 3, 0.07), M.armorBlack);
    hips.position.y = 0.6; hips.castShadow = true; g.add(hips);
    // Legs
    const legGeo = new RoundedBoxGeometry(0.3, 0.65, 0.34, 3, 0.05);
    const legL = new THREE.Mesh(legGeo, M.armorBlack); legL.position.set(-0.21, 0.27, 0); legL.castShadow = true; g.add(legL);
    const legR = new THREE.Mesh(legGeo, M.armorBlack); legR.position.set( 0.21, 0.27, 0); legR.castShadow = true; g.add(legR);
    // Boots
    const bootGeo = new RoundedBoxGeometry(0.32, 0.16, 0.44, 3, 0.04);
    const bootL = new THREE.Mesh(bootGeo, M.armorMid); bootL.position.set(-0.21, 0.04, 0.04); bootL.castShadow = true; g.add(bootL);
    const bootR = new THREE.Mesh(bootGeo, M.armorMid); bootR.position.set( 0.21, 0.04, 0.04); bootR.castShadow = true; g.add(bootR);
    // Shoulders
    const shGeo = new RoundedBoxGeometry(0.32, 0.32, 0.4, 3, 0.07);
    const shL = new THREE.Mesh(shGeo, M.armorMid); shL.position.set(-0.55, 1.45, 0); shL.castShadow = true; g.add(shL);
    const shR = new THREE.Mesh(shGeo, M.armorMid); shR.position.set( 0.55, 1.45, 0); shR.castShadow = true; g.add(shR);
    // Arms (held forward holding gun — armR is the gun arm)
    const armGeo = new RoundedBoxGeometry(0.2, 0.5, 0.22, 3, 0.04);
    const armL = new THREE.Mesh(armGeo, M.armorBlack); armL.position.set(-0.42, 1.18, 0.18); armL.rotation.x = -0.6; armL.castShadow = true; g.add(armL);
    const armR = new THREE.Mesh(armGeo, M.armorBlack); armR.position.set( 0.42, 1.18, 0.22); armR.rotation.x = -0.7; armR.castShadow = true; g.add(armR);
    // Helmet
    const helmet = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.5, 0.56, 4, 0.1), M.armorBlack);
    helmet.position.y = 1.85; helmet.castShadow = true; g.add(helmet);
    // Visor
    const visor = new THREE.Mesh(new RoundedBoxGeometry(0.45, 0.13, 0.06, 2, 0.02), M.visor);
    visor.position.set(0, 1.86, 0.27); g.add(visor);
    // Backpack
    const pack = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.5, 0.22, 3, 0.06), M.armorMid);
    pack.position.set(0, 1.25, -0.32); pack.castShadow = true; g.add(pack);
    // Magnum (held in front of body, between hands)
    const gun = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.18, 0.32, 3, 0.02), M.gunMetal);
    gun.position.set(0.18, 1.0, 0.55); g.add(gun);
    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.15, 8), M.gunMetal);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0.18, 0.99, 0.74); g.add(gunBarrel);
    this.player.gun = gun;

    g.position.copy(this.player.pos);
    this.scene.add(g);
    this.player.mesh = g;
  },

  /* ============= Mongoose ATV ============= */

  _buildMongoose(){
    const g = new THREE.Group();
    const M = this.mat;

    // Chassis spine — long, narrow, low
    const chassis = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.25, 2.6, 4, 0.08), M.mongOlive);
    chassis.position.y = 0.55; chassis.castShadow = true; g.add(chassis);

    // Front fairing / handlebars
    const fairing = new THREE.Mesh(new RoundedBoxGeometry(0.85, 0.45, 0.6, 4, 0.12), M.mongOlive);
    fairing.position.set(0, 0.85, -1.0); fairing.castShadow = true; g.add(fairing);
    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), M.chrome);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 1.05, -0.85); g.add(handlebar);
    // Headlight on fairing
    const hlight = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), M.headlight);
    hlight.scale.set(1, 0.7, 0.5);
    hlight.position.set(0, 0.9, -1.32); g.add(hlight);

    // Seat
    const seat = new THREE.Mesh(new RoundedBoxGeometry(0.55, 0.18, 0.85, 3, 0.05), M.mongDark);
    seat.position.set(0, 0.78, 0.0); g.add(seat);
    const seatBack = new THREE.Mesh(new RoundedBoxGeometry(0.55, 0.45, 0.15, 3, 0.04), M.mongDark);
    seatBack.position.set(0, 1.0, 0.45); g.add(seatBack);

    // Foot pegs
    const pegL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), M.gunMetal);
    pegL.rotation.z = Math.PI / 2; pegL.position.set(-0.45, 0.42, 0); g.add(pegL);
    const pegR = pegL.clone(); pegR.position.x = 0.45; g.add(pegR);

    // Rear cargo rack (bunch of tubes)
    for (let i = 0; i < 3; i++){
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), M.chrome);
      t.rotation.z = Math.PI / 2;
      t.position.set(0, 0.85 + i * 0.08, 1.05); g.add(t);
    }

    // Front-suspension forks
    const forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), M.chrome);
    forkL.position.set(-0.32, 0.5, -1.05); forkL.rotation.x = -0.25; g.add(forkL);
    const forkR = forkL.clone(); forkR.position.x = 0.32; g.add(forkR);

    // Wheels — 4, fat ATV tires
    const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.32, 18);
    const rimGeo   = new THREE.CylinderGeometry(0.22, 0.22, 0.34, 12);
    const wheelMeshes = [];
    [
      [-0.45, 0.45, -1.0], [0.45, 0.45, -1.0],
      [-0.5,  0.45,  1.0], [0.5,  0.45,  1.0],
    ].forEach(([x, y, z]) => {
      const wg = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, M.tire);
      tire.rotation.z = Math.PI / 2; tire.castShadow = true;
      wg.add(tire);
      const rim = new THREE.Mesh(rimGeo, M.chrome);
      rim.rotation.z = Math.PI / 2; wg.add(rim);
      wg.position.set(x, y, z);
      g.add(wg);
      wheelMeshes.push(wg);
    });

    g.position.set(2.5, 0, 16);
    this.scene.add(g);

    this.mongoose = {
      mesh: g, pos: g.position,
      yaw: 0, speed: 0, steer: 0,
      wheels: wheelMeshes,
      visualYaw: 0,
      radius: 1.0,
    };
  },

  /* ============= Enemies (Grunts) ============= */

  _spawnEnemies(){
    const positions = [
      // 2 on the beach
      [-12, 0, 35, 'beach'],
      [ 18, 0, 28, 'beach'],
      // 2 in hills
      [-22, 0,  -8, 'hills'],
      [ 24, 0, -22, 'hills'],
      // 1 by bunker
      [ 8,  0, -78, 'bunker'],
    ];
    positions.forEach(p => this.enemies.push(this._makeGrunt(p[0], p[2], p[3])));
  },

  _makeGrunt(x, z, zone){
    const g = new THREE.Group();
    const M = this.mat;
    // Squat body
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.7, 0.55, 3, 0.07), M.gruntOrange);
    body.position.y = 0.55; body.castShadow = true; g.add(body);
    // Belly accent
    const belly = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.4, 0.06, 2, 0.03), M.gruntOrangeDark);
    belly.position.set(0, 0.55, 0.27); g.add(belly);
    // Methane tank on back
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 14), M.gruntTank);
    tank.position.set(0, 0.65, -0.36); tank.castShadow = true; g.add(tank);
    const tankCap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), M.gruntTank);
    tankCap.position.set(0, 1.0, -0.36); g.add(tankCap);
    // Hose to head
    const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), M.gruntTank);
    hose.position.set(0.06, 0.95, -0.18); hose.rotation.x = 0.5; g.add(hose);
    // Head — round darker
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12), M.gruntFlesh);
    head.position.y = 1.0; head.castShadow = true; g.add(head);
    // Mask / breather (small front box)
    const mask = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.18, 0.16, 2, 0.04), M.gruntTank);
    mask.position.set(0, 0.92, 0.18); g.add(mask);
    // Plasma pistol
    const pistol = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.18, 0.32, 3, 0.03), M.gruntOrangeDark);
    pistol.position.set(0.32, 0.55, 0.18); g.add(pistol);
    const pistolGlow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.plasmaGreen);
    pistolGlow.position.set(0.32, 0.55, 0.32); g.add(pistolGlow);
    // Legs (stubby)
    const legGeo = new RoundedBoxGeometry(0.22, 0.2, 0.24, 2, 0.03);
    const legL = new THREE.Mesh(legGeo, M.gruntOrangeDark); legL.position.set(-0.16, 0.1, 0); g.add(legL);
    const legR = new THREE.Mesh(legGeo, M.gruntOrangeDark); legR.position.set( 0.16, 0.1, 0); g.add(legR);

    g.position.set(x, 0, z);
    this.scene.add(g);

    return {
      mesh: g, pos: g.position,
      hp: 30, alive: true, zone,
      yaw: Math.random() * Math.PI * 2,
      patrol: new THREE.Vector3(x + (Math.random()-0.5)*16, 0, z + (Math.random()-0.5)*16),
      patrolHold: 0,
      fireCd: 1 + Math.random() * 1.4,
      head, mask, pistolGlow,
      state: 'patrol',
      flinchT: 0,
    };
  },

  /* ============= Pickups (Song Pylons) ============= */

  _spawnPickups(){
    const tracks = (this.ctx.tracks || []).slice(0, 6);
    if (!tracks.length) { this.tracksTotal = 0; return; }
    this.tracksTotal = tracks.length;
    // Hand-placed at landmarks
    const spots = [
      [  6, 0,  16, 'landing'],   // beach near Mongoose
      [-32, 0,  42, 'tide pool'], // beach SW
      [-14, 0, -14, 'hill view'], // mid hills
      [ 20, 0, -36, 'cave entry'],// past hills
      [-26, 0, -68, 'crate'],     // approach to bunker
      [  0, 0, -85, 'bunker'],    // bunker doorstep
    ];
    tracks.forEach((track, i) => {
      const sp = spots[i] || [0, 0, 0, 'unknown'];
      this.pickups.push(this._makePickup(sp[0], sp[2], sp[3], track));
    });
    this._updateMissionHUD();
  },

  _makePickup(x, z, landmarkName, track){
    const g = new THREE.Group();
    const M = this.mat;
    // Beam
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 3.0, 8),
      M.pylonCyan,
    );
    beam.position.y = 1.5; g.add(beam);
    // Outer beam glow (transparent)
    const beamGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 3.0, 8),
      M.pylonCyanDim,
    );
    beamGlow.position.y = 1.5; g.add(beamGlow);
    // Base ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.05, 6, 18),
      M.pylonCyan,
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    // Outer ring
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.025, 6, 22),
      M.pylonCyanDim,
    );
    ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.05; g.add(ring2);
    // Floating title label
    const tex = this._makePickupLabel(track.title);
    const labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const aspect = tex.image.width / tex.image.height;
    const labelW = 2.4;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(labelW, labelW / aspect), labelMat);
    label.position.y = 3.4;
    g.add(label);

    g.position.set(x, 0, z);
    this.scene.add(g);
    return {
      mesh: g, pos: g.position, track, taken: false,
      beam, beamGlow, ring, ring2, label, labelMat,
      index: this.ctx.tracks.indexOf(track),
      landmark: label,
    };
  },

  _makePickupLabel(title){
    const text = (title || '').toUpperCase();
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 160;
    const ctx = c.getContext('2d');
    ctx.font = `700 64px "Space Grotesk", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(68, 224, 255, 0.7)';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#cdf6ff';
    ctx.fillText(text, c.width / 2, c.height / 2);
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  },

  /* ============= Pelican (ambient flyby) ============= */

  _spawnPelicans(){
    for (let i = 0; i < 2; i++){
      const g = new THREE.Group();
      const M = this.mat;
      // Fuselage
      const fuse = new THREE.Mesh(new RoundedBoxGeometry(2.2, 1.2, 5.5, 4, 0.3), M.pelican);
      fuse.position.y = 0; g.add(fuse);
      // Wings
      const wing = new THREE.Mesh(new RoundedBoxGeometry(7.5, 0.18, 1.2, 2, 0.06), M.pelican);
      wing.position.set(0, 0.4, -0.3); g.add(wing);
      // Cockpit
      const cock = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.5, 1.0, 3, 0.1), M.armorMid);
      cock.position.set(0, 0.5, -2.2); g.add(cock);
      // Tail
      const tail = new THREE.Mesh(new RoundedBoxGeometry(0.3, 1.0, 1.2, 2, 0.06), M.pelican);
      tail.position.set(0, 0.8, 2.6); g.add(tail);
      // Thrusters (engine glow)
      [-1.6, 1.6].forEach(x => {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.4, 12), M.pelican);
        t.rotation.x = Math.PI / 2;
        t.position.set(x, 0, -0.5);
        g.add(t);
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), M.pelicanGlow);
        glow.position.set(x, 0, 0.25);
        g.add(glow);
      });
      g.scale.setScalar(1.4);
      g.position.set(-200 + i * 60, 38 + i * 6, -180 + i * 30);
      this.scene.add(g);
      this.pelicans.push({
        mesh: g,
        t: i * 0.4,
        speed: 0.014 + Math.random() * 0.005,
        radius: 220,
        height: 38 + i * 6,
        offset: i * 0.4,
      });
    }
  },

  /* ============= HUD ============= */

  _buildHUD(){
    const root = document.createElement('div');
    root.className = 'hg-hud';
    root.innerHTML = `
      <div class="hg-shield-wrap">
        <div class="hg-bar hg-shield"><div class="hg-bar-fill" id="hg-shield-fill"></div></div>
        <div class="hg-bar hg-health"><div class="hg-bar-fill" id="hg-health-fill"></div></div>
      </div>
      <div class="hg-tl">
        <div class="hg-brand">UNSC · Cartographer Cove</div>
        <div class="hg-meta">ODST recon · Kani · b108</div>
      </div>
      <div class="hg-tr">
        <div class="hg-mission" id="hg-mission">0 / 0 TRACKS</div>
        <a href="/" class="hg-link">← home</a>
      </div>
      <div class="hg-bl">
        <div class="hg-hint" id="hg-hint">WASD move · MOUSE aim · LMB fire · E mount/dismount Mongoose · SHIFT sprint</div>
      </div>
      <div class="hg-prompt" id="hg-prompt"></div>
      <div class="hg-speedo" id="hg-speedo" style="display:none">0 km/h</div>
      <div class="hg-aim-cursor" id="hg-aim-cursor"></div>
      <div class="hg-startgate" id="hg-startgate">
        <div class="hg-startgate-inner">
          <h1>SILENT CARTOGRAPHER</h1>
          <p>Pelican drop confirmed. Recover all <strong>${this.ctx.tracks?.slice(0,6).length || 6}</strong> data shards from the cove. Hostiles on the beach and in the hills. Mongoose is on your six. Move.</p>
          <button class="hg-start" id="hg-start">DEPLOY</button>
          <div class="hg-controls">
            <span><kbd>WASD</kbd> move</span>
            <span><kbd>Mouse</kbd> aim</span>
            <span><kbd>LMB</kbd> fire</span>
            <span><kbd>E</kbd> Mongoose</span>
            <span><kbd>Shift</kbd> sprint</span>
          </div>
        </div>
      </div>
      <div class="hg-song" id="hg-song" style="display:none">
        <div class="hg-song-inner">
          <div class="hg-song-kicker">— shard recovered —</div>
          <h2 class="hg-song-title" id="hg-song-title"></h2>
          <div class="hg-song-meta" id="hg-song-meta"></div>
          <div class="hg-song-actions">
            <button class="hg-btn" data-act="play">▶ play</button>
            <button class="hg-btn hg-btn-dim" data-act="close">close</button>
          </div>
        </div>
      </div>
      <div class="hg-victory" id="hg-victory" style="display:none">
        <div class="hg-victory-inner">
          <div class="hg-victory-kicker">— mission complete —</div>
          <h1>ALL SHARDS RECOVERED</h1>
          <p>Cartographer's data is yours. Pelican inbound for extraction.</p>
          <button class="hg-start" onclick="location.reload()">REDEPLOY</button>
        </div>
      </div>
    `;
    this.container.appendChild(root);
    this.hud = root;
    root.querySelector('#hg-start').addEventListener('click', () => {
      root.querySelector('#hg-startgate').classList.add('off');
    });
    root.querySelectorAll('.hg-song .hg-btn').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        const a = b.dataset.act;
        const songEl = root.querySelector('#hg-song');
        if (a === 'play' && this._activePickup) this.ctx.onPlay?.(this._activePickup.index);
        else if (a === 'close') { songEl.style.display = 'none'; this._activePickup = null; }
      });
    });
  },

  _updateMissionHUD(){
    const el = this.hud?.querySelector('#hg-mission');
    if (el) el.textContent = `${this.tracksRecovered} / ${this.tracksTotal} SHARDS`;
    if (this.tracksRecovered === this.tracksTotal && this.tracksTotal > 0) {
      const v = this.hud?.querySelector('#hg-victory');
      if (v) v.style.display = '';
    }
  },

  _showPrompt(text){
    const el = this.hud?.querySelector('#hg-prompt');
    if (!el) return;
    if (!text) { el.style.display = 'none'; return; }
    el.style.display = ''; el.textContent = text;
  },

  _showSongCard(pickup){
    this._activePickup = pickup;
    const songEl = this.hud.querySelector('#hg-song');
    songEl.querySelector('#hg-song-title').textContent = pickup.track.title.toLowerCase();
    const meta = [];
    if (pickup.track.date) meta.push(new Date(pickup.track.date).getFullYear());
    if (pickup.track.isFeatured) meta.push('featured');
    if (pickup.track.isNew) meta.push('new');
    songEl.querySelector('#hg-song-meta').textContent = meta.join(' · ');
    songEl.style.display = '';
  },

  _updateHealthHUD(){
    const sf = this.hud?.querySelector('#hg-shield-fill');
    const hf = this.hud?.querySelector('#hg-health-fill');
    if (sf) sf.style.width = `${this.player.shields}%`;
    if (hf) hf.style.width = `${this.player.health}%`;
  },

  /* ============= Input ============= */

  _onResize(){
    if (!this.renderer || !this.container) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  },

  _onKeyDown(e){
    if (e.target?.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
    this.keys.add(k);
    if (k === 'e') this._tryInteract();
  },

  _onKeyUp(e){ this.keys.delete(e.key.toLowerCase()); },

  _onMouseDown(e){
    if (e.button === 0) this.mouse.leftDown = true;
    if (this._songOpen()) {
      // Clicking outside the modal closes it
      if (!e.target.closest('.hg-song-inner')) {
        this.hud.querySelector('#hg-song').style.display = 'none';
        this._activePickup = null;
      }
    }
  },

  _onMouseUp(e){ if (e.button === 0) this.mouse.leftDown = false; },

  _onMouseMove(e){
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) / r.width;
    this.mouse.y = (e.clientY - r.top) / r.height;
    this.mouse.ndc.set(this.mouse.x * 2 - 1, -(this.mouse.y * 2 - 1));
    // Update aim cursor element position
    const cur = this.hud?.querySelector('#hg-aim-cursor');
    if (cur) {
      cur.style.left = `${e.clientX - r.left}px`;
      cur.style.top  = `${e.clientY - r.top}px`;
    }
  },

  _songOpen(){ return this.hud && this.hud.querySelector('#hg-song').style.display !== 'none'; },

  _tryInteract(){
    if (this.player.onMongoose) { this._dismount(); return; }
    if (this.mongoose && this.player.pos.distanceTo(this.mongoose.pos) < 2.4) { this._mount(); return; }
  },

  _mount(){
    this.player.onMongoose = true;
    if (this.player.mesh) this.player.mesh.visible = false;
    const sp = this.hud?.querySelector('#hg-speedo'); if (sp) sp.style.display = '';
    const cur = this.hud?.querySelector('#hg-aim-cursor'); if (cur) cur.style.opacity = '0.3';
  },

  _dismount(){
    const m = this.mongoose;
    const side = new THREE.Vector3(1.6, 0, 0).applyAxisAngle(new THREE.Vector3(0,1,0), m.yaw);
    this.player.pos.copy(m.pos).add(side);
    this.player.pos.y = 0;
    this.player.vel.set(0, 0, 0);
    this.player.onMongoose = false;
    if (this.player.mesh) this.player.mesh.visible = true;
    const sp = this.hud?.querySelector('#hg-speedo'); if (sp) sp.style.display = 'none';
    const cur = this.hud?.querySelector('#hg-aim-cursor'); if (cur) cur.style.opacity = '1';
  },

  /* ============= Update loop ============= */

  animate(){
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, this.clock.getDelta());

    if (this.player.onMongoose) this._updateMongoose(dt);
    else                        this._updatePlayer(dt);

    this._updateAim(dt);
    this._updateCamera(dt);
    this._updateEnemies(dt);
    this._updateBullets(dt);
    this._updateEffects(dt);
    this._updatePickups(dt);
    this._updatePelicans(dt);
    this._updateShields(dt);
    this._checkProximity();

    if (this.sea) {
      // Water shimmer — slight UV scroll via offset on the texture (no texture so do nothing real)
      this.sea.position.x = Math.sin(this.clock.elapsedTime * 0.4) * 0.5;
    }

    this.renderer.render(this.scene, this.camera);
  },

  _camBasis(){
    const camFwd = new THREE.Vector3();
    this.camera.getWorldDirection(camFwd);
    camFwd.y = 0; camFwd.normalize();
    const camRight = new THREE.Vector3().crossVectors(camFwd, new THREE.Vector3(0,1,0)).normalize();
    return { camFwd, camRight };
  },

  _readMoveInput(){
    let inX = 0, inZ = 0;
    if (this.keys.has('w') || this.keys.has('arrowup'))    inZ += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown'))  inZ -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) inX += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft'))  inX -= 1;
    const mag = Math.hypot(inX, inZ);
    if (mag > 0.01) { inX /= mag; inZ /= mag; }
    return { inX, inZ, mag };
  },

  _updateAim(dt){
    if (this.player.onMongoose) return;
    // Raycast from mouse to ground plane
    this.ray.setFromCamera(this.mouse.ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(plane, target)) {
      this.mouse.worldPoint.copy(target);
      const dir = new THREE.Vector3().subVectors(target, this.player.pos);
      dir.y = 0;
      if (dir.lengthSq() > 0.01) {
        this.player.aim.copy(dir).normalize();
        // Player faces aim direction
        const targetYaw = Math.atan2(this.player.aim.x, -this.player.aim.z);
        let dy = targetYaw - this.player.yaw;
        while (dy >  Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        this.player.yaw += dy * Math.min(1, dt * 14);
        if (this.player.mesh) this.player.mesh.rotation.y = this.player.yaw;
      }
    }
  },

  _updatePlayer(dt){
    const p = this.player;
    const { inX, inZ, mag } = this._readMoveInput();
    const { camFwd, camRight } = this._camBasis();

    // Movement: world-space desired direction from screen-relative input
    const desired = new THREE.Vector3()
      .addScaledVector(camFwd,   inZ)
      .addScaledVector(camRight, inX);
    const sprinting = this.keys.has('shift');
    const speed = sprinting ? 9.0 : 5.6;
    p.vel.x = desired.x * speed;
    p.vel.z = desired.z * speed;

    // Move with axis-separated AABB collisions
    const tryMove = (axis, amt) => {
      const test = p.pos.clone();
      test[axis] += amt;
      const minX = test.x - p.radius, maxX = test.x + p.radius;
      const minZ = test.z - p.radius, maxZ = test.z + p.radius;
      const minY = test.y, maxY = test.y + p.height;
      for (const o of this.obstacles){
        if (!o.box) continue;
        if (maxX < o.box.min.x || minX > o.box.max.x) continue;
        if (maxZ < o.box.min.z || minZ > o.box.max.z) continue;
        if (maxY < o.box.min.y || minY > o.box.max.y) continue;
        return false;
      }
      return true;
    };
    const dx = p.vel.x * dt, dz = p.vel.z * dt;
    if (tryMove('x', dx)) p.pos.x += dx; else p.vel.x = 0;
    if (tryMove('z', dz)) p.pos.z += dz; else p.vel.z = 0;
    p.pos.y = 0;
    // Map clamp
    const b = this.mapBounds;
    p.pos.x = Math.max(b.minX, Math.min(b.maxX, p.pos.x));
    p.pos.z = Math.max(b.minZ, Math.min(b.maxZ, p.pos.z));

    if (p.mesh) p.mesh.position.copy(p.pos);

    // Firing
    p.fireCd -= dt;
    if (this.mouse.leftDown && p.fireCd <= 0) {
      this._firePlayer();
      p.fireCd = 0.22;
    }

    // Mount prompt
    if (this.mongoose && p.pos.distanceTo(this.mongoose.pos) < 2.4) {
      this._showPrompt('[E] mount Mongoose');
    } else {
      this._showPrompt('');
    }
  },

  _updateMongoose(dt){
    const m = this.mongoose;
    const { inX, inZ, mag } = this._readMoveInput();
    const { camFwd, camRight } = this._camBasis();

    const boost = this.keys.has('shift');
    const maxSpeed = boost ? 32 : 22;
    const accel = boost ? 26 : 18;
    const friction = 7;

    if (mag > 0.01){
      const desired = new THREE.Vector3()
        .addScaledVector(camFwd,   inZ)
        .addScaledVector(camRight, inX)
        .normalize();
      const targetYaw = Math.atan2(desired.x, -desired.z);
      let dy = targetYaw - m.yaw;
      while (dy >  Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      const turnRate = 9 - Math.min(5, Math.abs(m.speed) * 0.18);
      m.yaw += dy * Math.min(1, dt * turnRate);

      const headFwd = new THREE.Vector3(Math.sin(m.yaw), 0, -Math.cos(m.yaw));
      const align = Math.max(0, headFwd.dot(desired));
      m.speed = Math.min(maxSpeed, m.speed + accel * dt * (0.4 + 0.6 * align));
    } else {
      m.speed = Math.max(0, m.speed - friction * dt);
    }

    const fwd = new THREE.Vector3(Math.sin(m.yaw), 0, -Math.cos(m.yaw));
    const move = fwd.clone().multiplyScalar(m.speed * dt);
    const tryAxis = (axis, amt) => {
      const test = m.pos.clone();
      test[axis] += amt;
      for (const o of this.obstacles){
        if (!o.box) continue;
        if (test.x + m.radius > o.box.min.x && test.x - m.radius < o.box.max.x &&
            test.z + m.radius > o.box.min.z && test.z - m.radius < o.box.max.z) return false;
      }
      return true;
    };
    if (tryAxis('x', move.x)) m.pos.x += move.x; else m.speed *= 0.55;
    if (tryAxis('z', move.z)) m.pos.z += move.z; else m.speed *= 0.55;

    // Ramming Grunts
    const sAbs = Math.abs(m.speed);
    if (sAbs > 4){
      for (const e of this.enemies){
        if (!e.alive) continue;
        const dx = e.pos.x - m.pos.x, dz = e.pos.z - m.pos.z;
        if (dx*dx + dz*dz < (m.radius + 0.55) * (m.radius + 0.55)) {
          e.hp = 0;
          this._killEnemy(e);
          if (e.mesh) {
            const o = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(sAbs * 0.12);
            e.mesh.position.x += o.x; e.mesh.position.z += o.z;
          }
        }
      }
    }

    // Map clamp
    const b = this.mapBounds;
    m.pos.x = Math.max(b.minX, Math.min(b.maxX, m.pos.x));
    m.pos.z = Math.max(b.minZ, Math.min(b.maxZ, m.pos.z));

    m.mesh.position.copy(m.pos);
    m.visualYaw += ((m.yaw - m.visualYaw) * Math.min(1, dt * 18));
    m.mesh.rotation.y = m.visualYaw;
    m.wheels.forEach(w => { w.rotation.x += m.speed * dt * 1.6; });

    // Player rides
    this.player.pos.copy(m.pos);
    this.player.pos.y = 1.0;

    // Speedometer
    const sp = this.hud?.querySelector('#hg-speedo');
    if (sp) sp.textContent = `${Math.round(sAbs * 5)} km/h`;
    this._showPrompt('[E] dismount');
  },

  _updateCamera(dt){
    const p = this.player;
    const target = p.onMongoose
      ? new THREE.Vector3(this.mongoose.pos.x + 11, this.mongoose.pos.y + 16, this.mongoose.pos.z + 16)
      : new THREE.Vector3(p.pos.x + 8, p.pos.y + 12, p.pos.z + 12);
    this.camera.position.lerp(target, Math.min(1, dt * 6));
    const lookAt = p.onMongoose
      ? new THREE.Vector3(this.mongoose.pos.x, this.mongoose.pos.y + 0.5, this.mongoose.pos.z)
      : new THREE.Vector3(p.pos.x, p.pos.y + 0.8, p.pos.z);
    this.camera.lookAt(lookAt);
  },

  /* ============= Combat ============= */

  _firePlayer(){
    const p = this.player;
    const origin = new THREE.Vector3(p.pos.x, 1.1, p.pos.z).addScaledVector(p.aim, 0.6);
    const dir = p.aim.clone();

    // Hit-scan (raycast) against enemies
    const ray = new THREE.Raycaster(origin, dir, 0, 80);
    const targets = [];
    this.enemies.forEach(e => {
      if (!e.alive) return;
      e.mesh.traverse(o => { if (o.isMesh) { o.userData.parent = e; targets.push(o); } });
    });
    const hits = ray.intersectObjects(targets, false);
    let hitDist = 80;
    if (hits[0]) {
      const ent = hits[0].object.userData.parent;
      if (ent && this.enemies.includes(ent)) {
        ent.hp -= 22;
        ent.flinchT = 0.15;
        hitDist = hits[0].distance;
        if (ent.hp <= 0) this._killEnemy(ent);
      }
    }

    // Tracer + muzzle flash
    const end = origin.clone().addScaledVector(dir, hitDist);
    const tracerGeo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xfff8c0, transparent: true, opacity: 0.9 }));
    this.scene.add(tracer);
    this.effects.push({ mesh: tracer, life: 0.06, kind: 'tracer' });
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
    flash.position.copy(origin);
    this.scene.add(flash);
    this.effects.push({ mesh: flash, life: 0.06, kind: 'flash' });
  },

  _gruntFire(grunt){
    const p = this.player;
    const start = grunt.pos.clone(); start.y = 0.9;
    const targetPos = p.pos.clone(); targetPos.y = p.onMongoose ? 1.3 : 1.2;
    const dir = new THREE.Vector3().subVectors(targetPos, start);
    dir.y = 0; dir.normalize();
    // Inaccuracy
    dir.x += (Math.random() - 0.5) * 0.07;
    dir.z += (Math.random() - 0.5) * 0.07;
    dir.normalize();

    const m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), this.mat.plasmaGreen);
    m.position.copy(start);
    this.scene.add(m);
    this.bullets.push({
      mesh: m, pos: start.clone(), dir, speed: 36, life: 1.6, damage: 14, fromEnemy: true,
    });
  },

  _updateBullets(dt){
    for (let i = this.bullets.length - 1; i >= 0; i--){
      const b = this.bullets[i];
      b.life -= dt;
      const step = b.dir.clone().multiplyScalar(b.speed * dt);
      b.pos.add(step);
      b.mesh.position.copy(b.pos);
      let dead = b.life <= 0;
      if (b.fromEnemy) {
        const dx = b.pos.x - this.player.pos.x;
        const dz = b.pos.z - this.player.pos.z;
        if (dx*dx + dz*dz < 0.7 * 0.7 && b.pos.y > 0.4 && b.pos.y < 2.0) {
          this._damagePlayer(b.damage);
          dead = true;
        }
      }
      if (dead) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose(); b.mesh.material.dispose?.();
        this.bullets.splice(i, 1);
      }
    }
  },

  _killEnemy(e){
    if (!e.alive) return;
    e.alive = false;
    e.mesh.rotation.x = Math.PI / 2;
    e.mesh.position.y = 0.3;
    setTimeout(() => {
      this.scene.remove(e.mesh);
      e.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose?.(); });
    }, 4500);
  },

  _updateEffects(dt){
    for (let i = this.effects.length - 1; i >= 0; i--){
      const fx = this.effects[i];
      fx.life -= dt;
      if (fx.kind === 'flash') fx.mesh.scale.setScalar(1 + (1 - fx.life / 0.06) * 1.5);
      if (fx.life <= 0){
        this.scene.remove(fx.mesh);
        if (fx.mesh.geometry) fx.mesh.geometry.dispose();
        if (fx.mesh.material) fx.mesh.material.dispose?.();
        this.effects.splice(i, 1);
      }
    }
  },

  /* ============= Enemy AI ============= */

  _updateEnemies(dt){
    const p = this.player;
    for (const e of this.enemies){
      if (!e.alive) continue;
      const toP = new THREE.Vector3().subVectors(p.pos, e.pos); toP.y = 0;
      const dist = toP.length();
      const see = dist < 30 && this._lineOfSight(e.pos, p.pos);
      e.flinchT = Math.max(0, e.flinchT - dt);

      if (see) {
        e.state = 'engage';
        const targetYaw = Math.atan2(toP.x, -toP.z);
        const dy = ((targetYaw - e.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        e.yaw += Math.sign(dy) * Math.min(Math.abs(dy), dt * 4.5);
        // Strafe / approach
        const desiredDist = 11;
        const step = dist > desiredDist + 1 ? 1 : dist < desiredDist - 1 ? -0.4 : 0;
        const fwd = new THREE.Vector3(Math.sin(e.yaw), 0, -Math.cos(e.yaw));
        e.pos.addScaledVector(fwd, 2.0 * step * dt);
        // Fire
        e.fireCd -= dt;
        if (e.fireCd <= 0 && dist < 26) {
          this._gruntFire(e);
          e.fireCd = 1.0 + Math.random() * 0.7;
        }
      } else {
        e.state = 'patrol';
        const tp = e.patrol;
        const toTp = new THREE.Vector3(tp.x - e.pos.x, 0, tp.z - e.pos.z);
        if (toTp.length() < 1.6 || e.patrolHold > 0) {
          if (e.patrolHold <= 0) {
            e.patrolHold = 1.5 + Math.random() * 1.5;
          } else {
            e.patrolHold -= dt;
            if (e.patrolHold <= 0) {
              const baseX = e.zone === 'beach' ? (Math.random() - 0.5) * 50 : e.zone === 'hills' ? (Math.random() - 0.5) * 40 : (Math.random() - 0.5) * 30;
              const baseZ = e.zone === 'beach' ? 20 + Math.random() * 30 : e.zone === 'hills' ? -10 - Math.random() * 30 : -75 + Math.random() * 8;
              e.patrol.set(baseX, 0, baseZ);
            }
          }
        } else {
          const targetYaw = Math.atan2(toTp.x, -toTp.z);
          const dy = ((targetYaw - e.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          e.yaw += Math.sign(dy) * Math.min(Math.abs(dy), dt * 2.2);
          const fwd = new THREE.Vector3(Math.sin(e.yaw), 0, -Math.cos(e.yaw));
          e.pos.addScaledVector(fwd, 1.4 * dt);
        }
      }

      // Visual flinch (lean back when hit)
      e.mesh.position.copy(e.pos);
      e.mesh.rotation.y = e.yaw;
      e.mesh.rotation.x = -e.flinchT * 1.5;
    }
  },

  _lineOfSight(a, b){
    const dir = new THREE.Vector3().subVectors(b, a); dir.y = 0;
    const dist = dir.length();
    dir.normalize();
    const ray = new THREE.Raycaster(a.clone().setY(1.0), dir, 0, dist);
    const meshes = this.obstacles.map(o => o.mesh).filter(m => m);
    const hits = ray.intersectObjects(meshes, true);
    return hits.length === 0;
  },

  /* ============= Pickups, Pelicans, Shields ============= */

  _updatePickups(dt){
    const t = this.clock.elapsedTime;
    for (const pk of this.pickups){
      pk.ring.rotation.z = t * 1.4;
      pk.ring2.rotation.z = -t * 0.9;
      pk.beam.position.y = 1.5 + Math.sin(t * 2 + pk.pos.x) * 0.08;
      // Billboard label
      if (pk.label) pk.label.lookAt(this.camera.position);
      if (pk.taken) {
        pk.beam.material.opacity = Math.max(0.1, (pk.beam.material.opacity ?? 1) - dt * 0.4);
        pk.beam.material.transparent = true;
        pk.beamGlow.material.opacity = Math.max(0.1, pk.beamGlow.material.opacity - dt * 0.4);
      }
    }
  },

  _checkProximity(){
    // Pickup pickup (lol) — drive or walk into a pylon
    const ref = this.player.onMongoose ? this.mongoose.pos : this.player.pos;
    for (const pk of this.pickups){
      if (pk.taken) continue;
      const dx = pk.pos.x - ref.x, dz = pk.pos.z - ref.z;
      if (dx*dx + dz*dz < 1.6 * 1.6) {
        pk.taken = true;
        this.tracksRecovered++;
        this._updateMissionHUD();
        this._showSongCard(pk);
      }
    }
  },

  _updatePelicans(dt){
    for (const p of this.pelicans){
      p.t += p.speed * dt * 60;
      const a = p.t + p.offset;
      p.mesh.position.set(
        Math.cos(a) * p.radius,
        p.height + Math.sin(a * 0.5) * 2,
        Math.sin(a) * p.radius - 50,
      );
      // Face direction of motion (tangent)
      p.mesh.rotation.y = -a + Math.PI / 2;
    }
  },

  _updateShields(dt){
    const p = this.player;
    p.shieldRecharge -= dt;
    if (p.shieldRecharge <= 0 && p.shields < 100) p.shields = Math.min(100, p.shields + 28 * dt);
    this._updateHealthHUD();
  },

  _damagePlayer(amount){
    const p = this.player;
    p.shieldRecharge = 3.5;
    if (p.shields > 0){
      const a = Math.min(p.shields, amount);
      p.shields -= a; amount -= a;
    }
    if (amount > 0) p.health = Math.max(0, p.health - amount);
    this._updateHealthHUD();
    if (p.health <= 0) this._gameOver();
  },

  _gameOver(){
    if (this._dead) return;
    this._dead = true;
    const v = this.hud?.querySelector('#hg-victory');
    if (!v) return;
    v.style.display = '';
    v.querySelector('h1').textContent = 'KIA';
    v.querySelector('p').textContent = 'You were lit up. Reload to redeploy.';
  },

  /* ============= Cleanup ============= */

  destroy(){
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mouseup', this._onMouseUp);
    if (this.renderer) {
      try { this.renderer.dispose(); } catch (e) {}
      try { this.renderer.domElement.remove(); } catch (e) {}
    }
    if (this.scene) {
      this.scene.traverse(o => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach(m => { if (m.map) m.map.dispose?.(); m.dispose?.(); });
        }
      });
    }
    if (this.hud) this.hud.remove();
    this.scene = null; this.camera = null; this.renderer = null;
    this.obstacles = []; this.enemies = []; this.pickups = [];
    this.bullets = []; this.effects = []; this.pelicans = [];
    this.mongoose = null; this.hud = null;
    this.container = null;
  },
};

window.HaloGame = HaloGame;
