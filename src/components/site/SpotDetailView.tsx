"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  Star,
  Phone,
  Globe,
  Mail,
  Navigation,
  CreditCard,
  CalendarCheck,
  Car,
} from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { CategoryBadge } from "./CategoryBadge";
import { HoursBadge } from "./HoursBadge";
import { PhotoGallery } from "./PhotoGallery";
import { PhotoLightbox } from "./PhotoLightbox";
import { ShareMenu } from "./ShareMenu";
import { MiniMap } from "./MiniMap";
import { ExploreMapCard } from "./ExploreMapCard";
import { NearbySection } from "./NearbySection";
import { ArticleCard } from "./ArticleCard";
import { EASE_OUT } from "./motion";
import { Button } from "@/components/ui/Button";
import { CATEGORY_META } from "@/lib/categories";
import { DAY_KEYS } from "@/lib/types/database";
import type { Article, EventRow, Spot } from "@/lib/types/database";
import { formatDaySlots } from "@/lib/hours";
import { getSpotImage } from "@/lib/data/categoryImages";

/** Full public detail page for a spot — gallery, story, hours, contact & directions.
 * `onBack`, when given, replaces the default "back to home" link with a button
 * that calls it instead — used by the admin preview, where a real navigation
 * would exit the editor for an unsaved draft. `nearbySpots`/`nearbyEvents`
 * feed the "keep browsing" rails at the bottom; both default to empty so the
 * admin preview (which has nothing to recommend) can omit them. `articles`
 * are the published articles whose body links to this spot (its `spot_refs`,
 * see getArticlesForSpot) — the inverse of the "places mentioned" map on the
 * article page; defaults to empty for the same reason as the rails above. */
