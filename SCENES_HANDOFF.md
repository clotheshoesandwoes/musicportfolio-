# SCENES_HANDOFF.md — `/scenes` military base redesign

**For:** fresh Claude session picking up the v2 base build.
**Read order:** this file → [BASEMAP.md](BASEMAP.md) → [CLAUDE.md](CLAUDE.md) → recent [CHANGELOG.md](CHANGELOG.md) entries.
**Active file:** [js/scenes-selector.js](js/scenes-selector.js) (~6000 lines).
**Last build:** ~b201 (auto-bumped by hook each save — check `js/helpers.js`).
**Status:** v2 layout shipped; lighting + activity layer + POI nav still in progress. User is frustrated with current visual state — read the "Open issues" section before touching anything.

---

## 1. The project (60-second version)

**cantmute.me** is Kani's interactive 3D music portfolio. The `/scenes` route is a "scene chooser" — a cinematic military observation deck where 11 holographic billboards represent 10 audio-reactive scenes + 1 portal back to the galaxy index. Click a billboard → focus animation → ENTER → loads `play.html?scene=<id>`.

The user wants `/scenes` to feel "cool as fuck" — a real, occupied military base at night, not a panel arc on a flat plane. Tanks moving on roads, ships scripted to land/unload, engineers tinkering, radar operators pacing platforms, beacons pulsing across the horizon. Quote: *"engineers tinkering, shit that happens on a military installation. people working the radar dishes or them moving. beacons being positioed, etc etc."*

The user is on auto mode 90% of the time. They want execution, not ceremony. They get frustrated by trickle-fixes and corporate-prose recaps. Match that energy.

---

## 2. What's been delivered (b193 → ~b201)

### b193 — v2 radial reposition (foundation)
Locked in the radial-zone redesign. Coordinates for every panel, written to [BASEMAP.md](BASEMAP.md). Galaxy is now dead-axis hero at z=-88, every other panel fans out at clean ~20° bearings from the camera. Right-flank pile-up gone. Symmetric left-flank cluster gone.

**11 panels** now live at:
- **galaxy** (HERO) — (0, 10, -88) — `missilesite` host
- **dimensions** — (-26, 7, -70) — `comms_array_shed`
- **livingwall** — (26, 7, -70) — `forward_ops_radar`
- **freqmap** — (-43, 5, -48) — `sigint_tower`
- **tape spine** — (43, 5, -48) — `logistics_yard`
- **deepsea** — (-66, 7, -35) — `broken_dish` (new)
- **neural** — (66, 7, -35) — `sensor_pylon`
- **organism** — (-42, 4, +42) — `biostation_quarantine`
- **wall** — (42, 4, +42) — `back_billboard_lattice`
- **terrain** — (-5, -3, -10) — `rail_kiosk_left` (deck)
- **villa** — (5, -3, -10) — `rail_kiosk_right` (deck)

7 new inline panel-host chassis builders in `_buildPanelHost`. Old hosts (radarbuilding, commtowerbig, vehiclebay, helipad, etc.) are now deadcode — kept in the file for reference.

### Broken dish redesign (`_buildBrokenDish` at line ~2141)
Replaces the back-left standoff dish for the deepsea panel. Carved 72° gap in the rim, dangling sagging fragment held by a single strap, snapped support truss with burnt charring, 3 yellow scaffold posts propping the broken edge, hazard cones, sustained spark sprite, welder additive pulse, fault-pattern aviation strobe. Gap world-position exposed on `standoff.brokenDishGap` for the future flyby-through gag.

### Pelican pad relocation
Moved from (-2, +24) directly south-of-camera to SE airfield (50, +30). Engineer crew and pelican lights coordinates updated. Motor pool (3 hogs + 1 scorpion) moved from (40, -42 etc) — was inside the new logistics yard — to airfield ground support (32, +24 etc).

### Bivouac tents + personnel walking routes re-anchored
Old west/east clusters sat in v2 panel zones. Pulled to SW (-22, +18) and SE (+22, +16). Walking routes rewired to v2 host coordinates.

### Building lighting pass (b200-b201)
- Killed the panel idle bob (`sin(t * 0.4)` drift) — panels are now locked to basePos.
- Killed the panel down-tilt — `lookAt(0, py, 0)` not `py * 0.5`.
- Halo blob scaled down 1.8× → 1.05×, opacity 0.86 → 0.10 idle.
- Added support masts under floating panels.
- Boosted uplight intensity 0.65 → 0.85, scale 10×20 → 12×24.
- Added more inline lit windows on each v2 host.
- Added lit operator booth on every standoff `_buildCommTower` (4 cabin windows + base LEDs).
- Added lit plinth windows on `_buildDish` and the broken dish.
- New `_buildBaseLighting()` builder: 20 perimeter streetlamps, 4 stadium pylons around missile silo, 2 scaffold floodlights at broken dish, distant-tower base LEDs.
- Floor props bumped (cones 10→18, coils 5→9, crates 8→16, scatter radius 30→50).

