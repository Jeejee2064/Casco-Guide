"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Star, MapPin, Phone, Footprints } from "lucide-react";
import { useTranslations } from "next-intl";
import { CategoryBadge } from "./CategoryBadge";
import { HoursBadge } from "./HoursBadge";
import { TAP_SPRING } from "./motion";
import { getSpotImage } from "@/lib/data/categoryImages";
import { VIBE_META } from "@/lib/vibes";
import type { Spot, SpotVibe } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export function SpotCard({
  spot,
  onClick,
  activeVibes = [],
  walkMinutes,
}: {
  spot: Spot;
  onClick: () => void;
  /** The vibes currently driving the filter/sort (see SpotExplorer) — a spot
   * that carries one gets a whisper-thin accent ring in that vibe's color
   * (see `accentColor` below) instead of a second badge, so "this is why
   * you're seeing this" reads without adding to the image's visual noise —
   * the single category badge stays the only mark on the photo itself. */
  activeVibes?: SpotVibe[];
  /** Walking time in minutes from whatever origin the caller measured
   * against (see NearbySection) — omitted outside that "nearby" context, so
   * the badge only ever shows where "nearby" actually means something. */
  walkMinutes?: number;
}) {
  const tMap = useTranslations("map");
  const priceLabel = spot.price_range ?? "";
  const matchedVibe = spot.vibes.find((v) => activeVibes.includes(v));
  const accentColor = matchedVibe ? VIBE_META[matchedVibe].color : undefined;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={TAP_SPRING}
      style={
        accentColor
          ? {
              borderColor: `color-mix(in srgb, ${accentColor} 45%, var(--border))`,
              boxShadow: `0 0 0 1px color-mix(in srgb, ${accentColor} 25%, transparent)`,
            }
          : undefined
      }
      className="card-lift group flex h-full w-full flex-col text-left rounded-[var(--radius-card)] bg-surface border border-border overflow-hidden shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-aqua"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-aqua/20 to-coral/20">
        <Image
          src={getSpotImage(spot)}
          alt={spot.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />

        {/* One badge, one job: category. Everything else that used to live
            here (per-vibe icon chips) moved to the card's border accent
            above — see `accentColor`. */}
        <div className="absolute top-3 left-3 right-3">
          <CategoryBadge category={spot.category} />
        </div>
        {/* "Featured" badge hidden site-wide for now — no spot is currently
            promoted this way. Re-enable by restoring this block (and
            `const t = useTranslations("spot")` above) once there is real
            featured content:
            {spot.is_featured && (
              <div className="absolute top-3 right-3 rounded-full bg-gradient-to-br from-white/95 to-white/80 px-2.5 py-1 text-xs font-semibold text-gold-dark shadow-sm dark:from-black/70 dark:to-black/50 dark:text-gold">
                {t("featured")}
              </div>
            )} */}
        {walkMinutes != null && (
          <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-white">
            <Footprints size={12} />
            {tMap("walkTime", { mins: walkMinutes })}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col space-y-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading text-lg font-bold leading-tight line-clamp-1">
            {spot.name}
          </h3>
          {spot.rating && (
            <span className="flex shrink-0 items-center gap-1 text-sm font-semibold transition-transform duration-300 group-hover:scale-110">
              <Star size={14} className="fill-gold-dark text-gold-dark dark:fill-gold dark:text-gold" />
              {spot.rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Fixed 2-line reservation, not conditional — a spot with no
            description (or a one-liner) must leave the same gap a two-line
            one does, or its card ends up shorter than its row-mates. Same
            reasoning for the tags row and the address row below: every
            optional bit of content gets a fixed-height slot regardless of
            whether it actually has anything in it, so every card in the
            grid comes out exactly the same height (bento-style), not just
            the ones that happen to have full copy. */}
        <p className="line-clamp-2 min-h-[2.5rem] text-sm text-foreground/70">
          {spot.description}
        </p>

        {/* Fixed height + no wrap + clipped, not flex-wrap — 3 short tags fit
            one line but 3 long ones (e.g. "#performing-arts") don't, and a
            wrapped 2nd line is exactly the kind of per-card height drift
            this whole component is trying to avoid. A tag or two getting
            clipped off is a fine trade for every card staying the same
            height — the edge mask fades it out instead of hard-cutting a
            pill mid-word. */}
        <div className="flex h-[1.375rem] gap-1.5 overflow-hidden [mask-image:linear-gradient(to_right,black_88%,transparent_100%)]">
          {spot.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="shrink-0 rounded-full bg-foreground/5 text-foreground/60 px-2 py-0.5 text-[11px] font-medium"
            >
              #{tag}
            </span>
          ))}
        </div>

        <div className="flex h-7 items-center gap-2 overflow-hidden pt-1">
          <HoursBadge spot={spot} className="shrink-0" />
          {priceLabel && (
            <span className="shrink-0 text-xs font-semibold text-foreground/60">{priceLabel}</span>
          )}
        </div>

        <div className="flex min-h-[1rem] items-center gap-3 pt-1.5 text-xs text-foreground/60">
          {spot.address && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin size={12} className="shrink-0" />
              <span className="truncate">{spot.address}</span>
            </span>
          )}
          {spot.phone && (
            <span className={cn("flex items-center gap-1 shrink-0")}>
              <Phone size={12} />
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}
