# CHANGELOG (legacy / pre-split)

> **This file is FROZEN at b242.** From here on, per-scene CHANGELOGs live in:
> - [docs/galaxy/CHANGELOG.md](docs/galaxy/CHANGELOG.md) (galaxy builds, `g###`)
> - [docs/tracks/CHANGELOG.md](docs/tracks/CHANGELOG.md) (tracks builds, `t###`)
> - [docs/scenes/CHANGELOG.md](docs/scenes/CHANGELOG.md) (scenes builds, `s###`)
>
> The b001–b242 history below is the shared monolithic log up to the per-scene split. Don't add new entries here.

---

## b242 — 2026-05-09 — Per-scene split: kill the build-number race so parallel chats can run truly in parallel

User: *"why don't we just have like a file map and a changelog per ... one for marathon index page and one for the scenes page and one for the tracks page ... wouldn't that make more sense? what does helpers provide and how can it be split for our system if at all"* + *"proceed"*.

The old monolithic shared-bookkeeping setup — single `js/helpers.js` with one global `window.BUILD_NUMBER`, single `FILE_MAP.md` with a `**Build:**` header touched on every change, single `CHANGELOG.md` with every scene's history interleaved — was forcing every parallel chat (galaxy session + scenes session + occasional tracks session) to race on three files. Within this single conversation alone, the parallel scenes chat repeatedly bumped the build number from under the galaxy chat (b232 → b234 → b237 → b241), triggered "file modified since read" Edit-tool errors, and once even overwrote the galaxy chat's freshly-written changelog entry. Wasted real time.

**The split (effective b242 → forward):**

**1) Per-scene build constants in separate files.** Created `js/builds/`:
- `js/builds/galaxy.js` → `window.BUILD_GALAXY = 'g1';` (read by `index.html`'s `bootMarathonWorld`)
- `js/builds/tracks.js` → `window.BUILD_TRACKS = 't1';` (read by `index.html`'s `bootTracksDaw`)
- `js/builds/scenes.js` → `window.BUILD_SCENES = 's1';` (read by `scenes/play.html`)

Each chat owns exactly one of these files. Format prefixed (`g###` / `t###` / `s###`) so a glance at the build chip tells you which scene a build belongs to and the three timelines don't pretend to share a sequence they don't.

**2) HTML rewiring.** `index.html` line 3799 — replaced `<script src="/js/helpers.js"></script>` with two script tags loading `builds/galaxy.js` + `builds/tracks.js`. The two boot functions (`bootMarathonWorld` line 3611, `bootTracksDaw` line 3642) now read `window.BUILD_GALAXY` and `window.BUILD_TRACKS` respectively. `scenes/play.html` line 136 — `helpers.js` script tag swapped for `../js/builds/scenes.js`.

**3) Per-scene FILE_MAP + CHANGELOG.** Created `docs/galaxy/`, `docs/tracks/`, `docs/scenes/` each with a starter `FILE_MAP.md` (scene scope, owned files, shared dependencies, "always do these" rules, architecture summary) and `CHANGELOG.md` (starts at `g1` / `t1` / `s1`, references this frozen file for pre-split history).

**4) Root `FILE_MAP.md` slimmed** to a route table + pointers to per-scene docs + a list of cross-cutting shared files. No more `**Build:**` header to bump on every change.

**5) Root `CHANGELOG.md` (this file) frozen** with the header note above. b001–b242 stays here as historical record. New work goes in the per-scene CHANGELOGs.

**6) `js/player.js` flagged as SHARED ENGINE.** Added a header comment that explicitly says: do not modify for visual changes, UI lives in the consuming scene file, audio-engine changes need to be tested against all three scenes before shipping. This is the one truly cross-cutting code file (every scene reads `audio.__floorAnalyser` from it for bass-reactive shaders / spectrum bars), so it gets a "coordinate before touching" label.

**7) `CLAUDE.md` rewritten** to teach the new convention: bump *your scene's* build constant in `js/builds/<scene>.js`, log to *your scene's* `docs/<scene>/CHANGELOG.md`, never edit the shared files (`player.js`, `index.html`, `config.json`, `_redirects`, `serve.py`) without coordinating, never bump the legacy `helpers.js` (it's gone).

**8) `js/helpers.js` deleted.** No more single-string race target.

**Validation.** Smoke-tested all three routes after the cutover: `/`, `/tracks`, `/scenes/`, `/scenes/play.html` all return 200 and load. The galaxy and tracks build chips read from their new constants. Old `js/tracks-vault.js` (legacy WebGL revert path) still references `window.BUILD_NUMBER`; it'll show empty build chip if anyone ever resurrects it — acceptable for a deprecated path.

**Files touched in the migration:** `js/builds/galaxy.js` (NEW), `js/builds/tracks.js` (NEW), `js/builds/scenes.js` (NEW), `docs/galaxy/FILE_MAP.md` (NEW), `docs/galaxy/CHANGELOG.md` (NEW), `docs/tracks/FILE_MAP.md` (NEW), `docs/tracks/CHANGELOG.md` (NEW), `docs/scenes/FILE_MAP.md` (NEW), `docs/scenes/CHANGELOG.md` (NEW), `index.html` (script-tag rewire + 2 buildNumber refs), `scenes/play.html` (script-tag rewire), `js/player.js` (SHARED ENGINE header), `FILE_MAP.md` (slimmed to route-table + pointers), `CHANGELOG.md` (this freeze header + entry), `CLAUDE.md` (workflow rules rewritten for the per-scene convention), `js/helpers.js` (DELETED). **Localhost only.**

After this build the user opens three fresh chats — one per scene — and they each work in isolation.

---

## b241 — 2026-05-09 — Scenes: deck-flank fill + missile silo spacing fix (clipping, stale bunker refs, antenna farm push)

User on `/scenes` deck POV: *"i circled the blue areas to address. also in the center of the missile silo seems therres a lot of clipping and objects placed too close together. radar dish right beside the missile like a meter apart>?? other stuff. pls space it properly youre on claude max"* + screenshot circling 3 empty zones (left foreground, right foreground, far-right past panel arc).

Two problems addressed:

**Silo clipping was real.** The b235/b237 scale-up grew the control bunker (cbW 5→8, cbD 5→7) and shifted its center (`padR + 1.5` → `padR + 2.5`, `z=-3` → `z=-4.5`). But the blast door, door frame, wall lamp, HVAC unit, slit window, both cable trays, and the antenna farm were ALL still hard-coded to the old `padR + 1.5` / `-3.0` literals. Result: blast door floating 1.5u in front of the new bunker; HVAC offset on the roof; slit window in the wrong wall; tray2 running through empty space; antenna farm dipoles sitting INSIDE the bunker volume (x=17–18.8 vs bunker x=11.5–19.5 span). Extracted `bunkerX = padR + 2.5`, `bunkerZ = -4.5`, `bunkerFront = bunkerZ + cbD/2` as single source of truth and re-anchored every dependent piece. Antenna farm pushed from `padR + 4` (= 17, inside bunker) to `padR + 14` (= 27, well clear). Also bumped blast door + frame to fit the bigger bunker face (1.4×1.9 → 2.0×2.6), wall lamp scale up, HVAC unit up. Gantry pushed from `siloR + 3.8` to `siloR + 5.0` (3u more breathing room from silo). LOX tank pushed from `siloR + 8.5` to `siloR + 11.5` (clears gantry outer leg). Blast deflector ring grew (`siloR + 1.2/1.6` → `siloR + 1.6/2.2`) to match the bigger silo footprint.

**Deck-flank fill — `_buildDeckFlankFill()` (new).** Drops density into the gap zones the user circled — the dead desert between the rail kiosks (z=-10) and the cement walkways (z=-30/-58), plus the strips past the deepsea/neural panel hosts at x=±70 between panel and patrol road. Each side gets:
- 1× **guard shack** (3.2×3.0×2.6 concrete booth) with lit door + window + antenna whip — at (±22, -10)
- 1× **equipment shed** (5.0×3.2×3.6 olive) with roll-up door, yellow caution stripes, side air vents — at (±38, -22)
- 1× **drum cluster** (5 olive/oliveHi 55-gal drums in a tight pyramid stack) — at (±25, -25)
- 1× **pallet stack** (wooden pallet + 4 stacked olive crates rising to 2.4u) — at (±44, -8)
- 2× **floodlight poles** (9.5u steel poles + 1.1×0.45 lamp head + warm sodium lens, head aimed inward toward spine) — at (±26, -16) and (±50, -28)

Far flanks (between outer panels and patrol road) get a thinner version: 1 equipment shed + 1 pallet stack + 1 drum cluster + 1 floodpole at x=±72, oriented along the patrol road. Sells "active maintenance zone" instead of the empty desert that was there. All positions stay clear of the spine road shoulders (x=±5), the cement walkways (x=±30 vertical, z=-30/-58 horizontal), and the existing motor pool / bivouac at z>0. New `_buildDeckFlankFill` called from `init()` immediately after `_buildPerimeterClutter`.

**Untouched.** Panels, panel hosts, POIs, watchtowers, antenna farm builder (just relocated within the silo), conex stacks, ridges, fence envelope. Only the silo block was structurally rewired and one new builder added.

**Validation.** `cp js/scenes-selector.js c:/tmp/sc.mjs && node -c c:/tmp/sc.mjs` passes.

**Files touched:** `js/scenes-selector.js` (silo block: bunker constants extracted + dependent positions re-anchored, antenna farm pushed, gantry + LOX spaced out, deflector grew; new `_buildDeckFlankFill` method; init call), `js/helpers.js` (b240 → b241 — hook auto-bumped through b239/b240 mid-edit, plus a concurrent halo-ring commit took b240), `FILE_MAP.md` (build/date), `CHANGELOG.md`. **Localhost only.**

---

## b240 — 2026-05-09 — Halo ring: "fucking huge" + steeper tilt + vivid terrain (b239 also: core moved behind camera)

User on the b238 hard-refresh: *"its kind of hard to see the detail of the ring world like the inside (i loved seeing the blue water and green land). how can we make it better? also the marathon ship is a good size but the halo ring needs to be fucking huge and angled in a nice way so the camera can see the inside so to speak."* Plus the prior b239 ask: *"move the core behind the camera spawn and far away."*

**b239 (folded into this entry).** Core moved `(450, 80, -150)` → `(-200, -80, 1650)` — behind the camera spawn, far out, deep enough to sit past the Halo ring as a distant Saturn-observatory landmark you discover when looking back through/past the ring.

**b240 — three coupled fixes for the ring read.**

**1) Bigger.** `RING_R 680 → 900` (+32%). True planet-class megastructure scale — the user explicitly called for "fucking huge." `RING_r 36 → 48` (proportional thickening so the inner-band screen-area-per-radius stays the same — i.e., the ratio of "terrain band width" to "ring diameter" is preserved). Tubular segs `540 → 600` and radial segs `20 → 22` to keep curvature smooth at the new size. Hardcoded `680.0` in the vertex shader's tube-center math also bumped to `900.0` (these have to stay in sync with `RING_R` — there's a comment flagging the requirement).

**2) Steeper angle so the inner face actually shows.** b238 had `rotation.x = 0.65` which gave a 41.6° off-axis viewing angle — close to face-on, where the ring read as a circular outline rather than a tilted plate showing the inhabited surface. Bumped to `rotation.x = 0.85` for a 50.5° off-axis (computed: axis ≈ `(-0.361, -0.719, -0.594)` dot camera-direction-from-ring `(-0.046, -0.038, -0.999)` ≈ `0.637` → `acos ≈ 50.5°`). At 50° you genuinely see the curving inner-face plate sweeping across the view — the iconic Halo angle. Position pushed deeper too: `(40, 30, 1050) → (60, 50, 1300)` so the larger ring still has breathing room from the camera. Camera far plane bumped `1800 → 2400` to fit the new far edge (ring extends in Z by ±0.804·900 = ±723u from center, so far edge at z = 1300 + 723 = 2023u — plus the deep-field core at z=+1650 still inside the frustum).

**3) Terrain visibility — the part the user loved.** Inner-face shader retuned for vivid sun-lit terrain:
- **Ocean palette saturated.** `oceanDeep 0.030/0.13/0.36 → 0.040/0.18/0.45` (richer royal-blue), `oceanShallow 0.10/0.34/0.62 → 0.18/0.50/0.85` (brighter cyan-blue toward shores). The deep/shallow gradient now actually reads.
- **Forest brighter.** `0.16/0.40/0.18 → 0.22/0.58/0.24` — clear green that reads as forest, not muddy olive.
- **Desert warmer.** `0.60/0.48/0.22 → 0.65/0.52/0.24` — slightly warmer for better land contrast.
- **Cloud cover thinned.** Mix factor `0.45 → 0.32` and threshold `smoothstep(0.58, 0.86) → smoothstep(0.60, 0.90)` so clouds are sparser and let more of the land/ocean mosaic show through.
- **Brightness pop.** `surface *= 1.08 → surface *= 1.30` — sun-lit inner face now actually reads as *lit*, not muted.
- **Atmosphere rim haze pulled.** `0.18 → 0.12` so the bluish edge wash doesn't paint over the terrain at the band edges.

**4) Outer-face cyan trim pulled further.** The bright cyan/blue outer rim was outshining the inner terrain in every screenshot. Plate seam `0.30 → 0.18`, side-rim glow `0.18 → 0.10`, bass coupling `0.10 → 0.08`. The outer face now reads as dark structural alloy with subtle power lines, not a glowstick — terrain wins the visual hierarchy as it should.

**Validation.** `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` passes.

**Files touched:** `js/marathon-world.js` (camera far 1800→2400, `_buildHaloRing` position/rotation/RING_R/RING_r/segs + shader hardcoded radius + outer-face glow tone-down + inner-face palette/cloud/brightness retune, `_buildCore` position from b239), `js/helpers.js` (b238 → b240, skipping b239 since the core-only edit got folded in), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only.**

---

## b238 — 2026-05-09 — Galaxy 360°: Halo ring goes WORLD-scale + behind camera; core to right; satellites hidden

User on the b237 forward view: *"the ring needs to be much much bigger its a whole world so lets move it back in the scene further and its also too close to the north or whatever. like when i load the page, i see all the things at the same time, mothership, halo ring. they need to be spread around the 360 so it makes sense"* — plus a screenshot pointing at one of the satellite gyros: *"can we move it far far away or remove it i hate how it gets in the way of halo ring."*

Two coupled problems with the b237 layout: (a) every landmark sat in the default forward cone, so the moment the page loaded you saw Marathon ship + ring + core + satellite all at once with no exploration payoff; (b) the ring was big but not WORLD big, didn't read as the Forerunner megastructure it's supposed to be.

**Landmark angular re-spread.** Treating the camera (locked at origin per b109 cockpit lock, drag-look only) as an observation point inside a 360° sphere, each landmark gets its own bearing:
- **Marathon ship** — `(-340, 36, -120)` — front-left (unchanged). Default-view landmark; first thing you see on load.
- **Core** (Saturn-observatory ring system) — `(-440, 80, -620)` → `(450, 80, -150)` — moved from far-left to **forward-right**. Visible when drag-looking right from the default heading.
- **Halo ring** — `(40, 20, -700)` → `(40, 30, +1050)` — moved from forward to **directly behind the camera**. Now requires a 180° drag-look turn to discover. This is the "spread around the 360" payoff: turn around → giant Forerunner world appears.
- **Satellites** — orbit radius 240-340u from origin. Since the new ring's interior reaches out to ~1700u from origin (R=680 + center distance ~1052), no orbit radius keeps satellites out of the ring's view path. Hidden by default (`grp.visible = false` at build time). The `el-satellites` admin toggle in the `~` panel re-enables them on demand for anyone who wants the busy version.

**Halo ring scale-up.** `RING_R 540 → 680` (+26%), `RING_r 28 → 36` (proportional, so the inner-band screen-area-per-radius read is unchanged). Tubular segs `480 → 540`, radial segs `18 → 20` to keep the curvature smooth at the new size. Hardcoded `540.0` in the vertex shader's tube-center math also bumped to `680.0` to match `RING_R` (these have to stay in sync — there's a comment flagging this requirement).

**Ring orientation flip for the new bearing.** The 45° tilt math established in b235 was for camera-direction-from-ring ≈ `+Z` (ring at z<0). With the ring now at z=+1050, that camera-direction-from-ring inverts to ≈ `-Z`. Adding `Math.PI` to `rotation.y` (`0.45 → 0.45 + π`) flips the symmetry axis 180° around Y — same 45° tilt, just to the new bearing. Computed axis after the flip ≈ `(-0.405, -0.567, -0.717)` dot the new camera-direction-from-ring `(-0.038, -0.029, -0.999)` ≈ `0.748` → `acos ≈ 41.6°` (still solidly in the iconic 3/4-view band). `rotation.x = 0.65` and `rotation.z = -0.10` retained.

**Camera far plane.** Bumped `1500 → 1800`. The ring now extends in Z from ~573 to ~1525 (center 1050 + Z-extent 0.717·680 = 487u), so the b236 far=1500 would have clipped the ring's far edge. 1800u gives ~280u of headroom for the ring plus space for any future deep-field landmarks (Traveler, Marathon-rebuild, etc.).

**Validation.** `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` passes.

**Files touched:** `js/marathon-world.js` (camera far, `_buildHaloRing` position/rotation/RING_R/RING_r/segs + shader hardcoded radius, `_buildCore` position, `_buildSatellites` initial visibility), `js/helpers.js` (b237 → b238), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only.**

---

## b237 — 2026-05-09 — Scenes: missile silo scaled up + full LF compound build-out (floods, cameras, signs, transporter, fuel tank, hatch)

User on `/scenes` missile silo POI: *"missile silo could be heavily improved, whats usuallyt around that. p;ls add it in. mkae things bigger too"* + screenshot showing the silo reading as a small model behind the galaxy panel.

The b220 silo had the right ingredients (lattice gantry, LOX tank, generator shed, control bunker, sandbag perimeter) but was undersized — pad r=7.5, silo r=1.5/h=12 — so from the silo POI 52u away the whole launch pad fit in a small frame patch behind the panel. Real Minuteman LFs (Launch Facilities) read as monumental hardened compounds. Scaling the existing silo up substantially and adding the typical LF-perimeter features that were missing.

**Core constants doubled.** `padR 7.5 → 13`, `padH 0.6 → 1.2`, `siloR 1.5 → 2.8`, `siloH 12 → 22`. Silo cap, missile body, nose cone, gantry width/depth/height, LOX tank, generator shed, control bunker all scaled to match. Sandbag perimeter count `28 → 56` to wrap the bigger pad without sparseness. Caution chevron spacing widened (`+= 2` → `+= 3`) for the taller silo. Stencil "07" plate scaled up too. Silo strobe scale `0.55 → 0.85`. Silo top now stands at world y≈22 (cap+missile+nose), dwarfing the galaxy panel at y=10 the way real launch tubes dominate their compound.

**Pad pushed back to clear the road.** `_placeBuilding(grp, 0, -8, -107)` → `(0, -8, -118)`. The bigger sandbag perimeter (now padR+1.8=14.8) at z=-118+14.8=-103.2 puts the north edge well clear of the N perimeter road at z=-90.

**4 corner floodlight pylons.** New 11u-tall pylons at the LF compound corners (`compoundR = padR + 12 = 25`). Each: vertical pole, yoke arm, bank of 3 lamp heads each with a warm sodium lens, and a red aviation strobe at the very top (`rate 1.5–2.0`). Anchors the silhouette of the LF compound from any POI.

**4 cardinal security camera poles.** 6u poles at compound radius 0.62, with small angled-housing camera boxes at the top oriented toward the pad center, plus a tiny red status LED on each (rate 2.8 — slow blink). Reads as "this compound is monitored" without burning detail polygons.

**4 "RESTRICTED AREA" warning signs.** At diagonals on stakes at `compoundR * 0.92`. Red sign panels (`0xc83838`) with a white horizontal stripe band suggesting the canonical "RESTRICTED AREA / USE OF DEADLY FORCE AUTHORIZED" stencil. All face the pad center — readable from outside the compound.

**Above-ground diesel fuel tank.** Horizontal cylindrical tank (5.5u long × 1.6u radius) beside the generator shed with proper saddle supports, dome end caps, vent stack, and yellow hazard placard. Real LFs always have an above-ground diesel reserve next to the generator since the buried gen-set runs months between fillings.

**Payload Transporter (PT) parked SW.** Flat-bed semi at `(-padR-8, _, +9)` with green olive cab, warm cab windshield, a faux-canister cargo lashed to the bed (suggests missile maintenance hardware), 10 wheels, lashing straps, and an amber roof beacon. PT trucks are the visual signature of an active maintenance window at a Minuteman LF.

**Sloped concrete personnel access hatch.** Separate from the main blast door — small 2.6×0.9×2.6 concrete cube at `(padR-2, _, -padR+2)` with a tilted steel lid (-0.25 rad) suggesting "hatch lifted for crew entry," yellow caution stripe, and a small handrail loop at the lifted edge. Real LFs have a separate small personnel access plane the maintenance crew uses, distinct from the main blast cover.

**Untouched.** Every other builder, panel positions, perimeter fence, ridges, watchtowers, conex stacks, antenna farm. Only `_buildMissileSite` was modified (one inline section appended before the `_placeBuilding` call). Cable trays, antenna farm, blast deflector ring, slit window, all the inner detail from b217-b220 stays intact.

**Validation.** `cp js/scenes-selector.js c:/tmp/sc.mjs && node -c c:/tmp/sc.mjs` passes.

**Files touched:** `js/scenes-selector.js` (`_buildMissileSite` core constants + new LF compound block), `js/helpers.js` (b236 → b237 — hook auto-bumped through b235/b236 mid-edit, plus a concurrent halo-ring commit took b236), `FILE_MAP.md` (build/date), `CHANGELOG.md`. **Localhost only.**

---

## b236 — 2026-05-09 — Halo ring scale-up: 2.25× bigger so it dwarfs the ships (canon-accurate hierarchy)

User: *"i think halo world gotta be much bigger considering size of all our ships."*

The b235 ring at `R=240, r=12` was barely 2× the Marathon ship's spine length (~180u). That's a hood-ornament read, not the canonical Halo Array hierarchy where the ring is a planet-scale artifact and capital ships are dust along its rim.

**Geometry bump.** `R: 240 → 540` (2.25×). `r: 12 → 28` (proportional thickening — same tube/major aspect ratio, ~32:1, matches the canon ~10000km / 318km ≈ 31.4:1). Tubular segs `380 → 480` and radial `14 → 18` to keep curvature smooth at the new size. The vertex shader's hardcoded `RING_R` (used for the inner-vs-outer face computation) bumped from `240.0` → `540.0` to match — easy to miss; if the constants ever go out of sync, the shader's face-classification flips and the terrain renders on the wrong side.

**Position deepened.** Center `(40, 10, -460) → (40, 20, -700)`. Pushing back compensates for the size bump so the near edge isn't crowding the camera. With ring orientation axis ≈ `(0.284, -0.637, 0.717)` and R=540, the ring's far edge sits at world-Z ≈ `-700 - 0.697 × 540 = -1077u`. Near edge at z ≈ `-323u`.

**Camera far plane bumped.** `800 → 1500`. The b226–b235 ring at R=240 fit comfortably inside an 800u far plane; at R=540 + center z=-700, the far edge would clip without expansion. 1500u also gives headroom for upcoming additions (Traveler / new Marathon / Covenant CCS) without another camera tweak. Depth-buffer ratio (near 0.1, far 1500 = 15000:1) is well within float-24 precision range — no z-fighting risk introduced.

**Apparent size.** At 540u radius / ~700u depth, the ring subtends roughly half the visible viewport at FOV=80°. From any angle the Marathon ship now reads as a small artifact next to a planet-scale ring — the intended hierarchy.

**Untouched.** Rotation values from b235 (`x=0.65, y=0.45, z=-0.10`) retained — the 45° viewing angle is correct, only the size needed fixing. Spin rate (0.0007 rad/frame), terrain shader frequencies, outer-face cyan tone-down all unchanged. Core position from b235 (-440, 80, -620) is fine — at 770u from origin and 1500 camera-far, it's still well inside frustum.

**Validation.** `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` passes.

**Files touched:** `js/marathon-world.js` (camera far plane, `_buildHaloRing` position + RING_R/r/segs constants + matching shader-side hardcoded `540.0`), `js/helpers.js` (b235 → b236), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only.**

---

## b235 — 2026-05-09 — Halo ring at real 45° + core moved much further out + Marathon flipped to face-forward

User on the b233 screenshot: *"the halo ring is now at a bad angle cuz i see it directly from its side, need like a good 45 or something angle for it yknow / also move that core the fuck out the way pls its still close and annoying much further out / the marathon ship flies backwards i believe. all our ships (new ones) keep flying backwards u add them backwards pls dont do that."*

Three independent fixes.

**1) Ring rotation — actually 45° this time.** b233 set `rotation.y = 0.35, rotation.x = 0.45` claiming a "3/4 view" but the math worked out to ~34° off camera-direction-axis = still mostly face-on (which is exactly what the screenshot showed: a perfect circular outline, no curving-plate read). b235 retunes for a true 45°: `rotation.x = 0.65` (more forward lean) + `rotation.y = 0.45` (more axis swing). Computed axis ≈ `(0.284, -0.637, 0.717)` dot camera-direction `(-0.087, -0.022, 0.996)` ≈ `0.703` → `acos = 45.4°`. Now the ring genuinely reads as a tilted disc with the curving inner-face plate dominant. `rotation.z = -0.10` retained for the slight asymmetric roll.

**2) Core pushed way out.** b233 moved the core from `(0, 0, -440)` → `(-180, -10, -440)` — only 180u to the left, still mid-frame, still reading as "annoyingly close" per the user. b235 lifts it to `(-440, 80, -620)`: far upper-left quadrant + 180u deeper Z. Distance from origin = 770u, just inside camera-far = 800. Apparent size in frame is now ~30% of what it was at the b233 position. Fully clear of the ring's view path. The god-ray hookup at `_animate` line ~7047 (`coreGroup.position.clone().project(camera)`) keeps working — it just sources godrays from a smaller, more distant projected screen-position now.

**3) Marathon flipped 180° — head toward camera, engines trailing.** Was `rotation.y = π × 0.18` (engine block at local-X=-100 ended up at world (-0.85, 0, +0.54) → CLOSER to camera; head at local-X=+105 ended up INTO the screen). The engine block is 28×22×22 with bright orange thruster cones; the head is an 11u icosa with three small spires. Massive engine + parallax + closer-to-camera = engine reads as "the front" → ship looks like it's flying butt-first. Flipped to `rotation.y = π × 1.18` (added π). Now: head at world ≈ (-0.85, 0, -0.54) offset → head sits closer to camera (at world z ≈ -64u) and engines trail into the screen (at world z ≈ -174u). The visual hierarchy now matches the semantic hierarchy: head = front, engines = behind. Tick-loop yaw drift (line ~5350) was also updated `π × 0.18 → π × 1.18` to keep the slow station-keeping wobble centered on the new orientation rather than springing it back to the old pose.

**Memory.** Saved `feedback_ships_face_forward.md` so this pattern doesn't repeat on Traveler / Marathon-rebuild / Covenant CCS / future flyby additions: when picking ship rotation, verify the head ends up closer-to-camera than the engine block; if not, flip 180°. The visually dominant end should be the head.

**Validation.** `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` passes.

**Files touched:** `js/marathon-world.js` (`_buildHaloRing` rotations, `_buildCore` position, `_buildMarathonShip` rotation.y + `_tickMarathonShip` yaw-drift offset to match), `js/helpers.js` (b234 → b235), `FILE_MAP.md`, `CHANGELOG.md`. **Memory:** new `feedback_ships_face_forward.md` + MEMORY.md index entry. **Localhost only.**

---

## b234 — 2026-05-09 — Scenes: bring the ridge silhouette back (b231 pushed it past the readable horizon)

User on `/scenes` ridge POI after b231: *"but now u removed the ridge line"* + screenshot showing empty desert and a thin fence with no mountain horizon.

In b231 the rings were pushed to near=180 / far=240 to clear the new bigger fence corners (outer x=±125, z=-142/+98, max diagonal ~189). At those distances the silhouettes blended into the flat horizon line and stopped reading as mountains. Pulling the rings back to a visible distance and bumping their height for more horizon presence.

**Ring radii.** `_buildRidgeline`: near 180 → 145, far 240 → 200. Near ring sits 3u outside the N-S axis fence at z=±142; the E-W axis fence at x=±125 sits comfortably inside the silhouette. Inner-fence diagonal corners (~169) poke past the near ridge in the back-left/back-right; that reads as "fence in front of mountain" — acceptable, and those corners are far enough back that they're rarely centered in any POI's frame.

**Ring heights.** Near `baseH 7→11, jitterH 8→14`. Far `baseH 16→24, jitterH 12→18`. Compensates for the larger overall scale post-b227 — pancake bumps now read as substantial mountains.

**Aviation beacons + window glints repositioned to match.** Beacon ring r 180 → 145, glint ring r 240 → 200, with proportional jitter trims. The ridge constellation (mast silhouettes + blinking beacons + warm/cool window glints) all stays bound to its host ring.

**Untouched.** Floor (still 360×360 from b227), fence envelope (still ±110/±125 from b227), watchtowers, antenna farm, conex stacks, base structures. Only the ridge horizon was tuned.

**Validation.** `cp js/scenes-selector.js c:/tmp/sc.mjs && node -c c:/tmp/sc.mjs` passes.

**Files touched:** `js/scenes-selector.js` (`_buildRidgeline` ring radii + heights, beacon r, glint r), `js/helpers.js` (b233 → b234 — hook auto-bumped through b232/b233 mid-edit), `FILE_MAP.md` (build/date), `CHANGELOG.md`. **Localhost only.**

---

## b233 — 2026-05-09 — Halo ring: actually open the face + move the core off the dead-center stack

User on the b232 screenshot: *"the forerunner thing gets in the way of the halo ring, we can move that thing, and the halo ring still at a bad angle when looking at it smh"*

Two real bugs from the b232 photo:

**1) Ring is still edge-on.** The b232 reorientation reduced `rotation.y` from `π/2 → π/2.45` (90° → 73°) which I claimed was a "3/4 view," but the math doesn't bear it out. With the camera at origin and ring center at `(40, 10, -460)`, the camera-direction-from-ring is essentially world-`+Z`. For the ring's inner face to be visible the symmetry axis needs to point near `+Z`, not perpendicular to it. `rotation.y = π/2.45` actually keeps the axis ~73° from camera direction (computed: `acos(0.197) ≈ 79°`) — still nearly edge-on. The screenshot confirmed it: ring rendered as two thin parallel arcs, exactly what an edge-on torus gives.

Real fix: `rotation.y = 0.35` (~20°). With `rotation.x = 0.45` retained for the forward-lean read, the axis ends up at `(0.309, -0.435, 0.846)`, dot-product with camera direction = `0.825`, off-axis angle = `~34°` — that's the actual 3/4 view. `rotation.z` pulled `-0.18 → -0.10` (the prior asymmetry roll was making the prior bad angle worse).

**2) Core landmark stacked on the ring.** `_buildCore` placed `this.coreGroup` at `(0, 0, -440)` — the original "centerpiece" position, set before the Halo ring landmark existed. The ring at `(40, 10, -460)` is essentially the same depth, and the core's Saturn-observatory-style ring system (4 toruses + central icosa orb) sits right inside the ring's inner-face view path. The screenshot shows the orb dead-center, occluding the ring's interior.

Moved the core to `(-180, -10, -440)` — into the empty left quadrant. Same depth (so the core's god-ray hookup at line 7047, which projects `coreGroup.position` to NDC, still produces sensible screen-space positions for the volumetric god-ray pass). Different angular sector — Marathon is far-left at `(-340, 36, -120)`, core now mid-left at `(-180, -10, -440)`, ring right at `(40, 10, -460)`. Three landmarks, three quadrants, none overlapping.

**What stayed.** The b232 geometry (R=240, r=12, 380×14 segs) is correct — the read was wrong because the orientation kept it edge-on, not because of size. Spin rate (0.0007 rad/frame), terrain shader frequencies/colors, outer-face cyan tone-down, cloud drift speed — all retained from b232.

**Validation.** `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` passes.

**Files touched:** `js/marathon-world.js` (`_buildCore` position only — `(0,0,-440)` → `(-180,-10,-440)`; `_buildHaloRing` rotations only — `rotation.y π/2.45→0.35`, `rotation.x 0.55→0.45`, `rotation.z -0.18→-0.10`), `js/helpers.js` (b232 → b233), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only.**

---

## b232 — 2026-05-09 — Halo ring: thicker, slower, opened up — terrain reads instead of glowing band

User on the b226 ring (two screenshots): *"the ring world for halo, it's a too thin it also moves like rotates way too fast. And so it can be a little bit thicker so that there's more diversity in the land. You know water and then like the land the greenery and it spins too fast. And then change its rotation on like the x-axis a little bit. To the right so that I can like see that a better view because right now I see like way too close to the camera. At this kind of almost parallel with the camera"*

The b226 screenshots showed the failure mode clearly: ring rendered as a near-vertical glowing ellipse, all cyan/yellow rim, zero terrain visible — exactly because the ring's symmetry axis was set fully along world-X (`rotation.y = π/2`) which puts the plane parallel to the camera's view direction (= edge-on). With a thin tube (r=5.5) at that angle, basically only the rim glow ever shows up. Compounded by spin rate so fast (0.0035 rad/frame ≈ one rev / 30s) that it didn't read as monumental, just busy. (Builds b228–b231 went to a parallel scenes session — this ring rework lands on b232.)

**Reorientation — open up the face.** `rotation.y` dropped `π/2 → π/2.45` (90° → ~73°), which swings the ring's axis ~17° toward the camera so the inner face presents in a 3/4 view rather than fully edge-on. `rotation.x` bumped `0.16 → 0.55` to lean the top of the ring away from camera — the curving plate now reads. Added `rotation.z = -0.18` for cinematic asymmetry (no longer mirror-symmetric across vertical screen axis). Position shifted `(-60, 5, -380) → (40, 10, -460)`: deeper Z so the near edge is no longer crowding the camera (was 152u from origin, now 220u), and X shifted positive so the ring lives in the right quadrant (Marathon ship is the left-quadrant landmark).

**Geometry — thicker tube.** `RING_r` doubled-plus: `5.5 → 12.0`. The visible inner-face band is now ~2.2× wider in screen-space at any given orientation, which is what gives the terrain shader enough vertical area to show actual oceans/continents/ice instead of a rim sliver. Bumped tubular and radial segs (`360→380`, `10→14`) to keep curvature smooth at the new radius.

**Terrain shader retune.** Same shader, recalibrated for the new tube width:
- Continent fbm frequency lowered: `vUv.x*7 + vUv.x*16` → `vUv.x*4.5 + vUv.x*11`. At the wider tube, lower frequencies make a few large landmasses dominate (continents) instead of pixel-noise (which read as static).
- Ocean color stops shifted darker/wider: `oceanDeep 0.045/0.16/0.38 → 0.030/0.13/0.36`, `oceanShallow 0.10/0.32/0.58 → 0.10/0.34/0.62`. Bigger contrast between deep and shallow zones.
- Forest land color saturated: `0.20/0.36/0.16 → 0.16/0.40/0.18` — the green reads as forest, not muddy.
- Ice cap threshold tightened: `0.78..0.96 → 0.82..0.97` — only the polar tips, not 22% of the band.
- Cloud layer drift slowed: `uTime*0.045/0.012 → uTime*0.020/0.006` and density pulled from `*0.55 → *0.45` so clouds don't smother the land/ocean mosaic.
- Atmosphere rim haze pulled `0.32 → 0.18` so the inner-face edges don't paint a wide blue smear over the terrain.
- Bass-driven cyan energy pulled `0.55 → 0.45` for the same reason.

**Outer-face cyan dominance fix.** The Forerunner alloy's seam/rim glow was over-intense in b226 — the ring photographed as a uniform cyan ribbon. Plate-seam strength `0.55 → 0.30`, side-rim glow `0.40 → 0.18`. The outer face now reads as dark structural alloy with subtle power lines instead of a glowstick.

**Spin rate.** `rotation.z += 0.0035 → 0.0007` per frame — 5× slower. At 60fps that's ~1 full revolution per 150s (~2.5min), which sells "monumental gravity-providing turn" instead of "spinning ride." Cloud layer drift was also slowed (above) so the apparent surface motion stays consistent with the geometry's spin.

**Validation.** `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` passes.

**Files touched:** `js/marathon-world.js` (`_buildHaloRing` rotation/position/geometry params, terrain shader retune, outer-face glow tone-down, `_tickHaloRing` spin rate), `js/helpers.js` (b231 → b232), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only.**

---

## b231 — 2026-05-09 — Scenes: bigger perimeter envelope — fence/floor/ridges/towers/antenna/conex all pushed out

User on `/scenes` ridge POI after b227: *"in the way of a lot of shit needs to be more on the outside man not right by the road ugh"* + *"bigger perimeter"*.

The b227 conex stacks landed at x=±70 to ±86 — inside the panel infield, blocking sight lines to v2 panels from ridge POI. And the whole perimeter envelope (fence x=±82/±90, watchtowers x=±88, floor 220×220) was tight against the patrol road at x=±78. Pushing the entire perimeter system out together so the fence wraps the actual base with breathing room, and the conex/staging clutter sits in the outer clear-strip where real installations stage it.

**1) Floor expanded.** `_buildEnvironment`: `PlaneGeometry(220, 220)` → `(360, 360)`. The road shader masks reference absolute world coordinates so the patrol road / spine / walkways stay locked to the same positions; the new floor area extends past the perimeter so the fence has visible ground on both sides.

**2) Ridges pushed out.** `_buildRidgeline`: near ring r=132 → r=180, far ring r=175 → r=240, with proportional jitter bumps (12→16, 16→20). Aviation beacons moved from r=132 to r=180. Distant window-glints from r=175 to r=240. Near ridge now sits 35-55u beyond the new outer fence corners, so the perimeter envelope reads against the silhouette horizon, not against the dirt right next to the fence.

**3) Inner + outer fence envelope expanded.** `_buildPerimeterClutter` constants: inner from `(IX=82, INZ=-94, IPZ=54)` → `(110, -128, 85)`, outer from `(OX=90, ONZ=-102, OPZ=62)` → `(125, -142, 98)`. Same 15u clear-strip width between inner and outer. Same razor-wire-on-inner pattern. Same posts-every-8u + continuous mesh panel + razor-coil-every-2.4u construction.

**4) Conex stacks moved into the new clear-strip.** Earlier b227 conex placement at x=±86 (in the OLD clear-strip) and at infield x=±70 is gone. New layout: 5 stacks per flank at x=±117 (between inner 110 and outer 125), spread along z from -120 to +45. Aligned along ±π/2 so the long 6u side runs along ±Z, fitting neatly inside the 15u corridor. 10 stacks total.

**5) Watchtowers pushed to new outer corners.** Was `(±88, ±58/±98)` — sat midway between the old patrol road (x=±78) and the old outer fence (x=±90). Now `(±127, ±100/-144)` — anchors the new outer fence corners with a 2u offset outboard. Patrols still loop at x=±78, z=-90/+50 and don't drive through any tower base.

**6) Antenna farm pushed further out.** From `(108, -8, -18)` → `(150, -8, -25)` — outside the new east outer fence at x=125 by 25u, sized for the new bigger perimeter envelope.

**Untouched.** Patrol loop (x=±78), patrol Hog beacons (b227), spine road, panel coords, walkways, panel hosts, and every existing structure inside the patrol envelope. Only the perimeter shell + the floor/ridges that frame it grew.

**Validation.** `cp js/scenes-selector.js c:/tmp/sc.mjs && node -c c:/tmp/sc.mjs` passes.

**Files touched:** `js/scenes-selector.js` (floor geometry, ridge radii + beacons + glints, fence inner/outer constants, conex stack positions, watchtower positions, antenna farm position), `js/helpers.js` (hook auto-bumped through b228/b230 mid-edit; final = b231), `FILE_MAP.md` (build/date), `CHANGELOG.md`. **Localhost only.**

---

## b227 — 2026-05-09 — Scenes: real perimeter — double fence + razor + patrol beacons + antenna farm + conex stacks

User on `/scenes` ridge POI: *"from ridge view, both sides of it look empty. whats on the end and perimeter of military bases, especially active ones with missile silos and shit like that"* + *"proceed pls"* on the recommended fence + watchtowers + patrol-beacon + antenna-farm package.

Towers and patrols already existed; the gap was that the perimeter "fence" was 32 sparse posts on a circle at r=92 (effectively invisible from the ridge), patrol Humvees had no rotating beacon to read as active security from a distance, the antenna farm was disabled in b193 because its old position clipped v2 panels, and the SE/SW flanks between v2 panels and the perimeter were empty desert. This commit lands the structural perimeter pieces in one cohesive pass — fences, beacons, antenna silhouette, and conex container scatter.

**1) Real rectangular double chain-link perimeter (`_buildPerimeterClutter`).** Replaces the b171 sparse circle. Inner fence at x=±82, z=-94/+54 — sits just inside the corner watchtowers at (±88, ±58/±98). Outer fence at x=±90, z=-102/+62 with an ~8u "clear zone" strip between (the raked-sand no-man's-land you see at real strategic-asset bases). New `buildFenceLeg(x1,z1,x2,z2,addRazor)` helper: posts every ~8u (4-sided cylinders, 0.10→0.13 taper, 2.6u tall), plus one continuous semi-transparent mesh-panel plane along each leg (alpha 0.55, doubleside) so the chain-link reads from a distance instead of being just a row of pickets. Inner fence gets razor-wire coils on top — small TorusGeometry(0.32, 0.03, 3, 6) every 2.4u, oriented along the leg axis with its loop facing across the fence direction. ~165 posts + ~213 coils + 8 panel planes total — well within the existing scene mesh budget.

**2) Conex shipping-container stacks on the empty flanks.** New inline `buildConexStack(x, z, yaw, count)` helper inside `_buildPerimeterClutter` after the fences. Each stack is `count` ISO containers (6×2.6×2.4) stacked vertically with slight color variation across an olive/sand/storm-grey palette and a darker door end-cap on the +X end. Seven stacks placed in the actually-empty zones visible from ridge POI: SW flank at (-72,-30) double, (-68,-12) single, (-74,+16) double; SE flank at (73,-32) double, (70,-6) single; back-of-base between bivouac and rear fence at (-32,+44) single and (32,+46) double. Yaws perturbed off-axis (±0.8 rad) so they don't read as a parade lineup.

**3) Rotating amber beacon on patrol Humvees (`_buildPatrolWarthog` + `_tickPatrolWarthog`).** Each of the 3 patrol Hogs gets a small steel housing (0.10×0.20 cylinder) on the cab roof at (0, 2.32, 0.60) plus an amber `_makeRunningLight(0xffaa22, 0.70)` lens at y=2.58. Sprite always faces camera, so the rotating-mirror sweep is faked in tick: `flash = 0.5 + 0.5 * cos(phase + t*5.5)` then opacity = `0.25 + flash² * 0.75` — squared falloff gives the sharp-spike-then-decay read of a real rotating beacon at ~0.9 Hz. Parked motor-pool Hogs intentionally don't get one (they're parked vehicles, not active security). Stored on `car.userData.beacon` for tick lookup.

**4) Antenna farm reactivated, relocated outside the eastern wire.** `_buildAntennaArray()` was defined but disabled in b193 (old position at (-58,-56) clipped through the broken-dish + dimensions panel hosts). Re-enabled in `init()` between fuel depot and watchtowers. Position changed from (-58,-8,-56) to (108,-8,-18) — outside the east outer fence at x=90. Provides silhouette punctuation on the eastern flank to balance the broken dish dominating the western back; from ridge POI you read 8 antenna masts (8-16u tall) staggered in a loose grid with 3 aviation strobes blinking at the tips, plus a small lit equipment shed at the south edge of the pad. Zero changes to the antenna builder itself — only its call site and final position.

**Why this approach** (vs. zone-by-zone scatter): from the ridge POI the eye reads the silhouette frame first (fence line, tower verticals, antenna masts, beacon flashes) and the floor-prop scatter second. Filling the silhouette layer first means subsequent zone-by-zone polish has structure to attach to instead of decorating dirt that disappears against the floor. Berms / fuel drums / cable spools deferred to the next commit per the user's recommendation acknowledgment.

**Validation.** `cp js/scenes-selector.js c:/tmp/sc.mjs && node -c c:/tmp/sc.mjs` passes (per memory: must validate as ES module, not CommonJS).

**Untouched.** No panels, no POIs, no shaders, no lighting tone changes, no camera. Existing watchtowers, jersey-wall lines, floodlight catenary, and patrol loop sampling all byte-identical aside from the per-Hog beacon attachment.

**Files touched:** `js/scenes-selector.js` (init call site, `_buildAntennaArray` final-position line, `_buildPerimeterClutter` fence rewrite + conex stacks helper, `_buildPatrolWarthog` per-hog beacon, `_tickPatrolWarthog` beacon flash), `js/helpers.js` (b226 → b227), `FILE_MAP.md` (build/date), `CHANGELOG.md`. **Localhost only.**

---

## b226 — 2026-05-09 — Galaxy: Halo ringworld landmark — curving plate, inner-face terrain, axial spin

User: *"and start local host for main page galaxy scenes and tracks"* + screenshots of the iconic Halo arc seen from inside the ring (continents curving up to the sky) and from space (ring + planet). Approved list: **Traveler / Marathon-rebuild / Covenant CCS + scripted scenarios / Halo ringworld**. Shipping the ring first because it's the most user-emphasized of the four; Traveler / Marathon / CCS follow in b227-b229.

**`_buildHaloRing()` placement & geometry.** New permanent landmark in `marathon-world.js`, called from `init()` right after `_buildMarathonShip()`. Big `TorusGeometry(R=240, r=5.5, 10×360 segs)` — major radius gives the ring its dramatic sweep, the thin tube radius keeps it reading as a ribbon plate (matches canon ~32:1 ratio). Group placed at `(-60, 5, -380)` so the arc sits slightly off-center forward; `rotation.y = π/2` swings the ring's symmetry axis from default-Z to world-X, then `rotation.x = 0.16` adds the lean that makes the curve read as "horizon → up → far depth" instead of dead-flat. Distance from camera-origin to ring far edge ≈ 624u — within the 800u camera far plane and inside the title sphere's outer radius (`SHELL_RADIUS = 130`) by a wide margin, so titles partially occlude the ring's near edge organically.

**Two-faced shader.** Single `ShaderMaterial`, `side: DoubleSide`. Vertex stage classifies each fragment as **inner** vs **outer** face by computing the object-space tube center (`normalize(position.xy) * 240`), then `dot(vertexNormal, radialOutward)`: negative = inner (faces the ring's symmetry axis = the inhabited surface), positive = outer (the structural exterior). Passed to fragment as `vInnerFace` (0/1) plus `vRimMix` (peaks at the side rims where the two faces meet).

**Outer face — Forerunner alloy.** Dark base `vec3(0.085, 0.092, 0.110)` modulated by a 5-octave fbm ridge pattern. Plate seams: `step(0.985, fract(vUv.x * 60.0))` runs ~60 panel boundaries around the major circumference, painted in cyan-blue trim `vec3(0.18, 0.45, 0.62)` for that "power conduit" Forerunner read. Side rims gain extra cyan glow via `smoothstep(0.55, 0.95, vRimMix)`. Subtle bass coupling so the alloy breathes (`*= 1.0 + uBass * 0.12`).

**Inner face — terrain band.** V coordinate remapped to `lat = (vUv.y - 0.5) * 2.0` (-1..1 across inner band). Continent mask = sum of two octave bands of fbm; `landMask = smoothstep(0.42, 0.50, cont)` gives a clear coast threshold. Color stack: `oceanDeep → oceanShallow` mixed by continent value, `forest → desert` for land variations, mixed by mask. Ice caps near the band edges via `smoothstep(0.78, 0.96, abs(lat))` painted in `vec3(0.88, 0.93, 1.00)`. **Cloud layer** = additional fbm with `uTime * 0.045` translation on U and `uTime * 0.012` on V — clouds drift around the ring at different rates than they spread, selling planetary motion. Atmosphere haze paints a bluish rim glow (`vec3(0.42, 0.58, 0.92)`) at the band edges where atmosphere refracts on the curve. Bass-driven cyan energy adds a 0.55-strength glow on bass hits — the Forerunner ring "alive" when the music drops. Inner face brightened ×1.10 for the sun-lit relative-to-outer feel.

**Spin.** `_tickHaloRing(t, bass)` increments `mesh.rotation.z` by `0.0035 rad/frame` (canon: rotation provides gravity for inhabitants). Spin is on the inner mesh, not the group, so the lean orientation stays locked while the surface rotates underneath. The cloud layer `uTime` translation already gives separate apparent motion, so you read both "ring spinning" + "weather moving" as distinct.

**Fog opt-out.** `ShaderMaterial` deliberately omits `fog: true` — at scene fog density `0.0035`, anything past ~400u gets totally swallowed. The far edge sits at ~624u from origin, which would render to near-black without the opt-out. `transparent: false` + `depthWrite: true` so titles, satellites, and shards depth-sort against the ring correctly.

**Admin wiring.** New `el-haloring` toggle in the **scene elements** section of the admin panel (the `~` overlay), positioned right after `el-marathon`. Wired through `_adminToggleElement` (`haloring` → `this.haloRing.grp`) and `_adminUpdateHints` so the ON/OFF chip stays in sync with the actual `grp.visible` state. Ring is ON by default.

**Validation.** `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` passes (per project memory: must validate as ES module, not CommonJS).

**Untouched.** No existing scenarios, no flyby pool changes, no other landmark touched. Marathon ship at `(-340, 36, -120)` is byte-identical. The ring sits in a different quadrant of the void so the two landmarks don't fight for attention.

**Files touched:** `js/marathon-world.js` (build call in init, tick call in animate, `_buildHaloRing` + `_tickHaloRing` ~115 lines, admin button HTML, `_adminToggleElement` map entry, `_adminUpdateHints` line), `js/helpers.js` (b225 → b226), `FILE_MAP.md` (build/date/helpers ref), `CHANGELOG.md`. **Localhost only.**

**Roadmap.** b227 = The Traveler (white sphere landmark, opposite quadrant). b228 = Marathon rebuild (replace generic spine-cylinder with canon hollowed-Deimos asteroid + spinning habitat ring + comm tower). b229 = Covenant CCS-class battlecruiser model + 5 scripted scenarios (slipspace arrival, glassing beam, broadside duel, fleet escort, autumn-pursuit) wired to admin with `_scenarioFollow` camera locks.

---

## b225 — 2026-05-09 — Remove `/galaxy.html` — "the galaxy" = `/`, the duplicate page is gone

User: *"http://localhost:8000/galaxy.html - remove this page. when i refer to galaxy im referring specifically to : http://localhost:8000/(main page)"*

Single source of truth for the galaxy is now `/` (mounting `MarathonWorld` from `marathon-world.js`). The standalone `/galaxy.html` (which mounted the parallel `TextGalaxyPro` from `text-galaxy-pro.js`) was a sister build kept around for fly-cam navigation iteration; it became a vocabulary trap — "the galaxy" referred to the main page, but the URL collided with a separate scene that shared the look-and-feel. Killing the duplicate so future ship/animation work in this thread targets `marathon-world.js` unambiguously.

**Deleted:** `galaxy.html` (entry page, ~155 lines), `js/text-galaxy-pro.js` (~720-line module). The TextGalaxyPro window export goes with it.

**Nav scrub.** Both `js/corridor.js` (line 333) and `js/object.js` (line 370) had a `<a href="/galaxy.html">galaxy</a>` link in their HUD nav strip alongside `home` / `catalog` / `corridor`. Dropped the dead link from each — those scenes now show `home / catalog` (corridor) and `home / catalog / corridor` (object). The `home` link already covers what "galaxy" was reaching.

**Docs scrub.**
- `FILE_MAP.md`: removed the `/galaxy.html` route entry from the Routes section, removed the `js/text-galaxy-pro.js` files entry, bumped the helpers.js entry's parenthetical from `b105 → b225` (was stale anyway), and added a clarifying note on the `/` route line that "the galaxy = `/`".
- `STYLEGUIDE.md`: removed the `/galaxy.html (Text Galaxy Pro)` rollout subsection.
- `CHANGELOG.md` historical entries (b105, b106, b148, b155, b161 etc.) intentionally untouched — they reference the page as it existed at the time and rewriting history would obscure the build trail.

**Untouched.** `marathon-world.js`, `index.html`, `_redirects`, `serve.py`. The main page (`/`) is byte-identical to b224.

**Files touched:** `galaxy.html` (deleted), `js/text-galaxy-pro.js` (deleted), `js/corridor.js` (1-line nav), `js/object.js` (1-line nav), `STYLEGUIDE.md` (subsection removed), `FILE_MAP.md` (route + file entry removed, header bumped), `js/helpers.js` (b224 → b225), `CHANGELOG.md`. **Localhost only.**

---

## b224 — 2026-05-08 — Scenes: globally brighten the base — assets are silhouettes, not lit by night

User on `/scenes`: *"a lot of our assets are dark, is this illumination globally, do they need their own lights? even tho its night time its a military base, i want it illuminated everywhere and on builidngs and assets and all etc"*

The structures read as silhouettes against the slightly-brighter ground because **every building/asset in `scenes-selector.js` uses `MeshBasicMaterial` (unlit)**. There is no real lighting in this scene — adding `AmbientLight` / `HemisphereLight` / `PointLight` would do nothing because `MeshBasicMaterial` ignores all lights. The "darkness" is baked directly into the hex constants (0x14171e steel, 0x0a0c12 near-black, etc.). And b213-b216 stripped the additive halo sprites that previously painted glow columns onto buildings (those were turning into rectangular bloom artifacts), which left the buildings unilluminated entirely.

So the fix is two-pronged: lift the **base material colors** so structures aren't near-black to begin with, and add a **global post-pass brightness gain** so everything reads brighter overall. No additive halos re-introduced.

**1) Post-pass brightness lift.** In `POST_FRAG` after the CA sample, added `col = col * 1.18 + 0.028;`. Gain + tiny black-floor lift before the scanline modulation. Pure black goes from 0 → ~7/255; mid-grey 0x808080 goes from 128 → ~158. Bright panels stay bright (within tone range), but the building hexes lift visibly.

**2) Dark hex-color bumps.** File-wide `replace_all` on every dark `MeshBasicMaterial` constant. New values are ~80-100% brighter while keeping the same hue character (steel still cool, olive still warm). Concrete medium-dark tones bumped ~50%. Examples:
- `0x14171e` (steel, 20× usage)        → `0x2a3142`
- `0x14171d` (sandbag, 5×)             → `0x2a3040`
- `0x0a0c12` / `0x0c0e14` (near-black) → `0x191d28` / `0x1d2230`
- `0x222836` / `0x242a36` (concrete)   → `0x36404f` / `0x3a4358`
- `0x303848` / `0x2c3344` (concrete lit) → `0x4a5468` / `0x424c64`
- `0x232714` / `0x232a1c` (olive dark) → `0x3a401e` / `0x3a4030`
- `0x1f2218` / `0x2c3122` (ODST armor) → `0x363c2c` / `0x42493a`
- `0x202028` / `0x22252e` (body)       → `0x363640` / `0x3a3e4a`
- `0x1c1f27` / `0x1a1d24` / `0x1c2028` / `0x1e222b` (accents/dish) → brighter family
- `0x281a14` (broken steel)            → `0x4a3225`
- `0x16191f` / `0x10131a` (dark)       → `0x2c303a` / `0x3a4050`

**3) Ground lift + fog tweak.** Floor shader's base dirt color `vec3(0.135, 0.112, 0.075)` → `vec3(0.175, 0.148, 0.105)` so the desert reads as moonlit, not void. Fog `0x06080d @ 0.015` → `0x0e1218 @ 0.0115` — slightly brighter cool-grey haze and ~23% less density, so the missile silo and back-rim dishes don't get swallowed before they read.

This intentionally does NOT add new lights, sprites, or beam volumetrics — those were the b213-b216 problem. The scene reads "illuminated military base at night" via brighter base albedo + post lift, which is how dim-light games actually achieve that look anyway (lift the floor, don't paint halos).

**Validation.** `cp js/scenes-selector.js c:/tmp/sc.mjs && node -c c:/tmp/sc.mjs` passes.

**Files touched:** `js/scenes-selector.js` (POST_FRAG `col = col * 1.18 + 0.028`, fog color/density, dirt-color lift, ~22 hex `replace_all`s), `js/helpers.js` (b223 → b224), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only.**

---

## b223 — 2026-05-08 — Tracks: instrument init() so the next reload pinpoints the black-screen cause

After b222's cache-bust, `/tracks` was still blank. Console: 0 errors, 1 user log (`[audio] localhost detected — forcing audioBase`), 969 AudioContext-warn-after-user-gesture warnings (one per RAF, ~16s of run-time), and a `requestAnimationFrame` violation at 468ms. So `tracks-daw.js` is loading and `animate()` is running — but the DAW UI is invisible.

Added 3 instrumentation points to `TracksDaw.init`:
1. `console.log('[daw] init() start, container =', container, 'tracks =', n)` — prints the mount node and track count up-front.
2. `console.log('[daw] root mounted. rect =', w, 'x', h, 'parent =', parentId)` — fires immediately after `container.appendChild(root)`. Tells us whether mount happened, the rect is non-zero, and the parent is `#app`.
3. Wrapped `_buildSession()` in try/catch. If it throws, we log the error AND inject a red error string into the grid so the user sees it instead of pure black.

Also wrapped `_wireEvents()` in its own try/catch for symmetry.

Next reload of `/tracks` will produce one of three outcomes that nail the bug:
- `[daw] init() start` doesn't appear → SPA router never reaches `bootTracksDaw` (route mismatch).
- `[daw] root mounted. rect = 0 x 0` → CSS issue (`.daw-root` not sizing — most likely `position:fixed; inset:0` is being defeated by a parent containing block I haven't spotted).
- `[daw] _buildSession threw: …` → the silently-swallowed exception that's the actual root cause.

**Files touched:** `js/tracks-daw.js` (init: 3 console.log calls + try/catch around `_buildSession` and `_wireEvents`), `js/helpers.js` (b222 → b223), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only.**

---

## b222 — 2026-05-08 — Scenes: hoist `cbW/cbH/cbD` (b217 TDZ); tracks: cache-bust loader

User reported `/scenes` had hopped to a NEW error after b220 fixed `olive`:
```
Uncaught ReferenceError: Cannot access 'cbD' before initialization
    at _buildMissileSite (scenes-selector.js:6135:66)
```

**`/scenes` fix.** The `cbW = 5, cbH = 4, cbD = 5` line declaring the control-bunker dimensions sat at line 6172 — but b217 had added a blast-door + HVAC block at lines 6133-6153 that referenced `cbD` and `cbH`. Same b217 mistake as the `olive` issue: code added in the wrong order so refs preceded their `const`. Hoisted the bunker-dim line to just above the blast-door section (line ~6128) and removed the duplicate. Single declaration; both blocks see it.

**`/tracks` fix.** User also reported `/tracks` was a blank screen with no JS errors — only AudioContext autoplay warnings (expected). Console showed `_readAudio @ tracks-daw.js:806` running, meaning init ran far enough to start the analyser. Disk file looked correct, file served correct content. Strong signal: stale Vivaldi script cache holding an older broken `tracks-daw.js`.

Replaced the static `<script src="/js/tracks-daw.js"></script>` tag with a tiny inline loader that appends `?v=${Date.now()}` to the URL — same trick b221 applied to `scenes-selector.js`. Forces a fresh fetch every page load. Production CDN cacheability unaffected (Cloudflare ignores arbitrary query params for cache key by default).

**Validation.** `cp js/scenes-selector.js /tmp/sc.mjs && node -c /tmp/sc.mjs` passes.

**Files touched:** `js/scenes-selector.js` (hoist `const cbW/cbH/cbD`, remove duplicate), `index.html` (replace `<script src=tracks-daw.js>` with timestamped dynamic loader), `js/helpers.js` (b221 → b222), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only.**

---

## b221 — 2026-05-08 — Scenes: timestamp cache-buster on the scenes-selector import

Even after b220 fixed the `olive` ReferenceError on disk, Vivaldi/Chrome served the cached pre-fix module — same line 6039 error after a hard reload. ES-module caching ignores the standard reload-bypass on some Chromium builds.

Switched `scenes/index.html`'s import from a static path to `await import(\`/js/scenes-selector.js?v=${Date.now()}\`)`. Every page load forces a fresh fetch (cheap during dev — the file is local). Cloudflare's prod CDN ignores arbitrary query params for cache key by default so prod cacheability is unaffected.

**Files touched:** `scenes/index.html` (import statement), `js/helpers.js` (b220 → b221), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only.**

---

## b220 — 2026-05-08 — Scenes: fix b217 ReferenceError — `olive` / `oliveHi` undeclared in `_buildMissileSite`

User reported `/scenes` showed HUD but black canvas. Console gave the answer:

```
scenes-selector.js:6039 Uncaught ReferenceError: olive is not defined
    at Object._buildMissileSite (scenes-selector.js:6039:72)
    at ensure (scenes-selector.js:1349:10)
    at Object._buildAllStructures (scenes-selector.js:1351:5)
    at Object.init (scenes-selector.js:178:10)
```

`init()` builds the HUD before structures (line 148 vs 178), so the HUD overlay rendered fine — then `_buildMissileSite` threw and aborted the rest of `init` (renderer setup runs but no panels/environment are completed and the animate loop never starts cleanly).

**Cause.** b217 ("realistic-bases pass #1") added the **generator shed** to the missile silo: `BoxGeometry(gsW, gsH, gsD), olive` at line 6039 + `BoxGeometry(gsW + 0.3, 0.18, gsD + 0.3), oliveHi` at line 6043. The `_buildMissileSite` material block (lines 5781-5786) declares `concrete`, `concreteLit`, `yellow`, `stencil`, `steel`, `accent` — no `olive` / `oliveHi`. The b217 author copy-pasted from another scene's material vocabulary (the file has `olive = 0x3a4030` / `oliveHi = 0x4d5440` declared in 4 other functions: `_buildBarracksRow`, `_buildScorpions`, `_buildWarthog`, etc.) but didn't carry the declarations into the missile-site scope.

**Fix.** Two lines, in the `_buildMissileSite` material block:

```js
const olive = new THREE.MeshBasicMaterial({ color: 0x3a4030 });
const oliveHi = new THREE.MeshBasicMaterial({ color: 0x4d5440 });
```

Same color values used everywhere else in the file. The shed body now reads as olive-drab military with a slightly lighter roof slab, exactly the silhouette b217's CHANGELOG describes.

**Validation.** `cp js/scenes-selector.js /tmp/sc.mjs && node -c /tmp/sc.mjs` passes (lesson from b212 — never trust `node --check` on raw `.js`; ES-module reference errors only surface in browser).

**Files touched:** `js/scenes-selector.js` (2-line addition to `_buildMissileSite` material block), `js/helpers.js` (b219 → b220), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only.**

---

## b219 — 2026-05-08 — Galaxy admin: surface every scenario in the menu (4 missing full + 6 missing micros)

User: *"account for everything in admin menu like put it there"* (after b218 — they noticed scenarios in the auto-spawn pool that had no admin button).

Audited `_spawn*` definitions vs admin buttons. Missing full scenarios: `_spawnPirateAmbush`, `_spawnPatrolPair`, `_spawnComet`, `_spawnEvaTether`. Missing micros: `_spawnMeteorMicro`, `_spawnPulsarMicro`, `_spawnCloseFighterMicro`, `_spawnCommStaticMicro`, `_spawnEmpFlashMicro`, `_spawnDroneDartMicro`.

**Added to existing sections:**
- *cinematic*: `scen-eva` (eva tether), `scen-comet` (comet pass)
- *fleet ops*: `scen-patrol` (patrol pair), `scen-pirate` (pirate ambush)

**New section — *micro events*:** all 6 micros (`micro-meteor`, `micro-pulsar`, `micro-buzz`, `micro-comm`, `micro-emp`, `micro-drone`).

Click-handler block extended with the matching dispatches. Every spawn function now has a way to be triggered from the admin panel.

**Note re: pelican-lead interception (b218).** Verified my edit landed correctly — `_spawnInterception` lead is `_acquireShip('pelican')`, the `interception_target` tick branch type-guards on `'pelican'`. If the user is still seeing 3 banshees, that's stale browser cache — `Ctrl+Shift+R` in Vivaldi clears it.

**Validation.** `cp js/marathon-world.js /tmp/c.mjs && node -c /tmp/c.mjs` passes.

**Files touched:** `js/marathon-world.js` (admin HTML — 4 buttons added to existing sections + new "micro events" section with 6 buttons; click handler dispatch — 10 new branches), `js/helpers.js` (b218 → b219), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only.**

---

## b218 — 2026-05-08 — Galaxy: pelican-led interception + new "distress bombing run" scenario

User: *"interception 2v1 on galaxy spaces 3 ships. the one in front should be the pelican / love our distress beacon. any way to have a new version where an enemy ship flies by, bombs the distressed thing and it explodes? so the purple banshee or lancer would fly by bomb it"*.

**1. Interception scenario — lead is now a pelican.**
`_spawnInterception` previously spawned 3 banshees in a 2-vs-1 formation (1 lead + 2 chasers behind). Lead swapped to pelican (UNSC dropship being intercepted by 2 covenant fighters). Speed dropped 48 → 42 to match the heavier silhouette; chaser speed 60 → 56 (gap=14 over 14s, chasers close mid-scenario). The `interception_target` tick branch now matches `s.type === 'pelican'`, drops the banshee barrel-roll line, and uses a smaller evasive sway envelope (lateral 14 → 8, vert 6 → 3.5; phase rates softened) so the dropship lumbers across the field instead of flicking like a fighter.

**2. New scenario — `distress · bombing run`.**
`_spawnDistressBombing` reuses the visual signature of `_spawnDistressBeacon` (red SOS strobe + amber rotating + white emergency strobe + two persistent damage fires + smoke trail + sparks + listing tumble) on a parked pelican, then a banshee or longsword (50/50) strafes in from one side at 58 u/s. The bomber fires a fat slow bolt (scale 1.4, life 1.4s, color matches type — magenta plasma for banshee, amber for longsword) at scenarioTime 1.3s, computes detonation time from bolt travel distance/speed, and at impact flips a `detonated` flag on the victim's scenarioBase.

The victim's tick branch (folded into the existing `distress_beacon` branch via an OR-guard) checks that flag every frame: when set, it switches to explosion FX — a 14u flash sprite scales up + fades over 0.85s, a billboarded shockwave ring (`RingGeometry(1.0, 1.08, 64)`, additive) scales to 16u + fades over 0.85s, a 0.6s burst pumps 3 sparks/frame outward at 14 u/s into a bumped 24-sprite pool, and the hull goes invisible after 0.18s. Smoke + spark sprites continue ticking to evolution. After the explosion, normal scenario expiration (`maxLife = 9`) cleans everything up via `scenarioCleanup` (disposes flash, ring, ringGeo/Mat, plus all the beacons/fires/smokes/sparks).

Bomber: type-agnostic `distress_bomber` tick branch (since either banshee or longsword can be picked). Banshee gets the continuous barrel-roll, longsword gets the bank tilt. Both peel out via base velocity inertia; `maxLife = 8` retires them after the explosion completes.

Wired into the auto-spawn pool (`['bombing', () => this._spawnDistressBombing()]`) and the admin panel (cinematic section, button `scen-bombing → distress · bombing run`).

**Validation.** `cp js/marathon-world.js /tmp/c.mjs && node -c /tmp/c.mjs` passes (per b212 rule — never trust `node --check` on raw JS).

**Files touched:** `js/marathon-world.js` (interception lead swap + tick guard, new `_spawnDistressBombing` + 2 tick branches, scenario pool registration, admin button + handler), `js/helpers.js` (b217 → b218), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only.**

---

## b217 — 2026-05-07 — Scenes: realistic-bases pass #1 — missile silo (galaxy hero) gets a real launch complex

User: *"its fixed pls move onto structural pass"* (after b216 nailed the halo/uplight problem). Phase 1 of the realistic-bases pass kicks off with the centerpiece — the missile silo at world (0, -8, -107), galaxy panel host. Most visible structure on the base.

**Before.** A 2-post vertical gantry (just 2 posts + horizontal cross-bars on one face, no platforms, no ladder). 1 cone cap. 5×4×5 control bunker, slit window, sandbag perimeter, 4 jersey barriers. Read as "abstract sci-fi obelisk on a target pad."

**After.** A real launch complex.

- **4-leg lattice gantry** (was 2 posts). 1.8×1.6 footprint, 14.5u tall, 4 vertical legs at the corners. **Diagonal X-bracing on every face × 5 height tiers** — every face of the tower has both diagonals AND a horizontal stringer at every level. ~120 lattice members total. Reads as actual rocket-pad scaffolding from any angle.
- **3 service platforms** at 1/3, 2/3, and 95% height. Each platform is a 0.10u-thick deck slab + 7 transverse slats + 4 corner handrail posts + double-rail (top + mid) on all sides + 1.0u toe-kick. Service arms at the lower two platforms reach toward the silo with a torus-loop "fuel/cryo hose" half-coil.
- **Caged ladder** climbing the camera-facing leg pair: 2 vertical side rails + rungs every 0.4u + safety hoops every 0.7u above 3u (proper hooped fall-cage). Reads as a real climbable ladder, not just a drawn line.
- **Lightning rod + aviation strobe** at the gantry top (0.40 brightness, 1.6Hz red — registers in standoff strobe pool).
- **LOX / cryo tank** beside the silo (4u tall, 1.1u radius). Insulated cylinder with 3 frost-banding rings, dome end-cap, 1.6u vertical vent stack, hazard placard on the camera face, 2 cradle saddle supports at the base, and a horizontal 0.10u conduit running from tank base toward the silo (fuel feed). Reads as cryogenic storage, exactly the read for a launch pad.
- **Generator shed** off the SE corner (3.4 × 2.4 × 4.0u). Olive-drab body, slightly lighter roof slab, 1.4u-tall diesel exhaust stack with a conical rain cap, 5 louvre vents on the long face, warm-glow door (registered for window-flicker), 2 fuel drums beside the shed.
- **Cable tray network** running at ground level: tray from generator shed → control bunker → silo base, with 3 vertical pillar supports. Reads as actual electrical infrastructure tying the complex together.
- **Antenna farm** behind the bunker: 3 dipole masts (4.5/3.9/3.3u tall), each with a cross-dipole element near the top. Tallest carries 3 guy wires fanning out at 120° intervals to ground anchors.
- **Bunker entrance**: 3-tread concrete stair landing leading up to a 1.4×1.9u steel **blast door** in a thicker frame. Wall-mount lamp beside the door (warm 0.18 brightness).
- **HVAC unit on the bunker roof**: 1.4×0.7×1.0 box + a 0.30u radius round fan grille on top. Reads as actual HVAC.
- **Blast deflector ring** around the silo base: a 0.50u-tall ring (siloR+1.2 inner, siloR+1.6 outer) with yellow caution-paint top — the structural lip that real silos have to redirect launch exhaust away from the gantry.

**Net.** ~250 added meshes on this one host. The silo zone now reads as a working launch complex with cryo storage, power, comms, ingress, and pad infrastructure — not as a single decorated cylinder. Every element is real geometry (no additive sprites, no fake "glow" — those are what got us into trouble all morning), so silhouettes hold up at any angle and there's no halo painted around anything.

**Why ship just the silo first.** Phase-1 demonstrates the level of structural detail. If the look reads, I'll bring the same density to the other 8 panel hosts (comms_array_shed, forward_ops_radar, sigint_tower, logistics_yard, broken_dish, sensor_pylon, biostation_quarantine, back_billboard_lattice) in subsequent builds. If the direction needs adjustment (too busy / not busy enough / wrong details), better to course-correct after one host than after nine.

**Files touched:** `js/scenes-selector.js` (`_buildMissileSite` rewrite — kept original silo body, missile, control bunker, sandbag/jersey perimeter; replaced 2-post gantry with full lattice tower; added LOX tank, generator shed, cable trays, antenna farm, blast door, HVAC, blast deflector). `js/helpers.js` (b216 → b217). `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only**.

---

## b216 — 2026-05-07 — Scenes: clear roads, spread the airfield, lift base illumination, kill colored building halos

User: *"focus on scenes page. images show that the whole base is not well illuminated. random glows tints emitted from objects, billboards and buildings. buildings are randomly psotioned, get in the way of the road, are diagnoal to the road, position doesnt make sense. deep sea obstructs road. 4 titty like silos obstruct the road. organism buildig obstructs the road. tents cars and a tank all packed togehter in a tiny little space. mountain formation bgtets in the way of the road, jeep just drives thru the mountain like its nothing. tackle this stuff and then well do more"* (5 screenshots — full panel arc, deep-sea sign close-up, broken-dish corner, tents+vehicles cluster, cyan-circled "where the road should go" overlay).

A focused first pass on layout + illumination. **Six concrete fixes, all `js/scenes-selector.js`:**

- **Mountain ring no longer crosses the perimeter road.** `_buildRidgeline` near ring radius pushed 100→132. Old radius crossed N perimeter (z=-90, x=±78) at x=±43.6, so the patrol Warthog and Scorpion drove straight through the silhouette mesh. r=132 puts the ridge at x≈±97 along z=-90 — outside the road's x=±78 bounds. Far ring matched out 165→175 to preserve parallax depth. The 14 aviation-beacon masts and 24 distant-window glints follow the new radii.

- **Missile silo cleared off the N perimeter.** `_buildMissileSite` `_placeBuilding` z=-94 → -107 (offset -88-6 → -88-19). Sandbag perimeter (silo + 8.9u) used to sit at z=-85.1, dead inside the road (z=-90 ±4.5). New position puts the sandbag north edge at z=-98.1 — 3.6u south of the road. Galaxy panel still floats at (0, 10, -88) so the billboard reads as the entry sign for the launch zone behind it instead of growing out of the asphalt. Stadium pylons (`_buildBaseLighting`) shifted -82/-106 → -98/-120 to surround the relocated silo, lookAt target moved -94 → -107, three building-flood beam aim points and source positions matched. Galaxy ground-crew personnel route from-/to- z=-82 → -98. Structure-uplight target moved 0,-94 → 0,-107.

- **Fuel depot off the E perimeter.** `_buildFuelDepot` group placed at (62, -8, 8) instead of (72, -8, 8). Old position put the east tank pair at world x=77, sitting inside the E perimeter road (x=78 ±4.5) — those are the "4 silos blocking the road" from the user's screenshot. Building-flood beam aim updated 72 → 62.

- **SE airfield no longer a 12u-square pile.** Parked Warthogs spread (38,20)/(32,24)/(45,18) → (32,8)/(50,12)/(40,22). Parked Scorpion (28,16) → (22,14). SE bivouac tent cluster (22,16) → (8,24). SW bivouac (-22,18) → (-26,20). Walking-personnel routes anchored to the new bivouac coords. Jersey wall that used to run z=12 across the airfield (cutting straight through the new motor pool) pulled to z=4 as the airfield's south frontage; SW jersey followed the bivouac west. Vehicles and tents now occupy distinct lanes instead of a single jam.

- **Base brightness lifted.** Floor shader: distance-fade base 0.78 → 1.05, fade amplitude 0.22 → 0.30; moonlight wash bumped vec3(0.005, 0.008, 0.014) → vec3(0.022, 0.028, 0.038). The desert ground reads as actually-lit-by-floodlights now instead of "barely-discernible-tan-against-black."

- **Random colored building halos toned down.** `_buildStructureUplights` opacity 0.85 → 0.38, scale 12×24 → 8×14 — these warm/cool/amber additive sprite cones at every host's base were the dominant "random tints around buildings" the user flagged (each painted a wide colored haze rectangle bloomed by the post-FX). Atmospheric back-glow sprites in `_buildEnvironment` opacity 0.45/0.40 → 0.18/0.15, pulled deeper to z=-100/-95 so they form a horizon glow instead of veiling the foreground. Building-flood beam lens dots opacity 0.16 → 0.08 (~22 of them; each was a small bloom-source that aggregated into atmospheric haze). Bloom itself was already toned (b214: strength 0.20, threshold 0.75, radius 0.25) so this pass leaned on opacity, not bloom.

**Validation.** `cp js/scenes-selector.js /tmp/c.mjs && node -c /tmp/c.mjs` passes (the lesson from b212 — `node --check` parses as CommonJS and silently allows ES-module-breaking patterns; always validate as `.mjs`).

**Files touched:** `js/scenes-selector.js`, `js/helpers.js` (b215 → b216), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only.**

---

## b215 — 2026-05-07 — Galaxy + Scenes: REVERT b207 — restore the inner.rotation.y = π flip; ships fly nose-first again

User: *"random dog fight encoutner but the pelican ship was fighting no one just reversing and shooting / pelica nvs banshee script pelican flies backwards / fleet ops flies backwards / |same with convoy / carrier launch as well longsword. / all ships fly backwards bro like theyre giubg the wrong way"* (with three screenshots — distress pelican, dogfight, longsword carrier launch all clearly tail-forward).

**The b207 fix was wrong.** I had the `Object3D.lookAt` convention reversed. For **camera or light** subclasses, `lookAt` aims local **-Z** at the target. For every **other** Object3D — including Group/Mesh — three.js [swaps the `Matrix4.lookAt` arguments](https://github.com/mrdoob/three.js/blob/master/src/core/Object3D.js) (`_m1.lookAt(_target, _position, this.up)` instead of `(_position, _target, this.up)`), which makes the resulting matrix's **+Z** column point at the target. So a regular Group's local **+Z** axis ends up aimed at whatever you pass to `lookAt`.

That means the original codebase was correct:
- Models built with nose at local **−Z** (cockpit at `z = -3.2`, engines/exhaust at `z = +2.6..+10`)
- `inner.rotation.y = π` flips the inner so the nose lives at outer's **+Z**
- `outer.lookAt(target)` aligns outer's **+Z** with the velocity direction → nose leads → forward

By stripping the `Math.PI` everywhere in b207, I made every ship fly tail-first.

**This pass restores the original convention** + adds a leading comment in each constructor explaining *why* the flip is there, so the next person reading it doesn't repeat my mistake.

**Galaxy (`js/marathon-world.js`):**
- 4 constructors (`_makeLongsword`, `_makeBanshee`, `_makePelican`, `_makeForerunner`): re-added `inner.rotation.y = Math.PI;` plus a 4-line comment block explaining the camera-vs-non-camera lookAt distinction.
- 36 spawn-site `inner.rotation.set(0, 0, 0)` → `.set(0, Math.PI, 0)`.
- 5 plain `inner.rotation.y = 0;` → `= Math.PI;` (animate-loop pose resets between scenarios).
- 6 composite formulas restored: `Math.PI + s.scenarioTime * 0.22`, `... * 0.4`, `Math.PI + tt * 0.3`, `Math.PI + Math.sin(s.rollPhase * 0.4 + 1.0) * 0.10`, `Math.PI + Math.sin(s.rollPhase * 0.42 + 1.0) * 0.10`, `Math.PI + s.rollPhase * 0.22`.

**Scenes (`js/scenes-selector.js`):**
- `_respawnFlyby` (line ~3074): re-added `ship.rotateY(Math.PI);` after `ship.lookAt(target)` with a corrected comment.
- `_startPelicanRun` (line ~3180): same — `sp.rotateY(Math.PI);` restored after `sp.lookAt(dropZone)`.

**Altitude floor kept.** The altitude bug from b207 (low-pass branch flying at `camY − 6..−10` = below ground) was a separate, real fix. That one stays — flybys still spawn at `camY + 3..6` (low pass) / `camY + 6..12` (mid) / `camY + 18..28` (high). No more ground-clipping.

**Distress beacon kept.** b210's fire/smoke/sparks/multi-beacon distress pelican is unaffected — the spawn already used `inner.rotation.set(0, Math.PI, 0)` (which got correctly restored by the global swap), so the listing tumble + flame/smoke effects all still work.

**Lesson for the index.** Three.js `Object3D.lookAt` is **+Z-aimed for non-cameras, -Z-aimed for cameras/lights**. Always verify against the source before "correcting" widespread codebase conventions — a globally-applied wrong fix is worse than a single misread ship.

**Files touched:** `js/marathon-world.js` (~50 reverts across constructors + spawn sites + composite formulas), `js/scenes-selector.js` (2 surgical reverts), `js/helpers.js` (b214 → b215), `FILE_MAP.md` build header, `CHANGELOG.md`. Localhost only.

---

## b214 — 2026-05-07 — Scenes: NUKE all panel tint + glow (three-prong attack)

User: *"remove the fucking glow or tint from all the billboards fucker"* (with screenshot showing every billboard still ringed by a clearly-tinted rectangular halo — cyan freq map, pink dimensions, cyan galaxy, green living wall, orange tape spine).

Earlier passes addressed individual contributing layers but each one alone wasn't enough. Going aggressive on all three sources at once:

**1. Killed the shader tint multiplication.** `PANEL_FRAG` had `col *= uTint;` near the bottom — every panel pixel multiplied by the per-scene tint color. Combined with white text on the texture, that produced bright tint-colored pixels (cyan/pink/green/orange) covering the whole panel rectangle. Bloom then smeared those rectangles outward. Removed entirely. Panel content now shows in the texture's native colors only. The hover-pulse `+= uTint * 0.1 * pulse;` also retinted on hover — replaced with a neutral white pulse `+= vec3(0.10) * 0.6 * pulse;`.

**2. Dimmed the texture itself.** `_makePanelTexture` was painting:
   - White (#fff) title
   - Saturated magenta (#ff7ec3) kicker, accent stripe, ENTER prompt
   - Bright pink (rgba(255,126,195,0.18)) caution band

   All of these were brightness ≥ 0.50 in some channel — well above any realistic bloom threshold. Re-painted with a muted gray family:
   - Title: `#fff` → `#b8bec8` (light gray)
   - Kicker / body / accent prompts: → `#7a8090` (mid gray)
   - Caution stripe: `(255,126,195,0.18)` → `(120,130,150,0.10)` (neutral, half opacity)
   - Corner brackets: `#fff` → `#9ca2ad`

   Net: brightest pixel anywhere on a panel is ~0.72 (the title), most pixels much lower. No more fluorescent text crashing through the tonemapper.

**3. Raised bloom threshold above panel content.** `_setupComposer` had `threshold 0.30 / strength 0.35 / radius 0.30`. Title text at brightness ~0.72 was still above threshold so it kept a soft white bloom even after (1)+(2). Bumped to `threshold 0.75 / strength 0.20 / radius 0.25` — now panel pixels are below threshold and don't contribute to bloom at all. The few genuinely bright pixels in the scene (planet rim, missile-silo aviation strobe, sun, vehicle headlights, `_makeRunningLight` lens dots dialed up to >0.75) still get a tight glow at the source — but no spread, no rectangle, no halo around any panel.

**Why all three.** Removing only the tint left a soft white bloom rectangle. Dimming only the texture left the tint amplifying still-readable text into a tinted halo. Raising only bloom threshold left the panel as a saturated tinted rectangle without the spread (which arguably looks even worse — a hard color square). All three together = panels read as actual flat data displays mounted on the buildings. No glow, no tint, no halo, period.

**Files touched:** `js/scenes-selector.js` (PANEL_FRAG: removed `col *= uTint`, replaced hover-pulse with neutral white; `_makePanelTexture`: dimmed all 6 fillStyle/strokeStyle calls; `_setupComposer`: bloom threshold + strength + radius retuned), `js/helpers.js` (b213 → b214), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only**.

---

## b213 — 2026-05-07 — Scenes: kill the volumetric beam-cone halos all over the base

User: *"it still exists on certain things not sure why"* (4 screenshots — overview shot showing the wide field; close-up of an orange disc near the broken dish; a translucent rectangular column around the central tower/silo; freq map + dimensions panels still ringed by faint glow boxes).

**Root cause.** `Sprite` always faces the camera. The codebase had FIVE separate places where multiple cone-textured additive sprites were stacked along a beam path to fake a volumetric spotlight beam — every one of them rendered as a glowing rectangular column rather than a directional cone, exactly the "weird halo" the user kept circling. None of these sprites actually illuminated anything: every building in the scene uses `MeshBasicMaterial` (lighting-free), so the flood beams were pure decoration.

Inventory of cone-stacks killed:

1. **`_buildBuildingFloodBeams.addBeam`** (~22 calls × 4 cone-step sprites = ~88 cones + 22 hit-glows) — the dominant source. Each beam aimed a 4-sprite chain at a panel host (silo, broken dish, sigint tower, biostation, etc.) and painted a bright `_makeRunningLight` "hit glow" on the building face. Hit-glow + bloom = the rectangular halo the user circled around freq map / dimensions / silo.
2. **`_buildBaseLighting.addStreetlamp`** (~20 lamps × 1 down-cone) — every perimeter streetlamp painted a 5.5×7.5 additive box on the road.
3. **`_buildBaseLighting` stadium pylons** (4 pylons × 3 heads × 1 cone, scale 6×18) — the dominant halo on the central missile silo (the "translucent box around the tower" in screenshot 3).
4. **Hex-deck floodlights** (~6 posts × 1 cone, scale 8×12) — corner-deck halos.
5. **Catenary floodlights along spine road** (~10 lamps × 1 cone, scale 5×7).
6. **Broken-dish scaffold floodlight** (3-step cone chain) — the bright orange disc the user flagged in screenshot 2.
7. **Pelican-pad floodlights** (4 stands × 3-step cone chain).

Roughly **150+ additive cone sprites removed** in total.

**What was kept.** The actual fixture geometry (dark steel head/lens-housing on each lamp) + a small `_makeRunningLight` lens dot at the bulb position, dimmed slightly across the board (e.g. `0.34 → 0.20`, `0.30 → 0.18`, `0.28 → 0.18`). The lens still bloom-glows enough to read "this fixture is on" without painting a giant cone on whatever surface it's pointed at.

**Why this is the right cut.** Buildings don't react to lights anyway, so the volumetric beams were always just decoration. Real military-base photography at night reads as: dark structures with a few bright pinpoints (lens flares from fixtures, lit windows, strobes). It does NOT read as: glowing cones in mid-air. The new look is closer to the photographic reference and the scene reads more like infrastructure, less like a sci-fi diorama.

**Side effect.** ~150 fewer transparent additive sprites in the scene → cheaper render → bigger headroom for adding real structural detail (trusses, ladders, conduit, vents, parapet detail) on the realistic-bases pass the user actually asked for. That pass is up next.

**Files touched:** `js/scenes-selector.js` (5 cone-stack removals across `_buildBuildingFloodBeams`, `_buildBaseLighting` × 2, `_buildHexDeck`, broken-dish scaffold, `_buildPelicanLights`; + lens-dot brightness dialed down ~25-40% across the board), `js/helpers.js` (b212 → b213), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only**.

---

## b212 — 2026-05-07 — Scenes: fix /scenes/ black-screen #2 — raw backticks in shader-comment broke the ES module parse

User: *"and its still a gblack screen"* (with screenshot — pure black canvas, even after b211's absolute-import fix).

**Root cause.** The b209 comment block I wrote inside `PANEL_FRAG` (a JS template literal) contained markdown-style code spans with literal backticks: `` `uTint` `` and `` `_buildPanelHost` ``. Inside a template literal, ANY raw backtick terminates the string. The first `` ` `` ended `PANEL_FRAG` mid-shader, the next started a new template literal, identifiers between them became invalid syntax. Parsed as: `const PANEL_FRAG = \`...\` uTint \`...\` _buildPanelHost \`...\`;` — invalid JS.

**Why it slipped past my checker.** I was running `node --check` (which parses as CommonJS by default). CommonJS parsing apparently tolerates this pattern silently — exit 0, no error. The browser parses as ES module (the file uses `import`), and ES-module parsing strictly catches the broken template literal. Re-checking with `cp file.js test.mjs && node -c test.mjs` immediately surfaced:

```
SyntaxError: Unexpected identifier 'uTint'
  at line 66
```

When the module fails to parse, no exports run, `window.ScenesSelector` is never assigned, and the inline `<script type="module">` in `scenes/index.html` calls `undefined.init(mount)` → uncaught error → black canvas, no HUD, no scene.

**Fix.** Replaced backticks in the comment with prose: `` `uTint` `` → `uTint`, `` `_buildPanelHost` `` → `_buildPanelHost`, and "tint²" → "tint-squared" (the unicode-superscript was fine but easier to read as words alongside the rest). The semantic content of the comment is unchanged.

**Lesson learned.** Going forward, ALWAYS validate scene-related JS edits as ES modules (`cp foo.js test.mjs && node -c test.mjs`), not via plain `node --check`. The two parsers diverge on subtle template-literal cases. CommonJS-mode validation is a false confidence trap for files using `import`.

**Files touched:** `js/scenes-selector.js` (5-line comment edit, no code change), `js/helpers.js` (b211 → b212), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only**.

---

## b211 — 2026-05-07 — Scenes: fix /scenes/ black-screen (ES module relative import was 404ing under <base href>)

User: *"http://localhost:8000/scenes/ is blackscreen not sure if broken or something"* (after I started serve.py and confirmed all four routes returned 200).

**Root cause.** `scenes/index.html` has `<base href="/">` set in `<head>`, then in the body uses `<script type="module">` with `import './js/scenes-selector.js';`. ES module specifiers (relative paths) resolve against the **importing module's URL**, not always against the document's base URL — exactly the same spec ambiguity that's bitten plenty of projects on Chromium. When the importing module is the inline script in `/scenes/`, the relative path resolves to `/scenes/js/scenes-selector.js` which doesn't exist (the file lives at `/js/scenes-selector.js`). The 404 silently kills module evaluation, `window.ScenesSelector` never assigns, and the next-tick `init(mount)` call throws on `undefined.init`. Page renders the static HUD background — black canvas, no scene.

Dev-server log confirmed:
```
"GET /scenes/ HTTP/1.1" 200
"GET /scenes/js/scenes-selector.js HTTP/1.1" 404
```

This worked intermittently across earlier sessions because some Chromium builds DO honor `<base href>` for module resolution and some don't (cached vs. cold-loaded module graph differs too). The behavior was always fragile — absolute path is the deterministic fix.

**Fix.** `scenes/index.html` (one-char edit): `import './js/scenes-selector.js';` → `import '/js/scenes-selector.js';`. Absolute path always resolves to the origin root, no base-URL or module-URL semantics involved.

**Files touched:** `scenes/index.html` (1 char edit), `js/helpers.js` (b210 → b211), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only**.

---

## b210 — 2026-05-06 — Galaxy: distress beacon — fire, smoke, sparks, multi-beacon strobe + listless tumble

User: *"distressed ships should emit more signals of distress"* + *"maybe have it on fire abit or smoking"* (screenshot: b203 distress pelican floating dim with two thin engine flames — reads as "asleep with a red light," not "in trouble").

**What was there.** A single red SOS sprite blinking 3-short-1-long, a ±0.18u sin wobble, no movement, no damage cues, 14s lifetime.

**What this pass adds (all on the same pelican):**

- **Three out-of-phase emergency lights** instead of one — multi-system failure read:
  - Red SOS strobe (top, original 3-short-1-long pattern)
  - Amber rotating beacon (port wing) — `pow(sin, 4)` cycle
  - White emergency strobe (starboard wing) — sharp 2.2 Hz, off-phase from red so they fight for the eye

- **Two hull fires** at "damaged" hull spots — starboard engine pod (3.05, -0.10, 0.5) and port wing root (-2.20, 0.40, 1.2). `_makeFlameTexture` called with a fire-orange palette `(255,250,210) → (255,200,80) → (255,110,40) → (160,30,20)`. Per-flame seed drives a compound flicker `0.65 + 0.35·sin(t·14+seed)·sin(t·7.3+seed·2.1)` — sub-second wobble in opacity AND scale so they never sit still and the two never sync.

- **Smoke trail** — 18-sprite pool, normal-blended gray puffs:
  - Spawn every 0.06–0.11s from a fire's world position. Vel `(±0.6, 0.35–0.7, ±0.6)` drifts up-and-back in WORLD space (puffs are scene-children, not pelican-children, so the listing rotation doesn't drag them).
  - Lifetime 1.6–2.4s; scale grows 0.6× → 2.2×; opacity falls quadratically. Same flame texture, gray ramp `(220,220,220) → (110,110,110) → (40,40,40)`.

- **Sparks** — 14-sprite pool, additive `0xffe0a0`:
  - Spawn cooldown 0.35–0.90s (rarer than smoke), lifetime 0.4–0.7s. Vel `(±2.4, 0.2 − rand·1.2, ±2.4)` — mostly fall + occasional rises. Reads as "blown circuit fleck."

- **Listless tumble** — `outer.rotation.z` and `.y` advance every frame at random per-spawn velocities (roll ±0.08–0.14 rad/s, yaw ±0.04–0.08 rad/s). Engine velocity stays zero; vertical sin drift kept for breath. Sells "attitude control failed."

- **Hull power flicker hook** — `if (s.runningLights) ...` block primed for when ship pools track running-light arrays; harmless no-op today, ready for next pass.

- **Lifetime extended** 14s → 18s so the new effects get visible airtime under the auto-scheduler's follow-cam.

**Plumbing.** `p.scenarioBase` now carries `{ beaconRed, beaconAmber, beaconWhite, fireA, fireB, smokes[18], sparks[14], smokeNext, sparkNext, drift, listRollV, listYawV, hullSeed }`. `p.scenarioCleanup` removes/disposes all 37 sprites + their textures — important since the auto-scheduler can re-fire this scenario roughly every minute. Smoke + spark sprites are scene-attached (not pelican-attached) so the listing tumble doesn't drag them through the world.

**Files touched:** `js/marathon-world.js` (`_spawnDistressBeacon` rewrite ~110 lines; `_tickDistress` clause inside `_tickFlyby` rewritten ~85 lines), `js/helpers.js` (b209 → b210), `FILE_MAP.md` build header, `CHANGELOG.md`. Localhost only.

---

## b209 — 2026-05-06 — Scenes: actually kill the billboard halo (shader edge-frame + bloom were the real source)

User: *"they still have thay weird effect all around them"* (with second screenshot of the radial panel arc — every billboard still ringed by a wide colored rectangular halo despite b208's halo-sprite removal). Confirmed: b208 deleted the wrong layer.

**Real root cause (re-diagnosed).** Two amplifying sources stacked on top of each other:

1. **Shader edge-frame in `PANEL_FRAG`.** The fragment shader painted the outer 4% of each panel's UV with `mix(near-black, uTint, 0.85) * 0.6`, then the very last line ran `col *= uTint;` over the whole panel. Net: edge pixels become `~uTint² * 0.51`. For a cyan panel (tint ≈ RGB(0.27, 0.85, 0.96)) the border ends up at roughly RGB(0.04, 0.43, 0.55) — well above bloom threshold. Every panel had a bright tinted rectangle baked into its outermost row of pixels, regardless of hover/focus.

2. **UnrealBloomPass at radius 0.55, strength 0.65, threshold 0.10.** Wide-radius bloom smeared those bright tinted edges outward into a 30-40% colored glow ring — the rectangular "halo" the user circled. Threshold 0.10 meant nearly every lit pixel in the scene contributed; radius 0.55 meant the spread was huge.

The b208 halo-sprite removal was real but minor — the dominant source was always (1)+(2). Sprite at 0.10 opacity was just a small bonus contribution.

**Fix:**
- `PANEL_FRAG` (`js/scenes-selector.js` ~L66-L72): removed the edge-frame block entirely. The panel mesh no longer paints any tint border. The actual 3D steel framing built around each panel by `_buildPanelHost` (top/bottom rails, side rails, dark backplane) provides all the visual framing the panels need.
- `_setupComposer` (`js/scenes-selector.js` ~L6680): bloom retuned. `strength 0.65 → 0.35`, `radius 0.55 → 0.30`, `threshold 0.10 → 0.30`. Bright pixels (panel text, strobes, headlights, planet rim, lit windows) still get a screen-glow but it's tight to the source. Background lit elements no longer blur into amorphous glow.

**Why both, not one?** Removing only the shader frame still leaves wide-radius bloom amplifying every other bright pixel in the scene — text on panels, strobes, planet rim — into the background haze that makes the whole arc feel "painted." Tightening only bloom still leaves the 1-pixel-wide bright tinted edge, which would read as a crisp colored outline. Both have to go.

**Files touched:** `js/scenes-selector.js` (shader edit + bloom tune), `js/helpers.js` (b208 → b209), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only**, no Cloudflare push.

---

## b208 — 2026-05-06 — Scenes: kill the cyan ghost-halo around every billboard

User: *"continuing resdeisning military bases — first correct this weird effect around our billboards"* (with screenshot of the radial panel arc — every billboard ringed by a soft cyan/colored halo that bleeds outward, drawn over with cyan loops to mark which panels were affected).

**Root cause.** Each panel in `_buildPanels` was paired with a 1.05× radial-glow `Sprite` placed at the same world position, additive blending, opacity 0.10. The sprite's footprint is essentially the same area as the panel itself, so the additive layer brightens the panel pixels uniformly — then the post-stack bloom (strength 0.65, radius 0.55, threshold 0.10 in `_setupComposer`) picks up those brightened panel edges and amplifies them into a wide colored ring around every billboard. The shader's own edge frame already paints a magenta/tint border; the sprite was double-dipping on top of it, which is what produced the "ghosted" look.

The b184 changelog notes the sprite was *already* dialed back from 1.8× / 0.45 → 1.05× / 0.10 to fix a previous saturation bug. Even at the new tight values, additive + bloom amplification kept producing a visible halo on the deep-fog backgrounds.

**Fix.** Removed the halo sprite entirely from `_buildPanels`. The panel mesh now stands alone — its shader edge frame + bloom on the bright frame pixels carry all the screen-glow the panel needs. Animate-loop references to `p.halo` (position copy, opacity ramp, scale lerp on hover/focus) deleted; the surrounding `lerp` for `p.mesh.position` / `p.mesh.scale` / `lookAt` are unchanged.

**Why kill the sprite vs. tune it.** The sprite's job (a faint outer glow rim) is already accomplished by bloom of the panel's bright magenta-tinted edge frame, which is per-billboard color-correct without an extra additive layer that the bloom kept double-counting. Simpler is correct.

**Files touched:** `js/scenes-selector.js` (one removal block in `_buildPanels` ~L4383, one trim in the panel animate tick ~L6991), `js/helpers.js` (b207 → b208), `FILE_MAP.md`, `CHANGELOG.md`. **Localhost only**, no Cloudflare push.

---

## b207 — 2026-05-06 — Galaxy + Scenes: ships fly nose-first (kill the global Math.PI flip), scenes flybys no longer clip the ground

User: *"in galaxy this ship floats backwards. pls ensure all our ships fly the correct way :("* (with screenshot of a Pelican flying tail-first across the nebula) + *"also stuff flys through our land/surface"* (scenes screenshot of a ship+glow embedded in a building) + *"like in this image too"* (third screenshot — same scenes clipping issue, plus a parked-pelican silhouette across the road).

**Root cause (galaxy).** Every ship constructor in `marathon-world.js` builds geometry with the nose at `-Z` (correct three.js convention), then immediately flips the inner group with `inner.rotation.y = Math.PI`. After the flip, the model's nose lives at `outer +Z`. `outer.lookAt(target)` aligns the object's local `-Z` axis with the travel direction — so the **tail** points along velocity. Ship flies tail-first.

The same `Math.PI` was baked into the ~38 spawn/animate sites that re-set inner rotation between scenarios, so removing it from the constructor alone wasn't enough — every `inner.rotation.set(0, Math.PI, 0)` and `inner.rotation.y = Math.PI [+ extra]` had to drop the `Math.PI` term.

**Fix:**
- 4 constructors (`_makeLongsword`, `_makeBanshee`, `_makePelican`, `_makeForerunner`): removed `inner.rotation.y = Math.PI`.
- 36 `inner.rotation.set(0, Math.PI, 0)` → `inner.rotation.set(0, 0, 0)` across spawn methods.
- 5 plain `inner.rotation.y = Math.PI;` → `= 0;` (in tick/animate paths that re-zero between scenarios).
- 6 composite `inner.rotation.y = Math.PI + <expr>;` → `= <expr>;` (banking/barrel-roll/yaw-drift updates that previously baked in the 180° offset).

Net: every ship in galaxy now flies nose-forward. Visually identical to before for symmetric models (longsword octahedron, forerunner orb), but Pelican (asymmetric: cockpit-front, hatch-rear) and Banshee (curved canopy front) now show their faces in the direction of travel.

**Root cause (scenes).** Same bug pattern, ported when the random-flyby + scripted pelican-dropoff systems were lifted from galaxy. Both spots called `ship.lookAt(target)` then `ship.rotateY(Math.PI)` to "flip nose-forward" — which is exactly the wrong direction.

Plus a separate **altitude bug**: `_respawnFlyby` had a 12% branch picking `altitude = camY - 6 - rand*4` (camY is 0 on the deck, so altitude went to **−6 to −10** = below ground) and a 70% branch picking `camY + (rand - 0.3)*5` (range −1.5 to +3.5 — also dipping below the deck floor). Result: flybys cut through the desert and through buildings.

**Fix (scenes):**
- `js/scenes-selector.js:3148` — removed the `ship.rotateY(Math.PI)` after the random-flyby `ship.lookAt(target)` call. Pelican model has nose at -Z, lookAt already aims it correctly.
- `js/scenes-selector.js:3253` — same fix for the scripted pelican-dropoff `_startPelicanRun`.
- `js/scenes-selector.js:3117–3121` — flyby altitude buckets re-floored:
  - High pass: `camY + 18..28` (unchanged — clears buildings)
  - Low pass: was `camY − 6..−10` → now `camY + 3..6` (dramatic close-pass without ground clip)
  - Eye-level: was `camY − 1.5..+3.5` → now `camY + 6..12` (mid-air, panel/building height)

**Known follow-ups (NOT fixed in this pass):**
- Even at the new floor (camY+3), low-pass ships could still nick the back face of buildings 30–90u out from camera. No collision avoidance — ships travel straight lines on the chosen altitude. If clipping persists, the next pass should raise the low-pass minimum or add building-collision sampling.
- The bright orange disc in the third screenshot is most likely a flyby pelican's engine-glow sprite rendering through a building wall (additive sprites have no depth occlusion). Same root cause — once flybys stop clipping buildings altogether, the "sun in building" stops too.
- The forerunner `inner.rotation` may still have ring-spin animations that reference `Math.PI` as a pose offset; visually it's a symmetric orb so a 180° drift wouldn't read, but worth a sweep next time.

**Files touched:** `js/marathon-world.js` (~50 lines across constructors + ~38 spawn/animate sites — pure `Math.PI`-stripping), `js/scenes-selector.js` (3 surgical edits — 2 `rotateY` removals + altitude bucket rewrite), `js/helpers.js` (b206 → b207), `FILE_MAP.md` build header, `CHANGELOG.md`. **Localhost only**, no Cloudflare push (per current iteration rule).

---

## b206 — 2026-05-06 — /tracks: full DAW Session view — year lanes + clip cells + master + arrangement timeline (replaces WebGL spire) + new track wired

User: *(after pitching 5 distinct redesign concepts for /tracks: DJ booth POV, Vinyl Crate, Album-Art Sky, DAW Session View, Editorial Magazine)* → *"4 seems interesting if u can make it really high quality"*. Plus: *"add this song into catalog galaxy and everything and make sure its playable i added a new song called moves on"* → *"ima change its name to still looking for you"*.

Replaces the b146/b200 WebGL Tracks Vault (helix spire) with an Ableton-faithful 2D Session view. The previous helix was pretty but read as "another floaty WebGL scene"; the DAW view says "this artist *makes* music" with the same surface a producer uses every day.

**New file: `js/tracks-daw.js`** (~830 lines, vanilla JS, no Three.js). IIFE registering `window.TracksDaw = { init, setFilter, setQuery, onTrackChange, destroy }`. DOM-driven by design — DAWs need crisp text rendering, not GLSL approximations. Two canvases only: per-clip waveform thumbnail + master spectrum analyser.

**Layout (5-row CSS grid):** topbar (36px) · transport (56px) · filter band (32px) · main grid (1fr) · status bar (22px). All bars stretch full width; main grid is the only scrollable area.

**Top bar.** Brand block (LED dot that goes red when audio is playing, "CANTMUTE" + version + artist sub) | SESSION ↔ ARRANGEMENT tabs (active tab gets bottom-border accent + tinted background) | search input (`⌕` prefix, full-width, type to filter clips by title) | count + ← galaxy back-link.

**Transport bar.** Five-button group (prev/play/stop/next/shuffle), each a 32px square with charcoal gradient + 1px line border; play button is wider (42px) and accent-orange-bordered, becomes solid orange-red pill with `box-shadow:0 0 18px` glow when armed. Now-playing column (240-300px) with `TRK.NNN · TIER` kicker, lowercase Space Grotesk title, year+tags meta. Scrubbable progress with live `<canvas>` waveform underlay, fill gradient (orange semi-transparent), 1px white playhead with shadow. `mm:ss.t / mm:ss.t` time display (tenths). SC button (real inlined SVG mark, orange). Volume slider (custom-styled `<input type="range">`, white thumb, accent border). Two stereo level meters with green→yellow→red gradient + `* 0.94` peak-hold falloff.

**Filter band.** Chip row (all/featured/new/hard/chill/grunge/vibe) — selected chip gets accent tint. Filter syncs URL: `new` → `/tracks/new`, others → `/tracks`. Right-side keyboard hint (`SPACE play  R shuffle  ← → ↑ ↓ nav  ↵ launch`), hidden on narrow screens.

**Session view (default).** Two flex-row siblings inside `.daw-grid`:
- `.daw-scroll` (flex:1, horizontally scrollable) holds **year lanes** — one column per release year, sorted newest left → oldest right. Each lane is 226px wide with sticky `.daw-lane-head` (year stripe colored by lane index, year title, "N clips", decorative M/S buttons) and a vertically-scrollable `.daw-stack` of clips.
- `.daw-lane.is-master` (300px, doesn't scroll horizontally) — sticky on the right showing now-playing details: NOW PLAYING kicker · `TRK.NNN · TIER` · lowercase title · year+tags meta · live 64-bar spectrum analyser canvas (gradient fill, sine-bass center scope) · key/value grid (TIER / TAGS / DATE / SLOT) · vertical action stack (▸ details / ▸ soundcloud / ▸ share).

**Clip cell** (`.daw-clip`). Golden-ratio per-track hue (`paletteForCell(idx, tier)` — tier modulates sat/lit only). 5px gradient color stripe at top + 1px hue-tinted border. Header row: 22px launch button (▶ glyph, hue-tinted) + title + `num · MM.DD · TAG` meta. Below the row: per-clip waveform `<canvas>` thumbnail (deterministic procedural — layered sines + hash-noise, drawn once per cell on build, redrawn on resize). Bottom: 2px progress underline that glides with `audio.currentTime` while playing. Hover state brightens border + body. Selected = white outline. **Armed (playing) state** swaps the launch glyph to ■, applies a `daw-armed-pulse` keyframe animation (2s ease-in-out, 22→30px shadow), tints the body gradient with red overlay, and sets the launch button to solid red.

**Arrangement view** (toggle via SESSION/ARRANGEMENT tab). `_buildArrangement` flips `.daw-grid` to `.is-arrange` (overflow-auto). Inner `.daw-arr` has explicit width = `(maxYear - minYear + 1) * 12 * 90px`. Sticky 32px year ruler with major (year-line) and minor (month-line) ticks. 5 horizontal lanes (FEATURED / NEW / HARD / CHILL · VIBE / ARCHIVE), each 56px tall, with sticky-left lane label. Each track = a colored bar absolutely positioned at `((year - minY) * 12 + month + day/30) * 90px`, width based on title length. Hover = lift + white border. Click = launch. Single global vertical playhead line glides across all lanes with `currentTime / duration` of the playing track's bar.

**Audio reactive.** Reuses `audio.__floorAnalyser` cache from `marathon-world.js` so analyser is shared across views (no double-pipelining). 60fps `_drawSpectrum` reads `getByteFrequencyData` into 64 bars + sine-modulated center scope; L/R fake-stereo split derived from `bass + energy` with `* 0.94` peak hold for meter ballistics. Idle wiggle on spectrum so panel doesn't look dead before play. Per-clip waveforms are static (procedural).

**Keyboard.** `Space` = play/pause (resumes suspended `audioCtx`). `R` = shuffle visible clip + focus + scroll into view. `←/→` = jump to first clip of prev/next year column. `↑/↓` = step within current year column. `Enter` = launch selected. `Esc` = clear status. Inputs are skipped (search field still works).

**Filtering.** `_applyVisibility` toggles `.is-hidden` on cells, recomputes per-lane clip counts in lane heads, and updates the top-bar `count` ("N / total CLIPS"). `setFilter` and `setQuery` both flow through `_applyVisibility`.

**Routing changes (`index.html`).** `bootTracksVault` → `bootTracksDaw` (same wakeup pattern, but checks `window.TracksDaw.root` instead of `.scene`). Script tag swapped from module `tracks-vault.js` to classic `tracks-daw.js`. `body.tv-on` and `app.className = 'tv'` are kept since the existing CSS already hides the topbar/miniplayer for them — DAW takes the page over completely. `tracks-vault.js` left in the repo (dormant) for trivial revert.

**New track wired (`config.json`).** Added "Still Looking For You" (file `still looking for you.mp3`) at index 0 — `isNew: true`, dated `2026-05-06`. Verified `audio-mp3/still looking for you.mp3` serves locally with HTTP 206 Partial Content. All views (galaxy, DAW, corridor, object, scenes) read `state.tracks` dynamically — they all pick up the new clip with no per-view changes. **R2 not synced** — production playback needs `bash scripts/upload-audio-to-r2.sh` before next push.

**CSS palette** (Ableton-faithful charcoal). `--daw-bg #131316` / `--daw-panel #1a1a1d` / `--daw-cell #252529` / `--daw-line #34343a` / `--daw-text #d6d6d8` / `--daw-text-mid #9da0a6` / `--daw-text-low #6b6e75` / `--daw-accent #ff7a3d` (orange) / `--daw-record #ee4242` (armed red) / `--daw-arm #f3d04e` (cued yellow) / `--daw-cyan #66ddff` / `--daw-pink #ff7ec3` / `--daw-green #6bdf80`. All borders are 1px solid, no border-radius (sharp DAW edges). Custom webkit scrollbars (10px, dark thumb, hover-lighten). Inter / Space Grotesk / JetBrains Mono families.

**Files touched:** `js/tracks-daw.js` (new, ~830 lines), `index.html` (boot swap + ~580 lines of new `.daw-*` CSS in the `<style>` block), `js/helpers.js` (b202 → b206), `config.json` (new track at index 0), `FILE_MAP.md`, `CHANGELOG.md`.

**Local-only (no Cloudflare push)** per the no-deploy-during-iteration rule. `python serve.py 8000` running for verification at `/tracks` and `/tracks/new`.

---

## b205 — 2026-05-06 — Scenes: POI navigation system + tone-down holographic windows + SCENES_HANDOFF.md

User: *"The illumination is pretty terrible, dude. … all the lights are fucked up and have this weird like holographic thing going on. … there's a lot of still empty space on the military bases. … the different fucking things the different scenes have no context. … I want like points across the map that we built."* → after pitching POI-first plan → *"lets do ur plan pls create md for a new caht tho addressing all"*.

Two-part commit. Builds the discrete-waypoint navigation the user asked for, kills the worst of the "holographic floating cards" reading on lit windows, and writes a handoff doc so a fresh chat can pick up the redesign without re-explaining six prior commits.

**SCENES_HANDOFF.md (new, repo root).** Cross-context catch-up for the active redesign thread. Covers what shipped (b193-b201 panel reposition + broken-dish + lighting passes), open issues (additive-sprite holographic look, empty desert between deck and forward arc, missing scripted-activity layer, abstract scene descriptions), the agreed-on POI-first plan, the deferred build priority list (Pelican loop / patrols / engineer crews / forklift / bivouac campfire / etc.), and conventions (coordinate system, road shader masks, build-bump hook, CLAUDE.md hard rules). Indexed at the top of FILE_MAP.md as **read FIRST in a fresh session**.

**POI navigation (`_buildPOI` + `_gotoPOI` + `_tickPOI`).** 10 named viewpoints across the base. Camera animates pos + yaw + pitch over 1.6s with smoothstep ease (`t*t*(3-2*t)`). Drag-look continues from each POI; the new POI's yaw becomes the new gaze yaw, dragging adjusts from there. Bottom-center HUD strip shows clickable buttons with the POI name + index digit. Keyboard: digits `0-9` jump direct, `N`/`P` cycle next/prev, `ESC` returns to deck (or releases focus first if a panel is focused).

POIs:
- 0  OBSERVATION DECK — (0, 0, 0) facing N (default)
- 1  MISSILE SILO — (0, 4, -75) facing the silo
- 2  BROKEN DISH — (-50, 6, -25) facing the damaged dish
- 3  SIGINT TOWER — (-30, 4, -35) facing freqmap host
- 4  LOGISTICS YARD — (30, 4, -35) facing tape-spine yard
- 5  FORWARD OPS — (15, 4, -55) facing livwall radar
- 6  COMMS ARRAY — (-15, 4, -55) facing dim shed
- 7  SE AIRFIELD — (35, 4, +18) facing pelican pad
- 8  BIOSTATION SW — (-30, 4, +30) facing organism
- 9  RIDGE VIEW — (0, 18, +30) elevated, facing N over the whole base

Yaws computed from `atan2(dx, -dz)` so the forward-vec aligns with target. Shortest-path yaw lerp (subtracts/adds 2π if dy > π) so transitions don't full-spin. CSS strip styled in `scenes/index.html`: dark backdrop with blur, monospace 10px button labels, accent-debug magenta highlight on the active POI.

**Emissive flicker tone-down.** Old `standoff.windows` tick used ±10% sin amplitude, which combined with additive blending and depthWrite:false made every window read as a "blinking holographic card" floating off the wall. New tick branches by userData type:
- Standard windows: ±2% sin (steady warm shimmer, no card-blink)
- Welder pulses (`isWelder`): sharp bright pulses every ~4s (preserved — that's the active-repair narrative on broken dish)
- Spark sprites (`isSpark`): sustained jitter (preserved — short-circuit reading)
- Fault windows (`fault: true`, broken-dish plinth): irregular skips (preserved — damaged-but-occupied)

Did NOT switch additive→non-additive on materials this pass — that's a bigger pipeline question (chassis materials would need to lit-respond) and the flicker dampening alone removes the worst of the holographic feel. Revisit if the user still flags it after navigating new POIs.

**Files touched:** `js/scenes-selector.js` (~150 new lines for `_buildPOI`/`_gotoPOI`/`_tickPOI`/`_highlightPOI` + `_onKey` hotkey expansion + animate-loop position rewrite + window-flicker tick branching), `scenes/index.html` (~70 lines new CSS for `.ss-poi-strip`/`.ss-poi-btn`/`.ss-poi-num`), `js/helpers.js` (build chain bumped to b205), `FILE_MAP.md`, `CHANGELOG.md`. New: `SCENES_HANDOFF.md`.

---

## b202 — 2026-05-06 — Tracks: full admin shell — every existing system toggleable, presets, sliders, search-filter, scaffolded events

User: *"think about all weve done to galaxy and scenes. how can we improve tracks now"* → after pitching the gap (galaxy got Far-Cry density, scenes got patrols/personnel, tracks is the only one still static) and a 50-button admin inventory → *"sure but we can fix admin shell to be better encompassing"*.

Step 1 of the tracks improvement plan: build the control panel before adding new content, and make it more comprehensive than galaxy's so the rest of the work plugs in without re-wiring. **Localhost only** — no Cloudflare push.

**Beyond galaxy's admin** (which has ~60 buttons, 13 collapsible sections, ~ shortcut, FX/element toggles, time-scale, capture):

- **Filter search** at the top — type to hide buttons whose label doesn't match. ~50 buttons fit on a laptop screen without it; with it, navigable on a small viewport.
- **Preset chips** — `default · minimal · cinematic · photo · party`. One click reconfigures bloom strength, FX uniforms, time scale, scene-element visibility, HUD visibility, FOV. Photo additionally hides HUD for clean still-frames.
- **Sliders alongside toggles** — FOV (40–100), bloom strength (0–2.5), CA amount (0–0.012), helix descent scrub (–180 → +180). Galaxy's panel was buttons-only.
- **Per-section status** — every toggle has a `<span>ON|OFF</span>` plus a `tv-on` class that wraps the label in `[ ]` when active. Time-scale buttons self-highlight when their value is the current scale.
- **Master "all on / all off"** in the scene-elements section — covers nebula + starfield + energy stream + dust + glints + shards + pulses + rings + back-glows + panels + 4 core layers in one tap.

**Sections** (collapsible, state persisted to `localStorage`, default open except `events`/`micro` which are stubbed):

1. **presets** — 5 chips
2. **vault events** — 10 stubs (decryption sweep, courier drone, archive flythrough, panel surge, catalog index, tier rainbow, discovery beacon, stack collapse, glitch storm, track aura) — `disabled`, ship next pass
3. **micro fx** — 6 stubs (meteor, pulsar, comm scrap, emp flash, bit drift, shelf rumble) — `disabled`
4. **camera** — reset, hop random, prev/next panel, release focus, FOV slider + ±5 buttons
5. **feel · motion** — auto-yaw, auto-scroll, drag inertia, bass-rotate (placeholder), helix descent slider
6. **helix** — reshuffle slot order (re-runs the b148 init shuffle live), density (117/60/30/featured-only)
7. **filter · tier** — radio: all/featured/new/hard/chill/grunge/vibe (mirrors the existing `tv-chips` row)
8. **scene elements** — 14 individual toggles + master row. Per-core-layer toggles (inner white / blue / cyan / outer halo)
9. **post fx** — bloom on/off + strength slider, CA on/off + amount slider, flares, color grade, scanlines, grain, vignette
10. **time** — pause + 0.25× / 0.5× / 1× / 2×
11. **capture** — PNG download, hide HUD, random panel hop
12. **stage** — clear all events (placeholder), reset focus, reset filter, reset camera

**Plumbing changes:**

- `POST_FRAG` now reads 7 uniforms (`uCAOn`, `uCAAmt`, `uFlaresOn`, `uGradeOn`, `uScanOn`, `uGrainOn`, `uVignetteOn`) — each FX block gated on `> 0.5`. CA amount is continuous float; others 0/1. Old hardcoded values become defaults in `_setupComposer`.
- New TracksVault state: `adminEl`, `_adminTime`, `_paused`, `_timeScale`, `_hudHidden`, `_autoYawOn`, `_autoScrollOn`, `_inertiaOn`, `_bassRotateOn`, `_density`, `backGlows[]`.
- Animate loop uses `_adminTime` (`rawDt × scale`, scale=0 when paused) for `t`, so pause/scale propagate to every shader uniform sourcing `t` (panels, nebula, dust, energy stream, core, post pass).
- Bloom strength baseline can be pinned via `bloom._adminBase` so the slider sticks instead of being overwritten every frame by the bass-driven default.
- `_applyVisibility` respects `p.densityHidden` so density caps survive `setFilter` calls.
- `_buildEnvironment` stores back-glow sprites in `this.backGlows[]` for toggling.
- New methods (~430 lines): `_toggleAdmin`, `_buildAdminPanel`, `_adminInitCollapse`, `_adminDispatch`, `_adminToggleElement`, `_adminAllElements`, `_adminToggleFx`, `_adminSetFov`, `_adminSetBloom`, `_adminSetCA`, `_adminReshuffleSlots`, `_adminSetDensity`, `_adminSavePng`, `_adminApplyPreset`, `_adminRefreshLabels`.
- HUD `[ admin ]` link added beside `← galaxy` / `scenes`. `~` / `` ` `` keyboard shortcut in `_onKey`.

**Files touched:** `js/tracks-vault.js` (~520 new lines), `index.html` (~150 new CSS lines for `.tv-admin*` — collapsible sections, sliders, search, presets, mobile drawer), `js/helpers.js` (b201 → b202), `FILE_MAP.md` build header, `CHANGELOG.md`.

**Why no events yet.** Scaffolded as `<button disabled>` with a "soon" hint chip. Step 2 ships scintillation + starfield + 1 ship; step 3 wires the 10 vault events into these stubs.

---

## b201 — 2026-05-06 — Catalog cull: drop 14 archived tracks across galaxy / tracks / corridor / object / wall

User: *"remove these songs i dont like them - from all (galaxy, tracks, etc)"* + a "hidden archive" list of 14 files.

The galaxy, tracks vault, signal corridor, and the object all read from `config.json#tracks`, so cutting them at the source removes them everywhere automatically. Removed entries:

- Peep Demo (`Project_song_may22_peepdemo2.mp3`)
- Arkham Villain (`arkham villain.mp3`) — was `isFeatured: true`
- May Flowers (`Project_song_apr12_may flowers.mp3`)
- Rap About Some Bullshit (`rap about some bullshit 3.mp3`)
- First Rap in a While (`first rap in a while.mp3`)
- Space Star Galactica (`SPACE STAR GALACTICA.mp3`)
- What Changed With U (`what changed w u cworld kazoo.mp3`)
- Moods (`MOODS ROLO.mp3`)
- Greatest Consequences (`greatest consequences.mp3`)
- What U Expect of Me (`what u expect of me - jayzlinkinpark.mp3`)
- Nirvana (Alt Lyrics) (`nirvana dannz0-differentlyrics.mp3`) — original `Nirvana` is kept
- Wind Blows (`WIND BLOWS_3.mp3`)
- Stop Light (`STOP LIGHT.mp3`)
- Skeat x Kani (`skeatxkanikani.mp3`)

Catalog drops 118 → 104 tracks. The track-count constants in the WebGL views (helix slot count `117`, corridor card count `117`, object Voronoi cell count `117`) are derived from `tracks.length` at runtime, so they automatically resize to 104.

`featured` / `newReleases` lists in `config.json` were already keyed off slugs that don't intersect this cull set, so they need no edit. None of the removed slugs are referenced from `_redirects`, `index.html`, or any view file.

**`js/wall.js` icon overrides.** The hidden-archive cull orphaned 5 entries in the `ICON_OVERRIDES` table (`space star → spaceship`, `arkham → villainmask`, `stop light → trafficlight`, `wind blows → windmill`, `may flowers → raincloud`) — removed. The `nirvana → wonkysmile` override stays because the original `Nirvana` track is still in the catalog (only the alt-lyrics version was cut).

**Not touched:** the actual MP3s on R2 / in the local `audio-mp3/` cache stay where they are — only the catalog references are gone, so the files are now orphaned but harmless. Re-adding any of these would just be a `config.json` insert (the audio is still there).

**Files touched:** `config.json` (14 track entries removed), `js/wall.js` (5 icon overrides removed), `js/helpers.js` (b200 → b201), `FILE_MAP.md`, `CHANGELOG.md`.

**No Cloudflare push** per the no-deploy-during-iteration rule. JSON re-validated with `python -c "json.load(...)"` — track count 104, structure intact.

---

## b200 — 2026-05-06 — Tracks Vault: SoundCloud links + persistent transport + tag-constellation + keyboard shortcuts

User: *"http://localhost:8000/tracks — how can we improve this page since we changed so much with the other ones. think cool dont be lazy really put urselv to work. songs should have a way of linking to the soundcloud little icon, otherwise think of some crazy stuff"*.

The spire was already pretty, but it had no transport, no SC link, no keyboard, and no inter-track signal once a song started. b200 turns it into a real player — and exposes the catalog's hidden tag graph.

**SoundCloud link.** New `↗ soundcloud` action button on the focus card, real SC mark inlined as SVG (orange `#ff7a3d` strokes for the cloud + bars). Resolves URL via `track.links.soundcloud` → `track.links.sc` → ctx-passed `scUrl(title)` → constructed `https://soundcloud.com/kanisongs/<slug>` fallback. Same icon mirrored as a circular button in the new transport strip so it's reachable without focusing the panel. Each panel canvas texture also stamps a small `↗ SC` glyph under the tier badge so you can see at a glance that the link exists.

**Persistent transport strip (`tv-now`, bottom-center).** Always-on while a track is loaded:
- prev / play-pause / next / shuffle / scrub-progress / `mm:ss / mm:ss` time / SC
- progress bar is full-width inside the row and supports click-to-seek + pointer-drag scrubbing (uses `setPointerCapture` + `onSeek(pct)` callback wired to `audio.currentTime`)
- play/pause glyph swaps live based on `audio.paused`
- title is clickable — focuses the playing panel
- audio-reactive shadowed glow on the fill bar
- bottom-right filter chips auto-shift up to `bottom:90px` when the strip is visible (via `:has(.tv-now.on)`) so they don't collide

**Tag-constellation lines (`_buildTagIndex` / `_rebuildConstellation` / `_tickConstellation`).** When a track plays, additive `THREE.Line` segments draw from the playing panel to every panel sharing one of its tags. Lines breathe on individual phases (`0.5 + 0.5 sin(t * 0.9 + phase)`) and lift with bass. Untagged tracks get a fallback constellation: nearest 6 tier-mates by `basePos.distanceToSquared`. Constellation rebuilds on every `onTrackChange`. Lines update positions every frame against current panel positions (continuous scroll keeps moving them). Color = playing track's tint.

**Shuffle (`_shuffle`).** Random visible track is picked, the helix focuses it, audio plays. Avoids re-picking the currently-playing track when alternatives exist. Surfaced as a `⤬ shuffle` chip in the bottom-right filter row AND as a `⤬` button inside the transport strip.

**Keyboard shortcuts (`_onKey`).**
- `Space` — play/pause (resumes suspended `audioCtx`)
- `R` — shuffle
- `←` / `→` — focus prev / next visible panel (`_focusByOffset`)
- `S` — copy share URL of focused (or playing) panel via `ctx.onCopy` + `ctx.onToast`
- `Esc` — release focus (existing)
- text inputs are skipped (search field still works)

**ctx wiring (`bootTracksVault` in `index.html`).** New callbacks passed through: `onNext: playNext`, `onPrev: playPrev`, `onSeek: pct => audio.currentTime = pct * audio.duration`, `onCopy: copyText`, `onToast: toast`, `scUrl`. None of these existed in the v2 ctx — `TracksVault` previously only had `onPlay/onTogglePlay/getCurrent`.

**HUD shuffle hint** (`tv-shuffle-hint` under `.tv-tr`). Small kbd-styled hint: `SPACE play  R shuffle  ←→ jump`. Hidden on mobile.

**Files touched:** `js/tracks-vault.js` (HUD additions, `_buildTagIndex`/`_rebuildConstellation`/`_tickConstellation`, `_updateNowPlaying`/`_fmtTime`, `_scUrlFor`, `_shuffle`, `_focusByOffset`, expanded `_onKey`, animate-loop hooks, destroy cleanup, panel-texture SC stamp), `index.html` (`.tv-now*` / `.tv-act-sc` / `.tv-shuffle-hint` / `.tv-sc-glyph` CSS + bootTracksVault ctx), `js/helpers.js` (b199 → b200), `FILE_MAP.md`, `CHANGELOG.md`.

**No Cloudflare push** per the no-deploy-during-iteration rule. `python serve.py 8000` running for verification.

---

## b199 — 2026-05-06 — Scenes: v2 radial layout — panel reposition + broken-dish redesign + BASEMAP.md spec

User: *(after parsing screenshots showing the right-flank cluster pile-up at the airfield + neural + helipad + commtower stack, and the "broken radar dish" the user said planes should fly through)* → built top-down ASCII map → user *"can u improve it and its design. and id want it cool as fruck, tanks moving across roads to warehouses, a place fro scripted ships to come leave land unload etc etc. engineers tinkering, shit that happens on a military installation."* → after pitching the radial-zone redesign + activity catalog → *"fucking love it"* → *"do whatver u think is best but MD this stuff so u have memory if we gota mvoe to new context"*.

Foundation pass for the v2 base. Locks panel coordinates to the radial spec (every panel ≥18u from any other in (x,z)) and rebuilds the deep-sea host as a properly damaged dish. All v2 scope (Pelican landing loop, patrol vehicles, engineer crews, forklifts, bivouac NPCs, sensor pylon ring) keys off these new positions, so this commit unblocks everything.

**BASEMAP.md (new, repo root).** Persistent design spec — panel coords, per-zone activity script, road network, build priority for b193→b202. Loaded by future chats so we don't rebuild the design from screenshots each session. Indexed in FILE_MAP.md.

**Panel reposition (`_buildPanels` mounts table).** Coordinates locked to 11 radial bearings:

| Panel | Bearing | Old pos (x,z) | New pos (x,z) |
|---|---|---|---|
| galaxy | 0° | (-55, -78) | (0, -88) |
| dimensions | -20° | (-58, -49) | (-26, -70) |
| livingwall | +20° | (20, -42) | (26, -70) |
| freqmap | -42° | (-38, -25) | (-43, -48) |
| tape spine | +42° | (60, -2) | (43, -48) |
| deepsea | -62° | (-72, -38) | (-66, -35) |
| neural | +62° | (52, -16) | (66, -35) |
| organism | -135° | (12, 28) | (-42, 42) |
| wall | +135° | (45, 32) | (42, 42) |
| terrain / villa | rail kiosks | unchanged | unchanged |

This kills the right-flank pile-up (helipad + neural + comm tower + supply depot all in a 40×30u box) and the symmetric left-flank antenna stack. Galaxy moves to dead-axis dead-deepest as the hero feature — camera always re-centers on the silo.

**Broken-dish redesign (`_buildBrokenDish`, replaces deepsea host).** New host kind. Large parabolic dish with east half of rim sagging at -0.45 rad, support truss broken on one side (visibly severed beam), scaffolding propping the broken edge, hazard cones around base, sparking sprite at break point with additive flicker. Aviation strobe blinks irregularly (fault behavior — random skip frames). Welder additive pulse on scaffold every 4s. Panel mounts on the intact west half of the rim. **Flyby-through gag wired in:** `standoff.brokenDishGap = { x, y, z, normal }` exposed so the existing `_tickFlybys` longsword spawner can detour formations through the gap on every 3rd flyby (wire-up arrives in b196).

**Host kinds added (`_buildPanelHost` switch):** `comms_array_shed`, `forward_ops_radar`, `sigint_tower`, `logistics_yard`, `broken_dish`, `sensor_pylon`, `biostation_quarantine`, `back_billboard_lattice`. The pre-v2 hosts that lost their panel mount (`radarbuilding` for livwall, `commtowerbig` for freqmap, `antenna_shed` for dimensions, `supplydepot_top` for tape spine, `back_billboard` for wall+neural, `biostation` for organism) are no longer referenced in the mounts table. Their `_buildXxx` builders stay in the file for now (will be removed in b194 if nothing else needs them).

**Roads.** Added forward cross-road @ z=-50 (x ∈ [-66, 66], 3.5u half-width) so vehicles can move E↔W between SIGINT tower and logistics yard without going all the way around the perimeter. Added back cross-road @ z=+30 for supply convoy. Added airfield spur @ x=+50, z ∈ [+30, +55].

**Local-only (no Cloudflare push)** per the no-deploy-during-iteration rule. `python serve.py 8000` running for verification.

**Files touched:** `js/scenes-selector.js` (panel mounts table rewrite, 8 new `_buildPanelHost` cases, new `_buildBrokenDish` ~140 lines, road shader masks updated, deprecated host builders left in place), `js/helpers.js` (build bumped through hook chain to b199), `FILE_MAP.md`, `CHANGELOG.md`. New: `BASEMAP.md`.

---

## b198 — 2026-05-06 — Fix audio playback on localhost — force /audio-mp3/ + Range-request support in serve.py

User: *"(index):1924 [audio] loading: https://pub-...r2.dev/jolly%20mood... only loads but doesnt do anything"* → after first fix → *"none of these play, 1 got an error. but still the corner top left media player doesnt move even if its been 30 seconds or whatever like stuck loading"*.

Two stacked bugs. b198 unblocks both.

**1. R2 silently stalls on localhost.** `audioBase` from `config.json` is `https://pub-....r2.dev/...`, and `<audio crossOrigin="anonymous">` triggers a CORS preflight. The R2 bucket doesn't whitelist `localhost:8000`, so the audio element loads metadata but never streams data — and crucially, **no `error` event fires**, so the existing `/audio-mp3/` fallback at [index.html:1891](index.html#L1891) never triggers. Patch: detect `localhost`/`127.0.0.1` after `config.json` resolves and override `state.audioBase = '/audio-mp3/'` before any track loads ([index.html:2856-2864](index.html#L2856-L2864)).

**2. `serve.py` ignores HTTP Range requests.** Python's `SimpleHTTPRequestHandler` returns full `200 OK` for everything, even when the browser sends `Range: bytes=N-M`. Chromium-based browsers (Vivaldi, Chrome, Edge) treat that as broken seeking support and `audio.play()` never resolves — currentTime stays `0:00` even though metadata loaded. The user's symptom — "stuck loading 30 seconds" — is exactly this. Added `_serve_with_range()` to `serve.py`: parses `Range:` headers, returns `206 Partial Content` with proper `Content-Range`/`Accept-Ranges` headers, streams in 64 KiB chunks. Wired in via a new `RANGE_EXTS` list (mp3, m4a, ogg, wav, webm, mp4); non-media paths fall through to the standard handler. Also overrode `do_HEAD` so HEAD requests behave consistently. Confirmed working: `curl -I -H "Range: bytes=0-100" http://localhost:8000/audio-mp3/dutch.mp3` now returns `206 Partial Content` with `Content-Range: bytes 0-100/1113487`.

Side note on the `AbortError: play() interrupted by new load request` the user saw mid-debug — that's the natural fallout of clicking the next button 7 times while waiting for any track to start. With Range working, a single click plays immediately and the cascade won't reproduce. Not adding debouncing — clicking 7 next-buttons in 2 seconds genuinely should abort previous play()s.

**Files touched:** `index.html` (+8 lines: localhost audioBase override after config.json fetch), `serve.py` (+~55 lines: Range-aware media handler + do_HEAD), `js/helpers.js` (b197 → b198), `FILE_MAP.md`, `CHANGELOG.md`.

---

## b192 — 2026-05-06 — Galaxy: Far-Cry-density ambient layer — micro fx tier, 4 new mid scenarios, twinkling starfield, per-title scintillation

User: *"follow far cry framework, something new every 30 seconds. animation, something happening, etc. what other scripted ship things can we do? id love more cool stuff explroation like shit. also what can wo about song titles. they feeel boring and static, like still in space."* → after pitching tiers + ideas → *"well do all"* (+ *"dont deploy to cloudflare until i say so, but run a localhost"*).

The 18-scenario pool (b189–b190) only fires every 22–40s. Long stretches between firings read as dead air, and the song titles felt frozen against the void even when ships were on screen. b192 adds a third **micro tier** firing every 5–12s, four new mid-tier scenarios, a real starfield, and per-title brightness life.

**Localhost-only.** No Cloudflare push (per re-issued no-deploy rule). `python serve.py 8000` running for galaxy/tracks/scenes during iteration.

**Micro tier — fires every 5–12s, anti-repeat memory of 3 (`_tickMicroScheduler`, `_fireRandomMicro`, `_tickMicroFx`):**
- `meteor` — fat bright streak across one quadrant in ~1.8s (separate from existing `_tickStreaks` ambient — bigger plane, brighter, deliberate one-shot)
- `pulsar` — fixed-position blinker, ~12s lifespan, sharp 1.4–1.9 Hz square-pulse rhythm with squared-sine envelope (sharp peak, dim tail)
- `buzz` — single banshee tearing past camera at 170 u/s (vs 80–120 standard), 1.6s life, off-axis pass close to forward vector
- `comm` — short text scrap ("…CONTACT BEARING 2-7-9…", "…UPLINK NOMINAL…", 11 variants) faded in/out near a random title using `TITLE_FRAGMENT` shader at 0.35-peaked triangle envelope
- `emp` — bright sphere flash from far point, 0.55s, sharp rise (12% sqrt curve) + 88% pow-1.6 falloff, scale grows 2 → 20
- `drone` — tiny octahedron darting between two random titles on a 1.4–1.9s arc with mid-flight perpendicular bump, head-glow sprite child

Each fx tracks `life`/`maxLife` locally and disposes its own geometry/material/textures via `cleanup()`. The `_tickMicroFx` loop walks the array in reverse and splices completed entries.

**Mid scenarios — added to `_fireRandomScenario` pool (now 22 ship-scenarios + the 4 focus-only):**
- `pirate` — 3 banshees chase 1 pelican target. Target weaves on two perpendicular axes; chasers home toward target with side-bias slot offsets (lateral ±9, vertical ±3), continuous barrel rolls, opportunistic red bolt fire (0xff5060) at 0.55–1.05s cooldown
- `patrol` — 2 pelicans painted as **emergency response** (per user spec — "PELICAN UNSC SHIP but different colors like an emergency response military vehicle space lights on"). 4 strobe sprites attached to each `outer` group: red ports + blue starboards. Sharp `pow(sin, 6)` peaks at ~1.6 Hz, alternating phase between red/blue. Slow 30 u/s lumbering speed
- `comet` — bright nucleus + 22-sprite trail crossing the full 360° on a great-circle path (220 u in, 220 u out). Trail sprites lag 1.4 + i*1.6 units behind nucleus; color gradient white-hot → ice-blue → deep-blue. ~12s traversal, fade-in/out at 8% endpoints
- `eva` — pelican holds station with breathing drift; small astronaut figure (capsule torso + sphere helmet visor + boxy backpack) drifts on a slack tether (Line geometry between anchor-local and figure-local), reels in over the last 3.5s

All four are wired into `_tickScenario` with proper case clauses; cleanup callbacks dispose attached sprites/lines/figures so ship pool reuse stays safe.

**Starfield (`_buildStarfield`, `_tickStarfield`):**
- 2200-star Points cloud at radius 380–450 (between titles at 130 and nebula at 600). Custom shader; per-vertex `aPhase`/`aRate`/`aSize`/`aTone` attributes mean every star has its own twinkle frequency (0.4–2.5 Hz) and phase
- Brightness oscillation 0.25–1.0 (never fully off — they're stars, not strobes), gl_PointSize scales by `90/(-mv.z)` so apparent angular size stays stable
- Color: cool blue-white ↔ warm peach mix via `aTone`, smoothstep-blended in fragment shader. Pareto-ish size distribution: 85% tiny (0.6–1.6), 15% noticeably bigger (1.7–7.7) for sparse "lead stars"
- `renderOrder = -1` so titles paint over them; `frustumCulled = false` so they're always present in the 360° dome

**Per-title scintillation — extends `TITLE_FRAGMENT`:**
- New uniforms: `uBreath` (±0.05 brightness offset, slow per-title sine driven by flickerSeed in animate loop) and `uTwinkle` (0..1 brief flash, eased toward target at dt*16 attack / dt*6 release)
- Twinkle scheduler distinct from existing `_burstNext` (which boosts `uHover` for glitch+RGB-split). Twinkle fires every 0.8–1.5s on a random title, brightening for 0.18–0.38s. Multiple can overlap so the field reads as scintillating-stars-of-different-distances rather than "one title is doing something"
- Both effects multiply col + a in the shader so they affect both luminance and alpha — small bumps but the cumulative reading is "void is alive"

**Files touched:** `js/marathon-world.js` (~600 new lines: TITLE_FRAGMENT shader uniforms + math, title material uniforms in `_buildTitles` + `_buildFragments`, animate-loop drive of breath/twinkle, `_buildStarfield` + `_tickStarfield`, init insertion after `_buildNebula`, animate-loop tick wiring for starfield + microFx + microScheduler, full micro-tier section after `_fireRandomScenario`, four new `_spawnPirateAmbush`/`_spawnPatrolPair`/`_spawnComet`/`_spawnEvaTether` methods + matching `_tickScenario` clauses, scenario pool updated), `js/helpers.js` (b191 → b192), `FILE_MAP.md`, `CHANGELOG.md`.

---

## b191 — 2026-05-06 — Deploy: ship `/`, `/tracks`, `/scenes` (galaxy index + catalog + scenes selector) to Cloudflare Pages

User: *"can we deploy this to my clotheshoesandwoes github"* → confirmed Cloudflare host (not Vercel; `wrangler.jsonc` + `_redirects` + `.wrangler/`, no `vercel.json`) → *"i just want u deploying uh cantmute.me so the galaxy index, the catalog page and the /tracks /scenes ... with the music obviously working but just deploy those 3 and well take it from there"*.

Tight-scope deploy. After confirming three target routes, soft-reset the initial broad-bundle commit and unstaged everything not needed for those routes. Pushed to `clotheshoesandwoes/musicportfolio-` (auto-deploys to cantmute.me via Cloudflare Pages).

**Routes shipping:**
- `/` → galaxy index (Text Galaxy + tracks vault rendered together via `index.html`)
- `/tracks` → redirects to `/` (handled by `_redirects`)
- `/scenes` → scene selector (`scenes/index.html` + `js/scenes-selector.js`)

Music works because `js/tracks-vault.js` carries its own audio analyser/playback wiring; `index.html` mounts both `marathon-world.js` and `tracks-vault.js` and they share the audio ctx.

**What went up (modified):** `index.html`, `scenes/index.html`, `js/helpers.js` (b190 → b191), `_redirects`, `FILE_MAP.md`, `CHANGELOG.md`, `CLAUDE.md`, `.gitignore`

**What went up (new):** `js/marathon-world.js`, `js/tracks-vault.js`, `js/scenes-selector.js`, `STYLEGUIDE.md`, `THEME.md`, `CUTS.md`, `serve.py`

**What stayed local (deliberately excluded):**
- Standalone scene experiments not part of the three routes: `corridor.html`, `galaxy.html`, `halo.html`, `object.html`, `scenes/play.html` and their scripts (`js/corridor.js`, `js/halo-game.js`, `js/object.js`, `js/text-galaxy-pro.js`)
- `js/player.js` modifications (only referenced by the deferred `scenes/play.html`)
- `ref-gifs/` (1.3 GB of rotoscope/Active Theory references — gitignored; would have blown past Cloudflare Pages' 25 MB/file limit)

**Memory updated:** `feedback_no_vercel_push.md` — clarified host is Cloudflare Pages (filename still references "vercel" historically; content + MEMORY.md description now correctly say Cloudflare).

**Files touched (this commit's edits):** `js/helpers.js` (b190 → b191), `FILE_MAP.md`, `CHANGELOG.md`. Plus the snapshot of new/modified files listed above.

---

## b190 — 2026-05-06 — Galaxy: keep the void busy — faster flybys + auto-firing scripted scenarios with anti-repeat

User: *"for galaxy make sure likely of it oplaying thru all our different scripted scenarios and random shit is high and changes often like variation in what end user sees"*

The b178 admin panel could *trigger* all 18 scripted scenarios manually, but nothing fired them on its own. Random flybys ran on a 5–15s cooldown, single-active-only — long quiet periods, no scenario variety unless the user opened the admin panel and clicked. b190 keeps the void in motion automatically.

**Flyby cadence tightened.** Initial wait `3–7s → 2–4s`. Between-flyby gap `5–15s → 3–7s`. Concurrent active flybys allowed up to `2` (was 1). Random flybys can now overlap, so on most frames there's at least one ship visible somewhere in the 360° sphere.

**New scenario auto-scheduler (`_tickScenarioScheduler`).** Fires every `22–40s`, picking one of the 18 scripted scenarios. First fire at `8–14s` after init.

- Always-eligible (14 scenarios): slipspace jump, mothership reveal, convoy, crash dive, fleet jump-in, derelict drift, interception, distress beacon, debris cross, ghost contact, carrier launch, escort run, silent observer, longsword strafe.
- Focus-required (4 more, only added when a title is locked): forerunner orbit, plasma storm, scanner sweep, emergency landing.
- **Anti-repeat memory** — last `5` fired scenarios are tracked; the picker filters them out, so a scenario can't repeat for 5 cycles minimum (≈110–200s of guaranteed novelty). Falls back to the full pool if the filter empties (shouldn't happen with 14+ candidates).
- Skips firing if a scripted scenario is already mid-run, to avoid stacking heavy scenarios (fleet jump-in + convoy = 9 ships at once). Re-checks 1.5s later.
- `try/catch` around the scenario fn so a single broken scenario doesn't poison the scheduler.

**Manual `clear all flybys` resets both timers.** When the user hits the admin "clear all" button, `_nextFlybyAt = now + 6` and `_nextScenarioAt = now + 14` so the stage stays clear briefly before the auto-fire resumes.

**Why these intervals.** A scripted scenario takes 8–25s to play out. With a 22–40s gap that means there's ~25–50% of the time a scenario is on screen, complemented by 1–2 random flybys filling the gaps. From the user's POV the void should never feel empty.

**Files touched:** `js/marathon-world.js` (init: `_nextFlybyAt` + new `_nextScenarioAt`; flyby gating loosened in the spawn block; new `_tickScenarioScheduler` + `_fireRandomScenario` methods; `_clearAllFlybys` reset extended to also bump scenario timer), `js/helpers.js` (b189 → b190), `FILE_MAP.md`, `CHANGELOG.md`.

---

## b189 — 2026-05-06 — Scenes: prop-on-road audit — tents, pelican pad, organism/wall/neural panels off the perimeter loop

User (with screenshots): *"Tents are in the road a bunch of random shits going on next to the galaxy sign. ... Organism building and billboard blocking for road. Jeep drives right through that pelican slash helicopter plane thing. ... neural is also really chaotic with a bunch of vehicles defense guarding. But then again a building right on the road. I think you understand how buildings should be right? They should actually [be at] the end of the road"*

Did a coordinates audit against the perimeter road network (rectangular loop x=±78, z in [-90, +50], 4.5u half-width, plus a central spine at x=0, z in [-12, -90]). Five concrete collisions identified and fixed.

**1. North bivouac tents straddled the spine road.** `_buildTents` placed the third cluster at center `(-8, -56)`. Layout offset `+5.4` put the third tent at world x = -2.6, squarely inside the spine road (x=0±4.5). Cluster center moved `(-8, -56) → (-22, -56)`. New offsets place all three tents at x ∈ [-27.2, -16.6] — fully clear. Personnel route `from: [-8, -56]` updated to match.

**2. Pelican pad sat on the south perimeter road.** `_buildPelicanPad` positioned the pad at `(-2, -8, 48)` with radius 9, so its footprint extended to z=57 — fully overlapping the south road leg (z=50±4.5). Both patrol Warthogs (CCW) and the patrol Scorpion (CW) traverse that leg, so they were driving through the parked Pelican. Pad pulled to z=24, well clear of the road. Updated three coordinated locations:
- `_buildPelicanPad` line ~5027 — `grp.position.set(-2, -8, 48)` → `(-2, -8, 24)`
- `_buildPelicanLights` line ~1378 — local `padZ = 48` → `padZ = 24` (cockpit lights, nav strobes, ramp glow, four floodlight stands all relative to padZ)
- `_buildEngineerCrew` line ~1480 — local `padZ = 48` → `padZ = 24` (3 ODST engineer figures, all positioned `padZ ± offsets`)

**3. Organism + wall panels too close to the south road.** Both panels were at z=+38, leaving only 7u between their host-building rear walls and the south road edge. In the screenshots the organism biostation reads as "blocking the road." Pulled both interior:
- `wall` — `[45, 4, 38]` → `[45, 4, 32]` (z=38 → 32, building rear edge now at z=37, road edge at z=45.5, 8.5u gap)
- `organism` — `[12, 3, 38]` → `[12, 3, 28]` (z=38 → 28, biostation 10×8 footprint rear edge at z=33, 12.5u gap)

Staggered z (32 vs 28) so the two south-side billboards don't read as a single flat plane from camera.

**4. Neural panel was stacked with the helipad.** `neural` at `(40, 4, -22)` and the `_buildHelipad` building at `(42, -25)` were 3u apart — the helipad pad + parked vehicles + cones around it created the "chaotic vehicles defense guarding" foreground in the screenshot. Neural moved to `(52, 4, -16)`: 12u east, 6u toward camera. Now sits east of the vehicle-bay/helipad cluster with its own clear sightline. Distance from helipad: ~12u (was 3u). Distance from camera: ~54u (was ~46u).

**5. (Not changed in b188 — flagged for follow-up.)** The user also mentioned the empty north field next to the galaxy panel and the back-left panel cluster (galaxy/dimensions/freq map/deep sea reading as a stack from camera). Audit confirmed the silo is the only major prop within 30u of galaxy and `dimensions` at (-58, 11, -49) is 10u xz from galaxy at (-55, 8, -78) — a real cluster. Holding off on these until the road-collision pass is in front of the user, since they're more subjective placement decisions vs. concrete collisions.

**Files touched:** `js/scenes-selector.js` (`_buildTents`, `_buildPersonnel` route, `_buildPelicanPad`, `_buildPelicanLights`, `_buildEngineerCrew`, `_buildPanels` — wall/organism/neural mounts), `js/helpers.js` (→ b189), `FILE_MAP.md`, `CHANGELOG.md`, `CLAUDE.md` (rewritten in same turn — dropped "show diff first wait for yes" ceremony + the all-caps mandatory-workflow preamble; kept the build/changelog/filemap rules and the don't-touch-what-I-didn't-ask-about guardrails).

---

## b187 — 2026-05-06 — Galaxy: admin panel — pull closer to media controls, drop title, hint of blur, scale down ~8%

User: *"the text is too far ay from media controlers. so move it up, also no title for admin panel. give it the tiniest background blur so that i dont have visibility issues, also make it smaller. scale down like 5-10%"*

Four discrete adjustments to the b185 transparent-text version:

**Pulled up.** `top: 360px → 220px`. The b185 panel started ~340px below the player block, leaving a big visual gap. New offset puts it directly under the media-controls area with consistent spacing on the left rail. `max-height` recomputed (`100vh - 240px`) so it still fits.

**Title gone.** `.mw-admin-title { display:none; }`. The "debug · scene control" header was redundant once the panel turned into floating text — reading the section labels themselves makes it clear what the panel is. Kept the head bar around as a sticky perch for the close `×` (otherwise users couldn't dismiss it without the `~` shortcut). Head padding tightened to 2px since there's no longer a title to hold up.

**Tiniest blur.** Was `background: transparent` with no backdrop filter — text could become unreadable over bright galaxy frames. Now `background: rgba(8,10,14,.22)` + `backdrop-filter: blur(6px) saturate(120%)`. Just enough fog to lock in legibility without the panel feeling like a window — the user explicitly asked for "tiniest." `text-shadow` softened proportionally (`0 0 14px → 0 0 10px`) since the blur now does some of that work.

**~8% scale down.** Width `300 → 276`, gap `22 → 18`, padding `14 → 10/12`, button font `13 → 12`, button padding `6px → 5px` line-height `1.35 → 1.32`, label font `11 → 10`, label letterspacing `.24 → .22em`, close-button font `18 → 15`. Numbers picked to be visible at a glance but no longer dominating the left margin.

**Mobile mirrored.** The `<760px` drawer gets the same scale + blur treatment: font `13.5 → 12.5`, gap `20 → 16`, button padding `9 → 8`, label `11.5 → 10.5`, plus `background: rgba(8,10,14,.28)` + `blur(8px)` (slightly heavier on mobile since the drawer is wider and bridges more of the bg).

**Files touched:** `index.html` (`.mw-admin*` block), `js/helpers.js` (b185 → b187 — skipped b186 since the user already used that for the scenes vehicle/halo fixes), `FILE_MAP.md`, `CHANGELOG.md`. **Not touched:** `js/marathon-world.js` — DOM structure unchanged.

---

## b186 — 2026-05-06 — Scenes: fix backward-driving vehicles, kill billboard halos, populate the base with tents + walking soldiers

User: *"It's getting better, but now we still have a lot of shit in the middle of the roads. What else? Be cool to see like military tents personnel running around like a you know important thing to important thing. Not too sure where the cars went. It'd be nice to have several patrol jeeps. The Jeep is still driving backwards, but. Nope, the tank is also driving backwards. And then every billboard has this weird glow to it which needs to be addressed. Or like some buildings have it as well."*

Six fixes on top of b182's perimeter-loop pass.

**Vehicle yaw fixed.** The b182 `_samplePerimeter` had Y-rotation signs flipped on the north + south legs of the loop (yaw `-π/2` for travel `-X`, yaw `+π/2` for travel `+X` — backward). The Warthog mesh is built front-facing -Z, so for `forward = (-sin(yaw), -cos(yaw))` to point in the travel direction, the correct mapping is: travel `-Z` → 0, travel `-X` → `+π/2`, travel `+Z` → π, travel `+X` → `-π/2`. Both of those were swapped, so vehicles drove rear-first along the top and bottom edges of the loop. Verified against the original b173 Scorpion patrol code's "travel +X → yaw -π/2" comment for sign convention. Fix: swap the two affected legs.

**Three patrol Warthogs instead of one.** With a 592u perimeter loop, a single CCW Warthog spent ~70% of its lap behind buildings or off-camera. Now three Warthogs spaced 1/3 of the loop apart — there's almost always one visible from the deck. All three CCW, all 13 u/s. Scorpion still solo CW at 8.5 u/s (slower because tank). `this.patrolHog` (singular) → `this.patrolHogs` (array); tick walks the array. The phase-offset for each is stored in `userData.t` as DISTANCE-along-loop (not time), and the tick adds `dt * 13.0` to it — that's the only consistent unit when sampling the loop directly.

**Panel halos collapsed.** Each billboard had a colored sprite halo at 1.8× panel size, opacity 0.45, additive blending — that was the green/red/magenta "fog" the user pointed at. The halo's job is to make the panel feel screen-emissive; at 1.8× it was painting the surrounding building canvas. Now 1.05× scale, 0.10 opacity. Same color tint, but the splash radius is roughly the panel itself, not 80% past its borders.

**Uplight palette desaturated.** b182 introduced `magenta`, `red`, and `green` colors for back-row buildings; combined with sprite opacity 0.82 and scale 11×22, those painted saturated washes onto the buildings. b186 drops the palette to `warm` / `cool` / `amber` only and reduces opacity to 0.65 + scale to 10×20. Specific reassignments: biostation green→cool, comm-tower reds→amber, wall-billboard magenta→removed entirely (the b182 magenta uplight was painting the panel face every frame). The two iconic back-far Standoff dishes also lose their magenta strobe-style uplight in favor of a subtle warm tone.

**Floor props pushed off roads + walkways.** `_pickFloorPosition` previously only avoided the panel-arc band (radius 15.5–20.5). Cones, crates, and fusion coils were spawning in the spine road and the deck-ring cement walkway. Added two more exclusion clauses: `Math.abs(x) < 5.5 && z < -10` (spine road) and `r > 12.5 && r < 19` (deck-ring walkway). Retry budget bumped 30 → 60 attempts since the valid annulus is narrower.

**Watchtower NE moved off the perimeter loop.** Tower at (78, -78) sat dead-center on the east leg of the new perimeter road — Warthogs were going to drive into it. Nudged all four watchtower positions outward to (±88, ±58) and (±88, -98) so they sit just outside each loop corner. Also makes them read more as "perimeter sentries" than "buildings on the road."

**Tents + walking personnel — base feels occupied.** New `_buildTents` adds three bivouac clusters (3 tents each) of GP-medium triangular-prism canvas tents: west cluster between deck and barracks, east cluster between deck and supply depot, north cluster between cmd bunker and radar. Each tent has a door flap and a faint warm interior glow sprite (canvas-lit-from-within, 0.08 opacity). Custom BufferGeometry — 6 vertices, 8 triangles, ~no perf cost. New `_buildPersonnel` adds 8 soldier figures (helmet + vest + body + legs + slung rifle, all box geometry, no sprites). Each walks a fixed two-waypoint route at 1.4–2.0 u/s with a sin-driven leg swing and vertical bob. Routes: bivouac → barracks, bivouac → vehicle bay, bivouac → supply depot, two cross-base runners on the cement walkways, radar → vehicle bay, etc. New `_tickPersonnel` in the animate loop. Yaw uses `atan2(-dirX, -dirZ)` to align mesh -Z forward with travel direction.

**Files touched:** `js/scenes-selector.js` (yaw fix in `_samplePerimeter`, `patrolHog` → `patrolHogs[]`, `_tickPatrolWarthog` rewrite, panel halo scale/opacity in `_buildPanels`, `_buildStructureUplights` palette + colors trimmed, `_pickFloorPosition` two new exclusion clauses, watchtower positions, NEW `_makeTent` + `_buildTents` + `_buildPersonnel` + `_tickPersonnel`, init wires `_buildTents` + `_buildPersonnel`, animate wires `_tickPersonnel`), `js/helpers.js` (b185 → b186), `FILE_MAP.md` build header, `CHANGELOG.md`.

**Known follow-ups (not in this pass):** building/billboard repositioning still pending — the user said "buildings on top of stuff" and "billboard placement doesn't make sense" but moving buildings rewires panel host positions and risks breaking click-focus. Holding for explicit confirmation.

---

## b185 — 2026-05-06 — Galaxy: debug panel redesign — strip chrome, regroup scripted scenes by intensity

User: *"for the menu, can we figure out better sorting for scripted scenes and shit. also the top debug scene control ugly title. also how to make the menu itself muhc more aestethic, do we take away the background and border and jhave it as text and whatevers hoevered over is colored, and like bigger text or something idk food for thought"*

The debug panel had three problems: a flat 14-item "scripted events (b177)" list with no internal hierarchy, a chunky `debug · scene control` Space-Grotesk title that read like a corporate dialog, and glass-panel chrome (semi-opaque bg, magenta border, backdrop-blur, scrolling fake-error overlay) that fought the immersive galaxy aesthetic.

**Sorting — three intensity-graded buckets, "other scenarios" folded in.** The 14 scripted scenes + 3 "other scenarios" are now split across three sections in `_buildAdminPanel`, each ordered low→high intensity:

- **cinematic** — silent observer · ghost contact · forerunner orbit · distress beacon · slipspace jump · mothership reveal
- **fleet ops** — escort run · convoy · carrier launch · longsword strafing run · interception · fleet jump-in
- **action · debris** — scanner sweep · emergency landing · derelict drift · debris field cross · crash dive · plasma storm

All `data-act` values preserved so the click dispatcher in `_buildAdminPanel`'s click handler still works unchanged. Parenthetical hints like "(focused title)", "(b177)", "(focus a title first)" stripped from labels — the in-panel focus hint inside the dogfight-pattern section already covers that case, and the scen- handlers already fall back gracefully when no title is focused.

**Title killed.** `<span class="mw-admin-title">debug · scene control</span>` removed from the head. The panel being open is signal enough; the close `×` floats top-right with no surrounding chrome.

**Chrome stripped.** `.mw-admin` background was `rgba(8,10,14,.42)`, border was `1px solid rgba(255,126,195,.18)`, plus `backdrop-filter:blur(22px) saturate(140%)` — all set to transparent/none. The decorative `.mw-admin-err-scroll` ::before pseudo-element (a 22-line scrolling fake error log used to bleed behind the glass) was content-noned. Sticky-header backdrop blur removed. What's left is type floating in the void.

**Type rescaled for the new aesthetic.** Body 11px → 13px Space Mono, buttons 11px → 13px, section labels 10px lowercase → 11px UPPERCASE letterspaced .24em. Section gap 14px → 22px. Panel width 280px → 300px to absorb the larger type.

**Hover behavior — color, not chrome.** Default ink dropped from `#e6eaf2` to `rgba(255,255,255,.62)`. Hover lifts the button to its section's `--cat` accent (magenta for combat, lavender for scripted, sky/teal/mint/amber/violet/coral/gold for the other categories) + slides 5px right + opens letter-spacing slightly. Old behavior (white-on-hover, padding-left shift, leading `·` bullet flipping to accent) replaced — the bullet is gone entirely, the indent shift is the only motion. ON-state preserved as bracketed `[ buttonText ]` in `--cat` accent for the FX/element/inertia toggle buttons (specificity bumped to `.mw-admin button[data-act]:not(.mw-admin-x).mw-fx-on::before/::after` so the brackets actually render against the new `content:none` default).

**Legibility against bright frames.** `text-shadow: 0 0 14px rgba(0,0,0,.92), 0 0 4px rgba(0,0,0,.95)` on the panel root so labels and buttons stay readable when the galaxy bloom punches the background brightness up.

**Mobile.** Drawer rules updated to match: 13.5px buttons, 9px tap-padding, transform:translateX(3px) on hover (was a padding-left shift), no fake-error overlay sizing rule (since the overlay is gone).

**Files touched:** `js/marathon-world.js` (`_buildAdminPanel` HTML — title removed, scripted/other-scenarios sections collapsed into 3 intensity-graded buckets), `index.html` (admin panel CSS block), `js/helpers.js` (b184 → b185), `FILE_MAP.md`, `CHANGELOG.md`.

---

## b184 — 2026-05-06 — Galaxy: shrink + push back the satellite gyros (the "saturn-looking thing" was a satellite)

User: *"this thing no idea what it is, still really close to th camera and huge"* (screenshot of a single ringed-orb satellite dominating the frame).

This wasn't the forerunner b183 fixed — it was a `_buildSatellites` "glass-ring gyro." Eight of them orbited the origin at radius 130-210u with rings of radii 1.8/2.4/3.0u and a halo sprite scaled to 14u. The halo + rings + additive bloom made each satellite read much bigger than its actual geometry, and one or two were always passing through the foreground because their orbit radius (130) was barely past the title shell (130).

**Count 8 → 5.** Half-as-busy starfield. Less chance of a satellite occluding what the user is actually trying to look at.

**Ring radii halved.** Was `3.0 / 2.4 / 1.8` with tube thickness `0.10 / 0.09 / 0.08`. Now `1.6 / 1.3 / 1.0` with thickness `0.06 / 0.055 / 0.05`. Total satellite footprint went from ~6u diameter to ~3.2u — small enough to read as scenery.

**Central orb 0.8 → 0.45** (radius). Roughly proportional to the ring shrink.

**Halo scale 14 → 7.** This was the biggest cause of the "huge" perception — the halo was 4-5× the satellite's actual ring footprint, so what looked like a Saturn-scale object was mostly the additive halo sprite.

**Nav lights scaled down.** Port/starboard positions `±3.2 → ±1.7`, white strobe `2.4 → 1.3`. Sprite scales `1.6 → 0.9`. Otherwise the nav lights would have hovered well outside the new ring footprint.

**Orbit radius 130-210 → 240-340.** Old range put satellites just past the title shell (130u), so they routinely cut through the foreground. New range parks them comfortably outside, between the titles and the marathon ship at -340u, where they read as distant traffic instead of foreground actors.

The admin toggle `el-satellites: ON/OFF` still works — if the user wants them off entirely they can kill them with one click.

**Files touched:** `js/marathon-world.js` (`_buildSatellites` only), `js/helpers.js` (b183 → b184), `FILE_MAP.md`, `CHANGELOG.md`.

---

## b183 — 2026-05-05 — Galaxy: push the forerunner away from camera (silent observer + unfocused orbit)

User: *"in last img the forerunner saturn looking thing is too close to camera"* (screenshot showing the ringed forerunner orb dominating the frame).

Two scenarios were spawning the forerunner inside near-camera space — the orb (radius 1.0) + 3 fresnel rings (max radius 2.6u) end up reading as a Saturn-sized landmark when placed too close.

**Silent observer.** Spawn distance forward 28u → **65u**. Lateral side-offset 6u → 12u, vertical lift 2u → 4u, scaled to match the new working distance. Still keeps the slow scale-in / hold / scale-out envelope.

**Forerunner orbit (unfocused).** Center distance 40u → **70u**. Orbit radius `18 + rand(6)` → `28 + rand(6)`. The focused-orbit branch (when a title is locked, radius 8–12) is intentionally unchanged — that close orbit reads as "the forerunner is examining this title" and the user has not flagged it.

At the new distances the rings still read clearly without occluding the title constellation behind them.

**Files touched:** `js/marathon-world.js` (`_spawnSilentObserver` + `_spawnForerunnerOrbit`), `js/helpers.js` (b182 → b183), `FILE_MAP.md`, `CHANGELOG.md`.

---

## b182 — 2026-05-05 — Scenes: rectangular perimeter loop, full-loop patrols, per-building illumination

User: *"Look at the building the roads. The billboards everything is ever clustered far away not illuminated you can't see stuff. The roads is like lead nowhere they don't connect properly... I would love like a whole like. Huge kind of roundabout not a roundabout like a square kind of you know road against the perimeter of the military base... I'd love like cement and like. Huge areas for you know the soldiers to walk and get to area to area. But I would still love to see some of the actual like ground as well... every buildinmg needs its own illumination."*

Three big things landed in `/scenes`: the road network is now a coherent rectangular perimeter loop (not the b173 spaghetti of branches/spurs/curves), both vehicles patrol that full loop in opposite directions, and every major building is now actually visible at night via brighter uplights + wall-mounted lamps. Cement walkways branch off the spine for soldier-scale paths between buildings while leaving plenty of dirt visible.

**Road network — perimeter loop replaces branches.** Previously the floor shader painted ten different road masks: spine + back-to-pelican + right-curved-branch + left-flank + left-extension + east-half-ring + west-half-ring + fuel-road + SE-spur + SW-spur. Roads dead-ended, branched mid-base, and the patrol vehicles only used a tiny fragment of them. Replaced with a clean 4-edge rectangular loop: x = ±78, z in [-90, +50], 4.5u half-width, with a single central spine (x=0, z = -12 to -90) connecting the hex deck to the north loop edge. Dashed centerlines on every leg. The loop encloses the full base footprint so vehicles circumnavigate it and every building sits *inside* the perimeter.

**Cement walkways — pale-grey foot paths.** New mask layer in the floor shader: a 13–18u radius ring around the hex deck (cement plaza), two cross-walks at z=-30 and z=-58 spanning the interior, and two side-walks at x=±30 connecting them. 1.6u half-width (narrower than roads). Pale-grey desaturated cement (0.165, 0.168, 0.182) with 2.6× noise. Walkways don't paint over asphalt — `walkMask *= (1.0 - roadMask)`. Per the user's "still want to see actual ground" — only ~15% of the visible floor is paved between deck and back perimeter; rest stays dirt.

**Distance-fade pushed out.** Was `smoothstep(80, 220) * 0.55` on color → buildings beyond ~80u were aggressively dimmed. Now `smoothstep(140, 260) * 0.45` and the base multiplier raised from 0.62 to 0.78. Result: the back perimeter (z=-90) and east/west edges (x=±78) read at near-full brightness instead of fading into murk.

**Vehicle patrols — full-loop circumnavigation.** New helper `_samplePerimeter(s, ccw)` samples (x, z, yaw) at distance s along the rectangular loop with proper corner heading transitions. Warthog drives counterclockwise at 13 u/s (~46s per loop, total perimeter = 592u), heading SE → NE → NW → SW → SE. Scorpion drives clockwise at 8.5 u/s (~70s per loop, slower because tank), starting half-loop offset (s=296) so the two read as coordinated patrol meeting on opposite sides of the base. Old single-segment ping-pong code (Warthog: x=0 spine z=-30 to -90; Scorpion: z=-22 x=-56 to -6) deleted.

**Per-building uplights — brighter + wider coverage.** Sprite opacity 0.55 → 0.82, scale 8×16 → 11×22 per unit. Color palette gained `green` (0x88ffaa) for the biostation greenhouse. Added uplights for ten previously-dark structures the original list missed: biostation (green), antenna shed (cool), 4 standoff comm towers (red/cool/red/cool), 3 standoff bunkers (amber), wall back-billboard (magenta).

**Wall-mounted exterior lamps — brighter splash.** Lens 0.10 → 0.22 opacity, downcast cone 0.18 → 0.32 opacity, cone scale 2.4×4.0 → 3.2×5.2. Added lamp banks to 5 previously-dark buildings: missile silo (3 lamps), vehicle bay (2), comm tower base (2), biostation (2), antenna shed (2). Existing lamp banks on cmd bunker / barracks / supply depot / radar building unchanged.

**Files touched:** `js/scenes-selector.js` (floor shader road network rewrite, `_samplePerimeter` helper, `_tickPatrolWarthog` + `_tickPatrolScorpion` rewrites, `_buildStructureUplights` boosted + extended, `_buildBuildingWindows` lamp boost + 5 new buildings), `js/helpers.js` (b181 → b182), `FILE_MAP.md`, `CHANGELOG.md`. **Not touched:** building world positions, billboard panel positions, building meshes themselves — only lighting + roads + patrols changed.

**Known follow-ups (not yet done):** building/billboard repositioning (user mentioned "buildings on top of stuff" and "billboard placement doesn't make sense") needs a separate pass — the panel positions are tightly coupled to building chassis offsets and moving them risks breaking click-focus, so left for after the user verifies this lighting/road pass looks right.

---

## b181 — 2026-05-05 — Galaxy: admin "panel" → glass overlay with bleeding error log + per-section accent + left-side anchor

User: *"still a panel. id rather cool text on screen, colored a bit more. mayeb glassiewr background with sokme weird data errors behind it, maybe also put it on the left side under media player options. make sur space and size is good on mobile css"*

b180 was correct in direction but too austere — the user wanted "cool text on screen," not a stripped-down minimalist panel. b181 keeps the b180 typography vocabulary but rebuilds the surface as a translucent glass overlay with a fake error log scrolling behind it, brings color back to per-section labels (without the b178 rainbow chaos), and re-anchors it to the left side under the media player.

**Glass instead of black.** `background: rgba(8,10,14,.42)` with `backdrop-filter: blur(22px) saturate(140%)`. Border drops from solid `rgba(255,255,255,.08)` to a tinted magenta hairline `rgba(255,126,195,.18)`. The panel now reads as something *layered onto* the scene rather than carved out of it.

**Fake error log behind the glass.** A `::before` pseudo-element with ~22 lines of monospace fake stack-trace / kernel-panic / shader-compile noise (`KERN_PANIC shader compile #fef0`, `0xC0FFEE :: scene::standoff missing`, `[stream] EAGAIN retry 4/8`, etc.). Positioned absolute, dimmed magenta `rgba(255,126,195,.10)`, line-height 1.55, animated to scroll vertically over 38s with `translateY(0 → -50%)` so it loops seamlessly. Pure decoration — `pointer-events:none`, `z-index:0`. Inner content sits at `z-index:1` via `.mw-admin > * { position:relative; z-index:1 }`. The scrolling errors are clipped horizontally by the panel's `overflow-x:hidden` while `overflow-y:auto` still allows the body to scroll for long sections.

**Per-section accent color back (subtle).** b180 used a single magenta everywhere; b181 uses 9 muted hues — magenta, lavender, sky, teal, mint, amber, violet, coral, gold — defined as a single `--cat` CSS variable per `[data-cat="..."]` selector. The `--cat` flows into: section label color, hover-arrow color, button hover dot, button-active text, and the `[ ... ]` brackets on `mw-fx-on` toggles. **No** category colors land on backgrounds, borders, or button bodies — those stay neutral. Result: scanning the panel, you can see at a glance which section a button belongs to without it feeling like a Lite-Brite.

**Re-anchored to left, under the media player.** Was `top:80px; right:24px`. Now `left:28px; top:360px` — sits below the `.tg-tl` media player block (which extends ~150–200px down from y=24). `max-height:calc(100vh - 380px)` so it never collides with viewport edge. On screens under 760px wide the @media query repositions to a bottom drawer (`left:16px; right:16px; bottom:16px; max-height:62vh`), bumps font size to 11.5px and button vertical padding to 7px (bigger tap targets), softens the hover-shift to 14px.

**Sticky head fix.** `.mw-admin-head` now uses `rgba(8,10,14,.92)` + `backdrop-filter:blur(8px)` and bleeds full-width via negative margins, so when the body scrolls under it the title doesn't render against bare error-log text.

**Files touched:** `index.html` (`.mw-admin*` CSS block — full overlay rewrite, mobile @media addition), `js/helpers.js` (b180 → b181), `FILE_MAP.md`, `CHANGELOG.md`. **Not touched:** `js/marathon-world.js` — DOM structure and class names from b180 still apply, so all hooks (`mw-fx-on`, `mw-collapsed`, `data-cat`) keep working.

---

## b180 — 2026-05-05 — Galaxy: admin panel restyle to match the music HUD vocabulary

User: *"spruce up the menu make it better sexier much cleaner and maybe fitting the theme better similar to our media controls area"*

The b178 admin panel had grown into a Halo dev console: rainbow per-category accents (9 different hues), gradient backgrounds, glow shadows, glowing dot indicators, ▶ play triangles on every button, frosted backdrop blur. Loud and busy. The user pointed at the music nav strip — `catalog scenes [admin]` with `BLUFF CALLER` track title above — as the target vocabulary: pure black, single magenta accent, mono text, brackets for active state.

**Stripped to a single accent.** All nine `[data-cat="..."]` color rules deleted. The `data-cat` attributes stay in markup (some JS still reads them for behavior) but they no longer drive any CSS. Hierarchy now established by typography + spacing, not tinting every block.

**Pure black, no chrome.** `background: #000`. Border `1px rgba(255,255,255,.08)` instead of magenta `0.55`. Killed the gradient + glow + multi-layer box-shadow + 12px backdrop-blur. The panel now reads like a track list overlay, not a pop-up dev console.

**Section blocks de-chromed.** Removed the colored left border, the `linear-gradient` section bg, the rounded-right corners. Sections are now pure typography: lowercase magenta letterspaced label, then a hairline-spaced button list below. The dot indicator before each label is gone.

**Buttons as list items.** No more boxed cards. Each button is now: a left-anchored `·` indicator, then the button text in body-ink, on transparent background, no border, no border-radius. Hover slides the indicator to magenta and shifts the text +4px right. Active darkens the indicator to magenta. The visual weight per button drops by roughly 4×, which makes the long `scripted events` list (15 entries) actually scannable.

**ON-state uses brackets, not green.** Toggled-on buttons (`mw-fx-on` class — fx flares, lens dirt, halation auto, scene elements, etc.) now render as `[ button text ]` in magenta — same `[ admin ]` convention as the music HUD nav.

**Header repositioned.** The title `debug · scene control` switches from uppercase tracked Space Mono with magenta glow to plain 15px **Space Grotesk** white (matches the `BLUFF CALLER` track title typography). Underline becomes a 1px hairline. Sticky-top header still works.

**Hint + flash de-tinted.** `.mw-admin-hint` no longer italic — straight body type at dim ink. `.mw-admin-flash` drops the orange/magenta backgrounds for a transparent box with magenta hairline border + magenta text.

**Collapse indicator simplified.** `▾`/rotation gone. Now `−` when expanded, `+` when collapsed, no transition jank. Indicator color is dim ink; goes magenta on hover.

**▶ stripped from button text.** Every action-trigger button (≈25 of them) had `▶ ` prefixed to its label. Now removed via `replace_all` — the new CSS adds its own `·` indicator before each button, so `▶` was redundant and visually loud. Other emoji icons (`⏸ pause`, `📸 save canvas as PNG`, `🎲 hop to random`, `↻ halation auto`) are kept because they signal distinct categories of action and aren't redundant with the dot.

**Files touched:** `index.html` (`.mw-admin*` CSS block, full rewrite — preserves all class names and selectors so existing JS that toggles `mw-fx-on` / `mw-collapsed` continues to work untouched), `js/marathon-world.js` (button text: `>▶ ` → `>` global replace, ~25 occurrences), `js/helpers.js` (b179 → b180), `FILE_MAP.md`, `CHANGELOG.md`.

---

## b179 — 2026-05-05 — Galaxy: keep mothership + ghost contact away from marathon ship landmark

User: *"mothership spawns too close to marathon ship"* (with screenshot showing both cruisers overlapping in the back-left).

The marathon ship is a **permanent** landmark hard-anchored at world `(-340, 36, -120)` (b174). The mothership reveal + ghost contact scenarios both compute spawn position from camera-forward + a random side, so when the camera was looking back-left, both cruisers ended up in the same volume of space.

**Fix.** Both scenarios now pick the spawn side based on which is furthest from the marathon ship's direction:

```js
const marathonPos = this.marathonShip ? this.marathonShip.grp.position : new THREE.Vector3(-340, 36, -120);
const sideSign = marathonPos.clone().normalize().dot(right) > 0 ? -1 : 1;
```

If the marathon ship lies on the camera's `+right` half-space (dot > 0), spawn on `-right`. And vice-versa. Falls back to the b174 hardcoded position if `this.marathonShip` is somehow missing. Result: mothership and ghost contact always spawn on the side of the camera's view that's empty, regardless of where the user is looking.

**Files touched:** `js/marathon-world.js` (`_spawnMothershipReveal`, `_spawnGhostContact`), `js/helpers.js` (b178 → b179), `FILE_MAP.md`, `CHANGELOG.md`.

---

## b178 — 2026-05-05 — Galaxy: 15 scripted scenarios + collapsible admin sections

User: *"for galaxy i see we added some stuff, whats missing, can u make sure admin menu has those scripted cscenarios included. alos make the headers in admin toggle collaplisble. anyweay what other scenarios scripted can we add"* → *"do it brah, do all 10 5 at time if need be"*

**The b174 unfulfilled promise.** b174 added the marathon ship + nav buoys and explicitly queued *"5 scripted scenarios (slipspace jump, mothership reveal in purple/blue, convoy of 3 pelicans with cargo, crash dive with smoke trail, fleet jump-in with 5–7 ships)"* for b175/b176. Both got hijacked by the scenes-selector chat scope (vehicle yaw fix, panel-per-building rebuild) and the galaxy promise sat unshipped. b178 ships all 5 plus 10 more.

### 15 new scripted scenarios
Wired in `_buildAdminPanel` under a new violet **`scripted events (b178)`** section. Each maps to a `_spawn*` method that configures pool ships (or mints ephemeral ones for batched scenarios) and a `s.scenario === '...'` branch in `_tickScenario` that drives per-frame motion.

The b174 five:
1. **slipspace jump** — single longsword, speed ramps 60→330 over 0.7s, additive blue tear sprite scales out + fades behind the nose
2. **mothership reveal** — ephemeral 70u-long purple/blue cruiser (procedural BoxGeometry: spine + 4 hangar pods + bridge tower + 24 lit window strips + engine glow sprite); drifts laterally past camera over 24s with fade-in/fade-out envelope
3. **convoy** — 3 pelicans in echelon formation (pool pelican + 2 ephemeral), cargo deployed, mild altitude bob per ship
4. **crash dive** — single longsword, gravity accel + spin (`rotation.z += dt*4 + tt*0.3`), continuous orange smoke puffs every 60ms via `_fireBolt(0xff8a3a)`
5. **fleet jump-in** — 6 ships hex-packed around a centerline (3 longsword + 1 banshee + 1 pelican + 1 longsword), each warps in at staggered 0.35s intervals with a blue radial flash sprite, then accelerates along shared heading

10 new ones:

6. **derelict drift** — pelican tumbling on randomized 3-axis spin, periodic orange spark bursts (4 bolts each, 0.7–1.6s interval)
7. **interception** — 1 banshee target with weave/lateral steering + 2 longsword chasers with lead-pursuit AI and staggered bolt fire
8. **distress beacon** — pelican parked at focused-title or forward point, red beacon sprite blinks SOS-ish rhythm (3 short, 1 long), tiny idle bob
9. **debris field cross** — longsword weaves through ephemeral group of 30 small icosa/octa/tetra shards (each with own spin + drift vectors); shards fully disposed via `scenarioCleanup`
10. **scanner sweep** — forerunner orbits focused title at radius 9u (or 18u unfocused), green additive `ConeGeometry` raycone attached to the orb, opacity pulses with `sin(scenarioTime * 6)`
11. **emergency landing** — pelican wobbles in low (decel ease-out cubic over 11s), grey smoke puffs after t > 4s
12. **ghost contact** — ephemeral cruiser silhouette at far distance (z=280, side-offset 80u), opacity = `sin(tt*1.2) * envelope * 0.7` so it phase-fades 3 cycles
13. **carrier launch** — 3 longswords at a single anchor, ripple-launch at 0/0.55/1.10s with bright flame trails and tight V slot offsets
14. **escort run** — pelican + 2 longsword wingmen tight V (`{0,0}/{-8,2}/{-8,-2}` slots) cruising at 38 u/s with sway
15. **silent observer** — forerunner materializes in front of camera, scales 0→1 over 1.2s, holds 5.8s, scales 1→0 over 3s, slow yaw rotation throughout

### Ephemeral ship plumbing
New helpers in `js/marathon-world.js`:
- `_acquireShip(type, opts)` — first checks pool free-list, then force-recycles a same-type ship, then mints ephemeral (`s._ephemeral = true`) via the existing `_makeXxx` factory. `opts.forceMint` skips pool checks entirely (used for the 2nd/3rd ship in batched scenarios so they don't recycle the pool ship the 1st one took).
- `_resetShip(s)` — clears scenario state + pelican-specific cargo/hatch/muzzle flashes + scale + rotation. Runs `scenarioCleanup` if present.
- `_disposeEphemeralShip(s)` — removes from scene graph, traverses for `geometry.dispose()` + `material.dispose()`, splices out of `flybyShips` pool.
- `_scenarioAnchor()` — returns focused-title position or `_forwardVec() * 40`.
- `_basisFromDir(dir)` — builds an orthonormal `{right, up}` basis given a forward vector (used everywhere for spawn geometry).

`s.scenarioCleanup` callback added to scenario state — runs once when the ship's lifetime expires (in `_tickFlyby`) or when `_adminClearFlybys` is invoked. Cleans up sprite/geometry/material allocations the scenario made (slipspace tear, mothership materials, beacon sprite, debris shard group, scanner cone, fleet flash sprites). Existing scenarios (combat, strafe, orbit, plasma storm) continue to use the manual cleanup path; new scenarios use `scenarioCleanup`.

`_tickFlyby` lifetime branch (lifetime ≥ maxLife) now: runs `scenarioCleanup`, hides the ship, optionally disposes if ephemeral. `_adminClearFlybys` does the same for all active ships in one pass.

### Collapsible admin sections
Each `<div class="mw-admin-section">` got a `data-key="..."` attribute (dogfight / dogfight-patterns / other-scen / scripted-events / camera / spawn / fx / feel / elements / time / capture / stage). New `_initAdminCollapse(root)` wraps each section's body in a `<div class="mw-admin-body">`, adds `mw-collapsible` to the label, hooks click → toggles `.mw-collapsed` class on the section + `.is-hidden` class on the body. Open/closed state persisted to `localStorage` under key `mw-admin-collapse-v1` so reloads restore the user's layout. Default = all sections expanded.

CSS in `index.html`:
- New `.mw-admin-section[data-cat="scripted"]` accent color (`#a890ff` violet — sits between camera blue and time purple)
- `.mw-admin-body` flex column wrapper, `.is-hidden` → `display:none`
- `.mw-admin-label.mw-collapsible` — cursor pointer, hover white, ▾ chevron in `::after` margin-auto pushed right; `.mw-collapsed > .mw-collapsible::after` rotates to ▸ via `transform:rotate(-90deg)`

### Files touched
- [js/marathon-world.js](js/marathon-world.js) — +5 helpers, +15 `_spawn*` scenarios, +15 `_tickScenario` branches, ephemeral cleanup in `_tickFlyby` + `_adminClearFlybys`, new admin section + 15 click handlers, `_initAdminCollapse` + `data-key` on every section
- [index.html](index.html) — collapsible CSS + new `scripted` accent color
- [js/helpers.js](js/helpers.js) — b177 → b178
- [FILE_MAP.md](FILE_MAP.md) — build header
- [CHANGELOG.md](CHANGELOG.md) — this entry

**Coming next:**
- Verify each of the 15 scenarios visually in `localhost:8000/` (open admin via `~`, run each button, confirm expected motion + cleanup)
- If any scenario reads weak (e.g. ghost contact too subtle, scanner cone too dim), iterate amplitudes
- Per-scenario follow-cam tuning (some auto-follow, some don't — currently gated on `!this.focused && !this._followDisabled`)

---

## b177 — 2026-05-05 — Scenes: split back-left cluster further + ridgeline beacons (kill background void)

User: *"Pretty cool much cooler still... a lot of empty spaces in the background that don't have any illumination. That's really annoying. A lot of the monitors are still like over one another and getting in the way and some of the roads are still endless."*

b176 moved 3 panels but the back-left cluster (galaxy/freqmap/dimensions/deepsea/neural) was still 5 panels in ~32° azimuth span — the user could still see all of them stacked when looking back-left. Two additional moves this build, plus the dark-mountain-void fix.

**Neural relocated.** Was on cmd-bunker-window at `(-30, 1, -52)` — azimuth -30°, sandwiched between galaxy (-35°) and terrain (-27°). Moved to `(40, 4, -22)` — azimuth +60°, in the previously-empty right hemisphere between living wall (+25°) and tape spine (+90°). Reuses the existing `back_billboard` host (the implementation is generic, just the kind name happens to say "back" — works fine for a front-right placement). Cmd bunker stays where it is as world filler; nothing hosts on it now, which is fine.

**Dimensions stratified vertically.** Same azimuth (-50°), same `antenna_shed` host, but y bumped from 2 to 11 — sits above galaxy (y=8) and freq map (y=5) instead of overlapping in the same horizontal band. Visual layering replaces angular separation here since the antenna shed is a real placement we want to keep.

**14 ridgeline aviation beacons.** Distributed evenly around the near-ridge ring (radius 100u with the same noise jitter as the silhouette mesh). Each is a slim dark mast + a colored running-light strobe at the top — colors cycle red/amber/cyan, blink rates randomized 1.2–2.0 Hz with random phase. Registered with `standoff.strobes` so the existing strobe tick animates them. Reads as distant comms peaks.

**24 far-ridge window glints.** Scattered tiny additive points (warm 0xffaa55 ~70%, cool 0x88aaff ~30%) across the far-ridge silhouette at radius 165u, varying y. Static — no blink, since these are window lights, not strobes. Suggests occupied structures across the valley.

**Files touched:** `js/scenes-selector.js` (mounts: 2 entries; `_buildRidgeline`: beacon + window-glint passes appended), `js/helpers.js` (b176 → b177), `FILE_MAP.md` (build header), `CHANGELOG.md`.

**Still open from this chat's queue:**
- Roads dead-end into nothing (user: *"some of the roads are still endless"*) — connect the spine + cross + service roads into a closed loop, or terminate dead-ends with structures
- Pelican / dish floodlight visibility (existing sprites are too dim — bump opacity, scale, sample density)
- Patrol car following the loop (depends on closed loop above)
- Ground crew + cargo lifecycle (workers picking up dropped crates)

---

## b176 — 2026-05-05 — Scenes: break left-side panel cluster + fix stretched portrait panels

User: *"deep sea hides tape spine looks terrible. When I move to the left a little bit I see [our] signs being cluster fucked living wall terrain organism dimensions. Galaxy frequency map wall. They're like why don't they all have a respective building respective position?"*

**Root cause of "looks terrible":** the panel texture is hardcoded to **720×432 (landscape, aspect 1.667)**. Two panels (`tape spine` 5×8, `wall` 4×6.5) were sized portrait — the canvas texture was being squashed onto a tall plane, mangling the title and body text. Five other panels were already landscape; those rendered fine.

**Root cause of left-side cluster:** 6 of 11 panels sat at azimuths between -82° and -30° (a 52° span = ~9° per panel — way too tight to drag-look without stacking). Right and rear hemispheres were sparse / empty.

**Three relocations** (each fixes one or both issues):

1. **Tape spine** — was `[5, 8.0]` portrait at `(65, 0.5, -7)` floating awkwardly above the supply-depot containers. Now `[8, 4.8]` landscape at `(60, 4, -2)`, mounted as a roof-billboard with under-panel catwalk, twin support masts, top strobe, caution stripe. Host kind: new `supplydepot_top` (shares the same `_buildSupplyDepot()` once-built flag with the original `supplydepot` host so we don't double-build).

2. **Wall** — was `[4, 6.5]` portrait on `fuel_tank` at `(67, 3, 8)` (azimuth +97°, behind camera and stretched). Now `[8, 4.8]` landscape at `(45, 4, 38)` (azimuth +130°, well behind camera in the previously-empty rear void). Host kind: new `back_billboard` — twin steel masts to the floor, concrete footing pads, thick steel frame, top strobe.

3. **Organism** — was `[4.5, 2.7]` on `barracks_row_window` middle barracks at `(-38, 1.5, -5.5)` (azimuth -82°, the worst left-cluster offender). Now `[7, 4.2]` on a brand-new `biostation` host at `(12, 3, 38)` (azimuth +165°, directly behind the deck). Fills the rear-center void and removes one panel from the left pile.

**New `_buildBioStation()` building** — small concrete shed (10×4×8) with a pitched glass-roof skylight that glows additive-magenta (warm pink grow-light vibe under the panes), roof ridge, vertical concrete ribs flanking the panel window, warm-glow door on the front face, side vents, exhaust stack, top strobe. Reads as a life-sciences outpost — thematically pairs with organism's "bio-reactive node network" copy.

**`fuel_tank` panel host case** is left in `_buildPanelHost` (currently unused but harmless — leaving it makes future re-mounting on a fuel tank trivial without re-implementing the case).

**`barracks_row_window` host case** is also left in (same reasoning — middle barracks still exists in the world).

**Files touched:** `js/scenes-selector.js` (mounts array rewrite, 3 new host cases in `_buildPanelHost`, new `_buildBioStation()` function), `js/helpers.js` (b175 → b176), `FILE_MAP.md` (build header), `CHANGELOG.md`.

**Coming next (this chat's queue):**
2. Pelican lighting + dish/satellite floodlights (still unlit black blobs)
3. Patrol car on a connected closed road loop
4. Ground crew + cargo lifecycle (workers carry crates from drop zone to depot)
5. Tape spine panel pass — verify the b176 horizontal version reads OK; if not, dedicated portrait-aware texture variant

---

## b175 — 2026-05-05 — Scenes: fix vehicles patrolling backwards (Warthog + Scorpion)

User: *"tank patrols backwards. like its moving backwards all vehicles are."*

Both vehicle meshes (`_buildWarthogMesh`, `_buildScorpionMesh`) are built facing **-Z** in local space (hood, headlights, gun, front block all at negative Z). The patrol tick code was rotating them by `Math.PI` / `±π/2` based on assumed +Z forward, which is exactly backwards.

**Warthog patrol** — moves `z=-30 → -90` (travel = -Z). Was setting `rotation.y = Math.PI` (faces +Z). Now `rotation.y = 0` (matches mesh's natural -Z forward). Two sites touched: `_buildPatrolWarthog` initial rotation + `_tickPatrolWarthog` per-frame rotation.

**Scorpion patrol** — moves along x-axis at z=-22. East-bound was `yaw = +π/2` (faces -X), now `-π/2` (faces +X). West-bound was `yaw = -π/2` (faces +X), now `+π/2` (faces -X). Reasoning written into the inline comments so future readers don't redo the math.

Wheel-spin direction (`-= dt * 8` Warthog, `+= dt * 4` Scorpion) intentionally untouched — purely cosmetic and not part of the user's complaint.

**Files touched:** `js/scenes-selector.js` (3 yaw-assignment sites), `js/helpers.js` (b174 → b175), `FILE_MAP.md` (build header), `CHANGELOG.md`.

**Coming next (this chat's queue, in order):**
1. Panel-per-building layout — kill the 261° arc, mount each scene panel on its own dedicated structure with clear sightlines (fixes "deep sea hides tape spine", left-side cluster pile-up)
2. Pelican lighting + dish/satellite floodlights
3. Patrol car on a connected closed road loop
4. Ground crew + cargo lifecycle (workers carry crates from drop zone to depot)
5. Tape spine panel pass (if not already covered by #1)

---

## b174 — 2026-05-05 — Galaxy: Marathon capital ship landmark + nav buoys (world furniture)

User: *"Mothership ( huge enemy purple blue ish) reveal would be cool. Convoy. Crash dive. Fleet jump-in. Nav buoys. Capital ship landmark — MARATHON ship from Bungies 2026 Marathon. Halo / emissive ring behind each title... halo ring on outside ring like on inside a world within the ring inner portion would be super cool"*

Splitting the user's wishlist into 3 patches so each is verifiable. b174 ships the persistent world furniture (Marathon capital ship + nav buoys); b175 will ship the per-title halo rings with inner-world interior; b176 will ship the 5 scripted scenarios (slipspace jump, mothership reveal, convoy, crash dive, fleet jump-in).

**Marathon capital ship (`this.marathonShip`).** Procedural homage to Bungie's 2026 Marathon colony-ship silhouette. Industrial spine + clusters + neon pinstripes:
- **Spine** — 180u-long horizontal cylinder (`r=7.5`), 4 ring-ridge details at x = ±60, ±20.
- **Forward command head** at x=+105 — icosahedron `r=11` plus 3 angled antenna spires with orange tip-lights.
- **Mid cargo cluster** — 4 cylindrical modules slung above the spine (alternating z offsets).
- **Belly cluster** — 3 rectangular box modules slung beneath.
- **Rear engine block** at x=-100 — 28×22×22 box plus 3 thruster cones (orange neon shader) each wrapped in a wider semi-transparent halo cone.
- **4 antenna spires** along the top of the spine with blinking teal tip-lights (per-antenna phase offset).
- **Window strips** — 50 small lit rectangles in 2 rows along both flanks of the spine, warm `#ffce80` glow.
- **Neon pinstripes** — 4 long 170u glowing rails (orange top, teal bottom, both flanks).
- **Forward navigation lights** — red port + green starboard at the head, blink π out of phase.

Custom emissive shader for all neon parts (`uTime` + `uBass` + `uColor` + `uIntensity`); pulses subtly with bass kicks. Placed at `(-340, 36, -120)` with `Math.PI * 0.18` yaw + slight `-0.06` roll so the silhouette reads asymmetric and angled toward the camera. Very slow yaw drift in tick (`±0.012` rad over 25s) to feel station-keeping but alive — not a static prop.

The whole thing sits comfortably inside the nebula skybox (radius 600u) and outside the title-sphere (radius 130u), so it's a stable visual anchor regardless of where you look.

**Nav buoys (`this.navBuoys`, 7 instances).** Small drifting blinkers planted in the mid-field (`r = 55..125u`):
- Tapered cylinder pylon (0.08→0.22, height 2.4) with 3 thin ring details.
- Top-mounted emissive sphere (`r=0.22`) in one of three palette-aligned colors (orange / teal / warm white) cycled by index.
- Procedural canvas-texture sprite halo around each blinker (additive, scale 2.6).
- Slight random tilt at build (`±0.2 rad`) so each looks set-down rather than floating perfectly upright.
- Slow drift (`±1.6u` x/z, `±0.9u` y on independent sin phases over 30–70s) + slow yaw (`+0.18 rad/s`).
- **Blink pattern** — 0.18s flash + 0.14s fade, then 2.1s dark. Sharp brief pop instead of even pulse. Halo opacity ramps with the flash; bass adds a small intensity bonus on top.

All randomized phase offsets so the field doesn't blink in unison. Buoys explicitly placed at `r > 55` to stay clear of the camera near plane and outside the immediate flyby zone.

**Admin toggles (`scene elements` section, amber).** Two new buttons: `marathon ship: ON` and `nav buoys: ON`. Wired into `_adminToggleElement` map (keys `marathon` and `buoys`). Element-state hint updater shows current visibility.

**Files touched:** `js/marathon-world.js` (init() additions, `_buildMarathonShip()`, `_tickMarathonShip()`, `_buildNavBuoys()`, `_tickNavBuoys()`, animate loop ticks, admin HTML buttons, element state hints, toggle map entries), `js/helpers.js` (b173 → b174), `FILE_MAP.md` (build header), `CHANGELOG.md`.

**Coming next:**
- **b175** — per-title halo rings (outer torus glow + inner "world within" shader pattern) on all 117 titles
- **b176** — 5 scripted scenarios (slipspace jump, mothership reveal in purple/blue, convoy of 3 pelicans with cargo, crash dive with smoke trail, fleet jump-in with 5–7 ships)

---

## b173 — 2026-05-05 — Galaxy: halation visibility pass + random-on-load + auto-cycle toggles

User: *"maybe we cycle thru the color grades on a timely based or on a refresh? same for halation no idea what it is not too noticeable cant tell if like or not but interested"*

Galaxy page only — separate from the b172 scenes work that landed in parallel. User couldn't tell what halation was doing — that's a "make it readable" bug, not a "you don't like it" signal. Two interventions: bump the effect, and randomize on load so each refresh forces a different look in front of you.

**Halation cranked up.** b171 was sampling at 11px base radius / 0.62 highlight threshold / 0.32–0.62 strength — easy to miss on a magenta-on-void scene where bloom was already doing 80% of the work around the titles. b173:
- Radius `11 → 28px`, plus a 3rd ring at `3.6×` (so the bleed reaches ~100px from a bright pixel — the noticeable-glow regime).
- Tap count `8 → 12`, weights `[0.65, 0.35] → [0.60, 0.30, 0.18]`.
- Highlight thresholds `0.62/0.70 → 0.45/0.50/0.55` so more of the title fill contributes (not just the corebrightest pixels).
- Strengths roughly doubled: Vision3 `0.38 → 0.70`, Portra `0.32 → 0.62`, **CineStill `0.62 → 1.10`** (this one should now be unmissable — the iconic red bleed), Eterna `0.34 → 0.62`.
- Tints slightly more saturated.

**Random on refresh.** Composer init now picks halation `1..4` and color grade `1..5` randomly instead of starting both at OFF. Every page load = different look. DoF stays off by default (it's a focus-mode tool, not a vibe knob).

**Auto-cycle toggles.** Two new admin buttons under `post fx`:
- `↻ halation auto: OFF/ON` — advances `uHaloStyle` every **6 seconds**, skipping OFF.
- `↻ grade auto: OFF/ON` — advances `uGradeStyle` every **9 seconds**, skipping OFF.

When ON, the animate loop accumulates `dt` and advances the uniform when the period elapses. Hint updater fires so the labels reflect current state. Toggling auto OFF leaves the current preset locked in.

**Why those periods?** Halation reads as a tonal shift — 6s is long enough to take it in but short enough to taste several stocks per minute. Color grade is a bigger perceptual change (whole color cast moves) so 9s gives each look room to settle.

**State.** New `this._autoHalo`, `this._autoGrade`, `this._autoHaloT`, `this._autoGradeT` initialized in `init()` next to the inertia state. New helper `_adminToggleAutoCycle(which)` resets the timer when toggled.

**Files touched:** `js/marathon-world.js` (POST_FRAGMENT halation rewrite; uniform random init; auto-cycle state + admin buttons + click handlers + hint labels; animate-loop tick), `js/helpers.js` (b172 → b173), `FILE_MAP.md` (b172 → b173), `CHANGELOG.md`.

---

## b172 — 2026-05-05 — Scenes: tan-desert ground, hex observation deck, +5 building clusters, focused flood beams (kill the painted helipad + circling jeep)

User: *"redesign the scenes page... metal gear outside base or halo 3 standoff nighttime... the main platform should not be a circle or maybe it's like a huge hexagon... many more buildings, floodlights, roads, barracks, vehicles out and about... illumination on the radar/satellite dishes... right now positions for things are super fucky."*

Top-to-bottom rebuild of the `js/scenes-selector.js` environment around the existing click→card panel system. Six structural changes:

**1. Floor shader rewritten — tan desert + asphalt road network.** The b164 concrete pad with painted helipad rings (r=20, r=15.5) + center cross + 24-27u caution-stripe band is GONE. Replaced with:
- Base color now warm tan (`vec3(0.135, 0.112, 0.075)`) with multi-octave noise, sparse darker rocks, sparse dry-grass tufts.
- **Spine asphalt road** along x=0 from z=-12 to z=-95 (deck → ops row → launch complex), 9u-wide with dashed yellow center line every 2.5u and yellow shoulder caution-stripe hatch.
- **Right-flank service road** (curved segment) from spine at (4.5, -22) toward motor pool at (44, -38).
- **Left-flank service road** at z=-22 from spine to barracks row at x=-58.
- **Back service road** to pelican pad (x=-2, z=14 to 50).
- Compacted-dirt apron under the deck (r=8-14), slightly redder/darker.
- Distance-fade now stays VISIBLE: `0.62 + 0.38 * (1.0 - smoothstep(80,220,d) * 0.55)` instead of b164's `0.30 + fade * 0.70` that hit pure black at r=95. Distant buildings at z=-110 now read as standing on real terrain instead of phasing through black void.

**2. Hexagonal observation deck (`_buildHexDeck`).** The user's vantage point. Hex platform (radius 12, floor at y=-7.6) with:
- 6-sided cylinder geometry, flat face perpendicular to forward (-Z).
- Tread surface inset, 6 spoke ribs from center.
- Sandbag walls along 5 of 6 faces (bottom + staggered top), front face left OPEN with a yellow caution stripe on the deck edge.
- 6 corner floodlight posts (5u tall) with fixtures aimed OUTWARD (not at the camera) — each with a volumetric flood-cone sprite that extends downward+outward to splash light onto the apron.
- Replaces the painted-helipad reading of the immediate ground.

**3. Patrol jeep loop killed (`_buildPatrolWarthog` / `_tickPatrolWarthog`).** The b164 Warthog driving an oval at radius 24-26 around the camera was the literal "jeep drives in a circle" the user called out. Replaced with:
- THREE parked Warthogs at scattered yaws in the motor-pool zone (x=30-44, z=-32 to -36), reads as motor-pool clutter.
- ONE slow-mover crawling AWAY from camera along the spine road (x=0, z=-30 → -90, 5 u/s, snap-respawn at -30). Reads as a vehicle going on patrol into the base, not orbiting the user.

**4. Five new building clusters added** — fills the empty middle/back-distance and supports the "live-in-use base" vibe:
- **`_buildBarracksRow`** — 3 additional barracks at x=-50/-38/-28, z=-12. Each has 3 lit warm window strips on the long side, lit door, antenna stub, roof caution stripe, stenciled number plate. Faces +Z toward camera so the lit windows are visible.
- **`_buildFuelDepot`** — far-right at (72, -8, 8). 4 cylindrical fuel tanks (r=2.4, h=4.5) in a 2×2 grid on a concrete pad, each with reinforcing band, top dome, base caution-stripe ring, stenciled number. Pipework spanning between adjacent tanks. Half the tanks carry red aviation strobes. Posted chain-link fence around perimeter.
- **`_buildAntennaArray`** — back-left at (-58, -8, -56). 8 antenna masts of varying heights (8-16u) in a loose 3×3 grid on a concrete pad, each with a cross arm, top dipole, guy wires; every 3rd carries a red strobe. Equipment shed at south edge with a lit door.
- **`_buildWatchtowers`** — 4 tall lattice towers at perimeter corners (NE 85,35; NW -85,35; SE 78,-78; SW -82,-75). Each tower: 4 lattice legs (14u tall), cross-bracing rings, enclosed cabin at top with 4 lit warm window strips, **slowly-rotating searchlight** on the cabin roof (each at its own 0.20-0.35 rad/s rate via `_watchtowerLights` tick), aviation strobe at the tip (red on NE/SW, blue on NW/SE).
- **`_buildPerimeterClutter`** — connective tissue: jersey-wall lines flanking the spine road shoulders, jersey wall around the parked motor pool, jersey wall between barracks row and the road; **catenary floodlight rig** along the spine road (5 segments × 2 sides = 10 down-cast warm cones); 32-post chain-link **perimeter fence** at radius 92 with barb segments.

**5. Focused volumetric flood beams (`_buildBuildingFloodBeams`).** The b169 uplight-halo SPRITES at building bases produced glow columns but didn't actually illuminate the structures — buildings stayed dark silhouettes. New rig adds DIRECTED beams from ground spotlights aimed AT the structure body:
- Each beam is a chain of 4 SpriteMaterial flood-cones with `center.set(0.5, 0.0)` (pivot at base) placed along the path from source ground to target structure point, scaling up with distance. Plus a bright spot at the hit point on the structure.
- **Central dish (15, -110)**: 3 beams from (30, -95), (0, -95), (-15, -95) — really lights it up.
- **Missile silo (-55, -84)**: 3 amber beams from front + back.
- **Standoff back-right dish (58, 58)**: 2 magenta beams.
- **Standoff back-left dish (-72, -45)**: 2 cool-blue beams.
- **Cmd bunker (-40, -71)**: 2 cool-blue beams.
- **Radar building (20, -47)**: 2 cool-blue beams.
- **Comm tower (-38, -24)**: 1 cool beam.
- **Antenna array**: 1 cool beam.
- **Fuel depot**: 1 warm beam.

**6. Floor-prop scatter pulled off the deck.** `_buildFloorProps` cones / coils / crates pushed from radius 4-25 → 14-32 so they don't sit on top of the new hex platform.

**Cleanup:** removed b164's 4 loose sandbag berms in `_buildStandoff` (replaced by the hex deck's integrated sandbag wrap).

**Files touched:** `js/scenes-selector.js` (floor shader rewrite, `_buildHexDeck`, `_buildBarracksRow`, `_buildFuelDepot`, `_buildAntennaArray`, `_buildWatchtowers`, `_buildPerimeterClutter`, `_buildBuildingFloodBeams`, patrol-warthog rewrite, floor-prop minR bump, `_watchtowerLights` tick added to animate, sandbag-berm removal), `js/helpers.js` (b171 → b172), `CHANGELOG.md`, `FILE_MAP.md`.

---

## b171 — 2026-05-05 — Galaxy: 4 new post-FX toggles (DoF / halation / color grade) + drag inertia

User: *"medium. bokeh if toggleable in admin. 8 toggleable. 10 toggleable. 11 i didnt like ur previous color grades so interested in what else u got. 12 curious about mm styles and stuff. toggle pls. 13 toggle pls. ... whatever's best brotha just tell me what u do yknow"*

Galaxy page (`/`) only — scenes redesign coming in a separate chat. Shipped the cheap, single-pass FX in b171; the heavier multi-pass stuff (real hex DoF, volumetric god rays, shutter ghosting) is queued for b172 because they need extra render targets and I want them isolated in case anything goes wrong.

**Soft DoF (`uDofOn`).** When enabled and a title is focused, every other title (and the world behind them) gets a 9-tap radial blur weighted by its UV-space distance from the focused title. The focused title and a `0.22` radius around it stay sharp; outside that radius `smoothstep(0.22, 0.44)` ramps the blur up over a 0.22-UV soft band. Animate loop projects the focused title's world position to NDC each frame and pumps it into `uFocusUv`. When no title is focused, focus snaps to screen center with a `1.5` (effectively infinite) sharp radius, so nothing blurs. Cheap fake DoF — proper hex-aperture bokeh comes in b172.

**Halation (`uHaloStyle`, cycles 0..4).** Film-stock red-orange bleed around bright highlights. 8-direction radial sample of the highlight component (extracted at `0.62`/`0.70` thresholds, two-ring inner+outer for softer falloff), additively blended back with a per-stock tint:
- **Vision3 250D** — warm orange `(1.30, 0.55, 0.18)`, soft strength
- **Portra 400** — pinker `(1.20, 0.55, 0.78)`, finer
- **CineStill 800T** — aggressive red `(1.60, 0.30, 0.20)`, the iconic Instagram-grade leak
- **Fuji Eterna** — green-shifted `(0.50, 1.10, 0.62)`, vintage anime cel

Cycles via the `halation:` button — label shows current stock or `OFF`.

**Color grade (`uGradeStyle`, cycles 0..5).** Lift / gamma / gain in the post pass instead of a pre-baked LUT. The b137 LUT system was scrapped because the presets were rigid — this version uses live shader math so each preset is tunable later if needed. Five presets:
- **Bleach bypass** — desaturate (mix to 55% of luminance), crush blacks `lift -0.04 / -0.02 / 0`, lift mids
- **Teal & orange** — shadows blue-cyan, highlights warm `gain 1.10 / 1.00 / 0.90`
- **Cyberpunk neon** — magenta shadows, cyan highlights — pairs with the existing palette
- **Cold film** — slight green-shift mids, blue shadows, soft rolloff
- **Warm halation** — orange highlights, magenta shadows — pair with the halation toggle

Cycles via the `color grade:` button.

**Drag inertia (admin "drag inertia: ON" by default).** `_onMove` now smooths instantaneous yaw/pitch deltas into `_dragVel` (mix factor 0.45 with previous, scaled to per-second), `_onPointerDown` clears velocity on grab, and the animate loop applies + decays it after release with `Math.exp(-dt * 4.0)` (~0.18s half-life). Pitch clamp resets the affected axis when hit so the camera doesn't jerk. Toggleable via admin "feel" section so it can be disabled if it ever feels off. Big perceptual upgrade — drag-look has weight now instead of stopping dead.

**Admin additions.** New `feel` section under `camera` for the inertia toggle. The `post fx` section gained three buttons (`soft DoF`, `halation`, `color grade`) and uses the existing `_adminToggleFx` for binary toggles plus a new `_adminCycleFx(uniformKey, modulo)` helper for the multi-state cycles. Hint updater renders the current cycle state name (`Vision3` / `Bleach` / etc.) in the button span and applies `mw-fx-on` highlight when non-zero.

**Cost.** Added at full stack: halation 16 taps + DoF 9 taps + grade 1 op = ~26 lookups. Combined with the existing flares/godrays/dirt that's ~71 worst-case under heavy bass — still well within budget on integrated GPUs at this resolution. All branches use `if (uX > 0.5)` so disabled effects skip their tap loops.

**Files touched:** `js/marathon-world.js` (POST_FRAGMENT halation+DoF+grade blocks; new uniforms; admin HTML; click handlers; cycle helper; inertia state + onMove velocity smoothing + onPointerDown reset + animate loop decay; focus UV projection in animate), `js/helpers.js` (b170 → b171), `CHANGELOG.md`, `FILE_MAP.md`.

**Coming in b172** (per the same conversation): hex-aperture bokeh DoF (proper depth pass), volumetric god rays (raymarched shafts replacing the radial-blur fake), shutter ghosting (feedback buffer trail). All need extra render targets so they're shipping separately.

---

## b170 — 2026-05-05 — Post FX ON by default + admin panel color-coded by category

User: *"these post fx on by default pls. what other post fx can we add that add to this. color admin panel and make it nice looking. distinct the diff categories"*

**Post FX defaults flipped to ON.** `uFlaresOn`, `uDirtOn`, `uGodraysOn` all initialize to `1` instead of `0`. Button labels now read `ON` on first paint to match. Anamorphic flares + lens dirt + god rays are part of the look from the moment the page loads — no longer hidden behind the admin panel. (Cost is fine — the b136 measurement put the full stack well under 1ms on integrated GPUs.)

**Admin panel: per-category accent system.** Each `.mw-admin-section` now carries `data-cat="combat|camera|spawn|fx|elements|time|capture|stage"`. CSS sets `--cat`, `--cat-soft`, `--cat-mid`, `--cat-strong` per category and the section pulls its accent from those vars. Palette:
- **combat** — magenta `#ff5ab4` (dogfight + scenarios)
- **camera** — sky blue `#7ec8ff`
- **spawn** — cyan `#5dd5e0`
- **fx** — green `#7effc3` (matches the existing `mw-fx-on` highlight)
- **elements** — amber `#ffb068`
- **time** — violet `#b48cff`
- **capture** — coral `#ff9a76`
- **stage** — gold `#e9c976`

Each section now has a 2px colored left bar, a soft category gradient washing in from the left, a colored category label with a glowing dot bullet, and per-button hover that picks up the section accent. Buttons get a subtle 2px colored left edge so the category is visible even when reading the button itself. Header gained a subtle text-shadow glow and is sticky so it stays visible while scrolling. Custom thin scrollbar. Added `:active` press feedback.

**Files touched:** `js/marathon-world.js` (uniform defaults 0→1, label spans OFF→ON, `data-cat` on every section), `index.html` (admin CSS rewritten with category vars + per-cat overrides), `js/helpers.js` (b169 → b170), `CHANGELOG.md`, `FILE_MAP.md`.

---

## b169 — 2026-05-05 — Scenes: extend the base outward + structure uplights (kill the camera-blast)

User: *"this doesn't make sense. you keep limiting stuff to the 360. you don't have to. the floodlights should illuminate the distant models like the sat. dish, the radar, the missile launch silo, etc etc. we have a static camera but around it make a military base, what's holding you back, are you abiding by some flawed rule?"*

The b168 floodlight rig (12 poles at radius 28 with 0.95-scale lenses + 0.42-opacity cones + 0.55-opacity ground spots) was blasting the camera with bright orbs while the actual base structures stayed dark in the background. Buildings were also still clustered at radius 30-50 — too tight for "an installation." b169 fixes both: pushes everything outward 50-70%, kills the camera-blast floodlights, and adds structure uplights that actually paint the distant buildings visible.

**Buildings pushed outward.** Each major structure moves 50-70% further from camera so the base reads as extending into the world, not surrounding the user:

| building | b168 center | b169 center | shift |
|---|---|---|---|
| central dish | (8, -8, -68) | **(15, -8, -110)** | +42u back |
| missile site | (-40, -8, -59) | **(-55, -8, -84)** | +29u out |
| cmd bunker | (-30, -8, -48) | **(-40, -8, -71)** | +25u out |
| radar building | (14, -8, -36) | **(20, -8, -48)** | +13u out |
| vehicle bay | (35, -8, -22) | **(50, -8, -27)** | +15u out |
| barracks | (-44, -8, -22) | **(-65, -8, -22)** | +21u out |
| supply depot | (42, -8, -7) | **(65, -8, -13)** | +23u out |
| comm tower | (-26, -8, -17) | **(-38, -8, -24)** | +13u out |
| helipad | (28, -8, -15) | **(42, -8, -19)** | +14u out |

Panel mount positions and sizes scale up to match — most panels grew from 5×3 → 7×4.2 or 9×5.4 so they still read at the new distance. Galaxy billboard 11×6.6 → **16×9.6** at -78 z.

**`_buildStructureUplights()` — the actual dramatic illumination.** This is where the user's "floodlights should illuminate the distant models" feedback gets answered. New helper paints a tall additive light-cone sprite at the base of every major structure: each sprite is built from `_makeUplightTexture()` (canvas radial gradient, bright wide at the bottom-center fading to transparent at the top, 128×256), with `Sprite.center.set(0.5, 0.0)` so scaling extends the cone UP from the floor. Per-structure colors:

- **central dish** at (15, -110), scale 3.2, **warm** — biggest uplight, dominates the skyline
- **missile silo** at (-55, -84), scale 1.8, **amber**
- **cmd bunker** at (-40, -71), scale 1.4, **cool**
- **radar building** at (20, -47), scale 1.3, **cool**
- **vehicle bay** at (50, -27), scale 1.2, **amber**
- **comm tower** at (-38, -24), scale 1.6, **cool** — narrow, tall
- **helipad / barracks / supply depot** — amber/cool 1.2
- existing b164 standoff dishes at (58, 58) and (-72, -45) get **magenta** uplights, scale 1.4-1.6

`_buildStructureUplights()` runs after `_buildPanels()` in init.

**Floodlight rig pulled back hard.** `_buildFloodlightRig` simplified from b168's 12-pole / 0.95-lens / 0.42-cone / 0.55-spot blast → 8 poles at r=30 / 0.32-lens / 0.18-spot only (cones removed entirely). Job now is "dim moonlight on the deck" — the dramatic stuff comes from the structure uplights painting buildings, not from poles next to camera.

**Pelican landing pad behind camera.** New `_buildPelicanPad` + `_makeParkedPelican` fills the back direction (z=+48). Big concrete pad (r=9), 2 painted landing rings, 24-tab yellow caution rim, 4 amber approach lights at cardinals, parked simplified Pelican (1.2× scale, with landing-gear struts). The back direction is now a clear themed feature instead of empty void.

**Kill balls pushed out.** b168 had 4 kill balls hovering at radius 26-36 — they were the bright orange/yellow plasma orbs in the foreground blocking the buildings. b169 cuts to 2 balls at radius 70-90 (back-left + back-right) so they read as distant plasma reactors in the deep base, not foreground clutter.

**Files touched:** `js/scenes-selector.js` (mounts table positions+sizes pushed outward, all `_placeBuilding` calls retargeted, `_buildFloodlightRig` simplified, `_buildStructureUplights` + `_makeUplightTexture` new, `_buildPelicanPad` + `_makeParkedPelican` new, central dish position pushed to z=-110, kill ball spawn cut from 4→2 and pushed to r=70-90), `js/helpers.js` (b168 → b169), `FILE_MAP.md`, `CHANGELOG.md`.

## b168 — 2026-05-05 — Scenes: missile launch site, radar building, brighter base, spread panels

User: *"floodlights around the military installation… make it look like a military installation… all the monitors are still in the same area crowded… we can have a missile launch site for galaxy, and galaxy's monitor is near there."* The b167 base put 3 panels on the cmd bunker (cluster of galaxy + dimensions + living wall in a tight back-left zone), buildings were too dark to read against the night sky, floodlights barely registered, and there were no truly Standoff-iconic features (silos, radar antennas, Jersey barriers).

**Panel redistribution.** The cmd bunker dropped from 3 panels to 1 (just `dimensions`); galaxy and living wall both got their own dedicated structures so no two panels share a quadrant:

| panel | b167 pos | b168 pos | new home |
|---|---|---|---|
| galaxy | (-30, 8, -42) | **(-40, 6, -55)** | **NEW: missile launch site** |
| dimensions | (-30, 1.5, -32) | (-22, 1, -28) | cmd bunker single window |
| living wall | (-22, -1.5, -32) | **(14, 1, -30)** | **NEW: radar/operations building** |

Other 8 panels unchanged. The 11 panels now live in 8 distinct directions (front-left missile, mid-left bunker, far-left barracks, mid-left tower, front-center radar, mid-right helipad, front-right vehicle bay, far-right depot) plus 3 close-foreground consoles — no clustering on any single side.

**`_buildMissileSite()` — galaxy's new home.** Octagonal concrete launch pad (7.5u radius, painted target rings + center cross + 24-tab yellow caution rim) with a vertical silo at the center: 12u tall cylinder, yellow caution chevrons every 2u, "07" stencil panel, conical cap, partially-extruded missile body and pointed nose poking out the top, red strobe at the cap. Open lattice service gantry beside the silo (2 posts + cross-bracing + a service arm reaching toward the silo at mid-height). Adjacent control bunker (5×4×5 with roof slab + warm-amber slit window). Sandbag perimeter (28 bags arranged in a circle at r=8.9). 4 Jersey barriers between sandbags and the gantry. Galaxy panel mounts on a free-standing billboard frame with twin masts to the pad, red strobe on top.

**`_buildRadarBuilding()` — living wall's new home.** Squat 12×5×10 operations building with a roof slab + caution stripe + vertical concrete ribs flanking the front panel + side wall vents. **Rotating radar antenna** on the roof: short cylindrical base + pivot Group containing a horizontal axle bar and trapezoidal radar fin. The pivot is registered in `this._radarBuildingPivots` and spun in the animate loop (`rotation.y = t * 0.6` rad/s — one rev per ~10s, like a real surveillance radar). Blue rooftop strobe.

**Brighter buildings.** Concrete colors lifted across the board so masses are actually visible against the night sky — `0x141822 → 0x242a36`, `0x1c2030 → 0x303848`, `0x161922 → 0x222836`, `0x1e2230 → 0x2c3344`, `0x12151c → 0x222836` (single sed pass across all building helpers).

**Bigger floodlights.** `_buildFloodlightRig` rebuilt: 12 poles (was 8), height bumped 9→11, lens brightness 0.55→0.95, lens color shifted to warmer-cool 0xeaf4ff, light-cone sprite opacity 0.18→0.42 + scale 14×18→18×22, **NEW** ground-spot sprite (additive radial puddle, 11×11, opacity 0.55) at the foot of each pole's cone — gives visible "spotlight on the deck" puddles instead of just dim cones in air. New `_makeGroundSpotTexture` produces the radial puddle.

**Files touched:** `js/scenes-selector.js` (mounts table, `_buildMissileSite` + `_buildRadarBuilding` new, cmdbunker reduced to single window, `_buildFloodlightRig` rebuild + `_makeGroundSpotTexture`, concrete color uplift across all building helpers, animate radar tick), `js/helpers.js` (b167 → b168), `FILE_MAP.md`, `CHANGELOG.md`.

## b167 — 2026-05-05 — Scenes: real military base (panels = building windows, not floating cards)

User: *"right now it's just a bunch of ugly billboards just positioned differently and weirdly and like a car. We can expand the 360 circle and we can build buildings outside of that perimeter. I want this whole kind of area to be a military base. Standoff has a huge satellite dish. It has a bunch of other shit that you should reference from the photos. you can put placeholder billboards or make them smaller. I can't prove I'm being animated and kind of moving up or you know on a hover having an animation. If you're gonna position them inside of stuff."*

The b166 scene still felt circular because every panel was at radius 8-25 with a thin chassis around it — same UI-around-a-camera vibe. b167 pushes panels to radius 25-50, replaces lightweight chassis with **real walled buildings that host the panels as embedded windows**, kills the symmetric layout in favor of an asymmetric forward-heavy composition, and adds the iconic massive Standoff dish as the focal feature.

**Mounts table — pushed outward, asymmetric.** Heavy concentration in the forward arc (-Z direction), sparse on the sides, near-empty behind:

| panel | new pos | size | host (building) |
|---|---|---|---|
| galaxy | `(-30, 8, -42)` | 13×7.8 | cmdbunker rooftop billboard |
| dimensions | `(-30, 1.5, -32)` | 5×3 | cmdbunker upper-floor window |
| living wall | `(-22, -1.5, -32)` | 5×3 | cmdbunker ground-floor door |
| neural | `(35, 1, -32)` | 5×3 | vehiclebay back-interior wall |
| wall | `(-44, 0.5, -10)` | 6×3.6 | barracks front-wall window |
| tape spine | `(42, 0.5, -2)` | 3.5×6 | supplydepot vertical wall display |
| freq map | `(-26, 5, -18)` | 6×3.6 | commtower service-platform display |
| deep sea | `(28, 1, -22)` | 5×3 | helipad control booth |
| organism | `(-7, -3.8, -10)` | 3.5×2.1 | fg console (left) |
| terrain | `(4, -3.8, -11)` | 4×2.4 | fg topo podium |
| villa | `(-13, -3.8, -6)` | 2.8×2.1 | fg crate-stack CRT |

Default panel size dropped from 9×5.4 to ~5×3 — they read as building windows now, not dominant-foreground UI cards.

**`_buildPanelHost` rewrite — multi-panel buildings.** New protocol: kinds prefixed by a building name (`cmdbunker_*`, `vehiclebay`, etc.) build the heavy shared structure ONCE on first reference (tracked in `this._builtBuildings: Set`), then each panel just adds its own local trim (window-frame, sill, caution stripe, etc.). The window-frame border is now skinnier than b166 (`fW = w * 1.10`, `fT = 0.20`) and `cmdbunker_billboard` opts out of the standard frame in favor of a beefier free-standing billboard frame with twin support masts to the bunker roof below.

**Buildings (each its own helper, all use `_placeBuilding(grp, cx, cy, cz)` which positions in world + `lookAt(origin)` so local +Z faces the camera).**

- **`_buildCmdBunker()`** — Forward-left 2-story concrete bunker. 16×11×12. Vertical concrete ribs on the front face (with a gap for the door), side wall vents, 3 roof HVAC boxes, 2 roof antennas with red strobes. Hosts 3 panels: rooftop billboard, upper window, door display.
- **`_buildVehicleBay()`** — Forward-right open-front garage. 14×7×11. No front wall (open garage), side+back walls, roof, garage-door lintel, yellow caution-stripe corner posts at the open front, parked Warthog inside facing out, 2 hanging interior lights, supply crate stack outside. Panel mounts on the back interior wall.
- **`_buildBarracksBig()`** — Far-left long low building with gable roof. 11×6×16. Door slot with warm orange glow, side antenna with red strobe.
- **`_buildSupplyDepot()`** — Far-right stacked shipping containers (offset stack of 2). Vertical container ribs (corrugated look), bone-white stencil markings, loose crates beside the depot. Panel is the vertical screen on the side facing camera.
- **`_buildCommTowerBig()`** — Mid-left 16u-tall 4-leg lattice tower with cross-bracing rings, mid-height service platform/catwalk where the freq-map display mounts, top antenna mast with red strobe, side-mounted dish on the platform.
- **`_buildHelipad()`** — Mid-right round elevated helipad. 5.5u radius cylindrical base + raised pad surface + painted "H" + outer ring + 16-tab yellow caution rim + control booth on the back side + 4 amber approach lights. Panel mounts on the booth face.
- **`_buildCentralDish()`** — **The iconic Standoff feature.** Massive parabolic dish, 16u radius, on a 2-tier reinforced concrete plinth (14×3.8 + 11×0.8) + tapered cylindrical pedestal + 4-vent column + 7×1.4×2.2 yoke with side actuators + 0..π·0.42 sphere-section dish tilted -0.32π skyward + 4 layers of concentric panel ribs + outer rim + 3-arm receiver tripod with feed-horn + 3 antenna spikes + bright red aviation strobe at the highest spike + magenta receiver tell-tale at focal point. Positioned at world `(8, -8, -68)` with 0.25rad off-axis rotation so it doesn't bisect the layout. Joins the existing standoff dish slow-yaw tracking animation. Dominates the forward skyline.

**Foreground consoles** (3 close panels at `y=-3.8`) keep similar small chassis to b166: `fgconsole_left` and `fgconsole_topo` get console-table+keyboard+LEDs (topo adds an amber map-light ring around the podium edge); `fgconsole_crt` keeps the stacked supply crates + chunky CRT bezel + cathode hump.

**Hover animation.** When a panel is hovered, the target position now lifts the panel TOWARD the viewer along the camera-relative direction (`toCam = -basePos.normalize() * 0.7`) plus a 0.30u upward bump. So instead of just floating up in place, the panel detaches from its host and pops 0.7u out toward the user — reads as "this display is responding to you." Lerp speed unchanged (the existing `dt*3` rate works for this distance).

**Files touched:** `js/scenes-selector.js` (mounts table rebuild, `_buildPanelHost` rewrite with `_builtBuildings` dedup, `_placeBuilding` helper, `_buildCmdBunker` / `_buildVehicleBay` / `_buildBarracksBig` / `_buildSupplyDepot` / `_buildCommTowerBig` / `_buildHelipad` / `_buildCentralDish` new, hover-lift animation), `js/helpers.js` (b166 → b167), `FILE_MAP.md`, `CHANGELOG.md`.

## b166 — 2026-05-05 — Scenes: diegetic panel mounts (rip 261° arc) + patrolling Warthog

User: *"It's a 360 of like all of our different things to choose from I would love for the scenes page to look more like a military base… for our cards that pop out we'll just kind of place them around the screen, you know in places that make sense. Like a computer terminal for something or a big glass TV."* + *"warthog driving around or… an actual vehicle being unloaded."* The 261° symmetric panel arc was floating UI in space; user wants every scene panel to be a real in-world display embedded in a real military base, plus more scripted background activity.

**`_buildPanels` rewrite — data-driven mount table.** Old version computed each panel position from arc math (`arcRadius=18`, `arcSpan=1.45π`). Gone. New version iterates a `mounts[]` table where each entry binds a `SCENES[i]` (or the home portal) to a hand-picked world position, panel size, and host-chassis kind:

| panel | pos `(x, y, z)` | size | host |
|---|---|---|---|
| galaxy (home) | `(-20, 6, -34)` | 13×7.8 | `billboard` |
| dimensions | `(16, 1, -10)` | 9×5.4 | `bunkerwall` |
| living wall | `(4, 0, -17)` | 10×6.0 | `commandtent` |
| organism | `(-10, -3.5, -8)` | 4.5×2.7 | `desktop` |
| freq map | `(-21, 3, -12)` | 7.5×4.5 | `towerdisplay` |
| tape spine | `(-13, 1.5, 6)` | **4×7** (portrait) | `serverrack` |
| wall | `(17, 1, 10)` | 9×5.4 | `barracks` |
| terrain | `(4, -3.5, -12)` | 5.5×3.3 | `topopodium` |
| deep sea | `(-7, 0, 15)` | 7×4.2 | `dishbooth` |
| neural | `(10, -3, 14)` | 3.8×2.3 | `warthog` |
| villa | `(-7, -3.5, -3)` | 3.2×2.4 | `cratecrt` |

Each panel still uses the same glitch shader and still flies forward to the camera on focus — the existing focus/release lerp works unchanged because `basePos` just became the diegetic mount instead of an arc slot. `panel.userData.sizeW/sizeH` track per-panel dimensions so the halo sprite scales correctly (was hard-coded to 9×5.4 in the animate loop).

**`_buildPanelHost(kind, px, py, pz, w, h)` — chassis builder.** All 11 hosts share a common scaffold (group at panel position, oriented `lookAt(origin)` so local +Y is up, local -Z is away from camera, local floor-y = `-8 - py`). Always-on chassis: 4 steel frame rails around the panel + dark backing plate. Per-kind additions:

- **billboard** — twin lattice masts down to the deck with cross-bracing torus rings every 2.4u, diagonal cross-brace mid-mast, red aviation strobe on top
- **bunkerwall** — concrete bunker mass behind, concrete sill below, yellow caution stripe along the bunker top
- **commandtent** — 4 corner poles, dark tarp roof, rear canvas wall, server box on the floor underneath
- **desktop** — console table with legs, keyboard bar in front, 3 status LEDs (red center, green flank)
- **towerdisplay** — 4-leg lattice down to floor with cross-bracing rings, service platform under the panel
- **serverrack** — twin uprights, back panel, 4 side blade boxes with green status LEDs, base, legs to floor
- **barracks** — concrete wall slab, caution stripe, sandbag berm in front (2 staggered rows of 6-7 bags)
- **topopodium** — tapered cylinder column from the floor, podium top slab, additive amber map-light ring around the podium edge
- **dishbooth** — half-cylinder hood (open side facing camera), desk in front with legs to floor, mini satellite-dish antenna mounted on top of the hood
- **warthog** — full simplified Warthog mesh parked sideways under the panel
- **cratecrt** — 3 stacked olive-drab supply crates (bone-white stencil stripes), beefy CRT bezel, cathode hump on the back

`_buildHomePanel` deleted (galaxy moved into the unified `mounts[]` table as the billboard).

**`_buildWarthogMesh(olive, oliveHi, steel, dark)` — shared simplified Warthog.** UNSC silhouette: 2.6×0.65×4.4 chassis + raised hood block + cab + 4-bar steel roll cage with side rails and cross brace + 4 wheels (CylinderGeo h=0.55, side-rotated, with steel hubs) + warm headlight pair on the front + red tail-light pair + turret cylinder + barrel. Total length ~5u, ride-height ~1.4u. Used twice — as the chassis under the `neural` panel and as the patrol vehicle.

**`_buildPatrolWarthog` + `_tickPatrolWarthog`.** A second instance drives an oval loop (rx=24, rz=26) around the deck at floor level. Position parameterized by `t = ud.t * 2π` where `ud.t` advances at 0.10/sec → ~10 sec lap. Each frame the hog `lookAt`s the next path point along its tangent so it actually steers around the curve instead of strafing. Wheels collected once at build time (filtered out of the children list by `geometry.type === 'CylinderGeometry' && height === 0.55` — only the 4 wheels match) and spun in proportion to tangent magnitude. Headlights flicker subtly (`0.85 + sin(t*7+x)*0.10`).

Combined with the existing scripted pelican dropoff, the base now has two looping vignettes: pelican drops crates/cones/coils onto the deck every 30-55s, and a Warthog patrols the perimeter continuously.

**Animate-loop tweaks.** `_tickPatrolWarthog` wired in next to `_tickFlybys` / `_tickScriptedPelican`. Halo sprite scaling now reads `p.sizeW * 1.8 * scale` and `p.sizeH * 1.8 * scale` (was hard-coded 9 / 5.4).

**Files touched:** `js/scenes-selector.js` (`_buildPanels` rewrite, `_buildPanelHost` + 11 `if/else` host branches, `_buildWarthogMesh`, `_buildPatrolWarthog`, `_tickPatrolWarthog`, `_buildHomePanel` deleted, init wiring, animate halo-scale fix), `js/helpers.js` (b165 → b166), `FILE_MAP.md`, `CHANGELOG.md`.

## b165 — 2026-05-05 — Galaxy banshee: blue laser burst OR green plasma ball, picked per pass

User: *"banshee blue when it shoots burst, 1 green plasma ball small when it shoots missle can be interchangeable for dynamicness and to be refreshing"*

The banshee chaser in the pelican-vs-banshee combat scenario was firing the same magenta plasma bolts (`0xff3ad8`) every pass, 1–2 per burst, every 0.4–0.75s. Same threat character every time → reads as repetitive once you've seen it twice.

**Per-pass weapon mode.** `_spawnPelicanCombat` now picks `banshee.weaponMode` 50/50 between `'laser'` and `'missile'` at scenario spawn. `_tickScenario`'s `combat_chaser` fire block branches on the mode:

- **Laser mode** (`0x66ddff` cyan-blue): 3–4 small fast tracers per burst (scale 0.45, speed 135, life 0.7, spread 0.05), cooldown 0.30–0.50s. Reads as a strafing burst — rapid clatter of light.
- **Missile mode** (`0x55ff66` green): single plasma ball (scale 0.95, speed 65, life 1.8, spread 0.03), cooldown 1.4–2.0s. Reads as an aimed shot — slower, heavier, more ominous.

Pelican Spartan fire (yellow `0xffe060` from the open hatch) is unchanged and reads distinctly from both new weapon colors. Banshee inner-mesh barrel-roll, pursuit-steering weave, and the 1.8s–9.5s combat window are all untouched.

**Note on bolt pool capacity.** The shared bolt pool is 24 sprites ([marathon-world.js:869](js/marathon-world.js#L869)). Laser mode fires up to ~10/s, plus pelican Spartan fire, plus any admin-triggered plasma storm — could starve under heavy stacking. Not changing pool size yet; flag for later if it manifests visually as missed bolts.

**Files touched:** `js/marathon-world.js` (banshee init in `_spawnPelicanCombat` adds `weaponMode`; `_tickScenario` `combat_chaser` fire block branches on mode), `js/helpers.js` (b164 → b165), `FILE_MAP.md`, `CHANGELOG.md`.

## b164 — 2026-05-05 — Scenes: Standoff outpost rebuild (kill Cortana, kill the void)

User: *"can we make scenes look a bit more like foundary? i love the space look. i love the visuals, but so that its not entirely out in a void with a grid"* + *"yeah sure, kill cortana keep everything else and move to image 3 nighttime the map is called standoff"* — referring to Halo 3's *Standoff* (UNSC desert relay outpost with twin satellite dishes, sandbag fortifications, comm towers, bunkers).

The b140 scene had the panel arc + Cortana + capital-ship flybys floating over a magenta-on-black grid in a hangar bulkhead with overhead light strips. Reads as "void with a grid" exactly because everything outside the panel arc was either implied indoors or completely dark. b164 ports the entire periphery to Standoff at night while leaving the panel arc / flybys / kill balls / scripted pelican / floor props / planet backdrop untouched.

**Removed (Cortana):** `_buildCortana` deleted in full (~120 LOC: wireframe humanoid mesh + ringStack + 220-particle hologram dust + cyan back-glow sprite). Init no longer calls it; animate no longer ticks `cortana` / `cortanaRings` / `cortanaParticles` / `cortanaGlow`. The kill-ball spawn loop dropped its "skip directly behind viewer where Cortana is" while-loop guard since the back of the deck is now legal real estate.

**Floor (`_buildEnvironment`).** The b140 hex grid shader is gone. New shader paints a Standoff concrete pad: panel-seam grid every 6u, painted helipad rings at r=15.5 + r=20, central cross, 45° caution-stripe band at r=24-27, fading to dirt + sparse rock pebble noise beyond r=30. Cool-night palette (≈0.085 / 0.092 / 0.108 base, dirt warmer-but-darker). 95u distance fade. Opaque (no more `transparent: true / depthWrite: false`) so the deck reads as a real surface instead of a translucent overlay. Old hangar overhead light strips (12 magenta planes at y=7) and bulkhead frame ring (toruses at y=±6 with 8 vertical struts at r=28) deleted — replaced by `_buildFloodlightRig`: 8 lattice poles at r=28 / h=9, each with an inward-pointing crossarm + 2 cool-white floodlight fixtures + a soft additive light-cone sprite that lands the inner pad in moonlight-white instead of magenta wash.

**Standoff set (`_buildStandoff`).** Five new helpers, all silhouette geometry living *outside* the panel arc (everything past r=28):

- **`_buildRidgeline`** — two concentric closed mesh rings of vertical-trapezoid strips (near r≈100 / far r≈165), randomized crest height with `sin(a*2.3)+sin(a*5.7)` low-freq + per-vertex jitter, near `0x080a12` / far `0x040611`. Kills the void at the horizon — the deck no longer ends in nothing.
- **`_buildDish`** — Standoff's iconic feature, ×2. Concrete plinth + stepped base + tapered cylinder pedestal + box yoke with side flanges + parabolic dish (half-flat sphere section, 0..π·0.42 polar range, tilted -0.34π so it points skyward), with concentric panel-rib toruses + outer rim + 3-prong receiver tripod + central feed-horn cylinder + 3 antenna spikes on the yoke. Aviation strobe at the highest spike (red on dish 1, blue on dish 2) + a dim magenta receiver tell-tale at the focal point. Slow yaw drift in the animate loop (`baseYaw + sin(t*0.05)*0.12`) — reads as the dish *tracking* something.
- **`_buildCommTower`** ×4 — 4 lattice legs in a 1.2u square, cross-bracing toruses every 2.5u, top antenna mast, aviation strobe at the mast tip. Heights 18-26u, alternating red/blue strobes at differentiated rates (1.8 / 1.1 Hz) so they don't sync.
- **`_buildBunker`** ×3 — concrete shell + recessed roof slab + warm-amber additive window strip on the front + dimmer warm-amber door slot + roof antenna stub with red strobe. Window/door opacity flicker subtly in the animate loop (8.5%–110% of base, 4.5/3.1 Hz).
- **`_buildSandbagBerm`** ×4 — staggered two-row stack of 0.95×0.40×0.65 bag boxes laid tangent to a circle at r=26-32, length 8-12 bags. Slight per-bag yaw jitter for the not-perfectly-stacked look.

**Animate loop.** Cortana block replaced by a Standoff block: dish slow-yaw tracking, strobe pulse (`0.30 + sin(t*rate)*0.70`), bunker window flicker.

Net look: panel arc + flybys + scripted pelican + planet backdrop survive identically. The world they sit in becomes a real outpost — concrete pad with painted markings under your feet, twin dishes silhouetted against the nebula, blue/red aviation strobes pulsing on towers + dish tips, warm interior glow leaking from bunker windows, sandbag berms at the deck edge, jagged ridgeline ringing the horizon, cool floodlight cones washing the central pad. Night palette throughout — no daytime sky, no warm sand, all moonlit cool-blue + neutral concrete + warm tactical lighting.

**Files touched:** `js/scenes-selector.js` (`_buildEnvironment` rewrite, `_buildFloodlightRig` + `_makeFloodConeTexture` new, `_buildStandoff` + `_buildRidgeline` + `_buildDish` + `_buildCommTower` + `_buildBunker` + `_buildSandbagBerm` new, `_buildCortana` deleted, kill-ball Cortana-skip removed, init wiring, animate Cortana block → Standoff block), `js/helpers.js` (b163 → b164), `FILE_MAP.md`, `CHANGELOG.md`.

## b163 — 2026-05-05 — Scenes: fix backwards flybys, add scripted pelican dropoff

User: *"on scenes ships are still flying backwards"* + *"can we make a scripted dropoff of a pelican flying by, with its rear hatch open and it drops crates and cones and fusion coils onto the scenes floor"*.

**Bug — backwards ships.** All five capital-ship designs in `scenes-selector.js` are modeled with the nose at -Z and engines at +Z. `_respawnFlyby` called `ship.lookAt(target)` with the comment *"forward is -Z (lookAt(target) makes -Z face target)"* — that's the camera-and-light convention. For plain `Object3D` (Mesh / Group), Three.js inverts the matrix so **+Z** points at the target, which is why the engines were leading the flight path. Fix: `ship.rotateY(Math.PI)` immediately after `lookAt(target)`. Added the same flip in `_startPelicanRun` for consistency, and corrected the `// Ship convention` doc-comment to spell out the gotcha so the next addition doesn't trip on it.

**New — scripted pelican dropoff.** A separate pelican (not part of the random flyby pool) loops through five phases:

1. `wait` — hidden, 30–55s between runs (first run kicks off 6–14s after page load).
2. `approach` — flies in from off-screen toward a drop zone ~30u in front of the camera at `camBaseY + 7`. Speed 14u/s.
3. `opening` — decelerates toward a slow drift; rear hatch ramp pivots down over 1.6s; warm orange cargo-bay glow flips on. Hatch is a child `Group` whose origin sits at the hinge edge so `pivot.rotation.x` swings the panel cleanly.
4. `dropping` — over ~5s, drops 6–8 cargo items at 0.50–0.85s intervals. Cargo type weighted 55% crates, 30% cones, 15% fusion coils. Each item spawns at the hatch in world space (pelican `matrixWorld` × local offset), inherits 35% of pelican velocity + a 2.5u/s downward shove, and is pushed onto `this.props` with `kicked = true` — so it falls through the existing `_tickPropsPhysics` integrator (gravity, bounce, slide, rolling assist) just like a clicked deck prop. Coils land live and click-armable.
5. `closing` → `depart` — hatch closes over 1.6s, glow off, pelican re-accelerates along its nose direction (`(0,0,-1)` × `quaternion` × 20), climbs out at +1.5u/s, then loops back to `wait`.

Pile cap: once 30+ air-dropped props are alive, the oldest dropped item is recycled per new drop — keeps the prop list bounded without affecting the original deck clutter.

**Files touched:** `js/scenes-selector.js` (`_buildScriptedPelican`, `_startPelicanRun`, `_tickScriptedPelican`, `_dropCargoFromPelican`; `_respawnFlyby` flip + comment fix; init + tick wiring), `js/helpers.js` (b162 → b163), `FILE_MAP.md`, `CHANGELOG.md`.

## b162 — 2026-05-05 — Galaxy combat: fix `cross in front` + `weave near title` admin scenarios

User: *"on galaxy cross in front doesnt actually go infrotn goes above diagonal cant see it"* — pointing at admin-panel buttons in `marathon-world.js` (galaxy at `/`). Tested: those two patterns out of five were broken; the ship was visible briefly then disappeared "above and diagonal."

**Root cause.** `_tickScenario`'s `combat_target` branch ([marathon-world.js:1897-1915](js/marathon-world.js#L1897-L1915)) hard-coded the pelican's steering wobble at `lateralAmp = 46`, `verticalAmp = 18`, `rcsAmp = 32` for every pattern. For `cross_in_front` and `weave_near`, the spawn geometry sets `perp1 = upPerp` (vertical axis), so the "lateral" wobble drove the ship up and down by ±46u. Closest-approach to camera is ~10u (cross_in_front, `closest = T*0.60` at showcaseDist ~18u) or ~18u (weave_near, at title depth) — at those distances ±46u vertical sends the pelican entirely above or below the camera frustum. Plus the 32u RCS thruster bursts on the same axis. The other 3 patterns weren't affected: `fly_toward` and `fly_over` use `perp1 = right` (horizontal), `across_behind` puts closest-approach 12u behind the title where wobble doesn't matter.

**Fix.** Per-pattern amplitudes on `scenarioBase` instead of hard-coded constants:
- `cross_in_front` → `{ lateral: 5, vertical: 3, rcs: 4 }` — small drift only, the eclipse moment IS the show.
- `weave_near` → `{ lateral: 10, vertical: 5, rcs: 8 }` — bounded weaving still readable as steering.
- All other patterns (`across_behind`, `fly_toward`, `fly_over`, fallback) → `{ 46, 18, 32 }` — unchanged.

`_tickScenario`'s `combat_target` branch now reads `base.lateralAmp ?? 46`, `base.verticalAmp ?? 18`, `base.rcsAmp ?? 32` so older save state / future patterns still get the legacy values. Banking math (`s.inner.rotation.x/z` from `lateralComp`/`verticalComp`) is proportional to wobble — banks scale down naturally for tight patterns, which is correct.

Banshee chaser untouched: it uses `closeness * 0.45` weaving (already small) and pursues the pelican's actual position, so it follows the new tight paths automatically.

**Files touched:** `js/marathon-world.js` (`_spawnPelicanCombat` adds amps to `scenarioBase`; `_tickScenario` reads them), `js/helpers.js` (b161 → b162), `FILE_MAP.md`, `CHANGELOG.md`.

## b161 — 2026-05-05 — The Object: liquid-metal Voronoi sculpture catalog

User: *"not the biggest fan… really push urself man with webGL just want a coo lway to display all my songs"* → picked **The Object** out of four ambitious proposals: one breathing sculpture in the void, surface partitioned into 117 cells (one per song), hover for preview, click to play. Asked to keep current theming, so it inherits the existing palette + glitch shader family + bloom + post stack.

**New page: `/object.html`** — full-bleed canvas, audio element, boots `js/object.js` against `/config.json`. JetBrains Mono link added so the bottom-center spectrum strip reads as terminal-feel.

**New module: `js/object.js` (`window.LiquidObject`)**

- **Sculpture geometry.** `IcosahedronGeometry(5.6, 6)` → 5120 tris / 2562 verts. Wrapped in a Group so we can spin the object while keeping the camera fixed.
- **Voronoi-on-sphere shader.** 117 seed directions distributed via Fibonacci sphere. Seeds + per-track tints packed into two `1×117 RGBA float DataTextures` (`uSeedTex`, `uTintTex`). Fragment shader uses GLSL3 (`glslVersion: THREE.GLSL3`) and `texelFetch` to loop seeds and pick nearest by `dot(dir, seed)` (and 2nd-nearest for edge thickness). Cell border = `smoothstep(0.0, 0.014, bestDot - secondDot)`, plus a thin magenta/cyan edge line where the cells meet.
- **Tints come from the existing `tintForTrack(track, tier)`** family ported from text-galaxy-pro — featured = warm, newer = cool, archive = violet — so the surface reads as the catalog's *distribution* projected onto a sphere.
- **Vertex displacement (vertex shader).** Each frame the surface deforms by:
  - sine breath (`sin(uTime*0.7)*0.04`)
  - whole-sphere bass pulse (`uBass*0.22`)
  - low-freq curl noise wobble (mid-driven amplitude)
  - high-freq surface chatter when playing (`uHigh`-scaled noise at 14× freq)
  - playing-cell biased bulge (`pow(dot(n, uPlayingSeed), 6) * (0.10 + bass*0.30)`)
  - hover-cell pull (`pow(dot(n, uHoverSeed), 12) * 0.07`)
- **Surface fragment effects.** Latitude scanlines, sparse vertical-strip dropouts, RGB-channel wobble on hover/play, fresnel rim, hover/play tint boost, dim non-playing cells to 36% when something's playing. Glitch amount `glAmt` rides hover + play + bass.
- **Camera.** Fixed at radius `[9–22u]`, `lookAt(0,0,0)`. Wheel = dolly within clamp. The Object rotates: auto-spin Y=0.06rad/s + X=0.018rad/s, plus drag torque that decays with `exp(-2dt)`. Pitch clamped ±81°. **No flying.**
- **Hover detection.** Raycast against the icosphere → world-to-local hit point → loop seeds in JS to find nearest. `uHovered` index + `uHoverSeed` direction passed back to the shader. Updates on every pointermove (idle) so cells light up smoothly as you sweep.
- **Click → play.** `_playCell(idx)` sets `uPlaying`, `uPlayingSeed`, calls `ctx.onPlay(idx)`. The sphere's sculpture state goes "alive" — bigger displacement amplitudes, brighter cell, dimmed neighbors. Audio `ended` event clears the playing state. Spacebar toggles play/pause.
- **Aim-at-cell.** Clicking a cell or jump-list item nudges the group rotation toward `(yaw = atan2(-seed.x, seed.z), pitch = -asin(seed.y))` — small ease so the chosen cell drifts toward camera-front while still letting auto-spin continue.
- **Audio analyser.** Reuses `audio.__floorAnalyser` cache. Reads bass (bins 2–9), mid (12–39), high (50–119) → 3 normalized uniforms.
- **Composer.** RenderPass → UnrealBloom (`0.85 + bass·0.55 + 0.15·playing`) → custom GLSL3 ShaderPass (CA + scanlines + grain + vignette) — same idiom as galaxy/corridor.
- **Background.** Pure void + 1100 spherical-shell point motes (additive, drifting) + soft radial pink/violet back-glow sprite behind the object. `FogExp2(0.020)`.
- **HUD.** TL kicker `kani` + `OBJ.###` (current hovered/playing index) + signal count + build + nav (home / catalog / galaxy / corridor). TR `≡ index` jump button + brand. BL hint. BR hovered title (lowercase Space Grotesk) + meta strip (year · tag · tier). Bottom-center: now-playing label + 20-bar live spectrum (JetBrains Mono numerics, hot-pink bars) + elapsed `mm:ss`.
- **Mobile.** Touch-drag rotates the object; stationary tap (<8px / <350ms) plays the cell under the press. Adaptive FOV in `_onResize` (70 portrait / 55 landscape). Spectrum strip narrows to 120px width.
- **Jump list.** Tab or `≡ index` opens search modal listing all 117 in track-order, accent dot + meta. Click → `_aimAtCell(snap=true)` snaps the rotation directly + plays.

**Files touched:** `object.html` (NEW), `js/object.js` (NEW), `js/helpers.js` (b160 → b161), `FILE_MAP.md`, `CHANGELOG.md`. **Untouched:** every existing route. Per project memory, no Vercel push — localhost iteration only.

## b160 — 2026-05-05 — Scenes selector: flyby ships actually cross the camera

User: *"on galaxy cross in front doesnt actually go infrotn goes above diagonal cant see it"* — the 5 ambient ships (capital / cruiser / pelican / fighter / forerunner) were spawning at random angles on a 110–150u circle around the camera, then flying to another random angle on the same circle. Most passes orbited *around* the view at distance, never crossing through forward, and altitude band -8 to +14 combined with portrait camera lift (b152, `_camBaseY = 1.8`) read as "above and diagonal."

**`_respawnFlyby` rewritten camera-relative.** Path is now constructed in the camera's local horizontal frame:
- Forward + right vectors derived from `gaze.yaw` (so the path tracks where the user is looking, not just the world axes).
- Path midpoint sits at `forward * passDepth` where `passDepth` is 35–70u in front of camera — every flyby now physically crosses the forward view.
- Spawn / target at `±passSign * sideExtent` along the right axis (80–120u off-screen lateral). `passSign` flipped 50/50 so ships go L→R or R→L.
- `±25u` forward-axis jitter on spawn/target independently — paths no longer all cross perpendicular at the same depth.
- Altitude band re-anchored to camera Y: 70% eye-level (camY ± a few units), 18% high pass (camY+18..28, over the panels), 12% low pass (camY-6..-10, under). Was a flat -8..+14 absolute, ignoring portrait lift.
- `altDelta` reduced 12 → 5 so paths stay near-horizontal — "passing by" rather than ascending diagonally.

Speed table, lookAt, banking-roll jitter, and the upstream `_tickFlybys` respawn-when-traveled logic untouched.

**Files touched:** `js/scenes-selector.js` (`_respawnFlyby` rewrite), `js/helpers.js` (b159 → b160), `FILE_MAP.md`, `CHANGELOG.md`.

## b159 — 2026-05-05 — Scenes selector: dial back coil spin

User: *"its great on all except fusion coils they rotate too much for their height and stature"* — coils were spinning hyperactively. Two reasons:

1. The rolling-assist computes target spin = `v / (box-height / 2)`. Coils are tall + skinny, so that's a small radius → high target spin. Other props (cones, crates) have ~equal proportions so the math gives sensible rolling rates.
2. Their `spinScale` (1.05) made the initial rollMag too punchy for a tall narrow shape.

Fix:
- Coil `spinScale` 1.05 → 0.55 (cuts initial spin in half).
- Coil rolling-assist `rollK` 0.55 → 0.20 (cuts steering toward physical rolling rate to ~36% of other props).

Coils now tip and tumble slowly like a barrel instead of spinning like a top. Other props unchanged.

**Files touched:** `js/scenes-selector.js` (`_kickProp` coil `spinScale`; `_tickPropsPhysics` per-type `rollK`), `js/helpers.js` (b158 → b159), `FILE_MAP.md`, `CHANGELOG.md`.

## b158 — 2026-05-05 — Scenes selector: fix the real reason kicks died fast

User: *"now they stop almost a second after thats terrible"* + *"and doesnt really go anywhere anymore"* — couldn't get the carry right by tuning damping rates because the underlying physics was broken.

**The actual bug.** The `if (vel.y < 0)` floor-contact branch applied `slideFric` (0.78 / 0.92) to horizontal velocity. Once a prop is resting on the floor: gravity → tiny negative `vel.y` → next frame it sinks slightly into the floor → triggers the bounce branch → `slideFric` cuts horiz vel by 22% → reflected `vel.y` is positive briefly → next frame gravity pulls it back negative → cycle repeats every 1–2 frames at 60fps. Result: 0.78^30 = 0.06% of horizontal velocity left after 1 second. That's why nothing carried regardless of `airRate` / `angRate`.

**Fix:** bounce-friction only fires on a real impact (`vel.y < -0.8`). At rest, `vel.y < 0` just zeros out — no friction applied. Replaced the per-frame slide loss with gentle continuous **ground rolling friction** (`groundRate` 0.55 default, 0.25 cone) that only acts while moving. Bounce `slideFric` raised slightly (0.78→0.86, 0.92→0.94) since it now fires on real impacts only.

**Speeds bumped back up.** With the friction bug fixed, the b156 speed cuts left kicks weak. Tuning toward a real shove:
- Base `(7+rand*4)` → `(9+rand*5)`.
- Per-type `speedScale`: default 1.30→1.40, cone 1.20→1.30, crate 1.30→1.40, coil 1.45→1.55, killball 1.40→1.50.
- `popY` per type up ~10–15%.

Net: kicks now travel 2–4 meters and roll for ~3–5 seconds before settling.

**Files touched:** `js/scenes-selector.js` (`_kickProp` per-type speeds; `_tickPropsPhysics` impact-threshold guard + zero-on-rest + new ground-rolling friction; bumped `slideFric`/`angBounce`), `js/helpers.js` (b157 → b158), `FILE_MAP.md`, `CHANGELOG.md`.

## b157 — 2026-05-05 — Scenes selector: ease damping (b156 settled too fast)

User: *"now they stop almost a second after thats terrible"* — b156 cut kick strength but also bumped damping back up, killing the carry. Pulling airRate/angRate back down without restoring the b154 launch speeds.

- `airRate` 0.30→0.18 default (cone 0.18→0.11)
- `angRate` 0.50→0.32 default (cone 0.30→0.20)

Kick speeds & spin from b156 unchanged — only the carry/decay phase. Props should now slide + roll for ~2.5–3 seconds before settling.

**Files touched:** `js/scenes-selector.js` (`_tickPropsPhysics` damping rates), `js/helpers.js` (b156 → b157), `FILE_MAP.md`, `CHANGELOG.md`.

## b156 — 2026-05-05 — Scenes selector: kick + spin rebalance (find the middleground)

User: *"upon kick things rotate way too much and kick is like super fucking strong find the middleground"* — b154 was a launch, original b150 was a tap. Aiming for a real shove that settles after a meter or two.

**Linear push cut ~35%.**
- Base speed `(11 + rand*5)` → `(7 + rand*4)`.
- Per-type `speedScale`: default 1.50→1.30, cone 1.40→1.20, crate 1.50→1.30, coil 1.65→1.45, killball 1.60→1.40.
- `popY` cut ~25% per type — props no longer arc toward the ceiling.

**Rotation cut ~40%.**
- `spinM` 10→6, `rollMag` `9+rand*6` → `5+rand*3`.
- `spinScale` per-type down ~25% (cone 1.6→1.2, crate 1.1→0.85, coil 1.4→1.05, killball 0.7→0.55).
- Rolling-assist target rate scaled to `0.55 × v/r` instead of full physical rolling rate. Physically-correct rolling looks hyperactive on miniature props — the scaled target reads as a believable roll without spinning like a blender.

**Damping nudged back up.** `airRate` 0.20→0.30 default (cone 0.10→0.18). `angRate` 0.32→0.50 default (cone 0.18→0.30). Slides and spin both decay sooner so kicks settle in 1–2 seconds, not 4.

**Files touched:** `js/scenes-selector.js` (`_kickProp` per-type values + base speed/spin + rollMag; `_tickPropsPhysics` `airRate`/`angRate` + rolling-assist `rollK = 0.55`), `js/helpers.js` (b155 → b156), `FILE_MAP.md`, `CHANGELOG.md`.

## b155 — 2026-05-05 — Signal Corridor: 3D catalog flythrough

User: *"catalog is interesting but still very 2d… i love infinite scroll, what else can we do that's similar to the overall theme?"* — picked **Signal Corridor** out of five proposals: cards mounted to the walls of an infinite Z-axis tube, scroll throttles you forward, drag looks around, click pulls a card to camera. Standalone — parallel to `galaxy.html` / `halo.html`, doesn't touch any existing route.

**New page: `/corridor.html`** — full-bleed canvas + audio element + boots `js/corridor.js` against `/config.json` (same loading pattern as galaxy.html). Mirrors the HUD CSS family but with `.sc-` prefix. Adds JetBrains Mono for the corridor's terminal-feel HUD numerics.

**New module: `js/corridor.js` (`window.SignalCorridor`)**

- **Geometry.** Z-axis tube. 117 cards alternate left/right at the wall (`x = ±(WALL_X − 0.55)`, `WALL_X = 11.5`), spaced `CARD_Z_STEP/2 = 7u` apart starting at `z = -28`. Cards face inward (rotation Y ±π/2). Wall + floor + ceiling are long thin `PlaneGeometry` slabs sharing one shader (vertical scanlines, 90/u panel seams, low-rate dust speckle, beam-proximity magenta tint at top, distance fade keyed off `uCamPos.z`). Fog `FogExp2(0.005)`.
- **Pink ceiling beam.** Two coaxial `CylinderGeometry` along Z at `y = 7.6`: tight `r=0.10` core (additive, travelling sine pulse `sin(vUv.x*60 - t*4.5)^6` + bass scaling) and `r=0.55` halo (additive radial fade). The beam *is* the corridor's light source — its tint paints the upper portion of every wall via the wall shader's `beamProx` term.
- **Cards.** Per-card `Canvas2D` HUD frame at 1024×576 — corner brackets, `▮ TRK.###` top-left, tier tag top-right (`[FEATURED]/[ NEWER ]/[ARCHIVE]`), auto-fit lowercase title (130 → 60 px), accent underline, year/tag/tier meta strip, 8 accent-colored waveform diamonds, `▶ HOVER · CLICK · PLAY` foot strip. Shader is the same RGB-split / block-displacement / scanline / dropout family as `text-galaxy-pro.js`, with `uHover/uFocus/uBass/uOpacity/uTint`. Tint comes from `tintForTrack(track, tier)` ported from text-galaxy-pro (warm featured / cool newer / violet archive, hue-jittered per title hash).
- **Camera control.** Drag clamps yaw ±0.55 rad / pitch ±0.40 rad so you stay roughly down-corridor. Scroll wheel + W/S add to a `velZ` accumulator (cap ±70u/s, ×2.4 with shift = WARP). A/D adds to `velX` for strafe (cap ±18). Friction 1.6/s on both axes. Camera position wraps: pass the far end → teleport back to start; can't drift past `z = +30` from camera-forward direction.
- **Warp mode.** `warp` uniform ramps from `(speedFrac − 0.45) / 0.55` (engages above ~45% cap). Drives a post pass that multiplies CA + adds radial speed-line streaks (`pow(0.5+0.5*sin(angle*80 + t*30), 12)`). Bloom strength `0.85 + bass·0.45 + warp·0.25`.
- **Click → focus.** Card raycast on hover sets `this.hovered`. Click triggers `_flyTo` ease-out cubic to a point offset from the card's inward face (left-side card → camera approaches from upper-right; right-side → upper-left), distance fits `CARD_W` to FOV. Focus overlay slides in with kicker, glitch-typed title (26-frame char scramble), year/tag/tier meta, `▶ play / close`.
- **Jump list.** Tab or `≡ all signals` → search modal listing all 117 in track-order, accent dot + meta. Click → `_jumpTo(node)` teleports camera to `z = card.z + 18` and zeros velocities (no fly-to — just blink to the area).
- **Mobile.** Left-half touch = virtual joystick (Y = throttle Z, X = strafe). Right-half = drag-look. Stationary tap (<8px movement, <350ms) re-raycasts the press position and focuses the hovered card. WARP button (bottom-right) sets shift while pressed. Adaptive FOV in `_onResize` (76 portrait / 64 landscape).
- **HUD readouts.** Bottom-center depth bar + `###/###` index updated each frame from corridor-fraction (camera Z mapped to corridor length). Top-left meta swaps to `CORR.###` to mirror the catalog's `TRK.###` pill.
- **Audio.** Reuses `audio.__floorAnalyser` cache, so the analyser is shared with whatever scene was active before navigating in.

**Files touched:** `corridor.html` (NEW), `js/corridor.js` (NEW), `js/helpers.js` (b154 → b155), `FILE_MAP.md`, `CHANGELOG.md`. **Untouched:** every existing route — `index.html`, `galaxy.html`, `halo.html`, `tracks-vault.js`, `marathon-world.js`, `text-galaxy-pro.js`, `_redirects`, `serve.py`. Per project memory, no Vercel push — localhost iteration only.

## b154 — 2026-05-05 — Scenes selector: per-prop kick rebalance + crate redesign

User: *"the kick isnt fantastic on fusion coils, too too strong on cones, and the crates look ugly can we go more for wooden crate feel or metal gear box"*

**Kick rebalance.** Cone kick was too punchy (props flew across the deck), coil kick felt limp on pre-threshold clicks. Tuned per-type:
- Cone: `speedScale` 1.85→1.40, `popY` 2.4–3.8→1.8–2.8, `spinScale` 2.2→1.6. Still tips and rolls — just doesn't fly to the next solar system.
- Coil: `speedScale` 1.30→1.65, `popY` 1.8–2.8→2.3–3.3, `spinScale` 1.0→1.4. Pre-threshold clicks now read as a real shove, not a tap.
- Crate / killball unchanged.

**Crate redesigned as a military gear-box.** Old "UNSC supply crate" was visually busy — top handle + status LED + hazard stripe + recessed panels + rivets all fighting for attention at small scale. Replaced with a cleaner silhouette:
- Olive-drab body (`0x3a4030`) with vertical rib highlights on the long sides
- Dark-steel hardware (`0x1a1d22`) — corner caps, skid runners, latch hardware
- Two front latch clamps (backing plate + steel hook) — the silhouette feature that reads "ammo crate" instantly
- Bone-stencil stripe across the lid + a single small stencil block on the front (implies unit marking)
- Dropped: top handle, status LED, hazard stripe, all the corner rivets. The crate now reads as one shape, not a collage.

**Files touched:** `js/scenes-selector.js` (`_kickProp` per-type params; full rewrite of `_makeCrate`), `js/helpers.js` (b153 → b154), `FILE_MAP.md`, `CHANGELOG.md`.

## b153 — 2026-05-05 — Scenes selector: kicked props actually tumble + roll

User: *"when objects are kicked they just push they dont really rotate or recreate the thing of being kicked and rolling a tiny bit"* — b151 made kicks strong but the spin was random tumble that read as wobble, not roll. Plus angular damping killed it before you could see anything.

**Initial spin biased along the kick direction.** Pure-random `angVel` was half-right-axis half-wrong-axis — looked like jitter. New formula: rolling axis for motion along `(dx,0,dz)` is `(dz, 0, -dx)` (perpendicular to motion, by right-hand rule). Initial `angVel` is now `rollMag * (dz, 0, -dx) + small random jitter`. Result: a kick to the side spins the prop *along that axis* like a real punt, with random wobble layered on so it doesn't look mechanical.

**Floor rolling assist.** New block in `_tickPropsPhysics`: while a prop's bounding box is touching the ground (`box.min.y ≤ FLOOR + 0.05`) and it has any meaningful horizontal velocity, steer `angVel` toward the physically-correct rolling rate (`v / r` about the perpendicular axis). Lerp factor `1 - exp(-2.5 * dt)` so it converges in roughly half a second. Effect: even slow slides visually roll, and a kicked cone looks like a tipped-over traffic cone rolling away — not skidding.

**Slacker angular damping.** `angRate` 0.55→0.32 default, 0.30→0.18 cone. Spin now lasts long enough to register before air damping kills it. Also bumped landing-impact `angBounce` 0.55→0.78 default (cone 0.85→0.92) — the visible roll survives the first floor contact instead of getting half-killed.

**Files touched:** `js/scenes-selector.js` (`_kickProp` direction-biased angVel; `_tickPropsPhysics` floor rolling-assist block + slacker angRate + higher angBounce), `js/helpers.js` (b152 → b153), `FILE_MAP.md`, `CHANGELOG.md`.

## b152 — 2026-05-05 — Scenes selector: fix tap-to-focus on mobile + reframe portrait camera

User: *"on mobile, cant select the panels, also idk looking at it, scenes isnt great on mobile."* — phone tap on a panel did nothing, and the framing showed only ~2 panels with a vast empty grid floor below.

**Tap-to-focus was broken on touch.** `_onPointerUp` only focused if `this.hovered` was set, but `this.hovered` is only populated by `pointermove`'s hover branch — which never fires on touch (no hover phase before tap). So every mobile tap fell through to `_tryKickProp` and felt unresponsive.

Fix:
- `_onPointerDown` now syncs `mouse.ndc` to the press point so the up-handler has a valid raycast position on touch.
- `_onPointerUp` does its own panel raycast at tap position instead of relying on the hover-set `this.hovered` flag. Falls through to floor-prop kick only if no panel intersects.

**Portrait reframe.** `_onResize` now branches on aspect ratio:
- FOV 72 → 96 in portrait, so horizontal field-of-view widens enough to show 4–5 panels of the arc instead of 2.
- New `_camBaseY` (1.8 in portrait, 0 in landscape) raises the camera so the empty grid floor stops dominating the lower 60% of the screen. The animate-loop bob now offsets from `_camBaseY` instead of resetting Y to ~0.

Also updated the corner hint copy: `"drag to look · click panel to focus"` → `"drag to look · tap a panel to focus"` (covers both input modes).

**Files touched:** `js/scenes-selector.js` (`_onResize` adaptive FOV + `_camBaseY`, `animate` Y offset, `_onPointerDown` ndc sync, `_onPointerUp` explicit panel raycast, hint copy), `js/helpers.js` (b151 → b152), `FILE_MAP.md`, `CHANGELOG.md`.

## b151 — 2026-05-05 — Scenes selector: stronger click-kick physics

User: *"our kicks are a tiny push forward where the mouse is. i want it stronger so that it feels like youre actually moving things instead of just a gentle nudge"*

The click-to-kick on `/scenes/` props (cones, crates, coils, killballs) was a polite nudge — props rolled a few feet and stopped. Now they actually punt.

**Kick strength roughly doubled.**
- Base linear speed `(6 + rand*4)` → `(11 + rand*5)` — was 6–10 m/s, now 11–16 m/s before per-type scaling.
- Per-type `speedScale`: default 1.20→1.50, cone 1.55→1.85, crate 1.20→1.50, coil 1.10→1.30, killball 1.30→1.60.
- Final horiz speed range now ~14–30 m/s (was ~7–15).
- Vertical pop bumped: default `1.6+rand*0.9` → `2.5+rand*1.2`; cone 1.5→2.4 base; crate 1.3→2.2; coil 1.0→1.8; killball 0.7→1.4. Props actually launch instead of skipping.
- Spin multiplier 7 → 10 base, scales bumped (cone 1.7→2.2, crate 0.8→1.1, coil 0.7→1.0, killball 0.5→0.7) so things tumble visibly mid-flight.

**Lighter air damping so distance carries.** `airRate` 0.30→0.20 default, 0.18→0.10 cone. `angRate` 0.70→0.55 default, 0.40→0.30 cone. Floor friction unchanged — settle behavior on the ground stays the same, just the flight phase is longer.

**Files touched:** `js/scenes-selector.js` (`_kickProp` per-type kick params + `_tickPropsPhysics` air damping), `js/helpers.js` (b150 → b151), `FILE_MAP.md`, `CHANGELOG.md`.

## b150 — 2026-05-05 — Vault v3: kill the pink wash, add iridescent rims + light-catching glints

User: *"too pink too much post process no visibility. keep some post process but make it interesting to look at but dont destroy visibility any reflective physics we can have glimmers of color or light?"*

The b148 vault was over-saturated — magenta nebula + pink core + heavy bloom + heavy CA combined to wash out everything in the foreground. Toned it back without losing the sci-fi feel, and added the "glimmers of light" the user asked for.

**Palette de-pink-ed.**
- Nebula shader: replaced the magenta/pink palette with deep indigo / teal / navy, magenta now only a rare accent (`c4` mix at 0.18×, was 0.30×). Cloud floor lifted (n - 0.50 → n - 0.62) so most of the sky stays dark, not lit. Final color multiplied by 0.55 — nebula is now a backdrop, never out-shines panels/core.
- Core beam: 4 layers re-spec'd from full pink to white-cool core → cyan → muted purple → dim outer halo. Layer opacities pulled back (0.85/0.55/0.35/0.18 → 0.75/0.40/0.22/0.10) so the column glows without bleeding.
- Back-glow sprites: pink/magenta replaced with blue / cyan / muted-pink, opacities 0.45/0.35/0.30 → 0.22/0.18/0.12.

**Bloom dialed back.** Strength 0.85 → 0.40 base, threshold 0.10 → 0.18, audio range cut from `+0.7×bass` to `+0.35×bass`. Edges read again.

**Post stack lighter.** Final-pass CA 0.0024 → 0.0010 (less smear), scanline mod 0.04 → 0.02 (subtler), grain 0.05 → 0.025, vignette softened (smoothstep `1.30,0.40` → `1.55,0.50`). Per-panel CA 0.0016+0.009×g → 0.0010+0.005×g. Panel face tint less aggressive (`col *= uTint` → `col *= mix(vec3(1), uTint, 0.55)`) so canvas text reads.

**Iridescent panel rims (the "reflective physics" ask).** New `hsv2rgb` helper in `PANEL_FRAG`. Edge frame color now cycles hue along the rim + over time: `hsv2rgb(fract(uTime*0.08 + uv.x*0.55 + uv.y*0.40), 0.55, 1.0)`, mixed 0.55 with the panel's own tint. Result: each panel's border has a slow rolling rainbow shimmer when light catches it — like glass refracting under lights. Per-panel hover/focus boost still drives intensity, but base brightness on edge dropped (0.6 → 0.55, hover 1.2 → 0.85).

**Light-catching glints.** New `_buildGlints()` adds 36 small radial-gradient sprites scattered through the spire volume (radius 10–32u, y ±40u). Each one is on its own period (3–8 s), opacity stays at 0 most of the time then briefly spikes via `pow(sin(phase*π), 28)` — narrow windows of bright color flashes. Per-glint hue is randomized so the catalog twinkles in cyan/yellow/pink/teal/etc as you scan, never one color. `glints` array tracked in state + cleaned up in `destroy()`.

**Fog cooled.** Density 0.014 → 0.009, color 0x06080d → 0x05070b — distance falls off slower so back panels stay legible.

**Files touched:** `js/tracks-vault.js` (PANEL_FRAG iridescent rim + softer params; POST_FRAG softer CA/scanline/grain/vignette; NEBULA_FRAG cool palette + 0.55 gain; core layer specs; back-glow opacities; new `_buildGlints()` + animate tick; bloom 0.85 → 0.40; fog 0.014 → 0.009), `js/helpers.js` (b149 → b150), `CHANGELOG.md`.

## b149 — 2026-05-04 — Cortana pivot: shader silhouette → wireframe humanoid (option C)

User: *"i hate the cortana in the bg"* — the b145 Canvas2D silhouette read as a fuzzy blob behind the galaxy panel. Per the original A-then-C agreement, swapping in option C.

**Out:** `CORTANA_VERT`, `CORTANA_FRAG`, `_makeCortanaTexture()`, the textured PlaneGeometry mounted at z=+25 with the silhouette painted in 2D bezier paths.

**In:** `_buildCortana()` now constructs a procedural wireframe humanoid from three.js primitives, all rendered as `LineSegments` over `WireframeGeometry` with a shared cyan additive line material (`#80c8ff`):

- Head: icosahedron (r=0.42, detail=1)
- Neck: open-ended cylinder
- Shoulders: two small icosahedra at ±0.7 x
- Torso: octahedron stretched (1.55, 2.6, 0.65)
- Arms: thin elongated octahedra (scale.y = 9.5) hanging at sides
- Hips: flattened icosahedron
- **Lower-body dissipation**: stack of 14 `RingGeometry` planes lying flat, decreasing radius + opacity (0.45 → 0), emulating the hologram falling apart at the bottom

Group placed at (0, 0.6, +25) — same back-of-arc spot as before, behind the galaxy portal panel. Animate loop now drives:
- `cortana.rotation.y = sin(t*0.18)*0.35` (slow head turn left/right, ±20°)
- `cortana.position.y = 0.6 + sin(t*0.6)*0.08` (idle bob)
- `cortanaRings.rotation.y = t*0.12` (continuous ring stack spin)

Particle dust + cyan back-glow sprite carry over unchanged.

**Files touched:** `js/scenes-selector.js` (deleted Cortana shader consts + canvas builder, replaced `_buildCortana` body, swapped animate-loop Cortana hooks), `js/helpers.js` (b148 → b149), `FILE_MAP.md`, `CHANGELOG.md`.

## b148 — 2026-05-04 — Vault v2: continuous scroll, per-track hues, living environment

User: *"This is super cool. I think it should be a continuous scroll … shuffle for all the 111 songs instead of those weird cutoffs. I also think it'd be cool to have like different songs be different colors because right now everything is like very monolay. Additionally, this still feels like a shitty little beam and cards wheres the web gl beautiful animations living enviroment webpage etc"*

Three asks, addressed:

**1. Continuous scroll + shuffled order.** Removed the top/bottom clamps. Replaced `cam.y` motion with a `scroll` accumulator. Each frame, every panel's display-y is `wrap(layerY - scroll)` into `[-halfH, +halfH]` — so the helix loops forever; you can scroll for as long as you want and panels cycle through. Also added a slow auto-scroll (1.2 u/s downward) so the scene is always alive even with no input. Slot order is now Fisher-Yates-shuffled on init: each slot still gets a unique hue (golden-ratio walk over slot index), but the catalog ordering through the helix is mixed, not 1→117 sequential.

**2. Per-track colors.** Killed the 3-color tier monotone. New `paletteForSlot(slotIdx, tier)` gives every panel its own hue via `(slotIdx * φ) % 1` — golden-ratio sampling spreads colors evenly around the wheel without clusters. Tier modulates saturation + lightness (featured = 0.85/0.66, new = 0.78/0.62, archive = 0.62/0.58) so featured/new still pop while every track has its own personality. Tier is preserved as a small text badge in the panel canvas so it's still scannable. Halo and frame both use the per-track tint.

**3. Living environment.** The "shitty little beam" is gone. New world:

- **Nebula skybox** — 220-radius inverted sphere with a custom 5-octave fbm shader, deep purple → magenta → cyan palette, slow rotation + tilt, embedded star bursts via `pow(noise, 36)`. The void is filled.
- **Multi-layer core beam** — 4 stacked translucent additive cylinders (radii 0.08 / 0.20 / 0.50 / 1.10) with a custom fragment shader that does scrolling scanline bands + audio-reactive intensity (bass drives both bandwidth speed and brightness pulse). Reads as a thick, glowing data-column instead of a hairline.
- **8 vertical light pulses** — small bright bloom sprites that travel up and down the spire axis at varying speeds, looping seamlessly, opacity sin-modulated. Sells "data flowing through the column."
- **3 wireframe orbital rings** — TorusGeometry → WireframeGeometry, magenta/cyan/orange, tilted at 0.22 / -0.35 / 0.55 rad, slowly rotating around the spire axis at radii 18 / 26 / 34. Implies a containing structure.
- **22 mech-debris shards** — Icosa / octa / tetra / dodec / cone meshes drifting at radii 16–36u, each with its own multi-axis spin, slow orbit, vertical bob. New `SHARD_VERT/FRAG` does fresnel-based iridescent edges over a darkened base — translucent geometric debris reading like server-rack fragments.
- **Denser dust** — 700 particles (was 500) drifting in the spire volume, vertex-shader curl, additive bloom-bait.
- **Triple back-glow** — purple above, cyan below, magenta upper-mid sprite stack.

**Audio reactivity.** New `_ensureAnalyser()` mirrors the index.html one — reuses `audio.__floorAnalyser` if it exists, otherwise creates its own AudioContext + AnalyserNode (fftSize 256, smoothing 0.85). Each frame `_readAudio()` extracts smoothed bass (0–8 bins) and energy (full spectrum). Bass drives bloom strength (0.85 → 1.55), core beam pulse, and currently-playing panel halo size. Energy drives a new `uAudio` panel uniform that pushes the playing panel's frame-glow + RGB-split harder when the music is loud. `onTrackChange()` calls `_ensureAnalyser()` + resumes any suspended context, so audio reactivity comes online the moment something plays.

**Implementation notes.**
- `HELIX.yStep` bumped 1.0 → 1.6 for cleaner spacing, `totalH` and `halfH` now computed from `slots.length / 2`.
- Wrap helper `_wrapY()` handles JS modulo of negatives correctly.
- Camera Y is now permanently 0; only yaw + scroll move. Auto-yaw drift unchanged (0.012 rad/s).
- Bloom strength bumped 0.70 → 0.85 base + audio-reactive top-up.
- Fog tuned: density 0.012 → 0.014, color 0x040406 → 0x06080d (warmer void to read against the nebula).

**Files touched:** `js/tracks-vault.js` (full rewrite, ~880 lines — added `NEBULA_VERT/FRAG`, `SHARD_VERT/FRAG`, `CORE_VERT/FRAG`, `paletteForSlot`, `shuffleInPlace`, `_buildShards`, `_buildPulses`, `_ensureAnalyser`, `_readAudio`, `_wrapY`, continuous-scroll wrap in animate, audio-reactive uniforms, denser env), `js/helpers.js` (b146 → b148), `FILE_MAP.md`, `CHANGELOG.md`.

## b146 — 2026-05-04 — `/tracks` rebuilt as a WebGL catalog spire (THE VAULT)

User: *"i dont like the look of tracks, everything about that webpage is ugly and sucky. take inspoo from something like scenes … B webgl style cuz i hate the current tracks so ugly not visualy interesting not like galaxy nor scene"*

The old editorial layout (huge "can't mute me." hero + cyan particles + ed-track list with filter pills) is gone. `/tracks` and `/tracks/new` now mount a Three.js scene that's its own thing — distinct from `/` (galaxy = title-text fibonacci sphere) and `/scenes` (10 panels in a 261° arc):

**The form — descending double-helix.** All 117 tracks are holographic panels arranged in two interleaved strands (panels at index `i` go to strand `i%2`, π apart on the helix), 6 panels per strand per turn, 1u vertical step per panel, helix radius 13u. Camera orbits on a cylinder at radius 21u looking inward at the spire axis. A central pulsing column-of-light beam (custom gradient shader, magenta↔cyan, scanline bands) runs floor-to-ceiling through the helix core.

**Atmosphere.** 800-point starfield sphere shell at r=90–150 with twinkle shader, 500 dust motes drifting in the spire volume, two soft back-glow sprites (purple above, cyan below) for depth. FogExp2 + bloom + post-stack with mild CA / scanlines / grain / vignette (mirror of `/scenes` post).

**Per panel.** Same holographic shader as `scenes-selector.js` (block displacement, RGB-split, scanlines, edge frame) with a new `uPlaying` uniform that boosts the frame glow on the current track. Canvas texture shows track number, title (lowercase, auto-fit), tier badge, year + first tag, and a "▶ HOVER · CLICK · PLAY" caution stripe. Tier color codes the frame: featured = magenta, new = cyan, archive = warm white. Idle glitch bursts on random panels every few seconds (1.4‰ chance per frame to pulse `uHover` to 0.55 for 0.45s). Halo sprite behind each panel pulses with hover/focus/playing.

**Interaction.**
- Drag horizontal → camera yaw around the spire axis.
- Drag vertical → camera y (descend / ascend through the helix).
- Scroll wheel → camera y, faster.
- Hover panel → glitch boost + halo brighten + cursor pointer + HUD hint.
- Click panel → focus mode: panel flies to a showcase point in front of camera (scale 1.18×), faces camera, focus card slides up bottom-left.
- Esc / click anywhere / CLOSE → release focus.
- Slow auto-yaw drift (0.012 rad/s) so the scene is never static.

**HUD chrome (mirrors `/scenes`).**
- TL: magenta kicker `— archive index — KANI · CANTMUTE.ME`, lowercase massive title (`the catalog.` default, swaps to focused/playing track), meta line (`117 signals · drag · scroll`), boxed mono search input (`SEARCH ▸ title…`).
- TR: brand mark + `drag · scroll · click` meta + nav links (galaxy, scenes, playlists).
- BL: hint strip (`— scan the spire —` → `→ TRACK_NAME · TRACK 042 / 117` on hover).
- BR: filter chips (`all / featured / new / hard / chill / grunge / vibe`). Clicking `new` pushState's `/tracks/new`; clicking any tag-filter normalizes URL to `/tracks`. No full re-render — the vault stays mounted and panels animate visibility.
- Focus card: `▣ TRACK 042 / 117 · ARCHIVE` kicker, lowercase massive title, year + tags body, action links: `▸ play / details / share / close`.

**Filter & search behavior.** Non-matching panels fade `uVis` to 0 and retract toward the helix axis (target position becomes `(0, baseY, 0)`). Visible count + filter context shown in the meta line. Search input is wired directly to `setQuery()` — no DOM rebuild per keystroke.

**Lifecycle.** New `bootTracksVault(filter)` mirrors `bootMarathonWorld`. `render()` now branches: if route is `all` or `new` → mount/sync vault and short-circuit. If we leave the vault → tear down + remove `body.tv-on`. Topbar + miniplayer hidden under `body.tv-on` (same pattern as `body.mw-on`). Search box typing in the topbar no longer fires while on `/tracks` (topbar is hidden). `playIndex()` now calls `TracksVault.onTrackChange()` so the currently-playing panel pulses.

**Files touched:** `js/tracks-vault.js` (NEW, ~640 lines), `index.html` (added `.tv-*` CSS block + `body.tv-on` rules; rewrote `render()` vault lifecycle; new `bootTracksVault()`; `playIndex()` hook; `<script type="module">` tag for the new file; the legacy `viewEditorial()` / `startEdRingAnim()` are now unreachable but left in place for minimal blast radius), `js/helpers.js` (b145 → b146), `FILE_MAP.md`, `CHANGELOG.md`.

**Known limitations / v2 candidates:** Cover-art textures are not on panels (titles only — fast first paint); the helix is one big stack (no per-tier vertical bands); no keyboard nav (Esc + INPUT-focus protection only); mobile pinch not handled (touch drag-look + scroll work fine). If the helix shape feels gimmicky after testing, falling back to a single 360° ring is a clean follow-up — the panel system, HUD, focus card, and filter wiring all stay.

## b145 — 2026-05-04 — Cortana hologram + galaxy-portal panel on `/scenes`

User: *"Think scenes can be better… in the background we should have like pelicans launching off… were also missing a card for the main page… can we have a high detail Cortana (halo AI lady) somewhere, she can be glitchty, aniamted thru threejs"*

The 261° panel arc had a ~99° empty gap behind the viewer. Filled it with two new things, both procedural (no model downloads, no copyrighted assets):

**1. Cortana hologram — pure shader.** Vertical 5.5×11 plane behind the home panel at z=+25, y=2.5. Texture is a stylized cyan female silhouette painted in Canvas2D — asymmetric bob hair, gradient face, glowing white-cyan eyes (with shadowBlur halo), nose contour, lips, neck, collarbone shadow, fading torso, body-circuit overlay (random hex/line tattoos). Silhouette runs through `CORTANA_FRAG`: heavy 800-line scanlines, RGB-split CA, random horizontal glitch slices, vertical sweep band scanning down at 0.18Hz, interlace alpha drop, edge fade, whole-image stutter flicker (1.2% chance per 12Hz tick), slow breathing pulse, cyan tint shift. Vertex shader does a small idle sway. Surrounded by 220 cyan particles drifting on sin/cos curves + a soft cyan back-glow sprite that pulses at 0.8Hz. Non-interactive — she's ambient presence, the focal point when you orbit to face the gap.

**2. Galaxy portal panel — 11th panel in the ring.** Same shader + canvas template as the experiment panels, marked `isHome: true`, hue 0.55 (cyan), title "galaxy", num "00". Placed manually at (0, 0.6, +18) — directly back-center, framed in front of Cortana so she reads as the AI presiding over the portal. Click → focus → ENTER routes to `/` instead of `/scenes/play.html?scene=...` (special-cased in `_focus`).

HUD subtitle bumped to "10 experiments + galaxy portal · station observation deck".

**Files touched:** `js/scenes-selector.js` (added `CORTANA_VERT` / `CORTANA_FRAG` consts; new methods `_buildHomePanel`, `_buildCortana`, `_makeCortanaTexture`; init wires both; animate loop ticks Cortana uniforms; `_focus` special-cases `isHome` for the ENTER href; HUD copy updated), `scenes/index.html` (meta description), `js/helpers.js` (b144 → b145), `FILE_MAP.md`, `CHANGELOG.md`.

## b144 — 2026-05-04 — Audio fallback to local `/audio-mp3/` when R2 misses

User: *"some songs ddont play ensure all play on main apge the localhost 8k"*

**Root cause.** `audioBase` in `config.json` points to the R2 bucket (`https://pub-…r2.dev/`). All 117 tracks in config reference filenames that exist locally in `audio-mp3/` (134 files on disk), but R2 is missing some of them — so any track whose file wasn't uploaded fails silently with a toast and never plays.

**Fix.** One-shot fallback in the inline audio `error` handler in `index.html`:
- On error, if the failing src starts with `state.audioBase` and we haven't retried this index yet, swap to `/audio-mp3/<encoded-file>` and `audio.play()` again.
- Track retried indices in a `Set` so we don't loop if the file is genuinely missing from both.
- `console.warn` logs the R2-missing filename so we can see exactly what to re-upload.

Net result: every track playable on localhost (since the local folder has them all). On the deployed site, behavior is unchanged for tracks that exist on R2; ones that don't will hit the same toast they did before, but logged with the missing filename.

**Files touched:** `index.html` (audio error handler), `js/helpers.js` (b143 → b144), `FILE_MAP.md`, `CHANGELOG.md`.

## b143 — 2026-05-04 — Local dev server (`serve.py`) that handles SPA rewrites

User: *"errors"* (404s on `/tracks` and `/tracks/playlists` running on `localhost:8000` — Python `http.server`'s default 404 page).

**Root cause.** Python's built-in `http.server` doesn't read `_redirects` (that's a Cloudflare-only file). So when you hit `localhost:8000/tracks`, it looks for a file at `tracks/index.html` and 404s because the route is supposed to rewrite to `/index.html` (where the SPA router takes over).

**Fix.** New `serve.py` at the repo root — a tiny ThreadingHTTPServer subclass with a regex-based rewrite table that mirrors `_redirects`:
- `/tracks`, `/tracks/*`, `/t/*`, `/p/*`, `/a/*`, `/ep/*`, `/world` → rewrite to `/index.html`
- Real files served as-is (`/scenes/`, `/style.css`, `/js/*.js`, `/covers/*`, etc.)
- Convenience: `/scenes` (no trailing slash) → 302 to `/scenes/` so directory-index resolution works
- Quiet logs (one line per request)

The rewrite is a true 200-status rewrite, not a 30x redirect — `self.path` is mutated to `/index.html` *before* calling `super().do_GET()`, so the file served is `index.html` but the browser's URL bar still shows `/tracks` (which is what `location.pathname` reads in the SPA router).

**Usage:**
```
python serve.py        # default port 8000
python serve.py 8001   # custom port
```

Replace `python -m http.server` with this command for any localhost dev session.

**Files touched:** `serve.py` (NEW), `FILE_MAP.md` (added Local dev section), `js/helpers.js` (b142 → b143), `CHANGELOG.md`.

## b142 — 2026-05-04 — Playlists / single track / coming-soon all themed (full chrome rollout)

User: *"catalog and playlists are dead btw match them and the other stuff."*

Bulk legacy-class rewrite. Every page that wasn't `/`, `/scenes`, or `/tracks` (already done) was still rendering with the original card-grid look and felt completely off-theme. Restyled all of them in one pass without changing the HTML class names — all routes now share a single visual language.

**Restyled CSS classes (token swap + theme reskin):**
- `.page-head` — magenta `// CANTMUTE.ME` kicker bar (via `::before`), oversized lowercase Space Grotesk 800 title (40–80px), mono uppercase count.
- `.view-toggle` (grid/list) — 3px-corner mono buttons, magenta active state. Labels lowercased.
- `.grid` — gap kept 14px, but `.card` rewritten: 6px radius, glass `var(--surface)`, magenta border + pink halo on hover, **green border + green halo when playing**. Inner `::after` pseudo-element draws faint scan-lines for terminal feel. Card title lowercase Space Grotesk 700/800. Sub-line in mono uppercase. Play-FAB: white-fill black-icon → magenta-bordered ring with magenta-tinted fill.
- `.playing-dots` — three white pulsing dots → three **green pulsing dots with green glow** (matches active state).
- `.pill` (FEATURED / NEW / HOT) — opaque pill backgrounds → mono-typography colored outlines: feat magenta-on-magenta-tint, new green-on-green-tint, hot saturated magenta.
- `.list` + `.track-row` — gets the same scan-line tint + magenta-bar-on-hover treatment as `.ed-track` from b141. Rows get green left-bar + green-tinted bg when playing.
- `.detail-*` (single-track page hero) — cover art now 6px radius with **scan-line `::after` overlay**, faint border. Kicker becomes magenta mono `— incoming signal —`. Title lowercase Space Grotesk 800, 56–128px. Meta line: mono uppercase tabular-nums.
- `.btn` family — 8px radius pills with sans → 3px-corner mono uppercase buttons, semi-transparent black bg. `.btn.primary` = magenta border + magenta text + magenta tint. `.btn.sc` = cyan equivalent. Hover: bg fills, color flips to white.
- `.detail-grid` body sections — `<h3>` headings now `// SECTION` mono kickers in magenta. Code spans get cyan with magenta-faint border. Tags become 2px square mono pills.
- `.detail-side .panel` — glass surface with backdrop blur, magenta `// SIGNAL INFO` headers, mono stat rows.
- `.related` — same magenta `//` heading pattern. Inherits new card style.
- `.share-box` — `var(--bg-elev)` 10px-radius card → semi-transparent black with **magenta left-border accent**, mono code in cyan, uppercase magenta `SHARE` label.
- `.back-link` — mono uppercase, magenta on hover with magenta underline.
- `.toast` — white-fill black-text → glass surface with magenta border + magenta text + soft magenta box-shadow halo.
- `.center` (empty states) — themed mono, magenta `<b>` accents, cyan `<code>` spans.

**View text updates** (same files, English replaced to fit theme language):
- `viewPlaylists` empty state: `Kani / Playlists / No playlists yet` → `— mission folders — / playlists / no playlists on file yet`. Header gets a mono count.
- `viewPlaylist` (single): `Playlist · shared / N tracks · curated by Kani` → `— mission folder · shared transmission — / N signals · curated by kani`. Share box label `Share:` → `SHARE`. Back-link text `← playlists` → `← back to folders`.
- `viewTrack`: `Kani · track / About / Credits / Tags / Share / Track info / Listen elsewhere / More from Kani` → `— incoming signal — / // about / // credits / // tags / // share / // signal info / // listen elsewhere / // more from kani`. Buttons: `▶ Play / ↗ SoundCloud / ＋ Playlist` → lowercase + `＋ folder` for playlist. Back-link: `← back` → `← back to galaxy`.
- `viewComingSoon`: `${kind}` capital → `— release pending · ${kind} —`. Body copy in mono lowercase.
- `listRow`: artist line `Kani` 12px gray sans → mono uppercase `KANI` with letter-spacing.
- `viewToggleHtml`: `Grid / List` → `grid / list`.
- `draftBarHtml`: `<b>N</b> in draft / Clear / Save playlist →` → `DRAFT · N signals / clear / save folder →`.

**Identity now consistent across every route:**
- `/` (Text Galaxy) — vivid void + hue-cycling typography
- `/scenes` (observation deck) — interior space station, holographic panels
- `/tracks` (transmission archive) — terminal-archive scrolling list
- `/tracks/playlists` (mission folders) — themed card grid
- `/p/<slug>` (mission folder · open) — themed list/grid view + share box
- `/t/<slug>` (incoming signal) — themed track page
- `/a/<slug>`, `/ep/<slug>` (release pending) — themed placeholder

All share: magenta `--accent-debug` for active/section/kicker, green `--accent-active` for playing, cyan `--accent-cyan` for energy, glass surfaces with backdrop blur, scan-lines, mono+display typography pairing.

**Files touched:** `index.html` (legacy `.page-head` / `.view-toggle` / `.grid` / `.card` / `.playing-dots` / `.pill` / `.list` / `.track-row` / `.list-head` / `.mini-btn` / `.detail-*` / `.btn` / `.tag-row` / `.tag` / `.related` / `.share-box` / `.toast` / `.center` / `.back-link` CSS rewrites; `viewPlaylists` / `viewPlaylist` / `viewTrack` / `viewComingSoon` / `listRow` / `viewToggleHtml` / `draftBarHtml` text updates), `js/helpers.js` (b141 → b142), `FILE_MAP.md`, `CHANGELOG.md`.

## b141 — 2026-05-04 — `/tracks` themed as "transmission archive" + chrome (header + miniplayer) on theme

User: *"track list, featured, all of those will also exist in their own sort of themed spaces, relating to our main localhost 8000 theme. we can move onto tracks or whatever else."*

Three areas restyled to the STYLEGUIDE.md tokens. Each gets a distinct character within the same DNA — `/tracks` is the "transmission archive," chrome (top header + bottom miniplayer) is the connective tissue.

**`/tracks` editorial restyle (the catalog as a transmission archive).**

Hero (kept the audio-reactive ring + particles + photo backdrop, all the existing machinery — just reskinned):
- Hero kicker rewritten: `Kani · cantmute ●` → `— transmission log — KANI ● CANTMUTE.ME` in mono with magenta accent + cyan indicator. Reads as a station banner, not a magazine masthead.
- Hero title glitch CA shifted from cyan/amber → **magenta + cyan** (`(102,221,255,.18)` cyan + `(255,126,195,.20)` magenta) so it matches the global theme color hierarchy.
- "now playing" sub-line: dot color cyan → magenta with halo glow; nowname color white → magenta. Mono font.
- Scroll cue: `↓ catalog · 117 tracks` → `↓ 117 SIGNALS ON FILE` in mono magenta with text-shadow glow.

List section (full terminal-archive treatment):
- Section gets a faint **horizontal scan-line tint** (`repeating-linear-gradient` at 4px steps with magenta·0.025 opacity) and a **40×80px grid texture** background fading at top/bottom edges via mask-image. Reads as a data terminal.
- New magenta kicker bar above the section title via `::before` content: `// TRANSMISSION ARCHIVE`.
- Section title: `Catalog` → `catalog` (lowercase, Space Grotesk 800, 28–44px) with mono count `117 / 117 SIGNALS`.
- Filter pills: pill-shape rounded → 3px square corners, mono font, `[ALL]`-style. Active state: magenta text + magenta border + `rgba(255,126,195,.10)` fill (was: white pill, black text). Hover: white text + white border.
- Track row: mono number now magenta on hover, **green on playing**. Title gets RGB-split CSS text-shadow on hover (cyan + magenta). Magenta vertical bar slides in on the row's left edge on hover via `::before` scaleY transform; on playing rows the bar turns green with a glow.
- Tag pills: `FEAT` is magenta on magenta-tinted bg; `NEW` is green on green-tinted bg. Both mono uppercase with 2px radius.
- Year column: mono, tabular-nums, faint gray.
- Play button: invisible default → opacity 1 on hover. Hover state magenta-tinted with magenta border. Playing state green-tinted with green border.

**Top `header.topbar` chrome restyle.**
- Background: `rgba(7,7,10,.72)` → `var(--surface-elev)` glass with backdrop blur.
- Magenta hairline gradient bar across bottom edge (matches the miniplayer's top hairline so they bracket the page).
- Brand logo: 22px sans bold → 20px Space Grotesk 800 lowercase.
- Brand subtitle: gray uppercase tracking → magenta mono `// SECTION` style.
- Nav links: pure white sans → mono uppercase, faint gray default, white on hover, **magenta on `.active`** with magenta underline.
- Explore button: pill with linear-gradient → magenta-bordered rounded rectangle (`3px` radius), magenta text, hover fills with magenta tint and goes white.
- Search input: dark elevated bg → semi-transparent black with magenta focus border + magenta search icon. Placeholder uses mono lowercase.

**Bottom `.miniplayer` chrome restyle.**
- Background: `rgba(10,10,14,.94)` → `var(--surface-elev)` glass + matching magenta hairline at top (mirrors the topbar's bottom hairline).
- Progress bar: white fill → **magenta-to-cyan gradient** with a subtle 8px magenta box-shadow glow.
- Cover art thumbnail: 8px radius → 3px square with faint border.
- Title: Space Grotesk lowercase, 13px. Artist line: mono, text-muted.
- Mini-buttons (prev/next/etc.): circle no-border → 3px-radius square with transparent border, gains border on hover.
- Play button: white fill black icon → **magenta-bordered ring with magenta-tinted fill**, scales 1.06× on hover and brightens to white.

**Identity language now consistent:**
- Magenta `--accent-debug` = active link / current section / kicker / debug
- Green `--accent-active` = currently playing / toggled-on
- Cyan `--accent-cyan` = energy / progress fill / engine glows
- White text reserved for hover/strong-state only
- Mono font for all kickers, meta, time codes, nav. Display font for titles only.

**Out of scope this build (next priority per STYLEGUIDE):**
- `/t/<slug>` track page (still legacy 2D template)
- `/p/<slug>` playlist page
- `/tracks/playlists` playlist index page
- `/a/<slug>`, `/ep/<slug>` placeholders

**Files touched:** `index.html` (header.topbar CSS rewrite, .miniplayer + .play-btn + mini-btn + mp-progress CSS rewrite, .ed-hero-kicker / .ed-hero-title.glitch / .ed-hero-sub / .ed-scroll-cue restyle, .ed-list-section + ::before grid + scan-lines, .ed-list-head + ::before kicker, .ed-list-title + .ed-list-filters rewrite, .ed-track + ::before bar + .ed-num + .ed-title hover RGB-split + .ed-tag.feat/.new + .ed-year + .ed-play rewrite, viewEditorial kicker + scroll-cue + list-title strings updated), `js/helpers.js` (b140 → b141), `FILE_MAP.md`, `CHANGELOG.md`.

## b140 — 2026-05-04 — `/scenes` WebGL rebuild — station observation deck

User: *"looks super ugly. can we make it actually impressive, webgl back in the mix somehow maintaining theme... maybe this is inside some space station or something."*

**`/scenes` is now a Three.js scene, not a card grid.** The b139 2-column flat-card layout is dead. Replaced with an interior-space-station observation deck:

**`js/scenes-selector.js`** (NEW, ESM module). Mounts into the page via `<script type="module">`. Builds a Three.js scene with:

- **Procedural floor grid shader** — receding hex/square lattice on a 220×220 plane below the camera. Two overlaid grids (1.6u fine + 8u coarse), fade with distance from origin, plus a pulsing concentric ring around `(0,0)` whose radius oscillates `8 + 2·sin(t·0.6)` like a sci-fi targeting reticle. Hue mixes between magenta and cyan over time.
- **Bulkhead frame ring** — two `TorusGeometry` rings at `y = ±6` (radius 28) plus 8 vertical struts forming an octagonal cage. Implies "we are inside something" without modeling the full interior.
- **12 overhead light strips** in a ring at `y = 7` — soft warm-magenta planes with additive blending. Reads as ceiling lighting tubes.
- **600 dust motes** drifting on faux curl-flow (xy/yz coupled sin offsets), distance-faded to 6–40u radius shell. Adds atmospheric volume.
- **Two warm/cool back-glow sprites** behind the action — magenta (`(180,80,160,0.55)`) and cyan (`(80,180,200,0.40)`) — give a sense of distant illumination through the implied bulkhead.

**10 holographic scene panels** arranged in a **261°-wrap arc** around the viewer (`arcRadius = 18`, `arcSpan = 1.45π`). Each panel:
- 9×5.4u plane with custom fragment shader (`PANEL_FRAG`): block displacement glitch, RGB-split scaling with hover/focus, scanline modulation, **magenta-tinted edge frame** (`smoothstep` on UV distance from edge), inner caution-stripe band at the bottom (where description sits), per-panel HSL tint.
- Canvas-rendered texture (720×432) with: magenta `EXPERIMENT NN` kicker, oversized lowercase title, wrapped mono body, bottom caution-stripe with `▶ HOVER · CLICK · ENTER →` prompt, white corner-bracket HUD marks.
- Glow halo behind each panel (sprite, additive, opacity tracks hover/focus).
- Idle drift bob; hover lifts panel + scales 1.05× + ramps up `uHover`; focus flies panel to a showcase point 11u in front of camera at scale 1.18×, others fade.

**HUD overlay** (sibling to canvas):
- Top-left: magenta `— scene index —` kicker, oversized lowercase title `kani / scenes`, mono meta line, nav row (`back to galaxy`, `catalog`, `playlists`).
- Top-right: brand mark + drag-hint.
- Bottom-left: live `→ TITLE · EXPERIMENT NN` hint that updates as you hover panels.
- Focus card: slides up from `bottom 14vh / left 8vw` when a panel is clicked. Magenta kicker, huge lowercase title, mono body, two underline buttons (`enter →` linking to `play.html?scene=<id>`, `close`).

**Camera + interaction:**
- Camera locked at origin with subtle vertical bob (`sin(t·0.5) · 0.10`).
- Drag → orbit gaze yaw/pitch (yaw unbounded, pitch clamped `[-0.40, 0.30]`).
- Click panel → focus. Escape or click `close` → release.
- Raycast against panels for hover; cursor switches to pointer when over.

**Composer stack:** RenderPass → UnrealBloom (strength 0.65, radius 0.55) → custom shader pass (CA 0.0020, scanline `sin(uv.y · 1.8·resH)`, grain 0.05, soft vignette).

**`scenes/index.html` rewrite.** Tiny shell now — full-bleed `<main id="ss-mount">`, importmap for `three`, ESM `<script type="module">` that imports `scenes-selector.js` and calls `init()`. All the styling lives in the embedded `<style>` block (HUD CSS only — the canvas is everything else).

**Files touched:** `scenes/index.html` (FULL REWRITE — minimal shell + importmap + HUD CSS, ~210 lines), `js/scenes-selector.js` (NEW — ~530 lines), `js/helpers.js` (b139 → b140), `FILE_MAP.md`, `CHANGELOG.md`.

## b139 — 2026-05-04 — `/scenes` cinematic selector + global design tokens

User: *"i want scenes to be a master list of a cool way to kind of choose the different views we created that'd be like our explore page... rest of the app to have a super cool theme doesnt have to be entirely webgl but i dont want basic ass slop either."*

**Scenes selector page** (`scenes/index.html`, full rewrite). Pure HTML/CSS, no script deps, no scene engine — landing here is instant. Layout:
- Header: magenta kicker `— scene index —`, oversized 96px lowercase title `kani / scenes`, mono body line, top-right brand mark + nav (`back to galaxy`, `catalog`, `playlists`).
- 2-column grid (1-col on mobile) of 10 scene cards. Each card has:
  - Numbered uppercase magenta kicker (`EXPERIMENT 01`–`10`)
  - Large lowercase title in Space Grotesk 800
  - Mono body description (1–2 sentences each)
  - `enter →` link with arrow that translates on hover
  - Per-card gradient identity via `--g1` / `--g2` CSS vars in inline `style=""` (so each scene has a unique color signature without needing thumbnails)
  - Massive index number (110px, 4% white) floating bottom-right behind the content
- Hover effects: card lifts 3px, gradient scales 1.06×, border switches to `--accent-debug` magenta + pink halo box-shadow, **CSS-glitch RGB-split animation on title** (cyan + magenta + amber text-shadows on a 1.6s steps cycle), oversized index number tints magenta
- Inner scanlines + radial vignette via two `repeating-linear-gradient` + `radial-gradient` overlaid with `mix-blend-mode: multiply`
- Persistent grain overlay (SVG fractalNoise, 7% opacity, overlay blend)
- Ambient background: soft radial pink + cyan + warm gradients on `var(--void)` — not lit, just slightly less-dead
- Footer: kani / 2026 / cantmute.me + `/ home` link

**Existing scene app moved to `scenes/play.html`.** Bytewise copy of the pre-b139 `scenes/index.html`, with two surgical changes:
- `← Tracks` back-link in the topbar → `← Scenes` pointing to `/scenes` (the new selector)
- Inline script at end of body reads `URLSearchParams('scene')` and clicks the matching `[data-view="<name>"]` tab once `app.js` wires them. Polls every 80ms up to 30 attempts (= ~2.4s) so it works regardless of script load order. Cards in the selector deep-link via `play.html?scene=dimensions`, `?scene=villa`, etc.

**Design tokens added to `index.html` `:root`** (canonical going forward; legacy `--bg`/`--text`/etc. preserved so nothing existing breaks):
```
--void, --surface, --surface-elev, --border-faint, --border-glow,
--text-st, --text-muted, --text-faint, --text-strong,
--accent-debug (magenta), --accent-active (green), --accent-warn (amber),
--accent-cyan, --accent-magenta,
--font-display, --font-mono
```

**Google Fonts link extended** to load `Space Mono` (was already referenced in CSS but not loaded — explains why some of the mono text was falling back to system fonts on `/`). Also bumped Space Grotesk weights to include 800.

**Routing.** No `_redirects` change needed — Cloudflare's directory-index resolution serves `scenes/index.html` at `/scenes/` automatically. `scenes/play.html` is a real file path, served as-is.

**Out of scope this build (per priority list in STYLEGUIDE.md, attack next):**
- Top header restyle on `/tracks`, `/t/*`, `/p/*` — chrome that bleeds across pages
- Bottom miniplayer restyle (still using legacy tokens)
- `/tracks` editorial layout token swap
- `/t/<slug>` track page rebuild
- `/p/<slug>` playlist page rebuild

**Files touched:** `scenes/index.html` (FULL REWRITE — selector page, ~330 lines), `scenes/play.html` (NEW — copy of old scenes/index.html with back-link + ?scene=X handler), `index.html` (`:root` tokens added, Google Fonts link extended for Space Mono + Space Grotesk 800), `js/helpers.js` (b138 → b139), `FILE_MAP.md` (route entry + scene file entries updated), `CHANGELOG.md`.

## b138 — 2026-05-04 — Anamorphic flare tone-down + 3 new scenarios + STYLEGUIDE.md

User: *"anamorphic flare is too too strong. i want more scenarios. can we create an MD referencing the style of this and start applying this style to our backlinks. present me all the backlinks we have."*

**Anamorphic flares dialed back.** Strength `0.70 + uBass·0.35` → `0.28 + uBass·0.18`. Threshold `0.65` → `0.82` (only the brightest pixels streak). Tap count 17 → 13. Cyan tint flattened `(0.55, 0.95, 1.20)` → `(0.75, 0.95, 1.10)`. Reads as a subtle lens character now instead of a hollywood-camp overlay.

**Three new scripted scenarios** — each spawnable from the new `other scenarios` admin section:

- **`▶ longsword strafing run`** (`_spawnLongswordStrafe`). Three longswords spawn in a tight V-formation, sweep close to the focused title (or scene-forward point if none focused), and fire cyan plasma bolts from each ship at staggered intervals (0.22–0.36s cooldown per ship, lead/wingmen offset by `leadIndex * 0.15s`). Mild S-curve on the formation so the V doesn't look perfectly rigid. Banking proportional to lateral velocity. New scenario type `'strafe_run'` on each longsword. Bolts come from each ship's nose with slight aim-spread toward the target.

- **`▶ forerunner orbit`** (`_spawnForerunnerOrbit`). Single forerunner enters a slow circular orbit around the focused title (radius 8–12u when focused, 18–24u when not). Orbit axis is tilted (~10° off vertical) for visual interest. Angular speed 0.55–0.80 rad/s. Long-form scenario (16s) — the forerunner just hangs there, a mysterious sentinel. Scenario type `'forerunner_orbit'`. Position computed parametrically each frame from the orbit basis (axis × right × forward), `outer.lookAt(tangent)` so the model faces its travel direction. Inner rings preserve their independent self-spin.

- **`▶ plasma storm`** (`_spawnPlasmaStorm`). Stateless burst — fires 24 plasma bolts over 1.8s, each spawning from a random point on a 50–70u sphere around the focused title (or scene-forward), aimed at the target with small impact-jitter. Three colors cycle: hot magenta, ember yellow, cool cyan. Speed 110–150u/s, scale 0.85–1.25. No ship state involved; just `setTimeout` schedules calls to `_fireBolt`. Reads as a coordinated volley converging on the locked title.

**Admin panel additions.** New section `other scenarios` with three buttons. Each scenario now calls `_flashHint` on spawn so the panel surfaces what just fired.

**STYLEGUIDE.md** (NEW). Codifies the current Text Galaxy aesthetic as a style spec for rolling out across `/tracks`, `/t/*`, `/p/*`, `/scenes`. Contents:
- One-sentence identity statement
- Full palette token list (`--void`, `--surface`, `--accent-debug` (magenta), `--accent-active` (green), `--accent-cyan`, `--accent-magenta`, etc.)
- Typography (Space Grotesk + Space Mono — no Saira; b106 plan superseded)
- Layout primitives: HUD overlay, card surface, button (outline / primary / debug / active), progress bar, nav row
- Glitch language for static pages (CSS-equivalent of the WebGL fragment shader)
- Component vocabulary table
- **Backlinks inventory** — every route, current state, target state
- Rollout priority tiers (header + miniplayer first, then `/tracks`, then `/t`, etc.)
- Hard reminders (localhost-only, magenta=debug-not-chrome)

`THEME.md` (b106 Beta Decay vision) preserved as historical reference but explicitly demoted in `FILE_MAP.md` — `STYLEGUIDE.md` is now the source of truth.

**Files touched:** `js/marathon-world.js` (POST_FRAGMENT flare tuning; `_spawnLongswordStrafe`/`_spawnForerunnerOrbit`/`_spawnPlasmaStorm`; new `_tickScenario` branches for `strafe_run` + `forerunner_orbit`; admin panel HTML adds `other scenarios` section; click router handles `scen-strafe`/`scen-orbit`/`scen-storm`), `STYLEGUIDE.md` (NEW), `FILE_MAP.md` (added STYLEGUIDE link in design references), `js/helpers.js` (b137 → b138), `CHANGELOG.md`.

## b137 — 2026-05-04 — Text Galaxy: drop LUTs, add scene-element + time + capture controls to admin

User: *"not a fan of the 5 luts. a big fan of the other stuff. what else can we add into admin."*

**LUT system removed.** Dropped the 5 procedural LUT presets, the `_buildLutPresets`/`_adminCycleLut` methods, the `applyLut`/`uLut`/`uLutOn` shader infrastructure, and the LUT button. Anamorphic flares + lens dirt + god rays kept exactly as-is.

**New `scene elements` section** — eight kill switches for clean composition / screenshot setups:
- `nebula` (skybox), `haze` (4500-particle drift), `satellites` (8 nav-light gyros), `shards` (32 fragments), `text fragments` (70 cryptic snippets), `streaks` (light beam pool), `fog patches` (18 sprite layers), `distant core` (ringed observatory).
Each button shows `ON`/`OFF` and gets the green active outline. Toggling iterates the relevant collection and flips `.visible` (or `.mesh.visible`/`.grp.visible` depending on shape — `_adminToggleElement` handles all three patterns).

**New `time` section** — `⏸ pause`, `0.25×`, `0.5×`, `1× (normal)`, `2×`. Implementation:
- `_paused = true` causes `animate()` to render the current frame and bail before any ticks run — scene freezes instantly.
- Time scale multiplies `dt` and accumulates a `_virtualT` so all per-frame physics/animation slow down or speed up uniformly. Ships, fragments, hue cycle, gaze lerp, scenarios all respect it.
- Selecting any speed unpauses if paused.
- Pause button label flips to `▶ resume` and gets the green outline when paused.

**New `capture` section:**
- `📸 save canvas as PNG` — calls `composer.render()` to ensure back buffer is current, then `renderer.domElement.toDataURL()` → blob anchor download. Filename `cantmute-<isodate>.png`. Falls back to a magenta toast on CORS / preserveDrawingBuffer failure.
- `hide HUD` — hides the entire `.mw-hud` (top-left meta, player, brand, focus card, etc.) so only the canvas + admin panel remain. Useful for clean screenshots; admin panel itself stays visible since it's a sibling element.
- `🎲 hop to random title` — picks a random title and calls `_focus(node, { mode: 'look' })` so the camera rotates to face it. Releases prior focus first. Quick-fire exploration trigger.
- `FOV −5° / +5° / reset (80°)` — directly mutates `camera.fov` and calls `updateProjectionMatrix()`. Clamped to `[30, 120]`. 30° = telephoto compression (titles look stacked), 120° = fish-eye exploration. Flash hint shows the new FOV value.

**Cleanup.** Animate loop now early-returns when `_paused` after one composer render. `_buildLutPresets` and `_adminCycleLut` deleted. `applyLut` GLSL function and `uLutOn`/`uLut` uniforms removed from POST_FRAGMENT.

**Files touched:** `js/marathon-world.js` (POST_FRAGMENT trim; composer setup trim; admin panel HTML + 3 new sections; click router additions; `_adminToggleElement`, `_adminTogglePause`, `_adminSetTimeScale`, `_adminSaveScreenshot`, `_adminToggleHud`, `_adminHopRandomTitle`, `_adminBumpFov`; `_adminUpdateHints` reflects all new states; animate loop honors `_paused` + `_timeScale`; `_buildLutPresets`/`_adminCycleLut` deleted), `js/helpers.js` (b136 → b137), `FILE_MAP.md`, `CHANGELOG.md`.

## b136 — 2026-05-04 — Text Galaxy: tier-1 post FX (anamorphic flares, lens dirt, god rays, LUTs) — all toggleable

User: *"tier 1 i think honestly toggleable pls"*

Four post-process effects added to the existing ShaderPass, all OFF by default and individually toggled from the admin panel.

**Anamorphic flares** (`uFlaresOn`). 17-tap horizontal sample of the highlight component (luminance > 0.65), weighted by a gaussian falloff, tinted `(0.55, 0.95, 1.20)` for the cyan-shifted streak character. Magnitude scales with bass. Engine glows / plasma / focused titles all gain the J.J. Abrams horizontal streak read. ~25 lines of fragment code.

**Lens dirt** (`uDirtOn`). Procedural 512×512 texture built once at composer setup time:
- 850 small dust speckles (0.5–2.3px radius, slight color jitter)
- 14 streaky finger smudges (60–200px soft radial gradients)
- 80 subtle cyan/magenta hue scatters (lens-coating fringe)
The fragment shader extracts highlights from the current frame and multiplies by the dirt mask, so bright sources bloom *unevenly* — the void's sparse highlights now read as captured through a real lens.

**God rays** (`uGodraysOn`). 14-tap radial blur from the projected NDC position of the distant core (`coreGroup`). Each tap samples the highlight component with an exponential decay (0.94/tap), tinted warm `(1.10, 0.95, 0.78)` for solar shaft character. The ringed core now visibly shafts light through the haze in a way the uniform fog never did. Source position projected per frame in `animate()` only when god rays are on (no project cost when off).

**Procedural LUTs** (`uLutOn` + `uLut` texture). Five presets baked at startup as 4096×64 strip textures (64×64×64 LUT laid out as 64 z-slices). Sampled in shader with linear z-interpolation:
- **teal_orange** — Bladerunner 2049 / Hollywood. Shadows pushed cyan, highlights pushed warm. +10% saturation.
- **mono_cyan** — desaturated archival. Whole frame mapped to a cyan luminance ramp.
- **risograph** — 5-step posterize blended toward riso red (highs) and riso blue (lows). 2-color print look.
- **beta_decay** — high-contrast magenta/cyan, +25% saturation, lifted shadows toward magenta. Anchor reference per `THEME.md`.
- **kodachrome** — warm vintage film grade with highlight roll-off (caps at 0.96/0.94/0.92).
Cycle via the admin LUT button — order: `off → teal_orange → mono_cyan → risograph → beta_decay → kodachrome → off`. Currently active preset name displayed on the button.

**Admin panel `post fx` section.** Four buttons (`anamorphic flares`, `lens dirt`, `god rays (core)`, `LUT`). State is reflected on the button label (`ON`/`OFF` for binary toggles, preset name for LUT). Button gets a green outline (`mw-fx-on` class → `rgba(126,255,195,.10)` background, `.55` border) when its effect is active, so you can see the active stack at a glance.

**Cost.** Base shader cost rose from ~5 texture lookups to ~17 under flares + ~14 under god rays + ~3 under dirt + ~2 under LUT. Stacking everything still well under 1ms on integrated GPUs at this resolution. Branches use `if (uFlag > 0.5)` so the GPU skips the expensive paths when off.

**Files touched:** `js/marathon-world.js` (POST_FRAGMENT rewrite + new uniforms; `_makeLensDirtTexture`; `_buildLutPresets`; composer setup wires new textures; animate-loop projects core to NDC for god-ray source; admin panel HTML + handlers `_adminToggleFx`/`_adminCycleLut`; `_adminUpdateHints` reflects FX state), `index.html` (`.mw-fx-on` button highlight), `js/helpers.js` (b135 → b136), `FILE_MAP.md`, `CHANGELOG.md`.

## b135 — 2026-05-04 — Text Galaxy: rescaled focus-aware patterns + true diagonal fly-over

User: *"fly over title doesn't work, cross in front barely works, weave near doesn't really work either."*

**Root cause: scale mismatch.** The b133 patterns used absolute offsets (`dir·-200`, `+22u above title`) sized for sphere-distance titles (~130u radius). But a focused title sits at `showcaseDist` (~14–22u from camera), so:
- `fly_over` placed the closest-approach point **22u above a title that's only 18u away** — way outside the 80° FOV cone (visible half-height at z=18 is ~15u).
- `cross_in_front` swept ±200u perpendicular at depth 10u where visible half-width is only ~8u, so the ship was off-screen for 95% of its travel.
- `weave_near` had similar over-wide sweep.

**Fix: dynamic scale + tighter geometry.** Added `scale = clamp(tDist/18, 1.0, 2.4)` so spawn corridors auto-fit the title's actual distance. Reduced base sweep from `-200u` to `-70…-90u` per pattern. Vertical offsets reined in to fit the FOV cone.

**`fly_over` rewritten as a true diagonal trajectory.** Was a sideways skim at constant altitude (perpendicular sweep with `+22u upPerp`). Now genuinely arcs over: ship spawns **70u behind + 9u above + 12u side** of the title; `dir = -fwdToTitle + lateral·0.32 + downward·0.20` — it descends diagonally over the title's top, exits past the camera on the opposite side. Reads as an actual fly-over, not a strafe.

**`cross_in_front`** now passes at 60% of title-depth (was 55%) with ±2u vertical drift and a 70u sweep — short enough that the brief eclipse moment dominates the pass.

**`weave_near`** uses 75u sweep with closest-approach pre-offset by `-side·3` so the ship genuinely closes on the title from one side, letting the pelican's RCS-thrusters S-curve become the visual story instead of a fast streak.

**Pattern flash readout.** `_spawnPelicanCombat` now calls `_flashHint('spawned: <pattern> · target: <title>')` when it fires, so the admin panel surfaces which trajectory just kicked off — useful for verifying behavior matches expectations.

**Files touched:** `js/marathon-world.js` (`_spawnPelicanCombat` focus-mode branch rewrite + flash readout), `js/helpers.js` (b134 → b135), `FILE_MAP.md`, `CHANGELOG.md`.

## b134 — 2026-05-04 — Text Galaxy: admin panel exposes b133 patterns + follow-cam toggle

User: *"make sure u update admin menu to account for these dude."*

**Per-pattern dogfight buttons.** New `combat-<pattern>` actions for each of the five b133 patterns: across_behind / fly_toward / fly_over / cross_in_front / weave_near. Each calls `_adminTriggerCombat(pattern)`. `_spawnPelicanCombat(pelican, banshee, forcedPattern)` now accepts an optional pattern (validates against the pattern allowlist; falls back to random if invalid). The five buttons are grouped under a new "dogfight pattern (focus a title first)" section so it's clear they target the focused title.

**Focus hint + warning toast.** Section gains a small italic line that reads `target: <title name>` when something is focused, or `(no title focused → patterns will fall back to random pass)` when not. `_adminUpdateHints` is invoked from `_toggleAdmin` (when panel opens), `_focus` (when a title is selected), and `_release` (when focus drops). If the user clicks a pattern button without a focused title, `_flashHint('focus a title first…')` shows a magenta warning bar at the bottom of the panel for 2.4s — but the spawn still runs (with a fallback random direction), so they always get something to look at.

**Follow-cam toggle.** New `[ scenario follow-cam: auto / OFF ]` button. Toggling OFF sets `this._followDisabled = true` — `_spawnPelicanCombat` then skips setting `this._scenarioFollow`, so the camera stays where the user pointed it during scripted action. Useful for screenshots / static framing. Reset-camera button moved into the camera section alongside it.

**Stage section trimmed** — `reset camera` lives under "camera" now; `clear all flybys`, `toggle hue auto-flow`, `bump hue +0.1` remain under "stage".

**CSS.** Added `.mw-admin-hint` (italic small grey under section labels) and `.mw-admin-flash` (slide-in toast bar at panel bottom; `data-level="warn"` swaps to magenta).

**Files touched:** `js/marathon-world.js` (`_buildAdminPanel` HTML + click router rewrite, `_flashHint`, `_adminToggleFollow`, `_adminUpdateHints`, `_spawnPelicanCombat` accepts forcedPattern, `_focus`/`_release`/`_toggleAdmin` refresh hints, `_followDisabled` flag in spawn), `index.html` (`.mw-admin-hint` + `.mw-admin-flash` styles), `js/helpers.js` (b133 → b134), `FILE_MAP.md`, `CHANGELOG.md`.

## b133 — 2026-05-04 — Text Galaxy: scenario follow-cam, focus-aware spawn patterns, pelican RCS thrusters

User: *"when these scripts happen, can our camera follow along if not zoned in on a song. if zoned in on a song, can the script happen behind the text of whatever is being selected, or fly over, in front of, across, towards, etc. very dynamic scenarios... pelican should try to swerve more because it's got side thrusters."*

**Focus-aware spawn patterns.** `_spawnPelicanCombat` now branches on `this.focused`. When a title is focused, it builds an orthonormal basis around the camera→title axis (`fwdToTitle`, `right`, `upPerp`) and picks one of five patterns at random:
- **`across_behind`** — sweep perpendicular to view, ~14u behind the title plane (action passes behind the text).
- **`fly_toward`** — start 220u behind title, dive toward camera with a slight side-tilt so it veers past instead of through.
- **`fly_over`** — perpendicular sweep, ~22u above the title (visibly arcs over the top).
- **`cross_in_front`** — pass between camera and title at ~55% of title distance (briefly eclipses the text).
- **`weave_near`** — tight cross at title's depth with vertical jitter.

Each pattern sets `dir`, `perp1`, `perp2`, and `baseStart` so the existing S-curve / pursuit math just works in the new frame. Pattern name is stored on `scenarioBase.pattern` for future tuning.

**Scenario follow-cam.** When the dogfight spawns and there is no focus, `this._scenarioFollow = { ships: [pelican, banshee] }` is set. Animate loop computes the centroid of active scenario ships every frame and lerps `gaze.yaw/pitch` toward it (`dt·1.6` — slower than the focus-look snap so it feels like a glide). Manual drag (`_onPointerDown`) clears the handle so the user always wins. Follow auto-releases when both ships go inactive (lifetime end or `_adminClearFlybys`).

**Pelican RCS thrusters.** User feedback: pelican felt too lazy. Reworked the steering:
- **Lateral amplitude 24 → 46**, layered as two frequencies (0.95Hz + 1.85Hz, 60/40 split) — punchier waveform, not a single lazy sine.
- **RCS thruster bursts** — every 0.5–0.55s the pelican picks a side and fires a hard `±32u/s² perp1 push for 0.18–0.28s. Reads as actual side-thruster jukes between sustained S-curve motion.
- **Steering response 1.8 → 3.2** — the airframe reacts quickly to thruster commands.
- **Bank coefficient 0.55 → 0.85** + pitch coefficient 0.30 → 0.45 — visible roll into every juke.
- **Panic juke amplitude 14 → 22** during the 8.5–10s window.

Banshee untouched — the user explicitly liked the rolls.

**Lifetime fix.** `pelicanMaxLife` now derives from `Math.max(180, baseStart.length() + 40) * 2 / speed + 1.0` instead of the old hard-coded `spawnRadius`, so focus-aware spawns (which start much closer than 240u) don't time out mid-dogfight.

**Files touched:** `js/marathon-world.js` (`_spawnPelicanCombat` rewrite for focus-mode + lifetime; pelican branch of `_tickScenario` for RCS thrusters; `_scenarioFollow` state + animate-loop track logic; `_onPointerDown` clears follow; `_adminClearFlybys` clears follow), `js/helpers.js` (b132 → b133), `FILE_MAP.md`, `CHANGELOG.md`.

## b132 — 2026-05-04 — Text Galaxy: actual dogfight motion (S-curves, pursuit, weave, banking)

User: *"the ships in scenarios and dog fights go straight forward and don't move around in S or any dog fighting actual scripting."*

**Root cause.** `_tickScenario` only mutated `inner.rotation` (model spin). It never touched `s.velocity`. Combined with `_tickFlyby`'s simple `position.addScaledVector(velocity, dt)` step, both ships flew dead straight forever — the "scenario" was just a pose change.

**Pelican (target — evading):**
- At spawn, store `scenarioBase = { dir, perp1, perp2, speed, seedA, seedB }` — the basis the ship S-curves through.
- Each frame compute desired velocity = `dir·speed + perp1·cos(t·0.65 + seedA)·24 + perp2·cos(t·0.50 + seedB)·14`. Lerp `s.velocity` toward it (`dt·1.8` — heavy/slow steering).
- Brief evasive juke 8.5–10.0s into the scenario (extra `perp1·sin((t-8.5)·4)·14`) — the panicked side-step as the chase peaks.
- `outer.lookAt(position + velocity.normalized())` so the airframe yaws/pitches into its actual travel direction (no more nose-locked-to-spawn-vector).
- `inner.rotation.z = -lateralComp · 0.55` — banking roll proportional to lateral velocity, so it visibly leans into S-curves.

**Banshee (chaser — pursuing):**
- True lead-pursuit: each frame, sample pelican's current world position, project +0.4s of pelican velocity ahead, steer toward that lead point.
- Weave: `perp1·sin(t·1.6)·0.45 + perp2·sin(t·1.1)·0.28` added to the chase direction, but amplitude scaled by `closeness = min(1, dist/60)` — banshee weaves widely from far out, tightens up as it closes the kill.
- Steering response `dt·3.0` (vs pelican's 1.8) — banshee turns hard.
- `outer.lookAt(velocity)` keeps the model nose-on with travel; signature continuous barrel roll preserved on inner.z.

**Net effect.** Pelican carves a slow S-pattern across the camera plane with vertical waves and a panic-juke near the end. Banshee snakes behind it, weaving when far, tightening when close, plasma bolts following its actual aim direction (since fire-direction reads `s.velocity`). Reads as an actual dogfight, not two parallel rails.

**Files touched:** `js/marathon-world.js` (`_spawnPelicanCombat` adds `scenarioBase` to both ships; `_tickScenario` rewrites both branches to steer velocity + lookAt-orient + bank), `js/helpers.js` (b131 → b132), `FILE_MAP.md`, `CHANGELOG.md`.

## b131 — 2026-05-04 — Text Galaxy: admin trigger as real `<button>`, panel impossible to miss

User: *"clicking admin does nothing tho. shouldn't it bring up a panel?"*

**Root cause hypothesis.** The b130 link was `<a href="#" class="tg-admin-link" data-act="admin">[ admin ]</a>`. Even with `e.preventDefault()` + `e.stopPropagation()`, an `<a href="#">` inside a layout that uses `body{position:fixed;inset:0}` can hit edge-case browser paths (history mutation, focus jump). Switched the trigger to a real `<button type="button">` so there is zero default navigation behavior — the click handler is the only thing that runs.

**CSS for `<button>` inside `.tg-nav`** — the prior rules targeted `.tg-nav a`, so the button lost its styling and inherited UA defaults. Added explicit `.tg-nav button.tg-admin-link` rules: transparent background, no border, monospace `font:inherit`, magenta `#ff7ec3` text, white-on-hover with a magenta underline.

**Panel restyled to be impossible to miss.** Moved from `bottom:18px right:18px` (corner, easy to miss against bloom) to `top:80px right:24px` (under the brand lockup, in the user's natural eye path). Border `1px rgba(255,90,180,.40)` → `2px #ff7ec3` solid magenta. Box-shadow gains a subtle pink halo. Z-index 9999 → 99999. Width 260 → 280. Pop-in animation (`mw-admin-pop` keyframes — fade + 8px slide + 0.96 scale → 1.0) when `.on` class is added.

**Diagnostic logs.** `[admin] toggle click` fires from the link handler (so user can see in DevTools whether the click registered). `[admin] panel OPEN/closed` fires from `_toggleAdmin`. If the toggle still doesn't show the panel after this, the console will tell us exactly where the chain breaks.

**Files touched:** `js/marathon-world.js` (`<a>` → `<button>` in HUD, `console.log` in click handler + `_toggleAdmin`), `index.html` (`.tg-nav button.tg-admin-link` styles, `.mw-admin` repositioned + brighter border + pop animation), `js/helpers.js` (b130 → b131), `FILE_MAP.md`, `CHANGELOG.md`.

## b130 — 2026-05-04 — Text Galaxy: visible top-left player + `[ admin ]` HUD button

User: *"wire the top left media player so that it works. admin panel not visible — make an admin button or text."*

**Top-left media player styling.** The wiring already routed prev/play/next/seek through `ctx.onPrev/onNext/onTogglePlay/onSeek` correctly, but the buttons were 21×18px with thin grey borders against a black void — easy to miss/click past. Beefed up `.tg-pp-btn`: padding 5×8 → 8×11, semi-opaque dark backplate (`rgba(0,0,0,.30)`), brighter idle border (`#3a3f48`), 3px corner radius, 13px icons (was 11px), tactile `:active` press. Main play/pause button gets a white border to read as primary. Progress bar 2px → 3px (5px on hover) with rounded ends. Title font 12 → 13, time color lifted (`#5e636e` → `#8a93a3`).

**`[ admin ]` link in the HUD nav.** Added `<a class="tg-admin-link" data-act="admin">[ admin ]</a>` after `[ scenes ]` in the nav strip — magenta-tinted (`#ff7ec3`) so it reads as a debug affordance, not chrome. Click handler in `_buildHud` calls `_toggleAdmin()`. Backquote / `~` shortcut still works.

**Admin panel default state reset to hidden** (`display:none`) — clean default; user opens it via `[ admin ]` or `~`. Position kept at `bottom:18px right:18px` from b129.

**Files touched:** `index.html` (`.tg-pp-btn` / `.tg-player-progress` / `.tg-admin-link` styles), `js/marathon-world.js` (`[ admin ]` link in HTML + click handler; `_buildAdminPanel` initial display:none), `js/helpers.js` (b129 → b130), `FILE_MAP.md`, `CHANGELOG.md`.

## b129 — 2026-05-04 — Text Galaxy: kill bottom miniplayer on `/`, surface admin panel

User: *"pls remove media player at bottom of page also i can't access the admin panel — position it near media player for now."*

**Miniplayer hidden on Text Galaxy.** `renderMiniplayer()` in `index.html` was unconditionally setting `mp.style.display = 'flex'` whenever a track played, which beat the existing `body.mw-on .miniplayer { display:none }` CSS rule via inline-style precedence. Added an early `body.mw-on` check at the top of `renderMiniplayer()` so the bottom strip stays hidden on `/` (Text Galaxy has its own `tg-player` HUD top-left). Other routes (`/tracks`, `/t/<slug>`, etc.) still get the miniplayer.

**Admin panel surfaced.** Was hidden by default with `~` toggle, but the toggle wasn't getting reached. Now visible by default (still toggleable via `~`), repositioned `top:18px right:18px` → `bottom:18px right:18px` so it lives where the miniplayer used to. Border accent switched to magenta (`rgba(255,90,180,.40)`) so it reads as a distinct debug surface, not chrome. Width 240 → 260.

**Files touched:** `index.html` (`renderMiniplayer` early-bail + `.mw-admin` CSS reposition), `js/marathon-world.js` (`_buildAdminPanel` initial state visible), `js/helpers.js` (b128 → b129), `FILE_MAP.md`, `CHANGELOG.md`.

## b128 — 2026-05-04 — Text Galaxy: title color flow + brighter satellites + debug admin panel

User: *"would love for the gradient to kind of move through the colors right now... we have a lot of random orbs floating around I wonder what we can do with that... can you make me an admin panel? click a button and it triggers a scene or it clears it. so we can demo and test."*

**Color flow on titles.** `TITLE_FRAGMENT` now applies a Rodrigues hue rotation around the (1,1,1) luminance axis driven by a per-frame `uHueShift` uniform. A global `_hueShift` advances at 0.045 rev/sec in `animate()` and writes to every title's uniform with a small per-title phase offset (10% of `flickerSeed`) so neighbors don't move in perfect lockstep. The constellation now visibly breathes through the spectrum instead of every section being locked at its tag-bin static color. Auto-flow can be paused or bumped via the admin panel.

**Satellites read more clearly.** The 5 floating gyros are now 8; halo opacity 0.28 → 0.55, halo scale 8 → 14. Body fresnel base alpha 0.18 → 0.32, saturation+lightness pushed (0.78/0.62 → 0.82/0.66). Each satellite gained three nav-light sprites: red port (-x), green starboard (+x), white strobe (top). Port/starboard slow-blink in 1.4s sine cycle (offset 0/0.5 phase), white strobe sharper (0.55s period, ~80ms on-pulse). Reads as actual spacecraft instead of abstract glass jewelry. Mech-fragment shards also brightened (alpha 0.22+0.65fres → 0.34+0.75fres).

**Debug / admin panel (`_buildAdminPanel`).** Hidden floating overlay (top-right), toggled with `~` (or backtick `Backquote`). Ten buttons across three sections:
- *Scripted scenarios:* `▶ pelican vs banshee dogfight` (force-triggers `_spawnPelicanCombat` even if both ships are mid-flight — clears them first).
- *Spawn ship:* longsword (solo), longsword (V-formation), banshee, pelican (no combat), forerunner. Each uses new helper `_adminSpawnType(type, opts)` which mirrors `_spawnFlyby` direction/speed/slot logic but bypasses the random weight roll and the 70% combat-trigger.
- *Stage:* clear all flybys (`_adminClearFlybys` — deactivates every ship, resets pelican hatch/cargo/muzzle state, pushes next auto-spawn 8s out), reset camera (yaw/pitch 0, releases focus), toggle hue auto-flow (freezes/unfreezes the global tick), bump hue +0.10 (one-shot palette nudge for screenshots).

Backquote handler in `_onKey`. Panel cleaned up in `destroy()`. CSS in `index.html` style block (`.mw-admin*` rules — translucent dark sheet, blurred backdrop, monospaced labels, magenta accent on the combat button).

**Files touched:** `js/marathon-world.js` (TITLE_FRAGMENT hueShift helper + uniform; satellite count/halo/nav-lights + tick; shard alpha bump; `_buildAdminPanel`/`_toggleAdmin`/`_adminTriggerCombat`/`_adminSpawnType`/`_adminClearFlybys`/`_adminResetCamera`; `_onKey` backquote toggle; `init` mount + `destroy` cleanup; `_hueShift` tick in `animate`), `index.html` (`.mw-admin*` CSS block), `js/helpers.js` (b127 → b128), `FILE_MAP.md`, `CHANGELOG.md`.

## b127 — 2026-05-04 — Text Galaxy: Pelican redesign + scripted Pelican-vs-Banshee combat scenario

User: *"can we have scripted dogfights? Pelican rear open with Spartans shooting from the back, Banshees chasing it (humans vs aliens)."*

**Pelican redesign (`_makePelican` rewrite).** Boxy rectangle replaced with a proper-silhouette dropship:
- Wide flat fuselage `3.0 × 1.6 × 6.0` (UNSC olive `#424a36`).
- Recessed belly plate (darker shadow).
- Stepped raised cockpit module + slanted forward nose-cap (Pelican's iconic angled snout).
- Cyan windshield strip, slanted forward `-0.40 rad`.
- Stub sweep-back wings carrying the engines on outer ends.
- **Twin underwing engine pods** (Pelican signature — engines hung *beneath* the wings, not on top).
- Lighter intake-ring trim (TorusGeometry) at the front of each pod.
- Vertical tail fin + red/green port/starboard running lights.

**Animated rear hatch (`hatchPivot` group).** Hinged at top-rear of fuselage; rotates around X to swing the hatch panel down. Default closed (`hatchAngle = 0`); scripted scenario opens to ~100° (`Math.PI * 0.55`). Hatch panel has a brass-trim strip on its inside face for visual interest when open.

**Cargo bay interior (`cargo` group).** Hidden when hatch is closed. Contains:
- Dark cargo floor.
- **Three Spartan figures** (small box torso + helmet + cyan visor strip + small rifle), staggered toward the hatch, color-coded green/red/blue armor.
- **Per-Spartan muzzle-flash sprite** at the rifle muzzle position, additive yellow.

**Plasma-bolt pool (`_buildBolts` / `_fireBolt` / `_tickBolts`).** Pool of 24 reusable Sprites with additive-blend tex. `_fireBolt(originPos, targetPos, color, opts)` spawns one with configurable speed/spread/lifetime/scale/opacity. Used by both Spartan rifles (yellow tracers) and Banshee plasma (magenta).

**Scripted scenario: `_spawnPelicanCombat(pelican, banshee)`.** Triggered 70% of the time when a Pelican is chosen for spawn AND a Banshee is free. Pelican leads at slow cruise (~38–50 u/s), Banshee chases ~16 units behind + 2.5 perpendicular at 1.05× Pelican speed (slowly closing). `_tickScenario` runs the per-frame state machine:
- **0–1.5s:** approach, hatch closed.
- **1.5–9.0s:** hatch swings open (`hatchTarget = π·0.55`); cargo becomes visible; Spartans fire staggered muzzle flashes (per-spartan rhythm, period 0.32–0.46s, 50ms flash window); 55% of flashes also spawn a yellow tracer firing OUT the rear of the Pelican (away from velocity direction). Meanwhile Banshee fires magenta plasma bursts (1–2 bolts per burst, every 0.4–0.75s) toward the Pelican with random spread so most bolts whiff.
- **9.0–10.5s:** hatch closes; Spartans stop firing.

Scenario also overrides default rotation (Pelican: gentle wobble; Banshee: continuous barrel roll + weave). Cleanup on lifetime-end resets `hatchAngle`, hides cargo, kills muzzle flashes, clears `scenario`.

**Spawn weight tweak:** Pelican 0.15 → 0.20 so it appears more often (showcases the scenario). Longsword 0.50 → 0.45.

**Files touched:** `js/marathon-world.js` (full Pelican rewrite + cargo/hatch/spartan parts; new `_buildBolts`/`_fireBolt`/`_tickBolts`; new `_spawnPelicanCombat`/`_tickScenario`; flyby tick now defers to scenario logic when active), `js/helpers.js` (b126 → b127), `FILE_MAP.md`, `CHANGELOG.md`.

## b126 — 2026-05-04 — Text Galaxy: FOV 62 → 80, ship spawn rate cranked

User: *"FOV feels like 54, push to 70/80/90. Would love to see ships more often while we code this out."*

- **FOV** `PerspectiveCamera(62, ...)` → `PerspectiveCamera(80, ...)` — wider lens, sphere reads more cinematic, motion + parallax feel more pronounced.
- **First flyby spawn** 8–20s → **3–7s** after page load.
- **Spawn gaps** 12–32s → **5–15s** between waves.
- **Active-spawn check throttle** 1.0s → 0.5s (waves chain in faster after the previous one clears).

**Files touched:** `js/marathon-world.js` (FOV constant, three spawn-timer values), `js/helpers.js` (b125 → b126), `FILE_MAP.md`, `CHANGELOG.md`.

## b125 — 2026-05-04 — Text Galaxy: 4 ship variants with type-specific motion (Longsword / Banshee / Pelican / Forerunner)

User: *"sure, can these other ships not move straight only — Banshee has crazy barrel rolls, Pelican rotates when it flies. Can we have that 3D element?"*

**Four ship factories** in the pool:
- `_makeLongsword()` — Halo dart (existing) — twin cyan flames, banking sin roll on Z.
- `_makeBanshee()` — Covenant fighter — squashed icosa pod, two angled `ShapeGeometry` bat-wings, pinpoint magenta cockpit eye, magenta plasma cone exhaust + matching engine glow. **Continuous barrel roll** (`rotation.z += dt * 4`) plus pitch wave.
- `_makePelican()` — UNSC dropship — 2.6×1.6×5.5 boxy hull, raised cockpit, cyan window strip, stub side wings, top-mounted twin engine pods, vertical tail stabilizer, deeper diesel-blue flame palette. **Lumbering wobble** — slow yaw oscillation `±0.10 rad` + pitch `±0.08 rad`, minimal roll. Slower (42–60 u/s vs 70–105).
- `_makeForerunner()` — geometric ringed orb — central iridescent fresnel-shaded `IcosahedronGeometry`, three concentric `TorusGeometry` rings each with their own fresnel HSL hue offset. **No flames**, **silent drift** (28–42 u/s), inner orb + body slow self-rotation in all axes, each ring spins independently around X/Y at varying rates.

**`_makeFlameTexture(opts)`** parameterized to take a custom gradient `stops` array — banshee passes magenta stops, pelican passes deep navy stops, longsword still uses default cyan.

**Pool:** 2× longsword + 1× banshee + 1× pelican + 1× forerunner. Longswords are the only type that patrols in formation (2–3 ships, 45% of longsword-spawns). Spawn weighted: 50% longsword, 20% banshee, 15% pelican, 15% forerunner.

**Files touched:** `js/marathon-world.js` (replaced single `_makeFlybyShip` with 4 factories + dispatcher; type-specific motion branch in `_tickFlyby`; type-aware spawn logic + per-type speed map; parameterized `_makeFlameTexture`), `js/helpers.js` (b124 → b125), `FILE_MAP.md`, `CHANGELOG.md`.

## b124 — 2026-05-04 — Text Galaxy: flyby orientation fix + patrol formations

User: *"flies in the wrong direction — flies in the direction of the jet and fire."*

**Orientation bug fix.** Three.js `Object3D.lookAt` for non-camera objects calls `Matrix4.lookAt(eye=target, target=position)` (args swapped vs the camera path), aligning local **+Z** toward the target. My model was built with the nose at -Z (camera convention), so the engines (at +Z) were leading. Fixed by setting `inner.rotation.y = Math.PI` on the inner group at build time so the model is rotated 180° around Y — what was at -Z is now effectively at +Z relative to the outer group. Spawn reset preserves the flip via `inner.rotation.set(0, Math.PI, 0)`. Roll continues to use `inner.rotation.z = sin(rollPhase) * 0.18` on top.

**Patrol formations.** `this.flyby` (single-ship) → `this.flybyShips` (pool of 4 instances built by `_makeFlybyShip()`). On each spawn:
- 65% chance solo (1 ship).
- 35% chance group (2–3 ships in V-formation).

Formation slots are offsets in `(perp, -dir, perp2)` basis from a shared lead position:
- `(0, 0, 0)` — lead
- `(+4.5, -2.5, 0)` — right wing (back & to the right)
- `(-4.5, -2.5, 0)` — left wing (back & to the left)
- `(0, -5.0, +1.4)` — trail (further back & slightly above)

All ships in a group share the same `dir` and `speed` so the formation holds shape across the entire pass.

**Spawn scheduler tweak.** Spawns only when no ship is currently active (waves don't interleave); when a wave is in progress, the next-check timestamp is pushed forward by 1.0s instead of triggering a parallel spawn.

**Files touched:** `js/marathon-world.js` (split `_buildFlyby` → `_buildFlyby` + `_makeFlybyShip` factory; pool + formation slot logic in `_spawnFlyby`; per-ship `_tickFlyby`; `inner.rotation.y = Math.PI` orientation fix), `js/helpers.js` (b123 → b124), `FILE_MAP.md`, `CHANGELOG.md`.

## b123 — 2026-05-04 — Text Galaxy: Halo-Longsword-style flyby ship with cyan flame trail

User: *"can we have a cool 3D spaceship fly by inspired by Halo / Marathon / Destiny 2 — large flame behind it, goes from one end to another."*

**`_buildFlyby` / `_spawnFlyby` / `_tickFlyby` / `_makeFlameTexture`.** Single-ship pool. Outer group handles position + velocity orientation (`lookAt`); inner group handles roll so banking doesn't fight the orientation. Composition:
- **Hull:** stretched `OctahedronGeometry(1, 0)` scaled `(1, 0.55, 4)` — angular dart silhouette in light grey `#9aa3ad`.
- **Belly fin:** dark `BoxGeometry(0.3, 0.7, 1.6)` underneath the rear.
- **Wings:** two swept-back `BoxGeometry(2.6, 0.16, 1.2)` panels at ±18° yaw, ±1.7 X offset.
- **Cockpit strip:** dark glass `BoxGeometry(0.8, 0.18, 1.4)` on top of the nose.
- **Engine pods:** two `CylinderGeometry(0.4, 0.4, 1.4)` rotated to lie along Z, mounted at ±0.7 X / -0.2 Y / +2.6 Z.
- **Engine glow:** cyan `Sprite` halos at each pod rear, additive blend.
- **Flame trails:** two `ConeGeometry(0.55, 14, 12, openEnded)` per pod, rotated `π/2` X so apex points backward (+Z); custom canvas-gradient texture (white-cyan-blue-fade) painted bright at the cone base (engine end), additive blend.

**Spawn behavior:** picks a random unit direction `dir` for travel, a random perpendicular for closest-approach offset (50–140 u), starts at `-dir * spawnRadius (240–320)`, velocity `dir * speed (70–105 u/s)`. Ship's `lookAt(start + dir)` aligns nose with velocity. Lifetime `2 * spawnRadius / speed + 0.5s`.

**Tick behavior:** position += velocity·dt; banking roll on inner group (`sin(rollPhase) * 0.18`); flame scale + opacity pulse (12–34 Hz multi-frequency wobble); engine glow opacity pulse. After lifetime, hide + schedule next spawn 12–32s out. First spawn 8–20s after page load.

**Files touched:** `js/marathon-world.js` (added `_buildFlyby`, `_spawnFlyby`, `_tickFlyby`, `_makeFlameTexture`; init + animate wiring), `js/helpers.js` (b122 → b123), `FILE_MAP.md`, `CHANGELOG.md`.

## b122 — 2026-05-04 — Text Galaxy: fragments now blink, glitch off, swap text

User: *"the static numbers and code/text glitches floating — would be cool if they were ever-changing instead of static, reflect weird messages or codes, blink randomly, turn on then glitch off."*

**Per-fragment state machine.** Each of the 70 floating fragments now cycles through `on → glitch_out → off → on (with new text)`:
- **on** (4–14s): steady glow at `baseOp` (~0.18–0.36), low glitch.
- **glitch_out** (0.18–0.43s): stuttering binary flicker (45% chance per frame at `baseOp * 1.4`, else `0.04`), `uHover` cranked to 1.0 → max RGB-split + scanline + dropout in the title shader.
- **off** (0.6–4.6s): invisible, waiting.
- **on**: re-emerges with **new text** swapped in via canvas-texture rebuild (throttled to 1 swap per frame across the whole pool to keep GC sane).

Initial phases are randomized so fragments don't blink in sync.

**Cryptic content pool (`_genFragmentText`).** Pulls from a weighted mix:
- 32% — codes/labels: `ERR_404`, `SIGNAL LOST`, `ACK`, `STDOUT`, `NULL`, `EOF`, `RESET`, `UPLINK`, `SYNC`, `LOCK`, `ECHO`, `STREAM`, `// ack`, `>> rx`, `[ROUTE]`, `/dev/null`, `/sys`, `/proc`, `NO CARRIER`, `RING`, `BUSY`, `kani.exe`, `rolla.bin`, `seg_07`, `frame.04`, glyphs (`◊`, `×`, `※`, `↗`, `⟶`, `⟵`).
- 23% — hex blobs: `0xDEAD`, `0xBEEF`, `0xCAFE`, plus randomly-generated `0x` + 4–6 hex chars.
- 20% — 4-digit numeric codes (`0042`, `9001`).
- 25% — track-title scraps (existing behavior preserved).

**`_swapFragmentText(f)`** rebuilds the canvas texture in place via `_makeTitleTexture(newText, 96)`, swaps the `uTex` uniform, and disposes the old texture.

**Files touched:** `js/marathon-world.js` (added `_genFragmentText`, `_swapFragmentText`, `_tickFragment`; replaced fragment tick block in animate loop; extended fragment objects with `phase`/`nextChange`/`baseOp` state), `js/helpers.js` (b121 → b122), `FILE_MAP.md`, `CHANGELOG.md`.

## b121 — 2026-05-04 — Text Galaxy: faster fly-phase

User: *"the fly-in phase is super slow after new song is selected."* Per-title position lerp rate bumped from `dt * 5` to `dt * 9` when focused. Title pulls in roughly 1.8× faster — fly-phase feels snappy after the look-phase camera rotation completes.

**Files touched:** `js/marathon-world.js` (lerp rate constant), `js/helpers.js` (b120 → b121), `FILE_MAP.md`, `CHANGELOG.md`.

## b120 — 2026-05-04 — Text Galaxy: HUD prev/next now rotates AND zooms (look → fly)

User: *"the camera moves to the new song but doesn't zoom into it."* Look-mode left the title at its constellation slot at radius ~130 — facing it but never close.

**Two-phase HUD focus:** the snap-and-release path in the look-mode gaze lerp now flips `focusMode` from `'look'` to `'fly'` once the gaze reaches the target. The per-title position logic then takes over: the focused title smoothly lerps from `basePos + drift` toward `forward * showcaseDist`, exactly like a click-focus. Camera rotates first (look-phase), then title pulls forward (fly-phase) — same chain in one motion.

**Files touched:** `js/marathon-world.js` (look→fly mode flip in animate-loop snap branch), `js/helpers.js` (b119 → b120), `FILE_MAP.md`, `CHANGELOG.md`.

## b119 — 2026-05-04 — Text Galaxy: HUD prev/next rotates camera to next song's slot (look-mode focus)

User: *"Allow the camera to move to a new song's position instead of bringing that one to wherever the camera is at upon changing it with the buttons."*

**Two focus modes** for `_focus(node, opts)`:
- **`'fly'`** (default — direct title clicks) — title flies to a showcase point in front of the camera, camera stays put.
- **`'look'`** (HUD prev/next) — title stays at its constellation slot, camera *rotates* (yaw/pitch lerp) to face the title.

`_syncFocusToCurrent` now passes `mode: 'look'` so HUD-driven track changes feel like the user "turning to look at" the next song instead of pulling it forward.

**Implementation:**
- `_focus` computes `this._targetYaw = atan2(p.x, -p.z)` and `this._targetPitch = asin(p.y / |p|)` from the title's `basePos` when mode is 'look'. Else clears both targets.
- Animate loop, before computing `forwardVec`, lerps `gaze.yaw/pitch` toward `_targetYaw/_targetPitch` at rate `dt * 3.5`. Yaw uses shortest-path interpolation across the ±π wrap. When within 0.005 rad of target, snaps and clears the targets.
- User dragging during the lerp clears the targets immediately (manual control wins over follow-cam).
- `_release` clears `focusMode` + targets so closing focus doesn't leave a dangling auto-rotation.
- Per-title position logic: `if (isFocus && focusMode === 'fly')` flies to showcase, else (including 'look' focus) stays at basePos + drift.

**Files touched:** `js/marathon-world.js` (focus mode + targetYaw/Pitch state, animate-loop gaze lerp, per-title position branch, `_release` cleanup), `js/helpers.js` (b118 → b119), `FILE_MAP.md`, `CHANGELOG.md`.

## b118 — 2026-05-04 — Text Galaxy: HUD prev/next now sync visual focus to current track

User: *"when I use buttons to move forward to backward, allow that to change to next song or previous song as well"* — meaning the HUD prev/next buttons should switch which title is flown forward, not just advance playback.

**`_focus(node)` → `_focus(node, opts)`** — accepts an optional `{ skipPlay: true }` so the visual focus state can be updated without re-triggering playback (HUD already advanced playback via `ctx.onPrev/onNext`).

**`_syncFocusToCurrent()` (new)** — looks up `ctx.getCurrent()` to find the currently-playing track index, finds the matching title node in `this.titles`, and calls `_focus(node, { skipPlay: true })`. The clicked title flies back to its constellation slot, the new track's title flies forward to the showcase point, focus card + glitch-type animation play.

**HUD prev/next handlers** in `_buildHud()` now invoke `this._syncFocusToCurrent()` after calling `ctx.onPrev?.()` / `ctx.onNext?.()`. Click-and-title-click and HUD-button transport now keep the visual flying-title in lockstep with the audio.

**Files touched:** `js/marathon-world.js` (`_focus` opts, new `_syncFocusToCurrent`, HUD button handler wiring), `js/helpers.js` (b117 → b118), `FILE_MAP.md`, `CHANGELOG.md`.

## b117 — 2026-05-04 — Text Galaxy: Active-Theory rebuild — glass satellites, ringed core, mech-fragment shards

User: *"satellites look like Roblox boxes, planet looks like vibe-coded bullshit, no rotation, scene is bland."* Pulled the Active Theory `ref-gifs/frames/` reference (translucent glass jellyfish, concentric ringed structures, iridescent fresnel surfaces, low-poly shards drifting through dense particles). Rebuilt the three set-piece systems to match.

**Satellites — glass-ring gyroscopes (`_buildSatellites` rewrite).** Each satellite is now:
- Three perpendicular `TorusGeometry` rings (r 1.8/2.4/3.0, tube 0.08–0.10) with a custom **fresnel HSL-cycling shader** — translucent glass with bright iridescent edges, hue-cycling per-ring with offset `(baseHue + j * 0.07)`. `DoubleSide` + `AdditiveBlending`.
- Central iridescent `IcosahedronGeometry` orb (r 0.8) with the same shader.
- Soft halo `Sprite` color-tinted to the satellite's base hue so it always reads as a glowing point at distance.
- **Multi-axis self-rotation:** each ring spins on its own axis at independent rates (0.6–1.7 rad/s), AND the whole group tumbles on all three axes (group-spin x/y/z, ±0.15 rad/s). No more "drag-across, no rotation."

**Core — concentric iridescent rings + glass orb (`_buildCore` rewrite).** Replaced the single wireframe-icosa-plus-glow with:
- Four `TorusGeometry` rings (r 28 / 38 / 50 / 64, tube 0.30–0.55) at randomized initial orientations, each with the fresnel shader at a different `uHueOffset` (0.05 / 0.18 / 0.34 / 0.55), spinning on different axes at different rates (0.07–0.18 rad/s, alternating directions).
- Central high-detail `IcosahedronGeometry(16, 3)` orb with the same iridescent fresnel shader.
- Whole group at `(0, 0, -440)`, scales with bass `1.0 + bass * 0.10`. Reads as a Saturn-meets-gravitational-observatory anchor instead of a vibe-coded sphere.

**Mech-fragment shards (`_buildShards` / `_tickShards` — new).** 32 low-poly geometric shards drifting through the void: `IcosahedronGeometry(1.4)`, `OctahedronGeometry(1.6)`, `TetrahedronGeometry(1.8)`, `ConeGeometry(0.9, 2.6)`, `DodecahedronGeometry(1.2)` cycled by index. Each gets the fresnel HSL shader at a randomized `uHueOffset`, dark glass body (`#0a0f1a`) with bright iridescent edges, multi-axis self-rotation (±0.27 rad/s per axis), and slow positional bob (sin/cos waves around `basePos`, amp 3–9 units, freq 0.08–0.22 Hz). Distributed on a sphere shell at radii 50–270.

**Vivaldi mini-player suppression attempt.** `js/player.js` now clears `navigator.mediaSession.metadata = null` and nulls every standard `setActionHandler` action when the audio element is constructed. **Caveat:** Chromium-family browsers (Vivaldi/Chrome/Edge) typically still show their built-in media UI regardless. To fully kill it: Vivaldi → Settings → Address Bar → uncheck "Show Media Controls".

**Files touched:** `js/marathon-world.js` (full satellite rewrite, full core rewrite, new `_buildShards`/`_tickShards`, init/animate wiring), `js/player.js` (MediaSession suppression), `js/helpers.js` (b116 → b117), `FILE_MAP.md`, `CHANGELOG.md`.

## b116 — 2026-05-04 — Text Galaxy: HUD player restored, calmer rainbow, readable satellites, distant core orb

User feedback after b115: *"restore the top-left HUD — you removed the wrong one. Rainbow gradient too strong, looks like a 360 rainbow spread on the map. Satellites suck — black bodies invisible against dark zones. What else can WebGL do?"*

**1. HUD player restored.** Previous build mistakenly stripped the in-HUD player block when the user only wanted the browser-level mini-player gone. Restored the `.tg-player` div (prev/play/next, title, time, progress) + `_updatePlayer()` + button wiring. The bottom strip from earlier screenshots is Vivaldi's built-in mini-player — still a browser feature we can't reach from JS.

**2. Calmer rainbow.** Hue cycle parameters dialed back so the sky reads as 1–2 cohesive colors at any moment instead of "a 360 of a rainbow spread across the map":
- `baseHue` time multiplier 0.018 → 0.011 (full cycle ~9.5 min, was ~5.5 min).
- `axisAlign * 0.55` → `axisAlign * 0.18` (hue varies ~18% across sphere, was ~55%).
- `n1 * 0.18` → `n1 * 0.06` (less per-fragment hue chaos).
- Wisp/rim hue offsets pulled in (0.08/0.55 → 0.06/0.50). Saturation/lightness slightly lower so colors aren't candy.

Net: the whole sphere reads as a unified palette at any second, but the palette slowly drifts through the spectrum.

**3. Readable satellites.** Bodies that vanished against dark zones now hold their silhouette regardless of background:
- Hull color `0x1c1f26` → `0x9aa4b0` (light grey — visible against any backdrop).
- Body size 3.2×1.6×1.6 → 5.0×2.4×2.4 (1.6× larger).
- Solar panels brighter (`0x102146` → `0x4070c8`) + bigger (5.5 → 8.0).
- Trim strips pumped to `0xa0d8ff` opacity 0.95 (was `0x2a4488` opacity 0.6).
- **Persistent halo Sprite** (always-on, opacity 0.45 base, color-matched to nav-light) so the satellite always reads as a glowing dot even between blinks.
- Orbits closer (radius 260–350 → 150–200) and faster (speed 0.030–0.052 → 0.045–0.075).
- Blinks faster (period 1.3–2.7s → 0.65–1.20s) with slightly wider on-window (18% → 22%).

**4. Distant core orb (`_buildCore` / `_tickCore`).** Set-piece anchor at `(0, 0, -440)` — a wireframe Icosahedron (radius 48, additive blue-white) wrapping a back-faced gradient-glow Sphere (radius 40) with a custom rim shader (cool blue → magenta → teal mix, time-pulsing). Both rotate slowly (`x = t·0.040, y = t·0.065`) and scale with bass (`1.0 + bass·0.18`). Acts as a "galactic landmark" — when you turn that direction you find a focal anchor instead of just void. Audio reactive — pumps on bass.

**Files touched:** `js/marathon-world.js` (HUD player block + wiring + `_updatePlayer` restored, nebula shader hue tame, satellites rebuilt for visibility, new `_buildCore`/`_tickCore` set piece), `js/helpers.js` (b115 → b116), `FILE_MAP.md`, `CHANGELOG.md`.

## b115 — 2026-05-04 — Text Galaxy: rainbow nebula, satellites, click-to-play, brighter streaks, removed HUD player

User: *"only blue and purple — would love to go through a whole rainbow cycle. Cool to see satellites blinking lights every once in a while. Don't see the streak meteors. Click on a song should auto-play it. Remove the bottom media controls."* Five changes.

**1. Rainbow nebula.** Nebula fragment shader now derives color from HSL with a global hue rotation (`baseHue = uTime * 0.018`, full cycle ~5.5 min) plus a directional offset (`+ axisAlign * 0.55 + n1 * 0.18`) so the gradient flows across the sphere through every hue. Three layers — cloud (s=0.62, l=0.28), wisp (hue+0.08, s=0.78, l=0.46), rim (hue+0.55, s=0.55, l=0.40). No more mono-purple — every glance shows a different color zone, and the whole sphere cycles through magenta → pink → orange → yellow → green → teal → blue → violet → back over time.

**2. Satellites (`_buildSatellites`, `_tickSatellites`).** Four small spacecraft on tilted slow orbits at radius 260–350. Each is a `BoxGeometry` hull (3.2×1.6×1.6, dark grey) with two flat solar panels (5.5 wide, dark navy) and emissive trim strips. A blinking nav-light `Sprite` (additive, color-per-sat: red, green, amber, blue) pulses on a 1.3–2.7s period with a sharp 18%-of-cycle ON envelope. Bodies orient toward their motion vector; orbital plane tilt randomized per sat. Visible against the nebula even when small — the blink is what reads.

**3. Click-to-play auto-playback.** `_focus(node)` now calls `this.ctx.onPlay?.(node.index)` immediately on click. Click a title → song starts playing instantly + focus card appears as visual confirmation. No more "click title, then click ▶ play."

**4. Streaks 2× bigger + brighter + more frequent.** Plane size 28×1.6 → 48×4.5 (3× thicker, 1.7× longer). Spawn radius pulled in 200–320 → 130–220 so they're closer to the camera. Texture redrawn at 512×64 with a brighter head + extended trail. Opacity peak 0.85 → 1.00. Spawn cadence 0.9–3.1s → 0.5–1.8s. Vertical alpha falloff sharper (kept thin streak shape).

**5. Removed in-HUD player block.** Per *"remove since we're redesigning the site"* — gutted the `.tg-player` div from `_buildHud()` (transport buttons, title, time, progress bar) and deleted `_updatePlayer()` entirely. Auto-play on click means the only thing the user needs to interact with is the title itself. NOTE: the bottom media-controls strip in the screenshot is Vivaldi's built-in mini-player — that's a browser feature, not on our page; needs to be disabled in browser settings.

**Files touched:** `js/marathon-world.js` (nebula shader rewrite for HSL palette, new `_buildSatellites`/`_tickSatellites`, `_buildStreaks`/`_makeStreakTexture`/`_tickStreaks` rewrite for visibility, `_focus` auto-play, HUD player block + `_updatePlayer` removed), `js/helpers.js` (b114 → b115), `FILE_MAP.md`, `CHANGELOG.md`.

## b114 — 2026-05-04 — Text Galaxy: nebula color gradient + dimmer + ambient streak meteors

User: *"would love a color pulse so it's not all purple — gradient across the skybox. maybe a hint too bright. interested what else u could put around to make it more lively."*

**Nebula color gradient.** Added a slow-orbiting `warmAxis` direction in the fragment shader (`vec3(sin(t*0.025), 0.20*sin(t*0.011), cos(t*0.025))` — orbits roughly once every 4 minutes). Per-fragment `warmth = clamp(dot(viewDir, warmAxis) * 0.5 + 0.5, 0, 1)`. Three palette pairs interpolate by warmth:
- cloud cool `#0a2454` ↔ cloud warm `#4d144d`
- wisp cool  `#0a6285` ↔ wisp warm  `#8f3826`
- rim cool   `#0a426b` ↔ rim warm   `#7a2e42`

When you look toward the warm axis the clouds shift toward grimy magenta/amber/ember; opposite side stays teal/cyan/navy. Whole gradient flows across the sphere over time so the sky keeps changing. Killed the previous mono-purple feel.

**Brightness drop.** Overall `* 0.85` multiplier at end of shader. Bass-react lift dropped 0.35 → 0.25.

**Streak meteors (`_buildStreaks`, `_tickStreaks`).** Pool of 10 elongated additive-blend Plane meshes with a procedural canvas texture (faint tail → bright head, vertical alpha falloff for thin streak shape). Spawn timer fires every 0.9–3.1s: pick a random sphere-shell point at radius 200–320, compute a tangent direction, orient the plane along motion, push it with velocity 70–120 u/s, fade-in/out envelope (lifetime 1.4–2.4s). Discrete eye-catching events instead of continuous noise — feel like passing data packets / shooting stars across the void.

**Files touched:** `js/marathon-world.js` (nebula shader rewrite + streak system + animate-loop tick), `js/helpers.js` (b113 → b114), `FILE_MAP.md`, `CHANGELOG.md`.

## b113 — 2026-05-04 — Text Galaxy: nebula skybox + curl-flow haze (atmosphere)

User: *"how can we make the background space itself feel so much more WebGL crazy beautiful design — things in background always moving so the thing itself has life. like activetheory.com"* The b112 void was empty black behind the catalog. Two layers added.

**Nebula skybox (`_buildNebula`).** A 600-unit radius `SphereGeometry` rendered with `BackSide` + `depthTest:false` + `renderOrder:-10` so it always paints first (behind every other layer). Custom fragment shader does:
- 3D fbm noise (5 octaves) sampled along the per-fragment view direction.
- Three drifting fbm fields with different scales (1.6×, 3.4×, 6.0×) and time directions for layered cloud motion.
- Color palette: deep purple void → grimy magenta nebula heart → cyan rim → ember red dots. All cool/grimy, no candy bloom — Beta Decay-coded per `THEME.md`.
- Mild vertical falloff (slightly more open at horizon, darker overhead/under).
- Bass-react brightness lift (×1.0–1.35).
- Sphere mesh slowly rotates (`rotation.y = t * 0.0035`, `rotation.x = sin(t * 0.012) * 0.10`) so the cloud field slides past the viewer even when they're stationary.

**Curl-flow haze (rewritten `_buildHaze`).** Particle count 1800 → 4500. Distribution flipped from "in front of camera" to a uniform sphere shell around origin (radius 30–350) — visible in every direction now, not just forward. Vertex shader replaces the simple per-particle bob with a faux curl-flow:
```glsl
p.x += sin(position.y * 0.014 + t        + aPhase)        * 4.0;
p.y += cos(position.z * 0.018 + t * 0.8  + aPhase * 0.7)  * 3.0;
p.z += sin(position.x * 0.012 + t * 0.6  + aPhase * 1.3)  * 4.0;
```
Each particle's swirl phase depends on its starting coords, so neighbors orbit coherently — looks like a flow field instead of independent bobs. Particle color shifted slightly cooler/whiter (0.65,0.72,0.95 → 0.72,0.78,1.00) and bass-react opacity (+0.20).

**Files touched:** `js/marathon-world.js` (added `_buildNebula`, rewrote `_buildHaze`, wired both into `init()` + `animate()` uniform ticks), `js/helpers.js` (b112 → b113), `FILE_MAP.md`, `CHANGELOG.md`.

## b112 — 2026-05-04 — Text Galaxy: idle drift, random glitch bursts, tighter size band

User: *"some are still super far away hard to see, also everything's super static — song titles don't feel like they live."* Two issues addressed.

**Tighter size band.**
- Newer width 16→17, font 170→180, opacity 0.85→0.90.
- Archive width 12→14, font 130→140, opacity 0.65→0.78.
- Radius jitter ±7 → ±4 so titles aren't visibly nearer/farther than each other.
- Featured stays width 20 / op 1.00. Featured-to-archive width ratio drops from 1.67× → 1.43×; opacity gap closes from 0.35 → 0.22.

**Idle drift (per-title bobbing).** In `animate()` each non-focused title now has its `targetPos` computed as `basePos + (sin/cos waves)` driven by `t * 0.27..0.42` and offset by the per-title `flickerSeed`. Amplitude ~1.0–1.4 units. Neighbors drift out-of-phase so the constellation breathes instead of sitting frozen.

**Random glitch bursts.** Every ~2–5s the loop picks a random non-focused title and sets `_burstUntil = t + 0.35..0.80`. While in burst window, that title's `uHover` target is 0.55 (vs the normal 1.0 of true hover), so it gets a softer pulse: visible glitch flare, not full hover-bright. There's always a "survivor" flickering somewhere on the sphere.

**Higher idle glitch baseline.** Title fragment shader's idle `gAmt = 0.20 → 0.30`. Means even a not-hovered, not-focused, not-bursting title carries permanent subtle RGB-split + scanline shimmer. Whole sphere always reads as alive type.

**Files touched:** `js/marathon-world.js` (size/opacity tier params, radius jitter, shader idle gAmt, animate-loop drift + burst logic), `js/helpers.js` (b111 → b112), `FILE_MAP.md`, `CHANGELOG.md`.

## b111 — 2026-05-04 — Text Galaxy: full catalog on one shared shell (uniform apparent size)

User: *"some still feel too zoomed in, some feel too far away. I have like 117 songs, when I look around it's like at most 20."* Two real problems with b110:
1. The slice limits (12 + 14 + 32 = 58 of 117 tracks) hid more than half the catalog.
2. Three separate shells (r=95 / 155 / 235) made featured ~2.5× bigger than archive — the "too close / too far" feeling.

**Show every track.** Removed `.slice(0, 12)` / `.slice(0, 14)` / `.slice(0, 32)` limits. All 117 tracks now render.

**One shared shell.** Single radius (`SHELL_RADIUS = 130`, ±14 per-track jitter) for every title regardless of tier. Apparent size is now near-constant across the catalog. Tier varies size + opacity only:
- Featured: width 20, font 220, opacity 1.00
- Newer: width 16, font 170, opacity 0.85
- Archive: width 12, font 130, opacity 0.65

Width range 12–20 (was 10–28 across tiers) — featured is ~1.7× archive, not ~2.7×. Still readable hierarchy, no "swallows the screen" outlier.

**Striped slot assignment.** Each tier's tracks fill evenly-spaced slots in a single fibonacci sphere (`stride = total / tracksInTier`, with linear-probe collision handling). So featured + newer + archive interleave through the sphere — no wedge of the view is all-archive or all-featured. Looking in any direction reveals a mix of tiers and you encounter every track in the catalog by panning around.

**Files touched:** `js/marathon-world.js` (`_buildTitles` rewrite — striped slot assignment + shared shell + uniform size range), `js/helpers.js` (b110 → b111), `FILE_MAP.md`, `CHANGELOG.md`.

## b110 — 2026-05-04 — Text Galaxy: Fibonacci sphere placement (no clusters, no overlaps)

User: *"some are too close to camera, some too far."* The b108 placement was hash-random per tier, so two featured titles could land in nearly the same direction and overlap on screen (e.g. ROLLA + ODST stacking dead-center, filling the screen). The radius range was also wide enough (65–110 for featured) to give big size jumps between titles in the same tier.

**Fibonacci-sphere distribution** — every tier independently spreads its titles across the full sphere using `y = 1 - (i + 0.5)/N * 2` and `theta = i * goldenAngle (~137.5°)`. Guaranteed even angular spacing: zero clusters, zero exact overlaps. Looking in any direction reveals roughly one title from each tier.

**Tighter per-tier params:**
- Featured: width 22–28 (was 32–46), radius 95 ±8 jitter (was 65–110 random).
- Newer: width 15–19 (was 18–26), radius 155 ±14 (was 130–200).
- Archive: width 10–13 (unchanged), radius 235 ±20 (was 210–340).
- Vertical squash 0.78 (was 0.55) — sphere reads more like a true sphere, less like a flat disc, so looking up/down reveals titles instead of empty void.

Per-track hash jitter (small `jY`, `jT`, `jR`) breaks the perfect regularity so the layout doesn't look mechanical, but stays deterministic across reloads.

**Files touched:** `js/marathon-world.js` (rewrote `_buildTitles` placement math), `js/helpers.js` (b109 → b110), `FILE_MAP.md`, `CHANGELOG.md`.

## b109 — 2026-05-04 — Text Galaxy: cockpit lock (no zoom-out, titles fly to camera)

User: *"lock the camera into a position in the center of that 360 and we'll have all our songs wrapped around it."* The previous build let users WASD-fly, scroll-dolly, and pinch-zoom out of the scene — most titles ended up "behind" the drifted camera and the front cone read as a clump.

**Camera locked at origin permanently.** Removed: WASD/arrow flight, scroll-wheel dolly, mobile pinch-zoom, idle lissajous drift, mouse-position parallax sway, and the `_focus()` camera dolly that flew the camera *to* the title. The keyboard handler reduces to one key (Escape → release focus). Touch handler reduces to a single `touchmove` preventDefault call to block iOS pull-to-refresh — drag-look itself rides on top via pointer events.

**Click behavior — option A (title flies to you).** `_focus()` no longer moves the camera. It caches a per-title `showcaseDist` (computed from title width/height + camera FOV + viewport aspect, padded for HUD/card headroom on portrait mobile) and sets `this.focused`. The animate loop's per-title pass now lerps `mesh.position` toward either `forward * showcaseDist` (focused) or `node.basePos` (not focused). Result: clicked title smooth-tweens forward to a fixed showcase point in front of the camera, every other title eases back to its constellation slot. Release: focused title eases back, all titles return to their original spherical positions.

**Cleanup.** Dropped the `keys` Set, `touchState`, `lastInputAt`, `cam.desiredPos`, `cam.desiredLookAt`, `_onKeyUp`, `_onWheel`, `_onTouchStart`, `_onTouchEnd`, `_rightVec` — all dead with the cockpit lock. HUD hint replaced (`drag look · wasd fly · scroll zoom · pinch zoom` → `drag to look around · click a title`) in both the initial render and the post-release reset.

**Files touched:** `js/marathon-world.js` (full input rewrite + animate loop simplification + per-title fly-tween), `js/helpers.js` (b108 → b109), `FILE_MAP.md`, `CHANGELOG.md`.

## b108 — 2026-05-01 — Text Galaxy: media controls in top-left HUD

User asked for media controls (play/pause/next/back) and specified the top-left placement. Wired the existing global audio (`togglePlay`/`playNext`/`playPrev` from `index.html`) to a compact player block inside `.tg-tl`, between the meta line and the nav links.

**Player block** (`.tg-player` inside `.tg-tl`):
- Three thin border-outlined buttons: prev, play/pause, next. SVG icons that swap based on `audio.paused`.
- Track title row (lowercase Space Grotesk) + current/total time (Space Mono, dim).
- 2px hairline progress bar with `:hover` height bump and click-to-seek.
- Constrained to `max-width: 280px` so it stays compact under the nav.

**Wiring:**
- `index.html` boot now passes `onTogglePlay`, `onNext`, `onPrev`, `onSeek`, `getCurrent` into the world's `ctx`. They map to the existing globals (`togglePlay`, `playNext`, `playPrev`, audio seek, `state.current`).
- `_updatePlayer()` runs each animate tick: updates title text, time string, progress fill width, play/pause icon swap. Cheap DOM writes (only when values change visibly).

**Files touched:** `js/marathon-world.js` (HUD HTML + button wiring + `_updatePlayer`), `index.html` (player CSS block + ctx callbacks), `js/helpers.js` (b107 → b108).

## b107 — 2026-05-01 — Text Galaxy: mobile click fix + focus distance fix + atmosphere + socials in HUD

User on iOS PWA reported: tapping a title showed nothing (no focus card, no play options), focus zoomed way too close, no media links anywhere, void felt empty. All four fixed.

**Mobile click fix:**
- `_onPointerDown` now updates `mouse.ndc` and runs `_raycast()` immediately on press. Before, `hovered` was only set by `_onMove` (mousemove) — on mobile there is no hover before touch, so tap-without-drag never resolved which title was under the finger and `_onPointerUp` had nothing to focus.

**Focus distance fix:**
- Old formula used vertical FOV only with a 0.85 fill ratio. On portrait phones (aspect ~0.45) the title plane was wider than horizontal FOV and filled the screen, blocking the focus card.
- New formula computes both axes and takes the max:
  - `horizFovRad = 2 · atan(tan(vertFov/2) · aspect)`
  - `distH = (titleW/2) / tan(horizFovRad/2) / 0.70`
  - `distV = (titleH/2) / tan(vertFov/2) / 0.55`
  - `targetDist = max(distH, distV, 14)`
- Portrait phones now pull back ~3× further on featured titles. Card has room; title is still hero-sized but doesn't fill the entire viewport.

**Atmosphere — two new layers:**
- **Fog patches** — 18 large soft-radial Sprites at varying depths and tints (cool blue, grimy magenta, rust amber, green-gray), additive, low opacity, slow Y-bob. Bass pumps their opacity by +0.20. Gives the void volumetric breath without going full smoke.
- **Floating broken-text fragments** — 70 small Plane meshes at deep distance (r 200–480), each rendering a 2–6-character snippet pulled from random track titles + symbol charset. Same glitch shader as real titles but lower opacity, less bass-reactive, never raycast. Reads as the world "shedding text" — on-brand with the Text Galaxy concept.

**Media links restored to HUD:**
- New `.tg-socials` block in HUD top-right (under the cantmute.me wordmark). Renders all configured socials from `siteConfig.socials` (SoundCloud, Instagram, YouTube, Spotify, email). Filters out template placeholders (`YOUR_SOUNDCLOUD`/`YOUR_INSTAGRAM`).
- Boot now stores `state.socials` and `state.config` from `config.json`; world init receives them via `ctx.socials`.

**Other:** hint text now mentions both desktop and mobile schemes.

**Files touched:** `js/marathon-world.js`, `index.html` (HUD CSS + ctx wiring + state.socials/config), `js/helpers.js` (b106 → b107).

## b106 — 2026-05-01 — Halo Recon: Bruno-Simon-style game on a separate page

User wanted a Bruno-Simon-style interactive browser game, Halo-themed, on its own page. Distinct from the home view (`/`, MarathonWorld) and from `/galaxy.html` (TextGalaxyPro). Both are untouched.

**New entry — `/halo.html`:**
- Self-contained boot identical pattern to galaxy.html: loads `/config.json`, builds `tracks[]` with `isFeatured`/`isNew` flags, owns its own `<audio>` pointed at R2 `audioBase`. Independent of `index.html`'s router.
- Start gate ("DEPLOY") on first paint — clicking requests pointer lock, mouse-look engages, game runs.

**New module — `js/halo-game.js` (`window.HaloGame`):**
- No physics engine in v1. Custom kinematic: gravity + ground + axis-separated AABB collisions vs static obstacle list. Vehicle = arcade speed/steer with friction. Keeps the file self-contained and the deploy a single static push.

**World — UNSC base on a Halo ring:**
- Sky: large inverted sphere with custom gradient shader (top blue → horizon haze → ground tan).
- Distant Halo ring band on horizon (translucent RingGeometry arc).
- Ground: 800×800 sandy plane + faint procedural canvas-texture grid for movement reference.
- 24 procedural rocky ridges placed on a ring around the play area.
- 4 UNSC bunkers (gray boxes + dark roofs + green stripe) with proper Box3 obstacle records.
- 10 random crates (yellow accent stripe) — also obstacles.
- 1 decorative ramp (kept simple, no collision).
- Lighting: directional sun (shadow-mapped, 1024² PCF soft) + hemisphere fill.

**ODST player (third-person):**
- Capsule body + boxy chest + helmet + red visor + magnum mesh.
- WASD move, mouse-look (pointer-locked, sens 0.0028), Shift sprint (5.5 → 9.5 u/s), Space jump (vy=7), gravity 18.
- Movement uses `tryMove` with axis-separated AABB collision — slides along walls instead of stopping cold.
- Map clamp at radius 180 so you can't wander out of the level.
- HP 100 / Shields 100 — Halo CE-style: shield depletes first, recharges 30/s after 3.5s grace; health doesn't recharge.

**Warthog (drivable):**
- Olive chassis + hood + cabin + chrome roll-cage tubes + rear turret (base + barrel) + 4 cylindrical wheels + yellow front-bumper accent.
- Walk within 3.2 units + press E to enter; press E inside to exit (places player beside the hog).
- Arcade physics: throttle accelerates to maxSpeed (18 base / 28 boosted), reverse + brake separate, friction coast. Steering rate scales with speed so you can't pirouette at standstill.
- Wheels spin on `rotation.x` proportional to speed.
- Chase-cam blends vehicle yaw with mouse yaw influence (0.15) so you can glance around without losing the hog's facing.
- LMB while driving = chaingun (raycast, ~14 dmg, 0.08s cd, yellow tracer).

**Combat:**
- Magnum (foot): hit-scan via Raycaster against flattened enemy + fusion-coil meshes. 22 dmg, 0.18s cd, white tracer Line, 0.08s muzzle flash sphere.
- Ammo model: 12-round mag, 60 reserve, R reloads. HUD updates on fire/reload.
- Plasma bolts (enemies): SphereGeometry projectiles at 38 u/s, 14 dmg on contact (within 0.7 lateral / 1.0 vertical of player).

**4 Grunts (Minor orange):**
- Squat boxy body + spherical head + methane back-tank + green plasma-pistol nub.
- State machine: line-of-sight check (raycaster vs obstacle meshes) at <35u → engage (face player, advance if dist > 14, fire every 0.9–1.5s with small inaccuracy). Otherwise patrol random points within ±40u.
- HP 30. Death = ragdoll-flop on X axis + 4s cleanup.

**Fusion coils (4):**
- Red cylinder + 3 torus ribs + yellow warning stripe. Shoot once → explode.
- Blast: scaling sphere fx (1 → 15× over 0.5s) + AOE damage (radius 7, 80 dmg falloff to enemies, 40 dmg to player). Chain-reacts to nearby coils with 80–200ms staggered fuses.

**5 Song pickups (holo-pylons):**
- Cyan vertical beam + base ring + outer ring + canvas-texture floating title label that billboards the camera.
- Sourced from `ctx.tracks` (first 6); arc-placed around the start area.
- Walk within 2.5u + press E → song card overlay opens (track title + year/featured/new), pointer-lock releases. PLAY → calls `ctx.onPlay(index)` which loads R2 audio and plays. CLOSE → reacquires pointer lock and resumes the game. Pylon stays in world but fades.

**HUD (Halo CE feel):**
- Top-center: shield bar (blue gradient, glow inset) over health bar (red→amber gradient).
- Center: small reticle with cross + dot.
- Bottom-right: ammo readout in Space Grotesk.
- Bottom-prompt: contextual `[E]` hint (enter Warthog / play "title").
- Corners: UNSC brand lockup + back-to-home link + control hint strip.
- Death: gate returns with KIA / REDEPLOY → `location.reload()`.

**Files:**
- 🆕 `js/halo-game.js` (~900 lines).
- 🆕 `halo.html` — entry page with scoped CSS (`hg-*` prefix, no collision with `tg-*` or `tgp-*`).
- ✏️ `js/helpers.js` — BUILD_NUMBER → b106.
- ✏️ `CHANGELOG.md`, `FILE_MAP.md`.

**Untouched:** `js/marathon-world.js`, `js/text-galaxy-pro.js`, `index.html`, `galaxy.html`, `scenes/*`. The home view at `/` and the galaxy view at `/galaxy.html` are byte-identical to b105.

**v2 candidates (not in this build):** Phantoms / Banshees with drop-ins; pickup-able weapons (AR, BR, sniper); real Rapier physics for vehicle suspension; minimap; secondary objectives.

## b105 — 2026-05-01 — Text Galaxy Pro: standalone fly-cam page

User loved b104 ("this is fucking awesome") but flagged two gaps: a lot of titles are far away with no way to reach them, and they wanted "a bit of color based on song title or details." User explicitly said don't modify the existing localhost:8000 scene — ship as a separate page/view. Done as a sister scene; b104 `marathon-world.js` is untouched.

**New entry — `/galaxy.html`:**
- Self-contained boot: loads `/config.json`, builds `tracks[]` with `isFeatured`/`isNew` flags from `config.featured` + `config.newReleases`, owns its own `<audio>` element pointed at the same R2 `audioBase`. No dependency on `index.html`'s router.
- Mounts new module `js/text-galaxy-pro.js` (`window.TextGalaxyPro`). Same shader stack as marathon-world (per-title glitch, post-CA + scanlines + vignette, UnrealBloom) so the look matches.

**Navigation (`text-galaxy-pro.js`):**
- **Desktop:** WASD / arrow keys fly along yaw/pitch forward vector; Q & E (or Space) raise/lower; **Shift = 2.6× boost**; pointer drag rotates the camera (yaw/pitch with pitch clamped to ±0.49π); scroll wheel nudges along view direction. Click on a title still focuses + plays.
- **Mobile:** left-half touch becomes a virtual joystick (knob spawns under the finger, capped at 60px = full speed); right-half touch drag rotates the camera; bottom-right `BOOST` button while held applies 2.6× speed. Tap a title to focus.
- **Hard radius clamp** at 420 units so you can't fly off into the void.
- **Velocity model:** `velocity.lerp(desired, dt*6)` — soft accel/decel rather than instant snap, makes WASD feel like flight not teleport.

**Color from content (`tintForTrack`):**
- Catalog tags are empty across the board, so I tier-anchored hue and used a stable title-hash for per-title jitter inside each tier's hue range — gives every title individual color identity without relying on tags.
  - **Featured:** warm band — gold → amber → peach (hue 0.07–0.19, sat .78, lum .78).
  - **Newer:** cool band — teal → cyan → azure (hue 0.46–0.60, sat .72, lum .74).
  - **Archive:** violet/magenta band, slightly muted (hue 0.74–0.88, sat .55, lum .70).
- HSL → RGB feeds the existing `uTint` uniform; bloom turns each title into a colored aura. Featured tracks visibly read warm-forward, archive sits cool-back.

**Jump-to-anywhere list:**
- New full-screen overlay (`Tab` on desktop, "≡ all tracks" button anywhere). Search box filters by title. Each row shows a tier-colored dot matching the title's tint, the lowercase title, and tier/year. Click → camera flies (eased cubic, 0.9s `_flyTo`) to the title and focus card opens. Eliminates the "I can see it but can't reach it" problem entirely.

**Spatial layout change:**
- b104 placed titles in front of camera only (depth = -50…-340). b105 distributes on a sphere shell around the start point: full 360° yaw for newer/archive, ±0.6 rad pitch cone for featured (so they're roughly forward at start). Combined with the fly-cam, this means turning around literally reveals more catalog instead of nothing.

**Files:**
- 🆕 `js/text-galaxy-pro.js` (~720 lines) — the new module.
- 🆕 `galaxy.html` — entry page with scoped CSS (tgp-* prefix, no collision with tg-* in marathon-world).
- ✏️ `js/helpers.js` — BUILD_NUMBER → b105.
- ✏️ `CHANGELOG.md`, `FILE_MAP.md`.

**Untouched:** `js/marathon-world.js`, `index.html`, `scenes/*`. The localhost:8000 view at `/` is byte-for-byte identical to b104.

**Files touched:** `js/marathon-world.js`, `js/helpers.js`, `CHANGELOG.md`.

## b104 — 2026-05-01 — Full pivot to TEXT GALAXY (kills neon rain intersection, drops Marathon HUD ripoff)

User saw the rain intersection: camera was orbiting *through* buildings (violet pillar = inside a wall), bloom was detonating on focus, HUD was too obviously Marathon-derivative. Three failed concepts in a row (rings → tiered rings → neon rain). Stepping back.

**The new concept — TEXT GALAXY:**
- Track titles ARE the world. No buildings, no ground, no rain, no Marathon-style brutalist HUD.
- Each track is rendered as a Canvas2D-textured plane in 3D space, with a custom **glitch shader** running per-title:
  - Block displacement (28 horizontal strips, randomly shifted on x with bass/hover-modulated probability)
  - RGB channel split (CA scales with hover + bass + focus)
  - Scanline modulation
  - Random per-line dropouts (alpha → 0)
  - Per-track tint (12 desaturated cool/warm pairs cycled)
- Tiered: featured (12) = huge close (32–46u wide, depth -50 to -130), recent (14) = mid (18–26u, depth -120 to -210), archive (32) = far/small (10–15u, depth -200 to -340).
- Stratified positioning (sin-hash per track index) so the cloud stays distributed without clumping. Camera lissajous-drifts inside a small bubble at origin — never inside any title.
- Hover → glitch ramps up on that title, lowercase title appears in HUD bottom-right.
- Click → camera dollies to ~85% screen-fill distance from the title plane, other titles fade to 10% opacity, focus card slides up with a **glitch-typing reveal** of the title (random symbols → final letters over 26 frames).
- Subtle haze layer (1800 drift particles, deep depth band) — just enough to feel like air, not competing with text.
- Bass amplifies all glitch + bloom strength.

**HUD pivot — explicitly NOT Marathon:**
- Killed: vertical "CANTMUTE" sidebar lockup, `[ X ]` framed buttons, `[ ◯ ] DRIFT` brackets, lime-on-black brutalist register marks, Marathon-fiction language ("BROADCAST", "SIGNAL", "PROBE").
- New (`.tg-*` classes): clean lowercase Space Grotesk top-left brand ("kani"), small mono meta strip (timecode · 117 tracks · build), three text-link nav (catalog / playlists / scenes). Top-right: simple "cantmute.me" wordmark. Bottom-right: the hovered track name in soft white. Bottom-left: tiny mono hint. Focus card: text-only, anchored bottom-left, lowercase title at clamp(48px, 8.5vw, 132px), under-line buttons, no boxes.

**Post stack** kept but dialed back — bloom strength 0.80 → 1.25 (was 1.45–2.15 in b103, which was detonating). Threshold raised to 0.05. CA in post lowered.

**Files touched:** `js/marathon-world.js` (full rewrite, ~520 lines), `index.html` (full HUD CSS replacement: `.mw-corner/.mw-side/.mw-frame/.mw-focus*` removed, `.tg-*` classes added), `js/helpers.js` (b103 → b104), `CHANGELOG.md`, `FILE_MAP.md`.

## b103 — 2026-05-01 — World becomes the main page: NEON RAIN INTERSECTION (full pivot, kills floating-rings concept)

User saw b102 and called the underlying *concept* slop, not just the polish — and they were right. "Glowing rings in a particle space" is the most overused WebGL trope and we'd been polishing the wrong idea for two builds. Pivoted hard.

**The new scene — Neon Rain Intersection:**
- Wet asphalt ground plane with shader-driven puddle noise + concentric rain ripples + sheen toward the horizon glow.
- A ring of 12 procedural buildings around the camera, dark bodies with per-building emissive **window-grid Canvas2D textures** (random lit windows in warm yellow / pink / amber palettes). Each face the camera-side gets the lit-window plane.
- **All track titles render as neon signs** mounted on the building facades, distributed by tier:
  - Featured (12) → big rooftop billboards
  - New (14) → mid-floor marquees
  - Archive (36) → ground-floor / window decals
  - Each sign is a Canvas2D texture with multi-pass outer glow + inner crisp fill + rim stroke, on an additive-blended plane. Per-track palette cycled (hot pink, cyan, amber, lime, orange, violet, green, red).
- **Heavy rain** — 3500 instanced points falling vertically with shader-side wrap, narrow vertical-streak fragment shader, slight wind drift, additive blend.
- **Atmospheric sky shader** — gradient dome with magenta urban-glow horizon + drifting fbm cloud field.
- **Streetlight halos** — 8 additive radial sprites at building base height, warm amber.
- **Slow orbital camera** drifting around the intersection, audio-modulated lookAt sway, cursor parallax.
- **Sign flicker** — every sign has a unique flicker phase (sin combo + dropouts when a flicker noise crosses a threshold). Hover boosts brightness, focus-locks brighter still.
- **Same post stack** as b102 — bloom (audio-modulated strength), chromatic aberration (audio-modulated intensity), scanlines, grain, shadow cyan-tint, vignette, soft letterbox.

**Routing:**
- `/` now renders the world directly (not the editorial home). `/world` kept as a path alias.
- `/tracks` continues to render the editorial home (the catalog grid). The HUD has a `[ CATALOG ]` link top-left so users always have a way to escape to the grid.
- `body.mw-on` keeps topbar + miniplayer hidden so the experience is fully immersive.

**Killed concept:** floating-rings sphere. The b101/b102 particle space is gone. Modules / shaders / nodes from the old version were rewritten or removed.

**Files touched:** `js/marathon-world.js` (full rewrite, ~640 lines), `index.html` (route handler — `/` now world; new `.mw-nav` CSS), `js/helpers.js` (b102 → b103), `CHANGELOG.md`, `FILE_MAP.md`.

## b102 — 2026-05-01 — World view: full post stack + atmospheric depth + all 117 tracks tiered

User saw b101 and (correctly) called it slop — sparse, no atmosphere, only featured tracks visible, looked like a tutorial. Fixing all of it in one pass.

**What changed:**
- **Post stack added**, the thing I deferred from b101 and shouldn't have. Composer pipeline = `RenderPass → UnrealBloomPass (strength 1.35, radius 0.75, threshold 0.0, audio-modulated) → custom ShaderPass (chromatic aberration, scanlines, film grain, shadow-tint, vignette, soft letterbox bars)`. Bloom strength rides bass amplitude. Chromatic aberration intensifies on bass too.
- **All 117 tracks now render**, not just featured. Tiered by `isFeatured`/`isNew`/archive: featured = closer (r ≈ 38), bigger (size 9), brighter, label always visible; new = mid distance (r ≈ 60), size 5.5, label on hover; archive = far (r 95–155), tiny (size 3), label only on hover. Color shifts cyan → blue → indigo across tiers.
- **Atmospheric sky shader** — inverted sphere with radial gradient: deep indigo zenith, amber rim near horizon, near-black at nadir. Subtle low-freq flicker. Gives the void a sense of depth that pure black never can.
- **Two-layer particle field**: 9000 near-haze (r 30–200) + 4500 far-stars (r 230–460). Up from 4500 single-layer.
- **Better node aesthetic** — halo shader now has noise-modulated rim radius (fragmented portal flicker, not a clean ring) + animated radial spokes + brighter core. Hover boosts to lime accent.
- **Slower, more cinematic camera motion** — wider drift radius, shifting lookAt, idle camera distance pulled back from 80 to 110.
- **`b102`** — `js/helpers.js` build number bumped.

**Files touched:** `js/marathon-world.js` (full rewrite, ~570 lines), `js/helpers.js`, `CHANGELOG.md`, `FILE_MAP.md`.

## b101 — 2026-05-01 — Marathon-style WebGL "World" view, scaffolding (flag route /world)

Scaffolding only. The user wants the entire portfolio to feel activetheory.net-tier, with the existing 2D editorial home + legacy 2D track pages collapsing into one immersive 3D experience over time. b101 puts the architecture in place at `/world` so we can iterate the look without disturbing the editorial home.

**What ships:**
- New ESM module `js/marathon-world.js`. Exposes `window.MarathonWorld = { init(container, ctx), destroy() }`. Imports Three.js via the existing importmap (no bundler).
- Volumetric particle space — 4500 additive-blended particles distributed in a sphere shell around the camera, custom GLSL shader for depth-driven size + alpha, audio-reactive (bass pushes them outward + brightens). Pure procedural, no images.
- Track nodes — featured tracks rendered as glowing halo billboards on a golden-spiral sphere placement, each with a Space-Grotesk caps title sprite below it. Halo shader pulses with bass; hover boosts color to lime accent.
- Camera — slow idle drift + cursor-driven parallax. Click a node → camera dollies to it (lerped position + lookAt) and a brutalist focus card slides in with the cover art as a depth-blurred backdrop (uses existing `findCover()` pipeline). Click anywhere or press Esc → release back to drift.
- Brutalist HUD overlay (DOM, not WebGL) — vertical "CANTMUTE" sidebar lockup in lime (#d8ff2b), mono-spec corner labels (build / track count / running timecode / hover state / hint line), framed `[ X ] EXIT WORLD` and `▷ PLAY` buttons. Set the language; we'll thicken it in b102+.
- Audio analyser piggybacks the editorial hero's `audio.__floorAnalyser` cache so we don't double-create a `MediaElementSource` (browsers throw on the second call).

**Routing:**
- New SPA route `/world` registered inside `index.html`'s router. Render branch detects entry/exit and calls `MarathonWorld.init/destroy`. `<main>` gets a `mw` class and `<body>` gets `mw-on` (hides topbar + miniplayer, kills scroll). On exit, both come back.
- `_redirects` adds `/world  /  200` so Cloudflare serves the SPA shell on direct loads.
- New "World" button in the topbar next to "Explore" — lime-accented to signal flag/preview.

**What does NOT ship in b101 (planned for b102+):**
- Post-processing stack (bloom, chromatic aberration, scanlines, film grain). Currently relying on additive blending + halo shaders alone.
- Full HUD drawer for the catalog (all 117 tracks + scene chooser entry).
- Track page (`/t/<slug>`) collapsing into a deep-linked focus on the corresponding world node.
- Replacing the editorial home — `/world` is opt-in only until the look is dialed.

**Files touched:** `index.html` (route + render branch + topbar entry + HUD CSS + module script tag), `_redirects`, `js/helpers.js` (b100 → b101), `js/marathon-world.js` (NEW), `CHANGELOG.md`, `FILE_MAP.md`.

## b100 — 2026-05-01 — Editorial hero density push: full-screen particle field + atmospheric layers + photo backdrop hook

After looking at activetheory.net's actual source: their `<body>` is empty, all visuals are rendered into a single canvas by a custom WebGL bundle, and their CSS is just font-face declarations + reset (~1.5KB). There's literally nothing to copy from their CSS.

But their `uil.json` scene config confirms the technique: their hero is a layered stack — atmospheric backdrop + ambient particle/foliage + central focus + vignette/grain. We can approximate that **density** in 2D with code-only methods.

**Hero is now a 7-layer stack:**

1. **`.ed-hero-bg`** — multi-stop atmospheric radial gradient (cyan glow at upper-center, warm amber wash at lower-left, cool teal at upper-right) over a dark vertical fade. No image required; reads as ambient depth on its own.
2. **`.ed-hero-photo`** — `/covers/hero.jpg` if present, color-graded heavily (`brightness(.45) saturate(1.3) contrast(1.05) hue-rotate(-8deg)`), `mix-blend-mode: lighten` so it composites with the gradient. **Drop a photo at `covers/hero.jpg` and it auto-fades in on next reload.**
3. **`.ed-particles`** — full-screen canvas, **320 drifting particles** with depth-of-field (close = bigger + dimmer, far = smaller + brighter), 70% cyan-green / 20% white / 10% amber accents, `globalCompositeOperation: 'lighter'` for additive light buildup, `shadowBlur` per particle for natural bloom. Particles drift upward with gentle horizontal sway. Bass amplifies vertical drift speed.
4. **`.ed-ring`** — the existing audio-reactive central ring, scaled down to `min(720px, 80vw)`, opacity 0.85 so the particles read through it.
5. **`.ed-hero-vignette`** — radial darken from edges + top/bottom letterbox darken. Filmic.
6. **`.ed-hero-grain`** — SVG fractal-noise grain overlay at 8% opacity with `mix-blend-mode: overlay`. Every pixel gets a hint of texture.
7. **Hero typography** on top of everything — `clamp(80px, 18vw, 360px)` Space Grotesk Bold, lowercase title, glitch chromatic-aberration on the title via `data-text` pseudo-elements.

**Hero is full-viewport (100vh)** with the title vertically centered. Track list begins below with normal max-width container.

**Particle field details:**
- 320 particles vs 0 before. Heavy textural density, key reason AT looks "alive."
- Depth-of-field via per-particle `size` + `alpha`. Close particles are large + dim; far particles are small + bright. Reads as atmospheric perspective.
- Color tinting: 70% cyan-green hues (160–200°), 20% white (saturation=0), 10% amber accents (30–50°). Same palette family as AT's TreeScene.
- `shadowBlur` does the glow per particle — much cheaper than per-particle radial gradients.
- Drift loop wraps top→bottom + horizontal sway driven by `sin(t * seed)`.
- Audio-reactive: bass increases vertical drift speed, energy modulates pulse.

**Architecture changes:**
- `viewEditorial()` now wraps the hero in `.ed-hero-wrap` (full-bleed via `margin: 0 calc(50% - 50vw)`), with bg/photo/particles/vignette/grain as siblings of `.ed-hero`.
- `startEdRingAnim()` now also initializes 320 particles + drives the second canvas `.ed-particles` in the same RAF loop.
- New helpers: `initEdParticles(W, H)`, `drawEdParticles(ctx, W, H, t, bass, energy)`.
- Hero photo loader: tests `/covers/hero.jpg` via `new Image()` and fades in via `.loaded` class on success. Silent fail if not present.

**Mobile:** hero stays 90vh, ring scales to `min(560px, 90vw)`, particle count unchanged (320 is fine on mobile too — `shadowBlur` is the cheap path).

### Files modified
- [index.html](index.html) — `.ed-hero-wrap` full-bleed wrapper; new `.ed-hero-bg/-photo/-particles/-vignette/-grain` layers; `viewEditorial()` returns the layered stack; particle field draw + photo loader added; ring scaled down.
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b099 → b100`.
- [CHANGELOG.md](CHANGELOG.md) — this entry.
- [FILE_MAP.md](FILE_MAP.md) — hero stack documented.

### To take this further
- **Drop a photo at `covers/hero.jpg`** — single biggest visual upgrade I can't do without a source image. Photo of you, abstract macro, anything cinematic. Auto-fades in on reload.
- Switch typography to NB Architekt clone (paid font; free near-equivalents include Funnel Display, Bricolage Grotesque, or Space Mono).

## b099 — 2026-05-01 — EDITORIAL: scrapped 3D entirely, type-driven design

After 4 attempts (floor / studio / heart / heart-rebuild) to imitate Active Theory's environmental 3D aesthetic, accepted the truth: procedural Three.js can't reach AT's quality. AT has months of custom-modeled assets, hand-painted textures, photogrammetry scans, video-source motion graphics, and a senior art-direction team. Code-only Three.js with `IcosahedronGeometry` and inline shaders will always read as "tech demo" by comparison.

Pivoted to **editorial design** — what code actually does well. Single-page, type-driven, restrained palette, beautiful by **web design** standards (Linear / Vercel / Frank Ocean's blonded / fka twigs sites). All ~110 tracks accessible from one page.

**Layout:**
- **Hero (88vh)**: massive `clamp(72px, 16vw, 300px)` Space Grotesk Bold title — defaults to `"can't mute me."`, swaps to current track title (lowercased + ".") when something plays.
- **Audio-reactive ring** (canvas, 820×820 max) behind the title: jagged outer waveform driven by 32 frequency bins + inner softer ring + radial glow disk + 5 orbiting glints. Cyan-blue tint (#4adeff). Smoothing on bins via AnalyserNode (smoothing 0.85). Bass drives radius pulse + glint scale.
- **Glitch chromatic-aberration** on the title via `data-text` ::before/::after with offset clip-paths in cyan + amber. Subtle, always on.
- **Track list (full-width, all 110 tracks visible)**:
  - 5-column grid: `[NUM] [TITLE huge] [TAG] [YEAR] [PLAY]`
  - Hover row: title brightens, row indents 18px, play button fades in.
  - Currently-playing row: white bold title, white play button, faint background highlight.
  - Tag color: FEATURED = white/black pill, NEW = amber pill, hard/chill/grunge/vibe = bordered tag.
  - Year derived from track date.
- **Cover preview on hover**: 220×220 floating element follows the cursor (CSS-positioned via mousemove). Shows real cover via `findCover()` with procedural-gradient fallback while loading. Hidden on mobile.
- **Filter pills** at the top of the list: ALL / FEATURED / NEW / HARD / CHILL / GRUNGE / VIBE. Current filter pill is white/black, others are outlined. Updates URL when clicking ALL or NEW.

**Architecture changes:**
- **Deleted `js/heart.js`**. No more 3D scene module.
- **Removed `state.mode`** ('floor' / 'studio' / 'heart' / 'list' tracking). Replaced with `state.filter` (the editorial tag filter).
- Routes `/`, `/tracks`, `/tracks/new` all render the same `viewEditorial()` with different default filter values. `/tracks/playlists`, `/t/<slug>`, `/p/<slug>` keep their existing legacy views (functional, used for direct sharing).
- Audio event listeners no longer call `Heart.onPlayStateChange` / `onTrackChange` — they call the lighter `updateEdHeroTitle()` which patches the hero title + sub-line + row playing-state without a full re-render.
- Search input now filters in-place (via `state.query` + `render()`) instead of forcing a route change.
- Importmap and `<script src="/js/heart.js">` removed from `<head>` / `<body>`.

**The audio-reactive ring**:
- Standalone canvas inside the hero, 2D context.
- AnalyserNode cached on the audio element via `audio.__floorAnalyser` (legacy property name preserved for backwards-compat with existing in-flight sessions).
- 60fps draw loop, ~180 polyline points around the ring, additive radial glow gradient on top.
- Idle render = perfect circle baseline + slow phase rotation; with audio = jagged frequency-driven distortion.

**What's deferred:**
- Genuine kinetic typography (text morphing, character-level animation).
- Full search debouncing for live-typing on 110 tracks (currently re-renders the list on every keystroke — fine at this scale).
- Track-detail page (`/t/<slug>`) styling refresh — still uses the legacy template.
- Playlist view editorial treatment.

### Files modified
- **DELETED** [js/heart.js](js/heart.js) — the 3D heart module.
- [index.html](index.html) — removed heart script tag, removed entire `.heart-*` CSS block (~280 lines), removed `state.mode`, added editorial CSS (~190 lines), added `viewEditorial()` + `updateEdHeroTitle()` + `startEdRingAnim()` + `drawEdRing()` + `procArt()` + `ensureEdAnalyser()`, updated `render()` to route home/all/new through `viewEditorial`, simplified search handler, added `app.className = 'editorial'` toggle, added editorial filter-pill / hover-preview wiring in `wire()`.
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b098 → b099`.
- [CHANGELOG.md](CHANGELOG.md) — this entry.
- [FILE_MAP.md](FILE_MAP.md) — heart removed, editorial documented.

## b098 — 2026-05-01 — Heart, biome-density rebuild: foliage + god rays + cooler palette + mobile + tamed bloom

User feedback on b097: heart on a black plane reads "ugly in comp" to Active Theory's hero — theirs is a full BIOME with foreground texture, midground sculptural object, background fog, god rays. Mine had a single object floating in mostly-empty void. Plus the heart center was blowing out white again (b095 problem returning) because shader output exceeded 2.0 and bloom threshold was 0.78.

This rebuild keeps the heart concept but adds the missing biome ingredients.

**Additions:**
- **Foliage particle field** (8000 points). Distributed in a band along the floor (y biased downward, radial 4–28 from heart). Custom shader with: per-particle sway driven by hash-seed noise, depth-fade alpha (volumetric look), audio-reactive size pulse. 80% cyan-green, 15% deep teal, 5% amber-yellow accent dots. This is the single biggest visual change — the void is no longer empty, it's a textural environment.
- **6 god-ray sprites** at irregular ground positions. Tall vertical beams (22 units), cyan-green hue, audio-reactive opacity. Custom-rendered beam texture (vertical gradient × radial mask) so the rays read as light shafts rather than blobs.
- **Foreground-to-background depth layering** — fog density bumped 0.022 → 0.034 so distant foliage fades out like AT's frames.

**Heart sculpture rebuild (3-layer composition):**
- **Outer faceted shell**: low-poly icosphere (subdivisions=1, 42 faces) with `MeshPhysicalMaterial` (transmission 0.75, iridescence 0.85, clearcoat 0.8). Reads as a designed "object" — visible facet edges from the wireframe overlay.
- **Wireframe edges** over the shell — mint-green lines at low opacity. The "designed glass" feel.
- **Middle displacement sphere**: the b097 noisy core shrunk from radius 2.0 to 1.25 and tucked inside the shell. Same fbm noise pattern but **shader values clamped** so output stays under 1.3 (was 2.4+ in b097, which is why the bloom blew out white).
- **Inner glowing core**: small additive-blended emissive sphere (warm amber-yellow → mint-cyan gradient via fresnel). Pulses on bass + on track-change `uPulse` spike.

**Color palette shift:**
- Heart rim color: **#4affc4 mint-cyan** (was #ff5fc4 hot pink). Closer to AT's cool-cinematic tone.
- Inner core: warm amber. Provides a warm contrast point against the cool surroundings — the AT lens look.
- Droplets: hue range remapped to cyan-green-amber band (0.35–0.62) instead of full spectrum. They blend with the biome instead of fighting it.
- Status-pill dot, tooltip border, distressed-title chromatic-aberration shadows: all cyan-green.

**Bloom tamed:**
- Strength **0.28 base / 0.42 max** (was 0.32/0.5).
- Threshold **0.92** (was 0.78). Only the *very* brightest pixels bloom — the inner core highlight and the god-ray peaks. Heart body never blooms.
- Shader output explicit `min(col, vec3(1.3))` ceiling.

**Scroll dolly (subtle, not vortex):**
- Body height = **240vh** (was 100vh — heart was static). scroll progress 0..1 drives `scrollDolly` which compresses camera radius 0..32%. Subtle push-in as you scroll.
- Foliage breath doesn't scale with scroll; only camera dolly does. Small atmospheric reveal.

**Mobile touch support:**
- `touchstart`/`touchmove`/`touchend` handlers on canvas.
- 1-finger drag = orbit (yaw + pitch).
- 2-finger pinch = zoom (radius).
- Tap (no drag movement) = click on hovered droplet.
- `touch-action: none` on canvas + `e.preventDefault()` on touchmove during active drag — so body scroll doesn't fight rotation.
- Fix for b097 mobile breakage where you couldn't rotate or zoom at all.

**Distressed title type:**
- `data-text` attribute drives `::before`/`::after` overlays with offset chromatic-aberration colors (mint + amber) and `clip-path` slices that produce a horizontal-band glitch effect on the headline.
- Pure CSS, no extra fonts.

### Files modified
- [js/heart.js](js/heart.js) — full rewrite (~1100 lines, was ~700). New: foliage field, god rays, 3-layer sculpture, touch handlers, scroll dolly, cooler color palette, tamed shader output.
- [index.html](index.html) — heart CSS updates (no `overflow:hidden`, scroll-spacer support, distressed title pseudo-elements, cyan-green tint on tooltip/status-dot, `touch-action:none` on canvas).
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b097 → b098`.
- [CHANGELOG.md](CHANGELOG.md) — this entry.
- [FILE_MAP.md](FILE_MAP.md) — heart description updated.

## b097 — 2026-05-01 — THE LIQUID HEART: scrapped both the floor and the studio, third try

Third try at the home/featured experience. b095 (floor — tunnel of cards, bloom blowout) and b096 (studio — wireframe console, faders) were both scrapped. User said: "back to the activetheory style, not a floor style ... make it as beautiful as their site ... nothing ugly."

The shift: stop trying to fit 110 songs into a 3D space. Active Theory's hero is just **a void + ONE iconic sculpted form + a handful of floating companions**. Their helix sculpture is two glass loops with an "a" logo — that's it. The void does the heavy lifting.

So this build inverts the previous approach. The 3D experience is **only the front door**, not the catalog browser. Featured tracks orbit a central form; the full catalog (`/tracks`, `/tracks/new`, `/tracks/playlists`) lives in the existing list view via a corner toggle.

**The Heart (centerpiece):**
- High-poly icosphere (subdivisions=5, ~10242 vertices).
- Custom ShaderMaterial:
  - **Vertex:** 2-layer fbm hash-noise drives per-vertex displacement along the normal. Idle breathing (sin) + bass-driven amplitude + a `uPulse` uniform that spikes on track-change and decays.
  - **Fragment:** chromatic Fresnel-based iridescence. Hue cycles with noise + time + mid energy. Treble drives sparse "sparkle" dots. Inner color lerps with mid energy from deep purple (#1a0830) toward pink-magenta. Rim color is hot pink (#ff5fc4).
- Slow auto-rotation, scale-breath, audio-reactive amplification.

**Droplets (~12 featured tracks):**
- `MeshPhysicalMaterial` with `iridescence: 1.0`, `clearcoat: 1.0`, `transmission: 0.35`, `ior: 1.4` — Three.js's native iridescent glass.
- Color hue derived from track title hash (consistent per song).
- Each has its own orbital path (radius 3.6–4.8, speed/phase/tilt all unique-per-track).
- Hover → scale boost + DOM tooltip with title following droplet's screen position.
- Click → camera dollies (smoothing toward focused droplet's vicinity), heart `uPulse` spikes to 1.0, track plays, HUD card slides in.

**Camera:**
- Orbit (drag = rotate, wheel = zoom), smoothed via lerp.
- Subtle auto-drift on idle so framing keeps moving even if user doesn't interact.
- Default pose: yaw=0.55, pitch=0.18, radius=11 — close enough that the heart fills ~40% of screen.

**Atmosphere:**
- 250 dust motes drifting in a spherical shell around the heart, custom shader, additive blending, very low alpha.
- 2 large soft volumetric beam sprites at depth in pink + cyan hues, hue-shift slightly with mid energy.
- 3 colored point lights (pink / cyan / amber) for rim lighting on droplets.
- Far backdrop: inverted gradient sphere (4-stop dark navy → black → deep violet) so the void has subtle depth.
- `FogExp2(#040508, 0.022)` — soft fade.
- Bloom: strength 0.32 base, 0.5 max on bass. Threshold 0.78 (only bright rims bloom). 4× cooler than scrapped b095.

**Sidebar (simplified):**
- Just navigation, NOT a tag filter this time. Three links: `→ all tracks`, `→ new releases`, `→ playlists` plus legacy scenes link in the footer.
- The 3D scene is the front door; deeper browsing is in the flat list.

**Architecture:**
- New `js/heart.js` (~700 lines) exposes `window.Heart = { mount, unmount, onTrackChange, onPlayStateChange, isMounted }`. Pattern same as previous attempts: WebAudio AnalyserNode cached on `<audio>` element so re-mount doesn't throw on `createMediaElementSource`.
- **Deleted `js/floor.js` and `js/studio.js`** — both rejected concepts. Git history preserves them if needed.
- `index.html` `state.mode` 'studio' → 'heart' (older 'floor'/'studio' values upgrade to 'heart' on load).
- All `.studio-*` CSS replaced with `.heart-*`. Sidebar simplified from tag filter to nav links.
- Importmap unchanged.

**What's NOT in this build (deferred):**
- Multiple "scenes" you transition between (Active Theory does forest → industrial → void).
- Custom cursor.
- Loading sequence (current: simple shimmer bar).
- Search results surfaced as droplet filtering.
- Mobile drag/pinch tuning.

### Files modified / created
- **NEW** [js/heart.js](js/heart.js) (~700 lines) — the liquid-heart scene.
- **DELETED** [js/floor.js](js/floor.js) — rejected concept (b095).
- **DELETED** [js/studio.js](js/studio.js) — rejected concept (b096).
- [index.html](index.html) — `<script src="/js/heart.js">`; `state.mode` 'heart'/'list'; CSS `.studio-*` → `.heart-*`; sidebar simplified to nav links; route handler / audio hooks point at `window.Heart`.
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b096 → b097`.
- [CHANGELOG.md](CHANGELOG.md) — this entry.
- [FILE_MAP.md](FILE_MAP.md) — updated.

## b096 — 2026-05-01 — THE STUDIO: scrapped the floor, built a wireframe studio room

Pivot. b095's "floor" (scroll-driven tunnel of overlapping cards) was visually impressive but unusable — bloom strength of 0.85 + 3500 particles + 3 lanes of cards all running through the same depth axis meant you literally couldn't see/click songs by mid-scroll. Got user feedback, ripped it out, rebuilt as a different metaphor: **you're inside Kani's studio**.

**The new metaphor:**
- 3D wireframe room with floor/walls/ceiling-beams (basement.studio aesthetic).
- A mixing console in the center. Every track in the catalog is a fader on its surface — 5 rows × 22 columns = 110 faders, all visible at once.
- Mic on a stand front-of-console, two studio monitors flanking it, 32-bar audio visualizer projected on the back wall.
- The back wall also displays the currently-playing song title in HUGE 3D text.
- Camera is **orbit** (drag to rotate, scroll to zoom), NOT scroll-locked. This was the readability fix — you can see the whole console at once instead of flying through it.

**Per-fader interactivity:**
- Hover → cap scales up + emissive boost + cursor tooltip with title/date.
- Click → that fader drops (animates from "up" position to "pulled-down"), the track plays, the back-wall visualizer fires, the studio monitors pulse with bass, the mic emissive pulses with full-spectrum energy.
- Cap pip color reflects tag: red=hard, green=grunge, mint=chill, purple=vibe, white=featured/default, amber=new.

**Audio reactivity (much more restrained than b095):**
- bloom strength: **0.22 → 0.40** (was 0.85 → 1.35) — 4× cooler so the scene never washes out.
- monitor woofers physically pump on bass.
- Visualizer bars driven by 32 frequency bins with smoothing.
- Cyan rim light + warm key spotlight intensity scale subtly with energy.
- Bass-strong fader pulse is the *only* thing that pops aggressively — it should.

**Architecture:**
- New `js/studio.js` (~860 lines) — fresh module exposing `window.Studio = { mount, unmount, onTrackChange, onPlayStateChange, isMounted }`. Same pattern as floor (analyser cached on audio element so re-mount doesn't blow up MediaElementSource).
- `js/floor.js` is **left in place but no longer referenced** — kept for git-history-free reference / fallback. Will be deleted in a future cleanup.
- `index.html` `state.mode` values changed `'floor' → 'studio'` (the legacy `'floor'` value upgrades to `'studio'` automatically on next load).
- All `.floor-*` CSS replaced with `.studio-*`. Spacer/sticky/chap CSS removed (the scroll-spacer pattern is gone — body is normal-height with `overflow:hidden`).

**Camera state:**
- `yaw, pitch, radius` smoothed via lerp toward `yawT, pitchT, radiusT`.
- Drag = rotate yaw + pitch (clamped pitch -0.05 → 0.95).
- Wheel = zoom radius (clamped 9 → 36, default 19).

**Hover detection:**
- Each fader has an invisible larger hit-target box for easier mouse acquisition.
- Raycaster runs every frame against `faders.map(f => f.hit)`.
- Tooltip is a DOM element positioned by projecting the fader's world position to screen space.

**What's deferred:**
- Tape reels on the back wall (decorative; future click → filter banks).
- Vinyl crate on the floor (future featured-tracks shortcut).
- Patch-cable spaghetti decoration.
- Multiple console "banks" / scrolling along a wider console.
- Mobile touch drag/pinch tuning.
- Search input filtering the desk.

### Files modified / created
- **NEW** [js/studio.js](js/studio.js) (~860 lines) — the studio scene module.
- [index.html](index.html) — `<script src="/js/studio.js">`; `state.mode` 'studio'/'list'; floor CSS replaced with studio CSS (~280 lines); `body.studio-active` class; render() routes home into Studio.mount; audio listeners forward to `Studio.onPlayStateChange` + `Studio.onTrackChange`.
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b095 → b096`.
- [js/floor.js](js/floor.js) — left in tree, no longer referenced.
- [CHANGELOG.md](CHANGELOG.md) — this entry.
- [FILE_MAP.md](FILE_MAP.md) — updated.

## b095 — 2026-05-01 — THE FLOOR: Active-Theory-style 3D scroll-driven landing

Massive direction switch. The home route (`/`) is now a cinematic 3D experience instead of a tracks grid. Every song lives as a floating monolith in a long corridor; scrolling drives the camera through the space; clicking a card plays it and slides in an in-scene HUD card. List view stays available as a toggle for fast browsing.

**Visual:**
- Glass-toroid logo at the hero anchor — two emissive rings + center octahedron prism, audio-pulse on bass.
- ~3500 firefly particles drifting through the corridor with a custom shader (size pulses with energy, color shifts teal→amber on bass).
- 4 large additive god-ray sprites at depth — hue-shift slightly with audio.
- Featured tracks orbit the logo as smaller cards. Every other track becomes a deck monolith arranged in 3 lanes (L / R / staggered C) along z = -25 to -250.
- Per-track card: procedural-gradient face that swaps to the real cover when `/covers/<slug>.jpg` resolves. Title sprite below. NEW/FEATURED corner pip if applicable.
- Scene fog `FogExp2(#05060a, 0.012)`. ACES tone mapping. UnrealBloom (strength 0.85 base, +0.5 on bass, radius 0.65, threshold 0.18).
- Three "chapters" of overlay text cross-fade as you scroll: hero (`can't / mute / me.`), deck (`every track, floating.`), close (`open archive.`).

**Camera:**
- CatmullRom path through 10 waypoints, paired with a separate look-at curve.
- Scroll position 0..1 → arc-length parameter `t` along the curve. Smoothed with `lerp(target, 0.08)`.
- Hand-held drift via `sin(time)` on x/y.
- Click a card → camera dollies toward it; ESC returns to scroll-driven path.

**Interaction:**
- Hover (raycaster vs. card frames) → scale + emissive boost + pointer cursor.
- Click → focus card, plays it (`ctx.playIndex`), slides in HUD.
- HUD has Play/Pause, Open full page (→ `/t/<slug>`), SoundCloud, Esc.
- Sidebar with tag filters (`all / featured / new / hard / chill / grunge / vibe`), Active-Theory style.
- Status pill top-right shows `FLOOR · NNN` (scroll progress 000-999).
- "list view" pill bottom-left/top-left flips back to legacy grid.

**Audio reactivity:**
- WebAudio AnalyserNode (fftSize 256) tapped onto the existing `<audio>` element.
- `energy` (full spectrum avg) and `bassEnergy` (first 8 bins) drive: logo pulse, card emissive on the playing track, particle size, beam hue-shift, bloom strength.
- Analyser graph cached on the audio element (`audioEl.__floorAnalyser`) so re-mounting the floor (after navigating to `/t/<slug>` and back) doesn't try to call `createMediaElementSource` twice — that would throw because an `<audio>` can only ever source one MediaElementSource.

**Architecture:**
- New `js/floor.js` (~770 lines) — self-contained IIFE exposing `window.Floor = { mount, unmount, onTrackChange, onPlayStateChange, isMounted }`.
- `index.html` mounts/unmounts floor in `render()` based on `state.mode === 'floor' && route === 'home'`. Mode persists in `localStorage.kani.mode`. Default on home: `floor`.
- Search input typing flips mode → `list` automatically (search isn't surfaced in 3D yet).
- Importmap added so postprocessing modules can resolve `import { ... } from 'three'` (bare specifiers don't work over plain CDN).
- Three.js, EffectComposer, RenderPass, UnrealBloomPass loaded lazily on first mount.

**What's local-only / not deployed:**
- Per request: ALL changes are on master, **NOT pushed**. User wanted to preview on localhost first before any Vercel/CF deploy.

**What's NOT in this build (deferred):**
- Multi-biome environments (forest → industrial chamber → void) like Active Theory's section transitions.
- Search results surfaced as 3D card filtering.
- Custom cursor (pointer change is the only feedback).
- 3D extruded text geometry — using sprite labels for now.
- Mobile camera path tuning (responsive but not optimized).
- Loading sequence (Active Theory has a choreographed intro before the scene is interactive).

### Files modified / created
- **NEW** [js/floor.js](js/floor.js) (~770 lines) — the 3D scene module.
- [index.html](index.html) — importmap; `<script src="/js/floor.js"></script>`; `state.mode`; floor CSS (~280 lines added); render() routes home into Floor.mount when mode=floor; audio listeners hooked to Floor.onPlayStateChange + Floor.onTrackChange; "3D experience" pill on the list view; search-typing auto-flips to list mode.
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b094 → b095`.
- [CHANGELOG.md](CHANGELOG.md) — this entry.
- [FILE_MAP.md](FILE_MAP.md) — new section, build bump.

## b094 — 2026-04-19 — Fix relative-URL fetches + mobile layout thrash

Direct visits to any non-root URL (e.g. `/t/rolla`) were silently failing because `fetch('config.json')` used a **relative** path — the browser resolved it to `/t/config.json`, which 404'd with an HTML error page, then `.json()` threw `SyntaxError: Unexpected token '<'`. Same bug with `covers/<slug>...`. Both now use absolute paths.

Cover loader also scaled down from 4 extensions × 11 featured tracks = 44 network requests to **just `.jpg`** per slug. Cuts console noise by 75%; drop files as `.jpg` (convert anything else first). Failures cached silently.

Mobile layout rebuilt:
- **Topbar** flows as two rows on phones: [brand+TRACKS, search] then [scrollable nav, Explore pill]. Brand no longer overlaps TRACKS (removed the -16px margin hack, using a `.brand-wrap` flex container with proper gap).
- **Page head** stacks vertically so "N tracks" + Grid/List toggle don't clip.
- **Track detail** hero column collapses cleanly (art becomes full-width, title scales, buttons wrap), no floating misaligned elements.
- **Main padding** tightened on phones.
- **Media-query ordering** fixed: tablet rules (900px) now come before mobile rules (720px) in source so mobile actually wins at narrow viewports.

### Files modified
- [index.html](index.html) — `/config.json` + `/covers/` absolute paths; simplified cover loader to `.jpg` only; `.brand-wrap` markup + CSS; rewritten 720px media query; reordered 900px and 720px blocks
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b093 → b094`
- [CHANGELOG.md](CHANGELOG.md) — this entry

## b093 — 2026-04-19 — Real miniplayer with seek + time, removed fake plays / HOT pill, mobile polish

Fake play counts (hash-derived "476 plays" etc.) removed everywhere: cards, list rows, list-head "Plays" column, track detail meta, track detail stats panel. The HOT pill (which was keyed off those fake numbers) is gone too. FEATURED and NEW pills remain — those are real.

Miniplayer got a real upgrade:
- **Clickable seek bar** across the top — hover to grow, click to scrub
- **Time display** (current / total) in the subtitle line, live-updating
- **SVG icons** for prev / play / pause / next (was text characters)
- **Bigger circular touch targets** (42px standard, 38px on mobile)
- **Safe-area-inset-bottom** padding so iOS home-bar doesn't clip controls
- Play icon swaps to pause icon when playing (was just changing text)

Mobile topbar also reflowed: nav links wrap to their own row and scroll horizontally; search takes full width; Explore pill scales down. Kept the grid responsive as before.

### Files modified
- [index.html](index.html) — removed `fakePlays`, `plays.toLocaleString()` references, HOT pill; new miniplayer markup + CSS + seek/time JS; mobile topbar media query
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b092 → b093`
- [CHANGELOG.md](CHANGELOG.md) — this entry

## b092 — 2026-04-19 — Fix missing audioBase (the actual playback bug)

b091 surfaced the real problem via the new error logging: `state.audioBase` was never populated from `config.json`, so the code fell back to the relative path `audio-mp3/`, which on `/t/rolla` resolved to `https://cantmute.me/t/audio-mp3/rolla.mp3` — a 404. Audio now correctly hits the R2 CDN URL from `config.audioBase`.

Also: fallback path is now `/audio-mp3/` (absolute) instead of `audio-mp3/` so it resolves from site root on any route. Added the modern `mobile-web-app-capable` meta and an inline-SVG favicon to silence console warnings.

### Files modified
- [index.html](index.html) — config loader sets `state.audioBase = cfg.audioBase`; absolute fallback path; mobile-web-app-capable meta + favicon
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b091 → b092`
- [CHANGELOG.md](CHANGELOG.md) — this entry

## b091 — 2026-04-19 — Fix playback on Tracks page

Audio wasn't playing when clicking Play on the Tracks page or individual track pages. Mirrored the pattern from [js/player.js](js/player.js) (the scene app's working audio engine): `audio.crossOrigin = 'anonymous'` must be set **before** any `src` assignment for R2 audio, and set `volume = 0.8`. Added an `error` event listener with a decoded error code (aborted / network / decode / not-supported) and console logging of the exact URL being loaded, so future failures are diagnosable from devtools.

Also: tapping play on the miniplayer with nothing loaded now starts the first track instead of doing nothing.

### Files modified
- [index.html](index.html) — `crossOrigin='anonymous'` before `src`; added `error` listener; console-logs the audio URL on load; toast shows the error kind; `togglePlay` from empty state starts track 0
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b090 → b091`
- [CHANGELOG.md](CHANGELOG.md) — this entry

## b090 — 2026-04-19 — Actually fix the deploy: move scenes into a folder, point rewrites at `/`

b088 and b089 both failed to deploy to Cloudflare Workers with error 10021 — CF's `_redirects` validator rejects **any rule whose destination is a `.html` file** (it auto-strips `.html` and `/index` on its own and considers this a potential loop). The site was never updating because the deploy itself was being rejected.

**Fix:**
1. Moved `scenes.html` → `scenes/index.html`. Now `/scenes` serves that folder's index natively. No rewrite rule needed — CF's directory-index behavior handles it.
2. Rewrote `_redirects` so every target is `/` instead of `/index.html`. Same end result (CF serves root's index.html), but no `.html` in the destination, so the validator is happy.

### Files modified / renamed
- `scenes/index.html` **(renamed from `scenes.html`)** — no content changes, just relocated into a folder so CF serves it natively at `/scenes`
- [_redirects](_redirects) — all tracks-route rewrites now point at `/` (was `/index.html`); `/scenes` + `/scenes/*` rules removed entirely (directory index handles it)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b089 → b090`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — file layout updated

## b089 — 2026-04-19 — Fix redirect loop: rename files so filesystem serves root, no `_redirects` magic for `/`

b088 caused `ERR_TOO_MANY_REDIRECTS` on prod because Cloudflare Workers with `assets.directory` config doesn't handle the `/ → /tracks.html` rewrite the same way Cloudflare Pages would — it was issuing real browser redirects instead of internal rewrites, which then looped.

**Fix:** let the filesystem do the work. Renamed files so `/` serves the Tracks page natively with no rewrite rule at all:

- Old `index.html` (3D scene app) → `scenes.html`
- Old `tracks.html` (music browser) → `index.html`

Now Cloudflare serves `/` as `index.html` by default (standard static-site behavior, no rewrite involved — can't loop). Simplified `_redirects` to only rewrite the clean sub-paths and `/scenes`.

### Files modified / renamed
- `index.html` **(renamed from `tracks.html`)** — now the main landing; route check also recognises `/index.html` as home
- `scenes.html` **(renamed from `index.html`)** — 3D scene app, served at `/scenes`. Unchanged behavior thanks to `<base href="/">` from b088
- [_redirects](_redirects) — dropped `/ → /tracks.html` rule entirely; renamed all targets from `/tracks.html` to `/index.html`, from `/index.html` to `/scenes.html`
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b088 → b089`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — file layout updated

## b088 — 2026-04-19 — Tracks is the main landing; Featured is the default view; 3D scenes moved to /scenes

Swapped the site's primary surface: `cantmute.me` (root) now serves the Tracks browser, landing on the **Featured** view (curated hero + grid). The 3D scene app (Dimensions / Living Wall / Villa / Neural / etc.) moved to `cantmute.me/scenes` — same code, new URL. Tracks top bar gets a prominent **Explore** pill that jumps to `/scenes`; scene app gets a **← Tracks** back link. Added `<base href="/">` to `index.html` so relative asset URLs still resolve correctly when served at `/scenes`.

Restructured the Tracks nav: **Featured** (the new home, `/`) · **All tracks** (`/tracks`) · **New** (`/tracks/new`) · **Playlists** (`/tracks/playlists`). Featured view has a "View all tracks →" button at the bottom.

Also made the featured list self-documenting: `config.json` → `featured` can now be either numeric indices (legacy) or slug/title strings (readable, survives reordering). Same for `newReleases`. Landing page shows a helpful empty-state if `featured` is empty, pointing at the exact config field to edit.

Fixed a bug from b087 where clicking `/scenes` on the Tracks page was swallowed by the internal router and re-rendered home. The click interceptor now only intercepts routes actually handled by `tracks.html`; everything else (e.g. `/scenes`) falls through to the browser so Cloudflare's `_redirects` can serve the right file.

### Files modified
- [_redirects](_redirects) — `/` rewrites to `/tracks.html`; `/scenes` and `/scenes/*` rewrite to `/index.html`
- [tracks.html](tracks.html) — `/` now renders Featured (hero + grid + "View all →"); `/tracks` renders All; nav reordered; Explore pill link to `/scenes`; OG/social meta + `<title>` updated for main landing; click interceptor scoped to tracks routes only; `config.featured`/`newReleases` now accept slugs or indices
- [index.html](index.html) — `<base href="/">`; Tracks link → prominent "← Tracks" back link; `<title>` → "Kani — Scenes"
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b087 → b088`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — route map + featured schema notes

## b087 — 2026-04-19 — SoundCloud-style Tracks page with shareable clean URLs

Standalone Tracks browser at `/tracks` — grid of all 117 songs with unique procedural artwork per track, one hero spotlight at top, uniform squares below. Clean shareable URLs: `/t/<slug>` for a track, `/p/<slug>` for playlists, `/a/<slug>` and `/ep/<slug>` reserved for future albums/EPs. User can build playlists in-browser (localStorage + URL-encoded share links) and jump to the SoundCloud page for any song. Neutral black/white aesthetic distinct from the scene views, Space Grotesk display font, SVG grain overlay, real audio wired to the R2 `audioBase`. Existing scene views (Dimensions/Villa/etc.) untouched; new **Tracks** link in the top bar.

Cover art support: drop `covers/<slug>.jpg|png|webp` files and they replace the procedural gradient automatically. No code change required per track.

### Files modified / added
- [tracks.html](tracks.html) **(NEW)** — full tracks-browser SPA: grid/list views, procedural art, cover-art pipeline, path routing via History API, real audio via `new Audio()`, playlist draft + share URLs, SC deep link per track
- [_redirects](_redirects) **(NEW)** — Cloudflare rewrites: `/t/*`, `/p/*`, `/a/*`, `/ep/*`, `/tracks`, `/tracks/*` → `tracks.html`
- [covers/](covers/) **(NEW)** — cover-art folder with README explaining slug naming convention
- [index.html](index.html) — **Tracks** link added to top bar (between view tabs and theme toggle)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b086 → b087`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — new files documented, build bump

## b086 — 2026-04-13 — Five feel upgrades: mouse trails, ambient glow, swipe nav, entrance, interactive scenes

1. **Mouse trails** — purple/pink particle trail follows cursor across the grid, fades out organically. Spark bursts erupt when hovering tiles. Custom glowing cursor dot replaces default (desktop).
2. **Audio-reactive background** — subtle nebula glow behind the grid pulses with bass/mid when music plays. Two slowly drifting color blobs (purple + indigo) breathe with the audio.
3. **Swipe navigation** — in expanded view on mobile, swipe left/right to change tracks. 60px threshold, direction-locked so vertical scrolls don't trigger it.
4. **Cinematic entrance** — "Kani" logo fades in with blur→sharp→blur animation over 1.5s on first load, then dissolves to reveal the grid. Sets the tone immediately.
5. **Interactive scene clicks** — click/tap anywhere in the expanded scene and triple expanding rings + 12 burst particles erupt from the click point with gravity. Makes people play with the visuals.

### Files modified
- [js/dimensions.js](js/dimensions.js) — all 5 features integrated into init/animate/expand flow
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b085 → b086`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b085 — 2026-04-13 — Light/dark mode toggle

Sun/moon button in the header toggles the app between dark and light backgrounds. Only affects the app chrome (header, grid background, player bar, overlays, text colors) — scene visuals inside tiles stay the same. Preference saved to localStorage.

### Files modified
- [style.css](style.css) — `body.light` CSS variable overrides + component-level light mode styles + `.theme-toggle` button
- [index.html](index.html) — toggle button in header
- [js/app.js](js/app.js) — toggle click handler + localStorage persistence
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b084 → b085`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b084 — 2026-04-13 — SoundCloud link on every song card

Each song's expanded view now shows a "Listen on SoundCloud" button that links to that track on soundcloud.com/kanisongs. The link auto-generates a slug from the track title (e.g. "The Fall (Shift Perceptions)" → `/the-fall-shift-perceptions`). When navigating between tracks with the prev/next arrows, the link updates automatically.

### Files modified
- [js/dimensions.js](js/dimensions.js) — `soundcloudURL()` helper, SoundCloud button in overlay info + CSS, link updates on navigate
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b083 → b084`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b083 — 2026-04-13 — Replace weak scenes + fix mobile tabs

- **Rainy Window → Stargazer** — lone figure silhouette on hilltop, Milky Way band with dense star field + nebula glow, shooting stars, rolling hills, grass tufts
- **Midnight Drive → Jazz Club** — smoky stage with spotlight cone + floor glow, saxophone player silhouette with detailed sax shape, pianist at piano, ambient crowd at candle-lit tables, smoke haze layers, warm amber tones
- **Mobile tabs** — now horizontally scrollable with Dimensions visible first, tabs don't shrink, hidden scrollbar, fits all views

### Files modified
- [js/scenes.js](js/scenes.js) — replaced Rainy Window + Midnight Drive scenes, updated NAMES array
- [style.css](style.css) — mobile tabs: scrollable, left-aligned, no-shrink buttons
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b082 → b083`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b082 — 2026-04-13 — Scene polish: Synthwave sun fix + Aquarium overhaul

- **Synthwave**: sun is now a proper semicircle sitting on the horizon with warm-to-pink gradient, horizontal stripe cutouts that follow the circle's curvature, and a glow halo
- **Aquarium**: complete overhaul — big shark silhouette with dorsal/pectoral fins + gill slits + eye, 4 varied coral types (brain, fan, branching, anemone with swaying tentacles), school of fish with cohesion flocking, jellyfish with tentacles, light shafts, sandy bottom with caustic ripples, glass panel edges

### Files modified
- [js/scenes.js](js/scenes.js) — Synthwave sun + Aquarium rewrite
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b081 → b082`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b081 — 2026-04-13 — Complete scene rewrite: 20 crafted compositions replacing 50 basic ones

Gutted all 50 generic scenes and rewrote from scratch as 20 genuinely crafted visual compositions. Each scene is now a multi-layered environment with detailed silhouettes, atmospheric effects, and real visual storytelling — not just dots and shapes floating around.

**20 new scenes (scenes.js):**
1. **Tokyo Rain** — neon signs with kanji shapes + glow halos, building silhouettes with antennas + AC units, umbrella silhouettes walking, steam from grates, rain streaks, puddle ripples, power lines, wet street reflections of neon
2. **Ocean Abyss** — jellyfish with scalloped bell edges + trailing tentacles, whale silhouette with tail fluke, kelp forest with leaf blobs, bioluminescent particles with glow, light rays from surface, marine snow
3. **Campfire** — 4-layer organic flame shapes, glowing embers rising with light trail, smoke particles with drift, log silhouettes, pine tree silhouettes, stars through canopy, warm light gradient on surroundings
4. **Northern Lights** — 5 flowing aurora curtain ribbons with triple-sine wave motion, pine tree line silhouette, frozen lake with aurora reflection, snow particles, star field
5. **Desert Dunes** — layered sand dunes with ridge shadows, massive moon with craters, camel caravan silhouettes on ridge, dust particles, star field, warm sky gradient
6. **Lightning Storm** — cloud layers, branching lightning bolts (bass-triggered), wind-bent trees with canopy, rain sheets, ground, thunder flash
7. **Snowy Cabin** — pine trees with snow on branches, detailed cabin with roof/chimney, warm window glow with light pool, chimney smoke puffs, dense snow, stars
8. **Beach Sunset** — layered waves with foam on crests, atmospheric sun with scattering, cloud streaks, sun reflection on water, sailboat silhouette, wet sand
9. **Space Nebula** — colored gas cloud nebulas, planet with rings, comet with tail, star field with magnitude variation
10. **Rainy Window** — bokeh city lights behind glass, glass tint, raindrops with running trails + refraction highlights
11. **Forest Dawn** — golden light shafts, fog banks, tree trunks with canopy blobs, deer silhouette with antlers, fireflies with glow, stream
12. **Midnight Drive** — perspective road with scrolling center dashes, passing streetlights with glow, rain on windshield, distant city glow, dashboard ambient
13. **Synthwave** — chrome gradient sun with stripe cutouts, mountain wireframe, scrolling retro grid floor with perspective, palm tree silhouettes with fronds
14. **Underwater Reef** — branching coral formations, fish with tails + eyes + stripes, sea turtle with flippers, light shafts, bubbles with highlights
15. **Volcano** — detailed mountain silhouette with crater, lava flow streaks with glow, rising embers, ash cloud layers, red sky glow
16. **City Rooftop** — detailed skyline with varied buildings + windows, water tower, traffic glow pools, airplane blink, stars
17. **Vinyl Session** — spinning record with grooves + light reflection, warm lamp light beam with dust motes, tonearm, label detail
18. **Aquarium** — glass panel edges, fan coral formations, exotic fish with stripes + tails + eyes, bubbles with highlights, blue ambient light
19. **Cyberpunk** — 3-layer dense city buildings, neon accent lines, holographic ad with scan line, cables between buildings, flying vehicle lights with trails, rain, wet ground reflection
20. **Subway Platform** — perspective tunnel walls with tiles, platform edge yellow line, rails, fluorescent lights with flicker, approaching headlight with glow, sparks on rails

Architecture: scenes extracted to [js/scenes.js](js/scenes.js), dimensions.js delegates to SCENE_DEFS module

### Files modified
- [js/scenes.js](js/scenes.js) — new file, all 20 scene renderers (~800 lines)
- [js/dimensions.js](js/dimensions.js) — gutted 722 lines of old scene code, now delegates to scenes.js
- [index.html](index.html) — added scenes.js script tag
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b080 → b081`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b080 — 2026-04-13 — Fix: expanded view crash on click

Fixed crash when clicking into a dimension scene:
- Race condition: previous `closeExpanded` timeout could null out `expandedTile` while new expansion was running — now properly cancels pending timeouts before opening new overlay
- Null guards in `drawFullScene` prevent draw calls when state is being torn down
- Fixed `createFullParticles` default case that was duplicating particles with malformed properties
- Try-catch wrapper on scenes 20-49 full renderer prevents individual scene errors from killing the whole view

### Files modified
- [js/dimensions.js](js/dimensions.js) — timeout cleanup, null guards, particle factory fix, error boundary
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b079 → b080`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b079 — 2026-04-13 — Dimensions expanded: 50 scene types (was 20)

Expanded from 20 to 50 unique scene types. With 178 tracks, each scene now only repeats ~3-4 times instead of ~9. Added 30 new scenes across multiple categories:

**Cityscapes (20-23):** Rainy Alley, Chinatown, Freeway Overpass, Skatepark
**Nature (24-29):** Volcano, Waterfall, Snowstorm, Meadow, Swamp, Canyon
**Indoor (30-34):** Arcade, Laundromat, Aquarium, Recording Studio, Elevator
**Abstract (35-39):** Lava Lamp, Kaleidoscope, Circuit Board, Pendulum, Fractal Tree
**Atmospheric (40-45):** Fog, Solar Eclipse, Meteor Shower, Tornado, Tidal Pool, Bioluminescent Bay
**Urban (46-49):** Stairwell, Parking Garage, DNA Helix, Construction Site

### Files modified
- [js/dimensions.js](js/dimensions.js) — 30 new scene types (mini + full renderers), SCENE_TYPES 20→50
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b078 → b079`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b078 — 2026-04-13 — Dimensions: player bar visible + prev/next navigation + better scene distribution

Three fixes to Dimensions view:

1. **Player bar stays visible in expanded view** — overlay sits above content but below the player bar (z-index 55 vs player's 60), so you can pause, seek, adjust volume, skip tracks with the regular controls while inside a dimension
2. **Prev/next navigation inside expanded view** — left/right arrow buttons on screen + arrow key shortcuts let you flip through songs without closing. Scene regenerates, title updates, track plays automatically
3. **Better scene type distribution** — replaced simple hash modulo with a seeded Fisher-Yates shuffle. Every block of 20 tracks gets all 20 scene types in a randomized order, guaranteeing even coverage with zero repeats within each block

### Files modified
- [js/dimensions.js](js/dimensions.js) — overlay z-index fix, nav buttons + arrow key handler, navigateExpanded(), shuffled permutation for sceneType()
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b077 → b078`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b077 — 2026-04-13 — Dimensions: merged Living Wall grid + Tape Spine worlds

New default landing view. A breathing tile grid where each track is a tiny portal into one of 20 living dimensions. Click a tile to dive into the full immersive scene at full viewport with audio reactivity. The existing player bar handles all playback controls.

- **Grid of worlds** — each tile runs a mini version of its assigned scene type (neon horizon, city rain, vinyl groove, etc.) at 10fps for performance
- **20 scene types** — same as Tape Spine: abstract (cosmic, crystal, geometric, etc.) + real-world (LA sunset, Tokyo neon, subway tunnel, etc.)
- **Click → full immersion** — tile click plays the track and opens a full-screen overlay with the rich, detailed scene running at 60fps with audio reactivity
- **Scene label on hover** — each tile shows its title + scene type name (e.g. "Neon Horizon", "Beach Midnight")
- **Wall breathing** — tiles gently pulse in/out with sine wave + beat pulse
- **Playing indicator** — green dot + glow on currently playing tile
- **Staggered entrance** — tiles animate in on load
- **Close button + ESC** — exit expanded view
- **Player bar works throughout** — play/pause, seek, volume, next/prev all function normally

### Files modified
- [js/dimensions.js](js/dimensions.js) — new file, full view implementation
- [index.html](index.html) — added Dimensions tab (desktop + mobile), script tag
- [js/app.js](js/app.js) — added `dimensions` subtitle, set as default boot view
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b076 → b077`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b076 — 2026-04-13 — Tape Spine expanded: 20 scene types (abstract + real-world environments)

Expanded from 8 to 20 unique dimension types. Each track now maps to one of 20 scenes, massively reducing repetition across 178 tracks. Added 12 real-world environments alongside the existing abstract ones. All scenes refined for more ambient, organic motion.

**12 new scene types:**
- **City Rain** (8) — building silhouettes with flickering window lights, streetlamp pools, rain streaks, wet street reflections, puddle ripple rings
- **Beach Midnight** (9) — moon with halo, twinkling stars, layered ocean waves, moonlight reflection on water, foam particles, lighthouse with rotating beam
- **LA Sunset** (10) — warm sky gradient, setting sun, haze clouds drifting, palm tree silhouettes with swaying fronds, birds in flight
- **Tokyo Neon** (11) — building facades with flickering neon signs + glow halos, wet street reflections, pedestrian silhouettes, car light trails
- **Desert Highway** (12) — distant mountains, vanishing-point road with scrolling center dashes, heat shimmer, dust particles, cactus silhouettes
- **Underwater Reef** (13) — light shafts, swaying seaweed, coral formations with sway, fish with animated tails
- **Northern Lights** (14) — 5 layered aurora ribbons (sine-wave + audio-reactive), tree line silhouette, falling snow
- **Rainy Window** (15) — blurred bokeh city lights, glass tint, raindrops with running trails + refraction highlights
- **Vinyl Groove** (16) — spinning record with visible grooves + rotating light reflection, label, tonearm with subtle sway, dust motes
- **Forest Canopy** (17) — layered leaf canopy with sway, tree trunks, light shafts filtering through, fireflies with glow, falling leaves
- **Rooftop Night** (18) — city skyline with flickering windows, water tower, distant traffic glow, stars, blinking airplane
- **Subway Tunnel** (19) — perspective tunnel shape, streaking tunnel lights, flickering fluorescents, rail lines, sparks, vanishing point glow

### Files modified
- [js/tape-spine.js](js/tape-spine.js) — full rewrite, 8 → 20 scene types (~1100 lines)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b075 → b076`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b075 — 2026-04-13 — Tape Spine: full-viewport vertical scroll through 8 living dimensions

New view — scroll through your entire discography one track at a time, each occupying the full viewport as a living, multi-layered procedural scene. Scrolling crossfades between dimensions with a glowing tear line + glitch strips at the boundary.

**8 dimension types** (each with 3-5 animated layers):
- **Neon Horizon** — perspective grid floor, neon sun with stripe cutouts, floating wireframe polygons, rising particle trails
- **Deep Ocean** — surface waves, rising bubbles with highlights, caustic light beams, bioluminescent pulsing particles
- **Digital Void** — matrix rain (katakana chars), scan lines, glitch blocks, RGB shift, horizontal interference
- **Cosmic Drift** — galaxy core glow, dual spiral arms, 120 twinkling stars, shooting stars with gradient tails
- **Crystal Cave** — stalactite/stalagmite formations, rotating reflection beams, floating gem particles with glow
- **Electric Storm** — 3 cloud layers, 80 rain streaks, procedural branching lightning bolts, thunder flash
- **Organic Growth** — 6 animated tendrils growing from bottom with tip glow, pulsing cells, floating spores
- **Geometric Void** — distorting grid tessellation, 3D wireframe shapes (cube/octahedron/dodeca) with rotation + perspective projection, floating geometric particles

**Scroll features:**
- Dimensional tear line at scroll boundary with color blending + glitch strips
- Track title + number overlay with fade transitions
- Playing indicator ring pulses with bass
- Nav dot strip on right edge for quick jumping
- Track counter bottom-left
- Click anywhere to play the visible track
- Auto-scrolls to track on external play
- Particle pools cached per page, auto-cleaned

### Files modified
- [js/tape-spine.js](js/tape-spine.js) — new file, entire view implementation (~700 lines)
- [index.html](index.html) — added Tape Spine tab (desktop + mobile), script tag
- [js/app.js](js/app.js) — added `tapespine` subtitle + keyboard shortcut, renumbered shortcuts
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b074 → b075`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b074 — 2026-04-13 — Frequency Map: star constellation view with vibe clustering

New view — your discography as a dark sprawling constellation. Each star is a track, clustered by vibe (rock, indie, rap, feels, space, soul). The map drifts and twinkles. Click a star and it zooms in with an audio-reactive explosion — rings, orbiting particles, radial waveform.

- **Vibe clustering** — tracks auto-classified into 7 clusters by keyword matching, arranged in a circle
- **Constellation lines** — nearby same-cluster stars connected with faint lines
- **Twinkling** — each star has independent brightness oscillation
- **Nebula backgrounds** — soft colored blobs behind clusters
- **Cross sparkle** — bright stars get a four-point sparkle
- **Click → zoom explosion** — camera zooms 4x into clicked star, audio-reactive rings + orbiting particles + radial frequency waveform + central glow
- **Search → beacon** — matching stars glow bright white as beacons
- **Pan + zoom** — drag to pan, scroll to zoom, ESC to unfocus
- **Cluster legend** — color-coded vibe labels in corner
- **Beat pulse** — bass hits pulse all stars simultaneously

### Files modified
- [js/frequency-map.js](js/frequency-map.js) — new file, entire view implementation
- [index.html](index.html) — added Freq Map tab (desktop + mobile), script tag
- [js/app.js](js/app.js) — added `freqmap` subtitle + keyboard shortcut, renumbered shortcuts
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b073 → b074`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b073 — 2026-04-13 — The Organism: living biological discography view

New view — your entire discography as a living biological entity. A pulsing core floats at the center with all 178 tracks arranged in a golden-angle spiral around it, connected by organic tendrils.

- **Pulsing core** — 3 overlapping blobs orbit each other, wobbling membrane ring, radial glow — all bass-reactive
- **Golden-angle spiral** — 178 nodes positioned in a sunflower pattern for organic density
- **Tendrils** — bezier curves from core to each node, wobble with sine waves + audio
- **Veins** — played nodes grow connections to nearby played nodes (evolution)
- **Node interaction** — hover pulls nodes toward cursor, nearby nodes push away (organic feel)
- **Evolution** — each track played adds ambient particles + brightens tendrils + grows vein network
- **Ambient particles** — 80+ particles orbit the core with gentle drift, count grows as you play
- **Zoom + rotate** — scroll to zoom, drag to rotate the whole organism
- **Beat pulse** — bass hits pulse the core and all connected tendrils
- **Playing indicator** — green ring pulse on active node

### Files modified
- [js/organism.js](js/organism.js) — new file, entire view implementation
- [index.html](index.html) — added Organism tab (desktop + mobile), script tag
- [js/app.js](js/app.js) — added `organism` subtitle + keyboard shortcut
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b072 → b073`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b072 — 2026-04-13 — Living Wall 2.0: reactive tile grid view

New default landing view. Each track is a tile with its own mini living canvas running a procedural visual (6 types: waves, particles, rings, bars, spiral, mesh — deterministic per track). The wall breathes with a slow organic scale oscillation across all tiles. Bass hits trigger a global beat pulse. Hover expands a tile; click opens a full-viewport audio-reactive experience for that track.

- **6 visual types** — each tile gets a unique procedural pattern based on track index hash
- **Wall breathing** — tiles oscillate scale in a sine wave offset by grid position
- **Beat pulse** — bass detection drives a global scale burst across all tiles
- **Hover → expand** — tile scales up with glow, label fades in
- **Click → takeover** — full-screen overlay with enlarged audio-reactive visual + track info
- **Search filtering** — tiles hide/show based on search query
- **Playing indicator** — green dot + glow on the currently playing tile
- **Staggered entrance** — tiles animate in on view load
- **Responsive** — 170px tiles desktop, 140px mobile

### Files modified
- [js/living-wall.js](js/living-wall.js) — new file, entire view implementation
- [index.html](index.html) — added Living Wall tab (desktop + mobile), script tag
- [js/app.js](js/app.js) — added `livingwall` subtitle, default boot view, keyboard shortcut
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b071 → b072`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b071 — 2026-04-13 — Add "Time" to track list

- Added `time.mp3` to the tracks array in script.js

### Files modified
- [script.js](script.js) — new track entry
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b070 → b071`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b070 — 2026-04-12 — Dynamic mood cycling: 5 visual modes crossfade in the background

Wall background now cycles through 5 distinct visual moods every ~40 seconds with smooth 8-second crossfades:

- **Cosmic** — slow-rotating galaxy swirl arms (4 radial blobs) + 10 pulsing star cluster glow points
- **Synthwave** — perspective grid below a neon horizon, scrolling horizontal lines (bass-reactive speed), converging verticals, pink/orange sun semicircle + glow band
- **Aurora** — 5 flowing sine-wave color ribbons (green, cyan, purple, pink, teal) with mid-frequency reactive amplitude, gradient fill to transparent
- **Glitch** — flickering color blocks (bass-reactive count, 4 changes/sec via hash), RGB channel tint shift (treble-reactive), scanline corruption flashes
- **Psychedelic** — 16 expanding concentric hue-cycling rings (bass-reactive thickness), 3 slowly rotating spiral arms with independent hue cycling

All moods draw additively (`lighter` or `source-over`) at controlled alpha on top of the permanent nebula base. Two moods are visible simultaneously during crossfade. Each mood responds to audio frequency bands.

### Files modified
- [js/wall.js](js/wall.js) — `drawMoodLayer()`, `drawMood()`, 5 mood draw functions, mood constants, draw loop integration
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b069 → b070`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b069 — 2026-04-12 — Background glow-up: starfield, parallax, shooting stars, bass pulse, grain

Wall view background overhaul — five new layers stacked onto the existing nebula system:

- **Twinkling starfield** — 300 stars (100 mobile) at varying sizes/brightness, sine-wave twinkle cycle, parallax-shifted by depth
- **Mouse parallax** — stars (deepest), nebulas (mid), and glyphs (near) all shift at different rates as the cursor moves, smooth lerp with decay when mouse leaves
- **Shooting stars** — random bright streaks spawn ~every 4.5 seconds from top/right edges, gradient tail, fade in/out over 0.6–1.1s
- **Bass pulse** — subtle purple wash flashes on bass hits (>0.3 threshold, 0.18× scaling)
- **Film grain** — 128×128 offscreen noise texture tiled with overlay blending at 4% opacity, random offset each frame for animated texture (desktop only)

### Files modified
- [js/wall.js](js/wall.js) — `buildStars()`, `buildGrain()`, `drawStars()`, `drawShootingStars()`, `drawGrain()`, parallax in `drawBackground`/`drawGlyphs`, bass pulse, dt tracking in `draw()`
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b068 → b069`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b068 — 2026-04-09 — 15 more hero icons (74 total, 42% of catalog)

New custom creatures for 15 songs:
- **Passion Pit Remix** → `firepit` — fire pit with dancing flames + embers
- **Rock (Full)** → `electricguitar` — red electric guitar with strings + frets
- **Gunning** → `crosshair` — scope/crosshair reticle, slow spin
- **Emo** → `brokencd` — cracked iridescent CD with mascara tear drops
- **Days Get Longer** → `hourglass` — hourglass with trickling sand stream
- **Ohohohohoho** → `laughskull` — skull with dropped jaw, glowing eyes, shaking
- **Jolly Mood Turn Sour** → `sourcandy` — half-pink half-green candy with drip + two faces
- **Louie 003 (Remix)** → `duffel` — designer duffel bag with K monogram
- **Hol' Up Freestyle** → `stophand` — open palm stop hand
- **Moods** → `masks` — comedy/tragedy theater masks, tilting
- **Underrated** → `trophy` — golden trophy with dust particles + star
- **Nice Lil Indie Moonlight** → `crescent` — crescent moon with twinkling stars
- **4-5 Years** → `calendar` — calendar with X'd-off days + peeling corner
- **On Tour Soon** → `tourbus` — black tour bus with purple stripe + KANI
- **Cute (Rolo)** → `candybar` — gold-wrapped Rolo candy bar, partially unwrapped

### Files modified
- [js/wall.js](js/wall.js) — 15 ICON_OVERRIDES entries, 15 draw functions, 15 dispatch cases
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b067 → b068`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b067 — 2026-04-09 — 10 more hero icons (59 total, 33% of catalog)

New custom creatures for 10 songs:
- **Fucking Up His Liver** → `bottle` — tipped liquor bottle with spilling liquid
- **C'est La Vie** → `beret` — French beret with curly mustache
- **Turned Into Taylor Swift** → `sparklymic` — bedazzled microphone with sparkle stars
- **Neopolitan Dreams** → `icecream` — neapolitan ice cream cone (3 scoops + drip)
- **Caught in Thoughts** → `brain` — pink brain with wrinkles + floating thought bubbles
- **Down Down Down** → `anchor` — swaying anchor with flukes
- **No Service** → `nophone` — phone with empty signal bars + red X
- **Kani Demarco's Memoir** → `quill` — feather quill pen with ink trail
- **Clarity** → `diamond` — faceted diamond with glint sparkle
- **Fall Away** → `falleaf` — tumbling autumn leaf with veins

### Files modified
- [js/wall.js](js/wall.js) — 10 ICON_OVERRIDES entries, 10 draw functions, 10 dispatch cases
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b066 → b067`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b066 — 2026-04-09 — 10 more hero icons (49 total, 28% of catalog)

New custom creatures for 10 songs:
- **Dutch** → `bluntwrap` — rolled backwood with lit tip + smoke wisps
- **Amy Winespliff** → `beehive` — Amy Winehouse beehive hairdo with smoke + eyeliner
- **Silo Galaxy** → `galaxy` — spiral galaxy disc with rotating arms + scattered stars
- **Akira World - I'm Next Up** → `akira` — Kaneda's red motorcycle with glowing headlight
- **Chicago Seven** → `riotshield` — blood-splattered riot shield with scratched visor (the trial, the protest, the violence)
- **Chilly Nites** → `snowflake` — crystalline 6-arm snowflake, slow spin
- **May Flowers** → `raincloud` — rain cloud with droplets + tiny flower sprouting below
- **Soul** → `soulfire` — purple/cyan flame wisp with eyes
- **Backyardian** → `treehouse` — treehouse with rope ladder, gentle sway
- **Follow You** → `compass` — compass face with spinning needle

### Files modified
- [js/wall.js](js/wall.js) — 10 ICON_OVERRIDES entries, 10 draw functions, 10 dispatch cases
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b065 → b066`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### How to test
1. Hard refresh `cantmute.me/`
2. Click SHUFFLE a few times until you see the new icons
3. Hover each to confirm it maps to the right song title
4. Check the bluntwrap smoke animates, galaxy spins, compass needle rotates, snowflake drifts

## b065 — 2026-04-09 — Fix shuffle: seeded Fisher-Yates instead of linear page offset

User on b064: *"cycle doesn't actually change or bring any unseen songs to screen"*

**Root cause:** The b062 pagination used a linear offset: `trackIndex = (i + pageIndex * N) % tracks.length`. With 117 creatures and 177 tracks on desktop, page 0 covered tracks 0–116 and page 1 covered tracks 117–176 + **wrapped 57 duplicates back** from tracks 0–56. The user saw mostly the same songs on both pages because 48% of page 1 was duplicates from page 0. On mobile (32 creatures, 6 pages) it worked better but still had wrap issues on the last page.

**Fix:** Replaced the linear offset with a **seeded Fisher-Yates shuffle** of the entire track index array. Each `pageIndex` value produces a completely different permutation via a deterministic LCG PRNG (`seed = pageIndex * 2654435761 + 1`, then standard `(seed * 1664525 + 1013904223) & 0x7fffffff`). Creature `i` picks `trackIndices[i % trackIndices.length]` from the shuffled array.

Now every button press genuinely reshuffles which songs map to which creatures. No duplicates within a single page (unless N > tracks.length, which can't happen — N is capped at 117 and there are 177 tracks). Different hero icons surface on different shuffles because the permutation changes which trackIndices land in the first N slots.

**Also updated:** the button label from `1/N` page counter to `SHUFFLE` (initial) / `#2`, `#3`, etc. (after presses). The old "page X of Y" was misleading since it's a full random permutation now, not linear pages.

### Files modified
- [js/wall.js](js/wall.js) — replaced `pageOffset` linear math with Fisher-Yates shuffle block, updated `updatePageLabel` to show shuffle count, button initial text changed from "NEXT" to "SHUFFLE"
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b064 → b065`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### How to test
1. Hard refresh `cantmute.me/`
2. Hover several creatures and note their titles
3. Click the `↻ SHUFFLE` button
4. Hover the same positions — the titles should be **completely different songs**
5. The hero icons (ODST, Lambo, skull, etc.) should appear in different positions (or not at all if their trackIndex didn't land in the first N slots of this shuffle)
6. Click the button repeatedly — each press gives a genuinely new arrangement, label increments `#2`, `#3`, `#4`...

## b064 — 2026-04-08 — 15 more hero icons (39 total, 22% of catalog)

User: *"more more more more more props or whatever"*

15 more: Take Me Home (house), Real Love (pulsing heart), Spotlight (swaying spotlight on tripod), Final Chapter (purple book), Wired (glowing lightning bolt), Stop Light (cycling traffic light), Wind Blows (windmill w/ rotating blades), I Will Survive (pumping fist), Shroomy (cute red mushroom w/ spots), Runaway (cyan sneaker w/ swoosh), Shoebox (orange box w/ lid + tissue), Two of Us (two drifting hearts), Car Mixtape (spinning vinyl disc), Emo Rock (guitar pick w/ bolt + "EMO"), Formidable (golden crown w/ jewels).

Total override count: **39** (3 + 9 + 12 + 15). ~22% of the 177-track catalog now has custom hero art. wall.js is ~4,080 lines.

## b063 — 2026-04-08 — 12 more hero icons (resumes the b061 batch)

User on b062: *"yes"* to resuming the 12-icon batch I'd paused to ship the pagination fix. Picking it back up.

### New icon overrides

| Title match | Type | What it draws |
|---|---|---|
| `thunderbird` | `thunderbird` | Indigo bird w/ angular flapping wings + yellow beak + yellow lightning bolts trailing both wings |
| `best day ever` | `sun` | Yellow sun w/ 12 rotating triangle rays + cream inner glow + cartoon eyes + smile + magenta dab tongue |
| `warzone` | `grenade` | Pineapple-style green grenade w/ ridged grid + steel neck + curved safety lever + pulsing red pin ring |
| `streets` | `boombox` | Retro 80s boombox — handle, two big pulsing speakers, antenna, center tape deck w/ reels, 4-color button row |
| `lemonade` | `lemon` | Bright yellow lemon w/ pointy ends + skin texture dots + white sheen highlight + green leaf w/ vein |
| `beachouse` | `beachhut` | Wood plank hut w/ thatched triangle roof + cyan window + pink sand mound + leaning palm w/ swaying fronds |
| `sickboi` | `skull` | Cute pixel skull w/ glowing magenta eye sockets that pulse + nose triangle + 5-tooth grid mouth |
| `10 miles` | `roadsign` | Yellow diamond highway sign on a post w/ "10 MILES" text + arrow underneath |
| `money ain` | `cashstack` | Stack of 5 layered green dollar bills w/ wobble + top bill detail w/ $ sign + portrait oval + corner numbers |
| `birthday` | `cake` | 3-layer cake (pink/cream/cyan) w/ frosting drips + sprinkles + 3 red candles w/ flickering yellow flames + plate |
| `wallet` | `wallet` | Brown leather bifold w/ stitching + center fold + green cash sticking out top w/ $ sign + cyan card peeking + "K" embossed circle |
| `lotus` | `lotusflower` | 3-layer pink lotus — 5 outer petals + 5 mid petals + 3 inner white petals + yellow stamen w/ rotating dot ring |

### How it landed
Same recipe as b060/b061: 12 entries appended to `ICON_OVERRIDES`, 12 new drawer functions inserted after `drawVillainmask`, 12 dispatch cases added to the `drawCreature` switch, 12 entries added to the `noRot` list (all stay upright).

Each drawer is ~50–95 lines of canvas paths with character-appropriate animation: thunderbird wings flap, sun rays rotate, grenade pin pulses red, boombox cones pump, lemon stays static, palm fronds sway on the beach hut, skull eye sockets glow, candle flames flicker, wallet wobbles, lotus stamen dots rotate.

### Total override count is now 24 hero icons
b060: 3 (ODST, Rolla, Pillowcase)
b061: 9 (Spaceship, Hotelsign, Coffeecup, Robot, Discoball, Mariostar, Chainlink, Wonkysmile, Villainmask)
b063: 12 (Thunderbird, Sun, Grenade, Boombox, Lemon, Beachhut, Skull, Roadsign, Cashstack, Cake, Wallet, Lotus)

That covers about **14% of the 177-track catalog** with custom hero art. Combined with b062 pagination, every special icon is reachable by cycling pages with the ↻ button.

### Files modified
- [js/wall.js](js/wall.js) — 12 ICON_OVERRIDES entries, 12 new drawer functions, 12 dispatch cases, 12 noRot entries. ~900 lines net added. File is now ~3,530 lines.
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b062 → b063`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### How to test
1. Hard refresh `cantmute.me/`
2. Tap the ↻ button to cycle pages and find each new icon:
   - `Thunderbird` → indigo bird w/ lightning trailing
   - `Best Day Ever (Clarity)` → smiley sun
   - `Warzone` → pineapple grenade
   - `Streets` → 80s boombox
   - `Lemonade` → yellow lemon
   - `Beachouse` → beach hut w/ palm
   - `Sickboi` → glowing skull
   - `10 Miles` → diamond road sign
   - `Money Ain't a Thing` → cash stack
   - `Birthday Freestyle` → birthday cake
   - `Wallet` → bifold wallet
   - `Lotus (Try to Breathe)` → pink lotus
3. Click any of them → that song plays.

### Potential next round
If you want even more, candidates: "Take Me Home" (house), "Real Love" (heart), "Spotlight" (spotlight cone), "Indie Time" (clock), "Final Chapter" (book), "Two of Us" (paired silhouettes), "I Will Survive" (raised fist), "Wired" (lightning bolt), "Greatest Consequences" (gavel), "Stop Light" (traffic light), "Wind Blows" (windmill / leaf), "Convinced" (raised hand). Tell me which.

## b062 — 2026-04-08 — Wall pagination so all 177 tracks are reachable on mobile

User on b061: *"on mobile, ill only ever seen like 15 songs. i dont wanna see all 177 or do i? idk. but i wanna see more or be able to cycle more than just the 15 i see yknow"*

The b058 mobile cap (`MIN_CREATURES_MOBILE = 30`) was working as designed — but combined with poisson `minDist=56` on a small canvas it was actually placing closer to 15 creatures, AND every creature got its `trackIndex = i % tracks.length` so the SAME 15 tracks were the only ones reachable. The other 162 tracks had no creature on the wall ever.

This was a bug, not a perf concern. The user was essentially staring at a 15-song subset of his catalog. (Mid-task on the 12-icon batch I'd started — paused to ship this fix first because it's a correctness issue, not a polish issue.)

### Fix: pagination

[js/wall.js](js/wall.js) gained a `pageIndex` module-level state variable + a floating "↻ NEXT/page" button bottom-right of the canvas.

**`buildCreatures` math:**
```js
const pageSize = N;                                       // creature count for this device
const totalPages = max(1, ceil(tracks.length / pageSize));
pageIndex = ((pageIndex % totalPages) + totalPages) % totalPages;
const pageOffset = pageIndex * pageSize;
// ...
const trackIndex = (i + pageOffset) % tracks.length;       // was: i % tracks.length
```

So with 30 creatures + 177 tracks:
- Page 0 → tracks 0..29
- Page 1 → tracks 30..59
- Page 2 → tracks 60..89
- Page 3 → tracks 90..119
- Page 4 → tracks 120..149
- Page 5 → tracks 150..176 + wrap

Six button presses cycles through every track in the catalog. On desktop with 117 creatures, only 2 pages cover the whole catalog.

The page index is wrapped via `((x % n) + n) % n` so it can never go out of bounds. Resizing across the mobile/desktop boundary recomputes `pageSize` and `totalPages` and the modulo keeps the current `pageIndex` valid.

### The button

A `<button id="wallShuffleBtn">` is appended to `container` in `init()`. Position: `absolute right:16px bottom:96px` so it sits above the 80px-tall player bar with breathing room. Style: lime border + dark glassmorphism background + lime text + lime glow shadow + JetBrains Mono. Content: `↻ <pageIndicator>` where the indicator reads `current/total` (e.g. `2/6`).

Click handler:
1. `e.stopPropagation()` so the click doesn't fall through to the canvas creature hit test
2. `pageIndex++`
3. `buildCreatures()` rebuilds with the new page offset (poisson placement runs fresh, so positions also change)
4. `updatePageLabel()` refreshes the `current/total` text

The button is `pointer-events:auto` (info panel above it is `pointer-events:none`) and `z-index:50`.

### Page label updates

`updatePageLabel()` is a closure inside `init` that reads `window.tracks.length`, `MIN_CREATURES_*`, and `pageIndex` to compute and write the `current/total` text. Stashed on `container._updatePageLabel` so the resize handler can call it after a viewport change rebuilds creatures.

Initial label is set right after the first `resize()` in `init`. Resize handler calls it via `container._updatePageLabel`.

### What's NOT in this commit
- The 12 additional hero icons (Thunderbird, Best Day Ever, Warzone, Streets, Lemonade, Beachouse, Sickboi, 10 Miles, Money Ain't a Thing, Birthday Freestyle, etc) — paused to ship this fix first. Will be a follow-up.
- A "previous page" button — single direction is enough since you cycle back around with `(pageIndex % totalPages)`. Could split into ◂/▸ later if requested.
- A page picker / numeric input — keeping it minimal for now.
- A "shuffle within current page" button distinct from "next page" — currently only one button.

### Files modified
- [js/wall.js](js/wall.js) — `pageIndex` state, page math in `buildCreatures` (4 lines + 1 line change to `trackIndex` calc), `updatePageLabel` closure + `_updatePageLabel` stash, shuffle button creation + click handler in `init`, label refresh in `init` + `resize`. ~70 lines net added.
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b061 → b062`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### How to test
1. Hard refresh `cantmute.me/` on mobile.
2. Should see ~15-30 creatures on the wall (depending on screen size).
3. Bottom-right of the canvas, above the player bar: `↻ 1/6` button.
4. Tap it → wall rebuilds with a different set of creatures, button reads `↻ 2/6`. Each tap cycles through the next slice of the catalog.
5. After 6 taps it wraps back to `1/6`.
6. On desktop the button shows `1/2` (117 creatures × 2 pages = covers all 177 tracks).
7. Each special override icon (ODST, Rolla, Pillowcase, etc) only appears on the page that contains its track in the current slice. Cycle pages to find them.

### Knobs (in [js/wall.js](js/wall.js))
- `MIN_CREATURES_MOBILE = 30` — page size on mobile
- `MIN_CREATURES_DESKTOP = 100` — page size on desktop
- Mobile hard cap `32` and desktop hard cap `117` in `buildCreatures` `N` calc
- Button position `right:16px bottom:96px` in shuffleBtn cssText
- Button color `#9cff3a` (lime) — change once for border/text/glow

## b061 — 2026-04-08 — 9 more hero icons for signature tracks

User on b060: *"yes pls"* to my offer of 9 additional custom icons. All shipped here.

### New icon overrides

| Title match | Type | What it draws |
|---|---|---|
| `space star` | `spaceship` | Sleek arrowhead cruiser w/ cyan engine trail, yellow flame core, angled delta wings, cyan cockpit dome |
| `hotel california` | `hotelsign` | Vertical neon "HOTEL" sign on a pole with magenta border + cyan letters that pulse, yellow star ornament at the bottom |
| `coffee` | `coffeecup` | White ceramic cup w/ saucer, brown coffee surface w/ crema highlight, handle, 3 animated steam wisps rising from the cup |
| `robot` | `robotbody` | Boxy retro robot — antenna w/ blinking LED, square head w/ visor + cyan eye dots + grille mouth, body w/ chest panel screen + rivets, stub arms, tread feet |
| `stayin` | `discoball` | Hanging disco ball w/ chain, mirror tile grid clipped to circle, 6 colored highlight tiles, 5 sparkle dots orbiting the outside |
| `mario` | `mariostar` | Cute 5-point yellow star w/ inner highlight ring + cartoon eyes + smile + gentle wobble |
| `chains` | `chainlink` | 3 interlocked metal chain links (alternating angle) w/ inner cutouts + curved highlights, slight sway |
| `nirvana` | `wonkysmile` | Yellow circle smiley w/ X eyes + crooked scribble mouth + magenta tongue sticking out the side |
| `arkham` | `villainmask` | Joker-style face — green hair clumps, pale oval, dark sunken eyes w/ white pupil dots, wide red grin w/ teeth, purple "?" scar on cheek |

### How it landed
Three localized edits to [js/wall.js](js/wall.js):

1. **`ICON_OVERRIDES`** array got 9 new entries inserted between the b060 ones and the closing `]`. Order matters because first-match-wins — `space star` is before any future generic `space` entry, etc.
2. **9 new `draw*` functions** inserted directly after `drawPillowcase()`. Each is ~50–80 lines of canvas paths. Same `(c, light, dark, wingT)` signature as the rest, animated where appropriate (steam wisps on coffee, blinking eyes on robot, orbiting sparkles on disco ball, blinking antenna on robot, pulsing neon on hotel sign).
3. **9 new switch cases** in `drawCreature` dispatch + 9 new entries in the `noRot` list (all 9 are intentional-orientation icons that should stay upright).

The build/dispatch/cap/depth/halo/audio-reactive logic from b059–b060 all carries through unchanged — these new drawers are just data plugged into the existing system. Each special track gets exactly one front-depth, size-bumped hero icon on the wall (the FIRST creature that lands on that trackIndex; any extras stay random). Tracks like `Nirvana (Alt Lyrics)` also match the `nirvana` substring so the smiley shows up for both.

### Files modified
- [js/wall.js](js/wall.js) — 9 ICON_OVERRIDES entries, 9 new drawer functions, 9 dispatch cases, 9 noRot entries. ~600 lines net added.
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b060 → b061`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

Total override count is now **12 hero icons** (3 from b060 + 9 from b061).

### How to test
1. Hard refresh `cantmute.me/`
2. Find each hero icon on the wall:
   - `Space Star Galactica` → arrowhead spaceship with engine trail
   - `Hotel California` → vertical neon HOTEL sign
   - `Coffee (Back in the Day)` → ceramic cup with steam
   - `Robot Song` → boxy retro robot
   - `Stayin' Alive` → hanging disco ball
   - `Mario Island Funky Beat` → smiling Mario star
   - `Chains (Grunge)` → 3 interlocked chain links
   - `Nirvana` AND `Nirvana (Alt Lyrics)` → wonky smiley with tongue
   - `Arkham Villain` → green-hair joker face
3. Click any of them → that song plays
4. Hover any of them → tooltip shows the title

### Adding more
Same recipe as b060: array entry + draw function + switch case + (optionally) noRot entry. The system scales linearly.

### Potential candidates for next round (not done in this commit)
Looking at the title list, future hero icon possibilities: "Thunderbird" (lightning bird), "Best Day Ever (Clarity)" (sun), "Warzone" (helmet/grenade), "Streets" (boombox), "Lemonade" (lemon), "Beachouse" (beach hut), "Sickboi" (skull), "10 Miles" (road sign), "Money Ain't a Thing" (cash stack), "Birthday Freestyle" (cake)...

## b060 — 2026-04-08 — Player bar pinned + per-track icon overrides (ODST/Rolla/pillowcase)

User on b059: *"play previous song and next position changes based on song title. ensure those 3 buttons are static"* + follow-up *"i want matching emojis or emoticons cool art for songs. for ODST i want a halo ODST helmet or halo odst soldier; for rolla can u do a lambo or something some cool fast supercar; silk pillowcase = pillowcase"*

Two unrelated fixes shipped together because both are tiny.

### 1. Player bar controls — pinned, no drift

The b015-era flexbox layout had `.player-track-info { flex: 0 1 220px }` (desktop) and `flex: 0 1 auto` (mobile). The `flex-shrink: 1` on desktop let it collapse below 220px under content pressure, and the `auto` basis on mobile made the element width literally equal to the title text width. Either way, when the title changed length the prev/play/next buttons slid horizontally — exactly what the user reported.

Fix in [style.css](style.css):
- **Desktop**: `.player-track-info { flex: 0 0 220px; overflow: hidden; }` — no shrink, no grow, fixed 220px box. Long titles get cut by `text-overflow: ellipsis`. Controls now sit at exactly the same x-coordinate regardless of title.
- **Mobile** (line ~810): `.player-track-info { flex: 1 1 0; min-width: 0; overflow: hidden; }` + `.player-controls { flex: 0 0 auto; }`. Track-info fills all available space; the 3 controls anchor to the right edge of the bar where they belong.

Two CSS hunks, no JS changes.

### 2. Per-track icon overrides (3 hero creatures)

Specific song titles now render as bespoke hero icons instead of random creature types. Three to start:

| Title match (case-insensitive substring) | Creature type | Drawer |
|---|---|---|
| `odst` | `helmet` | Angular ODST-style helmet w/ cyan visor + grille + blinking antenna nub + lime "ODST" stencil |
| `rolla` | `supercar` | Hot-yellow Lambo wedge w/ cyan windshield reflection + side intake + glowing headlight + magenta tail light + 2 spinning rims |
| `silk pillowcase` | `pillowcase` | Soft silk pink pillow w/ wobble + diagonal sheen + 4-corner fold lines + magenta center tuft + tasseled corners |

Override system in [js/wall.js](js/wall.js):

- **`ICON_OVERRIDES` array** at the top of the file maps `match` (lowercase substring) → `type` (drawer name). Adding more is just a new array entry + a draw function + a dispatch case.
- **`getOverrideType(title)`** returns the type if any entry matches, else null.
- **`buildCreatures`** runs `getOverrideType(title)` BEFORE the random type roll. If matched AND the trackIndex hasn't been overridden yet (tracked in an `overrideUsed` Set), the creature gets the override type.
- **First match wins per trackIndex**: with 100 creatures cycling through ~117 tracks, only the FIRST creature for each special track becomes the hero icon. Any additional creatures sharing that track stay random. Means each special song has exactly one visually distinctive instance on the wall — not 12 giant pillowcases stacking up.
- **Override creatures are forced to depth 2 (front)** and `size = max(size * 1.4, 40)` so they read as hero elements above the regular creatures.
- **Override types are added to the `noRot` list** in `drawCreature` so the helmet/car/pillow stay upright instead of slowly rotating.
- **Three new dispatch cases** in the `drawCreature` switch.

The 3 new drawers are intentionally more detailed than the random creature types — multi-color, multi-element, with character. Each is ~50–80 lines of canvas paths.

### Files modified
- [style.css](style.css) — `.player-track-info` desktop + mobile flex rules, `.player-controls` mobile flex
- [js/wall.js](js/wall.js) — `ICON_OVERRIDES` map + `getOverrideType` helper, `overrideUsed` Set in `buildCreatures`, override branch in type selection, force depth 2 + size bump, 3 new drawer functions (`drawHelmet`, `drawSupercar`, `drawPillowcase`), 3 new dispatch cases, 3 new noRot type checks. ~370 lines net added.
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b059 → b060`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### How to test
1. Hard refresh `cantmute.me/`
2. Click between several tracks with very different title lengths (e.g. "Dutch" → "Mario Island Funky Beat" → "ODST"). The prev/play/next buttons should NOT move at all.
3. Same on mobile — controls anchored to the right edge of the player bar, not floating around.
4. Look on the wall for: a yellow Lambo (Rolla), a sci-fi helmet with a cyan visor and "ODST" stencil (ODST), and a soft pink pillow with a magenta tuft (Silk Pillowcase). All 3 should be larger than the random creatures and on the front depth layer.
5. Click any of them → that song plays.

### Adding more overrides
Add an entry to `ICON_OVERRIDES`:
```js
{ match: 'hotel california', type: 'hotelsign' },
```
Then add `function drawHotelsign(c, light, dark, wingT) { ... }`, a `case 'hotelsign'` line in `drawCreature`'s switch, and (if it should stay upright) a check in the `noRot` list.

### What this is NOT
- Not asset-based — still all canvas paths, no image files
- Not user-configurable — overrides are hard-coded in [js/wall.js](js/wall.js)
- Not a category system — each entry maps to a specific drawer, not a tag

## b059 — 2026-04-08 — Wall: parallax + audio reactive + neighborhood + constellations

User on b058: showed a screenshot with the gradient mesh blowing out the center to pure white (the 7 nebulas had converged in the middle), then asked *"how can we make this cooler better etc"*. I proposed a "Top 5" plan; user said *"yes"*. All five shipped here in one commit.

### 1. Background blowout fix

The b058 nebulas were drifting around hash-derived anchors, which let them all wander into the canvas center simultaneously and additively blow out to white. Three-part fix in [js/wall.js](js/wall.js) `buildNebulas` + `drawBackground`:

- **Count down 7 → 5**
- **Alphas down ~25%** (0.55-0.60 → 0.30-0.45)
- **Anchors LOCKED to a 5-quadrant spread**: 4 corners + 1 center, normalized to W/H. They literally cannot converge.
- **Drift amplitudes clamped** at 80–140 / 60–110 (was 140–300 / 110–250) so they stay in their quadrant.
- `drawBackground` wraps the additive layer in a frame-level `globalAlpha = 0.55 + bands.treble * 0.30` which CAPS the additive sum and pulses with the audio treble band.

### 2. Parallax depth — 3 layers (back / mid / front)

`buildCreatures` now rolls a depth value per creature from `h3 % 100`:
- `0` (**back**, 25%): 0.55× scale, 0.55 alpha, 0.55× drift amp, 0.60× drift speed
- `1` (**mid**, 60%): 1.00× everything (current behavior)
- `2` (**front**, 15%): 1.30× scale, 1.00 alpha, 1.40× drift amp, 1.30× drift speed

The values are stored on each creature (`depth`, `depthAlpha`) and applied at build time to `size` and the drift speeds/amplitudes. `drawCreature` applies `depthAlpha` via an outer `ctx.save() / globalAlpha / ctx.restore()` wrap so back creatures render at 0.55 opacity.

The main draw loop now does **3 passes** instead of 1: `for (pass = 0; pass < 3; pass++)` walks the creatures and only draws ones whose depth matches the current pass. Back drawn first, then mid, then front, then hovered last on top. 3 × 100 iterations = 300, still trivial.

Front-depth creatures also get a 1.15× halo radius multiplier in `drawCreature`.

### 3. Real audio reactive bands (bass / mid / treble)

`getBeat()` (single scalar from b056) replaced with `getAudioBands()`:

```js
return {
  bass:   avg(data[0..5]),
  mid:    avg(data[5..31]),
  treble: avg(data[31..end]),
};
```

All normalized 0..1. Three uses, one per band:

- **Bass** → creature scale pulse. `targetScale = 1 + bass * 0.18` (was `beat * 0.06`). Triple the impact when something's playing.
- **Mid** → wing/spin animation speedup. Inside `drawCreature`: `wingT = (t + c.wingPhase) * (1 + mid * 1.2)`. Butterflies flap faster, drone blades spin faster, fish tails wag faster, EVERYTHING speeds up to the music when the mid-range is pumping.
- **Treble** → background nebula brightness pulse. Inside `drawBackground`: `globalAlpha = 0.55 + bands.treble * 0.30`. The whole gradient mesh brightens on hi-hats / cymbals / vocals.

When nothing is playing, all 3 bands return 0 and behavior is identical to a static wall.

### 4. Playing-creature neighborhood

Each frame, the draw loop:
1. Collects all creatures whose `trackIndex === state.currentTrack` into `playingCreatures[]`
2. For every other creature, checks if it's within 200px of any playing creature → flags `c.inNeighborhood = true`
3. Draws a faint lime line from each playing creature to each neighborhood creature with distance-falloff alpha (max 0.45)
4. `drawCreature` adds +0.20 to the `depthAlpha` for any creature with `inNeighborhood = true`, so back-layer dim creatures visibly "light up" near the song

Visual effect: when you start a track, the area around its creature(s) on the wall glows brighter, with lime threads connecting the playing creature to its neighbors. Works even when the same track maps to multiple creatures (the neighborhoods overlap).

### 5. Constellation lines

`buildConstellations()` runs once at the end of `buildCreatures`. O(n²) double-loop checks every creature pair; if their `baseX/baseY` distance is < 75px, the pair `[i, j]` is pushed to `constellations[]`. Capped at 250 pairs.

Each frame, the draw loop walks `constellations` and draws a faint white line between the CURRENT positions (not base) of each pair. Distance-falloff alpha (max 0.10) — barely visible by themselves, but they create a star-map background pattern that makes empty regions feel intentional. Lines longer than 130px are skipped (cursor pulled the pair too far apart).

Drawn UNDER everything else so they read as a background layer.

### Draw order (final)
1. Background (dark plum + 5 capped nebulas + scanlines + vignette)
2. Glyphs (ambient sparkle layer)
3. **Constellations** (faint white pair lines)
4. **Neighborhood lines** (faint lime lines, only when something's playing)
5. **Cursor threads** (lime lines from cursor to nearby creatures, desktop only)
6. **Creatures back pass** (depth 0)
7. **Creatures mid pass** (depth 1)
8. **Creatures front pass** (depth 2)
9. **Playing rings** (rotating dashed lime circles around playing creatures)
10. **Hovered creature** (always on top)
11. **Burst rings** (click animation)

### Files modified
- [js/wall.js](js/wall.js) — `buildNebulas` (5 anchors + clamped drift), `drawBackground` takes `bands`, `buildCreatures` (depth roll), new `buildConstellations`, `getBeat → getAudioBands`, `drawCreature` (depthAlpha + bands.bass/mid + neighborhood boost + matching restore), main draw loop restructured with playing detection, neighborhood marking, constellation draw, neighborhood line draw, 3-pass depth render, playing ring moved AFTER creatures. ~190 lines net added.
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b058 → b059`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### How to test
1. Hard refresh `cantmute.me/` → background should look darker plum, no white blowout in the center, nebula colors visible in 5 distinct soft regions instead of one overwhelming wash.
2. Look for size variation among creatures — some should be visibly small + dim (back), some normal (mid), some big and crisp (front).
3. **Play any track** → creatures around the playing one should glow brighter, with faint lime lines connecting them. The wing/spin animations should visibly speed up. Bass hits should pulse all creatures larger. Treble should brighten the background.
4. Move mouse → cursor threads still work, plus the constellation lines should stretch as creatures drift.
5. The currently-playing rotating dashed ring should now be visible ON TOP of the creature (was being covered before).

### Knobs (all in [js/wall.js](js/wall.js))
- Depth split percentages in `buildCreatures` (`< 25 / < 85 / else`)
- Depth scale/alpha/drift/speed multipliers in `buildCreatures`
- Audio band sensitivity in `drawCreature` (`bass * 0.18`, `mid * 1.2`)
- Treble background pulse in `drawBackground` (`bands.treble * 0.30`)
- Neighborhood radius `200` in `draw()`
- Neighborhood alpha boost `+0.20` in `drawCreature`
- Constellation pair threshold `75` and stretched-line cutoff `130` and max alpha `0.10` in `buildConstellations` / `draw()`
- Nebula anchors `[0.20, 0.25] / [0.80, 0.30] / [0.50, 0.55] / [0.25, 0.80] / [0.78, 0.78]` in `buildNebulas`
- Background base `globalAlpha` `0.55` in `drawBackground`

### What this is NOT
- Not WebGL — still pure 2D canvas
- Not asset-based — still procedural
- Not search-filtered (still shows all)
- Not type-aware drift (fish still don't school, butterflies still don't figure-8 — that's a follow-up if this lands well)

## b058 — 2026-04-08 — Wall: gradient mesh bg, mobile cap, cursor interaction

User on b057: *"what would u do to improve overall experience, also i wanna change background too basic and bland i feel like for all of our icons. would love a dynamic or live background."* I proposed a 7-item plan; user said *"proceed"*. Single commit, all 7 changes.

### 1. Mobile creature cap (30 vs 100)

`MIN_CREATURES_DESKTOP = 100`, `MIN_CREATURES_MOBILE = 30`. b057's 117-on-phone was unreadable. `buildCreatures` now picks the cap based on `isMobile()` and clamps to `min(max(tracks.length, minCount), 32 mobile / 117 desktop)`. Same hash-derived layout, just fewer creatures on small screens.

### 2. Gradient mesh background — checker is GONE

The b056-b057 scrolling diagonal checker was the main thing fighting the creatures for attention. Removed entirely.

Replaced with a **dark plum base** (`#1a0820`) + **7 huge additive color blobs** (cyan / hot pink / lime / purple / mint / orange / second cyan accent) drifting on slow sine paths AND morphing their radii on a separate sine. Each blob is 540–1020px radius, additively layered with `globalCompositeOperation = 'lighter'`. The result reads as "alive color wash" — no edges, no patterns, just slow color shifts. Subtle scanlines stay (alpha 0.03), corner vignette stays (bumped to 0.45 for more contrast against the new dark base).

The b057 nebula draw became the only background draw. The checker draw block was deleted from `drawBackground` entirely. Each nebula now has `radiusPulseSpeed` + `radiusPulseAmp` so the blob sizes morph too.

### 3. Info panel shrunk

The b055 `<div class="info-label">// hover a creature</div><div class="info-title">THE WALL</div><div class="info-meta">N tracks adrift</div>` block was the biggest static thing on screen. Replaced with a single tiny line: `click any creature →` (font-size 11px, opacity 0.7). The title div stays in the DOM but is `display: none` until needed. Hover state replaces the label text with `▸ track title`. Click toast replaces it with `▶ track title` for 1.8s.

### 4. Cursor interaction

Two new behaviors in the draw loop:

- **Gentle attraction**: in `updateCreature`, if the cursor is within 100px of the creature, the creature is pulled up to 22px toward the cursor (linear falloff). Doesn't change the anchor — the drift sine is still computed first, then the attraction nudges the result. Skipped when no cursor (`mx === -9999`).
- **Connecting threads**: in the main `draw()` loop, after `hitTest()`, walks all creatures and draws a thin lime line (`rgba(156,255,58,0.30)` × distance falloff) from the cursor to any creature within 90px. Skipped on mobile (no hover concept + perf).

### 5. Click burst animation

`bursts` array (top of file). On click, `onClick` pushes `{x, y, birth, color}`. Drawn last in the main draw loop — expanding ring (radius `12 + age * 70`px) + faint inner ring at 60% radius. Both fade over 700ms then auto-removed. Drawn after creatures so they sit above everything. Color comes from the clicked creature's accent palette.

### 6. Currently-playing ring

After `hitTest()`, walks creatures and draws a **slow rotating dashed lime ring** (lineDash `[6, 6]`, rotation `t * 0.6`) around any creature whose `trackIndex === state.currentTrack` (the global player state). Radius is `c.size * c.scale * 1.7` so it sits just outside the creature. Multiple creatures can share a track, so multiple rings can appear simultaneously.

### 7. Poisson-disk placement

Replaced the b057 grid+jitter layout with **dart-throwing poisson placement**. Each creature tries up to 30 hash-derived candidate positions and accepts the first one that's at least `minDist` away from any already-placed creature (`minDist = 72px desktop / 56px mobile`). If all 30 attempts fail, accepts the last candidate as a fallback. The candidates are deterministic (`hash(title + '#' + i + '@' + attempt, 23)`) so the layout is stable across resize.

Result: no more rows, no more grid lattice, no more visible neighbor clustering by type or color.

### Files modified
- [js/wall.js](js/wall.js) — major rewrite of `buildCreatures` (poisson), `buildNebulas` (gradient mesh), `drawBackground` (checker removed), `updateCreature` (cursor attraction), `draw()` (connecting threads + playing ring + burst rings), `onClick` (push burst), info panel HTML, mobile creature cap. ~80 lines net added.
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b057 → b058`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### How to test
1. Hard refresh `cantmute.me/` → no checker pattern. Background should be dark plum with slow-drifting cyan/pink/lime/purple/mint/orange color washes that visibly morph.
2. Move mouse around → nearby creatures should subtly drift toward the cursor, and lime threads should appear connecting cursor to nearby creatures (within 90px).
3. Click any creature → expanding ring burst animation + that song starts immediately. Info panel flashes `▶ track title` for ~1.8s.
4. While a song is playing → the creature(s) for that track should have a slow rotating dashed lime ring around them.
5. The 20 creature types should be more evenly spread (no visible grid rows, no neighbor clustering).
6. **On mobile**: only ~30 creatures (was 117). Tap should still work via b057's inline hit test.

### Knobs (all in [js/wall.js](js/wall.js))
- `MIN_CREATURES_DESKTOP / MOBILE` — currently 100 / 30
- Mobile hard cap `32` and desktop hard cap `117` in `buildCreatures` `N` calc
- Cursor attraction range `100` and pull `22` in `updateCreature`
- Connecting line range `90` and color `rgba(156,255,58,0.30)` in `draw()`
- Burst ring lifetime `700ms`, max radius `12 + age * 70` in `draw()`
- Playing ring `lineDash [6,6]`, color `#9cff3a`, radius mult `1.7`
- Poisson `minDist` `72 desktop / 56 mobile`
- Nebula colors + alphas (currently 0.38–0.60) in `buildNebulas`
- Nebula `radiusPulseAmp` 0.15–0.35
- Base color `#1a0820` in `drawBackground`
- Vignette intensity `rgba(0,0,0,0.45)` in `drawBackground`

### What this is NOT
- Not WebGL — pure 2D canvas, every layer is `globalCompositeOperation` tricks
- Not asset-based — no images, no sprites, all canvas paths
- Not search-filtered yet (still shows all)
- Not type-filtered (no UI to show only butterflies or only jellies)

## b057 — 2026-04-08 — Wall: tone bloom, fix mobile click, drop queue, more variety

User on b056: *"bloomy too heavy and ugly and concentrated also on mobile still cant click the little things to play a new song and many elements are the same it feels like"* + follow-up *"forget queue just new icon plays new song"*.

Four targeted fixes in one commit. No new features.

### 1. Forget queue → click just plays the new song

User explicitly reverted the b056 click-to-queue behavior. New click handler in [js/wall.js](js/wall.js) `onClick` calls `playTrack(c.trackIndex)` directly — same effect as the player's prev/next buttons, just driven from a creature click. The toast always reads `▶ PLAYING`.

The b056 queue plumbing in [js/player.js](js/player.js) (`playQueue`, `queueTrack`, `playOrQueue`, `getQueueLength`, the `ended`-handler queue drain) is left intact but unused. It's behind a `playQueue.length > 0` guard so it has zero effect when nothing's queued. Easy to delete later if it stays unused, but the cost of leaving it is one if-check per `ended` event.

### 2. Mobile click finally works

The b056 `onClick` was racy on mobile. It read `hovered`, which is set by the draw loop's `hitTest()`, which depends on `mx`/`my`, which on mobile is only set by `touchstart`/`touchmove`. The race: a tap fires `click` BEFORE the next requestAnimationFrame runs `hitTest()`, so `hovered` was still `-1` and the click did nothing.

[js/wall.js](js/wall.js) `onClick` is now self-contained:
- Reads the position from the **event** itself (`e.clientX`/`e.changedTouches[0].clientX`), not from the cached `mx`/`my`
- Walks all creatures right there with a circular distance check
- Uses a fatter touch radius — `1.7×` size on desktop, **`2.4×`** on mobile so fingers can land
- No dependency on the draw loop's `hovered` state at all

That same fix means clicks are also more forgiving on desktop.

### 3. Bloom dialed way down

The b056 nebulas + halos read as "concentrated hot spots" instead of mood lighting. b057 dropped the intensity ~60% across the board:

- **Nebula alphas** 0.40–0.55 → **0.13–0.20**
- **Nebula radius** 280–560 → **480–880** (bigger + softer)
- **Nebula count** 6 → **8** (more spread, no fewer big bright zones)
- **Per-creature halo alpha** 0.30/0.55 → **0.10/0.28**
- **Per-creature halo radius** 2.0×/2.6× → **1.5×/2.1×**
- **Mobile skips per-creature halos entirely** — `if (!isMobile())` guard around the halo block in `drawCreature`. 100 additive radial gradients per frame is too much on phones, and the nebula layer alone is enough atmosphere.
- **Corner vignette** 0.40 → **0.25**

The result reads as a slow color wash across the magenta instead of a bunch of bright glowing puddles.

### 4. More creature variety

User said "many elements are the same it feels like". Three changes:

- **Type distribution**: was `CREATURE_TYPES[h1 % 20]`, which clustered when `h1` mod-collided. Now `CREATURE_TYPES[(i * 7 + h1) % 20]`. The `i * 7` stride guarantees consecutive creatures land on different types, while `h1` keeps it from looking like a perfect rotation. With 20 types and a stride of 7 (coprime), every 20 consecutive creatures cycle through every type exactly once.
- **Color distribution**: same fix — `colorIdx` was `h1 % PALETTE.length`, now `(i * 3 + h1) % PALETTE.length`. Spreads colors more evenly across neighbors.
- **Wider size range**: was `16 + (h1 % 14)` (16–29). Now ~70% small (`14 + (h1 % 13)`, 14–26) and ~30% larger hero (`28 + (h1 % 17)`, 28–44). The size split is rolled from `h2 % 100`. Larger creatures anchor the eye and break the uniform-grid feel.

### Files modified
- [js/wall.js](js/wall.js) — `onClick` rewritten as self-contained inline hit test (mobile fix), nebula intensity dialed down + count bumped, halo intensity dialed down + mobile-skipped, vignette dialed down, type/color distribution stride fix, wider size range with hero/small split
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b056 → b057`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

[js/player.js](js/player.js) is **unchanged** in this commit — the b056 queue plumbing stays in but is unused by the wall now.

### How to test
1. Hard refresh `cantmute.me/` on desktop → background should look subtler, no concentrated bloom hot spots, but still atmospheric. Creatures should feel more varied (size + type).
2. Click any creature → it should play that track immediately, replacing whatever's currently playing. Info panel flashes `▶ PLAYING`.
3. **Mobile**: tap a creature → should now actually start the track. Touch radius is fatter so small creatures should still be hittable.
4. The 20 creature types should all be visible in any reasonable cluster (no huge runs of the same type).

### Knobs (all in [js/wall.js](js/wall.js))
- Nebula alphas in `buildNebulas()` color list — currently 0.13–0.20
- Nebula radius `480 + (h % 400)`
- Nebula count `8`
- Halo alphas `0.10` / `0.28` and radius `1.5× / 2.1×` in `drawCreature`
- Vignette alpha `0.25` in `drawBackground`
- Touch radius `1.7` desktop / `2.4` mobile in `onClick`
- Type stride `i * 7` in `buildCreatures` (must be coprime with 20 — try 3, 7, 9, 11, 13)
- Color stride `i * 3` (coprime with 8)
- Size split — `< 70` threshold + small `14 + (h1 % 13)` / hero `28 + (h1 % 17)`

### What this is NOT
- Not a queue feature — explicitly removed by user request
- Not new creature types — variety came from distribution, not new shapes
- Not a UX change — same drift, same hover, same info panel

## b056 — 2026-04-08 — Wall: queue-on-click, 12 new creatures, bloomy nebula bg

User on b055: *"if i click an icon, queue the song associated with it, or play it if nothings playing. id love a lot more cool icons and stuff add much much more but love the vibe so far. can we make the background cooler as well, maybe not a crazy bloom but something bloomy"*

Three things in one commit: queue behavior, more creatures + density, bloomy background.

### 1. Click → queue or play (player.js + wall.js)

[js/player.js](js/player.js) gained a real queue API:
- Module-level `playQueue` array
- `queueTrack(index)` — push to queue, no immediate play
- `playOrQueue(index)` — if nothing's playing OR `currentTrack === -1`, calls `loadTrack` + `play` and returns `'playing'`. Otherwise pushes to the queue and returns `'queued'`. The view uses the return value to flash the right toast.
- `getQueueLength()` — convenience getter
- The existing `playerAudio.addEventListener('ended', ...)` handler now drains `playQueue.shift()` BEFORE falling through to the existing `repeat`/`shuffle`/`playNext` logic. So queued tracks play in order after the current one ends, and once the queue is empty the existing repeat/all behavior takes over.

[js/wall.js](js/wall.js) `onClick` handler now calls `playOrQueue(c.trackIndex)` instead of `showTrackDetail`. The return value drives a 1.4-second toast in the info panel — `▶ PLAYING` (green) or `+ QUEUED` (lime). Toast state is `toastUntil` + `toastText`, checked each frame in the draw loop.

### 2. 12 new creature types (8 → 20 total)

[js/wall.js](js/wall.js) `CREATURE_TYPES` array doubled. The 12 additions:

- **ufo** — saucer body + transparent top dome + cycling magenta/cyan/yellow rim lights + animated lime abduction beam underneath
- **planet** — back ring → body with surface bands → front ring (so the moon orbits in front) + small white moon orbiting on `wingT * 2`
- **rocket** — pointed body with quadratic curve nose + cyan window + 2 fin triangles + flickering yellow/orange flame trail
- **ghost** — pixel ghost: rounded top + 4-bump wavy bottom that wobbles on `sin(wingT * 4)` + 2 tall eyes with glints
- **bird** — minimalist V wings flapping fast (`sin(wingT * 7)`) + body dot in the middle. The simplest creature.
- **bee** — translucent wings flapping fast (`sin(wingT * 14)`) + yellow body with two black stripes + stinger triangle
- **flower** — 5 rotating petals around a yellow center with 4 dark dots
- **mushroom** — beige stem + colored cap + 4 white spots on the cap
- **octopus** — head + 8 tentacles drawn as 4-segment polylines wiggling on `sin(wingT * 3 + i + k)`
- **bat** — 2 angular wings (5-segment polylines) flapping on `sin(wingT * 8)` + black body + ear triangles + magenta eye dots
- **note** — eighth-note: tilted ellipse head + stem + curved flag
- **cassette** — body rect + label area with 2 lines + 2 spinning reels (4-spoke rotation on `wingT * 4`)

Each new drawer is ~25–55 lines of canvas paths. Same `(c, light, dark, wingT)` signature as the b055 drawers, so the dispatch in `drawCreature` is just a 12-line addition to the switch.

`drawCreature` also gained a **noRot** list — creatures whose orientation is intentional (butterfly, fish, rocket, note, mushroom, bee) skip the small ambient rotation that the others get from `c.rot * 0.3`.

### 3. Density bump

`MIN_CREATURES = 100`. `buildCreatures` now does `N = Math.max(tracks.length, MIN_CREATURES)` and maps via `i % tracks.length`. With 8 tracks today you get 100 creatures cycling through all 8 (~12 per track). With 200+ tracks you get one per track. The hash seed is per-CREATURE not per-track (`title + '#' + i`), so 12 creatures sharing a track still get different types, positions, and motion.

Cell width dropped 110 → 95 to pack more in. Min cols bumped 4 → 6.

### 4. Bloomy background

Three additive layers added to `drawBackground`:

- **6 drifting nebulas** built once at resize in `buildNebulas()`. Each is a large radial gradient (radius 280–560px) in cyan/lime/purple/yellow/mint/orange, with hash-derived position, drift speed, drift amplitude, and phase. Drawn between the magenta base and the checker with `globalCompositeOperation = 'lighter'` so they additively brighten the magenta where they overlap. Each frame they bob around their anchors via sin/cos.
- **Per-creature glow halo** in `drawCreature` — one additive radial gradient draw per creature in its accent color, radius `2.0× size` (`2.6×` on hover), peak alpha 0.30 (0.55 on hover). Cheap, sells the bloom.
- **Soft corner vignette** at the end of `drawBackground` — radial gradient from transparent center to 0.40 black at the corners. Pulls focus toward the middle without darkening the bright bits.

The checker stays on top of the nebulas so the pattern still reads even on the bright spots. Subtle scanlines stay too.

A new `hexToRgba(hex, alpha)` helper converts the palette hex strings to `rgba(...)` for the halo gradient stops.

### Files modified
- [js/player.js](js/player.js) — added `playQueue` + `queueTrack` + `playOrQueue` + `getQueueLength`. `ended` handler drains queue before falling through.
- [js/wall.js](js/wall.js) — click handler queue logic + toast state, density bump (`MIN_CREATURES = 100`, per-creature seeding), 12 new creature drawers, dispatch additions, glow halo + nebula bloom layer + vignette in `drawBackground`, `hexToRgba` helper, `nebulas` state + `buildNebulas`. ~1350 lines now (was ~700).
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b055 → b056`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### How to test
1. Hard refresh `cantmute.me/` → wall view, ~100 creatures drifting
2. Click a creature with nothing playing → it should start playing immediately, info panel flashes `▶ PLAYING`
3. Click a different creature while the first is playing → flashes `+ QUEUED`. Wait for the current track to end → the queued one plays next
4. Click multiple in a row → they queue in order, drain in order
5. The 8 b055 creatures (butterfly, drone, jelly, fish, comet, beetle, eye, crystal) + 12 new (ufo, planet, rocket, ghost, bird, bee, flower, mushroom, octopus, bat, note, cassette) should all be visible
6. Background should have soft cyan/lime/purple/yellow nebula glows drifting around — additive, slow
7. Each creature should have a soft halo behind it in its own color
8. Corner vignette should pull focus to center

### Knobs
All in [js/wall.js](js/wall.js):
- `MIN_CREATURES` (100)
- `CREATURE_TYPES` array — add/remove/duplicate types to weight the distribution
- Nebula count (6) + colors + radius range in `buildNebulas`
- Halo radius multiplier `2.0` / `2.6` and alpha `0.30` / `0.55` in `drawCreature`
- Corner vignette intensity in `drawBackground` (`rgba(0,0,0,0.40)`)
- Cell width `95`, margin `60`, creature size `16 + (h % 14)` in `buildCreatures`
- Toast duration `1400ms` in `onClick`

### Perf
~100 creatures × 20–60 ops each + 6 nebula gradient draws + 100 halo gradient draws + 75 glyphs + checker. Should still hit 60fps on any laptop. Mobile may struggle with 100 halos — if so, the `drawCreature` halo block is the first thing to put behind a `!isMobile()` check.

### What this is NOT
- Not draggable creatures
- Not collision-aware (creatures still bob around anchors and can overlap)
- Not a "remove from queue" UI — once you queue something it plays. Could add a queue list panel later.
- Not a real GL bloom — it's 2D additive gradients faking it. Cheaper, no shaders.

### Next
React to it. Likely tuning rounds: nebula colors/intensity, halo strength, more creature types, fewer creatures if it feels cluttered, queue list UI.

## b055 — 2026-04-08 — Wall: kill stickers + wordmark, replace with creatures

User on b054: *"i love the moving little things in the center. not a big fan of the wall huge text. the background and moving little things remind me of marathon. can we have small futurey space butterflies flying around and some other cool small animation like things on screen. with them being clickable, and that brings up different music cards"* + follow-up *"one for each track"*.

The b054 stickers were the wrong unit. The user loved the ambient drifting glyphs (which read as Marathon-y to them) and hated the giant `// THE WALL` wordmark in the corner. So this commit:
- DELETES the sticker rendering entirely (`drawSticker`, `roundRect`, `pickBadge`, the sticker hit test)
- DELETES the giant `drawWordmark()` function and its 140px text
- KEEPS the magenta + scrolling checker background (the user called this out as a love)
- KEEPS the ambient decorative glyphs underneath everything (the "moving little things in the center")
- ADDS 8 creature types as new clickable elements — one per track

### Creatures
[js/wall.js](js/wall.js) is rewritten end-to-end (~700 lines, was ~325). Each track in `window.tracks` becomes one creature. Type is picked deterministically from a hash of the title so the same track always renders the same creature.

The 8 types each have their own ~30-line canvas drawing routine + per-frame animation:

- **butterfly** — 4 wing ellipses with eye-spots, body capsule, antennae. Wings flap on `sin(wingT * 6)`, scaling wing width 0.10→1.0.
- **drone** — flat ellipse disc + dome top + 4 rim lights that alternate-blink + translucent yellow beam underneath
- **jellyfish** — half-bell with highlight + 7 wavy tentacles drawn as polylines that swim on sine
- **fish** — ovoid body + tail that wags via `sin(wingT * 5)` + top fin + eye with pupil
- **comet** — 6 trailing alpha-decreasing ellipses + bright head + white-hot core + 3 sparks orbiting at radius
- **beetle** — 6 wiggling legs + round body with split line + lighter highlight + small head + antennae
- **eye** — sclera + iris that **tracks the cursor** in canvas space (computed each frame from `mx`/`my` minus creature position) + pupil + glint + occasional blink
- **crystal** — rotating hexagon + inner facet lines from center + highlight wash + 3 diamond sparkle dots orbiting

### Layout + drift
Loose grid sized to fit the canvas (cols based on width / 110), one cell per track, with ±40px hash-based jitter so it doesn't read as a perfect grid. Each creature has a `baseX/baseY` anchor and bobs around it via:

```js
c.x = baseX + sin(t * driftSpeedX + driftPhase) * driftAmpX;
c.y = baseY + cos(t * driftSpeedY + driftPhase * 0.7) * driftAmpY;
```

Speeds + amplitudes + phases are all hash-derived per creature, so the motion looks chaotic but is deterministic. They never drift off-canvas because the anchors are bounded.

### Hit test + tooltip
Cheap circular distance check against `creature.size * scale * 1.1`. 117-iteration mousemove is nothing. Hovered creature scales to 1.35×, draws on top of the stack, and gets a small lime-on-black `JetBrains Mono` tooltip with its title positioned to one side. Cursor switches to `pointer` while hovering.

The info panel in the bottom-left now updates dynamically — shows `// type` + the track title in caps when hovering, falls back to `// hover a creature · THE WALL` when not.

### Click → track detail
Same as b054: `window.showTrackDetail(trackIndex)` opens the official site track-detail panel. Falls back to `playTrack(i)` if the global isn't available.

### Audio reactive
Same beat scalar from `getFrequencyData()` as b054, applied as a 1.06× scale pulse on all creatures when something is playing.

### Files modified
- [js/wall.js](js/wall.js) — full rewrite, ~700 lines (was 325). Stickers + wordmark gone, creatures + 8 type drawers in.
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b054 → b055`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

Routing/index.html/app.js are unchanged from b054 — the wall is still the default landing view, still tab #1, still falls through to `?paint=1` / `?style=v2` / `?legacy=villa`.

### What carries over from b054
- Hot magenta `#ff2bd6` background
- Scrolling diagonal checker overlay
- 75 ambient decorative glyphs (stars / sparkles / crosses / arrows / bolts / dots) drifting underneath
- IIFE pattern, `init` / `destroy` / `onSearch` / `registerView('wall', ...)`
- Audio-reactive pulse on `getFrequencyData()`

### What's gone
- Sticker rectangles
- `drawWordmark()` and the giant `// THE WALL` text
- The "click a sticker" info copy (replaced with "hover a creature")

### How to test
1. Hard refresh `cantmute.me/` → no flag, boots into the new wall
2. Should see one creature per track drifting around — each is a different type (butterfly, drone, jelly, fish, comet, beetle, eye, crystal)
3. Hover any creature → it scales up, lime tooltip appears with title, info panel updates
4. Click → official track detail panel opens
5. Eye creatures should track your cursor with their pupils
6. Background checker should still scroll, ambient glyphs should still drift
7. Wordmark should be GONE

### Knobs
All in [js/wall.js](js/wall.js):
- Background color in `drawBackground()` (currently `#ff2bd6`)
- Glyph count `75 / 30` in `buildGlyphs()`
- Cell width `110px` and margin `60px` in `buildCreatures()`
- Creature size `18 + (h % 14)` in `buildCreatures()` — bump for bigger creatures
- Drift amplitudes `driftAmpX/Y` in `buildCreatures()`
- Hover scale `1.35` in `drawCreature()`
- Beat pulse `0.06` in `drawCreature()`
- `CREATURE_TYPES` array — add/remove types or weight by duplicating entries
- Per-type drawing in `drawButterfly` / `drawDrone` / etc.

### What this is NOT
- Not a fixed 117 — `N === tracks.length`. With 8 tracks today there are 8 creatures. Scales to as many as `window.tracks` carries.
- Not draggable — creatures drift on a fixed sine pattern, not click-and-drag
- Not collision-aware — they bob around their anchors and CAN overlap visually
- Not WebGL — pure 2D canvas, redraws every frame at 60fps
- Not perf-optimized for thousands of creatures — at 117 it's fine, beyond that the type-specific drawers might need batching

### Next
Wait for the user's reaction. If the direction lands → next steps could be: more creature variety, per-creature trail effects, "swarm to cursor" mode, sound-reactive creature behaviors (butterflies flap faster on bass), creature-type filters in the bottom bar, hand-drawn sprites instead of canvas paths. If wrong → easy revert via git, or just iterate on creature shapes.

## b054 — 2026-04-08 — "the WALL" sticker view (new default landing page)

User after b053: *"can we just make a quick view (like neural mind map) and include have that be the main landing page. itll be a cool music portfolio site vibe like 100 gecs and other artists in that lane"* → confirmed `sure` to my proposal of WALL / open detail panel / 5th tab in front. The 3D villa direction has been on a long iteration loop; this commit pivots the landing experience to a fast, cheap, vibe-forward 2D canvas view that fits the hyperpop aesthetic.

### New file: [js/wall.js](js/wall.js) (~325 lines)
Self-contained 2D canvas view, mirrors the [js/neural.js](js/neural.js) IIFE pattern (`init` / `destroy` / `registerView`). No Three.js, no postprocessing, no shaders.

### What it draws
- **Background** — solid hot magenta `#ff2bd6` with a slowly scrolling diagonal checker overlay (cheap CSS-y Y2K texture) and faint scanlines
- **60 (24 on mobile) decorative pixel glyphs** scattered across the background — stars, sparkles, crosses, arrows, lightning bolts, dots — drifting on sine offsets, slowly rotating, in a tight palette (white / lime / cyan / yellow / black)
- **Every track is a sticker** — colorful tilted rectangle with:
  - Random rotation ±~13° (deterministic from track title hash so layout is stable)
  - Vertical gradient fill from one of 8 hyperpop color pairs (lime / cyan / yellow / hot pink / electric purple / orange / white / mint)
  - Hard 3px black outline + 6px offset drop shadow
  - Inner highlight stripe across the top
  - Chunky uppercase title in `Syne 900` with hard black drop shadow
  - Badge corner: `#01`, `★`, `!!`, etc. (or `★ NEW` / `✦ HOT` if the track has those flags)
  - Pixel "torn corner" notch on the top-right
  - Slow sine bob (4–10px amplitude)
- **Hover state** — sticker scales to 1.18, rotation lerps to 0°, draws on top of the stack, reveals an `▶ KANI` artist line in the corner
- **Audio reactive** — pulls a single beat-strength scalar from `getFrequencyData()` (already shared by player.js) and applies a gentle 1.04× scale pulse to all stickers when something is playing
- **Big corner wordmark** — `// THE WALL` rendered in giant `Syne 900` (140px desktop / 60px mobile) with stacked black + lime + white shadow layers, anchored bottom-left

### Layout
Loose grid (jittered for chaos) sized to fit the canvas. Cell ~190×110 desktop, ~130×80 mobile. Sticker w/h: 155×78 desktop, 105×56 mobile. The grid auto-sizes to columns based on canvas width, deterministic per-track jitter (hash of title) keeps positions stable across resize.

### Click → track detail
Hit test is an inverse-rotation axis-aligned check against the tilted box (cheap, accurate enough for a sticker UI). On click of a hovered sticker, calls `window.showTrackDetail(trackIndex)` to open the official site track-detail panel — same flow as every other view. Falls back to direct `playTrack(i)` if the global isn't available.

### Wired in as the new default
- [index.html](index.html) — added `<button class="view-tab active" data-view="wall">Wall</button>` as the **first** tab in both the desktop `.view-tabs` and the `.mobile-view-tabs` (the previously-active `villa` button lost its `active` class). Added `<script src="js/wall.js"></script>` after neural.js.
- [js/app.js](js/app.js):
  - `subs` map gained `wall: '// the wall · N stickers'`
  - Boot block default view changed `villa` → `'wall'`. The `?paint=1` and `?style=v2` flags still take precedence. Added a new `?legacy=villa` flag so the old villa landing is one URL away.
  - Keyboard digits shifted: `Digit1`→wall, `Digit2`→terrain, `Digit3`→deepsea, `Digit4`→neural, `Digit5`→villa
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b053 → b054`

### Files modified
- [js/wall.js](js/wall.js) — NEW, ~325 lines
- [index.html](index.html) — Wall tab in both tab bars (desktop + mobile), script tag
- [js/app.js](js/app.js) — subs map entry, default boot view, keyboard shortcut shift, `?legacy=villa` flag
- [js/helpers.js](js/helpers.js) — build bump
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### What this is NOT
- Not a replacement for any existing view — Villa, Neural, Terrain, Deep Sea all still work and live in the same tab bar
- Not a search-filtered view yet — `onSearch` is wired but currently only updates the meta line. Future: filter the wall in/out
- Not a drag-to-rearrange interface — stickers drift on a fixed pattern, they're not draggable
- Not GPU accelerated — pure 2D canvas, every frame is a redraw. Should run fine at 60fps on any laptop. Mobile glyph count is halved.

### How to test
1. Hard refresh `cantmute.me/` → boots into THE WALL (no flag needed). Should see hot magenta canvas with every track as a tilted colorful sticker.
2. Hover a sticker → it straightens, scales up, shows artist line
3. Click a sticker → official track-detail panel opens with play button
4. Press `1`–`5` to cycle views
5. Hard refresh `cantmute.me/?legacy=villa` → boots straight into the old villa view (escape hatch)
6. `cantmute.me/?paint=1` → painterly POC, untouched
7. `cantmute.me/?style=v2` → Marathon cryo bay, untouched

### Knobs
All in [js/wall.js](js/wall.js):
- `PALETTE` — 8 color pairs at the top of the file
- Background magenta `#ff2bd6` in `drawBackground()`
- Checker `size = 36`, scroll speed `* 18`
- Glyph count `60 / 24` in `buildGlyphs()`
- Sticker dimensions in `buildStickers()` — `cellW`, `cellH`, `w`, `h`
- Rotation range `±π/14` in `buildStickers()`
- Hover scale `1.18`, beat pulse `0.04` in `drawSticker()`
- Wordmark text `// THE WALL` and font size in `drawWordmark()`

### Next
Wait for the user's reaction. If the direction lands → next steps are: search filtering on the wall, drag-to-rearrange, "shuffle layout" button, more decoration density, custom per-track stickers (cover art if config provides it), maybe a "rip the sticker off the wall" interaction. If the direction is wrong → easy revert, all changes are additive except the boot view default and tab order.

## b053 — 2026-04-08 — Marathon cryo bay POC (?style=v2 repurposed)

User on b052: post-processing pipeline went live, but the pool whiteout from its 3.6× emissive boost firing into the bloom pass made it look worse, not better. They followed up with a stack of Marathon (Bungie 2026) reference imagery — character render, glowing mushrooms, lime-green inflatable + perforated wall, halftone wireframe figure, hazard-stripe banner, blue cyberpunk catwalk interior, moon + Marathon hull. Quote: *"can we make the v2 scene a lot more like bungies 2026 marathon... yes del v2 and replace with our current... marathon game has planets with different POIs and a huge spaceship called The Marathon, you can find details googling marathon cryo bungie 2026"*

The "cryo" hint locked the scene concept.

### Honest read on b052
Marathon's actual look isn't a post-processing trick — it's:
- Cool blue base + lime green accent emissives + magenta/red warning accents
- Heavy volumetric haze + god rays
- Real PBR + bold stencil decals (hazard stripes, "TRAXUS", numbers, QR codes) painted onto industrial surfaces
- Crushed shadows, cinematic vignette, strong rim light
- Bloom only on accent emissives, NOT surface materials

The b052 approach (slap a composer on top of the existing villa) couldn't get there by tuning knobs. The villa's pool shader is already firing 3.6× into a low bloom threshold — wrong base scene to layer Marathon styling on. So we deleted b052 and rebuilt as a fresh isolated POC.

### What got deleted
The b052 stylization pipeline in [js/world.js](js/world.js) is fully reverted:
- `composer` / `stylized` declarations gone
- `?style=v2` URL flag check inside `init()` gone
- ACES tone mapping setup gone
- ~110-line composer build block (RenderPass + UnrealBloomPass + finishing ShaderPass + OutputPass) gone
- `animate()` render branch back to single direct call
- `onResize` composer line gone
- `destroy()` composer cleanup gone

`world.js` is now byte-identical to b051 except for the b047 comment trail.

The importmap added to [index.html](index.html) in b052 STAYS — it's needed by the new POC for its own composer chain.

### New file: [js/world-marathon.js](js/world-marathon.js) (~840 lines)
Self-contained Marathon-style cryo bay scene. Same isolation pattern as `world-paint.js`. Registers as a 6th view named `'marathon'`. Loads its own copy of three.js from the same CDN.

### Scene
A small interior cryo bay on The Marathon ship. ~30×30×9 box.
- **Floor** — dark gunmetal blue PBR with a 1024×1024 procedural decal texture: panel grid, hazard stripe band, "CRYO BAY 04" stencil, "TRAXUS // SECTOR W6" subtitle, warning triangle, directional arrows, random rivets
- **Ceiling** — bone white PBR + 3 emissive strip lights running x-axis
- **Back wall** — bone white PBR with a 1024×512 procedural decal texture: perforated dot grid, big "TRAXUS" stencil block on lime, subtitle text, QR code with finder corners, barcode + serial number, lime accent connect strip
- **Side walls** — flat bone white PBR
- **Front wall** — solid wall built as 4 strips around a 14×5 viewport cutout. Black metal frame around the cutout.
- **Viewport backdrop** (visible through cutout):
  - Black space dome
  - 600-point starfield on a 200-radius sphere
  - Large emissive moon disc offset to one side
  - Marathon ship hull silhouette — long dark slab + tower + 20 magenta/lime hull lights
- **3 cryo pods** along the back wall (click→track triggers, track 0/1/2):
  - Gunmetal pedestal
  - `MeshPhysicalMaterial` glass cylinder (transmission 0.85, clearcoat)
  - Bone dome top
  - Lime emissive status sphere on the dome (intensity 4)
  - Internal dark capsule "subject" silhouette
  - Procedural label panel on the front: "CRYO-04/05/06" in lime stencil, SUBJECT/STATUS/TEMP/DUR fields, hazard stripe footer, mini QR
  - Local lime PointLight (intensity 8, range 6)
- **2 wall terminals** — frame + cyan emissive screen + magenta warning strip below
- **Ceiling conduits** — 4 horizontal pipes + hangers, plus a single lime accent emissive pipe
- **God rays** — 4 stacked additive cone planes shooting from the window into the bay, falloff in custom shader
- **Dust particles** — 220 drifting points across the bay, animated each frame, sized to catch the bloom
- **Lighting** — cool blue ambient (0x1a2a40 @ 0.55) + cool hemisphere + cyan-white directional sun coming through the window (with shadow map) + 2 magenta warning point lights on the side walls

### Materials
Real PBR throughout — `MeshStandardMaterial` for everything except the cryo glass which uses `MeshPhysicalMaterial` for transmission. NO custom lighting shaders. NO cel shading. The Marathon look comes from the *combination* of PBR + bold decal textures + tight palette + heavy fog + god rays + bloom on accents only — not from a stylized shading model.

Palette is locked tight in a `PAL` constant at the top of the file. Five hero colors:
- `floor` — gunmetal blue 0x1a2230
- `wall` — bone white 0xe8e6dc
- `limeEmissive` — 0x9cff3a
- `magWarning` — 0xff2a6e
- `cyanRim` — 0x4ad8ff

### Procedural decal textures
Three canvas-drawn textures generated at boot, no external assets:
- `makeFloorDecalTexture()` — 1024² with stripes, stencils, warning triangle, rivets
- `makeWallDecalTexture()` — 1024×512 with TRAXUS block, perforated grid, QR code, barcode
- `makePodLabelTexture(podNumber)` — 512×256 per-pod label with SUBJECT/STATUS fields and hazard footer

The QR codes are random fill with hand-drawn finder corners — they're just there for the look, they don't decode to anything.

### Post-processing
Same module set as b052 (loaded via the importmap), but tuned completely differently:
- **`UnrealBloomPass`** — strength 1.05, radius 0.7, threshold **0.92**. The high threshold is the key fix from b052: only the brightest emissives (lime status lights, cyan terminals, ceiling strip lights, moon, hull lights) bloom. PBR surfaces never trip the threshold so there's no whiteout.
- **Custom finishing ShaderPass** — adds chromatic aberration on top of the b052 vignette + grain + lift/gamma/gain. CA is radial (sample R offset out, B offset in along the radial direction). Vignette bumped to 1.45 (much darker corners), grain to 0.06.
- **`OutputPass`** — applies ACES tone mapping (set on renderer) + sRGB.
- Renderer exposure 1.05.
- If any composer module fails to load, falls back to direct render with a console warning.

### Camera
Constrained orbit, no WASD, no anchors. Radius clamped 8–38 (small interior). Pitch clamped -0.10 to 1.20. Always inside the bay.

### Click→card
Cryo pods have invisible 2.5×5.5×2.5 hit boxes for easier clicking. On click, raycaster finds the pod and calls `window.showTrackDetail(trackIndex)` — the official site track-detail panel — so playback wires through the existing player exactly like the rest of the site. If `showTrackDetail` isn't available, falls back to a local Marathon-themed popover (lime border, JetBrains Mono, "CRYO-04 // SUBJECT R273" header).

### Routing
[js/app.js](js/app.js) boot block now checks both URL flags:
- `?paint=1` → `'paint'` view (unchanged)
- `?style=v2` → `'marathon'` view (new)
- otherwise → `'villa'`

### Files modified
- [js/world-marathon.js](js/world-marathon.js) — NEW, ~840 lines
- [js/world.js](js/world.js) — fully reverted from b052 (5 edits, all subtractive)
- [js/app.js](js/app.js) — boot block now routes `?style=v2` to the marathon view alongside the existing `?paint=1` flag
- [index.html](index.html) — added `<script src="js/world-marathon.js"></script>`. The b052 importmap stays.
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b052 → b053`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### How to test
1. Hard refresh `cantmute.me/?style=v2` → loads the cryo bay
2. Click any of the 3 cryo pods → official track detail panel opens with track 0/1/2
3. Drag to orbit, scroll to zoom (constrained — you can't escape the bay)
4. Hard refresh `cantmute.me/` → unchanged b051 villa
5. Hard refresh `cantmute.me/?paint=1` → painterly POC, untouched

### Knobs
All in [js/world-marathon.js](js/world-marathon.js):
- `PAL.*` — palette colors at the top of the file
- `buildComposer()` — bloom strength (1.05) / radius (0.7) / threshold (0.92), vignette (1.45), grain (0.06), chroma (0.0025), grade vec3s
- `renderer.toneMappingExposure` (1.05) in `init()`
- `scene.fog` density (0.045) in `init()`
- Cryo pod positions in `init()` — currently `(-6/0/+6, 0, -10)`
- God ray intensity in `buildGodRays()` shader uniform (0.18)
- Dust particle count (220) in `buildDust()`

### What this is NOT
- Not a permanent replacement for the villa — it's a POC behind a flag, same as `?paint=1`
- Not the full Marathon ship — just one cryo bay
- Not a port of the villa's interior zoning, props, or click system
- Not toon/cel — fully PBR
- Not lower-poly — uses real PBR with shadows. Shouldn't be a perf problem on desktop, mobile may struggle with the transmission glass on the cryo pods (can drop to MeshStandardMaterial if needed)

### Next
Wait for the user's reaction at `?style=v2`. If the direction is right → next step is more rooms (engineering bay, bridge, supply cargo) connected by short walks, more click targets, real Marathon typography + signage. If the direction is wrong → revisit Marathon refs and tune palette/lighting/decals before adding scope.

## b052 — 2026-04-08 — Stylization pipeline (?style=v2): ACES + bloom + grade

User after b051: villa "looks like ugly runescape," wants a Destiny-grade visual upgrade. Honest read: Destiny is unreachable in-browser, but the *mood* (atmospheric haze, rim light, bloom-soaked horizon, color grading) is 100% reachable via post-processing. The current scene has zero tone mapping and zero post — that's most of why it reads as flat. Recommended path was post-processing first because it's the highest visible jump per hour and doesn't touch geometry.

### Activation
Behind a `?style=v2` URL query flag, mirroring the `?paint=1` pattern from b051:
- `cantmute.me/` → existing villa, byte-identical to b051
- `cantmute.me/?style=v2` → same villa rendered through the post-processing pipeline
- `cantmute.me/?paint=1` → painterly POC, untouched

When the flag is absent, every code path in `world.js` is unchanged. Every new line is inside an `if (stylized)` branch or guarded by `if (composer)`.

### Pipeline
1. **`renderer.toneMapping = ACESFilmicToneMapping`** + exposure 1.15 + sRGB output color space (only when stylized; default villa stays NoToneMapping)
2. **`RenderPass`** — renders the existing scene+camera into a linear HDR target. No scene changes.
3. **`UnrealBloomPass`** — strength 0.85, radius 0.55, threshold 0.85. Threshold is high so only the brightest emissives bloom (pool, neon signs, lambo emissives, lamps) — plaster walls stay clean.
4. **Custom `ShaderPass` — finishing pass:**
   - ASC CDL lift / gamma / gain color grade (slight cool shadows, warmer highlights, magenta lift)
   - Radial vignette (uVignette = 1.05)
   - Animated film grain (uGrain = 0.045, hashed against `uTime`)
5. **`OutputPass`** — applies ACES tone mapping + sRGB conversion at the very end (must be last). Reads `renderer.toneMapping` / `renderer.outputColorSpace`.

### Module loading
The five postprocessing modules (`EffectComposer`, `RenderPass`, `UnrealBloomPass`, `ShaderPass`, `OutputPass`) are lazy-imported in parallel via `Promise.all()`, only when `?style=v2` is present. They live in `three/examples/jsm/postprocessing/` and use bare `import 'three'` specifiers, which previously couldn't resolve from unpkg.

To make them resolve, [index.html](index.html) gained a `<script type="importmap">` block mapping `three` → `https://unpkg.com/three@0.160.0/build/three.module.js` and `three/addons/` → `https://unpkg.com/three@0.160.0/examples/jsm/`. The existing absolute-URL imports in `world.js` and `world-paint.js` are unaffected by the importmap (importmaps only resolve bare specifiers).

### Failure mode
If any of the five dynamic imports fail, the catch block logs a warning and leaves `composer = null`. `animate()` then takes the legacy `renderer.render(scene, camera)` branch — the user sees the unstyled villa instead of a black screen or crash.

### Files modified
- [js/world.js](js/world.js) — `composer` / `stylized` declarations near the top, URL flag check + tone-mapping setup after renderer creation, ~115-line composer build block after camera setup, render-path branch in `animate()`, composer resize in `onResize`, composer dispose in `destroy()`. All additive — no existing lines removed.
- [index.html](index.html) — `<script type="importmap">` block in `<head>` so `three/addons/postprocessing/*` can resolve their bare `'three'` imports
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b051 → b052`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### How to test
1. Hard refresh `cantmute.me/` → identical to b051. Compare against:
2. Hard refresh `cantmute.me/?style=v2` → ACES + bloom + grade + vignette + grain.
3. Hard refresh `cantmute.me/?paint=1` → painterly POC, untouched.
4. Resize the window in `?style=v2` → composer should track the renderer.
5. Switch tabs and come back → composer should clean up via `destroy()` and rebuild on next mount.

### Knobs
All tunable in [js/world.js](js/world.js) inside the `if (stylized)` block:
- Bloom: `strength=0.85`, `radius=0.55`, `threshold=0.85`
- Vignette: `uVignette=1.05`
- Grain: `uGrain=0.045`
- Color grade: `uLift / uGamma / uGain` vec3s
- Exposure: `renderer.toneMappingExposure = 1.15`

### What this is NOT
- Not a geometry change. Not a material change. Not a lighting change. Just a finishing layer on top of the existing PBR + shadow map pipeline from b047.
- Not toon/cel shading. The original recommendation was post-processing **first**, then optionally a stylized shader pass on top. Toon would require rewriting hero materials and is left for a follow-up if `?style=v2` lands well.

### Next
Wait for the user's reaction at `?style=v2`. If the direction is right → tune the knobs (bloom strength, grade), then either ship as the default (delete the flag, make it always-on) or layer on a toon/outline pass for the next jump. If wrong → revert is one delete pass on the `if (stylized)` blocks plus the importmap.

## b051 — 2026-04-08 — Painterly / watercolor POC (?paint=1 URL flag, fully isolated)

User after b050: "how can we drastically change so that the artstyle is actually different not small effects" → picked option 4 from the radical-options menu (painterly / watercolor with the Miami villa concept) → "poc pls idk just miami super rich vibes with stuff weve already talked about". This commit lands a fully isolated proof-of-concept the user can compare against the current b050 villa view without disturbing it.

### Activation
The POC is parallel, not a replacement. It lives behind a `?paint=1` URL query flag:
- `cantmute.me/` → boots into the existing b050 villa view (unchanged)
- `cantmute.me/?paint=1` → boots into the new painterly POC

The flag check is 3 lines in [js/app.js](js/app.js) at the bottom of the boot handler. If the POC is killed, those 3 lines + the new file + the index.html script tag are the only deletions needed.

### New file: [js/world-paint.js](js/world-paint.js) (~580 lines)
Self-contained painterly POC. Does not import, modify, or share state with [js/world.js](js/world.js). Registers as a 5th view named `'paint'`. Loads its own copy of three.js from the same CDN URL.

### What it builds
Intentionally minimal scope so the user can react to the *direction*, not the *completeness*:
- Procedural canvas paper texture (512×512, 9000 dab particles + 80 fiber lines + 14 wash blotches, drawn in JS at boot — no external assets)
- Brush-wash sky dome: warm coral horizon → deep magenta mid → indigo top, with sun disc + halo + cloud band noise + paper grain overlay
- Sand ground: warm beige with darker dab noise + color bleed
- Ocean: flat cyan-teal wash with painted-on horizontal brush strokes via noise
- Pool: small flat cyan with painted caustic strokes + slim cream marble rim
- Mansion shell: 3 walls + floor podium + upper floor slab + flat roof + 9-column colonnade + eyebrow cantilever + 4 entry steps. **NO interior rooms** — POC just shows the volume.
- 6 flat-card palms (deliberately back to b023 silhouette style — painterly works with flat shapes, not the b048 detailed 3D drooping fronds)
- 1 yellow lambo (3 boxes + 4 wheels) — click target
- 1 working click→card hookup: click the lambo → DOM popover appears with track 0 from `window.tracks`. Closes on button click. Same shape as the existing b026 system, just standalone in the POC file so it can be killed cleanly.

### The painterly material
`makePainterlyMaterial(opts)` is a custom ShaderMaterial — no PBR, no real lighting, no shadows:
- Flat base color
- + low-frequency world-pos noise color bleed (organic variation across flat surfaces)
- + soft top-down tint from `vNormal.y` (directional cue without real lights)
- × paper texture sampled from world XZ (tiles continuously regardless of mesh UVs)
- × faint warm wash overlay (pulls everything toward sunset palette)

The custom sky shader does horizon→mid→top gradient + sun disc + cloud band noise + paper overlay all in fragment.

### Camera + interaction
Simple orbit only. LMB drag rotates yaw/pitch. Wheel zooms radius. Click-on-prop opens the card. No first-person mode, no WASD, no anchor system, no R reset. The POC is "look at the look", not "explore the property."

### What's deliberately NOT in the POC
- Interior rooms (no zoning, no half-walls, no furniture)
- Multiple click targets (just the lambo)
- Camera anchors (no top-bar buttons in this view)
- Outline shader (Studio Ghibli backgrounds use no outlines on most things — flatter, more wash-like read)
- Cast shadows (the painterly aesthetic uses hand-painted shadow patches via vertex tweaks if at all, not real shadows)
- The full 22-room interior layout
- The 50+ forest pines, neighbor villas, lagoon, jet skis, yachts, etc.
- The post-process pass (no Sobel/CA/grain/dither — the painterly material handles the look at the surface level)

### Files modified
- [js/world-paint.js](js/world-paint.js) — NEW, ~580 lines
- [js/app.js](js/app.js) — 3-line `?paint=1` URL flag check at boot, plus `window.tracks = tracks` global so the POC card can read track titles
- [index.html](index.html) — `<script src="js/world-paint.js"></script>` after `world.js`
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b050 → b051`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### How to test
1. Hard refresh `cantmute.me/?paint=1` → loads the painterly POC
2. Hard refresh `cantmute.me/` → loads the existing b050 villa unchanged
3. Click the yellow lambo in the POC → song card appears

### Risks
- Painterly shaders are notoriously fiddly. If it looks wrong it usually means the paper is too strong, the bleed is too strong, or the top-tint is too contrasty — all 4 are uniforms in `makePainterlyMaterial` and tunable per-call.
- Mobile perf should be fine (single-pass render, no shadows, no PBR, ~50 meshes)
- This is the **5th** art-style attempt. If the painterly direction is also wrong, the next conversation needs to seriously consider option 1 (synthwave) or option 6 (drop 3D entirely) from the menu — not another fragment-shader retune.

### Next
Wait for the user's reaction at `?paint=1`. If the direction is right → promote to full villa view in b052 (port the painterly material + sky to world.js, replace `makePS2Material`/`makePainterlyMaterial`-of-b047, keep the b050 zoning + half-walls). If the direction is wrong → kill `world-paint.js` + the URL flag + revisit the radical-options menu.

## b050 — 2026-04-08 — Interior zoning: half-walls + floor tints + column rework

User on b049: "you seem to have struggled with every room. no idea why. everything is super open... uh i have no idea if youll do better with placement this time around." Six screenshots showed 4-6 rooms visible in every shot with zero separation between them. Diagnosis: the b041 mega-mansion was deliberately designed with "no interior partitions" — single 56×28 open volume per floor. Worked at 4 rooms, fails at 22.

User answered the four pre-code questions:
- Q1 (major views): "idk i just want to be able to float through and say this makes sense" → goal is layout coherence, not specific view protection
- Q2 (wall style): "half walls but i want more open feel rooms" → half-walls everywhere, lean open
- Q3 (which rooms walled off): "stay open" → no fully enclosed rooms
- Q4 (columns): "they're empty and kind of ugly" → rework or delete

### New helpers ([js/world.js:933](js/world.js#L933))
- **`addHalfWall(x1, z1, x2, z2, yBase)`** — 1.4m tall waist-height marble divider with a slim warm-wood top cap. Endpoints in any direction. Built from `roundedBoxGeometry` so it carries the b049 chamfered treatment. Sightlines flow over the top → zoning without view blocking.
- **`addDressedColumn(cx, cz, h, yBase)`** — 0.32-radius marble shaft with a 0.9×0.9 chamfered marble base + capital. Modernist take on classical orders. Replaces the b041 plain slim columns with something architectural.

### Column rework ([js/world.js:1003](js/world.js#L1003))
The b041 11-column 2-row grid (5 front + 6 back) was deleted. The slab is a render, not real physics — it doesn't need 11 supports. Replaced with **4 dressed hero columns** at architectural anchor points:
- 2 flanking the foyer entrance: `(-8, -5)` and `(8, -5)`
- 2 flanking the back archway: `(-5, -29)` and `(5, -29)`

7 columns deleted total. The remaining 4 read as deliberate architecture instead of structural stubs cluttering the open volume.

### Interior zoning block ([js/world.js:1881](js/world.js#L1881))
A new block runs just before the b042 phase 2 rooms section (so it lands before furniture is placed). Contents:

**9 ground-floor half-walls** zoning the rooms:
- West vertical (`x=-16`) splitting kitchen+garage from living, in two segments with a gap at the kitchen-to-garage transition
- East vertical front (`x=7`) splitting living from foyer/billiard
- East vertical back (`x=13`) splitting atrium/koi from trophy/aquarium
- Center horizontal (`z=-17`) splitting living from atrium with a 4-wide walkthrough gap
- East horizontal back splitting billiard/speakeasy from trophy/aquarium
- Speakeasy vs billiard divider at `x=14`
- Plus 2 west horizontals separating kitchen/garage/wine

**8 upper-floor half-walls** zoning the upstairs rooms:
- West vertical splitting studio from bedroom
- Bedroom vs closet vertical at `x=-7`
- Closet horizontal splitting closet from cinema
- Cinema vs guest vertical
- Library/DJ vs cinema vertical
- East horizontal splitting DJ/library from guest
- Plus studio horizontal splitting studio from piano

**17 floor tint planes** — one per room — at `+0.011` above the existing floor. Each tint is a `PlaneGeometry` with a per-room color drawn from a small palette table:
- Ground: garage (gray-brown), kitchen (warm cream), wine (deep wood), living (neutral travertine), atrium (cool stone), foyer (light marble), billiard (green-tinted), speakeasy (dark warm), trophy (gold-tinted)
- Upper: studio (cool dark), piano (warm wood), bedroom (warm cream), closet (bright marble), cinema (very dark), DJ (dark cool), library (warm wood), guest (warm cream)

All tints stay close to the base travertine — subtle "this room is slightly different" cue that combines with the half-walls to make rooms feel like rooms.

### What this should change visually
- Walking around the ground floor: as you cross from living into the foyer, a half-wall passes your hip and the floor tint shifts from neutral to warm cream → "I am now in the foyer"
- Aerial / orbit camera: instead of a furniture warehouse, you see distinct color-zoned cells with marble dividers between them
- Front view through the colonnade: your sightline still reaches the back archway, but the foreground reads as foyer / dressed columns / archway instead of "13 random rooms in one frame"
- The 4 dressed columns at the foyer + archway flanks frame those transitions instead of cluttering them

### Risk
- Half-walls run along straight lines without doors — entering a zoned room means walking around a wall end. With first-person camera dolly that's fine; with orbit it's invisible since you're 50m up.
- Floor tints might z-fight with the existing `groundFloorTop` / `upperFloorTop` planes if the +0.011 offset is too small. Watch for shimmer.
- Some half-wall positions might intersect existing furniture (wine racks at the back wall, kitchen island, billiard pool table). If anything pokes through, the wall coordinates can be tweaked individually.
- Library + DJ booth are at almost the same coordinates `(19, -9)` and `(20, -10)` — they overlap in the existing scene. b050 doesn't fix that; the half-wall between them is at `x=13` which separates them from cinema, not from each other. Out of scope.

### Files modified
- [js/world.js](js/world.js) — `addHalfWall` + `addDressedColumn` helpers added, 11-column block replaced with 4-column block, new INTERIOR ZONING block (~100 lines) added before phase 2 rooms
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b049 → b050`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### Next
Wait for the user's reaction to the zoning. If it works → next obvious moves are surface textures (L3) or detailed cars (L4) from the b049 lever menu. If specific walls or tints are wrong → tweak individual coordinates without rebuilding the whole zoning system. If the whole approach is wrong → revert b050 cleanly (single commit, all the new code is in two clearly-marked b050 blocks).

## b049 — 2026-04-07 — Rounded box geometry pass on the mansion shell

Second half of the b047 screenshot diagnosis. Where b048 fixed the cardboard palms, b049 fixes the **hard 90° corners** that were the other loud "Roblox" tell. The mansion shell is now built from a chamfered box helper instead of raw `BoxGeometry`.

### New helper: `roundedBoxGeometry(w, h, d, r)` ([js/world.js:787](js/world.js#L787))
Self-contained, ~30 lines. Builds a fully chamfered rounded box using `THREE.ExtrudeGeometry` on a rounded-rect `Shape` with beveled extrusion (`bevelSegments: 3`, `curveSegments: 4`). Fully chamfered on all 12 edges in a single mesh — no fragile stitching, no extra material allocations.

- **No external import.** Tried importing `RoundedBoxGeometry` from `three/examples/jsm/geometries` but the unpkg path requires an import map (the example file does a bare `from 'three'` resolve). The inline ExtrudeGeometry approach avoids that whole rabbit hole.
- **Auto-clamps the radius** so a thin wall (`wallT=0.4`, max safe radius 0.18) doesn't get a too-large bevel that eats the geometry. Falls back to plain `BoxGeometry` if the clamped radius drops below 0.01.
- **Translate fix:** ExtrudeGeometry with bevel spans `z ∈ [-r, d-r]`, so the geometry has to be translated by `(r - d/2)` to center on the local origin. Got the math wrong on the first pass (translated by `-d/2` which centered at `-r`); fixed before any callsites ran.

### Mansion shell BoxGeometry → roundedBoxGeometry
Surgical swap on the visible exterior pieces. Furniture, water shaders, decorative trim, sconces, and the ground/beach/ocean are all left alone — those aren't the offenders.

- **`addWallBox` + `addWallBoxOpenFront`** → `r=0.10` for all 4 wall sides on both floors. The ground floor + upper floor mansion shells now have softened vertical corners + softened top/bottom edges.
- **`upperFloorSlab`** → `r=0.12`. The cantilever floor edge visible from the front entrance is no longer a knife edge.
- **`addFlatRoofWithParapet`** → roof slab `r=0.10`, parapet sides `r=0.07`. The parapet now reads as a real architectural detail instead of stacked boxes.
- **Front cantilever balcony** (`balSlab` + `railCap`) → `r=0.10`/`0.04`.
- **Rooftop pavilion** (`pavRoom` + `pavPlinth` + `canopy`) → `r=0.18`/`0.12`/`0.10`. The pavilion box was one of the most prominent boxy elements in the b047 screenshot.
- **Front colonnade eyebrow** (`ebSlab`) → `r=0.10`. The 56-wide horizontal cantilever spanning the colonnade is now soft-edged.
- **Back archway** (jambs + lintel) → `r=0.06`/`0.10`.
- **Garage showcase plinth** → `r=0.08`.
- **Grand entrance steps + planters** → `r=0.06`/`0.14`. The 4 marble steps + 2 corner planters at the front entrance.
- **`cFloorLine`** marble cantilever band → `r=0.10`.

### Left as plain BoxGeometry (intentional)
- The big sand `ground` plane (already flat, no edges visible)
- Pool / jacuzzi / pool rim (water + travertine, edges hidden by water)
- Wall sconces, LED strips, cove glow (too small to show chamfering, would just cost polys)
- Glass panes (`railPane`, `pavFront`, `voidBox`) — flat panes, no thickness to chamfer meaningfully
- The interior furniture across all 22 rooms (out of scope for this commit; if the rounded shell looks right, furniture can be a follow-up)

### What this should change visually
- Every wall corner of the mansion now reads as a soft chamfer instead of a knife edge — that's the single biggest "stops looking like Roblox" delta available without changing the architecture.
- The cantilever balcony, the upper floor slab, the colonnade eyebrow, and the rooftop pavilion all get soft edges that catch the directional sun's specular highlight differently along the chamfer than along a flat face. This was invisible under the b045 PS2 shader; under b047 PBR it should produce visible edge highlights.
- The grand entrance steps + planters at the front of the mansion are the closest geometry to the camera in the orbit-front view — they'll show the chamfering most prominently.

### Risk
- ExtrudeGeometry produces more verts than BoxGeometry (~120 vs 24 per box). ~25-30 mansion pieces converted ≈ 3000 extra verts in the shell. Should be invisible to perf.
- If the b048 palm meshes already pushed the GPU close to its budget, this might be the straw that breaks the camel's back. Watch the framerate — if it drops, the palm fix can stay (it's the more important visual win) and the rounded shell can revert.
- Bevel artifacts on extremely thin pieces (<0.04 thick) — the auto-clamp + the plain-BoxGeometry fallback at `r<=0.01` should prevent this, but worth visual-checking.

### Files modified
- [js/world.js](js/world.js) — `roundedBoxGeometry` helper added, `addWallBox`/`addWallBoxOpenFront`/`addFlatRoofWithParapet` swapped, ~12 standalone mansion shell meshes swapped
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b048 → b049`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### Next
b048 + b049 are the two-prong fix for the b047 "still looks like Roblox" screenshot. Wait for the user's reaction before doing anything else. If they like the direction, the next obvious moves are: (a) procedural canvas textures (L3) for plaster/marble/sand/wood, (b) detailed cars (L4), or (c) ground variation (L5). If they don't like it, both commits are independently revertable.

## b048 — 2026-04-07 — Rebuild palm trees: real 3D fronds + drooping curve + coconuts

User on b047: "graphically, it looks blocky like Unturned or roblox. still ugly." Diagnosed from screenshot: lighting is fixed but the geometry blockiness is now fully exposed. Two loudest tells were (a) hard 90° corners on every mansion box and (b) the palm fronds being literal flat PlaneGeometry cards reading as cardboard cutouts from any angle. b048 fixes (b); b049 will fix (a).

### `addPalm` rewritten ([js/world.js:1234](js/world.js#L1234))
- Trunk: was a single 5-side cylinder. Now an 8-segment 10-side stack with subtle radius taper (0.34 → 0.14) + a sin-curve S-lean across its height. Reads as a real bowed palm trunk.
- Fronds: was 9 flat `PlaneGeometry(3.0, 0.55)` cards radiating from the top. Now 10 fronds, each built as a **2-segment chain of 6-side `ConeGeometry` prisms** — upper segment angled out + slightly down, lower segment droops more steeply at the tip of the upper. Real 3D volume from any angle, with a curve instead of a straight stick.
- New: small **coconut cluster** in the crown — 5 dark sphere bunches around the trunk top.
- `coconutMat` declared once at the top of the palm section (alongside `trunkMat`/`frondMat`) to avoid 13× allocation across the addPalm callsites.

### What this should change visually
- The forest of cardboard X's around the mansion + pool + lawn becomes a forest of actual palms with volumetric drooping fronds and coconuts.
- Cast shadows from b047 will now project frond-shaped shadows on the ground instead of stick-shadows.
- The S-curve trunk + droop curve makes them read as Caribbean/Miami palms instead of generic upright sticks.

### Risk
- 13 palms × (8 trunk segments + 20 frond cones + 5 coconut spheres) = ~430 new meshes from this change. The b047 PBR pipeline + cast shadows will eat that. If FPS dies, drop to 6 fronds + 4 trunk segments.
- The coconuts might read as too dark if the directional sun isn't hitting them — they're using a near-black material.

### Files modified
- [js/world.js](js/world.js) — `addPalm` rewritten, `coconutMat` declaration added
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b047 → b048`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### Next
b049: RoundedBoxGeometry pass on the mansion shell. This commit is isolated so the user can judge the palm change on its own before the bigger shell change lands.

## b047 — 2026-04-07 — Path A art-style rebuild: real PBR + cast shadows + full resolution + conifer trees

User: "path a but with some geometry changes yknow can u build it out and git commit so when i come back from showr 10 mins i can see something we can do in new chat give me the prompt tho".

**The big swap.** Replaces the entire b010-b046 PS2+ pipeline (custom 3-light fragment shader + 854×480 low-res render target + bloom + Sobel + film grain + CA + grade + dither + scanlines + vignette) with **real Three.js PBR + actual cast shadows** at full canvas resolution. Plus a quick conifer geometry fix as the requested geometry change.

This is the "Path A" recommendation from b046's section 8 of HANDOFF.md. Three failed mansion rebuilds + one failed cel shading + the b026b debug outline discovery convinced both of us the PS2 aesthetic was the wrong target. Time to embrace clean modern instead of fighting Roblox.

### Material factory swap
- `makePS2Material(opts)` now returns a `THREE.MeshStandardMaterial` instead of the custom ShaderMaterial. Same signature so all ~80 callsites still work. opts.color → color, opts.emissive → emissive, opts.emissiveAmt → emissiveIntensity, plus optional opts.roughness/opts.metalness with sane defaults (0.65 / 0.05).
- Old custom shader factory renamed to `_DEAD_makePS2Material` and left in place temporarily so its closure references to lampPos/poolPos/windowPos/cycleUniform don't TDZ. Will delete in a follow-up cleanup commit once the new pipeline is verified.

### Renderer changes
- `antialias: true` (was false)
- `setPixelRatio(min(devicePixelRatio, 2))` (was 1) — full resolution, capped at 2 so retina laptops don't melt
- `shadowMap.enabled = true`, `shadowMap.type = PCFSoftShadowMap`
- Render directly to canvas (was render-to-target → upscale-quad)

### Real lights added (after camera creation)
- **DirectionalLight** as the sun: warm `0xffd9a8`, intensity 1.4, position (40, 50, 25), target (0, 0, -10), `castShadow=true`, 2048×2048 shadow map, ortho frustum -55..+55 covering the mansion footprint, `bias=-0.0002`, `normalBias=0.05`
- **AmbientLight**: cool dusk `0x6a4a78`, intensity 0.45 — keeps the dark side from going pitch black
- **HemisphereLight**: warm sky `0xff9070` / cool ground `0x402060`, intensity 0.55
- **3 PointLights** at the existing lamp / pool / window positions: warm `0xffaa50` deck lantern, cyan `0x40e8e8` pool, warm `0xffc070` window. Decay 1.6, distance 18-24. (No shadows on the points to save GPU.)

### Shadow flags
After the entire scene is built, one `scene.traverse()` call sets `castShadow = true` and `receiveShadow = true` on every Mesh that uses a non-shader material. Water shaders (pool/ocean/lagoon) and the sky dome are skipped because they're custom ShaderMaterial.

### Render loop
The `animate()` 2-pass render (low-res target → upscale post quad) is replaced with a single direct `renderer.render(scene, camera)`. The low-res render target + post pipeline (bloom, Sobel, film grain, CA, grade, dither, scanlines, vignette) is no longer in use — the post setup code still runs in init for now (creates the dead target + post quad) but doesn't get rendered. Cleanup commit will delete it.

### Geometry: conifer trees rebuilt
The b034b `addPineTree` was 4 stacked tapering cones — every layer's edge silhouetted into chunky steps that read as Minecraft pine. Replaced with a **single tall 16-sided cone** (full taper from radius 2.2 base to 0 top) + a small lower skirt for organic fullness. Trunk slightly thicker + taller (8-side cylinder, radius 0.34). The whole forest (~50 trees in the loop driveway rings + back jungle wall) reads as smooth conifer silhouettes now.

### What this should change visually
- **Real cast shadows** from the directional sun across the mansion deck, pool, garage, colonnade, cars, palm trees, etc.
- **Full canvas resolution** instead of 854×480 — sharp text, sharp edges, no upscaled pixel chunks
- **Antialiased edges** instead of nearest-neighbor staircase
- **PBR lighting** on plaster + marble + travertine + chrome (with the default roughness 0.65 / metalness 0.05)
- **Smoother conifer trees** in the forest
- **Three real point lights** at the lamp/pool/window positions instead of the fake shader uniform versions
- **No more bloom / Sobel / film grain / CA / dither / scanlines / vignette** — clean modern look

### Risk
- Performance: cast shadows on every mesh + full resolution might be slower than the 854×480. Set shadow map to 2048 (moderate). Mobile users get a smaller window so it should be OK. If perf is bad, drop shadow map size to 1024 or disable cast shadows on background props.
- The 3 water shaders (pool/ocean/lagoon) still use the old custom ShaderMaterial pipeline. They have their own fog uniforms + lighting math. They might look slightly out of place against the new PBR-lit mansion. Verify visually.
- The sky shader is still the b044 procedural gradient + sun disc + clouds. Should look fine with the new pipeline since it's a separate dome.
- The day/night `cycleUniform` no longer drives anything in `makePS2Material` (the new MeshStandardMaterial doesn't read it). Sky still uses it. Could rotate the directional sun light by uCycle for a real day/night cycle in a follow-up.

### Files modified
- [js/world.js](js/world.js) — `makePS2Material` swap, renderer config, real lights block, animate render swap, scene traverse for shadow flags, `addPineTree` rewrite. ~120 lines added, ~10 lines deleted (most of the b010-b046 PS2+ shader plumbing is just unreachable now, will clean up in a follow-up)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b046 → b047`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump
- [HANDOFF.md](HANDOFF.md) — needs another update next round once we see how this looks; section 8's "Path A" decision is now executed

### Next chat
The user is going to start a new conversation. Read [HANDOFF.md](HANDOFF.md) first, then this entry. The big open question for the new chat is "did Path A actually fix the look?" If yes → continue cleaning up (delete dead post pipeline, delete `_DEAD_makePS2Material`, hook the directional sun rotation to the day/night cycle, maybe add subtle textures). If no → re-read this entry, look at the screenshot, decide whether to tune the lighting or pick a different path.

## b046 — 2026-04-07 — Revert b044 toon shading + massive HANDOFF.md rewrite (b017 → b046)

User: "cel shading looks terrible. and the art style graphics themselves look blocky and awful. is there anything we can do to rebuild or change? update files to u have better memory like a working final md or something this chats context getting heavy".

### Reverted b044 toon/cel shading
The 3-band stepped lighting in `makePS2Material` was producing visible color banding on every flat surface and looked worse than the smooth original. Reverted both:
- `pointLight()` N·L term back to smooth `0.18 + ndl * 1.05` (was `0.10 + toonRamp(ndl) * 1.20`)
- Directional sun term back to smooth `sunNL` (was `toonRamp(sunNL, 3.0)`)
- Ambient back to `0.18, 0.12, 0.28` (was `0.14, 0.10, 0.24`)
- Hemi multiplier back to `0.85` (was `0.80`)
- Sun color back to `1.20, 0.75, 0.45` × 0.65 (was `1.30, 0.78, 0.45` × 0.85)

### KEPT from b045 (these were the wins)
- DELETED b026b debug yellow BoxHelper outlines (35 yellow wireframes drawn over the scene every frame — secret root cause of the persistent "Roblox" feeling)
- Sobel outline shader from depth buffer
- Animated film grain (uTime-driven)
- Chromatic aberration at start of post pass
- Stronger color grade (gamma 0.85, sat +45%, contrast +18%, split-tone)
- Stronger vignette (cool tinted)
- Cooler fog color (`0x6a1850` → `0x382048`)

### KEPT from b044 (these were also wins)
- Sky shader sun disc + glow + flare + cloud bands
- (The smooth lighting hemi/sun terms are now back to b043 values)

### Massive HANDOFF.md rewrite
Was last updated at b017. Currently at b046. **28 builds out of date.** Rewrote the entire file with current state — render pipeline, mansion architecture (b041 mega rebuild), all 22 interior rooms (b029 + Phase 2 b042 + Phase 3 b043), camera system (b014/b032/b038/b039 dual-mode + WASD + pan + dolly), click→card system, what's been deleted, the 28-build art-style attempt history, and a clear section 8 capturing the current open problem (art style still wrong) with the rebuild options on the table. Also added section 14 with approximate line ranges for the major sections of [js/world.js](js/world.js) (~3900 lines now) so a future chat can navigate without grepping for an hour.

### Files modified
- [js/world.js](js/world.js) — `makePS2Material` frag shader: removed `toonRamp` helper, reverted `pointLight()` to smooth, reverted sun term to smooth, reverted ambient + hemi multiplier + sun color to b043 values
- [HANDOFF.md](HANDOFF.md) — full rewrite, 271 lines → ~440 lines, updated through b046
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b045 → b046`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### Next step (NOT this commit)
Section 8 of the new HANDOFF lays out the current open problem (art style) and the options on the table. The user needs to pick a direction before more code is written. Do NOT just attempt another art-style fix without discussing it first — three failed mansion rebuilds + one failed cel shading is enough.

## b045 — 2026-04-07 — Kill debug outlines + Tier 1 post-process overhaul (Sobel outlines, film grain, CA, stronger grading, cooler fog)

User: "still too blandy blocky and roblox like i think we gotta improve and upgrade overall artstyle honestly".

Diagnosed: 2 root causes layered on top of each other.

### Root cause #1 — debug yellow wireframe outlines on EVERY clickable prop
The b026b dev block (`scene.traverse + new THREE.BoxHelper(obj, 0xffee00)` with `depthTest: false, opacity: 0.9, renderOrder: 999`) was added as a "show me which props are wired up to song cards" dev aid and never cleaned up. With Phase 2 + 3 adding 15 new clickable props on top of the original 20, **every car / lambo / TV / pool table / aquarium / piano / guest bed / pier / yacht / fountain etc. was getting a depth-test-off bright-yellow wireframe drawn on top of it**. That single block was probably the biggest contributor to the persistent "looks like Roblox" feeling — debug wireframes on top of every prop. Block deleted.

### Root cause #2 — post-pass was too gentle to actually transform the look
The b036/b028 post pass had bloom + tone curve + faint scanlines + Bayer dither + subtle vignette but no edge work, no animated grain, no chromatic aberration, no real color grade. Net effect: looked like the raw renderer with a slight curve. Tier 1 overhaul:

### New post-process effects

- **🖍️ Sobel outline shader from the depth buffer** — new `tDepth` uniform sampling the existing `depthTex` (already attached to `lowResTarget`). Sobel kernel runs across 8 neighbors of each pixel, computes the gradient magnitude, and `smoothstep(0.0008, 0.0030, edge)` produces a soft 1-2px contour line that darkens by 78% wherever there's a depth discontinuity. Instantly stylizes silhouettes — the difference between Borderlands and a generic engine.
- **🌈 Chromatic aberration at the start of main()** — `vec2 caOffset = (vUv - 0.5) * 0.0040`, sample R at `vUv - caOffset`, G at `vUv`, B at `vUv + caOffset`. ~2px split at the corners. Reads as "shot through a lens" not "raw render".
- **🎞️ Animated film grain** — new `uTime` uniform pushed into `timeUniforms[]` so animate() drives it every rAF tick. Hash `grainHash(vUv * 1024 + uTime * 60)` shifts the noise pattern per frame, ±0.05 amplitude. Hides the staticness of the rendered output.
- **🎨 Stronger color grade** — gamma `0.92 → 0.85` (deeper midtones), saturation `+32% → +45%`, contrast `+8% → +18%`. Plus a **split-tone**: shadows tinted toward cool blue `vec3(0.45, 0.55, 0.85)`, highlights toward warm orange `vec3(1.20, 0.95, 0.70)`, mixed by luminance. The whole frame now reads as a graded sunset image.
- **🌑 Stronger vignette** — falloff range `1.1..0.4 → 0.95..0.30`, slight cool tint `vec3(0.82, 0.78, 0.92)` at the edges. Pulls focus inward.

### Cooler fog color
The b028/b036 fog was `0x6a1850` (rich hot magenta) at density `0.0055`. Hot magenta + the toon shading + bloom was producing the persistent pink wash drowning every distant surface. Shifted to `0x382048` (deeper purple-blue, less hot) across all 5 declarations:
- `scene.fog`
- `makePS2Material` `uFogColor`
- pool shader `uFogColor`
- ocean shader `uFogColor`
- lagoon shader `uFogColor`

Density unchanged (0.0055 still). The scene is still dusky/atmospheric but the magenta no longer eats everything.

### What this should change visually
- **Yellow wireframes on every prop GONE** — the screen is no longer covered in 35 yellow boxes
- **Dark contour outlines** on every silhouette edge (mansion, columns, cars, palms, koi pond, aquarium, etc.) — instant illustration look
- **Less pink/magenta wash** in the distance, atmosphere reads as cooler dusk
- **Deeper colors + stronger contrast + split-tone** = shadows feel cool, highlights feel warm orange — proper sunset grade
- **Animated film grain** moving across the frame at 60fps so the image doesn't read as static
- **Lens chromatic aberration** at the corners — slight RGB split
- **Stronger vignette** drawing the eye to the center of the frame

### What's NOT in this commit
- Tier 2 (rounded box geometry) — saved for b046 if Tier 1 alone isn't enough
- Cast shadow maps — still risky in one commit, deferred

### Files modified
- [js/world.js](js/world.js) — b026b debug outline block deleted (~22 lines), post pass shader rewritten (CA + Sobel outline + grain + stronger grade + stronger vignette + new tDepth/uTime uniforms), 5 fog color references shifted via `replace_all`, postMaterial uTime registered in timeUniforms[]
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b044 → b045`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b044 — 2026-04-07 — Tier 3 art-style upgrade: toon-stepped lighting + sun disc + cloud bands

User: "everything still looks so friggin robloxly and blocky, what can we do to change the art style? ... id love to see tier 3 in action first honestly".

Tier 3 of the recommended fix list. Replaces the smooth N·L lighting in `makePS2Material` with a **stepped toon ramp** (Borderlands / Sable / Death's Door look), and gives the sky an actual **sun disc + drifting cloud bands** instead of a flat 3-color gradient.

### Toon shading in makePS2Material
- New `toonRamp(v, bands)` GLSL helper — quantizes a smooth 0..1 light value into N stepped bands with a small `smoothstep(0.42, 0.58, ...)` at each band edge so the transition reads as a soft contour line, not aliased.
- **`pointLight()`** — N·L term now wrapped in `toonRamp(ndl, 3.0)` instead of the smooth `0.18 + ndl * 1.05`. Each surface reads as 3 distinct light steps (shadow / mid / lit) in the pool of light from each lamp/window/glow source.
- **Directional sun term** — `sunNL` wrapped in `toonRamp(sunNL, 3.0)`. Sunset now casts hard contour shadows on the mansion walls + ground from the +x/+y "sun" direction. Sun color bumped slightly (`vec3(1.30, 0.78, 0.45)` vs `1.20, 0.75, 0.45`) and intensity 0.65 → 0.85.
- **Hemispheric fill** — kept SMOOTH (it's ambient/global, banding it would look like noise). Toon ramp is applied only to directional terms.
- Ambient slightly darker (`0.18, 0.12, 0.28` → `0.14, 0.10, 0.24`) so the toon bands pop harder.
- `pointLight()` band weight 0.18+ndl·1.05 → 0.10+ndl·1.20 for sharper contrast between shadow and lit bands.

### Sky shader upgrade
- New `noise2()` GLSL helper — value noise with smooth interpolation for soft cloud sampling.
- **Sun disc** — `smoothstep(0.984, 0.995, dot(vDir, sunDir))` produces a hard bright circle in the sunset direction. Color crossfades from warm sunset orange to cool moon at night via `uCycle`.
- **Sun glow** — `pow(sunCos, 28.0)` softer hot halo around the disc, fades out at night.
- **Sun flare** — `pow(sunCos, 6.0)` even wider warm gradient lifting the horizon palette near the sun.
- **Cloud bands** — value noise sampled across `(atan(vDir.z, vDir.x), h)`, two octaves (`uv` and `uv * 2.3`), masked to the lower-mid sky (h between -0.05 and 0.50) with a smooth band fade. Tinted by current sky palette so they read as part of the dusk.

### What this changes visually
- Mansion + ground get **3-band cel-shaded sun lighting** at sunset — hard contour shadows where the sun catches the upper floors / cantilever balcony / colonnade. Walls visibly STEP in brightness instead of fading smoothly.
- Lamp / pool / window light pools also step in 3 bands — each pool of light has a clear "core / mid / edge" instead of a smooth gradient.
- Sky has an **actual visible sun** instead of a flat horizon gradient.
- Drifting **cloud bands** at the horizon instead of dead flat colors.
- The whole scene reads "stylized" not "engine output".

### What's NOT in this commit
- Real cast shadow maps (Tier 3 also lists this — too risky in one commit, the PS2 shader doesn't use Three's lighting system so plumbing shadow maps in is invasive)
- Texture atlas (Tier 3 also lists this — major work, unclear payoff with the PS2 aesthetic)

### Files modified
- [js/world.js](js/world.js) — `makePS2Material` frag shader (toon ramp helper, stepped pointLight + sun term, ambient/contrast tweaks), sky frag shader (noise2 helper, sun disc + glow + flare + cloud bands)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b043 → b044`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### Next planned tiers
- **b045 — Tier 2**: rounded box geometry helper + apply to mansion shell + key furniture (kills the sharp 90° corner look). Plus optional vertex displacement noise on big flat surfaces.
- **b046 — Tier 1**: post-process overhaul (Sobel outline shader + animated film grain + vignette + chromatic aberration + stronger color grading)

## b043 — 2026-04-07 — Mega-mansion Phase 3: foyer + staircase + speakeasy + wine cellar + library + piano + guest bedroom + rooftop pool + 12 more palms

User: "proceed".

Phase 3 of the mega-mansion. 7 more interior zones + the rooftop pool feature, plus 12 extra scattered palms (user wishlist). Pure open-plan, non-grid layouts.

### 7 new rooms

**Ground floor (3):**
1. **🏛️ Foyer + grand staircase** (`grand_stair`) — front-east transition zone, x=11 z=-7. **14-step curved sweeping marble staircase** ascending from ground to upper floor in a quarter-circle arc (radius 6.0, sweep -30° to +60°). Each step rotated to follow the curve. 2 tall marble newel posts with sphere caps at the bottom + entry rug. Truly non-grid.
2. **🍸 Speakeasy bar** (`speakeasy_bar`) — front-east, x=17 z=-9. **3-segment curving bar counter** (left + right segments angled ±10°), continuous wood top spans all 3, 5 tall stools facing south. 6 emissive bottles in alternating colors (warm + cyan + magenta + cool yellow) on a back shelf. Magenta neon "BAR" sign above.
3. **🍷 Wine cellar / tasting** (`wine_rack`) — back-west ground, x=-21 z=-24. 3 tall dark wood wine racks against the back wall, each with an 8×6 grid of dark red emissive bottle dots (144 bottles total). **Round marble tasting table** in front with 3 chairs around it + 3 wine bottles on the table.

**Upper floor (3):**
4. **📚 Library** (`library_books`) — front-east upper, x=19 z=-9. 3 tall dark wood bookshelves against the back, each with 5 horizontal dividers and **60 colored book boxes per shelf** (180 books total in 6 alternating spine colors). Reading chair + side table with warm-glow lamp.
5. **🎹 Piano / songwriting room** (`piano`) — back-west upper, x=-19 z=-23. **Grand piano with curved tail** built as a main rectangular body + 4 tapering box segments at angles to suggest the wing. Pale keyboard slab + black key strip overlay + 3 cylindrical legs + bench + angled music stand with sheet music.
6. **🛏️ Guest bedroom** (`guest_bed`) — back-east upper, x=18 z=-23. Bed frame + mattress + 2 pillows + headboard + nightstand + warm lamp + 3 abstract artwork squares above the bed (red, green, gold).

**Rooftop (1 zone, multiple features):**
7. **🏊 Rooftop pool + hot tub + open-air DJ deck** (`rooftop_pool`) — Long 12×4 cyan emissive infinity pool centered on the roof. Round hot tub off to the east. 4 sleek chaise loungers around the pool with magenta cushions. Open-air DJ table on the west end with 2 cyan jog wheels + 2 magenta LED bar uplights. Tall marble planter with topiary on the east end.

### 12 more scattered palms (user wishlist: "palm trees yess")
Added across the front lawn area at varied positions (x = ±18, ±22, ±30, ±36 / z = 4 to 38), heights 5.6-7.0. Frames the mansion better and adds depth from any angle.

### 7 new propTracks entries (track indices 28-34)
`grand_stair`, `speakeasy_bar`, `wine_rack`, `library_books`, `piano`, `guest_bed`, `rooftop_pool`.

### 7 new camera anchors
`FOYER`, `SPEAKEASY`, `WINE`, `LIBRARY`, `PIANO`, `GUEST`, `ROOFTOP` — first-person except ROOFTOP which uses orbit mode (cy=11, radius=28) for the wide rooftop overview. Total anchors now: **22**.

### Files modified
- [js/world.js](js/world.js) — propTracks (+7 entries), 7 room interior blocks (~390 lines), camera anchors (+7 entries), 12 more `addPalm` calls
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b042 → b043`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### Phase 3 status
**Mansion is now ~22 rooms across 2 floors + rooftop**. Still room for more — possible Phase 4 additions: 2nd guest bedroom, formal dining (separate from kitchen), butler's pantry, gym/yoga room, observatory dome, helipad on rooftop, sky bridge, breakfast nook, art gallery hall. Plus the user's wishlist sky bridge (TBD design).

## b042 — 2026-04-07 — Mega-mansion Phase 2: 8 new room interiors + camera anchors

User: "a 8 proceed but i want room for more just incase more rooms yknow ... u can do interesting layouts too doesnt have to be super grid based".

Phase 2 of the mega-mansion rebuild. Pure open-plan (no interior walls) — rooms are defined by furniture clusters tagged with click→card targets and camera anchors flying to each zone. Layouts deliberately non-grid where it makes sense (curved aquarium tunnel, fan-shaped cinema seating, circular DJ platform, koi pond as a real circle, recording studio rotated 15° off-axis).

### 8 new rooms

**Ground floor (4):**
1. **🍽️ Kitchen + Dining** (`kitchen_island`) — west-mid, x=-11 z=-14. Long marble table angled 12° off-axis with 8 dark chairs flanking the long sides. Chef's kitchen island in dark stone behind it with 3 warm pendant lights + 3 bar stools facing south. Tall glass wine fridge against the back area.
2. **🐠 Aquarium tunnel** (`aquarium`) — east side, 6 box segments at slight angles to suggest a gentle curve through the floor (z=-8 to z=-27). Cool blue/cyan emissive glass walls, 8 dark fish silhouette icosahedrons floating mid-water, marble plinth running underneath.
3. **🌿 Indoor jungle / Koi pond / Waterfall** (`koi_pond`) — center back, replaces the b029 atrium furniture. Real circular pond (CylinderGeometry r=3.4) with stone rim and 6 orange/white koi rotated to face their swim direction. Three-tier marble waterfall with cyan emissive cascade sheets. 3 jungle palms in the corners (trunks + 5 angled fronds each).
4. **🏆 Trophy hall** (`trophy_case`) — back-east, between billiard and aquarium. 5 marble pedestals in a slight arc, each with a glass display case containing a gold or platinum record disc (alternating).

**Upper floor (4):**
5. **🎙️ Recording studio** (`recording_console`) — west upper, **rotated -15° off-axis** for the L-shape feel. Mixing console + 2 studio monitors + central screen + producer chair + glass iso booth at 90° to the main desk with mic stand inside.
6. **🎬 Home cinema** (`cinema_screen`) — back upper, **fan-shaped seating**. Big emissive screen on the back wall, 2 rows of 5 theater seats curving toward the screen with each seat slightly rotated to face the center.
7. **🎚️ DJ booth / Club** (`dj_booth`) — east upper, **circular raised platform** (r=2.4 cylinder). Wide CDJ deck with 2 cyan emissive jog wheels, mirror ball hanging above, 4 magenta LED uplight bars positioned around the platform.
8. **👗 Master suite expansion** (`walk_in_closet`) — adjacent to the existing bedroom. Walk-in closet with marble runway + 2 hanging rods (12 garment silhouettes), display shoes on a back shelf. Master bath with a soaking tub at a 45° angle, marble vanity with 2 chrome faucets.

### New propTracks entries (track indices 20-27)
`aquarium`, `koi_pond`, `cinema_screen`, `trophy_case`, `kitchen_island`, `recording_console`, `dj_booth`, `walk_in_closet`. Will wrap with `% tracks.length` if config.json has fewer than 28 tracks.

### New camera anchors (8)
`KITCHEN`, `AQUARIUM`, `KOI POND`, `TROPHY`, `STUDIO`, `CINEMA`, `DJ BOOTH`, `CLOSET` — all first-person mode at the appropriate floor (py=3.0-3.5 for ground, py=8.0-8.5 for upper). The existing 7 anchors (POOL/BEACH/AERIAL/LIVING/BEDROOM/BILLIARD/INDOOR) stay unchanged. AERIAL radius bumped from 42 → 50 to fit the larger 56×28 footprint. Total anchors: 15.

### Room for more (later phases)
The mansion has plenty of empty space remaining. Phase 3 candidates: foyer + grand staircase, library, speakeasy bar, wine cellar/tasting room, piano + songwriting room, 2 guest bedrooms, rooftop pool + hot tub + open-air DJ deck. Plus the user's wishlist: more palm trees scattered, sky bridge.

### Files modified
- [js/world.js](js/world.js) — propTracks (+8 entries), 8 room interior blocks (~570 lines added after the BILLIARD block at line 1550), camera anchors (+8 entries, AERIAL radius bump). Net **~600 lines added**.
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b041b → b042`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b041b — 2026-04-07 — Move forest pines out of the new mansion footprint

User: "trees inside the mansion gotta be moved elsewhere".

The forest pine array `forestPines` had 6 "road shoulder" trees at `[±7, -10]`, `[±7, -16]`, `[±8, -24]` — sized for the old 32×14 mansion (back wall at z=-17) so they sat just behind it. The new b041 56×28 mansion has its back wall at z=-31, putting all 6 trees INSIDE the new mansion footprint. Plus the inner-ring trees at `[±16, -32]` were just barely outside (-32 vs back wall -31) — pushed back to `-36` for breathing room.

### Files modified
- [js/world.js:2336-2340](js/world.js#L2336-L2340) — 6 road-shoulder trees deleted, 2 inner-ring trees pushed from z=-32 to z=-36
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b041 → b041b`
- [CHANGELOG.md](CHANGELOG.md) — this entry

## b041 — 2026-04-07 — Mega-mansion Phase 1: tripled footprint, full upper-floor slab, single open volume

User: "i lowkey still hate the new mansion it only has the rooms we mentioned. time to talk new mansion, its gotta be huge to be honest ... no basement cuz itll fuck with the flooring. but we can multi level the open air design but make sure theres floors for second layer ... build it im curious".

4th attempt at the mansion. The previous 3 (b025/b037/b039) all kept the same 32×14 U-footprint and just changed surface details — the wrong move. A huge mansion has to actually BE huge. This is **Phase 1** of the mega rebuild: shell + structure + walkable upper floor. Phase 2 (b042) adds the new room interiors.

### Footprint
- **56 × 28** (mansionW × mansionD) — ~3× the b025-b040 32×14 U-shape
- Centered at `mansionCx=0, mansionCz=-17`
- x range: `-28 to +28` (was -16 to +16)
- z range: `-31 to -3` (was -17 to -3 — front face stays at -3 so the colonnade + pool deck don't move)
- Ground floor `mansionH1 = 5.0` (was 4)
- Upper floor `mansionH2 = 4.5` (was 4)
- Roof at `mansionRoofY = 10.32` (was 8.82)

### Single open volume — no more 3-block U
Replaced central + east wing + west wing + east drum + west drum + standalone garage with **one big 56×28 shell**. 3 walls (back + east + west), front fully open, no interior partitions. The whole ground floor is one continuous open space the user can walk through.

### Real walkable upper floor (the user's "second layer floors")
- **Structural slab box** spanning the entire 56×28 minus wall thickness, centered at `y = podiumTopY + mansionH1 - 0.15` so its top sits at exactly `podiumTopY + mansionH1` (= bedroom Y).
- **Travertine plane on top** of the slab at `y = podiumTopY + mansionH1 + 0.01`. The actual walkable surface.
- 11 internal structural columns supporting the slab (6 back row at z=-29, 5 front row at z=-5), positioned to avoid collision with the existing LIVING (x=0±5, z=-14..-4) / BEDROOM (x=-11.5±2, z=-12..-7) / BILLIARD (x=11.5±2.5, z=-13..-5) / INDOOR (x=0±8, z=-17..-29) furniture clusters.

### Backward-compat aliases for the b025-b040 interior rooms
LIVING/BEDROOM/BILLIARD/INDOOR all reference `villaCx`/`villaCz`/`centralW`/`wingW`/`westWingCx`/`eastWingCx`/`wingH1`/etc. These constants are kept as aliases over the new mansion constants so the rooms still place correctly. Critical change: `wingH1` and `wingH2` bumped from `3` and `3` to `5.0` and `4.5` so the bedroom Y placement (`bdY = podiumTopY + wingH1 = 5.82`) matches the new upper-floor surface exactly.

### Other shell pieces
- **Front cantilever balcony** — 52 wide × 3 deep slab projecting forward from the upper floor at the roof level, frameless cool-glass rail, marble cap.
- **Roof slab + parapet + travertine rooftop terrace** spanning the entire 56×28.
- **2 cylindrical corner drums** (radius 3.0, full mansion height) at the front-left and front-right of the mansion. Cool glass band at the upper floor level. Curved silhouette on both ends.
- **Rooftop pavilion** (5×5×4 marble plinth + cube + glassMat front + cantilever canopy + 2 columns + 2 sconces) carrying the `bell_tower` click→card target.
- **Front colonnade**: 9 slim white columns spanning the full 56-wide front, supporting a horizontal cantilever eyebrow slab + warm cove glow strip on the underside.
- **Back archway** (open marble jamb + lintel + podium-colored void box) at center-back.
- **Garage zone** integrated into the ground floor at x=-28..-16: marble showcase plinth + LED accent strip on the back wall. The yellow lambo at (-22, -9) lands here.
- **Wall sconces** along front (5) and back (3) facades.
- **Grand entrance** wide marble steps (10 wide, was 5) + 2 marble planters with topiary cones.

### Removed
- All 580 lines of b025-b040 mansion shell cruft (central walls + tvBack strip + cFloorLine + 4 internal columns + cantilever balcony + interior floor/ceiling planes + central rooftop + topiary planters + east wing walls + east wing eyebrow + east wing columns + east wing roof + east wing side door + east wing drum pavilion + west wing walls + west wing eyebrow + west wing columns + west wing roof + west wing drum pavilion + standalone garage block + open colonnade + old rooftop pavilion + 12 wall sconces + back door + grand entrance) consolidated into the new shell.
- **INDOOR ATRIUM glass walls + roof + atrium back wall** (b029 4 wall meshes + atrium roof slab using `roofMat` + the entire enclosed-room concept). The atrium now lives as a pale-tile floor zone of the new mansion's open ground floor — no walls of its own, the mansion shell IS the walls. The indoor pool, sauna, loungers, potted palm all stay in the same x/z. The `indoor_pool` and `sauna` click→card targets still work.

### Files modified
- [js/world.js](js/world.js) — mansion shell rewrite (header + constants + body), atrium walls/roof stripped. Net **~570 lines deleted**.
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b040 → b041`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

### Phase 2 (b042 next round)
Recording studio + DJ booth + aquarium tunnel + atrium with koi pond + waterfall + dining + chef's kitchen + trophy hall + foyer + grand staircase + walk-in closet + master bath + 2 guest bedrooms + piano room + speakeasy + wine tasting + cinema + library + rooftop pool. Plus camera anchors for each + click→card targets. Each lands as a furniture cluster + zone marker; no interior walls (open plan throughout).

## b040 — 2026-04-07 — Garage wing attached west of mansion + west lot cleared (BBQ, fountain, garden, statues out)

User: "garage attached to mansion ... enough space that i could have a car inside a living room for fun ... the entire mansion bothers me the most right now ... remove bbqbar fountain garden 3 gadren statues ... garage west wing or something sure proceed however u wanna".

This is **Phase 1** of the multi-round mansion/scenery revamp. Phase 2 (pool / topiary garden / koi pond / waterfall / extra palms / sky bridge / road / showroom) lands in subsequent rounds.

### Added — garage wing attached west of the west wing
- New 12×14 single-volume open-air garage at `cx=-22, cz=-10`. Shares its east wall (x=-16) with the west wing's west wall — they read as one continuous mansion silhouette.
- Same modern Miami language as the wings: white plaster, 3 walls (front open via `addWallBoxOpenFront`), marble underside band, flat roof + parapet via `addFlatRoofWithParapet`, 3 slim round front columns.
- Single tall volume (height 6.5, between wing 6.0 and central 8.82) so it reads as a clearly distinct mass without competing with the central block.
- **Travertine showcase floor** + **marble showcase plinth** (6.0×0.18×3.4) inside the garage where the lambo sits.
- **LED accent strip** along the back interior wall at car-roof height — cool ledMat (cyan), the modern Miami garage lighting cliché.
- 2 sconces flanking the front opening.
- The user wanted "enough space that a car could live in the living room for fun" — this is the answer: a giant open volume with the car fully visible from the colonnade view.

### Moved
- **Yellow Lambo** relocated from the deck (`addCar(14, 5, ..., 'lambo_yellow')`) to inside the new garage on the showcase plinth (`addCar(-22, -9, ..., 0, 'lambo_yellow', 0.92)`). Faces front (rotY=0). baseY=0.92 = podium top + plinth height so the wheels rest on the plinth surface. Pink Lambo stays on the deck unchanged.

### Removed (user request)
- **Outdoor BBQ bar** (`addBBQBar` function + call at `(17, 9)`) — east of pool. The L-shaped stone counter, grill, heat strip, 3 warm-glow bottles, all gone.
- **3 garden statues** (`addStatue` function + 3 calls — obelisk at (26,22), sphere at (-28,24), abstract at (0,26)).
- **Entire luxury garden lot** (`addGarden` ~300-line function + call at `(-32, 13)`) — lawn plane, hedge perimeter, marble cross paths, **3-tier marble fountain** (the `fountain` click target lives here), 8 topiary cones, 4 topiary spheres, 4 topiary spirals, 6 bougainvillea bushes, 6 rose bushes, 4 lavender clumps, 8 marble urn planters, 2 corner marble statues, 2 marble benches, 2 pergolas, 6 pathway lanterns, all the nested helper functions (`addTopiaryCone`/`addTopiarySphere`/`addTopiarySpiral`/`addBougainvillea`/`addRoseBush`/`addLavenderClump`/`addUrnPlanter`/`addBench`/`addPergola`). ~85 meshes deleted.
- **West wing side door** — was an exterior door between the (now-deleted) garden lot and the bedroom interior. The new garage now occupies that exact spot, so the door would become an interior door (forbidden by user wish) — removed.

### Orphaned click→card targets (intentional)
- `'bbqbar'` (track 6), `'fountain'` (track 7), `'statue_obelisk'` (track 9), `'statue_sphere'` (track 10), `'statue_abstract'` (track 11) entries in `propTracks` are now orphan references — they no longer match any mesh. They're harmless (no error, just unclickable). Will be reassigned when the topiary garden / koi pond / waterfall replace them in Phase 2.

### What was NOT touched (kept for Phase 2)
- Entire b039 mansion shell (central + east + west wings, drums, cantilever balcony, rooftop pavilion, colonnade, interior rooms)
- Pool, pool deck, deck lanterns, pink Lambo, boulders
- Beach, ocean, pier, yachts, jet skis, surfboards, lagoon
- Tiki bar, fire pit + outdoor seating circle
- Forest (pines + palms), neighbor villas, skyline
- Loop driveway road
- Supercar showroom (east lot)

### Files modified
- [js/world.js](js/world.js) — garage block added (~85 lines), yellow lambo position changed (1 line), BBQ bar function + call deleted (~35 lines), 3 statues function + 3 calls deleted (~37 lines), luxury garden function + call deleted (~301 lines), 4 stub comment blocks added. Net **~270 lines deleted**.
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b039 → b040`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump + scene contents refresh

## b039 — 2026-04-07 — WASD fix + open-air mansion retry (no yellow windows, west drum, taller pavilion, open back archway)

User: "wasd does nothing like keystrokes arent registered whatsoever ... mansion still looks the same as it did before. its not the OPEN AIR modern miami build i thought itd be can we retry ... no doors in the inside. maybe open doors for front and back doors. very cool open air mansion (no yellow windows. not too flat or blocky."

### WASD fix
- Match by `e.code` (`KeyW`/`KeyA`/etc.) first, fall back to `e.key.toLowerCase()`. e.key arrives mangled or never fires window-level under Vivaldi/Opera/some mouse-gesture extensions; e.code is layout-independent and arrives earlier.
- Attached the listener at `document` **capture phase** (`document.addEventListener('keydown', onKeyDown, true)`) instead of `window` bubble. Capture fires before any other listener, so browser-level shortcut consumers can't swallow letter keys before the page sees them.
- Both branches `e.preventDefault()` AND `e.stopPropagation()` so nothing downstream re-handles the key.
- Extracted `keyToAction(e)` helper for clean mapping; both keydown and keyup use the same map.
- Destroy now removes from document with the matching capture flag.

### Open-air mansion retry
The b037 rebuild kept the geometry too closed (front-facing glass spans on every floor) and the warm-yellow `windowMat` made everything still read as "lit yellow windows". This pass actually opens it up.

- **New `glassMat`** at the top of the materials section: cool dusk-tinted glass (color 0x4a6878, low cyan emissive 0x305060). All villa-shell glass uses this; warm `windowMat` is no longer touched by the mansion at all.
- **Front facade is now fully open** on central + east wing + west wing. Removed all 5 ground-floor glass spans + 3 upper-floor glass spans + 4 wing glass spans. The only solid front element on the central block is a slim plaster strip behind the living-room TV (so the TV doesn't float against the colonnade).
- **4 internal structural columns** under the central upper floor (visible inside the open ground floor — sells the open-plan beach-house language: upper floor floats on exposed columns).
- **2 internal structural columns** per wing under each upper floor.
- **Cantilever upper-floor balcony slab** projecting forward from the central upper floor over the open ground floor (width 15.2, depth 2.4) with a frameless cool-glass rail + marble cap. Modern Miami signature: upper-floor terrace overlooking the pool.
- **Marble underside band** between floors (now 0.30 tall × 0.6 deep, was 0.16 × 0.4) — reads as the underside of the cantilevered upper floor instead of just a horizontal line.
- **Second cylindrical drum pavilion on the west wing** (mirror of east). Both ends of the mansion now have curved volumes — kills the all-rectangles read.
- **East drum's glass band** changed from `windowMat` → `glassMat` (cool not warm).
- **Rooftop pavilion taller** (height 2.6 → 3.6), sits on a marble plinth, front face is `glassMat` instead of warm `windowMat`. Bigger vertical accent + no more yellow.
- **Back door is now an open archway** instead of a warm-glow slab. Marble jambs + marble lintel frame the opening; a podium-colored void box overlays the back wall to read as a cut-out at this distance. You can see straight through the mansion front to back.

### Files modified
- [js/world.js](js/world.js) — `glassMat` declaration, all villa-shell `windowMat` references swapped to `glassMat`, front facade glass spans deleted, internal columns added, upper balcony added, west drum pavilion added, rooftop pavilion lifted + recolored, back door rewritten as open archway, keyboard handler rewrite (`keyToAction` helper, `document` capture-phase attach + cleanup)
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b038 → b039`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b038 — 2026-04-07 — Camera freedom: pan, WASD, FP dolly, R reset

User: "i hate the current locked to a point and drag around it and the camera angles for the other views/rooms sucks while we remodle everything (so dont have to touch them but) give me some more freedom pls somehow".

Diagnosed: orbit mode dragged around a fixed `camCenterX/Y/Z` that no input could move; first-person mode locked the camera position completely, leaving only direction rotation + FOV zoom (which doesn't help you escape a bad position). Anchor presets were the only way to change focus point.

### What's new
- **RMB drag = pan** in both orbit and first-person modes. Translates `camCenter` along the camera's right + up basis vectors. In orbit this slides the look-at target; in FP this strafes/lifts the camera.
- **Shift+LMB drag = pan** as an alt for laptop trackpad users without a right button.
- **WASD + QE keyboard movement** while villa view is active. W/S = forward/back along view direction (projected to ground in orbit so W doesn't fly the look-at into the dirt; full 3D in FP so you can fly through a room), A/D = strafe, Q/E = world down/up. Hold **Shift = 3× boost**. Skipped while typing in any input/textarea (the top-bar search keeps working).
- **R = reset**. Re-flies to whichever anchor is currently active. Use it when you've panned/walked too far and want to snap back.
- **First-person wheel** is now **dolly forward/back along the view direction**, replacing the b032 FOV-zoom behavior. FOV zoom didn't help users navigate; dolly does. Wheel in orbit mode is unchanged (still adjusts radius).
- **First-person pinch-zoom on touch** also became dolly to match the wheel.
- **2-finger touch drag = pan**. The pinch gesture now handles both zoom (distance change) AND pan (center movement) per frame, composed via delta tracking. 1-finger drag still rotates.

### Implementation details
- New state: `isPanning`, `lastPanX/Y`, `heldKeys` Set, `lastFrameTime`, `twoFingerLastCx/Cy`, `pinchLastDist`.
- New helpers: `panCamera(dx, dy)`, `dollyForward(amount)`, `applyKeyMovement(dt)`, `onKeyDown`, `onKeyUp`, `onContextMenu`.
- `panCamera` reads camera right + up via `setFromMatrixColumn(camera.matrix, 0/1)` so pan is always screen-aligned regardless of yaw/pitch. Speed scales with `radius` in orbit mode (so panning at radius=80 moves further per pixel than at radius=8) and is fixed in FP.
- `applyKeyMovement` integrates with frame `dt` (capped at 100ms so a long tab-out doesn't fling the camera). Forward dir comes from `camera.getWorldDirection`, projected to ground in orbit.
- `onMouseDown` detects `e.button === 2 || (e.button === 0 && e.shiftKey)` and routes to the pan path.
- `contextmenu` listener prevents the browser right-click menu from popping up over the canvas.
- `keydown`/`keyup` listeners on `window` (not container — canvas can't focus). Skipped when `e.target.tagName === 'INPUT' || 'TEXTAREA' || isContentEditable` so the top-bar search isn't hijacked. R triggers `flyToAnchor(currentAnchorIdx)`.
- `animate(now)` reads `now - lastFrameTime` for dt and calls `applyKeyMovement(dt)` before the existing camera positioning math (skipped during anchor fly-tween so the user can't fight the tween).
- `destroy()` removes contextmenu/keydown/keyup listeners, clears `heldKeys`, resets `isPanning` + `lastFrameTime`. The villa view registers/unregisters cleanly so WASD only fires while the villa view is mounted.

### What did NOT change
- Anchor preset positions (POOL/BEACH/AERIAL/LIVING/BEDROOM/BILLIARD/INDOOR) — pan/WASD just lets you move from there.
- Click→card system, hover detection, drag-vs-click threshold.
- Orbit wheel zoom (still adjusts radius).
- Touch 1-finger drag (still rotates).

### Files modified
- [js/world.js](js/world.js) — camera state + helpers + mouse/wheel/touch/key handlers + animate dt + destroy cleanup. ~150 net lines added.
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b037b → b038`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump + camera control notes refresh

## b037b — 2026-04-07 — Fix asphalt road protruding into loop driveway interior

User: "pertruding out of the circle (inner)". Diagnosed: outward road segment 1 was at `z=-85 length=40` (spans z=-65 to z=-105) while the loop ring's back outer edge is at `ringCz - outerR = -58 - 17.5 = -75.5`. Front 10 units of the segment were inside the donut hole.

Pushed both segments back so segment 1 starts exactly at the loop's back outer edge:
- Segment 1: `z=-91.5 length=32` → spans z=-75.5 to z=-107.5
- Segment 2: `z=-117.5 length=20` → spans z=-107.5 to z=-127.5

### Files modified
- [js/world.js:2722-2723](js/world.js#L2722-L2723) — segment positions
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b037 → b037b`
- [CHANGELOG.md](CHANGELOG.md) — this entry

## b037 — 2026-04-07 — Modern Miami beach mansion rebuild

User: "lowkey still super robloxy cuz its super blocky. also mansion is not an open design. fack the windows i want a huge white mansion, crazy looking almost like some vacation resort type shit by the beach. modern miami yes that correct."

Full surface rewrite of the villa shell. Preserved the b025 U-footprint constants (`centralW=14`, `wingW=9`, `centralH1=4`, `wingH1=3`, etc.) so the LIVING/BEDROOM/BILLIARD interior rooms keep working untouched, and preserved the `bell_tower` click→card target on the new rooftop pavilion so the existing track card still wires. Everything else about the shell is new.

### What got ripped out
- Stone ground floor walls (whole building was stone+plaster two-tone)
- Hipped terracotta roofs on central + east wing + west wing (`addHippedRoof` + `terracottaMat` calls inside the villa shell — material declaration kept, garden statues etc. still use it)
- Arched windows + marble surrounds + 3-bar mullion grids on every facade (`addArchedWindow` helper deleted)
- `addCornice` helper (the marble band wrapping every floor — too fussy)
- Arched main entry with round marble columns + capital blocks + marble header
- Wrought-iron balustrade balcony above the entry (14 front posts + side rails)
- Bell tower campanile in the back-west corner (3-stage: stone base + plaster shaft + 4-pillar belfry with bell + terracotta cap pyramid)

### What replaced it
- **All-white plaster walls** on every section, both floors. New `addWallBoxOpenFront` helper builds 3 walls (back + 2 sides) instead of 4 — every front face is glass, not plaster.
- **Floor-to-ceiling frameless glass spans** via new `addGlassSpan` helper: single big pane + slim marble reveal at top and bottom only. No mullion grids, no side frames. Central upper floor = 3 spans across the full width. Central ground floor = 2 spans flanking a solid plaster strip behind the existing living-room TV (TV is at x=0±2.5, z≈-3.6 — strip is 5.4 wide so the TV doesn't read against the colonnade beyond). Each wing = 4 spans (2 per floor).
- **Flat roofs with rooftop terraces** via new `addFlatRoofWithParapet` helper: white slab + travertine deck plane + knee-high parapet on all 4 sides. Central rooftop also gets two marble planters with topiary cones flanking the front edge.
- **Rooftop pavilion** on the central terrace — small white cube + warm-glow front face + horizontal cantilever canopy slab supported by two slim white columns. Carries `name = 'bell_tower'` so the b025 click→card target survives.
- **Open colonnade** across the full 32-wide front: 7 slim round white columns at z=0 (forward of the front wall at z=-3) supporting a horizontal cantilever eyebrow slab spanning the whole façade, with a warm cove glow strip on the eyebrow underside. The "resort entry" silhouette — kills the boxy read.
- **Cylindrical drum pavilion** at the front-east corner of the east wing: full-wing-height white cylinder (r=2.4) with a wraparound glass band at the upper floor, marble floor-line ring between floors, and a flat circular canopy roof on top. The single non-rectangular volume in the whole composition.
- **Slim marble floor-line eyebrows** between the ground and upper floors of central + each wing — modern Miami's signature horizontal shadow line.
- New `addColumn` helper (slim round white CylinderGeometry) and `addEyebrow` helper (declared but unused — kept for future facade tweaks).

### What was kept
- `villaCx`/`villaCz`/`podiumTopY`/`wallT`/all footprint + derived constants
- Podium box
- `addWallBox` helper (no longer called by the shell — kept in case future blocks want a fully-walled section)
- `addSconce` helper + most sconce positions
- Central interior floor + interior ceiling planes
- East + west wing side doors (slab door + marble surround)
- Back door on the central back wall
- GRAND ENTRANCE block (4 marble steps + flanking planters at the new central entry, lines ~1075-1115) — fits modern Miami fine, no changes
- `stoneMat` + `terracottaMat` declarations (still used by garden statues, fountain ring, neighbor villas elsewhere in the file)

### Files modified
- [js/world.js](js/world.js) — villa shell rewrite, lines ~534-1080 (helpers + central block + east wing + drum pavilion + west wing + open colonnade + rooftop pavilion + sconces). +280 net lines.
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b036 → b037`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump + villa design notes refresh

## b036 — 2026-04-07 — De-Robloxification: bloom pass + surface noise + heavier fog + lower camera

User: "everything looks super roblox idk how to feel about it all. whaty can we do". Diagnosed root causes as (1) huge unbroken flat-color slabs, (2) emissives without bloom render as flat neon parts, (3) hard contact edges, (4) top-down orbit angle. Three cheap fixes that hit ~80% of the issue without touching geometry:

### A — Cheap single-pass bloom (post shader)
Inside `postMaterial.fragmentShader`, before the tone curve. For each output pixel, sample 12 neighbors in two rings (8 inner at r=2.5px, 4 outer at r=5.5px), threshold each one to keep only luminance > 0.72, accumulate as additive glow. New `uTexel` uniform = `1/LOW_W, 1/LOW_H` for the offset math. Real bloom would do a separable Gaussian blur chain into a half-res target — this is the single-pass approximation that fits the existing pipeline and looks ~80% as good for blocky low-res output. The pool, lanterns, lambo emissives, fire pit, LED strips, and path lights now actually halo against the dusk sky instead of reading as flat neon parts.

### B — World-space noise hash (PS2 fragment shader)
Added inside `makePS2Material`'s fragment, between the rim light and the fog. Hashes `floor(vWorldPos * 6.0)` (coarse) and `floor(vWorldPos * 1.5)` (fine) into a small color delta (±0.06 luminance, slightly cooler-tinted). Big flat surfaces (sand, deck, showroom slab, asphalt) all looked like Roblox baseplates because every fragment of one mesh had identical color — the hash breaks that without needing textures. Also added a per-fragment fake-AO term that darkens upward-facing low-y faces by ~22% near contact edges so the deck/sand/villa intersections get a baked shadow crease.

### C — Fog density + camera angle
- `scene.fog` density `0.003 → 0.0055` (and the four matching `uFogDensity` shader uniforms in PS2 / pool / ocean / lagoon mats). Distant trees and ocean now fade into the dusk haze instead of reading as full-saturation flat color all the way to the horizon.
- Initial camera + POOL anchor: `cy 4.0 → 3.0`, `cz -2 → 2`, `yaw 0 → 0.20`, `pitch 0.30 → 0.10`, `radius 26 → 22`. Lower, closer, slightly off-axis. Hides more of the flat ground in any single frame and frames the cantilever + pool more dramatically. Initial `let yaw/pitch/radius` defaults updated to match so the very first frame doesn't pop.

### Files modified
- [js/world.js](js/world.js) — `makePS2Material` frag (noise hash + fake AO), `postMaterial` (bloom pass + uTexel uniform), `scene.fog` density, all 4 `uFogDensity` uniforms, `cameraAnchors[0]` (POOL), initial `let yaw/pitch/radius`
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b035e → b036`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b035e — 2026-04-07 — Loop = driveway, single road heading outward only

User: "the loop isnt correct. the driveway should be the loop, and then 1 road leading outward towards the background. currently theres a loop and this tiny little road leading to the front of the house i dont like that".

Removed the villa→loop connector segment. The loop itself IS the driveway now, with one road extending outward from its back edge into the deep jungle. Two segments at z=-85 and z=-110 to give the road some length without a single very long box.

## b035d — 2026-04-07 — Pull lagoon back (b035c overcorrected)

User: "now too much lagoon". b035c put the front edge at z=32 which ate the beach chair zone. Moved center z 117 → 135 → front edge now z=50. Pier (z=30..66) still has its outer ~16 units over water; beach chairs back on dry sand.

## b035c — 2026-04-07 — Pull lagoon front edge in so the pier extends over water

User: "we need to move the lagoon in closer because the bridge is too much on the sand". The pier runs z=30..66 but the b035b lagoon front edge was at z=60, so basically the entire pier was on sand with only the very tip over water.

Moved lagoon center z 145 → 117. New z range 32..202. Pier base now lands right at the shoreline so the pier extends over the water for nearly its entire length. Still clear of the pool deck (deck z range -36..16). Beach chairs at z=32..40 are now near the waterline (intended — they sit at the edge of the surf).

### Files modified
- [js/world.js](js/world.js) — lagoon center z 145 → 117
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b035b → b035c`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b035b — 2026-04-07 — Lagoon = actual ocean (much bigger + dominant y)

User: "its still happening with the lagoon. also the lagoon needs to be much bigger cuz its supposed to be an ocean".

The b035 lagoon was 82×68 with top y=0.05 — only 0.05 above the beach top at 0.00, so it still landed in the depth-buffer noise zone where it overlapped the sand and flickered. Two issues, one combined fix:

- **Size**: 82×68 → 260×170. Reads as a horizon-spanning ocean instead of a pool.
- **Y separation**: top y 0.05 → 0.30. Now a full 0.30 above the beach top, so the lagoon ALWAYS wins the depth test wherever they overlap. No more fight.
- **Position**: center z 62 → 145. Pushed forward to start at z=60, past the beach chair zone (z=32..40), so beach chairs stay on visible sand instead of being submerged. Pool deck untouched (deck z range -36..16). Pier (deck y=0.65) and yachts (hull y=0.5) still float over the new water surface correctly.

### Files modified
- [js/world.js](js/world.js) — lagoon size + position + y bump
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b035 → b035b`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b035 — 2026-04-07 — Kill the ground-stack z-fighting (real y separation, thick boxes)

User: "look at how much things glitch on the floor. sand blends with water with pool with floor of pool. can we give these different y axis heights and if needed make it rectangular instead of 2d flat planes to address any gaps in height."

Diagnosis confirmed: every big horizontal surface lived within ~0.06y of the others (ground 0.04, beach 0.02, ocean -0.05, pool 0.10, rim 0.06, lagoon 0.06). With camera radius up to 80 and far plane 320, even the b033 24-bit depth texture can't reliably resolve gaps that small. Result was the visible flicker between sand/water/deck the user kept seeing.

### Fix — establish a real y stack with thick boxes

| Layer | Old y | New y (top) |
|---|---|---|
| Ocean (plane, 600×600) | -0.05 | -1.50 |
| Beach (now thick box 200×1.20×200) | 0.02 (plane) | 0.00 |
| Garden lawn (now box) | 0.05 (plane) | 0.10 |
| Garden marble paths | 0.10 | 0.18 |
| Villa ground/deck (now thick box 56×0.40×52) | 0.04 (plane) | 0.20 |
| Showroom floor (now thick slab 1.20 tall) | 0.18 | 0.20 |
| Pool rim | 0.17 | 0.36 |
| Pool / jacuzzi water | 0.20 | 0.45 |
| Lagoon (now thick box 82×0.40×68) | 0.06 (plane) | 0.05 |
| Ring road | 0.06 | 0.16 |
| Asphalt road segments (thicker box 0.30 tall) | 0.06 | 0.15 |

The flat `PlaneGeometry` for ground/beach/lagoon/lawn → `BoxGeometry` so the SIDES of the box hide any visible drop and there's no possibility of two coplanar planes flickering against each other. Big y gaps (0.10–0.40 between adjacent layers) put everything well outside the depth-buffer noise floor.

### Prop bumps to match the new deck top
- `addCar` gained a `baseY` param (default 0.20 = deck top). Lambo callsites use the default; showroom callsites also use the default since the showroom floor top is also 0.20.
- `addDeckLantern` gained `baseY` (default 0.20). Pool deck callsites use the default; garden lantern callsites pass `0.10` for the lawn top.
- `addPathLight` gained `baseY` (default 0.20). All current callers are deck-side. Ground spot now sits at `baseY + 0.02` so it can't fight the deck top.
- Daybeds bumped from y=0.05 → 0.20.
- Beach chairs bumped from y=0.05 → 0.00 (now sit on the new beach top).

Daybeds, lanterns, path lights, lambos, and showroom cars now all rest cleanly on the deck top with no clipping or floating. Tiki bar / fire pit / BBQ are still at their old y values — they sit on the beach near y=0.05, which is 0.05 above the new beach top (still a small gap from the deck). They'll look slightly low against the new layered terrain but won't z-fight; can be polished separately.

### Files modified
- [js/world.js](js/world.js) — ground/beach/ocean/lagoon/lawn box conversions, pool/rim y bumps, addCar/addDeckLantern/addPathLight `baseY` params, daybed + beach chair y bumps, showroom floor thickened, ring road + road segment y bumps
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b034c → b035`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b034c — 2026-04-07 — Lagoon over the pier, loop on the back side, jungle packed tight

User: "the huge ocean you made looks like a pool. its also positioned wrong it should be near the pier and boats. and more oceany than pool. you put many trees around but theyre all so far away that like it doesnt look like a far cry 3 jungle. that's the intended vibe, and we put that close to the road. you also put the loop on the side of the house not connecting it to the front. circle is the driveway and the straight line should lead outward toward the forest"

Three concrete fixes:

1. **Lagoon — relocated + new shader.** Moved from `(-78, 0)` (west of property, miles from anything) to `(0, 0.06, 62)` — directly under the pier (`x=8, z=30..66`) and beneath the three yachts (`z=62..92`). Replaced `poolMat` (which was reading as a swimming pool with caustic grid + 3.6× brightness boost) with a dedicated `lagoonMat` shader: rolling triple-sine waves, deep teal `0x08323c → 0x3a92a8`, no caustic grid, no top-face boost, modest 1.35× output gain. Reads as ocean, not pool.

2. **Loop driveway — moved to villa back.** The +z side is fully owned by pool / pier / lagoon / beach chairs / yachts, so a "front" driveway loop is impossible there without bulldozing scenery. Moved the ring to `(0, -58)` r=15 on the empty -z side. Single straight road runs `(0, -22)` length 38 from villa back wall (z=-3) through the loop, then `(0, -82)` length 30 continuing past the loop deeper into the jungle.

3. **Forest — packed tight, not scattered.** Old layout was 24 pines spread to the horizon. New layout is ~55 pines + 9 palms in three concentric rings hugging the loop and the road shoulders, with a dense back-jungle wall at z=-90..-100 and side pockets at the east/west edges. Tree positions hand-placed to avoid the garage footprint at `(32, -28) ± 13×7`.

### Files modified
- [js/world.js](js/world.js) — `lagoonMat` shader + relocated lagoon plane, ring road moved to back, forestPines list rewritten and packed
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b034b → b034c`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

## b034b — 2026-04-07 — Polish pass on b034: lagoon reads as water, smooth ring road, fuller pines

User: "how do we make it less choppy less ugly". Three concrete causes:

1. **Lagoon was invisible as water.** It was using `oceanMat`, which is dusk purple `0x2a0a55`/`0xc04098` — visually identical to the surrounding pink/purple beach in this lighting. Switched the lagoon to `poolMat` (cyan glow + caustic bands + the `vTopMask` 3.6× brightness boost) and changed it from a thin Plane to a `BoxGeometry(60, 0.20, 140)` so the top face triggers `vTopMask`. Added a travertine `lagoonRim` slab around it as a clean shoreline cut.

2. **Loop road looked like 16 detached tiles.** Replaced the 16 tangent `BoxGeometry` segments with a single `RingGeometry(15.5, 20.5, 64, 1)` mesh — one smooth annulus, no polygon seams. Added a thin `RingGeometry(17.9, 18.1)` stripe ring on top for the center line. Approach + garage spur roads are still straight box segments since they're linear.

3. **Pines were too small/dark to register at distance.** Pines now use a dedicated `forestMat` with `emissive 0x4a8030` + `emissiveAmt 0.30` so they hold up against the dusk fog. Tree height multiplied by 1.7, cone count 3 → 4 with bigger base radii (1.6→2.4), trunk thicker.

Also bumped road segment y `0.05 → 0.06` and dash y `0.07 → 0.10` for clearer z separation, and moved the garage-spur road from x=40 to x=46 so it lines up with the new garage position at `(32, -28)`.

### Files modified
- [js/world.js](js/world.js) — lagoon material/geometry + rim, ring road via `RingGeometry`, `addPineTree` rewrite + new `forestMat`, road y bumps
- [js/helpers.js](js/helpers.js) — `BUILD_NUMBER` `b034 → b034b`
- [CHANGELOG.md](CHANGELOG.md) — this entry
- [FILE_MAP.md](FILE_MAP.md) — build bump

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
