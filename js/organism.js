/* =========================================================
   ORGANISM.JS — "The Organism" view (b073)
   ---------------------------------------------------------
   Your entire discography is a living biological entity.
   A pulsing core floats at the center. Track nodes orbit
   in a golden-angle spiral. Tendrils connect nodes to the
   core, veins link nearby nodes. Everything breathes.
   Hover pulls nodes toward you. Click plays a track —
   the organism's heartbeat syncs to bass, colors shift,
   tendrils pulse. The more tracks you play, the more the
   organism evolves visually.

   Full-canvas 2D, no dependencies.
   ========================================================= */

(function () {
  /* ----- constants ----- */
  const GOLDEN_ANGLE = 2.39996323;  // radians
  const CORE_BASE_R = 60;
  const NODE_R = 5;
  const NODE_HOVER_R = 14;
  const TENDRIL_SEGMENTS = 20;
  const AMBIENT_PARTICLES = 80;
  const BEAT_THRESHOLD = 0.32;
  const BEAT_COOLDOWN = 300;

  /* ----- state ----- */
  let canvas, ctx, container;
  let W, H, rafId;
  let mx = -9999, my = -9999;
  let nodes = [];           // { x, y, baseX, baseY, angle, dist, index, colors, title }
  let ambientParts = [];    // { x, y, vx, vy, r, alpha, color }
  let playedSet = new Set();
  let coreX, coreY;
  let corePhase = 0;
  let beatPulse = 0;
  let lastBeatTime = 0;
  let hovered = -1;
  let dragStart = null;
  let rotationOffset = 0;
  let zoom = 1;
  let targetZoom = 1;
  let panX = 0, panY = 0;
  let toastText = '';
  let toastUntil = 0;
  let t0 = 0;

  /* ----- helpers ----- */
  function hexToRGBA(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(x1, y1, x2, y2) { return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2); }

  /* ----- init ----- */
  function init(viewContainer) {
    container = viewContainer;

    canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;display:block;cursor:grab;';
    container.appendChild(canvas);

    resize();
    buildNodes();
    buildAmbient();

    container.addEventListener('mousemove', onMouse);
    container.addEventListener('mouseleave', onLeave);
    container.addEventListener('touchmove', onTouch, { passive: true });
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('click', onClick);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('mousedown', onDragStart);
    container.addEventListener('mouseup', onDragEnd);
    window.addEventListener('resize', resize);

    t0 = performance.now();
    rafId = requestAnimationFrame(draw);
  }

  function destroy() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    window.removeEventListener('resize', resize);
    if (container) {
      container.removeEventListener('mousemove', onMouse);
      container.removeEventListener('mouseleave', onLeave);
      container.removeEventListener('touchmove', onTouch);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('click', onClick);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('mousedown', onDragStart);
      container.removeEventListener('mouseup', onDragEnd);
    }
    canvas = ctx = container = null;
    nodes = [];
    ambientParts = [];
    playedSet = new Set();
  }

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    coreX = W / 2;
    coreY = H / 2;
    if (nodes.length) positionNodes();
  }

  /* ----- build nodes in golden-angle spiral ----- */
  function buildNodes() {
    nodes = [];
    const filtered = getFilteredTracks();
    filtered.forEach((track, i) => {
      const colors = getGradientColors(track.originalIndex);
      nodes.push({
        index: track.originalIndex,
        title: track.title,
        colors,
        baseX: 0, baseY: 0,
        x: 0, y: 0,
        angle: 0, dist: 0,
      });
    });
    positionNodes();
  }

  function positionNodes() {
    const maxR = Math.min(W, H) * 0.42;
    const n = nodes.length;
    for (let i = 0; i < n; i++) {
      const frac = (i + 1) / (n + 1);
      const r = Math.sqrt(frac) * maxR;
      const angle = i * GOLDEN_ANGLE + rotationOffset;
      nodes[i].angle = angle;
      nodes[i].dist = r;
      nodes[i].baseX = coreX + Math.cos(angle) * r;
      nodes[i].baseY = coreY + Math.sin(angle) * r;
      nodes[i].x = nodes[i].baseX;
      nodes[i].y = nodes[i].baseY;
    }
  }

  /* ----- ambient particles ----- */
  function buildAmbient() {
    ambientParts = [];
    for (let i = 0; i < AMBIENT_PARTICLES; i++) {
      ambientParts.push(makeParticle());
    }
  }

  function makeParticle() {
    const angle = Math.random() * Math.PI * 2;
    const r = 30 + Math.random() * Math.min(W || 800, H || 600) * 0.5;
    return {
      x: (W || 800) / 2 + Math.cos(angle) * r,
      y: (H || 600) / 2 + Math.sin(angle) * r,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: 0.8 + Math.random() * 2,
      alpha: 0.1 + Math.random() * 0.3,
      color: ['#a855f7', '#ec4899', '#6366f1', '#06b6d4', '#9cff3a'][Math.floor(Math.random() * 5)],
    };
  }

  /* ----- input handlers ----- */
  function onMouse(e) {
    const r = container.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
    if (dragStart) {
      const dx = mx - dragStart.x;
      rotationOffset += dx * 0.003;
      dragStart.x = mx;
      positionNodes();
    }
  }
  function onLeave() { mx = my = -9999; dragStart = null; canvas.style.cursor = 'grab'; }
  function onTouch(e) {
    const r = container.getBoundingClientRect();
    const t = e.touches[0];
    if (t) { mx = t.clientX - r.left; my = t.clientY - r.top; }
  }
  function onTouchStart(e) {
    const r = container.getBoundingClientRect();
    const t = e.touches[0];
    if (t) { mx = t.clientX - r.left; my = t.clientY - r.top; }
  }
  function onDragStart(e) {
    dragStart = { x: mx }; canvas.style.cursor = 'grabbing';
  }
  function onDragEnd() { dragStart = null; canvas.style.cursor = 'grab'; }
  function onWheel(e) {
    e.preventDefault();
    targetZoom = Math.max(0.4, Math.min(2.5, targetZoom - e.deltaY * 0.001));
  }

  function onClick(e) {
    if (!container || nodes.length === 0) return;
    const r = container.getBoundingClientRect();
    let cx, cy;
    if (e.clientX !== undefined) { cx = e.clientX - r.left; cy = e.clientY - r.top; }
    else return;

    // transform click into zoomed/panned space
    const wcx = (cx - W / 2) / zoom + coreX - panX;
    const wcy = (cy - H / 2) / zoom + coreY - panY;

    let best = -1, bestD = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const d = dist(wcx, wcy, nodes[i].x, nodes[i].y);
      const hitR = NODE_HOVER_R * 1.5;
      if (d < hitR && d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) return;

    const node = nodes[best];
    playedSet.add(node.index);

    // spawn extra ambient particles as evolution
    for (let i = 0; i < 3; i++) ambientParts.push(makeParticle());

    if (typeof playTrack === 'function') {
      playTrack(node.index);
      toastText = '▶ ' + (node.title || '').toLowerCase();
      toastUntil = performance.now() + 2000;
    }
  }

  /* =========================================================
     MAIN DRAW LOOP
     ========================================================= */
  function draw(now) {
    rafId = requestAnimationFrame(draw);
    if (!ctx) return;
    const t = (now - t0) * 0.001;
    corePhase = t;

    // smooth zoom
    zoom = lerp(zoom, targetZoom, 0.08);

    // audio
    const freq = typeof getFrequencyData === 'function' ? getFrequencyData() : null;
    let bass = 0, mid = 0, treble = 0;
    if (freq) {
      for (let i = 0; i < 6; i++) bass += freq[i];
      bass /= (6 * 255);
      for (let i = 6; i < 24; i++) mid += freq[i];
      mid /= (18 * 255);
      for (let i = 24; i < 64; i++) treble += freq[i];
      treble /= (40 * 255);
      if (bass > BEAT_THRESHOLD && now - lastBeatTime > BEAT_COOLDOWN) {
        beatPulse = 1;
        lastBeatTime = now;
      }
    }
    beatPulse *= 0.93;

    // node hover + attraction to cursor
    hovered = -1;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      // transform mouse into world space
      const wmx = (mx - W / 2) / zoom + coreX - panX;
      const wmy = (my - H / 2) / zoom + coreY - panY;
      const d = dist(wmx, wmy, n.baseX, n.baseY);

      if (d < NODE_HOVER_R * 2) {
        hovered = i;
        // pull toward cursor
        n.x = lerp(n.x, lerp(n.baseX, wmx, 0.25), 0.12);
        n.y = lerp(n.y, lerp(n.baseY, wmy, 0.25), 0.12);
      } else if (d < 120) {
        // gentle push away from cursor (organic feel)
        const pull = 0.03 * (1 - d / 120);
        n.x = lerp(n.x, n.baseX + (n.baseX - wmx) * pull, 0.06);
        n.y = lerp(n.y, n.baseY + (n.baseY - wmy) * pull, 0.06);
      } else {
        // breathe back to base
        const breathX = Math.sin(t * 0.5 + n.angle * 2) * 3;
        const breathY = Math.cos(t * 0.4 + n.dist * 0.02) * 3;
        n.x = lerp(n.x, n.baseX + breathX, 0.05);
        n.y = lerp(n.y, n.baseY + breathY, 0.05);
      }
    }

    // clear
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    // apply zoom + pan
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-coreX + panX, -coreY + panY);

    // --- ambient particles ---
    for (let i = 0; i < ambientParts.length; i++) {
      const p = ambientParts[i];
      p.x += p.vx;
      p.y += p.vy;
      // gentle orbit drift
      const dx = p.x - coreX, dy = p.y - coreY;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      p.vx += -dy / d * 0.002;
      p.vy += dx / d * 0.002;
      // contain loosely
      if (d > Math.min(W, H) * 0.6) {
        p.vx -= dx * 0.0001;
        p.vy -= dy * 0.0001;
      }
      const flicker = 0.5 + 0.5 * Math.sin(t * 2 + i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = hexToRGBA(p.color, p.alpha * flicker);
      ctx.fill();
    }

    // --- tendrils from core to nodes ---
    const evolution = Math.min(playedSet.size / 15, 1); // 0→1 as more tracks played
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const isPlaying = state.currentTrack === n.index;
      const wasPlayed = playedSet.has(n.index);
      const baseAlpha = isPlaying ? 0.5 : wasPlayed ? 0.15 + evolution * 0.1 : 0.04;
      const tendrilAlpha = baseAlpha + bass * 0.15;

      ctx.beginPath();
      ctx.moveTo(coreX, coreY);

      // bezier tendril with organic wobble
      const midDist = n.dist * 0.5;
      const wobble1 = Math.sin(t * 0.8 + i * 0.7) * 20 * (1 + bass * 2);
      const wobble2 = Math.cos(t * 0.6 + i * 1.1) * 15 * (1 + mid * 2);
      const perpAngle = n.angle + Math.PI / 2;
      const cp1x = coreX + Math.cos(n.angle) * midDist * 0.4 + Math.cos(perpAngle) * wobble1;
      const cp1y = coreY + Math.sin(n.angle) * midDist * 0.4 + Math.sin(perpAngle) * wobble1;
      const cp2x = coreX + Math.cos(n.angle) * midDist * 1.2 + Math.cos(perpAngle) * wobble2;
      const cp2y = coreY + Math.sin(n.angle) * midDist * 1.2 + Math.sin(perpAngle) * wobble2;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, n.x, n.y);
      ctx.strokeStyle = hexToRGBA(n.colors[0], tendrilAlpha);
      ctx.lineWidth = isPlaying ? 2.5 : 1;
      ctx.stroke();
    }

    // --- veins between nearby played nodes ---
    if (playedSet.size > 1) {
      const playedNodes = nodes.filter(n => playedSet.has(n.index));
      ctx.lineWidth = 0.6;
      for (let i = 0; i < playedNodes.length; i++) {
        for (let j = i + 1; j < playedNodes.length; j++) {
          const d = dist(playedNodes[i].x, playedNodes[i].y, playedNodes[j].x, playedNodes[j].y);
          if (d < 100 + evolution * 60) {
            const alpha = (1 - d / (100 + evolution * 60)) * 0.2;
            ctx.beginPath();
            ctx.moveTo(playedNodes[i].x, playedNodes[i].y);
            ctx.lineTo(playedNodes[j].x, playedNodes[j].y);
            ctx.strokeStyle = hexToRGBA(playedNodes[i].colors[0], alpha);
            ctx.stroke();
          }
        }
      }
    }

    // --- core organism ---
    const coreR = CORE_BASE_R * (1 + beatPulse * 0.3 + bass * 0.2 + evolution * 0.15);

    // outer glow
    const glowR = coreR * 2.5;
    const glow = ctx.createRadialGradient(coreX, coreY, coreR * 0.3, coreX, coreY, glowR);
    glow.addColorStop(0, hexToRGBA('#a855f7', 0.12 + bass * 0.15));
    glow.addColorStop(0.4, hexToRGBA('#ec4899', 0.06 + bass * 0.08));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(coreX - glowR, coreY - glowR, glowR * 2, glowR * 2);

    // core blobs (3 overlapping circles that orbit slightly)
    for (let b = 0; b < 3; b++) {
      const bAngle = t * 0.3 + b * (Math.PI * 2 / 3);
      const bDist = 8 + Math.sin(t * 0.7 + b) * 5;
      const bx = coreX + Math.cos(bAngle) * bDist;
      const by = coreY + Math.sin(bAngle) * bDist;
      const br = coreR * (0.7 + b * 0.1);
      const coreColors = ['#a855f7', '#ec4899', '#6366f1'];

      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      grad.addColorStop(0, hexToRGBA(coreColors[b], 0.35 + bass * 0.2));
      grad.addColorStop(0.6, hexToRGBA(coreColors[b], 0.12));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // core membrane ring
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2; a += 0.02) {
      const wobble = Math.sin(a * 6 + t * 1.5) * 4 * (1 + bass * 3)
                   + Math.sin(a * 10 + t * 2.3) * 2;
      const r = coreR * 0.65 + wobble;
      const px = coreX + Math.cos(a) * r;
      const py = coreY + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = hexToRGBA('#e879f9', 0.3 + bass * 0.3);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // --- nodes ---
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const isPlaying = state.currentTrack === n.index;
      const isHovered = hovered === i;
      const wasPlayed = playedSet.has(n.index);

      // node glow
      const nodeR = isHovered ? NODE_HOVER_R : isPlaying ? NODE_R * 1.8 : NODE_R;
      const glowAlpha = isPlaying ? 0.5 : wasPlayed ? 0.15 : 0.05;

      if (isPlaying || isHovered || wasPlayed) {
        const ng = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, nodeR * 3);
        ng.addColorStop(0, hexToRGBA(n.colors[0], glowAlpha + bass * 0.2));
        ng.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ng;
        ctx.fillRect(n.x - nodeR * 3, n.y - nodeR * 3, nodeR * 6, nodeR * 6);
      }

      // node dot
      ctx.beginPath();
      ctx.arc(n.x, n.y, nodeR, 0, Math.PI * 2);
      const dotAlpha = isHovered ? 0.95 : isPlaying ? 0.9 : wasPlayed ? 0.6 : 0.3;
      ctx.fillStyle = hexToRGBA(n.colors[0], dotAlpha);
      ctx.fill();

      // inner highlight
      if (nodeR > 4) {
        ctx.beginPath();
        ctx.arc(n.x - nodeR * 0.2, n.y - nodeR * 0.25, nodeR * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,0.3)`;
        ctx.fill();
      }

      // playing ring pulse
      if (isPlaying) {
        const pulseR = nodeR + 4 + Math.sin(t * 3) * 3 + beatPulse * 8;
        ctx.beginPath();
        ctx.arc(n.x, n.y, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRGBA('#9cff3a', 0.5);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // label on hover
      if (isHovered) {
        ctx.font = "500 12px 'DM Sans', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText(n.title, n.x, n.y - NODE_HOVER_R - 10);
      }
    }

    ctx.restore(); // undo zoom/pan transform

    // --- evolution indicator ---
    if (playedSet.size > 0) {
      const evoText = `${playedSet.size} cell${playedSet.size > 1 ? 's' : ''} activated`;
      ctx.font = "400 11px 'JetBrains Mono', monospace";
      ctx.textAlign = 'right';
      ctx.fillStyle = hexToRGBA('#a855f7', 0.4 + evolution * 0.3);
      ctx.fillText(evoText, W - 20, 80);
    }

    // --- toast ---
    if (now < toastUntil && toastText) {
      const fade = Math.min(1, (toastUntil - now) / 500);
      ctx.font = "600 14px 'Syne', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,255,255,${fade * 0.8})`;
      ctx.fillText(toastText, W / 2, H - 80);
    }

    // --- scroll/zoom hint ---
    if (t < 5) {
      const fade = Math.max(0, 1 - t / 4);
      ctx.font = "400 11px 'DM Sans', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,255,255,${fade * 0.35})`;
      ctx.fillText('scroll to zoom · drag to rotate · click a node to play', W / 2, H - 30);
    }
  }

  /* ----- view hooks ----- */
  function onSearch(query) {
    buildNodes();
  }

  function onTrackChange(index) {
    playedSet.add(index);
    // spawn particles on track change (evolution)
    for (let i = 0; i < 2; i++) ambientParts.push(makeParticle());
  }

  /* ----- register ----- */
  registerView('organism', { init, destroy, onSearch, onTrackChange });
})();
