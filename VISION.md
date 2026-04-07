# VISION — cantmute.me (Kani's interactive 3D music portfolio)

**For:** future Claude Code sessions, future Kani revisions
**Created:** 2026-04-07 (b024)
**Read this when:** starting a fresh chat, when a build feels off-direction, when adding any "rich" feature, when designing the click→card system

This is the design bible. CLAUDE.md = workflow rules, HANDOFF.md = current state, CHANGELOG.md = build history. **VISION.md = where we're going and why.**

---

## 1. What this project is

Kani's music portfolio, but built as an explorable 3D world instead of a tracklist page. Visitor lands on the site, drops into a Miami villa scene, orbits the camera around the property, and clicks on objects to reveal songs. Click a record player → "Track 03 — Night Drive" card pops up with a play button. Click a Lambo → another song. Click a yacht in the ocean → another. The scene IS the navigation.

**Status as of b024:** scene buildout phase. Click→card system not built yet. Camera + audio routing + scene density are the prerequisites.

---

## 2. The reference: drakerelated.com

Drake's site is the closest thing to what Kani's portfolio is becoming. **Read it before designing anything.** Key things it does:

- **Lived-in luxury world.** Photorealistic isometric renders of his actual mansion: front yard with cars, bedroom, closet, lounge, "Air Drake" private jet. Each room is a destination.
- **Click hotspots on props.** Small white dots on objects. Click them and product cards pop up — sneakers in the closet → "Air Drake Air Max", hoodie on the bed → "Views Hoodie", etc. Drake's payload is merch. Ours is songs.
- **Discrete rooms, menu nav.** Bottom-left text menu lists ~11 named rooms (`Front / Studio / Lounge / Bedroom / Closet / El Chico Studios / Air Drake / Pool / Kitchen / Court / Garage`). You click a room name and it cuts to that scene.
- **Heavy prop density.** Look at his closet — sneakers stacked 3-deep on shelves, scattered shopping bags, mannequins, sunglasses, drawers half-pulled, a clothing rack with hoodies hanging. Every surface earns its spot. **The luxury feel comes from density, not from giant rooms.**
- **Cinematic lighting.** Warm interior window glow spilling onto outdoor surfaces, dramatic shadows, subtle vignettes. The mood does as much work as the geometry.
- **Static camera per scene.** Drake's site is photoreal pre-rendered images with click overlays. The camera doesn't move within a scene.

## 3. How Kani's site is different

| Drake's | Kani's |
|---|---|
| Pre-rendered photorealistic CGI | Real-time WebGL (Three.js, no build step) |
| Photoreal Octane-style renders | **PS2-era chunky pixel aesthetic** (intentional) |
| Static camera, one fixed angle per room | **Free orbit camera** — drag/zoom/pinch from any angle |
| ~11 discrete rooms, menu jumps | **One continuous mega-villa** (so far) — beach, pool, garage, garden, showroom all in the same scene |
| Click-hotspot dots overlaid on flat image | **Raycaster-based click targets** anchored to 3D world positions, follow as you orbit |
| Merch product cards | **Song cards** with play buttons, audio from R2 |
| Interior + exterior rooms equally featured | **Exterior is the hero**, interior shell is mostly empty for now |

The free orbit camera is **the differentiator**. Drake's site can't do it. Don't break it.

---

## 4. Art direction

### The PS2 sweet spot

The aesthetic identity is "PS2-era 3D Miami villa at dusk." Not photoreal. Not modern stylized. **PS2.** Think Gran Turismo 3, Vice City, ICO. Chunky pixels, low-poly geometry, vertex jitter, limited shader complexity, intentional jankiness as charm.

Currently the render pipeline is `854×480 + 320×180 vertex jitter` ("PS2+"). User feedback as of b024: **this overshot.** It reads as "ugly Roblox" instead of "PS2 nostalgia." The pixels are too crisp for the polygon density. Needs to be dialed back toward authentic PS2 chunkiness. **Open question — see section 9.**

### The luxury rule (the b023 garden lesson)

When the user asks for a "rich" or "luxury" feature, the failure mode is to build a small, sparse, abstract version with ≤10 props and call it done. **That's not luxury, that's a sketch.** A real luxury feature has:

- **≥20 props of varied types.** Not 4 boxes called "flowers." Real plants, real flowers, real benches, real statues, real planters. Density > size.
- **Color variety.** No single-mat sections. Use the bright luxury palette (see below). The dusk Miami scene has cool tones (indigo, magenta, cyan); luxury features should add warm and saturated counterpoints (bright green lawns, magenta bougainvillea, white marble, warm pathway lights).
- **Hardscape + softscape balance.** Marble paths, fountains, statues, benches (hardscape) + plants of varied species and scales (softscape). Both, not one or the other.
- **Multiple scales.** Big centerpiece (3-tier fountain, grand statue, ornate gazebo) + medium accents (topiary, urns, benches) + small details (flowers, lanterns, scattered props).
- **A centerpiece visible from the camera default angle.** Without one, the feature reads as "ground clutter" instead of "look at this."

