import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/site/Header";
import { FoliageTrail } from "@/components/site/Foliage";
import { Footer } from "@/components/site/Footer";
import { JsonLd } from "@/components/site/JsonLd";
import { SpotDetailView } from "@/components/site/SpotDetailView";
import { getSpotBySlug, getRelatedSpots, getSpotById, getChildSpots } from "@/lib/data/spots";
// Events temporarily hidden site-wide — see the commented block below.
// import { getNearbyEvents } from "@/lib/data/events";
import { getArticlesForSpot } from "@/lib/data/articles";
import { buildAlternates } from "@/lib/seo/alternates";
import { breadcrumbSchema, spotSchema } from "@/lib/seo/schema";
import { SITE_NAME, ogLocaleOf, shareImageUrl, shareLink, SHARE_IMAGE_META } from "@/lib/seo/site";
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
  const alternates = buildAlternates({ pathname: "/spots/[slug]", params: { slug } }, locale);
  const ogDescription =
    description.length > 150 ? `${description.slice(0, 147).trimEnd()}…` : description;
  const image = shareImageUrl("spots", slug, locale, spot.updated_at);

  return {
    title,
    description,
    alternates,
    // `openGraph`/`twitter` fully replace (not merge with) the root
    // layout's, so every field worth keeping — url, siteName, locale
    // included — has to be repeated here rather than assumed inherited.
    openGraph: {
      title,
      description: ogDescription,
      // Share origin, not canonical: Facebook re-fetches og:url, which must
      // be reachable (see SHARE_URL).
      url: shareLink(new URL(alternates?.canonical as string).pathname),
      siteName: SITE_NAME,
      locale: ogLocaleOf(locale),
      type: "website",
      alternateLocale: locale === "es" ? ["en_US"] : ["es_PA"],
      images: [{ url: image, alt: spot.name, ...SHARE_IMAGE_META }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
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
  const spotsUrl = buildAlternates("/spots", locale)!.canonical as string;
  // Breadcrumb items must be real, crawlable pages — the category level has
  // no page of its own, so it is left out rather than pointing at an anchor.
  const breadcrumbs = breadcrumbSchema([
    { name: t("spots"), url: spotsUrl },
    { name: spot.name, url },
  ]);

  return (
    <>
      <JsonLd data={spotSchema(spot, url)} />
      <JsonLd data={breadcrumbs} />
      <Header />
      <main className="relative isolate flex-1 overflow-clip">
        <FoliageTrail seed={`spot-${slug}`} />
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
