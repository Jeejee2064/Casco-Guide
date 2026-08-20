import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/routing";
import type { EventRecord, EventRow } from "@/lib/types/database";
import { localizeEvent } from "@/lib/i18n/content";
import { haversineKm } from "@/lib/geo";
import { isSupabaseConfigured } from "./spots";
import { MOCK_EVENTS } from "./mock-events";

export async function getEvents(locale: Locale): Promise<EventRow[]> {
  if (!isSupabaseConfigured) return MOCK_EVENTS.map((e) => localizeEvent(e, locale));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("date", { ascending: true });

  if (error) {
    console.error("getEvents error:", error.message);
    return MOCK_EVENTS.map((e) => localizeEvent(e, locale));
  }
  return (data as EventRecord[]).map((e) => localizeEvent(e, locale));
}

export async function getEventBySlug(slug: string, locale: Locale): Promise<EventRow | null> {
  if (!isSupabaseConfigured) {
    const record = MOCK_EVENTS.find((e) => e.slug === slug);
    return record ? localizeEvent(record, locale) : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getEventBySlug error:", error.message);
    return null;
  }
  return data ? localizeEvent(data as EventRecord, locale) : null;
}

/** Looks up several events by id at once, in no particular order — used to
 * resolve an article's `event_refs` into full records for its "places
 * mentioned" map. Unknown ids are silently dropped. */
export async function getEventsByIds(ids: string[], locale: Locale): Promise<EventRow[]> {
  if (ids.length === 0) return [];

  if (!isSupabaseConfigured) {
    return MOCK_EVENTS.filter((e) => ids.includes(e.id)).map((e) => localizeEvent(e, locale));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select("*").in("id", ids);

  if (error) {
    console.error("getEventsByIds error:", error.message);
    return [];
  }
  return (data as EventRecord[]).map((e) => localizeEvent(e, locale));
}

/** Upcoming events closest to a coordinate, nearest first — powers the
 * "related events" rail on spot/event detail pages. Events hosted right at
 * that coordinate (same venue) naturally sort to the top. */
export async function getNearbyEvents(
  lat: number,
  lng: number,
  locale: Locale,
  { excludeId, limit = 4 }: { excludeId?: string; limit?: number } = {},
): Promise<EventRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const events = await getEvents(locale);
  return events
    .filter((event) => event.id !== excludeId && event.date >= today)
    .map((event) => ({ event, distanceKm: haversineKm(lat, lng, event.latitude, event.longitude) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map(({ event }) => event);
}
