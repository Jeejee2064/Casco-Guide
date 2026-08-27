"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  CornerUpLeft,
  CornerUpRight,
  ExternalLink,
  Flag,
  Footprints,
  Loader2,
  Navigation,
  X,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { EASE_OUT, TAP_SPRING } from "./motion";
import { formatDistance, walkingMinutes } from "@/lib/geo";
import type { RouteStep, RouteStepKind } from "@/lib/routing";

export type DirectionsStatus = "locating" | "routing" | "ready" | "error";

// One glyph per RouteStepKind, reused for both the step list below and (via
// STEP_ICONS[step.kind]) nothing else yet — kept as a lookup rather than a
// switch so adding a kind later is a one-line addition in both this map and
// stepInstruction below, not two separate branches to keep in sync.
const STEP_ICONS: Record<
  RouteStepKind,
  ComponentType<{ size?: number; className?: string }>
> = {
  depart: Navigation,
  "turn-left": CornerUpLeft,
  "turn-right": CornerUpRight,
  continue: ArrowUp,
  cross: Footprints,
  stairs: ArrowUpDown,
};

/** Turns one routing step into a localized sentence — `lib/routing.ts`
 * deliberately only hands back structured `{ kind, streetName }` data, not
 * copy, so this (and its translation keys, under the `map.steps` namespace)
 * is the one place that turns "turn-left, Calle X" into "Turn left onto
 * Calle X" / "Gira a la izquierda en Calle X". Falls back to a street-free
 * generic phrasing when `streetName` is null (an unnamed alley, or the
 * off-network hop to/from the visitor's exact position). */
function stepInstruction(
  step: RouteStep,
  t: (key: string, values?: Record<string, string>) => string,
): string {
  const street = step.streetName;
  switch (step.kind) {
    case "depart":
      return street ? t("steps.depart", { street }) : t("steps.departGeneric");
    case "turn-left":
      return street
        ? t("steps.turnLeft", { street })
        : t("steps.turnLeftGeneric");
    case "turn-right":
      return street
        ? t("steps.turnRight", { street })
        : t("steps.turnRightGeneric");
    case "continue":
      return street
        ? t("steps.continue", { street })
        : t("steps.continueGeneric");
    case "cross":
      return street ? t("steps.crossNamed", { street }) : t("steps.cross");
    case "stairs":
      return street ? t("steps.stairsNamed", { street }) : t("steps.stairs");
  }
}

/** The steps `<ol>` itself, shared by both of PanelBody's renderings below —
 * only what wraps it (an always-open card on desktop, a tap-to-expand
 * `<details>` on mobile) differs. */
function StepsList({
  steps,
  destinationName,
  tMap,
}: {
  steps: RouteStep[];
  destinationName: string;
  tMap: (key: string, values?: Record<string, string>) => string;
}) {
  return (
    <ol className="max-h-48 space-y-2.5 overflow-y-auto text-sm">
      {steps.map((step, i) => {
        const Icon = STEP_ICONS[step.kind];
        return (
          // Index as key: steps are a fixed, ordered breakdown of one
          // route, never reordered/filtered — nothing else uniquely
          // identifies one over another.
          <li key={i} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-foreground/60">
              <Icon size={13} />
            </span>
            <span className="min-w-0 flex-1">
              {stepInstruction(step, tMap)}
              {step.distanceKm > 0.01 && (
                <span className="text-foreground/45">
                  {" "}
                  · {formatDistance(step.distanceKm)}
                </span>
              )}
            </span>
          </li>
        );
      })}
      <li className="flex items-start gap-2.5 font-semibold">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime/15 text-lime-readable">
          <Flag size={13} />
        </span>
        <span className="min-w-0 flex-1">
          {tMap("steps.arrive", { name: destinationName })}
        </span>
      </li>
    </ol>
  );
}

