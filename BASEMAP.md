# BASEMAP.md — /scenes military base floor plan

**Purpose:** persistent design spec for the `/scenes` selector base. Loaded by future chats so we don't have to rebuild the layout from screenshots every time.

**Build state:** redesign starts at b193 (panel reposition + broken-dish overhaul). Original b170-b192 layout = "v1" (cluster-pile-up era). This is "v2 radial."

**File this lives in:** all geometry built in [js/scenes-selector.js](js/scenes-selector.js). Top-down coordinates: camera at world (0, 0, 0), looking toward -Z (north = "into the base"). +X = east. Floor at world y=-8.

---

## Design philosophy (locked)

1. **Hub-and-spoke radial.** Camera = command observation deck. Galaxy panel = hero feature dead-center far. Other 10 panels arc around the camera at clean ~20° spacing.
2. **Three rings.**
   - **R1 (15-20u):** deck rail — terrain + villa kiosks, sandbag wrap.
   - **R2 (40-65u):** working base — every panel host lives here, each in its own pocket.
   - **R3 (75-95u):** silhouette ring — towers, broken dish, ridge silo, distant beacons. No panels.
3. **Activity-first.** Every zone earns its real estate by having a scripted micro-narrative (tank moves to bay, forklift loops crates, Pelican lands/unloads, engineer walks gantry, dish slews).
4. **Roads exist to be driven on.** Perimeter loop + spine + 1 forward cross-road + 1 back cross-road. Real patrol routes for Warthog, Scorpion, supply convoy.
5. **Symmetry, broken.** West side = SIGINT/comms (lattice geometry, blue strobes). East side = LOGISTICS/airfield (warm sodium, container chunky-form, red strobes). North = launch hero. South = bivouac/back-of-house.

---

## Panel placement — radial spec (v2)

Camera at origin. Bearing measured from forward (-Z). Distance = R (host placed slightly further than panel).

| Panel | Bearing | R(panel) | Panel pos (x,y,z) | Host kind |
|---|---|---|---|---|
| galaxy (back to /) | 0°  (front-center) | 88 | (0, 8, -88) | missile_silo |
| dimensions (01) | -20° (front-left) | 75 | (-26, 8, -70) | comms_array_shed |
| livingwall (02) | +20° (front-right) | 75 | (26, 1, -70) | forward_ops_radar |
| freqmap (04) | -42° (left mid) | 65 | (-43, 5, -48) | sigint_tower |
| tape spine (05) | +42° (right mid) | 65 | (43, 4, -48) | logistics_yard |
| deepsea (08) | -62° (left far) | 75 | (-66, 8, -35) | broken_dish |
| neural (09) | +62° (right far) | 75 | (66, 4, -35) | sensor_pylon |
| organism (03) | -135° (rear left) | 60 | (-42, 3, 42) | biostation_quarantine |
| wall (06) | +135° (rear right) | 60 | (42, 4, 42) | back_billboard_lattice |
| terrain (07) | rail kiosk | -- | (-5, -3, -10) | rail_kiosk_left |
| villa (10) | rail kiosk | -- | (5, -3, -10) | rail_kiosk_right |

Every panel is now ≥18u from any other panel in (x,z) — no two collapse into one from the camera.

---

## Zone catalog — activity script per zone

### N-CENTER · "Pad 7" — galaxy panel (HERO)
Missile silo, dead-axis at z=-88. Service gantry tower beside it. Engineer crew walking gantry catwalk.
- silo strobe pulses red at silo cap
- countdown lights run yellow→amber→red sequentially up tower (12s cycle)
- 3 engineer figures pace gantry, stop at panel, walk back
- subtle steam vent at silo base every 12s
- red blast-light strobes at jersey wall corners

### NW · "Comms Array" — dimensions panel
Equipment shed at base of antenna grid. 8 antennas (12-22u tall) in 3-row grid, sigint trailers, climbing engineer.
- top-dipole strobes pulse red, staggered phases per mast
- mast #4 has an animated engineer climbing/descending (3-key)
- one mast yaw-slewing slowly
- trailer rooftop A/C fan spinning

