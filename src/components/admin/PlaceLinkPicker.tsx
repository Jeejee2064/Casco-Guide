"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, CalendarDays, FileText, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LinkablePlace {
  id: string;
  type: "spot" | "event" | "article";
  label: string;
  slug: string;
}

const TYPE_ICON = { spot: MapPin, event: CalendarDays, article: FileText } as const;
const TYPE_COLOR = {
  spot: "bg-aqua/15 text-aqua",
  event: "bg-coral/15 text-coral",
  article: "bg-magenta/15 text-magenta",
} as const;

export interface PlaceLinkLabels {
  title: string;
  searchPlaceholder: string;
  empty: string;
  close: string;
  /** Labels for the type filter pills — "all" plus one per LinkablePlace
   * type. Pills only render for types actually present in `places`, so
   * e.g. ArticleBlocksEditor's spot/event-only picker never shows "article". */
  typeFilter: { all: string; spot: string; event: string; article: string };
}

type TypeFilter = "all" | LinkablePlace["type"];

/**
 * Modal opened by ArticleBodyEditor's "Link" toolbar button. Lets the admin
 * search across every spot and event already in the DB and pick one to
 * link the current selection (or insert as new text) to — see
 * ArticleBodyEditor.tsx for how the choice becomes a Tiptap link mark.
 */
export function PlaceLinkPicker({
  places,
  labels,
  onSelect,
  onClose,
}: {
  places: LinkablePlace[];
  labels: PlaceLinkLabels;
  onSelect: (place: LinkablePlace) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  // Only offer pills for types actually present — the blocks editor's
  // picker only ever gets spots/events, so it never shows an "article" tab,
  // and a single-type list skips the row entirely (nothing to switch between).
  const availableTypes = useMemo(
    () => (["spot", "event", "article"] as const).filter((t) => places.some((p) => p.type === t)),
    [places],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return places.filter((p) => (typeFilter === "all" || p.type === typeFilter) && (!q || p.label.toLowerCase().includes(q)));
  }, [places, query, typeFilter]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: "100%", opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-surface shadow-2xl sm:h-auto sm:max-h-[80vh] sm:rounded-[var(--radius-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="font-heading text-base font-bold">{labels.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-border p-3">
          <div className="flex items-center gap-2 rounded-[var(--radius-button)] border border-border bg-background px-3 py-2">
            <Search size={15} className="shrink-0 text-foreground/40" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={labels.searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          {availableTypes.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(["all", ...availableTypes] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    typeFilter === t
                      ? t === "all"
                        ? "bg-foreground text-background"
                        : TYPE_COLOR[t]
                      : "bg-black/5 text-foreground/60 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10",
                  )}
                >
                  {labels.typeFilter[t]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-foreground/50">{labels.empty}</p>
          ) : (
            filtered.map((place) => {
              const Icon = TYPE_ICON[place.type];
              return (
                <button
                  key={`${place.type}-${place.id}`}
                  type="button"
                  onClick={() => onSelect(place)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-[var(--radius-button)] px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5",
                  )}
                >
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", TYPE_COLOR[place.type])}>
                    <Icon size={14} />
                  </span>
                  {place.label}
                </button>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
