# TRACKS CHANGELOG

Per-scene history for `/tracks` starting at the post-split point. Build history before the split (b001–b242, including the b206 Tracks DAW landing + b222/b223 instrumentation + b218 instrumented-init etc.) lives in the frozen root [CHANGELOG.md](../../CHANGELOG.md). New tracks builds are logged here.

---

## t28 — 2026-05-12 — Player-in-control: manual traversal, falling, no auto-play, fix floating connections

> "as soon as you get to a different roof it immediately starts playing another song … crossing the different bridges and shit it's not smooth. I'm not in control as a player like I want to be in control the whole time. I want some like silly ragdoll physics … pretty high super jump … wooden pole was like correctly placed instead of just floating in the air … ability to fall off building and when u hit ground it teleports u back to closest roof"

Six changes in one pass.

**1. No auto-play on jump.** `_tryJump` now always calls `_jumpTo(best, /*play=*/false)`. Songs play only when clicking a banner. The space-leap, edge-walk traversal, and prev/next-song-with-hop all move the runner without touching the audio.

**2. Manual traversal on connections** (the big one). Removed the old cinematic `_traverseConnection` / `_animateTraverse` and replaced with a state-machine + manual control:
- `character.mode` enum: `'roof' | 'jump' | 'traverse' | 'fall'`. `_updateCharacter` dispatches each frame: `_animateJump` / `_updateTraverse` / `_updateFall` / `_updateWalk`.
- `_updateWalk` now does **edge detection**: if WASD would push the character off the rooftop, check for a connection endpoint within 3.2u of the exit position. If found → enter `traverse` mode at that endpoint. If not → enter `fall` mode (with a small outward kick and a random ragdoll spin).
- `_updateTraverse` is fully player-driven: projects camera-relative WASD input onto the connection's bearing → that scalar drives `traverseT` along the path at 4.2u/s (pipe/plank) or 3.0u/s (cable). Position lerps `traverseFrom → traverseTo`, with sag on cables (sin × min(1.6, len × 0.06)) and a small mid-span bounce on planks. Walk-cycle limbs animate with input magnitude. When `traverseT` crosses 0 or 1, `_stepOffOnto(roof)` snaps the runner inside the destination rooftop's walkable and clears traversal state.

**3. Falling + respawn.** New `_updateFall`:
- Gravity 38u/s² on `c.fallVel.y`. Position integrates each frame.
- Ragdoll spin on the group from a random `fallSpin = { rx, ry, rz }` set at fall-start.
- Limbs flail with sin curves at 12 rad/s for the silly-ragdoll feel the user asked for.
- When `c.pos.y < 1.0`, `_respawn()`: find the nearest rooftop by planar XZ distance, teleport the runner there, reset mode to `'roof'`, zero out velocity and limb rotations.

**4. Higher arc / super-jump.** `_jumpTo` apex bumped:
- Old: duration `clamp(0.65 + d × 0.012, 0.85, 2.0)`, apex `min(16, 3 + d × 0.20)`.
- New: duration `clamp(0.85 + d × 0.014, 1.0, 2.6)`, apex `min(28, 6 + d × 0.32)`.
- Plus the in-place hop (space with no rooftop in range) jumps higher: apex `+3.2` instead of `+2.2`. Reads as the "moon physics super jump" the user wanted.

**5. Connections actually land on the rooftops.** `_addConnection` endpoint math fixed:
- Old: `Math.min(walkable.w, walkable.d) × 0.42` along the bearing (always 21% of the smaller half-extent, so endpoints floated inside the roof on rectangular footprints).
- New: ray-vs-rectangle intersection. For bearing direction `(sin(ang), cos(ang))`, scale to hit the rectangle edge: `s = min(halfW/|sin|, halfD/|cos|) - 0.12u` margin so it tucks just inside the parapet. Endpoints now sit AT the rooftop edge, not floating in space.

**6. More bloom + better AA.**
- `UnrealBloomPass(strength=0.62, radius=0.78, threshold=0.72)`. Was `(0.22, 0.55, 0.86)` in t27. Banners + sun glow + LEDs bloom harder, concrete still doesn't (threshold 0.72 is still above Lambert-clamped white).
- `renderer.setPixelRatio(min(devicePixelRatio, 2.0))`. Was 1.6 cap. On retina you get full-res rendering = much cleaner edges.

**HUD help text** updated to teach the new flow: "WASD walk · off edges = fall · STEP ONTO PIPES/PLANKS/CABLES cross by walking · SPACE leap (no song change) · CLICK BANNER plays".

**Files**: `js/tracks-jump.js` — `_addConnection` endpoint math; bloom + pixel-ratio bumps in `init`; `character.mode` state + new fields; `_jumpTo` apex bump; `_updateCharacter` dispatch; `_updateWalk` edge detection; new `_findConnectionFromHere`, `_updateTraverse`, `_stepOffOnto`, `_updateFall`, `_respawn`. Removed dead `_traverseConnection` and `_animateTraverse`. Updated `_applyCamera`, `onTrackChange`, `_tryJump` to use `mode` instead of `jumping`. HUD help text updated. Now ~2671 lines.

`js/builds/tracks.js` t27 → t28.
`docs/tracks/FILE_MAP.md` build bump.

Localhost only. No deploy. Reload `/tracks` — walk off a roof to fall, walk INTO a pipe to cross it, click a banner to play.

---

## t27 — 2026-05-12 — Fix inverted A/D, connection traversal, stylized garden, parapets

> "Controls are all fucked up when I press D I go to the left when I press a I go to the right. … jumping too is super freaky because I just jump from rooftop to rooftop. There's no like using the ropes the ladders nothing like that also. Everything is super shit low poly … bushes are literal fucking balls."

**1. Control bug fixed.** The `right` basis vector was `cross(up, fwd)` (negated), so A and D were swapped. Now `cross(fwd, up)` per standard view-basis convention. W = away from camera, S = toward camera, A = left, D = right.

**2. Connections are now traversable.**
- New `this.connections = []` array. `_addConnection` now pushes a record `{ a, b, type, endA, endB, length }` with the world endpoints for the standable surface above the pipe/plank/cable.
- New `_findConnection(a, b)` looks up the link between two rooftops.
- `_tryJump` now checks for a connection between current rooftop and target. If one exists, route to `_traverseConnection` instead of `_jumpTo`. The parabolic leap is reserved for un-connected rooftops.
- New `_animateTraverse(dt)` runs a 4-segment path: `pos → near edge → mid → far edge → roof center` with weights `[0.18, 0.36, 0.36, 0.10]`. Y interpolates linearly along each segment, with a small sine bob on cross segments (cable swings, plank bounces). Walk-cycle limbs at fast cadence (9 rad/s for pipe/plank, 6 rad/s for cable — cable also gets a tucked-legs, big-arm-pump hand-over-hand pose). Duration scales with full path length: `0.4 + totalLen × 0.10` clamped to `[1.0, 3.4]s`.
- `_animateJump` now dispatches to `_animateTraverse` when `c.connectionPath` is set; the phased leap animation is unchanged for direct jumps.

**3. Garden no longer "literal fucking balls".**
- `_propGarden` rewritten. Three plant kinds picked per slot:
  - **Stacked conifer** — 3 cones of decreasing radius (5-sided, low-poly), each rotated randomly. Thin dark trunk underneath.
  - **Pruned topiary** — `IcosahedronGeometry(r, 0)` (faceted, not smooth), slightly scaled vertical, with a visible trunk. Reads as deliberate low-poly form, not a smooth sphere.
  - **Tall grass clump** — 4-6 thin 4-sided cones leaning outward from a center point.
- Planter box now also has an inner soil strip (darker, slightly recessed) for depth.

**4. Rooftop parapets** — `_addRooftopProps` now draws a 4-sided concrete frame around the walkable edge (height 0.36u, thickness 0.20u). Skipped for cylinders (round walkable would clip) and slim slabs (too narrow). Gives each rooftop a defined silhouette + an actual edge the runner can stop against, instead of raw cube tops.

**5. Connection mesh upgrades** (separate from traversal):
- **Pipes**: main pipe radius 0.34 → 0.30, inner-darker stripe (open-ended cylinder at 18% Y-scale) for depth. End **flanges** (wider rings, radius 0.46, height 0.22). Two **brackets** at 1/3 and 2/3 along the length. Was: just a tube with collars.
- **Plank bridges**: now **4 narrow planks side-by-side** with gaps (0.85 × inter-plank pitch), giving real deck geometry. **Top side rails** (boxes, 0.08 sq) along both edges. **3 vertical posts per side** at t=0.05/0.5/0.95 — actual railing structure. Was: one slab + two thin rail cylinders.
- **Cables**: now a **3-segment sag** between droop waypoints (sine droop, max sag 1.6u or 6% of slant). Each segment quaternion-rotated to point-to-point. Anchor pylons at each rooftop. Was: single straight rod.

**Files**: `js/tracks-jump.js` — `right = cross(fwd, up)` fix in `_updateWalk`; `this.connections = []` added in `init`; `_addConnection` rewritten with multi-segment cable + flanged pipe + multi-plank bridge + endpoint record; new `_findConnection`, `_traverseConnection`, `_animateTraverse`; `_tryJump` routes to traversal first; `_jumpTo` resets `connectionPath`; `_animateJump` dispatches to `_animateTraverse`; `_propGarden` rewritten with 3 plant archetypes; `_addRooftopProps` adds parapet frames. Now ~2552 lines.

`js/builds/tracks.js` t26 → t27.
`docs/tracks/FILE_MAP.md` build bump.

Localhost only. No deploy.

---

## t26 — 2026-05-12 — Player control, jointed runner, varied buildings + rooftop connections

> "Love a little bit of control for a character. This is how we're gonna do it. And then different rooftops have different things, you know, different buildings have different rooftops and different sizes. Not everything being a fucking rectangle. And then making sure there's a way for each building to connect whether it's a pipe a ladder. Palettes jumping also some smoother animation, right? We have this weird like jump fly to right now. And our character looks like a shit-pill kind and our cities. Just fucking cubes."

The platformer concept landed; pretty much every other surface needed work. This pass touches all six things at once.

**1. Player control — WASD / ↑↓←→ walks the runner.**
- New `walk` state on the module: `{ keys: { fwd, back, left, right }, lastDir }`.
- New `_onKeyUp` handler (added to `window` + cleaned up in `destroy`).
- `_onKeyDown` remapped: WASD/arrows now walk, Q/E and `[`/`]` cover prev/next song, `P` toggles play (freeing space for jump), space triggers a directional leap.
- `_updateWalk` runs every frame when the character isn't jumping. Camera-relative input: `cameraForwardXZ` and a cross-product `right` vector. Move speed 5.2u/s. Position clamped to `onRoof.walkable` with a 0.4u inset so feet don't clip the edge.
- `_tryJump` (space): if WASD direction is active, finds the best rooftop ahead — score = `planar + (1 - forward) * planar * 1.6`, requiring `forward > 0.45` (must be ahead of the runner). If found, jump there. If nothing's in range, in-place hop animation (no position change).

