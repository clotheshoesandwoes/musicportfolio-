# SCENES — file map

**Scope:** the scene-selector observation deck at `/scenes` (military base panorama with 11 holographic experiment panels), plus the legacy 3D scene app at `/scenes/play.html` (Villa / Neural / Deep Sea / Terrain / Living Wall etc.). The `/scenes` page is the active redesign surface.

**Build:** s4
**Updated:** 2026-05-10

## Scope-owned files (this chat freely edits these)
- [js/scenes-selector.js](../../js/scenes-selector.js) — the WebGL scene-selector. Mounts as `window.ScenesSelector = { init, destroy }` from `scenes/index.html`. Builds the desert military-base environment (floor shader with road network, ridge silhouette, perimeter fence + razor wire + watchtowers, missile silo + LF compound, antenna farm, conex stacks, hexagonal observation deck at camera, 11 panels in radial arc, post-FX stack, dust motes, back-glow sprites, Cortana wireframe humanoid, scripted patrol activity).
- [scenes/index.html](../../scenes/index.html) — entry HTML for the selector. Imports `scenes-selector.js` via a timestamped dynamic loader (b221 cache-bust).
- [scenes/play.html](../../scenes/play.html) — entry HTML for the legacy scene app. Loads the build-scene.js + app.js + per-scene scripts (terrain.js / deepsea.js / neural.js / etc.).
- [js/builds/scenes.js](../../js/builds/scenes.js) — `window.BUILD_SCENES` constant.
- [docs/scenes/CHANGELOG.md](CHANGELOG.md) — scenes build history (s1 onward).
- [docs/scenes/FILE_MAP.md](FILE_MAP.md) — this file.
- [BASEMAP.md](../../BASEMAP.md) — military-base floor plan v2 (radial layout, panel coords, zone catalog, scripted-activity script). Scenes-only doc; lives at root for now.
- [SCENES_HANDOFF.md](../../SCENES_HANDOFF.md) — fresh-chat catch-up doc for the scenes redesign thread.

## Shared files used (do NOT edit casually — coordinate)
- `js/player.js` — audio engine. The legacy scene app's audio chrome reads `audio.__floorAnalyser`. **Visual changes go in scene-specific JS files, NOT here.**
- `config.json` — track data (used by the legacy scene app's audio chrome).
- `style.css` — global stylesheet (legacy scene app uses it).

## Always do these (every scenes code change)
1. Bump `window.BUILD_SCENES` in [js/builds/scenes.js](../../js/builds/scenes.js) (format `s###`).
2. Update the `**Build:**` and `**Updated:**` lines at the top of this file.
3. Add a CHANGELOG entry at the top of [docs/scenes/CHANGELOG.md](CHANGELOG.md).
4. Validate before shipping: `cp js/scenes-selector.js c:/tmp/sc.mjs && node -c c:/tmp/sc.mjs`.

## Architecture summary
- Camera at the hex deck origin, looks across a 261° arc of holographic panels.
- Drag-look orbits the gaze; click panel → focuses (zoom + scale 1.18× + others fade); ENTER → navigates to `play.html?scene=<id>`.
- 11th "galaxy" portal panel routes to `/` (not `play.html`).
- Procedural floor shader (fine + coarse grid lines, fading concentric ring under origin, road network masks at fixed world coords).
- Perimeter envelope (b231): inner fence at x=±110, outer fence at x=±125, watchtowers at the corners, razor wire on inner. Conex stacks sit in the 15u clear-strip.
- Missile silo + LF compound (b237): floods, cameras, signs, transporter, fuel tank, hatch.
- Cortana hologram + wireframe humanoid behind the galaxy panel (b145/b149).
