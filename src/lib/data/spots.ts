import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/routing";
import type { Spot, SpotRecord } from "@/lib/types/database";
import { localizeSpot } from "@/lib/i18n/content";
import { haversineKm } from "@/lib/geo";
import { MOCK_SPOTS } from "./mock-spots";

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export async function getSpots(locale: Locale): Promise<Spot[]> {
  if (!isSupabaseConfigured) return MOCK_SPOTS.map((s) => localizeSpot(s, locale));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("spots")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getSpots error:", error.message);
    return MOCK_SPOTS.map((s) => localizeSpot(s, locale));
  }
  return (data as SpotRecord[]).map((s) => localizeSpot(s, locale));
}

export async function getSpotBySlug(slug: string, locale: Locale): Promise<Spot | null> {
  if (!isSupabaseConfigured) {
    const record = MOCK_SPOTS.find((s) => s.slug === slug);
    return record ? localizeSpot(record, locale) : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("spots")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getSpotBySlug error:", error.message);
    return null;
  }
  return data ? localizeSpot(data as SpotRecord, locale) : null;
}

/** Looks up a spot by its DB id — used to resolve an event's `spot_id` into its host venue. */
export async function getSpotById(id: string, locale: Locale): Promise<Spot | null> {
  if (!isSupabaseConfigured) {
    const record = MOCK_SPOTS.find((s) => s.id === id);
    return record ? localizeSpot(record, locale) : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("spots")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getSpotById error:", error.message);
    return null;
  }
  return data ? localizeSpot(data as SpotRecord, locale) : null;
}

/** Looks up several spots by id at once, in no particular order — used to
 * resolve an article's `spot_refs` into full records for its "places
 * mentioned" map. Unknown ids are silently dropped. */
export async function getSpotsByIds(ids: string[], locale: Locale): Promise<Spot[]> {
  if (ids.length === 0) return [];

  if (!isSupabaseConfigured) {
    return MOCK_SPOTS.filter((s) => ids.includes(s.id)).map((s) => localizeSpot(s, locale));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("spots").select("*").in("id", ids);

  if (error) {
    console.error("getSpotsByIds error:", error.message);
    return [];
  }
  return (data as SpotRecord[]).map((s) => localizeSpot(s, locale));
}

/** The businesses attached to a hub location (e.g. a hotel's on-site
 * restaurant and bar) — spots whose `parent_id` points at `parentId`.
 * Mirrors `getSpotsByIds` above; unordered. */
export async function getChildSpots(parentId: string, locale: Locale): Promise<Spot[]> {
  if (!isSupabaseConfigured) {
    return MOCK_SPOTS.filter((s) => s.parent_id === parentId).map((s) => localizeSpot(s, locale));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("spots").select("*").eq("parent_id", parentId);

  if (error) {
    console.error("getChildSpots error:", error.message);
    return [];
  }
  return (data as SpotRecord[]).map((s) => localizeSpot(s, locale));
}

/** Spots closest to a coordinate, nearest first — powers the "nearby spots"
 * rail on spot/event detail pages. `excludeId` keeps the page currently
 * being viewed out of its own recommendations. */
export async function getNearbySpots(
  lat: number,
  lng: number,
  locale: Locale,
  { excludeId, limit = 6 }: { excludeId?: string; limit?: number } = {},
): Promise<Spot[]> {
  const spots = await getSpots(locale);
  return spots
    .filter((spot) => spot.id !== excludeId)
    .map((spot) => ({ spot, distanceKm: haversineKm(lat, lng, spot.latitude, spot.longitude) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map(({ spot }) => spot);
}

/** Spots most like a given one — same category and/or shared vibes score
 * highest — powering the "you might also like" rail on the spot detail page.
 * This replaced a purely distance-based rail there: two spots across town
 * that are both moody rooftop bars are a better recommendation than the
 * nearest unrelated shop. Ties break by rating, then distance, so among
 * equally good matches the more reachable one still wins. `excludeIds` lets
 * the caller keep spots already shown elsewhere on the page (hub parent/
 * children) out of the rail. Falls back to filling remaining slots with the
 * nearest spots when too few share a category/vibe, so a spot with an
 * uncommon category still gets a full rail instead of an empty one. */
export async function getRelatedSpots(
  spot: Spot,
  locale: Locale,
  { excludeIds = [], limit = 6 }: { excludeIds?: string[]; limit?: number } = {},
): Promise<Spot[]> {
  const excluded = new Set([spot.id, ...excludeIds]);
  const candidates = (await getSpots(locale)).filter((s) => !excluded.has(s.id));

  const scored = candidates.map((candidate) => {
    const sharedVibes = candidate.vibes.filter((v) => spot.vibes.includes(v)).length;
    const score = (candidate.category === spot.category ? 2 : 0) + sharedVibes;
    const distanceKm = haversineKm(spot.latitude, spot.longitude, candidate.latitude, candidate.longitude);
    return { spot: candidate, score, distanceKm };
  });

  const related = scored
    .filter((c) => c.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || (b.spot.rating ?? 0) - (a.spot.rating ?? 0) || a.distanceKm - b.distanceKm,
    );

  if (related.length >= limit) return related.slice(0, limit).map((c) => c.spot);

  const relatedIds = new Set(related.map((c) => c.spot.id));
  const filler = scored
    .filter((c) => !relatedIds.has(c.spot.id))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return [...related, ...filler].slice(0, limit).map((c) => c.spot);
}
