"use client";

import { MapIcon, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * CTA card back to the full map. Sits directly under a MiniMap (spot/event
 * detail aside) so it's reachable without scrolling to the bottom of the page.
 */
export function ExploreMapCard() {
  const t = useTranslations("discover");

  return (
    <Link
      href={{ pathname: "/", query: { view: "map" }, hash: "explore" }}
      className="card-lift flex items-center gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5"
    >
      <div className="brand-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white">
        <MapIcon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-heading font-bold">{t("exploreMap")}</p>
        <p className="text-sm text-foreground/60">{t("exploreMapSubtitle")}</p>
      </div>
      <ArrowRight size={18} className="shrink-0 text-foreground/40" />
    </Link>
  );
}
