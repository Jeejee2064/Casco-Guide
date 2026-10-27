"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { sendEvent } from "@/lib/analytics/track";

/** One `pageview` per client-side navigation (the App Router never reloads,
 * so this can't be a plain script). The external referrer is only meaningful
 * for the first page of a visit — later pages' document.referrer is stale —
 * so it's attached to that one alone. Mounted once in the locale layout. */
export function PageviewTracker() {
  const pathname = usePathname();
  const isFirst = useRef(true);

  useEffect(() => {
    let referrer: string | undefined;
    if (isFirst.current && document.referrer) {
      try {
        const host = new URL(document.referrer).hostname;
        if (host !== window.location.hostname) referrer = host;
      } catch {
        // malformed referrer — ignore
      }
    }
    isFirst.current = false;
    sendEvent("pageview", {}, { referrer });
  }, [pathname]);

  return null;
}
