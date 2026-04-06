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

    // On mobile: 70% canvas with pan/zoom, compact collapsible drawer
    if (isMobile()) {
      canvas.style.height = '70%';
      canvas.style.position = 'relative';

      // Touch pan support for the canvas
      let panX = 0, panY = 0, lastTouchX = 0, lastTouchY = 0, isPanning = false;
      canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          isPanning = true;
          lastTouchX = e.touches[0].clientX;
          lastTouchY = e.touches[0].clientY;
        }
      }, { passive: true });
      canvas.addEventListener('touchmove', (e) => {
        if (isPanning && e.touches.length === 1) {
          const dx = e.touches[0].clientX - lastTouchX;
          const dy = e.touches[0].clientY - lastTouchY;
          panX += dx;
          panY += dy;
          lastTouchX = e.touches[0].clientX;
          lastTouchY = e.touches[0].clientY;
          // Shift all node positions
          nodes.forEach(n => { n.ox += dx; n.oy += dy; });
        }
        // Also update hover position for tap
        if (e.touches.length === 1) {
          const r = container.getBoundingClientRect();
          mx = e.touches[0].clientX - r.left;
          my = e.touches[0].clientY - r.top;
        }
      }, { passive: true });
      canvas.addEventListener('touchend', () => { isPanning = false; });

      // Tap to play on mobile
      canvas.addEventListener('click', () => {
        if (hoveredNode >= 0 && hoveredNode < nodes.length) {
          playTrack(nodes[hoveredNode].trackIndex);
        }
      });

      // Move filters to overlay on canvas
      filters.style.cssText = 'position:absolute;bottom:calc(30% + 4px);left:12px;right:12px;display:flex;gap:4px;flex-wrap:wrap;justify-content:center;z-index:10';

      // Drawer
      const drawer = document.createElement('div');
      drawer.style.cssText = 'position:absolute;top:70%;left:0;right:0;bottom:0;background:#0a0a0a;border-top:1px solid #ffffff10;display:flex;flex-direction:column';

      const handle = document.createElement('div');
      handle.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 16px;flex-shrink:0';
      handle.innerHTML = `
        <span style="font-size:12px;color:#ffffff40;font-family:var(--font-mono)">TRACKS</span>
        <button class="info-btn" style="font-size:11px;padding:4px 14px" id="mNeuralPlay">Play All</button>
        <button class="info-btn secondary" style="font-size:11px;padding:4px 14px" id="mNeuralShuffle">Shuffle</button>
        <button id="mNeuralExpand" style="margin-left:auto;background:none;border:none;color:#ffffff40;font-size:18px;cursor:pointer">▲</button>
      `;
      drawer.appendChild(handle);

      const list = document.createElement('div');
      list.style.cssText = 'flex:1;overflow-y:auto;padding:0 16px 16px;-webkit-overflow-scrolling:touch';
      let html = '';
      tracks.forEach((t, i) => {
        const badges = [];
        if (t.isNew) badges.push('<span class="track-badge-new">NEW</span>');
        if (t.isFeatured) badges.push('<span class="track-badge-featured">★</span>');
        html += `<div class="sea-track" data-index="${i}" style="padding:8px 4px"><div class="sea-dot" style="background:${getGradientColors(i)[0]};box-shadow:0 0 6px ${getGradientColors(i)[0]}40"></div><span class="sea-name" style="font-size:13px">${escapeHtml(t.title)}</span>${badges.join('')}</div>`;
      });
      list.innerHTML = html;
      drawer.appendChild(list);
      container.appendChild(drawer);

      // Toggle expand
      let expanded = false;
      document.getElementById('mNeuralExpand').addEventListener('click', () => {
        expanded = !expanded;
        drawer.style.top = expanded ? '25%' : '70%';
        canvas.style.height = expanded ? '25%' : '70%';
        document.getElementById('mNeuralExpand').textContent = expanded ? '▼' : '▲';
        resize();
      });

      list.querySelectorAll('.sea-track').forEach(el => {
        el.addEventListener('click', () => playTrack(parseInt(el.dataset.index)));
      });
      document.getElementById('mNeuralPlay').addEventListener('click', () => playTrack(0));
      document.getElementById('mNeuralShuffle').addEventListener('click', () => {
        state.shuffleMode = true;
        playTrack(Math.floor(Math.random() * tracks.length));
      });
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
    const count = Math.min(filtered.length, isMobile() ? 25 : 40);
    const clusters = 4;
    const margin = isMobile() ? 60 : 100;

    for (let i = 0; i < count; i++) {
      const cl = Math.floor(i / Math.ceil(count / clusters));
      const h = hash(filtered[i].title);

      // Position based on cluster + hash
      const clusterCx = margin + (W - margin * 2) * (cl + 0.5) / clusters;
      const clusterCy = H * 0.5;
      const spread = isMobile() ? 80 : 120;
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
        size: isMobile() ? 7 + Math.abs(h % 5) : 5 + Math.abs(h % 6),
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
