// Walking-directions engine for the map's itinerary mode (SpotMap.tsx) — a
// small Dijkstra router over Casco Viejo's real street network (the same
// streets.geojson the basemap already draws, see cascoMap.ts/
// scripts/build-map-data.mjs), so "get directions" traces an actual walkable
// path instead of MiniMap's straight as-the-crow-flies line. Kept dependency-
// free (no routing-engine package) since the graph is tiny — one fixed
// neighborhood, a few thousand nodes — and this only ever runs a couple of
// times per session, not per frame.
import type { FeatureCollection, Position } from "geojson";
import { haversineKm } from "./geo";
import { getStreetsGeoJSON } from "./cascoMap";

export type RoutePoint = [number, number]; // [lat, lng]

/** One leg of the turn-by-turn breakdown — see routeBetween's own doc
 * comment for how these get built. Deliberately just structured data, no
 * copy: SpotMap/DirectionsPanel turn `kind` + `streetName` into a localized
 * sentence, so this file stays free of anything locale-specific. */
export type RouteStepKind = "depart" | "turn-left" | "turn-right" | "continue" | "cross" | "stairs";

export interface RouteStep {
  kind: RouteStepKind;
  /** The street/way this step follows, when it has one — null for an
   * unnamed path (a plaza crossing, an unnamed alley/footway), in which
   * case the caller falls back to a generic phrasing for `kind`. */
  streetName: string | null;
  distanceKm: number;
}

export interface Route {
  /** Ordered [lat, lng] points from origin to destination. */
  points: RoutePoint[];
  distanceKm: number;
  /** True when no street-network path could be found (streets.geojson
   * failed to load, or the two ends landed in disconnected parts of the
   * graph) and `points` is just a straight line between them instead. */
  approximate: boolean;
  /** Turn-by-turn breakdown of `points`, in order — empty for an
   * `approximate` route (a straight line has no streets to narrate). */
  steps: RouteStep[];
}

interface EdgeInfo {
  distanceKm: number;
  streetName: string | null;
  /** The OSM `highway` tag this edge's source way carried — "connector" for
   * the two synthetic stitches routeBetween adds from the real origin/
   * destination to the street graph, which aren't a real way at all. */
  highway: string;
}

interface GraphNode {
  lat: number;
  lng: number;
  /** neighbor node key -> the edge connecting to it. */
  edges: Map<string, EdgeInfo>;
}

interface StreetGraph {
  nodes: Map<string, GraphNode>;
}

// Coordinates in streets.geojson are already rounded to 6dp (see
// build-map-data.mjs), so two *ways* sharing an intersection share the exact
// same float — a plain string key is enough to merge those into one node,
// no epsilon-matching needed. What isn't guaranteed is that every crossing
// that should be one intersection actually was digitized as one shared OSM
// node — a footway crossing a street's centerline a few meters off, say —
// and left as raw vertices, those two near-but-not-quite-coincident points
// become separate graph nodes with no edge directly between them. Dijkstra
// then has to find *some* other path to bridge them, which can mean
// overshooting past the real crossing and doubling back on a nearby
// parallel way — a real (if usually small) detour, but one that reads as a
// pointless zigzag on the map. mergeNearbyNodes below collapses any nodes
// within MERGE_THRESHOLD_KM of each other into one before the graph is
// used for routing, so a crossing like that behaves like the single
// intersection it actually is.
function nodeKey(lat: number, lng: number): string {
  return `${lat},${lng}`;
}

// ~6m — comfortably more than the few-meter gap a mis-digitized crossing
// typically leaves, but well under the length of a real short block, so two
// genuinely distinct intersections don't get folded into one.
const MERGE_THRESHOLD_KM = 0.006;

/** Tiny disjoint-set (union-find) with path compression — just enough to
 * group raw vertices into clusters below; the graph tops out at a few
 * thousand nodes, so this doesn't need to be any fancier. */
class DisjointSet {
  private parent = new Map<string, string>();

  add(key: string): void {
    if (!this.parent.has(key)) this.parent.set(key, key);
  }

  find(key: string): string {
    let root = key;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    // Path compression, flattened in a second pass rather than recursively.
    let cursor = key;
    while (this.parent.get(cursor) !== root) {
      const next = this.parent.get(cursor)!;
      this.parent.set(cursor, root);
      cursor = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootA, rootB);
  }
}

/** Groups raw vertices within MERGE_THRESHOLD_KM of each other, keyed by a
 * grid a little larger than that threshold — comparing every vertex against
 * only its own and neighboring cells instead of every other vertex is what
 * keeps this a few thousand comparisons instead of tens of millions. Returns
 * each raw key's cluster representative (its `find()` root) and that
 * cluster's centroid — the point every node in it collapses onto. */
