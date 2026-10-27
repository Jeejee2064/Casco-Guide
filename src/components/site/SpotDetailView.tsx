"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronDown,
  Mail,
  MapPin,
  CreditCard,
  CalendarCheck,
  Car,
  MessageCircle,
  Building2,
  Map as MapIcon,
  Rocket,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { CategoryBadge } from "./CategoryBadge";
import { HoursBadge } from "./HoursBadge";
import { LoadingImage } from "./LoadingImage";
import { PhotoGallery } from "./PhotoGallery";
import { PhotoLightbox } from "./PhotoLightbox";
import { ShareMenu } from "./ShareMenu";
import { buildShareText } from "@/lib/shareText";
import { absoluteUrl, shareImageUrl } from "@/lib/seo/site";
import type { Locale } from "@/i18n/routing";
import { MiniMap } from "./MiniMap";
import { GetMeThereCard } from "./GetMeThereCard";
import { NearbySection } from "./NearbySection";
import { SpotCard } from "./SpotCard";
import { ArticleCard } from "./ArticleCard";
import { Stagger, StaggerItem, fadeUp, EASE_OUT } from "./motion";
import { Button, buttonVariants } from "@/components/ui/Button";
import { showsPriceRange } from "@/lib/categories";
import { VIBE_META } from "@/lib/vibes";
import { DAY_KEYS } from "@/lib/types/database";
import type { Article, EventRow, Spot } from "@/lib/types/database";
import { formatDaySlots } from "@/lib/hours";
import { getSpotPhotos } from "@/lib/data/categoryImages";
import { panamaWhatsAppUrl } from "@/lib/phone";
import { track } from "@/lib/analytics/track";
import { markContentEngaged } from "@/lib/pwaEngagement";
import { useSmartBack } from "@/lib/useSmartBack";
import { setLastKnownUserLocation } from "@/lib/userLocation";
import { useHeaderHeight } from "./useHeaderHeight";

/** Full public detail page for a spot — gallery, story, hours, contact & directions.
 * `onBack`, when given, replaces the default "back to home" link with a button
 * that calls it instead — used by the admin preview, where a real navigation
 * would exit the editor for an unsaved draft. `nearbySpots`/`nearbyEvents`
 * feed the "keep browsing" rails at the bottom — despite the prop name,
 * `nearbySpots` here holds category/vibe-matched picks, not proximity ones
 * (see getRelatedSpots and NearbySection's `spotsAreNearby`); both default
 * to empty so the admin preview (which has nothing to recommend) can omit
 * them. `articles`
 * are the published articles whose body links to this spot (its `spot_refs`,
 * see getArticlesForSpot) — the inverse of the "places mentioned" map on the
 * article page; defaults to empty for the same reason as the rails above.
 * `parentSpot`/`childSpots` reflect the hub relationship (see parent_id in
 * lib/types/database.ts) — a spot has at most one of the two set: `parentSpot`
 * when this page is one of several businesses inside a hub, `childSpots` when
 * this page *is* the hub. Both default to empty/null for an ordinary
 * standalone spot. */
