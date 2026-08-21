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
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { EASE_OUT, TAP_SPRING } from "./motion";
import { MapDetailPanel, type DetailPanelContent } from "./MapDetailPanel";
import { useHeaderHeight } from "./useHeaderHeight";
import { useNightMode } from "./NightModeContext";
import { useRouter } from "@/i18n/navigation";
import { CATEGORY_META } from "@/lib/categories";
import { EVENT_CATEGORIES, EVENT_CATEGORY_META } from "@/lib/eventCategories";
import { getSpotImage } from "@/lib/data/categoryImages";
import { isOpenNow, formatTime } from "@/lib/hours";
import type { EventCategory, EventRow, PriceRange, Spot, SpotCategory } from "@/lib/types/database";
import { cn } from "@/lib/utils";

type MapMode = "spots" | "events";

const PRICE_LEVELS: PriceRange[] = ["$", "$$", "$$$", "$$$$"];
type EventPriceFilter = "free" | "paid";
const EVENT_PRICE_FILTERS: EventPriceFilter[] = ["free", "paid"];
type EventDateFilter = "all" | "today" | "week" | "weekend";

// Casco Viejo, Panama City — used when there's nothing to fit bounds to.
const DEFAULT_CENTER: [number, number] = [8.9528, -79.5347];
const DEFAULT_ZOOM = 15;
const PANAMA_TZ = "America/Panama"; // UTC-5, no DST — same convention as lib/hours.ts

/** "YYYY-MM-DD" for `date`, evaluated in Panama's timezone — matches the
 * plain date strings events are stored with, so it's safe to compare directly. */
function panamaDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PANAMA_TZ }).format(date);
}

