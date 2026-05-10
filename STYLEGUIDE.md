# STYLEGUIDE.md — cantmute.me current visual identity

**Status:** drafted at b138 from the live `/` (Text Galaxy) look. THEME.md (b106 Beta Decay vision) is preserved as historical reference but is NOT the current direction. This doc is what gets applied to `/tracks`, `/t/*`, `/p/*`, `/scenes`, etc.

> ⚠ **Localhost only.** Do not push to Vercel / Cloudflare while iterating. See `feedback_no_vercel_push.md`.

---

## Identity in one sentence

A pure-black void, lit only by **kinetic typography that cycles through the spectrum**, viewed through a real lens — with magenta debug surfaces, cyan/blue spacecraft, and selective post-process cinema (anamorphic flares, lens dirt, god rays).

The site is *the inside of a transmission* — a music broadcast as an interactive constellation.

---

## Palette

```css
/* Backgrounds */
--void:          #040406;   /* canvas / page background */
--surface:       rgba(8,10,16,0.92);   /* HUD panels, cards */
--surface-elev:  rgba(8,10,16,0.96);   /* admin / modal overlays */

/* Borders */
--border-faint:  rgba(255,255,255,0.10);
--border:        rgba(255,255,255,0.18);
--border-glow:   rgba(255,255,255,0.30);   /* hover */

/* Text */
--text:          #cfd5e0;   /* body */
--text-muted:    #8a93a3;   /* meta lines, time codes */
--text-faint:    #5e636e;   /* labels, secondary */
--text-strong:   #ffffff;   /* hover / focused */

/* Accents — semantic */
--accent-debug:  #ff7ec3;   /* MAGENTA — admin / debug surfaces, [ admin ] link, panel border */
--accent-active: #aef0c8;   /* GREEN — toggle ON state, mw-fx-on highlight */
--accent-warn:   #ffd28a;   /* AMBER — flash hints, info toasts */
--accent-cyan:   #66ddff;   /* CYAN — engine glows, longsword plasma, primary action */
--accent-magenta:#ff3ad8;   /* HOT MAGENTA — banshee plasma, hot accent */
--nav-red:       #ff2a3a;   /* PORT side nav-light (satellites) */
--nav-green:     #2dff66;   /* STARBOARD side nav-light */
```

**Rules:**
- Body chrome stays in `--text*` grays. Pure white is reserved for active/hovered/focused states.
- **Magenta** (`--accent-debug`) means "this is debug or admin." Don't use it for production-facing primary buttons.
- **Cyan** (`--accent-cyan`) is the primary action / engine / energy color.
- **Green** (`--accent-active`) means "this is currently ON / active." Used by FX toggles, scene-element toggles.
- The hue-cycling accent on track titles is procedural (Rodrigues hue rotation, ~0.045 rev/s) — don't copy it as a static color elsewhere.

---

## Typography

```css
--font-display:  'Space Grotesk', Inter, system-ui, sans-serif;
--font-mono:     'Space Mono', 'SF Mono', ui-monospace, Menlo, monospace;
```

(No Saira. The b106 Saira plan is dead — Space Grotesk is what shipped.)

**Type rules:**
- **Hero / track titles:** `Space Grotesk` 800, lowercase or UPPERCASE depending on context. The galaxy text constellation uses `text-transform: uppercase` baked into the canvas texture; HUD player titles use lowercase.
- **HUD body / labels:** `Space Mono` 10–12px, `letter-spacing: .04em–.08em`.
- **Section labels (admin panel, hint strips):** `Space Mono` 9–10px UPPERCASE, `letter-spacing: .08–.10em`, color `--text-faint`.
- **Hint / italic line:** `Space Mono` 9.5px italic, `--text-muted`. Used for "(no title focused → ...)" style helper text.
- **Time codes / numeric meta:** `Space Mono` 10–11px, `font-variant-numeric: tabular-nums`. Always lowercase.

---

## Layout primitives

### HUD overlay pattern (`/` reference)
The Text Galaxy's HUD is the canonical layout:
- Fixed corners (`tg-tl`, `tg-tr`, `tg-bl`, `tg-br`) anchored 24×28px from edges.
- Parent container has `pointer-events:none`, child interactive elements (`a`, `button`) get `pointer-events:auto`.
- z-index `2` for HUD, `1` for canvas, `9999+` for modals/admin.

### Card surface
```css
.surface {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 8px 28px rgba(0,0,0,0.55);
}
.surface.admin {
  background: var(--surface-elev);
  border: 2px solid var(--accent-debug);
  box-shadow: 0 12px 40px rgba(255,126,195,0.20), 0 8px 28px rgba(0,0,0,0.65);
}
```

