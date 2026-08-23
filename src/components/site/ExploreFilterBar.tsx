"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { EASE_OUT, TAP_SPRING } from "./motion";
import { VibesModal } from "./VibesModal";
import { useExploreFilter, type ExploreFilterMode } from "./ExploreFilterContext";
import { useHeaderHeight } from "./useHeaderHeight";
import { useRouter } from "@/i18n/navigation";
import { CATEGORY_META, SPOT_CATEGORIES } from "@/lib/categories";
import { VIBE_META, SPOT_VIBES } from "@/lib/vibes";
import type { Spot, SpotCategory, SpotVibe } from "@/lib/types/database";
import { cn } from "@/lib/utils";

// How many name matches the search dropdown shows at once — enough to be
// useful, not so many it turns into a second, scrollable list competing
// with the grid/map below.
const MAX_SUGGESTIONS = 6;

// Whether the visitor has ever discovered vibes mode before — gates both
// the "Vibes" toggle's discovery modal (only interrupts the very first
// pick; every click after that just switches mode directly, same as
// "Classic" does — see the toggle's onClick below) and the passive hint
// bubble nudging toward it (see vibesDiscovered/markVibesDiscovered below).
const VIBES_USED_KEY = "casco-vibes-used";

/**
 * Always-visible top filter bar for the explore screen: search, a
 * Classic↔Vibes segmented control, and one chip row (8 categories or 6
 * vibes, single-select with an explicit "All"). Shared by the /spots and
 * /map pages (SpotsExplorerSection / MapExplorerSection), each with its
 * own ExploreFilterProvider — its state lives in ExploreFilterContext so
 * it and the grid/map sibling it feeds both read the same selection.
 *
 * Positioning: `sticky` alone looks sufficient but isn't on /map — a
 * sticky bar never gets the chance to "stick" before SpotMap's fullScreen
 * effect freezes body scroll, stranding it off-screen. So `fixed` (mirroring
 * why SpotMap itself uses `fixed`, not `sticky`, for the exact same reason)
 * is opt-in via `fixed` below, which /map passes and /spots doesn't — /spots
 * keeps plain `sticky`, where live scroll makes it safe (and gives the
 * bonus of staying visible while scrolling the grid).
 */
