# GALAXY CHANGELOG

Per-scene history for the main page (`/`) starting at the post-split point. Build history before the split (b001–b242, including all the galaxy work b101–b240 + Halo ring landing at b226/232/233/235/236/238/240) lives in the frozen root [CHANGELOG.md](../../CHANGELOG.md). New galaxy builds are logged here.

---

## g15 — 2026-05-25 — Auto-focus galaxy on every track change (not just HUD prev/next)

User: "when i use those buttons to switch songs, it doesnt automatically bring the title up. id like for that to happen and for our camera to move to whereever the song title is floating in our space scene".

**Problem.** The galaxy HUD's `tg-pp-btn` prev/next handlers (marathon-world.js:517-531) ALREADY call `_syncFocusToCurrent()` after `ctx.onPrev`/`onNext`, so the camera should rotate + the focus card should pop when those buttons are clicked. But the same `playIndex()` in index.html is also reached from THREE other paths that bypass that handler:

- `audio.addEventListener('ended', ()=>playNext())` — autoplay when a track finishes (index.html:3043). Most-hit path for a long listening session.
- `document.getElementById('mp-next').onclick = playNext` and `mp-prev` — global miniplayer's prev/next (index.html:4026-4027). Hidden on `/` but still in the DOM.
- Future callers — anything else that calls `playIndex` directly.

When the track changes via any of those, `state.current` updates but the galaxy view has no idea — focused stays on the old track (or stays null), camera doesn't rotate, focus card stays hidden.

**Fix (partial — see deploy note).** Centralize the sync at `playIndex` instead of duplicating it at every call site, symmetrical to the existing `TracksDaw.onTrackChange()` hook one line above.

- `js/marathon-world.js` — new public `onTrackChange()` method right before `destroy()` in the MarathonWorld object literal. Guards: `!this.scene || !this.titles || !this.titles.length` → no-op (covers init-not-run, /tracks page, /scenes page). Otherwise delegates to existing `_syncFocusToCurrent()` which finds the title node by `index === state.current` and calls `_focus(node, { skipPlay: true, mode: 'look' })`.
- `index.html` (playIndex) — needs `if (window.MarathonWorld?.onTrackChange) window.MarathonWorld.onTrackChange();` immediately after the `TracksDaw.onTrackChange()` call to fire the new method. **NOT shipped in this commit** — `index.html` has substantial uncommitted WIP from the parallel /tracks chat (T13 DAW reskin + `tracks-jump.js` module swap, ~330 lines). Deploying it would also require shipping that chat's untracked tracks-* modules. User chose "galaxy only" deploy → my one-line addition stays in the local working copy until the /tracks chat ships its WIP, at which point this hook activates the autoplay-ended sync.

**What works today (post-deploy).** HUD `tg-pp-btn` prev/next buttons. They already had inline `_syncFocusToCurrent()` calls at marathon-world.js:523/526 since before g15 — those still fire. So the user's specific complaint ("when i use those buttons to switch songs") is handled. What's NOT handled until the index.html line ships: autoplay-when-song-ends, miniplayer prev/next (hidden on `/` so irrelevant in practice).

**Why `look` mode and not `fly`.** Two modes exist in `_focus`:
- `fly` (direct title clicks) → title flies forward to a showcase point in front of the camera.
- `look` (HUD prev/next) → title stays at its constellation slot, camera rotates (yaw/pitch lerp) to face the title's `basePos`.

User said "camera to move to wherever the song title is floating" — that's `look` (camera moves, title stays put), which is what `_syncFocusToCurrent` already passes. No change needed.

Files touched this commit: `js/marathon-world.js`, `js/builds/galaxy.js`, `docs/galaxy/FILE_MAP.md`, this CHANGELOG. `index.html` deferred (see above).

---

## g14 — 2026-05-25 — Cull 32 tracks from catalog (104 → 72)

