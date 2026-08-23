"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { SpotCategory, SpotVibe } from "@/lib/types/database";

export type ExploreFilterMode = "classic" | "vibes";

interface ExploreFilterContextValue {
  mode: ExploreFilterMode;
  setMode: (mode: ExploreFilterMode) => void;
  query: string;
  setQuery: (q: string) => void;
  // Single-select ([] = "All", otherwise exactly one) — still array-typed
  // (rather than `SpotCategory | null`) since SpotExplorer/SpotMap's
  // matching logic (`categories.includes(...)`) is written against a set,
  // and vibeRelevanceScore/activeVibes elsewhere already expect an array.
  categories: SpotCategory[];
  setCategories: (c: SpotCategory[]) => void;
  vibes: SpotVibe[]; // Same deal: [] = "All", otherwise exactly one.
  setVibes: (v: SpotVibe[]) => void;
}

const ExploreFilterContext = createContext<ExploreFilterContextValue | null>(null);

/**
 * Shared search/category/vibe filter state for the /spots and /map pages —
 * lifted above ExploreFilterBar so it and SpotExplorer/SpotMap (siblings,
 * not parent/child) both read the same selection. `categories` and `vibes`
 * are independent and both persist across Classic↔Vibes mode switches —
 * only `mode` decides which one is active.
 */
export function ExploreFilterProvider({
  children,
  initialMode = "classic",
  initialVibes = [],
}: {
  children: ReactNode;
  /** Seeds the page open directly into vibes mode — used by /spots's
   * `?vibe=`/`?mode=vibes` deep links (the homepage's vibe teaser cards). */
  initialMode?: ExploreFilterMode;
  /** Seeds the initially-selected vibe(s) — same deep-link use as above. */
  initialVibes?: SpotVibe[];
}) {
  const [mode, setMode] = useState<ExploreFilterMode>(initialMode);
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<SpotCategory[]>([]);
  const [vibes, setVibes] = useState<SpotVibe[]>(initialVibes);

  return (
    <ExploreFilterContext.Provider
      value={{ mode, setMode, query, setQuery, categories, setCategories, vibes, setVibes }}
    >
      {children}
    </ExploreFilterContext.Provider>
  );
}

const noop = () => {};

/** Falls back to "classic, nothing selected, can't be changed" outside the
 * provider, so a stray consumer degrades quietly instead of throwing. */
export function useExploreFilter(): ExploreFilterContextValue {
  const ctx = useContext(ExploreFilterContext);
  return (
    ctx ?? {
      mode: "classic",
      setMode: noop,
      query: "",
      setQuery: noop,
      categories: [],
      setCategories: noop,
      vibes: [],
      setVibes: noop,
    }
  );
}
