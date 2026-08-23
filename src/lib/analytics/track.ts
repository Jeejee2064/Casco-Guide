"use client";

import posthog from "posthog-js";

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
  | { name: "pwa_install_prompt_shown"; props: { variant: "ios" | "installable" } }
  | { name: "pwa_install_accepted"; props: Record<string, never> }
  | { name: "pwa_install_dismissed"; props: { variant: "ios" | "installable" } };

export function track<E extends AnalyticsEvent["name"]>(
  name: E,
  props: Extract<AnalyticsEvent, { name: E }>["props"],
) {
  posthog.capture(name, props);
}
