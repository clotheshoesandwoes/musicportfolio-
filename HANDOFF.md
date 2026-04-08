# HANDOFF — cantmute.me (Kani music portfolio)

**For:** future Claude Code session continuing this project
**Last build:** b046 (2026-04-07)
**Read this BEFORE doing anything else** — it saves an entire conversation of context-building.

---

## 1. What this project actually is

**cantmute.me** is Kani's music portfolio, but built as an explorable 3D world instead of a tracklist page. The aesthetic intent has shifted multiple times — see section 5 for the current state and section 8 for the user's most recent feedback (which is "the art style is still wrong, we need to rebuild").

**Core interaction loop:**
1. Visitor lands on site → drops into the villa scene
2. Drags / RMB-drags / WASDs the camera around the property
3. Clicks an interactive prop (lambo, koi pond, recording console, piano, etc.)
4. A song-card pops up near the clicked prop with a play button + waveform
5. Press play → audio plays from R2

Steps 1, 2, 3, 4, 5 all work as of b045. The mansion is now ~22 interactive rooms across 2 floors + rooftop. **Click→card system is wired and working** since b026/b027/b028.

---

## 2. Tech stack — vanilla everything

- **No build step.** Pure HTML + JS + CSS served as static files.
- **Three.js** loaded lazily from `https://unpkg.com/three@0.160.0/build/three.module.js` on first villa view activation. ESM CDN.
- **Hosting:** Cloudflare Pages, deployed automatically from GitHub master.
- **Audio:** Cloudflare R2 bucket `cantmute-audio`, public URL `https://pub-5556ef4db74d499ba3f535afccf8c7be.r2.dev/`
- **Repo:** [github.com/clotheshoesandwoes/musicportfolio-](https://github.com/clotheshoesandwoes/musicportfolio-)
- **Local dev:** VS Code Live Server or `python -m http.server`. Audio works locally because of CORS rules allowing localhost.

**Views:** 4 total — terrain (2D canvas), deepsea (2D), neural (2D), **villa (3D, the hero)**. Default = villa.

---

## 3. The mandatory workflow (from CLAUDE.md)

The user has strict workflow rules in [CLAUDE.md](CLAUDE.md). Highlights:

- **Before writing code:** state what the user is asking for in your own words, list every file you'd modify, ask first if ambiguous or destructive or >5 files
- **Forbidden:** adding features the user didn't ask for, "improving" code while making other changes, multiple unrelated changes in one response, refactoring "while you're in there"
- **Always update** with every code change: `CHANGELOG.md` (entry at TOP, newest first), `FILE_MAP.md` (build number), `js/helpers.js` (`BUILD_NUMBER` increment, e.g. `b045` → `b046`)
- **Read before you write:** read FILE_MAP.md first, then recent CHANGELOG entries, then the actual file
- **Force push to main/master is destructive** — never do it without explicit user request
- **node --check is necessary but NOT sufficient** — see section 11 about TDZ errors

**One-word mode:** when the user says "yes," "do it," "go," "proceed," they're approving the most recent proposal — execute, don't repeat the plan.

**Commit messages:** the user has agreed I write commit messages. When they say "git commit," YOU run git, not paste the plan into a commit message.

**Big rewrites need ASKING.** Three mansion rebuild attempts (b025, b037, b039) tried iterating on the same wrong U-footprint before I finally STOPPED, asked the user to rethink, and got a real rebuild plan (b041 mega-mansion). Lesson: per CLAUDE.md "If a fix doesn't work after two attempts, stop. Read the entire relevant section top-down. Figure out where your mental model was wrong and say so."

---

## 4. Memory files

There are persistent memory files at `C:\Users\B4TTL\.claude\projects\c--Users-B4TTL-musicportfolio\memory\`:

- `MEMORY.md` — index of all memory files, always loaded into context
- `project_overview.md` — what the project is + the click→card vision
- `villa_vision.md` — house must be MUCH bigger, beach front + Miami back, click-target props plan
- `feedback_world_js_declaration_order.md` — TDZ gotcha for adding new mesh blocks
- `feedback_commit_means_push.md` — "commit so I can check" means commit AND push, don't make user ask twice
- `project_clickable_props_scope.md` — click→card targets are exterior props too, not just interior

**Always check these files when starting a fresh session.** They contain context that's not derivable from the code.

---

## 5. Current scene state (post-b046)

### Villa view ([js/world.js](js/world.js), ~3900 lines)

**Render pipeline (PS2+ era — see section 8 for "this needs to change"):**
- Custom 854×480 `WebGLRenderTarget` with `NearestFilter`, upscaled via fullscreen quad → "PS2+" chunky pixels
- PS2+ vertex jitter: clip-space xy snapped to 320×180 grid in custom shaders
- Custom 3-light shader (NOT three.js's built-in lights) — three point lights as uniforms (warm deck lantern, cyan pool glow, warm interior window). Distance falloff + N·L done manually in `pointLight()` helper inside the fragment shader
- Custom hemi sky fill + directional sun term inside the same fragment shader
- `FogExp2` (`0x382048` deeper purple-blue, density 0.0055) matched in PS2/pool/ocean/lagoon shader uniforms
- World-space noise hash + fake AO baked into the PS2 fragment shader (b036)
- Sky shader has sun disc + glow + flare + cloud bands (b044)
- Day/night cycle uniform `cycleUniform` oscillates 0..1..0 over 60 seconds (sunset → night → sunset)

**Post-process pipeline (b045 Tier 1 overhaul):**
- Chromatic aberration at the start (~2px split at corners)
- 13-tap bloom accumulation (8 inner + 4 outer ring)
- Sobel outline shader from depth buffer (~78% darkening on edges)
- Strong color grade: gamma 0.85, sat +45%, contrast +18%, split-tone (cool shadows / warm highlights)
- Faint scanlines (sin(vUv.y * 960) * 0.02)
- Animated film grain (uTime-driven, ±0.05)
- Bayer 4×4 dither into ~5 bits per channel
- Strong vignette (cool tinted)

**Mansion architecture (b041 mega-rebuild + b042/b043 room phases):**
- **Footprint: 56×28** (~3× the b025-b040 32×14 U-shape). One big single-volume shell, no more central + 2 wings + 2 drums.
- **2 floors + rooftop terrace**: ground floor `mansionH1=5`, upper `mansionH2=4.5`, roof at y=10.32.
- **3 walls (back + 2 sides)**, front fully open (no walls + no glass). Walk straight in from the colonnade.
- **Real walkable upper-floor slab** spanning the entire 56×28 (the user explicitly asked for "floors for second layer"). 11 internal structural columns supporting it, positioned to avoid existing room furniture clusters.
- **Front cantilever balcony** (52 wide × 3 deep) projecting forward from the upper floor at the roof level, with frameless cool-glass rail.
- **2 cylindrical corner drums** (radius 3, full mansion height) at the front-left + front-right corners. Cool glass band at the upper floor level. Curved silhouette on both ends.
- **Rooftop pavilion** (5×5×4 marble plinth + cube + glassMat front + cantilever canopy + 2 columns + 2 sconces). Carries `bell_tower` click→card target.
- **9-column front colonnade** spanning the entire 56-wide façade with horizontal cantilever eyebrow + warm cove glow strip on the underside.
- **Back archway** (open marble jamb + lintel + podium-colored void box) at center-back.
- **Garage zone** integrated into the ground floor at x=-28..-16. Yellow lambo on a marble showcase plinth at (-22, -9), LED accent strip on the back wall.

**Backward-compat aliases:** `villaCx`, `villaCz`, `centralW`, `centralD`, `centralH1` (= mansionH1 = 5), `wingW`, `wingH1` (= mansionH1 = 5), `westWingCx`, `eastWingCx`, etc. are all kept as aliases over the new mansion constants so the existing LIVING/BEDROOM/BILLIARD/INDOOR room blocks place correctly without rewriting them.

### Interior rooms (~22 total click targets)

**Original 4 (b029):**
- LIVING (central ground) — sectional sofa + L extension + coffee table + 65" TV (`living_tv`) + rug
- BEDROOM (west wing upper) — bed (`bed`) + 2 nightstands + lamp + dresser
- BILLIARD (east wing ground) — pool table (`pool_table`) + 4 legs + 2 balls + bar counter (`bar_counter`) + 3 stools + 3 emissive bottles + neon sign
- INDOOR atrium (back center) — was its own glass box room until b041 stripped the walls. Now has indoor pool (`indoor_pool`) + sauna (`sauna`) + 2 loungers + potted palm

**Phase 2 (b042) — 8 new rooms with non-grid layouts:**
- KITCHEN+DINING (`kitchen_island`) — long marble dining table angled 12° off-axis + 8 chairs + dark stone island + 3 warm pendants + bar stools + glass wine fridge
- AQUARIUM (`aquarium`) — 6 box segments at slight angles forming a curved tunnel through the floor, fish silhouettes inside, marble plinth underneath
- KOI POND (`koi_pond`) — real circular CylinderGeometry pond with 6 koi rotated to face swim direction, 3-tier marble waterfall with cyan emissive cascade, 3 jungle palms in the corners
- TROPHY (`trophy_case`) — 5 marble pedestals in an arc with glass display cases containing alternating gold/platinum record discs
- STUDIO (`recording_console`) — west upper, **rotated -15° off-axis**. Mixing console + 2 monitors + central screen + producer chair + glass iso booth at 90° with mic stand
- CINEMA (`cinema_screen`) — back upper, **fan-shaped 2-row seating curving toward the screen**, each seat slightly rotated to face center
- DJ BOOTH (`dj_booth`) — east upper, **circular raised platform**. CDJ deck + 2 cyan jog wheels + mirror ball + 4 magenta LED uplight bars
- CLOSET (`walk_in_closet`) — walk-in runway + 2 hanging rods with garments + display shoes + master bath with **soaking tub at 45° angle** + marble vanity + chrome faucets

**Phase 3 (b043) — 7 more rooms:**
- FOYER + grand staircase (`grand_stair`) — **14-step curved sweeping marble staircase** in a quarter-circle arc (radius 6, sweep -30° to +60°), each step rotated to follow the curve, marble newel posts with sphere caps
- SPEAKEASY (`speakeasy_bar`) — 3-segment curving bar counter with continuous wood top, 5 stools, 6 emissive bottles in mixed colors, magenta neon BAR sign
- WINE (`wine_rack`) — 3 tall dark wood racks with **144 bottle dots**, round marble tasting table + 3 chairs
- LIBRARY (`library_books`) — 3 tall bookshelves with **180 colored book spines**, reading chair + warm side lamp
- PIANO (`piano`) — grand piano with **curved tail** (4 tapering box segments at angles), keyboard + black key strip, bench, music stand
- GUEST (`guest_bed`) — bed + headboard + nightstand + lamp + 3 abstract art squares
- ROOFTOP (`rooftop_pool`) — 12×4 cyan infinity pool, round hot tub, 4 chaise loungers with magenta cushions, open-air DJ table with cyan jog wheels + magenta LED bars

### Camera (b014/b032/b038/b039)

**Dual-mode camera with full freedom:**
- **Orbit mode** (POOL/BEACH/AERIAL/ROOFTOP): center+yaw+pitch+radius spherical. LMB drag rotates, wheel/pinch zooms (changes radius)
- **First-person mode** (all interior rooms): fixed position+yaw+pitch+fov. LMB drag rotates lookAt direction, wheel/pinch dollies forward/back along view direction (b038 — was FOV zoom, didn't help users escape locked rooms)
- **Pan**: RMB drag OR Shift+LMB drag — slides camCenter via camera right+up basis vectors. Works in both modes
- **Keyboard fly**: WASD + QE while villa view active. W/S forward/back along view direction (projected to ground in orbit, full 3D in FP), A/D strafe, Q/E down/up. Hold Shift = 3× boost. Skipped while typing in any input/textarea
- **R = reset**: re-flies to whichever anchor is currently active
- **2-finger touch** = pinch zoom + pan composed per frame
- Listener attached to `document` capture phase (b039) so browser-level shortcut consumers (Vivaldi etc.) can't swallow letter keys before the page sees them
- Matches by `e.code` (`KeyW`/`KeyA`/etc.) layout-independent + falls back to `e.key.toLowerCase()`

### Camera anchors (22 total — b042/b043)

POOL / BEACH / AERIAL / LIVING / BEDROOM / BILLIARD / INDOOR / KITCHEN / AQUARIUM / KOI POND / TROPHY / STUDIO / CINEMA / DJ BOOTH / CLOSET / FOYER / SPEAKEASY / WINE / LIBRARY / PIANO / GUEST / ROOFTOP

`flyToAnchor()` tweens cartesian (camera position + lookAt point + fov) over `ANCHOR_FLY_MS=1400` with `easeInOutCubic`. Mode swap (orbit ↔ first-person) happens at t=1 when the underlying state vars settle.

### Click→card system (b026/b027/b028)

- `propTracks` lookup at top of `init()` maps a prop's `Object3D.name` → track index
- `raycaster.intersectObjects(scene.children, true)` walks up the parent chain from any hit, picks the first ancestor whose name is in propTracks
- Hover updates cursor to `pointer`. Real `click` event (not mouseup) dispatches `showVillaCard(idx, screenX, screenY)`
- `villaCard` is a DOM popover anchored at the click position with thumbnail + title + artist + waveform bars
- Waveform driven by `getFrequencyData()` ONLY when the card's track is the one currently playing

### Outside the mansion

- Pool 22×6 + jacuzzi cylinder (b016) at z=2..8, deck lanterns at z=9.5
- Pink Lambo on the deck at (-14, 5)
- Yellow Lambo INSIDE the garage at (-22, -9) on the showcase plinth (b040/b041)
- Front beach (sand z=10..30) → front ocean (z=30..90) → horizon
- Pier from beach into ocean (east of center, clears beach chairs at x=12)
- Yachts on the front ocean (`yacht`)
- Jet skis closer to shore (`jetski`)
- Tiki bar + surfboards (`tikibar`, `surfboard`) far west on the beach
- Fire pit + outdoor seating circle (`firepit`) west of pool
- Lagoon — small secondary water at (-22, *, 4)
- Forest (pine cones via `addPineTree` + tall palms) ringing the loop driveway. ~50 trees in tight rings around the loop + back jungle wall + east/west edge pockets. **Road shoulder rows at z=-10/-16/-24 deleted in b041b** because they were inside the new mansion footprint.
- Loop driveway (RingGeometry r=13 to 17.5 at center z=-58) + 2 outward road segments at z=-91.5 and z=-117.5 (b037b — pushed back from z=-85/-110 because the original positions poked into the donut hole)
- Supercar showroom (east lot — `addCarShowroom`)
- 12 extra scattered palms across the front lawn (b043)

### Removed (don't add back unless asked)

- BBQ bar (b040)
- Luxury garden lot with hedges + fountain + topiary + bougainvillea + roses + lavender + urns + benches + pergolas + pathway lanterns (b040)
- 3 garden statues (obelisk/sphere/abstract) (b040)
- West wing side door (b040 — would have become an interior door under the garage)
- Old b025 Mediterranean U-shape + bell tower campanile + arched windows + hipped terracotta roofs (b037 swept these away)
- Atrium glass walls + roof (b041 — the mansion shell IS the walls now)
- **`b026b` debug yellow BoxHelpers** around every clickable prop (b045 — these were the secret reason the scene was looking "Roblox-y" for ages)

`bbqbar`, `fountain`, `statue_obelisk`, `statue_sphere`, `statue_abstract` entries in `propTracks` are now orphan references — harmless, will be reassigned if/when topiary garden / koi pond expansion / waterfall replace them.

---

## 6. Audio / R2 setup

(Unchanged since b011/b012 — see this section in older HANDOFF for full details if needed.)

**Bucket:** `cantmute-audio` in Cloudflare R2
**Public URL:** `https://pub-5556ef4db74d499ba3f535afccf8c7be.r2.dev/`
**Critical:** [js/player.js:8-13](js/player.js#L8) sets `playerAudio.crossOrigin = 'anonymous'` BEFORE any src assignment. Without this, `createMediaElementSource()` produces zero output and there's total silence even though playback "works." This fixed b011's catastrophic CORS bug in b012.

**`audio-mp3/` is gitignored.** Local copies stay on disk for backup but never get committed. Repo stays small. Do not commit audio files.

---

## 7. Build history (b010 → b046)

For full context read [CHANGELOG.md](CHANGELOG.md). Quick summary by epoch:

### b010-b020: Original Mykonos villa, infrastructure
- b010: 2-story modernist villa, PS2+ render target
- b011/b012: Audio moved to R2, CORS hotfix
- b013-b016: Villa expansion + cylindrical tower + camera overhaul + jacuzzi + asymmetric upper stack
- b017: TDZ hotfix lesson saved to memory

### b021-b030: Click→card system + interior rooms
- b026/b027/b028: Click→card popover + hover detection + waveform bars driven by frequency data
- b029: INDOOR atrium room added behind mansion + day/night cycle uniform
- b030 era: Interior rooms (LIVING/BEDROOM/BILLIARD)

### b031-b040: Iteration hell on the mansion shell
- b032: Dual-mode camera (orbit + first-person) for interior rooms
- b033/b034: Architectural details + supercar showroom
- b035: Lagoon refinement + driveway loop
- **b036**: De-Robloxification attempt #1 — bloom + surface noise + heavier fog + lower camera. Helped but didn't transform.
- **b037**: **Mansion rebuild attempt #1** (modern Miami beach mansion) — kept the U-footprint, changed surface only. User: "still looks the same"
- **b038**: Camera freedom — RMB pan + WASD + R reset + FP wheel dolly + 2-finger touch pan
- **b039**: WASD bug fix (document capture phase + e.code matching) + **mansion rebuild attempt #2** (open-air, no glass on front, drum pavilions both ends, taller pavilion, open back archway, glassMat replaces yellow windowMat)
- **b040**: Garage wing attached west of mansion, west lot cleared (BBQ + fountain + garden + statues out)

### b041-b046: Mega-mansion + Phase 2/3 rooms + art-style attempts
- **b041**: **Mansion rebuild attempt #3** (mega rebuild) — finally STOPPED iterating on the wrong U-footprint. New 56×28 single-volume shell, real walkable upper-floor slab, integrated garage zone. Backward-compat aliases preserve interior room positions.
- **b041b**: Move forest pines out of the new mansion footprint (6 road-shoulder trees deleted)
- **b042**: 8 new room interiors (kitchen, aquarium, koi pond, trophy, studio, cinema, DJ booth, master suite) + 8 camera anchors. Non-grid layouts.
- **b043**: 7 more rooms (foyer + curved staircase, speakeasy, wine cellar, library, piano, guest bedroom, rooftop pool) + 7 camera anchors + 12 extra scattered palms
- **b044**: **Tier 3 art-style attempt** — toon-stepped lighting (3 bands) in makePS2Material + sun disc + cloud bands in sky shader. **REVERTED in b046** — user "cel shading looks terrible"
- **b045**: **Tier 1 post-process overhaul** — DELETED b026b debug yellow BoxHelpers (the secret root cause of "Roblox" feeling for ages), added Sobel outline shader from depth buffer, animated film grain, chromatic aberration, stronger color grade, stronger vignette, cooler fog (0x6a1850 → 0x382048)
- **b046**: Reverted b044 toon shading (kept the rest of b045). User flagged the cel shading was making it worse + asked for HANDOFF.md update because chat context was getting heavy.

---

## 8. CURRENT OPEN PROBLEM — art style

**As of b046 the user is still unhappy with the look.** Specifically: "still too blandy blocky and roblox like i think we gotta improve and upgrade overall artstyle honestly"

### What has been tried (and didn't fully work)

1. **b036 — De-Robloxification pass**: bloom + noise hash + fake AO + heavier fog + lower camera. Helped some but didn't transform.
2. **b037 / b039 / b041 / b042 / b043 — mansion rebuilds**: 4 attempts, finally landed on a footprint the user accepted, but the LOOK is still wrong. Geometry is fine, surface treatment is the problem.
3. **b044 — Tier 3 toon/cel shading**: 3-band stepped lighting in makePS2Material. Looked WORSE — the user explicitly said "cel shading looks terrible". REVERTED in b046.
4. **b045 — Tier 1 post pass overhaul**: Sobel depth-buffer outlines + film grain + CA + stronger grading + stronger vignette + cooler fog. Improvement but not transformative.
5. **b045 KEY DISCOVERY**: a `b026b` debug block was adding bright yellow `BoxHelper` wireframes around every clickable prop with `depthTest: false`. With Phase 2 + 3 adding 15 new clickable rooms on top of the original 20, **35 yellow wireframe boxes** were being drawn over the scene every frame. **DELETED** in b045 — this was a huge contributor to the persistent "Roblox" feel that none of my b036/b044 attempts could ever overcome.

### What the user said about the current state (after b045)

"cel shading looks terrible. and the art style graphics themselves look blocky and awful. is there anything we can do to rebuild or change?"

### What's still on the table that hasn't been tried yet

**Tier 2 (rounded box geometry)** — replace `BoxGeometry` with a custom `RoundedBoxGeometry` (~60 lines) for the mansion shell + key furniture. Removes the 90° hard corner look. Has been recommended but not yet attempted.

**More radical options the user should consider:**

- **A) Throw out the PS2 aesthetic entirely.** Switch to a clean, modern look — higher resolution render (no 854×480), standard PBR materials with real lighting (DirectionalLight + cast shadows), bake some textures, atmospheric color grading instead of saturated emissives. This is a multi-day rewrite.
- **B) Embrace a different stylized look** — pure flat-shaded low-poly (like early Monument Valley), watercolor/painterly via custom shader, wireframe/blueprint, vapor wave + grid + fog (lean INTO synthwave instead of fighting it). Much smaller rewrite.
- **C) Switch rendering approach entirely** — composite 2D illustrated sprites instead of 3D, or use Three.js's built-in MeshStandardMaterial with proper modeled geometry, or move to a different engine. Big rewrite.
- **D) Cast shadow maps + textures** — add `DirectionalLight` with shadow mapping, plumb shadow samples into the PS2 shader, add subtle texture maps to surfaces. Risky because the PS2 shader doesn't use Three's lighting system. Multi-commit.

