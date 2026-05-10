# SCENES CHANGELOG

Per-scene history for `/scenes` starting at the post-split point. Build history before the split (b001–b242, including the b139 selector cutover + b140-b231 desert/perimeter/POI/missile-silo work + b237 LF compound) lives in the frozen root [CHANGELOG.md](../../CHANGELOG.md). New scenes builds are logged here.

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
