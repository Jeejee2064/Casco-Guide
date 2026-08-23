"use client";

import { useMemo } from "react";
import { SpotExplorer } from "./SpotExplorer";
import { ExploreFilterBar } from "./ExploreFilterBar";
import {
  ExploreFilterProvider,
  useExploreFilter,
  type ExploreFilterMode,
} from "./ExploreFilterContext";
import { vibeRelevanceScore } from "@/lib/vibes";
import type { Spot, SpotVibe } from "@/lib/types/database";

// Stable "nothing selected" reference for classic mode (see activeVibes
// below) — a fresh `[]` literal there every render would change identity on
// every unrelated re-render and needlessly retrigger anything that depends
// on it (SpotMap's marker-rebuild effect, on the /map page's own version of
// this pattern, in particular).
const NO_VIBES: SpotVibe[] = [];

/**
 * The /spots page's content — search bar, Classic↔Vibes chip row, and the
 * grid. Filtering logic lifted straight out of the old ExploreSection
 * (which used to also own a grid↔map toggle; now that grid and map are
 * separate pages, this is just the grid half).
 */
function SpotsExplorerContent({ spots }: { spots: Spot[] }) {
  // Category, search and (when in vibes mode) vibe all narrow the set —
  // each is single-select (see ExploreFilterBar's toggleCategory/toggleVibe),
  // while search/category/vibe still AND together. Among those matches,
  // higher-relevance (i.e. higher-rated, or a closer match to the selected
  // vibe) spots still sort first.
  const { mode, query, categories, vibes } = useExploreFilter();
  const filteredSpots = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = spots.filter((spot) => {
      if (mode === "classic" && categories.length > 0 && !categories.includes(spot.category))
        return false;
      if (mode === "vibes" && vibes.length > 0 && !vibes.some((v) => spot.vibes.includes(v)))
        return false;
      if (q) {
        const haystack = [spot.name, spot.description, spot.cuisine_type, ...(spot.tags ?? [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    if (mode !== "vibes" || vibes.length === 0) return matched;
    // Best-matching selected vibe wins a spot's score — a spot tagged with
    // two of the three selected vibes shouldn't rank behind one that only
    // matches its single best vibe less well. Stable sort (native in modern
    // engines) — spots tied on relevance keep their prior relative order
    // instead of jumping around pointlessly.
    const scoreOf = (spot: Spot) => Math.max(...vibes.map((v) => vibeRelevanceScore(spot, v)));
    return [...matched].sort((a, b) => scoreOf(b) - scoreOf(a));
  }, [spots, mode, categories, vibes, query]);

  // Only meaningful for the grid's SpotCard highlight — which vibes are the
  // current reorder/highlight keyed on, separate from `mode` itself so it
  // doesn't need to know about "classic". `NO_VIBES` (not a fresh `[]`)
  // keeps this reference-stable outside vibes mode.
  const activeVibes = mode === "vibes" ? vibes : NO_VIBES;

  return (
    <div className="pb-20">
      <ExploreFilterBar spots={spots} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <SpotExplorer spots={filteredSpots} activeVibes={activeVibes} mode={mode} />
      </div>
    </div>
  );
}

export function SpotsExplorerSection({
  spots,
  initialMode = "classic",
  initialVibes = [],
}: {
  spots: Spot[];
  /** Seeded server-side from the homepage vibe teaser's `?vibe=`/`?mode=vibes`
   * deep links (see spots/page.tsx) — opens straight into vibes mode
   * instead of requiring a click through the discovery modal. */
  initialMode?: ExploreFilterMode;
  initialVibes?: SpotVibe[];
}) {
  return (
    <ExploreFilterProvider initialMode={initialMode} initialVibes={initialVibes}>
      <SpotsExplorerContent spots={spots} />
    </ExploreFilterProvider>
  );
}