### NE · "Forward Ops" — livingwall panel
Ops bunker with rotating roof radar. Open-front vehicle bay 12u east — mechanic with sparks.
- roof radar spins continuously
- mechanic spark-flicker inside bay
- ops crew silhouette behind lit ops window slides L-R every 8s
- Pelican approach corridor passes overhead toward SE airfield

### W-MID · "SigInt Tower" — freqmap panel
Tall lattice comm tower. Platform partway up = panel mount. Operator paces platform.
- platform operator paces L-R-L (3-state walk)
- platform dish slews ±15° az on 8s cycle
- 2 sigint vans at base with warm-glow rooftop strobes
- additive line pulses travel cable run from van → tower base

### NW-FAR · "Broken Dish" — deepsea panel
Damaged parabolic dish, billboard on rim. East half of rim sags, support broken, scaffold prop, hazard cones.
- continuous spark sprite + small particles at break point
- Longsword formation flies *through* dish gap on every 3rd flyby
- aviation strobe blinks irregularly (fault)
- repair-crew welding-torch additive pulse on scaffold every 4s

### E-MID · "Logistics Yard" — tape spine panel
Stacked containers (panel mount), forklift, cargo truck, crane, fuel depot adjacent.
- forklift drives fixed L-shaped path: pickup → stack → return (15s loop)
- cargo truck arrives via E-leg perimeter, parks 30s, leaves (60s loop)
- crane swings load arc

### E-FAR · "Sensor Pylon" — neural panel
Standalone pylon, no big building. 5u-radius circle of small sensor obelisks around it. Tech with clipboard.
- obelisks blink in synaptic patterns — wave propagating around ring
- central pylon dish slewing
- tech figure walks slow circle perimeter

### DECK-RAIL · terrain + villa
Stay where they are. Tweak: angle each kiosk 15° off-axis. Optional: add tactical map table prop between them (warm desk lamp).

### SE · "Airfield" (no panel — pure activity)
24×24u concrete pad + painted approach lights + parked Pelican slot + ground-crew shack + 4 portable floodlights.
- Pelican 90s loop: spawn z=+200 → descent → land → ramp lower (12s) → 4 crates roll out + 2 ground crew with light wands → ramp close → engines spin up → liftoff toward NE corridor

### S · "Bivouac" (no panel)
3 barracks with road BETWEEN them (not shoulder-to-shoulder), 6 tents, central campfire.
- campfire flicker (additive sprite + ember particles)
- 4 NPC walks between tent ↔ barracks (random idle)
- one barracks door opens/closes every 20s with warm light spill

### SW · "Bio Lab" — organism panel
Greenhouse + yellow-tape quarantine perimeter (4 hazard posts) + 2 specimen tanks + hazmat figure.
- grow-light strips pulse pink (slow breath)
- hazmat figure walks 6u arc, stops at door, walks back
- specimen tank glows magenta on 5s cycle

### S-FAR · "Wall" billboard
Standalone billboard on lattice posts. Maintenance scaffold on one leg.
- spotlight slowly rotates
- worker silhouette on scaffold every 30s

### OUTER RING (R3) · ridgeline + watchtowers
- 4 corner watchtowers (existing)
- aviation strobes on far ridge
- distant comm tower flashing on horizon W and E
- occasional Forerunner orb drifting along ridge silhouette

---

## Vehicle & aircraft circulation

```
SPINE (x=0):        Patrol Warthog N→S→N, U-turn at deck (60s loop)
PERIMETER LOOP:     Patrol Warthog CCW (full lap ~120s, slow)
                    Scorpion tank on west leg (forward + reverse, doesn't lap)
CROSS @ z=-50:      Supply jeep E→W shuttle to comms array (every 80s)
BACK CROSS z=+30:   3-truck supply convoy E→W every 3min, splits south at S perimeter
SPUR to airfield:   Cargo van runs S-perimeter → airfield → return
LOGISTICS SPUR:     Cargo truck E-perimeter → tape-spine yard → return (60s)

AIR — FRONT:        Longsword V-formation flyby N→S, 1× per 45s, low altitude
AIR — TOP:          Banshee patrol figure-8 high altitude, continuous, magenta plasma
AIR — REAR:         Forerunner orb silent drift along ridgeline, 1 unit, 180s lap
AIR — BROKEN DISH:  one Longsword detours through the gap every 3rd flyby
AIR — AIRFIELD:     Pelican 90s scripted landing (descent → land → unload → liftoff)
```

