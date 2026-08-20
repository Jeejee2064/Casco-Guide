"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { TAP_SPRING } from "./motion";
import { HERO_IMAGE } from "@/lib/data/categoryImages";
import type { Article } from "@/lib/types/database";

export function ArticleCard({ article, onClick }: { article: Article; onClick: () => void }) {
  const t = useTranslations("articleDetail");
  const locale = useLocale();
  const dateLabel = article.published_at
    ? new Date(article.published_at).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={TAP_SPRING}
      className="card-lift group w-full overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface text-left shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-aqua"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-aqua/20 to-coral/20">
        <Image
          src={article.cover_photo || HERO_IMAGE}
          alt={article.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="space-y-2 p-4">
        <h3 className="font-heading text-lg font-bold leading-tight line-clamp-2">{article.title}</h3>
        {article.excerpt && <p className="text-sm text-foreground/70 line-clamp-2">{article.excerpt}</p>}
        <div className="flex items-center gap-2 pt-1 text-xs text-foreground/50">
          {article.author && <span>{article.author}</span>}
          {article.author && dateLabel && <span>·</span>}
          {dateLabel && <span>{dateLabel}</span>}
          {!article.is_published && (
            <span className="ml-auto rounded-full bg-coral/15 px-2 py-0.5 font-semibold text-coral">{t("draft")}</span>
          )}
        </div>
      </div>
    </motion.button>
  );
}
