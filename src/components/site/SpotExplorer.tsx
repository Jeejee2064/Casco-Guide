"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, SearchX, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { SpotCard } from "./SpotCard";
import { Stagger, StaggerItem, TAP_SPRING, EASE_OUT } from "./motion";
import { useRouter } from "@/i18n/navigation";
import { isOpenNow } from "@/lib/hours";
import { useExploreFilter, type ExploreFilterMode } from "./ExploreFilterContext";
import { Button } from "@/components/ui/Button";
import type { PriceRange, Spot, SpotVibe } from "@/lib/types/database";
import { cn } from "@/lib/utils";

type SortKey = "newest" | "alpha" | "random";
const PRICE_LEVELS: PriceRange[] = ["$", "$$", "$$$", "$$$$"];
// How many spots show before the "show more" toggle — keeps the home page
// from dumping the entire (potentially huge) list at once. Only applies
// with no active search/filter, since a filtered result set is already the
// thing the visitor asked to see in full.
const INITIAL_VISIBLE = 8;

/** Deterministic Fisher-Yates shuffle, seeded — `Math.random` can't be called
 * during render (React flags it as an impure side effect there), so the seed
 * is rolled once in the sort <select>'s onChange instead and threaded through. */
function seededShuffle<T>(items: T[], seed: number): T[] {
  let s = seed >>> 0 || 1;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function SpotExplorer({
  spots,
  activeVibes = [],
  mode,
}: {
  spots: Spot[];
  /** The currently-selected vibes (see ExploreFilterBar/SpotsExplorerSection) —
   * `spots` already arrives pre-sorted by relevance to them. Threaded
   * through only so this component can (a) not clobber that order with its
   * own default sort, and (b) pass it to SpotCard for the match highlight. */
  activeVibes?: SpotVibe[];
  /** Classic↔Vibes toggle (see ExploreFilterBar/SpotsExplorerSection). Only used
   * to notice *when it flips* (see freshnessSeed below) — reshuffling the
   * grid on that switch even while "All" is selected on both sides, so
   * flipping the toggle always reads as new content, not a no-op. */
  mode: ExploreFilterMode;
}) {
  const t = useTranslations("filters");
  const router = useRouter();
  const explore = useExploreFilter();
  const [prices, setPrices] = useState<PriceRange[]>([]);
  const [openNow, setOpenNow] = useState(false);
  const [sort, setSort] = useState<SortKey>("newest");
  const [shuffleSeed, setShuffleSeed] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Random seed for the "fresh view" reshuffle triggered by flipping the
  // Classic↔Vibes toggle (see the effect below) — null until the first
  // flip, so the grid still opens in its normal newest-first order and
  // only starts shuffling once there's actually a switch to react to.
  const [freshnessSeed, setFreshnessSeed] = useState<number | null>(null);

  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (mode !== prevModeRef.current) {
      prevModeRef.current = mode;
      setFreshnessSeed(Math.random());
    }
  }, [mode]);

  const toggle = <T,>(list: T[], value: T, setter: (v: T[]) => void) =>
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const resetFilters = () => {
    setPrices([]);
    setOpenNow(false);
    setSort("newest");
    setExpanded(false);
  };

  // `spots` is already filtered by search/category/vibe (see SpotsExplorerSection)
  // — this only layers price/openNow/sort on top of that.
  const filtered = useMemo(() => {
    let result = spots.filter((spot) => {
      if (prices.length && (!spot.price_range || !prices.includes(spot.price_range)))
        return false;
      if (openNow && !isOpenNow(spot)) return false;
      return true;
    });

    switch (sort) {
      case "alpha":
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "random":
        result = seededShuffle(result, shuffleSeed);
        break;
      default:
        // "Newest" is the implicit default sort, but `spots` already comes
        // in vibe-relevance order when a vibe is active — re-sorting by
        // date here would silently discard that (the one thing the whole
        // reorder feature is supposed to make visible). An explicit sort
        // choice (alpha/random above) still wins either way.
        if (activeVibes.length === 0) {
          // No vibe driving the order — so with nothing else to make a
          // Classic↔Vibes toggle flip visually register, shuffle instead of
          // the usual date sort once that toggle has actually been flipped
          // (freshnessSeed stays null, i.e. this falls through to the plain
          // date sort, until the first flip — see the effect above).
          result =
            freshnessSeed !== null
              ? seededShuffle(result, freshnessSeed)
              : [...result].sort(
                  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                );
        }
    }
    return result;
  }, [spots, prices, openNow, sort, shuffleSeed, activeVibes, freshnessSeed]);

  const hasActiveFilters = prices.length > 0 || openNow;

  // Identity of the current result set/order. The grid doesn't render
  // `filtered` directly: when this key changes (any filter, vibe, search, mode
  // flip...) the page jumps back to the top first, and the grid swaps to the
  // new list two frames later. Framer's `layout` animations measure positions
  // when the list changes, so the scroll jump has to land *before* that
  // measurement — otherwise cards glide in from their old scroll position.
  const gridKey = useMemo(() => filtered.map((s) => s.id).join("|"), [filtered]);
  const [view, setView] = useState({ key: gridKey, list: filtered });
  // After the first swap, cards that mount fade/slide in on their own (before
  // that, the initial scroll-reveal stagger from <Stagger> handles it).
  const [swapped, setSwapped] = useState(false);
  // Same ids, fresh objects (e.g. refetched data) -> show them right away.
  const displayed = view.key === gridKey ? filtered : view.list;

  useEffect(() => {
    if (view.key === gridKey) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setView({ key: gridKey, list: filtered });
        setSwapped(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [gridKey, filtered, view.key]);

  // Truncate only the unfiltered, default list — once someone searches or
  // filters, show every match, since that's the result set they asked for.
  const canCollapse = !hasActiveFilters && displayed.length > INITIAL_VISIBLE;
  const visibleSpots = !hasActiveFilters && !expanded ? displayed.slice(0, INITIAL_VISIBLE) : displayed;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Filters trigger button is hidden — price/open-now/sort panel below
          is kept in place (unreachable via UI for now) rather than ripped
          out, since ExploreFilterBar's category/vibe chips cover the
          everyday filtering need. */}
      <AnimatePresence>
        {filtersOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFiltersOpen(false)}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="safe-bottom fixed inset-x-4 bottom-20 z-40 mx-auto max-w-md space-y-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-2xl sm:p-5"
            >
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-foreground/50">
                  {t("price")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRICE_LEVELS.map((p) => (
                    <button
                      key={p}
                      onClick={() => toggle(prices, p, setPrices)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-bold",
                        prices.includes(p)
                          ? "border-aqua bg-aqua text-white"
                          : "border-border bg-transparent",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={openNow}
                    onChange={(e) => setOpenNow(e.target.checked)}
                    className="h-4 w-4 accent-lime"
                  />
                  {t("openNow")}
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground/50">{t("sort")}</span>
                  <select
                    value={sort}
                    onChange={(e) => {
                      const next = e.target.value as SortKey;
                      setSort(next);
                      if (next === "random") setShuffleSeed(Math.random());
                    }}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold outline-none"
                  >
                    <option value="newest">{t("sortNewest")}</option>
                    <option value="alpha">{t("sortAlpha")}</option>
                    <option value="random">{t("sortRandom")}</option>
                  </select>
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-xs font-semibold text-coral"
                >
                  <X size={13} /> {t("reset")}
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {displayed.length > 0 ? (
        <>
          <Stagger
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            amount={0.05}
          >
            {/* Standard Motion recipe for a filtered grid: stable keys, `layout`
                so surviving cards glide to their new slot, `popLayout` so
                leaving cards drop out of the flow while they fade. */}
            <AnimatePresence mode="popLayout" initial={false}>
              {visibleSpots.map((spot, i) => (
                <StaggerItem
                  key={spot.id}
                  layout="position"
                  enter={swapped || expanded}
                  delay={Math.min(i, 12) * 0.045}
                  exitFast
                >
                  <SpotCard
                    spot={spot}
                    activeVibes={activeVibes}
                    priority={i < 3}
                    onClick={() =>
                      router.push({ pathname: "/spots/[slug]", params: { slug: spot.slug } })
                    }
                  />
                </StaggerItem>
              ))}
            </AnimatePresence>
          </Stagger>

          {canCollapse && (
            <div className="mt-6 flex justify-center">
              <motion.button
                onClick={() => setExpanded((v) => !v)}
                whileTap={{ scale: 0.96 }}
                whileHover={{ y: -1 }}
                transition={TAP_SPRING}
                className="group flex items-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground/70 transition-colors hover:border-aqua/50 hover:bg-gradient-to-r hover:from-aqua/5 hover:to-coral/5 hover:text-aqua"
              >
                {expanded ? (
                  <>
                    {t("showLess")}{" "}
                    <ChevronUp size={15} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
                  </>
                ) : (
                  <>
                    {t("showMore", { count: displayed.length - INITIAL_VISIBLE })}{" "}
                    <ChevronDown size={15} className="transition-transform duration-200 group-hover:translate-y-0.5" />
                  </>
                )}
              </motion.button>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          onReset={
            hasActiveFilters ||
            explore.query.trim() !== "" ||
            explore.categories.length > 0 ||
            explore.vibes.length > 0
              ? () => {
                  explore.setQuery("");
                  explore.setCategories([]);
                  explore.setVibes([]);
                  setPrices([]);
                  setOpenNow(false);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function EmptyState({ onReset }: { onReset?: () => void }) {
  const t = useTranslations("empty");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border py-16 text-center">
      <SearchX size={36} className="text-foreground/25" />
      <p className="font-heading text-lg font-bold">{t("title")}</p>
      <p className="text-sm text-foreground/60">{t("subtitle")}</p>
      {onReset && (
        <Button type="button" variant="outline" className="mt-3" onClick={onReset}>
          <X size={16} /> {t("reset")}
        </Button>
      )}
    </div>
  );
}
