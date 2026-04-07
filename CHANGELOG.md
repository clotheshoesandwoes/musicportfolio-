# CHANGELOG

## b034 — 2026-04-07 — Map reshape: lagoon, forest, loop road, bigger garden + garage

User pinned three annotated screenshots: west = water, east + south = forest, loop driveway threading through forest in front of the house, and the garden + garage need to be bigger.

### Changes
- **Lagoon (west water)** — new plane reusing `oceanMat` at `(-78, 0.03, 0)`, 60×140. Sits just above the beach sand (y=0.02) so the existing sand reads as shoreline up to its edge. No new shader, no fog mismatch.
- **Forest** — new `addPineTree(x, z, h)` helper: stone-style trunk + 3 stacked tapering cones using existing `trunkMat` / `shrubMat`. 24 pines + 9 extra tall palms scattered east of the loop, north of the garage, and along the far southern edge. Loop interior stays clear (drivable).
- **Loop driveway** — new `asphaltMat` + `stripeMat`, `addRoadSegment(x, z, len, rotY)` helper that lays a 5-wide asphalt slab plus 3 dashed center stripes. 16-segment ring at `(62, 5)` radius 18, plus a villa→loop approach (2 segments at z=5) and a garage spur at z=-18.
- **Garden expansion** — `addGarden` `gw 22→30, gd 18→24`. Hedges, paths, corner topiaries auto-scale via `halfW`/`halfD`.
- **Garage** — `addCarShowroom` enlarged: `sw 14→28`, `sd 10→16`, `sh 4→5`. Cars `3 → 6` (2 rows of 3, new mint/pink/pearl colors next to the existing red/blue/orange). Relocated from `(32, 13)` to `(32, -28)` so it sits NE of the villa as drawn.

### Files modified
- [js/world.js](js/world.js) — `addGarden` size bump, `addCarShowroom` size + cars + position, new lagoon/road/forest block after the showroom call
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b033 → b034`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b033 — 2026-04-07 — Raise interior camera heights + 24-bit depth texture + rug y-offset

User: "billiard view is terrible cuz im midget level so i cant see anything in the room same for bedroom same for living. constant z fighting when zooming or moving camera around is it cuz everything is on the same plane axis?"

Two issues, two causes.

### 1. Midget cameras
b032 first-person heights were picked for "real human eye level" — but the villa is built oversized, so eye level + tall furniture meant the camera was at table-top / sofa-back level and couldn't see the room contents. Worse, LIVING was placed at z=-14.5 which sits *between* the sofa back (-14.7) and the sofa seat (-14) — camera was inside the sofa.

Bumped all interior anchor heights so the user looks *down at* the hero prop from a stand-on-a-stool view, with a slight downward pitch:
- LIVING `(0, 2.5, -14.5) → (0, 3.5, -15.8)`, pitch 0 → 0.10
- BEDROOM `(-11.5, 4.8, -7.5) → (-11.5, 5.8, -6.0)`, pitch -0.05 → 0.18
- BILLIARD `(14.5, 1.8, -11.5) → (14.5, 3.0, -12.5)`, pitch -0.10 → 0.20
- INDOOR `(0, 2.8, -18.5) → (0, 4.0, -18.0)`, pitch -0.10 → 0.12

### 2. Z-fighting
Yes, partly coplanar surfaces — the living room rug was at `lrY + 0.03` vs the interior floor at `lrY + 0.01`, only 0.02 apart. Bumped to `+0.06`.

But the bigger fix is the depth buffer. The 854×480 `lowResTarget` was using `depthBuffer: true` with no explicit type, which on many drivers gets a 16-bit `DEPTH_COMPONENT16` renderbuffer. Combined with the low-res grid this produces visible flickering on coplanar interior surfaces, and the flicker pattern shifts as the camera rotates because the pixel sampling shifts. Attached an explicit `THREE.DepthTexture(LOW_W, LOW_H)` with `UnsignedIntType` (24-bit). This is the b030 step-2 fix I had deferred.

### Files modified
- [js/world.js](js/world.js) — interior anchor coordinates, `lowResTarget` gets explicit `DepthTexture`, living room rug y `+0.03 → +0.06`
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b032 → b033`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b032 — 2026-04-07 — Dual-mode camera: first-person for interior anchors

User: "angles for all interior rooms is bad cause its too zoomed in. as soon as i move camera or zoom out, im locked from the outside i cant zoom back in... also the positions arent great for looking around and clicking into stuff". Two problems, one root cause: orbit-around-a-point is the wrong primitive for tight interiors.

**Bug 1 (locked-out):** orbit input has a hard `MIN_RADIUS = 8` clamp from b014. b031 interior anchors used radius 3.5–5.5, which the fly-to set directly. The moment the user touched scroll/pinch the clamp snapped radius up to 8, and they could never zoom back below 8 → permanently locked outside the room.

**Bug 2 (bad framing for looking around):** orbit-around-a-fixed-point in a 14×14 room means dragging the mouse arcs the camera *through walls*. "Look around a room and click on stuff" is fundamentally a first-person rotation (camera position fixed, lookAt direction swings), not an orbit.

### Fix
Added a per-anchor `mode: 'orbit' | 'firstPerson'` field. Exterior anchors (POOL/BEACH/AERIAL) keep the existing orbit math. Interior anchors (LIVING/BEDROOM/BILLIARD/INDOOR) use a new first-person mode:

