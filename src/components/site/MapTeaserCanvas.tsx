"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, MapIcon } from "lucide-react";
import { useNightMode } from "./NightModeContext";
import { SvgMap, type HtmlPin, type SvgMapHandle } from "./SvgMap";
import { Link } from "@/i18n/navigation";
import { project } from "@/lib/svgMap/projection";
import type { SpotCategory } from "@/lib/types/database";
import { CATEGORY_BLUES, CATEGORY_ICON_SHAPES, ShapeIcon } from "./SpotPinIcons";

// Same brand blue every pin on the real map uses (see SpotMap's
// NEUTRAL_PIN_COLOR).
const PIN_COLOR = "#146b8c";

/**
 * The homepage's map teaser — the real SVG map, read-only, framed on every
 * pin (outliers included) with one big button in the middle that leads to
 * /map. The map itself (basemap download + engine) only mounts once the
 * section is about to scroll into view, so it costs the first paint nothing.
 */
export function MapTeaserCanvas({
  points,
  label,
}: {
  points: { id: string; lat: number; lng: number; category: SpotCategory }[];
  label: string;
}) {
  const { isNight } = useNightMode();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<SvgMapHandle | null>(null);
  const [active, setActive] = useState(false);
  // SvgMap only has a camera once its basemap has loaded.
  const [ready, setReady] = useState(false);

  const [prefersDark, setPrefersDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setPrefersDark(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Mount the map shortly before it scrolls into view.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setActive(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const world = useMemo(
    () =>
      points.map((p) => ({
        id: p.id,
        category: p.category,
        at: project(p.lat, p.lng),
      })),
    [points],
  );

  const pins: HtmlPin[] = useMemo(
    () =>
      world.map(({ id, at, category }) => ({
        id,
        x: at[0],
        y: at[1],
        width: 34,
        height: 34,
        anchor: [17, 34],
        className: "spot-pin-marker",
        // Smaller than the real map's pins (scaled from the tip) — here the
        // point is the overall spread, and a hundred full-size pins on a
        // zoomed-out frame would just be one blob.
        node: (
          <span
            className="block h-full w-full"
            style={{ transform: "scale(0.8)", transformOrigin: "17px 34px" }}
          >
            <span
              className="spot-pin"
              style={{ background: CATEGORY_BLUES[category] ?? PIN_COLOR, color: "white" }}
            >
              <span className="spot-pin__icon">
                <ShapeIcon shapes={CATEGORY_ICON_SHAPES[category]} />
              </span>
            </span>
          </span>
        ),
      })),
    [world],
  );

  // Frame the dense core of the pins rather than every one: a few far-off
  // outliers would otherwise force a zoom-out that shrinks the whole city to
  // a blob. The top padding leaves room for a pin's body above its tip.
  useEffect(() => {
    if (!ready || world.length === 0) return;
    const trimmed = (vals: number[]) => {
      const sorted = [...vals].sort((a, b) => a - b);
      const cut = Math.floor(sorted.length * 0.1);
      return [sorted[cut], sorted[sorted.length - 1 - cut]];
    };
    const [minX, maxX] = trimmed(world.map((w) => w.at[0]));
    const [minY, maxY] = trimmed(world.map((w) => w.at[1]));
    mapRef.current?.fitBounds([minX, minY, maxX, maxY], {
      padding: { top: 64, right: 48, bottom: 40, left: 48 },
    });
  }, [ready, world]);

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 bg-[#eef2f0] [html[data-night]_&]:bg-[#0b1120]"
    >
      {active && (
        <SvgMap
          ref={mapRef}
          onReady={() => setReady(true)}
          dark={isNight || prefersDark}
          interactive={false}
          controls={false}
          htmlPins={pins}
          className="h-full w-full"
        />
      )}
      {/* The whole teaser is one link; the button is just its visible label,
          centered on the map. */}
      <Link
        href="/map"
        aria-label={label}
        className="absolute inset-0 z-30 flex items-center justify-center"
      >
        <span className="flex items-center gap-3 rounded-full bg-surface/90 py-2.5 pl-2.5 pr-4 shadow-xl backdrop-blur sm:py-3 sm:pl-3 sm:pr-5 transition-transform duration-200 group-hover:scale-105">
          <span className="brand-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white">
            <MapIcon size={20} />
          </span>
          <span className="font-heading font-bold">{label}</span>
          <ArrowRight size={18} className="shrink-0 text-foreground/40" />
        </span>
      </Link>
    </div>
  );
}