### BASEMAP.md
Persistent design spec. Covers panel coords, per-zone activity script, road network, build priority. Loaded by future chats so we don't redesign from screenshots each session.

---

## 3. Open issues (the user is frustrated about these)

### A. The "holographic" lit-window look
All emissive surfaces (windows, door glows, strip lights, cabin windows) use `THREE.MeshBasicMaterial` with `blending: THREE.AdditiveBlending` and `depthWrite: false`. They render as flat additive cards layered on top of the building, NOT as windows recessed into walls. From any angle they look like floating UI plates instead of real light. User quote: *"all the holograms have that looks fucking terrible."*

**Why it's hard to fix properly:** the building chassis use `MeshBasicMaterial` (no lighting response). To make windows actually emit light onto walls, the chassis would need `MeshStandardMaterial` + real `THREE.PointLight`s. That's a pipeline rewrite — every shader, every fog calculation, every panel material would need to be re-tested. Not feasible in one chat turn.

**Pragmatic fix path** (accepted by user): switch the additive-emissive windows to non-additive solid emissive planes (opaque, slight z-offset off the wall, no flicker on/off). Looks more like recessed windows than UI overlays. Doesn't add real light spill, but kills the "floating card" read.

### B. Empty desert between deck and forward arc
Old buildings (cmd bunker, vehicle bay, big barracks, helipad) used to fill r=20-40 from camera. They were orphaned and removed because they sat in v2 panel zones. Replacement decoration is just floor props (cones, crates, coils). Reads as "lots of dirt." User quote: *"there's a lot of still empty space on the military bases. It makes no sense that the space is empty."*

### C. The promised "scripted activity" never landed
BASEMAP.md priority list (b194-b202) was: Pelican landing loop, patrol vehicles on real routes, engineer crews on missile gantry, repair crew on broken dish, forklift loop in logistics yard, bivouac campfire + NPC walks, operator on freqmap platform, sensor pylon obelisk ring, mechanic-spark in vehicle bay, convoy on south road. **None of it shipped.** Static structures only.

### D. Scene panels have no real context
Panel descriptions are abstract: *"Layered planes of audio-reactive geometry. Depth as music — each frequency band carves its own slice through space."* User can't tell what they'll see if they click. Fix path: rewrite descriptions OR build POI nav so the location of each panel's mounted building IS the context.

### E. Layout doesn't match "cool as fuck" promise
The radial coordinates match BASEMAP, but visually it's still a flat night desert with billboards. The user pitched something Active Theory-tier; we delivered b193 reposition + lighting tweaks. Big gap.

---

## 4. The agreed-on plan (NEXT TASK FOR FRESH CHAT)

User accepted this plan at the end of the last conversation:

### Step 1: POI navigation system
Discrete viewpoints across the base. Camera stays fixed at hex deck by default; clicking a POI marker animates camera position + lookAt to a preset viewpoint over ~1.5s with cubic ease. Drag-look continues to work from each POI. ESC returns to hex deck.

**Reasoning the user accepted:** without POIs, screenshots are stuck at one POV (deck looking forward). User can't show what the broken dish looks like up close, or the missile silo from the gantry, or the airfield approach. With POIs, user navigates → screenshots → fresh chat makes targeted fixes from the right angle.

**POI list (proposed, ~10):**
1. observation deck (default) — (0, 0, 0) lookAt (0, 0, -50)
2. missile silo close — (0, 4, -75) lookAt (0, 6, -94)
3. broken dish — (-50, 6, -25) lookAt (-70, 4, -38)
4. sigint tower — (-30, 4, -35) lookAt (-43, 5, -48)
5. logistics yard — (30, 4, -35) lookAt (43, 5, -48)
6. forward ops bunker — (15, 4, -55) lookAt (26, 4, -70)
7. comms array — (-15, 4, -55) lookAt (-26, 4, -70)
8. SE airfield — (35, 4, +18) lookAt (50, 0, +30)
9. biostation SW — (-30, 4, +30) lookAt (-42, 2, +42)
10. ridge view — (0, 18, 30) lookAt (0, 4, -94)  // high vantage of whole base

**Implementation notes:**
- Add `this.poi = { current: 0, target: 0, fromPos, toPos, fromYaw, toYaw, t: 0, inTransit: false, list: [...] }` to the scene state.
- Camera position lerps with `t` running 0→1 over ~1.6s, eased with `t*t*(3-2*t)`.
- Yaw lerps (or set instantly on arrival, simpler).
- HUD strip at bottom-center: clickable POI buttons or compact dropdown.
- Hotkeys: `1`-`9` jump to POI, `n`/`p` next/prev, `ESC` deck.
- DON'T break the existing panel-click → focus → ENTER flow; both can coexist.

