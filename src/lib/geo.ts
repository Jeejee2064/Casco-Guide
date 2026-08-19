// Small, dependency-free geo helpers shared by the mini-map panel and the
// "nearby" data queries — kept separate from lib/hours.ts (time) and
// lib/categories.ts (taxonomy) since this is purely coordinate math.

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in kilometers. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** "580m" under 1km, "1.4km" above — matches how distances read in the UI. */
export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

/** Rough walking time at ~1.4 m/s (average adult pace), rounded to whole minutes. */
export function walkingMinutes(km: number): number {
  return Math.max(1, Math.round((km * 1000) / 1.4 / 60));
}
