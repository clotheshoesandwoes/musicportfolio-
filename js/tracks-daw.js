/* =========================================================
   TRACKS-DAW.JS — /tracks DAW Session view (b201)
   ---------------------------------------------------------
   Ableton-style 2D layout. Year-keyed lanes (columns) holding
   track "clips" (cells), a Master lane on the right with a live
   spectrum + meta + vertical fader, and a fully wired transport
   strip on top (prev / play / stop / next / shuffle / progress /
   time / SC / volume / L+R meters). Arrangement view toggle flips
   the grid into a horizontal timeline keyed off track date.

   DOM-driven by design — DAWs need crisp rendered text, not
   GLSL approximations. Two canvases: the master spectrum (live)
   and the per-clip procedural waveform thumbnails (deterministic
   hash-based, drawn once on build).
   ========================================================= */

(function () {
  /* ---------- Utilities ---------- */
  const PHI = 0.6180339887;

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtTime(s) {
    if (!isFinite(s) || s < 0) return '0:00.0';
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    const t = Math.floor((s - Math.floor(s)) * 10);
    return `${m}:${pad2(ss)}.${t}`;
  }
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function tierOf(t) {
    if (t.isFeatured) return 'featured';
    if (t.isNew)      return 'new';
    return 'archive';
  }
  function paletteForCell(idx, tier) {
    // T13 (= t6 reconstruction) — original tier saturation
    const baseHue = (idx * PHI * 360) % 360;
    if (tier === 'featured') return { h: (baseHue + 350) % 360, s: 78, l: 62 };
    if (tier === 'new')      return { h: (baseHue + 195) % 360, s: 70, l: 60 };
    return { h: baseHue, s: 28, l: 56 };
  }
  function slugifyLocal(s) {
    return (s || '').toString().toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '').trim()
      .replace(/\s+/g, '-').replace(/-+/g, '-');
  }

  /* ---------- Module ---------- */
  const TracksDaw = {
    root: null, ctx: null, audio: null,
    raf: 0, destroyed: false,
    view: 'session',           // 'session' | 'arrangement'
    filter: 'all', query: '',
    cells: [],                  // { idx, track, tier, palette, year, tag, el, btnEl, stripeEl, barEl, waveCanvas }
    selectedIdx: -1,
    audioCtx: null, analyser: null, freqArr: null,
    bass: 0, energy: 0, peakL: 0, peakR: 0,
    specCanvas: null, specCtx: null,
    barWaveCanvas: null, barWaveCtx: null,
    fxLevelL: 0, fxLevelR: 0,
    lastTimestamp: 0,

    /* ---------- Init ---------- */
    init(container, ctx) {
      if (this.root) return;
      this.destroyed = false;
      this.ctx = ctx || {};
      this.audio = ctx?.audio || null;
      this.filter = ctx?.filter || 'all';
      this.query = (ctx?.query || '').toLowerCase();
      this.view = 'session';
      this.cells = [];
      this.selectedIdx = -1;

      // b223: instrumented init. The black-screen-no-errors symptom in b222
      // suggested either (a) DAW root is hidden by CSS, or (b) _buildSession
      // throws inside a method that swallows it. Wrap the boot in try/catch
      // and print the DOM rect after mount so the next debug pass has data.
      console.log('[daw] init() start, container =', container, 'tracks =', (ctx && ctx.tracks ? ctx.tracks.length : 0));

      const root = document.createElement('div');
      root.className = 'daw-root';
      root.innerHTML = this._renderShell();
      container.appendChild(root);
      this.root = root;

      // Force a layout read so the rect is meaningful
      const r = root.getBoundingClientRect();
      console.log('[daw] root mounted. rect =', r.width, 'x', r.height, 'parent =', root.parentNode && root.parentNode.id);

      try {
        this._buildSession();
        console.log('[daw] _buildSession done. cells =', this.cells.length);
      } catch (e) {
        console.error('[daw] _buildSession threw:', e);
        // Surface the failure so the user doesn't see a black screen.
        const grid = root.querySelector('#daw-grid');
        if (grid) grid.innerHTML = '<div style="padding:24px;color:#ee4242;font-family:monospace;">DAW build error: ' + (e && e.message) + '</div>';
      }
      try { this._wireEvents(); } catch (e) { console.error('[daw] _wireEvents threw:', e); }

      this._ensureAnalyser();
      this.onTrackChange();

      this.animate = this.animate.bind(this);
      this.animate();
    },

    _renderShell() {
      const total = (this.ctx.tracks || []).length;
      const build = this.ctx.buildNumber || '';
      return `
        <div class="daw-topbar">
          <div class="daw-brand">
            <span class="daw-brand-led" id="daw-led"></span>
            <span class="daw-brand-name">CANTMUTE</span>
            <span class="daw-brand-sub">— kani · live ${build}</span>
          </div>
          <div class="daw-tabs">
            <button class="daw-tab on" data-view="session">SESSION</button>
            <button class="daw-tab" data-view="arrangement">ARRANGEMENT</button>
          </div>
          <div class="daw-search">
            <span class="daw-search-prefix">⌕</span>
            <input id="daw-search" type="text" autocomplete="off" spellcheck="false" placeholder="search clips…" />
          </div>
          <div class="daw-tx-right">
            <span class="daw-tx-count" id="daw-count">${total} CLIPS</span>
            <a class="daw-tx-link" href="/">← galaxy</a>
          </div>
        </div>

        <div class="daw-transport">
          <div class="daw-tx-group">
            <button class="daw-tx-btn" data-act="prev" title="previous track (←)">⏮</button>
            <button class="daw-tx-btn is-play" data-act="play" id="daw-play" title="play / pause (space)">▶</button>
            <button class="daw-tx-btn" data-act="stop" title="stop">■</button>
            <button class="daw-tx-btn" data-act="next" title="next track (→)">⏭</button>
            <button class="daw-tx-btn" data-act="shuffle" title="random clip (R)">⤬</button>
          </div>

          <div class="daw-tx-now">
            <span class="daw-tx-num" id="daw-tx-num">— · — —</span>
            <span class="daw-tx-title" id="daw-tx-title">— no clip armed —</span>
            <span class="daw-tx-meta" id="daw-tx-meta"></span>
          </div>

          <div class="daw-tx-progress" id="daw-tx-progress" title="click to seek">
            <canvas class="daw-tx-wave" id="daw-tx-wave"></canvas>
            <div class="daw-tx-fill" id="daw-tx-fill"></div>
            <div class="daw-tx-playhead" id="daw-tx-playhead"></div>
          </div>

          <div class="daw-tx-time" id="daw-tx-time">0:00.0 / 0:00.0</div>

          <div class="daw-tx-group">
            <a class="daw-tx-btn is-sc" id="daw-tx-sc" target="_blank" rel="noopener" href="#" title="open on SoundCloud">
              <svg class="daw-sc-glyph" viewBox="0 0 26 14" aria-hidden="true">
                <g fill="currentColor">
                  <rect x="0"  y="6" width="1.6" height="6"/>
                  <rect x="2.4" y="4" width="1.6" height="9"/>
                  <rect x="4.8" y="2" width="1.6" height="11"/>
                  <rect x="7.2" y="1" width="1.6" height="12"/>
                  <path d="M11 1.5c.5-.4 1.2-.6 1.9-.5.6.1 1.2.5 1.5 1.1.4-.2.9-.3 1.4-.2.6.1 1.2.5 1.5 1.1.5-.4 1.2-.6 1.9-.4 1 .2 1.7 1 1.8 2 2 .1 3.6 1.7 3.6 3.7s-1.7 3.7-3.7 3.7H11V1.5z"/>
                </g>
              </svg>
            </a>
          </div>

          <div class="daw-tx-vol">
            <span class="daw-tx-vol-label">VOL</span>
            <input type="range" id="daw-vol" min="0" max="1" step="0.01" value="0.8" />
          </div>

          <div class="daw-tx-meters">
            <div class="daw-tx-meter"><div class="daw-tx-meter-fill" id="daw-meter-l"></div></div>
            <div class="daw-tx-meter"><div class="daw-tx-meter-fill" id="daw-meter-r"></div></div>
          </div>
        </div>

        <div class="daw-bandbar" id="daw-bandbar">
          <span class="daw-bb-label">FILTERS</span>
          <button class="daw-bb-chip on" data-filter="all">all</button>
          <button class="daw-bb-chip" data-filter="featured">featured</button>
          <button class="daw-bb-chip" data-filter="new">new</button>
          <button class="daw-bb-chip" data-filter="hard">hard</button>
          <button class="daw-bb-chip" data-filter="chill">chill</button>
          <button class="daw-bb-chip" data-filter="grunge">grunge</button>
          <button class="daw-bb-chip" data-filter="vibe">vibe</button>
          <span class="daw-bb-spacer"></span>
          <span class="daw-bb-hint"><kbd>SPACE</kbd> play  <kbd>R</kbd> shuffle  <kbd>← → ↑ ↓</kbd> nav  <kbd>↵</kbd> launch</span>
        </div>

        <div class="daw-grid" id="daw-grid"></div>
      `;
    },

    /* ---------- Build views ---------- */
    _buildSession() {
      const grid = this.root.querySelector('#daw-grid');
      grid.innerHTML = '';
      grid.classList.remove('is-arrange');
      grid.classList.add('is-session');

      const scroll = document.createElement('div');
      scroll.className = 'daw-scroll';
      grid.appendChild(scroll);

      const tracks = this.ctx.tracks || [];
      const byYear = new Map();
      tracks.forEach((t, i) => {
        const y = t.date ? new Date(t.date).getFullYear() : 0;
        if (!byYear.has(y)) byYear.set(y, []);
        byYear.get(y).push({ idx: i, track: t });
      });
      const years = [...byYear.keys()].sort((a, b) => b - a);

      this.cells = [];

      years.forEach((y, yIdx) => {
        const lane = document.createElement('div');
        lane.className = 'daw-lane';
        lane.dataset.year = y;
        lane.style.setProperty('--lane-idx', yIdx);

        const head = document.createElement('div');
        head.className = 'daw-lane-head';
        const headHue = ((yIdx * 47) % 360);
        head.style.setProperty('--head-h', headHue);
        head.innerHTML = `
          <div class="daw-lane-stripe"></div>
          <div class="daw-lane-title">${y || '—'}</div>
          <div class="daw-lane-sub">${byYear.get(y).length} clips</div>
          <div class="daw-lane-buttons">
            <button class="daw-tinybtn" data-toggle="m" title="mute">M</button>
            <button class="daw-tinybtn" data-toggle="s" title="solo">S</button>
          </div>
        `;
        lane.appendChild(head);

        const stack = document.createElement('div');
        stack.className = 'daw-stack';

        byYear.get(y).forEach(({ idx, track }) => {
          const cell = this._buildCell(track, idx);
          stack.appendChild(cell.el);
          this.cells.push(cell);
        });

        lane.appendChild(stack);
        scroll.appendChild(lane);
      });

      // master lane (sibling of scroll, lives outside the scrolling area)
      const master = document.createElement('div');
      master.className = 'daw-lane is-master';
      // T13 (= t6 reconstruction) — master pane: card + spectrum + grid + actions
      master.innerHTML = `
        <div class="daw-lane-head is-master-head">
          <div class="daw-lane-stripe"></div>
          <div class="daw-lane-title">MASTER</div>
          <div class="daw-lane-sub">2 ▸ R · 44.1 kHz</div>
          <div class="daw-lane-buttons">
            <button class="daw-tinybtn" disabled>—</button>
            <button class="daw-tinybtn" disabled>—</button>
          </div>
        </div>
        <div class="daw-master-body">
          <div class="daw-master-card">
            <div class="daw-mc-label">NOW PLAYING</div>
            <div class="daw-mc-num" id="daw-mc-num">— · — —</div>
            <div class="daw-mc-title" id="daw-mc-title">— · — — — —</div>
            <div class="daw-mc-meta" id="daw-mc-meta"></div>
          </div>
          <div class="daw-spectrum">
            <canvas id="daw-spectrum"></canvas>
          </div>
          <div class="daw-master-grid">
            <div class="daw-mg-row"><span class="daw-mg-k">tier</span><span class="daw-mg-v" id="daw-mg-tier">—</span></div>
            <div class="daw-mg-row"><span class="daw-mg-k">tags</span><span class="daw-mg-v" id="daw-mg-tags">—</span></div>
            <div class="daw-mg-row"><span class="daw-mg-k">date</span><span class="daw-mg-v" id="daw-mg-date">—</span></div>
            <div class="daw-mg-row"><span class="daw-mg-k">slot</span><span class="daw-mg-v" id="daw-mg-slot">—</span></div>
          </div>
          <div class="daw-master-actions">
            <button class="daw-ma" id="daw-ma-details" title="show details" aria-expanded="false">▸ details</button>
            <div class="daw-ma-panel" id="daw-ma-details-panel" hidden>
              <div class="daw-ma-panel-row" id="daw-ma-notes">
                <div class="daw-ma-panel-k">// notes</div>
                <div class="daw-ma-panel-v" id="daw-ma-notes-v">—</div>
              </div>
              <div class="daw-ma-panel-row" id="daw-ma-credits" hidden>
                <div class="daw-ma-panel-k">// credits</div>
                <div class="daw-ma-panel-v" id="daw-ma-credits-v">—</div>
              </div>
              <div class="daw-ma-panel-row" id="daw-ma-file">
                <div class="daw-ma-panel-k">// file</div>
                <div class="daw-ma-panel-v daw-ma-mono" id="daw-ma-file-v">—</div>
              </div>
              <div class="daw-ma-panel-row">
                <div class="daw-ma-panel-k">// permalink</div>
                <button class="daw-ma-link" id="daw-ma-perma" title="copy permalink">—</button>
              </div>
            </div>
            <a class="daw-ma daw-ma-sc" id="daw-ma-sc" href="#" target="_blank" rel="noopener" title="open on soundcloud">▸ soundcloud</a>
            <button class="daw-ma" id="daw-ma-share" title="copy share link">▸ share</button>
          </div>
        </div>
      `;
      grid.appendChild(master);

      // Defer one frame so the canvases have real layout dimensions before drawing.
      requestAnimationFrame(() => {
        if (this.destroyed) return;
        this.cells.forEach(c => this._drawClipWaveform(c));
        this._sizeSpectrum();
      });
      this._applyVisibility();
    },

    _buildArrangement() {
      // t7 — DISCOGRAPHY TAPE
      // Single horizontal row, oldest → newest, time-positioned.
      // Each track is a tall block (waveform + title + date + tier tint).
      // Year markers mark Jan-1 boundaries. Click → launch.
      const grid = this.root.querySelector('#daw-grid');
      grid.innerHTML = '';
      grid.classList.remove('is-session');
      grid.classList.add('is-arrange');

      const tracks = (this.ctx.tracks || []);
      // Sort indices ascending by date so the tape reads left-to-right oldest→newest.
      const dated = tracks.map((t, idx) => ({ t, idx }))
        .filter(x => x.t.date)
        .sort((a, b) => new Date(a.t.date) - new Date(b.t.date));

      if (!dated.length) {
        grid.innerHTML = '<div style="padding:40px;color:#666;font-family:monospace">no dated tracks to arrange.</div>';
        return;
      }

      // Year range derived from sorted set
      const minD = new Date(dated[0].t.date);
      const maxD = new Date(dated[dated.length - 1].t.date);
      const minY = minD.getFullYear();
      const maxY = maxD.getFullYear();

      const BLOCK_W       = 200;
      const BLOCK_H       = 156;
      const GAP_MIN       = 4;
      const GAP_MAX       = 40;
      const PAD_LEFT      = 80;     // space for the leading year marker
      const PAD_RIGHT     = 60;
      const TOP_RULER_H   = 38;
      const ROW_TOP       = TOP_RULER_H + 28;

      // Position each block. Gap from previous = sqrt-scaled days-since-last,
      // clamped to [GAP_MIN, GAP_MAX]. Square root keeps a 6-month gap visibly
      // bigger than a 1-week gap without letting a 5-year gap dominate.
      const positions = [];
      let cursor = PAD_LEFT;
      let prevDate = null;
      for (let i = 0; i < dated.length; i++) {
        const d = new Date(dated[i].t.date);
        if (prevDate) {
          const days = Math.max(0, (d - prevDate) / 86400000);
          const gap = Math.max(GAP_MIN, Math.min(GAP_MAX, Math.sqrt(days) * 1.6));
          cursor += gap;
        }
        positions.push({ x: cursor, date: d });
        cursor += BLOCK_W;
        prevDate = d;
      }
      const totalW = cursor + PAD_RIGHT;

      const inner = document.createElement('div');
      inner.className = 'daw-arr';
      inner.style.width = totalW + 'px';
      inner.style.height = (ROW_TOP + BLOCK_H + 60) + 'px';

      // Top ruler — sticky band with year labels at first-of-year transitions
      const ruler = document.createElement('div');
      ruler.className = 'daw-arr-ruler';
      ruler.style.width = totalW + 'px';
      // Always show min year at the very start
      const seenYears = new Set();
      const addYearLabel = (year, x) => {
        if (seenYears.has(year)) return;
        seenYears.add(year);
        const lab = document.createElement('div');
        lab.className = 'daw-arr-year';
        lab.textContent = year;
        lab.style.left = (x - 8) + 'px';
        ruler.appendChild(lab);
        const tick = document.createElement('div');
        tick.className = 'daw-arr-tick is-major';
        tick.style.left = x + 'px';
        tick.style.height = (BLOCK_H + ROW_TOP - TOP_RULER_H + 24) + 'px';
        tick.style.top = TOP_RULER_H + 'px';
        inner.appendChild(tick);
      };
      addYearLabel(minY, PAD_LEFT - 10);
      let prevYear = minY;
      positions.forEach((p, i) => {
        const y = p.date.getFullYear();
        if (y !== prevYear) {
          addYearLabel(y, p.x - 6);
          prevYear = y;
        }
      });
      inner.appendChild(ruler);

      // Range label (top right)
      const range = document.createElement('div');
      range.className = 'daw-arr-range';
      range.textContent = `${minY} → ${maxY}  ·  ${dated.length} clips`;
      ruler.appendChild(range);

      this.arrCells = [];

      dated.forEach((entry, i) => {
        const idx   = entry.idx;
        const track = entry.t;
        const pos   = positions[i];
        const tier  = tierOf(track);
        const pal   = paletteForCell(idx, tier);

        const block = document.createElement('div');
        block.className = 'daw-arr-block';
        block.dataset.idx = idx;
        block.dataset.tier = tier;
        block.style.left = pos.x + 'px';
        block.style.top  = ROW_TOP + 'px';
        block.style.width  = BLOCK_W + 'px';
        block.style.height = BLOCK_H + 'px';
        block.style.setProperty('--clip-h', pal.h);
        block.style.setProperty('--clip-s', pal.s + '%');
        block.style.setProperty('--clip-l', pal.l + '%');

        const slot = String(idx + 1).padStart(3, '0');
        const dateStr = `${pos.date.getFullYear()}.${pad2(pos.date.getMonth()+1)}.${pad2(pos.date.getDate())}`;
        block.innerHTML = `
          <div class="daw-arr-block-stripe"></div>
          <div class="daw-arr-block-head">
            <span class="daw-arr-block-slot">${slot}</span>
            <span class="daw-arr-block-tier">${tier}</span>
          </div>
          <div class="daw-arr-block-title">${(track.title || '').toLowerCase()}</div>
          <canvas class="daw-arr-block-wave"></canvas>
          <div class="daw-arr-block-date">${dateStr}</div>
          <div class="daw-arr-block-bar"></div>
        `;
        block.title = `${track.title}  ·  ${track.date}`;
        block.addEventListener('click', (e) => { e.stopPropagation(); this._launch(idx); });
        inner.appendChild(block);

        // Reuse the session waveform renderer by handing it a cell-like object.
        const waveCanvas = block.querySelector('.daw-arr-block-wave');
        const arrCell = {
          idx, track, palette: pal, tier,
          el: block, btnEl: null, stripeEl: null,
          barEl: block.querySelector('.daw-arr-block-bar'),
          waveCanvas,
        };
        // Defer to next frame so the canvas has a non-zero width.
        requestAnimationFrame(() => { try { this._drawClipWaveform(arrCell); } catch(e){} });
        this.arrCells.push(arrCell);
      });

      // Playhead — vertical line that sweeps across the active block while playing.
      const head = document.createElement('div');
      head.className = 'daw-arr-head';
      head.id = 'daw-arr-head';
      head.style.top = TOP_RULER_H + 'px';
      head.style.height = (BLOCK_H + 24) + 'px';
      inner.appendChild(head);

      grid.appendChild(inner);

      // Auto-scroll to the most-recent block on load.
      requestAnimationFrame(() => { grid.scrollLeft = totalW; });
    },

    _buildCell(track, idx) {
      const tier = tierOf(track);
      const pal  = paletteForCell(idx, tier);
      const date = track.date ? new Date(track.date) : null;
      const dateStr = date
        ? `${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`
        : '—';
      const tag = (track.tags && track.tags[0]) ? track.tags[0] : (tier === 'featured' ? 'feat' : tier === 'new' ? 'new' : '—');
      const num = String(idx + 1).padStart(3, '0');

      const el = document.createElement('div');
      el.className = 'daw-clip';
      el.dataset.idx = idx;
      el.dataset.tier = tier;
      el.style.setProperty('--clip-h', pal.h);
      el.style.setProperty('--clip-s', pal.s + '%');
      el.style.setProperty('--clip-l', pal.l + '%');
      // T13 (= t6 reconstruction) — clip cell
      el.innerHTML = `
        <div class="daw-clip-stripe"></div>
        <div class="daw-clip-row">
          <button class="daw-clip-btn" title="launch ${track.title}">▶</button>
          <div class="daw-clip-text">
            <div class="daw-clip-title">${(track.title || '').toLowerCase()}</div>
            <div class="daw-clip-meta">
              <span class="daw-clip-num">${num}</span>
              <span class="daw-clip-dot">·</span>
              <span class="daw-clip-date">${dateStr}</span>
              <span class="daw-clip-dot">·</span>
              <span class="daw-clip-tag">${tag}</span>
            </div>
          </div>
        </div>
        <canvas class="daw-clip-wave"></canvas>
        <div class="daw-clip-bar"></div>
      `;

      const cell = {
        idx, track, tier, palette: pal, year: date ? date.getFullYear() : 0, tag,
        el,
        btnEl:    el.querySelector('.daw-clip-btn'),
        stripeEl: el.querySelector('.daw-clip-stripe'),
        barEl:    el.querySelector('.daw-clip-bar'),
        waveCanvas: el.querySelector('.daw-clip-wave'),
        coverCanvas: null,
        tapeEl:   null,
        slug: slugifyLocal(track.title),
      };
      return cell;
    },

    /* ---------- Hero cover for master pane ----------
       Reuses the cover renderer at large size, drawn for the currently-armed
       track. Idle state shows ambient drift seeded by frame count. */
    _drawMasterCover() {
      const c = this.root && this.root.querySelector('#daw-master-cover');
      if (!c) return;
      const cur = (this.ctx.getCurrent && this.ctx.getCurrent()) ?? -1;
      const tracks = this.ctx.tracks || [];
      const track  = (cur >= 0 && tracks[cur]) ? tracks[cur] : null;
      if (!track) {
        // Idle — soft drifting wash so the master pane never looks dead
        const r = c.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = r.width | 0, h = r.height | 0;
        c.width = w * dpr; c.height = h * dpr;
        c.style.width = w + 'px'; c.style.height = h + 'px';
        const ctx = c.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#0a0e16';
        ctx.fillRect(0, 0, w, h);
        const g = ctx.createRadialGradient(w * 0.3, h * 0.3, 0, w * 0.5, h * 0.5, w * 0.8);
        g.addColorStop(0, 'rgba(110,231,255,0.18)');
        g.addColorStop(0.5, 'rgba(255,138,61,0.06)');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        return;
      }
      // Reuse _drawClipCover by handing it a fake cell
      const tier = tierOf(track);
      const pal  = paletteForCell(cur, tier);
      this._drawClipCover({
        coverCanvas: c,
        palette: pal,
        track, idx: cur,
      });
    },

    /* ---------- Generative cover art ----------
       Each clip gets a unique procedural visual seeded by its title hash.
       Three styles cycled by hash bits: aurora bands, radial bloom,
       mosaic mesh. Palette-aware so featured/new/archive tiers each get
       a coherent variant. Replaces the wall-of-identical-waveforms feel. */
    _drawClipCover(cell) {
      const c = cell.coverCanvas;
      if (!c) return;
      const r = c.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(40, r.width | 0);
      const h = Math.max(20, r.height | 0);
      c.width  = w * dpr; c.height = h * dpr;
      c.style.width = w + 'px'; c.style.height = h + 'px';
      const ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);

      const pal  = cell.palette;
      const seed = hash((cell.track.title || '') + ':' + cell.idx);
      const style = seed % 3;

      // Base — deep tinted background
      ctx.fillStyle = `hsl(${pal.h}, ${Math.min(60, pal.s)}%, 8%)`;
      ctx.fillRect(0, 0, w, h);

      const rnd = (function(s){ s = s >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; }; })(seed);

      if (style === 0) {
        // AURORA — stacked translucent ellipse bands at angles
        ctx.globalCompositeOperation = 'lighter';
        const bands = 4 + (seed % 3);
        for (let i = 0; i < bands; i++) {
          const cy = h * (0.15 + 0.7 * rnd());
          const angle = (rnd() - 0.5) * 0.7;
          const hueShift = (rnd() - 0.5) * 60;
          const lightness = 48 + rnd() * 28;
          ctx.save();
          ctx.translate(w / 2, cy);
          ctx.rotate(angle);
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.85);
          grad.addColorStop(0,   `hsla(${pal.h + hueShift}, ${pal.s}%, ${lightness}%, 0.55)`);
          grad.addColorStop(0.5, `hsla(${pal.h + hueShift}, ${pal.s}%, ${lightness}%, 0.22)`);
          grad.addColorStop(1,   'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(0, 0, w * 0.9, h * (0.22 + rnd() * 0.10), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
      } else if (style === 1) {
        // BLOOM — soft radial blobs, ink-in-water feel
        ctx.globalCompositeOperation = 'lighter';
        const cx = w * (0.25 + 0.5 * rnd());
        const cy = h * (0.25 + 0.5 * rnd());
        const radius = Math.max(w, h) * (0.55 + 0.35 * rnd());
        const g0 = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g0.addColorStop(0,   `hsla(${pal.h}, ${pal.s}%, 70%, 0.85)`);
        g0.addColorStop(0.35,`hsla(${pal.h + 18}, ${pal.s}%, 58%, 0.50)`);
        g0.addColorStop(1,   'transparent');
        ctx.fillStyle = g0; ctx.fillRect(0, 0, w, h);
        const blooms = 3 + (seed % 3);
        for (let i = 0; i < blooms; i++) {
          const x = w * rnd();
          const y = h * rnd();
          const rad = Math.max(w, h) * (0.18 + 0.32 * rnd());
          const hueShift = (rnd() - 0.5) * 90;
          const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
          g.addColorStop(0, `hsla(${pal.h + hueShift}, ${pal.s}%, 64%, 0.55)`);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        }
        ctx.globalCompositeOperation = 'source-over';
      } else {
        // MOSAIC — grid of palette-tinted cells, brightness varies by hash
        const cols = 8 + (seed & 3);
        const rows = Math.max(3, Math.floor(h / w * cols) || 4);
        const cellW = w / cols, cellH = h / rows;
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const v = rnd();
            const dist = Math.hypot(x - cols/2 + (rnd()-0.5)*1.2, y - rows/2 + (rnd()-0.5)*1.2);
            const alpha = Math.max(0.05, 1 - dist / (cols * 0.55)) * (0.30 + 0.70 * v);
            const lightness = 30 + v * 42;
            const hueShift = (rnd() - 0.5) * 40;
            ctx.fillStyle = `hsla(${pal.h + hueShift}, ${pal.s}%, ${lightness}%, ${alpha})`;
            ctx.fillRect(x * cellW + 0.5, y * cellH + 0.5, cellW - 1, cellH - 1);
          }
        }
        // Subtle scan-overlay on top for texture
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        for (let yy = 0; yy < h; yy += 3) ctx.fillRect(0, yy, w, 1);
      }

      // Inner border highlight + bottom vignette so the cover edges feel sharp
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, 0, w, 1);
      const vg = ctx.createLinearGradient(0, h * 0.55, 0, h);
      vg.addColorStop(0, 'transparent');
      vg.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, h * 0.55, w, h * 0.45);
    },

    _drawClipWaveform(cell) {
      const c = cell.waveCanvas;
      if (!c) return;
      const r = c.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(60, r.width | 0);
      const h = Math.max(20, r.height | 0);
      c.width  = w * dpr; c.height = h * dpr;
      c.style.width = w + 'px'; c.style.height = h + 'px';
      const ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);

      const pal = cell.palette;
      const seed = hash(cell.track.title || ('t' + cell.idx));
      // Title-seeded LCG so each clip has a stable, distinct envelope shape.
      let s = seed >>> 0;
      const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };

      // Build a dynamic amplitude envelope: arc + mid sines + grain.
      const N = Math.max(80, Math.min(220, w | 0));
      const a1 = rnd() * 6.28, a2 = rnd() * 6.28, a3 = rnd() * 6.28;
      const f2 = 3 + rnd() * 4, f3 = 8 + rnd() * 8;
      const amps = new Array(N);
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const env =
          0.55 * Math.sin(t * Math.PI) +
          0.24 * Math.sin(t * Math.PI * f2 + a1) +
          0.16 * Math.sin(t * Math.PI * f3 + a2) +
          0.10 * (Math.sin(i * 0.83 + a3) * 0.5 + 0.5);
        amps[i] = Math.max(0.06, Math.min(1, Math.abs(env) * 1.15));
      }

      ctx.clearRect(0, 0, w, h);
      const cy = h * 0.5;
      const half = h * 0.46;

      const traceTop = () => {
        ctx.beginPath();
        ctx.moveTo(0, cy);
        for (let i = 0; i < N; i++) {
          const x = (i / (N - 1)) * w;
          ctx.lineTo(x, cy - amps[i] * half);
        }
        ctx.lineTo(w, cy);
        ctx.closePath();
      };
      const traceBot = () => {
        ctx.beginPath();
        ctx.moveTo(0, cy);
        for (let i = 0; i < N; i++) {
          const x = (i / (N - 1)) * w;
          ctx.lineTo(x, cy + amps[i] * half);
        }
        ctx.lineTo(w, cy);
        ctx.closePath();
      };

      const gTop = ctx.createLinearGradient(0, 0, 0, cy);
      gTop.addColorStop(0, `hsla(${pal.h}, ${pal.s}%, ${Math.min(82, pal.l + 24)}%, 0.95)`);
      gTop.addColorStop(1, `hsla(${pal.h}, ${pal.s}%, ${pal.l}%, 0.50)`);
      ctx.fillStyle = gTop;
      traceTop();
      ctx.fill();

      const gBot = ctx.createLinearGradient(0, cy, 0, h);
      gBot.addColorStop(0, `hsla(${pal.h}, ${pal.s}%, ${pal.l}%, 0.50)`);
      gBot.addColorStop(1, `hsla(${pal.h}, ${pal.s}%, ${Math.max(18, pal.l - 20)}%, 0.88)`);
      ctx.fillStyle = gBot;
      traceBot();
      ctx.fill();

      // Crisp highlight outline along the peaks so the silhouette reads at small sizes.
      ctx.strokeStyle = `hsla(${pal.h}, ${pal.s}%, ${Math.min(88, pal.l + 30)}%, 0.55)`;
      ctx.lineWidth = 1;
      traceTop(); ctx.stroke();
      traceBot(); ctx.stroke();

      // Quiet center line.
      ctx.fillStyle = `hsla(${pal.h}, ${Math.min(60, pal.s)}%, ${Math.min(85, pal.l + 32)}%, 0.22)`;
      ctx.fillRect(0, cy - 0.5, w, 1);
    },

    /* ---------- Wire events ---------- */
    _wireEvents() {
      const root = this.root;

      // tabs
      root.querySelectorAll('[data-view]').forEach(b => {
        b.addEventListener('click', e => { e.stopPropagation(); this._setView(b.dataset.view); });
      });

      // search
      const sEl = root.querySelector('#daw-search');
      sEl.value = this.query || '';
      sEl.addEventListener('input', e => { this.setQuery(e.target.value); });
      sEl.addEventListener('keydown', e => e.stopPropagation());

      // transport buttons
      root.querySelectorAll('.daw-tx-btn[data-act]').forEach(b => {
        b.addEventListener('click', e => {
          e.stopPropagation();
          this._handleAct(b.dataset.act);
        });
      });

      // clip launch — delegated to `.daw-grid` so future arrangement bars also work.
      const grid = root.querySelector('#daw-grid');
      grid.addEventListener('click', (e) => {
        const btn = e.target.closest('.daw-clip-btn');
        if (btn) {
          e.stopPropagation();
          const cell = btn.closest('.daw-clip');
          if (cell) this._launch(+cell.dataset.idx);
          return;
        }
        const cell = e.target.closest('.daw-clip');
        if (cell) {
          this._select(+cell.dataset.idx);
        }
      });
      // clip hover preview text in status bar
      grid.addEventListener('mouseover', e => {
        const cell = e.target.closest('.daw-clip');
        if (!cell) return;
        const idx = +cell.dataset.idx;
        const c = this.cells.find(x => x.idx === idx);
        if (c) this._setStatus(`▸ ${(c.track.title || '').toLowerCase()}  ·  ${c.tier}  ·  ${c.year || '—'}`);
      });
      grid.addEventListener('mouseout', e => {
        if (e.target.closest('.daw-clip')) this._setStatus('READY');
      });


      // filter chips
      root.querySelectorAll('.daw-bb-chip').forEach(b => {
        b.addEventListener('click', e => {
          e.stopPropagation();
          this.setFilter(b.dataset.filter);
          // sync URL
          const path = location.pathname;
          if (b.dataset.filter === 'new' && path !== '/tracks/new') history.pushState(null, '', '/tracks/new');
          else if ((b.dataset.filter === 'all' || (b.dataset.filter !== 'new' && b.dataset.filter !== 'featured')) && path !== '/tracks') {
            history.pushState(null, '', '/tracks');
          }
        });
      });

      // progress click + drag-scrub
      const prog = root.querySelector('#daw-tx-progress');
      const seekFromEvent = (e) => {
        const r = prog.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, ((e.clientX || (e.touches && e.touches[0]?.clientX) || 0) - r.left) / r.width));
        if (this.ctx.onSeek) this.ctx.onSeek(pct);
      };
      prog.addEventListener('click', e => { e.stopPropagation(); seekFromEvent(e); });
      prog.addEventListener('pointerdown', e => {
        e.stopPropagation();
        prog.setPointerCapture?.(e.pointerId);
        seekFromEvent(e);
        const move = (ev) => seekFromEvent(ev);
        const up   = () => {
          prog.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        prog.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });

      // volume
      const vol = root.querySelector('#daw-vol');
      if (vol && this.audio) {
        vol.value = String(this.audio.volume ?? 0.8);
        vol.addEventListener('input', e => {
          if (this.audio) this.audio.volume = +e.target.value;
        });
      }

      // master actions
      const shareEl = root.querySelector('#daw-ma-share');
      if (shareEl) shareEl.addEventListener('click', e => {
        e.stopPropagation();
        const cur = (this.ctx.getCurrent && this.ctx.getCurrent()) ?? -1;
        const t = (this.ctx.tracks || [])[cur];
        if (!t) return;
        const url = `${location.origin}/t/${slugifyLocal(t.title)}`;
        if (this.ctx.onCopy) this.ctx.onCopy(url);
        if (this.ctx.onToast) this.ctx.onToast('link copied');
      });

      // ▸ details — inline collapsible panel (no page nav).
      const detailsToggle = root.querySelector('#daw-ma-details');
      const detailsPanel  = root.querySelector('#daw-ma-details-panel');
      if (detailsToggle && detailsPanel) {
        detailsToggle.addEventListener('click', e => {
          e.stopPropagation();
          const open = detailsPanel.hasAttribute('hidden');
          if (open) {
            detailsPanel.removeAttribute('hidden');
            detailsToggle.textContent = '▾ details';
            detailsToggle.setAttribute('aria-expanded', 'true');
          } else {
            detailsPanel.setAttribute('hidden', '');
            detailsToggle.textContent = '▸ details';
            detailsToggle.setAttribute('aria-expanded', 'false');
          }
        });
      }
      const permaEl = root.querySelector('#daw-ma-perma');
      if (permaEl) permaEl.addEventListener('click', e => {
        e.stopPropagation();
        const url = permaEl.dataset.url;
        if (!url) return;
        if (this.ctx.onCopy) this.ctx.onCopy(url);
        if (this.ctx.onToast) this.ctx.onToast('link copied');
      });

      // keyboard
      this._onKey = (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (e.code === 'Space') { e.preventDefault(); this._handleAct('play'); return; }
        if (e.key === 'r' || e.key === 'R') { this._shuffle(); return; }
        if (e.key === 'Enter') {
          if (this.selectedIdx >= 0) this._launch(this.selectedIdx);
          return;
        }
        if (e.key === 'Escape') { this._setStatus('READY'); return; }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); this._navCell(-1, 0); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); this._navCell(+1, 0); return; }
        if (e.key === 'ArrowUp')    { e.preventDefault(); this._navCell(0, -1); return; }
        if (e.key === 'ArrowDown')  { e.preventDefault(); this._navCell(0, +1); return; }
      };
      window.addEventListener('keydown', this._onKey);
      this._onResize = () => {
        // Redraw waveforms (responsive layout)
        this.cells.forEach(c => this._drawClipWaveform(c));
        this._sizeSpectrum();
      };
      window.addEventListener('resize', this._onResize);
    },

    _handleAct(a) {
      if (a === 'play') {
        if (this.ctx.onTogglePlay) this.ctx.onTogglePlay();
        if (this.audioCtx?.state === 'suspended') this.audioCtx.resume().catch(() => {});
      } else if (a === 'prev') {
        this.ctx.onPrev && this.ctx.onPrev();
      } else if (a === 'next') {
        this.ctx.onNext && this.ctx.onNext();
      } else if (a === 'stop') {
        if (this.audio) { this.audio.pause(); try { this.audio.currentTime = 0; } catch (e) {} }
      } else if (a === 'shuffle') {
        this._shuffle();
      }
    },

    /* ---------- Filter / search ---------- */
    setFilter(name) {
      this.filter = name || 'all';
      this.root.querySelectorAll('.daw-bb-chip').forEach(b => {
        b.classList.toggle('on', b.dataset.filter === this.filter);
      });
      this._applyVisibility();
    },
    setQuery(q) {
      this.query = (q || '').toLowerCase();
      this._applyVisibility();
    },
    _matchesFilter(c) {
      const t = c.track;
      if (this.filter === 'featured' && !t.isFeatured) return false;
      if (this.filter === 'new'      && !t.isNew)      return false;
      if (this.filter !== 'all' && this.filter !== 'featured' && this.filter !== 'new') {
        const tags = (t.tags || []).map(x => String(x).toLowerCase());
        if (!tags.includes(this.filter)) return false;
      }
      if (this.query && !(t.title || '').toLowerCase().includes(this.query)) return false;
      return true;
    },
    _applyVisibility() {
      let visible = 0;
      this.cells.forEach(c => {
        const want = this._matchesFilter(c);
        c.el.classList.toggle('is-hidden', !want);
        c.el.classList.toggle('is-dimmed', !want);
        if (want) visible++;
      });
      // Lane head counts update
      const tracks = this.ctx.tracks || [];
      const counts = new Map();
      this.cells.forEach(c => {
        if (c.el.classList.contains('is-hidden')) return;
        const k = c.year;
        counts.set(k, (counts.get(k) || 0) + 1);
      });
      this.root.querySelectorAll('.daw-lane[data-year] .daw-lane-sub').forEach(sub => {
        const lane = sub.closest('.daw-lane');
        const y = +lane.dataset.year;
        sub.textContent = `${counts.get(y) || 0} clips`;
      });
      const ce = this.root.querySelector('#daw-count');
      if (ce) ce.textContent = `${visible} / ${tracks.length} CLIPS`;
    },

    /* ---------- View toggle ---------- */
    _setView(v) {
      if (v === this.view) return;
      this.view = v;
      this.root.querySelectorAll('.daw-tab').forEach(b => b.classList.toggle('on', b.dataset.view === v));
      if (v === 'session') this._buildSession();
      else                 this._buildArrangement();
      // Re-apply highlight for currently playing
      this.onTrackChange();
    },

    /* ---------- Selection / navigation ---------- */
    _select(idx) {
      this.selectedIdx = idx;
      this.cells.forEach(c => c.el.classList.toggle('is-selected', c.idx === idx));
      const c = this.cells.find(x => x.idx === idx);
      if (c) this._setStatus(`▸ ${(c.track.title || '').toLowerCase()}  ·  ${c.tier}  ·  enter to launch`);
    },
    _launch(idx) {
      if (this.ctx.onPlay) this.ctx.onPlay(idx);
      this._select(idx);
      if (this.audioCtx?.state === 'suspended') this.audioCtx.resume().catch(() => {});
      else this._ensureAnalyser();
    },
    _navCell(dx, dy) {
      const visible = this.cells.filter(c => !c.el.classList.contains('is-hidden'));
      if (!visible.length) return;
      let i = visible.findIndex(c => c.idx === this.selectedIdx);
      if (i < 0) {
        const cur = (this.ctx.getCurrent && this.ctx.getCurrent()) ?? -1;
        i = visible.findIndex(c => c.idx === cur);
        if (i < 0) i = 0;
      }
      let next = i;
      if (dx) {
        // jump to first clip of prev/next year column
        const curYear = visible[i].year;
        const sortedYears = [...new Set(visible.map(c => c.year))].sort((a, b) => b - a);
        const yi = sortedYears.indexOf(curYear);
        const ni = ((yi + dx) % sortedYears.length + sortedYears.length) % sortedYears.length;
        const targetYear = sortedYears[ni];
        next = visible.findIndex(c => c.year === targetYear);
      } else if (dy) {
        // step up/down within same year
        const curYear = visible[i].year;
        const sameYear = visible.map((c, ix) => ({ c, ix })).filter(o => o.c.year === curYear);
        const j = sameYear.findIndex(o => o.ix === i);
        const nj = (j + dy + sameYear.length) % sameYear.length;
        next = sameYear[nj].ix;
      }
      this._select(visible[next].idx);
      visible[next].el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
    _shuffle() {
      const visible = this.cells.filter(c => !c.el.classList.contains('is-hidden'));
      if (!visible.length) return;
      const cur = (this.ctx.getCurrent && this.ctx.getCurrent()) ?? -1;
      let pick = visible[Math.floor(Math.random() * visible.length)];
      if (visible.length > 1 && pick.idx === cur) {
        pick = visible[(visible.indexOf(pick) + 1) % visible.length];
      }
      this._launch(pick.idx);
      pick.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },

    _setStatus(msg) {
      const el = this.root.querySelector('#daw-st-msg');
      if (el) el.textContent = msg;
    },

    /* ---------- Audio analyser ---------- */
    _ensureAnalyser() {
      if (this.analyser || !this.audio) return;
      if (this.audio.__floorAnalyser) {
        this.audioCtx = this.audio.__floorAnalyser.ctx;
        this.analyser = this.audio.__floorAnalyser.analyser;
        this.freqArr  = this.audio.__floorAnalyser.freqArr;
        return;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AC();
        const src = this.audioCtx.createMediaElementSource(this.audio);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.82;
        src.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);
        this.freqArr = new Uint8Array(this.analyser.frequencyBinCount);
        this.audio.__floorAnalyser = { ctx: this.audioCtx, source: src, analyser: this.analyser, freqArr: this.freqArr };
      } catch (e) { /* ignore */ }
    },
    _readAudio() {
      if (!this.analyser || !this.freqArr) return;
      if (this.audioCtx?.state === 'suspended') { try { this.audioCtx.resume(); } catch (e) {} }
      this.analyser.getByteFrequencyData(this.freqArr);
      let bass = 0, sum = 0, hi = 0;
      const N = this.freqArr.length;
      for (let i = 0; i < 8; i++) bass += this.freqArr[i] || 0;
      bass /= 8 * 255;
      for (let i = 0; i < N; i++) sum += this.freqArr[i] || 0;
      const energy = sum / (N * 255);
      for (let i = N - 16; i < N; i++) hi += this.freqArr[i] || 0;
      hi /= 16 * 255;
      this.bass   += (bass - this.bass)     * 0.40;
      this.energy += (energy - this.energy) * 0.30;
      // L/R fake stereo split from bass + energy + a sine offset (we don't have a real stereo split)
      const L = Math.min(1, this.energy * 1.2 + this.bass * 0.4);
      const R = Math.min(1, this.energy * 1.0 + this.bass * 0.6);
      this.peakL = Math.max(this.peakL * 0.94, L);
      this.peakR = Math.max(this.peakR * 0.94, R);
      this.fxLevelL += (L - this.fxLevelL) * 0.5;
      this.fxLevelR += (R - this.fxLevelR) * 0.5;
    },

    /* ---------- Spectrum + meter draw ---------- */
    _sizeSpectrum() {
      const c = this.root && this.root.querySelector('#daw-spectrum');
      if (!c) { this.specCanvas = null; return; }
      const r = c.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(60, r.width | 0);
      const h = Math.max(40, r.height | 0);
      c.width = w * dpr; c.height = h * dpr;
      c.style.width = w + 'px'; c.style.height = h + 'px';
      const ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.specCanvas = c; this.specCtx = ctx;
    },
    _drawSpectrum(t) {
      // T13 (= t6 reconstruction) — smooth orange-on-dark spectrum bars + center scope
      if (!this.specCanvas || !this.specCtx) {
        this._sizeSpectrum();
        if (!this.specCanvas) return;
      }
      const c = this.specCanvas, ctx = this.specCtx;
      const w = c.clientWidth, h = c.clientHeight;
      ctx.clearRect(0, 0, w, h);
      // Background grid
      ctx.fillStyle = 'rgba(255,255,255,0.022)';
      for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 1);
      // Spectrum bars
      const N = (this.freqArr && this.freqArr.length) || 0;
      const playing = !!(this.audio && !this.audio.paused);
      const bars = 64;
      const bw = (w / bars);
      for (let i = 0; i < bars; i++) {
        let v = 0;
        if (N) {
          const lo = Math.floor((i / bars) * (N * 0.85));
          const hi = Math.floor(((i + 1) / bars) * (N * 0.85));
          let max = 0;
          for (let j = lo; j < hi; j++) { const s = this.freqArr[j] || 0; if (s > max) max = s; }
          v = (max / 255) * (playing ? 1 : 0);
        }
        if (!playing) v = 0.06 + 0.04 * Math.sin(t * 1.7 + i * 0.31);
        const bh = Math.max(1, v * h * 0.95);
        const x = i * bw;
        const grad = ctx.createLinearGradient(0, h, 0, h - bh);
        grad.addColorStop(0,   'rgba(255, 122, 61, 0.15)');
        grad.addColorStop(0.4, 'rgba(255, 122, 61, 0.85)');
        grad.addColorStop(1,   'rgba(255, 230, 200, 1)');
        ctx.fillStyle = grad;
        ctx.fillRect(x + 0.5, h - bh, bw - 1, bh);
      }
      // Center-line scope (using bass for amplitude)
      ctx.strokeStyle = 'rgba(255, 122, 61, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const cy = h * 0.5;
      for (let x = 0; x < w; x++) {
        const phase = x / w * Math.PI * 14 + t * 4;
        const a = (this.bass * 0.6 + this.energy * 0.2) * Math.sin(phase) * (h * 0.20);
        const y = cy + a;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    },

    _updateMeters() {
      const fL = this.root.querySelector('#daw-meter-l');
      const fR = this.root.querySelector('#daw-meter-r');
      if (fL) fL.style.height = (this.fxLevelL * 100).toFixed(1) + '%';
      if (fR) fR.style.height = (this.fxLevelR * 100).toFixed(1) + '%';
    },

    _updateTransport(t) {
      const cur = (this.ctx.getCurrent && this.ctx.getCurrent()) ?? -1;
      const tracks = this.ctx.tracks || [];
      const track  = (cur >= 0 && tracks[cur]) ? tracks[cur] : null;

      const num   = this.root.querySelector('#daw-tx-num');
      const title = this.root.querySelector('#daw-tx-title');
      const meta  = this.root.querySelector('#daw-tx-meta');
      const fill  = this.root.querySelector('#daw-tx-fill');
      const head  = this.root.querySelector('#daw-tx-playhead');
      const time  = this.root.querySelector('#daw-tx-time');
      const playB = this.root.querySelector('#daw-play');
      const sc    = this.root.querySelector('#daw-tx-sc');
      const led   = this.root.querySelector('#daw-led');
      const stLed = this.root.querySelector('#daw-st-led');

      const stMini = this.root.querySelector('#daw-st-mini');
      let mini = '';

      if (track) {
        const tier = tierOf(track);
        if (num)   num.textContent   = `TRK.${String(cur + 1).padStart(3, '0')}  ·  ${tier.toUpperCase()}`;
        if (title) title.textContent = (track.title || '').toLowerCase();
        const tags = (track.tags || []).slice(0, 3).join(' · ');
        const yr = track.date ? new Date(track.date).getFullYear() : '—';
        if (meta) meta.textContent = `${yr}${tags ? '  ·  ' + tags : ''}`;
        if (sc)   sc.href = this._scUrlFor(track);

        const dur = isFinite(this.audio?.duration) ? this.audio.duration : 0;
        const ct  = this.audio?.currentTime || 0;
        const pct = dur > 0 ? ct / dur : 0;
        if (fill) fill.style.width = (pct * 100).toFixed(2) + '%';
        if (head) head.style.left  = (pct * 100).toFixed(2) + '%';
        if (time) time.textContent = `${fmtTime(ct)} / ${fmtTime(dur)}`;
        const paused = !!this.audio?.paused;
        if (playB) {
          const want = paused ? '▶' : '❚❚';
          if (playB.textContent !== want) playB.textContent = want;
          playB.classList.toggle('is-armed', !paused);
        }
        if (led)   led.classList.toggle('is-on', !paused);
        if (stLed) stLed.classList.toggle('is-on', !paused);
        mini = `${paused ? '· paused' : '▸ playing'}  ·  ${(track.title || '').toLowerCase()}`;
      } else {
        if (num)   num.textContent   = '— · —';
        if (title) title.textContent = '— no clip armed —';
        if (meta)  meta.textContent  = '';
        if (fill)  fill.style.width  = '0%';
        if (head)  head.style.left   = '0%';
        if (time)  time.textContent  = '0:00.0 / 0:00.0';
        if (sc)    sc.href = '#';
        if (led)   led.classList.remove('is-on');
        if (stLed) stLed.classList.remove('is-on');
        if (playB) { playB.textContent = '▶'; playB.classList.remove('is-armed'); }
        mini = '— ready —';
      }
      if (stMini) stMini.textContent = mini;
    },

    _updateMasterCard() {
      const cur = (this.ctx.getCurrent && this.ctx.getCurrent()) ?? -1;
      const tracks = this.ctx.tracks || [];
      const track  = (cur >= 0 && tracks[cur]) ? tracks[cur] : null;

      const masterCard = this.root.querySelector('.daw-master-card');
      const numEl   = this.root.querySelector('#daw-mc-num');
      const titleEl = this.root.querySelector('#daw-mc-title');
      const metaEl  = this.root.querySelector('#daw-mc-meta');
      const tierEl  = this.root.querySelector('#daw-mg-tier');
      const tagsEl  = this.root.querySelector('#daw-mg-tags');
      const dateEl  = this.root.querySelector('#daw-mg-date');
      const slotEl  = this.root.querySelector('#daw-mg-slot');
      const scEl    = this.root.querySelector('#daw-ma-sc');
      const notesV   = this.root.querySelector('#daw-ma-notes-v');
      const credRow  = this.root.querySelector('#daw-ma-credits');
      const credV    = this.root.querySelector('#daw-ma-credits-v');
      const fileV    = this.root.querySelector('#daw-ma-file-v');
      const permaEl  = this.root.querySelector('#daw-ma-perma');

      if (!track) {
        if (masterCard) {
          masterCard.style.removeProperty('--mc-h');
          masterCard.style.removeProperty('--mc-s');
          masterCard.style.removeProperty('--mc-l');
        }
        if (numEl)   numEl.textContent   = '— · — —';
        if (titleEl) titleEl.textContent = '— no clip armed —';
        if (metaEl)  metaEl.textContent  = '';
        if (tierEl)  tierEl.textContent  = '—';
        if (tagsEl)  tagsEl.textContent  = '—';
        if (dateEl)  dateEl.textContent  = '—';
        if (slotEl)  slotEl.textContent  = '—';
        if (scEl)    scEl.removeAttribute('href');
        if (notesV)  notesV.textContent  = '—';
        if (credRow) credRow.setAttribute('hidden', '');
        if (fileV)   fileV.textContent   = '—';
        if (permaEl) { permaEl.textContent = '—'; permaEl.dataset.url = ''; }
        return;
      }
      const tier = tierOf(track);
      if (masterCard) {
        const pal = paletteForCell(cur, tier);
        masterCard.style.setProperty('--mc-h', pal.h);
        masterCard.style.setProperty('--mc-s', pal.s + '%');
        masterCard.style.setProperty('--mc-l', pal.l + '%');
      }
      const yr = track.date ? new Date(track.date).getFullYear() : '—';
      const tags = (track.tags || []).join(' · ') || '—';
      const slug = slugifyLocal(track.title);
      if (numEl)   numEl.textContent   = `TRK.${String(cur + 1).padStart(3, '0')}  ·  ${tier.toUpperCase()}`;
      if (titleEl) titleEl.textContent = (track.title || '').toLowerCase();
      if (metaEl)  metaEl.textContent  = `${yr}  ·  ${tags}`;
      if (tierEl)  tierEl.textContent  = tier;
      if (tagsEl)  tagsEl.textContent  = tags;
      if (dateEl)  dateEl.textContent  = track.date || '—';
      if (slotEl)  slotEl.textContent  = `${cur + 1} / ${tracks.length}`;
      if (scEl)    scEl.href  = this._scUrlFor(track);

      // Inline details panel (collapsible — replaces the old /t/<slug> detail page nav)
      if (notesV)  notesV.textContent = track.description ? track.description : 'no notes on file.';
      if (credRow && credV) {
        if (track.credits) {
          credV.textContent = track.credits;
          credRow.removeAttribute('hidden');
        } else {
          credRow.setAttribute('hidden', '');
        }
      }
      if (fileV) fileV.textContent = track.file || '—';
      if (permaEl) {
        const url = `${location.origin}/t/${slug}`;
        permaEl.textContent = url;
        permaEl.dataset.url = url;
      }
    },

    _scUrlFor(track) {
      const explicit = track && track.links && (track.links.soundcloud || track.links.sc);
      if (explicit) return explicit;
      if (this.ctx?.scUrl) return this.ctx.scUrl(track?.title || '');
      const slug = slugifyLocal(track?.title || '');
      return `https://soundcloud.com/kanisongs/${slug}`;
    },

    /* ---------- Per-clip playing state ---------- */
    onTrackChange() {
      const cur = (this.ctx.getCurrent && this.ctx.getCurrent()) ?? -1;
      this.cells.forEach(c => {
        c.el.classList.toggle('is-armed', c.idx === cur);
      });
      // Arrangement bars too
      if (this.arrCells) {
        this.arrCells.forEach(a => {
          a.el.classList.toggle('is-armed', a.idx === cur);
        });
      }
      // Auto-scroll to playing in session view
      if (this.view === 'session' && cur >= 0) {
        const c = this.cells.find(x => x.idx === cur);
        if (c && !c.el.classList.contains('is-hidden')) {
          c.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
      this._updateMasterCard();
      this._ensureAnalyser();
      if (this.audioCtx?.state === 'suspended') this.audioCtx.resume().catch(() => {});
    },

    /* ---------- Loop ---------- */
    animate(ts) {
      if (this.destroyed) return;
      this.raf = requestAnimationFrame(this.animate);
      const t = (ts || performance.now()) / 1000;

      this._readAudio();
      this._drawSpectrum(t);
      this._updateMeters();
      this._updateTransport(t);

      // Per-clip playing animation: progress underline + LED breathing on armed clips
      const cur = (this.ctx.getCurrent && this.ctx.getCurrent()) ?? -1;
      const dur = isFinite(this.audio?.duration) ? this.audio.duration : 0;
      const ct  = this.audio?.currentTime || 0;
      const pct = dur > 0 ? ct / dur : 0;
      this.cells.forEach(c => {
        if (c.idx === cur && this.audio && !this.audio.paused) {
          c.barEl.style.width = (pct * 100).toFixed(2) + '%';
          c.barEl.style.opacity = '1';
          c.btnEl.textContent = '■';
          c.btnEl.classList.add('is-armed');
        } else if (c.idx === cur) {
          c.barEl.style.width = (pct * 100).toFixed(2) + '%';
          c.barEl.style.opacity = '0.55';
          c.btnEl.textContent = '▶';
          c.btnEl.classList.remove('is-armed');
        } else {
          c.barEl.style.width = '0%';
          c.barEl.style.opacity = '0';
          if (c.btnEl.textContent !== '▶') c.btnEl.textContent = '▶';
          c.btnEl.classList.remove('is-armed');
        }
      });

      // Arrangement playhead + per-block progress bars
      const head = this.root.querySelector('#daw-arr-head');
      if (this.arrCells) {
        this.arrCells.forEach(a => {
          if (!a.barEl) return;
          if (a.idx === cur) {
            a.barEl.style.width = (pct * 100).toFixed(2) + '%';
            a.barEl.style.opacity = '1';
          } else {
            a.barEl.style.width = '0%';
            a.barEl.style.opacity = '0';
          }
        });
        if (head) {
          const arr = this.arrCells.find(a => a.idx === cur);
          if (arr) {
            const r = arr.el.getBoundingClientRect();
            const grid = this.root.querySelector('#daw-grid');
            const gr = grid.getBoundingClientRect();
            const x = (r.left - gr.left) + grid.scrollLeft + (r.width * pct);
            head.style.left = x + 'px';
            head.style.opacity = '1';
          } else {
            head.style.opacity = '0';
          }
        }
      }
    },

    /* ---------- Cleanup ---------- */
    destroy() {
      this.destroyed = true;
      cancelAnimationFrame(this.raf);
      if (this._onKey)    window.removeEventListener('keydown', this._onKey);
      if (this._onResize) window.removeEventListener('resize', this._onResize);
      if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
      this.root = null;
      this.cells = [];
      this.arrCells = null;
      this.specCanvas = null; this.specCtx = null;
      this.ctx = null;
    },
  };

  window.TracksDaw = TracksDaw;
})();
