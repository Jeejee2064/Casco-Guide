"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Ruler } from "lucide-react";
import { useTranslations } from "next-intl";
import { useNightMode } from "./NightModeContext";
import { SvgMap, type HtmlPin, type SvgMapHandle, type SvgPin } from "./SvgMap";
import { isWithinCascoViejo } from "@/lib/cascoMap";
import { cn } from "@/lib/utils";
import { formatDistance, haversineKm, walkingMinutes } from "@/lib/geo";
import { project, latLngsToPath, zoomToScale } from "@/lib/svgMap/projection";
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
  onGetDirections,
}: {
  name: string;
  latitude: number;
  longitude: number;
  className?: string;
  /** Renders a "Get directions" button in the pin's popup, wired to the
   * same handler as the page's own Get Directions button — omit to fall
   * back to the old name-only tooltip (e.g. the admin preview, which has
   * nothing real to route directions to). */
  onGetDirections?: () => void;
}) {
  const tMap = useTranslations("map");
  const tSpot = useTranslations("spot");
  const { isNight } = useNightMode();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(
    () => getLastKnownUserLocation(),
  );
  const [popupOpen, setPopupOpen] = useState(false);
  const mapRef = useRef<SvgMapHandle | null>(null);

  // Same dark check the Leaflet version made: Night Mode or the OS scheme.
  const [prefersDark, setPrefersDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setPrefersDark(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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

  const spotWorld = useMemo(() => project(latitude, longitude), [latitude, longitude]);

  // Frame the spot alone, or — once we know where the visitor is — both
  // points. `nearbyUserLocation` is a new object per location event, so key
  // the effect on its coordinates.
  // Extra headroom on top so the pin's popup (which opens above it) fits
  // inside the 200px box instead of being clipped.
  const userLat = nearbyUserLocation?.lat;
  const userLng = nearbyUserLocation?.lng;
  useEffect(() => {
    if (userLat == null || userLng == null) {
      mapRef.current?.fitBounds([...spotWorld, ...spotWorld], {
        padding: { top: 70, right: 0, bottom: 0, left: 0 },
        maxScale: zoomToScale(15),
      });
      return;
    }
    const me = project(userLat, userLng);
    mapRef.current?.fitBounds(
      [
        Math.min(me[0], spotWorld[0]),
        Math.min(me[1], spotWorld[1]),
        Math.max(me[0], spotWorld[0]),
        Math.max(me[1], spotWorld[1]),
      ],
      {
        padding: { top: 70, right: 28, bottom: 28, left: 28 },
        maxScale: zoomToScale(16),
      },
    );
  }, [userLat, userLng, spotWorld]);

  const spotPin: HtmlPin = {
    id: "spot",
    x: spotWorld[0],
    y: spotWorld[1],
    width: 26,
    height: 26,
    anchor: [13, 26],
    className: "spot-pin-marker",
    label: name,
    onSelect: () => setPopupOpen((open) => !open),
    node: (
      <>
        <span className="spot-pin" style={{ background: PIN_COLOR }} />
        {popupOpen && (
          <div
            className="spot-mini-popup-card"
            // Clicking inside the popup mustn't bubble to the pin's own
            // toggle-on-click.
            onClick={(e) => e.stopPropagation()}
          >
            <div className="spot-mini-popup">
              <p className="spot-mini-popup__title">{name}</p>
              {onGetDirections && (
                <button
                  type="button"
                  className="spot-mini-popup__button"
                  onClick={onGetDirections}
                >
                  {tSpot("getDirections")}
                </button>
              )}
            </div>
          </div>
        )}
      </>
    ),
  };

  const mePin: SvgPin | null = nearbyUserLocation
    ? (() => {
        const [x, y] = project(nearbyUserLocation.lat, nearbyUserLocation.lng);
        return {
          id: "me",
          x,
          y,
          label: tMap("youAreHere"),
          onSelect: () => {},
          node: (
            <circle r={7} fill="#1f6f6b" stroke="#ffffff" strokeWidth={2} />
          ),
        };
      })()
    : null;

  const linePath = nearbyUserLocation
    ? latLngsToPath([
        [nearbyUserLocation.lat, nearbyUserLocation.lng],
        [latitude, longitude],
      ])
    : null;

  // Only real once we have the visitor's position *and* it's inside Casco
  // Viejo (see nearbyUserLocation above) — no fallback center, and no
  // distance/walk-time badge for someone who isn't actually here to walk it.
  const distanceKm = nearbyUserLocation
    ? haversineKm(nearbyUserLocation.lat, nearbyUserLocation.lng, latitude, longitude)
    : null;
  const isClose = distanceKm != null && distanceKm < 0.8;

  return (
    <div className={cn("space-y-2.5", className)}>
      <SvgMap
        ref={mapRef}
        dark={isNight || prefersDark}
        interactive={false}
        controls={false}
        htmlPins={[spotPin]}
        pins={mePin ? [mePin] : []}
        onBackgroundClick={() => setPopupOpen(false)}
        className="h-[200px] w-full rounded-[var(--radius-card)] border border-border"
      >
        {linePath && (
          <path
            className="svgmap-line"
            d={linePath}
            fill="none"
            stroke="#b5573a"
            strokeOpacity={0.8}
            strokeWidth={2}
            strokeDasharray="5 6"
          />
        )}
      </SvgMap>
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
