"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type {
  LayerGroup,
  Map as LeafletMap,
  Marker as LeafletMarker,
  Polyline as LeafletPolyline,
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
import { DirectionsPanel, type DirectionsStatus } from "./DirectionsPanel";
import { useHeaderHeight } from "./useHeaderHeight";
import { useNightMode } from "./NightModeContext";
import { useRouter } from "@/i18n/navigation";
import { CATEGORY_META } from "@/lib/categories";
import { EVENT_CATEGORY_META } from "@/lib/eventCategories";
import { VIBE_META } from "@/lib/vibes";
import { getSpotImage } from "@/lib/data/categoryImages";
import { formatTime, getHoursStatus } from "@/lib/hours";
import { haversineKm } from "@/lib/geo";
import { routeBetween, type Route } from "@/lib/routing";
import {
  addCascoBasemap,
  CASCO_VIEJO_ATTRIBUTION,
  CASCO_VIEJO_BOUNDS,
  CASCO_VIEJO_CENTER,
  CASCO_VIEJO_ENTRY_POINT,
  isWithinCascoViejo,
  type CascoBasemap,
} from "@/lib/cascoMap";
import { setLastKnownUserLocation } from "@/lib/userLocation";
import type {
  EventRow,
  Spot,
  SpotCategory,
  SpotVibe,
} from "@/lib/types/database";
import { track } from "@/lib/analytics/track";
import { cn } from "@/lib/utils";

type MapMode = "spots" | "events";

// Casco Viejo, Panama City — used when there's nothing to fit bounds to.
const DEFAULT_CENTER: [number, number] = [8.9528, -79.5347];
const DEFAULT_ZOOM = 15;

// Gold marks a pin whose spot matches *more than one* of the currently
// selected vibe chips — same warm gold as --color-gold/--night-gold in
// globals.css (featured picks), reused here so "this spot is an
// overlap" reads as premium rather than picking one of its matching vibes'
// colors arbitrarily (which would look inconsistent and jump around as the
// filter changes).
const MULTI_VIBE_COLOR = "#d4a24c";
const MULTI_VIBE_COLOR_NIGHT = "#ffcf6b";

// Default pin tone whenever nothing singles a spot out — "All"/a classic
// category filter, or vibes mode with no chip picked yet. Same brand blue as
// the rest of the site's chrome (--color-aqua, globals.css — the mode toggle
// and category chips in ExploreFilterBar use it via `.brand-accent`), and
// unlike MULTI_VIBE_COLOR below it doesn't swap to a brighter night variant —
// one fixed brand color for every category, day or night, so the *icon*, not
// the fill, is what tells pins apart. Only an active vibe selection earns
// pins their own color back.
const NEUTRAL_PIN_COLOR = "#146b8c";

// ⚠️ TEMPORARY TESTING AID — REMOVE ONCE DONE ⚠️
// Itinerary mode always tries the visitor's *real* geolocation first — this
// is only the fallback for when that fails or is unavailable (denied,
// times out, no Geolocation API, or the tester just isn't in Panama City),
// so the whole flow (route line, live dot, distance/time) can still be
// exercised. A real position, whenever the browser actually hands one back,
// always wins. Set to `null` to remove the fallback entirely (a real
// geolocation failure then just shows the panel's own error state, same as
// before this was added).
const FAKE_USER_LOCATION_FOR_TESTING: { lat: number; lng: number } | null = {
  lat: CASCO_VIEJO_CENTER[0],
  lng: CASCO_VIEJO_CENTER[1],
};

// Shared by the floating toolbar and the locate-me button — both stay
// hidden while the map itself is still loading (see the tower-motif overlay
// below) and pop in once it's `ready`, each on its own slight delay so they
// read as a small cascade alongside the pins (see the marker effect's own
// staggered entrance) rather than the whole map snapping into view at once.
const MAP_REVEAL_VARIANTS = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
};

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
    {
      d: "M12 12 4.207 4.207A.707.707 0 0 1 4.707 3h14.586a.707.707 0 0 1 .5 1.207z",
    },
    { d: "M12 12v10" },
    { d: "M7 22h10" },
  ],
  cafe: [
    { d: "M10 2v2" },
    { d: "M14 2v2" },
    {
      d: "M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1",
    },
    { d: "M6 2v2" },
  ],
  attraction: [
    { d: "M10 18v-7" },
    {
      d: "M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z",
    },
    { d: "M14 18v-7" },
    { d: "M18 18v-7" },
    { d: "M3 22h18" },
    { d: "M6 18v-7" },
  ],
  museum: [
    { d: "M10 12h4" },
    { d: "M10 8h4" },
    { d: "M14 21v-3a2 2 0 0 0-4 0v3" },
    {
      d: "M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",
    },
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
  hotel: [
    { d: "M2 4v16" },
    { d: "M2 8h18a2 2 0 0 1 2 2v10" },
    { d: "M2 17h20" },
    { d: "M6 8v9" },
  ],
};

/** Renders 24x24 stroke-based Lucide shape data to an inline SVG string, for
 * use inside Leaflet's HTML-string marker/popup APIs. */
