"use client";

import { useCallback } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * Real "back" navigation for a detail page (spot/event) — returns to
 * wherever the visitor actually came from (the map, the /spots grid, an
 * article's "places mentioned" list...) instead of a hardcoded link home,
 * since every in-app Link/router.push already pushes a real browser history
 * entry for whatever page it came from.
 *
 * Falls back to home only when there's nothing to go back to *in this tab*
 * (a shared link opened directly, a fresh tab) — otherwise `history.back()`
 * would either no-op or strand the visitor outside the site, and the button
 * would look broken.
 */
export function useSmartBack() {
  const router = useRouter();
  return useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }, [router]);
}
