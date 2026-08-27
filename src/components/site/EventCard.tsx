"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { CalendarDays, Repeat, Ticket } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatTime } from "@/lib/hours";
import { EVENT_CATEGORY_META } from "@/lib/eventCategories";
import { LoadingImage } from "./LoadingImage";
import { useRouter } from "@/i18n/navigation";
import type { EventRow } from "@/lib/types/database";

export function EventCard({ event }: { event: EventRow }) {
  const t = useTranslations("events");
  const tCat = useTranslations("eventCategory");
  const locale = useLocale();
  const router = useRouter();
  const categoryMeta = EVENT_CATEGORY_META[event.category];

  const dateLabel = new Intl.DateTimeFormat(locale === "es" ? "es-PA" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${event.date}T00:00:00`));

  const openDetail = () => {
    router.push({ pathname: "/events/[slug]", params: { slug: event.slug } });
  };

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail();
        }
      }}
      whileTap={{ scale: 0.98 }}
      className="card-lift flex cursor-pointer gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-3 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-aqua sm:p-4"
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-foreground/5 sm:h-24 sm:w-24">
        {event.photo ? (
          <LoadingImage src={event.photo} alt={event.title} sizes="96px" className="object-cover" iconClassName="h-6 w-6" />
        ) : (
          <div
            className="flex h-full items-center justify-center"
            style={{ backgroundColor: `${categoryMeta.color}1A` }}
          >
            <Image src={categoryMeta.icon} alt={tCat(event.category)} width={32} height={32} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 text-xs font-bold text-foreground/60">
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
            style={{ backgroundColor: categoryMeta.color }}
          >
            {tCat(event.category)}
          </span>
          <CalendarDays size={13} />
          {dateLabel} · {formatTime(event.time_start, locale)}
          {event.recurring && event.recurring !== "once" && (
            <span className="flex items-center gap-1 text-foreground/50 font-medium">
              <Repeat size={12} /> {t(`recurring.${event.recurring}`)}
            </span>
          )}
        </div>
        <h3 className="font-heading font-bold leading-tight line-clamp-1">{event.title}</h3>
        {event.description && (
          <p className="text-sm text-foreground/70 line-clamp-2">{event.description}</p>
        )}
        <div className="flex items-center gap-3 pt-1 text-xs font-semibold">
          <span className="flex items-center gap-1 text-lime-readable">
            <Ticket size={13} />
            {event.price && event.price > 0 ? `$${event.price}` : t("free")}
          </span>
          {event.booking_url && (
            <a
              href={event.booking_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-aqua-readable"
            >
              {t("book")}
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
