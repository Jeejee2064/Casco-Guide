"use client";

import { useEffect, useState } from "react";
import { SpotDetailView } from "@/components/site/SpotDetailView";
import type { Spot } from "@/lib/types/database";

/**
 * Bare rendering surface loaded inside an <iframe> by the admin SpotForm's
 * mobile preview. It gets its own real (narrow) viewport, so the `sm:`/`lg:`
 * Tailwind classes inside SpotDetailView correctly evaluate as mobile —
 * a plain scaled-down <div> can't do that, since those are viewport media
 * queries, not container queries.
 *
 * There's nothing to fetch: the spot being previewed is an in-progress,
 * unsaved draft. It's received via postMessage from the parent window
 * (same-origin only) once this frame announces it's ready.
 */
export default function SpotPreviewFramePage() {
  const [spot, setSpot] = useState<Spot | null>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "spot-preview") setSpot(e.data.spot as Spot);
    }
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "spot-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!spot) return null;
  return <SpotDetailView spot={spot} />;
}
