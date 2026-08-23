"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker, Polyline, TileLayer } from "leaflet";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { CalendarDays } from "lucide-react";
import { MapDetailPanel, type DetailPanelContent } from "./MapDetailPanel";
import { useNightMode } from "./NightModeContext";
import { useRouter } from "@/i18n/navigation";
import { CATEGORY_META } from "@/lib/categories";
import { EVENT_CATEGORY_META } from "@/lib/eventCategories";
import { getSpotImage } from "@/lib/data/categoryImages";
import { formatTime } from "@/lib/hours";
import type { EventRow, Spot } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>';
const ROUTE_COLOR = "#146b8c"; // --color-aqua — matches the itinerary timeline's dots (ArticleDetailView)
// Casco Viejo, Panama City — initial view before the first fitBounds() call
// below (see SpotMap.tsx for the same fallback).
const DEFAULT_CENTER: [number, number] = [8.9528, -79.5347];
const DEFAULT_ZOOM = 15;

// Casco Viejo is small enough that a chronological itinerary can genuinely
// send you back past a spot you already walked by — a real crossing route,
// not a bug. But two stops sitting within ~15m of each other (i.e. on the
// same block) would render as fully overlapping pins, one unclickable under
// the other. Nudges every stop in such a cluster out onto a small circle
// around the cluster's center so each pin stays distinct and tappable —
// display-only, doesn't touch the real coordinates used for links/panels.
const CLUSTER_THRESHOLD_DEG = 0.00015; // ~15-16m at this latitude

function declutter(points: { lat: number; lng: number }[]): { lat: number; lng: number }[] {
  const n = points.length;
  const clusterOf = new Array(n).fill(-1);
  const clusters: number[][] = [];

  for (let i = 0; i < n; i++) {
    if (clusterOf[i] !== -1) continue;
    const cluster = [i];
    clusterOf[i] = clusters.length;
    for (let j = i + 1; j < n; j++) {
      if (clusterOf[j] !== -1) continue;
      if (Math.hypot(points[i].lat - points[j].lat, points[i].lng - points[j].lng) < CLUSTER_THRESHOLD_DEG) {
        cluster.push(j);
        clusterOf[j] = clusters.length;
      }
    }
    clusters.push(cluster);
  }

  const result = points.map((p) => ({ ...p }));
  for (const cluster of clusters) {
    if (cluster.length <= 1) continue;
    const centerLat = cluster.reduce((sum, i) => sum + points[i].lat, 0) / cluster.length;
    const centerLng = cluster.reduce((sum, i) => sum + points[i].lng, 0) / cluster.length;
    const radius = CLUSTER_THRESHOLD_DEG * 0.9;
    cluster.forEach((i, k) => {
      const angle = (2 * Math.PI * k) / cluster.length;
      result[i] = { lat: centerLat + Math.sin(angle) * radius, lng: centerLng + Math.cos(angle) * radius };
    });
  }
  return result;
}

export interface ItineraryStop {
  id: string;
  /** 1-based position in the day plan — stamped on the pin. */
  index: number;
  latitude: number;
  longitude: number;
  name: string;
  href: { pathname: "/spots/[slug]"; params: { slug: string } } | { pathname: "/events/[slug]"; params: { slug: string } };
  /** Full record, so a click can open the same rich detail panel SpotMap
   * uses — not just navigate straight to the page. */
  place: { kind: "spot"; spot: Spot } | { kind: "event"; event: EventRow };
}

/**
 * Route map for an "itinerary"-layout article (see ArticleDetailView) — a
 * numbered pin per stop, in day-plan order, connected by a dashed line so
 * the shape of the route reads at a glance. Clicking a pin opens the same
 * MapDetailPanel SpotMap uses, in its compact form (photo, category, title,
 * "read more") since the article text around the map already carries the
 * description — rather than navigating away immediately. Deliberately not
 * SpotMap itself: no filters/search/mode-toggle chrome, just the fixed,
 * ordered route.
 */