function iconSvg(shapes: IconShape[], size = 15): string {
  const body = shapes
    .map((s) => {
      if ("d" in s) return `<path d="${s.d}"/>`;
      if ("cx" in s)
        return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="currentColor"/>`;
      return `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.rx}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

function pinHtml(
  color: string,
  shapes: IconShape[],
  featured: boolean,
  childCount = 0,
): string {
  // `color` (not just `background`) is set here so Night Mode's glow rule
  // (globals.css) can pick it up via `currentColor` — one box-shadow rule
  // then matches whichever category/vibe a pin belongs to, no per-category CSS.
  return `
    <span class="spot-pin" style="background:${color};color:${color}">
      <span class="spot-pin__icon">${iconSvg(shapes)}</span>
      ${featured ? '<span class="spot-pin__star">★</span>' : ""}
      ${childCount > 0 ? `<span class="spot-pin__count">${childCount}</span>` : ""}
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
  childrenBySpotId,
  initialDirectionsSpot = null,
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
  /** Mirrors ExploreFilterBar's Classic↔Vibes mode — when true *and* a vibe
   * chip is actually selected, spot pins recolor to that vibe's color
   * (VIBE_META, the same palette as the vibe chips/VibesModal cards)
   * instead of the shared neutral tone every pin otherwise uses. The glyph
   * itself stays the category icon either way (see CATEGORY_ICON_SHAPES
   * below) — only the tint changes, and only while a vibe is actually
   * active (see NEUTRAL_PIN_COLOR above for every other state: "All",
   * a classic category filter, or vibes mode with nothing picked yet).
   * Which vibe (or gold, for an overlap) each pin uses is driven by
   * `activeVibes` below. */
  useVibeIcons?: boolean;
  /** The vibe chip currently selected in ExploreFilterBar ("All"/none = []
   * — single-select, so realistically 0 or 1 entries, but plural/array-typed
   * to match ExploreFilterContext's shape). Each pin on screen is painted
   * whichever of these it matches (the spots here were already narrowed to
   * ones matching at least one — see MapExplorerSection), except a spot
   * matching more than one, which gets a distinct gold instead of picking
   * one of its matches arbitrarily (see MULTI_VIBE_COLOR above). Empty
   * (nothing selected, "All") falls back to NEUTRAL_PIN_COLOR for every
   * pin, same as classic mode — see `useVibeIcons` above. */
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
  /** Parent spot id → the businesses inside it (see MapExplorerSection's
   * groupSpotsByParent) — a spot present here as a key gets a count badge
   * on its pin, and its popup lists those children directly under the
   * title. `spots` is expected to already be the top-level set (children
   * aren't rendered as their own pins); omitted entirely by callers with no
   * hierarchy to show (ItineraryMap, MiniMap). */
  childrenBySpotId?: Map<string, Spot[]>;
  /** Arms itinerary mode straight away for this spot once the map is ready —
   * fed by the /map page's `?directions=<slug>` deep link (see
   * MapExplorerSection), which is where SpotDetailView's "Get directions"
   * button now sends visitors instead of opening Google Maps directly.
   * Resolved once (see the effect below), so switching back to `null` later
   * doesn't re-trigger it. */
  initialDirectionsSpot?: Spot | null;
}) {
  const tSpot = useTranslations("spot");
  const tCategory = useTranslations("category");
  const tEventCategory = useTranslations("eventCategory");
  const tEvents = useTranslations("events");
  const tEmpty = useTranslations("empty");
  const tHours = useTranslations("hours");
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
  const basemapRef = useRef<CascoBasemap | null>(null);
  // Mirrors `isNight` for the scheme-change listener below, which is
  // attached once (empty-deps effect) and would otherwise close over a
  // stale value if Night Mode is toggled after mount.
  const isNightRef = useRef(isNight);
  useEffect(() => {
    isNightRef.current = isNight;
  }, [isNight]);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const eventLayerRef = useRef<LayerGroup | null>(null);
  // A divIcon marker (not a circleMarker) so the "you are here" dot can carry
  // a pulsing halo via CSS (see upsertMeMarker below) — shared by the
  // one-shot locate-me button and itinerary mode's live position tracking,
  // rather than each keeping its own marker.
  const meMarkerRef = useRef<LeafletMarker | null>(null);
  const routeCasingRef = useRef<LeafletPolyline | null>(null);
  const routeLineRef = useRef<LeafletPolyline | null>(null);
  // Keyed by id so the active-pin-highlight effect (below) can find a
  // marker again after the filtered-set effects rebuild the layer.
  const spotMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const eventMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  // Last-known "is this pin an active vibe match" per spot id, and the
  // content signature (category+childCount) last painted into its marker —
  // both read by the spot-marker effect below to tell an actual state
  // transition (→ replay the bounce/halo, or rebuild the inner markup) apart
  // from an unrelated re-render (e.g. Night Mode toggling) that shouldn't
  // touch either.
  const spotMatchStateRef = useRef<Map<string, boolean>>(new Map());
  const spotSignatureRef = useRef<Map<string, string>>(new Map());
  // Flips true after the marker effect's first run — only that first batch
  // of pins gets the staggered "cascade in" entrance (see the effect below);
  // every pin added afterward (a filter narrowing the set further) still
  // pops in, just all at once, since a stagger only reads as "the map
  // finished loading" the first time, not on every subsequent filter change.
  const initialPinsRevealedRef = useRef(false);
  // Serialized `activeVibes` from the last time the marker effect ran — a
  // change here means the user just picked/switched a vibe chip, so every
  // pin that matches *now* gets the bounce/halo even if it already matched
  // before (e.g. switching straight from one vibe to another it also
  // carries), not just pins newly appearing on the map.
  const prevVibesKeyRef = useRef<string>("");

  // The pin currently shown in the detail panel — spot and event are
  // mutually exclusive, same as the spots/events layers themselves.
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);
  const closePanel = useCallback(() => {
    setSelectedSpot(null);
    setSelectedEvent(null);
  }, []);

  // Itinerary mode: walking directions from the visitor's live position to a
  // spot, drawn straight onto the map instead of handing off to Google Maps
  // (see DirectionsPanel, lib/routing.ts). `directionsTarget` set means the
  // mode is active; `route` lags behind it slightly while the first fix/path
  // is still being worked out (see `directionsStatus`).
  const [directionsTarget, setDirectionsTarget] = useState<Spot | null>(null);
  const [userLatLng, setUserLatLng] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [directionsStatus, setDirectionsStatus] =
    useState<DirectionsStatus>("locating");
  // True once a real geolocation fix places the visitor outside
  // CASCO_VIEJO_BOUNDS — the route is then started from
  // CASCO_VIEJO_ENTRY_POINT instead (see the watchPosition effect below),
  // and DirectionsPanel shows a notice explaining why.
  const [isOutsideArea, setIsOutsideArea] = useState(false);
  // Bumped by the panel's "try again" button to re-run the geolocation
  // effect below after a timeout/denial — a plain dependency change, since
  // the effect itself has no other reason to re-subscribe.
  const [locateRetryTick, setLocateRetryTick] = useState(0);
  // Skips a route recompute for a GPS jitter of only a few meters — walking
  // direction changes are only worth re-routing for once the visitor has
  // actually moved a meaningful distance. Keyed by target id too, so a fresh
  // destination always computes its first route regardless of how far the
  // visitor last moved for a *previous* one.
  const lastRoutedFromRef = useRef<{
    lat: number;
    lng: number;
    targetId: string;
  } | null>(null);
  // The route is only fitted into view once per itinerary — after that the
  // visitor is free to pan/zoom while walking without the map fighting them
  // back into place on every position update.
  const routeFitDoneRef = useRef(false);

  const upsertMeMarker = useCallback(
    async (lat: number, lng: number, live: boolean) => {
      const { default: L } = await import("leaflet");
      if (!mapRef.current) return;
      if (meMarkerRef.current) {
        meMarkerRef.current.setLatLng([lat, lng]);
        meMarkerRef.current
          .getElement()
          ?.querySelector(".me-dot")
          ?.classList.toggle("me-dot--live", live);
      } else {
        const icon = L.divIcon({
          className: "me-dot-marker",
          html: `<span class="me-dot${live ? " me-dot--live" : ""}"></span>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        meMarkerRef.current = L.marker([lat, lng], { icon })
          .bindTooltip(tMap("youAreHere"))
          .addTo(mapRef.current);
      }
    },
    [tMap],
  );

  // Kept free of ref reads/writes (those live in the effects below, keyed
  // off the state this sets) — just state transitions, called straight from
  // a click handler or the deep-link effect further down.
  const startDirections = useCallback(
    (spot: Spot, options: { trackClick?: boolean } = {}) => {
      if (options.trackClick !== false) {
        track("directions_click", {
          entity: "spot",
          entity_id: spot.id,
          entity_slug: spot.slug,
        });
      }
      setSelectedEvent(null);
      setSelectedSpot(spot);
      setDirectionsTarget(spot);
      setRoute(null);
      setIsOutsideArea(false);
      setDirectionsStatus(
        FAKE_USER_LOCATION_FOR_TESTING || "geolocation" in navigator
          ? "locating"
          : "error",
      );
    },
    [],
  );

  const exitDirections = useCallback(() => {
    setDirectionsTarget(null);
    setRoute(null);
    setUserLatLng(null);
    setIsOutsideArea(false);
  }, []);

  const retryLocate = useCallback(() => {
    setDirectionsStatus("geolocation" in navigator ? "locating" : "error");
    setLocateRetryTick((t) => t + 1);
  }, []);

  // Resets the "already fitted"/"last routed from" bookkeeping whenever the
  // destination changes (a fresh `startDirections` call, or leaving
  // directions mode entirely) — a plain effect, not folded into
  // startDirections itself, so that callback stays ref-free.
  useEffect(() => {
    routeFitDoneRef.current = false;
    lastRoutedFromRef.current = null;
  }, [directionsTarget]);

  // Drops the live-position marker once directions mode ends (it's of no use
  // outside it — locateMe's own one-shot marker gets created fresh next time
  // it's tapped anyway).
  useEffect(() => {
    if (directionsTarget) return;
    meMarkerRef.current?.remove();
    meMarkerRef.current = null;
  }, [directionsTarget]);

  // Arms itinerary mode once, straight from the /map?directions=<slug> deep
  // link — see `initialDirectionsSpot`'s doc comment above.
  const initialDirectionsConsumedRef = useRef(false);
  useEffect(() => {
    if (
      !ready ||
      initialDirectionsConsumedRef.current ||
      !initialDirectionsSpot
    )
      return;
    initialDirectionsConsumedRef.current = true;
    startDirections(initialDirectionsSpot, { trackClick: false });
  }, [ready, initialDirectionsSpot, startDirections]);

  // Live-tracks the visitor's position for as long as directions mode is
  // active (a continuous watch, not the one-shot fix locateMe below uses) —
  // the blue dot and the route both need to follow along as they walk.
  // `locateRetryTick` isn't read, only depended on — it's the panel's "try
  // again" button forcing this effect to re-subscribe after a timeout/denial.
  useEffect(() => {
    if (!directionsTarget) return;

    // Real geolocation failing (denied, timed out) or not existing at all —
    // falls back to FAKE_USER_LOCATION_FOR_TESTING when one's set (see its
    // own doc comment above), otherwise surfaces the real error. Real
    // position success (below) always takes priority over this; it's only
    // ever reached when there genuinely isn't one to use instead.
    const useFallbackLocation = () => {
      if (!FAKE_USER_LOCATION_FOR_TESTING) {
        setDirectionsStatus("error");
        return;
      }
      setUserLatLng(FAKE_USER_LOCATION_FOR_TESTING);
      upsertMeMarker(
        FAKE_USER_LOCATION_FOR_TESTING.lat,
        FAKE_USER_LOCATION_FOR_TESTING.lng,
        true,
      );
    };

    if (!("geolocation" in navigator)) {
      // Deferred, not called directly here — see
      // react-hooks/set-state-in-effect; this branch (no Geolocation API at
      // all) is rare, unlike the real watch's own async callbacks below,
      // which already run outside React's render/effect timing as far as
      // that rule is concerned.
      queueMicrotask(useFallbackLocation);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        // Cached for MiniMap et al. regardless of bounds below — their
        // "distance from you" badge should reflect where the visitor
        // actually is, even while this route itself starts from the
        // neighborhood entry point instead.
        setLastKnownUserLocation({ lat: latitude, lng: longitude });
        if (isWithinCascoViejo(latitude, longitude)) {
          setIsOutsideArea(false);
          setUserLatLng({ lat: latitude, lng: longitude });
          upsertMeMarker(latitude, longitude, true);
        } else {
          // Outside the mapped area — don't hand the street-graph
          // pathfinder a real-world point nowhere near its network (see
          // routing.ts's nearestNodeKey, which has no distance cutoff and
          // would otherwise snap it to whatever's closest regardless of how
          // far that actually is). Start from Casco Viejo's main gateway
          // instead and let DirectionsPanel explain why.
          setIsOutsideArea(true);
          setUserLatLng(CASCO_VIEJO_ENTRY_POINT);
          upsertMeMarker(
            CASCO_VIEJO_ENTRY_POINT.lat,
            CASCO_VIEJO_ENTRY_POINT.lng,
            true,
          );
        }
      },
      useFallbackLocation,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [directionsTarget, upsertMeMarker, locateRetryTick]);

  // Recomputes the walking route whenever the visitor's tracked position
  // moves meaningfully, or a new destination is armed — see
  // lastRoutedFromRef's doc comment above for the "meaningfully" part.
  useEffect(() => {
    if (!directionsTarget || !userLatLng) return;
    const last = lastRoutedFromRef.current;
    if (
      last &&
      last.targetId === directionsTarget.id &&
      haversineKm(last.lat, last.lng, userLatLng.lat, userLatLng.lng) < 0.015
    ) {
      return;
    }
    lastRoutedFromRef.current = { ...userLatLng, targetId: directionsTarget.id };

    let cancelled = false;
    // Only the first computation for this destination shows the
    // "calculating" state — once a route is already on screen, a walking
    // update should swap its numbers in place, not flash back to a loading
    // state every ~15m.
    setDirectionsStatus((s) => (s === "ready" ? s : "routing"));
    routeBetween(userLatLng, {
      lat: directionsTarget.latitude,
      lng: directionsTarget.longitude,
    })
      .then((r) => {
        if (cancelled) return;
        setRoute(r);
        setDirectionsStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setDirectionsStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [directionsTarget, userLatLng]);

  // Draws (and re-draws, as the route updates while walking) the route line
  // on the map — a white "casing" underneath a colored line on top, the same
  // technique real map apps use to keep a route legible over any basemap
  // color underneath it. Dashed when `approximate` (see routeBetween) so a
  // straight-line fallback still visibly reads as a guess, not a real path.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    let cancelled = false;

    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      const map = mapRef.current;

      if (!route) {
        routeCasingRef.current?.remove();
        routeCasingRef.current = null;
        routeLineRef.current?.remove();
        routeLineRef.current = null;
        return;
      }

      const latlngs = route.points;
      if (routeCasingRef.current) {
        routeCasingRef.current.setLatLngs(latlngs);
      } else {
        routeCasingRef.current = L.polyline(latlngs, {
          color: "#ffffff",
          weight: 7,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
      }
      const lineStyle = {
        color: NEUTRAL_PIN_COLOR,
        weight: 4.5,
        opacity: 0.95,
        lineCap: "round" as const,
        lineJoin: "round" as const,
        dashArray: route.approximate ? "2, 10" : undefined,
      };
      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs(latlngs);
        routeLineRef.current.setStyle(lineStyle);
      } else {
        routeLineRef.current = L.polyline(latlngs, lineStyle).addTo(map);
      }

      if (!routeFitDoneRef.current) {
        // Same asymmetric padding as revealSelection above — the route's
        // own endpoints shouldn't end up hidden behind DirectionsPanel any
        // more than a selected pin should end up behind MapDetailPanel.
        // maxZoom matches the map's own ceiling (see the `L.map` call
        // below) rather than an arbitrary lower cap — a short walk (start
        // and end a block apart) should zoom in as tight as the map allows
        // while both pins stay in frame, not stop early at a "city-wide"
        // zoom level picked for longer routes.
        const bounds = L.latLngBounds(latlngs);
        if (isDesktopRef.current) {
          map.fitBounds(bounds, {
            paddingTopLeft: [412, 24],
            paddingBottomRight: [24, 24],
            maxZoom: 19,
          });
        } else {
          map.fitBounds(bounds, {
            paddingTopLeft: [24, 24],
            paddingBottomRight: [24, 320],
            maxZoom: 19,
          });
        }
        routeFitDoneRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, route]);

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
      map.panInside([lat, lng], {
        paddingTopLeft: [412, 24],
        paddingBottomRight: [24, 24],
        animate: true,
      });
    } else {
      // Sheet height varies with content; 320px comfortably covers it.
      map.panInside([lat, lng], {
        paddingTopLeft: [24, 24],
        paddingBottomRight: [24, 320],
        animate: true,
      });
    }
  }, []);

  // The detail panel's primary action — called from a real onClick, not a
  // vanilla-DOM listener, so a plain memoized callback is enough (no need
  // for the always-fresh-ref indirection the old Leaflet-HTML popups needed).
  const handleOpenSpot = useCallback(
    (spot: Spot) => {
      if (onOpenSpot) onOpenSpot(spot);
      else
        router.push({ pathname: "/spots/[slug]", params: { slug: spot.slug } });
    },
    [onOpenSpot, router],
  );

  const handleOpenEvent = useCallback(
    (event: EventRow) => {
      if (onOpenEvent) onOpenEvent(event);
      else
        router.push({
          pathname: "/events/[slug]",
          params: { slug: event.slug },
        });
    },
    [onOpenEvent, router],
  );

  // Fullscreen mode covers the whole viewport — lock the page behind it so
  // there's nothing to accidentally scroll past. Locking `<html>` as well as
  // `<body>` matters specifically on iOS Safari: `overflow: hidden` on body
  // alone doesn't reliably stop a touch-drag from rubber-band scrolling the
  // page there, which left the itinerary panel's `fixed bottom-0` position
  // computed against a taller "scrolled" layout viewport than what was
  // actually visible — it was there, just below the fold, only revealed
  // once that stray scroll (or the address bar collapsing in response to
  // it) caught up. Locking both elements is the standard fix.
  useEffect(() => {
    if (!fullScreen) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [fullScreen]);

  // `spots` is already filtered by search/category/vibe (see
  // MapExplorerSection) — this only drops any without coordinates.
  const filteredSpots = useMemo(() => {
    return spots.filter(
      (spot) => spot.latitude != null && spot.longitude != null,
    );
  }, [spots]);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((event) => {
      if (event.latitude == null || event.longitude == null) return false;
      if (q) {
        const haystack = [
          event.title,
          event.description,
          event.organizer,
          ...(event.tags ?? []),
        ]
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

  const showEventSuggestions =
    isEventSearchFocused && eventSuggestions.length > 0;

  const selectEventSuggestion = useCallback(
    (event: EventRow) => {
      setIsEventSearchFocused(false);
      setSelectedSpot(null);
      setSelectedEvent(event);
      revealSelection(event.latitude, event.longitude);
    },
    [revealSelection],
  );

  const handleEventSearchKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (!showEventSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveEventSuggestion((i) =>
        Math.min(i + 1, eventSuggestions.length - 1),
      );
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
      if (!eventSearchWrapperRef.current?.contains(e.target as Node))
        setIsEventSearchFocused(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isEventSearchFocused]);

  const visibleCount =
    mode === "spots" ? filteredSpots.length : filteredEvents.length;

  // Init the map once, client-side only.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        minZoom: 14,
        maxZoom: 19,
        maxBounds: CASCO_VIEJO_BOUNDS,
        maxBoundsViscosity: 0.6,
        zoomControl: false,
        attributionControl: false,
      });
      L.control.zoom({ position: "topright" }).addTo(map);
      L.control
        .attribution({ prefix: false })
        .addAttribution(CASCO_VIEJO_ATTRIBUTION)
        .addTo(map);

      const prefersDark = window.matchMedia?.(
        "(prefers-color-scheme: dark)",
      ).matches;
      const basemap = await addCascoBasemap(
        L,
        map,
        isNightRef.current || prefersDark,
      );
      // The basemap fetch is a second await — the component could have
      // unmounted while it was in flight (the guard above only covers the
      // first one, importing Leaflet).
      if (cancelled) {
        basemap.destroy();
        map.remove();
        return;
      }
      basemapRef.current = basemap;

      // Not added to the map yet — the mode-sync effect below adds whichever
      // one is active, so spots and events never render at the same time.
      markerLayerRef.current = L.layerGroup();
      eventLayerRef.current = L.layerGroup();
      mapRef.current = map;
      setReady(true);
    })();

    // Night Mode always wins: once it's on, OS scheme changes shouldn't pull
    // the basemap back to its light colors.
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSchemeChange = (e: MediaQueryListEvent) => {
      basemapRef.current?.setDark(isNightRef.current || e.matches);
    };
    mq?.addEventListener("change", onSchemeChange);

    const spotMarkers = spotMarkersRef.current;
    const eventMarkers = eventMarkersRef.current;
    const spotMatchState = spotMatchStateRef.current;
    const spotSignatures = spotSignatureRef.current;
    return () => {
      cancelled = true;
      mq?.removeEventListener("change", onSchemeChange);
      mapRef.current?.remove();
      mapRef.current = null;
      basemapRef.current = null;
      markerLayerRef.current = null;
      eventLayerRef.current = null;
      spotMarkers.clear();
      eventMarkers.clear();
      spotMatchState.clear();
      spotSignatures.clear();
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

  // Flip the basemap to its dark colors the instant Night Mode is toggled
  // (not just on the next OS scheme-change event) — re-checks the OS
  // preference too, so turning Night Mode back off doesn't fight a system
  // that's independently in dark mode.
  useEffect(() => {
    if (!ready) return;
    const prefersDark = window.matchMedia?.(
      "(prefers-color-scheme: dark)",
    ).matches;
    basemapRef.current?.setDark(isNight || prefersDark);
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
  //
  // Markers are diffed against spotMarkersRef rather than torn down and
  // rebuilt wholesale (as this used to do) for two reasons: it lets a pin
  // dropping out of the filtered set animate out (`--leaving`, below)
  // instead of vanishing on the spot, and it lets an already-mounted pin's
  // color/match state update in place, on the same DOM node, so a CSS
  // transition actually has a "from" state to animate away from — a fresh
  // node painted directly into its final state has nothing to transition
  // from and would just snap there.
  useEffect(() => {
    if (!ready || !mapRef.current || !markerLayerRef.current) return;
    let cancelled = false;

    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled) return;
      const layer = markerLayerRef.current;
      if (!layer) return;

      const nextIds = new Set(filteredSpots.map((spot) => spot.id));

      // Pins that dropped out of the filtered set (search/category/vibe —
      // see MapExplorerSection) shrink+fade out instead of disappearing
      // outright, then actually detach once that's visibly finished (240ms,
      // matched by the `--leaving` transition duration in globals.css).
      spotMarkersRef.current.forEach((marker, id) => {
        if (nextIds.has(id)) return;
        const el = marker.getElement();
        spotMarkersRef.current.delete(id);
        spotMatchStateRef.current.delete(id);
        spotSignatureRef.current.delete(id);
        if (el) {
          el.classList.add("spot-pin-marker--leaving");
          window.setTimeout(() => layer.removeLayer(marker), 240);
        } else {
          layer.removeLayer(marker);
        }
      });

      // A vibe was just picked or switched (vs. this effect re-running for
      // an unrelated reason, e.g. Night Mode) — every pin matching *now*
      // gets the bounce/halo below, not just ones newly appearing on the
      // map, so switching directly between two vibes a spot both carries
      // still visibly re-announces it.
      const vibesKey = activeVibes.slice().sort().join("|");
      const vibesChanged = vibesKey !== prevVibesKeyRef.current;
      prevVibesKeyRef.current = vibesKey;

      // Only this run's freshly-created pins (see the `else` branch below)
      // get a staggered delay — every later run flips this ref, so a filter
      // change afterward pops its pins in together instead of re-cascading.
      const isInitialReveal = !initialPinsRevealedRef.current;
      initialPinsRevealedRef.current = true;

      // Arriving straight from a spot's "Get directions" button (see
      // initialDirectionsSpot's own doc comment) means itinerary mode is
      // about to take over the instant the map's ready — every other pin
      // is about to fade out and go inert anyway (see the dimming effect
      // below), so the whole cascade-pop-in/fit-to-every-spot flourish
      // would just be motion nobody has time to actually see before it's
      // overridden. Skip it and let the map settle straight on the
      // destination + route instead.
      const skipInitialFlourish = isInitialReveal && initialDirectionsSpot != null;

      const bounds: [number, number][] = [];

      filteredSpots.forEach((spot, index) => {
        // Neutral by default — "All", a classic category filter, or vibes
        // mode with nothing picked yet all render every pin in the same
        // NEUTRAL_PIN_COLOR, so the white glyph (always the spot's category
        // icon, CATEGORY_ICON_SHAPES below) is the only thing telling pins
        // apart. Only once a vibe chip is actually selected does color come
        // back: each matching pin lights up in that vibe's hue, or gold for
        // a spot matching more than one (everything on screen here already
        // matches at least one — see MapExplorerSection's filteredSpots,
        // which drops non-matching pins from the map entirely, same as a
        // classic-mode category filter — so there's no "doesn't match" case
        // left to fall back on).
        const matchingVibes = activeVibes.filter((v) => spot.vibes.includes(v));
        let color: string;
        if (!useVibeIcons || matchingVibes.length === 0) {
          color = NEUTRAL_PIN_COLOR;
        } else if (matchingVibes.length > 1) {
          color = isNight ? MULTI_VIBE_COLOR_NIGHT : MULTI_VIBE_COLOR;
        } else {
          color = VIBE_META[matchingVibes[0]].color;
        }
        const isMatch =
          useVibeIcons && activeVibes.length > 0 && matchingVibes.length > 0;

        const shapes = CATEGORY_ICON_SHAPES[spot.category];
        const childCount = childrenBySpotId?.get(spot.id)?.length ?? 0;
        const signature = `${spot.category}|${childCount}`;

        const existing = spotMarkersRef.current.get(spot.id);
        const wasMatch = spotMatchStateRef.current.get(spot.id) ?? false;
        spotMatchStateRef.current.set(spot.id, isMatch);

        if (existing) {
          const el = existing.getElement();
          const pinEl = el?.querySelector<HTMLElement>(".spot-pin");
          if (pinEl) {
            pinEl.style.background = color;
            pinEl.style.color = color;
          }
          // Category/child-count rarely change on an already-mounted pin,
          // but resync the inner markup when they do — only the inner
          // `.spot-pin` node is replaced, never the wrapper Leaflet actually
          // animates, so the match-pulse class below (which lives on that
          // wrapper) survives untouched.
          if (el && spotSignatureRef.current.get(spot.id) !== signature) {
            el.innerHTML = pinHtml(color, shapes, false, childCount);
          }
          spotSignatureRef.current.set(spot.id, signature);

          if (isMatch && (vibesChanged || !wasMatch)) {
            el?.classList.remove("spot-pin-marker--match-pulse");
            // Force a reflow so re-adding the class replays the animation
            // even if a previous pulse on this same pin is still mid-flight.
            void el?.offsetWidth;
            el?.classList.add("spot-pin-marker--match-pulse");
            window.setTimeout(
              () => el?.classList.remove("spot-pin-marker--match-pulse"),
              650,
            );
          }
        } else {
          spotSignatureRef.current.set(spot.id, signature);
          // Capped — with a lot of pins, a linear per-pin delay would leave
          // the last ones popping in absurdly late; 650ms keeps the whole
          // cascade feeling like one deliberate reveal, not a wait.
          const staggerDelay = isInitialReveal && !skipInitialFlourish ? Math.min(index * 28, 650) : 0;
          const icon = L.divIcon({
            className: cn("spot-pin-marker", !skipInitialFlourish && "spot-pin-marker--entering"),
            // Featured star hidden site-wide for now — swap back to
            // `spot.is_featured` once there is real featured content.
            html: pinHtml(color, shapes, false, childCount),
            iconSize: [34, 34],
            iconAnchor: [17, 34],
            popupAnchor: [0, -32],
          });

          const marker = L.marker([spot.latitude, spot.longitude], { icon });
          marker.on("click", () => {
            track("map_spot_click", { spot_id: spot.id, spot_slug: spot.slug });
            setSelectedEvent(null);
            setSelectedSpot(spot);
            revealSelection(spot.latitude, spot.longitude);
          });
          // Bound once at creation — fires whenever the marker's element
          // actually mounts (immediately if its layer is already on the
          // map, or later once the spots/events mode toggle attaches it).
          // Deliberately does *not* also add `--match-pulse` here even when
          // `isMatch` is true (unlike the `existing` branch above) — both
          // classes set `.spot-pin`'s `animation` property, so a brand-new
          // pin carrying both at once played the entrance pop, then replayed
          // a second bounce from scratch the moment `--entering` was removed
          // and `--match-pulse` became the only rule left applying (a fresh
          // `animation-name` restarts the animation). The entrance pop's own
          // overshoot already reads as "here it is" — vibes mode doesn't
          // need a second bounce layered on for a pin that's brand new here.
          marker.on("add", () => {
            const el = marker.getElement();
            if (staggerDelay > 0) {
              // Set on `.spot-pin` itself, not the outer wrapper — Leaflet's
              // wrapper is only what the `--entering` *class* lives on, the
              // pop animation runs on the inner span (see globals.css), and
              // `animation-delay` isn't inherited by a descendant the way a
              // property like `color` would be.
              const pinEl = el?.querySelector<HTMLElement>(".spot-pin");
              if (pinEl) pinEl.style.animationDelay = `${staggerDelay}ms`;
            }
            window.setTimeout(
              () => el?.classList.remove("spot-pin-marker--entering"),
              400 + staggerDelay,
            );
          });

          marker.addTo(layer);
          spotMarkersRef.current.set(spot.id, marker);
        }

        bounds.push([spot.latitude, spot.longitude]);
      });

      // Only steer the viewport if spots are the layer actually on screen —
      // otherwise switching filters in events mode would yank the map back.
      // Also skipped on the direct-to-directions arrival (see
      // skipInitialFlourish above) — the route-fit effect frames the
      // destination + visitor far better than "every spot in Casco Viejo"
      // would, and doing both back to back just reads as the view lurching
      // twice in a row.
      if (bounds.length > 0 && mode === "spots" && !skipInitialFlourish) {
        mapRef.current?.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    filteredSpots,
    mode,
    revealSelection,
    useVibeIcons,
    activeVibes,
    isNight,
    childrenBySpotId,
    initialDirectionsSpot,
  ]);

  // Render event pins on their own layer, using the /public/icons badges.
  // Diffed against eventMarkersRef (not cleared/rebuilt wholesale) for the
  // same reason as the spot-marker effect above: it lets a pin dropping out
  // of the filtered set animate out instead of vanishing on the spot.
  // Event pins have no color/match state to preserve across renders, so
  // unlike spots, an already-mounted marker is simply left untouched.
  useEffect(() => {
    if (!ready || !mapRef.current || !eventLayerRef.current) return;
    let cancelled = false;

    (async () => {
      const { default: L } = await import("leaflet");
      if (cancelled) return;
      const layer = eventLayerRef.current;
      if (!layer) return;

      const nextIds = new Set(filteredEvents.map((event) => event.id));

      eventMarkersRef.current.forEach((marker, id) => {
        if (nextIds.has(id)) return;
        const el = marker.getElement();
        eventMarkersRef.current.delete(id);
        if (el) {
          el.classList.add("event-pin-marker--leaving");
          window.setTimeout(() => layer.removeLayer(marker), 240);
        } else {
          layer.removeLayer(marker);
        }
      });

      const bounds: [number, number][] = [];

      filteredEvents.forEach((event) => {
        bounds.push([event.latitude, event.longitude]);
        if (eventMarkersRef.current.has(event.id)) return;

        const meta = EVENT_CATEGORY_META[event.category];
        const icon = L.divIcon({
          className: "event-pin-marker event-pin-marker--entering",
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
        marker.on("add", () => {
          const el = marker.getElement();
          window.setTimeout(
            () => el?.classList.remove("event-pin-marker--entering"),
            400,
          );
        });

        marker.addTo(layer);
        eventMarkersRef.current.set(event.id, marker);
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
  // markers rather than ones about to be torn down. Also where itinerary
  // mode dims every *other* pin: with a route on screen, every other spot
  // is a distraction, not a destination, so they fade out and stop
  // responding to clicks (`--dimmed`, see globals.css) until directions
  // mode ends — only the one actually being routed to stays fully
  // interactive.
  useEffect(() => {
    spotMarkersRef.current.forEach((marker, id) => {
      const active = selectedSpot?.id === id;
      const dimmed = directionsTarget != null && id !== directionsTarget.id;
      const el = marker.getElement();
      el?.classList.toggle("spot-pin-marker--active", active);
      el?.classList.toggle("spot-pin-marker--dimmed", dimmed);
      el?.querySelector(".spot-pin")?.classList.toggle(
        "spot-pin--active",
        active,
      );
    });
    eventMarkersRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      el?.classList.toggle(
        "event-pin-marker--active",
        selectedEvent?.id === id,
      );
      // Events have no directions of their own (yet) — any event pin on
      // screen during itinerary mode is equally beside the point.
      el?.classList.toggle(
        "event-pin-marker--dimmed",
        directionsTarget != null,
      );
    });
  }, [
    selectedSpot,
    selectedEvent,
    filteredSpots,
    filteredEvents,
    directionsTarget,
  ]);

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
  const [panelTopOffset, setPanelTopOffset] = useState<number | undefined>(
    undefined,
  );
  useEffect(() => {
    if (!fullScreen) return;
    const bar = document.querySelector<HTMLElement>(
      "[data-explore-filter-bar]",
    );
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

  // Same idea as panelTopOffset above, mirrored to the bottom: /map's
  // ExploreFilterBar also floats its mode toggle + chip row as their own
  // shelf at the bottom of the screen (in `fixed` mode), so the locate-me
  // button below needs to float above that shelf instead of sitting
  // underneath it.
  const [bottomBarOffset, setBottomBarOffset] = useState<number | undefined>(
    undefined,
  );
  useEffect(() => {
    if (!fullScreen) return;
    const bar = document.querySelector<HTMLElement>(
      "[data-explore-filter-bottom-bar]",
    );
    const mapBox = containerRef.current;
    if (!bar || !mapBox) return;
    const update = () => {
      const barTop = bar.getBoundingClientRect().top;
      const mapBottom = mapBox.getBoundingClientRect().bottom;
      setBottomBarOffset(Math.max(16, mapBottom - barTop + 8));
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
        const { latitude, longitude } = pos.coords;
        if (!mapRef.current) return;
        await upsertMeMarker(latitude, longitude, false);
        mapRef.current.flyTo([latitude, longitude], 16, { duration: 0.8 });
        setLocating(false);
      },
      () => {
        toast.error(tMap("locateError"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [tMap, upsertMeMarker]);

  // Normalizes whichever pin is selected (spot xor event) into the shape
  // MapDetailPanel renders — keeps that component ignorant of both domain
  // types, and keeps this file the only place that has to know their fields.
  const panelContent: DetailPanelContent | null = useMemo(() => {
    if (selectedSpot) {
      const meta = CATEGORY_META[selectedSpot.category];
      const Icon = meta.icon;
      // "Open now?" answered right in the pin popup, same as the badge on
      // the card/detail page — without it this was the one "can I decide
      // from the map" question the popup couldn't answer on its own.
      const hoursStatus = getHoursStatus(selectedSpot);
      const hoursLabel =
        hoursStatus.state === "open"
          ? tHours("openTill", {
              time: formatTime(hoursStatus.closesAt, locale),
            })
          : hoursStatus.state === "closing-soon"
            ? tHours("closingSoon", {
                time: formatTime(hoursStatus.closesAt, locale),
              })
            : hoursStatus.state === "opens-later"
              ? tHours("opensAt", {
                  time: formatTime(hoursStatus.opensAt, locale),
                })
              : tHours("closed");
      const metaItems: string[] = [hoursLabel];
      if (selectedSpot.price_range) metaItems.push(selectedSpot.price_range);

      // This spot's own businesses, if it's a hub — see childrenBySpotId's
      // doc comment above. Rendered as a list right under the title.
      const childSpots = childrenBySpotId?.get(selectedSpot.id) ?? [];

      return {
        photoUrl: getSpotImage(selectedSpot),
        photoFallback: <Icon size={30} />,
        // Featured badge hidden site-wide for now — swap back to
        // `selectedSpot.is_featured ? useTranslations("night")("featuredBadge") : undefined`
        // once there is real featured content.
        featuredLabel: undefined,
        categoryLabel: tCategory(selectedSpot.category),
        categoryIcon: <Icon size={13} />,
        title: selectedSpot.name,
        subtitle: selectedSpot.address,
        metaItems,
        description: selectedSpot.description,
        children: childSpots.map((child) => {
          const childMeta = CATEGORY_META[child.category];
          const ChildIcon = childMeta.icon;
          return {
            id: child.id,
            name: child.name,
            categoryLabel: tCategory(child.category),
            categoryIcon: <ChildIcon size={13} />,
            onClick: () => handleOpenSpot(child),
          };
        }),
        actions: [
          {
            label: tSpot("readMore"),
            primary: true,
            onClick: () => handleOpenSpot(selectedSpot),
          },
          {
            label: tSpot("getDirections"),
            onClick: () => startDirections(selectedSpot),
          },
        ],
      };
    }

    if (selectedEvent) {
      const meta = EVENT_CATEGORY_META[selectedEvent.category];
      const dateLabel = new Intl.DateTimeFormat(
        locale === "es" ? "es-PA" : "en-US",
        {
          weekday: "short",
          month: "short",
          day: "numeric",
        },
      ).format(new Date(`${selectedEvent.date}T00:00:00`));
      const priceLabel =
        selectedEvent.price && selectedEvent.price > 0
          ? `$${selectedEvent.price}`
          : tEvents("free");

      const actions: DetailPanelContent["actions"] = [
        {
          label: tEvents("viewDetails"),
          primary: true,
          onClick: () => handleOpenEvent(selectedEvent),
        },
      ];
      if (selectedEvent.booking_url) {
        const bookingUrl = selectedEvent.booking_url;
        actions.push({
          label: tEvents("book"),
          onClick: () =>
            window.open(bookingUrl, "_blank", "noopener,noreferrer"),
        });
      }

      return {
        photoUrl: selectedEvent.photo,
        photoFallback: <CalendarDays size={30} />,
        categoryLabel: tEventCategory(selectedEvent.category),
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
    tHours,
    handleOpenSpot,
    handleOpenEvent,
    childrenBySpotId,
    startDirections,
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

  // Same "one selected vibe or neutral" rule as the pins themselves (see the
  // marker-color effect above), exposed as a CSS custom property so anything
  // downstream in the tree that wants to track it — right now just
  // MapDetailPanel's `.accent-cta` primary button — can read `var(--accent-color)`
  // without this component threading a color prop through it explicitly.
  // Undefined (not the neutral pin color) when there's nothing to override,
  // so it falls through to globals.css's brand-teal default instead of
  // fighting that fallback with an inline value.
  const accentColor =
    useVibeIcons && activeVibes.length === 1
      ? VIBE_META[activeVibes[0]].color
      : undefined;

  // Only rendered while directionsTarget is set (see the DirectionsPanel
  // render below) — the MapPin fallback only exists so this stays a valid
  // component reference (never null) for TypeScript's sake when it isn't.
  const DirectionsCategoryIcon = directionsTarget
    ? CATEGORY_META[directionsTarget.category].icon
    : MapPin;

  return (
    <div
      className={cn(
        fullScreen ? "fixed inset-x-0 bottom-0 z-10" : "space-y-4",
        className,
      )}
      style={{
        ...(fullScreen ? { top: headerHeight ?? 56 } : undefined),
        ...(accentColor
          ? ({ "--accent-color": accentColor } as CSSProperties)
          : undefined),
      }}
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
          fullScreen
            ? "h-full border-t bg-background"
            : cn("rounded-[var(--radius-card)] border", heightClassName),
        )}
      >
        <div ref={containerRef} className="h-full w-full" />

        <AnimatePresence>
          {!ready && (
            <motion.div
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 z-[1200] flex items-center justify-center bg-gradient-to-br from-aqua/10 to-coral/10"
            >
              {/* Same "breathing tower" motif as every photo slot on the site
                  (LoadingImage.tsx, globals.css's .tower-halo/.tower-breathe)
                  scaled up for the whole map instead of a single photo — one
                  loading identity everywhere rather than a generic spinner
                  here. Once this clears, the toolbar/locate button and the
                  pins themselves (see the marker effect above) cascade in
                  over the map instead of the whole thing just snapping into
                  view at once. */}
              <div className="relative h-16 w-16">
                <span
                  aria-hidden="true"
                  className="tower-halo absolute -inset-[28%] rounded-full"
                />
                <div className="relative h-full w-full overflow-hidden rounded-2xl shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a
                      tiny local asset, not worth routing through next/image's
                      optimizer while that optimizer is exactly what the rest
                      of the page may still be waiting on. */}
                  <img
                    src="/logo-tower.svg"
                    alt=""
                    className="tower-breathe block h-full w-full"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating toolbar — top-left, clear of the header (which drops its
            own spots/events nav while the map's open) and the zoom control
            (top-right). Labelled, not icon-only — a bare icon pair read as
            ambiguous, the text is what actually says which layer is showing.
            z-[1200]: Leaflet's own panes/controls climb as high as z-index
            1000 internally, so anything at or below that can end up
            rendering behind the map instead of on top of it.
            Hidden/offset until `ready` (see MAP_REVEAL_VARIANTS below) — it
            swoops in over the map alongside the locate-me button and the
            pins themselves once the tower loader above clears, instead of
            just being visible underneath it the whole time. */}
        <motion.div
          variants={MAP_REVEAL_VARIANTS}
          animate={ready ? "visible" : "hidden"}
          transition={{
            type: "spring",
            stiffness: 340,
            damping: 26,
            delay: 0.08,
          }}
          className={cn(
            "safe-top absolute left-4 right-16 top-4 z-[1200] flex flex-col items-start gap-2 sm:right-auto sm:w-72",
            // The desktop side panel occupies this same top-left corner —
            // step aside for it there. Mobile's sheet comes from the bottom
            // instead, so this stays put and reachable behind it.
            hasSelection && "md:hidden",
            // Itinerary mode's own panel takes this same corner on both
            // breakpoints (its mobile half is a bottom bar, not a sheet, so
            // this toolbar isn't naturally out of its way there like it is
            // for a plain pin selection above).
            directionsTarget && "hidden",
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
                      active
                        ? "text-white"
                        : "text-foreground/60 hover:text-foreground",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="map-mode-pill"
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 34,
                        }}
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
                            i === activeEventSuggestion
                              ? "bg-foreground/5"
                              : "hover:bg-foreground/5",
                          )}
                        >
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                            style={{ background: `${meta.color}26` }}
                          >
                            <Image
                              src={meta.icon}
                              alt=""
                              width={14}
                              height={14}
                            />
                          </span>
                          <span className="min-w-0 flex-1 truncate font-semibold">
                            {event.title}
                          </span>
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
        </motion.div>

        <motion.button
          type="button"
          onClick={locateMe}
          disabled={!ready || locating}
          aria-label={tMap("locateMe")}
          title={tMap("locateMe")}
          variants={MAP_REVEAL_VARIANTS}
          animate={ready ? "visible" : "hidden"}
          transition={{
            type: "spring",
            stiffness: 340,
            damping: 24,
            delay: 0.22,
          }}
          style={{ bottom: bottomBarOffset ?? 16 }}
          className={cn(
            "absolute left-4 z-[1200] flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-lg disabled:opacity-50",
            // Sits under the desktop panel's footprint — hidden there, still
            // reachable on mobile since the sheet comes from the bottom.
            hasSelection && "md:hidden",
            // Itinerary mode already shows the visitor's live position (see
            // upsertMeMarker) and its own panel covers this corner on
            // mobile too — redundant on both breakpoints while it's active.
            directionsTarget && "hidden",
          )}
        >
          {locating ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <LocateFixed size={18} />
          )}
        </motion.button>

        <MapDetailPanel
          content={directionsTarget ? null : panelContent}
          closeLabel={tSpot("close")}
          onClose={closePanel}
          desktopTopOffsetPx={panelTopOffset}
        />

        <AnimatePresence>
          {directionsTarget && (
            <DirectionsPanel
              key="directions-panel"
              destinationName={directionsTarget.name}
              categoryIcon={<DirectionsCategoryIcon size={15} />}
              destination={{
                lat: directionsTarget.latitude,
                lng: directionsTarget.longitude,
              }}
              status={directionsStatus}
              distanceKm={route?.distanceKm ?? null}
              approximate={route?.approximate ?? false}
              steps={route?.steps ?? []}
              outsideArea={isOutsideArea}
              onClose={exitDirections}
              onRetry={retryLocate}
              topOffsetPx={panelTopOffset}
            />
          )}
        </AnimatePresence>

        {ready && visibleCount === 0 && (
          <div className="pointer-events-none absolute inset-0 z-[1200] flex items-center justify-center p-4">
            <div className="pointer-events-auto rounded-[var(--radius-card)] border border-dashed border-border bg-surface/95 px-6 py-4 text-center backdrop-blur">
              <SearchX size={26} className="mx-auto text-foreground/25" />
              <p className="mt-1 font-heading text-sm font-bold">
                {tEmpty("title")}
              </p>
              <p className="text-xs text-foreground/60">{tEmpty("subtitle")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
