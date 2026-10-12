import type { FeatureCollection } from "geojson";

/**
 * Shared Casco Viejo map constants. The maps themselves are drawn by the
 * SVG engine (components/site/SvgMap.tsx) from a pre-built basemap — see
 * scripts/build-svg-basemap.mjs. This file keeps the bounds/palette every map
 * agrees on, plus the street network lib/routing.ts walks.
 */

// The real extent covered by buildings.geojson/streets.geojson (see the OSM
// source's own <bounds>), padded a little so a pin right at the edge of the
// data isn't flush against the pan limit.
export const CASCO_VIEJO_BOUNDS: [[number, number], [number, number]] = [
  [8.9384, -79.5579],
  [8.9683, -79.503],
];

export const CASCO_VIEJO_CENTER: [number, number] = [8.9528, -79.5347];

/** True when a coordinate falls inside the mapped area — a plain bbox check
 * against CASCO_VIEJO_BOUNDS above, not a real polygon. Good enough to tell
 * "visitor is somewhere in the neighborhood" from "visitor is elsewhere in
 * Panama City (or further)" for lib/routing.ts's directions flow, without
 * digitizing and maintaining a separate geofence shape. */
export function isWithinCascoViejo(lat: number, lng: number): boolean {
  const [[minLat, minLng], [maxLat, maxLng]] = CASCO_VIEJO_BOUNDS;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

// Plaza Herrera — Casco Viejo's main gateway plaza (same coordinates as the
// American Trade Hotel spot that fronts it, scripts/seed-casco-viejo.mjs).
// Used as the directions flow's fallback starting point whenever the
// visitor's real position is outside CASCO_VIEJO_BOUNDS — routeBetween snaps
// it to the nearest real street-graph node like any other coordinate, so
// exact precision here isn't critical.
export const CASCO_VIEJO_ENTRY_POINT: { lat: number; lng: number } = {
  lat: 8.9548,
  lng: -79.5364,
};

export type BasemapPalette = {
  /** Map container background — unclassified ground (a plaza, a lot,
   * anything that's neither a building nor water) rather than water itself
   * now that water.geojson draws that explicitly. */
  background: string;
  waterFill: string;
  buildingFill: string;
  streetColor: string;
  streetOpacity: number;
};

const DAY_PALETTE: BasemapPalette = {
  background: "#eef2f0",
  waterFill: "#8fd0e8",
  buildingFill: "#cacbcc",
  streetColor: "#70787b",
  streetOpacity: 0.45,
};

const NIGHT_PALETTE: BasemapPalette = {
  background: "#0b1120",
  waterFill: "#1f5a80",
  buildingFill: "#75879c",
  streetColor: "#eef3f8",
  streetOpacity: 0.4,
};

export function paletteFor(dark: boolean): BasemapPalette {
  return dark ? NIGHT_PALETTE : DAY_PALETTE;
}

// Fetched once and shared — only lib/routing.ts needs the raw street network
// now (the drawn basemap is the pre-built SVG, see svgMap/basemap.ts).
let streetsPromise: Promise<FeatureCollection> | null = null;

function loadJson(url: string): Promise<FeatureCollection> {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    return res.json();
  });
}

function getStreets() {
  streetsPromise ??= loadJson("/map/streets.geojson");
  return streetsPromise;
}

/** The street network as GeoJSON — for lib/routing.ts, which builds a
 * walking-directions graph out of it. */
export const getStreetsGeoJSON = getStreets;
