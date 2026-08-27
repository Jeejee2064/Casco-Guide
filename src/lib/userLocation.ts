/**
 * Session-wide "last known visitor position" cache, shared by every
 * component that wants to *use* a geolocation fix without being the one to
 * *ask* for it. The only two places allowed to actually call
 * `navigator.geolocation.*` are both already behind an explicit "Get
 * Directions" click/deep-link (SpotDetailView's `directions()` pre-warm and
 * SpotMap's itinerary `watchPosition`) — they report their fixes here via
 * `setLastKnownUserLocation`. Everything else (MiniMap's "distance from you"
 * badge) only reads/subscribes, so opening a spot page never itself triggers
 * the browser's permission prompt.
 *
 * Same plain module-level-cache shape as cascoMap.ts's `buildingsPromise`
 * and friends — no context/provider needed for one shared value.
 */

export type UserLatLng = { lat: number; lng: number };

let lastKnown: UserLatLng | null = null;
const listeners = new Set<(loc: UserLatLng) => void>();

export function getLastKnownUserLocation(): UserLatLng | null {
  return lastKnown;
}

export function setLastKnownUserLocation(loc: UserLatLng): void {
  lastKnown = loc;
  for (const listener of listeners) listener(loc);
}

/** Returns an unsubscribe function, same shape as a plain event emitter. */
export function subscribeUserLocation(
  listener: (loc: UserLatLng) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
