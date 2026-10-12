"use client";

import { Rocket, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * "Get me there!" CTA card — same action as the page's Get directions
 * button (and the pin's directions button on the map), just big and right
 * under the MiniMap (spot/event detail aside) so it's reachable without
 * scrolling to the bottom of the page.
 */
export function GetMeThereCard({ onClick }: { onClick: () => void }) {
  const t = useTranslations("discover");

  return (
    <button
      type="button"
      onClick={onClick}
      className="card-lift flex w-full items-center gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 text-left"
    >
      <div className="brand-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white">
        <Rocket size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-heading font-bold">{t("getMeThere")}</p>
      </div>
      <ArrowRight size={18} className="shrink-0 text-foreground/40" />
    </button>
  );
}