---

## Roads (shader masks in `_buildEnvironment`)

⚠️ **AUTHORITATIVE SOURCE:** the floor-shader fragment in
[js/scenes-selector.js](js/scenes-selector.js) at `_buildEnvironment` (~line 269).
This table tracks what's actually rendered. Earlier versions of this doc listed
roads at `z=-50`, `z=+30`, and an airfield spur — **none of those are in the
shader**. Verified s9 / 2026-05-10.

Asphalt roads (4.5u half-width — buildings sitting on these get painted over):

| Road | Spec | Mask span |
|---|---|---|
| N perimeter | z = -90, x ∈ [-78, 78] | z ∈ [-94.5, -85.5] |
| S perimeter | z = +50, x ∈ [-78, 78] | z ∈ [+45.5, +54.5] |
| W perimeter | x = -78, z ∈ [-90, 50] | x ∈ [-82.5, -73.5] |
| E perimeter | x = +78, z ∈ [-90, 50] | x ∈ [+73.5, +82.5] |
| Spine N-S | x = 0, z ∈ [-90, -12] | x ∈ [-4.5, +4.5] |

Cement walkways (1.6u half-width — narrow, low visual contrast):
- Cross walkway @ z = -30, x ∈ [-72, 72]
- Cross walkway @ z = -58, x ∈ [-72, 72]
- Side walkway @ x = -30, z ∈ [-58, -18]
- Side walkway @ x = +30, z ∈ [-58, -18]
- Deck ring at r = 15.5 ± 2.5

**Building placement rule:** for static buildings, give ≥10u clearance from
asphalt road masks (use the table above). Walkways are narrow enough that a
building straddling one is mostly invisible — but prefer to flank them. Only
exception: scripted moving vehicles + NPCs can occupy roads (that's their
purpose).

**Note:** roads are masked by both x AND z — e.g. N-perim only renders for
x ∈ [-78, 78]. So a building at x=-92, z=-100 (NW outer compound zone) is
clear of N-perim even though its z overlaps the mask span, because x=-92 is
outside the road's x-range.

---

## Build priority (target order)

1. **b193 — Panel reposition + broken-dish redesign.** Foundation. Every other zone keys off these new panel coords. *In progress.*
2. **b194 — Pelican landing loop at SE airfield.** Highest "holy shit" payoff per hour.
3. **b195 — Patrol vehicles on real routes.** Spine + perimeter. Replaces current frozen jeep.
4. **b196 — Engineer crew on missile gantry + repair crew on broken dish.** Sells the hero zone + gag.
5. **b197 — Forklift loop in logistics yard + cargo truck spur.**
6. **b198 — Bivouac campfire + NPC walks.**
7. **b199 — Operator on freqmap platform + sensor pylon obelisk ring.**
8. **b200 — Mechanic-spark in vehicle bay + ops crew silhouette.**
9. **b201 — Convoy on south road (3 trucks).**
10. **b202 — Forerunner orb on ridge + bigger horizon strobe density.**

---

## Conventions for future contexts

- All world coords assume floor y=-8. Panel y is the panel's height ABOVE floor (panel y=8 means 16u tall mounting).
- `_placeBuilding(grp, cx, cy, cz)` puts the group at world (cx, cy, cz). cy is almost always -8 (= floor level).
- `_buildPanelHost(kind, panelX, panelY, panelZ, panelW, panelH)` builds the chassis around a panel. The chassis group is auto-rotated to face camera (lookAt origin).
- New panel-host kinds added in v2: `comms_array_shed`, `forward_ops_radar`, `sigint_tower`, `logistics_yard`, `broken_dish`, `sensor_pylon`, `biostation_quarantine`, `back_billboard_lattice`. Some reuse existing builds (missile_silo = existing _buildMissileSite).
- Pre-v2 host kinds that may still be referenced: `radarbuilding`, `commtowerbig`, `antenna_shed`, `standoff_dish_billboard`, `supplydepot_top`, `back_billboard`, `biostation`. These were the b176-b187 names; v2 may keep some, rename others.
