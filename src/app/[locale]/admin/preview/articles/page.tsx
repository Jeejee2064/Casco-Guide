"use client";

import { useEffect, useState } from "react";
import { ArticleDetailView } from "@/components/site/ArticleDetailView";
import type { Article, EventRow, Spot } from "@/lib/types/database";

/**
 * Bare rendering surface loaded inside an <iframe> by the admin ArticleForm's
 * mobile preview — see admin/preview/spots/page.tsx for why this needs its
 * own real viewport. The article being previewed (plus its already-resolved
 * cited spots/events) is an in-progress, unsaved draft, received via
 * postMessage from the parent window once this frame announces it's ready.
 */
export default function ArticlePreviewFramePage() {
  const [state, setState] = useState<{ article: Article; citedSpots: Spot[]; citedEvents: EventRow[] } | null>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "article-preview") {
        setState({ article: e.data.article, citedSpots: e.data.citedSpots, citedEvents: e.data.citedEvents });
      }
    }
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "article-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!state) return null;
  return <ArticleDetailView article={state.article} citedSpots={state.citedSpots} citedEvents={state.citedEvents} />;
}