export function ItineraryMap({
  stops,
  className,
  heightClassName = "h-[45vh] min-h-[320px]",
}: {
  stops: ItineraryStop[];
  className?: string;
  heightClassName?: string;
}) {
  const router = useRouter();
  const locale = useLocale();
  const tSpot = useTranslations("spot");
  const tCategory = useTranslations("category");
  const tEventCategory = useTranslations("eventCategory");
  const tEvents = useTranslations("events");
  const { isNight } = useNightMode();
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<ItineraryStop | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);
  const lineRef = useRef<Polyline | null>(null);

  // Mirrors SpotMap/MiniMap's isNightRef — the init effect below only runs
  // once (mount), so it needs a live read of the latest `isNight` at that
  // instant rather than whatever it closed over at first render.
  const isNightRef = useRef(isNight);
  useEffect(() => {
    isNightRef.current = isNight;
  }, [isNight]);

  // Tracked in a ref, not state — only read at click-time, mirrors SpotMap.
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

  // Nudges the map so the selected pin doesn't end up hidden behind the
  // panel/sheet about to cover it — same idea as SpotMap's revealSelection.
  const revealSelection = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;
    if (isDesktopRef.current) {
      map.panInside([lat, lng], { paddingTopLeft: [412, 24], paddingBottomRight: [24, 24], animate: true });
    } else {
      map.panInside([lat, lng], { paddingTopLeft: [24, 24], paddingBottomRight: [24, 320], animate: true });
    }
  }, []);

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
        scrollWheelZoom: false,
      });
      L.control.zoom({ position: "topright" }).addTo(map);
      map.on("click", () => setSelected(null));

      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      tileLayerRef.current = L.tileLayer(
        isNightRef.current || prefersDark ? DARK_TILES : LIGHT_TILES,
        { attribution: TILE_ATTRIBUTION, maxZoom: 20 },
      ).addTo(map);

      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markersRef.current = [];
      lineRef.current = null;
    };
    // One map per mounted instance — a different article gets a fresh
    // ItineraryMap (keyed by the caller), not a re-init here.
  }, []);

  // Swaps the tile set live if Night Mode is toggled after mount — the init
  // effect above only reads isNight once, at creation.
  useEffect(() => {
    if (!ready) return;
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    tileLayerRef.current?.setUrl(isNight || prefersDark ? DARK_TILES : LIGHT_TILES);
  }, [ready, isNight]);

  // Draw the numbered pins + connecting line whenever the stop list changes.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    let cancelled = false;

    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      const map = mapRef.current;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      lineRef.current?.remove();
      lineRef.current = null;

      // Declutter for display only — links/panel content below still use
      // each stop's real latitude/longitude.
      const displayPoints = declutter(stops.map((s) => ({ lat: s.latitude, lng: s.longitude })));
      const points: [number, number][] = displayPoints.map((p) => [p.lat, p.lng]);
      if (points.length === 0) return;

      if (points.length > 1) {
        lineRef.current = L.polyline(points, {
          color: ROUTE_COLOR,
          weight: 3,
          opacity: 0.7,
          dashArray: "1, 10",
          lineCap: "round",
        }).addTo(map);
      }

      stops.forEach((stop, i) => {
        const icon = L.divIcon({
          className: "itinerary-pin-marker",
          html: `<span class="itinerary-pin">${stop.index}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        const marker = L.marker(points[i], { icon })
          .bindTooltip(`${stop.index}. ${stop.name}`)
          .addTo(map);
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e); // don't let the map's own click handler close the panel right back
          setSelected(stop);
          revealSelection(points[i][0], points[i][1]);
        });
        markersRef.current.push(marker);
      });

      map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 17 });
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, stops, revealSelection]);

  // Deselect if the stop list itself changes out from under the current
  // selection (e.g. article content reloads) and it's no longer in it.
  if (selected && !stops.some((s) => s.id === selected.id)) {
    setSelected(null);
  }

  const handleOpenSpot = useCallback(
    (spot: Spot) => router.push({ pathname: "/spots/[slug]", params: { slug: spot.slug } }),
    [router],
  );
  const handleOpenEvent = useCallback(
    (event: EventRow) => router.push({ pathname: "/events/[slug]", params: { slug: event.slug } }),
    [router],
  );

  // Same normalization SpotMap does — a Spot or an EventRow into the panel's
  // domain-agnostic content shape.
  const panelContent: DetailPanelContent | null = useMemo(() => {
    if (!selected) return null;

    if (selected.place.kind === "spot") {
      const spot = selected.place.spot;
      const meta = CATEGORY_META[spot.category];
      const Icon = meta.icon;
      const metaItems: string[] = [];
      if (spot.rating) metaItems.push(`★ ${spot.rating.toFixed(1)}`);
      if (spot.price_range) metaItems.push(spot.price_range);

      return {
        photoUrl: getSpotImage(spot),
        photoFallback: <Icon size={30} />,
        // Featured badge hidden site-wide for now — swap back to
        // `spot.is_featured ? useTranslations("night")("featuredBadge") : undefined`
        // once there is real featured content.
        featuredLabel: undefined,
        categoryLabel: tCategory(spot.category),
        categoryIcon: <Icon size={13} />,
        title: spot.name,
        subtitle: spot.address,
        metaItems,
        description: spot.description,
        actions: [{ label: tSpot("readMore"), primary: true, onClick: () => handleOpenSpot(spot) }],
      };
    }

    const event = selected.place.event;
    const meta = EVENT_CATEGORY_META[event.category];
    const dateLabel = new Intl.DateTimeFormat(locale === "es" ? "es-PA" : "en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(`${event.date}T00:00:00`));
    const priceLabel = event.price && event.price > 0 ? `$${event.price}` : tEvents("free");

    const actions: DetailPanelContent["actions"] = [
      { label: tEvents("viewDetails"), primary: true, onClick: () => handleOpenEvent(event) },
    ];
    if (event.booking_url) {
      const bookingUrl = event.booking_url;
      actions.push({ label: tEvents("book"), onClick: () => window.open(bookingUrl, "_blank", "noopener,noreferrer") });
    }

    return {
      photoUrl: event.photo,
      photoFallback: <CalendarDays size={30} />,
      categoryLabel: tEventCategory(event.category),
      categoryIcon: <Image src={meta.icon} alt="" width={13} height={13} />,
      title: event.title,
      subtitle: `${dateLabel} · ${formatTime(event.time_start, locale)}`,
      metaItems: [priceLabel],
      description: event.description,
      actions,
    };
  }, [selected, locale, tCategory, tEventCategory, tSpot, tEvents, handleOpenSpot, handleOpenEvent]);

  return (
    <div className={cn("relative", className)}>
      <div ref={containerRef} className={cn("w-full overflow-hidden rounded-[var(--radius-card)] border border-border", heightClassName)} />
      <MapDetailPanel
        content={panelContent}
        closeLabel={tSpot("close")}
        onClose={() => setSelected(null)}
        compact
      />
    </div>
  );
}
