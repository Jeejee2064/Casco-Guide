"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CircleMarker,
  LayerGroup,
  Map as LeafletMap,
  Marker as LeafletMarker,
  TileLayer,
} from "leaflet";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import {
  CalendarDays,
  Loader2,
  LocateFixed,
  MapPin,
  Search,
  SearchX,
} from "lucide-react";
import { toast } from "sonner";
import { TAP_SPRING } from "./motion";
import { MapDetailPanel, type DetailPanelContent } from "./MapDetailPanel";
import { useHeaderHeight } from "./useHeaderHeight";
import { useNightMode } from "./NightModeContext";
import { useRouter } from "@/i18n/navigation";
import { CATEGORY_META } from "@/lib/categories";
import { EVENT_CATEGORY_META } from "@/lib/eventCategories";
import { VIBE_META } from "@/lib/vibes";
import { getSpotImage } from "@/lib/data/categoryImages";
import { formatTime } from "@/lib/hours";
import type { EventRow, Spot, SpotCategory, SpotVibe } from "@/lib/types/database";
import { cn } from "@/lib/utils";

type MapMode = "spots" | "events";

// Casco Viejo, Panama City — used when there's nothing to fit bounds to.
const DEFAULT_CENTER: [number, number] = [8.9528, -79.5347];
const DEFAULT_ZOOM = 15;

// Gold marks a pin whose spot matches *more than one* of the currently
// selected vibe chips — same warm gold as --color-gold/--night-gold in
// globals.css (ratings, featured picks), reused here so "this spot is an
// overlap" reads as premium rather than picking one of its matching vibes'
// colors arbitrarily (which would look inconsistent and jump around as the
// filter changes).
const MULTI_VIBE_COLOR = "#d4a24c";
const MULTI_VIBE_COLOR_NIGHT = "#ffcf6b";

const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>';

/** Shape data for a Lucide glyph, minimal enough to stamp into an HTML
 * string — Leaflet's marker/popup APIs take raw HTML, not React nodes. */
type IconShape =
  | { d: string }
  | { cx: string; cy: string; r: string }
  | { x: string; y: string; width: string; height: string; rx: string };

/** Path data mirroring CATEGORY_META's Lucide icons, so map pins and popups
 * use the same glyphs as the rest of the UI instead of an emoji. */
