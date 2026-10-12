// Pre-projected, pre-simplified basemap for the SVG map engine — one path
// string per layer in world units (meters), built by
// scripts/build-svg-basemap.mjs. Fetched once and shared by every map on
// the page, like cascoMap.ts's GeoJSON.

export interface SvgBasemapData {
  /** [minX, minY, maxX, maxY] — the pan limits, in world units. */
  bounds: [number, number, number, number];
  water: string;
  buildings: string;
  streets: string;
}

let promise: Promise<SvgBasemapData> | null = null;

export function loadSvgBasemap(): Promise<SvgBasemapData> {
  promise ??= fetch("/map/basemap.json")
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load basemap: ${res.status}`);
      return res.json() as Promise<SvgBasemapData>;
    })
    .catch((err) => {
      promise = null; // let a later mount retry
      throw err;
    });
  return promise;
}
