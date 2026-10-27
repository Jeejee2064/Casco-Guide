import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/site/Header";
import { FoliageTrail } from "@/components/site/Foliage";
import { Footer } from "@/components/site/Footer";
import { JsonLd } from "@/components/site/JsonLd";
import { ArticleDetailView } from "@/components/site/ArticleDetailView";
import { getArticles, getArticleBySlug } from "@/lib/data/articles";
import { getSpotsByIds } from "@/lib/data/spots";
// Events temporarily hidden site-wide — see the commented block below.
// import { getEventsByIds } from "@/lib/data/events";
import { buildAlternates } from "@/lib/seo/alternates";
import { articleSchema, breadcrumbSchema } from "@/lib/seo/schema";
import { getPathname } from "@/i18n/navigation";
import { absoluteUrl, shareImageUrl, SHARE_IMAGE_META, SITE_NAME } from "@/lib/seo/site";
import { socialMetadata, truncate } from "@/lib/seo/metadata";
import { routing, type Locale } from "@/i18n/routing";

// Prerender every published guide at build time (both locales).
export async function generateStaticParams() {
  const articles = await getArticles("es");
  return routing.locales.flatMap((locale) =>
    articles.map((article) => ({ locale, slug: article.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const article = await getArticleBySlug(slug, locale);
  if (!article) return {};

  const t = await getTranslations({ locale, namespace: "seo" });
  const description = truncate(
    article.excerpt ?? t("articleDescriptionFallback", { title: article.title }),
  );
  const alternates = buildAlternates({ pathname: "/articles/[slug]", params: { slug } }, locale);

  return {
    title: article.title,
    description,
    alternates,
    ...socialMetadata({
      locale,
      title: article.title,
      description,
      url: alternates?.canonical as string,
      type: "article",
      image: {
        url: shareImageUrl("guides", slug, locale, article.updated_at),
        alt: article.title,
        ...SHARE_IMAGE_META,
      },
      openGraph: {
        ...(article.published_at && { publishedTime: article.published_at }),
        modifiedTime: article.updated_at,
        ...(article.author && { authors: [article.author] }),
      },
    }),
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
  const homeUrl = buildAlternates("/", locale)!.canonical as string;
  const citedSpotUrls = citedSpots.map((s) =>
    absoluteUrl(getPathname({ href: { pathname: "/spots/[slug]", params: { slug: s.slug } }, locale })),
  );
  const breadcrumbs = breadcrumbSchema([
    { name: SITE_NAME, url: homeUrl },
    { name: t("title"), url: articlesUrl },
    { name: article.title, url },
  ]);

  return (
    <>
      <JsonLd data={articleSchema(article, url, locale, citedSpotUrls)} />
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
