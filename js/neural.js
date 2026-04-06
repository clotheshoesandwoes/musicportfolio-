/* =========================================================
   NEURAL.JS — Neural Web node/connection view
   ========================================================= */

(function() {
  let canvas, ctx, container;
  let W, H, frame = 0, rafId;
  let mx = 0, my = 0;
  let nodes = [];
  let hoveredNode = -1;
  const isMobile = () => window.innerWidth < 768;

  function init(cont) {
    container = cont;

    // Canvas
    canvas = document.createElement('canvas');
    canvas.className = 'view-canvas';
    container.appendChild(canvas);
    ctx = canvas.getContext('2d');

    // Info panel (bottom-left)
    const info = document.createElement('div');
    info.className = 'info-panel';
    info.innerHTML = `
      <div class="info-label">Hover a node</div>
      <div class="info-title" id="neuralTitle">Explore the web</div>
      <div class="info-meta" id="neuralMeta">Similar to: —</div>
    `;
    container.appendChild(info);

    // Filter tabs (bottom-right)
    const filters = document.createElement('div');
    filters.className = 'filter-tabs';
    ['All', 'Chill', 'Hard', 'Grunge', 'Vibe'].forEach((f, i) => {
      const btn = document.createElement('button');
      btn.className = 'filter-pill' + (i === 0 ? ' active' : '');
      btn.textContent = f;
      btn.addEventListener('click', () => {
        filters.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        // Visual filter effect — fade non-matching nodes
        applyFilter(f);
      });
      filters.appendChild(btn);
    });
    container.appendChild(filters);

    // On mobile: full canvas, no list. Tap nodes to play. Pan to explore.
    if (isMobile()) {
      // Touch pan
      let lastTouchX = 0, lastTouchY = 0, isPanning = false;
      canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          isPanning = true;
          lastTouchX = e.touches[0].clientX;
          lastTouchY = e.touches[0].clientY;
          const r = container.getBoundingClientRect();
          mx = e.touches[0].clientX - r.left;
          my = e.touches[0].clientY - r.top;
        }
      }, { passive: true });
      canvas.addEventListener('touchmove', (e) => {
        if (isPanning && e.touches.length === 1) {
          const dx = e.touches[0].clientX - lastTouchX;
          const dy = e.touches[0].clientY - lastTouchY;
          lastTouchX = e.touches[0].clientX;
          lastTouchY = e.touches[0].clientY;
          nodes.forEach(n => { n.ox += dx; n.oy += dy; });
          const r = container.getBoundingClientRect();
          mx = e.touches[0].clientX - r.left;
          my = e.touches[0].clientY - r.top;
        }
      }, { passive: true });
      canvas.addEventListener('touchend', () => { isPanning = false; });

      // Tap to play
      canvas.addEventListener('click', () => {
        if (hoveredNode >= 0 && hoveredNode < nodes.length) {
          playTrack(nodes[hoveredNode].trackIndex);
        }
      });

      // Filters overlaid at bottom of canvas
      filters.style.cssText = 'position:absolute;bottom:8px;left:12px;right:12px;display:flex;gap:4px;flex-wrap:wrap;justify-content:center;z-index:10';
    }

    // Mouse tracking
    container.addEventListener('mousemove', onMouse);
    container.addEventListener('touchmove', onTouch, { passive: true });
    container.addEventListener('click', onClick);

    resize();
    window.addEventListener('resize', resize);
    draw();
  }

  function destroy() {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    if (container) {
      container.removeEventListener('mousemove', onMouse);
      container.removeEventListener('touchmove', onTouch);
      container.removeEventListener('click', onClick);
    }
    canvas = ctx = container = null;
    nodes = [];
  }

  function onMouse(e) {
    const r = container.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
  }

  function onTouch(e) {
    const r = container.getBoundingClientRect();
    const t = e.touches[0];
    mx = t.clientX - r.left;
    my = t.clientY - r.top;
  }

  function onClick() {
    if (hoveredNode >= 0 && hoveredNode < nodes.length) {
      playTrack(nodes[hoveredNode].trackIndex);
    }
  }

  function resize() {
    if (!canvas) return;
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    buildNodes();
  }

  // Simple hash for consistent positioning
  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i);
    return h;
  }

  function buildNodes() {
    nodes = [];
    const filtered = getFilteredTracks();
    const count = Math.min(filtered.length, isMobile() ? 40 : 40);
    const mobile = isMobile();
    const clusters = mobile ? 5 : 4;
    const margin = mobile ? 30 : 100;

    for (let i = 0; i < count; i++) {
      const cl = Math.floor(i / Math.ceil(count / clusters));
      const h = hash(filtered[i].title);

      // Spread nodes across full canvas
      const cols = mobile ? 3 : clusters;
      const rows = Math.ceil(clusters / cols);
      const col = cl % cols;
      const row = Math.floor(cl / cols);
      const cellW = (W - margin * 2) / cols;
      const cellH = (H - margin * 2) / Math.max(rows, 2);
      const clusterCx = margin + cellW * (col + 0.5);
      const clusterCy = margin + cellH * (row + 0.5);
      const spread = mobile ? Math.min(cellW, cellH) * 0.42 : 120;
      const x = clusterCx + ((h % 200) - 100) / 100 * spread;
      const y = clusterCy + (((h >> 8) % 200) - 100) / 100 * spread;

      // Build connections (2-4 nearest + 1 random cross-cluster)
      const connections = [];
      const numConn = 2 + (Math.abs(h) % 3);
      for (let c = 0; c < numConn; c++) {
        let target;
        if (c < numConn - 1) {
          // Connect to nearby in array
          target = (i + c + 1) % count;
        } else {
          // Random cross-cluster
          target = Math.abs(h + c * 7) % count;
        }
        if (target !== i && !connections.includes(target)) {
          connections.push(target);
        }
      }

      nodes.push({
        x, y, ox: x, oy: y,
        size: isMobile() ? 8 + Math.abs(h % 7) : 5 + Math.abs(h % 6),
        trackIndex: filtered[i].originalIndex,
        title: filtered[i].title,
        connections,
        hue: cl % 2 === 0 ? '139,92,246' : '236,72,153',
        visible: true,
        filterOpacity: 1,
      });
    }
  }

  // Soft filter — based on title keywords
  function applyFilter(filterName) {
    const keywords = {
      All: null,
      Chill: ['chill','indie','soul','love','moonlight','nour','valentine','remember','coffee','silk','dream'],
      Hard: ['grunge','chains','gunning','warzone','villain','hotel','freestyle','sick','fuck'],
      Grunge: ['grunge','chains','nirvana','rock','emo','bluff','thunderbird'],
      Vibe: ['vibe','moods','space','galaxy','silo','robot','mario','stayin','star','galactica'],
    };
    const kw = keywords[filterName];
    nodes.forEach(n => {
      if (!kw) {
        n.filterOpacity = 1;
        n.visible = true;
      } else {
        const title = n.title.toLowerCase();
        const match = kw.some(k => title.includes(k));
        n.filterOpacity = match ? 1 : 0.08;
        n.visible = match;
      }
    });
  }

  function draw() {
    if (!ctx) return;
    frame++;
    ctx.clearRect(0, 0, W, H);

    const titleEl = document.getElementById('neuralTitle');
    const metaEl = document.getElementById('neuralMeta');

    // Animate node positions (gentle drift)
    hoveredNode = -1;
    let hDist = Infinity;

    nodes.forEach((n, i) => {
      n.x = n.ox + Math.sin(frame * 0.006 + i) * 4;
      n.y = n.oy + Math.cos(frame * 0.008 + i * 1.3) * 3;

      const dx = mx - n.x, dy = my - n.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < (isMobile() ? 50 : 60) && d < hDist && n.filterOpacity > 0.5) {
        hDist = d;
        hoveredNode = i;
      }
    });

    // Draw connections
    nodes.forEach((n, i) => {
      n.connections.forEach(ci => {
        if (ci >= nodes.length) return;
        const t = nodes[ci];
        const active = hoveredNode === i || hoveredNode === ci;
        const pulse = Math.sin(frame * 0.03 + i + ci) * 0.5 + 0.5;
        const opacity = Math.min(n.filterOpacity, t.filterOpacity);

        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = active
          ? `rgba(${n.hue},${(0.2 + pulse * 0.4) * opacity})`
          : `rgba(255,255,255,${0.025 * opacity})`;
        ctx.lineWidth = active ? 1.5 : 0.5;
        ctx.stroke();

        // Traveling pulse on active connections
        if (active && opacity > 0.5) {
          const progress = (frame * 0.02 + i * 0.5) % 1;
          const px = n.x + (t.x - n.x) * progress;
          const py = n.y + (t.y - n.y) * progress;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${n.hue},${(0.6 + pulse * 0.4) * opacity})`;
          ctx.fill();
        }
      });
    });

    // Draw nodes
    nodes.forEach((n, i) => {
      const isH = hoveredNode === i;
      const isC = hoveredNode >= 0 && hoveredNode < nodes.length && nodes[hoveredNode].connections.includes(i);
      const glow = isH ? 1 : isC ? 0.6 : 0;
      const isPlaying = n.trackIndex === state.currentTrack;
      const fo = n.filterOpacity;

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.size + glow * 6, 0, Math.PI * 2);

      if (isPlaying) {
        const playPulse = Math.sin(frame * 0.05) * 0.2 + 0.8;
        ctx.fillStyle = `rgba(${n.hue},${0.7 * playPulse * fo})`;
      } else if (isH || isC) {
        ctx.fillStyle = `rgba(${n.hue},${(0.5 + glow * 0.4) * fo})`;
      } else {
        ctx.fillStyle = `rgba(${n.hue},${0.12 * fo})`;
      }
      ctx.fill();

      // Outer glow for hovered/playing
      if ((glow > 0 || isPlaying) && fo > 0.5) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size + 18, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${n.hue},${0.04 * fo})`;
        ctx.fill();
      }

      // Label on hover/connected
      if ((isH || isC) && fo > 0.5) {
        ctx.font = '11px "DM Sans", sans-serif';
        ctx.fillStyle = `rgba(255,255,255,${0.4 + glow * 0.5})`;
        ctx.fillText(n.title, n.x + n.size + 10, n.y + 4);
      }
    });

    // Update info panel
    if (hoveredNode >= 0 && hoveredNode < nodes.length) {
      const n = nodes[hoveredNode];
      if (titleEl) titleEl.textContent = n.title;
      const sims = n.connections
        .slice(0, 3)
        .filter(c => c < nodes.length)
        .map(c => nodes[c].title)
        .join(', ');
      if (metaEl) metaEl.textContent = 'Similar to: ' + sims;
    }

    // Mouse glow
    const mgrd = ctx.createRadialGradient(mx, my, 0, mx, my, 160);
    mgrd.addColorStop(0, 'rgba(139,92,246,0.03)');
    mgrd.addColorStop(1, 'transparent');
    ctx.fillStyle = mgrd;
    ctx.fillRect(0, 0, W, H);

    rafId = requestAnimationFrame(draw);
  }

  function onSearch() {
    buildNodes();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  registerView('neural', { init, destroy, onSearch, onTrackChange: () => {} });
})();
