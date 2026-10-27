"use client";


type AnalyticsEvent =
  | { name: "spot_view"; props: { spot_id: string; spot_slug: string; category: string } }
  | { name: "article_view"; props: { article_id: string; article_slug: string } }
  | { name: "event_view"; props: { event_id: string; event_slug: string } }
  | {
      name: "filter_applied";
      props: { mode: "classic" | "vibes"; kind: "category" | "vibe"; value: string };
    }
  | { name: "search_performed"; props: { result_count: number } }
  | { name: "night_mode_toggle"; props: { to: "night" | "day" } }
  | { name: "language_switch"; props: { to: string } }
  | { name: "map_spot_click"; props: { spot_id: string; spot_slug: string } }
  | {
      name: "directions_click";
      props: { entity: "spot" | "event"; entity_id: string; entity_slug: string };
    }
  | { name: "whatsapp_click"; props: { spot_id: string; spot_slug: string } }
  | { name: "event_booking_click"; props: { event_id: string; event_slug: string } }
  | {
      name: "share_click";
      props: {
        entity: "spot" | "event" | "article";
        entity_id: string;
        entity_slug: string;
        channel:
          | "native"
          | "whatsapp"
          | "facebook"
          | "twitter"
          | "telegram"
          | "email"
          | "copy_link";
      };
    }
  | { name: "pwa_install_prompt_shown"; props: { variant: "ios" | "installable" } }
  | { name: "pwa_install_accepted"; props: Record<string, never> }
  | { name: "pwa_install_dismissed"; props: { variant: "ios" | "installable" } };

const ENDPOINT = "/api/track";
const VISITOR_KEY = "cv_visitor";
/** Set by the admin layout: the team's own browsing stays out of the stats. */
export const OPT_OUT_KEY = "cv_no_track";

function visitorId(): string | null {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null; // storage blocked — the event still counts, just not as a unique visitor
  }
}

function optedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Fire-and-forget POST to our own collector (/api/track → Supabase).
 * sendBeacon survives page unloads and never blocks; fetch+keepalive is the
 * fallback. Failures are swallowed on purpose — tracking must never break UX. */
export function sendEvent(
  event: string,
  props: Record<string, unknown> = {},
  extra: { referrer?: string } = {},
) {
  if (typeof window === "undefined" || optedOut()) return;
  const body = JSON.stringify({
    event,
    props,
    path: window.location.pathname,
    locale: document.documentElement.lang,
    visitorId: visitorId(),
    ...extra,
  });
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}

export function track<E extends AnalyticsEvent["name"]>(
  name: E,
  props: Extract<AnalyticsEvent, { name: E }>["props"],
) {
  sendEvent(name, props);
}
