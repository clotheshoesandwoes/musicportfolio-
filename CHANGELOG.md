# CHANGELOG

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