export function SpotDetailView({
  spot,
  nearbySpots = [],
  nearbyEvents = [],
  articles = [],
  onBack,
}: {
  spot: Spot;
  nearbySpots?: Spot[];
  nearbyEvents?: EventRow[];
  articles?: Article[];
  onBack?: () => void;
}) {
  const t = useTranslations("spot");
  const td = useTranslations("spotDetail");
  const th = useTranslations("hours");
  const locale = useLocale();
  const router = useRouter();

  const photos =
    spot.photos.length > 0 ? spot.photos : [{ url: getSpotImage(spot), caption: spot.name }];
  const [hero, ...rest] = photos;
  const [heroLightboxOpen, setHeroLightboxOpen] = useState(false);

  // Next.js only scrolls to top on navigation when the new page isn't
  // already visible in the viewport — from a scrolled-down card in the
  // list, the detail page counts as "visible", so it opens at the same
  // scroll offset instead of the top. Force it explicitly, re-running
  // whenever the viewed spot changes (not just on first mount).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [spot.id]);

  const directions = () =>
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${spot.latitude},${spot.longitude}`,
      "_blank",
    );

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

        <button
          type="button"
          onClick={() => setHeroLightboxOpen(true)}
          aria-label={hero.caption ?? spot.name}
          className="relative block aspect-[16/10] w-full overflow-hidden rounded-[var(--radius-card)] sm:aspect-[21/9]"
        >
          <Image
            src={hero.url}
            alt={hero.caption ?? spot.name}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        </button>

        <AnimatePresence>
          {heroLightboxOpen && (
            <PhotoLightbox
              photos={photos}
              startIndex={0}
              altBase={spot.name}
              onClose={() => setHeroLightboxOpen(false)}
            />
          )}
        </AnimatePresence>
      </motion.div>

      <div className="mt-6 grid gap-8 lg:mt-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <CategoryBadge category={spot.category} />
                <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">{spot.name}</h1>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {spot.rating && (
                    <span className="flex items-center gap-1 font-semibold">
                      <Star size={15} className="fill-gold-dark text-gold-dark dark:fill-gold dark:text-gold" />
                      {spot.rating.toFixed(1)}
                      {spot.review_count ? (
                        <span className="font-normal text-foreground/50">
                          ({spot.review_count})
                        </span>
                      ) : null}
                    </span>
                  )}
                  {spot.price_range && (
                    <span className="font-semibold text-foreground/60">{spot.price_range}</span>
                  )}
                  {spot.is_verified && (
                    <span className="font-semibold text-lime-dark dark:text-lime">
                      {t("verified")}
                    </span>
                  )}
                </div>
              </div>
              <HoursBadge spot={spot} className="shrink-0" />
            </div>

            {spot.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {spot.tags.map((tag) => (
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

          {spot.article && (
            <div
              className="prose prose-sm max-w-none text-[15px] leading-relaxed text-foreground/80 dark:prose-invert prose-a:text-aqua prose-a:no-underline prose-a:font-semibold prose-img:rounded-[var(--radius-button)]"
              dangerouslySetInnerHTML={{ __html: spot.article }}
            />
          )}

          <div className="grid gap-3 rounded-[var(--radius-card)] border border-border p-5 text-sm">
            <h2 className="font-heading font-bold">{th("weekSchedule")}</h2>
            <ul className="space-y-1.5">
              {DAY_KEYS.map((day) => (
                <li key={day} className="flex justify-between gap-4">
                  <span className="text-foreground/60">{th(`days.${day}`)}</span>
                  <span className="font-medium">{formatDaySlots(spot[`hours_${day}`], locale)}</span>
                </li>
              ))}
            </ul>
            {spot.hours_note && (
              <p className="border-t border-border pt-2 text-xs text-foreground/60">
                {th("note")}: {spot.hours_note}
              </p>
            )}
          </div>

          <div>
            <h2 className="font-heading mb-3 font-bold">{td("amenities")}</h2>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground/70">
              {spot.parking && (
                <span className="flex items-center gap-1.5">
                  <Car size={15} /> {t(`parking.${spot.parking}`)}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <CreditCard size={15} />
                {spot.accepts_cards ? t("acceptsCards") : t("cashOnly")}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarCheck size={15} />
                {spot.reservation_required ? t("reservationRequired") : t("reservationNotRequired")}
              </span>
            </div>
            {spot.dietary_options.length > 0 && (
              <p className="mt-2 text-sm text-foreground/70">
                <span className="font-semibold text-foreground/50">{t("dietary")}: </span>
                {spot.dietary_options.join(", ")}
              </p>
            )}
          </div>
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <MiniMap
            name={spot.name}
            latitude={spot.latitude}
            longitude={spot.longitude}
            color={CATEGORY_META[spot.category].color}
          />

          <ExploreMapCard />

          {(spot.phone || spot.website || spot.email) && (
            <div className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-5">
              {spot.phone && (
                <a href={`tel:${spot.phone}`} className="flex items-center gap-2 text-sm text-foreground/70">
                  <Phone size={15} /> {spot.phone}
                </a>
              )}
              {spot.website && (
                <a
                  href={spot.website.startsWith("http") ? spot.website : `https://${spot.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-foreground/70"
                >
                  <Globe size={15} /> {spot.website}
                </a>
              )}
              {spot.email && (
                <a href={`mailto:${spot.email}`} className="flex items-center gap-2 text-sm text-foreground/70">
                  <Mail size={15} /> {spot.email}
                </a>
              )}
            </div>
          )}

          <div className="hidden gap-2 sm:flex">
            {spot.phone && (
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                onClick={() => (window.location.href = `tel:${spot.phone}`)}
              >
                <Phone size={16} /> {t("call")}
              </Button>
            )}
            <ShareMenu title={spot.name} variant="coral" showLabel className="flex-1" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={directions}
              aria-label={t("getDirections")}
              title={t("getDirections")}
            >
              <Navigation size={16} />
            </Button>
          </div>
        </aside>
      </div>

      {rest.length > 0 && (
        <div className="mt-10 lg:mt-14">
          <h2 className="font-heading mb-3 text-xl font-bold">{td("gallery")}</h2>
          <PhotoGallery photos={rest} alt={spot.name} />
        </div>
      )}

      {articles.length > 0 && (
        <div className="mt-10 lg:mt-14">
          <h2 className="font-heading mb-3 text-xl font-bold">{td("featuredIn")}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onClick={() =>
                  router.push({ pathname: "/articles/[slug]", params: { slug: article.slug } })
                }
              />
            ))}
          </div>
        </div>
      )}

      <NearbySection nearbySpots={nearbySpots} nearbyEvents={nearbyEvents} />

      {/* Mobile sticky action bar */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-border bg-surface p-3 sm:hidden">
        {spot.phone && (
          <Button
            type="button"
            variant="primary"
            className="flex-1"
            onClick={() => (window.location.href = `tel:${spot.phone}`)}
          >
            <Phone size={16} /> {t("call")}
          </Button>
        )}
        <ShareMenu title={spot.name} direction="up" variant="coral" showLabel className="flex-1" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={directions}
          aria-label={t("getDirections")}
          title={t("getDirections")}
        >
          <Navigation size={16} />
        </Button>
      </div>
    </div>
  );
}
