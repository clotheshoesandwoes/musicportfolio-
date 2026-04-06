/* =========================================================
   TERRAIN.JS — Sound Terrain canvas view
   ========================================================= */

(function() {
  let canvas, ctx, container;
  let W, H, frame = 0, rafId;
  let mx = 0, my = 0;
  let peaks = [];
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
      <div class="info-label">Hover a peak</div>
      <div class="info-title" id="terrainTitle">Explore the terrain</div>
      <div class="info-meta" id="terrainMeta">${tracks.length} tracks</div>
      <div class="info-actions">
        <button class="info-btn" id="terrainPlayBtn">Play</button>
        <button class="info-btn secondary" id="terrainQueueBtn">Shuffle All</button>
      </div>
    `;
    container.appendChild(info);

    // Latest drops panel (bottom-right, desktop only)
    if (!isMobile()) {
      const latest = document.createElement('div');
      latest.className = 'latest-panel';
      latest.innerHTML = `
        <div class="latest-label">Latest drops</div>
        ${tracks.slice(0, 5).map((t, i) => `
          <div class="latest-item" data-index="${i}">
            <span class="latest-dot"></span>${escapeHtml(t.title)}
          </div>
        `).join('')}
      `;
      container.appendChild(latest);

      latest.querySelectorAll('.latest-item').forEach(item => {
        item.addEventListener('click', () => {
          playTrack(parseInt(item.dataset.index));
        });
      });
    }

    // Play/shuffle buttons
    document.getElementById('terrainPlayBtn').addEventListener('click', () => {
      if (hoveredPeak >= 0) playTrack(hoveredPeak);
      else playTrack(0);
    });
    document.getElementById('terrainQueueBtn').addEventListener('click', () => {
      state.shuffleMode = true;
      shuffleBtn.classList.add('active');
      playTrack(Math.floor(Math.random() * tracks.length));
    });

    // On mobile, add a scrollable track list below the canvas
    if (isMobile()) {
      canvas.style.height = '45%';
      canvas.style.position = 'relative';

      const list = document.createElement('div');
      list.style.cssText = 'position:absolute;top:45%;left:0;right:0;bottom:0;overflow-y:auto;padding:12px 16px 20px;-webkit-overflow-scrolling:touch';
      let html = '<div style="display:flex;gap:8px;margin-bottom:12px"><button class="info-btn" style="font-size:12px" id="mTerrainPlay">Play All</button><button class="info-btn secondary" style="font-size:12px" id="mTerrainShuffle">Shuffle</button></div>';
      tracks.forEach((t, i) => {
        html += `<div class="sea-track" data-index="${i}" style="padding:10px 6px"><div class="sea-dot" style="background:${getGradientColors(i)[0]};box-shadow:0 0 6px ${getGradientColors(i)[0]}40"></div><span class="sea-name">${escapeHtml(t.title)}</span></div>`;
      });
      list.innerHTML = html;
      container.appendChild(list);

      list.querySelectorAll('.sea-track').forEach(el => {
        el.addEventListener('click', () => playTrack(parseInt(el.dataset.index)));
      });
      document.getElementById('mTerrainPlay').addEventListener('click', () => playTrack(0));
      document.getElementById('mTerrainShuffle').addEventListener('click', () => {
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
    peaks = [];
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

  let hoveredPeak = -1;

  function onClick(e) {
    if (hoveredPeak >= 0) {
      playTrack(hoveredPeak);
    }
  }

  function resize() {
    if (!canvas) return;
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    buildPeaks();
  }

  function buildPeaks() {
    peaks = [];
    const filtered = getFilteredTracks();
    const count = Math.min(filtered.length, isMobile() ? 50 : 90);
    const spacing = W / count;

    for (let i = 0; i < count; i++) {
      // Generate height from title hash for consistency
      const title = filtered[i].title;
      let hash = 0;
      for (let c = 0; c < title.length; c++) hash = ((hash << 5) - hash) + title.charCodeAt(c);
      const h = 30 + Math.abs(hash % 130) + Math.sin(i * 0.3) * 25;

      peaks.push({
        x: spacing * i + spacing / 2,
        h: h,
        trackIndex: filtered[i].originalIndex,
        title: filtered[i].title,
      });
    }
  }

  function draw() {
    if (!ctx) return;
    frame++;
    ctx.clearRect(0, 0, W, H);

    const baseY = H * (isMobile() ? 0.58 : 0.72);
    const layers = isMobile() ? 4 : 6;

    // Background radial glow
    const grd = ctx.createRadialGradient(W / 2, baseY - 80, 0, W / 2, baseY - 80, W * 0.45);
    grd.addColorStop(0, 'rgba(139,92,246,0.05)');
    grd.addColorStop(0.5, 'rgba(236,72,153,0.02)');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // Audio reactivity
    let avgFreq = 0;
    const freqData = getFrequencyData();
    if (freqData && state.isPlaying) {
      for (let i = 0; i < freqData.length; i++) avgFreq += freqData[i];
      avgFreq = avgFreq / freqData.length / 255;
    }

    // Draw terrain layers back-to-front
    for (let L = layers - 1; L >= 0; L--) {
      const off = L * 28;
      const alpha = 0.06 + L * 0.11;
      const wobbleAmp = 8 + avgFreq * 12;

      ctx.beginPath();
      for (let i = 0; i < peaks.length; i++) {
        const p = peaks[i];
        const wave = Math.sin(frame * 0.012 + i * 0.4 + L * 0.5) * wobbleAmp;
        const px = p.x + L * 12;
        const py = baseY - p.h * (1 - L * 0.12) + off + wave;

        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          const prev = peaks[i - 1];
          const ppx = prev.x + L * 12;
          const ppy = baseY - prev.h * (1 - L * 0.12) + off + Math.sin(frame * 0.012 + (i - 1) * 0.4 + L * 0.5) * wobbleAmp;
          ctx.quadraticCurveTo(ppx, ppy, (px + ppx) / 2, (py + ppy) / 2);
        }
      }
      ctx.lineTo(W + 50, H);
      ctx.lineTo(-50, H);
      ctx.closePath();

      const tGrad = ctx.createLinearGradient(0, baseY - 180, 0, baseY + 100);
      if (L < 2) {
        tGrad.addColorStop(0, `rgba(139,92,246,${alpha})`);
        tGrad.addColorStop(1, 'rgba(139,92,246,0.01)');
      } else if (L < 4) {
        tGrad.addColorStop(0, `rgba(200,80,200,${alpha * 0.6})`);
        tGrad.addColorStop(1, 'rgba(139,92,246,0.01)');
      } else {
        tGrad.addColorStop(0, `rgba(99,102,241,${alpha * 0.4})`);
        tGrad.addColorStop(1, 'transparent');
      }
      ctx.fillStyle = tGrad;
      ctx.fill();

      if (L === 0) {
        ctx.strokeStyle = 'rgba(139,92,246,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Find hovered peak
    hoveredPeak = -1;
    let closestDist = Infinity;
    const titleEl = document.getElementById('terrainTitle');
    const metaEl = document.getElementById('terrainMeta');

    peaks.forEach((p, i) => {
      const py = baseY - p.h + Math.sin(frame * 0.012 + i * 0.4) * 8;
      const dx = mx - p.x, dy = my - py;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 80 && d < closestDist) {
        closestDist = d;
        hoveredPeak = p.trackIndex;

        // Glow dot
        ctx.beginPath();
        ctx.arc(p.x, py, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#ec4899';
        ctx.fill();

        // Pulse ring
        ctx.beginPath();
        ctx.arc(p.x, py, 18, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(236,72,153,0.12)';
        ctx.fill();

        // Dashed line down
        ctx.beginPath();
        ctx.setLineDash([3, 4]);
        ctx.moveTo(p.x, py);
        ctx.lineTo(p.x, baseY + 60);
        ctx.strokeStyle = 'rgba(236,72,153,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        if (titleEl) titleEl.textContent = p.title;
        if (metaEl) metaEl.textContent = `Track ${p.trackIndex + 1} / ${tracks.length}`;
      }
    });

    // Highlight currently playing peak
    if (state.currentTrack >= 0) {
      peaks.forEach((p, i) => {
        if (p.trackIndex === state.currentTrack) {
          const py = baseY - p.h + Math.sin(frame * 0.012 + i * 0.4) * 8;
          const pulse = Math.sin(frame * 0.05) * 0.3 + 0.7;
          ctx.beginPath();
          ctx.arc(p.x, py, 9 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(139,92,246,${0.5 + pulse * 0.3})`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p.x, py, 24, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(139,92,246,0.06)';
          ctx.fill();
        }
      });
    }

    // Mouse glow
    const mgrd = ctx.createRadialGradient(mx, my, 0, mx, my, 180);
    mgrd.addColorStop(0, 'rgba(139,92,246,0.04)');
    mgrd.addColorStop(1, 'transparent');
    ctx.fillStyle = mgrd;
    ctx.fillRect(0, 0, W, H);

    rafId = requestAnimationFrame(draw);
  }

  function onSearch() {
    buildPeaks();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  registerView('terrain', { init, destroy, onSearch, onTrackChange: () => {} });
})();
