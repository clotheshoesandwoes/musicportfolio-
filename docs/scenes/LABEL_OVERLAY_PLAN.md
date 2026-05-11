# LABEL_OVERLAY_PLAN — debug ID labels for `/scenes`

**Scope:** `/scenes` only. Single file: [js/scenes-selector.js](../../js/scenes-selector.js). Bump `s12 → s13` per [docs/scenes/FILE_MAP.md](FILE_MAP.md) rules.

**Status:** plan, not built. Ship in one focused pass — no other changes.

---

## Goal

When the user appends `?labels=1` to `http://localhost:8000/scenes/` (or presses **L** in-scene), every named object renders a floating text sprite above it showing its object ID. The user screenshots that view, drops it in chat, and the next session can resolve "the building on the road" → `organism_billboard` instantly. **No more guessing from descriptions.**

This is the smallest piece of [BASEMAP.md](../../BASEMAP.md) v2 ground-truthing — debug labels first, full manifest later.

---

## Approach (3 pieces)

### 1. Naming convention (one-time pass over the file)

Every distinctive object gets `obj.name = '<id>'` set at construction. IDs come from BASEMAP.md (`host kind` column is the canonical source — they already match): `missile_silo`, `comms_array_shed`, `forward_ops_radar`, `sigint_tower`, `logistics_yard`, `broken_dish`, `sensor_pylon`, `biostation_quarantine`, `back_billboard_lattice`, `rail_kiosk_left`, `rail_kiosk_right`. Plus any other discrete props worth labeling (Pelican, Scorpion, watchtowers, tents).

**Where:** `_buildPanelHost(kind, ...)` at line ~4735 builds and returns a group per panel-host kind — set `grp.name = kind` right before it gets added to the scene. For non-panel structures (Pelican, watchtowers, scorpions, fuel depot, antenna array, etc.), set `.name` on the top-level group inside each `_build*` method before `_placeBuilding(grp, ...)` is called.

Already-named objects in the file: **none** (verified — `grep '\.name\s*=' js/scenes-selector.js` returns 0 matches). This is a fresh pass.

### 2. Label overlay subsystem

Add three methods + one state field to the `ScenesSelector` object:

- **State:** `this.labels = { enabled: false, sprites: [] }` in `init()` near the other state fields (~line 134).
- **`_buildLabels()`** — call once at the end of `init()`, after every `_build*` method has registered its named objects. Walks `this.scene` with `.traverse()`, and for every node with a non-empty `.name` that isn't a built-in THREE pattern (skip names starting with `Mesh_`, `Group_`, default ones), creates a `THREE.Sprite` with a canvas-texture label showing `node.name`, parented to the node, positioned at `+Y` above the node's bounding-box top, scaled so it reads at scene fog distance (~3-6u tall sprite). Push to `this.labels.sprites`. Set `sprite.visible = this.labels.enabled`.
- **`_setLabelsEnabled(on)`** — set `this.labels.enabled = on`, walk `this.labels.sprites`, set each `.visible = on`.

**Canvas texture helper (inline, no new file):** 256×64 canvas, transparent background, 1u dark pill behind text, white sans-serif text, mip filtering off (`tex.minFilter = THREE.LinearFilter`). Sprite material: `transparent: true, depthTest: false` (labels float above the world, never occluded — that's the point). One-time creation, cached per unique label string in a `Map` so we don't rebuild canvases for repeat IDs.

**Bounding-box anchor:** for each named node, compute `new THREE.Box3().setFromObject(node)` once at registration time, attach the sprite at `(0, box.max.y - node.position.y + 1.5, 0)` in the node's local space (so the label hovers ~1.5u above the top of its visual bounds).

### 3. Activation surface

- **Query param:** in `init()`, parse `new URLSearchParams(location.search).get('labels')` — if `=== '1'`, set `this.labels.enabled = true` BEFORE `_buildLabels()` runs (so sprites spawn already-visible).
- **Key toggle:** `_onKey` already exists at line ~225 (referenced as `this._onKey`). Find the handler, add a branch for `e.key === 'l' || e.key === 'L'` → `this._setLabelsEnabled(!this.labels.enabled)`. Don't break existing key handling.
- **HUD hint:** the HUD chip built by `_buildHud()` (called at line 153) — append a tiny line at the bottom: `[L] labels: off` / `[L] labels: on`, updated by `_setLabelsEnabled`. If the HUD doesn't have a slot for this, add a small absolutely-positioned `<div class="ss-labels-hint">` in `_buildHud()` and update its textContent in `_setLabelsEnabled`.

### 4. Cleanup

In `destroy()` at line ~9784, dispose label canvas textures + materials and clear `this.labels.sprites = []`. (THREE doesn't auto-dispose textures.)

---

## Files touched

- `js/scenes-selector.js` — naming pass + 3 new methods + `init` wiring + `_onKey` branch + HUD hint + `destroy` cleanup.
- `js/builds/scenes.js` — bump `s12` → `s13`.
- `docs/scenes/FILE_MAP.md` — update `**Build:**` and `**Updated:**`.
- `docs/scenes/CHANGELOG.md` — new entry at top: `s13 — Debug label overlay (?labels=1 / L key)`.

**Do not touch:** any `_build*` body beyond setting `.name`. Do not "improve" geometry while you're in there. Do not add labels to instanced meshes (skip `InstancedMesh` types — labels per particle is wrong).

---

## Validation (mandatory before saying "done")

1. `cp js/scenes-selector.js c:/tmp/sc.mjs && node -c c:/tmp/sc.mjs` → must pass. `node --check` on the original `.js` silently misses raw-backtick template-literal errors.
2. Open `http://localhost:8000/scenes/` (no query) → labels off, scene unchanged.
3. Open `http://localhost:8000/scenes/?labels=1` → labels visible above every named object. Take a screenshot. Verify labels read clearly at default zoom and don't z-fight (depthTest: false handles this).
4. Press **L** → labels toggle off. Press **L** again → back on. HUD hint reflects state.
5. Click a panel to focus, then ENTER to navigate to `play.html` → no console errors (cleanup path works).

If you can't read a label at fog distance, double the sprite scale; don't shrink the fog. The fog is part of the look.

---

## Why this design (so future-you can judge edge cases)

- **Sprite over CSS overlay:** sprites stay glued to world objects through orbit/zoom for free. CSS would require per-frame screen-space projection.
- **`.name` over a parallel registry:** every THREE node already has a `.name` slot. Using it means `scene.traverse()` is the registry — no second source of truth to drift.
- **`depthTest: false`:** labels are debug UI, not part of the world. They should always read, even through walls.
- **Query param + key toggle:** query param lets the user share a labeled URL with the next chat; key toggle lets them flip during a session without reloading.

---

## Out of scope (do NOT do these in s13)

- Auto-generated `SCENE_MANIFEST.json` (the next layer — separate plan, separate build).
- Tagging convention via `// @obj id=... kind=... panel=...` comments (only needed once we build the manifest generator).
- A "scenes-spatial" skill (depends on the manifest existing first).
- Labeling unnamed clutter (drums, sandbags, individual fence posts). Only named structures.

Land s13. Screenshot. Then we decide whether the manifest layer is still needed.
