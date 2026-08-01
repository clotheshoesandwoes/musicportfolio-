# SCENES CHANGELOG

Per-scene history for `/scenes` starting at the post-split point. Build history before the split (b001–b242, including the b139 selector cutover + b140-b231 desert/perimeter/POI/missile-silo work + b237 LF compound) lives in the frozen root [CHANGELOG.md](../../CHANGELOG.md). New scenes builds are logged here.

---

## s18 — 2026-05-13 — Restore + Shadow Moses additions on the Halo base

User after the s23 rewrite they hated: "this looks so much worse can we redo the super cool metal gear halo style military base we had previously trake inspo from those and from metal gear." Reverted the s23 wholesale rewrite (10k+ lines back to the original s17 file) and ALSO surgically re-applied the s18-s22 features the user explicitly praised, plus added MGS1 Shadow-Moses-flavored hangar + parked Hind.

### Restored (re-applied on top of s17)
- **Free-cam mode** (`F` key, WASD/QE, Shift = 4× speed, drag to look). Top-center HUD shows live coords. ESC ladder: focus → freecam → POI 0.
- **Admin debug panel** (top-right, under `cantmute.me` mark): `[L] LABELS on/off`, `[F] FREECAM on/off`, live `x y z yaw° pitch°` readout, `copy coords` button (writes to clipboard, flashes "copied ✓"), `jump x,z [__] [__] [go]` inputs (auto-enables freecam, teleports camera).
- **Planet move** from `(-110, 12, -130)` → `(-180, 75, -215)` — same back-left diagonal, but ~6× higher in y and 1.6× further so it reads as a sky element behind the ridge instead of clipping the dirt.
- **Missile-site floating-items fix** — dropped the `padH +` offset from every off-pad mesh inside `_buildMissileSite` (LOX cluster, generator shed + drums + door + stack + louvres + roof, cable tray + 3 support pillars, antenna farm dipoles + cross elements + guy wires, bunker stairs + blast door + door frame + wall lamp, sandbag perimeter, jersey barriers, 4× LF corner pylons + lamp heads + lenses + strobes, 4× security cam poles + cameras + LEDs, 4× warning sign stakes + sign + stripe, diesel fuel tank cluster + caps + saddles + placard + vent, sphere oxidizer cluster + skirt + equator + vent + cap + placard + pipe, gas bottle rack frame + bottles + valves + placard, spill berm curbs + stripes, payload transporter sub-group internals, personnel hatch + lid + stripe + rails) plus the NW Pad 8 secondary sandbag perimeter. On-pad meshes (silo, missile, cap, nose, deflector, gantry stuff, blast deflector, cable tray2 inside pad, hypergolic cabinet / drum pallet / hose reel pump that sit inside the 13u pad radius) keep their `padH +` offsets because they actually sit on the raised concrete.

### New (Shadow Moses / MGS1 flavor)
- **`vtol_hangar`** at `(-95, -8, -132)` in the previously-empty far-NW desert, angled `~10°` toward the base center. Halo-Reach base + Metal Gear vibes:
  - 22u×9u×16u concrete shell with an arched steel half-cylinder roof.
  - Twin sliding bay doors on the front face (closed), with horizontal ribs, yellow caution stripes on the outer edges, and a glowing vertical seam down the centerline (interior light leaking through).
  - Upper-level office windows above the doors (5 lit window slits, warm interior glow).
  - 3 rooftop exhaust ducts with stack pipes + rain caps + dark louvre faces (MGS industrial vibe).
  - Comm antenna with parabolic dish + cross bars + red strobe on the roof.
  - Concrete loading apron in front of the doors, painted center stripes + yellow edge stripe.
  - 2 floodlight poles framing the apron.
  - Vertical exhaust pipes running up both side walls with elbow-out caps.
- **`parked_hind`** — Hind-D silhouette parked on the apron, angled across it. Long fuselage, tapered nose with warm cockpit glass, stub wings with rocket pods, tail boom + vertical tail fin + small tail rotor, 5-blade main rotor drooping (parked), 3 landing wheels with struts, port/starboard/tail nav lights.

