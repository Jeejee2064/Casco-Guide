"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { TAP_SPRING } from "./motion";
import { useNightMode } from "./NightModeContext";
import { SvgMap, type SvgMapHandle, type SvgPin } from "./SvgMap";
import { useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics/track";
import { setLastKnownUserLocation } from "@/lib/userLocation";
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
  route = true,
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
  /** false drops the street-traced legs and the pin numbers — for a plain
   * "places mentioned" set with no order (non-itinerary articles). */
  route?: boolean;
}) {
  const router = useRouter();
  const tSpot = useTranslations("spot");
  const tEvents = useTranslations("events");
  const tDiscover = useTranslations("discover");
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

  // Same as Leaflet's old dark check: Night Mode or the OS scheme.
  const [prefersDark, setPrefersDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setPrefersDark(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
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
        { padding: 44, maxScale: zoomToScale(17) },
      );
    };
    fit([]);

    if (route && stops.length > 1) {
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
  }, [stops, displayWorld, route]);

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
            {route && (
              <text className="itinerary-pin-num" textAnchor="middle" dy="0.35em">
                {stop.index}
              </text>
            )}
          </>
        ),
        // The map stays put — the popup is just an overlay on top of it.
        onSelect: () => setSelected(stop),
      })),
    [stops, displayWorld, route],
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

  // Same hand-off as SpotDetailView's "Get me there!" — walking directions
  // drawn on our own /map from the visitor's live position.
  const handleDirections = useCallback(
    (spot: Spot) => {
      track("directions_click", {
        entity: "spot",
        entity_id: spot.id,
        entity_slug: spot.slug,
      });
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            setLastKnownUserLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          () => {},
          { enableHighAccuracy: true, timeout: 10000 },
        );
      }
      router.push({ pathname: "/map", query: { directions: spot.slug } });
    },
    [router],
  );

  const popup = useMemo(() => {
    if (!selected) return null;
    const place = selected.place;
    if (place.kind === "spot") {
      const spot = place.spot;
      return {
        title: spot.name,
        actions: [
          { label: tSpot("readMore"), primary: true, onClick: () => handleOpenSpot(spot) },
          { label: tDiscover("getMeThere"), primary: false, onClick: () => handleDirections(spot) },
        ],
      };
    }
    const event = place.event;
    return {
      title: event.title,
      actions: [
        { label: tEvents("viewDetails"), primary: true, onClick: () => handleOpenEvent(event) },
      ],
    };
  }, [selected, tSpot, tDiscover, tEvents, handleOpenSpot, handleOpenEvent, handleDirections]);

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
      {/* Small overlay anchored inside the map box (not a fixed sheet), so it
          never slides behind the rest of the page on mobile. */}
      <AnimatePresence>
        {popup && (
          <motion.div
            key={selected?.id}
            role="dialog"
            aria-label={popup.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="glass absolute inset-x-3 bottom-3 z-[5] mx-auto max-w-sm rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label={tSpot("close")}
              className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20"
            >
              <X size={16} />
            </button>
            <h3 className="font-heading pr-10 text-base font-extrabold leading-tight">
              {popup.title}
            </h3>
            <div className="mt-3 flex gap-2">
              {popup.actions.map((action) => (
                <motion.button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  whileTap={{ scale: 0.97 }}
                  transition={TAP_SPRING}
                  className={cn(
                    "flex-1 rounded-[var(--radius-button)] border px-3 py-2.5 text-sm font-bold transition-colors",
                    action.primary
                      ? "accent-cta border-transparent text-white"
                      : "border-border bg-transparent hover:bg-foreground/5",
                  )}
                >
                  {action.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
