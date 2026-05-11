#!/usr/bin/env node
/* gen-manifest.js — auto-generate docs/scenes/SCENE_MANIFEST.json from
   js/scenes-selector.js.

   Walks the file for every `.name = '<id>'` static assignment, extracts the
   nearest literal `position.set(...)` or `_placeBuilding(...)` within ~15
   lines, and dumps a flat list. Templated names like `watchtower_${x}_${z}`
   (per-instance helpers) are listed separately under dynamicTemplates with
   their call-site positions resolved by matching the helper signature.

   Run after editing js/scenes-selector.js:
       node scripts/gen-manifest.js

   This file is the GROUND TRUTH for "which mesh ID corresponds to which
   visible structure" — read it BEFORE moving/deleting/adding anything in
   a scene file. See docs/scenes/LABEL_OVERLAY_PLAN.md for the workflow.
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'js', 'scenes-selector.js');
const OUT = path.join(ROOT, 'docs', 'scenes', 'SCENE_MANIFEST.json');
const BUILD_FILE = path.join(ROOT, 'js', 'builds', 'scenes.js');

const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split('\n');

const STATIC_NAME_RX = /\.name\s*=\s*['`]([a-z][a-z0-9_]+)['`]\s*;/g;
const TEMPLATE_NAME_RX = /\.name\s*=\s*`([a-z][a-z0-9_]*?)(?:_\$\{[^`]+\})+`/g;
const PANEL_MOUNT_RX = /pos:\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\][^}]*host:\s*['"]([a-z_]+)['"]/g;

function lineOf(offset) {
  return src.slice(0, offset).split('\n').length;
}

// Resolve a simple expression against a local scope (const X = N declarations).
// Handles: number literal, identifier, X+N, X-N, N+N, N-N.
function evalExpr(expr, scope) {
  expr = expr.trim();
  if (/^-?[\d.]+$/.test(expr)) return parseFloat(expr);
  if (/^[a-zA-Z_]\w*$/.test(expr) && Object.prototype.hasOwnProperty.call(scope, expr)) return scope[expr];
  let m = expr.match(/^([a-zA-Z_]\w*)\s*([+\-])\s*(-?[\d.]+)$/);
  if (m && Object.prototype.hasOwnProperty.call(scope, m[1])) {
    return m[2] === '+' ? scope[m[1]] + parseFloat(m[3]) : scope[m[1]] - parseFloat(m[3]);
  }
  m = expr.match(/^(-?[\d.]+)\s*([+\-])\s*(-?[\d.]+)$/);
  if (m) {
    return m[2] === '+' ? parseFloat(m[1]) + parseFloat(m[3]) : parseFloat(m[1]) - parseFloat(m[3]);
  }
  return null;
}

function buildLocalScope(startLineIdx) {
  // Scan backward up to 60 lines for `const X = N;` declarations.
  const scope = {};
  for (let j = Math.max(0, startLineIdx - 60); j <= startLineIdx; j++) {
    const m = lines[j].match(/^\s*const\s+([a-zA-Z_]\w*)\s*=\s*(-?[\d.]+)\s*[;,]/);
    if (m) scope[m[1]] = parseFloat(m[2]);
  }
  return scope;
}

function resolvePosition(lineIdx, callerScope = {}) {
  // Wider window to catch _placeBuilding calls at the tail of long _buildXxx
  // methods. Bail if we hit a new method header to avoid leaking into the
  // next method's body.
  // Scan to end-of-method (next method header at 2-space indent) so giant
  // _buildXxx bodies (_buildMissileSite is ~800 lines) still get matched.
  const scope = { ...buildLocalScope(lineIdx), ...callerScope };
  for (let j = lineIdx; j < lines.length; j++) {
    const line = lines[j];
    if (j > lineIdx && /^  _[a-zA-Z]+\(/.test(line)) break;  // next method
    if (j > lineIdx && /^},?$/.test(line)) break;  // end of object literal
    let m = line.match(/position\.set\(\s*([^,()]+)\s*,\s*([^,()]+)\s*,\s*([^,)]+)\s*\)/);
    if (m) {
      const xyz = [m[1], m[2], m[3]].map(a => evalExpr(a, scope));
      if (xyz.every(v => v !== null && !Number.isNaN(v))) return xyz;
    }
    m = line.match(/_placeBuilding\(\s*\w+\s*,\s*([^,()]+)\s*,\s*([^,()]+)\s*,\s*([^,)]+)\s*\)/);
    if (m) {
      const xyz = [m[1], m[2], m[3]].map(a => evalExpr(a, scope));
      if (xyz.every(v => v !== null && !Number.isNaN(v))) return xyz;
    }
  }
  return null;
}

const objects = [];
const seenIds = new Set();
let m;

while ((m = STATIC_NAME_RX.exec(src)) !== null) {
  const id = m[1];
  if (seenIds.has(id)) continue;
  const lineIdx = lineOf(m.index) - 1;
  const pos = resolvePosition(lineIdx);
  seenIds.add(id);
  objects.push({ id, line: lineIdx + 1, position: pos });
}

const panelHosts = [];
while ((m = PANEL_MOUNT_RX.exec(src)) !== null) {
  const x = parseFloat(m[1]);
  const y = parseFloat(m[2]);
  const z = parseFloat(m[3]);
  const id = m[4];
  panelHosts.push({ id, position: [x, y, z], type: 'panel_host' });
  seenIds.add(id);
}

// Dynamic templates: capture instance count by re-scanning for matches.
const templates = new Map();
while ((m = TEMPLATE_NAME_RX.exec(src)) !== null) {
  const prefix = m[1];
  const lineIdx = lineOf(m.index) - 1;
  if (!templates.has(prefix)) {
    templates.set(prefix, { prefix, helperLine: lineIdx + 1 });
  }
}

const buildSrc = fs.readFileSync(BUILD_FILE, 'utf8');
const buildMatch = buildSrc.match(/BUILD_SCENES\s*=\s*['"]([^'"]+)['"]/);
const build = buildMatch ? buildMatch[1] : 'unknown';

const out = {
  build,
  generatedAt: new Date().toISOString().slice(0, 10),
  source: 'js/scenes-selector.js',
  notes: [
    'Auto-generated by scripts/gen-manifest.js — DO NOT EDIT BY HAND.',
    'Regenerate after editing js/scenes-selector.js: `node scripts/gen-manifest.js`.',
    'panelHosts: 11 holographic panel-host buildings. IDs from BASEMAP.md radial spec. Positions are the `pos:` field of each entry in the _buildPanels() mounts array.',
    'staticObjects: standalone buildings, vehicles, named figures, lighting rigs, backdrops. Position resolved from nearest position.set(...) or _placeBuilding(grp, x, y, z) within ~15 lines after the .name assignment; null when the position uses identifiers the generator couldn\'t resolve (look at the source `line` field).',
    'dynamicTemplates: per-instance helpers (watchtowers, conex stacks, tents, etc.) — instance positions live in the JS call sites; the labels overlay names each instance at runtime from its construction args.',
    'WORKFLOW (in a fresh chat): read this file BEFORE moving/deleting/adding a named object. Resolve user descriptions (e.g. "the organism billboard", "the white building with vials") to a specific id here — if you can\'t resolve confidently, ask which id; do not guess.',
  ],
  panelHosts: panelHosts.sort((a, b) => a.id.localeCompare(b.id)),
  staticObjects: objects
    .filter(o => !panelHosts.find(p => p.id === o.id))
    .sort((a, b) => a.id.localeCompare(b.id)),
  dynamicTemplates: [...templates.values()]
    .sort((a, b) => a.prefix.localeCompare(b.prefix))
    .map(t => ({
      prefix: t.prefix,
      helperLine: t.helperLine,
      note: `instances named \`${t.prefix}_<params>\` — see call sites near line ${t.helperLine}`,
    })),
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${path.relative(ROOT, OUT)}`);
console.log(`  build: ${build}`);
console.log(`  panel hosts: ${out.panelHosts.length}`);
console.log(`  static objects: ${out.staticObjects.length}`);
console.log(`  dynamic templates: ${out.dynamicTemplates.length}`);
const resolved = out.staticObjects.filter(o => o.position !== null).length;
console.log(`  static positions resolved: ${resolved}/${out.staticObjects.length}`);
