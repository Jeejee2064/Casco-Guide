"use client";

import { useEffect } from "react";
import { OPT_OUT_KEY } from "@/lib/analytics/track";

/**
 * Keeps our own team's browsing out of the public site's numbers — opening
 * any page under /admin/(protected) flags this browser (persisted, so it
 * also covers the public pages visited afterwards) and track() then sends
 * nothing from it. Rendered by the protected admin layout, nothing else.
 */
export function AdminAnalyticsOptOut() {
  useEffect(() => {
    try {
      localStorage.setItem(OPT_OUT_KEY, "1");
    } catch {
      // Storage blocked — the collector still ignores /admin paths itself.
    }
  }, []);

  return null;
}
