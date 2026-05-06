# THEME.md — cantmute.me redesign spec

**Status:** drafted at b106, after the Text Galaxy (`/`) landed. Used to reskin the rest of the site (`/tracks`, `/t/<slug>`, `/p/<slug>`, `/scenes`) in the next chat. Pair this with a fresh Claude session — paste in or reference at the start so the new chat has the theme locked.

> ⚠ **Do not push to Vercel / deploy** while iterating. All work is localhost-only until the user explicitly says ship.

---

## Reference

Primary aesthetic reference: **Beta Decay** (game by Rotoscope Studios) — https://www.rotoscopestudios.com

Pull-quote from the user: *"dark grimy pilated low poly like this but for mechs grimy extraction survival thing."*

What we're emulating from Beta Decay's site:
- Pure black / near-black ground state, **selective** accent colors (no neon, no candy bloom).
- **Blood-red kicker labels** above big titles (e.g. `NOWA ATMOSFERA` over `ESTETYKA`).
- **Wide-condensed all-caps display type** (Eurostile-extended-ish) for titles. Body copy is small and narrow.
- Heavy **pixel/dither texture** baked into imagery — the "pilated low-poly" look. Looks like the whole render is downsampled 2/3 then nearest-neighbor upscaled.
- Cinemascope strips with hard letterbox bars between sections.
- Underlined accent terms inside body copy (linked terms get a red underline).
- Desaturated, matte, grimy. Not glossy, not lit.

What we are NOT doing:
- No Marathon-style register marks, vertical "CANTMUTE" lockup, `[ X ]` framed brutalist buttons. (b101–b103 territory — explicitly killed.)
- No lime-green / neon accent colors. Lime is dead. Red is the new accent.
- No heavy candy bloom. Lower it. Beta Decay is matte.

---

## Palette

```
/* Backgrounds */
--bg-void:        #000000   /* outer space, full dark */
--bg-page:        #050507   /* near-black canvas */
--bg-card:        #0a0c10   /* card surface */
--bg-elev:        #11141a   /* hover state, raised */
--border-faint:   #1a1d22
--border:         #2a2e35

/* Text */
--text:           #c8c8c0   /* body copy — slightly warm off-white, NOT pure white */
--text-muted:     #6a6a64
--text-faint:     #3a3a36
--text-strong:    #ffffff   /* reserved for active state / hovered titles only */

/* Accents */
--accent-red:     #c0151c   /* PRIMARY — kicker labels, active links, focus indicators */
--accent-red-deep:#7a0a0e   /* hover state on red, backdrop tints */
--accent-amber:   #c08530   /* SECONDARY — used sparingly (custom annotations, weapon highlights) */
--accent-steel:   #5a5e60   /* tertiary — neutral industrial gray */
--accent-khaki:   #8a7a3c   /* atmospheric tint (only behind hero imagery, not body chrome) */
```

**Rule:** body chrome is grayscale + red. Amber and khaki only show up in imagery overlays / specific accent moments. Don't paint UI in amber.

---

## Typography

```
--font-display:  'Saira',      'Eurostile Extended', 'Bank Gothic', sans-serif;
--font-display-fallback: 'Space Grotesk',  Inter, system-ui, sans-serif;
--font-body:     'Saira Condensed', 'Inter', system-ui, sans-serif;
--font-mono:     'Space Mono', 'SF Mono', ui-monospace, Menlo, monospace;
```

