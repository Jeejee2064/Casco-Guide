"use client";

import { useMemo } from "react";
import { SpotMap } from "./SpotMap";
import { ExploreFilterBar } from "./ExploreFilterBar";
import {
  ExploreFilterProvider,
  useExploreFilter,
  type ExploreFilterMode,
} from "./ExploreFilterContext";
import { vibeRelevanceScore } from "@/lib/vibes";
import type { EventRow, Spot, SpotVibe } from "@/lib/types/database";

const NO_VIBES: SpotVibe[] = [];

/**
 * The /map page's content — same search/category/vibe filtering as
 * SpotsExplorerSection (the /spots page), feeding a fullScreen SpotMap
 * instead of a grid. Split out of the old ExploreSection, which used to
 * toggle between this and the grid on one page; now that they're separate
 * routes this is just the map half.
 */
function MapExplorerContent({
  spots,
  events,
  autoOpenVibesModal,
}: {
  spots: Spot[];
  events: EventRow[];
  autoOpenVibesModal: boolean;
}) {
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
    const scoreOf = (spot: Spot) => Math.max(...vibes.map((v) => vibeRelevanceScore(spot, v)));
    return [...matched].sort((a, b) => scoreOf(b) - scoreOf(a));
  }, [spots, mode, categories, vibes, query]);

  const activeVibes = mode === "vibes" ? vibes : NO_VIBES;

  return (
    <div>
      <ExploreFilterBar spots={spots} fixed autoOpenVibesModal={autoOpenVibesModal} />
      <SpotMap
        spots={filteredSpots}
        events={events}
        fullScreen
        useVibeIcons={mode === "vibes"}
        activeVibes={activeVibes}
      />
    </div>
  );
}

export function MapExplorerSection({
  spots,
  events = [],
  initialMode = "classic",
  initialVibes = [],
  autoOpenVibesModal = false,
}: {
  spots: Spot[];
  events?: EventRow[];
  /** Seeded server-side from the homepage vibe teaser's `?mode=vibes` deep
   * link (see map/page.tsx) — opens straight into vibes mode instead of
   * requiring a click through the toggle. */
  initialMode?: ExploreFilterMode;
  initialVibes?: SpotVibe[];
  /** Same deep link's `?vibesModal=1` — pops VibesModal open immediately,
   * since "Discover your vibe" is explicitly asking to see it. */
  autoOpenVibesModal?: boolean;
}) {
  return (
    <ExploreFilterProvider initialMode={initialMode} initialVibes={initialVibes}>
      <MapExplorerContent spots={spots} events={events} autoOpenVibesModal={autoOpenVibesModal} />
    </ExploreFilterProvider>
  );
}
