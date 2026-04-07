# FILE MAP — cantmute.me (Kani music portfolio)

**Build:** b001
**Updated:** 2026-04-06

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
- [js/player.js](js/player.js) — audio playback, transport, `playTrack(i)`, `togglePlay()`, `playNext()`, `playPrev()`, `getFrequencyData()` (not surveyed)
- [js/terrain.js](js/terrain.js) — Terrain view, 2D canvas, audio-reactive peaks (not surveyed)
- [js/deepsea.js](js/deepsea.js) — Deep Sea view, scrolling depth track list (not surveyed)
- [js/neural.js](js/neural.js) (~382 lines) — Neural view, 2D canvas node graph, audio-reactive nodes/connections, filter pills, mobile-tap-to-play
- [js/world.js](js/world.js) **(NEW b001)** — Villa view, Three.js 3D scene, PS2-style shaders (vertex jitter + low-res render target + faint scanlines), night Miami palette, sky dome with stars, pool, palm, sodium streetlamp + pool point-light uniforms passed into custom shader

### audio/, audio-mp3/
Track files (referenced by config.json).

## Build numbering
Stored in [js/helpers.js](js/helpers.js) as `window.BUILD_NUMBER`. Bump every code change. Format `b001` → `b002`.

## Villa view — design notes
- Lazy-loads Three.js from `https://unpkg.com/three@0.160.0/build/three.module.js` on first mount
- Renders to a 480×270 `WebGLRenderTarget` with `NearestFilter`, then upscales via fullscreen quad → chunky PS2 pixels
- PS2 vertex jitter implemented in custom vertex shader: clip-space xy snapped to a 160×90 grid
- Lighting is **not** Three.js's built-in light system — sodium-lamp + pool-glow positions/colors are passed as uniforms into the custom fragment shader, doing distance falloff + N·L manually
- Heavy `FogExp2` matched in shader for consistency
- Sky dome uses a separate gradient + procedural-stars shader (no jitter)
- Phase 1 = look proof. No walking, no tracks, no audio reactivity yet.
