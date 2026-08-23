"use client";

import { useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  CalendarDays,
  Clock,
  Repeat,
  Navigation,
  Ticket,
  Users,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PhotoGallery } from "./PhotoGallery";
import { ShareMenu } from "./ShareMenu";
import { MiniMap } from "./MiniMap";
import { ExploreMapCard } from "./ExploreMapCard";
import { NearbySection } from "./NearbySection";
import { EASE_OUT } from "./motion";
import { Button } from "@/components/ui/Button";
import { EVENT_CATEGORY_META } from "@/lib/eventCategories";
import { formatTime } from "@/lib/hours";
import { getSpotImage } from "@/lib/data/categoryImages";
import { track } from "@/lib/analytics/track";
import { markContentEngaged } from "@/lib/pwaEngagement";
import type { EventRow, Spot } from "@/lib/types/database";

/** Full public detail page for an event — gallery, story, ticketing & host venue.
 * `onBack`, when given, replaces the default "back to home" link with a button
 * that calls it instead — used by the admin preview, where a real navigation
 * would exit the editor for an unsaved draft. `nearbySpots`/`nearbyEvents`
 * feed the "keep browsing" rails at the bottom; both default to empty so the
 * admin preview (which has nothing to recommend) can omit them. */
export function EventDetailView({
  event,
  hostSpot,
  nearbySpots = [],
  nearbyEvents = [],
  onBack,
}: {
  event: EventRow;
  hostSpot: Spot | null;
  nearbySpots?: Spot[];
  nearbyEvents?: EventRow[];
  onBack?: () => void;
}) {
  const t = useTranslations("events");
  const td = useTranslations("eventDetail");
  const tSpot = useTranslations("spot");
  const tCat = useTranslations("eventCategory");
  const locale = useLocale();
  const categoryMeta = EVENT_CATEGORY_META[event.category];

  const photos = event.photos.length > 0 ? event.photos : event.photo ? [{ url: event.photo }] : [];

  const dateLabel = new Intl.DateTimeFormat(locale === "es" ? "es-PA" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${event.date}T00:00:00`));

  const directions = () => {
    track("directions_click", { entity: "event", entity_id: event.id, entity_slug: event.slug });
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`,
      "_blank",
    );
  };

  const priceLabel = event.price && event.price > 0 ? `$${event.price}` : t("free");

  const openBooking = () => {
    track("event_booking_click", { event_id: event.id, event_slug: event.slug });
    window.open(event.booking_url!, "_blank");
  };

  // Next.js only scrolls to top on navigation when the new page isn't
  // already visible in the viewport — from a scrolled-down card in the
  // list, the detail page counts as "visible", so it opens at the same
  // scroll offset instead of the top. Force it explicitly, re-running
  // whenever the viewed event changes (not just on first mount).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [event.id]);

  // Skip the admin form's live inline preview (`onBack` set — see the doc
  // comment above) — an in-progress unsaved draft isn't a real visit.
  useEffect(() => {
    if (onBack) return;
    track("event_view", { event_id: event.id, event_slug: event.slug });
    markContentEngaged();
  }, [event.id, event.slug, onBack]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:py-10 sm:pb-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
      >
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/60 hover:text-foreground"
          >
            <ChevronLeft size={16} /> {td("back")}
          </button>
        ) : (
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/60 hover:text-foreground"
          >
            <ChevronLeft size={16} /> {td("back")}
          </Link>
        )}

        <PhotoGallery
          photos={photos}
          alt={event.title}
          placeholder={
            <div
              className="flex h-full items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${categoryMeta.color}33, ${categoryMeta.color}0D)`,
              }}
            >
              <Image src={categoryMeta.icon} alt={tCat(event.category)} width={64} height={64} />
            </div>
          }
        />
      </motion.div>

      <div className="mt-6 grid gap-8 lg:mt-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <div className="space-y-2">
            <span
              className="inline-block rounded-full px-2.5 py-1 text-xs font-bold text-white"
              style={{ backgroundColor: categoryMeta.color }}
            >
              {tCat(event.category)}
            </span>
            <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">{event.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-foreground/70">
              <span className="flex items-center gap-1.5">
                <CalendarDays size={15} /> {dateLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={15} />
                {formatTime(event.time_start, locale)}
                {event.time_end ? ` – ${formatTime(event.time_end, locale)}` : ""}
              </span>
              {event.recurring && event.recurring !== "once" && (
                <span className="flex items-center gap-1.5">
                  <Repeat size={14} /> {t(`recurring.${event.recurring}`)}
                </span>
              )}
            </div>

            {event.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {event.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground/60"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {event.article && (
            <div
              className="prose prose-sm max-w-none text-[15px] leading-relaxed text-foreground/80 prose-a:text-aqua prose-a:no-underline prose-a:font-semibold prose-img:rounded-[var(--radius-button)]"
              dangerouslySetInnerHTML={{ __html: event.article }}
            />
          )}

          {hostSpot && (
            <Link
              href={{ pathname: "/spots/[slug]", params: { slug: hostSpot.slug } }}
              className="card-lift flex items-center gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4"
            >
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                <Image
                  src={getSpotImage(hostSpot)}
                  alt={hostSpot.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground/50">{td("hostedAt")}</p>
                <p className="font-heading font-bold truncate">{hostSpot.name}</p>
              </div>
              <ArrowRight size={18} className="shrink-0 text-foreground/40" />
            </Link>
          )}

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground/70">
            <span className="flex items-center gap-1.5 font-semibold text-lime-readable">
              <Ticket size={15} /> {priceLabel}
            </span>
            {event.capacity != null && (
              <span className="flex items-center gap-1.5">
                <Users size={15} /> {t("capacity", { count: event.capacity })}
              </span>
            )}
            {event.organizer && (
              <span className="flex items-center gap-1.5">
                <Users size={15} /> {t("organizer", { name: event.organizer })}
              </span>
            )}
          </div>
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <MiniMap name={event.title} latitude={event.latitude} longitude={event.longitude} />

          <ExploreMapCard />

          <div className="hidden gap-2 sm:flex">
            {event.booking_url && (
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                onClick={openBooking}
              >
                <ExternalLink size={16} /> {t("book")}
              </Button>
            )}
            <Button type="button" variant="outline" className="flex-1" onClick={directions}>
              <Navigation size={16} /> {tSpot("getDirections")}
            </Button>
            <ShareMenu title={event.title} variant="primary" size="icon" />
          </div>
        </aside>
      </div>

      <NearbySection nearbySpots={nearbySpots} nearbyEvents={nearbyEvents} />

      {/* Mobile sticky action bar */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-border bg-surface p-3 sm:hidden">
        {event.booking_url && (
          <Button
            type="button"
            variant="primary"
            className="flex-1"
            onClick={openBooking}
          >
            <ExternalLink size={16} /> {t("book")}
          </Button>
        )}
        <Button type="button" variant="outline" className="flex-1" onClick={directions}>
          <Navigation size={16} /> {tSpot("getDirections")}
        </Button>
        <ShareMenu title={event.title} direction="up" variant="primary" size="icon" />
      </div>
    </div>
  );
}
