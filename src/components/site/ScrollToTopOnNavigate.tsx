"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Site-wide "land at the top of the page" fix for client-side navigation.
 *
 * Next's own scroll restoration (`<Link>`'s default `scroll={true}`) only
 * resets to the top when it decides the new page's top element isn't
 * already visible in the current viewport (per the App Router docs). With
 * a sticky Header shared by every route, that check keeps getting fooled —
 * client-side navigation was landing wherever the *previous* page happened
 * to be scrolled to, on every route, not just detail pages. Three detail
 * views (SpotDetailView/ArticleDetailView/EventDetailView) already worked
 * around this locally with their own `window.scrollTo(0, 0)` for the case
 * of navigating from one instance of themselves to another (e.g. a
 * "nearby spot" card); this component is the same fix, applied once,
 * site-wide, for every other route those three don't cover.
 *
 * Mounted once in the root `[locale]` layout — not per-page — so it never
 * remounts itself and can't replay any page's own mount animations (a
 * `template.tsx`, which *does* remount on every navigation, would have
 * re-triggered Header's slide-in entrance on every single page change,
 * since Header is rendered per-page, not in this layout).
 */
export function ScrollToTopOnNavigate() {
  const pathname = usePathname();
  // Skip the very first run — a hard-loaded URL with a `#hash` should still
  // get the browser's native scroll-to-anchor, not get snapped back to the
  // top right after hydration.
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
