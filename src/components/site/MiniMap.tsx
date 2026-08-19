"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { CircleMarker, Map as LeafletMap, Marker as LeafletMarker, Polyline } from "leaflet";
import { Ruler } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatDistance, haversineKm, walkingMinutes } from "@/lib/geo";

// Casco Viejo, Panama City — same fallback center as SpotMap/LocationPickerModal,
// used when geolocation isn't available so the distance badge still means something.
const DEFAULT_CENTER: [number, number] = [8.9528, -79.5347];

const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>';

/**
 * Small, non-interactive map showing "you are here" → the spot/event pin,
 * with a live distance + walk-time badge underneath. Sits above the existing
 * address/"Get directions" block; it doesn't replace it.
 */
export function MiniMap({
  name,
  latitude,
  longitude,
  color,
  className,
}: {
  name: string;
  latitude: number;
  longitude: number;
  /** Category accent color, e.g. CATEGORY_META[spot.category].color. */
  color: string;
  className?: string;
}) {
  const tMap = useTranslations("map");
  const [ready, setReady] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const spotMarkerRef = useRef<LeafletMarker | null>(null);
  const meMarkerRef = useRef<CircleMarker | null>(null);
  const lineRef = useRef<Polyline | null>(null);

  // Ask for geolocation once, silently — this is a background enhancement, so
  // a denial/error just leaves the map centered on the spot (no toast/nag).
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

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
      L.tileLayer(prefersDark ? DARK_TILES : LIGHT_TILES, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 20,
      }).addTo(map);

      const icon = L.divIcon({
        className: "spot-pin-marker",
        html: `<span class="spot-pin" style="background:${color}"></span>`,
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
      spotMarkerRef.current = null;
      meMarkerRef.current = null;
      lineRef.current = null;
    };
    // The map is created once for this spot/event; a different one gets a
    // fresh MiniMap instance (key'd by the caller), not a re-init here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once we know where the user is, drop their pin, draw the line, and fit
  // the map to both points.
  useEffect(() => {
    if (!ready || !mapRef.current || !userLocation) return;
    let cancelled = false;

    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      const map = mapRef.current;
      const points: [number, number][] = [
        [userLocation.lat, userLocation.lng],
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
  }, [ready, userLocation, latitude, longitude, tMap]);

  const origin = userLocation ?? { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };
  const distanceKm = haversineKm(origin.lat, origin.lng, latitude, longitude);
  const isClose = distanceKm < 0.8;

  return (
    <div className={cn("space-y-2.5", className)}>
      <div
        ref={containerRef}
        className="h-[200px] w-full overflow-hidden rounded-[var(--radius-card)] border border-border"
      />
      <div
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-[var(--radius-card)] border px-3 py-2.5 text-sm font-bold",
          isClose
            ? "border-lime/30 bg-lime/10 text-lime-dark dark:text-lime"
            : "border-gold/30 bg-gold/10 text-gold-dark dark:text-gold",
        )}
      >
        <Ruler size={15} />
        {formatDistance(distanceKm)} · {tMap("walkTime", { mins: walkingMinutes(distanceKm) })}
      </div>
    </div>
  );
}