**The user should pick a direction before more code is written.** Three failed mansion rebuilds + one failed cel-shading attempt is enough — STOP, ask, then proceed.

---

## 9. Pending feedback + open questions

### What the user has confirmed works (post-b045)
- Camera drag + scroll zoom + mobile pinch + RMB pan + Shift+LMB pan + WASD fly + R reset
- 22 camera anchors and the click→card popover system
- The mansion footprint (56×28 mega-rebuild)
- The interior rooms layout (especially the non-grid touches: angled dining table, rotated studio, fan-shaped cinema seating, circular DJ platform, curved staircase, koi pond)
- Movement in first-person rooms (b039 dolly forward/back via wheel + WASD)
- R2 audio playback
- The deletion of the b045 debug yellow BoxHelpers

### Currently in question
- The overall art style — see section 8
- Whether the toon shading revert in b046 actually made things look better or just less bad

### Things still on user wishlist for future phases
- More palm trees scattered (partially done b043, can add more)
- Sky bridge (TBD design)
- Topiary garden (replace the empty west lot where the b024 garden was)
- Koi pond expansion (already inside the mansion but could be a bigger outdoor version)
- Waterfall (already inside the atrium but could be a bigger outdoor version)
- Phase 4 rooms: 2nd guest bedroom, butler's pantry, gym, observatory dome, helipad on rooftop, art gallery hall, breakfast nook
- Pool revamp (the existing 22×6 + jacuzzi)
- Showroom revamp (the existing east lot supercar showroom)
- Road revamp (the loop driveway)

