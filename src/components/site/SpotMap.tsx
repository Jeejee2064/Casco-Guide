"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
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
import { SvgMap, type HtmlPin, type SvgMapHandle } from "./SvgMap";
import { useRouter } from "@/i18n/navigation";
import { CATEGORY_META } from "@/lib/categories";
import { EVENT_CATEGORY_META } from "@/lib/eventCategories";
import { VIBE_META } from "@/lib/vibes";
import { getSpotImage } from "@/lib/data/categoryImages";
import { formatTime, getHoursStatus } from "@/lib/hours";
import { haversineKm } from "@/lib/geo";
import { routeBetween, type Route } from "@/lib/routing";
import {
  CASCO_VIEJO_CENTER,
  CASCO_VIEJO_ENTRY_POINT,
  isWithinCascoViejo,
} from "@/lib/cascoMap";
import { latLngsToPath, project, zoomToScale } from "@/lib/svgMap/projection";
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

// Fixed framing used on arrival: the whole Casco Viejo peninsula around its
// center, independent of which pins are shown (so an outlier like the
// Mercado de Mariscos can't pull the view).
const CASCO_ARRIVAL_BOUNDS: [[number, number], [number, number]] = [
  [8.9495, -79.5405],
  [8.9565, -79.5295],
];

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

/** Shape data for a Lucide glyph, drawn by ShapeIcon below. */
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

/** Renders 24x24 stroke-based Lucide shape data as an inline SVG, so map
 * pins use the same glyphs as the rest of the UI instead of an emoji. */
function ShapeIcon({ shapes, size = 15 }: { shapes: IconShape[]; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes.map((sh, i) => {
        if ("d" in sh) return <path key={i} d={sh.d} />;
        if ("cx" in sh)
          return <circle key={i} cx={sh.cx} cy={sh.cy} r={sh.r} fill="currentColor" />;
        return (
          <rect key={i} x={sh.x} y={sh.y} width={sh.width} height={sh.height} rx={sh.rx} />
        );
      })}
    </svg>
  );
}

/** One spot's pin. Mounted once per spot and updated in place (never
 * rebuilt), so a recolor has a "from" state for the CSS transition to
 * animate away from. Entrance pop and the vibe-match pulse are CSS
 * animations driven from here. */
function SpotPinView({
  color,
  shapes,
  childCount,
  active,
  entering,
  delayMs,
  pulseKey,
}: {
  color: string;
  shapes: IconShape[];
  childCount: number;
  active: boolean;
  /** Plays the pop-in on mount. */
  entering: boolean;
  /** Stagger for the initial load's cascade. */
  delayMs: number;
  /** Non-empty while this pin is an active vibe match — a change replays the
   * bounce/halo (but never on the pin's own creation). */
  pulseKey: string;
}) {
  const pulseRef = useRef<HTMLSpanElement | null>(null);
  const [isEntering, setIsEntering] = useState(entering);
  useEffect(() => {
    if (!entering) return;
    // Dropped once the pop has played: `--entering` and `--match-pulse` both
    // set `animation`, so leaving it on would replay the pop when a pulse
    // later ends.
    const t = window.setTimeout(() => setIsEntering(false), 400 + delayMs);
    return () => window.clearTimeout(t);
    // Only ever relevant at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const el = pulseRef.current;
    if (!pulseKey || !el) return;
    el.classList.remove("spot-pin-marker--match-pulse");
    // Force a reflow so re-adding the class replays the animation even if a
    // previous pulse on this same pin is still mid-flight.
    void el.offsetWidth;
    el.classList.add("spot-pin-marker--match-pulse");
    const t = window.setTimeout(
      () => el.classList.remove("spot-pin-marker--match-pulse"),
      650,
    );
    return () => window.clearTimeout(t);
  }, [pulseKey]);

  return (
    <span
      className={cn("block h-full w-full", isEntering && "spot-pin-marker--entering")}
    >
      <span ref={pulseRef} className="block h-full w-full">
        <span
          className={cn("spot-pin", active && "spot-pin--active")}
          style={{
            background: color,
            color,
            animationDelay: isEntering && delayMs > 0 ? `${delayMs}ms` : undefined,
          }}
        >
          <span className="spot-pin__icon">
            <ShapeIcon shapes={shapes} />
          </span>
          {childCount > 0 && <span className="spot-pin__count">{childCount}</span>}
        </span>
      </span>
    </span>
  );
}

