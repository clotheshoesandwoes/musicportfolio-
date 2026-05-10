# TRACKS CHANGELOG

Per-scene history for `/tracks` starting at the post-split point. Build history before the split (b001–b242, including the b206 Tracks DAW landing + b222/b223 instrumentation + b218 instrumented-init etc.) lives in the frozen root [CHANGELOG.md](../../CHANGELOG.md). New tracks builds are logged here.

---

## t8 — 2026-05-10 — FL 2026 reskin: deep navy glass, jewel-tone channels, glowing meters, no chunky bevels

> "still ooks liie an oldschool daw and not a beautiful inspired by fl studio 2026"

t7 was FL circa 2005 — chunky steel-gray bevels, hardware-LED segments, faux-metal everything. Re-tuned to the modern FL look: deep dark navy base, glassy translucent panels with backdrop-blur, vivid jewel-toned channels with soft outer glows replacing bevels, smooth gradient meters with halo glow.

**Palette inversion.** Dropped the steel grays. Base back to deep navy: `--daw-bg #0c1018`, panels `#141923`, hairline separators are now `rgba(255,255,255,0.06)` (a single tint over the dark) instead of solid `#1c1e22`. Removed `--daw-bevel` / `--daw-bevel-deep` tokens entirely; replaced with `--daw-glow-soft`, `--daw-glow-orange`, `--daw-glow-cyan` — modern feel reads as light radiating from the surface, not light reflecting off chunky metal. LCD shifted from acid-green to a softer cyan (`#6ee7ff`) with a wide, gentle text-shadow.

**Glassy bands.** Topbar / transport / lane heads / bandbar / statusbar / master pane all now use `rgba(20,25,35,0.85-0.92)` with `backdrop-filter:blur(14-18px)` so they read as floating glass rather than rack panels. Master pane keeps the orange left edge but the bevel highlight became a soft 1px tinted border + an inset cyan glow.

**Buttons rethought.** `.daw-tx-btn` is now `rgba(255,255,255,0.04)` with a 1px white-alpha border, 6px rounding, and a clean scale-down on click — no gradient stack. Play button is bright FL-green (`#6efeb1 → #36c878`) with a strong outer glow (no border bevel); armed state is bright pink-red with the matching glow. Tabs lost their inset shadow; active tab is now a 2px orange underline with `box-shadow:0 0 12px var(--daw-accent)` halo. Filter chips are translucent pills with the active state glowing orange instead of recessed amber.

**M/S buttons → glow pills.** Round LED radial-gradients replaced with subtle 5px-rounded pills. Off state is barely visible. Click-to-toggle (M lights bright pink, S lights bright green) — no skeuomorphic socket, just the color radiating from the button.

**Channel saturation bumped.** `paletteForCell()` got more aggressive: featured `s:90→92, l:66→64`, new `s:74→82, l:62→62`, archive `s:16→55` — even the oldest clips now read as a real color identity instead of muddy grey. This is the single biggest visual upgrade because it makes the year columns immediately scannable as a rainbow of channels.

**Spectrum rewrite (again).** The 22-segment LED ladder was the most "old DAW" element of t7. Replaced with 56 sleek vertical bars: rounded tops, smooth `cyan-low → channel-tinted-mid → bright-orange-top` gradient, white gloss highlight on the top edge, peak-hold dots, and a soft cyan floor-glow under the whole spectrum. **The hue is pulled live from the currently-armed clip's palette** — when a different track plays, the entire spectrum re-tints to that channel's color. That's the feature t7's static green/amber palette couldn't do.

Lane backgrounds dropped to deep navy `#0e1320 → #0a0e16`. Clip cells got 6px rounding, no chunky bevel — just a clean translucent gradient and a 1-pixel hue-tinted border. Clip launch buttons (`▶`) ditched the inset gradient for a single flat tint with a soft halo glow on hover.

Files: `index.html` (DAW palette + topbar/transport/buttons/LCD/meters/tabs/lanes/master/bandbar/statusbar/LEDs/clip cells re-styled), `js/tracks-daw.js` (`paletteForCell()` saturation bump + `_drawSpectrum()` smooth-bar rewrite with per-track hue tinting), `js/builds/tracks.js` (t7 → t8), `docs/tracks/FILE_MAP.md`.

---

## t7 — 2026-05-10 — FL Studio reskin: steel-gray panels, beveled controls, LCD time, LED-segmented spectrum

> "can we make the daw cooler more resminisct of FL studio rather than its current ableton like state?"