### Things the user has explicitly deferred
- Cars driving on the road
- Helipad
- Tennis / basketball court
- Hedge maze
- Outdoor cinema (separate from the indoor one)
- Gym / yoga deck
- Security gate at the road entrance

---

## 10. Backward-compat aliases — DO NOT REMOVE

The interior rooms (LIVING/BEDROOM/BILLIARD/INDOOR atrium) all reference these constants directly:

- `villaCx`, `villaCz` (the old central villa center, now (0, -10))
- `centralW`, `centralD`, `centralH1`, `centralH2`
- `wingW`, `wingD`, `wingH1`, `wingH2`
- `westWingCx`, `eastWingCx`, `westWingLeftX`, `eastWingRightX`
- `centralLeftX`, `centralRightX`, `centralFrontZ`, `centralBackZ`
- `centralTopY`, `wingTopY`
- `villaFullW`, `villaFullD`

These are kept as **aliases** over the new `mansionCx`/`mansionW`/`mansionH1`/etc. constants in [js/world.js](js/world.js) so the existing room blocks place correctly without rewriting them. **Do not remove these unless you also rewrite every interior room to use new constants.** Critical: `wingH1` and `wingH2` were bumped from `3, 3` to `5.0, 4.5` in b041 so the bedroom Y placement (`bdY = podiumTopY + wingH1 = 5.82`) matches the new upper floor surface.

