"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

interface ExploreViewContextValue {
  isMapView: boolean;
  setIsMapView: (value: boolean) => void;
}

const ExploreViewContext = createContext<ExploreViewContextValue | null>(null);

/**
 * Shares "is the full map currently open" between Header and ExploreSection
 * — they're siblings under the home page's Server Component, not
 * parent/child, so this is the plumbing that lets Header hide its nav and
 * show a back button while the map's up.
 *
 * Deliberately plain client state, not the URL: this page is dynamic (hits
 * Supabase for spots/events/articles on every render), so routing through
 * `router.push`/`replace` for something that should feel like an instant tab
 * switch cost a full server round-trip per click — over a second where nothing
 * had visibly changed yet. `?view=map` is still read once on mount (so the
 * "explore the full map" CTA still works), just never written back.
 */
export function ExploreViewProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const [isMapView, setIsMapView] = useState(() => searchParams.get("view") === "map");

  return (
    <ExploreViewContext.Provider value={{ isMapView, setIsMapView }}>
      {children}
    </ExploreViewContext.Provider>
  );
}

const noop = () => {};

/** Falls back to "not map view, can't be changed" outside the provider —
 * Header renders on every page (spot/event detail pages included), and only
 * the home page, where "map view" actually exists, wraps it in one. */
export function useExploreView(): ExploreViewContextValue {
  const ctx = useContext(ExploreViewContext);
  return ctx ?? { isMapView: false, setIsMapView: noop };
}
