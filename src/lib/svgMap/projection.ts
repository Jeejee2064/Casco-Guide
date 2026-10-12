// Flat local projection shared by the SVG map engine and the build script
// (scripts/build-svg-basemap.mjs — keep the constants in sync). World units
// are meters east/south of Casco Viejo's center: at ~3km across, the Earth's
// curvature is invisible, so a plain equirectangular projection is exact
// enough and keeps every layer in one coordinate space.

export const ORIGIN_LAT = 8.9528;
export const ORIGIN_LNG = -79.5347;
const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LNG = 111320 * Math.cos((ORIGIN_LAT * Math.PI) / 180);

export type WorldPoint = [number, number];

/** [lat, lng] -> [x, y] meters (y grows southward, like screen space). */
export function project(lat: number, lng: number): WorldPoint {
  return [(lng - ORIGIN_LNG) * M_PER_DEG_LNG, -(lat - ORIGIN_LAT) * M_PER_DEG_LAT];
}

export function unproject(x: number, y: number): [number, number] {
  return [ORIGIN_LAT - y / M_PER_DEG_LAT, ORIGIN_LNG + x / M_PER_DEG_LNG];
}

/** Pixels per meter at a web-map zoom level (so the old minZoom 14 /
 * maxZoom 19 range keeps meaning the same thing). */
export function zoomToScale(z: number): number {
  const metersPerPixel =
    (156543.03392 * Math.cos((ORIGIN_LAT * Math.PI) / 180)) / 2 ** z;
  return 1 / metersPerPixel;
}

/** SVG path data for a polyline of [lat, lng] points, in world units. */
export function latLngsToPath(points: [number, number][]): string {
  let d = "";
  for (let i = 0; i < points.length; i++) {
    const [x, y] = project(points[i][0], points[i][1]);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}
