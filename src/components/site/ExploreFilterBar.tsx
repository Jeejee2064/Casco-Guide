"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid, Search, Sparkles, Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { EASE_OUT, TAP_SPRING } from "./motion";
import { VibesModal } from "./VibesModal";
import {
  useExploreFilter,
  type ExploreFilterMode,
} from "./ExploreFilterContext";
import { useHeaderHeight } from "./useHeaderHeight";
import { useRouter } from "@/i18n/navigation";
import { CATEGORY_META, SPOT_CATEGORIES } from "@/lib/categories";
import { VIBE_META, SPOT_VIBES } from "@/lib/vibes";
import type { Spot, SpotCategory, SpotVibe } from "@/lib/types/database";
import { track } from "@/lib/analytics/track";
import { cn } from "@/lib/utils";

// How many of each kind the search dropdown shows at once — enough to be
// useful, not so many the combined list turns into a second, scrollable
// list competing with the grid/map below. Places get the largest share
// since "jump straight to a place already in mind" is the dropdown's
// primary job (see `spots` doc comment below); vibes and tags are a
// smaller, secondary shortcut into the same search box.
const MAX_SPOT_SUGGESTIONS = 5;
const MAX_VIBE_SUGGESTIONS = 2;
const MAX_TAG_SUGGESTIONS = 3;

