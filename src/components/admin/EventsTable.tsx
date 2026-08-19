"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { Search, Pencil, Trash2, Repeat, Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/Field";
import { deleteEvent } from "@/lib/actions/events";
import { EVENT_CATEGORY_META } from "@/lib/eventCategories";
import type { EventRow } from "@/lib/types/database";

export function EventsTable({ events: initialEvents }: { events: EventRow[] }) {
  const t = useTranslations("admin.events");
  const tCat = useTranslations("events.recurring");
  const tEventCat = useTranslations("eventCategory");
  const [events, setEvents] = useState(initialEvents);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? events.filter((e) => e.title.toLowerCase().includes(q)) : events;
  }, [events, query]);

  const handleDelete = (event: EventRow) => {
    if (!confirm(`Delete "${event.title}"?`)) return;
    startTransition(async () => {
      const res = await deleteEvent(event.id);
      if (res.error) toast.error(res.error);
      else {
        setEvents((prev) => prev.filter((e) => e.id !== event.id));
        toast.success("Deleted");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          className="pl-10"
        />
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-foreground/50">
              <th className="px-4 py-3">{t("columns.title")}</th>
              <th className="px-4 py-3">{t("columns.category")}</th>
              <th className="px-4 py-3">{t("columns.date")}</th>
              <th className="px-4 py-3">{t("columns.recurring")}</th>
              <th className="px-4 py-3 text-right">{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((event) => (
              <tr key={event.id} className="border-b border-border last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-semibold">{event.title}</td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: EVENT_CATEGORY_META[event.category].color }}
                  >
                    <Image
                      src={EVENT_CATEGORY_META[event.category].icon}
                      alt=""
                      width={14}
                      height={14}
                    />
                    {tEventCat(event.category)}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground/70">
                  {event.date} · {event.time_start}
                </td>
                <td className="px-4 py-3">
                  {event.recurring && event.recurring !== "once" && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-aqua-dark dark:text-aqua">
                      <Repeat size={12} /> {tCat(event.recurring)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={{ pathname: "/events/[slug]", params: { slug: event.slug } }}
                      target="_blank"
                      className="rounded-lg p-2 text-foreground/50 hover:bg-black/5 dark:hover:bg-white/5"
                      title={t("view")}
                    >
                      <Eye size={15} />
                    </Link>
                    <Link
                      href={{ pathname: "/admin/events/[id]", params: { id: event.id } }}
                      className="rounded-lg p-2 text-aqua-dark hover:bg-aqua/10"
                    >
                      <Pencil size={15} />
                    </Link>
                    <button
                      onClick={() => handleDelete(event)}
                      disabled={pending}
                      className="rounded-lg p-2 text-coral hover:bg-coral/10 disabled:opacity-40"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-foreground/50">
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
