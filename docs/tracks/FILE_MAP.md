# TRACKS — file map

**Scope:** the catalog at `/tracks` (and `/tracks/new`, `/tracks/playlists`). Ableton-faithful Session view — year-keyed lanes of "clips" (one per track), sticky MASTER pane with spectrum analyzer, transport bar, filter chips, ARRANGEMENT timeline view. Mounts inside the same `index.html` shell as the galaxy.

**Build:** t8
**Updated:** 2026-05-10

## Scope-owned files (this chat freely edits these)
- [js/tracks-daw.js](../../js/tracks-daw.js) — the entire DAW view. Mounts as `window.TracksDaw = { init, destroy, setFilter, setQuery, onTrackChange }` and is booted by `index.html`'s `bootTracksDaw()`. Owns: top bar (brand + SESSION ↔ ARRANGEMENT tabs + search + count), per-clip cells (golden-ratio hue stripe + tier-tint + procedural waveform thumbnail + launch button + meta), MASTER pane (now-playing + 64-bar spectrum + L/R level meters + actions), transport bar, filter chip band, keyboard shortcuts, ARRANGEMENT view (t5 "Discography Tape" — single horizontal row of full-waveform blocks sorted oldest→newest with sqrt-scaled time gaps + sticky orange year markers + per-block progress bar + sweeping playhead).
- [js/builds/tracks.js](../../js/builds/tracks.js) — `window.BUILD_TRACKS` constant displayed in the DAW HUD.
- [docs/tracks/CHANGELOG.md](CHANGELOG.md) — tracks build history (t1 onward).
- [docs/tracks/FILE_MAP.md](FILE_MAP.md) — this file.

## Shared files used (do NOT edit casually — coordinate)
- `js/player.js` — audio engine. Tracks reads `audio.__floorAnalyser` for the spectrum analyzer + L/R meters. **Visual changes go in tracks-daw.js, NOT here.**
- `index.html` — page shell. `bootTracksDaw()` lives here (lines ~3618-3649). Edit only if you're changing the boot wiring or the SPA route registration.
- `config.json` — track data. Adding/editing tracks = data change, not code change.
- `style.css` — global stylesheet. DAW CSS is inlined in `tracks-daw.js`'s build phase.

## Legacy / revert path
- [js/tracks-vault.js](../../js/tracks-vault.js) — the b146/b200 WebGL Tracks Vault (helix spire) that the DAW replaced in b206. Left intact for revert. Still references the old `window.BUILD_NUMBER` (will read empty post-split — acceptable for a deprecated path).

## Always do these (every tracks code change)
1. Bump `window.BUILD_TRACKS` in [js/builds/tracks.js](../../js/builds/tracks.js) (format `t###`).
2. Update the `**Build:**` and `**Updated:**` lines at the top of this file.
3. Add a CHANGELOG entry at the top of [docs/tracks/CHANGELOG.md](CHANGELOG.md) — quote the user's request, explain what changed and why, list files touched.
4. Validate before shipping: `cp js/tracks-daw.js c:/tmp/td.mjs && node -c c:/tmp/td.mjs`.

## Architecture summary
- Tracks-daw.js is loaded via a timestamped dynamic `<script>` injection (b222 cache-bust pattern) so Vivaldi/Chrome don't serve stale modules during dev iteration.
- Three views in one: SESSION (clip grid), ARRANGEMENT (timeline), and a focus state when a clip is selected.
- Audio analyser piggybacks the cached `audio.__floorAnalyser` from `js/player.js` — no second AudioContext.
- Filter chips collapse non-matching clips. The `new` chip pushState's `/tracks/new`; others normalize to `/tracks`.
- Keyboard: Space=play, R=shuffle, ←/→=year column, ↑/↓=step within year, Enter=launch, Esc=clear.