interface DirectionsPanelProps {
  destinationName: string;
  categoryIcon: ReactNode;
  /** Powers the "open in Google Maps instead" fallback link on the error
   * state — the one place this feature still hands off to Google Maps,
   * since our own geolocation having failed is exactly when a real map app
   * (which can ask for location again, or just search from wherever it
   * already knows the visitor is) is more useful than nothing. */
  destination: { lat: number; lng: number };
  status: DirectionsStatus;
  /** Null while still locating/routing, or after an error. */
  distanceKm: number | null;
  /** True when the street network couldn't connect both ends and this is
   * just a straight line — the route summary says so rather than presenting
   * a guess as a real walking path. */
  approximate: boolean;
  /** True once a real fix has placed the visitor outside Casco Viejo — the
   * route was started from the neighborhood's entry point instead of their
   * actual position, and a persistent notice says so (see SpotMap's
   * isWithinCascoViejo check). */
  outsideArea: boolean;
  /** Turn-by-turn breakdown of the current route (see lib/routing.ts) —
   * empty for an approximate/straight-line route, in which case the
   * disclosure below doesn't render at all (there's nothing real to list). */
  steps: RouteStep[];
  onClose: () => void;
  /** Re-requests the visitor's location — offered on the error state. */
  onRetry: () => void;
  /** Same purpose as MapDetailPanel's own prop — pushes the desktop panel
   * below whatever floating chrome already occupies the map's top edge. */
  topOffsetPx?: number;
}

/**
 * Google-Maps-style "you are here → destination" overlay for SpotMap's
 * itinerary mode — replaces the normal MapDetailPanel while a route is
 * active (see SpotMap's `directionsTarget`). Same desktop-side-panel /
 * mobile-bottom-bar split as MapDetailPanel, but built as its own component
 * rather than squeezed into that one's `DetailPanelContent` shape: a route
 * summary (distance/time, live status) reads nothing like a place's photo/
 * meta/actions card.
 */
export function DirectionsPanel(props: DirectionsPanelProps) {
  return (
    <>
      {/* Desktop — same top-left slot as MapDetailPanel's side panel. */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={props.destinationName}
        initial={{ x: -24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -24, opacity: 0 }}
        transition={{ duration: 0.22, ease: EASE_OUT }}
        style={
          props.topOffsetPx != null ? { top: props.topOffsetPx } : undefined
        }
        className="glass absolute left-4 top-4 z-[1250] hidden max-h-[calc(100%-2rem)] w-[380px] max-w-[calc(100%-2rem)] flex-col overflow-y-auto rounded-[var(--radius-card)] border border-border p-4 shadow-2xl md:flex"
      >
        {/* Bigger screens have the room to just leave the full turn-by-turn
            open rather than tucked behind a tap — mobile's tighter bottom
            bar is the one that still collapses it (see stepsAlwaysVisible
            below). */}
        <PanelBody {...props} stepsAlwaysVisible />
      </motion.div>

      {/* Mobile — bottom bar, viewport-anchored like the sticky action bar
          on the spot detail page, not scoped to the map box. */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={props.destinationName}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.28, ease: EASE_OUT }}
        className="safe-bottom fixed inset-x-0 bottom-0 z-[1250] flex max-h-[85vh] flex-col overflow-y-auto border-t border-border bg-surface p-4 shadow-2xl md:hidden"
      >
        <PanelBody {...props} stepsAlwaysVisible={false} />
      </motion.div>
    </>
  );
}

