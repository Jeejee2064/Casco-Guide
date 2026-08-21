"use client";

import { motion } from "framer-motion";
import { Moon, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { TAP_SPRING } from "./motion";
import { useExploreView } from "./ExploreViewContext";
import { useExploreFilter, type ExploreFilterMode } from "./ExploreFilterContext";
import { useHeaderHeight } from "./useHeaderHeight";
import { useNightMode } from "./NightModeContext";
import { NightModeToggle } from "./NightModeToggle";
import { CATEGORY_META, SPOT_CATEGORIES } from "@/lib/categories";
import { VIBE_META, SPOT_VIBES } from "@/lib/vibes";
import { cn } from "@/lib/utils";

/**
 * Always-visible top filter bar for the explore screen: search, a
 * Classic↔Vibes segmented control, and one chip row (8 categories or 6
 * vibes, single-select with an explicit "All"). Rendered once by
 * ExploreSection, above its grid/map AnimatePresence switch, so it's
 * never unmounted by the List↔Map toggle — its state lives in
 * ExploreFilterContext for the same reason.
 *
 * Positioning: `sticky` alone looks sufficient but isn't — load the page
 * fresh (scrollY 0, still on the Hero) and tap straight to Map view, and a
 * sticky bar never gets the chance to "stick" before SpotMap's fullScreen
 * effect freezes body scroll, stranding it off-screen. So this switches to
 * `fixed` while the map view is active (mirroring why SpotMap itself uses
 * `fixed`, not `sticky`, for the exact same reason) and back to `sticky`
 * for the grid, where live scroll makes it safe (and gives the bonus of
 * staying visible while scrolling the grid).
 */
export function ExploreFilterBar() {
  const t = useTranslations("filters");
  const tSite = useTranslations("site");
  const tCategory = useTranslations("category");
  const tVibe = useTranslations("vibe");
  const tNight = useTranslations("night");
  const { isMapView } = useExploreView();
  const { mode, setMode, query, setQuery, category, setCategory, vibe, setVibe } =
    useExploreFilter();
  const { isNight } = useNightMode();
  const headerHeight = useHeaderHeight(true);

  return (
    <div
      // Lets SpotMap (fullScreen mode always renders alongside this bar)
      // measure its rendered height, so its own top-anchored floating UI —
      // the detail panel in particular — can start below it instead of
      // being covered by it (this bar sits at a higher z-index).
      data-explore-filter-bar
      className={cn(
        // Solid, not `.glass` — see Header.tsx for why: this bar overlaps the
        // scrolling grid directly, and blur can silently no-op depending on
        // the browser/GPU, leaving nothing but a faint tint over full-detail
        // card content underneath. `.bar-surface` matches Header's subtle
        // gradient so the two bars read as one continuous shelf.
        "bar-surface inset-x-0 z-40 space-y-3 border-b border-border px-4 py-3 shadow-[var(--shadow-sm)] sm:px-6",
        isMapView ? "fixed" : "sticky",
      )}
      style={{ top: headerHeight ?? 56 }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center">
        <div className="group relative flex-1">
          <Search
            size={17}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40 transition-colors duration-200 group-focus-within:text-aqua"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tSite("searchPlaceholder")}
            className="input-glow h-11 w-full rounded-full border border-border bg-background pl-10 pr-4 text-sm outline-none"
          />
        </div>

        {/* Classic/Vibes segmented control — same sliding-pill idiom as the
            grid/map switcher (ExploreSection) and the spots/events switcher
            (SpotMap), just a new layoutId. */}
        <div className="glass relative inline-flex shrink-0 rounded-full border border-border p-1">
          {(
            [
              { key: "classic", label: t("classic") },
              { key: "vibes", label: t("vibes") },
            ] satisfies { key: ExploreFilterMode; label: string }[]
          ).map(({ key, label }) => {
            const active = mode === key;
            return (
              <motion.button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                aria-pressed={active}
                whileTap={{ scale: 0.94 }}
                transition={TAP_SPRING}
                className={cn(
                  "relative z-10 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                  active ? "text-white" : "text-foreground/60 hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="explore-filter-mode-pill"
                    transition={{ type: "spring", stiffness: 500, damping: 34 }}
                    className="brand-accent absolute inset-0 -z-10 rounded-full"
                  />
                )}
                {label}
              </motion.button>
            );
          })}
        </div>

        <NightModeToggle />
      </div>

      {/* Only shown once the user has opted in — a quiet nudge that the
          neon theme is on, not a permanent fixture of the bar. */}
      {isNight && (
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 rounded-full border border-[#4a3a80] bg-[#1b1436]/80 px-4 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-[#ffcf6b] shadow-[0_0_20px_-4px_rgba(255,207,107,0.55)]">
          <Moon size={12} fill="currentColor" className="shrink-0" />
          <span>{tNight("bannerTitle")}</span>
          <span className="hidden font-medium normal-case tracking-normal text-[#e8c98a]/80 sm:inline">
            — {tNight("bannerSubtitle")}
          </span>
        </div>
      )}

      {/* Chip row — single-select (unlike the secondary "Filters" sheets'
          multi-select price/category chips): an explicit "All" chip plus
          one active chip at a time is the read that fits a primary,
          always-visible filter bar. */}
      <div className="scrollbar-none mx-auto flex max-w-6xl gap-2 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => (mode === "classic" ? setCategory(null) : setVibe(null))}
          className={cn(
            "pill-lift shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold",
            (mode === "classic" ? category === null : vibe === null)
              ? "border-transparent bg-foreground text-background"
              : "border-border bg-transparent text-foreground/60 hover:text-foreground",
          )}
        >
          {t("all")}
        </button>

        {mode === "classic"
          ? SPOT_CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat];
              const Icon = meta.icon;
              const isActive = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(isActive ? null : cat)}
                  className="pill-lift flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{
                    // Active chips get a subtle diagonal gradient instead of
                    // a flat fill — same per-category color, just with a
                    // touch more depth.
                    background: isActive
                      ? `linear-gradient(135deg, ${meta.color}, color-mix(in srgb, ${meta.color} 68%, black))`
                      : `${meta.color}1A`,
                    color: isActive ? "white" : meta.color,
                  }}
                >
                  <Icon size={13} strokeWidth={2.5} /> {tCategory(cat)}
                </button>
              );
            })
          : SPOT_VIBES.map((v) => {
              const meta = VIBE_META[v];
              const Icon = meta.icon;
              const isActive = vibe === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVibe(isActive ? null : v)}
                  className="pill-lift flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{
                    background: isActive
                      ? `linear-gradient(135deg, ${meta.color}, color-mix(in srgb, ${meta.color} 68%, black))`
                      : `${meta.color}1A`,
                    color: isActive ? "white" : meta.color,
                  }}
                >
                  <Icon size={13} strokeWidth={2.5} /> {tVibe(v)}
                </button>
              );
            })}
      </div>
    </div>
  );
}