export function ExploreFilterBar({
  spots,
  fixed = false,
  autoOpenVibesModal = false,
}: {
  /** Full, unfiltered spot list — powers the search input's autocomplete
   * dropdown (name matches, regardless of the current category/vibe
   * selection: someone searching for a specific place wants to jump
   * straight to it even if it doesn't match whatever's currently active). */
  spots: Spot[];
  fixed?: boolean;
  /** Opens VibesModal immediately on mount, bypassing the usual "only the
   * first time ever" discovery gate — used by the homepage's general
   * "Discover your vibe" CTA (see /map's page.tsx), which is explicitly
   * asking to see the modal, not just landing quietly in vibes mode. */
  autoOpenVibesModal?: boolean;
}) {
  const t = useTranslations("filters");
  const tSite = useTranslations("site");
  const tCategory = useTranslations("category");
  const tVibe = useTranslations("vibe");
  const router = useRouter();
  const { mode, setMode, query, setQuery, categories, setCategories, vibes, setVibes } =
    useExploreFilter();
  const headerHeight = useHeaderHeight(true);

  const [isVibesModalOpen, setIsVibesModalOpen] = useState(false);

  // Autocomplete dropdown under the search input — name matches only (not
  // the broader description/cuisine/tags haystack the grid/map filter on
  // below), since this is a "jump straight to a place you already have in
  // mind" shortcut, not another view of the filtered results.
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const startsWith: Spot[] = [];
    const contains: Spot[] = [];
    for (const spot of spots) {
      const name = spot.name.toLowerCase();
      if (name.startsWith(q)) startsWith.push(spot);
      else if (name.includes(q)) contains.push(spot);
    }
    return [...startsWith, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [query, spots]);

  const showSuggestions = isSearchFocused && suggestions.length > 0;

  const selectSuggestion = (spot: Spot) => {
    setIsSearchFocused(false);
    router.push({ pathname: "/spots/[slug]", params: { slug: spot.slug } });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeSuggestion >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeSuggestion]);
    } else if (e.key === "Escape") {
      setIsSearchFocused(false);
    }
  };

  // Closes the dropdown on an outside click — a plain onBlur would also
  // fire when focus moves onto a suggestion button itself, closing it
  // before the click even registers.
  useEffect(() => {
    if (!isSearchFocused) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!searchWrapperRef.current?.contains(e.target as Node)) setIsSearchFocused(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isSearchFocused]);

  // Runs once on mount only — a deliberate deep-link into the modal, not
  // something that should reopen if the caller's prop identity changes.
  useEffect(() => {
    if (autoOpenVibesModal) setIsVibesModalOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whether the visitor has ever discovered vibes mode — persisted
  // (VIBES_USED_KEY), so both the passive hint bubble below and the
  // vibes-tab's discovery-modal gate (its own localStorage read, in the
  // toggle's onClick) show only the very first time, not once per visit.
  // Starts false on every render (server included) and is hydrated from
  // localStorage after mount to avoid a hydration mismatch — the hint's own
  // entrance animation absorbs that one-frame delay.
  const [vibesDiscovered, setVibesDiscovered] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIBES_USED_KEY)) setVibesDiscovered(true);
    } catch {
      // Private browsing / storage disabled — falls through to "not
      // discovered yet", same worst-case as the read in the toggle below.
    }
  }, []);

  const markVibesDiscovered = useCallback(() => {
    setVibesDiscovered(true);
    try {
      window.localStorage.setItem(VIBES_USED_KEY, "1");
    } catch {
      // Private browsing / storage disabled — worst case the hint/modal
      // just show again next time, no worse than before this fix.
    }
  }, []);

  // Also catches switching to vibes some other way than the hint/modal
  // (e.g. the toggle once `usedBefore` was already true) — so the hint
  // can never show again once vibes mode has actually been used, even if
  // it hadn't finished its own dismiss flow yet.
  useEffect(() => {
    if (mode === "vibes" && !vibesDiscovered) markVibesDiscovered();
  }, [mode, vibesDiscovered, markVibesDiscovered]);

  // Animated nudge toward Vibes mode — shown while sitting in Classic mode
  // and vibes hasn't been discovered yet. Dismissing it (tap, or the
  // auto-fade below) counts as "discovered" too, same as actually switching
  // to vibes — either way it's a one-time nudge, never shown again.
  const showHint = mode === "classic" && !vibesDiscovered;

  // Auto-fades (and permanently retires itself) after a few seconds so it
  // doesn't nag forever on one visit.
  useEffect(() => {
    if (!showHint) return;
    const timer = setTimeout(markVibesDiscovered, 6000);
    return () => clearTimeout(timer);
  }, [showHint, markVibesDiscovered]);

  // Single-select, not multi — picking a vibe replaces whatever was active,
  // and re-picking the same one clears back to "All" (there's no other way
  // to get back to "All" once one is active, so the chip has to double as
  // its own toggle-off). Always ensures `mode` is "vibes" since this is also
  // reused for the toggle's post-discovery path.
  const toggleVibe = (v: SpotVibe) => {
    setVibes(vibes.includes(v) ? [] : [v]);
    setMode("vibes");
  };

  // Same idea for categories, no mode flip needed (classic is already
  // active whenever this fires).
  const toggleCategory = (c: SpotCategory) => {
    setCategories(categories.includes(c) ? [] : [c]);
  };

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
        fixed ? "fixed" : "sticky",
      )}
      style={{ top: headerHeight ?? 56 }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center">
        <div ref={searchWrapperRef} className="group relative flex-1">
          <Search
            size={17}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40 transition-colors duration-200 group-focus-within:text-aqua"
          />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Stale highlight from a previous query shouldn't linger once
              // the list underneath it has changed.
              setActiveSuggestion(-1);
            }}
            onFocus={() => setIsSearchFocused(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder={tSite("searchPlaceholder")}
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls="explore-search-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={
              activeSuggestion >= 0 ? `explore-search-suggestion-${activeSuggestion}` : undefined
            }
            autoComplete="off"
            className="input-glow h-11 w-full rounded-full border border-border bg-background pl-10 pr-4 text-sm outline-none"
          />

          {/* Autocomplete dropdown — name matches only, a "jump straight to
              a place you already have in mind" shortcut alongside the
              broader live filter below (see `suggestions` above). */}
          <AnimatePresence>
            {showSuggestions && (
              <motion.div
                id="explore-search-suggestions"
                role="listbox"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="glass absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border border-border py-1.5 shadow-lg"
              >
                {suggestions.map((spot, i) => {
                  const meta = CATEGORY_META[spot.category];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={spot.id}
                      id={`explore-search-suggestion-${i}`}
                      role="option"
                      aria-selected={i === activeSuggestion}
                      type="button"
                      onClick={() => selectSuggestion(spot)}
                      onMouseEnter={() => setActiveSuggestion(i)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors",
                        i === activeSuggestion ? "bg-foreground/5" : "hover:bg-foreground/5",
                      )}
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                        style={{ background: `${meta.color}26`, color: meta.color }}
                      >
                        <Icon size={14} strokeWidth={2.5} />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{spot.name}</span>
                      <span className="shrink-0 text-xs text-foreground/45">
                        {tCategory(spot.category)}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Classic/Vibes segmented control — same sliding-pill idiom as the
            spots/events switcher (SpotMap), just a new layoutId. Clicking
            "Vibes" opens VibesModal
            only the very first time ever (same `vibesDiscovered`/
            `VIBES_USED_KEY` gate as the discovery nudge above) — picking a
            vibe in the modal seeds `vibes` with just that one and flips
            `mode` (see VibesModal's onSelect below), which the effect above
            catches and marks discovered, so every click after that just
            switches mode directly like "Classic" does; the chip row below
            (single-select — see toggleVibe/toggleCategory above) is how you
            switch to a different one from then on. */}
        {/* `self-center` (rather than the flex row's default stretch) keeps
            this wrapper fit-to-content instead of full-width on mobile,
            where the row is a column — otherwise the toggle pill sits
            flush-left inside a stretched wrapper (not actually centered)
            and the hint bubble below, which centers itself on *this*
            wrapper via left-1/2, drifts to the middle of the screen instead
            of pointing at the toggle. */}
        <div className="relative shrink-0 self-center">
          <div className="glass relative inline-flex rounded-full border border-border p-1">
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
                  onClick={() => {
                    if (key !== "vibes") {
                      setMode(key);
                      return;
                    }
                    if (vibesDiscovered) setMode("vibes");
                    else setIsVibesModalOpen(true);
                  }}
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
                  {key === "vibes" && showHint && (
                    <motion.span
                      aria-hidden
                      className="absolute inset-0 -z-10 rounded-full border-2 border-coral"
                      animate={{ opacity: [0.7, 0.15, 0.7], scale: [1, 1.08, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                  {label}
                </motion.button>
              );
            })}
          </div>

          {/* Animated callout bubble — a real speech-bubble (pointer +
              filled pill, not just floating text) so it reads as something
              pointing *at* the toggle, not a caption near it. Bounces in
              place continuously to catch the eye; dismissible by tapping it
              away, otherwise auto-fades after a few seconds (see showHint
              above for when it's shown/reset). */}
          <AnimatePresence>
            {showHint && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.85 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
                className="absolute left-1/2 top-full z-10 mt-2.5 -translate-x-1/2"
              >
                <div
                  aria-hidden
                  className="brand-accent absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px]"
                />
                <motion.button
                  type="button"
                  onClick={markVibesDiscovered}
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  className="brand-accent relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[11px] font-bold text-white shadow-lg"
                >
                  <Sparkles size={12} className="shrink-0" />
                  {t("vibesHint")}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <VibesModal
        open={isVibesModalOpen}
        onClose={() => setIsVibesModalOpen(false)}
        onSelect={(v) => {
          // The modal is a fresh start, not an add — it replaces whatever
          // was selected (usually nothing yet) with just this one vibe;
          // the chip row below is how more get added afterward.
          setVibes([v]);
          setMode("vibes");
          setIsVibesModalOpen(false);
        }}
      />

      {/* Chip row — single-select: only one category (or vibe) chip is
          active at a time, narrowing to spots matching it; picking a new
          one replaces the old, and re-picking the active one (or the
          explicit "All" chip) clears back to no filter. A hairline + its own
          top padding (on top of the parent's space-y-3) separates it from
          the search/mode row above — without it the two rows read as one
          flat stack of same-weight pills, when the mode switch is really a
          level above the chips it's filtering within. */}
      <div className="scrollbar-none mx-auto flex max-w-6xl gap-2 overflow-x-auto border-t border-border/60 pb-0.5 pt-3">
        <button
          type="button"
          onClick={() => (mode === "classic" ? setCategories([]) : setVibes([]))}
          className={cn(
            "pill-lift shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold",
            (mode === "classic" ? categories.length === 0 : vibes.length === 0)
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
              const isActive = categories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  aria-pressed={isActive}
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
              const isActive = vibes.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggleVibe(v)}
                  aria-pressed={isActive}
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
