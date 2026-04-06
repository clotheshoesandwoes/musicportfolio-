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

    // On mobile, add a scrollable track list below the canvas
    if (isMobile()) {
      canvas.style.height = '45%';
      canvas.style.position = 'relative';

      const list = document.createElement('div');
      list.style.cssText = 'position:absolute;top:45%;left:0;right:0;bottom:0;overflow-y:auto;padding:12px 16px 20px;-webkit-overflow-scrolling:touch';
      let html = '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">';
      html += '<button class="info-btn" style="font-size:12px" id="mNeuralPlay">Play All</button>';
      html += '<button class="info-btn secondary" style="font-size:12px" id="mNeuralShuffle">Shuffle</button>';
      html += '</div>';
      tracks.forEach((t, i) => {
        const badges = [];
        if (t.isNew) badges.push('<span class="track-badge-new">NEW</span>');
        if (t.isFeatured) badges.push('<span class="track-badge-featured">★</span>');
        html += `<div class="sea-track" data-index="${i}" style="padding:10px 6px"><div class="sea-dot" style="background:${getGradientColors(i)[0]};box-shadow:0 0 6px ${getGradientColors(i)[0]}40"></div><span class="sea-name">${escapeHtml(t.title)}</span>${badges.join('')}</div>`;
      });
      list.innerHTML = html;
      container.appendChild(list);

      list.querySelectorAll('.sea-track').forEach(el => {
        let clickTimer = null;
        el.addEventListener('click', () => {
          if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; showTrackDetail(parseInt(el.dataset.index)); }
          else { clickTimer = setTimeout(() => { clickTimer = null; playTrack(parseInt(el.dataset.index)); }, 250); }
        });
      });
      document.getElementById('mNeuralPlay').addEventListener('click', () => playTrack(0));
      document.getElementById('mNeuralShuffle').addEventListener('click', () => {
        state.shuffleMode = true;
        playTrack(Math.floor(Math.random() * tracks.length));
      });

      // Move filters above list
      filters.style.cssText = 'position:relative;display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;padding:0 16px';
      list.insertBefore(filters, list.firstChild.nextSibling);
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
