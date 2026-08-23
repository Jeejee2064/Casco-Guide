import "server-only";

// Server-side reads against the PostHog Query API (HogQL) for the admin
// Analytics tab. Separate from instrumentation-client.ts/track.ts (which
// only ever *send* events) — this is the only place that *reads* them back,
// using POSTHOG_PERSONAL_API_KEY, which must never reach the client bundle.
//
// US Cloud app host (this project's region — see next.config.ts's rewrite
// comment for the matching ingestion host). Note this is *not* the
// NEXT_PUBLIC_POSTHOG_HOST proxy: that only fronts ingestion traffic, the
// Query API is always called directly against PostHog's app host.
const POSTHOG_APP_HOST = "https://us.posthog.com";

// No `$host` filtering here — this PostHog project (POSTHOG_PROJECT_ID) is
// dedicated to this site, unlike the shared one it briefly lived in during
// setup, so every event in it is already ours (localhost included, which
// is the point — it lets local testing show up here too).

// One place to change if the admin Analytics tab's time window changes.
export const ANALYTICS_WINDOW_DAYS = 30;

type HogQLResponse = {
  columns: string[];
  results: unknown[][];
};

export class PostHogNotConfiguredError extends Error {
  constructor() {
    super("POSTHOG_PERSONAL_API_KEY is not set");
    this.name = "PostHogNotConfiguredError";
  }
}

