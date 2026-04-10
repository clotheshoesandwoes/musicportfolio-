/* =========================================================
   WALL.JS — "the WALL" creature view (b055)
   ---------------------------------------------------------
   Default landing view. Hot magenta + scrolling checker
   background (the user loved this from b054), with up to
   117 small animated clickable creatures floating around.
   Each creature is a track — click opens the official
   track-detail panel.

   Creature types (one per track, picked deterministically
   from a hash of the title): butterfly, drone, jellyfish,
   fish, comet, beetle, eye, crystal. Each has its own
   tiny canvas draw routine + per-frame animation.

   Decorative ambient glyphs (stars, sparkles, etc) drift
   in the background underneath the creatures.

   2D canvas, no Three.js. Mirrors the neural.js IIFE
   pattern (init/destroy/registerView).
   ========================================================= */

(function () {
  let canvas, ctx, container;
  let W, H, rafId;
  let mx = -9999, my = -9999;
  let creatures = [];
  let glyphs = [];
  let nebulas = [];
  let bursts = [];          // b058 — click burst rings
  let constellations = [];  // b059 — precomputed creature pair indices for star-map lines
  let hovered = -1;
  let t0 = 0;
  // b061 — pagination so the user can see ALL 177 tracks even
  // when only ~30 creatures fit on a mobile screen. pageIndex
  // bumps per shuffle button click; buildCreatures offsets the
  // trackIndex by `pageIndex * pageSize` so each page surfaces
  // a different slice of the catalog.
  let pageIndex = 0;
  const isMobile = () => window.innerWidth < 768;

  // Tight hyperpop / Marathon-ish accent palette
  const PALETTE = [
    ['#9cff3a', '#1a8a00'],   // lime
    ['#4ad8ff', '#0a4a8c'],   // cyan
    ['#ffe833', '#a86b00'],   // yellow
    ['#ffffff', '#888888'],   // white
    ['#a855f7', '#3a0a6c'],   // electric purple
    ['#ff7a1a', '#7a2a00'],   // orange
    ['#0aff9c', '#00564a'],   // mint
    ['#ff5cf2', '#5a0838'],   // pink-magenta
  ];

  const CREATURE_TYPES = [
    // b055 originals
    'butterfly', 'drone', 'jellyfish', 'fish',
    'comet', 'beetle', 'eye', 'crystal',
    // b056 new
    'ufo', 'planet', 'rocket', 'ghost',
    'bird', 'bee', 'flower', 'mushroom',
    'octopus', 'bat', 'note', 'cassette',
  ];

  // b060 — per-track icon overrides. Special creature drawers
  // for specific song titles. Match is case-insensitive substring
  // against track.title. The first creature placed for each
  // matching track gets the override (depth 2 + bumped size);
  // any additional creatures sharing that track stay random.
  // Add more entries here to give more songs custom art — each
  // override type needs a draw* function and a dispatch case.
  // ORDER MATTERS — first match wins. Put more-specific
  // matches before less-specific ones (e.g. "space star"
  // before any future "space" entry).
  const ICON_OVERRIDES = [
    { match: 'odst',             type: 'helmet'     },  // ODST → halo ODST helmet
    { match: 'rolla',            type: 'supercar'   },  // Rolla → yellow Lambo
    { match: 'silk pillowcase',  type: 'pillowcase' },  // Silk Pillowcase → silk pillow
    // b061 — additional hero icons for signature tracks
    { match: 'space star',       type: 'spaceship'  },  // Space Star Galactica → spaceship
    { match: 'hotel california', type: 'hotelsign'  },  // Hotel California → neon hotel sign
    { match: 'coffee',           type: 'coffeecup'  },  // Coffee (Back in the Day) → cup
    { match: 'robot',            type: 'robotbody'  },  // Robot Song → robot
    { match: "stayin",           type: 'discoball'  },  // Stayin' Alive → disco ball
    { match: 'mario',            type: 'mariostar'  },  // Mario Island → Mario star
    { match: 'chains',           type: 'chainlink'  },  // Chains (Grunge) → chain links
    { match: 'nirvana',          type: 'wonkysmile' },  // Nirvana / Nirvana (Alt) → smiley
    { match: 'arkham',           type: 'villainmask'},  // Arkham Villain → villain mask
    // b063 — 12 more hero icons
    { match: 'thunderbird',      type: 'thunderbird'},  // Thunderbird → lightning bird
    { match: 'best day ever',    type: 'sun'         }, // Best Day Ever (Clarity) → sun
    { match: 'warzone',          type: 'grenade'     }, // Warzone → grenade
    { match: 'streets',          type: 'boombox'     }, // Streets → boombox
    { match: 'lemonade',         type: 'lemon'       }, // Lemonade → lemon
    { match: 'beachouse',        type: 'beachhut'    }, // Beachouse → beach hut
    { match: 'sickboi',          type: 'skull'       }, // Sickboi → skull
    { match: '10 miles',         type: 'roadsign'    }, // 10 Miles → road sign
    { match: 'money ain',        type: 'cashstack'   }, // Money Ain't a Thing → cash stack
    { match: 'birthday',         type: 'cake'        }, // Birthday Freestyle → cake
    { match: 'wallet',           type: 'wallet'      }, // Wallet → wallet
    { match: 'lotus',            type: 'lotusflower' }, // Lotus (Try to Breathe) → lotus
    // b064 — 15 more
    { match: 'take me home',     type: 'house'       },
    { match: 'real love',        type: 'bigheart'    },
    { match: 'spotlight',        type: 'spotlight'   },
    { match: 'final chapter',    type: 'book'        },
    { match: 'wired',            type: 'lightbolt'   },
    { match: 'stop light',       type: 'trafficlight'},
    { match: 'wind blows',       type: 'windmill'    },
    { match: 'i will survive',   type: 'fist'        },
    { match: 'shroomy',          type: 'shroom'      },
    { match: 'runaway',          type: 'sneaker'     },
    { match: 'shoebox',          type: 'shoebox'     },
    { match: 'two of us',        type: 'twohearts'   },
    { match: 'car mixtape',      type: 'vinyldisc'   },
    { match: 'emo rock',         type: 'guitarpick'  },
    { match: 'formidable',       type: 'crown'       },
    // b066 — 10 more
    { match: 'dutch',            type: 'bluntwrap'   },
    { match: 'amy winespliff',   type: 'beehive'     },
    { match: 'silo galaxy',     type: 'galaxy'      },
    { match: 'akira world',      type: 'akira'       },
    { match: 'chicago seven',    type: 'riotshield'  },
    { match: 'chilly nites',     type: 'snowflake'   },
    { match: 'may flowers',      type: 'raincloud'   },
    { match: 'soul',             type: 'soulfire'    },
    { match: 'backyardian',      type: 'treehouse'   },
    { match: 'follow you',       type: 'compass'     },
    // b067 — 10 more
    { match: 'fucking up his liver', type: 'bottle'    },
    { match: "c'est la vie",     type: 'beret'       },
    { match: 'turned into taylor', type: 'sparklymic' },
    { match: 'neopolitan',       type: 'icecream'    },
    { match: 'caught in thoughts', type: 'brain'     },
    { match: 'down down down',   type: 'anchor'      },
    { match: 'no service',       type: 'nophone'     },
    { match: 'memoir',           type: 'quill'       },
    { match: 'clarity',          type: 'diamond'     },
    { match: 'fall away',        type: 'falleaf'     },
    // b068 — 15 more
    { match: 'passion pit',      type: 'firepit'     },
    { match: 'rock (full',       type: 'electricguitar' },
    { match: 'gunning',          type: 'crosshair'   },
    { match: 'emo',              type: 'brokencd'    },
    { match: 'days get longer',  type: 'hourglass'   },
    { match: 'ohohohohoho',     type: 'laughskull'  },
    { match: 'jolly mood',       type: 'sourcandy'   },
    { match: 'louie 003',        type: 'duffel'      },
    { match: "hol' up",          type: 'stophand'    },
    { match: 'moods',            type: 'masks'       },
    { match: 'underrated',       type: 'trophy'      },
    { match: 'nice lil indie',   type: 'crescent'    },
    { match: '4-5 years',        type: 'calendar'    },
    { match: 'on tour soon',     type: 'tourbus'     },
    { match: 'cute (rolo',       type: 'candybar'    },
  ];

  function getOverrideType(title) {
    if (!title) return null;
    const lower = title.toLowerCase();
    for (const o of ICON_OVERRIDES) {
      if (lower.includes(o.match)) return o.type;
    }
    return null;
  }

  // b056 — minimum on-screen creatures even if tracks.length is small.
  // Each creature still maps to a real track via i % tracks.length.
  // b058 — mobile cap dropped from 100 to 30 (117 was unreadable on phones).
  const MIN_CREATURES_DESKTOP = 100;
  const MIN_CREATURES_MOBILE = 30;

  // b056 — feedback flash state for queued/playing toast in info panel
  let toastUntil = 0;
  let toastText = '';

  // -------------------------------------------------------
  function init(cont) {
    container = cont;

    canvas = document.createElement('canvas');
    canvas.className = 'view-canvas';
    canvas.style.cursor = 'default';
    container.appendChild(canvas);
    ctx = canvas.getContext('2d');

    // b058 — minimal info panel: single line "click any creature →"
    // until something is hovered/playing. No more THE WALL header.
    const info = document.createElement('div');
    info.className = 'info-panel';
    info.style.cssText = 'pointer-events:none;';
    info.innerHTML = `
      <div class="info-label" id="wallLabel" style="font-size:11px; letter-spacing:0.16em; opacity:0.7;">click any creature →</div>
      <div class="info-title" id="wallTitle" style="font-size:14px; margin-top:2px; display:none;"></div>
    `;
    container.appendChild(info);

    // b061 — page shuffle button. Bottom-right floating button
    // that bumps pageIndex and rebuilds creatures so the user
    // can cycle through ALL tracks on mobile (30 at a time).
    // Renders on desktop too — handy for cycling through 117
    // creatures when you have 177 tracks.
    const shuffleBtn = document.createElement('button');
    shuffleBtn.id = 'wallShuffleBtn';
    shuffleBtn.type = 'button';
    shuffleBtn.style.cssText = `
      position:absolute;
      right:16px;
      bottom:96px;
      z-index:50;
      background:rgba(14,14,14,0.75);
      backdrop-filter:blur(8px);
      color:#9cff3a;
      border:1.5px solid #9cff3a;
      border-radius:999px;
      padding:10px 16px;
      font-family:'JetBrains Mono', monospace;
      font-size:12px;
      font-weight:700;
      letter-spacing:0.10em;
      cursor:pointer;
      box-shadow:0 0 20px rgba(156,255,58,0.25);
      pointer-events:auto;
      display:flex;
      align-items:center;
      gap:8px;
    `;
    shuffleBtn.innerHTML = `<span style="font-size:14px;">↻</span> <span id="wallPageLabel">SHUFFLE</span>`;
    shuffleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pageIndex++;
      buildCreatures();
      updatePageLabel();
    });
    container.appendChild(shuffleBtn);

    function updatePageLabel() {
      const lbl = document.getElementById('wallPageLabel');
      if (!lbl) return;
      // b065 — just show the shuffle count so the user knows
      // it's doing something. No "page X/Y" since it's a full
      // random permutation now, not linear pages.
      lbl.textContent = pageIndex === 0 ? 'SHUFFLE' : `#${pageIndex + 1}`;
    }
    // Stash for the resize handler so we can refresh after rebuild
    container._updatePageLabel = updatePageLabel;

    container.addEventListener('mousemove', onMouse);
    container.addEventListener('mouseleave', onLeave);
    container.addEventListener('touchmove', onTouch, { passive: true });
    container.addEventListener('touchstart', onTouch, { passive: true });
    container.addEventListener('click', onClick);

    resize();
    updatePageLabel();
    window.addEventListener('resize', resize);
    t0 = performance.now();
    draw();
  }

  function destroy() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    window.removeEventListener('resize', resize);
    if (container) {
      container.removeEventListener('mousemove', onMouse);
      container.removeEventListener('mouseleave', onLeave);
      container.removeEventListener('touchmove', onTouch);
      container.removeEventListener('touchstart', onTouch);
      container.removeEventListener('click', onClick);
    }
    canvas = ctx = container = null;
    creatures = [];
    glyphs = [];
  }

  // -------------------------------------------------------
  function onMouse(e) {
    const r = container.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
  }
  function onLeave() { mx = my = -9999; }
  function onTouch(e) {
    const r = container.getBoundingClientRect();
    const t = e.touches[0];
    if (!t) return;
    mx = t.clientX - r.left;
    my = t.clientY - r.top;
  }
  function onClick(e) {
    // b057 — inline hit test at click time. The previous version
    // read `hovered` from the draw loop, which on mobile is racy:
    // a tap fires `click` BEFORE the next requestAnimationFrame runs
    // hit test, so hovered was still -1 → tap did nothing. We now
    // compute the position from the event itself and walk creatures
    // here, with a fatter hit radius for fingers.
    if (!container || creatures.length === 0) return;
    const r = container.getBoundingClientRect();
    let cx, cy;
    if (e && e.clientX !== undefined) {
      cx = e.clientX - r.left;
      cy = e.clientY - r.top;
    } else if (e && e.changedTouches && e.changedTouches[0]) {
      cx = e.changedTouches[0].clientX - r.left;
      cy = e.changedTouches[0].clientY - r.top;
    } else {
      cx = mx; cy = my;
    }
    if (cx < 0 || cy < 0) return;

    // Find the closest creature within a generous touch radius
    // (1.7× size on desktop, 2.4× on mobile so fat fingers can land).
    const radiusMult = isMobile() ? 2.4 : 1.7;
    let best = -1;
    let bestD2 = Infinity;
    for (let i = 0; i < creatures.length; i++) {
      const c = creatures[i];
      const dx = cx - c.x;
      const dy = cy - c.y;
      const d2 = dx * dx + dy * dy;
      const rr = c.size * c.scale * radiusMult;
      if (d2 <= rr * rr && d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
    if (best < 0) return;

    // b057 — user said: forget queue, new icon just plays new song.
    // Always replace the currently-playing track, no queueing.
    const c = creatures[best];
    if (typeof playTrack === 'function') {
      playTrack(c.trackIndex);
      toastText = '▶ ' + (c.title || '').toLowerCase();
      toastUntil = performance.now() + 1800;
    }
    // b058 — click burst: expanding fading ring at the click point
    bursts.push({
      x: c.x, y: c.y,
      birth: performance.now(),
      color: PALETTE[c.colorIdx][0],
    });
  }

  // -------------------------------------------------------
  function resize() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildCreatures();
    buildGlyphs();
    buildNebulas();
    if (container && container._updatePageLabel) container._updatePageLabel();
  }

  // -------------------------------------------------------
  // NEBULAS — b059 fix for the b058 center-blowout. The 7
  // blobs were converging on the middle and washing the
  // wall to white. Three-part fix:
  //   1. Count down 7 → 5
  //   2. Alphas down ~25%
  //   3. baseX/baseY are forced to a 5-quadrant spread
  //      so they CAN'T all stack in the center, and the
  //      drift amplitude is clamped < quadrant size.
  // The additive layer in drawBackground also caps with
  // a frame-level globalAlpha (0.65 + treble pulse).
  // -------------------------------------------------------
  function buildNebulas() {
    nebulas = [];
    const colors = [
      'rgba(74, 216, 255, 0.40)',   // cyan
      'rgba(255, 92, 242, 0.42)',   // hot pink
      'rgba(156, 255, 58, 0.32)',   // lime
      'rgba(168, 85, 247, 0.45)',   // purple
      'rgba(255, 122, 26, 0.30)',   // orange
    ];
    // 5 anchor positions spread across the canvas — one per
    // quadrant + one center. Guarantees no convergence.
    const anchors = [
      [0.20, 0.25],
      [0.80, 0.30],
      [0.50, 0.55],
      [0.25, 0.80],
      [0.78, 0.78],
    ];
    for (let i = 0; i < colors.length; i++) {
      const h = hash('neb' + i, 33);
      const [ax, ay] = anchors[i];
      nebulas.push({
        baseX: ax * W,
        baseY: ay * H,
        radius: 460 + (h % 340),     // slightly smaller
        color: colors[i],
        speedX: 0.05 + (h % 100) / 1600,
        speedY: 0.04 + ((h >> 4) % 100) / 1700,
        // Drift amplitudes capped at ~120/100 — can't reach
        // the next anchor's territory, so they stay in their lane
        ampX: 80 + (h % 60),
        ampY: 60 + ((h >> 6) % 50),
        phase: ((h >> 12) % 1000) / 1000 * Math.PI * 2,
        radiusPulseSpeed: 0.20 + ((h >> 9) % 100) / 600,
        radiusPulseAmp: 0.15 + ((h >> 11) % 100) / 500,
      });
    }
  }

  // Deterministic hash so layout is stable across resize
  function hash(str, seed) {
    let h = seed || 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i);
    return Math.abs(h);
  }

  // -------------------------------------------------------
  // CREATURES — at least MIN_CREATURES on screen so the
  // wall feels populated even when there are only a handful
  // of tracks. Each creature maps to a real track via
  // i % tracks.length, so multiple creatures can share a
  // track. If tracks.length > MIN_CREATURES, we render one
  // per track. Positions anchored — each creature bobs
  // around its anchor via sin/cos so they don't drift off.
  // -------------------------------------------------------
  function buildCreatures() {
    creatures = [];
    const tracks = window.tracks || [];
    if (tracks.length === 0) return;
    const minCount = isMobile() ? MIN_CREATURES_MOBILE : MIN_CREATURES_DESKTOP;
    const N = Math.min(Math.max(tracks.length, minCount), isMobile() ? 32 : 117);
    // b065 — shuffle-based pagination. The old linear offset
    // (pageOffset = pageIndex * N) failed because with 117
    // creatures and 177 tracks, page 1 wrapped 57 duplicates
    // back from the start — the user saw "mostly the same songs".
    //
    // New approach: build a shuffled permutation of ALL track
    // indices, seeded by pageIndex so each press gives a
    // deterministically different arrangement. Then creature i
    // picks trackIndices[i % trackIndices.length]. Every press
    // genuinely reshuffles which songs map to which creatures.
    const trackIndices = [];
    for (let k = 0; k < tracks.length; k++) trackIndices.push(k);
    // Fisher-Yates shuffle seeded by pageIndex (deterministic)
    let seed = pageIndex * 2654435761 + 1;
    function nextSeed() { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed; }
    for (let k = trackIndices.length - 1; k > 0; k--) {
      const j = nextSeed() % (k + 1);
      const tmp = trackIndices[k];
      trackIndices[k] = trackIndices[j];
      trackIndices[j] = tmp;
    }

    const margin = 60;
    // b058 — dart-throwing poisson placement: each creature
    // tries up to 30 hash-derived candidate positions and
    // accepts the first one that's at least minDist away
    // from anything already placed. Breaks the grid feel.
    const minDist = isMobile() ? 56 : 72;
    const placed = []; // {x,y}
    // b060 — track which trackIndices have already received
    // their override "hero" creature. Only the FIRST creature
    // for each matched track gets the override + front depth +
    // bumped size, so the special icons appear exactly once.
    const overrideUsed = new Set();
    function tooClose(x, y) {
      for (const p of placed) {
        const dx = p.x - x, dy = p.y - y;
        if (dx * dx + dy * dy < minDist * minDist) return true;
      }
      return false;
    }

    for (let i = 0; i < N; i++) {
      // b065 — shuffle-based: creature i grabs from the shuffled
      // permutation. With 117 creatures and 177 tracks, the first
      // 117 entries of the shuffled array are used. Each pageIndex
      // bump gives a completely different permutation.
      const trackIndex = trackIndices[i % trackIndices.length];
      const title = tracks[trackIndex].title || ('untitled-' + trackIndex);
      // Per-CREATURE seed (not per-track) so multiple creatures sharing
      // a track still get different types, positions, and motion.
      const h1 = hash(title + '#' + i, 1);
      const h2 = hash(title + '#' + i, 7);
      const h3 = hash(title + '#' + i, 13);
      // b057 — type distribution: stride by i (coprime with 20)
      let type = CREATURE_TYPES[(i * 7 + h1) % CREATURE_TYPES.length];
      // b060 — icon override: if this track has a custom icon
      // and we haven't placed it yet, use the override.
      const overrideType = getOverrideType(title);
      let isOverride = false;
      if (overrideType && !overrideUsed.has(trackIndex)) {
        type = overrideType;
        overrideUsed.add(trackIndex);
        isOverride = true;
      }

      // b058 — dart-throw placement.
      let baseX = margin + (W - margin * 2) * 0.5;
      let baseY = margin + (H - margin * 2) * 0.5;
      for (let attempt = 0; attempt < 30; attempt++) {
        const ah = hash(title + '#' + i + '@' + attempt, 23);
        const cx = margin + ((ah % 10000) / 10000) * (W - margin * 2);
        const cy = margin + (((ah >> 10) % 10000) / 10000) * (H - margin * 2);
        if (!tooClose(cx, cy)) { baseX = cx; baseY = cy; break; }
        if (attempt === 29) { baseX = cx; baseY = cy; } // accept last fallback
      }
      placed.push({ x: baseX, y: baseY });

      // b057 — wider size range so creatures don't all look "same".
      // ~70% small (14-26), ~30% larger hero (28-44).
      const sizeRoll = (h2 % 100);
      let size = sizeRoll < 70
        ? 14 + (h1 % 13)
        : 28 + (h1 % 17);

      // b059 — parallax depth: 25% back, 60% mid, 15% front.
      // Back is smaller + dimmer + slower; front is larger +
      // brighter + faster. Real visual hierarchy.
      // b060 — override icons forced to depth 2 (front) and
      // bumped size so the special art reads as a hero element.
      const depthRoll = (h3 % 100);
      const depth = isOverride ? 2 : (depthRoll < 25 ? 0 : depthRoll < 85 ? 1 : 2);
      const depthScale     = depth === 0 ? 0.55 : depth === 1 ? 1.00 : 1.30;
      const depthAlpha     = depth === 0 ? 0.55 : depth === 1 ? 1.00 : 1.00;
      const depthDriftMult = depth === 0 ? 0.55 : depth === 1 ? 1.00 : 1.40;
      const depthSpeedMult = depth === 0 ? 0.60 : depth === 1 ? 1.00 : 1.30;

      size = size * depthScale;
      if (isOverride) size = Math.max(size * 1.4, 40);

      creatures.push({
        type,
        depth,
        depthAlpha,
        baseX, baseY,
        x: baseX, y: baseY,
        size,
        colorIdx: (i * 3 + h1) % PALETTE.length,  // also stride colors
        driftPhase: (h2 % 1000) / 1000 * Math.PI * 2,
        driftSpeedX: (0.3 + (h2 % 100) / 240) * depthSpeedMult,
        driftSpeedY: (0.25 + (h3 % 100) / 280) * depthSpeedMult,
        driftAmpX: (14 + (h1 % 18)) * depthDriftMult,
        driftAmpY: (10 + (h3 % 14)) * depthDriftMult,
        rotSpeed: ((h2 % 200) - 100) / 800,
        rot: (h3 % 360) / 360 * Math.PI * 2,
        wingPhase: (h1 % 1000) / 1000 * Math.PI * 2,
        trackIndex,
        title: title,
        scale: 1,
        inNeighborhood: false,
      });
    }

    // b059 — precompute constellation pairs for the star-map
    // line layer (creature i↔j with base distance < 75px).
    buildConstellations();
  }

  // -------------------------------------------------------
  // CONSTELLATIONS — precomputed creature pair indices for
  // the star-map line layer. O(n²) once at build time, cap 250.
  // -------------------------------------------------------
  function buildConstellations() {
    constellations = [];
    const threshold = 75;
    for (let i = 0; i < creatures.length; i++) {
      for (let j = i + 1; j < creatures.length; j++) {
        const dx = creatures[i].baseX - creatures[j].baseX;
        const dy = creatures[i].baseY - creatures[j].baseY;
        if (dx * dx + dy * dy < threshold * threshold) {
          constellations.push([i, j]);
          if (constellations.length >= 250) return;
        }
      }
    }
  }

  // -------------------------------------------------------
  function buildGlyphs() {
    glyphs = [];
    const N = isMobile() ? 30 : 75;
    for (let i = 0; i < N; i++) {
      const h = hash('glyph' + i, 99);
      glyphs.push({
        x: (h % 1000) / 1000 * W,
        y: ((h >> 8) % 1000) / 1000 * H,
        rot: ((h % 360) / 360) * Math.PI * 2,
        scale: 0.5 + ((h >> 4) % 100) / 100 * 1.2,
        kind: ['star', 'sparkle', 'cross', 'arrow', 'bolt', 'dot'][h % 6],
        color: ['#ffffff', '#9cff3a', '#4ad8ff', '#ffe833', '#0e0e0e'][h % 5],
        speed: 0.3 + ((h >> 12) % 100) / 100 * 0.7,
      });
    }
  }

  // -------------------------------------------------------
  // BACKGROUND — b059 takes optional `bands` for a treble-
  // reactive nebula brightness pulse. The additive layer is
  // wrapped in a frame-level globalAlpha (0.55 baseline +
  // treble * 0.30) which CAPS the additive sum and fixes
  // the b058 center-blowout where 7 blobs converged.
  // -------------------------------------------------------
  function drawBackground(t, bands) {
    // Dark plum base
    ctx.fillStyle = '#1a0820';
    ctx.fillRect(0, 0, W, H);

    // Gradient mesh — additive blobs, but capped by globalAlpha
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55 + (bands ? bands.treble * 0.30 : 0);
    for (const n of nebulas) {
      const cx = n.baseX + Math.sin(t * n.speedX + n.phase) * n.ampX;
      const cy = n.baseY + Math.cos(t * n.speedY + n.phase * 0.7) * n.ampY;
      const radius = n.radius * (1 + Math.sin(t * n.radiusPulseSpeed + n.phase) * n.radiusPulseAmp);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, n.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }
    ctx.restore();

    // Subtle scanlines
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

    // Soft corner vignette
    const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.30, W / 2, H / 2, Math.max(W, H) * 0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  // -------------------------------------------------------
  // AMBIENT GLYPHS — non-clickable background sparkles
  // -------------------------------------------------------
  function drawGlyphs(t) {
    for (const g of glyphs) {
      const dy = Math.sin(t * g.speed + g.x * 0.01) * 8;
      ctx.save();
      ctx.translate(g.x, g.y + dy);
      ctx.rotate(g.rot + t * g.speed * 0.4);
      ctx.scale(g.scale, g.scale);
      ctx.fillStyle = g.color;
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 2;
      drawGlyphShape(g.kind);
      ctx.restore();
    }
  }
  function drawGlyphShape(kind) {
    const c = ctx;
    if (kind === 'star') {
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 === 0 ? 7 : 2.5;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
    } else if (kind === 'sparkle') {
      c.beginPath();
      c.moveTo(0, -9); c.lineTo(2, -2); c.lineTo(9, 0);
      c.lineTo(2, 2); c.lineTo(0, 9); c.lineTo(-2, 2);
      c.lineTo(-9, 0); c.lineTo(-2, -2); c.closePath();
      c.fill();
    } else if (kind === 'cross') {
      c.fillRect(-1.5, -7, 3, 14);
      c.fillRect(-7, -1.5, 14, 3);
    } else if (kind === 'arrow') {
      c.beginPath();
      c.moveTo(-7, 0); c.lineTo(5, 0);
      c.moveTo(2, -3); c.lineTo(5, 0); c.lineTo(2, 3);
      c.stroke();
    } else if (kind === 'bolt') {
      c.beginPath();
      c.moveTo(-3, -9); c.lineTo(3, -2); c.lineTo(-1, -2);
      c.lineTo(3, 9); c.lineTo(-3, 2); c.lineTo(1, 2); c.closePath();
      c.fill();
    } else {
      c.beginPath();
      c.arc(0, 0, 3.5, 0, Math.PI * 2);
      c.fill();
    }
  }

  // -------------------------------------------------------
  // CREATURE TYPE DRAWERS — each runs at the creature's
  // local origin (already translated/rotated/scaled by
  // drawCreature). Use the creature's [light, dark] colors
  // and current wingPhase for animation.
  // -------------------------------------------------------
  function drawButterfly(c, light, dark, wingT) {
    const s = c.size;
    const flap = Math.sin(wingT * 6) * 0.45 + 0.55; // 0.10 to 1.0
    const wingW = s * flap;
    const wingH = s * 0.85;

    // Hard outline first (drawn slightly larger via stroke)
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;

    // Upper wings
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(-wingW * 0.55, -s * 0.2, wingW * 0.55, wingH * 0.55, -0.3, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse( wingW * 0.55, -s * 0.2, wingW * 0.55, wingH * 0.55,  0.3, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Lower wings
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(-wingW * 0.45, s * 0.25, wingW * 0.42, wingH * 0.42, 0.4, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse( wingW * 0.45, s * 0.25, wingW * 0.42, wingH * 0.42, -0.4, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Wing dots (eye spots)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-wingW * 0.55, -s * 0.25, s * 0.10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( wingW * 0.55, -s * 0.25, s * 0.10, 0, Math.PI * 2); ctx.fill();

    // Body
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.10, s * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Antennae
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-1.5, -s * 0.45);
    ctx.quadraticCurveTo(-s * 0.25, -s * 0.75, -s * 0.30, -s * 0.85);
    ctx.moveTo( 1.5, -s * 0.45);
    ctx.quadraticCurveTo( s * 0.25, -s * 0.75,  s * 0.30, -s * 0.85);
    ctx.stroke();
  }

  function drawDrone(c, light, dark, wingT) {
    const s = c.size;
    // Body — flat ellipse disc
    ctx.fillStyle = dark;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.95, s * 0.30, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Top dome
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.10, s * 0.55, s * 0.35, 0, Math.PI, 0);
    ctx.fill(); ctx.stroke();

    // Rim lights — 4 of them, alternate blink
    const blink = Math.sin(wingT * 4) > 0;
    for (let i = 0; i < 4; i++) {
      const lx = Math.cos((i / 4) * Math.PI * 2) * s * 0.78;
      ctx.fillStyle = (i % 2 === 0) === blink ? '#ffe833' : '#0e0e0e';
      ctx.beginPath();
      ctx.arc(lx, s * 0.05, s * 0.10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Beam
    ctx.fillStyle = 'rgba(255,232,51,0.30)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.20, s * 0.25);
    ctx.lineTo( s * 0.20, s * 0.25);
    ctx.lineTo( s * 0.40, s * 0.85);
    ctx.lineTo(-s * 0.40, s * 0.85);
    ctx.closePath();
    ctx.fill();
  }

  function drawJellyfish(c, light, dark, wingT) {
    const s = c.size;
    // Bell
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.15, s * 0.65, s * 0.45, 0, Math.PI, 0);
    ctx.lineTo(s * 0.65, -s * 0.15);
    ctx.lineTo(-s * 0.65, -s * 0.15);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Bell highlight
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.20, -s * 0.40, s * 0.18, s * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tentacles — wavy lines
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      const tx = i * s * 0.18;
      ctx.beginPath();
      ctx.moveTo(tx, -s * 0.10);
      for (let k = 1; k <= 4; k++) {
        const px = tx + Math.sin(wingT * 3 + i + k) * s * 0.08;
        const py = -s * 0.10 + (k / 4) * s * 0.85;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  function drawFish(c, light, dark, wingT) {
    const s = c.size;
    const tail = Math.sin(wingT * 5) * 0.4;

    // Body
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.85, s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Tail
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo( s * 0.85, 0);
    ctx.lineTo( s * 1.30, -s * 0.40 + tail * s * 0.20);
    ctx.lineTo( s * 1.10, 0);
    ctx.lineTo( s * 1.30,  s * 0.40 + tail * s * 0.20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Top fin
    ctx.beginPath();
    ctx.moveTo(-s * 0.10, -s * 0.40);
    ctx.lineTo( s * 0.05, -s * 0.75);
    ctx.lineTo( s * 0.30, -s * 0.40);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-s * 0.40, -s * 0.10, s * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(-s * 0.42, -s * 0.10, s * 0.06, 0, Math.PI * 2); ctx.fill();
  }

  function drawComet(c, light, dark, wingT) {
    const s = c.size;
    // Trail — multiple decreasing alpha ellipses
    for (let i = 6; i >= 1; i--) {
      ctx.fillStyle = light;
      ctx.globalAlpha = (i / 6) * 0.35;
      ctx.beginPath();
      ctx.ellipse(-i * s * 0.20, 0, s * 0.40, s * 0.20 * (i / 6), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Head
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Hot core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -s * 0.10, s * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Sparks orbiting
    const sp = wingT * 3;
    for (let i = 0; i < 3; i++) {
      const a = sp + i * (Math.PI * 2 / 3);
      ctx.fillStyle = '#ffe833';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * s * 0.65, Math.sin(a) * s * 0.65, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBeetle(c, light, dark, wingT) {
    const s = c.size;
    const wig = Math.sin(wingT * 8) * 0.2;

    // 6 legs (drawn first, behind body)
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    for (let side = -1; side <= 1; side += 2) {
      for (let j = -1; j <= 1; j++) {
        const ay = j * s * 0.35;
        ctx.beginPath();
        ctx.moveTo(side * s * 0.40, ay);
        ctx.lineTo(side * (s * 0.75 + wig * 0.2), ay + (j === 0 ? 0 : j * s * 0.15));
        ctx.stroke();
      }
    }

    // Body — round oval
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.55, s * 0.70, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Wing case split line
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.55); ctx.lineTo(0, s * 0.65);
    ctx.stroke();

    // Lighter highlight
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(-s * 0.20, -s * 0.20, s * 0.15, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.65, s * 0.30, s * 0.20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Antennae
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, -s * 0.80);
    ctx.lineTo(-s * 0.30, -s * 1.05);
    ctx.moveTo( s * 0.15, -s * 0.80);
    ctx.lineTo( s * 0.30, -s * 1.05);
    ctx.stroke();
  }

  function drawEye(c, light, dark, wingT) {
    const s = c.size;
    // Sclera (white eyeball)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.85, s * 0.65, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Iris — colored, tracks the cursor in canvas space
    let lookX = 0, lookY = 0;
    if (mx > 0 && my > 0) {
      const dx = mx - c.x;
      const dy = my - c.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.01) {
        lookX = (dx / d) * s * 0.20;
        lookY = (dy / d) * s * 0.18;
      }
    }
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(lookX, lookY, s * 0.35, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Pupil
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.arc(lookX, lookY, s * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Glint
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(lookX - s * 0.07, lookY - s * 0.07, s * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // Blink — squish vertically every few seconds
    const blinkPhase = Math.sin(wingT * 0.7);
    if (blinkPhase > 0.985) {
      ctx.fillStyle = '#ff2bd6'; // bg color overlay
      ctx.fillRect(-s, -s * 0.2, s * 2, s * 0.4);
    }
  }

  function drawCrystal(c, light, dark, wingT) {
    const s = c.size;
    // Outer hexagon crystal
    ctx.save();
    ctx.rotate(wingT * 0.5);
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * s * 0.85;
      const y = Math.sin(a) * s * 0.85;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Inner facet lines
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * s * 0.85, Math.sin(a) * s * 0.85);
      ctx.stroke();
    }

    // Inner highlight
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.15, -s * 0.20, s * 0.18, s * 0.10, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Sparkle dots around it
    for (let i = 0; i < 3; i++) {
      const a = wingT * 1.5 + i * 2.1;
      const r = s * 1.05;
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 3);
      ctx.lineTo(sx + 3, sy);
      ctx.lineTo(sx, sy + 3);
      ctx.lineTo(sx - 3, sy);
      ctx.closePath();
      ctx.fill();
    }
  }

  // -------------------------------------------------------
  // b056 — 12 NEW CREATURE TYPES
  // -------------------------------------------------------

  function drawUfo(c, light, dark, wingT) {
    const s = c.size;
    // Saucer body
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Top dome (transparent-feeling)
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.10, s * 0.45, s * 0.35, 0, Math.PI, 0);
    ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 1;
    // Bottom abduction beam (cone)
    const beamA = (Math.sin(wingT * 3) + 1) * 0.5 * 0.35 + 0.10;
    ctx.fillStyle = `rgba(156,255,58,${beamA})`;
    ctx.beginPath();
    ctx.moveTo(-s * 0.30, s * 0.20);
    ctx.lineTo( s * 0.30, s * 0.20);
    ctx.lineTo( s * 0.65, s * 1.05);
    ctx.lineTo(-s * 0.65, s * 1.05);
    ctx.closePath();
    ctx.fill();
    // 3 rotating bottom lights
    const sp = wingT * 4;
    for (let i = 0; i < 3; i++) {
      const a = sp + (i / 3) * Math.PI * 2;
      ctx.fillStyle = ['#ff5cf2', '#4ad8ff', '#ffe833'][i];
      ctx.beginPath();
      ctx.arc(Math.cos(a) * s * 0.75, s * 0.18, s * 0.10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlanet(c, light, dark, wingT) {
    const s = c.size;
    // Ring (back half)
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.15, s * 0.30, -0.25, Math.PI, Math.PI * 2);
    ctx.stroke();
    // Body
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.70, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Surface bands
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.15, s * 0.65, s * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, s * 0.20, s * 0.55, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ring (front half)
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.15, s * 0.30, -0.25, 0, Math.PI);
    ctx.stroke();
    // Orbiting moon
    const ma = wingT * 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(Math.cos(ma) * s * 1.30, Math.sin(ma) * s * 0.32, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0e0e0e';
    ctx.stroke();
  }

  function drawRocket(c, light, dark, wingT) {
    const s = c.size;
    const flame = (Math.sin(wingT * 12) + 1) * 0.5;
    // Flame
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.moveTo(-s * 0.30, s * 0.55);
    ctx.lineTo( s * 0.30, s * 0.55);
    ctx.lineTo( 0, s * (1.0 + flame * 0.4));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe833';
    ctx.beginPath();
    ctx.moveTo(-s * 0.18, s * 0.55);
    ctx.lineTo( s * 0.18, s * 0.55);
    ctx.lineTo( 0, s * (0.85 + flame * 0.3));
    ctx.closePath();
    ctx.fill();
    // Body — pointed cylinder
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.30, s * 0.55);
    ctx.lineTo(-s * 0.30, -s * 0.30);
    ctx.quadraticCurveTo(0, -s * 1.05, s * 0.30, -s * 0.30);
    ctx.lineTo( s * 0.30, s * 0.55);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Window
    ctx.fillStyle = '#4ad8ff';
    ctx.beginPath();
    ctx.arc(0, -s * 0.25, s * 0.18, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Fins
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-s * 0.30, s * 0.55);
    ctx.lineTo(-s * 0.55, s * 0.70);
    ctx.lineTo(-s * 0.30, s * 0.30);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo( s * 0.30, s * 0.55);
    ctx.lineTo( s * 0.55, s * 0.70);
    ctx.lineTo( s * 0.30, s * 0.30);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  function drawGhost(c, light, dark, wingT) {
    const s = c.size;
    const wob = Math.sin(wingT * 4) * s * 0.08;
    // Body — rounded top + wavy bottom
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.70, Math.PI, 0, false);
    // Wavy bottom
    const baseY = s * 0.55;
    ctx.lineTo( s * 0.70, baseY);
    for (let i = 0; i < 4; i++) {
      const x1 = s * 0.70 - (i + 0.5) * (s * 0.35);
      const x2 = s * 0.70 - (i + 1) * (s * 0.35);
      const y1 = baseY + (i % 2 === 0 ? wob : -wob) + s * 0.10;
      ctx.quadraticCurveTo(x1, y1, x2, baseY);
    }
    ctx.lineTo(-s * 0.70, baseY);
    ctx.lineTo(-s * 0.70, 0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Eyes
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.ellipse(-s * 0.25, -s * 0.15, s * 0.10, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( s * 0.25, -s * 0.15, s * 0.10, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    // Eye glints
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-s * 0.22, -s * 0.20, s * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( s * 0.28, -s * 0.20, s * 0.04, 0, Math.PI * 2); ctx.fill();
  }

  function drawBird(c, light, dark, wingT) {
    const s = c.size;
    const flap = Math.sin(wingT * 7);
    ctx.strokeStyle = '#0e0e0e';
    ctx.fillStyle = light;
    ctx.lineWidth = 2.5;
    // Two V wings
    ctx.beginPath();
    ctx.moveTo(-s, 0 + flap * s * 0.15);
    ctx.lineTo( 0, -s * 0.20 - flap * s * 0.10);
    ctx.lineTo( s, 0 + flap * s * 0.15);
    ctx.stroke();
    // Body dot in the middle
    ctx.beginPath();
    ctx.arc(0, -s * 0.10, s * 0.12, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }

  function drawBee(c, light, dark, wingT) {
    const s = c.size;
    const flap = Math.sin(wingT * 14) * 0.4 + 0.6;
    // Wings (drawn behind body)
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-s * 0.20, -s * 0.40, s * 0.30 * flap, s * 0.18, -0.4, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse( s * 0.20, -s * 0.40, s * 0.30 * flap, s * 0.18, 0.4, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Body — yellow oval
    ctx.fillStyle = '#ffe833';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.55, s * 0.40, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Stripes
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(-s * 0.30, -s * 0.10, s * 0.60, s * 0.08);
    ctx.fillRect(-s * 0.20, s * 0.06, s * 0.40, s * 0.08);
    // Stinger
    ctx.beginPath();
    ctx.moveTo(s * 0.55, 0);
    ctx.lineTo(s * 0.80, -s * 0.05);
    ctx.lineTo(s * 0.80, s * 0.05);
    ctx.closePath();
    ctx.fill();
    // Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-s * 0.35, -s * 0.10, s * 0.07, 0, Math.PI * 2); ctx.fill();
  }

  function drawFlower(c, light, dark, wingT) {
    const s = c.size;
    ctx.save();
    ctx.rotate(wingT * 0.6);
    // 5 petals
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.55, s * 0.30, s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    // Center
    ctx.fillStyle = '#ffe833';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.30, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Center dots
    ctx.fillStyle = '#0e0e0e';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * s * 0.10, Math.sin(a) * s * 0.10, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMushroom(c, light, dark, wingT) {
    const s = c.size;
    // Stem
    ctx.fillStyle = '#f5ecd8';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, s * 0.15);
    ctx.lineTo(-s * 0.20, s * 0.70);
    ctx.lineTo( s * 0.20, s * 0.70);
    ctx.lineTo( s * 0.25, s * 0.15);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Cap
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.85, s * 0.55, 0, Math.PI, 0);
    ctx.lineTo( s * 0.85, 0);
    ctx.lineTo(-s * 0.85, 0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Cap dots
    ctx.fillStyle = '#ffffff';
    const dots = [[-0.45, -0.15], [0.05, -0.30], [0.40, -0.10], [-0.20, -0.35]];
    for (const [dx, dy] of dots) {
      ctx.beginPath();
      ctx.arc(s * dx, s * dy, s * 0.10, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
  }

  function drawOctopus(c, light, dark, wingT) {
    const s = c.size;
    // 8 wavy tentacles drawn first
    ctx.strokeStyle = light;
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const baseA = (i / 8) * Math.PI * 2;
      const bx = Math.cos(baseA) * s * 0.35;
      const by = Math.sin(baseA) * s * 0.20 + s * 0.20;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      for (let k = 1; k <= 4; k++) {
        const r = s * (0.35 + k * 0.18);
        const wig = Math.sin(wingT * 3 + i + k) * s * 0.10;
        const px = Math.cos(baseA) * r + wig;
        const py = Math.sin(baseA) * r + s * 0.20 + k * s * 0.05;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // Head
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.10, s * 0.55, s * 0.50, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-s * 0.18, -s * 0.15, s * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc( s * 0.18, -s * 0.15, s * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(-s * 0.18, -s * 0.13, s * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( s * 0.18, -s * 0.13, s * 0.05, 0, Math.PI * 2); ctx.fill();
  }

  function drawBat(c, light, dark, wingT) {
    const s = c.size;
    const flap = Math.sin(wingT * 8) * 0.30 + 0.70;
    ctx.fillStyle = dark;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    // Left wing — angular
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s * 0.35, -s * 0.30 * flap);
    ctx.lineTo(-s * 0.85, -s * 0.10 * flap);
    ctx.lineTo(-s * 0.95, s * 0.20 * flap);
    ctx.lineTo(-s * 0.55, s * 0.10);
    ctx.lineTo(-s * 0.30, s * 0.30 * flap);
    ctx.lineTo(0, s * 0.10);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Right wing
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo( s * 0.35, -s * 0.30 * flap);
    ctx.lineTo( s * 0.85, -s * 0.10 * flap);
    ctx.lineTo( s * 0.95, s * 0.20 * flap);
    ctx.lineTo( s * 0.55, s * 0.10);
    ctx.lineTo( s * 0.30, s * 0.30 * flap);
    ctx.lineTo(0, s * 0.10);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Body
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.18, s * 0.30, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ears
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, -s * 0.30);
    ctx.lineTo(-s * 0.20, -s * 0.45);
    ctx.lineTo(-s * 0.05, -s * 0.30);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo( s * 0.12, -s * 0.30);
    ctx.lineTo( s * 0.20, -s * 0.45);
    ctx.lineTo( s * 0.05, -s * 0.30);
    ctx.closePath();
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#ff5cf2';
    ctx.beginPath(); ctx.arc(-s * 0.07, -s * 0.10, s * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( s * 0.07, -s * 0.10, s * 0.04, 0, Math.PI * 2); ctx.fill();
  }

  function drawNote(c, light, dark, wingT) {
    const s = c.size;
    // Note head — filled ellipse, slightly tilted
    ctx.save();
    ctx.rotate(-0.35);
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-s * 0.20, s * 0.45, s * 0.35, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // Stem
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(s * 0.05, -s * 0.65, s * 0.10, s * 1.10);
    // Flag
    ctx.beginPath();
    ctx.moveTo(s * 0.15, -s * 0.65);
    ctx.quadraticCurveTo(s * 0.55, -s * 0.40, s * 0.40, -s * 0.10);
    ctx.quadraticCurveTo(s * 0.30, -s * 0.30, s * 0.15, -s * 0.30);
    ctx.closePath();
    ctx.fill();
  }

  function drawCassette(c, light, dark, wingT) {
    const s = c.size;
    // Body
    ctx.fillStyle = light;
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    const w = s * 1.10, h = s * 0.75;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    // Label area
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.40);
    ctx.strokeRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.40);
    // Label lines
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(-w / 2 + 7, -h / 2 + 8, w * 0.5, 1.5);
    ctx.fillRect(-w / 2 + 7, -h / 2 + 13, w * 0.4, 1.5);
    // Two reels — rotating
    const rA = wingT * 4;
    for (let side = -1; side <= 1; side += 2) {
      const cx = side * s * 0.28;
      const cy = s * 0.15;
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.18, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // Spokes
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rA * side);
      ctx.strokeStyle = '#0e0e0e';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos((k / 4) * Math.PI * 2) * s * 0.16, Math.sin((k / 4) * Math.PI * 2) * s * 0.16);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // -------------------------------------------------------
  // b060 — OVERRIDE CREATURE DRAWERS
  // Custom art for specific song titles. Each one's an
  // intentional hero icon — front layer, bumped size, more
  // detail than the random creature types.
  // -------------------------------------------------------

  function drawHelmet(c, light, dark, wingT) {
    // ODST helmet — angular sci-fi shape, dark visor, side
    // armor block, front antenna node. Nods to Halo ODST
    // without copying the exact silhouette.
    const s = c.size;

    // Outer helmet body — slightly tapered hex shape
    ctx.fillStyle = '#3a4555';   // gunmetal
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, -s * 0.10);
    ctx.lineTo(-s * 0.75, -s * 0.65);
    ctx.lineTo(-s * 0.30, -s * 0.92);
    ctx.lineTo( s * 0.30, -s * 0.92);
    ctx.lineTo( s * 0.75, -s * 0.65);
    ctx.lineTo( s * 0.85, -s * 0.10);
    ctx.lineTo( s * 0.78,  s * 0.55);
    ctx.lineTo( s * 0.50,  s * 0.85);
    ctx.lineTo(-s * 0.50,  s * 0.85);
    ctx.lineTo(-s * 0.78,  s * 0.55);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Top crown plate — slightly lighter
    ctx.fillStyle = '#4a5565';
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.65);
    ctx.lineTo(-s * 0.30, -s * 0.85);
    ctx.lineTo( s * 0.30, -s * 0.85);
    ctx.lineTo( s * 0.55, -s * 0.65);
    ctx.lineTo( s * 0.40, -s * 0.45);
    ctx.lineTo(-s * 0.40, -s * 0.45);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Visor — wide dark band with cyan glow
    ctx.fillStyle = '#0a0e16';
    ctx.beginPath();
    ctx.moveTo(-s * 0.78, -s * 0.10);
    ctx.lineTo(-s * 0.65, -s * 0.40);
    ctx.lineTo( s * 0.65, -s * 0.40);
    ctx.lineTo( s * 0.78, -s * 0.10);
    ctx.lineTo( s * 0.65,  s * 0.05);
    ctx.lineTo(-s * 0.65,  s * 0.05);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Visor cyan inner glow
    ctx.fillStyle = '#4ad8ff';
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.30);
    ctx.lineTo( s * 0.55, -s * 0.30);
    ctx.lineTo( s * 0.50, -s * 0.05);
    ctx.lineTo(-s * 0.50, -s * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Visor highlight
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-s * 0.45, -s * 0.25, s * 0.20, s * 0.04);

    // Side armor blocks (cheek guards)
    ctx.fillStyle = '#2a3340';
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, -s * 0.05);
    ctx.lineTo(-s * 0.55,  s * 0.10);
    ctx.lineTo(-s * 0.55,  s * 0.50);
    ctx.lineTo(-s * 0.78,  s * 0.55);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo( s * 0.85, -s * 0.05);
    ctx.lineTo( s * 0.55,  s * 0.10);
    ctx.lineTo( s * 0.55,  s * 0.50);
    ctx.lineTo( s * 0.78,  s * 0.55);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Bottom mouth guard
    ctx.fillStyle = '#1a2230';
    ctx.beginPath();
    ctx.moveTo(-s * 0.50, s * 0.20);
    ctx.lineTo( s * 0.50, s * 0.20);
    ctx.lineTo( s * 0.40, s * 0.65);
    ctx.lineTo(-s * 0.40, s * 0.65);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Mouth grille lines
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s * 0.18, s * 0.25);
      ctx.lineTo(i * s * 0.18, s * 0.60);
      ctx.stroke();
    }

    // Front antenna nub (animated blink)
    const blink = Math.sin(wingT * 4) > 0;
    ctx.fillStyle = blink ? '#9cff3a' : '#3a4555';
    ctx.beginPath();
    ctx.arc(0, -s * 0.78, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0e0e0e';
    ctx.stroke();

    // ODST stencil (subtle lime text behind visor area)
    ctx.fillStyle = 'rgba(156,255,58,0.6)';
    ctx.font = `bold ${Math.max(6, s * 0.18)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ODST', 0, s * 0.42);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function drawSupercar(c, light, dark, wingT) {
    // Lambo-style wedge supercar — low body, raked
    // windshield, two big wheels, glowing headlight.
    const s = c.size;
    const wheelSpin = wingT * 6;

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.40)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.55, s * 1.15, s * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body wedge — sharp angular front, low slung
    ctx.fillStyle = '#ffe833';   // hot yellow lambo
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-s * 1.05,  s * 0.30);   // rear bottom
    ctx.lineTo(-s * 1.10,  s * 0.05);   // rear top
    ctx.lineTo(-s * 0.70, -s * 0.05);   // rear shoulder
    ctx.lineTo(-s * 0.30, -s * 0.30);   // roof rear
    ctx.lineTo( s * 0.20, -s * 0.30);   // roof front
    ctx.lineTo( s * 0.55, -s * 0.05);   // hood top
    ctx.lineTo( s * 1.10,  s * 0.10);   // nose tip
    ctx.lineTo( s * 1.10,  s * 0.30);   // front bottom
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Windshield + side window
    ctx.fillStyle = '#1a2230';
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, -s * 0.05);
    ctx.lineTo(-s * 0.20, -s * 0.27);
    ctx.lineTo( s * 0.18, -s * 0.27);
    ctx.lineTo( s * 0.40, -s * 0.05);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Cyan windshield reflection
    ctx.fillStyle = '#4ad8ff';
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, -s * 0.10);
    ctx.lineTo(-s * 0.15, -s * 0.22);
    ctx.lineTo( s * 0.05, -s * 0.22);
    ctx.lineTo( s * 0.10, -s * 0.10);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Side intake / vent
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, s * 0.05);
    ctx.lineTo(-s * 0.20, s * 0.05);
    ctx.lineTo(-s * 0.30, s * 0.20);
    ctx.lineTo(-s * 0.65, s * 0.20);
    ctx.closePath();
    ctx.fill();

    // Body line / character crease
    ctx.strokeStyle = '#a86b00';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-s * 1.00, s * 0.18);
    ctx.lineTo( s * 1.00, s * 0.18);
    ctx.stroke();

    // Headlight — glowing white
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(s * 0.85, -s * 0.02, s * 0.12, s * 0.07, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Tail light — magenta
    ctx.fillStyle = '#ff5cf2';
    ctx.beginPath();
    ctx.ellipse(-s * 0.95, -s * 0.05, s * 0.08, s * 0.05, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Wheels — two big black tires with spinning rims
    for (const wx of [-s * 0.55, s * 0.55]) {
      // Tire
      ctx.fillStyle = '#0e0e0e';
      ctx.beginPath();
      ctx.arc(wx, s * 0.40, s * 0.30, 0, Math.PI * 2);
      ctx.fill();
      // Rim
      ctx.fillStyle = '#cccccc';
      ctx.beginPath();
      ctx.arc(wx, s * 0.40, s * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0e0e0e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Spinning spokes
      ctx.save();
      ctx.translate(wx, s * 0.40);
      ctx.rotate(wheelSpin);
      ctx.strokeStyle = '#0e0e0e';
      ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos((k / 5) * Math.PI * 2) * s * 0.16, Math.sin((k / 5) * Math.PI * 2) * s * 0.16);
        ctx.stroke();
      }
      ctx.restore();
      // Center cap
      ctx.fillStyle = '#0e0e0e';
      ctx.beginPath();
      ctx.arc(wx, s * 0.40, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPillowcase(c, light, dark, wingT) {
    // Soft silk pillow — rounded rectangle, fold lines,
    // tasseled corners, gentle wobble.
    const s = c.size;
    const wob = Math.sin(wingT * 2) * 0.04;
    const w = s * 1.20;
    const h = s * 0.85;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.65, w * 0.70, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pillow body — rounded blob with sag
    ctx.fillStyle = '#f5d4e8';   // silk pink
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    // top edge with slight wobble
    ctx.moveTo(-w * 0.50, -h * 0.45);
    ctx.quadraticCurveTo(0, -h * (0.55 + wob), w * 0.50, -h * 0.45);
    // right edge
    ctx.quadraticCurveTo(w * 0.62, 0, w * 0.50, h * 0.50);
    // bottom edge
    ctx.quadraticCurveTo(0, h * (0.62 - wob), -w * 0.50, h * 0.50);
    // left edge
    ctx.quadraticCurveTo(-w * 0.62, 0, -w * 0.50, -h * 0.45);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Silk highlight band — diagonal sheen
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-w * 0.18, -h * 0.18, w * 0.30, h * 0.10, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Fold lines from each corner toward center
    ctx.strokeStyle = '#d49bc4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, -h * 0.40);
    ctx.quadraticCurveTo(-w * 0.15, -h * 0.10, 0, 0);
    ctx.moveTo( w * 0.45, -h * 0.40);
    ctx.quadraticCurveTo( w * 0.15, -h * 0.10, 0, 0);
    ctx.moveTo(-w * 0.45,  h * 0.45);
    ctx.quadraticCurveTo(-w * 0.15,  h * 0.10, 0, 0);
    ctx.moveTo( w * 0.45,  h * 0.45);
    ctx.quadraticCurveTo( w * 0.15,  h * 0.10, 0, 0);
    ctx.stroke();

    // Center button (silk pillow tuft)
    ctx.fillStyle = '#ff5cf2';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.10, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Tassels at the 4 corners
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    const corners = [
      [-w * 0.50, -h * 0.45],
      [ w * 0.50, -h * 0.45],
      [ w * 0.50,  h * 0.50],
      [-w * 0.50,  h * 0.50],
    ];
    for (const [tx, ty] of corners) {
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + (tx > 0 ? 4 : -4), ty + (ty > 0 ? 4 : -4));
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(tx + (tx > 0 ? 4 : -4), ty + (ty > 0 ? 4 : -4), 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // -------------------------------------------------------
  // b061 — 9 ADDITIONAL OVERRIDE DRAWERS
  // -------------------------------------------------------

  function drawSpaceship(c, light, dark, wingT) {
    // Sleek angular sci-fi cruiser with engine glow trail
    const s = c.size;
    const flame = (Math.sin(wingT * 14) + 1) * 0.5;

    // Engine trail (drawn first, behind body)
    for (let i = 6; i >= 1; i--) {
      ctx.fillStyle = '#4ad8ff';
      ctx.globalAlpha = (i / 6) * 0.40;
      ctx.beginPath();
      ctx.ellipse(-s * (0.85 + i * 0.18), 0, s * 0.18, s * 0.10 * (i / 6), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Hull body — long arrowhead pointing right
    ctx.fillStyle = '#cccccc';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, -s * 0.20);
    ctx.lineTo(-s * 0.45, -s * 0.30);
    ctx.lineTo( s * 0.55, -s * 0.18);
    ctx.lineTo( s * 1.05,  0);
    ctx.lineTo( s * 0.55,  s * 0.18);
    ctx.lineTo(-s * 0.45,  s * 0.30);
    ctx.lineTo(-s * 0.85,  s * 0.20);
    ctx.lineTo(-s * 0.65,  0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Top spine highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-s * 0.40, -s * 0.10);
    ctx.lineTo( s * 0.55, -s * 0.05);
    ctx.lineTo( s * 0.55,  s * 0.05);
    ctx.lineTo(-s * 0.40,  s * 0.10);
    ctx.closePath();
    ctx.fill();

    // Wings — angled back delta
    ctx.fillStyle = '#3a4555';
    ctx.beginPath();
    ctx.moveTo(-s * 0.10, -s * 0.10);
    ctx.lineTo(-s * 0.55, -s * 0.55);
    ctx.lineTo(-s * 0.30, -s * 0.20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.10, s * 0.10);
    ctx.lineTo(-s * 0.55, s * 0.55);
    ctx.lineTo(-s * 0.30, s * 0.20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Cockpit — cyan dome on top of nose
    ctx.fillStyle = '#4ad8ff';
    ctx.beginPath();
    ctx.ellipse(s * 0.40, -s * 0.05, s * 0.18, s * 0.10, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s * 0.45, -s * 0.08, s * 0.04, 0, Math.PI * 2);
    ctx.fill();

    // Engine flame (yellow core inside the trail)
    ctx.fillStyle = '#ffe833';
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, -s * 0.10);
    ctx.lineTo(-s * (1.10 + flame * 0.20), 0);
    ctx.lineTo(-s * 0.85,  s * 0.10);
    ctx.closePath();
    ctx.fill();
  }

  function drawHotelsign(c, light, dark, wingT) {
    // Vertical neon "HOTEL" sign on a pole. Tropical Cali vibe.
    const s = c.size;
    const blink = (Math.sin(wingT * 3) + 1) * 0.5;

    // Pole
    ctx.fillStyle = '#3a3a3a';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-s * 0.06, -s * 0.10, s * 0.12, s * 1.10);
    ctx.strokeRect(-s * 0.06, -s * 0.10, s * 0.12, s * 1.10);

    // Sign body
    const w = s * 0.85, h = s * 1.20;
    ctx.fillStyle = '#0a1018';
    ctx.lineWidth = 2;
    ctx.fillRect(-w / 2, -h * 0.95, w, h);
    ctx.strokeRect(-w / 2, -h * 0.95, w, h);

    // Neon outer border (magenta)
    ctx.strokeStyle = '#ff5cf2';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6 + blink * 0.4;
    ctx.strokeRect(-w / 2 + 4, -h * 0.95 + 4, w - 8, h - 8);
    ctx.globalAlpha = 1;

    // "HOTEL" letters stacked vertically — cyan neon
    ctx.fillStyle = '#4ad8ff';
    ctx.globalAlpha = 0.7 + blink * 0.3;
    const letters = ['H', 'O', 'T', 'E', 'L'];
    ctx.font = `900 ${Math.max(7, s * 0.22)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < letters.length; i++) {
      ctx.fillText(letters[i], 0, -h * 0.78 + i * (h * 0.18));
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;

    // Bottom star ornament
    ctx.fillStyle = '#ffe833';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? s * 0.13 : s * 0.05;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r + s * 0.10);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0e0e0e';
    ctx.stroke();
  }

  function drawCoffeecup(c, light, dark, wingT) {
    // White ceramic cup w/ brown coffee + animated steam
    const s = c.size;

    // Saucer
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.65, s * 0.95, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Cup body — wider at top
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.10);
    ctx.lineTo(-s * 0.45,  s * 0.55);
    ctx.lineTo( s * 0.45,  s * 0.55);
    ctx.lineTo( s * 0.55, -s * 0.10);
    ctx.lineTo( s * 0.55, -s * 0.20);
    ctx.lineTo(-s * 0.55, -s * 0.20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Coffee surface — brown ellipse at the rim
    ctx.fillStyle = '#3a1a08';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.20, s * 0.55, s * 0.10, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Coffee crema highlight
    ctx.fillStyle = '#a86b00';
    ctx.beginPath();
    ctx.ellipse(-s * 0.10, -s * 0.22, s * 0.20, s * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();

    // Handle — right side oval
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(s * 0.65, s * 0.18, s * 0.18, s * 0.22, 0, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();

    // Steam wisps — 3 animated curves rising from the cup
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.75;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      const baseX = i * s * 0.20;
      ctx.moveTo(baseX, -s * 0.30);
      for (let k = 1; k <= 6; k++) {
        const y = -s * 0.30 - k * s * 0.13;
        const x = baseX + Math.sin(wingT * 3 + k * 0.6 + i) * s * 0.12;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawRobotbody(c, light, dark, wingT) {
    // Boxy retro robot — antenna, LED eyes, body, treads
    const s = c.size;
    const blink = Math.sin(wingT * 4) > 0.5 ? 0 : 1;

    // Antenna
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.95);
    ctx.lineTo(0, -s * 0.70);
    ctx.stroke();
    ctx.fillStyle = blink ? '#ff5cf2' : '#9cff3a';
    ctx.beginPath();
    ctx.arc(0, -s * 1.00, s * 0.08, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Head — square
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(-s * 0.45, -s * 0.70, s * 0.90, s * 0.55);
    ctx.strokeRect(-s * 0.45, -s * 0.70, s * 0.90, s * 0.55);

    // Eye visor — black band with two LED dots
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(-s * 0.35, -s * 0.55, s * 0.70, s * 0.18);
    ctx.fillStyle = '#4ad8ff';
    ctx.globalAlpha = 0.6 + blink * 0.4;
    ctx.beginPath(); ctx.arc(-s * 0.18, -s * 0.46, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( s * 0.18, -s * 0.46, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Mouth — small grille
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s * 0.08, -s * 0.30);
      ctx.lineTo(i * s * 0.08, -s * 0.20);
      ctx.stroke();
    }

    // Body — slightly wider rounded rect
    ctx.fillStyle = '#9aa5b5';
    ctx.lineWidth = 2;
    ctx.fillRect(-s * 0.55, -s * 0.10, s * 1.10, s * 0.65);
    ctx.strokeRect(-s * 0.55, -s * 0.10, s * 1.10, s * 0.65);

    // Chest panel — colored screen
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(-s * 0.30, s * 0.05, s * 0.60, s * 0.30);
    ctx.fillStyle = '#9cff3a';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(-s * 0.26, s * 0.09, s * 0.52, s * 0.10);
    ctx.fillStyle = '#ffe833';
    ctx.fillRect(-s * 0.26, s * 0.22, s * 0.36, s * 0.08);
    ctx.globalAlpha = 1;

    // Side rivets
    ctx.fillStyle = '#666666';
    for (const ry of [-s * 0.02, s * 0.18, s * 0.40]) {
      ctx.beginPath(); ctx.arc(-s * 0.48, ry, s * 0.04, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( s * 0.48, ry, s * 0.04, 0, Math.PI * 2); ctx.fill();
    }

    // Arms — short stubs
    ctx.fillStyle = '#9aa5b5';
    ctx.fillRect(-s * 0.75, s * 0.05, s * 0.18, s * 0.40);
    ctx.strokeRect(-s * 0.75, s * 0.05, s * 0.18, s * 0.40);
    ctx.fillRect( s * 0.57, s * 0.05, s * 0.18, s * 0.40);
    ctx.strokeRect( s * 0.57, s * 0.05, s * 0.18, s * 0.40);

    // Tread feet
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(-s * 0.55, s * 0.55, s * 0.50, s * 0.20);
    ctx.fillRect( s * 0.05, s * 0.55, s * 0.50, s * 0.20);
  }

  function drawDiscoball(c, light, dark, wingT) {
    // Hanging disco ball with rotating sparkle
    const s = c.size;

    // Hanging chain
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.10);
    ctx.lineTo(0, -s * 0.85);
    ctx.stroke();
    // Top loop
    ctx.fillStyle = '#cccccc';
    ctx.beginPath();
    ctx.arc(0, -s * 1.00, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0e0e0e';
    ctx.stroke();

    // Ball body
    ctx.fillStyle = '#cccccc';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Mirror tile grid — clipped to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2);
    ctx.clip();
    // Vertical "longitude" arcs
    ctx.strokeStyle = 'rgba(0,0,0,0.30)';
    ctx.lineWidth = 1;
    for (let i = -5; i <= 5; i++) {
      const x = (i / 5) * s * 0.85;
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.abs(x), s * 0.85, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Horizontal lines
    for (let i = -4; i <= 4; i++) {
      const y = (i / 5) * s * 0.85;
      ctx.beginPath();
      ctx.moveTo(-s * 0.85, y);
      ctx.lineTo( s * 0.85, y);
      ctx.stroke();
    }
    // Random colored mirror highlights
    const tiles = [
      ['#4ad8ff', -0.3, -0.3],
      ['#ff5cf2',  0.2, -0.4],
      ['#ffe833', -0.5,  0.2],
      ['#9cff3a',  0.4,  0.3],
      ['#ffffff', -0.1,  0.0],
      ['#a855f7',  0.0, -0.5],
    ];
    for (const [col, tx, ty] of tiles) {
      ctx.fillStyle = col;
      ctx.fillRect(tx * s, ty * s, s * 0.16, s * 0.16);
    }
    ctx.restore();

    // Sparkle dots orbiting
    const sp = wingT * 1.5;
    for (let i = 0; i < 5; i++) {
      const a = sp + i * (Math.PI * 2 / 5);
      const r = s * 1.10;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r;
      ctx.moveTo(sx, sy - 4);
      ctx.lineTo(sx + 4, sy);
      ctx.lineTo(sx, sy + 4);
      ctx.lineTo(sx - 4, sy);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawMariostar(c, light, dark, wingT) {
    // Cute Mario-style 5-point star with face
    const s = c.size;
    const wob = Math.sin(wingT * 4) * 0.15;

    ctx.save();
    ctx.rotate(wob * 0.3);

    // Star outline + fill
    ctx.fillStyle = '#ffe833';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? s * 0.95 : s * 0.40;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Inner highlight ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? s * 0.75 : s * 0.30;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // Eyes — two cartoon ovals
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(-s * 0.18, -s * 0.05, s * 0.12, s * 0.16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse( s * 0.18, -s * 0.05, s * 0.12, s * 0.16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Pupils
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(-s * 0.16, -s * 0.02, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( s * 0.20, -s * 0.02, s * 0.06, 0, Math.PI * 2); ctx.fill();

    // Smile
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, s * 0.10, s * 0.20, 0.1, Math.PI - 0.1);
    ctx.stroke();

    ctx.restore();
  }

  function drawChainlink(c, light, dark, wingT) {
    // 3 interlocked metal chain links, slight sway
    const s = c.size;
    const sway = Math.sin(wingT * 1.5) * 0.10;

    ctx.save();
    ctx.rotate(sway);

    // Helper: draw one oval link at (x, y) with rotation
    function link(lx, ly, rot, col1, col2) {
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(rot);
      // Outer
      ctx.fillStyle = col1;
      ctx.strokeStyle = '#0e0e0e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.30, s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // Inner cutout (background show-through approximation)
      ctx.fillStyle = '#1a0820';
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.18, s * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.strokeStyle = col2;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(-s * 0.05, -s * 0.10, s * 0.20, s * 0.28, 0, Math.PI * 1.1, Math.PI * 1.7);
      ctx.stroke();
      ctx.restore();
    }

    // Three links — alternating angle
    link(0, -s * 0.65, 0, '#aaaaaa', '#ffffff');
    link(0,  0,        Math.PI / 2, '#888888', '#cccccc');
    link(0,  s * 0.65, 0, '#aaaaaa', '#ffffff');

    ctx.restore();
  }

  function drawWonkysmile(c, light, dark, wingT) {
    // Nirvana-style wonky smiley face — yellow circle, X eyes,
    // crooked mouth + tongue
    const s = c.size;

    // Face
    ctx.fillStyle = '#ffe833';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // X eyes
    ctx.lineWidth = 3;
    const eyeR = s * 0.10;
    // left
    ctx.beginPath();
    ctx.moveTo(-s * 0.32 - eyeR, -s * 0.20 - eyeR);
    ctx.lineTo(-s * 0.32 + eyeR, -s * 0.20 + eyeR);
    ctx.moveTo(-s * 0.32 + eyeR, -s * 0.20 - eyeR);
    ctx.lineTo(-s * 0.32 - eyeR, -s * 0.20 + eyeR);
    ctx.stroke();
    // right
    ctx.beginPath();
    ctx.moveTo( s * 0.32 - eyeR, -s * 0.20 - eyeR);
    ctx.lineTo( s * 0.32 + eyeR, -s * 0.20 + eyeR);
    ctx.moveTo( s * 0.32 + eyeR, -s * 0.20 - eyeR);
    ctx.lineTo( s * 0.32 - eyeR, -s * 0.20 + eyeR);
    ctx.stroke();

    // Crooked mouth — wonky scribble curve
    ctx.beginPath();
    ctx.moveTo(-s * 0.40, s * 0.20);
    ctx.quadraticCurveTo(-s * 0.20, s * 0.50, 0, s * 0.30);
    ctx.quadraticCurveTo( s * 0.20, s * 0.55, s * 0.45, s * 0.18);
    ctx.stroke();

    // Tongue sticking out the right side
    ctx.fillStyle = '#ff5cf2';
    ctx.beginPath();
    ctx.moveTo(s * 0.30, s * 0.30);
    ctx.quadraticCurveTo(s * 0.50, s * 0.50, s * 0.60, s * 0.42);
    ctx.quadraticCurveTo(s * 0.55, s * 0.30, s * 0.42, s * 0.28);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  function drawVillainmask(c, light, dark, wingT) {
    // Joker-style villain face — pale, red lips, green hair,
    // dark eyes. Slightly tilted manic energy.
    const s = c.size;

    // Hair behind (green clumps)
    ctx.fillStyle = '#0aff9c';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      const ax = i * s * 0.20;
      ctx.moveTo(ax - s * 0.12, -s * 0.30);
      ctx.lineTo(ax,            -s * 0.95);
      ctx.lineTo(ax + s * 0.12, -s * 0.30);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    // Face — pale oval
    ctx.fillStyle = '#f5ecd8';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.70, s * 0.85, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Dark eye sockets
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.ellipse(-s * 0.28, -s * 0.10, s * 0.18, s * 0.22, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse( s * 0.28, -s * 0.10, s * 0.18, s * 0.22, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Tiny white pupil dots
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-s * 0.25, -s * 0.10, s * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( s * 0.31, -s * 0.10, s * 0.04, 0, Math.PI * 2); ctx.fill();

    // Wide red grin
    ctx.fillStyle = '#ff2a4a';
    ctx.beginPath();
    ctx.moveTo(-s * 0.50, s * 0.20);
    ctx.quadraticCurveTo(0, s * 0.75, s * 0.50, s * 0.20);
    ctx.quadraticCurveTo(0, s * 0.55, -s * 0.50, s * 0.20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Teeth line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, s * 0.27);
    ctx.quadraticCurveTo(0, s * 0.55, s * 0.45, s * 0.27);
    ctx.stroke();
    // Vertical teeth ticks
    for (let i = -3; i <= 3; i++) {
      ctx.strokeStyle = '#0e0e0e';
      ctx.lineWidth = 1;
      const tx = i * s * 0.10;
      ctx.beginPath();
      ctx.moveTo(tx, s * 0.27 + Math.abs(i) * 0.01 * s);
      ctx.lineTo(tx, s * 0.40);
      ctx.stroke();
    }

    // Question mark scar on cheek
    ctx.fillStyle = '#a855f7';
    ctx.font = `bold ${Math.max(8, s * 0.30)}px "Syne", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('?', s * 0.55, -s * 0.25);
    ctx.textAlign = 'left';
  }

  // -------------------------------------------------------
  // b063 — 12 ADDITIONAL OVERRIDE DRAWERS
  // -------------------------------------------------------

  function drawThunderbird(c, light, dark, wingT) {
    // Classic Ford Thunderbird — convertible side profile
    const s = c.size;
    const cruise = Math.sin(wingT * 1.2) * 0.02;
    ctx.save(); ctx.rotate(cruise);
    // Body — long sleek profile, cherry red
    ctx.fillStyle = '#cc2020'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.90, s * 0.10);
    ctx.lineTo(-s * 0.85, -s * 0.10);
    ctx.quadraticCurveTo(-s * 0.70, -s * 0.25, -s * 0.40, -s * 0.28);
    ctx.lineTo(s * 0.15, -s * 0.28);
    ctx.quadraticCurveTo(s * 0.45, -s * 0.28, s * 0.65, -s * 0.15);
    ctx.lineTo(s * 0.90, -s * 0.05);
    ctx.lineTo(s * 0.90, s * 0.15);
    ctx.lineTo(-s * 0.90, s * 0.15);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Windshield
    ctx.fillStyle = 'rgba(74,216,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.10, -s * 0.28);
    ctx.lineTo(-s * 0.20, -s * 0.48);
    ctx.lineTo(s * 0.10, -s * 0.48);
    ctx.lineTo(s * 0.15, -s * 0.28);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Chrome trim line
    ctx.strokeStyle = '#c0c0c0'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, s * 0.02);
    ctx.lineTo(s * 0.85, s * 0.02);
    ctx.stroke();
    // Front bumper / chrome
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(-s * 0.92, s * 0.05, s * 0.08, s * 0.10);
    // Rear fin — the classic T-bird detail
    ctx.fillStyle = '#cc2020'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s * 0.75, -s * 0.15);
    ctx.lineTo(s * 0.90, -s * 0.25);
    ctx.lineTo(s * 0.90, -s * 0.05);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Headlight
    const glow = (Math.sin(wingT * 3) + 1) * 0.3 + 0.4;
    ctx.fillStyle = `rgba(255,230,100,${glow})`;
    ctx.beginPath(); ctx.arc(-s * 0.88, s * 0.00, s * 0.05, 0, Math.PI * 2); ctx.fill();
    // Taillight
    ctx.fillStyle = '#ff2a4a';
    ctx.beginPath(); ctx.arc(s * 0.88, s * 0.02, s * 0.04, 0, Math.PI * 2); ctx.fill();
    // Front wheel
    ctx.fillStyle = '#1a1a1a'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-s * 0.55, s * 0.22, s * 0.14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c0c0c0';
    ctx.beginPath(); ctx.arc(-s * 0.55, s * 0.22, s * 0.06, 0, Math.PI * 2); ctx.fill();
    // Rear wheel
    ctx.fillStyle = '#1a1a1a'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s * 0.55, s * 0.22, s * 0.14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c0c0c0';
    ctx.beginPath(); ctx.arc(s * 0.55, s * 0.22, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawSun(c, light, dark, wingT) {
    // Bright yellow sun with rotating rays + smile
    const s = c.size;

    // Rays — rotating triangle spikes
    ctx.save();
    ctx.rotate(wingT * 0.4);
    ctx.fillStyle = '#ffe833';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.10) * s * 0.75, Math.sin(a - 0.10) * s * 0.75);
      ctx.lineTo(Math.cos(a)        * s * 1.10, Math.sin(a)        * s * 1.10);
      ctx.lineTo(Math.cos(a + 0.10) * s * 0.75, Math.sin(a + 0.10) * s * 0.75);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();

    // Sun body
    ctx.fillStyle = '#ffe833';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.70, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Inner glow ring
    ctx.fillStyle = '#fff5b8';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(-s * 0.22, -s * 0.10, s * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( s * 0.22, -s * 0.10, s * 0.07, 0, Math.PI * 2); ctx.fill();

    // Smile
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, s * 0.05, s * 0.22, 0.1, Math.PI - 0.1);
    ctx.stroke();
    // Tongue dab
    ctx.fillStyle = '#ff5cf2';
    ctx.beginPath();
    ctx.arc(s * 0.05, s * 0.22, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGrenade(c, light, dark, wingT) {
    // Pineapple-style grenade — ridged green ball + lever + pin
    const s = c.size;
    const pulse = Math.sin(wingT * 3) > 0;

    // Body
    ctx.fillStyle = '#1a8a00';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.10, s * 0.65, s * 0.75, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Pineapple grid
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) {
      const y = s * (0.10 + i * 0.20);
      ctx.beginPath();
      ctx.moveTo(-s * 0.65, y);
      ctx.quadraticCurveTo(0, y + s * 0.05, s * 0.65, y);
      ctx.stroke();
    }
    for (let i = -2; i <= 2; i++) {
      const x = s * (i * 0.22);
      ctx.beginPath();
      ctx.moveTo(x, -s * 0.55);
      ctx.lineTo(x, s * 0.85);
      ctx.stroke();
    }

    // Top neck
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(-s * 0.18, -s * 0.75, s * 0.36, s * 0.15);
    ctx.strokeRect(-s * 0.18, -s * 0.75, s * 0.36, s * 0.15);

    // Lever (safety lever curving over the top)
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-s * 0.18, -s * 0.65);
    ctx.quadraticCurveTo(s * 0.30, -s * 0.95, s * 0.40, -s * 0.50);
    ctx.stroke();

    // Pin ring — pulsing red
    ctx.strokeStyle = pulse ? '#ff2a4a' : '#cc1a3a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s * 0.50, -s * 0.85, s * 0.18, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawBoombox(c, light, dark, wingT) {
    // Retro 80s boombox — body, two speakers, antenna, tape deck
    const s = c.size;
    const w = s * 1.50, h = s * 0.95;
    const conePulse = (Math.sin(wingT * 6) + 1) * 0.5;

    // Antenna
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.50, -h * 0.55);
    ctx.lineTo(-s * 0.85, -h * 1.30);
    ctx.stroke();
    ctx.fillStyle = '#cccccc';
    ctx.beginPath();
    ctx.arc(-s * 0.85, -h * 1.30, s * 0.05, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Body
    ctx.fillStyle = '#3a3a3a';
    ctx.lineWidth = 2.5;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // Top handle
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -h / 2, s * 0.30, Math.PI, 0);
    ctx.stroke();

    // Two big speakers
    for (const sx of [-w * 0.30, w * 0.30]) {
      ctx.fillStyle = '#0e0e0e';
      ctx.beginPath();
      ctx.arc(sx, 0, s * 0.34, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // Cone
      ctx.fillStyle = '#cccccc';
      ctx.beginPath();
      ctx.arc(sx, 0, s * 0.20 + conePulse * s * 0.04, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // Center dot
      ctx.fillStyle = '#0e0e0e';
      ctx.beginPath();
      ctx.arc(sx, 0, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center tape deck
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-s * 0.25, -h * 0.32, s * 0.50, h * 0.30);
    ctx.strokeRect(-s * 0.25, -h * 0.32, s * 0.50, h * 0.30);
    // Tape reels
    ctx.fillStyle = '#cccccc';
    ctx.beginPath(); ctx.arc(-s * 0.10, -h * 0.17, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( s * 0.10, -h * 0.17, s * 0.06, 0, Math.PI * 2); ctx.fill();

    // Buttons row
    ctx.fillStyle = '#9cff3a';
    ctx.fillRect(-s * 0.50, h * 0.20, s * 0.10, s * 0.08);
    ctx.fillStyle = '#ff5cf2';
    ctx.fillRect(-s * 0.30, h * 0.20, s * 0.10, s * 0.08);
    ctx.fillStyle = '#4ad8ff';
    ctx.fillRect(-s * 0.10, h * 0.20, s * 0.10, s * 0.08);
    ctx.fillStyle = '#ffe833';
    ctx.fillRect( s * 0.10, h * 0.20, s * 0.10, s * 0.08);
  }

  function drawLemon(c, light, dark, wingT) {
    // Bright yellow lemon w/ leaf + sheen
    const s = c.size;

    // Body — pointed both ends
    ctx.fillStyle = '#ffe833';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.55, s * 0.85, -0.3, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Pointy nubs
    ctx.fillStyle = '#ffe833';
    ctx.beginPath();
    ctx.moveTo(s * 0.55, -s * 0.45);
    ctx.lineTo(s * 0.85, -s * 0.70);
    ctx.lineTo(s * 0.55, -s * 0.65);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, s * 0.45);
    ctx.lineTo(-s * 0.85, s * 0.70);
    ctx.lineTo(-s * 0.55, s * 0.65);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Skin texture dots
    ctx.fillStyle = '#a86b00';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * s * 0.35, Math.sin(a) * s * 0.55, s * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sheen
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.18, -s * 0.30, s * 0.18, s * 0.10, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Leaf at top
    ctx.fillStyle = '#1a8a00';
    ctx.beginPath();
    ctx.moveTo(s * 0.55, -s * 0.65);
    ctx.quadraticCurveTo(s * 0.85, -s * 1.00, s * 0.30, -s * 0.95);
    ctx.quadraticCurveTo(s * 0.40, -s * 0.75, s * 0.55, -s * 0.65);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s * 0.55, -s * 0.65);
    ctx.quadraticCurveTo(s * 0.55, -s * 0.85, s * 0.42, -s * 0.92);
    ctx.stroke();
  }

  function drawBeachhut(c, light, dark, wingT) {
    // Tropical beach hut — thatched roof, wood walls, palm leaning
    const s = c.size;
    const palmSway = Math.sin(wingT * 1.5) * 0.10;

    // Sand mound
    ctx.fillStyle = '#f5d490';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.85, s * 1.00, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hut walls
    ctx.fillStyle = '#a86b00';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.fillRect(-s * 0.50, -s * 0.10, s * 1.00, s * 0.85);
    ctx.strokeRect(-s * 0.50, -s * 0.10, s * 1.00, s * 0.85);

    // Wood plank lines
    ctx.strokeStyle = '#5a3a08';
    ctx.lineWidth = 1.2;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.50, -s * 0.10 + i * s * 0.21);
      ctx.lineTo( s * 0.50, -s * 0.10 + i * s * 0.21);
      ctx.stroke();
    }

    // Door
    ctx.fillStyle = '#3a1a08';
    ctx.fillRect(-s * 0.15, s * 0.20, s * 0.30, s * 0.55);
    ctx.strokeStyle = '#0e0e0e';
    ctx.strokeRect(-s * 0.15, s * 0.20, s * 0.30, s * 0.55);
    // Door knob
    ctx.fillStyle = '#ffe833';
    ctx.beginPath();
    ctx.arc(s * 0.08, s * 0.45, s * 0.03, 0, Math.PI * 2);
    ctx.fill();

    // Window
    ctx.fillStyle = '#4ad8ff';
    ctx.fillRect(s * 0.20, s * 0.05, s * 0.22, s * 0.18);
    ctx.strokeRect(s * 0.20, s * 0.05, s * 0.22, s * 0.18);
    ctx.beginPath();
    ctx.moveTo(s * 0.31, s * 0.05);
    ctx.lineTo(s * 0.31, s * 0.23);
    ctx.moveTo(s * 0.20, s * 0.14);
    ctx.lineTo(s * 0.42, s * 0.14);
    ctx.stroke();

    // Thatched roof — triangle
    ctx.fillStyle = '#c2913a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.65, -s * 0.10);
    ctx.lineTo(0, -s * 0.65);
    ctx.lineTo( s * 0.65, -s * 0.10);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Thatch lines
    ctx.strokeStyle = '#5a3a08';
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.50 + i * s * 0.15, -s * 0.10);
      ctx.lineTo(-s * 0.20 + i * s * 0.10, -s * 0.40);
      ctx.stroke();
    }

    // Palm leaning to the side
    ctx.save();
    ctx.translate(-s * 0.85, s * 0.40);
    ctx.rotate(palmSway - 0.20);
    ctx.fillStyle = '#5a3a08';
    ctx.fillRect(-s * 0.05, -s * 1.10, s * 0.10, s * 1.10);
    // Fronds
    ctx.fillStyle = '#1a8a00';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.10);
      ctx.quadraticCurveTo(Math.cos(a) * s * 0.40, -s * 1.20 + Math.sin(a) * s * 0.10, Math.cos(a) * s * 0.65, -s * 1.05 + Math.sin(a) * s * 0.20);
      ctx.lineTo(Math.cos(a) * s * 0.55, -s * 1.00 + Math.sin(a) * s * 0.18);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawSkull(c, light, dark, wingT) {
    // Cute pixel skull with glowing eye sockets
    const s = c.size;
    const glow = (Math.sin(wingT * 2.5) + 1) * 0.5;

    // Cranium
    ctx.fillStyle = '#f5ecd8';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -s * 0.10, s * 0.75, Math.PI * 1.05, Math.PI * 1.95);
    ctx.lineTo(s * 0.55, s * 0.20);
    ctx.lineTo(s * 0.55, s * 0.45);
    ctx.lineTo(-s * 0.55, s * 0.45);
    ctx.lineTo(-s * 0.55, s * 0.20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Eye sockets — glowing magenta
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.ellipse(-s * 0.28, -s * 0.10, s * 0.18, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse( s * 0.28, -s * 0.10, s * 0.18, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5cf2';
    ctx.globalAlpha = 0.5 + glow * 0.5;
    ctx.beginPath();
    ctx.arc(-s * 0.28, -s * 0.10, s * 0.10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc( s * 0.28, -s * 0.10, s * 0.10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Nose triangle
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.moveTo(0, s * 0.05);
    ctx.lineTo(-s * 0.06, s * 0.20);
    ctx.lineTo( s * 0.06, s * 0.20);
    ctx.closePath();
    ctx.fill();

    // Teeth row
    ctx.fillStyle = '#f5ecd8';
    ctx.fillRect(-s * 0.40, s * 0.30, s * 0.80, s * 0.15);
    ctx.strokeRect(-s * 0.40, s * 0.30, s * 0.80, s * 0.15);
    // Tooth dividers
    ctx.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s * 0.16, s * 0.30);
      ctx.lineTo(i * s * 0.16, s * 0.45);
      ctx.stroke();
    }
  }

  function drawRoadsign(c, light, dark, wingT) {
    // Yellow diamond highway road sign on a post
    const s = c.size;

    // Post
    ctx.fillStyle = '#888888';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.fillRect(-s * 0.05, s * 0.10, s * 0.10, s * 0.95);
    ctx.strokeRect(-s * 0.05, s * 0.10, s * 0.10, s * 0.95);

    // Diamond sign
    ctx.fillStyle = '#ffe833';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.95);
    ctx.lineTo( s * 0.85, -s * 0.10);
    ctx.lineTo(0, s * 0.75);
    ctx.lineTo(-s * 0.85, -s * 0.10);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Inner border
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.78);
    ctx.lineTo( s * 0.68, -s * 0.10);
    ctx.lineTo(0, s * 0.58);
    ctx.lineTo(-s * 0.68, -s * 0.10);
    ctx.closePath();
    ctx.stroke();

    // Text "10 MI"
    ctx.fillStyle = '#0e0e0e';
    ctx.font = `900 ${Math.max(8, s * 0.25)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('10', 0, -s * 0.30);
    ctx.font = `900 ${Math.max(6, s * 0.18)}px "JetBrains Mono", monospace`;
    ctx.fillText('MILES', 0, -s * 0.05);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Arrow underneath
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.moveTo(-s * 0.30, s * 0.20);
    ctx.lineTo( s * 0.20, s * 0.20);
    ctx.lineTo( s * 0.20, s * 0.10);
    ctx.lineTo( s * 0.40, s * 0.25);
    ctx.lineTo( s * 0.20, s * 0.40);
    ctx.lineTo( s * 0.20, s * 0.30);
    ctx.lineTo(-s * 0.30, s * 0.30);
    ctx.closePath();
    ctx.fill();
  }

  function drawCashstack(c, light, dark, wingT) {
    // Stack of green dollar bills with $ on top
    const s = c.size;
    const wob = Math.sin(wingT * 1.8) * 0.04;

    // Stack of bills (drawn back to front)
    for (let i = 4; i >= 0; i--) {
      const oy = -i * s * 0.08;
      const ox = i * s * 0.04;
      ctx.fillStyle = i === 0 ? '#1a8a00' : '#2a9a10';
      ctx.strokeStyle = '#0e0e0e';
      ctx.lineWidth = 2;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(wob - i * 0.02);
      ctx.fillRect(-s * 0.85, -s * 0.30, s * 1.70, s * 0.60);
      ctx.strokeRect(-s * 0.85, -s * 0.30, s * 1.70, s * 0.60);
      ctx.restore();
    }

    // Top bill detail — center oval + $ sign
    ctx.save();
    ctx.translate(s * 0.16, -s * 0.32);
    ctx.fillStyle = '#1a8a00';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.fillRect(-s * 0.85, -s * 0.30, s * 1.70, s * 0.60);
    ctx.strokeRect(-s * 0.85, -s * 0.30, s * 1.70, s * 0.60);
    // Inner border
    ctx.strokeStyle = '#0aff9c';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-s * 0.78, -s * 0.24, s * 1.56, s * 0.48);
    // Center oval portrait area
    ctx.fillStyle = '#f5ecd8';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.22, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0e0e0e';
    ctx.stroke();
    // $ sign
    ctx.fillStyle = '#0e0e0e';
    ctx.font = `900 ${Math.max(10, s * 0.36)}px "Syne", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 0);
    // Corner numbers
    ctx.font = `900 ${Math.max(7, s * 0.18)}px "JetBrains Mono", monospace`;
    ctx.fillText('100', -s * 0.60, -s * 0.10);
    ctx.fillText('100',  s * 0.60,  s * 0.12);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  function drawCake(c, light, dark, wingT) {
    // Layered birthday cake with frosting + candles + flames
    const s = c.size;
    const flameFlicker = Math.sin(wingT * 12) * 0.10 + 1;

    // Plate
    ctx.fillStyle = '#cccccc';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.85, s * 1.00, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Bottom layer — hot pink
    ctx.fillStyle = '#ff5cf2';
    ctx.fillRect(-s * 0.85, s * 0.35, s * 1.70, s * 0.50);
    ctx.strokeRect(-s * 0.85, s * 0.35, s * 1.70, s * 0.50);

    // Middle layer — cream
    ctx.fillStyle = '#f5ecd8';
    ctx.fillRect(-s * 0.65, -s * 0.05, s * 1.30, s * 0.40);
    ctx.strokeRect(-s * 0.65, -s * 0.05, s * 1.30, s * 0.40);

    // Top layer — cyan
    ctx.fillStyle = '#4ad8ff';
    ctx.fillRect(-s * 0.45, -s * 0.40, s * 0.90, s * 0.35);
    ctx.strokeRect(-s * 0.45, -s * 0.40, s * 0.90, s * 0.35);

    // Frosting drips on each layer
    ctx.fillStyle = '#ffffff';
    for (let i = -4; i <= 4; i++) {
      const x = i * s * 0.18;
      ctx.beginPath();
      ctx.arc(x, s * 0.40, s * 0.06, 0, Math.PI);
      ctx.fill();
    }
    for (let i = -3; i <= 3; i++) {
      const x = i * s * 0.18;
      ctx.beginPath();
      ctx.arc(x, 0, s * 0.05, 0, Math.PI);
      ctx.fill();
    }

    // Sprinkles on the bottom layer
    const sprinkles = [
      ['#9cff3a', -0.55, 0.55],
      ['#ffe833', -0.20, 0.65],
      ['#4ad8ff',  0.10, 0.55],
      ['#ff5cf2',  0.40, 0.70],
      ['#ffffff', -0.40, 0.70],
    ];
    for (const [col, sx, sy] of sprinkles) {
      ctx.fillStyle = col;
      ctx.fillRect(s * sx, s * sy, s * 0.05, s * 0.10);
    }

    // 3 candles on top layer
    for (let i = -1; i <= 1; i++) {
      const cx = i * s * 0.22;
      ctx.fillStyle = '#ff2a4a';
      ctx.fillRect(cx - s * 0.04, -s * 0.65, s * 0.08, s * 0.25);
      ctx.strokeStyle = '#0e0e0e';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - s * 0.04, -s * 0.65, s * 0.08, s * 0.25);
      // Wick
      ctx.beginPath();
      ctx.moveTo(cx, -s * 0.65);
      ctx.lineTo(cx, -s * 0.72);
      ctx.stroke();
      // Flame
      ctx.fillStyle = '#ffe833';
      ctx.beginPath();
      ctx.ellipse(cx, -s * 0.78 * flameFlicker, s * 0.05, s * 0.10 * flameFlicker, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff7a1a';
      ctx.beginPath();
      ctx.ellipse(cx, -s * 0.74 * flameFlicker, s * 0.03, s * 0.06 * flameFlicker, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWallet(c, light, dark, wingT) {
    // Brown leather bifold wallet with cards + cash sticking out
    const s = c.size;
    const wobble = Math.sin(wingT * 2) * 0.02;

    ctx.save();
    ctx.rotate(wobble);

    // Body
    ctx.fillStyle = '#5a3a08';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2.5;
    ctx.fillRect(-s * 0.85, -s * 0.55, s * 1.70, s * 1.10);
    ctx.strokeRect(-s * 0.85, -s * 0.55, s * 1.70, s * 1.10);

    // Center fold line
    ctx.strokeStyle = '#3a1a08';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.55);
    ctx.lineTo(0, s * 0.55);
    ctx.stroke();

    // Stitching dashes around the perimeter
    ctx.strokeStyle = '#a86b00';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(-s * 0.78, -s * 0.48, s * 1.56, s * 0.96);
    ctx.setLineDash([]);

    // Cash sticking out the top
    ctx.fillStyle = '#1a8a00';
    ctx.fillRect(-s * 0.55, -s * 0.78, s * 1.10, s * 0.30);
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-s * 0.55, -s * 0.78, s * 1.10, s * 0.30);
    // $ on the cash
    ctx.fillStyle = '#0aff9c';
    ctx.font = `900 ${Math.max(8, s * 0.20)}px "Syne", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, -s * 0.63);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Card peeking from right pocket
    ctx.fillStyle = '#4ad8ff';
    ctx.fillRect(s * 0.20, -s * 0.20, s * 0.55, s * 0.18);
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(s * 0.20, -s * 0.20, s * 0.55, s * 0.18);
    // Card stripe
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(s * 0.22, -s * 0.16, s * 0.50, s * 0.03);

    // Embossed initial circle on the left flap
    ctx.fillStyle = '#a86b00';
    ctx.beginPath();
    ctx.arc(-s * 0.45, s * 0.05, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#5a3a08';
    ctx.font = `900 ${Math.max(7, s * 0.20)}px "Syne", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('K', -s * 0.45, s * 0.05);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.restore();
  }

  function drawLotusflower(c, light, dark, wingT) {
    // Pink lotus water lily with layered petals + center
    const s = c.size;

    // Outer petal ring (5 large petals)
    ctx.save();
    ctx.rotate(wingT * 0.1);
    ctx.fillStyle = '#ff5cf2';
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-s * 0.30, -s * 0.55, 0, -s * 1.00);
      ctx.quadraticCurveTo( s * 0.30, -s * 0.55, 0, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // Mid petal ring (5 smaller petals, offset)
    ctx.save();
    ctx.rotate(wingT * 0.1 + Math.PI / 5);
    ctx.fillStyle = '#f5d4e8';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-s * 0.22, -s * 0.40, 0, -s * 0.75);
      ctx.quadraticCurveTo( s * 0.22, -s * 0.40, 0, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // Inner petal cluster (3 small petals)
    ctx.save();
    ctx.rotate(wingT * 0.1);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-s * 0.15, -s * 0.25, 0, -s * 0.45);
      ctx.quadraticCurveTo( s * 0.15, -s * 0.25, 0, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // Center stamen — yellow dot cluster
    ctx.fillStyle = '#ffe833';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0e0e0e';
    ctx.stroke();
    // 6 dots
    ctx.fillStyle = '#a86b00';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + wingT;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * s * 0.07, Math.sin(a) * s * 0.07, s * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // -------------------------------------------------------
  // b064 — 15 MORE OVERRIDE DRAWERS
  // -------------------------------------------------------

  function drawHouse(c, light, dark, wingT) {
    const s = c.size;
    // Walls
    ctx.fillStyle = '#f5ecd8';
    ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.fillRect(-s * 0.70, -s * 0.20, s * 1.40, s * 1.00);
    ctx.strokeRect(-s * 0.70, -s * 0.20, s * 1.40, s * 1.00);
    // Roof
    ctx.fillStyle = '#ff2a4a';
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, -s * 0.20);
    ctx.lineTo(0, -s * 0.85);
    ctx.lineTo(s * 0.85, -s * 0.20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Door
    ctx.fillStyle = '#5a3a08';
    ctx.fillRect(-s * 0.15, s * 0.20, s * 0.30, s * 0.60);
    ctx.strokeRect(-s * 0.15, s * 0.20, s * 0.30, s * 0.60);
    ctx.fillStyle = '#ffe833';
    ctx.beginPath(); ctx.arc(s * 0.08, s * 0.50, s * 0.03, 0, Math.PI * 2); ctx.fill();
    // Window
    ctx.fillStyle = '#4ad8ff';
    ctx.fillRect(-s * 0.55, 0, s * 0.28, s * 0.22);
    ctx.strokeRect(-s * 0.55, 0, s * 0.28, s * 0.22);
    ctx.fillRect(s * 0.27, 0, s * 0.28, s * 0.22);
    ctx.strokeRect(s * 0.27, 0, s * 0.28, s * 0.22);
    // Chimney
    ctx.fillStyle = '#888888';
    ctx.fillRect(s * 0.30, -s * 0.75, s * 0.18, s * 0.35);
    ctx.strokeRect(s * 0.30, -s * 0.75, s * 0.18, s * 0.35);
    // Smoke puff
    ctx.fillStyle = '#cccccc';
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(s * 0.39, -s * 0.85, s * 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.44, -s * 0.97, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBigheart(c, light, dark, wingT) {
    const s = c.size;
    const pulse = 1 + Math.sin(wingT * 3) * 0.08;
    ctx.save(); ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ff2a4a';
    ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.30);
    ctx.bezierCurveTo(-s * 0.05, s * 0.10, -s * 0.85, -s * 0.20, -s * 0.50, -s * 0.60);
    ctx.bezierCurveTo(-s * 0.20, -s * 0.90, 0, -s * 0.55, 0, -s * 0.30);
    ctx.bezierCurveTo(0, -s * 0.55, s * 0.20, -s * 0.90, s * 0.50, -s * 0.60);
    ctx.bezierCurveTo(s * 0.85, -s * 0.20, s * 0.05, s * 0.10, 0, s * 0.30);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Sheen
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(-s * 0.30, -s * 0.40, s * 0.15, s * 0.10, -0.5, 0, Math.PI * 2);
    ctx.fill(); ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawSpotlight(c, light, dark, wingT) {
    const s = c.size;
    const sway = Math.sin(wingT * 1.5) * 0.15;
    // Beam cone
    ctx.save(); ctx.rotate(sway);
    ctx.fillStyle = 'rgba(255,232,51,0.30)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, s * 0.20);
    ctx.lineTo(s * 0.15, s * 0.20);
    ctx.lineTo(s * 0.65, s * 1.20);
    ctx.lineTo(-s * 0.65, s * 1.20);
    ctx.closePath();
    ctx.fill();
    // Lamp housing
    ctx.fillStyle = '#3a3a3a';
    ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, s * 0.25);
    ctx.lineTo(-s * 0.20, -s * 0.10);
    ctx.lineTo(s * 0.20, -s * 0.10);
    ctx.lineTo(s * 0.35, s * 0.25);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Bulb face
    ctx.fillStyle = '#ffe833';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.08, s * 0.22, s * 0.14, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // Tripod stand
    ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.10); ctx.lineTo(0, -s * 0.65); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.65);
    ctx.lineTo(-s * 0.30, -s * 0.90); ctx.moveTo(0, -s * 0.65);
    ctx.lineTo(s * 0.30, -s * 0.90); ctx.stroke();
  }

  function drawBook(c, light, dark, wingT) {
    const s = c.size;
    // Pages (side view — stacked)
    ctx.fillStyle = '#f5ecd8';
    ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.fillRect(-s * 0.65, -s * 0.85, s * 1.20, s * 1.65);
    ctx.strokeRect(-s * 0.65, -s * 0.85, s * 1.20, s * 1.65);
    // Cover (front)
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(-s * 0.70, -s * 0.90, s * 1.20, s * 1.65);
    ctx.strokeRect(-s * 0.70, -s * 0.90, s * 1.20, s * 1.65);
    // Spine
    ctx.fillStyle = '#7e22ce';
    ctx.fillRect(-s * 0.70, -s * 0.90, s * 0.12, s * 1.65);
    ctx.strokeRect(-s * 0.70, -s * 0.90, s * 0.12, s * 1.65);
    // Title block
    ctx.fillStyle = '#ffe833';
    ctx.fillRect(-s * 0.40, -s * 0.65, s * 0.70, s * 0.25);
    ctx.font = `900 ${Math.max(6, s * 0.14)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#0e0e0e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('FINAL', -s * 0.05, -s * 0.58);
    ctx.fillText('CHAPTER', -s * 0.05, -s * 0.46);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // Star ornament
    ctx.fillStyle = '#ffe833';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? s * 0.12 : s * 0.05;
      ctx.lineTo(-s * 0.05 + Math.cos(a) * r, s * 0.10 + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  }

  function drawLightbolt(c, light, dark, wingT) {
    const s = c.size;
    const pulse = 0.7 + Math.sin(wingT * 6) * 0.3;
    // Glow behind
    ctx.fillStyle = '#ffe833'; ctx.globalAlpha = pulse * 0.3;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.95, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // Bolt shape
    ctx.fillStyle = '#ffe833'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, -s * 0.95);
    ctx.lineTo(s * 0.40, -s * 0.95);
    ctx.lineTo(s * 0.05, -s * 0.10);
    ctx.lineTo(s * 0.45, -s * 0.10);
    ctx.lineTo(-s * 0.20, s * 0.95);
    ctx.lineTo(s * 0.05, s * 0.10);
    ctx.lineTo(-s * 0.40, s * 0.10);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  function drawTrafficlight(c, light, dark, wingT) {
    const s = c.size;
    const cycle = Math.floor(wingT * 0.4) % 3;
    // Body
    ctx.fillStyle = '#1a1a1a'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.fillRect(-s * 0.35, -s * 0.85, s * 0.70, s * 1.50);
    ctx.strokeRect(-s * 0.35, -s * 0.85, s * 0.70, s * 1.50);
    // 3 lights
    const colors = ['#ff2a4a', '#ffe833', '#9cff3a'];
    for (let i = 0; i < 3; i++) {
      const y = -s * 0.60 + i * s * 0.45;
      ctx.fillStyle = cycle === i ? colors[i] : '#1a1a1a';
      ctx.beginPath(); ctx.arc(0, y, s * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#333333'; ctx.stroke();
      if (cycle === i) {
        ctx.fillStyle = colors[i]; ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.arc(0, y, s * 0.30, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    // Post
    ctx.fillStyle = '#888888';
    ctx.fillRect(-s * 0.06, s * 0.65, s * 0.12, s * 0.40);
    ctx.strokeRect(-s * 0.06, s * 0.65, s * 0.12, s * 0.40);
  }

  function drawWindmill(c, light, dark, wingT) {
    const s = c.size;
    // Tower
    ctx.fillStyle = '#f5ecd8'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.30, s * 0.90);
    ctx.lineTo(-s * 0.15, -s * 0.30);
    ctx.lineTo(s * 0.15, -s * 0.30);
    ctx.lineTo(s * 0.30, s * 0.90);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Door
    ctx.fillStyle = '#5a3a08';
    ctx.beginPath();
    ctx.arc(0, s * 0.70, s * 0.12, Math.PI, 0);
    ctx.lineTo(s * 0.12, s * 0.90);
    ctx.lineTo(-s * 0.12, s * 0.90);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Blades — rotating
    ctx.save(); ctx.translate(0, -s * 0.30); ctx.rotate(wingT * 2);
    ctx.fillStyle = '#cccccc'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.rotate((i / 4) * Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(-s * 0.06, 0);
      ctx.lineTo(-s * 0.10, -s * 0.85);
      ctx.lineTo(s * 0.10, -s * 0.85);
      ctx.lineTo(s * 0.06, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // Center hub
    ctx.fillStyle = '#888888';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawFist(c, light, dark, wingT) {
    const s = c.size;
    const pump = 1 + Math.sin(wingT * 3) * 0.05;
    ctx.save(); ctx.scale(pump, pump);
    // Wrist
    ctx.fillStyle = '#f5d490'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.fillRect(-s * 0.25, s * 0.30, s * 0.50, s * 0.40);
    ctx.strokeRect(-s * 0.25, s * 0.30, s * 0.50, s * 0.40);
    // Fist body
    ctx.fillStyle = '#f5d490';
    ctx.beginPath();
    ctx.moveTo(-s * 0.50, s * 0.30);
    ctx.quadraticCurveTo(-s * 0.55, -s * 0.10, -s * 0.45, -s * 0.30);
    ctx.lineTo(s * 0.45, -s * 0.30);
    ctx.quadraticCurveTo(s * 0.55, -s * 0.10, s * 0.50, s * 0.30);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Knuckle bumps
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(i * s * 0.22, -s * 0.30, s * 0.12, Math.PI, 0);
      ctx.fill(); ctx.stroke();
    }
    // Thumb
    ctx.beginPath();
    ctx.ellipse(-s * 0.50, s * 0.05, s * 0.12, s * 0.18, 0.3, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Finger lines
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.12 + i * s * 0.22, -s * 0.18);
      ctx.lineTo(-s * 0.12 + i * s * 0.22, s * 0.15);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShroom(c, light, dark, wingT) {
    const s = c.size;
    // Stem
    ctx.fillStyle = '#f5ecd8'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, s * 0.10);
    ctx.lineTo(-s * 0.20, s * 0.85);
    ctx.lineTo(s * 0.20, s * 0.85);
    ctx.lineTo(s * 0.25, s * 0.10);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Cap — big rainbow mushroom
    ctx.fillStyle = '#ff2a4a';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.05, s * 0.85, s * 0.60, 0, Math.PI, 0);
    ctx.lineTo(s * 0.85, -s * 0.05);
    ctx.lineTo(-s * 0.85, -s * 0.05);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Big white spots
    ctx.fillStyle = '#ffffff';
    const spots = [[-0.40, -0.25], [0.10, -0.40], [0.45, -0.20], [-0.15, -0.15]];
    for (const [dx, dy] of spots) {
      ctx.beginPath();
      ctx.arc(s * dx, s * dy, s * 0.12, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    // Eyes (cute)
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(-s * 0.12, s * 0.30, s * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.12, s * 0.30, s * 0.04, 0, Math.PI * 2); ctx.fill();
    // Smile
    ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, s * 0.38, s * 0.08, 0.1, Math.PI - 0.1); ctx.stroke();
  }

  function drawSneaker(c, light, dark, wingT) {
    const s = c.size;
    // Sole
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, s * 0.45);
    ctx.lineTo(s * 0.95, s * 0.45);
    ctx.lineTo(s * 0.95, s * 0.30);
    ctx.lineTo(-s * 0.85, s * 0.30);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Body
    ctx.fillStyle = '#4ad8ff';
    ctx.beginPath();
    ctx.moveTo(-s * 0.80, s * 0.30);
    ctx.lineTo(-s * 0.80, -s * 0.10);
    ctx.quadraticCurveTo(-s * 0.30, -s * 0.35, s * 0.20, -s * 0.25);
    ctx.lineTo(s * 0.90, -s * 0.05);
    ctx.lineTo(s * 0.95, s * 0.30);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Toe box
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(s * 0.30, s * 0.30);
    ctx.lineTo(s * 0.45, -s * 0.15);
    ctx.lineTo(s * 0.95, s * 0.05);
    ctx.lineTo(s * 0.95, s * 0.30);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Laces
    ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const x = -s * 0.40 + i * s * 0.22;
      ctx.beginPath();
      ctx.moveTo(x, -s * 0.05);
      ctx.lineTo(x + s * 0.10, -s * 0.20);
      ctx.stroke();
    }
    // Nike-ish swoosh
    ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-s * 0.65, s * 0.25);
    ctx.quadraticCurveTo(s * 0.10, s * 0.35, s * 0.60, -s * 0.10);
    ctx.stroke();
  }

  function drawShoebox(c, light, dark, wingT) {
    const s = c.size;
    // Box body
    ctx.fillStyle = '#ff7a1a'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.fillRect(-s * 0.85, -s * 0.25, s * 1.70, s * 0.90);
    ctx.strokeRect(-s * 0.85, -s * 0.25, s * 1.70, s * 0.90);
    // Lid (angled open)
    ctx.fillStyle = '#ff9a4a';
    ctx.beginPath();
    ctx.moveTo(-s * 0.90, -s * 0.25);
    ctx.lineTo(-s * 0.75, -s * 0.65);
    ctx.lineTo(s * 0.95, -s * 0.65);
    ctx.lineTo(s * 0.90, -s * 0.25);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Label on front
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-s * 0.40, s * 0.05, s * 0.80, s * 0.30);
    ctx.strokeRect(-s * 0.40, s * 0.05, s * 0.80, s * 0.30);
    ctx.fillStyle = '#0e0e0e';
    ctx.font = `900 ${Math.max(6, s * 0.14)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('SIZE 10', 0, s * 0.13);
    ctx.fillText('KANI', 0, s * 0.27);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // Tissue paper sticking out
    ctx.fillStyle = '#f5ecd8'; ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(-s * 0.30, -s * 0.25);
    ctx.quadraticCurveTo(0, -s * 0.50, s * 0.30, -s * 0.25);
    ctx.closePath();
    ctx.fill(); ctx.globalAlpha = 1;
  }

  function drawTwohearts(c, light, dark, wingT) {
    const s = c.size;
    const offset = Math.sin(wingT * 2) * s * 0.05;
    // Heart helper
    function heart(hx, hy, hs, col) {
      ctx.fillStyle = col; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx, hy + hs * 0.30);
      ctx.bezierCurveTo(hx - hs * 0.05, hy + hs * 0.10, hx - hs * 0.85, hy - hs * 0.20, hx - hs * 0.50, hy - hs * 0.60);
      ctx.bezierCurveTo(hx - hs * 0.20, hy - hs * 0.90, hx, hy - hs * 0.55, hx, hy - hs * 0.30);
      ctx.bezierCurveTo(hx, hy - hs * 0.55, hx + hs * 0.20, hy - hs * 0.90, hx + hs * 0.50, hy - hs * 0.60);
      ctx.bezierCurveTo(hx + hs * 0.85, hy - hs * 0.20, hx + hs * 0.05, hy + hs * 0.10, hx, hy + hs * 0.30);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    heart(-s * 0.25 - offset, s * 0.05, s * 0.70, '#ff5cf2');
    heart(s * 0.25 + offset, -s * 0.05, s * 0.70, '#ff2a4a');
  }

  function drawVinyldisc(c, light, dark, wingT) {
    const s = c.size;
    ctx.save(); ctx.rotate(wingT * 1.5);
    // Disc
    ctx.fillStyle = '#0e0e0e'; ctx.strokeStyle = '#333333'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Grooves
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
    for (let r = 0.30; r < 0.85; r += 0.10) {
      ctx.beginPath(); ctx.arc(0, 0, s * r, 0, Math.PI * 2); ctx.stroke();
    }
    // Label center
    ctx.fillStyle = '#ff5cf2';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 1.5; ctx.stroke();
    // Label text
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.max(5, s * 0.12)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('KANI', 0, -s * 0.06);
    ctx.fillText('MIX', 0, s * 0.08);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // Spindle hole
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawGuitarpick(c, light, dark, wingT) {
    const s = c.size;
    const wobble = Math.sin(wingT * 2) * 0.08;
    ctx.save(); ctx.rotate(wobble);
    // Pick body — rounded triangle
    ctx.fillStyle = '#0e0e0e'; ctx.strokeStyle = '#333333'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.90);
    ctx.quadraticCurveTo(-s * 0.80, -s * 0.10, -s * 0.55, -s * 0.65);
    ctx.quadraticCurveTo(0, -s * 0.95, s * 0.55, -s * 0.65);
    ctx.quadraticCurveTo(s * 0.80, -s * 0.10, 0, s * 0.90);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Inner design — lightning bolt
    ctx.fillStyle = '#ffe833';
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 0.50);
    ctx.lineTo(s * 0.15, -s * 0.50);
    ctx.lineTo(s * 0.02, -s * 0.08);
    ctx.lineTo(s * 0.18, -s * 0.08);
    ctx.lineTo(-s * 0.08, s * 0.50);
    ctx.lineTo(s * 0.02, s * 0.05);
    ctx.lineTo(-s * 0.15, s * 0.05);
    ctx.closePath();
    ctx.fill();
    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.max(5, s * 0.12)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('EMO', 0, -s * 0.68);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  function drawCrown(c, light, dark, wingT) {
    const s = c.size;
    const glint = (Math.sin(wingT * 4) + 1) * 0.5;
    // Crown body
    ctx.fillStyle = '#ffe833'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.80, s * 0.40);
    ctx.lineTo(-s * 0.80, -s * 0.10);
    ctx.lineTo(-s * 0.50, -s * 0.55);
    ctx.lineTo(-s * 0.20, -s * 0.10);
    ctx.lineTo(0, -s * 0.65);
    ctx.lineTo(s * 0.20, -s * 0.10);
    ctx.lineTo(s * 0.50, -s * 0.55);
    ctx.lineTo(s * 0.80, -s * 0.10);
    ctx.lineTo(s * 0.80, s * 0.40);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Base band
    ctx.fillStyle = '#a86b00';
    ctx.fillRect(-s * 0.80, s * 0.20, s * 1.60, s * 0.20);
    ctx.strokeRect(-s * 0.80, s * 0.20, s * 1.60, s * 0.20);
    // 3 jewels on the band
    const jewels = [['#ff2a4a', -s * 0.40], ['#4ad8ff', 0], ['#9cff3a', s * 0.40]];
    for (const [jc, jx] of jewels) {
      ctx.fillStyle = jc;
      ctx.beginPath();
      ctx.moveTo(jx, s * 0.22);
      ctx.lineTo(jx + s * 0.08, s * 0.30);
      ctx.lineTo(jx, s * 0.38);
      ctx.lineTo(jx - s * 0.08, s * 0.30);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    // Tip jewels
    const tips = [[-s * 0.50, -s * 0.55], [0, -s * 0.65], [s * 0.50, -s * 0.55]];
    for (const [tx, ty] of tips) {
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.5 + glint * 0.5;
      ctx.beginPath(); ctx.arc(tx, ty, s * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // b066 — 10 more hero icons --------------------------------

  function drawBluntwrap(c, light, dark, wingT) {
    const s = c.size;
    const curl = Math.sin(wingT * 1.5) * 0.04;
    ctx.save(); ctx.rotate(curl);
    // Outer leaf wrap
    ctx.fillStyle = '#7a4a1a'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, -s * 0.18);
    ctx.quadraticCurveTo(-s * 0.95, 0, -s * 0.85, s * 0.18);
    ctx.lineTo(s * 0.75, s * 0.18);
    ctx.quadraticCurveTo(s * 0.95, 0, s * 0.75, -s * 0.18);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Inner tobacco texture lines
    ctx.strokeStyle = '#5a3210'; ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      const lx = i * s * 0.18;
      ctx.beginPath();
      ctx.moveTo(lx, -s * 0.14);
      ctx.lineTo(lx + s * 0.06, s * 0.14);
      ctx.stroke();
    }
    // Burnt/lit tip — orange glow
    const glow = (Math.sin(wingT * 3) + 1) * 0.3 + 0.4;
    ctx.fillStyle = `rgba(255,120,20,${glow})`;
    ctx.beginPath();
    ctx.ellipse(s * 0.82, 0, s * 0.12, s * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff4400';
    ctx.beginPath();
    ctx.ellipse(s * 0.82, 0, s * 0.07, s * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    // Smoke wisps
    ctx.strokeStyle = 'rgba(200,200,200,0.35)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const sx = s * 0.90 + i * s * 0.08;
      const sy = -s * 0.10 - i * s * 0.20;
      const wave = Math.sin(wingT * 2 + i * 1.5) * s * 0.10;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.quadraticCurveTo(sx + wave, sy * 0.5, sx - wave * 0.5, sy);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBeehive(c, light, dark, wingT) {
    const s = c.size;
    // Big beehive hair shape
    ctx.fillStyle = '#1a1a1a'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, s * 0.45);
    ctx.quadraticCurveTo(-s * 0.70, s * 0.10, -s * 0.55, -s * 0.25);
    ctx.quadraticCurveTo(-s * 0.45, -s * 0.85, 0, -s * 0.90);
    ctx.quadraticCurveTo(s * 0.45, -s * 0.85, s * 0.55, -s * 0.25);
    ctx.quadraticCurveTo(s * 0.70, s * 0.10, s * 0.55, s * 0.45);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Horizontal texture lines across the beehive
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const ly = -s * 0.60 + i * s * 0.22;
      const w = s * (0.30 + i * 0.06);
      ctx.beginPath();
      ctx.moveTo(-w, ly);
      ctx.quadraticCurveTo(0, ly + s * 0.04, w, ly);
      ctx.stroke();
    }
    // Smoke wisps curling off
    ctx.strokeStyle = 'rgba(180,180,180,0.30)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
      const ox = s * (0.25 + i * 0.20);
      const wave = Math.sin(wingT * 2 + i * 2) * s * 0.12;
      ctx.beginPath();
      ctx.moveTo(ox, -s * 0.50 - i * s * 0.15);
      ctx.quadraticCurveTo(ox + wave, -s * 0.75, ox - wave, -s * 1.00);
      ctx.stroke();
    }
    // Eyeliner eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(-s * 0.18, s * 0.20, s * 0.10, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.18, s * 0.20, s * 0.10, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(-s * 0.18, s * 0.20, s * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.18, s * 0.20, s * 0.04, 0, Math.PI * 2); ctx.fill();
    // Winged eyeliner flick
    ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-s * 0.28, s * 0.18); ctx.lineTo(-s * 0.35, s * 0.12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.28, s * 0.18); ctx.lineTo(s * 0.35, s * 0.12); ctx.stroke();
    // Beauty mark
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(s * 0.25, s * 0.35, s * 0.025, 0, Math.PI * 2); ctx.fill();
  }

  function drawGalaxy(c, light, dark, wingT) {
    const s = c.size;
    ctx.save(); ctx.rotate(wingT * 0.3);
    // Outer glow
    const grad = ctx.createRadialGradient(0, 0, s * 0.05, 0, 0, s * 0.85);
    grad.addColorStop(0, 'rgba(168,85,247,0.6)');
    grad.addColorStop(0.4, 'rgba(74,216,255,0.25)');
    grad.addColorStop(1, 'rgba(74,216,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2); ctx.fill();
    // Spiral arms
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2.5;
    for (let arm = 0; arm < 2; arm++) {
      ctx.beginPath();
      for (let t = 0; t < 3.5; t += 0.1) {
        const r = s * 0.08 + t * s * 0.18;
        const a = t * 1.2 + arm * Math.PI;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r * 0.45; // flatten to disc
        if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // Bright core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe833';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.07, 0, Math.PI * 2); ctx.fill();
    // Scatter stars
    ctx.fillStyle = '#ffffff';
    const stars = [[-0.5, -0.15], [0.4, 0.20], [-0.3, 0.25], [0.55, -0.10], [0.1, -0.30], [-0.6, 0.05]];
    for (const [dx, dy] of stars) {
      ctx.beginPath(); ctx.arc(s * dx, s * dy, s * 0.02, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawAkira(c, light, dark, wingT) {
    const s = c.size;
    const lean = Math.sin(wingT * 1.2) * 0.05;
    ctx.save(); ctx.rotate(lean);
    // Body — red motorcycle
    ctx.fillStyle = '#e02020'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.80, s * 0.05);
    ctx.quadraticCurveTo(-s * 0.60, -s * 0.50, -s * 0.15, -s * 0.45);
    ctx.lineTo(s * 0.25, -s * 0.40);
    ctx.quadraticCurveTo(s * 0.70, -s * 0.35, s * 0.85, s * 0.05);
    ctx.lineTo(s * 0.85, s * 0.20);
    ctx.lineTo(-s * 0.80, s * 0.20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Front wheel
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(-s * 0.55, s * 0.35, s * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(-s * 0.55, s * 0.35, s * 0.10, 0, Math.PI * 2); ctx.fill();
    // Rear wheel
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(s * 0.60, s * 0.35, s * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(s * 0.60, s * 0.35, s * 0.10, 0, Math.PI * 2); ctx.fill();
    // Windshield
    ctx.fillStyle = 'rgba(74,216,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.20, -s * 0.45);
    ctx.lineTo(-s * 0.30, -s * 0.70);
    ctx.lineTo(-s * 0.05, -s * 0.65);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Headlight glow
    const glow = (Math.sin(wingT * 3) + 1) * 0.3 + 0.4;
    ctx.fillStyle = `rgba(255,230,100,${glow})`;
    ctx.beginPath(); ctx.arc(-s * 0.78, s * 0.00, s * 0.08, 0, Math.PI * 2); ctx.fill();
    // Taillight
    ctx.fillStyle = '#ff2a4a';
    ctx.fillRect(s * 0.78, -s * 0.05, s * 0.08, s * 0.15);
    ctx.restore();
  }

  function drawRiotshield(c, light, dark, wingT) {
    const s = c.size;
    const shake = Math.sin(wingT * 6) * 0.02;
    ctx.save(); ctx.rotate(shake);
    // Shield body — tall rectangle with rounded top
    ctx.fillStyle = 'rgba(60,60,60,0.85)'; ctx.strokeStyle = '#444'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.50, s * 0.75);
    ctx.lineTo(-s * 0.50, -s * 0.30);
    ctx.quadraticCurveTo(-s * 0.50, -s * 0.80, 0, -s * 0.80);
    ctx.quadraticCurveTo(s * 0.50, -s * 0.80, s * 0.50, -s * 0.30);
    ctx.lineTo(s * 0.50, s * 0.75);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Visor window — scratched polycarbonate
    ctx.fillStyle = 'rgba(120,140,160,0.30)';
    ctx.fillRect(-s * 0.38, -s * 0.55, s * 0.76, s * 0.30);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
    ctx.strokeRect(-s * 0.38, -s * 0.55, s * 0.76, s * 0.30);
    // Scratch marks across visor
    ctx.strokeStyle = 'rgba(200,200,200,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-s * 0.30, -s * 0.50); ctx.lineTo(s * 0.10, -s * 0.30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.05, -s * 0.52); ctx.lineTo(s * 0.35, -s * 0.35); ctx.stroke();
    // Blood splatter — main streak
    ctx.fillStyle = 'rgba(180,20,20,0.7)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, -s * 0.60);
    ctx.quadraticCurveTo(-s * 0.25, -s * 0.20, -s * 0.20, s * 0.20);
    ctx.quadraticCurveTo(-s * 0.18, s * 0.35, -s * 0.10, s * 0.40);
    ctx.quadraticCurveTo(-s * 0.05, s * 0.20, -s * 0.05, -s * 0.10);
    ctx.quadraticCurveTo(-s * 0.03, -s * 0.40, -s * 0.15, -s * 0.60);
    ctx.fill();
    // Smaller splatter drops
    ctx.fillStyle = 'rgba(160,15,15,0.6)';
    const splats = [[0.20, -0.10, 0.06], [0.30, 0.15, 0.04], [-0.30, 0.40, 0.05], [0.10, 0.50, 0.04], [0.25, 0.35, 0.03]];
    for (const [dx, dy, r] of splats) {
      ctx.beginPath(); ctx.arc(s * dx, s * dy, s * r, 0, Math.PI * 2); ctx.fill();
    }
    // Drip running down from main streak
    ctx.strokeStyle = 'rgba(150,10,10,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.10, s * 0.40);
    ctx.quadraticCurveTo(-s * 0.08, s * 0.55, -s * 0.12, s * 0.70);
    ctx.stroke();
    // Handle glimpse on back (two horizontal bars)
    ctx.strokeStyle = '#333'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-s * 0.25, s * 0.10); ctx.lineTo(s * 0.25, s * 0.10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.25, s * 0.45); ctx.lineTo(s * 0.25, s * 0.45); ctx.stroke();
    ctx.restore();
  }

  function drawSnowflake(c, light, dark, wingT) {
    const s = c.size;
    ctx.save(); ctx.rotate(wingT * 0.2);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    // 6 main arms
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i;
      ctx.save(); ctx.rotate(a);
      // Main arm
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.80); ctx.stroke();
      // Side branches
      ctx.beginPath(); ctx.moveTo(0, -s * 0.35); ctx.lineTo(-s * 0.18, -s * 0.50); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -s * 0.35); ctx.lineTo(s * 0.18, -s * 0.50); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -s * 0.55); ctx.lineTo(-s * 0.12, -s * 0.68); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -s * 0.55); ctx.lineTo(s * 0.12, -s * 0.68); ctx.stroke();
      ctx.restore();
    }
    // Center dot
    ctx.fillStyle = '#4ad8ff';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.08, 0, Math.PI * 2); ctx.fill();
    // Glint
    const glint = (Math.sin(wingT * 4) + 1) * 0.3;
    ctx.fillStyle = `rgba(255,255,255,${0.3 + glint})`;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawRaincloud(c, light, dark, wingT) {
    const s = c.size;
    // Cloud body (3 circles + flat bottom)
    ctx.fillStyle = '#aab8c8'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-s * 0.30, -s * 0.15, s * 0.35, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.arc(s * 0.15, -s * 0.25, s * 0.40, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.arc(s * 0.45, -s * 0.05, s * 0.30, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Flat bottom fill
    ctx.fillRect(-s * 0.65, -s * 0.10, s * 1.10, s * 0.25);
    // Rain drops
    ctx.fillStyle = '#4ad8ff';
    for (let i = 0; i < 5; i++) {
      const rx = -s * 0.45 + i * s * 0.22;
      const ry = s * 0.25 + ((wingT * 80 + i * 37) % 60) / 60 * s * 0.40;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.quadraticCurveTo(rx - s * 0.03, ry + s * 0.08, rx, ry + s * 0.10);
      ctx.quadraticCurveTo(rx + s * 0.03, ry + s * 0.08, rx, ry);
      ctx.fill();
    }
    // Tiny flower sprouting from bottom-center
    ctx.fillStyle = '#9cff3a';
    ctx.fillRect(-s * 0.015, s * 0.55, s * 0.03, s * 0.25);
    ctx.fillStyle = '#ff5cf2';
    ctx.beginPath(); ctx.arc(0, s * 0.50, s * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe833';
    ctx.beginPath(); ctx.arc(0, s * 0.50, s * 0.04, 0, Math.PI * 2); ctx.fill();
  }

  function drawSoulfire(c, light, dark, wingT) {
    const s = c.size;
    const flicker = Math.sin(wingT * 4) * s * 0.04;
    // Outer flame glow
    const grad = ctx.createRadialGradient(0, s * 0.10, s * 0.05, 0, -s * 0.15, s * 0.65);
    grad.addColorStop(0, 'rgba(168,85,247,0.7)');
    grad.addColorStop(0.5, 'rgba(74,216,255,0.3)');
    grad.addColorStop(1, 'rgba(74,216,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, -s * 0.10, s * 0.65, 0, Math.PI * 2); ctx.fill();
    // Flame body
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.80 + flicker);
    ctx.quadraticCurveTo(-s * 0.50, -s * 0.30, -s * 0.40, s * 0.30);
    ctx.quadraticCurveTo(-s * 0.20, s * 0.55, 0, s * 0.50);
    ctx.quadraticCurveTo(s * 0.20, s * 0.55, s * 0.40, s * 0.30);
    ctx.quadraticCurveTo(s * 0.50, -s * 0.30, 0, -s * 0.80 + flicker);
    ctx.fill();
    // Inner flame
    ctx.fillStyle = '#4ad8ff';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.50 + flicker);
    ctx.quadraticCurveTo(-s * 0.20, -s * 0.10, -s * 0.18, s * 0.25);
    ctx.quadraticCurveTo(0, s * 0.40, s * 0.18, s * 0.25);
    ctx.quadraticCurveTo(s * 0.20, -s * 0.10, 0, -s * 0.50 + flicker);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-s * 0.10, s * 0.05, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.10, s * 0.05, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(-s * 0.10, s * 0.05, s * 0.03, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.10, s * 0.05, s * 0.03, 0, Math.PI * 2); ctx.fill();
  }

  function drawTreehouse(c, light, dark, wingT) {
    const s = c.size;
    const sway = Math.sin(wingT * 1.2) * 0.03;
    ctx.save(); ctx.rotate(sway);
    // Tree trunk
    ctx.fillStyle = '#6b3a1a'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.fillRect(-s * 0.12, -s * 0.10, s * 0.24, s * 0.90);
    ctx.strokeRect(-s * 0.12, -s * 0.10, s * 0.24, s * 0.90);
    // Platform
    ctx.fillStyle = '#8b5a2a';
    ctx.fillRect(-s * 0.55, -s * 0.10, s * 1.10, s * 0.10);
    ctx.strokeRect(-s * 0.55, -s * 0.10, s * 1.10, s * 0.10);
    // House body
    ctx.fillStyle = '#c89040';
    ctx.fillRect(-s * 0.45, -s * 0.55, s * 0.90, s * 0.45);
    ctx.strokeRect(-s * 0.45, -s * 0.55, s * 0.90, s * 0.45);
    // Roof
    ctx.fillStyle = '#e02020';
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.55);
    ctx.lineTo(0, -s * 0.90);
    ctx.lineTo(s * 0.55, -s * 0.55);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Window
    ctx.fillStyle = '#ffe833';
    ctx.fillRect(-s * 0.12, -s * 0.45, s * 0.24, s * 0.20);
    ctx.strokeRect(-s * 0.12, -s * 0.45, s * 0.24, s * 0.20);
    // Window cross
    ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -s * 0.45); ctx.lineTo(0, -s * 0.25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.12, -s * 0.35); ctx.lineTo(s * 0.12, -s * 0.35); ctx.stroke();
    // Rope ladder
    ctx.strokeStyle = '#8b5a2a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-s * 0.06, -s * 0.00); ctx.lineTo(-s * 0.10, s * 0.80); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.06, -s * 0.00); ctx.lineTo(s * 0.10, s * 0.80); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const ry = s * 0.10 + i * s * 0.18;
      ctx.beginPath(); ctx.moveTo(-s * 0.08, ry); ctx.lineTo(s * 0.08, ry); ctx.stroke();
    }
    ctx.restore();
  }

  function drawCompass(c, light, dark, wingT) {
    const s = c.size;
    // Outer ring
    ctx.fillStyle = '#1a1a1a'; ctx.strokeStyle = '#c89040'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.80, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Inner face
    ctx.fillStyle = '#f5ecd8';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.68, 0, Math.PI * 2); ctx.fill();
    // Cardinal ticks
    ctx.fillStyle = '#0e0e0e';
    ctx.font = `900 ${Math.max(5, s * 0.16)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, -s * 0.50);
    ctx.fillText('S', 0, s * 0.50);
    ctx.fillText('E', s * 0.50, 0);
    ctx.fillText('W', -s * 0.50, 0);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // Needle — spins
    ctx.save(); ctx.rotate(wingT * 0.8);
    // North half (red)
    ctx.fillStyle = '#e02020';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.45);
    ctx.lineTo(-s * 0.07, 0);
    ctx.lineTo(s * 0.07, 0);
    ctx.closePath();
    ctx.fill();
    // South half (white)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, s * 0.45);
    ctx.lineTo(-s * 0.07, 0);
    ctx.lineTo(s * 0.07, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Center pin
    ctx.fillStyle = '#c89040';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.06, 0, Math.PI * 2); ctx.fill();
  }

  // b067 — 10 more hero icons --------------------------------

  function drawBottle(c, light, dark, wingT) {
    const s = c.size;
    const tilt = Math.sin(wingT * 1.0) * 0.08;
    ctx.save(); ctx.rotate(0.25 + tilt);
    // Body
    ctx.fillStyle = '#2a5a20'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, -s * 0.20);
    ctx.lineTo(-s * 0.25, s * 0.65);
    ctx.quadraticCurveTo(-s * 0.25, s * 0.80, -s * 0.10, s * 0.80);
    ctx.lineTo(s * 0.10, s * 0.80);
    ctx.quadraticCurveTo(s * 0.25, s * 0.80, s * 0.25, s * 0.65);
    ctx.lineTo(s * 0.25, -s * 0.20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Neck
    ctx.fillStyle = '#2a5a20';
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, -s * 0.20);
    ctx.lineTo(-s * 0.10, -s * 0.65);
    ctx.lineTo(s * 0.10, -s * 0.65);
    ctx.lineTo(s * 0.12, -s * 0.20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Label
    ctx.fillStyle = '#f5ecd8';
    ctx.fillRect(-s * 0.20, s * 0.05, s * 0.40, s * 0.30);
    ctx.strokeRect(-s * 0.20, s * 0.05, s * 0.40, s * 0.30);
    // Spill coming from mouth
    ctx.fillStyle = 'rgba(180,120,40,0.50)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.08, -s * 0.65);
    ctx.quadraticCurveTo(-s * 0.30, -s * 0.80, -s * 0.45, -s * 0.70);
    ctx.quadraticCurveTo(-s * 0.35, -s * 0.68, -s * 0.08, -s * 0.60);
    ctx.fill();
    ctx.restore();
  }

  function drawBeret(c, light, dark, wingT) {
    const s = c.size;
    // Head silhouette
    ctx.fillStyle = '#f5d0a0'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, s * 0.15, s * 0.40, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Beret
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.10);
    ctx.quadraticCurveTo(-s * 0.50, -s * 0.60, 0, -s * 0.55);
    ctx.quadraticCurveTo(s * 0.50, -s * 0.50, s * 0.55, -s * 0.10);
    ctx.lineTo(-s * 0.55, -s * 0.10);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Beret nub
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(0, -s * 0.55, s * 0.06, 0, Math.PI * 2); ctx.fill();
    // Brim
    ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-s * 0.55, -s * 0.10); ctx.lineTo(s * 0.55, -s * 0.10); ctx.stroke();
    // Eyes
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(-s * 0.12, s * 0.10, s * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.12, s * 0.10, s * 0.04, 0, Math.PI * 2); ctx.fill();
    // Curly mustache
    ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, s * 0.28);
    ctx.quadraticCurveTo(-s * 0.15, s * 0.22, -s * 0.03, s * 0.28);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.22, s * 0.28);
    ctx.quadraticCurveTo(s * 0.15, s * 0.22, s * 0.03, s * 0.28);
    ctx.stroke();
    // Mustache curl tips
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, s * 0.28);
    ctx.quadraticCurveTo(-s * 0.28, s * 0.22, -s * 0.30, s * 0.18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.22, s * 0.28);
    ctx.quadraticCurveTo(s * 0.28, s * 0.22, s * 0.30, s * 0.18);
    ctx.stroke();
  }

  function drawSparklymic(c, light, dark, wingT) {
    const s = c.size;
    // Mic handle
    ctx.fillStyle = '#c0c0c0'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.fillRect(-s * 0.08, -s * 0.05, s * 0.16, s * 0.75);
    ctx.strokeRect(-s * 0.08, -s * 0.05, s * 0.16, s * 0.75);
    // Mic head (rounded top)
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(0, -s * 0.05, s * 0.22, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Grille lines
    ctx.strokeStyle = '#666'; ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      const gy = -s * 0.05 + i * s * 0.06;
      ctx.beginPath(); ctx.moveTo(-s * 0.15, gy); ctx.lineTo(s * 0.15, gy); ctx.stroke();
    }
    // Sparkles around the mic
    ctx.fillStyle = '#ffe833';
    const sparkles = [[-0.35, -0.25], [0.40, -0.15], [-0.30, 0.15], [0.35, 0.30], [0.10, -0.40], [-0.15, -0.45]];
    for (const [dx, dy] of sparkles) {
      const pulse = (Math.sin(wingT * 3 + dx * 10 + dy * 7) + 1) * 0.5;
      ctx.globalAlpha = 0.4 + pulse * 0.6;
      const ss = s * 0.04;
      const sx = s * dx, sy = s * dy;
      ctx.beginPath();
      ctx.moveTo(sx, sy - ss); ctx.lineTo(sx + ss * 0.3, sy - ss * 0.3);
      ctx.lineTo(sx + ss, sy); ctx.lineTo(sx + ss * 0.3, sy + ss * 0.3);
      ctx.lineTo(sx, sy + ss); ctx.lineTo(sx - ss * 0.3, sy + ss * 0.3);
      ctx.lineTo(sx - ss, sy); ctx.lineTo(sx - ss * 0.3, sy - ss * 0.3);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawIcecream(c, light, dark, wingT) {
    const s = c.size;
    // Cone
    ctx.fillStyle = '#c89040'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.30, -s * 0.05);
    ctx.lineTo(0, s * 0.85);
    ctx.lineTo(s * 0.30, -s * 0.05);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Waffle pattern
    ctx.strokeStyle = '#a07030'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = s * 0.05 + i * s * 0.18;
      const w = s * 0.28 - i * s * 0.06;
      ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y); ctx.stroke();
    }
    // 3 scoops — neapolitan (strawberry, chocolate, vanilla)
    const scoops = [
      { cx: -s * 0.15, cy: -s * 0.15, col: '#f5d0a0' },  // vanilla
      { cx:  s * 0.15, cy: -s * 0.15, col: '#6b3a1a' },  // chocolate
      { cx:  0,         cy: -s * 0.42, col: '#ff7a9a' },  // strawberry
    ];
    for (const sc of scoops) {
      ctx.fillStyle = sc.col;
      ctx.beginPath(); ctx.arc(sc.cx, sc.cy, s * 0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // Drip
    const drip = Math.sin(wingT * 1.5) * s * 0.03;
    ctx.fillStyle = '#ff7a9a';
    ctx.beginPath();
    ctx.moveTo(-s * 0.10, -s * 0.20);
    ctx.quadraticCurveTo(-s * 0.15, s * 0.05 + drip, -s * 0.05, s * 0.10 + drip);
    ctx.quadraticCurveTo(-s * 0.02, -s * 0.10, -s * 0.10, -s * 0.20);
    ctx.fill();
  }

  function drawBrain(c, light, dark, wingT) {
    const s = c.size;
    // Main brain shape — two hemispheres
    ctx.fillStyle = '#ff9aaa'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    // Left hemisphere
    ctx.beginPath();
    ctx.arc(-s * 0.18, 0, s * 0.50, 0.5, Math.PI * 2 - 0.5);
    ctx.fill(); ctx.stroke();
    // Right hemisphere
    ctx.beginPath();
    ctx.arc(s * 0.18, 0, s * 0.50, 0.5 + Math.PI, Math.PI * 3 - 0.5);
    ctx.fill(); ctx.stroke();
    // Center groove
    ctx.strokeStyle = '#d06070'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.48);
    ctx.quadraticCurveTo(-s * 0.03, 0, 0, s * 0.48);
    ctx.stroke();
    // Wrinkle lines
    ctx.strokeStyle = '#d06070'; ctx.lineWidth = 1.5;
    const wrinkles = [
      [[-0.45, -0.20], [-0.15, -0.25]],
      [[-0.40, 0.10], [-0.10, 0.05]],
      [[0.15, -0.30], [0.45, -0.20]],
      [[0.10, 0.10], [0.40, 0.15]],
    ];
    for (const [a, b] of wrinkles) {
      ctx.beginPath();
      ctx.moveTo(s * a[0], s * a[1]);
      ctx.quadraticCurveTo(s * (a[0] + b[0]) / 2, s * (a[1] + b[1]) / 2 - s * 0.08, s * b[0], s * b[1]);
      ctx.stroke();
    }
    // Thought bubbles floating up
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (let i = 0; i < 3; i++) {
      const bx = s * 0.30 + i * s * 0.12;
      const by = -s * 0.55 - i * s * 0.22;
      const br = s * (0.04 + i * 0.03);
      const bob = Math.sin(wingT * 2 + i) * s * 0.04;
      ctx.beginPath(); ctx.arc(bx, by + bob, br, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawAnchor(c, light, dark, wingT) {
    const s = c.size;
    const sway = Math.sin(wingT * 0.8) * 0.04;
    ctx.save(); ctx.rotate(sway);
    ctx.strokeStyle = '#888'; ctx.fillStyle = '#aaa'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    // Vertical shaft
    ctx.beginPath(); ctx.moveTo(0, -s * 0.55); ctx.lineTo(0, s * 0.45); ctx.stroke();
    // Crossbar
    ctx.beginPath(); ctx.moveTo(-s * 0.35, -s * 0.20); ctx.lineTo(s * 0.35, -s * 0.20); ctx.stroke();
    // Ring at top
    ctx.beginPath(); ctx.arc(0, -s * 0.65, s * 0.12, 0, Math.PI * 2); ctx.stroke();
    // Left fluke (curved arm)
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, s * 0.45);
    ctx.quadraticCurveTo(-s * 0.55, s * 0.40, -s * 0.45, s * 0.10);
    ctx.stroke();
    // Left arrow tip
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, s * 0.10);
    ctx.lineTo(-s * 0.55, s * 0.20);
    ctx.lineTo(-s * 0.35, s * 0.20);
    ctx.closePath(); ctx.fill();
    // Right fluke
    ctx.beginPath();
    ctx.moveTo(s * 0.05, s * 0.45);
    ctx.quadraticCurveTo(s * 0.55, s * 0.40, s * 0.45, s * 0.10);
    ctx.stroke();
    // Right arrow tip
    ctx.beginPath();
    ctx.moveTo(s * 0.45, s * 0.10);
    ctx.lineTo(s * 0.55, s * 0.20);
    ctx.lineTo(s * 0.35, s * 0.20);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawNophone(c, light, dark, wingT) {
    const s = c.size;
    // Phone body
    ctx.fillStyle = '#1a1a1a'; ctx.strokeStyle = '#444'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.30, -s * 0.70);
    ctx.quadraticCurveTo(-s * 0.30, -s * 0.80, -s * 0.20, -s * 0.80);
    ctx.lineTo(s * 0.20, -s * 0.80);
    ctx.quadraticCurveTo(s * 0.30, -s * 0.80, s * 0.30, -s * 0.70);
    ctx.lineTo(s * 0.30, s * 0.70);
    ctx.quadraticCurveTo(s * 0.30, s * 0.80, s * 0.20, s * 0.80);
    ctx.lineTo(-s * 0.20, s * 0.80);
    ctx.quadraticCurveTo(-s * 0.30, s * 0.80, -s * 0.30, s * 0.70);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Screen
    ctx.fillStyle = '#222';
    ctx.fillRect(-s * 0.25, -s * 0.65, s * 0.50, s * 1.10);
    // "No signal" bars (all empty)
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const bx = -s * 0.10 + i * s * 0.06;
      const bh = s * (0.08 + i * 0.06);
      ctx.strokeRect(bx, -s * 0.10 - bh + s * 0.14, s * 0.04, bh);
    }
    // Red X over bars
    ctx.strokeStyle = '#ff2a4a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-s * 0.15, -s * 0.15); ctx.lineTo(s * 0.15, s * 0.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.15, -s * 0.15); ctx.lineTo(-s * 0.15, s * 0.15); ctx.stroke();
    // "No Service" text
    ctx.fillStyle = '#555';
    ctx.font = `700 ${Math.max(4, s * 0.09)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('NO SERVICE', 0, s * 0.35);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  function drawQuill(c, light, dark, wingT) {
    const s = c.size;
    const bob = Math.sin(wingT * 1.5) * 0.03;
    ctx.save(); ctx.rotate(-0.35 + bob);
    // Feather vane — left side
    ctx.fillStyle = '#f5ecd8'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.85);
    ctx.quadraticCurveTo(-s * 0.35, -s * 0.50, -s * 0.25, -s * 0.10);
    ctx.lineTo(0, -s * 0.05);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Feather vane — right side
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.85);
    ctx.quadraticCurveTo(s * 0.30, -s * 0.45, s * 0.20, -s * 0.10);
    ctx.lineTo(0, -s * 0.05);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Barb lines
    ctx.strokeStyle = '#c8b890'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) {
      const t = 0.15 + i * 0.12;
      const py = -s * 0.85 + t * s * 0.80;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(-s * (0.25 - t * 0.15), py + s * 0.05); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(s * (0.20 - t * 0.12), py + s * 0.05); ctx.stroke();
    }
    // Quill shaft
    ctx.strokeStyle = '#8b5a2a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, -s * 0.85); ctx.lineTo(0, s * 0.70); ctx.stroke();
    // Nib
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.moveTo(-s * 0.04, s * 0.60);
    ctx.lineTo(0, s * 0.80);
    ctx.lineTo(s * 0.04, s * 0.60);
    ctx.closePath(); ctx.fill();
    // Ink trail
    ctx.fillStyle = 'rgba(30,30,80,0.45)';
    ctx.beginPath();
    ctx.moveTo(0, s * 0.80);
    ctx.quadraticCurveTo(s * 0.10, s * 0.88, s * 0.05, s * 0.92);
    ctx.quadraticCurveTo(-s * 0.05, s * 0.95, -s * 0.10, s * 0.90);
    ctx.fill();
    ctx.restore();
  }

  function drawDiamond(c, light, dark, wingT) {
    const s = c.size;
    const glint = (Math.sin(wingT * 4) + 1) * 0.5;
    // Crown (top facets)
    ctx.fillStyle = '#e0f0ff'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.80);
    ctx.lineTo(-s * 0.55, -s * 0.20);
    ctx.lineTo(-s * 0.25, -s * 0.20);
    ctx.lineTo(0, -s * 0.45);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c0e0ff';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.80);
    ctx.lineTo(s * 0.55, -s * 0.20);
    ctx.lineTo(s * 0.25, -s * 0.20);
    ctx.lineTo(0, -s * 0.45);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Table
    ctx.fillStyle = '#d8ecff';
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, -s * 0.20);
    ctx.lineTo(s * 0.25, -s * 0.20);
    ctx.lineTo(0, -s * 0.45);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Pavilion (bottom point)
    ctx.fillStyle = '#a0d0ff';
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.20);
    ctx.lineTo(0, s * 0.75);
    ctx.lineTo(0, -s * 0.20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#80c0ff';
    ctx.beginPath();
    ctx.moveTo(s * 0.55, -s * 0.20);
    ctx.lineTo(0, s * 0.75);
    ctx.lineTo(0, -s * 0.20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Glint sparkle
    ctx.fillStyle = `rgba(255,255,255,${0.3 + glint * 0.7})`;
    ctx.beginPath();
    const gx = -s * 0.15, gy = -s * 0.35;
    ctx.moveTo(gx, gy - s * 0.08); ctx.lineTo(gx + s * 0.03, gy);
    ctx.lineTo(gx, gy + s * 0.08); ctx.lineTo(gx - s * 0.03, gy);
    ctx.closePath(); ctx.fill();
  }

  function drawFalleaf(c, light, dark, wingT) {
    const s = c.size;
    const tumble = Math.sin(wingT * 1.0) * 0.15;
    ctx.save(); ctx.rotate(tumble);
    // Leaf body
    ctx.fillStyle = '#d44a00'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.70);
    ctx.bezierCurveTo(-s * 0.65, -s * 0.55, -s * 0.70, s * 0.15, 0, s * 0.60);
    ctx.bezierCurveTo(s * 0.70, s * 0.15, s * 0.65, -s * 0.55, 0, -s * 0.70);
    ctx.fill(); ctx.stroke();
    // Color gradient patches
    ctx.fillStyle = '#e87020';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.50);
    ctx.bezierCurveTo(-s * 0.40, -s * 0.35, -s * 0.35, s * 0.05, 0, s * 0.30);
    ctx.bezierCurveTo(s * 0.15, s * 0.10, s * 0.20, -s * 0.30, 0, -s * 0.50);
    ctx.fill();
    // Veins
    ctx.strokeStyle = '#8b3000'; ctx.lineWidth = 1.5;
    // Center vein
    ctx.beginPath(); ctx.moveTo(0, -s * 0.60); ctx.lineTo(0, s * 0.50); ctx.stroke();
    // Side veins
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const vy = -s * 0.35 + i * s * 0.22;
      ctx.beginPath(); ctx.moveTo(0, vy); ctx.lineTo(-s * 0.30, vy - s * 0.10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, vy); ctx.lineTo(s * 0.30, vy - s * 0.10); ctx.stroke();
    }
    // Stem
    ctx.strokeStyle = '#5a2800'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -s * 0.70); ctx.lineTo(s * 0.08, -s * 0.85); ctx.stroke();
    ctx.restore();
  }

  // b068 — 15 more hero icons --------------------------------

  function drawFirepit(c, light, dark, wingT) {
    const s = c.size;
    // Stone ring
    ctx.fillStyle = '#555'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.25, s * 0.70, s * 0.30, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Inner pit
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.25, s * 0.50, s * 0.20, 0, 0, Math.PI * 2);
    ctx.fill();
    // Flames
    const cols = ['#ff4400', '#ff7a1a', '#ffe833'];
    for (let i = 0; i < 5; i++) {
      const fx = -s * 0.30 + i * s * 0.15;
      const fh = s * (0.35 + Math.sin(wingT * 4 + i * 1.7) * 0.15);
      const fw = s * 0.10;
      ctx.fillStyle = cols[i % 3];
      ctx.beginPath();
      ctx.moveTo(fx - fw, s * 0.20);
      ctx.quadraticCurveTo(fx - fw * 0.5, s * 0.20 - fh * 0.6, fx, s * 0.20 - fh);
      ctx.quadraticCurveTo(fx + fw * 0.5, s * 0.20 - fh * 0.6, fx + fw, s * 0.20);
      ctx.fill();
    }
    // Embers
    ctx.fillStyle = '#ffe833';
    for (let i = 0; i < 4; i++) {
      const ex = s * (-0.20 + i * 0.13);
      const ey = s * (-0.20 - i * 0.12) + Math.sin(wingT * 3 + i * 2) * s * 0.06;
      ctx.globalAlpha = 0.4 + Math.sin(wingT * 5 + i) * 0.3;
      ctx.beginPath(); ctx.arc(ex, ey, s * 0.02, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawElectricguitar(c, light, dark, wingT) {
    const s = c.size;
    const vibe = Math.sin(wingT * 2) * 0.03;
    ctx.save(); ctx.rotate(-0.15 + vibe);
    // Neck
    ctx.fillStyle = '#5a2800'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.fillRect(-s * 0.06, -s * 0.90, s * 0.12, s * 0.65);
    ctx.strokeRect(-s * 0.06, -s * 0.90, s * 0.12, s * 0.65);
    // Frets
    ctx.strokeStyle = '#c0c0c0'; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const fy = -s * 0.80 + i * s * 0.12;
      ctx.beginPath(); ctx.moveTo(-s * 0.06, fy); ctx.lineTo(s * 0.06, fy); ctx.stroke();
    }
    // Headstock
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(-s * 0.08, -s * 0.90);
    ctx.lineTo(-s * 0.12, -s * 1.00);
    ctx.lineTo(s * 0.12, -s * 1.00);
    ctx.lineTo(s * 0.08, -s * 0.90);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Tuning pegs
    ctx.fillStyle = '#c0c0c0';
    ctx.beginPath(); ctx.arc(-s * 0.14, -s * 0.93, s * 0.02, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-s * 0.14, -s * 0.97, s * 0.02, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.14, -s * 0.93, s * 0.02, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.14, -s * 0.97, s * 0.02, 0, Math.PI * 2); ctx.fill();
    // Body
    ctx.fillStyle = '#e02020';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.25);
    ctx.quadraticCurveTo(-s * 0.55, -s * 0.30, -s * 0.50, s * 0.05);
    ctx.quadraticCurveTo(-s * 0.55, s * 0.35, -s * 0.30, s * 0.50);
    ctx.quadraticCurveTo(-s * 0.10, s * 0.60, 0, s * 0.55);
    ctx.quadraticCurveTo(s * 0.10, s * 0.60, s * 0.30, s * 0.50);
    ctx.quadraticCurveTo(s * 0.55, s * 0.35, s * 0.50, s * 0.05);
    ctx.quadraticCurveTo(s * 0.55, -s * 0.30, 0, -s * 0.25);
    ctx.fill(); ctx.stroke();
    // Pickups
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-s * 0.15, s * 0.00, s * 0.30, s * 0.08);
    ctx.fillRect(-s * 0.15, s * 0.15, s * 0.30, s * 0.08);
    // Strings
    ctx.strokeStyle = '#c0c0c0'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      const sx = -s * 0.03 + i * s * 0.02;
      ctx.beginPath(); ctx.moveTo(sx, -s * 0.90); ctx.lineTo(sx, s * 0.45); ctx.stroke();
    }
    ctx.restore();
  }

  function drawCrosshair(c, light, dark, wingT) {
    const s = c.size;
    ctx.save(); ctx.rotate(wingT * 0.15);
    // Outer ring
    ctx.strokeStyle = '#ff2a4a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.60, 0, Math.PI * 2); ctx.stroke();
    // Inner ring
    ctx.beginPath(); ctx.arc(0, 0, s * 0.30, 0, Math.PI * 2); ctx.stroke();
    // Crosshairs
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -s * 0.80); ctx.lineTo(0, -s * 0.35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, s * 0.35); ctx.lineTo(0, s * 0.80); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.80, 0); ctx.lineTo(-s * 0.35, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.35, 0); ctx.lineTo(s * 0.80, 0); ctx.stroke();
    // Center dot
    ctx.fillStyle = '#ff2a4a';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawBrokencd(c, light, dark, wingT) {
    const s = c.size;
    ctx.save(); ctx.rotate(wingT * 0.5);
    // Disc
    const grad = ctx.createRadialGradient(0, 0, s * 0.08, 0, 0, s * 0.65);
    grad.addColorStop(0, '#333');
    grad.addColorStop(0.3, '#a855f7');
    grad.addColorStop(0.6, '#4ad8ff');
    grad.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = grad; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.65, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Center hole
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.10, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Crack lines (don't rotate)
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(s * 0.05, -s * 0.10); ctx.lineTo(s * 0.35, -s * 0.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.08, -s * 0.08); ctx.lineTo(s * 0.50, -s * 0.20); ctx.stroke();
    // Mascara tear drops
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 3; i++) {
      const dy = s * 0.25 + i * s * 0.15;
      const dx = -s * 0.15 + Math.sin(i * 1.5) * s * 0.05;
      const dr = s * (0.03 - i * 0.005);
      ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawHourglass(c, light, dark, wingT) {
    const s = c.size;
    // Frame top/bottom bars
    ctx.fillStyle = '#c89040'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.fillRect(-s * 0.40, -s * 0.80, s * 0.80, s * 0.08);
    ctx.strokeRect(-s * 0.40, -s * 0.80, s * 0.80, s * 0.08);
    ctx.fillRect(-s * 0.40, s * 0.72, s * 0.80, s * 0.08);
    ctx.strokeRect(-s * 0.40, s * 0.72, s * 0.80, s * 0.08);
    // Glass bulbs
    ctx.fillStyle = 'rgba(200,210,220,0.20)'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    // Top bulb
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, -s * 0.72);
    ctx.quadraticCurveTo(-s * 0.35, -s * 0.10, 0, 0);
    ctx.quadraticCurveTo(s * 0.35, -s * 0.10, s * 0.35, -s * 0.72);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Bottom bulb
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, s * 0.72);
    ctx.quadraticCurveTo(-s * 0.35, s * 0.10, 0, 0);
    ctx.quadraticCurveTo(s * 0.35, s * 0.10, s * 0.35, s * 0.72);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Sand in bottom
    const fill = (Math.sin(wingT * 0.3) + 1) * 0.25 + 0.3;
    ctx.fillStyle = '#deb866';
    ctx.beginPath();
    ctx.moveTo(-s * 0.30, s * 0.72);
    ctx.quadraticCurveTo(-s * (0.30 * fill), s * (0.72 - fill * 0.55), 0, s * (0.72 - fill * 0.50));
    ctx.quadraticCurveTo(s * (0.30 * fill), s * (0.72 - fill * 0.55), s * 0.30, s * 0.72);
    ctx.closePath(); ctx.fill();
    // Trickling stream
    ctx.strokeStyle = '#deb866'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * (0.72 - fill * 0.50)); ctx.stroke();
  }

  function drawLaughskull(c, light, dark, wingT) {
    const s = c.size;
    const shake = Math.sin(wingT * 8) * 0.04;
    ctx.save(); ctx.rotate(shake);
    // Cranium
    ctx.fillStyle = '#f5ecd8'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -s * 0.10, s * 0.55, Math.PI, 0);
    ctx.lineTo(s * 0.40, s * 0.20);
    ctx.lineTo(-s * 0.40, s * 0.20);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Jaw — dropped open
    ctx.fillStyle = '#e8dcc8';
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, s * 0.20);
    ctx.quadraticCurveTo(-s * 0.40, s * 0.55, -s * 0.25, s * 0.60);
    ctx.lineTo(s * 0.25, s * 0.60);
    ctx.quadraticCurveTo(s * 0.40, s * 0.55, s * 0.35, s * 0.20);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Eye sockets
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.ellipse(-s * 0.18, -s * 0.10, s * 0.12, s * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.18, -s * 0.10, s * 0.12, s * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    // Glowing pupils
    const glow = (Math.sin(wingT * 4) + 1) * 0.3 + 0.4;
    ctx.fillStyle = `rgba(255,70,0,${glow})`;
    ctx.beginPath(); ctx.arc(-s * 0.18, -s * 0.08, s * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.18, -s * 0.08, s * 0.05, 0, Math.PI * 2); ctx.fill();
    // Nose
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.moveTo(0, s * 0.02);
    ctx.lineTo(-s * 0.05, s * 0.12);
    ctx.lineTo(s * 0.05, s * 0.12);
    ctx.closePath(); ctx.fill();
    // Teeth
    ctx.fillStyle = '#f5ecd8'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const tx = -s * 0.20 + i * s * 0.10;
      ctx.fillRect(tx, s * 0.20, s * 0.08, s * 0.10);
      ctx.strokeRect(tx, s * 0.20, s * 0.08, s * 0.10);
    }
    ctx.restore();
  }

  function drawSourcandy(c, light, dark, wingT) {
    const s = c.size;
    // Wrapper (twisted ends)
    ctx.fillStyle = '#ff5cf2'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    // Left twist
    ctx.beginPath();
    ctx.moveTo(-s * 0.80, -s * 0.05);
    ctx.lineTo(-s * 0.55, -s * 0.15);
    ctx.lineTo(-s * 0.55, s * 0.15);
    ctx.lineTo(-s * 0.80, s * 0.05);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Right twist
    ctx.beginPath();
    ctx.moveTo(s * 0.80, -s * 0.05);
    ctx.lineTo(s * 0.55, -s * 0.15);
    ctx.lineTo(s * 0.55, s * 0.15);
    ctx.lineTo(s * 0.80, s * 0.05);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Candy body — left half sweet (pink)
    ctx.fillStyle = '#ff7ab8';
    ctx.fillRect(-s * 0.55, -s * 0.25, s * 0.55, s * 0.50);
    ctx.strokeRect(-s * 0.55, -s * 0.25, s * 0.55, s * 0.50);
    // Right half sour/melting (green)
    ctx.fillStyle = '#9cff3a';
    ctx.fillRect(0, -s * 0.25, s * 0.55, s * 0.50);
    ctx.strokeRect(0, -s * 0.25, s * 0.55, s * 0.50);
    // Drip from sour side
    const drip = Math.sin(wingT * 1.5) * s * 0.04;
    ctx.fillStyle = '#7acc20';
    ctx.beginPath();
    ctx.moveTo(s * 0.20, s * 0.25);
    ctx.quadraticCurveTo(s * 0.18, s * 0.45 + drip, s * 0.25, s * 0.55 + drip);
    ctx.quadraticCurveTo(s * 0.30, s * 0.45 + drip, s * 0.28, s * 0.25);
    ctx.fill();
    // Face — sweet side smile, sour side grimace
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(-s * 0.28, -s * 0.05, s * 0.03, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(-s * 0.28, s * 0.08, s * 0.06, 0.1, Math.PI - 0.1); ctx.stroke();
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(s * 0.28, -s * 0.05, s * 0.03, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.28, s * 0.12, s * 0.06, Math.PI + 0.1, -0.1); ctx.stroke();
  }

  function drawDuffel(c, light, dark, wingT) {
    const s = c.size;
    // Bag body
    ctx.fillStyle = '#5a3210'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.75, -s * 0.25);
    ctx.quadraticCurveTo(-s * 0.80, s * 0.35, -s * 0.65, s * 0.40);
    ctx.lineTo(s * 0.65, s * 0.40);
    ctx.quadraticCurveTo(s * 0.80, s * 0.35, s * 0.75, -s * 0.25);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Zipper line
    ctx.strokeStyle = '#c89040'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-s * 0.65, -s * 0.25); ctx.lineTo(s * 0.65, -s * 0.25); ctx.stroke();
    // Zipper pull
    ctx.fillStyle = '#c89040';
    ctx.beginPath(); ctx.arc(s * 0.10, -s * 0.25, s * 0.04, 0, Math.PI * 2); ctx.fill();
    // Handles
    ctx.strokeStyle = '#3a1a05'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, -s * 0.25);
    ctx.quadraticCurveTo(-s * 0.20, -s * 0.55, 0, -s * 0.55);
    ctx.quadraticCurveTo(s * 0.20, -s * 0.55, s * 0.25, -s * 0.25);
    ctx.stroke();
    // LV-ish monogram pattern (subtle)
    ctx.fillStyle = 'rgba(200,144,64,0.25)';
    ctx.font = `700 ${Math.max(4, s * 0.10)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let r = 0; r < 2; r++) {
      for (let ci = 0; ci < 4; ci++) {
        ctx.fillText('K', -s * 0.40 + ci * s * 0.25, s * 0.00 + r * s * 0.20);
      }
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  function drawStophand(c, light, dark, wingT) {
    const s = c.size;
    // Palm
    ctx.fillStyle = '#f5d0a0'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, s * 0.05);
    ctx.quadraticCurveTo(-s * 0.40, s * 0.50, -s * 0.20, s * 0.60);
    ctx.lineTo(s * 0.20, s * 0.60);
    ctx.quadraticCurveTo(s * 0.40, s * 0.50, s * 0.35, s * 0.05);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // 4 fingers
    const fingers = [-s * 0.25, -s * 0.08, s * 0.08, s * 0.25];
    const heights = [-s * 0.55, -s * 0.65, -s * 0.60, -s * 0.45];
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(fingers[i] - s * 0.06, s * 0.05);
      ctx.lineTo(fingers[i] - s * 0.06, heights[i]);
      ctx.quadraticCurveTo(fingers[i], heights[i] - s * 0.08, fingers[i] + s * 0.06, heights[i]);
      ctx.lineTo(fingers[i] + s * 0.06, s * 0.05);
      ctx.fill(); ctx.stroke();
    }
    // Thumb
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, s * 0.10);
    ctx.lineTo(-s * 0.55, -s * 0.10);
    ctx.quadraticCurveTo(-s * 0.55, -s * 0.22, -s * 0.45, -s * 0.20);
    ctx.lineTo(-s * 0.35, -s * 0.05);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Palm lines
    ctx.strokeStyle = '#d0a880'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-s * 0.25, s * 0.25); ctx.quadraticCurveTo(0, s * 0.18, s * 0.25, s * 0.25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.20, s * 0.38); ctx.quadraticCurveTo(0, s * 0.32, s * 0.20, s * 0.38); ctx.stroke();
  }

  function drawMasks(c, light, dark, wingT) {
    const s = c.size;
    const tilt = Math.sin(wingT * 1.5) * 0.08;
    // Tragedy mask (left, tilted back)
    ctx.save(); ctx.translate(-s * 0.20, s * 0.05); ctx.rotate(-0.15 - tilt);
    ctx.fillStyle = '#4ad8ff'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.30, -s * 0.35);
    ctx.quadraticCurveTo(-s * 0.35, s * 0.10, -s * 0.20, s * 0.35);
    ctx.quadraticCurveTo(0, s * 0.50, s * 0.20, s * 0.35);
    ctx.quadraticCurveTo(s * 0.35, s * 0.10, s * 0.30, -s * 0.35);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Sad eyes
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(-s * 0.10, -s * 0.08, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.10, -s * 0.08, s * 0.06, 0, Math.PI * 2); ctx.fill();
    // Sad mouth
    ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, s * 0.25, s * 0.12, Math.PI + 0.3, -0.3); ctx.stroke();
    ctx.restore();
    // Comedy mask (right, tilted forward)
    ctx.save(); ctx.translate(s * 0.20, -s * 0.05); ctx.rotate(0.15 + tilt);
    ctx.fillStyle = '#ffe833'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.30, -s * 0.35);
    ctx.quadraticCurveTo(-s * 0.35, s * 0.10, -s * 0.20, s * 0.35);
    ctx.quadraticCurveTo(0, s * 0.50, s * 0.20, s * 0.35);
    ctx.quadraticCurveTo(s * 0.35, s * 0.10, s * 0.30, -s * 0.35);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Happy eyes
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(-s * 0.10, -s * 0.08, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.10, -s * 0.08, s * 0.06, 0, Math.PI * 2); ctx.fill();
    // Happy mouth
    ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, s * 0.12, s * 0.12, 0.3, Math.PI - 0.3); ctx.stroke();
    ctx.restore();
  }

  function drawTrophy(c, light, dark, wingT) {
    const s = c.size;
    // Base
    ctx.fillStyle = '#8b5a2a'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.fillRect(-s * 0.30, s * 0.55, s * 0.60, s * 0.12);
    ctx.strokeRect(-s * 0.30, s * 0.55, s * 0.60, s * 0.12);
    // Stem
    ctx.fillStyle = '#c89040';
    ctx.fillRect(-s * 0.06, s * 0.20, s * 0.12, s * 0.35);
    ctx.strokeRect(-s * 0.06, s * 0.20, s * 0.12, s * 0.35);
    // Cup body
    ctx.fillStyle = '#c89040';
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, -s * 0.55);
    ctx.lineTo(-s * 0.30, s * 0.20);
    ctx.quadraticCurveTo(0, s * 0.30, s * 0.30, s * 0.20);
    ctx.lineTo(s * 0.35, -s * 0.55);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Handles
    ctx.strokeStyle = '#a07020'; ctx.lineWidth = 3; ctx.fillStyle = 'transparent';
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, -s * 0.35);
    ctx.quadraticCurveTo(-s * 0.60, -s * 0.20, -s * 0.35, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.35, -s * 0.35);
    ctx.quadraticCurveTo(s * 0.60, -s * 0.20, s * 0.35, 0);
    ctx.stroke();
    // Dust particles
    ctx.fillStyle = 'rgba(200,200,200,0.30)';
    for (let i = 0; i < 4; i++) {
      const dx = s * (-0.25 + Math.sin(wingT + i * 1.8) * 0.35);
      const dy = s * (-0.30 + Math.cos(wingT * 0.7 + i) * 0.20);
      ctx.beginPath(); ctx.arc(dx, dy, s * 0.02, 0, Math.PI * 2); ctx.fill();
    }
    // Star on cup
    ctx.fillStyle = '#ffe833';
    ctx.beginPath();
    const cx = 0, cy = -s * 0.15, sr = s * 0.10;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      const ai = a + Math.PI / 5;
      ctx.lineTo(cx + Math.cos(a) * sr, cy + Math.sin(a) * sr);
      ctx.lineTo(cx + Math.cos(ai) * sr * 0.4, cy + Math.sin(ai) * sr * 0.4);
    }
    ctx.closePath(); ctx.fill();
  }

  function drawCrescent(c, light, dark, wingT) {
    const s = c.size;
    // Moon glow
    const grad = ctx.createRadialGradient(-s * 0.10, 0, s * 0.20, -s * 0.10, 0, s * 0.80);
    grad.addColorStop(0, 'rgba(255,232,51,0.25)');
    grad.addColorStop(1, 'rgba(255,232,51,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(-s * 0.10, 0, s * 0.80, 0, Math.PI * 2); ctx.fill();
    // Moon body
    ctx.fillStyle = '#ffe833'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Shadow bite (creates crescent)
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.arc(s * 0.25, -s * 0.05, s * 0.45, 0, Math.PI * 2); ctx.fill();
    // Tiny stars
    ctx.fillStyle = '#ffffff';
    const stars = [[0.50, -0.40], [0.60, 0.20], [0.35, 0.50], [0.70, -0.10]];
    for (const [dx, dy] of stars) {
      const twinkle = (Math.sin(wingT * 3 + dx * 10) + 1) * 0.3 + 0.4;
      ctx.globalAlpha = twinkle;
      ctx.beginPath(); ctx.arc(s * dx, s * dy, s * 0.025, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawCalendar(c, light, dark, wingT) {
    const s = c.size;
    // Main page
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.fillRect(-s * 0.50, -s * 0.40, s * 1.00, s * 1.05);
    ctx.strokeRect(-s * 0.50, -s * 0.40, s * 1.00, s * 1.05);
    // Red header
    ctx.fillStyle = '#e02020';
    ctx.fillRect(-s * 0.50, -s * 0.40, s * 1.00, s * 0.25);
    ctx.strokeRect(-s * 0.50, -s * 0.40, s * 1.00, s * 0.25);
    // Rings
    ctx.fillStyle = '#c0c0c0';
    ctx.beginPath(); ctx.arc(-s * 0.25, -s * 0.40, s * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.25, -s * 0.40, s * 0.04, 0, Math.PI * 2); ctx.fill();
    // Day grid
    ctx.fillStyle = '#333';
    ctx.font = `700 ${Math.max(4, s * 0.09)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let r = 0; r < 3; r++) {
      for (let ci = 0; ci < 5; ci++) {
        const d = r * 5 + ci + 1;
        ctx.fillText('' + d, -s * 0.30 + ci * s * 0.15, s * 0.00 + r * s * 0.18);
      }
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // Peeling page corner
    const peel = Math.sin(wingT * 1.5) * s * 0.03;
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.moveTo(s * 0.50, -s * 0.40);
    ctx.lineTo(s * 0.30 + peel, -s * 0.40);
    ctx.lineTo(s * 0.50, -s * 0.60 - peel);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // X marks on some days
    ctx.strokeStyle = '#e02020'; ctx.lineWidth = 1.5;
    const xdays = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1]];
    for (const [ci, r] of xdays) {
      const dx = -s * 0.30 + ci * s * 0.15;
      const dy = s * 0.00 + r * s * 0.18;
      ctx.beginPath(); ctx.moveTo(dx - s * 0.04, dy - s * 0.04); ctx.lineTo(dx + s * 0.04, dy + s * 0.04); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(dx + s * 0.04, dy - s * 0.04); ctx.lineTo(dx - s * 0.04, dy + s * 0.04); ctx.stroke();
    }
  }

  function drawTourbus(c, light, dark, wingT) {
    const s = c.size;
    const bounce = Math.abs(Math.sin(wingT * 3)) * s * 0.02;
    ctx.save(); ctx.translate(0, -bounce);
    // Bus body
    ctx.fillStyle = '#1a1a1a'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, -s * 0.20);
    ctx.quadraticCurveTo(-s * 0.85, -s * 0.45, -s * 0.70, -s * 0.45);
    ctx.lineTo(s * 0.70, -s * 0.45);
    ctx.quadraticCurveTo(s * 0.85, -s * 0.45, s * 0.85, -s * 0.20);
    ctx.lineTo(s * 0.85, s * 0.25);
    ctx.lineTo(-s * 0.85, s * 0.25);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Windows
    ctx.fillStyle = '#4ad8ff';
    const wins = [-0.60, -0.30, 0, 0.30, 0.60];
    for (const wx of wins) {
      ctx.fillRect(s * (wx - 0.10), -s * 0.38, s * 0.18, s * 0.18);
      ctx.strokeRect(s * (wx - 0.10), -s * 0.38, s * 0.18, s * 0.18);
    }
    // Stripe
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(-s * 0.85, -s * 0.08, s * 1.70, s * 0.10);
    // Wheels
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(-s * 0.50, s * 0.35, s * 0.14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.50, s * 0.35, s * 0.14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Hubcaps
    ctx.fillStyle = '#888';
    ctx.beginPath(); ctx.arc(-s * 0.50, s * 0.35, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.50, s * 0.35, s * 0.06, 0, Math.PI * 2); ctx.fill();
    // "KANI" on side
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.max(5, s * 0.12)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('KANI', 0, s * 0.12);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  function drawCandybar(c, light, dark, wingT) {
    const s = c.size;
    // Gold foil wrapper (partially unwrapped)
    ctx.fillStyle = '#c89040'; ctx.strokeStyle = '#0e0e0e'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.60, -s * 0.30);
    ctx.lineTo(-s * 0.60, s * 0.30);
    ctx.lineTo(s * 0.20, s * 0.30);
    ctx.lineTo(s * 0.20, -s * 0.30);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Peeled back foil
    ctx.fillStyle = '#deb866';
    ctx.beginPath();
    ctx.moveTo(s * 0.20, -s * 0.30);
    ctx.quadraticCurveTo(s * 0.30, -s * 0.50, s * 0.10, -s * 0.55);
    ctx.lineTo(-s * 0.10, -s * 0.45);
    ctx.lineTo(s * 0.20, -s * 0.30);
    ctx.fill(); ctx.stroke();
    // Exposed chocolate
    ctx.fillStyle = '#5a2800';
    ctx.fillRect(s * 0.20, -s * 0.28, s * 0.45, s * 0.56);
    ctx.strokeRect(s * 0.20, -s * 0.28, s * 0.45, s * 0.56);
    // Rolo caramel cup shapes
    ctx.fillStyle = '#c07020';
    for (let i = 0; i < 3; i++) {
      const rx = s * 0.30 + i * s * 0.12;
      ctx.beginPath(); ctx.arc(rx, 0, s * 0.08, 0, Math.PI * 2); ctx.fill();
      // Caramel center
      ctx.fillStyle = '#deb866';
      ctx.beginPath(); ctx.arc(rx, 0, s * 0.04, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c07020';
    }
    // "ROLO" on wrapper
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.max(4, s * 0.11)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ROLO', -s * 0.20, 0);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // -------------------------------------------------------
  // CREATURE DRAW — translates/rotates/scales then dispatches
  // to the type-specific routine.
  // -------------------------------------------------------
  function updateCreature(c, t) {
    let x = c.baseX + Math.sin(t * c.driftSpeedX + c.driftPhase) * c.driftAmpX;
    let y = c.baseY + Math.cos(t * c.driftSpeedY + c.driftPhase * 0.7) * c.driftAmpY;
    // b058 — gentle attraction toward cursor (within 100px). Pulls
    // creatures up to ~22px toward mx/my so the wall feels alive
    // when you move the mouse around. Disabled when no cursor
    // (mx === -9999) and on mobile (no hover concept).
    if (mx > 0 && my > 0) {
      const dx = mx - x;
      const dy = my - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const range = 100;
      if (d < range && d > 0.01) {
        const pull = (1 - d / range) * 22;
        x += (dx / d) * pull;
        y += (dy / d) * pull;
      }
    }
    c.x = x;
    c.y = y;
    c.rot += c.rotSpeed * 0.02;
  }

  function drawCreature(c, t, isHover, bands) {
    const bass = bands ? bands.bass : 0;
    const mid = bands ? bands.mid : 0;
    const targetScale = isHover ? 1.35 : (1 + bass * 0.18);
    c.scale += (targetScale - c.scale) * 0.18;

    const [light, dark] = PALETTE[c.colorIdx];
    // b059 — wing/spin animation speedup tied to mid-band audio.
    // 0 mid → normal speed; 1 mid → 2.2x.
    const wingT = (t + c.wingPhase) * (1 + mid * 1.2);

    // b059 — apply depth alpha (back layer = 0.55, mid/front = 1.0).
    // Neighborhood creatures of the playing track get a +0.18 boost
    // so they visibly "light up" near the playing one.
    const baseAlpha = c.depthAlpha + (c.inNeighborhood ? 0.20 : 0);
    const drawAlpha = Math.min(1, baseAlpha);

    ctx.save();
    ctx.globalAlpha = drawAlpha;

    // b057 — soft additive glow halo, b059 mobile-skipped.
    // Front-depth creatures get a slightly stronger halo.
    if (!isMobile()) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const haloMult = c.depth === 2 ? 1.15 : 1.0;
      const haloR = c.size * c.scale * (isHover ? 2.1 : 1.5) * haloMult;
      const halo = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, haloR);
      halo.addColorStop(0, hexToRgba(light, isHover ? 0.28 : 0.10));
      halo.addColorStop(1, hexToRgba(light, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(c.x - haloR, c.y - haloR, haloR * 2, haloR * 2);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(c.x, c.y);
    // Some creatures have intentional non-rotating orientation
    const noRot = c.type === 'butterfly' || c.type === 'fish' ||
                  c.type === 'rocket' || c.type === 'note' ||
                  c.type === 'mushroom' || c.type === 'bee' ||
                  c.type === 'helmet' || c.type === 'supercar' ||
                  c.type === 'pillowcase' ||
                  // b061 — additional override types stay upright
                  c.type === 'spaceship' || c.type === 'hotelsign' ||
                  c.type === 'coffeecup' || c.type === 'robotbody' ||
                  c.type === 'discoball' || c.type === 'mariostar' ||
                  c.type === 'chainlink' || c.type === 'wonkysmile' ||
                  c.type === 'villainmask' ||
                  // b063 — 12 more upright override types
                  c.type === 'thunderbird' || c.type === 'sun' ||
                  c.type === 'grenade' || c.type === 'boombox' ||
                  c.type === 'lemon' || c.type === 'beachhut' ||
                  c.type === 'skull' || c.type === 'roadsign' ||
                  c.type === 'cashstack' || c.type === 'cake' ||
                  c.type === 'wallet' || c.type === 'lotusflower' ||
                  // b064 — 15 more
                  c.type === 'house' || c.type === 'bigheart' ||
                  c.type === 'spotlight' || c.type === 'book' ||
                  c.type === 'lightbolt' || c.type === 'trafficlight' ||
                  c.type === 'windmill' || c.type === 'fist' ||
                  c.type === 'shroom' || c.type === 'sneaker' ||
                  c.type === 'shoebox' || c.type === 'twohearts' ||
                  c.type === 'vinyldisc' || c.type === 'guitarpick' ||
                  c.type === 'crown';
    if (!noRot) {
      ctx.rotate(c.rot * 0.3);
    }
    ctx.scale(c.scale, c.scale);

    switch (c.type) {
      case 'butterfly': drawButterfly(c, light, dark, wingT); break;
      case 'drone':     drawDrone(c, light, dark, wingT); break;
      case 'jellyfish': drawJellyfish(c, light, dark, wingT); break;
      case 'fish':      drawFish(c, light, dark, wingT); break;
      case 'comet':     drawComet(c, light, dark, wingT); break;
      case 'beetle':    drawBeetle(c, light, dark, wingT); break;
      case 'eye':       drawEye(c, light, dark, wingT); break;
      case 'crystal':   drawCrystal(c, light, dark, wingT); break;
      case 'ufo':       drawUfo(c, light, dark, wingT); break;
      case 'planet':    drawPlanet(c, light, dark, wingT); break;
      case 'rocket':    drawRocket(c, light, dark, wingT); break;
      case 'ghost':     drawGhost(c, light, dark, wingT); break;
      case 'bird':      drawBird(c, light, dark, wingT); break;
      case 'bee':       drawBee(c, light, dark, wingT); break;
      case 'flower':    drawFlower(c, light, dark, wingT); break;
      case 'mushroom':  drawMushroom(c, light, dark, wingT); break;
      case 'octopus':   drawOctopus(c, light, dark, wingT); break;
      case 'bat':       drawBat(c, light, dark, wingT); break;
      case 'note':      drawNote(c, light, dark, wingT); break;
      case 'cassette':  drawCassette(c, light, dark, wingT); break;
      // b060 — per-track override art
      case 'helmet':     drawHelmet(c, light, dark, wingT); break;
      case 'supercar':   drawSupercar(c, light, dark, wingT); break;
      case 'pillowcase': drawPillowcase(c, light, dark, wingT); break;
      // b061 — 9 more override types
      case 'spaceship':   drawSpaceship(c, light, dark, wingT); break;
      case 'hotelsign':   drawHotelsign(c, light, dark, wingT); break;
      case 'coffeecup':   drawCoffeecup(c, light, dark, wingT); break;
      case 'robotbody':   drawRobotbody(c, light, dark, wingT); break;
      case 'discoball':   drawDiscoball(c, light, dark, wingT); break;
      case 'mariostar':   drawMariostar(c, light, dark, wingT); break;
      case 'chainlink':   drawChainlink(c, light, dark, wingT); break;
      case 'wonkysmile':  drawWonkysmile(c, light, dark, wingT); break;
      case 'villainmask': drawVillainmask(c, light, dark, wingT); break;
      // b063 — 12 more override types
      case 'thunderbird': drawThunderbird(c, light, dark, wingT); break;
      case 'sun':         drawSun(c, light, dark, wingT); break;
      case 'grenade':     drawGrenade(c, light, dark, wingT); break;
      case 'boombox':     drawBoombox(c, light, dark, wingT); break;
      case 'lemon':       drawLemon(c, light, dark, wingT); break;
      case 'beachhut':    drawBeachhut(c, light, dark, wingT); break;
      case 'skull':       drawSkull(c, light, dark, wingT); break;
      case 'roadsign':    drawRoadsign(c, light, dark, wingT); break;
      case 'cashstack':   drawCashstack(c, light, dark, wingT); break;
      case 'cake':        drawCake(c, light, dark, wingT); break;
      case 'wallet':      drawWallet(c, light, dark, wingT); break;
      case 'lotusflower': drawLotusflower(c, light, dark, wingT); break;
      // b064 — 15 more override types
      case 'thunderbird':  drawThunderbird(c, light, dark, wingT); break;
      case 'sun':          drawSun(c, light, dark, wingT); break;
      case 'grenade':      drawGrenade(c, light, dark, wingT); break;
      case 'boombox':      drawBoombox(c, light, dark, wingT); break;
      case 'lemon':        drawLemon(c, light, dark, wingT); break;
      case 'beachhut':     drawBeachhut(c, light, dark, wingT); break;
      case 'skull':        drawSkull(c, light, dark, wingT); break;
      case 'roadsign':     drawRoadsign(c, light, dark, wingT); break;
      case 'cashstack':    drawCashstack(c, light, dark, wingT); break;
      case 'cake':         drawCake(c, light, dark, wingT); break;
      case 'wallet':       drawWallet(c, light, dark, wingT); break;
      case 'lotusflower':  drawLotusflower(c, light, dark, wingT); break;
      case 'house':        drawHouse(c, light, dark, wingT); break;
      case 'bigheart':     drawBigheart(c, light, dark, wingT); break;
      case 'spotlight':    drawSpotlight(c, light, dark, wingT); break;
      case 'book':         drawBook(c, light, dark, wingT); break;
      case 'lightbolt':    drawLightbolt(c, light, dark, wingT); break;
      case 'trafficlight': drawTrafficlight(c, light, dark, wingT); break;
      case 'windmill':     drawWindmill(c, light, dark, wingT); break;
      case 'fist':         drawFist(c, light, dark, wingT); break;
      case 'shroom':       drawShroom(c, light, dark, wingT); break;
      case 'sneaker':      drawSneaker(c, light, dark, wingT); break;
      case 'shoebox':      drawShoebox(c, light, dark, wingT); break;
      case 'twohearts':    drawTwohearts(c, light, dark, wingT); break;
      case 'vinyldisc':    drawVinyldisc(c, light, dark, wingT); break;
      case 'guitarpick':   drawGuitarpick(c, light, dark, wingT); break;
      case 'crown':        drawCrown(c, light, dark, wingT); break;
      case 'bluntwrap':    drawBluntwrap(c, light, dark, wingT); break;
      case 'beehive':      drawBeehive(c, light, dark, wingT); break;
      case 'galaxy':       drawGalaxy(c, light, dark, wingT); break;
      case 'akira':        drawAkira(c, light, dark, wingT); break;
      case 'riotshield':   drawRiotshield(c, light, dark, wingT); break;
      case 'snowflake':    drawSnowflake(c, light, dark, wingT); break;
      case 'raincloud':    drawRaincloud(c, light, dark, wingT); break;
      case 'soulfire':     drawSoulfire(c, light, dark, wingT); break;
      case 'treehouse':    drawTreehouse(c, light, dark, wingT); break;
      case 'compass':      drawCompass(c, light, dark, wingT); break;
      case 'bottle':       drawBottle(c, light, dark, wingT); break;
      case 'beret':        drawBeret(c, light, dark, wingT); break;
      case 'sparklymic':   drawSparklymic(c, light, dark, wingT); break;
      case 'icecream':     drawIcecream(c, light, dark, wingT); break;
      case 'brain':        drawBrain(c, light, dark, wingT); break;
      case 'anchor':       drawAnchor(c, light, dark, wingT); break;
      case 'nophone':      drawNophone(c, light, dark, wingT); break;
      case 'quill':        drawQuill(c, light, dark, wingT); break;
      case 'diamond':      drawDiamond(c, light, dark, wingT); break;
      case 'falleaf':      drawFalleaf(c, light, dark, wingT); break;
      case 'firepit':      drawFirepit(c, light, dark, wingT); break;
      case 'electricguitar': drawElectricguitar(c, light, dark, wingT); break;
      case 'crosshair':    drawCrosshair(c, light, dark, wingT); break;
      case 'brokencd':     drawBrokencd(c, light, dark, wingT); break;
      case 'hourglass':    drawHourglass(c, light, dark, wingT); break;
      case 'laughskull':   drawLaughskull(c, light, dark, wingT); break;
      case 'sourcandy':    drawSourcandy(c, light, dark, wingT); break;
      case 'duffel':       drawDuffel(c, light, dark, wingT); break;
      case 'stophand':     drawStophand(c, light, dark, wingT); break;
      case 'masks':        drawMasks(c, light, dark, wingT); break;
      case 'trophy':       drawTrophy(c, light, dark, wingT); break;
      case 'crescent':     drawCrescent(c, light, dark, wingT); break;
      case 'calendar':     drawCalendar(c, light, dark, wingT); break;
      case 'tourbus':      drawTourbus(c, light, dark, wingT); break;
      case 'candybar':     drawCandybar(c, light, dark, wingT); break;
    }

    ctx.restore();  // pops translate/rotate/scale
    ctx.restore();  // b059 — pops the outer globalAlpha (depthAlpha)
  }

  // -------------------------------------------------------
  // hexToRgba — turn a #rrggbb string into rgba(...) for
  // the bloom halo gradient. Cheap, one match per call.
  // -------------------------------------------------------
  function hexToRgba(hex, a) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return `rgba(255,255,255,${a})`;
    return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
  }

  // -------------------------------------------------------
  // HIT TEST — circular distance check against each
  // creature's effective radius. Cheap; 117 iterations on
  // mousemove is nothing.
  // -------------------------------------------------------
  function hitTest() {
    hovered = -1;
    if (mx < 0 || my < 0) return;
    let bestD2 = Infinity;
    for (let i = 0; i < creatures.length; i++) {
      const c = creatures[i];
      const dx = mx - c.x;
      const dy = my - c.y;
      const d2 = dx * dx + dy * dy;
      const r = c.size * c.scale * 1.1;
      if (d2 <= r * r && d2 < bestD2) {
        bestD2 = d2;
        hovered = i;
      }
    }
    if (canvas) canvas.style.cursor = hovered >= 0 ? 'pointer' : 'default';
  }

  // -------------------------------------------------------
  // HOVER TOOLTIP — small label near the hovered creature
  // -------------------------------------------------------
  function drawTooltip(c) {
    const label = c.title.toUpperCase();
    const padX = 10, padY = 6;
    ctx.font = '900 12px "JetBrains Mono", monospace';
    const w = ctx.measureText(label).width + padX * 2;
    const h = 22;
    let tx = c.x + c.size + 8;
    let ty = c.y - h - 6;
    if (tx + w > W - 4) tx = c.x - w - c.size - 8;
    if (ty < 4) ty = c.y + c.size + 6;

    // Shadow
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(tx + 3, ty + 3, w, h);
    // Body
    ctx.fillStyle = '#9cff3a';
    ctx.fillRect(tx, ty, w, h);
    // Outline
    ctx.strokeStyle = '#0e0e0e';
    ctx.lineWidth = 2;
    ctx.strokeRect(tx, ty, w, h);
    // Text
    ctx.fillStyle = '#0e0e0e';
    ctx.textBaseline = 'top';
    ctx.fillText(label, tx + padX, ty + padY);
  }

  // -------------------------------------------------------
  // AUDIO REACT — b059 split into 3 bands (bass / mid / treble)
  // for richer reactivity than the b056 single-scalar beat.
  //   bass   → creature scale pulse (0..0.18)
  //   mid    → wing/spin animation speedup (0..1.2x extra)
  //   treble → background nebula brightness pulse (0..0.30)
  // -------------------------------------------------------
  function getAudioBands() {
    if (typeof getFrequencyData !== 'function') {
      return { bass: 0, mid: 0, treble: 0 };
    }
    const data = getFrequencyData();
    if (!data || data.length === 0) return { bass: 0, mid: 0, treble: 0 };
    let b = 0, m = 0, tr = 0;
    const bassEnd = Math.min(5, data.length);
    const midEnd = Math.min(31, data.length);
    for (let i = 0; i < bassEnd; i++) b += data[i];
    for (let i = bassEnd; i < midEnd; i++) m += data[i];
    for (let i = midEnd; i < data.length; i++) tr += data[i];
    const bassN = bassEnd || 1;
    const midN = (midEnd - bassEnd) || 1;
    const treN = (data.length - midEnd) || 1;
    return {
      bass:   Math.min(1, (b / bassN) / 200),
      mid:    Math.min(1, (m / midN) / 200),
      treble: Math.min(1, (tr / treN) / 200),
    };
  }

  // -------------------------------------------------------
  function draw() {
    if (!ctx || !canvas) return;
    const t = (performance.now() - t0) * 0.001;
    const bands = getAudioBands();

    drawBackground(t, bands);
    drawGlyphs(t);

    // Update creature positions BEFORE hit test so the
    // current frame's positions are what we test against.
    for (let i = 0; i < creatures.length; i++) updateCreature(creatures[i], t);
    hitTest();

    // b059 — find creatures whose track is currently playing,
    // then mark all creatures within 200px of any playing one
    // as "in neighborhood". They get a +0.20 alpha boost in
    // drawCreature so the wall visibly clusters around the song.
    const playingIdx = (typeof state !== 'undefined' && state) ? state.currentTrack : -1;
    const playingCreatures = [];
    for (const c of creatures) {
      c.inNeighborhood = false;
      if (playingIdx >= 0 && c.trackIndex === playingIdx) playingCreatures.push(c);
    }
    if (playingCreatures.length > 0) {
      for (const c of creatures) {
        if (c.trackIndex === playingIdx) continue;
        for (const p of playingCreatures) {
          const dx = p.x - c.x;
          const dy = p.y - c.y;
          if (dx * dx + dy * dy < 200 * 200) {
            c.inNeighborhood = true;
            break;
          }
        }
      }
    }

    // b059 — constellation lines: faint white pair lines that
    // stretch as creatures drift. Drawn UNDER everything else
    // so they read as a star map background layer.
    if (constellations.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      for (const [i, j] of constellations) {
        const a = creatures[i], b = creatures[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 130) continue;  // hide stretched lines (cursor pulled apart)
        ctx.globalAlpha = (1 - d / 130) * 0.10;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // b059 — neighborhood connection lines: faint lime lines
    // from each playing creature to each creature in its
    // neighborhood. Distance-falloff alpha.
    if (playingCreatures.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#9cff3a';
      ctx.lineWidth = 1.2;
      for (const p of playingCreatures) {
        for (const c of creatures) {
          if (!c.inNeighborhood) continue;
          const dx = p.x - c.x;
          const dy = p.y - c.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 200 || d < 0.01) continue;
          ctx.globalAlpha = (1 - d / 200) * 0.45;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // b058 — cursor connecting lines: thin lime threads from
    // the cursor to any creature within 90px. Skipped on mobile.
    if (mx > 0 && my > 0 && !isMobile()) {
      ctx.save();
      ctx.strokeStyle = 'rgba(156,255,58,0.30)';
      ctx.lineWidth = 1;
      for (const c of creatures) {
        const dx = c.x - mx;
        const dy = c.y - my;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 90 && d > 0.01) {
          ctx.globalAlpha = (1 - d / 90) * 0.5;
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // b059 — 3-pass parallax draw order: back → mid → front.
    // Hovered always drawn last on top. Within each depth pass
    // we skip the hovered index.
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < creatures.length; i++) {
        if (creatures[i].depth !== pass) continue;
        if (i === hovered) continue;
        drawCreature(creatures[i], t, false, bands);
      }
    }

    // b058 — currently-playing ring AFTER creatures so it sits
    // on top. Slow rotating dashed lime circle around the
    // creature(s) whose trackIndex matches the playing track.
    if (playingIdx >= 0) {
      for (const c of playingCreatures) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(t * 0.6);
        ctx.strokeStyle = '#9cff3a';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, c.size * c.scale * 1.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // b058 — info panel.
    const lab = document.getElementById('wallLabel');
    const tit = document.getElementById('wallTitle');
    const showToast = performance.now() < toastUntil;

    if (hovered >= 0) {
      drawCreature(creatures[hovered], t, true, bands);
      drawTooltip(creatures[hovered]);
      if (lab) lab.textContent = showToast ? toastText : ('▸ ' + creatures[hovered].title.toLowerCase());
      if (tit) tit.style.display = 'none';
    } else {
      if (lab) lab.textContent = showToast ? toastText : 'click any creature →';
      if (tit) tit.style.display = 'none';
    }

    // b058 — burst rings: expand + fade over 700ms.
    // Drawn last so they sit above everything.
    const now = performance.now();
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      const age = (now - b.birth) / 700;
      if (age >= 1) { bursts.splice(i, 1); continue; }
      const r = 12 + age * 70;
      ctx.save();
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = (1 - age) * 0.85;
      ctx.lineWidth = 3 * (1 - age) + 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.stroke();
      // inner faint ring
      ctx.globalAlpha = (1 - age) * 0.4;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    rafId = requestAnimationFrame(draw);
  }

  // -------------------------------------------------------
  function onSearch(/* q */) {
    const meta = document.getElementById('wallMeta');
    if (meta) meta.textContent = `${(window.tracks || []).length} tracks adrift`;
  }

  registerView('wall', { init, destroy, onSearch });
})();
