# FILE MAP — cantmute.me (Kani music portfolio)

**Build:** b011
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
- [js/world.js](js/world.js) **(b010)** — Villa view, Three.js 3D scene, PS2+ shaders (finer 320x180 vertex jitter + 854x480 low-res render target + faint scanlines), "sun just dipped" dusk Miami palette. b010 villa redesign: 2-story stacked white box villa with cantilevered upper floor, stacked stone column accents on the lower front, floor-to-ceiling glass walls, recessed warm cove lighting under the cantilever overhang, long infinity-edge pool running parallel to the villa front, white travertine deck, three pool-side daybeds (wood base + cream cushion), four warm deck lanterns at the pool front edge, low-poly icosahedron boulders replacing the old hedges/bushes, 4 palms, ocean horizon plane, distant neon skyline dots, custom water shader (tile lines + ripple displacement + caustic bands, brighter cyan glow), 3-light shader (warm deck lantern + cyan pool glow + warm interior window light)

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
- Distant skyline = ~32 emissive box "dots" with 4 shared materials (4 neon colors)
- Villa architecture (b010): two stacked white plaster boxes — 20×4×11 lower volume + 13×3.5×7 upper volume hanging 1.0 forward over the pool deck (the cantilever signature). Three stacked-stone columns on the lower front face break up the white plaster. FTG glass between/under columns. A recessed cove light strip glows down from the underside of the upper cantilever onto the deck.
- Camera orbits a centerpoint at (0, *, -2) — just in front of the villa — at radius 20, default position (-2, 5, 16) looking back at the cantilever in 3/4 view
- `timeUniforms[]` array — every shader that needs `uTime` is registered here so `animate()` can update them all from a single rAF timestamp
- Still no walking, no tracks, no audio reactivity (b011 = click→card system is on deck)