- **Position is fixed** at the anchor's `(px, py, pz)` — the camera stands in one spot inside the room
- **Drag rotates lookAt direction** in place (yaw/pitch) — true look-around feel
- **Wider pitch clamp** (`-1.35..1.35` vs orbit's `-0.10..1.30`) so the user can look nearly straight up/down inside a room
- **Wheel/pinch adjusts FOV** instead of orbit radius — clamps `35..95`, default 75–78 per anchor

The fly-to tween was rewritten to interpolate **cartesian position + lookAt point + FOV** rather than the mode-specific state. That means an orbit anchor → first-person anchor (or vice versa) flies smoothly through 3D space without any visible mode-switch pop. At `t=1` the underlying state vars settle into the target mode and the matching free-input path takes over.

### Files modified
- [js/world.js](js/world.js) — `camMode` state, `clampFov`, dual-mode `clampPitch`, dual-mode `onWheel` + pinch, `currentLookAtPoint` / `anchorCameraPosition` / `anchorLookAtPoint` helpers, `flyToAnchor` rewritten to cartesian, `animate()` camera section split into 3 branches (fly tween / orbit free / first-person free), `cameraAnchors[]` schema with `mode` field
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b031 → b032`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b031 — 2026-04-07 — Rebuild camera anchors against actual room geometry

User: "some of our camera angles are broken or poorly positioned". Screenshots of all 7 jumper anchors showed LIVING / BEDROOM / BILLIARD / INDOOR rendering as nearly-black voids with stray edge fragments — and AERIAL / BEACH framed wrong. Cause was a math error in every interior anchor: the orbit formula places the camera at `center + sin(yaw)·cos(pitch)·radius`, and the prior radii (7–11) were larger than the rooms themselves, so the camera always landed *outside* the wing walls and rendered the back of opaque geometry.

Worked it out per-room against the real coordinates (villa central x∈[-7,7] z∈[-17,-3]; west wing cx=-11.5; east wing cx=11.5; atrium cz=-23.2 d=12), then chose new yaw/pitch/radius so the camera lands inside the correct room and the lookAt frames the hero prop (sofa, bed, pool table, indoor pool).

### Fix
Rewrote `cameraAnchors[]` in [js/world.js](js/world.js):
- **POOL** — unchanged (was already correct)
- **BEACH** — flipped to "stand on the beach looking at the villa" (yaw=0, cz=-8, r=35) instead of looking out toward the ocean from the pool
- **AERIAL** — pitch 1.10 → 1.25, lookAt y dropped to 0, radius 38 → 42 → true top-down framing
- **LIVING** — radius 8 → 5.5, yaw 0 → π/2 → camera lands inside the central room at x=5.4, frames sofa + coffee table + TV
- **BEDROOM** — radius 7 → 3.5, cz -10 → -7.7 (foot of bed), yaw π/2 → 0 → camera inside west wing
- **BILLIARD** — radius 7 → 3.5, cz -10 → -11.5 (pool table center), yaw -π/2 → π → camera inside east wing
- **INDOOR** — radius 11 → 4.5, yaw 0 → π → camera inside atrium back wall, frames indoor pool + sauna

### Files modified
- [js/world.js](js/world.js) — `cameraAnchors[]` rewritten
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b030 → b031`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b030 — 2026-04-07 — Fix z-fighting on scenery (camera near plane)

User: "there is a lot of jitter on the scenery... Z fighting is what I want addressed". Roof/wall/deck surfaces were flickering against each other as the camera moved. Cause was the perspective camera's depth range: `near=0.1, far=320` gives a 3200:1 ratio, which crushes z-buffer precision and causes coplanar surfaces to fight. Camera radius is clamped 8–80 (orbit), so the near plane has tons of headroom.

### Fix
Bumped `near` from `0.1` → `1.5` on the main `PerspectiveCamera`. Ratio drops from 3200:1 to ~213:1 — typically eliminates 90% of z-fighting on its own. If any flicker remains visible after deploy, the next step is attaching an explicit 24-bit `DepthTexture` to `lowResTarget`.

### Files modified
- [js/world.js](js/world.js) — camera near `0.1 → 1.5`
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b029a → b030`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b029a — 2026-04-07 — Hotfix: cycleUniform was scoped wrong, animate() threw on first frame, canvas stayed black

User: "i can click buttons but cant see a thing". The DOM anchor bar was rendering and the click handlers worked, but the 3D canvas was just the dark purple clear color (`0x2a0a35`). Diagnosis: `cycleUniform` was declared `const` INSIDE `init()`, but `animate()` lives at IIFE level outside `init()` — closure-wise, animate's reference to `cycleUniform` resolved to undefined and threw `ReferenceError` on the very first rAF tick. The rAF chain died immediately, no scene was ever rendered, the canvas just held the cleared background.

This is the same scoping rule the existing `materials` / `timeUniforms` arrays already follow — they live at IIFE top-level so animate() can read them. I missed it for cycleUniform.

### Fix
Moved `const cycleUniform = { value: 0 }` from inside `init()` (where I'd put it next to the click→card raycaster setup) to the IIFE top level, right next to `let materials` / `let timeUniforms`. Added a comment explaining why it must live there. Replaced the old in-init declaration with a pointer comment.

### Files modified
- [js/world.js](js/world.js) — `cycleUniform` moved to IIFE scope
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b029 → b029a`
- [CHANGELOG.md](CHANGELOG.md) — this entry

## b029 — 2026-04-07 — WORLD rebuild: 360° beach island, 4 interior rooms, 7-anchor jumper camera, day/night cycle

User: "i want a cool house on the beach for us to explore that'd be like our WORLD". Then locked in: replace the villa scene (1A), day/night cycle (2C), camera anchor jumper (3C), with multiple interior rooms — "huge living room, a nice bedroom, a cool room with billiard tables bars etc, an indoor pool room with sauna, outdoor pool". This is the biggest single-build refactor since the b025 villa rebuild.

### What got RIPPED
- 12 cross-street neighbor villas + the helper that built them
- Asphalt road, dashed yellow center line, near + far sidewalks
- 6 streetlamps with poles + arms + emissive bulbs
- Detached garage (8×3.5×8 box, roof slab, glowing door)
- Driveway plane
- 80-building Miami skyline + the 4-color shader material array
- Hills (front + mid + back ridges, 6 boxes with stacked bumps)
- Hill villas (9 elevated mansions on the ridges)
- Big back grass plane
- 12 boulevard palms in 2 rows along the street
- Front beach band at z=32 (replaced with 360° wrap)

That's roughly 250 lines of geometry construction gone.

### What got ADDED
- **360° beach** — single 200×200 sand plane wraps the property on all 4 sides. Sun-bleached `0xe8d090`. The existing ground/deck plane shrunk from 180×80 to 56×52 just-the-villa-footprint, raised slightly so it reads as an elevated patio surrounded by sand.
- **600×600 ocean wrap** — old front-only ocean replaced. Square plane below the beach in every direction, so any camera angle reads horizon-to-horizon water beyond the sand.
- **10 scattered organic palms** instead of the boulevard rows — random positions around the back/sides where the street used to be.
- **Yellow Lambo relocated** to the east side of the deck (mirror of pink Lambo). Both supercars now flank the pool symmetrically.

### NEW: Indoor pool atrium (b029)
Glass-walled atrium attached to the back of the villa where the garage was. 16×8×12 footprint, three glass walls (existing windowMat — emissive glass), roof slab, pale tile floor. Inside: a smaller indoor pool (8×4 box reusing the pool shader, named `indoor_pool`), a wooden sauna box with a glowing door (named `sauna`), two indoor lounge chairs flanking the pool, and a potted palm in the corner with 6 fronds for the indoor-pool reference vibe.

### NEW: Interior furniture (3 rooms inside the existing villa shell)
No physical partitions added — the camera anchor framing sells each room as a distinct space. Furniture clusters placed in different parts of the villa interior:

- **LIVING ROOM** (central ground floor) — Big L-sectional sofa in deep navy, glass coffee table with cyan emissive glow, big purple-emissive TV/screen on the back wall (named `living_tv`), deep red rug under the seating area.
- **BEDROOM** (west wing upper floor) — Bed frame + mattress + 2 pillows + tall headboard, 2 nightstands flanking, an emissive lamp on one of them, dresser opposite the bed.
- **BILLIARD/BAR** (east wing ground floor) — Pool table with green felt + dark wood frame + 4 legs + cue ball + colored ball, bar counter along the back wall with a darker bar top + 3 emissive liquor bottles + 3 bar stools, hot pink emissive neon sign above the counter.

### NEW: Day/night cycle (60-second loop)
- Shared `cycleUniform` object plumbed through sky shader and PS2 material.
- Sky shader interpolates two full palettes by `uCycle`:
  - **Sunset** (cycle=0): peach `0xff8060` horizon → coral `0xc04088` mid → soft lilac `0x402080` top
  - **Night** (cycle=1): hot pink `0xff3090` → magenta `0xa01880` → indigo `0x180844`
- Stars fade in only above `uCycle > 0.45`.
- PS2 material gets a directional **sun term** that's strong at sunset and gone at night (`vec3(1.20, 0.75, 0.45)` warm light from `(0.5, 0.3, 0.2)`).
- Hemispheric sky-fill colors also shift between sunset and night palettes.
- Point light intensity multiplier ramps `0.35 → 1.15` from sunset to night — lanterns/pool/window glow brighter at night when the sun's gone.
- Drive: `cycleUniform.value = 0.5 - 0.5 * cos(elapsed * Math.PI * 2 / 60)` — smooth ease in/out, 60s round trip, lingers at each extreme.

### NEW: Camera anchor jumper system
7 anchors, click any one to fly there. Each anchor = `{ name, label, cx, cy, cz, yaw, pitch, radius }`. Click → `flyToAnchor(idx)` saves the current state and sets `flyState`. `animate()` lerps center+yaw+pitch+radius from start to target over 1.4s using `easeInOutCubic`. Orbit input remains live throughout — the user can drag during the fly, but each frame the tween overrides until done.

Anchors:
1. **POOL** — front pool deck overview (default, matches old b026 starting view)
2. **BEACH** — sitting on the sand at z=30, looking back at the villa
3. **AERIAL** — drone shot from above looking down at the property
4. **LIVING** — inside the central villa, framing the sofa + TV
5. **BEDROOM** — west wing upper floor, framing the bed
6. **BILLIARD** — east wing ground floor, framing the pool table + bar
7. **INDOOR** — atrium behind the villa, framing the indoor pool + sauna

The previous `CAM_CENTER_X/Y/Z` constants are now mutable `camCenterX/Y/Z` variables that the anchor system writes during fly tweens.

DOM **anchor strip** rendered as a horizontal pill bar at the bottom of the canvas (`.world-anchor-bar`), one button per anchor. Active button has a purple gradient highlight. Mobile breakpoint wraps the buttons and shrinks them. The bar is appended to the villa container; click events `stopPropagation` so they don't dispatch as canvas clicks (which would try to open a villa card).

### NEW: 6 interior props on propTracks
Tracks 14-19 added: `living_tv`, `pool_table`, `bar_counter`, `bed`, `indoor_pool`, `sauna`. The b026 click→card system already raycast-walks parent chains by name, and the b026b yellow BoxHelper outline pass already finds anything in `propTracks` by traversing the scene — no changes needed there. Click any new interior prop → song card pops up.

### Files modified
- [js/world.js](js/world.js) — major surgery (~3124 lines, was ~2900). Most of init() restructured: rip pass, beach + ocean wrap, indoor atrium block, interior furniture clusters, day/night uniform, sky + PS2 shader updates, camera anchor system, DOM bar, fly tween in animate, destroy cleanup.
- [style.css](style.css) — `.world-anchor-bar` + `.world-anchor-btn` (idle / hover / active) + mobile breakpoint
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b028a → b029`
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

### What's NOT in b029 (deferred)
- Real interior partition walls between the rooms (camera framing sells the rooms anyway, walls would block the orbit camera)
- WASD walking (user picked anchor jumper specifically — no walking needed)
- Bonfire / hammock / beach umbrellas as new tracked props (existing umbrellas + chairs from b022 still on the beach)
- Vertex-color gradient walls + procedural noise textures from the b028 plan (still in the bag for a polish pass)
- Removing the yellow BoxHelper debug outlines (user said they're still helpful)

## b028a — 2026-04-07 — Hotfix: hemispheric sky fill (no more black hills) + Play keeps card open

Two follow-ups to b028.

### 1. Black hills / dark geometry
After b028 cut fog density 3× AND bumped lighting contrast, anything outside the tight point-light ranges (lampRange=14, poolRange=18, windowRange=12) was rendering nearly black with no fog to mask it. The neighbor villas in the back, the boulevard, the side hills — all going pitch black.

Added a **hemispheric sky-fill** term to the PS2 fragment shader. Sky color from above (`vec3(0.45, 0.16, 0.42)` magenta), warm ground bounce from below (`vec3(0.55, 0.14, 0.30)`), blended by `vNormal.y * 0.5 + 0.5`. Multiplied by `0.75`, modulated by `uColor`, added on top of ambient. Free secondary lighting that fills shadowed areas with sky/ground color without flattening the contrast on lit pools.

This is the standard trick (hemispheric/IBL light) every modern game uses. Cheap, ~5 lines of GLSL, no extra uniforms needed.

Tweaked ambient slightly down too: `0.22,0.16,0.34 → 0.18,0.12,0.28`. The hemispheric term is doing the work that ambient used to do, and it's more directional/believable.

### 2. Play button kept the card open
User: "i wish pressing play wouldnt close the popup tho". Removed the `closeVillaCard()` call from the Play button handler in [js/world.js](js/world.js). Now the card stays open after pressing Play so the user can watch the waveform react live to the audio. Closing still works via × button or click-outside.

### Files modified
- [js/world.js](js/world.js) — hemispheric sky-fill in PS2 fragment shader, removed closeVillaCard from play handler
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b028 → b028a`
- [CHANGELOG.md](CHANGELOG.md) — this entry

## b028 — 2026-04-07 — Graphics overhaul: PS2/Dreamcast palette, rim light, dither, no muddy fog + reactive waveform

User said the villa was reading like "an ugly shitty version of Sims or Second Life" and asked for proper PS1/Dreamcast/PS2 nostalgia with **cool beautiful colors and no heavy fog**. Locked direction at PS2-leaning (the 854×480 + 320×180 jitter grid stays — that part was already right) but with lush saturation instead of pastel washout. Plus the waveform fix from the user's previous note ("waveform should only be active upon pressing play").

### 1. Fog density slashed
`FogExp2` density `0.009 → 0.003` and color shifted from muddy purple `0x40285a` to richer magenta `0x6a1850`. Updated in scene-level fog AND in the three custom shader materials that bake fog manually (PS2, pool, ocean) so they all blend toward the same hue. The old fog was eating saturation across the entire scene — that was the single biggest reason colors looked washed out. Renderer clear color also shifted from `0x1a1238` to `0x2a0a35`.

### 2. Sky palette pumped
- bottom (horizon) `0xff7050` → `0xff4090` (hot pink, was muddy orange)
- mid `0x9a3070` → `0xc02888` (deep magenta, was lavender)
- top (zenith) `0x0a0a3a` → `0x180844` (richer indigo)

### 3. Lighting — brighter pools, tighter falloff
Hard pools of warm/cyan light instead of a uniform glow:
- `lampRange` 22 → 14, color `0xffc080` → `0xffaa50` (hotter)
- `poolRange` 26 → 18, color `0x40fff0` → `0x30ffe8` (more saturated)
- `windowRange` 18 → 12, color `0xffd090` → `0xffc070`

Lighting math also rebalanced: ambient cooled (`0.28,0.24,0.40 → 0.22,0.16,0.34`), `pointLight()` falloff is now `pow(fall, 1.7)` instead of `fall*fall` (more cinematic), and the N·L term weighted heavier (`0.30 + ndl*0.70 → 0.18 + ndl*1.05`) so lit faces really pop and unlit faces go nearly black. **Way more contrast.**

### 4. RIM LIGHT (PS2 fragment shader)
The single biggest "I am playing a PS2 game" tell. Pass `vViewDir` from vertex shader, then in the fragment:
```glsl
float rim = 1.0 - max(dot(N, V), 0.0);
rim = pow(rim, 2.4);
col += vec3(1.00, 0.30, 0.65) * rim * 0.55;
```
~3 lines of GLSL, hot pink Fresnel against the sky. Edges of every PS2-shaded object now glow magenta at grazing angles. Massive nostalgia hit.

### 5. Bayer dither + tone curve (post shader)
Post shader was just scanlines + vignette. Added:
- **Tone curve** — `pow(c.rgb, 0.92)` gamma lift, saturation boost (+32%), contrast nudge (+8%). Makes the saturated palette actually land instead of getting crushed.
- **4×4 Bayer dither** — quantizes output to 5-bit-per-channel with the classic ordered-dither pattern at the framebuffer pixel grid. Adds chunky banded gradients in the sky and lit walls. The dither pattern is hardcoded as 16 `if`s instead of an array constant because old WebGL drivers don't always handle const arrays well.

### 6. Waveform reactive (popover card)
User: "waveform should only be active upon pressing play". Refactored:
- Bars sit flat at `height: 14%` via CSS, no more `@keyframes villa-wave-pulse` decoration.
- New `updateVillaCardWaveform()` runs every frame from `animate()`. Checks `state.isPlaying && state.currentTrack === villaCardTrackIdx`. If matching, samples `getFrequencyData()` (one band per bar across the lower 2/3 of the spectrum) and writes per-bar `style.height`. Otherwise resets bars to flat.
- Bumped from 18 to 22 bars for tighter spectrum coverage.
- `closeVillaCard()` now also clears `villaCardBars` and `villaCardTrackIdx` so the global update loop becomes a no-op.

### Files modified
- [js/world.js](js/world.js) — fog density/color, sky palette, light constants, PS2 vertex+fragment shader (rim light), pool/ocean fog uniforms, post shader (tone curve + Bayer dither), `updateVillaCardWaveform`, animate loop hook, `showVillaCard` bar markup
- [style.css](style.css) — `.villa-card-wave span` flat resting state, removed `@keyframes villa-wave-pulse`
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b027 → b028`
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

### Skipped from the original 8-step plan
Items 3 (vertex-color gradients on plaster), 4 (procedural noise textures), and 7 — wait, 7 was the lights which DID get done. Skipped: 3 and 4. Both are bigger surgery and we can iterate after seeing how the simpler changes (fog kill + rim light + dither + palette pump) land. If walls still look too plain after this build, those are the next two cards.

## b027 — 2026-04-07 — Villa popover card (anchored at click), no more side panel for villa view

Two fixes in one. (1) **Desktop click was returning `hit: null` even when the cursor showed a pointer.** Re-raycasting at click time was unreliable for some reason — possibly DPR/scaling skew or a few-pixel drift between hover and click in `e.clientX`. The cached `hoveredProp` from the most recent mousemove is the same value that drives the cursor flip, so if the cursor showed a pointer, the click hits. `onCanvasClick` now reads `hoveredProp` instead of re-raycasting. (2) **The slide-in side panel was wrong for the villa view.** User explicitly: "i dont want a side panel to open. i want a small card to hover over the clicked item and from there it gives some description, a thumbnail, play button and cool waveform of the song or something." Built that.

### Villa popover card (`.villa-card`)
New DOM element appended to `<body>` and positioned at the click coordinates. Lives in [js/world.js](js/world.js) as `showVillaCard(index, screenX, screenY)` + `closeVillaCard()`. Independent of `showTrackDetail()` — that side panel still ships for the deepsea/neural views which use it.

- **Anchor logic** — defaults to above-the-click; if it would clip the top of the viewport, flips below. Horizontal position clamped to viewport with a 12px margin. Centered on the click X.
- **Layout** — 280×~auto card, dark frosted background (`backdrop-filter: blur(10px)`), purple ring shadow, rounded 14px corners.
- **Content** — gradient thumbnail (56×56) using existing `getGradient(index)` palette, NEW/FEAT badges, title (truncated), artist, 2-line clamped description, decorative animated waveform (18 CSS-animated bars on a purple→cyan gradient), full-width Play button.
- **Waveform** — pure CSS `@keyframes villa-wave-pulse` per-bar with staggered `animation-delay`. Not yet wired to live `getFrequencyData()` — that's a TODO once a track is actually playing while the card is open.
- **Dismiss** — explicit × button, Play button (which also fires `playTrack(index)`), or any click outside the card (capture-phase mousedown listener on document). The outside-click handler is registered on the next frame so the click that opened the card doesn't immediately close it.
- **Cleanup** — `destroy()` calls `closeVillaCard()` so leaving the villa view tears down the popover and detaches the outside-click listener.
- **Touch path** — `onTouchEnd` also calls `showVillaCard(safeIdx, lastDragX, lastDragY)` so mobile taps get the same popover.

### Click reliability fix
`onCanvasClick` no longer calls `updateMouseNDC` + `pickPropAtMouse`. Instead it reads `hoveredProp` (set by the hover detection in `onMouseMove`) and dispatches the card if it's truthy. Source-of-truth match: cursor and click now share the same input. The old re-raycast path was returning null on desktop even when hovering an outlined prop — root cause unconfirmed (possibly a sub-pixel drift between the move and the click event), but routing through the same cache makes the question moot.

The yellow `BoxHelper` debug outlines from b026b stay in place — user said "the box esp really helps me visually right now". They'll come out when we want a cleaner final look (probably replaced with a subtle glow on hover only).

### Files modified
- [js/world.js](js/world.js) — `onCanvasClick` reads `hoveredProp`; `showVillaCard`/`closeVillaCard`/`escapeHtmlSafe` added; `onTouchEnd` switched to villa-card; `destroy` closes the card
- [style.css](style.css) — `.villa-card` block + `@keyframes villa-wave-pulse`; mobile width override
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b026b → b027`
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

## b026b — 2026-04-07 — Click dispatch via real `click` event + yellow outlines on every clickable prop

After b026a, the cursor flipped to a pointer correctly when hovering the pink Lambo, but actually clicking did nothing — and the user reported the same for the yellow Lambo and others. The hover→cursor path proved raycast + propTracks lookup were both working, so the bug was somewhere in the manual mousedown→mouseup → "wasClick" dispatch logic in [js/world.js](js/world.js).

### Fix
Stopped re-implementing `click` by hand. The browser already fires a `click` DOM event only when mousedown→mouseup occurred on the same element with no significant movement — strictly more reliable than the homemade `isDragging && !dragMoved` check. Added a real `click` listener on the container (`onCanvasClick`) that does the raycast + propTracks lookup + `showTrackDetail()` dispatch. Removed the click branch from `onMouseUp` (it now just resets cursor + drag state).

A `dragMoved` guard remains as belt-and-suspenders for the case where a real drag releases over a prop. Added a `console.log('[villa b026b click]', ...)` so future regressions are diagnosable from devtools without code spelunking.

### Debug outlines (temporary)
User asked: "can all our active props have a highlight around them for time being". Added a `THREE.BoxHelper` (yellow `0xffee00`, depth-test off, opacity 0.9, renderOrder 999) around every Object3D in the scene whose `.name` is a key in `propTracks`. Done in `init()` after the scene graph is built but before input listeners are wired up. The `traverse()` walk also `console.log`s the names found, so we can confirm whether a prop's `.name` is actually being set during construction (e.g. if `bell_tower` shows up but `surfboard` doesn't, that's a clue the surfboard mesh-naming code is missing or wrong).

### Files modified
- [js/world.js](js/world.js) — `onCanvasClick` added, click branch removed from `onMouseUp`, BoxHelper outlines added in init, listener wired in setup + cleaned up in destroy
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b026a → b026b`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b026a — 2026-04-07 — Hotfix: cursor and click events were going to the wrong element

b026 deployed but the click→card system appeared dead — hovering the pink Lambo didn't change the cursor and clicks didn't dispatch cards. Diagnosis: I was setting `container.style.cursor` in JS, but [style.css:540-548](style.css#L540-L548) has `.world-canvas { cursor: grab; }` and the canvas is `position: absolute; inset: 0` ON TOP of the container. The canvas's CSS cursor wins because the canvas is the actual hit target for pointer events, AND the CSS rule on the canvas overrides any inline cursor on the parent container. The hover and click logic was running fine — it just couldn't update the cursor visually.

### Fix
Changed all 4 `container.style.cursor = X` writes in [js/world.js](js/world.js) to `(canvas || container).style.cursor = X`. Inline styles on the canvas override the CSS rule because inline styles win the cascade. The `(canvas || container)` fallback keeps it safe even if the canvas reference somehow doesn't exist yet.

### Why this slipped past
The drag/grab cursor was working in b014 onward because `:active` is a CSS pseudo-class that fires on mousedown — it doesn't depend on JS setting the cursor. So `cursor: grab` (idle) and `cursor: grabbing` (`:active`) were both CSS-driven, never JS-driven. b026 was the first build that needed JS to drive the cursor (to switch to `pointer` on hover). I assumed the cursor was already JS-controlled — it wasn't.

### Files modified
- [js/world.js](js/world.js) — 4 cursor writes redirected to canvas
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b026 → b026a`
- [CHANGELOG.md](CHANGELOG.md) — this entry

## b026 — 2026-04-07 — Click→card system MVP (the actual destination interaction loop)

User: "can we start working on the card click music portion pls? just so i have a working concept going". The destination interaction the entire project has been building toward — click a prop in the villa scene, get a song card pop up with a play button. **Working concept shipping in this build.** Reuses the existing `showTrackDetail()` modal in [js/app.js](js/app.js) instead of building a new card UI from scratch — that function already creates a beautiful detail panel with title, gradient art, artist, credits, description, tags, links, play button, close button.

### Architecture
- **`THREE.Raycaster`** in world.js, fired on mouse click and tap
- **Walk-up parent chain** on each raycast hit until we find a node whose `.name` matches a key in the `propTracks` lookup
- **`propTracks` lookup** — JS object mapping prop names → track indices (with `% tracks.length` wrap so it doesn't break if config.json has fewer tracks than props)
- **Drag-vs-click detection** — track pixel movement from `mousedown` to `mouseup`. If less than 4px (`DRAG_CLICK_THRESHOLD`), it's a click. Otherwise it's the end of an orbit drag and we don't dispatch a card. Same logic for touch tap-vs-drag.
- **Hover detection** — on `mousemove` (when not dragging), raycast and change cursor to `pointer` over clickable props, back to `grab` everywhere else
- **Click dispatch** — calls existing `showTrackDetail(trackIdx)` from app.js, which opens the detail modal with a Play button. Falls back to `playTrack(trackIdx)` if showTrackDetail isn't loaded.

### What's clickable in this MVP (14 prop types, ~25+ instances)
| Prop name | Track index | What it is |
|---|---|---|
| `lambo_pink` | 0 | Pink Lambo on the deck (-14, 5) |
| `lambo_yellow` | 1 | Yellow Lambo in the driveway |
| `yacht` | 2 | Any of the 3 yachts in the front ocean |
| `jetski` | 3 | Any of the 3 jet skis closer to shore |
| `tikibar` | 4 | Tiki bar far west on the beach |
| `firepit` | 5 | Fire pit west of the pool deck |
| `bbqbar` | 6 | BBQ bar east of the jacuzzi |
| `fountain` | 7 | 3-tier marble fountain in the garden |
| `pierDeck` | 8 | Pier extending into the ocean |
| `statue_obelisk` | 9 | Obelisk statue on the front lawn |
| `statue_sphere` | 10 | Sphere-on-pedestal statue on the front lawn |
| `statue_abstract` | 11 | Abstract stacked-cubes statue on the front lawn |
| `bell_tower` | 12 | Mediterranean villa bell tower |
| `surfboard` | 13 | Any of the 3 surfboards leaning on the tiki bar |

Track indices wrap around with `% tracks.length` so even with fewer than 14 tracks in config.json, every prop still maps to something playable.

### Code changes in [js/world.js](js/world.js)
- **State variables** at the top of the IIFE (~10 lines): `raycaster`, `mouseNDC`, `dragStartX`, `dragStartY`, `dragMoved`, `propTracks`, `hoveredProp`, `DRAG_CLICK_THRESHOLD`
- **`updateMouseNDC(e)` helper** — converts mouse pixel position to normalized device coordinates relative to the canvas
- **`pickPropAtMouse()` helper** — runs the raycaster, walks up the parent chain on each hit, returns the first matching prop name (or null)
- **`onMouseDown` modified** — records `dragStartX`/`dragStartY`, resets `dragMoved`
- **`onMouseMove` modified** — when dragging, tracks total movement; when NOT dragging, runs hover detection and updates cursor
- **`onMouseUp` rewritten** — checks `wasClick = isDragging && !dragMoved`. If true, raycasts at the mouse position and dispatches `showTrackDetail()` for the matched prop
- **`onTouchStart` modified** — same drag-start tracking for single-finger touch
- **`onTouchMove` modified** — same total-movement tracking for tap-vs-drag
- **`onTouchEnd` rewritten** — detects tap (drag mode + no movement) and dispatches `showTrackDetail()` for the matched prop, using the last touch position
- **Raycaster + propTracks initialization** in the `init()` function right after camera setup
- **`addCar(cx, cz, hex, rotY = 0, name = null)` signature extended** — accepts optional name and now `return g`s the group, sets `g.name = name` so the click handler can find it
- **Pink Lambo addCar call** — passes `'lambo_pink'` as name
- **Yellow Lambo addCar call** — passes `'lambo_yellow'` as name
- **Fountain `basin1` mesh** in `addGarden` — gets `name = 'fountain'`
- **Bell tower `shaft` mesh** in the bell tower block — gets `name = 'bell_tower'`

### What this MVP does NOT include (deferred to v2)
- **Visual highlight pulse** on hovered props (just cursor change for now)
- **Camera fly-to-prop animation** on click — clicking just opens the card, camera doesn't move
- **Per-prop card art** — every card uses the existing gradient art from app.js (`getGradient(index)`). Custom art per track is a config.json change later.
- **Sound effect on hover/click** — silent
- **Outline / glow** on hovered props — defer until VISION.md §6 v2 work
- **Click detection on multi-mesh props that aren't grouped** (e.g. clicking a chair stub around the fire pit instead of the fire pit ring itself won't match — only the named main mesh dispatches). This is acceptable for MVP — the named mesh in each prop is the obvious large click target.

### How to test
1. Hard-refresh the deployed site
2. Hover over the pink Lambo on the pool deck — cursor should change to pointer
3. Click it — track detail panel pops up with Play button (track 0 from config.json)
4. Click outside or hit X to close
5. Hover/click any of the other 13 props in the table above — each opens its own track card
6. Drag the camera around — orbit still works, no card pops up at the end of a drag

### Files modified
- [js/world.js](js/world.js) — raycaster + click handler + hover + propTracks + name additions (~110 lines)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b025a → b026`
- [VISION.md](VISION.md) — section 6 marked as MVP shipped, section 9 click→card item updated
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

### Still deferred
- Villa pivot to fully modernist (b027 — user gave reference photos and direction this turn, will be next major build)
- Showroom car swap (yellow G-Wagon, Corvette, "something crazy")
- Art style "ugly Roblox" dial-back
- Hill mat fix v2

## b025a — 2026-04-07 — Hotfix: TDZ on lanternGlowMat (villa wouldn't load)

b025 villa rebuilt fine but the page hung on init — never finished loading the villa view. Diagnosis: classic TDZ trap, same pattern as b017. The new `addSconce` helper inside the villa block uses `lanternGlowMat`, but `lanternGlowMat` was declared at line 980 (inside the deck-lantern block) — way AFTER the villa block runs (~line 870). When `addSconce` was called for the first villa wall sconce, `lanternGlowMat` was in the temporal dead zone → `ReferenceError: Cannot access 'lanternGlowMat' before initialization` → init crashed silently → page never finished loading.

`node --check` does NOT catch TDZ errors. Same lesson as b017 (cylindrical tower used `windowMat` before its declaration), b025 (`windowMat` got moved up correctly but I forgot to do the same for `lanternGlowMat`).

### Fix
Moved `lanternBaseMat` and `lanternGlowMat` declarations from line 980 (inside the deck-lantern block) up to the top of the material section, right after `terracottaMat`. Now they're declared once at the top alongside `windowMat` and available to the villa block. The deck-lantern block keeps its `addDeckLantern` function but no longer redeclares the materials.

### Future-proofing
Updated the comment in VISION.md / CLAUDE.md context: any material used by code in MORE than one block (sconces in villa block + deck lanterns block, windowMat in villa + yacht + tiki + BBQ + showroom + neighbor villas, etc.) needs to be declared at the top of the material section, not inside the block where it was first used. The "declare it where it's used" pattern only works if it's used in exactly one place.

### Files modified
- [js/world.js](js/world.js) — moved `lanternBaseMat` + `lanternGlowMat` decls up, removed dupes from deck-lantern block (~10 lines net)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b025 → b025a`
- [CHANGELOG.md](CHANGELOG.md) — this entry

## b025 — 2026-04-07 — VILLA REBUILD: Mediterranean U-shaped mansion with bell tower

User feedback after b024: "house honestly looks ugly... like a bunch of shapes glued together." Right call. The b010-b019 modernist stack (1 lower + 2 cantilevered upper boxes + cylindrical tower + LED strips + wood louvers + forward balcony + rooftop hot tub + spiral stairs) had no coherent architectural language — it was 7 distinct volumes with surface decoration patched on top. No amount of cornice/sconce/mullion fix was going to save the bones.

Full architectural rebuild. Replaces ~460 lines of old villa code with ~520 lines of new Mediterranean villa code.

### New architectural form

**U-shaped layout** hugging the pool:
- **Central block** at `(0, *, -10)`: 14×14 footprint, 2 floors (8m total height), hipped terracotta roof
- **East wing** at `(11.5, *, -10)`: 9×14 footprint, 1.5 floors (6m), hipped terracotta roof
- **West wing** at `(-11.5, *, -10)`: mirror of east
- **Bell tower** (campanile) embedded in the back-west corner of the west wing at `(-13, *, -14)`: 3 stages — stone base + plaster shaft (rises 11m) + marble belfry with 4 corner pillars and visible bell + terracotta cap pyramid. Total height ~17m, the highest point in the scene.

Total villa footprint **32×14** (was 32×18). Fits within the existing 34×20 podium.

### Materials
- **NEW** `terracottaMat` `0xc05030` — rust orange tile for hipped roofs and bell tower cap
- **REMOVED** `villaMat2` (was only used by the old second upper volume)
- **REMOVED** `coveMat` (was only used by the old recessed cove light strip)
- **MOVED UP** `windowMat` from inside the old villa block to the top of the material declaration section. It's used by villa windows AND yacht windows AND tiki bar AND BBQ AND showroom AND neighbor villas — must be declared once at the top.
- **REUSED** from b024 palette: `marbleMat` (paths, columns, balconies, frames, sills, headers, sconce trim), `stoneMat` (ground floor walls, tower base, tower waist), `villaMat` (plaster upper walls), `lanternGlowMat` (sconce glow + bell rope)

### Material mixing on every section
Stone ground floor + plaster upper floor + marble cornices/frames/columns + terracotta tile roofs + dark `railMat` mullions and door slabs and balcony rails. The villa is no longer a single-material monolith.

### Helpers added (inside the villa block, local scope)
- `addWallBox(cx, cz, w, d, h, yBase, mat)` — 4-sided wall around a footprint
- `addArchedWindow(cx, cy, cz, w, h)` — warm pane + marble surround (header + sides + sill) + 3 dark mullion bars. PS2 chunky abstraction of an arched window — rectangular framing instead of actual curved geometry, with a slightly wider top header to suggest the arch.
- `addSconce(x, y, z)` — small dark housing + warm glow box
- `addHippedRoof(cx, cy, cz, w, d, h, mat)` — `ConeGeometry` with `radialSegments=4`, rotated `Math.PI/4` so the 4 sloped sides face N/S/E/W. Vertices land on the wall corners. For non-square footprints, scales Z to stretch.
- `addCornice(cx, cy, cz, w, d)` — marble band wrapping a building section at a given height (front + back + left + right strips)

### Feature counts
- **2 floors of walls per section** × 3 sections (central + 2 wings) = **24 wall meshes**
- **2 cornice bands per section** × 3 sections × 4 strips each = **24 cornice strips**
- **3 hipped roofs** (central + 2 wings) plus **1 cap pyramid** on the bell tower
- **15 arched windows** total: 5 front central (2 ground + 3 upper), 5 back central, 4 east wing front, 4 west wing front, 2 east wing back, 2 west wing back. Each arched window = 8 meshes (pane + 4 frame pieces + 3 mullions). **~120 window meshes.**
- **Main entry**: arched door pane + dark inset slab + 2 marble columns + 2 marble capitals + marble header = 7 meshes
- **Wrought iron balcony**: floor slab + front rail + 14 front posts + 2 side rails + 8 side posts = 26 meshes
- **2 wing side doors** (east + west) with marble headers
- **Back door** on central block back wall
- **Bell tower**: stone base + plaster shaft + stone waist + 4 narrow shaft windows + bottom belfry slab + 4 corner pillars + top belfry slab + bell + bell rope + cap pyramid = 15 meshes
- **12 wall sconces** (front entry, front upper corners, wing side doors x4, back door, wing front facade x2)
- **Grand entrance**: 4 marble steps (relocated to villaCx=0, was at -6.995) + 2 marble planters with topiary cones

**Total new villa meshes: ~250+**

### What got DELETED from world.js
- `lowerW`/`lowerH`/`lowerD` constants and the lower volume box
- 7 stone columns + the `colXs` array
- Lower roof slab
- First upper volume box + cantilever roof slab
- Second upper volume box + roof slab
- `addLedStrip` helper + 3 call sites
- Rooftop terrace parapet east wall + front wall
- Recessed cove light strip
- Cylindrical tower (body + glass band + cap)
- `addLowerGlass` helper + 6 FTG glass panes
- Upper FTG glass + upper side glass + upper2 FTG glass
- Front door + back door (recreated in new style)
- Wood louver slats block (14 slats)
- Forward balcony + 18 posts (b019)
- Rooftop hot tub (b019)
- Spiral exterior staircase (12 steps, b019)
- Old grand entrance steps + planters at `doorX=-6.995` (recreated at `villaCx=0`)
- `villaMat2` const (was only used by deleted second upper)
- `coveMat` const (was only used by deleted cove strip)

### Surgical fixes around the rebuild
- **Garage position** at [js/world.js:1023](js/world.js#L1023): was `villaCz - lowerD/2 - garageD/2`, now `villaCz - centralD/2 - garageD/2`. The new central block is 14m deep (was 18m), so the back wall moved forward by 2m. Garage follows.
- **Interior shell resized** from old 32×18 (lower volume) to 14×14 (central block). Only the central block has a walkable hollow interior; the wings are solid exterior in this build.
- **`windowMat` declaration relocated** from inside the old villa block to the top of the material section, so it's available to all the other code that uses it without depending on villa code being earlier.

### What STAYS unchanged
- All scenery from b022/b023/b024: garden, supercar showroom, beach, ocean, yachts, jet skis, pier, tiki bar, surfboards, fire pit, BBQ bar, statues, hills, hill villas, neighbor mansions, road, sidewalks, streetlamps, palms, skyline
- Pool + jacuzzi + pool deck props (daybeds, lanterns, boulders, path lights)
- Pink Lambo + yellow Lambo + garage door
- Camera (orbit drag/zoom/pinch from b014)
- Sky shader, ocean shader, fog, render pipeline (PS2+ 854×480 + 320×180 jitter — still pending dial-back, see b026 deferred)

### Files modified
- [js/world.js](js/world.js) — material declarations cleaned up + ~460 lines of villa code replaced with ~520 lines + garage z fix (~+60 net)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b024 → b025`
- [VISION.md](VISION.md) — small update to section 4 noting the architectural baseline shifted from modernist stack to Mediterranean U-shape
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

### Still deferred (tracked in VISION.md section 9)
- Showroom car swap (yellow G-Wagon, Corvette, "something crazy") — b026 candidate
- Art style "ugly Roblox" dial-back — needs sign-off on render-target numbers
- Hill mat fix v2 — emissive boost
- Click→card system build — design done in VISION.md, build comes after villa scene density is sufficient

## b024 — 2026-04-07 — Luxury garden v2 + palette upgrade + VISION.md

User feedback after b023: "the garden is tiny, no greenery (many plants, shrubs, cool plants), all green is very dark and fogged? the garden u made is an ugly square terrace with no grass no color etc just some lights and a tiny fountain. were talking exorbitant wealth for this scene and property." Owned the failure. b023's garden was a checkered terrace with floating cubes — not luxury. Two structural problems addressed in this build:

1. **All greens were the same dark fogged tone** (`shrubMat` + `topiaryMat` both at `0x2a4a25`). Same root cause as the hill plateau problem.
2. **The garden was sparse** — perimeter hedges + 4 corner topiary cones + a fountain stub + 8 floating emissive cubes. 25 meshes total. Real luxury gardens have ~80+ varied props.

### Palette upgrade (affects all scenes going forward)
- `shrubMat` `0x2a4a25 → 0x4a7a30` — manicured green that survives fog (also brightens existing shrubs around the pink Lambo)
- `topiaryMat` `0x2a4a25 → 0x3a6028` — slightly darker than shrubMat for tonal variety (also brightens existing entry topiary cones from b019)
- 5 new luxury foliage/hardscape mats:
  - `lawnMat` `0x5a8c38` — bright manicured lawn
  - `bougainvilleaMat` `0xd83080` — magenta blooms (the iconic Miami villa flower, complements the dusk pink sky)
  - `roseMat` `0xc02030` — deep red roses
  - `lavenderMat` `0x9468d0` — purple lavender stalks
  - `marbleMat` `0xf6f1e4` — luxury white marble (paths, fountains, statues, planters, benches)

### Garden v2 — actual luxury garden at `(-32, 13)`
**Footprint:** 22×18 (was 14×16). Density jump: ~25 meshes → ~85 meshes.

- **Bright lawn plane** under the entire garden (the scene finally has actual grass color, not deck-fill)
- **Manicured hedge perimeter** — taller (1.4m vs 0.7m), 4 sides, brighter `shrubMat`
- **Marble cross paths** (`marbleMat`, was thin `rimMat` strips)
- **3-tier ornate marble fountain** at center (was a stub): wide base pool 2.5m radius + cyan water disc, marble column, middle basin 1.5m radius + cyan water, upper column, top tier basin, crowning marble sphere. ~3.2m tall total — the actual centerpiece.
- **6 plant helpers** added inside `addGarden` (could be promoted to top-level later for reuse): `addTopiaryCone`, `addTopiarySphere`, `addTopiarySpiral`, `addBougainvillea`, `addRoseBush`, `addLavenderClump`, `addUrnPlanter`
- **~30 plants of varied species:**
  - 4 corner topiary cones + 4 inner-edge topiary cones (8 cones total, varied heights)
  - 4 topiary spheres flanking the fountain
  - 4 topiary spirals at the path corners
  - 6 bougainvillea bushes spilling over the hedges (green base + magenta bloom cluster)
  - 6 rose bushes scattered across quadrants
  - 4 lavender clumps in the corner zones
- **8 marble urn planters** at hedge corners + path entrances, each with a small topiary on top
- **2 marble corner statues** flanking the fountain on the long axis: an obelisk and a sphere-on-pedestal (both reuse the b022 statue motifs but in marble instead of stone)
- **2 marble benches** flanking the fountain on the short axis (seat + 2 legs + back)
- **2 pergola archways** at the north + south path entrances: 4 marble posts + horizontal beams + 5 cross slats + bougainvillea drape blooms on top
- **6 pathway lanterns** lining the marble paths (reuse `addDeckLantern`)

### VISION.md (new file)
Captures the design bible: project vision, the Drake's-site reference, how Kani diverges, art direction (the PS2 sweet spot, the luxury rule, fog/palette discipline, the current palette table), scene density priorities, click→card system design, camera principles, what's out of scope, open questions, do/don't checklist. Future Claude reads this when starting fresh chats or when proposing any "luxury" or scenery feature.

The b023 garden failure is the precipitating lesson: **a luxury feature has ≥20 props of varied types, density > size, multiple scales, and a centerpiece bigger than the surrounding props.** Codified in VISION.md section 4.

### Files modified
- [js/world.js](js/world.js) — palette mats updated + 5 new mats + complete `addGarden` rewrite (~280 lines net)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b023 → b024`
- [VISION.md](VISION.md) — new design bible
- [FILE_MAP.md](FILE_MAP.md) — build bump + VISION.md reference
- [CHANGELOG.md](CHANGELOG.md) — this entry

### Deferred (still tracked in VISION.md section 9)
- Showroom car swap (yellow G-Wagon, Corvette, "something crazy") — b025
- Art style "ugly Roblox" dial-back (render target + jitter recalibration) — b026, needs sign-off on specific numbers
- Hill mat fix v2 (probably needs emissive boost not just brighter colors) — deferred until art-style work
- Click→card system build — design done in VISION.md, build comes after scene density is sufficient

## b023 — 2026-04-07 — Flanking lots: garden + supercar showroom, pool palm bug fix

User feedback after b022 deploy: 1) "two palm trees in the pool lol" — long-standing bug. 2) "two other less impressive mansions should be where the two circles exist. or maybe a huge garden on 1 side and something rich and cool on the other." Picked option B (garden + showroom — more variety than yet more mansions next to the existing cross-street row).

