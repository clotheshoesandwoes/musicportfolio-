/* =========================================================
   APP.JS — Config loader, shared state, view router
   ========================================================= */

// Tracks array — populated from config.json, fallback to empty
let tracks = [];
let siteConfig = {};

/* =========================================================
   SHARED STATE
   ========================================================= */
const state = {
  currentTrack: -1,
  isPlaying: false,
  shuffleMode: false,
  repeatMode: 'none',
  currentView: 'terrain',
  searchQuery: '',
  volume: 0.8,
};

/* =========================================================
   GRADIENT PALETTE
   ========================================================= */
const gradients = [
  ['#8b5cf6','#6d28d9'], ['#ec4899','#be185d'], ['#3b82f6','#1d4ed8'],
  ['#f97316','#c2410c'], ['#10b981','#047857'], ['#06b6d4','#0e7490'],
  ['#f43f5e','#9f1239'], ['#a855f7','#7e22ce'], ['#eab308','#a16207'],
  ['#14b8a6','#0f766e'], ['#6366f1','#4338ca'], ['#e879f9','#a21caf'],
];

function getGradient(i) {
  const g = gradients[i % gradients.length];
  return `linear-gradient(135deg, ${g[0]}, ${g[1]})`;
}

function getGradientColors(i) {
  return gradients[i % gradients.length];
}

/* =========================================================
   VIEW ROUTER
   ========================================================= */
const views = {};
let activeView = null;

function registerView(name, viewObj) {
  views[name] = viewObj;
}

function switchView(name) {
  // Close detail panel if open
  closeTrackDetail();

  if (activeView && views[activeView] && views[activeView].destroy) {
    views[activeView].destroy();
  }
  const container = document.getElementById('viewContainer');
  container.innerHTML = '';
  state.currentView = name;
  activeView = name;

  if (views[name] && views[name].init) {
    views[name].init(container);
  }

  const subs = {
    dimensions: `Dimensions / ${tracks.length} worlds`,
    livingwall: `Living Wall / ${tracks.length} tracks`,
    organism: `The Organism / ${tracks.length} cells`,
    freqmap: `Frequency Map / ${tracks.length} stars`,
    tapespine: `Tape Spine / ${tracks.length} dimensions`,
    wall: `// the wall · ${tracks.length} stickers`,
    terrain: `Sound terrain / ${tracks.length} tracks`,
    deepsea: `Deep dive / ${tracks.length} tracks`,
    neural: `Neural map / ${tracks.length} tracks`,
    villa: `Villa / night drive`,
  };
  document.getElementById('brandSub').textContent = subs[name] || '';

  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === name);
  });
}

/* =========================================================
   SEARCH
   ========================================================= */
function getFilteredTracks() {
  const q = state.searchQuery.toLowerCase().trim();
  if (!q) return tracks.map((t, i) => ({ ...t, originalIndex: i }));
  return tracks
    .map((t, i) => ({ ...t, originalIndex: i }))
    .filter(t => t.title.toLowerCase().includes(q));
}

/* =========================================================
   TRACK DETAIL PANEL
   ========================================================= */
function showTrackDetail(index) {
  const t = tracks[index];
  if (!t) return;

  let panel = document.getElementById('trackDetailPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'trackDetailPanel';
    panel.className = 'track-detail-panel';
    document.body.appendChild(panel);
  }

  const tags = (t.tags || []).map(tag =>
    `<span class="detail-tag">${tag}</span>`
  ).join('');

  const badges = [];
  if (t.isNew) badges.push('<span class="detail-badge new">NEW</span>');
  if (t.isFeatured) badges.push('<span class="detail-badge featured">FEATURED</span>');

  const credits = t.credits ? `<div class="detail-credits">${escapeHtml(t.credits)}</div>` : '';
  const desc = t.description ? `<div class="detail-desc">${escapeHtml(t.description)}</div>` : '';

  let linksHtml = '';
  if (t.links && Object.keys(t.links).length > 0) {
    linksHtml = '<div class="detail-links">' +
      Object.entries(t.links).map(([label, url]) =>
        url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="detail-link">${escapeHtml(label)}</a>` : ''
      ).join('') + '</div>';
  }

  panel.innerHTML = `
    <button class="detail-close" onclick="closeTrackDetail()">&times;</button>
    <div class="detail-art" style="background:${getGradient(index)}"></div>
    <div class="detail-content">
      <div class="detail-badges">${badges.join('')}</div>
      <div class="detail-title">${escapeHtml(t.title)}</div>
      <div class="detail-artist">${escapeHtml(siteConfig.artist || 'Kani')}</div>
      ${credits}
      ${desc}
      <div class="detail-tags">${tags}</div>
      ${linksHtml}
      <div class="detail-actions">
        <button class="info-btn" onclick="playTrack(${index}); closeTrackDetail();">Play</button>
        <button class="info-btn secondary" onclick="closeTrackDetail()">Close</button>
      </div>
    </div>
  `;

  panel.classList.add('visible');
}

function closeTrackDetail() {
  const panel = document.getElementById('trackDetailPanel');
  if (panel) panel.classList.remove('visible');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* =========================================================
   APPLY THEME FROM CONFIG
   ========================================================= */
function applyTheme(config) {
  if (!config.theme) return;
  const root = document.documentElement;
  if (config.theme.accent) root.style.setProperty('--purple', config.theme.accent);
  if (config.theme.accent2) root.style.setProperty('--pink', config.theme.accent2);
  if (config.theme.background) {
    root.style.setProperty('--bg', config.theme.background);
    document.querySelector('meta[name="theme-color"]').setAttribute('content', config.theme.background);
  }
}

/* =========================================================
   APPLY SOCIALS FROM CONFIG
   ========================================================= */
function applySocials(config) {
  if (!config.socials) return;

  // Update Instagram link
  const igLink = document.querySelector('.social-btn[title="Instagram"]');
  if (igLink && config.socials.instagram) {
    igLink.href = config.socials.instagram;
  }

  // Add SoundCloud link if present
  if (config.socials.soundcloud && config.socials.soundcloud !== 'https://soundcloud.com/YOUR_SOUNDCLOUD') {
    const topRight = document.querySelector('.top-right');
    if (topRight && !document.querySelector('.social-btn[title="SoundCloud"]')) {
      const sc = document.createElement('a');
      sc.href = config.socials.soundcloud;
      sc.target = '_blank';
      sc.rel = 'noopener';
      sc.className = 'social-btn';
      sc.title = 'SoundCloud';
      sc.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.56 8.87V17h8.76c1.85 0 2.68-1.4 2.68-2.82 0-1.42-.83-2.82-2.68-2.82-.37 0-.73.07-1.06.2-.13-2.34-2.04-4.19-4.42-4.19-1.2 0-2.28.46-3.08 1.2-.1.09-.16.2-.2.3zM10.5 9.25V17h-.75V9.6c.24-.14.49-.26.75-.35zM8.75 10.5V17H8v-6.12c.24-.15.49-.28.75-.38zM7 11.69V17h-.75v-4.76c.23-.2.48-.38.75-.55zM5.25 13.14V17h-.75v-3.28c.22-.22.47-.4.75-.58zM3.5 14.81V17h-.75v-1.63c.18-.23.44-.4.75-.56zM1.75 16.07V17H1v-.58c.2-.15.46-.26.75-.35z"/></svg>`;
      topRight.insertBefore(sc, topRight.querySelector('.social-btn'));
    }
  }

  // Update artist name
  if (config.artist) {
    const brand = document.querySelector('.brand');
    if (brand) brand.textContent = config.artist;
  }
}

