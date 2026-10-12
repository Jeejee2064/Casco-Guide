// Turns the GeoJSON layers (see build-map-data.mjs) into ONE ready-to-draw
// SVG path string per layer, already projected into the SVG map engine's
// world space (meters, see src/lib/svgMap/projection.ts) and simplified —
// so the browser parses a few big paths instead of ~4,600 separate shapes,
// and never projects anything at runtime.
//
//   node scripts/build-map-data.mjs && node scripts/build-svg-basemap.mjs
//
// Output: public/map/basemap.json  { bounds, water, buildings, streets }

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, "..", "public", "map");

// Keep in sync with src/lib/svgMap/projection.ts.
const ORIGIN_LAT = 8.9528;
const ORIGIN_LNG = -79.5347;
const M_LAT = 110574;
const M_LNG = 111320 * Math.cos((ORIGIN_LAT * Math.PI) / 180);
const proj = ([lng, lat]) => [(lng - ORIGIN_LNG) * M_LNG, -(lat - ORIGIN_LAT) * M_LAT];

// Douglas-Peucker (iterative), tolerance in meters.
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0;
    let idx = -1;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let d2;
      if (len2 === 0) d2 = (px - ax) ** 2 + (py - ay) ** 2;
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        d2 = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
      }
      if (d2 > maxD) {
        maxD = d2;
        idx = i;
      }
    }
    if (maxD > t2 && idx !== -1) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const r1 = (n) => Math.round(n * 10) / 10;

function ringToPath(ring, tol, closed) {
  let pts = ring.map(proj);
  if (closed) pts = pts.slice(0, -1); // drop the repeated closing point
  pts = simplify(pts, tol);
  if (pts.length < (closed ? 3 : 2)) return "";
  // Relative coordinates after the first point: shorter strings, same shape.
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  let px = r1(pts[0][0]);
  let py = r1(pts[0][1]);
  let rel = "l";
  for (let i = 1; i < pts.length; i++) {
    const x = r1(pts[i][0]);
    const y = r1(pts[i][1]);
    const dx = r1(x - px);
    const dy = r1(y - py);
    if (dx !== 0 || dy !== 0) rel += `${dx} ${dy} `;
    px = x;
    py = y;
  }
  return d + rel.trimEnd() + (closed ? "z" : "");
}

function layer(file, tol) {
  const fc = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  const parts = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of fc.features) {
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : null;
    if (polys) {
      for (const poly of polys) for (const ring of poly) {
        const p = ringToPath(ring, tol, true);
        if (p) parts.push(p);
      }
    } else if (g.type === "LineString") {
      const p = ringToPath(g.coordinates, tol, false);
      if (p) parts.push(p);
    }
    for (const c of [g.coordinates].flat(g.type === "LineString" ? 0 : g.type === "Polygon" ? 1 : 2)) {
      const [x, y] = proj(c);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  return { d: parts.join(""), bbox: [minX, minY, maxX, maxY], count: parts.length };
}

const water = layer("water.geojson", 0.3);
const buildings = layer("buildings.geojson", 0.15);
const streets = layer("streets.geojson", 0.2);

// Pan limits = the same padded box cascoMap.ts has always used.
const [[s, w], [n, e]] = [[8.9384, -79.5579], [8.9683, -79.503]];
const [x0, y1] = proj([w, s]);
const [x1, y0] = proj([e, n]);

const out = {
  bounds: [r1(x0), r1(y0), r1(x1), r1(y1)], // [minX, minY, maxX, maxY]
  water: water.d,
  buildings: buildings.d,
  streets: streets.d,
};
writeFileSync(join(DIR, "basemap.json"), JSON.stringify(out));
const kb = (s) => (s.length / 1024).toFixed(0) + "KB";
console.log(`water ${kb(out.water)}, buildings ${kb(out.buildings)} (${buildings.count} rings), streets ${kb(out.streets)} (${streets.count} lines)`);
