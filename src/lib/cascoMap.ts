import type {
  GeoJSON as LeafletGeoJSON,
  Map as LeafletMap,
  PathOptions,
} from "leaflet";
import type { FeatureCollection } from "geojson";

/**
 * Every Leaflet map on the site draws the same three static layers instead
 * of a tile basemap — see scripts/build-map-data.mjs for where they come
 * from (a real, fully-tagged OSM export of Casco Viejo, re-projected to
 * plain GeoJSON) and why: CARTO's free tile tier now watermarks every tile
 * "API KEY REQUIRED", and a single fixed neighborhood doesn't need a
 * pannable world basemap anyway — a custom-styled local vector map both
 * fixes that and reads as this site's own, not a generic web map.
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

export const CASCO_VIEJO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

type BasemapPalette = {
  /** Leaflet container background — unclassified ground (a plaza, a lot,
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

function paletteFor(dark: boolean): BasemapPalette {
  return dark ? NIGHT_PALETTE : DAY_PALETTE;
}

// Fetched once and shared by every map instance on the page (SpotMap,
// MiniMap, ItineraryMap, the admin location picker can all be mounted at
// once) rather than each re-requesting the same static files.
let buildingsPromise: Promise<FeatureCollection> | null = null;
let streetsPromise: Promise<FeatureCollection> | null = null;
let waterPromise: Promise<FeatureCollection> | null = null;

function loadJson(url: string): Promise<FeatureCollection> {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    return res.json();
  });
}

function getBuildings() {
  buildingsPromise ??= loadJson("/map/buildings.geojson");
  return buildingsPromise;
}

function getStreets() {
  streetsPromise ??= loadJson("/map/streets.geojson");
  return streetsPromise;
}

/** Same cached fetch as the basemap's own street layer above — exported for
 * lib/routing.ts, which builds a walking-directions graph out of the same
 * street network rather than re-requesting it. */
export const getStreetsGeoJSON = getStreets;

function getWater() {
  waterPromise ??= loadJson("/map/water.geojson");
  return waterPromise;
}

export type CascoBasemap = {
  water: LeafletGeoJSON;
  buildings: LeafletGeoJSON;
  streets: LeafletGeoJSON;
  /** Re-applies the given theme's colors to every layer and the map
   * container — call again whenever Night Mode or the OS scheme flips. */
  setDark: (dark: boolean) => void;
  destroy: () => void;
};

/**
 * Adds the water + buildings + streets layers to `map` (in that order, so
 * buildings/streets sit visually on top of the shoreline) and returns
 * handles to restyle or tear them down. Fire-and-forget: the layers pop in
 * once the (cached, usually-instant-after-first-load) GeoJSON fetch
 * resolves, same as a tile layer's tiles arriving asynchronously.
 */
export async function addCascoBasemap(
  L: typeof import("leaflet"),
  map: LeafletMap,
  dark: boolean,
): Promise<CascoBasemap> {
  const [waterData, buildingsData, streetsData] = await Promise.all([
    getWater(),
    getBuildings(),
    getStreets(),
  ]);

  const waterStyle = (): PathOptions => ({
    stroke: false,
    fill: true,
    fillColor: paletteFor(dark).waterFill,
    fillOpacity: 1,
  });
  const buildingStyle = (): PathOptions => ({
    stroke: false,
    fill: true,
    fillColor: paletteFor(dark).buildingFill,
    fillOpacity: 1,
  });
  const streetStyle = (): PathOptions => ({
    color: paletteFor(dark).streetColor,
    weight: 1,
    opacity: paletteFor(dark).streetOpacity,
  });

  const water = L.geoJSON(waterData, { style: waterStyle }).addTo(map);
  const streets = L.geoJSON(streetsData, { style: streetStyle }).addTo(map);
  const buildings = L.geoJSON(buildingsData, { style: buildingStyle }).addTo(map);

  const container = map.getContainer();
  container.style.background = paletteFor(dark).background;

  return {
    water,
    buildings,
    streets,
    setDark(nextDark) {
      const palette = paletteFor(nextDark);
      container.style.background = palette.background;
      water.setStyle({ fillColor: palette.waterFill });
      buildings.setStyle({ fillColor: palette.buildingFill });
      streets.setStyle({ color: palette.streetColor, opacity: palette.streetOpacity });
    },
    destroy() {
      water.remove();
      buildings.remove();
      streets.remove();
    },
  };
}