**Rule of thumb:** if you can list every prop in the feature on one hand, it's not luxury yet.

### The fog & color palette discipline

The scene has heavy `FogExp2` (cool indigo `0x40285a`) that crushes any dark color at z > 50. **Dark greens, dark blues, dark anything that should "recede" instead get killed entirely.** Two structural rules:

1. **Anything beyond z=40 needs bright/saturated mat colors.** Hills (z=-85 to -120), back ocean, distant skyline. Dark greens get eaten. Use mid-to-bright greens (`0x4a7a30` or brighter), or rose-tinted distance for atmospheric perspective.
2. **Greens should be brighter than instinct says.** A "natural" dark forest green (`0x2a4a25`) reads as "black blob" after fog. The new b024 palette uses `0x5a8c38` for lawns, `0x4a7a30` for shrubs/hedges, `0x3a6028` for topiary. Fog-tested.

### Current palette (b024+)

| Mat | Hex | Used for |
|---|---|---|
| `villaMat` | `0xeeeae0` | white plaster exterior |
| `villaMat2` | `0xece4d0` | warmer plaster (top floor box) |
| `marbleMat` | `0xf6f1e4` | luxury white marble (paths, fountains, statues, planters) |
| `rimMat` | `0xe8e4dc` | lighter slab edges |
| `roofMat` | `0xe0dcd0` | thin roof slabs |
| `villaInteriorMat` | `0xddd6c8` | warmer interior plaster |
| `floorInteriorMat` | `0xc9c2b2` | warm travertine floor |
| `stoneMat` | `0x8a847a` | natural stone (columns, statues) |
| `podiumMat` | `0x6f6960` | darker travertine plinth |
| `boulderMat` | `0x6a6560` | gray boulders |
| `lawnMat` | `0x5a8c38` | bright manicured lawn |
| `shrubMat` | `0x4a7a30` | manicured shrubs/hedges |
| `topiaryMat` | `0x3a6028` | clipped topiary |
| `bougainvilleaMat` | `0xd83080` | magenta blooms (Miami villa signature) |
| `roseMat` | `0xc02030` | deep red roses |
| `lavenderMat` | `0x9468d0` | purple lavender |
| `windowMat` | `0xffd55a` (emissive) | warm interior glow |
| `lanternGlowMat` | `0xffd090` (emissive) | warm lantern glow |
| `ledMat` | `0x80f0ff` (emissive) | cyan LED accents |
| `coveMat` | `0xffd090` (emissive) | recessed cove lights |
| `poolMat` | shader | pool water + fountain water (caustic shimmer) |
| `oceanMat` | shader | front ocean |
| `hillMat` / `hillMat2` / `hillMat3` | various greens + rose | hills (b021 fix, still under review) |

When adding a feature: **first check this table for an existing mat that fits, then add a new one only if no existing mat works.** Don't reinvent. But if the existing mat is wrong-tone for the feature (e.g. dark green for a luxury garden), introduce a new bright variant — don't just live with the wrong color.

---

## 5. Scene density direction

Currently the scene is exterior-heavy and interior-empty. Density priorities going forward:

**Highest priority — needs more density:**
- **Front yard / lawn area** between deck and beach. Currently sparse. Statues + palms + maybe garden beds + benches + sculptures.
- **Pool deck props** — daybeds + lanterns + boulders exist but feel sparse for a luxury pool. Add: cabanas, towel stacks, pool floats, side tables, drink trays, bar cart.
- **Beach beyond the umbrellas** — a few chairs + 2 umbrellas. Could use: more loungers, fire bowls, a beach volleyball net, a parked yacht-tender at the pier, wet footprints in the sand.
- **Interior of villa lower volume** — completely empty. This is also the click→card prep zone (see section 6). Needs: piano, sofas, art on walls, a record player, bar, fireplace, sculptures, books.

**Medium priority:**
- **Garage/driveway** — has yellow Lambo + the new showroom. Add: vintage cars, oil cans, tools, neon "garage" sign.
- **Back lawn** (street side) — has road + neighbor mansions. Add: tennis court, helipad, putting green, hedges.

**Lower priority:**
- **Hill villas + hill terrain** — visible at distance, less interactive. Polish later.
- **Distant skyline** — already has the 80-building dot grid.

---

## 6. Click → card system design

The destination interaction loop. Not built yet. Design intent:

### What clicks
- **Both interior and exterior props** are valid click targets. The Drake reference has interior-heavy clicks; we go heavier on exterior because exterior is our hero. (See `memory/project_clickable_props_scope.md`.)
- **Specific prop instances**, not whole groups. Click the pink Lambo, not "the lambo Group node." Each clickable prop maps to ONE track.
- **Built as named THREE.Group nodes** going forward (already doing this in b022+). The raycaster will walk up the parent chain to find the named node and look up its track.