Load from Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Saira:wght@500;600;700;800;900&family=Saira+Condensed:wght@400;600;700&family=Space+Grotesk:wght@400;600;700;800&family=Space+Mono&display=swap" rel="stylesheet">
```

Type rules:
- **Display titles:** `Saira` 800–900, `letter-spacing: 0.04em`, `text-transform: uppercase`. Big sizes 48–144px depending on context. Hero titles get `font-stretch: expanded` if the browser supports it.
- **Body copy:** `Saira Condensed` 400, 14–16px, `line-height: 1.5`, color `--text`.
- **Kicker labels:** `Space Mono` 10–11px, `letter-spacing: 0.18em`, all-caps, color `--accent-red`. Always sit ABOVE the display title with 8–14px gap. This is the hallmark Beta Decay move.
- **In-body accents:** important terms get an `<u>` or `border-bottom: 1px solid var(--accent-red); color: var(--accent-red);` — like the Beta Decay site links.

---

## Layout primitives

### Cinemascope strip
Reusable section pattern. Full-bleed horizontal with hard letterbox bars between strips.
```
.strip {
  position: relative;
  width: 100%;
  aspect-ratio: 21 / 6;            /* cinemascope */
  background: var(--bg-page);
  overflow: hidden;
  border-top:    1px solid #000;
  border-bottom: 1px solid #000;
}
.strip-bg {                        /* big atmospheric image */
  position: absolute; inset: 0;
  background-size: cover; background-position: center;
  filter: contrast(1.05) saturate(.55) brightness(.65);
  /* dithered look, see below */
}
.strip-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(90deg, rgba(0,0,0,.85) 0%, rgba(0,0,0,.30) 50%, rgba(0,0,0,.75) 100%);
}
.strip-content {
  position: relative; z-index: 2;
  max-width: 540px; margin: 0 auto;     /* narrow column, like Beta Decay */
  padding: 0 28px;
  /* center vertically via grid/flex on parent */
}
.strip .kicker { color: var(--accent-red); font-family: var(--font-mono); font-size: 11px;
  letter-spacing: .18em; text-transform: uppercase; margin-bottom: 12px; }
.strip .title  { font-family: var(--font-display); font-weight: 800; font-size: clamp(32px, 5vw, 72px);
  letter-spacing: .04em; text-transform: uppercase; color: var(--text-strong); margin: 0 0 16px; line-height: 1; }
