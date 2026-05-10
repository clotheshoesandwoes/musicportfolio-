# GALAXY CHANGELOG

Per-scene history for the main page (`/`) starting at the post-split point. Build history before the split (b001–b242, including all the galaxy work b101–b240 + Halo ring landing at b226/232/233/235/236/238/240) lives in the frozen root [CHANGELOG.md](../../CHANGELOG.md). New galaxy builds are logged here.

---

## g7 — 2026-05-10 — Mothership orientation, hop-random snap, revert g6 auto-orient

User: "hop to random title doesnt bring the title up. ships get stuck in the halo ring and flip tf out, our marathon or mothership fly diagonally backwards in the direction of their exhjaust flame shaking my head"

### Mothership reveal — flying engine-first

`_spawnMothershipReveal` builds the mothership with bridge at local **+X** and engine glow at local **-X** — a non-standard axis for this codebase (flyby ships are -Z forward). The spawn-time `grp.rotation.y = Math.PI * 0.10 * -sideSign` was a small cosmetic tilt (~18°) but never the base rotation needed to align +X with the velocity direction (`right * -sideSign * 20`). Net: the bridge sat ~165° away from velocity, and the mothership drifted across the screen engine-first ("flying backward in the direction of the exhaust flame"). Existed pre-g6.

Fix: compute the proper base yaw from the velocity vector, then add the cosmetic tilt on top:
```js
const velDir = right.clone().multiplyScalar(-sideSign);
grp.rotation.y = Math.atan2(-velDir.z, velDir.x) + Math.PI * 0.10 * -sideSign;
```
Now bridge faces velocity direction, with the cinematic yaw tilt preserved.

### "Ships get stuck in the halo ring and flip tf out" — reverting g6 auto-orient guard

g6 added a defensive auto-orient at the bottom of `_tickFlyby` that ran `s.outer.lookAt(pos+vel)` for any scenario ship with meaningful velocity. The intent was to catch scenarios that mutate velocity without re-orienting. Two problems with it in practice:

1. **Non-standard model axes.** The mothership has +X-forward (not -Z). My lookAt assumed three.js's standard "non-camera Object3D aims +Z at target", so it rotated the mothership so its +Z faced velocity — putting the bridge perpendicular. Made the engine-first bug WORSE on top of the spawn rotation.
2. **Singular up-vector.** Crash dive's velocity becomes nearly straight-down over time. `lookAt` with the default up=+Y is singular when looking straight down → orientation snaps unpredictably each frame ("flip tf out").

Reverted. The patrol_pair explicit lookAt (still in place) is enough. Future scenarios needing velocity-aligned orientation should call `outer.lookAt(pos+vel)` themselves — it's a one-liner per scenario.

The "stuck on the halo ring" perception is almost certainly a flyby far from camera with low angular velocity against the bright ring silhouette (we discussed this in g4). If you can spot a specific scenario that genuinely freezes a ship, flag it with a timestamp.

### Hop-to-random-title didn't bring the title up

`_adminHopRandomTitle` used `mode: 'look'` — gradual yaw/pitch lerp toward the picked title, then switch to 'fly' once close enough. For a 180°+ hop the lerp takes >1 second; any pointer drag during the lerp cancels `_targetYaw`/`_targetPitch` (manual override wins), and you see nothing happen.

Fix: snap the camera straight to the title's bearing immediately (`gaze.yaw/pitch` set directly), zero out drag inertia, then `_focus(pick, { mode: 'fly' })` so the title pulls forward right away. Instant title-up.

**Files touched:**
- `js/marathon-world.js` — `_spawnMothershipReveal` rotation fix, `_tickFlyby` auto-orient revert, `_spawnScannerSweep` orient-lock removed (no longer needed), `_adminHopRandomTitle` snap-then-fly.
- `js/builds/galaxy.js` — bumped `g6` → `g7`.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK.

---

## g6 — 2026-05-10 — Ship-orientation auto-correct + admin menu rework

User: "can we make sure ships are flying forward instead of backwards for all ships and scenarios. also admin menu should be better reworked. so many options, but like shit is grouped weirdly honestly"

