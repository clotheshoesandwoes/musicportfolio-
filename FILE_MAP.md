# FILE MAP — cantmute.me (Kani music portfolio)

**Build:** b013
**Updated:** 2026-04-07

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
- [index.html](index.html) (~115 lines) — shell, top bar, view-tabs (desktop + mobile), `<main class="view-container">`, player bar, script tags
- [style.css](style.css) (~830 lines) — variables, top bar, view container, player bar, shared panels, per-view styles, villa loader, responsive
- [config.json](config.json) — site config + tracks list (artist, theme, socials, tracks[])
- [admin.html](admin.html) — admin/upload UI (not surveyed)
- [script.js](script.js) — admin script (not surveyed)
- [wrangler.jsonc](wrangler.jsonc) — Cloudflare Workers config

### js/
- [js/helpers.js](js/helpers.js) **(NEW b001)** — `window.BUILD_NUMBER`
- [js/app.js](js/app.js) (~308 lines) — config loader, shared state, view router (`registerView` / `switchView`), search, track-detail panel, theme/socials, keyboard shortcuts (digits 1–4 = views)
- [js/player.js](js/player.js) **(b011)** — audio playback, transport, `playTrack(i)`, `togglePlay()`, `playNext()`, `playPrev()`, `getFrequencyData()`. b011: `loadTrack()` now reads `siteConfig.audioBase` for the audio URL (R2 in prod), falls back to local `audio-mp3/` if config hasn't loaded yet.
- [js/terrain.js](js/terrain.js) — Terrain view, 2D canvas, audio-reactive peaks (not surveyed)
- [js/deepsea.js](js/deepsea.js) — Deep Sea view, scrolling depth track list (not surveyed)
- [js/neural.js](js/neural.js) (~382 lines) — Neural view, 2D canvas node graph, audio-reactive nodes/connections, filter pills, mobile-tap-to-play
- [js/world.js](js/world.js) **(b013)** — Villa view, Three.js 3D scene, PS2+ shaders (finer 320x180 vertex jitter + 854x480 low-res render target + faint scanlines), "sun just dipped" dusk Miami palette. b013 villa expansion: villa is roughly 2× b010 in every dimension. Lower volume (32×6×18) is now a HOLLOW SHELL — interior travertine floor + 3 solid walls (back, left, right) + interior ceiling + 5 stacked-stone columns + 4 FTG glass panes on the open front face. Upper volume (22×4.5×12) is the cantilever, hangs 1.8 forward over the deck. Recessed warm cove lighting under the upper. Front door + new back door opening on the rear wall. Long infinity-edge cyan pool, white travertine deck, daybeds, deck lanterns, boulders. Front-of-pool extends into front beach + front ocean (no more b010 hard cutout). Back-of-house: 12 neighbor villas, 12 palms, 100-building Miami skyline (60 back + 40 front for the city silhouette wraparound). Custom water shader, 3-light shader (warm deck lantern + cyan pool glow + warm interior window light, window range bumped to 32 for the bigger interior).

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
- Villa architecture (b013): two stacked white plaster boxes — 32×6×18 lower volume + 22×4.5×12 upper volume hanging 1.8 forward over the pool deck (the cantilever signature). **Lower volume is a HOLLOW SHELL** (4 walls + interior floor + interior ceiling), front face open by design, walkable interior space. 5 stacked-stone columns at the lower front (x=±13.5/±6.75/0). 4 FTG glass panes between the columns. Front door at x=-10.125 (leftmost gap), new back door on the rear wall facing the Miami neighborhood. Recessed cove light strip on the underside of the upper cantilever. Interior is empty for now, ready for prop click-targets in b014 (piano, records, etc.).
- Front of pool: pool → boulders/lanterns → deck → front beach (z=30) → front ocean (z=90) → horizon. No more hard cutout.
- Back of house: 12 neighbor villas in 3 z-bands, scattered palms, dense skyline. Beach behind villa pushed to z=-42 with bigger footprint.
- Camera orbits a centerpoint at (0, *, -2) — just in front of the villa — at radius 26 (was 20), default position (-3, 6, 22) looking back at the cantilever in 3/4 view, base y 8.5, lookAt y 4.0. Camera far plane raised 250 → 320 to render the new front skyline.
- `timeUniforms[]` array — every shader that needs `uTime` is registered here so `animate()` can update them all from a single rAF timestamp
- Still no walking, no tracks, no audio reactivity. b014 = click→card system on deck (each interior prop becomes a song trigger). b015 likely = walking/WASD movement.