.strip .body   { color: var(--text); font-size: 14px; line-height: 1.55; max-width: 380px; }
.strip .body u, .strip .body a { color: var(--accent-red); border-bottom: 1px solid var(--accent-red); text-decoration: none; }
```

### Pixelation / "pilated" texture
Two ways to apply it; pick per-context:

1. **Render-time pixelate** (for WebGL canvases / on-page Three scenes): render to a `WebGLRenderTarget` at `0.62×` viewport, then upscale with `THREE.NearestFilter` to the canvas. We already do this technique for the villa scene's PS2-style render in `js/world.js` — copy that pattern.

2. **CSS pixelate overlay** (for static `<img>` and CSS backgrounds):
```css
.pixelate {
  image-rendering: pixelated;
  filter: contrast(1.10) brightness(.85) saturate(.7);
  /* SVG mosaic filter for fine grain */
  filter: url(#dither);
}
/* paired SVG defs in body: */
<svg style="position:absolute;width:0;height:0">
  <filter id="dither">
    <feTurbulence baseFrequency=".7" numOctaves="2" stitchTiles="stitch"/>
    <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .15 0"/>
    <feComposite in2="SourceGraphic" operator="in"/>
    <feComposite in="SourceGraphic" operator="over"/>
  </filter>
</svg>
```

### Grain overlay (global, persistent)
```css
body::after {
  content: ""; position: fixed; inset: 0; z-index: 1000; pointer-events: none;
  opacity: .08; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg ...fractalNoise...>");
}
```
Already exists in `index.html` (b099+) — match the existing pattern but bump opacity from .06 → .09 for grimier feel.

---

## Component specs

### Kicker + title pair
The signature Beta Decay move. Use it everywhere a section needs framing.
```html
<div class="kicker">— now playing —</div>
<h1 class="title">odst</h1>
<div class="body">
  Released 2026 · <u>featured</u> · <u>archive</u>
</div>
```

### Buttons
No box frames. No `[ X ]` brackets. Underline-only.
```css
.btn-link {
  background: none; border: none; padding: 4px 0; cursor: pointer;
  font-family: var(--font-display); font-weight: 700; font-size: 16px;
  color: var(--text-strong); border-bottom: 1px solid var(--text-strong);
  text-transform: uppercase; letter-spacing: .04em;
  transition: color .15s, border-color .15s, transform .2s;
}
.btn-link:hover { color: var(--accent-red); border-color: var(--accent-red); transform: translateY(-1px); }
.btn-link.dim { color: var(--text-muted); border-color: var(--text-muted); }
.btn-link.dim:hover { color: var(--text-strong); border-color: var(--text-strong); }
```

### Cards (track row, playlist tile)
```css
.card {
  background: var(--bg-card); border: 1px solid var(--border-faint);
  padding: 18px 20px; transition: border-color .15s, background .15s;
}
.card:hover { background: var(--bg-elev); border-color: var(--accent-red-deep); }
.card .title { font-family: var(--font-display); font-weight: 700; font-size: 22px;
  text-transform: uppercase; letter-spacing: .03em; color: var(--text-strong); margin: 0 0 4px; }
.card .meta  { font-family: var(--font-mono); font-size: 11px; letter-spacing: .12em;
  color: var(--text-muted); text-transform: uppercase; }
```

### Catalog grid (the new `/tracks`)
Replace the existing editorial layout. Same content, new shell:
- Top: small kicker `KANI · CATALOG`, big display title `cantmute.me / 117 tracks`, subtitle row with filter pills.
- Filter pills are mono red on hover, no boxes.
- Track list as a column of `.card` rows (not the dense ed-track minimal grid). Each row: cover thumbnail (pixelated), title, year, tag, play button.
- Hover a row → row gets the b106 glitch treatment (subtle title RGB-split + scanline carve-outs). Reuse the `TITLE_FRAGMENT` shader as a CSS-equivalent (less aggressive — body copy doesn't need full glitch).

### Track page (the new `/t/<slug>`)
Fully replace `viewTrack()` in [index.html:1343-1408](index.html#L1343-L1408). New structure:
- Cinemascope hero strip with the cover art as `.strip-bg`, pixelated.
- `.strip-content`: kicker `INCOMING SIGNAL`, big track title, mono meta line, two underline buttons (`▶ PLAY`, `↗ SOUNDCLOUD`).
- Below: a body section with the description, credits, and tags. Same narrow column pattern.
- "More from Kani" related-tracks row at bottom — reuse the new `.card` style.

### Scenes selector (the new `/scenes`)
Currently `scenes/index.html` mounts the entire 3D scene app. Replace with a **selector** that shows the existing scenes as cinemascope strips, each linking to its own URL. From the user's message: *"for scenes, we can have a scene selector that shows the other projects we did, and ofc when time comes we'll give them their own unique urls so it doesn't fuk with cantmute.me and this new theme."*

Plan for the selector (no individual-URL-per-scene work yet — just the chooser page):
- Each scene gets a strip:
  - **Villa** — cinemascope with a screenshot of the Miami villa, kicker `EXPERIMENT 01`, title `NIGHT VILLA`, body about the scene, link to `/scenes/villa` (route stub for now, later moves to its own subdomain or path).
  - **Neural** — same pattern, kicker `EXPERIMENT 02`, title `NEURAL MAP`.
  - **Deep Sea** — `EXPERIMENT 03`, `DEEP DIVE`.
  - **Terrain** — `EXPERIMENT 04`, `SOUND TERRAIN`.
- For now, all link to the single existing scene app and pass a query param like `?scene=villa` so the existing router selects the right view. (Real per-scene URLs can come later.)

---

## Text Galaxy (`/`) theme adjustments

Already in place at b106:
- Glitch shader on titles (block displacement, RGB split, scanlines, dropouts).
- Tag-driven per-track color via `colorForTrack()`.
- Drag-to-look + WASD + scroll-dolly + mobile pinch.
- Brutalist HUD with lowercase Space Grotesk top-left lockup.

Theme delta needed to align with Beta Decay:
- **Drop the lowercase brand**. The HUD `kani` lockup in lowercase Space Grotesk reads too soft. Switch to: `KANI` in Saira 800 uppercase + tiny mono kicker `BROADCAST 2026` above. (But: kicker should NOT use the brutalist Marathon language. Keep it editorial.)
- **Lower bloom strength** (currently 0.80 base + 0.45 bass). Drop to 0.45 base + 0.30 bass. Beta Decay is matte, not candy.
- **Pump grain + scanlines** in the post pass. Grain currently 0.045 → 0.08. Scanline modulation 0.06 → 0.10.
- **Recolor `TAG_HUE` palette**: shift HSL values toward Beta Decay desaturated range (sat 0.55–0.70, lightness 0.55–0.65). Add `--accent-red` (#c0151c) for `hard / aggressive / rage` tags.
- **Per-title kicker labels**: when hovered, show a small red mono kicker above the title in the bottom-right HUD ("FEATURED", "SIGNAL 047", year). Already we just show the title — add the kicker line.
- **Render-target downsample** for that pilated look — render at 0.65× then nearest-neighbor upscale. Lift the technique from `js/world.js` (villa's PS2 renderer).

---

## Files to touch in next chat

Priority 1 (theme rollout):
- [ ] `index.html` — add Saira fonts to `<link>`, swap CSS variables, replace `viewEditorial()` styling with cinemascope strip pattern.
- [ ] `index.html` `viewTrack()` — full rewrite with the new track-page pattern.
- [ ] `index.html` `viewPlaylist()` and `viewPlaylists()` — same pattern.
- [ ] `js/marathon-world.js` — apply the Text Galaxy theme delta listed above (lower bloom, more grain, recolor palette, render-target downsample, per-title kicker).
- [ ] `style.css` — add the new theme variables to `:root`, repoint legacy classes if any are still referenced.

Priority 2 (scenes selector):
- [ ] `scenes/index.html` — replace the scene-mount with a selector page. Build out four cinemascope strips (Villa / Neural / Deep Sea / Terrain). Wire links to `?scene=<name>` query param.
- [ ] `js/app.js` — read `?scene=` query param and boot the named scene directly.

Priority 3 (housekeeping):
- [ ] Clean up the `js/text-galaxy-pro.js` ghost mention in `FILE_MAP.md` if you don't want that file (it doesn't currently exist).
- [ ] Update `CHANGELOG.md` and bump build to b107.

---

## Where we are right now (b106 snapshot)

- `/` is the Text Galaxy (working, navigation in place, 360° scatter, vivid color, iOS PWA touches fixed).
- `/tracks` still renders the legacy editorial home — looks like a different site.
- `/t/<slug>` still renders the old 2D template with cover art + columns — also off-theme.
- `/scenes` still mounts the existing 3D scene chooser app — untouched.
- HUD on `/` is already close to right but uses lowercase soft branding instead of the cleaner Beta Decay-coded uppercase Saira.

The Text Galaxy concept is **locked**. Iterations go INTO it and out from it to the rest of the site — don't propose throwing it out. See memory `project_text_galaxy.md`.

---

## Hard reminders for next chat

1. **Don't push.** No `git push`, no `vercel deploy`, no `wrangler deploy`. Localhost only until the user says ship. See memory `feedback_no_vercel_push.md`.
2. **Update `CHANGELOG.md` and `FILE_MAP.md` and bump `js/helpers.js` build number with every code change.** Per `CLAUDE.md`.
3. **Don't ripoff Marathon.** No corner brackets, no `[ X ]` frames, no vertical sidebar lockup, no register marks. We are Beta Decay-coded now.
4. **Don't over-engineer.** Beta Decay's site is mostly static cinemascope strips with images and text — not interactive WebGL on every section. Reserve interactive WebGL for `/`. Keep `/tracks`, `/t`, `/p` as static editorial-pixelated pages with the glitch *language* but not necessarily WebGL.