---

## 11. Known gotchas + lessons learned the hard way

### TDZ in world.js (saved to memory)
When adding new mesh blocks that use existing materials (`windowMat`, `villaMat`, `marbleMat`, `stoneMat`, `lanternGlowMat`, `topiaryMat`, `glassMat`, `floorInteriorMat`, etc.), **grep the `const <name> =` declaration line and verify your new code is BELOW it in source order.** ES `const` has a temporal dead zone. `node --check` will pass but the page will crash on init with `ReferenceError: Cannot access 'X' before initialization`.

Materials declared at the TOP of the villa shell (~line 489-540 area) are safe to use anywhere in the rest of the init function. Materials declared LATER (`trunkMat`/`frondMat` at ~line 1342) are NOT available in earlier blocks.

### Yellow wireframe outlines = debug BoxHelpers (b045 lesson)
If you see bright yellow wireframe boxes around props in a screenshot, it's the b026b dev block. It was supposed to be temporary. Deleted in b045 but check if it gets re-added.

### Three failed mansion rebuilds (b025 / b037 / b039) before the b041 one finally worked
**Stop iterating after 2 failed attempts. ASK the user to rethink, propose a different approach, get approval, then execute.** The user appreciated the b041 plan-first approach way more than the previous rebuild-on-vibes approach. CLAUDE.md says exactly this.

