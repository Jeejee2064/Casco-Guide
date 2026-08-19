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
import { Loader2, LocateFixed, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { EASE_OUT, TAP_SPRING } from "./motion";
import { useRouter } from "@/i18n/navigation";
import { CATEGORY_META, SPOT_CATEGORIES } from "@/lib/categories";
import { EVENT_CATEGORY_META } from "@/lib/eventCategories";
import { getSpotImage } from "@/lib/data/categoryImages";
import { isOpenNow, formatTime } from "@/lib/hours";
import type { EventRow, PriceRange, Spot, SpotCategory } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const PRICE_LEVELS: PriceRange[] = ["$", "$$", "$$$", "$$$$"];

// Casco Viejo, Panama City — used when there's nothing to fit bounds to.
const DEFAULT_CENTER: [number, number] = [8.9528, -79.5347];
const DEFAULT_ZOOM = 15;

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
  const locale = useLocale();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [prices, setPrices] = useState<PriceRange[]>([]);
  const [openNow, setOpenNow] = useState(false);
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
    setCategories([]);
    setPrices([]);
    setOpenNow(false);
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

  const filtered = useMemo(() => {
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

  const hasActiveFilters =
    query.trim().length > 0 || categories.length > 0 || prices.length > 0 || openNow;
  const activeFilterCount =
    categories.length + prices.length + (openNow ? 1 : 0) + (query.trim() ? 1 : 0);

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

      markerLayerRef.current = L.layerGroup().addTo(map);
      eventLayerRef.current = L.layerGroup().addTo(map);
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

      filtered.forEach((spot) => {
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

      if (bounds.length > 0) {
        mapRef.current?.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, filtered, locale, tCategory, tSpot]);

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

      events
        .filter((event) => event.latitude != null && event.longitude != null)
        .forEach((event) => {
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
        });
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, events, locale, tEventCategory, tEvents]);

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
    <div className={cn(fullScreen ? "fixed inset-x-0 top-14 bottom-0 z-10" : "space-y-4", className)}>
      <div
        className={cn(
          "relative w-full overflow-hidden border-border",
          fullScreen ? "h-full border-t" : cn("rounded-[var(--radius-card)] border", heightClassName),
        )}
      >
        <div ref={containerRef} className="h-full w-full" />

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-aqua/10 to-coral/10">
            <Loader2 className="animate-spin text-aqua" size={28} />
          </div>
        )}

        {/* Floating search — top-left, clear of the header and the zoom control (top-right). */}
        <div className="safe-top absolute left-4 right-16 top-4 z-10 sm:right-auto sm:w-72">
          <div className="relative">
            <Search
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tSite("searchPlaceholder")}
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
          className="absolute bottom-4 left-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-lg disabled:opacity-50"
        >
          {locating ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
        </button>

        {ready && filtered.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
            <div className="pointer-events-auto rounded-[var(--radius-card)] border border-dashed border-border bg-surface/95 px-6 py-4 text-center backdrop-blur">
              <SearchX size={26} className="mx-auto text-foreground/25" />
              <p className="mt-1 font-heading text-sm font-bold">{tEmpty("title")}</p>
              <p className="text-xs text-foreground/60">{tEmpty("subtitle")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Floating, always-reachable filters trigger — bottom-right thumb zone, survives scroll. */}
      <div className="safe-bottom fixed bottom-4 right-4 z-40">
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
