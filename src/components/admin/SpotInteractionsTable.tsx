"use client";

import { useMemo, useState } from "react";
import { Search, Star, ChevronUp, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { CategoryBadge } from "@/components/site/CategoryBadge";
import { Input, Select } from "@/components/ui/Field";
import { SPOT_CATEGORIES } from "@/lib/categories";
import { SPOT_VIBES } from "@/lib/vibes";
import { cn } from "@/lib/utils";
import type { SpotCategory, SpotVibe } from "@/lib/types/database";

export type SpotInteractionRow = {
  rank: number;
  id: string;
  slug: string;
  name: string;
  category: SpotCategory;
  vibes: SpotVibe[];
  isFeatured: boolean;
  views: number;
  whatsapp: number;
  directions: number;
  mapClicks: number;
  shares: number;
  total: number;
};

type SortKey = "rank" | "views" | "whatsapp" | "directions" | "mapClicks" | "shares" | "total";
type SortDir = "asc" | "desc";

// `rank` sorts ascending by default (lower = better, #1 first) — every
// other column is a raw count, where the interesting end is the top.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  rank: "asc",
  views: "desc",
  whatsapp: "desc",
  directions: "desc",
  mapClicks: "desc",
  shares: "desc",
  total: "desc",
};

/** Every spot, ranked by total interactions (views + WhatsApp + directions
 * + map taps + shares) over the window — not just a top-N list. `rank` is
 * fixed at the row's true position by total interactions among *all*
 * spots; filtering/sorting only reorders or hides what's shown, it never
 * recomputes that number, so "you're #37 overall" stays true even while
 * sorted by WhatsApp clicks alone. Built for exactly one conversation:
 * pulling up a specific business and showing them where they land next to
 * the featured spots. */
export function SpotInteractionsTable({ rows }: { rows: SpotInteractionRow[] }) {
  const t = useTranslations("admin.analytics");
  const tCat = useTranslations("category");
  const tVibe = useTranslations("vibe");
  const [query, setQuery] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [category, setCategory] = useState("");
  const [vibe, setVibe] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  };

  const rowsToShow = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (featuredOnly && !r.isFeatured) return false;
      if (category && r.category !== category) return false;
      if (vibe && !r.vibes.includes(vibe as SpotVibe)) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
    const sign = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => sign * (a[sortKey] - b[sortKey]));
  }, [rows, query, featuredOnly, category, vibe, sortKey, sortDir]);

  const columns: { key: SortKey; label: string }[] = [
    { key: "views", label: t("interactionsColViews") },
    { key: "whatsapp", label: t("interactionsColWhatsapp") },
    { key: "directions", label: t("interactionsColDirections") },
    { key: "mapClicks", label: t("interactionsColMap") },
    { key: "shares", label: t("interactionsColShare") },
    { key: "total", label: t("interactionsColTotal") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground/50">
          {t("interactionsCount", { count: rows.length })}
        </p>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 sm:w-52">
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
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-44">
            <option value="">{t("interactionsAllCategories")}</option>
            {SPOT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tCat(c)}
              </option>
            ))}
          </Select>
          <Select value={vibe} onChange={(e) => setVibe(e.target.value)} className="sm:w-44">
            <option value="">{t("interactionsAllVibes")}</option>
            {SPOT_VIBES.map((v) => (
              <option key={v} value={v}>
                {tVibe(v)}
              </option>
            ))}
          </Select>
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
              <th
                className="cursor-pointer select-none px-4 py-3 hover:text-foreground"
                onClick={() => toggleSort("rank")}
              >
                <span className="flex items-center gap-1">
                  #
                  {sortKey === "rank" &&
                    (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                </span>
              </th>
              <th className="px-4 py-3">{t("interactionsColSpot")}</th>
              <th className="px-4 py-3">{t("interactionsColCategory")}</th>
              {columns.map(({ key, label }) => (
                <th
                  key={key}
                  className="cursor-pointer select-none px-4 py-3 text-right hover:text-foreground"
                  onClick={() => toggleSort(key)}
                >
                  <span className="flex items-center justify-end gap-1">
                    {label}
                    {sortKey === key &&
                      (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowsToShow.map((row) => (
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
            {rowsToShow.length === 0 && (
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
