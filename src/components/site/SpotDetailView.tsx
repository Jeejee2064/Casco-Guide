"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronDown,
  Star,
  Mail,
  MapPin,
  Navigation,
  CreditCard,
  CalendarCheck,
  Car,
  MessageCircle,
  Building2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CategoryBadge } from "./CategoryBadge";
import { HoursBadge } from "./HoursBadge";
import { LoadingImage } from "./LoadingImage";
import { PhotoGallery } from "./PhotoGallery";
import { PhotoLightbox } from "./PhotoLightbox";
import { ShareMenu } from "./ShareMenu";
import { MiniMap } from "./MiniMap";
import { ExploreMapCard } from "./ExploreMapCard";
import { NearbySection } from "./NearbySection";
import { SpotCard } from "./SpotCard";
import { ArticleCard } from "./ArticleCard";
import { Stagger, StaggerItem, fadeUp } from "./motion";
import { Button } from "@/components/ui/Button";
import { VIBE_META } from "@/lib/vibes";
import { DAY_KEYS } from "@/lib/types/database";
import type { Article, EventRow, Spot } from "@/lib/types/database";
import { formatDaySlots } from "@/lib/hours";
import { getSpotImage } from "@/lib/data/categoryImages";
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
  const td = useTranslations("spotDetail");
  const th = useTranslations("hours");
  const tVibe = useTranslations("vibe");
  const locale = useLocale();
  const router = useRouter();
  const goBack = useSmartBack();
  // Sits in normal flow (so it never covers the title on a page with no
  // hero photo) until scrolling carries it up to `headerHeight`, at which
  // point `sticky` pins it just below the site header — same "starts in
  // flow, sticks below the header" contract as the sidebar's `lg:sticky
  // lg:top-24` further down, just closer in since this is a small pill,
  // not a boxy card.
  const headerHeight = useHeaderHeight(true);

  const photos =
    spot.photos.length > 0 ? spot.photos : [{ url: getSpotImage(spot), caption: spot.name }];
  const [hero, ...rest] = photos;
  const [heroLightboxOpen, setHeroLightboxOpen] = useState(false);
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
        className="glass pill-lift sticky z-30 mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground/70 shadow-[var(--shadow-sm)] hover:text-foreground"
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
        <Stagger className="space-y-8" show={heroLoaded} delay={0.15}>
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
                    <span className="font-semibold text-lime-readable">
                      {t("verified")}
                    </span>
                  )}
                </div>
                {/* Surfaced here, not just in the sidebar map/CTA further
                    down — "how do I get there" should read at a glance from
                    the top of the page, same as price/rating/hours, instead
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
              <div className="mt-3 flex flex-wrap gap-1.5">
                {spot.vibes.map((v) => {
                  const meta = VIBE_META[v];
                  const Icon = meta.icon;
                  const gradient = `linear-gradient(135deg, ${meta.color}, color-mix(in srgb, ${meta.color} 68%, black))`;
                  return (
                    <span
                      key={v}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                      style={{ background: gradient }}
                    >
                      <Icon size={12} /> {tVibe(v)}
                    </span>
                  );
                })}
              </div>
            )}

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
            <details className="group rounded-[var(--radius-card)] border border-border p-5 text-sm">
              <summary className="font-heading flex cursor-pointer list-none items-center justify-between font-bold [&::-webkit-details-marker]:hidden">
                {th("weekSchedule")}
                <ChevronDown
                  size={16}
                  className="text-foreground/40 transition-transform group-open:rotate-180"
                />
              </summary>
              <ul className="mt-3 space-y-1.5">
                {DAY_KEYS.map((day) => (
                  <li key={day} className="flex justify-between gap-4">
                    <span className="text-foreground/60">{th(`days.${day}`)}</span>
                    <span className="font-medium">{formatDaySlots(spot[`hours_${day}`], locale)}</span>
                  </li>
                ))}
              </ul>
              {spot.hours_note && (
                <p className="mt-3 border-t border-border pt-2 text-xs text-foreground/60">
                  {th("note")}: {spot.hours_note}
                </p>
              )}
            </details>
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

        <aside className="h-fit lg:sticky lg:top-24">
          <Stagger className="space-y-4" show={heroLoaded} delay={0.15}>
            <StaggerItem>
              <MiniMap name={spot.name} latitude={spot.latitude} longitude={spot.longitude} />
            </StaggerItem>

            <StaggerItem>
              <ExploreMapCard />
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
                <Button type="button" variant="outline" className="flex-1" onClick={directions}>
                  <Navigation size={16} /> {t("getDirections")}
                </Button>
                <ShareMenu
                  title={spot.name}
                  variant="primary"
                  size="icon"
                  entity={{ type: "spot", id: spot.id, slug: spot.slug }}
                />
              </div>
            </StaggerItem>
          </Stagger>
        </aside>
      </div>

      {rest.length > 0 && (
        <Stagger className="mt-10 lg:mt-14">
          <StaggerItem>
            <h2 className="font-heading mb-3 text-xl font-bold">{td("gallery")}</h2>
          </StaggerItem>
          <StaggerItem>
            <PhotoGallery photos={rest} alt={spot.name} />
          </StaggerItem>
        </Stagger>
      )}

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

      {/* Mobile sticky action bar — same Directions/WhatsApp-first layout
          as the desktop CTA row above. */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-border bg-surface p-3 sm:hidden">
        {whatsappUrl && (
          <Button type="button" variant="whatsapp" className="flex-1" onClick={openWhatsApp}>
            <MessageCircle size={16} /> {t("whatsapp")}
          </Button>
        )}
        <Button type="button" variant="outline" className="flex-1" onClick={directions}>
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
    </div>
  );
}
