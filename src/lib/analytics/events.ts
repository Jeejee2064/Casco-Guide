/** Every event the collector accepts (anything else is dropped). "pageview"
 * is sent by PageviewTracker, the rest by track() — keep in sync with the
 * AnalyticsEvent union in track.ts. */
export const ANALYTICS_EVENT_NAMES = [
  "pageview",
  "spot_view",
  "article_view",
  "event_view",
  "filter_applied",
  "search_performed",
  "night_mode_toggle",
  "language_switch",
  "map_spot_click",
  "directions_click",
  "whatsapp_click",
  "event_booking_click",
  "share_click",
  "pwa_install_prompt_shown",
  "pwa_install_accepted",
  "pwa_install_dismissed",
] as const;
