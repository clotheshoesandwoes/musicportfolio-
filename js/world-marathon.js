/* =========================================================
   WORLD-MARATHON.JS — Marathon-style cryo bay POC (b053)
   ---------------------------------------------------------
   Self-contained scene inspired by Bungie's Marathon (2026)
   art direction. Activated via the ?style=v2 URL flag, which
   switches the boot view from 'villa' to 'marathon'. Lives
   entirely separately from world.js — does not import,
   modify, or share state with the villa pipeline.

   Visual targets (from the user's reference imagery):
   - Cool blue base palette + lime green accent emissives +
     magenta/red warning accents
   - Heavy volumetric atmospheric haze + god rays from a
     viewport window
   - Real PBR materials (NOT cel shading)
   - Bold stencil decals on floor and wall panels — hazard
     stripes, "CRYO-04", "TRAXUS", numbers, barcodes
   - Crushed shadows, strong rim light, cinematic vignette
   - Bloom only on emissives (threshold 0.92), no surface
     blooming this time

   Scene: Small cryo bay interior on The Marathon ship.
   ~30×30×8 box with a viewport window looking out at the
   moon and the distant Marathon hull. 3 cryo pods along the
   back wall act as click→track triggers (track 0/1/2). Wall
   terminals and ceiling conduits add industrial detail.

   Click→card: clicking a cryo pod calls window.showTrackDetail
   (the official site panel) so playback wires through the
   existing player. Falls back to a local popover if the
   global isn't available.
   ========================================================= */