Aesthetic pivot from Ableton-charcoal-minimal to FL-Studio-steel-gray-skeuomorphic. Layout structure (year-keyed lanes for session, Discography Tape for arrangement, master pane on right) is unchanged — only the visual treatment moved.

**Palette retune.** `.daw-root` vars shifted from charcoal (`--daw-bg #131316`, panels `#1a1a1d`) to lighter steel grays (`--daw-bg #2c2f34`, panels `#3a3d43`) so panels read as raised metal rather than inset darkness. New vars added for FL specifics: `--daw-led-green #66ff7a`, `--daw-led-amber #ffae3d`, `--daw-led-red #ff3d3d`, `--daw-lcd-bg #0c1408`, `--daw-lcd-text #5cff95`, plus reusable `--daw-bevel` and `--daw-bevel-deep` shadow tokens.

**Beveled controls everywhere.** Transport buttons (`.daw-tx-btn`), filter chips (`.daw-bb-chip`), volume slider thumb, and clip launch buttons (`.daw-clip-btn`) all got 3-stop linear gradients (top highlight → mid body → bottom shadow) + 3px border-radius + inset bevel shadow + hard `#000` borders for the carved-into-metal look. Pressed state inverts the gradient and adds an inset shadow. Play button is now bright FL-green at idle and bright-red when armed (was orange-on-orange).

**LCD time readout.** `.daw-tx-time` is now a green-on-near-black LCD: deep `#0c1408` background with horizontal scanlines, `#5cff95` digits with `text-shadow:0 0 4px rgba(92,255,149,0.65)`, recessed inset shadow makes it look set into the metal.

**LED-segmented spectrum (JS rewrite).** `_drawSpectrum` was 64 smooth-gradient bars; now 32 wider bars built from 22 discrete LED segments each. Color band: bottom 60% green, middle 25% amber, top 15% red — classic VU-meter ladder. Added attack-fast/release-slow smoothing and peak-hold dots that fall after ~18 frames. Each lit segment gets a 1px white highlight on top so the LEDs read as having gloss. The center-line scope was removed — too smooth/curvy for the LED idiom.

**LED indicators.** `.daw-brand-led` (top-left) and `.daw-st-led` (statusbar) became radial-gradient bulbs that glow bright FL-green when audio plays (was solid red dot). M/S buttons on every lane head turned into circular rack LEDs — clicking M lights it red, S lights it green, and a tiny `_wireEvents` delegation on `.daw-tinybtn[data-toggle]` toggles `is-on` (visual only — no audio routing yet, but the button feels alive).

**Topbar / transport / statusbar / bandbar / lane backgrounds** all swapped to multi-stop steel-gray gradients with `inset 0 1px 0 rgba(255,255,255,0.06-0.10)` highlights and matching `inset 0 -1px 0 rgba(0,0,0,0.40)` bottom shadows, giving every band a subtle "rack panel" 3D feel. Master lane keeps its 3px orange left border but now also has a faint orange inset highlight on its leading edge.

Files: `index.html` (DAW palette vars + topbar/transport/buttons/LCD/meters/lanes/bandbar/statusbar/LEDs/clip cells re-styled), `js/tracks-daw.js` (`_drawSpectrum` rewritten as LED segments + `_wireEvents` M/S LED toggle delegation), `js/builds/tracks.js` (t6 → t7), `docs/tracks/FILE_MAP.md`.

---

## t6 — 2026-05-10 — Inline ▾ details panel in master pane (no page nav)

> "i dont like that details brings u to another separate page lets just have it as collapisble thing in the sidebar weve made"

The `▸ details` row in the master pane was a `<a href="/t/<slug>">` that yanked you to a separate page. Converted into an inline collapsible — clicking now expands a panel underneath the row showing notes (description), credits if present, file path, and permalink (click to copy). Arrow rotates `▸ → ▾` and `aria-expanded` toggles. The panel inherits the master pane's charcoal-on-near-black palette with orange `// SECTION` labels matching the rest of the DAW chrome.

The standalone `/t/<slug>` route is left intact — anyone arriving via a shared link still gets the full-page render — but the master pane no longer steers people there. Permalink button at the bottom of the panel exposes the same URL one click away.

Files: `js/tracks-daw.js` (shell HTML for the panel, click wiring in `_wireEvents`, population in `_updateMasterCard`), `index.html` (`.daw-ma-panel` / `.daw-ma-panel-row` / `.daw-ma-link` styles), `js/builds/tracks.js` (t5 → t6), `docs/tracks/FILE_MAP.md`.

---

