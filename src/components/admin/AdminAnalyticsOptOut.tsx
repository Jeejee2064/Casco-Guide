"use client";

import { useEffect } from "react";
import { loadPosthog } from "@/lib/analytics/posthog-client";

/**
 * Keeps our own team's admin usage out of the public site's PostHog
 * numbers — every page under /admin/(protected) opts the browser out for
 * the rest of the session (persisted, not just this mount) the moment it
 * loads. Rendered by the protected admin layout, nothing else.
 */
export function AdminAnalyticsOptOut() {
  useEffect(() => {
    // Waits for the (lazily loaded) SDK so the opt-out lands on an
    // initialized instance, before it can record anything meaningful.
    void loadPosthog()
      .then((posthog) => {
        if (posthog && !posthog.has_opted_out_capturing()) posthog.opt_out_capturing();
      })
      .catch(() => {
        // Analytics opt-out failing shouldn't block the admin from loading.
      });
  }, []);

  return null;
}
