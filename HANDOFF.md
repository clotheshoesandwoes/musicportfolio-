# HANDOFF — cantmute.me (Kani music portfolio)

**For:** future Claude Code session continuing this project
**Last build:** b017 (2026-04-07)
**Read this BEFORE doing anything else** — it saves an entire conversation of context-building.

---

## 1. What this project actually is

**cantmute.me** is Kani's music portfolio, but built as an explorable 3D world instead of a tracklist page. The aesthetic is dusk Miami / Mykonos luxury villa with PS2-era chunky pixel rendering (intentional artistic identity).

**Core interaction loop (the destination):**
1. Visitor lands on site → drops into the villa scene
2. Drags mouse / pinches on mobile to orbit the camera around the property
3. Clicks an interactive prop (piano, record, cigarette box, car, etc.)
4. A song-card pops up near the clicked prop with a play button + extra metadata
5. Press play → audio plays from R2 → scene may eventually react to audio frequencies

**Status:** Steps 1, 2 work. Steps 3-5 do not exist yet — that's the next major feature (called "click→card system" throughout the changelog). The villa scene is being progressively built up to have enough interesting props to eventually support this.

---

## 2. Tech stack — vanilla everything

- **No build step.** No webpack, no vite, no bundler. Pure HTML + JS + CSS served as static files.
- **Three.js** loaded lazily from `https://unpkg.com/three@0.160.0/build/three.module.js` on first villa view activation. ESM CDN, no install.
- **Hosting:** Cloudflare Pages, deployed automatically from GitHub master.
- **Audio:** Cloudflare R2 bucket `cantmute-audio`, public URL `https://pub-5556ef4db74d499ba3f535afccf8c7be.r2.dev/`
- **Repo:** [github.com/clotheshoesandwoes/musicportfolio-](https://github.com/clotheshoesandwoes/musicportfolio-)
- **Local dev:** the user serves it locally via VS Code Live Server or `python -m http.server`. Audio works locally because of CORS rules allowing localhost (see section 6).

**Views:** 4 total — terrain (2D canvas), deepsea (2D), neural (2D), **villa (3D, the hero)**. Default view is villa (set in [js/app.js:304](js/app.js#L304) as `switchView('villa')`).

---

## 3. The mandatory workflow (from CLAUDE.md)

The user has strict workflow rules in [CLAUDE.md](CLAUDE.md). Read it. The highlights:

- **Before writing code:** state what the user is asking for in your own words, list every file you'd modify, ask first if ambiguous or destructive or >5 files
- **Forbidden:** adding features the user didn't ask for, "improving" code while making other changes, multiple unrelated changes in one response, refactoring "while you're in there"
- **Always update** with every code change: `CHANGELOG.md` (entry at TOP, newest first), `FILE_MAP.md` (build number, structural changes), `js/helpers.js` (`BUILD_NUMBER` increment, e.g. `b017` → `b018`)
- **Read before you write:** read FILE_MAP.md first to understand current state, then read recent CHANGELOG entries, then read the actual file you're modifying
- **Force push to main/master is destructive** — never do it without explicit user request
- **node --check is necessary but NOT sufficient** for verification — see section 9 about TDZ errors

**One-word mode:** when the user says "yes," "do it," "go," or "push," they're approving the most recent proposal — execute, don't repeat the plan.

**Commit messages:** the user agreed in this session that I write commit messages going forward. When they say "git commit" they want me to actually run git, not paste the plan into a commit message.

---

## 4. Memory files (read these too)

There are persistent memory files at `C:\Users\B4TTL\.claude\projects\c--Users-B4TTL-musicportfolio\memory\`:

- `MEMORY.md` — index of all memory files, always loaded into context
- `project_overview.md` — what the project is + the click→card vision
- `villa_vision.md` — house must be MUCH bigger, beach front + Miami back, click-target props plan
- `feedback_world_js_declaration_order.md` — TDZ gotcha for adding new mesh blocks

**Always check these files when starting a fresh session.** They contain context that's not derivable from the code.

---

## 5. Current scene state (post-b017)

### Villa view ([js/world.js](js/world.js), 1554 lines)

**Render pipeline:**
- Custom 854×480 `WebGLRenderTarget` with `NearestFilter`, upscaled via fullscreen quad → "PS2+" chunky pixels
- PS2+ vertex jitter: clip-space xy snapped to 320×180 grid (applied to PS2 mat, ocean mat, skyline-dot mat — pool and sky stay smooth)
- Custom 3-light shader (NOT three.js's built-in lights) — three point lights as uniforms: warm deck lantern, cyan pool glow, warm interior window. Distance falloff + N·L done manually in `pointLight()` helper inside the fragment shader.
- Heavy `FogExp2` (cool indigo `0x40285a`) matched in PS2/pool/ocean shaders
- Lighter scanlines + subtle vignette in the post-pass

**Sky:** "sun just dipped" palette — pink/orange horizon `0xff7050` → lavender mid `0x9a3070` → deep indigo zenith `0x0a0a3a`. Sparse zenith-only stars. No moon.

**Villa architecture (b016/b017):**
- **Lower volume:** 32×6×18 white plaster, **HOLLOW SHELL** — interior travertine floor + 3 solid walls (back/left/right) + interior ceiling + 7 stone columns + 6 FTG glass panes on the open front face. (Was 5 columns + 4 panes pre-b016.)
- **First upper volume (cantilever):** 28×4.5×12, shifted +4 east, hangs 2.8 forward over the pool deck
- **Second upper volume (top floor box):** 14×3.5×8, shifted -6 west, sits on top of the first upper. Stepped pyramid asymmetry.
- **Cylindrical corner tower:** radius 3, height 8.5, embedded into the villa west wall front corner. Glass cylinder band wraps the upper portion. The first non-rectangular element — main "not just a square" move.
- **Rooftop terrace wall:** low parapet (0.9 high) on the east + front edges of the first upper.
- **Recessed cove light strip** on the underside of the upper cantilever.
- **Stone columns:** 7 at x=±14, ±9.33, ±4.66, 0. Each 1.6 wide × (lowerH+0.5) tall × 0.85 deep.
- **Front door:** central, between columns at -9.33 and -4.66. Back door on the rear wall.
- **Interior is empty** — leaving room for prop click-targets.

**Pool (b016):**
- Long infinity-edge bar: 22×6 BoxGeometry at (0, 0.10, 5)
- Circular jacuzzi attached at east end: CylinderGeometry r=2.4 at (13.5, 0.10, 5)
- Travertine rim around both
- Custom water shader: tile-line UV grid + caustic bands + vertex ripple displacement on top face + 3.6× brightness boost (cyan glow)

**Pool deck props:**
- 3 white-cushion daybeds with wood bases at z=10.8, x=-6/0/6
- 4 deck lanterns at z=9.5, x=-9/-3/3/9 — warm emissive boxes, wired into the `lampPos` light uniform
- ~11 low-poly icosahedron boulders scattered around pool front + corners
- Cyan/magenta/purple/warm path light pillars + ground spots at the deck edges

**Pink Lambo:** at (-14, 5), rotated `-Math.PI/4` (hood pointing front-left toward -x +z direction), surrounded by 6 dark green icosahedron shrubs forming a landscaping cluster.

**Yellow Lambo:** parked in the driveway at (0, ?, -29.8), in front of the garage door (which faces -z toward the street).

**Garage:** detached, behind villa back wall, centered at x=0. 8×3.5×8. Door faces -z (street side). Glowing window for the door.

**Front side (camera default angle):**
- Travertine ground plane → boulders → pool/jacuzzi → daybeds → lanterns → front beach (sand at z=32) → front ocean (z=100) → horizon fog
- Beach loungers (2 umbrella sets + 2 solo chairs) on the front beach

**Street side (orbit around to back):**
- Villa back wall → lawn → garage → driveway → near sidewalk → asphalt road with dashed yellow center line at z=-41 → far sidewalk → 12 cross-street mansions (3 z-bands) → boulevard palms → 5 hill mounds (dark green) at z=-90 to -115 → 7 elevated "houses on hills" perched on the mounds → 80-building Miami skyline at z=-100
- 6 streetlamps along the near sidewalk (pole + arm + warm bulb)
- The skyline + hills + houses on hills give depth to the city background

**Other features:**
- Lagoon (small secondary water with sand + island + mini palm) at (-22, *, 4)
- Various palms scattered through both sides (ground-level only — there's no y-offset addPalm yet)

### Camera (b014, still current in b017)

**Proper orbit camera with drag/wheel/pinch input:**
- `mousedown` starts drag, `mousemove` accumulates yaw/pitch deltas (`ROTATE_SPEED = 0.005`), `mouseup`/`mouseleave` ends drag
- `wheel` event adjusts radius (`ZOOM_SPEED = 0.025`), `preventDefault` so it doesn't scroll the page
- Touch: 1 finger drag = rotate, 2 fingers = pinch zoom
- Spherical orbit math: `position = center + (sin yaw·cos pitch·r, sin pitch·r, cos yaw·cos pitch·r)`
- Center: `(0, 4, -2)`. Initial: `yaw=0, pitch=0.30, radius=26`
- Clamps: `MIN_RADIUS=8`, `MAX_RADIUS=80`, `MIN_PITCH=-0.10`, `MAX_PITCH=1.30`
- `camera.position.y >= 1.0` (never below ground)
- Far plane: 320 (to render the back skyline at z=-100)
- Cursor: `grab` by default, `grabbing` while dragging

---

## 6. Audio / R2 setup

**Bucket:** `cantmute-audio` in Cloudflare R2, region WNAM
**Public URL:** `https://pub-5556ef4db74d499ba3f535afccf8c7be.r2.dev/`
**Files in bucket:** 133 mp3s (the entire `audio-mp3/` folder, uploaded once via the script)

**JS routing:**
- [config.json](config.json) has `"audioBase": "https://pub-5556ef4db74d499ba3f535afccf8c7be.r2.dev/"` field
- [js/player.js:38-44](js/player.js#L38) — `playerAudio.src = (siteConfig.audioBase || 'audio-mp3/') + encodeURIComponent(track.file)` (falls back to local during early init)
- [js/player.js:8-13](js/player.js#L8) — `playerAudio.crossOrigin = 'anonymous'` set BEFORE any src assignment. **CRITICAL** — without this, `createMediaElementSource()` produces zero output and there's total silence even though playback "works." See b011/b012 for the painful debugging history.
- [script.js:186-187](script.js#L186) — admin page audio element ALSO has `crossOrigin = 'anonymous'`. Admin doesn't load config.json, so the R2 URL is hardcoded at [script.js:254](script.js#L254). If you ever change the bucket URL, update both `config.json`'s audioBase AND the hardcoded line in script.js.

**CORS rules** (set via Cloudflare R2 dashboard, not committed — reference copy in [scripts/r2-cors.json](scripts/r2-cors.json)):
- `AllowedOrigins`: `https://cantmute.me`, `https://www.cantmute.me`, plus localhost ports 8000/5500/127.0.0.1 for local dev
- `AllowedMethods`: GET, HEAD
- `AllowedHeaders`: `*`
- `ExposeHeaders`: Content-Length, Content-Type, Content-Range, Accept-Ranges
- `MaxAgeSeconds`: 3600

If audio breaks again, the most likely causes are: CORS rules got cleared, the bucket got renamed, or someone removed the `crossOrigin` line in player.js.

**Upload script:** [scripts/upload-audio-to-r2.sh](scripts/upload-audio-to-r2.sh) — bash script that loops over `audio-mp3/*` and uploads each file via `wrangler r2 object put` with `Content-Type: audio/mpeg`. Idempotent. Requires wrangler installed (`npm install -g wrangler`) + `wrangler login` already done. Run from repo root: `bash scripts/upload-audio-to-r2.sh`.

**`audio-mp3/` is gitignored** (since b011). Local copies stay on disk for backup but never get committed. Repo stays small (<1 MB) so Cloudflare deploys are fast. **Do not commit audio files. Ever.**

---

## 7. Recent build history (b010 → b017)

For full context read [CHANGELOG.md](CHANGELOG.md). Quick summary:

- **b010** — Villa redesign: 2-story stacked white box, cantilever, stone columns, FTG glass, white travertine deck, daybeds, lanterns, boulders. Replaced the old pink-magenta night Miami with the modernist Mykonos look from user reference photos. Render upgraded to 854×480 + 320×180 jitter ("PS2+").
- **b011** — Audio served from R2, audio-mp3/ removed from git history via `git filter-repo`. Deploys went from ~3 minutes (clone hangs) to seconds. Repo dropped from 285 MB to ~1 MB on remote.
- **b012** — CORS hotfix: `crossOrigin='anonymous'` on audio elements. b011 broke audio entirely because `createMediaElementSource()` was producing zeros from the opaque cross-origin source.
- **b013** — Villa expansion: ~2× in every dimension. Lower volume becomes a HOLLOW SHELL (4 walls + floor + ceiling). Front beach + front ocean (no more hard cutout). Back-of-house density: 12 neighbor villas, 100-building skyline.
- **b014** — Camera overhaul (drag/zoom/pinch — was hover-based) + layout flip (back ocean removed, street side added with road/driveway/sidewalks/streetlamps/cross-street mansions/boulevard palms). Garage detached + moved behind villa back wall, door now faces street. Pool 14×4 → 22×6.
- **b015** — Pink Lambo rotated 45° + 2 small shrubs alongside it. addCar refactored into a Group + rotY parameter.
- **b016** — Architecture rework: asymmetric upper stack (2 volumes shifted opposite directions), cylindrical corner tower (first non-rectangular element), 7 stone columns instead of 5, rooftop terrace wall, dramatic 2.8 forward cantilever. Pool circular jacuzzi attached. Hills + 7 houses on hills behind the city. Lambo rotation flipped to -PI/4. Bigger shrub cluster.
- **b017** — Hotfix: cylindrical tower block referenced `windowMat` before its const declaration, threw `ReferenceError` at init. Same code, moved past the declaration line. **`node --check` does NOT catch TDZ errors** — lesson saved to memory.

---

## 8. Pending feedback + open questions

### What the user has confirmed works (post-b014)
- Camera drag + scroll zoom + mobile pinch zoom
- R2 audio playback
- Layout (one side beach, one side street)
- The pool jacuzzi shape addition
- Hills + houses on hills (need to verify post-b017 actually loaded)
- Pink Lambo rotation direction (post b016 flip)

### What's still potentially in question (waiting for user feedback after b017 actually loads)
- Whether the villa NOW reads as "crazy cool miami architecture" (cylindrical tower + asymmetric stack + 7 columns + rooftop terrace)
- Whether the cylindrical tower looks "attached" or "weirdly intersecting" with the villa west wall
- Whether the hills look like terrain or like boxes (used flat-top boxes for cheap hills)
- Whether mobile performance is OK with the increased mesh count

### What the user has explicitly deferred
- **Cars driving on the road** — "eventually would be cool but not needed now"
- **WASD walking / first-person movement** — far future
- **Click → song-card system** — the actual interactivity layer. This is the destination of the entire project. As of b017 it still doesn't exist. When the user is happy with the scene, this becomes the next priority.

### Things I'm not sure about (ASK the user fresh chat, don't guess)
- Whether they want more architecture iteration before moving on to the click→card system
- Whether the "houses on hills" reads correctly or if it needs sloped terrain (not flat-top boxes)
- Whether the rotation/position of the pink Lambo is finally correct
- Whether the rooftop terrace wall is too short (0.9 high) to read

---

## 9. Known gotchas + lessons learned the hard way

### TDZ in world.js (b016 → b017 hotfix)
When adding new mesh blocks to [js/world.js](js/world.js) that use existing materials (`windowMat`, `villaMat`, `roofMat`, `stoneMat`, `coveMat`, `lanternBaseMat`, `boulderMat`, `shrubMat`, `hillMat`, etc.), **grep the `const <name> =` declaration and verify your new code is BELOW it in source order.** ES `const` has a temporal dead zone. `node --check` will pass but the page will crash on init with `ReferenceError: Cannot access 'X' before initialization`.

**Verification habit:** for any build that adds new mesh sections, run `node --check js/world.js` AND tell the user to hard-refresh the deployed page + paste any console errors. node --check is necessary but not sufficient.

### Git commit messages
The user once pasted my plan markdown as a commit message verbatim (commit `013cff9`) and pushed it. **Do not assume the user reads commit messages carefully.** If they say "git commit," YOU run `git commit` with a real conventional message. Don't dump bullet points into the commit body.

### Force push protocol
Force push to main/master is destructive. b011's `git filter-repo` history rewrite required `git push --force-with-lease`. The user explicitly approved it. **Always use `--force-with-lease`, not `--force`.** Always create a backup branch first. Don't delete the backup until the post-push deploy is verified working.

### Layout collision
Every time the villa or pool grows, props (lambo, lanterns, daybeds, boulders, path lights, lagoon, beach chairs) get swallowed and need repositioning. **When changing villa or pool dimensions, check every prop position against the new bounding boxes.** This has been done painfully across b013, b014, b016. There's no automated check.

### Sky shader temporal dead zone — same TDZ trap, different file
Same lesson as world.js. When adding new shaders or materials to the init function in any file, declaration order matters.

### Cloudflare deploy hangs
Pre-b011, the repo was 285 MB (due to tracked audio files) and Cloudflare Pages occasionally hung in the clone step. b011 fixed this by moving audio to R2 + filter-repo + force push. Repo is now ~1 MB. If deploys hang again, check: (1) Cloudflare status page, (2) repo size, (3) any large file accidentally committed.

---

## 10. First steps for a fresh chat

1. **Read this file completely.** Then read [CLAUDE.md](CLAUDE.md), then [FILE_MAP.md](FILE_MAP.md), then the most recent 2-3 entries in [CHANGELOG.md](CHANGELOG.md).
2. **Check memory files** at `C:\Users\B4TTL\.claude\projects\c--Users-B4TTL-musicportfolio\memory\` — read `MEMORY.md` index first, then any referenced files.
3. **Run `git log --oneline -10`** to confirm where we are and what's been shipped recently.
4. **Run `git status`** to check for any uncommitted changes.
5. **Greet the user with brief acknowledgment** that you've loaded context from the handoff doc — don't dump everything you read, just confirm you know where things stand.
6. **Ask the user where they want to pick up.** Don't assume — they may have shipped more changes since this doc was written, or have new feedback, or want to switch direction entirely.

---

## 11. Files to know (quick reference)

| File | Purpose |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Workflow rules — MANDATORY reading |
| [FILE_MAP.md](FILE_MAP.md) | Architecture overview, current build, file responsibilities |
| [CHANGELOG.md](CHANGELOG.md) | Per-build entries, newest at top |
| [HANDOFF.md](HANDOFF.md) | This file |
| [config.json](config.json) | Site config + tracks list + R2 audioBase |
| [js/helpers.js](js/helpers.js) | `BUILD_NUMBER` const — bump every build |
| [js/app.js](js/app.js) | View router, config loader, shared state |
| [js/player.js](js/player.js) | Audio playback (R2-routed) |
| [js/world.js](js/world.js) | Villa view — the hero, ~1554 lines |
| [scripts/upload-audio-to-r2.sh](scripts/upload-audio-to-r2.sh) | Re-upload audio to R2 if needed |
| [scripts/r2-cors.json](scripts/r2-cors.json) | CORS policy reference (set via dashboard) |

---

## 12. If something is on fire

- **Audio broken on prod:** check console for CORS errors. Verify [js/player.js](js/player.js) has `crossOrigin = 'anonymous'`. Verify CORS rules still set on the R2 bucket via dashboard.
- **Villa view crashes on init:** check console for `ReferenceError`. Most likely a TDZ issue with declaration order in world.js (see section 9).
- **Deploy hung in clone step:** check Cloudflare status page. Check repo size (`git count-objects -vH`). Probably transient — retry in a few minutes.
- **Page won't load anything:** check `js/helpers.js` for syntax error. The whole site bootstraps from `window.BUILD_NUMBER` being defined.
- **User says "everything is broken":** ask for the actual console errors before guessing. Don't roll back commits unless the user explicitly asks.

---

End of handoff. Future Claude: you got this. The user is patient when you understand context; they get frustrated when you guess. Read first, ask second, code third.