### Cel/toon shading on the PS2 aesthetic looks bad (b044 lesson)
Stepped lighting bands on the smooth PS2 shader produced visible color banding on every flat surface. Reverted in b046. The user said "cel shading looks terrible." If considering toon shading again, do it on a different base shader, not on top of the existing PS2 frag.

### Layout collision when moving things
Every time the villa or pool grows, props (lambo, lanterns, daybeds, boulders, path lights, lagoon, beach chairs, road segments, trees) get swallowed and need repositioning. Examples: b041b moved 6 forest pines that were inside the new mansion. b037b moved road segments that were poking into the loop driveway donut hole. **When changing villa or pool dimensions, check every prop position against the new bounding boxes.**

### Git commit messages
The user once pasted a plan markdown as a commit message verbatim (commit `013cff9`). **Do not assume the user reads commit messages carefully.** YOU run git commit with a real conventional message. Don't dump bullet points into the commit body.

### Force push protocol
Force push to main/master is destructive. Only `--force-with-lease` if the user explicitly approves. Always backup branch first.

### Cloudflare deploy
Repo is currently ~1 MB (audio is on R2, not in git). Deploys are fast. If a deploy hangs, check (1) Cloudflare status page, (2) repo size with `git count-objects -vH`, (3) any large file accidentally committed.

