"use client";

import { useEffect, useCallback, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import {
  X,
  CalendarDays,
  Clock,
  MapPin,
  Repeat,
  Navigation,
  ChevronLeft,
  ChevronRight,
  Ticket,
  Users,
  ExternalLink,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { ShareMenu } from "./ShareMenu";
import { MiniMap } from "./MiniMap";
import { EVENT_CATEGORY_META } from "@/lib/eventCategories";
import { formatTime } from "@/lib/hours";
import { track } from "@/lib/analytics/track";
import { markContentEngaged } from "@/lib/pwaEngagement";
import type { EventRow } from "@/lib/types/database";

export function EventDetailModal({
  event,
  onClose,
}: {
  event: EventRow;
  onClose: () => void;
}) {
  const t = useTranslations("events");
  const tSpot = useTranslations("spot");
  const tCat = useTranslations("eventCategory");
  const locale = useLocale();
  const categoryMeta = EVENT_CATEGORY_META[event.category];
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const photos = event.photos.length > 0 ? event.photos : event.photo ? [{ url: event.photo }] : [];

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  // Opening an event's detail modal is just as much "consulting content" as
  // visiting its full page — see EventDetailView.
  useEffect(() => {
    markContentEngaged();
  }, [event.id]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const dateLabel = new Intl.DateTimeFormat(locale === "es" ? "es-PA" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${event.date}T00:00:00`));

  const copyAddress = () => {
    if (!event.address) return;
    navigator.clipboard.writeText(event.address);
    toast.success(tSpot("addressCopied"));
  };

  const openBooking = () => {
    track("event_booking_click", { event_id: event.id, event_slug: event.slug });
    window.open(event.booking_url!, "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: "100%", opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="relative flex h-full sm:h-auto sm:max-h-[90vh] w-full sm:max-w-2xl flex-col overflow-hidden bg-surface sm:rounded-[var(--radius-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label={tSpot("close")}
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
        >
          <X size={18} />
        </button>

        <div className="overflow-y-auto">
          <div className="relative aspect-[16/10] w-full bg-foreground/5">
            {photos.length > 0 ? (
              <>
                <div className="h-full overflow-hidden" ref={emblaRef}>
                  <div className="flex h-full">
                    {photos.map((photo, i) => (
                      <div key={i} className="relative h-full min-w-0 flex-[0_0_100%]">
                        <Image
                          src={photo.url}
                          alt={photo.caption ?? event.title}
                          fill
                          sizes="(max-width: 640px) 100vw, 640px"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={scrollPrev}
                      className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 hover:bg-white"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      onClick={scrollNext}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 hover:bg-white"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                      {photos.map((_, i) => (
                        <span
                          key={i}
                          className={`h-1.5 w-1.5 rounded-full ${
                            i === selectedIndex ? "bg-white" : "bg-white/40"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <Image src={categoryMeta.icon} alt={tCat(event.category)} width={56} height={56} />
              </div>
            )}
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            <div className="space-y-1.5">
              <span
                className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                style={{ backgroundColor: categoryMeta.color }}
              >
                {tCat(event.category)}
              </span>
              <h2 className="font-heading text-2xl font-extrabold">{event.title}</h2>
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
            </div>

            {event.article && (
              <div
                className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground/80 prose-a:text-aqua prose-a:no-underline prose-a:font-semibold prose-img:rounded-[var(--radius-button)]"
                dangerouslySetInnerHTML={{ __html: event.article }}
              />
            )}

            <MiniMap name={event.title} latitude={event.latitude} longitude={event.longitude} />

            <div className="grid gap-2 text-sm">
              {event.address && (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-foreground/70">
                    <MapPin size={15} /> {event.address}
                  </span>
                  <button
                    onClick={copyAddress}
                    className="text-aqua-readable text-xs font-semibold shrink-0"
                  >
                    {tSpot("copyAddress")}
                  </button>
                </div>
              )}
              {event.organizer && (
                <p className="flex items-center gap-2 text-foreground/70">
                  <Users size={15} /> {t("organizer", { name: event.organizer })}
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-foreground/70">
                <span className="flex items-center gap-1.5 font-semibold text-lime-readable">
                  <Ticket size={14} />
                  {event.price && event.price > 0 ? `$${event.price}` : t("free")}
                </span>
                {event.capacity != null && (
                  <span className="flex items-center gap-1.5">
                    <Users size={14} /> {t("capacity", { count: event.capacity })}
                  </span>
                )}
              </div>
            </div>

            {event.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {event.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-foreground/5 text-foreground/60 px-2.5 py-1 text-xs font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          {event.booking_url && (
            <Button
              variant="primary"
              className="flex-1"
              onClick={openBooking}
            >
              <ExternalLink size={16} /> {t("book")}
            </Button>
          )}
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              track("directions_click", {
                entity: "event",
                entity_id: event.id,
                entity_slug: event.slug,
              });
              window.open(
                `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`,
                "_blank",
              );
            }}
          >
            <Navigation size={16} /> {tSpot("getDirections")}
          </Button>
          <ShareMenu
            title={event.title}
            direction="up"
            variant="primary"
            size="icon"
            entity={{ type: "event", id: event.id, slug: event.slug }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
