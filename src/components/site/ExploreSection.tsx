"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid, MapIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { SpotExplorer } from "./SpotExplorer";
import { SpotMap } from "./SpotMap";
import { EASE_OUT, TAP_SPRING } from "./motion";
import { useExploreView } from "./ExploreViewContext";
import type { EventRow, Spot } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export function ExploreSection({ spots, events = [] }: { spots: Spot[]; events?: EventRow[] }) {
  const tSite = useTranslations("site");
  // Shared with Header (see ExploreViewContext) — plain client state, not the
  // URL. This route is dynamic (fetches spots/events/articles fresh from
  // Supabase), so routing this through the URL via `router.push`/`replace`
  // turned a should-be-instant tab switch into a ~1s+ server round-trip —
  // long enough that the old grid was the only thing on screen the whole
  // time, visible right through the header's glass background above it.
  const { isMapView, setIsMapView } = useExploreView();
  const view = isMapView ? "map" : "grid";

  return (
    <div className={view === "grid" ? "pb-20" : undefined}>
      {/* No `mode="wait"` — with switching now instant, waiting out the
          grid's exit fade before even starting to mount the map would just
          reintroduce a needless quarter-second of nothing happening. The map
          is `position: fixed` and paints an opaque background from its first
          frame (see SpotMap), so mounting it immediately alongside the
          exiting grid is enough for it to cover the grid right away instead. */}
      <AnimatePresence>
        {view === "grid" ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
          >
            <SpotExplorer spots={spots} />
          </motion.div>
        ) : (
          // Opacity-only (no y/scale) — SpotMap's fullScreen mode relies on
          // `position: fixed` reaching the real viewport, which a transform
          // on any ancestor (even at rest) would break by creating a new
          // containing block for it.
          <motion.div
            key="map"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
          >
            <SpotMap spots={spots} events={events} fullScreen />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating, always-reachable view switcher — bottom-left thumb zone, survives scroll. */}
      <div className="safe-bottom fixed bottom-4 left-4 z-40">
        <div className="glass relative inline-flex rounded-full border border-border p-1 shadow-lg">
          {(
            [
              { key: "grid", label: tSite("viewGrid"), icon: LayoutGrid },
              { key: "map", label: tSite("viewMap"), icon: MapIcon },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <motion.button
              key={key}
              onClick={() => setIsMapView(key === "map")}
              whileTap={{ scale: 0.94 }}
              transition={TAP_SPRING}
              className={cn(
                "relative z-10 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                view === key ? "text-white" : "text-foreground/60 hover:text-foreground",
              )}
            >
              {view === key && (
                <motion.span
                  layoutId="explore-view-pill"
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                  className="brand-accent absolute inset-0 -z-10 rounded-full"
                />
              )}
              <Icon size={14} />
              {label}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