function clusterNearbyNodes(
  rawNodes: Map<string, { lat: number; lng: number }>,
): { representativeOf: (key: string) => string; centroids: Map<string, { lat: number; lng: number }> } {
  const cellSizeDeg = MERGE_THRESHOLD_KM / 111.32; // ~km per degree of latitude
  const cellOf = (lat: number, lng: number) =>
    `${Math.round(lat / cellSizeDeg)},${Math.round(lng / cellSizeDeg)}`;

  const grid = new Map<string, string[]>();
  for (const [key, node] of rawNodes) {
    const cell = cellOf(node.lat, node.lng);
    const bucket = grid.get(cell);
    if (bucket) bucket.push(key);
    else grid.set(cell, [key]);
  }

  const sets = new DisjointSet();
  for (const key of rawNodes.keys()) sets.add(key);

  for (const [key, node] of rawNodes) {
    const [cx, cy] = cellOf(node.lat, node.lng).split(",").map(Number);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const otherKey of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
          // `>` (not `!==`) so each pair is only ever compared once, from
          // whichever of the two visits it second — string comparison is
          // an arbitrary but stable order, not a spatial one, which is all
          // that's needed here.
          if (otherKey <= key) continue;
          const other = rawNodes.get(otherKey)!;
          if (haversineKm(node.lat, node.lng, other.lat, other.lng) <= MERGE_THRESHOLD_KM) {
            sets.union(key, otherKey);
          }
        }
      }
    }
  }

  const memberKeysByRoot = new Map<string, string[]>();
  for (const key of rawNodes.keys()) {
    const root = sets.find(key);
    const members = memberKeysByRoot.get(root);
    if (members) members.push(key);
    else memberKeysByRoot.set(root, [key]);
  }

  const centroids = new Map<string, { lat: number; lng: number }>();
  for (const [root, memberKeys] of memberKeysByRoot) {
    let sumLat = 0;
    let sumLng = 0;
    for (const key of memberKeys) {
      const node = rawNodes.get(key)!;
      sumLat += node.lat;
      sumLng += node.lng;
    }
    centroids.set(root, { lat: sumLat / memberKeys.length, lng: sumLng / memberKeys.length });
  }

  return { representativeOf: (key) => sets.find(key), centroids };
}

function buildStreetGraph(fc: FeatureCollection): StreetGraph {
  // Pass 1: every LineString vertex/edge, as digitized — before merging
  // anything, so clustering above sees the real raw positions. Each edge
  // keeps its source way's name/highway tag, so the routed path can later
  // narrate "onto Avenida X" rather than just tracing a bare line.
  const rawNodes = new Map<string, { lat: number; lng: number }>();
  const rawEdges: { aKey: string; bKey: string; streetName: string | null; highway: string }[] = [];

  const ensureRawNode = (lng: number, lat: number): string => {
    const key = nodeKey(lat, lng);
    if (!rawNodes.has(key)) rawNodes.set(key, { lat, lng });
    return key;
  };

  for (const feature of fc.features) {
    if (feature.geometry?.type !== "LineString") continue;
    const streetName = (feature.properties?.name as string | null | undefined) ?? null;
    const highway = (feature.properties?.highway as string | undefined) ?? "unknown";
    const coords = feature.geometry.coordinates as Position[];
    for (let i = 0; i < coords.length - 1; i++) {
      const [lngA, latA] = coords[i];
      const [lngB, latB] = coords[i + 1];
      const aKey = ensureRawNode(lngA, latA);
      const bKey = ensureRawNode(lngB, latB);
      if (aKey !== bKey) rawEdges.push({ aKey, bKey, streetName, highway });
    }
  }

  // Pass 2: collapse near-duplicate intersections (see this function's own
  // doc comment above) into single representative nodes.
  const { representativeOf, centroids } = clusterNearbyNodes(rawNodes);

  // Pass 3: the actual routing graph, built from clustered nodes/edges.
  const nodes = new Map<string, GraphNode>();
  for (const [root, centroid] of centroids) {
    nodes.set(root, { lat: centroid.lat, lng: centroid.lng, edges: new Map() });
  }

  for (const { aKey: aRawKey, bKey: bRawKey, streetName, highway } of rawEdges) {
    const aKey = representativeOf(aRawKey);
    const bKey = representativeOf(bRawKey);
    if (aKey === bKey) continue; // both ends collapsed into the same cluster
    const a = nodes.get(aKey)!;
    const b = nodes.get(bKey)!;
    const distanceKm = haversineKm(a.lat, a.lng, b.lat, b.lng);
    const info: EdgeInfo = { distanceKm, streetName, highway };
    // Ties (two ways connecting the same clustered pair — a duplicated
    // digitization, most often) go to whichever is shorter, same as before;
    // its name/highway comes along for the ride.
    if (!a.edges.has(bKey) || distanceKm < a.edges.get(bKey)!.distanceKm) a.edges.set(bKey, info);
    if (!b.edges.has(aKey) || distanceKm < b.edges.get(aKey)!.distanceKm) b.edges.set(aKey, info);
  }

  return { nodes };
}