/* =========================================================
   LOAD CONFIG & INIT
   ========================================================= */
async function loadConfig() {
  try {
    const res = await fetch('config.json');
    if (!res.ok) throw new Error('No config');
    const config = await res.json();
    siteConfig = config;

    // Load tracks from config
    if (config.tracks && config.tracks.length > 0) {
      tracks = config.tracks;
    }

    applyTheme(config);
    applySocials(config);
  } catch (e) {
    // Config not found — tracks stay as empty array, site still works
    console.warn('config.json not loaded, using defaults');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Theme toggle (light/dark)
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    // restore saved preference
    if (localStorage.getItem('theme') === 'light') {
      document.body.classList.add('light');
      themeToggle.textContent = '☾';
    }
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light');
      const isLight = document.body.classList.contains('light');
      themeToggle.textContent = isLight ? '☾' : '☀';
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
  }

  // View tab clicks
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });

  // Search
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (views[activeView] && views[activeView].onSearch) {
        views[activeView].onSearch(state.searchQuery);
      }
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (typeof togglePlay === 'function') togglePlay();
        break;
      case 'ArrowRight':
        if (typeof playerAudio !== 'undefined' && playerAudio.duration)
          playerAudio.currentTime = Math.min(playerAudio.duration, playerAudio.currentTime + 5);
        break;
      case 'ArrowLeft':
        if (typeof playerAudio !== 'undefined')
          playerAudio.currentTime = Math.max(0, playerAudio.currentTime - 5);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (typeof playerAudio !== 'undefined') {
          playerAudio.volume = Math.min(1, playerAudio.volume + 0.1);
          document.getElementById('volumeSlider').value = playerAudio.volume;
          state.volume = playerAudio.volume;
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (typeof playerAudio !== 'undefined') {
          playerAudio.volume = Math.max(0, playerAudio.volume - 0.1);
          document.getElementById('volumeSlider').value = playerAudio.volume;
          state.volume = playerAudio.volume;
        }
        break;
      case 'KeyN':
        if (typeof playNext === 'function') playNext();
        break;
      case 'KeyP':
        if (typeof playPrev === 'function') playPrev();
        break;
      case 'Escape':
        closeTrackDetail();
        break;
      case 'Digit1': switchView('livingwall'); break;
      case 'Digit2': switchView('organism'); break;
      case 'Digit3': switchView('freqmap'); break;
      case 'Digit4': switchView('tapespine'); break;
      case 'Digit5': switchView('wall'); break;
      case 'Digit6': switchView('terrain'); break;
      case 'Digit7': switchView('deepsea'); break;
      case 'Digit8': switchView('neural'); break;
      case 'Digit9': switchView('villa'); break;
    }
  });

  // Close detail panel when clicking outside
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('trackDetailPanel');
    if (panel && panel.classList.contains('visible') && !panel.contains(e.target)) {
      closeTrackDetail();
    }
  });
});

// Boot: load config, then start default view
window.addEventListener('load', async () => {
  await loadConfig();
  document.getElementById('trackCount').textContent = tracks.length;
  // b054 — default landing view is now 'wall' (sticker view, hyperpop vibe).
  // b051 — ?paint=1 URL flag boots into the painterly POC
  // b053 — ?style=v2 URL flag boots into the Marathon cryo bay POC
  // b054 — ?legacy=villa boots straight into the old default (Villa)
  window.tracks = tracks;
  const params = new URLSearchParams(window.location.search);
  let bootView = 'dimensions';
  if (params.get('paint') === '1') bootView = 'paint';
  else if (params.get('style') === 'v2') bootView = 'marathon';
  else if (params.get('legacy') === 'villa') bootView = 'villa';
  switchView(bootView);
});
