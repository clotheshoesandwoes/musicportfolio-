# CHANGELOG

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
