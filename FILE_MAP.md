# FILE MAP — cantmute.me (Kani music portfolio)

**Build:** b088
**Updated:** 2026-04-19

## Routes
- `/` → **Featured** (main landing — curated hero + featured grid, served from `tracks.html`)
- `/tracks` → **All tracks** (full grid/list of every song)
- `/tracks/new` → tracks flagged `isNew` / listed in `config.newReleases`
- `/tracks/playlists` → saved + shared playlists
- `/t/<slug>` → individual track page
- `/p/<slug>` → playlist (optional `?t=<slugs>&n=<name>` for shareable ad-hoc playlists)
- `/a/<slug>`, `/ep/<slug>` → album / EP placeholders (coming soon)
- `/scenes` → **3D scene app** (Dimensions / Living Wall / Villa / Neural / etc., served from `index.html`)

Rewrites are declared in `_redirects` (Cloudflare static-asset redirects). All rewrites use status 200 so the URL stays clean.

## Featured / New curation
Edit `config.json`:
```json
"featured": ["rolla", "odst", "wallet"],     // slugs OR title strings OR numeric indices
"newReleases": ["rolla", "follow-you"]        // same — any mix allowed
```
`tracks.html` resolves each entry: number → `tracks[N]`, string → slugified title match. Track-level `"isNew": true` / `"isFeatured": true` still works too (scene views use those per-track flags).

## Design references
- [VISION.md](VISION.md) — design bible: project vision, Drake's-site reference, art direction, palette table, click→card system design, scene density priorities, what's in/out of scope. **Read before any "luxury" or scenery feature work.**
- [HANDOFF.md](HANDOFF.md) — current state for fresh chats
- [CLAUDE.md](CLAUDE.md) — workflow rules (mandatory)

## Architecture
Vanilla JS, no build step. Multi-view single-page site.
- View router in [js/app.js](js/app.js) — `registerView(name, { init, destroy, onSearch?, onTrackChange? })`
- Global state, config loader, search, track-detail panel all in app.js
- Audio playback + frequency data in [js/player.js](js/player.js) (`getFrequencyData()` shared with views)
- Each view is an IIFE that mounts into `<main class="view-container">`
- Three 2D canvas views (terrain, deepsea, neural), one 3D view (villa, Three.js)
- Three.js loaded lazily from `unpkg.com` ESM CDN on first villa activation — no bundler

## Files

### Root
- [index.html](index.html) (~115 lines) — shell, top bar, view-tabs (desktop + mobile), `<main class="view-container">`, player bar, script tags. **b087:** added "Tracks" link pointing to `/tracks`.
- [tracks.html](tracks.html) **(NEW b087)** — standalone SoundCloud-style tracks browser. Reads `config.json`, lays out all tracks as a uniform grid (one 2×2 hero at top, rest 1×1), per-track deep pages, playlist builder with URL-encoded share links, cover-art pipeline (`covers/<slug>.{jpg,png,webp}`), SoundCloud deep link per song, real audio via `new Audio()` against `audioBase`. Path-based routing via History API — intercepts internal `<a>` clicks and calls `pushState`. Routes: `/tracks`, `/tracks/new`, `/tracks/featured`, `/tracks/playlists`, `/t/<slug>`, `/p/<slug>`, `/a/<slug>`, `/ep/<slug>`. Neutral black/white aesthetic with Space Grotesk display font + SVG grain overlay, distinct from the scene views.
- [_redirects](_redirects) **(NEW b087)** — Cloudflare static-asset rewrites so clean URLs serve `tracks.html`: `/t/*`, `/p/*`, `/a/*`, `/ep/*`, `/tracks`, `/tracks/*` all 200-rewrite to `/tracks.html`. Client-side JS reads `location.pathname` to decide which view to render.
- [style.css](style.css) (~830 lines) — variables, top bar, view container, player bar, shared panels, per-view styles, villa loader, responsive
- [config.json](config.json) — site config + tracks list (artist, theme, socials, tracks[])
- [admin.html](admin.html) — admin/upload UI (not surveyed)
- [script.js](script.js) — admin script (not surveyed)
- [wrangler.jsonc](wrangler.jsonc) — Cloudflare Workers config

### covers/ **(NEW b087)**
Cover art drop zone. Filename = track slug (lowercase, punctuation stripped, spaces → hyphens). `tracks.html` tries `.jpg`, `.jpeg`, `.png`, `.webp` in order; falls back to procedural gradient when no file matches. See [covers/README.md](covers/README.md).

### js/
- [js/helpers.js](js/helpers.js) **(NEW b001)** — `window.BUILD_NUMBER`
- [js/app.js](js/app.js) (~308 lines) — config loader, shared state, view router (`registerView` / `switchView`), search, track-detail panel, theme/socials, keyboard shortcuts (digits 1–4 = views)
- [js/player.js](js/player.js) **(b011)** — audio playback, transport, `playTrack(i)`, `togglePlay()`, `playNext()`, `playPrev()`, `getFrequencyData()`. b011: `loadTrack()` now reads `siteConfig.audioBase` for the audio URL (R2 in prod), falls back to local `audio-mp3/` if config hasn't loaded yet.
- [js/terrain.js](js/terrain.js) — Terrain view, 2D canvas, audio-reactive peaks (not surveyed)
- [js/deepsea.js](js/deepsea.js) — Deep Sea view, scrolling depth track list (not surveyed)
- [js/neural.js](js/neural.js) (~382 lines) — Neural view, 2D canvas node graph, audio-reactive nodes/connections, filter pills, mobile-tap-to-play
- [js/world.js](js/world.js) **(b014)** — Villa view, Three.js 3D scene, PS2+ shaders, "sun just dipped" dusk Miami palette. b014: **proper orbit camera (drag/scroll/pinch)** + **layout flip — beach/ocean side vs street side**. Front (camera side) = bigger pool 22×6 + boulders + lanterns + daybeds + front beach + front ocean. Back (opposite) = detached garage + driveway + asphalt road with dashed center + sidewalks + 6 streetlamps + 12 cross-street mansions + boulevard palms + 80-building Miami skyline. The villa hollow shell (2-story with cantilever, 5 stone columns, 4 FTG glass panes, interior floor/ceiling) carries over from b013 unchanged. Pink Lambo parked on the deck alongside the pool. Yellow Lambo parked in the driveway in front of the garage door (which now faces the street).

