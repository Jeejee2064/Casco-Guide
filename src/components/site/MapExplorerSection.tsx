"use client";

import { useMemo, useState } from "react";
import { SpotMap } from "./SpotMap";
import { ExploreFilterBar } from "./ExploreFilterBar";
import {
  ExploreFilterProvider,
  useExploreFilter,
  type ExploreFilterMode,
} from "./ExploreFilterContext";
import { vibeRelevanceScore } from "@/lib/vibes";
import { groupSpotsByParent } from "@/lib/spots/hierarchy";
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
  initialDirectionsSlug,
}: {
  spots: Spot[];
  events: EventRow[];
  autoOpenVibesModal: boolean;
  initialDirectionsSlug: string | null;
}) {
  const { mode, query, categories, vibes } = useExploreFilter();

  // SpotDetailView's "Get directions" button sends visitors here as
  // `?directions=<slug>` (read server-side by map/page.tsx, same as its
  // `?vibe=`/`?mode=` deep links) instead of opening Google Maps directly —
  // resolved against the full, unfiltered `spots` list (not just `topLevel`
  // below) so a hub's own business (e.g. a hotel's on-site restaurant) still
  // resolves even though it isn't rendered as its own pin. SpotMap only
  // consumes this once (see its `initialDirectionsSpot` doc comment), so a
  // filter/search narrowing `spots` afterward can't yank the visitor back
  // out of it.
  const initialDirectionsSpot = useMemo(
    () =>
      initialDirectionsSlug
        ? (spots.find((s) => s.slug === initialDirectionsSlug) ?? null)
        : null,
    [spots, initialDirectionsSlug],
  );

  // Grouped off the full, unfiltered list — a hub's children still need to
  // be known even when the hub itself gets filtered out below.
  const { topLevel, childrenByParent } = useMemo(
    () => groupSpotsByParent(spots),
    [spots],
  );

  const filteredSpots = useMemo(() => {
    const q = query.trim().toLowerCase();
    // A vibe chip is a hard filter here, same as a classic-mode category —
    // picking one removes every non-matching pin from the map outright,
    // rather than leaving them on screen dimmed/shrunk.
    const matchesFilters = (spot: Spot) => {
      if (
        mode === "classic" &&
        categories.length > 0 &&
        !categories.includes(spot.category)
      )
        return false;
      if (
        mode === "vibes" &&
        vibes.length > 0 &&
        !vibes.some((v) => spot.vibes.includes(v))
      )
        return false;
      if (q) {
        const haystack = [
          spot.name,
          spot.description,
          spot.cuisine_type,
          ...(spot.tags ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    };

    if (mode === "vibes" && vibes.length > 0) {
      // Vibes mode: a hub's grouped pin only stands in for its children when
      // the hub *itself* carries the vibe — that's the only case where
      // showing one colored pin with a child-count badge actually reflects
      // what matched. When only a business inside the hub carries it, the
      // hub's own pin has no vibe of its own to color with (SpotMap falls
      // back to the neutral tone, which reads as a stray mismatched pin next
      // to every correctly-colored one) and the badge just says "N inside"
      // without saying which one — so surface that business's own pin
      // instead, correctly colored, rather than hiding it behind the hub.
      const result: Spot[] = [];
      for (const spot of topLevel) {
        if (matchesFilters(spot)) {
          result.push(spot);
          continue;
        }
        const children = childrenByParent.get(spot.id) ?? [];
        result.push(...children.filter(matchesFilters));
      }
      const scoreOf = (spot: Spot) =>
        Math.max(...vibes.map((v) => vibeRelevanceScore(spot, v)));
      return result.sort((a, b) => scoreOf(b) - scoreOf(a));
    }

    // Classic mode: a hub pin stays on screen if it matches directly, or if
    // any business inside it does — otherwise filtering to e.g. "bar" would
    // hide a hotel that happens to have a bar attached, defeating the point
    // of grouping them under one pin.
    return topLevel.filter((spot) => {
      const children = childrenByParent.get(spot.id) ?? [];
      return matchesFilters(spot) || children.some(matchesFilters);
    });
  }, [topLevel, childrenByParent, mode, categories, vibes, query]);

  const activeVibes = mode === "vibes" ? vibes : NO_VIBES;

  // SpotMap's mobile detail sheet is `position: fixed` inside SpotMap's own
  // stacking context (see its `onSelectionChange` doc comment) — no z-index
  // on the filter bar's bottom shelf can ever put it above that sheet, so
  // hiding the shelf while a pin is selected is the actual fix.
  const [hasSelection, setHasSelection] = useState(false);
  // Itinerary mode takes over the screen (DirectionsPanel sits where the
  // filters do), so the filters step aside for it. Seeded from the deep link
  // so arriving via "Get directions" never flashes them first.
  const [inDirections, setInDirections] = useState(initialDirectionsSpot != null);

  return (
    <div>
      <ExploreFilterBar
        spots={spots}
        fixed
        autoOpenVibesModal={autoOpenVibesModal}
        hideFloatingBottomBar={hasSelection}
        hideFilters={inDirections}
      />
      <SpotMap
        spots={filteredSpots}
        events={events}
        fullScreen
        useVibeIcons={mode === "vibes"}
        activeVibes={activeVibes}
        childrenBySpotId={childrenByParent}
        initialDirectionsSpot={initialDirectionsSpot}
        onSelectionChange={setHasSelection}
        onDirectionsChange={setInDirections}
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
  initialDirectionsSlug = null,
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
  /** SpotDetailView's "Get directions" button's `?directions=<slug>` deep
   * link — arms SpotMap's itinerary mode for this spot as soon as the map's
   * ready. Parsed server-side by map/page.tsx, same as the vibe params
   * above, rather than via useSearchParams() here. */
  initialDirectionsSlug?: string | null;
}) {
  return (
    <ExploreFilterProvider
      initialMode={initialMode}
      initialVibes={initialVibes}
    >
      <MapExplorerContent
        spots={spots}
        events={events}
        autoOpenVibesModal={autoOpenVibesModal}
        initialDirectionsSlug={initialDirectionsSlug}
      />
    </ExploreFilterProvider>
  );
}
