// Builds the two static GeoJSON layers (buildings + streets) that every
// Leaflet map on the site (SpotMap, MiniMap, ItineraryMap, the admin
// location picker) renders instead of a tile basemap — see mapData.ts for
// why: CARTO's free tile tier now stamps every tile with an "API KEY
// REQUIRED" watermark, and a single fixed neighborhood doesn't need a
// pannable world basemap anyway.
//
// Source is `map.osm` — a raw OSM XML export (Overpass "export" tab, full
// tags, not the lossy building/street *.svg files this replaced, which came
// from an OSM→DXF→matplotlib pipeline that dropped every tag *and* any
// georeferencing, making them unusable for placing real spot pins). Re-run
// whenever that source file is refreshed with newer OSM data:
//
//   node scripts/build-map-data.mjs
//
// Output: public/map/buildings.geojson, public/map/streets.geojson,
// public/map/water.geojson.
// Coordinates are rounded to 6 decimal places (~11cm) — real precision from
// OSM is often better than that, but nothing this map draws needs it, and
// it keeps the shipped files smaller.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(__dirname, "..", "map-source", "map.osm");
const OUT_DIR = join(__dirname, "..", "public", "map");

function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : undefined;
}

function unescapeXml(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

// Ray-casting point-in-polygon test — used below to tell which of the two
// ways of closing an open coastline chain against the bounding box actually
// produced the *water* polygon (the wrong one would swallow the buildings).
function pointInRing(pt, ring) {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

// `natural=coastline` ways share endpoint nodes where they meet (that's the
// whole point — they're meant to be stitched into one continuous line per
// coastline). Chains any number of them into the longest runs possible.
function chainCoastlineWays(coastlineWays) {
  const keyOf = ([lon, lat]) => `${lon},${lat}`;
  const pool = coastlineWays.map((pts) => ({ pts, used: false }));
  const chains = [];
  for (const seed of pool) {
    if (seed.used) continue;
    seed.used = true;
    let chain = seed.pts;
    let grew = true;
    while (grew) {
      grew = false;
      const head = chain[0];
      const tail = chain[chain.length - 1];
      for (const way of pool) {
        if (way.used) continue;
        const wStart = way.pts[0];
        const wEnd = way.pts[way.pts.length - 1];
        if (keyOf(wStart) === keyOf(tail)) {
          chain = chain.concat(way.pts.slice(1));
        } else if (keyOf(wEnd) === keyOf(tail)) {
          chain = chain.concat([...way.pts].reverse().slice(1));
        } else if (keyOf(wEnd) === keyOf(head)) {
          chain = way.pts.slice(0, -1).concat(chain);
        } else if (keyOf(wStart) === keyOf(head)) {
          chain = [...way.pts].reverse().slice(0, -1).concat(chain);
        } else {
          continue;
        }
        way.used = true;
        grew = true;
        break;
      }
    }
    chains.push(chain);
  }
  return chains;
}

// A chain that doesn't already loop back on itself only covers the water
// down to wherever the source data happened to stop — closing it into a
// fillable polygon means walking the remaining way around the bounding
// box's corners back to the other end. Tries both directions around the box
// and keeps whichever one doesn't swallow `landRef` (a point known to be on
// land, e.g. a building) — that's the one that's actually water.
function closeChainToBounds(chain, bounds, landRef) {
  const { minlon, minlat, maxlon, maxlat } = bounds;
  const corners = [
    [minlon, maxlat],
    [maxlon, maxlat],
    [maxlon, minlat],
    [minlon, minlat],
  ];
  const nearestCorner = ([lon, lat]) => {
    let best = 0;
    let bestDist = Infinity;
    corners.forEach((c, i) => {
      const d = (c[0] - lon) ** 2 + (c[1] - lat) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  };
  const walk = (fromIdx, toIdx, dir) => {
    const pts = [];
    let i = fromIdx;
    while (i !== toIdx) {
      pts.push(corners[i]);
      i = (i + dir + 4) % 4;
    }
    pts.push(corners[toIdx]);
    return pts;
  };

  const head = chain[0];
  const tail = chain[chain.length - 1];
  const idxTail = nearestCorner(tail);
  const idxHead = nearestCorner(head);

  for (const dir of [1, -1]) {
    const bridge = idxTail === idxHead ? [] : walk(idxTail, idxHead, dir);
    const ring = [...chain, ...bridge, head];
    if (!pointInRing(landRef, ring)) return ring;
  }
  // Neither direction worked (shouldn't happen for a simple coastline) —
  // fall back to the first candidate rather than dropping this chain.
  return [...chain, ...(idxTail === idxHead ? [] : walk(idxTail, idxHead, 1)), head];
}

function main() {
  const xml = readFileSync(SOURCE, "utf8");

  const boundsMatch = xml.match(
    /<bounds\s+minlat="([\d.-]+)"\s+minlon="([\d.-]+)"\s+maxlat="([\d.-]+)"\s+maxlon="([\d.-]+)"/,
  );
  const bounds = boundsMatch
    ? {
        minlat: parseFloat(boundsMatch[1]),
        minlon: parseFloat(boundsMatch[2]),
        maxlat: parseFloat(boundsMatch[3]),
        maxlon: parseFloat(boundsMatch[4]),
      }
    : null;

  // --- Pass 1: nodes (id -> [lon, lat]) ------------------------------
  const nodes = new Map();
  const nodeRe = /<node\s+([^>]*?)\/?>/g;
  let m;
  while ((m = nodeRe.exec(xml))) {
    const attrs = m[1];
    if (!attrs.includes('id="')) continue;
    const id = attr(attrs, "id");
    const lat = attr(attrs, "lat");
    const lon = attr(attrs, "lon");
    if (id && lat && lon) nodes.set(id, [parseFloat(lon), parseFloat(lat)]);
  }

  // --- Pass 2: ways (id -> { nds: [id], tags: {k:v} }) ---------------
  const ways = new Map();
  const wayRe = /<way\s+([^>]*?)>([\s\S]*?)<\/way>/g;
  while ((m = wayRe.exec(xml))) {
    const id = attr(m[1], "id");
    const body = m[2];
    const nds = [...body.matchAll(/<nd\s+ref="([^"]+)"/g)].map((x) => x[1]);
    const tags = {};
    for (const t of body.matchAll(/<tag\s+k="([^"]*)"\s+v="([^"]*)"/g)) {
      tags[unescapeXml(t[1])] = unescapeXml(t[2]);
    }
    ways.set(id, { nds, tags });
  }

  // --- Pass 3: relations (for multi-part buildings) ------------------
  const relations = [];
  const relRe = /<relation\s+([^>]*?)>([\s\S]*?)<\/relation>/g;
  while ((m = relRe.exec(xml))) {
    const body = m[2];
    const members = [...body.matchAll(/<member\s+type="way"\s+ref="([^"]+)"\s+role="([^"]*)"/g)].map(
      (x) => ({ ref: x[1], role: x[2] }),
    );
    const tags = {};
    for (const t of body.matchAll(/<tag\s+k="([^"]*)"\s+v="([^"]*)"/g)) {
      tags[unescapeXml(t[1])] = unescapeXml(t[2]);
    }
    relations.push({ members, tags });
  }

  const ringOf = (wayId) => {
    const way = ways.get(wayId);
    if (!way) return null;
    const pts = way.nds.map((id) => nodes.get(id)).filter(Boolean);
    return pts.length >= 2 ? pts.map(([lon, lat]) => [round6(lon), round6(lat)]) : null;
  };

  const closeRing = (ring) => {
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    return fx === lx && fy === ly ? ring : [...ring, ring[0]];
  };

  // --- Buildings: plain ways -----------------------------------------
  const buildingFeatures = [];
  const usedAsBuildingWay = new Set();
  for (const [id, way] of ways) {
    if (!("building" in way.tags) && !("building:part" in way.tags)) continue;
    const ring = ringOf(id);
    if (!ring || ring.length < 4) continue;
    usedAsBuildingWay.add(id);
    buildingFeatures.push({
      type: "Feature",
      properties: { name: way.tags.name ?? null },
      geometry: { type: "Polygon", coordinates: [closeRing(ring)] },
    });
  }

  // --- Buildings: multipolygon relations (courtyards, complexes) -----
  for (const rel of relations) {
    if (rel.tags.type !== "multipolygon") continue;
    if (!("building" in rel.tags) && !("building:part" in rel.tags)) continue;
    const outerRings = [];
    for (const { ref, role } of rel.members) {
      if (role && role !== "outer") continue;
      const ring = ringOf(ref);
      if (ring && ring.length >= 3) outerRings.push(closeRing(ring));
      usedAsBuildingWay.add(ref);
    }
    if (outerRings.length === 0) continue;
    buildingFeatures.push({
      type: "Feature",
      properties: { name: rel.tags.name ?? null },
      geometry:
        outerRings.length === 1
          ? { type: "Polygon", coordinates: [outerRings[0]] }
          : { type: "MultiPolygon", coordinates: outerRings.map((r) => [r]) },
    });
  }

  // --- Water: the coastline, closed into fillable polygon(s) ----------
  const waterFeatures = [];
  if (bounds) {
    const coastlineChains = [];
    for (const [, way] of ways) {
      if (way.tags.natural !== "coastline") continue;
      const pts = way.nds.map((id) => nodes.get(id)).filter(Boolean);
      if (pts.length >= 2) coastlineChains.push(pts);
    }

    if (coastlineChains.length > 0) {
      // A corner of the first (simple, single-ring) building found — "on
      // land" by definition — used to tell water from land once a chain is
      // closed into a ring (see closeChainToBounds).
      const firstBuilding = buildingFeatures.find((f) => f.geometry.type === "Polygon");
      const landRef = firstBuilding?.geometry.coordinates[0]?.[0] ?? null;

      for (const chain of chainCoastlineWays(coastlineChains)) {
        const [hx, hy] = chain[0];
        const [tx, ty] = chain[chain.length - 1];
        const isClosed = hx === tx && hy === ty;
        const ring = isClosed || !landRef ? chain : closeChainToBounds(chain, bounds, landRef);
        waterFeatures.push({
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [closeRing(ring.map(([lon, lat]) => [round6(lon), round6(lat)]))] },
        });
      }
    }
  }

  // --- Water: ponds/lakes/reservoirs — already-closed ways, no bounds
  // trickery needed like the coastline above.
  for (const [, way] of ways) {
    if (way.tags.natural !== "water" && way.tags.landuse !== "reservoir") continue;
    const pts = way.nds.map((n) => nodes.get(n)).filter(Boolean);
    if (pts.length < 4) continue;
    const [hx, hy] = pts[0];
    const [tx, ty] = pts[pts.length - 1];
    if (hx !== tx || hy !== ty) continue; // an open way here is a shoreline segment, not a standalone pond
    waterFeatures.push({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [pts.map(([lon, lat]) => [round6(lon), round6(lat)])] },
    });
  }

  // --- Streets: any way carrying a `highway` tag ----------------------
  const streetFeatures = [];
  for (const [, way] of ways) {
    if (!("highway" in way.tags)) continue;
    const pts = way.nds.map((id) => nodes.get(id)).filter(Boolean);
    if (pts.length < 2) continue;
    streetFeatures.push({
      type: "Feature",
      properties: { name: way.tags.name ?? null, highway: way.tags.highway },
      geometry: {
        type: "LineString",
        coordinates: pts.map(([lon, lat]) => [round6(lon), round6(lat)]),
      },
    });
  }

  writeFileSync(
    join(OUT_DIR, "buildings.geojson"),
    JSON.stringify({ type: "FeatureCollection", features: buildingFeatures }),
  );
  writeFileSync(
    join(OUT_DIR, "streets.geojson"),
    JSON.stringify({ type: "FeatureCollection", features: streetFeatures }),
  );
  writeFileSync(
    join(OUT_DIR, "water.geojson"),
    JSON.stringify({ type: "FeatureCollection", features: waterFeatures }),
  );

  console.log(`buildings: ${buildingFeatures.length} features`);
  console.log(`streets:   ${streetFeatures.length} features`);
  console.log(`water:     ${waterFeatures.length} features`);
}

main();
