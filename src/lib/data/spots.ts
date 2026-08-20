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