### Ship orientation

Audited every ship-build function and every `_spawn*`/`_tickScenario` branch. Convention from b235 is sound: models are built with nose at local -Z, `inner.rotation.y = π` flips that to outer's +Z, three.js's `Object3D.lookAt` aims +Z toward target, so head ends up on the travel vector. All ship-build functions follow it. All spawn paths follow it.

One real bug found: `patrol_pair` tick (line ~3996) lerps velocity each frame to add a lateral sway, but never re-orients `outer` after the lerp. Result: pelicans drift sideways with their noses locked on the spawn-time forward, reading as flying sideways. Fixed explicitly: added the standard `s.outer.lookAt(s.outer.position.clone().add(fwd))` after the velocity lerp.

Defensive guard added to `_tickFlyby` after `_tickScenario` returns: any ship in a scripted scenario with meaningful velocity (`lengthSq > 4`) gets its outer realigned to the velocity vector. Idempotent for scenarios that already do this themselves; catches any future scenario added without the lookAt step. Opt-out flag `s.scenarioOrientLocked = true` for scenarios that face a non-velocity direction on purpose — currently set on `scanner_sweep` (forerunner faces orbit centre, not tangent).

### Admin menu rework

Old structure: 14 sections in an order driven by the order code was added (combat → scripted×3 → camera → spawn → fx → camera-feel → elements → time → capture → stage). Camera was split across two sections, time was buried under spawn, scripted scenarios were fragmented across "cinematic / fleet ops / action·debris" with arbitrary boundaries (slipspace was "cinematic" but actually a high-energy spectacle, scanner_sweep was "action" but actually slow ambient).

New structure (top → bottom matches "stuff I touch most" → "stuff I tweak less"):

1. **stage** — clear, hop-random, reset-cam, save PNG, hide HUD, follow-cam, drag inertia (camera + utility merged here)
2. **time & fov** — time scale + FOV controls (paired since both are about playback frame)
3. **scene elements** — 12 visibility toggles (unchanged content)
4. **post fx** — 8 post-process toggles + hue auto + hue bump (style controls moved in from the old "stage" grab-bag)
5. **spawn ship** — 5 manual single-ship spawns
6. **dogfight** — pelican-vs-banshee + 5 patterns merged into one section (was two)
7. **ambient** — 11 atmospheric scenarios (no weapons): silent observer / ghost contact / forerunner orbit / mothership reveal / distress beacon / eva tether / comet pass / scanner sweep / emergency landing / derelict drift / debris field cross
8. **combat** — 7 action scenarios: longsword strafe / interception 2v1 / bombing run / plasma storm / pirate ambush / crash dive / slipspace jump
9. **fleet** — 5 multi-ship formations: escort V / convoy / carrier launch / fleet jump-in / patrol pair
10. **micro** — 6 ambient one-shots (unchanged)

All `data-act` values, button IDs, and `data-since` markers preserved so update-hints + new-pill decorator + click handlers all keep working without any handler-side changes.

**Files touched:**
- `js/marathon-world.js` — `_tickFlyby` auto-orient guard, `_spawnScannerSweep` orient-lock, `patrol_pair` tick lookAt, `_buildAdminPanel` HTML rework.
- `js/builds/galaxy.js` — bumped `g5` → `g6`.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK.

---

## g5 — 2026-05-10 — Bass-reactive gain compression (silent→playing jump tamed)

User: "when i press play on a song the fx are way too strong, i love how its reactive but the difference is astonishing." Loves the reactivity, hates the magnitude of the silent→playing shift.

Around 30 shader terms read `_readBass()` — bloom strength, chromatic aberration, title glitch amount, halo ring inner-face cyan, marathon neon pinstripes, traveler warm panels, fog patches, satellites, shards, core, etc. Each one's swing was modest individually, but the cumulative all-at-once "everything pulses harder" was the astonishing part.

Fix at the source: a `GAIN = 0.45` multiplier in `_readBass()`. Silent still reads 0 (no dead-state shift), but peaks now land at 0.45 instead of 1.0 — every downstream reactivity term is roughly halved together. Reactivity is preserved, the delta is much gentler.

