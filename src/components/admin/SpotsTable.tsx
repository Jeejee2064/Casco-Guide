"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Star, CheckCircle2, Pencil, Trash2, Eye, CornerDownRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Input, Select } from "@/components/ui/Field";
import { CategoryBadge } from "@/components/site/CategoryBadge";
import { SPOT_CATEGORIES } from "@/lib/categories";
import { SPOT_VIBES } from "@/lib/vibes";
import { groupSpotsByParent } from "@/lib/spots/hierarchy";
import { deleteSpot } from "@/lib/actions/spots";
import { cn } from "@/lib/utils";
import type { Spot, SpotVibe } from "@/lib/types/database";

export function SpotsTable({ spots: initialSpots }: { spots: Spot[] }) {
  const t = useTranslations("admin.spots");
  const tCat = useTranslations("category");
  const tVibe = useTranslations("vibe");
  const searchParams = useSearchParams();
  const [spots, setSpots] = useState(initialSpots);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [vibe, setVibe] = useState("");
  // Lets the dashboard's "Featured spots" stat card deep-link here pre-filtered.
  const [featuredOnly, setFeaturedOnly] = useState(searchParams.get("featured") === "1");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spots.filter((s) => {
      if (category && s.category !== category) return false;
      if (vibe && !s.vibes.includes(vibe as SpotVibe)) return false;
      if (featuredOnly && !s.is_featured) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [spots, query, category, vibe, featuredOnly]);

  // Nests each hub's children directly under it (one level, indented) —
  // filters above stay literal per-row, so a child whose parent didn't pass
  // the current filter falls back to a plain, unindented row rather than
  // silently disappearing from the table.
  const rows = useMemo(() => {
    const { topLevel, childrenByParent } = groupSpotsByParent(filtered);
    const nested = new Set<string>();
    const out: { spot: Spot; isChild: boolean; childCount: number }[] = [];
    for (const parent of topLevel) {
      const kids = childrenByParent.get(parent.id) ?? [];
      out.push({ spot: parent, isChild: false, childCount: kids.length });
      for (const child of kids) {
        out.push({ spot: child, isChild: true, childCount: 0 });
        nested.add(child.id);
      }
    }
    for (const s of filtered) {
      if (s.parent_id && !nested.has(s.id)) out.push({ spot: s, isChild: false, childCount: 0 });
    }
    return out;
  }, [filtered]);

  const handleDelete = (spot: Spot) => {
    if (!confirm(t("deleteConfirm", { name: spot.name }))) return;
    startTransition(async () => {
      const res = await deleteSpot(spot.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        setSpots((prev) => prev.filter((s) => s.id !== spot.id));
        toast.success(t("deleted"));
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            className="pl-10"
          />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-52">
          <option value="">{t("allCategories")}</option>
          {SPOT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {tCat(c)}
            </option>
          ))}
        </Select>
        <Select value={vibe} onChange={(e) => setVibe(e.target.value)} className="sm:w-52">
          <option value="">{t("allVibes")}</option>
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
          {t("featuredOnly")}
        </button>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-foreground/50">
              <th className="px-4 py-3">{t("columns.name")}</th>
              <th className="px-4 py-3">{t("columns.category")}</th>
              <th className="px-4 py-3">{t("columns.coords")}</th>
              <th className="px-4 py-3">{t("columns.rating")}</th>
              <th className="px-4 py-3">{t("columns.verified")}</th>
              <th className="px-4 py-3 text-right">{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ spot, isChild, childCount }) => (
              <tr key={spot.id} className="border-b border-border last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-semibold">
                  <span className={cn("inline-flex items-center gap-1.5", isChild && "font-medium text-foreground/80")}>
                    {isChild && <CornerDownRight size={13} className="shrink-0 text-foreground/30" />}
                    {spot.name}
                    {childCount > 0 && (
                      <span className="rounded-full bg-aqua/15 px-1.5 py-0.5 text-[10px] font-bold text-aqua-dark">
                        {t("childCount", { count: childCount })}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <CategoryBadge category={spot.category} />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-foreground/60">
                  {spot.latitude.toFixed(4)}, {spot.longitude.toFixed(4)}
                </td>
                <td className="px-4 py-3">
                  {spot.rating ? (
                    <span className="flex items-center gap-1 font-semibold">
                      <Star size={13} className="fill-coral text-coral" /> {spot.rating}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {spot.is_verified && <CheckCircle2 size={16} className="text-lime" />}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={{ pathname: "/spots/[slug]", params: { slug: spot.slug } }}
                      target="_blank"
                      className="rounded-lg p-2 text-foreground/50 hover:bg-black/5 dark:hover:bg-white/5"
                      title={t("view")}
                    >
                      <Eye size={15} />
                    </Link>
                    <Link
                      href={{ pathname: "/admin/spots/[id]", params: { id: spot.id } }}
                      className="rounded-lg p-2 text-aqua-dark hover:bg-aqua/10"
                      title={t("edit")}
                    >
                      <Pencil size={15} />
                    </Link>
                    <button
                      onClick={() => handleDelete(spot)}
                      disabled={pending}
                      className="rounded-lg p-2 text-coral hover:bg-coral/10 disabled:opacity-40"
                      title={t("delete")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-foreground/50">
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
