import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { JsonLd } from "@/components/site/JsonLd";
import { SpotDetailView } from "@/components/site/SpotDetailView";
import { getSpotBySlug, getRelatedSpots, getSpotById, getChildSpots } from "@/lib/data/spots";
// Events temporarily hidden site-wide — see the commented block below.
// import { getNearbyEvents } from "@/lib/data/events";
import { getArticlesForSpot } from "@/lib/data/articles";
import { buildAlternates } from "@/lib/seo/alternates";
import { breadcrumbSchema, spotSchema } from "@/lib/seo/schema";
import { absoluteUrl, SITE_NAME, ogLocaleOf } from "@/lib/seo/site";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const spot = await getSpotBySlug(slug, locale);
  if (!spot) return {};

  const [t, tCategory] = await Promise.all([
    getTranslations({ locale, namespace: "seo" }),
    getTranslations({ locale, namespace: "category" }),
  ]);
  const category = tCategory(spot.category);
  const title = t("spotTitle", { name: spot.name, category });
  const description = spot.description ?? t("spotDescriptionFallback", { name: spot.name, category });
  const image = spot.featured_photo ?? spot.photos[0]?.url;
  const alternates = buildAlternates({ pathname: "/spots/[slug]", params: { slug } }, locale);

  return {
    title,
    description,
    alternates,
    // `openGraph`/`twitter` fully replace (not merge with) the root
    // layout's, so every field worth keeping — url, siteName, locale
    // included — has to be repeated here rather than assumed inherited.
    openGraph: {
      title,
      description,
      url: alternates?.canonical as string,
      siteName: SITE_NAME,
      locale: ogLocaleOf(locale),
      type: "website",
      ...(image && { images: [{ url: absoluteUrl(image), alt: spot.name }] }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image && { images: [absoluteUrl(image)] }),
    },
  };
}

export default async function SpotDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  setRequestLocale(locale);

  const spot = await getSpotBySlug(slug, locale);
  if (!spot) notFound();

  const [articles, t, tCategory, parentSpot, childSpots] = await Promise.all([
    // getNearbyEvents(spot.latitude, spot.longitude, locale, { limit: 4 }),
    getArticlesForSpot(spot.id, locale),
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "category" }),
    // A spot has at most one of these two — see SpotDetailView's doc comment.
    spot.parent_id ? getSpotById(spot.parent_id, locale) : Promise.resolve(null),
    getChildSpots(spot.id, locale),
  ]);

  // Run after the hub lookups above (not folded into that Promise.all) since
  // it needs their ids to exclude the parent/sibling spots already shown in
  // the "part of"/"places here" sections from the "you might also like" rail.
  const relatedSpots = await getRelatedSpots(spot, locale, {
    excludeIds: [parentSpot?.id, ...childSpots.map((c) => c.id)].filter((id): id is string => Boolean(id)),
    limit: 6,
  });

  const url = buildAlternates({ pathname: "/spots/[slug]", params: { slug } }, locale)!.canonical as string;
  const homeUrl = buildAlternates("/", locale)!.canonical as string;
  const breadcrumbs = breadcrumbSchema([
    { name: t("spots"), url: `${homeUrl}#explore` },
    { name: tCategory(spot.category), url: `${homeUrl}#explore` },
    { name: spot.name, url },
  ]);

  return (
    <>
      <JsonLd data={spotSchema(spot, url)} />
      <JsonLd data={breadcrumbs} />
      <Header />
      <main className="flex-1">
        <SpotDetailView
          spot={spot}
          nearbySpots={relatedSpots}
          // nearbyEvents intentionally omitted — events hidden site-wide
          articles={articles}
          parentSpot={parentSpot}
          childSpots={childSpots}
        />
      </main>
      <Footer />
    </>
  );
}
