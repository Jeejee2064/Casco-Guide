"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, MapPin, CalendarDays, User, Clock, Footprints } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SpotMap } from "./SpotMap";
import { ItineraryMap, type ItineraryStop } from "./ItineraryMap";
import { LoadingImage } from "./LoadingImage";
import { ShareMenu } from "./ShareMenu";
import { Stagger, StaggerItem, staggerContainer, fadeUp } from "./motion";
import type { Article, EventRow, Spot } from "@/lib/types/database";
import { track } from "@/lib/analytics/track";
import { markContentEngaged } from "@/lib/pwaEngagement";
import { cn } from "@/lib/utils";
import { formatDistance, haversineKm, walkingMinutes } from "@/lib/geo";
import { useHeaderHeight } from "./useHeaderHeight";

/** Full public article page — cover, story (either freeform HTML or
 * structured "list"/"photo-story"/"itinerary" blocks, see Article.layout), and a map of
 * every spot/event the article links to. `citedSpots`/`citedEvents` are
 * `Article.spot_refs`/`event_refs` already resolved server-side (see
 * src/app/[locale]/articles/[slug]/page.tsx). `onBack`, when given, is used
 * by the admin preview instead of a real navigation. */
export function ArticleDetailView({
  article,
  citedSpots = [],
  citedEvents = [],
  onBack,
}: {
  article: Article;
  citedSpots?: Spot[];
  citedEvents?: EventRow[];
  onBack?: () => void;
}) {
  const t = useTranslations("articleDetail");
  const tMap = useTranslations("map");
  const locale = useLocale();
  // See SpotDetailView for why this starts in normal flow and only
  // `sticky`s below the header once scrolled to it.
  const headerHeight = useHeaderHeight(true);

  // Gates the reveal of the title/meta block on the cover photo's actual
  // `onLoad` (see SpotDetailView for the same pattern) — with no cover to
  // wait for, there's nothing to gate on, so start "loaded".
  const [coverLoaded, setCoverLoaded] = useState(!article.cover_photo);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [article.id]);

  // Skip the admin form's live inline preview (`onBack` set — see the doc
  // comment above) — an in-progress unsaved draft isn't a real visit.
  useEffect(() => {
    if (onBack) return;
    track("article_view", { article_id: article.id, article_slug: article.slug });
    markContentEngaged();
  }, [article.id, article.slug, onBack]);

  const dateLabel = article.published_at
    ? new Date(article.published_at).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })
    : null;

  const hasCitations = citedSpots.length > 0 || citedEvents.length > 0;

  // For "itinerary" articles, resolve each block's ref (in block/day-plan
  // order) against citedSpots/citedEvents to build the route ItineraryMap
  // draws below — a block without a ref, or one whose ref didn't resolve
  // (e.g. missing coordinates), is simply skipped rather than breaking the
  // sequence.
  const itineraryStops: ItineraryStop[] = useMemo(() => {
    if (article.layout !== "itinerary") return [];
    const stops: ItineraryStop[] = [];
    for (const block of article.blocks) {
      if (block.ref_type === "spot" && block.ref_id) {
        const spot = citedSpots.find((s) => s.id === block.ref_id);
        if (spot) {
          stops.push({
            id: block.id,
            index: stops.length + 1,
            latitude: spot.latitude,
            longitude: spot.longitude,
            name: spot.name,
            href: { pathname: "/spots/[slug]", params: { slug: spot.slug } },
            place: { kind: "spot", spot },
          });
        }
      } else if (block.ref_type === "event" && block.ref_id) {
        const event = citedEvents.find((e) => e.id === block.ref_id);
        if (event) {
          stops.push({
            id: block.id,
            index: stops.length + 1,
            latitude: event.latitude,
            longitude: event.longitude,
            name: event.title,
            href: { pathname: "/events/[slug]", params: { slug: event.slug } },
            place: { kind: "event", event },
          });
        }
      }
    }
    return stops;
  }, [article.layout, article.blocks, citedSpots, citedEvents]);

  // Walking time between one itinerary stop and the next, keyed by the
  // *earlier* block's id — computed from coordinates (haversine distance,
  // ~1.4 m/s walking pace, see lib/geo) rather than stored, so it always
  // matches whatever spots/events the blocks actually link to. A pair
  // where either side lacks resolved coordinates (no ref, or a ref without
  // lat/lng) is simply skipped rather than showing a wrong or missing leg.
  const walkToNext = useMemo(() => {
    const segments = new Map<string, { km: number; mins: number }>();
    if (article.layout !== "itinerary") return segments;
    for (let i = 0; i < itineraryStops.length - 1; i++) {
      const from = itineraryStops[i];
      const to = itineraryStops[i + 1];
      const km = haversineKm(from.latitude, from.longitude, to.latitude, to.longitude);
      segments.set(from.id, { km, mins: walkingMinutes(km) });
    }
    return segments;
  }, [article.layout, itineraryStops]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:px-6 sm:py-10">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={t("back")}
          style={{ top: (headerHeight ?? 56) + 16 }}
          className="glass pill-lift sticky z-30 mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground/70 shadow-[var(--shadow-sm)] hover:text-foreground"
        >
          <ChevronLeft size={20} />
        </button>
      ) : (
        <Link
          href="/articles"
          aria-label={t("back")}
          style={{ top: (headerHeight ?? 56) + 16 }}
          className="glass pill-lift sticky z-30 mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground/70 shadow-[var(--shadow-sm)] hover:text-foreground"
        >
          <ChevronLeft size={20} />
        </Link>
      )}

      {article.cover_photo && (
        // Fades in on mount, same as any other section — LoadingImage's own
        // skeleton/tower mark carries the "still loading" state, so this
        // needs to be visible right away for that to show. The title/meta
        // block below (see the Stagger further down) waits on the actual
        // load instead.
        <motion.div
          className="relative mb-6 aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-card)] lg:aspect-auto lg:h-72"
          initial="hidden"
          animate="show"
          variants={fadeUp}
        >
          <LoadingImage
            src={article.cover_photo}
            alt={article.title}
            sizes="100vw"
            className="object-cover"
            preload
            onLoad={() => setCoverLoaded(true)}
          />
        </motion.div>
      )}

      <Stagger show={coverLoaded} delay={article.cover_photo ? 0.15 : 0}>
        <StaggerItem>
          <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">{article.title}</h1>
        </StaggerItem>

        {article.duration && (
          <StaggerItem>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-aqua/10 px-3 py-1.5 text-sm font-bold text-aqua">
              <Clock size={15} /> {article.duration}
            </span>
          </StaggerItem>
        )}

        <StaggerItem>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm text-foreground/60">
              {article.author && (
                <span className="flex items-center gap-1.5">
                  <User size={14} /> {article.author}
                </span>
              )}
              {dateLabel && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={14} /> {dateLabel}
                </span>
              )}
            </div>
            <ShareMenu
              title={article.title}
              variant="primary"
              entity={{ type: "article", id: article.id, slug: article.slug }}
            />
          </div>

          {article.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {article.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground/60">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </StaggerItem>
      </Stagger>

      {article.body && (
        <motion.div
          // No `dark:prose-invert` — this project's Night Mode is a manual
          // `[data-night]` attribute, not the OS-driven `dark:` variant that
          // modifier depends on. `.prose`'s CSS variables are pointed at
          // this site's own theme tokens instead (see globals.css), which
          // already respond to both Night Mode and OS dark mode correctly.
          className="prose prose-sm sm:prose-base mt-8 max-w-none prose-a:text-aqua prose-a:no-underline prose-a:font-semibold prose-img:rounded-[var(--radius-button)]"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          dangerouslySetInnerHTML={{ __html: article.body }}
        />
      )}

      {article.layout === "list" && article.blocks.length > 0 && (
        <motion.ol
          className="mt-8 space-y-5"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
        >
          {article.blocks.map((block, i) => (
            <motion.li
              key={block.id}
              variants={fadeUp}
              className="flex gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aqua font-heading text-base font-extrabold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                {block.photo && (
                  <BlockPhotoLink block={block} className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-button)]">
                    <LoadingImage src={block.photo} alt={block.title ?? ""} sizes="(max-width: 640px) 100vw, 640px" className="object-cover" />
                  </BlockPhotoLink>
                )}
                {block.title && <h3 className="font-heading text-lg font-bold">{block.title}</h3>}
                {block.text && <p className="text-[15px] leading-relaxed text-foreground/80">{block.text}</p>}
                <BlockRefLink block={block} />
              </div>
            </motion.li>
          ))}
        </motion.ol>
      )}

      {article.layout === "photo-story" && article.blocks.length > 0 && (
        <Stagger className="mt-8 space-y-8">
          {article.blocks.map((block) => (
            <StaggerItem key={block.id}>
              <figure>
                {block.photo && (
                  <BlockPhotoLink block={block} className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-card)]">
                    <LoadingImage src={block.photo} alt={block.title ?? ""} sizes="100vw" className="object-cover" />
                  </BlockPhotoLink>
                )}
                {(block.title || block.text) && (
                  <figcaption className="mt-2.5 space-y-1">
                    {block.title && <p className="font-heading font-bold">{block.title}</p>}
                    {block.text && <p className="text-sm text-foreground/70">{block.text}</p>}
                    <BlockRefLink block={block} />
                  </figcaption>
                )}
              </figure>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {/* `flex flex-col gap-3` rather than `space-y-6`: Tailwind v4's
          space-y only ever pushes children apart via margin-bottom (a
          zero-specificity `:where()` rule), so the walk indicator's old
          `-my-3` didn't trim the gap on both sides the way it looks like it
          should — it fully overrode that margin-bottom into a negative
          value, which margin-collapsed with the *next* stop card's own
          (unset, so 0) margin-top into a net negative gap. That let the
          next card's opaque background paint over the walk text, hiding it.
          `gap` on a flex container never collapses or goes negative, so
          every item — stop card or walk indicator alike — gets a
          consistent, guaranteed-positive gap with no risk of overlap. */}
      {article.layout === "itinerary" && article.blocks.length > 0 && (
        <motion.ol
          className="relative mt-8 flex flex-col gap-3 border-l-2 border-dashed border-aqua/30 pl-6"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
        >
          {article.blocks.map((block) => {
            const walk = walkToNext.get(block.id);
            return (
              <Fragment key={block.id}>
                <motion.li variants={fadeUp} className="relative">
                  <span className="absolute -left-[31px] flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-aqua text-white">
                    <Clock size={14} />
                  </span>
                  <div className="space-y-2 rounded-[var(--radius-card)] border border-border bg-surface p-4">
                    {block.title && (
                      <span className="inline-block rounded-full bg-aqua/15 px-2.5 py-1 text-xs font-bold text-aqua">{block.title}</span>
                    )}
                    {block.photo && (
                      <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-button)]">
                        <LoadingImage src={block.photo} alt={block.title ?? ""} sizes="(max-width: 640px) 100vw, 640px" className="object-cover" />
                      </div>
                    )}
                    {block.text && <p className="text-[15px] leading-relaxed text-foreground/80">{block.text}</p>}
                    <BlockRefLink block={block} />
                  </div>
                </motion.li>
                {walk && (
                  <motion.li variants={fadeUp} className="relative flex items-center gap-1.5 text-xs font-semibold text-foreground/45">
                    <Footprints size={13} className="shrink-0 text-aqua/60" />
                    {tMap("walkTime", { mins: walk.mins })} · {formatDistance(walk.km)}
                  </motion.li>
                )}
              </Fragment>
            );
          })}
        </motion.ol>
      )}

      {hasCitations && (
        <Stagger className="mt-12">
          <StaggerItem>
            <h2 className="font-heading mb-3 text-xl font-bold">{t("placesMentioned")}</h2>
          </StaggerItem>
          <StaggerItem>
            {itineraryStops.length > 0 ? (
              <ItineraryMap stops={itineraryStops} heightClassName="h-[55vh] min-h-[440px]" />
            ) : (
              <SpotMap spots={citedSpots} events={citedEvents} heightClassName="h-[55vh] min-h-[440px]" />
            )}
          </StaggerItem>
          <StaggerItem>
            <div className="mt-3 flex flex-wrap gap-2">
              {itineraryStops.length > 0
                ? itineraryStops.map((stop) => (
                    <Link
                      key={stop.id}
                      href={stop.href}
                      className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-aqua hover:text-aqua"
                    >
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-aqua text-[10px] font-extrabold text-white">
                        {stop.index}
                      </span>
                      {stop.name}
                    </Link>
                  ))
                : [
                    ...citedSpots.map((spot) => (
                      <Link
                        key={spot.id}
                        href={{ pathname: "/spots/[slug]", params: { slug: spot.slug } }}
                        className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-aqua hover:text-aqua"
                      >
                        <MapPin size={12} /> {spot.name}
                      </Link>
                    )),
                    ...citedEvents.map((event) => (
                      <Link
                        key={event.id}
                        href={{ pathname: "/events/[slug]", params: { slug: event.slug } }}
                        className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-coral hover:text-coral"
                      >
                        <CalendarDays size={12} /> {event.title}
                      </Link>
                    )),
                  ]}
            </div>
          </StaggerItem>
        </Stagger>
      )}
    </div>
  );
}

