# GALAXY — file map

**Scope:** the main page at `/` (and its alias `/world`). Track titles drifting in a 3D void, with permanent landmarks (Marathon ship, Halo ringworld, distant core), audio-reactive shaders, and 30+ scripted scenarios spawnable via the `~` admin panel.

**Build:** g52
**Updated:** 2026-08-01

## Scope-owned files (this chat freely edits these)
- [js/marathon-world.js](../../js/marathon-world.js) — the entire WebGL galaxy scene. Mounts as `window.MarathonWorld = { init, destroy }` and is booted by `index.html`'s `bootMarathonWorld()`. Builds nebula skybox, starfield, distant core (Saturn-observatory), drift haze, fog patches, fibonacci-sphere title placement, fragments, streaks, satellites (shards removed g51), Halo ringworld landmark, Marathon ship landmark, Traveler overhead landmark, nav buoys, flyby ship pool (longsword/banshee/pelican/forerunner), bolt particles, post-FX stack (bloom + CA + scanlines + grain + vignette + halation + DoF + god-rays + lens dirt + anamorphic flares), HUD, admin panel, scripted scenarios. Locked-camera at origin, drag-look only.
- [js/builds/galaxy.js](../../js/builds/galaxy.js) — `window.BUILD_GALAXY` constant displayed in the galaxy HUD's build chip.
- [docs/galaxy/CHANGELOG.md](CHANGELOG.md) — galaxy build history (g1 onward).
- [docs/galaxy/FILE_MAP.md](FILE_MAP.md) — this file.

## Shared files used (do NOT edit casually — coordinate)
- `js/player.js` — audio engine. Galaxy reads `audio.__floorAnalyser` for bass-reactive shaders. **Visual changes go in marathon-world.js, NOT here.**
- `index.html` — page shell. `bootMarathonWorld()` lives here (lines ~3590-3616). Edit only if you're changing the boot wiring.
- `config.json` — track data. Galaxy reads `tracks[]` and the `featured` / `newReleases` curation lists.
- `style.css` — global stylesheet. Galaxy HUD CSS is inlined in `index.html` style block (search `mw-`).

## Always do these (every galaxy code change)
1. Bump `window.BUILD_GALAXY` in [js/builds/galaxy.js](../../js/builds/galaxy.js) (format `g###`).
2. Update the `**Build:**` and `**Updated:**` lines at the top of this file.
3. Add a CHANGELOG entry at the top of [docs/galaxy/CHANGELOG.md](CHANGELOG.md) — quote the user's request, explain what changed and why, list files touched.
4. Validate the JS module before shipping: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` — `node --check` on the original file silently passes raw-backtick template-literal errors that crash the browser.

## Architecture summary
- **g48 travel mode (default ON):** camera anchor `_camBase` glides through the field — click a title and the camera flies to a standoff point in front of its constellation slot (`_camGoal`, eased lerp `dt*1.6`), gaze autopilot steers en route (killed by any drag), and releasing focus parks you out there. The g21 idle float rides on top of the anchor. Admin `travel: ON/OFF` toggle restores the b109 cockpit lock (title flies to camera) and glides home; `reset camera` also glides the anchor back to origin. Titles never leave their slots in travel mode.
- Legacy (travel OFF): camera locked at origin (cockpit lock from b109). Drag-look = yaw/pitch only.
- Title sphere at radius 130 — 117 track titles distributed via fibonacci sphere across three tiers (featured / newer / archive).
- Permanent landmarks at distinct bearings around the 360° void (g/b238 360° spread):
  - Marathon ship — front-left at `(-340, 36, -120)`
  - Halo ringworld — directly behind the camera at `(60, 50, +1300)`, R=900 / r=48 ("whole world" scale, b240). Drag-look 180° to discover it.
  - Distant core (Saturn-observatory ring system) — far behind & deep at `(-200, -80, +1650)`.
  - The Traveler — high overhead at `(80, 760, -260)`, paneled white sphere R=130 (g2). Drag-look up to discover it.
- Camera far plane = 2400u (b240, bumped to fit the new ringworld extent).
- Flyby ships spawn from a pool: longsword (Halo dart), banshee (Covenant fighter), pelican (UNSC dropship), forerunner (geometric ringed orb).
- 30+ scripted scenarios in the admin panel (`~` overlay): combat, scripted (cinematic / fleet ops / action / debris / micro events), cameos (CCS / Keyship / Ring fragment / Monolith / Stargate / Frozen ship / Leviathan / Lensing / MAC / Cargo spill / Salvage tug / Sentinel swarm — g12), camera, scene element toggles, time controls, post-FX, capture.
- Audio analyser cached on `audio.__floorAnalyser` — reads bass band for shader pulse, full FFT for spectrum displays.