### Fog color is in 5 places
`scene.fog` + 4 shader uniforms (`makePS2Material`, pool, ocean, lagoon). When changing the fog color, use `replace_all` on the hex value or update all 5.

### node --check is necessary but NOT sufficient
It catches syntax errors but NOT TDZ errors, NOT missing materials, NOT typos in references to vars that exist but in the wrong scope. The page will crash silently. Always tell the user to hard-refresh + paste console errors.

---

## 12. First steps for a fresh chat

1. **Read this file completely.** Then read [CLAUDE.md](CLAUDE.md), then [FILE_MAP.md](FILE_MAP.md), then the most recent 2-3 entries in [CHANGELOG.md](CHANGELOG.md).
2. **Check memory files** at `C:\Users\B4TTL\.claude\projects\c--Users-B4TTL-musicportfolio\memory\`.
3. **Run `git log --oneline -10`** to confirm where we are and what's been shipped recently.
4. **Run `git status`** to check for any uncommitted changes.
5. **The big open question right now is the art style** (section 8). The mansion geometry/architecture is in a good place. What needs help is the SURFACE — how the rendered output looks. If the user's first message in the new chat is about this, jump straight to discussing rebuild paths. If they're on a different topic, start there but keep section 8 in mind.
6. **Greet briefly** — confirm you've loaded context, don't dump everything you read.

---

## 13. Files to know (quick reference)

| File | Purpose |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Workflow rules — MANDATORY reading |
| [FILE_MAP.md](FILE_MAP.md) | Architecture overview, current build, file responsibilities |
| [CHANGELOG.md](CHANGELOG.md) | Per-build entries, newest at top |
| [HANDOFF.md](HANDOFF.md) | This file |
| [VISION.md](VISION.md) | Design bible: project vision, art direction, palette |
| [config.json](config.json) | Site config + tracks list + R2 audioBase |
| [js/helpers.js](js/helpers.js) | `BUILD_NUMBER` const — bump every build |
| [js/app.js](js/app.js) | View router, config loader, shared state, top-bar search, keyboard shortcuts (digits 1-4 = views) |
| [js/player.js](js/player.js) | Audio playback (R2-routed), `playerAudio.crossOrigin='anonymous'` |
| [js/world.js](js/world.js) | Villa view — the hero, ~3900 lines as of b046 |
| [scripts/upload-audio-to-r2.sh](scripts/upload-audio-to-r2.sh) | Re-upload audio to R2 if needed |
| [scripts/r2-cors.json](scripts/r2-cors.json) | CORS policy reference (set via dashboard) |

---

## 14. world.js — major sections by line range (approximate, will drift)

| Lines | Section |
|---|---|
| 1-60 | IIFE state declarations (camera, materials, click target state) |
| 60-280 | init() — THREE load, scene/camera/renderer setup, click target propTracks, sky shader |
| 280-540 | makePS2Material factory (the heart of the PS2+ render look) |
| 540-1080 | Mansion shell (b041 mega rebuild — 56×28 single volume + colonnade + drums + rooftop pavilion + back archway + garage zone + grand stair) |
| 1080-1340 | Palms helper, deck lanterns, addCar, lambos, fire pit, daybeds, BBQ deletion stub |
| 1340-1550 | INTERIOR FURNITURE (LIVING / BEDROOM / BILLIARD original 3) + INDOOR atrium furniture (b041 stripped walls) |
| 1550-2160 | Phase 2 + 3 room interiors (kitchen, aquarium, koi pond, trophy, studio, cinema, DJ, closet, foyer, speakeasy, wine, library, piano, guest, rooftop pool) |
| 2160-2700 | Lagoon + yachts + jet skis + pier + tiki bar + fire pit + supercar showroom |
| 2700-2860 | Loop driveway road + outward road segments |
| 2860-2950 | Forest pine cones + extra palms |
| 2950-3120 | Click→card system functions (showVillaCard, updateVillaCardWaveform, raycast helpers) |
| 3120-3450 | Mouse + touch + wheel + keyboard input handlers |
| 3450-3550 | Render target + post-process shader (b045 Tier 1 — Sobel outline, film grain, CA, grading, vignette) |
| 3550-3650 | Camera anchor system (cameraAnchors array, flyToAnchor, animate fly tween) |
| 3650-3900 | animate() main loop + destroy() cleanup |

---

## 15. If something is on fire

- **Audio broken on prod:** check console for CORS errors. Verify [js/player.js](js/player.js) has `crossOrigin = 'anonymous'`. Verify CORS rules still set on the R2 bucket.
- **Villa view crashes on init:** check console for `ReferenceError`. Most likely a TDZ issue with declaration order in world.js (see section 11).
- **Page won't load anything:** check `js/helpers.js` for syntax error. The whole site bootstraps from `window.BUILD_NUMBER` being defined.
- **Yellow wireframes everywhere:** check section 11 — it's debug BoxHelpers, deleted in b045 but if they come back they're somewhere in init().
- **User says "looks broken":** ask for actual console errors before guessing. Don't roll back commits unless the user explicitly asks.

---

End of handoff. Future Claude: read this, ASK before rebuilding, don't let three failed attempts at the same thing slip past you. The user is patient when you understand context; they get frustrated when you guess.