### Buttons
Two flavors: **outline** (default) and **active** (toggled-on / primary).
```css
.btn {
  background: rgba(0,0,0,0.30);
  border: 1px solid #3a3f48;
  border-radius: 3px;
  padding: 8px 11px;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
  transition: color .15s, border-color .15s, background .15s;
}
.btn:hover { color: #fff; border-color: #fff; background: rgba(255,255,255,.08); }
.btn:active { transform: translateY(1px); }
.btn.primary { border-color: #fff; color: #fff; }   /* main play/pause, etc. */
.btn.debug   { border-color: rgba(255,90,180,.45); color: var(--accent-debug); }
.btn.debug:hover { background: rgba(255,90,180,.18); border-color: rgba(255,90,180,.85); }
.btn.active  { background: rgba(126,255,195,.10); border-color: rgba(126,255,195,.55); color: var(--accent-active); }
```

No `[ X ]` brackets. No corner registration marks. No vertical sidebar lockups.

### Progress / seek bar
```css
.bar {
  width: 100%; height: 3px;
  background: #1a1d22;
  border-radius: 2px;
  cursor: pointer;
  pointer-events: auto;
  transition: height .15s;
}
.bar:hover { height: 5px; }
.bar > .fill {
  height: 100%; width: 0%;
  background: #c8c8c0;
  border-radius: 2px;
  transition: width .12s linear;
}
```

### Nav row
Plain text links separated by spaces, single-pixel underline on hover. No buttons.
```css
.nav a {
  color: var(--text-faint);
  text-decoration: none;
  font-size: 11px;
  padding-bottom: 2px;
  border-bottom: 1px solid transparent;
  transition: color .15s, border-color .15s;
}
.nav a:hover { color: #fff; border-bottom-color: #fff; }
```

---

## Glitch language (the typography signature)

Track titles in the galaxy use a fragment shader with:
- Block displacement (28 horizontal strips, randomly x-shifted by per-block seed)
- RGB split scaling with hover/focus/bass
- Scanline modulation (`0.94 + 0.06 * sin(uv.y * 380)`)
- Per-line dropouts (random rows go transparent on glitch bursts)
- Hue rotation around (1,1,1) luminance axis driven by global `uHueShift` time uniform

For non-WebGL pages (`/tracks`, `/t/*`), use a CSS-equivalent glitch on **hover only** for big titles:
- `text-shadow: 1px 0 0 cyan, -1px 0 0 magenta` for static RGB-split feel
- Optional `clip-path: inset()` keyframe animation for occasional band cuts
- Scanline overlay via `repeating-linear-gradient` at 1px steps

---

## Post-process character

Real visuals (`/`) get the cinematic post stack. Static pages don't, but they should *feel* like they exist in the same world. Cues:
- **Background:** `--void` (`#040406`), not pure black.
- **Subtle vignette:** radial gradient overlay with `mix-blend-mode: multiply`.
- **Persistent grain:** SVG fractalNoise overlay at `opacity: 0.06–0.08`, `mix-blend-mode: overlay`. Already in `index.html` body::after.
- **Backdrop blur** behind any panel (`backdrop-filter: blur(8px)`).

Don't re-implement bloom or anamorphic flares in CSS — they only exist on the WebGL canvas.

---

## Component vocabulary

| Component | Where it lives | Style |
|---|---|---|
| **Kicker label** | Above section titles | mono 9.5px uppercase, `letter-spacing:.10em`, `--text-faint` |
| **Section title** | Hero / page H1 | Space Grotesk 800, lowercase, large (clamp 36–96px) |
| **Meta line** | Track time, year/tag dot-separated | mono 10–11px, `--text-muted`, tabular-nums |
| **Card** | Track row, playlist tile | `.surface` + 16px padding + hover lifts border to `--accent-debug` only on debug pages, otherwise `--border-glow` |
| **Tag pill** | Filter buttons, in-card tags | mono 9.5px UPPERCASE, no border, `--text-faint`, hovers to `--text-strong` |
| **Active state** | Currently playing track | green outline `--accent-active` + faint `box-shadow` glow |
| **Hover state** | Anything interactive | white text + white border + subtle lift |

---

## Backlinks inventory (what needs theming)

Routes that exist and currently DON'T match the current `/` aesthetic:

### `/tracks`, `/tracks/new`
**Current state:** old "editorial" layout with massive Space Grotesk hero, audio-reactive ring canvas, glitch CA on the hero title, full track list with filter pills, hover cover-art preview at cursor. (`viewEditorial()` in `index.html`.)
**Status:** Closer to the current vibe than the b106 Beta Decay vision, but uses different palette tokens (no magenta debug, no green active state, no shared `.surface` pattern). Hover preview is good — keep.
**Target:** Wrap existing layout in the new palette. Replace ad-hoc colors with tokens. Add backdrop blur to the filter bar. Glitch on hover for track titles. Apply persistent grain overlay.

