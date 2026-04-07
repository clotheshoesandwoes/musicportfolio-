# CHANGELOG

## b004 — 2026-04-06 — Villa b003 fix-up: visible ground, visible ocean, visible moon, cream villa, real palms, water-not-shards

Fixes the live b003 issues observed in screenshots: ground was invisible (vertex jitter on a 4-segment plane was destroying it), ocean was invisible (occluded by 120×120 ground), moon was outside the camera FOV, villa was muddy brown (warm beige base + warm lights = orange), palms were dark blobs clustered on the left, pool was visibly shattering each frame from jitter+ripple combo. All fixes are constants/geometry tweaks in [js/world.js](js/world.js) — no new shaders or features.

### Geometry / shader fixes
- Ground `PlaneGeometry(120, 120, 4, 4)` → `(60, 60, 40, 40)` — shrunk so ocean is visible behind it; subdivided so PS2 vertex jitter renders smoothly instead of distorting 30-unit-wide triangles into garbage
- Ocean `PlaneGeometry(220, 70, 1, 1)` → `(220, 70, 40, 12)` — same subdivision fix
- **Pool: removed PS2 vertex jitter from its custom water shader entirely** — water shouldn't shatter; the jitter+ripple combo was making the pool look like floating shards. Ripple displacement still applies on the top face.

### Color/lighting tweaks
- Villa `#7a6e5e` (warm beige) → `#9a96a4` (cool concrete) — warm sodium + window light now lands as cream, not muddy brown
- Ground `#3a3645` → `#5a5560` — sodium and window spill now actually shows on the patio
- Sky midColor `#4a1875` → `#6a1f95` — more vibrant purple band
- Sky upper smoothstep range `(0.0, 0.65)` → `(0.0, 0.85)` — magenta/purple band sits higher in frame
- Moon dir y `0.55` → `0.35` — lowered into the camera FOV
- Moon disc smoothstep `(0.9982, 0.9994)` → `(0.9970, 0.9985)` — ~3× bigger disc
- Moon halo intensity `0.22` → `0.45` — actually visible glow around the moon
- Pool `uBrightColor` `#6affe0` → `#8effe8` — brighter caustic peak
- Pool emissive boost on top face `2.4×` → `3.0×`

### Palm fixes
- Trunk `#241632` → `#4a3868` (visible silhouette, not pure black)
- Fronds `#381850` → `#7a3aa8` (visible silhouette)
- Frond tilt `-0.32` rad → `-0.55` rad (droop more, look less like spokes)
- Positions un-clustered: was 3 on left + 1 right; now spread to `(-9, 4)`, `(-7, -5)`, `(4, 5.5)`, `(7.5, -4.5)`

### Files modified
- [js/world.js](js/world.js) — color/geometry constants + pool shader cleanup
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b003` → `b004`
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

---

## b003 — 2026-04-06 — Villa Phase 2: villa, ocean, moon, palms, pool ripples, window light

Flesh out the scene from "lonely glowing brick" into an actual *place*. New geometry, new shaders, brighter palette. Single-file change in [js/world.js](js/world.js) (full rewrite — restructured shader uniforms and added several helper functions).

### New geometry
- **Modernist villa** to the right of the pool — lower volume (7×4×8) + upper offset volume (5×3.2×5.5), warm cream concrete material
- **Glowing windows** on the front face: 4 lower wide windows + 3 upper square windows + 1 doorway slit, all emissive
- **3 more palm trees** (4 total now) scattered around the property at varied heights via new `addPalm(x, z, height)` helper
- **Ocean plane** (220×70) far behind the property at z=-50, custom water shader with horizontal/vertical sin ripples
- **32 distant skyline dots** at z=-78 — small emissive boxes in 4 neon colors (pink/cyan/orange/purple) suggesting a city
- **Moon disc** baked into the sky shader with soft halo, positioned at (0.35, 0.55, -0.75)

### New shaders
- **Pool water shader** — tile-grid UV pattern, moving caustic bands (two sin waves multiplied), vertex ripple displacement on the top face only (driven by `uTime`), 3× emissive boost
- **Ocean shader** — horizontal+vertical sin ripple lerping between dark plum and lit purple, fog blended
- **PS2 shader gained a third light** — `uWindowPos`/`uWindowColor`/`uWindowRange` for the warm interior spill from the villa windows. Refactored the three light calculations into a `pointLight()` GLSL helper.
- **Sky shader** — added moon disc + halo via dot-product against `moonDir`

### Palette push
- Sky `top/mid/bottom` brightened: `#0c1135 / #2a1055 / #8a2575` → `#1a1e4a / #4a1875 / #c8358f`
- Ground patio `#2a2632` → `#3a3645`
- Pool rim `#3e3a48` → `#4a4555`
- Palm trunk `#1c1228` → `#241632`, fronds `#2a1140` → `#381850`
- Pool turquoise `#1de9c5` → `#2af0d0`, brightColor `#4af5d8` → `#6affe0`
- Shader ambient `(0.18, 0.16, 0.30)` → `(0.22, 0.20, 0.36)`
- Fog color `#2a1845` → `#3a1a55`, density `0.015` → `0.014`
- Sodium lamp range `25` → `28`

