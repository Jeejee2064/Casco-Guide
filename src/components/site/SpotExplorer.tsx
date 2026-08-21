"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, SearchX, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { SpotCard } from "./SpotCard";
import { Stagger, StaggerItem, TAP_SPRING, EASE_OUT } from "./motion";
import { useRouter } from "@/i18n/navigation";
import { isOpenNow } from "@/lib/hours";
import type { PriceRange, Spot } from "@/lib/types/database";
import { cn } from "@/lib/utils";

type SortKey = "newest" | "rating" | "alpha" | "random";
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

export function SpotExplorer({ spots }: { spots: Spot[] }) {
  const t = useTranslations("filters");
  const router = useRouter();
  const [prices, setPrices] = useState<PriceRange[]>([]);
  const [openNow, setOpenNow] = useState(false);
  const [sort, setSort] = useState<SortKey>("newest");
  const [shuffleSeed, setShuffleSeed] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const toggle = <T,>(list: T[], value: T, setter: (v: T[]) => void) =>
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const resetFilters = () => {
    setPrices([]);
    setOpenNow(false);
    setSort("newest");
    setExpanded(false);
  };

  // `spots` is already filtered by search/category/vibe (see ExploreSection)
  // — this only layers price/openNow/sort on top of that.
  const filtered = useMemo(() => {
    let result = spots.filter((spot) => {
      if (prices.length && (!spot.price_range || !prices.includes(spot.price_range)))
        return false;
      if (openNow && !isOpenNow(spot)) return false;
      return true;
    });

    switch (sort) {
      case "rating":
        result = [...result].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case "alpha":
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "random":
        result = seededShuffle(result, shuffleSeed);
        break;
      default:
        result = [...result].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
    }
    return result;
  }, [spots, prices, openNow, sort, shuffleSeed]);

  const hasActiveFilters = prices.length > 0 || openNow;
  const activeFilterCount = prices.length + (openNow ? 1 : 0);

  // Truncate only the unfiltered, default list — once someone searches or
  // filters, show every match, since that's the result set they asked for.
  const canCollapse = !hasActiveFilters && filtered.length > INITIAL_VISIBLE;
  const visibleSpots = !hasActiveFilters && !expanded ? filtered.slice(0, INITIAL_VISIBLE) : filtered;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Floating, always-reachable filters trigger — bottom-right thumb zone, survives scroll.
          Search, category, price, open-now and sort all live in the one panel below it. */}
      <div className="safe-bottom fixed bottom-4 right-4 z-40">
        <motion.button
          onClick={() => setFiltersOpen((v) => !v)}
          whileTap={{ scale: 0.94 }}
          transition={TAP_SPRING}
          className={cn(
            "flex h-12 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold shadow-lg transition-colors",
            hasActiveFilters ? "border-transparent bg-aqua text-white" : "glass border-border",
          )}
        >
          <SlidersHorizontal size={16} />
          {t("title")}
          {hasActiveFilters && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-[10px] text-white">
              {activeFilterCount}
            </span>
          )}
        </motion.button>
      </div>

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
                    <option value="rating">{t("sortRating")}</option>
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

      {filtered.length > 0 ? (
        <>
          <Stagger
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            amount={0.05}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {visibleSpots.map((spot) => (
                <StaggerItem key={spot.id} layout>
                  <SpotCard
                    spot={spot}
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
                transition={TAP_SPRING}
                className="flex items-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground/70 transition-colors hover:border-aqua hover:text-aqua"
              >
                {expanded ? (
                  <>
                    {t("showLess")} <ChevronUp size={15} />
                  </>
                ) : (
                  <>
                    {t("showMore", { count: filtered.length - INITIAL_VISIBLE })}{" "}
                    <ChevronDown size={15} />
                  </>
                )}
              </motion.button>
            </div>
          )}
        </>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState() {
  const t = useTranslations("empty");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border py-16 text-center">
      <SearchX size={36} className="text-foreground/25" />
      <p className="font-heading text-lg font-bold">{t("title")}</p>
      <p className="text-sm text-foreground/60">{t("subtitle")}</p>
    </div>
  );
}
