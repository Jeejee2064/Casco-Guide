"use client";

import { useEffect, useState } from "react";
import { EventDetailView } from "@/components/site/EventDetailView";
import type { EventRow } from "@/lib/types/database";

/**
 * Bare rendering surface loaded inside an <iframe> by the admin EventForm's
 * mobile preview — see SpotPreviewFramePage (admin/preview/spots) for why
 * this needs its own real viewport instead of a scaled-down container.
 *
 * The host venue card is skipped here (hostSpot is always null): resolving
 * it would mean an extra DB round trip for a draft that may not be saved
 * yet, for a "hosted at" card that's a minor part of the preview.
 */
export default function EventPreviewFramePage() {
  const [event, setEvent] = useState<EventRow | null>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "event-preview") setEvent(e.data.event as EventRow);
    }
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "event-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!event) return null;
  return <EventDetailView event={event} hostSpot={null} />;
}
