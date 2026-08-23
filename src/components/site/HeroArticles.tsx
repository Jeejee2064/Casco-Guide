"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { HERO_IMAGE } from "@/lib/data/categoryImages";
import type { Article } from "@/lib/types/database";
import { fadeUp } from "./motion";

/**
 * Bento showcase for the 3 latest guides, replacing the old plain "Latest
 * guides" grid section further down the page — this is now the only place
 * the home page surfaces articles, so it doubles as that section's "see
 * all" entry point. Rendered right under Hero's title/pills block, above
 * the search/filter bar.
 *
 * Layout: the most recent article gets the big tile (left on desktop, top
 * on mobile), the next two stack beside it at half height each — classic
 * "featured + 2 up next" bento, not a 3-up grid, so the newest guide reads
 * as the headline rather than one of three equals. On mobile the other two
 * are dropped entirely (not just visually de-emphasized) — one tall image
 * per screen keeps the hero from turning into a long scroll before the
 * search bar even shows up.
 */
export function HeroArticles({ articles }: { articles: Article[] }) {
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
    <motion.div variants={fadeUp} className="mt-8 sm:mt-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-bold text-white sm:text-xl">{t("latestTitle")}</h2>
        <Link href="/articles" className="text-sm font-semibold text-aqua hover:underline">
          {t("seeAll")} →
        </Link>
      </div>

      <div className="grid gap-4 sm:h-[420px] sm:grid-cols-[1.6fr_1fr]">
        <ArticleTile
          article={featured}
          date={dateLabel(featured)}
          className="aspect-[4/3] sm:aspect-auto sm:h-full"
          titleClassName="text-lg sm:text-2xl"
          showExcerpt
        />

        <div className="hidden gap-4 sm:grid sm:grid-rows-2">
          {rest.map((article) => (
            <ArticleTile
              key={article.id}
              article={article}
              date={dateLabel(article)}
              className="aspect-video sm:aspect-auto sm:h-full"
              titleClassName="text-sm sm:text-base"
            />
          ))}
        </div>
      </div>
    </motion.div>
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
      className={`card-lift group relative block overflow-hidden rounded-[var(--radius-card)] border border-white/15 ${className}`}
    >
      <Image
        src={article.cover_photo || HERO_IMAGE}
        alt=""
        fill
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