/** The /public/icons badges are already fully-drawn pins (balloon shape,
 * pointer tail, drop shadow baked into the artwork) — render them as-is
 * instead of nesting them inside another pin shape. */
function EventPinView({ iconSrc }: { iconSrc: string }) {
  return (
    <span className="event-pin-marker--entering block h-full w-full">
      <span className="event-pin">
        {/* eslint-disable-next-line @next/next/no-img-element -- already a
            tiny local badge asset, same as the old HTML-string pin. */}
        <img className="event-pin__icon" src={iconSrc} alt="" width={36} height={36} />
      </span>
    </span>
  );
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
  interactive = true,
  onDirectionsChange,
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
  /** false locks the map in place — no drag/pinch/scroll-wheel pan or zoom,
   * so a touch swipe starting over the map scrolls the page instead of
   * panning it. Pins stay fully clickable/tappable either way (marker
   * clicks are a separate DOM event, not gated by these handlers). Used by
   * the article "Places mentioned" map so it doesn't trap mobile scroll. */
  interactive?: boolean;
  /** Fires when itinerary mode starts (true) or ends (false) — lets a parent
   * hide its own floating UI (the explore filters) that would otherwise sit
   * on top of the directions panel. Only called on real transitions, never
   * on mount, so a parent can seed its own initial state from
   * `initialDirectionsSpot` without a flash. */
  onDirectionsChange?: (active: boolean) => void;
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
  const mapRef = useRef<SvgMapHandle | null>(null);

  // Night Mode, or the OS scheme when Night Mode is off.
  const [prefersDark, setPrefersDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setPrefersDark(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Flips true a moment after the first pins appear — only that first batch
  // gets the staggered "cascade in" entrance; every pin added afterward (a
  // filter narrowing the set further) still pops in, just all at once, since
  // a stagger only reads as "the map finished loading" the first time.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setRevealed(true), 1200);
    return () => window.clearTimeout(t);
  }, [ready]);
  const eventsFittedRef = useRef(false);

  // The "you are here" dot, shared by the one-shot locate-me button and
  // itinerary mode's live position tracking.
  const [meDot, setMeDot] = useState<{
    lat: number;
    lng: number;
    live: boolean;
  } | null>(null);

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

  // Reports itinerary mode starting/ending to the parent — transitions only,
  // so mounting (not in directions) tells it nothing.
  const directionsReportedRef = useRef(false);
  useEffect(() => {
    const active = directionsTarget != null;
    if (active === directionsReportedRef.current) return;
    directionsReportedRef.current = active;
    onDirectionsChange?.(active);
  }, [directionsTarget, onDirectionsChange]);

  const upsertMeMarker = useCallback(
    (lat: number, lng: number, live: boolean) => setMeDot({ lat, lng, live }),
    [],
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
    // The live-position dot is of no use outside directions mode.
    setMeDot(null);
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

  // The route line, redrawn as the route updates while walking — a white
  // "casing" underneath a colored line on top, the same technique real map
  // apps use to keep a route legible over any basemap color underneath it.
  // Dashed when `approximate` (see routeBetween) so a straight-line fallback
  // still visibly reads as a guess, not a real path.
  const routeD = useMemo(
    () => (route ? latLngsToPath(route.points) : null),
    [route],
  );

  // The route is only fitted into view once per itinerary (see
  // routeFitDoneRef). Same asymmetric padding as revealSelection below — the
  // route's own endpoints shouldn't end up hidden behind DirectionsPanel any
  // more than a selected pin should end up behind MapDetailPanel. No scale
  // cap beyond the map's own ceiling: a short walk (start and end a block
  // apart) should zoom in as tight as the map allows while both pins stay in
  // frame.
  useEffect(() => {
    if (!route || routeFitDoneRef.current) return;
    const pts = route.points.map(([lat, lng]) => project(lat, lng));
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    mapRef.current?.fitBounds(
      [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      {
        padding: isDesktopRef.current
          ? { top: 24, left: 412, right: 24, bottom: 24 }
          : { top: 88, left: 24, right: 24, bottom: Math.round(window.innerHeight * 0.55) + 24 },
        animate: true,
      },
    );
    routeFitDoneRef.current = true;
  }, [route]);

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
    mapRef.current?.panInside(
      project(lat, lng),
      isDesktopRef.current
        ? // Panel is 380px wide, offset 16px from the left edge.
          { top: 24, left: 412, right: 24, bottom: 24 }
        : // The sheet is at most 55vh (see MapDetailPanel); the top clears the
          // search bar and leaves room for the pin's body above its tip.
          { top: 88, left: 24, right: 24, bottom: Math.round(window.innerHeight * 0.55) + 24 },
    );
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

  // Clicking empty map (not a pin) dismisses the open panel/sheet, same as
  // clicking its own backdrop/close button. In itinerary mode the visible
  // card is DirectionsPanel, not the detail panel — so an empty-map click
  // leaves itinerary mode too (back to the default map, nothing selected),
  // without touching the camera/zoom.
  const handleMapClick = () => {
    if (directionsTarget) exitDirections();
    closePanel();
  };

  // Fixed framing on arrival (the whole peninsula, independent of which pins
  // are shown) — skipped on the direct-to-directions arrival, where the
  // route-fit effect frames the destination instead. Later filter/vibe
  // changes never move the view.
  const fitArrival = useCallback(() => {
    const [x0, y1] = project(CASCO_ARRIVAL_BOUNDS[0][0], CASCO_ARRIVAL_BOUNDS[0][1]);
    const [x1, y0] = project(CASCO_ARRIVAL_BOUNDS[1][0], CASCO_ARRIVAL_BOUNDS[1][1]);
    mapRef.current?.fitBounds([x0, y0, x1, y1], { padding: 24 });
  }, []);
  useEffect(() => {
    if (initialDirectionsSpot != null) return;
    fitArrival();
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Events get the same framing the first time that layer is shown.
  useEffect(() => {
    if (mode !== "events" || eventsFittedRef.current) return;
    eventsFittedRef.current = true;
    fitArrival();
  }, [mode, fitArrival]);

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

  // Pins are plain React now — built from state, so selection, dimming and
  // vibe color are just props rather than classes toggled onto markers.
  const vibesKey = activeVibes.slice().sort().join("|");
  const spotPins: HtmlPin[] = useMemo(() => {
    if (!ready) return [];
    // Arriving straight from a spot's "Get directions" button (see
    // initialDirectionsSpot) means itinerary mode is about to take over the
    // instant the map's ready — the cascade-in flourish would just be motion
    // nobody has time to see before it's overridden.
    const skipFlourish = initialDirectionsSpot != null;
    return filteredSpots.map((spot, index) => {
      // Neutral by default — "All", a classic category filter, or vibes mode
      // with nothing picked yet all render every pin in the same
      // NEUTRAL_PIN_COLOR, so the white glyph (always the spot's category
      // icon) is the only thing telling pins apart. Only once a vibe chip is
      // actually selected does color come back: each matching pin lights up
      // in that vibe's hue, or gold for a spot matching more than one.
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
      const active = selectedSpot?.id === spot.id;
      const dimmed = directionsTarget != null && spot.id !== directionsTarget.id;
      // With a place open in the panel, every other pin steps back so the
      // selected one is what the eye lands on.
      const faded = selectedSpot != null && !active && !dimmed;
      return {
        id: spot.id,
        x: project(spot.latitude, spot.longitude)[0],
        y: project(spot.latitude, spot.longitude)[1],
        width: 34,
        height: 34,
        anchor: [17, 34],
        label: spot.name,
        className: cn(
          "spot-pin-marker",
          active && "spot-pin-marker--active",
          dimmed && "spot-pin-marker--dimmed",
          faded && "spot-pin-marker--faded",
        ),
        node: (
          <SpotPinView
            color={color}
            shapes={CATEGORY_ICON_SHAPES[spot.category]}
            childCount={childrenBySpotId?.get(spot.id)?.length ?? 0}
            active={active}
            entering={!skipFlourish}
            // Capped — with a lot of pins, a linear per-pin delay would leave
            // the last ones popping in absurdly late.
            delayMs={revealed || skipFlourish ? 0 : Math.min(index * 28, 650)}
            pulseKey={isMatch ? vibesKey : ""}
          />
        ),
        onSelect: () => {
          track("map_spot_click", { spot_id: spot.id, spot_slug: spot.slug });
          // Itinerary mode active and this is a *different* spot than the
          // one being routed to — re-arm directions for it instead of the
          // normal select-and-open-panel behavior, so tapping another pin
          // switches the walking route rather than doing nothing.
          if (directionsTarget && directionsTarget.id !== spot.id) {
            startDirections(spot);
            return;
          }
          setSelectedEvent(null);
          setSelectedSpot(spot);
          revealSelection(spot.latitude, spot.longitude);
        },
      };
    });
  }, [
    ready,
    revealed,
    filteredSpots,
    activeVibes,
    vibesKey,
    useVibeIcons,
    isNight,
    childrenBySpotId,
    initialDirectionsSpot,
    selectedSpot,
    directionsTarget,
    revealSelection,
    startDirections,
  ]);

  const eventPins: HtmlPin[] = useMemo(() => {
    if (!ready) return [];
    return filteredEvents.map((event) => {
      const active = selectedEvent?.id === event.id;
      const [x, y] = project(event.latitude, event.longitude);
      return {
        id: event.id,
        x,
        y,
        width: 36,
        height: 36,
        anchor: [18, 36],
        label: event.title,
        // Events have no directions of their own (yet) — any event pin on
        // screen during itinerary mode is equally beside the point.
        className: cn(
          "event-pin-marker",
          active && "event-pin-marker--active",
          selectedEvent != null && !active && "event-pin-marker--faded",
          directionsTarget != null && "event-pin-marker--dimmed",
        ),
        node: <EventPinView iconSrc={EVENT_CATEGORY_META[event.category].icon} />,
        onSelect: () => {
          setSelectedSpot(null);
          setSelectedEvent(event);
          revealSelection(event.latitude, event.longitude);
        },
      };
    });
  }, [ready, filteredEvents, selectedEvent, directionsTarget, revealSelection]);

  const mePin: HtmlPin | null = meDot
    ? {
        id: "me",
        x: project(meDot.lat, meDot.lng)[0],
        y: project(meDot.lat, meDot.lng)[1],
        width: 22,
        height: 22,
        anchor: [11, 11],
        className: "me-dot-marker",
        label: tMap("youAreHere"),
        node: <span className={cn("me-dot", meDot.live && "me-dot--live")} />,
      }
    : null;

  const layerPins = mode === "spots" ? spotPins : eventPins;
  const htmlPins = mePin ? [...layerPins, mePin] : layerPins;

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
      (pos) => {
        const { latitude, longitude } = pos.coords;
        upsertMeMarker(latitude, longitude, false);
        mapRef.current?.flyTo(project(latitude, longitude), {
          scale: zoomToScale(16),
        });
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
        <div ref={containerRef} className="h-full w-full">
          <SvgMap
            ref={mapRef}
            dark={isNight || prefersDark}
            interactive={interactive}
            htmlPins={htmlPins}
            onReady={() => setReady(true)}
            onBackgroundClick={handleMapClick}
            className="h-full w-full"
          >
            {routeD && route && (
              <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path
                  className="svgmap-line"
                  d={routeD}
                  stroke="#ffffff"
                  strokeOpacity={0.9}
                  strokeWidth={7}
                />
                <path
                  className="svgmap-line"
                  d={routeD}
                  stroke={NEUTRAL_PIN_COLOR}
                  strokeOpacity={0.95}
                  strokeWidth={4.5}
                  strokeDasharray={route.approximate ? "2 10" : undefined}
                />
              </g>
            )}
          </SvgMap>
        </div>

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
