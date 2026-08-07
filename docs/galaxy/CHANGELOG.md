# GALAXY CHANGELOG

Per-scene history for the main page (`/`) starting at the post-split point. Build history before the split (b001–b242, including all the galaxy work b101–b240 + Halo ring landing at b226/232/233/235/236/238/240) lives in the frozen root [CHANGELOG.md](../../CHANGELOG.md). New galaxy builds are logged here.

---

## g54 — 2026-08-02 — Mobile pass 2: stuck-hover ghost bug fixed + top HUD compacted for thumbs

User (screenshot of the phone experience): "this the mobile experience idk how can u make it better" — showing a stack of ghosted "CONVINCED" copies mid-screen and the top-left HUD eating ~25% of the viewport.

**1. The ghost stack diagnosed and fixed.** Reproduced live in an emulated 375×812 viewport with a canvas-pixel capture: the ghosting is the *hover* glitch (`gAmt = 0.18 + uHover×1.10`) running at full crank permanently. On touch there is no mousemove, so once a tap (or the g53 fat-finger snap) set `this.hovered`, nothing ever cleared it — the tapped title sat in maximum glitch displacement forever. `_onPointerUp` now clears `hovered` (+ the readout) once any tap/drag resolves on the mobile tier. Also restructured the tap branch (release no longer early-returns) so the clear covers every path, including drag-ends. Desktop mouse behavior unchanged — `_onMove` re-raycasts continuously there.

**2. Top HUD compacted + thumb-sized (index.html ≤760px block, CSS only).** Meta line (session · tracks · build) down to 10px at 70% opacity; player block pulled up (margin 14→8) and allowed full width minus the right column; transport buttons grown to ~44px touch targets (padding 10px 14px, gap 10); progress bar 3px → 6px so it's actually seekable by thumb; nav links up to 13px with more padding and gap. Net: shorter stack, bigger targets.