(function () {
  let scene, camera, renderer, container, canvas;
  let composer = null;
  let raycaster, mouseNDC;
  let animationId, destroyed = false;
  let THREE;
  let onResize;
  const clickTargets = []; // { mesh, trackIndex }
  const dustField = { mesh: null, basePositions: null };

  // Camera (constrained orbit — small interior space)
  let camYaw = 0.55, camPitch = 0.18, camRadius = 22;
  const camCenter = { x: 0, y: 3.5, z: 0 };
  let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0;

  // -------------------------------------------------------
  // PALETTE — tight Marathon-inspired set
  // -------------------------------------------------------
  const PAL = {
    floor:        0x1a2230,   // dark gunmetal blue
    floorAccent:  0x0e1420,   // even darker
    wall:         0xe8e6dc,   // bone white
    wallShadow:   0x6b7080,   // cool gray-blue
    ceiling:      0xc8c8c0,   // off-white
    pipe:         0x2a3140,   // gunmetal
    podShell:     0xd8d6cc,   // bone
    podGlass:     0x88b8c4,   // cool teal glass tint
    limeEmissive: 0x9cff3a,   // lime accent
    magWarning:   0xff2a6e,   // magenta/red warning
    cyanRim:      0x4ad8ff,   // cool window light
    moon:         0xc8d2dc,   // cold lunar gray-blue
    space:        0x020410,   // near-black void
  };

  // -------------------------------------------------------
  // PROCEDURAL DECAL TEXTURES — drawn on canvas at boot.
  // No external assets. The Marathon look leans hard on
  // bold stencil graphics painted onto industrial surfaces,
  // so these are a load-bearing part of the aesthetic.
  // -------------------------------------------------------
  function makeFloorDecalTexture() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 1024;
    const ctx = c.getContext('2d');
    // Dark gunmetal base
    ctx.fillStyle = '#1a2230';
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle panel grid lines
    ctx.strokeStyle = 'rgba(180,200,220,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const p = (i / 8) * 1024;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 1024); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(1024, p); ctx.stroke();
    }

    // Hazard stripe band along one edge (Marathon refs are full of these)
    const stripeY = 60, stripeH = 70;
    ctx.save();
    for (let x = -100; x < 1124; x += 56) {
      ctx.fillStyle = '#e8d220';
      ctx.beginPath();
      ctx.moveTo(x, stripeY);
      ctx.lineTo(x + 28, stripeY);
      ctx.lineTo(x + 28 - stripeH, stripeY + stripeH);
      ctx.lineTo(x - stripeH, stripeY + stripeH);
      ctx.closePath();
      ctx.fill();
    }
    // Black gaps between
    for (let x = -100 + 28; x < 1124; x += 56) {
      ctx.fillStyle = '#0e1420';
      ctx.beginPath();
      ctx.moveTo(x, stripeY);
      ctx.lineTo(x + 28, stripeY);
      ctx.lineTo(x + 28 - stripeH, stripeY + stripeH);
      ctx.lineTo(x - stripeH, stripeY + stripeH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Big stencil text
    ctx.fillStyle = 'rgba(232,230,220,0.55)';
    ctx.font = 'bold 84px "JetBrains Mono", monospace';
    ctx.fillText('CRYO BAY 04', 80, 360);
    ctx.font = 'bold 36px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(232,230,220,0.35)';
    ctx.fillText('TRAXUS // SECTOR W6', 80, 410);
    ctx.fillText('AUTH 273-04R', 80, 450);

    // Warning triangle
    ctx.save();
    ctx.translate(700, 720);
    ctx.strokeStyle = '#e8d220';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, -80);
    ctx.lineTo(70, 50);
    ctx.lineTo(-70, 50);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#e8d220';
    ctx.font = 'bold 80px "JetBrains Mono", monospace';
    ctx.fillText('!', -16, 32);
    ctx.restore();

    // Random panel screws/rivets
    ctx.fillStyle = 'rgba(180,200,220,0.15)';
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Small directional arrows
    ctx.strokeStyle = 'rgba(232,230,220,0.40)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      const ax = 200 + i * 200, ay = 850;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + 60, ay);
      ctx.moveTo(ax + 60, ay);
      ctx.lineTo(ax + 50, ay - 10);
      ctx.moveTo(ax + 60, ay);
      ctx.lineTo(ax + 50, ay + 10);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeWallDecalTexture() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const ctx = c.getContext('2d');
    // Bone white base
    ctx.fillStyle = '#e8e6dc';
    ctx.fillRect(0, 0, 1024, 512);

    // Big perforated dot grid (inspired by your reference image #3)
    ctx.fillStyle = 'rgba(140,150,170,0.14)';
    for (let y = 30; y < 512; y += 18) {
      for (let x = 30; x < 1024; x += 18) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bold black stencil block on left
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(60, 60, 320, 110);
    ctx.fillStyle = '#9cff3a';
    ctx.font = 'bold 64px "JetBrains Mono", monospace';
    ctx.fillText('TRAXUS', 80, 140);

    // Subtitle
    ctx.fillStyle = '#0e1420';
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.fillText('CRYO STORAGE // BLOCK W6', 60, 200);
    ctx.font = '18px "JetBrains Mono", monospace';
    ctx.fillText('CONTENTS PRESSURIZED — CLASS III', 60, 226);
    ctx.fillText('DO NOT BREACH SEAL', 60, 248);

    // QR-code-ish square
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(820, 60, 140, 140);
    ctx.fillStyle = '#e8e6dc';
    for (let y = 0; y < 14; y++) {
      for (let x = 0; x < 14; x++) {
        if (Math.random() > 0.55) ctx.fillRect(826 + x * 10, 66 + y * 10, 8, 8);
      }
    }
    // QR finder corners
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(826, 66, 30, 30);
    ctx.fillRect(826, 174, 30, 26);
    ctx.fillRect(934, 66, 26, 30);
    ctx.fillStyle = '#e8e6dc';
    ctx.fillRect(832, 72, 18, 18);
    ctx.fillRect(832, 180, 18, 14);
    ctx.fillRect(940, 72, 14, 18);

    // Barcode
    ctx.fillStyle = '#0e1420';
    let bx = 60;
    while (bx < 760) {
      const w = 1 + Math.floor(Math.random() * 4);
      ctx.fillRect(bx, 380, w, 70);
      bx += w + 1 + Math.floor(Math.random() * 3);
    }
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillText('8123937 BMP TB_0004', 60, 470);

    // Lime accent strip (Marathon refs love this)
    ctx.fillStyle = '#9cff3a';
    ctx.fillRect(820, 380, 160, 12);
    ctx.fillStyle = '#0e1420';
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.fillText('CONNECT', 824, 410);
    ctx.fillText('+', 950, 410);

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makePodLabelTexture(podNumber) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d8d6cc';
    ctx.fillRect(0, 0, 512, 256);

    // Black header bar
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, 0, 512, 60);
    ctx.fillStyle = '#9cff3a';
    ctx.font = 'bold 36px "JetBrains Mono", monospace';
    ctx.fillText(`CRYO-0${podNumber}`, 24, 44);
    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.fillStyle = '#9cff3a';
    ctx.fillText('● ACTIVE', 360, 38);

    // Body labels
    ctx.fillStyle = '#0e1420';
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillText('SUBJECT', 24, 100);
    ctx.fillText('STATUS', 24, 130);
    ctx.fillText('TEMP', 24, 160);
    ctx.fillText('DUR', 24, 190);

    ctx.font = '18px "JetBrains Mono", monospace';
    ctx.fillStyle = '#2a3140';
    ctx.fillText(`R${273 + podNumber} / KANI`, 140, 100);
    ctx.fillText('SUSPENDED', 140, 130);
    ctx.fillText('-196.0 °C', 140, 160);
    ctx.fillText('∞', 140, 190);

    // Hazard stripe at bottom
    for (let x = 0; x < 512; x += 32) {
      ctx.fillStyle = (x / 32) % 2 === 0 ? '#e8d220' : '#0e1420';
      ctx.fillRect(x, 220, 32, 36);
    }

    // QR
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(420, 80, 70, 70);
    ctx.fillStyle = '#d8d6cc';
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++)
        if (Math.random() > 0.55) ctx.fillRect(425 + x * 10, 85 + y * 10, 8, 8);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // -------------------------------------------------------
  // ROOM SHELL — floor, ceiling, 4 walls (one with viewport
  // cutout). Uses real PBR. Walls and floor get the
  // procedural decal textures.
  // -------------------------------------------------------
  function buildRoom() {
    const W = 30, D = 30, H = 9;

    // Floor
    const floorTex = makeFloorDecalTexture();
    floorTex.repeat.set(1, 1);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.30,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    // Ceiling
    const ceilMat = new THREE.MeshStandardMaterial({
      color: PAL.ceiling,
      roughness: 0.85,
      metalness: 0.05,
    });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = H;
    scene.add(ceil);

    // Ceiling strip lights — emissive bone white bars
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xeaf2ff,
      emissiveIntensity: 1.2,
      roughness: 0.4,
    });
    for (let i = -1; i <= 1; i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 22), stripMat);
      strip.position.set(i * 8, H - 0.08, 0);
      scene.add(strip);
    }

    // Back wall (z = -D/2) — solid bone white with decal
    const wallTex = makeWallDecalTexture();
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      color: 0xffffff,
      roughness: 0.65,
      metalness: 0.10,
    });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
    backWall.position.set(0, H / 2, -D / 2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Left wall (x = -W/2)
    const sideMat = new THREE.MeshStandardMaterial({
      color: PAL.wall, roughness: 0.7, metalness: 0.10,
    });
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(D, H), sideMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-W / 2, H / 2, 0);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(D, H), sideMat.clone());
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(W / 2, H / 2, 0);
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // Front wall (z = +D/2) WITH a viewport cutout. Build it
    // as 4 strips around a central window opening.
    const winW = 14, winH = 5;
    const winY = 4.0;
    const frontMat = sideMat.clone();
    // top strip
    const topStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H - (winY + winH / 2)),
      frontMat
    );
    topStrip.rotation.y = Math.PI;
    topStrip.position.set(0, (H + winY + winH / 2) / 2, D / 2);
    scene.add(topStrip);
    // bottom strip
    const botStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(W, winY - winH / 2),
      frontMat
    );
    botStrip.rotation.y = Math.PI;
    botStrip.position.set(0, (winY - winH / 2) / 2, D / 2);
    scene.add(botStrip);
    // left strip
    const lStrip = new THREE.Mesh(
      new THREE.PlaneGeometry((W - winW) / 2, winH),
      frontMat
    );
    lStrip.rotation.y = Math.PI;
    lStrip.position.set(-(W + winW) / 4, winY, D / 2);
    scene.add(lStrip);
    // right strip
    const rStrip = new THREE.Mesh(
      new THREE.PlaneGeometry((W - winW) / 2, winH),
      frontMat
    );
    rStrip.rotation.y = Math.PI;
    rStrip.position.set((W + winW) / 4, winY, D / 2);
    scene.add(rStrip);

    // Window frame — thin black border around the cutout
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x0e1420, roughness: 0.4, metalness: 0.6,
    });
    const fT = 0.25;
    const frameTop = new THREE.Mesh(
      new THREE.BoxGeometry(winW + fT * 2, fT, 0.3),
      frameMat
    );
    frameTop.position.set(0, winY + winH / 2, D / 2 - 0.05);
    scene.add(frameTop);
    const frameBot = new THREE.Mesh(
      new THREE.BoxGeometry(winW + fT * 2, fT, 0.3),
      frameMat
    );
    frameBot.position.set(0, winY - winH / 2, D / 2 - 0.05);
    scene.add(frameBot);
    const frameL = new THREE.Mesh(
      new THREE.BoxGeometry(fT, winH, 0.3),
      frameMat
    );
    frameL.position.set(-winW / 2, winY, D / 2 - 0.05);
    scene.add(frameL);
    const frameR = new THREE.Mesh(
      new THREE.BoxGeometry(fT, winH, 0.3),
      frameMat
    );
    frameR.position.set(winW / 2, winY, D / 2 - 0.05);
    scene.add(frameR);

    return { W, D, H, winW, winH, winY };
  }

  // -------------------------------------------------------
  // CRYO POD — cylinder + dome top + label panel + lime
  // status light. Click target with trackIndex.
  // -------------------------------------------------------
  function buildCryoPod(x, z, podNumber, trackIndex) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Base pedestal
    const baseMat = new THREE.MeshStandardMaterial({
      color: PAL.pipe, roughness: 0.5, metalness: 0.7,
    });
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.15, 0.4, 24),
      baseMat
    );
    base.position.y = 0.2;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Glass cylinder
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: PAL.podGlass,
      roughness: 0.10,
      metalness: 0.0,
      transmission: 0.85,
      thickness: 0.5,
      transparent: true,
      opacity: 0.55,
      ior: 1.4,
      clearcoat: 1.0,
      clearcoatRoughness: 0.15,
    });
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 4.4, 24, 1, true),
      glassMat
    );
    glass.position.y = 0.4 + 2.2;
    group.add(glass);

    // Dome top
    const domeMat = new THREE.MeshStandardMaterial({
      color: PAL.podShell, roughness: 0.4, metalness: 0.2,
    });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      domeMat
    );
    dome.position.y = 0.4 + 4.4;
    dome.castShadow = true;
    group.add(dome);

    // Lime status light on top of dome
    const lightMat = new THREE.MeshStandardMaterial({
      color: PAL.limeEmissive,
      emissive: PAL.limeEmissive,
      emissiveIntensity: 4.0,
    });
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 8),
      lightMat
    );
    light.position.y = 0.4 + 4.4 + 0.78;
    group.add(light);

    // Internal silhouette — dark vertical figure hint inside
    const figMat = new THREE.MeshStandardMaterial({
      color: 0x0a1018, roughness: 0.9,
    });
    const figure = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 2.0, 4, 8),
      figMat
    );
    figure.position.y = 0.4 + 1.7;
    group.add(figure);

    // Label panel on the front of the pedestal
    const labelTex = makePodLabelTexture(podNumber);
    const labelMat = new THREE.MeshStandardMaterial({
      map: labelTex,
      emissive: 0xffffff,
      emissiveMap: labelTex,
      emissiveIntensity: 0.35,
      roughness: 0.6,
    });
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.7),
      labelMat
    );
    label.position.set(0, 1.2, 0.92);
    group.add(label);

    // Lime point light per pod (small radius — accent only)
    const podLight = new THREE.PointLight(PAL.limeEmissive, 8, 6, 2);
    podLight.position.set(0, 3.0, 0.5);
    group.add(podLight);

    // Click target — invisible bigger box around the pod for
    // easier hit testing
    const clickBox = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 5.5, 2.5),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    clickBox.position.y = 2.6;
    group.add(clickBox);
    clickTargets.push({ mesh: clickBox, trackIndex });

    scene.add(group);
    return group;
  }

  // -------------------------------------------------------
  // CEILING CONDUITS — pipes hanging across the ceiling.
  // Marathon interiors are dense with this kind of clutter.
  // -------------------------------------------------------
  function buildConduits() {
    const pipeMat = new THREE.MeshStandardMaterial({
      color: PAL.pipe, roughness: 0.5, metalness: 0.7,
    });
    // Long horizontal pipes running x-axis
    for (let i = 0; i < 4; i++) {
      const z = -10 + i * 6.6;
      const p = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 28, 12),
        pipeMat
      );
      p.rotation.z = Math.PI / 2;
      p.position.set(0, 8.4, z);
      p.castShadow = true;
      scene.add(p);

      // Hangers
      for (let j = -2; j <= 2; j++) {
        const h = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.4, 0.06),
          pipeMat
        );
        h.position.set(j * 6, 8.7, z);
        scene.add(h);
      }
    }
    // Lime accent conduit
    const limeMat = new THREE.MeshStandardMaterial({
      color: PAL.limeEmissive,
      emissive: PAL.limeEmissive,
      emissiveIntensity: 1.2,
      roughness: 0.4,
    });
    const limePipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, 28, 12),
      limeMat
    );
    limePipe.rotation.z = Math.PI / 2;
    limePipe.position.set(0, 8.15, -2);
    scene.add(limePipe);
  }

  // -------------------------------------------------------
  // WALL TERMINAL — a simple inset screen unit on the side
  // wall. Adds emissive screen detail.
  // -------------------------------------------------------
  function buildWallTerminal(x, z, rotY) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotY;

    // Frame
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1a1f28, roughness: 0.4, metalness: 0.7,
    });
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.8, 0.25),
      frameMat
    );
    frame.position.set(0, 4.0, 0);
    group.add(frame);

    // Screen — emissive cyan
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x4ad8ff,
      emissive: 0x4ad8ff,
      emissiveIntensity: 2.0,
    });
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 1.4),
      screenMat
    );
    screen.position.set(0, 4.0, 0.13);
    group.add(screen);

    // Magenta warning strip below
    const warnMat = new THREE.MeshStandardMaterial({
      color: PAL.magWarning,
      emissive: PAL.magWarning,
      emissiveIntensity: 1.8,
    });
    const warn = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.10, 0.27),
      warnMat
    );
    warn.position.set(0, 2.95, 0);
    group.add(warn);

    scene.add(group);
  }

  // -------------------------------------------------------
  // VIEWPORT BACKDROP — outside the front-wall window we
  // place a starfield, a moon disc, and the silhouette of
  // The Marathon ship's hull. All sit far away and the
  // window cutout reveals them naturally.
  // -------------------------------------------------------
  function buildViewport(roomDims) {
    const { D } = roomDims;

    // Big black space backdrop sphere
    const spaceMat = new THREE.MeshBasicMaterial({
      color: PAL.space, side: THREE.BackSide,
    });
    const spaceDome = new THREE.Mesh(
      new THREE.SphereGeometry(220, 24, 16),
      spaceMat
    );
    scene.add(spaceDome);

    // Starfield — 600 small white points
    const starGeo = new THREE.BufferGeometry();
    const starPositions = [];
    for (let i = 0; i < 600; i++) {
      const r = 200;
      const u = Math.random(), v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      starPositions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xeaf2ff, size: 0.6, sizeAttenuation: true,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // Moon — large emissive sphere offset to one side of the window
    const moonMat = new THREE.MeshStandardMaterial({
      color: PAL.moon,
      emissive: 0x6088a8,
      emissiveIntensity: 0.6,
      roughness: 0.95,
    });
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(28, 32, 24),
      moonMat
    );
    moon.position.set(-25, 22, D / 2 + 130);
    scene.add(moon);

    // Marathon ship hull — a long dark slab silhouette below the
    // window. Just suggestive geometry, not a real model.
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x10151c, roughness: 0.7, metalness: 0.4,
      emissive: 0x88b8c4, emissiveIntensity: 0.04,
    });
    const hullMain = new THREE.Mesh(
      new THREE.BoxGeometry(120, 12, 26),
      hullMat
    );
    hullMain.position.set(15, -8, D / 2 + 60);
    scene.add(hullMain);
    // Hull tower
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(18, 8, 14),
      hullMat
    );
    tower.position.set(35, -2, D / 2 + 60);
    scene.add(tower);
    // Tiny hull lights — magenta + lime accent points
    const dotMat1 = new THREE.MeshBasicMaterial({ color: PAL.magWarning });
    const dotMat2 = new THREE.MeshBasicMaterial({ color: PAL.limeEmissive });
    for (let i = 0; i < 20; i++) {
      const m = (i % 2 === 0) ? dotMat1 : dotMat2;
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 6, 4),
        m
      );
      dot.position.set(
        -40 + i * 6,
        -3 + Math.sin(i) * 1,
        D / 2 + 48
      );
      scene.add(dot);
    }
  }

  // -------------------------------------------------------
  // GOD RAYS — additive cone meshes pouring from the window
  // into the bay. Cheap volumetric trick: a few wedge planes
  // with additive blending and a soft falloff shader.
  // -------------------------------------------------------
  function buildGodRays(roomDims) {
    const { D, winY, winW, winH } = roomDims;
    const rayMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(0x88c8ff) },
        uIntensity: { value: 0.18 },
      },
      vertexShader: `
        varying vec3 vLocal;
        void main() {
          vLocal = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec3 vLocal;
        void main() {
          // Falloff from window plane outward, plus soft edges
          float d = clamp(1.0 - abs(vLocal.x) / 4.0, 0.0, 1.0);
          float l = clamp(1.0 - (-vLocal.z) / 26.0, 0.0, 1.0);
          float a = pow(d, 2.0) * pow(l, 1.4) * uIntensity;
          gl_FragColor = vec4(uColor * a * 4.0, a);
        }
      `,
    });

    // 4 stacked wedge planes from the window slanting inward
    for (let i = 0; i < 4; i++) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(8, 26), rayMat);
      plane.position.set(0, winY + (i - 1.5) * 0.8, D / 2 - 13);
      plane.rotation.x = Math.PI / 2;
      plane.rotation.z = (i - 1.5) * 0.06;
      scene.add(plane);
    }
  }

  // -------------------------------------------------------
  // DUST PARTICLES — drifting points in the bay catch the
  // god rays and the bloom. Subtle but sells the haze.
  // -------------------------------------------------------
  function buildDust() {
    const N = 220;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const base = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 24;
      pos[i * 3 + 1] = Math.random() * 8 + 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 24;
      base[i * 3 + 0] = pos[i * 3 + 0];
      base[i * 3 + 1] = pos[i * 3 + 1];
      base[i * 3 + 2] = pos[i * 3 + 2];
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xeaf2ff,
      size: 0.06,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
      depthWrite: false,
    });
    dustField.mesh = new THREE.Points(geo, mat);
    dustField.basePositions = base;
    scene.add(dustField.mesh);
  }

  // -------------------------------------------------------
  // LIGHTING — cool blue ambient + cyan window key + a
  // couple of magenta warning accents on the side walls.
  // -------------------------------------------------------
  function buildLighting(roomDims) {
    const { D, winY } = roomDims;

    // Ambient — cool dark blue, low intensity
    scene.add(new THREE.AmbientLight(0x1a2a40, 0.55));

    // Hemisphere — cyan top, dark blue bottom
    const hemi = new THREE.HemisphereLight(0x6090b0, 0x0a1018, 0.45);
    scene.add(hemi);

    // Directional from outside the window (cyan-white)
    const sun = new THREE.DirectionalLight(0xc8e8ff, 1.6);
    sun.position.set(0, winY + 4, D / 2 + 14);
    sun.target.position.set(0, 1, -8);
    scene.add(sun);
    scene.add(sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -16;
    sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -8;
    sun.shadow.bias = -0.0005;

    // Magenta warning point lights on the side walls
    const m1 = new THREE.PointLight(PAL.magWarning, 4, 12, 2);
    m1.position.set(-13, 5, -8);
    scene.add(m1);
    const m2 = new THREE.PointLight(PAL.magWarning, 4, 12, 2);
    m2.position.set(13, 5, 8);
    scene.add(m2);
  }

  // -------------------------------------------------------
  // POST-PROCESSING — ACES + bloom (high threshold so only
  // the lime/cyan/magenta accents bloom) + finishing
  // shader pass (vignette, grain, slight chromatic
  // aberration) + OutputPass.
  // -------------------------------------------------------
  async function buildComposer() {
    try {
      const [
        { EffectComposer },
        { RenderPass },
        { UnrealBloomPass },
        { ShaderPass },
        { OutputPass },
      ] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/ShaderPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
      ]);

      const w = container.clientWidth, h = container.clientHeight;
      composer = new EffectComposer(renderer);
      composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      composer.setSize(w, h);

      composer.addPass(new RenderPass(scene, camera));

      // High threshold — only the lime status lights, the cyan
      // terminals, the strip lights, and the moon will bloom.
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(w, h),
        1.05,   // strength — heavy
        0.7,    // radius — wide soft halo
        0.92    // threshold — only bright emissives
      );
      composer.addPass(bloom);

      const finishShader = {
        uniforms: {
          tDiffuse:  { value: null },
          uTime:     { value: 0 },
          uVignette: { value: 1.45 },
          uGrain:    { value: 0.06 },
          uChroma:   { value: 0.0025 },
          uLift:     { value: new THREE.Vector3(0.000, 0.005, 0.020) },
          uGamma:    { value: new THREE.Vector3(1.05, 1.02, 1.00) },
          uGain:     { value: new THREE.Vector3(1.00, 1.04, 1.10) },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform float uTime;
          uniform float uVignette;
          uniform float uGrain;
          uniform float uChroma;
          uniform vec3 uLift;
          uniform vec3 uGamma;
          uniform vec3 uGain;
          varying vec2 vUv;

          float hash(vec2 p) {
            p = fract(p * vec2(443.897, 441.423));
            p += dot(p, p + 19.19);
            return fract((p.x + p.y) * p.x);
          }

          vec3 lgg(vec3 c) {
            c = c * uGain + uLift;
            c = pow(max(c, 0.0), 1.0 / max(uGamma, vec3(0.001)));
            return c;
          }

          void main() {
            // Subtle chromatic aberration sampled radially
            vec2 d = vUv - 0.5;
            float r = length(d);
            vec2 dir = (r > 0.0001) ? d / r : vec2(0.0);
            vec3 col;
            col.r = texture2D(tDiffuse, vUv + dir * uChroma * r).r;
            col.g = texture2D(tDiffuse, vUv).g;
            col.b = texture2D(tDiffuse, vUv - dir * uChroma * r).b;

            col = lgg(col);

            // Strong vignette
            float vig = 1.0 - dot(d, d) * uVignette;
            vig = clamp(vig, 0.0, 1.0);
            col *= vig;

            // Animated grain
            float g = hash(vUv * vec2(1920.0, 1080.0) + uTime * 60.0);
            col += (g - 0.5) * uGrain;

            gl_FragColor = vec4(col, 1.0);
          }
        `,
      };
      const finishPass = new ShaderPass(finishShader);
      composer.addPass(finishPass);
      composer._finishPass = finishPass;

      composer.addPass(new OutputPass());
    } catch (e) {
      console.warn('[marathon] composer load failed, falling back to direct render', e);
      composer = null;
    }
  }

  // -------------------------------------------------------
  // CLICK CARD — prefer the official site track-detail
  // panel. Fall back to a small standalone popover.
  // -------------------------------------------------------
  function openTrackCard(trackIndex, x, y) {
    if (typeof window.showTrackDetail === 'function' &&
        window.tracks && window.tracks[trackIndex]) {
      window.showTrackDetail(trackIndex);
      return;
    }
    // Fallback — local card
    closeCard();
    const t = (window.tracks && window.tracks[trackIndex]) || {
      title: 'Sample Track', artist: 'Kani'
    };
    const card = document.createElement('div');
    card.id = 'marathonCard';
    card.style.cssText = `
      position: fixed;
      left: ${Math.min(window.innerWidth - 280, Math.max(20, x))}px;
      top:  ${Math.min(window.innerHeight - 200, Math.max(20, y))}px;
      width: 260px;
      padding: 18px;
      background: rgba(14, 20, 32, 0.95);
      color: #e8e6dc;
      font-family: 'JetBrains Mono', monospace;
      border: 1px solid #9cff3a;
      border-radius: 2px;
      box-shadow: 0 0 30px rgba(156, 255, 58, 0.3);
      z-index: 9999;
    `;
    card.innerHTML = `
      <div style="font-size:10px; letter-spacing:0.18em; color:#9cff3a; margin-bottom:6px;">CRYO-0${trackIndex + 4} // SUBJECT R${273 + trackIndex}</div>
      <div style="font-size:18px; font-weight:600; margin-bottom:4px;">${t.title || 'Sample Track'}</div>
      <div style="font-size:12px; opacity:0.65; margin-bottom:14px;">Kani · TRAXUS // SECTOR W6</div>
      <button id="marathonCardClose" style="
        background: #9cff3a; color: #0e1420;
        border: none; padding: 8px 16px; font-size: 11px;
        font-family: inherit; cursor: pointer;
        letter-spacing: 0.10em; font-weight:700;
      ">CLOSE</button>
    `;
    document.body.appendChild(card);
    card.querySelector('#marathonCardClose').addEventListener('click', closeCard);
  }
  function closeCard() {
    const c = document.getElementById('marathonCard');
    if (c) c.remove();
  }

  // -------------------------------------------------------
  // CAMERA — constrained orbit (small interior space)
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
    lastX = downX = e.clientX;
    lastY = downY = e.clientY;
  }
  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    camYaw   -= dx * 0.005;
    camPitch += dy * 0.005;
    camPitch = Math.max(-0.10, Math.min(1.20, camPitch));
    updateCamera();
  }
  function onPointerUp() { dragging = false; }
  function onWheel(e) {
    e.preventDefault();
    camRadius *= (1 + e.deltaY * 0.0015);
    camRadius = Math.max(8, Math.min(38, camRadius));
    updateCamera();
  }
  function onClick(e) {
    if (Math.abs(e.clientX - downX) > 4 || Math.abs(e.clientY - downY) > 4) return;
    const rect = canvas.getBoundingClientRect();
    mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouseNDC, camera);
    const meshes = clickTargets.map(t => t.mesh);
    const hits = raycaster.intersectObjects(meshes, true);
    if (hits.length > 0) {
      const target = clickTargets.find(t => t.mesh === hits[0].object);
      if (target) openTrackCard(target.trackIndex, e.clientX, e.clientY);
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
      <div class="world-loader-text">LOADING CRYO BAY 04</div>
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.setClearColor(PAL.space, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // ACES + sRGB — OutputPass at the end of the composer reads these
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    // Heavy cool blue fog — sells the atmospheric haze
    scene.fog = new THREE.FogExp2(0x0a1828, 0.045);

    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 600);

    raycaster = new THREE.Raycaster();
    mouseNDC = new THREE.Vector2();

    // Build the scene
    const roomDims = buildRoom();
    buildConduits();
    buildCryoPod(-6, -10, 4, 0);
    buildCryoPod( 0, -10, 5, 1);
    buildCryoPod( 6, -10, 6, 2);
    buildWallTerminal(-14.85, -4, Math.PI / 2);
    buildWallTerminal( 14.85,  4, -Math.PI / 2);
    buildViewport(roomDims);
    buildGodRays(roomDims);
    buildDust();
    buildLighting(roomDims);

    updateCamera();

    // Build the post-processing chain (async — can take a tick)
    await buildComposer();

    // Listeners
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('click', onClick);
    onResize = () => {
      if (!renderer || !container) return;
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (composer) composer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    loader.remove();

    // Animate
    const t0 = performance.now();
    function tick() {
      if (destroyed) return;
      const t = (performance.now() - t0) * 0.001;

      // Drift dust particles
      if (dustField.mesh) {
        const arr = dustField.mesh.geometry.attributes.position.array;
        const base = dustField.basePositions;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i + 0] = base[i + 0] + Math.sin(t * 0.3 + i * 0.13) * 0.4;
          arr[i + 1] = base[i + 1] + Math.sin(t * 0.5 + i * 0.21) * 0.25;
          arr[i + 2] = base[i + 2] + Math.cos(t * 0.4 + i * 0.17) * 0.4;
        }
        dustField.mesh.geometry.attributes.position.needsUpdate = true;
      }

      if (composer) {
        if (composer._finishPass) composer._finishPass.uniforms.uTime.value = t;
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
      animationId = requestAnimationFrame(tick);
    }
    tick();
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
    if (onResize) window.removeEventListener('resize', onResize);
    onResize = null;
    if (composer) {
      if (composer.dispose) composer.dispose();
      composer = null;
    }
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
    if (container) container.innerHTML = '';
    clickTargets.length = 0;
    dustField.mesh = null;
    dustField.basePositions = null;
  }

  registerView('marathon', { init, destroy });
})();
