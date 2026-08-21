"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { SpotCategory, SpotVibe } from "@/lib/types/database";

export type ExploreFilterMode = "classic" | "vibes";

interface ExploreFilterContextValue {
  mode: ExploreFilterMode;
  setMode: (mode: ExploreFilterMode) => void;
  query: string;
  setQuery: (q: string) => void;
  category: SpotCategory | null; // null = "All"
  setCategory: (c: SpotCategory | null) => void;
  vibe: SpotVibe | null; // null = "All"
  setVibe: (v: SpotVibe | null) => void;
}

const ExploreFilterContext = createContext<ExploreFilterContextValue | null>(null);

/**
 * Shared search/category/vibe filter state for the explore screen —
 * same reasoning as ExploreViewContext (isMapView): SpotExplorer and
 * SpotMap are fully unmounted/remounted by ExploreSection's grid/map
 * AnimatePresence switch, so local useState in either wouldn't survive
 * a List↔Map toggle. Lifting the filter state here, above ExploreSection,
 * is what lets the top filter bar's selection stay "locked" across that
 * toggle. `category` and `vibe` are independent and both persist across
 * Classic↔Vibes mode switches — only `mode` decides which one is active.
 */
export function ExploreFilterProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ExploreFilterMode>("classic");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SpotCategory | null>(null);
  const [vibe, setVibe] = useState<SpotVibe | null>(null);

  return (
    <ExploreFilterContext.Provider
      value={{ mode, setMode, query, setQuery, category, setCategory, vibe, setVibe }}
    >
      {children}
    </ExploreFilterContext.Provider>
  );
}

const noop = () => {};

/** Falls back to "classic, nothing selected, can't be changed" outside the
 * provider — mirrors useExploreView's fallback for the same reason. */
export function useExploreFilter(): ExploreFilterContextValue {
  const ctx = useContext(ExploreFilterContext);
  return (
    ctx ?? {
      mode: "classic",
      setMode: noop,
      query: "",
      setQuery: noop,
      category: null,
      setCategory: noop,
      vibe: null,
      setVibe: noop,
    }
  );
}