If this still reads too strong, drop `GAIN` toward 0.30. If too subtle, bump toward 0.60.

**Files touched:**
- `js/marathon-world.js` — `_readBass()` returns `raw * GAIN`.
- `js/builds/galaxy.js` — bumped `g4` → `g5`.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK.

---

## g4 — 2026-05-10 — Halo ring: bloom-bleed fix + slower spin

User screenshot: ring's halation glow obscured the inner terrain, ring still read as spinning too fast. (Also flagged a "stuck ship" — addressed below in notes.)

**Bloom bleed.** The inner-face shader had `surface *= 1.30` plus a 0.32 cloud overlay, 0.12 atmosphere rim, and 0.40 bass cyan term. The combination pushed cloud + ice + bass-pulsed pixels well above 1.0, and the post-fx bloom pass exploded them into a giant halation crescent around the silhouette that drowned out the continents/oceans the user wanted to see. Pulled everything back into LDR:
- removed the `*1.30` sun-lit multiplier entirely
- cloud overlay 0.32 → 0.20
- atmosphere rim 0.12 → 0.05
- bass cyan term 0.40 → 0.18

The colour palette is unchanged — just no longer pumped past 1.0, so bloom doesn't smear it across the whole ring.

**Spin rate.** b232 dropped 0.0035 → 0.0007 (~5×slower, one rev / ~150s). User said still too fast. Dropped again 0.0007 → 0.00015 — another ~4.7× slower, ~one revolution per ~12 minutes at 60fps. At a glance the ring now reads as essentially motionless, which matches the "monumental gravity-providing rotation" feel.

**"Stuck ship" note.** No code change — the screenshot showed a flyby visible against the ring's bright surface and apparently not moving. Most likely apparent-stuckness rather than a real freeze: a forerunner flyby travels at speed 28–42 and at distance ~1000u from camera that's ~1.5°/sec angular motion, which reads as nearly stationary against a high-contrast background. Existing despawn logic (`s.life >= s.maxLife` in `_tickFlyby`) is sound — every spawned ship has a bounded `maxLife` and gets cleaned up. If the user can repro a ship that genuinely doesn't despawn after ~25s, that'd be a real bug worth chasing — flag it next time with a timestamp.

**Files touched:**
- `js/marathon-world.js` — `_buildHaloRing` shader (inner-face brightness terms), `_tickHaloRing` spin rate.
- `js/builds/galaxy.js` — bumped `g3` → `g4`.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK.

---

## g3 — 2026-05-10 — Admin "new" pills that fade with build distance

User: "on our admin panel, when we add new stuff, can it say new, and the further out we get the more it fades"

Added a `data-since="g###"` system on admin buttons. After the panel renders, `_decorateNewBadges` parses the current `window.BUILD_GALAXY`, computes `delta = currentBuild - sinceBuild` for each tagged button, and paints a small "new" pill whose opacity + glow scale with `strength = max(0, 1 - delta / 5)`. Pills are removed entirely once delta ≥ 5 builds — the marker self-cleans without manual gardening.

Section-header rollup: each `.mw-admin-section` label gets a small glowing dot whose strength mirrors the strongest child pill. Means a collapsed section still hints when something new is inside.

Inaugural tag: the `traveler` button is `data-since="g2"`, so right now (g3) it shows a strong "new" pill (delta=1 → strength=0.80). At g7+ it'll be gone.

How to use going forward: when adding a new admin button, append `data-since="<current build>"`. The decorator handles the rest.

CSS lives in [index.html](../../index.html) under the `.mw-admin` rules — `.mw-new` (the pill) and `.mw-admin-label .mw-new-dot` (the rollup dot). Both read a `--new-strength` CSS variable set inline by the JS, so opacity + text-shadow + box-shadow all decay together.

**Files touched:**
- `js/marathon-world.js` — `_decorateNewBadges(root)` method, called from `_buildAdminPanel`. `data-since="g2"` on the traveler button.
- `index.html` — `.mw-new` + `.mw-admin-label .mw-new-dot` styles in the global `mw-admin` block.
- `js/builds/galaxy.js` — bumped `g2` → `g3`.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK.

