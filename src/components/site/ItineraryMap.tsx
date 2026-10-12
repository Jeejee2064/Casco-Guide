"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { CalendarDays } from "lucide-react";
import { MapDetailPanel, type DetailPanelContent } from "./MapDetailPanel";
import { useNightMode } from "./NightModeContext";
import { SvgMap, type SvgMapHandle, type SvgPin } from "./SvgMap";
import { useRouter } from "@/i18n/navigation";
import { CATEGORY_META } from "@/lib/categories";
import { EVENT_CATEGORY_META } from "@/lib/eventCategories";
import { getSpotImage } from "@/lib/data/categoryImages";
import { formatTime } from "@/lib/hours";
import { routeBetween } from "@/lib/routing";
import { latLngsToPath, project, zoomToScale } from "@/lib/svgMap/projection";
import type { EventRow, Spot } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const ROUTE_COLOR = "#146b8c"; // --color-aqua — matches the itinerary timeline's dots (ArticleDetailView)

// Casco Viejo is small enough that a chronological itinerary can genuinely
// send you back past a spot you already walked by — a real crossing route,
// not a bug. But two stops sitting within ~15m of each other (i.e. on the
// same block) would render as fully overlapping pins, one unclickable under
// the other. Nudges every stop in such a cluster out onto a small circle
// around the cluster's center so each pin stays distinct and tappable —
// display-only, doesn't touch the real coordinates used for links/panels.
const CLUSTER_THRESHOLD_DEG = 0.00015; // ~15-16m at this latitude

