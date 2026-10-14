"use client";

import { useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import {
  X,
  Mail,
  MapPin,
  Navigation,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CreditCard,
  CalendarCheck,
  Car,
  ImageOff,
  MessageCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CategoryBadge } from "./CategoryBadge";
import { HoursBadge } from "./HoursBadge";
import { LoadingImage } from "./LoadingImage";
import { ShareMenu } from "./ShareMenu";
import { MiniMap } from "./MiniMap";
import { EASE_OUT } from "./motion";
import { Button } from "@/components/ui/Button";
import { DAY_KEYS } from "@/lib/types/database";
import type { Spot } from "@/lib/types/database";
import { formatDaySlots } from "@/lib/hours";
import { getSpotPhotos } from "@/lib/data/categoryImages";
import { panamaWhatsAppUrl } from "@/lib/phone";
import { track } from "@/lib/analytics/track";
import { markContentEngaged } from "@/lib/pwaEngagement";

export function SpotDetailModal({
  spot,
  onClose,
}: {
  spot: Spot;
  onClose: () => void;
}) {
  const t = useTranslations("spot");
  const th = useTranslations("hours");
  const locale = useLocale();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoursOpen, setHoursOpen] = useState(false);

  const photos = getSpotPhotos(spot);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  // Opening a spot's detail modal (e.g. tapping a pin on the map) is just as
  // much "consulting content" as visiting its full page — see SpotDetailView.
  useEffect(() => {
    markContentEngaged();
  }, [spot.id]);

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

  const copyAddress = () => {
    if (!spot.address) return;
    navigator.clipboard.writeText(spot.address);
    toast.success(th("note") ? t("addressCopied") : "Copied");
  };

  const directions = () => {
    track("directions_click", { entity: "spot", entity_id: spot.id, entity_slug: spot.slug });
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${spot.latitude},${spot.longitude}`,
      "_blank",
    );
  };

  const whatsappUrl = panamaWhatsAppUrl(spot.phone);
  const openWhatsApp = () => {
    track("whatsapp_click", { spot_id: spot.id, spot_slug: spot.slug });
    window.open(whatsappUrl!, "_blank");
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
          aria-label={t("close")}
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
        >
          <X size={18} />
        </button>

        <div className="overflow-y-auto">
          <div className="relative aspect-[16/10] w-full bg-gradient-to-br from-aqua/20 to-coral/20">
            {photos.length > 0 ? (
              <>
                <div className="h-full overflow-hidden" ref={emblaRef}>
                  <div className="flex h-full">
                    {photos.map((photo, i) => (
                      <div key={i} className="relative h-full min-w-0 flex-[0_0_100%]">
                        <LoadingImage
                          src={photo.url}
                          alt={photo.caption ?? spot.name}
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
                <ImageOff size={40} className="text-foreground/25" />
              </div>
            )}
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CategoryBadge category={spot.category} />
                <h2 className="font-heading text-2xl font-extrabold">{spot.name}</h2>
                <div className="flex items-center gap-3 text-sm">
                  {spot.price_range && (
                    <span className="text-foreground/60 font-semibold">
                      {spot.price_range}
                    </span>
                  )}
                  {spot.is_verified && (
                    <span className="text-lime-readable font-semibold">
                      {t("verified")}
                    </span>
                  )}
                </div>
              </div>
              <HoursBadge spot={spot} className="shrink-0" />
            </div>

            {spot.article && (
              <div
                className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground/80 prose-a:text-aqua prose-a:no-underline prose-a:font-semibold prose-img:rounded-[var(--radius-button)]"
                dangerouslySetInnerHTML={{ __html: spot.article }}
              />
            )}

            {/* Collapsed by default — the HoursBadge up top already answers
                "is it open right now", so the full week table is one tap
                away instead of pushing the map/address/contact below it
                down inside an already-scrollable modal. */}
            <div className="rounded-xl border border-border p-4 text-sm">
              <button
                type="button"
                onClick={() => setHoursOpen((open) => !open)}
                aria-expanded={hoursOpen}
                aria-controls="week-schedule-panel-modal"
                className="font-heading flex w-full items-center justify-between font-bold"
              >
                {th("weekSchedule")}
                <motion.span
                  animate={{ rotate: hoursOpen ? 180 : 0 }}
                  transition={{ duration: 0.4, ease: EASE_OUT }}
                  className="text-foreground/40"
                >
                  <ChevronDown size={16} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {hoursOpen && (
                  <motion.div
                    key="content"
                    id="week-schedule-panel-modal"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      height: { duration: 0.4, ease: EASE_OUT },
                      opacity: { duration: 0.25, ease: EASE_OUT, delay: hoursOpen ? 0.05 : 0 },
                    }}
                    className="overflow-hidden"
                  >
                    <motion.ul
                      variants={{ show: { transition: { staggerChildren: 0.03, delayChildren: 0.08 } } }}
                      initial="hidden"
                      animate="show"
                      className="mt-3 space-y-1"
                    >
                      {DAY_KEYS.map((day) => (
                        <motion.li
                          key={day}
                          variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                          transition={{ duration: 0.25, ease: EASE_OUT }}
                          className="flex justify-between gap-4"
                        >
                          <span className="text-foreground/60">{th(`days.${day}`)}</span>
                          <span className="font-medium">
                            {formatDaySlots(spot[`hours_${day}`], locale)}
                          </span>
                        </motion.li>
                      ))}
                    </motion.ul>
                    {spot.hours_note && (
                      <p className="text-xs text-foreground/60 mt-3 pt-1 border-t border-border">
                        {th("note")}: {spot.hours_note}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <MiniMap
              name={spot.name}
              latitude={spot.latitude}
              longitude={spot.longitude}
              onGetDirections={directions}
            />

            <div className="grid gap-2 text-sm">
              {spot.address && (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-foreground/70">
                    <MapPin size={15} /> {spot.address}
                  </span>
                  <button
                    onClick={copyAddress}
                    className="text-aqua-readable text-xs font-semibold shrink-0"
                  >
                    {t("copyAddress")}
                  </button>
                </div>
              )}
              {spot.email && (
                <a href={`mailto:${spot.email}`} className="flex items-center gap-2 text-foreground/70">
                  <Mail size={15} /> {spot.email}
                </a>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-foreground/70">
                {spot.parking && (
                  <span className="flex items-center gap-1.5">
                    <Car size={14} /> {t(`parking.${spot.parking}`)}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <CreditCard size={14} />
                  {spot.accepts_cards ? t("acceptsCards") : t("cashOnly")}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarCheck size={14} />
                  {spot.reservation_required
                    ? t("reservationRequired")
                    : t("reservationNotRequired")}
                </span>
              </div>
              {spot.dietary_options.length > 0 && (
                <div className="pt-1">
                  <span className="text-xs font-semibold text-foreground/50">
                    {t("dietary")}:{" "}
                  </span>
                  <span className="text-xs">{spot.dietary_options.join(", ")}</span>
                </div>
              )}
            </div>

            {spot.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {spot.tags.map((tag) => (
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
          {whatsappUrl && (
            <Button variant="whatsapp" className="flex-1" onClick={openWhatsApp}>
              <MessageCircle size={16} /> {t("whatsapp")}
            </Button>
          )}
          <Button variant="outline" className="flex-1" onClick={directions}>
            <Navigation size={16} /> {t("getDirections")}
          </Button>
          <ShareMenu
            title={spot.name}
            direction="up"
            variant="primary"
            size="icon"
            entity={{ type: "spot", id: spot.id, slug: spot.slug }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