### audio/
WAV originals — local-only, gitignored, never deployed.

### audio-mp3/
Local cache of MP3s. **Gitignored as of b011.** Production audio is now served from Cloudflare R2 (`cantmute-audio` bucket, public URL `https://pub-5556ef4db74d499ba3f535afccf8c7be.r2.dev/`). Local copies stay on disk for backup and future re-uploads but are no longer in the repo. To upload new tracks, drop them in `audio-mp3/` then run `bash scripts/upload-audio-to-r2.sh`.

### scripts/
- [scripts/upload-audio-to-r2.sh](scripts/upload-audio-to-r2.sh) **(NEW b011)** — uploads every file in `audio-mp3/` to the `cantmute-audio` R2 bucket. Requires wrangler installed + `wrangler login`. Idempotent.

## Build numbering
Stored in [js/helpers.js](js/helpers.js) as `window.BUILD_NUMBER`. Bump every code change. Format `b001` → `b002`.

## Villa view — design notes
- Lazy-loads Three.js from `https://unpkg.com/three@0.160.0/build/three.module.js` on first mount
- Renders to an **854×480** `WebGLRenderTarget` with `NearestFilter`, then upscales via fullscreen quad → "PS2+" pixels (finer than original PS2 but still has the chunky character)
- PS2+ vertex jitter implemented in custom vertex shader: clip-space xy snapped to a **320×180** grid (applied to PS2 material, ocean material, and skyline-dot material — pool and sky stay smooth)
- Lighting is **not** Three.js's built-in light system — three point lights (warm deck lantern, cyan pool glow, warm interior window) are passed as uniforms into the custom fragment shader, doing distance falloff + N·L manually via `pointLight()` helper
- Heavy `FogExp2` (cool indigo `0x40285a`) matched in PS2/pool/ocean shaders for consistency
- Sky dome uses a separate gradient shader — "sun just dipped" palette (warm pink/orange horizon → lavender mid → deep indigo zenith) + sparse zenith-only stars
- Pool has its own water shader with tile-line UV grid, moving caustic bands, vertex ripple displacement on the top face, and a 3.6× brightness boost on the top face for the strong cyan glow
- Ocean is a single shader plane far from the patio with horizontal/vertical sin ripples
- Distant skyline = ~100 emissive box "dots" with 4 shared materials (4 neon colors): 60 back at z=-90 + 40 front at z=140. Every 4th-to-5th building is a taller "high-rise" box for the city silhouette feel.
- Villa architecture (b037, modern Miami beach mansion rebuild): U-shaped footprint preserved from b025 (central 14×14 block + east/west 9×14 wings, full width 32), but the surface language is now all-white plaster, flat roofs with rooftop terraces + parapets, floor-to-ceiling frameless glass spans across every front face (no mullion grids), slim marble floor-line eyebrows between floors. Open colonnade across the full 32-wide front: 7 slim round white columns at z=0 supporting a horizontal cantilever eyebrow slab with a warm cove glow strip on the underside. Cylindrical white drum pavilion at the front-east corner of the east wing (the only non-rectangular volume). Rooftop pavilion on the central terrace (small white cube + cantilever canopy on slim columns) carries the `bell_tower` click→card target preserved from b025. Interior LIVING/BEDROOM/BILLIARD rooms still placed via the same footprint constants — untouched by this rebuild. Solid plaster strip behind the existing living-room TV at x=0±2.7 z=-3 so the TV doesn't read against the open colonnade beyond.
- Front of pool: pool → boulders/lanterns → deck → front beach (z=30) → front ocean (z=90) → horizon. No more hard cutout.
- Back of house: 12 neighbor villas in 3 z-bands, scattered palms, dense skyline. Beach behind villa pushed to z=-42 with bigger footprint.
- Camera (b038, freedom upgrade on top of b032 dual-mode): drag = rotate, **RMB drag or Shift+LMB drag = pan** (slides camCenter via camera right+up basis vectors), wheel = zoom in orbit / **dolly forward/back** in FP, touch 1-finger = rotate, touch 2-finger = pinch+pan composed per frame, **WASD/QE = keyboard fly** (W/S forward/back along view direction projected to ground in orbit + full 3D in FP, A/D strafe, Q/E world down/up, Shift = 3× boost), **R = re-fly to current anchor** (reset). Keyboard skipped while typing in any input/textarea. Anchor presets (POOL/BEACH/AERIAL/LIVING/BEDROOM/BILLIARD/INDOOR) snap-fly via cartesian (position + lookAt) lerp; pan/WASD lets the user move from there. Pitch clamped (-0.10 to 1.30) in orbit, (-1.35 to 1.35) in first-person. Radius clamped (8 to 80). Camera y clamped >=1.0 in orbit so it never dips below ground. Far plane 320 to render the back skyline at z=-100.
- `timeUniforms[]` array — every shader that needs `uTime` is registered here so `animate()` can update them all from a single rAF timestamp
- Still no walking, no tracks, no audio reactivity. b014 = click→card system on deck (each interior prop becomes a song trigger). b015 likely = walking/WASD movement.