// One row in the autocomplete dropdown — a place (jumps straight to its
// detail page), a vibe (applies it as a real filter, same as a vibe chip),
// or a tag (completes the search box to that exact tag, since tags aren't
// a dedicated filter mode — see `selectSuggestion` below).
type Suggestion =
  | { kind: "spot"; spot: Spot }
  | { kind: "vibe"; vibe: SpotVibe }
  | { kind: "tag"; tag: string };

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
  hideFloatingBottomBar = false,
}: {
  /** Full, unfiltered spot list — powers the search input's autocomplete
   * dropdown (name/vibe/tag matches, regardless of the current category/
   * vibe selection: someone searching for a specific place, vibe or tag
   * wants to jump straight to it even if it doesn't match whatever's
   * currently active). */
  spots: Spot[];
  fixed?: boolean;
  /** Opens VibesModal immediately on mount, bypassing the usual "only the
   * first time ever" discovery gate — used by the homepage's general
   * "Discover your vibe" CTA (see /map's page.tsx), which is explicitly
   * asking to see the modal, not just landing quietly in vibes mode. */
  autoOpenVibesModal?: boolean;
  /** Animates the /map bottom shelf (mode toggle + chips) out of view
   * without unmounting it — fed by SpotMap's `onSelectionChange` (see its
   * doc comment: the mobile sheet is `position: fixed` inside SpotMap's
   * *own* stacking context, so no z-index in here can ever put this shelf
   * below it; moving the shelf out of the way while a pin is selected is
   * the actual fix). Stays mounted throughout — an opacity/transform
   * animation, not a conditional unmount — so SpotMap's own ResizeObserver
   * on this shelf (for the locate-me button's offset) doesn't lose track of
   * the node, and so it can fade back in as the sheet slides back down
   * instead of popping back in already-open. */
  hideFloatingBottomBar?: boolean;
}) {
  const t = useTranslations("filters");
  const tSite = useTranslations("site");
  const tCategory = useTranslations("category");
  const tVibe = useTranslations("vibe");
  const router = useRouter();
  const {
    mode,
    setMode,
    query,
    setQuery,
    categories,
    setCategories,
    vibes,
    setVibes,
  } = useExploreFilter();
  const headerHeight = useHeaderHeight(true);

  const [isVibesModalOpen, setIsVibesModalOpen] = useState(false);

  // Autocomplete dropdown under the search input — a "jump straight to
  // something you already have in mind" shortcut alongside the broader
  // name/description/cuisine/tags haystack the grid/map filter on below
  // (see `filteredSpots` in SpotsExplorerSection/MapExplorerSection), not
  // another view of those filtered results.
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Distinct tags across the full spot list — case-insensitively deduped
  // (tags are free text entered per-spot in the admin form, so casing isn't
  // guaranteed consistent), keeping the first-seen casing. Computed once
  // per `spots` change rather than re-scanned on every keystroke.
  const allTags = useMemo(() => {
    const seen = new Map<string, string>();
    for (const spot of spots) {
      for (const tag of spot.tags ?? []) {
        const key = tag.toLowerCase();
        if (!seen.has(key)) seen.set(key, tag);
      }
    }
    return [...seen.values()];
  }, [spots]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    // Prefix matches outrank mid-string matches within each kind — same
    // idiom as the old name-only version of this list.
    const rank = <T,>(items: T[], text: (item: T) => string): T[] => {
      const startsWith: T[] = [];
      const contains: T[] = [];
      for (const item of items) {
        const value = text(item).toLowerCase();
        if (value.startsWith(q)) startsWith.push(item);
        else if (value.includes(q)) contains.push(item);
      }
      return [...startsWith, ...contains];
    };

    const spotMatches = rank(spots, (spot) => spot.name)
      .slice(0, MAX_SPOT_SUGGESTIONS)
      .map((spot): Suggestion => ({ kind: "spot", spot }));
    const vibeMatches = rank(SPOT_VIBES, (v) => tVibe(v))
      .slice(0, MAX_VIBE_SUGGESTIONS)
      .map((vibe): Suggestion => ({ kind: "vibe", vibe }));
    const tagMatches = rank(allTags, (tag) => tag)
      .slice(0, MAX_TAG_SUGGESTIONS)
      .map((tag): Suggestion => ({ kind: "tag", tag }));

    // Grouped, not interleaved — places first (the primary use case), then
    // vibes, then tags, so the dropdown reads as three short labeled
    // sections rather than a shuffled mix (see the `showHeader` render
    // below).
    return [...spotMatches, ...vibeMatches, ...tagMatches];
  }, [query, spots, allTags, tVibe]);

  const showSuggestions = isSearchFocused && suggestions.length > 0;

  const selectSuggestion = (suggestion: Suggestion) => {
    setIsSearchFocused(false);
    if (suggestion.kind === "spot") {
      track("search_performed", { result_count: suggestions.length });
      router.push({
        pathname: "/spots/[slug]",
        params: { slug: suggestion.spot.slug },
      });
      return;
    }
    if (suggestion.kind === "vibe") {
      // A vibe suggestion is a real filter, not search text — clears the
      // query (there's nothing left to search for once the vibe chip is
      // doing the narrowing) and switches straight into vibes mode, same
      // as picking the chip itself (toggleVibe below).
      setQuery("");
      setVibes([suggestion.vibe]);
      setMode("vibes");
      track("filter_applied", {
        mode: "vibes",
        kind: "vibe",
        value: suggestion.vibe,
      });
      return;
    }
    // Tag — tags aren't a dedicated filter mode like vibes, so this just
    // completes the search box to the exact tag text and hands off to the
    // existing name/description/cuisine/tags haystack search below.
    setQuery(suggestion.tag);
    track("search_performed", { result_count: suggestions.length });
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
      if (!searchWrapperRef.current?.contains(e.target as Node))
        setIsSearchFocused(false);
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
    const active = !vibes.includes(v);
    setVibes(active ? [v] : []);
    setMode("vibes");
    if (active)
      track("filter_applied", { mode: "vibes", kind: "vibe", value: v });
  };

  // Same idea for categories, no mode flip needed (classic is already
  // active whenever this fires).
  const toggleCategory = (c: SpotCategory) => {
    const active = !categories.includes(c);
    setCategories(active ? [c] : []);
    if (active)
      track("filter_applied", { mode: "classic", kind: "category", value: c });
  };

  // Classic/Vibes segmented control — same sliding-pill idiom as the
  // spots/events switcher (SpotMap), just a new layoutId. Clicking "Vibes"
  // opens VibesModal only the very first time ever (same
  // `vibesDiscovered`/`VIBES_USED_KEY` gate as the discovery nudge above) —
  // picking a vibe in the modal seeds `vibes` with just that one and flips
  // `mode` (see VibesModal's onSelect below), which the effect above catches
  // and marks discovered, so every click after that just switches mode
  // directly like "Classic" does; the chip row (single-select — see
  // toggleVibe/toggleCategory above) is how you switch to a different one
  // from then on.
  //
  // A function, not a plain JSX const like `chips` below, because it takes
  // one: `big` is true only for the /map bottom shelf (see the `fixed`
  // branch of the return below), where this is the one control choosing
  // *what the whole chip row means* — categories or vibes — so it earns a
  // bigger, icon-carrying, unmissable treatment instead of the compact
  // version /spots keeps tucked next to its search bar.
  const renderModeToggle = (big: boolean) => (
    <div className="relative shrink-0 self-center">
      <div
        className={cn(
          "relative inline-flex rounded-full border shadow-lg",
          big
            ? "gap-0.5 border-border/60 bg-surface/70 p-1 backdrop-blur-xl"
            : "glass border-border p-1",
        )}
      >
        {(
          [
            { key: "classic", label: t("classic"), icon: LayoutGrid },
            { key: "vibes", label: t("vibes"), icon: Sparkles },
          ] satisfies {
            key: ExploreFilterMode;
            label: string;
            icon: typeof Sparkles;
          }[]
        ).map(({ key, label, icon: Icon }) => {
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
                "relative z-10 flex items-center gap-1.5 rounded-full font-semibold transition-colors",
                big ? "px-4 py-2 text-xs" : "px-4 py-1.5 text-xs",
                active
                  ? "text-white"
                  : "text-foreground/60 hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId={
                    big
                      ? "explore-filter-mode-pill-big"
                      : "explore-filter-mode-pill"
                  }
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                  className="brand-accent absolute inset-0 -z-10 rounded-full"
                />
              )}
              {key === "vibes" && showHint && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 -z-10 rounded-full border-2 border-coral"
                  animate={{ opacity: [0.7, 0.15, 0.7], scale: [1, 1.08, 1] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
              {big && <Icon size={15} strokeWidth={2.5} />}
              {label}
            </motion.button>
          );
        })}
      </div>

      {/* Animated callout bubble — a real speech-bubble (pointer + filled
          pill, not just floating text) so it reads as something pointing
          *at* the toggle, not a caption near it. Bounces in place
          continuously to catch the eye; dismissible by tapping it away,
          otherwise auto-fades after a few seconds (see showHint above for
          when it's shown/reset). Sits *above* the big/bottom-shelf version
          (there's no screen left below it to point into) and below the
          compact/top version, same as before. */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0, y: big ? 8 : -8, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: big ? 8 : -8, scale: 0.85 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className={cn(
              "absolute left-1/2 z-10 -translate-x-1/2",
              big ? "bottom-full mb-2.5" : "top-full mt-2.5",
            )}
          >
            <div
              aria-hidden
              className={cn(
                "brand-accent absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px]",
                big ? "-bottom-1" : "-top-1",
              )}
            />
            <motion.button
              type="button"
              onClick={markVibesDiscovered}
              animate={{ y: [0, big ? 3 : -3, 0] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="brand-accent relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[11px] font-bold text-white shadow-lg"
            >
              <Sparkles size={12} className="shrink-0" />
              {t("vibesHint")}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // Extracted so the "All" + category/vibe chips render identically whether
  // they end up nested under the search/mode row (/spots) or floating on
  // their own, detached shelf at the bottom of the screen (/map — see the
  // `fixed` branch below, which is otherwise the whole reason this bar
  // exists as a component someone could still be looking at while a spot's
  // pin sits under their thumb, not just above it).
  const chips = (
    <>
      <button
        type="button"
        onClick={() => (mode === "classic" ? setCategories([]) : setVibes([]))}
        className={cn(
          "pill-lift shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm",
          (mode === "classic" ? categories.length === 0 : vibes.length === 0)
            ? "brand-accent border-transparent text-white"
            : "chip-surface border-border text-foreground/60 hover:text-foreground",
        )}
      >
        {t("all")}
      </button>

      {mode === "classic"
        ? // Classic/category chips are deliberately not per-category
          // colored — selection reads through the same brand-accent blue
          // as the mode toggle above (`.brand-accent`, globals.css) and the
          // "All" chip, not a different hue per category, so the bar
          // doesn't compete for attention with the one filter axis (vibes)
          // that actually earns per-item color.
          SPOT_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            const isActive = categories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                aria-pressed={isActive}
                className={cn(
                  "pill-lift flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm",
                  isActive
                    ? "brand-accent border-transparent text-white"
                    : "chip-surface border-border text-foreground/60 hover:text-foreground",
                )}
              >
                <Icon size={13} strokeWidth={2.5} /> {tCategory(cat)}
              </button>
            );
          })
        : // Vibe chips are the one place color carries meaning, but only
          // once a chip is actually selected — inactive sits in the same
          // neutral `chip-surface` as a classic-mode category chip (no
          // per-vibe tint, so the row doesn't look like a stray "which
          // hue is which" quiz before anything's picked), and only the
          // selected vibe lights up in its own color — that same hue then
          // propagates to the map's pins and detail-panel CTA via
          // `--accent-color` (see SpotMap/MapDetailPanel).
          SPOT_VIBES.map((v) => {
            const meta = VIBE_META[v];
            const Icon = meta.icon;
            const isActive = vibes.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => toggleVibe(v)}
                aria-pressed={isActive}
                className={cn(
                  "pill-lift flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm",
                  isActive
                    ? "border-transparent text-white"
                    : "chip-surface border-border text-foreground/60 hover:text-foreground",
                )}
                style={
                  isActive
                    ? {
                        background: `linear-gradient(135deg, ${meta.color}, color-mix(in srgb, ${meta.color} 68%, black))`,
                      }
                    : undefined
                }
              >
                <Icon size={13} strokeWidth={2.5} /> {tVibe(v)}
              </button>
            );
          })}
    </>
  );

  return (
    <>
      <div
        // Lets SpotMap (fullScreen mode always renders alongside this bar)
        // measure its rendered height, so its own top-anchored floating UI —
        // the detail panel in particular — can start below it instead of
        // being covered by it (this bar sits at a higher z-index).
        data-explore-filter-bar
        className={cn(
          "inset-x-0 z-40 space-y-3 px-4 py-3 sm:px-6",
          fixed
            ? // /map: no panel background at all — the map fills the entire
              // strip below the header, and this bar is just a transparent
              // shelf for the individually-styled floating pills (search
              // input, mode toggle — the chip row moves to its own shelf at
              // the bottom of the screen, see below) to sit on top of it.
              "fixed"
            : // /spots: solid, not `.glass` — see Header.tsx for why: this bar
              // overlaps the scrolling grid directly, and blur can silently
              // no-op depending on the browser/GPU, leaving nothing but a
              // faint tint over full-detail card content underneath.
              // `.bar-surface` matches Header's subtle gradient so the two
              // bars read as one continuous shelf.
              "sticky bar-surface border-b border-border shadow-[var(--shadow-sm)]",
        )}
        style={{ top: headerHeight ?? 56 }}
      >
        <div
          className={cn(
            "mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center",
            // /map only: the mode toggle used to sit here too, keeping the
            // search input naturally clear of Leaflet's top-right zoom
            // control — now that it's floated down to the bottom shelf (see
            // below), this row is just the search bar, which would
            // otherwise stretch edge-to-edge right underneath that control.
            // Reserve its footprint instead of guessing at a breakpoint —
            // it's the same fixed size regardless of viewport.
            fixed && "pr-12",
          )}
        >
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
                activeSuggestion >= 0
                  ? `explore-search-suggestion-${activeSuggestion}`
                  : undefined
              }
              autoComplete="off"
              className="input-glow glass h-11 w-full rounded-full border border-border pl-10 pr-4 text-sm shadow-lg outline-none"
            />

            {/* Autocomplete dropdown — place/vibe/tag matches, a "jump
              straight to something you already have in mind" shortcut
              alongside the broader live filter below (see `suggestions`
              above). Grouped into up to three labeled sections rather than
              one flat list, since each kind does something different on
              select (see `selectSuggestion`). */}
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
                  {suggestions.map((suggestion, i) => {
                    const prevKind = suggestions[i - 1]?.kind;
                    const showHeader = suggestion.kind !== prevKind;
                    const key =
                      suggestion.kind === "spot"
                        ? `spot-${suggestion.spot.id}`
                        : suggestion.kind === "vibe"
                          ? `vibe-${suggestion.vibe}`
                          : `tag-${suggestion.tag}`;
                    return (
                      <div key={key}>
                        {showHeader && (
                          <div
                            className={cn(
                              "px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-foreground/40",
                              i === 0 && "pt-1",
                            )}
                          >
                            {suggestion.kind === "spot"
                              ? t("searchPlaces")
                              : suggestion.kind === "vibe"
                                ? t("vibes")
                                : t("searchTags")}
                          </div>
                        )}
                        <button
                          id={`explore-search-suggestion-${i}`}
                          role="option"
                          aria-selected={i === activeSuggestion}
                          type="button"
                          onClick={() => selectSuggestion(suggestion)}
                          onMouseEnter={() => setActiveSuggestion(i)}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors",
                            i === activeSuggestion
                              ? "bg-foreground/5"
                              : "hover:bg-foreground/5",
                          )}
                        >
                          {suggestion.kind === "spot" &&
                            (() => {
                              const meta = CATEGORY_META[suggestion.spot.category];
                              const Icon = meta.icon;
                              return (
                                <>
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/8 text-foreground/60">
                                    <Icon size={14} strokeWidth={2.5} />
                                  </span>
                                  <span className="min-w-0 flex-1 truncate font-semibold">
                                    {suggestion.spot.name}
                                  </span>
                                  <span className="shrink-0 text-xs text-foreground/45">
                                    {tCategory(suggestion.spot.category)}
                                  </span>
                                </>
                              );
                            })()}
                          {suggestion.kind === "vibe" &&
                            (() => {
                              const meta = VIBE_META[suggestion.vibe];
                              const Icon = meta.icon;
                              return (
                                <>
                                  <span
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                                    style={{ background: meta.color }}
                                  >
                                    <Icon size={14} strokeWidth={2.5} />
                                  </span>
                                  <span className="min-w-0 flex-1 truncate font-semibold">
                                    {tVibe(suggestion.vibe)}
                                  </span>
                                </>
                              );
                            })()}
                          {suggestion.kind === "tag" && (
                            <>
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/8 text-foreground/60">
                                <Tag size={14} strokeWidth={2.5} />
                              </span>
                              <span className="min-w-0 flex-1 truncate font-semibold">
                                {suggestion.tag}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* /spots keeps the compact toggle right here, next to search —
              /map's own (bigger) copy moves down to the bottom shelf
              alongside the chips it controls, see the `fixed` branch below. */}
          {!fixed && renderModeToggle(false)}
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
          explicit "All" chip) clears back to no filter. On /spots it stays
          nested right here, under a hairline that separates it from the
          search/mode row above (the mode switch is a level above the chips
          it's filtering within). On /map it moves to its own shelf at the
          bottom of the screen instead (see below the closing tag of this
          bar) — floating pills at the top *and* bottom of a fullscreen map
          competes with the pins for thumb reach on mobile, so only one row
          lives up here. */}
        {!fixed && (
          <div className="scrollbar-none mx-auto flex max-w-6xl gap-2 overflow-x-auto border-t border-border/60 pb-0.5 pt-3">
            {chips}
          </div>
        )}
      </div>

      {/* /map only — the mode toggle and chip row float at the bottom of the
          screen instead, same idea as a mobile app's bottom tab bar:
          reachable one-handed instead of a stretch up to the top of a
          fullscreen map. Two separate pill-shaped shelves, not one big
          panel — the toggle picks *what the chips mean* (categories or
          vibes), so it stays its own smaller, distinct control stacked
          above them rather than merging into one slab that reads as a
          single oversized bar. Each carries a semi-transparent blurred
          background sized to its own content (not the full screen width)
          so pills floating over a busy map (pins, streets, whatever Night
          Mode's brighter glow puts underneath) stay legible without
          blocking more of the map than the controls themselves need. */}
      {fixed && (
        <motion.div
          // Lets SpotMap measure this shelf's height so its own
          // bottom-anchored floating UI — the locate-me button — can float
          // above it instead of being covered by it, same idea as
          // `data-explore-filter-bar` up top. Stays mounted even while
          // hidden (animated out, not unmounted) so that measurement keeps
          // working — an AnimatePresence exit would tear the node down
          // between selections.
          data-explore-filter-bottom-bar
          initial={false}
          animate={
            hideFloatingBottomBar ? { opacity: 0, y: 40 } : { opacity: 1, y: 0 }
          }
          transition={{ duration: 0.28, ease: EASE_OUT }}
          className={cn(
            "safe-bottom fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 px-4 pb-3 sm:px-6",
            // Matches the mobile sheet's own open/close transition (see
            // MapDetailPanel) — the two swap places in one motion: this
            // shelf fades/slides down out of the way as the sheet slides up
            // over it, and the reverse on close.
            hideFloatingBottomBar && "pointer-events-none",
          )}
        >
          {renderModeToggle(true)}
          <div className="scrollbar-none flex max-w-full gap-2 overflow-x-auto rounded-full border border-border/60 bg-surface/70 px-3 py-2 shadow-lg backdrop-blur-xl">
            {chips}
          </div>
        </motion.div>
      )}
    </>
  );
}
