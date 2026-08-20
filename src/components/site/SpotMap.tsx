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
import { useRouter } from "@/i18n/navigation";
import { CATEGORY_META, SPOT_CATEGORIES } from "@/lib/categories";
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

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

/** Lucide's calendar-days glyph — used as a generic "event, no photo" mark. */
const CALENDAR_ICON_SHAPES: IconShape[] = [
  { d: "M8 2v3" },
  { d: "M16 2v3" },
  { x: "3", y: "3", width: "18", height: "18", rx: "2" },
  { d: "M3 9h18" },
  { d: "M8 13h.01" },
  { d: "M12 13h.01" },
  { d: "M16 13h.01" },
  { d: "M8 17h.01" },
  { d: "M12 17h.01" },
  { d: "M16 17h.01" },
];

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
  return `
    <span class="spot-pin" style="background:${color}">
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

/** Builds the popup DOM for an event. */
function buildEventPopupElement(
  event: EventRow,
  labels: {
    categoryLabel: string;
    dateLabel: string;
    free: string;
    book: string;
    viewDetails: string;
  },
  locale: string,
  onViewDetails: () => void,
): HTMLElement {
  const root = document.createElement("div");
  root.className = "spot-popup";
  const meta = EVENT_CATEGORY_META[event.category];
  const priceLabel = event.price && event.price > 0 ? `$${event.price}` : labels.free;

  root.innerHTML = `
    ${
      event.photo
        ? `<div class="spot-popup__photo" style="background-image:url('${event.photo}')"></div>`
        : `<div class="spot-popup__photo spot-popup__photo--empty">${iconSvg(CALENDAR_ICON_SHAPES, 26)}</div>`
    }
    <div class="spot-popup__body">
      <span class="spot-popup__category" style="background:${meta.color}">
        ${escapeHtml(labels.categoryLabel)}
      </span>
      <h3 class="spot-popup__title">${escapeHtml(event.title)}</h3>
      <div class="spot-popup__meta">
        <span>${escapeHtml(labels.dateLabel)} · ${escapeHtml(formatTime(event.time_start, locale))}</span>
        <span>${escapeHtml(priceLabel)}</span>
      </div>
      ${
        event.description
          ? `<p class="spot-popup__desc">${escapeHtml(event.description)}</p>`
          : ""
      }
      <div class="spot-popup__actions">
        <button type="button" data-action="details" class="spot-popup__btn spot-popup__btn--primary">
          ${escapeHtml(labels.viewDetails)}
        </button>
        ${
          event.booking_url
            ? `<button type="button" data-action="book" class="spot-popup__btn">${escapeHtml(labels.book)}</button>`
            : ""
        }
      </div>
    </div>
  `;

  root.querySelector('[data-action="details"]')?.addEventListener("click", onViewDetails);

  if (event.booking_url) {
    root.querySelector('[data-action="book"]')?.addEventListener("click", () => {
      window.open(event.booking_url!, "_blank", "noopener,noreferrer");
    });
  }

  return root;
}

/** Builds the popup DOM for a spot. Listeners are attached once, at creation. */
function buildPopupElement(
  spot: Spot,
  labels: { categoryLabel: string; readMore: string },
  onArticle: () => void,
): HTMLElement {
  const root = document.createElement("div");
  root.className = "spot-popup";

  const meta = CATEGORY_META[spot.category];
  const ratingHtml = spot.rating
    ? `<span>★ ${spot.rating.toFixed(1)}</span>`
    : "";
  const priceHtml = spot.price_range ? `<span>${spot.price_range}</span>` : "";

  root.innerHTML = `
    <div class="spot-popup__photo" style="background-image:url('${getSpotImage(spot)}')"></div>
    <div class="spot-popup__body">
      <span class="spot-popup__category" style="background:${meta.color}">
        ${escapeHtml(labels.categoryLabel)}
      </span>
      <h3 class="spot-popup__title">${escapeHtml(spot.name)}</h3>
      ${
        ratingHtml || priceHtml
          ? `<div class="spot-popup__meta">${ratingHtml}${priceHtml}</div>`
          : ""
      }
      ${
        spot.description
          ? `<p class="spot-popup__desc">${escapeHtml(spot.description)}</p>`
          : ""
      }
      <div class="spot-popup__actions">
        <button type="button" data-action="article" class="spot-popup__btn spot-popup__btn--primary">
          ${escapeHtml(labels.readMore)}
        </button>
      </div>
    </div>
  `;

  root.querySelector('[data-action="article"]')?.addEventListener("click", onArticle);

  return root;
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
  const tSite = useTranslations("site");
  const tSpot = useTranslations("spot");
  const tCategory = useTranslations("category");
  const tEventCategory = useTranslations("eventCategory");
  const tEvents = useTranslations("events");
  const tEmpty = useTranslations("empty");
  const tMap = useTranslations("map");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();

  // Spots and events render as two mutually-exclusive layers rather than
  // overlaid at once — with both on screen at the same density the pins
  // crowded each other out and the filters below couldn't tell which layer
  // they applied to. Plain local state, not the URL — this page is dynamic
  // (fetches spots/events fresh from Supabase), so routing a same-page
  // toggle through the URL costs a real server round-trip instead of the
  // instant switch it should feel like.
  const [mode, setMode] = useState<MapMode>("spots");
  const hasEvents = events.length > 0;

  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
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
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const eventLayerRef = useRef<LayerGroup | null>(null);
  const meMarkerRef = useRef<CircleMarker | null>(null);
  const selectedMarkerRef = useRef<LeafletMarker | null>(null);
  // Always-fresh callback for popup buttons built outside React's render cycle.
  const openSpotRef = useRef<(spot: Spot) => void>(() => {});
  const openEventRef = useRef<(event: EventRow) => void>(() => {});

  useEffect(() => {
    openSpotRef.current =
      onOpenSpot ??
      ((spot) => router.push({ pathname: "/spots/[slug]", params: { slug: spot.slug } }));
  }, [onOpenSpot, router]);

  useEffect(() => {
    openEventRef.current =
      onOpenEvent ??
      ((event) => router.push({ pathname: "/events/[slug]", params: { slug: event.slug } }));
  }, [onOpenEvent, router]);

  const toggle = <T,>(list: T[], value: T, setter: (v: T[]) => void) =>
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const resetFilters = () => {
    setQuery("");
    if (mode === "spots") {
      setCategories([]);
      setPrices([]);
      setOpenNow(false);
    } else {
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

  const filteredSpots = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spots.filter((spot) => {
      if (spot.latitude == null || spot.longitude == null) return false;
      if (categories.length && !categories.includes(spot.category)) return false;
      if (prices.length && (!spot.price_range || !prices.includes(spot.price_range)))
        return false;
      if (openNow && !isOpenNow(spot)) return false;
      if (q) {
        const haystack = [spot.name, spot.description, spot.cuisine_type, ...(spot.tags ?? [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [spots, query, categories, prices, openNow]);

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
      ? hasQuery || categories.length > 0 || prices.length > 0 || openNow
      : hasQuery || eventCategories.length > 0 || eventPrices.length > 0 || eventDate !== "all";
  const activeFilterCount =
    mode === "spots"
      ? categories.length + prices.length + (openNow ? 1 : 0) + (hasQuery ? 1 : 0)
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
      const tileLayer = L.tileLayer(prefersDark ? DARK_TILES : LIGHT_TILES, {
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

    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSchemeChange = (e: MediaQueryListEvent) => {
      tileLayerRef.current?.setUrl(e.matches ? DARK_TILES : LIGHT_TILES);
    };
    mq?.addEventListener("change", onSchemeChange);

    return () => {
      cancelled = true;
      mq?.removeEventListener("change", onSchemeChange);
      mapRef.current?.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markerLayerRef.current = null;
      eventLayerRef.current = null;
      selectedMarkerRef.current = null;
    };
  }, []);

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

  // Re-render markers whenever the filtered set (or locale, for popup labels) changes.
  useEffect(() => {
    if (!ready || !mapRef.current || !markerLayerRef.current) return;
    let cancelled = false;

    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled) return;
      const layer = markerLayerRef.current;
      if (!layer) return;
      layer.clearLayers();
      selectedMarkerRef.current = null;

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
        const popupEl = buildPopupElement(
          spot,
          {
            categoryLabel: tCategory(spot.category),
            readMore: tSpot("readMore"),
          },
          () => openSpotRef.current(spot),
        );
        marker.bindPopup(popupEl, { minWidth: 250, maxWidth: 260, autoPanPadding: [24, 24] });

        marker.on("popupopen", () => {
          const prevEl = selectedMarkerRef.current?.getElement();
          prevEl?.classList.remove("spot-pin-marker--active");
          prevEl?.querySelector(".spot-pin")?.classList.remove("spot-pin--active");

          const el = marker.getElement();
          el?.classList.add("spot-pin-marker--active");
          el?.querySelector(".spot-pin")?.classList.add("spot-pin--active");
          selectedMarkerRef.current = marker;
        });
        marker.on("popupclose", () => {
          const el = marker.getElement();
          el?.classList.remove("spot-pin-marker--active");
          el?.querySelector(".spot-pin")?.classList.remove("spot-pin--active");
        });

        marker.addTo(layer);
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
  }, [ready, filteredSpots, mode, locale, tCategory, tSpot]);

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
        const dateLabel = new Intl.DateTimeFormat(locale === "es" ? "es-PA" : "en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }).format(new Date(`${event.date}T00:00:00`));

        const popupEl = buildEventPopupElement(
          event,
          {
            categoryLabel: tEventCategory(event.category),
            dateLabel,
            free: tEvents("free"),
            book: tEvents("book"),
            viewDetails: tEvents("viewDetails"),
          },
          locale,
          () => openEventRef.current(event),
        );
        marker.bindPopup(popupEl, { minWidth: 250, maxWidth: 260, autoPanPadding: [24, 24] });
        marker.addTo(layer);
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
  }, [ready, filteredEvents, mode, locale, tEventCategory, tEvents]);

  // The fixed site header's real rendered height (it grows with safe-area
  // insets on notched devices) — a hardcoded `top-14` left a gap the map's
  // tiles could show through, blurred, behind the header's glass background.
  // Measured instead of assumed so it can't drift out of sync.
  const [headerHeight, setHeaderHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!fullScreen) return;
    const header = document.querySelector("header");
    if (!header) return;
    const update = () => setHeaderHeight(header.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(header);
    return () => ro.disconnect();
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
        <div className="safe-top absolute left-4 right-16 top-4 z-[1200] flex flex-col items-start gap-2 sm:right-auto sm:w-72">
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

          <div className="relative w-full">
            <Search
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={mode === "spots" ? tSite("searchPlaceholder") : tEvents("searchPlaceholder")}
              className="glass h-11 w-full rounded-full border border-border pl-10 pr-4 text-sm shadow-lg outline-none focus:ring-2 focus:ring-aqua"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={locateMe}
          disabled={!ready || locating}
          aria-label={tMap("locateMe")}
          title={tMap("locateMe")}
          className="absolute bottom-4 left-4 z-[1200] flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-lg disabled:opacity-50"
        >
          {locating ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
        </button>

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
                      {t("category")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {SPOT_CATEGORIES.map((cat) => {
                        const meta = CATEGORY_META[cat];
                        const Icon = meta.icon;
                        const isActive = categories.includes(cat);
                        return (
                          <button
                            key={cat}
                            onClick={() => toggle(categories, cat, setCategories)}
                            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                            style={{
                              backgroundColor: isActive ? meta.color : `${meta.color}1A`,
                              color: isActive ? "white" : meta.color,
                            }}
                          >
                            <Icon size={13} strokeWidth={2.5} /> {tCategory(cat)}
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