## t5 — 2026-05-10 — Tracks UX modernization: dense lanes, killed legacy topbar, DAW-skinned detail page, Discography Tape arrangement

> "arrangement kind of sucks, could chang it to something cooler and on session, ther more tracks a year has, the harder it gets like the wrapping or shrinking oir whatever"
> "also when i clikck into a song and click details it brings up the older theme older wbeiste stuff can we update so everything is up to date"
> "and the top headbar also needs to be updatred removed or adjusted for our tracks and newest stuff"

Four modernization passes bundled because they're the same conceptual ask: "make /tracks and everything you can reach from it feel like one cohesive DAW."

1. **Session column density fix.** `.daw-clip` had no `flex-shrink:0`, so the moment a year column had more clips than fit (2022 with 33 clips, 2026 with 13), flex shrinking compressed every clip vertically — title-only stripes with no waveform, unreadable. Added `flex-shrink:0`. Now clips stay full-size and `.daw-stack`'s existing `overflow-y:auto` actually scrolls the column. No more wrapping pain in dense years.

2. **Killed the legacy global topbar.** The "kani · TRACKS · FEATURED · ALL TRACKS · NEW · WORLD · EXPLORE · search" header was Beta-Decay-era catalog navigation, redundant on every modern view: galaxy has its own player chip + nav, DAW has its own brand+search+tabs, detail/playlist pages each have their own back-link. `header.topbar { display:none }` globally + `main { padding-top:24px }` to recover the spacing. Existing `body.tv-on header.topbar { display:none }` rule kept (harmless, documents intent).

3. **Track detail page (`/t/<slug>`) re-skinned in DAW palette.** The old `viewTrack()` rendered "— INCOMING SIGNAL —" magenta kicker, glassy panels, big pink "PLAY" button — pure Beta Decay holdover. Rewrote in `.detail-wrap` scoped vars (`--d-bg #0e0e10`, `--d-accent #ff7a3d`, `--d-line #2a2a30`) matching DAW charcoal/orange/monospace. Hero is grid `380px 1fr`, kicker is now an animated LED dot + `CLIP INSPECTOR · TRK.###`, panels have a 2px orange left border like the master pane, stats use uppercase mono labels with tabular-num values. Copy updated: "play" → "launch", "// signal info" → "// clip info", "// listen elsewhere" → "// external", "more from kani" → "more clips". Back-link goes `/tracks` (back to session), not `/`. Class names unchanged so no JS rewires needed — only the visual treatment moved.

4. **Arrangement view rebuilt as "Discography Tape".** Old arrangement had 5 horizontal tier-keyed lanes (FEATURED/NEW/HARD/CHILL/ARCHIVE) with thin 70-130px text-only bars scattered by date — lots of empty space, hard to read, no waveforms. New version: single horizontal row, all dated tracks sorted oldest → newest, each track is a 200×156 block with the same procedural waveform renderer as session clips, slot number + tier + title + date stacked inside. Gaps between blocks are sqrt-scaled days-since-previous (clamped 4-40px) so a 6-month gap reads visibly larger than a 1-week gap without a 5-year break dominating the layout. Year markers are big orange labels at the top with vertical accent lines descending through the row. Auto-scrolls to the most recent block on load. Per-block progress bar fills along the bottom edge of the playing block, and the white playhead sweeps across it. Click any block to launch.

Files: `js/tracks-daw.js` (`_buildArrangement` rewrite + arrCell barEl update in `animate`), `index.html` (legacy `header.topbar` hide + `.daw-clip` flex-shrink + `.detail-*` palette swap + `viewTrack()` copy + `.daw-arr-*` rewrite), `js/builds/tracks.js` (t4 → t5), `docs/tracks/FILE_MAP.md`.

---

## t4 — 2026-05-10 — Hide bottom miniplayer on /tracks (DAW has its own transport)

> "on tracks, we have the media player at the bottom. we can remove it since we have another one within the daw itself"

The global `#miniplayer` was still appearing at the bottom of `/tracks` whenever a clip played, stacked under the DAW transport. The CSS rule `body.tv-on .miniplayer{ display:none }` was already there, but `renderMiniplayer()` sets `mp.style.display='flex'` inline whenever a track is current, and inline styles beat the stylesheet — so the CSS rule never won.

Fix: mirrored the existing Galaxy-mute pattern. `renderMiniplayer()` already early-returns with `display:none` when `body.classList.contains('mw-on')`; added the same check for `tv-on` directly under it. One source of truth (the function that owns the inline display) now respects both immersive scenes.

