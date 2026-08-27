"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { CircleMarker, Map as LeafletMap, Marker as LeafletMarker, Polyline } from "leaflet";
import { Ruler } from "lucide-react";
import { useTranslations } from "next-intl";
import { useNightMode } from "./NightModeContext";
import { addCascoBasemap, isWithinCascoViejo, type CascoBasemap } from "@/lib/cascoMap";
import { cn } from "@/lib/utils";
import { formatDistance, haversineKm, walkingMinutes } from "@/lib/geo";
import { getLastKnownUserLocation, subscribeUserLocation } from "@/lib/userLocation";

// --color-aqua — same fixed blue as ItineraryMap's ROUTE_COLOR/pins, kept
// consistent across every detail-page mini map instead of the per-category
// color this used to take as a prop (which made this one map read
// differently from every other pin in the app).
const PIN_COLOR = "#146b8c";

/**
 * Small, non-interactive map showing "you are here" → the spot/event pin,
 * with a live distance + walk-time badge underneath. Sits above the existing
 * address/"Get directions" block; it doesn't replace it.
 */
export function MiniMap({
  name,
  latitude,
  longitude,
  className,
}: {
  name: string;
  latitude: number;
  longitude: number;
  className?: string;
}) {
  const tMap = useTranslations("map");
  const { isNight } = useNightMode();
  const [ready, setReady] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(
    () => getLastKnownUserLocation(),
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const basemapRef = useRef<CascoBasemap | null>(null);
  const spotMarkerRef = useRef<LeafletMarker | null>(null);
  const meMarkerRef = useRef<CircleMarker | null>(null);
  const lineRef = useRef<Polyline | null>(null);

  // Mirrors SpotMap's isNightRef — the init effect below only runs once
  // (mount), so it needs a live read of the latest `isNight` at that
  // instant rather than whatever it closed over at first render.
  const isNightRef = useRef(isNight);
  useEffect(() => {
    isNightRef.current = isNight;
  }, [isNight]);

  // Never asks for geolocation itself — only "Get Directions" should trigger
  // that permission prompt. This just picks up whatever fix that flow has
  // already obtained elsewhere this session (SpotDetailView's pre-warm,
  // SpotMap's itinerary watch — see lib/userLocation.ts) and stays subscribed
  // in case one lands after this MiniMap has already mounted. No fix yet (or
  // ever, if the visitor never asks for directions) just leaves the map
  // centered on the spot — same as a denial/error would.
  useEffect(() => subscribeUserLocation(setUserLocation), []);

  // A fix from clear across town (or another country, for a visitor just
  // checking the site before their trip) isn't "you are here" — it's noise.
  // Only ever draw the pin/line/distance badge once the visitor is actually
  // in the neighborhood; otherwise this behaves exactly like having no fix
  // at all (spot-only view, no badge).
  const nearbyUserLocation =
    userLocation && isWithinCascoViejo(userLocation.lat, userLocation.lng)
      ? userLocation
      : null;

  // Init the map once, client-side only.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [latitude, longitude],
        zoom: 15,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: false,
      });

      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      const basemap = await addCascoBasemap(L, map, isNightRef.current || prefersDark);
      // A second await (the basemap's own GeoJSON fetch) — re-check in case
      // this MiniMap unmounted while it was in flight.
      if (cancelled) {
        basemap.destroy();
        map.remove();
        return;
      }
      basemapRef.current = basemap;

      const icon = L.divIcon({
        className: "spot-pin-marker",
        html: `<span class="spot-pin" style="background:${PIN_COLOR}"></span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      });
      spotMarkerRef.current = L.marker([latitude, longitude], { icon })
        .bindTooltip(name)
        .addTo(map);

      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      basemapRef.current = null;
      spotMarkerRef.current = null;
      meMarkerRef.current = null;
      lineRef.current = null;
    };
    // The map is created once for this spot/event; a different one gets a
    // fresh MiniMap instance (key'd by the caller), not a re-init here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swaps the basemap's colors live if Night Mode is toggled after mount —
  // the init effect above only reads isNight once, at creation.
  useEffect(() => {
    if (!ready) return;
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    basemapRef.current?.setDark(isNight || prefersDark);
  }, [ready, isNight]);

  // Once we know where the user is, drop their pin, draw the line, and fit
  // the map to both points.
  useEffect(() => {
    if (!ready || !mapRef.current || !nearbyUserLocation) return;
    let cancelled = false;

    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      const map = mapRef.current;
      const points: [number, number][] = [
        [nearbyUserLocation.lat, nearbyUserLocation.lng],
        [latitude, longitude],
      ];

      if (meMarkerRef.current) {
        meMarkerRef.current.setLatLng(points[0]);
      } else {
        meMarkerRef.current = L.circleMarker(points[0], {
          radius: 7,
          color: "#ffffff",
          weight: 2,
          fillColor: "#1f6f6b",
          fillOpacity: 1,
        })
          .bindTooltip(tMap("youAreHere"))
          .addTo(map);
      }

      if (lineRef.current) {
        lineRef.current.setLatLngs(points);
      } else {
        lineRef.current = L.polyline(points, {
          color: "#b5573a",
          weight: 2,
          opacity: 0.8,
          dashArray: "5, 6",
        }).addTo(map);
      }

      map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 16 });
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, nearbyUserLocation, latitude, longitude, tMap]);

  // Only real once we have the visitor's position *and* it's inside Casco
  // Viejo (see nearbyUserLocation above) — no fallback center, and no
  // distance/walk-time badge for someone who isn't actually here to walk it.
  const distanceKm = nearbyUserLocation
    ? haversineKm(nearbyUserLocation.lat, nearbyUserLocation.lng, latitude, longitude)
    : null;
  const isClose = distanceKm != null && distanceKm < 0.8;

  return (
    <div className={cn("space-y-2.5", className)}>
      <div
        ref={containerRef}
        className="h-[200px] w-full overflow-hidden rounded-[var(--radius-card)] border border-border"
      />
      {distanceKm != null && (
        <div
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-[var(--radius-card)] border px-3 py-2.5 text-sm font-bold",
            isClose
              ? "border-lime/30 bg-lime/10 text-lime-readable"
              : "border-gold/30 bg-gold/10 text-gold-readable",
          )}
        >
          <Ruler size={15} />
          {formatDistance(distanceKm)} · {tMap("walkTime", { mins: walkingMinutes(distanceKm) })}
        </div>
      )}
    </div>
  );
}
