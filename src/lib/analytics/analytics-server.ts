import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Server-side reads for the admin Analytics/Engagement tabs. Events are
// collected first-party by /api/track into the `analytics_events` table
// (supabase/migrations/0013_analytics.sql); everything here goes through that
// migration's aggregate functions with the service role, so none of it can
// reach the client bundle.

// One place to change if the admin Analytics tab's time window changes.
export const ANALYTICS_WINDOW_DAYS = 30;

export class AnalyticsNotConfiguredError extends Error {
  constructor() {
    super("SUPABASE_SERVICE_ROLE_KEY is not set");
    this.name = "AnalyticsNotConfiguredError";
  }
}

/** True when the dashboard can run — it only needs the service-role key
 * (and, once, the 0013 migration applied). */
export const isAnalyticsConfigured = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function rpc<T = Record<string, unknown>>(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T[]> {
  if (!isAnalyticsConfigured()) throw new AnalyticsNotConfiguredError();
  const { data, error } = await createAdminClient().rpc(fn, args);
  if (error) throw new Error(`analytics ${fn} failed: ${error.message}`);
  return (data ?? []) as T[];
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export type AnalyticsSummary = {
  uniqueVisitors: number;
  pageviews: number;
  searches: number;
  pwaInstalls: number;
};

export async function getAnalyticsSummary(
  days = ANALYTICS_WINDOW_DAYS,
): Promise<AnalyticsSummary> {
  const [row] = await rpc<{
    visitors: number;
    pageviews: number;
    searches: number;
    pwa_installs: number;
  }>("analytics_summary", { days });
  return {
    uniqueVisitors: Number(row?.visitors ?? 0),
    pageviews: Number(row?.pageviews ?? 0),
    searches: Number(row?.searches ?? 0),
    pwaInstalls: Number(row?.pwa_installs ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Traffic trend — one point per day (or per hour for "today"), zero-filled
// so the chart never shows a gap where a bucket simply had no traffic (the
// SQL only returns buckets that actually happened).
// ---------------------------------------------------------------------------

// ISO date (daily points) or ISO hour-start (hourly, "today" points) — the
// chart tells them apart by string length, see PageviewTrendChart. Two
// series, not one — pageviews and unique visitors overlaid on the same
// axis (both are plain counts, so a shared scale is honest, unlike a
// dual-y-axis chart, which distorts however the two scales happen to be
// picked — see the dataviz skill's anti-patterns).
export type TrendPoint = { date: string; pageviews: number; visitors: number };

export async function getPageviewTrend(days = ANALYTICS_WINDOW_DAYS): Promise<TrendPoint[]> {
  const rows = await rpc<{ day: string; pageviews: number; visitors: number }>("analytics_daily", {
    days,
  });
  const byDay = new Map(
    rows.map((r) => [r.day, { pageviews: Number(r.pageviews), visitors: Number(r.visitors) }]),
  );

  const points: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    points.push({ date: key, pageviews: bucket?.pageviews ?? 0, visitors: bucket?.visitors ?? 0 });
  }
  return points;
}

// Hour-by-hour for the current UTC calendar day, zero-filled from
// 00:00 through the current hour (no future hours — there's nothing to
// zero-fill them with that wouldn't be misleading).
export async function getPageviewTrendToday(): Promise<TrendPoint[]> {
  const rows = await rpc<{ hour: string; pageviews: number; visitors: number }>(
    "analytics_hourly_today",
  );
  const byHour = new Map(
    rows.map((r) => [r.hour, { pageviews: Number(r.pageviews), visitors: Number(r.visitors) }]),
  );

  const now = new Date();
  const currentHour = now.getUTCHours();
  const points: TrendPoint[] = [];
  for (let h = 0; h <= currentHour; h++) {
    const key = `${now.toISOString().slice(0, 10)}T${String(h).padStart(2, "0")}`;
    const bucket = byHour.get(key);
    points.push({
      date: `${key}:00:00`,
      pageviews: bucket?.pageviews ?? 0,
      visitors: bucket?.visitors ?? 0,
    });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Most-viewed content
// ---------------------------------------------------------------------------

export type RankedItem = { label: string; count: number };

async function topByProperty(
  event: string,
  property: string,
  days: number,
  limit: number,
  filter?: { key: string; value: string },
): Promise<RankedItem[]> {
  const rows = await rpc<{ label: string; n: number }>("analytics_top", {
    ev: event,
    prop: property,
    days,
    lim: limit,
    fkey: filter?.key ?? null,
    fval: filter?.value ?? null,
  });
  return rows.map((r) => ({ label: String(r.label), count: Number(r.n) }));
}

export function getTopSpots(days = ANALYTICS_WINDOW_DAYS, limit = 8) {
  return topByProperty("spot_view", "spot_slug", days, limit);
}

export function getTopArticles(days = ANALYTICS_WINDOW_DAYS, limit = 8) {
  return topByProperty("article_view", "article_slug", days, limit);
}

// ---------------------------------------------------------------------------
// Per-spot engagement — every spot's own interaction count, not just a
// top-8 list. This is what actually answers "how does spot X compare to
// everyone else" (for a sales conversation about featured placement,
// support, etc.), which a top-N list can't.
// ---------------------------------------------------------------------------

async function countsBySlug(
  event: string,
  slugProperty: string,
  days: number,
  filter?: { key: string; value: string },
): Promise<Record<string, number>> {
  const items = await topByProperty(event, slugProperty, days, 1000, filter);
  return Object.fromEntries(items.map((i) => [i.label, i.count]));
}

export type SpotInteractionCounts = {
  views: number;
  whatsapp: number;
  directions: number;
  mapClicks: number;
  shares: number;
};

// Keyed by spot_slug. `directions_click` and `share_click` are both shared
// with other entity types (their `entity` prop says which), so those two
// need the extra filter — the other three events only ever fire for spots.
export async function getSpotInteractionCounts(
  days = ANALYTICS_WINDOW_DAYS,
): Promise<Record<string, SpotInteractionCounts>> {
  const spotOnly = { key: "entity", value: "spot" };
  const [views, whatsapp, directions, mapClicks, shares] = await Promise.all([
    countsBySlug("spot_view", "spot_slug", days),
    countsBySlug("whatsapp_click", "spot_slug", days),
    countsBySlug("directions_click", "entity_slug", days, spotOnly),
    countsBySlug("map_spot_click", "spot_slug", days),
    countsBySlug("share_click", "entity_slug", days, spotOnly),
  ]);

  const slugs = new Set([
    ...Object.keys(views),
    ...Object.keys(whatsapp),
    ...Object.keys(directions),
    ...Object.keys(mapClicks),
    ...Object.keys(shares),
  ]);

  const result: Record<string, SpotInteractionCounts> = {};
  for (const slug of slugs) {
    result[slug] = {
      views: views[slug] ?? 0,
      whatsapp: whatsapp[slug] ?? 0,
      directions: directions[slug] ?? 0,
      mapClicks: mapClicks[slug] ?? 0,
      shares: shares[slug] ?? 0,
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Engagement — what people actually *do* once they land on a spot/event,
// beyond just viewing it.
// ---------------------------------------------------------------------------

export type EngagementCounts = {
  whatsappClicks: number;
  directionsClicks: number;
  mapPinClicks: number;
  shareClicks: number;
};

async function eventCounts(events: readonly string[], days: number): Promise<Map<string, number>> {
  const rows = await rpc<{ event: string; n: number }>("analytics_event_counts", {
    evs: events,
    days,
  });
  return new Map(rows.map((r) => [String(r.event), Number(r.n)]));
}

// event_booking_click isn't queried here — the Book CTA it tracks lives on
// Event detail pages, and Events are currently hidden site-wide (see the
// admin dashboard/Sidebar), so this would just be a permanently-0 tile.
// The event itself still fires and is stored either way, ready to wire back
// in whenever Events comes back. `share_click` here is every share (spot +
// event + article) — the per-spot breakdown above is where that gets
// narrowed to spots only.
const ENGAGEMENT_EVENTS = [
  "whatsapp_click",
  "directions_click",
  "map_spot_click",
  "share_click",
] as const;

export async function getEngagementCounts(
  days = ANALYTICS_WINDOW_DAYS,
): Promise<EngagementCounts> {
  const byEvent = await eventCounts(ENGAGEMENT_EVENTS, days);
  return {
    whatsappClicks: byEvent.get("whatsapp_click") ?? 0,
    directionsClicks: byEvent.get("directions_click") ?? 0,
    mapPinClicks: byEvent.get("map_spot_click") ?? 0,
    shareClicks: byEvent.get("share_click") ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Discovery — how people search and filter, i.e. what they're looking for
// (as opposed to what they end up viewing above).
// ---------------------------------------------------------------------------

export function getTopCategoryFilters(days = ANALYTICS_WINDOW_DAYS, limit = 6) {
  return topByProperty("filter_applied", "value", days, limit, { key: "kind", value: "category" });
}

export function getTopVibeFilters(days = ANALYTICS_WINDOW_DAYS, limit = 6) {
  return topByProperty("filter_applied", "value", days, limit, { key: "kind", value: "vibe" });
}

export type SearchStats = { total: number; noResults: number };

export async function getSearchStats(days = ANALYTICS_WINDOW_DAYS): Promise<SearchStats> {
  const [row] = await rpc<{ total: number; zero: number }>("analytics_search_stats", { days });
  return { total: Number(row?.total ?? 0), noResults: Number(row?.zero ?? 0) };
}

// ---------------------------------------------------------------------------
// Audience
// ---------------------------------------------------------------------------

async function pageviewDim(dim: "device" | "locale" | "referrer", days: number, limit: number) {
  const rows = await rpc<{ label: string; n: number }>("analytics_pageview_dim", {
    dim,
    days,
    lim: limit,
  });
  return rows.map((r) => ({ label: String(r.label), count: Number(r.n) }));
}

export function getDeviceBreakdown(days = ANALYTICS_WINDOW_DAYS): Promise<RankedItem[]> {
  return pageviewDim("device", days, 6);
}

export function getLanguageSplit(days = ANALYTICS_WINDOW_DAYS): Promise<RankedItem[]> {
  return pageviewDim("locale", days, 2);
}

// "direct" (no referrer — typed URL, bookmark, most apps/DMs that strip
// referrers) is its own bucket rather than dropped, since for a young site
// it's usually the single biggest slice and dropping it would be misleading.
export function getReferrers(days = ANALYTICS_WINDOW_DAYS, limit = 6): Promise<RankedItem[]> {
  return pageviewDim("referrer", days, limit);
}

// ---------------------------------------------------------------------------
// Night mode adoption
// ---------------------------------------------------------------------------

export type NightModeStats = { toggles: number; people: number };

export async function getNightModeStats(days = ANALYTICS_WINDOW_DAYS): Promise<NightModeStats> {
  const [row] = await rpc<{ toggles: number; people: number }>("analytics_night_mode", { days });
  return { toggles: Number(row?.toggles ?? 0), people: Number(row?.people ?? 0) };
}

// ---------------------------------------------------------------------------
// PWA install funnel
// ---------------------------------------------------------------------------

export type PwaFunnel = { shown: number; accepted: number; dismissed: number };

const PWA_EVENTS = [
  "pwa_install_prompt_shown",
  "pwa_install_accepted",
  "pwa_install_dismissed",
] as const;

export async function getPwaFunnel(days = ANALYTICS_WINDOW_DAYS): Promise<PwaFunnel> {
  const byEvent = await eventCounts(PWA_EVENTS, days);
  return {
    shown: byEvent.get("pwa_install_prompt_shown") ?? 0,
    accepted: byEvent.get("pwa_install_accepted") ?? 0,
    dismissed: byEvent.get("pwa_install_dismissed") ?? 0,
  };
}
