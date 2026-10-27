import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ANALYTICS_EVENT_NAMES } from "@/lib/analytics/events";
import { routing } from "@/i18n/routing";

// First-party analytics collector. Called by lib/analytics/track.ts via
// sendBeacon; always answers 204 immediately and inserts after the response,
// so tracking can never slow or break a page. Anything invalid, from a bot,
// or over the rate limit is silently dropped.
export const runtime = "nodejs";

const MAX_BODY_BYTES = 4096;
const ALLOWED = new Set<string>(ANALYTICS_EVENT_NAMES);
const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|node-fetch|axios|go-http|java\//i;

// Best-effort per-instance limiter (serverless instances don't share memory,
// which is fine: this only blunts a single noisy client, it isn't security).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    if (hits.size > 5000) hits.clear();
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

function deviceOf(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return "tablet";
  if (/mobi|iphone|ipod|android/i.test(ua)) return "mobile";
  return "desktop";
}

function cleanProps(input: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const [key, value] of Object.entries(input).slice(0, 12)) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(key)) continue;
    if (typeof value === "string") out[key] = value.slice(0, 120);
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean") out[key] = value;
  }
  return out;
}

const noContent = () => new Response(null, { status: 204 });

export async function POST(request: Request) {
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT_UA.test(ua)) return noContent();

  // Same-site calls only (an absent Origin is fine: sendBeacon same-origin).
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== request.headers.get("host")) return noContent();
    } catch {
      return noContent();
    }
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) return noContent();

  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return noContent();
    body = JSON.parse(text);
  } catch {
    return noContent();
  }

  const event = typeof body.event === "string" ? body.event : "";
  if (!ALLOWED.has(event)) return noContent();

  const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path.slice(0, 200) : null;
  // The dashboard itself is never tracked, whatever the client claims.
  if (path && /^\/(?:[a-z]{2}\/)?admin(?:\/|$)/.test(path)) return noContent();

  const locale = (routing.locales as readonly string[]).includes(String(body.locale))
    ? String(body.locale)
    : null;
  const visitorId =
    typeof body.visitorId === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.visitorId)
      ? body.visitorId
      : null;
  const referrer =
    typeof body.referrer === "string" && /^[a-z0-9.-]{1,100}$/i.test(body.referrer)
      ? body.referrer.toLowerCase()
      : null;

  const row = {
    event,
    props: cleanProps(body.props),
    path,
    locale,
    device: deviceOf(ua),
    referrer,
    visitor_id: visitorId,
  };

  after(async () => {
    const { error } = await createAdminClient().from("analytics_events").insert(row);
    if (error) console.error("analytics insert failed:", error.message);
  });
  return noContent();
}