### Bug fix: 4 misplaced palms
The 4 "courtyard" palms in [js/world.js:840-843](js/world.js#L840) were placed pre-b013 when the villa was much smaller and there was no pool yet. After villa expansion (b013) + pool expansion (b014/b016), they ended up in invalid spots:
- `(-9, 4)` — INSIDE the pool (pool spans `x ∈ [-11, 11], z ∈ [2, 8]`)
- `(4, 5.5)` — INSIDE the pool
- `(-7, -5)` — INSIDE the villa lower volume (`z ∈ [-19, -1]`)
- `(7.5, -4.5)` — INSIDE the villa lower volume

Relocated to frame the front entry approach, in 2 pairs:
- Close pair (z=16): `(-14, 16)` `(14, 16)`
- Far pair (z=24): `(-12, 24)` `(12, 24)`

### West lot: formal garden at `(-32, 13)`
14×16 footprint. Hedge perimeter on all 4 sides (`shrubMat`, 0.7 tall). Light stone cross paths down the middle (`rimMat`). Central fountain — stone basin + cyan water disc (reuses `poolMat`'s shader) + spout pillar with flat cap. 4 topiary cones in the corners (`topiaryMat` from b019). 8 small flower-bed boxes alternating warm/cyan/warm-emissive around the fountain in an ellipse.

### East lot: supercar showroom at `(32, 13)`
14×10 footprint, 4m tall. Stage floor (`rimMat` slab), white plaster roof + 4 corner posts (`villaMat`). Glass back wall + glass left/right walls (`windowMat`) — front face open toward camera so the cars are visible. Cyan LED accent strip along the front edge + a centerline LED strip on the floor (`ledMat`). 3 cars in a row using the existing `addCar` helper: red, blue, orange.

### Files modified
- [js/world.js](js/world.js) — palm relocation (4 lines), `addGarden` + `addCarShowroom` helpers + their call sites (~115 lines added)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b022 → b023`
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

### Deferred
- Hills are still reading dark/fogged after b021. User said "tinker and bug fix later." Will revisit after more scenery is in place — likely needs an emissive boost on the hill mats and/or a hint of rim lighting against the sky, since the fundamental issue is the heavy `FogExp2` killing all color contrast at z=-85 to -120.

## b022 — 2026-04-07 — Beach + grounds scenery batch (yachts, pier, tiki bar, fire pit, BBQ, statues)

User requested two scenery zones after the b021 hill fix: beach/ocean stuff and villa grounds stuff. Seven new prop types added in one build.

### Beach / ocean
- **3 yachts** in the front ocean at varying x/z/scale: `(-18, 62)` `(25, 78)` `(-40, 92)`. Each is a Group of 5 boxes — hull, lower deckhouse, warm window strip, upper bridge, mast. Reuses `villaMat` (white plaster), `windowMat` (warm glow), `railMat` (mast).
- **3 jet skis** closer to shore at `(-6, 50)` `(18, 54)` `(-22, 58)` with varied rotations. Each = hull + accent seat (warm or cyan emissive) + handlebar.
- **Pier** at `x=8`, length `z=30 → 66`. Wood deck (`woodSlatMat`) + underdeck pilings + railing posts every 2.5m + continuous top rails + warm lantern at the tip. Positioned to clear the existing beach chairs at `(±12, 40)`.
- **Tiki bar** at `(-34, 36)` — far west on the beach, away from the villa. 4 wood corner posts, two stacked thatched roof slabs, bar counter with lighter top, warm under-roof glow, 3 stools. Two palms flank it.
- **3 surfboards** leaning against the tiki bar at varied rotations — white, warm-emissive, cyan-emissive.

### Villa grounds
- **Fire pit + 5-seat circle** at `(-22, 18)` (west of pool deck). Stone ring (`CylinderGeometry`) + inner glow disc (`lanternGlowMat`) + 3 small log boxes inside + 5 chair stubs (wood seat + cream cushion) arranged on a `r=3.2` circle.
- **Outdoor BBQ bar** at `(17, 9)` (east of jacuzzi). L-shaped stone counter with lighter rim-mat top slabs + dark grill body + warm heat-strip + 3 bottle stand-ins on the counter.
- **3 garden statues** on the front lawn between deck and beach: obelisk at `(26, 22)`, pedestal+sphere at `(-28, 24)`, abstract stacked-cubes at `(0, 26)`. Three different `addStatue` types (`obelisk` / `sphere` / `abstract`) all use `stoneMat` (sphere uses lighter `rimMat` for contrast).

### Click→card system prep
Per the new project memory, exterior props are valid click→card targets — not just interior furniture. Every prop in this build is added as a `THREE.Group` (or named mesh for the pier) with a `name` field set (`'yacht'`, `'jetski'`, `'tikibar'`, `'firepit'`, `'bbqbar'`, `'statue_obelisk'`, etc.) so the eventual raycaster can wire them up without a refactor.

### Files modified
- [js/world.js](js/world.js) — 7 helper functions + their call sites inserted between the boulevard palms and the skyline section (~265 lines added)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b021 → b022`
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

## b021 — 2026-04-07 — Hill hotfix v2: brighter mats, sky-tinted back ridge, bigger bumps

b020's hill fix didn't visually land. User screenshots showed the hills still reading as one dark mass at default zoom. Two reasons:
1. `hillMat2` (`0x36482b`) was only ~15% brighter than the base — completely eaten by the heavy indigo `FogExp2` at z=-85 to -120. The "alternation" was invisible.
2. `hillMat3` was cool blue. Atmospheric perspective in a dusk-pink sky should pull distant terrain TOWARD the sky color (warm rose), not away from it.

### Changes
- `hillMat2`: `0x36482b → 0x607a38` (much brighter green, survives the fog)
- `hillMat3`: `0x223540 → 0x6a4858` (rose-tinted, atmospheric perspective against the magenta sky)
- Bump caps `~1.6× larger`: width factor `0.34→0.50`, height factor `0.18→0.30`, depth factor `0.55→0.65`. Also bumped `bumpCount` from `1+(seed%2)` to `2+(seed%2)` so every hill gets at least 2 cap boxes.

### Files modified
- [js/world.js](js/world.js) — 3 mat color literals + 6 bump-multiplier numbers + bumpCount base (~10 lines changed)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b020 → b021`
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

## b020 — 2026-04-07 — Hill plateau fix: color variation + silhouette breaks

Fixes the b019 deferred issue: from elevated camera angles the b018 hills read as one giant flat dark plateau because all 6 mounds used the same dark-green mat and all had perfectly flat tops at the same height.

### New hill materials
- `hillMat2` — lighter mid-tone green `0x36482b` for ridge alternation
- `hillMat3` — cool hazy green/blue `0x223540` for the back ridge (atmospheric perspective)

The original `hillMat` (`0x2a3a25`) stays on the back grass plane + two middle hills, so adjacent mounds now alternate between base and lighter tones and no longer merge.

### `addHill` signature change
Now takes `(cx, cy, cz, w, h, d, mat, seed)`. The `seed` drives 1-2 deterministic "bump" caps stacked on top of the main box — smaller sub-boxes at slight x/z offsets and varied heights. Breaks the flat-top silhouette so ridge lines are no longer a single straight line when viewed from above.

Each bump's dimensions/offsets are derived from modular arithmetic on the seed — no RNG, no per-reload variation, scene stays consistent.

### Hill assignments (6 hills × 2 ridges + 1 back)
- Front ridge: `hillMat2` → `hillMat` → `hillMat2` (light/dark/light alternation)
- Mid ridge: `hillMat` → `hillMat2`
- Back ridge: `hillMat3` (hazy cool tone, pops against everything in front)

Hill bodies themselves (position, w/h/d) unchanged from b018 — only mat and bump caps are new. Hill villa positions on top also unchanged (they still sit on the original flat main-box tops, which are still there, just now with small decorative bumps alongside them).

### Files modified
- [js/world.js](js/world.js) — 2 new hillMat variants, `addHill` bump logic, 6 call sites updated with mat + seed args (~30 lines changed)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b019 → b020`
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

## b019 — 2026-04-07 — House upgrades: wood slats, LED strips, balcony, hot tub, spiral stairs, grand entrance

User said "work our house pls" after b018. Six features added to make the villa read as architecture instead of a stack of plaster boxes.

### New materials
- `woodSlatMat` — warm wood `0x6a4a30` for louver slats
- `railMat` — dark metal `0x141014` for balcony rails + planter trim
- `ledMat` — cyan emissive `0x80f0ff` (emissiveAmt 1.6) for LED accent strips
- `topiaryMat` — clipped topiary green `0x2a4a25` for the entry cones

### 1. Wood louver slats on the upper volume
14 vertical wood slats (0.18 × 4.0 × 0.10 each) running across the front of the first upper volume, 0.20 in front of the existing glass band. The interior glow shows through the gaps between slats. Classic modern Miami villa screen detail.

### 2. LED accent strips under all 3 roof slabs
New `addLedStrip()` helper. Cyan emissive lines (0.05 × 0.08 cross-section) inset 0.05 from the front edge of each roof slab, just below the slab bottom. Reads as architectural accent lighting along the cantilever edges.

### 3. Forward balcony with rails on the first upper
1.6-deep balcony slab cantilevering from the upper volume's front face, sitting just above the lower roof at y=6.32. 18 thin metal posts plus a continuous top rail. Gives the cantilever even more drama.

### 4. Rooftop hot tub on the terrace
Small circular jacuzzi (r=1.6) on top of the first upper roof at (upperX+5, upper2Y... well, upperRoof top + 0.16, upperZ). Travertine rim, reuses poolMat for the cyan glow. Sits inside the existing rooftop parapet wall on the east half of the terrace.

### 5. Spiral exterior staircase on the cylindrical tower
12-step half helix wrapping the front-west side of the tower (angles PI/2 to 3*PI/2 — front to back via west, AVOIDING the side embedded in the villa wall). Each step is a small stone box, rotated tangent to the tower. Goes from y=0.4 at the front up to y≈7.7 at the back.

### 6. Grand entrance — stairs + planters + topiary
- 4 stone steps (3.0 wide × 0.20 tall × 0.55 deep) descending from the podium top (y=0.8) to the deck (y=0), positioned in front of the front door at x=-6.995
- Two big planter boxes (1.0³ darker stone) flanking the steps at x±2.4 from the door, with metal trim bands and 1.6-tall topiary cones (CylinderGeometry pointing up) on top

### Files modified
- [js/world.js](js/world.js) — 4 new materials, 6 new mesh blocks (~210 lines added)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b018 → b019`
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

### Known issue (deferred to b020)
The b018 hill rework looks like ONE giant flat dark plateau from elevated camera angles — all the hills are the same color and overlap into a continuous mass. Will fix in a follow-up by adding height variation, color variation, and silhouette breaks.

## b018 — 2026-04-07 — Villa glow nerf, stone podium, Lambo de-shrubbed, hill rework, back grass plane

User feedback after b017 deploy: "mansion looks super ugly, car covered in shrubs, background missing, no grass or elevation for homes behind the main one." This build addresses all four.

### Pink Lambo de-shrubbed
The b016 cluster (6 shrubs around the Lambo at -14, 5) literally surrounded the car — 4 of the 6 were on the camera-facing side, completely hiding it. b018 keeps only 3 shrubs, all on the FAR side (north of the car) so the Lambo is visible from the camera default angle.

- Removed: `(-16, 3) (-15, 1.5) (-13, 1) (-12, 2.5) (-16.5, 6.5) (-15, 7.5)`
- Added: `(-16.5, 7.0) (-14.5, 8.0) (-17.5, 5.5)`

### Villa glow nerf
The front face was washing out into a yellow lite-brite blob. Two changes:
- `windowMat.emissiveAmt`: `2.0 → 0.95` — FTG glass + door + tower glass + garage door + neighbor villa windows still glow but no longer overpower the plaster + columns + asymmetric stack reading
- `windowRange` (the 3-light shader uniform that lights the entire scene from inside the villa): `32 → 18` — was bathing literally everything in warm yellow, including the boulders and the back hills

### Stone podium under villa
The villa was floating on the deck with no base. Added `podiumMat` (darker travertine `0x6f6960`) and a `34 × 0.8 × 20` box at `(0, 0.4, -10)`. Slightly larger footprint than the lower volume so it reads as a base rather than just a darker floor stripe. Interior floor raised from `y=0.02` to `y=0.82` to sit on top of the podium. Walls/columns/door clip into the podium below the visible top — fine, hidden inside the box.

### Second upper plaster contrast
New `villaMat2` color `0xece4d0` (slightly warmer than `villaMat`'s `0xeeeae0`) used only on the second upper volume box. Makes the third floor visually distinct from the first upper, so the asymmetric stepped stack reads as architecture instead of two same-colored boxes.

### Hill rework — taller, closer, wider, more
The b016 hills were too far (`z=-90 to -118`), too short (`h=5-12`), and too few (5) to read as terrain at the camera default distance. Reworked into 6 hills in 3 ridges:
- Front ridge (right behind the cross-street mansions): `(-55, 0, -85) 60×14×24`, `(0, 0, -92) 90×20×28`, `(55, 0, -85) 60×15×24`
- Mid ridge: `(-30, 0, -105) 70×24×20`, `(30, 0, -105) 70×22×20`
- Back ridge: `(0, 0, -120) 120×28×24`

Hills overlap intentionally so they read as a continuous ridge, not 6 separate boxes.

### Big back grass plane
Past the far sidewalk at `z=-46`, the world dropped into void/fog — the cross-street mansions were floating on nothing. Added a `360 × 100` grass plane (reusing `hillMat`) at `(0, 0.04, -100)` covering `z=-50 to z=-150` and `x=-180 to 180`. Now the back half of the world has continuous green ground from the road out to the back hills.

### Hill villas repositioned
9 villas (was 7) repositioned onto the new hill tops:
- Front ridge (y=14-20): `(-50, 14, -85)`, `(-20, 20, -92)`, `(20, 20, -92)`, `(50, 15, -85)`
- Mid ridge (y=22-24): `(-30, 24, -105)`, `(30, 22, -105)`
- Back ridge (y=28): `(-25, 28, -120)`, `(25, 28, -120)`, `(0, 28, -120)`

### Files modified
- [js/world.js](js/world.js) — shrub cluster, windowMat emissiveAmt, windowRange, villaMat2 + podiumMat declarations, podium box, interior floor y, upper2 mat swap, hill rework, back grass plane, hill villa repositioning
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b017 → b018`
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

## b017 — 2026-04-07 — Hotfix: tower block referenced windowMat before declaration

b016 deployed but the villa view crashed on init with:
```
Uncaught (in promise) ReferenceError: Cannot access 'windowMat' before initialization
    at Object.init (world.js:520:9)
```

The cylindrical tower block (added in b016) referenced `windowMat` for its glass band, but I had placed the tower code BEFORE the `const windowMat = makePS2Material(...)` declaration. ES `const` has a temporal dead zone, so accessing it before the declaration line throws.

Fix: moved the tower block to immediately after `windowMat` is declared (still in the same villa section, just a few lines later in source order). No logic change.

### Files modified
- [js/world.js](js/world.js) — moved cylindrical tower block past `windowMat` declaration
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b016 → b017`
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

### Lesson
I should have run the site locally (or at least mentally traced the declaration order) before pushing b016. node --check passes the file syntactically but doesn't catch temporal-dead-zone runtime errors. Going forward, when I add a new block that references existing materials, I'll grep for the `const` declaration line and verify the new code is below it.

## b016 — 2026-04-07 — Villa architecture rework (asymmetric stack + cylindrical tower + 7 columns + rooftop terrace), pool jacuzzi, hills + houses on hills, Lambo rotation flipped

User feedback after b015: Lambo rotated wrong way, still want a shrub cluster around it, the city background is flat (no grass/elevation/houses on hills), and — the recurring complaint — "the house is just a square right now, want crazy cool miami architecture." Also wanted a cool pool shape. This build hits all of it.

### Pink Lambo rotation flipped
- `Math.PI / 4 → -Math.PI / 4` — hood now points toward (-x, +z), the front-left of the property instead of the front-right.

### Beefier shrub cluster around Lambo
- Was 2 small shrubs at `(-15.5, 2.5)` size 0.85 and `(-14, 1.5)` size 0.55
- Now 6 shrubs at varying sizes (0.55–1.10) clustered tightly: `(-16, 3)`, `(-15, 1.5)`, `(-13, 1.0)`, `(-12, 2.5)`, `(-16.5, 6.5)`, `(-15, 7.5)`
- Lambo now reads as "parked in landscaping" not "lone car next to two pebbles"

### Villa architecture rework — the big one
**Asymmetric stacked upper volumes** (replaces b013/b014's single centered upper volume):
- **First upper volume:** `BoxGeometry(28, 4.5, 12)` (was `22 × 4.5 × 12`), shifted +4 on x (`upperX = villaCx + 4`), hangs `2.8` forward over the deck (was `1.8`). The first upper now cantilevers more dramatically AND extends asymmetrically to the east side.
- **Upper roof slab:** thinner (0.16 vs 0.20), wider overhang (+3 each side x, +2.5 z) — the floating slab look is more pronounced.
- **NEW Second upper volume (third floor box):** `BoxGeometry(14, 3.5, 8)` shifted -6 on x (`upper2X = -6`), pulled back slightly (`upper2Z = -10.5`), sitting on top of the first upper. This creates a stepped pyramid where each level shifts in the opposite direction — the asymmetric stack reads as architecture instead of "stacked boxes."
- **NEW Second upper roof slab:** thinnest yet (0.14), the topmost floating slab.
- **NEW Rooftop terrace wall** — low parapet (`0.9 high`) on top of the first upper volume on the east + front edges (the parts not covered by the second upper). Reads as a usable rooftop terrace at the asymmetric corner.
- **NEW FTG glass on the second upper** — front face of the third floor box gets its own glass.

**NEW Cylindrical corner tower (the rotunda):**
- `CylinderGeometry(3, 3, 8.5, 16)` — round 2-story body
- Position: `(lowerLeftX - towerR + 0.4, *, lowerFrontZ - towerR + 0.6) ≈ (-18.6, *, -3.4)` — embedded into the villa west wall, straddling the front line. On the OPPOSITE corner from the upper cantilever (which extends east) for asymmetry.
- Glass cylinder band wrapping the upper 55% of the body (`CylinderGeometry(... 1, true)` open on top/bottom, the round room view)
- Roof cap disc on top (slightly oversized for an overhang)
- This is the single biggest move toward "not just a square" — a curved element on the corner breaks all the right-angle reading.

**Beefier stone columns:**
- Was 5 columns: `1.4 × lowerH × 0.7` at `x = ±13.5, ±6.75, 0`
- Now 7 columns: `1.6 × (lowerH + 0.5) × 0.85` at `x = ±14, ±9.33, ±4.66, 0`
- Taller (extend 0.5 above lower roof), wider, deeper. More prominent stone reading.

**FTG glass repositioned** — 6 glass panes between the 7 columns instead of 4 between 5. Pane width 3.0 each.

**Front door** — moved from `x=-10.125` to `x=-6.995` (slotted between the columns at -9.33 and -4.66 for a more central entrance).

### Pool — circular jacuzzi attached
- I tried an L-shaped extension first but it collided with a deck lantern + path light. Reverted to: keep the main 22×6 rectangular pool, add a circular jacuzzi at the east end.
- `CylinderGeometry(2.4, 2.4, 0.20, 24)` at `(13.5, 0.10, 5)` — radius 2.4, slightly inside the pool's east rim so they read as connected
- Matching travertine rim cylinder at radius 2.7

### Hills + houses on hills (depth fix for the back)
b014's back side felt flat — road, sidewalk, mansions, skyline all at y=0. b016 adds rising terrain:
- New `hillMat` (dark grassy green `0x2a3a25`) and `addHill(cx, cy, cz, w, h, d)` helper
- 5 hill mounds in two rows behind the cross-street mansions:
  - First row: `(-60, *, -90)` 50×5×18, `(0, *, -98)` 70×8×20, `(60, *, -90)` 50×6×18
  - Second row (deeper, taller): `(-30, *, -115)` 45×11×16, `(30, *, -115)` 45×12×16
- New `addHillVilla(cx, cy, cz, scale)` helper — simplified neighbor villa (just lower volume + roof slab + 1 glow window) with a custom y offset for placing on hills
- 7 elevated villas perched on the hills at varying y heights (5, 6, 8, 11, 12)
- Result: depth perception in the back, "homes on hills" reading like a real coastal city silhouette

### Files modified
- [js/world.js](js/world.js) — pink Lambo rotation, shrubs, addCar already refactored in b015 (no more touch needed), full villa upper volume rewrite, cylindrical tower, taller columns, glass repositioning, door move, pool jacuzzi addition, hills + addHill helper, hill villas + addHillVilla helper
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b015 → b016`
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

### What's NOT in this build
- Cars driving on the road (user said "eventually would be cool but not needed now")
- L-shape pool (collided with too many props, deferred — circular jacuzzi alone delivers the shape change)
- Click → song-card system (still on deck, becomes b017 now)
- Walking/WASD (later)

### Risks I want to flag
- **Cylindrical tower at the west corner** — embedded slightly into the villa west wall (`lowerLeftX - towerR + 0.4`). If it reads as "weird intersection" instead of "round tower attached to corner," I'll move it fully outboard.
- **Asymmetric upper stack** — first upper shifted east, second upper shifted west. This is the biggest stylistic move. If it reads as "messy" instead of "intentionally asymmetric," I dial back the offsets.
- **Rooftop terrace wall** — only 0.9 high, might be invisible from the default camera angle. May need to bump up.
- **Hills** — using flat-top boxes for "hills" is the cheapest possible terrain. They might look like "boxes" instead of "hills." If so, b017 could use a sloped geometry (BufferGeometry with vertex y displacement) for actual rolling hills.
- **Mesh count** — this is the biggest scene yet. If mobile drops frames, I'll cull the deep-distance hill villas and second-row hills.

## b015 — 2026-04-07 — Pink Lambo rotated 45° + small shrub landscaping next to it

User confirmed b014's camera + layout works on both desktop and mobile. Asked for the Pink Lambo to be rotated 45° "diagonal with the pool" with the hood pointing in a specific direction (showed me a top-down screenshot with an arrow), and to have a shrub near it for landscaping. (Architecture rework still queued for b016.)

### addCar refactor
- `addCar(cx, cz, bodyColorHex)` → `addCar(cx, cz, bodyColorHex, rotY = 0)`
- All car part meshes now built at relative coordinates inside a `THREE.Group`, then the group is positioned + rotated. Yellow Lambo call site unchanged (rotY defaults to 0).

### Pink Lambo
- Position stays at `(-14, 5)` (alongside the pool's left edge, between villa left wall x=-16 and pool left edge x=-11)
- Rotation: `Math.PI / 4` (+45° around Y, CCW from above) — hood now points diagonally toward the +x +z direction (toward the pool's front-right and the camera). The user wants the lambo "diagonal to the pool axis," and this is the natural reading.

### Shrubs (NEW)
- New `shrubMat` (`0x2a4a25` — dark green leafy)
- New `addShrub(x, z, size)` helper using `IcosahedronGeometry` (matches the boulder helper's silhouette but green)
- 2 shrubs placed next to the pink Lambo: one at `(-15.5, 2.5)` size 0.85 (between villa wall and lambo, near the back of the lambo), one at `(-14, 1.5)` size 0.55 (smaller front shrub)

### Files modified
- [js/world.js](js/world.js) — addCar Group refactor + rotY param + pink Lambo rotation + shrub helper + 2 shrub placements
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b014 → b015`
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

### Risk
- I'm guessing on the rotation direction (+45° vs -45°) based on a quick read of the user's arrow screenshot. If the hood points the wrong way after deploy, swap to `-Math.PI / 4` next.
- The lambo position stays on the LEFT side of the pool. If the user's arrow screenshot showed it on the RIGHT side, the position needs to flip too — that's a follow-up.

## b014 — 2026-04-07 — Camera overhaul (drag/zoom/pinch) + layout flip (beach side vs street side) + bigger pool

User feedback after b013: camera was stuck on a fixed pivot with no zoom (was hover-based), villa was just a square box, pool was small and squarish, ocean was on BOTH sides (front AND back), red car parked on something weird, cars too far off. Picked Option A (camera + layout fix only, save full architecture rework for b015). Camera = drag/zoom/pinch (no WASD walking yet).

### Camera — proper orbit (the foundational fix)
The b001-through-b013 camera was hover-based: yaw/pitch derived from absolute mouse position with no zoom. Couldn't actually explore the scene. Replaced with proper orbit math:

- **Mouse drag rotates** — `mousedown` starts a drag, `mousemove` (while dragging) accumulates yaw/pitch deltas, `mouseup`/`mouseleave` ends the drag
- **Scroll wheel zooms** — `wheel` adjusts radius (with `preventDefault` so it doesn't scroll the page)
- **Touch drag rotates** — single-finger drag accumulates yaw/pitch
- **Pinch zoom** — two-finger pinch adjusts radius based on the ratio of current finger distance to start distance
- **Spherical orbit math** — `position = center + (sin yaw·cos pitch·r, sin pitch·r, cos yaw·cos pitch·r)`. No more `lerp` smoothing toward a target — direct yaw/pitch from drag input.
- **Cursor hint** — `cursor: grab` by default, `grabbing` while dragging
- **Clamps** — pitch clamped to [-0.10, 1.30] (can't flip upside-down or look straight up at the sky), radius clamped to [8, 80] (can't zoom inside the villa or so far the scene becomes a dot), `camera.position.y >= 1.0` (never below ground)
- New state vars: `isDragging`, `lastDragX/Y`, `touchMode` ('drag'|'pinch'|null), `pinchStartDist`, `pinchStartRadius`, `radius` (was const `CAM_RADIUS`)
- New constants: `MIN_RADIUS`, `MAX_RADIUS`, `MIN_PITCH`, `MAX_PITCH`, `ROTATE_SPEED` (0.005 rad/px), `ZOOM_SPEED` (0.025 r/wheelDelta)
- Initial state: `yaw=0`, `pitch=0.30` (slight downward tilt), `radius=26`
- All 8 new event listeners properly removed in `destroy()`

### Layout flip — ONE side beach, ONE side street (the architecture fix)
b013 had ocean on BOTH sides (back ocean from b009 + front ocean added in b013). User wanted clear visual separation: pool/ocean side vs street/city side, like a real Miami beachfront mansion. Front stays as the beach side; back becomes the street side.

#### Removed
- Back ocean plane (was at z=-75)
- Back beach plane (was at z=-42)
- Front skyline (40 buildings at z=140 — cities are inland, not over the ocean)
- All 12 b013 neighbor villa positions (rebuilt below)
- All b013 boulevard palms scattered across both sides (rebuilt below)
- All back-of-house path lights (no longer needed without back beach)

#### Added
- **Asphalt road** at z=-41 (`PlaneGeometry(160, 8)`, dark grey `0x1c1c20`)
- **Dashed yellow center line** — 26 small emissive boxes evenly spaced along the road
- **Sidewalk strips** on both sides of the road (lighter grey `0x4a4854`) at z=-36 (near sidewalk) and z=-46 (far sidewalk)
- **Driveway** — `PlaneGeometry(9, 9)` warm concrete plane at (garageCx, *, -31.5) connecting the road to the garage door
- **6 streetlamps** along the near sidewalk — pole + arm extending over the road + warm emissive bulb. Bulbs are emissive but NOT wired into the shader light uniforms (those stay reserved for closer pool/interior/lantern lights so the back of the property isn't pumping warm light into the front scene)
- **12 cross-street mansions** in 3 z-bands: 5 at z=-56 to -58, 5 at z=-76 to -80, 2 side flank houses at z=-28 (visible when orbiting around)
- **13 boulevard palms** lining the street — 8 along the near side at z=-34, 4 along the far side at z=-48, plus the existing front-side palms still in place
- **80-building Miami skyline** at z=-100 (was 60 back + 40 front in b013) with every 4th building being a tall high-rise

### Garage rebuilt — detached, behind villa, facing street
b013's garage was attached to the right side of the villa (z range -14 to -6), with door facing +z (camera/pool side). The b014 layout flip needs the garage door facing -z (street side), but the b013 garage z range is INSIDE the villa box so the door would be invisible behind the villa back wall.

Fix: detached the garage from the right wing entirely.
- `garageCx 18.95 → 0` (centered behind villa instead of right of villa)
- `garageCz` now derived as `villaCz - lowerD/2 - garageD/2 = -23` (touching the villa back wall from behind)
- `garageW 6 → 8` (slightly wider to read more like a 2-car garage)
- Garage door now on `-z` face at `garageCz - garageD/2 - 0.06 = -27.06`
- Yellow Lambo position derived from new garage: `addCar(garageCx, garageCz - garageD/2 - 2.8, ...)` = `(0, -29.8, ...)` — parked on the driveway directly in front of the garage door

### Pool — bigger
- `BoxGeometry(14, 0.2, 4) → BoxGeometry(22, 0.2, 6)`. Area went from 56 to 132, ~2.4× bigger.
- Pool position `(0, 0.10, 4) → (0, 0.10, 5)` (pushed slightly forward)
- Rim `BoxGeometry(14.6, 0.22, 4.6) → (22.6, 0.22, 6.6)`
- `poolPos` lighting uniform `(0, 0.4, 4) → (0, 0.4, 5)`, `poolRange 22 → 26` for the bigger reach

### Deck props shifted forward to clear the new pool z range (2-8)
- **Daybeds** — 3 daybeds shifted from `z=7.5` to `z=10.8` (and from `x=-4/0/4` to `x=-6/0/6` to slot between the new lantern positions)
- **Deck lanterns** — 4 lanterns shifted from `z=6.4` to `z=9.5` (and from `x=-6/-2/2/6` to `x=-9/-3/3/9` for the wider deck)
- `lampPos` lighting uniform `(0, 0.6, 6.4) → (0, 0.6, 9.5)` (anchored to the new middle lantern), `lampRange 18 → 22`
- **Front pool path lights** — moved from `(±10.5, 8.8)` to `(±13, 12.5)` (further out, past the daybeds)
- **Side path lights** — simplified from 8 lights to 4 (`(±24, 3)` and `(±24, -8)`)
- **Boulders** — 2 outboard boulders moved from `(±9, 4)` (inside new pool x range) to `(±13, 5)` (outside pool x range). 5 back-of-pool boulders shifted slightly. 4 villa-corner boulders shifted from `(±18.5, 1.5/8)` to `(±19, 1.5/9)`.
- **Pink Lambo** moved from `(-22, 5)` (way outboard, past the path lights) to `(-14, 5)` (parked on the pool deck alongside the pool's left edge, between villa left wall x=-16 and pool left edge x=-11)

### Beach loungers moved to front beach
b013 had the loungers on the back beach which is now gone. Moved to the front beach (camera side):
- 2 lounger sets (umbrella + 2 chairs each) at `(-22, 32)` and `(22, 32)`
- 2 solo chairs further out at `(-12, 40)` and `(12, 40)`

### Front beach + front ocean repositioned + bigger
- Front beach `PlaneGeometry(120, 24)` at `(0, 0.03, 30)` → `PlaneGeometry(140, 28)` at `(0, 0.03, 32)`
- Front ocean `PlaneGeometry(260, 90)` at `(0, -0.02, 90)` → `PlaneGeometry(320, 110)` at `(0, -0.02, 100)`

### Ground plane — extended
- Was `PlaneGeometry(80, 40)` at `(0, 0, -2)` (just covered villa+pool zone)
- Now `PlaneGeometry(180, 80)` at `(0, 0, -10)` to cover both the front patio AND the back area between villa back wall and the new street

### Files modified
- [js/world.js](js/world.js) — camera input rewrite, layout flip, garage rebuild, pool resize, deck prop repositioning, beach lounger move, ground plane extension, skyline cleanup
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b013 → b014`
- [FILE_MAP.md](FILE_MAP.md) — build bump, camera section rewritten for new orbit math, world.js note rewritten for the layout flip
- [CHANGELOG.md](CHANGELOG.md) — this entry

### What's NOT in this build
- **Villa architecture rework** — the villa is still the b013 hollow shell at 32×6×18 with 5 stone columns + cantilever upper. User said "house is just a square, no cool miami architecture" — that's b015. This build is camera + layout only.
- **Pool reshape** — pool is now bigger but still rectangular. The reference photo's curved/circular jacuzzi treatment is also b015.
- **Click → song-card system** — that's b016 now.
- **Walking/WASD** — eventually, but not soon.

### Risks I want to flag
- **Yellow lambo position math** — it's derived from `garageCx` and `garageCz`, which are now both new values. If anything in the chain is off by a unit, the lambo could be on the road or inside the garage. I tested the math but the visual is the real test.
- **The road might feel disconnected** from the villa — there's about 4 units of plain ground between the villa back wall (z=-19) and the garage front (z=-19, touching), then the garage takes up z=-19 to -27, then driveway/sidewalk. If the back of the property feels visually empty between the villa and the road, I'll add hedges or more boulders along the back wall in the next build.
- **Camera at wide zoom may show the property edges** — at radius=80 the camera sees a lot. The ground plane is 180×80 and the front ocean extends to z=210ish, so there should be enough scene coverage, but if you zoom way out and see "the world ends" anywhere, tell me and I'll extend further.
- **Pinch zoom on mobile** — I can't test this from desktop. The math should be right (`pinchStartRadius * pinchStartDist / dist`) but if it feels inverted or jumpy on your phone, paste what's happening.

## b013 — 2026-04-07 — Villa expanded ~2× w/ hollow interior shell, front beach + front ocean, denser Miami back

User feedback after b010 deployed: front of pool just hard-cuts off into void, behind the house feels empty (not the rich Miami neighborhood vibe), and the house itself is too small to populate with interior props (piano + decor + future song-card click targets). User picked option C (both exterior expansion AND interior rebuild in one build), camera stays orbit for now (walking is a future build), each future prop will become a click→song-card trigger.

### Villa — roughly 2× in every dimension
- Lower volume `20 × 4 × 11` → `32 × 6 × 18`
- Upper cantilever `13 × 3.5 × 7` → `22 × 4.5 × 12`, hangs forward `1.0` → `1.8` over the pool deck
- Stone columns `3 → 5` across the wider front face (x = -13.5, -6.75, 0, 6.75, 13.5)
- FTG glass panes `2 → 4`, filling the gaps between columns
- Cove light strip stays under the upper cantilever, scaled to the wider span
- Front door moved to leftmost column gap (x=-10.125)

### Lower volume is now a HOLLOW SHELL (the big architectural change)
b010's lower volume was a single solid `BoxGeometry`. b013 cracks it open so the camera (eventually + a person walking the scene) can see/visit interior space, and so future builds can populate the interior with click-target props.

The new lower volume = 6 separate meshes:
- **Interior floor** — `PlaneGeometry` of warm travertine plaster at y=0.02
- **Back wall** — `BoxGeometry(32, 6, 0.35)` at the rear, solid white plaster
- **Left wall** — `BoxGeometry(0.35, 6, 18)` solid
- **Right wall** — `BoxGeometry(0.35, 6, 18)` solid
- **Interior ceiling** — `PlaneGeometry` warm plaster at y=5.99 facing down
- **Front face** = the 5 stone columns + 4 glass panes (open by design)

The lower roof slab still sits on top as the exterior cap. Walls are 0.35 thick. New `villaInteriorMat` (slightly warmer plaster than exterior) and `floorInteriorMat` (warm travertine).

### NEW: Back door
Glowing rectangle on the rear wall facing the Miami neighborhood. Position: `(0, 1.3, lowerBackZ + wallT + 0.05)`. Same `windowMat` as the other glowing openings.

### Lighting uniform: bigger interior needs more reach
- `windowPos.y` `3.5 → 4.5` (lifted to match the taller interior)
- `windowRange` `22 → 32` (the warm interior glow now has to fill 32m wide × 18m deep room instead of 20×11)

### Front beach + front ocean — fixes b010's hard cutout
The b010 ground plane was `120 × 80` and abruptly ended past the pool deck. b013:
- Ground plane shrunk to `80 × 40` centered at `(0, 0, -2)` — just covers the immediate villa+pool zone
- **NEW front beach** — `PlaneGeometry(120, 24)` at `(0, 0.03, 30)` using `beachMat`
- **NEW front ocean** — `PlaneGeometry(260, 90)` at `(0, -0.02, 90)` using a clone of the existing back-ocean shader. Same fog uniforms = visually consistent with the back ocean.
- Result: looking forward past the pool you see deck → sand → ocean → fog → horizon, no abrupt edge

### Back beach pushed back + bigger
- Back beach center `(0, 0.04, -30)` → `(0, 0.04, -42)` (moved further from the bigger villa)
- Back beach size `50 × 30` → `80 × 36`

### Back-of-house — denser Miami neighborhood
- Neighbor villas `5 → 12`, organized in 3 z-bands (close, mid, deep distance) and pushed outboard of the new bigger villa walls
- Scattered palms `+8` extra palms through the neighborhood zone (z range -38 to +10, x range ±18 to ±30)
- Distant skyline `32 → 100` total buildings: 60 back row at z=-90 + 40 front row at z=140 (city wraps around the bay). Every 4th-to-5th building is a taller "high-rise" box (wider footprint, 2.5–5.0 tall) for proper city silhouette.

### Collision fixes (consequence of the bigger villa)
The new villa walls (x = ±16, z = -19 to -1) swallowed several b010 props. All moved out:
- **Lagoon** `(-14, *, -3)` → `(-22, *, 4)` — pushed left + forward, well clear
- **Pink Lambo** `(-11, *, 9)` → `(-22, *, 5)` — pushed outboard left of the new villa front
- **2 boulders** at `(-11.5, -3)` and `(11.5, -3)` were inside villa interior — moved to villa front corners at `x=±18.5`
- **Pool deck path lights** at `(±8.5, -1.2)` were inside villa interior — removed (front-of-pool lights at `(±10.5, 8.8)` retained)
- **Driveway path lights** `(8/15/16/8, -3/-8)` were inside villa — moved outboard to right side `(20-22, 3 to -15)`
- **Side path lights** `(-12, 5/0/-8)` were inside villa — moved outboard to left side `(-20 to -22, 3 to -15)`
- **Beach approach path lights** `(±12, -16)` were inside villa — moved behind villa to `(±10, -22)`
- **Garage** auto-follows from `villaCx + lowerW/2 + ...` so it now sits at `garageCx ≈ 18.95` (was `12.95`), still flush with villa right wall — yellow Lambo position auto-follows

### Camera — wider orbit for the bigger house
- `CAM_RADIUS` `20 → 26`
- Initial camera position `(-2, 5, 16)` → `(-3, 6, 22)` (pulled back, slightly higher)
- Camera y `7.5 + pitch * 13` → `8.5 + pitch * 14` (slightly higher base, slightly more pitch range)
- Camera lookAt y `3.2 + pitch * 3` → `4.0 + pitch * 3` (target the bigger upper volume)
- Camera **far plane** `250 → 320` so the new front skyline at z=140 is actually visible

### Files modified
- [js/world.js](js/world.js) — every section above (villa rebuild, ground, front beach, front ocean, back beach, neighbor villas, palms, skyline, collision fixes, camera, lighting uniform)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b012 → b013`
- [FILE_MAP.md](FILE_MAP.md) — build bump, villa view design notes rewritten for the bigger architecture
- [CHANGELOG.md](CHANGELOG.md) — this entry

### What's NOT in this build
- **No interior props** — leaving the interior shell empty per the user's instruction. They'll spec the props (piano, records, cigarette box, etc.) before I commit to interior layout.
- **No walking / WASD** — orbit camera stays. b015 candidate.
- **Click → song card system** — the actual interactivity layer. b014, on deck after this lands and the user eyeballs the new layout.
- **Raycaster + click targets on the cars/lanterns/etc.** — no objects are clickable yet. They will be in b014.

### Risks I want to flag
- **Hollow shell readability:** with the front face open, looking at the villa from the camera-default angle should show actual interior depth instead of a flat wall. If the lighting doesn't carry far enough into the interior or the floor doesn't read clearly, I may need to add a subtle interior accent light or brighten `floorInteriorMat`.
- **Cantilever proportions:** the upper hangs 1.8 forward now (was 1.0). At the bigger scale this should look more dramatic, but if it reads as "the upper volume is a separate floating slab" instead of "cantilevered second story," I'll back off the overhang.
- **Front skyline at z=140 may pop into the camera frustum suddenly** when orbiting. If it does, I'll move it further back or add fog density adjustment.
- **Performance:** mesh count went up significantly (12 neighbors × 6 meshes each = 72 + 100 skyline buildings + 8 extra palms × 10 fronds + the hollow villa's 6 wall pieces). PS2+ render is still 854×480 so total fragment shading is still manageable, but this is the most mesh-heavy build yet. If mobile starts coughing, the front skyline + back deep-distance villas are the first to cull.

## b012 — 2026-04-07 — CORS hotfix for R2 audio (b011 was broken — audio output zeros)

After b011 force-pushed, the deploy completed in seconds (the migration worked) but audio playback was completely silent. Console showed:

```
MediaElementAudioSource outputs zeroes due to CORS access restrictions
for https://pub-5556ef4db74d499ba3f535afccf8c7be.r2.dev/rolla.mp3
```

### Why
[js/player.js](js/player.js) wires the `<audio>` element through `audioContext.createMediaElementSource(playerAudio)` to feed the analyser for audio-reactive views (terrain/neural). Once you call `createMediaElementSource()` on an audio element, the browser routes its output exclusively through the Web Audio graph, NOT through the default `<audio>` output. So if the source is opaque (CORS-blocked from cross-origin), the analyser produces zeros, and zeros propagate through `analyser.connect(audioContext.destination)` → total silence.

Two things were needed and BOTH had to be set:

1. **R2 bucket needs CORS headers** allowing the cantmute.me origin
2. **Audio element needs `crossOrigin = "anonymous"`** set BEFORE `src` is assigned

The local-development case worked in b008/b009/b010 because the audio was same-origin (`audio-mp3/`) and CORS didn't apply.

### CORS rules applied to R2 bucket (via dashboard, not committed to repo)
- `AllowedOrigins`: `https://cantmute.me`, `https://www.cantmute.me`, plus a handful of localhost ports for local dev
- `AllowedMethods`: `GET`, `HEAD`
- `AllowedHeaders`: `*` (needed for `Range` requests so audio can seek)
- `ExposeHeaders`: `Content-Length`, `Content-Type`, `Content-Range`, `Accept-Ranges`
- `MaxAgeSeconds`: `3600`

A reference copy of the rules is checked in at [scripts/r2-cors.json](scripts/r2-cors.json) (with a slightly different schema for the wrangler CLI rather than the dashboard format — they're not identical, the dashboard uses S3-compatible PascalCase while wrangler wraps it in `{"rules": [...]}`). If the bucket URL or origins ever need updating, edit that file and either re-paste into the dashboard or run `wrangler r2 bucket cors set cantmute-audio --file scripts/r2-cors.json`.

### Code changes
- [js/player.js:8-13](js/player.js#L8-L13) — `playerAudio.crossOrigin = 'anonymous'` set immediately after the `Audio` constructor, BEFORE any `src` assignment
- [script.js:186-187](script.js#L186-L187) — same `audio.crossOrigin = "anonymous"` for the admin page audio element

### Files modified
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b011 → b012`
- [js/player.js](js/player.js) — `crossOrigin` assignment
- [script.js](script.js) — `crossOrigin` assignment
- [scripts/r2-cors.json](scripts/r2-cors.json) **(NEW)** — reference copy of the CORS policy
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

### Lesson
When the audio source is going through Web Audio API (`createMediaElementSource`), CORS headers + `crossOrigin` attribute are BOTH mandatory. Setting only one is the same as setting neither. This was missed in the b011 plan because the original `audio-mp3/` setup was same-origin, so no Web Audio CORS issue ever surfaced.

## b011 — 2026-04-07 — Audio served from Cloudflare R2, audio-mp3/ removed from git history

After b010 deployed, the next deploy hung in the clone step for 3+ minutes, twice. Diagnosed as: 285 MB git repo, 301 MB of audio files in `audio-mp3/` (133 files), zero packs / 317 loose objects. The audio files were pre-existing baggage but the deploys had finally got slow enough that Cloudflare Pages cloning was timing out. Decision: migrate audio to Cloudflare R2 (free for our size, native to Cloudflare, zero egress cost on the network) and wipe `audio-mp3/` from git history.

### R2 setup (Kani did manually in Cloudflare dashboard)
- Created R2 bucket `cantmute-audio` in WNAM region
- Enabled Public Development URL → `https://pub-5556ef4db74d499ba3f535afccf8c7be.r2.dev`
- Authenticated wrangler CLI to the same Cloudflare account

### JS routing changes (shipped earlier in commit `013cff9`, not actually labelled as b011)
- [config.json](config.json) — added `"audioBase": "https://pub-5556ef4db74d499ba3f535afccf8c7be.r2.dev/"` field
- [js/player.js:35-44](js/player.js#L35-L44) — `loadTrack()` now uses `siteConfig.audioBase + encodeURIComponent(track.file)` instead of the hardcoded `'audio-mp3/'` prefix. Falls back to `'audio-mp3/'` if `siteConfig` hasn't loaded yet (defensive — shouldn't happen in practice since `loadConfig()` runs before any track plays).
- [script.js:251-258](script.js#L251-L258) — admin page's `loadTrack()` hardcoded to the R2 URL since the admin page doesn't load `config.json`. If the bucket URL ever changes, update this line AND `config.json`'s `audioBase` field.
- [scripts/upload-audio-to-r2.sh](scripts/upload-audio-to-r2.sh) **(NEW)** — bash script that loops over `audio-mp3/*` and uploads each file to the R2 bucket via `wrangler r2 object put`. Sets `Content-Type: audio/mpeg`. Idempotent (safe to re-run; uploads overwrite). Requires wrangler installed + `wrangler login` already run.

### Upload + verification (run from this session)
- All 133 files uploaded successfully via the script (`133/133 OK`, zero failures)
- Verified `https://pub-5556ef4db74d499ba3f535afccf8c7be.r2.dev/work%20smart.mp3` returns `HTTP/1.1 200 OK, Content-Type: audio/mpeg, Content-Length: 2626917`
- Production playback now served from R2

### Build number bump (the actual one — `013cff9` claimed b011 in its message but never edited the file)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b010 → b011`

### Repo cleanup
- [.gitignore](.gitignore) — added `audio-mp3/` (no longer tracked) and `.wrangler/` (wrangler local cache, was untracked but should never be committed)
- `git rm --cached -r audio-mp3/` — untracks all 133 files from the index. Files remain on disk for backup.
- `git filter-repo --path audio-mp3/ --invert-paths --force` — rewrites every commit in history to remove `audio-mp3/`. Backup branch `backup-before-r2-migration` created first as a safety net (delete after the force-push proves stable).

### Files modified
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` bump
- [FILE_MAP.md](FILE_MAP.md) — build bump, audio-mp3/ section rewritten, scripts/ section added, player.js note about R2 routing
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [.gitignore](.gitignore) — `audio-mp3/`, `.wrangler/`

### What's NOT in this build
- The visual feedback Kani gave on b010 (front pool needs beach→ocean transition not a hard cutout, back of house needs Miami neighborhood + skyline, house needs to be much bigger so the camera can travel through the interior with room for prop click-targets) — that's b012, queued
- The click→song-card system — was originally going to be b011, now bumped to b013 because we burned b011 on the unplanned R2 migration

### Risk: history rewrite
The repo is public but Kani is the only known cloner. After force-push, anyone with an outstanding clone (theoretically: the user, CI/CD, or any forks) will need to reclone. Backup branch `backup-before-r2-migration` exists locally — if anything goes catastrophically wrong, `git reset --hard backup-before-r2-migration` restores the pre-rewrite state. Delete that branch only after the force-push has proven stable.

## b010 — 2026-04-06 — Villa redesign: 2-story cantilever w/ stone columns, "sun just dipped" sky, long infinity pool, daybeds + lanterns + boulders, PS2+ render

User sent reference photos (Mykonos/Miami modernist villa, dusk + blue hour, white plaster, stacked stone, infinity pool, white cushioned daybeds, palm silhouettes, warm interior spill). User picked the in-between of sunset and blue hour ("sun just dipped"). User picked "crisper PS2 but don't deviate too much" → PS2+ mode. The villa is now the hero (b011 click→card on deck after this lands), so the house gets a full architecture rewrite to match the photos.

### Render upgrade — "PS2+" mode
- [js/world.js:18-19](js/world.js#L18-L19) — `LOW_W 480 → 854`, `LOW_H 270 → 480`
- PS2 vertex jitter grid `vec2(160.0, 90.0) → vec2(320.0, 180.0)` in 3 places: PS2 material vertex shader, ocean vertex shader, skyline-dot vertex shader
- Scanline freq `540 → 960`, intensity `0.035 → 0.022` in the post material — lighter scanlines for the higher-res target

### Sky shader — "sun just dipped" palette
- `topColor 0x2a2060 → 0x0a0a3a` (deep indigo at zenith)
- `midColor 0x8a2585 → 0x9a3070` (lavender/magenta band)
- `bottomColor 0xff4090 → 0xff7050` (warm pink/orange horizon, sun just below)
- **Removed moon disc + halo** — it's still dusk, not full night
- Star threshold raised to `h > 0.4` and `step(0.994, n)` — only sparse stars at the zenith

### Lighting constants — warmer interior, brighter cyan pool
- `lampColor 0xff8c42 → 0xffc080` (warm lantern, not sodium)
- `lampRange 28 → 18` (more localized — it's a deck lantern, not a streetlight)
- `lampPos (6, 5, -1) → (0, 0.6, 6.4)` (sits on the middle deck lantern at the pool front edge)
- `poolColor 0x2af0d0 → 0x40fff0` (brighter cyan)
- `poolRange 14 → 22` (cyan glow reaches further across the deck)
- `windowColor 0xffe6c8 → 0xffd090` (richer warm)
- `windowRange 16 → 22` (more interior spill through the FTG glass)
- PS2 shader ambient `(0.36, 0.30, 0.44) → (0.28, 0.24, 0.40)` (slightly darker so warm/cool point lights pop)
- Fog color `0x55265e → 0x40285a` across all 3 shaders + scene fog (cooler indigo, sharpens contrast against the warm horizon)
- Renderer clear color `0x251040 → 0x1a1238`

### Pool — long infinity-edge geometry + brighter shader
- Pool geometry `BoxGeometry(8, 0.18, 5, 12, 1, 8) → BoxGeometry(14, 0.2, 4, 20, 1, 8)` — long rectangle running parallel to villa front
- Pool shader `uBaseColor 0x0fb5b5 → 0x18d8d0`, `uBrightColor 0x8effe8 → 0xa8fff0`
- Top-face brightness boost `mix(0.8, 3.0, vTopMask) → mix(0.8, 3.6, vTopMask)`
- Pool rim `BoxGeometry(8.6, 0.2, 5.6) → (14.6, 0.22, 4.6)` to match
- Rim color `0x4a4555 → 0xe8e4dc` (white travertine, not dark concrete)
- Ground color `0x5a5560 → 0xc0bcb0` (white travertine patio matches the new villa)

### Villa — full architecture rewrite (the big one)
**Ripped:** old lower/upper/penthouse volumes, all roof slabs, balcony floor, balcony rail + 9 posts, all glass strips, old door (~100 lines).

**Replaced with:**
- New `villaMat` color `0xa8a4b2 → 0xeeeae0` (white plaster)
- New `roofMat` color `0x5a5666 → 0xe0dcd0` (light slab, slightly darker than walls)
- New `stoneMat` `0x8a847a` (stacked natural stone for column accents)
- New `coveMat` (warm emissive cove light strip)
- **Lower volume:** `BoxGeometry(20, 4, 11)` (was 17×4×10) — wider, more imposing
- **Upper volume:** `BoxGeometry(13, 3.5, 7)`, set back 0.5 on rear and **hanging 1.0 forward over the pool deck** (the signature cantilever)
- **Lower roof slab:** thin (0.22 high), oversize +0.6 each side
- **Upper roof slab:** very thin (0.20 high), oversize +1.5 each side — the floating slab look
- **Recessed cove light:** warm emissive strip on the underside of the upper cantilever, glows down onto the deck
- **NEW: 3 stacked stone columns** on the front face of the lower volume at x=-7.5/0/+7.5 — break up the long white wall, match the photo signature
- **2 floor-to-ceiling glass panes** filling the gaps between the stone columns
- **Upper FTG glass** on the front face of the upper volume
- **Side glass strip** on the camera-facing edge of the upper volume
- **Recessed front door** at x=-5
- **Penthouse REMOVED** (b011-targeted in the previous build, now actually rebuilt — the b010 villa is the hero house)
- **Balcony + railing REMOVED** — the cantilever upper volume IS the balcony in the new design
- New `windowMat` color `0xffe6c8 → 0xffd090`, emissive `0xffd6a0 → 0xffc880`, emissiveAmt `1.8 → 2.0` — richer warm interior glow

### Pool deck daybeds (NEW)
- New `daybedWoodMat` (warm wood `0x6b4a30`), `daybedCushionMat` (cream `0xf0ece0`), `daybedPillowMat` (`0xe8e2d0`)
- New `addDaybed(x, z, rotY)` helper — Group of: wood base box + white cushion box + small pillow at one end
- 3 daybeds along the front edge of the pool deck at z=7.5, x=-4/0/+4 (slotted between the deck lanterns)

### Deck lanterns (NEW, replaces the streetlamp)
- **Ripped** the sodium streetlamp pole + bulb + shade (~20 lines)
- New `lanternBaseMat` (dark `0x2a241c`) and `lanternGlowMat` (warm emissive `0xffd090`)
- New `addDeckLantern(x, z)` helper — tiny base box + glowing body box + dark cap
- 4 lanterns along the front edge of the pool deck at z=6.4, x=-6/-2/+2/+6
- The `lampPos` shader uniform is now anchored to the middle lantern position so the warm wash visually emanates from a real source

### Landscaping — boulders replace hedges + bushes
- **Ripped** all 3 hedge meshes + the `addBush()` helper + 8 bush placements + the `hedgeMat` (~40 lines)
- New `boulderMat` (`0x6a6560`) and `addBoulder(x, z, size)` helper using `IcosahedronGeometry(size, 0)` — low-poly rounded rocks, fits PS2+ aesthetic perfectly
- 5 boulders along the back of the pool (between pool back z=2 and villa front)
- 2 outboard boulders past the pool ends
- 3 boulders scattered around the villa front corners

### Layout collision fixes (consequence of the wider pool)
- **Pink Lambo** moved from `(-7, *, 5)` (now inside the new pool) to `(-11, *, 9)` — outboard and forward
- **Lagoon** moved from `(-8, *, 0)` to `(-14, *, -3)` — clears the new wider pool's left rim
- **Pool deck path lights** repositioned — front-row from `(±5, 7.5)` to `(±8.5, 8.8)` (outboard of the new daybeds), back-row from `(±5, 0.5)` to `(±8.5, -1.2)` (behind the new boulder line)

### Default camera position
- `CAM_CENTER_Z -3 → -2` (orbit centerpoint just in front of villa)
- `CAM_RADIUS 24 → 20` (closer in, tighter framing on the cantilever)
- Initial camera `(3, 4.5, 14) → (-2, 5, 16)` — looks across the long pool toward the villa with the cantilever in 3/4 view, sky as backdrop
- Camera y `8.0 + pitch * 13 → 7.5 + pitch * 13` (slightly lower base — sees more of the cantilever silhouette)
- Camera lookAt y `2.8 + pitch * 3 → 3.2 + pitch * 3` (target the upper volume not the lower)

### Files modified
- [js/world.js](js/world.js) — every section above (sky, lighting, pool, villa, boulders, daybeds, lanterns, lagoon move, lambo move, path light moves, camera)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b009 → b010`
- [FILE_MAP.md](FILE_MAP.md) — build bump + villa view design notes rewritten for new render res, new architecture, new lighting palette
- [CHANGELOG.md](CHANGELOG.md) — this entry

### What's NOT in this build
- Click → song card system — b011, on deck after you eyeball this build
- Audio reactivity in the villa view — still none
- Beach chairs out back, neighbor villas, garage, both Lambos, lagoon, path lights — all still there, just repositioned where the new pool needed the space
- Stone columns are flat-color boxes, not actually textured stone — the PS2+ render sells "rough material" via the chunky pixels. If they read as "grey boxes" instead of "stacked stone" we can add a noise variation in the shader in a follow-up

## b009 — 2026-04-06 — Villa = default view, dusk lighting, layout restructured (beach behind house), beach chairs

User feedback after b008: scene felt like deep night, wanted dusk; default view should be Villa not Neural; the camera angle felt like "street view" — wanted the beach to be BEHIND the house in the camera's view, not on the side. Also wanted beach chairs + umbrellas. This is the layout option **B** from the previous turn — full property restructure along the Z axis.

### Default view = Villa
- [js/app.js:304](js/app.js#L304) — `switchView('neural')` → `switchView('villa')`
- [index.html](index.html) — moved `.active` class from the Neural tab to the Villa tab in both desktop and mobile tab bars

### Dusk lighting (less deep night, more magic hour)
- Sky `topColor` `#1a1e4a` → `#2a2060` (warmer purple)
- Sky `midColor` `#6a1f95` → `#8a2585` (more pink)
- Sky `bottomColor` `#c8358f` → `#ff4090` (vibrant pink horizon)
- Shader ambient `(0.22, 0.20, 0.36)` → `(0.36, 0.30, 0.44)` — much brighter floor
- Scene fog `(0x3a1a55, 0.014)` → `(0x55265e, 0.009)` — lighter color, less aggressive density
- Pool / ocean / PS2 shader fog uniforms updated to match
- Renderer clear color `#140828` → `#251040`

### Property layout restructure (the big one)
Old layout had pool at `(0,0,0)`, villa at `(12,0,0)`, beach at `(-38,0,0)` — house was to the right of the pool, beach to the left, all spread along the X axis. From the default camera angle this felt like "looking down the street" — beach off to one side, house off to the other.

New layout puts everything along the Z axis so depth tells the story:
- **Pool** moved from `(0,0,0)` to `(0,0,4)` — closer to camera, foreground
- **Villa center** `villaCx 12 → 0`, `villaCz 0 → -10` — house now directly behind the pool, mid-ground
- **Garage** auto-follows via `garageCx = villaCx + lowerW/2 + ...` (now at `~11.45`, `z=-10`); garage door + roof now use `villaCz` instead of hardcoded `0`
- **Yellow Lambo** position now derived from `garageCx` + `villaCz + garageD/2 + 2.5`
- **Pink Lambo** moved to `(-7, 0.55, 5)` — left of the new pool position
- **Lagoon** moved from `(-7, ?, -2)` to `(-8, ?, 0)` — between pool and house, on the left side
- **Beach** moved from `(-38.5, 0.04, 0)` (left of property) to `(0, 0.04, -30)` (BEHIND the house). Dimensions `43×60` → `50×30`. Background of the camera's default view.
- **Side ocean removed** — was on the left, no longer needed
- **Back ocean** pushed deeper: `(0,-0.02,-50)` → `(0,-0.02,-75)`, width `220` → `260`
- **Lighting positions updated** — `lampPos` `(7.5, 5, 4)` → `(6, 5, -1)` (between pool and house); `windowPos` `(11.5, 3.5, 0)` → `(0, 3.5, -10)` (inside the new house position); `poolPos` `(0, 0.4, 0)` → `(0, 0.4, 4)` (matches new pool); `windowRange` `14` → `16`
- **Bushes** all repositioned for the new layout — 4 around the front patio (in front of the new pool, at z=10-11), 4 around the new garage area (right side, z=-2 to -8)
- **Path lights** all repositioned — 4 around the pool deck shifted to z=4 ± 3.5; 4 along the driveway between pool and garage; 3 along the left side of the house; 2 new "beach approach" lights at `(±12, -16)` lighting the path from the patio to the beach
- **Neighbor villas** moved from all-on-the-right to flanking the property — 2 on the left at z=-8 / 5, 2 on the right at the same z, 1 further back-left at z=-25

### Beach chairs + umbrellas (NEW)
- New `addBeachChair(x, z, rotY)` helper — Group of: seat (boxgeometry tilted-back) + 4 dark wooden legs
- New `addBeachUmbrella(x, z, colorHex)` helper — pole (cylinder) + crossed canopy boxes (octagonal-ish), slightly emissive so the canopy reads against the dusk sky
- 2 lounger sets (umbrella + 2 chairs each) at `(-7, -25)` and `(7, -25)` with pink and orange umbrellas
- 2 solo chairs further back on the sand at `(±2, -34)`

### Camera recentered for the new layout
- `CAM_CENTER_X` `4` → `0` (looks straight down the property axis now)
- `CAM_CENTER_Z` `0` → `-3` (orbits around the gap between pool and house)
- `CAM_RADIUS` `22` → `24` (slightly more breathing room)
- `camera.position.y` `7 + pitch*12` → `8 + pitch*13` (slightly higher base)

### Files modified
- [js/world.js](js/world.js) — fog/sky/ambient/clear color, lampPos/windowPos/poolPos, pool & rim positions, villaCx/villaCz, garage z hardcodes → villaCz, car positions, lagoon position, bushes, path lights, beach + back ocean, neighbor villas, NEW beach chair + umbrella helpers and placements, camera constants
- [js/app.js](js/app.js) — boot calls `switchView('villa')` instead of neural
- [index.html](index.html) — `active` class moved from Neural tab to Villa tab (desktop + mobile)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b008` → `b009`
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

### What's NOT in this build
- Penthouse is **still in** — kept it because the villa is going to be fully redesigned in `b011` from your reference photos anyway. If you want it gone now, say so and I'll add a 2-line removal in `b010`.
- The interactive click → song card system (raycaster, hover glow, `makeInteractive()`) — that's `b010`, on deck after this lands and you've eyeballed the new layout.

---

## b008 — 2026-04-06 — Bigger millionaire mansion, beach + side ocean, neighbor villas

User feedback after b007: villa felt like a "regular suburb home", wanted "Miami millionaire home from the movies"; lots of unrendered background void around the property; wanted a beach on one side and other distant homes for context.

### Villa scaled up to mansion size
- Lower main volume `13×3.2×7` → `17×4×10` (much wider, taller, deeper)
- Upper volume `8×2.8×5` → `11×3.5×6.5`
- **NEW penthouse** — third story `6×2.6×4.5` set further back with its own roof slab + glass strip
- Glass walls all scaled up to match (lower glass `2.4×8` → `3×8.4`, side glass `1.6×lowerW-2.5` → `2×lowerW-3`, upper glass `1.8×4` → `2.4×5.3`)
- Balcony deeper (`1.8` → `2.0` deep), 9 railing posts (was 8)
- Door taller (`1.8×1.0` → `2.2×1.3`)
- Total villa height: ~7 → ~11 units. Much more imposing.

### Garage scaled to match
- `5×2.8×6.5` → `6×3.5×8`
- Garage door scaled to match
- `garageCx` recomputed automatically from `villaCx + lowerW/2 + garageW/2`

### Beach + side ocean (left side of property)
- **Beach** — `43×60` sand plane (`#c0a878`) at `(-38.5, 0.04, 0)` stretching from the property's left edge toward the side ocean
- **Side ocean** — `60×90` plane at `(-90, -0.05, 0)`, reuses the existing `oceanMat` (same shader, same fog), connects with the back ocean visually
- Beach ground spot y bumped from `0.025` → `0.06` so path-light puddles sit above the sand surface

### 5 neighbor villas
- New `addNeighborVilla(cx, cz, scale)` helper — simple 2-volume villa (lower + upper + roof slabs) with glowing windows on the camera-facing +Z face
- Placed on the right side at varying scales: `(40,8,1.0)` `(48,-2,1.1)` `(46,-14,0.9)` `(58,5,1.2)` `(55,-18,1.0)`
- Heavy fog naturally fades them into the distance

### Ground expanded
- `60×60` (40×40 segments) → `120×80` (60×40 segments) — covers the bigger property + beach + neighbor area

### Camera pulled back
- `CAM_RADIUS` `16` → `22` — wider view to take in the bigger scene
- `CAM_CENTER_X` `3` → `4`
- `camera.position.y` `5 + pitch*9` → `7 + pitch*12` — higher base + bigger vertical range
- `lookAt y` `1.8 + pitch*2.5` → `2.8 + pitch*3` — looks higher into the scene

### Repositioned existing things to clear the new villa
- Bushes that were inside the old garage area moved further right: `(15,-6) (17,-6.5) (14,6.8) (26,3)` → `(30,-6) (32,-7) (33,7) (36,3)`
- Driveway path lights moved past the bigger garage: `(15,5.5) (19,7.5) (25,6) (27,0)` → `(28,5.5) (30,7.5) (34,6) (35,0)`
- Property entry path lights nudged: `-11` → `-12` (just outside the new beach edge)
- **NEW** beach approach path lights at `(-15,8)` and `(-25,0)` (cyan / purple)
- Pink Lambo `(4,5)` → `(-7,4)` — moved off the path of the bigger villa, parked front-left near the lagoon
- Yellow Lambo `(20.95,6)` → `(garageCx≈26.45, 7)` — follows the new garage position via `garageCx`

### Files modified
- [js/world.js](js/world.js) — villa, garage, ground, camera, bushes, path lights, addPathLight ground spot y, beach+side ocean section, neighbor villas section + helper, car positions
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b007` → `b008`
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

---

## b007 — 2026-04-06 — Pink Lambo by the pool, mini lagoon w/ island palm, illuminated path-light puddles

User feedback after b006: garage Lambo was too far right to be visible from default camera, wanted a car visibly *around the pool*; wanted a small lagoon with sand island + mini palm; wanted the path lights to actually light the ground around them instead of being decorative-only.

### New geometry
- **Pink Lambo** (`#ff2d95`) parked next to the main pool at `(4, 0.55, 5)` — visible from default camera angle, contrasts the yellow Lambo by the garage. Same `addCar()` helper.
- **Lagoon** at `(-7, 0, -2)` — sand ring (`#c0a878`, 3.8×3.8), water (2.6×2.6, reuses pool water shader for tile + caustic look), small island (0.85×0.85), and a mini palm (height 2.6, smaller trunk + 7 fronds) on the island.

### Path lights now actually illuminate the ground
- New `makeGroundSpotMat(colorHex)` helper — transparent `ShaderMaterial` with a radial gradient (smoothstep falloff) creating a circular puddle of color
- `addPathLight()` updated — every path light now also drops a 2.8×2.8 ground-spot disc at `y=0.025`, `renderOrder=1`, `depthWrite: false`. Gives each colored bulb a visible glowing puddle on the patio. **Note:** this is *visual* only — the spots are emissive geometry, not real lights, so they don't contribute to the shader's lighting calculation. But it looks the same to the eye.

### What's NOT in
- The pink Lambo doesn't move/rotate — just parked
- The lagoon water uses the same shader as the main pool, so they animate in sync
- Ground spots use `transparent` blending which can cause minor sort issues at glancing angles, but they're flat against the ground so it's invisible in practice

### Files modified
- [js/world.js](js/world.js) — second car call, new lagoon section, `makeGroundSpotMat()` helper + ground spot in `addPathLight()`
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b006` → `b007`
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

---

## b006 — 2026-04-06 — Villa flesh-out: garage, Lambo, greenery, colored path lights, streetlamp mesh

User requested additions after b005 (villa was looking sleek by then, not bug fixes — pure feature add). Single-file change, all additive in [js/world.js](js/world.js) — nothing existing was modified.

### New geometry
- **Streetlamp mesh** at the existing `lampPos` — pole (cylinder) + emissive bulb + shade box. The warm sodium light finally has a visible source instead of being magic light from nowhere.
- **Garage** — one-story wing attached to the +X side of the villa lower volume, matching concrete walls + roof slab + glowing garage door on the +Z face (camera-facing). Dimensions 5×2.8×6.5.
- **Yellow Lambo** (`addCar()` helper) parked on the driveway in front of the garage door — main body + hood wedge + dark cabin + 4 squat wheels + 2 emissive white headlights + 2 emissive red taillights. Body color `#f5d518`.
- **Hedges** — long back hedge (28 wide), side hedge (14 deep), front hedge between pool and camera (10 wide). Dark green `#1a3a25`.
- **8 scattered bushes** (`addBush()` helper) around the property at varied sizes
- **11 colored path lights** (`addPathLight()` helper) — small emissive bulbs on thin black poles in cyan / magenta / purple / warm-white. Placed around the pool deck (4), along the driveway / garage path (3), along the property entry side (3), and behind the garage (1).

### What's NOT in this build
- Path lights are emissive geometry only — they don't actually cast light onto other surfaces (would need additional shader uniforms). They're visible bulbs but the patio doesn't glow under them.
- No animation on the Lambo (no spinning wheels, no bobbing)
- No driveway texture / different concrete material (the car just sits on the patio)

### Files modified
- [js/world.js](js/world.js) — large additive section between palms and ocean (~170 new lines)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b005` → `b006`
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

---

## b005 — 2026-04-06 — Villa fixes: orbit camera, sleek beach house redesign, water settles, less yellow

User feedback after b004: camera was stuck (couldn't orbit far), villa felt like a "concrete brick embassy" not a millionaire's beach house, patio was bright yellow, pool was buggy when moving, palms still meh.

### Camera
- Yaw range `-mouseX * 0.7` → `-mouseX * Math.PI` — full ±180° orbit (you can put the building on either side now)
- Pitch range `-mouseY * 0.25` → `-mouseY * 0.6` — ~±34° vertical
- Camera y influence `4 +pitch*4` → `5 + pitch*9` (bigger vertical movement so you can look up at the moon)
- `lookAt` y now follows pitch (`1.8 + pitch*2.5`) so you actually point upward when mouse goes up

### Villa redesign — sleek modern beach house, not a brick embassy
- Two stacked cubes → wide low main volume + smaller offset upper volume + **two cantilever roof slabs** with overhangs
- Punched windows → **big single-plane glass walls** (one on the front -X face, one on the +Z face facing the camera default, one on the upper -X face)
- New **balcony** floor + top rail + 8 vertical posts on the upper volume facing forward
- New `roofMat`, `balconyMat`, `railMat` (darker grey concrete + dark railings) for material variety
- Lower volume: 7×4×8 → **13×3.2×7** (much wider, lower)
- Upper volume: 5×3.2×5.5 → **8×2.8×5** (wider footprint)
- Villa material slightly brighter: `#9a96a4` → `#a8a4b2`
- Door is now a slim emissive plate at ground level

### Window light tuning
- `windowColor` `#ffc97a` (warm orange) → `#ffe6c8` (paler cream) — patio no longer goes neon yellow
- `windowRange` `22` → `14` — spill is contained near the villa instead of bathing the whole patio
- Glass material `color` `#ffd089` → `#ffe6c8`, `emissiveAmt` `1.5` → `1.8`

### Pool — water now reads stable during camera movement
- Ripple amplitude `0.035 / 0.025` → `0.012 / 0.008` (was huge from b003, never reduced)
- Ripple time multipliers `1.4 / 1.1` → `0.9 / 0.7` (slower, more lazy)

### Palms
- Fronds count `7` → `9`
- Frond tilt `-0.55 rad` → `-0.7 rad` (droopier, more palm-like)
- Slightly longer fronds (`2.8` → `3.0`)

### Files modified
- [js/world.js](js/world.js) — camera, villa, window light, pool ripples, palms
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b004` → `b005`
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry

---

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