**2. Phased jump animation** (the user's "weird jump fly-to"):
- Old jump: monotonic `sin(πt)` arc baseline, all limbs the same.
- New `_animateJump` runs 5 distinct phases with keyframed limb poses:
  - `WIND` (0.00-0.10): crouch — `lean=0.20`, hips bent 0.55 rad, knees bent 1.1 rad, arms back. Group squashes 0.80 Y.
  - `LIFT` (0.10-0.22): explode — arms forward+up to 1.4 rad, knees straighten, lean ramps to 0.42, group stretches to 1.10 Y.
  - `FLY` (0.22-0.78): tuck — knees lifted, gentle alternating cycle for a parkour-ish swim.
  - `PREP` (0.78-0.92): legs swing forward to plant, arms swing back, lean unwinds to 0.10.
  - `LAND` (0.92-1.00): hard impact — Y squash to 0.70 then ease back to 1.0 over 0.04s. Arms and legs return to neutral.
- All phases use per-joint shoulder + elbow + hip + knee rotations on the new pivot groups (see #4).

**3. Building variety — 5 archetypes** (replacing pure cubes):
- `ARCHES = [cube ×3, setback ×2, podiumtower ×2, slimslab, cylinder]` distribution.
- `_archCube` — current 14-23u cube, walkable = footprint inset 1.6u.
- `_archSetback` — 16-24u wide lower tier (55-65% height) + smaller upper tier (60-75% width). Walkable = upper tier.
- `_archPodiumTower` — 18-26u wide low podium (6-12u tall) + 10-15u narrow tower above. Walkable = tower top.
- `_archSlimSlab` — narrow 8-12u × 12-17u footprint, ×1.15 height. Walkable = footprint inset 0.8u.
- `_archCylinder` — 8-11u radius cylinder with optional wrap-around glass band. Walkable = inscribed square `r × √2 × 0.78`.
- All buildings now expose `walkable: { cx, cz, w, d, h }` — the actual surface the character can stand on. `_buildBanners` uses `walkable.score = walkable.h - centerDist × 0.12` instead of building.h, so the banner sits on the actual rooftop.

**4. Better runner model** (the "shit-pill"):
- Two-segment limbs with real elbow + knee pivot groups.
- Box torso in two stacked sections (red shirt lower, darker-red jacket upper) for shoulder definition. Hips a separate box. Neck cylinder. Box head with a half-sphere hood. Box shoes.
- Total height ~3.30u (up from ~2.80u) — more visible from chase distance. All Lambert so it shades with the sun rig.
- Spawn facing computed from `cam.az + π` so we see the runner's back from frame one.

**5. Rooftop prop variety — 7 kinds per rooftop:**
- `vent` — big HVAC unit + 2 small boxes + a side pipe.
- `helipad` — dark circular pad + yellow ring + 3-box "H" letter + 4 perimeter blink LEDs.
- `water` — cylinder tank on 4 splayed legs + cone cap + a 6-rung side ladder.
- `solar` — 3×3 grid of tilted dark panels (each with a front-leg post).
- `antenna` — 3-4 thin poles + dish + occasional rooftop blinkers.
- `garden` — 2 long planters with 4-6 bush spheres each (two green tones).
- `empty` — clean rooftop, just the base building. Lets the skyline breathe.
- Tall buildings (h > 38) that aren't already antenna/helipad get an extra blink-LED antenna in addition.

**6. Inter-rooftop connections.**
- `_buildConnections` scans each building's near neighbors (planar distance 14-36u, height diff ≤ 14u), takes the 2 closest, and 55% of those pairs get a visible link.
- Geometry chosen by height delta:
  - Small/no delta + 55% chance: **pipe** — `CylinderGeometry(0.34, 0.34, len, 10)` between rooftop edge-pickup points, with metal collars at each end.
  - Small/no delta + 45% chance: **wooden plank bridge** — box plank + two thin side rails offset by rotation-aware projection.
  - Big delta (>6u): **cable** — thin dark cylinder spanning the gap (reads as a power line).
- Edge-pickup points use `Math.min(walkable.w, walkable.d) × 0.42` along the bearing toward the other rooftop — bridges sit on the edge, not floating to the center.
- Visual only for now; the character doesn't physically walk across pipes (space-leap or click-warp).

**7. HUD help text** updated to teach the new controls (WASD walk, space leap, click warp, Q/E song nav, O/Esc overview).

**Files**: `js/tracks-jump.js` — `_buildCity`/`_buildBuilding` replaced with archetype dispatch + 5 archetype builders; new `_concreteFor`, `_addBuildingFacade`, `_addRooftopProps` + 6 prop builders, `_buildConnections` + `_addConnection`; `_buildCharacter` rewritten with jointed limbs; new `_tryJump`, `_cameraForwardXZ`, `_updateWalk`, `_animateJump`; `_onKeyDown` remapped; new `_onKeyUp` wired in init + destroy; `onTrackChange` simplified to use `_jumpTo(roof, false)`; HUD help text updated. SHARED extended with 11 new materials (props, connections, character jacket). Now ~2250 lines.

`js/builds/tracks.js` t25 → t26.
`docs/tracks/FILE_MAP.md` build bump.

Localhost only. No deploy. Reload `/tracks` — walk with WASD, hit space to leap, click banners to warp.

---

## t25 — 2026-05-12 — Scrap the runway. Build "The Jump." (3rd-person platformer)

> "It's literally just like an awful fucking temple run. You know his creativity in the background with the birds with the crane the different buildings, but this fucking sucks. Be cool feel like a sexy platformer really smooth like 3d animation. And you could like kind of jump your guy from building the building and I could like sit there on those buildings. They could like play my song"

The runway concept landed visually but the linear "scroll forward" UX read as Temple Run. User explicitly wants: visible character, smooth 3D animation, rooftop-to-rooftop jumping, sit on the building while song plays. Plus they want the t23 background life (birds, cranes, varied buildings) that t24 had buried under haze.

**New scene: "The Jump" — a third-person platformer.** New module [js/tracks-jump.js](../../js/tracks-jump.js), ~1400 lines. Loader swapped `tracks-run.js → tracks-jump.js` in index.html. `tracks-run.js` retained as a revert path (same `window.TracksDaw` interface).

**Procedural city (replaces the runway):**
- 14×10 grid of buildings at `STEP=28u` pitch (~392u × 280u footprint), ~140 buildings.
- Height profile peaks toward the center (`baseH = 20 + (1 - distNorm) × 36 + rand × 36`) so the city has a skyline, not a flat slab.
- Each building: white-concrete body (3 tints, Lambert), glass strip on ~70% of buildings (Standard, low roughness, picks up specular sun), red-or-yellow accent stripe on 30%, rooftop vent + optional water-tank-on-legs + optional blink-LED antenna.
- 60-building distant silhouette ring (radius 600-1300u) for horizon depth.
- Ground plane at y=0 in dark concrete (so jumping off a building has visible "ground far below" feel).

**Track ↔ rooftop assignment:** every track gets exactly one rooftop. Buildings scored by `height - centerDistance × 0.12` (tall + central = best). Tracks ordered featured → new → archive and assigned in that priority — so featured tracks live on the tallest, most-central rooftops, and the eye naturally lands on them first.

**Banner per rooftop** (one per track): vertical red sign at the rooftop's back-edge, facing the city center. Sized by tier (featured 4×12, new 3×9, archive 2.4×7). Baked canvas texture (192×640): red field, white hatched accent strips top/bottom, side rails, title rotated -90° to read bottom→top, tier tag bottom-right. Halo plane behind (additive, DoubleSide).

**Low-poly runner character** — built from primitives (~12 meshes):
- Capsule torso (red shirt — ME palette), sphere head (skin), half-sphere hair (dark), box hips (dark pants).
- Arms / legs are pivot Groups so they rotate at shoulders / hips. Box arms (red sleeves) with skin-tone box hands. Box legs (dark pants) with white box shoes.
- All Lambert so the same sun rig shades them like the rest of the city.

**Jump animation** (`_jumpTo` + `_updateCharacter`):
- Distance `d` → duration `clamp(0.75 + d × 0.013, 0.9, 2.4)s`. Apex `max(startY, endY) + min(18, 4 + d × 0.22)`. Longer jumps = higher arc + longer hang time.
- Horizontal: ease-in-out-cubic between start and end.
- Vertical: quadratic Bezier through `(startY, apexY, endY)` — guaranteed smooth arc.
- Limb swings: `arc = sin(πt)` for the bell-shaped main pose, `flow = sin(2πt)` for the cycle. Arms get `-arc × 1.3 + flow × 0.20` baseline; legs get `arc × 0.6 ± flow × 0.40` with opposite phase per leg.
- Body forward lean from `arc × 0.35`. Takeoff squash: `1.0 - 0.8 × (0.10 - t)` for `t < 0.10`. Landing squash: `1.0 - 1.4 × (t - 0.92)` for `t > 0.92`. Both compress the Y axis briefly for that satisfying anticipation/impact feel.
- Idle (not jumping): vertical bob from `sin(bodyBob)` + bass amplitude, gentle Z-sway, mild arm sway. Character feels alive between jumps.

**Third-person orbit chase camera** (`_applyCamera`):
- State `{ az, el, dist }`. Drag rotates az/el (el clamped [0.10, 1.30] rad). Wheel adjusts dist (clamped [6, 60]). Touch: 1-finger orbit, 2-finger pinch zoom.
- Target = character head (`charPos + (0, 2.2, 0)`). Offset built from spherical az/el/dist. Smooth lerp `camPosNow` + `camTarget` toward the chase pose every frame at `k=0.10` idle / `k=0.16` jumping (tighter chase during action).
- `camera.lookAt(camTarget)` so the camera always frames the runner.

**God view** (O / Esc / OVERVIEW button): camera to `(0, 360, charZ)` looking straight down. Click a banner = exit god view + jump there. Click empty = just exit. So the overview doubles as a fast-jump map.

**Background life (the t23 stuff the user explicitly missed):**
- 1 helicopter circling the city, bass-bob altitude, spinning rotors, blinking belly LED.
- 4 yellow construction cranes with hanging loads + counter-balances at varied positions / arm rotations.
- 3 bird flocks (~24 birds total) on circular paths at different altitudes with vertical wobble. Cones pointed along tangent direction so they read as wings-spread silhouettes.
- 60-building distant horizon silhouette ring.

**Lighting + tone curve** (kept from t24):
- ACES Filmic tone mapping, exposure 1.08.
- DirectionalLight `(500, 160, 1000)` warm white 1.55 (matches the pinned sun in the sky shader).
- HemisphereLight cool-cyan top / warm-orange ground 0.70.
- AmbientLight warm-white 0.38.
- UnrealBloom strength 0.24 / radius 0.55 / threshold 0.86 — only the brightest highlights bloom.

**Prev/Next song hop**: `onTrackChange` callback hops the runner to the new track's rooftop with a real jump (not a teleport). Browses song-by-song with full animation. Re-uses `_jumpTo` math but skips the `onPlay` call to avoid an infinite loop with the host's track-change event.

**Sky + fog**: same vertex-gradient cyan-zenith → orange-horizon shader on a 3200u sphere that follows the camera. Linear fog `(0xe2cab0, 220, 1400)` — closer than t24's `(220, 2200)` so the distant silhouettes fade earlier and the playable city stays crisp.

**Files**:
- **New**: [js/tracks-jump.js](../../js/tracks-jump.js).
- **Modified**: [index.html](../../index.html) — loader swapped `tracks-run.js → tracks-jump.js`.
- **Modified**: [js/builds/tracks.js](../../js/builds/tracks.js) t24 → t25.
- **Modified**: [docs/tracks/FILE_MAP.md](FILE_MAP.md) — scope rewritten, t23/t24 moved to Legacy, full t25 architecture summary added.

Localhost only. No deploy. Reload `/tracks`, click a red banner, watch the runner leap.

---

## t24 — 2026-05-12 — Lit pass: ACES tone mapping, sun + hemi, tamed bloom, slower stride

> "scrolls too fast, way too much bloom but love it, can we make it even sexier and more like mirrors edge, like their graphics engine i mean not ripping their style"

t23 shipped the concept but rendered with unlit `MeshBasicMaterial` across every surface and an aggressive `UnrealBloomPass(0.45, 0.85, 0.18)` — result: white concrete blew out into one big pink fog blob, scroll catapulted past 1.4 banners per tick, no surface had form. This pass installs a real lighting rig + cinematic tone curve + selective bloom so the white-on-orange palette reads as Mirror's-Edge-engine-grade rather than wallpaper.

**Lighting** (added to `init()` after renderer setup):
- `DirectionalLight(0xfff2dc, 1.55)` at position `(500, 160, 1000)` — direction matches the pinned sun in the sky shader (`normalize(vec3(0.50, 0.16, 1.00))`), so lit faces in the city are warmly washed from the same vector the sun-pin glow comes from in the skybox. Visually consistent.
- `HemisphereLight(0xc8d8e0 sky / 0xff9560 ground, 0.70)` — cool cyan on faces pointing up, warm orange on faces pointing down. Mimics sky-color top bounce + sunset-on-pavement bottom bounce.
- `AmbientLight(0xfff0e0, 0.38)` — soft warm lift so shadowed faces don't murk out.

**Tone mapping**:
- `renderer.toneMapping = THREE.ACESFilmicToneMapping`, `toneMappingExposure = 1.08`. ACES is the cinematic compression curve used in most modern game engines (UE, Unity HDRP, Frostbite). It rolls highlights off gracefully instead of hard-clipping, and lifts shadows enough that the dark side of buildings shows form. Sum of light intensities can exceed 1.0 without overexposure because the curve compresses.

**Materials** (in `ensureShared()`):
- Concrete (3 tiers), rail, yellow cranes, vents, helicopter body → `MeshLambertMaterial`. Base colors pushed nearly to white so the Lambert × light multiplication keeps lit faces bright after the ACES curve. Lambert is vertex-shaded (cheap) so the ~200 buildings + runway still hit 60fps.
- Glass + glassWarm → `MeshStandardMaterial` with `roughness=0.10/0.18, metalness=0.0`. Picks up specular highlights off the directional sun for that wet-glass sheen Mirror's Edge does on facades. No env map yet — could add a baked PMREMGenerator pass in a future build if reflections need to read more environment.
- Self-luminous accents (red, helicopter rotor blur, blink LEDs, banner edges) stay `MeshBasicMaterial` — they should always render at full color regardless of where the sun is.

**Bloom**:
- Old: `UnrealBloomPass(0.45, 0.85, 0.18)` — strength 0.45, radius 0.85, threshold 0.18. With threshold 0.18 and white concrete around 0.94 brightness, basically the entire scene crossed the bloom threshold. Result = wash.
- New: `UnrealBloomPass(0.22, 0.55, 0.88)` — strength 0.22, radius 0.55, threshold 0.88. Only the sun pin, the brightest banner highlights, and the rooftop LED blinks cross the threshold now. Bloom acts as accent, not haze.

**Banner halo opacity** dropped roughly 50% across the board so the focused banner glows like wayfinding red, not a lens flare:
- Focused: `0.55 + mid * 0.35` → `0.28 + mid * 0.18`
- Active (closest, not focused): `0.18 + bass * 0.18` → `0.10 + bass * 0.10`

**Scroll feel**:
- Wheel sens: `0.00012` → `0.00004` (≈3× slower). With browser `deltaY ≈ 100`, one wheel tick now advances `0.004` of the run (~0.3 banners) instead of 1.4.
- Arrow ↑↓ / W S: `0.016` → `0.006` per keydown.
- Mouse drag Y: `0.0018` → `0.0009`.
- Touch drag Y: `0.0024` → `0.0012`.
- Easing rate: `k × 4.5` → `k × 2.4`. Slower follow → camera has weight, no slingshot.

Net effect: the runway has the same brightness and the same red wayfinding feel, but surfaces have direction, shadows have warmth, only the highlights bloom, and you can actually park near a banner instead of overshooting by three.

**Files**: `js/tracks-run.js` (SHARED Lambert/Standard swap, lighting + tone mapping in `init()`, bloom params in composer setup, sensitivity constants in `_onWheel/_onMove/_onTouchMove/_onKeyDown`, easing rate in `_loop`, halo targets in `_updateActive`). `js/builds/tracks.js` t23→t24. `docs/tracks/FILE_MAP.md` build bump.

Localhost only. No deploy.

---

## t23 — 2026-05-12 — Scrap the city. Build "The Run."

> "Don't like what we built. Honestly, I think we need to change it drastically … just completely change make like a different idea or something cooler bigger more innovative. Maybe something mirrors edge inspired. But still it like displays all my songs, what would you build?"
>
> Reply: "lets try the run"

The 3D NYC city was working pixel-wise (t14–t22 worked through layout, density, architecture variety, in-city browsing) but the user reached for "this is fucking terrible" UX-wise. The fundamental problem: an orbit-only city of 104 buildings is great to look at and bad to navigate. So we ditched it.

**New scene: "The Run" — Mirror's-Edge-styled rooftop runway.**
- Bright-white concrete sky-bridge extending into a cyan-to-orange sunset, 10u wide × `(N × 14u + 200)` long (~1656u for 104 tracks).
- Track count drives runway length, not vice-versa. Adding more tracks just extends the path.
- Each track = a vertical red banner along the runway. 3 tiers:
  - **Featured** (8×16×0.35) — hangs above center on a suspension wire, gantry-sign style.
  - **New** (5×12×0.30) — alternating left/right of the runway at `x = ±6.2`.
  - **Archive** (3×8×0.25) — further out at `x = ±9.5`, smaller silhouette.
- Banners have baked canvas textures (256×768): red field, white hatched accent strips top + bottom, side rails, title rotated -90° to read bottom→top, tier tag at bottom-right corner.

**Navigation: scroll-along-runway.**
- `runT` eases toward `targetT`, both in `[0,1]` mapped onto the runway z.
- Input drives `targetT`: wheel (`deltaY × 0.00012`), W/S or ↑/↓ (`±0.016`/keydown), vertical mouse drag (`dy × -0.0018`), 1-finger touch drag Y (`dy × -0.0024`).
- Arrow ←/→ = prev/next song (reserved away from camera).
- Click a banner = play that track + glide camera there.
- Space = play/pause (passes through to `ctx.onTogglePlay`).
- **No orbit, no free-fly, no WASD-strafing.** The user is on rails, scrolling the rails.

**Active vs focused banner.**
- `activeIdx` = banner closest to current `runT`. Updates the big top-center title overlay live as you scroll past — feel of the song you're currently in front of.
- `focusedIdx` = the actually-playing track. Has a brighter halo modulated by mid-band audio.
- Click decouples them only momentarily; the prev/next + auto-advance flow re-aligns them via `onTrackChange`.

**God view (O or Esc).**
- Camera pulls 380u above the runway looking straight down. All banners visible as a long red line through the city — "all my songs at once" view.
- Click anywhere in god view = teleport `targetT` to that z and return to first-person there. So the top-down doubles as a jump-around map.

**City + sky.**
- Sky: `ShaderMaterial` on inside of a 4500u sphere. Vertex gradient zenith-cyan → mid-warm → orange-horizon → ground-cool, with a pinned sun (`pow(dot, 90)` hot core + `pow(dot, 8)` bloom) and slow horizontal cloud bands offset by time. Side `BackSide`, `depthWrite: false`.
- City: 4 ranks of procedural ME-style buildings each side of the runway (white concrete + cool/warm glass strips + occasional red/yellow accent stripes + rooftop vents + red blinker LEDs). 50 distant horizon silhouettes. 3 yellow construction cranes. 1 audio-reactive helicopter (bass-driven altitude bob).
- Linear fog `Fog(0xe2cab0, 400, 2200)` so the far end fades to the warm horizon. No FogExp2 — keeps the foreground crisp.

**HUD.**
- Top-left: `CANTMUTE / THE RUN` brand + track count + build.
- Top-center: search input.
- Below it: big active-track title (28px black sans-serif) + tier chip in red + mini progress bar showing position along the run.
- Top-right: filter chips (ALL / NEW / FEATURED) — same URL contract as the city.
- Bottom-right: OVERVIEW button (toggles god view).
- Bottom-left: control hints (SCROLL/SWIPE/↑↓ · run, CLICK BANNER · play, ←/→ · prev/next, O/ESC · overview).
- Bottom-center: same transport pill as before — prev/play/next/seek + title + time. **Reskinned to white-on-light to match ME palette** instead of dark-on-dark.

**Audio.**
- Piggybacks `audio.__floorAnalyser` from `js/player.js` (no second AudioContext). 3 smoothed bands (bass/mid/hi) drive: camera bob, banner halo opacity when active, helicopter altitude.

**Files**:
- **New**: [js/tracks-run.js](../../js/tracks-run.js) — the entire scene, ~960 lines.
- **Modified**: [index.html](../../index.html) — dynamic script loader swapped `tracks-city.js` → `tracks-run.js`. The city module is untouched on disk and remains the revert path (flip the src back, no other changes needed — same `window.TracksDaw` interface).
- **Modified**: [js/builds/tracks.js](../../js/builds/tracks.js) t22 → t23.
- **Modified**: [docs/tracks/FILE_MAP.md](FILE_MAP.md) — completely rewritten scope description + architecture summary; `tracks-city.js` moved to the Legacy/revert path section.

Localhost only. No deploy. Reload `/tracks` — scroll forward, click a red banner, hit O for the god view.

---

## t22 — 2026-05-12 — In-city song browsing: prev/next flies the camera

> "I click on to a building it then moves the camera to like that building. And there's no way to like … the best way to return is to click the ground view button to zoom out and then go to the next song so. For a music portfolio. This is fucking terrible … if we do another viewport thing. It's just like our scenes webpage, and I don't want that. What can we do?"

The browsing flow was broken: click a tower → camera locks onto it → no way to jump to the next song without manually zooming out, hunting for it among 100+ towers, and re-clicking. This pass fixes the flow without adding a 2D overlay (which the user explicitly rejected).

**Core fix: prev/next on the transport bar now flies the camera** (`onTrackChange`):
- When `focusedIdx !== -1` (i.e., the user has clicked into a tower), changing the playing track now also moves the camera to that track's tower with the same flight params used for click-to-focus (~`_flyToTower`). The user can sit in-city and browse song-by-song via the `‹` / `›` buttons or audio auto-advance.
- When `focusedIdx === -1` (user is in aerial overview), prev/next still changes the song but doesn't grab the camera — they stay zoomed out.
- The tower-visibility check (`tw.group.visible`) skips filtered-out tracks so we don't fly to invisible towers.

**Esc + click-empty exit focus** (`_onClick`, `_onKeyDown`, `_exitFocus`):
- New `_exitFocus()` helper: clears `focusedIdx` and flies back to the default aerial cam (uses existing `_setView('aerial')`).
- `Esc` key calls it (was previously just clearing `focusedIdx` with no camera move).
- Clicking on empty water/ground/sky while focused calls it. Previously a no-op click did nothing — easy to discover, no UI required.

**"← OVERVIEW" pill** (`_buildHud`, `_updateFocusUI`):
- New contextual button at the top-center of the screen, only visible when `focusedIdx !== -1`. Provides a discoverable explicit exit for users who don't try Esc or empty-click. Tappable on mobile.
- Toggled by `_updateFocusUI()` after every focus change (`_onClick`, `_exitFocus`).

**Updated help hint** (bottom-left HUD):
- Added "PREV / NEXT · jump to song" and "ESC / TAP GROUND · overview" lines so the new affordances are documented in-scene.

**Why not a 2D song-list overlay** (the option the user pre-rejected): they explicitly said "if we do another viewport thing. It's just like our scenes webpage, and I don't want that." The fix here preserves the 3D-world feel — every navigation action keeps the camera in the scene.

**Files**: `js/tracks-city.js` (`onTrackChange` extended, `_onClick` handles empty-click, `_onKeyDown` Esc, new `_exitFocus` + `_updateFocusUI`, new `_backBtn` in `_buildHud`, updated help text). `js/builds/tracks.js` t21→t22. `docs/tracks/FILE_MAP.md` build bump.

Localhost only. No deploy.

---

## t21 — 2026-05-12 — Densify satellites + NYC-style architectural variety

> "all of those other grids just have like one building every like chunk … I want like, you know more so a background … all of your buildings are still like super rectangular. Where's like, you know, New York has some super interesting architecture and buildings … center park … cyberpunk it out … definitely don't prove a lot on what we have now"

Satellite cells in t20 read as polka dots — buildings spread too far apart, all pure rectangles. This pass adds NYC-style silhouette variety to every filler (Art-Deco setbacks, podium+tower, cylindrical, twin-tower) AND doubles+ the satellite density so the surrounding city reads as a packed background.

**Why no Sketchfab/external asset**: a real NYC mesh (Sketchfab Manhattan blocks etc.) would (1) ship 10-40MB to every visitor on a Cloudflare static site, (2) clash aesthetically with the glitch-shader text towers in the center, (3) require licensing review (CC-BY attribution etc.) before going on a public portfolio, (4) mapping 100+ sub-meshes to song click-targets is fragile. Procedural variety wins: same render budget, same aesthetic family, every filler reads as architecturally distinct.

**`_addFiller` rewrite (`js/tracks-city.js`)** — 5 body archetypes + 7 roof features:

Body (rolled per filler):
- **30%** plain box (current).
- **25%** stepped setback — 2 tiers, top tier 60-80% width (Empire-State family).
- **19%** wide podium + narrow tower — low ~1.3-1.5× wide base + narrow shaft above (mid-rise condo family lining Central Park).
- **13%** cylindrical — `CylinderGeometry(r, r, h, 14)` reusing the same window-baked texture; the 5 vertical window strips wrap nicely around.
- **13%** twin-tower complex — two narrow shafts (0.78× base width) on a shared wide podium, offset along the building's local X with sin/cos rotation so the pair stays aligned with the body's yRot.

Roof feature (rolled separately after the body, sits on top of `topY` / `topW` / `topD` returned by the body archetype so the spire of a setback's narrower tier scales to that tier, not the base):
- **18%** clean cut (no roof feature).
- **22%** antenna + red LED blinker — uses `SHARED.blink` so it pulses with the city-wide LEDs.
- **18%** narrow spire (Chrysler needle).
- **15%** pyramidal cap (4-sided cone, hipped roof).
- **11%** hemispherical dome (observatory).
- **9%** rooftop water tower — cylinder + small cone cap in dark metal (NYC silhouette signature).
- **7%** twin spires (cathedral / Trump-Tower-ish double finial).

Inner-rank (`small: true`) fillers stay as plain low boxes — keeps the rank just outside the music towers clean so the glitch-shader text isn't visually competing with adjacent setbacks.

**Satellite density bump (`_buildSatelliteIslands`)** — counts ~2.1× higher so each surrounding cell reads as a packed neighborhood instead of polka dots:
- E / W long-side cells: 42 → **90** (~25u pitch on 160×524 area).
- N / S cap cells: 20 → **44** (~17u pitch on 208×160 area).
- 4 corner cells: 16 → **34** (~16u pitch on 160×160 area).
- Total satellite buildings: 188 → **404**.

Grand total non-music buildings: ~356 main fillers + 404 satellites = **~760** procedural buildings. Each is 1-4 meshes depending on archetype (twin-tower with twin-spires = 5; plain box with no roof = 1). All share the 12 baked window materials so material churn is zero; draw count is the only cost.

**Files**: `js/tracks-city.js` (`_addFiller` rewritten; `_addFillerRoof` added; `_buildSatelliteIslands` counts bumped). `js/builds/tracks.js` t20→t21. `docs/tracks/FILE_MAP.md` build bump.

Localhost only. No deploy.

---

## t20 — 2026-05-12 — Satellites snap to a 3×3 city grid

> "focus on tracks page. you have a grid surrounding our city. you put other cities in random positions instead of filling that bottom grid can u update"

The t18/t19 satellites lived at hand-picked offsets `(-340,-360)`, `(380,180)`, `(-40,500)` — they read as random islands tossed into the water rather than blocks of a city. Replaced with a clean 3×3 block layout centered on the music block.

**`_buildSatelliteIslands` rewrite (`js/tracks-city.js`)**:
- 8 satellite neighborhoods, one per surrounding cell of a 3×3 (music block = center):
  - **E / W** (long sides): 160×524 each (match center `BLOCK_L`), 42 buildings each. Center at x = `±(BLOCK_W/2 + 14 + 80) = ±198`, z = 0.
  - **N / S** (caps): 208×160 each (match center `BLOCK_W`), 20 buildings each. Center at x = 0, z = `±(BLOCK_L/2 + 14 + 80) = ±356`.
  - **4 corners**: 160×160 each, 16 buildings each. Center at `(±198, ±356)`.
- 14u gap between cells reads as water/street.
- Total satellite buildings: 84 (E/W) + 40 (N/S) + 64 (corners) = **188** (was 90 across 3 random islands).
- Each cell still gets its own slab + local grid + 4 corner streetlights via the existing `_buildSatellite` helper (unchanged).

Total scene reach grows from ~±500 to ±436 (Z) / ±278 (X). Within the existing water plane (2400×2400) and camera far plane (3000). Fog density unchanged — distant corners read as silhouettes, consistent with the "depth" the prior random satellites had.

**Files**: `js/tracks-city.js` (rewrote `_buildSatelliteIslands` only; `_buildSatellite` unchanged). `js/builds/tracks.js` t19→t20, `docs/tracks/FILE_MAP.md` build + date bump.

Localhost only. No deploy.

---

## t19 — 2026-05-10 — Fill the grid, kill the distant dots

> "This did not fix it … I was more so hoping that you would build things on. This grid like the grid that we made … currently. Things are just super fucked up"

User pointed at the EMPTY slab space on either side of the music towers (with blue brushstrokes in the screenshot) and said the t18 distant skyline ring looked like a mess of black dots, not buildings. Fix.

**Removed**:
- `_buildDistantSkyline` call **and** method body. The 70-cluster horizon ring of dark boxes at radius ~1000 was reading as noise rather than depth.

**Block bigger + grid filled densely** (`_buildFillers` rewritten):
- `BLOCK_W`: `PARK_W + 76` → `PARK_W + 116` (168u → 208u). `BLOCK_L`: `PARK_L + 116` → `PARK_L + 184` (456u → 524u). Bigger slab gives ~4 ranks of filler room on each long side and ~5 on each cap.
- **East/West long sides**: 3 ranks of continuous filler from `r2OffX + 6` out to block edge - 3u, ~38 slots per rank × 2 sides = **~228 buildings**. Inner rank is `small`-flagged (height 6-16u) so the music towers still dominate the silhouette; outer ranks 9-22u (62%), 18-32u (28%), 30-50u (10%).
- **North/South caps**: 4 ranks of filler from `capZ + 6` to block edge - 3u, 16 slots per rank × 2 caps = **~128 buildings**.
- Total filler on main block: ~356 buildings (up from ~80 in t18). The slab outside the music belt is no longer visible bare grid.
- Filler footprints scaled down 4.0-6.6u → 3.4-6.0u so they pack more naturally at ~8.5u rank pitch.
- Crown probability lowered 35% → 32%, and only non-`small` fillers get crowns (the inner rank stays clean to read as low-rise infill).

**Satellites** (`_buildSatelliteIslands`):
- Positions shifted further out to clear the bigger main block: `(-340, -360)`, `(380, 180)`, `(-40, 500)`.
- Building counts bumped 22/24/20 → 30/32/28 so each neighborhood reads as fully populated.

**Files**: `js/tracks-city.js` (targeted edits — header, BLOCK constants, init build sequence, removed `_buildDistantSkyline`, rewrote `_buildFillers` + `_addFiller`, repositioned satellites). Final line count ~3022. `js/builds/tracks.js` t18→t19, `docs/tracks/FILE_MAP.md` build bump.

Localhost only. No deploy.

---

## t18 — 2026-05-10 — Whole canvas alive: filler buildings, satellite islands, distant skyline, traffic, helicopters, drifting boats

> "very cool keep adding so not just the center but whole space is flowing moving. again the whole canvas is just a rectangle add much much more. add buildings that are not music but nice cool colors or somehting between ouyr music buildings"

The main block was packed but the rest of the canvas was empty water — just one rectangle floating in nothing. Plus the only buildings were music towers, so gaps between them read as voids. This pass adds non-music buildings to fill the cityscape and breaks the single-rectangle silhouette with surrounding neighborhoods.

**Filler buildings (`_buildFillers`, `_addFiller`)**:
- ~80 non-clickable decorative buildings packed into a **3rd rank** on each long side of the main block (outside the music belt) + an **outer cap row** (further north/south of the music caps) + 18 small infill buildings sprinkled around the caps.
- Each filler uses a **shared MeshBasicMaterial with a pre-baked canvas texture** of dark base + lit-window grid (5 cols × 22 rows, ~55% windows lit, varied brightness per window).
- **12 building palette colors** baked once at module load: warm orange/amber/coral, cool blue/cyan/sky, neon hot-pink/violet/mint, muted gray. Each filler picks one randomly.
- Height varies (small: 8-22u, medium: 14-30u, tall: 28-52u, rare hero: 52-80u) — fills the gap between music-tower scale.
- 35% chance of a roof element: small antenna with red blinking LED (sharing the same `SHARED.blink` material that pulses all over the city), or a smaller setback box.
- Music towers still get the prime park-facing front rank; fillers fill behind them and around the caps.

**Satellite islands (`_buildSatelliteIslands`)** — breaks the single-rectangle silhouette:
- **3 smaller neighborhood islands** floating in the water around the main block:
  - SW district: `(-320, -260)`, 110×130u, 22 buildings.
  - E district: `(360, 160)`, 90×160u, 24 buildings.
  - Far N strip: `(-50, 430)`, 150×70u, 20 buildings.
- Each has its own concrete slab (above-water island), grid overlay, 4 corner streetlights, and a packed-grid of filler buildings (using the same 12-color palette).
- Total filler buildings across all 3 islands: ~66.

**Distant skyline (`_buildDistantSkyline`)**:
- ~70 cluster spots in a ring at radius ~1000 (±280 jitter), each spawning 1-3 boxes of varying height (28-120u). All use the shared filler materials so visual identity matches. Adds the "this neighborhood is in a much bigger city" depth feeling. Far enough that they read as silhouettes more than detail; cheap to render.

**Cars (`_buildCars`)** — perimeter traffic:
- **20 cars** on two closed-loop paths:
  - Inner loop: 9 cars along the inside edge of the block (sidewalk), counter-clockwise.
  - Outer loop: 11 cars on the river-side perimeter, clockwise.
- Each car is a small group: colored box body (8 paint colors) + dark cabin on top + 2 white headlights + 2 red taillights.
- Animate each frame by advancing `t` along the path's total length, lerping between corner waypoints, snapping rotation to segment direction. Snap-turn at corners — fine for the low-poly aesthetic.

**Helicopters (`_buildHelicopters`)**:
- **2 helicopters** circling the scene at high altitude (130-165u). Red + blue.
- Each has a body + tail boom + tail fin + main rotor (spinning plane) + tail rotor + 2 landing skids + a red belly blinker (uses `SHARED.blink`, pulses with the rest of the city's LEDs).
- Animate: spherical orbit around origin (`radius=360+90n`), face flight tangent, rotor spins at 30 rad/s.

**Boats — forward drift**:
- t17 boats only bobbed. Now each has a `boatSpeed` (0.6-1.3 units/sec) and advances along its facing direction every frame.
- Wrap-around when crossing ±700u boundary on x or z (teleports to other side).
- Boat count bumped 8 → 10. Two are now placed past the original water bounds.

**Other tweaks**:
- Camera default radius 320 → 360, max radius 900 → 1100 — accommodates the bigger scene.
- Water plane size 1800×1800 → 2400×2400 — covers the full satellite-island radius.
- Fog density 0.0045 → 0.0038 — slightly clearer to let satellite islands + distant skyline read.
- Camera far plane 2400 → 3000 to render the distant skyline.

**Mesh count**: now ~5000+ meshes total (music towers + 4 ranks of fillers + 3 satellite islands + 70 distant clusters + 20 cars × 5 parts + 2 choppers × 9 parts + 280 trees × 3-4 each + 30 people × 4 + lampposts/benches/streetlights/etc). All materials shared aggressively. Mobile may throttle below 60fps; desktop is fine.

**Files**: `js/tracks-city.js` (full rewrite, ~3034 lines), `js/builds/tracks.js` (t17→t18), `docs/tracks/FILE_MAP.md` (build bump only).

Localhost only. No deploy.

---

## t17 — 2026-05-10 — Park comes alive: 280 big trees, 30 people, birds, gazebo, playground, picnic, hot-dog cart, stream + stone arches, boats

> "still super basic can we make it even cooler sexier more interesting more park elements? make stuff in park bigger and many many many more models more lively?"

t16's park had the right bones (paths, fountains, statue, lampposts) but the trees were too small to register, there was nothing happening (no people, no animals, no commerce, no landmarks beyond the statue/fountains), and the long stretches of grass read as empty.  This pass packs the park.

**Trees — 2× count, much bigger, 5 species** (`_buildTrees` rewrite):
- TREE_COUNT: 120 → **280**.
- All tree sizes bumped ~70-90% so they actually register against the buildings.
- **Pine** (28%): trunk 2.4-3.8u + 3-4 stacked cones (base radius 2.2-3.1u, layer height 2.4-3.4u). Total ~10-15u.
- **Round deciduous** (30%): trunk 2.6-4.0u + 4-5 overlapping low-poly icosahedron lobes (crown radius 2.6-3.8u) + top crown sphere. Total ~7-11u.
- **Layered shrub** (26%): short trunk + 2-3 stacked low cones. Total ~5-7u.
- **Bush** (14%): single squashed icosahedron 1.1-1.6u radius.
- **Landmark sequoia** (2%, rare): trunk 6-9u + 5 stacked huge cones. Total ~22-28u — a few hero trees that tower above the canopy.

**Park life (all new methods)**:
- **~30 people** (`_buildPeople`): 18+ walking figures along the spine and the cross paths (each has a 2-point segment, lerps back and forth with random speed, rotates to face direction, gentle vertical bob to imply walking); ~12 sitting figures on benches (one per available bench sit-spot, ~55% occupancy); plus a vendor next to the hot dog cart and 2 figures hanging out near the gazebo. Each figure is a cylinder body + cylinder legs + sphere head + icosahedron "hair" cap. Body color from a palette of 8 shirt materials; hair from 5 colors. Sitters have rotated, scaled-down legs to read as a seated pose.
- **14 birds** (`_buildBirds`): 4-vertex triangular wing meshes flying in circles at 65-135u altitude, each with its own center, radius (40-150u), and speed. Rotate to face flight tangent. Wing-flap via z-scale oscillation at 6-11 Hz. Fly all around the block, not just over the park.
- **~16 flower bed clusters** (`_buildFlowerBeds`): each bed is a 0.9-2.6u radius circular dirt patch with 8-14 stems + colored flower-head spheres in 6 colors (red/yellow/white/purple/hot-pink/orange). Placed along the spine, ringing the fountains, and scattered in open grass with rejection sampling.
- **Gazebo** (`_buildGazebo`): octagonal stone pavilion at (W*0.20, -L*0.36). 8 pillars (4.2u tall), torus ring, conical brown roof, metal finial with sphere on top. ~5u radius.
- **Playground** (`_buildPlayground`): sandbox pad + a 4-rung ladder + platform + angled slide (rails included) + 2-position swing set with rope hangers + see-saw on a pivot. At (-W*0.22, -L*0.06).
- **Picnic area** (`_buildPicnicArea`): 4 tables clustered at (W*0.22, L*0.22), each with a wooden top + 2 bench planks + wooden legs + thin pole + red conical umbrella overhead.
- **Hot dog cart** (`_buildHotDogCart`): white box body with red stripe, 4 wheels, tall pole with yellow conical parasol, red sign on the front. At (-W*0.34, L*0.36) with a vendor figure standing next to it.
- **Stream + bridges** (`_buildStream`, `_buildBridges`): a meandering dark-blue strip cuts across the park at z = -L*0.04, built from ~30 small plane segments with sinusoidal x-offset to look organic. **3 stone bridges** span the stream — central + ±W*0.32 — each with a stone deck, half-torus arch underneath, and post-and-rail balustrade on both sides.
- **8 boats** (`_buildBoats`): scattered on the surrounding water at varying x/z positions. Each: white box hull + cone bow + red cabin + small white sail + metal mast. Boats bob via sin(t)*0.12 vertical and small rotation oscillation.

**Animation additions** (in `animate()`):
- People walking lerp + face direction + walking bob.
- Boats bob in 3 axes per their cached phase.
- Birds circle + flap wings.
- Fountains slightly denser (60 → 80 particles, taller peak 4.6u).

**Other tweaks**:
- Benches added 2 → bumped to 10 total to give more sit-spots for people.
- `this.benchPositions` array stores sit-spot world coords + rotation so `_buildPeople` can place sitters precisely.
- Tree rejection sampling expanded: avoid fountains (radius 8.5), pond (14), statue, gazebo (7), hot dog cart (5), spine path (|x|<2.2), and stream (|z-streamZ|<4) — no more trees clipping into structures.
- Shared materials registry expanded with flower colors (6), skin tone, 8 shirt colors, pants, 5 hair colors, boat parts, bird color, hot-dog cart parts, sand, rope, stream, roof.

**Performance note**: scene now has ~3000+ meshes (towers + crowns + 280 trees × ~3-4 geo each + 30 people × 4 geo + park props). All non-tower materials shared. Stable at 60fps on desktop; on mobile expect throttle but acceptable. If perf becomes an issue, the next step is `InstancedMesh` for trees/people/bushes.

**Build constants**:
- `js/builds/tracks.js` bumped t16 → t17.
- `js/tracks-daw.js` still the deeper revert path.

**Files**: `js/tracks-city.js` (full rewrite, ~2560 lines), `js/builds/tracks.js` (t16→t17), `docs/tracks/FILE_MAP.md` (build bump only).

Localhost only. No deploy.

---

## t16 — 2026-05-10 — Vertical detail pass: roof crowns, 4 tree species, park props, ground-view toggle, water-clip fix

> "It's just you know a rectangle with a little bit of whatever bullshit. … Maybe we'll be on the ground like in the center of a park … the trees the park it looks too flat. Also of a water kind of overlaps sometimes with the ground or whatever"

t15 had the right metaphor but the silhouette was too uniform (every tower flat-topped), the props too sparse (just two fountains + thin cone trees), and the water was clipping the block base on wave peaks. This pass fixes the bug, adds silhouette/prop density, and ships a GROUND VIEW preset that drops the camera INTO the park.

**Water clip fix**:
- Wave amplitudes halved in `WATER_VERTEX` (0.45→0.20, 0.30→0.14, 0.20→0.08; max sum ~0.42 down from ~0.95).
- Water plane y dropped from -0.6 to -2.0.
- Block base converted from a thin plane to a **3u-tall solid `BoxGeometry` slab** centered at y=-1.5 (top at y=0). The block now reads as a concrete island sitting above the river — water cannot intrude even at peak swell.

**Roof crowns (new `_addCrown`)**: every tower rolls a weighted crown type, biased by tier (featured tracks get more iconic silhouettes, archive gets more flat tops):
- 20%: flat (no crown)
- 30%: **antenna** — 5-10u thin steel pole + bright red sphere LED on top, pulsing in sync with all other antennae via a shared material (`SHARED.blink`, updated each frame with `sin(t*2.6)*0.5+0.5`).
- 24%: **setback** — smaller box (55-75% width) sitting on the tower top, 4-14u tall. 45% chance of a second smaller setback above, 22% chance of a thin steel spire on top of THAT.
- 14%: **pyramid cap** — 4-sided cone (5-12u tall), rotated 45° to align with the tower face.
- 12%: **water tank** — short cylinder + conical cap, mounted on 4 small box legs.

All crowns use a dark mix of the tower's tint (`tint * 0.35 + 0.10` per channel) so they read as part of the building silhouette rather than as separate objects.

**Trees (`_buildTrees` rewritten, 4 species, 120 trees)**:
- 32% **tall pine**: 1.4u trunk + 3 vertically-stacked cones (decreasing radius going up).
- 32% **round deciduous**: cylindrical trunk + 3-4 overlapping low-poly icosahedron foliage lobes + a top crown sphere. Reads as a real broadleaf canopy.
- 24% **layered shrub**: very short trunk + 2-3 stacked cones with offset jitter.
- 12% **bush**: single squashed icosahedron, no trunk.

Each tree picks foliage from 5 shared materials (green range: dark `#0e2e16` → bright `#4a9050`). Placement uses rejection sampling — avoids fountains, the pond, the statue base, and the central spine path. Tree count 64 → 120.

**Park props (new methods)**:
- `_buildStatue` — central monument near the north end of the park (z = +PARK_L * 0.42): box plinth + stepped plinth-cap + tapered cylindrical pillar (6u tall) + low-poly icosahedron orb + small cone on top. Pure gray stone palette.
- `_buildLampposts` — 10 pairs of warm-light lampposts running down both sides of the spine path. Pole + glowing sphere + circular additive-blended halo on the ground.
- `_buildBenches` — 8 park benches (4 per side) along the long edges of the park, facing the spine. Wooden seat + back + 2 dark metal supports.
- `_buildStreetlights` — perimeter sidewalk lighting: 6 streetlights per long side + 3 per cap, 5u poles with the same warm-light bulb/halo combo. Frames the block from outside.

**View modes (`_setView`)**:
- New **GROUND VIEW** button bottom-right of the HUD. Click toggles to `'ground'` mode: 1.3s easeOutCubic tween of camera to `target = (0, 2, PARK_L * 0.10)`, `radius = 26`, `elevation = 0.10` (≈6°, nearly horizontal). The camera ends up inside the park near the statue/pond axis, looking out at the towers — Apple-Maps "look up at a building" feel.
- Toggling again returns to `'aerial'` (target = origin, radius 320, elevation 0.52).
- Drag/wheel/pinch still work in both modes — the toggle is just a smart preset.
- Clicking a tower while in ground mode auto-reverts to aerial label so the toggle stays consistent.
- Keyboard `g` also toggles view.

**Other tweaks**:
- Elevation clamp loosened from `[0.15, 1.32]` → `[0.05, 1.34]` so ground view can be near-horizontal looking up at tower tops.
- Wheel zoom min-radius dropped from 60 → 16 to support the close-in ground view.
- Default `cam.elevation` lowered 0.66 → 0.52 (~30°) — less god-view, more cinematic angled.
- Featured tower height range expanded 70-94u → 70-98u (taller hero buildings).
- Shared sub-materials (`SHARED.*`) factored to the module level for trees/lamps/benches/streetlights/statue/crowns/blinkers. Reused across all instances; `destroy()` no longer disposes them.

**Files**: `js/tracks-city.js` (full rewrite, ~1775 lines), `js/builds/tracks.js` (t15→t16), `docs/tracks/FILE_MAP.md` (build bump only — scope summary still describes the same conceptual scene; full architecture stays in this CHANGELOG entry).

Localhost only. No deploy.

---

## t15 — 2026-05-10 — Central Park Block: park + water + fountains + trees, orbit camera (mobile-friendly)

> "this is cool, but the thing is is like we need some it needs to be better dispersed displaced all of that stuff. It's kind of interesting how we have the years but like don't need that. … like the map in the division … apple maps … like around Central Park. … Buildings would be my songs and in Central Park. We could just have like cool little water and the fountain and like trees and shit like that … I don't know how I feel about the camera and being able to move it because this will also be like the phone"

t14's strict 4-column grid + year separators read as "spreadsheet in 3D" — the user wanted Apple-Maps / The-Division style 3D architecture with a real-feeling NYC block centered on a Central-Park-shaped green space, plus an orbit camera that works on phone (the WASD free-fly was a deal-breaker for mobile). Full layout + camera rewrite.

**Block layout** (full rewrite of `_buildBlock`, replaces year-grouped `_buildTowers`):
- Designed park rectangle in the middle: `PARK_W=92` × `PARK_L=340` (Central Park's long-thin proportions).
- Building belt around it: 2 ranks on each long side (east/west), separated by ~13u; 1 row of caps at the north and south ends.
- Tracks sorted by tier (featured → new → archive). Slots sorted by priority (front-rank long-side first → back-rank long-side → caps). Within each band, slots are shuffled. **Featured tracks get front-rank park-facing positions**, archive fills back/caps. Front ranks face the park so the green is always visible between the camera and the prime towers.
- Every slot gets ±2.4u xy-jitter and each tower gets ±0.18 rad y-rotation + per-tower size jitter (featured 70-94u tall, new 50-64u tall, archive 30-42u tall; widths 5.0-7.6u). The city is no longer regular-grid.
- **Year markers / year separators removed entirely** (`_addYearMarker`, `_makeYearTexture` gone).

**Park** (new — `_buildPark`, `_buildFountains`, `_buildFountain`, `_buildTrees`):
- Dark sidewalk rim (block base, color `#12131a`, 162 × 450u) + soft grid overlay sitting just above (transparent `GridHelper` at opacity 0.45).
- Green grass plane (color `#12381f`, 92 × 340u) with a slightly darker `#07150c` rim.
- Paths: one ~325u central paved spine (color `#2e2f35`) + 4 cross-paths jittered along z with small rotation jitter.
- **Reflecting pond**: 11u-radius circle with a custom ring-shader (`sin(r*36 - uTime*1.8)` rings, mixed between deep and bright blue, dimmed toward the edge) — animated.
- **Two fountains**: each is a 5.2u-radius blue pool + gray rim + cylinder pillar + bright-blue spout sphere on top + 60-particle jet (`THREE.Points`, animated each frame — particles emit at the base, drift upward, recycle when they pass 4.6u). Spout sphere bobs ±0.14u to bass-detached sine.
- **Trees**: 64 procedural cone-on-trunk trees, scattered with rejection sampling (avoid fountains within 7.5u, avoid the central spine path). Three foliage colors (`#1d5c2a`, `#276c34`, `#3b8240`), randomized height 2.6-5.4u, randomized cone radius 0.85-1.4u, random y-rotation.

**Water** (new — `_buildWater`):
- 1800 × 1800 plane around the block with a custom vertex+fragment shader. Vertex displaces Y by `sin(x*0.035 + t*0.6) + cos(y*0.052 + t*0.9) + sin((x+y)*0.018 + t*1.3)` for slow Hudson-like waves. Fragment mixes deep navy `(0.02, 0.06, 0.14)` and bright navy `(0.06, 0.16, 0.30)` based on wave height. Sits at y=-0.6 (just under the block base at y=0).
- 80×80 vertex resolution — wave detail without the cost.

**Orbit camera** (full rewrite of camera state + handlers):
- State: `{ target: Vec3, radius: float, azimuth: float, elevation: float }`. Default `radius=340, azimuth=0.45, elevation=0.66` — angled-from-above view that shows the whole block + half the water.
- `_applyCamera`: standard spherical → cartesian, position = target + R·(sin(az)cos(el), sin(el), cos(az)cos(el)).
- **Drag**: dx → azimuth ±, dy → elevation ± (clamped `[0.15, 1.32]` rad). Sensitivity `0.0055`.
- **Wheel**: `radius *= (1 + deltaY * 0.0012)`, clamped `[60, 900]`.
- **Pinch (touch)**: 2-finger distance tracked from `touchstart`; `touchmove` scales `radius` by `d0 / d_now`. Touch-only path; the existing pointer events still cover single-finger drag and tap.
- **Arrow keys**: nudge azimuth ±0.08 rad / elevation ±0.05 rad — desktop convenience, mobile ignores.
- **Click a tower**: `_flyToTower` tweens target → near the tower, radius → max(60, height·1.1), azimuth → `atan2(tower.x, tower.z)` (camera ends up looking back toward origin at the tower), elevation → clamped current. 1.0s easeOutCubic. Then `ctx.onPlay(idx)`.
- **No WASD, no free-fly, no Q/E yaw** — all removed. Same input model on desktop and phone.

**HUD updates**: nav hints changed from "DRAG · LOOK / WASD · MOVE / SHIFT · SPRINT / CLICK TOWER · PLAY" → "DRAG · ORBIT / SCROLL / PINCH · ZOOM / TAP TOWER · PLAY". Build chip + filter chips + search bar + transport pill all unchanged.

**Misc**:
- Fog tightened from 0.0070 → 0.0045 density (closer view distance needed less aggressive fog).
- Camera FOV tightened from 72° → 58° (orbit views look better at narrower FOV, less fish-eye on edge towers).
- Starfield kept at 1100 points but pushed further out (radius 800-1500) since the camera no longer flies through them.

**Build constants + revert**:
- `js/builds/tracks.js` bumped t14 → t15.
- `js/tracks-daw.js` still the deeper revert path (full DAW). t14's layout is superseded — to recover the Manhattan-grid version, check git history.

**Files**: `js/tracks-city.js` (full rewrite, ~890 lines), `js/builds/tracks.js` (t14→t15), `docs/tracks/FILE_MAP.md` (scope + architecture sections rewritten).

Localhost only. No deploy.

---

## t14 — 2026-05-10 — Type Skyline: replace 2D DAW with a 3D type-tower city

> "focus on tracks, we made a cool daw, but i installed claude frontend design so we could do something cool and innovative, so far u made shit brutalist. i want things that push limits, like our galaxy page and stuff. for tracks ti should be a fun interesting way to see all my tracks or play them so what u think we can do"
> (and after pitching four metaphor-heavy options): *"hate all of these our marathon galaxy index was cool and innovative think like that man"*

The t1–t13 Ableton DAW was information-dense but read as a spreadsheet — galaxy is doing the heavy lifting for "wow", tracks needed a 3D scene of its own with the same typographic vocabulary. **TRACK CITY** is the answer the user picked from a second pitch round: every track is a tall 3D word-skyscraper in a void, arranged in a Manhattan grid keyed by year. Same glitch shader as the galaxy's titles runs on every face. Click a tower → camera flies to it + audio plays.

**New file**: [js/tracks-city.js](../../js/tracks-city.js). Three.js module, registers `window.TracksDaw` (same global, same `{init, destroy, setFilter, setQuery, onTrackChange}` interface) so `bootTracksDaw()` in index.html didn't need a single change.

**The scene**:
- **Towers**: one per track. BoxGeometry, height tier-keyed (featured ~60-72u, new ~44-54u, archive ~28-38u), width ~5u, slight per-tower randomness so the city looks built rather than generated.
- **Texture**: portrait canvas (256×1024) per track. Background is a vertical dark gradient + faint horizontal "floor" rules (14 evenly-spaced 1px lines — reads as building windows from a distance). Title is `ctx.rotate(-Math.PI/2)`'d so it runs bottom→top on each vertical face in 900-weight Space Grotesk, auto-scaled to fit.
- **Shader**: `TOWER_FRAGMENT` is a tighter port of the galaxy's `TITLE_FRAGMENT` — block-row displacement, RGB chromatic-split, scanline modulation, occasional row dropouts, global `uHueShift` so each tower's tint drifts through the spectrum over time. Adds `uPlaying` uniform (the currently-playing tower glows brighter + sways slightly + emits a ground-plane halo).
- **Layout**: tracks sorted newest→oldest, grouped by year. Each year is a 4-column block, rows = ceil(yearTracks / 4). Towers spaced 13u apart, 18u street gap between year blocks. A faint translucent year-number plane sits behind each block. Camera spawns at z=120 looking toward -z so newest year is closest.
- **Ground**: GridHelper (1200×1200, 60 divisions, dark blue lines) + dark plane underneath. Starfield of 1400 points scattered in a high-altitude hemisphere.

**Navigation**:
- Drag (pointer) = yaw + pitch (clamped ±π/2).
- WASD / arrows = forward/back/strafe. Shift = sprint (2.2× speed). Q/E = yaw.
- Wheel = dolly along facing direction.
- Click a tower (no-drag heuristic: cumulative drag-pixels < 6) = cinematic fly-to (1.1s easeOutCubic to a viewing pose just south of the tower) + `ctx.onPlay(idx)`.
- Camera clamped: y in [2.5, 220], z in [-1400, 220], x in [±600].

**HUD**:
- Top-left: "CANTMUTE / TRACKS" + track count + build chip.
- Top-center: search input (filters by title + tag substring).
- Top-right: filter chips (ALL / NEW / FEATURED) — same URL contract as before (`/tracks/new` for NEW, `/tracks` otherwise).
- Bottom-left: navigation hints (drag/WASD/shift/click).
- Bottom-center: transport pill — `‹ ▶ ›` + track title + 200px seek bar + time. Hooks `ctx.onPrev/onTogglePlay/onNext/onSeek` exactly like the old DAW.

**Audio**:
- Reuses the cached `audio.__floorAnalyser` from `js/player.js` (no second AudioContext). Bass = sum of bins 2..9, smoothed with EMA(0.18), scaled ×0.5.
- Bass feeds every tower's `uBass` uniform (subtle shimmer + glitch amplification). Bass × playing-tower boost adds noticeable sway + halo bloom on the active tower only.

**Index.html change**: bottom-of-body dynamic script tag flipped from `/js/tracks-daw.js` → `/js/tracks-city.js` and given `type='module'` (needed for the `import` of `three` from the importmap). Comment updated. No change to `bootTracksDaw()`, no change to `tv-on` body class handling.

**Build constants + revert**:
- `js/builds/tracks.js` bumped t13 → t14.
- `js/tracks-daw.js` left intact as the revert path. To roll back: flip the script src + drop `type='module'` in index.html.

**Files**: NEW `js/tracks-city.js` (~770 lines). Edited `index.html` (one script tag), `js/builds/tracks.js` (t13→t14), `docs/tracks/FILE_MAP.md` (rewritten scope/architecture sections).

Localhost only. No deploy yet — user iterates from here.

---

## t13 — 2026-05-10 — REVERT to t6 baseline (sexier DAW reconstruction)

> "terrible and ugly why the fuck would u do that and deviate so far away from what we had"

After t7-t12 spiraled through five aesthetic pivots (FL 2005 metal → FL 2026 glass → generative covers → cassette tape → editorial strip-down → Cantmute italic serif) without landing, reverted to the **t6 state** by manual reconstruction (no git — t1-t12 was all uncommitted).

**Restored**:
- Charcoal palette vars in `.daw-root` (`--daw-bg #131316`, `--daw-panel #1a1a1d`, `--daw-line #34343a`, `--daw-accent #ff7a3d`).
- Topbar charcoal gradient, transport with subtle button gradients (orange play button, no FL-green / no LCD-cyan).
- Brand LED + statusbar LED back to red record-dot (was glowing green pill in t8+).
- Tabs back to orange underline + recessed glow (was 1px lime in t12).
- Transport buttons back to subtle 2-stop gradient with orange play (was beveled steel t7, then green-armed coral t8, then black-on-acid-lime t12).
- LCD time → plain mono color on charcoal (was cyan-glow LCD).
- Meters back to original green→amber→red gradient on `#0c0c0e` ground.
- Bandbar/filter chips back to bordered pills (was glassy, then text-buttons with underline).
- Lane heads back to compact glassy charcoal panels with hue stripe + small mono title (was 64px italic serif "2026" in t12).
- M/S buttons back to plain bordered squares (no radial-gradient pills, no lime/coral fills).
- Lane backgrounds back to charcoal gradient.
- Stack back to `gap:2px padding:6px` (was 0/0 in t11/t12 row layout).
- Clip cells back to per-tier palette tint (`hsla` gradient + tier-driven border) with the **40px procedural waveform canvas** (real `_drawClipWaveform` envelope), `daw-clip-stripe` (5px hue band), `daw-clip-row` (▶ + title + meta), `daw-clip-bar` (2px red-to-white progress).
- `is-armed` state: red border + 22px halo + slow ease pulse (`daw-armed-pulse`).
- Master pane back to `daw-master-card` (palette-tinted radial wash + 2px hue stripe), `daw-spectrum` (170px container), `daw-master-grid` (4 dashed-divider rows), `daw-master-actions` (▾ details collapsible from t6, soundcloud, share).
- `paletteForCell` back to original tier values (featured s78/l62, new s70/l60, archive s28/l56) — was bumped to s90+ in t8.
- `_drawSpectrum` rewritten as smooth orange-on-dark gradient bars + center-line scope (was LED ladder t7, smooth lime t12).

**Removed (post-t6 cruft)**:
- Generative cover canvas (`_drawClipCover`) call-sites in init/resize.
- `_drawMasterCover` call in `onTrackChange`.
- Cassette HTML / cell ref `tapeEl` / `--bar-pct` write per frame.
- Editorial card HTML (`ec-accent`, `ec-body`, `ec-title`, `ec-meta`, `ec-play`).
- NP pane HTML (`np-hero`, `np-tag-row`, `np-progress`, `np-spectrum`, etc).
- Deck HTML (`deck-slot`, `deck-cassette`, `deck-reel`, `deck-tape`, `deck-lcd`, `deck-vu`, `deck-specs`).
- M/S delegation handler (visual click toggle from t7).
- Cinematic radial color washes on `.daw-root` background.
- Backdrop blur on bands.
- Runway-light conic-gradient `::before` on `.is-armed`.
- Special Elite typewriter font usage (still in font link, loads but unused — could prune later).
- Instrument Serif italic titles everywhere (still in font link, loads but unused).

**Kept (these were good fixes that weren't aesthetic experiments)**:
- t2 black-screen fix (`.daw-root` width/height explicit).
- t4 miniplayer hide on `/tracks` (in index.html `renderMiniplayer`).
- t5 Discography Tape arrangement view (`_buildArrangement` rewrite, year-time-positioned blocks with waveforms, sqrt-scaled gaps).
- t5 dense-session column fix (`flex-shrink:0` on `.daw-clip`).
- t5 killed-legacy-topbar global hide.
- t6 inline ▾ details panel in master pane (collapsible notes/credits/file/permalink — the actual t6 feature).

`.daw-clip-cover`, `.ec-*`, `.cas-*`, `.np-*`, `.deck-*`, `.daw-master-hero` etc are explicitly hidden via `display:none` so any leftover DOM from cached old JS won't show — but the actual JS no longer emits them.

Files: `js/tracks-daw.js` (`_buildCell` HTML + cell ref struct + master shell HTML + `_updateMasterCard` + `_updateTransport` + animate-cells loop + `_drawSpectrum` + `paletteForCell` + init/resize call sites + M/S handler removed), `index.html` (palette vars + topbar/transport/tabs/brand-LED/LCD/meters/vol/bandbar/filter-chips/lane-bg/lane-head/M-S/stack/clip-cells/master-card/spectrum/grid all reset to t6 styles + post-t6 classes hidden), `js/builds/tracks.js` (t12 → t13), `docs/tracks/FILE_MAP.md`.

Localhost only. No deploy. **Stopping here — direction now comes from you.**

---

## t12 — 2026-05-10 — Cantmute Editorial: Instrument Serif italic titles, matte black, single acid-lime accent

> "/plugin install frontend-design@claude-plugins-official … pls use this to somehow make something interesting cool DAW inspired music portfolio highlighting my songs"
> (the slash command isn't surfaced in this VSCode session's skill registry, but the philosophy guidance — fight generic AI defaults: no Inter/Roboto/Arial, distinctive typography pairs, intentional motion, bold direction — is the lever I needed)

The previous direction was technically clean but fundamentally generic — Space Grotesk + safe gray-on-navy + Inter-style letterforms read as "AI default startup landing". Replaced with a real point of view.

**The direction: Cantmute Editorial.**
- **Distinctive typography pair**: **Instrument Serif** (italic display, free Google) for every title + **JetBrains Mono Italic** for technical meta. The italic serif is the signature — every track title reads as something a music critic would set.
- **One signature color**: acid lime `#cfff00`. Used once per surface, never decoratively. No per-track palette colors anywhere — the rainbow chaos is gone. Track identity comes from the title itself, not from being painted hot pink.
- **True matte black** `#000000` background, warm off-white `#f5f3ec` text (not pure white — pure white reads digital, off-white reads paper).
- **Asymmetric tier sizing**: featured cells are dramatically taller (152px, 48px italic title), new are standard (104px, 30px upright title), archive are condensed (72px, 20px dimmed title). Hover *italicizes* the title and slides the card right by 8px.
- **Intentional motion**: every transition uses `cubic-bezier(0.16, 1, 0.3, 1)` — modern smooth ease-out — not stock CSS easing. Hover/active states are 250-350ms.

**Cells.** No more cards — they're table rows now. Hairline `rgba(245,243,236,0.07)` dividers between rows. A 2px vertical accent tick on the left grows from 18px tall to 60% on hover, turning acid lime. Hover slides padding-left from 22px to 30px (subtle, intentional). Title is the hero — Instrument Serif. Meta below in mono caps. Hover reveals "▸ PLAY" text on the right (no button shape, just text). Armed state: lime accent fills full height, title turns lime + italic, "❚❚ PLAYING" replaces "▸ PLAY".

**Year columns.** Headers became HUGE editorial display numbers — 64px Instrument Serif italic ("2026"), with `13 CLIPS` mono-caps sub. No background, no chrome, no stripe. Just confident typography. Lane width bumped to 280px so titles get room to breathe.

**Now Playing pane.** 72px italic serif title — *gigantic*, dominates the pane. 2px lime accent on the left edge with a soft glow. Tag row uses tier-based color (FEAT/NEW go lime, ARC stays muted). Progress bar is 1px hairline, lime fill. Spectrum is now 60px tall, single acid-lime gradient (no more per-track tinting). Spec rows have 9px padding and the same hairline dividers. Lane width 440px so the 72px title can fully unfurl.

**Other surfaces.** Topbar / transport / lane heads / master / bandbar / statusbar all set to `#000` flat. Tab underline trimmed to 1px lime, no orange glow halo. Filter chips already text-buttons with lime underline (kept from t11). Spectrum drawer rewritten — single acid-lime gradient instead of per-track hue.

**Killed**:
- Per-track jewel-tone palette colors on cells (the rainbow grid)
- Space Grotesk on titles (replaced everywhere with Instrument Serif)
- Backdrop blur on bands (over-engineered, just use flat black)
- Card backgrounds, rounded corners on cells, 1px borders (cells are rows now)
- All per-channel hue tinting in spectrum
- LCD cyan glow style — color is one (lime), not two (lime + cyan)

What stays from t11: tier sizing concept (just more aggressive), one-accent philosophy (just chose a bolder accent), spec rows + details panel + spectrum order, transport at top.

Files: `index.html` (Instrument Serif font added; root palette swapped to true-black + acid-lime; clip card CSS replaced with editorial row; lane head with HUGE display number; master pane with 72px italic serif; topbar/transport/tabs flattened to black with lime underlines), `js/tracks-daw.js` (`_drawSpectrum` rewritten — single acid-lime gradient, no per-track hue), `js/builds/tracks.js` (t11 → t12), `docs/tracks/FILE_MAP.md`.

Localhost only. The `frontend-design` plugin command isn't surfaced as a skill in this VSCode session — applied the philosophy by hand.

---

## t11 — 2026-05-10 — Strip-down: editorial cards, type-forward, single accent, no decoration

> "this looks so fucking terrible bro cmon" → after I asked, "ship to localhost dont deploy to cloudflare"

After three failed metaphor pivots (FL 2005 metal, FL 2026 glass, cassette tape), stopped trying to invent a visual story and committed to **restraint**. Every decorative system stripped. Type does the work. Color is one accent.

**Cells.** Each `.daw-clip` is a clean dark rectangle (`#141923`, 1px subtle border, 8px radius). Inside: a 3px palette-colored accent bar on the left edge (4px when armed, with a soft glow), and a body holding the title (Space Grotesk 22px, 28px featured, 17px archive — lowercase, white, tight letter-spacing) plus a single mono meta line (`TRK.### · TIER · MM.DD.YYYY`). Launch button is a 32px circular `▶` that materializes on hover at the right edge — invisible at rest. Hover lifts the card 1px and lightens the bg slightly. Armed state tints the bg with a faint left-side wash in the channel hue. That's it.

**Master pane.** Renamed `NOW PLAYING` (was DECK 01). Big 36px Space Grotesk title is the hero, single 3px palette accent on the left, small tag pill ("FEAT" / "NEW" / "ARC" — colored only by tier), `TRK.###` slot reference, then year + tags meta. Underneath: thin 3px progress bar with right-aligned tabular-num time, then 80px restrained smooth-bar spectrum, then 4 spec rows with hairline dividers, then the liner-notes panel collapsed by default.

**Killed everything decorative**:
- Cassette shells, paper labels, spinning reels, magnetic tape strips, screw-dot pseudo-elements
- Deck slot, LCD bar, VU label, brushed-metal panels, brass spec plates
- FL 2026 inheritance: 3-stop button gradients, pulsing rotating runway lights, generative cover art, glowing channel borders
- Cinematic radial color washes on the root background — flat `#0c1018` only
- Chunky filter chip pills with the orange recessed glow — now just text-buttons with a 1px accent underline on the active one
- Lane head stripe + JetBrains-mono micro labels — now bigger Space Grotesk year numbers

**What's left = what matters**:
- Year columns (organize the catalog)
- Card per clip (title + meta + accent + hover play)
- Now Playing pane (title + meta + spectrum + specs + details)
- Transport at top (existing FL-clean buttons + LCD time + meters)

The clip cell tier sizing is preserved: featured 116px (28px title), new 92px (22px), archive 72px (17px). Visual rhythm comes from type size and accent intensity, not from giving each tier different chrome.

Special Elite font reference is left in the head `<link>` (already loaded once), but the cassette-only rules that used it are now `display:none`d alongside the other dead classes (`.cas-label`, `.cas-window`, `.cas-reel`, etc) — kept for one revert cycle in case any of this needs rolling back. Will purge in the next clean-up pass.

Files: `js/tracks-daw.js` (`_buildCell` HTML → editorial card; master shell HTML → minimal NP pane; `_updateMasterCard` rewrites for `np-tag`/`np-num`/`np-title`/`np-meta`/`np-accent`; `_updateTransport` writes `np-fill`/`np-time` instead of deck/lcd; per-frame `--bar-pct` write removed), `index.html` (cassette CSS block replaced with editorial card; deck CSS block replaced with minimal NP pane; lane head simplified to bigger Space Grotesk year + smaller mono sub; filter chips → text + underline; root gradient washes removed), `js/builds/tracks.js` (t10 → t11), `docs/tracks/FILE_MAP.md`.

Localhost only. No deploy.

---

## t10 — 2026-05-10 — Cassette tape pivot: every clip is a labeled cassette with spinning reels, master pane is the deck

> "dont deploy only localhost changes but im not liking this we can change the entire look and feel try again doint slop it make it all make sense but cool fun interesting interactive"

Full pivot away from generative-cover collage toward one coherent metaphor: **cassette tape culture**. Picked because it matches the indie/grunge/lo-fi catalog (titles like "rusk", "shoebox", "fucking up his liver", "sickboi"), gives every clip a recognizable physical form, and turns playback feedback into a tactile interaction (reels spin) instead of stacked decorative effects. Localhost only — no push.

**Cells became cassettes.** Each `.daw-clip` is now a colored plastic shell:
- Tier-driven shell color via existing `paletteForCell()` HSL — featured 116px tall, new 96px, archive 76px, all 226w wide.
- Two screw-dot pseudo-elements (`::before` / `::after`) at the top corners for tactile detail.
- A paper LABEL on the top half — cream radial-dot grain over a `#f3e8c7→#e9dcb1` gradient, written in **Special Elite** (Google Fonts typewriter face, added to the existing font link), with the title big and casual + a `TRK.### · SIDE A · MM.DD.YYYY` meta line in JetBrains Mono below.
- A tier STAMP in the top-right corner of the label (`FEAT` / `NEW` / `ARC`) styled like a release sticker — slightly rotated, with red/green/sepia paint per tier.
- A WINDOW cutout on the bottom half — dark recessed rectangle showing two spoked REELS and a magnetic tape strip between them. Reels are pure-CSS (`repeating-conic-gradient` for the wedge spokes + radial-gradient hub), 26-32px diameter scaled by tier.
- The launch button (`▶`) is a small low-opacity stamp in the top-left of the label; hover bumps it to 100% + 1.15× scale.
- A 2px hue-tinted progress bar at the bottom edge for fine playback position; fills with channel color while playing.

**The reels actually spin during playback.** `.cas-reel` carries `animation: cas-reel-spin 4s linear infinite paused;` by default; `.daw-clip.is-armed .cas-reel { animation-play-state: running; }` flips it on. Inside the magnetic tape strip, a `::after` pseudo-element with width driven by `--bar-pct` CSS var grows left-to-right as the track plays, like the tape literally winding from one reel to the other. The animate() loop sets `--bar-pct` on each cell's tape element every frame.

**Master pane became a tape deck.** Total rebuild of the master shell HTML and CSS:
- Title is now `DECK 01 · 2 ▸ R · 44.1 kHz · NORM` (deck spec sheet vibe).
- A `.deck-slot` chrome-rimmed enclosure holds the inserted cassette graphic, which is the same cassette idiom rendered at large size (148px tall) and re-tinted to the playing track's palette via CSS vars. Title in 18px Special Elite, slot label tag, big 42px reels in the window.
- Reels in the deck spin via `.deck-slot.is-spinning` toggled per frame from `_updateTransport`.
- An `LCD strip` below the slot — cyan progress bar + monospace `00:00 / 00:00` time readout, all glowing on a near-black green-tinted ground.
- The spectrum got reframed as a `VU · L+R` meter inside a brushed-metal `.deck-vu` panel.
- The four spec rows (tier/tags/date/slot) became a "brass spec plate" with metallic gradient + dashed dividers.
- "details" became "liner notes" (collapsible panel unchanged below).

**Mechanics wiring.**
- `_buildCell` now emits cassette HTML; the cell ref dropped `coverCanvas` (added `tapeEl` instead).
- `_updateMasterCard` now writes `deck-tag`, `deck-title`, `deck-meta`, and sets `--clip-h/s/l` on `#deck-cassette` so the inserted tape recolors per track.
- `_updateTransport` (per-frame) toggles `.deck-slot.is-spinning` on/off based on `audio.paused`, sets `--bar-pct` on the deck tape, and writes the LCD time + fill.
- The animate() per-clip loop now sets `--bar-pct` on each cell's `.cas-tape` so the wound-tape thread inside every cell tracks playback.
- All previous decoration removed: generative cover canvases, runway-light conic borders, hero cover canvas, master-cover overlay, etc. — those are all out so the cassette metaphor reads cleanly without competing visual systems. `_drawClipCover` and `_drawMasterCover` are still defined but become no-ops (their canvas refs are `null`); leaving them in place because they're inert and removing would require touching init/resize wiring that would otherwise be churn.

Files: `js/tracks-daw.js` (cassette cell HTML + deck shell HTML + `_updateMasterCard` deck-element wiring + `_updateTransport` reel/tape/LCD updates + per-frame `--bar-pct` on cells), `index.html` (Special Elite font added; entire `.daw-clip-*` CSS block replaced with cassette body/label/window/reels/tape; entire `.daw-master-*`/`.daw-spectrum`/`.daw-mg-*` block replaced with deck slot/LCD/VU/specs), `js/builds/tracks.js` (t9 → t10), `docs/tracks/FILE_MAP.md`.

Not deployed — localhost only per request.

---

## t9 — 2026-05-10 — Living Studio: generative cover art per clip, hero master, runway-light playing border, tier-sized cells, cinematic washes

> "still doesn't look that great… just looks like a compilation of waveforms and shit. Can we make it look a little bit cooler a little bit more interesting? what else make it more creative yknow look feel etc"

t8 was clean but monotonous — every clip rendered as the same shape, same height, same waveform-on-tinted-bg. Killed the "wall of waveforms" by giving each track a unique procedural visual identity, breaking the layout into tiers, animating the playing clip, and making the master pane an actual focal point.

**Generative cover art (`_drawClipCover`).** Replaced the per-clip waveform thumbnail with a procedural visual seeded by the title hash. Three styles cycled by `seed % 3`:
- **Aurora** — 4-7 stacked translucent ellipse bands at random angles, rendered with `lighter` composite for additive glow. Looks like northern lights / watercolor wash.
- **Bloom** — central radial gradient blob + 3-6 secondary smaller blooms with random hue shifts. Looks like ink in water / lens flare.
- **Mosaic** — palette-tinted grid of cells (8-11 cols × 3-5 rows) with brightness modulated by hash + distance-from-center falloff + faint horizontal scan overlay.

Every cover is palette-aware (hue/sat from the existing `paletteForCell` per-tier coloring), so the channel identity is preserved while each clip becomes a unique tiny artwork. ~104 tracks split roughly 35/35/35 across the three styles — cohesive but never repetitive.

**Tier-differentiated cell heights.** Featured clips get a 96px cover, new gets 78px, archive gets 54px. Same width, different visual weight. The session grid now reads with rhythm — featured clips are hero cards, archive clips are condensed reference. CSS-only via `.daw-clip[data-tier="..."] .daw-clip-cover { height: ... }`.

**Hero cover in master pane.** Added a square (`aspect-ratio:1/1`) `.daw-master-hero` block at the top of the master containing a `<canvas id="daw-master-cover">` that re-runs the cover renderer at large size for whatever track is currently armed. Vignette frame on top of the cover for depth, "NOW PLAYING · TRK.###" label sits in the top-left corner with a deep text-shadow. The master card body below shrunk to just title + meta. Idle state (nothing armed) shows a soft cyan/orange drift wash so the master never looks dead. `_drawMasterCover` is invoked from both initial mount and every `_updateMasterCard` call, so it refreshes per track change.

**Runway-light border on the playing clip.** `.daw-clip.is-armed::before` is a CSS conic-gradient with a bright spot at ~78-84% angle, masked to the inside edge of the cell using the standard `linear-gradient + content-box mask + xor composite` ring trick, then animated with `transform:rotate(360deg)` over 2.6s. The bright spot color is `hsl(var(--clip-h), 95%, 78%)` so it picks up the channel hue. Sweeps continuously around the active clip's border like a marquee runway light. Stays inside `overflow:hidden` so the rotation doesn't bleed.

**Cinematic background washes.** Replaced the flat `var(--daw-bg)` root background with three stacked radial gradients (cyan top-left, orange bottom-right, magenta center-faint) layered over the navy base. Subtle but adds depth to empty regions of the grid — feels like the studio is lit by colored monitor glow instead of being a flat dark void.

**Spectrum still re-tints to the active channel** (carried over from t8). Combined with the hero cover above it now re-rendering per track, the entire master pane swaps identity every time you launch a new clip — cover, color wash, spectrum hue, accent stripe — they all move together.

The cell HTML changed (canvas swapped from `.daw-clip-wave` to `.daw-clip-cover`, stripe stayed at top as the channel-rack rail) and the cell's stored ref renamed `waveCanvas → coverCanvas`. Arrangement view still uses `_drawClipWaveform` for its block thumbnails — out of scope for this pass.

Files: `js/tracks-daw.js` (`_drawClipCover` + `_drawMasterCover` added; `_buildCell` HTML restructured; init / resize / `onTrackChange` re-routed to draw covers; master shell HTML expanded with hero), `index.html` (`.daw-clip-cover` tier-sized + `.daw-clip-bar` channel-tinted + `.daw-clip.is-armed::before` runway light + master hero block + `.daw-root` cinematic washes), `js/builds/tracks.js` (t8 → t9), `docs/tracks/FILE_MAP.md`.

---

## t8 — 2026-05-10 — FL 2026 reskin: deep navy glass, jewel-tone channels, glowing meters, no chunky bevels

> "still ooks liie an oldschool daw and not a beautiful inspired by fl studio 2026"

t7 was FL circa 2005 — chunky steel-gray bevels, hardware-LED segments, faux-metal everything. Re-tuned to the modern FL look: deep dark navy base, glassy translucent panels with backdrop-blur, vivid jewel-toned channels with soft outer glows replacing bevels, smooth gradient meters with halo glow.

**Palette inversion.** Dropped the steel grays. Base back to deep navy: `--daw-bg #0c1018`, panels `#141923`, hairline separators are now `rgba(255,255,255,0.06)` (a single tint over the dark) instead of solid `#1c1e22`. Removed `--daw-bevel` / `--daw-bevel-deep` tokens entirely; replaced with `--daw-glow-soft`, `--daw-glow-orange`, `--daw-glow-cyan` — modern feel reads as light radiating from the surface, not light reflecting off chunky metal. LCD shifted from acid-green to a softer cyan (`#6ee7ff`) with a wide, gentle text-shadow.

**Glassy bands.** Topbar / transport / lane heads / bandbar / statusbar / master pane all now use `rgba(20,25,35,0.85-0.92)` with `backdrop-filter:blur(14-18px)` so they read as floating glass rather than rack panels. Master pane keeps the orange left edge but the bevel highlight became a soft 1px tinted border + an inset cyan glow.

**Buttons rethought.** `.daw-tx-btn` is now `rgba(255,255,255,0.04)` with a 1px white-alpha border, 6px rounding, and a clean scale-down on click — no gradient stack. Play button is bright FL-green (`#6efeb1 → #36c878`) with a strong outer glow (no border bevel); armed state is bright pink-red with the matching glow. Tabs lost their inset shadow; active tab is now a 2px orange underline with `box-shadow:0 0 12px var(--daw-accent)` halo. Filter chips are translucent pills with the active state glowing orange instead of recessed amber.

**M/S buttons → glow pills.** Round LED radial-gradients replaced with subtle 5px-rounded pills. Off state is barely visible. Click-to-toggle (M lights bright pink, S lights bright green) — no skeuomorphic socket, just the color radiating from the button.

**Channel saturation bumped.** `paletteForCell()` got more aggressive: featured `s:90→92, l:66→64`, new `s:74→82, l:62→62`, archive `s:16→55` — even the oldest clips now read as a real color identity instead of muddy grey. This is the single biggest visual upgrade because it makes the year columns immediately scannable as a rainbow of channels.

**Spectrum rewrite (again).** The 22-segment LED ladder was the most "old DAW" element of t7. Replaced with 56 sleek vertical bars: rounded tops, smooth `cyan-low → channel-tinted-mid → bright-orange-top` gradient, white gloss highlight on the top edge, peak-hold dots, and a soft cyan floor-glow under the whole spectrum. **The hue is pulled live from the currently-armed clip's palette** — when a different track plays, the entire spectrum re-tints to that channel's color. That's the feature t7's static green/amber palette couldn't do.

Lane backgrounds dropped to deep navy `#0e1320 → #0a0e16`. Clip cells got 6px rounding, no chunky bevel — just a clean translucent gradient and a 1-pixel hue-tinted border. Clip launch buttons (`▶`) ditched the inset gradient for a single flat tint with a soft halo glow on hover.

Files: `index.html` (DAW palette + topbar/transport/buttons/LCD/meters/tabs/lanes/master/bandbar/statusbar/LEDs/clip cells re-styled), `js/tracks-daw.js` (`paletteForCell()` saturation bump + `_drawSpectrum()` smooth-bar rewrite with per-track hue tinting), `js/builds/tracks.js` (t7 → t8), `docs/tracks/FILE_MAP.md`.

---

## t7 — 2026-05-10 — FL Studio reskin: steel-gray panels, beveled controls, LCD time, LED-segmented spectrum

> "can we make the daw cooler more resminisct of FL studio rather than its current ableton like state?"

Aesthetic pivot from Ableton-charcoal-minimal to FL-Studio-steel-gray-skeuomorphic. Layout structure (year-keyed lanes for session, Discography Tape for arrangement, master pane on right) is unchanged — only the visual treatment moved.

**Palette retune.** `.daw-root` vars shifted from charcoal (`--daw-bg #131316`, panels `#1a1a1d`) to lighter steel grays (`--daw-bg #2c2f34`, panels `#3a3d43`) so panels read as raised metal rather than inset darkness. New vars added for FL specifics: `--daw-led-green #66ff7a`, `--daw-led-amber #ffae3d`, `--daw-led-red #ff3d3d`, `--daw-lcd-bg #0c1408`, `--daw-lcd-text #5cff95`, plus reusable `--daw-bevel` and `--daw-bevel-deep` shadow tokens.

**Beveled controls everywhere.** Transport buttons (`.daw-tx-btn`), filter chips (`.daw-bb-chip`), volume slider thumb, and clip launch buttons (`.daw-clip-btn`) all got 3-stop linear gradients (top highlight → mid body → bottom shadow) + 3px border-radius + inset bevel shadow + hard `#000` borders for the carved-into-metal look. Pressed state inverts the gradient and adds an inset shadow. Play button is now bright FL-green at idle and bright-red when armed (was orange-on-orange).

**LCD time readout.** `.daw-tx-time` is now a green-on-near-black LCD: deep `#0c1408` background with horizontal scanlines, `#5cff95` digits with `text-shadow:0 0 4px rgba(92,255,149,0.65)`, recessed inset shadow makes it look set into the metal.

**LED-segmented spectrum (JS rewrite).** `_drawSpectrum` was 64 smooth-gradient bars; now 32 wider bars built from 22 discrete LED segments each. Color band: bottom 60% green, middle 25% amber, top 15% red — classic VU-meter ladder. Added attack-fast/release-slow smoothing and peak-hold dots that fall after ~18 frames. Each lit segment gets a 1px white highlight on top so the LEDs read as having gloss. The center-line scope was removed — too smooth/curvy for the LED idiom.

**LED indicators.** `.daw-brand-led` (top-left) and `.daw-st-led` (statusbar) became radial-gradient bulbs that glow bright FL-green when audio plays (was solid red dot). M/S buttons on every lane head turned into circular rack LEDs — clicking M lights it red, S lights it green, and a tiny `_wireEvents` delegation on `.daw-tinybtn[data-toggle]` toggles `is-on` (visual only — no audio routing yet, but the button feels alive).

**Topbar / transport / statusbar / bandbar / lane backgrounds** all swapped to multi-stop steel-gray gradients with `inset 0 1px 0 rgba(255,255,255,0.06-0.10)` highlights and matching `inset 0 -1px 0 rgba(0,0,0,0.40)` bottom shadows, giving every band a subtle "rack panel" 3D feel. Master lane keeps its 3px orange left border but now also has a faint orange inset highlight on its leading edge.

Files: `index.html` (DAW palette vars + topbar/transport/buttons/LCD/meters/lanes/bandbar/statusbar/LEDs/clip cells re-styled), `js/tracks-daw.js` (`_drawSpectrum` rewritten as LED segments + `_wireEvents` M/S LED toggle delegation), `js/builds/tracks.js` (t6 → t7), `docs/tracks/FILE_MAP.md`.

---

## t6 — 2026-05-10 — Inline ▾ details panel in master pane (no page nav)

> "i dont like that details brings u to another separate page lets just have it as collapisble thing in the sidebar weve made"

The `▸ details` row in the master pane was a `<a href="/t/<slug>">` that yanked you to a separate page. Converted into an inline collapsible — clicking now expands a panel underneath the row showing notes (description), credits if present, file path, and permalink (click to copy). Arrow rotates `▸ → ▾` and `aria-expanded` toggles. The panel inherits the master pane's charcoal-on-near-black palette with orange `// SECTION` labels matching the rest of the DAW chrome.

The standalone `/t/<slug>` route is left intact — anyone arriving via a shared link still gets the full-page render — but the master pane no longer steers people there. Permalink button at the bottom of the panel exposes the same URL one click away.

Files: `js/tracks-daw.js` (shell HTML for the panel, click wiring in `_wireEvents`, population in `_updateMasterCard`), `index.html` (`.daw-ma-panel` / `.daw-ma-panel-row` / `.daw-ma-link` styles), `js/builds/tracks.js` (t5 → t6), `docs/tracks/FILE_MAP.md`.

---

## t5 — 2026-05-10 — Tracks UX modernization: dense lanes, killed legacy topbar, DAW-skinned detail page, Discography Tape arrangement

> "arrangement kind of sucks, could chang it to something cooler and on session, ther more tracks a year has, the harder it gets like the wrapping or shrinking oir whatever"
> "also when i clikck into a song and click details it brings up the older theme older wbeiste stuff can we update so everything is up to date"
> "and the top headbar also needs to be updatred removed or adjusted for our tracks and newest stuff"

Four modernization passes bundled because they're the same conceptual ask: "make /tracks and everything you can reach from it feel like one cohesive DAW."

1. **Session column density fix.** `.daw-clip` had no `flex-shrink:0`, so the moment a year column had more clips than fit (2022 with 33 clips, 2026 with 13), flex shrinking compressed every clip vertically — title-only stripes with no waveform, unreadable. Added `flex-shrink:0`. Now clips stay full-size and `.daw-stack`'s existing `overflow-y:auto` actually scrolls the column. No more wrapping pain in dense years.

2. **Killed the legacy global topbar.** The "kani · TRACKS · FEATURED · ALL TRACKS · NEW · WORLD · EXPLORE · search" header was Beta-Decay-era catalog navigation, redundant on every modern view: galaxy has its own player chip + nav, DAW has its own brand+search+tabs, detail/playlist pages each have their own back-link. `header.topbar { display:none }` globally + `main { padding-top:24px }` to recover the spacing. Existing `body.tv-on header.topbar { display:none }` rule kept (harmless, documents intent).

3. **Track detail page (`/t/<slug>`) re-skinned in DAW palette.** The old `viewTrack()` rendered "— INCOMING SIGNAL —" magenta kicker, glassy panels, big pink "PLAY" button — pure Beta Decay holdover. Rewrote in `.detail-wrap` scoped vars (`--d-bg #0e0e10`, `--d-accent #ff7a3d`, `--d-line #2a2a30`) matching DAW charcoal/orange/monospace. Hero is grid `380px 1fr`, kicker is now an animated LED dot + `CLIP INSPECTOR · TRK.###`, panels have a 2px orange left border like the master pane, stats use uppercase mono labels with tabular-num values. Copy updated: "play" → "launch", "// signal info" → "// clip info", "// listen elsewhere" → "// external", "more from kani" → "more clips". Back-link goes `/tracks` (back to session), not `/`. Class names unchanged so no JS rewires needed — only the visual treatment moved.

4. **Arrangement view rebuilt as "Discography Tape".** Old arrangement had 5 horizontal tier-keyed lanes (FEATURED/NEW/HARD/CHILL/ARCHIVE) with thin 70-130px text-only bars scattered by date — lots of empty space, hard to read, no waveforms. New version: single horizontal row, all dated tracks sorted oldest → newest, each track is a 200×156 block with the same procedural waveform renderer as session clips, slot number + tier + title + date stacked inside. Gaps between blocks are sqrt-scaled days-since-previous (clamped 4-40px) so a 6-month gap reads visibly larger than a 1-week gap without a 5-year break dominating the layout. Year markers are big orange labels at the top with vertical accent lines descending through the row. Auto-scrolls to the most recent block on load. Per-block progress bar fills along the bottom edge of the playing block, and the white playhead sweeps across it. Click any block to launch.

Files: `js/tracks-daw.js` (`_buildArrangement` rewrite + arrCell barEl update in `animate`), `index.html` (legacy `header.topbar` hide + `.daw-clip` flex-shrink + `.detail-*` palette swap + `viewTrack()` copy + `.daw-arr-*` rewrite), `js/builds/tracks.js` (t4 → t5), `docs/tracks/FILE_MAP.md`.

---

## t4 — 2026-05-10 — Hide bottom miniplayer on /tracks (DAW has its own transport)

> "on tracks, we have the media player at the bottom. we can remove it since we have another one within the daw itself"

The global `#miniplayer` was still appearing at the bottom of `/tracks` whenever a clip played, stacked under the DAW transport. The CSS rule `body.tv-on .miniplayer{ display:none }` was already there, but `renderMiniplayer()` sets `mp.style.display='flex'` inline whenever a track is current, and inline styles beat the stylesheet — so the CSS rule never won.

Fix: mirrored the existing Galaxy-mute pattern. `renderMiniplayer()` already early-returns with `display:none` when `body.classList.contains('mw-on')`; added the same check for `tv-on` directly under it. One source of truth (the function that owns the inline display) now respects both immersive scenes.

Files: `index.html` (renderMiniplayer guard), `js/builds/tracks.js` (t3 → t4), `docs/tracks/FILE_MAP.md`.

---

## t3 — 2026-05-10 — Sexier DAW: hero master + real waveforms + tighter chrome

> "i want you to focus on tracks, you know how we made it a daw. well theres some sizing and sapce issues and im wondering how u could overall improve nad make it sexier"

Five space/density passes against the b206-era DAW. Goal: less HUD chrome, more visual personality per clip, master pane that actually reads as the hero.

1. **Waveform thumbnails — the big one.** Replaced the 22px stroked-vertical-bar `_drawClipWaveform` with a 40px mirrored gradient envelope: title-seeded LCG generates a stable amplitude curve (arc + two mid-freq sines + grain), filled top + bottom with palette-derived gradients, edge-traced with a brighter highlight stroke so the silhouette reads at thumbnail size. Each clip now has a distinct, recognizable waveform shape instead of looking like static.

2. **Hero master pane.** Lane width 300 → 400px (responsive: 340 @1100, 300 @900, 260 @640). Spectrum 120 → 170px. `daw-mc-title` 18 → 26px. Master pulled forward visually via `box-shadow:-14px 0 36px rgba(0,0,0,0.50)` and 3px accent left border. New: `.daw-master-card` is tinted live from the currently-playing track's palette via `--mc-h/s/l` custom props (set in `_updateMasterCard`) — radial gradient bleed from top-left + a 2px tinted bar on the card's left edge that glows in the playing track's color.

3. **Chrome compression.** Killed the 22px bottom status bar entirely (removed div from `_renderShell`, dropped from `daw-root` grid-template-rows in all three breakpoints). Lane heads: `min-height` 54 → 40, padding 10 → 6, title 13 → 11.5, sub 9.5 → 8.5, stripe 36 → 26. M/S buttons fade to 45% opacity, full on lane hover. Net ~50px of vertical real estate handed back to clips.

4. **Tier rhythm.** `paletteForCell` saturation/lightness bumped for featured (s:78→90, l:62→66) and dropped hard for archive (s:28→16, l:56→50). New `[data-tier="featured"]` rule gives featured cells a soft hue-tinted outer glow + brighter border; `[data-tier="archive"]` desaturates the cell gradient further so featured genuinely pops.

5. **Removed `daw-clip-empty` slots** — the dashed 8px placeholders at the bottom of each stack read as visual scuffs, not Ableton-style affordances. Lanes end cleanly at the last real clip.

`_setStatus` calls left in place (they no-op when `#daw-st-msg` is absent — `if (el)` guarded), so call sites don't need touching.

Files: `js/tracks-daw.js`, `index.html` (inlined DAW CSS), `js/builds/tracks.js` (t2 → t3), `docs/tracks/FILE_MAP.md`.

---

## t2 — 2026-05-10 — Fix /tracks black screen (root collapsed to 0 height)

> "okay the page is a black screen like its dead"

`/tracks` rendered fully black. Console showed DAW boot succeeded — `init()` ran, root mounted, `_buildSession` completed with 104 cells — but the instrumented log reported `[daw] root mounted. rect = 1889 x 0`. The DAW root was getting full viewport width but zero height.

Cause: `.daw-root` was sized via `position:fixed; inset:0;` on a `display:grid` container with `grid-template-rows: 36px 56px 32px 1fr 22px;`. In some Chromium builds (Vivaldi included) that shorthand fails to derive an intrinsic height for the grid container, so `1fr` resolves to 0 and the explicit rows don't get a chance to expand the box.

Fix: replace the `inset:0` shorthand with explicit `top:0; left:0; width:100vw; height:100vh;` so the grid container has an unambiguous size to lay rows into. No JS change.

Files: `index.html` (the `.daw-root` rule), `js/builds/tracks.js` (t1 → t2), `docs/tracks/FILE_MAP.md`.

---

## t1 — 2026-05-09 — Tracks split-off (post-b242 migration starting point)

No code change to tracks-daw.js itself. Only the build-bookkeeping moved to per-scene files. See root [CHANGELOG.md](../../CHANGELOG.md) b242 for the migration entry.

State carried over from b241:
- Full Ableton-faithful SESSION + ARRANGEMENT views with sticky MASTER pane.
- Spectrum analyzer + L/R level meters wired to the shared `audio.__floorAnalyser`.
- Filter chips (`all/featured/new/hard/chill/grunge/vibe`) + keyboard nav + shareable `/tracks/new` URL state.
