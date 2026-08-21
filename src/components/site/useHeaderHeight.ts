"use client";

import { useEffect, useState } from "react";

/** The sticky site header's real rendered height — grows with safe-area
 * insets on notched devices, so it's measured via ResizeObserver instead
 * of assumed, keeping anything that needs to sit "under the header"
 * (SpotMap's fullScreen mode, ExploreFilterBar) from drifting out of sync
 * with it. Pass `enabled: false` to skip observing when not needed. */
export function useHeaderHeight(enabled: boolean): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const header = document.querySelector("header");
    if (!header) return;
    const update = () => setHeight(header.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(header);
    return () => ro.disconnect();
  }, [enabled]);

  return height;
}