type RefBlock = { ref_type: "spot" | "event" | null; ref_slug: string | null };

/** Same spot/event target `BlockRefLink` below links to, shared so the
 * block's photo (BlockPhotoLink) and its "View spot"/"View event" link
 * always agree on where a click goes. */
function blockRefHref(block: RefBlock) {
  if (!block.ref_type || !block.ref_slug) return null;
  return block.ref_type === "spot"
    ? ({ pathname: "/spots/[slug]", params: { slug: block.ref_slug } } as const)
    : ({ pathname: "/events/[slug]", params: { slug: block.ref_slug } } as const);
}

function BlockRefLink({ block }: { block: RefBlock }) {
  const t = useTranslations("articleDetail");
  const href = blockRefHref(block);
  if (!href) return null;

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-bold",
        block.ref_type === "spot" ? "text-aqua" : "text-coral",
      )}
    >
      {block.ref_type === "spot" ? <MapPin size={12} /> : <CalendarDays size={12} />}
      {block.ref_type === "spot" ? t("viewSpot") : t("viewEvent")}
    </Link>
  );
}

/** Wraps a "list"/"photo-story" block's photo in a link to the same spot/
 * event `BlockRefLink` points to, so clicking the image itself navigates
 * too — not just the explicit "View spot"/"View event" link below it.
 * Renders a plain, non-interactive div when the block has no ref. */
function BlockPhotoLink({
  block,
  className,
  children,
}: {
  block: RefBlock;
  className: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("articleDetail");
  const href = blockRefHref(block);
  if (!href) return <div className={className}>{children}</div>;

  return (
    <Link
      href={href}
      aria-label={block.ref_type === "spot" ? t("viewSpot") : t("viewEvent")}
      className={cn(className, "block transition-opacity hover:opacity-90")}
    >
      {children}
    </Link>
  );
}
