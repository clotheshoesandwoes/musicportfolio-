# FILE MAP — cantmute.me (Kani music portfolio)

**Frozen at b242. Per-scene FILE_MAPs and CHANGELOGs live in `docs/`.** This file is the slim cross-scene overview only.

> **Per-scene docs (read these for daily work):**
> - Galaxy (`/`) → [docs/galaxy/FILE_MAP.md](docs/galaxy/FILE_MAP.md) + [docs/galaxy/CHANGELOG.md](docs/galaxy/CHANGELOG.md)
> - Tracks (`/tracks`) → [docs/tracks/FILE_MAP.md](docs/tracks/FILE_MAP.md) + [docs/tracks/CHANGELOG.md](docs/tracks/CHANGELOG.md)
> - Scenes (`/scenes`, `/scenes/play.html`) → [docs/scenes/FILE_MAP.md](docs/scenes/FILE_MAP.md) + [docs/scenes/CHANGELOG.md](docs/scenes/CHANGELOG.md)

## Routes
- `/` → **Galaxy** — text-galaxy WebGL scene, mounts `MarathonWorld` from `js/marathon-world.js`. See [docs/galaxy/](docs/galaxy/).
- `/world` → alias of `/`.
- `/tracks` → **Tracks DAW** — Ableton-faithful Session view, mounts `TracksDaw` from `js/tracks-daw.js`. See [docs/tracks/](docs/tracks/).
- `/tracks/new` → tracks DAW with `state.filter = 'new'`.
- `/tracks/playlists` → saved + shared playlists.
- `/t/<slug>`, `/p/<slug>`, `/a/<slug>`, `/ep/<slug>` → individual track / playlist / album / EP pages (rendered inside `index.html`).
- `/scenes` → **Scene selector** — military-base observation deck, mounts `ScenesSelector` from `js/scenes-selector.js`. See [docs/scenes/](docs/scenes/).
- `/scenes/play.html` → legacy 3D scene app (Villa / Neural / Deep Sea / Terrain / Living Wall etc.).
- `/corridor.html`, `/object.html`, `/halo.html` → standalone scene experiments. Independent of `index.html`'s router; not in active iteration scope.

Rewrites are declared in `_redirects` (Cloudflare static-asset redirects). All rewrites use status 200 so the URL stays clean.

## Local dev
- [serve.py](serve.py) — Python dev server that mirrors `_redirects` rewrites so `/tracks`, `/t/<slug>`, etc. fall back to `index.html` locally. Run: `python serve.py` (default port 8000).

## Per-scene build constants (post-b242 split)
- [js/builds/galaxy.js](js/builds/galaxy.js) → `window.BUILD_GALAXY` (read by `index.html`'s galaxy boot).
- [js/builds/tracks.js](js/builds/tracks.js) → `window.BUILD_TRACKS` (read by `index.html`'s tracks boot).
- [js/builds/scenes.js](js/builds/scenes.js) → `window.BUILD_SCENES` (read by `scenes/play.html`).

Each constant lives in its own file so parallel chats don't race on the build number. The HUD chip in each scene reads its own constant.

## Shared files (touch with care — coordinate across chats)
- [js/player.js](js/player.js) — **SHARED AUDIO ENGINE.** Consumed by every scene. UI changes belong in the consuming view file (`marathon-world.js` / `tracks-daw.js` / scenes' own JS). Audio-engine changes need to be tested against ALL THREE scenes before shipping.
- [config.json](config.json) — track data + featured/new curation lists. Read by every scene. Adding/editing tracks = data change.
- [index.html](index.html) — page shell. Hosts the SPA router that boots both `MarathonWorld` (`/`) and `TracksDaw` (`/tracks`). Edit only when changing boot wiring or adding routes.
- [_redirects](_redirects) — Cloudflare rewrites. Edit only when adding routes.
- [serve.py](serve.py) — local dev server. Mirrors `_redirects` so SPA routes resolve locally. Edit only when adding routes.
- [style.css](style.css) — global stylesheet. Most scenes inline their own HUD CSS; only edit this for cross-scene chrome.
- [CLAUDE.md](CLAUDE.md) — workflow rules. Edit when changing the convention itself.

## Design references (background, not daily-edit)
- [STYLEGUIDE.md](STYLEGUIDE.md) — Text Galaxy aesthetic codified (palette, typography, components, rollout priority).
- [VISION.md](VISION.md) — design bible (project vision, art direction, scope).
- [HANDOFF.md](HANDOFF.md) — fresh-chat catch-up.
- [BASEMAP.md](BASEMAP.md) — `/scenes` military-base floor plan v2 (scenes-specific spec).
- [SCENES_HANDOFF.md](SCENES_HANDOFF.md) — `/scenes` redesign thread catch-up.
- [THEME.md](THEME.md) — historical Beta Decay reference (NOT current direction).

## Architecture (cross-cutting)
- Vanilla JS, no build step. Multi-view single-page site.
- Three.js loaded from `unpkg.com` ESM CDN — no bundler.
- Audio playback + frequency data in `js/player.js` (`getFrequencyData()` shared with views, analyser cached on `audio.__floorAnalyser`).
- Cover art pipeline: `covers/<slug>.{jpg,jpeg,png,webp}`; falls back to procedural gradient if no file matches.