### `/t/<slug>` (individual track page)
**Current state:** legacy `viewTrack()` template — 2D card with cover art, title, meta, play button, description. No glitch language. No void background.
**Target:** Hero cover art with `image-rendering: pixelated` + glitch RGB-split on the title. Mono kicker `INCOMING SIGNAL` or similar. Two underline buttons (`▶ play`, `↗ soundcloud`). Description in a narrow column. Related-tracks row at bottom using `.surface` cards.

### `/p/<slug>` (playlist page)
**Current state:** legacy `viewPlaylist()` template — list with "play all", track count, share link. Standard layout.
**Target:** Same hero treatment as `/t/`. Track list as `.surface` cards. Share-link button as `.btn.debug` style.

### `/tracks/playlists`
**Current state:** legacy `viewPlaylists()` — saved + shared playlists list.
**Target:** Grid of `.surface` cards, each with kicker + title + track count + cover-art mosaic.

### `/scenes`
**Current state:** completely different — mounts the legacy 3D scene app (Villa / Neural / Deep Sea / Terrain / Living Wall) at full viewport. Shares no styling with `/`.
**Target:** Replace with a **scene selector page** matching the new theme:
- Header: kicker `EXPERIMENTS`, title `kani / scenes`, body line.
- Each scene as a `.surface` card with a static thumbnail + kicker (`EXPERIMENT 01`) + title + body + "ENTER →" button.
- Click → boots that scene full-screen.
- Per the user, individual scenes can move to their own URLs later.

### `/a/<slug>`, `/ep/<slug>`
**Current state:** "coming soon" placeholders.
**Target:** Style the placeholder card to match — kicker `RELEASE PENDING`, title from slug, body line. Replace generic placeholder with the void/grain treatment.

### `/halo.html` (Halo Recon game)
**Current state:** game UI, distinct visual context.
**Target:** Out of scope for this rollout. Game UIs deserve their own visual language.

### Header (top nav, search bar)
**Current state:** the legacy `header.topbar` is hidden on Text Galaxy (`body.mw-on header.topbar { display:none }`) but still shows on `/tracks`, `/t/*`, `/p/*`. Needs alignment.
**Target:** Restyle the header to use `--surface` + backdrop blur + new tokens. Keep the search input but skin it like the admin panel buttons.

### Miniplayer (bottom of page on non-galaxy routes)
**Current state:** custom miniplayer at the bottom on `/tracks`, `/t/*`, `/p/*`. Hidden on `/`.
**Target:** Restyle to use `.surface` + new tokens. Match the top-left HUD player from `/`.

---

## Rollout priority

Go through pages in order of user-impact / audience-exposure:

**Tier 1 (most visited):**
1. **Header + miniplayer** (chrome — sets tone for everything else)
2. **`/tracks`** (the catalog — first place visitors land after `/`)
3. **`/t/<slug>`** (the destination page — every shared link points here)

**Tier 2 (secondary surfaces):**
4. **`/p/<slug>`** (playlists)
5. **`/tracks/playlists`** (playlist index)
6. **`/scenes`** (scene selector page rebuild)

**Tier 3 (placeholders / polish):**
7. `/a/<slug>`, `/ep/<slug>` placeholder cards
8. Misc internal links / 404 page / share dialogs

---

## Files where the tokens go

Add to `<style>` block in `index.html` near the existing `:root`:
```css
:root {
  /* (current vars stay) */
  --void: #040406;
  --surface: rgba(8,10,16,0.92);
  --surface-elev: rgba(8,10,16,0.96);
  --border-faint: rgba(255,255,255,0.10);
  --border: rgba(255,255,255,0.18);
  --border-glow: rgba(255,255,255,0.30);
  --text: #cfd5e0;
  --text-muted: #8a93a3;
  --text-faint: #5e636e;
  --text-strong: #ffffff;
  --accent-debug: #ff7ec3;
  --accent-active: #aef0c8;
  --accent-warn: #ffd28a;
  --accent-cyan: #66ddff;
  --accent-magenta: #ff3ad8;
}
```

Then per-page CSS swaps hard-coded colors for `var(--…)` references. Reusable component classes (`.surface`, `.btn`, `.btn.debug`, `.kicker`, `.section-title`) live in the global `<style>` block in `index.html`.

---

## Hard reminders

1. **Localhost only.** No deploys until the user says ship.
2. **Magenta = debug, not chrome.** Don't paint navigation in magenta.
3. **Bloom and flares are WebGL-only.** Don't try to fake them in CSS — fall back to grain + backdrop-blur for static pages.
4. **Update `CHANGELOG.md` + `FILE_MAP.md` + bump build number** with every change. Per `CLAUDE.md`.
5. **THEME.md is historical.** Don't pull tokens from it. This file (`STYLEGUIDE.md`) is the source of truth going forward.