### How it looks
- **Subtle highlight, not loud markers.** Drake's site uses small white dots on hover/load. Kani's should be even more subtle — clickable props get a faint emissive pulse, or a soft outline glow on hover, or a tiny floating icon above them. **The user said: "we can just sort of gently highlight items that have music to them."** Don't pollute the scene with bright UI dots. The whole point of the orbit camera is that the world is the experience — don't break that with overlays.
- **Cursor change on hover** — `pointer` cursor when hovering a clickable prop, `grab`/`grabbing` everywhere else.
- **Card UI:** screen-anchored modal popping from the lower-center or side, with track title, artwork, play/pause button, prev/next, scrubber. NOT a 3D billboard floating in the world (too hard to read at PS2 resolution).

### How it wires up
- One **prop→track lookup table** in JS. Each entry: `{ propName, trackIndex, displayName }`.
- A `THREE.Raycaster` instance in the click handler. On click, intersect against `scene.children`, walk up parents until we find a node whose `.name` matches a propName in the lookup, then call `playTrack(trackIndex)` from `js/player.js` and show the card.
- Audio playback already works via R2 (see HANDOFF.md section 6). Don't touch that — just call `playTrack(i)`.
- Cards can dismiss on outside-click or X button. Audio keeps playing across dismissals.

### Open: how many click targets
Drake's site has ~5–15 clickable props per room across ~11 rooms = 50–150 total. Kani's is one big scene → target ~20–40 click targets to start, mapped to the existing track list in `config.json`. Some will be obvious (lambos, yachts, fire pit, fountain, statues, surfboards) and some will live in the eventual interior buildout (piano, record player, bar, art).

---

## 7. Camera principles

- **Orbit is sacred.** Drag/scroll/pinch as built in b014. Don't switch to fixed angles. Don't gate it behind a "tour mode."
- **Smooth fly-to-prop on click** would be a nice-to-have later. When you click a prop, the camera glides to a flattering angle of that prop while the card pops up. Optional. Don't lose orbit.
- **Default angle** (yaw 0, pitch 0.30, radius 26, center `(0, 4, -2)`) should always show the villa front + pool. Don't break it when adding props.
- **Far plane = 320** so distant skyline at z=-100 renders. Don't shrink it.

---

## 8. Out of scope (don't propose these)

- **WASD walking / first-person.** Not happening for the foreseeable future. Orbit is the camera.
- **Audio reactivity.** The frequency hooks exist in `getFrequencyData()` but nothing in the villa view consumes them yet. Could add later (lights pulse with bass, etc.) — not before click→card system.
- **Multi-room scene split.** Tempting because Drake's does it, but losing the continuous orbit world is a bigger cost than the gain. Keep one mega-scene, name internal areas if needed.
- **Photoreal upgrade.** Don't propose Octane-style lighting, normal maps, GI, real shadows. The PS2 chunky aesthetic is the identity.
- **Generic UI improvements** unless asked.

---

## 9. Open questions / decisions pending

These need user input before next-level work:

1. **Art style dial-back.** Current `854×480 + 320×180` reads as "ugly Roblox." Proposed fix: drop render target to `480×270` (true 16:9 PS2-era) AND coarsen the vertex jitter grid to match. Risk: can't preview without committing. Needs sign-off + likely 1–2 iterations.
2. **Showroom cars.** b023 ships generic red/blue/orange boxes. User wants a yellow Mercedes G-Wagon, a Corvette, and "something crazy" (F1 car? Cybertruck? Aventador?). Pending: car designs + new helpers (`addGWagon`, `addCorvette`, etc.) since `addCar` only makes low sports car shapes.
3. **Hill mat fix v2.** b021 wasn't visually enough. Real fix probably needs an emissive boost on the hill mats so they punch through fog regardless of base color. Currently deferred.
4. **Click→card system build.** All design decided in section 6 — just needs to be built. Probably ~200 lines of JS for raycaster + lookup table + card UI HTML/CSS + cursor swap.

---

## 10. Quick reference: don't do these things

- ❌ Don't build a "luxury" feature with <20 props
- ❌ Don't use dark greens for anything beyond z=40 (fog kills them)
- ❌ Don't break the orbit camera
- ❌ Don't propose photoreal upgrades or normal maps
- ❌ Don't add "improvements" to code you didn't change (CLAUDE.md rule)
- ❌ Don't use `addCar` for non-sports-car body types — write a new helper
- ❌ Don't dump emissive boxes and call them flowers
- ❌ Don't forget the dusk Miami sky is the backdrop — distant terrain should tint TOWARD pink/rose, not away from it
- ❌ Don't ship a "centerpiece" smaller than the props around it (the b023 fountain stub was the lesson)

## And do these:

- ✅ Read this file at the start of any luxury / scenery / new-feature work
- ✅ Read CLAUDE.md before any code change
- ✅ Read HANDOFF.md to understand current state
- ✅ Read FILE_MAP.md for architecture
- ✅ Check existing palette before adding a new mat
- ✅ Build new exterior props as named THREE.Group nodes (click→card prep)
- ✅ When adding a feature near the back of the scene, fog-test mentally first
- ✅ When in doubt about "luxury enough?" — multiply your prop count by 3
