"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Star, MapPin, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { CategoryBadge } from "./CategoryBadge";
import { HoursBadge } from "./HoursBadge";
import { TAP_SPRING } from "./motion";
import { getSpotImage } from "@/lib/data/categoryImages";
import type { Spot } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export function SpotCard({ spot, onClick }: { spot: Spot; onClick: () => void }) {
  const t = useTranslations("spot");
  const priceLabel = spot.price_range ?? "";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={TAP_SPRING}
      className="card-lift group w-full text-left rounded-[var(--radius-card)] bg-surface border border-border overflow-hidden shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-aqua"
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

        <div className="absolute top-3 left-3">
          <CategoryBadge category={spot.category} />
        </div>
        {spot.is_featured && (
          <div className="absolute top-3 right-3 rounded-full bg-white/90 dark:bg-black/60 px-2.5 py-1 text-xs font-semibold text-gold-dark dark:text-gold">
            {t("featured")}
          </div>
        )}
      </div>

      <div className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading text-lg font-bold leading-tight line-clamp-1">
            {spot.name}
          </h3>
          {spot.rating && (
            <span className="flex shrink-0 items-center gap-1 text-sm font-semibold">
              <Star size={14} className="fill-gold-dark text-gold-dark dark:fill-gold dark:text-gold" />
              {spot.rating.toFixed(1)}
            </span>
          )}
        </div>

        {spot.description && (
          <p className="text-sm text-foreground/70 line-clamp-2">{spot.description}</p>
        )}

        {spot.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {spot.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-foreground/5 text-foreground/60 px-2 py-0.5 text-[11px] font-medium"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <HoursBadge spot={spot} />
          {priceLabel && (
            <span className="text-xs font-semibold text-foreground/60">{priceLabel}</span>
          )}
        </div>

        <div className="flex items-center gap-3 pt-1.5 text-xs text-foreground/60">
          {spot.address && (
            <span className="flex items-center gap-1 line-clamp-1">
              <MapPin size={12} /> {spot.address}
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