### Files
- `js/scenes-selector.js` — surgical re-application of s18-s22 features (~20 edits across `_buildMissileSite`) + new `_buildVtolHangar` + `_buildHind` methods (~250 lines). NOT a full rewrite. The s17 base structure (the user's "super cool metal gear halo style military base") is preserved exactly.
- `js/builds/scenes.js` — s17 → s18.
- `docs/scenes/{FILE_MAP.md, CHANGELOG.md, SCENE_MANIFEST.json (regenerated)}`.

---

## s17 — 2026-05-11 — Auto-generated SCENE_MANIFEST.json (manifest layer)

User after s16: "continue pls". Labels were exhausted, so picked up the next piece from [LABEL_OVERLAY_PLAN.md](LABEL_OVERLAY_PLAN.md) section 2 — the auto-generated manifest. Converts the labeled-screenshot workflow into a structured JSON any fresh chat can read without needing a screenshot at all.

**What shipped:**
- [scripts/gen-manifest.js](../../scripts/gen-manifest.js) — Node script (no deps). Walks `js/scenes-selector.js`, regex-extracts every `.name = '<id>'` static assignment, resolves nearest `position.set(...)` or `_placeBuilding(grp, x, y, z)` to an actual `(x, y, z)`, and dumps the result. Also pulls panel-host IDs + positions from the `mounts` table in `_buildPanels()`. Resolver handles simple expressions (`x + 1.6`, `padR + 1.0`, `-65 - 6`) via a per-method symbol table built from `const X = N;` declarations.
- [docs/scenes/SCENE_MANIFEST.json](SCENE_MANIFEST.json) — the output. Three sections:
  - `panelHosts` (11) — all radial panel-mount buildings with their world coords from BASEMAP-aligned spec.
  - `staticObjects` (29) — standalone buildings/vehicles/figures/lighting rigs/backdrops. 21/29 positions resolved automatically; remainder use multi-term expressions or runtime-computed positions (line numbers still point to source).
  - `dynamicTemplates` (21) — per-instance helpers (`watchtower_*`, `conex_stack_*`, `tent_*`, `flyby_*`, etc.) with a pointer to the helper's source line. Instance positions live in the JS call sites; the runtime label overlay still names each instance via template substitution.
- [docs/scenes/LABEL_OVERLAY_PLAN.md](LABEL_OVERLAY_PLAN.md) — updated the "status" header and added a Workflow section: read the manifest, resolve the user's description to an id, ask if you can't — don't guess.
- [docs/scenes/FILE_MAP.md](FILE_MAP.md) — added the manifest + script to the file-pointer list, plus a 5th "always do" rule: regenerate `SCENE_MANIFEST.json` after any `.name`-touching edit.

**Why this matters:** s13–s16 built a *visual* ground-truth layer (screenshot with labels). s17 adds a *structured* ground-truth layer (JSON). Together they fix the original user pain ("I sent you this picture a million times — what do you mean 'I didn't know we had roads'?") at both ends: chat can read the manifest before responding, and the user can screenshot the labels if a visual is faster than scrolling JSON.

**Next layer** (per the original plan, still out-of-scope until needed): a scenes-spatial Skill that fires on edits to `js/scenes-selector.js` / `js/marathon-world.js` / `js/tracks-daw.js` and forces a manifest read before any spatial edit. Won't build until the manifest workflow is actually validated in real use.

Files: scripts/gen-manifest.js (new), docs/scenes/SCENE_MANIFEST.json (new, auto-generated), docs/scenes/{LABEL_OVERLAY_PLAN.md, FILE_MAP.md, CHANGELOG.md}, js/builds/scenes.js (s16 → s17). No js/scenes-selector.js change.

---

## s16 — 2026-05-11 — Finish label pass: drum clusters, flood poles, in-flight ships

User after s15: "continue pls". Fourth and final extension. The remaining unlabeled targets were three helpers that scene-add'd their parts individually (no parent group to hang a `.name` on) + the five capital-ship designs from `_buildFlybys`.

**Helper refactors (wrap parts in a parent group, then label):**
- `buildDrumCluster(x, z)` — previously scene-add'd 5 drums + 5 lids as 10 individual top-level meshes. Now wraps all 10 in a `THREE.Group()` positioned at `(x, -8, z)` and named `drum_cluster_<x>_<z>`. 6 clusters across left/right/far flanks.
- `buildFloodPole(x, z, headDir)` — previously scene-add'd 3 meshes (pole + head + lens). Now wraps in a `THREE.Group()` positioned at `(x, -8, z)` and named `flood_pole_<x>_<z>`. 6 poles across the deck-flank fill zones.

**In-flight ships** (`_buildFlybys`) — 5 capital ships from the design table self-name from their `kind`: `flyby_capital`, `flyby_cruiser`, `flyby_pelican`, `flyby_fighter`, `flyby_forerunner`. Labels are parented to each ship, so they follow it across the sky (and stay hidden when the ship is on respawn cooldown — `_buildLabels` walks the scene once at init and `sprite.visible` inherits from the parent's `.visible`).

**Final intentional skips:**
- **Floor props** (`_buildFloorProps`) — 18 traffic cones + 9 fusion coils + 2 kill balls + 16 supply crates scattered randomly on the deck (45 props total). At default zoom these clutter the labeled view to the point of unreadability — labels would overlap each other constantly and obscure the actual buildings the user is trying to identify. The deck is clearly the user's vantage point, not a thing they need labels for.
- **Perimeter streetlamps** (~20 small fixtures along the loop legs in `_buildBaseLighting`) — same reasoning: too dense, too small, too repetitive. The streetlamps read as "lighting infrastructure" not "named landmark."
- **Building windows / building flood beams / building uplights** — sub-props on already-labeled buildings; labels would double up over their parent.
- **`_buildBarracksRow`** — dead code (no call site).
- **`_buildOuterCompounds`, `_buildSWQuadrantFill`** — disabled in `init()` per s12.

Effectively the labeled-screenshot workflow is now complete: every distinct mass on screen carries an ID. Future work (if needed) is the `SCENE_MANIFEST.json` generator → scenes-spatial Skill, per [docs/scenes/LABEL_OVERLAY_PLAN.md](LABEL_OVERLAY_PLAN.md).

Files: js/scenes-selector.js, js/builds/scenes.js (s15 → s16), docs/scenes/FILE_MAP.md.

---

## s15 — 2026-05-10 — Label naming pass into figures, pelican infra, decoratives, planet

User after s14 screenshot: "label continue, save code update helpers and all". Third extension pass — same overlay subsystem from s13, broadening the `.name` coverage into the construction-site helpers s13/s14 hadn't touched yet.

**Newly labeled:**
- **Engineers** (3 ODST figures around the parked Pelican) — `engineer_kneeling` (at access panel), `engineer_clipboard` (left rear, holding clipboard), `engineer_inspector` (right wing).
- **Patrolling personnel** (8 walking soldier NPCs) — `personnel_0..7`. Labels stay parented so they track each NPC as it walks routes (bivouac → forward ops, cross-base sweeps, etc.).
- **Pelican floodlight stands** (4 portable construction lamps around the SE airfield pad) — `pelican_floodlight_0..3`.
- **Stadium pylons** (4 lighting pylons around the missile silo at z=-118) — `stadium_pylon_<x>_<z>`.
- **Scaffold floodlights** (2 yellow construction lamp stands aimed at the broken dish rim) — `scaffold_floodlight_<x>_<z>`.
- **Deck-flank decoratives** — `pallet_stack_<x>_<z>` (8 stacks across left/right/far flanks), `hesco_row_<x>_<z>` (2 fortified barrier walls).
- **Planet backdrop** — the gas-giant sphere at world (-110, 12, -130) is now `planet`. Anchors the SW-rear horizon.

**Still skipped (intentional — visually noisy with no payoff):**
- Drum clusters (5 small drums per cluster, scene-add'd individually with no parent group).
- Floodlight poles in deck-flank fill (single-pole light columns, also scene-add'd individually).
- Perimeter streetlamps (~20 small fixtures along the loop legs).
- Building windows, building flood beams (sub-props on already-labeled buildings — labels would overlap parent labels).
- Floor props (Forge clutter on the deck — coils, kill balls, crates, traffic cones — many small items).
- In-flight ships from `_buildFlybys` (positions change continuously; labels would jitter).
- Capital-ship Pelican in flight (covered by `pelican_scripted` label).

The deck POV under `?labels=1` should now be near-complete: every distinct building, vehicle, panel host, structure cluster, NPC, helper light rig, and the planet backdrop carries an ID.

Files: js/scenes-selector.js, js/builds/scenes.js (s14 → s15), docs/scenes/FILE_MAP.md.

---

## s14 — 2026-05-10 — Extend label naming pass to vehicles + secondary structures

User screenshot of s13 with `?labels=1`: panel hosts (`broken_dish`, `sigint_tower`) labeled cleanly, but most of the visible scene was still anonymous — vehicles, watchtowers, deck-flank fill (guard shacks / equip sheds / parked Warthogs / comm-uplink trailers), perimeter conex stacks, NW quadrant fill clusters, back-ridge silhouettes, tents.

This build extends the s13 naming pass into every helper that produces a distinct visible object. No new overlay code — just `obj.name` assignments at construction sites the overlay walker already covers.

**Newly labeled:**
- **Vehicles** — `scorpion_parked`, `scorpion_patrol`, `parked_warthog_motorpool_0..2`, `patrol_warthog_0..2` (3 motor-pool + 3 patrol Warthogs), `parked_warthog_flank_<x>_<z>` (4 deck-flank Warthogs).
- **Watchtowers** — all 4 corner towers self-name as `watchtower_<x>_<z>` (driven by `_buildWatchtowers` loop's per-iteration coords).
- **Back-ridge silhouettes** — `_buildDish`, `_buildCommTower`, `_buildBunker` helpers self-name from `(x, z)` args: `dish_58_58`, `comm_tower_38_44`, `comm_tower_-12_62`, `bunker_-58_10`. Also `broken_dish_geom` (the standalone dish geometry — distinct from the `broken_dish` panel host).
- **Deck-flank fill helpers** — `guard_shack_<x>_<z>` ×2, `equip_shed_<x>_<z>` ×4, `comm_uplink_trailer_<x>_<z>` ×2.
- **NW quadrant fill** (the 7-cluster broken-dish POI fill) — `nw_maintenance_pad`, `nw_sigint_vans`, `nw_aid_station`, `nw_signal_relay_tower`, `nw_conex_depot`, `nw_perimeter_watchtower`, `nw_radio_shack`.
- **Perimeter conex stacks** — all 10 stacks along the inner-fence clear-strip self-name as `conex_stack_<x>_<z>` (driven by the `buildConexStack` helper).
- **Tents** — bivouac clusters tagged: `tent_sw_bivouac_0..2`, `tent_se_bivouac_0..2`.

**Skipped (intentional):** drums, pallets, HESCO barrier rows, flood-pole lighting rigs, stadium-pylon clusters, individual NPCs, engineer crew, in-flight ships (Pelican label already covers the parked one). These either are too small to need an ID, would visually clutter the labeled-screenshot view, or duplicate an existing parent label.

The deepsea panel area (broken-dish POI) now reads cleanly under `?labels=1`: panel host `broken_dish` is the chassis, `broken_dish_geom` is the damaged dish silhouette next to it, plus the 7 `nw_*` labels for the surrounding fill — every distinct mass identifiable from one screenshot.

Files: js/scenes-selector.js, js/builds/scenes.js (s13 → s14), docs/scenes/FILE_MAP.md.

---

## s13 — 2026-05-10 — Debug ID label overlay (?labels=1 / L key)

User pain (from a parallel chat that fed the spec): "I sent you this picture a million times — what do you mean 'I didn't know we had roads'?" Root cause is that scene IDs only live in the code; chat sees screenshots and has to guess "the white building with the vials" → which mesh? Ground-truth fix is debug labels on every named object.

Built per [docs/scenes/LABEL_OVERLAY_PLAN.md](LABEL_OVERLAY_PLAN.md):

1. **Activation surface.** `?labels=1` query param OR press **L** in-scene. Defaults off. HUD shows `[L] labels: off|on` in the bottom-left, under the panel-hint line.
2. **Naming pass.** `_buildPanelHost(kind, …)` now sets `grp.name = kind` so all 11 panel hosts (`missile_silo`, `comms_array_shed`, `forward_ops_radar`, `sigint_tower`, `logistics_yard`, `broken_dish`, `sensor_pylon`, `biostation_quarantine`, `back_billboard_lattice`, `rail_kiosk_left`, `rail_kiosk_right`) self-label. Plus `.name` set on standalone bodies: `hex_deck`, `fuel_depot`, `antenna_array`, `pelican_scripted`, `cmd_bunker`, `vehicle_bay`, `barracks_big`, `supply_depot`, `bio_station`, `comm_tower_big`, `helipad`, `missile_site`, `radar_building`, `pelican_pad`, `central_dish`.
3. **Overlay subsystem.** `_buildLabels()` runs once at end of `init()`, walks the scene with `.traverse()`, and parents a `THREE.Sprite` (canvas-textured pill of the node's `.name`, dark-blue background + cyan border + monospace text) above each named node's bounding-box top. Sprite material is `transparent: true, depthTest: false` so labels read through walls. Per-text canvas cached in a `Map` so repeat IDs don't rebuild textures. `renderOrder = 9999` to draw last.
4. **Toggle.** `_setLabelsEnabled(on)` flips `sprite.visible` on every registered sprite + updates HUD text. Wired to query param at init and to L-key in `_onKey`.
5. **Cleanup.** `destroy()` disposes label sprite materials/textures and clears the cache.

Workflow this enables: open `http://localhost:8000/scenes/?labels=1`, screenshot, drop in chat → next session has the exact mesh ID for every visible structure instead of guessing from descriptions.

Out of scope (intentionally — keeping s13 small): auto-generated `SCENE_MANIFEST.json`, `// @obj id=...` tagging convention, scenes-spatial Skill. Those are follow-ups if the labeled-screenshot workflow needs more.

Files: js/scenes-selector.js, js/builds/scenes.js (s12 → s13), docs/scenes/FILE_MAP.md, docs/scenes/LABEL_OVERLAY_PLAN.md (new — the spec this build implements).

---

## s12 — 2026-05-10 — Rip out outer compounds + SW cluster + move biostation panel

User repeatedly: "stuff is still on the road" + "different cities in the distance look terrible". Three structural fixes in one pass instead of more position tweaks:

1. **Disabled `_buildOuterCompounds()`** — the 4 anchors at (±95, -25/-65) and (±92, -100) read as ugly distant cities outside the perimeter loop. User wants buildings ON the road grid INSIDE the base, not scattered far out.
2. **Disabled `_buildSWQuadrantFill()`** — the 7-cluster fill kept piling around the biostation panel from BIOSTATION SW POI no matter how many shifts we did. Removing it entirely; can re-add selectively in clean grid plots if user wants specific items back.
3. **Moved biostation panel from (-42, 4, 42) → (-42, 4, 30)** — the host's diagonal-rotated front-right corner kept landing 0.32u from the S-perim road edge after every shrink. Pulling the whole panel 12u north so the host front clears the road by ≥10u (host now extends z=22.93 to z=37.45 in world after rotation; S-perim south edge at z=45.5).

Both function definitions left in the file (commented at the call site) so re-enabling is a one-line revert if user changes direction.

After this build, the BIOSTATION SW POI shows: just the rebuilt biostation host (s6 design — airlock dome, 2 pods, specimen tanks, hazard perimeter, BIOHAZARD trefoil sign) cleanly north of the S-perim road, with empty SW asphalt around it. From there, ask user where to add buildings into the road-grid plots.

Files: js/scenes-selector.js, js/builds/scenes.js (s11 → s12), docs/scenes/FILE_MAP.md.

---

## s11 — 2026-05-10 — Revert s10 lab move + scope-confusion note

User screenshot showed `/tracks` (Tracks Vault scene, owned by `js/tracks-daw.js`, different chat scope per CLAUDE.md), not `/scenes`. Their feedback "different cities in the distance that look terrible" was about my s10 move of the bio-research lab to (60, 25). Reverted to s7 position (-25, 20). No new scenes layout direction taken — waiting on user to confirm whether they want (a) a redo of the SW layout aligned to the road grid, (b) outer compounds removed, or (c) a tracks-side change (which needs a different chat).

(s10 was an attempted "split the cluster" move to (60, 25). Single-line revert.)

Files: js/scenes-selector.js, js/builds/scenes.js (s9 → s11; s10 was the bad intermediate), docs/scenes/FILE_MAP.md.

---

## s9 — 2026-05-10 — Comprehensive road-clearance audit + BASEMAP doc fix

User: "find everything that's broken … get it accounted for". Stopping the iterative loop with a single full audit.

**Root cause of the s7/s8 loop:** [BASEMAP.md](../../BASEMAP.md) listed roads at `z=+30 back-cross`, `z=-50 cross`, and a `+50/+30 airfield spur` that **don't exist in the floor-shader fragment** (`js/scenes-selector.js` `_buildEnvironment` ~line 269). The actual asphalt mask only renders for the perimeter loop (N/S/E/W) + spine. Every shift since s7 was relative to phantom roads, leaving buildings still close to the only real road in the SW (S-perim z=+50). I should have read the shader on s7 instead of trusting the doc — that's what dragged the loop out.

**SW position fixes (this build):**
- Decon: z=38 → 30 (was 7u from S-perim south edge, now 15u)
- Greenhouses: z=62 → 70 (was 7u from S-perim north edge, now 15u)
- Solar canopy: z=40 → 28 (was 5u, now 17u)

**Full audit of every fixed-position group placement in the file:**

| Position | Building | Status |
|---|---|---|
| (62, -8, 8) | Fuel depot (legacy) | Clear |
| (150, -8, -25) | Distant scatter | Far off-base, clear |
| (-40, -8, -71) | Legacy structure | z<-85.5 needed for N-perim, clear |
| (-95, -8, -65) | West propellant tank farm (s8 shrink) | x clears W-perim by 1.5u, z clears all |
| (95, -8, -25) | East hangar (s8 shrink) | x clears E-perim by 2.5u, z=-25 only crosses cement walkway at z=-30 (1.6u) |
| (-92, -8, -100) | NW secondary silo (s4) | x=-92 outside N-perim x-range [-78,78] — N-perim doesn't paint here ✓ |
| (92, -8, -100) | NE SAM battery (s4) | Same — x=+92 outside x-range ✓ |
| (-22, -8, -22) | NW maintenance pad | Clear |
| (-38, -8, -28) | NW SIGINT vans (s7) | Clear of x=-30 walkway ✓ |
| (-50, -8, -10) | NW aid station | Clear |
| (-58, -8, -22) | NW relay tower | Clear |
| (-92, -8, -18) | NW conex depot (s7) | Clear, west of W-perim |
| (-92, -8, -8) | NW watchtower (s7) | Clear |
| (-58, -8, -60) | NW radio shack (s7) | Crosses cement walkway at z=-58 (1.6u, low contrast) — acceptable |
| (-25, -8, 20) | SW bio-research lab | Clear |
| (-15, -8, 30) | SW decon (s9) | Clear by 15u from S-perim |
| (-58, -8, 20) | SW refrig containers | Clear |
| (-55, -8, 70) | SW greenhouses (s9) | Clear by 15u from S-perim |
| (-72, -8, 22) | SW bio-incinerator | Clear |
| (-38, -8, 68) | SW clarifier | Clear by 13u from S-perim |
| (-42, -8, 28) | SW solar canopy (s9) | Clear by 17u from S-perim |
| (50, -8, 30) | Pelican pad | Clear (S-perim x ∈ [-78,78], pad at z=30 north of road) |
| (15, -8, -110) | (legacy) | z<-85.5 OR x outside N-perim x-range — verified clear |

**Also fixed:** [BASEMAP.md](../../BASEMAP.md) — replaced the phantom-road table with the real shader masks + a "use ≥10u clearance" placement rule + an explanation of x/z masking, so future passes don't repeat the loop.

**Dead code (defined but unreferenced via v2 hosts, NOT built into scene):** `_buildBioStation` (legacy at line 6159, would have placed at z=46.8 inside S-perim), `_buildCommTowerBig`, `_buildRadarBuilding`. Tagged for deletion on a follow-up cleanup.

Files: js/scenes-selector.js, js/builds/scenes.js (s8 → s9), docs/scenes/FILE_MAP.md, BASEMAP.md.

---

## s8 — 2026-05-10 — De-road-overlap pass on the biostation host + outer compounds

User feedback (BIOSTATION SW POI again): "buildings and stuff still in middle of the road, move to the side. make sure no assets are ON THE ROAD other than scripted moving vehicles or people but not buildings". Three more building/host overlaps caught:

1. **Biostation host front-right hazard post + specimen tank** were diagonally rotated into the S-perim road. With the host at world (-42, 4, 42) and lookAt(0, 4, 0), the panel-host's local +X axis maps to world (0.707, 0, 0.707), so internal (+5.5, +2.2) (the front-right hazard post) lands at world z=47.45 — 1.95u inside the S-perim road span (z=45.5..54.5). Same for internal (+3.5, +1.6) (front-right specimen tank) at z=45.6.
   - **Fix:** shrink hazard-post perimeter from (±5.5, +2.2/-4.5) to (±4.0, +0.5/-3.5), tighten specimen-tank x-spacing 1.4 → 1.0, move BIOHAZARD sign + tape spans to match. Front-right post now at world z=45.18, tank at z=44.90 — both clear of S-perim. Back posts still clear of back-cross (z=33.5).

2. **West propellant tank farm** at (-92, -45) had a 36u-wide pad → x=-110..-74. The W-perim road span (x=-82.5..-73.5) was overlapped by 8.5u of pad.
   - **Fix:** shrink 5 tanks → 3 (catwalk 34→13, pad 36→22, berm 36.4→22.4, sx*18→sx*11, pumphouse x=-19→-13, service vehicles x=14/17→8/11), move (-92,-45) → (-95,-65). New pad x=-106..-84 (clear of road by 1.5u, clear of inner fence by 4u), z=-69..-61 (clear of cross-road south edge -53.5 by 7.5u, clear of N-perim north edge -85.5 by 16u).

3. **East aircraft hangar** at (+92, -45) had a 24×36 apron → x=+80..+104, z=-63..-27. Apron west edge +80 was 2.5u inside the E-perim road; apron z range straddled the cross-road at z=-50.
   - **Fix:** shrink hangar 18×9×28 → 14×9×22, move (+92,-45) → (+95,-25). New apron 20×30 → x=+85..+105, z=-40..-10. Clears E-perim road by 2.5u and clears cross-road by 10u.

Files: js/scenes-selector.js, js/builds/scenes.js (s7 → s8), docs/scenes/FILE_MAP.md.

---

## s7 — 2026-05-10 — De-road-overlap pass on NW + SW fills

User feedback (BIOSTATION SW POI): "stuff is still in the middle of the road that doesn't make sense. We can do it on one or both sides of a road, but it can't all be on in the middle of the road". Several s5 + s6 fill clusters straddled road masks defined in BASEMAP:

- back-cross @ z=+30, half-width 3.5 (clear: |z-30| > 4.5)
- S-perim @ z=+50, half-width 4.5 (clear: |z-50| > 5.5)
- W-perim @ x=-78, half-width 4.5 (clear: |x+78| > 5.5)
- cross @ z=-50, half-width 3.5 (clear: |z+50| > 4.5)
- side walkway at x=±30 in z ∈ [-58, -18]

Shifts (group anchor only — no re-design):

SW quadrant:
- Bio-research lab: (-25, 30) → (-25, 20). Was straddling back-cross.
- Refrigerated container yard: (-58, 32) → (-58, 20). Same.
- Geodesic greenhouses: (-55, 55) → (-55, 62). Was straddling S-perim.
- Solar canopy: (-42, 45) → (-42, 40). Tightened to fit between back-cross and S-perim.
- Waste-water clarifier: (-38, 60) → (-38, 68). Pushed further south of S-perim.

NW quadrant:
- SIGINT vans: (-32, -28) → (-38, -28). Was straddling x=-30 walkway.
- Conex container depot: (-78, -18) → (-92, -18). Was on the W-perim road.
- Watchtower: (-78, -8) → (-92, -8). Same.
- Radio shack/barracks: (-58, -55) → (-58, -60). Edge was inside cross-road buffer.

Files: js/scenes-selector.js, js/builds/scenes.js (s6 → s7), docs/scenes/FILE_MAP.md.

---

## s6 — 2026-05-10 — Biostation rebuild + SW quadrant fill

User feedback: "biostation is completely empty give it cool building colors etc etc". From the BIOSTATION SW POI cam at (-22, 6, 20) yaw -2.36, the panel sat alone on empty asphalt. Rewrote the host w/ a coherent neon bio palette (pink / cyan / purple / green) and added a 7-cluster SW quadrant fill keyed to the same palette so the whole quadrant reads as a xenobio research zone.

**Biostation host rewritten** (`biostation_quarantine` in `_buildPanelHost`):
- Central airlock dome (3.2u radius) w/ cyan equator band, pulsing pink apex, neon-green airlock door + steel frame.
- 2 connected research pods (left = pink-glow, right = purple-glow), each w/ glowing window strips on front + outer side, connecting tubes to dome w/ glowing TorusGeometry bands, 2 roof vent stacks per pod.
- Pitched pink-glass skylight over the dome.
- 6 bio-luminescent specimen tanks in front of the dome (pink/cyan/green/purple/pink/cyan), each w/ steel base + cap + pulsing inner glow on independent rates.
- Caution chevron strip (yellow/black alternating) along bottom of panel.
- 4 hazard posts forming a wider 11×7 perimeter w/ amber strobes on top, yellow tape spans on all 4 sides.
- BIOHAZARD trefoil sign (orange background, 3 black lobes + central dot) on a stake in front-left.

**New `_buildSWQuadrantFill()`** (called between `_buildNWQuadrantFill` and `_buildAllStructures`). 7 themed clusters, all keyed to the same neon bio palette:

- **Bio-research lab** at (-25, -8, 30): 9×6.5×6 clean-white concrete shell w/ 2×3 cyan window grid on front, neon-green airlock door, vertical pink/purple side accent strips, roof HVAC + 2 fume hood stacks (cyan tip strobes), red roof aviation strobe, BIOHAZARD label, surrounding concrete pad.
- **Decontamination unit** at (-15, -8, 38): 4-stall shower row, white walls + roof slabs, cyan steam glow inside each stall, overhead shower heads, drain grates, green status LEDs, 2 supply tanks behind w/ status placards.
- **Refrigerated specimen container yard** at (-58, -8, 32): 3 white containers w/ vertical ribs, condenser units + cooling fins on roof, cyan cooling glow under doors, hazard placards, blinking cyan status LEDs.
- **Geodesic greenhouse cluster** at (-55, -8, 55): 4 squashed-icosahedron domes (pink/green/purple/cyan), wireframe geodesic frame overlay, concrete ring bases, warm-glow door slits, pulsing apex lights, cement walkway connecting all 4.
- **Bio-waste incinerator stack** at (-72, -8, 22): 4-cube concrete furnace base w/ glowing orange door, 14u-tall chimney stack w/ reinforcement bands + top cap, hot-orange exhaust glow + red aviation strobe at top, external ladder, hazard sign, ash drum.
- **Waste-water clarifier** at (-38, -8, 60): 4.5u-radius open-top concrete tank, cyan bio-fluid surface (animated), central support column, rotating skimmer arm (registered to `_radarBuildingPivots`), 4 access stairs, effluent pipe.
- **Solar-panel canopy** at (-42, -8, 45): 3×6 panel array on posts, dark-blue cells w/ cyan grid lines, tilted toward south.

Files: js/scenes-selector.js, js/builds/scenes.js (s5 → s6), docs/scenes/FILE_MAP.md.

---

## s5 — 2026-05-10 — NW quadrant fill (broken-dish POI no-empty pass)

User feedback: "we have this area from broken dish fill it out i don't want empty space anywhere pls be efficient creative etc". From the BROKEN DISH POI cam at (-38, 8, -14) yaw -0.98 pitch -0.05 the foreground asphalt + mid-distance flanks read as empty road between the deck and the broken-dish host at (-66, -35).

New `_buildNWQuadrantFill()` (called between `_buildOuterCompounds` and `_buildAllStructures`). Six layered clusters spaced across the depth bands so every distance has silhouette:

- **FOREGROUND (8-15u)** at (-22, -8, -22): field maintenance pad — concrete pad w/ yellow caution border, parked Warthog up on jack stands, tool crates, mechanic's red tool chest, telescoping work lamp.
- **MID-LEFT (20-30u)** at (-32, -8, -28): SIGINT mobile listening post — 3 parallel-parked olive vans w/ rooftop dishes (each angled differently), lit windscreens + side panel strips, vertical whip antennas w/ blue tip strobes, ground cable run, diesel generator.
- **MID-CENTER (35-45u)** at (-50, -8, -10): tactical aid station — GP-medium ridge tent w/ red cross, lit door panel, medics' Warthog w/ red cross on roof, fuel can rack.
- **MID-FAR (40-55u)** at (-58, -8, -22): signal-relay tower — 22u-tall lattice w/ full X-bracing, slewing dish on a service platform (registered to `_radarBuildingPivots`), top mast w/ red strobe + 2 mid-mast strobes, base equipment shed w/ lit door, 2 vertical whip antennas flanking.
- **MID-FAR-LEFT (50-65u)** at (-78, -8, -18): conex container depot — 3-2-1 stacked containers (6 total, alternating olive shades), open lit container door, parked yellow forklift w/ amber roof beacon, hazard light pole, loose pallets.
- **FAR-LEFT (50-65u)** at (-78, -8, -8): perimeter watchtower — 9u-tall 4-leg lattice w/ X-bracing, enclosed cabin w/ lit windows on all 4 sides, rotating roof searchlight (registered to `_radarBuildingPivots`), ladder, top aviation strobe.
- **BACK-CENTER (60-75u)** at (-58, -8, -55): radio shack + barracks — long olive barracks w/ 6 lit windows + warm door + roof whip antennas, smaller concrete radio shack w/ 3 dish array on roof.

Files: js/scenes-selector.js, js/builds/scenes.js (s4 → s5), docs/scenes/FILE_MAP.md.

---

## s4 — 2026-05-10 — Outer-base silhouette anchors (use the wide flanks)

User feedback: "why aren't u using the sides and their empty space everything is still on ur tiny little plot of land … we built a floor plan originally so you'd get an idea of how to shape shit doesn't mean be rigid". The wide zones at x=±78..±110 (between the perimeter loop road and the inner fence) read as black void at every front POI; s2 + s3 had only added fill INSIDE the central plot.

New `_buildOuterCompounds()` (called between `_buildDeckFlankFill` and `_buildAllStructures`). Four big silhouette anchors:

- **WEST PROPELLANT TANK FARM** at (-92, -8, -45). 5 vertical fuel tanks (3u radius × 11u tall) in a row, domed tops, frost banding, vent stacks w/ red strobes, gantry catwalk linking dome tops, concrete pad w/ containment berm, pumphouse shed at the south end, 2 service vehicles parked alongside. Reads as a real refinery / Cape Canaveral fuel depot from any front POI.
- **EAST AIRCRAFT MAINTENANCE HANGAR** at (+92, -8, -45). 18×9×28 arch hangar w/ half-cylinder roof + structural ribs, big lit south door showing parked vehicle silhouette inside, side personnel doors, lit window strip on the long west face, roof antenna mast w/ strobe, blue apron taxi-line lights, fuel bowser parked beside.
- **NW SECONDARY LAUNCH PAD ("Pad 8")** at (-92, -8, -100). Octagonal pad + smaller silo (1.8r × 14h) w/ caution chevrons + "08" stencil + cap + strobe, 2-leg service mast, sandbag perimeter, small bunker w/ slit window, 4 corner floodlight pylons w/ aviation strobes. Reads as a sister to the hero Pad 7.
- **NE SAM BATTERY** at (+92, -8, -100). Patriot/THAAD-style: 3 inclined launcher rails on swivel mounts (4-cell box launchers w/ missile noses poking out), large fire-control radar dish on a tracked mount (registered with `_radarBuildingPivots` so it spins), command trailer w/ uplink dish + lit window, ammo reload pallets w/ canister stacks, 2 floodlight pylons.

Files: js/scenes-selector.js, js/builds/scenes.js (s3 → s4), docs/scenes/FILE_MAP.md.

---

## s3 — 2026-05-10 — Rocket-propulsion clutter in the SW compound

User feedback on the screenshotted SW compound floor (between the LOX tank and the payload transporter): "more fuel tanks or shit that makes sense near rockets." The zone read as empty asphalt around the parked truck.

Added inside `_buildMissileSite` (just before the PT block):
- **Secondary spherical oxidizer/fuel tank** at (-(siloR+9), 4u tall sphere on skirt support, -7) with vent tower, equator band, red hazard placard, and a feed pipe to the silo base. Spheres read instantly as pressurized propellant.
- **Helium / GN2 high-pressure bottle rack** at (-(siloR+6), -10) — 12 tall thin cylinders (2 rows × 6) in a steel cage frame with brass valve domes + yellow placard.
- **Hypergolic propellant cabinet** at (-(siloR+4), 7) — closed steel locker w/ split doors, orange hazard diamond, yellow caution stripe around the base.
- **Color-coded drum cluster** at (-(siloR+2.5), 11) on a caged pallet — red oxidizer / olive fuel / yellow caution / blue water drums with black equator bands.
- **Hose reel + fuel pump cabinet** at (-(siloR+5), -2) — pump cabinet, ground-mounted hose reel with hose snaking to the floor, status LED.
- **Spill-containment berm** — concrete curb perimeter w/ yellow caution stripe wrapping the propellant zone, so the cluster reads as engineered containment instead of random clutter.

Files: js/scenes-selector.js, js/builds/scenes.js (s2 → s3), docs/scenes/FILE_MAP.md.

---

## s2 — 2026-05-10 — Missile-silo POI legibility pass + flank-fill beef-up

User asked: "we see the galaxy billboard, we don't see the missile … there's a radar dish literally interfering with a missile … this place needs to make a lot more sense", with a marked screenshot circling the empty floor on either flank of the billboard.

Root cause from the MISSILE SILO POI (camera at (0, 5, -55) yaw 0, pitch 0.02 looking -Z):
- Galaxy billboard at world (0, 10, -88) sits dead-axis between the camera and the silo at (0, -8, -118). Billboard subtends ±13.9° horizontally; silo cap silhouettes at angular x≈0° and y≈10.3° — fully eclipsed by the closer billboard.
- Forward-ops radar bar (rotating, west corner of the bunker at world ≈21, -1, -67) swept across the silo silhouette zone (angular x ≈ 13–19° at some rotations).
- Missile compound interior was tightly packed (LOX, generator, antennas, transporter, bunker all within siloR+6..14u of the pad center).
- Existing `_buildDeckFlankFill` (b237) populated the flanks but only with 3u guard shacks + 5u equip sheds + 1u drums — silhouettes vanish at 30–50u.

Changes:
- **Galaxy panel offset west to (-14, 10, -88)** (was (0, …)). Silo at (0, -8, -118) now dead-center from the MISSILE SILO POI; billboard reads as an offset entry sign at angular x ≈ -23°. POI pitch lifted 0.02 → 0.10 to frame the silo cap + missile body cleanly. From the OBSERVATION DECK POI billboard angular x = -9° (still unmistakably hero).
- **Stadium pylons re-symmetrized** at (±14, -110), (±14, -126) (was (±14, -98), (±14, -120)) to bracket z=-118 instead of an asymmetric clamp 9u north of the silo. Per-head lookAt now targets (·, ·, -118). Building flood-beam sources + targets retargeted from the stale (0,6,-107) to (0,6,-118).
- **Forward-ops radar flipped to outer (east) corner** of the bunker (radarBase + radarPivot now at +bW*0.30 instead of -bW*0.30). Bar tip world x range ≈ 25–30 instead of 19–24, so it no longer sweeps across the silo silhouette zone. Strobe flipped to inner corner so the two roof features bracket instead of stack.
- **Missile compound spread** — the user's "everything is too close together" complaint:
  - LOX from siloR+11.5 → siloR+15 (and z 2.4 → 4.0)
  - Generator shed from padR+6 → padR+9 (z 6.5 → 8.5)
  - Antenna farm from padR+14 / -12 → padR+18 / -16
  - Payload transporter from -padR-8 / +9 → -padR-13 / +14
  - LF compoundR from padR+12 → padR+17 so floodlight pylons / cameras / signs ring the now-spread layout instead of clustering on top of the relocated equipment.
- **Deck-flank readability pass** — added 2 parked Warthogs + 1 SATCOM uplink trailer (3.4×2.0×5.4 box + tilted parabolic dish) + 1 6-cube HESCO Bastion barrier row + 1 floodlight per flank, in the user-circled zones (x = ±20…±40, z = -32…-52). Avoids the x=±30 cement walkway and stays north of the panel hosts at z=-70/-72. New helpers `buildCommUplinkTrailer`, `buildHescoRow`, `buildParkedWarthog` live inside `_buildDeckFlankFill`.

Files: js/scenes-selector.js, js/builds/scenes.js (s1 → s2), docs/scenes/FILE_MAP.md.

---

## s1 — 2026-05-09 — Scenes split-off (post-b242 migration starting point)

No code change to scenes-selector.js itself. Only the build-bookkeeping moved to per-scene files. See root [CHANGELOG.md](../../CHANGELOG.md) b242 for the migration entry.

State carried over from b241:
- Military-base panorama with 11 panels in 261° radial arc.
- Bigger perimeter envelope (b231): inner+outer fence at x=±110/125, watchtowers at corners, razor wire, conex stacks in the clear-strip.
- Ridge silhouette restored (b234).
- Missile silo scaled up + LF compound build-out (b237).
- Deck-flank fill + missile silo spacing fix (b241).
