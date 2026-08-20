"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ArticleCard } from "./ArticleCard";
import type { Article } from "@/lib/types/database";

/** Public article listing grid — navigates on click instead of wrapping
 * ArticleCard's <button> in a <Link> (invalid nesting), same pattern as
 * SpotCard inside NearbySection.tsx. */
export function ArticlesGrid({ articles }: { articles: Article[] }) {
  const t = useTranslations("articles");
  const router = useRouter();

  if (articles.length === 0) {
    return <p className="py-16 text-center text-foreground/50">{t("empty")}</p>;
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          onClick={() => router.push({ pathname: "/articles/[slug]", params: { slug: article.slug } })}
        />
      ))}
    </div>
  );
}