Files: `js/marathon-world.js` (`_onPointerUp`), `index.html` (g54 lines in the ≤760px galaxy CSS block), `js/builds/galaxy.js` (g53 → g54), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: node -c on .mjs copy → OK. Verified live at 375×812: synthetic tap 20px off "Convinced" → fat-finger snap → focused → `hovered` cleared at pointerup → `uHover` decayed to 0 within 40 ticks; canvas-pixel capture shows the title rendering as clean solid letters (the stuck-glitch ghost stack from the user's screenshot is gone). CSS: buttons 43px wide (10px/14px padding), progress 6px, nav 13px, meta 10px, full top-left stack down to 189px. Real-phone feel check still recommended. Localhost-only, no deploy.

---

## g53 — 2026-08-02 — Mobile tier: perf pipeline for phones + fat-finger tap assist + HUD de-clutter

User: "the mobile cantmute.me site is kinda shitty can we pls make it better".

Diagnosis: the galaxy had ZERO mobile branches — phones ran the identical desktop pipeline (full post-FX stack, all particle systems, DPR 1.6, desktop ship traffic) and precise-raycast-only tapping. "Shitty" = slideshow framerate + untappable titles, not the design.

**1. Mobile tier detection** (`this.mobileTier`): coarse pointer OR viewport < 820px, resolved once at init before the renderer/builders.

**2. Performance:**
- Pixel ratio cap 1.6 → **1.15** on mobile (≈2× fewer shaded pixels on a 3× phone screen).
- Post-FX: anamorphic flares, lens dirt, god-rays, halation OFF (uniform toggles zeroed in `_setupComposer`; `_autoHalo` already defaults false so the b172 auto-cycle can't re-enable halation). Color grade, scanlines, grain, vignette stay — cheap, they carry the look. Bloom stays (identity).
- Particle counts: foreground dust 500 → 220, text fragments 70 → 28, fog patches 18 → 10.
- Traffic: flyby cap 5/3 → 3/2 (focused/idle), scenario scheduler gaps ×1.7.

**3. Fat-finger tap assist** (`_raycast`): on a miss, mobile snaps to the nearest on-screen title within ~36px of the tap (projected screen-space distance). Thumbs can't hit a thin drifting plane; this alone makes browsing feel functional on a phone.

**4. HUD de-clutter (index.html galaxy CSS):** `.tg-sites` (three external site links) hidden ≤760px — socials + catalog/scenes nav stay; `.tg-hover` readout hidden on coarse pointers (hover never fires there).

Files: `js/marathon-world.js` (init detection + DPR, `_setupComposer` toggles, 3 particle counts, flyby cap, scenario gaps, `_raycast` assist), `index.html` (two CSS blocks), `js/builds/galaxy.js` (g52 → g53), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: node -c on .mjs copy → OK. Verified live in an emulated 375×812 touch viewport: mobileTier true, pixelRatio 1.15, flares/dirt/god-rays/halation uniforms all 0 (grade still on), dust 220 / fragments 28 / fog 10, `.tg-hover` + `.tg-sites` computed display:none, and a tap aimed 25px off a title snapped hover onto it ("Wait / Weight"). Desktop regression pass at 1280×720: mobileTier false, full counts (70/500), all FX on. Real-device feel (frame rate, tap comfort) still deserves a check on an actual phone. Localhost-only, no deploy (deploy of g47–g52 commit still parked pending GitHub collaborator invite acceptance).

---

## g52 — 2026-08-01 — Wisps removed + Marathon landmark identified as the real "christmas ship" and disciplined

User (screenshot circling a green rectangular patch and a vertical amber smudge, with the dotted ship in frame yet again): "bro these fucking space rectangles what are they are theyre still fucked."

**1. The circled rectangles = the g49 near-field wisps. Removed.** The ribbon planes' noise bands read as glowing rectangles, especially edge-on (fog patches are round radial sprites — they can't make corners, which is how the wisps were conclusively identified). `_buildAuroras(true)` + `_tickAuroras` disabled again. The aurora system's full arc: built g23, disabled g25 (competed with titles), revived near-only g49 (travel depth), killed g52 (space rectangles). If the travel band needs volume later it must come from round soft media (fog-patch sprites, dust), never rectangular sheets.

**2. The dotted red/blue ship was NEVER the mothership — it's the Marathon landmark**, permanent at (-340, 36, -120), which is why it sat in the same spot across all three of the user's screenshots (a 22s cameo can't do that; I dismissed the Marathon earlier after checking only its amber windows, not its pinstripes). The dotted look decoded:
- Pinstripes are 170u boxes only **0.18u thick** — deep sub-pixel at the ~250–400u the camera sees them from, so they rasterize as intermittent bright slivers: a DOTTED orange row + a DOTTED teal row (the "red over blue" rows). Fix: thickness → 0.55/0.50 (resolves as a continuous line).
- Neon intensities 1.6/1.4 peaked at ~2.2× color — every sliver bloomed and the CA pass fringed the rows. → orangeNeon 0.9, tealNeon 0.8.
- **96 individual window planes** (24 cols × 2 rows × 2 sides) each bloomed into a dot. → 2 long deck bands per side (140×0.45, same g51-mothership treatment), windowGlow intensity 1.0 → 0.55.
- The stacked orange chevrons at frame edge = the 3 thruster cones inheriting intensity 1.6; halation ghosted them into blocks. → cones rebuilt at intensity 1.0, halo cones 0.18 → 0.12 opacity.

(g51's mothership band fix stays — that cameo had the same disease; it just wasn't the ship in the screenshots.)

Files: `js/marathon-world.js` (aurora call-sites, `_buildMarathonShip` neon intensities + window bands + stripe thickness + thrusters), `js/builds/galaxy.js` (g51 → g52), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: node -c on .mjs copy → OK. Headless verification: `mw.auroras` undefined (wisps gone); Marathon carries 4 pinstripes at 0.55/0.50 thickness, 4 window bands (was 96 window planes), 3 thrusters at uIntensity 1.0, 20 neon mats still registered for the bass tick. On-screen look pass still needed. Localhost-only, no deploy.

---

## g51 — 2026-08-01 — Shards DELETED, mothership dot-rows → deck bands, focused flybys forced to the far side of the title

User (with screenshot circling the g50 crystal shards, the mothership light rows, and an engine at frame edge): "SHITTY RECTANGLES JUST SPIN LOOKS TERRIBLE".

**1. Shards removed entirely.** Third strike (g26 built them, g50 tried the crystal treatment, still terrible) — and the honest verdict is they never had a reason to exist: random floating polyhedra are decoration with no root in the music. `_buildShards`/`_tickShards` calls commented out (functions kept in source as the revert path, g25-auroras precedent), admin `shards:` toggle + its state line removed.

**2. Mothership window rows → deck bands.** The g50 dimming wasn't enough — 12 discrete strips per flank still read as christmas-light dot rows, and the CA pass still split them into red/blue dotted lines. Replaced with 4 long unbroken window bands per flank (13u each, gaps reading as bulkheads) at the same sub-bloom color.

**3. Focused flybys cross the FAR side of the title.** Root cause of the point-blank engine crossings: g49 thru-passes aim at the focused title, but travel mode (g48) parks the camera only ~`showcaseDist` (~14u) behind it — so a "2–8u past the title" pass could cross ~6u from the LENS. New rule in `_spawnFlyby`: when focused, the lateral offset sign is forced so the pass point sits on the opposite side of the title from the camera (`perp·(title−camera)` sign check). From where you stand the ship still visibly cuts across/behind the song — it just can never fly through your face again.

Files: `js/marathon-world.js` (init + animate shard call-sites, admin panel button + state line, `_spawnMothershipReveal` band loop, `_spawnFlyby` far-side sign), `js/builds/galaxy.js` (g50 → g51), `docs/galaxy/FILE_MAP.md` (build + scope line), this CHANGELOG.

Validation: node -c on .mjs copy → OK. Headless verification: `mw.shards` undefined after boot, admin panel renders without the shards button, mothership carries 8 window bands (4 per flank) instead of 24 strips, and 8 spawned focused flybys passed 2.3–25u from the focused title while never approaching the camera closer than 52.7u. Localhost-only, no deploy.

---

## g50 — 2026-08-01 — Model pass 1: shards become cut crystals (no more "rotating rectangles"), capital ships get visible hulls + disciplined lights

User (with screenshot of two flat lavender quads near a focused title): "no those things are just rotating rectangles now it looks really badly done".

**The rectangles = the g26 shards.** They were never flat planes — they're detail-0 solids (icosa/octa/tetra/cone/dodeca) with a fresnel shader — but detail-0 geometry has flat per-face normals, so fresnel evaluates to ONE color per face: a face-on octahedron rendered as a solid filled diamond. Harmless as distant glints from the origin lock; travel mode (g48) parks the camera IN the mid-tier shard band (50–130u), where they became screen-filling flat quads. Three fixes in `_buildShards`/`_tickShards`:

- **Per-facet brightness variance** — a hash of the (per-face-constant) normal scales each facet 0.78–1.28×, so adjacent faces differ and the solid reads as a cut crystal.
- **Crystal edge lines** — `EdgesGeometry` LineSegments child per shard, additive, hue-synced per-frame to the body shader's drifting hue (`setHSL` in tick), opacity rides the proximity fade.
- **Proximity fade** — new `uFade` uniform driven from tick: 0 at ≤8u from the camera → 1 at ≥18u. A shard can never fill the windshield again.

**The "christmas lights" ship identified: Mothership Reveal** (previous build's open question). `_spawnMothershipReveal` loops 12 additive window strips down BOTH hull flanks at `0x6c98ff` — bright enough that each dot bloomed individually, and the post-FX chromatic-aberration pass split the rows into the red-over-blue dotted lines in the user's screenshots. The hull (`0x1a1438` near-black `MeshBasicMaterial` boxes) is invisible against the void, so the ship rendered as light-rows floating on nothing, and the oversized engine glow sprite (14u) triggered blocky halation ghosts. Same construction school: CCS battlecruiser, frozen capital.

**Capital readability pass (all three):**
- Hulls lifted out of invisible-black: mothership `0x1a1438 → 0x2c2650`, CCS `0x2a0a48 → 0x3c1a63` + ribs `0x110422 → 0x201040`, frozen `0x12131a → 0x232532` + accent `0x1c1d28 → 0x2e3040`.
- Edge wireframes on spine + bridge (mothership `0x5a5f9e`, CCS neon `0x6a3acc`; frozen's existing wire brightened `0x223040 → 0x3a4a66`). Wires fade with the hull via a new generic `s._syncMats` hook called from `_tickFlyby` — zero surgery on the scenario tick branches.
- Window strips dimmed below the bloom threshold (`0x6c98ff → 0x4668a8`) — lit windows, not per-dot LEDs, and the CA pass has nothing hot to split.
- Glows shrunk so halation stops ghosting: mothership engine 14→10, CCS engine 16→12, CCS gravity lift 22×30→17×24.

Files: `js/marathon-world.js` (`_buildShards` + `_tickShards`, `_spawnMothershipReveal`, `_spawnCcsBattlecruiser`, `_spawnFrozenCapital`, `_tickFlyby` sync hook), `js/builds/galaxy.js` (g49 → g50), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: node -c on .mjs copy → OK. Headless verification (manually-ticked frames): 32 shards all carry `uFade` + edge-line children + hueOffset; a shard parked 2u from the camera fades to 0 (edges too) while a 120u shard holds fade 1; spawned mothership carries 2 wireframes whose opacity tracks hull fade at exactly 0.85× (0.306 vs 0.36 mid-reveal), window strips `#4668a8`, hull `#2c2650`. Facet-variance and edge look need an eyeball pass on screen. Localhost-only, no deploy.

---

## g49 — 2026-08-01 — Select-moment pass: keyship "bell" cut, guaranteed title buzzes, roaming focus aura, near-field wisps, Chakra Petch titles

User (four messages + two screenshots): "increase the chances of space ships flying by it … fly over or thru the title", "when a title is selected can we do something more or cooler", "the font for all our songs sucks", "idk how i feel aobut this ugly ass bell remove that tho", "i want the models to be improved and the background to not feel so flat skytbox like?" Also: "i love the new mobility transoport system moving from song to song tho beautiful" — travel mode stays.

**1. The "bell" identified + cut.** Screenshot 1's tan bell with the blazing orange ring = the g12 **Keyship Descent** cameo (`_spawnKeyshipDescent`): khaki truncated-cone hull (`CylinderGeometry(8,14,44)`, `0x8a7e5a`) + two additive gold tori (bloom turns them into the fat orange ring) + point-glow sprite (the small dot), parked 140u in front of the camera by the ambient scenario scheduler. Removed from the ambient rotation pool — exact g43-pelican treatment; the admin "forerunner keyship descent" button still works.

**2. Ships buzz the selected song — guaranteed and closer.** The g35 anchor logic already routed flybys 8–28u past a focused title; what was missing: (a) you could wait seconds for the timer, (b) passes never cut through the title. Now `_focus` pulls `_nextFlybyAt` in to +0.9–1.8s (a ship shows up as/just after you arrive), 40% of focused flybys shave the title at 2–8u ("over or thru"), and the concurrent-flyby cap while focused goes 4 → 5.

**3. Roaming focus aura (cooler select).** Featured titles have g27 auras; selecting any OTHER title got nothing. New `_buildFocusAura`: one reusable soft halo sprite + 16-particle orbital ring that snaps to whatever non-featured title is focused, fades in/out (never pops), halo scaled to title width ×2.1, orbit speed breathing with the smoothed bass. Ticked at the end of `_tickTitleAuras`.

**4. Near-field wisps (background depth).** Travel mode exposed the flatness: the nebula skybox sits at r=600 and nothing lived in the r=95–240 band the camera now flies through. Discovered mid-build: the whole g23 aurora system was **disabled since g25** (`_buildAuroras` + `_tickAuroras` commented out — the 5 big far ribbons competed with titles, and the disable comment said "re-enable later if a different approach calls for them"). This is that approach: `_buildAuroras(nearOnly)` re-enabled building ONLY 8 new dim wisp ribbons inside the travel shell (r=95–240, w 44–82, `near: true` flag; new per-ribbon `uAlpha` uniform 0.12–0.14 vs the far ribbons' 0.22). The 5 far ribbons stay off exactly as g25 decided. `_tickAuroras` re-enabled in animate. Every flight now slides cloud layers across the sky at visibly different rates.

**5. Chakra Petch titles (font).** Baked in-world titles: Space Grotesk 800 → **Chakra Petch 700** (squared techno display face — reads sci-fi HUD, strong big-size silhouettes for the glitch/hue/breath shader effects). `_makeTitleTexture` font strings centralized in a `FONT()` helper with Space Grotesk fallback; new `_rebakeTitles()` re-bakes all textures AND rebuilds each plane at the same world width with the new texture aspect (glyph metrics differ) once `document.fonts` lands the face — guarded by `document.fonts.check` so warm loads don't double-bake. Focus card `.tg-focus-title` switched to Chakra Petch 700 uppercase to match the in-world stars (buttons/meta stay lowercase Grotesk/Mono). Google Fonts link += `Chakra+Petch:wght@600;700`.

**Deferred — model overhaul (g50 candidate).** "these models need to be heavily improved" (screenshot 2: long capital hull with rainbow-dot running lights + blocky red engine glow). That ship wasn't conclusively identified (Marathon landmark's windows are uniform amber `0xffce80`, distress beacon is disciplined red/amber/white — the rainbow-dot builder is one of the ~30 cameo capitals). Every ambient spawn flashes its name in the HUD ("spawned: …") — catch the name next time it appears and the remodel can be surgical. A proper fleet-wide pass (light discipline, layered engine flames, hull paneling) deserves its own build with eyes on screen.

Files: `js/marathon-world.js` (scenario pool, `_spawnFlyby`, flyby cap, `_focus` buzz, `_buildFocusAura` + `_tickTitleAuras` tail, aurora SETUPS + `uAlpha`, `_makeTitleTexture` + `_rebakeTitles` + init font hook), `index.html` (Google Fonts link, `.tg-focus-title` CSS), `js/builds/galaxy.js` (g48 → g49), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: node -c on .mjs copy → OK. Headless-pane verification (manually-ticked frames): 8 wisps built, all inside r=260, uAlpha 0.12–0.14; focus aura fades in on a non-featured title (halo opacity 0.35 after 40 ticks, positioned exactly on the title mesh); Chakra Petch confirmed loaded + all 72 title textures baked non-zero; selecting a title pulled the next flyby to +1.29s; camGoal stayed finite. Visual taste pass (wisp brightness, aura size, font feel at scale) needs eyes on screen. Localhost-only, no deploy.

---

## g48 — 2026-08-01 — TRAVEL MODE: the camera flies to the song. The galaxy becomes a place you move through, not a poster you look at

User: "none ofr those change the world or explorability or make the portfolio any cooler i dont think" (after g47's feedback-honesty pass and a list of smaller ideas).

Correct critique — every prior galaxy build kept the b109 cockpit lock: camera bolted to the origin, drag-look only. Nothing can feel explorable when you can never move. g48 unbolts it.

**How it works:**

- New camera anchor `this._camBase` (Vector3). The g21/g26 idle float — previously computed around a hardcoded origin — now rides on top of the anchor, and the camera-relative look target shifts by the same offset so forward direction is unchanged.
- **Click a title → the camera glides through the field to it.** `_focus` in travel mode computes `_camGoal = basePos − dir · showcaseDist` (the existing viewport-fit standoff math, so the title arrives at the same screen size the old fly-in produced) and the title STAYS at its constellation slot — the world no longer rearranges itself around a static viewer; the viewer moves through the world. Anchor eases toward the goal at `dt*1.6` (exponential: fast leave, soft arrival, ~2s across the field). En route, every landmark parallaxes — the depth work from g21–g46 finally gets a moving eye to perform for.
- **Gaze autopilot**: while traveling, yaw/pitch steer continuously toward the focused title from the *moving* camera position (shortest-arc yaw wrap, `dt*2.2`). Any `pointerdown` hands the stick back instantly (same pattern as the scenario follow-cam kill) — the positional glide continues, you just look where you want. This deliberately avoids the g18 look-mode promotion trap: no promotion states, just continuous correction with a kill switch.
- **Release = you stay parked out there.** `_release` doesn't move the camera. Click the next title from wherever you are — hop star to star through the inside of the field. That IS the explorability.
- **Prev/next travel too**: `_syncFocusToCurrent` in travel mode routes through `_focus` (flight + autopilot) instead of the g18 gaze-snap.
- **Escape hatches**: admin `travel: ON/OFF` toggle (OFF restores the exact b109 cockpit-lock behavior and glides you home); `reset camera` now also glides the anchor back to origin.
- Music: unchanged wiring — the song starts at click, so it soundtracks the flight and is audibly going by the time you arrive.

Focused-title screen framing in travel mode comes from camera arrival, not the title flying forward — the title-loop `isFocus && focusMode === 'fly'` branch already skips travel, no change needed there.

Hint copy: "drag to look around · click a title to fly there & play it".

Files: `js/marathon-world.js` (init state, `_focus` travel branch, animate anchor-glide + gaze autopilot + camera offset, `_onPointerDown`, `_release`, `_syncFocusToCurrent`, `_adminResetCamera`, new `_adminToggleTravel`, admin button + dispatch, hint strings), `js/builds/galaxy.js` (g47 → g48), `docs/galaxy/FILE_MAP.md` (build + architecture summary), this CHANGELOG.

**NaN guard (found during verification):** a 0×0 canvas (hidden pane / mid-boot resize) makes `camera.aspect` NaN, which flowed through the FOV math into `showcaseDist`. In fly mode that quietly ate one title's position; in travel mode it poisoned `_camBase` → permanent black screen. `showcaseDist` now clamps to 18 via `isFinite` at the source (protects both modes).

Validation: node -c on .mjs copy → OK. Headless-pane verification via manually-ticked animate frames (rAF is frozen in a hidden pane; each tick followed by cancelAnimationFrame so no stacked loops), aspect patched to 16:9 to dodge the 0×0-canvas NaN: click set goal exactly `standoff` short of the title along the approach line ([52.1,11.5,−34.8] for title [63.5,14,−42.4], standoff 14); anchor glided origin → 2.2u from goal over ~170 ticks (goal-clear still pending in the exponential tail — expected); gaze yaw 0.97 vs ideal 0.98 (looking at the title); release parked the camera in place; toggle OFF glided home (62u → 13u in 80 ticks). Real-feel pass (motion comfort, arrival framing, speed) needs eyes on screen — tune `1.6` (glide) / `2.2` (gaze) to taste. Localhost-only, no deploy.

---

## g47 — 2026-08-01 — "Reads as a music player" pass: honest focus-card state + bio line + playing title pulses with the bass

User: "no way to tell its a music libarry also upon pressing any song title it doesnt automatically play the song, i need to still press the polay button" / "people should click my sogn and it plays and maybe we write lil bios".

**Diagnosis first.** Click-to-play was already wired (`_focus → ctx.onPlay → playIndex → audio.play()` all sync inside the gesture) and verified working on localhost. What was broken is the *feedback*: the focus card showed a static "play" button + a "— now playing —" kicker regardless of actual audio state. Click a title → seconds of buffering silence + a play button staring at you = "it didn't play, I have to press play." Worse, pressing that button fired `onPlay` again, resetting `audio.src` and restarting the network load on a track that was already coming.

**Four changes:**

1. **Focus card reflects the real audio state** (the complaint fix). `_updatePlayer` (runs every frame) now drives the kicker + action button from the audio element itself: `— loading —`/`loading…` while `!paused && readyState < 3`, `— now playing —`/`pause` once audible, `— paused —`/`play` when paused. One source of truth — no separate state flag.
2. **Card button toggles instead of restarting.** If the focused track is already current, the button calls `onTogglePlay` (pause/resume). `onPlay` + `_ensurePlay` only fire when focusing a different track.
3. **Bio line on the focus card.** New `#tg-focus-bio` div between meta and actions; shows `track.description` from config.json when non-empty, `display:none` when empty. CSS added next to the other `tg-focus` rules in index.html (galaxy HUD block): Space Grotesk 15px, #b9bfc9, max 52ch. All descriptions are currently empty — the mechanism ships first, content comes from the artist.
4. **The playing title visibly sings.** In the title loop, the current track's title (when audio is actually audible) gets `uBreath += 0.10 + bass * 0.35` — brightness pulses with the live bass band (analyser already sampled per frame) — and an opacity floor of 0.75 when nothing is focused, so the star you're hearing is the brightest thing in the sky. Zero shader changes; rides the existing b192 breath channel.

Plus the hint copy now says what the site is: "drag to look around · click a title to play it" (both the boot string and the `_release` restore string).

**Not a bug after all (documented for the record):** R2 production audio is healthy — 200 + `Access-Control-Allow-Origin: https://cantmute.me` on probe. An earlier "all 72 files 403" scare was Python's urllib user-agent getting bot-blocked by Cloudflare; curl with a browser UA passes. `audio-mp3/` remains git-ignored, so the b144 local fallback does nothing in production — R2 is the only prod source.

Files: `js/marathon-world.js` (focus card HTML + action handler, `_updatePlayer` state sync, `_focus` bio population, title-loop singing pulse, two hint strings), `index.html` (`.tg-focus-bio` CSS in the galaxy HUD block), `js/builds/galaxy.js` (g46 → g47), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: node -c on .mjs copy → OK. Localhost-verified in a live (headless-pane) browser: card shows "pause"/"— now playing —" while audible and "play"/"— paused —" when paused (via manual `_updatePlayer` ticks — rAF doesn't fire in a hidden pane), bio hidden when empty, new hint copy live, `_readBass()` returning 0.21 live so the singing pulse has real input. The visual pulse itself needs an on-screen session to eyeball. Note: the galaxy module is cached hard by Chromium (plain `<script src>`, the b221 problem) — hard-reload (Ctrl+Shift+R) to see g47. Localhost-only, no deploy.

---

## g46 — 2026-05-25 — Halo host moon: pushed further out + soft glow halo + improved rocky textures (mare patches, sharper craters, surface bumps)

User (with screenshot of the g45 moon working but bare): "a bit furthrer out and give it a tiny moon glow yknow and fix texturing a bit".

**Three changes:**

**1. Position pushed further.** `z=2350 → 2550` (200u further back). Required bumping camera far plane `2400 → 2700` since 2550 was just outside the old frustum. Moon now sits deeper behind the Halo ring, reads as the ring's distant primary rather than a foreground blob inside the loop.

**2. Soft glow halo.** New optional `glow` config in `makeBody` that adds an additive Sprite child to the body's Mesh. Uses the existing `_makeHaloTexture` (soft radial gradient) at cool blue-white `0xb8d0f0`, opacity 0.22, scale 2.2× radius. Reads as the subtle atmospheric scatter / regolith brightness halo real moons get. Sprite is a child of the mesh so it follows the body's position automatically.

**3. Improved rocky shader.** Three layers added to the shared rocky moon shader (benefits all three moons — Halo host + Moon 1 gray + Moon 2 ochre):

- *Low-frequency mare patches* — `fbm3d(vObj * fScale * 0.4)` thresholded with `smoothstep(0.45, 0.28)` gives large dark plains like Earth's moon mares. Mixes surface toward `colorC * 0.65` at 60% strength in those regions. Net: visible large-scale darker continents/plains instead of uniform gray.
- *Sharper crater rims* — rim contribution bumped `* 0.40 → * 0.60`. Crater shadow contrast `0.32 → 0.38`. Craters now read crisply against the surface instead of fuzzy.
- *Surface bumpiness* — medium-frequency `fbm3d(vObj * fScale * 6.0)` multiplies surface by `0.88 + bumps * 0.18`. Adds a second-scale rocky texture between the mare and crater scales — the moon no longer reads as smooth.

Net visual: moon is smaller and farther (~30% smaller on screen than g45), has visible mare-like dark continents + crisp crater rims + a tiny cool blue-white halo glow around its silhouette. Sells "real moon" rather than "gray sphere."

**Side benefits.** Moon 1 (gray) and Moon 2 (ochre) at their existing positions also get the improved texturing (mare patches, sharper craters, surface bumps) — they should now read as more detailed planetary bodies.

Files: `js/marathon-world.js` (camera far plane, rocky shader block in `_buildCelestials`, `makeBody` glow option, haloPlanet config), `js/builds/galaxy.js` (g45 → g46), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g45 — 2026-05-25 — Halo host: gas giant → rocky moon (smaller, dimmer, pushed back, no more bloom blowout through ring loop)

User (screenshot showing a giant bright white sphere sitting inside the Halo ring's loop): "moon interers with halo ring i dsont like push back furtrher and dim it a bit more moony textures".

Diagnosis: the g42 "Halo host gas giant" had `colorB: [0.88, 0.74, 0.50]` — max channel 0.88, **massively** above bloom threshold 0.30. Combined with the equatorial belt boost (`mix(surface, colorB, eq*0.30)`) and turbulence multiplier (up to 1.10×), peak surface brightness was ~1.26 → bloom turned the entire planet into a white blob. At 550u radius and z=2100, the bright sphere also sat inside the Halo ring's loop opening, crowding the ring's interior view.

**Four changes to the haloPlanet config in `_buildCelestials`:**

| | Before (g42 gas giant) | After (g45 rocky moon) |
|---|---|---|
| `type` | `1` (gas giant — bands, equator belt, storm spot) | `0` (rocky — cratered terrain) |
| `radius` | 550 | 360 (35% smaller) |
| `position` | `[60, 50, 2100]` | `[60, 50, 2350]` (pushed back 250u, stays within 2400 far plane) |
| `colorA` | `[0.66, 0.52, 0.36]` | `[0.22, 0.22, 0.20]` |
| `colorB` | `[0.88, 0.74, 0.50]` ← culprit | `[0.30, 0.28, 0.25]` (just at threshold) |
| `colorC` | `[0.40, 0.30, 0.22]` | `[0.09, 0.09, 0.08]` |
| spot | rust-orange storm | n/a (rocky doesn't use spotColor) |
| segs | 64 | 56 (smaller body, slightly less tessellation) |
| spinRate | 0.0008 | 0.0006 |

Net: peak surface channel ~0.30 (right at bloom threshold), so no more blow-out into white. The rocky shader (type 0) gives the cratered "moony textures" the user asked for instead of smooth gas-giant bands. At z=2350 with radius 360, the body still anchors behind the ring as its orbital primary but no longer crowds the loop interior — the ring's terrain band stays readable through the opening.

Free-floating Moon 1 (gray rocky at (-1200, 350, -1100)) and Moon 2 (ochre at (1100, 250, -1200)) are unchanged.

Files: `js/marathon-world.js` (haloPlanet config in `_buildCelestials`), `js/builds/galaxy.js` (g44 → g45), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g44 — 2026-05-25 — Stationary scenarios drift now: MAC broadside + Silent observer + Sentinel swarm bumped

User (with screenshots): "this with lignthing bolt or cancel uav should move too same with the sentry gun".

Three scripted scenarios were essentially stationary or near-stationary. Fixed all three:

**1. MAC broadside (`_spawnMacBroadside`).** Was `velocity: Vector3(0, 0, 0)` — the cruiser parked in space and fired its lightning-bright beam without moving. That's the "lightning bolt" the user was pointing at. Now drifts perpendicular to its aim direction at 7 u/s (broadside-maneuvering motion). Lifetime nudged 5.5s → 6.0s so the beam stays visible during the new traversal. `driftDir = aimDir × (0,1,0)` ensures the cruiser slides sideways while firing across the void.

**2. Silent observer (`_spawnSilentObserver`).** Was `f.velocity.set(0, 0, 0)` — the Forerunner orb parked and watched. That's the "sentry gun" candidate. Now drifts laterally at 4 u/s (random ±X) with a tiny vertical component (±0.75 u/s). Lifetime 10s → 11s. Reads as "sentinel patrolling slowly" rather than "frozen drone."

**3. Sentinel swarm (`_spawnSentinelSwarm`).** Was 13 u/s — technically moving but slow enough to read as crawling. Bumped to 18 u/s (~38% faster) so the formation visibly traverses the user's field of view during its 11s lifetime.

**Out-of-scope (deferred).** First complaint — "this ship still flies in the wrong direction" with a small screenshot — I couldn't conclusively identify which ship without a clearer view. The standard flyby fleet (longsword, banshee, forerunner) all have the inner.rotation.y = π flip + lookAt(velocity) pattern → they all face direction of travel correctly. Pelican is removed from random pool (g43). The wrong-direction culprit might be a scripted-cameo ship (CCS battlecruiser, Keyship, Carrier launch, Salvage tug, Frozen capital, Leviathan, etc.) built directly without the standard flip. If you can show me a larger screenshot or tell me what ship it was (longsword, banshee, etc.) I can fix the orientation in one targeted edit.

Files: `js/marathon-world.js` (3 scenario spawn methods — velocity values), `js/builds/galaxy.js` (g43 → g44), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g43 — 2026-05-25 — Pelican removed from random flyby pool ("remove this helicopter one")

User (with a small screenshot of a flyby ship): "r3emove this helicopter one".

The "helicopter" was the Pelican (UNSC dropship) — its top-mounted engine nacelles read as rotors at a quick glance, especially against the dark void. It was 20% of the random flyby pool weights.

Removed `pelican: 0.20` from the `_spawnFlyby` weights object. Reweighted the remaining 80% across the three other ship types proportionally:
- Longsword: 0.45 (unchanged — was already 45%, now 47% of remaining)
- Banshee: 0.18 → 0.28
- Forerunner: 0.17 → 0.27

Also removed the inline `if (chosen === 'pelican' && ...)` auto-trigger of `_spawnPelicanCombat` since `chosen` can never equal `'pelican'` anymore. Dead-code prune.

**What's kept.** `_makePelican()`, `_spawnPelicanCombat()`, and Pelican entries in the flyby pool are all untouched. Scripted cameos that explicitly invoke Pelicans (convoy, emergency-landing, pelican-combat via admin trigger) still work — this just removes ambient random helicopter-looking spawns. Admin still has manual `spawn-pelican` button.

Files: `js/marathon-world.js` (one block in `_spawnFlyby`), `js/builds/galaxy.js` (g42 → g43), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g42 — 2026-05-25 — Moons: Halo's host gas giant + 2 free-floating moons

User: "we have no moons no space moons no moon for halo ring idk can we have some that make sense position wise and all".

Three new celestial bodies built via a single `_buildCelestials` method with shared shader code (dispatched by `uType` uniform: 0 = rocky, 1 = gas giant). All three are real `SphereGeometry` Meshes with procedural surface shaders — actual 3D rotating bodies, not sprites or billboards.

**1. Halo host gas giant** at `(60, 50, 2100)` — same X/Y as the Halo ring's center, deeper Z so the ring reads as orbiting it (canonically Halos orbit gas giants like Threshold). Radius 550u. Warm tan/cream band palette (matches Halo's Threshold aesthetic). Surface shader:
- *Latitudinal bands* warped by 4-octave 3D fbm noise (`sin((lat + warp) * 16.0)`) for stormy flow
- *Brighter equatorial belt* (1 - smoothstep |lat|) so the planet has a defined equator
- *Turbulence* from another fbm sample modulating brightness 0.80 + turb*0.30
- *Great storm spot* — single bright cyclone at a fixed bearing (`vec3(0.55, -0.20, 0.81)`), thresholded with internal fbm swirl, rust-orange tinted (`(0.85, 0.32, 0.16)`)
- *Atmospheric rim* via fresnel, tinted with the base band color × 0.45
- Slow yaw spin (0.0008 rad/frame ≈ 1 revolution every 130s)

**2. Gray rocky moon** at `(-1200, 350, -1100)` — forward-left-up empty bearing. Radius 90u. Classic Earth-moon shading:
- *Terrain* via 4-octave fbm scaled to body radius (`fScale = 30 / radius`)
- *Three-tone mix*: dark mare shadow → gray base → dust highlight via smoothstep thresholds
- *Craters* — high-freq fbm (3× terrain freq) thresholded for circular dimples that darken surface 32%
- *Bright crater rim* — narrow smoothstep band right at the crater edge (49→55 dim, 55→60 light)
- *Cool blue-white rim* via fresnel — suggests cold sunlight from a distant star
- Slow tilt-axis spin (0.0010 rad/frame)

**3. Ochre/rust moon** at `(1100, 250, -1200)` — forward-right-up empty bearing. Radius 70u (smaller and farther). Mars-like palette (deep rust → bright ochre → dark canyon). Same rocky shader as Moon 1, just different colors. Slightly faster spin (0.0012).

**Bearing coverage now:**
- Marathon ship: front-left
- Halo ring: behind-center
- Traveler: overhead
- Distant core: far behind-left-low
- Pyramid: forward-right-down
- Binary stars: behind-left-up
- Black hole: behind-right-down
- Halo host planet: behind, with the ring
- Moon 1: forward-left-up
- Moon 2: forward-right-up

Every major bearing now has SOMETHING in it — no more empty quadrants when you drag-look.

**Shader cost.** Each body shader has one fbm3d call per pixel (4 octaves × ~8 hash3d lookups = 32 hashes). For the gas giant (550u radius, screen ~30° at distance 2100u) that's maybe 90k pixels × 32 = ~3M hashes per frame. For the moons (smaller, farther) it's negligible. Total well within budget on any modern GPU.

**Admin toggle.** Single `moons + halo planet: ON/OFF` button in scene elements section — toggles all three bodies together. Same pattern as existing landmarks; getter returns the 3 meshes as an array which the existing toggle handler processes via its `if (t.mesh) ... else if (t.grp) ... else t.visible` cascade.

Files: `js/marathon-world.js` (new `_buildCelestials` + `_tickCelestials`, init/animate wiring, admin button + getter + elState), `js/builds/galaxy.js` (g41 → g42), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g41 — 2026-05-25 — Tone down binary stars (no more bloom-blowout "gold thing") + focus-dim post-FX

User (with screenshots showing a giant gold trapezoidal glow blob filling 1/3 of the frame): "whats this random gold thing that showed up super ugly i dont like it doesnt fit stuff. when i have a song selected, maybe dim the background abit otherwise its impossible to even see thetitle lol".

The "gold thing" was Star B from the g40 binary pair — `MeshBasicMaterial` at color `(1.00, 0.35, 0.08)` (peak channel 1.00, all pixels above the g25 bloom threshold of 0.30). At distance 1183u with radius 14u, the actual sphere was a ~30px dot — but the bloom pass spread it into a hazy gold blob across ~200px on screen. Star A had the same problem in blue-white. Plus the separation radius (75u) was visible as the stars orbited.

**Fix 1 — Binary stars rebuilt at sane brightness/size.**
- Star A: radius `20 → 8`, color `(0.53, 0.78, 1.00) → (0.28, 0.36, 0.48)`. Peak channel 0.48 vs 1.00 — just enough above threshold to produce a soft halo without blowout.
- Star B: radius `14 → 5`, color `(1.00, 0.35, 0.08) → (0.42, 0.18, 0.07)`. Peak 0.42.
- Separation radius `75 → 38` so the pair reads as a tight binary rather than two distinct objects orbiting each other at distance.
- Bass color multiplier `0.35 → 0.15` so beat hits don't punch the colors way above threshold.
- Geometry tessellation reduced 32→24 / 16→20 segments since these are small (cheaper).

Net result: the binary now reads as two small soft-glowing stars at distance — the original intent. No more screen-filling gold haze.

**Fix 2 — Focus dim post-FX.** New `uFocusDim` uniform on the existing post-FX pass. Applied in the fragment shader between color grading and scanlines:

```glsl
if (uFocusDim > 0.005) {
  float distFromFocus = length((uv - uFocusUv) * vec2(uResolution.x / uResolution.y, 1.0));
  float focusMask = 1.0 - smoothstep(0.10, 0.55, distFromFocus);
  float dimAmt = uFocusDim * (1.0 - focusMask);
  col *= mix(1.0, 0.40, dimAmt);
}
```

`focusMask` is a smooth radial gradient: 1 within 10% UV radius of the focused title (basically the title's bounding box), falling off to 0 at 55% UV radius. Outside the focus zone, the final color is multiplied by `mix(1.0, 0.40, dimAmt)` = 40% brightness when fully dimmed. Title and its halo stay bright; surrounding scene quiets down so the eye locks onto the title.

**uFocusDim lerp in animate.** Targets `1.0` when `this.focused` is non-null, `0.0` otherwise. Lerp rate `dt * 4.0` = ~250ms half-life, so the dim fades in/out smoothly when you click a title or release focus. Also always updates `uFocusUv` (the focus center, independent of the DoF toggle) so the dim mask correctly tracks the focused title's screen position even if DoF is disabled.

Reuses the existing `uFocusUv` / `uFocusRadius` uniforms from the DoF system — no redundant projection math.

**What you should see now.** Click any title and the surrounding scene visibly darkens to 40% brightness across the frame outside a ~55% radius zone around the title. Title + its halo + its orbital particles stay at full brightness. Background landmarks (Halo ring, Pyramid, BH, stars) all dim. Release focus (ESC or click background) and the dim fades out over ~250ms.

The binary stars at the new brightness are small soft white-blue + warm-amber dots — actual stars, not gold trapezoids.

Files: `js/marathon-world.js` (`_buildBinaryStars` + `_tickBinaryStars` brightness/size, POST_FRAGMENT uFocusDim uniform + dim block, `_setupComposer` uFocusDim init, animate uFocusDim lerp + uFocusUv update), `js/builds/galaxy.js` (g40 → g41), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g40 — 2026-05-25 — Binary star pair + LIVE black hole with suction particles and ship-eating gravity

User: "Binary star pair sure. would be cool to have a lvie black hole smewhere and it ust sucks shit in mainly particles and stuff in the distance but sometimes youll see diff ships fly by or to oclose and they get sucekd in, doable?"

Both shipped. Two more permanent landmarks now anchoring previously empty bearings (behind-left-up and behind-right-down respectively).

---

### Binary star pair — `_buildBinaryStars` + `_tickBinaryStars`

Position `(-700, 500, 800)` — behind-left-up. Two `MeshBasicMaterial` spheres (bright enough that the bloom pass picks them up as natural emissive without explicit emissive shader):

- *Star A* — radius 20u, color `(0.53, 0.78, 1.00)` hot blue-white
- *Star B* — radius 14u, color `(1.00, 0.35, 0.08)` cooler orange-red

Orbital math is mass-weighted: Star A (larger ⇒ heavier) sits at 0.26 × separation from barycenter, Star B at 0.74 × separation. Separation = 75u. Period = 55s. Orbits are elliptical-flat (Z amplitude × 0.4) to give a more cinematic 3D feel rather than a flat circle. Bass pulses each star's color brightness × 0.35.

---

### Black hole — `_buildBlackHole` + `_tickBlackHole` + `_applyBlackHolePull`

Position `(800, -300, 1100)` — behind-right-down. Four visual components in one Group, plus active physics on flyby ships:

**1. Event horizon.** Pure black `SphereGeometry(32, 32, 16)` with `MeshBasicMaterial(color: 0x000000)`. Renders as an actual ABSENCE of light against the nebula — looks like a hole was cut in space.

**2. Lensing halo.** Slightly larger sphere (radius 38) with a custom fresnel shader — bright orange-red rim (`vec3(1.0, 0.65, 0.30) * fres^3`) only at silhouette angles. Bass-pulsed. Additive blend, depthWrite off, FrontSide. Reads as the gravitational lensing of background light around the event horizon's edge.

**3. Accretion disk.** `RingGeometry(40, 110, 96, 4)` rotated to lie flat. Custom shader:
- Hot yellow-orange `(1.0, 0.85, 0.45)` inner edge → deep red `(0.30, 0.06, 0.04)` outer edge
- Rotating angular noise streaks at frequency 90 (radial × 24) — material visibly swirls
- Bright streak boost (step 0.88 → `+(1.0, 0.70, 0.25) * 0.40`) for occasional hot accretion threads
- Bass pulse × 0.25, alpha fades at inner/outer edges so the disk doesn't have hard rims
- Additive blending. Slow per-frame rotation around the group's Z axis at `0.045 rad/sec`.

**4. Suction particles — the "actively sucking shit in" part.** 220 `Points` with the soft circular dot sprite. Each particle has its own `{angle, radius, tilt, fallRate, rotSpeed}`. Per frame:
- `angle += rotSpeed * dt` — orbits the BH
- `radius -= fallRate * dt * (1 + bass * 0.6)` — falls inward, faster on heavy bass
- When `radius < 34` (crosses event horizon): respawn at outer radius (160–240u) with fresh angle. So there's a constant stream of particles spiraling in and vanishing.

Particle positions are computed in local Group coordinates; `radius * 0.45` Z compression so the spiral matches the tilted disk orientation. Color `0xffb060` (warm amber), additive blend, sizeAttenuation true so closer particles render bigger.

**5. Gravitational pull on flyby ships — `_applyBlackHolePull(dt)`.** Each frame, scan `this.flybyShips`. For any active non-scenario flyby within 500u of the BH center:
- Distance `r` from ship to BH
- If `r < 38` (inside event horizon): set `ship.active = false`, hide `ship.outer` — ship vanishes into the BH, gets recycled by the flyby pool
- Else: add gravitational velocity component `dx/r * 1500/(r² + 200) * dt`. Strength rises sharply as r decreases — at r=200 acceleration ≈ 0.037 u/s², at r=80 ≈ 0.23, at r=40 ≈ 1.0. So distant ships barely feel it; close ones bend dramatically toward the BH.

Scripted-scenario ships (`ship.scenario` truthy) are excluded — don't want the BH yanking a CCS battlecruiser or monolith mid-cinematic.

**6. Flyby bias — 8% chance to spawn aimed at the BH.** Modified `_spawnFlyby`. When no title is focused, there's an 8% chance the flyby trajectory gets anchored to the BH's position (similar to the g35 focused-title anchoring but at the BH instead). Trajectory offset 60–140u perpendicular = ship passes within that distance of the BH, well inside the 500u influence zone. Gets sucked in within a few seconds. Without this bias the natural random flyby spread almost never enters the influence zone — you'd see suck-ins maybe once every 10 minutes. With it, expected ~1 visible suck-in every 60–120s.

**Admin toggles.** New buttons in the `scene elements` admin section: `binary stars: ON/OFF` and `black hole: ON/OFF`. Same pattern as the other landmark toggles. Disabling the black hole stops the gravity pull on flyby ships (the `if (!this.blackHole || ...)` guard in `_applyBlackHolePull` catches this).

---

**Total landmark inventory now (7 permanent):**
- Marathon ship (front-left, close)
- Halo ring (behind, large flat ribbon)
- Traveler (overhead-forward)
- Distant core (far behind-left-low)
- Pyramid (forward-right-down, Destiny Darkness)
- Binary stars (behind-left-up, blue-white + orange-red orbital pair)
- Black hole (behind-right-down, ACTIVE — sucks particles + occasionally ships)

Nav buoys + neuron threads still active. ~30 scripted scenarios still firing.

**Cost.** Binary stars: 2 sphere meshes (negligible). Black hole: 1 horizon sphere + 1 lensing sphere + 1 ring disk + 1 points object (220 vertices), 4 small materials. Gravity-pull loop: O(flyby count) ≈ O(7) per frame. All cheap.

Files: `js/marathon-world.js` (new `_buildBinaryStars`, `_tickBinaryStars`, `_buildBlackHole`, `_tickBlackHole`, `_applyBlackHolePull`; init + animate wiring; admin button HTML + getter map + elState bindings; flyby anchor bias in `_spawnFlyby`), `js/builds/galaxy.js` (g39 → g40), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g39 — 2026-05-25 — New permanent landmark: the Pyramid (Destiny Darkness monument) at forward-right-lower bearing

User (after g38 Halo ring landed well): "much better, now the space space feels empty, how tof ill it cuz we oly have that dead ship and the halo ring and some random sceanrios what other big monuments or pieces? anything cool from video game destiny? halo ring is also beautiful ty".

Permanent landmarks at this build were: Marathon ship (front-left), Halo ring (behind camera +Z), Traveler (overhead), distant core (far behind/below), nav buoys. Forward-right-lower bearing was completely empty — that's the void we're filling.

**Pyramid** — Destiny-inspired Darkness monument. Iconic obelisk silhouette, instantly recognizable, dramatic dark presence to anchor the otherwise-empty quadrant.

**Geometry.** `OctahedronGeometry(50, 0)` scaled to `(1.4, 2.6, 1.4)` — 140u wide × 260u tall × 140u deep. The 2.6× Y scale gives the iconic vertically-elongated diamond silhouette with sharp apexes top and bottom. Pure tetrahedron felt too literal-pyramid for this aesthetic; the stretched octahedron reads as "ominous monolith with pointed tips."

**Shader.** Custom fragment with three layers:
- *Body*: near-black obsidian `vec3(0.012, 0.006, 0.020)` with a faint violet undertone. Dark enough that the bulk of the silhouette stays subliminal — you read SHAPE before COLOR.
- *Fresnel rim*: hot red-orange `vec3(0.85, 0.20, 0.08)` at edges where view direction is grazing. `pow(fres, 1.6)` for a tight glow band only at the silhouette. Matches the Destiny Darkness palette — red against black.
- *Inner energy pulse*: deep blood-red `vec3(0.55, 0.05, 0.04)` concentrated near the vertical axis (`spineProx = 1 - smoothstep(0, 50, abs(vObj.y))` — peaks at the center, fades to apexes). Throbs with `0.5 + 0.5 * sin(uTime * 0.4 + vObj.y * 0.05)` AND bass (`0.6 + uBass * 0.8`) so the obsidian breathes with the music. Contribution capped at 0.18× so it's a subtle inner glow, not a flashlight.

**Position & motion.** Group at `(650, -250, -900)`. Distance from origin ≈ 1140u — within the 2400u far plane, far enough to read as huge but visible without dragging-look. Forward-right-lower bearing — visually anchors the previously-empty quadrant opposite the Halo ring. Slight Z-axis tilt (0.18 rad) for cinematic asymmetry. Slow yaw rotation at 0.0006 rad/frame (~1 revolution every 30s) so the monument is never static — combined with the slight Y-bob (`sin(t * 0.08) * 6u`), reads as "floating ominously."

**Admin integration.** New `pyramid: ON/OFF` toggle in the `scene elements` admin panel section. Hides/shows via `grp.visible`. Same pattern as Marathon ship, Halo ring, Traveler. Element state badge fires on init alongside the others.

**Why this filled the void best (vs. alternatives).** Considered also: Cabal Leviathan ornate sphere, Hive Dreadnaught spiky moon, Vex hyperdimensional gate cube formation, broken Forerunner station debris. The Pyramid wins on:
- *Recognizability* — instantly reads as "Destiny" for that audience
- *Geometric simplicity* — single primitive (octahedron) with shader, ~50 vertices, almost free
- *Aesthetic contrast* — DARK silhouette against bright nebula reads completely differently from the Halo ring (bright) or Traveler (white) or Marathon (industrial gray). Adds a NEW visual category.
- *Single focal piece* — fills the void cleanly without adding clutter

**Other Destiny / sci-fi monuments still on the menu** (for future builds):
- *Cabal Leviathan* — ornate golden baroque sphere, would go great in another empty bearing
- *Hive Dreadnaught* — spiky organic battleship the size of a small moon
- *Vex gate / hypercube formation* — multiple nested translucent cubes rotating at different speeds
- *Broken Forerunner station* — debris cluster of geometric chunks, gives the scene some wreckage/scale variety
- *Binary star pair* — two emissive spheres orbiting a common center, dramatic far landmark

Pick any and I'll add it as g40 or beyond.

Files: `js/marathon-world.js` (new `_buildPyramid` + `_tickPyramid`, init wiring, animate tick, admin panel toggle button, scene-element getter, elState binding), `js/builds/galaxy.js` (g38 → g39), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g38 — 2026-05-25 — Nebula spatial-hue regions + Halo ring rebuilt as FLAT RIBBON with crazy mechanical exterior

Two coordinated background upgrades. First user: "how can we make space look more spacey? feels like green nebula thing all over or sometimes othe colors but still". Then mid-edit a second message with reference images of the real Halo ring: "have rings ahve crazy exterior, also see kind of how the ring is, whereas ours is a lot rounder like a donut please adjust". Both shipped in g38.

---

### Part 1 — Nebula: regional hue variation + dust lanes

The "green all over" complaint was structural. Old hue formula:
```glsl
vec3 hueAxis = normalize(vec3(sin(uTime * 0.025), 0.30 * sin(uTime * 0.011), cos(uTime * 0.025)));
float hue = fract(uTime * 0.011 + dot(d, hueAxis)*0.5 + 0.5) * 0.22 + n1 * 0.08);
```

One rotating axis with ~22% spread = the whole sphere reads as one hue family at any time. Rewrote:

```glsl
float hueRegion = fbm(d * 0.85 + vec3(uTime * 0.012, 0.0, uTime * 0.008));
float hueDetail = fbm(d * 3.20 + vec3(0.0, uTime * 0.006, 0.0));
float hue = fract(uTime * 0.006 + hueRegion * 0.85 + hueDetail * 0.22);
```

Now hue is driven by a low-frequency 3D noise field of the view direction. Different REGIONS of the sphere get their own dominant hue — magenta in one quadrant, cyan in another, amber elsewhere, all visible simultaneously. Slow time drift keeps the field alive without losing variety.

Also added dust lanes (`smoothstep(0.48, 0.32, fbm(d * 4.5))` → darken to 35% in narrow noise-driven bands). Real nebulae have visible dust filaments obscuring background light — these reading as "real space" rather than "uniform haze." Plus darker void color between features (0.022→0.014) and bumped wisp contrast (mix 0.65→0.70).

---

### Part 2 — Halo ring: flat ribbon geometry + crazy mechanical exterior

User attached two reference images: a close-up of the real Halo ring's outer surface (covered in industrial paneling, blue glow features, mechanical detail) and a 3/4-view of the ring showing its FLAT RIBBON profile — clearly NOT a torus tube. Our ring was an octagonal `TorusGeometry(R=900, r=48, radialSegs=8, tubularSegs=600)` — still a donut, just polygonal. Two large structural changes:

**1. Geometry rewrite — flat rectangular cross-section.** Replaced `TorusGeometry` with custom `BufferGeometry`. Cross-section is now `2 * HALF_AX = 76u` wide (axial direction, the inhabited band width) by `2 * HALF_RA = 18u` thick (radial direction, structural depth). 4.2:1 aspect ratio — clearly flat, not donut-y.

8 vertices per slice (each spatial corner duplicated, once per adjacent face) so each of the 4 faces has its own UV range without seams between them:
- Face 0 (TOP, axial+): thin structural rim seen from above
- Face 1 (INNER, radial-inward): inhabited band — the wide habitable surface
- Face 2 (BOTTOM, axial-): thin structural rim seen from below
- Face 3 (OUTER, radial-outward): the CRAZY mechanical exterior

Per-vertex `aFace` attribute (float 0/1/2/3) passed to vertex shader as varying `vFace`. Fragment dispatches on `int(floor(vFace + 0.5))`. Total ~4808 vertices (similar to old torus 4800).

**2. Crazy exterior on FACE 3** — multi-scale industrial detail:
- *Hex panel grid base* — 70 panels around × 4 vertical bands. Each cell has its own pseudo-random brightness (0.55–1.0 range).
- *Periodic structural modules* — bigger recesses every ~24° (15 around), darkening to 55% in recess areas via 1.5-octave fbm.
- *Cyan glowing ring features* — the iconic Halo "blue glow" structures from the reference image. Scattered circular hotspots (24×3 grid, 22% chance per cell). Each renders as a bright annulus + brighter core, contributing `vec3(0.22, 0.58, 0.95)`.
- *Amber accent point lights* — scattered surface lights, ~15% of cells in an 80×6 grid, render as small bright dots.
- *Vent lines* — thin cyan rectangles in the middle band of the face, every ~7.2°.
- *Rib seams* — 20 hull-section seams every 18° (carried from g33).
- *Edge axial fade* — slight darkening near the face's top/bottom corners.

**3. Faces 0/2 (axial top/bottom)** — moderate structural shading. Less detail than face 3 (these are thin rims seen edge-on), but with seam lines + periodic bright connector ports + the same rib seams.

**4. Face 1 (inhabited inner)** — KEEPS the existing terrain shader from g29 (4-octave continents, 4 biomes, coastlines, city lights, clouds, polar haze). With the flat geometry the band is exactly 76u wide × 5654u long (circumference at R=900). vUv.y across this face now goes 0→1 from one structural edge to the other, so the terrain math (`lat = (vUv.y - 0.5) * 2.0`) works unchanged. Forerunner trim now applies at vUv.y near 0 and 1 (the structural edges of the inhabited band) instead of the old vRimMix silhouette band. Atmospheric equator glow peaks at vUv.y=0.5 (center of the inhabited band).

**What you should see.** Halo ring from the side now reads as a clearly FLAT ribbon — thin profile, wide inhabited band. The outer face is densely mechanical with visible hexagonal paneling, scattered blue glowing ring features (matching the reference photo's structural highlights), amber surface lights, and the structural rib seams every 18°. The inhabited inner band keeps its terrain look but is now framed by visible structural walls at its edges.

**Old varyings retired.** `vInnerFace`, `vRimMix`, `facetShade`, `lipMul` are gone — they were artifacts of the round-torus normal-based face determination. Replaced cleanly by `vFace` attribute. Octagonal cross-section logic (`g29` facet shading) also retired since the cross-section is no longer octagonal.

---

Files: `js/marathon-world.js` (nebula shader hue+dust pass, full `_buildHaloRing` geometry rewrite + fragment shader rewrite with per-face dispatch), `js/builds/galaxy.js` (g37 → g38), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g37 — 2026-05-25 — kani.studio link points to seankani.com/studio (no longer dead)

User: "well update kani.studio to actually link to seankani.com/studio until i buy the other official url".

`href` changed from `https://kani.studio` (dead, marked `is-dead`) to `https://seankani.com/studio` (active subpage). Removed `class="is-dead"` and `title="coming soon"` — link now behaves identically to seankani.com and gridon.life. The g34 CSS `is-dead` selector still exists in `index.html` (it's harmless — no element matches it anymore) in case we need to re-introduce a dead-state link later.

Display text still reads `kani.studio` since that's the intended future destination — only the underlying URL is the redirect.

Files: `js/marathon-world.js` (one line in HUD template), `js/builds/galaxy.js` (g36 → g37), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g36 — 2026-05-25 — Particle jitter / lag fixes: integrated orbital angle + half-speed dust + bounce-not-teleport at boundaries

User (with screenshot showing the tiny colored particles around the scene): "our ytiny little particles are jittering and lagging pls fix or address whatevre the fuck is going on with them the little purple and blue onewss and scuh".

**Three distinct bugs found:**

**1. Title aura orbital particles teleporting on bass spikes.** The orbital position math was:

```js
const orbitBoost = 1.0 + (isFocus ? 0.45 : 0) + bass * 0.20;
const ang = p.angle + t * p.speed * orbitBoost;
```

This multiplies absolute time `t` (which grows continuously — by minute 1 it's 60+) by `orbitBoost`. The orbitBoost reads RAW bass from the analyser, which fluctuates several percent frame-to-frame as the audio energy varies. A 0.05 change in orbitBoost combined with `t * speed = 30` produces a 1.5-radian POSITION TELEPORT for that particle on that frame. Visible as jitter / sudden snap, especially on bassy tracks.

Fix: integrated angle. Instead of `p.angle + t * p.speed * orbitBoost`, just `p.angle += dt * p.speed * orbitBoost`. The angle accumulates over time at the current velocity; if orbitBoost changes, only the per-frame VELOCITY changes — no absolute-position jump. Plus switched the boost to read smoothed `this._breath` (already lerp-smoothed bass with ~165ms half-life) instead of raw analyser output, so even the velocity changes are gradual.

Required signature change: `_tickTitleAuras(t, bass)` → `_tickTitleAuras(t, dt, bass)`. Updated call site in animate.

**2. Foreground dust drift velocities 2× too aggressive.** g31 bumped dust velocities 5× (`±0.45` → `±2.4`) to "sell motion" after the g25 strip-back left the scene feeling empty. Worked for the motion goal but at those speeds particles cross the shell boundary every couple seconds, AND the random-direction fast motion read as jittery rather than ambient drift. Halved: `±1.2 / ±0.8 / ±1.2` (still 2.5× the pre-g31 baseline so the motion remains visible, just not chaotic).

**3. Boundary "pops" from teleport.** When a dust particle crossed `r > 45` or `r < 4`, it was teleported to a fresh random position. With g31's fast velocities, dozens of particles teleported per second — each teleport is a visible jump. Replaced with BOUNCE behavior: when out of shell, scale position back to the shell edge and flip velocity sign. Particles now visibly oscillate within the shell with smooth continuous motion. No pops.

**What didn't change.** All g27 / g31 / g33 / g34 / g35 work intact. Camera float at ±1.2u, atmospheric perspective on titles, scheduler frequencies, Halo ring structural ribs, top-right color cycle — all still active. This is purely a fix to motion-update math + dust velocity tuning.

Files: `js/marathon-world.js` (`_tickTitleAuras` signature + orbital math + smoothed-bass usage, animate call site, `_buildForegroundDust` velocity constants, `_tickForegroundDust` bounce-not-teleport at boundary), `js/builds/galaxy.js` (g35 → g36), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g35 — 2026-05-25 — Focus-aware schedulers: cranked flyby/scenario/micro frequency + flyby trajectories aimed near focused title

User (with screenshot of "rock (full)" focused mid-screen): "when we have song title up, we should have our sscripts occur much more frequently the ones like flies across title or over./under title etc etc".

Two coordinated changes — all three schedulers go faster when `this.focused` is non-null, AND flybys actually aim NEAR the focused title's world position instead of random sky directions.

**Scheduler frequencies (focused vs. not):**

| Scheduler | Unfocused gap | Focused gap | Effect |
|---|---|---|---|
| Flyby (`_tickFlyby`) | 2.0–5.0s, cap 3 concurrent | 1.0–2.5s, cap 4 concurrent | ~2× more ships, +1 concurrent |
| Scenarios (`_tickScenarioScheduler`) | 10–18s | 4–9s | ~2× more scripted events |
| Micro fx (`_tickMicroScheduler`) | 5–12s | 2–6s | ~2× more comm scraps / meteors / drones |

Combined average rate when focused: a flyby every ~1.75s, a micro every ~4s, a scenario every ~6.5s — there's almost always something happening near the focused title at any given moment. Unfocused gaps unchanged (g27 baseline).

**Flyby aiming — the key visual change.** Previously `_spawnFlyby` constructed the flyby trajectory as `baseStart = -dir * spawnRadius + perp * offset(50–140u)` — that's a path starting somewhere in deep space relative to the origin, moving along `dir`, with a perpendicular offset of 50-140u from the origin axis. When the focused title is at e.g. (-30, 5, 80), most random flybys would NOT pass near it.

Now, when `this.focused` is non-null, the spawn position gets shifted by the focused title's world position:
```js
baseStart = -dir * spawnRadius + perp * offset(8–28u)   // tight offset
if (focusedT) baseStart += focusedT                      // shift by title pos
```

Tight `offset(8–28u)` means the trajectory passes within that perpendicular distance of the focused title. The `+= focusedT` shift translates the whole trajectory so it's anchored on the title, not the origin. Net result: every flyby launches with a clear pass over / under / past the focused track within ~10–25u — visible in the user's field of view since they're looking AT the title.

Random `offsetSign` (±1) so ships come from both sides instead of always one side. Random `offset` magnitude so passes vary from near-graze (~8u, very close to the title) to mid-distance (~28u, clearly passing past).

Ship types unchanged — same weighted random pick (longsword/banshee/pelican/forerunner) with the same patrol/combat scenarios fire. The pelican-combat scenario (which already aims at the focused title's position when one is focused) keeps working.

**Compatibility.** All existing focus-aware behavior in scripted scenarios preserved (`this.focused ? this.focused.mesh.position : ...` pattern in many spawn methods). Camera lock, title fly-in lerp, halos, particle orbits all unchanged. The change is purely scheduler + flyby trajectory anchoring.

**What you should see.** Click a title and start playback. The frame near the title should now have constant motion — longswords streaking past, pelicans crossing, scripted cameos (ring fragments, monoliths, sentinels) firing every few seconds, comm fragments + drone darts micro-popping. Drag-look at the title and ships visibly pass behind/in front of it.

**Levers if too busy (overstimulating):** focused flyby gap back to 1.5–3s, focused offset back to 15–35u (less tight), focused scenario gap back to 6–11s. One number each.

Files: `js/marathon-world.js` (`_tickFlyby` cap + gap, `_tickScenarioScheduler` gap, `_tickMicroScheduler` gap, `_spawnFlyby` trajectory anchoring), `js/builds/galaxy.js` (g34 → g35), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g34 — 2026-05-25 — HUD top-right column: animated color wave + cantmute.me shimmer + white-flash scatter

User (screenshot of the top-right column with cantmute.me / instagram / seankani.com / gridon.life / kani.studio stacked): "slightly color gradient fade across these, top one being most prominent color but light fade or moving but have some white scattered in there".

Pure CSS pass — no JS or geometry. Adds three coordinated animations to the top-right column:

**1. `tg-mark-shimmer` on `cantmute.me`.** 7s ease-in-out cycle, stays white but text-shadow blooms from `none` to a cyan glow (`rgba(102,221,255,0.45)` + outer halo at 0.18) at 50% and back. Keeps the brand mark as the DOMINANT element (always white, never joins the hue rotation) while still feeling alive. Matches the existing cyan accent (`--accent-cyan` from STYLEGUIDE.md = `#66ddff`).

**2. `tg-link-cycle` on the link items.** 16s linear loop cycling through 4 stops: cyan `#66ddff` → magenta `#ff7ec3` → amber `#ffd28a` → mint `#aef0c8` → back to cyan. Applied to:
- `.tg-socials a` (instagram)
- `.tg-sites a:not(.is-dead)` (seankani.com, gridon.life)
- `.tg-sites a.is-dead` (kani.studio) at slower 22s and 35% opacity so it still belongs to the column visually

Each row gets a unique `animation-delay` (`0s / -3s / -6s / -9s`) so the column reads as a WAVE flowing down rather than every link changing color in lockstep. With 16s period and -3s delta per row, adjacent links are ~67° (1/4 cycle * -3/16 hue shift) apart in the palette — close enough to feel like a gradient at any frozen frame, distinct enough to read as motion.

**3. `tg-link-flash` for the "white scattered" bit.** 13s ease-in-out cycle. Most of the cycle the filter is `brightness(1.0)` (no change). Briefly between 91%-93% (~260ms) the filter punches to `brightness(2.3) saturate(0.2)` with `color:#fff` — washes the link near-white for a beat. Each row uses a DIFFERENT flash delay (`0s / -4s / -8s / -11s`) so the white pops scatter through the column instead of all flashing together. Cycle period (13s) is intentionally coprime with the color cycle (16s) so they never sync — keeps the visual fresh.

**Hover behavior.** `animation-play-state: paused` on hover, plus `opacity:1` and existing `color:#fff !important` border. Hovered link freezes at whatever color it was mid-cycle AND goes fully opaque + adds the white underline. Removes the animation jitter while pointing, then resumes when pointer leaves.

**Hover override for cycling color.** Since the animation continuously overrides `color`, the existing `:hover { color:#fff }` needs `!important` to win. Same for opacity (animation sets to .78, hover bumps to 1).

**Base opacity 0.78** on cycling links so the colors read as TINT rather than full-saturation — keeps the column subordinate to the brand mark while still showing color motion.

Net visual: top-down at any frozen frame reads as a soft gradient (cantmute.me white → instagram cyan → seankani magenta → gridon amber → kani.studio dim purple, or whatever the cycle phases hit). The gradient ROTATES through the palette every 16s. Every ~3s a different link briefly punches white. Hovering any link freezes it bright.

Files: `index.html` (`.tg-mark`, `.tg-socials a`, `.tg-sites a`, `.tg-sites a.is-dead` CSS + 3 new `@keyframes` blocks), `js/builds/galaxy.js` (g33 → g34), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

No JS changes; no validation needed beyond browser refresh. Localhost-only.

---

## g33 — 2026-05-25 — Halo ring "modelled" pass: structural panel ribs + Forerunner trim + atmospheric equator glow

User (with screenshot of the post-g31 ring still reading as a glowing yellow-green donut): "halo rings could be better modelled".

g29 already gave it polygonal (octagonal cross-section) and g31 fixed the bloom leak. What was still missing: the ring lacked structural detail that says "built" rather than "grown." Three additions, all shader-side (no new geometry):

**1. Structural rib seams every 18°.** 20 panel boundaries equally spaced around the ring's circumference (`fract(vUv.x * 20.0)` near 0 or 1). At each rib: surface darkens 45% AND a faint cyan rim glow emits (`vec3(0.08, 0.28, 0.55) * ribLine * 0.55`). Applied to BOTH inner inhabited surface AND outer Forerunner alloy face — reads as massive inter-panel hull joints subdividing the ring into 20 enormous hull sections. At megastructure scale (R=900, circumference ~5654u), each panel is ~283u wide — clearly visible from the camera's ~1300u distance.

**2. Forerunner architectural trim.** Bright cyan-blue band sitting just inside the silhouette (vRimMix range 0.55–0.92, peak at ~0.65). Reads as the structural containment wall between the inhabited inner band and the outer hull — exactly where real Halo art shows bright blue Forerunner architectural detailing. Brightness capped at `* 0.22` so the peak max-channel value is ~0.21, BELOW the g25 bloom threshold of 0.30 → no leak past the silhouette. This is the single feature that says "built" most directly.

**3. Atmospheric equator glow.** Soft cool-blue (`vec3(0.12, 0.22, 0.38) * equatorBand * 0.28`) at the most-inward-facing surface — only fires on the inner face, peaks at vRimMix near 0 (most-inward facet center). Reads as the atmospheric scatter you'd see along the ring's inhabited surface from this viewing angle. Subtle but it sells "this thing has an atmosphere."

**Applied symmetrically.** All three terms computed once in the shader's preamble (using existing varyings `vUv`, `vInnerFace`, `vRimMix`), then applied to both the outer-face branch and the inner-face branch:
- Outer face: ribDim * surface, then + ribGlow, + forerunnerTrim
- Inner face: ribDim * surface, then + ribGlow, + forerunnerTrim, + atmoGlow

City lights, coastlines, biome variety, octagonal cross-section, per-facet brightness shading, panel-line facet seams — all from g29 carry forward unchanged.

**Bloom-leak budget check.** All three new bright contributions cap at < 0.30 max channel: ribGlow peak ~0.30 × 0.55 = 0.30 (right at threshold but only at narrow line), forerunnerTrim peak 0.95 × 0.22 = 0.21, atmoGlow peak 0.38 × 0.28 = 0.11. The widest dim band from g31 (`smoothstep(0.55, 0.96, vRimMix)`) still catches most of these near the silhouette so they don't smear outside the geometry.

Files: `js/marathon-world.js` (`_buildHaloRing` shader — preamble for 3 new structural terms + their application in both face branches), `js/builds/galaxy.js` (g32 → g33), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g32 — 2026-05-25 — Cross-site links under HUD top-right (seankani.com, gridon.life, kani.studio)

User (with screenshot of the top-right HUD showing `cantmute.me` + `instagram`): "under these we can add links to seankani.com, gridon.life, kani.studio (dead for now)".

Added a new `tg-sites` block in the HUD top-right, right under the existing socials. Three links stacked vertically:
- `seankani.com` — live
- `gridon.life` — live
- `kani.studio` — marked `is-dead` (still href'd so it works the moment the site goes live, but styled fainter with `cursor: default` to signal "not active yet"; tooltip says "coming soon")

CSS additions in `index.html`:
- `.tg-sites` — flex column, gap 4px, right-aligned, margin-top 8px under socials
- `.tg-sites a` — same font/size as `.tg-socials a` but slightly fainter (`#7e848e` vs `#9aa0aa`) so the secondary tier is visually subordinate to socials AND to the `cantmute.me` mark
- `.tg-sites a.is-dead` — even fainter (`#52565d`) + `cursor: default` + hover doesn't change border/color, just slight color bump

Single template + CSS change. No build behavior changes elsewhere.

Files: `js/marathon-world.js` (HUD template — 4 lines added to `_buildHud`), `index.html` (`.tg-sites` + `.tg-sites a` + `.tg-sites a.is-dead` CSS block), `js/builds/galaxy.js` (g31 → g32), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g31 — 2026-05-25 — Soft circular dust + 5× drift speed + Halo ring bloom-leak fix

User (with screenshots showing chunky square dust particles and the Halo ring leaking green/blue haze past its polygonal silhouette): "so much still feels 2D. its cool when ships fly by but the particles feel too big for space and the enviroment? the ring edges sides are leaking (green blue vs the ring itself)".

**Three concrete fixes:**

**1. Foreground dust: soft circular sprite + smaller size + faster drift.** `PointsMaterial` with no `map` renders as solid square fragments — at the closest near-distance positions (r=6, where dust streams past the camera), those squares were chunky and read as "Minecraft particles." Now:
- New `_makeDotTexture()` helper: 64px canvas with a 4-stop radial gradient (1.0 → 0.55 → 0.10 → 0.00) generating a soft circular alpha disk. Used as `map` on the PointsMaterial so points render as soft round dots.
- Size: 0.18 → 0.12 (1.5× smaller).
- Drift velocities: `±0.45 / ±0.30 / ±0.45` → `±2.4 / ±1.6 / ±2.4` (~5× faster). Dust now visibly STREAMS past the camera in seconds instead of bobbing slowly. The "I'm moving through real space" cue finally fires hard.
- Count: 600 → 500 (slight reduction since each is now softer and visible at wider radius via gradient falloff).
- `alphaTest: 0.02` so the edges of the gradient cleanly fade instead of leaving box outlines.

Same `_makeDotTexture` applied to the orbital particles around featured titles (also `PointsMaterial`) so they're soft dots instead of squares.

**2. Halo ring bloom leak: dim band widened + city lights cut.** Screenshot showed yellow/green haze extending past the polygonal silhouette — that's bloom screen-space-smearing the inner face's bright pixels outside the geometry. Two targeted reductions:
- City lights contribution `0.42` → `0.22`. The amber dots were ~0.42 brightness, well above bloom threshold (0.30), and were the #1 leakage source. At 0.22 they're still visible but no longer blow out.
- Silhouette dim band widened: `lip = smoothstep(0.74, 0.96, vRimMix)` → `smoothstep(0.55, 0.96, ...)`. The "lip" multiplier now applies over a wider rim band — more pixels near the silhouette are dimmed before bloom sees them. Also dropped the dim floor `0.18` → `0.14` (slightly darker at the silhouette).

**3. Particle drift speed serves "still 2D" complaint.** With dust now streaming visibly past the camera, motion-induced parallax against the title shells is unmissable. The float-only parallax was too subtle in a static screenshot; active dust streams sell depth in real-time as you sit on the page.

Coexists with all prior structural work (depth tiers, camera float at 1.2u, title halos + orbital particles, atmospheric perspective, busy schedulers, Halo octagonal cross-section).

Files: `js/marathon-world.js` (new `_makeDotTexture`, `_buildForegroundDust` updates, `_buildTitleAuras` PointsMaterial update, `_buildHaloRing` shader lip band + city light intensity), `js/builds/galaxy.js` (g30 → g31), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g30 — 2026-05-25 — Default FOV 80 → 92

User: "i think default fov should be like 90 or 95". Picked the middle. PerspectiveCamera initial FOV bumped 80 → 92. Wider field of view = more of the scene visible at any drag bearing + slightly more dramatic perspective on close foreground (shards, dust). The `showcaseDist` computation in `_focus` already reads `camera.fov` per call so click-to-fly auto-adjusts (slightly larger showcase distance since the title can be a bit further forward and still fill the same on-screen size at FOV=92).

Single-constant change.

Files: `js/marathon-world.js` (PerspectiveCamera FOV arg), `js/builds/galaxy.js` (g29 → g30), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g29 — 2026-05-25 — Halo ring: octagonal cross-section + per-facet panel seams + higher-quality inner surface (city lights, coastlines, 4 biomes)

User (with screenshot of the ring's curving silhouette): "halo ring exterior feels too round? halo rings are usually more like... idk have sharper faces? even if its a ring? would be cool if their texture (inside ring) was higher quality too".

**Geometry.** `TorusGeometry` `RADIAL_SEGS` was 22 — smooth enough that the cross-section read as a perfect circle even from the camera's 1300+ unit distance. Dropped to 8: octagonal cross-section, clearly polygonal silhouette, proper Halo-cover megastructure read. `TUBULAR_SEGS` kept at 600 so the ring itself stays smooth around the world circumference; the cross-section is what's faceted.

**Outer face shader additions.** Two new things alongside the existing seam/ridge/rim:
- *Facet shade.* Quantize `vUv.y` to face index 0..7 and use a per-face pseudo-random multiplier (`0.85 + 0.15 * fract(idx * 0.371)`) so each of the 8 facets has a slightly different ambient brightness. Sells flat-faceted shading even though the underlying shader still uses smooth normals.
- *Panel-line seams between facets.* Smoothstep around the quantized `vUv.y` boundaries (`abs(fract(vUv.y * 8.0) - 0.5) - 0.46`) gives a thin bright band exactly where adjacent facets meet. Tinted Forerunner-cyan. Reads as architectural panel lines / structural beams between hull plates.

**Inner face shader rewrite.** Was 2-octave continents → ocean/forest/desert/ice + simple clouds. Now:
- 4-octave continents (added 24× and 48× frequency octaves) for richer fine detail
- 4 biomes instead of 2: forest → savanna → desert → mountain ranged by continent height
- Tropical cyan bias on ocean near the equator
- Coastline shimmer — bright thin band exactly at land/ocean boundary (smoothstep distance-from-0.5 raised to power 9)
- **City lights** — punctate bright orange-amber dots scattered through mid-altitude land regions. Single most legible new feature at viewing distance — reads as "this ring is INHABITED" with visible civilization. Filtered to land + mid-elevation + non-ice so they cluster on plains/coasts like real night-Earth satellite imagery.
- 2-octave clouds (added high-frequency 40× octave) for more structural variation
- Polar atmospheric haze — softens the ice band into a misty rim instead of a hard white edge
- Same facet-shade multiplier as outer face so all visible inner facets read as distinct flat surfaces

**Cost.** RADIAL_SEGS drop alone reduces vertex count 64% (22*600 → 8*600). Shader is more complex (more fbm calls, more biome mixes) but only runs on visible ring pixels — net perf about the same or slightly better given the geometry savings.

**Post-FX pitch (separate, your call).** The current stack is already extensive: bloom, chromatic aberration, scanlines, grain, vignette, halation, depth-of-field, god-rays, lens dirt, anamorphic flares (per admin panel). Honest options to add:

- *Transmission glitch / horizontal tear* — periodic block-shift across the screen + horizontal tear lines, like a degraded signal. Fits the "broadcast" theme that the music portfolio is.
- *CRT distortion + rolling scan bands* — slight barrel curvature + horizontal noise bands rolling vertically, makes the whole frame feel like an old transmission display. Extends the existing scanlines into a full CRT look.
- *Edge-detection outlines* — thin glowing outlines on titles + ships + landmarks. Pure cyberpunk read.
- *Motion blur on moving objects* — sells ship motion dramatically, especially with the now-busier flyby cadence from g27.
- *Datamoshing* — frame-blending where moving content smears. Glitchy art-film vibe.

Pick one (or two if cohesive) and I'll ship. I'd lean transmission glitch + CRT scan bands together since they extend the existing scanline/grain language and reinforce the "broadcast" theme. But your call.

Files: `js/marathon-world.js` (`_buildHaloRing` — RADIAL_SEGS const + outer face facet shading + inner face shader rewrite), `js/builds/galaxy.js` (g28 → g29), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g28 — 2026-05-25 — Title fly-in lerp 11 → 6 (still too fast at 11)

User: "when im just moving camera and i click into a song, it flies onto center screen way too fucking fast. at pls reduce it a bit so its not ridicuously fast".

g22 dropped fly-in from `dt*18` → `dt*11` per the same complaint. User still feels it's slamming. Dropped further to `dt*6` — `~280ms` half-life, title lands in ~560ms (vs ~300ms at 11, ~165ms at 18). Now reads as a deliberate arc rather than a punch at the camera.

Return lerp held at `dt*8` (previously-focused title clearing out faster than new one flies in — so the old hero exits the foreground BEFORE the new one settles, no overlap mid-air).

One-line change. Everything else from g27 (title halos, orbital particles, foreground dust, busier scheduler) carries forward unchanged.

Files: `js/marathon-world.js` (one lerp constant + comment), `js/builds/galaxy.js` (g27 → g28), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g27 — 2026-05-25 — Title presence (halos + orbital particles on featured) + active world (more flybys + scenarios + foreground dust)

User (after g26's depth pass still landed "still boring and minimal"): picked options 2 + 3 from the pitch — **Title presence** (each featured title becomes its own focal moment) + **Active world** (crank ambient activity hard).

g23-g26 had been tuning the *void* around the titles. The real problem was the FEATURED tracks (the 4 hero pieces of the catalog) were treated identically to archive — just bigger versions of the same flat plane. And the void itself was too quiet between scripted events. This build fixes both at once.

**1. Title auras — featured tracks get individual presence.** New `_buildTitleAuras` / `_tickTitleAuras` methods. For each of the 4 featured tracks:

*Halo glow.* A soft additive sprite behind the title, tinted with the title's per-track HSL color from `colorForTrack`, scale = 2× title width. Procedural radial-gradient texture (`_makeHaloTexture` — generated once, shared across all halos). Opacity baseline 0.18 + bass-react × 0.14. On HOVER opacity multiplies to 1.6×, on FOCUS to 2.1×, and the halo SWELLS to 1.12× / 1.30× scale. Renders before titles (`renderOrder = -2`) so it sits behind the title glyphs.

*Orbital particle ring.* 28 additive points per featured title tracing a tilted helical orbit at radius ~title-width. Each particle has its own `{angle, radius, tilt, speed, drift}` — speeds vary 0.35–0.75 rad/s, tilts ±0.35 rad, slight drift in angle per frame so orbits aren't locked. Same per-track tint color. Size 0.55 with sizeAttenuation. On focus the orbit speed boosts 1.45×; on bass impact +0.20. Per-frame `BufferAttribute.needsUpdate = true` recomputes positions from the parametric orbit (cheap — 28 points × 4 titles = 112 vertices).

Halo and particles both follow `title.mesh.position` per frame — when a title flies forward into showcase on click, its halo + orbital ring fly with it, so the hero piece arrives complete instead of leaving its aura behind on the sphere shell.

Net effect: 4 featured titles become visibly DIFFERENT — they're not just bigger archive titles, they're individually framed. When you hover one, it lights up. When you click, it pulls forward AS A LIT ENTITY with its orbit and glow intact.

**2. Foreground dust — sells "I'm in real 3D space".** New `_buildForegroundDust` / `_tickForegroundDust`. 600 small additive Points distributed in a near spherical shell (r=6–40), each with a tiny random drift velocity. Per-frame integration moves each particle by `v * dt`; when one drifts outside the shell (r²>45² or r²<4²) it respawns at a fresh near position. Material: size 0.18 with sizeAttenuation, color #d8e0f0 (cool white), opacity 0.55, additive blending. Combined with the g26 ±1.2u camera float, near dust parallaxes DRAMATICALLY — atan(1.2/8) ≈ 8.5° per axis at the closest particles. This is the single most visceral "real 3D" cue in the build; the brain reads constant near-camera motion as definitive proof of being in volume, not painting on a flat backdrop.

**3. Active world — scheduler intervals slashed.**

*Flyby ships:* gap was 3–7s with max 2 concurrent. Now 2–5s with max 3 concurrent (`activeFlybys < 2` → `< 3`). Roughly 2× more ships on screen at any moment — sky finally feels populated.

*Scripted scenarios:* gap was 22–40s. Now 10–18s. About 2.5× more frequent — instead of one cinematic event every half-minute, you get one every ~14s. Combined with the 30+ scenario variety pool and recent-5 dedupe, this means a constant churn of varied scripted moments (capital ship pass, monolith drift, ringworld fragment, MAC broadside, fleet jump-in, etc.) instead of long quiet stretches.

*Micro-fx scheduler unchanged* (already fires every 5–12s — fine cadence). Combined cadence is now: a micro every ~8s on average, a flyby every ~3.5s, a scenario every ~14s. There should always be something visibly happening in the user's view.

**Coexistence with prior builds.** g26's atmospheric perspective on titles still applies — featured halos sit at r=90 (close, no fade), archive titles still fade into haze at distance. g26's near-foreground shards (r=14–32, ~8 of the 32 fresnel shards) coexist with the new foreground dust (r=6–40, 600 points). Both parallax with the ±1.2u camera float; shards are larger 3D tumbling pieces, dust is smaller scattered motes — they layer naturally without competing.

**Compatibility / cost.** Title auras: 4 halos (4 sprites) + 4 particle systems (112 points total) — negligible. Foreground dust: 1 Points object with 600 vertices — cheap, plus a per-frame integration loop of 600 iterations (~7000 floating-point ops, ~0.05ms on a modern CPU). Scheduler bumps are constants, no perf impact. Total new GPU draw: 2 sprites + 5 points objects = ~7 extra draw calls, all small.

**What to watch for.** When you load the page:
- 4 featured titles should now have soft colored glow halos behind them and small particles orbiting
- Hover a featured title — halo brightens and swells, particles speed up
- Click a featured title — title flies forward WITH its halo and orbit intact
- Near-camera dust visibly streams past as the camera floats — the void no longer feels empty up close
- Ships flying by every few seconds; scripted scenarios every 10-18s — the sky is BUSY

If still "boring and minimal" after this: real candidates for the next round are option 1 (Broadcast Core — central hero element at origin), or a more ambitious rework of how clicking works (cinematic camera move per track, audio teasers, etc.).

Files: `js/marathon-world.js` (new `_makeHaloTexture`, `_buildTitleAuras`, `_tickTitleAuras`, `_buildForegroundDust`, `_tickForegroundDust`; init wiring; animate ticks; flyby + scenario scheduler intervals), `js/builds/galaxy.js` (g26 → g27), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only per user.

---

## g26 — 2026-05-25 — Real depth pass: shards into foreground + atmospheric perspective on titles + 2x camera float

User (after g25 strip-back let them actually see the scene clearly): "can seer halo world better but now we see how empty things really are and how 2d it is. feels like site has no depth. its just a flat :(".

g25 fixed the over-glow problem and titles became readable. Side effect: the void now looks empty AND structurally flat — billboarded title planes + sprite haze + point starfield = everything's actually flat sprites in 3D space, just composited onto black. With less glow distracting from that, the flatness reads clearly. Real fix has to add genuine depth cues, not visual noise. Three changes:

**1. Shard distribution rebalanced for foreground parallax.** `_buildShards` already creates 32 fresnel-shaded 3D objects (icosahedrons, octahedrons, tetrahedrons, cones, dodecahedrons) that tumble and drift — they're proper 3D geometry, exactly the kind of thing that should sell depth. But they were ALL at distance 50–270u (`50 + Math.random() * 220`), which is the title-shell range, so they contributed zero foreground parallax. Camera float of ±0.6 against a shard at r=100 = atan(0.6/100) ≈ 0.34° per axis = invisible.

Rebalanced to three depth bands by random roll:
- 25% near: r=14–32u, scale 0.35–0.9 (small, close — these are what give the scene a foreground)
- 50% mid: r=50–130u, scale 0.7–1.9 (current behavior, title-shell territory)
- 25% far: r=140–280u, scale 1.2–2.6 (scaled up so they register at distance)

Near-shard parallax against the new camera float = atan(1.2/22) ≈ 3.1° per axis — clearly visible motion. Also bumped shader body color `(0.04/0.06/0.10) → (0.08/0.11/0.18)` so shard volumes have a faint read instead of being pure-edge wireframes. Still well under bloom threshold 0.30 so they don't glow.

**2. Atmospheric perspective on titles via shader.** New `uDist` uniform on each title material, updated per-frame in animate (`u.uDist.value = mesh.position.distanceTo(camera.position)`). Fragment shader applies:

```glsl
float fade = smoothstep(50.0, 230.0, uDist);
vec3 hazeCol = vec3(0.05, 0.06, 0.10);
col = mix(col, hazeCol, fade * 0.55);
a *= 1.0 - fade * 0.40;
```

Featured titles at r=90 (dist ~85 from a floating camera) get fade ≈ 0.19 — basically untouched. Newer at r=128 (dist ~125) get fade ≈ 0.42 — slight haze tint. Archive at r=188 (dist ~185) get fade ≈ 0.75 — clearly desaturated into haze and 30% lower alpha. This is the depth cue real cinematography and game engines use to sell "I'm looking into distance" — closer = saturated and sharp, farther = washed into atmosphere. Now archive titles aren't just smaller — they're SET BACK in space.

Also added `uDist` uniform (default 0, so no fade) to `_buildFragments` and `_spawnCommStaticMicro` material declarations so the shader doesn't get an undefined-uniform warning. Those stay unfaded by design — ambient text scraps shouldn't fade into haze.

**3. Camera float amplitude doubled.** Was ±0.6u envelope. Now ±1.2u (`0.42/0.28/0.48 → 0.85/0.56/0.95`, plus the secondary terms doubled too). Still subtle enough that nothing feels wobbly, but now the parallax against near foreground shards is unmissable.

**The three together.** Near shards visibly parallax past mid-distance shards as the camera floats. Atmospheric perspective makes the title shells read at different perceived depths (foreground titles SHARP, back-field FADED). Bigger float amplitude makes the parallax obvious. Result: when you drag-look around, you see real 3D layers — foreground tumbling shards, mid-distance featured titles, fading archive titles in the back, distant Halo ring further back yet, faint nebula behind everything. The "flat sticker" feeling should be gone.

**Compatibility.** All previous structural work intact: g19 tiered title shells, g20 audio isolation, g21 kinesis (float still on, just stronger), g22 fly-in lerp, g25 bloom restraint + auroras-off + dim nebula. Title shader change (new uDist uniform) is backward-compatible — the two non-title users of TITLE_FRAGMENT both pass default 0 so no fade applies to them. Raycaster unaffected (still uses world positions). Click-to-fly unaffected (showcaseDist computed from geometry).

**What to look for.** Drag-look in any direction and observe whether tumbling shards move noticeably faster across your view than the title field behind them. If yes, depth is reading. If still flat: shard near-distance can compress further (r=14-32 → r=8-20), camera float can crank more (1.2 → 1.8), atmospheric fade can sharpen (smoothstep 50/230 → 60/200).

**Out of scope.** B (distant megastructure for scale) still on deck. D (gravity-lens distortion) still on deck. Foreground dust particles (smaller than shards, denser) if shards alone don't sell depth.

Files: `js/marathon-world.js` (TITLE_FRAGMENT shader uDist uniform + atmospheric perspective math, `_buildTitles` material uDist uniform, animate uDist update + camera float amplitudes, `_buildShards` distance distribution + body brightness + scale tiers, `_buildFragments`+`_spawnCommStaticMicro` uDist material entries), `js/builds/galaxy.js` (g25 → g26), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g25 — 2026-05-25 — Course-correct: kill auroras, restrain bloom, dim nebula, bump title sizes — titles dominate

User (after g23+g24 tone-down still wasn't enough — screenshot of yellow/green wash filling the frame): "still suepr blidning what else can we do. all still feels the same and meh not very interesting just random titles you can barely read flaoting around".

**Reading the pattern.** Across g23 → g24 I was tuning the wrong dial. Each shader addition (auroras, stellar nurseries, pulsar sweep) was a NEW BRIGHT SOURCE feeding the bloom pass. Bloom amplifies bright pixels into haze. Two bright sources + bloom = haze stack. The g24 tone-down was incremental; the user's complaint isn't "tone it down more," it's "everything competes with the titles." For a music portfolio the titles ARE the page. The activetheory.net reference in `project_aesthetic_vision` memory points to MINIMAL — dominant hero content, restrained polish. I'd been doing the opposite — every build added another layer that drew attention away from the titles.

Per `feedback_rebuild_over_bandaids`: when iteration piles up patches and frustration spikes, stop surgical fixes and pivot. North-star phrase for this build: **titles dominate, void is quiet backdrop**.

**Five changes, all serving that phrase:**

**1. Bloom restrained.** This is the single highest-leverage move and probably what should have happened two builds ago. Was `threshold 0.05 / strength 0.85` — so virtually every visible pixel was bloom-eligible and got a generous halo. Now `threshold 0.30 / strength 0.55 / radius 0.45`. Only actually-bright pixels (title shader output, ship engines, hot nursery cores) bloom, and they bloom with restraint instead of a fat haze. Animate-loop modulation `0.80 + bass*0.45` → `0.55 + bass*0.25`. Net: scene stops bleeding into glow-soup; the post-FX still does real work but no longer paints over everything.

**2. Auroras disabled.** `_buildAuroras()` and `_tickAuroras()` calls commented out (functions kept in source for possible later re-enable). 5 large translucent ribbons sitting at mid-distance were just... noise. Toning them down further would keep them as faint hue smears that still distract; killing them outright lets the rest of the scene breathe.

**3. Nebula significantly darkened.** Overall trim `0.88 → 0.55`. Stellar nurseries contribution `0.55 → 0.22` and core lightness `0.72 → 0.55` and threshold raised `0.42 → 0.45` (fewer, dimmer knots). Pulsar sweep removed entirely (was a rotating spotlight competing for the eye). The nebula is now what it should have been all along — quiet atmospheric backdrop with subtle structural texture, not a co-star.

**4. Title sizes bumped across all tiers.** This addresses "barely read floating around" directly. Was:
- Featured: w=26, r=90 → ~16° angular width / ~300px on a 1080p frame
- Newer: w=17, r=128 → ~7.6° / ~145px
- Archive: w=12, r=188 → ~3.7° / ~70px ← unreadable for any title longer than ~6 chars

Now:
- Featured: w=34, r=90 → ~21° / ~400px — dominant foreground hero
- Newer: w=22, r=128 → ~9.8° / ~185px
- Archive: w=16, r=188 → ~4.9° / ~95px — readable

Font sizes bumped proportionally (240→260 / 190→200 / 140→150) so the canvas textures don't degrade. Archive opacity also bumped 0.72 → 0.82 since they no longer have to compete with bloom haze for visibility. Featured opacity stayed at 1.0 (already max).

**5. Bloom radius dropped 0.55 → 0.45.** Combined with threshold + strength changes, this tightens the halo on bright pixels so titles glow with definition instead of mushy smear.

**Compatibility.** g19's depth tiering, g20's audio isolation, g21's camera origin float + bigger title bob + fog drift, g22's slower fly-in lerp — all unchanged and still active. This is purely a brightness/visibility/competition pass on top of the structural work.

**What this should look like.** Black void. Subtle dim nebula with quiet stellar nurseries. NO bright ribbons crowding the frame. Titles BIG and READABLE — the 4 featured tracks dominate the foreground, the 6 newer tracks sit at mid-distance clearly, the 62 archive titles form a back-field that's still legible. Bloom on title glyphs gives crisp definition without bleeding into haze. Ships and landmarks (Marathon, Halo ring, Traveler, Saturn core) still landmarks. Scripted cameos still fire. The scene now reads as "a quiet broadcast where titles are transmissions" instead of "a busy room of competing lights."

**If still off.** Honest read on what to look for: do the titles dominate now? Can you read them? Is the void quiet enough? Is something now MISSING that the auroras filled (a sense of mid-distance volume)? Each of those is a one-line tweak from here. If "missing mid-distance volume" is the new complaint, that's where atmospheric perspective on titles (close = saturated, far = washed) or a single distant megastructure for scale could fill in.

Files: `js/marathon-world.js` (bloom config in `_setupComposer`, bloom modulation in animate, init aurora call commented, animate aurora tick commented, nebula fragment shader nursery/pulsar/trim, TIER_DEFS sizes/opacities), `js/builds/galaxy.js` (g24 → g25), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g24 — 2026-05-25 — Tone down g23: auroras normal-blended + farther + dimmer, nurseries + pulsar dialed back

User (looking at g23 screenshots — auroras blowing out into yellow/white glow across the whole frame, titles barely readable): "way too eheavily postporcessed or something so now everything glows too strongly and u cant make out any details … but if we take away postprocess it all looks blocky and like roblox with a 2d space background and 2d ugly titles".

Real diagnosis: **additive blending on bloom-eligible content compounds.** Auroras at α=0.65 with `AdditiveBlending` were piling RGB onto an already-bright nebula, then the bloom pass (strength 0.80 base + bass 0.45) amplified the result, then the halation post-FX threw a wider haze on top of that. Each step is fine in isolation; stacked they blow the frame into white. Same root cause for the stellar nurseries (multiplier 1.45, bass kicker × 1.4) and pulsar (0.45 + bass × 0.35) — those were bright sources for bloom too. User can't strip the post-FX entirely because without it the scene reads as flat / Roblox (their words).

Fix: keep all the structural g23 work (nurseries exist, pulsar exists, auroras exist, brighter palette), but turn down every NEW source of bright pixels so the post-FX has less to work with.

**Auroras:**
- Blending: `AdditiveBlending` → `NormalBlending`. The single biggest change. Ribbons now TINT the background through alpha rather than ADD color, so bloom isn't getting fed extra brightness per pixel.
- Radius pushed out: 195–255 → 320–420. They subtend ~half the screen angle now, so they don't dominate the field of view.
- Sizes shrunk: 150–190 wide → 95–135 wide; 34–46 tall → 26–36 tall.
- Fragment alpha: `0.65` → `0.22`, bass multiplier `0.35` → `0.15`. With normal blending and at the new distance, lower alpha is correct — over-blending was making them read as walls.
- Color lightness: HSL `l=0.58` → `0.42`, bands multiplier `1.0` → `0.55`. Less inherently bright per pixel.

**Stellar nurseries:**
- Final contribution `* 1.45` → `* 0.55`.
- Per-knot bass kicker `* (1 + uBass * 1.4)` → `* (1 + uBass * 0.6)`.
- Star core lightness `0.78` → `0.72`.

**Pulsar beam:**
- Contribution `0.45 + uBass * 0.35` → `0.18 + uBass * 0.12`.
- Beam color lightness `0.65` → `0.55`.

**Nebula overall trim:**
- `* 1.05` → `* 0.88`. g23's bump was overcorrecting. 0.88 sits between the original 0.85 and the punched-up 1.05 — slightly brighter than pre-g23 baseline but not aggressive.

Net result: auroras should now read as soft atmospheric hue tints drifting in the deep background, stellar nurseries should be visible but punctate (not blown-out blobs), pulsar should be a subtle moving brightness shift not a spotlight. Titles + landmarks should be readable again. The post-FX stack still does its work but doesn't have a hose of bright additive content to amplify.

If still over- or under-pitched after this, levers are:
- Aurora opacity (1 line, the `* 0.22` in fragment)
- Aurora radius (5 numbers in SETUPS)
- Nebula overall trim (1 number)
- Or kill auroras entirely if they don't serve the scene

Files: `js/marathon-world.js` (nebula fragment 4 constants + comment, aurora SETUPS radii/sizes, aurora fragment alpha + lightness, aurora material `blending`), `js/builds/galaxy.js` (g23 → g24), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g23 — 2026-05-25 — Background shader pass: nebula glow-up (stellar nurseries + pulsar sweep) + aurora ribbons

User (after kinesis pass g21/g22): "how can we make the scene feel less meh? we hjave some scripted ships, we have a floating ship, a halo ring, and some song titles. the background i think can be much much better idk put shaders to work heavy for the space background and where else and what else can we do? to anything in the scene" → "Lets do it A and C to start" (picked nebula glow-up + aurora ribbons from the pitch).

The void between scripted ships, title shells, and the distant skybox was structurally empty. The old nebula (5-octave fbm sphere at r=600, sat 0.55 / lit 0.26, single hue family) was technically a shader but read as a smooth dim gradient — no bright anchors, no structural variation, no events. The band between r=190 (archive titles) and r=600 (nebula) had literally nothing in it. Two coordinated additions:

**A — Nebula shader rewrite.** Same sphere geometry (r=600), same vertex shader, completely reworked fragment. Three new ingredients on top of the existing 3-field fbm cloud base:

1. *Stellar nurseries.* A high-frequency `fbm2` field (3 octaves at frequency ×14 compared to the cloud base) thresholded at the top of its range gives sparse, crisp bright knots scattered across the sphere — reads as distant star clusters / glowing nebula cores. Each knot's hue offsets from the local cloud hue via the cloud noise so they don't read as one color. Knot brightness pulses with `1 + uBass * 1.4` (per-knot multiplier, in addition to the global bass term), and a slow per-knot twinkle (`sin(uTime * 1.7 + noise * 9.0)`) makes them visibly alive. Multiplier of 1.45 on the contribution so they punch through the bloom + halation post-FX. Single biggest change — the sky now has FEATURES instead of just smooth color fields.

2. *Pulsar lighthouse sweep.* A slow-rotating axis (`vec3(sin(t*0.22), 0.2, cos(t*0.22))`, ~28s period) dotted with the view direction, raised to `pow(..., 22.0)` for a tight focused beam. Multiplied by a complementary hue and the bass term. Gives the sky a constant moving event — a "cosmic broadcast" sweeping across the dome — so even when the user is sitting still, the background isn't static.

3. *Brighter, more vivid palette.* Cloud saturation 0.55 → 0.72, lightness 0.26 → 0.32. Wisp saturation 0.72 → 0.85, lightness 0.42 → 0.52. Rim accent saturation 0.45 → 0.60, lightness 0.32 → 0.45. Hue spread across the sphere widened (0.18 → 0.22 axis-align + 0.06 → 0.08 noise) so the sphere has more color variation while staying cohesive. Sharpened cloud/wisp smoothstep ranges so structures have crisper edges. Final trim 0.85 → 1.05 — was getting eaten by the post-FX before.

**C — Aurora ribbons.** Brand new `_buildAuroras()` + `_tickAuroras(t, bass)`. 5 large curving translucent sheets at mid-distance (r=195–255), each on its own ShaderMaterial:

- *Geometry:* `PlaneGeometry(150–190, 34–46, 60, 8)` — high-segment plane to support per-vertex displacement.
- *Vertex shader:* Each vertex gets pushed along Z by `sin(uv.x * 7 + uTime * 0.45 + seed) * 1.4 + sin(uv.x * 2.6 - uTime * 0.28 + seed * 2.3) * 2.0` and along X by a cross-curl term. Two different sin periods so the curve isn't a clean pendulum. Turns the flat rectangle into a billowing ribbon that visibly waves through space.
- *Fragment shader:* Soft edge fadeout (top/bottom + left/right) so the ribbon doesn't read as a rectangle. 4-octave 2D fbm gives wispy striated alpha. Hue drifts globally with time (`0.018/s`) AND varies along the ribbon length (`uv.x * 0.18`) AND from noise — each ribbon shifts through a band of related hues. Additive blending with `depthWrite: false` so they layer over nebula without darkening anything and don't interfere with title raycaster.
- *Placement:* Fibonacci-spread direction vectors (each ribbon at a different bearing), each pushed out to its own radius (195/200/215/230/255 — slight depth stagger). After `lookAt(0,0,0)` to face the camera, a random `rotateZ` tilt (`-1.05` to `1.20` rad) gives each ribbon its own orientation. Plus a per-frame `rotateZ(0.0009 → 0.0016, alternating sign)` so they slowly twist over time like real auroras.
- *Hues:* cyan / hot magenta / amber / lavender / green — covers most of the cosmic palette so wherever the user drag-looks, there's saturated color in their peripheral view.
- *Render order:* −5 (after nebula at −10, before titles/landmarks at 0).

Total cost: 5 extra meshes, ~5000 triangles total, 5 shader programs. Negligible on any GPU that can already run the bloom + CA + DoF + god-rays + halation + lens-dirt + anamorphic-flare post stack.

**Wiring.** `_buildAuroras` added to init() right after `_buildNebula`. `_tickAuroras(t, bass)` called in animate immediately after the existing nebula uniform update.

**What hits hardest after this pass.** Drag-look anywhere in the sky and you should see:
- Sparse bright twinkling knots embedded in the cloud field (stellar nurseries)
- A slow bright lobe sweeping across the sphere every ~28s (pulsar)
- Saturated colored ribbons drifting at mid-distance (auroras) — these are the most dramatic addition, filling the previously-empty band between archive titles and the skybox

Combined with the camera origin float from g21, the auroras parallax against the more-distant nebula and the closer title shells, selling depth on every camera move.

**Out of scope (next pass candidates).** B (distant megastructure for scale anchor) — still on the menu. D (gravity-lens screen-space distortion) — still on the menu. Atmospheric perspective on title shader (close = saturated, far = washed into haze) — would now have something to wash INTO. Foreground dust trails. Bass-driven FOV punch.

Files: `js/marathon-world.js` (`_buildNebula` fragment rewrite, new `_buildAuroras`+`_tickAuroras`, init+animate wiring), `js/builds/galaxy.js` (g22 → g23), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g22 — 2026-05-25 — Slow title fly-in lerp 18 → 11 (less slam on song-switch)

User (after g21 kinesis pass): "ok now the camera zoom is just too too fast, on switch songs".

The "zoom" they mean is the focused title's fly-in. When you switch songs (HUD prev/next OR direct title click), `_focus(node, {mode:'fly'})` runs and the title position lerps from its sphere slot to the showcase point in front of the camera. g17 cranked that lerp rate from `dt*9` → `dt*18` on a complaint that song-switch felt sluggish (which we later found was actually the audio-not-playing bug, eventually rooted out in g20 as the TracksDaw exception killing playIndex). With audio fixed and the slam not masking anything anymore, dt*18 reads as too aggressive — title launches at the camera like a punch.

Dropped to `dt*11`. At 60fps that's a ~150ms half-life, so the title lands in ~300ms instead of g17's ~165ms. Still deliberate, no longer violent. The return lerp (unfocused titles easing back to their sphere slot) stays at `dt*8` so the previously-focused title still clears the foreground before the new one settles.

Single-line change. Camera origin float, title bob amplitude, fog lateral drift from g21 all carry forward unchanged.

Files: `js/marathon-world.js` (one lerp constant + comment), `js/builds/galaxy.js` (g21 → g22), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only.

---

## g21 — 2026-05-25 — Kinesis pass: camera origin float + bigger title bob + lateral fog drift

User (after testing g19/g20): "yes test 19 and 20 but idk what to look fo evrything looks identical honestly anyway to make enviromnebnt scene eveything so much cooler. feels like its very 2d except for our mini models acrnscriped scenes but still vastly empty and such".

Diagnosis: g19's depth overhaul re-tiered title distances correctly (featured at r=90, archive at r=188) — the geometry IS different. But the user couldn't FEEL depth because NOTHING in the scene moves. The 3D-feeling parts they called out (mini models, scripted ships) are 3D because they travel through space. Static titles at different radii without motion just look like static titles at different sizes — depth cue without depth perception. Parallax sells depth; without it, the void reads as 2D regardless of how the geometry is arranged.

Three structural changes that turn every existing layer into a depth-revealing parallax surface for free:

**1. Camera origin float.** The animate loop has run `this.camera.position.set(0, 0, 0)` every frame since the cockpit lock landed at b109. Replaced with a multi-period sin/cos drift — three axes, each composed of two terms at different periods (~5–8s and ~15–20s), totalling ~±0.6u envelope per axis. The camera now breathes through space. Critically, the look target shifts by the same offset so the forward direction stays unchanged — no apparent pitch wobble or "drifting off" feeling, just a gentle hover. Every world-anchored element (fog patches at r=70-310, nebula skybox, titles at three shells, ships, landmarks, the Halo ring, the Marathon ship, the Traveler) now visibly parallaxes against the camera motion. Close titles sweep faster than far titles. Featured titles at r=90 stratify in front of archive titles at r=188. The depth tier from g19 finally reads.

```js
const floatX = Math.sin(t * 0.13) * 0.42 + Math.sin(t * 0.31 + 1.7) * 0.18;
const floatY = Math.cos(t * 0.17 + 0.4) * 0.28 + Math.sin(t * 0.41 + 2.3) * 0.14;
const floatZ = Math.cos(t * 0.11 + 1.1) * 0.48 + Math.sin(t * 0.27 + 3.1) * 0.16;
this.camera.position.set(floatX, floatY, floatZ);
this.camera.lookAt(
  this.cam.lookAt.x + floatX,
  this.cam.lookAt.y + floatY,
  this.cam.lookAt.z + floatZ
);
```

**2. Title bob amplitude bumped.** Per-title `tmpDrift` in animate was `1.4/1.0/1.2u` on the three axes — a polite micro-jiggle. Bumped to `2.5/1.8/2.2u`. Each title now has a visible zero-G float in addition to the global breath. Combined with camera float, titles read as occupying their own micro-orbit rather than pinned to a sphere. Amplitude tuned to register without crossing into "wobbly" — 2.5u against a featured title at r=90 is ~3% of distance, visible but not chaotic.

**3. Fog patches drift laterally.** The 18 fog sprites already had vertical bob (`baseY + sin(t * 0.18) * 3.0`). Added matching X and Z drift (`baseX + sin(t * 0.08 + seed * 2.3) * 4.0`, `baseZ + cos(t * 0.07 + seed * 1.9) * 4.0`). Periods longer than the Y bob so patches drift slow and don't oscillate in lockstep. Required adding `baseX`/`baseZ` to userData in `_buildFogPatches`. Clouds now visibly roll past as the camera floats — sells "I'm moving through atmosphere."

**Why these three together.** Camera float is the foundation — it converts every static element into a parallax depth cue. Title bob keeps the constellation from looking pinned even when the camera is doing very little. Fog lateral drift adds visible mid-distance motion that the eye picks up immediately. Together: the void now reads as inhabited, breathing space. No new geometry, no new lights, no new shaders — just kinetic energy applied to layers that were already there.

**Compatibility.** Raycaster uses `setFromCamera(mouse.ndc, camera)` which reads `camera.matrixWorld` — that updates correctly after `camera.position.set` + `camera.lookAt`, so title hover/click works at the new camera position with no math changes. Inertia-drag affects `gaze.yaw/pitch` (not position) — unrelated to float and still functions. Plane billboards via `plane.quaternion.copy(camera.quaternion)` in `onBeforeRender` — since float preserves the forward direction, camera.quaternion is unchanged by float, planes still face the user correctly. Focus-fly's `fwd.multiplyScalar(showcaseDist)` showcases titles at a point relative to the forward direction from origin; with camera now floating, the showcase point also floats by the same offset (because lookAt is offset by the same vector) — net effect: focused title smoothly bobs in front of the user instead of being pinned. Confirmed via local validation; no JS structural issues.

**Out of scope (next pass candidates).** Atmospheric perspective on titles via shader (close = saturated, far = washed into haze color) — a more invasive shader edit, save for g22 if g21 doesn't fully land. Foreground dust particle layer (drift past camera at near distance for extra "I'm moving through stuff" cue). Bass-driven FOV punch (option C from the pitch — audio physicality). Wind gust scheduler (periodic ripple of glitch across the title sphere as an "event" moment).

Files: `js/marathon-world.js` (animate camera block, animate title-bob block, `_buildFogPatches` userData, animate fog-patch block — 4 small edits), `js/builds/galaxy.js` (g20 → g21), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK. Localhost-only iteration per user.

---

## g20 — 2026-05-25 — Isolate cross-scene onTrackChange hooks in playIndex so one scene's bug can't kill audio

User (after g19 depth overhaul landed visually): "why doesnt song auito play when i bring a title to center, same with when i change songs" + screenshots showing `chains (grunge)` and `c'est la vie` chip-loaded but `0:00 / 0:00` (paused, metadata never loaded).

Asked for console output. User pasted:
```
[audio] loading: /audio-mp3/shoebox.mp3
tracks-jump.js?v=...:2334 Uncaught TypeError: Cannot read properties of null (reading 'getCurrent')
    at Object.onTrackChange (tracks-jump.js:2334:26)
    at Object.playIndex [as onPlay] ((index):3085:59)
    at Object._focus (marathon-world.js:7950:24)
    at Object._onPointerUp (marathon-world.js:7150:30)
```

**Root cause.** `tracks-jump.js` (the WIP from the parallel /tracks chat that's now loaded by `index.html` instead of `tracks-daw.js`) has an `onTrackChange` at line 2334 that does `this.ctx.getCurrent?.()`. When you're on `/`, TracksDaw is never `init()`-ed, so `this.ctx` is `null` — and the optional chaining only protects against `getCurrent` being undefined, NOT against the receiver itself being null. The call throws TypeError.

`playIndex` (index.html:3076) was calling the two scene hooks unguarded:
```js
audio.src = url;
updateEdHeroTitle();
if (window.TracksDaw?.onTrackChange) window.TracksDaw.onTrackChange();   // ← throws here
if (window.MarathonWorld?.onTrackChange) window.MarathonWorld.onTrackChange();
// ↓ none of the below ever ran
const ctx = audio.__floorAnalyser?.ctx;
if (ctx && ctx.state === 'suspended') ctx.resume().catch(...);
audio.play().catch(...);
```

The TypeError propagated up through `_focus` and `_onPointerUp`, aborting `playIndex` BEFORE the `audio.play()` call. So `audio.play()` was never invoked. That's why the player sat at `0:00 / 0:00` — not a play() rejection, not an AudioContext suspended issue, not the g18 retry loop failing. Just an exception killing the call chain entirely. g17's `_ensurePlay` retries were never reached either because `MarathonWorld.onTrackChange` (which kicks them off) is the line right after the one that threw.

**Fix.** Wrap each per-scene hook in its own try/catch so one scene's exception is isolated and can't kill the rest of `playIndex`. Both calls also log a warning so the failing scene is visible in console without silencing the underlying bug:

```js
try { if (window.TracksDaw?.onTrackChange) window.TracksDaw.onTrackChange(); }
catch (err) { console.warn('[playIndex] TracksDaw.onTrackChange threw:', err); }
try { if (window.MarathonWorld?.onTrackChange) window.MarathonWorld.onTrackChange(); }
catch (err) { console.warn('[playIndex] MarathonWorld.onTrackChange threw:', err); }
```

This is the "boot wiring" case CLAUDE.md explicitly permits in `index.html` for galaxy scope — cross-scene isolation in the playback pipeline.

**Out of scope (but flagged).** `tracks-jump.js:2334` still needs its own defensive guard (`if (!this.ctx) return;` at the top of `onTrackChange`) — that's a /tracks-scope bug. Without that fix, the console warning will still fire on every track change on `/`, just no longer fatally. Belongs in the next /tracks build.

**Why g18's `_ensurePlay` "fix" never actually triggered.** g18 added a 5-retry play loop to handle AudioContext-suspended races. It works correctly in isolation. But the TracksDaw exception was thrown at `index.html:3085`, before `playIndex` reached its `audio.play()` call AND before MarathonWorld.onTrackChange / `_syncFocusToCurrent` / `_ensurePlay` was even invoked. The retry loop was bypassed entirely. So g18's diagnosis (AudioContext race) was wrong — there was a real-but-unrelated audio race in g17, but the underlying "song doesn't play" complaint was masking a TypeError-aborts-playIndex bug that landed when `tracks-jump.js` got wired into `index.html`.

Files: `index.html` (5-line try/catch wrap in `playIndex`), `js/builds/galaxy.js` (g19 → g20), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: no JS structure change — added try/catch around existing calls. Localhost-only iteration per user.

---

## g19 — 2026-05-25 — Depth overhaul: per-tier title shells (featured close + big, archive far + small)

User: "lets try A first localhost" — picked option A from my pitch on "how can we make it cooler and better": replace the single shared title sphere with per-tier shells at different distances. This is the structural lever — once distance varies, every other depth cue (DoF, atmospheric haze, drag-look parallax) has something real to operate on.

**Before.** Every title sat on `SHELL_RADIUS = 130` (±4u jitter). Tier controlled size + opacity ONLY — distance was identical. Result: void read as a single wallpaper sphere. Drag the camera and all 72 titles parallaxed in perfect lockstep — no sense of "this one is close, that one is far."

**After.** Each tier gets its own fibonacci shell:

| Tier | Count | Radius | jitter | widthUnits | fontSize | opacity |
|---|---|---|---|---|---|---|
| featured | 4 | 90 | ±12 | 26 | 240 | 1.00 |
| newer | 6 | 128 | ±14 | 17 | 190 | 0.92 |
| archive | 62 | 188 | ±25 | 12 | 140 | 0.72 |

Featured tracks pulled ~30% closer and ~30% bigger than the old shared shell — they dominate the foreground. Archive pushed ~45% further and shrunk to ~60% scale — they form a back-field of distant signals. Newer sit at the old shell distance as the visual bridge. Per-tier `jR` is widened so each shell breathes organically instead of reading as a clean ring.

**Per-tier fibonacci** instead of single-shared. Old code striped tier tracks through a unified slot list (every Nth slot is featured, etc.) — fine when all titles were at the same distance, but now that featured titles are 26u wide and pulled to r=90, their angular footprint is ~17°. If they sat at golden-angle spacing across 72 slots, two featured titles 5° apart on the shared distribution would visually overlap. Solution: each tier gets its own evenly-distributed fibonacci. 4 featured titles span the sphere with ~tetrahedral spacing (~90° between them), 6 newer at ~60° avg, 62 archive at ~13° avg. No two featured ever crowd each other; archive still feels dense.

**Why this is the highest-leverage change.** The galaxy already has bass-react shaders, twinkle, breath, hue cycling, glitch burst, 30+ scripted cameos, full post-FX stack. What it didn't have was *spatial depth* — and depth is what sells "I'm in a vast space" instead of "I'm looking at a sphere of stickers." With this change:
- DoF (when enabled in admin) now has something to actually blur — focus on a featured title at r=90 and the archive shell at r=188 falls out of focus.
- Atmospheric haze + fog patches read correctly because there's true distance between near and far elements.
- The existing breath uniform (`basePos * (1 + breath * 0.06)`) becomes more dramatic on far titles — archive at r=188 + peak bass moves ~5u, featured at r=90 moves ~2u. Bass hits ripple from far to near.
- Curation reads at a glance — the 4 featured tracks are immediately the visual centerpieces without needing a "FEATURED" pill.
- `showcaseDist` (computed dynamically from plane geometry + FOV in `_focus`) auto-adapts. Featured fly to ~16u on focus, archive to ~14u (floor). Click-to-fly behavior unchanged from the user's POV.

**What didn't change.** Title shader, hover/focus/burst behavior, twinkle scheduler, glitch burst, hue cycle, color tinting by tag, focus card, `_syncFocusToCurrent`, `_focus` math, raycaster hover detection, all 30+ scenarios, post-FX stack, HUD, admin panel. Single-method rewrite — `_buildTitles` only.

**Out of scope (waiting on user signal).** B (kinesis pass — camera float + layered nebula + wind gusts) and C (audio physicality — FOV punch on kick + sparkle storm + auto-fire on drops) from the same pitch. If A lands well, those layer on top.

Files: `js/marathon-world.js` (`_buildTitles` rewrite, ~50 lines net), `js/builds/galaxy.js` (g18 → g19), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

Validation: `cp js/marathon-world.js c:/tmp/mw.mjs && node -c c:/tmp/mw.mjs` → OK.

Localhost only per user — not pushed to Cloudflare.

---

## g18 — 2026-05-25 — Definitive fix: snap camera + fly mode + 5-attempt audio retry

User (g17 still broken — screenshots showing "fall away" clicked but paused with 0:00/0:00, then "jolly mood turn sour" playing but visual stuck on FALL AWAY): "upon refresh i clicked into fall away but auto play doesnt work, when i change song to jollymood sour, the screen stays on fall away. do you understand the fucking problem".

Two separate bugs that g17's incremental tweaks didn't actually solve:

**1. First-click no audio → AudioContext race.** When the page loads, the `AudioContext` created by `_hookAudio` for the bass-reactive shader is in `'suspended'` state. playIndex calls `ctx.resume()` and `audio.play()` synchronously. `resume()` returns a Promise that resolves async — `audio.play()` fires BEFORE the AudioContext is actually running. The play promise either rejects (NotAllowedError, since the destination graph isn't live) or queues silently. Symptom: chip shows the track title, but ▶ icon + 0:00/0:00, no sound. The single `play().catch()` retry I added in g17 wasn't enough — the AudioContext is still suspended at retry time too. Fix: new `_ensurePlay()` helper that retries up to 5 times with backoff (30 / 90 / 180 / 300 / 450 ms), re-attempting `ctx.resume()` on each attempt. Bails as soon as `audio.paused` is false. Wired into BOTH paths that change tracks: `_syncFocusToCurrent` (HUD prev/next) AND `_focus`'s non-skipPlay branch (direct title clicks). Catches every race-condition variant — context-suspended, AbortError, autoplay-policy half-failure.

**2. Visual stuck on prev/next → 'look' mode lerp dependency.** g17 used `mode: 'look'` for `_syncFocusToCurrent` — camera lerps toward new title's bearing, then auto-promotes to `'fly'` at marathon-world.js:8035 once close enough (`Math.abs(dy) < 0.005`). If anything interrupts the lerp before that threshold is hit (user drag clears `_targetYaw`, rapid re-trigger of `_syncFocusToCurrent` resets the lerp, or the title is near-antipodal so the lerp's k value never lands within 0.005 cleanly), the auto-promote never fires. New title stays at its sphere slot, focus card may or may not update, screen looks "stuck" on the previously-focused title. Fix: snap-and-fly. `_syncFocusToCurrent` now: (a) sets `gaze.yaw`/`gaze.pitch` directly from the new title's bearing (instant, no lerp), (b) clears `_dragVel` and `_targetYaw`/`_targetPitch` so nothing's competing for camera control, (c) calls `_focus(node, { skipPlay: true, mode: 'fly' })` — fly mode pulls the title to camera-forward (which is now the new title's bearing post-snap) on the next animate tick. Zero lerp dependency on the camera side; only the title-position lerp runs (still at the bumped 18/dt rate from g17). Pattern matches `_adminHopRandomTitle` (marathon-world.js:7693) which has worked reliably for the admin "hop to random title" button.

Files: `js/marathon-world.js` (rewrote `_syncFocusToCurrent` + added `_ensurePlay` + wired into `_focus` non-skipPlay branch), `js/builds/galaxy.js` (g17 → g18), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

The lerp-rate bumps (camera 14, title fly-in 18, title return 8) + shader glitch reductions from g17 all carry forward unchanged.

---

## g17 — 2026-05-25 — Snappier focus transitions + audio play retry + less-glitchy focused titles

User (with screenshots showing CONVINCED stuck big-and-glitchy on screen while the chip cycled through stop-but-i-won't → nice): "when i click into a song, it should auto play. when i press next arrow, it should play next song. currently it queues it but stays paused. if i have a song close to screen, and i change songs, camera should quickly move away from previous song floating title and move to the newly queued/selected song. make the animations faster for camera when interacting with the songs and such. also make titles a bit more visible. the constantly glitch effect takes away visibility legibility whatever the fuck".

Three real bugs + one aesthetic ask. Addressed each:

**1. "Queues but stays paused" → audio.play() retry in `_syncFocusToCurrent`.**
playIndex sets `audio.src = url` and synchronously calls `audio.play()`. The src reset implicitly pauses the element and starts a new fetch; Chromium often rejects the play() promise with `AbortError: The fetching process for the media resource was aborted by the user agent` because the previous play() against the old src is still resolving. The catch in playIndex just toasts the error — track stays paused, chip title updates anyway. Fix: after `_focus` runs in `_syncFocusToCurrent`, if `this.ctx.audio.paused`, call `play()` again. If THAT also AbortError's, schedule one more attempt after 80ms (gives the element time to settle from the src change). Doesn't touch index.html — works through the existing `ctx.audio` reference.

**2. Camera doesn't move on prev/next → revert g16 + crank lerp rate.**
g16 swapped `mode: 'look'` → `mode: 'fly'` to make the new title come to the front. It did, but the camera stayed put, so the title appeared to "pop" without any sense of where it came from. User specifically asked for camera motion: "camera should quickly move away from previous song floating title and move to the newly queued/selected song". Reverted to `mode: 'look'` (camera rotates toward new title's basePos, then auto-promotes to 'fly' at marathon-world.js:8035 once it arrives, pulling the title forward). Made it FEEL fast by bumping the camera follow-cam lerp constant in `animate()`: `dt * 3.5` → `dt * 14`. Full look-then-fly sequence now completes in ~250ms instead of ~1s. The auto-promote still works because the close-enough threshold (0.005 rad) is hit much sooner.

**3. Title animations sluggish → bumped per-title position lerp.**
At marathon-world.js:8216, the focused title's fly-in and unfocused titles' return-to-sphere both used `dt * (isFocus ? 9 : 3)`. Bumped to `dt * (isFocus ? 18 : 8)`. Focus fly-in is ~2x faster; unfocused titles also return ~2.7x faster, which matters here because the previously-focused title is the one easing back to its slot — slow return left a "ghost" of the old title hanging in the foreground while the new one was arriving. Now the old one clears before the new one lands.

**4. Glitch killing legibility on focused titles → trimmed shader params.**
TITLE_FRAGMENT shader, the `gAmt` formula was `0.30 + uHover * 1.10 + uBass * 0.55 + uFocus * 0.35`. The `uFocus * 0.35` term meant focused titles glitched HARDER than idle — exactly backwards if the focused title is the one you're reading. Rewrote to `0.18 + uHover * 1.10 + uBass * 0.45 + uFocus * 0.05`: lower idle baseline, focused contribution slashed 7x, bass-react slightly trimmed. Also halved the RGB chromatic-aberration scale (`0.012 → 0.005`) — that was the most visually-jarring artifact in the user's close-up screenshot (rainbow bleed around glyph edges). Dropout chance trimmed from 5% to 3% per-gAmt-unit so fewer holes get punched in the letters. Hover-glitch unchanged so mouse-over discoverability still cranks.

Files touched: `js/marathon-world.js` (~5 small edits across `_syncFocusToCurrent`, animate camera-lerp block, animate per-title lerp, TITLE_FRAGMENT shader), `js/builds/galaxy.js` (g16 → g17), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

---

## g16 — 2026-05-25 — HUD prev/next: switch focus mode 'look' → 'fly'

User: "when i click on a song title. it brings it to the front, when i use play next song or previous, it will change on media player but wont show me the new songs title on center of my screen".

g15 wired `_syncFocusToCurrent` to fire on prev/next, but it passed `mode: 'look'` — that rotates the camera toward the title's sphere slot but leaves the title at sphere radius (~130u away, ~14u wide → tiny on screen). The user expected the same dramatic reveal as a direct title click, which uses `mode: 'fly'` (title pulls forward to a showcase point in front of the camera, sized to fit the viewport).

Fix: one-word swap in `_syncFocusToCurrent` — `mode: 'look'` → `mode: 'fly'`. Now prev/next behaves identically to clicking a title directly. The focus card rewrites in place (glitch-types the new name), and the previously-focused title (if any) gets dropped from `this.focused` so the animate loop's per-title lerp returns it to its sphere `basePos`.

No release-then-focus dance needed: `_focus` is idempotent on the focus-card DOM (just rewrites textContent + reruns the glitch animation), and the old title's return-to-sphere happens automatically via the per-frame lerp at marathon-world.js:8214 since it's no longer `this.focused`.

Files: `js/marathon-world.js` (1-word change in `_syncFocusToCurrent` + comment refresh), `js/builds/galaxy.js` (g15 → g16), `docs/galaxy/FILE_MAP.md`, this CHANGELOG.

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
