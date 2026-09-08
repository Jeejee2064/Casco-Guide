"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { HERO_IMAGE } from "@/lib/data/categoryImages";
import type { Article } from "@/lib/types/database";
import { Stagger, StaggerItem } from "./motion";
import { LoadingImage } from "./LoadingImage";

/**
 * Homepage teaser into /articles — bento showcase for the latest guides,
 * previously bolted onto the bottom of Hero (see that component's history)
 * but moved into its own section, below the fold, so the hero itself can
 * stay a clean, single-viewport-tall "pick what you're here for" moment.
 *
 * Layout: the most recent article gets the big tile (left on desktop, top
 * on mobile), the next two stack beside it at half height each — classic
 * "featured + 2 up next" bento, not a 3-up grid, so the newest guide reads
 * as the headline rather than one of three equals.
 */
export function LatestGuidesSection({ articles }: { articles: Article[] }) {
  const t = useTranslations("articles");
  const locale = useLocale();

  if (articles.length === 0) return null;

  const [featured, ...rest] = articles;
  const dateLabel = (article: Article) =>
    article.published_at
      ? new Date(article.published_at).toLocaleDateString(locale, {
          month: "short",
          day: "numeric",
        })
      : null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-extrabold sm:text-3xl">{t("latestTitle")}</h2>
          <p className="mt-1 text-foreground/60">{t("subtitle")}</p>
        </div>
        <Link
          href="/articles"
          className="group flex shrink-0 items-center gap-1.5 text-sm font-semibold text-aqua hover:underline"
        >
          {t("seeAll")}
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      <Stagger className="grid gap-4 sm:h-[420px] sm:grid-cols-[1.6fr_1fr]" amount={0.05}>
        <StaggerItem className="aspect-[4/3] sm:aspect-auto sm:h-full">
          <ArticleTile
            article={featured}
            date={dateLabel(featured)}
            className="h-full"
            titleClassName="text-lg sm:text-2xl"
            showExcerpt
          />
        </StaggerItem>

        <div className="grid gap-4 sm:grid-rows-2">
          {rest.map((article) => (
            <StaggerItem key={article.id} className="aspect-video sm:aspect-auto sm:h-full">
              <ArticleTile
                article={article}
                date={dateLabel(article)}
                className="h-full"
                titleClassName="text-sm sm:text-base"
              />
            </StaggerItem>
          ))}
        </div>
      </Stagger>
    </section>
  );
}

function ArticleTile({
  article,
  date,
  className,
  titleClassName,
  showExcerpt = false,
}: {
  article: Article;
  date: string | null;
  className: string;
  titleClassName: string;
  showExcerpt?: boolean;
}) {
  return (
    <Link
      href={{ pathname: "/articles/[slug]", params: { slug: article.slug } }}
      className={`card-lift group relative block overflow-hidden rounded-[var(--radius-card)] border border-border ${className}`}
    >
      <LoadingImage
        src={article.cover_photo || HERO_IMAGE}
        alt=""
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 60vw, 40vw"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 space-y-1 p-4">
        <h3 className={`font-heading font-bold leading-tight text-white line-clamp-2 ${titleClassName}`}>
          {article.title}
        </h3>
        {showExcerpt && article.excerpt && (
          <p className="line-clamp-2 max-w-md text-sm text-white/75">{article.excerpt}</p>
        )}
        {date && <p className="text-xs font-semibold text-white/55">{date}</p>}
      </div>
    </Link>
  );
}
