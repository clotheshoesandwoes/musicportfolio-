# CLAUDE.md

## Mode

I'm in auto mode 90% of the time. **Execute, don't ceremony.** No "here's the diff, want me to proceed?" — read the files, do the work, report what changed. Ask one question only if the request is genuinely ambiguous (and even then, propose a default and tell me you'll proceed unless I object).

When I say "yes" / "do it" / "push" / "go" — execute, don't repeat the plan back at me.

## Don't touch what I didn't ask about

- No "improving" unrelated code while you're in there.
- No refactoring on the side.
- No features I didn't ask for.
- If you spot something broken outside scope, mention it at the END of your message — don't fix it.
- One ask = one focused change. Don't bundle.

## Per-scene split (post-b242)

Each scene has its own scope, its own build number, its own changelog. Parallel chats run truly in parallel as long as each chat sticks to its own scope. **Figure out which scene you're working on first.**

| Scope | Code | Build constant | Docs |
|---|---|---|---|
| **Galaxy** (`/`) | `js/marathon-world.js` | `js/builds/galaxy.js` → `window.BUILD_GALAXY` (`g###`) | [docs/galaxy/](docs/galaxy/) |
| **Tracks** (`/tracks`) | `js/tracks-daw.js` | `js/builds/tracks.js` → `window.BUILD_TRACKS` (`t###`) | [docs/tracks/](docs/tracks/) |
| **Scenes** (`/scenes`) | `js/scenes-selector.js` | `js/builds/scenes.js` → `window.BUILD_SCENES` (`s###`) | [docs/scenes/](docs/scenes/) |

## Always do these (every code change in your scene's scope)

1. Bump `window.BUILD_<SCENE>` in `js/builds/<scene>.js` (format `g###` / `t###` / `s###`).
2. Update the `**Build:**` and `**Updated:**` lines at the top of `docs/<scene>/FILE_MAP.md`.
3. Add a CHANGELOG entry at the **top** of `docs/<scene>/CHANGELOG.md` (newest first) — quote the user's request, explain what changed and why, list files touched.
4. Read `docs/<scene>/FILE_MAP.md`, the most recent few `docs/<scene>/CHANGELOG.md` entries, and the actual file before editing.

If a hook or another session has already bumped your scene's build, bump again to the next number rather than overwriting.

## Shared files — DO NOT touch casually

These files are consumed by every scene. Visual changes belong in *your* scene's view file, not here. If a shared file genuinely needs a change, coordinate across chats first:

- **`js/player.js`** — SHARED AUDIO ENGINE. Every scene reads `audio.__floorAnalyser` from it for bass-reactive shaders / spectrum bars. UI changes go in the consuming scene file (`marathon-world.js` / `tracks-daw.js` / scenes' own JS). Engine changes need to be tested against ALL THREE scenes before shipping.
- **`config.json`** — track data + featured/new curation. Read by every scene.
- **`index.html`** — page shell that hosts both galaxy and tracks. Edit only when changing boot wiring or adding routes.
- **`_redirects`, `serve.py`** — server config. Edit only when adding routes.
- **`style.css`** — global stylesheet. Most scenes inline their own HUD CSS.
- **`FILE_MAP.md` (root)** — slim cross-scene route table + pointers. Edit when adding routes or new shared infrastructure.
- **`CHANGELOG.md` (root)** — frozen at b242. Don't add new entries — they go in per-scene CHANGELOGs now.
- **`CLAUDE.md`** — workflow rules. Edit when changing the convention itself.

## Code quality

- **Verify before reporting done.** Validate the JS module before shipping: `cp <file>.js c:/tmp/<x>.mjs && node -c c:/tmp/<x>.mjs`. `node --check` on the original file silently passes raw-backtick template-literal errors that crash the browser. If no checker exists, say so explicitly — don't pretend.
- Write what three experienced devs would all write the same way. No robotic comment blocks, no corporate prose, no decorative section headers.
- One source of truth. Never duplicate state to paper over a display bug — find the one source and read from it everywhere.
- Don't over-engineer. Simple and correct beats elaborate and speculative.

## When stuck

- Two failed attempts → stop. Re-read the relevant section top-down. Tell me where your mental model was wrong before trying again.
- "Step back" or "we're going in circles" → drop everything, rethink from scratch.

## My shorthand

- A pasted reference (link, screenshot, code block) is the spec. Match it. My English description is a hint; the reference is the source of truth.
- "Paste the console output" — when I report a bug with no output, I'll grab logs. Trace the actual error from the raw data, don't pattern-match on my description.
- Screenshots = ground truth for visuals. If I show you a layout problem, the pixels in the screenshot beat any description I wrote.

## Local dev

`python serve.py` (port 8000) — handles SPA route rewrites that `python -m http.server` 404s on. Don't push to Vercel during iteration unless I explicitly ask. (Repo deploys to Cloudflare Pages, not Vercel — auto-deploys on push.)

## Project layout pointers

- [FILE_MAP.md](FILE_MAP.md) — slim cross-scene overview (routes, shared files, pointers).
- [docs/galaxy/](docs/galaxy/), [docs/tracks/](docs/tracks/), [docs/scenes/](docs/scenes/) — per-scene FILE_MAPs + CHANGELOGs (read these first when working on that scene).
- [STYLEGUIDE.md](STYLEGUIDE.md) — current Text Galaxy aesthetic (palette, typography, components).
- [VISION.md](VISION.md) — design bible: project vision, art direction, scope.
- [HANDOFF.md](HANDOFF.md) — fresh-chat catch-up.
- [BASEMAP.md](BASEMAP.md), [SCENES_HANDOFF.md](SCENES_HANDOFF.md) — `/scenes`-specific spec + thread catch-up.
- [THEME.md](THEME.md) — historical Beta Decay reference, **not** current direction.
- [CHANGELOG.md](CHANGELOG.md) — frozen pre-split history (b001–b242). New entries go in per-scene CHANGELOGs.