// Built once and shared by every caller this session (SpotMap's directions
// mode is currently the only one, but the pattern mirrors cascoMap.ts's
// cached GeoJSON fetches) rather than re-parsing streets.geojson per route.
let graphPromise: Promise<StreetGraph> | null = null;

function getStreetGraph(): Promise<StreetGraph> {
  graphPromise ??= getStreetsGeoJSON().then(buildStreetGraph);
  return graphPromise;
}

/** Closest graph node to an arbitrary coordinate — a linear scan, but over
 * only a few thousand nodes and run at most twice per route, so it's not
 * worth a spatial index for this. */
function nearestNodeKey(graph: StreetGraph, lat: number, lng: number): string | null {
  let bestKey: string | null = null;
  let bestDist = Infinity;
  for (const [key, node] of graph.nodes) {
    const d = haversineKm(lat, lng, node.lat, node.lng);
    if (d < bestDist) {
      bestDist = d;
      bestKey = key;
    }
  }
  return bestKey;
}

/** Minimal binary min-heap keyed by a numeric priority — just enough for
 * Dijkstra below; the street graph tops out at a few thousand nodes, so
 * there's no need to reach for a package for this. */
class MinHeap<T> {
  private items: { priority: number; value: T }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(value: T, priority: number): void {
    const items = this.items;
    items.push({ priority, value });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].priority <= items[i].priority) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop(): T | undefined {
    const items = this.items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = i * 2 + 2;
        let smallest = i;
        if (left < items.length && items[left].priority < items[smallest].priority) smallest = left;
        if (right < items.length && items[right].priority < items[smallest].priority) smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top.value;
  }
}

/** Shortest path between two already-snapped node keys — Dijkstra with a
 * binary heap. Returns the ordered node keys, or null if they're in
 * disconnected parts of the graph (real-world OSM data occasionally has
 * gaps — routeBetween below falls back to a straight line when this
 * happens). */
function dijkstra(graph: StreetGraph, fromKey: string, toKey: string): string[] | null {
  if (fromKey === toKey) return [fromKey];

  const dist = new Map<string, number>([[fromKey, 0]]);
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  const heap = new MinHeap<string>();
  heap.push(fromKey, 0);

  while (heap.size > 0) {
    const current = heap.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    if (current === toKey) break;

    const node = graph.nodes.get(current);
    if (!node) continue;
    const currentDist = dist.get(current)!;

    for (const [neighborKey, edge] of node.edges) {
      if (visited.has(neighborKey)) continue;
      const candidate = currentDist + edge.distanceKm;
      if (candidate < (dist.get(neighborKey) ?? Infinity)) {
        dist.set(neighborKey, candidate);
        prev.set(neighborKey, current);
        heap.push(neighborKey, candidate);
      }
    }
  }

  if (!visited.has(toKey)) return null;

  const path: string[] = [toKey];
  let cursor = toKey;
  while (cursor !== fromKey) {
    const p = prev.get(cursor);
    if (!p) return null;
    path.push(p);
    cursor = p;
  }
  return path.reverse();
}

function pathLengthKm(points: RoutePoint[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineKm(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
  }
  return total;
}

// Perpendicular distance from `p` to the line through `a`/`b`, in km — used
// by simplifyRoute below. Treats the local area as flat, scaling longitude
// by cos(latitude) first so it's a fair Euclidean projection rather than
// stretched toward the poles; at Casco Viejo's scale (a few hundred meters)
// this is indistinguishable from doing it properly on the sphere.
function perpendicularDistanceKm(p: RoutePoint, a: RoutePoint, b: RoutePoint): number {
  const cosRef = Math.cos((a[0] * Math.PI) / 180);
  const bx = (b[1] - a[1]) * cosRef;
  const by = b[0] - a[0];
  const px = (p[1] - a[1]) * cosRef;
  const py = p[0] - a[0];
  const abLenSq = bx * bx + by * by;
  if (abLenSq === 0) return haversineKm(p[0], p[1], a[0], a[1]);
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / abLenSq));
  const dx = px - t * bx;
  const dy = py - t * by;
  return Math.sqrt(dx * dx + dy * dy) * 111.32; // ~km per degree of latitude
}

