"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronLeft, MapPin, CalendarDays, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SpotMap } from "./SpotMap";
import { ShareMenu } from "./ShareMenu";
import { Stagger, StaggerItem, staggerContainer, fadeUp } from "./motion";
import type { Article, EventRow, Spot } from "@/lib/types/database";
import { cn } from "@/lib/utils";

/** Full public article page — cover, story (either freeform HTML or
 * structured "list"/"photo-story" blocks, see Article.layout), and a map of
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
  const locale = useLocale();

  // Gates the reveal of the title/meta block on the cover photo's actual
  // `onLoad` (see SpotDetailView for the same pattern) — with no cover to
  // wait for, there's nothing to gate on, so start "loaded".
  const [coverLoaded, setCoverLoaded] = useState(!article.cover_photo);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [article.id]);

  const dateLabel = article.published_at
    ? new Date(article.published_at).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })
    : null;

  const hasCitations = citedSpots.length > 0 || citedEvents.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:px-6 sm:py-10">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/60 hover:text-foreground"
        >
          <ChevronLeft size={16} /> {t("back")}
        </button>
      ) : (
        <Link href="/articles" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/60 hover:text-foreground">
          <ChevronLeft size={16} /> {t("back")}
        </Link>
      )}

      {article.cover_photo && (
        // Fades in only once it's actually loaded — the title/meta block
        // below (see the Stagger further down) waits on that same flag.
        <motion.div
          className={cn(
            "relative mb-6 aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-card)]",
            !coverLoaded && "animate-pulse bg-foreground/5",
          )}
          initial="hidden"
          animate={coverLoaded ? "show" : "hidden"}
          variants={fadeUp}
        >
          <Image
            src={article.cover_photo}
            alt={article.title}
            fill
            sizes="100vw"
            className="object-cover"
            priority
            onLoad={() => setCoverLoaded(true)}
          />
        </motion.div>
      )}

      <Stagger show={coverLoaded} delay={article.cover_photo ? 0.15 : 0}>
        <StaggerItem>
          <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">{article.title}</h1>
        </StaggerItem>

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
            <ShareMenu title={article.title} variant="coral" />
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
          className="prose prose-sm sm:prose-base mt-8 max-w-none dark:prose-invert prose-a:text-aqua prose-a:no-underline prose-a:font-semibold prose-img:rounded-[var(--radius-button)]"
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
                  <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-button)]">
                    <Image src={block.photo} alt={block.title ?? ""} fill sizes="(max-width: 640px) 100vw, 640px" className="object-cover" />
                  </div>
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
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-card)]">
                    <Image src={block.photo} alt={block.title ?? ""} fill sizes="100vw" className="object-cover" />
                  </div>
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

      {hasCitations && (
        <Stagger className="mt-12">
          <StaggerItem>
            <h2 className="font-heading mb-3 text-xl font-bold">{t("placesMentioned")}</h2>
          </StaggerItem>
          <StaggerItem>
            <SpotMap spots={citedSpots} events={citedEvents} heightClassName="h-[45vh] min-h-[320px]" />
          </StaggerItem>
          <StaggerItem>
            <div className="mt-3 flex flex-wrap gap-2">
              {citedSpots.map((spot) => (
                <Link
                  key={spot.id}
                  href={{ pathname: "/spots/[slug]", params: { slug: spot.slug } }}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-aqua hover:text-aqua"
                >
                  <MapPin size={12} /> {spot.name}
                </Link>
              ))}
              {citedEvents.map((event) => (
                <Link
                  key={event.id}
                  href={{ pathname: "/events/[slug]", params: { slug: event.slug } }}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-coral hover:text-coral"
                >
                  <CalendarDays size={12} /> {event.title}
                </Link>
              ))}
            </div>
          </StaggerItem>
        </Stagger>
      )}
    </div>
  );
}

function BlockRefLink({
  block,
}: {
  block: { ref_type: "spot" | "event" | null; ref_slug: string | null };
}) {
  const t = useTranslations("articleDetail");
  if (!block.ref_type || !block.ref_slug) return null;

  return (
    <Link
      href={
        block.ref_type === "spot"
          ? { pathname: "/spots/[slug]", params: { slug: block.ref_slug } }
          : { pathname: "/events/[slug]", params: { slug: block.ref_slug } }
      }
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
