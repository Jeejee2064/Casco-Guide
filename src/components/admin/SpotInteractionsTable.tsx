"use client";

import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { CategoryBadge } from "@/components/site/CategoryBadge";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import type { SpotCategory } from "@/lib/types/database";

export type SpotInteractionRow = {
  rank: number;
  id: string;
  slug: string;
  name: string;
  category: SpotCategory;
  isFeatured: boolean;
  views: number;
  whatsapp: number;
  directions: number;
  mapClicks: number;
  shares: number;
  total: number;
};

/** Every spot, ranked by total interactions (views + WhatsApp + directions
 * + map taps) over the window — not just a top-N list. `rank` is fixed at
 * the row's true position among *all* spots; search/the featured filter
 * only hide rows, they never renumber what's left, so "you're #37" stays
 * meaningful however the list is filtered. Built for exactly one
 * conversation: pulling up a specific business and showing them where they
 * land next to the featured spots. */
export function SpotInteractionsTable({ rows }: { rows: SpotInteractionRow[] }) {
  const t = useTranslations("admin.analytics");
  const [query, setQuery] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (featuredOnly && !r.isFeatured) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, featuredOnly]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground/50">
          {t("interactionsCount", { count: rows.length })}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1 sm:w-64">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("interactionsSearch")}
              className="pl-10"
            />
          </div>
          <button
            type="button"
            onClick={() => setFeaturedOnly((v) => !v)}
            className={cn(
              "flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-button)] border px-4 text-sm font-semibold transition-colors",
              featuredOnly
                ? "border-magenta bg-magenta/10 text-magenta-dark dark:text-magenta"
                : "border-border bg-surface text-foreground/70",
            )}
          >
            <Star size={14} className={featuredOnly ? "fill-magenta" : undefined} />
            {t("interactionsFeaturedOnly")}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-foreground/50">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">{t("interactionsColSpot")}</th>
              <th className="px-4 py-3">{t("interactionsColCategory")}</th>
              <th className="px-4 py-3 text-right">{t("interactionsColViews")}</th>
              <th className="px-4 py-3 text-right">{t("interactionsColWhatsapp")}</th>
              <th className="px-4 py-3 text-right">{t("interactionsColDirections")}</th>
              <th className="px-4 py-3 text-right">{t("interactionsColMap")}</th>
              <th className="px-4 py-3 text-right">{t("interactionsColShare")}</th>
              <th className="px-4 py-3 text-right">{t("interactionsColTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3 tabular-nums text-foreground/50">{row.rank}</td>
                <td className="px-4 py-3 font-semibold">
                  <span className="flex items-center gap-1.5">
                    {row.isFeatured && <Star size={13} className="shrink-0 fill-magenta text-magenta" />}
                    {row.name}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <CategoryBadge category={row.category} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{row.views.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">{row.whatsapp.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.directions.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {row.mapClicks.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{row.shares.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">
                  {row.total.toLocaleString()}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-foreground/50">
                  {t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
