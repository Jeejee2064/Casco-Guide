import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/site/Header";
import { FoliageTrail } from "@/components/site/Foliage";
import { Footer } from "@/components/site/Footer";
import { JsonLd } from "@/components/site/JsonLd";
import { ArticleDetailView } from "@/components/site/ArticleDetailView";
import { getArticleBySlug } from "@/lib/data/articles";
import { getSpotsByIds } from "@/lib/data/spots";
// Events temporarily hidden site-wide — see the commented block below.
// import { getEventsByIds } from "@/lib/data/events";
import { buildAlternates } from "@/lib/seo/alternates";
import { articleSchema, breadcrumbSchema } from "@/lib/seo/schema";
import { SITE_NAME, ogLocaleOf, shareImageUrl, shareLink, SHARE_IMAGE_META } from "@/lib/seo/site";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const article = await getArticleBySlug(slug, locale);
  if (!article) return {};

  const t = await getTranslations({ locale, namespace: "seo" });
  const description = article.excerpt ?? t("articleDescriptionFallback", { title: article.title });
  const alternates = buildAlternates({ pathname: "/articles/[slug]", params: { slug } }, locale);
  const image = shareImageUrl("guides", slug, locale, article.updated_at);

  return {
    title: article.title,
    description,
    alternates,
    // `openGraph` fully replaces (not merges with) the root layout's, so
    // every field worth keeping — url, siteName, locale included — has to
    // be repeated here rather than assumed inherited.
    openGraph: {
      title: article.title,
      description,
      // Share origin, not canonical: Facebook re-fetches og:url, which must
      // be reachable (see SHARE_URL).
      url: shareLink(new URL(alternates?.canonical as string).pathname),
      siteName: SITE_NAME,
      locale: ogLocaleOf(locale),
      type: "article",
      ...(article.published_at && { publishedTime: article.published_at }),
      modifiedTime: article.updated_at,
      ...(article.author && { authors: [article.author] }),
      alternateLocale: locale === "es" ? ["en_US"] : ["es_PA"],
      images: [{ url: image, alt: article.title, ...SHARE_IMAGE_META }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: [image],
    },
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

  const [citedSpots, t] = await Promise.all([
    getSpotsByIds(article.spot_refs, locale),
    // getEventsByIds(article.event_refs, locale),
    getTranslations({ locale, namespace: "articles" }),
  ]);

  const url = buildAlternates({ pathname: "/articles/[slug]", params: { slug } }, locale)!
    .canonical as string;
  const articlesUrl = buildAlternates("/articles", locale)!.canonical as string;
  const breadcrumbs = breadcrumbSchema([
    { name: t("title"), url: articlesUrl },
    { name: article.title, url },
  ]);

  return (
    <>
      <JsonLd data={articleSchema(article, url, locale)} />
      <JsonLd data={breadcrumbs} />
      <Header />
      <main className="relative isolate flex-1 overflow-clip">
        <FoliageTrail seed={`article-${slug}`} />
        {/* citedEvents intentionally omitted — events hidden site-wide */}
        <ArticleDetailView article={article} citedSpots={citedSpots} />
      </main>
      <Footer />
    </>
  );
}