// A few meters — enough to smooth out the sub-block digitization noise
// real street data carries (a curb's worth of wobble between two vertices
// that are otherwise on the same straight block) without flattening an
// actual corner. Small relative to Casco Viejo's block lengths, so a real
// turn is always well outside this tolerance and survives untouched.
const SIMPLIFY_TOLERANCE_KM = 0.002;

/** Ramer–Douglas–Peucker line simplification — drops any point that lies
 * within `toleranceKm` of the straight line between its neighbors, so a run
 * of nearly-collinear vertices (however it ended up in the source data)
 * reads as the one straight segment it visually is instead of a series of
 * barely-there doglegs. Purely cosmetic: called on the already-computed
 * route in routeBetween below, after its real distance is measured from the
 * unsimplified points — the walking distance stays accurate even though the
 * drawn line gets a little shorter. */
function simplifyRoute(points: RoutePoint[], toleranceKm: number): RoutePoint[] {
  if (points.length <= 2) return points;

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: [start: number, end: number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    if (end <= start + 1) continue;

    let maxDist = 0;
    let maxIndex = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistanceKm(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        maxIndex = i;
      }
    }

    if (maxDist > toleranceKm) {
      keep[maxIndex] = true;
      stack.push([start, maxIndex], [maxIndex, end]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

// Compass bearing from `a` to `b`, in degrees (0 = north, 90 = east, …).
function bearingDeg(a: RoutePoint, b: RoutePoint): number {
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Signed turn angle from one bearing to the next, normalized to (-180, 180]
// — positive is a turn to the right (clockwise), negative to the left.
function turnAngleDeg(bearingIn: number, bearingOut: number): number {
  let diff = bearingOut - bearingIn;
  while (diff > 180) diff -= 360;
  while (diff <= -180) diff += 360;
  return diff;
}

// Below this many degrees either way, a heading change reads as "still
// basically the same direction" rather than an actual turn worth calling
// out — real streets rarely run perfectly straight for their whole length.
const TURN_THRESHOLD_DEG = 25;

/** One street/way's worth of the route — consecutive edges get folded into
 * the same leg while they share an "identity" (see buildLegs below), so a
 * street that OSM happens to split into several ways at every side-street
 * still reads as one instruction instead of a new one at each split. */
interface Leg {
  /** Grouping key only — `null` name and `"connector"`/`"unknown"` highway
   * both collapse to a per-highway-type key so, e.g., a run of unnamed
   * footway segments still merges into one leg. */
  key: string;
  streetName: string | null;
  highway: string;
  distanceKm: number;
  /** Used only to compute the turn angle at this leg's boundaries — the
   * overall chord from where the leg starts to where it ends, not its
   * exact (possibly slightly curved) shape. */
  startPoint: RoutePoint;
  endPoint: RoutePoint;
}

interface PathEdge {
  streetName: string | null;
  highway: string;
  distanceKm: number;
  from: RoutePoint;
  to: RoutePoint;
}

function buildLegs(edges: PathEdge[]): Leg[] {
  const legs: Leg[] = [];

  for (const edge of edges) {
    const key = edge.highway === "connector" ? "__connector" : (edge.streetName ?? `__unnamed_${edge.highway}`);
    const last = legs[legs.length - 1];
    if (last && last.key === key) {
      last.distanceKm += edge.distanceKm;
      last.endPoint = edge.to;
    } else {
      legs.push({
        key,
        streetName: edge.streetName,
        highway: edge.highway,
        distanceKm: edge.distanceKm,
        startPoint: edge.from,
        endPoint: edge.to,
      });
    }
  }

  // The two synthetic "off the mapped network" stitches at either end (see
  // routeBetween) can only ever end up as the very first and/or last leg,
  // never in the middle — fold them into their one real neighbor instead of
  // narrating "walk 4m" as its own instruction.
  if (legs.length > 1 && legs[0].key === "__connector") {
    const [connector, next] = legs;
    next.distanceKm += connector.distanceKm;
    next.startPoint = connector.startPoint;
    legs.shift();
  }
  if (legs.length > 1 && legs[legs.length - 1].key === "__connector") {
    const connector = legs.pop()!;
    const prev = legs[legs.length - 1];
    prev.distanceKm += connector.distanceKm;
    prev.endPoint = connector.endPoint;
  }

  return legs;
}

/** Turns a Dijkstra path's edges into a narratable step list — groups them
 * into legs (see buildLegs), then classifies each leg's transition using
 * the heading change from the previous one. An unnamed `highway=pedestrian`
 * leg (Casco Viejo's plazas are mapped this way, not as a named street)
 * always reads as "cross" regardless of the turn angle — arriving at an
 * open plaza isn't really a left/right turn the way a street corner is. */
function buildSteps(edges: PathEdge[]): RouteStep[] {
  const legs = buildLegs(edges);

  return legs.map((leg, i): RouteStep => {
    const isPlazaCrossing = leg.streetName === null && leg.highway === "pedestrian";
    let kind: RouteStepKind;

    if (leg.highway === "steps") {
      kind = "stairs";
    } else if (isPlazaCrossing) {
      kind = "cross";
    } else if (i === 0) {
      kind = "depart";
    } else {
      const prev = legs[i - 1];
      const turn = turnAngleDeg(bearingDeg(prev.startPoint, prev.endPoint), bearingDeg(leg.startPoint, leg.endPoint));
      kind = Math.abs(turn) < TURN_THRESHOLD_DEG ? "continue" : turn > 0 ? "turn-right" : "turn-left";
    }

    return { kind, streetName: leg.streetName, distanceKm: leg.distanceKm };
  });
}

/**
 * Walking route between two coordinates, following Casco Viejo's real
 * street network rather than a straight line — snaps each end to its
 * nearest street-graph node, runs Dijkstra between them, then stitches the
 * real start/end points onto the ends of that path so the route touches the
 * actual origin/destination instead of stopping at the nearest intersection.
 * Falls back to a straight line (`approximate: true`) if the street data
 * can't be loaded, or the two ends turn out to be in disconnected parts of
 * the graph — either way the caller still gets a usable route and distance,
 * just not one traced along real streets. `steps` (see RouteStep) is that
 * same path's turn-by-turn breakdown; empty whenever `approximate` is true,
 * since there's no real street to narrate a straight-line guess with.
 */
export async function routeBetween(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<Route> {
  const straightLine = (): Route => ({
    points: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
    distanceKm: haversineKm(from.lat, from.lng, to.lat, to.lng),
    approximate: true,
    steps: [],
  });

  let graph: StreetGraph;
  try {
    graph = await getStreetGraph();
  } catch {
    return straightLine();
  }
  if (graph.nodes.size === 0) return straightLine();

  const fromKey = nearestNodeKey(graph, from.lat, from.lng);
  const toKey = nearestNodeKey(graph, to.lat, to.lng);
  if (!fromKey || !toKey) return straightLine();

  const path = dijkstra(graph, fromKey, toKey);
  if (!path) return straightLine();

  const nodeLatLng = (key: string): RoutePoint => {
    const node = graph.nodes.get(key)!;
    return [node.lat, node.lng];
  };

  const points: RoutePoint[] = [
    [from.lat, from.lng],
    ...path.map(nodeLatLng),
    [to.lat, to.lng],
  ];
  // Distance first, from the real (unsimplified) path — see
  // simplifyRoute's doc comment for why the order matters here.
  const distanceKm = pathLengthKm(points);

  // The turn-by-turn edges, not `points` — off-network stitches included
  // (see buildLegs) so the very first/last instruction still accounts for
  // that short "walk to/from the street" hop instead of silently dropping it.
  const pathEdges: PathEdge[] = [
    { streetName: null, highway: "connector", distanceKm: haversineKm(from.lat, from.lng, ...nodeLatLng(path[0])), from: [from.lat, from.lng], to: nodeLatLng(path[0]) },
    ...path.slice(0, -1).map((key, i): PathEdge => {
      const nextKey = path[i + 1];
      const edge = graph.nodes.get(key)!.edges.get(nextKey)!;
      return { streetName: edge.streetName, highway: edge.highway, distanceKm: edge.distanceKm, from: nodeLatLng(key), to: nodeLatLng(nextKey) };
    }),
    { streetName: null, highway: "connector", distanceKm: haversineKm(...nodeLatLng(path[path.length - 1]), to.lat, to.lng), from: nodeLatLng(path[path.length - 1]), to: [to.lat, to.lng] },
  ];

  return {
    points: simplifyRoute(points, SIMPLIFY_TOLERANCE_KM),
    distanceKm,
    approximate: false,
    steps: buildSteps(pathEdges),
  };
}