async function runHogQLQuery(query: string): Promise<HogQLResponse> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!apiKey || !projectId) throw new PostHogNotConfiguredError();

  const res = await fetch(`${POSTHOG_APP_HOST}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    // Analytics data doesn't need to be live-live — a short cache keeps the
    // admin tab well under PostHog's API rate limits on repeat visits.
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`PostHog query failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

function firstCell(response: HogQLResponse): number {
  return Number(response.results[0]?.[0] ?? 0);
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
  const [uniqueVisitors, pageviews, searches, pwaInstalls] = await Promise.all([
    runHogQLQuery(
      `SELECT count(DISTINCT distinct_id) FROM events WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${days} DAY`,
    ),
    runHogQLQuery(
      `SELECT count() FROM events WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${days} DAY`,
    ),
    runHogQLQuery(
      `SELECT count() FROM events WHERE event = 'search_performed' AND timestamp >= now() - INTERVAL ${days} DAY`,
    ),
    runHogQLQuery(
      `SELECT count() FROM events WHERE event = 'pwa_install_accepted' AND timestamp >= now() - INTERVAL ${days} DAY`,
    ),
  ]);

  return {
    uniqueVisitors: firstCell(uniqueVisitors),
    pageviews: firstCell(pageviews),
    searches: firstCell(searches),
    pwaInstalls: firstCell(pwaInstalls),
  };
}

// ---------------------------------------------------------------------------
// Traffic trend — one point per day (or per hour for "today"), zero-filled
// so the chart never shows a gap where a bucket simply had no traffic
// (HogQL only returns buckets that actually happened).
// ---------------------------------------------------------------------------

// ISO date (daily points) or ISO hour-start (hourly, "today" points) — the
// chart tells them apart by string length, see PageviewTrendChart. Two
// series, not one — pageviews and unique visitors overlaid on the same
// axis (both are plain counts, so a shared scale is honest, unlike a
// dual-y-axis chart, which distorts however the two scales happen to be
// picked — see the dataviz skill's anti-patterns).
export type TrendPoint = { date: string; pageviews: number; visitors: number };

export async function getPageviewTrend(days = ANALYTICS_WINDOW_DAYS): Promise<TrendPoint[]> {
  const response = await runHogQLQuery(
    `SELECT toDate(timestamp) AS day, count() AS pageviews, count(DISTINCT distinct_id) AS visitors
     FROM events
     WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${days} DAY
     GROUP BY day ORDER BY day`,
  );
  const byDay = new Map(
    response.results.map(([day, pageviews, visitors]) => [
      String(day).slice(0, 10),
      { pageviews: Number(pageviews), visitors: Number(visitors) },
    ]),
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
  const response = await runHogQLQuery(
    `SELECT toStartOfHour(timestamp) AS hour, count() AS pageviews, count(DISTINCT distinct_id) AS visitors
     FROM events
     WHERE event = '$pageview' AND toDate(timestamp) = today()
     GROUP BY hour ORDER BY hour`,
  );
  const byHour = new Map(
    response.results.map(([hour, pageviews, visitors]) => [
      String(hour).slice(0, 13),
      { pageviews: Number(pageviews), visitors: Number(visitors) },
    ]),
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
  extraWhere = "",
): Promise<RankedItem[]> {
  const response = await runHogQLQuery(
    `SELECT properties.${property} AS label, count() AS n
     FROM events
     WHERE event = '${event}' AND timestamp >= now() - INTERVAL ${days} DAY
       AND label IS NOT NULL ${extraWhere}
     GROUP BY label ORDER BY n DESC LIMIT ${limit}`,
  );
  return response.results.map(([label, n]) => ({ label: String(label), count: Number(n) }));
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
  extraWhere = "",
): Promise<Record<string, number>> {
  const response = await runHogQLQuery(
    `SELECT properties.${slugProperty} AS slug, count() AS n
     FROM events
     WHERE event = '${event}' AND timestamp >= now() - INTERVAL ${days} DAY AND slug IS NOT NULL ${extraWhere}
     GROUP BY slug
     LIMIT 1000`,
  );
  return Object.fromEntries(response.results.map(([slug, n]) => [String(slug), Number(n)]));
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
  const [views, whatsapp, directions, mapClicks, shares] = await Promise.all([
    countsBySlug("spot_view", "spot_slug", days),
    countsBySlug("whatsapp_click", "spot_slug", days),
    countsBySlug("directions_click", "entity_slug", days, "AND properties.entity = 'spot'"),
    countsBySlug("map_spot_click", "spot_slug", days),
    countsBySlug("share_click", "entity_slug", days, "AND properties.entity = 'spot'"),
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

// event_booking_click isn't queried here — the Book CTA it tracks lives on
// Event detail pages, and Events are currently hidden site-wide (see the
// admin dashboard/Sidebar), so this would just be a permanently-0 tile.
// The event itself still fires and lands in PostHog either way, ready to
// wire back in whenever Events comes back. `share_click` here is every
// share (spot + event + article) — the per-spot breakdown below is where
// that gets narrowed to spots only.
const ENGAGEMENT_EVENTS = [
  "whatsapp_click",
  "directions_click",
  "map_spot_click",
  "share_click",
] as const;

export async function getEngagementCounts(
  days = ANALYTICS_WINDOW_DAYS,
): Promise<EngagementCounts> {
  const response = await runHogQLQuery(
    `SELECT event, count() AS n
     FROM events
     WHERE event IN (${ENGAGEMENT_EVENTS.map((e) => `'${e}'`).join(", ")})
       AND timestamp >= now() - INTERVAL ${days} DAY
     GROUP BY event`,
  );
  const byEvent = new Map(response.results.map(([event, n]) => [String(event), Number(n)]));

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
  return topByProperty("filter_applied", "value", days, limit, "AND properties.kind = 'category'");
}

export function getTopVibeFilters(days = ANALYTICS_WINDOW_DAYS, limit = 6) {
  return topByProperty("filter_applied", "value", days, limit, "AND properties.kind = 'vibe'");
}

export type SearchStats = { total: number; noResults: number };

export async function getSearchStats(days = ANALYTICS_WINDOW_DAYS): Promise<SearchStats> {
  const response = await runHogQLQuery(
    `SELECT count() AS total, countIf(toInt(properties.result_count) = 0) AS zero
     FROM events
     WHERE event = 'search_performed' AND timestamp >= now() - INTERVAL ${days} DAY`,
  );
  const [total, noResults] = response.results[0] ?? [0, 0];
  return { total: Number(total), noResults: Number(noResults) };
}

// ---------------------------------------------------------------------------
// Audience
// ---------------------------------------------------------------------------

export async function getDeviceBreakdown(
  days = ANALYTICS_WINDOW_DAYS,
): Promise<RankedItem[]> {
  const response = await runHogQLQuery(
    `SELECT properties.$device_type AS label, count() AS n
     FROM events
     WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${days} DAY AND label IS NOT NULL
     GROUP BY label ORDER BY n DESC LIMIT 6`,
  );
  return response.results.map(([label, n]) => ({ label: String(label), count: Number(n) }));
}

export async function getLanguageSplit(
  days = ANALYTICS_WINDOW_DAYS,
): Promise<RankedItem[]> {
  const response = await runHogQLQuery(
    `SELECT substring(properties.$pathname, 2, 2) AS label, count() AS n
     FROM events
     WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${days} DAY
       AND label IN ('en', 'es')
     GROUP BY label ORDER BY n DESC`,
  );
  return response.results.map(([label, n]) => ({ label: String(label), count: Number(n) }));
}

// "direct" (no referrer — typed URL, bookmark, most apps/DMs that strip
// referrers) is its own bucket rather than dropped, since for a young site
// it's usually the single biggest slice and dropping it would be misleading.
export async function getReferrers(
  days = ANALYTICS_WINDOW_DAYS,
  limit = 6,
): Promise<RankedItem[]> {
  const response = await runHogQLQuery(
    `SELECT
       if(properties.$referring_domain = '' OR properties.$referring_domain IS NULL, 'direct', properties.$referring_domain) AS label,
       count() AS n
     FROM events
     WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${days} DAY
     GROUP BY label ORDER BY n DESC LIMIT ${limit}`,
  );
  return response.results.map(([label, n]) => ({ label: String(label), count: Number(n) }));
}

// ---------------------------------------------------------------------------
// Night mode adoption
// ---------------------------------------------------------------------------

export type NightModeStats = { toggles: number; people: number };

export async function getNightModeStats(days = ANALYTICS_WINDOW_DAYS): Promise<NightModeStats> {
  const response = await runHogQLQuery(
    `SELECT count() AS toggles, count(DISTINCT distinct_id) AS people
     FROM events
     WHERE event = 'night_mode_toggle' AND properties.to = 'night'
       AND timestamp >= now() - INTERVAL ${days} DAY`,
  );
  const [toggles, people] = response.results[0] ?? [0, 0];
  return { toggles: Number(toggles), people: Number(people) };
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
  const response = await runHogQLQuery(
    `SELECT event, count() AS n
     FROM events
     WHERE event IN (${PWA_EVENTS.map((e) => `'${e}'`).join(", ")})
       AND timestamp >= now() - INTERVAL ${days} DAY
     GROUP BY event`,
  );
  const byEvent = new Map(response.results.map(([event, n]) => [String(event), Number(n)]));

  return {
    shown: byEvent.get("pwa_install_prompt_shown") ?? 0,
    accepted: byEvent.get("pwa_install_accepted") ?? 0,
    dismissed: byEvent.get("pwa_install_dismissed") ?? 0,
  };
}