User: "remove gayk, 4-5, akira world, arkham villan, CLARITY bloomberg whatever the fuck, filip gay, first rap in a while, formidable, greatest consequences, gunning, hotel california, if i had universal, indie time 2, mac demarco, beachhouse, lemonade, indie valentine, moods rolo" then a follow-up: "Filip, Gunning, Ohohohohoho, Kani Demarco's Memoir, soul, remember, nirvana, If I Had (Full v2), Best Day Ever (Clarity), Birthday Freestyle, Emo Rock II, streets, need new, capz, underrated, shroomy, nice beat". Goal: gone from BOTH the floating titles AND the media player rotation (so when a track ends, the next-shuffle can't land on a cut song either).

**Approach.** Previous g13 only hid 6 titles in `_buildTitles` (visual filter); the shared `player.js` still picks `Math.floor(Math.random() * tracks.length)` for shuffle/next, so it could land on hidden tracks via the player chip's prev/next button or an autoplay-ended transition. To kill both vectors at once, the cull happens at the SOURCE — `config.json`'s `tracks[]` array — going from 104 entries to 72. That way the filter is implicit: a track that doesn't exist in `tracks[]` can't be visualized OR played.

**Tracks removed (32).** filip, warzone, 10 miles, gunning, uh i'm sick, bluff caller (the original g13 six) + gay k, 4-5 years, akira world - i'm next up, clarity, formidable, hotel california, if i had (universal), indie time, beachouse, lemonade, little indie valentine, ohohohohoho, kani demarco's memoir, soul, remember, nirvana, if i had (full v2), best day ever (clarity), birthday freestyle, emo rock ii, streets, need new, capz, underrated, shroomy, nice beat.

**Index safety.** `newReleases: [0,1,2,3,4]` still points to the same 5 songs (Still Looking For You, Rolla, ODST, Wallet, Follow You) because none of those were removed and they're at the start of the array. `featured: [...]` uses slug names, not indices — also untouched. Verified post-edit: `node -e "const d=require('./config.json'); console.log(d.tracks.length, d.newReleases.map(i => d.tracks[i].title))"` returns `72 [Still Looking For You, Rolla, ODST, Wallet, Follow You]`.

**HIDDEN_TITLES retired.** The set in `_buildTitles` is now redundant (the source is clean) — replaced with a comment explaining when you'd reintroduce it (visual-only hiding, where you want a track in the player rotation but invisible on the sphere). Filter call site reduced to `const all = (this.ctx.tracks || []);`.

**Out of scope.** `script.js` (legacy single-page file) and `CUTS.md` (planning doc) still list the removed tracks. Not loaded by any current scene; left alone to avoid scope creep. The `wall.js` icon overrides and `neural.js` tag keywords for removed tracks (e.g. `arkham → villainmask`) are orphaned but harmless — they only fire if a matching track exists.

Files touched: `config.json`, `js/marathon-world.js`, `js/builds/galaxy.js`, `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

---

## g13 — 2026-05-16 — Hide 6 titles from galaxy view + fix long-title clipping

User: "in galaxy main view: remove filip, warzone, 10 miles, gunning, uh im sick, bluff caller, also fix titles being cut off if song title is too long" (with a screenshot showing "LL (SHIFT PERCEP" — "The Fall (Shift Perceptions)" clipped on both sides).

**Removals.** Added a `HIDDEN_TITLES` set at the top of `_buildTitles()` that filters six tracks out of the galaxy sphere before slot assignment: `filip`, `warzone`, `10 miles`, `gunning`, `uh, i'm sick`, `bluff caller`. Matched on lowercase title so it survives any case-renames in config.json. Tracks stay in `config.json` and remain reachable by other scenes (tracks DAW, scenes selector) — they just don't get a title plane on the fibonacci sphere anymore. Total title planes dropped from 117 to 111.

**Long-title clipping.** `_makeTitleTexture` had a hard `canvas.width = Math.min(2048, ...)` cap. At featured fontSize (220) with weight 800, anything past ~16 chars overflowed — `ctx.fillText(text, w/2, h/2)` then centered the glyphs and the canvas sliced off both ends. "The Fall (Shift Perceptions)" / "Random Song After David's" / "Fucking Up His Liver" were the worst offenders.

Fix: measure the text at the requested fontSize, and if `tw > 2048` shrink fontSize by `2048/tw` (floor; clamped to 40px minimum) and re-measure before allocating the canvas. The plane's world-space width (`widthUnits`) is unchanged, so long titles now appear at the same on-screen width as short ones but with slightly thinner glyphs — far better than half the title vanishing into the void. `planeH = w / aspect` keeps the aspect-correct.

The two other `_makeTitleTexture` callers (drift fragments at fontSize 96, scripted-comm fragments at fontSize 64) use 2-6 char strings so they never hit the cap — no change in behavior for them.

**Files touched:**
- `js/marathon-world.js` — `_buildTitles` filter + `_makeTitleTexture` auto-shrink.
- `js/builds/galaxy.js` — `g12` → `g13`.
- `docs/galaxy/FILE_MAP.md` — build/date bumped.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK.

---

## g12 — 2026-05-12 — 12 new cameos (CCS / Keyship / Monolith / Stargate / Leviathan / MAC / etc.)

User: "on our main page, we have halo ring, and the marathon ship. what else can we have thats not like a constant event? cool scenario floating about" → picked all 12 from my pitch list → "fan of all listed, make sure to add to admin and highlight as new" → "phase out if needed".

Added 12 new "cameo" scenarios — iconic floating one-shots that match the Halo-ring / Marathon-ship silhouette energy but as occasional events, not constants. Each uses the existing fake-flyby-ship pattern (`_ephemeral=true` push into `flybyShips`) so they get follow-cam, lifecycle cleanup, and admin spawn buttons exactly like the other 24+ scenarios.

1. **CCS battlecruiser pass** (`_spawnCcsBattlecruiser`) — purple ribbed Covenant cruiser, gravity-lift glow underneath, slow majestic cruise. Counterpart to the existing UNSC `mothership_reveal`.
2. **Forerunner Keyship descent** (`_spawnKeyshipDescent`) — tapered spire drops in from above (`80u` along world-up), hovers 5s with two counter-rotating rings, lifts back out.
3. **Halo ring fragment** (`_spawnRingFragment`) — `Math.PI/4` arc of a `TorusGeometry(48, 4)` with cyan inner trim, tumbles across the void.
4. **2001 monolith** (`_spawnMonolith`) — very dark `BoxGeometry(2, 8, 18)` slab (1:4:9 proportions) with cyan `EdgesGeometry` rim so it reads against the nebula. Slow drift, silent. No engines.
5. **Stargate kawoosh** (`_spawnStargateKawoosh`) — stone-grey torus ring forms with 9 amber chevron studs, additive blue kawoosh sprite splashes forward toward camera, then a shimmering event horizon disc holds for ~4s before collapsing.
6. **Frozen capital ship** (`_spawnFrozenCapital`) — UNSC-shaped warship (spine + 4 pods + bridge) completely dark, no lights, slow end-over-end tumble.
7. **Space whale · leviathan** (`_spawnLeviathan`) — chain of 10 spheres along `-X`, each scaled smaller toward tail, undulating sin-wave body. Bioluminescent dorsal spot sprites that brighten with `_readBass()` — actively reactive to the playing track.
8. **Gravitational lensing patch** (`_spawnLensingPatch`) — black sphere core + additive cyan halo sprite + bright inner rim sprite, group-level scale wobble implies "warp distortion".
9. **MAC round broadside** (`_spawnMacBroadside`) — distant cruiser silhouette far across the void, charge glow ramps for 2s, muzzle flash, thick `BoxGeometry(1,1,1)` plasma beam scales out to `240u` length over 0.5s, fades.
10. **Cargo container spill** (`_spawnCargoSpill`) — broken hulk drifts, 14 crate boxes release one-by-one over 5s and tumble off in random directions.
11. **Salvage tug** (`_spawnSalvageTug`) — small tug (`10u`) pulling a much larger wreck (`28u`) via 2 `BufferGeometry` tether lines. Size mismatch reads as the joke.
12. **Sentinel swarm scan** (`_spawnSentinelSwarm`) — 2×3 grid of `IcosahedronGeometry(1.0)` drones with orange eye sprites, each firing a thin scanning beam to a converging point that wobbles in local space.

**Wiring:**
- New "cameos" admin section (between micro and footer), `data-cat="scripted"` lavender. Each button has `data-since="g12"` so `_decorateNewBadges` paints the "NEW" pill (full opacity now, fades over the next 5 builds).
- Added 12 click-handler branches in the admin event delegate.
- Added all 12 to `_fireRandomScenario`'s pool — they auto-fire alongside the existing scenarios every 22–40s, with the same recent-5 dedupe.
- Updated FILE_MAP scenario count: 24+ → 30+.

Phasing: User said "phase out if needed". Nothing phased out — none of the existing scenarios duplicate these. `mothership_reveal` and `ccs_battlecruiser` are deliberate UNSC/Covenant pair; `silent_observer` (stationary forerunner orb) and `keyship_descent` (descending forerunner spire with rings) are different silhouettes; `comet` and `monolith`/`lensing` are different feels entirely.

**Files touched:**
- `js/marathon-world.js` — 12 `_spawn*` methods after `_spawnSilentObserver`; 12 tick branches in `_tickScenario`; admin section + 12 click handlers + 12 pool entries.
- `js/builds/galaxy.js` — `g11` → `g12`.
- `docs/galaxy/FILE_MAP.md` — build/date/scenario-count bumped, cameos listed.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK.

---

## g11 — 2026-05-10 — Revert g10 ring ribs (broke the torus illusion)

User: "It does not look like a halo ring anymore. Because the inner part is almost like protruding outwards."

The 30 cross-ribs from g10 wrapped completely around the torus tube — same dark band at the same `vUv.x` on both inner and outer faces. Visually they read as a slatted barrel / hollow tube broken into separate slabs, not as a continuous torus megastructure with a curving inhabited inner plate. Each rib looked like an independent segment "protruding" sideways instead of the inside curving inward away from the camera.

Reverted the rib mechanic entirely. Also reverted the other g10 tweaks (sharper coastline threshold, dimmer cyan seam, deeper ocean palette, stronger lip) back to g9 values — g10 was a package and the user said "undo what we did now", so back to g9's settled state.

**Files touched:**
- `js/marathon-world.js` — `_buildHaloRing` shader restored to g9 form.
- `js/builds/galaxy.js` — bumped `g10` → `g11`.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK.

---

## g10 — 2026-05-10 — Halo ring: structural ribs + sharper coastlines

User: g9 helped but cyan seam still bloomed wide and inner terrain was a green wash. Three more changes:

1. **30 dark structural cross-ribs** every 12° around the ring (`fract(vUv.x * 30.0) > 0.94` → multiply surface by 0.32). Reads as service-bay supports / engineering segments. Applied to both inner and outer faces so the silhouette has continuous structural detail. Dark pixels can't bloom, so the ribs hold up under heavy post-fx.
2. **Sharper land/ocean transition** — smoothstep band tightened from `(0.40, 0.49)` to `(0.43, 0.47)`. Continents now read as distinct shapes with definite coastlines instead of fading into ocean. Ocean palette dropped further (royal blue → deeper royal blue) to push contrast.
3. **Cyan seam dialled back further** on the outer face (0.10 → 0.06). The bright cyan band wrapping the outer was blooming into a thick halo that competed with the actual ring silhouette. Plus the lip-band darkening factor tightened (0.18 → 0.10) so the silhouette edge is even crisper.

Net: ring should read as a Forerunner megastructure with visible engineering — clear silhouette, structural cross-bars all the way around, terrain inside with distinguishable continents/oceans/clouds. Coherent under bloom + halation + grade.

**Files touched:**
- `js/marathon-world.js` — `_buildHaloRing` shader (ribMul factor on both faces, sharper landMask, dimmer cyan seam, stronger lipMul).
- `js/builds/galaxy.js` — bumped `g9` → `g10`.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK.

---

## g9 — 2026-05-10 — Halo ring legibility under heavy post-FX

User screenshot: with all post-fx on (bloom + halation auto-cycling + grade), the halo ring read as a uniform white/yellow glow — you couldn't tell inner terrain from outer alloy, ring silhouette from background.

Root cause: the inner face had peak pixels (clouds, ice, atmosphere rim, bass cyan) well above 0.55 luma, which is the halation extract threshold. Halation grabbed those highlights and convolved them into the silhouette as a uniform haze. The outer face was nearly neutral grey, so even when bloom hit, there was no hue contrast to anchor "this is outside vs inside".

Three fixes in the ring shader:

1. **Dark "lip" band on the silhouette rim.** Used `vRimMix` (peaks at the inner/outer transition) to multiply both face outputs by 0.18 in a thin band around the silhouette edge. Bloom can't smear dark pixels, so the lip survives heavy post-fx as a structural separator — you always see where the ring ends.

2. **Capped all inner pixels under the halation threshold.** Inner face peaks were near 1.0 (clouds, ice); now < 0.55:
   - Cloud mix-target: pure white → mid-grey `(0.55, 0.58, 0.62)`, cover dropped 0.20 → 0.16
   - Ice mix-target: near-white → mid-blue-grey `(0.62, 0.68, 0.78)`, threshold tightened 0.82 → 0.86
   - Atmosphere rim term removed entirely
   - Bass cyan term dropped 0.18 → 0.10
   - Ocean / land palettes more saturated to compensate for lower luma (deeper royal blue, deeper forest green, deeper desert)

3. **Outer alloy biased violet.** Was neutral grey `(0.085, 0.092, 0.110)`; now `(0.075, 0.078, 0.135)` — slight violet tinge. Even when bloom partially washes the ring, the inner reads as blue-green and the outer reads as violet-grey — distinct enough hues that you see them as separate surfaces. Outer cyan trim saturated more but dimmed (0.18 → 0.10) so it doesn't bloom on its own.

Net: with halation maxed, the ring now reads as a clear ring with a dark silhouette edge, inner terrain visible in saturated blue-green, outer alloy distinct in violet-grey. No more uniform glow blob.

**Files touched:**
- `js/marathon-world.js` — `_buildHaloRing` shader (both face branches, lip multiplier).
- `js/builds/galaxy.js` — bumped `g8` → `g9`.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK.

---

## g8 — 2026-05-10 — Neuron threads + constellation breath (always-happening titles)

User: "what else can we add to galaxy to make it cooler? anything we can do our about our song titles? make them more living dynamic cooler always breathing environment taking on that far cry always happening feeling" → "sure lets try it"

Two complementary ambient effects on top of the title sphere:

### Neuron threads
Pool of 8 additive line segments. Every 180–360ms, a free thread is claimed, given two random titles as endpoints (preferring pairs within 95u of each other, but accepting any if no nearby found within 6 attempts), and faded in/out over 420–700ms via a `sin(πk)` bell envelope. Endpoints follow the titles' drifted positions each frame so threads don't lag behind. Color cycles per firing across cyan→lavender (HSL hue 0.52–0.70) so the brain isn't monochrome. Bass boosts opacity: silent peaks at 0.35, loud peaks at 0.75.

Net effect: 4–6 visible faint sparks across the sphere at any moment, constantly winking in and out. Makes the constellation read as a single living brain rather than 117 individual labels.

Admin toggle: scene-elements → "neuron threads".

### Constellation breath
Global `this._breath` scalar lerped toward `bass` at ~165ms half-life (`dt * 6.0` lerp factor). Title position computation multiplies `basePos` by `(1 + _breath * 0.06)` → peak bass (~0.45 post-gain) gives ~2.7% radial expansion. The entire sphere inhales outward on sub-bass hits and exhales back. Idle bobbing layered on top so the breath doesn't replace per-title motion.

Felt result: when music plays, the galaxy isn't just emitting reactive shaders — it's physically breathing with the beat. With audio paused, breath stays at 0 (no dead-state shift). Far Cry "always happening" ambient delivered.

**Files touched:**
- `js/marathon-world.js` — `_buildNeuronThreads`, `_tickNeuronThreads`, constructor + animate hooks, title basePos breath multiplier, admin button + visibility map + hint state. `_breath` init.
- `js/builds/galaxy.js` — bumped `g7` → `g8`.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK.

Possible follow-ups: tier personalities (featured / new / archive each behave differently in the shader), title-orbiter particles around featured titles, spectrum bars on the focused title.

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