function declutter(
  points: { lat: number; lng: number }[],
): { lat: number; lng: number }[] {
  const n = points.length;
  const clusterOf = new Array(n).fill(-1);
  const clusters: number[][] = [];

  for (let i = 0; i < n; i++) {
    if (clusterOf[i] !== -1) continue;
    const cluster = [i];
    clusterOf[i] = clusters.length;
    for (let j = i + 1; j < n; j++) {
      if (clusterOf[j] !== -1) continue;
      if (
        Math.hypot(
          points[i].lat - points[j].lat,
          points[i].lng - points[j].lng,
        ) < CLUSTER_THRESHOLD_DEG
      ) {
        cluster.push(j);
        clusterOf[j] = clusters.length;
      }
    }
    clusters.push(cluster);
  }

  const result = points.map((p) => ({ ...p }));
  for (const cluster of clusters) {
    if (cluster.length <= 1) continue;
    const centerLat =
      cluster.reduce((sum, i) => sum + points[i].lat, 0) / cluster.length;
    const centerLng =
      cluster.reduce((sum, i) => sum + points[i].lng, 0) / cluster.length;
    const radius = CLUSTER_THRESHOLD_DEG * 0.9;
    cluster.forEach((i, k) => {
      const angle = (2 * Math.PI * k) / cluster.length;
      result[i] = {
        lat: centerLat + Math.sin(angle) * radius,
        lng: centerLng + Math.cos(angle) * radius,
      };
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
  href:
    | { pathname: "/spots/[slug]"; params: { slug: string } }
    | { pathname: "/events/[slug]"; params: { slug: string } };
  /** Full record, so a click can open the same rich detail panel SpotMap
   * uses — not just navigate straight to the page. */
  place: { kind: "spot"; spot: Spot } | { kind: "event"; event: EventRow };
}

/**
 * Route map for an "itinerary"-layout article (see ArticleDetailView) — a
 * numbered pin per stop, in day-plan order, connected by a real, street-
 * traced walking route between each consecutive pair (see lib/routing.ts) —
 * not a straight as-the-crow-flies line — so the shape of the route reads as
 * the actual path you'd walk. Clicking a pin opens the same
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
  interactive = true,
}: {
  stops: ItineraryStop[];
  className?: string;
  heightClassName?: string;
  /** false locks the map in place — no drag/pinch/scroll-wheel pan or zoom,
   * so a touch swipe starting over the map scrolls the page instead of
   * panning it. Pins stay fully clickable/tappable either way (marker
   * clicks are a separate DOM event, not gated by these handlers). Used by
   * the article "Places mentioned" map so it doesn't trap mobile scroll. */
  interactive?: boolean;
}) {
  const router = useRouter();
  const locale = useLocale();
  const tSpot = useTranslations("spot");
  const tCategory = useTranslations("category");
  const tEventCategory = useTranslations("eventCategory");
  const tEvents = useTranslations("events");
  const { isNight } = useNightMode();
  const [selected, setSelected] = useState<ItineraryStop | null>(null);
  // One entry per leg (consecutive stop pair), not a single path — a leg the
  // street graph couldn't connect (`approximate`) reads as dashed on its own
  // instead of flattening every other leg's solid, real path to match it.
  // Tagged with the stop list they were routed for, so a stale route never
  // draws over a new set of pins.
  const [routed, setRouted] = useState<{
    forStops: ItineraryStop[];
    legs: { d: string; approximate: boolean }[];
  } | null>(null);
  const legs = routed?.forStops === stops ? routed.legs : [];

  const mapRef = useRef<SvgMapHandle | null>(null);

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

  // Same as Leaflet's old dark check: Night Mode or the OS scheme.
  const [prefersDark, setPrefersDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setPrefersDark(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Nudges the map so the selected pin doesn't end up hidden behind the
  // panel/sheet about to cover it — same idea as SpotMap's revealSelection.
  const revealSelection = useCallback((x: number, y: number) => {
    mapRef.current?.panInside(
      [x, y],
      isDesktopRef.current
        ? { top: 24, left: 412, right: 24, bottom: 24 }
        : { top: 24, left: 24, right: 24, bottom: 320 },
    );
  }, []);

  // Declutter for display only — links/panel content still use each stop's
  // real latitude/longitude (including for the routed path below).
  const displayWorld = useMemo(
    () =>
      declutter(stops.map((s) => ({ lat: s.latitude, lng: s.longitude }))).map(
        (p) => project(p.lat, p.lng),
      ),
    [stops],
  );

  // Route legs + fit. Fit once the legs are known so bounds account for a
  // routed leg that bows out wider than a straight line between its pins.
  useEffect(() => {
    let cancelled = false;

    const fit = (extra: [number, number][]) => {
      const pts = [...displayWorld, ...extra];
      if (pts.length === 0) return;
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      mapRef.current?.fitBounds(
        [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
        { padding: 36, maxScale: zoomToScale(17) },
      );
    };
    fit([]);

    if (stops.length > 1) {
      (async () => {
        const results = await Promise.all(
          stops
            .slice(0, -1)
            .map((from, i) =>
              routeBetween(
                { lat: from.latitude, lng: from.longitude },
                { lat: stops[i + 1].latitude, lng: stops[i + 1].longitude },
              ),
            ),
        );
        if (cancelled) return;
        setRouted({
          forStops: stops,
          legs: results.map((leg) => ({
            d: latLngsToPath(leg.points),
            approximate: leg.approximate,
          })),
        });
        fit(results.flatMap((leg) => leg.points.map((p) => project(p[0], p[1]))));
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [stops, displayWorld]);

  const pins: SvgPin[] = useMemo(
    () =>
      stops.map((stop, i) => ({
        id: stop.id,
        x: displayWorld[i][0],
        y: displayWorld[i][1],
        label: `${stop.index}. ${stop.name}`,
        node: (
          <>
            <circle className="itinerary-pin-shadow" cy={3} r={14} />
            <circle className="itinerary-pin-dot" r={14} />
            <text className="itinerary-pin-num" textAnchor="middle" dy="0.35em">
              {stop.index}
            </text>
          </>
        ),
        onSelect: () => {
          setSelected(stop);
          revealSelection(displayWorld[i][0], displayWorld[i][1]);
        },
      })),
    [stops, displayWorld, revealSelection],
  );

  // Deselect if the stop list itself changes out from under the current
  // selection (e.g. article content reloads) and it's no longer in it.
  if (selected && !stops.some((s) => s.id === selected.id)) {
    setSelected(null);
  }

  const handleOpenSpot = useCallback(
    (spot: Spot) =>
      router.push({ pathname: "/spots/[slug]", params: { slug: spot.slug } }),
    [router],
  );
  const handleOpenEvent = useCallback(
    (event: EventRow) =>
      router.push({ pathname: "/events/[slug]", params: { slug: event.slug } }),
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
        actions: [
          {
            label: tSpot("readMore"),
            primary: true,
            onClick: () => handleOpenSpot(spot),
          },
        ],
      };
    }

    const event = selected.place.event;
    const meta = EVENT_CATEGORY_META[event.category];
    const dateLabel = new Intl.DateTimeFormat(
      locale === "es" ? "es-PA" : "en-US",
      {
        weekday: "short",
        month: "short",
        day: "numeric",
      },
    ).format(new Date(`${event.date}T00:00:00`));
    const priceLabel =
      event.price && event.price > 0 ? `$${event.price}` : tEvents("free");

    const actions: DetailPanelContent["actions"] = [
      {
        label: tEvents("viewDetails"),
        primary: true,
        onClick: () => handleOpenEvent(event),
      },
    ];
    if (event.booking_url) {
      const bookingUrl = event.booking_url;
      actions.push({
        label: tEvents("book"),
        onClick: () => window.open(bookingUrl, "_blank", "noopener,noreferrer"),
      });
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
  }, [
    selected,
    locale,
    tCategory,
    tEventCategory,
    tSpot,
    tEvents,
    handleOpenSpot,
    handleOpenEvent,
  ]);

  return (
    <div className={cn("relative", className)}>
      <SvgMap
        ref={mapRef}
        dark={isNight || prefersDark}
        interactive={interactive}
        pins={pins}
        onBackgroundClick={() => setSelected(null)}
        className={cn(
          "w-full rounded-[var(--radius-card)] border border-border",
          heightClassName,
        )}
      >
        {legs.map((leg, i) => (
          <g key={i} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path
              className="svgmap-line"
              d={leg.d}
              stroke="#ffffff"
              strokeOpacity={0.85}
              strokeWidth={6}
            />
            <path
              className="svgmap-line"
              d={leg.d}
              stroke={ROUTE_COLOR}
              strokeOpacity={0.95}
              strokeWidth={3.5}
              strokeDasharray={leg.approximate ? "2 10" : undefined}
            />
          </g>
        ))}
      </SvgMap>
      <MapDetailPanel
        content={panelContent}
        closeLabel={tSpot("close")}
        onClose={() => setSelected(null)}
        compact
      />
    </div>
  );
}
