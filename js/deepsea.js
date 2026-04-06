/* =========================================================
   DEEPSEA.JS — Deep Sea scrollable depth view
   ========================================================= */

(function() {
  let canvas, ctx, container, scrollArea;
  let W, H, frame = 0, rafId;
  let scrollY = 0;
  let jellies = [];
  const isMobile = () => window.innerWidth < 768;

  // Depth zone definitions
  const zones = [
    { label: '0m — Surface / Latest', color: '#00e5ff', dotShadow: '#00e5ff40', labelColor: '#00e5ff50' },
    { label: '40m — Shallow / Recent', color: '#7c3aed', dotShadow: '#8b5cf640', labelColor: '#8b5cf650' },
    { label: '100m — Midwater', color: '#8b5cf6', dotShadow: '#8b5cf640', labelColor: '#8b5cf640' },
    { label: '160m — Twilight', color: '#c084fc', dotShadow: '#c084fc30', labelColor: '#c084fc30' },
    { label: '200m — Abyss / Classics', color: '#ec4899', dotShadow: '#ec489940', labelColor: '#ec489940' },
  ];

  function getZonedTracks() {
    const filtered = getFilteredTracks();
    const perZone = Math.ceil(filtered.length / zones.length);
    return zones.map((z, zi) => ({
      ...z,
      tracks: filtered.slice(zi * perZone, (zi + 1) * perZone),
    }));
  }

  function init(cont) {
    container = cont;

    // Canvas for particles
    canvas = document.createElement('canvas');
    canvas.className = 'view-canvas';
    container.appendChild(canvas);
    ctx = canvas.getContext('2d');

    // Scrollable track list
    scrollArea = document.createElement('div');
    scrollArea.className = 'sea-scroll';
    if (isMobile()) scrollArea.style.paddingTop = '110px';
    buildTrackList();
    container.appendChild(scrollArea);

    // Depth indicator (desktop only)
    if (!isMobile()) {
      const depth = document.createElement('div');
      depth.className = 'depth-indicator';
      depth.innerHTML = `
        <div class="depth-label" style="color:#00e5ff50">Surface</div>
        <div class="depth-bar" style="background:linear-gradient(to bottom,#00e5ff30,#8b5cf620,#ec489920)"></div>
        <div class="depth-label" style="color:#ec489950">Abyss</div>
      `;
      container.appendChild(depth);
    }

    // Scroll hint
    const hint = document.createElement('div');
    hint.style.cssText = 'position:absolute;bottom:8px;left:32px;z-index:10;font-size:11px;color:#ffffff15;font-family:var(--font-mono)';
    hint.textContent = 'Scroll to dive deeper';
    container.appendChild(hint);

    // Play all / shuffle buttons at top of scroll
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:8px;margin-bottom:20px;padding-top:8px';
    controls.innerHTML = `
      <button class="info-btn" id="seaPlayAllBtn" style="font-size:12px">Play All</button>
      <button class="info-btn secondary" id="seaShuffleBtn" style="font-size:12px">Shuffle</button>
    `;
    scrollArea.insertBefore(controls, scrollArea.firstChild);

    document.getElementById('seaPlayAllBtn').addEventListener('click', () => playTrack(0));
    document.getElementById('seaShuffleBtn').addEventListener('click', () => {
      state.shuffleMode = true;
      shuffleBtn.classList.add('active');
      playTrack(Math.floor(Math.random() * tracks.length));
    });

    scrollArea.addEventListener('scroll', onScroll);
    resize();
    window.addEventListener('resize', resize);
    draw();
  }

  function buildTrackList() {
    const zonedTracks = getZonedTracks();
    let html = '';

    zonedTracks.forEach(z => {
      if (z.tracks.length === 0) return;
      html += `<div class="sea-zone-label" style="color:${z.labelColor}">${z.label}</div>`;
      z.tracks.forEach(t => {
        const isActive = t.originalIndex === state.currentTrack;
        const badges = [];
        if (t.isNew) badges.push('<span class="track-badge-new">NEW</span>');
        if (t.isFeatured) badges.push('<span class="track-badge-featured">★</span>');
        html += `
          <div class="sea-track${isActive ? ' active' : ''}" data-index="${t.originalIndex}">
            <div class="sea-dot" style="background:${z.color};box-shadow:0 0 8px ${z.dotShadow}"></div>
            <span class="sea-name">${escapeHtml(t.title)}</span>
            ${badges.join('')}
            <span class="sea-dur"></span>
          </div>
        `;
      });
    });

    html += '<div style="height:200px"></div>';
    scrollArea.innerHTML = html;

    // Click = play, double click = show detail
    scrollArea.querySelectorAll('.sea-track').forEach(el => {
      let clickTimer = null;
      el.addEventListener('click', () => {
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
          showTrackDetail(parseInt(el.dataset.index));
        } else {
          clickTimer = setTimeout(() => {
            clickTimer = null;
            playTrack(parseInt(el.dataset.index));
            updateActiveTrack();
          }, 250);
        }
      });
    });
  }

  function updateActiveTrack() {
    if (!scrollArea) return;
    scrollArea.querySelectorAll('.sea-track').forEach(el => {
      el.classList.toggle('active', parseInt(el.dataset.index) === state.currentTrack);
    });
  }

  function destroy() {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    if (scrollArea) scrollArea.removeEventListener('scroll', onScroll);
    canvas = ctx = container = scrollArea = null;
    jellies = [];
  }

  function onScroll() {
    scrollY = scrollArea ? scrollArea.scrollTop : 0;
  }

  function resize() {
    if (!canvas) return;
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    buildJellies();
  }

  function buildJellies() {
    jellies = [];
    const count = isMobile() ? 22 : 45;
    for (let i = 0; i < count; i++) {
      jellies.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: 1 + Math.random() * 3,
        speed: 0.15 + Math.random() * 0.4,
        drift: Math.random() * Math.PI * 2,
        hue: Math.random() > 0.5 ? [0, 229, 255] : [139, 92, 246],
      });
    }
  }

  function draw() {
    if (!ctx) return;
    frame++;
    ctx.clearRect(0, 0, W, H);

    const maxScroll = scrollArea ? (scrollArea.scrollHeight - H) : 1;
    const scrollRatio = Math.min(1, scrollY / Math.max(1, maxScroll));

    // Background gradient shifts with scroll depth
    const r1 = Math.floor(0 + 139 * scrollRatio);
    const g1 = Math.floor(229 - 157 * scrollRatio);
    const b1 = Math.floor(255 - 102 * scrollRatio);

    const bgGrd = ctx.createLinearGradient(0, 0, 0, H);
    bgGrd.addColorStop(0, `rgba(${r1},${g1},${b1},0.04)`);
    bgGrd.addColorStop(0.5, 'rgba(139,92,246,0.02)');
    bgGrd.addColorStop(1, `rgba(236,72,153,${0.01 + scrollRatio * 0.03})`);
    ctx.fillStyle = bgGrd;
    ctx.fillRect(0, 0, W, H);

    // Horizontal wave lines
    for (let i = 0; i < 6; i++) {
      const y = 60 + i * 100 - scrollY * 0.05;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < W; x += 15) {
        ctx.lineTo(x, y + Math.sin(x * 0.008 + frame * 0.008 + i) * 8);
      }
      ctx.strokeStyle = `rgba(${r1},${g1},${b1},${0.04 - i * 0.006})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Jellyfish particles
    jellies.forEach(j => {
      j.y -= j.speed * 0.3;
      j.x += Math.sin(frame * 0.008 + j.drift) * 0.35;
      if (j.y < -10) j.y = H + 10;
      if (j.x < -10) j.x = W + 10;
      if (j.x > W + 10) j.x = -10;

      const pulse = Math.sin(frame * 0.025 + j.drift) * 0.3 + 0.7;
      ctx.beginPath();
      ctx.arc(j.x, j.y, j.size * pulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${j.hue.join(',')},${0.12 + pulse * 0.18})`;
      ctx.fill();

      // Glow
      ctx.beginPath();
      ctx.arc(j.x, j.y, j.size * 3.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${j.hue.join(',')},0.02)`;
      ctx.fill();
    });

    rafId = requestAnimationFrame(draw);
  }

  function onSearch() {
    if (scrollArea) {
      buildTrackList();
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  registerView('deepsea', { init, destroy, onSearch, onTrackChange: updateActiveTrack });
})();