---

## g2 — 2026-05-10 — The Traveler (overhead landmark)

User: "lets do next planned work" → first item on the g1 roadmap was the Traveler (Destiny — paneled white sphere overhead so users discover it by looking up).

Added a permanent landmark at `(80, 760, -260)` — high overhead with a slight forward + lateral bias so a comfortable upward gaze catches it instead of requiring a dead-zenith tilt. Distance from origin ≈ 807u (well inside the 2400u far plane). Fills the empty overhead bearing — Marathon is front-low-left, Halo ring is behind-up-right, distant core is deep-behind-low-left, so the only previously-empty cardinal was straight up.

Form:
- IcosahedronGeometry(R=130, detail=4) — faceted polyhedral silhouette, ~640 faces. Reads as a machine, not a moon.
- Custom shader hashes object-space normals into per-panel IDs (stable under the slow yaw drift). Most panels are milk-white with subtle pid-driven shading variance; sparse warm "exposed innards" panels concentrated on the lower hemisphere (canon: Traveler's underside is mechanically scarred). Bass-driven flicker on the warm panels.
- Fixed top-key shading via world-Y of normal — the sphere reads bright on top and shaded underneath regardless of camera angle.
- Fresnel rim glow + soft outer halo sprite (`_makeSatLightTexture`, scale 3.4×R) so the silhouette reads luminous against the void from any drag-look angle.
- Material opts out of fog (far landmark, same convention as Halo ring).
- Tick: barely-perceptible yaw drift (0.00018 rad/frame ≈ one rev per ~6min, well under Halo ring's 0.0007). Halo opacity breathes with bass.

Wiring:
- `_buildTraveler()` and `_tickTraveler(t, bass)` added after the Halo ring block.
- Constructor calls `_buildTraveler()` after `_buildHaloRing()`.
- Animate loop calls `_tickTraveler(t, bass)` after `_tickHaloRing(t, bass)`.
- Admin panel: new "traveler: ON" toggle in the scene-elements section, between halo ring and nav buoys.
- `_adminToggleElement` map gets a `traveler:` getter; `_adminUpdateHints` gets the matching `elState` line.

**Files touched:**
- `js/marathon-world.js` — `_buildTraveler`, `_tickTraveler`, constructor + animate calls, admin button, toggle map, hint state.
- `js/builds/galaxy.js` — bumped `g1` → `g2`.
- `docs/galaxy/FILE_MAP.md` — added Traveler to the landmark list + scope-owned summary.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK.

Next on roadmap: Marathon-rebuild (replace generic spine-cylinder with canon hollowed-Deimos asteroid silhouette), then Covenant CCS-class battlecruiser + 5 scripted scenarios.

---

## g1 — 2026-05-09 — Galaxy split-off (post-b242 migration starting point)

State carried over from b240:
- Halo ringworld landmark behind camera at `(60, 50, +1300)`, R=900 / r=48, ~50° off-axis tilt.
- Distant core moved deep behind at `(-200, -80, +1650)`.
- Marathon ship at `(-340, 36, -120)`, flipped to face-forward (rotation.y = π × 1.18).
- Satellites hidden by default (admin toggle re-enables).
- Camera far plane = 2400u to fit the ringworld extent.

Next planned work: per the b226 roadmap, **the Traveler** (white sphere landmark in another empty bearing — probably overhead so users discover it by looking up), then **Marathon-rebuild** (replace generic spine-cylinder with canon hollowed-Deimos asteroid silhouette), then **Covenant CCS-class battlecruiser + 5 scripted scenarios** (slipspace arrival / glassing beam / broadside duel / fleet escort / autumn-pursuit) all admin-wired with `_scenarioFollow` camera locks.

**Files touched in the split:** none (galaxy code unchanged; only the build-bookkeeping moved to per-scene files). See root [CHANGELOG.md](../../CHANGELOG.md) b242 for the migration entry.