function PanelBody({
  destinationName,
  categoryIcon,
  destination,
  status,
  distanceKm,
  approximate,
  outsideArea,
  steps,
  onClose,
  onRetry,
  stepsAlwaysVisible,
}: DirectionsPanelProps & {
  /** True on desktop's side panel (room to just leave it open), false on
   * mobile's bottom bar (kept as a tap-to-expand disclosure instead). */
  stepsAlwaysVisible: boolean;
}) {
  const tMap = useTranslations("map");
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${destination.lat},${destination.lng}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <motion.button
          type="button"
          onClick={onClose}
          aria-label={tMap("exitDirections")}
          whileTap={{ scale: 0.9 }}
          transition={TAP_SPRING}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground/60 hover:bg-foreground/5 hover:text-foreground md:hidden"
        >
          <ArrowLeft size={17} />
        </motion.button>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-foreground/70">
          {categoryIcon}
        </span>
        <h3 className="min-w-0 flex-1 truncate font-heading text-base font-extrabold leading-tight">
          {destinationName}
        </h3>
        <motion.button
          type="button"
          onClick={onClose}
          aria-label={tMap("exitDirections")}
          whileTap={{ scale: 0.9 }}
          transition={TAP_SPRING}
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground/60 hover:bg-foreground/5 hover:text-foreground md:flex"
        >
          <X size={17} />
        </motion.button>
      </div>

      {outsideArea && (status === "routing" || status === "ready") && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-2 rounded-[var(--radius-button)] border border-border bg-foreground/[0.03] px-3.5 py-2.5 text-xs font-semibold text-foreground/70"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-foreground/50" />
          {tMap("outsideAreaNotice")}
        </motion.p>
      )}

      <div className="flex items-center gap-2.5 rounded-[var(--radius-button)] border border-border bg-foreground/[0.03] px-3.5 py-3">
        <AnimatePresence mode="wait" initial={false}>
          {status === "ready" && distanceKm != null ? (
            <motion.div
              key="ready"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-w-0 flex-1 items-center gap-2.5"
            >
              <Footprints
                size={18}
                className="shrink-0 text-aqua-dark dark:text-aqua"
              />
              <p className="min-w-0 flex-1 text-sm">
                <span className="font-heading text-base font-extrabold">
                  {walkingMinutes(distanceKm)} min
                </span>
                <span className="text-foreground/60">
                  {" "}
                  · {formatDistance(distanceKm)}
                </span>
              </p>
            </motion.div>
          ) : status === "error" ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-w-0 flex-1 items-center justify-between gap-2"
            >
              <p className="text-sm font-semibold text-foreground/70">
                {tMap("locateError")}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="shrink-0 rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold hover:bg-foreground/15"
              >
                {tMap("retry")}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-sm font-semibold text-foreground/60"
            >
              <Loader2 size={16} className="shrink-0 animate-spin" />
              <span className="truncate">
                {status === "locating"
                  ? tMap("locating")
                  : tMap("calculatingRoute")}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {status === "ready" && approximate && (
        <p className="-mt-1 text-xs text-foreground/50">
          {tMap("approximateRoute")}
        </p>
      )}

      {/* Full turn-by-turn. Only offered for a real, street-traced route —
          `steps` is empty for the straight-line fallback, which has no
          actual turns to narrate. */}
      {status === "ready" &&
        steps.length > 0 &&
        (stepsAlwaysVisible ? (
          // Desktop: just left open — the side panel has the room, and
          // there's no real reason to make someone click to see the one
          // thing "get directions" was actually for.
          <div className="-mx-1 rounded-[var(--radius-button)] border border-border">
            <p className="border-b border-border px-3 py-2 text-sm font-bold">
              {tMap("steps.title")}
            </p>
            <div className="px-3 py-2.5">
              <StepsList
                steps={steps}
                destinationName={destinationName}
                tMap={tMap}
              />
            </div>
          </div>
        ) : (
          // Mobile: same disclosure pattern as the weekly hours table on the
          // spot detail page — worth a tap to expand, not something that has
          // to dominate this otherwise compact bottom bar.
          <details className="group -mx-1 rounded-[var(--radius-button)] border border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-bold [&::-webkit-details-marker]:hidden">
              {tMap("steps.title")}
              <ChevronDown
                size={15}
                className="text-foreground/40 transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="border-t border-border px-3 py-2.5">
              <StepsList
                steps={steps}
                destinationName={destinationName}
                tMap={tMap}
              />
            </div>
          </details>
        ))}

      {status === "error" && (
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-aqua-dark hover:underline dark:text-aqua"
        >
          <ExternalLink size={12} /> {tMap("openInGoogleMaps")}
        </a>
      )}
    </div>
  );
}