const CATEGORY_ICON_SHAPES: Record<SpotCategory, IconShape[]> = {
  restaurant: [
    { d: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" },
    { d: "M7 2v20" },
    { d: "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" },
  ],
  bar: [
    { d: "M12 12 4.207 4.207A.707.707 0 0 1 4.707 3h14.586a.707.707 0 0 1 .5 1.207z" },
    { d: "M12 12v10" },
    { d: "M7 22h10" },
  ],
  cafe: [
    { d: "M10 2v2" },
    { d: "M14 2v2" },
    { d: "M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" },
    { d: "M6 2v2" },
  ],
  attraction: [
    { d: "M10 18v-7" },
    { d: "M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z" },
    { d: "M14 18v-7" },
    { d: "M18 18v-7" },
    { d: "M3 22h18" },
    { d: "M6 18v-7" },
  ],
  museum: [
    { d: "M10 12h4" },
    { d: "M10 8h4" },
    { d: "M14 21v-3a2 2 0 0 0-4 0v3" },
    { d: "M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" },
    { d: "M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" },
  ],
  shop: [
    { d: "M16 10a4 4 0 0 1-8 0" },
    { d: "M3.103 6.034h17.794" },
    {
      d: "M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z",
    },
  ],
  gallery: [
    {
      d: "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z",
    },
    { cx: "13.5", cy: "6.5", r: ".5" },
    { cx: "17.5", cy: "10.5", r: ".5" },
    { cx: "6.5", cy: "12.5", r: ".5" },
    { cx: "8.5", cy: "7.5", r: ".5" },
  ],
  hotel: [{ d: "M2 4v16" }, { d: "M2 8h18a2 2 0 0 1 2 2v10" }, { d: "M2 17h20" }, { d: "M6 8v9" }],
};

/** Renders 24x24 stroke-based Lucide shape data to an inline SVG string, for
 * use inside Leaflet's HTML-string marker/popup APIs. */
function iconSvg(shapes: IconShape[], size = 15): string {
  const body = shapes
    .map((s) => {
      if ("d" in s) return `<path d="${s.d}"/>`;
      if ("cx" in s) return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="currentColor"/>`;
      return `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.rx}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

function pinHtml(color: string, shapes: IconShape[], featured: boolean): string {
  // `color` (not just `background`) is set here so Night Mode's glow rule
  // (globals.css) can pick it up via `currentColor` — one box-shadow rule
  // then matches whichever category/vibe a pin belongs to, no per-category CSS.
  return `
    <span class="spot-pin" style="background:${color};color:${color}">
      <span class="spot-pin__icon">${iconSvg(shapes)}</span>
      ${featured ? '<span class="spot-pin__star">★</span>' : ""}
    </span>
  `;
}

/** The /public/icons badges are already fully-drawn pins (balloon shape,
 * pointer tail, drop shadow baked into the artwork) — render them as-is
 * instead of nesting them inside another pin shape. */
function eventPinHtml(iconSrc: string, featured: boolean): string {
  return `
    <span class="event-pin">
      <img class="event-pin__icon" src="${iconSrc}" alt="" width="36" height="36" />
      ${featured ? '<span class="event-pin__star">★</span>' : ""}
    </span>
  `;
}

export function SpotMap({
  spots,
  events = [],
  onOpenSpot,
  onOpenEvent,
  className,
  heightClassName = "h-[65vh] min-h-[420px]",
  fullScreen = false,
  useVibeIcons = false,
  activeVibes = [],
  onSelectionChange,
}: {
  spots: Spot[];
  /** Optional — rendered as a second pin layer using the /public/icons badges. */
  events?: EventRow[];
  /** Called when a popup's "read more" is clicked. Defaults to navigating to /spots/[slug]. */
  onOpenSpot?: (spot: Spot) => void;
  /** Called when an event popup's "view details" is clicked. Defaults to navigating to /events/[slug]. */
  onOpenEvent?: (event: EventRow) => void;
  className?: string;
  heightClassName?: string;
  /** Breaks out of the page flow to fill the viewport below the header,
   * instead of the usual rounded, height-limited widget. */
  fullScreen?: boolean;
  /** Mirrors ExploreFilterBar's Classic↔Vibes mode — when true, spot pins
   * recolor to a vibe's color (VIBE_META, the same palette as the vibe
   * chips/VibesModal cards) instead of its category's color. The glyph
   * itself stays the category icon either way (see CATEGORY_ICON_SHAPES
   * below) — only the tint changes. Which vibe (or gold, for an overlap)
   * each pin uses is driven by `activeVibes` below. */
  useVibeIcons?: boolean;
  /** The vibe chips currently selected in ExploreFilterBar ("All" = []).
   * Multi-select: each pin is painted whichever *one* of these it matches
   * (the spots on screen were already narrowed to ones matching at least
   * one — see MapExplorerSection), except a spot matching more than one, which
   * gets a distinct gold instead of picking one of its matches arbitrarily
   * (see MULTI_VIBE_COLOR above). With vibes mode on but nothing selected,
   * each pin instead falls back to its own first-tagged vibe, since there's
   * no selection to match against. */
  activeVibes?: SpotVibe[];
  /** Fires whenever a pin becomes selected/deselected (i.e. the detail
   * panel/sheet opens or closes) — lets a parent hide its own floating UI
   * that would otherwise overlap the mobile bottom sheet. The sheet is
   * `position: fixed` inside *this* component's own stacking context (see
   * the outer `fixed z-10` wrapper below), so no z-index in here can ever
   * put it above a sibling fixed element outside that context — hiding
   * that sibling is the fix, hence this callback instead of "just raise
   * the sheet's z-index further". Currently unused (no page has floating UI
   * left that would overlap), kept for the next thing that does. */
  onSelectionChange?: (hasSelection: boolean) => void;
}) {
  const tSpot = useTranslations("spot");
  const tCategory = useTranslations("category");
  const tEventCategory = useTranslations("eventCategory");
  const tEvents = useTranslations("events");
  const tEmpty = useTranslations("empty");
  const tMap = useTranslations("map");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const { isNight } = useNightMode();

  // Spots and events render as two mutually-exclusive layers rather than
  // overlaid at once — with both on screen at the same density the pins
  // crowded each other out and the filters below couldn't tell which layer
  // they applied to. Plain local state, not the URL — this page is dynamic
  // (fetches spots/events fresh from Supabase), so routing a same-page
  // toggle through the URL costs a real server round-trip instead of the
  // instant switch it should feel like.
  const [mode, setMode] = useState<MapMode>("spots");
  const hasEvents = events.length > 0;

  // Spots search now lives in the shared top bar (ExploreFilterBar) and
  // pre-filters the `spots` prop before it even reaches this component —
  // `query` here only powers the (currently dormant, hasEvents-gated)
  // events-mode search, which that shared bar doesn't cover.
  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  // Mirrors `isNight` for the scheme-change listener below, which is
  // attached once (empty-deps effect) and would otherwise close over a
  // stale value if Night Mode is toggled after mount.
  const isNightRef = useRef(isNight);
  useEffect(() => {
    isNightRef.current = isNight;
  }, [isNight]);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const eventLayerRef = useRef<LayerGroup | null>(null);
  const meMarkerRef = useRef<CircleMarker | null>(null);
  // Keyed by id so the active-pin-highlight effect (below) can find a
  // marker again after the filtered-set effects rebuild the layer.
  const spotMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const eventMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());

  // The pin currently shown in the detail panel — spot and event are
  // mutually exclusive, same as the spots/events layers themselves.
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);
  const closePanel = useCallback(() => {
    setSelectedSpot(null);
    setSelectedEvent(null);
  }, []);

  // Tracked in a ref (not state) — only read at click-time to decide how
  // much room to leave for the side panel vs. the bottom sheet, so it
  // doesn't need to trigger a render on its own.
  const isDesktopRef = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      isDesktopRef.current = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Nudges the map so a newly-selected pin doesn't end up hidden behind the
  // panel/sheet that's about to cover it — mirrors panInside's own padding
  // idea, just reserving space for our own chrome instead of map controls.
  const revealSelection = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;
    if (isDesktopRef.current) {
      // Panel is 380px wide, offset 16px from the left edge.
      map.panInside([lat, lng], { paddingTopLeft: [412, 24], paddingBottomRight: [24, 24], animate: true });
    } else {
      // Sheet height varies with content; 320px comfortably covers it.
      map.panInside([lat, lng], { paddingTopLeft: [24, 24], paddingBottomRight: [24, 320], animate: true });
    }
  }, []);

  // The detail panel's primary action — called from a real onClick, not a
  // vanilla-DOM listener, so a plain memoized callback is enough (no need
  // for the always-fresh-ref indirection the old Leaflet-HTML popups needed).
  const handleOpenSpot = useCallback(
    (spot: Spot) => {
      if (onOpenSpot) onOpenSpot(spot);
      else router.push({ pathname: "/spots/[slug]", params: { slug: spot.slug } });
    },
    [onOpenSpot, router],
  );

  const handleOpenEvent = useCallback(
    (event: EventRow) => {
      if (onOpenEvent) onOpenEvent(event);
      else router.push({ pathname: "/events/[slug]", params: { slug: event.slug } });
    },
    [onOpenEvent, router],
  );

  // Fullscreen mode covers the whole viewport — lock the page behind it so
  // there's nothing to accidentally scroll past.
  useEffect(() => {
    if (!fullScreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullScreen]);

  // `spots` is already filtered by search/category/vibe (see
  // MapExplorerSection) — this only drops any without coordinates.
  const filteredSpots = useMemo(() => {
    return spots.filter((spot) => spot.latitude != null && spot.longitude != null);
  }, [spots]);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((event) => {
      if (event.latitude == null || event.longitude == null) return false;
      if (q) {
        const haystack = [event.title, event.description, event.organizer, ...(event.tags ?? [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [events, query]);

  // Autocomplete dropdown under the events search — title matches only (not
  // the broader description/organizer/tags haystack `filteredEvents` above
  // matches on), a "jump straight to an event you already have in mind"
  // shortcut alongside the live-filtered pin layer. Same pattern as
  // ExploreFilterBar's spot-name autocomplete.
  const [isEventSearchFocused, setIsEventSearchFocused] = useState(false);
  const [activeEventSuggestion, setActiveEventSuggestion] = useState(-1);
  const eventSearchWrapperRef = useRef<HTMLDivElement>(null);

  const eventSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const startsWith: EventRow[] = [];
    const contains: EventRow[] = [];
    for (const event of events) {
      const title = event.title.toLowerCase();
      if (title.startsWith(q)) startsWith.push(event);
      else if (title.includes(q)) contains.push(event);
    }
    return [...startsWith, ...contains].slice(0, 6);
  }, [query, events]);

  const showEventSuggestions = isEventSearchFocused && eventSuggestions.length > 0;

  const selectEventSuggestion = useCallback(
    (event: EventRow) => {
      setIsEventSearchFocused(false);
      setSelectedSpot(null);
      setSelectedEvent(event);
      revealSelection(event.latitude, event.longitude);
    },
    [revealSelection],
  );

  const handleEventSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showEventSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveEventSuggestion((i) => Math.min(i + 1, eventSuggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveEventSuggestion((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeEventSuggestion >= 0) {
      e.preventDefault();
      selectEventSuggestion(eventSuggestions[activeEventSuggestion]);
    } else if (e.key === "Escape") {
      setIsEventSearchFocused(false);
    }
  };

  // Closes the dropdown on an outside click — see ExploreFilterBar's
  // identical pattern for why not a plain onBlur.
  useEffect(() => {
    if (!isEventSearchFocused) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!eventSearchWrapperRef.current?.contains(e.target as Node)) setIsEventSearchFocused(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isEventSearchFocused]);

  const visibleCount = mode === "spots" ? filteredSpots.length : filteredEvents.length;

  // Init the map once, client-side only.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
      });
      L.control.zoom({ position: "topright" }).addTo(map);

      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      const tileLayer = L.tileLayer(isNightRef.current || prefersDark ? DARK_TILES : LIGHT_TILES, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 20,
      }).addTo(map);
      tileLayerRef.current = tileLayer;

      // Not added to the map yet — the mode-sync effect below adds whichever
      // one is active, so spots and events never render at the same time.
      markerLayerRef.current = L.layerGroup();
      eventLayerRef.current = L.layerGroup();
      mapRef.current = map;
      setReady(true);
    })();

    // Night Mode always wins: once it's on, OS scheme changes shouldn't pull
    // the tiles back to light.
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSchemeChange = (e: MediaQueryListEvent) => {
      tileLayerRef.current?.setUrl(isNightRef.current || e.matches ? DARK_TILES : LIGHT_TILES);
    };
    mq?.addEventListener("change", onSchemeChange);

    const spotMarkers = spotMarkersRef.current;
    const eventMarkers = eventMarkersRef.current;
    return () => {
      cancelled = true;
      mq?.removeEventListener("change", onSchemeChange);
      mapRef.current?.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markerLayerRef.current = null;
      eventLayerRef.current = null;
      spotMarkers.clear();
      eventMarkers.clear();
    };
  }, []);

  // Clicking empty map (not a pin) dismisses the open panel/sheet, same as
  // clicking its own backdrop/close button.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.on("click", closePanel);
    return () => {
      map.off("click", closePanel);
    };
  }, [ready, closePanel]);

  // Deselect whenever the mode toggle flips, or the active pin drops out of
  // the currently-filtered set (e.g. a filter now excludes it). Adjusted
  // during render, not in an effect — see "Adjusting state when a prop
  // changes" in the React docs: each branch is guarded so it only fires on
  // the actual transition, not every render.
  const [selectionResetMode, setSelectionResetMode] = useState(mode);
  if (mode !== selectionResetMode) {
    setSelectionResetMode(mode);
    setSelectedSpot(null);
    setSelectedEvent(null);
  }
  if (selectedSpot && !filteredSpots.some((s) => s.id === selectedSpot.id)) {
    setSelectedSpot(null);
  }
  if (selectedEvent && !filteredEvents.some((e) => e.id === selectedEvent.id)) {
    setSelectedEvent(null);
  }

  // Flip the base tiles to the dark set the instant Night Mode is toggled
  // (not just on the next OS scheme-change event) — re-checks the OS
  // preference too, so turning Night Mode back off doesn't fight a system
  // that's independently in dark mode.
  useEffect(() => {
    if (!ready) return;
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    tileLayerRef.current?.setUrl(isNight || prefersDark ? DARK_TILES : LIGHT_TILES);
  }, [ready, isNight]);

  // Swap which layer is actually attached to the map when the mode toggle
  // flips — this (not visibility CSS) is what keeps spots and events from
  // ever showing at once.
  useEffect(() => {
    const map = mapRef.current;
    const spotLayer = markerLayerRef.current;
    const eventLayer = eventLayerRef.current;
    if (!ready || !map || !spotLayer || !eventLayer) return;

    if (mode === "spots") {
      if (map.hasLayer(eventLayer)) map.removeLayer(eventLayer);
      if (!map.hasLayer(spotLayer)) map.addLayer(spotLayer);
    } else {
      if (map.hasLayer(spotLayer)) map.removeLayer(spotLayer);
      if (!map.hasLayer(eventLayer)) map.addLayer(eventLayer);
    }
  }, [ready, mode]);

  // Re-render markers whenever the filtered set changes. Pins carry no
  // text, so unlike before this no longer needs to depend on locale/labels —
  // those only apply to the detail panel now, built separately on selection.
  useEffect(() => {
    if (!ready || !mapRef.current || !markerLayerRef.current) return;
    let cancelled = false;

    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled) return;
      const layer = markerLayerRef.current;
      if (!layer) return;
      layer.clearLayers();
      spotMarkersRef.current.clear();

      const bounds: [number, number][] = [];

      filteredSpots.forEach((spot) => {
        // In vibes mode a spot pin recolors to a vibe instead of its
        // category — with chips selected (activeVibes), each pin uses
        // whichever *one* of them the spot matches, since everything on
        // screen already matches at least one (see MapExplorerSection's
        // filteredSpots). A spot matching more than one selected vibe gets
        // a distinct gold rather than an arbitrary pick among its matches.
        // On "All" (nothing selected) each pin falls back to its own
        // first-tagged vibe instead. The glyph itself always stays the
        // spot's category icon (a café pin still reads as a café) — only
        // the color swaps, so vibes mode is a tint on the same map, not a
        // different icon set.
        const matchingVibes = activeVibes.filter((v) => spot.vibes.includes(v));
        let color: string;
        if (!useVibeIcons) {
          color = CATEGORY_META[spot.category].color;
        } else if (matchingVibes.length > 1) {
          color = isNight ? MULTI_VIBE_COLOR_NIGHT : MULTI_VIBE_COLOR;
        } else {
          const pinVibe = matchingVibes[0] ?? spot.vibes[0];
          color = VIBE_META[pinVibe].color;
        }
        const shapes = CATEGORY_ICON_SHAPES[spot.category];
        const icon = L.divIcon({
          className: "spot-pin-marker",
          // Featured star hidden site-wide for now — swap back to
          // `spot.is_featured` once there is real featured content.
          html: pinHtml(color, shapes, false),
          iconSize: [34, 34],
          iconAnchor: [17, 34],
          popupAnchor: [0, -32],
        });

        const marker = L.marker([spot.latitude, spot.longitude], { icon });
        marker.on("click", () => {
          setSelectedEvent(null);
          setSelectedSpot(spot);
          revealSelection(spot.latitude, spot.longitude);
        });

        marker.addTo(layer);
        spotMarkersRef.current.set(spot.id, marker);
        bounds.push([spot.latitude, spot.longitude]);
      });

      // Only steer the viewport if spots are the layer actually on screen —
      // otherwise switching filters in events mode would yank the map back.
      if (bounds.length > 0 && mode === "spots") {
        mapRef.current?.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, filteredSpots, mode, revealSelection, useVibeIcons, activeVibes, isNight]);

  // Render event pins on their own layer, using the /public/icons badges.
  useEffect(() => {
    if (!ready || !mapRef.current || !eventLayerRef.current) return;
    let cancelled = false;

    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled) return;
      const layer = eventLayerRef.current;
      if (!layer) return;
      layer.clearLayers();
      eventMarkersRef.current.clear();

      const bounds: [number, number][] = [];

      filteredEvents.forEach((event) => {
        const meta = EVENT_CATEGORY_META[event.category];
        const icon = L.divIcon({
          className: "event-pin-marker",
          // Featured star hidden site-wide for now — swap back to
          // `event.is_featured` once there is real featured content.
          html: eventPinHtml(meta.icon, false),
          iconSize: [36, 36],
          iconAnchor: [18, 36],
          popupAnchor: [0, -32],
        });

        const marker = L.marker([event.latitude, event.longitude], { icon });
        marker.on("click", () => {
          setSelectedSpot(null);
          setSelectedEvent(event);
          revealSelection(event.latitude, event.longitude);
        });

        marker.addTo(layer);
        eventMarkersRef.current.set(event.id, marker);
        bounds.push([event.latitude, event.longitude]);
      });

      // Mirror the spot layer's behavior: only refit while events are the
      // visible layer, so filtering spots elsewhere can't move this view.
      if (bounds.length > 0 && mode === "events") {
        mapRef.current?.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, filteredEvents, mode, revealSelection]);

  // Reflects the selected pin onto the markers themselves — runs after the
  // two effects above (declaration order), so it always sees freshly-built
  // markers rather than ones about to be torn down.
  useEffect(() => {
    spotMarkersRef.current.forEach((marker, id) => {
      const active = selectedSpot?.id === id;
      const el = marker.getElement();
      el?.classList.toggle("spot-pin-marker--active", active);
      el?.querySelector(".spot-pin")?.classList.toggle("spot-pin--active", active);
    });
    eventMarkersRef.current.forEach((marker, id) => {
      marker.getElement()?.classList.toggle("event-pin-marker--active", selectedEvent?.id === id);
    });
  }, [selectedSpot, selectedEvent, filteredSpots, filteredEvents]);

  // The fixed site header's real rendered height (it grows with safe-area
  // insets on notched devices) — a hardcoded `top-14` left a gap the map's
  // tiles could show through, blurred, behind the header's glass background.
  // Measured instead of assumed so it can't drift out of sync. Shared with
  // ExploreFilterBar, which needs the same measurement.
  const headerHeight = useHeaderHeight(fullScreen);

  // In fullScreen mode (the explore page's map view, the only place
  // `fullScreen` is used) ExploreFilterBar floats fixed over this same top
  // strip at a higher z-index than anything in here — so the desktop detail
  // panel, which would otherwise also start flush with the map's top edge,
  // needs to start below it instead or its close button ends up
  // unreachable underneath that bar. Measured (not assumed) since the bar's
  // height varies with its content (e.g. the vibes chip row wrapping).
  const [panelTopOffset, setPanelTopOffset] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!fullScreen) return;
    const bar = document.querySelector<HTMLElement>("[data-explore-filter-bar]");
    const mapBox = containerRef.current;
    if (!bar || !mapBox) return;
    const update = () => {
      const barBottom = bar.getBoundingClientRect().bottom;
      const mapTop = mapBox.getBoundingClientRect().top;
      setPanelTopOffset(Math.max(16, barBottom - mapTop + 8));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(bar);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [fullScreen]);

  const locateMe = useCallback(() => {
    if (!mapRef.current) return;
    if (!("geolocation" in navigator)) {
      toast.error(tMap("locateError"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { default: L } = await import("leaflet");
        const { latitude, longitude } = pos.coords;
        if (!mapRef.current) return;
        if (meMarkerRef.current) {
          meMarkerRef.current.setLatLng([latitude, longitude]);
        } else {
          meMarkerRef.current = L.circleMarker([latitude, longitude], {
            radius: 8,
            color: "#ffffff",
            weight: 3,
            fillColor: "#1f6f6b",
            fillOpacity: 1,
            className: "me-marker",
          })
            .addTo(mapRef.current)
            .bindTooltip(tMap("youAreHere"));
        }
        mapRef.current.flyTo([latitude, longitude], 16, { duration: 0.8 });
        setLocating(false);
      },
      () => {
        toast.error(tMap("locateError"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [tMap]);

  // Normalizes whichever pin is selected (spot xor event) into the shape
  // MapDetailPanel renders — keeps that component ignorant of both domain
  // types, and keeps this file the only place that has to know their fields.
  const panelContent: DetailPanelContent | null = useMemo(() => {
    if (selectedSpot) {
      const meta = CATEGORY_META[selectedSpot.category];
      const Icon = meta.icon;
      const metaItems: string[] = [];
      if (selectedSpot.rating) metaItems.push(`★ ${selectedSpot.rating.toFixed(1)}`);
      if (selectedSpot.price_range) metaItems.push(selectedSpot.price_range);

      return {
        photoUrl: getSpotImage(selectedSpot),
        photoFallback: <Icon size={30} />,
        // Featured badge hidden site-wide for now — swap back to
        // `selectedSpot.is_featured ? useTranslations("night")("featuredBadge") : undefined`
        // once there is real featured content.
        featuredLabel: undefined,
        categoryLabel: tCategory(selectedSpot.category),
        categoryColor: meta.color,
        categoryIcon: <Icon size={13} />,
        title: selectedSpot.name,
        subtitle: selectedSpot.address,
        metaItems,
        description: selectedSpot.description,
        actions: [
          { label: tSpot("readMore"), primary: true, onClick: () => handleOpenSpot(selectedSpot) },
        ],
      };
    }

    if (selectedEvent) {
      const meta = EVENT_CATEGORY_META[selectedEvent.category];
      const dateLabel = new Intl.DateTimeFormat(locale === "es" ? "es-PA" : "en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(new Date(`${selectedEvent.date}T00:00:00`));
      const priceLabel =
        selectedEvent.price && selectedEvent.price > 0 ? `$${selectedEvent.price}` : tEvents("free");

      const actions: DetailPanelContent["actions"] = [
        { label: tEvents("viewDetails"), primary: true, onClick: () => handleOpenEvent(selectedEvent) },
      ];
      if (selectedEvent.booking_url) {
        const bookingUrl = selectedEvent.booking_url;
        actions.push({ label: tEvents("book"), onClick: () => window.open(bookingUrl, "_blank", "noopener,noreferrer") });
      }

      return {
        photoUrl: selectedEvent.photo,
        photoFallback: <CalendarDays size={30} />,
        categoryLabel: tEventCategory(selectedEvent.category),
        categoryColor: meta.color,
        categoryIcon: <Image src={meta.icon} alt="" width={13} height={13} />,
        title: selectedEvent.title,
        subtitle: `${dateLabel} · ${formatTime(selectedEvent.time_start, locale)}`,
        metaItems: [priceLabel],
        description: selectedEvent.description,
        actions,
      };
    }

    return null;
  }, [
    selectedSpot,
    selectedEvent,
    locale,
    tCategory,
    tEventCategory,
    tSpot,
    tEvents,
    handleOpenSpot,
    handleOpenEvent,
  ]);

  const hasSelection = panelContent !== null;
  // Also fires once on unmount with `false` — otherwise a parent using this
  // to gate its own floating UI would keep whatever the last selection
  // state was and never show that UI again after a map session that ended
  // with a pin selected.
  useEffect(() => {
    onSelectionChange?.(hasSelection);
    return () => onSelectionChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSelection]);

  return (
    <div
      className={cn(fullScreen ? "fixed inset-x-0 bottom-0 z-10" : "space-y-4", className)}
      style={fullScreen ? { top: headerHeight ?? 56 } : undefined}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden border-border",
          // `bg-background`: solid from the very first frame — while
          // fullscreen, this box sits over the rest of the page's normal
          // document flow (the page below it collapses out from under a
          // `position: fixed` element), and Leaflet doesn't paint its own
          // opaque background until it finishes loading. Without this, that
          // gap between mount and Leaflet-ready let whatever page content
          // was now sitting behind it (e.g. the events grid further down
          // the home page) show through.
          fullScreen ? "h-full border-t bg-background" : cn("rounded-[var(--radius-card)] border", heightClassName),
        )}
      >
        <div ref={containerRef} className="h-full w-full" />

        {!ready && (
          <div className="absolute inset-0 z-[1200] flex items-center justify-center bg-gradient-to-br from-aqua/10 to-coral/10">
            <Loader2 className="animate-spin text-aqua" size={28} />
          </div>
        )}

        {/* Floating toolbar — top-left, clear of the header (which drops its
            own spots/events nav while the map's open) and the zoom control
            (top-right). Labelled, not icon-only — a bare icon pair read as
            ambiguous, the text is what actually says which layer is showing.
            z-[1200]: Leaflet's own panes/controls climb as high as z-index
            1000 internally, so anything at or below that can end up
            rendering behind the map instead of on top of it. */}
        <div
          className={cn(
            "safe-top absolute left-4 right-16 top-4 z-[1200] flex flex-col items-start gap-2 sm:right-auto sm:w-72",
            // The desktop side panel occupies this same top-left corner —
            // step aside for it there. Mobile's sheet comes from the bottom
            // instead, so this stays put and reachable behind it.
            hasSelection && "md:hidden",
          )}
        >
          {/* TODO: ExploreFilterBar (rendered by MapExplorerSection, above
              this component) now also occupies this top strip — reconsider
              this pill's position together with that bar when events are
              re-enabled, rather than rediscovering the overlap from scratch. */}
          {hasEvents && (
            <div className="glass relative inline-flex rounded-full border border-border p-1 shadow-lg">
              {(
                [
                  { key: "spots" as const, icon: MapPin },
                  { key: "events" as const, icon: CalendarDays },
                ] satisfies { key: MapMode; icon: typeof MapPin }[]
              ).map(({ key, icon: Icon }) => {
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
                      "relative z-10 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors",
                      active ? "text-white" : "text-foreground/60 hover:text-foreground",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="map-mode-pill"
                        transition={{ type: "spring", stiffness: 500, damping: 34 }}
                        className="brand-accent absolute inset-0 -z-10 rounded-full"
                      />
                    )}
                    <Icon size={13} />
                    {tNav(key)}
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* Spots search now lives in the shared ExploreFilterBar above this
              component — only the (dormant, hasEvents-gated) events mode
              still needs its own search here. */}
          {mode === "events" && (
            <div ref={eventSearchWrapperRef} className="relative w-full">
              <Search
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40"
              />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  // Stale highlight from a previous query shouldn't linger
                  // once the list underneath it has changed.
                  setActiveEventSuggestion(-1);
                }}
                onFocus={() => setIsEventSearchFocused(true)}
                onKeyDown={handleEventSearchKeyDown}
                placeholder={tEvents("searchPlaceholder")}
                role="combobox"
                aria-expanded={showEventSuggestions}
                aria-controls="map-event-search-suggestions"
                aria-autocomplete="list"
                aria-activedescendant={
                  activeEventSuggestion >= 0
                    ? `map-event-search-suggestion-${activeEventSuggestion}`
                    : undefined
                }
                autoComplete="off"
                className="glass h-11 w-full rounded-full border border-border pl-10 pr-4 text-sm shadow-lg outline-none focus:ring-2 focus:ring-aqua"
              />

              {/* Autocomplete dropdown — title matches only (see
                  eventSuggestions above); selecting one opens the same
                  detail panel a marker click would, panned into view. */}
              <AnimatePresence>
                {showEventSuggestions && (
                  <motion.div
                    id="map-event-search-suggestions"
                    role="listbox"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="glass absolute inset-x-0 top-full z-10 mt-1.5 overflow-hidden rounded-2xl border border-border py-1.5 shadow-lg"
                  >
                    {eventSuggestions.map((event, i) => {
                      const meta = EVENT_CATEGORY_META[event.category];
                      return (
                        <button
                          key={event.id}
                          id={`map-event-search-suggestion-${i}`}
                          role="option"
                          aria-selected={i === activeEventSuggestion}
                          type="button"
                          onClick={() => selectEventSuggestion(event)}
                          onMouseEnter={() => setActiveEventSuggestion(i)}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors",
                            i === activeEventSuggestion ? "bg-foreground/5" : "hover:bg-foreground/5",
                          )}
                        >
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                            style={{ background: `${meta.color}26` }}
                          >
                            <Image src={meta.icon} alt="" width={14} height={14} />
                          </span>
                          <span className="min-w-0 flex-1 truncate font-semibold">{event.title}</span>
                          <span className="shrink-0 text-xs text-foreground/45">
                            {tEventCategory(event.category)}
                          </span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={locateMe}
          disabled={!ready || locating}
          aria-label={tMap("locateMe")}
          title={tMap("locateMe")}
          className={cn(
            "absolute bottom-4 left-4 z-[1200] flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-lg disabled:opacity-50",
            // Sits under the desktop panel's footprint — hidden there, still
            // reachable on mobile since the sheet comes from the bottom.
            hasSelection && "md:hidden",
          )}
        >
          {locating ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
        </button>

        <MapDetailPanel
          content={panelContent}
          closeLabel={tSpot("close")}
          onClose={closePanel}
          desktopTopOffsetPx={panelTopOffset}
        />

        {ready && visibleCount === 0 && (
          <div className="pointer-events-none absolute inset-0 z-[1200] flex items-center justify-center p-4">
            <div className="pointer-events-auto rounded-[var(--radius-card)] border border-dashed border-border bg-surface/95 px-6 py-4 text-center backdrop-blur">
              <SearchX size={26} className="mx-auto text-foreground/25" />
              <p className="mt-1 font-heading text-sm font-bold">{tEmpty("title")}</p>
              <p className="text-xs text-foreground/60">{tEmpty("subtitle")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