export function SpotDetailView({
  spot,
  nearbySpots = [],
  nearbyEvents = [],
  articles = [],
  parentSpot = null,
  childSpots = [],
  onBack,
}: {
  spot: Spot;
  nearbySpots?: Spot[];
  nearbyEvents?: EventRow[];
  articles?: Article[];
  parentSpot?: Spot | null;
  childSpots?: Spot[];
  onBack?: () => void;
}) {
  const t = useTranslations("spot");
  const tShare = useTranslations("share");
  const tDiscover = useTranslations("discover");
  const tShareCategory = useTranslations("category");
  const td = useTranslations("spotDetail");
  const th = useTranslations("hours");
  const tVibe = useTranslations("vibe");
  const locale = useLocale();
  const shareText = buildShareText({
    name: spot.name,
    description: spot.description,
    fallback: tShare("hookSpot", { category: tShareCategory(spot.category) }),
  });
  const shareUrl = absoluteUrl(`/${locale}/spots/${spot.slug}`);
  const previewImage = shareImageUrl("spots", spot.slug, locale as Locale, spot.updated_at);
  const router = useRouter();
  const goBack = useSmartBack();
  // Sits in normal flow (so it never covers the title on a page with no
  // hero photo) until scrolling carries it up to `headerHeight`, at which
  // point `sticky` pins it just below the site header — same "starts in
  // flow, sticks below the header" contract as the sidebar's `lg:sticky
  // lg:top-24` further down, just closer in since this is a small pill,
  // not a boxy card.
  const headerHeight = useHeaderHeight(true);

  const photos = getSpotPhotos(spot);
  const [hero, ...rest] = photos;
  const [heroLightboxOpen, setHeroLightboxOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  // Gates the reveal of everything below the hero photo — rather than
  // fading the whole page in on a timer, we wait for the actual image
  // `onLoad` and chain the rest of the page off of it (see Stagger's
  // `show`/`delay`), so the sequence always matches what's really on
  // screen instead of guessing how long the photo takes to arrive.
  const [heroLoaded, setHeroLoaded] = useState(false);

  // Next.js only scrolls to top on navigation when the new page isn't
  // already visible in the viewport — from a scrolled-down card in the
  // list, the detail page counts as "visible", so it opens at the same
  // scroll offset instead of the top. Force it explicitly, re-running
  // whenever the viewed spot changes (not just on first mount).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [spot.id]);

  // Skip the admin form's live inline preview (`onBack` set — see the
  // doc comment above) — an in-progress unsaved draft isn't a real visit.
  useEffect(() => {
    if (onBack) return;
    track("spot_view", { spot_id: spot.id, spot_slug: spot.slug, category: spot.category });
    markContentEngaged();
  }, [spot.id, spot.slug, spot.category, onBack]);

  const directions = () => {
    track("directions_click", { entity: "spot", entity_id: spot.id, entity_slug: spot.slug });
    // The admin preview (`onBack` set — see this component's doc comment)
    // has nothing real to route to on /map (an unsaved draft may not even
    // have a slug in the database yet), so it keeps the old Google Maps
    // hand-off rather than navigating the editor away from its own preview.
    if (onBack) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${spot.latitude},${spot.longitude}`,
        "_blank",
      );
      return;
    }
    // Prime the location permission prompt right here, from this click's own
    // user gesture, instead of waiting for SpotMap's itinerary mode to ask
    // for it once it mounts after the navigation below — that would make the
    // very first "where am I" prompt show up late, after the map's already
    // loaded, and stall the route on "Locating…" until it's answered.
    // SpotMap requests its own (by then either already-granted or instant)
    // fix once it's up; this one's result is cached for MiniMap et al. (see
    // lib/userLocation.ts) rather than discarded.
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setLastKnownUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        () => {},
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }
    // Real visitors get walking directions drawn straight onto our own map
    // instead — see MapExplorerSection/SpotMap's itinerary mode. `trackClick:
    // false` there skips a second directions_click for the one just above.
    router.push({ pathname: "/map", query: { directions: spot.slug } });
  };

  const whatsappUrl = panamaWhatsAppUrl(spot.phone);
  const openWhatsApp = () => {
    track("whatsapp_click", { spot_id: spot.id, spot_slug: spot.slug });
    window.open(whatsappUrl!, "_blank");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:py-10 sm:pb-10">
      <button
        type="button"
        onClick={onBack ?? goBack}
        aria-label={td("back")}
        style={{ top: (headerHeight ?? 56) + 16 }}
        className="glass pill-lift fixed left-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground/70 shadow-[var(--shadow-sm)] hover:text-foreground sm:sticky sm:left-auto sm:mb-4"
      >
        <ChevronLeft size={20} />
      </button>

      {/* The hero itself fades in on mount, same as any other section — it's
          LoadingImage's own skeleton/tower mark that carries the "still
          loading" state, so this container needs to be visible right away
          for that to show. Everything below (see the Stagger further down)
          waits on the photo's actual load instead, so the page never
          reveals *that* content before there's a photo to go with it. */}
      <motion.div
        className="relative aspect-[16/10] w-full overflow-hidden rounded-[var(--radius-card)] sm:aspect-[21/9] lg:aspect-auto lg:h-72"
        initial="hidden"
        animate="show"
        variants={fadeUp}
      >
        <button
          type="button"
          onClick={() => setHeroLightboxOpen(true)}
          aria-label={hero.caption ?? spot.name}
          className="block h-full w-full"
        >
          <LoadingImage
            src={hero.url}
            alt={hero.caption ?? spot.name}
            sizes="100vw"
            className="object-cover"
            preload
            onLoad={() => setHeroLoaded(true)}
          />
        </button>
      </motion.div>

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

      <div className="mt-6 grid gap-8 lg:mt-10 lg:grid-cols-[1fr_360px]">
        <Stagger className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-1" show={heroLoaded} delay={0.15}>
          <StaggerItem>
            {parentSpot && (
              <button
                type="button"
                onClick={() =>
                  router.push({ pathname: "/spots/[slug]", params: { slug: parentSpot.slug } })
                }
                className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-aqua-dark hover:underline"
              >
                <Building2 size={14} /> {t("partOf", { name: parentSpot.name })}
              </button>
            )}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <CategoryBadge category={spot.category} />
                <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">{spot.name}</h1>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {spot.price_range && showsPriceRange(spot.category) && (
                    <span className="font-semibold text-foreground/60">{spot.price_range}</span>
                  )}
                  {spot.is_verified && (
                    <span className="font-semibold text-lime-readable">
                      {t("verified")}
                    </span>
                  )}
                </div>
                {/* Surfaced here, not just in the sidebar map/CTA further
                    down — "how do I get there" should read at a glance from
                    the top of the page, same as price/hours, instead
                    of only after scrolling past the story and hours table. */}
                {spot.address && (
                  <p className="flex items-center gap-1.5 text-sm text-foreground/60">
                    <MapPin size={14} className="shrink-0" /> {spot.address}
                  </p>
                )}
              </div>
              <HoursBadge spot={spot} className="shrink-0" />
            </div>

            {spot.vibes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {spot.vibes.map((v) => {
                  const meta = VIBE_META[v];
                  const Icon = meta.icon;
                  const gradient = `linear-gradient(135deg, ${meta.color}, color-mix(in srgb, ${meta.color} 68%, black))`;
                  const cls =
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold leading-none text-white shadow-sm sm:min-h-8 sm:px-3 sm:text-xs";
                  const content = (
                    <>
                      <Icon size={12} className="shrink-0" />
                      <span>{tVibe(v)}</span>
                    </>
                  );
                  // Admin preview (onBack) must not navigate away from the editor.
                  return onBack ? (
                    <span key={v} className={cls} style={{ background: gradient }}>
                      {content}
                    </span>
                  ) : (
                    <Link
                      key={v}
                      href={{ pathname: "/map", query: { vibe: v } }}
                      className={`${cls} transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground`}
                      style={{ background: gradient }}
                    >
                      {content}
                    </Link>
                  );
                })}
              </div>
            )}

            {spot.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {spot.tags.map((tag) => {
                  const cls =
                    "inline-flex min-h-9 items-center rounded-full bg-foreground/5 px-3.5 py-1.5 text-sm font-medium text-foreground/70 sm:min-h-8 sm:px-3 sm:text-xs";
                  return onBack ? (
                    <span key={tag} className={cls}>
                      #{tag}
                    </span>
                  ) : (
                    <Link
                      key={tag}
                      href={{ pathname: "/spots", query: { mode: "classic", q: tag } }}
                      className={`${cls} transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground`}
                    >
                      #{tag}
                    </Link>
                  );
                })}
              </div>
            )}
          </StaggerItem>

          {childSpots.length > 0 && (
            <StaggerItem>
              <h2 className="font-heading mb-3 text-lg font-bold">{td("placesHere")}</h2>
              <Stagger className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
                {childSpots.map((child) => (
                  <StaggerItem key={child.id} className="w-[240px] shrink-0 sm:w-[260px]">
                    <SpotCard
                      spot={child}
                      onClick={() =>
                        router.push({ pathname: "/spots/[slug]", params: { slug: child.slug } })
                      }
                    />
                  </StaggerItem>
                ))}
              </Stagger>
            </StaggerItem>
          )}

          {spot.article && (
            <StaggerItem>
              <div
                className="prose prose-sm max-w-none text-[15px] leading-relaxed text-foreground/80 prose-a:text-aqua prose-a:no-underline prose-a:font-semibold prose-img:rounded-[var(--radius-button)]"
                dangerouslySetInnerHTML={{ __html: spot.article }}
              />
            </StaggerItem>
          )}

          <StaggerItem>
            {/* Collapsed by default — the HoursBadge up top already answers
                "is it open right now", so the full 7-day table is detail
                worth one tap to expand, not something everyone has to
                scroll past to reach the map/contact info below. */}
            <div className="rounded-[var(--radius-card)] border border-border p-5 text-sm">
              <button
                type="button"
                onClick={() => setHoursOpen((open) => !open)}
                aria-expanded={hoursOpen}
                aria-controls="week-schedule-panel"
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
                    id="week-schedule-panel"
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
                      className="mt-3 space-y-1.5"
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
                      <p className="mt-3 border-t border-border pt-2 text-xs text-foreground/60">
                        {th("note")}: {spot.hours_note}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </StaggerItem>

          <StaggerItem>
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
          </StaggerItem>
        </Stagger>

        {/* Between the story and the sidebar map in DOM order, so on mobile
            (single column) the gallery comes before the map. On desktop the
            explicit grid placement keeps it full-width under both columns. */}
        {rest.length > 0 && (
          <Stagger className="min-w-0 lg:col-span-2 lg:row-start-2 lg:mt-6">
            <StaggerItem>
              <h2 className="font-heading mb-3 text-xl font-bold">{td("gallery")}</h2>
            </StaggerItem>
            <StaggerItem>
              <PhotoGallery photos={rest} alt={spot.name} />
            </StaggerItem>
          </Stagger>
        )}

        {/* Sticky's containing block is the grid container, not the grid
            area, so a bare sticky aside would slide down over the gallery
            row. This wrapper stretches over row 1 only and bounds it. */}
        <div className="lg:col-start-2 lg:row-start-1">
        <aside className="h-fit lg:sticky lg:top-24">
          <Stagger className="space-y-4" show={heroLoaded} delay={0.15}>
            <StaggerItem>
              <MiniMap
                name={spot.name}
                latitude={spot.latitude}
                longitude={spot.longitude}
                onGetDirections={directions}
              />
            </StaggerItem>

            <StaggerItem>
              <GetMeThereCard onClick={directions} />
            </StaggerItem>

            {spot.email && (
              <StaggerItem>
                <div className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-5">
                  <a href={`mailto:${spot.email}`} className="flex items-center gap-2 text-sm text-foreground/70">
                    <Mail size={15} /> {spot.email}
                  </a>
                </div>
              </StaggerItem>
            )}

            <StaggerItem>
              {/* Phone/website intentionally not displayed here — WhatsApp
                  (when available) and Directions are the two actions
                  people actually need, so they get the full labeled,
                  flex-1 treatment, with Share alongside as an icon-only
                  utility. */}
              <div className="hidden gap-2 sm:flex">
                {whatsappUrl && (
                  <Button type="button" variant="whatsapp" className="flex-1" onClick={openWhatsApp}>
                    <MessageCircle size={16} /> {t("whatsapp")}
                  </Button>
                )}
                <ShareMenu
                  title={spot.name}
                  text={shareText}
                  url={shareUrl}
                  previewImage={previewImage}
                  variant="primary"
                  size="lg"
                  showLabel
                  className="flex-1"
                  entity={{ type: "spot", id: spot.id, slug: spot.slug }}
                />
              </div>
            </StaggerItem>
          </Stagger>
        </aside>
        </div>
      </div>

      {articles.length > 0 && (
        <div className="mt-10 lg:mt-14">
          <h2 className="font-heading mb-3 text-xl font-bold">{td("featuredIn")}</h2>
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <StaggerItem key={article.id}>
                <ArticleCard
                  article={article}
                  onClick={() =>
                    router.push({ pathname: "/articles/[slug]", params: { slug: article.slug } })
                  }
                />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      )}

      <NearbySection
        nearbySpots={nearbySpots}
        nearbyEvents={nearbyEvents}
        origin={{ lat: spot.latitude, lng: spot.longitude }}
        spotsAreNearby={false}
      />

      {!onBack && (
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center lg:mt-14">
          <Link href="/map" className={buttonVariants({ variant: "primary", size: "lg" })}>
            <MapIcon size={18} /> {td("exploreMap")}
          </Link>
          <Link href="/spots" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <ChevronLeft size={18} /> {td("backToSpots")}
          </Link>
        </div>
      )}

      {/* Mobile sticky action bar — "Get me there!" takes the room, WhatsApp
          (when available) and Share are icon-only beside it. Opaque with an
          upward shadow and above the footer (see `.spot-action-bar` in
          globals.css, which pads the footer so it never ends up under it). */}
      <div className="spot-action-bar safe-bottom fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-border bg-surface p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] sm:hidden">
        <Button type="button" size="lg" className="brand-accent min-w-0 flex-1 px-4" onClick={directions}>
          <Rocket size={18} className="shrink-0" /> <span className="truncate">{tDiscover("getMeThere")}</span>
        </Button>
        {whatsappUrl && (
          <Button
            type="button"
            variant="whatsapp"
            size="lg"
            className="w-12 shrink-0 px-0"
            aria-label={t("whatsapp")}
            onClick={openWhatsApp}
          >
            <MessageCircle size={20} />
          </Button>
        )}
        <ShareMenu
          title={spot.name}
          text={shareText}
          url={shareUrl}
          previewImage={previewImage}
          direction="up"
          variant="outline"
          size="lg"
          className="w-12 shrink-0 [&>button]:w-full [&>button]:px-0"
          entity={{ type: "spot", id: spot.id, slug: spot.slug }}
        />
      </div>
    </div>
  );
}