### Camera
- Orbit center moved from origin to `(3, 0, 0)` — between pool and villa — so both are visible
- Radius `13` → `16` (more breathing room for the bigger scene)
- Slightly higher base camera (`4.5` → `4.8`)

### What's still NOT in
- WASD walking ("weird for now" per user)
- Track-objects / interaction (Phase 3)
- Audio reactivity
- Mobile joystick

### Files modified
- [js/world.js](js/world.js) — full rewrite (~440 lines)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b002` → `b003`
- [FILE_MAP.md](FILE_MAP.md) — build bump + villa design notes updated for Phase 2
- [CHANGELOG.md](CHANGELOG.md) — this entry

---

## b002 — 2026-04-06 — Villa palette pass: brighten night so the scene is visible

b001 went on the live site and only the pool + stars were visible — sky gradient, ground, palm, and sodium-lamp warmth were all rendering at near-black RGB and disappearing into the void background. Floor brightness was too low for the night ambient to land on any surfaces. This is a pure constants pass, no new geometry or shader logic.

### Changes (all in [js/world.js](js/world.js))
- Sky `topColor` `#05071a` → `#0c1135` (visible deep navy zenith)
- Sky `midColor` `#1a0a3e` → `#2a1055` (visible purple band)
- Sky `bottomColor` `#4a1a5e` → `#8a2575` (rich magenta horizon)
- Ground patio `#14141c` → `#2a2632`
- Pool rim `#2a2630` → `#3e3a48`
- Palm trunk `#0e0814` → `#1c1228`
- Palm fronds `#180a24` → `#2a1140`
- Shader ambient `vec3(0.10, 0.10, 0.22)` → `vec3(0.18, 0.16, 0.30)` — gives sodium/pool light surfaces to land on
- Scene fog `(0x1a0a3e, 0.022)` → `(0x2a1845, 0.015)` — less aggressive distance eat, distant surfaces mix to visible purple
- Shader fog uniforms updated to match
- Sodium lamp range `18` → `25` — warmth reaches further across the patio

### Files modified
- [js/world.js](js/world.js) — color/lighting constants only
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b001` → `b002`
- [FILE_MAP.md](FILE_MAP.md) — build number bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

---

## b001 — 2026-04-06 — Villa view, Phase 1 (PS2 night Miami shader proof)

**Goal:** prove the PS2-style night Miami look on screen before building any geometry. New 4th view tab `Villa` next to Terrain / Deep Sea / Neural. Existing three views untouched.

### What it does
- Click `Villa` tab → loader briefly → 3D scene with mouse-look orbit
- Sky dome: deep navy → magenta horizon gradient + procedural stars
- Concrete patio ground stretching into heavy night fog
- Glowing turquoise pool slab (centerpiece) with raised concrete rim
- One low-poly palm-tree silhouette to the side
- Sodium-orange streetlamp warming one corner of the patio
- Pool's turquoise light pooling on the surrounding concrete
- Chunky PS2 pixels (480×270 internal render upscaled nearest-neighbor)
- PS2 vertex jitter (160×90 NDC grid snapping → wobble on camera move)
- Faint scanlines + subtle vignette in the post pass

### What it does NOT do (yet)
- No walking — orbit camera only (Phase 2)
- No villa geometry — only the pool deck (Phase 2)
- No tracks / interaction (Phase 3)
- No audio reactivity (later)
- No mobile joystick (Phase 4)

### Tech
- Three.js loaded lazily from `https://unpkg.com/three@0.160.0/build/three.module.js` via dynamic `import()` — no bundler, only loaded when villa is first opened
- Custom `ShaderMaterial`s with hand-written GLSL for the PS2 look (vertex jitter, distance-falloff lighting, manual fog)
- Two-pass render: scene → low-res target → fullscreen quad upscale w/ scanlines

### Files added
- [js/helpers.js](js/helpers.js) — `window.BUILD_NUMBER = 'b001'`
- [js/world.js](js/world.js) — Villa view IIFE (registers as `villa`)
- [FILE_MAP.md](FILE_MAP.md) — initial architecture map
- [CHANGELOG.md](CHANGELOG.md) — this file

### Files modified
- [index.html](index.html) — `Villa` button in desktop + mobile tab bars; `<script src="js/helpers.js">` first; `<script src="js/world.js">` last
- [style.css](style.css) — `.world-canvas`, `.world-loader`, `.world-loader-bar`, `.world-loader-fill`, blink + load keyframes
- [js/app.js](js/app.js) — `villa` entry in `subs` map; `Digit4` keyboard shortcut → `switchView('villa')`