Files: `index.html` (renderMiniplayer guard), `js/builds/tracks.js` (t3 → t4), `docs/tracks/FILE_MAP.md`.

---

## t3 — 2026-05-10 — Sexier DAW: hero master + real waveforms + tighter chrome

> "i want you to focus on tracks, you know how we made it a daw. well theres some sizing and sapce issues and im wondering how u could overall improve nad make it sexier"

Five space/density passes against the b206-era DAW. Goal: less HUD chrome, more visual personality per clip, master pane that actually reads as the hero.

1. **Waveform thumbnails — the big one.** Replaced the 22px stroked-vertical-bar `_drawClipWaveform` with a 40px mirrored gradient envelope: title-seeded LCG generates a stable amplitude curve (arc + two mid-freq sines + grain), filled top + bottom with palette-derived gradients, edge-traced with a brighter highlight stroke so the silhouette reads at thumbnail size. Each clip now has a distinct, recognizable waveform shape instead of looking like static.

2. **Hero master pane.** Lane width 300 → 400px (responsive: 340 @1100, 300 @900, 260 @640). Spectrum 120 → 170px. `daw-mc-title` 18 → 26px. Master pulled forward visually via `box-shadow:-14px 0 36px rgba(0,0,0,0.50)` and 3px accent left border. New: `.daw-master-card` is tinted live from the currently-playing track's palette via `--mc-h/s/l` custom props (set in `_updateMasterCard`) — radial gradient bleed from top-left + a 2px tinted bar on the card's left edge that glows in the playing track's color.

3. **Chrome compression.** Killed the 22px bottom status bar entirely (removed div from `_renderShell`, dropped from `daw-root` grid-template-rows in all three breakpoints). Lane heads: `min-height` 54 → 40, padding 10 → 6, title 13 → 11.5, sub 9.5 → 8.5, stripe 36 → 26. M/S buttons fade to 45% opacity, full on lane hover. Net ~50px of vertical real estate handed back to clips.

4. **Tier rhythm.** `paletteForCell` saturation/lightness bumped for featured (s:78→90, l:62→66) and dropped hard for archive (s:28→16, l:56→50). New `[data-tier="featured"]` rule gives featured cells a soft hue-tinted outer glow + brighter border; `[data-tier="archive"]` desaturates the cell gradient further so featured genuinely pops.

5. **Removed `daw-clip-empty` slots** — the dashed 8px placeholders at the bottom of each stack read as visual scuffs, not Ableton-style affordances. Lanes end cleanly at the last real clip.

`_setStatus` calls left in place (they no-op when `#daw-st-msg` is absent — `if (el)` guarded), so call sites don't need touching.

Files: `js/tracks-daw.js`, `index.html` (inlined DAW CSS), `js/builds/tracks.js` (t2 → t3), `docs/tracks/FILE_MAP.md`.

---

## t2 — 2026-05-10 — Fix /tracks black screen (root collapsed to 0 height)

> "okay the page is a black screen like its dead"

`/tracks` rendered fully black. Console showed DAW boot succeeded — `init()` ran, root mounted, `_buildSession` completed with 104 cells — but the instrumented log reported `[daw] root mounted. rect = 1889 x 0`. The DAW root was getting full viewport width but zero height.

Cause: `.daw-root` was sized via `position:fixed; inset:0;` on a `display:grid` container with `grid-template-rows: 36px 56px 32px 1fr 22px;`. In some Chromium builds (Vivaldi included) that shorthand fails to derive an intrinsic height for the grid container, so `1fr` resolves to 0 and the explicit rows don't get a chance to expand the box.

Fix: replace the `inset:0` shorthand with explicit `top:0; left:0; width:100vw; height:100vh;` so the grid container has an unambiguous size to lay rows into. No JS change.

Files: `index.html` (the `.daw-root` rule), `js/builds/tracks.js` (t1 → t2), `docs/tracks/FILE_MAP.md`.

---

## t1 — 2026-05-09 — Tracks split-off (post-b242 migration starting point)

No code change to tracks-daw.js itself. Only the build-bookkeeping moved to per-scene files. See root [CHANGELOG.md](../../CHANGELOG.md) b242 for the migration entry.

State carried over from b241:
- Full Ableton-faithful SESSION + ARRANGEMENT views with sticky MASTER pane.
- Spectrum analyzer + L/R level meters wired to the shared `audio.__floorAnalyser`.
- Filter chips (`all/featured/new/hard/chill/grunge/vibe`) + keyboard nav + shareable `/tracks/new` URL state.
