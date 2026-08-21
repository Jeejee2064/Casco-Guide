import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ArticleDetailView } from "@/components/site/ArticleDetailView";
import { getArticleBySlug } from "@/lib/data/articles";
import { getSpotsByIds } from "@/lib/data/spots";
// Events temporarily hidden site-wide — see the commented block below.
// import { getEventsByIds } from "@/lib/data/events";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const article = await getArticleBySlug(slug, locale);
  if (!article) return {};

  return {
    title: `${article.title} — Casco Guide`,
    description: article.excerpt ?? undefined,
  };
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  setRequestLocale(locale);

  const article = await getArticleBySlug(slug, locale);
  if (!article) notFound();

  const [citedSpots] = await Promise.all([
    getSpotsByIds(article.spot_refs, locale),
    // getEventsByIds(article.event_refs, locale),
  ]);

  return (
    <>
      <Header />
      <main className="flex-1">
        {/* citedEvents intentionally omitted — events hidden site-wide */}
        <ArticleDetailView article={article} citedSpots={citedSpots} />
      </main>
      <Footer />
    </>
  );
}