function matchesEventDateFilter(event: EventRow, filter: EventDateFilter): boolean {
  if (filter === "all") return true;
  const today = new Date(`${panamaDateKey(new Date())}T00:00:00`);
  const eventDate = new Date(`${event.date}T00:00:00`);
  const diffDays = Math.round((eventDate.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return false;

  if (filter === "today") return diffDays === 0;
  if (filter === "week") return diffDays <= 6;
  // weekend: the coming Saturday/Sunday, within the next week
  const dow = eventDate.getDay(); // 0=Sun..6=Sat
  return diffDays <= 7 && (dow === 0 || dow === 6);
}

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

function pinHtml(color: string, category: SpotCategory, featured: boolean): string {
  // `color` (not just `background`) is set here so Night Mode's glow rule
  // (globals.css) can pick it up via `currentColor` — one box-shadow rule
  // then matches whichever category a pin belongs to, no per-category CSS.
  return `
    <span class="spot-pin" style="background:${color};color:${color}">
      <span class="spot-pin__icon">${iconSvg(CATEGORY_ICON_SHAPES[category])}</span>
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
}) {
  const t = useTranslations("filters");
  const tSpot = useTranslations("spot");
  const tCategory = useTranslations("category");
  const tEventCategory = useTranslations("eventCategory");
  const tEvents = useTranslations("events");
  const tEmpty = useTranslations("empty");
  const tMap = useTranslations("map");
  const tNav = useTranslations("nav");
  const tNight = useTranslations("night");
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
  const [prices, setPrices] = useState<PriceRange[]>([]);
  const [openNow, setOpenNow] = useState(false);
  const [eventCategories, setEventCategories] = useState<EventCategory[]>([]);
  const [eventPrices, setEventPrices] = useState<EventPriceFilter[]>([]);
  const [eventDate, setEventDate] = useState<EventDateFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  const toggle = <T,>(list: T[], value: T, setter: (v: T[]) => void) =>
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const resetFilters = () => {
    if (mode === "spots") {
      setPrices([]);
      setOpenNow(false);
    } else {
      setQuery("");
      setEventCategories([]);
      setEventPrices([]);
      setEventDate("all");
    }
  };

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

  // `spots` is already filtered by search/category/vibe (see ExploreSection)
  // — this only layers price/openNow on top of that.
  const filteredSpots = useMemo(() => {
    return spots.filter((spot) => {
      if (spot.latitude == null || spot.longitude == null) return false;
      if (prices.length && (!spot.price_range || !prices.includes(spot.price_range)))
        return false;
      if (openNow && !isOpenNow(spot)) return false;
      return true;
    });
  }, [spots, prices, openNow]);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((event) => {
      if (event.latitude == null || event.longitude == null) return false;
      if (eventCategories.length && !eventCategories.includes(event.category)) return false;
      if (eventPrices.length) {
        const isFree = !event.price || event.price <= 0;
        if (!eventPrices.includes(isFree ? "free" : "paid")) return false;
      }
      if (!matchesEventDateFilter(event, eventDate)) return false;
      if (q) {
        const haystack = [event.title, event.description, event.organizer, ...(event.tags ?? [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [events, query, eventCategories, eventPrices, eventDate]);

  const hasQuery = query.trim().length > 0;
  const hasActiveFilters =
    mode === "spots"
      ? prices.length > 0 || openNow
      : hasQuery || eventCategories.length > 0 || eventPrices.length > 0 || eventDate !== "all";
  const activeFilterCount =
    mode === "spots"
      ? prices.length + (openNow ? 1 : 0)
      : eventCategories.length +
        eventPrices.length +
        (eventDate !== "all" ? 1 : 0) +
        (hasQuery ? 1 : 0);
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
      // top-right, not bottom-right — keeps clear of the fixed floating
      // filters button pinned to the viewport's bottom-right.
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
        const meta = CATEGORY_META[spot.category];
        const icon = L.divIcon({
          className: "spot-pin-marker",
          html: pinHtml(meta.color, spot.category, spot.is_featured),
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
  }, [ready, filteredSpots, mode, revealSelection]);

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
          html: eventPinHtml(meta.icon, event.is_featured),
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
        featuredLabel: selectedSpot.is_featured ? tNight("featuredBadge") : undefined,
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
    tNight,
    handleOpenSpot,
    handleOpenEvent,
  ]);

  const hasSelection = panelContent !== null;

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
          {/* TODO: ExploreFilterBar (rendered by ExploreSection, above this
              component) now also occupies this top strip — reconsider this
              pill's position together with that bar when events are
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
            <div className="relative w-full">
              <Search
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tEvents("searchPlaceholder")}
                className="glass h-11 w-full rounded-full border border-border pl-10 pr-4 text-sm shadow-lg outline-none focus:ring-2 focus:ring-aqua"
              />
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

      {/* Floating, always-reachable filters trigger — bottom-right thumb zone, survives scroll. */}
      <div className="safe-bottom fixed bottom-4 right-4 z-[1200]">
        <motion.button
          onClick={() => setFiltersOpen((v) => !v)}
          whileTap={{ scale: 0.94 }}
          transition={TAP_SPRING}
          className={cn(
            "flex h-12 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold shadow-lg transition-colors",
            hasActiveFilters ? "border-transparent bg-magenta text-white" : "glass border-border",
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
              className="fixed inset-0 z-[1300] bg-black/30 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className="safe-bottom fixed inset-x-4 bottom-20 z-[1300] mx-auto max-w-md space-y-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-2xl sm:p-5"
            >
              {/* The mode toggle up on the map gets covered by this sheet's own
                  backdrop, so restate scope here — otherwise it's ambiguous
                  which layer these chips are about to filter. */}
              {hasEvents && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/50">
                  {mode === "spots" ? <MapPin size={13} /> : <CalendarDays size={13} />}
                  {tNav(mode)}
                </div>
              )}

              {mode === "spots" ? (
                <>
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

                    {hasActiveFilters && (
                      <button
                        onClick={resetFilters}
                        className="flex items-center gap-1 text-xs font-semibold text-coral"
                      >
                        <X size={13} /> {t("reset")}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-foreground/50">
                      {t("category")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {EVENT_CATEGORIES.map((cat) => {
                        const meta = EVENT_CATEGORY_META[cat];
                        const isActive = eventCategories.includes(cat);
                        return (
                          <button
                            key={cat}
                            onClick={() => toggle(eventCategories, cat, setEventCategories)}
                            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                            style={{
                              backgroundColor: isActive ? meta.color : `${meta.color}1A`,
                              color: isActive ? "white" : meta.color,
                            }}
                          >
                            <Image src={meta.icon} alt="" width={14} height={14} />
                            {tEventCategory(cat)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-foreground/50">
                      {t("price")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {EVENT_PRICE_FILTERS.map((p) => (
                        <button
                          key={p}
                          onClick={() => toggle(eventPrices, p, setEventPrices)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-bold",
                            eventPrices.includes(p)
                              ? "border-aqua bg-aqua text-white"
                              : "border-border bg-transparent",
                          )}
                        >
                          {p === "free" ? tEvents("free") : tEvents("paid")}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-foreground/50">
                      {t("date")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["today", t("dateToday")],
                          ["week", t("dateWeek")],
                          ["weekend", t("dateWeekend")],
                        ] satisfies [EventDateFilter, string][]
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          onClick={() => setEventDate((current) => (current === value ? "all" : value))}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-bold",
                            eventDate === value
                              ? "border-aqua bg-aqua text-white"
                              : "border-border bg-transparent",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <div className="flex justify-end">
                      <button
                        onClick={resetFilters}
                        className="flex items-center gap-1 text-xs font-semibold text-coral"
                      >
                        <X size={13} /> {t("reset")}
                      </button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