### Step 2: Tone down the holographic emissives
- Change additive windows to non-additive opaque emissive (or low-additive at fixed opacity, no flicker).
- Reduce the `standoff.windows` flicker amplitude from ±10% to ±3% (or kill it entirely on side strips).
- Don't touch panel hologram shader (`PANEL_FRAG`) — that's the intentional aesthetic.

### Step 3: STOP and wait for user screenshots
After Steps 1+2, do not push further. User will navigate to each POI, screenshot, and tell us which zone needs attention.

---

## 5. Build priority — what's still ahead (deferred from BASEMAP.md)

Once POI nav exists and user has guided which zones to fill in, the remaining BASEMAP scope:

| Build | Item | Why it matters |
|---|---|---|
| **next** | Pelican landing loop at SE airfield (90s cycle) | Highest visual ROI per hour |
| **next** | Patrol vehicles on real routes (spine + perimeter) | Replaces frozen jeep |
| **next** | Engineer crew on missile gantry + repair crew on broken dish | Sells hero zone + gag |
| **later** | Forklift loop in logistics yard + cargo truck spur | |
| **later** | Bivouac campfire + NPC walks | Already half-built (NPCs walk; need bonfire) |
| **later** | Operator pacing freqmap platform + sensor pylon obelisk synaptic ring | |
| **later** | Mechanic-spark in vehicle bay + ops crew silhouette | |
| **later** | 3-truck supply convoy on south road | |
| **later** | Forerunner orb on ridge + bigger horizon strobe density | |

Each line is its own commit. Don't bundle. User wants visible deltas, not 800-line megacommits.

---

## 6. Conventions / file structure

### Coordinates
- Camera at world (0, 0, 0). -Z is "into the base" (north). +Z is behind camera.
- Floor at world y = -8. Building chassis built in local space with `floorY = -8 - py`.
- Panel y is altitude ABOVE world 0; mostly y=4 to y=10. Galaxy y=10 (hero).

### Roads (shader masks in `_buildEnvironment`)
- N perimeter z=-90, S perimeter z=+50, W x=-78, E x=+78 — half-width 4.5u
- Spine x=0, z ∈ [-90, -12] — half-width 4.5u
- Walkways at z=-58, z=-30 (cement), x=±30 sides

### Pivots tied to animate loop
- `_radarBuildingPivots[]` — anything pushed here gets `rotation.y = t * 0.6` in the tick
- `_watchtowerLights[]` — searchlight rotation
- `standoff.dishes[]` — slow lookAt drift
- `standoff.strobes[]` — aviation pulse
- `standoff.windows[]` — interior flicker (rate, phase, baseOpacity in userData)

### Build chain
The user has a hook that auto-bumps `js/helpers.js` `window.BUILD_NUMBER` on every save. If the hook bumps your number, bump again to the next — never overwrite.

### CLAUDE.md hard rules (don't violate)
- No deploy / git push during iteration. Local only via `python serve.py 8000`.
- Bump build number, update FILE_MAP.md `**Build:**` line, add CHANGELOG entry at top.
- One ask = one focused change. Don't bundle.
- "Yes" / "do it" = execute. Don't repeat the plan.

---

## 7. Tone

The user types fast and casual. *"fucking love it"*, *"do it"*, *"why wont u illuminate the distant figures"*, *"do whatver u think is best."* They get short with you when you produce corporate text without results.

When they say *"u doing it bit by bit"* they mean: don't trickle, hit a bunch of related fixes in one commit. When they say *"do whatever u think is best"* they mean: stop asking permission for routine choices.

The previous chat's last message ended with the user accepting the POI plan. Don't re-pitch the plan. Just execute Step 1 + Step 2 from Section 4 above, then stop and tell them where to navigate first.

---

## 8. Pointers to other docs

- [BASEMAP.md](BASEMAP.md) — full v2 design spec: panel coords, per-zone activity script, circulation. Source of truth for layout.
- [CLAUDE.md](CLAUDE.md) — workflow rules. Mandatory.
- [FILE_MAP.md](FILE_MAP.md) — every file's purpose, current build number.
- [CHANGELOG.md](CHANGELOG.md) — entries newest-first. Last 3-5 are most relevant for recent context.
- [STYLEGUIDE.md](STYLEGUIDE.md) — site-wide aesthetic (mostly relevant to /tracks /galaxy, not /scenes directly).
- [HANDOFF.md](HANDOFF.md) — older project handoff (b046 era — don't trust as current state).

---

## 9. If something's unclear

User has explicitly asked for cross-context memory in [BASEMAP.md](BASEMAP.md) and now this file. Anything not covered here, the most recent CHANGELOG.md entries cover. If a memory in `MEMORY.md` (auto-memory system) contradicts this file, this file wins for the `/scenes` redesign — it's newer.

If you're a fresh chat staring at this for the first time: open localhost (`python serve.py 8000` in repo root), navigate to `localhost:8000/scenes/`, see the current state, then start on POI nav (Section 4 Step 1). Don't redesign anything else first.
